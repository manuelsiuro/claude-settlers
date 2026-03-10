import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { resetBuildingIdCounter } from './Building';

describe('GameState', () => {
  let grid: HexGrid;
  let state: GameState;

  beforeEach(() => {
    resetBuildingIdCounter();
    // Create a small test grid with known terrain
    grid = new HexGrid(8, 8);
    // Fill with grassland
    for (let q = 0; q < 8; q++) {
      for (let r = 0; r < 8; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    // Add some special terrain
    grid.setTile(0, 0, TerrainType.Water, 0.1);
    grid.setTile(1, 0, TerrainType.Mountain, 0.8);
    grid.setTile(7, 7, TerrainType.Desert, 0.3);
    state = new GameState(grid);
  });

  describe('placeBuilding', () => {
    it('should place a Castle on grassland', () => {
      const result = state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.building.type).toBe(BuildingType.Castle);
        expect(result.building.playerId).toBe(1);
      }
    });

    it('should reject placement on water', () => {
      const result = state.placeBuilding(BuildingType.Castle, { q: 0, r: 0 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('invalid_terrain');
      }
    });

    it('should reject placement on desert', () => {
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 7, r: 7 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('invalid_terrain');
      }
    });

    it('should reject placement on occupied tile', () => {
      state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('tile_occupied');
      }
    });

    it('should place Mine on mountain', () => {
      const result = state.placeBuilding(BuildingType.IronMine, { q: 1, r: 0 }, 1);
      expect(result.ok).toBe(true);
    });

    it('should reject Mine on grassland', () => {
      const result = state.placeBuilding(BuildingType.IronMine, { q: 4, r: 4 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('invalid_terrain');
      }
    });

    it('should enforce adjacent water for Fisherman Hut', () => {
      // Tile (1, 1) is grassland and adjacent to water at (0, 0)
      // But we need to check neighbor adjacency via the grid
      // Place next to water
      const result = state.placeBuilding(BuildingType.FishermanHut, { q: 0, r: 1 }, 1);
      expect(result.ok).toBe(true);
    });

    it('should reject Fisherman Hut without adjacent water', () => {
      const result = state.placeBuilding(BuildingType.FishermanHut, { q: 4, r: 4 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('no_adjacent_terrain');
      }
    });
  });

  describe('getBuildingAt', () => {
    it('should return the building at a coordinate', () => {
      state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      const building = state.getBuildingAt(4, 4);
      expect(building).toBeDefined();
      expect(building!.type).toBe(BuildingType.Castle);
    });

    it('should return undefined for empty tile', () => {
      expect(state.getBuildingAt(3, 3)).toBeUndefined();
    });
  });

  describe('removeBuilding', () => {
    it('should remove a placed building', () => {
      const result = state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      if (result.ok) {
        expect(state.removeBuilding(result.building.id)).toBe(true);
        expect(state.getBuildingAt(4, 4)).toBeUndefined();
      }
    });

    it('should return false for non-existent building', () => {
      expect(state.removeBuilding('nonexistent')).toBe(false);
    });
  });

  describe('getAllBuildings', () => {
    it('should return all placed buildings', () => {
      state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      state.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      expect(state.getAllBuildings()).toHaveLength(2);
    });
  });

  describe('canPlace', () => {
    it('should return null for valid placement', () => {
      expect(state.canPlace(BuildingType.Castle, { q: 4, r: 4 })).toBeNull();
    });

    it('should return error for invalid placement', () => {
      expect(state.canPlace(BuildingType.Castle, { q: 0, r: 0 })).toBe('invalid_terrain');
    });
  });
});
