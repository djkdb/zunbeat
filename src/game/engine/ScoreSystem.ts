import { COMBO_MILESTONES } from '../config/combo';
import { FEVER } from '../config/fever';
import { computeAccuracy, holdTickScore, scoreForJudgment, SCORING } from '../config/scoring';
import type { Judgment, JudgmentCounts, Note, NoteType } from '../types';

export interface ApplyOutcome {
  points: number;
  comboBroken: boolean;
  milestone: number | null;
  feverStarted: boolean;
}

/** Score, combo, accuracy and FEVER state. Pure logic, no timers or DOM. */
export class ScoreSystem {
  counts: JudgmentCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
  score = 0;
  combo = 0;
  maxCombo = 0;
  fast = 0;
  slow = 0;
  feverGauge = 0;
  feverActive = false;
  feverEndsAt = 0;
  feverStartedAt = 0;
  private feverDuration: number;
  private feverUnit: number;

  /** `feverFill` = perfect judgments needed to fill the FEVER gauge (see feverFillSize). */
  constructor(
    public totalJudgments: number,
    secondsPerBeat: number,
    feverFill = Math.max(20, FEVER.fillFraction * totalJudgments),
  ) {
    this.feverDuration = FEVER.durationBeats * secondsPerBeat;
    this.feverUnit = 1 / feverFill;
  }

  get accuracy(): number {
    return computeAccuracy(this.counts);
  }

  get judged(): number {
    const c = this.counts;
    return c.perfect + c.great + c.good + c.miss;
  }

  /** Remaining FEVER as 0–1 while active, otherwise the charge level. */
  feverLevel(t: number): number {
    if (!this.feverActive) return this.feverGauge;
    return Math.max(0, (this.feverEndsAt - t) / this.feverDuration);
  }

  apply(judgment: Judgment, noteType: NoteType, t: number, offset = 0, fastSlowThreshold = Infinity): ApplyOutcome {
    this.counts[judgment]++;
    let comboBroken = false;
    let milestone: number | null = null;
    if (judgment === 'miss') {
      comboBroken = this.combo > 0;
      this.combo = 0;
    } else {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      if ((COMBO_MILESTONES as readonly number[]).includes(this.combo)) milestone = this.combo;
      if (judgment !== 'perfect' && Math.abs(offset) > fastSlowThreshold) {
        if (offset < 0) this.fast++;
        else this.slow++;
      }
    }
    const points = scoreForJudgment({
      judgment,
      noteType,
      combo: this.combo,
      fever: this.feverActive,
      totalJudgments: this.totalJudgments,
    });
    this.score += points;
    const feverStarted = this.updateFeverGauge(judgment, t);
    return { points, comboBroken, milestone, feverStarted };
  }

  private updateFeverGauge(judgment: Judgment, t: number): boolean {
    if (this.feverActive) {
      if (judgment === 'miss') {
        const remaining = this.feverEndsAt - t;
        this.feverEndsAt -= remaining * FEVER.missPenalty;
      }
      return false;
    }
    const gain = FEVER.weight[judgment] * this.feverUnit;
    this.feverGauge = Math.max(0, Math.min(1, this.feverGauge + gain));
    if (this.feverGauge >= 1) {
      this.startFever(t);
      return true;
    }
    return false;
  }

  startFever(t: number): void {
    this.feverActive = true;
    this.feverStartedAt = t;
    this.feverEndsAt = t + this.feverDuration;
    this.feverGauge = 1;
  }

  holdTick(): number {
    const points = holdTickScore(this.feverActive);
    this.score += points;
    return points;
  }

  holdComplete(): void {
    if (!this.feverActive) {
      this.feverGauge = Math.min(1, this.feverGauge + FEVER.holdCompleteWeight * this.feverUnit);
    }
  }

  /** Advance time-based state; returns true when FEVER just ended. */
  update(t: number): boolean {
    if (this.feverActive && t >= this.feverEndsAt) {
      this.feverActive = false;
      this.feverGauge = 0;
      return true;
    }
    return false;
  }
}

export function holdTickInterval(secondsPerBeat: number): number {
  return SCORING.holdTickBeats * secondsPerBeat;
}

export function holdTickCount(duration: number, secondsPerBeat: number): number {
  return Math.max(0, Math.floor(duration / holdTickInterval(secondsPerBeat) + 1e-6));
}

export function totalJudgmentsFor(notes: readonly Note[]): number {
  return notes.reduce((n, note) => n + (note.duration > 0 ? 2 : 1), 0);
}

/** Score of a flawless run (all PERFECT, every hold tick), used for rank and score ratio. */
export function theoreticalMaxScore(notes: readonly Note[], secondsPerBeat: number, feverFill?: number): number {
  type Ev = { t: number; kind: 'judge' | 'tick' | 'complete'; type: NoteType };
  const events: Ev[] = [];
  const interval = holdTickInterval(secondsPerBeat);
  for (const n of notes) {
    events.push({ t: n.time, kind: 'judge', type: n.type });
    if (n.duration > 0) {
      const ticks = holdTickCount(n.duration, secondsPerBeat);
      for (let k = 1; k <= ticks; k++) events.push({ t: n.time + k * interval - 1e-4, kind: 'tick', type: n.type });
      events.push({ t: n.time + n.duration, kind: 'complete', type: n.type });
    }
  }
  events.sort((a, b) => a.t - b.t);
  const sim = new ScoreSystem(totalJudgmentsFor(notes), secondsPerBeat, feverFill);
  for (const e of events) {
    sim.update(e.t);
    if (e.kind === 'tick') sim.holdTick();
    else {
      sim.apply('perfect', e.type, e.t);
      if (e.kind === 'complete') sim.holdComplete();
    }
  }
  return sim.score;
}
