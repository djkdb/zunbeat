import type { SongTheme } from '../../types';
import type { Layout } from '../layout';
import { mix, withAlpha } from '../sprites';
import { offscreen, type Background, type BackgroundFrame } from './types';

const GLYPHS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF#$%&';
const CELL = 22;

interface Stream {
  x: number;
  head: number;
  speed: number;
  length: number;
  seed: number;
}

/** Falling glyph streams and vertical light pillars (DIGITAL RAIN, GLITCH GARDEN). */
export class RainBackground implements Background {
  constructor(private theme: SongTheme) {}

  private backdrop: HTMLCanvasElement | null = null;
  private atlas: HTMLCanvasElement | null = null;
  private atlasBright: HTMLCanvasElement | null = null;
  private streams: Stream[] = [];

  resize(l: Layout): void {
    const [c, ctx] = offscreen(l);
    const g = ctx.createLinearGradient(0, 0, 0, l.height);
    g.addColorStop(0, this.theme.sky[1]);
    g.addColorStop(1, this.theme.sky[0]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, l.width, l.height);
    this.backdrop = c;
    this.atlas = this.makeAtlas(mix(this.theme.accent, '#000000', 0.12));
    this.atlasBright = this.makeAtlas(mix(this.theme.accent, '#ffffff', 0.8));
    const count = Math.ceil(l.width / (CELL * 1.25));
    this.streams = Array.from({ length: count }, (_, i) => ({
      x: i * CELL * 1.25 + CELL / 2,
      head: Math.random() * l.height,
      speed: 90 + Math.random() * 200,
      length: 6 + Math.floor(Math.random() * 16),
      seed: Math.floor(Math.random() * 1000),
    }));
  }

  private makeAtlas(color: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = CELL * 2 * GLYPHS.length;
    c.height = CELL * 2;
    const ctx = c.getContext('2d')!;
    ctx.font = `bold ${CELL * 1.5}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    for (let i = 0; i < GLYPHS.length; i++) ctx.fillText(GLYPHS[i], i * CELL * 2 + CELL, CELL);
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, l: Layout, f: BackgroundFrame): void {
    if (this.backdrop) ctx.drawImage(this.backdrop, 0, 0, l.width, l.height);
    const atlas = this.atlas;
    const bright = this.atlasBright;
    if (!atlas || !bright) return;
    const speedMul = (0.5 + f.energy * 1.3) * (f.fever ? 1.9 : 1) * (f.reducedMotion ? 0.3 : 1);

    // light pillars
    ctx.globalCompositeOperation = 'lighter';
    const pillars = 5;
    for (let i = 0; i < pillars; i++) {
      const x = ((i + 0.5) / pillars) * l.width + Math.sin(f.t * 0.3 + i) * 40;
      const w = 60 + f.energy * 80;
      const a = (0.04 + f.pulse * 0.1 * f.energy) * (f.fever ? 1.8 : 1);
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, withAlpha(this.theme.accent, 0));
      g.addColorStop(0.5, withAlpha(this.theme.accent, Math.min(1, a)));
      g.addColorStop(1, withAlpha(this.theme.accent, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w, 0, w * 2, l.height);
    }
    ctx.globalCompositeOperation = 'source-over';

    const flip = Math.floor(f.t * 8);
    for (const s of this.streams) {
      s.head += s.speed * speedMul * f.dt;
      if (s.head - s.length * CELL > l.height) {
        s.head = -Math.random() * l.height * 0.5;
        s.speed = 90 + Math.random() * 200;
        s.length = 6 + Math.floor(Math.random() * 16);
      }
      const headCell = Math.floor(s.head / CELL);
      for (let k = 0; k < s.length; k++) {
        const cell = headCell - k;
        const y = cell * CELL;
        if (y < -CELL || y > l.height) continue;
        const gi = (cell * 7 + s.seed + (k === 0 ? flip : 0)) % GLYPHS.length;
        const idx = gi < 0 ? gi + GLYPHS.length : gi;
        const alpha = k === 0 ? 1 : (1 - k / s.length) * (0.35 + f.energy * 0.35 + f.pulse * 0.2);
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.drawImage(k === 0 ? bright : atlas, idx * CELL * 2, 0, CELL * 2, CELL * 2, s.x - CELL / 2, y, CELL, CELL);
      }
    }
    ctx.globalAlpha = 1;
  }
}
