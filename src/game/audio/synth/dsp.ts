/** Small, allocation-light DSP toolkit used by the offline song renderer and SFX. */

export type Rng = () => number;

/** Deterministic PRNG so every render of a song is identical. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Band-limited sawtooth oscillator. */
export class Saw {
  phase: number;
  constructor(phase = 0) {
    this.phase = phase;
  }
  next(freq: number, sr: number): number {
    const dt = freq / sr;
    const p = this.phase;
    this.phase += dt;
    if (this.phase >= 1) this.phase -= 1;
    return 2 * p - 1 - polyBlep(p, dt);
  }
}

/** Band-limited pulse (two saws). */
export class Pulse {
  private a = new Saw();
  private b: Saw;
  constructor(private width = 0.5) {
    this.b = new Saw(width);
  }
  next(freq: number, sr: number): number {
    return (this.a.next(freq, sr) - this.b.next(freq, sr)) * 0.5 + (this.width - 0.5);
  }
}

/**
 * Topology-preserving state-variable filter (Zavalishin). Cutoff may change every sample;
 * coefficients are only recomputed when it moves noticeably.
 */
export class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private g = 0;
  private k = 1;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private lastCutoff = -1;
  constructor(
    private sr: number,
    resonance = 0.2,
  ) {
    this.k = 2 - 2 * Math.min(0.98, Math.max(0, resonance));
  }
  setCutoff(cutoff: number): void {
    const c = Math.min(this.sr * 0.45, Math.max(20, cutoff));
    if (Math.abs(c - this.lastCutoff) < 1) return;
    this.lastCutoff = c;
    this.g = Math.tan((Math.PI * c) / this.sr);
    this.a1 = 1 / (1 + this.g * (this.g + this.k));
    this.a2 = this.g * this.a1;
    this.a3 = this.g * this.a2;
  }
  /** Returns [low, band, high] via out params to avoid allocation. */
  process(v0: number): void {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1;
    this.high = v0 - this.k * v1 - v2;
  }
  low = 0;
  band = 0;
  high = 0;
}

export class OnePole {
  private z = 0;
  private a: number;
  constructor(sr: number, cutoff: number) {
    this.a = Math.exp((-2 * Math.PI * cutoff) / sr);
  }
  lp(x: number): number {
    this.z = x * (1 - this.a) + this.z * this.a;
    return this.z;
  }
}

export function adsr(t: number, dur: number, a: number, d: number, s: number, r: number): number {
  if (t < 0) return 0;
  let level: number;
  if (t < a) level = t / a;
  else if (t < a + d) level = 1 - (1 - s) * ((t - a) / d);
  else level = s;
  if (t > dur) {
    const rt = (t - dur) / r;
    if (rt >= 1) return 0;
    // Level at release start, then linear-ish fade.
    const atRelease = dur < a ? dur / a : dur < a + d ? 1 - (1 - s) * ((dur - a) / d) : s;
    return atRelease * (1 - rt) * (1 - rt);
  }
  return level;
}

export const TWO_PI = Math.PI * 2;

/** 808-style metallic source: six detuned square waves. */
export class Metallic {
  private phases = [0, 0, 0, 0, 0, 0];
  private static freqs = [205.3, 304.4, 369.6, 522.7, 540, 800];
  next(sr: number, scale = 1): number {
    let sum = 0;
    for (let i = 0; i < 6; i++) {
      this.phases[i] += (Metallic.freqs[i] * scale) / sr;
      if (this.phases[i] >= 1) this.phases[i] -= 1;
      sum += this.phases[i] < 0.5 ? 1 : -1;
    }
    return sum / 6;
  }
}
