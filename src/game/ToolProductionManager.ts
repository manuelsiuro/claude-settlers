import type { Building } from './Building';
import { BuildingState, hasRequiredInputs, hasOutputSpace } from './Building';
import { BUILDING_DEFINITIONS } from './BuildingType';
import type { GameState } from './GameState';
import type { ResourceType } from './ResourceType';
import { TOOL_TYPES } from './ResourceType';
import { UnitState } from './Unit';

/**
 * Manages tool production for buildings with a toolQueue (e.g., Toolmaker's Workshop).
 * Instead of using ProductionManager's fixed-output cycle, this manager produces
 * tools based on a player-configurable queue (count per tool type).
 *
 * Recipe and timing are read from the building's own BUILDING_DEFINITIONS entry,
 * keeping the system data-driven. Adding a new tool type only requires updating
 * ResourceType.ts and TOOL_TYPES — this manager auto-discovers it.
 */
export class ToolProductionManager {
  private gameState: GameState;

  /** Optional callback fired when production completes (for economy tracking) */
  onProductionComplete: ((inputs: { resource: ResourceType; amount: number }[], outputs: { resource: ResourceType; amount: number }[]) => void) | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Initialize the default tool queue for a building that just became active.
   * Called when a building with dynamic outputs (inputs but no outputs) activates.
   */
  initializeQueue(building: Building): void {
    const def = BUILDING_DEFINITIONS[building.type];
    if (!def.production || def.production.outputs.length > 0) return;
    if (def.production.inputs.length === 0) return;
    if (building.toolQueue !== undefined) return; // Already initialized

    building.toolQueue = TOOL_TYPES.map(t => ({ toolType: t, count: 1 }));
    building.currentToolProduction = null;
  }

  /**
   * Update all tool-producing buildings. Call each frame with delta time in seconds.
   */
  update(deltaTime: number): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;
      if (building.toolQueue === undefined) continue;
      if (building.productionPaused) continue;

      // Check for active worker
      const worker = this.gameState.getWorkerForBuilding(building.id);
      if (!worker || worker.state !== UnitState.Working) continue;

      const def = BUILDING_DEFINITIONS[building.type];
      if (!def.production) continue;

      // If no current production, pick next from queue
      if (!building.currentToolProduction) {
        const next = building.toolQueue.find(entry => entry.count > 0);
        if (!next) continue; // Queue empty — idle
        building.currentToolProduction = next.toolType;
        building.productionProgress = 0;
      }

      // Check if inputs are available
      if (!hasRequiredInputs(building)) continue;
      if (!hasOutputSpace(building)) continue;

      // Advance production
      const rate = 1 / def.production.productionTime;
      building.productionProgress += rate * deltaTime;

      if (building.productionProgress >= 1.0) {
        this.completeProduction(building);
      }
    }
  }

  private completeProduction(building: Building): void {
    const def = BUILDING_DEFINITIONS[building.type];
    if (!def.production || !building.currentToolProduction) return;

    // Consume inputs
    for (const input of def.production.inputs) {
      const current = building.inputInventory[input.resource] ?? 0;
      building.inputInventory[input.resource as ResourceType] = Math.max(0, current - input.amount);
    }

    // Produce the queued tool
    const toolType = building.currentToolProduction;
    const current = building.outputInventory[toolType] ?? 0;
    building.outputInventory[toolType] = current + 1;

    // Decrement queue count
    const entry = building.toolQueue?.find(e => e.toolType === toolType);
    if (entry && entry.count > 0) {
      entry.count--;
    }

    // Notify economy tracker
    this.onProductionComplete?.(
      def.production.inputs,
      [{ resource: toolType, amount: 1 }],
    );

    // Reset for next production
    building.productionProgress = 0;
    building.currentToolProduction = null;
  }

  /** Adjust the queue count for a tool type at a building */
  adjustQueue(buildingId: string, toolType: ResourceType, delta: number): void {
    const building = this.gameState.getBuilding(buildingId);
    if (!building || !building.toolQueue) return;

    const entry = building.toolQueue.find(e => e.toolType === toolType);
    if (entry) {
      entry.count = Math.max(0, entry.count + delta);
    }
  }

  /** Get the queue for a building */
  getQueue(buildingId: string): { toolType: ResourceType; count: number }[] {
    const building = this.gameState.getBuilding(buildingId);
    return building?.toolQueue ?? [];
  }

  /** Serialization: nothing extra to serialize — queue state lives on Building objects */
  _getState(): Record<string, never> {
    return {};
  }

  /** Serialization: restore (no-op — queue state is on buildings) */
  _loadState(): void {
    // Queue state is stored on Building objects directly
  }
}
