// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 29 · shift~ (the AudioWorklet)
// stftPitchShift in real time: the WebAssembly runs here, block by block (128 samples), one frame late.
// The page talks to it through its port:
//   {factors: [f …]}                         a chord (1 to 16 factors)
//   {transpose: semitones}                   multiplies every factor (a glide, without retyping the chord)
//   {steps: [[t [f …]] …], loop: s, t0: s}   a progression on the audio clock, looped every `loop` seconds
//   {steps: null}                            back to the chord
//   {formants: [quefrency-ms timbre rms]}    {dry: 0…1}
// and it answers {ready, latency} once, then {load, step} about twice a second.
import S from "./shift.mjs";

class KairoticShift extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.frame = p.frame || 1024; this.hop = p.hop || 128;
    this.st = null; this.mono = new Float32Array(128); this.out = new Float32Array(128);
    this.chord = [1]; this.semis = 0; this.steps = null; this.loop = 0; this.t0 = 0; this.step = -1;
    this.formants = [0, 1, false]; this.dryMix = 0;
    this.busy = 0; this.since = 0;
    this.port.onmessage = (e) => this.message(e.data);
    S.ready().then(() => {
      this.st = S.stream(sampleRate, this.frame, this.hop);
      this.apply();
      this.port.postMessage({ ready: true, latency: this.st.latency, version: S.version() });
    }).catch((err) => this.port.postMessage({ error: String((err && err.message) || err) }));
  }

  message(m) {
    if (m.factors) this.chord = m.factors;
    if (typeof m.transpose === "number") this.semis = m.transpose;
    if ("steps" in m) { this.steps = m.steps; this.loop = m.loop || 0; this.t0 = m.t0 || 0; this.step = -1; }
    if (m.formants) this.formants = m.formants;
    if (typeof m.dry === "number") this.dryMix = m.dry;
    this.apply();
  }

  // the factors that hold now: the step of the progression, or the chord; times the transposition
  current() {
    let chord = this.chord;
    if (this.steps && this.steps.length) {
      let t = currentTime - this.t0;
      if (this.loop > 0) t = ((t % this.loop) + this.loop) % this.loop;
      let k = 0;
      while (k + 1 < this.steps.length && this.steps[k + 1][0] <= t) k++;
      this.step = k; chord = this.steps[k][1];
    }
    const g = Math.pow(2, this.semis / 12);
    return chord.map((f) => f * g);
  }

  apply() {
    if (!this.st) return;
    try {
      this.st.factors(this.current());
      this.st.formants(this.formants[0], this.formants[1], this.formants[2]);
      this.st.dry(this.dryMix);
    } catch (err) { this.port.postMessage({ error: String(err.message || err) }); }
  }

  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0];
    if (!out || !out.length) return true;
    const n = out[0].length;
    if (!this.st) { for (const c of out) c.fill(0); return true; }
    // the input as one channel
    if (this.mono.length !== n) { this.mono = new Float32Array(n); this.out = new Float32Array(n); }
    this.mono.fill(0);
    if (inp && inp.length) {
      for (const c of inp) for (let i = 0; i < n; i++) this.mono[i] += c[i];
      if (inp.length > 1) for (let i = 0; i < n; i++) this.mono[i] /= inp.length;
    }
    // a progression moves on the audio clock: its step is looked at every block
    if (this.steps) { const k = this.step; const fs = this.current(); if (this.step !== k) this.st.factors(fs); }
    const a = Date.now();
    this.st.process(this.mono, this.out);
    this.busy += Date.now() - a;
    for (const c of out) c.set(this.out);
    // the load: time spent here over the time the audio lasted, every half second
    this.since += n;
    if (this.since >= sampleRate / 2) {
      this.port.postMessage({ load: this.busy / (1000 * this.since / sampleRate), step: this.step });
      this.busy = 0; this.since = 0;
    }
    return true;
  }
}

registerProcessor("kairotic-shift", KairoticShift);
