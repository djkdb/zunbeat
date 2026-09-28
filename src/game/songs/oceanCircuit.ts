import type { SongDefinition } from '../types';
import easy from './charts/ocean-circuit.easy.chart?raw';
import normal from './charts/ocean-circuit.normal.chart?raw';
import hard from './charts/ocean-circuit.hard.chart?raw';
import { BACKBEAT, FOUR, HAT_16, HAT_8, HAT_OFF, bars } from './patterns';

const CHORDS = ['B2 F#3 B3 D4', 'G2 D3 G3 B3', 'D3 A3 D4 F#4', 'A2 E3 A3 C#4'];

const LEAD = bars(
  'F#5 - - . B5 - - . A5 - . F#5 - . E5 .',
  'D5 - - . G5 - - . F#5 - . D5 - . B4 .',
  'F#5 - - . A5 - - . D6 - . C#6 - . A5 .',
  'E5 - - . A5 - - . C#6 - - - B5 . A5 .',
);
const LEAD_BREAK = bars(
  'B5 - - - - - - - F#5 - - - - - - -',
  'D6 - - - - - - - B5 - - - - - - -',
  'A5 - - - - - - - F#5 - - - - - - -',
  'C#6 - - - - - - - E5 - - - - - - -',
);
const ROLLING = '0 2 1 3 0 2 1 3 0 2 1 3 0 2 1 3';
const ARP = '0 . 2 . 1 . 3 . 0 . 2 . 1 . 3 .';
const BASS = 'R . . R . . R . R . . R . . O .';

export const oceanCircuit: SongDefinition = {
  id: 'ocean-circuit',
  index: 6,
  title: 'OCEAN CIRCUIT',
  artist: 'BEAT//SHIFT SOUND LAB',
  genre: 'PROGRESSIVE HOUSE',
  bpm: 128,
  offset: 0,
  previewBeat: 64,
  theme: {
    background: 'waves',
    laneColors: ['#3dfcff', '#3d8bff', '#3d8bff', '#3dfcff'],
    accent: '#3dfcff',
    accent2: '#3d8bff',
    jacket: 'linear-gradient(180deg, #010b16 0%, #0a4a6e 55%, #3d8bff 80%, #3dfcff 100%)',
    sky: ['#010b16', '#032540', '#0a4a6e'],
  },
  composition: {
    bpm: 128,
    sound: { leadBrightness: 0.85, leadDetune: 0.9, reverb: 1.35, sidechain: 0.55 },
    sections: [
      { name: 'intro', bars: 4, energy: 0.25, tone: 0.4, chords: CHORDS, pad: true, arp: ROLLING, arpGain: 0.7 },
      {
        name: 'verse', bars: 8, energy: 0.55, tone: 0.7, chords: CHORDS, pad: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_OFF, bass: BASS, arp: ROLLING, arpGain: 0.8,
      },
      { name: 'build', bars: 4, energy: 0.75, tone: 0.85, chords: CHORDS, pad: true, kick: FOUR, hat: HAT_16, roll: true, riser: true, arp: ROLLING },
      {
        name: 'drop', bars: 8, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, openHat: HAT_OFF, bass: BASS, lead: LEAD, arp: ARP, arpGain: 0.5,
      },
      { name: 'break', bars: 4, energy: 0.4, tone: 0.55, chords: CHORDS, pad: true, crash: true, hat: HAT_8, lead: LEAD_BREAK, leadGain: 0.8, arp: ROLLING, arpGain: 0.5 },
      { name: 'build2', bars: 2, energy: 0.8, tone: 0.9, chords: ['D3 A3 D4 F#4', 'A2 E3 A3 C#4'], pad: true, kick: FOUR, roll: true, riser: true, hat: HAT_16, arp: ROLLING },
      {
        name: 'drop2', bars: 8, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, openHat: HAT_OFF, bass: BASS, lead: LEAD, arp: ROLLING, arpGain: 0.45,
      },
      { name: 'outro', bars: 4, energy: 0.3, tone: 0.45, chords: CHORDS, pad: true, crash: true, arp: ROLLING, arpGain: 0.6 },
    ],
  },
  difficulties: {
    easy: { level: 3, chart: easy },
    normal: { level: 5, chart: normal },
    hard: { level: 9, chart: hard },
  },
};
