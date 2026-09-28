import type { BackgroundId, SongTheme } from '../../types';
import { HighwayBackground } from './highway';
import { RainBackground } from './rain';
import { RushBackground } from './rush';
import { StarsBackground } from './stars';
import type { Background } from './types';
import { WavesBackground } from './waves';

const FACTORIES: Record<BackgroundId, (theme: SongTheme) => Background> = {
  highway: (t) => new HighwayBackground(t),
  rain: (t) => new RainBackground(t),
  rush: (t) => new RushBackground(t),
  stars: (t) => new StarsBackground(t),
  waves: (t) => new WavesBackground(t),
};

/** Background styles are shared; colours come from the song theme. */
export function createBackground(theme: SongTheme): Background {
  return (FACTORIES[theme.background] ?? FACTORIES.highway)(theme);
}

export type { Background, BackgroundFrame } from './types';
