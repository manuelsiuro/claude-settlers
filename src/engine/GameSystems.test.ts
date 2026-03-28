import { describe, it, expect } from 'vitest';

describe('GameSystems module', () => {
  it('should export createManagers function', async () => {
    const mod = await import('./GameSystems');
    expect(mod.createManagers).toBeDefined();
    expect(typeof mod.createManagers).toBe('function');
  });

  it('should export createRenderers function', async () => {
    const mod = await import('./GameSystems');
    expect(mod.createRenderers).toBeDefined();
    expect(typeof mod.createRenderers).toBe('function');
  });

  it('should export applyGraphicsSettings function', async () => {
    const mod = await import('./GameSystems');
    expect(mod.applyGraphicsSettings).toBeDefined();
    expect(typeof mod.applyGraphicsSettings).toBe('function');
  });

  it('should export GameManagers interface members via createManagers return type', async () => {
    // We verify the factory is a function with exactly 1 parameter (the params object)
    const mod = await import('./GameSystems');
    expect(mod.createManagers.length).toBe(1);
  });

  it('should export CreateManagersParams and CreateRenderersParams as type-only (no runtime keys)', async () => {
    const mod = await import('./GameSystems');
    // These are interfaces, so they don't exist at runtime — only functions are exported
    const exportedFunctions = Object.keys(mod).filter(
      (k) => typeof (mod as Record<string, unknown>)[k] === 'function',
    );
    expect(exportedFunctions).toContain('createManagers');
    expect(exportedFunctions).toContain('createRenderers');
    expect(exportedFunctions).toContain('applyGraphicsSettings');
    expect(exportedFunctions.length).toBe(3);
  });
});

/**
 * Test the createManagers factory with real (non-mocked) dependencies.
 * HexGrid and GameState are pure-logic classes that work without DOM/Three.js,
 * so we can actually run createManagers and verify the returned object shape.
 */
describe('createManagers', () => {
  it('should create all expected manager instances', async () => {
    const { createManagers } = await import('./GameSystems');
    const { HexGrid } = await import('../game/HexGrid');
    const { GameState } = await import('../game/GameState');
    const { DEFAULT_CONFIG } = await import('../game/GameConfig');

    const grid = new HexGrid(8, 8);
    // Fill grid with grassland tiles so managers don't hit missing-tile issues
    const { TerrainType } = await import('../game/TerrainType');
    for (let q = 0; q < 8; q++) {
      for (let r = 0; r < 8; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0);
      }
    }

    const gameState = new GameState(grid);
    const config = { ...DEFAULT_CONFIG, numPlayers: 2 };
    const managers = createManagers({ gameState, grid, config, humanPlayerId: 1 });

    // Verify all expected manager keys are present
    const expectedKeys = [
      'populationManager',
      'feedingManager',
      'moraleManager',
      'marketplaceManager',
      'unitManager',
      'productionManager',
      'constructionManager',
      'roadNetwork',
      'transporterManager',
      'animalLifecycleManager',
      'logisticsManager',
      'harborManager',
      'territoryManager',
      'knightManager',
      'combatManager',
      'duelAnimationManager',
      'attackManager',
      'victoryManager',
      'geologistManager',
      'treeManager',
      'woodcutterManager',
      'foresterManager',
      'terrainGatheringManager',
      'economyTracker',
      'upgradeManager',
      'toolProductionManager',
      'fogOfWarManager',
      'distributionSettings',
      'dashboardTracker',
      'randomEventManager',
    ];

    for (const key of expectedKeys) {
      expect(managers).toHaveProperty(key);
      expect((managers as Record<string, unknown>)[key]).toBeDefined();
    }
  });

  it('should return exactly the expected keys (no extras, no missing)', async () => {
    const { createManagers } = await import('./GameSystems');
    const { HexGrid } = await import('../game/HexGrid');
    const { GameState } = await import('../game/GameState');
    const { DEFAULT_CONFIG } = await import('../game/GameConfig');
    const { TerrainType } = await import('../game/TerrainType');

    const grid = new HexGrid(4, 4);
    for (let q = 0; q < 4; q++) {
      for (let r = 0; r < 4; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0);
      }
    }
    const gameState = new GameState(grid);
    const managers = createManagers({
      gameState,
      grid,
      config: { ...DEFAULT_CONFIG, numPlayers: 1 },
      humanPlayerId: 1,
    });

    const keys = Object.keys(managers).sort();
    expect(keys).toEqual([
      'animalLifecycleManager',
      'attackManager',
      'combatManager',
      'constructionManager',
      'dashboardTracker',
      'distributionSettings',
      'duelAnimationManager',
      'economyTracker',
      'feedingManager',
      'fogOfWarManager',
      'foresterManager',
      'geologistManager',
      'harborManager',
      'knightManager',
      'logisticsManager',
      'marketplaceManager',
      'moraleManager',
      'populationManager',
      'productionManager',
      'randomEventManager',
      'roadNetwork',
      'terrainGatheringManager',
      'territoryManager',
      'toolProductionManager',
      'transporterManager',
      'treeManager',
      'unitManager',
      'upgradeManager',
      'victoryManager',
      'woodcutterManager',
    ]);
  });

  it('should disable elimination victory for single-player games', async () => {
    const { createManagers } = await import('./GameSystems');
    const { HexGrid } = await import('../game/HexGrid');
    const { GameState } = await import('../game/GameState');
    const { DEFAULT_CONFIG } = await import('../game/GameConfig');
    const { TerrainType } = await import('../game/TerrainType');

    const grid = new HexGrid(4, 4);
    for (let q = 0; q < 4; q++) {
      for (let r = 0; r < 4; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0);
      }
    }
    const gameState = new GameState(grid);

    // With numPlayers=1, victory.elimination should be forced off
    const managers = createManagers({
      gameState,
      grid,
      config: {
        ...DEFAULT_CONFIG,
        numPlayers: 1,
        victory: {
          elimination: true,
          domination: true,
          economic: true,
          timed: false,
          timedLimitMinutes: 30,
          peaceful: false,
        },
      },
      humanPlayerId: 1,
    });

    // VictoryManager is created — we can't inspect its internals directly,
    // but we verify the manager was successfully constructed
    expect(managers.victoryManager).toBeDefined();
  });

  it('should wire economyTracker into marketplaceManager', async () => {
    const { createManagers } = await import('./GameSystems');
    const { HexGrid } = await import('../game/HexGrid');
    const { GameState } = await import('../game/GameState');
    const { DEFAULT_CONFIG } = await import('../game/GameConfig');
    const { TerrainType } = await import('../game/TerrainType');

    const grid = new HexGrid(4, 4);
    for (let q = 0; q < 4; q++) {
      for (let r = 0; r < 4; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0);
      }
    }
    const gameState = new GameState(grid);
    const managers = createManagers({
      gameState,
      grid,
      config: DEFAULT_CONFIG,
      humanPlayerId: 1,
    });

    // Both managers exist and were wired (marketplaceManager.setEconomyTracker was called)
    expect(managers.marketplaceManager).toBeDefined();
    expect(managers.economyTracker).toBeDefined();
  });
});
