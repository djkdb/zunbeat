import type { Judgment, NoteType } from '../types';

/**
 * Every scoring rule lives here. ScoreSystem reads this; nothing else does maths on score.
 *
 * score per judgment = base × comboMultiplier × feverMultiplier (+ type bonus)
 *   base            = BASE_POOL / totalJudgments × JUDGMENT_WEIGHT
 * plus hold ticks while a hold is kept down.
 */
export const SCORING = {
  /** A perfect run with no multipliers is worth exactly this much base score. */
  basePool: 1_000_000,
  judgmentWeight: { perfect: 1, great: 0.7, good: 0.3, miss: 0 } satisfies Record<Judgment, number>,
  /** Accuracy weight (percent contribution) for each judgment. */
  accuracyWeight: { perfect: 1, great: 0.75, good: 0.4, miss: 0 } satisfies Record<Judgment, number>,
  /** Ascending combo thresholds and their multiplier. */
  comboTiers: [
    { combo: 0, multiplier: 1 },
    { combo: 25, multiplier: 1.05 },
    { combo: 50, multiplier: 1.1 },
    { combo: 100, multiplier: 1.2 },
    { combo: 200, multiplier: 1.3 },
  ],
  feverMultiplier: 1.5,
  /** Extra fraction of base awarded for special note types (only on perfect/great). */
  typeBonus: { tap: 0, hold: 0, release: 0.1, roll: 0, double: 0.1, rapid: 0.05, burst: 0.15 } satisfies Record<NoteType, number>,
  /** Points granted per hold tick (every `holdTickBeats` beats held). */
  holdTickPoints: 120,
  holdTickBeats: 0.25,
  /** Points per tap on a ROLL, counted up to `rollBonusCap` × the roll's target. */
  rollHitPoints: 150,
  rollBonusCap: 1.5,
} as const;

export function rollHitScore(fever: boolean): number {
  return Math.round(SCORING.rollHitPoints * (fever ? SCORING.feverMultiplier : 1));
}

export function comboMultiplier(combo: number): number {
  let mult = 1;
  for (const tier of SCORING.comboTiers) {
    if (combo >= tier.combo) mult = tier.multiplier;
  }
  return mult;
}

export interface ScoreInput {
  judgment: Judgment;
  noteType: NoteType;
  /** Combo *after* this judgment is applied. */
  combo: number;
  fever: boolean;
  totalJudgments: number;
}

export function scoreForJudgment({ judgment, noteType, combo, fever, totalJudgments }: ScoreInput): number {
  if (judgment === 'miss' || totalJudgments <= 0) return 0;
  const base = (SCORING.basePool / totalJudgments) * SCORING.judgmentWeight[judgment];
  const bonus = judgment === 'perfect' || judgment === 'great' ? SCORING.typeBonus[noteType] : 0;
  const mult = comboMultiplier(combo) * (fever ? SCORING.feverMultiplier : 1);
  return Math.round(base * (1 + bonus) * mult);
}

export function holdTickScore(fever: boolean): number {
  return Math.round(SCORING.holdTickPoints * (fever ? SCORING.feverMultiplier : 1));
}

/** Accuracy in percent (0–100). Defined as 100 when nothing has been judged yet. */
export function computeAccuracy(counts: Record<Judgment, number>): number {
  const judged = counts.perfect + counts.great + counts.good + counts.miss;
  if (judged === 0) return 100;
  const earned =
    counts.perfect * SCORING.accuracyWeight.perfect +
    counts.great * SCORING.accuracyWeight.great +
    counts.good * SCORING.accuracyWeight.good;
  return (earned / judged) * 100;
}
