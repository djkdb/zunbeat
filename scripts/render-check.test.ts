import { it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderComposition } from '../src/game/audio/synth/renderSong';
import { SONGS, loadChart } from '../src/game/songs/index';

it('render to wav', () => {
  mkdirSync('scripts/.out', { recursive: true });
  for (const song of SONGS) {
    const t0 = performance.now();
    const a = renderComposition(song.composition, 44100);
    console.log(song.id, 'render ms', (performance.now() - t0).toFixed(0), 'len', (a.left.length / 44100).toFixed(1));
    const n = a.left.length;
    const buf = Buffer.alloc(44 + n * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(44100, 24);
    buf.writeUInt32LE(44100 * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) {
      buf.writeInt16LE(Math.round(a.left[i] * 32767), 44 + i * 4);
      buf.writeInt16LE(Math.round(a.right[i] * 32767), 46 + i * 4);
    }
    writeFileSync(`scripts/.out/${song.id}.wav`, buf);
    // loudness per section
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const c = loadChart(song, d);
      if (c) console.log(d, 'notes', c.chart.notes.length, 'nps', (c.chart.notes.length / c.chart.duration).toFixed(2),
        Object.entries(c.chart.notes.reduce<Record<string, number>>((m, x) => ((m[x.type] = (m[x.type] ?? 0) + 1), m), {})).join(' '));
    }
    let sum = 0; for (let i = 0; i < n; i++) sum += a.left[i] ** 2;
    console.log('rms', Math.sqrt(sum / n).toFixed(3));
  }
}, 120000);
