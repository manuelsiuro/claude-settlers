import { BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState } from './Building';
import type { Building } from './Building';
import type { GameState } from './GameState';
import type { CombatManager } from './CombatManager';
import type { TerritoryManager } from './TerritoryManager';
import type { DuelAnimationManager } from './DuelAnimationManager';
import type { Unit } from './Unit';
import { UnitState, setUnitPath, clearUnitPath } from './Unit';
import { UnitType, UNIT_DEFINITIONS } from './UnitType';
import type { RoadNetwork } from './RoadNetwork';
import { findPath } from './Pathfinding';

/** All unit types that can be ordered to attack */
const ATTACKABLE_TYPES = new Set<UnitType>([
  UnitType.Knight,
  UnitType.Archer,
  UnitType.Cavalry,
  UnitType.SiegeOperator,
  UnitType.Scout,
]);

/**
 * An active attack: a knight walking toward an enemy building.
 */
interface AttackOrder {
  knightId: string;
  targetBuildingId: string;
  /** Once arrived, we process combat */
  arrived: boolean;
}

/**
 * Manages attack orders: knight movement to target, sequential combat,
 * building capture, and territory recalculation.
 *
 * Flow:
 *   1. Player issues attack order (knight → enemy military building)
 *   2. Knight walks to the target building
 *   3. On arrival, fights defenders one by one
 *   4. If all defenders beaten → capture building, flip territory
 *   5. Civilian buildings in new territory change ownership
 */
export class AttackManager {
  private gameState: GameState;
  private combatManager: CombatManager;
  private territoryManager: TerritoryManager;
  private duelAnimationManager: DuelAnimationManager | null;
  private getWorldY: ((q: number, r: number) => number) | null;
  private roadNetwork: RoadNetwork | null;

  /** Active attack orders */
  private attacks: AttackOrder[] = [];

  /** Callback for territory changes (e.g., to update renderer) */
  onTerritoryChanged: (() => void) | null = null;

  /** Callback when a building is captured (oldPlayerId = previous owner, byPlayerId = captor) */
  onBuildingCaptured: ((building: Building, byPlayerId: number, oldPlayerId: number) => void) | null = null;

  /** Callback when an attack begins against a building */
  onBuildingUnderAttack: ((building: Building) => void) | null = null;

  constructor(
    gameState: GameState,
    combatManager: CombatManager,
    territoryManager: TerritoryManager,
    duelAnimationManager?: DuelAnimationManager,
    getWorldY?: (q: number, r: number) => number,
    roadNetwork?: RoadNetwork,
  ) {
    this.gameState = gameState;
    this.combatManager = combatManager;
    this.territoryManager = territoryManager;
    this.duelAnimationManager = duelAnimationManager ?? null;
    this.getWorldY = getWorldY ?? null;
    this.roadNetwork = roadNetwork ?? null;
  }

  /** Serialization: get internal state for save */
  _getState(): { attacks: AttackOrder[] } {
    return { attacks: [...this.attacks] };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: { attacks: AttackOrder[] }): void {
    this.attacks = [...state.attacks];
  }

  /**
   * Order a knight to attack an enemy military building.
   * Returns true if the order was valid and issued.
   */
  orderAttack(knightId: string, targetBuildingId: string): boolean {
    const knight = this.gameState.getUnit(knightId);
    if (!knight || !ATTACKABLE_TYPES.has(knight.type)) return false;

    const target = this.gameState.getBuilding(targetBuildingId);
    if (!target) return false;

    // Target must be an active military building owned by a different player
    const def = BUILDING_DEFINITIONS[target.type];
    if (def.knightSlots <= 0 && def.influenceRadius <= 0) return false;
    if (target.state !== BuildingState.Active) return false;
    if (target.playerId === knight.playerId) return false;

    // Remove knight from its current building
    if (knight.assignedBuildingId) {
      const srcBuilding = this.gameState.getBuilding(knight.assignedBuildingId);
      if (srcBuilding) {
        srcBuilding.knightIds = srcBuilding.knightIds.filter((id) => id !== knightId);
      }
    }

    // Pathfind to target
    const path = findPath(
      this.gameState.getGrid(),
      knight.coord,
      target.coord,
    );

    if (path.length === 0) {
      // Can't reach — return knight to its building
      return false;
    }

    setUnitPath(knight, path);
    knight.state = UnitState.WalkingToWork;
    knight.assignedBuildingId = targetBuildingId;

    this.onBuildingUnderAttack?.(target);

    this.attacks.push({
      knightId,
      targetBuildingId,
      arrived: false,
    });

    return true;
  }

  /**
   * Send all available knights from specified buildings to attack a target.
   * Returns the number of knights sent.
   */
  groupAttack(sourceBuildingIds: string[], targetBuildingId: string): number {
    let sent = 0;
    for (const srcId of sourceBuildingIds) {
      const building = this.gameState.getBuilding(srcId);
      if (!building) continue;
      // Send all knights except 1 (keep a garrison)
      const knightsToSend = [...building.knightIds];
      if (knightsToSend.length > 1) knightsToSend.pop(); // keep 1
      for (const knightId of knightsToSend) {
        if (this.orderAttack(knightId, targetBuildingId)) sent++;
      }
    }
    return sent;
  }

  /**
   * Update attack orders each frame.
   * Checks for arrivals and processes combat.
   */
  update(deltaTime = 0): void {
    // Process completed duel animations first
    if (this.duelAnimationManager) {
      const completed = this.duelAnimationManager.update(deltaTime);
      for (const { attackerId, result } of completed) {
        this.combatManager.applyDuelResult(result);

        // If the attacker lost, remove the attack order
        if (result.loserId === attackerId) {
          const idx = this.attacks.findIndex((a) => a.knightId === attackerId);
          if (idx !== -1) {
            this.attacks.splice(idx, 1);
          }
        }
        // If defender lost, attack continues to next defender on next tick
      }
    }

    const toRemove: number[] = [];

    for (let i = 0; i < this.attacks.length; i++) {
      const attack = this.attacks[i];
      const knight = this.gameState.getUnit(attack.knightId);

      // Knight died or was removed
      if (!knight) {
        toRemove.push(i);
        continue;
      }

      // Target building removed
      const target = this.gameState.getBuilding(attack.targetBuildingId);
      if (!target) {
        // Send knight home
        this.sendKnightHome(knight);
        toRemove.push(i);
        continue;
      }

      // Check if knight has arrived (WalkingToWork → path complete)
      if (knight.state === UnitState.Working || knight.state === UnitState.Fighting || this.hasArrived(knight)) {
        if (knight.state !== UnitState.Working && knight.state !== UnitState.Fighting) {
          clearUnitPath(knight);
          knight.state = UnitState.Working;
        }

        // If knight is currently in a duel animation, wait
        if (this.duelAnimationManager && this.duelAnimationManager.isInDuel(attack.knightId)) {
          continue;
        }

        const unitDef = UNIT_DEFINITIONS[knight.type];

        // Siege operators damage buildings directly instead of fighting defenders
        if (unitDef.buildingDamage && unitDef.buildingDamage > 0) {
          const newHp = this.combatManager.applySiegeDamage(attack.knightId, target);
          if (newHp <= 0) {
            // Building HP depleted — capture it
            this.captureBuilding(target, knight.playerId);
            knight.assignedBuildingId = target.id;
            knight.state = UnitState.Working;
            target.knightIds.push(knight.id);
            target.hp = 1.0; // restore after capture
            toRemove.push(i);
          }
          // Otherwise keep sieging next tick
          continue;
        }

        // Fight the next defender
        const defenderIds = [...target.knightIds];
        if (defenderIds.length > 0) {
          const defenderId = defenderIds[0];

          // Animated path: start duel animation
          if (this.duelAnimationManager && this.getWorldY) {
            const started = this.duelAnimationManager.startDuel(
              attack.knightId,
              defenderId,
              this.combatManager,
              this.gameState,
              this.getWorldY,
            );
            if (!started) {
              toRemove.push(i);
            }
            continue;
          }

          // Instant path (tests / no animation manager)
          const result = this.combatManager.resolveDuel(attack.knightId, defenderId);

          if (!result) {
            toRemove.push(i);
            continue;
          }

          if (result.loserId === attack.knightId) {
            // Attacker lost — attack is over
            toRemove.push(i);
          }
          // If defender lost, the loop continues next tick
        } else {
          // No defenders — capture the building
          this.captureBuilding(target, knight.playerId);

          // Station the attacking knight in the captured building
          knight.assignedBuildingId = target.id;
          knight.state = UnitState.Working;
          target.knightIds.push(knight.id);

          toRemove.push(i);
        }
      }
    }

    // Remove processed attacks (in reverse order to preserve indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.attacks.splice(toRemove[i], 1);
    }
  }

  /**
   * Check if a unit has arrived at its destination.
   */
  private hasArrived(unit: { state: string; path: { q: number; r: number }[]; pathIndex: number }): boolean {
    if (unit.state !== UnitState.WalkingToWork) return false;
    return unit.path.length > 0 && unit.pathIndex >= unit.path.length - 1;
  }

  /**
   * Capture a building: change ownership, recalculate territory,
   * and transfer all entities in newly captured territory.
   */
  private captureBuilding(building: Building, newPlayerId: number): void {
    const oldPlayerId = building.playerId;
    building.playerId = newPlayerId;

    // Clear remaining knights (shouldn't be any, but safety)
    for (const knightId of building.knightIds) {
      this.combatManager.removeKnightData(knightId);
      this.gameState.removeUnit(knightId);
    }
    building.knightIds = [];

    // Recalculate territory
    this.territoryManager.markDirty();
    this.territoryManager.update();

    // Transfer all entities in newly captured territory
    this.handleTerritoryTransfer(oldPlayerId, newPlayerId);

    this.onBuildingCaptured?.(building, newPlayerId, oldPlayerId);
    this.onTerritoryChanged?.();
  }

  /**
   * After territory changes, transfer all entities of the old player
   * that are now in the new player's territory: buildings, workers,
   * flags, transporters, and loose units.
   */
  private handleTerritoryTransfer(oldPlayerId: number, newPlayerId: number): void {
    this.transferCivilianBuildings(oldPlayerId, newPlayerId);
    this.transferFlags(oldPlayerId, newPlayerId);
    this.transferTransporters(oldPlayerId, newPlayerId);
    this.transferLooseUnits(oldPlayerId, newPlayerId);
  }

  /**
   * Transfer civilian buildings in captured territory, along with
   * their workers, extra workers, and garrisoned knights.
   */
  private transferCivilianBuildings(oldPlayerId: number, newPlayerId: number): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.playerId !== oldPlayerId) continue;
      if (building.state === BuildingState.Destroyed) continue;

      const def = BUILDING_DEFINITIONS[building.type];

      // Skip military buildings (they're captured via combat, not territory)
      if (def.category === 'military' || def.category === 'core') continue;

      // Check if this building is now in the new player's territory
      const owner = this.territoryManager.getOwner(building.coord.q, building.coord.r);
      if (owner !== newPlayerId) continue;

      // Transfer building ownership
      building.playerId = newPlayerId;

      // Transfer primary worker
      const worker = this.gameState.getWorkerForBuilding(building.id);
      if (worker) {
        worker.playerId = newPlayerId;
      }

      // Transfer extra workers (from worker upgrades)
      for (const extraId of (building.extraWorkerIds ?? [])) {
        const extra = this.gameState.getUnit(extraId);
        if (extra) {
          extra.playerId = newPlayerId;
        }
      }

      // Transfer garrisoned knights (e.g. Watchtowers with both workers and knights)
      for (const knightId of building.knightIds) {
        const knight = this.gameState.getUnit(knightId);
        if (knight) {
          knight.playerId = newPlayerId;
        }
      }
    }
  }

  /**
   * Transfer flags in captured territory to the new player.
   * Goods at flags are left as-is — logistics will re-route naturally.
   */
  private transferFlags(oldPlayerId: number, newPlayerId: number): void {
    if (!this.roadNetwork) return;

    for (const flag of this.roadNetwork.getAllFlags()) {
      if (flag.playerId !== oldPlayerId) continue;

      const owner = this.territoryManager.getOwner(flag.coord.q, flag.coord.r);
      if (owner !== newPlayerId) continue;

      flag.playerId = newPlayerId;
    }
  }

  /**
   * Transfer transporters on roads where both flags now belong to the new player.
   * Mixed-ownership roads (border roads) are left alone.
   */
  private transferTransporters(oldPlayerId: number, newPlayerId: number): void {
    if (!this.roadNetwork) return;

    for (const road of this.roadNetwork.getAllRoads()) {
      if (!road.transporterId) continue;

      const flagA = this.roadNetwork.getFlag(road.flagA);
      const flagB = this.roadNetwork.getFlag(road.flagB);
      if (!flagA || !flagB) continue;

      // Only transfer when both flags belong to the new player
      if (flagA.playerId !== newPlayerId || flagB.playerId !== newPlayerId) continue;

      const transporter = this.gameState.getUnit(road.transporterId);
      if (transporter && transporter.playerId === oldPlayerId) {
        transporter.playerId = newPlayerId;
      }
    }
  }

  /**
   * Transfer idle/unassigned civilian units in captured territory,
   * and units assigned to already-captured buildings.
   */
  private transferLooseUnits(oldPlayerId: number, newPlayerId: number): void {
    const units = this.gameState.getUnitsByPlayer(oldPlayerId);

    for (const unit of units) {
      // Skip military units (handled through building capture combat)
      if (UNIT_DEFINITIONS[unit.type].category === 'military') continue;

      // Skip units walking home (they're disengaging)
      if (unit.state === UnitState.WalkingHome) continue;

      // Check if unit is in captured territory
      const owner = this.territoryManager.getOwner(unit.coord.q, unit.coord.r);
      if (owner !== newPlayerId) continue;

      // Transfer if idle with no assignment
      if (unit.state === UnitState.Idle && !unit.assignedBuildingId) {
        unit.playerId = newPlayerId;
        continue;
      }

      // Transfer if assigned to a building that was already captured
      if (unit.assignedBuildingId) {
        const building = this.gameState.getBuilding(unit.assignedBuildingId);
        if (building && building.playerId === newPlayerId) {
          unit.playerId = newPlayerId;
        }
      }
    }
  }

  /**
   * Send a knight back home after a failed attack or target removal.
   */
  private sendKnightHome(knight: Unit): void {
    const castle = this.gameState.findCastle(knight.playerId);
    knight.assignedBuildingId = null;

    if (!castle) {
      knight.state = UnitState.Idle;
      return;
    }

    const path = findPath(this.gameState.getGrid(), knight.coord, castle.coord);
    if (path.length > 0) {
      setUnitPath(knight, path);
      knight.state = UnitState.WalkingHome;
    } else {
      knight.state = UnitState.Idle;
    }
  }

  /**
   * Check all players for buildings/units/flags in foreign territory
   * and transfer them. Called after territory recalculation (not just combat).
   * This handles passive territory expansion (e.g., building a Guard Hut
   * near enemy buildings).
   */
  checkTerritoryTransfers(): void {
    const buildings = this.gameState.getAllBuildings();
    const playerIds = new Set<number>();
    for (const b of buildings) playerIds.add(b.playerId);

    let anyTransferred = false;

    // For each pair of players, check if any entities need transfer
    for (const oldPlayerId of playerIds) {
      for (const newPlayerId of playerIds) {
        if (oldPlayerId === newPlayerId) continue;

        // Check if any civilian buildings of oldPlayer are in newPlayer's territory
        const hasOverlap = buildings.some((b) => {
          if (b.playerId !== oldPlayerId || b.state === BuildingState.Destroyed) return false;
          const def = BUILDING_DEFINITIONS[b.type];
          if (def.category === 'military' || def.category === 'core') return false;
          return this.territoryManager.getOwner(b.coord.q, b.coord.r) === newPlayerId;
        });

        if (hasOverlap) {
          this.handleTerritoryTransfer(oldPlayerId, newPlayerId);
          anyTransferred = true;
        }
      }
    }

    if (anyTransferred) {
      this.onTerritoryChanged?.();
    }
  }

  /** Get the number of active attacks */
  getActiveAttackCount(): number {
    return this.attacks.length;
  }
}
