import type { Building } from './Building';
import { getBuildingIdCounter, setBuildingIdCounter } from './Building';
import type { Unit } from './Unit';
import { getUnitIdCounter, setUnitIdCounter } from './Unit';
import type { Flag, Road, FlagGood } from './RoadNetwork';
import { getRoadNetworkIdCounters, setRoadNetworkIdCounters } from './RoadNetwork';
import type { GameConfig } from './GameConfig';
import type { VictoryResult } from './VictoryManager';
import type { GameState } from './GameState';
import type { RoadNetwork } from './RoadNetwork';
import type { ConstructionManager } from './ConstructionManager';
import type { TransporterManager } from './TransporterManager';
import type { UnitManager } from './UnitManager';
import type { CombatManager } from './CombatManager';
import type { AttackManager } from './AttackManager';
import type { TerritoryManager } from './TerritoryManager';
import type { LogisticsManager } from './LogisticsManager';
import type { KnightManager } from './KnightManager';
import type { VictoryManager } from './VictoryManager';
import type { GeologistManager, GeologistPhase } from './GeologistManager';
import type { TreeManager, TreeEntity } from './TreeManager';
import type { WoodcutterManager, WoodcutterPhase } from './WoodcutterManager';
import type { ForesterManager, ForesterPhase } from './ForesterManager';
import type { UpgradeManager } from './UpgradeManager';
import type { FogOfWarManager } from './FogOfWarManager';
import type { AIPlayer } from './AIPlayer';
import { TerrainType } from './TerrainType';
import type { GoodsDistributionSettings } from './GoodsDistribution';
import { serializeDistribution, deserializeDistribution } from './GoodsDistribution';

/** Current save format version */
const SAVE_VERSION = 6;

/** localStorage key for auto-save */
const STORAGE_KEY = 'feudal_realm_save';

/**
 * Complete serializable game state.
 * Everything needed to fully restore a game session.
 */
export interface SaveData {
  version: number;
  timestamp: number;
  config: GameConfig;

  // ID counters (prevent collisions after load)
  nextBuildingId: number;
  nextUnitId: number;
  nextFlagId: number;
  nextRoadId: number;

  // Core state
  buildings: Building[];
  units: Unit[];
  workerByBuilding: [string, string][];

  // Road network
  flags: Flag[];
  roads: Road[];

  // Manager states
  constructionManager: {
    builderAssignments: [string, string][];
    deliveryCooldown: number;
  };
  transporterManager: {
    transporterStates: [string, { roadId: string; targetFlagId: string; carrying: FlagGood | null; waitingAtFlagId: string | null }][];
    spawnCooldown: number;
  };
  unitManager: {
    spawnCooldown: number;
  };
  combatManager: {
    combatWins: [string, number][];
  };
  attackManager: {
    attacks: { knightId: string; targetBuildingId: string; arrived: boolean }[];
  };
  territoryManager: {
    territory: [string, number][];
    version: number;
  };
  logisticsManager: {
    routingCooldown: number;
  };
  knightManager: {
    recruitCooldown: number;
  };
  geologistManager: {
    workStates: [string, {
      phase: GeologistPhase;
      targetCoord: { q: number; r: number } | null;
      prospectProgress: number;
      prospectedTiles: string[];
      idleCooldown: number;
    }][];
  };
  treeManager: {
    trees: TreeEntity[];
    nextTreeId: number;
  };
  woodcutterManager: {
    workStates: [string, {
      phase: WoodcutterPhase;
      targetTreeId: string | null;
      chopProgress: number;
      idleCooldown: number;
    }][];
  };
  foresterManager: {
    workStates: [string, {
      phase: ForesterPhase;
      targetCoord: { q: number; r: number } | null;
      plantProgress: number;
      idleCooldown: number;
      plantedTiles: string[];
    }][];
  };
  upgradeManager?: {
    builderAssignments: [string, string][];
    deliveryCooldown: number;
  };
  fogOfWarManager?: {
    players: { playerId: number; data: string }[];
    version: number;
  };
  /** Terrain overrides from original map generation (e.g., Forest↔Grassland from forestry) */
  terrainOverrides: { q: number; r: number; terrain: string }[];
  /** Revealed/claimed deposit coordinates for persistence across map regeneration */
  deposits: {
    revealed: { q: number; r: number; resource: string }[];
    claimed: { q: number; r: number }[];
  };
  victoryManager: {
    eliminatedPlayers: number[];
    gameOver: boolean;
    result: VictoryResult | null;
    checkCooldown: number;
    elapsedTime?: number;
  };

  // Economy settings
  goodsDistribution?: ReturnType<typeof serializeDistribution>;

  // AI state
  aiPlayers: {
    playerId: number;
    buildOrderIndex: number;
    hexRetryCount: number;
    decisionCooldown: number;
    attackCooldown: number;
  }[];

  // Camera state
  frustum: number;
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
}

/**
 * Serialize the full game state into a JSON-safe object.
 */
export function serializeGame(
  config: GameConfig,
  gameState: GameState,
  roadNetwork: RoadNetwork,
  managers: {
    constructionManager: ConstructionManager;
    transporterManager: TransporterManager;
    unitManager: UnitManager;
    combatManager: CombatManager;
    attackManager: AttackManager;
    territoryManager: TerritoryManager;
    logisticsManager: LogisticsManager;
    knightManager: KnightManager;
    victoryManager: VictoryManager;
    geologistManager: GeologistManager;
    treeManager: TreeManager;
    woodcutterManager: WoodcutterManager;
    foresterManager: ForesterManager;
    upgradeManager: UpgradeManager;
    fogOfWarManager: FogOfWarManager;
  },
  aiPlayers: AIPlayer[],
  camera: { frustum: number; position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } },
  distributionSettings?: GoodsDistributionSettings,
): SaveData {
  const gsState = gameState._getState();
  const rnState = roadNetwork._getState();
  const rnCounters = getRoadNetworkIdCounters();

  // Collect deposit state from the grid
  const grid = gameState.getGrid();
  const revealed: { q: number; r: number; resource: string }[] = [];
  const claimed: { q: number; r: number }[] = [];
  for (const tile of grid.getAllTiles()) {
    if (tile.deposit?.revealed) {
      revealed.push({ q: tile.coord.q, r: tile.coord.r, resource: tile.deposit.resource });
    }
    if (tile.deposit?.claimed) {
      claimed.push({ q: tile.coord.q, r: tile.coord.r });
    }
  }

  // Collect terrain overrides: save all Forest/Grassland terrain state
  // (these can change during gameplay from woodcutting/planting)
  const terrainOverrides: { q: number; r: number; terrain: string }[] = [];
  for (const tile of grid.getAllTiles()) {
    // Only save Forest and Grassland tiles since those are the only ones that change
    if (tile.terrain === TerrainType.Forest || tile.terrain === TerrainType.Grassland) {
      terrainOverrides.push({ q: tile.coord.q, r: tile.coord.r, terrain: tile.terrain });
    }
  }

  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    config,

    nextBuildingId: getBuildingIdCounter(),
    nextUnitId: getUnitIdCounter(),
    nextFlagId: rnCounters.nextFlagId,
    nextRoadId: rnCounters.nextRoadId,

    buildings: gsState.buildings,
    units: gsState.units,
    workerByBuilding: gsState.workerByBuilding,

    flags: rnState.flags,
    roads: rnState.roads,

    constructionManager: managers.constructionManager._getState(),
    transporterManager: managers.transporterManager._getState(),
    unitManager: managers.unitManager._getState(),
    combatManager: managers.combatManager._getState(),
    attackManager: managers.attackManager._getState(),
    territoryManager: managers.territoryManager._getState(),
    logisticsManager: managers.logisticsManager._getState(),
    knightManager: managers.knightManager._getState(),
    geologistManager: managers.geologistManager._getState(),
    treeManager: managers.treeManager._getState(),
    woodcutterManager: managers.woodcutterManager._getState(),
    foresterManager: managers.foresterManager._getState(),
    upgradeManager: managers.upgradeManager._getState(),
    fogOfWarManager: managers.fogOfWarManager._getState(),
    terrainOverrides,
    deposits: { revealed, claimed },
    victoryManager: managers.victoryManager._getState(),

    goodsDistribution: distributionSettings ? serializeDistribution(distributionSettings) : undefined,

    aiPlayers: aiPlayers.map((ai) => ai._getState()),

    frustum: camera.frustum,
    cameraPosition: camera.position,
    cameraTarget: camera.target,
  };
}

/**
 * Restore all game state from a SaveData object.
 * Must be called after Game has constructed all managers
 * but before the animation loop begins producing new state.
 */
export function deserializeGame(
  data: SaveData,
  gameState: GameState,
  roadNetwork: RoadNetwork,
  managers: {
    constructionManager: ConstructionManager;
    transporterManager: TransporterManager;
    unitManager: UnitManager;
    combatManager: CombatManager;
    attackManager: AttackManager;
    territoryManager: TerritoryManager;
    logisticsManager: LogisticsManager;
    knightManager: KnightManager;
    victoryManager: VictoryManager;
    geologistManager: GeologistManager;
    treeManager: TreeManager;
    woodcutterManager: WoodcutterManager;
    foresterManager: ForesterManager;
    upgradeManager: UpgradeManager;
    fogOfWarManager: FogOfWarManager;
  },
  aiPlayers: AIPlayer[],
): GoodsDistributionSettings | null {
  // Restore ID counters first (so any subsequent creates don't collide)
  setBuildingIdCounter(data.nextBuildingId);
  setUnitIdCounter(data.nextUnitId);
  setRoadNetworkIdCounters({ nextFlagId: data.nextFlagId, nextRoadId: data.nextRoadId });

  // Restore core state
  gameState._loadState({
    buildings: data.buildings,
    units: data.units,
    workerByBuilding: data.workerByBuilding,
  });

  // Restore road network
  roadNetwork._loadState({
    flags: data.flags,
    roads: data.roads,
  });

  // Restore manager states
  managers.constructionManager._loadState(data.constructionManager);
  managers.transporterManager._loadState(data.transporterManager);
  managers.unitManager._loadState(data.unitManager);
  managers.combatManager._loadState(data.combatManager);
  managers.attackManager._loadState(data.attackManager);
  managers.territoryManager._loadState(data.territoryManager);
  managers.logisticsManager._loadState(data.logisticsManager);
  managers.knightManager._loadState(data.knightManager);
  if (data.geologistManager) {
    managers.geologistManager._loadState(data.geologistManager);
  }
  if (data.treeManager) {
    managers.treeManager._loadState(data.treeManager);
  } else {
    // Legacy save: initialize trees from map
    managers.treeManager.initializeFromMap(gameState.getGrid());
  }
  if (data.woodcutterManager) {
    managers.woodcutterManager._loadState(data.woodcutterManager);
  }
  if (data.foresterManager) {
    managers.foresterManager._loadState(data.foresterManager);
  }
  if (data.upgradeManager) {
    managers.upgradeManager._loadState(data.upgradeManager);
  }
  if (data.fogOfWarManager) {
    managers.fogOfWarManager._loadState(data.fogOfWarManager);
  }

  // Backward compat: patch buildings missing fields from older versions
  for (const b of data.buildings) {
    if (!b.upgradeLevels) b.upgradeLevels = {};
    if (b.activeUpgrade === undefined) b.activeUpgrade = null;
    if (!b.extraWorkerIds) b.extraWorkerIds = [];
    if (b.productionPaused === undefined) b.productionPaused = false;
  }

  // Restore terrain overrides (from forestry: Forest↔Grassland changes)
  if (data.terrainOverrides) {
    const grid = gameState.getGrid();
    for (const override of data.terrainOverrides) {
      const tile = grid.getTile(override.q, override.r);
      if (tile && tile.terrain !== override.terrain) {
        grid.setTile(override.q, override.r, override.terrain as TerrainType, tile.elevation, tile.deposit);
      }
    }
  }

  // Restore deposit revealed/claimed state onto the regenerated map
  if (data.deposits) {
    const grid = gameState.getGrid();
    for (const r of data.deposits.revealed) {
      grid.revealDeposit(r.q, r.r);
    }
    for (const c of data.deposits.claimed) {
      grid.claimDeposit(c.q, c.r);
      // Re-apply terrain change: mountain → grassland for mined tiles
      const tile = grid.getTile(c.q, c.r);
      if (tile && tile.terrain === TerrainType.Mountain) {
        grid.setTile(c.q, c.r, TerrainType.Grassland, tile.elevation, tile.deposit);
      }
    }
  }

  managers.victoryManager._loadState(data.victoryManager);

  // Restore AI player states
  for (const aiState of data.aiPlayers) {
    const ai = aiPlayers.find((a) => a.getPlayerId() === aiState.playerId);
    if (ai) {
      ai._loadState(aiState);
    }
  }

  // Restore goods distribution settings (if present)
  if (data.goodsDistribution) {
    return deserializeDistribution(data.goodsDistribution);
  }
  return null;
}

/**
 * Save game to localStorage.
 */
export function saveToLocalStorage(data: SaveData): void {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (err) {
    console.warn('Failed to save game to localStorage:', err);
    throw new Error('Save failed: storage quota exceeded or unavailable');
  }
}

/**
 * Load game from localStorage. Returns null if no save exists.
 */
export function loadFromLocalStorage(): SaveData | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    const data = JSON.parse(json) as SaveData;
    if (data.version < 3 || data.version > SAVE_VERSION) {
      console.warn(`Save version mismatch: expected ${SAVE_VERSION}, got ${data.version}`);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Failed to load game from localStorage:', err);
    return null;
  }
}

/**
 * Delete the save from localStorage.
 */
export function deleteSave(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if a save exists in localStorage.
 */
export function hasSave(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Download save data as a JSON file.
 */
export function downloadSave(data: SaveData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `feudal_realm_save_${new Date(data.timestamp).toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Prompt user to select a save file and parse it.
 * Returns a Promise that resolves to SaveData or null if cancelled/invalid.
 */
export function loadFromFile(): Promise<SaveData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text) as SaveData;
        if (data.version < 3 || data.version > SAVE_VERSION) {
          console.warn(`Save version mismatch: expected ${SAVE_VERSION}, got ${data.version}`);
          resolve(null);
          return;
        }
        resolve(data);
      } catch (err) {
        console.warn('Failed to parse save file:', err);
        resolve(null);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
