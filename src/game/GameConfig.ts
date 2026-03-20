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

export interface VictoryConfig {
  elimination: boolean;
  domination: boolean;
  economic: boolean;
  timed: boolean;
  timedLimitMinutes: number; // range 5–120
  peaceful: boolean;
}

export const DEFAULT_VICTORY_CONFIG: VictoryConfig = {
  elimination: true,
  domination: true,
  economic: true,
  timed: false,
  timedLimitMinutes: 30,
  peaceful: false,
};

export interface GameConfig {
  seed: number;
  mapSize: MapSize;
  numPlayers: number; // 1–4
  difficulty: Difficulty;
  scenario: Scenario;
  victory?: VictoryConfig;
  customMapId?: string; // If set, load from MapStorage instead of generateMap()
}

export const DEFAULT_CONFIG: GameConfig = {
  seed: 42,
  mapSize: MapSize.Medium,
  numPlayers: 1,
  difficulty: Difficulty.Normal,
  scenario: Scenario.Default,
  victory: DEFAULT_VICTORY_CONFIG,
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

export interface GraphicsSettings {
  shadows: 'off' | 'blob_only' | 'low' | 'high';
  postProcessing: 'off' | 'color_only' | 'full';
  weather: 'none' | 'rain' | 'snow';
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'golden_hour' | 'evening' | 'night' | 'auto';
  fogOfWar: boolean;
}

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  shadows: 'blob_only',
  postProcessing: 'color_only',
  weather: 'none',
  timeOfDay: 'midday',
  fogOfWar: true,
};

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = {
  masterVolume: 0.5,
  sfxVolume: 0.8,
  musicVolume: 0.3,
  muted: false,
};
