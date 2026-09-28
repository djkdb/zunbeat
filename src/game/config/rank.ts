/**
 * Rank combines accuracy (70%) and the fraction of the theoretical max score (30%).
 * S+ additionally requires no misses.
 */
export const RANKS = [
  { rank: 'S+', min: 97.5, requireFullCombo: true },
  { rank: 'S', min: 94 },
  { rank: 'A', min: 88 },
  { rank: 'B', min: 78 },
  { rank: 'C', min: 65 },
  { rank: 'D', min: 0 },
] as const;

export type Rank = (typeof RANKS)[number]['rank'];

export function rankValue(accuracy: number, scoreRatio: number): number {
  const ratio = Math.max(0, Math.min(1, scoreRatio));
  return accuracy * 0.7 + ratio * 100 * 0.3;
}

export function computeRank(accuracy: number, scoreRatio: number, fullCombo: boolean): Rank {
  const value = rankValue(accuracy, scoreRatio);
  for (const entry of RANKS) {
    if ('requireFullCombo' in entry && entry.requireFullCombo && !fullCombo) continue;
    if (value >= entry.min) return entry.rank;
  }
  return 'D';
}

export const RANK_ORDER: readonly string[] = RANKS.map((r) => r.rank);

export function isBetterRank(a: string, b: string | undefined): boolean {
  if (!b) return true;
  const ia = RANK_ORDER.indexOf(a);
  const ib = RANK_ORDER.indexOf(b);
  if (ib < 0) return true;
  return ia >= 0 && ia < ib;
}
