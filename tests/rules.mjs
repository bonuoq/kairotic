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
  // the studies written on @kairotic/rules keep a copy of it beside their kernel (Study 65 on): the package's, as it is
  const { readdirSync, existsSync } = await import("node:fs");
  const copies = readdirSync(join(root, "studies")).filter((d) => existsSync(join(root, "studies", d, "kairotic", "rules.mjs")));
  const off = copies.flatMap((d) => ["rules.mjs", "tonal.mjs", "soft.mjs", "functions.mjs"].filter((f) =>
    readFileSync(join(root, "studies", d, "kairotic", f), "utf8") !== readFileSync(join(root, "packages/rules/assets", f), "utf8")).map((f) => `${d}/${f}`));
  is(`the studies' copies of @kairotic/rules, as it is (${copies.join(", ")})`, copies.length && off.length === 0);
  // the measure of a description (bits.mjs): the studies that compose or analyse by it keep a copy, the package's
  const bitsCopies = readdirSync(join(root, "studies")).filter((d) => existsSync(join(root, "studies", d, "kairotic", "bits.mjs")));
  const bitsOff = bitsCopies.filter((d) => readFileSync(join(root, "studies", d, "kairotic", "bits.mjs"), "utf8") !== readFileSync(join(root, "packages/rules/assets/bits.mjs"), "utf8"));
  is(`the studies' copies of bits.mjs, as it is (${bitsCopies.join(", ")})`, bitsCopies.length >= 3 && bitsOff.length === 0);
  // the tonal functions (functions.mjs): the studies that keep a copy, the package's
  const fnCopies = readdirSync(join(root, "studies")).filter((d) => existsSync(join(root, "studies", d, "kairotic", "functions.mjs")));
  is(`the studies' copies of functions.mjs, as it is (${fnCopies.join(", ")})`, fnCopies.length >= 1 && fnCopies.every((d) => readFileSync(join(root, "studies", d, "kairotic", "functions.mjs"), "utf8") === readFileSync(join(root, "packages/rules/assets/functions.mjs"), "utf8")));
  const Fn = await import("../packages/rules/assets/functions.mjs"), C = { tonic: "C" }, Am = { tonic: "A", mode: "minor" };
  const lab = (chords, key = C) => Fn.functionsOf(chords, key).map(Fn.label).join(" ");
  is("functions.mjs: in C, C Dm7 G7 C read T S D T; C/G over G the cadential 6/4, a dominant; D7 V/G; B°7 the dominant, C♯°7 an applied dominant",
     lab([[48, 64, 67], [50, 65, 69, 72], [43, 59, 65, 74], [48, 64, 72]]) === "T S D T" && lab([[43, 60, 64]]) === "D" && lab([[50, 66, 69, 72]]) === "V/G" && lab([[47, 62, 65, 68]]) === "D" && Fn.functionOf([49, 64, 67, 70], C).fn === "A");
  is("… in A minor: Am Dm E7 Am read T S D T, F (⑥) the tonic's parallel",
     lab([[45, 60, 64], [50, 65, 69], [40, 56, 62, 71], [45, 60, 69]], Am) === "T S D T" && lab([[41, 60, 65]], Am) === "T");
  is("… the grammar: G7 → F a retrogression, D7 → C an applied dominant unresolved, G → C/E fine, a phrase ending on G7 not ended",
     Fn.grammarErrors(Fn.functionsOf([[43, 59, 65], [41, 57, 65]], C), { end: false }).length === 1 &&
     Fn.grammarErrors(Fn.functionsOf([[50, 66, 72], [48, 64, 67]], C), { end: false }).length === 1 &&
     Fn.grammarErrors(Fn.functionsOf([[43, 59, 62], [52, 60, 67]], C)).length === 0 &&
     Fn.grammarErrors(Fn.functionsOf([[48, 64, 67], [43, 59, 65]], C)).some((e) => /tonic/.test(e.reason)));
  is("… two voices imply their chord: C over C an octave the tonic; F–D (a 6th) Dm/F, the subdominant; G–C (a 4th) the cadential 6/4; D–F♯ V/G; in A minor E–B the dominant with its G♯",
     lab([Fn.impliedChord([48, 72], C)]) === "T" && lab([Fn.impliedChord([53, 74], C)]) === "S" && lab([Fn.impliedChord([43, 72], C)]) === "D" &&
     lab([Fn.impliedChord([50, 66], C)]) === "V/G" && Fn.impliedChord([52, 71], Am).includes(56));
  // tension (tension.mjs): Lerdahl's chord distance, the studies' copies
  const tCopies = readdirSync(join(root, "studies")).filter((d) => existsSync(join(root, "studies", d, "kairotic", "tension.mjs")));
  is(`the studies' copies of tension.mjs, as it is (${tCopies.join(", ")})`, tCopies.length >= 1 && tCopies.every((d) => readFileSync(join(root, "studies", d, "kairotic", "tension.mjs"), "utf8") === readFileSync(join(root, "packages/rules/assets/tension.mjs"), "utf8")));
  const Tn = await import("../packages/rules/assets/tension.mjs"), I0 = Tn.placed([48, 52, 55], C), dd = (ps) => Tn.distance(I0, Tn.placed(ps, C)).d;
  is("tension.mjs: Lerdahl's δ from I in C — V 5, IV 5, vi 7, iii 7, ii 8, I 0; V → I 5; V/V in G's region (i 1)",
     dd([43, 47, 50]) === 5 && dd([41, 45, 48]) === 5 && dd([45, 48, 52]) === 7 && dd([40, 43, 47]) === 7 && dd([50, 53, 57]) === 8 && dd([48, 52, 55]) === 0 &&
     Tn.distance(Tn.placed([43, 47, 50], C), I0).d === 5 && Tn.distance(I0, Tn.placed([50, 54, 57, 60], C)).i === 1);
  is("… a chord's surface tension: an inversion 2, a 7th 1 (G7/B 3); a succession's sequential and global tension (I IV V7 I: 0 5 8 5 · 0 5 6 0)",
     Tn.surface(Tn.placed([47, 50, 53, 55], C)) === 3 && Tn.tensions([[48, 52, 55], [41, 45, 48], [43, 47, 50, 53], [48, 52, 55]], C).map((t) => t.sequential + "/" + t.global).join(" ") === "0/0 5/5 8/6 5/0");
  is("… the tonic with a minor 7th is V of ④: C7 reads V/F, and goes to F (C7 → C unresolved, C7 → F/C fine — and F/C → C a plagal close)",
     lab([[48, 52, 55, 58]]) === "V/F" && Fn.grammarErrors(Fn.functionsOf([[48, 52, 55, 58], [48, 52, 55]], C), { end: false }).length === 1 &&
     Fn.grammarErrors(Fn.functionsOf([[48, 52, 55, 58], [48, 53, 57], [48, 52, 55]], C)).length === 0 && lab([[48, 52, 55, 59]]) === "T");
  // the grammar against Bach: his chorales' phrases (studies/_shared/chorales, Sapp's edition, CC BY-NC-SA), read in
  // the home key alone, and in local keys with passing chords
  {
    const corpus = join(root, "studies/_shared/chorales/phrases.json");
    if (existsSync(corpus)) {
      const ps = JSON.parse(readFileSync(corpus, "utf8")).phrases;
      let home = 0, local = 0;
      for (const p of ps) {
        const ch = p.satb.map((r) => [...r]), end = p.cadence ? { tonic: p.cadence.tonic, mode: p.cadence.mode } : null;
        if (Fn.grammarErrors(Fn.functionsOf(ch, p.key), { key: p.key, end: false }).length) home++;
        if (Fn.localFunctions(ch, p.key, { end }).errors.length) local++;
      }
      is(`… Bach's chorales against the grammar: read in the home key alone ${home} of ${ps.length} phrases break it (an applied dominant to another key, a passing V – IV6); read in local keys (the related ones and the cadence's) with passing chords, ${local} — under 8 %`,
         home > 0.15 * ps.length && local < 0.08 * ps.length);
    }
  }
  is("… local keys: a phrase from C closing in G reads its last chords in G, its first in C", (() => { const L = Fn.localFunctions([[48, 52, 55], [41, 57, 60], [43, 59, 62], [48, 52, 57], [50, 54, 57, 60], [43, 59, 62]], C, { end: { tonic: "G", mode: "major" } }); return L.keys[0].tonic === "C" && L.keys.at(-1).tonic === "G" && L.errors.length === 0; })());
  const Bt = await import("../packages/rules/assets/bits.mjs"), lx = Bt.lexicon();
  const first = lx.bits("Q:0,1"); lx.add("Q:0,1");
  is("bits.mjs: a word heard again cheaper than at first, its inversion between, a new one dearest; the inversion negates every number",
     lx.bits("Q:0,1") < lx.bits("Q:0,-1") && lx.bits("Q:0,-1") < lx.bits("H:0") && lx.bits("Q:0,1") < first && Bt.invert("unsplit:passing-mid.m|-1,top|2") === "unsplit:passing-mid.m|1,top|-2" && Bt.economyOf(lx, "Q:0,1", 4) < 0 && Bt.economyOf(lx, "H:0", 4) === 0);
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
  // (the scale up from ①: over ① the final's raised 3rd may sound, over ② not)
  const S = P.schemata({ schema: "thirds", key: { tonic: "D", mode: "dorian" }, figured: false });
  const first = S.fan([]), names0 = first.map((x) => x.name + ":" + (x.reason || "ok"));
  const line = S.engine({ temp: 0.5, r: rng(3) }), t2 = S.bass.findIndex((b) => b.d === 1);
  const names = S.fan(line.slice(0, t2)).map((x) => x.name + ":" + (x.reason || "ok"));
  is("… D dorian: C♯ and B♭ its ficta, F♯ only in a chord on the final (over ①, not over ②), E♭ never a candidate", K.name(6, 1) === "C♯4" && K.name(5, -1) === "B♭3" && names0.some((x) => /^F♯\d:ok/.test(x)) && names.some((x) => /^F♯\d:.*only in a chord on the final/.test(x)) && !names.some((x) => /^E♭/.test(x)));
}

// a church mode's style, Fux's: his examples note against note in three and four parts (tests/assets/fux, Gotham's
// encoding, CC0) judged by modal-2 and modal-4 — which accept them, where the galant styles refuse them; and the engine
// realizing his canti firmi with it
{
  const T = await import("../packages/rules/assets/tonal.mjs");
  const MODE = { c: "ionian", d: "dorian", e: "phrygian", f: "lydian", g: "mixolydian", a: "aeolian" };
  const L = "CDEFGAB", noteOf = (tok) => {
    const m = /^[[(]*\d+\.?([a-gA-G]+)([#-]*)/.exec(tok.trim());
    if (!m) return null;
    const p = m[1], o = p[0] === p[0].toLowerCase() ? 3 + p.length : 4 - p.length;
    return p[0].toUpperCase() + m[2].replace(/-/g, "b") + o;
  };
  const dir = join(root, "tests/assets/fux");
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(dir).filter((f) => f.endsWith(".krn")).sort();
  let modalOk = 0, galantOk = 0, why = [];
  for (const f of files) {
    const txt = readFileSync(join(dir, f), "utf8"), final = /Modal final: (\w)/.exec(txt)[1].toLowerCase();
    const rows = txt.split("\n").filter((l) => l && !/^[!*=]/.test(l)).map((l) => l.split("\t"));
    const key = { tonic: final.toUpperCase(), mode: MODE[final] }, K = T.keyOf(key);
    const V = rows[0].map((_, i) => rows.map((r) => r[i]).filter((x) => x && x !== ".").map(noteOf).filter(Boolean).map((nm) => T.codeOf(K, nm)));
    const avg = (v) => v.reduce((a, c) => a + T.codeDegree(c), 0) / v.length, order = V.map((v, i) => [avg(v), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const bass = V[order[0]], up = order.slice(1).reverse().map((i) => V[i]), n = up.length + 1;
    const units = bass.map((c, i) => ({ d: T.codeDegree(c), r: T.codeAlter(c), struck: true, strong: true, chord: null, key: null, note: i, dominant: false }));
    const span = (u) => { const d = u.map(T.codeDegree); return [Math.min(...d), Math.max(...d)]; };
    const judge = (style) => {
      const P = n === 3 ? R.partsOverBass({ key, bass: units, figured: false, style: style + "-2", top: span(up[0]), middle: span(up[1]), apart: 14, spacing: 22 })
        : R.fourOverBass({ key, bass: units, figured: false, style: style === "modal" ? "modal-4" : "chorale-4", soprano: span(up[0]), alto: span(up[1]), tenor: span(up[2]) });
      return P.judge(n === 3 ? { top: up[0], middle: up[1] } : { soprano: up[0], alto: up[1], tenor: up[2] });
    };
    const w = judge("modal");
    if (w === null) modalOk++; else why.push(`${f}: ${w}`);
    if (judge("partimento") === null) galantOk++;
  }
  is(`Fux's ${files.length} examples note against note in three and four parts: the modal styles accept ${modalOk} (but the lowest voice crossing under the bass), the galant ones ${galantOk}`, files.length === 27 && modalOk >= 26 && galantOk <= 5, why.join("; "));
  // the engine with modal-2 over his phrygian cantus firmus (fig. 106's): a realization it judges its own, every chord a 5/3 or a 6/3
  const key = { tonic: "E", mode: "phrygian" }, K = T.keyOf(key);
  const units = "E3 C3 D3 C3 A2 A3 G3 E3 F3 E3".split(" ").map((nm, i) => { const c = T.codeOf(K, nm); return { d: T.codeDegree(c), r: T.codeAlter(c), struck: true, strong: true, chord: null, key: null, note: i, dominant: false }; });
  const P = R.partsOverBass({ key, bass: units, figured: false, style: "modal-2" }), x = P.engine({ temp: 0.5, r: rng(5) });
  is("… and the engine with modal-2 over his E phrygian cantus firmus: a realization it judges legal, every chord a 5/3 or a 6/3 (or less)", x && P.judge(x) === null && P.chords(x).every((c) => ["5/3", "(5)/3", "6/3", "6", "5", "8"].includes(c)));
  notes.push("modal-2 over Fux's E phrygian: " + (x ? P.chords(x).join(" ") : "none"));
  const ob = R.fromNotes({ notes: "D3 F3 E3 D3".split(" ").map((nm) => ({ midi: T.keyOf({ tonic: "D", mode: "dorian" }).midi(T.codeDegree(T.codeOf(T.keyOf({ tonic: "D", mode: "dorian" }), nm)), 0) })), key: "d dorian", voices: 3 });
  is("… a church mode's bass in a tree (cac partimento d dorian): the modal style by default", ob.P.style.style === "modal-2");
}

// the comes's invertible counterpoint in the partimento's world: a voice over a bass that stands inversion at the
// octave, the 10th or the 12th (rule invertible, named by a style): fewer lines, never none; at the octave no 5th
// with the bass (it would turn into a 4th)
{
  const S = P.schemata({ schema: "thirds", figured: false });
  const base = R.overBass({ bass: S.bass, key: S.key, figured: false, phase: S.phase }).count();
  const inv = (at) => R.overBass({ bass: S.bass, key: S.key, figured: false, phase: S.phase, style: R.resolveStyle({ style: "inv", version: "0", extends: "partimento-1", rules: [["invertible", { at }]] }) });
  const I8 = inv(8), counts = [8, 10, 12].map((at) => (at === 8 ? I8 : inv(at)).count());
  const x = I8.engine({ temp: 0.5, r: rng(2) });
  const fifths = x.filter((c, t) => I8.vertical(t, c).cls === 4).length;
  is(`invertible counterpoint over a bass (the comes's, now the partimento's): the scale in 3rds standing inversion at the octave, 10th, 12th — ${counts.join(", ")} of ${base}`, counts.every((c) => c > 0n && c < base) && fifths === 0);
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
    // (three of Study 62's counts are its memo's, which reads three units back and not where a note held began: two
    // states it took for one had different futures. The engine's memo reads that far — its counts, checked against
    // every realization enumerated without a memo)
    const exact = { "62 ro-down": [8450n, 8390n], "62 ro-down-minor": [143615n, 142905n], "62 bach": [132347n, 131519n] }[name];
    if (exact ? !(Q.count() === exact[0] && N.count() === exact[1]) : Q.count() !== N.count()) { off.push(`${name}: ${Q.count()} ≠ ${N.count()}`); continue; }
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

// styles written as data (EDN through clj->js: keywords as strings): inheritance of a style of several voices — its
// rules between voices, its voice's style —, versions, a style defined by name, the parts a style writes
{
  const { fourParts } = await import("../studies/62-four/kairotic/four.mjs");
  const F = fourParts({ phrase: "dominant-seventh" }), G = fourParts({ phrase: "ro-up" });
  const free = { style: "free-sevenths", extends: ["chorale-4", "1.0.0"], between: [["seventh", { free: true }]] };
  const a = R.fourOverBass({ ...F.spec, bass: F.bass, key: F.key, style: free }).count(), b = R.fourOverBass({ ...F.spec, bass: F.bass, key: F.key, freeSevenths: true }).count();
  is(`a style extends chorale-4 with the dominant's 7th free: as freeSevenths (${a})`, a === b && a !== F.count());
  const strict = { style: "strict-lines", extends: "chorale-4", voice: { rules: [["leaps", { line: "strict" }]] } };
  const c = R.fourOverBass({ ...G.spec, bass: G.bass, key: G.key, style: strict }).count(), d = R.fourOverBass({ ...G.spec, bass: G.bass, key: G.key, line: "strict" }).count();
  is(`... its voices' style extends the parent's (every line strict): as line strict (${c} of ${G.count()})`, c === d && c < G.count());
  const st = R.resolveStyle(strict);
  is("... the rest kept, in order: its rules between voices, its voice's other rules", st.between.length === R.resolveStyle("chorale-4").between.length && R.resolveStyle(st.voice).rules.length === R.resolveStyle("partimento-1").rules.length);
  const err = (f) => { try { f(); return null; } catch (e) { return e.message; } };
  is("... a version asked of the parent: the same major, its minor at least", /is 1\.\d+\.\d+/.test(err(() => R.resolveStyle({ extends: ["chorale-4", "2.0.0"] })) || "") && err(() => R.resolveStyle({ extends: ["chorale-4", "1.0.0"] })) === null);
  is("... a rule the catalogue does not have, named", /no rule sevenths in between/.test(err(() => R.checkStyle({ style: "x", extends: "chorale-4", between: [["sevenths"]] })) || ""));
  const heavy = R.fourOverBass({ ...G.spec, bass: G.bass, key: G.key, style: { extends: "chorale-4", weights: { doubling: 5 } } }).fan()[0];
  const light = R.fourOverBass({ ...G.spec, bass: G.bass, key: G.key, weights: { doubling: 5 } }).fan()[0];
  is("... a style's weights reach its voices and the rules between them, as the spec's", JSON.stringify(heavy.parts) === JSON.stringify(light.parts));
  const lib = { ...R.STYLES };
  R.defineStyle({ style: "my-chorale", version: "0.2.0", extends: "chorale-4", weights: { doubling: 2 } }, lib);
  is("a style defined by its name may be named, and extended", R.resolveStyle({ extends: ["my-chorale", "0.1.0"] }, lib).weights.doubling === 2 && R.partsOf("my-chorale", lib) === 4);
  const notes = [48, 50, 52, 53, 55].map((m) => ({ midi: m, units: 1 }));
  const three = R.fromNotes({ notes, key: "C", style: "partimento-2", fill: true });
  is("a style says how many parts it writes: partimento-2, three, unless voices asks for others", three.voices === 3 && /writes 3 parts, not 4/.test(err(() => R.fromNotes({ notes, key: "C", style: "partimento-2", voices: 4 })) || ""));
}

// the comes on the one engine (canon.mjs, step 5): its systems the same as counterpoint.mjs's, and its canons counted
// to the number — random specs over the four systems, species, imitation, inversions asked, the comes inverted or
// augmented, a rule turned off
{
  const CP = await import("../packages/cac/assets/counterpoint.mjs");
  const CV = await import("../packages/rules/assets/canon.mjs");
  const SY = await import("../packages/rules/assets/systems.mjs");
  is("systems.mjs: counterpoint.mjs's systems, as they are", ["DIATONIC", "MEANTONE", "SEPTIMAL31", "PENTATONIC"].every((k) => JSON.stringify(SY[k]) === JSON.stringify(CP[k])) && String(SY.makeSystem) === String(CP.makeSystem));
  const r = rng(11), pick = (a) => a[Math.floor(r() * a.length)];
  let tot = 0, diff = [];
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) {
    const sys = SY.SYSTEMS[pick(["diatonic", "diatonic", "diatonic", "pentatonic", "septimal31", "meantone"])], N = (sys.steps || sys.tuning.cents).length;
    const tonic = pick([0, 1, 4, 5]), b = pick([1, 2, 2]);
    const spec = { tonic, k: pick([N, -N, 0, Math.round(4 * N / 7), -Math.round(4 * N / 7), 2]), d: pick([1, 2, 2, 3]), b, n: pick([5, 6, 7]),
      lo: tonic - pick([1, 2, 3]), hi: tonic + pick([5, 7, 8]), system: sys, imitation: pick([1, 1, 0.6, 0.3, 0]),
      species: b === 2 && r() < 0.25 ? 4 : undefined, phase: b === 2 && r() < 0.2 ? 1 : 0, maxHold: pick([2, 2, 3]),
      invert: r() < 0.25 ? [pick([8, 10, 12])] : [], transform: r() < 0.15 ? { kind: "inversion" } : r() < 0.1 ? { kind: "augmentation", m: 2 } : undefined,
      on: r() < 0.3 ? { [pick(["suspension-kinds", "strong-parallels", "leap-recovery", "strict-direct", "no-crossing", "cadence", "weak-dissonance"])]: r() < 0.5 } : undefined };
    const a = CP.canon(spec).count([], []), z = CV.canonVoices(spec).count();
    tot++;
    if (!(a < 2 ** 53 ? BigInt(a) === z : Math.abs(a - Number(z)) / a < 1e-9)) diff.push(`${JSON.stringify({ ...spec, system: sys.name })}: ${a} ≠ ${z}`);
  }
  is(`the comes on the one engine (canon-2): the same counts in ${tot} canons, imitations and free counterpoints`, diff.length === 0, diff.slice(0, 3).join("; "));
  notes.push(`${tot} canons compared in ${Date.now() - t0} ms`);
  // and a canon the engine draws is legal by both
  const spec = { tonic: 0, k: 7, d: 2, b: 2, n: 8, lo: -2, hi: 8 }, CVs = CV.canonVoices(spec), x = CVs.sample(rng(3));
  const K = CP.canon(spec);
  const legal = x && x.dux.every((_, t) => K.checkDux(x.dux.slice(0, t), x.comes.slice(0, t), x.dux[t]) === null && K.checkPair(x.dux.slice(0, t), x.comes.slice(0, t), x.dux[t], x.comes[t]) === null);
  is("… a canon drawn on the one engine: legal for counterpoint.mjs too, beat by beat", legal && CVs.judge(x.dux, x.comes) === null);

  // one tonal layer for both worlds: the canon in a key of tonal.mjs's (the partimento's). A church mode without its
  // ficta counts as on the white keys; with it, the canon sings the cadence's raised leading tone
  const WHITE = { ionian: ["C", 0], dorian: ["D", 1], phrygian: ["E", 2], lydian: ["F", 3], mixolydian: ["G", 4], aeolian: ["A", 5] };
  const r2 = rng(5), pick2 = (a) => a[Math.floor(r2() * a.length)];
  let same = 0, n2 = 0, richer = 0;
  for (let i = 0; i < 20; i++) {
    const mode = pick2(Object.keys(WHITE)), [tn, wt] = WHITE[mode], b = pick2([1, 2, 2]);
    const rel = { k: pick2([7, -7, 4, -4, 0]), d: pick2([1, 2, 3]), b, n: pick2([5, 6, 7]), lo: -pick2([1, 2, 3]), hi: pick2([5, 7, 8]), imitation: pick2([1, 0.6, 0]),
      species: b === 2 && r2() < 0.25 ? 4 : undefined, invert: r2() < 0.2 ? [pick2([8, 10, 12])] : [] };
    const white = CV.canonVoices({ ...rel, tonic: wt, lo: wt + rel.lo, hi: wt + rel.hi }).count();
    const keyed = CV.canonVoices({ ...rel, tonic: 0, key: { tonic: tn, mode }, ficta: false }).count();
    n2++; if (white === keyed) same++;
    if (CV.canonVoices({ ...rel, tonic: 0, key: { tonic: tn, mode } }).count() > keyed) richer++;
  }
  is(`one tonal layer: a church mode as a key of tonal.mjs, without its ficta, counts as on the white keys (${same} of ${n2} canons); with it, more (${richer})`, same === n2 && richer > 0);
  const DD = CV.canonVoices({ tonic: 0, key: { tonic: "D", mode: "dorian" }, k: -7, d: 2, b: 2, n: 10, lo: -1, hi: 8 });
  const xs = [1, 2, 3, 4, 5, 6].map((s) => DD.sample(rng(s))), nm = DD.world.S.pitchName;
  const m7 = (v) => ((v % 7) + 7) % 7, dg = DD.world.S.deg;
  const cad = (L) => { const a = L[L.length - 2], z = L[L.length - 1]; return !(m7(dg(z)) === 0 && m7(dg(a)) === 6 && dg(z) - dg(a) === 1) || /♯/.test(nm(a)); };
  is("… a canon in D dorian: whoever rises to the final through the leading tone at the end sings C♯ (six drawn)", xs.every((x) => x && cad(x.dux) && cad(x.comes)));
  notes.push("D dorian canon: " + xs[0].dux.map(nm).join(" ") + " / " + xs[0].comes.map((c) => (c === null ? "–" : nm(c))).join(" "));
  // its style among the others, written as data: one that extends canon-2 and removes a rule counts as the spec that
  // turns it off; a rule the canon's catalogue does not have named; not a style for a bass's upper voices
  const sp = { tonic: 0, k: 7, d: 2, b: 2, n: 7, lo: -2, hi: 8, imitation: 0.3 };
  const freeStyle = { style: "crossing-free", extends: ["canon-2", "1.0.0"], between: [["crossing", false]] };
  const e2 = (f) => { try { f(); return null; } catch (e) { return e.message; } };
  is("the canon's style in EDN: extending canon-2 without crossing counts as the spec turning crossing and spacing off",
     CV.canonVoices(sp, freeStyle).count() === CV.canonVoices({ ...sp, on: { "no-crossing": false, spacing: false } }).count() && R.partsOf("canon-2") === 2 &&
     /no rule parallels in between/.test(e2(() => R.checkStyle({ extends: "canon-2", between: [["parallels"]] })) || "") &&
     /not of a bass's upper voices/.test(e2(() => R.fromNotes({ notes: [{ midi: 48, units: 1 }, { midi: 55, units: 1 }], key: "C", style: "canon-2" })) || ""));
}

// cac imitation (canon.mjs's imitation, style imitation-2): a dux given, the comes found against it
{
  const CV = await import("../packages/rules/assets/canon.mjs");
  const M = { C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72 };
  const jq = "C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4 G4 E4 F4 G4 G4".split(" ").map((x) => ({ midi: M[x], units: 1 }));
  const I8 = CV.imitation({ notes: jq, key: "C", k: -7, d: 8 }), I2 = CV.imitation({ notes: jq, key: "C", k: -7, d: 2 });
  const x = I8.sample(rng(1));
  is("imitation: Frère Jacques, a canon at the octave below two bars later — exactly one comes, the round; two units later none",
     I8.count() === 1n && I2.count() === 0n && x.comes.slice(8).map(I8.spell).join(" ") === "c3 d3 e3 c3 c3 d3 e3 c3" && x.dux.every((c, t) => c === I8.dux[t]));
  const cf = "D4 F4 E4 D4 G4 F4 A4 G4 F4 E4 D4".split(" ").map((x) => ({ midi: { D4: 62, E4: 64, F4: 65, G4: 67, A4: 69 }[x], units: 1 }));
  const IF = CV.imitation({ notes: cf, key: "d dorian", k: -4, d: 2, imitation: 0.6 }), y = IF.engine({ temp: 0.5, r: rng(3) });
  is(`... Fux's D dorian cantus firmus as a dux, a near imitation a 5th below: ${IF.count()} comes (375), the drawn one through C♯ to its final`,
     IF.count() === 375n && y && /c#4 d4$/.test(y.comes.filter((c) => c !== null).map(IF.spell).join(" ")));
  // a dux with rests (C D E – in the first phrase and E F G – in the third): the canon's comes rests where the dux rested
  const jr = jq.map((x, i) => (i === 3 || i === 11 ? { midi: null, units: 1 } : x));
  const IR = CV.imitation({ notes: jr, key: "C", k: -7, d: 8 }), xr = IR.sample(rng(1));
  is("... a dux with rests: the comes still the round, resting where the dux rested (the rest a null code, kept in place)",
     IR.count() === 1n && xr.comes.slice(8).map((c) => (c === null ? "-" : IR.spell(c))).join(" ") === "c3 d3 e3 - c3 d3 e3 c3" &&
     xr.dux[3] === null && xr.dux[11] === null);
  // a long dux: counted within a limit (null past it), else found by search — the page does not freeze
  const longCf = Array.from({ length: 8 }, () => cf).flat();
  const IL = CV.imitation({ notes: longCf, key: "d dorian", k: -4, d: 2, imitation: 0 });
  const t1 = Date.now(), cl = IL.countWithin(1500);
  is(`... a long dux (88 notes, free counterpoint): counted within the limit (${cl === null ? "too long" : String(cl).length + " digits"}, ${Date.now() - t1} ms), or null past it`,
     (cl === null || cl > 0n) && Date.now() - t1 < 4000 && IL.search({ temp: 0.5, r: rng(5), ms: 2000 }) !== null);
}

// where a bass with no realization dies (deadEnd): an agent's 16-bar bass in A, half and whole notes, a V7 then V
// again over the same note; and none for one that has realizations
{
  const MI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const mi = (p) => { const m = p.match(/([a-g])(#?)(\d)/); return 12 * (+m[3] + 1) + MI[m[1]] + (m[2] ? 1 : 0); };
  const asNotes = (bass) => { const u = Math.min(...bass.map(([, d]) => d)); let t = 0;
    return bass.map(([p, d, f]) => { const units = Math.round(d / u), n = { midi: mi(p), units, fig: f || undefined, strong: Array.from({ length: units }, (_, j) => Math.round((t + j * u) / u) % 2 === 0) }; t += d; return n; }); };
  const NONE = [["a2", 2, ""], ["c#3", 2, "6"], ["d3", 2, ""], ["b2", 2, "6"], ["e3", 2, ""], ["e3", 2, "7"], ["a2", 4, ""], ["c#3", 2, "6"], ["d3", 2, ""], ["e3", 2, ""], ["c#3", 2, "6"], ["d3", 2, ""], ["e3", 2, ""], ["e3", 4, ""], ["a3", 2, ""], ["g#3", 2, "6"], ["f#3", 2, ""], ["e3", 2, ""], ["d3", 2, ""], ["c#3", 2, "6"], ["b2", 2, ""], ["e3", 2, ""], ["a2", 2, ""], ["d3", 2, ""], ["b2", 2, "6"], ["e3", 2, ""], ["e3", 2, ""], ["e3", 2, "7"], ["a2", 4, ""]], SOME = [["a2", 4, ""], ["b2", 4, "6"], ["c#3", 4, "6"], ["d3", 4, ""], ["e3", 4, ""], ["f#3", 4, "6"], ["g#3", 4, "6"], ["a3", 4, ""], ["f#3", 4, ""], ["b2", 4, ""], ["e3", 4, "7"], ["a2", 4, ""], ["d3", 4, ""], ["b2", 4, "6/5"], ["e3", 4, ""], ["a2", 4, ""]];
  const a = R.fromNotes({ notes: asNotes(NONE), key: "A major", voices: 4, fill: true }), d = a.deadEnd();
  is("deadEnd: a bass with no realization says where it dies and why", a.countWithin(3000) === 0n && d && d.note >= 0 && d.reasons.length > 0, JSON.stringify(d));
  const b = R.fromNotes({ notes: asNotes(SOME), key: "A major", voices: 3, fill: true });
  is("... and nothing for one that has realizations", b.countWithin(3000) > 0n && b.deadEnd() === null);
}

// cac judge with canon-2 (canon.mjs's judgeTwo): two voices judged by the canon's rules
{
  const CV = await import("../packages/rules/assets/canon.mjs");
  let fine = 0, tried = 0;
  for (const [im, k, d] of [[1, -7, 2], [1, -4, 2], [0.6, -7, 2]]) {
    const V = CV.canonVoices({ tonic: 0, key: "C", k, d, b: 2, n: 10, lo: 0, hi: 7, imitation: im }, "canon-2");
    const m = (c) => ({ midi: c === null ? null : V.world.S.midi(c), units: 1 });
    for (let i = 0; i < 3; i++) {
      const R = V.sample(rng(i + 11)); tried++;
      const J = CV.judgeTwo({ upper: R.dux.map(m), lower: R.comes.map(m), key: "C", imitation: im });
      if (J.ok && J.dux === "upper" && J.k === k && J.d === d) fine++;
    }
  }
  is(`judgeTwo: canons the engine draws (at the octave and the 5th below, a near imitation) are by the rules, their k and d read from the voices (${fine}/${tried})`, fine === tried);
  const P = (s) => s.split(" ").map((p) => (p === "-" ? { midi: null, units: 1 } : { midi: { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[p[0]] + 12 * (+p[1] + 1), units: 1 }));
  const J = CV.judgeTwo({ upper: P("c4 d4 e4 f4 e4 d4 c4"), lower: P("c3 g3 a3 d3 c3 b2 c3"), key: "C" });
  is(`... a first species written badly: free counterpoint (they enter together), the parallel 5ths between them and the lower voice's leaps found, by unit — ${J.reasons.map((r) => `${r.unit + 1} ${r.voice}: ${r.why}`).join("; ")}`,
     !J.ok && J.imitation === "free" && J.reasons.some((r) => r.unit === 2 && r.voice === "both" && /parallel 5ths/.test(r.why)) && J.reasons.some((r) => r.voice === "dux" && /leap/.test(r.why)));
  const Jc = CV.judgeTwo({ upper: P("c4 d4 e4 c4 g4 f4 e4 d4 c4 -"), lower: P("- - c3 d3 e3 c3 a3 f3 e3 d3"), key: "C" });
  is(`... a canon whose comes leaves the dux (A for G): the unit where it does — ${Jc.reasons.filter((r) => /canon/.test(r.why)).map((r) => `${r.unit + 1}: ${r.why}`).join("; ")}`, !Jc.ok && Jc.d === 2 && Jc.k === -7 && Jc.reasons.some((r) => r.unit === 6 && /a canon: the comes is the dux.s note/.test(r.why)));
}

// tonal functions in chorale-4 (1.4.0): the book's prototypes keep them all — the same counts without the rule — and
// where the chords are free (a soprano and a bass given, a chorale's) the inner voices keep the grammar
{
  const { fourParts, PHRASES: FP } = await import("../studies/62-four/kairotic/four.mjs");
  const noF = { extends: "chorale-4", between: [["functions", false]] }, diff = [];
  for (const id of Object.keys(FP)) { const Q = fourParts({ phrase: id }); const a = R.fourOverBass({ ...Q.spec, bass: Q.bass, key: Q.key }).count(), b = R.fourOverBass({ ...Q.spec, bass: Q.bass, key: Q.key, style: noF }).count(); if (a !== b) diff.push(`${id} ${a} ≠ ${b}`); }
  is(`functions (chorale-4 ${R.STYLES["chorale-4"].version}): Study 62's phrases keep the grammar — the same counts without the rule`, R.STYLES["chorale-4"].version === "1.4.0" && diff.length === 0, diff.join("; "));
  const F = await import("../packages/rules/assets/functions.mjs");
  // Aus meines Herzens Grunde (BWV 269, chorale 1), the first phrase: Bach's soprano and bass, the inner voices found
  const S = [67, 67, 67, 74, 71, 71, 67, 67, 67, 71, 69], B = [43, 55, 52, 54, 55, 50, 52, 48, 47, 43, 50], len = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2];
  const notes = (xs) => { let t = 0; return xs.map((m, i) => { const o = { midi: m, units: len[i], strong: Array.from({ length: len[i] }, (_, k) => (t + k - 1) % 3 === 0) }; t += len[i]; return o; }); };
  // (bach-4's functions a cost since 1.3.0: here a refusal again, local, so every draw keeps them)
  const hard = { extends: "bach-4", between: [["functions", { local: true, passing: true }]], softBetween: [["functions", false]] };
  const ob = R.fromOuter({ bass: notes(B), soprano: notes(S), key: "G", style: hard }), free = R.fromOuter({ bass: notes(B), soprano: notes(S), key: "G", style: { extends: "bach-4", between: [["functions", false]] } });
  const c1 = ob.count(), c0 = free.count(), r = rng(269);
  const Bu = B.flatMap((m, i) => Array(len[i]).fill(m));
  let kept = 0, given = 0;
  for (let i = 0; i < 20; i++) {
    const W = ob.sample(r);
    if (W.soprano.every((c, t) => ob.midi(c) === S.flatMap((m, j) => Array(len[j]).fill(m))[t])) given++;
    // (the grammar on the strong units, the level the rule reads)
    const fs = Bu.map((b, t) => F.functionOf([b, ...["soprano", "alto", "tenor"].map((v) => ob.midi(W[v][t]))], { tonic: "G" })).filter((f, t) => (t - 1) % 3 === 0);
    if (!F.grammarErrors(fs, { end: false, key: { tonic: "G" } }).length) kept++;
  }
  is(`fromOuter: BWV 269's first phrase, its soprano and bass given — the inner voices found (${c1} realizations; ${c0} without the functions), the soprano Bach's and the grammar kept from strong unit to strong unit in every one drawn (20)`,
     c1 > 0n && c1 < c0 && given === 20 && kept === 20);
  // (the alto and the tenor given at the ends — a bridge from Bach's first chord to his last —: kept there in every draw,
  // free between; and bach-motion, Bach's own moves weighed)
  const AuE = [62, null, null, null, null, null, null, null, null, null, 66], TuE = [59, null, null, null, null, null, null, null, null, null, 62];
  const obE = R.fromOuter({ bass: notes(B), soprano: notes(S), key: "G", inner: { alto: AuE.flatMap((m, i) => Array(len[i]).fill(m)), tenor: TuE.flatMap((m, i) => Array(len[i]).fill(m)) } });
  const rE = rng(270), drawsE = Array.from({ length: 10 }, () => obE.sample(rE));
  is(`fromOuter's inner: BWV 269's first phrase with Bach's first and last chords given whole — ${obE.count()} realizations, each with his alto and tenor there`,
     obE.count() > 0n && drawsE.every((W) => W && obE.midi(W.alto[0]) === 62 && obE.midi(W.tenor[0]) === 59 && obE.midi(W.alto[11]) === 66 && obE.midi(W.tenor[11]) === 62));
  // (a voice exchange costs less: the alto C→E against the bass E→C over a C chord kept)
  {
    const VX = R.fourOverBass({ key: { tonic: "C" }, bass: [{ d: 2, r: 0, struck: true, strong: true }, { d: 0, r: 0, struck: true, strong: false }], style: "bach-4" });
    is("voice-exchange (bach-4): a soft rule between the voices, rewarded (a negative cost) where an inner voice trades its note with another",
       R.SOFT_BETWEEN["voice-exchange"] && JSON.stringify(R.resolveStyle("bach-4").softBetween).includes("voice-exchange") && R.resolveStyle("bach-4").weights["voice-exchange"] === 4 && VX.count() > 0n);
  }
  is(`bach-motion (bach-4 ${R.STYLES["bach-4"].version}): a move costs as rarely as Bach's alto and tenor make it — the note kept 0, a whole step 0.3, a tritone 4.36, a 5th 2.48`,
     R.BACH_INNER_MOTION[0] === 0 && R.BACH_INNER_MOTION[2] === 0.3 && R.BACH_INNER_MOTION[6] === 4.36 && R.BACH_INNER_MOTION[7] === 2.48 && JSON.stringify(R.resolveStyle("bach-4").voice).includes("bach-motion"));
  // (bach-4: neighbours may meet on one note — Bach's tenor on the bass's G at the 5th unit — and Bach's own inner voices
  // are by its rules; chorale-4 does not let them)
  const Su = S.flatMap((m, j) => Array(len[j]).fill(m)), Au = [62, 62, 64, 62, 62, 62, 59, 64, 64, 67, 66, 66], Tu = [59, 59, 60, 57, 55, 54, 55, 60, 60, 62, 62, 62];
  const bachW = { soprano: Su.map(ob.code), alto: Au.map(ob.code), tenor: Tu.map(ob.code) };
  const strict = R.fromOuter({ bass: notes(B), soprano: notes(S), key: "G", style: "chorale-4" });
  is(`... Bach's own alto and tenor there are by bach-4's rules; chorale-4 refuses the tenor's unison with the bass (${strict.judge(bachW)})`,
     ob.judge(bachW) === null && /unison with the bass/.test(strict.judge(bachW) || ""));
}

const failed = results.filter((r) => !r[1]);
console.log(`${results.length - failed.length} / ${results.length} passed`);
for (const [w, ok, d] of results) if (!ok) console.log("  FAIL " + w + (d ? " — " + d : ""));
for (const s of notes) console.log("  · " + s);
process.exit(failed.length ? 1 : 0);
