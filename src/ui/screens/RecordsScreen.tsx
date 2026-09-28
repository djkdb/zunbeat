import { useEffect, useState, type CSSProperties } from 'react';
import { difficultyMeta } from '../../game/config/difficulty';
import { SONGS, availableDifficulties, getSong } from '../../game/songs';
import { recordKey, resetRecords } from '../../storage/records';
import { useApp } from '../appContext';
import { Jacket } from '../components/Jacket';
import { MenuBackground } from '../components/MenuBackground';
import { RankBadge } from '../components/RankBadge';
import { formatAccuracy, formatDate, formatScore } from '../format';

export function RecordsScreen({ onBack }: { onBack: () => void }) {
  const { records, refreshRecords, settings, sfx } = useApp();
  const [tab, setTab] = useState<'best' | 'recent'>('best');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        sfx('menuBack');
        onBack();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        sfx('menuMove');
        setTab((t) => (t === 'best' ? 'recent' : 'best'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, sfx]);

  return (
    <div className="screen records">
      <MenuBackground reducedMotion={settings.reducedMotion} accent="#3dc8ff" accent2="#ff3d8b" />
      <header className="screen-header">
        <button className="btn btn--ghost" onClick={() => (sfx('menuBack'), onBack())}>
          ← BACK
        </button>
        <h2 className="screen-header__title">RECORDS</h2>
        <div className="seg" role="tablist" aria-label="Record view">
          <button role="tab" aria-selected={tab === 'best'} className={tab === 'best' ? 'is-active' : ''} onClick={() => setTab('best')}>
            PERSONAL BESTS
          </button>
          <button role="tab" aria-selected={tab === 'recent'} className={tab === 'recent' ? 'is-active' : ''} onClick={() => setTab('recent')}>
            RECENT PLAYS
          </button>
        </div>
      </header>

      <div className="records__body">
        {tab === 'best' ? (
          <div className="records__songs">
            {SONGS.map((song) => (
              <article key={song.id} className="record-song" style={{ '--accent': song.theme.accent } as CSSProperties}>
                <header className="record-song__head">
                  <Jacket song={song} size="sm" />
                  <div>
                    <h3>{song.title}</h3>
                    <span>BPM {song.bpm}</span>
                  </div>
                </header>
                <table className="record-table">
                  <thead>
                    <tr>
                      <th>LEVEL</th>
                      <th>RANK</th>
                      <th>BEST SCORE</th>
                      <th>ACCURACY</th>
                      <th>MAX COMBO</th>
                      <th>PLAYS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableDifficulties(song).map((d) => {
                      const r = records.best[recordKey(song.id, d)];
                      const m = difficultyMeta(d);
                      return (
                        <tr key={d}>
                          <td style={{ color: m.color }}>
                            {m.label}
                            {r?.fullCombo && <span className="mini-badge">{r.allPerfect ? 'AP' : 'FC'}</span>}
                          </td>
                          <td>{r ? <RankBadge rank={r.bestRank} size="sm" /> : '—'}</td>
                          <td className="num">{r ? formatScore(r.bestScore) : '—'}</td>
                          <td className="num">{r ? formatAccuracy(r.bestAccuracy) : '—'}</td>
                          <td className="num">{r ? r.maxCombo : '—'}</td>
                          <td className="num">{r ? r.playCount : 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
        ) : records.recent.length === 0 ? (
          <p className="records__empty">NO PLAYS YET. GO SET A SCORE.</p>
        ) : (
          <table className="record-table record-table--recent">
            <thead>
              <tr>
                <th>SONG</th>
                <th>LEVEL</th>
                <th>RANK</th>
                <th>SCORE</th>
                <th>ACCURACY</th>
                <th>COMBO</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              {records.recent.map((r) => {
                const m = difficultyMeta(r.difficulty);
                return (
                  <tr key={`${r.playedAt}-${r.songId}-${r.difficulty}`}>
                    <td>{getSong(r.songId)?.title ?? r.songId}</td>
                    <td style={{ color: m.color }}>{m.label}</td>
                    <td>
                      <RankBadge rank={r.rank} size="sm" />
                    </td>
                    <td className="num">{formatScore(r.score)}</td>
                    <td className="num">{formatAccuracy(r.accuracy)}</td>
                    <td className="num">
                      {r.maxCombo}
                      {r.fullCombo && <span className="mini-badge">FC</span>}
                    </td>
                    <td className="num dim">{formatDate(r.playedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="records__note">Records are stored only in this browser (localStorage). Nothing is sent to a server.</p>
        <div className="records__danger">
          {confirming ? (
            <>
              <span>Delete every record?</span>
              <button
                className="btn btn--danger"
                onClick={() => {
                  resetRecords();
                  refreshRecords();
                  setConfirming(false);
                  sfx('menuBack');
                }}
              >
                YES, RESET
              </button>
              <button className="btn btn--ghost" onClick={() => setConfirming(false)}>
                CANCEL
              </button>
            </>
          ) : (
            <button className="btn btn--ghost btn--small" onClick={() => setConfirming(true)}>
              RESET RECORDS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
