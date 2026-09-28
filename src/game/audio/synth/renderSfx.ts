import { Saw, Svf, TWO_PI, mulberry32 } from './dsp';

export type SfxName =
  | 'menuMove'
  | 'menuSelect'
  | 'menuBack'
  | 'hitPerfect'
  | 'hitGreat'
  | 'hitGood'
  | 'miss'
  | 'holdStart'
  | 'holdComplete'
  | 'holdBreak'
  | 'fever'
  | 'milestone'
  | 'countTick'
  | 'countGo'
  | 'transition'
  | 'resultImpact'
  | 'rankReveal'
  | 'newRecord';

type Gen = (sr: number) => Float32Array<ArrayBuffer>;

const rng = mulberry32(99);
const noise = () => rng() * 2 - 1;
const buf = (sr: number, s: number) => new Float32Array(Math.ceil(sr * s));

function blip(freqs: number[], spacing: number, decay: number, len: number, wave: 'sine' | 'tri' = 'sine'): Gen {
  return (sr) => {
    const out = buf(sr, len);
    freqs.forEach((f, n) => {
      const start = Math.floor(n * spacing * sr);
      for (let i = start; i < out.length; i++) {
        const t = (i - start) / sr;
        const ph = (f * t) % 1;
        const s = wave === 'sine' ? Math.sin(TWO_PI * ph) : 1 - 4 * Math.abs(ph - 0.5);
        out[i] += s * Math.exp(-t * decay) * (t < 0.002 ? t / 0.002 : 1) * 0.5;
      }
    });
    return out;
  };
}

/** Crisp hit click: filtered noise transient + fast pitch-dropping tone. */
function hit(brightness: number, pitch: number, gain: number): Gen {
  return (sr) => {
    const out = buf(sr, 0.12);
    const hp = new Svf(sr, 0.2);
    hp.setCutoff(2500 * brightness);
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      hp.process(noise());
      const click = hp.high * Math.exp(-t * 220);
      phase += (TWO_PI * pitch * (1 + 1.5 * Math.exp(-t * 60))) / sr;
      const tone = Math.sin(phase) * Math.exp(-t * 45) * 0.6;
      out[i] = Math.tanh((click * 0.9 + tone) * 1.5) * gain;
    }
    return out;
  };
}

const GENERATORS: Record<SfxName, Gen> = {
  menuMove: blip([1760], 0, 60, 0.06),
  menuSelect: blip([988, 1480], 0.045, 30, 0.2),
  menuBack: blip([1175, 784], 0.045, 30, 0.18),
  hitPerfect: hit(1.3, 1900, 0.75),
  hitGreat: hit(1, 1500, 0.6),
  hitGood: hit(0.6, 900, 0.45),
  miss: (sr) => {
    const out = buf(sr, 0.25);
    const lp = new Svf(sr, 0.5);
    lp.setCutoff(500);
    const saw = new Saw();
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      lp.process(saw.next(110 - 50 * t * 4, sr) + noise() * 0.3);
      out[i] = lp.low * Math.exp(-t * 14) * 0.7;
    }
    return out;
  },
  holdStart: hit(1.1, 1300, 0.55),
  holdComplete: blip([1568, 2093, 2637], 0.03, 16, 0.4),
  holdBreak: (sr) => {
    const out = buf(sr, 0.22);
    const bp = new Svf(sr, 0.7);
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      if ((i & 15) === 0) bp.setCutoff(3000 * Math.exp(-t * 8) + 300);
      bp.process(noise());
      out[i] = bp.band * Math.exp(-t * 12) * 0.9;
    }
    return out;
  },
  fever: (sr) => {
    const out = buf(sr, 1.6);
    const bp = new Svf(sr, 0.5);
    const chord = [261.6, 329.6, 392, 493.9, 523.3].map(() => new Saw(rng()));
    const freqs = [261.6, 329.6, 392, 493.9, 523.3];
    const lp = new Svf(sr, 0.3);
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      if ((i & 15) === 0) {
        bp.setCutoff(400 + 7000 * Math.min(1, t / 0.5));
        lp.setCutoff(800 + 5000 * Math.exp(-(t - 0.45) * 4));
      }
      bp.process(noise());
      const whoosh = bp.band * (t < 0.5 ? t / 0.5 : Math.exp(-(t - 0.5) * 6)) * 0.6;
      let stab = 0;
      if (t > 0.45) {
        for (let v = 0; v < chord.length; v++) stab += chord[v].next(freqs[v] * 2, sr);
        lp.process(stab / chord.length);
        stab = lp.low * Math.exp(-(t - 0.45) * 2.5) * 0.9;
      }
      out[i] = Math.tanh(whoosh + stab);
    }
    return out;
  },
  milestone: blip([1047, 1319, 1568, 2093], 0.055, 10, 0.6, 'tri'),
  countTick: blip([1320], 0, 30, 0.15),
  countGo: blip([1760, 2637], 0.0, 12, 0.5, 'tri'),
  transition: (sr) => {
    const out = buf(sr, 0.45);
    const bp = new Svf(sr, 0.4);
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      if ((i & 15) === 0) bp.setCutoff(6000 * Math.exp(-t * 6) + 400);
      bp.process(noise());
      out[i] = bp.band * Math.sin(Math.PI * Math.min(1, t / 0.45)) * 0.6;
    }
    return out;
  },
  resultImpact: (sr) => {
    const out = buf(sr, 1.4);
    let phase = 0;
    const lp = new Svf(sr, 0.2);
    lp.setCutoff(1200);
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      phase += (TWO_PI * (40 + 90 * Math.exp(-t * 14))) / sr;
      lp.process(noise());
      out[i] = Math.tanh((Math.sin(phase) * Math.exp(-t * 3) + lp.low * Math.exp(-t * 9) * 0.6) * 1.8) * 0.8;
    }
    return out;
  },
  rankReveal: blip([523, 784, 1047, 1568], 0.0, 5, 1.2, 'tri'),
  newRecord: blip([784, 988, 1175, 1568, 1976, 2349], 0.07, 7, 1.2, 'tri'),
};

export const SFX_NAMES = Object.keys(GENERATORS) as SfxName[];

export function renderSfx(name: SfxName, sampleRate: number): Float32Array<ArrayBuffer> {
  return GENERATORS[name](sampleRate);
}
