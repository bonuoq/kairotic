// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 76 · continuo: a figured bass under Bach's soprano, then the voices that play it (discussion #353).
//
// The two steps of a continuo player who is given only the tune:
//   1. the bass and its figures — Study 63's under.mjs (the structural thread's): an exact bridge under the soprano,
//      each quarter a local key, a bass note and a chord over it, its costs Bach's (@kairotic/rules' continuo.mjs,
//      counted from his chorales but every fifth); the soprano a chord tone, or a suspension, a passing or neighbour
//      note, a note held over a moving bass, as his;
//   2. the inner voices — @kairotic/rules' bach-4 (fromOuter), the bass's chords asked as a wish (figuresWeight): a
//      realization that leaves out a tone of a chord or adds one pays for it — the chord's own pitch classes, so a
//      figured ♯ is played raised —, where as orders bach-4's hard rules would refuse half of Bach's phrases realized
//      on his own chords.
// The figures are written as Bach abbreviates them in his continuo parts (continuo.mjs's BACH_WRITES, from the Bach
// Chorales Figured Bass dataset): nothing over a 5/3, 6 for a 6/3, 6/4/2 for a 4/2, an accidental alone for the 3rd.
//
// Pure data and functions; the page draws, plays and compares.

import { underBridge, isHeldOut, UNDER_VARIANTS, KIND_INTERVALS } from "./under.mjs";
import * as CONTINUO from "./continuo.mjs";
import { fromOuter } from "./rules.mjs";
import { derives, parallels } from "./diminish.mjs";

export { isHeldOut, UNDER_VARIANTS };
export const VARIANTS = UNDER_VARIANTS.map((v) => v.name);
const mod = (a, m) => ((a % m) + m) % m;

/** A seeded random (Park–Miller), for draws that can be told again. */
export const rng = (seed = 76) => { let s = seed % 2147483647 || 1; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; };

// (the bass's chords as fourOverBass names them)
const ENGINE = { "5/3": "5/3", "6/3": "6/3", "6/4": "6/4", "7": "7", "6/5": "6/5", "4/3": "6/4/3", "4/2": "4/2" };
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (name) => mod(PC[String(name)[0]] + (String(name).match(/[#♯]/g) || []).length - (String(name).match(/[b♭]/g) || []).length, 12);
/** A chord's pitch classes (0 a C), from under.mjs's {root, kind}: what its figures ask, accidentals and all. */
export const pcsOf = (ch) => (ch && ch.root !== undefined && KIND_INTERVALS[ch.kind] ? KIND_INTERVALS[ch.kind].map((i) => mod(pcOf(ch.root) + i, 12)) : null);
const keyText = (k) => (typeof k === "string" ? k : `${k.tonic} ${k.mode || "major"}`).replace("♯", "#").replace("♭", "b");

/**
 * A figure as Bach writes it: the chord's numbers as he abbreviates them (BACH_WRITES), each with the accidental the
 * full figure gives it ("♯6/4/3" over a 4/3 → "♯6/4/3"; "5/♯3" over a 5/3 → "♯"; "6/5" stays), an altered note whose
 * number he leaves out written after them (the 3rd by its accidental alone). full: under.mjs's figureText.
 */
export function abbreviate(full, figure) {
  const nums = CONTINUO.BACH_WRITES[figure];
  if (!nums || !full) return full || "";
  const marks = {};
  for (const part of String(full).split("/")) { const m = /^([♯♭♮]?)(\d+)$/.exec(part); if (m && m[1]) marks[m[2]] = m[1]; }
  const out = nums.map((n) => (marks[n] || "") + n);
  for (const [n, a] of Object.entries(marks)) if (!nums.includes(n)) out.push(n === "3" ? a : a + n);
  return out.join("/");
}

/**
 * The bass under a phrase's soprano and the voices over it. phrase: the corpus's ({satb, names, strong, key}).
 * opts: {variant ("all", "no-functions", "no-keys", "no-economy"), r (a random), temp (the inner voices' engine: 1,
 * as bach-4 was measured — its voices moving and dissonating nearly as often as Bach's —; 0 the likeliest), weight
 * (figuresWeight, 8), style (bach-4 by default)}. → {bass, figures (as Bach writes them), full (every number), chords,
 * keys, satb: [[S, A, T, B]…] (MIDI), held, dissonances: [{t, motion, interval}]} or {fail: why, bass?}.
 */
export function realize(phrase, { variant = "all", r = Math.random, temp = 1, weight = 8, style = undefined } = {}) {
  const S = phrase.satb.map((c) => c[0]), n = S.length;
  const U = underBridge({ soprano: S, key: phrase.key, strong: phrase.strong, variant, continuo: CONTINUO });
  if (!U.possible) return { fail: "no bass under this soprano" };
  const d = U.draw(r);
  if (!d) return { fail: "no bass under this soprano" };
  const out = { bass: d.bass, full: d.figures, chords: d.chords, keys: d.keys.map(keyText),
                figures: d.chords.map((ch, t) => (ch && ch.figure ? abbreviate(d.figures[t], ch.figure) : d.figures[t] || "")),
                dissonances: d.chords.map((ch, t) => (ch && ch.dissonance ? { t, ...ch.dissonance } : null)).filter(Boolean) };
  // (a bass note repeated onto a weak quarter, the same chord over it, is held)
  const sameAs = (t) => t > 0 && d.bass[t] === d.bass[t - 1] && !phrase.strong[t] && out.figures[t] === out.figures[t - 1] && out.keys[t] === out.keys[t - 1];
  const bass = [], sop = [];
  d.bass.forEach((m, t) => {
    const fig = ENGINE[d.chords[t] && d.chords[t].figure], pcs = pcsOf(d.chords[t]);
    if (sameAs(t)) { const o = bass[bass.length - 1]; o.units++; o.strong.push(!!phrase.strong[t]); }
    else bass.push({ midi: m, units: 1, strong: [!!phrase.strong[t]], key: out.keys[t], ...(fig ? { fig } : {}), ...(pcs ? { pcs } : {}) });
  });
  S.forEach((m, t) => sop.push({ midi: m, ...(phrase.names ? { name: phrase.names[t][0] } : {}), units: 1, strong: [!!phrase.strong[t]] }));
  let ob;
  try { ob = fromOuter({ bass, soprano: sop, key: keyText(phrase.key), figuresWeight: weight, ...(style ? { style } : {}) }); } catch (e) { return { ...out, fail: e.message || String(e) }; }
  if (ob.count() === 0n) {
    const dd = ob.deadEnd ? ob.deadEnd() : null, top = dd && dd.reasons ? dd.reasons.filter(([w]) => w !== "the soprano is given")[0] : null;
    return { ...out, fail: dd ? `no inner voices: quarter ${dd.unit + 1}${top ? `, ${top[0]}` : ""}` : "no inner voices" };
  }
  const W = ob.engine({ temp, r });
  if (!W) return { ...out, fail: "no inner voices" };
  out.satb = Array.from({ length: n }, (_, t) => [S[t], ob.midi(W.alto[t]), ob.midi(W.tenor[t]), d.bass[t]]);
  const bassHeld = [];
  bass.forEach((b) => { for (let k = 0; k < b.units; k++) bassHeld.push(k > 0); });
  out.held = Array.from({ length: n }, (_, t) => [!!(phrase.held && phrase.held[t][0]), false, false, bassHeld[t]]);
  return out;
}

/** Bach's figures for a phrase, read from his four voices (continuo.mjs's figureOf, in the chorale's key signature). */
export const bachFigures = (phrase) => phrase.names.map((nm, t) => CONTINUO.figureOf(nm, phrase.key, t ? phrase.names[t - 1] : null).join("/"));

/** Bach's figures as he wrote them (figures.json's, BCFB) at each quarter's beat, or null where the dataset has none. */
export const writtenFigures = (phrase, figures) => {
  const f = figures && figures[phrase.id];
  return f ? f.figures.map((q) => { const a = q.find((x) => x.at === 0); return a ? CONTINUO.normalFigure(a.f).join("/") : ""; }) : null;
};

/**
 * A realization against Bach's phrase: the share of bass notes his (the pitch; the pitch class), of chords his (the
 * same pitch classes over the same bass class), of inner notes his (the alto's and the tenor's).
 */
export function compare(phrase, real) {
  const n = phrase.satb.length, B = phrase.satb;
  const pcs = (c) => [...new Set(c.map((m) => mod(m - c[3], 12)))].sort((a, b) => a - b).join() + "|" + mod(c[3], 12);
  let bass = 0, bassPc = 0, chords = 0, inner = 0;
  for (let t = 0; t < n; t++) {
    if (real.bass[t] === B[t][3]) bass++;
    if (mod(real.bass[t] - B[t][3], 12) === 0) bassPc++;
    if (real.satb) { if (pcs(real.satb[t]) === pcs(B[t])) chords++; if (real.satb[t][1] === B[t][1]) inner++; if (real.satb[t][2] === B[t][2]) inner++; }
  }
  return { bass: bass / n, bassPc: bassPc / n, chords: real.satb ? chords / n : null, inner: real.satb ? inner / (2 * n) : null };
}

const VOICES = ["soprano", "alto", "tenor", "bass"];
/** The notes to play ({satb, held}): [{voice, midi, on, dur}] in seconds, a quarter `unit` long, the last a fermata. */
export function soundOf(item, { unit = 0.6, fermata = 2 } = {}) {
  const n = item.satb.length, out = [];
  for (let v = 0; v < 4; v++) {
    for (let t = 0; t < n; t++) {
      if (item.held && item.held[t] && item.held[t][v] && out.length && out[out.length - 1].voice === VOICES[v]) { out[out.length - 1].dur += t === n - 1 ? unit * fermata : unit; continue; }
      out.push({ voice: VOICES[v], midi: item.satb[t][v], on: t * unit, dur: t === n - 1 ? unit * fermata : unit });
    }
  }
  return out;
}
export const lengthOf = (item, { unit = 0.6, fermata = 2 } = {}) => (item.satb.length - 1 + fermata) * unit;

// ─── judging at two levels: the quarters as the frame, a voice's eighths as the derivation (#353) ───
const DIM_VOICES = ["soprano", "alto", "tenor", "bass"];
const kn = (k) => String(k).replace("♯", "#").replace("♭", "b");
const quarterNotes = (p, v) => { const out = []; p.satb.forEach((c, t) => { if (t && p.held && p.held[t][v] && out.length) { const o = out[out.length - 1]; o.units++; o.strong.push(!!p.strong[t]); return; }
  out.push({ midi: c[v], ...(p.names ? { name: p.names[t][v] } : {}), units: 1, strong: [!!p.strong[t]], ...(p.keys ? { key: kn(p.keys[t]) } : {}) }); }); return out; };
/**
 * The licence a phrase's eighths give its quarters (fromOuter's `licence`): a dissonance the quarters refuse is let
 * through where a voice's line derives its note (Study 63's derives: resolved on the eighth, passing, neighbour,
 * anticipation, held), and parallel 5ths or octaves where the lines themselves have none (the eighths between them).
 * lines: {soprano, alto, tenor, bass: [[onset in quarters, MIDI, quarters]…]}, onset 0 the phrase's first quarter.
 */
export function licenceOf(lines, satb) {
  return (t, who, why) => {
    if (/parallel/.test(String(why))) {
      if (t < 1) return false;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (parallels(lines[DIM_VOICES[i]], lines[DIM_VOICES[j]], t - 1, t) !== null) return false;
      return true;
    }
    return (who ? [who] : DIM_VOICES).some((v) => derives(lines, t, v, satb[t][DIM_VOICES.indexOf(v)]) !== null);
  };
}
/** bach-4's judgement of a phrase of four voices ({satb, names, held, strong, keys, key, lines?}): the first rule it breaks,
 *  or null — in quarters, or at two levels where it has its eighths (levels: 2, the phrase's `lines`). */
export function judge(p, { levels = 1, lines = p.lines } = {}) {
  const L = lines && Object.fromEntries(Object.entries(lines).map(([v, xs]) => [v, xs.map(([on, m, d]) => [on, m, d])]));
  const ob = fromOuter({ bass: quarterNotes(p, 3), soprano: quarterNotes(p, 0), key: `${kn(p.key.tonic)} ${p.key.mode || "major"}`, ...(levels === 2 && L ? { licence: licenceOf(L, p.satb) } : {}) });
  const code = (v) => p.satb.map((c, t) => (p.names ? ob.code(p.names[t][v], t) : ob.code(c[v], t)));
  return ob.judge({ soprano: code(0), alto: code(1), tenor: code(2) });
}
