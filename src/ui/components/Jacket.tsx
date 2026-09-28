import type { SongDefinition } from '../../game/types';

/** Procedural "album art" for a song: theme gradient + a motif per background style. */
export function Jacket({ song, size = 'md' }: { song: SongDefinition; size?: 'sm' | 'md' | 'lg' }) {
  const { theme } = song;
  return (
    <div className={`jacket jacket--${size}`} style={{ background: theme.jacket }} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="jacket__art">
        {theme.background === 'highway' && (
          <g>
            <circle cx="50" cy="52" r="24" fill={`url(#sun-${song.id})`} />
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={i} x="20" y={55 + i * 4.5} width="60" height={1 + i * 0.6} fill="#1a0536" />
            ))}
            <rect x="0" y="70" width="100" height="30" fill="#12021f" />
            {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
              <line key={i} x1="50" y1="70" x2={50 + i * 30} y2="100" stroke={theme.accent} strokeWidth="0.6" />
            ))}
            {[74, 79, 86, 95].map((y) => (
              <line key={y} x1="0" y1={y} x2="100" y2={y} stroke={theme.accent} strokeWidth="0.6" />
            ))}
            <defs>
              <linearGradient id={`sun-${song.id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#ffe45c" />
                <stop offset="1" stopColor="#ff2e88" />
              </linearGradient>
            </defs>
          </g>
        )}
        {theme.background === 'rain' &&
          Array.from({ length: 14 }, (_, i) => (
            <line
              key={i}
              x1={4 + i * 7}
              x2={4 + i * 7}
              y1={(i * 37) % 60}
              y2={((i * 37) % 60) + 25 + (i % 3) * 12}
              stroke={i % 4 === 0 ? '#d8fff0' : theme.accent}
              strokeWidth={i % 4 === 0 ? 1.4 : 0.8}
              opacity={0.85}
            />
          ))}
        {theme.background === 'rush' && (
          <g fill="none" strokeWidth="1.4">
            {[34, 24, 15, 8].map((r, i) => (
              <polygon
                key={r}
                points={hexagon(50, 50, r, i * 0.3)}
                stroke={i % 2 === 0 ? theme.accent2 : '#ffffff'}
                opacity={1 - i * 0.18}
              />
            ))}
          </g>
        )}
      </svg>
      <span className="jacket__index">{String(song.index).padStart(2, '0')}</span>
    </div>
  );
}

function hexagon(cx: number, cy: number, r: number, rot: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = rot + (k / 6) * Math.PI * 2;
    return `${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');
}
