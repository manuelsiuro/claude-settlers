import type { GameState } from './GameState';
import { BuildingState } from './Building';
import { BUILDING_DEFINITIONS } from './BuildingType';

/**
 * Stateless query object for population capacity management.
 * No update loop, no save state — all values computed from current GameState.
 */
export class PopulationManager {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /** Total population capacity across all active buildings for a player */
  getCapacity(playerId: number): number {
    let capacity = 0;
    for (const building of this.gameState.getBuildingsByPlayer(playerId)) {
      if (building.state !== BuildingState.Active) continue;
      const def = BUILDING_DEFINITIONS[building.type];
      capacity += def.populationCapacity;
    }
    return capacity;
  }

  /** Current population count (all units) for a player */
  getCurrentPopulation(playerId: number): number {
    return this.gameState.getUnitsByPlayer(playerId).length;
  }

  /** Whether the player can spawn a new unit */
  canSpawn(playerId: number): boolean {
    return this.getCurrentPopulation(playerId) < this.getCapacity(playerId);
  }

  /** Number of available population slots */
  getAvailableSlots(playerId: number): number {
    return Math.max(0, this.getCapacity(playerId) - this.getCurrentPopulation(playerId));
  }

  /** Population usage ratio (0..1+). Returns 1.0 if capacity is 0. */
  getUsageRatio(playerId: number): number {
    const capacity = this.getCapacity(playerId);
    if (capacity === 0) return 1.0;
    return this.getCurrentPopulation(playerId) / capacity;
  }
}
