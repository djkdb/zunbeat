/** Core domain types shared by the engine, renderer, UI and tooling. */
import type { Composition } from './audio/synth/music';

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'expert';

/**
 * Note types. `mechanic` (see config/noteTypes.ts) decides how a type is played;
 * the type itself decides the look, the sound and bonus scoring.
 */
export type NoteType = 'tap' | 'hold' | 'double' | 'rapid' | 'burst';

export type NoteMechanic = 'tap' | 'hold';

export interface Note {
  id: number;
  /** Seconds from song time 0 (beat 0 of the audio). */
  time: number;
  lane: number;
  type: NoteType;
  /** Hold length in seconds (0 for taps). */
  duration: number;
  /** Beat position; kept for tooling and debug displays. */
  beat: number;
  /** Notes that share this id must be hit together (doubles). */
  chordId: number | null;
  /** Section index the note belongs to. */
  section: number;
}

export interface ChartSection {
  name: string;
  startBeat: number;
  startTime: number;
  flags: ReadonlySet<string>;
}

export interface Chart {
  bpm: number;
  offset: number;
  /** Seconds until the last note (tail) finishes. */
  duration: number;
  notes: Note[];
  sections: ChartSection[];
}

export interface ChartParseIssue {
  line: number;
  message: string;
}

export interface ChartParseResult {
  chart: Chart;
  errors: ChartParseIssue[];
  warnings: ChartParseIssue[];
}

export type Judgment = 'perfect' | 'great' | 'good' | 'miss';

export type BackgroundId = 'highway' | 'rain' | 'rush' | 'stars' | 'waves';

export interface SongTheme {
  background: BackgroundId;
  /** Lane colours, left to right. */
  laneColors: [string, string, string, string];
  accent: string;
  accent2: string;
  /** CSS gradient used for jacket art and menus. */
  jacket: string;
  /** Background sky/backdrop colours, top to bottom (dark → lighter). */
  sky: [string, string, string];
}

export interface DifficultyDef {
  level: number;
  /** Raw chart text in the BEAT//SHIFT chart format (see chart/chartParser.ts). */
  chart: string;
}

export interface SongDefinition {
  id: string;
  index: number;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  /** Seconds between audio start and beat 0. */
  offset: number;
  /** Beat where the song-select preview starts. */
  previewBeat: number;
  theme: SongTheme;
  composition: Composition;
  difficulties: Partial<Record<DifficultyId, DifficultyDef>>;
}

export interface JudgmentCounts {
  perfect: number;
  great: number;
  good: number;
  miss: number;
}

export interface PlayResult {
  songId: string;
  difficulty: DifficultyId;
  score: number;
  accuracy: number;
  maxCombo: number;
  counts: JudgmentCounts;
  fast: number;
  slow: number;
  totalJudgments: number;
  rank: string;
  fullCombo: boolean;
  allPerfect: boolean;
  autoplay: boolean;
  /** 0..1 fraction of the theoretical max score. */
  scoreRatio: number;
  playedAt: number;
}
