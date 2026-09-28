/**
 * Composition format for the built-in synth songs.
 *
 * All melodic/drum patterns are written on a 16th-note grid and loop across their section.
 *   drums:  'x' hit, 'g' ghost (quiet), '.' rest           e.g. "x...x...x...x..."
 *   bass:   'R' chord root (octave below), 'O' chord root, '5' fifth, note names, '.' rest, '-' tie
 *   arp:    digit = index into the current chord (+1 octave), "'" suffix = one more octave
 *   lead:   note names (C#5), '.' rest, '-' tie
 * Chords are one per bar (cycling) and written as note lists: "A2 E3 A3 C4".
 */

export interface SectionDef {
  name: string;
  bars: number;
  /** 0–1: drives visual intensity. */
  energy: number;
  /** 0–1 brightness for synth filters. Defaults to 1. */
  tone?: number;
  chords?: string[];
  pad?: boolean;
  kick?: string;
  snare?: string;
  clap?: string;
  hat?: string;
  openHat?: string;
  bass?: string;
  arp?: string;
  lead?: string;
  /** Lead gain multiplier. */
  leadGain?: number;
  arpGain?: number;
  crash?: boolean;
  impact?: boolean;
  riser?: boolean;
  /** Snare roll that accelerates through the section (build-ups). */
  roll?: boolean;
}

export type LeadWave = 'supersaw' | 'pulse' | 'bell';

export interface SoundDesign {
  kickTune: number;
  /** Kick saturation (1 = clean punch, 2–3 = hard/distorted). */
  kickDrive: number;
  leadWave: LeadWave;
  leadDetune: number;
  leadBrightness: number;
  bassDrive: number;
  reverb: number;
  sidechain: number;
  /** Overall hi-hat level. */
  hatLevel: number;
}

export interface Composition {
  bpm: number;
  sound?: Partial<SoundDesign>;
  sections: SectionDef[];
}

export const DEFAULT_SOUND: SoundDesign = {
  kickTune: 1,
  kickDrive: 1,
  leadWave: 'supersaw',
  hatLevel: 1,
  leadDetune: 1,
  leadBrightness: 1,
  bassDrive: 1,
  reverb: 1,
  sidechain: 0.55,
};

const NOTE_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(name: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  let midi = NOTE_OFFSETS[m[1].toUpperCase()] + (Number(m[3]) + 1) * 12;
  if (m[2] === '#') midi++;
  if (m[2] === 'b') midi--;
  return midi;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function parseChord(chord: string): number[] {
  return chord
    .trim()
    .split(/\s+/)
    .map(noteToMidi)
    .filter((n): n is number => n !== null);
}

export function tokens(pattern: string): string[] {
  return pattern.trim().split(/\s+/);
}

/** Drum strings may be written with or without spaces. */
export function drumSteps(pattern: string): string[] {
  return pattern.replace(/\s+/g, '').split('');
}

export interface MelodicEvent {
  step: number;
  midi: number;
  lengthSteps: number;
}

/** Expand a looping melodic pattern over `totalSteps`, resolving chord-relative tokens. */
export function expandMelodic(
  pattern: string,
  totalSteps: number,
  chordAtStep: (step: number) => number[],
  kind: 'bass' | 'arp' | 'lead',
): MelodicEvent[] {
  const toks = tokens(pattern);
  if (toks.length === 0) return [];
  const events: MelodicEvent[] = [];
  for (let step = 0; step < totalSteps; step++) {
    const tok = toks[step % toks.length];
    if (tok === '.' || tok === '-') continue;
    const midi = resolveToken(tok, chordAtStep(step), kind);
    if (midi === null) continue;
    let len = 1;
    while (step + len < totalSteps && toks[(step + len) % toks.length] === '-') len++;
    events.push({ step, midi, lengthSteps: len });
  }
  return events;
}

function resolveToken(tok: string, chord: number[], kind: 'bass' | 'arp' | 'lead'): number | null {
  const root = chord[0] ?? 45;
  if (kind === 'bass') {
    if (tok === 'R') return root - 12;
    if (tok === 'O') return root;
    if (tok === '5') return root - 12 + 7;
    if (tok === '8') return root + 12;
  }
  if (kind === 'arp') {
    const m = /^(\d)('*)$/.exec(tok);
    if (m && chord.length) {
      const idx = Number(m[1]);
      const base = chord[idx % chord.length] + 12 * Math.floor(idx / chord.length);
      return base + 12 + 12 * m[2].length;
    }
  }
  return noteToMidi(tok);
}

export interface SectionTiming {
  name: string;
  startBeat: number;
  bars: number;
  energy: number;
}

export interface CompositionAnalysis {
  totalBeats: number;
  sections: SectionTiming[];
  kickBeats: number[];
  snareBeats: number[];
  /** Every onset (any instrument) in beats — used by the chart sync checker. */
  onsetBeats: number[];
}

/** Cheap structural analysis (no audio) used by visuals and tooling. */
export function analyzeComposition(comp: Composition): CompositionAnalysis {
  const sections: SectionTiming[] = [];
  const kickBeats: number[] = [];
  const snareBeats: number[] = [];
  const onsets = new Set<number>();
  let beat = 0;
  for (const s of comp.sections) {
    sections.push({ name: s.name, startBeat: beat, bars: s.bars, energy: s.energy });
    const steps = s.bars * 16;
    const chordAt = chordLookup(s);
    const addDrum = (pattern: string | undefined, sink?: number[]) => {
      if (!pattern) return;
      const d = drumSteps(pattern);
      for (let i = 0; i < steps; i++) {
        const c = d[i % d.length];
        if (c === 'x' || c === 'g') {
          const b = beat + i / 4;
          if (c === 'x') sink?.push(b);
          onsets.add(b);
        }
      }
    };
    addDrum(s.kick, kickBeats);
    addDrum(s.snare, snareBeats);
    addDrum(s.clap, snareBeats);
    addDrum(s.hat);
    addDrum(s.openHat);
    if (s.roll) for (const step of rollSteps(steps)) onsets.add(beat + step / 4);
    for (const [pattern, kind] of [
      [s.bass, 'bass'],
      [s.arp, 'arp'],
      [s.lead, 'lead'],
    ] as const) {
      if (!pattern) continue;
      for (const e of expandMelodic(pattern, steps, chordAt, kind)) onsets.add(beat + e.step / 4);
    }
    if (s.pad && s.chords) for (let b = 0; b < s.bars; b++) onsets.add(beat + b * 4);
    if (s.crash || s.impact) onsets.add(beat);
    beat += s.bars * 4;
  }
  kickBeats.sort((a, b) => a - b);
  snareBeats.sort((a, b) => a - b);
  return {
    totalBeats: beat,
    sections,
    kickBeats,
    snareBeats,
    onsetBeats: [...onsets].sort((a, b) => a - b),
  };
}

export function chordLookup(s: SectionDef): (step: number) => number[] {
  const chords = (s.chords ?? []).map(parseChord);
  return (step: number) => (chords.length ? chords[Math.floor(step / 16) % chords.length] : []);
}

/** Snare roll: quarter notes, then eighths, then sixteenths over the section. */
export function rollSteps(totalSteps: number): number[] {
  const out: number[] = [];
  for (let step = 0; step < totalSteps; step++) {
    const progress = step / totalSteps;
    const every = progress < 0.5 ? 4 : progress < 0.75 ? 2 : 1;
    if (step % every === 0) out.push(step);
  }
  return out;
}

export function midiToFreqSafe(midi: number): number {
  return midiToFreq(Math.max(12, Math.min(120, midi)));
}
