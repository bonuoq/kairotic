// SPDX-License-Identifier: MPL-2.0
// Study 61 · reduction: the kernel's tests (protovoices.mjs, reduction.mjs). In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/61-reduction/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as PV from "../kairotic/protovoices.mjs";
import * as R from "../kairotic/reduction.mjs";
import { INCIPITS, check, rangeOf } from "../kairotic/incipit.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const show = (path) => path.map((s) => s.notes.map((n) => n.pitch).join("")).join(" ");

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // ─── protovoices.mjs ───
  is("a spelled name read: diatonic and MIDI", PV.pitchOf("C4").d === 28 && PV.pitchOf("F#4").midi === 66 && PV.pitchOf("Bb3").midi === 58 && PV.steps("E4", "G4") === 2);
  is("consonance: a 4th over the bass is not, between upper voices it is; an augmented 4th never",
     !PV.consonant("C3", "F4") && PV.consonant("C4", "F4", false) && !PV.consonant("F3", "B3", false) && PV.consonant("C3", "E5") && PV.consonant("A2", "C#4"));
  is("a sonority: C E G yes, C D G no, C F A (a 6/4) no", PV.sonorous(["C3", "E4", "G4"]) && !PV.sonorous(["C3", "D4", "G4"]) && !PV.sonorous(["C3", "F4", "A4"]));
  const sc = INCIPITS["short-c"], ns = PV.notesOfPhrase(sc.phrase), S0 = PV.slicesOf(ns);
  is("the surface: a bass note a bar, a melody note a unit, a note held one note", ns.length === 5 + 7 && ns.find((n) => n.id === "m1").dur === 2);
  is("… its salami slices: one at each onset, a note held marked as such", S0.length === 8 && show(S0) === "C3G4 C3C5 E3C5 E3B4 F3A4 G3B4 G3D5 C3C5" && S0[2].notes.find((n) => n.voice === "m").start === false);
  const ex = (x, L, R) => PV.explain(x, L, R).map((e) => e.orn);
  is("ornaments: a passing tone between a 3rd, a neighbour and back, a note held",
     ex({ id: "x", pitch: "D5", voice: "m" }, { notes: [{ id: "a", pitch: "C5", voice: "m" }] }, { notes: [{ id: "b", pitch: "E5", voice: "m" }] }).includes("passing-mid") &&
     ex({ id: "x", pitch: "D5", voice: "m" }, { notes: [{ id: "a", pitch: "C5", voice: "m" }] }, { notes: [{ id: "b", pitch: "C5", voice: "m" }] }).includes("full-neighbor") &&
     ex({ id: "a", pitch: "C5", voice: "m" }, { notes: [{ id: "a", pitch: "C5", voice: "m" }] }, null).join() === "tie");
  is("… a leap is no ornament: no explanation, no unsplit", ex({ id: "x", pitch: "G5", voice: "m" }, { notes: [{ id: "a", pitch: "C5", voice: "m" }] }, { notes: [{ id: "b", pitch: "C5", voice: "m" }] }).length === 0);
  const u = PV.unsplit(S0, 3);
  is("unsplit: B4 over E3 a passing tone between C5 and A4, the slice gone, the time kept", u.ok && u.path.length === 7 && u.explained.find((e) => e.pitch === "B4").orn === "passing-mid" && u.path[2].end === 4);
  is("… split is its inverse: the slice put back gives the surface again", show(PV.splitAt(u.path, 3, S0[3])) === show(S0) && PV.splitAt(u.path, 3, S0[3])[2].end === 3);
  is("unspread: C3 G4 and C3 C5 heard as one sonority; C3 G4 and E3 B4 not", PV.unspread(S0, 0).ok && show(PV.unspread(S0, 0).path).startsWith("C3G4C5 ") && !PV.unspread([S0[0], S0[3]], 0).ok);
  is("the first and the last slice stay", !PV.unsplit(S0, 0).ok && !PV.unsplit(S0, 7).ok);

  // ─── reduction.mjs ───
  is("GTTM's metrical weight: a weak unit 0, bars 1, 2, 3 by their place", R.meter(1) === 0 && R.meter(2) === 1 && R.meter(4) === 2 && R.meter(8) === 3 && R.meter(0) === 3);
  const A = R.reduce(sc.phrase, { key: sc.key });
  is("the C major incipit reduced: 4 steps in 3 passes to its frame, C (G C) – G – G – C", A.levels.length === 4 && A.steps.length === 4 && show(A.levels[3]) === "C3G4C5 G3B4 G3D5 C3C5");
  is("… a level is a pass over the whole phrase: the first takes the passing B4 (bar 2) and the spread of bar 1 together", R.stepsInto(A, 1).length === 2 && R.stepsInto(A, 1).every((s) => s.level === 1));
  is("… the first step the passing B4, the cheapest", A.steps[0].op === "unsplit" && A.steps[0].explained.some((e) => e.pitch === "B4" && e.orn === "passing-mid"));
  is("… every level passes the hard rules (below the surface note against note)", A.levels.every((_, k) => R.checkLevel(A, k).ok));
  is("… the cadence kept (GTTM's cadential retention): its last two bass notes in every level", A.levels.every((L) => L.slice(-3).map((s) => s.notes[0].pitch).join(" ") === "G3 G3 C3"));
  const D = R.derivation(A);
  is("the derivation: the steps read forwards, in the proto-voice names", D.length === A.steps.length && D[0].op === "split" && D[0].notes.some((n) => n.pv === "PassingMid") && D.some((d) => d.op === "spread"));
  is("level k drawn on the grid: its notes held over what they prolong", R.phraseAt(A, 3).melody === "C5 C5 C5 C5 C5 C5 B4 D5 C5" && R.phraseAt(A, 3).bass === "C3 C3 C3 G3 C3");
  const s76 = INCIPITS["scale-76"], B = R.reduce(s76.phrase, { key: s76.key });
  is("the 7–6 chain: its suspensions taken away first, parallel 6ths under it (B G, A F, G E)", B.levels.some((L) => / B3G5 A3F5 G3E5 /.test(show(L))) && B.steps.slice(0, 3).every((s) => s.op === "unsplit"));
  is("… in one pass, across the whole chain: the first level takes five suspensions at once, bars 2 to 6", R.stepsInto(B, 1).length === 5 && new Set(R.stepsInto(B, 1).map((s) => Math.floor(s.on / 2))).size === 5 && show(B.levels[1]).includes("B3G5 A3F5 G3E5 F3D5"));
  notes.push(`7–6 chain, level 1: ${show(B.levels[1])}`);
  const ev = (es) => es.map((e) => `${e.pitch}@${e.on}+${e.dur}`).join(" ");
  is("what a level sounds is its slices: in the 7–6 chain's level 1 B3 enters where its slice begins (unit 3), held two units", ev(R.soundAt(B, 1)).includes("B3@3+2") && ev(R.soundAt(B, 1)).includes("A3@5+2"));
  is("… the surface sounds as written: the level 0 events are the phrase's own", ev(R.soundAt(B, 0)) === ev(R.soundOf(s76.phrase).sort((a, b) => a.on - b.on || a.voice.localeCompare(b.voice))));
  const shape = (an) => an.levels.map((L) => L.map((s) => s.on).join(".")).join("|");
  is("an analysis is an interpretation: warmer, other levels for some draws (the 7–6 chain)", [1, 2, 3, 4, 5, 6, 7].some((s) => shape(R.reduce(s76.phrase, { key: s76.key, temp: 1, r: rng(s) })) !== shape(B)));
  const am = INCIPITS["short-am"], C = R.reduce(am.phrase, { key: am.key });
  is("A minor: its frame keeps the leading tone to the tonic (E G♯ – E B – A)", show(C.levels[C.levels.length - 1]).endsWith("E3G#4 E3B4 A2A4"));
  is("… every step says how many were possible, and its cost by part", A.steps.every((s) => s.among >= 1 && typeof s.parts.meter === "number"));

  // ─── as MEI ───
  const M0 = R.meiOf(B, 0).mei, ties = (m) => (m.match(/tie="i"/g) || []).length;
  is("as MEI: the 7–6 chain's suspensions written as one note each, tied over the bar line (not struck again)", ties(M0) === 6 && (M0.match(/<note /g) || []).length === 15 + 8);
  is("… a level held as drawn: level 1's C4 held over the bar line into B3's slice", /pname="c" oct="4" dur="1" tie="i"/.test(R.meiOf(B, 1).mei));
  is("… a variation: the phrase's bass, its melody, flagged as such", (() => { const v = R.vary(A, 2, { r: rng(3) }), m = R.meiOf(A, 2, { melody: v.melody }); return /:variation true/.test(m.mei) && /label="bass"/.test(m.mei) && /\.mei$/.test(m.name); })());

  // ─── vary from depth k ───
  let all = true, kept = true, fewer = true;
  for (const [name, x] of Object.entries(INCIPITS)) {
    const an = R.reduce(x.phrase, { key: x.key }), mel = x.phrase.melody.split(" ");
    let prev = Infinity;
    for (let k = 0; k < an.levels.length; k++) {
      const v = R.vary(an, k, { r: rng(11 + k) });
      if (!v) { all = false; continue; }
      if (!check(null, { ...x.phrase, melody: v.melody }, { key: x.key, range: rangeOf(x.phrase, x.key) }).ok) all = false;
      const w = v.melody.split(" ");
      if (!v.kept.every((t) => w[t] === mel[t])) kept = false;
      if (v.kept.length > prev) fewer = false;
      prev = v.kept.length;
      if (k === an.levels.length - 1) notes.push(`${name} varied from its frame: ${v.melody} (was ${x.phrase.melody})`);
    }
  }
  is("vary from every depth of the three incipits: every variation passes the rules of every phrase", all);
  is("… the notes that survive at k kept on their units", kept);
  is("… the deeper k, the fewer notes kept", fewer);
  const v0 = R.vary(A, 0, { r: rng(5) });
  is("… from the surface (k 0) the melody kept whole", v0 && v0.melody === sc.phrase.melody && v0.changed.length === 0);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
