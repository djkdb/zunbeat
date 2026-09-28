/**
 * Song clock. The source of truth is the AudioContext (what the player hears); the clock
 * is smoothed with performance.now() so the picture moves evenly even though
 * AudioContext.currentTime advances in coarse chunks. Without audio it falls back to
 * performance.now() alone.
 */
export class GameClock {
  private songAtAnchor = 0;
  private ctxAtAnchor = 0;
  private perfAtAnchor = 0;
  private smoothSong = 0;
  private smoothPerf = 0;
  private lastReturned = -Infinity;
  private pausedAt = 0;
  running = false;

  constructor(
    private ctx: AudioContext | null,
    /** Extra user calibration in seconds (positive = notes later). */
    private userOffset = 0,
  ) {}

  /** The song will be at `songTime` when the context reaches `ctxTime`. */
  start(songTime: number, ctxTime: number): void {
    this.songAtAnchor = songTime;
    this.ctxAtAnchor = ctxTime;
    this.perfAtAnchor = performance.now() / 1000 + (ctxTime - this.ctxNow());
    this.running = true;
    this.smoothPerf = performance.now() / 1000;
    this.smoothSong = this.raw();
    this.lastReturned = -Infinity;
  }

  pause(): number {
    this.pausedAt = this.now();
    this.running = false;
    return this.pausedAt;
  }

  private ctxNow(): number {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  /** Unsmoothed estimate of the song position currently reaching the speakers. */
  private raw(): number {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      return this.songAtAnchor + (performance.now() / 1000 - this.perfAtAnchor);
    }
    const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
    if (ts && ts.contextTime && ts.performanceTime) {
      const sincePerf = (performance.now() - ts.performanceTime) / 1000;
      return this.songAtAnchor + (ts.contextTime - this.ctxAtAnchor) + sincePerf;
    }
    const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    return this.songAtAnchor + (ctx.currentTime - this.ctxAtAnchor) - latency;
  }

  /** Current (heard) song time in seconds, adjusted by the user's offset. */
  now(): number {
    if (!this.running) return this.pausedAt;
    const perf = performance.now() / 1000;
    const predicted = this.smoothSong + (perf - this.smoothPerf);
    const actual = this.raw();
    const drift = actual - predicted;
    // Snap on big jumps (seek, hiccup); otherwise nudge towards the audio clock.
    const next = Math.abs(drift) > 0.05 ? actual : predicted + drift * 0.08;
    this.smoothSong = next;
    this.smoothPerf = perf;
    const t = Math.max(next, this.lastReturned);
    this.lastReturned = t;
    return t - this.userOffset;
  }

  /** Song time at which an input event (performance.now()-based timestamp in ms) happened. */
  timeAtEvent(eventTimeStampMs: number): number {
    const t = this.now();
    const ago = (performance.now() - eventTimeStampMs) / 1000;
    return ago > 0 && ago < 0.1 ? t - ago : t;
  }

  setUserOffset(seconds: number): void {
    this.userOffset = seconds;
  }
}
