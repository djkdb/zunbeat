import type { Chart, Judgment } from '../types';
import { hasTail, judgmentUnits } from './noteTypes';

/**
 * FEVER: good judgments charge the gauge; when it is full FEVER starts automatically.
 * The gauge size is chart-driven: a clean run fills it right as the first `[drop…]`
 * section begins, so the first FEVER lands on the drop in every song and difficulty.
 */
export const FEVER = {
  /** Fallback when a chart has no drop section: fill after this fraction of judgments. */
  fillFraction: 0.26,
  /** Sections whose name starts with this are treated as peaks. */
  peakPrefix: 'drop',
  /** Charge per judgment, in "perfect units" (a MISS drains). */
  weight: { perfect: 1, great: 0.6, good: 0.2, miss: -6 } satisfies Record<Judgment, number>,
  /** Extra charge per completed hold, in perfect units. */
  holdCompleteWeight: 1,
  /** FEVER length in beats (so it lines up with musical phrases). */
  durationBeats: 32,
  /** A MISS during FEVER removes this fraction of the remaining time. */
  missPenalty: 0.2,
} as const;

/** Number of perfect judgments that fill the gauge for a chart. */
export function feverFillSize(chart: Chart): number {
  const total = chart.notes.reduce((n, note) => n + judgmentUnits(note), 0);
  const peak = chart.sections.find((s) => s.name.startsWith(FEVER.peakPrefix) && s.startBeat > 0);
  if (!peak) return Math.max(20, FEVER.fillFraction * total);
  // Charge a clean run collects before the peak (hold tails count at their end time).
  let before = 0;
  for (const note of chart.notes) {
    const judgedAt = note.type === 'roll' ? note.time + note.duration : note.time;
    if (judgedAt < peak.startTime - 1e-6) before += FEVER.weight.perfect;
    if (hasTail(note) && note.time + note.duration < peak.startTime - 1e-6) {
      before += FEVER.weight.perfect + FEVER.holdCompleteWeight;
    }
  }
  // +0.5 so the gauge tops out on the first note of the peak, not the last one before it.
  return Math.max(20, before + 0.5);
}
