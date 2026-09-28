import { forwardRef, useImperativeHandle, useRef } from 'react';
import { difficultyMeta } from '../../game/config/difficulty';
import type { DifficultyId, SongDefinition } from '../../game/types';
import type { HudRefs } from './HudController';

interface Props {
  song: SongDefinition;
  difficulty: DifficultyId;
  autoplay: boolean;
}

/** Static HUD markup. All live values are written by HudController through these refs. */
export const Hud = forwardRef<HudRefs, Props>(function Hud({ song, difficulty, autoplay }, ref) {
  const r = {
    root: useRef<HTMLDivElement>(null),
    score: useRef<HTMLSpanElement>(null),
    accuracy: useRef<HTMLSpanElement>(null),
    combo: useRef<HTMLDivElement>(null),
    comboNumber: useRef<HTMLSpanElement>(null),
    judgment: useRef<HTMLDivElement>(null),
    judgmentText: useRef<HTMLSpanElement>(null),
    fastSlow: useRef<HTMLSpanElement>(null),
    feverFill: useRef<HTMLDivElement>(null),
    feverLabel: useRef<HTMLSpanElement>(null),
    fever: useRef<HTMLDivElement>(null),
    progress: useRef<HTMLDivElement>(null),
    countdown: useRef<HTMLDivElement>(null),
    banner: useRef<HTMLDivElement>(null),
    finalBanner: useRef<HTMLDivElement>(null),
  };
  useImperativeHandle(ref, () => {
    // Only read after mount, when every ref is attached.
    const out = {} as Record<keyof HudRefs, HTMLElement>;
    for (const [k, v] of Object.entries(r)) out[k as keyof HudRefs] = v.current as HTMLElement;
    return out;
  });
  const meta = difficultyMeta(difficulty);

  return (
    <div className="hud" ref={r.root} data-fever="false">
      <div className="hud__progress">
        <div className="hud__progress-fill" ref={r.progress} />
      </div>
      <div className="hud__top">
        <div className="hud__song">
          <span className="hud__song-title">{song.title}</span>
          <span className="hud__diff" style={{ color: meta.color, borderColor: meta.color }}>
            {meta.label} {song.difficulties[difficulty]?.level}
          </span>
          {autoplay && <span className="hud__auto">AUTO</span>}
        </div>
        <div className="hud__score">
          <span className="hud__score-label">SCORE</span>
          <span className="hud__score-value">
            <span ref={r.score} />
          </span>
          <span className="hud__accuracy" ref={r.accuracy} />
        </div>
      </div>
      <div className="hud__fever" ref={r.fever} data-active="false">
        <span className="hud__fever-label" ref={r.feverLabel}>
          FEVER
        </span>
        <div className="hud__fever-track">
          <div className="hud__fever-fill" ref={r.feverFill} />
        </div>
      </div>

      <div className="hud__combo" ref={r.combo} data-visible="false" data-tier="0" aria-live="off">
        <span className="hud__combo-number" ref={r.comboNumber}>
          0
        </span>
        <span className="hud__combo-label">COMBO</span>
      </div>
      <div className="hud__judgment" ref={r.judgment} data-judgment="perfect">
        <span className="hud__judgment-text" ref={r.judgmentText} />
        <span className="hud__fastslow" ref={r.fastSlow} />
      </div>
      <div className="hud__countdown" ref={r.countdown} />
      <div className="hud__banner" ref={r.banner} />
      <div className="hud__final" ref={r.finalBanner} />
    </div>
  );
});
