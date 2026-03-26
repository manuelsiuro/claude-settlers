import { ResourceType } from '../../ResourceType';
import { TerrainType } from '../../TerrainType';
import type { BuildingType, BuildingDefinition } from '../../BuildingType';
import {
  SMALL_HOUSE_CAPACITY,
  MEDIUM_HOUSE_CAPACITY,
  LARGE_HOUSE_CAPACITY,
} from '../balanceConstants';

/** Housing buildings — increase population capacity */
export const HOUSING_BUILDINGS: Partial<Record<BuildingType, BuildingDefinition>> = {
  ['small_house']: {
    type: 'small_house',
    label: 'Small House',
    description: 'Simple cottage that increases population capacity',
    category: 'housing',
    tier: 1,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: '',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 0,
    constructionTime: 20,
    workRadius: 0,
    populationCapacity: SMALL_HOUSE_CAPACITY,
  },

  ['medium_house']: {
    type: 'medium_house',
    label: 'Medium House',
    description: 'Two-story dwelling with more population capacity',
    category: 'housing',
    tier: 2,
    cost: [
      { resource: ResourceType.Wood, amount: 4 },
      { resource: ResourceType.Planks, amount: 3 },
      { resource: ResourceType.Stone, amount: 2 },
    ],
    worker: '',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 0,
    constructionTime: 35,
    workRadius: 0,
    populationCapacity: MEDIUM_HOUSE_CAPACITY,
  },

  ['large_house']: {
    type: 'large_house',
    label: 'Large House',
    description: 'Manor house with large population capacity',
    category: 'housing',
    tier: 3,
    cost: [
      { resource: ResourceType.Wood, amount: 5 },
      { resource: ResourceType.Planks, amount: 4 },
      { resource: ResourceType.Stone, amount: 4 },
      { resource: ResourceType.IronBars, amount: 2 },
    ],
    worker: '',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 0,
    constructionTime: 50,
    workRadius: 0,
    populationCapacity: LARGE_HOUSE_CAPACITY,
  },
};
