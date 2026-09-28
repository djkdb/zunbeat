import type { SongTheme } from '../../types';
import type { Layout } from '../layout';
import { glowSprite, mix, withAlpha } from '../sprites';
import { offscreen, type Background, type BackgroundFrame } from './types';

/** Synthwave sunset, mountains and an endless neon grid (MIDNIGHT DRIVE, SOLAR FLARE). */
export class HighwayBackground implements Background {
  private backdrop: HTMLCanvasElement | null = null;
  private travel = 0;

  constructor(private theme: SongTheme) {}

  resize(l: Layout): void {
    const [c, ctx] = offscreen(l);
    const W = l.width;
    const H = l.height;
    const horizon = H * 0.46;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    const [s0, s1, s2] = this.theme.sky;
    sky.addColorStop(0, s0);
    sky.addColorStop(0.55, s1);
    sky.addColorStop(1, s2);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);
    const floor = ctx.createLinearGradient(0, horizon, 0, H);
    floor.addColorStop(0, mix(s1, '#000000', 0.25));
    floor.addColorStop(1, mix(s0, '#000000', 0.5));
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizon, W, H - horizon);
    // stars
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
      const s = rnd() * 1.6 + 0.3;
      ctx.fillRect(rnd() * W, rnd() * horizon * 0.85, s, s);
    }
    // sun
    const r = Math.min(W, H) * 0.2;
    const sx = W / 2;
    const sy = horizon - r * 0.35;
    const sun = ctx.createLinearGradient(0, sy - r, 0, sy + r);
    sun.addColorStop(0, mix(this.theme.accent2, '#ffffff', 0.25));
    sun.addColorStop(0.5, mix(this.theme.accent2, this.theme.accent, 0.5));
    sun.addColorStop(1, this.theme.accent);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = sun;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) {
      const y = sy + r * (0.05 + i * 0.14);
      ctx.fillRect(sx - r, y, r * 2, 2 + i * 1.6);
    }
    ctx.restore();
    // mountains
    ctx.fillStyle = mix(s0, s1, 0.5);
    ctx.strokeStyle = withAlpha(this.theme.accent, 0.55);
    ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + side * r * 0.9, horizon);
      let x = W / 2 + side * r * 0.9;
      let i = 0;
      while ((side < 0 && x > -40) || (side > 0 && x < W + 40)) {
        x += side * (30 + rnd() * 60);
        const peak = horizon - (20 + rnd() * H * 0.1) * (i % 2 === 0 ? 1 : 0.4);
        ctx.lineTo(x, peak);
        i++;
      }
      ctx.lineTo(x, horizon);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    this.backdrop = c;
  }

  draw(ctx: CanvasRenderingContext2D, l: Layout, f: BackgroundFrame): void {
    const W = l.width;
    const H = l.height;
    const horizon = H * 0.46;
    if (this.backdrop) ctx.drawImage(this.backdrop, 0, 0, W, H);

    const speed = (0.6 + f.energy * 1.6) * (f.fever ? 1.8 : 1) * (f.reducedMotion ? 0.3 : 1);
    this.travel += f.dt * speed;

    // sun glow pulse
    const r = Math.min(W, H) * 0.2;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + f.pulse * 0.25 + (f.fever ? 0.2 : 0);
    const g = r * (2.6 + f.pulse * 0.4);
    ctx.drawImage(glowSprite(this.theme.accent), W / 2 - g, horizon - r * 0.35 - g, g * 2, g * 2);
    ctx.globalAlpha = 1;

    // grid
    const lineAlpha = 0.28 + f.pulse * 0.35 + f.energy * 0.15;
    ctx.strokeStyle = withAlpha(f.fever ? this.theme.accent2 : this.theme.accent, Math.min(1, lineAlpha));
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const depth = H - horizon;
    const frac = this.travel % 1;
    for (let i = 0; i < 26; i++) {
      const d = i + 1 - frac;
      if (d <= 0.05) continue;
      const y = horizon + depth / d;
      if (y > H) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    const spread = W * 3;
    for (let i = -16; i <= 16; i++) {
      ctx.moveTo(W / 2, horizon);
      ctx.lineTo(W / 2 + (i / 16) * spread, H);
    }
    ctx.stroke();
    // horizon line
    ctx.fillStyle = withAlpha(mix(this.theme.accent, '#ffffff', 0.3), Math.min(1, 0.6 + f.pulse * 0.4));
    ctx.fillRect(0, horizon - 1, W, 2);
    ctx.globalCompositeOperation = 'source-over';
  }
}
