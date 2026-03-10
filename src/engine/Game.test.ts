import { describe, it, expect } from 'vitest';

describe('Game module', () => {
  it('should export Game class', async () => {
    const mod = await import('./Game');
    expect(mod.Game).toBeDefined();
    expect(typeof mod.Game).toBe('function');
  });
});
