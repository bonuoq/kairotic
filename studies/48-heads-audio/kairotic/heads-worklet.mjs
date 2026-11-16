// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 48 · heads~ (the AudioWorklet): the core, block by block (128 samples).
// The page talks to it through its port:
//   {preset: {len, circular, heads}}   a new span and its heads, from time 0
//   {set: {id, ...}}                    changes a head (d, speed, target, listen, feed, mode…)
//   {cue: {id, kind, t}}                :rec t / :ovr t
//   {clear: true}                        silence in the span, the heads where they are
//   {dry: x}                             how much of the input goes straight out
// and it answers {ready, sr} once, then {state} about thirty times a second for the drawing.
import { HeadsCore } from "./headscore.mjs";

class KairoticHeads extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.core = new HeadsCore(sampleRate, p.maxSeconds || 30, p.opts || {});
    this.since = 0;
    this.port.onmessage = (e) => {
      const m = e.data || {}, c = this.core;
      if (m.preset) { c.span(m.preset.len, m.preset.circular); c.setHeads(m.preset.heads || []); }
      if (m.set) { const { id, ...o } = m.set; c.set(id, o); }
      if (m.cue) c.cue(m.cue.id, m.cue.kind, m.cue.t);
      if (m.clear) c.clear();
      if (m.dry != null) c.dry = m.dry;
    };
    this.port.postMessage({ ready: true, sr: sampleRate });
  }

  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0];
    this.core.process(inp, out[0], out[1]);
    this.since += out[0].length;
    if (this.since >= sampleRate / 30) { this.since = 0; this.port.postMessage({ state: this.core.state() }); }
    return true;
  }
}

registerProcessor("kairotic-heads", KairoticHeads);
