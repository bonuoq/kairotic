// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 45 · ring~: the core (pure: no Web Audio here, so it can be tested sample by sample)
// A circular buffer of sound that keeps the last `dur` seconds, a write head that goes round it at the speed of
// time, and a read head `d` seconds behind. What the study decides is how the read head moves when d changes:
//   tape   it glides towards the new d at `rate` seconds of delay per second at most: the sound changes pitch as a
//          tape does (d growing slows it down, shrinking speeds it up), and a d that grows faster than time
//          (rate above 1) takes the head backwards: the sound reversed
//   seek   it jumps there, crossfading `xfade` seconds from where it was: no change of pitch
//   both   glides when the change is small, jumps when it is larger than `jump` seconds (Study 44's seek)
// With freeze it stops writing: the write head still goes round, so the read head loops what the ring keeps.
// feedback writes the read sound back in (echoes); mix is dry 0 … wet 1. interp: "linear" or "cubic" (Hermite).

export class RingCore {
  constructor(sr, maxSeconds = 30, opts = {}) {
    this.sr = sr;
    this.max = Math.max(8, Math.ceil(maxSeconds * sr));
    this.buf = new Float32Array(this.max);
    this.bins = opts.bins || 360;
    this.peaks = new Float32Array(this.bins);
    this.L = 0; this.w = 0; this.bin = -1;
    this.mode = "both"; this.rate = 1; this.jump = 0.25; this.xfade = 0.03;
    this.interp = "cubic"; this.feedback = 0; this.freeze = false; this.mix = 1;
    this.old = null; this.xf = 0; this.xfLen = 1; this.y = 0;
    this.set(Object.assign({ dur: 8, d: 0.5 }, opts));
    this.dc = this.dt;           // the head starts where it should be
  }

  minD() { return 2; }                           // samples: the interpolation reads two ahead of a position
  maxD() { return Math.max(this.minD(), this.L - 4); }

  set(p) {
    if (p.dur != null) {
      const L = Math.min(this.max, Math.max(8, Math.round(p.dur * this.sr)));
      if (L !== this.L) { this.L = L; this.clear(); if (this.dt != null) this.dt = Math.min(this.dt, this.maxD()); if (this.dc != null) this.dc = Math.min(this.dc, this.maxD()); }
    }
    if (p.d != null) this.dt = Math.min(this.maxD(), Math.max(this.minD(), p.d * this.sr));
    for (const k of ["mode", "rate", "jump", "xfade", "interp", "feedback", "freeze", "mix"]) if (p[k] != null) this[k] = p[k];
    if (p.clear) this.clear();
  }

  clear() {
    this.buf.fill(0); this.peaks.fill(0); this.w = 0; this.bin = -1; this.y = 0; this.old = null; this.xf = 0;
  }

  // the sound pos samples behind the write head (pos may be fractional)
  read(pos) {
    const L = this.L, b = this.buf;
    let x = (this.w - pos) % L; if (x < 0) x += L;
    const i = Math.floor(x), f = x - i;
    const y1 = b[i], y2 = b[(i + 1) % L];
    if (this.interp === "linear" || f === 0) return y1 + f * (y2 - y1);
    const y0 = b[(i - 1 + L) % L], y3 = b[(i + 2) % L];
    const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    return ((c3 * f + c2) * f + c1) * f + y1;
  }

  // the read head for this sample: a glide or a seek
  move() {
    const diff = this.dt - this.dc;
    if (diff === 0) return;
    const seek = this.mode === "seek" || (this.mode === "both" && Math.abs(diff) > this.jump * this.sr);
    if (seek) {
      if (this.xf > 0) return;                   // one crossfade at a time: the next starts when it ends
      this.old = this.dc; this.dc = this.dt;
      this.xfLen = Math.max(1, Math.round(this.xfade * this.sr)); this.xf = this.xfLen;
    } else {
      const r = Math.max(0.01, this.rate);
      this.dc += Math.max(-r, Math.min(r, diff));
    }
  }

  process(input, output) {
    const n = output.length, L = this.L;
    for (let k = 0; k < n; k++) {
      const x = input ? input[k] : 0;
      this.move();
      // read first (the head is at least 2 samples behind, so it never reads what is written now), then write
      // what comes in with the feedback of what was just read: an echo exactly d later
      let wet = this.read(this.dc);
      if (this.xf > 0) {
        const g = this.xf / this.xfLen;
        wet = g * this.read(this.old) + (1 - g) * wet;
        this.xf--; if (this.xf === 0) this.old = null;
      }
      this.y = wet;
      if (!this.freeze) {
        const v = x + this.feedback * wet;
        this.buf[this.w] = v;
        const bin = Math.floor(this.w * this.bins / L);
        if (bin !== this.bin) { this.peaks[bin] = 0; this.bin = bin; }
        const a = Math.abs(v); if (a > this.peaks[bin]) this.peaks[bin] = a;
      }
      output[k] = (1 - this.mix) * x + this.mix * wet;
      this.w = (this.w + 1) % L;
    }
  }

  // what the page draws: where the heads are (as fractions of the ring) and the peaks around it
  state() {
    const L = this.L;
    const at = (pos) => { let x = (this.w - pos) % L; if (x < 0) x += L; return x / L; };
    return {
      dur: L / this.sr, w: this.w / L, d: this.dc / this.sr, target: this.dt / this.sr,
      read: at(this.dc), old: this.old == null ? null : at(this.old), freeze: this.freeze,
      peaks: Array.from(this.peaks)
    };
  }
}
