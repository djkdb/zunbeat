import { mulberry32, type Rng } from '../audio/synth/dsp';
import { chordLookup, drumSteps, expandMelodic, rollSteps, type Composition, type SectionDef } from '../audio/synth/music';
import { LANE_COUNT } from '../constants';

/**
 * Chart generator
 * ---------------
 * Derives a playable chart from a song's composition, so every note sits on a real
 * musical event (lead melody, kick, snare, arpeggio, roll). The result is written in
 * the regular text chart format and is meant to be hand-edited afterwards.
 *
 * Per difficulty it controls: which events are candidates, the grid they may use,
 * minimum spacing, notes per bar (scaled by BPM and section energy), holds on long
 * melody notes, and doubles on accented kicks/snares. Lanes follow the melody's pitch
 * contour; other notes walk lane patterns while avoiding fast same-lane repeats.
 */

export type GenDifficulty = 'easy' | 'normal' | 'hard';

export interface GenerateOptions {
  difficulty: GenDifficulty;
  seed?: number;
}

interface StepInfo {
  kick: boolean;
  snare: boolean;
  hat: boolean;
  roll: boolean;
  lead: { midi: number; len: number } | null;
  arp: number | null;
  /** Length in steps of a bass note starting here (0 = none). */
  bass: number;
}

type PickKind = 'tap' | 'hold' | 'release' | 'roll';
const KIND_SYMBOL: Record<Exclude<PickKind, 'tap'>, string> = { hold: '~', release: '^', roll: '*' };

interface Picked {
  step: number;
  lanes: number[];
  hold: number; // length in steps (0 = tap), applies to lanes[0]
  kind: PickKind;
  midi: number | null;
}

/** Every Nth hold becomes a RELEASE (0 = never). */
const RELEASE_EVERY: Record<GenDifficulty, number> = { easy: 4, normal: 3, hard: 2 };
/** Long "pad holds" on calm, lead-less bars, in steps. */
const PAD_HOLD: Record<GenDifficulty, number> = { easy: 12, normal: 8, hard: 8 };

interface Profile {
  /** Allowed grid (step % grid === 0). */
  grid: number;
  minGap: number;
  jackLimit: number;
  maxPerBar: number;
  threshold: number;
  holdMin: number;
  /** Other notes may overlap a hold. */
  holdOverlap: boolean;
}

const STEPS_PER_BAR = 16;

function profileFor(d: GenDifficulty, bpm: number, s: SectionDef, burstBar: boolean): Profile {
  const e = s.energy;
  const hasDrums = Boolean(s.kick || s.snare || s.clap);
  const tempo = Math.min(1.15, Math.max(0.7, 150 / bpm));
  if (d === 'easy') {
    const slow = bpm > 135 || e < 0.45;
    return {
      grid: 4,
      minGap: slow ? 8 : 4,
      jackLimit: 16,
      maxPerBar: e >= 0.7 ? 4 : 2,
      threshold: hasDrums ? 2 : 0.9,
      holdMin: 4,
      holdOverlap: false,
    };
  }
  if (d === 'normal') {
    return {
      grid: 2,
      minGap: bpm <= 150 ? 2 : bpm <= 165 ? 3 : 4,
      jackLimit: 4,
      maxPerBar: Math.round((e >= 0.9 ? 8 : e >= 0.6 ? 6 : 4) * tempo),
      threshold: e >= 0.6 ? 1.9 : 1.4,
      holdMin: 3,
      holdOverlap: false,
    };
  }
  return {
    grid: 1,
    minGap: burstBar ? 1 : bpm > 165 ? 2 : 1,
    jackLimit: 3,
    maxPerBar: burstBar ? 16 : Math.round((e >= 0.9 ? 11 : e >= 0.6 ? 9 : 6) * tempo),
    threshold: burstBar ? 0.25 : e >= 0.6 ? 0.9 : 1.4,
    holdMin: 3,
    holdOverlap: true,
  };
}

function analyzeSection(s: SectionDef): StepInfo[] {
  const steps = s.bars * STEPS_PER_BAR;
  const hit = (pattern: string | undefined) => {
    const out = new Array<boolean>(steps).fill(false);
    if (!pattern) return out;
    const d = drumSteps(pattern);
    for (let i = 0; i < steps; i++) out[i] = d[i % d.length] === 'x';
    return out;
  };
  const kick = hit(s.kick);
  const snare = hit(s.snare);
  const clap = hit(s.clap);
  const hat = hit(s.hat);
  const openHat = hit(s.openHat);
  const ghostHat = s.hat ? drumSteps(s.hat) : [];
  const roll = new Set(s.roll ? rollSteps(steps) : []);
  const chordAt = chordLookup(s);
  const lead = new Map(s.lead ? expandMelodic(s.lead, steps, chordAt, 'lead').map((e) => [e.step, e]) : []);
  const arp = new Map(s.arp ? expandMelodic(s.arp, steps, chordAt, 'arp').map((e) => [e.step, e.midi]) : []);
  const bass = new Map(s.bass ? expandMelodic(s.bass, steps, chordAt, 'bass').map((e) => [e.step, e.lengthSteps]) : []);
  return Array.from({ length: steps }, (_, i) => {
    const l = lead.get(i);
    return {
      kick: kick[i],
      snare: snare[i] || clap[i],
      hat: hat[i] || openHat[i] || ghostHat[i % Math.max(1, ghostHat.length)] === 'g',
      roll: roll.has(i),
      lead: l ? { midi: l.midi, len: l.lengthSteps } : null,
      arp: arp.get(i) ?? null,
      bass: bass.get(i) ?? 0,
    };
  });
}

function score(info: StepInfo, d: GenDifficulty, step: number): number {
  let v = 0;
  if (info.lead) v += 3 + (info.lead.len >= 4 ? 1 : 0);
  if (info.kick) v += d === 'easy' ? 3 : 2;
  if (info.snare) v += 2;
  if (info.arp !== null) v += 1;
  if (info.bass) v += 0.75;
  if (info.roll && d !== 'easy') v += 1.5;
  if (info.hat) v += 0.3;
  if (v === 0) return 0;
  // Prefer strong beats when scores tie.
  if (step % 4 === 0) v += 0.3;
  else if (step % 2 === 0) v += 0.15;
  return v;
}

const LANE_PATTERNS = [
  [0, 1, 2, 3],
  [3, 2, 1, 0],
  [0, 2, 1, 3],
  [3, 1, 2, 0],
  [1, 3, 0, 2],
  [2, 0, 3, 1],
];

export function generateChart(comp: Composition, options: GenerateOptions): string {
  const d = options.difficulty;
  const rng: Rng = mulberry32((options.seed ?? 7) * 31 + ['easy', 'normal', 'hard'].indexOf(d));
  const lines: string[] = [];
  let firstDropSeen = false;
  let globalStep = 0;
  let prevLane = -1;
  let prevLaneStep = -Infinity;
  let prevMidi: number | null = null;
  const laneLastStep = new Array<number>(LANE_COUNT).fill(-Infinity);
  const laneBusyUntil = new Array<number>(LANE_COUNT).fill(-Infinity);
  let patternPos = 0;
  let holdCount = 0;

  for (const s of comp.sections) {
    const isDrop = s.name.startsWith('drop');
    const burstSection = isDrop && firstDropSeen && d !== 'easy';
    if (isDrop) firstDropSeen = true;
    lines.push('', `[${s.name}${burstSection ? ' burst' : ''}]`);

    const info = analyzeSection(s);
    const leadMidis = info.filter((x) => x.lead).map((x) => x.lead!.midi);
    const lo = leadMidis.length ? Math.min(...leadMidis) : 0;
    const hi = leadMidis.length ? Math.max(...leadMidis) : 0;

    const picked: Picked[] = [];
    for (let bar = 0; bar < s.bars; bar++) {
      const burstBar = burstSection && d === 'hard' && bar % 4 < 2;
      const prof = profileFor(d, comp.bpm, s, burstBar);
      const candidates: { step: number; score: number }[] = [];
      for (let k = 0; k < STEPS_PER_BAR; k++) {
        const step = bar * STEPS_PER_BAR + k;
        if (globalStep + step < STEPS_PER_BAR) continue; // keep bar 1 clear for the countdown
        if (k % prof.grid !== 0) continue;
        const sc = score(info[step], d, k);
        if (sc >= prof.threshold) candidates.push({ step, score: sc + rng() * 0.01 });
      }
      candidates.sort((a, b) => b.score - a.score || a.step - b.step);
      const chosen: number[] = [];
      const lastPickedBefore = picked.length ? picked[picked.length - 1].step : -Infinity;
      for (const c of candidates) {
        if (chosen.length >= prof.maxPerBar) break;
        if (c.step - lastPickedBefore < prof.minGap) continue;
        if (chosen.some((x) => Math.abs(x - c.step) < prof.minGap)) continue;
        chosen.push(c.step);
      }
      chosen.sort((a, b) => a - b);

      let holdEnd = -Infinity;
      const calmPadBar = !s.lead && s.pad && s.energy < 0.55 && bar % 2 === 0;
      for (const step of chosen) {
        if (!prof.holdOverlap && step < holdEnd) continue;
        const inf = info[step];
        let hold = 0;
        if (inf.lead && inf.lead.len >= prof.holdMin) {
          // Long melody notes become holds ("keep it pressed").
          hold = Math.max(2, inf.lead.len - 1);
        } else if (d !== 'easy' && inf.bass >= 3 && step % 4 === 0) {
          // Sustained bass on a beat: hold it.
          hold = Math.max(2, inf.bass - 1);
        } else if (calmPadBar && step % STEPS_PER_BAR === 0) {
          // Calm bars: a long hold on the chord change.
          hold = PAD_HOLD[d];
        }
        let kind: PickKind = hold > 0 ? 'hold' : 'tap';
        if (hold > 0) {
          holdEnd = step + hold + 2;
          holdCount++;
          if (RELEASE_EVERY[d] && holdCount % RELEASE_EVERY[d] === 0) kind = 'release';
        }
        picked.push({ step, lanes: [], hold, kind, midi: inf.lead?.midi ?? null });
      }
    }

    // ---- ROLL on the last bar of every snare-roll build-up
    if (s.roll && s.bars >= 1) {
      const start = (s.bars - 1) * STEPS_PER_BAR;
      const len = d === 'easy' ? 12 : 14;
      for (let i = picked.length - 1; i >= 0; i--) {
        const st = picked[i].step;
        if (st >= start - 2 || st + picked[i].hold + 2 > start) picked.splice(i, 1);
      }
      picked.push({ step: start, lanes: [], hold: len, kind: 'roll', midi: null });
      picked.sort((a, b) => a.step - b.step);
    }

    // ---- lanes
    for (const p of picked) {
      const abs = globalStep + p.step;
      const prof = profileFor(d, comp.bpm, s, false);
      const free = (lane: number) => laneBusyUntil[lane] < abs;
      let lane: number;
      if (p.midi !== null && hi > lo) {
        lane = Math.round(((p.midi - lo) / (hi - lo)) * (LANE_COUNT - 1));
        if (prevMidi !== null && lane === prevLane && abs - prevLaneStep < prof.jackLimit * 4) {
          lane = p.midi >= prevMidi ? lane + 1 : lane - 1;
          if (lane < 0) lane = 1;
          if (lane >= LANE_COUNT) lane = LANE_COUNT - 2;
        }
      } else {
        const pattern = LANE_PATTERNS[Math.floor(abs / STEPS_PER_BAR) % LANE_PATTERNS.length];
        lane = pattern[patternPos++ % pattern.length];
      }
      // Avoid fast same-lane repeats and lanes still held.
      const tooSoon = (l: number) => abs - laneLastStep[l] < prof.jackLimit;
      if (!free(lane) || tooSoon(lane)) {
        const order = [1, -1, 2, -2, 3, -3].map((o) => lane + o).filter((l) => l >= 0 && l < LANE_COUNT);
        const alt = order.find((l) => free(l) && !tooSoon(l)) ?? order.find((l) => free(l));
        if (alt === undefined) continue;
        lane = alt;
      }
      p.lanes = [lane];

      // ---- doubles on accents
      const inf = info[p.step];
      const k = p.step % STEPS_PER_BAR;
      const bar = Math.floor(p.step / STEPS_PER_BAR);
      const accent =
        s.energy >= 0.85 &&
        ((d === 'normal' && inf.kick && p.step % 32 === 0) ||
          (d === 'hard' && ((inf.kick && k === 0) || (isDrop && inf.snare && k === 12 && bar % 2 === 1))));
      if (accent && p.hold === 0) {
        const mirror = LANE_COUNT - 1 - lane;
        const second = [mirror, (lane + 2) % LANE_COUNT].find((l) => l !== lane && free(l));
        if (second !== undefined) p.lanes.push(second);
      }

      for (const l of p.lanes) laneLastStep[l] = abs;
      if (p.hold > 0) laneBusyUntil[lane] = abs + p.hold + 1;
      prevLane = lane;
      prevLaneStep = abs;
      prevMidi = p.midi ?? prevMidi;
    }

    lines.push(...renderBars(picked.filter((p) => p.lanes.length), s.bars));
    globalStep += s.bars * STEPS_PER_BAR;
  }
  return lines.join('\n').trim() + '\n';
}

/** Emit one line per bar at the coarsest resolution that fits, compressing repeats. */
function renderBars(picked: Picked[], bars: number): string[] {
  const out: string[] = [];
  const barLines: string[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const notes = picked.filter((p) => Math.floor(p.step / STEPS_PER_BAR) === bar);
    if (notes.length === 0) {
      barLines.push('-');
      continue;
    }
    const fits = (div: number) => notes.every((n) => (n.step % STEPS_PER_BAR) % div === 0 && n.hold % div === 0);
    const div = fits(4) ? 4 : fits(2) ? 2 : 1;
    const tokens = new Array<string>(STEPS_PER_BAR / div).fill('.');
    for (const n of notes) {
      const idx = (n.step % STEPS_PER_BAR) / div;
      const [first, ...rest] = n.lanes;
      if (n.hold > 0 && n.kind !== 'tap') {
        tokens[idx] = [`${first}${KIND_SYMBOL[n.kind]}${n.hold / div}`, ...rest.map(String)].join('+');
      } else {
        tokens[idx] = [...n.lanes].sort((a, b) => a - b).join('');
      }
    }
    barLines.push(tokens.join(' '));
  }
  for (let i = 0; i < barLines.length; ) {
    let j = i + 1;
    while (j < barLines.length && barLines[j] === barLines[i]) j++;
    const n = j - i;
    out.push(n > 1 ? `${barLines[i]}${barLines[i] === '-' ? '' : ' |'} x${n}` : barLines[i]);
    i = j;
  }
  return out;
}
