import { LANE_COUNT } from '../constants';
import { RAPID_GAP_SECONDS } from '../config/noteTypes';
import type { Chart, ChartParseIssue, ChartParseResult, ChartSection, Note, NoteType } from '../types';

/**
 * BEAT//SHIFT chart format
 * ------------------------
 * A plain-text, measure-based format designed to be edited by hand.
 *
 *   # comment                       everything after '#' is ignored
 *   @bpm 124                        optional; defaults to the song BPM
 *   @offset 0.02                    optional; seconds added to every note
 *   [drop burst]                    section marker + optional flags ("burst" → BURST notes)
 *   $A = 0 . 1 . 2 . 3 .            define a macro (one or more measures split by ';')
 *   $A x4                           play a macro 4 times
 *   0 . . . 1 . . . | x2            a measure, repeated twice ('|' is optional)
 *   - x4                            four empty measures
 *
 * A measure is one 4/4 bar. It holds N whitespace-separated steps spread evenly over the
 * bar: 4 steps = quarters, 8 = eighths, 16 = sixteenths, 12 = eighth-note triplets...
 *
 * Step tokens:
 *   .        rest
 *   2        tap on lane 2 (lanes are 0–3, left to right)
 *   03       lanes 0 and 3 together (DOUBLE)
 *   1~8      HOLD on lane 1 lasting 8 steps of this measure's resolution
 *   1^8      RELEASE: hold, then let go exactly on the tail (the release is judged)
 *   1*8      ROLL: tap lane 1 repeatedly for 8 steps (the number of taps is judged)
 *   0+3~4    tap lane 0 and hold lane 3 for 4 steps
 */

const BEATS_PER_MEASURE = 4;
const EPS = 1e-6;
/** Beats a lane needs after a hold tail before its next note (release + re-press). */
const MIN_GAP_AFTER_HOLD = 0.25;

interface RawNote {
  beat: number;
  lane: number;
  holdBeats: number;
  longKind: LongKind;
  section: number;
  line: number;
}

export interface ParseOptions {
  bpm: number;
  offset?: number;
  laneCount?: number;
}

export function parseChart(text: string, options: ParseOptions): ChartParseResult {
  const errors: ChartParseIssue[] = [];
  const warnings: ChartParseIssue[] = [];
  const laneCount = options.laneCount ?? LANE_COUNT;
  let bpm = options.bpm;
  let offset = options.offset ?? 0;

  const macros = new Map<string, string[]>();
  const raw: RawNote[] = [];
  const sectionDefs: { name: string; startBeat: number; flags: Set<string> }[] = [];
  let measureIndex = 0;

  const currentSection = () => Math.max(0, sectionDefs.length - 1);

  const emitMeasure = (body: string, lineNo: number) => {
    const trimmed = body.trim();
    if (trimmed === '-' || trimmed === '') {
      measureIndex++;
      return;
    }
    const steps = trimmed.split(/\s+/);
    const stepBeats = BEATS_PER_MEASURE / steps.length;
    if (![1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64].includes(steps.length)) {
      warnings.push({ line: lineNo, message: `unusual step count ${steps.length} in measure` });
    }
    steps.forEach((token, stepIndex) => {
      if (token === '.' || token === '-') return;
      const beat = measureIndex * BEATS_PER_MEASURE + stepIndex * stepBeats;
      const parsed = parseStepToken(token);
      if (!parsed) {
        errors.push({ line: lineNo, message: `invalid step token "${token}"` });
        return;
      }
      for (const spec of parsed) {
        if (spec.lane < 0 || spec.lane >= laneCount) {
          errors.push({ line: lineNo, message: `lane ${spec.lane} out of range in "${token}"` });
          continue;
        }
        raw.push({
          beat,
          lane: spec.lane,
          holdBeats: spec.holdSteps * stepBeats,
          longKind: spec.kind,
          section: currentSection(),
          line: lineNo,
        });
      }
    });
    measureIndex++;
  };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) return;

    if (line.startsWith('@')) {
      const [key, value] = line.slice(1).split(/\s+/);
      const num = Number(value);
      if (!Number.isFinite(num)) {
        errors.push({ line: lineNo, message: `invalid directive value "${value}"` });
      } else if (key === 'bpm' && num > 0) {
        bpm = num;
      } else if (key === 'offset') {
        offset = num;
      } else {
        warnings.push({ line: lineNo, message: `unknown directive "@${key}"` });
      }
      return;
    }

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      const [name, ...flags] = sectionMatch[1].trim().split(/\s+/);
      sectionDefs.push({ name, startBeat: measureIndex * BEATS_PER_MEASURE, flags: new Set(flags) });
      return;
    }

    const defMatch = /^\$(\w+)\s*=\s*(.+)$/.exec(line);
    if (defMatch) {
      macros.set(defMatch[1], defMatch[2].split(';').map((m) => m.trim()));
      return;
    }

    // Measure line or macro use, with an optional trailing repeat "x4".
    let body = line;
    let repeat = 1;
    const repeatMatch = /(?:\|\s*)?\bx(\d+)\s*$/.exec(body);
    if (repeatMatch) {
      repeat = Number(repeatMatch[1]);
      body = body.slice(0, repeatMatch.index).trim();
    }
    body = body.replace(/\|\s*$/, '').trim();
    if (repeat < 1 || repeat > 512) {
      errors.push({ line: lineNo, message: `invalid repeat count x${repeat}` });
      return;
    }

    const useMatch = /^\$(\w+)$/.exec(body);
    let measures: string[];
    if (useMatch) {
      const macro = macros.get(useMatch[1]);
      if (!macro) {
        errors.push({ line: lineNo, message: `unknown macro $${useMatch[1]}` });
        return;
      }
      measures = macro;
    } else {
      measures = body.split(';');
    }
    for (let r = 0; r < repeat; r++) {
      for (const m of measures) emitMeasure(m, lineNo);
    }
  });

  if (sectionDefs.length === 0) sectionDefs.push({ name: 'main', startBeat: 0, flags: new Set() });

  const secondsPerBeat = 60 / bpm;
  const toTime = (beat: number) => offset + beat * secondsPerBeat;

  const notes = buildNotes(raw, sectionDefs, toTime, secondsPerBeat, warnings);
  const sections: ChartSection[] = sectionDefs.map((s) => ({
    name: s.name,
    startBeat: s.startBeat,
    startTime: toTime(s.startBeat),
    flags: s.flags,
  }));
  const duration = notes.reduce((max, n) => Math.max(max, n.time + n.duration), 0);

  const chart: Chart = { bpm, offset, duration, notes, sections };
  return { chart, errors, warnings };
}

type LongKind = 'hold' | 'release' | 'roll';
const LONG_SYMBOL: Record<string, LongKind> = { '~': 'hold', '^': 'release', '*': 'roll' };

interface LaneSpec {
  lane: number;
  holdSteps: number;
  kind: LongKind;
}

export function parseStepToken(token: string): LaneSpec[] | null {
  const out: LaneSpec[] = [];
  for (const part of token.split('+')) {
    const m = /^(\d+)(?:([~^*])(\d+(?:\.\d+)?))?$/.exec(part);
    if (!m) return null;
    const lanes = m[1];
    const hold = m[3] ? Number(m[3]) : 0;
    if (m[2] && !(hold > 0)) return null;
    if (hold && lanes.length !== 1) return null; // "12~4" is ambiguous; use "1~4+2~4"
    const kind = LONG_SYMBOL[m[2] ?? '~'];
    for (const ch of lanes) out.push({ lane: Number(ch), holdSteps: hold, kind });
  }
  return out.length ? out : null;
}

function buildNotes(
  raw: RawNote[],
  sections: { flags: Set<string> }[],
  toTime: (beat: number) => number,
  secondsPerBeat: number,
  warnings: ChartParseIssue[],
): Note[] {
  raw.sort((a, b) => a.beat - b.beat || a.lane - b.lane);

  // Drop duplicates / notes starting inside a hold on the same lane.
  const laneBusyUntil: number[] = [];
  const laneHoldEnd: number[] = [];
  const kept: RawNote[] = [];
  for (const n of raw) {
    const busy = laneBusyUntil[n.lane] ?? -Infinity;
    if (n.beat < busy - EPS || kept.some((k) => k.lane === n.lane && Math.abs(k.beat - n.beat) < EPS)) {
      warnings.push({ line: n.line, message: `overlapping note on lane ${n.lane} at beat ${n.beat.toFixed(2)} dropped` });
      continue;
    }
    const holdEnd = laneHoldEnd[n.lane];
    if (holdEnd !== undefined && n.beat - holdEnd < MIN_GAP_AFTER_HOLD - EPS) {
      warnings.push({
        line: n.line,
        message: `note on lane ${n.lane} at beat ${n.beat.toFixed(2)} starts right after a hold tail (needs ${MIN_GAP_AFTER_HOLD} beat gap)`,
      });
    }
    laneBusyUntil[n.lane] = n.beat + Math.max(n.holdBeats, EPS);
    if (n.holdBeats > 0) laneHoldEnd[n.lane] = n.beat + n.holdBeats;
    kept.push(n);
  }

  // Group simultaneous notes into chords.
  const chordOf = new Map<RawNote, number>();
  let chordCounter = 0;
  for (let i = 0; i < kept.length; ) {
    let j = i + 1;
    while (j < kept.length && Math.abs(kept[j].beat - kept[i].beat) < EPS) j++;
    if (j - i > 1) {
      for (let k = i; k < j; k++) chordOf.set(kept[k], chordCounter);
      chordCounter++;
    }
    i = j;
  }

  // Distinct onset times, for the RAPID rule.
  const onsetTimes = [...new Set(kept.map((n) => n.beat))].map(toTime);
  const gapAround = (time: number) => {
    let best = Infinity;
    for (const t of onsetTimes) {
      const d = Math.abs(t - time);
      if (d > EPS && d < best) best = d;
    }
    return best;
  };

  return kept.map((n, id): Note => {
    const time = toTime(n.beat);
    const chordId = chordOf.get(n) ?? null;
    let type: NoteType = 'tap';
    if (n.holdBeats > 0) type = n.longKind;
    else if (chordId !== null) type = 'double';
    else if (sections[n.section]?.flags.has('burst')) type = 'burst';
    else if (gapAround(time) < RAPID_GAP_SECONDS) type = 'rapid';
    return {
      id,
      time,
      lane: n.lane,
      type,
      duration: n.holdBeats * secondsPerBeat,
      beat: n.beat,
      chordId,
      section: n.section,
    };
  });
}
