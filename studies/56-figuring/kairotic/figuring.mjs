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

import { schemata, parts, keyOf, codeOf, isDominant, CHORDS } from "./partimento.mjs";
import { total, choose, temperature } from "./soft.mjs";

const mod = (a, m) => ((a % m) + m) % m;
const FIG = [8, 2, 3, 4, 5, 6, 7];

// ─── basses ───
export const BASSES = {
  "scale-down": { name: "the scale down", degrees: [7, 6, 5, 4, 3, 2, 1, 0] },
  "scale-up": { name: "the scale up", degrees: [0, 1, 2, 3, 4, 5, 6, 7] },
  romanesca: { name: "a leaping Romanesca (Pachelbel)", degrees: [7, 4, 5, 2, 3, 0, 3, 4, 0] },
  fifths: { name: "falling fifths", degrees: [7, 3, 6, 2, 5, 1, 4, 0] },
  monte: { name: "a Monte, then a cadence", degrees: [0, 1, 2, 3, 4, 0] },
  cadence: { name: "① ④ ⑤ ①", degrees: [7, 3, 4, 7] },
};

/** The degrees of a bass written as note names in a key ("C3 B2 A2"), or why not. */
export function parseBass(text, K) {
  const out = [];
  for (const tok of text.trim().split(/[\s,]+/).filter(Boolean)) {
    let code;
    try { code = codeOf(K, tok); } catch (e) { return { error: `${tok} is not a note of ${K.tonic} ${K.mode}` }; }
    out.push({ d: code >> 1, r: code & 1 });
  }
  return out.length ? { notes: out } : { error: "no notes" };
}

/** The units of a bass: each note `per` units (1, or 2: a bar), struck on its first, the last one unit; the strong ones every other
 *  unit; ⑥ and ⑦ in minor raised going up a step; a dominant ⑤ going to ① or ⑥, or closing. */
export function unitsOf(notes, K, per = 2) {
  const units = [];
  notes.forEach((nt, i) => {
    const next = notes[i + 1];
    const r = nt.r || (K.mutable(nt.d) && next && next.d === nt.d + 1 ? 1 : 0);
    // (the last note one unit: the final is struck, and the phrase ends on it)
    for (let j = 0; j < (next ? per : 1); j++) units.push({ d: nt.d, r, struck: j === 0, strong: units.length % 2 === 0, note: i, dominant: isDominant(nt.d, next && next.d) });
  });
  return units;
}

// ─── the rule of the octave: the figures of the scale in the bass, up and down (in three parts) ───
// up: ① 5/3, ② 6/(4)/3, ③ 6/3, ④ 6/5 (a 6), ⑤ 5/3, ⑥ 6/3, ⑦ 6/(5)/3; down: ⑦ 6/3, ⑥ ♯6/4/3, ⑤ 5/3, ④ 4/2, ③ 6/3,
// ② 6/(4)/3, ① 5/3
const RULE_UP = ["5/3", "6/3", "6/3", "6", "5/3", "6/3", "6/3"];
const RULE_DOWN = ["5/3", "6/3", "6/3", "4/2", "5/3", "6/3", "6/3"];
export const RULE_OF_THE_OCTAVE = { up: RULE_UP, down: RULE_DOWN };

/**
 * spec: {bass: "C4 B3 …" | degrees, key: {tonic, mode}, per (units a bass note: 1 or 2), lo, hi (the melody's range
 *        in degrees), middle: [lo, hi]}
 */
export function figuring(spec = {}) {
  const K = keyOf(spec.key || { tonic: "C" });
  let notes;
  if (Array.isArray(spec.bass)) notes = spec.bass.map((d) => (typeof d === "number" ? { d, r: 0 } : d));
  else { const p = parseBass(spec.bass || "C4 B3 A3 G3 F3 E3 D3 C3", K); if (p.error) throw new Error(p.error); notes = p.notes; }
  const per = spec.per ?? 2;
  const units = unitsOf(notes, K, per), n = units.length;
  // the melody's range over the bass: from C4, or a 5th above its highest note, an octave and a 6th up (room for a voice
  // between); the middle voice's under it
  const top = Math.max(...notes.map((x) => x.d)), bottom = Math.min(...notes.map((x) => x.d));
  const lo = spec.lo ?? Math.max(7, top + 4), hi = spec.hi ?? lo + 12, spacing = spec.spacing ?? hi - bottom;
  const V = schemata({ schema: { events: [] }, bass: units, key: K, figured: false, lo, hi, spacing });
  const D = V.degree, R = V.raised;

  // ─── the melody: a note played, taken as it is or corrected to the nearest with a future ───
  const midiOf = (c) => K.midi(D(c), R(c));
  /** The note to write next for a MIDI pitch asked: {note, corrected, reason, futures}; with room, one that leaves room
   *  for a middle voice under the melody, where one does. */
  function play(U, midi, { room = false } = {}) {
    const t = U.length;
    if (t >= n) return null;
    const cands = V.fan(U);
    const exact = cands.find((c) => Math.abs(midiOf(c.note) - midi) < 0.5);
    let ok = cands.filter((c) => !c.reason && c.futures > 0n);
    // thinking in three parts: the notes that leave room for a middle voice, where there are any
    if (room) { const roomy = ok.filter((c) => roomFor([...U, c.note])); if (roomy.length) ok = roomy; }
    if (!ok.length) return null;
    const best = ok.slice().sort((a, b) => Math.abs(midiOf(a.note) - midi) - Math.abs(midiOf(b.note) - midi) || (b.futures > a.futures ? 1 : -1))[0];
    const corrected = !(exact && ok.includes(exact));
    return { note: best.note, corrected, futures: best.futures,
             reason: corrected ? (exact ? exact.reason || (exact.futures > 0n ? "no room left for a middle voice under it" : "no way on from it: the phrase could not be finished") : midi < midiOf(2 * lo) || midi > midiOf(2 * hi) ? "out of the melody's range" : "not a note of the key") : null };
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
    const v = V.vertical(t, c), deg = mod(units[t].d, 7), dir = direction(t);
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
    for (const [ch, def] of Object.entries(CHORDS)) {
      if (!def.ok.includes(v.cls)) continue;
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
      if (!F[t].struck || mod(F[t].d, 7) !== 0) continue;
      const p = t - 1, deg = mod(F[p].d, 7), k = units[p].note, kStart = units.findIndex((u) => u.note === k);
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
    return found.sort((a, b) => a.from - b.from);
  }

  // ─── the cadences: where the bass can close, and the ways the melody so far leaves to get there ───
  const KINDS = {
    "2-1": [{ name: "imperfect (3–3)", figs: (k) => [k.map(() => [3]), [3]] }, { name: "perfect (6–8)", figs: (k) => [k.map(() => [6]), [8]] },
            { name: "compound (7–6–8)", two: true, figs: () => [[[7], [6]], [8]] }],
    "5-1": [{ name: "perfect (⑦ or ② to ①)", figs: (k) => [k.map(() => [3, 5]), [8]] }, { name: "imperfect (to the 3rd)", figs: (k) => [k.map(() => [5, 8]), [3]] },
            { name: "compound (4–3)", two: true, figs: () => [[[4], [3]], [8, 3]] }],
    "5-6": [{ name: "deceptive", figs: (k) => [k.map(() => [3, 5]), [3, 6]] }],
    "5-end": [{ name: "half (on ⑤)", figs: (k) => [null, null], half: true }],
  };
  /** Where the bass can close: [{at (the unit of the last chord), from (the unit the cadence starts), kind, options}] */
  function closes() {
    const out = [];
    notes.forEach((nt, i) => {
      if (i === 0) return;
      const p = notes[i - 1], a = mod(p.d, 7), b = mod(nt.d, 7);
      const from = units.findIndex((u) => u.note === i - 1), at = units.findIndex((u) => u.note === i);
      if (a === 1 && b === 0 && Math.abs(p.d - nt.d) === 1) out.push({ from, at, kind: "②–①", options: KINDS["2-1"] });
      if (a === 4 && b === 0) out.push({ from, at, kind: "⑤–①", options: KINDS["5-1"] });
      if (a === 4 && b === 5 && nt.d === p.d + 1) out.push({ from, at, kind: "⑤–⑥", options: KINDS["5-6"] });
    });
    const last = notes.length - 1;
    if (mod(notes[last].d, 7) === 4) { const at = units.findIndex((u) => u.note === last); out.push({ from: at, at, kind: "⑤ (the end)", options: KINDS["5-end"] }); }
    return out;
  }
  /** The ways the melody U (so far) leaves to close at a close, with each kind of cadence there: [{name, count}]. */
  function cadenceWays(U, cl) {
    return cl.options.map((o) => {
      const fromUnits = []; for (let t = cl.from; t < cl.at; t++) fromUnits.push(t);
      if (o.two && fromUnits.length < 2) return { name: o.name, count: 0n, why: "needs a bass note of two units" };
      if (o.half) return { name: o.name, count: V.count(U) };
      const [pen, last] = o.figs(fromUnits);
      const B2 = units.map((u, t) => ({ ...u, fig: t >= cl.from && t < cl.at ? pen[t - cl.from] : t === cl.at ? last : null }));
      const W = schemata({ schema: { events: [] }, bass: B2, key: K, figured: true, lo, hi, spacing });
      // the melody so far must already fit the cadence it asks for, where it covers it
      for (let t = 0; t < U.length; t++) if (W.check(U.slice(0, t), t, U[t])) return { name: o.name, count: 0n, why: t >= cl.from ? "the melody went another way" : null };
      return { name: o.name, count: W.count(U), voice: W };
    });
  }

  // ─── a third voice: a middle voice under the melody, asked the figures chosen ───
  /** The three-part kernel for the bass, the chords asked one a unit (null: none asked). */
  function three(chosen = units.map(() => null)) {
    const events = notes.map((nt, i) => [nt.d, units.filter((u) => u.note === i).length, chosen.filter((x, t) => units[t].note === i)]);
    return parts({ schema: { events }, cadence: null, key: K, top: [lo, hi], middle: spec.middle || [bottom + 2, hi - 2] });
  }
  // (the noise of the search: notes out of the middle voice's place, not reasons a musician needs)
  const PLACE = /below the bass|too far|wider than|under the upper|within an octave|out of|unison with the bass/;
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
    const why = (MM, t, b) => P.check(T, MM, t, T[t], b) || (fits(t, b) ? null : `the chord asked is ${[].concat(allowed[t]).join(" or ")}`);
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

  /** Whether a middle voice can still be written under the melody so far (U, a prefix; no chord asked). */
  let P0 = null;
  function roomFor(U) {
    P0 = P0 || three();
    const seen = new Set();
    const go = (MM) => {
      const t = MM.length;
      if (t >= U.length) return true;
      const k = t + ":" + MM.slice(Math.max(0, t - 3)).join(",");
      if (seen.has(k)) return false;
      seen.add(k);
      for (const b of P0.middle.codes) if (P0.check(U, MM, t, U[t], b) === null) { MM.push(b); if (go(MM)) return true; MM.pop(); }
      return false;
    };
    return go([]);
  }

  return { spec, key: K, notes, units, n, per, voice: V, play, fan: V.fan, count: V.count, engine: V.engine, judge: V.judge,
           chordsAt, figuresOf, schemataIn, closes, cadenceWays, middle, three, roomFor, name: V.name, degree: D, raised: R, hz: V.hz, midiOf,
           bassName: (t) => K.name(units[t].d, units[t].r) };
}
