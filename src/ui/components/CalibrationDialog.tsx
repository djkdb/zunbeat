import { useEffect, useRef, useState } from 'react';
import { audio } from '../../game/audio/AudioManager';
import { GameClock } from '../../game/engine/GameClock';
import { OFFSET_LIMIT_MS } from '../../storage/settings';

const BPM = 100;
const SPB = 60 / BPM;
const COUNT_IN = 4;
const TAPS_NEEDED = 16;
const TOTAL_BEATS = COUNT_IN + TAPS_NEEDED + 8;

interface Props {
  currentOffset: number;
  onApply: (offsetMs: number) => void;
  onClose: () => void;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Tap-along latency calibration: a metronome plays on the audio clock, the player taps
 * each beat, and the median tap error (measured on the same "heard time" clock the game
 * uses) becomes the suggested audio offset.
 */
export function CalibrationDialog({ currentOffset, onApply, onClose }: Props) {
  const [taps, setTaps] = useState<number[]>([]);
  const [run, setRun] = useState(0);
  const pulseRef = useRef<HTMLDivElement>(null);
  const beatRef = useRef<HTMLSpanElement>(null);
  const done = taps.length >= TAPS_NEEDED;
  const unavailable = !audio.running;

  useEffect(() => {
    if (unavailable) return;
    const ctx = audio.ctx!;
    const clock = new GameClock(ctx, 0);
    const startAt = ctx.currentTime + 0.4;
    clock.start(0, startAt);
    audio.stopPreview(0.1);
    const cancels = Array.from({ length: TOTAL_BEATS }, (_, k) =>
      audio.playSfx(k % 4 === 0 ? 'countGo' : 'countTick', { when: startAt + k * SPB, gain: k % 4 === 0 ? 0.55 : 0.7 }),
    );
    let collected = 0;
    const onTap = (timeStamp: number) => {
      const t = clock.timeAtEvent(timeStamp);
      const k = Math.round(t / SPB);
      if (k < COUNT_IN || k >= TOTAL_BEATS || collected >= TAPS_NEEDED) return;
      const errMs = (t - k * SPB) * 1000;
      if (Math.abs(errMs) > (SPB * 1000) / 2 - 20) return;
      collected++;
      setTaps((prev) => [...prev, errMs]);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.code === 'Escape' || e.code === 'Tab') return;
      e.preventDefault();
      e.stopPropagation();
      onTap(e.timeStamp);
    };
    const onPointer = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      onTap(e.timeStamp);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer);
    let raf = 0;
    const draw = () => {
      const t = clock.now();
      const beat = t / SPB;
      const phase = beat - Math.floor(beat);
      const k = Math.floor(beat);
      if (pulseRef.current) {
        const p = t < 0 ? 0 : Math.exp(-phase * 6);
        pulseRef.current.style.transform = `scale(${1 + p * 0.35})`;
        pulseRef.current.style.opacity = String(0.35 + p * 0.65);
      }
      if (beatRef.current) beatRef.current.textContent = t < 0 ? '' : k < COUNT_IN ? String(COUNT_IN - k) : 'TAP';
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancels.forEach((c) => c());
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [run, unavailable]);

  const result = taps.length ? median(taps) : 0;
  const suggested = Math.max(-OFFSET_LIMIT_MS, Math.min(OFFSET_LIMIT_MS, Math.round(result / 5) * 5));
  const spread = taps.length > 3 ? median(taps.map((v) => Math.abs(v - result))) : 0;

  return (
    <div className="calib" role="dialog" aria-modal="true" aria-label="Audio offset calibration">
      <div className="calib__panel">
        <h3>SYNC CALIBRATION</h3>
        {unavailable ? (
          <p className="calib__text">Audio is not available, so there is nothing to calibrate.</p>
        ) : (
          <>
            <p className="calib__text">
              Tap any key or the screen on every beat you <b>hear</b>. Listen, don&apos;t watch.
            </p>
            <div className="calib__pad">
              <div className="calib__pulse" ref={pulseRef} />
              <span className="calib__beat" ref={beatRef} />
            </div>
            <div className="calib__progress" aria-live="polite">
              {done ? 'DONE' : `TAPS ${taps.length} / ${TAPS_NEEDED}`}
              {taps.length > 0 && !done && <span> · LAST {Math.round(taps[taps.length - 1])} MS</span>}
            </div>
            {done && (
              <div className="calib__result">
                <span className="stat__label">SUGGESTED OFFSET</span>
                <b>
                  {suggested > 0 ? '+' : ''}
                  {suggested} MS
                </b>
                <span className="calib__note">
                  current {currentOffset > 0 ? '+' : ''}
                  {currentOffset} ms · consistency ±{Math.round(spread)} ms
                </span>
              </div>
            )}
          </>
        )}
        <div className="calib__actions">
          {done && (
            <button className="btn btn--primary" onClick={() => onApply(suggested)}>
              APPLY
            </button>
          )}
          {!unavailable && (
            <button
              className="btn btn--ghost"
              onClick={() => {
                setTaps([]);
                setRun((r) => r + 1);
              }}
            >
              {done ? 'AGAIN' : 'RESTART'}
            </button>
          )}
          <button className="btn btn--ghost" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
