import { describe, it, expect, beforeEach } from 'vitest';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { ResourceType } from './ResourceType';
import { BuildingType } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';
import { GameState } from './GameState';
import { GeologistManager } from './GeologistManager';
import { generateMap } from './MapGenerator';

describe('GeologistManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let manager: GeologistManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    // Create a test grid: grassland center with mountains around it
    grid = new HexGrid(12, 12);
    for (let q = 0; q < 12; q++) {
      for (let r = 0; r < 12; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    // Place mountain tiles with deposits adjacent to (5,5)
    grid.setTile(5, 4, TerrainType.Mountain, 0.8, {
      resource: ResourceType.IronOre,
      revealed: false,
      claimed: false,
    });
    grid.setTile(6, 4, TerrainType.Mountain, 0.8, {
      resource: ResourceType.CoalOre,
      revealed: false,
      claimed: false,
    });
    grid.setTile(6, 5, TerrainType.Mountain, 0.8, {
      resource: ResourceType.GoldOre,
      revealed: false,
      claimed: false,
    });
    // Mountain without deposit
    grid.setTile(4, 5, TerrainType.Mountain, 0.8);

    gameState = new GameState(grid);
    manager = new GeologistManager(gameState);
  });

  describe('Map generation assigns deposits to mountain tiles', () => {
    it('should assign deposits deterministically from seed', () => {
      const map = generateMap({ width: 20, height: 20, seed: 42 });
      const mountains = map.getAllTiles().filter((t) => t.terrain === TerrainType.Mountain);
      expect(mountains.length).toBeGreaterThan(0);

      // Some mountains should have deposits
      const withDeposits = mountains.filter((t) => t.deposit);
      expect(withDeposits.length).toBeGreaterThan(0);

      // All deposits should be hidden
      for (const t of withDeposits) {
        expect(t.deposit!.revealed).toBe(false);
        expect(t.deposit!.claimed).toBe(false);
      }

      // Same seed → same deposits
      const map2 = generateMap({ width: 20, height: 20, seed: 42 });
      const mountains2 = map2.getAllTiles().filter((t) => t.terrain === TerrainType.Mountain);
      for (let i = 0; i < mountains.length; i++) {
        const t1 = mountains[i];
        const t2 = mountains2.find(
          (t) => t.coord.q === t1.coord.q && t.coord.r === t1.coord.r,
        );
        expect(t2).toBeDefined();
        if (t1.deposit) {
          expect(t2!.deposit).toBeDefined();
          expect(t2!.deposit!.resource).toBe(t1.deposit.resource);
        } else {
          expect(t2!.deposit).toBeUndefined();
        }
      }
    });
  });

  describe('GeologistHut placement', () => {
    it('should allow GeologistHut on grassland adjacent to mountain', () => {
      // (5,5) is grassland, adjacent to mountains at (5,4), (6,4), (6,5)
      const error = gameState.canPlace(BuildingType.GeologistHut, { q: 5, r: 5 });
      expect(error).toBeNull();
    });

    it('should reject GeologistHut on grassland not adjacent to mountain', () => {
      const error = gameState.canPlace(BuildingType.GeologistHut, { q: 0, r: 0 });
      expect(error).toBe('no_adjacent_terrain');
    });

    it('should reject GeologistHut on mountain (no longer allowed terrain)', () => {
      const error = gameState.canPlace(BuildingType.GeologistHut, { q: 5, r: 4 });
      expect(error).toBe('invalid_terrain');
    });
  });

  describe('Geologist work cycle', () => {
    it('should prospect mountains and reveal deposits', () => {
      // Place GeologistHut and set up worker
      const result = gameState.placeBuilding(BuildingType.GeologistHut, { q: 5, r: 5 }, 1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      result.building.state = BuildingState.Active;

      const worker = gameState.spawnUnit(UnitType.Geologist, { q: 5, r: 5 }, 1);
      worker.state = UnitState.Working;
      gameState.assignWorkerToBuilding(worker.id, result.building.id);

      // Track revealed deposits
      const reveals: { q: number; r: number; resource: string }[] = [];
      manager.onDepositRevealed = (coord, deposit) => {
        reveals.push({ q: coord.q, r: coord.r, resource: deposit.resource });
      };

      // Run many update cycles to complete at least one prospect cycle
      for (let i = 0; i < 500; i++) {
        manager.update(0.1);
      }

      // Should have revealed at least one deposit
      expect(reveals.length).toBeGreaterThan(0);

      // Verify the deposit is now revealed on the grid
      for (const r of reveals) {
        const deposit = grid.getDeposit(r.q, r.r);
        expect(deposit).toBeDefined();
        expect(deposit!.revealed).toBe(true);
      }
    });

    it('should not re-prospect already prospected tiles', () => {
      const result = gameState.placeBuilding(BuildingType.GeologistHut, { q: 5, r: 5 }, 1);
      if (!result.ok) return;
      result.building.state = BuildingState.Active;

      const worker = gameState.spawnUnit(UnitType.Geologist, { q: 5, r: 5 }, 1);
      worker.state = UnitState.Working;
      gameState.assignWorkerToBuilding(worker.id, result.building.id);

      const revealedCoords = new Set<string>();
      manager.onDepositRevealed = (coord) => {
        const key = `${coord.q},${coord.r}`;
        expect(revealedCoords.has(key)).toBe(false); // no duplicates
        revealedCoords.add(key);
      };

      for (let i = 0; i < 1000; i++) {
        manager.update(0.1);
      }
    });
  });

  describe('Mine placement validation', () => {
    it('should require matching revealed deposit for iron mine', () => {
      // Without revealed deposit
      const error1 = gameState.canPlace(BuildingType.IronMine, { q: 5, r: 4 });
      expect(error1).toBe('no_matching_deposit');

      // Reveal the deposit
      grid.revealDeposit(5, 4);
      const error2 = gameState.canPlace(BuildingType.IronMine, { q: 5, r: 4 });
      expect(error2).toBeNull();
    });

    it('should reject wrong resource type mine on deposit', () => {
      grid.revealDeposit(5, 4); // Iron deposit
      const error = gameState.canPlace(BuildingType.CoalMine, { q: 5, r: 4 });
      expect(error).toBe('no_matching_deposit');
    });

    it('should reject mine on unprospected deposit', () => {
      const error = gameState.canPlace(BuildingType.GoldMine, { q: 6, r: 5 });
      expect(error).toBe('no_matching_deposit');
    });

    it('should reject mine on already claimed deposit', () => {
      grid.revealDeposit(5, 4);
      grid.claimDeposit(5, 4);
      const error = gameState.canPlace(BuildingType.IronMine, { q: 5, r: 4 });
      expect(error).toBe('no_matching_deposit');
    });

    it('should exempt StoneMine from deposit check', () => {
      // StoneMine should work on any mountain
      const error = gameState.canPlace(BuildingType.StoneMine, { q: 4, r: 5 });
      expect(error).toBeNull();
    });

    it('should claim deposit and change terrain on mine placement', () => {
      grid.revealDeposit(5, 4);
      const result = gameState.placeBuilding(BuildingType.IronMine, { q: 5, r: 4 }, 1);
      expect(result.ok).toBe(true);

      // Deposit should be claimed
      const deposit = grid.getDeposit(5, 4);
      expect(deposit!.claimed).toBe(true);

      // Terrain should change from Mountain to Grassland
      const tile = grid.getTile(5, 4);
      expect(tile!.terrain).toBe(TerrainType.Grassland);
    });
  });

  describe('Serialization', () => {
    it('should round-trip geologist state', () => {
      const result = gameState.placeBuilding(BuildingType.GeologistHut, { q: 5, r: 5 }, 1);
      if (!result.ok) return;
      result.building.state = BuildingState.Active;

      const worker = gameState.spawnUnit(UnitType.Geologist, { q: 5, r: 5 }, 1);
      worker.state = UnitState.Working;
      gameState.assignWorkerToBuilding(worker.id, result.building.id);

      // Run a few cycles
      for (let i = 0; i < 100; i++) {
        manager.update(0.1);
      }

      // Serialize
      const state = manager._getState();
      expect(state.workStates.length).toBe(1);

      // Restore into new manager
      const manager2 = new GeologistManager(gameState);
      manager2._loadState(state);

      const state2 = manager2._getState();
      expect(state2.workStates.length).toBe(1);
      expect(state2.workStates[0][0]).toBe(state.workStates[0][0]);
    });
  });
});
