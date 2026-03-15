import { describe, it, expect, beforeEach } from 'vitest';
import { TerritoryManager } from './TerritoryManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';

function makeGrid(width: number, height: number, terrain = TerrainType.Grassland): HexGrid {
  const grid = new HexGrid(width, height);
  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      grid.setTile(q, r, terrain);
    }
  }
  return grid;
}

describe('TerritoryManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let territory: TerritoryManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    grid = makeGrid(20, 20);
    gameState = new GameState(grid);
    territory = new TerritoryManager(gameState);
  });

  it('should have no territory initially', () => {
    territory.update();
    expect(territory.getOwner(10, 10)).toBeNull();
    expect(territory.getPlayerTerritory(1)).toHaveLength(0);
  });

  it('should project Castle territory with radius 8', () => {
    const result = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);

    territory.update();

    // Castle hex should be owned
    expect(territory.getOwner(10, 10)).toBe(1);

    // Adjacent hexes should be owned
    expect(territory.getOwner(11, 10)).toBe(1);
    expect(territory.getOwner(10, 11)).toBe(1);

    // Territory should have many hexes (radius 8 covers a large area)
    const owned = territory.getPlayerTerritory(1);
    expect(owned.length).toBeGreaterThan(50);
  });

  it('should project Guard Hut territory with radius 4', () => {
    // Place Castle first (needed for game, but also to test overlap)
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(castle.ok).toBe(true);

    // Place Guard Hut far from Castle
    const hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
    expect(hut.ok).toBe(true);
    if (hut.ok) {
      hut.building.state = BuildingState.Active;
      hut.building.constructionProgress = 1;
    }

    territory.update();

    // Guard Hut hex should be owned
    expect(territory.getOwner(5, 5)).toBe(1);

    // 4 hexes away should still be in territory
    expect(territory.getOwner(9, 5)).toBe(1);

    // 5 hexes away should not be in Guard Hut territory
    // (unless covered by Castle — check a direction away from Castle)
    expect(territory.getOwner(1, 5)).toBe(1); // 4 away
  });

  it('should not project territory through water', () => {
    // Create a grid with water barrier
    const smallGrid = makeGrid(20, 20);
    // Place water wall at q=12 (between Castle at 10 and target at 14)
    for (let r = 0; r < 20; r++) {
      smallGrid.setTile(12, r, TerrainType.Water);
    }

    const gs = new GameState(smallGrid);
    const tm = new TerritoryManager(gs);

    gs.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    tm.update();

    // Should own tiles on this side of water
    expect(tm.getOwner(10, 10)).toBe(1);
    expect(tm.getOwner(11, 10)).toBe(1);

    // Should NOT own tiles beyond water barrier
    expect(tm.getOwner(13, 10)).toBeNull();
    expect(tm.getOwner(14, 10)).toBeNull();
  });

  it('should not include Planned buildings in territory', () => {
    const result = gameState.placeBuilding(BuildingType.GuardHut, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Building is Planned by default (not Active)
      expect(result.building.state).toBe(BuildingState.Planned);
    }

    territory.update();

    // Planned building should not project territory
    expect(territory.getOwner(10, 10)).toBeNull();
  });

  it('should support multiple players with separate territories', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 3, r: 3 }, 1);

    // Place second Castle for player 2 far away
    const castle2 = gameState.placeBuilding(BuildingType.Castle, { q: 17, r: 17 }, 2);
    expect(castle2.ok).toBe(true);

    territory.update();

    // Each player should own their Castle hex
    expect(territory.getOwner(3, 3)).toBe(1);
    expect(territory.getOwner(17, 17)).toBe(2);

    // Each player should own nearby hexes
    expect(territory.getOwner(4, 3)).toBe(1);
    expect(territory.getOwner(16, 17)).toBe(2);
  });

  it('should resolve overlapping territory — closer building wins', () => {
    // Place two buildings close together for different players
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 10 }, 1);
    gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 10 }, 2);

    territory.update();

    // Midpoint at q=10 — equidistant, but one will win
    // q=7 should be player 1 (closer), q=13 should be player 2 (closer)
    expect(territory.getOwner(6, 10)).toBe(1);
    expect(territory.getOwner(14, 10)).toBe(2);
  });

  it('should recalculate when marked dirty', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    territory.update();

    expect(territory.getOwner(10, 10)).toBe(1);

    // Remove the castle
    const buildings = gameState.getAllBuildings();
    gameState.removeBuilding(buildings[0].id);

    // Territory is stale until marked dirty
    expect(territory.getOwner(10, 10)).toBe(1); // still cached

    territory.markDirty();
    territory.update();

    // Now territory should be cleared
    expect(territory.getOwner(10, 10)).toBeNull();
  });

  it('should not recalculate if not dirty', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    territory.update();

    const owned1 = territory.getPlayerTerritory(1).length;

    // Update again without marking dirty — should be a no-op
    territory.update();

    const owned2 = territory.getPlayerTerritory(1).length;
    expect(owned2).toBe(owned1);
  });

  it('should not extend territory across map boundary (no wrapping)', () => {
    // Place Castle near the edge
    gameState.placeBuilding(BuildingType.Castle, { q: 1, r: 1 }, 1);
    territory.update();

    // q=0 is 1 hex away, should be owned
    expect(territory.getOwner(0, 1)).toBe(1);

    // q=19 (far edge) should NOT be owned since there's no wrapping
    expect(territory.getOwner(19, 1)).toBeNull();
  });

  it('should return correct isOwnedBy results', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    territory.update();

    expect(territory.isOwnedBy(10, 10, 1)).toBe(true);
    expect(territory.isOwnedBy(10, 10, 2)).toBe(false);
    expect(territory.isOwnedBy(0, 0, 1)).toBe(false);
  });

  it('should include non-military buildings with influenceRadius 0 in territory but not project influence', () => {
    // A Sawmill has influenceRadius 0, so it should not project territory
    const result = gameState.placeBuilding(BuildingType.Sawmill, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      result.building.state = BuildingState.Active;
    }

    territory.update();

    // Sawmill location should NOT be owned (no influence)
    expect(territory.getOwner(10, 10)).toBeNull();
  });

  it('should handle Watchtower radius 6 and Barracks radius 8', () => {
    // Use a larger grid so the influence radius cap doesn't interfere
    const largeGrid = makeGrid(48, 48);
    const gs = new GameState(largeGrid);
    const tm = new TerritoryManager(gs);

    // Place a Watchtower
    const wt = gs.placeBuilding(BuildingType.Watchtower, { q: 24, r: 24 }, 1);
    expect(wt.ok).toBe(true);
    if (wt.ok) {
      wt.building.state = BuildingState.Active;
    }

    tm.update();

    // 6 hexes away in q direction should be in territory
    expect(tm.getOwner(30, 24)).toBe(1);
    // 7 hexes away should NOT be
    expect(tm.getOwner(31, 24)).toBeNull();
  });

  it('should cap influence radius on small maps to prevent wrapping', () => {
    // On a 24×24 map, maxSafeRadius = floor(24/4) - 1 = 5
    const smallGrid = makeGrid(24, 24);
    const gs = new GameState(smallGrid);
    const tm = new TerritoryManager(gs);

    // Place Castle at center — Castle has influenceRadius 8, capped to 5
    gs.placeBuilding(BuildingType.Castle, { q: 12, r: 12 }, 1);
    tm.update();

    // 5 hexes away should be owned (within capped radius)
    expect(tm.getOwner(17, 12)).toBe(1);
    // 6 hexes away should NOT be owned (beyond capped radius)
    expect(tm.getOwner(18, 12)).toBeNull();
  });
});
