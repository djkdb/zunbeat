import type { AudioManager, MusicHandle } from '../audio/AudioManager';
import type { CompositionAnalysis } from '../audio/synth/music';
import { feverFillSize } from '../config/fever';
import { FAST_SLOW_THRESHOLD, JUDGMENT_WINDOWS } from '../config/judgment';
import { computeRank } from '../config/rank';
import { LANE_COUNT } from '../constants';
import type { Chart, DifficultyId, Judgment, Note, PlayResult, SongDefinition } from '../types';
import { GameClock } from './GameClock';
import { summarizeTiming } from './timing';
import { InputManager } from './InputManager';
import { JudgmentSystem, NS, type JudgeEvent } from './JudgmentSystem';
import {
  ScoreSystem,
  holdTickCount,
  holdTickInterval,
  theoreticalMaxScore,
  totalJudgmentsFor,
} from './ScoreSystem';

/** `ready`: created but not started (e.g. behind the HOW TO PLAY card). */
export type EnginePhase = 'ready' | 'countdown' | 'playing' | 'paused' | 'resuming' | 'finishing' | 'finished';

export interface JudgmentPresentation extends JudgeEvent {
  points: number;
  combo: number;
  comboBroken: boolean;
  fever: boolean;
}

/** Anything that reacts to gameplay: renderer, HUD, sound. Every hook is optional. */
export interface GamePresenter {
  frame?(engine: GameEngine, t: number, dt: number): void;
  judgment?(e: JudgmentPresentation): void;
  lanePress?(lane: number): void;
  holdStart?(lane: number): void;
  holdTick?(lane: number): void;
  holdComplete?(lane: number): void;
  holdBreak?(lane: number): void;
  milestone?(combo: number): void;
  feverStart?(): void;
  feverEnd?(): void;
  section?(index: number, name: string): void;
  countdown?(value: 3 | 2 | 1 | 'GO' | 'READY'): void;
  finish?(banner: 'ALL PERFECT' | 'FULL COMBO' | 'CLEAR'): void;
  phase?(phase: EnginePhase): void;
}

export interface EngineOptions {
  song: SongDefinition;
  difficulty: DifficultyId;
  chart: Chart;
  analysis: CompositionAnalysis;
  buffer: AudioBuffer | null;
  audio: AudioManager;
  surface: HTMLElement;
  keys: readonly string[];
  laneAtX: (clientX: number) => number;
  userOffsetMs: number;
  autoplay: boolean;
  presenters: GamePresenter[];
  onFinish: (result: PlayResult) => void;
  onPauseRequest: () => void;
}

const COUNTDOWN_BEATS = 3;
const READY_SECONDS = 0.9;
const RESUME_REWIND_BEATS = 4;
const FINISH_DELAY = 0.8;
const RESULT_DELAY = 2.4;
const AUTOPLAY_PRESS_VISUAL = 0.07;

/**
 * Orchestrates one play: clock, input, judgment, score, music, presenters, and the
 * requestAnimationFrame loop. React never sees per-frame state; it only gets phase
 * changes and the final result.
 */
export class GameEngine {
  readonly song: SongDefinition;
  readonly difficulty: DifficultyId;
  readonly chart: Chart;
  readonly analysis: CompositionAnalysis;
  readonly spb: number;
  readonly judge: JudgmentSystem;
  readonly score: ScoreSystem;
  readonly maxScore: number;
  readonly input: InputManager;
  readonly clock: GameClock;
  phase: EnginePhase = 'ready';
  autoplay: boolean;
  /** Song time of the last frame. */
  t: number;
  /** 0–1 decaying pulse on every kick drum. */
  beatPulse = 0;
  /** Smoothed section energy (0–1). */
  energy = 0.2;
  sectionIndex = -1;
  /** Song time until which each lane shows as pressed by autoplay. */
  autoPressUntil: number[] = new Array(LANE_COUNT).fill(-Infinity);
  readonly visibleSongEnd: number;

  private opts: EngineOptions;
  private presenters: GamePresenter[];
  private music: MusicHandle | null = null;
  private raf = 0;
  private lastPerf = 0;
  private kickTimes: number[];
  private kickPtr = 0;
  private countdownShown = new Set<string>();
  private pausedAt = 0;
  private resumeTarget = 0;
  private finishAt = Infinity;
  private destroyed = false;
  private finalResult: PlayResult | null = null;
  private tickInterval: number;
  private scheduledSfx: (() => void)[] = [];
  /** Press offsets (s) of player-made judgments, for the timing summary. */
  private pressOffsets: number[] = [];

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.song = opts.song;
    this.difficulty = opts.difficulty;
    this.chart = opts.chart;
    this.analysis = opts.analysis;
    this.presenters = opts.presenters;
    this.autoplay = opts.autoplay;
    this.spb = 60 / opts.chart.bpm;
    this.tickInterval = holdTickInterval(this.spb);
    this.judge = new JudgmentSystem(opts.chart.notes);
    const feverFill = feverFillSize(opts.chart);
    this.score = new ScoreSystem(totalJudgmentsFor(opts.chart.notes), this.spb, feverFill);
    this.maxScore = theoreticalMaxScore(opts.chart.notes, this.spb, feverFill);
    this.kickTimes = opts.analysis.kickBeats.map((b) => opts.song.offset + b * this.spb);
    this.visibleSongEnd = opts.chart.duration;
    const ctx = opts.audio.running && opts.buffer ? opts.audio.ctx : null;
    this.clock = new GameClock(ctx, opts.userOffsetMs / 1000);
    this.t = -(COUNTDOWN_BEATS * this.spb + READY_SECONDS);
    this.input = new InputManager(opts.surface, opts.keys, opts.laneAtX, {
      press: this.onPress,
      release: this.onRelease,
      pause: opts.onPauseRequest,
    });
  }

  get notes(): Note[] {
    return this.judge.notes;
  }

  get hasAudio(): boolean {
    return this.opts.audio.running && this.opts.buffer !== null;
  }

  // ------------------------------------------------------------------ lifecycle

  start(): void {
    if (this.phase !== 'ready') return;
    this.input.attach();
    const leadIn = COUNTDOWN_BEATS * this.spb + READY_SECONDS;
    this.beginAt(-leadIn);
    this.setPhase('countdown');
    this.emit('countdown', 'READY');
    this.lastPerf = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private cancelScheduledSfx(): void {
    for (const cancel of this.scheduledSfx) cancel();
    this.scheduledSfx = [];
  }

  /** Start clock + music so that song time `songTime` is heard shortly from now. */
  private beginAt(songTime: number): void {
    this.cancelScheduledSfx();
    const ctx = this.opts.audio.ctx;
    const buffer = this.opts.buffer;
    if (ctx && buffer && this.opts.audio.running) {
      const when = ctx.currentTime + 0.08;
      this.clock.start(songTime, when);
      this.music = this.opts.audio.playMusic(buffer, when, songTime, songTime > 0 ? 0.25 : 0);
      if (songTime < 0) {
        // Countdown ticks on beats -3..-1 and GO on beat 0, on the audio clock.
        const zeroAt = when - songTime;
        for (let k = COUNTDOWN_BEATS; k >= 0; k--) {
          const at = zeroAt - k * this.spb;
          if (at < when - 0.01) continue;
          const name = k === 0 ? 'countGo' : 'countTick';
          this.scheduledSfx.push(this.opts.audio.playSfx(name, { when: at, gain: k === 0 ? 0.6 : 0.7 }));
        }
      }
    } else {
      this.clock.start(songTime, this.opts.audio.now());
    }
  }

  /** Draw one frame without starting (e.g. behind the HOW TO PLAY card). */
  renderStill(): void {
    for (const p of this.presenters) p.frame?.(this, this.t, 0);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.cancelScheduledSfx();
    this.music?.stop(0.15);
    this.music = null;
  }

  pause(): void {
    if (this.phase !== 'countdown' && this.phase !== 'playing' && this.phase !== 'resuming') return;
    this.pausedAt = this.clock.pause();
    this.t = this.pausedAt;
    this.cancelScheduledSfx();
    this.music?.stop(0.06);
    this.music = null;
    this.input.releaseAll();
    this.input.enabled = false;
    this.setPhase('paused');
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    const rewind = RESUME_REWIND_BEATS * this.spb;
    const from = this.pausedAt - rewind;
    this.resumeTarget = this.pausedAt;
    this.countdownShown.clear();
    this.input.enabled = true;
    this.beginAt(from);
    this.setPhase('resuming');
  }

  // ------------------------------------------------------------------ loop

  private frame = (perfNow: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.1, Math.max(0, (perfNow - this.lastPerf) / 1000));
    this.lastPerf = perfNow;
    if (this.phase !== 'paused' && this.phase !== 'finished') {
      this.t = this.clock.now();
      this.update(this.t, dt);
    }
    for (const p of this.presenters) p.frame?.(this, this.t, dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(t: number, dt: number): void {
    if (this.phase === 'countdown') {
      for (let k = COUNTDOWN_BEATS; k >= 1; k--) {
        const key = `c${k}`;
        if (t >= -k * this.spb && !this.countdownShown.has(key)) {
          this.countdownShown.add(key);
          this.emit('countdown', k as 3 | 2 | 1);
        }
      }
      if (t >= 0) {
        this.emit('countdown', 'GO');
        this.setPhase('playing');
      }
    } else if (this.phase === 'resuming') {
      const remaining = this.resumeTarget - t;
      const k = Math.ceil(remaining / this.spb);
      if (k >= 1 && k <= 3 && !this.countdownShown.has(`r${k}`)) {
        this.countdownShown.add(`r${k}`);
        this.emit('countdown', k as 3 | 2 | 1);
      }
      if (remaining <= 0) this.setPhase(t >= 0 ? 'playing' : 'countdown');
    }

    if (this.autoplay) this.runAutoplay(t);

    for (const ev of this.judge.update(t, (lane) => this.laneHeld(lane))) this.handleJudge(ev, t);
    this.awardHoldTicks(t);

    if (this.score.update(t)) this.emit('feverEnd');

    // Beat pulse + section energy for visuals.
    while (this.kickPtr + 1 < this.kickTimes.length && this.kickTimes[this.kickPtr + 1] <= t) this.kickPtr++;
    const kick = this.kickTimes[this.kickPtr];
    this.beatPulse = kick !== undefined && t >= kick ? Math.exp(-(t - kick) * 7) : 0;
    const secs = this.analysis.sections;
    let idx = 0;
    const beat = (t - this.song.offset) / this.spb;
    while (idx + 1 < secs.length && secs[idx + 1].startBeat <= beat) idx++;
    if (t >= 0 && idx !== this.sectionIndex) {
      this.sectionIndex = idx;
      this.emit('section', idx, secs[idx].name);
    }
    const target = t < 0 ? 0.15 : secs[idx].energy;
    this.energy += (target - this.energy) * Math.min(1, dt * 2.5);

    if (this.phase === 'playing' && this.judge.allResolved && t > this.visibleSongEnd + FINISH_DELAY) {
      this.beginFinish(t);
    }
    if (this.phase === 'finishing' && t >= this.finishAt + RESULT_DELAY) {
      this.setPhase('finished');
      this.input.detach();
      if (this.finalResult) this.opts.onFinish(this.finalResult);
    }
  }

  private runAutoplay(t: number): void {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const idx = this.judge.nextPending(lane);
      if (idx < 0) continue;
      const note = this.judge.notes[idx];
      if (note.time > t) continue;
      const ev = this.judge.press(lane, note.time);
      if (ev && ev !== 'regrab') {
        this.autoPressUntil[lane] = note.time + Math.max(note.duration, AUTOPLAY_PRESS_VISUAL);
        this.emit('lanePress', lane);
        this.handleJudge(ev, t);
      }
    }
  }

  laneHeld(lane: number): boolean {
    return this.input.isHeld(lane) || (this.autoplay && this.t < this.autoPressUntil[lane]);
  }

  private awardHoldTicks(t: number): void {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const idx = this.judge.holding[lane];
      if (idx < 0 || !Number.isNaN(this.judge.releasedAt[idx])) continue;
      const note = this.judge.notes[idx];
      const due = Math.min(holdTickCount(note.duration, this.spb), Math.floor((t - note.time) / this.tickInterval));
      while (this.judge.ticks[idx] < due) {
        this.judge.ticks[idx]++;
        this.score.holdTick();
        this.emit('holdTick', lane);
      }
    }
  }

  // ------------------------------------------------------------------ input

  private onPress = (lane: number, timeStamp: number) => {
    if (!this.acceptsInput) return;
    const t = this.clock.timeAtEvent(timeStamp);
    this.emit('lanePress', lane);
    if (this.autoplay) return;
    const ev = this.judge.press(lane, t);
    if (ev && ev !== 'regrab') this.handleJudge(ev, t);
  };

  private onRelease = (lane: number, timeStamp: number) => {
    if (!this.acceptsInput || this.autoplay || this.input.isHeld(lane)) return;
    const t = this.clock.timeAtEvent(timeStamp);
    const ev = this.judge.release(lane, t);
    if (ev) this.handleJudge(ev, t);
  };

  private get acceptsInput(): boolean {
    return this.phase === 'playing' || this.phase === 'countdown' || this.phase === 'resuming';
  }

  // ------------------------------------------------------------------ judgment → score → presentation

  private handleJudge(ev: JudgeEvent, t: number): void {
    if (!this.autoplay && ev.kind !== 'tail' && Math.abs(ev.offset) <= JUDGMENT_WINDOWS.miss) {
      this.pressOffsets.push(ev.offset);
    }
    const outcome = this.score.apply(ev.judgment, ev.note.type, t, ev.offset, FAST_SLOW_THRESHOLD);
    this.emit('judgment', {
      ...ev,
      points: outcome.points,
      combo: this.score.combo,
      comboBroken: outcome.comboBroken,
      fever: this.score.feverActive,
    });
    if (ev.kind === 'head') {
      if (ev.judgment === 'miss') {
        // A missed head forfeits the tail too.
        this.score.apply('miss', ev.note.type, t);
      } else {
        this.emit('holdStart', ev.lane);
      }
    } else if (ev.kind === 'tail') {
      if (ev.judgment === 'miss') {
        this.emit('holdBreak', ev.lane);
      } else {
        const remaining = holdTickCount(ev.note.duration, this.spb) - this.judge.ticks[ev.noteIndex];
        for (let i = 0; i < remaining; i++) this.score.holdTick();
        this.judge.ticks[ev.noteIndex] += Math.max(0, remaining);
        this.score.holdComplete();
        this.emit('holdComplete', ev.lane);
      }
    }
    if (outcome.milestone) this.emit('milestone', outcome.milestone);
    if (outcome.feverStarted) this.emit('feverStart');
  }

  private beginFinish(t: number): void {
    this.finishAt = t;
    this.setPhase('finishing');
    this.music?.stop(2.2);
    this.music = null;
    const result = this.buildResult();
    this.finalResult = result;
    this.emit('finish', result.allPerfect ? 'ALL PERFECT' : result.fullCombo ? 'FULL COMBO' : 'CLEAR');
  }

  buildResult(): PlayResult {
    const s = this.score;
    const total = s.totalJudgments;
    const fullCombo = s.counts.miss === 0 && s.judged === total;
    const scoreRatio = this.maxScore > 0 ? s.score / this.maxScore : 0;
    return {
      songId: this.song.id,
      difficulty: this.difficulty,
      score: s.score,
      accuracy: s.accuracy,
      maxCombo: s.maxCombo,
      counts: { ...s.counts },
      fast: s.fast,
      slow: s.slow,
      totalJudgments: total,
      rank: computeRank(s.accuracy, scoreRatio, fullCombo),
      fullCombo,
      allPerfect: fullCombo && s.counts.perfect === total,
      autoplay: this.autoplay,
      scoreRatio,
      timing: summarizeTiming(this.pressOffsets, this.opts.userOffsetMs),
      playedAt: Date.now(),
    };
  }

  private setPhase(phase: EnginePhase): void {
    this.phase = phase;
    this.emit('phase', phase);
  }

  private emit<K extends keyof GamePresenter>(
    hook: K,
    ...args: Parameters<NonNullable<GamePresenter[K]>>
  ): void {
    for (const p of this.presenters) {
      const fn = p[hook] as ((...a: unknown[]) => void) | undefined;
      fn?.apply(p, args);
    }
  }

  // ------------------------------------------------------------------ debug tools

  readonly debug = {
    skip: (seconds: number) => {
      if (this.phase !== 'playing') return;
      const target = Math.min(this.t + seconds, this.visibleSongEnd);
      this.judge.skipBefore(target);
      this.music?.stop(0.03);
      this.music = null;
      this.beginAt(target);
      this.kickPtr = 0;
    },
    triggerFever: () => {
      if (!this.score.feverActive) {
        this.score.startFever(this.t);
        this.emit('feverStart');
      }
    },
    spawnTestNote: () => {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const id = this.judge.notes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
      const note: Note = {
        id,
        time: this.t + 1.5,
        lane,
        type: 'tap',
        duration: 0,
        beat: (this.t + 1.5) / this.spb,
        chordId: null,
        section: Math.max(0, this.sectionIndex),
      };
      this.judge.load([...this.judge.notes, note]);
      this.score.totalJudgments++;
    },
    forceNext: (judgment: Judgment) => {
      const best = this.judge.nextPendingAny();
      if (best < 0) return;
      const note = this.judge.notes[best];
      this.judge.state[best] = judgment === 'miss' ? NS.missed : note.duration > 0 ? NS.done : NS.hit;
      this.handleJudge({ noteIndex: best, note, lane: note.lane, judgment, offset: 0, kind: 'tap' }, this.t);
      if (note.duration > 0) this.score.apply(judgment, note.type, this.t);
    },
    finishNow: () => {
      if (this.phase === 'playing' || this.phase === 'countdown') {
        this.judge.skipBefore(Infinity);
        this.beginFinish(this.t);
        this.finishAt -= RESULT_DELAY - 0.6;
      }
    },
    setAutoplay: (on: boolean) => {
      this.autoplay = on;
    },
  };
}
