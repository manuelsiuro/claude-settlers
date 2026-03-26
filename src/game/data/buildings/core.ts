import { TerrainType } from '../../TerrainType';
import type { BuildingType, BuildingDefinition } from '../../BuildingType';
import { CASTLE_POPULATION_CAPACITY } from '../balanceConstants';

/** Core buildings — the player's starting structures */
export const CORE_BUILDINGS: Partial<Record<BuildingType, BuildingDefinition>> = {
  ['castle']: {
    type: 'castle',
    label: 'Castle',
    description: 'Your seat of power and main storage hub',
    category: 'core',
    tier: 0,
    cost: [],
    worker: '',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 8,
    visionRadius: 10,
    storageCapacity: 150,
    constructionTime: 0,
    workRadius: 0,
    populationCapacity: CASTLE_POPULATION_CAPACITY,
  },
};
