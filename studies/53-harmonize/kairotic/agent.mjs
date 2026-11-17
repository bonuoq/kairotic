// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 53 · the agent's sub-patch: what Claude builds inside an `agent` box, and how it runs.
//
// A sub-patch is EDN: boxes by id, each of a class with its arguments, and wires between them —
//
//   {:boxes {:m {:box :melody :args {:example "ah-vous-dirai-je"}}
//            :b {:box :bass   :args {:temp 0.4}}
//            :i {:box :inner}
//            :t {:box :tree   :args {:tempo 100}}}
//    :wires [[:m :b] [:b :i] [:i :t]]
//    :defs  {:octave-up {:doc "the melody an octave higher" :js "return {...input, …}"}}}
//
// The classes are the kernel's (BOXES: melody, bass, inner, tree, mei) plus `code` (a box whose JavaScript Claude
// writes) and whatever the patch defines in :defs — new classes, used like the others, which is how Claude makes a
// component when none fits. A wire [:a :b] sends a's value to b's first inlet; [:a :b 1] to its second. The patch runs
// once, in the order of its wires (a loop is refused), and every box's value is kept, so the view can show what each
// one made.

import { harmonize, harmonizeAll, innerVoices, chordsOf, treeOf, meiOf, keyOf, codeOf, melodyUnits, MELODIES, STYLE } from "./harmonize.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/** What a code box sees as `kernel`: the study's functions, to build on rather than start anew. */
export const KERNEL = { harmonize, harmonizeAll, innerVoices, chordsOf, treeOf, meiOf, keyOf, codeOf, melodyUnits, MELODIES, rng };

// ─── the classes ───
export const BOXES = {
  melody: {
    inlets: 0,
    doc: "The melody to harmonize. args: {:example id} (one of the study's melodies) or {:text \"C5 C5 G5 - …\" (a note a unit, - holds) :key {:tonic \"C\" :mode \"major\"} :meter [2 4] :phase 0 :cadences [{:at 6 :kind \"half\"}]}. Out: a spec {melody, key, meter, phase, cadences, name}. With an inlet wired, it passes the melody it gets (the agent box's own input).",
    run: (inputs, args) => {
      if (inputs[0]) return inputs[0];
      if (args.example) { const m = MELODIES[args.example]; if (!m) throw new Error(`no example melody ${args.example} (there are ${Object.keys(MELODIES).join(", ")})`); return { ...m }; }
      if (!args.text) throw new Error("melody: give :example or :text");
      return { name: "a melody", melody: args.text, key: args.key || { tonic: "C" }, meter: args.meter || [2, 4], phase: args.phase || 0, cadences: args.cadences };
    },
  },
  bass: {
    inlets: 1,
    doc: "Writes the bass under the melody by the rules of two-part counterpoint (Study 51 turned upside down): it begins on ①, cadences ⑤–①, no parallels with the melody, dissonances only as passing tones or suspensions; among what the rules allow the engine prefers ① ④ ⑤, the melody a chord tone, changes on strong units. args: {:temp 0.6 (0: the cheapest, higher: freer) :seed n :sample true (uniformly among all) :weights {:degree 1.5 :chord-tone 1.5 :rhythm 1 :leap-size 0.5 …} :lo -7 :hi 7 (range in degrees) :maxHold 4 :cadences […]}. In: a melody spec. Out: {spec, bass (codes), names, futures, H}.",
    run: (inputs, args) => {
      const spec = { ...inputs[0], ...pick(args, ["lo", "hi", "maxHold", "weights", "cadences", "strongEvery"]) };
      const H = harmonize(spec);
      const r = rng(args.seed ?? 1);
      const B = args.sample ? H.sample(r) : H.engine({ temp: args.temp ?? 0.6, r });
      if (!B) throw new Error("no bass fits this melody under the rules");
      return { spec, H, bass: B, names: B.map(H.name), futures: String(H.count()), figures: H.figures(B).map((f) => f.fig) };
    },
  },
  inner: {
    inlets: 1,
    doc: "Realizes the figures as four-part chords: over each bass note its 5/3 or 6/3 (rule of the octave), the cadential 6/4, the leading tone raised in minor; alto and tenor chosen for the whole piece by the shortest way without parallels. args: {:alto [4 14] :tenor [-1 10]} (ranges in degrees, 7 = the tonic above the bass's). In: a bass. Out: {spec, H, parts {soprano alto tenor bass} (codes), names, chords, parallels}.",
    run: (inputs, args) => {
      const b = inputs[0]; if (!b || !b.H) throw new Error("inner: wire a bass box into it");
      const iv = innerVoices(b.H, b.bass, pick(args, ["alto", "tenor"]));
      if (iv.error) throw new Error(iv.error);
      const parts = { soprano: b.H.melody, alto: iv.alto, tenor: iv.tenor, bass: b.bass };
      return { spec: b.spec, H: b.H, parts, names: mapVals(parts, (v) => v.map(b.H.name)), chords: iv.chords.map((c) => c.fig), parallels: iv.parallels };
    },
  },
  tree: {
    inlets: 1,
    doc: "The parts as a Kairotic musical tree (EDN text): two staves, upper (soprano + alto) and lower (tenor + bass). args: {:tempo 96 :beatsPerUnit 1}. In: {H, parts} (from inner, or from a code box that returns the same shape).",
    run: (inputs, args) => { const v = inputs[0]; if (!v || !v.parts) throw new Error("tree: wire four parts into it"); return treeOf(v.H, v.parts, { meter: v.spec?.meter, ...pick(args, ["tempo", "beatsPerUnit"]) }); },
  },
  score: {
    inlets: 1,
    doc: "What the page shows and plays: in, {H, parts} (four parts as codes a unit) or {H, voices: [[{code, dur} …] …], staves: [[0 1] [2 3]]} for any texture a code box makes (an Alberti bass, arpeggios: notes of their own durations, in units). It passes its input on; the page draws the last score box of the patch.",
    run: (inputs) => { const v = inputs[0]; if (!v || !(v.parts || v.voices)) throw new Error("score: wire parts or voices into it"); return v; },
  },
  code: {
    inlets: 2,
    doc: "JavaScript Claude writes: args {:js \"…\"}, the body of a function (input, inputs, args, kernel) that returns the box's value. kernel has harmonize, innerVoices, chordsOf, treeOf, keyOf, codeOf, melodyUnits, MELODIES, rng. A note is a code: 2·degree + raised (degree 0 the tonic of the bass's octave, 7 the next); H.name(code) its name, H.key.semi(degree, raised) its semitones.",
    run: (inputs, args) => runJs(args.js, inputs, args),
  },
};

function runJs(js, inputs, args) {
  if (typeof js !== "string" || !js.trim()) throw new Error("code: no :js");
  let f;
  try { f = new Function("input", "inputs", "args", "kernel", js); } catch (e) { throw new Error(`code: ${e.message}`); }
  return f(inputs[0], inputs, args, KERNEL);
}

const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const mapVals = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));

// ─── EDN: the little of it a patch needs (maps, vectors, lists, keywords, strings, numbers, true/false/nil) ───
export function readEdn(text) {
  let i = 0;
  const s = String(text);
  const ws = () => { for (;;) { while (i < s.length && /[\s,]/.test(s[i])) i++; if (s[i] === ";") { while (i < s.length && s[i] !== "\n") i++; } else break; } };
  function val() {
    ws();
    const ch = s[i];
    if (ch === undefined) throw new Error("EDN: the text ends too soon");
    if (ch === "{") { i++; const o = {}; for (;;) { ws(); if (s[i] === "}") { i++; return o; } const k = val(); const v = val(); o[typeof k === "string" ? k : JSON.stringify(k)] = v; } }
    if (ch === "[" || ch === "(") { const close = ch === "[" ? "]" : ")"; i++; const a = []; for (;;) { ws(); if (s[i] === close) { i++; return a; } a.push(val()); } }
    if (ch === "\"") {
      i++; let out = "";
      while (i < s.length && s[i] !== "\"") { if (s[i] === "\\") { i++; const e = s[i]; out += e === "n" ? "\n" : e === "t" ? "\t" : e; } else out += s[i]; i++; }
      if (s[i] !== "\"") throw new Error("EDN: a string is not closed");
      i++; return out;
    }
    if (ch === "}" || ch === "]" || ch === ")") throw new Error(`EDN: an unexpected ${ch}`);
    let j = i; while (j < s.length && !/[\s,{}\[\]()";]/.test(s[j])) j++;
    const tok = s.slice(i, j); i = j;
    if (tok[0] === ":") return tok.slice(1);
    if (tok === "true") return true;
    if (tok === "false") return false;
    if (tok === "nil") return null;
    if (/^[-+]?\d+(\.\d+)?$/.test(tok)) return Number(tok);
    if (/^[-+]?\d+\/\d+$/.test(tok)) { const [a, b] = tok.split("/").map(Number); return a / b; }
    return tok;   // a symbol, kept as its name
  }
  const v = val(); ws();
  if (i < s.length) throw new Error("EDN: more than one value");
  return v;
}

/** A patch from EDN text (or an object already read): {boxes, wires, defs}, its keys checked. */
export function patchOf(src) {
  const p = typeof src === "string" ? readEdn(src) : src;
  if (!p || typeof p !== "object" || !p.boxes) throw new Error("a patch is a map with :boxes and :wires");
  const wires = (p.wires || []).map((w) => {
    if (!Array.isArray(w) || w.length < 2) throw new Error(`a wire is [:from :to] or [:from :to inlet]: ${JSON.stringify(w)}`);
    return { from: String(w[0]), to: String(w[1]), inlet: w[2] ?? 0 };
  });
  return { boxes: p.boxes, wires, defs: p.defs || {}, about: p.about || "" };
}

/** The classes a patch can use: the kernel's and its own :defs. */
export function classesOf(P) {
  const own = Object.fromEntries(Object.entries(P.defs || {}).map(([k, d]) => [k, {
    inlets: d.inlets ?? 1, doc: d.doc || "(a class of this patch)", own: true,
    run: (inputs, args) => runJs(d.js, inputs, { ...(d.args || {}), ...args }),
  }]));
  return { ...BOXES, ...own };
}

/**
 * Runs a patch once: each box when its inputs are there, in the order of the wires. input: what the agent box's own
 * inlet brings (it reaches the boxes of class melody with nothing wired into them). → {values, order, errors, error}.
 */
export async function runPatch(P, input = null) {
  const C = classesOf(P), ids = Object.keys(P.boxes);
  for (const id of ids) { const cls = P.boxes[id].box; if (!C[cls]) return { error: `box ${id}: there is no class ${cls}`, values: {}, order: [] }; }
  for (const w of P.wires) for (const end of [w.from, w.to]) if (!P.boxes[end]) return { error: `a wire names ${end}, which is not a box`, values: {}, order: [] };
  // the order: Kahn's, the boxes as written breaking ties
  const indeg = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const w of P.wires) indeg[w.to]++;
  const order = [], queue = ids.filter((id) => indeg[id] === 0);
  while (queue.length) { const id = queue.shift(); order.push(id); for (const w of P.wires) if (w.from === id && --indeg[w.to] === 0) queue.push(w.to); }
  if (order.length < ids.length) return { error: `a loop: ${ids.filter((id) => !order.includes(id)).join(", ")}`, values: {}, order };
  const values = {}, errors = {};
  for (const id of order) {
    const b = P.boxes[id], cls = C[b.box];
    const inputs = [];
    for (const w of P.wires) if (w.to === id) inputs[w.inlet] = values[w.from];
    if (b.box === "melody" && !inputs.length && input) inputs[0] = input;
    if (P.wires.some((w) => w.to === id && errors[w.from])) { errors[id] = "an input failed"; continue; }
    try { values[id] = await cls.run(inputs, b.args || {}); }
    catch (e) { errors[id] = (e && e.message) || String(e); }
  }
  const first = Object.entries(errors).find(([, e]) => e !== "an input failed");
  return { values, order, errors, error: first ? `box ${first[0]} (${P.boxes[first[0]].box}): ${first[1]}` : null };
}

/** The last box of the patch that has something to show: a score (or four parts) and a tree. */
export function outputOf(P, R) {
  const show = [...R.order].reverse().find((id) => { const v = R.values[id]; return v && typeof v === "object" && (v.parts || v.voices); });
  const tree = [...R.order].reverse().find((id) => typeof R.values[id] === "string" && R.values[id].startsWith("[:piece"));
  return { show: show ? R.values[show] : null, showId: show || null, tree: tree ? R.values[tree] : null };
}

// ─── what Claude is told ───
export function catalogText() {
  return Object.entries(BOXES).map(([k, b]) => `:${k} (${b.inlets} inlet${b.inlets === 1 ? "" : "s"}) — ${b.doc}`).join("\n\n");
}

export const EXAMPLE_PATCH = `{:about "a basic harmonization: the bass by the rules, the chords by the rule of the octave"
 :boxes {:m {:box :melody}
         :b {:box :bass :args {:temp 0.4}}
         :i {:box :inner}
         :s {:box :score}
         :t {:box :tree}}
 :wires [[:m :b] [:b :i] [:i :s] [:i :t]]}`;

/** The prompt: what an agent box is, its classes, the melody it got and what is asked of it. */
export function promptFor(request, melody, previous) {
  return [
    "You build a sub-patch inside an `agent` box of Kairotic, a patcher for music written in ClojureScript and EDN. The box receives a melody and a request; what you build is a patch of boxes that, run once, makes the result. Prefer the boxes that exist (they carry the rules of counterpoint and harmony of the earlier studies); write a `code` box, or a new class in :defs, only for what none of them does, and keep it small.",
    "",
    "THE PATCH is EDN: {:about \"one line\" :boxes {id {:box :class :args {…}} …} :wires [[:from :to] [:from :to inlet] …] :defs {:new-class {:doc \"…\" :inlets 1 :js \"…function body…\"}}}. A wire sends a box's value to an inlet of another (0 by default). Every patch starts with a :melody box (nothing wired into it: it receives the agent's melody) and ends with a :score box, which the page draws and plays (and, if you like, a :tree box).",
    "",
    "THE CLASSES:",
    catalogText(),
    "",
    "A CODE BOX or a class of :defs: its :js is the body of function (input, inputs, args, kernel) { … } returning the box's value — plain JavaScript, no imports, no DOM, no network. Notes are codes (2·degree + raised). To make a texture (an Alberti bass, broken chords), return {H: input.H, spec: input.spec, voices: [[{code, dur} …] …] (dur in units, the voices' durations each summing to the melody's units), staves: [[0 1] [2 3]] (which voices share a staff, the first above)} and wire it into :score.",
    "",
    "AN EXAMPLE:", EXAMPLE_PATCH,
    "",
    `THE MELODY: ${melody.name || "a melody"} — ${melody.melody} (key ${melody.key?.tonic || "C"} ${melody.key?.mode || "major"}, meter ${(melody.meter || [2, 4]).join("/")}, a unit is a beat; cadences ${JSON.stringify(melody.cadences || "a perfect one at the end")}).`,
    previous ? `\nYOUR LAST PATCH:\n${previous.edn}\nIT FAILED: ${previous.error}\nMend it.` : "",
    "",
    `THE REQUEST: ${request}`,
    "",
    "Answer with one short paragraph saying what the patch does and why, then the patch in a single ```edn block.",
  ].join("\n");
}

/** The EDN block of an answer. */
export function ednOf(answer) {
  const m = /```(?:edn|clojure|clj)?\s*\n([\s\S]*?)```/.exec(answer || "");
  return m ? m[1].trim() : null;
}

export { STYLE, MELODIES };
