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
  RiverValley: 'river_valley',
  MountainPass: 'mountain_pass',
  Oasis: 'oasis',
  Peninsula: 'peninsula',
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
  /** Sandbox mode: AI never attacks, no defeat condition, free building (no resource cost) */
  sandbox?: boolean;
  /** Campaign scenario ID — enables objective tracking */
  campaignId?: string;
  /** Multiplayer mode — game uses lockstep networking */
  isMultiplayer?: boolean;
  /** Player IDs controlled by humans (multiplayer). AI is created for all other IDs. */
  humanPlayerIds?: number[];
  /** Relay server WebSocket address (e.g., ws://192.168.1.42:9876) */
  serverAddress?: string;
  /** Room code for joining an existing game */
  roomCode?: string;
  /** Player name for multiplayer lobby */
  playerName?: string;
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
  [Scenario.RiverValley]: {
    [TerrainType.Water]: 0.20,
    [TerrainType.Grassland]: 0.40,
    [TerrainType.Forest]: 0.25,
    [TerrainType.Mountain]: 0.05,
    [TerrainType.Desert]: 0.10,
  },
  [Scenario.MountainPass]: {
    [TerrainType.Water]: 0.05,
    [TerrainType.Grassland]: 0.20,
    [TerrainType.Forest]: 0.15,
    [TerrainType.Mountain]: 0.55,
    [TerrainType.Desert]: 0.05,
  },
  [Scenario.Oasis]: {
    [TerrainType.Water]: 0.10,
    [TerrainType.Grassland]: 0.15,
    [TerrainType.Forest]: 0.05,
    [TerrainType.Mountain]: 0.10,
    [TerrainType.Desert]: 0.60,
  },
  [Scenario.Peninsula]: {
    [TerrainType.Water]: 0.40,
    [TerrainType.Grassland]: 0.30,
    [TerrainType.Forest]: 0.15,
    [TerrainType.Mountain]: 0.12,
    [TerrainType.Desert]: 0.03,
  },
};

export interface GraphicsSettings {
  shadows: 'off' | 'blob_only' | 'low' | 'high';
  postProcessing: 'off' | 'color_only' | 'full';
  weather: 'none' | 'rain' | 'snow';
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'golden_hour' | 'evening' | 'night' | 'auto';
  fogOfWar: boolean;
  ambientLife: 'off' | 'minimal' | 'full';
}

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  shadows: 'blob_only',
  postProcessing: 'color_only',
  weather: 'none',
  timeOfDay: 'midday',
  fogOfWar: true,
  ambientLife: 'full',
};

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  spatialVolume: number;
  ambientVolume: number;
  muted: boolean;
  spatialAudio: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = {
  masterVolume: 0.5,
  sfxVolume: 0.8,
  musicVolume: 0.3,
  spatialVolume: 0.6,
  ambientVolume: 0.4,
  muted: false,
  spatialAudio: true,
};
