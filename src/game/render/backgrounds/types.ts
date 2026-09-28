import type { Layout } from '../layout';

export interface BackgroundFrame {
  t: number;
  dt: number;
  /** Kick pulse 0–1. */
  pulse: number;
  /** Section energy 0–1. */
  energy: number;
  fever: boolean;
  /** 0–1 flash after a section change into a drop. */
  flash: number;
  reducedMotion: boolean;
}

export interface Background {
  resize(layout: Layout): void;
  draw(ctx: CanvasRenderingContext2D, layout: Layout, frame: BackgroundFrame): void;
}

export function offscreen(layout: Layout): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(layout.width * layout.dpr));
  c.height = Math.max(1, Math.round(layout.height * layout.dpr));
  const ctx = c.getContext('2d')!;
  ctx.scale(layout.dpr, layout.dpr);
  return [c, ctx];
}
