// Study 31 · round trip: Faust code → boxes → code, compiled and run, sample by sample.
//
//   npm i @grame/faustwasm
//   node studies/31-units/tests/roundtrip.mjs node_modules/@grame/faustwasm/libfaust-wasm/libfaust-wasm.js [-v]
//
// For every program: the original compiles; it is read as boxes; the boxes give code; that code compiles
// with the same inputs and outputs and renders the same samples (buttons pressed); and reading the generated
// code again gives the same code (the boxes are a stable view).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const js = path.resolve(process.argv[2] || "node_modules/@grame/faustwasm/libfaust-wasm/libfaust-wasm.js");
let lib = null;
async function load() {
  if (lib) return lib;
  // libfaust-wasm.js is CommonJS inside a package that may say "type": "module": evaluate it as such
  const m = { exports: {} };
  new Function("module", "exports", "require", "__dirname", "__filename", fs.readFileSync(js, "utf8"))(m, m.exports, require, path.dirname(js), js);
  const FM = m.exports.default || m.exports;
  const data = fs.readFileSync(js.replace(/js$/, "data")), wasm = fs.readFileSync(js.replace(/js$/, "wasm"));
  const mod = await FM({ wasmBinary: wasm, getPreloadedPackage: () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) });
  lib = new mod.libFaustWasm();
  return lib;
}
const mathImports = () => ({ env: new Proxy({}, { get: (_, k) => {
  const n = String(k).replace(/^_+/, "").replace(/f$/, "");
  const extra = { fmod: (a, b) => a % b, remainder: (a, b) => a - Math.round(a / b) * b, rint: Math.round, isnan: isNaN, isinf: (x) => !isFinite(x), copysign: (a, b) => Math.sign(b) * Math.abs(a) };
  return extra[n] || Math[n] || (() => 0);
} }) });
async function compile(code) {
  const c = await load();
  try {
    const f = c.createDSPFactory("t", code, "-ftz 2", true);
    if (!f || !f.cfactory) return { ok: false, error: "fail" };
    const j = JSON.parse(f.json), wasm = new Uint8Array(f.data);
    c.deleteDSPFactory(f.cfactory);
    return { ok: true, ins: j.inputs, outs: j.outputs, render: (n, inputs) => render(wasm, j, n, inputs) };
  } catch (e) {
    let m = String(e);
    try { m = c.getErrorAfterException(); c.cleanupAfterException(); } catch (_) {}
    lib = null;
    return { ok: false, error: m };
  }
}
function render(wasm, j, n, inputs) {
  const ex = new WebAssembly.Instance(new WebAssembly.Module(wasm), mathImports()).exports, mem = ex.memory;
  const ni = j.inputs, no = j.outputs;
  let p = (j.size + 64 + 15) & ~15;
  const ptrIns = p; p += 4 * Math.max(1, ni);
  const ptrOuts = p; p += 4 * Math.max(1, no); p = (p + 15) & ~15;
  const need = p + (ni + no) * n * 4 + 1024;
  if (mem.buffer.byteLength < need) mem.grow(Math.ceil((need - mem.buffer.byteLength) / 65536));
  const heap = new DataView(mem.buffer), outs = [];
  for (let i = 0; i < ni; i++) { heap.setInt32(ptrIns + 4 * i, p, true); new Float32Array(mem.buffer, p, n).set(inputs[i]); p += n * 4; }
  for (let i = 0; i < no; i++) { heap.setInt32(ptrOuts + 4 * i, p, true); outs.push(p); p += n * 4; }
  ex.init(0, 44100);
  // every button pressed and every checkbox ticked, so a gated sound makes a sound
  const walk = (items) => items.forEach((it) => { if (it.items) walk(it.items); else if (it.type === "button" || it.type === "checkbox") new Float32Array(mem.buffer)[it.index >> 2] = 1; });
  walk(j.ui || []);
  ex.compute(0, n, ptrIns, ptrOuts);
  return outs.map((q) => Array.from(new Float32Array(mem.buffer, q, n)));
}
const K = new URL("../kairotic/", import.meta.url).href;
const { toGraphAsync } = await import(K + "parse.mjs");
const { toFaust } = await import(K + "graph.mjs");
const I = 'import("stdfaust.lib");\n';
const cases = {
  noise_lp: I + "process = no.noise : fi.lowpass(2, 800) * 0.3;",
  onepole: I + "process = _ : + ~ *(0.9);",
  slider: I + 'process = os.osc(hslider("freq", 440, 50, 2000, 1)) * 0.2;',
  fm: I + "process = os.osc(440 + os.osc(110) * 200) * 0.2;",
  split: I + "process = no.noise <: fi.lowpass(2, 500), fi.highpass(2, 3000);",
  merge: I + "process = os.osc(220), os.osc(330) :> _ * 0.2;",
  letrec: I + "process = y letrec { 'y = 0.99 * y + no.noise * 0.01; };",
  code: I + "process = no.noise * 0.1 : re.mono_freeverb(0.5, 0.5, 0.5, 0.5);",
  stereo_code: I + "process = no.noise * 0.1 <: re.stereo_freeverb(0.5, 0.5, 0.5, 23);",
  inputs: I + "process(l, r) = (l + r) * 0.5, l - r;",
  delay: I + "process = _ <: _, (_ @ 100) * 0.5 :> _;",
  fbdelay: I + "process = + ~ (@(99) : *(0.6));",
  letrec2: I + "process(x) = a letrec { 'z = a; } with { a = 1; };",
  partial: I + "process = no.noise : *(0.25) : min(0.2) : max(-0.2);",
  synth: I + `gate = button("gate");
freq = hslider("freq", 220, 40, 1000, 0.1);
wave = hslider("wave", 0.3, 0, 1, 0.01);
env = en.adsr(0.01, 0.2, 0.6, 0.3, gate);
osc = os.sawtooth(freq) * (1 - wave) + os.square(freq) * wave;
src = osc * 0.9 + no.noise * 0.1;
fc = 300 * 2 ^ (4 * env);
process = src : fi.resonlp(fc, 4, 1) * env * 0.3;`,
};
const { EXAMPLES } = await import(K + "examples.mjs");
for (const e of EXAMPLES) cases["ex_" + e.key] = e.code;
const N = 8192;
const noiseIn = (n) => Array.from({ length: n }, (_, i) => Math.sin(i * 0.37) * 0.5 + ((i * 7919) % 13) / 26);
const cache = new Map();
const arityOf = async (t) => { const r = await compile(I + "process = " + t + ";"); return r.ok ? { ins: r.ins, outs: r.outs } : null; };
let fails = 0;
for (const [k, src] of Object.entries(cases)) {
  const a = await compile(src);
  if (!a.ok) { console.log("✗", k, "original does not compile:", a.error); fails++; continue; }
  let g, code, code2;
  try {
    g = await toGraphAsync(src, arityOf, cache);
    code = toFaust(g);
    const g2 = await toGraphAsync(code, arityOf, cache);
    code2 = toFaust(g2);
  } catch (e) { console.log("✗", k, "boxes:", e.message); fails++; continue; }
  const b = await compile(code);
  if (!b.ok) { console.log("✗", k, "generated does not compile:", b.error, "\n" + code); fails++; continue; }
  const ins = Array.from({ length: a.ins }, () => noiseIn(N));
  // a button: compare with it pressed — set through the default 0, so render the same anyway
  const ra = a.render(N, ins), rb = b.render(N, ins);
  let err = 0, rms = 0;
  ra.forEach((ch) => ch.forEach((v) => { rms += v * v; }));
  rms = Math.sqrt(rms / (N * Math.max(1, ra.length)));
  ra.forEach((ch, c) => ch.forEach((v, i) => { err = Math.max(err, Math.abs(v - rb[c][i])); }));
  const same = code === code2;
  const ok = a.ins === b.ins && a.outs === b.outs && err < 1e-5 && same;
  if (!ok) fails++;
  console.log(ok ? "✓" : "✗", k.padEnd(12), `${g.boxes.length} boxes ${g.wires.length} wires · io ${b.ins}/${b.outs} · rms ${rms.toFixed(3)} · max diff ${err.toExponential(1)} · stable ${same}`);
  if (!ok || process.argv.includes("-v")) console.log(code + (same ? "" : "\n--- second pass ---\n" + code2));
}
console.log(fails ? fails + " failed" : "all passed");
process.exitCode = fails ? 1 : 0;
