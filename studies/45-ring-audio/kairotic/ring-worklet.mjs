// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 45 · ring~ (the AudioWorklet): the core, block by block (128 samples).
// The page talks to it through its port with what RingCore.set takes ({d}, {mode}, {freeze}, {clear: true}…),
// and it answers {ready, sr} once, then {state} about thirty times a second for the drawing.
import { RingCore } from "./ringcore.mjs";

class KairoticRing extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.core = new RingCore(sampleRate, p.maxSeconds || 30, p.opts || {});
    this.since = 0;
    this.port.onmessage = (e) => this.core.set(e.data || {});
    this.port.postMessage({ ready: true, sr: sampleRate });
  }

  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0];
    this.core.process(inp, out[0]);
    for (let c = 1; c < out.length; c++) out[c].set(out[0]);
    this.since += out[0].length;
    if (this.since >= sampleRate / 30) { this.since = 0; this.port.postMessage({ state: this.core.state() }); }
    return true;
  }
}

registerProcessor("kairotic-ring", KairoticRing);
