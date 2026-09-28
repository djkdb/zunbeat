import type { SongDefinition } from '../types';
import easy from './charts/neon-rush.easy.chart?raw';
import normal from './charts/neon-rush.normal.chart?raw';
import hard from './charts/neon-rush.hard.chart?raw';

const CHORDS = ['E3 B3 E4 G4', 'C3 G3 C4 E4', 'G2 D3 G3 B3', 'D3 A3 D4 F#4'];

const LEAD_DROP = [
  'E5 . G5 . B5 . E6 . D6 . B5 . G5 . B5 .',
  'E5 . G5 . C6 . E6 . D6 . C6 . G5 . C6 .',
  'D5 . G5 . B5 . D6 . B5 . G5 . D6 . B5 .',
  'D5 . F#5 . A5 . D6 . F#6 - - - E6 - D6 -',
].join(' ');

const LEAD_BREAK = [
  'B5 - - - - - - - G5 - - - - - - -',
  'C6 - - - - - - - G5 - - - - - - -',
  'B5 - - - - - - - D6 - - - - - - -',
  'A5 - - - - - - - F#5 - - - - - - -',
].join(' ');

const ARP = '0 1 2 3 1 2 3 1 2 3 1 2 3 2 1 0';
const ARP_8 = '0 . 2 . 3 . 1 . 2 . 3 . 1 . 2 .';
const DNB_KICK = 'x.........x.....';
const DNB_SNARE = '....x.......x...';
const HAT_16 = 'xgxgxgxgxgxgxgxg';
const HAT_8 = 'x.x.x.x.x.x.x.x.';

export const neonRush: SongDefinition = {
  id: 'neon-rush',
  index: 3,
  title: 'NEON RUSH',
  artist: 'BEAT//SHIFT SOUND LAB',
  genre: 'HYPER DNB',
  bpm: 172,
  offset: 0,
  previewBeat: 96,
  theme: {
    background: 'rush',
    laneColors: ['#ffe45c', '#ff3d8b', '#ff3d8b', '#ffe45c'],
    accent: '#ff3d8b',
    accent2: '#ffe45c',
    jacket: 'linear-gradient(135deg, #12001f 0%, #4b0a5e 35%, #ff3d8b 70%, #ffe45c 100%)',
  },
  composition: {
    bpm: 172,
    sound: { kickTune: 1.15, leadDetune: 1.2, leadBrightness: 1.15, reverb: 0.9, sidechain: 0.45, bassDrive: 1.5 },
    sections: [
      { name: 'intro', bars: 8, energy: 0.3, tone: 0.45, chords: CHORDS, pad: true, arp: ARP_8, hat: HAT_8 },
      {
        name: 'verse', bars: 8, energy: 0.6, tone: 0.8, chords: CHORDS, pad: true,
        kick: DNB_KICK, snare: DNB_SNARE, hat: HAT_16, bass: 'R - - . . . R . . . R - . . O .', arp: ARP_8,
      },
      {
        name: 'build', bars: 4, energy: 0.8, tone: 0.9, chords: CHORDS, pad: true,
        kick: 'x...x...x...x...', hat: HAT_16, roll: true, riser: true, arp: ARP,
      },
      {
        name: 'drop', bars: 16, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: DNB_KICK, snare: DNB_SNARE, hat: HAT_16, openHat: '..x...x...x...x.',
        bass: 'R - - . . . R . . . R - . . O .', lead: LEAD_DROP, arp: ARP, arpGain: 0.4,
      },
      {
        name: 'break', bars: 4, energy: 0.45, tone: 0.6, chords: CHORDS, pad: true, crash: true,
        hat: HAT_8, lead: LEAD_BREAK, leadGain: 0.75, arp: ARP_8,
      },
      {
        name: 'build2', bars: 4, energy: 0.85, tone: 0.95, chords: CHORDS, pad: true,
        kick: 'x...x...x...x...', roll: true, riser: true, hat: HAT_16, arp: ARP,
      },
      {
        name: 'drop2', bars: 16, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: DNB_KICK, snare: DNB_SNARE, hat: HAT_16, openHat: '..x...x...x...x.',
        bass: 'R - - . . . R . . . R - . . O .', lead: LEAD_DROP, arp: ARP, arpGain: 0.4,
      },
      { name: 'outro', bars: 4, energy: 0.3, tone: 0.5, chords: CHORDS, pad: true, crash: true, arp: ARP_8, hat: HAT_8 },
    ],
  },
  difficulties: {
    easy: { level: 4, chart: easy },
    normal: { level: 7, chart: normal },
    hard: { level: 11, chart: hard },
  },
};
