import { describe, it, expect, beforeEach } from 'vitest';
import {
  UnitState,
  createUnit,
  getUnitDefinition,
  isUnitMoving,
  getUnitWorldPosition,
  assignUnitToBuilding,
  unassignUnit,
  setUnitPath,
  clearUnitPath,
  resetUnitIdCounter,
} from './Unit';
import { UnitType, UNIT_DEFINITIONS } from './UnitType';

describe('Unit', () => {
  beforeEach(() => {
    resetUnitIdCounter();
  });

  describe('createUnit', () => {
    it('should create a unit with a unique ID', () => {
      const u1 = createUnit(UnitType.Woodcutter, { q: 0, r: 0 }, 1);
      const u2 = createUnit(UnitType.Builder, { q: 1, r: 0 }, 1);
      expect(u1.id).toBe('unit_1');
      expect(u2.id).toBe('unit_2');
    });

    it('should initialize in Idle state', () => {
      const u = createUnit(UnitType.Transporter, { q: 5, r: 5 }, 1);
      expect(u.state).toBe(UnitState.Idle);
    });

    it('should store type, coordinate, and player', () => {
      const u = createUnit(UnitType.Farmer, { q: 3, r: 7 }, 2);
      expect(u.type).toBe(UnitType.Farmer);
      expect(u.coord).toEqual({ q: 3, r: 7 });
      expect(u.playerId).toBe(2);
    });

    it('should start unassigned with no path', () => {
      const u = createUnit(UnitType.Miner, { q: 0, r: 0 }, 1);
      expect(u.assignedBuildingId).toBeNull();
      expect(u.path).toHaveLength(0);
      expect(u.pathIndex).toBe(0);
      expect(u.moveProgress).toBe(0);
    });

    it('should start with no carried resource', () => {
      const u = createUnit(UnitType.Transporter, { q: 0, r: 0 }, 1);
      expect(u.carryingResource).toBeNull();
    });

    it('should start at knight rank 1', () => {
      const knight = createUnit(UnitType.Knight, { q: 0, r: 0 }, 1);
      expect(knight.knightRank).toBe(1);
    });
  });

  describe('getUnitDefinition', () => {
    it('should return the correct definition', () => {
      const u = createUnit(UnitType.Baker, { q: 0, r: 0 }, 1);
      const def = getUnitDefinition(u);
      expect(def).toBe(UNIT_DEFINITIONS[UnitType.Baker]);
      expect(def.label).toBe('Baker');
    });
  });

  describe('isUnitMoving', () => {
    it('should return false when no path', () => {
      const u = createUnit(UnitType.Woodcutter, { q: 0, r: 0 }, 1);
      expect(isUnitMoving(u)).toBe(false);
    });

    it('should return true when path has remaining segments', () => {
      const u = createUnit(UnitType.Woodcutter, { q: 0, r: 0 }, 1);
      u.path = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
      ];
      u.pathIndex = 0;
      expect(isUnitMoving(u)).toBe(true);
    });

    it('should return false when at end of path', () => {
      const u = createUnit(UnitType.Woodcutter, { q: 0, r: 0 }, 1);
      u.path = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ];
      u.pathIndex = 1; // At last node
      expect(isUnitMoving(u)).toBe(false);
    });
  });

  describe('getUnitWorldPosition', () => {
    it('should return current coord when not moving', () => {
      const u = createUnit(UnitType.Builder, { q: 5, r: 3 }, 1);
      const pos = getUnitWorldPosition(u);
      expect(pos).toEqual({ q: 5, r: 3 });
    });

    it('should interpolate between path points', () => {
      const u = createUnit(UnitType.Builder, { q: 0, r: 0 }, 1);
      u.path = [
        { q: 0, r: 0 },
        { q: 2, r: 4 },
      ];
      u.pathIndex = 0;
      u.moveProgress = 0.5;

      const pos = getUnitWorldPosition(u);
      expect(pos.q).toBeCloseTo(1);
      expect(pos.r).toBeCloseTo(2);
    });

    it('should return start of segment at progress 0', () => {
      const u = createUnit(UnitType.Builder, { q: 0, r: 0 }, 1);
      u.path = [
        { q: 1, r: 1 },
        { q: 3, r: 5 },
      ];
      u.pathIndex = 0;
      u.moveProgress = 0;

      const pos = getUnitWorldPosition(u);
      expect(pos).toEqual({ q: 1, r: 1 });
    });

    it('should return end of segment at progress 1', () => {
      const u = createUnit(UnitType.Builder, { q: 0, r: 0 }, 1);
      u.path = [
        { q: 1, r: 1 },
        { q: 3, r: 5 },
      ];
      u.pathIndex = 0;
      u.moveProgress = 1;

      const pos = getUnitWorldPosition(u);
      expect(pos.q).toBeCloseTo(3);
      expect(pos.r).toBeCloseTo(5);
    });
  });

  describe('assignUnitToBuilding / unassignUnit', () => {
    it('should assign a building ID', () => {
      const u = createUnit(UnitType.Woodcutter, { q: 0, r: 0 }, 1);
      assignUnitToBuilding(u, 'building_5');
      expect(u.assignedBuildingId).toBe('building_5');
    });

    it('should unassign the building', () => {
      const u = createUnit(UnitType.Woodcutter, { q: 0, r: 0 }, 1);
      assignUnitToBuilding(u, 'building_5');
      unassignUnit(u);
      expect(u.assignedBuildingId).toBeNull();
    });
  });

  describe('setUnitPath / clearUnitPath', () => {
    it('should set path and reset indices', () => {
      const u = createUnit(UnitType.Transporter, { q: 0, r: 0 }, 1);
      const path = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
      ];
      setUnitPath(u, path);
      expect(u.path).toEqual(path);
      expect(u.pathIndex).toBe(0);
      expect(u.moveProgress).toBe(0);
    });

    it('should clear path and reset indices', () => {
      const u = createUnit(UnitType.Transporter, { q: 0, r: 0 }, 1);
      setUnitPath(u, [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ]);
      u.pathIndex = 1;
      u.moveProgress = 0.5;

      clearUnitPath(u);
      expect(u.path).toHaveLength(0);
      expect(u.pathIndex).toBe(0);
      expect(u.moveProgress).toBe(0);
    });
  });
});
