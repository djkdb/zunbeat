import type { GameEngine, GamePresenter } from '../../game/engine/GameEngine';

/** Live debug readout. Updated imperatively at ~10 Hz from the engine frame. */
export class DebugPresenter implements GamePresenter {
  private el: HTMLPreElement | null = null;
  private last = 0;

  attach(el: HTMLPreElement | null): void {
    this.el = el;
    this.last = 0;
  }

  frame(engine: GameEngine, t: number): void {
    const now = performance.now();
    if (!this.el || now - this.last < 100) return;
    this.last = now;
    const s = engine.score;
    const section = engine.analysis.sections[engine.sectionIndex];
    this.el.textContent = [
      `SONG     ${engine.song.title} / ${engine.difficulty}`,
      `PHASE    ${engine.phase}${engine.autoplay ? ' (AUTO)' : ''}`,
      `TIME     ${t.toFixed(3)}s  beat ${(t / engine.spb).toFixed(2)}`,
      `BPM      ${engine.chart.bpm}   SECTION ${section?.name ?? '-'}`,
      `COMBO    ${s.combo}  (max ${s.maxCombo})`,
      `SCORE    ${s.score} / ${engine.maxScore}`,
      `ACCURACY ${s.accuracy.toFixed(2)}%`,
      `JUDGED   P${s.counts.perfect} G${s.counts.great} g${s.counts.good} M${s.counts.miss}  (${s.judged}/${s.totalJudgments})`,
      `FEVER    ${s.feverActive ? 'ACTIVE' : 'charge'} ${(s.feverLevel(t) * 100).toFixed(0)}%`,
      `NOTE IDX ${engine.judge.nextPendingAny()}  / ${engine.notes.length}`,
      `AUDIO    ${engine.hasAudio ? 'synced' : 'silent (perf clock)'}`,
    ].join('\n');
  }
}
