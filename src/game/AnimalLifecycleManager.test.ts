import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState, addToInventory } from './Building';
import { resetBuildingIdCounter } from './Building';
import { UnitType } from './UnitType';
import { resetUnitIdCounter } from './Unit';
import { ResourceType } from './ResourceType';
import { RoadNetwork } from './RoadNetwork';
import { TransporterManager } from './TransporterManager';
import { PopulationManager } from './PopulationManager';
import { AnimalLifecycleManager } from './AnimalLifecycleManager';

function makeGrid(size = 16): HexGrid {
  const grid = new HexGrid(size, size);
  for (let q = 0; q < size; q++) {
    for (let r = 0; r < size; r++) {
      grid.setTile(q, r, TerrainType.Grassland, 0.5);
    }
  }
  return grid;
}

describe('AnimalLifecycleManager', () => {
  let gs: GameState;
  let rn: RoadNetwork;
  let tm: TransporterManager;
  let pm: PopulationManager;
  let alm: AnimalLifecycleManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    gs = new GameState(makeGrid());
    rn = new RoadNetwork(gs.getGrid());
    pm = new PopulationManager(gs);
    tm = new TransporterManager(gs, rn, pm);
    alm = new AnimalLifecycleManager(gs, rn, tm);

    // Place castle for storage
    const castle = gs.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    if (castle.ok) castle.building.state = BuildingState.Active;
  });

  it('ages transport animals each update', () => {
    const donkey = gs.spawnUnit(UnitType.Donkey, { q: 8, r: 8 }, 1);
    expect(donkey.animalAge).toBe(0);

    alm.update(10);
    expect(donkey.animalAge).toBe(10);

    alm.update(5);
    expect(donkey.animalAge).toBe(15);
  });

  it('increments hunger timer each update', () => {
    const donkey = gs.spawnUnit(UnitType.Donkey, { q: 8, r: 8 }, 1);
    expect(donkey.animalHungerTimer).toBe(0);

    alm.update(20);
    expect(donkey.animalHungerTimer).toBe(20);
  });

  it('kills donkey after starvation time (60s)', () => {
    const donkey = gs.spawnUnit(UnitType.Donkey, { q: 8, r: 8 }, 1);
    const id = donkey.id;

    // Advance past starvation time
    alm.update(61);

    expect(gs.getUnit(id)).toBeUndefined();
  });

  it('kills horse after starvation time (45s)', () => {
    const horse = gs.spawnUnit(UnitType.HorseTransport, { q: 8, r: 8 }, 1);
    const id = horse.id;

    alm.update(46);

    expect(gs.getUnit(id)).toBeUndefined();
  });

  it('kills donkey after lifespan (1200s)', () => {
    const donkey = gs.spawnUnit(UnitType.Donkey, { q: 8, r: 8 }, 1);
    const id = donkey.id;

    // Feed regularly to prevent starvation
    const castle = gs.findCastle(1)!;
    addToInventory(castle.outputInventory, ResourceType.Hay, 100);

    // Advance in chunks, feeding each time
    for (let i = 0; i < 120; i++) {
      alm.update(10); // 10s chunks, total 1200s
    }

    expect(gs.getUnit(id)).toBeUndefined();
  });

  it('feeds donkey from Castle Hay stock, resetting hunger timer', () => {
    const donkey = gs.spawnUnit(UnitType.Donkey, { q: 8, r: 8 }, 1);
    const castle = gs.findCastle(1)!;
    addToInventory(castle.outputInventory, ResourceType.Hay, 5);

    // Advance past half feed rate so animal is hungry
    donkey.animalHungerTimer = 65; // past half of 120s

    // Trigger feed cycle (feedCooldown starts at 10)
    alm.update(11);

    // Hunger should be reset
    expect(donkey.animalHungerTimer).toBe(0);
    // Hay should be consumed
    expect(castle.outputInventory[ResourceType.Hay]).toBe(4);
  });

  it('feeds donkey from Grain if no Hay available', () => {
    const donkey = gs.spawnUnit(UnitType.Donkey, { q: 8, r: 8 }, 1);
    const castle = gs.findCastle(1)!;
    addToInventory(castle.outputInventory, ResourceType.Grain, 3);

    donkey.animalHungerTimer = 65;
    alm.update(11);

    expect(donkey.animalHungerTimer).toBe(0);
    expect(castle.outputInventory[ResourceType.Grain]).toBe(2);
  });

  it('does not feed non-animal units', () => {
    const castle = gs.findCastle(1)!;
    addToInventory(castle.outputInventory, ResourceType.Hay, 5);

    const knight = gs.spawnUnit(UnitType.Knight, { q: 8, r: 8 }, 1);
    knight.animalHungerTimer = 100;

    alm.update(11);

    // Knight hunger should NOT be modified (not an animal)
    expect(knight.animalHungerTimer).toBe(100);
    // Hay should NOT be consumed
    expect(castle.outputInventory[ResourceType.Hay]).toBe(5);
  });

  it('drops cargo on death', () => {
    // Create a flag at the donkey's location
    rn.placeFlag({ q: 8, r: 8 }, 1);

    const donkey = gs.spawnUnit(UnitType.Donkey, { q: 8, r: 8 }, 1);
    donkey.cargo = [
      { resource: ResourceType.Wood, amount: 1 },
      { resource: ResourceType.Stone, amount: 1 },
    ];
    donkey.carryingResource = ResourceType.Wood;

    // Kill by starvation
    alm.update(61);

    expect(gs.getUnit(donkey.id)).toBeUndefined();

    // Check flag has the dropped goods
    const flag = rn.getFlagAt(8, 8);
    expect(flag).toBeDefined();
    expect(flag!.goods.length).toBe(2);
  });

  it('fires onAnimalDied callback', () => {
    let diedCause: string | null = null;
    alm.onAnimalDied = (_, cause) => { diedCause = cause; };

    gs.spawnUnit(UnitType.Donkey, { q: 8, r: 8 }, 1);
    alm.update(61);

    expect(diedCause).toBe('starvation');
  });

  it('serializes and deserializes state', () => {
    alm.update(5); // advance cooldown
    const state = alm._getState();
    expect(state.feedCooldown).toBe(5); // 10 - 5

    const alm2 = new AnimalLifecycleManager(gs, rn, tm);
    alm2._loadState(state);
    expect(alm2._getState().feedCooldown).toBe(5);
  });
});
