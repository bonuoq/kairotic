// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 56 · figuring: a bass without figures, a melody improvised over it, and the figures found as it
// goes — the partimento turned round. Not a schema realized (Studies 51, 54) but a bass given, played over, and
// understood while it is played: what chord each note of the melody makes with the bass, which schemata the two lines
// make, where a cadence can close the phrase, and a third voice written from the figures found.
//
//   the bass        note names in a key ("C4 B3 A3 G3"), or a preset; a bass note lasts one unit or two (a bar:
//                   strong, weak)
//   the melody      a voice over it under the two-part rules (@kairotic/cac's partimento.mjs, its copy here): a note
//                   played is taken as it is when the rules and the future allow it, else the nearest one that can
//                   be played, and why; each next note with its futures
//   the figures     for each unit, the chords the melody's note can belong to (5/3, 6/3, 6, 7/3, 6/4, 5/4, 4/2), the
//                   likeliest first: the rule of the octave (the figures of the scale in the bass, up and down, as the
//                   partimento schools taught it), the melody's own interval (a dissonance names its chord: a 7th a
//                   7/3, a 4th over ⑤ a 6/4 or 5/4, a 2nd over a held bass a 4/2), and the context (a dominant ⑤ a
//                   5/3 or 7/3)
//   the schemata    what the two lines make, recognized: parallel 3rds or 6ths, the 3–6 alternation, chains of 7–6
//                   and 2–3, and the cadences (imperfect 3–3, perfect 6–8, compound 7–6–8, on ⑤–① and ②–①)
//   the cadences    where the bass can close (②–①, ⑤–①, ⑤–⑥, a last ⑤) and, from the melody so far, how many ways
//                   each kind of cadence leaves to get there
//   a third voice   the figures chosen are asked of a middle voice under the melody (the three-part rules of
//                   partimento.mjs: no 3rd doubled, nor the leading tone, the 6/4 a double appoggiatura…): counted
//                   exactly, drawn by the engine

import { schemata, parts, keyOf, codeOf, codeDegree, codeAlter, localOf, CHORDS } from "./partimento.mjs";
import { total, choose, temperature } from "./soft.mjs";

const mod = (a, m) => ((a % m) + m) % m;
/** The degree (0 … 6) of a bass note in its own key (nt.key: {tonic, mode}, as Study 57 boxes the keys), else in K. */
const degOf = (K, nt) => (nt.key ? mod(nt.d - localOf(K, nt.key).o, 7) : mod(nt.d, 7));
const FIG = [8, 2, 3, 4, 5, 6, 7];

// ─── basses ───
export const BASSES = {
  "scale-down": { name: "the scale down", degrees: [7, 6, 5, 4, 3, 2, 1, 0] },
  "scale-up": { name: "the scale up", degrees: [0, 1, 2, 3, 4, 5, 6, 7] },
  romanesca: { name: "a leaping Romanesca (Pachelbel)", degrees: [7, 4, 5, 2, 3, 0, 3, 4, 0] },
  fifths: { name: "falling fifths", degrees: [7, 3, 6, 2, 5, 1, 4, 0] },
  monte: { name: "a Monte, then a cadence", degrees: [0, 1, 2, 3, 4, 0] },
  cadence: { name: "① ④ ⑤ ①", degrees: [7, 3, 4, 7] },
  // chapter 5's Galant schemata (IJzerman 5.1–5.6): a melody over them finds them again
  prinner: { name: "a Prinner, ④ ③ ② ①", degrees: [3, 2, 1, 0] },
  "monte-romanesca": { name: "a Monte Romanesca", degrees: [0, 4, 1, 5, 3, 7] },
  fenaroli: { name: "a Fenaroli", degrees: [0, 1, 2, -1, 0, 1, 2, -1, 0] },
  folia: { name: "the Folia (minor)", degrees: [0, -3, 0, -1, 2, -1, 0, -3, 0], mode: "minor" },
};

/** The degrees of a bass written as note names in a key ("C3 B2 A2"), or why not. */
export function parseBass(text, K) {
  const out = [];
  for (const tok of text.trim().split(/[\s,]+/).filter(Boolean)) {
    let code;
    try { code = codeOf(K, tok); } catch (e) { return { error: `${tok} is not a note of ${K.tonic} ${K.mode}` }; }
    const d = codeDegree(code), r = codeAlter(code);
    if (!(r === 0 || (r === 1 && K.mutable(d)))) return { error: `${tok} is not a note of ${K.tonic} ${K.mode}` };
    out.push({ d, r });
  }
  return out.length ? { notes: out } : { error: "no notes" };
}

/** The units of a bass: each note `per` units (1, or 2: a bar), struck on its first, the last one unit; the strong ones every other
 *  unit; ⑥ and ⑦ in minor raised going up a step; a dominant ⑤ going to ① or ⑥, or closing. */
export function unitsOf(notes, K, per = 2) {
  const units = [];
  notes.forEach((nt, i) => {
    const next = notes[i + 1];
    // (a note in a key of its own is written as it sounds: no ⑥ or ⑦ raised for it)
    const r = nt.key ? nt.r || 0 : nt.r || (K.mutable(nt.d) && next && next.d === nt.d + 1 ? 1 : 0);
    // a dominant: ⑤ going to ① or ⑥, or closing — read in the note's key
    const deg = degOf(K, nt), dominant = deg === 4 && (!next || [0, 5].includes(degOf(K, { ...next, key: nt.key })));
    // (the last note one unit: the final is struck, and the phrase ends on it)
    for (let j = 0; j < (next ? per : 1); j++) units.push({ d: nt.d, r, struck: j === 0, strong: units.length % 2 === 0, note: i, dominant, deg, key: nt.key || null });
  });
  return units;
}

// ─── the rule of the octave: the figures of the scale in the bass, up and down (in three parts) ───
// up: ① 5/3, ② 6/(4)/3, ③ 6/3, ④ 6/5 (a 6), ⑤ 5/3, ⑥ 6/3, ⑦ 6/(5)/3; down: ⑦ 6/3, ⑥ ♯6/4/3, ⑤ 5/3, ④ 4/2, ③ 6/3,
// ② 6/(4)/3, ① 5/3
const RULE_UP = ["5/3", "6/3", "6/3", "6", "5/3", "6/3", "6/3"];
const RULE_DOWN = ["5/3", "6/3", "6/3", "4/2", "5/3", "6/3", "6/3"];
export const RULE_OF_THE_OCTAVE = { up: RULE_UP, down: RULE_DOWN };

// ─── the endings, and the cadences each allows where the bass closes ───
// A kind of cadence: the figures it asks of the melody over the bass note before the last (one a unit, or a list for
// its units: two, for a compound one; else the unit before the last) and over the last; its kind, perfect (the octave on ①) or imperfect (the 3rd).
export const ENDINGS = {
  authentic: { name: "perfect or imperfect", kinds: ["perfect", "imperfect"] },
  perfect: { name: "perfect", kinds: ["perfect"] },
  imperfect: { name: "imperfect", kinds: ["imperfect"] },
  deceptive: { name: "deceptive (⑤–⑥)", kinds: ["deceptive"] },
  half: { name: "half (on ⑤)", kinds: ["half"] },
  // (IV–I: the bass ④–①, as Bach's chorales close many of their phrases; discussion #353)
  plagal: { name: "plagal (IV–I)", kinds: ["plagal"] },
};
const CADENCE_KINDS = {
  "②–①": [{ name: "imperfect (3–3)", kind: "imperfect", pen: [3], last: [3] }, { name: "perfect (6–8)", kind: "perfect", pen: [6], last: [8] },
          { name: "compound (7–6–8)", kind: "perfect", two: [[7], [6]], last: [8] }],
  "⑤–①": [{ name: "perfect (⑦ or ② to ①)", kind: "perfect", pen: [3, 5], last: [8] }, { name: "imperfect (to the 3rd)", kind: "imperfect", pen: [5, 8], last: [3] },
          { name: "compound (4–3), perfect", kind: "perfect", two: [[4], [3]], last: [8] }, { name: "compound (4–3), imperfect", kind: "imperfect", two: [[4], [3]], last: [3] }],
  "⑤–⑥": [{ name: "deceptive (⑦ to ①)", kind: "deceptive", pen: [3, 5], last: [3] }],
  "⑤": [{ name: "half (on ⑤)", kind: "half", pen: null, last: [8, 3] }],
  "④–①": [{ name: "plagal, the tonic held (5–8)", kind: "plagal", pen: [5], last: [8] }, { name: "plagal, ⑥ to ⑤ (3–5)", kind: "plagal", pen: [3], last: [5] },
          { name: "plagal, ④ to ③ (8–3)", kind: "plagal", pen: [8], last: [3] }],
};
/** The bass made to end as the ending asks: a deceptive cadence turns its last ① after ⑤ into the ⑥ above that ⑤,
 *  a half cadence leaves the last ① after ⑤ out; or why it cannot. */
function endWith(notes, ending, K) {
  const n = notes.length, last = notes[n - 1], pen = notes[n - 2];
  const dl = degOf(K, last), dp = pen && degOf(K, { ...pen, key: last.key });
  const fiveOne = pen && dp === 4 && dl === 0;
  if (ending === "deceptive") {
    if (pen && dp === 4 && dl === 5 && last.d === pen.d + 1) return notes;
    if (!fiveOne) throw new Error("a deceptive cadence needs a bass ending ⑤–①");
    return [...notes.slice(0, -1), { d: pen.d + 1, r: 0, key: last.key }];
  }
  if (ending === "plagal") {
    if (pen && dl === 0 && dp === 3) return notes;
    throw new Error("a plagal cadence needs a bass ending ④–①");
  }
  if (ending === "half") {
    if (dl === 4) return notes;
    if (!fiveOne) throw new Error("a half cadence needs a bass ending on ⑤, or ⑤–①");
    return notes.slice(0, -1);
  }
  return notes;
}
/** Where the bass closes at its end, with the kinds of cadence the ending allows there, or null. */
function finalClose(notes, units, ending, K) {
  const n = notes.length, last = notes[n - 1], pen = notes[n - 2], at = units.length - 1;
  const from = units.findIndex((u) => u.note === n - 2);
  // (the cadence read in the key of its last note)
  const dl = degOf(K, last), dp = pen && degOf(K, { ...pen, key: last.key });
  let kind = null;
  if (ending === "half") { if (dl === 4) kind = "⑤"; }
  else if (ending === "plagal") { if (pen && dl === 0 && dp === 3) kind = "④–①"; }
  else if (pen && dp === 1 && dl === 0 && Math.abs(pen.d - last.d) === 1) kind = "②–①";
  else if (pen && dp === 4 && dl === 0) kind = "⑤–①";
  else if (pen && dp === 4 && dl === 5 && last.d === pen.d + 1) kind = "⑤–⑥";
  if (!kind) return null;
  const options = CADENCE_KINDS[kind].filter((o) => ENDINGS[ending].kinds.includes(o.kind));
  return options.length ? { from: kind === "⑤" ? at : from, at, kind, options } : null;
}
/** The figures a kind of cadence asks of the melody, unit by unit (null: none), or null where it cannot be made. */
function optionFigs(o, cl) {
  const fs = [];
  for (let t = 0; t <= cl.at; t++) fs.push(null);
  const span = cl.at - cl.from;
  if (o.two) { if (span < 2) return null; fs[cl.from] = o.two[0]; for (let t = cl.from + 1; t < cl.at; t++) fs[t] = o.two[1]; }
  else if (o.pen) fs[cl.at - 1] = o.pen;
  fs[cl.at] = o.last;
  return fs;
}

/**
 * spec: {bass: "C4 B3 …" | degrees, key: {tonic, mode}, per (units a bass note: 1 or 2), ending ("authentic",
 *        "perfect", "imperfect", "deceptive", "half", "plagal"), line (how strictly the melody moves: "free", "moderate",
 *        "strict"), middleLine (the middle voice's), lo, hi (the melody's range in degrees), middle: [lo, hi],
 *        ro (chapter 4's rules, partimento.mjs's spec.ro)}
 * A bass given as notes ({d, r}) may give a note a key of its own ({d, r, key: {tonic, mode}}, Study 57's boxed keys):
 * it is read there — its degree, whether it is a dominant, the cadence it closes — and written as it sounds (r its
 * alteration in K's letters, none added).
 */
export function figuring(spec = {}) {
  const K = keyOf(spec.key || { tonic: "C" });
  let notes;
  if (Array.isArray(spec.bass)) notes = spec.bass.map((d) => (typeof d === "number" ? { d, r: 0 } : d));
  else { const p = parseBass(spec.bass || "C4 B3 A3 G3 F3 E3 D3 C3", K); if (p.error) throw new Error(p.error); notes = p.notes; }
  const per = spec.per ?? 2;
  // the ending: a cadence, perfect or imperfect (authentic: either) where the bass closes on ① (②–① or ⑤–①); or, the
  // player's choice, a deceptive one (the last ① turned into the ⑥ above its ⑤) or a half one (the phrase ending on ⑤)
  const ending = spec.ending || "authentic";
  if (!ENDINGS[ending]) throw new Error(`no such ending: ${ending}`);
  notes = endWith(notes, ending, K);
  const units = unitsOf(notes, K, per), n = units.length;
  // the melody's range over the bass: from C4, or a 5th above its highest note, an octave and a 6th up (room for a voice
  // between); the middle voice's under it
  const top = Math.max(...notes.map((x) => x.d)), bottom = Math.min(...notes.map((x) => x.d));
  const lo = spec.lo ?? Math.max(7, top + 4), hi = spec.hi ?? lo + 12, spacing = spec.spacing ?? hi - bottom;
  // the final cadence: where the bass closes, the kinds of cadence the ending allows there, and the figures they ask
  // of the melody (on each unit, those of any of them: the melody ends with one of them)
  // how strictly the lines move (partimento.mjs's spec.line): the melody "moderate" by default — a leap of a 5th or
  // more turns back by step —, the middle voice, an inner voice, "strict" — leaps up to a 5th (or the octave), turned
  // back by step from a 4th, never two the same way
  const line = spec.line || "moderate", middleLine = spec.middleLine || (line === "free" ? "moderate" : "strict");
  const fin = finalClose(notes, units, ending, K);
  const figsAt = units.map(() => null);
  if (fin) {
    const all = fin.options.map((o) => optionFigs(o, fin)).filter(Boolean);
    // (a unit one of them leaves free is free)
    for (let t = 0; t < units.length; t++) figsAt[t] = all.some((fs) => !fs[t]) ? null : [...new Set(all.flatMap((fs) => fs[t]))];
  }
  const V = schemata({ schema: { events: [] }, bass: units.map((u, t) => ({ ...u, fig: figsAt[t] })), key: K, figured: !!fin, lo, hi, spacing, line, ro: spec.ro });
  // the chords of the cadence: the last a 5/3 (a root position: its 5th or its 3rd above the bass, never a 6), and
  // before it, over the ⑤ of a ⑤–① cadence, a 5/3 or a 7/3 (the 6/4 or 5/4 of a compound cadence on the unit before)
  const cadenceChords = (t) => {
    if (t === n - 1) return ["5/3"];
    if (fin && fin.kind === "⑤–①" && t === n - 2) return ["5/3", "7/3"];
    // (IV before it: a 5/3 over ④)
    if (fin && fin.kind === "④–①" && t === n - 2) return ["5/3"];
    return null;
  };
  const D = V.degree, R = V.raised;

  // ─── the melody: a note played, taken as it is or corrected to the nearest with a future ───
  const midiOf = (c) => K.midi(D(c), R(c));
  /** The note to write next for a MIDI pitch asked: {note, corrected, reason, futures}; written for three (three: true),
   *  one under which a middle voice can still be written. */
  function play(U, midi, { room = false, three: forThree = room } = {}) {
    const t = U.length;
    if (t >= n) return null;
    const cands = V.fan(U);
    const exact = cands.find((c) => Math.abs(midiOf(c.note) - midi) < 0.5);
    let ok = cands.filter((c) => !c.reason && c.futures > 0n);
    // written for three: only the notes that keep a middle voice possible under the melody
    if (forThree) ok = ok.filter((c) => roomFor([...U, c.note]));
    if (!ok.length) return null;
    const best = ok.slice().sort((a, b) => Math.abs(midiOf(a.note) - midi) - Math.abs(midiOf(b.note) - midi) || (b.futures > a.futures ? 1 : -1))[0];
    const corrected = !(exact && ok.includes(exact));
    return { note: best.note, corrected, futures: best.futures,
             reason: corrected ? (exact ? exact.reason || (exact.futures > 0n ? "no middle voice could be written under it" : "no way on from it: the phrase could not be finished") : midi < K.midi(lo) || midi > K.midi(hi) ? "out of the melody's range" : "not a note of the key") : null };
  }

  // ─── the figures found, unit by unit ───
  const direction = (t) => {
    // the bass's way at this note: to the next bass note (or, at the last, from the one before)
    const i = units[t].note, a = notes[i], b = notes[i + 1] || null, z = notes[i - 1] || null;
    if (b) return b.d > a.d ? "up" : b.d < a.d ? "down" : "same";
    return z && z.d > a.d ? "down" : "up";
  };
  /** The chords the melody's note c can belong to at unit t, likeliest first: {chord, cost, why}. */
  function chordsAt(U, t, c = U[t]) {
    const v = V.vertical(t, c), deg = units[t].deg, dir = direction(t);
    const rule = (dir === "down" ? RULE_DOWN : RULE_UP)[deg];
    const held = t >= 1 && U[t - 1] === c, bassHeld = !units[t].struck, strong = units[t].strong;
    // a dissonance names its chord, or none: held over a bass struck (a suspension) a 7th is a 7/3, a 4th a 5/4, a 2nd
    // (the bass gone down under it) a 4/2; struck over a bass held on a strong unit (the bass's suspension) a 4/2; a
    // 4th struck on a strong ⑤ a 6/4 or 5/4 (an appoggiatura); struck on a weak unit, a note passing (or a neighbour):
    // no chord of its own, the one before it goes on
    let names = null;
    if (v.q === "dissonant") {
      if (held && !bassHeld) names = v.cls === 6 ? ["7/3"] : v.cls === 3 ? ["5/4"] : v.cls === 1 ? ["4/2"] : [];
      else if (bassHeld && strong) names = ["4/2"];
      else if (strong && v.cls === 3 && units[t].dominant) names = ["6/4", "5/4"];
      else return [{ chord: null, cost: 0, why: [`a ${t >= 1 && Math.abs(D(c) - D(U[t - 1])) === 1 ? "passing" : "neighbour"} note (a ${FIG[v.cls]}): the chord before it goes on`] }];
    }
    const out = [];
    const only = cadenceChords(t);
    for (const [ch, def] of Object.entries(CHORDS)) {
      if (!def.ok.includes(v.cls)) continue;
      if (only && !only.includes(ch)) continue;
      // (the 7/4 is a pedal's chord, chapter 5's Quiescenza: not over a bass that moves)
      if (ch === "7/4" && units[t].struck) continue;
      let cost = 0; const why = [];
      if (bassHeld) {
        // over a bass that holds its note the chord stays, or resolves: a 6th a 6/3 (the 7–6), a 5th or a 3rd a 5/3
        // (the 6/4 or the 5/4 resolved); the rule of the octave was asked of the note struck
        const prev = t >= 1 && U[t - 1] !== undefined ? V.vertical(t - 1, U[t - 1]).cls : null;
        const plain = v.cls === 5 ? "6/3" : [0, 2, 4].includes(v.cls) ? "5/3" : null;
        if (ch === plain || (plain === "6/3" && ch === "6")) why.push(prev === 6 && v.cls === 5 ? "the 7 resolved: a 7–6" : prev === 3 || prev === 5 && v.cls !== 5 ? "the dissonance resolved over the bass held" : "over the bass held");
        else cost += 2;
      } else if (ch === rule || (rule === "6" && ch === "6/3") || (rule === "6/3" && ch === "6")) { why.push(`the rule of the octave (${dir === "down" ? "down" : "up"}: ${K.circled(units[t].d)} ${rule})`); }
      else cost += 2;
      // (a chord whose dissonance the melody does not make: another voice must make it)
      if (!names && def.need.some((x) => x === 1 || x === 3 || x === 6)) cost += 1.5;
      if (names) {
        if (names.includes(ch)) { cost -= 3; why.push(`the melody's ${FIG[v.cls]} is the dissonance of a ${ch}${held ? ", held" : ""}`); }
        else cost += 3;
      }
      if (units[t].dominant && (ch === "5/3" || ch === "7/3")) { cost -= 1; why.push(`${K.circled(units[t].d)} a dominant`); }
      if (units[t].dominant && (ch === "6/3" || ch === "6")) cost += 1;
      if ((t === 0 || t === n - 1) && deg === 0 && ch === "5/3") { cost -= 2; why.push("① at the start or the end"); }
      if (deg === 0 && t !== 0 && t !== n - 1 && ch === "6/4" && !units[t].dominant) cost += 1;
      // (the 6 that doubles its bass, where the rule of the octave asks for it: on ④ going up; else the 6/3 first)
      if (ch === "6" && !(rule === "6" && !bassHeld)) cost += 0.5;
      out.push({ chord: ch, cost, why });
    }
    return out.sort((a, b) => a.cost - b.cost);
  }
  /** The figures of a melody: {two (the interval as a two-part figure), chords (likeliest first)} a unit. */
  const figuresOf = (U) => U.map((c, t) => {
    const v = V.vertical(t, c);
    return { two: v.cls === 0 ? (v.steps === 0 ? 1 : 8) : FIG[v.cls], q: v.q, chords: chordsAt(U, t, c) };
  });

  // ─── the schemata the two lines make ───
  function schemataIn(U) {
    const F = U.map((c, t) => ({ f: FIG[V.vertical(t, c).cls], q: V.vertical(t, c).q, strong: units[t].strong, d: units[t].d, struck: units[t].struck, held: t >= 1 && U[t - 1] === c }));
    const found = [];
    const run = (test, min, name) => {
      let s = 0;
      for (let t = 0; t <= F.length; t++) {
        if (t < F.length && test(t)) continue;
        if (t - s >= min) found.push({ from: s, to: t - 1, name });
        s = t + 1;
      }
    };
    const struckNotes = F.map((x, t) => t).filter((t) => F[t].struck);
    // parallel 3rds or 6ths on the bass notes struck, three at least
    for (const [f, name] of [[3, "parallel 3rds"], [6, "parallel 6ths"]]) {
      let s = 0;
      for (let i = 0; i <= struckNotes.length; i++) {
        if (i < struckNotes.length && F[struckNotes[i]].f === f && (i === s || Math.abs(F[struckNotes[i]].d - F[struckNotes[i - 1]].d) === 1)) continue;
        if (i - s >= 3) found.push({ from: struckNotes[s], to: struckNotes[i - 1], name });
        s = i + (i < struckNotes.length && F[struckNotes[i]].f === f ? 0 : 1);
        if (i < struckNotes.length && F[struckNotes[i]].f === f) s = i;
      }
    }
    // 7–6 and 2–3 chains: the dissonance on the strong unit, held, resolved on the weak one, twice at least
    const chain = (diss, cons, held) => (t) => {
      const k = F[t].strong ? t : t - 1;
      return k >= 0 && k + 1 < F.length && F[k].f === diss && F[k + 1].f === cons && (held === "upper" ? F[k].held : !F[k].struck);
    };
    run(chain(7, 6, "upper"), 4, "a 7–6 chain");
    run(chain(2, 3, "bass"), 4, "a 2–3 chain");
    // the 3–6 alternation over the bass notes (a 3rd on the strong unit, a 6th on the weak)
    run((t) => { const k = F[t].strong ? t : t - 1; return k >= 0 && k + 1 < F.length && F[k].f === 3 && F[k + 1].f === 6 && !F[k + 1].struck; }, 4, "the 3–6 progression");
    // cadences at the end of the melody (or anywhere ①, ⑥ follows ② or ⑤)
    for (let t = 1; t < F.length; t++) {
      if (!F[t].struck || units[t].deg !== 0) continue;
      const p = t - 1, deg = units[p].deg, k = units[p].note, kStart = units.findIndex((u) => u.note === k);
      const two = [F[kStart].f, F[p].f, F[t].f];
      if (deg === 1) {
        if (two[0] === 7 && two[1] === 6 && (two[2] === 8 || two[2] === 1)) found.push({ from: kStart, to: t, name: "a compound cadence 7–6–8" });
        else if (two[1] === 6 && (two[2] === 8 || two[2] === 1)) found.push({ from: p, to: t, name: "a perfect cadence 6–8" });
        else if (two[1] === 3 && two[2] === 3) found.push({ from: p, to: t, name: "an imperfect cadence 3–3" });
      }
      if (deg === 4 && Math.abs(F[p].d - F[t].d) > 1) {
        if (two[0] === 4 && two[1] === 3) found.push({ from: kStart, to: t, name: `a compound cadence 4–3 on ⑤–① (${two[2] === 3 ? "imperfect" : "perfect"})` });
        else found.push({ from: p, to: t, name: `a ${two[2] === 3 ? "an imperfect" : "perfect"} cadence on ⑤–①`.replace("a an", "an") });
      }
    }
    // chapter 5's Galant schemata, by their basses (the notes struck, their degrees in their keys) and, for the Prinner,
    // the melody in 3rds (10ths) over it
    const S = units.map((u, t) => t).filter((t) => units[t].struck && t < F.length);
    const at = (i) => units[S[i]].deg, step = (i) => mod(units[S[i + 1]].d - units[S[i]].d, 7);
    const end = (i) => (i + 1 < S.length ? S[i + 1] - 1 : F.length - 1);
    const seq = (i, degs) => degs.every((g, k) => i + k < S.length && at(i + k) === g);
    for (let i = 0; i < S.length; i++) {
      for (const [degs, name, thirds] of [[[3, 2, 1, 0], "a Prinner (④ ③ ② ①, 6̂ 5̂ 4̂ 3̂ in 10ths)", true], [[0, 6, 5, 4], "a modulating Prinner (① ⑦ ⑥ ⑤: ④ ③ ② ① of the dominant)", true],
                                          [[0, 1, 2, 6, 0], "a Fenaroli (① ② ③ ⑦ ①)", false], [[0, 4, 0, 6, 2, 6], "the Folia (① ⑤ ① ⑦ ③ ⑦)", false]])
        if (seq(i, degs) && (!thirds || [0, 1, 2].every((k) => F[S[i + k]].f === 3)) && !(name.startsWith("the Folia") && K.mode !== "minor"))
          found.push({ from: S[i], to: end(i + degs.length - 1), name });
    }
    // a 4th down and a 2nd up by turns (the leaping Romanesca), or a 5th up and a 4th down rising by step (the Monte
    // Romanesca): four bass notes at least
    const leaping = (i) => step(i) === 4 && step(i + 1) === 1, monteR = (i) => step(i) === 4 && step(i + 1) === 4 && units[S[i + 2]].d === units[S[i]].d + 1;
    for (let i = 0; i + 3 < S.length; i++) {
      if (leaping(i) && step(i + 2) === 4) { let j = i + 3; while (j + 1 < S.length && step(j) === (mod(j - i, 2) === 0 ? 4 : 1)) j++; found.push({ from: S[i], to: end(j), name: "a leaping Romanesca (a 4th down, a 2nd up)" }); i = j; }
      else if (monteR(i)) { let j = i + 3; while (j + 1 < S.length && step(j) === 4) j++; found.push({ from: S[i], to: end(j), name: "a Monte Romanesca (a 5th up, a 4th down, rising)" }); i = j; }
    }
    return found.sort((a, b) => a.from - b.from);
  }

  // ─── the cadences: where the bass can close, and the ways the melody so far leaves to get there ───
  /** Where the bass closes, the last cadence: [{at (the unit of the last chord), from (the unit the cadence starts),
   *  kind, options (the kinds of cadence the ending allows there)}] (none, where the bass does not close). */
  const closes = () => (fin ? [fin] : []);
  /** The ways the melody U (so far) leaves to close at a close, with each kind of cadence there: [{name, count}]. */
  const cadW = new Map();
  /** With three: the ways counted in three parts (the melody to the cadence and a middle voice under it). */
  function cadenceWays(U, cl, { three: forThree = false } = {}) {
    return cl.options.map((o) => {
      const fs = optionFigs(o, cl);
      if (!fs) return { name: o.name, kind: o.kind, count: 0n, why: "needs a bass note of two units" };
      const wk = cl.at + ":" + o.name;
      const W = cadW.get(wk) || schemata({ schema: { events: [] }, bass: units.map((u, t) => ({ ...u, fig: fs[t] })), key: K, figured: true, lo, hi, spacing, line, ro: spec.ro });
      cadW.set(wk, W);
      // the melody so far must already fit the cadence it asks for, where it covers it
      for (let t = 0; t < U.length; t++) if (W.check(U.slice(0, t), t, U[t])) return { name: o.name, kind: o.kind, count: 0n, why: t >= cl.from ? "the melody went another way" : null };
      return { name: o.name, kind: o.kind, count: forThree ? threeWays(U, W.check) : W.count(U), voice: W };
    });
  }

  // ─── a third voice: a middle voice under the melody, asked the figures chosen ───
  /** The three-part kernel for the bass, the chords asked one a unit (null: none asked). */
  function three(chosen = units.map(() => null)) {
    // (the bass as it is: each unit with its key, the chords asked; chapter 4's rules where the melody has them)
    return parts({ bass: units.map((u, t) => ({ ...u, chord: chosen[t] || null })), cadence: null, key: K, top: [lo, hi], middle: spec.middle || [bottom + 2, hi - 2], spacing,
                   line: { top: line, middle: middleLine }, ro: spec.ro });
  }
  // (the noise of the search: notes out of the middle voice's place, not reasons a musician needs)
  const PLACE = /below the bass|too far|wider than|under the upper|within an octave|out of|unison with the bass/;
  /** Why the melody's a and the middle voice's b at unit t make no chord of the figures (no 3rd: an open 5th, a bare
   *  octave), or null; a dissonance on a weak unit passes, and needs none. */
  const noChord = (P, t, a, b) => {
    const vt = P.top.vertical(t, a), vm = P.middle.vertical(t, b);
    const only = cadenceChords(t);
    if (!only && (vt.q === "dissonant" || vm.q === "dissonant") && !units[t].strong) return null;
    const have = new Set([vt.cls, vm.cls]);
    const names = only || Object.keys(CHORDS);
    if (names.some((ch) => CHORDS[ch].need.every((c) => have.has(c)) && [...have].every((c) => CHORDS[ch].ok.includes(c)))) return null;
    return only ? `the cadence asks for ${only.join(" or ")} here` : "no chord of the figures (its 3rd missing)";
  };
  /** Why the upper voices, going from a dominant ⑤ to the ① (or the ⑥) after it, do not resolve its tendencies, or
   *  null: the leading tone goes up to the tonic, the 7th (④) down to ③ — in either voice. */
  const resolves = (TT, MM, t, a, b) => {
    if (t < 1 || !units[t].struck || !units[t - 1].dominant || units[t - 1].deg !== 4) return null;
    const to = units[t].deg;
    if (to !== 0 && to !== 5) return null;
    // (read in the key of the unit; the middle voice may leave the leading tone down to ⑤ over ①, completing the
    // chord of the tonic, as Bach's inner voices do)
    const kp = V.keys[t - 1].key;
    for (const [px, x, who] of [[TT[t - 1], a, "the upper voice"], [MM[t - 1], b, "the middle voice"]]) {
      const l = V.loc(t - 1, px), deg = l.deg;
      if (deg === 6 && (kp.mode === "major" ? l.alt === 0 : l.alt === 1) && D(x) !== D(px) + 1 && !(who === "the middle voice" && to === 0 && D(x) === D(px) - 2))
        return `the leading tone goes up to the tonic (${who}; a middle voice may go down to ⑤)`;
      if (deg === 3 && D(x) !== D(px) - 1) return `the 7th of the dominant goes down to ③ (${who})`;
    }
    return null;
  };
  /**
   * The middle voices under the melody U, asked at each unit a chord (a figure), one of several (an array: any of the
   * figures found), or none (null): their count, one drawn by the engine, and the chords it makes; or, where none can
   * be written, the unit where every one stops and why.
   */
  function middle(U, chosen = U.map(() => null), { temp = 0.5, r = Math.random } = {}) {
    const P = three(units.map(() => null));
    const T = [...U]; // (the same codes: 2·degree + raised, in the same key)
    const allowed = chosen.map((x) => (x === null || x === undefined ? null : [].concat(x).filter(Boolean)));
    const fits = (t, b) => {
      const A = allowed[t];
      if (!A || !A.length) return true;
      const have = new Set([P.top.vertical(t, T[t]).cls, P.middle.vertical(t, b).cls]);
      return A.some((ch) => CHORDS[ch].need.every((c) => have.has(c)) && [...have].every((c) => CHORDS[ch].ok.includes(c)));
    };
    const why = (MM, t, b) => P.check(T, MM, t, T[t], b) || (fits(t, b) ? null : `the chord asked is ${[].concat(allowed[t]).join(" or ")}`) || noChord(P, t, T[t], b) || resolves(T, MM, t, T[t], b);
    const memo = new Map();
    const countFrom = (MM) => {
      const t = MM.length;
      if (t >= n) return 1n;
      const k = t + ":" + MM.slice(Math.max(0, t - 3)).join(",");
      if (memo.has(k)) return memo.get(k);
      let v = 0n;
      for (const b of P.middle.codes) if (why(MM, t, b) === null) { MM.push(b); v += countFrom(MM); MM.pop(); }
      memo.set(k, v);
      return v;
    };
    const count = countFrom([]);
    if (!count) {
      // where it stops: the furthest unit a middle voice reaches, and the reasons heard there
      let deepest = 0, heard = new Map();
      const seen = new Set();
      const dfs = (MM) => {
        const t = MM.length;
        if (t > deepest) { deepest = t; heard = new Map(); }
        if (t >= n) return;
        const k = t + ":" + MM.slice(Math.max(0, t - 3)).join(",");
        if (seen.has(k)) return;
        seen.add(k);
        for (const b of P.middle.codes) {
          const w = why(MM, t, b);
          if (w === null) { MM.push(b); dfs(MM); MM.pop(); }
          else if (t === deepest && !PLACE.test(w)) heard.set(w, (heard.get(w) || 0) + 1);
        }
      };
      dfs([]);
      return { count, stops: deepest, why: [...heard].sort((a, b) => b[1] - a[1]).map(([w]) => w).slice(0, 3) };
    }
    const MM = [];
    while (MM.length < n) {
      const t = MM.length;
      const cs = P.middle.codes.filter((b) => why(MM, t, b) === null).map((b) => ({ note: b, futures: countFrom([...MM, b]), cost: total(P.middle.costParts(MM, b)) }));
      const pick = choose(cs.filter((c) => c.futures > 0n), temperature(temp, true, countFrom(MM)), r);
      if (!pick) break;
      MM.push(pick.note);
    }
    return { count, voice: MM, top: T, parts: P, chords: P.chords({ top: T, middle: MM }), judge: P.judge({ top: T, middle: MM }) };
  }

  // ─── writing for three: a melody, and its figures, only where a middle voice can be written under them ───
  // The melody so far is fixed; the middle voice under it is not yet written, nor the rest of the melody. The ways on
  // are the three-part realizations (melody and middle voice) that keep the melody so far: a middle voice under it,
  // walked forward (its states the last three notes, as the kernel's memo), then the two voices on together to the
  // end — the melody under its own rules (two parts, or a cadence's), both under the three-part ones.
  let P0 = null;
  const P3 = () => (P0 = P0 || three());
  const memos = new Map();
  /** The three-part realizations from (TT, MM), both of length t, the melody's notes beyond them checked by topCheck. */
  function jointFrom(TT, MM, topCheck) {
    const P = P3(), t = TT.length;
    if (t >= n) return 1n;
    let memo = memos.get(topCheck);
    if (!memo) memos.set(topCheck, (memo = new Map()));
    const k = t + ":" + TT.slice(Math.max(0, t - 3)).join(",") + "|" + MM.slice(Math.max(0, t - 3)).join(",");
    const got = memo.get(k);
    if (got !== undefined) return got;
    let v = 0n;
    for (const a of V.codes) {
      if (topCheck(TT, t, a) !== null) continue;
      TT.push(a);
      for (const b of P.middle.codes) if (P.check(TT, MM, t, a, b) === null && noChord(P, t, a, b) === null && resolves(TT, MM, t, a, b) === null) { MM.push(b); v += jointFrom(TT, MM, topCheck); MM.pop(); }
      TT.pop();
    }
    memo.set(k, v);
    return v;
  }
  /** The chord (a name of CHORDS) the melody's a and the middle voice's b make at unit t, by the figures asked. */
  const makes = (t, a, b, ch) => {
    const P = P3(), have = new Set([P.top.vertical(t, a).cls, P.middle.vertical(t, b).cls]);
    return CHORDS[ch].need.every((c) => have.has(c)) && [...have].every((c) => CHORDS[ch].ok.includes(c));
  };
  /**
   * The middle voices under the melody so far U (asked at each unit a chord, or none: asked[t] null), walked forward,
   * and the ways on from each to the end: {ways (the three-part realizations keeping U and the chords asked), alive
   * (at each unit, the middle notes on a way that reaches the end)}.
   */
  function walk(U, asked = [], topCheck = V.check) {
    const P = P3(), k = U.length;
    let layer = new Map([["", { MM: [], paths: 1n }]]);
    const steps = [];
    for (let t = 0; t < k; t++) {
      const next = new Map(), edges = [];
      for (const [key, st] of layer) for (const b of P.middle.codes) {
        if (P.check(U, st.MM, t, U[t], b) !== null || noChord(P, t, U[t], b) !== null || resolves(U, st.MM, t, U[t], b) !== null) continue;
        if (asked[t] && !makes(t, U[t], b, asked[t])) continue;
        const MM = [...st.MM, b], nk = MM.slice(Math.max(0, MM.length - 3)).join(",");
        const e = next.get(nk) || { MM, paths: 0n };
        e.paths += st.paths;
        next.set(nk, e);
        edges.push([key, b, nk]);
      }
      steps.push(edges);
      layer = next;
    }
    // the ways on from each middle voice so far: the two voices on together
    const T = [...U];
    let ways = 0n;
    let live = new Set();
    for (const [key, st] of layer) {
      const f = jointFrom(T, [...st.MM], topCheck);
      if (f > 0n) { ways += st.paths * f; live.add(key); }
    }
    // back: the middle notes on a way that reaches the end
    const alive = [];
    for (let t = k - 1; t >= 0; t--) {
      const prev = new Set(), bs = new Set();
      for (const [from, b, to] of steps[t]) if (live.has(to)) { prev.add(from); bs.add(b); }
      alive[t] = bs;
      live = prev;
    }
    return { ways, alive };
  }
  /** The three-part realizations keeping the melody so far: 0 where no middle voice can be written under it. */
  const threeWays = (U, topCheck = V.check) => walk(U, [], topCheck).ways;
  /** Whether a middle voice can still be written under the melody so far (and the melody finished over it). */
  const roomFor = (U) => threeWays(U) > 0n;

  /**
   * The figures of a melody written for three: at each unit, in order, the likeliest chord (or the player's, asked
   * in mine) among those a middle voice can make there with the chords chosen before it, and the melody still be
   * finished over it — so a middle voice can always be written from them. [{two, q, chords (each with three: whether
   * it is among those), chord (the one chosen)}].
   */
  function figuresThree(U, mine = {}) {
    const base = figuresOf(U), asked = [];
    for (let t = 0; t < U.length; t++) {
      const { alive } = walk(U, asked);
      const can = (ch) => ch === null || [...(alive[t] || [])].some((b) => makes(t, U[t], b, ch));
      for (const c of base[t].chords) c.three = can(c.chord);
      const want = t in mine ? base[t].chords.find((c) => c.chord === mine[t] && c.three) : null;
      const pick = want || base[t].chords.find((c) => c.three);
      base[t].chord = pick ? pick.chord : null;
      // (none of them: the middle voice passes there, a dissonance on a weak unit)
      if (!pick) base[t].chords.unshift({ chord: null, cost: 0, three: true, why: ["the middle voice passes: the chord before it goes on"] });
      asked[t] = base[t].chord;
    }
    return base;
  }
  /** The engine writing the melody on from U0 for three: each note among those that keep a middle voice possible
   *  (and, with topCheck, a cadence's figures), a softmax of −cost / temperature. */
  function engineThree({ temp = 0.5, r = Math.random } = {}, U0 = [], topCheck = V.check) {
    const U = [...U0];
    while (U.length < n) {
      const t = U.length;
      const cs = V.codes.filter((c) => topCheck(U, t, c) === null).map((c) => ({ note: c, futures: threeWays([...U, c], topCheck), cost: total(V.costParts(U, c)) }));
      const pick = choose(cs.filter((c) => c.futures > 0n), temperature(temp, true, cs.reduce((a, c) => a + c.futures, 0n)), r);
      if (!pick) return null;
      U.push(pick.note);
    }
    return U;
  }
  /** The next note's candidates for three: V.fan's, each with its three-part ways on (futures3). */
  const fanThree = (U) => V.fan(U).map((c) => (c.reason || !(c.futures > 0n) ? c : { ...c, futures3: threeWays([...U, c.note]) }));

  return { spec, key: K, notes, units, n, per, ending, line, middleLine, voice: V, play, fan: V.fan, count: V.count, engine: V.engine, judge: V.judge,
           chordsAt, figuresOf, schemataIn, closes, cadenceWays, middle, three, roomFor, threeWays, figuresThree, engineThree, fanThree, name: V.name, degree: D, raised: R, hz: V.hz, midiOf,
           bassName: (t) => K.name(units[t].d, units[t].r) };
}
