import type { Building } from './Building';
import { BuildingState, hasRequiredInputs, hasOutputSpace } from './Building';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import type { GameState } from './GameState';
import { type ResourceType, RESOURCE_PROPERTIES } from './ResourceType';
import { UnitState } from './Unit';
import { getProductionSpeedMultiplier } from './BuildingUpgrade';
import { NIGHT_PRODUCTION_SLOWDOWN } from './data/balanceConstants';

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

  /** Current nightness level 0.0–1.0 (set by Game each frame) */
  nightness = 0;

  /** Light mitigation factor 0.0–1.0 per building ID (from TorchTower proximity) */
  lightMitigation: Map<string, number> = new Map();

  /** Optional callback fired when production completes (for economy tracking) */
  onProductionComplete: ((inputs: { resource: ResourceType; amount: number }[], outputs: { resource: ResourceType; amount: number }[], building: Building) => void) | null = null;

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
      if (building.productionPaused) continue;

      const def = BUILDING_DEFINITIONS[building.type];
      if (!def.production) continue;
      // Skip dynamic-output buildings (e.g., Toolmaker) — handled by their own manager
      // But keep buildings that use inputCategories (e.g., InnTavern consumes drinks)
      if (def.production.outputs.length === 0 && !def.production.inputCategories?.length) continue;

      // WoodcutterHut production is handled by WoodcutterManager
      if (building.type === BuildingType.WoodcutterHut) continue;

      // Skip terrain-walking buildings — handled by TerrainGatheringManager
      if (def.gatheringStyle === 'walk') continue;

      // Count active workers (primary + extras from worker upgrades)
      const activeWorkers = this.countActiveWorkers(building);
      if (activeWorkers === 0) continue;

      // Gathering buildings (no inputs) always produce
      // Processing buildings need all inputs available
      if (def.production.inputs.length > 0 && !hasRequiredInputs(building)) {
        continue;
      }

      // Category-based input check: need at least one resource matching each required category
      if (def.production.inputCategories?.length) {
        const missingRequired = def.production.inputCategories.some(({ category: cat, required }) => {
          if (!required) return false;
          return !Object.entries(building.inputInventory).some(([res, qty]) => {
            if (!qty || qty <= 0) return false;
            const props = RESOURCE_PROPERTIES[res as ResourceType];
            if (cat === 'drink') return props.isDrink;
            if (cat === 'luxury') return props.isLuxury;
            return false;
          });
        });
        if (missingRequired) continue;
      }

      // Need output space
      if (!hasOutputSpace(building)) continue;

      // Advance production (gathering buildings scale by distance, upgrades scale speed)
      const distMultiplier = def.harvestTerrain ? getDistanceMultiplier(building.resourceDistance) : 1;
      const speedMultiplier = getProductionSpeedMultiplier(building);

      // Night penalty: production slows by up to NIGHT_PRODUCTION_SLOWDOWN at full night
      // TorchTower light mitigation reduces this penalty
      const mitigation = this.lightMitigation.get(building.id) ?? 0;
      const effectiveNightness = this.nightness * (1 - mitigation);
      const nightSlowdown = 1 / (1 - effectiveNightness * NIGHT_PRODUCTION_SLOWDOWN);

      const rate = activeWorkers / (def.production.productionTime * distMultiplier * speedMultiplier * nightSlowdown);
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

    // Track actual consumed inputs for reporting (spread to avoid mutating definition)
    const consumedInputs: { resource: ResourceType; amount: number }[] = [...def.production.inputs];

    // Consume explicit inputs
    for (const input of def.production.inputs) {
      const current = building.inputInventory[input.resource] ?? 0;
      building.inputInventory[input.resource as ResourceType] = Math.max(0, current - input.amount);
    }

    // Consume category-based inputs: find first matching resource per category and consume 1 unit
    if (def.production.inputCategories?.length) {
      for (const { category: cat } of def.production.inputCategories) {
        for (const [res, qty] of Object.entries(building.inputInventory)) {
          if (!qty || qty <= 0) continue;
          const props = RESOURCE_PROPERTIES[res as ResourceType];
          const matches = (cat === 'drink' && props.isDrink) || (cat === 'luxury' && props.isLuxury);
          if (matches) {
            building.inputInventory[res as ResourceType] = qty - 1;
            consumedInputs.push({ resource: res as ResourceType, amount: 1 });
            break;
          }
        }
      }
    }

    // Produce outputs
    for (const output of def.production.outputs) {
      const current = building.outputInventory[output.resource] ?? 0;
      building.outputInventory[output.resource as ResourceType] = current + output.amount;
    }

    // Notify economy tracker and other listeners
    this.onProductionComplete?.(consumedInputs, def.production.outputs, building);
  }
}
