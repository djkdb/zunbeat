import type { SongDefinition } from '../types';
import easy from './charts/crimson-pulse.easy.chart?raw';
import normal from './charts/crimson-pulse.normal.chart?raw';
import hard from './charts/crimson-pulse.hard.chart?raw';
import { BACKBEAT, FOUR, HAT_16, HAT_8, HAT_OFF, bars } from './patterns';

const CHORDS = ['C3 G3 C4 Eb4', 'Ab2 Eb3 Ab3 C4', 'Bb2 F3 Bb3 D4', 'G2 D3 G3 B3'];

const LEAD = bars(
  'C5 - . C5 Eb5 - . G5 - . F5 . Eb5 . D5 .',
  'C5 - . C5 Eb5 - . Ab5 - . G5 . Eb5 . C5 .',
  'D5 - . D5 F5 - . Bb5 - . Ab5 . G5 . F5 .',
  'D5 - . D5 G5 - . B5 - - - . G5 . D5 .',
);
const LEAD_BREAK = bars(
  'G5 - - - - - - - Eb5 - - - - - - -',
  'Ab5 - - - - - - - Eb5 - - - - - - -',
  'Bb5 - - - - - - - F5 - - - - - - -',
  'B5 - - - - - - - D5 - - - - - - -',
);
const ARP = '0 . . 2 . . 1 . 3 . . 2 . . 1 .';
const ARP_16 = '0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3';
const OFFBEAT_BASS = '. . O . . . O . . . O . . . O .';

export const crimsonPulse: SongDefinition = {
  id: 'crimson-pulse',
  index: 8,
  title: 'CRIMSON PULSE',
  artist: 'BEAT//SHIFT SOUND LAB',
  genre: 'HARD ELECTRO',
  bpm: 160,
  offset: 0,
  previewBeat: 96,
  theme: {
    background: 'rush',
    laneColors: ['#ff3b3b', '#ffae3d', '#ffae3d', '#ff3b3b'],
    accent: '#ff3b3b',
    accent2: '#ffae3d',
    jacket: 'linear-gradient(160deg, #120202 0%, #7a0f0f 45%, #ff3b3b 75%, #ffae3d 100%)',
    sky: ['#120202', '#3a0707', '#7a0f0f'],
  },
  composition: {
    bpm: 160,
    sound: { kickDrive: 2.6, kickTune: 0.9, sidechain: 0.65, leadDetune: 1.3, bassDrive: 1.8, reverb: 0.9 },
    sections: [
      { name: 'intro', bars: 8, energy: 0.3, tone: 0.45, chords: CHORDS, pad: true, arp: ARP, hat: HAT_8 },
      {
        name: 'verse', bars: 8, energy: 0.6, tone: 0.75, chords: CHORDS, pad: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_OFF, bass: OFFBEAT_BASS, arp: ARP,
      },
      { name: 'build', bars: 4, energy: 0.8, tone: 0.9, chords: CHORDS, pad: true, kick: FOUR, hat: HAT_16, roll: true, riser: true, arp: ARP_16 },
      {
        name: 'drop', bars: 16, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, openHat: HAT_OFF, bass: OFFBEAT_BASS, lead: LEAD, arp: ARP, arpGain: 0.4,
      },
      { name: 'break', bars: 4, energy: 0.45, tone: 0.55, chords: CHORDS, pad: true, crash: true, hat: HAT_8, lead: LEAD_BREAK, leadGain: 0.8, arp: ARP },
      { name: 'build2', bars: 4, energy: 0.85, tone: 0.95, chords: CHORDS, pad: true, kick: FOUR, roll: true, riser: true, hat: HAT_16, arp: ARP_16 },
      {
        name: 'drop2', bars: 16, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, openHat: HAT_OFF, bass: OFFBEAT_BASS, lead: LEAD, arp: ARP_16, arpGain: 0.35,
      },
      { name: 'outro', bars: 4, energy: 0.3, tone: 0.5, chords: CHORDS, pad: true, crash: true, arp: ARP, hat: HAT_8 },
    ],
  },
  difficulties: {
    easy: { level: 4, chart: easy },
    normal: { level: 7, chart: normal },
    hard: { level: 11, chart: hard },
  },
};
