import { parseChart } from '../chart/chartParser';
import { DIFFICULTIES } from '../config/difficulty';
import type { ChartParseResult, DifficultyId, SongDefinition } from '../types';
import { analyzeComposition, type CompositionAnalysis } from '../audio/synth/music';
import { crimsonPulse } from './crimsonPulse';
import { digitalRain } from './digitalRain';
import { glitchGarden } from './glitchGarden';
import { lofiMoonrise } from './lofiMoonrise';
import { midnightDrive } from './midnightDrive';
import { neonRush } from './neonRush';
import { oceanCircuit } from './oceanCircuit';
import { solarFlare } from './solarFlare';
import { starlightParade } from './starlightParade';

/** Song registry. Add a song definition here and it shows up in the game. */
export const SONGS: readonly SongDefinition[] = [
  midnightDrive,
  digitalRain,
  neonRush,
  lofiMoonrise,
  starlightParade,
  oceanCircuit,
  glitchGarden,
  crimsonPulse,
  solarFlare,
];

export function getSong(id: string): SongDefinition | undefined {
  return SONGS.find((s) => s.id === id);
}

export function availableDifficulties(song: SongDefinition): DifficultyId[] {
  return DIFFICULTIES.map((d) => d.id).filter((id) => song.difficulties[id]);
}

const chartCache = new Map<string, ChartParseResult>();

/** Parse (and cache) a song chart. Never throws: malformed charts come back with errors. */
export function loadChart(song: SongDefinition, difficulty: DifficultyId): ChartParseResult | null {
  const def = song.difficulties[difficulty];
  if (!def) return null;
  const key = `${song.id}/${difficulty}`;
  let result = chartCache.get(key);
  if (!result) {
    try {
      result = parseChart(def.chart, { bpm: song.bpm, offset: song.offset });
    } catch (err) {
      result = {
        chart: { bpm: song.bpm, offset: song.offset, duration: 0, notes: [], sections: [] },
        errors: [{ line: 0, message: err instanceof Error ? err.message : String(err) }],
        warnings: [],
      };
    }
    chartCache.set(key, result);
  }
  return result;
}

const analysisCache = new Map<string, CompositionAnalysis>();

export function songAnalysis(song: SongDefinition): CompositionAnalysis {
  let a = analysisCache.get(song.id);
  if (!a) {
    a = analyzeComposition(song.composition);
    analysisCache.set(song.id, a);
  }
  return a;
}

/** Audio length in seconds (without the reverb tail). */
export function songLength(song: SongDefinition): number {
  return (songAnalysis(song).totalBeats * 60) / song.bpm + song.offset;
}
