import type { SongTheme } from '../../types';
import type { Layout } from '../layout';
import { glowSprite, hsl, hueOf, mix, withAlpha } from '../sprites';
import { offscreen, type Background, type BackgroundFrame } from './types';

interface Bubble {
  x: number;
  y: number;
  vy: number;
  size: number;
}

/** Layered light ribbons over a deep-sea horizon (OCEAN CIRCUIT). */
export class WavesBackground implements Background {
  private backdrop: HTMLCanvasElement | null = null;
  private phase = 0;
  private hue: number;
  private bubbles: Bubble[] = Array.from({ length: 40 }, () => ({
    x: Math.random(),
    y: Math.random(),
    vy: 0.03 + Math.random() * 0.08,
    size: 3 + Math.random() * 7,
  }));

  constructor(private theme: SongTheme) {
    this.hue = hueOf(theme.accent);
  }

  resize(l: Layout): void {
    const [c, ctx] = offscreen(l);
    const [s0, s1, s2] = this.theme.sky;
    const g = ctx.createLinearGradient(0, 0, 0, l.height);
    g.addColorStop(0, s0);
    g.addColorStop(0.45, s1);
    g.addColorStop(0.55, s2);
    g.addColorStop(1, mix(s0, '#000000', 0.4));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, l.width, l.height);
    const hz = l.height * 0.5;
    const glow = ctx.createRadialGradient(l.width / 2, hz, 0, l.width / 2, hz, l.width * 0.7);
    glow.addColorStop(0, withAlpha(this.theme.accent, 0.35));
    glow.addColorStop(1, withAlpha(this.theme.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, l.width, l.height);
    this.backdrop = c;
  }

  draw(ctx: CanvasRenderingContext2D, l: Layout, f: BackgroundFrame): void {
    if (this.backdrop) ctx.drawImage(this.backdrop, 0, 0, l.width, l.height);
    const motion = f.reducedMotion ? 0.3 : 1;
    this.phase += f.dt * (0.6 + f.energy * 1.4) * (f.fever ? 1.8 : 1) * motion;
    const W = l.width;
    const H = l.height;

    ctx.globalCompositeOperation = 'lighter';
    const ribbons = 6;
    for (let r = 0; r < ribbons; r++) {
      const base = H * (0.3 + r * 0.055);
      const amp = H * (0.02 + f.energy * 0.035 + f.pulse * 0.02) * (1 + r * 0.15);
      const freq = 1.6 + r * 0.45;
      const color = f.fever ? hsl(this.hue + r * 30 + f.t * 90, 100, 65) : r % 2 ? this.theme.accent : this.theme.accent2;
      ctx.strokeStyle = color.startsWith('#') ? withAlpha(color, 0.35 + f.pulse * 0.25) : color;
      ctx.lineWidth = 1.5 + (ribbons - r) * 0.5;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const u = x / W;
        const y =
          base +
          Math.sin(u * Math.PI * freq + this.phase * (1 + r * 0.2) + r) * amp +
          Math.sin(u * Math.PI * freq * 2.3 - this.phase * 0.7) * amp * 0.35;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    for (const b of this.bubbles) {
      b.y -= b.vy * f.dt * motion * (1 + f.energy);
      if (b.y < -0.05) {
        b.y = 1.05;
        b.x = Math.random();
      }
      const s = b.size * (1 + f.pulse * 0.5);
      ctx.globalAlpha = 0.3;
      ctx.drawImage(glowSprite(this.theme.accent), b.x * W - s, b.y * H - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
