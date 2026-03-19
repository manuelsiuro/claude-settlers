import { describe, it, expect } from 'vitest';
import {
  UnitType,
  UNIT_DEFINITIONS,
  WORKER_TO_UNIT_TYPE,
  getWorkerUnitType,
} from './UnitType';
import { BUILDING_DEFINITIONS } from './BuildingType';

describe('UnitType', () => {
  it('should have 19 unit types (18 professions + Knight)', () => {
    const types = Object.values(UnitType);
    expect(types).toHaveLength(19);
  });

  it('all unit types should have unique string values', () => {
    const values = Object.values(UnitType);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('should have a definition for every unit type', () => {
    for (const type of Object.values(UnitType)) {
      expect(UNIT_DEFINITIONS[type]).toBeDefined();
      expect(UNIT_DEFINITIONS[type].type).toBe(type);
    }
  });
});

describe('UnitDefinition', () => {
  it('Knight should be military category', () => {
    expect(UNIT_DEFINITIONS[UnitType.Knight].category).toBe('military');
  });

  it('all non-Knight units should be civilian', () => {
    for (const type of Object.values(UnitType)) {
      if (type === UnitType.Knight) continue;
      expect(UNIT_DEFINITIONS[type].category).toBe('civilian');
    }
  });

  it('all units should have positive move speed', () => {
    for (const def of Object.values(UNIT_DEFINITIONS)) {
      expect(def.moveSpeed).toBeGreaterThan(0);
    }
  });

  it('tool-requiring professions should have specific tool types', () => {
    // All professions except Transporter, Toolmaker, Miller, and Knight need tools
    const toolUsers = [
      UnitType.Builder, UnitType.Woodcutter, UnitType.Stonemason,
      UnitType.Miner, UnitType.Farmer, UnitType.Fisherman,
      UnitType.Forester, UnitType.Geologist, UnitType.SawmillWorker,
      UnitType.Baker, UnitType.PigFarmer, UnitType.Butcher,
      UnitType.SmelterWorker, UnitType.Goldsmith, UnitType.Blacksmith,
    ];
    for (const type of toolUsers) {
      expect(UNIT_DEFINITIONS[type].requiredTool).not.toBeNull();
      expect(typeof UNIT_DEFINITIONS[type].requiredTool).toBe('string');
    }
  });

  it('non-tool professions should have null required tool', () => {
    const noTool = [
      UnitType.Transporter,
      UnitType.Miller,
      UnitType.Toolmaker,
      UnitType.Knight,
    ];
    for (const type of noTool) {
      expect(UNIT_DEFINITIONS[type].requiredTool).toBeNull();
    }
  });
});

describe('WORKER_TO_UNIT_TYPE', () => {
  it('should map all building worker strings to unit types', () => {
    for (const def of Object.values(BUILDING_DEFINITIONS)) {
      if (!def.worker) continue;
      const unitType = WORKER_TO_UNIT_TYPE[def.worker];
      expect(unitType).toBeDefined();
      expect(Object.values(UnitType)).toContain(unitType);
    }
  });
});

describe('getWorkerUnitType', () => {
  it('should return UnitType for known worker labels', () => {
    expect(getWorkerUnitType('Woodcutter')).toBe(UnitType.Woodcutter);
    expect(getWorkerUnitType('Baker')).toBe(UnitType.Baker);
    expect(getWorkerUnitType('Miner')).toBe(UnitType.Miner);
  });

  it('should return null for unknown labels', () => {
    expect(getWorkerUnitType('')).toBeNull();
    expect(getWorkerUnitType('Unknown')).toBeNull();
  });
});
