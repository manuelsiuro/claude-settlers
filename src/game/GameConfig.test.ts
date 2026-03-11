import { describe, it, expect } from 'vitest';
import {
  MapSize,
  Difficulty,
  Scenario,
  DEFAULT_CONFIG,
  SCENARIO_TERRAIN_BALANCE,
} from './GameConfig';
import { TerrainType } from './TerrainType';

describe('GameConfig', () => {
  describe('MapSize', () => {
    it('should have correct numeric values', () => {
      expect(MapSize.Small).toBe(24);
      expect(MapSize.Medium).toBe(32);
      expect(MapSize.Large).toBe(48);
      expect(MapSize.Huge).toBe(64);
    });
  });

  describe('Difficulty', () => {
    it('should have correct string values', () => {
      expect(Difficulty.Easy).toBe('easy');
      expect(Difficulty.Normal).toBe('normal');
      expect(Difficulty.Hard).toBe('hard');
    });
  });

  describe('Scenario', () => {
    it('should have correct string values', () => {
      expect(Scenario.Default).toBe('default');
      expect(Scenario.Island).toBe('island');
      expect(Scenario.Continent).toBe('continent');
      expect(Scenario.Archipelago).toBe('archipelago');
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_CONFIG.seed).toBe(42);
      expect(DEFAULT_CONFIG.mapSize).toBe(MapSize.Medium);
      expect(DEFAULT_CONFIG.numPlayers).toBe(1);
      expect(DEFAULT_CONFIG.difficulty).toBe(Difficulty.Normal);
      expect(DEFAULT_CONFIG.scenario).toBe(Scenario.Default);
    });
  });

  describe('SCENARIO_TERRAIN_BALANCE', () => {
    it('should have undefined for default scenario', () => {
      expect(SCENARIO_TERRAIN_BALANCE[Scenario.Default]).toBeUndefined();
    });

    it('should have more water for island scenario', () => {
      const island = SCENARIO_TERRAIN_BALANCE[Scenario.Island]!;
      expect(island[TerrainType.Water]).toBeGreaterThan(0.3);
    });

    it('should have less water for continent scenario', () => {
      const continent = SCENARIO_TERRAIN_BALANCE[Scenario.Continent]!;
      expect(continent[TerrainType.Water]).toBeLessThanOrEqual(0.1);
    });

    it('should have most water for archipelago scenario', () => {
      const archipelago = SCENARIO_TERRAIN_BALANCE[Scenario.Archipelago]!;
      expect(archipelago[TerrainType.Water]).toBeGreaterThanOrEqual(0.4);
    });

    it('should have terrain proportions summing to ~1 for all non-default scenarios', () => {
      for (const scenario of [Scenario.Island, Scenario.Continent, Scenario.Archipelago]) {
        const balance = SCENARIO_TERRAIN_BALANCE[scenario]!;
        const total = Object.values(balance).reduce((sum, v) => sum + (v ?? 0), 0);
        expect(total).toBeCloseTo(1.0, 2);
      }
    });
  });
});
