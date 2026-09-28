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
  /** Version of the HOW TO PLAY card the player has seen (0 = never). */
  tutorialSeen: number;
}

/** Bump when the HOW TO PLAY card gains content everyone should see once more. */
export const TUTORIAL_VERSION = 2;

/** Audio offset range in ms (Bluetooth headphones can need 200+). */
export const OFFSET_LIMIT_MS = 300;

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
    // First-time players start on EASY.
    lastDifficulty: 'easy',
    tutorialSeen: 0,
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
    offsetMs: Math.round(num(raw.offsetMs, 0, -OFFSET_LIMIT_MS, OFFSET_LIMIT_MS)),
    showFastSlow: bool(raw.showFastSlow, true),
    lastSongId: str(raw.lastSongId, d.lastSongId),
    lastDifficulty: str(raw.lastDifficulty, d.lastDifficulty),
    // v1 stored a boolean `seenTutorial`.
    tutorialSeen: Math.round(num(raw.tutorialSeen, raw.seenTutorial === true ? 1 : 0, 0, 1000)),
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
