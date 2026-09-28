/** Offline send effects. Both read a mono send buffer and add their stereo return into L/R. */

class Comb {
  private buf: Float32Array;
  private idx = 0;
  private store = 0;
  constructor(
    size: number,
    private feedback: number,
    private damp: number,
  ) {
    this.buf = new Float32Array(size);
  }
  process(input: number): number {
    const out = this.buf[this.idx];
    this.store = out * (1 - this.damp) + this.store * this.damp;
    this.buf[this.idx] = input + this.store * this.feedback;
    if (++this.idx >= this.buf.length) this.idx = 0;
    return out;
  }
}

class Allpass {
  private buf: Float32Array;
  private idx = 0;
  constructor(size: number) {
    this.buf = new Float32Array(size);
  }
  process(input: number): number {
    const b = this.buf[this.idx];
    this.buf[this.idx] = input + b * 0.5;
    if (++this.idx >= this.buf.length) this.idx = 0;
    return b - input;
  }
}

/** Compact Freeverb (4 combs + 2 allpasses per side). */
export function applyReverb(
  send: Float32Array,
  left: Float32Array,
  right: Float32Array,
  sr: number,
  wet: number,
  gainAt?: (i: number) => number,
): void {
  const scale = sr / 44100;
  const combSizes = [1116, 1188, 1277, 1356];
  const apSizes = [556, 441];
  const spread = 23;
  const make = (extra: number) => ({
    combs: combSizes.map((s) => new Comb(Math.round((s + extra) * scale), 0.83, 0.28)),
    aps: apSizes.map((s) => new Allpass(Math.round((s + extra) * scale))),
  });
  const L = make(0);
  const R = make(spread);
  for (let i = 0; i < send.length; i++) {
    const input = send[i] * 0.2;
    let l = 0;
    let r = 0;
    for (let c = 0; c < 4; c++) {
      l += L.combs[c].process(input);
      r += R.combs[c].process(input);
    }
    for (let a = 0; a < 2; a++) {
      l = L.aps[a].process(l);
      r = R.aps[a].process(r);
    }
    const g = gainAt ? gainAt(i) * wet : wet;
    left[i] += l * g;
    right[i] += r * g;
  }
}

/** Ping-pong delay with a darkening feedback loop. */
export function applyPingPong(
  send: Float32Array,
  left: Float32Array,
  right: Float32Array,
  sr: number,
  delaySeconds: number,
  feedback: number,
  wet: number,
  gainAt?: (i: number) => number,
): void {
  const size = Math.max(1, Math.round(delaySeconds * sr));
  const bl = new Float32Array(size);
  const br = new Float32Array(size);
  let idx = 0;
  let lpL = 0;
  let lpR = 0;
  const a = Math.exp((-2 * Math.PI * 3200) / sr);
  for (let i = 0; i < send.length; i++) {
    const outL = bl[idx];
    const outR = br[idx];
    lpL = (send[i] + outR * feedback) * (1 - a) + lpL * a;
    lpR = outL * feedback * (1 - a) + lpR * a;
    bl[idx] = lpL;
    br[idx] = lpR;
    if (++idx >= size) idx = 0;
    const g = gainAt ? gainAt(i) * wet : wet;
    left[i] += outL * g;
    right[i] += outR * g;
  }
}
