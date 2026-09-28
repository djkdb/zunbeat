import { describe, expect, it } from 'vitest';
import { parseChart } from '../chart/chartParser';
import { feverFillSize } from '../config/fever';
import { JUDGMENT_WINDOWS, judgeOffset } from '../config/judgment';
import { computeRank } from '../config/rank';
import { computeAccuracy, comboMultiplier } from '../config/scoring';
import { SONGS, availableDifficulties, loadChart } from '../songs';
import { JudgmentSystem, NS } from './JudgmentSystem';
import { ScoreSystem, theoreticalMaxScore, totalJudgmentsFor } from './ScoreSystem';

const chart = (text: string) => parseChart(text, { bpm: 120 }).chart.notes;

describe('judgment windows', () => {
  it('maps offsets to judgments symmetrically', () => {
    expect(judgeOffset(0)).toBe('perfect');
    expect(judgeOffset(-JUDGMENT_WINDOWS.perfect)).toBe('perfect');
    expect(judgeOffset(JUDGMENT_WINDOWS.perfect + 0.001)).toBe('great');
    expect(judgeOffset(-JUDGMENT_WINDOWS.great - 0.001)).toBe('good');
    expect(judgeOffset(JUDGMENT_WINDOWS.good + 0.001)).toBe('miss');
    expect(judgeOffset(JUDGMENT_WINDOWS.miss + 0.001)).toBeNull();
  });
});

describe('JudgmentSystem', () => {
  it('ignores presses that are far too early and hits the nearest note', () => {
    const j = new JudgmentSystem(chart('0 . 0 .'));
    expect(j.press(0, -0.5)).toBeNull();
    const hit = j.press(0, 0.02);
    expect(hit && hit !== 'regrab' && hit.judgment).toBe('perfect');
    const second = j.press(0, 1.0 - 0.07);
    expect(second && second !== 'regrab' && second.judgment).toBe('great');
  });

  it('auto-misses notes that pass the window', () => {
    const j = new JudgmentSystem(chart('0 1 . .'));
    const events = j.update(0.6 + JUDGMENT_WINDOWS.miss + 0.01, () => false);
    expect(events.map((e) => e.judgment)).toEqual(['miss', 'miss']);
    expect(j.allResolved).toBe(true);
  });

  it('completes a hold kept down to the tail', () => {
    const j = new JudgmentSystem(chart('0~2 . . .')); // 1 s hold
    const head = j.press(0, 0);
    expect(head && head !== 'regrab' && head.kind).toBe('head');
    expect(j.state[0]).toBe(NS.holding);
    const events = j.update(1.01, () => true);
    expect(events.map((e) => [e.kind, e.judgment])).toEqual([['tail', 'perfect']]);
    expect(j.state[0]).toBe(NS.done);
  });

  it('breaks a hold released early (after the regrab grace)', () => {
    const j = new JudgmentSystem(chart('0~2 . . .'));
    j.press(0, 0);
    expect(j.release(0, 0.3)).toBeNull();
    expect(j.update(0.32, () => false)).toEqual([]); // still inside grace
    const events = j.update(0.5, () => false);
    expect(events.map((e) => [e.kind, e.judgment])).toEqual([['tail', 'miss']]);
    expect(j.state[0]).toBe(NS.broken);
  });

  it('lets a quick re-press rescue a hold', () => {
    const j = new JudgmentSystem(chart('0~2 . . .'));
    j.press(0, 0);
    j.release(0, 0.3);
    expect(j.press(0, 0.33)).toBe('regrab');
    expect(j.update(1.01, () => true).map((e) => e.judgment)).toEqual(['perfect']);
  });

  it('accepts an early release close to the tail', () => {
    const j = new JudgmentSystem(chart('0~2 . . .'));
    j.press(0, 0);
    const tail = j.release(0, 0.95);
    expect(tail?.judgment).toBe('perfect');
  });
});

describe('ScoreSystem', () => {
  it('tracks combo, accuracy and resets combo on miss', () => {
    const s = new ScoreSystem(4, 0.5);
    s.apply('perfect', 'tap', 0);
    s.apply('great', 'tap', 1);
    expect(s.combo).toBe(2);
    const out = s.apply('miss', 'tap', 2);
    expect(out.comboBroken).toBe(true);
    expect(s.combo).toBe(0);
    expect(s.maxCombo).toBe(2);
    expect(s.accuracy).toBeCloseTo(computeAccuracy({ perfect: 1, great: 1, good: 0, miss: 1 }));
  });

  it('reports combo milestones', () => {
    const s = new ScoreSystem(100, 0.5);
    const milestones: number[] = [];
    for (let i = 0; i < 60; i++) {
      const m = s.apply('perfect', 'tap', i).milestone;
      if (m) milestones.push(m);
    }
    expect(milestones).toEqual([25, 50]);
  });

  it('starts FEVER when the gauge fills and ends it after its duration', () => {
    const s = new ScoreSystem(100, 0.5);
    let startedAt = -1;
    for (let i = 0; i < 100 && startedAt < 0; i++) if (s.apply('perfect', 'tap', i * 0.1).feverStarted) startedAt = i;
    expect(startedAt).toBeGreaterThan(10);
    expect(s.feverActive).toBe(true);
    expect(s.update(s.feverEndsAt + 0.01)).toBe(true);
    expect(s.feverActive).toBe(false);
  });

  it('awards more for combo tiers', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(100)).toBeGreaterThan(comboMultiplier(50));
  });

  it('a flawless run of a real chart reaches exactly the theoretical max', () => {
    const song = SONGS[0];
    const notes = loadChart(song, 'normal')!.chart.notes;
    const max = theoreticalMaxScore(notes, 60 / song.bpm);
    expect(max).toBeGreaterThan(1_000_000);
    expect(totalJudgmentsFor(notes)).toBe(notes.length + notes.filter((n) => n.duration > 0).length);
  });
});

describe('rank', () => {
  it('requires a full combo for S+', () => {
    expect(computeRank(99.5, 1, true)).toBe('S+');
    expect(computeRank(99.5, 1, false)).toBe('S');
    expect(computeRank(92, 0.85, false)).toBe('A');
    expect(computeRank(90, 0.8, false)).toBe('B');
    expect(computeRank(40, 0.3, false)).toBe('D');
  });
});

describe('FEVER placement in real charts', () => {
  for (const song of SONGS) {
    for (const d of availableDifficulties(song)) {
      it(`${song.id}/${d}: first FEVER starts in a high-energy section`, () => {
        const { chart } = loadChart(song, d)!;
        const spb = 60 / song.bpm;
        const s = new ScoreSystem(totalJudgmentsFor(chart.notes), spb, feverFillSize(chart));
        let at: number | null = null;
        for (const n of chart.notes) {
          s.update(n.time);
          if (s.apply('perfect', n.type, n.time).feverStarted) {
            at = n.beat;
            break;
          }
        }
        expect(at).not.toBeNull();
        const section = [...chart.sections].reverse().find((sec) => sec.startBeat <= (at ?? 0));
        expect(section?.name).toBe('drop');
        expect((at ?? 0) - section!.startBeat).toBeLessThan(8);
      });
    }
  }
});
