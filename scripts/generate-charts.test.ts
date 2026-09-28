import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { generateChart, type GenDifficulty } from '../src/game/chart/chartGenerator';
import { parseChart } from '../src/game/chart/chartParser';
import { difficultyMeta } from '../src/game/config/difficulty';
import { SONGS } from '../src/game/songs/index';

/**
 * `npm run generate:charts` — (re)writes every chart file that still carries the
 * `# @generated` marker. Delete that line after hand-editing a chart and the generator
 * will leave it alone.
 */
it('generate charts', () => {
  for (const song of SONGS) {
    for (const d of ['easy', 'normal', 'hard'] as GenDifficulty[]) {
      const path = `src/game/songs/charts/${song.id}.${d}.chart`;
      let current = '';
      try {
        current = readFileSync(path, 'utf8');
      } catch {
        /* missing → generate */
      }
      if (current && !current.includes('# @generated')) continue;
      const body = generateChart(song.composition, { difficulty: d, seed: song.index });
      const header = [
        `# ${song.title} — ${difficultyMeta(d).label}`,
        `# ${song.bpm} BPM · generated from the composition by \`npm run generate:charts\`.`,
        '# Safe to edit by hand: delete the @generated line below and the generator will keep your edits.',
        '# @generated',
      ].join('\n');
      const text = `${header}\n${body}`;
      const { chart, errors, warnings } = parseChart(text, { bpm: song.bpm });
      writeFileSync(path, text);
      const nps = chart.notes.length / Math.max(1, chart.duration);
      console.log(
        `${song.id}.${d}: ${chart.notes.length} notes, ${nps.toFixed(2)} nps, holds ${chart.notes.filter((n) => n.duration > 0).length}, ` +
          `errors ${errors.length}, warnings ${warnings.length}`,
      );
    }
  }
});
