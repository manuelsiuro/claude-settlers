import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { MoraleManager } from './MoraleManager';
import { BuildingType } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { ResourceType } from './ResourceType';

describe('MoraleManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let moraleManager: MoraleManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    grid = new HexGrid(10, 10);
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    gameState = new GameState(grid);
    moraleManager = new MoraleManager(gameState);
  });

  it('should return base morale when no drinks served', () => {
    expect(moraleManager.getMorale(1)).toBe(0.50);
  });

  it('should increase morale from drink volume', () => {
    moraleManager.recordDrinkServed(1, ResourceType.Beer);
    moraleManager.recordDrinkServed(1, ResourceType.Beer);
    moraleManager.recordDrinkServed(1, ResourceType.Beer);
    moraleManager.update(0);

    const morale = moraleManager.getMorale(1);
    // Base 0.50 + variety(1 type = 0.10) + volume(3 drinks = 0.06)
    expect(morale).toBeCloseTo(0.66, 2);
  });

  it('should increase morale from drink variety', () => {
    moraleManager.recordDrinkServed(1, ResourceType.Beer);
    moraleManager.recordDrinkServed(1, ResourceType.Wine);
    moraleManager.update(0);

    const morale = moraleManager.getMorale(1);
    // Base 0.50 + variety(2 types = 0.20) + volume(2 drinks = 0.04)
    expect(morale).toBeCloseTo(0.74, 2);
  });

  it('should include gold bar bonus', () => {
    const result = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    if (!result.ok) throw new Error('Castle failed');
    result.building.state = BuildingState.Active;
    result.building.outputInventory[ResourceType.GoldBars] = 5;

    moraleManager.update(0); // Refresh gold bar cache
    const morale = moraleManager.getMorale(1);
    // Base 0.50 + gold(5 * 0.01 = 0.05)
    expect(morale).toBeCloseTo(0.55, 2);
  });

  it('should prune events outside window', () => {
    moraleManager.recordDrinkServed(1, ResourceType.Beer);
    moraleManager.update(301); // Beyond 5-minute window
    expect(moraleManager.getMorale(1)).toBe(0.50); // Back to base
  });

  it('should return production multiplier', () => {
    // At base morale (0.5), multiplier should be 0.85
    expect(moraleManager.getProductionMultiplier(1)).toBeCloseTo(0.85, 2);

    // Add drinks to boost morale
    moraleManager.recordDrinkServed(1, ResourceType.Beer);
    moraleManager.recordDrinkServed(1, ResourceType.Wine);
    moraleManager.update(0);
    const mult = moraleManager.getProductionMultiplier(1);
    expect(mult).toBeGreaterThan(0.85);
  });

  it('should return combat multiplier', () => {
    expect(moraleManager.getCombatMultiplier(1)).toBeCloseTo(0.85, 2);
  });

  it('should track different players independently', () => {
    moraleManager.recordDrinkServed(1, ResourceType.Beer);
    moraleManager.update(0);
    expect(moraleManager.getMorale(1)).toBeGreaterThan(0.50);
    expect(moraleManager.getMorale(2)).toBe(0.50);
  });

  it('should round-trip state', () => {
    moraleManager.recordDrinkServed(1, ResourceType.Beer);
    moraleManager.update(10);
    const state = moraleManager._getState();
    const mm2 = new MoraleManager(gameState);
    mm2._loadState(state);
    expect(mm2.getMorale(1)).toBeCloseTo(moraleManager.getMorale(1), 5);
  });
});
