import { useEffect, useRef } from 'react';
import { difficultyMeta, isDifficultyId } from '../../game/config/difficulty';
import { SONGS, availableDifficulties, getSong } from '../../game/songs';
import { globalStats } from '../../storage/records';
import { useApp } from '../appContext';
import { MenuBackground } from '../components/MenuBackground';
import { formatAccuracy, formatScore } from '../format';
import { useMenuNavigation } from '../hooks/useMenuNavigation';

interface Props {
  started: boolean;
  onStart: () => void;
  onQuickPlay: () => void;
  onSongSelect: () => void;
  onRecords: () => void;
  onSettings: () => void;
}

export function TitleScreen({ started, onStart, onQuickPlay, onSongSelect, onRecords, onSettings }: Props) {
  const { records, settings, sfx } = useApp();
  const stats = globalStats(records);
  const lastSong = getSong(settings.lastSongId);
  const lastDiff = isDifficultyId(settings.lastDifficulty) ? difficultyMeta(settings.lastDifficulty) : null;

  const items = [
    { label: 'PLAY', sub: lastSong ? `${lastSong.title} · ${lastDiff?.label ?? ''}` : 'QUICK START', action: onQuickPlay },
    { label: 'SONG SELECT', sub: `${SONGS.length} TRACKS · ${new Set(SONGS.flatMap(availableDifficulties)).size} LEVELS`, action: onSongSelect },
    { label: 'RECORDS', sub: stats.plays ? `${stats.plays} PLAYS` : 'NO PLAYS YET', action: onRecords },
    { label: 'SETTINGS', sub: 'AUDIO · SPEED · KEYS', action: onSettings },
  ];
  const [index, setIndex] = useMenuNavigation({
    count: items.length,
    onSelect: (i) => items[i].action(),
    enabled: started,
  });
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (started) buttons.current[index]?.focus({ preventScroll: true });
  }, [index, started]);

  // "Press any key" gate: unlocks audio on the first gesture.
  useEffect(() => {
    if (started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.key === 'Tab') return;
      e.preventDefault();
      onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, onStart]);

  return (
    <div className="screen title">
      <MenuBackground reducedMotion={settings.reducedMotion} bpm={124} />
      <div className="title__center">
        <h1 className="logo" aria-label="BEAT//SHIFT">
          <span className="logo__word">BEAT</span>
          <span className="logo__slash">//</span>
          <span className="logo__word logo__word--b">SHIFT</span>
        </h1>
        <p className="tagline">RHYTHM IS EVERYTHING.</p>

        {!started ? (
          <button className="press-start" onClick={onStart} autoFocus>
            <span className="press-start__text">TAP TO START</span>
            <span className="press-start__hint">OR PRESS ANY KEY</span>
          </button>
        ) : (
          <nav className="title-menu" aria-label="Main menu">
            {items.map((item, i) => (
              <button
                key={item.label}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                className={`title-menu__item${i === index ? ' is-active' : ''}${i === 0 ? ' title-menu__item--play' : ''}`}
                style={{ animationDelay: `${i * 70}ms` }}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'mouse') return;
                  if (i !== index) sfx('menuMove');
                  setIndex(i);
                }}
                onFocus={() => setIndex(i)}
                onClick={() => {
                  sfx('menuSelect');
                  item.action();
                }}
              >
                <span className="title-menu__label">{item.label}</span>
                <span className="title-menu__sub">{item.sub}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      <footer className="title__stats" aria-label="Your best records">
        <div>
          <span className="stat__label">BEST SCORE</span>
          <span className="stat__value">{stats.bestScore ? formatScore(stats.bestScore) : '—'}</span>
        </div>
        <div>
          <span className="stat__label">BEST ACCURACY</span>
          <span className="stat__value">{stats.bestAccuracy ? formatAccuracy(stats.bestAccuracy) : '—'}</span>
        </div>
        <div>
          <span className="stat__label">MAX COMBO</span>
          <span className="stat__value">{stats.maxCombo || '—'}</span>
        </div>
      </footer>
      <p className="title__credit">ALL MUSIC SYNTHESIZED IN YOUR BROWSER · v1.0</p>
    </div>
  );
}
