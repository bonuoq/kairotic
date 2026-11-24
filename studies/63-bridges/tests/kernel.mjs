// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: the kernel's tests (bridge.mjs). In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/63-bridges/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as B from "../kairotic/bridge.mjs";
import * as R from "../kairotic/reduction.mjs";
import { INCIPITS, check, rangeOf } from "../kairotic/incipit.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const ok = (x, melody) => check(null, { ...x.phrase, melody }, { key: x.key, range: rangeOf(x.phrase, x.key) }).ok;

export async function run() {
  const results = [], notes = [];
  const is = (what, ok_) => results.push([what, !!ok_]);

  // ─── the voice's bridge ───
  const sc = INCIPITS["short-c"], vo = B.voiceOver(sc.phrase, sc.key);
  const free = B.bridgeVoice(vo.V, { temp: 0.6 });
  is("a bridge over the C major incipit's bass, nothing pinned: possible, every draw a legal phrase", free.possible && [1, 2, 3, 4, 5].every((s) => { const U = free.draw(rng(s)); return U && ok(sc, U.map(vo.name).join(" ")); }));
  const mel = sc.phrase.melody.split(" "), pins = new Map([[0, vo.code(mel[0])], [vo.n - 1, vo.code(mel[vo.n - 1])]]);
  const both = B.bridgeVoice(vo.V, { pins, temp: 0.6 });
  is("… its two ends pinned (G4 … C5): every draw begins and ends on them", [1, 2, 3, 4, 5].every((s) => { const U = both.draw(rng(s)).map(vo.name); return U[0] === "G4" && U[U.length - 1] === "C5" && ok(sc, U.join(" ")); }));
  is("… pinning narrows the ways: the log weight of the pinned bridge below the free one's", both.logZ < free.logZ);
  const fan = both.fan([vo.code("G4")]);
  is("… at a point, the candidates with their probabilities (summing to 1)", fan.length > 1 && Math.abs(fan.reduce((a, x) => a + x.p, 0) - 1) < 1e-9);
  is("… colder, the cheapest ways weigh more: the likeliest line, legal", ok(sc, both.map().map(vo.name).join(" ")));
  const impossible = B.bridgeVoice(vo.V, { pins: new Map([[0, vo.code("B4")]]) });
  is("… a pin the rules refuse (B4 over ① to begin): no bridge", !impossible.possible && impossible.draw() === null);

  // ─── vary from depth k, by a bridge ───
  let allOk = true, kept = true;
  for (const [name, x] of Object.entries(INCIPITS)) {
    const an = R.reduce(x.phrase, { key: x.key }), m = x.phrase.melody.split(" ");
    for (let k = 0; k < an.levels.length; k++) {
      const v = B.varyBridge(an, k, { r: rng(7 + k) });
      if (!v || !ok(x, v.melody)) allOk = false;
      else if (!v.kept.every((t) => v.melody.split(" ")[t] === m[t])) kept = false;
    }
    if (name === "scale-76") notes.push(`the 7–6 chain varied from its frame by a bridge: ${B.varyBridge(an, an.levels.length - 1, { r: rng(3) }).melody}`);
  }
  is("vary from every depth of the three incipits by a bridge: every variation legal, never stuck (no backtracking)", allOk);
  is("… the notes that survive at k kept on their units", kept);
  const s76 = INCIPITS["scale-76"], an = R.reduce(s76.phrase, { key: s76.key }), K = an.levels.length - 1;
  const distinct = (temp) => new Set(Array.from({ length: 20 }, (_, i) => B.varyBridge(an, K, { r: rng(50 + i), temp }).melody)).size;
  const cold = distinct(0.6), warm = distinct(1.2);
  is("… the 7–6 chain from its frame: several variations in 20 draws, more when warmer", cold > 3 && warm > cold);
  notes.push(`distinct variations of the 7–6 chain from its frame, in 20 draws: ${cold} at 0.6, ${warm} at 1.2`);

  // ─── a morph between two phrases ───
  const A = INCIPITS["short-c"].phrase, Bp = INCIPITS["scale-76"].phrase;
  const mo = B.morphPhrases(A, Bp, { tonic: "C" }, { r: rng(5) });
  const ma = A.melody.split(" "), mb = Bp.melody.split(" "), mm = mo && mo.melody.split(" ");
  is("a morph from the C major incipit to the 7–6 chain: over both basses, A's first half kept, B's last half kept", mo && mo.bass === `${A.bass} ${Bp.bass}` && ma.slice(0, 5).every((x, t) => mm[t] === x) && mb.slice(-8).every((x, j) => mm[mm.length - 8 + j] === x));
  notes.push(`a morph, C major incipit → 7–6 chain: ${mo && mo.melody}`);
  const vm = mo && B.voiceOver({ bass: mo.bass, melody: mo.melody, cadence: mo.cadence }, { tonic: "C" }, { range: { lo: Math.min(rangeOf(A, { tonic: "C" }).lo, rangeOf(Bp, { tonic: "C" }).lo), hi: Math.min(rangeOf(A, { tonic: "C" }).lo, rangeOf(Bp, { tonic: "C" }).lo) + 12 } });
  is("… every note of it legal under the rules of every phrase", vm && mm.every((nm, t) => vm.V.check(mm.slice(0, t).map(vm.code), t, vm.code(nm)) === null));

  // ─── the economy of a bridge: its figures as words (bits.mjs) ───
  const vc = B.voiceOver(A, { tonic: "C" }), cs = (s) => s.split(" ").map(vc.code);
  is("a bar's figure is its shape from its first note: B4 A4 and C5 B4 one word, D5 C5 another's inversion", B.figureAt(cs("B4 A4 C5 B4"), 1) === B.figureAt(cs("B4 A4 C5 B4"), 3) && B.figureAt(cs("B4 A4"), 1) === "bar:-1" && B.figuresOf(cs("B4 A4 C5 B4 D5")).join(" ") === "bar:-1 bar:-1 bar:");
  const draws = (e) => Array.from({ length: 20 }, (_, i) => B.morphPhrases(A, Bp, { tonic: "C" }, { r: rng(1 + i), economy: e, head: 3, tail: 4 })).filter(Boolean);
  const mean = (ms, f) => ms.reduce((a, m) => a + f(B.figureLength(m.melody.split(" ").map(vc.code))), 0) / ms.length;
  const m0 = draws(0), m3 = draws(3);
  is("a morph with economy 3 says its way with fewer figures: shorter in bits and in different words than without (20 draws each)", m0.length === 20 && m3.length === 20 && mean(m3, (L) => L.bits) < mean(m0, (L) => L.bits) - 8 && mean(m3, (L) => L.words) < mean(m0, (L) => L.words) - 1.5);
  notes.push(`a morph's figures: ${mean(m0, (L) => L.bits).toFixed(1)} bits in ${mean(m0, (L) => L.words).toFixed(1)} words without economy, ${mean(m3, (L) => L.bits).toFixed(1)} in ${mean(m3, (L) => L.words).toFixed(1)} with economy 3 · e.g. ${m3[0].melody}`);
  is("… every note of them legal (the bridge's hard rules untouched)", m3.every((m) => { const v = B.voiceOver({ bass: m.bass, melody: m.melody, cadence: m.cadence }, { tonic: "C" }, { range: { lo: rangeOf(A, { tonic: "C" }).lo, hi: rangeOf(A, { tonic: "C" }).lo + 12 } }); const u = m.melody.split(" "); return u.every((nm, t) => v.V.check(u.slice(0, t).map(v.code), t, v.code(nm)) === null); }));
  is("… and economy 0 is the bridge as it was: the same draws", JSON.stringify(m0.map((m) => m.melody)) === JSON.stringify(Array.from({ length: 20 }, (_, i) => B.morphPhrases(A, Bp, { tonic: "C" }, { r: rng(1 + i), head: 3, tail: 4 })).filter(Boolean).map((m) => m.melody)));

  // ─── the tonal functions above the economy ───
  const errsOf = (ms) => ms.reduce((a, m) => a + B.lineFunctions(m, { tonic: "C" }, m.melody, { range: { lo: rangeOf(A, { tonic: "C" }).lo, hi: rangeOf(A, { tonic: "C" }).lo + 12 } }).errors.length, 0) / ms.length;
  const mf = Array.from({ length: 20 }, (_, i) => B.morphPhrases(A, Bp, { tonic: "C" }, { r: rng(1 + i), economy: 3, functional: 6, head: 3, tail: 4 })).filter(Boolean);
  is("a morph with economy alone: its two voices imply a harmony that goes back (D → S) or leaves an applied dominant unresolved, about once a line", errsOf(m3) > 0.5);
  is("… with the functions above the economy (6 a broken succession): almost never (20 draws each), every draw still found", mf.length === 20 && errsOf(mf) < 0.2);
  notes.push(`grammar errors a morph: ${errsOf(m3).toFixed(2)} with economy alone, ${errsOf(mf).toFixed(2)} with the functions · e.g. ${mf[0].melody}`);

  // ─── rhythms ───
  is("the metrical weight of 16 pulses: the downbeat 4, the half bar 3, the quarters 2, the eighths 1, the rest 0", B.pulseWeight(16).slice(0, 8).join("") === "40102010" && B.pulseWeight(16)[8] === 3);
  const r1 = B.rhythmOf("x..x..x...x.x..."), r2 = B.rhythmOf("x.x...x.x...x...");
  is("the swap distance: 3 (0 0, 3→2, 6 6, 10→8, 12 12)", B.swapDistance(r1, r2) === 3);
  const br = B.bridgeRhythms(r1, r2, { steps: 5 });
  const way = br.draw(rng(2));
  is("a bridge between them in 5 steps: from A to B, each step a swap or a stay", br.possible && B.showRhythm(way[0]) === B.showRhythm(r1) && B.showRhythm(way[way.length - 1]) === B.showRhythm(r2) && way.length === 6 && way.slice(1).every((q, i) => B.swapDistance(way[i], q) <= 1));
  const strongShare = (w) => w.reduce((a, ps) => a + ps.reduce((s, x, i) => s + (x && i % 4 === 0 ? 1 : 0), 0), 0) / w.reduce((a, ps) => a + ps.reduce((s, x) => s + x, 0), 0);
  const flat = Array.from({ length: 30 }, (_, i) => B.bridgeRhythms(r1, r2, { steps: 7, beat: 0 }).draw(rng(200 + i))), metric = Array.from({ length: 30 }, (_, i) => B.bridgeRhythms(r1, r2, { steps: 7, beat: 1 }).draw(rng(200 + i)));
  is("… weighing the metre, the ways pass through rhythms with more onsets on the beats than without it", strongShare(metric.flat()) > strongShare(flat.flat()));
  notes.push(`on the beats: ${Math.round(100 * strongShare(flat.flat()))}% without the metre, ${Math.round(100 * strongShare(metric.flat()))}% with it`);
  is("… too few steps, or another number of onsets: no bridge", !B.bridgeRhythms(r1, r2, { steps: 2 }).possible && !B.bridgeRhythms(r1, B.rhythmOf("x...x...x...x..."), {}).possible);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok_] of results) console.log((ok_ ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
