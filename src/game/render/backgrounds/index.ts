import type { BackgroundId } from '../../types';
import { HighwayBackground } from './highway';
import { RainBackground } from './rain';
import { RushBackground } from './rush';
import type { Background } from './types';

export function createBackground(id: BackgroundId): Background {
  switch (id) {
    case 'rain':
      return new RainBackground();
    case 'rush':
      return new RushBackground();
    default:
      return new HighwayBackground();
  }
}

export type { Background, BackgroundFrame } from './types';
