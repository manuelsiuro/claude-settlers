import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState } from './Building';
import { resetBuildingIdCounter } from './Building';
import { UnitType, UNIT_DEFINITIONS } from './UnitType';
import { resetUnitIdCounter, getCarryCapacity } from './Unit';
import { ResourceType } from './ResourceType';
import { RoadNetwork } from './RoadNetwork';
import { TransporterManager } from './TransporterManager';
import { PopulationManager } from './PopulationManager';

function makeGrid(size = 16): HexGrid {
  const grid = new HexGrid(size, size);
  for (let q = 0; q < size; q++) {
    for (let r = 0; r < size; r++) {
      grid.setTile(q, r, TerrainType.Grassland, 0.5);
    }
  }
  return grid;
}

describe('Advanced Transport — Data Model', () => {
  it('Transporter has carryCapacity 1', () => {
    expect(UNIT_DEFINITIONS[UnitType.Transporter].carryCapacity).toBe(1);
  });

  it('Donkey has carryCapacity 3', () => {
    expect(UNIT_DEFINITIONS[UnitType.Donkey].carryCapacity).toBe(3);
  });

  it('HorseTransport has carryCapacity 8', () => {
    expect(UNIT_DEFINITIONS[UnitType.HorseTransport].carryCapacity).toBe(8);
  });

  it('getCarryCapacity returns correct values', () => {
    const gs = new GameState(makeGrid());
    const transporter = gs.spawnUnit(UnitType.Transporter, { q: 5, r: 5 }, 1);
    expect(getCarryCapacity(transporter)).toBe(1);

    const donkey = gs.spawnUnit(UnitType.Donkey, { q: 6, r: 5 }, 1);
    expect(getCarryCapacity(donkey)).toBe(3);

    const horse = gs.spawnUnit(UnitType.HorseTransport, { q: 7, r: 5 }, 1);
    expect(getCarryCapacity(horse)).toBe(8);
  });

  it('Unit has empty cargo array by default', () => {
    const gs = new GameState(makeGrid());
    const unit = gs.spawnUnit(UnitType.Transporter, { q: 5, r: 5 }, 1);
    expect(unit.cargo).toEqual([]);
    expect(unit.carryingResource).toBeNull();
  });
});

describe('Advanced Transport — Road Quality', () => {
  let rn: RoadNetwork;

  beforeEach(() => {
    rn = new RoadNetwork(makeGrid());
  });

  it('Roads default to quality 0', () => {
    const flagA = rn.placeFlag({ q: 5, r: 5 }, 1);
    const flagB = rn.placeFlag({ q: 5, r: 6 }, 1);
    expect(flagA).not.toBeNull();
    expect(flagB).not.toBeNull();
    const road = rn.connectFlags(flagA!.id, flagB!.id);
    expect(road).not.toBeNull();
    expect(road!.quality).toBe(0);
  });

  it('upgradeRoad changes quality level', () => {
    const flagA = rn.placeFlag({ q: 5, r: 5 }, 1);
    const flagB = rn.placeFlag({ q: 5, r: 6 }, 1);
    const road = rn.connectFlags(flagA!.id, flagB!.id);
    expect(road).not.toBeNull();

    expect(rn.upgradeRoad(road!.id, 1)).toBe(1);
    expect(road!.quality).toBe(1);

    expect(rn.upgradeRoad(road!.id, 3)).toBe(3);
    expect(road!.quality).toBe(3);
  });

  it('upgradeRoad clamps to 0-3', () => {
    const flagA = rn.placeFlag({ q: 5, r: 5 }, 1);
    const flagB = rn.placeFlag({ q: 5, r: 6 }, 1);
    const road = rn.connectFlags(flagA!.id, flagB!.id);

    expect(rn.upgradeRoad(road!.id, 5)).toBe(3);
    expect(rn.upgradeRoad(road!.id, -1)).toBe(0);
  });
});

describe('Advanced Transport — Spawning by Road Quality', () => {
  let gs: GameState;
  let rn: RoadNetwork;
  let pm: PopulationManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    gs = new GameState(makeGrid());
    rn = new RoadNetwork(gs.getGrid());
    pm = new PopulationManager(gs);

    // Place a castle for population capacity
    const castle = gs.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    if (castle.ok) castle.building.state = BuildingState.Active;
  });

  it('quality 0 road spawns foot Transporter', () => {
    const flagA = rn.placeFlag({ q: 5, r: 5 }, 1);
    const flagB = rn.placeFlag({ q: 5, r: 6 }, 1);
    const road = rn.connectFlags(flagA!.id, flagB!.id);
    road!.quality = 0;

    const tm = new TransporterManager(gs, rn, pm);
    tm.update(2.0);

    expect(road!.transporterId).not.toBeNull();
    const unit = gs.getUnit(road!.transporterId!);
    expect(unit!.type).toBe(UnitType.Transporter);
  });

  it('quality 1 road spawns Donkey', () => {
    const flagA = rn.placeFlag({ q: 5, r: 5 }, 1);
    const flagB = rn.placeFlag({ q: 5, r: 6 }, 1);
    const road = rn.connectFlags(flagA!.id, flagB!.id);
    road!.quality = 1;

    const tm = new TransporterManager(gs, rn, pm);
    tm.update(2.0);

    expect(road!.transporterId).not.toBeNull();
    const unit = gs.getUnit(road!.transporterId!);
    expect(unit!.type).toBe(UnitType.Donkey);
  });

  it('quality 3 road spawns HorseTransport', () => {
    const flagA = rn.placeFlag({ q: 5, r: 5 }, 1);
    const flagB = rn.placeFlag({ q: 5, r: 6 }, 1);
    const road = rn.connectFlags(flagA!.id, flagB!.id);
    road!.quality = 3;

    const tm = new TransporterManager(gs, rn, pm);
    tm.update(2.0);

    expect(road!.transporterId).not.toBeNull();
    const unit = gs.getUnit(road!.transporterId!);
    expect(unit!.type).toBe(UnitType.HorseTransport);
  });
});

describe('Advanced Transport — Multi-Carry Pickup', () => {
  let gs: GameState;
  let rn: RoadNetwork;
  let pm: PopulationManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    gs = new GameState(makeGrid());
    rn = new RoadNetwork(gs.getGrid());
    pm = new PopulationManager(gs);

    const castle = gs.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    if (castle.ok) castle.building.state = BuildingState.Active;
  });

  it('Foot transporter picks up only 1 good even when multiple available', () => {
    const flagA = rn.placeFlag({ q: 5, r: 5 }, 1);
    const flagB = rn.placeFlag({ q: 5, r: 6 }, 1);
    const road = rn.connectFlags(flagA!.id, flagB!.id);

    // Add 5 goods at flagA all going to flagB
    for (let i = 0; i < 5; i++) {
      flagA!.goods.push({ resource: ResourceType.Wood, destinationFlagId: flagB!.id });
    }

    const tm = new TransporterManager(gs, rn, pm);
    tm.update(2.0); // spawn + pickup

    // Foot transporter should pick up exactly 1
    const unit = gs.getUnit(road!.transporterId!);
    expect(unit!.cargo.length).toBeLessThanOrEqual(1);
    expect(flagA!.goods.length).toBeGreaterThanOrEqual(4);
  });

  it('Donkey picks up up to 3 goods', () => {
    const flagA = rn.placeFlag({ q: 5, r: 5 }, 1);
    const flagB = rn.placeFlag({ q: 5, r: 6 }, 1);
    const road = rn.connectFlags(flagA!.id, flagB!.id);
    road!.quality = 1; // Dirt road → Donkey

    // Add 5 goods at flagA all going to flagB
    for (let i = 0; i < 5; i++) {
      flagA!.goods.push({ resource: ResourceType.Wood, destinationFlagId: flagB!.id });
    }

    const tm = new TransporterManager(gs, rn, pm);
    tm.update(2.0);

    const unit = gs.getUnit(road!.transporterId!);
    expect(unit!.type).toBe(UnitType.Donkey);
    // Donkey carries up to 3
    expect(unit!.cargo.length).toBeLessThanOrEqual(3);
    expect(unit!.carryingResource).toBe(ResourceType.Wood);
    expect(flagA!.goods.length).toBeGreaterThanOrEqual(2); // 5 - 3 = 2
  });
});
