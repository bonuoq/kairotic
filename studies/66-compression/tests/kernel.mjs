// SPDX-License-Identifier: MPL-2.0
// Study 66 · compression: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/66-compression/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { compress, lossless, expand, stream, notesOf, chordOf, harmony, harmonySpans, describeRule, written, codeLength, treeOf } from "../kairotic/compress.mjs";

const load = async (id) => {
  const url = new URL(`../data/${id}.json`, import.meta.url);
  if (typeof window !== "undefined") return (await fetch(url)).json();
  const { readFileSync } = await import("node:fs");
  return JSON.parse(readFileSync(url, "utf8"));
};

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const P = {};
  for (const id of ["bwv846-prelude", "bwv999-prelude", "bwv1007-prelude", "bwv1009-prelude"]) P[id] = compress(await load(id));
  notes.push(Object.entries(P).map(([k, c]) => `${k} ${c.raw} → ${c.bits} bits (${(c.ratio * 100).toFixed(1)} %, ${c.rules.length} rules)`).join(" · "));

  // the description is the piece
  is("every description is written out again, the same notes (lossless)", Object.values(P).every(lossless));
  const n = await load("bwv846-prelude");
  is("a stream and back: the same notes", JSON.stringify(notesOf(stream(n))) === JSON.stringify(n.slice().sort((a, b) => a[0] - b[0] || a[2] - b[2])));

  // the C major prelude: one figure over its chords
  const c = P["bwv846-prelude"];
  const F = c.rules[0];
  is("BWV 846: its first rule is the bar's figure — a broken chord over five notes, 16 notes, both halves alike",
     F.kind === "figure" && F.k === 5 && F.idx.join(" ") === "0 1 2 3 4 2 3 4 0 1 2 3 4 2 3 4");
  is("… used in 32 bars", c.items.filter((x) => x.rule === F).length === 32);
  is("… a third of the notes written out (under 32 %)", c.ratio < 0.32);
  is("… and what is left is its harmony: C, Dm7/C, G7/B, C, Am/C, D7/C, G/B, Cmaj7/B",
     harmony(c).slice(0, 8).join(" ") === "C Dm7/C G7/B C Am/C D7/C G/B Cmaj7/B");
  is("… the dominant pedal of its end named over its bass", harmony(c).slice(23).some((h) => h === "G7(+C)"));
  const hs = harmonySpans(c, { bar: 16 });
  is("… and where no figure is, read from its notes: the cadence over the tonic pedal, C7 – F/C – G7 (B over C) – C, a chord a bar",
     hs.length === 35 && hs.slice(31).map((h) => h.name).join(" ") === "C7 F/C G7/B(+C) C" && hs.filter((h) => h.read).length === 3 && hs[34].pitches[0] === 36);
  is("… a line's bars read too (BWV 1009, a chord a bar of 3/4)", harmonySpans(P["bwv1009-prelude"], { bar: 12 }).filter((h) => h.name !== "?").length > 70);

  // the others
  const r999 = P["bwv999-prelude"], c1007 = P["bwv1007-prelude"], c1009 = P["bwv1009-prelude"];
  is("BWV 999: a figure over six notes, repeated in pairs of bars (under 45 %)",
     r999.rules[0].kind === "figure" && r999.rules[0].k === 6 && r999.items.some((x) => x.rule && x.rule.kind === "repeat") && r999.ratio < 0.45);
  is("BWV 1007: the string-crossing figure over four notes, its first bars (under 60 %)",
     c1007.rules[0].kind === "figure" && c1007.rules[0].k === 4 && written(c1007)[0].startsWith("F1(G3 D4 B4 A4)") && c1007.ratio < 0.6);
  is("BWV 1009: scales and arpeggios as motifs (under 60 %)", c1009.rules.some((r) => r.kind === "motif") && c1009.ratio < 0.6);
  is("figuration over harmony compresses more than a line: the keyboard preludes before the cello's",
     c.ratio < r999.ratio && r999.ratio < c1007.ratio && r999.ratio < c1009.ratio);

  // the rules, in words
  is("a figure in words", describeRule(F) === "broken chord over 5 notes: 0 1 2 3 4 2 3 4 0 1 2 3 4 2 3 4");
  is("a motif in words", describeRule({ kind: "motif", steps: [0, 2, 4, 5, 7], rhythm: [] }) === "motif of 5 notes (0 2 4 5 7), rising");

  // chords
  is("chords: a triad, a seventh, an inversion", chordOf([48, 52, 55]).name === "C" && chordOf([43, 47, 50, 53]).name === "G7" && chordOf([52, 55, 60]).name === "C/E");
  is("… a note that is not of it named after it (a neighbour): G(+A)", chordOf([55, 62, 71, 69]).name === "G(+A)");

  // a small piece: a figure found, a repeat, and the way back
  const small = [];
  let t = 0;
  for (const ch of [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67]])
    for (let k = 0; k < 2; k++) for (const p of [ch[0], ch[1], ch[2], ch[1]]) { small.push([t, 1, p]); t++; }
  const s = compress(small, { maxL: 8 });
  is("a small piece: one figure over three notes (both halves of a chord in it), four uses, the chords named",
     s.rules.length === 1 && s.rules[0].k === 3 && s.rules[0].idx.join("") === "01210121" && s.items.length === 4 &&
     written(s).join(" · ") === "F1(C4 E4 G4) C · F1(C4 F4 A4) F/C · F1(B3 D4 G4) G/B · F1(C4 E4 G4) C" && lossless(s));
  is("… and its description is shorter", s.bits < s.raw);

  // the uses as a listener hears them (bits.mjs; discussion #399)
  const K = Object.fromEntries(Object.entries(P).map(([k, c]) => [k, codeLength(c)]));
  notes.push("heard: " + Object.entries(K).map(([k, x]) => `${k} ${x.bits} bits (${(x.ratio * 100).toFixed(1)} %)`).join(" · "));
  is("heard, BWV 846 is told in under a fifth of its notes (its figure's voices hold or move by step)", K["bwv846-prelude"].ratio < 0.2);
  is("… every piece shorter heard than at fixed prices, and shorter with its voices than without",
     Object.entries(P).every(([k, c]) => K[k].bits < c.bits && K[k].bits < codeLength(c, { voices: false }).bits));
  is("… the parts add up", Object.values(K).every((x) => Math.abs(Object.values(x.parts).reduce((a, b) => a + b, 0) - x.bits) <= 5));

  // in a tree: :defs and :use (re-pitched), the same notes
  const tree = treeOf(c, { name: "BWV 846" });
  is("BWV 846 as a tree: its figure in :defs, 32 uses re-pitched", /:defs \{:F1 \[:seq/.test(tree) && (tree.match(/\[:use \{:ref :F1 :pitches/g) || []).length === 32);
  is("… and every tree is the piece again", Object.entries(P).every(([k, c]) => sameNotes(readTree(treeOf(c)), notesOf(expand(c.items)))));
  const tv = treeOf(c, { voices: true });
  is("… its uses as voices, each voice's step from the use before ([:use {:ref :F1 :voices [0 -2 2 2 1]}]), the piece again",
     (tv.match(/:ref :F1 :voices \[/g) || []).length === 31 && tv.includes(":voices [0 -2 2 2 1]") && Object.values(P).every((c) => sameNotes(readTree(treeOf(c, { voices: true })), notesOf(expand(c.items)))));
  return { results, notes };
}

// a small reader of the trees treeOf writes (notes, uses with :pitches/:transpose, :at in beats) — what kairotic.mt
// expand does with them, enough to check that they are the piece
const MIDI = { c: 0, "c#": 1, d: 2, eb: 3, e: 4, f: 5, "f#": 6, g: 7, ab: 8, a: 9, bb: 10, b: 11 };
const midi = (n) => { const m = /^([a-g][#b]?)(-?\d+)$/.exec(n); return MIDI[m[1]] + 12 * (+m[2] + 1); };
function readTree(edn) {
  const defsAt = edn.indexOf(":defs {"), bodyAt = edn.indexOf("}}\n", defsAt);
  const defs = {};
  for (const m of edn.slice(defsAt + 7, bodyAt).matchAll(/:(\w+) (\[:seq .*?\]\])(?=\n|$)/gs)) defs[m[1]] = m[2];
  const items = (s) => [...s.matchAll(/\[:(note|use) \{([^}]*)\}\]/g)].map(([, k, a]) => ({ k, a }));
  const get = (a, key) => { const m = new RegExp(":" + key + " (\\[[^\\]]*\\]|\\S+)").exec(a); return m && m[1]; };
  const out = [], last = {};
  const play = (s, t0, map) => {
    for (const { k, a } of items(s)) {
      const at = t0 + 4 * +get(a, "at");
      if (k === "note") { const p = midi(JSON.parse(get(a, "pitch"))); out.push([at, 4 * +get(a, "dur"), map(p)]); continue; }
      const body = defs[get(a, "ref").slice(1)];
      const ps = get(a, "pitches"), vs = get(a, "voices"), tr = +(get(a, "transpose") || 0), ref = get(a, "ref");
      const order = [...new Set(items(body).filter((x) => x.k === "note").map(({ a }) => midi(JSON.parse(get(a, "pitch")))))];
      if (ps || vs) {
        const to = ps ? ps.slice(1, -1).split(" ").map((x) => midi(JSON.parse(x)))
          : vs.slice(1, -1).split(" ").map((d, i) => (last[ref] || order)[i] + +d);
        last[ref] = to;
        play(body, at, (p) => map(to[order.indexOf(p)]));
      } else play(body, at, (p) => map(p + tr));
    }
  };
  play(edn.slice(bodyAt + 2), 0, (p) => p);
  return out;
}
const sameNotes = (a, b) => {
  const key = (xs) => JSON.stringify(xs.map(([t, d, p]) => [Math.round(t * 1000), Math.round(d * 1000), p]).sort((x, y) => x[0] - y[0] || x[2] - y[2] || x[1] - y[1]));
  return key(a) === key(b);
};

export function report({ results, notes }) {
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const s of notes) console.log("  · " + s);
  const bad = results.filter((r) => !r[1]).length;
  console.log(`${results.length - bad} / ${results.length}`);
  return bad ? 1 : 0;
}
