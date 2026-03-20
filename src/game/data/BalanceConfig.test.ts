import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import {
  HUNGER_DECAY_RATE,
  HUNGER_WORKING_MULTIPLIER,
  COMBAT_WINS_PER_RANK,
  MORALE_BASE,
  NIGHT_PRODUCTION_SLOWDOWN,
  WOODCUTTER_CHOP_DURATION,
  VICTORY_DOMINATION_THRESHOLD,
  CASTLE_POPULATION_CAPACITY,
  applyBalanceOverrides,
  resetBalanceDefaults,
} from './balanceConstants';
import { validateBalanceConfig } from './BalanceConfigLoader';

describe('applyBalanceOverrides', () => {
  afterEach(() => resetBalanceDefaults());

  it('should override hunger decay rate', () => {
    applyBalanceOverrides({ hunger: { decayRate: 0.005 } });
    expect(HUNGER_DECAY_RATE).toBe(0.005);
  });

  it('should leave unspecified values at defaults', () => {
    applyBalanceOverrides({ hunger: { decayRate: 0.005 } });
    expect(HUNGER_WORKING_MULTIPLIER).toBe(1.2);
  });

  it('should override multiple sections at once', () => {
    applyBalanceOverrides({
      hunger: { decayRate: 0.01 },
      combat: { winsPerRank: 5 },
      morale: { base: 0.6 },
    });
    expect(HUNGER_DECAY_RATE).toBe(0.01);
    expect(COMBAT_WINS_PER_RANK).toBe(5);
    expect(MORALE_BASE).toBe(0.6);
  });

  it('should override night production slowdown', () => {
    applyBalanceOverrides({ night: { productionSlowdown: 0.5 } });
    expect(NIGHT_PRODUCTION_SLOWDOWN).toBe(0.5);
  });

  it('should override woodcutter chop duration', () => {
    applyBalanceOverrides({ woodcutter: { chopDuration: 12.0 } });
    expect(WOODCUTTER_CHOP_DURATION).toBe(12.0);
  });

  it('should override victory and population constants', () => {
    applyBalanceOverrides({
      victory: { dominationThreshold: 0.9 },
      population: { castleCapacity: 20 },
    });
    expect(VICTORY_DOMINATION_THRESHOLD).toBe(0.9);
    expect(CASTLE_POPULATION_CAPACITY).toBe(20);
  });
});

describe('resetBalanceDefaults', () => {
  it('should reset all values to defaults', () => {
    applyBalanceOverrides({
      hunger: { decayRate: 0.005 },
      combat: { winsPerRank: 5 },
      morale: { base: 0.6 },
    });
    resetBalanceDefaults();
    expect(HUNGER_DECAY_RATE).toBe(0.002);
    expect(COMBAT_WINS_PER_RANK).toBe(2);
    expect(MORALE_BASE).toBe(0.50);
  });
});

describe('validateBalanceConfig', () => {
  it('should accept valid partial config', () => {
    const errors = validateBalanceConfig({ combat: { winsPerRank: 3 } });
    expect(errors).toHaveLength(0);
  });

  it('should accept empty config', () => {
    const errors = validateBalanceConfig({});
    expect(errors).toHaveLength(0);
  });

  it('should reject non-object config', () => {
    expect(validateBalanceConfig('string')).toContain('Config must be a non-null object');
    expect(validateBalanceConfig(null)).toContain('Config must be a non-null object');
    expect(validateBalanceConfig(42)).toContain('Config must be a non-null object');
  });

  it('should reject unknown sections', () => {
    const errors = validateBalanceConfig({ unknownSection: {} });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Unknown section');
  });

  it('should reject negative values', () => {
    const errors = validateBalanceConfig({ hunger: { decayRate: -0.001 } });
    expect(errors).toContain('hunger.decayRate must be >= 0');
  });

  it('should reject non-number values', () => {
    const errors = validateBalanceConfig({ hunger: { decayRate: 'fast' } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('must be a number');
  });

  it('should accept zero values', () => {
    const errors = validateBalanceConfig({ hunger: { decayRate: 0 } });
    expect(errors).toHaveLength(0);
  });

  it('should report multiple errors', () => {
    const errors = validateBalanceConfig({
      unknownSection: {},
      hunger: { decayRate: -1, workingMultiplier: 'nope' },
    });
    expect(errors.length).toBe(3);
  });
});

describe('balance-data.json sync', () => {
  it('constants should match game defaults', () => {
    resetBalanceDefaults();
    const json = JSON.parse(fs.readFileSync('tools/balance-data.json', 'utf-8'));
    expect(json.constants.hunger.decayRate).toBe(HUNGER_DECAY_RATE);
    expect(json.constants.morale.base).toBe(MORALE_BASE);
    expect(json.constants.combat.winsPerRank).toBe(COMBAT_WINS_PER_RANK);
    expect(json.constants.night.productionSlowdown).toBe(NIGHT_PRODUCTION_SLOWDOWN);
    expect(json.constants.victory.dominationThreshold).toBe(VICTORY_DOMINATION_THRESHOLD);
    expect(json.constants.population.castleCapacity).toBe(CASTLE_POPULATION_CAPACITY);
    expect(json.constants.woodcutter.chopDuration).toBe(WOODCUTTER_CHOP_DURATION);
  });

  it('should have correct entity counts', () => {
    const json = JSON.parse(fs.readFileSync('tools/balance-data.json', 'utf-8'));
    expect(Object.keys(json.buildings)).toHaveLength(50);
    expect(Object.keys(json.resources)).toHaveLength(44);
    expect(Object.keys(json.units)).toHaveLength(39);
  });
});
