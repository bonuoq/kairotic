// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 49 · insert (the AudioWorklet): Study 48's heads, and a Faust DSP in a writer's feedback, run
// here one sample at a time (compute(1)), inside the same node as the span, so the loop is exact.
//
// The page compiles the Faust code (faustwasm) and sends the WebAssembly module and its JSON; this worklet
// instantiates it — the math it imports, its memory laid out as faustwasm lays it (the DSP at 0, then the
// pointers to its input and output buffers, then the buffers) — and gives the core an insert with step(x).
//
// Messages: {preset: {len, circular, heads}} · {set: {id, ...}} · {cue: {id, kind, t}} · {clear: true} ·
// {dry: x} · {insert: {id, module | code, json}} · {insert: {id, off: true}} · {param: {id, address, value}}.
// It answers {ready, sr}, {insert: {id, ok, params} | {id, error}}, and {state} about thirty times a second.
import { HeadsCore } from "./insertcore.mjs";

// what a Faust module imports: Math, by the names the Faust backend gives them (_sinf, _powf, _max_i…)
const SPECIAL = {
  max_f: Math.max, max_i: Math.max, max: Math.max, min_f: Math.min, min_i: Math.min, min: Math.min,
  abs: Math.abs, fabsf: Math.abs, fabs: Math.abs,
  isnanf: (x) => +Number.isNaN(x), isnan: (x) => +Number.isNaN(x),
  isinff: (x) => +(x === Infinity || x === -Infinity), isinf: (x) => +(x === Infinity || x === -Infinity),
  copysignf: (x, y) => (y < 0 || Object.is(y, -0) ? -Math.abs(x) : Math.abs(x)),
  copysign: (x, y) => (y < 0 || Object.is(y, -0) ? -Math.abs(x) : Math.abs(x)),
  fmodf: (x, y) => x % y, fmod: (x, y) => x % y,
  remainderf: (x, y) => x - y * Math.round(x / y), remainder: (x, y) => x - y * Math.round(x / y),
  rintf: Math.round, rint: Math.round, nearbyintf: Math.round, nearbyint: Math.round, roundf: Math.round, round: Math.round,
  exp10f: (x) => Math.pow(10, x), exp10: (x) => Math.pow(10, x)
};
function mathFn(name) {
  const n = name.replace(/^_+/, "");
  if (SPECIAL[n]) return SPECIAL[n];
  if (typeof Math[n] === "function") return Math[n];
  if (n.endsWith("f") && typeof Math[n.slice(0, -1)] === "function") return Math[n.slice(0, -1)];
  return () => 0;
}
function importsFor(module) {
  const out = {};
  let memory = null;
  for (const imp of WebAssembly.Module.imports(module)) {
    const m = (out[imp.module] = out[imp.module] || {});
    if (imp.kind === "function") m[imp.name] = mathFn(imp.name);
    else if (imp.kind === "memory") m[imp.name] = memory = new WebAssembly.Memory({ initial: 100 });
    else if (imp.kind === "table") m[imp.name] = new WebAssembly.Table({ initial: 0, element: "anyfunc" });
    else if (imp.kind === "global") m[imp.name] = 0;
  }
  return { imports: out, memory };
}

function paramsOf(ui) {
  const ps = [];
  const walk = (it) => {
    if (it.items) it.items.forEach(walk);
    else if (["hslider", "vslider", "nentry", "button", "checkbox"].includes(it.type))
      ps.push({ label: it.label, address: it.address, index: it.index, min: it.min || 0, max: it.max || 1, init: it.init || 0, step: it.step || 0 });
  };
  (ui || []).forEach(walk);
  return ps;
}

// a Faust DSP as an insert: step(x) puts x on every input, computes one sample, and gives output 0. Synchronous,
// as faustwasm does it in its own worklets: an AudioWorklet does not always settle WebAssembly's promises.
export function faustInsert(module, json, sr) {
  const meta = typeof json === "string" ? JSON.parse(json) : json;
  const { imports, memory: imported } = importsFor(module);
  const instance = new WebAssembly.Instance(module, imports);
  const e = instance.exports;
  const memory = e.memory || imported;
  const nin = meta.inputs, nout = meta.outputs;
  if (nout < 1) throw new Error("the insert has no output");
  const base = meta.size, ptrs = 4, frame = 4;
  const inPtrs = base, outPtrs = inPtrs + nin * ptrs;
  const bufs = outPtrs + nout * ptrs;
  const need = bufs + (nin + nout) * frame + 64;
  if (memory.buffer.byteLength < need) memory.grow(Math.ceil((need - memory.buffer.byteLength) / 65536));
  const H32 = new Int32Array(memory.buffer), F32 = new Float32Array(memory.buffer);
  const inBuf = [], outBuf = [];
  for (let i = 0; i < nin; i++) { const p = bufs + i * frame; H32[(inPtrs >> 2) + i] = p; inBuf.push(p >> 2); }
  for (let o = 0; o < nout; o++) { const p = bufs + (nin + o) * frame; H32[(outPtrs >> 2) + o] = p; outBuf.push(p >> 2); }
  e.init(0, sr);
  const params = paramsOf(meta.ui);
  const out0 = outBuf[0];
  return {
    params, inputs: nin, outputs: nout,
    step(x) {
      for (let i = 0; i < inBuf.length; i++) F32[inBuf[i]] = x;
      e.compute(0, 1, inPtrs, outPtrs);
      const y = F32[out0];
      return Number.isFinite(y) ? y : 0;
    },
    set(address, value) {
      const p = params.find((q) => q.address === address || q.label === address);
      if (p) e.setParamValue(0, p.index, value);
    }
  };
}

class KairoticInsert extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.core = new HeadsCore(sampleRate, p.maxSeconds || 30, p.opts || {});
    this.inserts = {};     // writer id → insert (kept across presets, for a writer of the same id)
    this.since = 0;
    this.port.onmessage = (ev) => this.message(ev.data || {});
    this.port.postMessage({ ready: true, sr: sampleRate });
  }
  reattach() {
    for (const h of this.core.heads) if (h.role === "write") h.insert = this.inserts[h.id] || null;
  }
  message(m) {
    const c = this.core;
    if (m.preset) { c.span(m.preset.len, m.preset.circular); c.setHeads(m.preset.heads || []); this.reattach(); }
    if (m.set) { const { id, ...o } = m.set; c.set(id, o); }
    if (m.cue) c.cue(m.cue.id, m.cue.kind, m.cue.t);
    if (m.clear) c.clear();
    if (m.dry != null) c.dry = m.dry;
    if (m.param) { const ins = this.inserts[m.param.id]; if (ins) ins.set(m.param.address, m.param.value); }
    if (m.insert) {
      const { id } = m.insert;
      if (m.insert.off) { delete this.inserts[id]; this.reattach(); return; }
      try {
        const module = m.insert.module || new WebAssembly.Module(m.insert.code);
        const ins = faustInsert(module, m.insert.json, sampleRate);
        this.inserts[id] = ins; this.reattach();
        this.port.postMessage({ insert: { id, ok: true, inputs: ins.inputs, outputs: ins.outputs,
                                          params: ins.params.map(({ index, ...q }) => q) } });
      } catch (err) {
        this.port.postMessage({ insert: { id, error: String((err && err.message) || err) } });
      }
    }
  }
  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0];
    this.core.process(inp, out[0], out[1]);
    this.since += out[0].length;
    if (this.since >= sampleRate / 30) {
      this.since = 0;
      const st = this.core.state();
      st.inserts = Object.keys(this.inserts);
      this.port.postMessage({ state: st });
    }
    return true;
  }
}

registerProcessor("kairotic-insert", KairoticInsert);
