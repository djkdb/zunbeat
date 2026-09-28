import { isDifficultyId } from '../game/config/difficulty';
import type { DifficultyId, PlayResult } from '../game/types';
import { isBetterRank } from '../game/config/rank';
import { bool, isRecord, num, safeStorage, str } from './safeStorage';

export interface BestRecord {
  songId: string;
  difficulty: DifficultyId;
  bestScore: number;
  bestAccuracy: number;
  maxCombo: number;
  bestRank: string;
  fullCombo: boolean;
  allPerfect: boolean;
  playCount: number;
  lastPlayed: number;
}

export interface RecentPlay {
  songId: string;
  difficulty: DifficultyId;
  score: number;
  accuracy: number;
  maxCombo: number;
  rank: string;
  fullCombo: boolean;
  playedAt: number;
}

export interface RecordsData {
  best: Record<string, BestRecord>;
  recent: RecentPlay[];
}

export interface SaveOutcome {
  newBestScore: boolean;
  newBestAccuracy: boolean;
  newMaxCombo: boolean;
  previous: BestRecord | null;
}

const KEY = 'beatshift.records.v1';
const MAX_RECENT = 50;

export const recordKey = (songId: string, difficulty: DifficultyId) => `${songId}/${difficulty}`;

function validateBest(raw: unknown): BestRecord | null {
  if (!isRecord(raw) || !isDifficultyId(raw.difficulty) || typeof raw.songId !== 'string') return null;
  return {
    songId: raw.songId,
    difficulty: raw.difficulty,
    bestScore: Math.round(num(raw.bestScore, 0, 0, 1e8)),
    bestAccuracy: num(raw.bestAccuracy, 0, 0, 100),
    maxCombo: Math.round(num(raw.maxCombo, 0, 0, 1e5)),
    bestRank: str(raw.bestRank, 'D'),
    fullCombo: bool(raw.fullCombo, false),
    allPerfect: bool(raw.allPerfect, false),
    playCount: Math.round(num(raw.playCount, 0, 0, 1e7)),
    lastPlayed: num(raw.lastPlayed, 0, 0),
  };
}

function validateRecent(raw: unknown): RecentPlay | null {
  if (!isRecord(raw) || !isDifficultyId(raw.difficulty) || typeof raw.songId !== 'string') return null;
  return {
    songId: raw.songId,
    difficulty: raw.difficulty,
    score: Math.round(num(raw.score, 0, 0, 1e8)),
    accuracy: num(raw.accuracy, 0, 0, 100),
    maxCombo: Math.round(num(raw.maxCombo, 0, 0, 1e5)),
    rank: str(raw.rank, 'D'),
    fullCombo: bool(raw.fullCombo, false),
    playedAt: num(raw.playedAt, 0, 0),
  };
}

/** Drops anything malformed instead of failing the whole file. */
export function validateRecords(raw: unknown): RecordsData {
  const data: RecordsData = { best: {}, recent: [] };
  if (!isRecord(raw)) return data;
  if (isRecord(raw.best)) {
    for (const value of Object.values(raw.best)) {
      const b = validateBest(value);
      if (b) data.best[recordKey(b.songId, b.difficulty)] = b;
    }
  }
  if (Array.isArray(raw.recent)) {
    data.recent = raw.recent.map(validateRecent).filter((r): r is RecentPlay => r !== null).slice(0, MAX_RECENT);
  }
  return data;
}

export function loadRecords(): RecordsData {
  return safeStorage.read(KEY, validateRecords) ?? { best: {}, recent: [] };
}

/** Save a finished play. Autoplay runs are never recorded. */
export function saveResult(result: PlayResult): SaveOutcome {
  const data = loadRecords();
  const key = recordKey(result.songId, result.difficulty);
  const previous = data.best[key] ?? null;
  const outcome: SaveOutcome = {
    newBestScore: !previous || result.score > previous.bestScore,
    newBestAccuracy: !previous || result.accuracy > previous.bestAccuracy,
    newMaxCombo: !previous || result.maxCombo > previous.maxCombo,
    previous,
  };
  if (result.autoplay) return { newBestScore: false, newBestAccuracy: false, newMaxCombo: false, previous };

  data.best[key] = {
    songId: result.songId,
    difficulty: result.difficulty,
    bestScore: Math.max(result.score, previous?.bestScore ?? 0),
    bestAccuracy: Math.max(result.accuracy, previous?.bestAccuracy ?? 0),
    maxCombo: Math.max(result.maxCombo, previous?.maxCombo ?? 0),
    bestRank: isBetterRank(result.rank, previous?.bestRank) ? result.rank : (previous?.bestRank ?? result.rank),
    fullCombo: result.fullCombo || (previous?.fullCombo ?? false),
    allPerfect: result.allPerfect || (previous?.allPerfect ?? false),
    playCount: (previous?.playCount ?? 0) + 1,
    lastPlayed: result.playedAt,
  };
  data.recent.unshift({
    songId: result.songId,
    difficulty: result.difficulty,
    score: result.score,
    accuracy: result.accuracy,
    maxCombo: result.maxCombo,
    rank: result.rank,
    fullCombo: result.fullCombo,
    playedAt: result.playedAt,
  });
  data.recent = data.recent.slice(0, MAX_RECENT);
  safeStorage.write(KEY, data);
  return outcome;
}

export function resetRecords(): void {
  safeStorage.remove(KEY);
}

export interface GlobalStats {
  bestScore: number;
  bestAccuracy: number;
  maxCombo: number;
  plays: number;
}

export function globalStats(data: RecordsData): GlobalStats {
  const all = Object.values(data.best);
  return {
    bestScore: all.reduce((m, r) => Math.max(m, r.bestScore), 0),
    bestAccuracy: all.reduce((m, r) => Math.max(m, r.bestAccuracy), 0),
    maxCombo: all.reduce((m, r) => Math.max(m, r.maxCombo), 0),
    plays: all.reduce((n, r) => n + r.playCount, 0),
  };
}
