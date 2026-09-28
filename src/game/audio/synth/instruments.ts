import { Metallic, OnePole, Pulse, Saw, Svf, TWO_PI, adsr, polyBlep, type Rng } from './dsp';
import { midiToFreqSafe } from './music';

/** A rendered voice: mono, or stereo when `right` is set. */
export interface Voice {
  left: Float32Array;
  right?: Float32Array;
}

const buf = (sr: number, seconds: number) => new Float32Array(Math.max(1, Math.ceil(sr * seconds)));

// ---------------------------------------------------------------- drums

export function kick(sr: number, tune = 1, drive = 1): Float32Array {
  const out = buf(sr, 0.55);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const f = (46 + 170 * Math.exp(-t * 32) + 60 * Math.exp(-t * 260)) * tune;
    phase += (TWO_PI * f) / sr;
    const amp = (t < 0.002 ? t / 0.002 : 1) * Math.exp(-t * 6.2);
    const body = Math.sin(phase) * amp;
    out[i] = (Math.tanh(1.8 * drive * body) / Math.tanh(1.8 * drive)) * 0.95;
  }
  return out;
}

export function snare(sr: number, rng: Rng): Float32Array {
  const out = buf(sr, 0.35);
  const bp = new Svf(sr, 0.35);
  bp.setCutoff(3200);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const tone = (Math.sin(TWO_PI * 185 * t) * 0.6 + Math.sin(TWO_PI * 330 * t) * 0.3) * Math.exp(-t * 28);
    bp.process(rng() * 2 - 1);
    const noise = (bp.band * 1.4 + bp.high * 0.5) * Math.exp(-t * 15);
    out[i] = Math.tanh((tone + noise) * 1.3) * 0.8;
  }
  return out;
}

export function clap(sr: number, rng: Rng): Float32Array {
  const out = buf(sr, 0.4);
  const bp = new Svf(sr, 0.55);
  bp.setCutoff(1300);
  const bursts = [0, 0.011, 0.023];
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let env = 0;
    for (const b of bursts) if (t >= b) env += Math.exp(-(t - b) * 160);
    if (t >= 0.03) env += 0.9 * Math.exp(-(t - 0.03) * 16);
    bp.process(rng() * 2 - 1);
    out[i] = Math.tanh(bp.band * env * 2.2) * 0.75;
  }
  return out;
}

export function hat(sr: number, rng: Rng, open: boolean): Float32Array {
  const out = buf(sr, open ? 0.45 : 0.09);
  const hp = new Svf(sr, 0.1);
  hp.setCutoff(7600);
  const metal = new Metallic();
  const decay = open ? 7.5 : 58;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    hp.process((rng() * 2 - 1) * 0.6 + metal.next(sr, 2.2) * 0.6);
    out[i] = hp.high * Math.exp(-t * decay) * (t < 0.001 ? t / 0.001 : 1) * 0.55;
  }
  return out;
}

export function crash(sr: number, rng: Rng): Voice {
  const left = buf(sr, 2.6);
  const right = buf(sr, 2.6);
  const hpL = new Svf(sr, 0.1);
  const hpR = new Svf(sr, 0.1);
  hpL.setCutoff(4200);
  hpR.setCutoff(4600);
  const mL = new Metallic();
  const mR = new Metallic();
  for (let i = 0; i < left.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 1.7) * (t < 0.003 ? t / 0.003 : 1) * 0.45;
    hpL.process((rng() * 2 - 1) * 0.7 + mL.next(sr, 3.1) * 0.4);
    hpR.process((rng() * 2 - 1) * 0.7 + mR.next(sr, 3.27) * 0.4);
    left[i] = hpL.high * env;
    right[i] = hpR.high * env;
  }
  return { left, right };
}

export function impact(sr: number, rng: Rng): Float32Array {
  const out = buf(sr, 2.2);
  const lp = new OnePole(sr, 900);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    phase += (TWO_PI * (32 + 60 * Math.exp(-t * 9))) / sr;
    const boom = Math.sin(phase) * Math.exp(-t * 2.2);
    const noise = lp.lp(rng() * 2 - 1) * Math.exp(-t * 5) * 0.9;
    out[i] = Math.tanh((boom + noise) * 1.6) * 0.8;
  }
  return out;
}

/** Filtered noise sweep that rises across `seconds`. */
export function riser(sr: number, rng: Rng, seconds: number): Voice {
  const left = buf(sr, seconds);
  const right = buf(sr, seconds);
  const fL = new Svf(sr, 0.6);
  const fR = new Svf(sr, 0.6);
  for (let i = 0; i < left.length; i++) {
    const p = i / left.length;
    const cutoff = 300 * Math.pow(9000 / 300, p);
    if ((i & 31) === 0) {
      fL.setCutoff(cutoff);
      fR.setCutoff(cutoff * 1.08);
    }
    fL.process(rng() * 2 - 1);
    fR.process(rng() * 2 - 1);
    const env = p * p * 0.5;
    left[i] = fL.band * env;
    right[i] = fR.band * env;
  }
  return { left, right };
}

// ---------------------------------------------------------------- tonal

export function bass(sr: number, midi: number, seconds: number, tone: number, drive: number): Float32Array {
  const release = 0.05;
  const out = buf(sr, seconds + release);
  const f = midiToFreqSafe(midi);
  const s1 = new Saw();
  const s2 = new Saw(0.3);
  const filter = new Svf(sr, 0.35);
  let sub = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    if ((i & 15) === 0) filter.setCutoff(140 + (280 + 1700 * Math.exp(-t * 11)) * (0.35 + 0.65 * tone));
    const raw = s1.next(f, sr) * 0.55 + s2.next(f * 1.006, sr) * 0.45;
    filter.process(raw);
    sub += (TWO_PI * f) / sr;
    const amp = adsr(t, seconds, 0.003, 0.12, 0.8, release);
    out[i] = Math.tanh((filter.low * 0.9 + Math.sin(sub) * 0.55) * 1.4 * drive) * amp * 0.6;
  }
  return out;
}

export function lead(
  sr: number,
  midi: number,
  seconds: number,
  tone: number,
  detune: number,
  rng: Rng,
): Voice {
  const release = 0.2;
  const left = buf(sr, seconds + release);
  const right = buf(sr, seconds + release);
  const f = midiToFreqSafe(midi);
  const detunes = [-0.19, -0.11, -0.045, 0, 0.045, 0.11, 0.19];
  const ratios = detunes.map((d) => Math.pow(2, (d * detune) / 12));
  const saws = detunes.map(() => new Saw(rng()));
  const fL = new Svf(sr, 0.18);
  const fR = new Svf(sr, 0.18);
  for (let i = 0; i < left.length; i++) {
    const t = i / sr;
    const vib = t > 0.18 ? Math.sin(TWO_PI * 5.5 * t) * 0.004 * Math.min(1, (t - 0.18) * 4) : 0;
    const freq = f * (1 + vib);
    let l = 0;
    let r = 0;
    for (let v = 0; v < saws.length; v++) {
      const s = saws[v].next(freq * ratios[v], sr);
      if (v === 3) {
        l += s;
        r += s;
      } else if (v % 2 === 0) {
        l += s * 0.9;
        r += s * 0.35;
      } else {
        l += s * 0.35;
        r += s * 0.9;
      }
    }
    if ((i & 15) === 0) {
      const c = (900 + 5200 * (0.55 + 0.45 * Math.exp(-t * 5))) * (0.3 + 0.7 * tone);
      fL.setCutoff(c);
      fR.setCutoff(c);
    }
    fL.process(l);
    fR.process(r);
    const amp = adsr(t, seconds, 0.008, 0.2, 0.72, release) * 0.16;
    left[i] = fL.low * amp;
    right[i] = fR.low * amp;
  }
  return { left, right };
}

export function pluck(sr: number, midi: number, seconds: number, tone: number): Float32Array {
  const len = Math.min(seconds, 0.35) + 0.12;
  const out = buf(sr, len);
  const f = midiToFreqSafe(midi);
  const saw = new Saw();
  const pulse = new Pulse(0.3);
  const filter = new Svf(sr, 0.3);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    if ((i & 15) === 0) filter.setCutoff(350 + 5200 * tone * Math.exp(-t * 16));
    filter.process(saw.next(f, sr) * 0.6 + pulse.next(f * 2.002, sr) * 0.3);
    const amp = (t < 0.002 ? t / 0.002 : 1) * Math.exp(-t * 8.5) * 0.3;
    out[i] = filter.low * amp;
  }
  return out;
}

export function pad(sr: number, notes: number[], seconds: number, tone: number, rng: Rng): Voice {
  const attack = 0.3;
  const release = 0.6;
  const left = buf(sr, seconds + release);
  const right = buf(sr, seconds + release);
  const voices = notes.flatMap((n, ni) =>
    [-0.09, 0.0, 0.09].map((d, vi) => ({
      saw: new Saw(rng()),
      freq: midiToFreqSafe(n) * Math.pow(2, d / 12),
      panL: (ni + vi) % 2 === 0 ? 0.85 : 0.45,
    })),
  );
  const fL = new Svf(sr, 0.1);
  const fR = new Svf(sr, 0.1);
  const norm = 0.11 / Math.sqrt(voices.length);
  for (let i = 0; i < left.length; i++) {
    const t = i / sr;
    let l = 0;
    let r = 0;
    for (const v of voices) {
      const s = v.saw.next(v.freq, sr);
      l += s * v.panL;
      r += s * (1.3 - v.panL);
    }
    if ((i & 31) === 0) {
      const c = (700 + 1500 * tone) * (1 + 0.15 * Math.sin(TWO_PI * 0.3 * t));
      fL.setCutoff(c);
      fR.setCutoff(c * 1.05);
    }
    fL.process(l);
    fR.process(r);
    const amp = adsr(t, seconds, attack, 0.5, 0.85, release) * norm;
    left[i] = fL.low * amp;
    right[i] = fR.low * amp;
  }
  return { left, right };
}

/** Chiptune-style lead: two detuned pulse waves with slow PWM, split left/right. */
export function pulseLead(sr: number, midi: number, seconds: number, tone: number): Voice {
  const release = 0.12;
  const left = buf(sr, seconds + release);
  const right = buf(sr, seconds + release);
  const f = midiToFreqSafe(midi);
  const fL = new Svf(sr, 0.15);
  const fR = new Svf(sr, 0.15);
  const cutoff = 1600 + 5200 * tone;
  fL.setCutoff(cutoff);
  fR.setCutoff(cutoff * 1.05);
  let p1 = 0;
  let p2 = 0.37;
  for (let i = 0; i < left.length; i++) {
    const t = i / sr;
    const vib = t > 0.15 ? Math.sin(TWO_PI * 6 * t) * 0.003 : 0;
    const width = 0.25 + 0.15 * Math.sin(TWO_PI * 0.8 * t);
    const dt1 = (f * (1 + vib)) / sr;
    const dt2 = dt1 * 1.004;
    p1 = (p1 + dt1) % 1;
    p2 = (p2 + dt2) % 1;
    fL.process(pulseAt(p1, dt1, width));
    fR.process(pulseAt(p2, dt2, width));
    const amp = adsr(t, seconds, 0.004, 0.12, 0.7, release) * 0.2;
    left[i] = fL.low * amp;
    right[i] = fR.low * amp;
  }
  return { left, right };
}

/** Band-limited pulse from two phase-offset saws. */
function pulseAt(phase: number, dt: number, width: number): number {
  const a = 2 * phase - 1 - polyBlep(phase, dt);
  const q = (phase + width) % 1;
  const b = 2 * q - 1 - polyBlep(q, dt);
  return (a - b) * 0.5;
}

/** Two-operator FM bell / electric-piano tone with a long natural decay. */
export function bell(sr: number, midi: number, seconds: number, tone: number): Voice {
  const tail = 0.9;
  const left = buf(sr, seconds + tail);
  const right = buf(sr, seconds + tail);
  const f = midiToFreqSafe(midi);
  let pc = 0;
  let pm = 0;
  let po = 0;
  for (let i = 0; i < left.length; i++) {
    const t = i / sr;
    pm += (TWO_PI * f * 3.5) / sr;
    pc += (TWO_PI * f) / sr;
    po += (TWO_PI * f * 2.001) / sr;
    const index = (1.2 + 2.2 * tone) * Math.exp(-t * 5);
    const car = Math.sin(pc + Math.sin(pm) * index);
    const oct = Math.sin(po) * 0.25 * Math.exp(-t * 3);
    const release = t > seconds ? Math.exp(-(t - seconds) * 6) : 1;
    const amp = (t < 0.004 ? t / 0.004 : 1) * Math.exp(-t * 1.6) * release * 0.26;
    const v = (car + oct) * amp;
    left[i] = v;
    right[i] = v * 0.92;
  }
  return { left, right };
}
