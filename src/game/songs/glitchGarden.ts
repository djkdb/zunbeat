import type { SongDefinition } from '../types';
import easy from './charts/glitch-garden.easy.chart?raw';
import normal from './charts/glitch-garden.normal.chart?raw';
import hard from './charts/glitch-garden.hard.chart?raw';
import { BACKBEAT, FOUR, HAT_16, HAT_8, bars } from './patterns';

const CHORDS = ['G2 D3 G3 Bb3', 'Eb3 Bb3 Eb4 G4', 'C3 G3 C4 Eb4', 'D3 A3 D4 F#4'];

const LEAD = bars(
  'G5 Bb5 D6 Bb5 G5 . D5 . G5 Bb5 D6 G6 . . F6 .',
  'G5 Bb5 Eb6 Bb5 G5 . Eb5 . G5 Bb5 Eb6 G6 . . F6 .',
  'G5 C6 Eb6 C6 G5 . Eb5 . G5 C6 Eb6 G6 . . F6 .',
  'F#5 A5 D6 A5 F#5 . D5 . F#5 A5 D6 F#6 - - - .',
);
const LEAD_BREAK = bars(
  'D6 - - - - - - - Bb5 - - - - - - -',
  'Eb6 - - - - - - - G5 - - - - - - -',
  'C6 - - - - - - - G5 - - - - - - -',
  'A5 - - - - - - - F#5 - - - - - - -',
);
const ARP = '0 . 1 . 2 . 3 . 2 . 1 . 0 . 1 .';
const ARP_16 = '0 2 1 3 2 0 3 1 0 2 1 3 2 0 3 1';
const BREAK_KICK = 'x.....x.x.......';
const GLITCH_SNARE = '....x..g....x...';
const GLITCH_HAT = 'xgx.xgxgx.xgxgxg';
const BASS = 'R . . R . . O . R . . R . O . .';

export const glitchGarden: SongDefinition = {
  id: 'glitch-garden',
  index: 7,
  title: 'GLITCH GARDEN',
  artist: 'BEAT//SHIFT SOUND LAB',
  genre: 'CHIPTUNE BREAKS',
  bpm: 140,
  offset: 0,
  previewBeat: 64,
  theme: {
    background: 'rain',
    laneColors: ['#c86bff', '#6bffb8', '#6bffb8', '#c86bff'],
    accent: '#c86bff',
    accent2: '#6bffb8',
    jacket: 'linear-gradient(135deg, #0b0314 0%, #3a0f5c 45%, #c86bff 75%, #6bffb8 100%)',
    sky: ['#0b0314', '#1d0633', '#3a0f5c'],
  },
  composition: {
    bpm: 140,
    sound: { leadWave: 'pulse', kickTune: 1.1, hatLevel: 1.2, sidechain: 0.4, reverb: 0.8, bassDrive: 1.3 },
    sections: [
      { name: 'intro', bars: 4, energy: 0.3, tone: 0.5, chords: CHORDS, pad: true, arp: ARP, hat: HAT_8 },
      {
        name: 'verse', bars: 8, energy: 0.6, tone: 0.75, chords: CHORDS, pad: true,
        kick: BREAK_KICK, snare: GLITCH_SNARE, hat: GLITCH_HAT, bass: BASS, arp: ARP,
      },
      { name: 'build', bars: 4, energy: 0.8, tone: 0.9, chords: CHORDS, pad: true, kick: FOUR, hat: HAT_16, roll: true, riser: true, arp: ARP_16 },
      {
        name: 'drop', bars: 8, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: BREAK_KICK, snare: GLITCH_SNARE, clap: BACKBEAT, hat: GLITCH_HAT, bass: BASS, lead: LEAD, arp: ARP, arpGain: 0.4,
      },
      { name: 'break', bars: 4, energy: 0.4, tone: 0.55, chords: CHORDS, pad: true, crash: true, hat: HAT_8, lead: LEAD_BREAK, leadGain: 0.75, arp: ARP },
      { name: 'build2', bars: 2, energy: 0.85, tone: 0.95, chords: ['C3 G3 C4 Eb4', 'D3 A3 D4 F#4'], pad: true, kick: FOUR, roll: true, riser: true, hat: HAT_16, arp: ARP_16 },
      {
        name: 'drop2', bars: 8, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: BREAK_KICK, snare: GLITCH_SNARE, clap: BACKBEAT, hat: HAT_16, bass: BASS, lead: LEAD, arp: ARP_16, arpGain: 0.4,
      },
      { name: 'outro', bars: 4, energy: 0.3, tone: 0.5, chords: CHORDS, pad: true, crash: true, arp: ARP, hat: HAT_8 },
    ],
  },
  difficulties: {
    easy: { level: 3, chart: easy },
    normal: { level: 6, chart: normal },
    hard: { level: 10, chart: hard },
  },
};
