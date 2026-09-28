import { JUDGMENT_WINDOWS } from '../config/judgment';
import type { TimingSummary } from '../types';

export const TIMING_BIN_MS = 20;
/** Only suggest an offset change when the player is consistently this far off. */
export const OFFSET_SUGGEST_MIN_MS = 25;
export const OFFSET_SUGGEST_MIN_SAMPLES = 20;

/**
 * Summarise press timing (seconds, negative = early). Uses a trimmed mean so a few
 * wild presses don't skew the sync suggestion.
 */
export function summarizeTiming(offsets: readonly number[], offsetMsUsed: number): TimingSummary {
  const limitMs = JUDGMENT_WINDOWS.miss * 1000;
  const bins = Math.ceil((limitMs * 2) / TIMING_BIN_MS);
  const histogram = new Array<number>(bins).fill(0);
  const ms = offsets.map((o) => o * 1000).filter((v) => Math.abs(v) <= limitMs);
  for (const v of ms) histogram[Math.min(bins - 1, Math.floor((v + limitMs) / TIMING_BIN_MS))]++;
  const sorted = [...ms].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.1);
  const core = sorted.slice(trim, sorted.length - trim);
  const meanMs = core.length ? core.reduce((a, b) => a + b, 0) / core.length : 0;
  return { meanMs, samples: ms.length, histogram, binMs: TIMING_BIN_MS, rangeMs: limitMs, offsetMsUsed };
}

/** Offset (ms) that would centre this player's timing, or null when no change is needed. */
export function suggestedOffset(t: TimingSummary, limit: number): number | null {
  if (t.samples < OFFSET_SUGGEST_MIN_SAMPLES || Math.abs(t.meanMs) < OFFSET_SUGGEST_MIN_MS) return null;
  const next = Math.round((t.offsetMsUsed + t.meanMs) / 5) * 5;
  return Math.max(-limit, Math.min(limit, next));
}
