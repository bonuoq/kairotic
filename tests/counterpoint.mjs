// SPDX-License-Identifier: MPL-2.0
// @kairotic/theory · counterpoint.mjs, what the comes box plays with (discussion #172): its kernel is Study 40's,
// a note asked for is corrected to the nearest legal one with a future, and a canon played note by note always
// finishes. In Node:  node tests/counterpoint.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { live, semis, pitchName } from "../packages/theory/assets/counterpoint.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [], notes = [];
const is = (what, ok, detail) => results.push([what, !!ok, detail]);

// the kernel is Study 40's, as it is
const body = (f, from) => { const s = readFileSync(join(root, f), "utf8"); const i = s.indexOf(from); return s.slice(i, s.indexOf("\n// ─────", i + 1) < 0 ? undefined : s.indexOf("\n// ─────", i + 1)); };
const ours = body("packages/theory/assets/counterpoint.mjs", "const SCALE");
const study = readFileSync(join(root, "studies/40-imitation/kairotic/kernel.mjs"), "utf8");
is("the kernel is Study 40's, as it is", study.slice(study.indexOf("const SCALE")).trim() === ours.trim());

// a strict canon in D dorian, the comes an octave below three beats later, 8 bars of 2/2
const L = live();
let t0 = performance.now();
const all = await L.warm();
notes.push(`dorian, k -7, d 3, 2/2, 8 bars: ${all} canons (${Math.round(performance.now() - t0)} ms)`);
is("the canons of Study 39's default, counted (442780)", all === 442780, all);
is("15 notes", L.n === 15);
is("the futuribles' futures add up to the point's", L.futuribles([], []).reduce((a, f) => a + f.futures, 0) === all);

// the first note: D4 is legal, C♯4 is corrected to a neighbour, and C4 (not a starting note) too
const D4 = semis(1);
let r = L.play([], [], D4);
is("D4 to begin: as played", r.note === 1 && !r.corrected && r.reason === null);
r = L.play([], [], 1);   // C♯4
is("C♯4: not a note of the mode, corrected to a white key a semitone away", r.corrected && /not a note of the mode/.test(r.reason) && Math.abs(semis(r.note) - 1) === 1, r.reason);
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

const bad = results.filter((x) => !x[1]);
console.log(`${results.length - bad.length} / ${results.length} passed`);
for (const [w, ok, d] of results) if (!ok) console.log("  FAIL " + w + (d !== undefined ? " · " + d : ""));
for (const s of notes) console.log("  · " + s);
process.exit(bad.length ? 1 : 0);
