/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Returns a function that produces values in [0, 1).
 */
export function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 2D value noise with seeded RNG for procedural map generation.
 * Uses smooth interpolation for natural-looking terrain.
 */
export class SeededNoise {
  private permutation: number[];

  constructor(seed: number) {
    const rng = createRng(seed);
    // Generate permutation table
    this.permutation = new Array(512);
    const p = new Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.permutation[i] = p[i & 255];
    }
  }

  /** Get noise value at (x, y), returns value in approximately [-1, 1] */
  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Smooth interpolation
    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.permutation[this.permutation[X] + Y];
    const ab = this.permutation[this.permutation[X] + Y + 1];
    const ba = this.permutation[this.permutation[X + 1] + Y];
    const bb = this.permutation[this.permutation[X + 1] + Y + 1];

    const gradAA = this.grad(aa, xf, yf);
    const gradBA = this.grad(ba, xf - 1, yf);
    const gradAB = this.grad(ab, xf, yf - 1);
    const gradBB = this.grad(bb, xf - 1, yf - 1);

    const lerpX1 = this.lerp(gradAA, gradBA, u);
    const lerpX2 = this.lerp(gradAB, gradBB, u);

    return this.lerp(lerpX1, lerpX2, v);
  }

  /** Multi-octave fractal noise for more natural terrain */
  fbm(x: number, y: number, octaves: number, lacunarity = 2.0, gain = 0.5): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxAmplitude += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return value / maxAmplitude;
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    switch (h) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      default: return 0;
    }
  }
}
