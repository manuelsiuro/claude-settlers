export const TerrainType = {
  Grassland: 'grassland',
  Forest: 'forest',
  Mountain: 'mountain',
  Water: 'water',
  Desert: 'desert',
} as const;

export type TerrainType = (typeof TerrainType)[keyof typeof TerrainType];

/** Terrain properties affecting gameplay */
export interface TerrainProperties {
  buildable: boolean;
  /** Whether resources can be gathered here */
  harvestable: boolean;
  /** Movement speed multiplier (1.0 = normal) */
  movementCost: number;
  /** Description for UI */
  label: string;
}

export const TERRAIN_PROPERTIES: Record<TerrainType, TerrainProperties> = {
  [TerrainType.Grassland]: {
    buildable: true,
    harvestable: false,
    movementCost: 1.0,
    label: 'Grassland',
  },
  [TerrainType.Forest]: {
    buildable: false,
    harvestable: true,
    movementCost: 1.5,
    label: 'Forest',
  },
  [TerrainType.Mountain]: {
    buildable: false,
    harvestable: true,
    movementCost: 3.0,
    label: 'Mountain',
  },
  [TerrainType.Water]: {
    buildable: false,
    harvestable: true,
    movementCost: Infinity,
    label: 'Water',
  },
  [TerrainType.Desert]: {
    buildable: false,
    harvestable: false,
    movementCost: 2.0,
    label: 'Desert',
  },
};
