/** Shared 16-step drum patterns for song compositions. */
export const FOUR = 'x...x...x...x...';
export const BACKBEAT = '....x.......x...';
export const HAT_OFF = '..x...x...x...x.';
export const HAT_8 = 'x.x.x.x.x.x.x.x.';
export const HAT_16 = 'xgxgxgxgxgxgxgxg';
export const DNB_KICK = 'x.........x.....';
export const BREAK_KICK = 'x.....x...x.....';

export const bars = (...lines: string[]) => lines.join(' ');
