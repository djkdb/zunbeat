import { useEffect, useRef } from 'react';
import { glowSprite } from '../../game/render/sprites';

interface Props {
  accent?: string;
  accent2?: string;
  /** Pulse tempo for the waveform/grid. */
  bpm?: number;
  reducedMotion?: boolean;
}

interface Mote {
  x: number;
  y: number;
  vy: number;
  size: number;
  hue: 0 | 1;
}

/** Lightweight animated backdrop for menus: moving grid, waveform, drifting motes. */
export function MenuBackground({ accent = '#ff3d8b', accent2 = '#3dc8ff', bpm = 120, reducedMotion = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ accent, accent2, bpm, reducedMotion });
  useEffect(() => {
    props.current = { accent, accent2, bpm, reducedMotion };
  }, [accent, accent2, bpm, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    const motes: Mote[] = Array.from({ length: 50 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vy: 0.01 + Math.random() * 0.04,
      size: 2 + Math.random() * 5,
      hue: Math.random() < 0.5 ? 0 : 1,
    }));
    let raf = 0;
    let last = performance.now();
    let travel = 0;
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = props.current;
      const motion = p.reducedMotion ? 0.25 : 1;
      const t = now / 1000;
      const beat = (t * p.bpm) / 60;
      const pulse = p.reducedMotion ? 0 : Math.exp(-(beat % 1) * 5);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#05030b');
      bg.addColorStop(0.6, '#0b0618');
      bg.addColorStop(1, '#12051c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // grid floor
      const horizon = h * 0.62;
      travel += dt * 0.5 * motion;
      ctx.strokeStyle = hexA(p.accent, 0.14 + pulse * 0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const d = i + 1 - (travel % 1);
        const y = horizon + (h - horizon) / d;
        if (y > h) continue;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      for (let i = -12; i <= 12; i++) {
        ctx.moveTo(w / 2, horizon);
        ctx.lineTo(w / 2 + (i / 12) * w * 2, h);
      }
      ctx.stroke();

      // waveform
      ctx.globalCompositeOperation = 'lighter';
      for (let layer = 0; layer < 3; layer++) {
        const color = layer === 1 ? p.accent2 : p.accent;
        ctx.strokeStyle = hexA(color, 0.5 - layer * 0.12);
        ctx.lineWidth = 2 - layer * 0.5;
        ctx.beginPath();
        const amp = h * (0.035 + pulse * 0.03) * (1 + layer * 0.35);
        for (let x = 0; x <= w; x += 6) {
          const u = x / w;
          const env = Math.sin(u * Math.PI);
          const y =
            horizon -
            h * 0.02 +
            env * amp * (Math.sin(u * 22 + t * 2.1 * motion + layer) * 0.6 + Math.sin(u * 51 - t * 3.3 * motion) * 0.4);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // motes
      for (const m of motes) {
        m.y -= m.vy * dt * motion;
        if (m.y < -0.05) {
          m.y = 1.05;
          m.x = Math.random();
        }
        const s = m.size * (1 + pulse * 0.4);
        ctx.globalAlpha = 0.35;
        ctx.drawImage(glowSprite(m.hue ? p.accent2 : p.accent), m.x * w - s, m.y * h - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // vignette
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="menu-bg" aria-hidden="true" />;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
