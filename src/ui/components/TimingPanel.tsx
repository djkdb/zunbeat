import { useState } from 'react';
import { JUDGMENT_WINDOWS } from '../../game/config/judgment';
import { suggestedOffset } from '../../game/engine/timing';
import type { TimingSummary } from '../../game/types';
import { OFFSET_LIMIT_MS } from '../../storage/settings';
import { useApp } from '../appContext';

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v))}`;

function zone(centerMs: number): string {
  const a = Math.abs(centerMs) / 1000;
  if (a <= JUDGMENT_WINDOWS.perfect) return 'perfect';
  if (a <= JUDGMENT_WINDOWS.great) return 'great';
  if (a <= JUDGMENT_WINDOWS.good) return 'good';
  return 'miss';
}

/** Press-timing histogram with a one-tap audio offset fix when the player is consistently off. */
export function TimingPanel({ timing, autoplay }: { timing: TimingSummary; autoplay: boolean }) {
  const { settings, updateSettings, sfx } = useApp();
  const [applied, setApplied] = useState<number | null>(null);
  if (autoplay || timing.samples === 0) return null;
  const peak = Math.max(1, ...timing.histogram);
  const suggestion = suggestedOffset(timing, OFFSET_LIMIT_MS);
  const late = timing.meanMs > 0;
  const tendency = Math.abs(timing.meanMs) < 10 ? 'ON TIME' : late ? 'LATE' : 'EARLY';
  const alreadySet = suggestion !== null && settings.offsetMs === suggestion;

  return (
    <div className="timing" aria-label="Timing analysis">
      <div className="timing__head">
        <span className="stat__label">TIMING</span>
        <b className={`timing__avg timing__avg--${tendency === 'ON TIME' ? 'ok' : late ? 'late' : 'early'}`}>
          {signed(timing.meanMs)} ms
        </b>
        <span className="timing__tendency">{tendency}</span>
      </div>
      <div className="timing__hist" aria-hidden="true">
        {timing.histogram.map((count, i) => {
          const center = -timing.rangeMs + (i + 0.5) * timing.binMs;
          return <i key={i} className={`timing__bar timing__bar--${zone(center)}`} style={{ height: `${Math.max(4, (count / peak) * 100)}%`, opacity: count ? 1 : 0.25 }} />;
        })}
        <span className="timing__zero" />
      </div>
      <div className="timing__axis" aria-hidden="true">
        <span>EARLY</span>
        <span>0</span>
        <span>LATE</span>
      </div>
      {suggestion !== null && applied === null && !alreadySet && (
        <div className="timing__fix">
          <p>
            You hit {Math.abs(Math.round(timing.meanMs))} ms {late ? 'late' : 'early'} on average
            {late && timing.meanMs > 60 ? ' — common with Bluetooth audio.' : '.'}
          </p>
          <button
            className="btn btn--primary btn--small"
            onClick={() => {
              updateSettings({ offsetMs: suggestion });
              setApplied(suggestion);
              sfx('menuSelect');
            }}
          >
            FIX SYNC · OFFSET {signed(suggestion)} MS
          </button>
        </div>
      )}
      {(applied !== null || alreadySet) && (
        <p className="timing__done">AUDIO OFFSET {signed(applied ?? settings.offsetMs)} MS · RETRY TO FEEL IT</p>
      )}
    </div>
  );
}
