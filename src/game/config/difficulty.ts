import type { DifficultyId } from '../types';

export interface DifficultyMeta {
  id: DifficultyId;
  label: string;
  short: string;
  color: string;
}

/** Ordered list; adding a difficulty here makes it appear everywhere automatically. */
export const DIFFICULTIES: readonly DifficultyMeta[] = [
  { id: 'easy', label: 'EASY', short: 'EZ', color: '#3dffb0' },
  { id: 'normal', label: 'NORMAL', short: 'NM', color: '#3dc8ff' },
  { id: 'hard', label: 'HARD', short: 'HD', color: '#ff3d8b' },
  { id: 'expert', label: 'EXPERT', short: 'EX', color: '#c86bff' },
];

export function difficultyMeta(id: DifficultyId): DifficultyMeta {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[0];
}

export function isDifficultyId(value: unknown): value is DifficultyId {
  return typeof value === 'string' && DIFFICULTIES.some((d) => d.id === value);
}
