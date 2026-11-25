// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 74 · aoidos (ἀοιδός, the singer): a poem sung syllable by syllable (discussion #192), on
// @kairotic/rules (its copy beside this file): solve() writes one voice, a note a syllable, and imitation() tries it as
// the dux of a canon.
//
//   the notes     the text's prosody (prosody.mjs) gives the time: a syllable a note, a short one beat and a long two
//                 (held over the beat: Study 41's tie), a line's last syllable held to the end of its bar; a long
//                 syllable with a circumflex is two notes of a beat each, as Seikilos sings it
//   hard rules    the line's own, as every engine's (Study 42's system, Fux's melodic intervals): within the mode's
//                 ambitus, a start on the final, its 3rd, 4th, 5th or octave, the system's melodic intervals, after a
//                 leap the line turns (from a large one by step), a note struck at most three times in a row, the end
//                 on the final approached by step
//   the accent    Greek's accent was a pitch, and the music that survives follows it: the voice rises to an acute
//                 (acute-rise), the accented syllable is the word's highest (peak), a circumflex falls on its long
//                 syllable (circumflex-fall), after the accent the voice falls (after-accent), after a grave it does
//                 not fall until the next accent (grave), a line ends on the final, its 4th or its 5th (line-end).
//                 Costs, weighed with soft.mjs's melodic ones (the same weights as every engine); `strict` makes the
//                 peak and the circumflex hard rules — what the hymns keep almost always
//   imitable      a melody tried as the dux of cac imitation (canon.mjs): how many comes it has at a distance k and
//                 an entry d — the examiner that says whether it can be sung in canon or in imitation

import { solve, solveVoices, within } from "./rules.mjs";
import { keySystem } from "./systems.mjs";
import { melodicParts, defaultWeights, total, shape } from "./soft.mjs";
import { imitation, canonVoices } from "./canon.mjs";
import { readText, scan, timeOf, scansionText } from "./prosody.mjs";

const sign = (x) => (x > 0) - (x < 0);
const mod = (a, m) => ((a % m) + m) % m;

/** The accent's soft rules, with their weights (data: a page or a style may change them). */
export const PROSODY = [
  { id: "acute-rise", weight: 2, doc: "The voice rises to an acute: its note not higher than the note before costs (the same note, half)." },
  { id: "peak", weight: 2, doc: "The accented syllable is the word's highest: each note of the word above it costs." },
  { id: "circumflex-fall", weight: 3, doc: "A circumflex falls on its long syllable: its second note not lower than its first costs." },
  { id: "after-accent", weight: 1.5, doc: "After the accent the voice falls: the next note not lower costs (the same note, half)." },
  { id: "grave", weight: 1, doc: "After a grave the voice does not fall until the next accent: a lower next note costs." },
  { id: "line-end", weight: 1, doc: "A line ends on the final, its 4th or its 5th." },
  { id: "repeat", weight: 0.5, doc: "A note struck again (a new syllable on the same pitch)." },
];
export const prosodyWeights = () => Object.fromEntries(PROSODY.map((r) => [r.id, r.weight]));

/** Example texts: lines of polytonic Greek, their metre, and a mode (a church mode of tonal.mjs: the final its tonic). */
export const TEXTS = {
  iliad: { name: "Iliad 1.1–2", metre: "hexameter", key: { tonic: "D", mode: "dorian" },
           text: "μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος\nοὐλομένην, ἣ μυρί’ Ἀχαιοῖς ἄλγε’ ἔθηκε" },
  odyssey: { name: "Odyssey 1.1", metre: "hexameter", key: { tonic: "E", mode: "dorian" },
             text: "ἄνδρα μοι ἔννεπε, Μοῦσα, πολύτροπον, ὃς μάλα πολλὰ" },
  seikilos: { name: "Seikilos (the song)", metre: "free", key: { tonic: "E", mode: "dorian" },
              text: "Ὅσον ζῇς φαίνου\nμηδὲν ὅλως σὺ λυποῦ·\nπρὸς ὀλίγον ἐστὶ τὸ ζῆν,\nτὸ τέλος ὁ χρόνος ἀπαιτεῖ." },
  stele: { name: "Seikilos (the distich)", metre: ["hexameter", "pentameter"], key: { tonic: "E", mode: "dorian" },
           text: "Εἰκὼν ἡ λίθος εἰμί· τίθησί με Σείκιλος ἔνθα\nμνήμης ἀθανάτου σῆμα πολυχρόνιον." },
};

/**
 * The notes a text is sung on: its lines read and scanned, each sung syllable a note (a long circumflex two) →
 * {lines [{text, scansion, ok}], notes [{syl, text (the syllable, on the first of its notes), accent ("acute",
 * "grave", "circumflex", "circumflex-tail" or null), word (in the poem), wordStart, wordEnd, line, lineEnd, beats, at,
 * strong}], syllables, error}.
 */
export function plan(text, metre = "hexameter") {
  const L = readText(text), lines = [], notes = [], syllables = [];
  let at = 0, word0 = 0;
  L.forEach((line, li) => {
    const m = Array.isArray(metre) ? metre[li % metre.length] : metre;
    const sc = scan(line, m);
    if (!sc.ok) { lines.push({ text: line.text, metre: m, ok: false }); return; }
    lines.push({ text: line.text, metre: m, ok: true, scansion: scansionText(sc), scansions: sc.all });
    const T = timeOf(line, sc);
    T.forEach((u, i) => {
      const s = syllables.length, wd = word0 + u.word, lineEnd = i === T.length - 1;
      syllables.push({ ...u, word: wd, line: li });
      const base = { syl: s, word: wd, line: li, strong: u.strong, q: u.q };
      if (u.accent === "circumflex" && u.beats >= 2) {
        notes.push({ ...base, text: u.text, accent: "circumflex", beats: 1, at: at + u.at, wordStart: u.first, wordEnd: false, lineEnd: false });
        notes.push({ ...base, text: "", accent: "circumflex-tail", beats: u.beats - 1, at: at + u.at + 1, strong: false, wordStart: false, wordEnd: u.last, lineEnd });
      } else notes.push({ ...base, text: u.text, accent: u.accent, beats: u.beats, at: at + u.at, wordStart: u.first, wordEnd: u.last, lineEnd });
    });
    at += T.reduce((a, u) => a + u.beats, 0);
    word0 += line.words.length;
  });
  const bad = lines.filter((l) => !l.ok);
  return { lines, notes, syllables, beats: at, error: bad.length ? `does not scan as ${bad[0].metre}: ${bad[0].text}` : null };
}

/**
 * A melody for a text: spec {text, metre ("hexameter", "pentameter", "iambic-trimeter", "free"; a list: one a line,
 * in turn), key ({tonic, mode}: a church mode, its tonic the final; ficta off: the mode's own scale), ambitus ([lo, hi]
 * in degrees from the final, [-1, 8]), starts (degrees, [0, 2, 3, 4, 7]), strict (the peak and the circumflex hard),
 * maxRepeat (3), weights (the melodic and the accent's)} → solve()'s count, sample, engine, judge, fan, why, and the
 * plan (notes, lines), the system, names, midi, hz.
 */
export function aoidos(spec = {}) {
  const P = plan(spec.text, spec.metre || "hexameter");
  const key = spec.key || { tonic: "E", mode: "dorian" };
  const S = keySystem(key, { ficta: false }), deg = S.deg;
  const [lo, hi] = spec.ambitus || [-1, 8];
  const starts = spec.starts || [0, 2, 3, 4, 7];
  const finals = [0, 7].filter((f) => f >= lo && f <= hi);
  const maxRepeat = spec.maxRepeat ?? 3, strict = !!spec.strict;
  const W = { ...defaultWeights(), ...prosodyWeights(), ...(spec.weights || {}) };
  const N = P.notes, n = N.length;
  // (where each note's word begins, and its accented note: the peak)
  const wordFrom = N.map((x, t) => { let j = t; while (j > 0 && N[j - 1].word === x.word) j--; return j; });
  const peakOf = N.map((x, t) => { let j = wordFrom[t]; while (j < n && N[j].word === x.word) { if (N[j].accent === "acute" || N[j].accent === "circumflex") return j; j++; } return -1; });
  const wordLen = Math.max(1, ...N.map((x, t) => t - wordFrom[t] + 1));
  const codes = S.codesIn(lo, hi);

  // ─── the hard rules (each with how far back it looks) ───
  const rules = [
    { id: "start", lookback: 0, check: ({ t, d }) => (t === 0 && !starts.includes(d) ? "the melody starts on the final, its 3rd, 4th, 5th or octave" : null) },
    { id: "melodic", lookback: 1, check: ({ U, t, c }) => (t >= 1 ? S.melodicError(U[t - 1], c) : null) },
    { id: "leap-recovery", lookback: maxRepeat + 1, check: ({ U, t, d }) => {
      if (t < 2) return null;
      const prev = U[t - 1]; let j = t - 1; while (j >= 1 && U[j - 1] === prev) j--;
      if (j < 1 || d === deg(prev)) return null;
      const m = deg(prev) - deg(U[j - 1]), s = d - deg(prev);
      if (Math.abs(m) >= S.leaps.large && s !== -sign(m)) return `after a leap of a ${S.intervalName(Math.abs(m))}, a step ${m > 0 ? "down" : "up"}`;
      if (Math.abs(m) >= S.leaps.small && Math.abs(m) < S.leaps.large && sign(s) !== -sign(m)) return `after the leap of a ${S.intervalName(Math.abs(m))} the line turns ${m > 0 ? "down" : "up"}`;
      return null;
    } },
    { id: "repeat", lookback: maxRepeat, check: ({ U, t, c }) => (t >= maxRepeat && U.slice(t - maxRepeat, t).every((y) => y === c) ? `a note struck ${maxRepeat + 1} times in a row` : null) },
    { id: "final", lookback: 0, check: ({ t, d }) => (t === n - 1 && !finals.includes(d) ? "the melody ends on the final" : null) },
    { id: "approach", lookback: 0, check: ({ t, d }) => (t === n - 2 && !finals.some((f) => Math.abs(d - f) === 1) ? "the final is approached by step" : null) },
  ];
  if (strict) rules.push(
    { id: "circumflex", lookback: 1, check: ({ U, t, d, x }) => (x.accent === "circumflex-tail" && !(d < deg(U[t - 1])) ? "a circumflex falls on its syllable" : null) },
    { id: "peak", lookback: wordLen - 1, check: ({ U, t, d }) => {
      const p = peakOf[t], f = wordFrom[t];
      if (p < 0) return null;
      if (t === p) { for (let j = f; j < t; j++) if (deg(U[j]) > d) return "the accented syllable is the word's highest"; return null; }
      if (t > p && d > deg(U[p])) return "the accented syllable is the word's highest";
      return null;
    } });

  // ─── the soft rules: the line's shape (soft.mjs) and the accent ───
  const soft = [
    { id: "melodic", cost: ({ U, t, d }) => {
      if (t >= 1 && deg(U[t - 1]) === d) return { repeat: W.repeat };
      return melodicParts(U.map(deg), d, W);
    } },
    { id: "accent", cost: ({ U, t, d, x }) => {
      const parts = {}, prev = t >= 1 ? deg(U[t - 1]) : null;
      if (x.accent === "acute" && prev !== null) { if (d < prev) parts["acute-rise"] = W["acute-rise"]; else if (d === prev) parts["acute-rise"] = W["acute-rise"] / 2; }
      if (!strict && x.accent === "circumflex-tail" && d >= prev) parts["circumflex-fall"] = W["circumflex-fall"];
      const p = peakOf[t], f = wordFrom[t];
      if (!strict && p >= 0) {
        if (t === p) { const above = U.slice(f, t).filter((y) => deg(y) > d).length; if (above) parts.peak = above * W.peak; }
        else if (t > p && d > deg(U[p])) parts.peak = W.peak;
      }
      // (after the accent: the next note; a circumflex's tail is already its fall)
      if (t >= 1) {
        const a = N[t - 1];
        if ((a.accent === "acute" || a.accent === "circumflex-tail") && x.accent !== "acute" && x.accent !== "circumflex") {
          if (d > prev) parts["after-accent"] = W["after-accent"]; else if (d === prev && a.accent === "acute") parts["after-accent"] = W["after-accent"] / 2;
        }
        if (a.accent === "grave" && d < prev) parts.grave = W.grave;
      }
      if (x.lineEnd && t < n - 1 && ![0, 3, 4].includes(mod(d, 7))) parts["line-end"] = W["line-end"];
      return parts;
    } },
  ];
  const at = (U, t, c) => ({ U, t, c, d: deg(c), x: N[t] });
  const window = Math.max(1, maxRepeat + 1, strict ? wordLen : 1);
  const core = solve({ n, codes, at, rules, soft, window, name: (c) => S.pitchName(c) });
  const name = (c) => S.pitchName(c);
  return {
    ...core, plan: P, notes: N, S, key, deg, name, midi: (c) => S.midi(c), hz: (c) => S.hz(c), strict, weights: W, error: P.error,
    // (the note's own rules, for canonic(): the accent's hard ones when strict, and the soft costs)
    own: { strictRules: strict ? rules.slice(-2) : [], soft, wordFrom, peakOf, wordLen, finals, starts, lo, hi },
    count: (U = []) => (P.error || !n ? 0n : core.count(U)),
    countWithin: (ms, U = []) => { if (P.error || !n) return 0n; try { return within(ms, () => core.count(U)); } catch (e) { if (e.tooLong) return null; throw e; } },
    /** How a melody keeps the accent: for each rule, the notes where it holds and where it could hold. */
    accentReport: (U) => accentReport(N, U.map(deg), peakOf, wordFrom),
    shape: (U) => shape([U.map(deg)]),
    /** The melody as notes for cac imitation (a note's units its beats), with a rest before it if it starts on a weak
     *  beat (the strong beats on the even units, as imitation reads them). */
    asDux: (U) => duxOf(N, U, (c) => S.midi(c)),
  };
}

/**
 * The poem sung in canon (#192 as it was first thought: the singer choosing among the futuribles of the comes): the
 * dux sings the text — a beat a unit, a new syllable a new note, a long one held — and the comes answers it by
 * canon.mjs's rules (canon-2: the comes k steps away, d beats later, at a degree of imitation), the two counted
 * together. spec: aoidos()'s, and k (−7), d (4 beats: a foot; at 2 a long note held against the comes's move leaves a dissonance that does not pass), imitation (1: a canon; 0.6 near; 0.3 by motion), invert
 * (invertible counterpoint at the octave [8], the 10th, the 12th). The dux's own rules are canon-2's (range, start,
 * melodic intervals, leap recovery; the final approached by step, read on the notes struck), with the text's rhythm
 * and, strict, the accent's; its costs aoidos's. → solveVoices's count, sample, engine (→ {dux, comes} a code a beat),
 * fan, judge; notes (the plan), beats, and the comes as names.
 */
export function canonic(spec = {}) {
  const A = aoidos(spec);
  const N = A.notes, n = A.plan.beats, deg = A.deg, own = A.own;
  // (beat → the note sounding, and whether it is struck there)
  const noteAt = [], struck = [];
  N.forEach((x, i) => { for (let j = 0; j < x.beats; j++) { noteAt.push(i); struck.push(j === 0); } });
  const firstStrong = N.find((x) => x.strong), phase = firstStrong ? firstStrong.at % 2 : 0;
  const maxHold = Math.max(2, ...N.map((x) => x.beats));
  const k = spec.k ?? -7, d = Math.min(spec.d ?? 4, Math.max(1, n - 1));
  const cspec = { key: A.key, ficta: false, tonic: 0, k, d, b: 2, phase, n, lo: own.lo, hi: own.hi, imitation: spec.imitation ?? 1, maxHold,
                  invert: spec.invert || [], starts: own.starts, soft: true, weights: A.weights, on: { approach: false } };
  const CV = canonVoices(cspec, spec.style || "canon-2");
  if (A.error || !n) return { error: A.error || "no text", count: () => 0n, countWithin: () => 0n, notes: N, beats: n };
  // the dux's notes struck before beat t (the melody as aoidos reads it), and the note at t
  const notesOf = (D, t) => { const out = []; for (let j = 0; j < t; j++) if (struck[j]) out.push(D[j]); return out; };
  const lastNote = N.length - 1;
  const duxCheck = (D, t, x) => {
    if (t >= n) return "the work is finished";
    if (t >= 1 && struck[t] && x === D[t - 1]) return "a new syllable, a new note";
    if (!struck[t] && x !== D[t - 1]) return "the syllable is held";
    if (struck[t]) {
      const U = notesOf(D, t), i = noteAt[t], c = { U, t: i, c: x, d: deg(x), x: N[i] };
      if (i === lastNote && U.length && !own.finals.some((f) => deg(x) === f && Math.abs(deg(U[U.length - 1]) - f) === 1)) return "the final is approached by step";
      for (const r of own.strictRules) { const e = r.check(c); if (e) return e; }
    }
    return CV.voices[0].solver.check(D, t, x);
  };
  const duxCost = (D, x) => {
    const t = D.length;
    if (t >= n || !struck[t]) return {};
    const U = notesOf(D, t), i = noteAt[t], c = { U, t: i, c: x, d: deg(x), x: N[i] };
    return Object.assign({}, ...own.soft.map((s) => s.cost(c)));
  };
  const duxSolver = { codes: CV.voices[0].solver.codes.filter((c) => c !== null), check: duxCheck, costParts: duxCost };
  // the memo: as the canon's, and as far back as a word (the accent's peak) when strict
  const w = CV.world, aug = w.aug;
  const wordBeats = Math.max(...N.map((x, i) => x.at + x.beats - N[own.wordFrom[i]].at));
  const LD = Math.max(maxHold + 1, 2, d + 1, A.strict ? wordBeats + 1 : 0, 3), LC = Math.max(maxHold * aug + 1, 2);
  const key = (W, t) => t + ":" + W[0].slice(Math.max(0, t - LD), t).join(",") + ":" + W[1].slice(Math.max(0, t - LC), t).join(",");
  const SV = solveVoices({ n, voices: [{ name: "dux", solver: duxSolver }, { name: "comes", solver: CV.voices[1].solver }],
                           between: CV.between, key, result: (W) => ({ dux: W[0], comes: W[1] }) });
  return { ...SV, A, notes: N, beats: n, k, d, phase, world: w, struck, noteAt, name: A.name, midi: A.midi, hz: A.hz, key: A.key,
           count: () => SV.count(),
           countWithin: (ms) => { try { return within(ms, () => SV.count()); } catch (e) { if (e.tooLong) return null; throw e; } },
           judge: (D, C) => SV.judgeW([D, C], `the voices are not ${n} beats long`),
           /** the dux as aoidos's notes (a code a note) */
           melody: (D) => D.filter((c, t) => struck[t]) };
}

/** A melody's notes [{midi, units}] for imitation(): a beat a unit; a rest first where the first strong beat is odd. */
export function duxOf(N, U, midi) {
  const firstStrong = N.find((x) => x.strong);
  const pad = firstStrong && firstStrong.at % 2 === 1 ? [{ midi: null, units: 1 }] : [];
  return [...pad, ...N.map((x, t) => ({ midi: midi(U[t]), units: x.beats }))];
}

/** How a melody (degrees D) keeps the accent rules: {rule: [kept, where it applies]}. */
export function accentReport(N, D, peakOf, wordFrom) {
  const r = { "acute-rise": [0, 0], peak: [0, 0], "circumflex-fall": [0, 0], "after-accent": [0, 0] };
  N.forEach((x, t) => {
    if (x.accent === "acute" && t >= 1) { r["acute-rise"][1]++; if (D[t] > D[t - 1]) r["acute-rise"][0]++; }
    if (x.accent === "circumflex-tail") { r["circumflex-fall"][1]++; if (D[t] < D[t - 1]) r["circumflex-fall"][0]++; }
    if ((x.accent === "acute" || x.accent === "circumflex") && peakOf[t] === t) {
      let j = wordFrom[t], ok = true; const w = x.word;
      for (; j < N.length && N[j].word === w; j++) if (j !== t && D[j] > D[t]) ok = false;
      r.peak[1]++; if (ok) r.peak[0]++;
    }
    if (t >= 1 && (N[t - 1].accent === "acute" || N[t - 1].accent === "circumflex-tail") && x.accent !== "acute" && x.accent !== "circumflex") {
      r["after-accent"][1]++; if (D[t] < D[t - 1]) r["after-accent"][0]++;
    }
  });
  return r;
}

/**
 * The examiner: a melody tried as the dux of cac imitation at each distance k (steps: −7 an octave below, −4 a 5th,
 * −3 a 4th, 7 an octave above…) and entry d (beats), at a degree of imitation (1 a canon, 0.6 near) → [{k, d,
 * imitation, comes (how many, or null: too long to count in ms), engine (one comes the engine chose, as names)}],
 * the best first.
 */
export function examine(A, U, { ks = [-7, -4, -3, 7], ds = [2, 4], degrees = [1], ms = 1500, b = 2 } = {}) {
  const notes = A.asDux(U);
  const maxHold = Math.max(2, ...runs(notes));
  const out = [];
  for (const imitationDegree of degrees) for (const k of ks) for (const d of ds) {
    const I = imitation({ notes, key: A.key, k, d, b, imitation: imitationDegree, maxHold });
    const comes = I.unknown && I.unknown.length ? 0n : I.countWithin(ms);
    let engine = null;
    if (comes) { const C = I.engine({ temp: 0 }); if (C) engine = (C.comes || C[1]).map((c) => (c === null ? null : I.spell(c))); }
    out.push({ k, d, imitation: imitationDegree, comes, engine });
  }
  // (those with a comes first, the most first; then those too long to count; then those with none)
  const rank = (x) => (x.comes === null ? 1 : x.comes > 0n ? 2 : 0);
  return out.sort((x, y) => rank(y) - rank(x) || ((y.comes ?? 0n) > (x.comes ?? 0n) ? 1 : (y.comes ?? 0n) < (x.comes ?? 0n) ? -1 : 0));
}

// (the longest run of one pitch in units: a held note and the same note struck again read alike in a canon)
function runs(notes) {
  const out = []; let cur = null, len = 0;
  for (const x of notes) { if (x.midi === cur) len += x.units; else { if (len) out.push(len); cur = x.midi; len = x.units; } }
  if (len) out.push(len);
  return out;
}

export default { aoidos, plan, examine, accentReport, duxOf, PROSODY, TEXTS, prosodyWeights };
