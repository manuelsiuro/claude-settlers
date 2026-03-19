import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import type { BuildingDefinition } from './BuildingType';
import { ResourceType } from './ResourceType';
import type { HexCoord } from './HexGrid';
import { getEffectiveStorageCapacity } from './BuildingUpgrade';

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
  /** Knight unit IDs stationed in this military building */
  knightIds: string[];
  /** Distance to nearest harvest terrain (for gathering buildings) */
  resourceDistance: number;
  /** Current upgrade levels per axis (e.g., { storage: 1, production: 0 }) */
  upgradeLevels: Record<string, number>;
  /** Active upgrade in progress, or null */
  activeUpgrade: {
    axis: string;
    targetLevel: number;
    resourcesDelivered: ResourceInventory;
    constructionProgress: number;
  } | null;
  /** Extra worker unit IDs from worker upgrades */
  extraWorkerIds: string[];
  /** Whether production is paused (building remains active but doesn't produce) */
  productionPaused: boolean;
  /** Which tool this building is waiting for (null if not waiting) */
  waitingForTool: ResourceType | null;
  /** Game-time timestamp when the building started waiting for a tool (for FIFO ordering) */
  waitingForToolSince: number | null;
  /** Tool production queue (Toolmaker buildings only) */
  toolQueue: { toolType: ResourceType; count: number }[] | undefined;
  /** Currently producing tool type (Toolmaker buildings only) */
  currentToolProduction: ResourceType | null;
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
    knightIds: [],
    resourceDistance: 0,
    upgradeLevels: {},
    activeUpgrade: null,
    extraWorkerIds: [],
    productionPaused: false,
    waitingForTool: null,
    waitingForToolSince: null,
    toolQueue: undefined,
    currentToolProduction: null,
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

/** Check if input inventory has room for more items */
export function hasInputSpace(building: Building): boolean {
  const cap = getEffectiveStorageCapacity(building);
  // Storage buildings (Castle/Warehouse) share capacity across both inventories
  if (building.type === BuildingType.Castle || building.type === BuildingType.Warehouse) {
    return getInventoryTotal(building.inputInventory) + getInventoryTotal(building.outputInventory) < cap;
  }
  return getInventoryTotal(building.inputInventory) < cap;
}

/** Check if output inventory has room for more items */
export function hasOutputSpace(building: Building): boolean {
  const cap = getEffectiveStorageCapacity(building);
  return getInventoryTotal(building.outputInventory) < cap;
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

/** Add resources to a building's input inventory */
export function addToInventory(
  inventory: ResourceInventory,
  resource: ResourceType,
  amount: number,
): void {
  inventory[resource] = (inventory[resource] ?? 0) + amount;
}

/** Remove resources from a building's inventory. Returns actual amount removed. */
export function removeFromInventory(
  inventory: ResourceInventory,
  resource: ResourceType,
  amount: number,
): number {
  const current = inventory[resource] ?? 0;
  const removed = Math.min(current, amount);
  const remaining = current - removed;
  if (remaining <= 0) {
    delete inventory[resource];
  } else {
    inventory[resource] = remaining;
  }
  return removed;
}

/** Get the amount of a resource in an inventory */
export function getInventoryAmount(
  inventory: ResourceInventory,
  resource: ResourceType,
): number {
  return inventory[resource] ?? 0;
}

/**
 * Starting resources for the Castle.
 * Provides enough to build basic Tier 1 buildings and get the economy started.
 */
export const CASTLE_STARTING_RESOURCES: { resource: ResourceType; amount: number }[] = [
  { resource: ResourceType.Wood, amount: 12 },
  { resource: ResourceType.Stone, amount: 8 },
  { resource: ResourceType.Planks, amount: 6 },
  { resource: ResourceType.Fish, amount: 4 },
  { resource: ResourceType.Bread, amount: 4 },
  { resource: ResourceType.IronBars, amount: 8 },
  // Individual tools for bootstrapping
  { resource: ResourceType.Axe, amount: 2 },
  { resource: ResourceType.Pickaxe, amount: 2 },
  { resource: ResourceType.Saw, amount: 1 },
  { resource: ResourceType.Scythe, amount: 1 },
  { resource: ResourceType.FishingRod, amount: 1 },
  { resource: ResourceType.Hammer, amount: 2 },
  { resource: ResourceType.Shovel, amount: 1 },
  { resource: ResourceType.Crucible, amount: 1 },
];

/** Initialize a Castle building with starting resources */
export function initializeCastleResources(castle: Building): void {
  for (const { resource, amount } of CASTLE_STARTING_RESOURCES) {
    addToInventory(castle.outputInventory, resource, amount);
  }
}

/** Transfer resources from inputInventory to outputInventory for storage buildings (Castle/Warehouse), respecting output capacity */
export function transferStorageInputs(building: Building): void {
  const cap = getEffectiveStorageCapacity(building);
  let remaining = cap - getInventoryTotal(building.outputInventory);
  for (const [res, amount] of Object.entries(building.inputInventory)) {
    if (!amount || amount <= 0 || remaining <= 0) continue;
    const r = res as ResourceType;
    const transfer = Math.min(amount, remaining);
    building.outputInventory[r] = (building.outputInventory[r] ?? 0) + transfer;
    building.inputInventory[r] = amount - transfer;
    if (building.inputInventory[r]! <= 0) delete building.inputInventory[r];
    remaining -= transfer;
  }
}

/** Reset the building ID counter (for testing) */
export function resetBuildingIdCounter(): void {
  nextBuildingId = 1;
}

/** Get the current ID counter value (for serialization) */
export function getBuildingIdCounter(): number {
  return nextBuildingId;
}

/** Set the ID counter value (for deserialization) */
export function setBuildingIdCounter(value: number): void {
  nextBuildingId = value;
}
