import { describe, expect, it } from 'vitest';
import { renderComposition } from '../audio/synth/renderSong';
import { SONGS, availableDifficulties, loadChart, songAnalysis } from './index';

describe.each(SONGS.map((s) => [s.id, s] as const))('song %s', (_id, song) => {
  const analysis = songAnalysis(song);

  it('composition BPM matches the song BPM', () => {
    expect(song.composition.bpm).toBe(song.bpm);
  });

  for (const diff of availableDifficulties(song)) {
    describe(diff, () => {
      const result = loadChart(song, diff)!;

      it('parses without errors or warnings', () => {
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.chart.notes.length).toBeGreaterThan(40);
      });

      it('chart sections line up with the composition sections', () => {
        const chartSections = result.chart.sections.map((s) => [s.name, s.startBeat]);
        const musicSections = analysis.sections.map((s) => [s.name, s.startBeat]);
        expect(chartSections).toEqual(musicSections);
      });

      it('every note lands on a musical onset (sync check)', () => {
        const onsets = new Set(analysis.onsetBeats.map((b) => Math.round(b * 1000)));
        const offGrid = result.chart.notes.filter((n) => !onsets.has(Math.round(n.beat * 1000)));
        expect(offGrid.map((n) => `beat ${n.beat} lane ${n.lane}`)).toEqual([]);
      });

      it('fits inside the song', () => {
        const last = result.chart.notes.at(-1)!;
        expect(last.beat).toBeLessThan(analysis.totalBeats);
        expect(result.chart.duration).toBeLessThanOrEqual((analysis.totalBeats * 60) / song.bpm + 0.001);
      });
    });
  }

  it('difficulty increases density', () => {
    const counts = availableDifficulties(song).map((d) => loadChart(song, d)!.chart.notes.length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
  });

  it('renders audio deterministically and without NaNs', () => {
    const t0 = performance.now();
    const audio = renderComposition(song.composition, 22050);
    const ms = performance.now() - t0;
    let peak = 0;
    let nan = 0;
    for (let i = 0; i < audio.left.length; i += 7) {
      const v = audio.left[i];
      if (Number.isNaN(v)) nan++;
      peak = Math.max(peak, Math.abs(v));
    }
    expect(nan).toBe(0);
    expect(peak).toBeGreaterThan(0.3);
    expect(peak).toBeLessThanOrEqual(1);
    console.info(`${song.id}: rendered ${(audio.left.length / audio.sampleRate).toFixed(1)}s @22.05k in ${ms.toFixed(0)}ms`);
  }, 60_000);
});
