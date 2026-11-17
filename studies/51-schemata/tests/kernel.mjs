// SPDX-License-Identifier: MPL-2.0
// Study 51 · schemata: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/51-schemata/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { schemata, keyOf, bassOf, SCHEMATA, PROTOTYPES } from "../kairotic/schemata.mjs";
import { melodicParts, verticalParts, shape, choose, temperature } from "../kairotic/soft.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // keys
  const C = keyOf({ tonic: "C" }), a = keyOf({ tonic: "A", mode: "minor" }), Eb = keyOf({ tonic: "Eb" });
  is("keys: degree 0 is the tonic in the bass's octave (C3, A2, E♭3); ⑦ in minor raised is G♯", C.name(0) === "C3" && a.name(0) === "A2" && Eb.name(0) === "E♭3" && a.name(6, 1) === "G♯3" && a.name(13, 1) === "G♯4");
  is("the bass of a schema: in minor ⑥ and ⑦ raised going up a step, natural otherwise", (() => {
    const b = bassOf(SCHEMATA.thirds, a).filter((u) => u.struck).map((u) => a.name(u.d, u.r)).join(" ");
    return b === "A2 B2 C3 D3 E3 F♯3 G♯3 A3 G3 F3 E3 D3 C3 B2 A2";
  })());

  // the prototypes of the book: each is a realization of its schema, of its figures, and closes as the book says
  for (const [id, p] of Object.entries(PROTOTYPES)) {
    const S = schemata({ schema: p.schema || id, key: p.key });
    const U = p.upper.map(S.code);
    const why = S.judge(U);
    const cad = why ? null : S.cadence(U);
    const c = S.count(), free = schemata({ schema: p.schema || id, key: p.key, figured: false }).count();
    is(`${id} (${S.schema.ref}): the book's prototype is a realization of it${why ? " — " + why : ""}`, !why);
    is(`... its cadence: ${p.cadence}${cad ? " (" + cad.kind + ", " + cad.figs.join("–") + ")" : ""}`, cad && cad.kind === p.cadence);
    is(`... and one of the ${c} the figures allow (${free} without them)`, S.count(U) === 1n && c >= 1n && free >= c);
    notes.push(`${id} in ${S.key.tonic} ${S.key.mode}: ${c} realizations of the figures, ${free} over the bass without them`);
  }

  // the rules, one by one, on the prototypes
  const T = schemata({ schema: "thirds", key: { tonic: "C" } });
  const U3 = PROTOTYPES.thirds.upper.map(T.code);
  const nofig = schemata({ schema: "thirds", key: { tonic: "C" }, figured: false });
  is("over ① the upper voice does not start on a sixth", /starts on an octave/.test(nofig.check([], 0, nofig.code("A4")) || ""));
  is("the figures ask for a third over a 3 (a sixth refused)", /figures ask for 3/.test(T.check([], 0, T.code("A4")) || ""));
  is("a 7th refused as a melodic interval", /7th/.test(nofig.check([T.code("C5"), T.code("C5")], 2, nofig.code("D4")) || ""));
  const M = schemata({ schema: "thirds", key: { tonic: "A", mode: "minor" } });
  const Um = PROTOTYPES["thirds-minor"].upper.map(M.code);
  is("melodic minor: F♮ going up to G♯ is an augmented 2nd, F♯ going down refused", /augmented 2nd|goes up raised/.test(M.check([...Um.slice(0, 6), M.code("F4"), M.code("F4")], 8, M.code("G#4")) || "")
     && /goes down natural/.test(M.judge([...Um.slice(0, 22), M.code("F#4"), M.code("F#4"), ...Um.slice(24)]) || ""));
  const S76 = schemata({ schema: "7-6", key: { tonic: "C" } }), u76 = PROTOTYPES["7-6"].upper.map(S76.code);
  is("7–6: the seventh is a suspension, prepared and resolved (p · s · r/p)", (() => { const F = S76.figures(u76); return F[0].role === "p" && F[1].role === "s (upper)" && F[2].role === "r/p" && F[1].fig === 7 && F[2].fig === 6; })());
  is("7–6: a seventh not held (struck on the strong unit) is refused", /prepared/.test(schemata({ schema: "7-6", key: { tonic: "C" }, figured: false }).check([S76.code("A5")], 1, S76.code("C6")) || ""));
  const f76 = schemata({ schema: "7-6", key: { tonic: "C" }, figured: false });
  is("7–6: a suspension that does not resolve down by step is refused", /resolves down by step/.test(f76.check(u76.slice(0, 2), 2, S76.code("A5")) || ""));
  const S23 = schemata({ schema: "2-3", key: { tonic: "A", mode: "minor" } }), u23 = PROTOTYPES["2-3"].upper.map(S23.code);
  is("2–3: the second is held in the bass, and resolves with it", (() => { const F = S23.figures(u23); return F[2].role === "s (bass)" && /^r/.test(F[3].role) && F[2].fig === 2 && F[3].fig === 3; })());
  is("parallel octaves refused", /parallel octaves/.test(schemata({ schema: "thirds", key: { tonic: "C" }, figured: false }).check([T.code("C5"), T.code("C5")], 2, T.code("D5")) || ""));

  // drawn realizations: sound, unit by unit, and among the counted
  const draw = rng(51);
  for (const id of Object.keys(SCHEMATA)) for (const figured of [true, false]) {
    const S = schemata({ schema: id, key: { tonic: id === "2-3" || id === "7-3" ? "A" : "C", mode: id === "2-3" || id === "7-3" ? "minor" : "major" }, figured });
    const U = S.sample(draw);
    is(`${id}${figured ? "" : " without figures"}: a realization drawn uniformly is sound, and one of them`, U && !S.judge(U) && S.count(U) === 1n);
  }

  // the soft rules, as Studies 38–42 weigh them (canon.cljs)
  is("soft: a 5th up costs 0.5, a step nothing, the same note again a tie", melodicParts([0, 2], 6)["leap-size"] === 0.5 && !melodicParts([0, 2], 3)["leap-size"] && melodicParts([0, 2], 2).tie === 1.5);
  is("soft: after a 4th up, going on up costs (contrary-after-leap), turning back by leap too (step-back)", melodicParts([0, 3], 4)["contrary-after-leap"] === 1.2 && melodicParts([0, 3], 1)["step-back"] === 1.2 && !melodicParts([0, 3], 2)["step-back"]);
  is("soft: a mechanical sequence costs, a figure used before is remembered", melodicParts([0, 2, 1, 3], 2).sequence === 1.5 && melodicParts([0, 1, 3, 7, 6, 7], 9).memory === -1);
  const vctx = { N: 7, strong: () => true, lowerFirst: (x, c) => [x, c], quality: (l, h) => [0, 4].includes((h - l) % 7) ? "perfect" : [2, 5].includes((h - l) % 7) ? "imperfect" : "dissonant", dissonant: () => false, suspension: false };
  is("soft: similar motion into a 5th costs, contrary motion nothing", verticalParts([0], [2], 1, 5, vctx)["direct-perfect"] === 3 && !verticalParts([0], [9], 1, 8, vctx).motion);
  is("the engine's choice: at temperature 0 the cheapest with a future; colder where few futures are left", choose([{ note: 1, cost: 0, futures: 0 }, { note: 2, cost: 3, futures: 5 }, { note: 3, cost: 1, futures: 1 }], 0).note === 3 && temperature(1, true, 16) === 0.5);

  // the engine against the uniform draw: drawn uniformly a voice leaps (most realizations do); the engine steps
  for (const id of ["thirds", "7-6", "tied-bass"]) {
    const S = schemata({ schema: id, key: { tonic: "C" }, figured: false }), rr = rng(7);
    const u = [], e = [];
    for (let i = 0; i < 30; i++) { u.push(S.sample(rr).map(S.degree)); const E = S.engine({ temp: 0.5, r: rr }); e.push(E.map(S.degree)); if (S.judge(E)) e.bad = S.judge(E); }
    const su = shape(u), se = shape(e);
    is(`${id} without figures: uniformly ${Math.round(100 * su.steps)}% steps, the engine ${Math.round(100 * se.steps)}%, every one of its realizations sound`, !e.bad && se.steps > su.steps + 0.15 && se.leaps < su.leaps);
    notes.push(`${id} without figures: uniform steps ${Math.round(100 * su.steps)}% / 3rds ${Math.round(100 * su.thirds)}% / 4th+ ${Math.round(100 * su.leaps)}%; engine (T 0.5) ${Math.round(100 * se.steps)}% / ${Math.round(100 * se.thirds)}% / ${Math.round(100 * se.leaps)}%`);
  }

  // what is essentially new: figurings, not octaves nor how a bar is divided
  for (const [id, key, withFigs, free] of [["thirds", { tonic: "C" }, 1n, null], ["7-6", { tonic: "C" }, 1n, null], ["7-3", { tonic: "C" }, 1n, 1102n], ["third-down", { tonic: "A", mode: "minor" }, 2n, null]]) {
    const A = schemata({ schema: id, key }), F = schemata({ schema: id, key, figured: false });
    const a = A.figurings(), f = F.figurings();
    is(`${id} in ${A.key.tonic} ${A.key.mode}: ${A.count()} realizations of the figures are ${a} figuring${a > 1n ? "s" : ""}; without them ${f} figurings of ${F.count()} realizations`, a === withFigs && (free === null || f === free) && f < F.count());
  }
  const F73 = schemata({ schema: "7-3", key: { tonic: "C" }, figured: false }), sig = F73.sampleFiguring(rng(3));
  const V = F73.realize(sig, { r: rng(4) });
  is("a figuring drawn among them, realized by the engine: sound, and of that figuring", V && !F73.judge(V) && JSON.stringify(F73.figuringOf(V)) === JSON.stringify(sig));

  // transposed: E♭ major and G minor count as C major and A minor do (the rules are tonal, not of a key)
  for (const id of Object.keys(SCHEMATA)) {
    const c1 = schemata({ schema: id, key: { tonic: "C" }, figured: false }).count();
    const c2 = schemata({ schema: id, key: { tonic: "Eb" }, figured: false }).count();
    const m1 = schemata({ schema: id, key: { tonic: "A", mode: "minor" }, figured: false }).count();
    const m2 = schemata({ schema: id, key: { tonic: "G", mode: "minor" }, figured: false }).count();
    is(`${id}: the same count in C major and E♭ major (${c1}), in A minor and G minor (${m1})`, c1 === c2 && m1 === m2);
  }
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
