import type { GamePresenter, JudgmentPresentation } from '../engine/GameEngine';
import type { AudioManager } from './AudioManager';

/** Maps gameplay events to sound effects. */
export class SoundPresenter implements GamePresenter {
  private lastHitAt = 0;

  constructor(private audio: AudioManager) {}

  judgment(e: JudgmentPresentation): void {
    if (e.kind === 'tail' || (e.kind === 'roll' && e.judgment !== 'miss')) return; // own sounds
    const now = performance.now();
    // Chords trigger several hits in one frame; soften the stack.
    const stacked = now - this.lastHitAt < 8;
    this.lastHitAt = now;
    const gain = stacked ? 0.55 : 1;
    switch (e.judgment) {
      case 'perfect':
        this.audio.playSfx('hitPerfect', { gain: gain * (e.fever ? 1.1 : 1), rate: e.fever ? 1.06 : 1 });
        break;
      case 'great':
        this.audio.playSfx('hitGreat', { gain });
        break;
      case 'good':
        this.audio.playSfx('hitGood', { gain });
        break;
      case 'miss':
        this.audio.playSfx('miss', { gain: e.comboBroken ? 0.8 : 0.45 });
        break;
    }
  }

  rollHit(_lane: number, hits: number, target: number): void {
    // Pitch climbs as the roll fills up; a chime when the target is reached.
    this.audio.playSfx('hitGreat', { gain: 0.4, rate: 0.9 + Math.min(1.5, hits / target) * 0.3 });
    if (hits === target) this.audio.playSfx('holdComplete', { gain: 0.5 });
  }

  holdComplete(): void {
    this.audio.playSfx('holdComplete', { gain: 0.6 });
  }

  holdBreak(): void {
    this.audio.playSfx('holdBreak', { gain: 0.7 });
  }

  milestone(combo: number): void {
    this.audio.playSfx('milestone', { gain: combo >= 100 ? 0.8 : 0.55 });
  }

  feverStart(): void {
    this.audio.playSfx('fever', { gain: 0.75 });
  }

  finish(): void {
    this.audio.playSfx('milestone', { gain: 0.7, rate: 0.75 });
  }
}
