import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import type { BuildingDefinition } from './BuildingType';
import type { ResourceType } from './ResourceType';
import type { HexCoord } from './HexGrid';

export const BuildingState = {
  /** Waiting for construction resources to be delivered */
  Planned: 'planned',
  /** Under construction by a builder */
  UnderConstruction: 'under_construction',
  /** Fully built and operational */
  Active: 'active',
  /** Destroyed */
  Destroyed: 'destroyed',
} as const;

export type BuildingState = (typeof BuildingState)[keyof typeof BuildingState];

/** Inventory: how much of each resource is stored in this building */
export type ResourceInventory = Partial<Record<ResourceType, number>>;

export interface Building {
  /** Unique identifier */
  id: string;
  /** Building type */
  type: BuildingType;
  /** Position on the hex grid */
  coord: HexCoord;
  /** Current state */
  state: BuildingState;
  /** Construction progress 0..1 (1 = complete) */
  constructionProgress: number;
  /** Resources already delivered for construction */
  constructionDelivered: ResourceInventory;
  /** Input inventory (resources waiting to be processed) */
  inputInventory: ResourceInventory;
  /** Output inventory (produced resources waiting for pickup) */
  outputInventory: ResourceInventory;
  /** Whether a worker is assigned */
  hasWorker: boolean;
  /** Production progress 0..1 for current cycle */
  productionProgress: number;
  /** Player ID who owns this building */
  playerId: number;
}

let nextBuildingId = 1;

/** Create a new building instance at the given hex coordinate */
export function createBuilding(
  type: BuildingType,
  coord: HexCoord,
  playerId: number,
): Building {
  const id = `building_${nextBuildingId++}`;

  return {
    id,
    type,
    coord,
    state: type === BuildingType.Castle ? BuildingState.Active : BuildingState.Planned,
    constructionProgress: type === BuildingType.Castle ? 1 : 0,
    constructionDelivered: {},
    inputInventory: {},
    outputInventory: {},
    hasWorker: false,
    productionProgress: 0,
    playerId,
  };
}

/** Get the building definition for a building instance */
export function getBuildingDefinition(building: Building): BuildingDefinition {
  return BUILDING_DEFINITIONS[building.type];
}

/** Check if a building has all required construction resources delivered */
export function hasAllConstructionResources(building: Building): boolean {
  const def = BUILDING_DEFINITIONS[building.type];
  for (const cost of def.cost) {
    const delivered = building.constructionDelivered[cost.resource] ?? 0;
    if (delivered < cost.amount) return false;
  }
  return true;
}

/** Get remaining construction resources needed */
export function getRemainingConstructionCost(
  building: Building,
): { resource: ResourceType; amount: number }[] {
  const def = BUILDING_DEFINITIONS[building.type];
  const remaining: { resource: ResourceType; amount: number }[] = [];
  for (const cost of def.cost) {
    const delivered = building.constructionDelivered[cost.resource] ?? 0;
    const needed = cost.amount - delivered;
    if (needed > 0) {
      remaining.push({ resource: cost.resource, amount: needed });
    }
  }
  return remaining;
}

/** Get total items in an inventory */
export function getInventoryTotal(inventory: ResourceInventory): number {
  let total = 0;
  for (const amount of Object.values(inventory)) {
    total += amount ?? 0;
  }
  return total;
}

/** Check if output inventory has room for more items */
export function hasOutputSpace(building: Building): boolean {
  const def = BUILDING_DEFINITIONS[building.type];
  return getInventoryTotal(building.outputInventory) < def.storageCapacity;
}

/** Check if building has all required inputs for one production cycle */
export function hasRequiredInputs(building: Building): boolean {
  const def = BUILDING_DEFINITIONS[building.type];
  if (!def.production) return false;
  for (const input of def.production.inputs) {
    const available = building.inputInventory[input.resource] ?? 0;
    if (available < input.amount) return false;
  }
  return true;
}

/** Reset the building ID counter (for testing) */
export function resetBuildingIdCounter(): void {
  nextBuildingId = 1;
}
