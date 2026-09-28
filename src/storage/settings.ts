import { DEFAULT_KEYS, LANE_COUNT } from '../game/constants';
import { bool, isRecord, num, safeStorage, str } from './safeStorage';

export const NOTE_SPEEDS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3] as const;

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  noteSpeed: number;
  keys: string[];
  reducedMotion: boolean;
  /** Audio/visual calibration in ms (positive: notes arrive later). */
  offsetMs: number;
  showFastSlow: boolean;
  lastSongId: string;
  lastDifficulty: string;
}

const KEY = 'beatshift.settings.v1';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function defaultSettings(): Settings {
  return {
    masterVolume: 0.8,
    musicVolume: 0.8,
    sfxVolume: 0.65,
    noteSpeed: 1.75,
    keys: [...DEFAULT_KEYS],
    reducedMotion: prefersReducedMotion(),
    offsetMs: 0,
    showFastSlow: true,
    lastSongId: 'midnight-drive',
    lastDifficulty: 'normal',
  };
}

export function validateSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!isRecord(raw)) return d;
  const keys =
    Array.isArray(raw.keys) &&
    raw.keys.length === LANE_COUNT &&
    raw.keys.every((k) => typeof k === 'string' && k.length > 0) &&
    new Set(raw.keys).size === LANE_COUNT
      ? (raw.keys as string[])
      : d.keys;
  const speed = num(raw.noteSpeed, d.noteSpeed);
  return {
    masterVolume: num(raw.masterVolume, d.masterVolume, 0, 1),
    musicVolume: num(raw.musicVolume, d.musicVolume, 0, 1),
    sfxVolume: num(raw.sfxVolume, d.sfxVolume, 0, 1),
    noteSpeed: (NOTE_SPEEDS as readonly number[]).includes(speed) ? speed : d.noteSpeed,
    keys,
    reducedMotion: bool(raw.reducedMotion, d.reducedMotion),
    offsetMs: Math.round(num(raw.offsetMs, 0, -200, 200)),
    showFastSlow: bool(raw.showFastSlow, true),
    lastSongId: str(raw.lastSongId, d.lastSongId),
    lastDifficulty: str(raw.lastDifficulty, d.lastDifficulty),
  };
}

export function loadSettings(): Settings {
  return safeStorage.read(KEY, validateSettings) ?? defaultSettings();
}

export function saveSettings(s: Settings): void {
  safeStorage.write(KEY, s);
}

/** Human label for a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'N' + code.slice(6);
  const map: Record<string, string> = {
    Space: 'SPC',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    BracketLeft: '[',
    BracketRight: ']',
    ShiftLeft: 'LSHIFT',
    ShiftRight: 'RSHIFT',
  };
  return map[code] ?? code.toUpperCase().slice(0, 6);
}
