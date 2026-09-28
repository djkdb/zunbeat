import { glowSprite } from './sprites';

/**
 * Fixed-size particle pool (struct-of-arrays). Spawning past capacity recycles the
 * oldest slot, so a busy FEVER section can never allocate or grow without bound.
 */
export class ParticleSystem {
  private x: Float32Array;
  private y: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private gravity: Float32Array;
  private color: string[];
  private cursor = 0;

  constructor(private capacity = 700) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.color = new Array(capacity).fill('#ffffff');
  }

  spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, gravity = 900): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.gravity[i] = gravity;
    this.color[i] = color;
  }

  /** Radial-ish burst biased upwards. */
  burst(x: number, y: number, count: number, color: string, speed: number, spread = Math.PI * 0.9): void {
    for (let n = 0; n < count; n++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread * 2;
      const v = speed * (0.35 + Math.random() * 0.8);
      this.spawn(
        x + (Math.random() - 0.5) * 20,
        y,
        Math.cos(angle) * v,
        Math.sin(angle) * v,
        0.2 + Math.random() * 0.3,
        5 + Math.random() * 9,
        Math.random() < 0.25 ? '#ffffff' : color,
        1500,
      );
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.vy[i] += this.gravity[i] * dt;
      this.vx[i] *= 1 - 1.5 * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.capacity; i++) {
      const life = this.life[i];
      if (life <= 0) continue;
      const k = life / this.maxLife[i];
      const s = this.size[i] * (0.4 + 0.6 * k);
      ctx.globalAlpha = Math.min(1, k * 1.4);
      ctx.drawImage(glowSprite(this.color[i]), this.x[i] - s, this.y[i] - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.life.fill(0);
  }
}
