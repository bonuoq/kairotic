// SPDX-License-Identifier: MPL-2.0
// @kairotic/faust-units · the boxes of @kairotic/faust-units: Faust's own vocabulary, one box per element.
//
// Every unit has slots, in the order Faust takes them:
//   "in"    a signal input of the block (only library functions have these: the x of x : fi.lowpass(2, fc))
//   "sig"   a parameter that can be a signal: an inlet, or a number written after the box's name
//   "const" a parameter that must be a number known when compiling (the order N of a filter)
// The inlets of a box are its "in" and "sig" slots, in order. Numbers written after its name fill
// slots the way Faust fills them when the unit is called with arguments:
//   prim: from the end, as a partial application (`+ 0.5` is +(0.5), the right inlet)
//   lib:  the parameters in order (`fi.lowpass 2 1000` is fi.lowpass(2, 1000)); the "in" slots stay inlets
// An inlet that is wired takes the signal; otherwise the number written for it; otherwise its default.

const S = (name, def = 0, kind = "sig") => ({ name, def, kind });

// how a unit becomes Faust, given the text of each slot (already a name or a number)
const infix = (op) => (v) => `(${v[0]} ${op} ${v[1]})`;
const call = (f) => (v) => `${f}(${v.join(", ")})`;

export const UNITS = {};
function unit(name, spec) { UNITS[name] = { name, outs: 1, ...spec }; }

// ── primitives ──
for (const [op, base, doc] of [["+", "add", "sum"], ["-", "sub", "difference"], ["*", "mul", "product"],
  ["/", "div", "quotient"], ["%", "mod", "remainder"], ["^", "pow", "power"],
  ["<", "lt", "1 if less, else 0"], [">", "gt", "1 if greater, else 0"]]) {
  unit(op, { kind: "prim", base, doc, slots: [S("a"), S("b", op === "*" || op === "/" || op === "^" ? 1 : 0)], code: infix(op), infix: op });
}
for (const f of ["min", "max"]) unit(f, { kind: "prim", base: f + "_", doc: f + " of two signals", slots: [S("a"), S("b")], code: call(f) });
for (const [f, doc] of [["sin", "sine (radians)"], ["cos", "cosine (radians)"], ["tanh", "hyperbolic tangent: a soft clip"],
  ["abs", "absolute value"], ["sqrt", "square root"], ["exp", "e to the power"], ["log", "natural logarithm"], ["floor", "round down"]]) {
  unit(f, { kind: "prim", base: f + "_", doc, slots: [S("x")], code: call(f) });
}
unit("select2", { kind: "prim", base: "sel", doc: "a if s is 0, b if s is 1", slots: [S("s"), S("a"), S("b")], code: call("select2") });
// the one-sample delay: the only box a loop may go through (as gen~'s history)
unit("'", { kind: "prim", base: "z", doc: "one-sample delay: the box a feedback loop goes through", slots: [S("x")], code: (v) => `${v[0]}'`, mem: true });
unit("@", { kind: "prim", base: "del", doc: "delay by n samples", slots: [S("x"), S("n", 1)], code: infix("@"), infix: "@" });

// ── constants, inputs and outputs of the subpatch ──
unit("num", { kind: "num", base: "k", doc: "a number", slots: [], code: () => "0" });
unit("in", { kind: "io", base: "x", doc: "an audio input of the faust~ box: in 1, in 2…", slots: [], code: () => "_" });
unit("out", { kind: "io", base: "y", doc: "an audio output of the faust~ box: out 1, out 2…", slots: [S("x")], outs: 0, code: (v) => v[0] });
unit("ma.SR", { kind: "lib", base: "sr", doc: "the sample rate", slots: [], code: () => "ma.SR" });
unit("ma.PI", { kind: "lib", base: "pi", doc: "π", slots: [], code: () => "ma.PI" });

// ── controls: they become parameters of the faust~ box (and its knobs) ──
const q = (s) => JSON.stringify(String(s));
unit("hslider", { kind: "ui", base: "slider", doc: "a parameter: hslider name init min max step", ui: ["label", "init", "min", "max", "step"],
  defs: ["p", 0, 0, 1, 0.01], slots: [], code: (v, a) => `hslider(${q(a[0])}, ${a.slice(1).join(", ")})` });
unit("nentry", { kind: "ui", base: "entry", doc: "a numeric parameter: nentry name init min max step", ui: ["label", "init", "min", "max", "step"],
  defs: ["n", 0, 0, 1, 1], slots: [], code: (v, a) => `nentry(${q(a[0])}, ${a.slice(1).join(", ")})` });
unit("button", { kind: "ui", base: "button", doc: "1 while pressed: button name", ui: ["label"], defs: ["gate"], slots: [], code: (v, a) => `button(${q(a[0])})` });
unit("checkbox", { kind: "ui", base: "check", doc: "0 or 1: checkbox name", ui: ["label"], defs: ["on"], slots: [], code: (v, a) => `checkbox(${q(a[0])})` });

// ── library functions: called by name, never expanded ──
function lib(name, base, doc, slots) {
  const ins = slots.filter((s) => s.kind === "in"), params = slots.filter((s) => s.kind !== "in");
  unit(name, {
    kind: "lib", base, doc, slots,
    code: (v) => {
      const pv = [], iv = [];
      slots.forEach((s, i) => (s.kind === "in" ? iv : pv).push(v[i]));
      const f = params.length ? `${name}(${pv.join(", ")})` : name;
      return ins.length ? `(${iv.join(", ")} : ${f})` : f;
    }
  });
}
lib("os.osc", "osc", "sine oscillator", [S("freq", 440)]);
lib("os.sawtooth", "saw", "sawtooth oscillator (band-limited)", [S("freq", 440)]);
lib("os.square", "square", "square oscillator (band-limited)", [S("freq", 440)]);
lib("os.triangle", "tri", "triangle oscillator (band-limited)", [S("freq", 440)]);
lib("no.noise", "noise", "white noise", []);
lib("fi.lowpass", "lowpass", "Butterworth lowpass of order N", [S("x", 0, "in"), S("N", 2, "const"), S("fc", 1000)]);
lib("fi.highpass", "highpass", "Butterworth highpass of order N", [S("x", 0, "in"), S("N", 2, "const"), S("fc", 1000)]);
lib("fi.resonlp", "resonlp", "resonant lowpass: fc, Q, gain", [S("x", 0, "in"), S("fc", 1000), S("Q", 1), S("gain", 1)]);
lib("en.adsr", "adsr", "ADSR envelope: attack, decay (s), sustain (0–1), release (s), gate", [S("a", 0.01), S("d", 0.1), S("s", 0.8), S("r", 0.2), S("gate", 0)]);
lib("en.ar", "ar", "attack-release envelope: attack, release (s), gate", [S("a", 0.01), S("r", 0.2), S("gate", 0)]);
lib("ba.db2linear", "db2lin", "decibels → gain", [S("x", 0, "in")]);
lib("ba.midikey2hz", "key2hz", "MIDI key → Hz", [S("x", 0, "in")]);
lib("si.smoo", "smoo", "smooths a control signal", [S("x", 0, "in")]);
lib("de.delay", "delay", "delay of d samples, at most maxd", [S("x", 0, "in"), S("maxd", 65536, "const"), S("d", 0)]);

// a box whose text is not in the vocabulary is a Faust expression, kept as it is (opaque)
export const CODE = { name: "faust", kind: "code", base: "code", doc: "Faust code kept as it is", slots: [] };

export function unitOf(box) { return box.type === "faust" ? CODE : UNITS[box.type]; }

// the inlets of a box, as slot indices
export function inletSlots(u) { return u.slots.map((s, i) => [s, i]).filter(([s]) => s.kind !== "const").map(([, i]) => i); }

// box text → {type, args}; args are numbers, or strings for controls' labels
export function tokens(text) {
  const out = [], re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1] !== undefined ? { str: m[1] } : { tok: m[2] });
  return out;
}
export function readBox(text) {
  const t = String(text).trim();
  if (/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return { type: "num", args: [+t] };
  const ts = tokens(t);
  if (!ts.length) return null;
  const head = ts[0].tok;
  const u = head && UNITS[head];
  if (u && u.kind !== "num") {
    const rest = ts.slice(1);
    if (u.kind === "ui") {
      const args = u.defs.map((d, i) => {
        const r = rest[i];
        if (!r) return d;
        if (i === 0) return r.str !== undefined ? r.str : r.tok;
        return isFinite(+r.tok) ? +r.tok : d;
      });
      return { type: head, args };
    }
    if (rest.every((r) => r.tok !== undefined && isFinite(+r.tok))) {
      const n = u.kind === "io" ? 1 : u.slots.filter((s) => s.kind !== "in").length;
      if (rest.length <= Math.max(n, u.kind === "io" ? 1 : 0)) return { type: head, args: rest.map((r) => +r.tok) };
    }
  }
  return { type: "faust", args: [t] };
}
export function boxText(box) {
  const u = unitOf(box);
  if (box.type === "num") return fmt(box.args[0]);
  if (box.type === "faust") return box.args[0];
  if (u.kind === "ui") return [box.type].concat(box.args.map((a, i) => (i === 0 ? (/[\s"]/.test(a) || a === "" ? JSON.stringify(a) : a) : fmt(a)))).join(" ");
  return [box.type].concat((box.args || []).map(fmt)).join(" ");
}
export function fmt(x) { return typeof x === "number" ? String(+x.toPrecision(6)) : String(x); }
