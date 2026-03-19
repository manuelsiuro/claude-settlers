import type { GameState } from './GameState';
import { BuildingType } from './BuildingType';
import { BuildingState, getInventoryAmount } from './Building';
import { ResourceType } from './ResourceType';
import {
  MORALE_BASE,
  MORALE_VARIETY_BONUS_MAX,
  MORALE_VOLUME_BONUS_MAX,
  MORALE_GOLD_BONUS_PER_BAR,
  MORALE_GOLD_BONUS_MAX,
  MORALE_WINDOW,
  MORALE_VARIETY_PER_TYPE,
  MORALE_VOLUME_PER_DRINK,
  MORALE_MULTIPLIER_BASE,
  MORALE_MULTIPLIER_SCALE,
} from './data/balanceConstants';

interface DrinkEvent {
  drinkType: ResourceType;
  timestamp: number;
}

/**
 * MoraleManager: tracks drink service and computes per-player morale.
 * Morale affects production speed and combat effectiveness.
 *
 * Morale = base(0.5) + drink variety bonus + drink volume bonus + gold bonus
 */
export class MoraleManager {
  private gameState: GameState;
  private drinkEvents: Map<number, DrinkEvent[]> = new Map();
  private elapsedTime = 0;
  /** Cached gold bar count per player, updated each frame */
  private goldBarCache: Map<number, number> = new Map();

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;

    // Prune old events outside the rolling window (in-place, events are chronological)
    const cutoff = this.elapsedTime - MORALE_WINDOW;
    for (const [playerId, events] of this.drinkEvents) {
      while (events.length > 0 && events[0].timestamp <= cutoff) {
        events.shift();
      }
      if (events.length === 0) {
        this.drinkEvents.delete(playerId);
      }
    }

    // Cache gold bar counts to avoid per-call building scans
    this.goldBarCache.clear();
    for (const building of this.gameState.getAllBuildings()) {
      if (building.state !== BuildingState.Active) continue;
      if (building.type !== BuildingType.Castle && building.type !== BuildingType.Warehouse) continue;
      const gold = getInventoryAmount(building.outputInventory, ResourceType.GoldBars);
      if (gold > 0) {
        this.goldBarCache.set(building.playerId, (this.goldBarCache.get(building.playerId) ?? 0) + gold);
      }
    }
  }

  /** Record a drink being served (call when InnTavern completes a production cycle) */
  recordDrinkServed(playerId: number, drinkType: ResourceType): void {
    const events = this.drinkEvents.get(playerId) ?? [];
    events.push({ drinkType, timestamp: this.elapsedTime });
    this.drinkEvents.set(playerId, events);
  }

  /** Get morale value for a player (0.0–1.0) */
  getMorale(playerId: number): number {
    const events = this.drinkEvents.get(playerId) ?? [];

    const drinkTypes = new Set(events.map(e => e.drinkType));
    const varietyBonus = Math.min(MORALE_VARIETY_BONUS_MAX, drinkTypes.size * MORALE_VARIETY_PER_TYPE);
    const volumeBonus = Math.min(MORALE_VOLUME_BONUS_MAX, events.length * MORALE_VOLUME_PER_DRINK);
    const goldBars = this.goldBarCache.get(playerId) ?? 0;
    const goldBonus = Math.min(MORALE_GOLD_BONUS_MAX, goldBars * MORALE_GOLD_BONUS_PER_BAR);

    return Math.min(1.0, MORALE_BASE + varietyBonus + volumeBonus + goldBonus);
  }

  /** Get production multiplier from morale (0.85–1.15) */
  getProductionMultiplier(playerId: number): number {
    return this.moraleToMultiplier(playerId);
  }

  /** Get combat multiplier from morale (0.85–1.15) */
  getCombatMultiplier(playerId: number): number {
    // Same formula as production for now; split when combat diverges
    return this.moraleToMultiplier(playerId);
  }

  private moraleToMultiplier(playerId: number): number {
    const morale = this.getMorale(playerId);
    return MORALE_MULTIPLIER_BASE + (morale - MORALE_BASE) * MORALE_MULTIPLIER_SCALE;
  }

  _getState(): { drinkEvents: [number, DrinkEvent[]][]; elapsedTime: number } {
    return {
      drinkEvents: Array.from(this.drinkEvents.entries()),
      elapsedTime: this.elapsedTime,
    };
  }

  _loadState(state: { drinkEvents: [number, { drinkType: string; timestamp: number }[]][]; elapsedTime: number }): void {
    this.drinkEvents = new Map(
      state.drinkEvents.map(([playerId, events]) => [
        playerId,
        events.map(e => ({ drinkType: e.drinkType as ResourceType, timestamp: e.timestamp })),
      ]),
    );
    this.elapsedTime = state.elapsedTime;
  }
}
