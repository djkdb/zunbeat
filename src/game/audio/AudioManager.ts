import type { SongDefinition } from '../types';
import { renderComposition, type RenderedAudio } from './synth/renderSong';
import { SFX_NAMES, renderSfx, type SfxName } from './synth/renderSfx';

const RENDER_SAMPLE_RATE = 44100;
/** Rendered songs kept in memory (each is ~30 MB); enough for every built-in song. */
const SONG_CACHE_SIZE = 3;

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

export interface MusicHandle {
  stop(fadeSeconds?: number): void;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  error?: string;
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
}

/**
 * Owns the AudioContext and the three volume buses (master ← music, master ← sfx).
 * Everything is failure tolerant: if Web Audio is missing or blocked the game keeps
 * running silently and `available` stays false.
 */
export class AudioManager {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private sfx = new Map<SfxName, AudioBuffer>();
  private songs = new Map<string, Promise<AudioBuffer | null>>();
  private worker: Worker | null = null;
  private workerFailed = false;
  private pending = new Map<number, (r: WorkerResponse) => void>();
  private nextId = 1;
  private volumes: Volumes = { master: 0.8, music: 0.8, sfx: 0.7 };
  private preview: { source: AudioBufferSourceNode; gain: GainNode; songId: string } | null = null;
  private previewToken = 0;
  failedReason: string | null = null;

  get available(): boolean {
    return this.ctx !== null;
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Create (if needed) and resume the context. Call from a user gesture. */
  unlock(): void {
    if (!this.ctx) this.create();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    // iOS needs a sound started inside the gesture.
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start();
    } catch {
      /* ignore */
    }
  }

  private create(): void {
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio is not supported');
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.master = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.12;
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(limiter).connect(ctx.destination);
      this.ctx = ctx;
      this.applyVolumes();
      for (const name of SFX_NAMES) {
        const data = renderSfx(name, ctx.sampleRate);
        const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
        buffer.copyToChannel(data, 0);
        this.sfx.set(name, buffer);
      }
    } catch (err) {
      this.failedReason = err instanceof Error ? err.message : String(err);
      this.ctx = null;
    }
  }

  setVolumes(v: Volumes): void {
    this.volumes = v;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    // Squared curve feels closer to perceived loudness than linear.
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master ** 2, now, 0.02);
    this.musicBus.gain.setTargetAtTime(this.volumes.music ** 2, now, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx ** 2 * 0.9, now, 0.02);
  }

  now(): number {
    return this.ctx?.currentTime ?? performance.now() / 1000;
  }

  playSfx(name: SfxName, options: { when?: number; gain?: number; rate?: number } = {}): void {
    const ctx = this.ctx;
    const buffer = this.sfx.get(name);
    if (!ctx || !buffer || !this.sfxBus || ctx.state !== 'running') return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      if (options.rate) src.playbackRate.value = options.rate;
      let node: AudioNode = src;
      if (options.gain !== undefined && options.gain !== 1) {
        const g = ctx.createGain();
        g.gain.value = options.gain;
        src.connect(g);
        node = g;
      }
      node.connect(this.sfxBus);
      src.onended = () => {
        src.disconnect();
        if (node !== src) node.disconnect();
      };
      src.start(options.when ?? 0);
    } catch {
      /* ignore */
    }
  }

  /** Render (or fetch from cache) the audio for a song. Resolves to null if audio is unavailable. */
  loadSong(song: SongDefinition): Promise<AudioBuffer | null> {
    const cached = this.songs.get(song.id);
    if (cached) {
      // refresh LRU position
      this.songs.delete(song.id);
      this.songs.set(song.id, cached);
      return cached;
    }
    const promise = this.renderSong(song).catch((err) => {
      console.warn('[audio] song render failed', err);
      this.songs.delete(song.id);
      return null;
    });
    this.songs.set(song.id, promise);
    while (this.songs.size > SONG_CACHE_SIZE) {
      const oldest = this.songs.keys().next().value as string;
      if (this.preview?.songId === oldest) break;
      this.songs.delete(oldest);
    }
    return promise;
  }

  private async renderSong(song: SongDefinition): Promise<AudioBuffer | null> {
    if (!this.ctx) this.create();
    const ctx = this.ctx;
    if (!ctx) return null;
    const audio = await this.renderInWorker(song).catch(async (err) => {
      console.warn('[audio] worker render failed, falling back to main thread', err);
      await new Promise((r) => setTimeout(r, 30));
      return renderComposition(song.composition, RENDER_SAMPLE_RATE);
    });
    const buffer = ctx.createBuffer(2, audio.left.length, audio.sampleRate);
    buffer.copyToChannel(audio.left as Float32Array<ArrayBuffer>, 0);
    buffer.copyToChannel(audio.right as Float32Array<ArrayBuffer>, 1);
    return buffer;
  }

  private renderInWorker(song: SongDefinition): Promise<RenderedAudio> {
    if (this.workerFailed || typeof Worker === 'undefined') return Promise.reject(new Error('no worker'));
    if (!this.worker) {
      try {
        this.worker = new Worker(new URL('./songRender.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const cb = this.pending.get(e.data.id);
          this.pending.delete(e.data.id);
          cb?.(e.data);
        };
        this.worker.onerror = (e) => {
          console.warn('[audio] worker error', e.message);
          this.workerFailed = true;
          for (const cb of this.pending.values()) cb({ id: 0, ok: false, error: 'worker crashed' } as WorkerResponse);
          this.pending.clear();
          this.worker?.terminate();
          this.worker = null;
        };
      } catch (err) {
        this.workerFailed = true;
        return Promise.reject(err);
      }
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (r) => {
        if (r.ok) resolve({ sampleRate: r.sampleRate, left: r.left, right: r.right });
        else reject(new Error(r.error));
      });
      this.worker!.postMessage({ id, composition: song.composition, sampleRate: RENDER_SAMPLE_RATE });
    });
  }

  /**
   * Start music so that buffer position `offset` plays at context time `when`.
   * If `when` is in the past, playback starts immediately at the matching later position.
   */
  playMusic(buffer: AudioBuffer, when: number, offset: number, fadeIn = 0): MusicHandle {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return { stop: () => undefined };
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    src.connect(gain).connect(this.musicBus);
    let startAt = when;
    let startOffset = offset;
    if (startOffset < 0) {
      startAt = when - startOffset;
      startOffset = 0;
    }
    const now = ctx.currentTime;
    if (startAt < now) {
      startOffset += now - startAt;
      startAt = now;
    }
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(1, startAt + fadeIn);
    }
    src.start(startAt, Math.min(startOffset, buffer.duration));
    let stopped = false;
    return {
      stop: (fade = 0) => {
        if (stopped) return;
        stopped = true;
        const t = ctx.currentTime;
        try {
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(gain.gain.value, t);
          if (fade > 0) gain.gain.linearRampToValueAtTime(0, t + fade);
          src.stop(t + fade + 0.01);
        } catch {
          /* already stopped */
        }
        src.onended = () => {
          src.disconnect();
          gain.disconnect();
        };
      },
    };
  }

  /** Loop a section of a song for the song-select preview. */
  async playPreview(song: SongDefinition): Promise<void> {
    const token = ++this.previewToken;
    this.stopPreview();
    const buffer = await this.loadSong(song);
    const ctx = this.ctx;
    if (!buffer || !ctx || !this.musicBus || token !== this.previewToken) return;
    const spb = 60 / song.bpm;
    const start = song.offset + song.previewBeat * spb;
    const end = Math.min(buffer.duration - 0.5, start + 32 * spb);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = start;
    src.loopEnd = end;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 0.8);
    src.connect(gain).connect(this.musicBus);
    src.start(ctx.currentTime, start);
    this.preview = { source: src, gain, songId: song.id };
  }

  stopPreview(fade = 0.35): void {
    this.previewToken++;
    const p = this.preview;
    const ctx = this.ctx;
    this.preview = null;
    if (!p || !ctx) return;
    const t = ctx.currentTime;
    try {
      p.gain.gain.cancelScheduledValues(t);
      p.gain.gain.setValueAtTime(p.gain.gain.value, t);
      p.gain.gain.linearRampToValueAtTime(0, t + fade);
      p.source.stop(t + fade + 0.02);
    } catch {
      /* ignore */
    }
    p.source.onended = () => {
      p.source.disconnect();
      p.gain.disconnect();
    };
  }

  /** Output latency estimate in seconds (what the player hears lags currentTime by this). */
  outputLatency(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  }
}

export const audio = new AudioManager();
