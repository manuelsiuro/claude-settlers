import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState, addToInventory } from './Building';
import { resetBuildingIdCounter } from './Building';
import { UnitType, UNIT_DEFINITIONS } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';
import { ResourceType } from './ResourceType';
import { KnightManager } from './KnightManager';
import { CombatManager } from './CombatManager';
import { AttackManager } from './AttackManager';
import { TerritoryManager } from './TerritoryManager';

function makeGrid(size = 16): HexGrid {
  const grid = new HexGrid(size, size);
  for (let q = 0; q < size; q++) {
    for (let r = 0; r < size; r++) {
      grid.setTile(q, r, TerrainType.Grassland, 0.5);
    }
  }
  return grid;
}

function placeActive(gs: GameState, type: BuildingType, q: number, r: number, pid: number) {
  const res = gs.placeBuilding(type, { q, r }, pid);
  if (res.ok) res.building.state = BuildingState.Active;
  return res;
}

describe('Military Expansion — E1: Scout Unit', () => {
  it('Scout unit definition has 12-hex vision radius', () => {
    const def = UNIT_DEFINITIONS[UnitType.Scout];
    expect(def.visionRadius).toBe(12);
    expect(def.moveSpeed).toBe(2.0);
    expect(def.combatStrength).toBe(0.2);
    expect(def.recruitmentItems).toEqual([]);
  });

  it('Scout requires no items to recruit (serf promotion)', () => {
    const def = UNIT_DEFINITIONS[UnitType.Scout];
    expect(def.recruitmentItems).toBeDefined();
    expect(def.recruitmentItems!.length).toBe(0);
  });
});

describe('Military Expansion — E2: Archer + Ranged Combat', () => {
  let gs: GameState;
  let km: KnightManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    gs = new GameState(makeGrid());
    km = new KnightManager(gs);
  });

  it('Archer unit definition has ranged attack', () => {
    const def = UNIT_DEFINITIONS[UnitType.Archer];
    expect(def.attackRange).toBe(3);
    expect(def.combatStrength).toBe(0.6);
    expect(def.visionRadius).toBe(5);
  });

  it('Archer recruitment requires Bow + Arrows', () => {
    const def = UNIT_DEFINITIONS[UnitType.Archer];
    expect(def.recruitmentItems).toContainEqual({ resource: ResourceType.Bow, amount: 1 });
    expect(def.recruitmentItems).toContainEqual({ resource: ResourceType.Arrows, amount: 1 });
  });

  it('ArcheryRange recruits Archers with Bow + Arrows', () => {
    const res = placeActive(gs, BuildingType.ArcheryRange, 5, 5, 1);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const range = res.building;

    addToInventory(range.inputInventory, ResourceType.Bow, 1);
    addToInventory(range.inputInventory, ResourceType.Arrows, 1);

    km.update(2.0);

    expect(range.knightIds.length).toBe(1);
    const archer = gs.getUnit(range.knightIds[0]);
    expect(archer).toBeDefined();
    expect(archer!.type).toBe(UnitType.Archer);
    expect(archer!.state).toBe(UnitState.Working);
  });
});

describe('Military Expansion — E3: Cavalry + Charge', () => {
  let gs: GameState;
  let km: KnightManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    gs = new GameState(makeGrid());
    km = new KnightManager(gs);
  });

  it('Cavalry unit definition has charge multiplier', () => {
    const def = UNIT_DEFINITIONS[UnitType.Cavalry];
    expect(def.chargeMultiplier).toBe(1.3);
    expect(def.moveSpeed).toBe(1.8);
    expect(def.combatStrength).toBe(1.3);
  });

  it('Cavalry recruitment requires Horse + Sword + Shield', () => {
    const def = UNIT_DEFINITIONS[UnitType.Cavalry];
    expect(def.recruitmentItems).toContainEqual({ resource: ResourceType.Horses, amount: 1 });
    expect(def.recruitmentItems).toContainEqual({ resource: ResourceType.Swords, amount: 1 });
    expect(def.recruitmentItems).toContainEqual({ resource: ResourceType.Shields, amount: 1 });
  });

  it('Barracks recruits Cavalry when Horse+Sword+Shield available', () => {
    const res = placeActive(gs, BuildingType.Barracks, 5, 5, 1);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const barracks = res.building;

    addToInventory(barracks.inputInventory, ResourceType.Horses, 1);
    addToInventory(barracks.inputInventory, ResourceType.Swords, 1);
    addToInventory(barracks.inputInventory, ResourceType.Shields, 1);

    km.update(2.0);

    expect(barracks.knightIds.length).toBe(1);
    const cavalry = gs.getUnit(barracks.knightIds[0]);
    expect(cavalry).toBeDefined();
    expect(cavalry!.type).toBe(UnitType.Cavalry);
  });

  it('Barracks falls back to Knight when only Sword+Shield available', () => {
    const res = placeActive(gs, BuildingType.Barracks, 5, 5, 1);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const barracks = res.building;

    addToInventory(barracks.inputInventory, ResourceType.Swords, 1);
    addToInventory(barracks.inputInventory, ResourceType.Shields, 1);

    km.update(2.0);

    expect(barracks.knightIds.length).toBe(1);
    const knight = gs.getUnit(barracks.knightIds[0]);
    expect(knight!.type).toBe(UnitType.Knight);
  });

  it('Cavalry charge bonus applies on first engagement', () => {
    const cm = new CombatManager(gs, km);
    cm.random = () => 0.5;

    const cav = gs.spawnUnit(UnitType.Cavalry, { q: 5, r: 5 }, 1);
    cav.knightRank = 1;
    const knight = gs.spawnUnit(UnitType.Knight, { q: 6, r: 5 }, 2);
    knight.knightRank = 1;

    // Cavalry: 1 × 1.3 × 1.0 × charge(1.3) = 1.69
    // Knight: 1 × 1.0 × 1.0 = 1.0
    // Cav win prob: 1.69 / 2.69 ≈ 0.628. roll=0.5 < 0.628 → cavalry wins
    const result = cm.preComputeDuel(cav.id, knight.id);
    expect(result).not.toBeNull();
    expect(result!.winnerId).toBe(cav.id);
  });
});

describe('Military Expansion — E4: Siege Operator + Building Damage', () => {
  let gs: GameState;
  let km: KnightManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    gs = new GameState(makeGrid());
    km = new KnightManager(gs);
  });

  it('SiegeOperator unit definition has building damage', () => {
    const def = UNIT_DEFINITIONS[UnitType.SiegeOperator];
    expect(def.buildingDamage).toBe(3.0);
    expect(def.combatStrength).toBe(0.5);
    expect(def.moveSpeed).toBe(0.6);
  });

  it('SiegeOperator recruitment requires SiegeRam', () => {
    const def = UNIT_DEFINITIONS[UnitType.SiegeOperator];
    expect(def.recruitmentItems).toContainEqual({ resource: ResourceType.SiegeRam, amount: 1 });
  });

  it('Siege damage reduces building HP', () => {
    const cm = new CombatManager(gs, km);
    const siegeUnit = gs.spawnUnit(UnitType.SiegeOperator, { q: 5, r: 5 }, 1);

    const res = placeActive(gs, BuildingType.GuardHut, 6, 5, 2);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const building = res.building;
    building.hp = 1.0;

    const newHp = cm.applySiegeDamage(siegeUnit.id, building);
    expect(newHp).toBeCloseTo(0.7, 5);
    expect(building.hp).toBeCloseTo(0.7, 5);
  });

  it('Building HP starts at 1.0', () => {
    const res = gs.placeBuilding(BuildingType.GuardHut, { q: 3, r: 3 }, 1);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.building.hp).toBe(1.0);
  });

  it('Barracks recruits SiegeOperator when SiegeRam available', () => {
    const res = placeActive(gs, BuildingType.Barracks, 5, 5, 1);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const barracks = res.building;

    addToInventory(barracks.inputInventory, ResourceType.SiegeRam, 1);

    km.update(2.0);

    expect(barracks.knightIds.length).toBe(1);
    const siege = gs.getUnit(barracks.knightIds[0]);
    expect(siege!.type).toBe(UnitType.SiegeOperator);
  });
});

describe('Military Expansion — E5: Fortress Integration', () => {
  let gs: GameState;
  let km: KnightManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    gs = new GameState(makeGrid());
    km = new KnightManager(gs);
  });

  it('Fortress has 20 knight slots and influence radius 10', () => {
    const fortress = BUILDING_DEFINITIONS[BuildingType.Fortress];
    expect(fortress.knightSlots).toBe(20);
    expect(fortress.influenceRadius).toBe(10);
    expect(fortress.visionRadius).toBe(12);
  });

  it('Fortress recruits Cavalry over Knight when items available', () => {
    const res = placeActive(gs, BuildingType.Fortress, 5, 5, 1);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const fortress = res.building;

    addToInventory(fortress.inputInventory, ResourceType.Horses, 1);
    addToInventory(fortress.inputInventory, ResourceType.Swords, 1);
    addToInventory(fortress.inputInventory, ResourceType.Shields, 1);

    km.update(2.0);

    expect(fortress.knightIds.length).toBe(1);
    const unit = gs.getUnit(fortress.knightIds[0]);
    expect(unit!.type).toBe(UnitType.Cavalry);
  });

  it('Cavalry can be ordered to attack enemy building', () => {
    const cm = new CombatManager(gs, km);
    const tm = new TerritoryManager(gs);
    const am = new AttackManager(gs, cm, tm);

    // Place buildings for territory
    placeActive(gs, BuildingType.Castle, 2, 2, 1);
    const barracksRes = placeActive(gs, BuildingType.Barracks, 3, 2, 1);
    placeActive(gs, BuildingType.Castle, 10, 10, 2);
    const targetRes = placeActive(gs, BuildingType.GuardHut, 8, 8, 2);

    expect(barracksRes.ok).toBe(true);
    expect(targetRes.ok).toBe(true);
    if (!barracksRes.ok || !targetRes.ok) return;

    // Spawn cavalry and station it
    const cavalry = gs.spawnUnit(UnitType.Cavalry, { q: 3, r: 2 }, 1);
    cavalry.knightRank = 2;
    cavalry.assignedBuildingId = barracksRes.building.id;
    cavalry.state = UnitState.Working;
    barracksRes.building.knightIds.push(cavalry.id);

    tm.update();

    const success = am.orderAttack(cavalry.id, targetRes.building.id);
    expect(success).toBe(true);
    expect(am.getActiveAttackCount()).toBe(1);
  });
});

describe('Military Expansion — Combat between all unit types', () => {
  let gs: GameState;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    gs = new GameState(makeGrid());
  });

  it('Archer can fight Knight in a duel', () => {
    const km = new KnightManager(gs);
    const cm = new CombatManager(gs, km);
    cm.random = () => 0.1;

    const archer = gs.spawnUnit(UnitType.Archer, { q: 5, r: 5 }, 1);
    archer.knightRank = 3;
    const knight = gs.spawnUnit(UnitType.Knight, { q: 6, r: 5 }, 2);
    knight.knightRank = 2;

    const result = cm.resolveDuel(archer.id, knight.id);
    expect(result).not.toBeNull();
    expect(result!.winnerId).toBe(archer.id);
    expect(gs.getUnit(knight.id)).toBeUndefined();
  });

  it('Scout can fight but is very weak', () => {
    const km = new KnightManager(gs);
    const cm = new CombatManager(gs, km);
    cm.random = () => 0.99;

    const scout = gs.spawnUnit(UnitType.Scout, { q: 5, r: 5 }, 1);
    scout.knightRank = 1;
    const knight = gs.spawnUnit(UnitType.Knight, { q: 6, r: 5 }, 2);
    knight.knightRank = 1;

    const result = cm.resolveDuel(scout.id, knight.id);
    expect(result).not.toBeNull();
    expect(result!.winnerId).toBe(knight.id);
  });

  it('getKnightStrength works for all military types', () => {
    const km = new KnightManager(gs);
    const knight = gs.spawnUnit(UnitType.Knight, { q: 1, r: 1 }, 1);
    knight.knightRank = 3;
    const archer = gs.spawnUnit(UnitType.Archer, { q: 2, r: 1 }, 1);
    archer.knightRank = 3;
    const cavalry = gs.spawnUnit(UnitType.Cavalry, { q: 3, r: 1 }, 1);
    cavalry.knightRank = 3;

    // Knight: 3 × 1.0 × 1.0 = 3.0
    expect(km.getKnightStrength(knight.id)).toBeCloseTo(3.0, 5);
    // Archer: 3 × 0.6 × 1.0 = 1.8
    expect(km.getKnightStrength(archer.id)).toBeCloseTo(1.8, 5);
    // Cavalry: 3 × 1.3 × 1.0 = 3.9
    expect(km.getKnightStrength(cavalry.id)).toBeCloseTo(3.9, 5);
  });
});
