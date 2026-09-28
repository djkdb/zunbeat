/** Pre-rendered glow sprites. Drawing images is far cheaper than shadowBlur every frame. */

const glowCache = new Map<string, HTMLCanvasElement>();
const noteCache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** Hard cap so a bug feeding many distinct colours can never leak canvases. */
const MAX_CACHED_GLOWS = 48;

/** Soft radial glow in `color` (hex only), 128×128. */
export function glowSprite(hexColor: string): HTMLCanvasElement {
  const color = HEX_COLOR.test(hexColor) ? hexColor.toLowerCase() : '#ffffff';
  let s = glowCache.get(color);
  if (s) return s;
  if (glowCache.size >= MAX_CACHED_GLOWS) glowCache.clear();
  const [c, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, color);
  g.addColorStop(0.5, withAlpha(color, 0.35));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowCache.set(color, c);
  s = c;
  return s;
}

export const NOTE_SPRITE_W = 256;
export const NOTE_SPRITE_H = 96;
/** Body occupies this rect inside the sprite (rest is glow). */
export const NOTE_BODY = { x: 20, y: 28, w: 216, h: 40 };

/** Note body with bevel, bright core line and outer glow. */
export function noteSprite(
  color: string,
  variant: 'normal' | 'double' | 'rapid' | 'burst' | 'dim' | 'roll' | 'release',
): HTMLCanvasElement {
  const key = `${color}|${variant}`;
  let s = noteCache.get(key);
  if (s) return s;
  const [c, ctx] = makeCanvas(NOTE_SPRITE_W, NOTE_SPRITE_H);
  const { x, y, w, h } = NOTE_BODY;
  const main = variant === 'dim' ? '#4a4a5a' : color;
  if (variant !== 'dim') {
    ctx.shadowColor = main;
    ctx.shadowBlur = 22;
  }
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, mix(main, '#ffffff', 0.65));
  grad.addColorStop(0.45, main);
  grad.addColorStop(1, mix(main, '#000000', 0.45));
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.shadowBlur = 0;
  // inner core line
  ctx.fillStyle = variant === 'dim' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.95)';
  roundRect(ctx, x + 14, y + h * 0.36, w - 28, h * 0.2, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 9);
  ctx.stroke();
  if (variant === 'rapid') {
    // chevrons
    ctx.fillStyle = 'rgba(10,10,30,0.55)';
    for (const cx of [x + w * 0.3, x + w * 0.5, x + w * 0.7]) {
      ctx.beginPath();
      ctx.moveTo(cx - 12, y + 8);
      ctx.lineTo(cx, y + h - 8);
      ctx.lineTo(cx + 12, y + 8);
      ctx.lineTo(cx + 6, y + 8);
      ctx.lineTo(cx, y + h - 20);
      ctx.lineTo(cx - 6, y + 8);
      ctx.closePath();
      ctx.fill();
    }
  } else if (variant === 'burst') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const cx of [x + 18, x + w - 18]) {
      ctx.beginPath();
      ctx.moveTo(cx, y + 6);
      ctx.lineTo(cx + 7, y + h / 2);
      ctx.lineTo(cx, y + h - 6);
      ctx.lineTo(cx - 7, y + h / 2);
      ctx.closePath();
      ctx.fill();
    }
  } else if (variant === 'roll') {
    // bold hazard stripes = "mash me"
    ctx.save();
    roundRect(ctx, x, y, w, h, 10);
    ctx.clip();
    ctx.strokeStyle = 'rgba(30,15,0,0.55)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (let sx = x - h; sx < x + w + h; sx += 26) {
      ctx.moveTo(sx, y + h);
      ctx.lineTo(sx + h, y);
    }
    ctx.stroke();
    ctx.restore();
  } else if (variant === 'release') {
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 12);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (variant === 'double') {
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 4;
    roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 13);
    ctx.stroke();
  }
  noteCache.set(key, c);
  s = c;
  return s;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

export function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h % 360},${s}%,${l}%,${a})`;
}

/** Hue (0–360) of a hex colour. */
export function hueOf(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
