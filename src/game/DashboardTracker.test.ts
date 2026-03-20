import { describe, it, expect } from 'vitest';
import { RingBuffer, DashboardTracker } from './DashboardTracker';
import { GameState } from './GameState';
import { PopulationManager } from './PopulationManager';
import { MoraleManager } from './MoraleManager';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState } from './Building';

describe('RingBuffer', () => {
  it('should push and retrieve values', () => {
    const buf = new RingBuffer(5);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.toArray()).toEqual([1, 2, 3]);
    expect(buf.latest()).toBe(3);
    expect(buf.length).toBe(3);
  });

  it('should wrap around on overflow', () => {
    const buf = new RingBuffer(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4); // overwrites 1
    expect(buf.toArray()).toEqual([2, 3, 4]);
    expect(buf.latest()).toBe(4);
    expect(buf.length).toBe(3);
  });

  it('should return 0 for latest() on empty buffer', () => {
    const buf = new RingBuffer(3);
    expect(buf.latest()).toBe(0);
    expect(buf.length).toBe(0);
    expect(buf.toArray()).toEqual([]);
  });
});

function makeGrid(): HexGrid {
  const grid = new HexGrid(10, 10);
  for (let q = 0; q < 10; q++) {
    for (let r = 0; r < 10; r++) {
      grid.setTile(q, r, TerrainType.Grassland);
    }
  }
  return grid;
}

describe('DashboardTracker', () => {
  function createTracker() {
    const grid = makeGrid();
    const gs = new GameState(grid);
    const pop = new PopulationManager(gs);
    const morale = new MoraleManager(gs);
    return { tracker: new DashboardTracker(gs, pop, morale, 1), gs, grid };
  }

  it('should take initial snapshot on first update', () => {
    const { tracker } = createTracker();
    expect(tracker.getSnapshotCount()).toBe(0);
    tracker.update(0.016); // one frame
    expect(tracker.getSnapshotCount()).toBe(1);
  });

  it('should take snapshot every 30 seconds', () => {
    const { tracker } = createTracker();
    tracker.update(0.016); // initial
    expect(tracker.getSnapshotCount()).toBe(1);

    tracker.update(15); // not enough
    expect(tracker.getSnapshotCount()).toBe(1);

    tracker.update(15); // total = 30s since initial
    expect(tracker.getSnapshotCount()).toBe(2);

    tracker.update(30); // another 30s
    expect(tracker.getSnapshotCount()).toBe(3);
  });

  it('should not snapshot when deltaTime is 0 (paused)', () => {
    const { tracker } = createTracker();
    tracker.update(0);
    expect(tracker.getSnapshotCount()).toBe(0);
  });

  it('should track population and capacity', () => {
    const { tracker, gs } = createTracker();
    // Place a castle for player 1
    const result = gs.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
    expect(result.ok).toBe(true);

    tracker.update(0.016);

    const popHist = tracker.getPopulationHistory();
    expect(popHist.length).toBe(1);
    expect(popHist[0]).toBe(0); // no units yet

    const capHist = tracker.getPopulationCapHistory();
    expect(capHist.length).toBe(1);
    expect(capHist[0]).toBeGreaterThan(0); // castle provides capacity
  });

  it('should return empty arrays for empty game state', () => {
    const { tracker } = createTracker();
    tracker.update(0.016);

    expect(tracker.getPopulationHistory()).toEqual([0]);
    expect(tracker.getMoraleHistory().length).toBe(1);
    expect(tracker.getMilitaryCountHistory()).toEqual([0]);
    expect(tracker.getEfficiency().total).toBe(0);
  });

  it('should categorize building efficiency', () => {
    const { tracker, gs } = createTracker();
    // Place a castle
    gs.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);

    tracker.update(0.016);
    const eff = tracker.getEfficiency();
    // Castle is active but has no production recipe, so not counted
    expect(eff.total).toBe(0);
  });

  it('should track efficiency for paused buildings', () => {
    const { tracker, gs } = createTracker();
    gs.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
    const result = gs.placeBuilding(BuildingType.Sawmill, { q: 5, r: 4 }, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      result.building.state = BuildingState.Active;
      result.building.productionPaused = true;
    }

    tracker.update(0.016);
    const eff = tracker.getEfficiency();
    expect(eff.paused).toBe(1);
    expect(eff.total).toBe(1);
  });
});
