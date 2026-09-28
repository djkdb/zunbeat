import { useEffect, useRef, type CSSProperties } from 'react';
import { audio } from '../../game/audio/AudioManager';
import { difficultyMeta } from '../../game/config/difficulty';
import { getSong } from '../../game/songs';
import type { PlayResult } from '../../game/types';
import type { SaveOutcome } from '../../storage/records';
import { useApp } from '../appContext';
import { MenuBackground } from '../components/MenuBackground';
import { RankBadge } from '../components/RankBadge';
import { formatAccuracy, formatScore } from '../format';
import { useCountUp } from '../hooks/useCountUp';
import { useMenuNavigation } from '../hooks/useMenuNavigation';

interface Props {
  result: PlayResult;
  saved: SaveOutcome;
  onRetry: () => void;
  onSongSelect: () => void;
  onHome: () => void;
}

const RANK_REVEAL_MS = 1100;

export function ResultScreen({ result, saved, onRetry, onSongSelect, onHome }: Props) {
  const { settings, sfx } = useApp();
  const song = getSong(result.songId);
  const meta = difficultyMeta(result.difficulty);
  const reduced = settings.reducedMotion;
  const score = useCountUp(result.score, 1300, 350, reduced);
  const accuracy = useCountUp(result.accuracy, 1100, 350, reduced);
  const newRecord = !result.autoplay && saved.newBestScore;

  useEffect(() => {
    const timers = [
      window.setTimeout(() => audio.playSfx('resultImpact', { gain: 0.8 }), 60),
      window.setTimeout(() => audio.playSfx('rankReveal', { gain: 0.7 }), RANK_REVEAL_MS),
    ];
    if (newRecord) timers.push(window.setTimeout(() => audio.playSfx('newRecord', { gain: 0.7 }), RANK_REVEAL_MS + 700));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [newRecord]);

  const actions = [onRetry, onSongSelect, onHome];
  const [index, setIndex] = useMenuNavigation({
    count: 3,
    axis: 'horizontal',
    onSelect: (i) => actions[i](),
    onBack: onSongSelect,
  });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => refs.current[index]?.focus({ preventScroll: true }), [index]);

  const total = result.totalJudgments || 1;
  const c = result.counts;
  const rows = [
    { key: 'perfect', label: 'PERFECT', value: c.perfect },
    { key: 'great', label: 'GREAT', value: c.great },
    { key: 'good', label: 'GOOD', value: c.good },
    { key: 'miss', label: 'MISS', value: c.miss },
  ] as const;
  const scoreDelta = saved.previous ? result.score - saved.previous.bestScore : 0;

  return (
    <div
      className={`screen result rank-${result.rank.replace('+', 'plus').toLowerCase()}`}
      style={{ '--accent': song?.theme.accent ?? '#ff3d8b', '--accent2': song?.theme.accent2 ?? '#3dc8ff' } as CSSProperties}
    >
      <MenuBackground accent={song?.theme.accent} accent2={song?.theme.accent2} bpm={song?.bpm} reducedMotion={reduced} />
      <div className="result__flash" aria-hidden="true" />
      <header className="result__header">
        <span className="result__label">RESULT</span>
        <span className="result__song">{song?.title ?? result.songId}</span>
        <span className="result__diff" style={{ color: meta.color, borderColor: meta.color }}>
          {meta.label} {song?.difficulties[result.difficulty]?.level}
        </span>
        {result.autoplay && <span className="hud__auto">AUTO PLAY · NOT SAVED</span>}
      </header>

      <div className="result__body">
        <section className="result__main">
          <div className="result__rank">
            <RankBadge rank={result.rank} size="xl" />
            {(result.allPerfect || result.fullCombo) && (
              <span className={`result__fc${result.allPerfect ? ' is-ap' : ''}`}>{result.allPerfect ? 'ALL PERFECT' : 'FULL COMBO'}</span>
            )}
          </div>
          <div className="result__numbers">
            <div className="result__accuracy">
              <span className="stat__label">ACCURACY</span>
              <span className="result__accuracy-value">{formatAccuracy(accuracy)}</span>
            </div>
            <div className="result__score">
              <span className="stat__label">SCORE</span>
              <span className="result__score-value">{formatScore(score)}</span>
              {saved.previous && !result.autoplay && (
                <span className={`result__delta${scoreDelta >= 0 ? ' up' : ' down'}`}>
                  {scoreDelta >= 0 ? '+' : '−'}
                  {formatScore(Math.abs(scoreDelta))} vs BEST
                </span>
              )}
            </div>
            {newRecord && <div className="new-record">NEW RECORD!</div>}
          </div>
        </section>

        <section className="result__stats">
          <div className="result__combo">
            <span className="stat__label">MAX COMBO</span>
            <span className="result__combo-value">{result.maxCombo}</span>
            {saved.newMaxCombo && !result.autoplay && saved.previous && <span className="mini-badge">BEST</span>}
          </div>
          <div className="judge-bar" aria-hidden="true">
            {rows.map((r) => (
              <i key={r.key} className={`judge-bar__${r.key}`} style={{ flexGrow: r.value / total }} />
            ))}
          </div>
          <ul className="judge-list">
            {rows.map((r, i) => (
              <li key={r.key} className={`judge-list__row judge-list__row--${r.key}`} style={{ animationDelay: `${500 + i * 90}ms` }}>
                <span>{r.label}</span>
                <b>{r.value}</b>
              </li>
            ))}
            <li className="judge-list__row judge-list__row--fs" style={{ animationDelay: '880ms' }}>
              <span>FAST / SLOW</span>
              <b>
                {result.fast} / {result.slow}
              </b>
            </li>
          </ul>
        </section>
      </div>

      <nav className="result__actions" aria-label="Next">
        {['RETRY', 'SONG SELECT', 'HOME'].map((label, i) => (
          <button
            key={label}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`btn ${i === 0 ? 'btn--primary' : 'btn--ghost'}${i === index ? ' is-active' : ''}`}
            onMouseEnter={() => setIndex(i)}
            onFocus={() => setIndex(i)}
            onClick={() => {
              sfx(i === 0 ? 'menuSelect' : 'menuBack');
              actions[i]();
            }}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
