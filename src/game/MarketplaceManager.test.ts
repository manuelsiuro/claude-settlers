import { describe, it, expect, afterEach } from 'vitest';
import { MarketplaceManager } from './MarketplaceManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState, addToInventory, resetBuildingIdCounter } from './Building';
import { ResourceType } from './ResourceType';
import { resetBalanceDefaults, applyBalanceOverrides } from './data/balanceConstants';

function createTestGrid(size = 20): HexGrid {
  const grid = new HexGrid(size, size);
  for (let q = 0; q < size; q++) {
    for (let r = 0; r < size; r++) {
      grid.setTile(q, r, TerrainType.Grassland, 0.5);
    }
  }
  return grid;
}

function createTestState(): { gameState: GameState; manager: MarketplaceManager } {
  resetBuildingIdCounter();
  const grid = createTestGrid();
  const gameState = new GameState(grid);

  // Place a Castle with resources
  const castleResult = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
  if (!castleResult.ok) throw new Error('Castle placement failed');
  castleResult.building.state = BuildingState.Active;
  addToInventory(castleResult.building.outputInventory, ResourceType.Wood, 50);
  addToInventory(castleResult.building.outputInventory, ResourceType.Stone, 30);
  addToInventory(castleResult.building.outputInventory, ResourceType.Fish, 20);
  addToInventory(castleResult.building.outputInventory, ResourceType.IronBars, 10);
  addToInventory(castleResult.building.outputInventory, ResourceType.Planks, 15);

  // Place a Market with a worker
  const marketResult = gameState.placeBuilding(BuildingType.Market, { q: 6, r: 5 }, 1);
  if (!marketResult.ok) throw new Error('Market placement failed');
  marketResult.building.state = BuildingState.Active;
  marketResult.building.hasWorker = true;

  const manager = new MarketplaceManager(gameState);

  // Run enough updates to trigger initial restock
  manager.update(61);

  return { gameState, manager };
}

describe('MarketplaceManager', () => {
  afterEach(() => resetBalanceDefaults());

  describe('previewTrade', () => {
    it('should calculate exchange rate based on base values', () => {
      const { manager } = createTestState();
      // Wood=2, IronBars=8, fee=10%
      // rate = 2/8 = 0.25, amount = floor(10 * 0.25 * 0.90) = floor(2.25) = 2
      const preview = manager.previewTrade(1, ResourceType.Wood, 10, ResourceType.IronBars, 'market');
      expect(preview.exchangeRate).toBeCloseTo(0.25, 2);
      expect(preview.fee).toBe(0.10);
      expect(preview.amountReceived).toBe(2);
    });

    it('should apply higher fee for castle trades', () => {
      const { manager } = createTestState();
      // Wood=2, IronBars=8, fee=25%
      // rate = 2/8 = 0.25, amount = floor(10 * 0.25 * 0.75) = floor(1.875) = 1
      const preview = manager.previewTrade(1, ResourceType.Wood, 10, ResourceType.IronBars, 'castle');
      expect(preview.fee).toBe(0.25);
      expect(preview.amountReceived).toBe(1);
    });

    it('should return 0 when trading same value resources at small quantity', () => {
      const { manager } = createTestState();
      // Wood=2, Stone=3, fee=10%
      // rate = 2/3 = 0.667, amount = floor(1 * 0.667 * 0.90) = floor(0.60) = 0
      const preview = manager.previewTrade(1, ResourceType.Wood, 1, ResourceType.Stone, 'market');
      expect(preview.amountReceived).toBe(0);
    });
  });

  describe('executeTrade', () => {
    it('should execute a valid market trade', () => {
      const { manager } = createTestState();
      // Find a resource the NPC actually has in stock
      const available = manager.getAvailableResources(1);
      expect(available.length).toBeGreaterThan(0);
      const buyResource = available[0];
      const result = manager.executeTrade(1, ResourceType.Wood, 20, buyResource, 'market');
      expect(result.success).toBe(true);
      expect(result.sold.resource).toBe(ResourceType.Wood);
      expect(result.received.resource).toBe(buyResource);
      expect(result.received.amount).toBeGreaterThan(0);
    });

    it('should fail without a market building', () => {
      resetBuildingIdCounter();
      const grid = createTestGrid();
      const gs = new GameState(grid);
      const castleRes = gs.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
      if (!castleRes.ok) throw new Error('Castle failed');
      castleRes.building.state = BuildingState.Active;
      addToInventory(castleRes.building.outputInventory, ResourceType.Wood, 50);

      const mgr = new MarketplaceManager(gs);
      const result = mgr.executeTrade(1, ResourceType.Wood, 5, ResourceType.Stone, 'market');
      expect(result.success).toBe(false);
      expect(result.error).toBe('no_market');
    });

    it('should fail without a worker at the market', () => {
      resetBuildingIdCounter();
      const grid = createTestGrid();
      const gs = new GameState(grid);
      const castleRes = gs.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
      if (!castleRes.ok) throw new Error('Castle failed');
      castleRes.building.state = BuildingState.Active;
      addToInventory(castleRes.building.outputInventory, ResourceType.Wood, 50);

      const marketRes = gs.placeBuilding(BuildingType.Market, { q: 6, r: 5 }, 1);
      if (!marketRes.ok) throw new Error('Market failed');
      marketRes.building.state = BuildingState.Active;
      marketRes.building.hasWorker = false;

      const mgr = new MarketplaceManager(gs);
      const result = mgr.executeTrade(1, ResourceType.Wood, 5, ResourceType.Stone, 'market');
      expect(result.success).toBe(false);
      expect(result.error).toBe('no_worker');
    });

    it('should fail if player has insufficient stock', () => {
      const { manager } = createTestState();
      const result = manager.executeTrade(1, ResourceType.GoldBars, 100, ResourceType.Wood, 'market');
      expect(result.success).toBe(false);
      expect(result.error).toBe('insufficient_stock');
    });

    it('should enforce trade cooldown', () => {
      const { manager } = createTestState();
      // Use castle trades to avoid NPC stock issues
      manager.executeTrade(1, ResourceType.Wood, 5, ResourceType.Stone, 'castle');
      const result2 = manager.executeTrade(1, ResourceType.Wood, 5, ResourceType.Stone, 'castle');
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('cooldown');
    });

    it('should allow trade after cooldown expires', () => {
      const { manager } = createTestState();
      manager.executeTrade(1, ResourceType.Wood, 5, ResourceType.Stone, 'castle');
      // Advance past castle cooldown (10s)
      manager.update(11);
      const result = manager.executeTrade(1, ResourceType.Wood, 5, ResourceType.Stone, 'castle');
      expect(result.error).not.toBe('cooldown');
    });

    it('should execute castle trades even without market', () => {
      resetBuildingIdCounter();
      const grid = createTestGrid();
      const gs = new GameState(grid);
      const castleRes = gs.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
      if (!castleRes.ok) throw new Error('Castle failed');
      castleRes.building.state = BuildingState.Active;
      addToInventory(castleRes.building.outputInventory, ResourceType.Wood, 50);

      const mgr = new MarketplaceManager(gs);
      // Castle trades don't check NPC stock
      const result = mgr.executeTrade(1, ResourceType.Wood, 5, ResourceType.Stone, 'castle');
      expect(result.success).toBe(true);
      expect(result.fee).toBe(0.25);
    });

    it('should fail castle trade when disabled', () => {
      applyBalanceOverrides({ marketplace: { castleTradeEnabled: false } });
      const { manager } = createTestState();
      const result = manager.executeTrade(1, ResourceType.Wood, 5, ResourceType.Stone, 'castle');
      expect(result.success).toBe(false);
      expect(result.error).toBe('disabled');
    });
  });

  describe('dynamic pricing', () => {
    it('should increase price multiplier when buying', () => {
      const { manager } = createTestState();
      const before = manager.getPriceMultiplier(1, ResourceType.Stone);
      // Castle trades always work (no NPC stock)
      manager.executeTrade(1, ResourceType.Wood, 10, ResourceType.Stone, 'castle');
      const after = manager.getPriceMultiplier(1, ResourceType.Stone);
      expect(after).toBeGreaterThan(before);
    });

    it('should decrease price multiplier when selling', () => {
      const { manager } = createTestState();
      const before = manager.getPriceMultiplier(1, ResourceType.Wood);
      manager.executeTrade(1, ResourceType.Wood, 10, ResourceType.Stone, 'castle');
      const after = manager.getPriceMultiplier(1, ResourceType.Wood);
      expect(after).toBeLessThan(before);
    });

    it('should decay prices toward 1.0 over time', () => {
      const { manager } = createTestState();
      manager.executeTrade(1, ResourceType.Wood, 10, ResourceType.Stone, 'castle');
      const shifted = manager.getPriceMultiplier(1, ResourceType.Wood);
      expect(shifted).toBeLessThan(1.0);

      // Advance time to decay
      manager.update(200);
      const decayed = manager.getPriceMultiplier(1, ResourceType.Wood);
      expect(decayed).toBeGreaterThan(shifted);
      expect(decayed).toBeLessThanOrEqual(1.0);
    });
  });

  describe('NPC stock', () => {
    it('should have available resources after restock', () => {
      const { manager } = createTestState();
      const available = manager.getAvailableResources(1);
      expect(available.length).toBeGreaterThan(0);
      expect(available.length).toBeLessThanOrEqual(12);
    });

    it('should deplete stock when player buys', () => {
      const { manager } = createTestState();
      const available = manager.getAvailableResources(1);
      if (available.length > 0) {
        const res = available[0];
        const stockBefore = manager.getNPCStock(1, res);
        if (stockBefore > 0) {
          manager.executeTrade(1, ResourceType.Wood, 20, res, 'market');
          const stockAfter = manager.getNPCStock(1, res);
          expect(stockAfter).toBeLessThan(stockBefore);
        }
      }
    });
  });

  describe('traveling merchant', () => {
    it('should spawn merchant after visit interval', () => {
      const { manager } = createTestState();
      expect(manager.getMerchant(1)).toBeNull();

      // Advance past merchant interval (300s) — minus the 61s already elapsed
      manager.update(240);
      const merchant = manager.getMerchant(1);
      expect(merchant).not.toBeNull();
      expect(merchant!.active).toBe(true);
      expect(merchant!.deals.length).toBeGreaterThan(0);
    });

    it('should expire merchant after duration', () => {
      const { manager } = createTestState();
      manager.update(240); // Trigger merchant (at ~301s total)
      expect(manager.getMerchant(1)).not.toBeNull();

      // Advance past duration (60s)
      manager.update(61);
      expect(manager.getMerchant(1)).toBeNull();
    });
  });

  describe('auto-trade rules', () => {
    it('should add and retrieve rules', () => {
      const { manager } = createTestState();
      const added = manager.addAutoTradeRule(1, {
        resource: ResourceType.Fish,
        action: 'buy',
        threshold: 10,
        maxAmount: 5,
        exchangeResource: ResourceType.Wood,
        enabled: true,
      });
      expect(added).toBe(true);
      expect(manager.getAutoTradeRules(1)).toHaveLength(1);
    });

    it('should enforce max rules limit', () => {
      const { manager } = createTestState();
      for (let i = 0; i < 8; i++) {
        manager.addAutoTradeRule(1, {
          resource: ResourceType.Wood,
          action: 'sell',
          threshold: 50,
          maxAmount: 10,
          exchangeResource: ResourceType.Stone,
          enabled: true,
        });
      }
      const result = manager.addAutoTradeRule(1, {
        resource: ResourceType.Fish,
        action: 'buy',
        threshold: 5,
        maxAmount: 3,
        exchangeResource: ResourceType.Wood,
        enabled: true,
      });
      expect(result).toBe(false);
      expect(manager.getAutoTradeRules(1)).toHaveLength(8);
    });

    it('should remove rules by index', () => {
      const { manager } = createTestState();
      manager.addAutoTradeRule(1, {
        resource: ResourceType.Fish,
        action: 'buy',
        threshold: 10,
        maxAmount: 5,
        exchangeResource: ResourceType.Wood,
        enabled: true,
      });
      manager.removeAutoTradeRule(1, 0);
      expect(manager.getAutoTradeRules(1)).toHaveLength(0);
    });
  });

  describe('save/load', () => {
    it('should round-trip state through save/load', () => {
      const { manager, gameState } = createTestState();
      // Use castle trades (no NPC stock dependency)
      manager.executeTrade(1, ResourceType.Wood, 10, ResourceType.Stone, 'castle');
      manager.addAutoTradeRule(1, {
        resource: ResourceType.Fish,
        action: 'buy',
        threshold: 10,
        maxAmount: 5,
        exchangeResource: ResourceType.Wood,
        enabled: true,
      });

      const state = manager._getState();
      expect(state.version).toBe(1);

      const manager2 = new MarketplaceManager(gameState);
      manager2._loadState(state);

      expect(manager2.getAutoTradeRules(1)).toHaveLength(1);
      // Price multipliers should be preserved
      const woodPrice = manager2.getPriceMultiplier(1, ResourceType.Wood);
      expect(woodPrice).toBeLessThan(1.0);
    });
  });

  describe('getExchangeRate', () => {
    it('should return rate after fee deduction', () => {
      const { manager } = createTestState();
      // Wood=2, Stone=3, fee=10%
      // rate = (2/3) * 0.90 = 0.60
      const rate = manager.getExchangeRate(1, ResourceType.Wood, ResourceType.Stone, 'market');
      expect(rate).toBeCloseTo(0.60, 2);
    });
  });

  describe('base values', () => {
    it('should return known base values', () => {
      const { manager } = createTestState();
      expect(manager.getBaseValue(ResourceType.Wood)).toBe(2);
      expect(manager.getBaseValue(ResourceType.SiegeRam)).toBe(20);
      expect(manager.getBaseValue(ResourceType.GoldBars)).toBe(15);
    });
  });
});
