// SPDX-License-Identifier: MPL-2.0
// Study 69 · chromatic: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/69-chromatic/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { chromatic, PHRASES } from "../kairotic/chromatic.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const PINNED = { fonte: 181n, "fonte-inverted": 5680n, "fonte-diminished": 95n, monte: 6852n, "monte-minor": 1422n, "descending-thirds": 56198n,
                 lamento: 6n, "lamento-4": 1298n, morte: 3156n, "morte-minor": 3156n, chain: 36n, "chain-minor": 530n };

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const r = rng(69);
  const every = (P, n, f) => { for (let i = 0; i < n; i++) { const W = P.sample(r); if (!W || !f(W)) return false; } return true; };
  // every realization, for the phrases small enough
  const all = (P, f) => {
    const out = [];
    const go = (W) => { if (W[0].length === P.n) { out.push(Object.fromEntries(P.names.map((v, i) => [v, W[i]]))); return; } for (const x of P.tuples(W)) go(W.map((U, i) => [...U, x[i]])); };
    go(P.names.map(() => []));
    return out.every(f) && out.length > 0;
  };
  const V = (P, W) => P.names.map((v) => W[v]);
  // the voice that has the note of class cls (above the bass) at t, and where it goes
  const moves = (P, W, t, cls) => V(P, W).map((U, i) => [U, P.voices[i].vertical(t, U[t])]).filter(([, v]) => v.cls === cls).map(([U]) => [U[t], U[t + 1]]);
  const down = (P, [a, b], semis) => P.degree(b) === P.degree(a) - 1 && (semis === undefined || P.hz(a) / P.hz(b) > 1.03);
  const chromaticDown = (P, [a, b]) => P.degree(b) === P.degree(a) && P.alter(b) === P.alter(a) - 1;
  const names = (P, W, t) => V(P, W).map((U) => P.name(U[t]));

  // the counts, pinned; the same in another key
  const counts = {};
  for (const id of Object.keys(PHRASES)) counts[id] = chromatic({ phrase: id }).count();
  notes.push(Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · "));
  is("every phrase realizable, the counts pinned", Object.entries(PINNED).every(([k, v]) => counts[k] === v));
  for (const [id, tonic] of [["fonte", "G"], ["monte", "D"], ["chain-minor", "D"], ["morte", "F"]])
    is(`${PHRASES[id].name} in ${tonic}: the same count (${counts[id]})`, chromatic({ phrase: id, key: { tonic } }).count() === counts[id]);

  // 8.1 the Fonte
  const FO = chromatic({ phrase: "fonte" });
  is("the Fonte (ex. 8.8a): ii tonicized — C♯ a 6/5 of D minor, then its tonic —, then I; the keys D minor, D minor, C major, C major",
     [0, 1, 2, 3].map((t) => FO.keyName(t)).join(", ") === "D minor, D minor, C major, C major");
  is("... each secondary dominant's 7th down a step: G to F over D, F to E over C (every realization)",
     all(FO, (W) => moves(FO, W, 0, 4).every((m) => down(FO, m)) && moves(FO, W, 2, 4).every((m) => down(FO, m))));
  const FD = chromatic({ phrase: "fonte-diminished" });
  is("... with diminished 7ths (ex. 8.8c): B♭ in D minor's, the molldur A♭ in C's, each down a half step (every realization)",
     all(FD, (W) => moves(FD, W, 0, 6).every(([a, b]) => FD.name(a).startsWith("B♭") && FD.name(b).startsWith("A")) &&
                    moves(FD, W, 2, 6).every(([a, b]) => FD.name(a).startsWith("A♭") && FD.name(b).startsWith("G"))));
  const FI = chromatic({ phrase: "fonte-inverted" });
  is("... inverted (ex. 8.8b): the upper voice's line in the bass, the secondary tonic a 6/3, C♯ in D minor's dominant (30 drawn)",
     every(FI, 30, (W) => names(FI, W, 0).some((x) => x.startsWith("C♯")) && names(FI, W, 1).some((x) => x.startsWith("C♯"))));

  // 8.2 the chromatic Monte
  const MO = chromatic({ phrase: "monte" });
  const mk = MO.units.map((u, t) => MO.keyName(t)).filter((k, t, a) => t === 0 || k !== a[t - 1]);
  is(`the chromatic Monte (ex. 8.17a): ii, IV, V and vi tonicized — ${mk.join(" → ")}`, mk.join(" → ") === "C major → D minor → F major → G major → A minor → C major");
  is("... every secondary dominant's 7th (the 6/5's 5th) down a step to its tonic (30 drawn)",
     every(MO, 30, (W) => [1, 3, 5, 7, 9, 11].every((t) => moves(MO, W, t, 4).every((m) => down(MO, m)))));
  const MM = chromatic({ phrase: "monte-minor" });
  const mm = MM.units.map((u, t) => MM.keyName(t)).filter((k, t, a) => t === 0 || k !== a[t - 1]);
  is(`... in minor (ex. 8.17b): III, iv and V, not past ⑤ — ${mm.join(" → ")}`, mm.join(" → ") === "A minor → C major → D minor → E major → A minor");

  // 8.3 tonicizations in Descending Thirds
  const DT = chromatic({ phrase: "descending-thirds" });
  is("Descending Thirds (ex. 8.22a): on each step between a secondary dominant's 4/2 — its leading tone G♯, E, C♯ up a half step (30 drawn)",
     every(DT, 30, (W) => [[1, "G♯", "A"], [3, "E", "F"], [5, "C♯", "D"]].every(([t, lt, to]) =>
       V(DT, W).some((U) => DT.name(U[t]).replace(/-?\d+$/, "") === lt && DT.name(U[t + 1]).replace(/-?\d+$/, "") === to))));

  // 8.4 the Lamento
  const LA = chromatic({ phrase: "lamento" }), L4 = chromatic({ phrase: "lamento-4" });
  const maxLeap = (P, W) => Math.max(...V(P, W).flatMap((U) => [2, 3, 4, 5].map((t) => Math.abs(P.degree(U[t]) - P.degree(U[t - 1])))));
  let leaps = 0, n4 = 0;
  all(L4, (W) => { n4++; if (maxLeap(L4, W) >= 3) leaps++; return true; });
  notes.push(`Lamento in four parts: ${leaps} of ${n4} realizations leap a 4th or more over the chromatic steps`);
  is(`the Lamento (ex. 8.27): in three parts the voices go by step or a 3rd over the chromatic steps (all ${counts.lamento}); in four every realization has a voice that leaps a 4th or more (${leaps} of ${n4}) — the book's "the tenor is forced to leap"`,
     all(LA, (W) => maxLeap(LA, W) <= 2) && n4 > 0 && leaps === n4);
  is("... 7–6 over each chromatic step: a 7th prepared on G♯ and on F♯, resolving to the 6th (every realization in three parts)",
     all(LA, (W) => [2, 4].every((t) => moves(LA, W, t, 6).length === 1 && moves(LA, W, t, 6).every(([a, b]) => a === V(LA, W).find((U) => U[t] === a)[t - 1] && down(LA, [a, b])))));

  // 8.5 the Morte
  const MT = chromatic({ phrase: "morte" }), MTm = chromatic({ phrase: "morte-minor" });
  is("the Morte (ex. 8.33b): IV tonicized by the 4/2 on B♭, then the augmented 6th A♭–F♯ — F♯ up to G, the 3rd (C) doubled (30 drawn)",
     MT.keyName(2) === "F major" && every(MT, 30, (W) => names(MT, W, 4).filter((x) => x.startsWith("F♯")).length === 1 && names(MT, W, 4).filter((x) => x.startsWith("C")).length === 2 &&
       V(MT, W).every((U) => !MT.name(U[4]).startsWith("F♯") || MT.name(U[5]).startsWith("G"))));
  is("... in minor (ex. 8.33a): D major's dominant on G, then F–D♯ up to E, the 3rd (A) doubled (30 drawn)",
     MTm.keyName(2) === "D major" && every(MTm, 30, (W) => names(MTm, W, 4).filter((x) => x.startsWith("D♯")).length === 1 && names(MTm, W, 4).filter((x) => x.startsWith("A")).length === 2 &&
       V(MTm, W).every((U) => !MTm.name(U[4]).startsWith("D♯") || MTm.name(U[5]).startsWith("E"))));

  // 8.6 the Chain of Dominants
  const CH = chromatic({ phrase: "chain" });
  is("the Chain of Dominants (ex. 8.42a): a dominant 7th on every bass note of A minor, D minor, G, C — each 7th down a step, each leading tone down a chromatic half step into the next 7th (every realization)",
     all(CH, (W) => [1, 2, 3, 4].every((t) => moves(CH, W, t, 6).every((m) => down(CH, m)) && moves(CH, W, t, 2).every((m) => chromaticDown(CH, m)))));
  is("... complete and incomplete by turns: never two complete 7ths in a row (every realization)",
     all(CH, (W) => [1, 2, 3, 4].every((t) => !(V(CH, W).some((U) => CH.voices[V(CH, W).indexOf(U)].vertical(t, U[t]).cls === 4) &&
                                                  V(CH, W).some((U) => CH.voices[V(CH, W).indexOf(U)].vertical(t + 1, U[t + 1]).cls === 4)))));
  const CM = chromatic({ phrase: "chain-minor" });
  is("... in minor (ex. 8.42b): the dominants alternate with their 5/3s, to the Neapolitan B♭ and the Neapolitan cadence (30 drawn)",
     CM.K.name(CM.units[6].d, CM.units[6].r).startsWith("B♭") && every(CM, 30, (W) => [1, 3].every((t) => moves(CM, W, t, 2).every(([a, b]) => CM.degree(b) === CM.degree(a) + 1))));

  // the engine
  for (const id of Object.keys(PHRASES)) {
    const P = chromatic({ phrase: id });
    let ok = true;
    for (let i = 0; i < 2 && ok; i++) { const W = P.engine({ temp: 0.5, r }); ok = W && !P.judge(W); }
    is(`${PHRASES[id].name}: the engine's realizations sound`, ok);
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
