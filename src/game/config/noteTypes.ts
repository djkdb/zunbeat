import type { NoteMechanic, NoteType } from '../types';

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
  double: { mechanic: 'tap', label: 'DOUBLE', thickness: 1, tint: '#ffe45c' },
  rapid: { mechanic: 'tap', label: 'RAPID', thickness: 0.75, tint: '#7dfcff' },
  burst: { mechanic: 'tap', label: 'BURST', thickness: 1, tint: '#ff7a3d' },
};

/** Two notes closer than this many seconds (same lane or adjacent in time) are RAPID. */
export const RAPID_GAP_SECONDS = 0.13;
