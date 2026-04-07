import { describe, test, expect } from 'vitest';
import { GameRng } from './GameRng';

describe('GameRng', () => {
  test('two instances with same seed produce identical sequences', () => {
    const a = new GameRng(42);
    const b = new GameRng(42);
    for (let i = 0; i < 1000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  test('different seeds produce different sequences', () => {
    const a = new GameRng(1);
    const b = new GameRng(2);
    // At least one of the first 10 values should differ
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (a.next() !== b.next()) allSame = false;
    }
    expect(allSame).toBe(false);
  });

  test('next() returns values in [0, 1)', () => {
    const rng = new GameRng(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('nextInt(max) returns integers in [0, max)', () => {
    const rng = new GameRng(99);
    for (let i = 0; i < 500; i++) {
      const v = rng.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  test('shuffle is deterministic', () => {
    const a = new GameRng(7);
    const b = new GameRng(7);
    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    a.shuffle(arr1);
    b.shuffle(arr2);
    expect(arr1).toEqual(arr2);
  });

  test('shuffle modifies the array in place', () => {
    const rng = new GameRng(7);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const original = [...arr];
    const returned = rng.shuffle(arr);
    expect(returned).toBe(arr); // same reference
    // With 10 elements and seed 7, extremely unlikely to remain identical
    expect(arr).not.toEqual(original);
  });

  test('getState/setState preserves sequence', () => {
    const rng = new GameRng(555);
    // Advance 50 steps
    for (let i = 0; i < 50; i++) rng.next();
    const state = rng.getState();

    // Capture next 20 values
    const expected: number[] = [];
    for (let i = 0; i < 20; i++) expected.push(rng.next());

    // Restore and replay
    rng.setState(state);
    for (let i = 0; i < 20; i++) {
      expect(rng.next()).toBe(expected[i]);
    }
  });

  test('getState/setState across instances', () => {
    const rng1 = new GameRng(100);
    for (let i = 0; i < 30; i++) rng1.next();
    const state = rng1.getState();

    const rng2 = new GameRng(0); // different initial seed
    rng2.setState(state);

    // Both should produce identical sequences from here
    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  test('matches noise.ts createRng output', async () => {
    // Verify our inline mulberry32 matches the existing implementation
    const { createRng } = await import('./noise');
    const seeded = createRng(42);
    const rng = new GameRng(42);
    for (let i = 0; i < 100; i++) {
      expect(rng.next()).toBe(seeded());
    }
  });
});
