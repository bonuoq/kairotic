// SPDX-License-Identifier: MPL-2.0
// The chorales' corpus (studies/_shared/chorales/phrases.json): whole, in the engine's format, and Bach by bach-4.
//   node tests/chorales.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as R from "../packages/rules/assets/rules.mjs";
import * as Co from "../packages/rules/assets/continuo.mjs";
import { count } from "../studies/_shared/chorales/tools/continuo.mjs";

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
is(`... bach-4 ${R.STYLES["bach-4"].version} keeps 504 of them (its soft rules — his own moves among them — weigh, they do not refuse), each note as Bach spelt it, the functions read in his local keys a cost (1.2.0: 494, the functions a refusal in the chorale's key; 486 spelt from its MIDI in its key; 1.1.0: 426, 234 in the chorale's key; 1.0.0: 112) — Bach's ranges, his passing and neighbour notes over a moving bass, a note held into a dissonance, direct 5ths and octaves free in the inner voices, his 7ths held into a consonance, rising as the bass takes their note's resolution, passed into the bass`,
   R.STYLES["bach-4"].version === "1.8.0" && kept === 504, String(kept));

// Bach's own figures (figures.json, from the BCFB dataset) and the continuo tables (Study 76)
const FB = JSON.parse(readFileSync(join(here, "../studies/_shared/chorales/figures.json"), "utf8"));
const byId = Object.fromEntries(P.map((p) => [p.id, p]));
is(`Bach's figures: ${FB.matched.phrases} phrases of ${FB.matched.chorales} chorales matched, their source and license with them`,
   FB.matched.phrases === 562 && FB.matched.chorales === 93 && /Bach Chorales Figured Bass/.test(FB.source) && /CC BY 4\.0/.test(FB.license) &&
   Object.entries(FB.phrases).every(([id, f]) => byId[id] && f.figures.length === byId[id].satb.length));
const p3 = FB.phrases["chor003-1"];
is("... Ach Gott, wie manches Herzeleid (BWV 153/1), the first phrase: ♯ / 6 (raised) / 6/4/3 / 6/5 / ♯ as Bach wrote them",
   p3 && String(p3.figures.map((q) => q.map((x) => x.f.join("/")).join(" "))) === "♯,,6\\,,6\\/4/3,6/5,,♯");
is("continuo.mjs reads a quarter: its intervals over the bass, its chord, Bach's figure in the key signature",
   String(Co.intervalsOver(["G4", "D4", "B3", "G2"])) === "3,5" && Co.chordOf(["G4", "E4", "C4", "E3"]) === "6/3" &&
   Co.chordOf(["C5", "F4", "A3", "D3"]) === "7" && Co.chordOf(["C5", "G4", "E4", "D3"]) === "x:247" &&
   String(Co.figureOf(["D5", "F#4", "A3", "D3"], { tonic: "G" })) === "" && String(Co.figureOf(["D5", "F#4", "A3", "D3"], { tonic: "C" })) === "♯" &&
   String(Co.figureOf(["C5", "F#4", "A3", "D3"], { tonic: "C" })) === "7,♯" && String(Co.figureOf(["F4", "D4", "A3", "D3"], { tonic: "C" }, ["F4", "D4", "B3", "D3"])) === "5" &&
   String(Co.signature({ tonic: "D", mode: "minor", church: "dorian" })) === "0,0,0,0,0,0,0" && String(Co.signature({ tonic: "G", mode: "minor" })) === "0,0,-1,0,0,0,-1");
const restate = (a) => { const n = a.map((x) => x.replace(/[♯♭♮𝄪𝄫]/g, "")), core = n.filter((x) => x && !["5", "3", "8"].includes(x));
  return core.length === 0 || (core.length === 1 && core[0] === "7") ? a.filter((x, i) => !["5", "8"].includes(n[i])).map((x) => x === "3" ? "" : x.replace(/^([♯♭♮])3$/, "$1")).filter(Boolean).join("/") : a.join("/"); };
let fq = 0, fsame = 0;
for (const [id, f] of Object.entries(FB.phrases)) { const p = byId[id];
  for (let q = 0; q < p.satb.length; q++) { if ((f.differs || []).includes(q) || p.held[q][3]) continue;
    const at0 = f.figures[q].find((x) => x.at === 0);
    fq++; if (restate(Co.normalFigure(at0 ? at0.f : [])) === restate(Co.figureOf(p.names[q], p.key, q ? p.names[q - 1] : null))) fsame++; } }
is(`... figureOf writes ${(100 * fsame / fq).toFixed(1)}% of Bach's figures over a struck bass as he did (${fq} quarters; a 5, 3 or 8 he restates over a 5/3 aside) — the rest, mostly what he left unfigured`,
   fsame / fq > 0.84, `${fsame}/${fq}`);
const T = count(P).tables;
is("... the continuo tables, as tools/continuo.mjs counts them from the corpus (the chorales but every fifth)",
   JSON.stringify(T) === JSON.stringify({ BACH_OUTER_VERTICAL: Co.BACH_OUTER_VERTICAL, BACH_OUTER_PAIR: Co.BACH_OUTER_PAIR, BACH_DEGREE_CHORD: Co.BACH_DEGREE_CHORD, BACH_INNER_ROLES: Co.BACH_INNER_ROLES, BACH_DISSONANCES: Co.BACH_DISSONANCES, BACH_CADENCES: Co.BACH_CADENCES }));
const p9 = P.find((p) => p.id === "chor009-1");
const ds = P.map((p) => p.satb.map((_, t) => Co.dissonanceOf(p, t)).filter(Boolean)).flat(), byVoice = (v) => ds.filter((x) => x.voice === v).length;
is(`dissonanceOf: the ${ds.length} quarters that are no chord, each a chord and the one voice not of it — the alto's ${byVoice("alto")}, the tenor's ${byVoice("tenor")}, the soprano's ${byVoice("soprano")}, the bass's ${byVoice("bass")} (${byVoice(null)} no one voice explains); chor009-1's 6th quarter a 4–3 in the soprano over a 5/3`,
   JSON.stringify(Co.dissonanceOf(p9, 5)) === JSON.stringify({ voice: "soprano", motion: "suspension", interval: 4, chord: "5/3" }) && Co.dissonanceOf(p9, 0) === null &&
   byVoice(null) <= 5 && byVoice("soprano") < byVoice("tenor") && Co.BACH_DISSONANCES["alto|suspension|2|strong"] > 100);
// Study 76's step 2: Bach's soprano, his bass and his chords given to bach-4 — as orders, or as a wish (figuresWeight)
{
  const ENG = { "5/3": "5/3", "6/3": "6/3", "6/4": "6/4", "7": "7", "6/5": "6/5", "4/3": "6/4/3", "4/2": "4/2" };
  const kn = (k) => k.replace("♯", "#").replace("♭", "b");
  const notesOf = (p, v, fig) => { const out = []; p.satb.forEach((c, t) => { if (t && p.held[t][v] && out.length) { const o = out.at(-1); o.units++; o.strong.push(!!p.strong[t]); return; }
    const f = fig ? ENG[Co.chordOf(p.names[t])] : undefined; out.push({ midi: c[v], name: p.names[t][v], units: 1, strong: [!!p.strong[t]], key: kn(p.keys[t]), ...(f ? { fig: f } : {}) }); }); return out; };
  const p = P.find((x) => x.id === "chor003-1"), spec = { bass: notesOf(p, 3, true), soprano: notesOf(p, 0, false), key: kn(`${p.key.tonic} ${p.key.mode}`) };
  const hard = R.fromOuter(spec), soft = R.fromOuter({ ...spec, figuresWeight: 8 }), W = soft.count() > 0n ? soft.engine({ temp: 0 }) : null;
  const pcs = (xs, b) => [...new Set(xs.map((m) => (((m - b) % 12) + 12) % 12))].sort((a, c) => a - c).join();
  const same = W ? p.satb.filter((c, t) => pcs([c[0], soft.midi(W.alto[t]), soft.midi(W.tenor[t]), c[3]], c[3]) === pcs(c, c[3])).length : 0;
  is(`fromOuter's figuresWeight: Ach Gott, wie manches Herzeleid's first phrase with Bach's chords as orders has no realization by bach-4; as a wish (weight 8) it has, its likeliest making ${same} of his 8 chords`,
     hard.count() === 0n && soft.count() > 0n && same >= 6, String(same));
}
is("roleCost: over a 6/5 rising to its 5/3 by step, an inner voice on the 5th (the 7th of the chord) goes to the 3rd, not kept; bach-4 1.7.0 weighs its inner voices so (bach-roles, 2)",
   Co.roleCost("6/5", "5/3", "+1", 4, 2) < 0.1 && Co.roleCost("6/5", "5/3", "+1", 4, 4) > 4 && Object.keys(Co.BACH_INNER_ROLES.fine).length > 500 &&
   JSON.stringify(R.resolveStyle("bach-4").softBetween).includes("bach-roles") && R.resolveStyle("bach-4").weights["bach-roles"] === 2);
const dc = Co.BACH_DEGREE_CHORD, argmin = (a) => a.indexOf(Math.min(...a));
is("... what they say: the 5th and the 3rd the soprano's commonest over the bass, contrary motion the commonest pair, a 5/3 on ① and ⑤ and a 6/3 on ⑦, ⑤–① the commonest cadence; each a plain −log (a row's probabilities add up to 1)",
   argmin(Co.BACH_OUTER_VERTICAL) === 7 && Co.BACH_OUTER_PAIR[1 * 5 + 3] - Math.min(...Co.BACH_OUTER_PAIR) < 0.5 && argmin(dc.major.chord[0]) === 0 && argmin(dc.major.chord[7]) === 0 &&
   argmin(dc.major.chord[11]) === 1 && dc.major.chords[1] === "6/3" && Co.BACH_CADENCES.major[0][0] === "7:5/3 0:5/3" && Co.BACH_CADENCES.minor[0][0] === "7:5/3 0:5/3" &&
   Math.abs(Co.BACH_OUTER_VERTICAL.reduce((a, c) => a + Math.exp(-c), 0) - 1) < 0.01 && dc.major.chord.every((r) => Math.abs(r.reduce((a, c) => a + Math.exp(-c), 0) - 1) < 0.01));

const bad = results.filter((r) => !r[1]);
console.log(`${results.length - bad.length} / ${results.length} passed`);
for (const [w, ok, why] of results) if (!ok) console.log("  FAIL " + w + (why ? ` — ${why}` : ""));
for (const s of notes) console.log("  · " + s);
process.exit(bad.length);
