import type { Note, NoteMechanic, NoteType } from '../types';

export interface NoteTypeDef {
  mechanic: NoteMechanic;
  label: string;
  /** Visual note thickness relative to the default. */
  thickness: number;
  /** Tint mixed into the lane colour; null keeps the lane colour. */
  tint: string | null;
}

/**
 * Registry of note types. To add a type: extend `NoteType`, add an entry here,
 * and (optionally) teach the chart parser a classification rule.
 */
export const NOTE_TYPES: Record<NoteType, NoteTypeDef> = {
  tap: { mechanic: 'tap', label: 'TAP', thickness: 1, tint: null },
  hold: { mechanic: 'hold', label: 'HOLD', thickness: 1, tint: null },
  release: { mechanic: 'release', label: 'RELEASE', thickness: 1, tint: '#b8fff6' },
  roll: { mechanic: 'roll', label: 'ROLL', thickness: 1.1, tint: '#ffb13d' },
  double: { mechanic: 'tap', label: 'DOUBLE', thickness: 1, tint: '#ffe45c' },
  rapid: { mechanic: 'tap', label: 'RAPID', thickness: 0.75, tint: '#7dfcff' },
  burst: { mechanic: 'tap', label: 'BURST', thickness: 1, tint: '#ff7a3d' },
};

/** Two notes closer than this many seconds (same lane or adjacent in time) are RAPID. */
export const RAPID_GAP_SECONDS = 0.13;

export const mechanicOf = (note: Pick<Note, 'type'>): NoteMechanic => NOTE_TYPES[note.type].mechanic;

/** HOLD and RELEASE have a judged tail. */
export const hasTail = (note: Pick<Note, 'type'>): boolean => {
  const m = mechanicOf(note);
  return m === 'hold' || m === 'release';
};

/** Judgments a note produces: tails count as their own judgment; a roll is judged once. */
export const judgmentUnits = (note: Pick<Note, 'type'>): number => (hasTail(note) ? 2 : 1);

/** Taps needed to clear a roll: one per eighth note (at least 3). */
export const ROLL_HITS_PER_BEAT = 2;
export function rollTarget(note: Pick<Note, 'duration'>, secondsPerBeat: number): number {
  return Math.max(3, Math.round((note.duration / secondsPerBeat) * ROLL_HITS_PER_BEAT));
}
