import type { SongTheme } from '../../types';
import type { Layout } from '../layout';
import { glowSprite, mix, withAlpha } from '../sprites';
import { offscreen, type Background, type BackgroundFrame } from './types';

interface Star {
  x: number;
  y: number;
  z: number;
}

const STAR_COUNT = 220;
const DEPTH = 1;

/** Warp-speed starfield over a soft nebula (STARLIGHT PARADE, LOFI MOONRISE). */
export class StarsBackground implements Background {
  private backdrop: HTMLCanvasElement | null = null;
  private stars: Star[] = Array.from({ length: STAR_COUNT }, () => this.spawn(Math.random() * DEPTH));

  constructor(private theme: SongTheme) {}

  private spawn(z: number): Star {
    return { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.max(0.02, z) };
  }

  resize(l: Layout): void {
    const [c, ctx] = offscreen(l);
    const [s0, s1, s2] = this.theme.sky;
    const g = ctx.createLinearGradient(0, 0, 0, l.height);
    g.addColorStop(0, s0);
    g.addColorStop(0.6, s1);
    g.addColorStop(1, s2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, l.width, l.height);
    // nebula clouds
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = rnd() * l.width;
      const y = rnd() * l.height * 0.7;
      const r = (0.25 + rnd() * 0.35) * Math.max(l.width, l.height);
      const color = i % 2 ? this.theme.accent : this.theme.accent2;
      const n = ctx.createRadialGradient(x, y, 0, x, y, r);
      n.addColorStop(0, withAlpha(color, 0.16));
      n.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = n;
      ctx.fillRect(0, 0, l.width, l.height);
    }
    // static distant stars
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`;
      const s = rnd() * 1.4 + 0.3;
      ctx.fillRect(rnd() * l.width, rnd() * l.height, s, s);
    }
    this.backdrop = c;
  }

  draw(ctx: CanvasRenderingContext2D, l: Layout, f: BackgroundFrame): void {
    if (this.backdrop) ctx.drawImage(this.backdrop, 0, 0, l.width, l.height);
    const cx = l.width / 2;
    const cy = l.height * 0.36;
    const scale = Math.max(l.width, l.height) * 0.5;
    const speed = (0.08 + f.energy * 0.45) * (f.fever ? 2.2 : 1) * (f.reducedMotion ? 0.3 : 1);
    const trail = 0.012 + f.energy * 0.03 + (f.fever ? 0.05 : 0);
    const light = mix(this.theme.accent2, '#ffffff', 0.6);

    ctx.globalCompositeOperation = 'lighter';
    // core glow pulses with the kick
    const g = scale * (0.35 + f.pulse * 0.08 + f.energy * 0.1);
    ctx.globalAlpha = 0.18 + f.pulse * 0.2;
    ctx.drawImage(glowSprite(this.theme.accent), cx - g, cy - g, g * 2, g * 2);
    ctx.globalAlpha = 1;

    ctx.lineCap = 'round';
    for (let i = 0; i < this.stars.length; i++) {
      const st = this.stars[i];
      st.z -= speed * f.dt;
      if (st.z <= 0.02) {
        this.stars[i] = this.spawn(DEPTH);
        continue;
      }
      const px = cx + (st.x / st.z) * scale * 0.25;
      const py = cy + (st.y / st.z) * scale * 0.25;
      if (px < -20 || px > l.width + 20 || py < -20 || py > l.height + 20) {
        this.stars[i] = this.spawn(DEPTH);
        continue;
      }
      const tz = st.z + trail;
      const qx = cx + (st.x / tz) * scale * 0.25;
      const qy = cy + (st.y / tz) * scale * 0.25;
      const near = 1 - st.z / DEPTH;
      ctx.strokeStyle = withAlpha(i % 3 === 0 ? this.theme.accent : light, Math.min(1, near * (0.6 + f.pulse * 0.4)));
      ctx.lineWidth = 0.6 + near * 2.4;
      ctx.beginPath();
      ctx.moveTo(qx, qy);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
