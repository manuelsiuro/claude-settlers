/**
 * Deterministic seeded pseudo-random number generator for game logic.
 * Uses the mulberry32 algorithm (same as noise.ts createRng).
 *
 * All game-logic randomness MUST go through this class to ensure
 * deterministic lockstep in multiplayer. Visual-only randomness
 * (particles, animations, weather) may still use Math.random().
 *
 * The internal state is a single 32-bit integer, trivially serializable
 * for save/load and multiplayer state sync.
 */
export class GameRng {
  private s: number;

  constructor(seed: number) {
    this.s = seed | 0;
  }

  /** Returns a value in [0, 1). Advances internal state by one step. */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [0, max). */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Fisher-Yates shuffle (in-place, deterministic). Returns the array. */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /** Snapshot internal state for save/load. */
  getState(): number {
    return this.s;
  }

  /** Restore internal state from a snapshot. */
  setState(s: number): void {
    this.s = s | 0;
  }
}
