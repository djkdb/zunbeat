import { LANE_COUNT } from '../constants';
import { NOTE_TYPES } from '../config/noteTypes';
import type { GameEngine, GamePresenter, JudgmentPresentation } from '../engine/GameEngine';
import { NS } from '../engine/JudgmentSystem';
import type { Judgment, Note, SongTheme } from '../types';
import { createBackground, type Background } from './backgrounds';
import { computeLayout, scaleAt, xAt, yAt, zAtY, type Layout } from './layout';
import { ParticleSystem } from './particles';
import { NOTE_BODY, NOTE_SPRITE_H, NOTE_SPRITE_W, glowSprite, hsl, mix, noteSprite, roundRect, withAlpha } from './sprites';

/** Seconds a note is visible at 1× speed. */
export const BASE_VISIBLE_SECONDS = 1.8;
const MAX_DPR = 2;
const MAX_RINGS = 24;

export interface RendererOptions {
  theme: SongTheme;
  noteSpeed: number;
  reducedMotion: boolean;
  keyLabels: string[];
}

interface Ring {
  lane: number;
  age: number;
  life: number;
  color: string;
  size: number;
}

/** Fixed hex palette for FEVER particles (glow sprites are cached per colour). */
const FEVER_PALETTE = ['#ff3d8b', '#ffe45c', '#3dffb0', '#3dc8ff', '#c86bff'];

const JUDGE_COLOR: Record<Judgment, string> = {
  perfect: '#8ffcff',
  great: '#9dff7a',
  good: '#6a8cff',
  miss: '#ff3355',
};

/**
 * Draws the whole play scene on one canvas: background, highway, notes, effects.
 * Implements GamePresenter so the engine can trigger effects directly.
 */
export class PlayfieldRenderer implements GamePresenter {
  layout: Layout;
  private ctx: CanvasRenderingContext2D;
  private bg: Background;
  private particles = new ParticleSystem(720);
  private rings: Ring[] = [];
  private laneFlash = new Float32Array(LANE_COUNT);
  private laneFlashColor: string[] = new Array(LANE_COUNT).fill('#ffffff');
  private receptorPulse = new Float32Array(LANE_COUNT);
  private screenFlash = 0;
  private screenFlashColor = '#ffffff';
  private missFlash = 0;
  private shake = 0;
  private zoomPunch = 0;
  private dropFlash = 0;
  private perfectStreak = 0;
  private shockwaves: { age: number; strength: number }[] = [];
  private feverTime = 0;
  private fever = false;
  private renderStart = 0;
  private visibleSeconds: number;
  private opts: RendererOptions;

  constructor(
    private canvas: HTMLCanvasElement,
    opts: RendererOptions,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.opts = opts;
    this.visibleSeconds = BASE_VISIBLE_SECONDS / Math.max(0.5, opts.noteSpeed);
    this.bg = createBackground(opts.theme.background);
    this.layout = computeLayout(1, 1, 1);
  }

  resize(width: number, height: number): void {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.layout = computeLayout(width, height, dpr);
    this.bg.resize(this.layout);
  }

  // ------------------------------------------------------------------ presenter hooks

  judgment(e: JudgmentPresentation): void {
    const l = this.layout;
    const x = xAt(l, e.lane + 0.5, 1);
    const y = l.judgeY;
    const laneColor = this.opts.theme.laneColors[e.lane];
    const motion = this.opts.reducedMotion ? 0.5 : 1;
    const feverBoost = e.fever ? 1.6 : 1;
    switch (e.judgment) {
      case 'perfect': {
        this.perfectStreak++;
        this.addRing(e.lane, '#ffffff', 1.25, 0.38);
        this.addRing(e.lane, laneColor, 1, 0.3);
        this.flashLane(e.lane, laneColor, 1);
        this.particles.burst(x, y, Math.round(16 * feverBoost * motion), laneColor, 780);
        this.screenFlash = Math.max(this.screenFlash, 0.35);
        this.screenFlashColor = e.fever ? hsl(this.feverTime * 240, 100, 70) : '#ffffff';
        break;
      }
      case 'great':
        this.perfectStreak = 0;
        this.addRing(e.lane, laneColor, 0.95, 0.3);
        this.flashLane(e.lane, laneColor, 0.7);
        this.particles.burst(x, y, Math.round(9 * feverBoost * motion), mix(laneColor, '#9dff7a', 0.4), 560);
        break;
      case 'good':
        this.perfectStreak = 0;
        this.addRing(e.lane, JUDGE_COLOR.good, 0.7, 0.25);
        this.flashLane(e.lane, JUDGE_COLOR.good, 0.4);
        this.particles.burst(x, y, Math.round(4 * motion), JUDGE_COLOR.good, 380);
        break;
      case 'miss':
        this.perfectStreak = 0;
        this.missFlash = 1;
        this.shake = this.opts.reducedMotion ? 0 : Math.max(this.shake, e.comboBroken ? 1 : 0.5);
        this.flashLane(e.lane, JUDGE_COLOR.miss, 0.6);
        break;
    }
  }

  lanePress(lane: number): void {
    this.receptorPulse[lane] = 1;
  }

  holdStart(lane: number): void {
    this.flashLane(lane, this.opts.theme.laneColors[lane], 0.8);
  }

  holdTick(lane: number): void {
    const l = this.layout;
    const x = xAt(l, lane + 0.5, 1);
    const color = this.opts.theme.laneColors[lane];
    for (let i = 0; i < 3; i++) {
      this.particles.spawn(
        x + (Math.random() - 0.5) * l.laneWidth * 0.6,
        l.judgeY,
        (Math.random() - 0.5) * 120,
        -260 - Math.random() * 320,
        0.35,
        5 + Math.random() * 6,
        Math.random() < 0.3 ? '#ffffff' : color,
        300,
      );
    }
    this.receptorPulse[lane] = Math.max(this.receptorPulse[lane], 0.6);
  }

  holdComplete(lane: number): void {
    const l = this.layout;
    const color = this.opts.theme.laneColors[lane];
    this.addRing(lane, '#ffffff', 1.5, 0.45);
    this.particles.burst(xAt(l, lane + 0.5, 1), l.judgeY, 22, color, 900);
  }

  holdBreak(lane: number): void {
    this.flashLane(lane, JUDGE_COLOR.miss, 0.8);
    this.missFlash = Math.max(this.missFlash, 0.7);
    const l = this.layout;
    this.particles.burst(xAt(l, lane + 0.5, 1), l.judgeY, 10, '#ff5566', 300, Math.PI);
  }

  milestone(combo: number): void {
    const strength = combo >= 200 ? 1.4 : combo >= 100 ? 1.2 : 0.8;
    this.shockwaves.push({ age: 0, strength });
    const l = this.layout;
    const count = this.opts.reducedMotion ? 16 : Math.round(40 * strength);
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      this.particles.burst(xAt(l, lane + 0.5, 1), l.judgeY, count / 4, this.opts.theme.laneColors[lane], 1100);
    }
    this.zoomPunch = this.opts.reducedMotion ? 0 : 0.6 * strength;
  }

  feverStart(): void {
    this.fever = true;
    this.dropFlash = 1;
    this.shockwaves.push({ age: 0, strength: 1.6 });
    this.zoomPunch = this.opts.reducedMotion ? 0 : 1;
  }

  feverEnd(): void {
    this.fever = false;
  }

  section(_index: number, name: string): void {
    if (name.startsWith('drop')) {
      this.dropFlash = 1;
      this.zoomPunch = this.opts.reducedMotion ? 0 : Math.max(this.zoomPunch, 0.8);
    }
  }

  finish(): void {
    const l = this.layout;
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      this.particles.burst(xAt(l, lane + 0.5, 1), l.judgeY, 18, this.opts.theme.laneColors[lane], 1300);
    }
    this.shockwaves.push({ age: 0, strength: 1.3 });
  }

  private addRing(lane: number, color: string, size: number, life: number): void {
    if (this.rings.length >= MAX_RINGS) this.rings.shift();
    this.rings.push({ lane, age: 0, life, color, size });
  }

  private flashLane(lane: number, color: string, strength: number): void {
    this.laneFlash[lane] = Math.max(this.laneFlash[lane], strength);
    this.laneFlashColor[lane] = color;
  }

  // ------------------------------------------------------------------ frame

  frame(engine: GameEngine, t: number, dt: number): void {
    const ctx = this.ctx;
    const l = this.layout;
    const reduced = this.opts.reducedMotion;
    const paused = engine.phase === 'paused';
    const step = paused ? 0 : dt;
    if (this.fever) this.feverTime += step;

    this.decay(step);
    this.particles.update(step);

    ctx.setTransform(l.dpr, 0, 0, l.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    this.bg.draw(ctx, l, {
      t,
      dt: step,
      pulse: engine.beatPulse,
      energy: engine.energy,
      fever: engine.score.feverActive,
      flash: this.dropFlash,
      reducedMotion: reduced,
    });

    // camera: shake, zoom punch, kick bob
    ctx.save();
    if (!reduced) {
      const zoom = 1 + this.zoomPunch * 0.035 + engine.beatPulse * 0.004 * engine.energy;
      ctx.translate(l.centerX, l.judgeY);
      ctx.scale(zoom, zoom);
      ctx.translate(-l.centerX, -l.judgeY);
      if (this.shake > 0) {
        const a = this.shake * 9;
        ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      }
    }

    this.drawHighway(engine, t);
    this.drawNotes(engine, t);
    this.drawJudgeLine(engine);
    this.drawEffects();
    ctx.restore();
    this.drawOverlays(engine);
  }

  private decay(dt: number): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      this.laneFlash[i] = Math.max(0, this.laneFlash[i] - dt * 4.5);
      this.receptorPulse[i] = Math.max(0, this.receptorPulse[i] - dt * 6);
    }
    this.screenFlash = Math.max(0, this.screenFlash - dt * 5);
    this.missFlash = Math.max(0, this.missFlash - dt * 3.2);
    this.shake = Math.max(0, this.shake - dt * 5);
    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 3);
    this.dropFlash = Math.max(0, this.dropFlash - dt * 1.8);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.life);
    for (const s of this.shockwaves) s.age += dt;
    this.shockwaves = this.shockwaves.filter((s) => s.age < 0.7);
  }

  private feverHue(offset = 0): number {
    return (this.feverTime * 160 + offset) % 360;
  }

  private drawHighway(engine: GameEngine, t: number): void {
    const ctx = this.ctx;
    const l = this.layout;
    const zBottom = Math.max(zAtY(l, l.height + 4), -0.95);
    const sTop = scaleAt(l, 1);
    const sBot = scaleAt(l, zBottom);
    const yTop = yAt(l, 1);
    const yBot = yAt(l, zBottom);
    const fever = engine.score.feverActive;

    // floor
    ctx.beginPath();
    ctx.moveTo(xAt(l, 0, sTop), yTop);
    ctx.lineTo(xAt(l, LANE_COUNT, sTop), yTop);
    ctx.lineTo(xAt(l, LANE_COUNT, sBot), yBot);
    ctx.lineTo(xAt(l, 0, sBot), yBot);
    ctx.closePath();
    const floor = ctx.createLinearGradient(0, yTop, 0, yBot);
    floor.addColorStop(0, 'rgba(6,4,14,0.35)');
    floor.addColorStop(0.35, 'rgba(6,4,14,0.82)');
    floor.addColorStop(1, 'rgba(4,2,10,0.94)');
    ctx.fillStyle = floor;
    ctx.fill();

    // beat lines
    const spb = engine.spb;
    const offset = engine.song.offset;
    const beatNow = (t - offset) / spb;
    const lastBeat = beatNow + this.visibleSeconds / spb;
    ctx.lineWidth = 1;
    for (let b = Math.ceil(beatNow); b <= lastBeat; b++) {
      const z = (b * spb + offset - t) / this.visibleSeconds;
      if (z < 0 || z > 1) continue;
      const s = scaleAt(l, z);
      const y = yAt(l, z);
      const bar = b % 4 === 0;
      const a = (bar ? 0.28 : 0.1) * Math.min(1, (1 - z) * 4);
      ctx.strokeStyle = fever ? hsl(this.feverHue(b * 20), 100, 70, a * 1.4) : `rgba(255,255,255,${a})`;
      ctx.lineWidth = bar ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(xAt(l, 0, s), y);
      ctx.lineTo(xAt(l, LANE_COUNT, s), y);
      ctx.stroke();
    }

    // lane beams (held keys + hit flashes)
    ctx.globalCompositeOperation = 'lighter';
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const held = engine.laneHeld(lane) ? 0.55 : 0;
      const flash = this.laneFlash[lane];
      const strength = Math.max(held, flash);
      if (strength <= 0.01) continue;
      const color = flash > held ? this.laneFlashColor[lane] : this.opts.theme.laneColors[lane];
      const zTop = 0.55 + flash * 0.3;
      const s1 = scaleAt(l, zTop);
      const y1 = yAt(l, zTop);
      const g = ctx.createLinearGradient(0, l.judgeY, 0, y1);
      g.addColorStop(0, withAlpha(color, 0.5 * strength));
      g.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(xAt(l, lane + 0.04, 1), l.judgeY);
      ctx.lineTo(xAt(l, lane + 0.96, 1), l.judgeY);
      ctx.lineTo(xAt(l, lane + 0.96, s1), y1);
      ctx.lineTo(xAt(l, lane + 0.04, s1), y1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // lane dividers
    for (let u = 1; u < LANE_COUNT; u++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xAt(l, u, sTop), yTop);
      ctx.lineTo(xAt(l, u, sBot), yBot);
      ctx.stroke();
    }

    // side rails
    ctx.globalCompositeOperation = 'lighter';
    const pulse = engine.beatPulse;
    for (const [u, colorIdx] of [
      [0, 0],
      [LANE_COUNT, LANE_COUNT - 1],
    ] as const) {
      const base = fever ? hsl(this.feverHue(u * 40), 100, 65) : this.opts.theme.laneColors[colorIdx];
      const g = ctx.createLinearGradient(0, yTop, 0, yBot);
      g.addColorStop(0, withAlphaAny(base, 0));
      g.addColorStop(0.4, withAlphaAny(base, 0.5 + pulse * 0.4));
      g.addColorStop(1, withAlphaAny(base, 0.9));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.5 + pulse * 2 + (fever ? 2 : 0);
      ctx.beginPath();
      ctx.moveTo(xAt(l, u, sTop), yTop);
      ctx.lineTo(xAt(l, u, sBot), yBot);
      ctx.stroke();
    }
    if (fever && !this.opts.reducedMotion && Math.random() < 0.6) {
      const u = Math.random() < 0.5 ? 0 : LANE_COUNT;
      const z = Math.random() * 0.2;
      const color = FEVER_PALETTE[Math.floor(this.feverTime * 6) % FEVER_PALETTE.length];
      this.particles.spawn(xAt(l, u, scaleAt(l, z)), yAt(l, z), 0, -500 - Math.random() * 400, 0.6, 8, color, 0);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private noteColor(note: Note): string {
    const tint = NOTE_TYPES[note.type].tint;
    const lane = this.opts.theme.laneColors[note.lane];
    return tint ? mix(lane, tint, 0.75) : lane;
  }

  private drawNotes(engine: GameEngine, t: number): void {
    const ctx = this.ctx;
    const l = this.layout;
    const notes = engine.notes;
    const state = engine.judge.state;
    const win = this.visibleSeconds;

    // Skip notes that are fully finished and off screen.
    while (this.renderStart < notes.length) {
      const n = notes[this.renderStart];
      const st = state[this.renderStart];
      const finished = st !== NS.pending && st !== NS.holding;
      if (finished && n.time + n.duration < t - win * 0.4) this.renderStart++;
      else break;
    }
    if (this.renderStart > notes.length) this.renderStart = 0;

    let end = this.renderStart;
    while (end < notes.length && notes[end].time - t <= win) end++;

    // chord connectors
    ctx.lineCap = 'round';
    for (let i = this.renderStart; i < end - 1; i++) {
      const a = notes[i];
      const b = notes[i + 1];
      if (a.chordId === null || a.chordId !== b.chordId) continue;
      if (state[i] !== NS.pending || state[i + 1] !== NS.pending) continue;
      const z = (a.time - t) / win;
      if (z > 1 || z < -0.1) continue;
      const s = scaleAt(l, z);
      const y = yAt(l, z);
      ctx.strokeStyle = `rgba(255,236,140,${0.65 * fadeIn(z)})`;
      ctx.lineWidth = Math.max(2, 5 * s);
      ctx.beginPath();
      ctx.moveTo(xAt(l, Math.min(a.lane, b.lane) + 0.5, s), y);
      ctx.lineTo(xAt(l, Math.max(a.lane, b.lane) + 0.5, s), y);
      ctx.stroke();
    }

    // Far to near so closer notes overlap farther ones.
    for (let i = end - 1; i >= this.renderStart; i--) {
      const note = notes[i];
      const st = state[i];
      if (st === NS.hit || st === NS.done || st === NS.skipped) continue;
      const zHead = (note.time - t) / win;
      const color = this.noteColor(note);
      const dim = st === NS.missed || st === NS.broken;
      if (note.duration > 0) {
        const zTail = (note.time + note.duration - t) / win;
        const holding = st === NS.holding;
        const released = holding && !Number.isNaN(engine.judge.releasedAt[i]);
        const from = holding ? 0 : st === NS.broken ? Math.max(zHead, -0.2) : zHead;
        this.drawHoldBody(note.lane, from, Math.min(zTail, 1.02), color, dim, holding && !released, t);
        if (zTail <= 1 && zTail > -0.3) this.drawNote(note.lane, zTail, color, 'tail', dim);
        if (!holding && st !== NS.broken) this.drawNote(note.lane, zHead, color, 'normal', dim);
      } else {
        if (zHead < -0.35) continue;
        const variant = note.type === 'double' ? 'double' : note.type === 'rapid' ? 'rapid' : note.type === 'burst' ? 'burst' : 'normal';
        this.drawNote(note.lane, zHead, color, variant, dim, NOTE_TYPES[note.type].thickness);
      }
    }
  }

  private drawNote(
    lane: number,
    z: number,
    color: string,
    variant: 'normal' | 'double' | 'rapid' | 'burst' | 'tail',
    dim: boolean,
    thickness = 1,
  ): void {
    if (z > 1.02) return;
    const l = this.layout;
    const s = scaleAt(l, z);
    const y = yAt(l, z);
    const x = xAt(l, lane + 0.5, s);
    const w = l.laneWidth * s * (variant === 'tail' ? 0.7 : 0.92);
    const h = l.noteHeight * s * (variant === 'tail' ? 0.55 : thickness);
    const sprite = noteSprite(color, dim ? 'dim' : variant === 'tail' ? 'normal' : variant);
    const kx = w / NOTE_BODY.w;
    const ky = h / NOTE_BODY.h;
    this.ctx.globalAlpha = fadeIn(z) * (dim ? 0.55 : 1);
    this.ctx.drawImage(sprite, x - w / 2 - NOTE_BODY.x * kx, y - h / 2 - NOTE_BODY.y * ky, NOTE_SPRITE_W * kx, NOTE_SPRITE_H * ky);
    this.ctx.globalAlpha = 1;
  }

  private drawHoldBody(lane: number, z0: number, z1: number, color: string, dim: boolean, active: boolean, t: number): void {
    if (z1 <= z0) return;
    const ctx = this.ctx;
    const l = this.layout;
    const s0 = scaleAt(l, z0);
    const s1 = scaleAt(l, z1);
    const y0 = yAt(l, z0);
    const y1 = yAt(l, z1);
    const inset = 0.2;
    ctx.beginPath();
    ctx.moveTo(xAt(l, lane + inset, s0), y0);
    ctx.lineTo(xAt(l, lane + 1 - inset, s0), y0);
    ctx.lineTo(xAt(l, lane + 1 - inset, s1), y1);
    ctx.lineTo(xAt(l, lane + inset, s1), y1);
    ctx.closePath();
    const base = dim ? '#50505e' : color;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, withAlpha(base, active ? 0.85 : 0.5));
    g.addColorStop(1, withAlpha(base, active ? 0.35 : 0.2));
    ctx.fillStyle = g;
    ctx.fill();
    // core line
    ctx.strokeStyle = dim ? 'rgba(255,255,255,0.12)' : `rgba(255,255,255,${active ? 0.9 : 0.4})`;
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(xAt(l, lane + 0.5, s0), y0);
    ctx.lineTo(xAt(l, lane + 0.5, s1), y1);
    ctx.stroke();
    if (active) {
      // energy dashes flowing into the judge line
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const phase = (t * 4) % 1;
      for (let k = 0; k < 8; k++) {
        const z = z0 + ((k + 1 - phase) / 8) * (z1 - z0);
        const s = scaleAt(l, z);
        const y = yAt(l, z);
        const w = l.laneWidth * s * 0.45;
        ctx.fillRect(xAt(l, lane + 0.5, s) - w / 2, y - 1.5, w, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawJudgeLine(engine: GameEngine): void {
    const ctx = this.ctx;
    const l = this.layout;
    const y = l.judgeY;
    const x0 = xAt(l, 0, 1);
    const x1 = xAt(l, LANE_COUNT, 1);
    const fever = engine.score.feverActive;
    const streakGlow = Math.min(1, this.perfectStreak / 30);

    // receptors
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const color = this.opts.theme.laneColors[lane];
      const held = engine.laneHeld(lane);
      const pulse = this.receptorPulse[lane];
      const cx = xAt(l, lane + 0.5, 1);
      const w = l.laneWidth * 0.86;
      const h = l.noteHeight * 1.25;
      ctx.fillStyle = held ? withAlpha(color, 0.45 + pulse * 0.3) : 'rgba(10,8,22,0.75)';
      roundRect(ctx, cx - w / 2, y - h / 2, w, h, 8);
      ctx.fill();
      ctx.strokeStyle = held ? '#ffffff' : withAlpha(color, 0.55 + pulse * 0.4);
      ctx.lineWidth = held ? 2.5 : 1.5;
      ctx.stroke();
      if (!l.mobile && this.opts.keyLabels[lane]) {
        ctx.fillStyle = held ? '#0b0614' : 'rgba(255,255,255,0.55)';
        ctx.font = `700 ${Math.round(l.noteHeight * 0.6)}px "Chakra Petch", "Rajdhani", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.opts.keyLabels[lane], cx, y + 1);
      }
    }

    // line
    ctx.globalCompositeOperation = 'lighter';
    const lineColor = fever ? hsl(this.feverHue(), 100, 70) : '#ffffff';
    const glowColor = fever ? '#ff4fd8' : this.opts.theme.accent;
    const intensity = 0.55 + engine.beatPulse * 0.35 + streakGlow * 0.5 + (fever ? 0.3 : 0);
    ctx.globalAlpha = Math.min(1, intensity * 0.7);
    const gh = 40 + streakGlow * 40;
    ctx.drawImage(glowSprite(glowColor), x0 - 40, y - gh / 2, x1 - x0 + 80, gh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = lineColor;
    ctx.fillRect(x0, y - 1.5 - streakGlow, x1 - x0, 3 + streakGlow * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawEffects(): void {
    const ctx = this.ctx;
    const l = this.layout;
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const k = r.age / r.life;
      const cx = xAt(l, r.lane + 0.5, 1);
      const rad = l.laneWidth * (0.35 + k * 0.55) * r.size;
      ctx.globalAlpha = (1 - k) * (1 - k);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 + (1 - k) * 5;
      ctx.beginPath();
      ctx.ellipse(cx, l.judgeY, rad, rad * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (k < 0.35 && r.color !== '#ffffff') {
        const g = l.laneWidth * 1.05 * r.size * (1 - k);
        ctx.globalAlpha = (0.35 - k) * 1.3;
        ctx.drawImage(glowSprite(r.color), cx - g, l.judgeY - g * 0.6, g * 2, g * 1.2);
      }
    }
    ctx.globalAlpha = 1;
    for (const s of this.shockwaves) {
      const k = s.age / 0.7;
      const rad = l.baseWidth * (0.3 + k * 1.1) * s.strength;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = this.fever ? hsl(this.feverHue(), 100, 70) : '#ffffff';
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(l.centerX, l.judgeY, rad, rad * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.particles.draw(ctx);
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawOverlays(engine: GameEngine): void {
    const ctx = this.ctx;
    const l = this.layout;
    const reduced = this.opts.reducedMotion;
    if (!reduced && (this.screenFlash > 0 || this.dropFlash > 0)) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.screenFlash * 0.07 + this.dropFlash * this.dropFlash * 0.35;
      ctx.fillStyle = this.dropFlash > this.screenFlash ? '#ffffff' : this.screenFlashColor;
      ctx.fillRect(0, 0, l.width, l.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.missFlash > 0) {
      const g = ctx.createRadialGradient(l.centerX, l.height / 2, Math.min(l.width, l.height) * 0.3, l.centerX, l.height / 2, Math.max(l.width, l.height) * 0.75);
      g.addColorStop(0, 'rgba(255,20,60,0)');
      g.addColorStop(1, `rgba(255,20,60,${this.missFlash * (reduced ? 0.25 : 0.5)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, l.width, l.height);
    }
    if (engine.score.feverActive) {
      const a = 0.18 + engine.beatPulse * 0.22;
      const hue = this.feverHue();
      const g = ctx.createRadialGradient(l.centerX, l.height / 2, Math.min(l.width, l.height) * 0.35, l.centerX, l.height / 2, Math.max(l.width, l.height) * 0.8);
      g.addColorStop(0, hsl(hue, 100, 60, 0));
      g.addColorStop(1, hsl(hue, 100, 60, a));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, l.width, l.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (engine.phase === 'paused') {
      ctx.fillStyle = 'rgba(3,2,8,0.55)';
      ctx.fillRect(0, 0, l.width, l.height);
    }
  }
}

function fadeIn(z: number): number {
  return Math.max(0, Math.min(1, (1.02 - z) / 0.14));
}

/** withAlpha for either hex or hsla() strings. */
function withAlphaAny(color: string, a: number): string {
  if (color.startsWith('#')) return withAlpha(color, a);
  return color.replace(/,\s*[\d.]+\)$/, `,${a})`);
}
