import type { SongDefinition } from '../types';
import easy from './charts/digital-rain.easy.chart?raw';
import normal from './charts/digital-rain.normal.chart?raw';
import hard from './charts/digital-rain.hard.chart?raw';

const CHORDS = ['D3 A3 D4 F4', 'Bb2 F3 Bb3 D4', 'G2 D3 G3 Bb3', 'A2 E3 A3 C#4'];

/** Syncopated riff: every bar hits steps 0 3 5 7 10 12 14. */
const LEAD_DROP = [
  'D5 - . D5 . F5 . A5 - . G5 . F5 . E5 .',
  'D5 - . D5 . F5 . Bb5 - . A5 . F5 . D5 .',
  'D5 - . D5 . G5 . Bb5 - . A5 . G5 . F5 .',
  'E5 - . E5 . A5 . C#6 - . A5 . E5 . C#5 .',
].join(' ');

const LEAD_BREAK = [
  'A5 - - - - - - - F5 - - - - - - -',
  'F5 - - - - - - - D5 - - - - - - -',
  'G5 - - - - - - - D5 - - - - - - -',
  'E5 - - - - - - - C#5 - - - - - - -',
].join(' ');

const RAIN_ARP = '0 . . 2 . . 1 . 3 . . 2 . . 1 .';
const ARP_16 = '0 2 1 3 2 1 3 2 0 2 1 3 2 1 3 2';
const BREAK_KICK = 'x.....x...x.....';
const DROP_KICK = 'x.....x...x...x.';
const BACKBEAT = '....x.......x...';
const HAT_16 = 'xgxgxgxgxgxgxgxg';
const HAT_8 = 'x.x.x.x.x.x.x.x.';

export const digitalRain: SongDefinition = {
  id: 'digital-rain',
  index: 2,
  title: 'DIGITAL RAIN',
  artist: 'BEAT//SHIFT SOUND LAB',
  genre: 'CYBER BREAKS',
  bpm: 148,
  offset: 0,
  previewBeat: 64,
  theme: {
    background: 'rain',
    laneColors: ['#3dffb0', '#3dc8ff', '#3dc8ff', '#3dffb0'],
    accent: '#3dffb0',
    accent2: '#3dc8ff',
    jacket: 'linear-gradient(170deg, #01140f 0%, #04352a 40%, #0f7a5c 75%, #3dffb0 100%)',
  },
  composition: {
    bpm: 148,
    sound: { kickTune: 1.08, leadDetune: 0.8, leadBrightness: 1.1, reverb: 1, sidechain: 0.5, bassDrive: 1.3 },
    sections: [
      { name: 'intro', bars: 4, energy: 0.25, tone: 0.45, chords: CHORDS, pad: true, arp: RAIN_ARP, hat: HAT_8 },
      {
        name: 'verse', bars: 8, energy: 0.55, tone: 0.75, chords: CHORDS, pad: true,
        kick: BREAK_KICK, snare: BACKBEAT, hat: HAT_16, bass: 'R - . R . . R . . . R . O . R .', arp: RAIN_ARP,
      },
      {
        name: 'build', bars: 4, energy: 0.75, tone: 0.9, chords: CHORDS, pad: true,
        kick: 'x...x...x...x...', hat: HAT_16, roll: true, riser: true, arp: ARP_16,
      },
      {
        name: 'drop', bars: 8, energy: 1, chords: CHORDS, crash: true, impact: true, pad: true,
        kick: DROP_KICK, snare: BACKBEAT, hat: HAT_16, openHat: '..x.......x.....',
        bass: 'R - . R . R R . R - . R . O R .', lead: LEAD_DROP, arp: RAIN_ARP, arpGain: 0.5,
      },
      {
        name: 'break', bars: 4, energy: 0.4, tone: 0.55, chords: CHORDS, pad: true, crash: true,
        hat: HAT_8, lead: LEAD_BREAK, leadGain: 0.75, arp: RAIN_ARP,
      },
      {
        name: 'build2', bars: 2, energy: 0.8, tone: 0.95, chords: ['G2 D3 G3 Bb3', 'A2 E3 A3 C#4'], pad: true,
        kick: 'x...x...x...x...', roll: true, riser: true, hat: HAT_16, arp: ARP_16,
      },
      {
        name: 'drop2', bars: 12, energy: 1, chords: CHORDS, crash: true, impact: true, pad: true,
        kick: DROP_KICK, snare: BACKBEAT, hat: HAT_16, openHat: '..x.......x.....',
        bass: 'R - . R . R R . R - . R . O R .', lead: LEAD_DROP, arp: ARP_16, arpGain: 0.45,
      },
      { name: 'outro', bars: 4, energy: 0.3, tone: 0.5, chords: CHORDS, pad: true, crash: true, arp: RAIN_ARP, hat: HAT_8 },
    ],
  },
  difficulties: {
    easy: { level: 3, chart: easy },
    normal: { level: 6, chart: normal },
    hard: { level: 9, chart: hard },
  },
};
