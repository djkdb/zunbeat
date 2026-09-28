import type { SongDefinition } from '../types';
import easy from './charts/lofi-moonrise.easy.chart?raw';
import normal from './charts/lofi-moonrise.normal.chart?raw';
import hard from './charts/lofi-moonrise.hard.chart?raw';
import { BACKBEAT, BREAK_KICK, HAT_8, bars } from './patterns';

const CHORDS = ['Eb3 G3 Bb3 D4', 'C3 Eb3 G3 Bb3', 'Ab2 C4 Eb4 G4', 'Bb2 D4 F4 Ab4'];

const LEAD = bars(
  'G5 - - . F5 . Eb5 - - . Bb4 . C5 - - .',
  'Eb5 - - . D5 . C5 - - . G4 . Bb4 - - .',
  'C5 - - . Bb4 . Ab4 - - . Eb5 . G5 - - .',
  'F5 - - - Eb5 . D5 - - . F5 . Bb5 - - -',
);
const LEAD_BREAK = bars(
  'Bb5 - - - - - - - G5 - - - - - - -',
  'G5 - - - - - - - Eb5 - - - - - - -',
  'Eb5 - - - - - - - C5 - - - - - - -',
  'F5 - - - - - - - D5 - - - - - - -',
);
const ARP = '0 . . 1 . . 2 . 3 . . 2 . . 1 .';
const BASS = 'R - - . . . R . . . O - . . 5 .';

export const lofiMoonrise: SongDefinition = {
  id: 'lofi-moonrise',
  index: 4,
  title: 'LOFI MOONRISE',
  artist: 'BEAT//SHIFT SOUND LAB',
  genre: 'CHILL BEAT',
  bpm: 88,
  offset: 0,
  previewBeat: 56,
  theme: {
    background: 'stars',
    laneColors: ['#9db8ff', '#ffb8e0', '#ffb8e0', '#9db8ff'],
    accent: '#9db8ff',
    accent2: '#ffb8e0',
    jacket: 'linear-gradient(170deg, #03040f 0%, #1f2a5c 50%, #6f5aa8 80%, #ffb8e0 100%)',
    sky: ['#03040f', '#0c1433', '#1f2a5c'],
  },
  composition: {
    bpm: 88,
    sound: { leadWave: 'bell', kickTune: 0.85, kickDrive: 0.8, sidechain: 0.25, reverb: 1.4, hatLevel: 0.55, bassDrive: 0.8 },
    sections: [
      { name: 'intro', bars: 4, energy: 0.2, tone: 0.4, chords: CHORDS, pad: true, arp: ARP, arpGain: 0.8 },
      { name: 'verse', bars: 4, energy: 0.45, tone: 0.6, chords: CHORDS, pad: true, kick: BREAK_KICK, snare: BACKBEAT, hat: HAT_8, bass: BASS, arp: ARP },
      { name: 'build', bars: 2, energy: 0.6, tone: 0.7, chords: CHORDS, pad: true, kick: BREAK_KICK, snare: BACKBEAT, hat: HAT_8, arp: ARP, riser: true },
      {
        name: 'drop', bars: 8, energy: 0.9, tone: 0.8, chords: CHORDS, pad: true, crash: true,
        kick: BREAK_KICK, snare: BACKBEAT, hat: HAT_8, bass: BASS, lead: LEAD, arp: ARP, arpGain: 0.5,
      },
      { name: 'break', bars: 4, energy: 0.35, tone: 0.5, chords: CHORDS, pad: true, lead: LEAD_BREAK, leadGain: 0.8, hat: HAT_8 },
      {
        name: 'drop2', bars: 8, energy: 0.95, tone: 0.85, chords: CHORDS, pad: true, crash: true,
        kick: BREAK_KICK, snare: BACKBEAT, hat: 'xgxgxgxgxgxgxgxg', bass: BASS, lead: LEAD, arp: ARP, arpGain: 0.6,
      },
      { name: 'outro', bars: 4, energy: 0.25, tone: 0.4, chords: CHORDS, pad: true, arp: ARP, crash: true },
    ],
  },
  difficulties: {
    easy: { level: 1, chart: easy },
    normal: { level: 3, chart: normal },
    hard: { level: 6, chart: hard },
  },
};
