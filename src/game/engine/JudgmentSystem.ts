import { HOLD_REGRAB_GRACE, HOLD_RELEASE_TOLERANCE, JUDGMENT_WINDOWS, judgeOffset } from '../config/judgment';
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
} as const;
export type NoteStateValue = (typeof NS)[keyof typeof NS];

export type JudgeKind = 'tap' | 'head' | 'tail';

export interface JudgeEvent {
  noteIndex: number;
  note: Note;
  lane: number;
  judgment: Judgment;
  /** Press time minus note time (negative = early). */
  offset: number;
  kind: JudgeKind;
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
  private laneQueue: number[][] = [];
  private lanePtr: number[] = [];
  /** Note index currently being held per lane, or -1. */
  holding: number[] = new Array(LANE_COUNT).fill(-1);

  constructor(notes: Note[]) {
    this.load(notes);
  }

  load(notes: Note[]): void {
    const prevState = this.state;
    const prevNotes = this.notes;
    this.notes = [...notes].sort((a, b) => a.time - b.time || a.lane - b.lane);
    this.state = new Uint8Array(this.notes.length);
    this.releasedAt = new Float64Array(this.notes.length).fill(NaN);
    this.ticks = new Uint16Array(this.notes.length);
    // Preserve state when notes are injected mid-song (debug).
    if (prevNotes.length) {
      const byId = new Map(prevNotes.map((n, i) => [n.id, prevState[i]]));
      this.notes.forEach((n, i) => (this.state[i] = byId.get(n.id) ?? NS.pending));
    }
    this.laneQueue = Array.from({ length: LANE_COUNT }, () => []);
    this.notes.forEach((n, i) => this.laneQueue[n.lane]?.push(i));
    this.lanePtr = new Array(LANE_COUNT).fill(0);
    this.holding = this.holding.map((idx) => (idx >= 0 ? this.notes.findIndex((n) => n.id === prevNotes[idx]?.id) : -1));
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

  /** A press at song time `t` on `lane`. Returns the judgment, or null for an empty press. */
  press(lane: number, t: number): JudgeEvent | 'regrab' | null {
    const holdIdx = this.holding[lane];
    if (holdIdx >= 0 && !Number.isNaN(this.releasedAt[holdIdx])) {
      this.releasedAt[holdIdx] = NaN;
      return 'regrab';
    }
    const idx = this.nextPending(lane);
    if (idx < 0) return null;
    const note = this.notes[idx];
    const offset = t - note.time;
    const judgment = judgeOffset(offset);
    if (!judgment) return null; // too early: ignore
    if (note.duration > 0) {
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

  /** The lane has been fully released at `t`. Returns a tail event when the hold completes. */
  release(lane: number, t: number): JudgeEvent | null {
    const idx = this.holding[lane];
    if (idx < 0) return null;
    const note = this.notes[idx];
    const tail = note.time + note.duration;
    if (t >= tail - HOLD_RELEASE_TOLERANCE) return this.completeHold(idx);
    this.releasedAt[idx] = t;
    return null;
  }

  completeHold(idx: number): JudgeEvent {
    const note = this.notes[idx];
    this.state[idx] = NS.done;
    this.holding[note.lane] = -1;
    return { noteIndex: idx, note, lane: note.lane, judgment: 'perfect', offset: 0, kind: 'tail' };
  }

  /**
   * Advance time: auto-miss late notes, complete finished holds, break released holds.
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
        if (t >= tail) {
          events.push(this.completeHold(h));
        } else if (!Number.isNaN(released) && !laneHeld(lane) && t - released > HOLD_REGRAB_GRACE) {
          this.state[h] = NS.broken;
          this.holding[lane] = -1;
          events.push({ noteIndex: h, note, lane, judgment: 'miss', offset: released - tail, kind: 'tail' });
        }
      }
      // Missed notes
      for (;;) {
        const idx = this.nextPending(lane);
        if (idx < 0) break;
        const note = this.notes[idx];
        if (t - note.time <= JUDGMENT_WINDOWS.miss) break;
        this.state[idx] = NS.missed;
        events.push({
          noteIndex: idx,
          note,
          lane,
          judgment: 'miss',
          offset: t - note.time,
          kind: note.duration > 0 ? 'head' : 'tap',
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
      const h = this.holding[lane];
      if (h >= 0 && this.notes[h].time + this.notes[h].duration < t) {
        this.state[h] = NS.skipped;
        this.holding[lane] = -1;
      }
    }
  }

  get allResolved(): boolean {
    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i] === NS.pending || this.state[i] === NS.holding) return false;
    }
    return true;
  }
}
