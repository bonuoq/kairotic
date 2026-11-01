// Study 35 · a faust~ played offline: compiled code (its WebAssembly and its JSON) rendered to samples.
//
// The DSP's own interface does the work (init, setParamValue, compute), with the dsp at the start of its
// memory as Faust lays it out (its size in the JSON); its imports (the maths it calls: _powf, _tanhf…) are
// read from the module itself, so the same code runs whatever version of libfaust compiled it — the page's
// faustwasm, or libfaust in Node for the tests. A `gate` button, if the code has one, is held for the first
// GATE seconds, as a note is played.

const MATH = {
  fmod: (a, b) => a % b, remainder: (a, b) => a - Math.round(a / b) * b, rint: Math.round, round: Math.round,
  isnan: (x) => (Number.isNaN(x) ? 1 : 0), isinf: (x) => (Number.isFinite(x) || Number.isNaN(x) ? 0 : 1),
  copysign: (a, b) => Math.sign(b || 1) * Math.abs(a), exp10: (x) => Math.pow(10, x), log10: Math.log10
};
function imports(module) {
  const env = {};
  for (const imp of WebAssembly.Module.imports(module)) {
    if (imp.kind === "function") {
      const n = imp.name.replace(/^_+/, "").replace(/f$/, "");
      env[imp.name] = MATH[n] || Math[n] || Math[imp.name.replace(/^_+/, "")] || (() => 0);
    } else if (imp.kind === "global") env[imp.name] = new WebAssembly.Global({ value: "i32", mutable: false }, 0);
    else if (imp.kind === "memory") env[imp.name] = new WebAssembly.Memory({ initial: 16 });
    else if (imp.kind === "table") env[imp.name] = new WebAssembly.Table({ initial: 0, element: "anyfunc" });
  }
  return { env };
}

// the controls of a faust~ as the search sees them: sliders (with their scale) and buttons
export function controls(json) {
  const walk = (xs) => xs.flatMap((i) => (i.items ? walk(i.items) : [i]));
  return walk(json.ui || []).map((i) => {
    const meta = Object.assign({}, ...(i.meta || []));
    return { type: i.type, label: i.label, address: i.address, index: i.index, init: +i.init || 0, min: +i.min || 0, max: +(i.max ?? 1),
      step: +i.step || 0, scale: meta.scale || "lin", unit: meta.unit || "" };
  });
}

// a renderer for one compiled DSP: render(values, { dur, gate, sr }) → Float32Array (its first output)
export function renderer(code, json, { sr = 44100, block = 256 } = {}) {
  const module = code instanceof WebAssembly.Module ? code : new WebAssembly.Module(code);
  const ctl = controls(json), gateCtl = ctl.find((c) => c.type === "button" && /^gate$/i.test(c.label));
  return function render(values = {}, { dur = 1.0, gate = 0.65 } = {}) {
    const ex = new WebAssembly.Instance(module, imports(module)).exports, mem = ex.memory;
    const ni = json.inputs, no = Math.max(1, json.outputs), n = Math.round(dur * sr);
    let p = (json.size + 64 + 15) & ~15;
    const ptrIns = p; p += 4 * Math.max(1, ni);
    const ptrOuts = p; p += 4 * no; p = (p + 15) & ~15;
    const need = p + (ni + no) * block * 4 + 1024;
    if (mem.buffer.byteLength < need) mem.grow(Math.ceil((need - mem.buffer.byteLength) / 65536));
    const view = () => new DataView(mem.buffer);
    const bufs = [];
    for (let i = 0; i < ni; i++) { view().setInt32(ptrIns + 4 * i, p, true); p += block * 4; }   // inputs stay silent
    for (let i = 0; i < no; i++) { view().setInt32(ptrOuts + 4 * i, p, true); bufs.push(p); p += block * 4; }
    ex.init(0, sr);
    for (const c of ctl) if (c.label in values && c.type !== "button") ex.setParamValue(0, c.index, values[c.label]);
    const y = new Float32Array(n), gateAt = Math.round(gate * sr);
    if (gateCtl) ex.setParamValue(0, gateCtl.index, 1);
    for (let at = 0; at < n; at += block) {
      // the gate is released at its time (to the nearest block)
      if (gateCtl && at >= gateAt && at - block < gateAt) ex.setParamValue(0, gateCtl.index, 0);
      const k = Math.min(block, n - at);
      ex.compute(0, k, ptrIns, ptrOuts);
      y.set(new Float32Array(mem.buffer, bufs[0], k), at);
    }
    for (let i = 0; i < n; i++) if (!Number.isFinite(y[i])) y[i] = 0;
    return y;
  };
}
