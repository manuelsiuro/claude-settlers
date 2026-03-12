import type { GameState } from './GameState';
import type { RoadNetwork, FlagGood } from './RoadNetwork';
import type { Unit } from './Unit';
import { UnitState, setUnitPath, clearUnitPath } from './Unit';
import { UnitType } from './UnitType';
import { findPath } from './Pathfinding';

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
}

/**
 * Manages transporter units on the road network.
 *
 * Each road segment gets one transporter that walks back and forth
 * between its two flags. At each flag, the transporter:
 *   1. Drops off any carried good
 *   2. Picks up a good that needs to go toward the other flag
 *   3. Walks to the other flag
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
    transporterStates: [string, TransporterState][];
    spawnCooldown: number;
  }): void {
    this.transporterStates = new Map(state.transporterStates);
    this.spawnCooldown = state.spawnCooldown;
  }

  update(deltaTime: number): void {
    this.spawnTransporters(deltaTime);
    this.handleArrivals();
    this.cleanupOrphans();
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
      };
      this.transporterStates.set(unit.id, state);

      // Pick up goods at the starting flag and walk to other flag
      this.pickUpAndMove(unit, state, road.flagA);
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
            // Intermediate flag, or destination has no building — leave here
            // Intermediate flag — leave the good here for the next transporter
            flag.goods.push(state.carrying);
          }
        }
        state.carrying = null;
      }

      // Pick up a good going toward the other flag and walk there
      state.targetFlagId = otherFlagId;
      this.pickUpAndMove(unit, state, currentFlagId);
    }
  }

  /**
   * Try to pick up a good at the current flag that needs to go
   * toward the target flag, then walk to target.
   */
  private pickUpAndMove(unit: Unit, state: TransporterState, currentFlagId: string): void {
    const flag = this.roadNetwork.getFlag(currentFlagId);
    if (!flag) return;

    // Find a good that should go toward the target flag
    const targetFlagId = state.targetFlagId;
    const goodIndex = this.findGoodForDirection(flag, currentFlagId, targetFlagId);

    if (goodIndex >= 0) {
      state.carrying = flag.goods.splice(goodIndex, 1)[0];
      unit.carryingResource = state.carrying.resource;
    } else {
      unit.carryingResource = null;
    }

    // Walk to target flag
    const targetFlag = this.roadNetwork.getFlag(targetFlagId);
    if (!targetFlag) {
      // Target flag gone — put good back
      if (state.carrying) {
        flag.goods.push(state.carrying);
        state.carrying = null;
        unit.carryingResource = null;
      }
      return;
    }

    const path = findPath(this.gameState.getGrid(), unit.coord, targetFlag.coord);
    if (path.length > 0) {
      setUnitPath(unit, path);
      unit.state = UnitState.WalkingToWork;
    } else {
      // Can't reach target — put good back at flag
      if (state.carrying) {
        flag.goods.push(state.carrying);
        state.carrying = null;
        unit.carryingResource = null;
      }
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
   */
  private deliverToBuilding(flag: { buildingId: string | null }, good: FlagGood): void {
    if (!flag.buildingId) return;
    const building = this.gameState.getBuilding(flag.buildingId);
    if (!building) return;

    const current = building.inputInventory[good.resource] ?? 0;
    building.inputInventory[good.resource] = current + 1;
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
