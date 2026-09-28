import { HOLD_REGRAB_GRACE, HOLD_RELEASE_TOLERANCE, JUDGMENT_WINDOWS, judgeOffset } from '../config/judgment';
import { hasTail, mechanicOf, rollTarget } from '../config/noteTypes';
import { LANE_COUNT } from '../constants';
import type { Judgment, Note } from '../types';

/** Per-note runtime state. */
export const NS = {
  pending: 0,
  hit: 1,
  holding: 2,
  done: 3,
  missed: 4,
  broken: 5,
  skipped: 6,
  rolling: 7,
} as const;
export type NoteStateValue = (typeof NS)[keyof typeof NS];

/** tap · head/tail of a HOLD or RELEASE · the final verdict of a ROLL. */
export type JudgeKind = 'tap' | 'head' | 'tail' | 'roll';

export interface JudgeEvent {
  noteIndex: number;
  note: Note;
  lane: number;
  judgment: Judgment;
  /** Press (or release) time minus the target time (negative = early). */
  offset: number;
  kind: JudgeKind;
}

/** A tap that landed on an active ROLL. */
export interface RollHit {
  roll: true;
  noteIndex: number;
  note: Note;
  lane: number;
  hits: number;
  target: number;
}

export type PressResult = JudgeEvent | RollHit | 'regrab' | null;

/** Late taps at the very end of a roll still count. */
const ROLL_END_GRACE = 0.03;

export function isRollHit(r: PressResult): r is RollHit {
  return typeof r === 'object' && r !== null && 'roll' in r;
}

export function isJudgeEvent(r: PressResult): r is JudgeEvent {
  return typeof r === 'object' && r !== null && 'judgment' in r;
}

/** ROLL verdict from the share of the target reached. */
export function rollJudgment(hits: number, target: number): Judgment {
  const ratio = hits / Math.max(1, target);
  if (ratio >= 1) return 'perfect';
  if (ratio >= 0.7) return 'great';
  if (ratio >= 0.4) return 'good';
  return 'miss';
}

/**
 * Decides which note an input belongs to and what it scored. Owns note state only;
 * scoring and presentation happen in the engine from the returned events.
 */
export class JudgmentSystem {
  notes: Note[] = [];
  state = new Uint8Array(0);
  /** Hold notes: song time the lane was let go (NaN while held). */
  releasedAt = new Float64Array(0);
  /** Hold ticks already awarded. */
  ticks = new Uint16Array(0);
  /** Taps landed on each roll. */
  rollHits = new Uint16Array(0);
  private laneQueue: number[][] = [];
  private lanePtr: number[] = [];
  /** Note index currently being held per lane, or -1. */
  holding: number[] = new Array(LANE_COUNT).fill(-1);
  /** Roll currently being tapped per lane, or -1. */
  rolling: number[] = new Array(LANE_COUNT).fill(-1);

  constructor(
    notes: Note[],
    private secondsPerBeat = 0.5,
  ) {
    this.load(notes);
  }

  load(notes: Note[]): void {
    const prevState = this.state;
    const prevNotes = this.notes;
    this.notes = [...notes].sort((a, b) => a.time - b.time || a.lane - b.lane);
    this.state = new Uint8Array(this.notes.length);
    this.releasedAt = new Float64Array(this.notes.length).fill(NaN);
    this.ticks = new Uint16Array(this.notes.length);
    const prevRollHits = this.rollHits;
    this.rollHits = new Uint16Array(this.notes.length);
    // Preserve state when notes are injected mid-song (debug).
    if (prevNotes.length) {
      const byId = new Map(prevNotes.map((n, i) => [n.id, i]));
      this.notes.forEach((n, i) => {
        const old = byId.get(n.id);
        this.state[i] = old === undefined ? NS.pending : prevState[old];
        if (old !== undefined) this.rollHits[i] = prevRollHits[old];
      });
    }
    this.laneQueue = Array.from({ length: LANE_COUNT }, () => []);
    this.notes.forEach((n, i) => this.laneQueue[n.lane]?.push(i));
    this.lanePtr = new Array(LANE_COUNT).fill(0);
    const remap = (idx: number) => (idx >= 0 ? this.notes.findIndex((n) => n.id === prevNotes[idx]?.id) : -1);
    this.holding = this.holding.map(remap);
    this.rolling = this.rolling.map(remap);
  }

  rollTargetOf(idx: number): number {
    return rollTarget(this.notes[idx], this.secondsPerBeat);
  }

  /** First unresolved note in a lane, or -1. */
  nextPending(lane: number): number {
    const q = this.laneQueue[lane];
    let p = this.lanePtr[lane];
    while (p < q.length && this.state[q[p]] !== NS.pending) p++;
    this.lanePtr[lane] = p;
    return p < q.length ? q[p] : -1;
  }

  /** Index of the earliest unresolved note in any lane, or -1. */
  nextPendingAny(): number {
    let best = -1;
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const idx = this.nextPending(lane);
      if (idx >= 0 && (best < 0 || idx < best)) best = idx;
    }
    return best;
  }

  /** A press at song time `t` on `lane`. */
  press(lane: number, t: number): PressResult {
    // Tapping an active roll.
    const r = this.rolling[lane];
    if (r >= 0) {
      const n = this.notes[r];
      if (t <= n.time + n.duration + ROLL_END_GRACE) {
        this.rollHits[r]++;
        return { roll: true, noteIndex: r, note: n, lane, hits: this.rollHits[r], target: this.rollTargetOf(r) };
      }
    }
    const holdIdx = this.holding[lane];
    if (holdIdx >= 0 && !Number.isNaN(this.releasedAt[holdIdx])) {
      this.releasedAt[holdIdx] = NaN;
      return 'regrab';
    }
    const idx = this.nextPending(lane);
    if (idx < 0) return null;
    const note = this.notes[idx];
    const mechanic = mechanicOf(note);

    if (mechanic === 'roll') {
      // A roll opens a little before its head and stays open until its end.
      if (t < note.time - JUDGMENT_WINDOWS.good || t > note.time + note.duration) return null;
      this.state[idx] = NS.rolling;
      this.rolling[lane] = idx;
      this.rollHits[idx] = 1;
      return { roll: true, noteIndex: idx, note, lane, hits: 1, target: this.rollTargetOf(idx) };
    }

    const offset = t - note.time;
    const judgment = judgeOffset(offset);
    if (!judgment) return null; // too early: ignore
    if (hasTail(note)) {
      if (judgment === 'miss') {
        this.state[idx] = NS.missed;
      } else {
        this.state[idx] = NS.holding;
        this.holding[lane] = idx;
        this.releasedAt[idx] = NaN;
      }
      return { noteIndex: idx, note, lane, judgment, offset, kind: 'head' };
    }
    this.state[idx] = judgment === 'miss' ? NS.missed : NS.hit;
    return { noteIndex: idx, note, lane, judgment, offset, kind: 'tap' };
  }

  /** The lane has been fully released at `t`. Returns a tail event when that ends a hold. */
  release(lane: number, t: number): JudgeEvent | null {
    const idx = this.holding[lane];
    if (idx < 0) return null;
    const note = this.notes[idx];
    const tail = note.time + note.duration;
    if (mechanicOf(note) === 'release') {
      // RELEASE: letting go is judged like a press, against the tail.
      const offset = t - tail;
      if (offset >= -JUDGMENT_WINDOWS.miss) return this.endHold(idx, judgeOffset(offset) ?? 'miss', offset);
    } else if (t >= tail - HOLD_RELEASE_TOLERANCE) {
      return this.endHold(idx, 'perfect', 0);
    }
    // Let go too early: give a short grace to re-press before the hold breaks.
    this.releasedAt[idx] = t;
    return null;
  }

  /** Finish a hold's tail with a verdict (a MISS breaks it). */
  endHold(idx: number, judgment: Judgment = 'perfect', offset = 0): JudgeEvent {
    const note = this.notes[idx];
    this.state[idx] = judgment === 'miss' ? NS.broken : NS.done;
    this.holding[note.lane] = -1;
    return { noteIndex: idx, note, lane: note.lane, judgment, offset, kind: 'tail' };
  }

  private endRoll(idx: number): JudgeEvent {
    const note = this.notes[idx];
    const judgment = rollJudgment(this.rollHits[idx], this.rollTargetOf(idx));
    this.state[idx] = judgment === 'miss' ? NS.missed : NS.done;
    if (this.rolling[note.lane] === idx) this.rolling[note.lane] = -1;
    return { noteIndex: idx, note, lane: note.lane, judgment, offset: 0, kind: 'roll' };
  }

  /**
   * Advance time: auto-miss late notes, finish holds and rolls, break released holds.
   * `laneHeld` tells whether a lane is still physically held.
   */
  update(t: number, laneHeld: (lane: number) => boolean): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      // Holds
      const h = this.holding[lane];
      if (h >= 0) {
        const note = this.notes[h];
        const tail = note.time + note.duration;
        const released = this.releasedAt[h];
        const brokeEarly = !Number.isNaN(released) && !laneHeld(lane) && t - released > HOLD_REGRAB_GRACE;
        if (mechanicOf(note) === 'release') {
          if (Number.isNaN(released) && !laneHeld(lane) && t >= tail) {
            // No release event reached us (autoplay): it let go right on the tail.
            events.push(this.endHold(h, 'perfect', 0));
          } else if (t >= tail + JUDGMENT_WINDOWS.good) {
            // Kept holding past the release point.
            events.push(this.endHold(h, 'good', JUDGMENT_WINDOWS.good));
          } else if (brokeEarly) {
            events.push(this.endHold(h, 'miss', released - tail));
          }
        } else if (t >= tail) {
          events.push(this.endHold(h, 'perfect', 0));
        } else if (brokeEarly) {
          events.push(this.endHold(h, 'miss', released - tail));
        }
      }
      // Rolls
      const r = this.rolling[lane];
      if (r >= 0 && t > this.notes[r].time + this.notes[r].duration + ROLL_END_GRACE) events.push(this.endRoll(r));
      // Missed notes
      for (;;) {
        const idx = this.nextPending(lane);
        if (idx < 0) break;
        const note = this.notes[idx];
        if (mechanicOf(note) === 'roll') {
          if (t <= note.time + note.duration + ROLL_END_GRACE) break;
          this.rollHits[idx] = 0;
          events.push(this.endRoll(idx));
          continue;
        }
        if (t - note.time <= JUDGMENT_WINDOWS.miss) break;
        this.state[idx] = NS.missed;
        events.push({
          noteIndex: idx,
          note,
          lane,
          judgment: 'miss',
          offset: t - note.time,
          kind: hasTail(note) ? 'head' : 'tap',
        });
      }
    }
    return events;
  }

  /** Mark everything before `t` as skipped (debug seek). */
  skipBefore(t: number): void {
    this.notes.forEach((n, i) => {
      if (this.state[i] === NS.pending && n.time < t) this.state[i] = NS.skipped;
    });
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      for (const list of [this.holding, this.rolling]) {
        const idx = list[lane];
        if (idx >= 0 && this.notes[idx].time + this.notes[idx].duration < t) {
          this.state[idx] = NS.skipped;
          list[lane] = -1;
        }
      }
    }
  }

  get allResolved(): boolean {
    for (let i = 0; i < this.state.length; i++) {
      const s = this.state[i];
      if (s === NS.pending || s === NS.holding || s === NS.rolling) return false;
    }
    return true;
  }
}
