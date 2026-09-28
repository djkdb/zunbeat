import { describe, expect, it } from 'vitest';
import { parseChart, parseStepToken } from './chartParser';

const BPM = 120; // 0.5 s per beat

describe('parseStepToken', () => {
  it('parses taps, chords and holds', () => {
    expect(parseStepToken('2')).toEqual([{ lane: 2, holdSteps: 0 }]);
    expect(parseStepToken('03')).toEqual([
      { lane: 0, holdSteps: 0 },
      { lane: 3, holdSteps: 0 },
    ]);
    expect(parseStepToken('1~8')).toEqual([{ lane: 1, holdSteps: 8 }]);
    expect(parseStepToken('0+3~4')).toEqual([
      { lane: 0, holdSteps: 0 },
      { lane: 3, holdSteps: 4 },
    ]);
  });
  it('rejects garbage and ambiguous holds', () => {
    expect(parseStepToken('x')).toBeNull();
    expect(parseStepToken('12~4')).toBeNull();
    expect(parseStepToken('~4')).toBeNull();
  });
});

describe('parseChart', () => {
  it('converts measures into timed notes', () => {
    const { chart, errors } = parseChart('0 1 2 3', { bpm: BPM });
    expect(errors).toEqual([]);
    expect(chart.notes.map((n) => [n.time, n.lane])).toEqual([
      [0, 0],
      [0.5, 1],
      [1, 2],
      [1.5, 3],
    ]);
  });

  it('supports resolution per measure, repeats, rests, macros and offset', () => {
    const text = `
      @offset 0.1
      $m = 0 . . . 1 . . .
      - x1
      $m x2
      2 . . . . . . . . . . . . . . . | x2
    `;
    const { chart, errors } = parseChart(text, { bpm: BPM });
    expect(errors).toEqual([]);
    expect(chart.notes.map((n) => n.beat)).toEqual([4, 6, 8, 10, 12, 16]);
    expect(chart.notes[0].time).toBeCloseTo(0.1 + 4 * 0.5);
  });

  it('classifies DOUBLE, HOLD, RAPID and BURST notes', () => {
    const text = `
      [a]
      03 . . . 1~2 . . .
      [b burst]
      0 . . . . . . .
      [c]
      0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3
    `;
    const { chart, errors } = parseChart(text, { bpm: 150 });
    expect(errors).toEqual([]);
    const types = chart.notes.map((n) => n.type);
    expect(types.slice(0, 3)).toEqual(['double', 'double', 'hold']);
    expect(chart.notes[2].duration).toBeCloseTo(1 * (60 / 150));
    expect(types[3]).toBe('burst');
    expect(types.slice(4).every((t) => t === 'rapid')).toBe(true);
    expect(chart.notes[0].chordId).toBe(chart.notes[1].chordId);
    expect(chart.sections.map((s) => [s.name, s.startBeat])).toEqual([
      ['a', 0],
      ['b', 4],
      ['c', 8],
    ]);
  });

  it('reports malformed input without throwing', () => {
    const { chart, errors } = parseChart('0 1 q 3\n$nope x2\n9 . . .\n@bpm abc', { bpm: BPM });
    expect(chart.notes.length).toBe(3);
    expect(errors.map((e) => e.line)).toEqual([1, 2, 3, 4]);
  });

  it('drops overlapping notes and warns about hold tails colliding with the next note', () => {
    const { chart, warnings } = parseChart('0~8 . 0 . . . . .\n0 . . .', { bpm: BPM });
    expect(chart.notes.length).toBe(2);
    expect(warnings.length).toBe(2);
  });
});
