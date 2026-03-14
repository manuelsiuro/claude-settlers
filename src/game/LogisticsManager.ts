import type { GameState } from './GameState';
import type { RoadNetwork } from './RoadNetwork';
import { BUILDING_DEFINITIONS, BuildingType } from './BuildingType';
import { BuildingState, hasInputSpace, getRemainingConstructionCost, getInventoryAmount } from './Building';
import { ResourceType } from './ResourceType';
import type { GoodsDistributionSettings } from './GoodsDistribution';
import { getRoutingScore, getResourceCategoryWeights } from './GoodsDistribution';

/**
 * Bridges building inventories and the flag/road network.
 *
 * Each tick:
 *   1. Ensures every placed building has a flag (auto-creates if missing)
 *   2. Moves goods from building outputInventory → building's flag
 *   3. Determines destination for each good (nearest building that needs it)
 *   4. TransporterManager then handles the actual transport
 */
export class LogisticsManager {
  private gameState: GameState;
  private roadNetwork: RoadNetwork;
  private distributionSettings: GoodsDistributionSettings | null = null;

  /** How often to run routing logic (seconds) */
  private routingCooldown = 0;
  private static ROUTING_INTERVAL = 0.5;

  /** Max goods waiting at one flag */
  private static MAX_FLAG_GOODS = 8;

  /** Per-tick production routing budget: buildingId → resource → { budget, routed } */
  private routingBudget: Map<string, Map<ResourceType, { budget: number; routed: number }>> = new Map();

  constructor(gameState: GameState, roadNetwork: RoadNetwork) {
    this.gameState = gameState;
    this.roadNetwork = roadNetwork;
  }

  /** Set distribution settings for priority-based routing */
  setDistributionSettings(settings: GoodsDistributionSettings): void {
    this.distributionSettings = settings;
  }

  /** Serialization: get internal state for save */
  _getState(): { routingCooldown: number } {
    return { routingCooldown: this.routingCooldown };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: { routingCooldown: number }): void {
    this.routingCooldown = state.routingCooldown;
  }

  update(deltaTime: number): void {
    this.routingCooldown -= deltaTime;
    if (this.routingCooldown > 0) return;
    this.routingCooldown = LogisticsManager.ROUTING_INTERVAL;

    this.ensureBuildingFlags();
    this.routeOutputGoods();
  }

  /**
   * Create a flag for any building that doesn't have one.
   * Links the flag to the building via buildingId.
   */
  private ensureBuildingFlags(): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      const existing = this.roadNetwork.getFlagAt(building.coord.q, building.coord.r);
      if (existing) {
        // Link or update if buildingId is missing or stale (building was removed)
        if (!existing.buildingId || !this.gameState.getBuilding(existing.buildingId)) {
          existing.buildingId = building.id;
        }
        continue;
      }

      // Create a new flag at the building's location
      const flag = this.roadNetwork.placeFlag(building.coord, building.playerId);
      if (flag) {
        flag.buildingId = building.id;
      }
    }
  }

  /**
   * Compute total construction demand for a resource across all Planned buildings.
   */
  private getConstructionDemand(resource: ResourceType): number {
    let demand = 0;
    for (const building of this.gameState.getAllBuildings()) {
      if (building.state !== BuildingState.Planned) continue;
      const remaining = getRemainingConstructionCost(building);
      for (const r of remaining) {
        if (r.resource === resource) demand += r.amount;
      }
    }
    return demand;
  }

  /**
   * Check if this building is a Castle or Warehouse (storage building).
   */
  private isStorageBuilding(type: BuildingType): boolean {
    return type === BuildingType.Castle || type === BuildingType.Warehouse;
  }

  /**
   * Compute the production routing budget for a building's resource.
   * Returns how many units of this resource can be routed to production buildings.
   *
   * For storage buildings (Castle/Warehouse): reserves stock for construction demand.
   * For all buildings: respects the production weight from category settings.
   */
  private computeProductionBudget(buildingType: BuildingType, resource: ResourceType, stock: number): number {
    if (!this.distributionSettings) return stock;

    const weights = getResourceCategoryWeights(this.distributionSettings, resource);

    // If production weight is 0, no goods go to production buildings
    if (weights.production === 0) return 0;

    // For storage buildings, also account for construction reservation
    if (this.isStorageBuilding(buildingType)) {
      const demand = this.getConstructionDemand(resource);
      if (demand > 0) {
        const reserved = Math.min(demand, Math.ceil(stock * weights.construction / 100));
        return Math.max(0, stock - reserved);
      }
    }

    // For all buildings: budget is the production share of available stock
    // production / (production + storage) gives the fraction that should go to production
    const prodPlusStorage = weights.production + weights.storage;
    if (prodPlusStorage === 0) return 0;
    return Math.max(0, Math.floor(stock * weights.production / prodPlusStorage));
  }

  /**
   * For each building with output inventory, move goods to the flag
   * and assign destinations.
   */
  private routeOutputGoods(): void {
    const buildings = this.gameState.getAllBuildings();

    // Compute routing budgets for ALL buildings with output
    this.routingBudget.clear();
    if (this.distributionSettings) {
      for (const building of buildings) {
        if (building.state !== BuildingState.Active) continue;

        const budgetMap = new Map<ResourceType, { budget: number; routed: number }>();
        for (const [resource, amount] of Object.entries(building.outputInventory)) {
          if (!amount || amount <= 0) continue;
          const resourceType = resource as ResourceType;
          const budget = this.computeProductionBudget(building.type, resourceType, amount);
          budgetMap.set(resourceType, { budget, routed: 0 });
        }
        if (budgetMap.size > 0) {
          this.routingBudget.set(building.id, budgetMap);
        }
      }
    }

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;

      // Find the flag at this building's location
      const flag = this.roadNetwork.getFlagAt(building.coord.q, building.coord.r);
      if (!flag) continue;

      // Check flag capacity
      if (flag.goods.length >= LogisticsManager.MAX_FLAG_GOODS) continue;

      const budgetMap = this.routingBudget.get(building.id);

      // Check outputInventory for goods to route
      for (const [resource, amount] of Object.entries(building.outputInventory)) {
        if (!amount || amount <= 0) continue;
        if (flag.goods.length >= LogisticsManager.MAX_FLAG_GOODS) break;

        const resourceType = resource as ResourceType;
        const budgetEntry = budgetMap?.get(resourceType);

        // Find a destination building that needs this resource
        const destFlagId = this.findDestination(flag.id, resourceType, budgetEntry);
        if (!destFlagId) continue;

        // Move one unit from outputInventory to flag
        building.outputInventory[resourceType] = amount - 1;
        if (building.outputInventory[resourceType] === 0) {
          delete building.outputInventory[resourceType];
        }

        flag.goods.push({
          resource: resourceType,
          destinationFlagId: destFlagId,
        });
      }
    }
  }

  /**
   * Find the best destination flag for a resource.
   * Respects production budget limits from category weights.
   * Priority:
   *   1. Buildings that need this resource as production input (budget permitting)
   *   2. Warehouses / Castle as general storage
   */
  private findDestination(
    sourceFlagId: string,
    resource: ResourceType,
    budgetEntry?: { budget: number; routed: number },
  ): string | null {
    const buildings = this.gameState.getAllBuildings();

    let bestFlagId: string | null = null;
    let bestScore = -Infinity;
    let bestIsProduction = false;

    // If budget exists and is fully exhausted, skip production entirely
    const productionBlocked = budgetEntry != null && budgetEntry.routed >= budgetEntry.budget;

    // Priority 1: buildings that consume this resource (if production not blocked)
    if (!productionBlocked) {
      for (const building of buildings) {
        if (building.state !== BuildingState.Active) continue;
        if (building.productionPaused) continue; // Don't route to paused buildings

        const def = BUILDING_DEFINITIONS[building.type];
        if (!def.production) continue;

        const inputSpec = def.production.inputs.find((inp) => inp.resource === resource);
        if (!inputSpec) continue;

        // Skip if input inventory is full
        if (!hasInputSpace(building)) continue;

        // Don't over-supply: cap at 2x the per-cycle amount
        const currentAmount = building.inputInventory[resource] ?? 0;
        if (currentAmount >= inputSpec.amount * 2) continue;

        const destFlag = this.roadNetwork.getFlagAt(building.coord.q, building.coord.r);
        if (!destFlag || destFlag.id === sourceFlagId) continue;

        const route = this.roadNetwork.findRoute(sourceFlagId, destFlag.id);
        if (route.length === 0) continue;

        // Use distribution settings if available, otherwise fall back to distance
        let score: number;
        if (this.distributionSettings) {
          score = getRoutingScore(this.distributionSettings, resource, building.id, route.length);
        } else {
          score = 1000 - route.length; // Simple distance-based (lower distance = higher score)
        }

        if (score > bestScore) {
          bestScore = score;
          bestFlagId = destFlag.id;
          bestIsProduction = true;
        }
      }
    }

    // If best destination is production, track budget usage and return
    if (bestFlagId && bestIsProduction) {
      if (budgetEntry) budgetEntry.routed++;
      return bestFlagId;
    }

    // Priority 1.5: route Swords/Shields to military buildings with empty knight slots
    if (resource === ResourceType.Swords || resource === ResourceType.Shields) {
      bestFlagId = null;
      bestScore = -Infinity;

      for (const building of buildings) {
        if (building.state !== BuildingState.Active) continue;

        const def = BUILDING_DEFINITIONS[building.type];
        if (def.knightSlots <= 0) continue;

        // Skip if all knight slots are filled
        if (building.knightIds.length >= def.knightSlots) continue;

        // Skip if already has enough of this weapon (1 per empty slot)
        const emptySlots = def.knightSlots - building.knightIds.length;
        const currentAmount = getInventoryAmount(building.inputInventory, resource);
        if (currentAmount >= emptySlots) continue;

        // Skip if input inventory is full
        if (!hasInputSpace(building)) continue;

        const destFlag = this.roadNetwork.getFlagAt(building.coord.q, building.coord.r);
        if (!destFlag || destFlag.id === sourceFlagId) continue;

        const route = this.roadNetwork.findRoute(sourceFlagId, destFlag.id);
        if (route.length === 0) continue;

        const score = 1000 - route.length;
        if (score > bestScore) {
          bestScore = score;
          bestFlagId = destFlag.id;
        }
      }

      if (bestFlagId) return bestFlagId;
    }

    // Priority 2: Castle or Warehouse storage
    bestFlagId = null;
    bestScore = -Infinity;

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;
      if (building.type !== BuildingType.Castle && building.type !== BuildingType.Warehouse) continue;

      // Skip if storage is full (input + output both checked)
      if (!hasInputSpace(building)) continue;

      const destFlag = this.roadNetwork.getFlagAt(building.coord.q, building.coord.r);
      if (!destFlag || destFlag.id === sourceFlagId) continue;

      const route = this.roadNetwork.findRoute(sourceFlagId, destFlag.id);
      if (route.length === 0) continue;

      const score = this.distributionSettings
        ? getRoutingScore(this.distributionSettings, resource, building.id, route.length)
        : 1000 - route.length;

      if (score > bestScore) {
        bestScore = score;
        bestFlagId = destFlag.id;
      }
    }

    return bestFlagId;
  }
}
