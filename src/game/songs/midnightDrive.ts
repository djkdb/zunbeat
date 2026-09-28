import type { SongDefinition } from '../types';
import easy from './charts/midnight-drive.easy.chart?raw';
import normal from './charts/midnight-drive.normal.chart?raw';
import hard from './charts/midnight-drive.hard.chart?raw';

const CHORDS = ['A2 E3 A3 C4 E4', 'F2 C3 F3 A3 C4', 'C3 G3 C4 E4 G4', 'G2 D3 G3 B3 D4'];

const LEAD_DROP = [
  'A4 - - C5 - - E5 - D5 - C5 - A4 - - -',
  'F4 - - A4 - - C5 - E5 - - - D5 - C5 -',
  'G4 - - C5 - - E5 - G5 - - - E5 - D5 -',
  'D5 - - - B4 - - - G4 - A4 - B4 - D5 -',
].join(' ');

const LEAD_BREAK = [
  'E5 - - - - - - - D5 - - - - - - -',
  'C5 - - - - - - - A4 - - - - - - -',
  'G4 - - - - - - - C5 - - - - - - -',
  'B4 - - - - - - - D5 - - - - - - -',
].join(' ');

const ARP = '0 . 2 3 4 . 3 2 0 . 2 3 4 . 3 2';
const ARP_16 = '0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1';
const BASS_OCT = 'R . O . R . O . R . O . R . O .';

const FOUR = 'x...x...x...x...';
const BACKBEAT = '....x.......x...';
const HAT_OFF = '..x...x...x...x.';
const HAT_16 = 'xg.gxg.gxg.gxg.g';

export const midnightDrive: SongDefinition = {
  id: 'midnight-drive',
  index: 1,
  title: 'MIDNIGHT DRIVE',
  artist: 'BEAT//SHIFT SOUND LAB',
  genre: 'SYNTHWAVE',
  bpm: 124,
  offset: 0,
  previewBeat: 64,
  theme: {
    background: 'highway',
    laneColors: ['#ff4fd8', '#6b7dff', '#6b7dff', '#ff4fd8'],
    accent: '#ff4fd8',
    accent2: '#ffb347',
    jacket: 'linear-gradient(160deg, #1a0536 0%, #5a0f6e 45%, #ff4f8b 78%, #ffb347 100%)',
    sky: ['#07010f', '#1d0535', '#5c0f5a'],
  },
  composition: {
    bpm: 124,
    sound: { kickTune: 1, leadDetune: 1.1, reverb: 1.15, sidechain: 0.6 },
    sections: [
      { name: 'intro', bars: 4, energy: 0.2, tone: 0.4, chords: CHORDS, pad: true, arp: ARP, arpGain: 0.8 },
      {
        name: 'verse', bars: 8, energy: 0.5, tone: 0.7, chords: CHORDS, pad: true,
        kick: FOUR, snare: BACKBEAT, hat: HAT_OFF, bass: BASS_OCT, arp: ARP,
      },
      {
        name: 'build', bars: 4, energy: 0.7, tone: 0.85, chords: CHORDS, pad: true,
        kick: FOUR, hat: HAT_OFF, roll: true, riser: true, bass: 'R . R . R . R . R . R . R . R .', arp: ARP_16,
      },
      {
        name: 'drop', bars: 8, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, openHat: HAT_OFF, bass: BASS_OCT, lead: LEAD_DROP, arp: ARP, arpGain: 0.6,
      },
      {
        name: 'break', bars: 4, energy: 0.45, tone: 0.6, chords: CHORDS, pad: true, crash: true,
        hat: HAT_OFF, lead: LEAD_BREAK, leadGain: 0.8, arp: ARP, arpGain: 0.7,
      },
      {
        name: 'build2', bars: 2, energy: 0.8, tone: 0.9, chords: ['F2 C3 F3 A3 C4', 'G2 D3 G3 B3 D4'], pad: true,
        kick: FOUR, roll: true, riser: true, hat: HAT_16, arp: ARP_16,
      },
      {
        name: 'drop2', bars: 8, energy: 1, chords: CHORDS, pad: true, crash: true, impact: true,
        kick: FOUR, clap: BACKBEAT, hat: HAT_16, openHat: HAT_OFF, bass: BASS_OCT, lead: LEAD_DROP, arp: ARP_16, arpGain: 0.55,
      },
      { name: 'outro', bars: 4, energy: 0.3, tone: 0.5, chords: CHORDS, pad: true, crash: true, arp: ARP, hat: HAT_OFF },
    ],
  },
  difficulties: {
    easy: { level: 2, chart: easy },
    normal: { level: 5, chart: normal },
    hard: { level: 8, chart: hard },
  },
};
