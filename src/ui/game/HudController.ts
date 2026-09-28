import { COMBO_DISPLAY_MIN, comboTier } from '../../game/config/combo';
import { FAST_SLOW_THRESHOLD, JUDGMENT_LABEL } from '../../game/config/judgment';
import { SCORING } from '../../game/config/scoring';
import type { GameEngine, GamePresenter, JudgmentPresentation } from '../../game/engine/GameEngine';
import type { Layout } from '../../game/render/layout';

export interface HudRefs {
  root: HTMLElement;
  score: HTMLElement;
  accuracy: HTMLElement;
  combo: HTMLElement;
  comboNumber: HTMLElement;
  judgment: HTMLElement;
  judgmentText: HTMLElement;
  fastSlow: HTMLElement;
  feverFill: HTMLElement;
  feverLabel: HTMLElement;
  fever: HTMLElement;
  progress: HTMLElement;
  countdown: HTMLElement;
  banner: HTMLElement;
  finalBanner: HTMLElement;
}

/**
 * Imperative HUD: writes straight to DOM nodes and uses the Web Animations API, so
 * combo/score/judgment updates never re-render React.
 */
export class HudController implements GamePresenter {
  private displayedScore = 0;
  private shownScoreText = '';
  private shownAccuracy = '';
  private shownProgress = -1;
  private shownFever = -1;
  private feverActive = false;
  private tier = -1;

  constructor(
    private refs: HudRefs,
    private options: { reducedMotion: boolean; showFastSlow: boolean },
  ) {
    this.renderScore(0);
    this.refs.accuracy.textContent = '100.00%';
  }

  /** Align HUD elements with the canvas highway. */
  applyLayout(l: Layout): void {
    const s = this.refs.root.style;
    s.setProperty('--judge-y', `${l.judgeY}px`);
    s.setProperty('--highway-w', `${l.baseWidth}px`);
    s.setProperty('--lane-w', `${l.laneWidth}px`);
    s.setProperty('--top-y', `${l.topY}px`);
    s.setProperty('--highway-left', `${l.centerX - l.baseWidth / 2}px`);
    // Beside the highway when there is room, otherwise below the judge line.
    this.refs.root.dataset.layout = (l.width - l.baseWidth) / 2 >= 200 ? 'side' : 'bottom';
  }

  /**
   * Runs a multi-stage keyframe animation. `easing` shapes only the first (entry) segment;
   * the timeline itself stays linear so later stages (hold, fade) keep their offsets.
   */
  private pop(
    el: HTMLElement,
    keyframes: Keyframe[],
    duration: number,
    easing = 'cubic-bezier(.2,.9,.3,1.3)',
    fill: FillMode = 'none',
  ): void {
    if (this.options.reducedMotion) {
      const last = keyframes.at(-1)?.opacity ?? 1;
      el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: last }], { duration, fill });
      return;
    }
    const [first, ...rest] = keyframes;
    el.animate([{ easing, ...first }, ...rest], { duration, fill });
  }

  frame(engine: GameEngine, t: number, dt: number): void {
    const target = engine.score.score;
    if (this.displayedScore !== target) {
      const diff = target - this.displayedScore;
      this.displayedScore = Math.abs(diff) < 2 ? target : this.displayedScore + diff * Math.min(1, dt * 14);
      this.renderScore(Math.round(this.displayedScore));
    }
    const acc = `${engine.score.accuracy.toFixed(2)}%`;
    if (acc !== this.shownAccuracy) {
      this.shownAccuracy = acc;
      this.refs.accuracy.textContent = acc;
    }
    const progress = Math.max(0, Math.min(1, t / Math.max(1, engine.visibleSongEnd)));
    const p = Math.round(progress * 500) / 500;
    if (p !== this.shownProgress) {
      this.shownProgress = p;
      this.refs.progress.style.transform = `scaleX(${p})`;
    }
    const fever = Math.round(engine.score.feverLevel(t) * 200) / 200;
    if (fever !== this.shownFever) {
      this.shownFever = fever;
      this.refs.feverFill.style.transform = `scaleX(${fever})`;
    }
    if (engine.score.feverActive !== this.feverActive) {
      this.feverActive = engine.score.feverActive;
      this.refs.fever.dataset.active = String(this.feverActive);
      this.refs.feverLabel.textContent = this.feverActive ? `FEVER ×${SCORING.feverMultiplier}` : 'FEVER';
      this.refs.root.dataset.fever = String(this.feverActive);
    }
  }

  private renderScore(value: number): void {
    const text = String(Math.max(0, value));
    if (text === this.shownScoreText) return;
    this.shownScoreText = text;
    this.refs.score.textContent = text.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  judgment(e: JudgmentPresentation): void {
    const { judgment, judgmentText, fastSlow } = this.refs;
    judgment.dataset.judgment = e.judgment;
    judgmentText.textContent = e.kind === 'tail' && e.judgment === 'miss' ? 'BREAK' : JUDGMENT_LABEL[e.judgment];
    const showFs = this.options.showFastSlow && e.judgment !== 'perfect' && e.judgment !== 'miss' && Math.abs(e.offset) > FAST_SLOW_THRESHOLD;
    fastSlow.textContent = showFs ? (e.offset < 0 ? 'FAST' : 'SLOW') : '';
    fastSlow.dataset.dir = e.offset < 0 ? 'fast' : 'slow';
    if (e.judgment === 'miss') {
      this.pop(
        judgment,
        [
          { transform: 'translateY(-6px) scale(1.15)', opacity: 1 },
          { transform: 'translateY(8px) scale(1)', opacity: 1, offset: 0.6 },
          { transform: 'translateY(14px) scale(0.95)', opacity: 0 },
        ],
        520,
        'ease-out',
      );
    } else {
      const big = e.judgment === 'perfect' ? 1.3 : 1.15;
      this.pop(
        judgment,
        [
          { transform: `scale(${big})`, opacity: 1, filter: 'brightness(2)' },
          { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)', offset: 0.25 },
          { transform: 'scale(1)', opacity: 1, offset: 0.8 },
          { transform: 'scale(0.96)', opacity: 0 },
        ],
        e.judgment === 'perfect' ? 560 : 480,
      );
    }
    this.updateCombo(e.combo, e.comboBroken);
  }

  private updateCombo(combo: number, broken: boolean): void {
    const { combo: el, comboNumber } = this.refs;
    if (broken) {
      el.dataset.visible = 'false';
      el.dataset.broken = 'true';
      this.tier = -1;
      return;
    }
    if (combo < COMBO_DISPLAY_MIN) {
      el.dataset.visible = 'false';
      return;
    }
    el.dataset.visible = 'true';
    el.dataset.broken = 'false';
    comboNumber.textContent = String(combo);
    const tier = comboTier(combo);
    if (tier !== this.tier) {
      this.tier = tier;
      el.dataset.tier = String(tier);
    }
    const s = 1.12 + tier * 0.04;
    this.pop(comboNumber, [{ transform: `scale(${s})` }, { transform: 'scale(1)' }], 160, 'ease-out');
  }

  milestone(combo: number): void {
    this.showBanner(`${combo} COMBO!`, combo >= 100 ? 'big' : 'normal');
  }

  feverStart(): void {
    this.showBanner('FEVER!!', 'fever');
  }

  countdown(value: 3 | 2 | 1 | 'GO' | 'READY'): void {
    const el = this.refs.countdown;
    el.textContent = String(value);
    el.dataset.kind = typeof value === 'number' ? 'number' : value.toLowerCase();
    const dur = value === 'READY' ? 900 : value === 'GO' ? 700 : 520;
    this.pop(
      el,
      [
        { transform: 'scale(2.2)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1, offset: 0.2 },
        { transform: 'scale(1.05)', opacity: 1, offset: 0.75, easing: 'ease-in' },
        { transform: 'scale(0.85)', opacity: 0 },
      ],
      dur,
      'cubic-bezier(.2,.9,.3,1)',
    );
  }

  finish(banner: 'ALL PERFECT' | 'FULL COMBO' | 'CLEAR'): void {
    this.refs.root.dataset.finished = 'true';
    const el = this.refs.finalBanner;
    el.textContent = banner;
    el.dataset.kind = banner === 'CLEAR' ? 'clear' : banner === 'FULL COMBO' ? 'fc' : 'ap';
    this.pop(
      el,
      [
        { transform: 'scaleX(0.2) scaleY(1.6)', opacity: 0, letterSpacing: '0.6em' },
        { transform: 'scale(1.08)', opacity: 1, letterSpacing: '0.06em', offset: 0.15 },
        { transform: 'scale(1)', opacity: 1, offset: 0.88 },
        { transform: 'scale(1.1)', opacity: 0 },
      ],
      2400,
      'cubic-bezier(.2,.9,.3,1)',
      'forwards',
    );
  }

  private showBanner(text: string, kind: 'normal' | 'big' | 'fever'): void {
    const el = this.refs.banner;
    el.textContent = text;
    el.dataset.kind = kind;
    this.pop(
      el,
      [
        { transform: 'translateX(-40%) skewX(-18deg)', opacity: 0 },
        { transform: 'translateX(0) skewX(-8deg) scale(1.1)', opacity: 1, offset: 0.14 },
        { transform: 'translateX(2%) skewX(-8deg) scale(1)', opacity: 1, offset: 0.8, easing: 'ease-in' },
        { transform: 'translateX(40%) skewX(-18deg)', opacity: 0 },
      ],
      kind === 'fever' ? 1500 : 1100,
      'cubic-bezier(.2,.8,.2,1)',
    );
  }
}
