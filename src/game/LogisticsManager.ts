import type { GameState } from './GameState';
import type { RoadNetwork } from './RoadNetwork';
import { BUILDING_DEFINITIONS, BuildingType } from './BuildingType';
import { BuildingState } from './Building';
import type { ResourceType } from './ResourceType';

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

  /** How often to run routing logic (seconds) */
  private routingCooldown = 0;
  private static ROUTING_INTERVAL = 0.5;

  /** Max goods waiting at one flag */
  private static MAX_FLAG_GOODS = 8;

  constructor(gameState: GameState, roadNetwork: RoadNetwork) {
    this.gameState = gameState;
    this.roadNetwork = roadNetwork;
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
   * For each building with output inventory, move goods to the flag
   * and assign destinations.
   */
  private routeOutputGoods(): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;

      // Find the flag at this building's location
      const flag = this.roadNetwork.getFlagAt(building.coord.q, building.coord.r);
      if (!flag) continue;

      // Check flag capacity
      if (flag.goods.length >= LogisticsManager.MAX_FLAG_GOODS) continue;

      // Check outputInventory for goods to route
      for (const [resource, amount] of Object.entries(building.outputInventory)) {
        if (!amount || amount <= 0) continue;
        if (flag.goods.length >= LogisticsManager.MAX_FLAG_GOODS) break;

        const resourceType = resource as ResourceType;

        // Find a destination building that needs this resource
        const destFlagId = this.findDestination(flag.id, resourceType);
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
   * Priority:
   *   1. Buildings that need this resource as production input (nearest first)
   *   2. Warehouses / Castle as general storage
   */
  private findDestination(sourceFlagId: string, resource: ResourceType): string | null {
    const buildings = this.gameState.getAllBuildings();

    let bestFlagId: string | null = null;
    let bestDistance = Infinity;

    // Priority 1: buildings that consume this resource
    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;

      const def = BUILDING_DEFINITIONS[building.type];
      if (!def.production) continue;

      const inputSpec = def.production.inputs.find((inp) => inp.resource === resource);
      if (!inputSpec) continue;

      // Don't over-supply: cap at 2x the per-cycle amount
      const currentAmount = building.inputInventory[resource] ?? 0;
      if (currentAmount >= inputSpec.amount * 2) continue;

      const destFlag = this.roadNetwork.getFlagAt(building.coord.q, building.coord.r);
      if (!destFlag || destFlag.id === sourceFlagId) continue;

      const route = this.roadNetwork.findRoute(sourceFlagId, destFlag.id);
      if (route.length === 0) continue;

      if (route.length < bestDistance) {
        bestDistance = route.length;
        bestFlagId = destFlag.id;
      }
    }

    if (bestFlagId) return bestFlagId;

    // Priority 2: Castle or Warehouse storage
    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;
      if (building.type !== BuildingType.Castle && building.type !== BuildingType.Warehouse) continue;

      const destFlag = this.roadNetwork.getFlagAt(building.coord.q, building.coord.r);
      if (!destFlag || destFlag.id === sourceFlagId) continue;

      const route = this.roadNetwork.findRoute(sourceFlagId, destFlag.id);
      if (route.length === 0) continue;

      if (route.length < bestDistance) {
        bestDistance = route.length;
        bestFlagId = destFlag.id;
      }
    }

    return bestFlagId;
  }
}
