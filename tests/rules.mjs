// SPDX-License-Identifier: MPL-2.0
// @kairotic/rules: the core and its first rules reproduce partimento.mjs's schemata (one voice over a bass) to the
// number — counts, reasons and the engine's choices (discussion #353, step 2). node tests/rules.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as R from "../packages/rules/assets/rules.mjs";
import * as P from "../packages/cac/assets/partimento.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [], notes = [];
const is = (what, ok, detail) => results.push([what, !!ok, detail]);
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// the tonal system and the soft rules: the same as partimento.mjs's, as they are
{
  const T = await import("../packages/rules/assets/tonal.mjs");
  const same = ["keyOf", "codeOf", "localOf", "localNote", "isDominant", "codeOf3", "codeDegree", "codeAlter"].every((f) => String(T[f]) === String(P[f]));
  is("tonal.mjs: partimento.mjs's keys, codes and local keys, as they are", same);
  is("soft.mjs: @kairotic/cac's, as it is", readFileSync(join(root, "packages/rules/assets/soft.mjs"), "utf8") === readFileSync(join(root, "packages/cac/assets/soft.mjs"), "utf8"));
}

// one voice over a bass: every schema of Study 51, in major and minor, figured or not, with and without chapter 4's
// rules, at every line level — the same count, the same reason for every candidate, the same engine
const cases = [];
for (const id of Object.keys(P.SCHEMATA))
  for (const key of [{ tonic: "C" }, { tonic: "A", mode: "minor" }, { tonic: "Eb" }])
    for (const figured of [true, false])
      for (const ro of [false, true])
        for (const line of ["free", "moderate", "strict"]) cases.push({ id, key, figured, ro, line });
let counted = 0, bad = [];
const t0 = Date.now();
for (const c of cases) {
  const S = P.schemata({ schema: c.id, key: c.key, figured: c.figured, ro: c.ro, line: c.line });
  const N = R.overBass({ bass: S.bass, key: c.key, figured: c.figured, ro: c.ro, line: c.line, phase: S.phase });
  const a = S.count(), b = N.count();
  counted++;
  if (a !== b) bad.push(`${c.id} ${c.key.tonic}${c.key.mode === "minor" ? "m" : ""} fig:${c.figured} ro:${c.ro} ${c.line}: ${a} ≠ ${b}`);
}
is(`one voice over a bass: the same counts in ${counted} cases (Study 51's schemata × 3 keys × figured or not × ro × 3 line levels)`, bad.length === 0, bad.slice(0, 5).join("; "));
notes.push(`${counted} counts compared in ${Date.now() - t0} ms`);

// every voice the three- and four-part engines write is one over the bass, with its own parameters (a middle voice, a
// pedal, a canon's hold, chapter 6's free dissonances…): Studies 54, 57, 59 and 62, each voice counted alone the same
{
  const voices = [];
  const { galant, SCHEMATA: GS } = await import("../studies/59-galant/kairotic/galant.mjs");
  for (const id of Object.keys(GS)) { const G = galant({ schema: id }); voices.push([`59 ${id}`, G.top], [`59 ${id} (middle)`, G.middle]); }
  const { octave, PHRASES: OP } = await import("../studies/57-octave/kairotic/octave.mjs");
  for (const id of Object.keys(OP)) { const O = octave({ phrase: id }); voices.push([`57 ${id}`, O.top], [`57 ${id} (middle)`, O.middle]); }
  const { fourParts, PHRASES: FP } = await import("../studies/62-four/kairotic/four.mjs");
  for (const id of Object.keys(FP)) { const F = fourParts({ phrase: id }); F.voices.forEach((V, i) => voices.push([`62 ${id} ${["soprano", "alto", "tenor"][i]}`, V])); }
  for (const [cad, sch] of [["simple", "fauxbourdon"], ["galant", "romanesca"], ["compound-64", "tied-bass"]]) { const Q = P.parts({ schema: sch, cadence: cad }); voices.push([`54 ${sch}+${cad}`, Q.top], [`54 ${sch}+${cad} (middle)`, Q.middle]); }
  const off = [];
  for (const [name, V] of voices) {
    const N = R.overBass({ ...V.spec, bass: V.bass, key: V.key });
    if (N.count() !== V.count()) off.push(`${name}: ${V.count()} ≠ ${N.count()}`);
  }
  is(`each voice of the three- and four-part engines alone, the same count (${voices.length} voices: Studies 54, 57, 59, 62)`, off.length === 0, off.slice(0, 4).join("; "));
}

// the same reasons, candidate by candidate, along realizations drawn
{
  const r = rng(53); let diff = null;
  for (const id of Object.keys(P.SCHEMATA)) for (const ro of [false, true]) {
    const S = P.schemata({ schema: id, figured: false, ro }), N = R.overBass({ bass: S.bass, key: S.key, figured: false, ro, phase: S.phase });
    for (let k = 0; k < 4 && !diff; k++) {
      const U = S.sample(r); if (!U) continue;
      for (let t = 0; t < U.length && !diff; t++) for (const c of S.top ? [] : N.codes) {
        const a = S.check(U.slice(0, t), t, c), b = N.check(U.slice(0, t), t, c);
        if (a !== b) diff = `${id} unit ${t + 1} ${N.name(c)}: "${a}" ≠ "${b}"`;
      }
    }
  }
  is("... the same reason for every candidate along realizations drawn (the first rule that refuses it)", diff === null, diff);
}

// the same engine: the same costs, the same choices with the same chance
{
  let diff = null;
  for (const id of Object.keys(P.SCHEMATA)) {
    const S = P.schemata({ schema: id, figured: false }), N = R.overBass({ bass: S.bass, key: S.key, figured: false, phase: S.phase });
    const a = S.engine({ temp: 0.5, r: rng(7) }), b = N.engine({ temp: 0.5, r: rng(7) });
    if (JSON.stringify(a) !== JSON.stringify(b)) { diff = `${id}: ${a && a.map(S.name).join(" ")} ≠ ${b && b.map(N.name).join(" ")}`; break; }
  }
  is("... the engine's realizations the same, at the same temperature and chance", diff === null, diff);
}

// the church modes (Fux's, with their musica ficta): the same counts and reasons in both engines, every schema in
// five modes at two line levels; the ficta where Fux writes it
{
  const modes = [{ tonic: "D", mode: "dorian" }, { tonic: "E", mode: "phrygian" }, { tonic: "F", mode: "lydian" }, { tonic: "G", mode: "mixolydian" }, { tonic: "A", mode: "aeolian" }];
  let n = 0, badM = [];
  for (const id of Object.keys(P.SCHEMATA)) for (const key of modes) for (const line of ["free", "strict"]) {
    const S = P.schemata({ schema: id, key, figured: false, line }), N = R.overBass({ bass: S.bass, key, figured: false, line, phase: S.phase });
    n++;
    if (S.count() !== N.count()) badM.push(`${id} ${key.mode} ${line}: ${S.count()} ≠ ${N.count()}`);
    else { const a = S.fan([]).map((x) => x.reason), b = N.fan([]).map((x) => x.reason); if (JSON.stringify(a) !== JSON.stringify(b)) badM.push(`${id} ${key.mode} ${line}: reasons`); }
  }
  is(`the church modes: the same counts and reasons in ${n} cases (Study 51's schemata × 5 modes × 2 line levels)`, badM.length === 0, badM.slice(0, 5).join("; "));
  const K = P.keyOf({ tonic: "D", mode: "dorian" });
  const S = P.schemata({ schema: "7-6", key: { tonic: "D", mode: "dorian" }, figured: false });
  const names = S.fan([]).map((x) => x.name + ":" + (x.reason || "ok"));
  is("… D dorian: C♯ and B♭ its ficta, F♯ only in the last chord, E♭ never a candidate", K.name(6, 1) === "C♯4" && K.name(5, -1) === "B♭3" && names.some((x) => /^F♯\d:.*only in the last chord/.test(x)) && !names.some((x) => /^E♭/.test(x)));
}

// styles: inheritance, a rule removed or reparametrized
{
  const lib = { ...R.STYLES, "no-leaps": { style: "no-leaps", version: "0.1.0", extends: "partimento-1", rules: [["leaps", { line: "strict" }], ["edges", { end: false }], ["melodic-minor", false]] } };
  const st = R.resolveStyle(lib["no-leaps"], lib);
  is("a style extends another: a rule named again takes its new parameters, [id false] removes it, the rest kept in order",
     st.rules.length === 12 && st.rules.find(([x]) => x === "leaps")[1].line === "strict" && st.rules.find(([x]) => x === "edges")[1].end === false && !st.rules.some(([x]) => x === "melodic-minor") && st.rules[0][0] === "range");
  const S = P.schemata({ schema: "thirds", figured: false, line: "strict", end: false });
  const N = R.overBass({ bass: S.bass, key: S.key, figured: false, phase: S.phase, style: st });
  is("... and counts as the parameters it names (the strict line, no end): " + N.count(), N.count() === S.count());
}

// several voices over the bass (step 3): the two and three upper voices of Studies 54, 57, 59 and 62 — the same count,
// the same reason for every tuple along realizations drawn, the same engine; the tables the same
{
  is("the chords in three and four parts: partimento.mjs's tables, as they are", JSON.stringify(R.CHORDS) === JSON.stringify(P.CHORDS) && JSON.stringify(R.CHORDS4) === JSON.stringify(P.CHORDS4));
  const multi = [];
  const { galant, SCHEMATA: GS } = await import("../studies/59-galant/kairotic/galant.mjs");
  for (const id of Object.keys(GS)) multi.push([`59 ${id}`, galant({ schema: id }), "parts"]);
  const { octave, PHRASES: OP } = await import("../studies/57-octave/kairotic/octave.mjs");
  for (const id of Object.keys(OP)) multi.push([`57 ${id}`, octave({ phrase: id }), "parts"]);
  for (const [cad, sch] of [["simple", "fauxbourdon"], ["galant", "romanesca"], ["compound-64", "tied-bass"]]) multi.push([`54 ${sch}+${cad}`, P.parts({ schema: sch, cadence: cad }), "parts"]);
  const { fourParts, PHRASES: FP } = await import("../studies/62-four/kairotic/four.mjs");
  for (const id of Object.keys(FP)) multi.push([`62 ${id}`, fourParts({ phrase: id }), "four"]);
  const t0 = Date.now(), off = [], whys = [], eng = [];
  const r = rng(62);
  for (const [name, Q, kind] of multi) {
    const N = (kind === "parts" ? R.partsOverBass : R.fourOverBass)({ ...Q.spec, bass: Q.bass, key: Q.key });
    if (Q.count() !== N.count()) { off.push(`${name}: ${Q.count()} ≠ ${N.count()}`); continue; }
    // the reasons: every pair or triple of the voices' own candidates, at every unit of a realization drawn
    const W0 = Q.sample(r);
    if (W0 && !whys.length) {
      const W = kind === "parts" ? [W0.top, W0.middle] : [W0.soprano, W0.alto, W0.tenor], Vs = kind === "parts" ? [Q.top, Q.middle] : Q.voices;
      for (let t = 0; t < W[0].length && whys.length < 1; t += 2) {
        const pre = W.map((U) => U.slice(0, t)), ok = Vs.map((V, i) => V.codes.filter((c) => V.check(pre[i], t, c) === null));
        const tuples = ok.reduce((acc, cs) => acc.flatMap((x) => cs.map((c) => [...x, c])), [[]]);
        for (const x of tuples.slice(0, 400)) {
          const a = kind === "parts" ? Q.check(W[0], W[1], t, x[0], x[1]) : Q.check(W, t, x), b = N.check(W, t, x);
          if (a !== b) { whys.push(`${name} unit ${t + 1}: "${a}" ≠ "${b}"`); break; }
        }
      }
    }
    const e1 = Q.engine({ temp: 0.5, r: rng(11) }), e2 = N.engine({ temp: 0.5, r: rng(11) });
    if (JSON.stringify(e1) !== JSON.stringify(e2)) eng.push(name);
    if (W0 && Q.judge(W0) !== N.judge(W0)) eng.push(name + " (judge)");
    if (W0 && JSON.stringify(Q.chords(W0)) !== JSON.stringify(N.chords(W0))) eng.push(name + " (chords)");
  }
  is(`two and three upper voices: the same counts in ${multi.length} phrases (Studies 54, 57, 59, 62)`, off.length === 0, off.slice(0, 4).join("; "));
  is("... the same reason for every tuple of the voices' candidates (the first rule between them that refuses it)", whys.length === 0, whys[0]);
  is("... the same engine, judgement and chords made", eng.length === 0, eng.slice(0, 4).join("; "));
  notes.push(`${multi.length} phrases in three and four parts compared in ${Date.now() - t0} ms`);
}

// a bass as notes (the cac box): the same as partimento.mjs's overBass — 2, 3 and 4 parts, figured or not, judged
{
  const RO = ["c3 5/3", "d3 6/4/3", "e3 6/3", "f3 6/5", "g3 5/3", "a3 6/3", "b3 6/5", "c4 5/3"].map((x, i) => { const [p, f] = x.split(" "); return { midi: 48 + [0, 2, 4, 5, 7, 9, 11, 12][i], units: 1, fig: f }; });
  const bare = RO.map(({ fig, ...n }) => n), off = [];
  for (const notes of [RO, bare]) for (const voices of [2, 3, 4]) for (const key of ["C", undefined]) {
    // (four parts over a bare bass count 4,901,760,148 realizations in about a minute in each engine — the same, but too
    // long for CI: decision 4's local search will take it)
    if ((voices === 4 && notes === bare)) continue;
    const a = P.overBass({ notes, key, voices }), b = R.fromNotes({ notes, key, voices });
    const tag = `${voices} parts ${notes === RO ? "figured" : "bare"} ${key || "guessed"}`;
    if (a.count() !== b.count()) { off.push(`${tag}: ${a.count()} ≠ ${b.count()}`); continue; }
    const ea = a.engine({ temp: 0.5, r: rng(3) }), eb = b.engine({ temp: 0.5, r: rng(3) });
    if (JSON.stringify(ea) !== JSON.stringify(eb)) off.push(`${tag}: the engine`);
    else if (ea && (a.judge(ea) !== b.judge(eb) || JSON.stringify(a.chords(ea)) !== JSON.stringify(b.chords(eb)))) off.push(`${tag}: judge or chords`);
    if (a.degAt(3) !== b.degAt(3) || a.spell(a.code(54)) !== b.spell(b.code(54))) off.push(`${tag}: degree or spelling`);
  }
  const book = { soprano: "g5 g5 g5 a5 g5 f5 f5 e5", alto: "e5 f5 e5 d5 d5 c5 d5 c5", tenor: "c5 b4 c5 c5 b4 a4 g4 g4" };
  const a = P.overBass({ notes: bare, key: "C", voices: 4 }), b = R.fromNotes({ notes: bare, key: "C", voices: 4 });
  const M = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }, mi = (s) => 12 * (+s.slice(-1) + 1) + M[s[0]];
  const W = Object.fromEntries(Object.entries(book).map(([k, v]) => [k, v.split(" ").map((s) => b.code(mi(s)))]));
  if (a.judge(W) !== b.judge(W)) off.push(`the book's RO judged: "${a.judge(W)}" ≠ "${b.judge(W)}"`);
  is("a bass as notes (cac partimento, cac judge): fromNotes as partimento.mjs's overBass — counts, engine, judgement, chords", off.length === 0, off.slice(0, 4).join("; "));
}

// a bass with notes left without figures (cac partimento fills them): the Rule of the Octave's chord where the bass
// moves by step, a 5/3 where it leaps and at the ends — the help's RO with ①, ⑤ and ① unfigured is Study 62's RO up
{
  const figs = [null, "6/4/3", "6/3", "6/5", null, "6/3", "6/5", null];
  const notes = [48, 50, 52, 53, 55, 57, 59, 60].map((m, i) => ({ midi: m, units: 1, ...(figs[i] ? { fig: figs[i] } : {}) }));
  const ob = R.fromNotes({ notes, key: "C", voices: 4, fill: true });
  is("figures filled: the help's RO, ①, ⑤ and ① left unfigured, takes 5/3 there — 3,610 realizations, as Study 62's RO up", ob.count() === 3610n && ob.units.map((u) => u.chord).join(" ") === "5/3 6/4/3 6/3 6/5 5/3 6/3 6/5 5/3", String(ob.count()));
  const bare = (ms, v) => R.fromNotes({ notes: ms.map((m) => ({ midi: m, units: 1 })), key: "C", voices: v, fill: true }).units.map((u) => u.chord).join(" ");
  is("... a bare bass: the RO going down (4/2 on ④ from ⑤), a cadence's leaps 5/3 (④ going up to ⑤ its 6/5), three parts plainer",
     bare([60, 59, 57, 55, 53, 52, 50, 48], 4) === "5/3 6/3 6/3 5/3 4/2 6/3 6/4/3 5/3" && bare([48, 53, 55, 48], 4) === "5/3 6/5 5/3 5/3" && bare([48, 50, 52, 53, 55], 3) === "5/3 6/3 6/3 6/3 5/3",
     [bare([60, 59, 57, 55, 53, 52, 50, 48], 4), bare([48, 53, 55, 48], 4), bare([48, 50, 52, 53, 55], 3)].join(" | "));
  is("... and judged, nothing filled (a judgement reads the chords the voices make)", R.fromNotes({ notes, key: "C", voices: 4 }).units[0].chord === null);
}

// a time limit for the count (a page must not freeze): a 16-bar bass of half notes in A major without figures, in four
// parts, takes about a minute to count — countWithin gives up in time, search finds a realization by the rules
{
  const A = { A2: 45, B2: 47, "C#3": 49, D3: 50, E3: 52, "F#3": 54, "G#3": 56, A3: 57 };
  const line = "A2 B2 C#3 D3 E3 F#3 G#3 A3 A3 E3 F#3 C#3 D3 A2 D3 E3 D3 C#3 B2 A2 F#3 D3 E3 E3 A2 D3 E3 E3 F#3 D3 E3 A2".split(" ");
  let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (const voices of [4, 3, 2]) {
    const ob = R.fromNotes({ notes: line.map((n) => ({ midi: A[n], units: voices === 4 ? 1 : 2 })), key: "A major", voices });
    const t0 = Date.now(), c = ob.countWithin(300), dt = Date.now() - t0;
    if (voices === 4) is("countWithin: a 16-bar bass without figures in four parts, too long to count, gives up in time", c === null && dt < 1500, `${c} in ${dt} ms`);
    let found;
    try { found = ob.search({ temp: 0.5, r, ms: 4000 }); } catch (e) { found = e.message; }
    const ok = found && typeof found === "object" && (voices === 2 ? !ob.P.judge(found.top) : !ob.P.judgeW(Object.values(found), "long"));
    is(`search, ${voices} parts: a realization without counting, every unit by the rules`, ok, String(found).slice(0, 80));
  }
  const F = R.fromNotes({ notes: [0, 2, 4, 5].map((d, i) => ({ midi: 48 + d, units: 1, fig: ["5/3", "6/4/3", "6/3", "6/5"][i] })), key: "C major", voices: 4 });
  is("... a short bass counts exactly, within the limit as without it", F.countWithin(1000) === F.count());
  is("within: past its deadline a count throws TooLong", (() => {
    try { R.within(0, () => R.fromNotes({ notes: line.map((n) => ({ midi: A[n], units: 2 })), key: "A major", voices: 4 }).count()); return false; } catch (e) { return e instanceof R.TooLong; }
  })());
}

const failed = results.filter((r) => !r[1]);
console.log(`${results.length - failed.length} / ${results.length} passed`);
for (const [w, ok, d] of results) if (!ok) console.log("  FAIL " + w + (d ? " — " + d : ""));
for (const s of notes) console.log("  · " + s);
process.exit(failed.length ? 1 : 0);
