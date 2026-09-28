import type { Judgment } from '../types';

/**
 * Timing windows in seconds (half-width, i.e. ±window around the note time).
 * Tweak these to rebalance the game; nothing else hardcodes timing.
 */
export const JUDGMENT_WINDOWS = {
  perfect: 0.045,
  great: 0.09,
  good: 0.135,
  /** Presses inside this window (but outside `good`) consume the note as a MISS. */
  miss: 0.18,
} as const;

/** Hold notes: releasing within this many seconds of the tail still counts as complete. */
export const HOLD_RELEASE_TOLERANCE = 0.12;
/** Grace period for a finger/key lifting and re-pressing during a hold. */
export const HOLD_REGRAB_GRACE = 0.08;
/** Offsets inside this range are not reported as FAST/SLOW. */
export const FAST_SLOW_THRESHOLD = 0.022;

export const JUDGMENT_ORDER: readonly Judgment[] = ['perfect', 'great', 'good', 'miss'];

export function judgeOffset(offsetSeconds: number): Judgment | null {
  const abs = Math.abs(offsetSeconds);
  if (abs <= JUDGMENT_WINDOWS.perfect) return 'perfect';
  if (abs <= JUDGMENT_WINDOWS.great) return 'great';
  if (abs <= JUDGMENT_WINDOWS.good) return 'good';
  if (abs <= JUDGMENT_WINDOWS.miss) return 'miss';
  return null;
}

export const JUDGMENT_LABEL: Record<Judgment, string> = {
  perfect: 'PERFECT',
  great: 'GREAT',
  good: 'GOOD',
  miss: 'MISS',
};
