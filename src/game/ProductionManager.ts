import type { Building } from './Building';
import { BuildingState, hasRequiredInputs, hasOutputSpace } from './Building';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import type { GameState } from './GameState';
import type { ResourceType } from './ResourceType';
import { UnitState } from './Unit';
import { getProductionSpeedMultiplier } from './BuildingUpgrade';

/** Compute the distance multiplier for gathering buildings */
export function getDistanceMultiplier(distance: number): number {
  return Math.min(3.0, 1.0 + Math.max(0, distance - 1) * 0.25);
}

/** Get a human-readable rating + color for a distance multiplier */
export function getDistanceRating(multiplier: number): { label: string; color: string } {
  if (multiplier <= 1.0) return { label: 'Perfect', color: '#22c55e' };
  if (multiplier <= 1.5) return { label: 'Good', color: '#22c55e' };
  if (multiplier <= 2.0) return { label: 'Medium', color: '#f59e0b' };
  return { label: 'Poor', color: '#ef4444' };
}

/**
 * Manages production cycles for all active buildings.
 * Each frame, advances productionProgress for buildings that have:
 *   - An assigned worker in Working state
 *   - All required input resources
 *   - Output storage space available
 *
 * When productionProgress reaches 1.0:
 *   - Consumes input resources from inputInventory
 *   - Adds output resources to outputInventory
 *   - Resets productionProgress to 0
 */
export class ProductionManager {
  private gameState: GameState;

  /** Optional callback fired when production completes (for economy tracking) */
  onProductionComplete: ((inputs: { resource: ResourceType; amount: number }[], outputs: { resource: ResourceType; amount: number }[]) => void) | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Update all building production. Call each frame with delta time in seconds.
   */
  update(deltaTime: number): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;

      const def = BUILDING_DEFINITIONS[building.type];
      if (!def.production) continue;

      // WoodcutterHut production is handled by WoodcutterManager
      if (building.type === BuildingType.WoodcutterHut) continue;

      // Count active workers (primary + extras from worker upgrades)
      const activeWorkers = this.countActiveWorkers(building);
      if (activeWorkers === 0) continue;

      // Gathering buildings (no inputs) always produce
      // Processing buildings need all inputs available
      if (def.production.inputs.length > 0 && !hasRequiredInputs(building)) {
        continue;
      }

      // Need output space
      if (!hasOutputSpace(building)) continue;

      // Advance production (gathering buildings scale by distance, upgrades scale speed)
      const distMultiplier = def.harvestTerrain ? getDistanceMultiplier(building.resourceDistance) : 1;
      const speedMultiplier = getProductionSpeedMultiplier(building);
      const rate = activeWorkers / (def.production.productionTime * distMultiplier * speedMultiplier);
      building.productionProgress += rate * deltaTime;

      // Production cycle complete
      if (building.productionProgress >= 1.0) {
        this.completeProduction(building);
        building.productionProgress = 0;
      }
    }
  }

  /**
   * Count the number of active workers at this building (primary + extras).
   */
  private countActiveWorkers(building: Building): number {
    let count = 0;
    const primary = this.gameState.getWorkerForBuilding(building.id);
    if (primary?.state === UnitState.Working) count++;
    for (const id of (building.extraWorkerIds ?? [])) {
      const unit = this.gameState.getUnit(id);
      if (unit?.state === UnitState.Working) count++;
    }
    return count;
  }

  /**
   * Complete one production cycle: consume inputs, produce outputs.
   */
  private completeProduction(building: Building): void {
    const def = BUILDING_DEFINITIONS[building.type];
    if (!def.production) return;

    // Consume inputs
    for (const input of def.production.inputs) {
      const current = building.inputInventory[input.resource] ?? 0;
      building.inputInventory[input.resource as ResourceType] = Math.max(0, current - input.amount);
    }

    // Produce outputs
    for (const output of def.production.outputs) {
      const current = building.outputInventory[output.resource] ?? 0;
      building.outputInventory[output.resource as ResourceType] = current + output.amount;
    }

    // Notify economy tracker
    this.onProductionComplete?.(def.production.inputs, def.production.outputs);
  }
}
