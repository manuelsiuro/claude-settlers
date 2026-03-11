import { TerrainType } from './TerrainType';

export const MapSize = {
  Small: 24,
  Medium: 32,
  Large: 48,
  Huge: 64,
} as const;

export type MapSize = (typeof MapSize)[keyof typeof MapSize];

export const Difficulty = {
  Easy: 'easy',
  Normal: 'normal',
  Hard: 'hard',
} as const;

export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const Scenario = {
  Default: 'default',
  Island: 'island',
  Continent: 'continent',
  Archipelago: 'archipelago',
} as const;

export type Scenario = (typeof Scenario)[keyof typeof Scenario];

export interface GameConfig {
  seed: number;
  mapSize: MapSize;
  numPlayers: number; // 1–4
  difficulty: Difficulty;
  scenario: Scenario;
}

export const DEFAULT_CONFIG: GameConfig = {
  seed: 42,
  mapSize: MapSize.Medium,
  numPlayers: 1,
  difficulty: Difficulty.Normal,
  scenario: Scenario.Default,
};

/** Terrain balance overrides per scenario */
export const SCENARIO_TERRAIN_BALANCE: Record<
  Scenario,
  Partial<Record<TerrainType, number>> | undefined
> = {
  [Scenario.Default]: undefined, // use MapGenerator defaults
  [Scenario.Island]: {
    [TerrainType.Water]: 0.35,
    [TerrainType.Grassland]: 0.30,
    [TerrainType.Forest]: 0.20,
    [TerrainType.Mountain]: 0.10,
    [TerrainType.Desert]: 0.05,
  },
  [Scenario.Continent]: {
    [TerrainType.Water]: 0.05,
    [TerrainType.Grassland]: 0.40,
    [TerrainType.Forest]: 0.30,
    [TerrainType.Mountain]: 0.18,
    [TerrainType.Desert]: 0.07,
  },
  [Scenario.Archipelago]: {
    [TerrainType.Water]: 0.45,
    [TerrainType.Grassland]: 0.22,
    [TerrainType.Forest]: 0.18,
    [TerrainType.Mountain]: 0.10,
    [TerrainType.Desert]: 0.05,
  },
};
