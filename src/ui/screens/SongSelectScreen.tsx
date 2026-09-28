import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { audio } from '../../game/audio/AudioManager';
import { difficultyMeta } from '../../game/config/difficulty';
import { SONGS, availableDifficulties, loadChart, songLength } from '../../game/songs';
import type { DifficultyId, SongDefinition } from '../../game/types';
import { recordKey } from '../../storage/records';
import { NOTE_SPEEDS } from '../../storage/settings';
import { useApp } from '../appContext';
import { Jacket } from '../components/Jacket';
import { MenuBackground } from '../components/MenuBackground';
import { RankBadge } from '../components/RankBadge';
import { formatAccuracy, formatDuration, formatScore } from '../format';

interface Props {
  initialSongId: string;
  initialDifficulty: DifficultyId;
  onStart: (songId: string, difficulty: DifficultyId) => void;
  onBack: () => void;
}

interface ChartInfo {
  notes: number;
  holds: number;
  doubles: number;
  peakNps: number;
  ok: boolean;
}

function chartInfo(song: SongDefinition, diff: DifficultyId): ChartInfo {
  const parsed = loadChart(song, diff);
  if (!parsed || parsed.chart.notes.length === 0) return { notes: 0, holds: 0, doubles: 0, peakNps: 0, ok: false };
  const notes = parsed.chart.notes;
  let peak = 0;
  let j = 0;
  for (let i = 0; i < notes.length; i++) {
    while (notes[i].time - notes[j].time > 1) j++;
    peak = Math.max(peak, i - j + 1);
  }
  return {
    notes: notes.length,
    holds: notes.filter((n) => n.duration > 0).length,
    doubles: new Set(notes.filter((n) => n.chordId !== null).map((n) => n.chordId)).size,
    peakNps: peak,
    ok: parsed.errors.length === 0,
  };
}

export function SongSelectScreen({ initialSongId, initialDifficulty, onStart, onBack }: Props) {
  const { records, settings, updateSettings, sfx } = useApp();
  const [songIndex, setSongIndex] = useState(() => Math.max(0, SONGS.findIndex((s) => s.id === initialSongId)));
  const song = SONGS[songIndex];
  const diffs = availableDifficulties(song);
  const [difficulty, setDifficulty] = useState<DifficultyId>(initialDifficulty);
  const activeDiff = diffs.includes(difficulty) ? difficulty : diffs[Math.min(1, diffs.length - 1)];
  const [preview, setPreview] = useState<{ songId: string; state: 'playing' | 'off' } | null>(null);
  const previewState = preview?.songId === song.id ? preview.state : 'loading';
  const info = useMemo(() => chartInfo(song, activeDiff), [song, activeDiff]);
  const best = records.best[recordKey(song.id, activeDiff)];
  const listRef = useRef<HTMLDivElement>(null);

  // Preview: render (cached) and loop the chorus of the selected song.
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      void audio.playPreview(song).then(() => {
        if (alive) setPreview({ songId: song.id, state: audio.available ? 'playing' : 'off' });
      });
    }, 180);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [song]);
  useEffect(() => () => audio.stopPreview(), []);

  const start = () => {
    if (!info.notes) return;
    sfx('menuSelect');
    onStart(song.id, activeDiff);
  };
  const stepSpeed = (dir: number) => {
    const i = NOTE_SPEEDS.indexOf(settings.noteSpeed as (typeof NOTE_SPEEDS)[number]);
    const next = NOTE_SPEEDS[Math.max(0, Math.min(NOTE_SPEEDS.length - 1, (i < 0 ? 3 : i) + dir))];
    if (next !== settings.noteSpeed) {
      sfx('menuMove');
      updateSettings({ noteSpeed: next });
    }
  };
  const stepSpeedRef = useRef(stepSpeed);
  useEffect(() => {
    stepSpeedRef.current = stepSpeed;
  });
  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const moveSong = (d: number) => {
        e.preventDefault();
        sfx('menuMove');
        setSongIndex((i) => (i + d + SONGS.length) % SONGS.length);
      };
      const moveDiff = (d: number) => {
        e.preventDefault();
        sfx('menuMove');
        const i = diffs.indexOf(activeDiff);
        setDifficulty(diffs[Math.max(0, Math.min(diffs.length - 1, i + d))]);
      };
      if (e.key === 'ArrowUp') moveSong(-1);
      else if (e.key === 'ArrowDown') moveSong(1);
      else if (e.key === 'ArrowLeft') moveDiff(-1);
      else if (e.key === 'ArrowRight') moveDiff(1);
      else if (e.key === '[' || e.key === '-') stepSpeedRef.current(-1);
      else if (e.key === ']' || e.key === '=' || e.key === '+') stepSpeedRef.current(1);
      else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        startRef.current();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        sfx('menuBack');
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [diffs, activeDiff, onBack, sfx]);

  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [songIndex]);

  const level = song.difficulties[activeDiff]?.level ?? 0;
  const meta = difficultyMeta(activeDiff);

  return (
    <div className="screen select" style={{ '--accent': song.theme.accent, '--accent2': song.theme.accent2 } as CSSProperties}>
      <MenuBackground accent={song.theme.accent} accent2={song.theme.accent2} bpm={song.bpm} reducedMotion={settings.reducedMotion} />
      <header className="screen-header">
        <button className="btn btn--ghost" onClick={() => (sfx('menuBack'), onBack())} aria-label="Back to title">
          ← BACK
        </button>
        <h2 className="screen-header__title">SONG SELECT</h2>
        <span className="screen-header__hint">↑↓ SONG · ←→ LEVEL · [ ] SPEED · ENTER START</span>
      </header>

      <div className="select__body">
        <div className="song-list" ref={listRef} role="listbox" aria-label="Songs">
          {SONGS.map((s, i) => {
            const top = availableDifficulties(s)
              .map((d) => records.best[recordKey(s.id, d)]?.bestScore ?? 0)
              .reduce((a, b) => Math.max(a, b), 0);
            return (
              <button
                key={s.id}
                role="option"
                aria-selected={i === songIndex}
                className={`song-card${i === songIndex ? ' is-active' : ''}`}
                style={{ '--card-accent': s.theme.accent } as CSSProperties}
                onClick={() => {
                  if (i === songIndex) return;
                  sfx('menuMove');
                  setSongIndex(i);
                }}
              >
                <Jacket song={s} size="sm" />
                <span className="song-card__meta">
                  <span className="song-card__num">{String(s.index).padStart(2, '0')} —</span>
                  <span className="song-card__title">{s.title}</span>
                  <span className="song-card__sub">
                    BPM {s.bpm} · {formatDuration(songLength(s))} · {s.genre}
                  </span>
                </span>
                <span className="song-card__best">{top ? formatScore(top) : ''}</span>
              </button>
            );
          })}
        </div>

        <section className="song-detail" aria-live="polite">
          <div className="song-detail__hero" key={song.id}>
            <Jacket song={song} size="lg" />
            <div className="song-detail__heading">
              <span className="song-detail__genre">{song.genre}</span>
              <h3 className="song-detail__title">{song.title}</h3>
              <span className="song-detail__artist">{song.artist}</span>
              <div className="song-detail__facts">
                <span>
                  <b>{song.bpm}</b> BPM
                </span>
                <span>
                  <b>{formatDuration(songLength(song))}</b> LENGTH
                </span>
                <span className={`preview-tag preview-tag--${previewState}`}>
                  {previewState === 'loading' ? 'LOADING PREVIEW…' : previewState === 'playing' ? '♪ PREVIEW' : 'NO AUDIO'}
                </span>
              </div>
            </div>
          </div>

          <div className="diff-tabs" role="radiogroup" aria-label="Difficulty">
            {diffs.map((d) => {
              const m = difficultyMeta(d);
              const b = records.best[recordKey(song.id, d)];
              return (
                <button
                  key={d}
                  role="radio"
                  aria-checked={d === activeDiff}
                  className={`diff-tab${d === activeDiff ? ' is-active' : ''}`}
                  style={{ '--diff-color': m.color } as CSSProperties}
                  onClick={() => {
                    sfx('menuMove');
                    setDifficulty(d);
                  }}
                >
                  <span className="diff-tab__label">{m.label}</span>
                  <span className="diff-tab__level">{song.difficulties[d]?.level}</span>
                  {b?.fullCombo && <span className="diff-tab__fc">{b.allPerfect ? 'AP' : 'FC'}</span>}
                </button>
              );
            })}
          </div>

          <div className="chart-info" style={{ '--diff-color': meta.color } as CSSProperties}>
            <div className="chart-info__stars" aria-label={`Level ${level}`}>
              {Array.from({ length: 12 }, (_, i) => (
                <i key={i} className={i < level ? 'on' : ''} />
              ))}
            </div>
            <dl className="chart-info__grid">
              <div>
                <dt>NOTES</dt>
                <dd>{info.notes}</dd>
              </div>
              <div>
                <dt>HOLDS</dt>
                <dd>{info.holds}</dd>
              </div>
              <div>
                <dt>DOUBLES</dt>
                <dd>{info.doubles}</dd>
              </div>
              <div>
                <dt>PEAK</dt>
                <dd>{info.peakNps} NPS</dd>
              </div>
            </dl>
          </div>

          <div className="best-box">
            <div className="best-box__title">
              PERSONAL BEST <span>{meta.label}</span>
            </div>
            {best ? (
              <div className="best-box__grid">
                <RankBadge rank={best.bestRank} size="md" />
                <div>
                  <span className="stat__label">SCORE</span>
                  <span className="stat__value">{formatScore(best.bestScore)}</span>
                </div>
                <div>
                  <span className="stat__label">ACCURACY</span>
                  <span className="stat__value">{formatAccuracy(best.bestAccuracy)}</span>
                </div>
                <div>
                  <span className="stat__label">MAX COMBO</span>
                  <span className="stat__value">{best.maxCombo}</span>
                </div>
              </div>
            ) : (
              <p className="best-box__empty">NO RECORD YET — BE THE FIRST.</p>
            )}
          </div>

          <div className="speed-row">
            <span className="stat__label">NOTE SPEED</span>
            <div className="stepper" role="group" aria-label="Note speed">
              <button className="stepper__btn" aria-label="Slower notes" onClick={() => stepSpeed(-1)} disabled={settings.noteSpeed <= NOTE_SPEEDS[0]}>
                −
              </button>
              <output className="stepper__value">{settings.noteSpeed}×</output>
              <button
                className="stepper__btn"
                aria-label="Faster notes"
                onClick={() => stepSpeed(1)}
                disabled={settings.noteSpeed >= NOTE_SPEEDS[NOTE_SPEEDS.length - 1]}
              >
                +
              </button>
            </div>
            {settings.offsetMs !== 0 && <span className="speed-row__offset">OFFSET {settings.offsetMs > 0 ? '+' : ''}{settings.offsetMs} MS</span>}
          </div>
          <button className="btn btn--start" onClick={start} disabled={!info.notes}>
            <span>START</span>
            <small>
              {song.title} · {meta.label} {level}
            </small>
          </button>
          {!info.ok && <p className="warn">This chart has errors and may not play correctly.</p>}
        </section>
      </div>
    </div>
  );
}
