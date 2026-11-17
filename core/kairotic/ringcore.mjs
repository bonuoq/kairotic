// SPDX-License-Identifier: MPL-2.0
// Kairotic · ring~: the core of the box (Study 48's heads, in the app). One AudioWorklet node holds the span —
// a buffer of the last `len` seconds of sound — and every head on it: the ring's own write head and the
// writer~ and reader~ boxes connected to its right outlet, each in a slot of the node. So they share the
// buffer, and what one writes another reads in the same sample.
//
//   input 0                the ring's own input: written where its time is (its write head, a tape head)
//   input 1 + s (2 ch)     slot s: channel 0 what a writer~ writes, channel 1 a position (seconds, or 0…1 × len
//                          with norm), when its position comes from a signal
//   output s (mono)        slot s: what a reader~ reads
//
// A writer writes what it gets on every sample it passes, as a tape head: ovr replaces, mix keeps what was
// there times keep. Its position: the ring's head (by default), a signal, or a clock from t at speed 1 (:rec t
// / :ovr t; rec also erases the ring first). A reader reads (cubic): following the ring's head d behind and then
// drifting by its speed (a new d glides at a second per second, or seeks with a crossfade when it is larger than
// jump), or at a position signal (a jump is a seek, crossfaded). Readers read before writers write, so a reader
// d behind meets the sound exactly d later.
//
// Messages on the port: {attach: {slot, role, ...opts}} · {detach: slot} · {set: {slot, ...}} ·
// {cue: {slot, kind, t}} · {clear: true} · {own: false} (its own head stops writing: nothing on its left). In a worklet it registers "kairotic-ring"; in Node it is a module.

const READER = { role: "read", mode: "follow", d: 1, speed: 1, jump: 0.25, xfade: 0.03, gain: 1, norm: false };
const WRITER = { role: "write", mode: "head", write: "ovr", keep: 1, jump: 0.25, norm: false };

export class RingCore {
  constructor(sr, len = 8, maxSeconds = 60, slots = 8) {
    this.sr = sr;
    this.max = Math.max(8, Math.ceil(maxSeconds * sr));
    this.buf = new Float32Array(this.max);
    this.N = Math.min(this.max, Math.max(8, Math.round(len * sr)));
    this.len = this.N / sr;
    this.n = 0;
    this.own = true;   // its own write head writes its input (with nothing on its left, the page turns it off)
    this.slots = new Array(slots).fill(null);
  }

  // ── heads ──
  attach(slot, o) {
    if (slot < 0 || slot >= this.slots.length) return;
    const h = Object.assign({}, o.role === "write" ? WRITER : READER, o,
                            { p: null, last: null, dc: null, drift: 0, old: null, xf: 0, xfLen: 1, y: 0, clock: null });
    h.dc = h.d;
    this.slots[slot] = h;
  }
  detach(slot) { if (slot >= 0 && slot < this.slots.length) this.slots[slot] = null; }
  set(slot, o) {
    const h = this.slots[slot]; if (!h) return;
    const was = h.mode;
    Object.assign(h, o);
    // a new d is a distance from now: the drift starts again (first the distance, then the speed)
    if (h.role === "read" && (o.d != null || (o.mode === "follow" && was !== "follow"))) h.drift = 0;
  }
  cue(slot, kind, t) {
    const h = this.slots[slot]; if (!h || h.role !== "write") return;
    if (kind === "stop") { h.clock = null; if (h.mode === "clock") h.mode = "held"; return; }
    h.mode = "clock"; h.write = "ovr"; h.clock = { n: this.n, p: t || 0 }; h.p = null;   // a seek: nothing between
    if (kind === "rec") this.buf.fill(0, 0, this.N);
  }
  clear() { this.buf.fill(0, 0, this.N); }
  message(m) {
    if (!m) return;
    if (m.attach) { const { slot, ...o } = m.attach; this.attach(slot, o); }
    if (m.detach != null) this.detach(m.detach);
    if (m.set) { const { slot, ...o } = m.set; this.set(slot, o); }
    if (m.cue) this.cue(m.cue.slot, m.cue.kind, m.cue.t);
    if (m.clear) this.clear();
    if (m.own != null) this.own = !!m.own;
  }

  // ── the buffer ──
  idx(i) { const N = this.N; i %= N; return i < 0 ? i + N : i; }
  cell(p) { return Math.floor(p * this.sr + 1e-6); }
  read(p) {
    const b = this.buf, s = p * this.sr, i = Math.floor(s + 1e-6), f = Math.max(0, s - i);
    const y1 = b[this.idx(i)];
    if (f === 0) return y1;
    const y0 = b[this.idx(i - 1)], y2 = b[this.idx(i + 1)], y3 = b[this.idx(i + 2)];
    const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    return ((c3 * f + c2) * f + c1) * f + y1;
  }
  put(i, v, h) { const j = this.idx(i); this.buf[j] = h.write === "mix" ? h.keep * this.buf[j] + v : v; }
  // a writer from a to b writes v on every sample it passes (forwards (a, b], backwards [b, a)); still, it writes
  // the sample it is on once, and again only with ovr
  write(h, a, b, v) {
    const sa = this.cell(a), sb = this.cell(b);
    if (sb > sa) for (let i = sa + 1; i <= sb; i++) this.put(i, v, h);
    else if (sb < sa) for (let i = sa - 1; i >= sb; i--) this.put(i, v, h);
    else if (h.write === "ovr" || h.last !== sb) this.put(sb, v, h);
    h.last = sb;
  }
  // a position from a signal: seconds (or 0…1 × len with norm), unwrapped so that a phasor~ going back to 0 has
  // gone on, not back
  fromSignal(h, q) {
    const l = this.len, x = h.norm ? q * l : q;
    if (h.p == null) return x;
    const w = ((h.p % l) + l) % l;
    let d = ((x - w) % l + l) % l; if (d > l / 2) d -= l;
    return h.p + d;
  }

  // ── a block: inputs and outputs as an AudioWorkletProcessor gets them ──
  process(inputs, outputs) {
    const L = outputs.length && outputs[0][0] ? outputs[0][0].length : 128, sr = this.sr, S = this.slots;
    const in0 = inputs[0] && inputs[0][0];
    for (let k = 0; k < L; k++) {
      const t = this.n / sr, head = t;
      // where the writers are now (they write after the readers have read)
      for (let s = 0; s < S.length; s++) {
        const h = S[s]; if (!h || h.role !== "write") continue;
        const ch = inputs[s + 1];
        if (h.mode === "pos") h.np = ch && ch[1] ? this.fromSignal(h, ch[1][k]) : (h.p != null ? h.p : head);
        else if (h.mode === "clock" && h.clock) h.np = h.clock.p + (this.n - h.clock.n) / sr;
        else if (h.mode === "held") h.np = h.p != null ? h.p : head;
        else h.np = head;
      }
      // the readers move and read
      for (let s = 0; s < S.length; s++) {
        const h = S[s]; if (!h || h.role !== "read") continue;
        let p;
        if (h.mode === "pos") {
          const ch = inputs[s + 1];
          p = this.fromSignal(h, ch && ch[1] ? ch[1][k] : 0);
        } else {
          const diff = h.d - h.dc;
          if (diff !== 0) h.dc = Math.abs(diff) > h.jump ? h.d : h.dc + Math.max(-1 / sr, Math.min(1 / sr, diff));
          h.drift += (1 - h.speed) / sr;
          p = head - h.dc - h.drift;
        }
        if (h.p != null && Math.abs(p - h.p) > h.jump && h.xf === 0) {
          h.old = h.p; h.xfLen = Math.max(1, Math.round(h.xfade * sr)); h.xf = h.xfLen;
        } else if (h.old != null && h.p != null) h.old += p - h.p;   // the head it leaves keeps moving as it did
        let y = this.read(p);
        if (h.xf > 0) {
          const g = h.xf / h.xfLen;
          y = g * this.read(h.old) + (1 - g) * y;
          if (--h.xf === 0) h.old = null;
        }
        h.p = p; h.y = y;
        const o = outputs[s] && outputs[s][0];
        if (o) o[k] = h.gain * y;
      }
      // the ring's own write head: its input, where its time is
      if (this.own) this.buf[this.idx(this.n)] = in0 ? in0[k] : 0;
      // then the writers, in the order of their slots
      for (let s = 0; s < S.length; s++) {
        const h = S[s]; if (!h || h.role !== "write") continue;
        const ch = inputs[s + 1], v = ch && ch[0] ? ch[0][k] : 0, p = h.np;
        if (h.p == null || Math.abs(p - h.p) > h.jump) { const c = this.cell(p); this.put(c, v, h); h.last = c; }   // a seek
        else this.write(h, h.p, p, v);
        h.p = p;
      }
      this.n++;
    }
    // outputs of empty slots (or of writers) are silent
    for (let s = 0; s < outputs.length; s++) {
      const h = S[s], o = outputs[s] && outputs[s][0];
      if (o && (!h || h.role !== "read")) o.fill(0);
    }
  }

  // where the heads are (wrapped, in seconds), for a drawing
  state() {
    const l = this.len, w = (p) => (p == null ? null : ((p % l) + l) % l);
    return { len: l, t: this.n / this.sr, head: w(this.n / this.sr),
             slots: this.slots.map((h) => (h ? { role: h.role, mode: h.mode, p: w(h.p) } : null)) };
  }
}

// in an AudioWorklet: the processor
if (typeof registerProcessor === "function") {
  class KairoticRing extends AudioWorkletProcessor {
    constructor(o) {
      super();
      const p = (o && o.processorOptions) || {};
      this.core = new RingCore(sampleRate, p.len || 8, p.max || 60, p.slots || 8);
      this.port.onmessage = (e) => this.core.message(e.data);
    }
    process(inputs, outputs) { this.core.process(inputs, outputs); return true; }
  }
  registerProcessor("kairotic-ring", KairoticRing);
}
