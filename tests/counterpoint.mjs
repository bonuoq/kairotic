// SPDX-License-Identifier: MPL-2.0
// @kairotic/cac · counterpoint.mjs, what the comes box plays with (discussion #172): its kernel is Study 43's,
// a note asked for is corrected to the nearest legal one with a future, and a canon played note by note always
// finishes. In Node:  node tests/counterpoint.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { live, semis, pitchName, PENTATONIC } from "../packages/cac/assets/counterpoint.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [], notes = [];
const is = (what, ok, detail) => results.push([what, !!ok, detail]);

// the kernel is Study 43's, as it is
const body = (f, from) => { const s = readFileSync(join(root, f), "utf8"); const i = s.indexOf(from); return s.slice(i, s.indexOf("\n// ─────", i + 1) < 0 ? undefined : s.indexOf("\n// ─────", i + 1)); };
const ours = body("packages/cac/assets/counterpoint.mjs", "const mod = ");
const study = readFileSync(join(root, "studies/43-mirrors/kairotic/kernel.mjs"), "utf8");
is("the kernel is Study 43's, as it is", study.slice(study.indexOf("const mod = ")).trim() === ours.trim());

// a strict canon in D dorian, the comes an octave below three beats later, 8 bars of 2/2
const L = live();
let t0 = performance.now();
const all = await L.warm();
notes.push(`dorian, k -7, d 3, 2/2, 8 bars: ${all} canons (${Math.round(performance.now() - t0)} ms)`);
is("the canons of Study 41's default, with ties, counted (707134)", all === 707134, all);
is("15 notes", L.n === 15);
is("the futuribles' futures add up to the point's", L.futuribles([], []).reduce((a, f) => a + f.futures, 0) === all);

// the first note: D4 is legal, C♯4 is corrected to a neighbour, and C4 (not a starting note) too
const D4 = semis(1);
let r = L.play([], [], D4);
is("D4 to begin: as played", r.note === 1 && !r.corrected && r.reason === null);
r = L.play([], [], 1);   // C♯4
is("C♯4: not a note of the mode, corrected to a white key a semitone away", r.corrected && /not a note of the system/.test(r.reason) && Math.abs(semis(r.note) - 1) === 1, r.reason);
r = L.play([], [], 0);   // C4
is("C4: the dux starts on the final, its 5th, its octave or the 4th below", r.corrected && /starts on the final/.test(r.reason) && r.note === 1, r.reason);
r = L.play([], [], D4 - 24);   // D2: taken up by octaves
is("D2: out of the range, taken by octaves to D4", r.note === 1 && r.corrected, r.reason);
is("before the comes enters, no comes", r.comes === null);

// a canon played from any keys, one per beat: it is always finished, every pair legal
const K = L.kernel;
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
let finished = 0, corrected = 0, played = 0, legal = true, ends = true;
for (let run = 0; run < 60; run++) {
  const D = [], C = [];
  while (D.length < L.n) {
    const asked = Math.round(rand() * 20) - 2;   // any key from A♯3 to G5
    const p = L.play(D, C, asked);
    if (!p) break;
    if (K.checkDux(D, C, p.note) !== null || K.checkPair(D, C, p.note, p.comes) !== null) legal = false;
    if (!(p.futures > 0)) legal = false;
    played++; if (p.corrected) corrected++;
    D.push(p.note); C.push(p.comes);
  }
  if (D.length === L.n) finished++;
  const t = D.length - 1;
  if (!(K.finals.includes(D[t]) && C[t] !== null)) ends = false;
}
notes.push(`60 canons from random keys: ${corrected} of ${played} notes corrected`);
is("a canon played from any keys is always finished", finished === 60, finished);
is("every pair placed is legal and has a future", legal);
is("and ends on the final with the comes", ends);
is("random keys are often corrected (most are not legal)", corrected > played / 4);

// the comes of a strict canon is the dux's note, d beats before, k steps away
{
  const D = [], C = [];
  for (const a of [2, 4, 5, 7, 5, 4, 2, 9]) { const p = L.play(D, C, a); D.push(p.note); C.push(p.comes); }
  is("a strict canon: the comes is the dux 3 beats before, an octave below", C.every((c, t) => (t < 3 ? c === null : c === D[t - 3] - 7)));
  const nearest = L.play(D, C, semis(D[D.length - 1]) + 3);
  is("a correction is to the nearest legal note", nearest.fan.filter((f) => f.futures > 0).every((f) =>
    Math.abs(semis(f.note) - (semis(D[D.length - 1]) + 3)) >= Math.abs(semis(nearest.note) - (semis(D[D.length - 1]) + 3))));
  notes.push("dux " + D.map(pitchName).join(" ") + " · comes " + C.map((c) => (c === null ? "–" : pitchName(c))).join(" "));
  const ob = L.obligations(D, C);
  is("the obligations name the comes's next note", ob.some((s) => /a canon: the comes sounds/.test(s)), ob.join("; "));
}

// the engine finishes a canon alone
{
  const D = [], C = [];
  for (;;) { const p = L.engine(D, C); if (!p) break; D.push(p.note); C.push(p.comes); }
  is("the engine finishes a canon alone", D.length === L.n);
  notes.push("by the engine: " + D.map(pitchName).join(" "));
}

// less imitation: the comes is chosen, near the dux's note; an upbeat; 3/2 in a plagal mode
{
  const N = live({ imitation: 0.8 });
  t0 = performance.now();
  const c = await N.warm();
  notes.push(`imitation 0.8: ${c} pairs of voices (${Math.round(performance.now() - t0)} ms)`);
  const D = [], C = [];
  for (const a of [2, 4, 5, 7, 9, 7, 5]) { const p = N.play(D, C, a); D.push(p.note); C.push(p.comes); }
  is("imitation 0.8: the comes within a 3rd of the dux's note", C.every((x, t) => t < 3 || Math.abs(x - (D[t - 3] - 7)) <= 2));
  const U = live({ upbeat: 1 });
  await U.warm();
  is("an upbeat: one note fewer, the first on a weak beat", U.n === 14 && !U.strong(0) && U.strong(1));
  const H = live({ mode: "hypodorian", beats: 3, bars: 5 });
  is("3/2, hypodorian: canons", (await H.warm()) > 0 && H.lo === -3 && H.hi === 6);
}

// ties: hold keeps the note over the beat; in 3/2 a note may be held for the bar
{
  const T = live({ imitation: 1 });
  await T.warm();
  const D = [], C = [];
  let p = T.play(D, C, semis(1)); D.push(p.note); C.push(p.comes);
  p = T.hold(D, C);
  is("hold: the note held over the beat (a tie)", p.note === 1 && !p.corrected);
  D.push(p.note); C.push(p.comes);
  p = T.hold(D, C);
  is("not a third beat in 2/2: the nearest that can be played instead, and why", p.corrected && /cannot be held/.test(p.reason), p.reason);
  const H = live({ beats: 3, bars: 5, maxHold: 3, imitation: 1 });
  is("in 3/2, held for the whole bar", (await H.warm()) > 0 && H.hold([1, 1], [null, null]).note === 1 && !H.hold([1, 1], [null, null]).corrected);
  // fourth species: the dux a cantus firmus, the comes syncopated
  const F = live({ species: 4, d: 1, imitation: 0.8 });
  is("fourth species: works", (await F.warm()) > 0 && F.species === 4);
  const FD = [], FC = [];
  for (const a of [2, 2, 5, 5, 4, 4, 2, 2]) { const q = F.play(FD, FC, a); FD.push(q.note); FC.push(q.comes); }
  is("fourth species: the comes holds its note over the strong beats", FC.every((c, t) => t <= 1 || t % 2 === 1 || c === FC[t - 1]));
  const sus = FD.map((_, t) => t).filter((t) => F.kernel.suspensionAt(FD, FC, t));
  notes.push("fourth species, cantus firmus D F E D: comes " + FC.map((c) => (c === null ? "–" : pitchName(c))).join(" ") + " · suspensions at " + sus.join(","));
}

// inversion and augmentation of the comes, live
{
  const I = live({ transform: "inversion", axis: 62, k: 0, d: 3, bars: 6 });
  is("inversion about D4 (62): the axis is D4", (await I.warm()) > 0 && I.axis === 1);
  const D = [], C = [];
  for (const a of [2, 4, 5, 7, 5, 4]) { const p = I.play(D, C, a); D.push(p.note); C.push(p.comes); }
  is("... the comes is the dux upside down about D, 3 beats later", C.every((c, t) => (t < 3 ? c === null : c === 2 - D[t - 3])));
  const A = live({ transform: "augmentation", k: -7, d: 2, bars: 8, imitation: 0.5 });
  is("augmentation: a strict canon, six bars at most", A.n === 11 && A.spec.imitation === 1 && (await A.warm()) > 0);
  const AD = [], AC = [];
  for (const a of [2, 4, 5, 7, 9, 7]) { const p = A.play(AD, AC, a); AD.push(p.note); AC.push(p.comes); }
  is("... the comes holds each note of the dux for two beats", AC.every((c, t) => (t < 2 ? c === null : c === AD[Math.floor((t - 2) / 2)] - 7)));
}

// chance: at temperature 0 the comes the futuribles say; with a temperature, drawn — the same r, the same choice
{
  const N = live({ imitation: 0.5 });
  await N.warm();
  const D = [], C = [];
  for (const a of [2, 4, 5, 7]) { const p = N.play(D, C, a); D.push(p.note); C.push(p.comes); }
  const f = N.futuribles(D, C)[0];
  is("temperature 0: the comes the futuribles say", N.play(D, C, semis(f.note)).comes === f.comes && N.play(D, C, semis(f.note), { temp: 0, r: 0.7 }).comes === f.comes);
  const drawn = [0.05, 0.25, 0.45, 0.65, 0.85, 0.99].map((r) => N.play(D, C, semis(f.note), { temp: 3, r }).comes);
  is("a temperature: the comes drawn among the candidates (the same r, the same comes)", new Set(drawn).size > 1 &&
    N.play(D, C, semis(f.note), { temp: 3, r: 0.45 }).comes === drawn[2]);
  const eng = [0.05, 0.5, 0.95].map((r) => N.engine(D, C, { temp: 5, r, r2: 0.5 }).note);
  is("engine with a temperature: the dux drawn among the futuribles", new Set(eng).size > 1 && N.engine(D, C).note === f.note);
}

// systems (Study 42) in the box: a key of SYSTEMS or the data itself; their modes, distances and tuning
{
  const P = live({ system: "pentatonic", bars: 6 });
  const c = await P.warm();
  notes.push(`pentatonic, ${P.mode}, k ${P.k}: ${c} canons; modes ${P.modes.join(" ")}`);
  is("pentatonic: its modes, an octave below is 5 steps", P.mode === "penta-C" && P.k === -5 && P.N === 5 && c > 0);
  let r = P.play([], [], 5);   // F4: not a note of the pentatonic
  is("pentatonic: F4 is not a note of it, corrected", r.corrected && /not a note of the system/.test(r.reason) && [4, 7].includes(P.midi(r.note) - 60), r.reason);
  r = P.play([], [], 0);
  is("pentatonic: C4 as played", !r.corrected && P.name(r.note) === "C4");
  const D = [], C = [];
  for (;;) { const p = P.engine(D, C); if (!p) break; D.push(p.note); C.push(p.comes); }
  is("pentatonic: the engine finishes a canon, every note a note of the scale",
     D.length === P.n && D.every((x) => [0, 2, 4, 7, 9].includes(((Math.round(P.midi(x)) % 12) + 12) % 12)));
  notes.push("pentatonic by the engine: " + D.map(P.name).join(" "));
  const Q = live({ system: { ...PENTATONIC, modes: { "penta-A": PENTATONIC.modes["penta-A"] } }, bars: 5 });
  is("a system as data (as EDN brings it): its only mode", Q.mode === "penta-A" && Q.name(Q.tonic) === "A4" && (await Q.warm()) > 0);
  const S7 = live({ system: "septimal31", bars: 5 });
  const s7 = await S7.warm();
  notes.push(`septimal31, ${S7.mode}: ${s7} canons`);
  const bflat = S7.midi(6);
  is("septimal31: B♭⁷ a harmonic seventh above C (a fraction of MIDI)", Math.abs(bflat - (60 + 9.677)) < 0.01 && s7 > 0, bflat);
  r = S7.play([], [], 0);
  is("septimal31: a key of 12 is taken as the nearest note of 31", !r.corrected && r.note === 0);
  const M = live({ system: "meantone", mode: "aeolian" });
  is("meantone: the diatonic modes, tuned (E4 a pure third above C4)", M.mode === "aeolian" && Math.abs(M.midi(2) - 63.863) < 0.01);
}

// a box's words name the system and a mode of it in any order; a mode the system does not have is said
{
  const A = live({ mode: "pentatonic", system: "penta-A" }), B = live({ mode: "penta-A", system: "pentatonic" });
  is("the words in any order: a system (pentatonic) and its mode (penta-A)", A.mode === "penta-A" && B.mode === "penta-A" && A.systemName === "pentatonic" && A.N === 5 && !A.modeNote);
  const C = live({ mode: "dorian", system: "pentatonic" });
  is("dorian is not a mode of the pentatonic: its first mode, and why", C.mode === "penta-C" && /dorian is not a mode of pentatonic/.test(C.modeNote), C.modeNote);
  is("a mode alone: of the diatonic system", live({ mode: "aeolian" }).systemName === "diatonic" && live({ mode: "aeolian" }).mode === "aeolian");
}

// the comes box's kernel backwards (speed −1): Study 43's mirror, as it is, on this module
{
  const ours = readFileSync(join(root, "packages/cac/assets/mirror.mjs"), "utf8");
  const theirs = readFileSync(join(root, "studies/43-mirrors/kairotic/mirror.mjs"), "utf8");
  const code = (s) => s.slice(s.indexOf("export const KINDS")).replace(/\n\/\/ api\/import-module[\s\S]*$/, "").trim();
  is("mirror.mjs is Study 43's mirror, as it is", code(ours) === code(theirs));
  const { mirror } = await import("../packages/cac/assets/mirror.mjs");
  const crab = mirror({ tonic: 1, lo: 0, hi: 9, spacing: 11, starts: [1, 5, 8], b: 2, n: 11, transform: { kind: "crab", k: -7 } });
  is("a crab an octave below, 11 beats: 6959, as in Study 43", crab.count() === 6959);
}

// Study 46 plays on Study 43's kernels, as they are
for (const f of ["kernel.mjs", "mirror.mjs"])
  is(`Study 46's ${f} is Study 43's`, readFileSync(join(root, "studies/46-crab-live/kairotic", f), "utf8") === readFileSync(join(root, "studies/43-mirrors/kairotic", f), "utf8"));

// soft.mjs: the one way every engine weighs (the comes box, the studies' engines, the agents)
{
  const soft = await import("../packages/cac/assets/soft.mjs");
  const { WEIGHTS } = await import("../packages/cac/assets/counterpoint.mjs");
  is("the comes box's weights are soft.mjs's", JSON.stringify(WEIGHTS) === JSON.stringify(soft.defaultWeights()));
  is("every soft rule documented, with its scope and weight", soft.SOFT.every((r) => r.id && r.scope && typeof r.weight === "number" && r.doc));
  // the studies weigh alike: their copies (Studies 50, 51) give the same costs on the same lines
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646, r = rng(7);
  const ctx = { N: 7, strong: (t) => t % 2 === 0, lowerFirst: (x, c) => (x <= c ? [x, c] : [c, x]), dissonant: (x, c) => [1, 3, 6].includes(((Math.abs(x - c) % 7) + 7) % 7),
                quality: (l, h) => { const k = (((h - l) % 7) + 7) % 7; return k === 0 || k === 4 ? "perfect" : k === 2 || k === 5 ? "imperfect" : "dissonant"; }, suspension: false };
  for (const study of ["50-lines", "51-schemata", "54-parts", "56-figuring", "57-octave", "58-incipit", "59-galant", "60-development", "61-reduction", "62-four"]) {
    const theirs = await import(`../studies/${study}/kairotic/soft.mjs`);
    let same = true;
    for (let k = 0; k < 400 && same; k++) {
      const len = 2 + Math.floor(r() * 10), D = [], C = [];
      for (let i = 0; i < len; i++) { D.push(Math.floor(r() * 9) - 2); C.push(Math.floor(r() * 9) + 5); }
      const x = Math.floor(r() * 9) - 2, c = Math.floor(r() * 9) + 5;
      same = JSON.stringify(soft.melodicParts(D, x)) === JSON.stringify(theirs.melodicParts(D, x))
          && JSON.stringify(soft.verticalParts(D, C, x, c, ctx)) === JSON.stringify(theirs.verticalParts(D, C, x, c, ctx));
    }
    is(`Study ${study.slice(0, 2)}'s soft rules weigh as soft.mjs (400 random lines)`, same);
  }
}

// partimento.mjs: the hard rules over a bass (Studies 51 and 54), shared; the studies publish copies of it
{
  const P = await import("../packages/cac/assets/partimento.mjs");
  for (const st of ["51-schemata", "54-parts", "56-figuring", "57-octave", "58-incipit", "59-galant", "60-development", "61-reduction", "62-four"]) {
    const same = readFileSync(join(root, `studies/${st}/kairotic/partimento.mjs`), "utf8") === readFileSync(join(root, "packages/cac/assets/partimento.mjs"), "utf8");
    is(`Study ${st.slice(0, 2)}'s partimento.mjs is the package's, as it is`, same);
  }
  is("Study 58's figuring.mjs is Study 56's, as it is", readFileSync(join(root, "studies/58-incipit/kairotic/figuring.mjs"), "utf8") === readFileSync(join(root, "studies/56-figuring/kairotic/figuring.mjs"), "utf8"));
  is("Study 60's figuring.mjs and incipit.mjs are Studies 56's and 58's, as they are", ["56-figuring/kairotic/figuring.mjs", "58-incipit/kairotic/incipit.mjs"].every((f) => readFileSync(join(root, "studies/60-development/kairotic/" + f.split("/").pop()), "utf8") === readFileSync(join(root, "studies/" + f), "utf8")));
  is("Study 61's figuring.mjs and incipit.mjs are Studies 56's and 58's, as they are", ["56-figuring/kairotic/figuring.mjs", "58-incipit/kairotic/incipit.mjs"].every((f) => readFileSync(join(root, "studies/61-reduction/kairotic/" + f.split("/").pop()), "utf8") === readFileSync(join(root, "studies/" + f), "utf8")));
  // structural voice leading (Study 61, #321): parallels hidden by the diminution are refused; a consonant leap between
  // the strong units breaks them (as the treatises allow); a skip inside the chord is compound melody, its leap cheaper
  {
    const B0 = [[0, true], [0, false], [2, true], [2, false], [3, true]].map(([d, struck]) => ({ d, r: 0, struck, fig: null }));
    const mk = (extra = {}) => P.schemata({ schema: { events: [] }, bass: B0, key: P.keyOf({ tonic: "C" }), figured: false, lo: 7, hi: 21, end: false, ...extra });
    const S = mk(), c = (nm) => S.code(nm);
    is("structural parallels: C5 D5 | E5 over C3 – E3, octaves under a passing tone, refused", /parallel octaves from the strong unit before, under the diminution/.test(S.check([c("C5"), c("D5")], 2, c("E5")) || ""));
    is("… a consonant leap between them breaks them (not refused for that)", !/under the diminution/.test(S.check([c("C5"), c("A4")], 2, c("E5")) || ""));
    is("… with structural: false allowed, and then only a soft cost", mk({ structural: false }).check([c("C5"), c("D5")], 2, c("E5")) === null && mk({ structural: false }).costParts([c("C5"), c("D5")], c("E5"))["structural-parallels"] > 0);
    is("compound melody: C5 to G4 over a held C3 is a skip inside the chord, its leap cheaper", S.costParts([c("C5")], c("G4"))["chord-skip"] < 0);
  }

  // two parts: the book's 7–6 prototype is its one realization; in minor the chord on a dominant is major
  const S = P.schemata({ schema: "7-6", key: { tonic: "C" } });
  const U = P.PROTOTYPES["7-6"].upper.map(S.code);
  is("partimento, two parts: the book's 7–6 is the one realization of its figures", !S.judge(U) && S.count() === 1n);
  const M = P.schemata({ schema: "7-3", key: { tonic: "A", mode: "minor" } }), um = P.PROTOTYPES["7-3"].upper.map(M.code);
  is("... in minor, over a dominant ⑤ the natural ⑦ is refused (G♯, not G)", /dominant is major/.test(M.check(um.slice(0, 8), 8, M.code("G4")) || ""));
  // three parts: the doublings, and a 7th put off by one chord
  const T = P.parts({ schema: "fauxbourdon", cadence: "simple", key: { tonic: "C" } });
  is("partimento, three parts: the 3rd of a chord doubled is refused", /3rd of the chord doubled/.test(T.check([], [], 0, T.code("E5"), T.code("E4")) || ""));
  is("... the Fifth Down Fourth Up closes with a compound cadence (the 7th of ② held into the 6/4)", P.parts({ schema: "fifths-73", cadence: "compound-64", key: { tonic: "C" } }).count() === 8n);
}

const bad = results.filter((x) => !x[1]);
console.log(`${results.length - bad.length} / ${results.length} passed`);
for (const [w, ok, d] of results) if (!ok) console.log("  FAIL " + w + (d !== undefined ? " · " + d : ""));
for (const s of notes) console.log("  · " + s);
process.exit(bad.length ? 1 : 0);
