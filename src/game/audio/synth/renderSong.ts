import { mulberry32 } from './dsp';
import { applyPingPong, applyReverb } from './effects';
import * as inst from './instruments';
import {
  DEFAULT_SOUND,
  chordLookup,
  drumSteps,
  expandMelodic,
  parseChord,
  rollSteps,
  type Composition,
} from './music';

export interface RenderedAudio {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
}

const TAIL_SECONDS = 2.5;
const DUCK_BLOCK = 64;
const TARGET_RMS = 0.25;

/**
 * Render a whole composition to stereo PCM. Pure and deterministic: runs in a worker in
 * the browser and in Node for tests. Beat 0 is sample 0.
 */
export function renderComposition(
  comp: Composition,
  sampleRate = 44100,
  seed = 1,
  onProgress?: (fraction: number) => void,
): RenderedAudio {
  const sr = sampleRate;
  const sound = { ...DEFAULT_SOUND, ...comp.sound };
  const rng = mulberry32(seed);
  const spb = 60 / comp.bpm;
  const stepSec = spb / 4;
  const totalBeats = comp.sections.reduce((n, s) => n + s.bars * 4, 0);
  const length = Math.ceil((totalBeats * spb + TAIL_SECONDS) * sr);

  const L = new Float32Array(length);
  const R = new Float32Array(length);
  const revSend = new Float32Array(length);
  const delSend = new Float32Array(length);

  // ---- sidechain envelope from kick positions
  const kickTimes: number[] = [];
  {
    let beat = 0;
    for (const s of comp.sections) {
      if (s.kick) {
        const d = drumSteps(s.kick);
        for (let i = 0; i < s.bars * 16; i++) if (d[i % d.length] === 'x') kickTimes.push((beat + i / 4) * spb);
      }
      beat += s.bars * 4;
    }
  }
  const duck = new Float32Array(Math.ceil(length / DUCK_BLOCK) + 1).fill(1);
  {
    const release = spb * 0.75;
    let k = 0;
    for (let b = 0; b < duck.length; b++) {
      const t = (b * DUCK_BLOCK) / sr;
      while (k + 1 < kickTimes.length && kickTimes[k + 1] <= t) k++;
      if (kickTimes.length && kickTimes[k] <= t) {
        const d = t - kickTimes[k];
        if (d < release) {
          const x = 1 - d / release;
          const attack = Math.min(1, d / 0.004);
          duck[b] = 1 - sound.sidechain * x * x * attack;
        }
      }
    }
  }
  const duckAt = (i: number) => duck[(i / DUCK_BLOCK) | 0];

  interface MixOpts {
    gain: number;
    pan?: number;
    rev?: number;
    del?: number;
    ducked?: boolean;
  }
  const mix = (voice: Float32Array | inst.Voice, startSec: number, o: MixOpts) => {
    const left = voice instanceof Float32Array ? voice : voice.left;
    const right = voice instanceof Float32Array ? voice : (voice.right ?? voice.left);
    const start = Math.round(startSec * sr);
    const pan = o.pan ?? 0;
    const gl = o.gain * Math.min(1, 1 - pan);
    const gr = o.gain * Math.min(1, 1 + pan);
    const rev = o.rev ?? 0;
    const del = o.del ?? 0;
    const n = Math.min(left.length, length - start);
    for (let i = 0; i < n; i++) {
      const idx = start + i;
      if (idx < 0) continue;
      const g = o.ducked ? duckAt(idx) : 1;
      const l = left[i] * gl * g;
      const r = right[i] * gr * g;
      L[idx] += l;
      R[idx] += r;
      if (rev) revSend[idx] += (l + r) * rev;
      if (del) delSend[idx] += (l + r) * del;
    }
  };

  // ---- one-shot drum samples
  const kickSample = inst.kick(sr, sound.kickTune, sound.kickDrive);
  const snareSample = inst.snare(sr, rng);
  const clapSample = inst.clap(sr, rng);
  const hatClosed = inst.hat(sr, rng, false);
  const hatOpen = inst.hat(sr, rng, true);
  const crashSample = inst.crash(sr, rng);
  const impactSample = inst.impact(sr, rng);

  const pluckCache = new Map<string, Float32Array>();
  const bassCache = new Map<string, Float32Array>();

  let beat = 0;
  let sectionIndex = 0;
  for (const s of comp.sections) {
    onProgress?.((0.8 * sectionIndex++) / comp.sections.length);
    const startSec = beat * spb;
    const steps = s.bars * 16;
    const tone = s.tone ?? 1;
    const chordAt = chordLookup(s);
    const at = (step: number) => startSec + step * stepSec;

    const drum = (pattern: string | undefined, sample: Float32Array, gain: number, pan = 0, rev = 0) => {
      if (!pattern) return;
      const d = drumSteps(pattern);
      for (let i = 0; i < steps; i++) {
        const c = d[i % d.length];
        if (c === 'x') mix(sample, at(i), { gain, pan, rev });
        else if (c === 'g') mix(sample, at(i), { gain: gain * 0.35, pan, rev });
      }
    };
    drum(s.kick, kickSample, 0.95);
    drum(s.snare, snareSample, 0.55, 0, 0.25 * sound.reverb);
    drum(s.clap, clapSample, 0.5, 0.05, 0.3 * sound.reverb);
    drum(s.hat, hatClosed, 0.32 * sound.hatLevel, 0.25);
    drum(s.openHat, hatOpen, 0.3 * sound.hatLevel, -0.2);
    if (s.roll) {
      const list = rollSteps(steps);
      list.forEach((step, n) => mix(snareSample, at(step), { gain: 0.2 + 0.4 * (n / list.length), rev: 0.2 }));
    }
    if (s.crash) mix(crashSample, startSec, { gain: 0.6, rev: 0.2 * sound.reverb });
    if (s.impact) mix(impactSample, startSec, { gain: 0.75, rev: 0.3 * sound.reverb });
    if (s.riser) {
      const dur = steps * stepSec;
      mix(inst.riser(sr, rng, dur), startSec, { gain: 0.5, rev: 0.3 * sound.reverb });
    }

    if (s.pad && s.chords?.length) {
      const chords = s.chords.map(parseChord);
      for (let b = 0; b < s.bars; b++) {
        const notes = chords[b % chords.length];
        mix(inst.pad(sr, notes, 16 * stepSec, tone, rng), at(b * 16), {
          gain: 1,
          rev: 0.45 * sound.reverb,
          ducked: true,
        });
      }
    }
    if (s.bass) {
      for (const e of expandMelodic(s.bass, steps, chordAt, 'bass')) {
        const dur = e.lengthSteps * stepSec * 0.92;
        const key = `${e.midi}:${e.lengthSteps}:${tone}`;
        let v = bassCache.get(key);
        if (!v) {
          v = inst.bass(sr, e.midi, dur, tone, sound.bassDrive);
          bassCache.set(key, v);
        }
        mix(v, at(e.step), { gain: 0.9, ducked: true });
      }
    }
    if (s.arp) {
      for (const e of expandMelodic(s.arp, steps, chordAt, 'arp')) {
        const dur = e.lengthSteps * stepSec;
        const key = `${e.midi}:${e.lengthSteps}:${tone}`;
        let v = pluckCache.get(key);
        if (!v) {
          v = inst.pluck(sr, e.midi, dur, tone);
          pluckCache.set(key, v);
        }
        const pan = e.step % 2 === 0 ? -0.3 : 0.3;
        mix(v, at(e.step), { gain: 0.8 * (s.arpGain ?? 1), pan, del: 0.22, rev: 0.15 * sound.reverb, ducked: true });
      }
    }
    if (s.lead) {
      for (const e of expandMelodic(s.lead, steps, chordAt, 'lead')) {
        const dur = e.lengthSteps * stepSec * 0.95;
        const brightness = tone * sound.leadBrightness;
        const v =
          sound.leadWave === 'pulse'
            ? inst.pulseLead(sr, e.midi, dur, brightness)
            : sound.leadWave === 'bell'
              ? inst.bell(sr, e.midi, dur, brightness)
              : inst.lead(sr, e.midi, dur, brightness, sound.leadDetune, rng);
        mix(v, at(e.step), {
          gain: 1.1 * (s.leadGain ?? 1),
          del: 0.28,
          rev: 0.35 * sound.reverb,
          ducked: true,
        });
      }
    }
    beat += s.bars * 4;
  }

  onProgress?.(0.8);
  applyPingPong(delSend, L, R, sr, spb * 0.75, 0.38, 0.55, duckAt);
  onProgress?.(0.87);
  applyReverb(revSend, L, R, sr, 0.9 * sound.reverb, duckAt);
  onProgress?.(0.97);

  // ---- master: normalise + gentle saturation
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const a = Math.abs(L[i]);
    const b = Math.abs(R[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  const norm = peak > 0 ? 1.15 / peak : 1;
  const drive = 1.3;
  const out = 0.92 / Math.tanh(drive * 1.15);
  const fadeIn = Math.round(0.004 * sr);
  for (let i = 0; i < length; i++) {
    const f = i < fadeIn ? i / fadeIn : 1;
    L[i] = Math.tanh(L[i] * norm * drive) * out * f;
    R[i] = Math.tanh(R[i] * norm * drive) * out * f;
  }
  // Loudness ceiling so heavily saturated songs don't play louder than the rest.
  let sum = 0;
  for (let i = 0; i < length; i += 4) sum += L[i] * L[i] + R[i] * R[i];
  const rms = Math.sqrt(sum / (2 * Math.ceil(length / 4)));
  if (rms > TARGET_RMS) {
    const g = TARGET_RMS / rms;
    for (let i = 0; i < length; i++) {
      L[i] *= g;
      R[i] *= g;
    }
  }
  return { sampleRate: sr, left: L, right: R };
}
