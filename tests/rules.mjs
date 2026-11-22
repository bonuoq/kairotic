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

const failed = results.filter((r) => !r[1]);
console.log(`${results.length - failed.length} / ${results.length} passed`);
for (const [w, ok, d] of results) if (!ok) console.log("  FAIL " + w + (d ? " — " + d : ""));
for (const s of notes) console.log("  · " + s);
process.exit(failed.length ? 1 : 0);
