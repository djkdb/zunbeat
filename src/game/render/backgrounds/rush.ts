import type { Layout } from '../layout';
import { hsl } from '../sprites';
import { offscreen, type Background, type BackgroundFrame } from './types';

interface SpeedLine {
  angle: number;
  dist: number;
  speed: number;
}

/** NEON RUSH: a spinning polygon tunnel and radial speed lines. */
export class RushBackground implements Background {
  private backdrop: HTMLCanvasElement | null = null;
  private travel = 0;
  private spin = 0;
  private lines: SpeedLine[] = Array.from({ length: 48 }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: Math.random(),
    speed: 0.4 + Math.random() * 0.8,
  }));

  resize(l: Layout): void {
    const [c, ctx] = offscreen(l);
    const g = ctx.createRadialGradient(l.width / 2, l.height * 0.34, 0, l.width / 2, l.height * 0.34, Math.max(l.width, l.height));
    g.addColorStop(0, '#2a0838');
    g.addColorStop(0.5, '#0c0214');
    g.addColorStop(1, '#030006');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, l.width, l.height);
    this.backdrop = c;
  }

  draw(ctx: CanvasRenderingContext2D, l: Layout, f: BackgroundFrame): void {
    if (this.backdrop) ctx.drawImage(this.backdrop, 0, 0, l.width, l.height);
    const cx = l.width / 2;
    const cy = l.height * 0.34;
    const motion = f.reducedMotion ? 0.3 : 1;
    const speed = (0.35 + f.energy * 1.2) * (f.fever ? 1.8 : 1) * motion;
    this.travel += f.dt * speed;
    this.spin += f.dt * (0.15 + f.energy * 0.4) * motion;
    const maxR = Math.hypot(l.width, l.height) * 0.75;

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    const rings = 14;
    const baseHue = f.fever ? (f.t * 120) % 360 : 320;
    for (let i = 0; i < rings; i++) {
      const z = ((i + 1 - (this.travel % 1)) / rings) * 1.0;
      const r = (maxR * 0.06) / Math.max(0.04, z);
      if (r > maxR * 1.4) continue;
      const alpha = Math.min(1, (1 - z) * 1.2) * (0.25 + f.energy * 0.35 + f.pulse * 0.3);
      const hue = baseHue + (i % 2) * 60 + (i * 7);
      ctx.strokeStyle = hsl(hue, 100, 62, alpha);
      ctx.lineWidth = (1 + (1 - z) * 4) * (1 + f.pulse * 0.8);
      const sides = i % 3 === 0 ? 3 : 6;
      const rot = this.spin * (i % 2 === 0 ? 1 : -1) + i * 0.2;
      ctx.beginPath();
      for (let k = 0; k <= sides; k++) {
        const a = rot + (k / sides) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // speed lines
    ctx.lineWidth = 2;
    for (const s of this.lines) {
      s.dist += f.dt * s.speed * speed * 1.2;
      if (s.dist > 1) {
        s.dist = 0.05;
        s.angle = Math.random() * Math.PI * 2;
      }
      const d0 = s.dist * s.dist * maxR;
      const d1 = d0 + 20 + s.dist * 140 * (0.5 + f.energy);
      const a = s.dist * (0.25 + f.energy * 0.5);
      ctx.strokeStyle = f.fever ? hsl(f.t * 200 + s.angle * 60, 100, 70, a) : `rgba(255,228,92,${a})`;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(s.angle) * d0, cy + Math.sin(s.angle) * d0);
      ctx.lineTo(cx + Math.cos(s.angle) * d1, cy + Math.sin(s.angle) * d1);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
