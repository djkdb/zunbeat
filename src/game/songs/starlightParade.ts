import type { SongDefinition } from '../types';
import easy from './charts/starlight-parade.easy.chart?raw';
import normal from './charts/starlight-parade.normal.chart?raw';
import hard from './charts/starlight-parade.hard.chart?raw';
import { BACKBEAT, FOUR, HAT_16, HAT_8, HAT_OFF, bars } from './patterns';

const CHORDS = ['F2 A3 C4 E4', 'E2 G3 B3 D4', 'D2 F3 A3 C4', 'C3 E3 G3 Bb3'];

const LEAD = bars(
  'A5 . C6 . A5 . G5 F5 . . G5 . A5 - - .',
  'G5 . B5 . G5 . E5 D5 . . E5 . G5 - - .',
  'F5 . A5 . F5 . E5 D5 . . C5 . D5 - - .',
  'E5 . G5 . Bb5 . A5 G5 . . E5 . C5 - - -',
);
const LEAD_BREAK = bars(
  'E5 - - - - - - - C5 - - - - - - -',
  'D5 - - - - - - - B4 - - - - - - -',
  'C5 - - - - - - - A4 - - - - - - -',
  'Bb4 - - - - - - - G4 - - - - - - -',
);
const ARP = '0 . 2 . 1 3 . 2 0 . 2 . 3 1 . 2';
const ARP_16 = '0 1 2 3 1 2 3 0 2 3 0 1 3 2 1 0';
const BASS = 'R . O . R R O . R . O . R R O .';

export const starlightParade: SongDefinition = {
  id: 'starlight-parade',
  index: 5,
  title: 'STARLIGHT PARADE',
  artist: 'BEAT//SHIFT SOUND LAB',
  genre: 'FUTURE FUNK',
  bpm: 112,
  offset: 0,
  previewBeat: 64,
  theme: {
    background: 'stars',
    laneColors: ['#ffd65c', '#ff6fb5', '#ff6fb5', '#ffd65c'],
    accent: '#ff6fb5',
    accent2: '#ffd65c',
    jacket: 'linear-gradient(150deg, #0b0320 0%, #6b1f6e 45%, #ff6fb5 75%, #ffd65c 100%)',
    sky: ['#0b0320', '#2a0c45', '#6b1f6e'],
  },
  composition: {
    bpm: 112,
    sound: { leadWave: 'pulse', sidechain: 0.5, reverb: 1.1, bassDrive: 1.1, leadBrightness: 1 },
    sections: [
      { name: 'intro', bars: 4, energy: 0.25, tone: 0.5, chords: CHORDS, pad: true, arp: ARP, hat: HAT_8 },
      {
        name: 'verse', bars: 8, energy: 0.55, tone: 0.75, chords: CHORDS, pad: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, bass: BASS, arp: ARP,
      },
      { name: 'build', bars: 4, energy: 0.75, tone: 0.9, chords: CHORDS, pad: true, kick: FOUR, hat: HAT_16, roll: true, riser: true, arp: ARP_16 },
      {
        name: 'drop', bars: 8, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, openHat: HAT_OFF, bass: BASS, lead: LEAD, arp: ARP, arpGain: 0.5,
      },
      { name: 'break', bars: 4, energy: 0.4, tone: 0.6, chords: CHORDS, pad: true, crash: true, hat: HAT_8, lead: LEAD_BREAK, leadGain: 0.8, arp: ARP },
      { name: 'build2', bars: 2, energy: 0.8, tone: 0.9, chords: ['D2 F3 A3 C4', 'C3 E3 G3 Bb3'], pad: true, kick: FOUR, roll: true, riser: true, hat: HAT_16, arp: ARP_16 },
      {
        name: 'drop2', bars: 8, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, openHat: HAT_OFF, bass: BASS, lead: LEAD, arp: ARP_16, arpGain: 0.45,
      },
      { name: 'outro', bars: 4, energy: 0.3, tone: 0.5, chords: CHORDS, pad: true, crash: true, arp: ARP, hat: HAT_8 },
    ],
  },
  difficulties: {
    easy: { level: 2, chart: easy },
    normal: { level: 5, chart: normal },
    hard: { level: 8, chart: hard },
  },
};
