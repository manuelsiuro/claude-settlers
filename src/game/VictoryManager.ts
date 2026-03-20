import { BuildingState, getInventoryAmount, getInventoryTotal } from './Building';
import { BuildingType } from './BuildingType';
import { ResourceType } from './ResourceType';
import { TerrainType } from './TerrainType';
import type { GameState } from './GameState';
import type { TerritoryManager } from './TerritoryManager';
import {
  VICTORY_DOMINATION_THRESHOLD,
  VICTORY_ECONOMIC_GOLD_TARGET,
  VICTORY_PEACEFUL_GOODS_TARGET,
} from './data/balanceConstants';
import type { VictoryConfig } from './GameConfig';
import { DEFAULT_VICTORY_CONFIG } from './GameConfig';

export const VictoryCondition = {
  /** All enemy Castles destroyed — last player standing */
  Elimination: 'elimination',
  /** Control 75%+ of claimable (non-water) land */
  Domination: 'domination',
  /** Accumulate 50+ gold bars across all buildings */
  Economic: 'economic',
  /** When time expires, player with most territory wins */
  Timed: 'timed',
  /** First player to accumulate 100+ total goods in Castle/Warehouse storage */
  Peaceful: 'peaceful',
} as const;

export type VictoryCondition = (typeof VictoryCondition)[keyof typeof VictoryCondition];

export interface VictoryResult {
  winnerId: number;
  condition: VictoryCondition;
}

export interface DefeatResult {
  playerId: number;
  reason: 'castle_destroyed';
}

/** @deprecated Use VictoryConfig from GameConfig instead */
export interface VictoryManagerOptions {
  timedLimit?: number;
  peacefulEnabled?: boolean;
}

/**
 * Checks victory and defeat conditions each tick.
 *
 * Victory types:
 * - Elimination: all enemy Castles destroyed (last standing wins)
 * - Domination: control 75%+ of claimable land
 * - Economic: accumulate 50+ gold bars
 * - Timed: when time limit expires, player with most territory hexes wins
 * - Peaceful: first player to accumulate 100+ total goods in Castle/Warehouse storage
 *
 * Defeat: a player's Castle is destroyed or captured.
 */
export class VictoryManager {
  private gameState: GameState;
  private territoryManager: TerritoryManager;
  private playerIds: number[];

  /** Seconds between victory checks (no need to check every frame) */
  private static CHECK_INTERVAL = 2.0;
  private checkCooldown = 0;

  /** Players who have been eliminated */
  private eliminatedPlayers: Set<number> = new Set();

  /** Whether the game has ended */
  private gameOver = false;

  /** Stored result when game ends (for UI retrieval) */
  private result: VictoryResult | null = null;

  /** Thresholds */
  static DOMINATION_THRESHOLD = VICTORY_DOMINATION_THRESHOLD;
  static ECONOMIC_GOLD_TARGET = VICTORY_ECONOMIC_GOLD_TARGET;
  static PEACEFUL_GOODS_TARGET = VICTORY_PEACEFUL_GOODS_TARGET;

  /** Per-condition enabled flags */
  private eliminationEnabled: boolean;
  private dominationEnabled: boolean;
  private economicEnabled: boolean;
  private timedEnabled: boolean;
  private peacefulEnabled: boolean;

  /** Timed victory: limit in seconds (0 = disabled) */
  private timedLimit: number;

  /** Total elapsed game time in seconds */
  private elapsedTime = 0;

  /** Callbacks */
  onVictory: ((result: VictoryResult) => void) | null = null;
  onDefeat: ((result: DefeatResult) => void) | null = null;

  constructor(
    gameState: GameState,
    territoryManager: TerritoryManager,
    playerIds: number[],
    config?: VictoryConfig | VictoryManagerOptions,
  ) {
    this.gameState = gameState;
    this.territoryManager = territoryManager;
    this.playerIds = playerIds;

    // Support both new VictoryConfig and legacy VictoryManagerOptions
    if (config && 'elimination' in config) {
      // VictoryConfig
      this.eliminationEnabled = config.elimination;
      this.dominationEnabled = config.domination;
      this.economicEnabled = config.economic;
      this.timedEnabled = config.timed;
      this.timedLimit = config.timed ? config.timedLimitMinutes * 60 : 0;
      this.peacefulEnabled = config.peaceful;
    } else {
      // Legacy VictoryManagerOptions or undefined
      const defaults = DEFAULT_VICTORY_CONFIG;
      this.eliminationEnabled = defaults.elimination;
      this.dominationEnabled = defaults.domination;
      this.economicEnabled = defaults.economic;
      this.timedEnabled = (config as VictoryManagerOptions)?.timedLimit ? true : false;
      this.timedLimit = (config as VictoryManagerOptions)?.timedLimit ?? 0;
      this.peacefulEnabled = (config as VictoryManagerOptions)?.peacefulEnabled ?? false;
    }
  }

  /** Serialization: get internal state for save */
  _getState(): {
    eliminatedPlayers: number[];
    gameOver: boolean;
    result: VictoryResult | null;
    checkCooldown: number;
    elapsedTime: number;
  } {
    return {
      eliminatedPlayers: Array.from(this.eliminatedPlayers),
      gameOver: this.gameOver,
      result: this.result,
      checkCooldown: this.checkCooldown,
      elapsedTime: this.elapsedTime,
    };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: {
    eliminatedPlayers: number[];
    gameOver: boolean;
    result: VictoryResult | null;
    checkCooldown: number;
    elapsedTime?: number;
  }): void {
    this.eliminatedPlayers = new Set(state.eliminatedPlayers);
    this.gameOver = state.gameOver;
    this.result = state.result;
    this.checkCooldown = state.checkCooldown;
    this.elapsedTime = state.elapsedTime ?? 0;
  }

  /** Get elapsed game time in seconds */
  getElapsedTime(): number {
    return this.elapsedTime;
  }

  /** Get configured timed limit in seconds (0 = disabled) */
  getTimedLimit(): number {
    return this.timedLimit;
  }

  /** Check whether the peaceful victory condition is enabled */
  isPeacefulEnabled(): boolean {
    return this.peacefulEnabled;
  }

  /** Check whether the elimination victory condition is enabled */
  isEliminationEnabled(): boolean {
    return this.eliminationEnabled;
  }

  /** Check whether the domination victory condition is enabled */
  isDominationEnabled(): boolean {
    return this.dominationEnabled;
  }

  /** Check whether the economic victory condition is enabled */
  isEconomicEnabled(): boolean {
    return this.economicEnabled;
  }

  /** Check whether the timed victory condition is enabled */
  isTimedEnabled(): boolean {
    return this.timedEnabled;
  }

  /** Get list of currently enabled victory conditions */
  getEnabledConditions(): VictoryCondition[] {
    const conditions: VictoryCondition[] = [];
    if (this.eliminationEnabled) conditions.push(VictoryCondition.Elimination);
    if (this.dominationEnabled) conditions.push(VictoryCondition.Domination);
    if (this.economicEnabled) conditions.push(VictoryCondition.Economic);
    if (this.timedEnabled) conditions.push(VictoryCondition.Timed);
    if (this.peacefulEnabled) conditions.push(VictoryCondition.Peaceful);
    return conditions;
  }

  update(deltaTime: number): void {
    if (this.gameOver) return;

    this.elapsedTime += deltaTime;
    this.checkCooldown -= deltaTime;
    if (this.checkCooldown > 0) return;
    this.checkCooldown = VictoryManager.CHECK_INTERVAL;

    this.checkConditions();
  }

  /** Force an immediate check (useful for testing) */
  checkNow(): void {
    if (this.gameOver) return;
    this.checkConditions();
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  /** Get the victory result (null if game is still in progress) */
  getResult(): VictoryResult | null {
    return this.result;
  }

  isEliminated(playerId: number): boolean {
    return this.eliminatedPlayers.has(playerId);
  }

  getActivePlayers(): number[] {
    return this.playerIds.filter((id) => !this.eliminatedPlayers.has(id));
  }

  /**
   * Count total gold bars across all of a player's buildings.
   */
  getPlayerGoldBars(playerId: number): number {
    const buildings = this.gameState.getBuildingsByPlayer(playerId);
    let total = 0;
    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;
      total += getInventoryAmount(building.outputInventory, ResourceType.GoldBars);
      total += getInventoryAmount(building.inputInventory, ResourceType.GoldBars);
    }
    return total;
  }

  /**
   * Count total goods stored across all of a player's active Castle and Warehouse buildings.
   * Sums both inputInventory and outputInventory.
   */
  getPlayerStorageGoods(playerId: number): number {
    const buildings = this.gameState.getBuildingsByPlayer(playerId);
    let total = 0;
    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;
      if (building.type !== BuildingType.Castle && building.type !== BuildingType.Warehouse) continue;
      total += getInventoryTotal(building.outputInventory);
      total += getInventoryTotal(building.inputInventory);
    }
    return total;
  }

  /**
   * Count the number of non-water hexes owned by a player.
   */
  getPlayerTerritoryHexCount(playerId: number): number {
    const grid = this.gameState.getGrid();
    const allTiles = grid.getAllTiles();
    let owned = 0;
    for (const tile of allTiles) {
      if (tile.terrain === TerrainType.Water) continue;
      if (this.territoryManager.isOwnedBy(tile.coord.q, tile.coord.r, playerId)) {
        owned++;
      }
    }
    return owned;
  }

  /**
   * Get the fraction of claimable land controlled by a player.
   * Claimable = non-water tiles.
   */
  getPlayerTerritoryFraction(playerId: number): number {
    const grid = this.gameState.getGrid();
    const allTiles = grid.getAllTiles();

    let claimable = 0;
    let owned = 0;

    for (const tile of allTiles) {
      if (tile.terrain === TerrainType.Water) continue;
      claimable++;
      if (this.territoryManager.isOwnedBy(tile.coord.q, tile.coord.r, playerId)) {
        owned++;
      }
    }

    if (claimable === 0) return 0;
    return owned / claimable;
  }

  private checkConditions(): void {
    // Check for defeats first (Castle destroyed)
    for (const playerId of this.playerIds) {
      if (this.eliminatedPlayers.has(playerId)) continue;

      const castle = this.gameState.findCastle(playerId);
      if (!castle) {
        this.eliminatedPlayers.add(playerId);
        this.onDefeat?.({ playerId, reason: 'castle_destroyed' });
      }
    }

    const activePlayers = this.getActivePlayers();

    // Elimination victory: only one player left
    if (this.eliminationEnabled && activePlayers.length === 1 && this.playerIds.length > 1) {
      const victoryResult: VictoryResult = {
        winnerId: activePlayers[0],
        condition: VictoryCondition.Elimination,
      };
      this.gameOver = true;
      this.result = victoryResult;
      this.onVictory?.(victoryResult);
      return;
    }

    // No active players — shouldn't happen, but guard
    if (activePlayers.length === 0) return;

    // Timed victory: when the time limit expires, player with the most territory hexes wins
    if (this.timedEnabled && this.timedLimit > 0 && this.elapsedTime >= this.timedLimit) {
      let bestPlayer = activePlayers[0];
      let bestCount = 0;
      for (const playerId of activePlayers) {
        const count = this.getPlayerTerritoryHexCount(playerId);
        if (count > bestCount) {
          bestCount = count;
          bestPlayer = playerId;
        }
      }
      const victoryResult: VictoryResult = {
        winnerId: bestPlayer,
        condition: VictoryCondition.Timed,
      };
      this.gameOver = true;
      this.result = victoryResult;
      this.onVictory?.(victoryResult);
      return;
    }

    // Check domination, economic, and peaceful for each active player
    for (const playerId of activePlayers) {
      // Domination check
      const fraction = this.dominationEnabled ? this.getPlayerTerritoryFraction(playerId) : 0;
      if (this.dominationEnabled && fraction >= VictoryManager.DOMINATION_THRESHOLD) {
        const victoryResult: VictoryResult = {
          winnerId: playerId,
          condition: VictoryCondition.Domination,
        };
        this.gameOver = true;
        this.result = victoryResult;
        this.onVictory?.(victoryResult);
        return;
      }

      // Economic check
      if (this.economicEnabled && this.getPlayerGoldBars(playerId) >= VictoryManager.ECONOMIC_GOLD_TARGET) {
        const victoryResult: VictoryResult = {
          winnerId: playerId,
          condition: VictoryCondition.Economic,
        };
        this.gameOver = true;
        this.result = victoryResult;
        this.onVictory?.(victoryResult);
        return;
      }

      // Peaceful check: first to 100+ total goods in Castle/Warehouse storage
      if (this.peacefulEnabled) {
        const storageGoods = this.getPlayerStorageGoods(playerId);
        if (storageGoods >= VictoryManager.PEACEFUL_GOODS_TARGET) {
          const victoryResult: VictoryResult = {
            winnerId: playerId,
            condition: VictoryCondition.Peaceful,
          };
          this.gameOver = true;
          this.result = victoryResult;
          this.onVictory?.(victoryResult);
          return;
        }
      }
    }
  }
}
