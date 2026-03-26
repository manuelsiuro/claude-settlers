import type { GameState } from '../GameState';
import { BuildingType } from '../BuildingType';
import { BuildingState, getInventoryAmount, addToInventory, removeFromInventory } from '../Building';
import type { Building } from '../Building';
import { ResourceType } from '../ResourceType';
import {
  MARKETPLACE_FEE,
  MARKETPLACE_TRADE_COOLDOWN,
  MARKETPLACE_MAX_TRADE_SIZE,
  MARKETPLACE_RESTOCK_INTERVAL,
  MARKETPLACE_NPC_STOCK_MIN,
  MARKETPLACE_NPC_STOCK_MAX,
  MARKETPLACE_OFFERED_RESOURCE_COUNT,
  MARKETPLACE_SCARCITY_BONUS,
  CASTLE_TRADE_FEE,
  CASTLE_TRADE_COOLDOWN,
  CASTLE_TRADE_MAX_SIZE,
  CASTLE_TRADE_ENABLED,
  MERCHANT_VISIT_INTERVAL,
  AUTOTRADE_CHECK_INTERVAL,
  AUTOTRADE_MAX_RULES,
} from '../data/balanceConstants';

import type {
  NPCStock,
  TravelingMerchant,
  AutoTradeRule,
  TradeResult,
  TradePreview,
  TradeEvent,
  MarketplaceState,
} from './types';
import { ALL_TRADEABLE } from './types';

import {
  decayPrices,
  applyPriceShift,
  getPriceMultiplier as getPriceMultiplierFn,
  getBaseValue as getBaseValueFn,
  getExchangeRate as getExchangeRateFn,
  previewTrade as previewTradeFn,
} from './PriceEngine';

import {
  seededRandom,
  spawnMerchant as spawnMerchantFn,
  expireMerchants as expireMerchantsFn,
} from './TravelingMerchantEngine';

import { evaluateAutoTradeRule } from './AutoTradeEvaluator';

// ── Manager ──────────────────────────────────────────────────────────────

/**
 * MarketplaceManager: barter-based resource trading with NPC merchants.
 * Dynamic supply/demand pricing, traveling merchants with special deals,
 * auto-trade rules, and Castle fallback trading.
 */
export class MarketplaceManager {
  private gameState: GameState;

  /** Dynamic price multipliers: playerId -> resource -> multiplier */
  private priceMultipliers: Map<number, Map<ResourceType, number>> = new Map();

  /** NPC virtual stock: playerId -> resource -> stock info */
  private npcStock: Map<number, Map<ResourceType, NPCStock>> = new Map();

  /** Auto-trade rules: playerId -> rules */
  private autoTradeRules: Map<number, AutoTradeRule[]> = new Map();

  /** Traveling merchant: playerId -> merchant state */
  private travelingMerchant: Map<number, TravelingMerchant> = new Map();

  /** Trade history (rolling window): playerId -> events */
  private tradeHistory: Map<number, TradeEvent[]> = new Map();

  /** Last trade timestamp per venue: playerId -> venue -> time */
  private lastTradeTime: Map<number, Map<string, number>> = new Map();

  /** Timers */
  private restockTimer = 0;
  private merchantTimer = 0;
  private autoTradeTimer = 0;
  private elapsedTime = 0;

  /** Max events kept in trade history */
  private static readonly MAX_HISTORY = 200;
  /** Trade history rolling window (seconds) */
  private static readonly HISTORY_WINDOW = 300;

  /** Callback fired when a traveling merchant arrives for a player */
  onMerchantArrival: ((playerId: number) => void) | null = null;

  /** Economy tracker for recording trades as production/consumption events */
  private economyTracker: { recordProduction(r: ResourceType, a?: number): void; recordConsumption(r: ResourceType, a?: number): void } | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /** Set economy tracker for trade event recording in dashboard charts. */
  setEconomyTracker(tracker: { recordProduction(r: ResourceType, a?: number): void; recordConsumption(r: ResourceType, a?: number): void }): void {
    this.economyTracker = tracker;
  }

  // ── Update loop ──────────────────────────────────────────────────────

  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;

    // Decay prices toward 1.0
    decayPrices(this.priceMultipliers, deltaTime);

    // Restock NPC
    this.restockTimer += deltaTime;
    if (this.restockTimer >= MARKETPLACE_RESTOCK_INTERVAL) {
      this.restockTimer -= MARKETPLACE_RESTOCK_INTERVAL;
      this.restockAllPlayers();
    }

    // Traveling merchant
    this.merchantTimer += deltaTime;
    if (this.merchantTimer >= MERCHANT_VISIT_INTERVAL) {
      this.merchantTimer -= MERCHANT_VISIT_INTERVAL;
      this.spawnMerchantsForAllPlayers();
    }
    expireMerchantsFn(this.travelingMerchant, this.elapsedTime);

    // Auto-trade
    this.autoTradeTimer += deltaTime;
    if (this.autoTradeTimer >= AUTOTRADE_CHECK_INTERVAL) {
      this.autoTradeTimer -= AUTOTRADE_CHECK_INTERVAL;
      this.evaluateAllAutoTrades();
    }

    // Prune old trade history
    this.pruneTradeHistory();
  }

  // ── Trading ──────────────────────────────────────────────────────────

  /** Execute a manual barter trade. */
  executeTrade(
    playerId: number,
    sellResource: ResourceType,
    sellAmount: number,
    buyResource: ResourceType,
    venue: 'market' | 'castle',
  ): TradeResult {
    const empty: TradeResult = {
      success: false,
      sold: { resource: sellResource, amount: 0 },
      received: { resource: buyResource, amount: 0 },
      fee: 0,
      priceShift: 0,
    };

    // Venue checks
    if (venue === 'castle') {
      if (!CASTLE_TRADE_ENABLED) return { ...empty, error: 'disabled' };
      if (this.isOnCooldown(playerId, 'castle')) return { ...empty, error: 'cooldown' };
      if (sellAmount > CASTLE_TRADE_MAX_SIZE) sellAmount = CASTLE_TRADE_MAX_SIZE;
    } else {
      const market = this.findMarketBuilding(playerId);
      if (!market) return { ...empty, error: 'no_market' };
      if (!market.hasWorker) return { ...empty, error: 'no_worker' };
      if (this.isOnCooldown(playerId, 'market')) return { ...empty, error: 'cooldown' };
      if (sellAmount > MARKETPLACE_MAX_TRADE_SIZE) sellAmount = MARKETPLACE_MAX_TRADE_SIZE;
    }

    // Check player has enough to sell
    const playerStock = this.getPlayerStockOf(playerId, sellResource);
    if (playerStock < sellAmount) {
      return { ...empty, error: 'insufficient_stock' };
    }

    // Check NPC has stock to sell (only for market venue)
    if (venue === 'market') {
      const npc = this.getNPCStock(playerId, buyResource);
      if (npc <= 0) return { ...empty, error: 'npc_out_of_stock' };
    }

    // Calculate trade
    const fee = venue === 'castle' ? CASTLE_TRADE_FEE : MARKETPLACE_FEE;
    const preview = this.previewTrade(playerId, sellResource, sellAmount, buyResource, venue);
    if (preview.amountReceived <= 0) return { ...empty, error: 'zero_result' };

    // Cap by NPC stock for market venue
    let received = preview.amountReceived;
    if (venue === 'market') {
      const npcAvailable = this.getNPCStock(playerId, buyResource);
      received = Math.min(received, npcAvailable);
      if (received <= 0) return { ...empty, error: 'npc_out_of_stock' };
    }

    // Recalculate sell amount needed for the received quantity (if capped by NPC stock)
    let actualSellAmount = sellAmount;
    if (received < preview.amountReceived && preview.amountReceived > 0) {
      // Proportionally reduce sell amount
      actualSellAmount = Math.ceil(sellAmount * (received / preview.amountReceived));
    }

    // Execute: remove sold resources from storage
    this.removePlayerStock(playerId, sellResource, actualSellAmount);

    // Execute: add received resources to market/castle output
    this.addPlayerStock(playerId, buyResource, received, venue);

    // Update NPC stock (market only)
    if (venue === 'market') {
      this.adjustNPCStock(playerId, buyResource, -received);
    }

    // Record in economy tracker for dashboard charts
    if (this.economyTracker) {
      this.economyTracker.recordConsumption(sellResource, actualSellAmount);
      this.economyTracker.recordProduction(buyResource, received);
    }

    // Update dynamic pricing
    const priceMap = this.getOrCreatePriceMap(playerId);
    const priceShift = applyPriceShift(priceMap, sellResource, actualSellAmount, buyResource, received);

    // Set cooldown
    this.setTradeCooldown(playerId, venue);

    // Record history
    const event: TradeEvent = {
      timestamp: this.elapsedTime,
      sold: { resource: sellResource, amount: actualSellAmount },
      received: { resource: buyResource, amount: received },
      venue,
    };
    this.recordTradeEvent(playerId, event);

    return {
      success: true,
      sold: { resource: sellResource, amount: actualSellAmount },
      received: { resource: buyResource, amount: received },
      fee,
      priceShift,
    };
  }

  /** Accept a traveling merchant deal. */
  acceptDeal(playerId: number, dealId: string): TradeResult {
    const merchant = this.travelingMerchant.get(playerId);
    const empty: TradeResult = {
      success: false,
      sold: { resource: ResourceType.Wood, amount: 0 },
      received: { resource: ResourceType.Wood, amount: 0 },
      fee: 0,
      priceShift: 0,
    };

    if (!merchant?.active) return { ...empty, error: 'no_market' };

    const deal = merchant.deals.find(d => d.id === dealId);
    if (!deal || deal.remaining <= 0) return { ...empty, error: 'npc_out_of_stock' };

    // Check player has the cost resource
    const available = this.getPlayerStockOf(playerId, deal.costResource);
    if (available < deal.costAmount) return { ...empty, error: 'insufficient_stock' };

    // Execute
    this.removePlayerStock(playerId, deal.costResource, deal.costAmount);
    this.addPlayerStock(playerId, deal.offerResource, deal.offerAmount, 'market');
    deal.remaining--;

    // Record in economy tracker
    if (this.economyTracker) {
      this.economyTracker.recordConsumption(deal.costResource, deal.costAmount);
      this.economyTracker.recordProduction(deal.offerResource, deal.offerAmount);
    }

    const event: TradeEvent = {
      timestamp: this.elapsedTime,
      sold: { resource: deal.costResource, amount: deal.costAmount },
      received: { resource: deal.offerResource, amount: deal.offerAmount },
      venue: 'merchant',
    };
    this.recordTradeEvent(playerId, event);

    return {
      success: true,
      sold: { resource: deal.costResource, amount: deal.costAmount },
      received: { resource: deal.offerResource, amount: deal.offerAmount },
      fee: 0,
      priceShift: 0,
    };
  }

  // ── Previews & Queries ───────────────────────────────────────────────

  /** Preview a trade: how much would the player receive? */
  previewTrade(
    playerId: number,
    sellResource: ResourceType,
    sellAmount: number,
    buyResource: ResourceType,
    venue: 'market' | 'castle',
  ): TradePreview {
    return previewTradeFn(this.priceMultipliers, playerId, sellResource, sellAmount, buyResource, venue);
  }

  /** Get the exchange rate between two resources (sell->buy). */
  getExchangeRate(
    playerId: number,
    sellResource: ResourceType,
    buyResource: ResourceType,
    venue: 'market' | 'castle',
  ): number {
    return getExchangeRateFn(this.priceMultipliers, playerId, sellResource, buyResource, venue);
  }

  /** Get the dynamic price multiplier for a resource. */
  getPriceMultiplier(playerId: number, resource: ResourceType): number {
    return getPriceMultiplierFn(this.priceMultipliers, playerId, resource);
  }

  /** Get current NPC stock for a resource. */
  getNPCStock(playerId: number, resource: ResourceType): number {
    return this.npcStock.get(playerId)?.get(resource)?.available ?? 0;
  }

  /** Get all resources the NPC currently offers. */
  getAvailableResources(playerId: number): ResourceType[] {
    const stock = this.npcStock.get(playerId);
    if (!stock) return [];
    const result: ResourceType[] = [];
    for (const [res, info] of stock) {
      if (info.offered && info.available > 0) result.push(res);
    }
    return result;
  }

  /** Get the traveling merchant state. */
  getMerchant(playerId: number): TravelingMerchant | null {
    const m = this.travelingMerchant.get(playerId);
    return m?.active ? m : null;
  }

  /** Get the base trade value for a resource. */
  getBaseValue(resource: ResourceType): number {
    return getBaseValueFn(resource);
  }

  /** Get recent trade history for a player. */
  getTradeHistory(playerId: number): TradeEvent[] {
    return this.tradeHistory.get(playerId) ?? [];
  }

  /** Check if a trade venue is on cooldown. */
  isOnCooldown(playerId: number, venue: 'market' | 'castle'): boolean {
    const lastTime = this.lastTradeTime.get(playerId)?.get(venue) ?? -Infinity;
    const cooldown = venue === 'castle' ? CASTLE_TRADE_COOLDOWN : MARKETPLACE_TRADE_COOLDOWN;
    return this.elapsedTime - lastTime < cooldown;
  }

  /** Get remaining cooldown seconds. */
  getCooldownRemaining(playerId: number, venue: 'market' | 'castle'): number {
    const lastTime = this.lastTradeTime.get(playerId)?.get(venue) ?? -Infinity;
    const cooldown = venue === 'castle' ? CASTLE_TRADE_COOLDOWN : MARKETPLACE_TRADE_COOLDOWN;
    return Math.max(0, cooldown - (this.elapsedTime - lastTime));
  }

  // ── Auto-Trade Rules ─────────────────────────────────────────────────

  addAutoTradeRule(playerId: number, rule: AutoTradeRule): boolean {
    const rules = this.autoTradeRules.get(playerId) ?? [];
    if (rules.length >= AUTOTRADE_MAX_RULES) return false;
    rules.push(rule);
    this.autoTradeRules.set(playerId, rules);
    return true;
  }

  removeAutoTradeRule(playerId: number, index: number): void {
    const rules = this.autoTradeRules.get(playerId);
    if (rules && index >= 0 && index < rules.length) {
      rules.splice(index, 1);
    }
  }

  updateAutoTradeRule(playerId: number, index: number, updates: Partial<AutoTradeRule>): void {
    const rules = this.autoTradeRules.get(playerId);
    if (rules && index >= 0 && index < rules.length) {
      Object.assign(rules[index], updates);
    }
  }

  getAutoTradeRules(playerId: number): AutoTradeRule[] {
    return this.autoTradeRules.get(playerId) ?? [];
  }

  // ── Save/Load ────────────────────────────────────────────────────────

  _getState(): MarketplaceState {
    const priceMultipliers: Record<number, Record<string, number>> = {};
    for (const [pid, map] of this.priceMultipliers) {
      priceMultipliers[pid] = Object.fromEntries(map);
    }

    const npcStock: Record<number, Record<string, NPCStock>> = {};
    for (const [pid, map] of this.npcStock) {
      npcStock[pid] = Object.fromEntries(map);
    }

    const autoTradeRules: Record<number, AutoTradeRule[]> = {};
    for (const [pid, rules] of this.autoTradeRules) {
      autoTradeRules[pid] = rules;
    }

    const travelingMerchant: Record<number, TravelingMerchant> = {};
    for (const [pid, m] of this.travelingMerchant) {
      travelingMerchant[pid] = m;
    }

    const tradeHistory: Record<number, TradeEvent[]> = {};
    for (const [pid, events] of this.tradeHistory) {
      tradeHistory[pid] = events;
    }

    const lastTradeTime: Record<number, Record<string, number>> = {};
    for (const [pid, map] of this.lastTradeTime) {
      lastTradeTime[pid] = Object.fromEntries(map);
    }

    return {
      version: 1,
      priceMultipliers,
      npcStock,
      autoTradeRules,
      travelingMerchant,
      tradeHistory,
      restockTimer: this.restockTimer,
      merchantTimer: this.merchantTimer,
      autoTradeTimer: this.autoTradeTimer,
      elapsedTime: this.elapsedTime,
      lastTradeTime,
    };
  }

  _loadState(state: MarketplaceState): void {
    this.priceMultipliers.clear();
    for (const [pid, rec] of Object.entries(state.priceMultipliers)) {
      this.priceMultipliers.set(Number(pid), new Map(Object.entries(rec) as [ResourceType, number][]));
    }

    this.npcStock.clear();
    for (const [pid, rec] of Object.entries(state.npcStock)) {
      this.npcStock.set(Number(pid), new Map(Object.entries(rec) as [ResourceType, NPCStock][]));
    }

    this.autoTradeRules.clear();
    for (const [pid, rules] of Object.entries(state.autoTradeRules)) {
      this.autoTradeRules.set(Number(pid), rules as AutoTradeRule[]);
    }

    this.travelingMerchant.clear();
    for (const [pid, m] of Object.entries(state.travelingMerchant)) {
      this.travelingMerchant.set(Number(pid), m as TravelingMerchant);
    }

    this.tradeHistory.clear();
    for (const [pid, events] of Object.entries(state.tradeHistory)) {
      this.tradeHistory.set(Number(pid), events as TradeEvent[]);
    }

    this.lastTradeTime.clear();
    if (state.lastTradeTime) {
      for (const [pid, rec] of Object.entries(state.lastTradeTime)) {
        this.lastTradeTime.set(Number(pid), new Map(Object.entries(rec)));
      }
    }

    this.restockTimer = state.restockTimer;
    this.merchantTimer = state.merchantTimer;
    this.autoTradeTimer = state.autoTradeTimer;
    this.elapsedTime = state.elapsedTime;
  }

  // ── Private: NPC Stock ───────────────────────────────────────────────

  private restockAllPlayers(): void {
    const playerIds = new Set<number>();
    for (const b of this.gameState.getAllBuildings()) {
      playerIds.add(b.playerId);
    }
    for (const pid of playerIds) {
      this.restockNPC(pid);
    }
  }

  private restockNPC(playerId: number): void {
    const rand = seededRandom(Math.floor(this.elapsedTime * 1000 + playerId * 7919));
    const playerStocks = this.getPlayerStocks(playerId);
    const stockMap = this.npcStock.get(playerId) ?? new Map<ResourceType, NPCStock>();

    // Score resources: prefer ones the player lacks or can't produce
    const scored: { resource: ResourceType; score: number }[] = [];
    for (const resource of ALL_TRADEABLE) {
      const playerAmount = playerStocks.get(resource) ?? 0;
      let score = rand();

      // Scarcity bonus
      if (playerAmount <= 2) score += MARKETPLACE_SCARCITY_BONUS;
      // Always offer resources player has zero of
      if (playerAmount === 0) score += 0.5;

      scored.push({ resource, score });
    }

    // Sort by score descending, pick top N
    scored.sort((a, b) => b.score - a.score);
    const offered = new Set(
      scored.slice(0, MARKETPLACE_OFFERED_RESOURCE_COUNT).map(s => s.resource),
    );

    // Update stock
    for (const resource of ALL_TRADEABLE) {
      const isOffered = offered.has(resource);
      const maxStock = isOffered
        ? MARKETPLACE_NPC_STOCK_MIN + Math.floor(rand() * (MARKETPLACE_NPC_STOCK_MAX - MARKETPLACE_NPC_STOCK_MIN + 1))
        : 0;

      stockMap.set(resource, {
        available: maxStock,
        maxStock,
        offered: isOffered,
      });
    }

    this.npcStock.set(playerId, stockMap);
  }

  private adjustNPCStock(playerId: number, resource: ResourceType, delta: number): void {
    const stockMap = this.npcStock.get(playerId);
    if (!stockMap) return;
    const stock = stockMap.get(resource);
    if (!stock) return;
    stock.available = Math.max(0, stock.available + delta);
  }

  // ── Private: Traveling Merchant ──────────────────────────────────────

  private spawnMerchantsForAllPlayers(): void {
    const playerIds = new Set<number>();
    for (const b of this.gameState.getAllBuildings()) {
      if (b.type === BuildingType.Market && b.state === BuildingState.Active) {
        playerIds.add(b.playerId);
      }
    }
    for (const pid of playerIds) {
      const merchant = spawnMerchantFn(pid, this.elapsedTime);
      this.travelingMerchant.set(pid, merchant);
      if (merchant.deals.length > 0) {
        this.onMerchantArrival?.(pid);
      }
    }
  }

  // ── Private: Auto-Trade ──────────────────────────────────────────────

  private evaluateAllAutoTrades(): void {
    for (const [playerId, rules] of this.autoTradeRules) {
      if (!this.findMarketBuilding(playerId)) continue;
      for (const rule of rules) {
        const currentStock = this.getPlayerStockOf(playerId, rule.resource);
        const request = evaluateAutoTradeRule(rule, currentStock);
        if (request) {
          this.executeTrade(
            playerId,
            request.sellResource as ResourceType,
            request.sellAmount,
            request.buyResource as ResourceType,
            'market',
          );
        }
      }
    }
  }

  // ── Private: Trade History ───────────────────────────────────────────

  private recordTradeEvent(playerId: number, event: TradeEvent): void {
    const events = this.tradeHistory.get(playerId) ?? [];
    events.push(event);
    if (events.length > MarketplaceManager.MAX_HISTORY) {
      events.splice(0, events.length - MarketplaceManager.MAX_HISTORY);
    }
    this.tradeHistory.set(playerId, events);
  }

  private pruneTradeHistory(): void {
    const cutoff = this.elapsedTime - MarketplaceManager.HISTORY_WINDOW;
    for (const [, events] of this.tradeHistory) {
      while (events.length > 0 && events[0].timestamp < cutoff) {
        events.shift();
      }
    }
  }

  // ── Private: Cooldown ────────────────────────────────────────────────

  private setTradeCooldown(playerId: number, venue: string): void {
    let map = this.lastTradeTime.get(playerId);
    if (!map) {
      map = new Map();
      this.lastTradeTime.set(playerId, map);
    }
    map.set(venue, this.elapsedTime);
  }

  // ── Private: Price Map ───────────────────────────────────────────────

  private getOrCreatePriceMap(playerId: number): Map<ResourceType, number> {
    let map = this.priceMultipliers.get(playerId);
    if (!map) {
      map = new Map();
      this.priceMultipliers.set(playerId, map);
    }
    return map;
  }

  // ── Private: Player Stock Access ─────────────────────────────────────

  /** Find the first active Market building for a player. */
  private findMarketBuilding(playerId: number): Building | null {
    for (const b of this.gameState.getAllBuildings()) {
      if (b.playerId === playerId && b.type === BuildingType.Market && b.state === BuildingState.Active) {
        return b;
      }
    }
    return null;
  }

  /** Get total stock of a resource across player's Castle/Warehouse buildings. */
  private getPlayerStockOf(playerId: number, resource: ResourceType): number {
    let total = 0;
    for (const b of this.gameState.getAllBuildings()) {
      if (b.playerId !== playerId) continue;
      if (b.state !== BuildingState.Active) continue;
      if (b.type !== BuildingType.Castle && b.type !== BuildingType.Warehouse) continue;
      total += getInventoryAmount(b.outputInventory, resource);
    }
    return total;
  }

  /** Get total stock of all resources across player's Castle/Warehouse buildings. */
  private getPlayerStocks(playerId: number): Map<ResourceType, number> {
    const stocks = new Map<ResourceType, number>();
    for (const b of this.gameState.getAllBuildings()) {
      if (b.playerId !== playerId) continue;
      if (b.state !== BuildingState.Active) continue;
      if (b.type !== BuildingType.Castle && b.type !== BuildingType.Warehouse) continue;
      for (const [res, amount] of Object.entries(b.outputInventory)) {
        if (amount && amount > 0) {
          const r = res as ResourceType;
          stocks.set(r, (stocks.get(r) ?? 0) + amount);
        }
      }
    }
    return stocks;
  }

  /** Remove resources from player's Castle/Warehouse (takes from first available). */
  private removePlayerStock(playerId: number, resource: ResourceType, amount: number): void {
    let remaining = amount;
    for (const b of this.gameState.getAllBuildings()) {
      if (remaining <= 0) break;
      if (b.playerId !== playerId) continue;
      if (b.state !== BuildingState.Active) continue;
      if (b.type !== BuildingType.Castle && b.type !== BuildingType.Warehouse) continue;
      const removed = removeFromInventory(b.outputInventory, resource, remaining);
      remaining -= removed;
    }
  }

  /** Add resources to a building's output inventory. Market venue -> Market building, Castle venue -> Castle. */
  private addPlayerStock(playerId: number, resource: ResourceType, amount: number, venue: 'market' | 'castle' | 'merchant'): void {
    let target: Building | null = null;
    if (venue === 'market' || venue === 'merchant') {
      target = this.findMarketBuilding(playerId);
    }
    if (!target) {
      // Fallback to Castle
      for (const b of this.gameState.getAllBuildings()) {
        if (b.playerId === playerId && b.type === BuildingType.Castle && b.state === BuildingState.Active) {
          target = b;
          break;
        }
      }
    }
    if (target) {
      addToInventory(target.outputInventory, resource, amount);
    }
  }
}
