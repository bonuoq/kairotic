// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 48 · heads~: the core (pure: no Web Audio here, so it can be tested sample by sample).
// Study 47's model — a span of time and the heads that write and read it — with sound: the span is a buffer of
// samples, circular (a ring~) or fixed (a work of len seconds), and each head is a head of its own.
//
//   a writer   writes what it listens to where it is: the input ("in"), what readers send (feedback, times its
//              feed: the *~ a patch would put there), or nothing. Moving, it writes every sample it passes, as a
//              tape head does — silence too: an ovr writer that hears nothing erases. ovr replaces what is there;
//              mix keeps it, times keep (1: an overdub; 0.7: what was there fades a little at each pass). A move
//              larger than its jump is a seek: nothing between is written.
//   a reader   sends the sound where it is (interpolated, cubic). A move larger than its jump is a seek: it
//              crossfades xfade seconds from where it was. A reader that follows a writer is d behind it, then
//              drifts by its speed; a new d glides there at one second per second (the pitch bends, as a tape's)
//              when it is not larger than jump, else it seeks.
//
// Where a head is (seconds of the span, kept unwrapped as in Study 47) comes from:
//   clock    p0 + speed·t
//   signal   p0 + speed·t + depth·sin(2π·rate·t): a position that varies (wow: the pitch goes up and down)
//   follow   (readers) the writer `of`, d behind, then the drift (1 − speed) per second
//   hand     glides towards target (a slider; a smoothing of `glide` seconds), a move larger than jump a seek
// Speed couples time and pitch: a reader at 0.5 sounds an octave down, at −1 backwards.
// cue(id, "rec"|"ovr", t): the writer to t now (a seek), then at speed 1, replacing; rec also cuts what is after
// t (on a ring, everything), as the record box's rec t does.

const TAU = 2 * Math.PI;

const WRITER = { role: "write", at: "clock", p0: 0, speed: 1, depth: 0, rate: 0.25, mode: "ovr", keep: 1, jump: 0.25,
                 listen: ["in"], feed: 1, glide: 0.03 };
const READER = { role: "read", at: "follow", of: "w", d: 1, speed: 1, p0: 0, depth: 0, rate: 0.25, jump: 0.25,
                 xfade: 0.03, gain: 1, glide: 0.03 };

export function writer(id, o = {}) { return Object.assign({ id }, WRITER, o); }
export function reader(id, o = {}) { return Object.assign({ id }, READER, o); }

export class HeadsCore {
  constructor(sr, maxSeconds = 30, opts = {}) {
    this.sr = sr;
    this.max = Math.max(8, Math.ceil(maxSeconds * sr));
    this.buf = new Float32Array(this.max);
    this.bins = opts.bins || 360;
    this.dry = 0; this.n = 0;
    this.heads = [];
    this.span(opts.len || 8, opts.circular !== false);
    if (opts.heads) this.setHeads(opts.heads);
  }

  // ── the span ──
  span(len, circular) {
    this.N = Math.min(this.max, Math.max(8, Math.round(len * this.sr)));
    this.len = this.N / this.sr; this.circular = !!circular;
    this.clear();
  }
  clear() { this.buf.fill(0); }
  // time from 0 again, every head in its place
  restart() {
    this.n = 0;
    for (const h of this.heads) {
      Object.assign(h, { p: null, np: null, drift: 0, xf: 0, old: null, y: 0, last: null, dc: h.role === "read" ? h.d : null });
      if (h.role === "write") h.p = h.np = this.clamp(this.place(h, 0));
    }
    for (const h of this.heads) if (h.role === "read") h.p = this.place(h, 0);
  }

  // ── heads ──
  setHeads(hs) {
    this.heads = hs.map((h) => Object.assign({}, h.role === "write" ? WRITER : READER, h,
                                             { p: null, drift: 0, dc: null, old: null, xf: 0, xfLen: 1, y: 0 }));
    this.byId = {};
    for (const h of this.heads) this.byId[h.id] = h;
    this.restart();
  }
  head(id) { return this.byId[id]; }
  // changes a head: a reader's new d is a target (dc glides or seeks to it) and its drift starts again, as in
  // Study 47 (first the distance, then the speed); a new source moves the head there at the next sample
  set(id, o) {
    const h = this.head(id); if (!h) return;
    const was = h.at;
    Object.assign(h, o);
    if (h.role === "read" && (o.d != null || (o.at === "follow" && was !== "follow"))) { h.drift = 0; if (h.dc == null) h.dc = h.d; }
  }
  cue(id, kind, t) {
    const h = this.head(id); if (!h || h.role !== "write") return;
    if (!this.circular) t = Math.max(0, Math.min(this.len, t));
    const now = this.n / this.sr;
    Object.assign(h, { at: "clock", p0: t - now, speed: 1, mode: "ovr", p: t });
    if (kind === "rec") {
      if (this.circular) this.buf.fill(0, 0, this.N);
      else this.buf.fill(0, Math.min(this.N, Math.ceil(t * this.sr)), this.N);
    }
  }

  // where a head is now, from its source (a follower: from where its writer is this sample, np)
  place(h, t) {
    switch (h.at) {
      case "clock": return h.p0 + h.speed * t;
      case "signal": return h.p0 + h.speed * t + h.depth * Math.sin(TAU * h.rate * t);
      case "follow": { const w = this.byId[h.of]; return w && w.role === "write" && w.np != null ? w.np - h.dc - h.drift : null; }
      case "hand": {
        const target = h.target != null ? h.target : (h.p != null ? h.p : h.p0);
        if (h.p == null || Math.abs(target - h.p) > h.jump) return target;
        const k = 1 - Math.exp(-1 / Math.max(1, h.glide * this.sr));
        return h.p + (target - h.p) * k;
      }
      default: return h.p;
    }
  }
  clamp(p) { return this.circular || p == null ? p : Math.max(0, Math.min(this.len, p)); }

  // ── the buffer ──
  idx(i) { const N = this.N; if (this.circular) { i %= N; return i < 0 ? i + N : i; } return i < 0 || i >= N ? -1 : i; }
  at(i) { const j = this.idx(i); return j < 0 ? 0 : this.buf[j]; }
  read(p) {
    const s = p * this.sr, i = Math.floor(s + 1e-6), f = Math.max(0, s - i);
    const y1 = this.at(i);
    if (f === 0) return y1;
    const y0 = this.at(i - 1), y2 = this.at(i + 1), y3 = this.at(i + 2);
    const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    return ((c3 * f + c2) * f + c1) * f + y1;
  }
  put(i, v, h) {
    const j = this.idx(i); if (j < 0) return;
    this.buf[j] = h.mode === "mix" ? h.keep * this.buf[j] + v : v;
  }
  // the sample a position is on
  cell(p) { return Math.floor(p * this.sr + 1e-6); }
  // a writer moving from a to b (seconds) writes v on every sample it passes — forwards those in (a, b], backwards
  // those in [b, a), so that two writers from both ends write mirror images; still (or between two samples), it
  // writes the sample it is on once, and again only with ovr (a still writer replaces; mixing would pile up)
  write(h, a, b, v) {
    const sa = this.cell(a), sb = this.cell(b);
    if (sb > sa) for (let i = sa + 1; i <= sb; i++) this.put(i, v, h);
    else if (sb < sa) for (let i = sa - 1; i >= sb; i--) this.put(i, v, h);
    else if (h.mode === "ovr" || h.last !== sb) this.put(sb, v, h);
    h.last = sb;
  }

  // ── a block ──
  process(input, outL, outR) {
    const n = outL.length, sr = this.sr, hs = this.heads;
    for (let k = 0; k < n; k++) {
      const t = this.n / sr, x = input ? input[k] : 0;
      // where the writers are now (they write after the readers have read, so a reader d behind meets the sound
      // exactly d later, and feedback is exact)
      for (const h of hs) if (h.role === "write") h.np = this.clamp(this.place(h, t));
      // the readers move and read
      let L = 0, R = 0, M = 0, ri = 0;
      for (const h of hs) {
        if (h.role !== "read") continue;
        if (h.at === "follow") {
          const diff = h.d - h.dc;
          if (diff !== 0) h.dc = Math.abs(diff) > h.jump ? h.d : h.dc + Math.max(-1 / sr, Math.min(1 / sr, diff));
          h.drift += (1 - h.speed) / sr;
        }
        const p = this.place(h, t);
        if (p == null) { h.y = 0; ri++; continue; }
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
        const pan = ri % 2 === 0 ? 0.35 : 0.65;                  // the voices a little apart
        L += h.gain * y * (1 - pan) * 2; R += h.gain * y * pan * 2; M += h.gain * y;
        ri++;
      }
      // the writers write what they listen to: the input, what the readers send (times feed), or nothing (silence)
      for (const h of hs) {
        if (h.role !== "write") continue;
        const p = h.np;
        let v = 0;
        for (const src of h.listen) {
          if (src === "in") v += x;
          else { const r = this.byId[src]; if (r && r.role === "read") v += r.y * h.feed; }
        }
        if (h.p == null || Math.abs(p - h.p) > h.jump) { this.put(this.cell(p), v, h); h.last = this.cell(p); }   // a seek
        else this.write(h, h.p, p, v);
        h.p = p;
      }
      // in stereo the voices a little apart; with one output (the tests), their sum
      if (outR) { outL[k] = this.dry * x + L; outR[k] = this.dry * x + R; } else outL[k] = this.dry * x + M;
      this.n++;
    }
  }

  // ── what the page draws ──
  wrap(p) { if (!this.circular) return p; const l = this.len; const x = ((p % l) + l) % l; return l - x < 1e-9 ? 0 : x; }
  state() {
    const B = this.bins, N = this.N, per = N / B, step = Math.max(1, Math.floor(per / 64));
    const peaks = new Array(B);
    for (let b = 0; b < B; b++) {
      let m = 0;
      for (let i = Math.floor(b * per), e = Math.min(N, Math.floor((b + 1) * per)); i < e; i += step) { const a = Math.abs(this.buf[i]); if (a > m) m = a; }
      peaks[b] = m;
    }
    return {
      len: this.len, circular: this.circular, t: this.n / this.sr, peaks,
      heads: this.heads.map((h) => ({ id: h.id, role: h.role, p: h.p == null ? null : this.wrap(h.p),
                                      old: h.old == null ? null : this.wrap(h.old), d: h.role === "read" ? h.dc : null }))
    };
  }
}
