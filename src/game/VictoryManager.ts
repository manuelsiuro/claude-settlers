import { BuildingState, getInventoryAmount } from './Building';
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

/**
 * Checks victory and defeat conditions each tick.
 *
 * Victory types:
 * - Elimination: all enemy Castles destroyed (last standing wins)
 * - Domination: control 75%+ of claimable land
 * - Economic: accumulate 50+ gold bars
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

  /** Callbacks */
  onVictory: ((result: VictoryResult) => void) | null = null;
  onDefeat: ((result: DefeatResult) => void) | null = null;

  constructor(
    gameState: GameState,
    territoryManager: TerritoryManager,
    playerIds: number[],
  ) {
    this.gameState = gameState;
    this.territoryManager = territoryManager;
    this.playerIds = playerIds;
  }

  update(deltaTime: number): void {
    if (this.gameOver) return;

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

    // Check domination and economic for each active player
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
    }
  }
}
