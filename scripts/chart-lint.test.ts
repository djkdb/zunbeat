import { it } from 'vitest';
import { SONGS, availableDifficulties, loadChart } from '../src/game/songs/index';

/** Prints every chart warning/error with its line number (npm run lint:charts). */
it('chart lint report', () => {
  for (const song of SONGS) {
    for (const d of availableDifficulties(song)) {
      const r = loadChart(song, d)!;
      for (const w of [...r.errors, ...r.warnings]) console.log(`${song.id}.${d}.chart:${w.line}  ${w.message}`);
    }
  }
});
