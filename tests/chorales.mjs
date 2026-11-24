// SPDX-License-Identifier: MPL-2.0
// The chorales' corpus (studies/_shared/chorales/phrases.json): whole, in the engine's format, and Bach by bach-4.
//   node tests/chorales.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as R from "../packages/rules/assets/rules.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const C = JSON.parse(readFileSync(join(here, "../studies/_shared/chorales/phrases.json"), "utf8"));
const results = [], notes = [];
const is = (what, ok, why = "") => results.push([what, !!ok, why]);
const P = C.phrases;

is(`the corpus: ${P.length} phrases from ${new Set(P.map((p) => p.chorale)).size} chorales, its source and license with it`,
   P.length === 2272 && new Set(P.map((p) => p.chorale)).size === 370 && /Sapp/.test(C.source) && /CC BY-NC-SA 4\.0/.test(C.license));
const shape = P.filter((p) => !(p.satb.length >= 2 && p.held.length === p.satb.length && p.strong.length === p.satb.length &&
  p.satb.every((c) => c.length === 4 && c.every(Number.isInteger)) &&
  p.names.length === p.satb.length && p.names.every((c, t) => c.length === 4 && c.every((x) => /^[A-G](#*|b*)-?\d$/.test(x))) && String(p.A) === String(p.satb[0]) && String(p.B) === String(p.satb.at(-1)) && p.key && p.key.tonic && /^(major|minor)$/.test(p.key.mode) &&
  ["soprano", "alto", "tenor", "bass"].every((v) => p.lines[v].length > 0)));
is(`every phrase in the engine's format (satb, held, strong, A and B its ends, a key, the lines)`, shape.length === 0, shape.slice(0, 5).map((p) => p.id).join(" "));
notes.push(`the voices cross in ${P.filter((p) => p.satb.some((c) => c[1] > c[0] || c[2] > c[1] || c[3] > c[2])).length} phrases (Bach's, on a quarter at least)`);
const changes = P.reduce((a, p) => a + p.keys.filter((k, t) => t && k !== p.keys[t - 1]).length, 0);
is(`the keys a phrase goes through, a quarter at a time (${(changes / P.length).toFixed(2)} changes of key a phrase; ${P.filter((p) => p.keys.at(-1) !== `${p.key.tonic} ${p.key.mode}`).length} phrases end in another key than the chorale's)`,
   P.every((p) => p.keys.length === p.satb.length && p.keys.every((k) => /^[A-G][♯♭]? (major|minor)$/.test(k))));
const p1 = P.find((p) => p.id === "chor001-1");
is("Aus meines Herzens Grunde (BWV 269), the first phrase: Bach's soprano and bass, a quarter at a time, in G, ending on D",
   p1 && p1.bwv === "BWV 269" && String(p1.satb.map((c) => c[0])) === "67,67,67,74,71,71,67,67,67,71,69" &&
   String(p1.satb.map((c) => c[3])) === "43,55,52,54,55,50,52,48,47,43,50" && String(p1.names.map((c) => c[3])) === "G2,G3,E3,F#3,G3,D3,E3,C3,B2,G2,D3" && p1.key.tonic === "G" && p1.cadence?.tonic === "D" && p1.keys.every((k) => k === "G major") &&
   String(p1.strong.map(Number)) === "0,1,0,0,1,0,0,1,0,0,1");

// Bach's own inner voices, judged by bach-4 (fromOuter, the soprano and the bass given, the bass's notes in the keys the
// phrase goes through): how many of his phrases its rules keep, and what the others break first
const notesOf = (p, v) => { const out = []; p.satb.forEach((c, t) => { if (t && p.held[t][v] && out.at(-1).midi === c[v]) { out.at(-1).units++; out.at(-1).strong.push(p.strong[t]); } else out.push({ midi: c[v], name: p.names[t][v], units: 1, strong: [p.strong[t]], ...(v === 3 && p.keys ? { key: p.keys[t] } : {}) }); }); return out; };
const judgeBach = (p, style = "bach-4") => {
  const ob = R.fromOuter({ bass: notesOf(p, 3), soprano: notesOf(p, 0), key: `${p.key.tonic.replace("♯", "#").replace("♭", "b")} ${p.key.mode}`, style });
  return ob.judge({ soprano: p.satb.map((c, t) => ob.code(p.names[t][0], t)), alto: p.satb.map((c, t) => ob.code(p.names[t][1], t)), tenor: p.satb.map((c, t) => ob.code(p.names[t][2], t)) });
};
is("... its alto and tenor by bach-4's rules (judged from the corpus)", judgeBach(p1) === null);
const why = {};
let kept = 0;
for (const p of P) { const j = judgeBach(p); if (j === null) kept++; else { const k = String(j).replace(/^unit \d+:\s*/, "").replace(/\d+/g, "#"); why[k] = (why[k] || 0) + 1; } }
notes.push(`bach-4 keeps ${kept} of Bach's ${P.length} phrases as he wrote them; the others break first — ` +
  Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} (${v})`).join(" · "));
// (pinned: a change of bach-4's rules changes it — say why, and pin it again)
is(`... bach-4 ${R.STYLES["bach-4"].version} keeps 504 of them, each note as Bach spelt it, the functions read in his local keys a cost (1.2.0: 494, the functions a refusal in the chorale's key; 486 spelt from its MIDI in its key; 1.1.0: 426, 234 in the chorale's key; 1.0.0: 112) — Bach's ranges, his passing and neighbour notes over a moving bass, a note held into a dissonance, direct 5ths and octaves free in the inner voices, his 7ths held into a consonance, rising as the bass takes their note's resolution, passed into the bass`,
   R.STYLES["bach-4"].version === "1.3.0" && kept === 504, String(kept));

const bad = results.filter((r) => !r[1]);
console.log(`${results.length - bad.length} / ${results.length} passed`);
for (const [w, ok, why] of results) if (!ok) console.log("  FAIL " + w + (why ? ` — ${why}` : ""));
for (const s of notes) console.log("  · " + s);
process.exit(bad.length);
