import { describe, it, expect } from 'vitest';
import {
  DIFFICULTY_CONFIGS,
  applyPersonality,
  getPersonalityForPlayer,
  AI_PERSONALITY_LABELS,
  PERSONALITY_OVERRIDES,
} from './aiBuildOrders';
import { Difficulty } from '../GameConfig';

describe('AI Build Orders', () => {
  it('has configs for all difficulties', () => {
    expect(DIFFICULTY_CONFIGS[Difficulty.Easy]).toBeDefined();
    expect(DIFFICULTY_CONFIGS[Difficulty.Normal]).toBeDefined();
    expect(DIFFICULTY_CONFIGS[Difficulty.Hard]).toBeDefined();
  });

  it('each config has a non-empty build order', () => {
    for (const config of Object.values(DIFFICULTY_CONFIGS)) {
      expect(config.buildOrder.length).toBeGreaterThan(0);
    }
  });
});

describe('AI Personalities', () => {
  it('has labels for all personalities', () => {
    expect(Object.keys(AI_PERSONALITY_LABELS)).toEqual(
      expect.arrayContaining(['balanced', 'economist', 'militarist', 'turtle'])
    );
  });

  it('has overrides for all personalities', () => {
    for (const key of Object.keys(AI_PERSONALITY_LABELS)) {
      expect(PERSONALITY_OVERRIDES[key as keyof typeof PERSONALITY_OVERRIDES]).toBeDefined();
    }
  });

  it('getPersonalityForPlayer returns valid personality', () => {
    for (let i = 0; i < 10; i++) {
      const p = getPersonalityForPlayer(i);
      expect(AI_PERSONALITY_LABELS[p]).toBeDefined();
    }
  });

  it('getPersonalityForPlayer cycles through personalities', () => {
    const p0 = getPersonalityForPlayer(0);
    const p1 = getPersonalityForPlayer(1);
    const p2 = getPersonalityForPlayer(2);
    const p3 = getPersonalityForPlayer(3);
    const p4 = getPersonalityForPlayer(4);
    // Should cycle back
    expect(p4).toBe(p0);
    // All 4 should be different
    expect(new Set([p0, p1, p2, p3]).size).toBe(4);
  });

  it('applyPersonality with balanced returns base config unchanged', () => {
    const base = DIFFICULTY_CONFIGS[Difficulty.Normal];
    const result = applyPersonality(base, 'balanced');
    expect(result.attackThreshold).toBe(base.attackThreshold);
    expect(result.decisionInterval).toBe(base.decisionInterval);
    expect(result.attackInterval).toBe(base.attackInterval);
    expect(result.knightsPerAttack).toBe(base.knightsPerAttack);
  });

  it('applyPersonality with militarist reduces attack threshold', () => {
    const base = DIFFICULTY_CONFIGS[Difficulty.Normal];
    const result = applyPersonality(base, 'militarist');
    expect(result.attackThreshold).toBeLessThan(base.attackThreshold);
    expect(result.attackInterval).toBeLessThan(base.attackInterval);
  });

  it('applyPersonality with turtle increases attack threshold', () => {
    const base = DIFFICULTY_CONFIGS[Difficulty.Normal];
    const result = applyPersonality(base, 'turtle');
    expect(result.attackThreshold).toBeGreaterThan(base.attackThreshold);
    expect(result.attackInterval).toBeGreaterThan(base.attackInterval);
  });

  it('applyPersonality with economist delays attacks', () => {
    const base = DIFFICULTY_CONFIGS[Difficulty.Normal];
    const result = applyPersonality(base, 'economist');
    expect(result.attackThreshold).toBeGreaterThan(base.attackThreshold);
    expect(result.attackInterval).toBeGreaterThan(base.attackInterval);
  });

  it('applyPersonality never produces negative values', () => {
    for (const difficulty of [Difficulty.Easy, Difficulty.Normal, Difficulty.Hard]) {
      for (const personality of ['balanced', 'economist', 'militarist', 'turtle'] as const) {
        const result = applyPersonality(DIFFICULTY_CONFIGS[difficulty], personality);
        expect(result.attackThreshold).toBeGreaterThanOrEqual(1);
        expect(result.knightsPerAttack).toBeGreaterThanOrEqual(1);
        expect(result.decisionInterval).toBeGreaterThan(0);
        expect(result.attackInterval).toBeGreaterThan(0);
      }
    }
  });
});
