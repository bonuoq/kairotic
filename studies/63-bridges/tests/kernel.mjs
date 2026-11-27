// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: the kernel's tests (bridge.mjs). In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/63-bridges/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as B from "../kairotic/bridge.mjs";
import * as O from "../kairotic/outer.mjs";
import * as R from "../kairotic/reduction.mjs";
import * as U from "../kairotic/under.mjs";
import * as US from "../kairotic/under-score.mjs";
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

  // ─── the outer voices of a chorale phrase, from A to B (outer.mjs: the chorale test, #399 / #353) ───
  // (two phrases invented for the tests, in the corpus's format — not Bach's: the corpus comes from the engine's thread)
  const ph1 = { id: "test-c", key: { tonic: "C", mode: "major" }, satb: Array(8).fill([0, 0, 0, 0]), strong: [1, 0, 1, 0, 1, 0, 1, 0].map(Boolean), A: [72, 64, 55, 48], B: [72, 67, 64, 48] };
  const ph2 = { id: "test-am", key: { tonic: "A", mode: "minor" }, satb: Array(10).fill([0, 0, 0, 0]), strong: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0].map(Boolean), A: [69, 64, 60, 45], B: [69, 64, 61, 45] };
  const wr = (seed) => { let x = seed * 7919 + 13; const f = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646; for (let i = 0; i < 5; i++) f(); return f; };
  const corr = (a, b) => { const m = (x) => x.reduce((s, v) => s + v, 0) / x.length, ma = m(a), mb = m(b); let ab = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; } return ab / Math.sqrt(aa * bb || 1); };
  const dev = (a, b) => a.slice(1, -1).reduce((s, v, i) => s + Math.abs(v - b[i + 1]), 0) / (a.length - 2);
  const stats = (ph, off, target) => {
    const B = O.outerBridge({ ...ph, n: ph.satb.length }, { layers: Object.fromEntries(off.map((l) => [l, 0])), target });
    const xs = Array.from({ length: 20 }, (_, i) => B.draw(wr(i + 1)));
    const ms = xs.map((x) => O.measure(ph, x));
    return { xs, errs: ms.reduce((a, m) => a + m.errors, 0) / xs.length, arch: ms.reduce((a, m) => a + corr(m.tension, O.archOf(ph.satb.length)), 0) / xs.length,
             profile: ms.reduce((a, m) => a + dev(m.tension, O.profileOf(ph.satb.length)), 0) / xs.length,
             words: xs.reduce((a, x) => a + O.motionWords(x, ph.key), 0) / xs.length };
  };
  const all1 = stats(ph1, []), all2 = stats(ph2, []);
  is("outer voices from A to B: every draw begins on A's soprano and bass and ends on B's, the cadence's soprano by step, the bass ⑤–① or ⑦–①",
     [[ph1, all1], [ph2, all2]].every(([ph, st]) => st.xs.every((x) => x.soprano[0] === ph.A[0] && x.bass[0] === ph.A[3] && x.soprano.at(-1) === ph.B[0] && x.bass.at(-1) === ph.B[3] && Math.abs(x.soprano.at(-2) - ph.B[0]) <= 2)));
  is("… keeping the rules (consonant, no parallel 5ths or octaves, the soprano above), and singable: a leap of a 6th at most, few leaps", [all1, all2].every((st) => st.xs.every((x) => O.rulesBroken(x).length === 0 && x.soprano.slice(1).every((s, t) => Math.abs(s - x.soprano[t]) <= 9))));
  const moves = [all1, all2].flatMap((st) => st.xs.flatMap((x) => x.soprano.slice(1).map((v, t) => [Math.abs(v - x.soprano[t]), Math.abs(x.bass[t + 1] - x.bass[t])])));
  const keeps = moves.filter(([d]) => d === 0).length / moves.length, bassLeaps = moves.filter(([, d]) => d >= 3).length / moves.length;
  is("the line moves as Bach's (BACH_OUTER_MOTION): the soprano keeps its note now and then, the bass leaps a 3rd or more often", keeps > 0.08 && bassLeaps > 0.25 && O.BACH_OUTER_MOTION.soprano[2] === 0);
  notes.push(`outer voices' moves (20 draws): the soprano keeps its note ${(100 * keeps).toFixed(0)}% (Bach 22%), the bass leaps a 3rd or more ${(100 * bassLeaps).toFixed(0)}% (Bach 47%)`);
  const nf1 = stats(ph1, ["functions"]), nf2 = stats(ph2, ["functions"]);
  is("the functions layer: without it the two voices imply a harmony that goes back (D → S) or leaves an applied dominant unresolved every few phrases; with it, never", nf1.errs + nf2.errs > 0.3 && all1.errs + all2.errs === 0);
  const nt1 = stats(ph1, ["tension"]), nt2 = stats(ph2, ["tension"]);
  is("the tension layer: the implied harmony's tension nearer the corpus's profile (Bach's plateau, released at the cadence) with it than without", all1.profile < nt1.profile && all2.profile < nt2.profile);
  const ar1 = stats(ph1, [], "arch"), ar2 = stats(ph2, [], "arch");
  is("… and with target arch it follows the generic arch (rising to two thirds, released into B) more closely than without", ar1.arch > nt1.arch + 0.2 && ar2.arch > nt2.arch + 0.2);
  is("the profile: a plateau released at the cadence, the same for every phrase", O.profileOf(8).length === 8 && O.profileOf(8).at(-1) < 1 && O.profileOf(8).slice(1, -1).every((v) => v > 5));
  const ne1 = stats(ph1, ["economy"]), ne2 = stats(ph2, ["economy"]);
  is("the economy layer: the voices' motions said with fewer different words with it than without", all1.words < ne1.words && all2.words < ne2.words);
  notes.push(`outer voices (20 draws): grammar errors ${nf1.errs.toFixed(2)}/${nf2.errs.toFixed(2)} without functions, 0 with · profile deviation ${nt1.profile.toFixed(2)}/${nt2.profile.toFixed(2)} → ${all1.profile.toFixed(2)}/${all2.profile.toFixed(2)} · arch ${nt1.arch.toFixed(2)}/${nt2.arch.toFixed(2)} → ${ar1.arch.toFixed(2)}/${ar2.arch.toFixed(2)} · words ${ne1.words.toFixed(2)}/${ne2.words.toFixed(2)} → ${all1.words.toFixed(2)}/${all2.words.toFixed(2)}`);
  const bs = O.bridgesFor(ph1, { count: 2, r: wr(9) });
  is("bridgesFor: the engine's format for every variant (all, each layer off, arch, no-keys), two draws each", bs.length === 12 && ["all", "no-functions", "no-tension", "no-economy", "arch", "no-keys"].every((v) => bs.filter((b) => b.variant === v).length === 2) &&
     bs.every((b) => b.phrase === "test-c" && b.soprano.length === 8 && b.bass.length === 8 && b.key.tonic === "C" && b.strong.length === 8 && Array.isArray(b.layers)) && bs.find((b) => b.variant === "no-tension").layers.join() === "functions,economy");

  // ─── keys: a path through Bach's moves between keys, the outer voices tonicizing it (#353) ───
  const ph3 = { ...ph1, id: "test-keys", keys: Array(8).fill("C major") };
  const paths = Array.from({ length: 200 }, (_, i) => O.keyPathFor(ph3, wr(i + 1), { rate: O.KEY_RATE }).map(O.keyName));
  is("keyPathFor: a key a unit, from the key A is in to the key B is in, now and then another (ii, V, vi … as Bach goes)",
     paths.every((p) => p.length === 8 && p[0] === "C major" && p[7] === "C major") && paths.some((p) => p.some((k) => k !== "C major")) && paths.filter((p) => p.some((k) => k !== "C major")).length < 150);
  const am = Array.from({ length: 8 }, (_, t) => (t >= 2 && t <= 4 ? { tonic: "A", mode: "minor" } : { tonic: "C", mode: "major" }));
  const BK = O.outerBridge({ ...ph1, unitKeys: am, n: 8 });
  const gs = Array.from({ length: 20 }, (_, i) => BK.draw(wr(i + 1))).filter((x) => x && x.soprano.concat(x.bass).some((v) => v % 12 === 8)).length;
  const g0 = Array.from({ length: 20 }, (_, i) => O.outerBridge({ ...ph1, n: 8 }).draw(wr(i + 1))).filter((x) => x && x.soprano.concat(x.bass).some((v) => v % 12 === 8)).length;
  is("a bridge through A minor (vi of C) tonicizes it: its leading tone G♯ in the soprano or the bass (a quarter of 20 draws or more; never without the keys)", gs >= 5 && g0 === 0);
  const minorLine = (x, k) => x.slice(1).every((v, t) => { const a = ((x[t] - k) % 12 + 12) % 12, b = ((v - k) % 12 + 12) % 12, d = v - x[t];
    return !(d > 0 && d <= 2 && [8, 9].includes(a) && [10, 11].includes(b) && !(a === 9 && b === 11)) && !(d < 0 && d >= -2 && [10, 11].includes(a) && [8, 9].includes(b) && !(a === 10 && b === 8)); });
  const am2 = stats(ph2, []);
  is("minor's turns as Bach's: ⑥–⑦ up raised both, ⑦–⑥ down natural both (A minor, 20 draws)", am2.xs.every((x) => minorLine(x.soprano, 9) && minorLine(x.bass, 9)));
  const bk = O.bridgesFor(ph3, { count: 2, r: wr(3), only: "all" });
  is("bridgesFor writes each bridge's keys, one a unit, as the corpus writes them (\"A minor\")", bk.length === 2 && bk.every((b) => b.keys.length === 8 && b.keys.every((k) => /^[A-G][#b]? (major|minor)$/.test(k))));
  const nk = O.bridgesFor({ ...ph3, keys: ["C major", ...Array(6).fill("A minor"), "C major"] }, { count: 3, r: wr(5), only: "no-keys" });
  is("no-keys: every unit in the chorale's key, whatever keys the phrase went through", nk.length === 3 && nk.every((b) => b.keys.every((k) => k === "C major") && !b.soprano.concat(b.bass).some((v) => v % 12 === 8)));
  notes.push(`keys: ${paths.filter((p) => p.some((k) => k !== "C major")).length} of 200 paths leave C major · through A minor, G♯ in ${gs} of 20 draws · e.g. ${paths.find((p) => p.some((k) => k !== "C major")).join(", ")}`);

  // ─── smooth: what a leap costs (leapCost) ───
  const meanInterval = (ms) => { let s2 = 0, n = 0; for (const m of ms) { const v = B.voiceOver({ bass: m.bass, melody: m.melody, cadence: m.cadence }, { tonic: "C" }); const u = m.melody.split(" ").map((x) => v.F.midiOf(v.code(x))); for (let t = 1; t < u.length; t++) { s2 += Math.abs(u[t] - u[t - 1]); n++; } } return s2 / n; };
  const sm = Array.from({ length: 12 }, (_, i) => B.morphPhrases(A, Bp, { tonic: "C" }, { r: rng(1 + i), economy: 3, functional: 6, smooth: 2, head: 3, tail: 4 })).filter(Boolean);
  const s0 = Array.from({ length: 12 }, (_, i) => B.morphPhrases(A, Bp, { tonic: "C" }, { r: rng(1 + i), economy: 3, functional: 6, smooth: 0, head: 3, tail: 4 })).filter(Boolean);
  is("smooth: a morph moves by smaller intervals with leaps dearer (mean interval, 12 draws each)", sm.length === 12 && meanInterval(sm) < meanInterval(s0));
  notes.push(`a morph's mean interval: ${meanInterval(s0).toFixed(2)} semitones without smooth, ${meanInterval(sm).toFixed(2)} with smooth 2`);

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
  // ─── a bass under a soprano (under.mjs: Study 76 · continuo, #353) ───
  // (a soprano invented for the tests, in C major: not Bach's)
  const sop = [72, 74, 76, 77, 76, 74, 72], st = [1, 0, 1, 0, 1, 0, 1].map(Boolean);
  const UB = U.underBridge({ soprano: sop, key: { tonic: "C", mode: "major" }, strong: st });
  const lines = Array.from({ length: 20 }, (_, i) => UB.draw(wr(i + 1))).filter(Boolean);
  const pcsOf = (c) => { const root = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].indexOf(c.root); return U.KIND_INTERVALS[c.kind].map((x) => (root + x) % 12); };
  is("bassUnder: a bass, its figures and its keys a quarter under every note of the soprano, the soprano a tone of each chord, the bass below it in its range",
     UB.possible && lines.length === 20 && lines.every((x) => x.bass.length === 7 && x.figures.length === 7 && x.keys.length === 7 && x.bass.every((b, t) => b >= U.UNDER_RANGE[0] && b <= U.UNDER_RANGE[1] && sop[t] - b >= 3 && pcsOf(x.chords[t]).includes(sop[t] % 12) && pcsOf(x.chords[t]).includes(b % 12))));
  const par = (x) => x.bass.slice(1).some((b, t) => { const i0 = ((sop[t] - x.bass[t]) % 12 + 12) % 12, i1 = ((sop[t + 1] - b) % 12 + 12) % 12; return (i1 === 0 || i1 === 7) && i0 === i1 && Math.sign(sop[t + 1] - sop[t]) === Math.sign(b - x.bass[t]) && b !== x.bass[t]; });
  is("… no parallel 5ths or octaves with the soprano, no leap of a tritone or a 7th, nor past the octave", lines.every((x) => !par(x) && x.bass.slice(1).every((b, t) => { const d = Math.abs(b - x.bass[t]); return d <= 12 && d !== 6 && d !== 10 && d !== 11; })));
  const ends = lines.filter((x) => (x.bass.at(-1) % 12) === 0).length;
  is("… the cadence into the fermata: the bass ending on the tonic in most draws (C major, the soprano ending on C)", ends >= 14);
  const lp = UB.logProb(lines[0].bass);
  is("logProb: a bass the bridge can draw has a probability (every chord and key under it summed), one it cannot has none", lp < 0 && lp > -Infinity && UB.logProb(sop.map(() => 30)) === -Infinity);
  const unk = U.underBridge({ soprano: sop, key: { tonic: "C", mode: "major" }, strong: st, variant: "no-keys" });
  is("no-keys: every quarter in the chorale's key", Array.from({ length: 5 }, (_, i) => unk.draw(wr(i + 3))).every((x) => x.keys.every((k) => k === "C major")));
  is("figureText: the figures against the key signature, by the chord's letters — V6/5 \"6/5\", V/V \"5/♯3\" in C, \"5/♮3\" in F, I4/2 \"4/2\" over its B♭ in C, G7 \"♮7\" in G, ♯iv°7 \"♭7\" in C",
     U.figureText(7, "7", "7", { tonic: "G" }) === "♮7" && U.figureText(6, "°7", "7", { tonic: "C" }) === "♭7" && U.figureText(7, "7", "6/5", { tonic: "C" }) === "6/5" && U.figureText(2, "", "5/3", { tonic: "C" }) === "5/♯3" && U.figureText(7, "", "5/3", { tonic: "F" }) === "5/♮3" && U.figureText(0, "7", "4/2", { tonic: "C" }) === "4/2");
  // (the chorale thread's tables, in continuo.mjs's shape — here flat ones, invented: any chord, any move, as likely)
  const flatC = { BACH_OUTER_VERTICAL: Array(12).fill(0), BACH_OUTER_PAIR: Array(25).fill(0), BACH_CADENCES: { major: [["7:5/3 0:5/3", 0.5]], minor: [["7:5/3 0:5/3", 0.5]] },
    BACH_DEGREE_CHORD: Object.fromEntries(["major", "minor"].map((m) => [m, { chords: ["5/3", "6/3", "6/4", "7", "6/5", "4/3", "4/2", "x"], degree: Array(12).fill(0), chord: Array.from({ length: 12 }, () => Array(8).fill(0)) }])) };
  const UC = U.underBridge({ soprano: sop, key: { tonic: "C", mode: "major" }, strong: st, continuo: flatC });
  const cl = Array.from({ length: 30 }, (_, i) => UC.draw(wr(i + 7))).filter(Boolean);
  const UC0 = U.underBridge({ soprano: sop, key: { tonic: "C", mode: "major" }, strong: st, continuo: flatC, weights: { cadence: 0 } });
  const c0 = Array.from({ length: 30 }, (_, i) => UC0.draw(wr(i + 7))).filter(Boolean);
  const v1 = (xs) => xs.filter((x) => x.bass.at(-1) % 12 === 0 && x.bass.at(-2) % 12 === 7).length;
  is("continuo: the chorale thread's tables (continuo.mjs's shape) in place of under-tables.mjs's — a bass by the same rules, ending more often on the cadence its table names (⑤–① 5/3) than without it",
     UC.possible && cl.length === 30 && cl.every((x) => !par(x)) && v1(cl) > v1(c0));
  // (a soprano held into a strong quarter and down a step: with BACH_DISSONANCES, a 4–3 over the bass may be drawn)
  const sus = [67, 72, 72, 71, 72], sst = [0, 1, 1, 0, 1].map(Boolean);
  const UD = U.underBridge({ soprano: sus, key: { tonic: "C", mode: "major" }, strong: sst, continuo: { ...flatC, BACH_DISSONANCES: { "soprano|suspension|4|strong": 200 } } });
  const dl = Array.from({ length: 40 }, (_, i) => UD.draw(wr(i + 11))).filter(Boolean), withSus = dl.filter((x) => x.chords[2].dissonance);
  is("a suspension: the soprano held into a strong quarter a 4th over the bass, figured 4 and then 3 over the same bass, drawn where BACH_DISSONANCES has it",
     withSus.length > 0 && withSus.every((x) => x.chords[2].dissonance.motion === "suspension" && x.figures[2] === "4" && x.figures[3] === "3" && (x.bass[2] - x.bass[3]) % 12 === 0)
     && Array.from({ length: 40 }, (_, i) => U.underBridge({ soprano: sus, key: { tonic: "C", mode: "major" }, strong: sst, continuo: flatC }).draw(wr(i + 11))).every((x) => !x.chords[2].dissonance));
  notes.push(`suspensions: ${withSus.length} of 40 draws hold C over G into a 4–3 · e.g. ${(withSus[0] || dl[0]).bass.join(" ")} · ${(withSus[0] || dl[0]).figures.join(" ")}`);
  // (the score the page draws: under-score.mjs's MEI, for Verovio)
  const fake = { id: "test-c", key: { tonic: "C", mode: "major" }, keys: sop.map(() => "C major"), satb: sop.map((s, t) => [s, s - 5, s - 9, lines[0].bass[t]]),
                 names: sop.map(() => ["C5", "G4", "E4", "C3"]) };
  const mei = US.meiOf(fake, lines[0]);
  is("the score (under-score.mjs): three staves, a measure a quarter, the fermata on the last, our figures in Bach's abbreviations (nothing over a 5/3)",
     (mei.match(/<staffDef /g) || []).length === 3 && (mei.match(/<measure /g) || []).length === 7 && /<fermata staff="1" tstamp="1"\/><\/measure>\s*<\/section>/.test(mei) &&
     US.abbreviate("5/3", "5/3").length === 0 && US.abbreviate("5/♯3", "5/3").join() === "♯" && US.abbreviate("6/♯4/2", "4/2").join() === "6,♯4,2" && US.abbreviate("4", "5/3").join() === "4");
  is("… its notes spelt in the key signature, by the local key's letters: in F, B♭ by the signature, B♮ marked; in A minor its G♯",
     US.speller({ tonic: "F" }).note(70) === 'pname="b" oct="4" accid.ges="f"' && US.speller({ tonic: "F" }).note(71) === 'pname="b" oct="4" accid="n"' &&
     US.speller({ tonic: "A", mode: "minor" }).note(68) === 'pname="g" oct="4" accid="s"' && US.speller({ tonic: "F" }).note(66, { tonic: "G", mode: "minor" }) === 'pname="f" oct="4" accid="s"');
  notes.push(`a bass under C D E F E D C: ${lines[0].bass.join(" ")} · ${lines[0].figures.join(" ")} · ${lines[0].keys.join(", ")}`);

  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok_] of results) console.log((ok_ ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
