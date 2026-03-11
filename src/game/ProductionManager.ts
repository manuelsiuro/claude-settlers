import type { Building } from './Building';
import { BuildingState, hasRequiredInputs, hasOutputSpace } from './Building';
import { BUILDING_DEFINITIONS } from './BuildingType';
import type { GameState } from './GameState';
import type { ResourceType } from './ResourceType';
import { UnitState } from './Unit';

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

      // Check worker is present and working
      if (!this.hasActiveWorker(building)) continue;

      // Gathering buildings (no inputs) always produce
      // Processing buildings need all inputs available
      if (def.production.inputs.length > 0 && !hasRequiredInputs(building)) {
        continue;
      }

      // Need output space
      if (!hasOutputSpace(building)) continue;

      // Advance production
      const rate = 1 / def.production.productionTime;
      building.productionProgress += rate * deltaTime;

      // Production cycle complete
      if (building.productionProgress >= 1.0) {
        this.completeProduction(building);
        building.productionProgress = 0;
      }
    }
  }

  /**
   * Check if the building has an assigned worker in the Working state.
   */
  private hasActiveWorker(building: Building): boolean {
    const worker = this.gameState.getWorkerForBuilding(building.id);
    if (!worker) return false;
    return worker.state === UnitState.Working;
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
  }
}
