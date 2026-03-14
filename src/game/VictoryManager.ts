import { BuildingState, getInventoryAmount, getInventoryTotal } from './Building';
import { BuildingType } from './BuildingType';
import { ResourceType } from './ResourceType';
import { TerrainType } from './TerrainType';
import type { GameState } from './GameState';
import type { TerritoryManager } from './TerritoryManager';

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

/** Options for configuring optional victory conditions */
export interface VictoryManagerOptions {
  /** Time limit in seconds. 0 = disabled (default). When elapsed, player with most territory wins. */
  timedLimit?: number;
  /** Enable the peaceful victory condition (first to 100+ total goods in Castle/Warehouse). Default false. */
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
  static DOMINATION_THRESHOLD = 0.75;
  static ECONOMIC_GOLD_TARGET = 50;
  static PEACEFUL_GOODS_TARGET = 100;

  /** Timed victory: limit in seconds (0 = disabled) */
  private timedLimit: number;

  /** Total elapsed game time in seconds */
  private elapsedTime = 0;

  /** Whether the peaceful victory condition is enabled */
  private peacefulEnabled: boolean;

  /** Callbacks */
  onVictory: ((result: VictoryResult) => void) | null = null;
  onDefeat: ((result: DefeatResult) => void) | null = null;

  constructor(
    gameState: GameState,
    territoryManager: TerritoryManager,
    playerIds: number[],
    options?: VictoryManagerOptions,
  ) {
    this.gameState = gameState;
    this.territoryManager = territoryManager;
    this.playerIds = playerIds;
    this.timedLimit = options?.timedLimit ?? 0;
    this.peacefulEnabled = options?.peacefulEnabled ?? false;
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
    if (activePlayers.length === 1 && this.playerIds.length > 1) {
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
    if (this.timedLimit > 0 && this.elapsedTime >= this.timedLimit) {
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
      const fraction = this.getPlayerTerritoryFraction(playerId);
      if (fraction >= VictoryManager.DOMINATION_THRESHOLD) {
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
      const goldBars = this.getPlayerGoldBars(playerId);
      if (goldBars >= VictoryManager.ECONOMIC_GOLD_TARGET) {
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
