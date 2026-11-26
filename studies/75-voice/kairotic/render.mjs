// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 75 · a faust~ played offline along curves: compiled code (its WebAssembly and its JSON) rendered
// to samples, its sliders moved every block to the curves' values (interpolated between frames), as a box sending
// it messages would. The DSP's own interface does the work (init, setParamValue, compute), as in Study 35; a slider
// the curves do not name keeps the value given in `fixed` or its own.

const MATH = {
  fmod: (a, b) => a % b, remainder: (a, b) => a - Math.round(a / b) * b, rint: Math.round, round: Math.round,
  isnan: (x) => (Number.isNaN(x) ? 1 : 0), isinf: (x) => (Number.isFinite(x) || Number.isNaN(x) ? 0 : 1),
  copysign: (a, b) => Math.sign(b || 1) * Math.abs(a), exp10: (x) => Math.pow(10, x), log10: Math.log10,
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

/** A faust~'s sliders: [{label, index, init, min, max}]. */
export function sliders(json) {
  const walk = (xs) => xs.flatMap((i) => (i.items ? walk(i.items) : [i]));
  return walk(json.ui || []).filter((i) => /slider|nentry/.test(i.type))
    .map((i) => ({ label: i.label, index: i.index, init: +i.init || 0, min: +i.min || 0, max: +(i.max ?? 1) }));
}

/** play(curves, {fixed}) → Float32Array: the DSP's first output, as long as the curves. */
export function player(code, json, { sr = 44100, block = 64 } = {}) {
  const module = code instanceof WebAssembly.Module ? code : new WebAssembly.Module(code);
  const cs = sliders(json);
  return function play({ frames, hop }, { fixed = {} } = {}) {
    const ex = new WebAssembly.Instance(module, imports(module)).exports, mem = ex.memory;
    const ni = json.inputs, no = Math.max(1, json.outputs), n = Math.round(frames.length * hop * sr);
    let p = (json.size + 64 + 15) & ~15;
    const ptrIns = p; p += 4 * Math.max(1, ni);
    const ptrOuts = p; p += 4 * no; p = (p + 15) & ~15;
    const need = p + (ni + no) * block * 4 + 1024;
    if (mem.buffer.byteLength < need) mem.grow(Math.ceil((need - mem.buffer.byteLength) / 65536));
    const view = () => new DataView(mem.buffer), bufs = [];
    for (let i = 0; i < ni; i++) { view().setInt32(ptrIns + 4 * i, p, true); p += block * 4; }
    for (let i = 0; i < no; i++) { view().setInt32(ptrOuts + 4 * i, p, true); bufs.push(p); p += block * 4; }
    ex.init(0, sr);
    const clamp = (c, v) => Math.min(c.max, Math.max(c.min, v));
    for (const c of cs) if (c.label in fixed) ex.setParamValue(0, c.index, clamp(c, fixed[c.label]));
    const moving = cs.filter((c) => frames.length && c.label in frames[0]);
    const y = new Float32Array(n);
    for (let at = 0; at < n; at += block) {
      const pos = (at + block / 2) / sr / hop, i = Math.min(frames.length - 1, Math.floor(pos));
      const j = Math.min(frames.length - 1, i + 1), t = Math.min(1, Math.max(0, pos - i)), a = frames[i], b = frames[j];
      for (const c of moving) ex.setParamValue(0, c.index, clamp(c, a[c.label] + (b[c.label] - a[c.label]) * t));
      const k = Math.min(block, n - at);
      ex.compute(0, k, ptrIns, ptrOuts);
      y.set(new Float32Array(mem.buffer, bufs[0], k), at);
    }
    for (let i = 0; i < n; i++) if (!Number.isFinite(y[i])) y[i] = 0;
    return y;
  };
}

/** Voice and noise summed, the noise × `noise`, and the whole brought to a peak of `peak`. */
export function mix(voice, noise, { noise: g = 1, peak = 0.8 } = {}) {
  const n = Math.max(voice.length, noise.length), y = new Float32Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) { y[i] = (voice[i] || 0) + g * (noise[i] || 0); m = Math.max(m, Math.abs(y[i])); }
  if (m > 0) for (let i = 0; i < n; i++) y[i] *= peak / m;
  return y;
}
