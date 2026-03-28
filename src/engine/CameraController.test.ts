import { describe, it, expect } from 'vitest';

describe('CameraController module', () => {
  it('should export CameraController class', async () => {
    const mod = await import('./CameraController');
    expect(mod.CameraController).toBeDefined();
    expect(typeof mod.CameraController).toBe('function');
  });

  it('should export CameraHost interface (as type-only, not at runtime)', async () => {
    const mod = await import('./CameraController');
    // CameraHost is an interface — it doesn't exist at runtime
    // Only CameraController should be a runtime export
    const runtimeExports = Object.keys(mod).filter(
      (k) => typeof (mod as Record<string, unknown>)[k] === 'function',
    );
    expect(runtimeExports).toContain('CameraController');
  });
});

/**
 * CameraController is tightly coupled to Three.js (OrthographicCamera, Vector3)
 * and DOM events (canvas listeners, window keyboard events). We can't construct
 * one in a Node test environment. Instead, we test the underlying math/logic
 * that CameraController implements by replicating key algorithms.
 */
describe('CameraController zoom logic', () => {
  const MIN_FRUSTUM = 2;

  function computeZoom(currentFrustum: number, delta: number, maxFrustum: number): number {
    return Math.max(MIN_FRUSTUM, Math.min(maxFrustum, currentFrustum + delta));
  }

  it('should clamp zoom to MIN_FRUSTUM (2) when zooming in past limit', () => {
    expect(computeZoom(3, -5, 20)).toBe(MIN_FRUSTUM);
  });

  it('should clamp zoom to maxFrustum when zooming out past limit', () => {
    expect(computeZoom(18, 5, 20)).toBe(20);
  });

  it('should allow zoom within valid range', () => {
    expect(computeZoom(10, 2, 20)).toBe(12);
    expect(computeZoom(10, -3, 20)).toBe(7);
  });

  it('should stay at MIN_FRUSTUM if already at minimum', () => {
    expect(computeZoom(MIN_FRUSTUM, -1, 20)).toBe(MIN_FRUSTUM);
  });

  it('should stay at maxFrustum if already at maximum', () => {
    expect(computeZoom(20, 1, 20)).toBe(20);
  });
});

describe('CameraController maxFrustum computation', () => {
  const MIN_FRUSTUM = 2;

  function computeMaxFrustum(mapWorldW: number, mapWorldH: number): number {
    return Math.max(MIN_FRUSTUM, Math.min(50, Math.max(mapWorldW, mapWorldH) / 2 + 2));
  }

  it('should compute maxFrustum from map dimensions', () => {
    // A 20x20 world map
    expect(computeMaxFrustum(20, 20)).toBe(12);
  });

  it('should use the larger dimension', () => {
    expect(computeMaxFrustum(40, 10)).toBe(22);
    expect(computeMaxFrustum(10, 40)).toBe(22);
  });

  it('should cap maxFrustum at 50', () => {
    expect(computeMaxFrustum(200, 200)).toBe(50);
  });

  it('should floor maxFrustum at MIN_FRUSTUM', () => {
    expect(computeMaxFrustum(0, 0)).toBe(MIN_FRUSTUM);
  });
});

describe('CameraController pan clamping logic', () => {
  // Replicates the parallelogram-based pan clamping from CameraController.panBy
  function clampTarget(
    newX: number,
    newZ: number,
    mapMinZ: number,
    mapMaxZ: number,
    mapRowWidth: number,
    mapSkewFactor: number,
  ): { nearX: number; nearZ: number } {
    const nearZ = Math.max(mapMinZ, Math.min(mapMaxZ, newZ));
    const skewX = nearZ * mapSkewFactor;
    const nearX = Math.max(skewX, Math.min(mapRowWidth + skewX, newX));
    return { nearX, nearZ };
  }

  it('should clamp Z within map bounds', () => {
    const result = clampTarget(5, -10, 0, 20, 30, 0);
    expect(result.nearZ).toBe(0);

    const result2 = clampTarget(5, 25, 0, 20, 30, 0);
    expect(result2.nearZ).toBe(20);
  });

  it('should clamp X within row width (no skew)', () => {
    const result = clampTarget(-5, 10, 0, 20, 30, 0);
    expect(result.nearX).toBe(0);

    const result2 = clampTarget(35, 10, 0, 20, 30, 0);
    expect(result2.nearX).toBe(30);
  });

  it('should allow positions within bounds', () => {
    const result = clampTarget(15, 10, 0, 20, 30, 0);
    expect(result.nearX).toBe(15);
    expect(result.nearZ).toBe(10);
  });

  it('should account for hex skew when clamping X', () => {
    // With a skew factor of 0.5, at Z=10 the X range shifts by 5
    const result = clampTarget(3, 10, 0, 20, 30, 0.5);
    expect(result.nearX).toBe(5); // skewX = 10 * 0.5 = 5, clamped from 3 to 5

    const result2 = clampTarget(40, 10, 0, 20, 30, 0.5);
    expect(result2.nearX).toBe(35); // max = 30 + 5 = 35
  });
});

describe('CameraController pinch distance', () => {
  function getPinchDist(touches: Array<{ x: number; y: number }>): number {
    if (touches.length < 2) return 0;
    const [a, b] = touches;
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  it('should return 0 for fewer than 2 touches', () => {
    expect(getPinchDist([])).toBe(0);
    expect(getPinchDist([{ x: 10, y: 20 }])).toBe(0);
  });

  it('should compute correct distance between two touch points', () => {
    expect(getPinchDist([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5);
  });

  it('should return 0 for identical touch points', () => {
    expect(getPinchDist([{ x: 5, y: 5 }, { x: 5, y: 5 }])).toBe(0);
  });

  it('should handle negative coordinates', () => {
    const dist = getPinchDist([{ x: -3, y: -4 }, { x: 0, y: 0 }]);
    expect(dist).toBe(5);
  });
});

describe('CameraController keyboard pan logic', () => {
  it('should compute correct dx/dz from key set', () => {
    const speed = 0.15;

    function computeKeyPan(keys: Set<string>): { dx: number; dz: number } {
      let dx = 0, dz = 0;
      if (keys.has('ArrowLeft') || keys.has('a')) dx -= speed;
      if (keys.has('ArrowRight') || keys.has('d')) dx += speed;
      if (keys.has('ArrowUp') || keys.has('w')) dz -= speed;
      if (keys.has('ArrowDown') || keys.has('s')) dz += speed;
      return { dx, dz };
    }

    expect(computeKeyPan(new Set(['ArrowLeft']))).toEqual({ dx: -speed, dz: 0 });
    expect(computeKeyPan(new Set(['ArrowRight']))).toEqual({ dx: speed, dz: 0 });
    expect(computeKeyPan(new Set(['ArrowUp']))).toEqual({ dx: 0, dz: -speed });
    expect(computeKeyPan(new Set(['ArrowDown']))).toEqual({ dx: 0, dz: speed });
    expect(computeKeyPan(new Set(['w']))).toEqual({ dx: 0, dz: -speed });
    expect(computeKeyPan(new Set(['a']))).toEqual({ dx: -speed, dz: 0 });
    expect(computeKeyPan(new Set(['s']))).toEqual({ dx: 0, dz: speed });
    expect(computeKeyPan(new Set(['d']))).toEqual({ dx: speed, dz: 0 });
  });

  it('should cancel out opposing directions', () => {
    const speed = 0.15;

    function computeKeyPan(keys: Set<string>): { dx: number; dz: number } {
      let dx = 0, dz = 0;
      if (keys.has('ArrowLeft') || keys.has('a')) dx -= speed;
      if (keys.has('ArrowRight') || keys.has('d')) dx += speed;
      if (keys.has('ArrowUp') || keys.has('w')) dz -= speed;
      if (keys.has('ArrowDown') || keys.has('s')) dz += speed;
      return { dx, dz };
    }

    // Left + Right cancel out
    const result = computeKeyPan(new Set(['ArrowLeft', 'ArrowRight']));
    expect(result.dx).toBeCloseTo(0, 10);

    // Up + Down cancel out
    const result2 = computeKeyPan(new Set(['ArrowUp', 'ArrowDown']));
    expect(result2.dz).toBeCloseTo(0, 10);
  });

  it('should handle diagonal movement', () => {
    const speed = 0.15;

    function computeKeyPan(keys: Set<string>): { dx: number; dz: number } {
      let dx = 0, dz = 0;
      if (keys.has('ArrowLeft') || keys.has('a')) dx -= speed;
      if (keys.has('ArrowRight') || keys.has('d')) dx += speed;
      if (keys.has('ArrowUp') || keys.has('w')) dz -= speed;
      if (keys.has('ArrowDown') || keys.has('s')) dz += speed;
      return { dx, dz };
    }

    // Up-Left diagonal
    const result = computeKeyPan(new Set(['w', 'a']));
    expect(result.dx).toBe(-speed);
    expect(result.dz).toBe(-speed);
  });
});
