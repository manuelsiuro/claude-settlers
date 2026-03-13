import { describe, it, expect } from 'vitest';
import {
  createActiveDuel,
  tickActiveDuel,
  getDuelPhaseProgress,
  DuelPhase,
} from './CombatAnimationState';

describe('CombatAnimationState', () => {
  it('should create duel in Approach phase', () => {
    const duel = createActiveDuel('a1', 'd1', 'a1', 'd1', false, 5, 5, 0);
    expect(duel.phase).toBe(DuelPhase.Approach);
    expect(duel.phaseTimer).toBe(0);
    expect(duel.clashIndex).toBe(0);
    expect(duel.clashCount).toBeGreaterThanOrEqual(2);
    expect(duel.clashCount).toBeLessThanOrEqual(4);
  });

  it('should advance through phases with ticks', () => {
    const duel = createActiveDuel('a1', 'd1', 'a1', 'd1', false, 0, 0, 0);
    duel.clashCount = 2; // Force 2 clashes for deterministic test

    // Approach (0.5s)
    expect(duel.phase).toBe(DuelPhase.Approach);
    tickActiveDuel(duel, 0.5);
    expect(duel.phase).toBe(DuelPhase.Clash);

    // Clash 1 (0.3s)
    tickActiveDuel(duel, 0.3);
    expect(duel.clashIndex).toBe(1);

    // Clash 2 (0.3s) → goes to Recoil
    tickActiveDuel(duel, 0.3);
    expect(duel.phase).toBe(DuelPhase.Recoil);

    // Recoil (0.2s)
    tickActiveDuel(duel, 0.2);
    expect(duel.phase).toBe(DuelPhase.Result);

    // Result (0.8s)
    const done = tickActiveDuel(duel, 0.8);
    expect(done).toBe(true);
    expect(duel.phase).toBe(DuelPhase.Done);
  });

  it('should return phase progress 0..1', () => {
    const duel = createActiveDuel('a1', 'd1', 'a1', 'd1', false, 0, 0, 0);
    expect(getDuelPhaseProgress(duel)).toBe(0);

    duel.phaseTimer = 0.25; // half of Approach (0.5s)
    expect(getDuelPhaseProgress(duel)).toBeCloseTo(0.5);
  });

  it('should not advance past Done', () => {
    const duel = createActiveDuel('a1', 'd1', 'a1', 'd1', false, 0, 0, 0);
    duel.phase = DuelPhase.Done;
    const done = tickActiveDuel(duel, 1.0);
    expect(done).toBe(true);
  });
});
