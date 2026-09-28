import type { SongDefinition } from '../types';
import easy from './charts/solar-flare.easy.chart?raw';
import normal from './charts/solar-flare.normal.chart?raw';
import hard from './charts/solar-flare.hard.chart?raw';
import { BACKBEAT, FOUR, HAT_16, HAT_8, HAT_OFF, bars } from './patterns';

const CHORDS = ['A2 E3 A3 C4', 'F2 C3 F3 A3', 'G2 D3 G3 B3', 'E2 B2 E3 G#3'];

const LEAD = bars(
  'A5 . C6 . E6 . A5 . C6 . E6 . D6 . C6 .',
  'A5 . C6 . F6 . A5 . C6 . F6 . E6 . C6 .',
  'B5 . D6 . G6 . B5 . D6 . G6 . F6 . D6 .',
  'B5 . E6 . G#6 . B5 . E6 - - - D6 . B5 .',
);
const LEAD_BREAK = bars(
  'E6 - - - - - - - C6 - - - - - - -',
  'F6 - - - - - - - C6 - - - - - - -',
  'G6 - - - - - - - D6 - - - - - - -',
  'G#6 - - - - - - - E6 - - - - - - -',
);
const ARP = '0 . 2 . 3 . 1 . 2 . 3 . 1 . 2 .';
const ARP_16 = '0 1 2 3 1 2 3 0 2 3 0 1 3 0 1 2';
const OFFBEAT_BASS = '. . O . . . O . . . O . . . O .';

export const solarFlare: SongDefinition = {
  id: 'solar-flare',
  index: 9,
  title: 'SOLAR FLARE',
  artist: 'BEAT//SHIFT SOUND LAB',
  genre: 'HYPER TRANCE',
  bpm: 180,
  offset: 0,
  previewBeat: 128,
  theme: {
    background: 'highway',
    laneColors: ['#ff7a1a', '#ffd23d', '#ffd23d', '#ff7a1a'],
    accent: '#ff7a1a',
    accent2: '#ffd23d',
    jacket: 'linear-gradient(160deg, #0f0400 0%, #8a2a00 45%, #ff7a1a 75%, #ffd23d 100%)',
    sky: ['#0f0400', '#3d1300', '#8a2a00'],
  },
  composition: {
    bpm: 180,
    sound: { kickDrive: 1.8, kickTune: 1.1, leadDetune: 1.25, leadBrightness: 1.2, sidechain: 0.5, reverb: 1 },
    sections: [
      { name: 'intro', bars: 8, energy: 0.3, tone: 0.45, chords: CHORDS, pad: true, arp: ARP, hat: HAT_8 },
      {
        name: 'verse', bars: 8, energy: 0.6, tone: 0.75, chords: CHORDS, pad: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_OFF, bass: OFFBEAT_BASS, arp: ARP,
      },
      { name: 'build', bars: 8, energy: 0.8, tone: 0.9, chords: CHORDS, pad: true, kick: FOUR, hat: HAT_16, roll: true, riser: true, arp: ARP_16 },
      {
        name: 'drop', bars: 16, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, openHat: HAT_OFF, bass: OFFBEAT_BASS, lead: LEAD, arp: ARP, arpGain: 0.35,
      },
      { name: 'break', bars: 8, energy: 0.45, tone: 0.55, chords: CHORDS, pad: true, crash: true, hat: HAT_8, lead: LEAD_BREAK, leadGain: 0.8, arp: ARP },
      { name: 'build2', bars: 4, energy: 0.9, tone: 0.95, chords: CHORDS, pad: true, kick: FOUR, roll: true, riser: true, hat: HAT_16, arp: ARP_16 },
      {
        name: 'drop2', bars: 16, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, openHat: HAT_OFF, bass: OFFBEAT_BASS, lead: LEAD, arp: ARP_16, arpGain: 0.35,
      },
      { name: 'outro', bars: 4, energy: 0.3, tone: 0.5, chords: CHORDS, pad: true, crash: true, arp: ARP, hat: HAT_8 },
    ],
  },
  difficulties: {
    easy: { level: 5, chart: easy },
    normal: { level: 8, chart: normal },
    hard: { level: 12, chart: hard },
  },
};
