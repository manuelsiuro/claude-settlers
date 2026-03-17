import type { GameState } from './GameState';
import type { RoadNetwork, Flag, FlagGood } from './RoadNetwork';
import type { Unit } from './Unit';
import { UnitState, setUnitPath, clearUnitPath } from './Unit';
import { UnitType } from './UnitType';
import { findPath } from './Pathfinding';
import { hasInputSpace } from './Building';
import { BUILDING_DEFINITIONS } from './BuildingType';

/**
 * Transporter state machine within a road segment.
 * Each transporter walks back and forth between its two flags,
 * picking up goods that need to go in its travel direction.
 */
interface TransporterState {
  roadId: string;
  /** Which flag the transporter is heading toward */
  targetFlagId: string;
  /** Whether the transporter is currently carrying a good */
  carrying: FlagGood | null;
  /** When set, the transporter is idle at this flag waiting for goods */
  waitingAtFlagId: string | null;
}

/**
 * Manages transporter units on the road network.
 *
 * Each road segment gets one transporter that walks back and forth
 * between its two flags. At each flag, the transporter:
 *   1. Drops off any carried good
 *   2. Picks up a good that needs to go toward the other flag
 *   3. If no goods, idles at the current flag until goods appear
 */
export class TransporterManager {
  private gameState: GameState;
  private roadNetwork: RoadNetwork;

  /** Track transporter state: unitId → TransporterState */
  private transporterStates: Map<string, TransporterState> = new Map();

  /** Cooldown for spawning transporters */
  private spawnCooldown = 0;
  private static SPAWN_INTERVAL = 1.0;

  constructor(gameState: GameState, roadNetwork: RoadNetwork) {
    this.gameState = gameState;
    this.roadNetwork = roadNetwork;
  }

  /** Serialization: get internal state for save */
  _getState(): {
    transporterStates: [string, TransporterState][];
    spawnCooldown: number;
  } {
    return {
      transporterStates: Array.from(this.transporterStates.entries()),
      spawnCooldown: this.spawnCooldown,
    };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: {
    transporterStates: [string, { roadId: string; targetFlagId: string; carrying: FlagGood | null; waitingAtFlagId?: string | null }][];
    spawnCooldown: number;
  }): void {
    // Backward compatibility: default waitingAtFlagId to null for v1 saves
    const entries: [string, TransporterState][] = state.transporterStates.map(
      ([id, s]) => [id, { ...s, waitingAtFlagId: s.waitingAtFlagId ?? null }],
    );
    this.transporterStates = new Map(entries);
    this.spawnCooldown = state.spawnCooldown;
  }

  update(deltaTime: number): void {
    this.deliverStrandedGoods();
    this.spawnTransporters(deltaTime);
    this.handleArrivals();
    this.handleIdleTransporters();
    this.cleanupOrphans();
    this.rebalanceBlockedInputs(); // After all deliveries to avoid oscillation
  }

  /**
   * Deliver goods that are stranded at their destination flag.
   * This happens when deliverToBuilding() fails (building input full) and pushes
   * the good back onto the flag with destinationFlagId still pointing to that flag.
   * No transporter will ever pick these up because findRoute returns length 1.
   *
   * Phase 1: Deliver with per-resource caps (inputSpec.amount * 2) to prevent
   *   one resource from hogging all input capacity.
   * Phase 2: Discard surplus stranded goods that will never be accepted.
   */
  private deliverStrandedGoods(): void {
    for (const flag of this.roadNetwork.getAllFlags()) {
      if (!flag.buildingId || flag.goods.length === 0) continue;
      const building = this.gameState.getBuilding(flag.buildingId);
      if (!building) continue;

      const def = BUILDING_DEFINITIONS[building.type];
      const hasInputs = def.production != null && def.production.inputs.length > 0;

      // Phase 1: Deliver stranded goods respecting per-resource caps
      for (let i = flag.goods.length - 1; i >= 0; i--) {
        const good = flag.goods[i];
        if (good.destinationFlagId !== flag.id) continue;
        if (!hasInputSpace(building)) continue;

        if (hasInputs) {
          const inputSpec = def.production!.inputs.find(inp => inp.resource === good.resource);
          if (!inputSpec) continue; // Not a valid input — Phase 2 will discard
          const current = building.inputInventory[good.resource] ?? 0;
          if (current >= inputSpec.amount * 2) continue; // At per-resource cap
        }

        const current = building.inputInventory[good.resource] ?? 0;
        building.inputInventory[good.resource] = current + 1;
        flag.goods.splice(i, 1);
      }

      // Phase 2: Discard surplus stranded goods that will never be accepted
      for (let i = flag.goods.length - 1; i >= 0; i--) {
        const good = flag.goods[i];
        if (good.destinationFlagId !== flag.id) continue;

        if (hasInputs) {
          const inputSpec = def.production!.inputs.find(inp => inp.resource === good.resource);
          const current = building.inputInventory[good.resource] ?? 0;
          if (!inputSpec || current >= inputSpec.amount * 2) {
            flag.goods.splice(i, 1); // Surplus — discard
          }
        } else if (!hasInputSpace(building) && flag.goods.length > TransporterManager.MAX_FLAG_GOODS) {
          flag.goods.splice(i, 1); // Non-production, congested — discard
        }
      }
    }
  }

  private static MAX_FLAG_GOODS = 8;

  /**
   * Fix multi-input buildings where one resource hogs all capacity,
   * blocking delivery of other required inputs (permanent deadlock).
   * Evicts excess of the oversupplied resource to make room.
   */
  private rebalanceBlockedInputs(): void {
    for (const building of this.gameState.getAllBuildings()) {
      if (building.state !== 'active') continue;
      const def = BUILDING_DEFINITIONS[building.type];
      if (!def.production || def.production.inputs.length < 2) continue;
      if (!building.hasWorker) continue;

      // Check if input is full
      if (hasInputSpace(building)) continue;

      // Check if any required input is at 0 while another is over-supplied
      let hasZero = false;
      let maxExcess = 0;
      let excessResource: string | null = null;

      for (const inp of def.production.inputs) {
        const amount = building.inputInventory[inp.resource] ?? 0;
        if (amount === 0) {
          hasZero = true;
        } else if (amount > inp.amount * 2) {
          if (amount > maxExcess) {
            maxExcess = amount;
            excessResource = inp.resource;
          }
        }
      }

      if (!hasZero || !excessResource) continue;

      // Evict half of the excess resource to make room
      const inputSpec = def.production.inputs.find(i => i.resource === excessResource)!;
      const evictAmount = Math.max(1, maxExcess - inputSpec.amount);
      building.inputInventory[excessResource as keyof typeof building.inputInventory] = maxExcess - evictAmount;
      if (building.inputInventory[excessResource as keyof typeof building.inputInventory] === 0) {
        delete building.inputInventory[excessResource as keyof typeof building.inputInventory];
      }
    }
  }

  /**
   * Spawn transporters for road segments that don't have one.
   * Uses the flag's playerId so each player owns their own transporters.
   */
  private spawnTransporters(deltaTime: number): void {
    this.spawnCooldown -= deltaTime;
    if (this.spawnCooldown > 0) return;
    this.spawnCooldown = TransporterManager.SPAWN_INTERVAL;

    const roads = this.roadNetwork.getAllRoads();

    for (const road of roads) {
      if (road.transporterId) continue;

      const flagA = this.roadNetwork.getFlag(road.flagA);
      if (!flagA) continue;

      // Spawn transporter at flagA's position, owned by the flag's player
      const unit = this.gameState.spawnUnit(
        UnitType.Transporter,
        { ...flagA.coord },
        flagA.playerId,
      );

      road.transporterId = unit.id;

      const state: TransporterState = {
        roadId: road.id,
        targetFlagId: road.flagB,
        carrying: null,
        waitingAtFlagId: null,
      };
      this.transporterStates.set(unit.id, state);

      // Try to pick up goods and walk; if nothing to carry, idle at flagA
      this.tryPickUpOrIdle(unit, state, road.flagA, road.flagB);
    }
  }

  /**
   * Check if any transporters have arrived at their target flag.
   * UnitManager transitions arriving units to Working state before us,
   * so we detect arrival by checking for Working state.
   */
  private handleArrivals(): void {
    for (const [unitId, state] of this.transporterStates) {
      const unit = this.gameState.getUnit(unitId);
      if (!unit) {
        this.transporterStates.delete(unitId);
        continue;
      }

      // Skip idle transporters — they're handled by handleIdleTransporters
      if (state.waitingAtFlagId) continue;

      // UnitManager already transitioned to Working when the unit arrived
      if (unit.state !== UnitState.Working) continue;

      const road = this.roadNetwork.getRoad(state.roadId);
      if (!road) continue;

      const currentFlagId = state.targetFlagId;
      const otherFlagId = currentFlagId === road.flagA ? road.flagB : road.flagA;

      // Drop off carried good at the current flag
      if (state.carrying) {
        const flag = this.roadNetwork.getFlag(currentFlagId);
        if (flag) {
          if (state.carrying.destinationFlagId === currentFlagId && flag.buildingId) {
            // Reached final destination — deliver to building
            this.deliverToBuilding(flag, state.carrying);
          } else {
            // Intermediate flag — leave the good here for the next transporter
            flag.goods.push(state.carrying);
          }
        }
        state.carrying = null;
        unit.carryingResource = null;
      }

      // Try to pick up goods or idle
      state.targetFlagId = otherFlagId;
      this.tryPickUpOrIdle(unit, state, currentFlagId, otherFlagId);
    }
  }

  /**
   * Check idle transporters for goods that appeared at their flags.
   */
  private handleIdleTransporters(): void {
    for (const [unitId, state] of this.transporterStates) {
      if (!state.waitingAtFlagId) continue;

      const unit = this.gameState.getUnit(unitId);
      if (!unit) continue;

      const road = this.roadNetwork.getRoad(state.roadId);
      if (!road) continue;

      const currentFlagId = state.waitingAtFlagId;
      const otherFlagId = currentFlagId === road.flagA ? road.flagB : road.flagA;

      // Check current flag for goods going toward other flag
      const currentFlag = this.roadNetwork.getFlag(currentFlagId);
      if (currentFlag) {
        const goodIndex = this.findGoodForDirection(currentFlag, currentFlagId, otherFlagId);
        if (goodIndex >= 0) {
          // Pick up and walk to other flag
          state.waitingAtFlagId = null;
          state.targetFlagId = otherFlagId;
          state.carrying = currentFlag.goods.splice(goodIndex, 1)[0];
          unit.carryingResource = state.carrying.resource;
          this.walkTo(unit, otherFlagId, state);
          continue;
        }
      }

      // Check other flag for goods going toward current flag
      const otherFlag = this.roadNetwork.getFlag(otherFlagId);
      if (otherFlag) {
        const goodIndex = this.findGoodForDirection(otherFlag, otherFlagId, currentFlagId);
        if (goodIndex >= 0) {
          // Walk empty to other flag to pick up
          state.waitingAtFlagId = null;
          state.targetFlagId = otherFlagId;
          this.walkTo(unit, otherFlagId, state);
          continue;
        }
      }

      // Still idle — remain at flag
    }
  }

  /**
   * Try to pick up a good at currentFlag going toward otherFlag.
   * If found, pick up and walk. If not, check the other flag for goods
   * going back toward current. If found, walk empty. Otherwise idle.
   */
  private tryPickUpOrIdle(
    unit: Unit,
    state: TransporterState,
    currentFlagId: string,
    otherFlagId: string,
  ): void {
    const currentFlag = this.roadNetwork.getFlag(currentFlagId);
    if (!currentFlag) return;

    // Check current flag for goods going toward other flag
    const goodIndex = this.findGoodForDirection(currentFlag, currentFlagId, otherFlagId);
    if (goodIndex >= 0) {
      state.carrying = currentFlag.goods.splice(goodIndex, 1)[0];
      unit.carryingResource = state.carrying.resource;
      state.targetFlagId = otherFlagId;
      this.walkTo(unit, otherFlagId, state);
      return;
    }

    // Check other flag for goods going toward current flag
    const otherFlag = this.roadNetwork.getFlag(otherFlagId);
    if (otherFlag) {
      const reverseGoodIndex = this.findGoodForDirection(otherFlag, otherFlagId, currentFlagId);
      if (reverseGoodIndex >= 0) {
        // Walk empty to other flag to pick up
        state.targetFlagId = otherFlagId;
        this.walkTo(unit, otherFlagId, state);
        return;
      }
    }

    // No goods anywhere — idle at current flag
    state.waitingAtFlagId = currentFlagId;
    unit.state = UnitState.Working;
  }

  /**
   * Walk the unit to a target flag (without picking up goods).
   * For virtual roads (harbor routes), teleport directly to the destination.
   */
  private walkTo(unit: Unit, targetFlagId: string, state?: TransporterState): void {
    const targetFlag = this.roadNetwork.getFlag(targetFlagId);
    if (!targetFlag) return;

    // Virtual roads (harbor water routes): teleport to destination
    if (state) {
      const road = this.roadNetwork.getRoad(state.roadId);
      if (road?.virtual) {
        setUnitPath(unit, [targetFlag.coord]);
        unit.state = UnitState.WalkingToWork;
        return;
      }
    }

    const path = findPath(this.gameState.getGrid(), unit.coord, targetFlag.coord);
    if (path.length > 0) {
      setUnitPath(unit, path);
      unit.state = UnitState.WalkingToWork;
    }
  }

  /**
   * Find the index of a good at a flag that should be routed through targetFlagId.
   * Uses the road network's BFS to check if the good's destination
   * is reachable through the target flag direction.
   */
  private findGoodForDirection(
    flag: { goods: FlagGood[] },
    currentFlagId: string,
    targetFlagId: string,
  ): number {
    for (let i = 0; i < flag.goods.length; i++) {
      const good = flag.goods[i];

      // If the good's destination IS the target flag, definitely go that way
      if (good.destinationFlagId === targetFlagId) return i;

      // Check if the route to the destination goes through the target flag
      const route = this.roadNetwork.findRoute(currentFlagId, good.destinationFlagId);
      if (route.length >= 2 && route[1] === targetFlagId) return i;
    }
    return -1;
  }

  /**
   * Deliver a good to the building associated with a flag.
   * Returns false if the building's input inventory is full (backpressure).
   */
  private deliverToBuilding(flag: Flag, good: FlagGood): boolean {
    if (!flag.buildingId) return false;
    const building = this.gameState.getBuilding(flag.buildingId);
    if (!building) return false;

    if (!hasInputSpace(building)) {
      // Backpressure: leave the good on the flag
      flag.goods.push(good);
      return false;
    }

    const current = building.inputInventory[good.resource] ?? 0;
    building.inputInventory[good.resource] = current + 1;
    return true;
  }

  /**
   * Clean up transporters whose road has been removed.
   */
  private cleanupOrphans(): void {
    for (const [unitId, state] of this.transporterStates) {
      const road = this.roadNetwork.getRoad(state.roadId);
      if (!road) {
        // Road was removed — drop carried good at nearest flag
        if (state.carrying) {
          const flag = this.roadNetwork.getFlag(state.targetFlagId);
          if (flag) {
            flag.goods.push(state.carrying);
          }
        }

        const unit = this.gameState.getUnit(unitId);
        if (unit) {
          clearUnitPath(unit);
          unit.state = UnitState.Idle;
          unit.carryingResource = null;
        }
        this.transporterStates.delete(unitId);
      }
    }
  }
}
