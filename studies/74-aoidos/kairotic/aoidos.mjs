// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 74 · aoidos (ἀοιδός, the singer): a poem sung syllable by syllable (discussion #192), on
// @kairotic/rules (its copy beside this file): solve() writes one voice, a beat at a time, and imitation() tries it as
// the dux of a canon.
//
//   the time      the text's prosody (prosody.mjs): a short syllable a beat, a long one two, a line's last syllable to
//                 the end of its bar — or, in Seikilos's metre, every line twelve chronoi, filled as the stele fills
//                 them. The melody is written a beat at a time: at a syllable's first beat a note is struck (the same
//                 pitch again is struck again); within the syllable it is held or moves on — a melisma, up to
//                 `melisma` notes a syllable (Seikilos sings φαί on three)
//   hard rules    the line's own, as every engine's (Study 42's system, Fux's melodic intervals): within the mode's
//                 ambitus, a start on the final, its 3rd, 4th, 5th or octave, the system's melodic intervals, after a
//                 leap the line turns (from a large one by step), a note struck at most three times in a row, a
//                 melisma moving by step or a 3rd, the end on the final approached by step
//   the accent    Greek's accent was a pitch, and the music that survives follows it: the voice rises to an acute
//                 (acute-rise: the syllable's highest note above the note before), the accented syllable holds the
//                 word's highest note (peak), a circumflex falls within its syllable (circumflex-fall: on one note it
//                 costs half), after the accent the voice falls (after-accent), after a grave it does not fall
//                 (grave), a melisma costs a little (melisma), a line ends on the final, its 4th or its 5th
//                 (line-end). Costs, weighed with soft.mjs's melodic ones (the same weights as every engine); `strict`
//                 makes the peak and the circumflex (never rising) hard — what the hymns keep almost always
//   imitable      a melody tried as the dux of cac imitation (canon.mjs): how many comes it has at a distance k and
//                 an entry d — the examiner that says whether it can be sung in canon or in imitation

import { solveVoices, within } from "./rules.mjs";
import { keySystem } from "./systems.mjs";
import { melodicParts, defaultWeights, total, shape } from "./soft.mjs";
import { imitation, canonVoices } from "./canon.mjs";
import { readText, scan, timeOf, scansionText } from "./prosody.mjs";
import { codeOf3 } from "./tonal.mjs";
import { greekSystem } from "./greek.mjs";

const sign = (x) => (x > 0) - (x < 0);
const mod = (a, m) => ((a % m) + m) % m;

/** The accent's soft rules, with their weights (data: a page or a style may change them). */
export const PROSODY = [
  { id: "acute-rise", weight: 2, doc: "The voice rises to an acute: the syllable's highest note not above the note before costs (the same, half)." },
  { id: "peak", weight: 2, doc: "The accented syllable holds the word's highest note: each note of the word above it costs." },
  { id: "circumflex-fall", weight: 3, doc: "A circumflex falls within its syllable: rising costs, ending not lower than it began costs; sung on one note, half." },
  { id: "after-accent", weight: 1.5, doc: "After the accent the voice falls: the next syllable's first note not lower costs (the same, half)." },
  { id: "grave", weight: 1, doc: "After a grave the voice does not fall: a lower next note costs." },
  { id: "melisma", weight: 1, doc: "A syllable sung on more than one note: each note more (a circumflex's fall is free)." },
  { id: "line-end", weight: 1, doc: "A line ends on the final, its 4th or its 5th." },
  { id: "repeat", weight: 0.5, doc: "A note struck again (a new syllable on the same pitch)." },
];
export const prosodyWeights = () => Object.fromEntries(PROSODY.map((r) => [r.id, r.weight]));

/**
 * The Greek style: the weights under which what survives is most likely — Mesomedes's reliable lines and Athenaios's
 * Delphic paean, read in the Greek system (greek.mjs: the Lydian and the Hyperdorian, diatonic and chromatic; style.mjs's
 * fit, 530 choices) —, a note struck up to eight times in a row (a recitation tone), and no turn asked after a 4th or a
 * 5th (Fux's; the hymns go on). Fitted once and kept here as data: tests/style.mjs fits it again.
 */
export const GREEK = {
  name: "greek", from: "Mesomedes, DAGM nos. 24, 25, 27.7–12 (the reliable lines); Athenaios, DAGM no. 20", maxRepeat: 8, turnAfterSmallLeap: false,
  // (every rule of soft.mjs and the accent's not listed keeps the engine's weight: none of the corpus's choices weighs it)
  weights: { "acute-rise": 1.77, "after-accent": 0.7, "circumflex-fall": 2.16, "climax": 0, "contrary-after-leap": 1.03, "grave": 1.67, "hover": 0, "leap-after-leap": 0, "leap-size": 3.62, "line-end": 1.18, "melisma": 3.08, "memory": 0, "novelty": 0, "open": 0.68, "peak": 2.27, "repeat": 0, "return": 0, "run": 1.24, "sequence": 0.89, "step-back": 0 },
};

/** Example texts: lines of polytonic Greek, their metre, and a mode (a church mode of tonal.mjs: the final its tonic);
 *  Seikilos's, the Greek system of his stele too (the Iastian, its final the lichanos meson e). */
export const TEXTS = {
  iliad: { name: "Iliad 1.1–2", metre: "hexameter", key: { tonic: "D", mode: "dorian" },
           text: "μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος\nοὐλομένην, ἣ μυρί’ Ἀχαιοῖς ἄλγε’ ἔθηκε" },
  odyssey: { name: "Odyssey 1.1", metre: "hexameter", key: { tonic: "E", mode: "dorian" },
             text: "ἄνδρα μοι ἔννεπε, Μοῦσα, πολύτροπον, ὃς μάλα πολλὰ" },
  // (λῡποῦ: the υ of λύπη long, marked — the prosody cannot know it)
  seikilos: { name: "Seikilos (the song)", metre: "seikilos", key: { tonic: "E", mode: "dorian" }, system: { tonos: "iastian", genera: ["diatonic"] }, final: -1,
              text: "Ὅσον ζῇς φαίνου\nμηδὲν ὅλως σὺ λῡποῦ·\nπρὸς ὀλίγον ἐστὶ τὸ ζῆν,\nτὸ τέλος ὁ χρόνος ἀπαιτεῖ." },
  stele: { name: "Seikilos (the distich)", metre: ["hexameter", "pentameter"], key: { tonic: "E", mode: "dorian" }, system: { tonos: "iastian", genera: ["diatonic"] }, final: -1,
           text: "Εἰκὼν ἡ λίθος εἰμί· τίθησί με Σείκιλος ἔνθα\nμνήμης ἀθανάτου σῆμα πολυχρόνιον." },
};

/**
 * The time a text is sung in: its lines read and scanned → {lines [{text, metre, ok, scansion}], syllables [{text,
 * accent, word (in the poem), line, first/last (in its word), lineEnd, q, beats, at, strong}], beats, sylAt (a beat's
 * syllable), error}.
 */
export function plan(text, metre = "hexameter") {
  const L = readText(text), lines = [], syllables = [];
  let at = 0, word0 = 0;
  L.forEach((line, li) => {
    const m = Array.isArray(metre) ? metre[li % metre.length] : metre;
    const sc = scan(line, m);
    if (!sc.ok) { lines.push({ text: line.text, metre: m, ok: false }); return; }
    lines.push({ text: line.text, metre: m, ok: true, scansion: scansionText(sc), scansions: sc.all });
    const T = timeOf(line, sc);
    T.forEach((u, i) => syllables.push({ ...u, word: word0 + u.word, line: li, lineEnd: i === T.length - 1, at: at + u.at }));
    at += T.reduce((a, u) => a + u.beats, 0);
    word0 += line.words.length;
  });
  const sylAt = []; syllables.forEach((s, i) => { for (let j = 0; j < s.beats; j++) sylAt.push(i); });
  const bad = lines.filter((l) => !l.ok);
  return { lines, syllables, beats: at, sylAt, error: bad.length ? `does not scan as ${bad[0].metre}: ${bad[0].text}` : null };
}

/**
 * How a sung text keeps the accent rules, syllable by syllable: syllables [{accent, word, line}] and the pitches of
 * each ([[pitch…]…], a melisma several) → {rule: [kept, where it applies, [the syllables where it is not kept]]}:
 *   acute-rise       an acute's highest note above the note before
 *   peak             the accented syllable (acute, circumflex) holds the word's highest note
 *   circumflex-fall  a circumflex's syllable ends lower than it begins (sung on one note: not kept)
 *   after-accent     after an acute or a circumflex (the next syllable not accented) the next note is lower
 *   grave            after a grave the next note is not lower
 * (the last two within a line).
 */
export function judgeAccent(syllables, pitches) {
  const r = { "acute-rise": [0, 0, []], peak: [0, 0, []], "circumflex-fall": [0, 0, []], "after-accent": [0, 0, []], grave: [0, 0, []] };
  const count = (id, ok, i) => { r[id][1]++; if (ok) r[id][0]++; else r[id][2].push(i); };
  const last = (i) => pitches[i][pitches[i].length - 1], first = (i) => pitches[i][0];
  syllables.forEach((s, i) => {
    if (s.accent === "acute" && i >= 1) count("acute-rise", Math.max(...pitches[i]) > last(i - 1), i);
    if (s.accent === "acute" || s.accent === "circumflex") {
      const top = Math.max(...pitches[i]);
      const word = syllables.map((t, j) => j).filter((j) => syllables[j].word === s.word);
      count("peak", word.every((j) => j === i || Math.max(...pitches[j]) <= top), i);
    }
    if (s.accent === "circumflex") count("circumflex-fall", last(i) < first(i), i);
    const next = syllables[i + 1];
    if (next && next.line === s.line && (s.accent === "acute" || s.accent === "circumflex") && next.accent !== "acute" && next.accent !== "circumflex")
      count("after-accent", first(i + 1) < last(i), i);
    if (next && next.line === s.line && s.accent === "grave") count("grave", first(i + 1) >= last(i), i);
  });
  return r;
}

/**
 * The time given instead of read: syllables [{text, accent, word, line, first, last, lineEnd, beats}] (a corpus's, as
 * corpus.mjs reads it) → plan()'s shape, a long syllable one of two beats or more (the strong ones).
 */
export function planFromTime(syls) {
  let at = 0;
  const syllables = syls.map((y) => { const r = { text: y.text, accent: y.accent ?? null, word: y.word, line: y.line, first: y.first, last: y.last,
                                                  lineEnd: y.lineEnd, beats: y.beats, q: y.beats >= 2 ? "long" : "short", strong: y.beats >= 2, at }; at += y.beats; return r; });
  const sylAt = []; syllables.forEach((s, i) => { for (let j = 0; j < s.beats; j++) sylAt.push(i); });
  const lines = [...new Set(syllables.map((y) => y.line))].map((li) => ({ text: syllables.filter((y) => y.line === li).map((y) => y.text).join(" "), ok: true, scansion: "" }));
  return { lines, syllables, beats: at, sylAt, error: null };
}

/**
 * A Greek system (greek.mjs) with its degrees counted from a final (a degree of the system: 0 the mese, −1 the lichanos
 * meson…), as aoidos counts a church mode's from its tonic: the same answers, deg, at and codesIn moved.
 */
export function fromFinal(G, final = 0) {
  return { ...G, final, base: G, deg: (c) => G.deg(c) - final, at: (d) => G.at(d + final), codesIn: (lo, hi) => G.codesIn(lo + final, hi + final) };
}

/**
 * A melody for a text: spec {text, metre ("hexameter", "pentameter", "iambic-trimeter", "free", "seikilos"; a list:
 * one a line, in turn), key ({tonic, mode}: a church mode, its tonic the final; ficta off: the mode's own scale) or
 * system (a Greek one: greekSystem's spec {tonos, genera, synemmenon, shade} or the system itself) and final (its
 * degree the melody ends on, 0 the mese; the ambitus and the starts counted from it),
 * ambitus ([lo, hi] in degrees from the final, [-1, 8]), starts (degrees, [0, 2, 3, 4, 7]), melisma (the most notes a
 * syllable, 3; 1: a note a syllable), strict (the peak and the circumflex hard), maxRepeat (3), chromatic (altered
 * notes allowed: [[degree, alteration]…]), time (the syllables and their beats given: planFromTime), open (a fragment:
 * neither its start nor its end the melody's), weights (the melodic and the accent's)} → solve()'s count, sample, engine, judge, fan, why (a code a beat), and the plan, the system,
 * names, midi, hz; notesOf (a melody's notes: [{code, at, beats, syl}]), lyricNotesOf (with the text they sing),
 * pitchesOf (each syllable's pitches),
 * accentReport, asDux.
 */
export function aoidos(spec = {}) {
  const P = spec.time ? planFromTime(spec.time) : plan(spec.text, spec.metre || "hexameter");
  // (the pitch system: a church mode of 12-TET, or a Greek one — greek.mjs's, its degrees counted from the final)
  const G = spec.system ? (spec.system.greek ? spec.system : greekSystem(spec.system)) : null;
  const key = G ? null : spec.key || { tonic: "E", mode: "dorian" };
  const S = G ? fromFinal(G, spec.final ?? 0) : keySystem(key, { ficta: false }), deg = S.deg;
  // (how high a note is, for the accent's rises and falls: its degree in a church mode; in a Greek system its pitch,
  // since two notes may share a place — the chromatic and the diatonic lichanos)
  const h = G ? (c) => S.cents(c) : deg;
  const [lo, hi] = spec.ambitus || [-1, 8];
  const starts = spec.starts || [0, 2, 3, 4, 7];
  const finals = [0, 7].filter((f) => f >= lo && f <= hi);
  // (a style: weights, and its own way with repeated notes and small leaps — GREEK, learned from Mesomedes)
  const style = spec.style === "greek" ? GREEK : spec.style && typeof spec.style === "object" ? spec.style : {};
  const maxRepeat = spec.maxRepeat ?? style.maxRepeat ?? 3, strict = !!spec.strict, maxNotes = Math.max(1, spec.melisma ?? 3);
  const turnSmall = spec.turnAfterSmallLeap ?? style.turnAfterSmallLeap ?? true;
  const W = { ...defaultWeights(), ...prosodyWeights(), ...(style.weights || {}), ...(spec.weights || {}) };
  const Y = P.syllables, n = P.beats, sylAt = P.sylAt;
  const startOf = (s) => Y[s].at, isStart = (t) => t === Y[sylAt[t]].at, isEnd = (t) => t === Y[sylAt[t]].at + Y[sylAt[t]].beats - 1;
  // (each syllable's word: where it begins, and its accented syllable — the peak)
  const wordFrom = Y.map((x, i) => { let j = i; while (j > 0 && Y[j - 1].word === x.word) j--; return j; });
  const peakOf = Y.map((x, i) => { for (let j = wordFrom[i]; j < Y.length && Y[j].word === x.word; j++) if (Y[j].accent === "acute" || Y[j].accent === "circumflex") return j; return -1; });
  const maxSyl = Math.max(1, ...Y.map((y) => y.beats));
  const wordBeats = Math.max(1, ...Y.map((y, i) => y.at + y.beats - Y[wordFrom[i]].at));
  // (the mode's own notes, and the altered ones asked for — chromatic: [[degree, alteration]…], as Mesomedes's c♯')
  const codes = [...S.codesIn(lo, hi)];
  if (!G) for (const [d0, a] of spec.chromatic || []) for (let d = d0 - 21; d <= d0 + 21; d += 7) if (d >= lo && d <= hi) codes.push(codeOf3(d, a));
  const struckAt = (U, t) => t === 0 || isStart(t) || U[t] !== U[t - 1];
  /** A syllable's pitches (their heights: degrees, or cents) as written up to beat t (exclusive), and c at t if given. */
  const sylNotes = (U, s, t, c) => {
    const out = [], a = startOf(s);
    for (let j = a; j < t; j++) if (j === a || U[j] !== U[j - 1]) out.push(h(U[j]));
    if (c !== undefined && (t === a || c !== U[t - 1])) out.push(h(c));
    return out;
  };

  // ─── the hard rules ───
  const rules = [
    { id: "start", check: ({ t, d }) => (t === 0 && !starts.includes(d) ? "the melody starts on the final, its 3rd, 4th, 5th or octave" : null) },
    { id: "melodic", check: ({ U, t, c, struck }) => (struck && t >= 1 ? S.melodicError(U[t - 1], c) : null) },
    { id: "melisma", check: ({ U, t, c, struck }) => {
      if (!struck || isStart(t)) return null;
      // (in a Greek system by size: a chromatic paranete to the mese is three places but a major 3rd)
      if (G ? Math.abs(h(c) - h(U[t - 1])) > 420 : Math.abs(deg(c) - deg(U[t - 1])) > 2) return "a melisma moves by step or a 3rd";
      const s = sylAt[t], k = sylNotes(U, s, t, c).length;
      const most = Y[s].accent === "circumflex" ? Math.max(2, maxNotes) : maxNotes;
      return k > most ? (most === 1 ? "a note a syllable" : `${most} notes a syllable at most`) : null;
    } },
    { id: "leap-recovery", check: ({ U, t, d, struck }) => {
      if (!struck || t < 2) return null;
      const prev = U[t - 1]; let j = t - 1; while (j >= 1 && U[j - 1] === prev) j--;
      if (j < 1 || d === deg(prev)) return null;
      const m = deg(prev) - deg(U[j - 1]), s = d - deg(prev);
      if (Math.abs(m) >= S.leaps.large && s !== -sign(m)) return `after a leap of a ${S.intervalName(Math.abs(m))}, a step ${m > 0 ? "down" : "up"}`;
      if (turnSmall && Math.abs(m) >= S.leaps.small && Math.abs(m) < S.leaps.large && sign(s) !== -sign(m)) return `after the leap of a ${S.intervalName(Math.abs(m))} the line turns ${m > 0 ? "down" : "up"}`;
      return null;
    } },
    { id: "repeat", check: ({ U, t, c }) => {
      if (!isStart(t) || t < 1 || U[t - 1] !== c) return null;
      let k = 1, j = t - 1; while (j >= 0 && U[j] === c) { if (isStart(j) || j === 0) k++; j--; }
      return k > maxRepeat ? `a note struck ${maxRepeat + 1} times in a row` : null;
    } },
    { id: "final", check: ({ U, t, c, d }) => {
      if (t !== n - 1) return null;
      if (!finals.includes(d)) return "the melody ends on the final";
      let j = t; while (j > 0 && (j === t ? c : U[j]) === U[j - 1]) j--;
      return j > 0 && Math.abs(deg(U[j - 1]) - d) === 1 ? null : "the final is approached by step";
    } },
  ].filter((r) => !spec.open || (r.id !== "start" && r.id !== "final"));
  if (strict) rules.push(
    { id: "circumflex", check: ({ U, t, c, struck }) => (struck && !isStart(t) && Y[sylAt[t]].accent === "circumflex" && h(c) > h(U[t - 1]) ? "a circumflex does not rise" : null) },
    { id: "peak", check: ({ U, t, c, d, struck }) => {
      const s = sylAt[t], p = peakOf[s];
      if (p < 0) return null;
      if (s > p && struck && h(c) > Math.max(...sylNotes(U, p, startOf(p) + Y[p].beats))) return "the accented syllable holds the word's highest note";
      if (s === p && isEnd(t)) {
        const top = Math.max(...sylNotes(U, s, t, c));
        for (let j = startOf(wordFrom[s]); j < startOf(s); j++) if (h(U[j]) > top) return "the accented syllable holds the word's highest note";
      }
      return null;
    } });
  // the memo's key: what the rules read of the past — the syllable's notes so far, the pitch sounding, the pitch before
  // it and how many syllables have struck the one sounding (a leap turned, a note struck again, the final's
  // approach), and, strict, the word's highest note before its accent or the accent's own: two pasts the same there
  // have the same futures
  const runOf = (U, t) => { let j = t - 1; while (j >= 1 && U[j - 1] === U[t - 1]) j--; return j; };
  const memoKey = (U, t) => {
    if (t === 0 || t >= n) return String(t);
    const s = sylAt[t], a = startOf(s), j = runOf(U, t);
    let k = 0; for (let i = j; i < t; i++) if (i === 0 || isStart(i)) k++;
    let wi = "";
    if (strict) {
      const p = peakOf[s];
      if (p >= 0 && s > p) wi = Math.max(...sylNotes(U, p, startOf(p) + Y[p].beats));
      else if (p >= 0) { let m = -1e9; for (let i = startOf(wordFrom[s]); i < Math.min(t, startOf(p)); i++) m = Math.max(m, h(U[i])); wi = "<" + m; }
    }
    return t + "|" + U.slice(a, t).join(",") + "|" + U[t - 1] + "|" + (j >= 1 ? U[j - 1] : "") + "|" + Math.min(k, maxRepeat + 1) + "|" + wi;
  };

  // ─── the soft rules: the line's shape (soft.mjs) and the accent, a syllable's cost as it grows ───
  const pen = (U, s, ps, final, lastCode) => {
    const y = Y[s], parts = {}, k = ps.length;
    if (!k) return parts;
    const top = Math.max(...ps), first = ps[0], last = ps[k - 1];
    const before = y.at >= 1 ? h(U[y.at - 1]) : null, prevSyl = s >= 1 && Y[s - 1].line === y.line ? Y[s - 1] : null;
    if (y.accent === "acute" && before !== null) { if (top < before) parts["acute-rise"] = W["acute-rise"]; else if (top === before) parts["acute-rise"] = W["acute-rise"] / 2; }
    if (y.accent === "circumflex") {
      if (k === 1) { if (final) parts["circumflex-fall"] = W["circumflex-fall"] / 2; }
      else if (ps.some((x, i) => i > 0 && x > ps[i - 1]) || last >= first) parts["circumflex-fall"] = W["circumflex-fall"];
      if (k > 2) parts.melisma = (k - 2) * W.melisma;
    } else if (k > 1) parts.melisma = (k - 1) * W.melisma;
    const p = peakOf[s];
    if (p === s) { const above = []; for (let j = startOf(wordFrom[s]); j < y.at; j++) if (h(U[j]) > top) above.push(j); if (above.length) parts.peak = above.length * W.peak; }
    else if (p >= 0 && s > p && top > Math.max(...sylNotes(U, p, startOf(p) + Y[p].beats))) parts.peak = W.peak;
    if (prevSyl && before !== null) {
      if ((prevSyl.accent === "acute" || prevSyl.accent === "circumflex") && y.accent !== "acute" && y.accent !== "circumflex") {
        if (first > before) parts["after-accent"] = W["after-accent"]; else if (first === before && prevSyl.accent === "acute") parts["after-accent"] = W["after-accent"] / 2;
      }
      if (prevSyl.accent === "grave" && first < before) parts.grave = W.grave;
    }
    if (final && y.lineEnd && s < Y.length - 1 && ![0, 3, 4].includes(mod(deg(lastCode), 7))) parts["line-end"] = W["line-end"];
    return parts;
  };
  const diff = (a, b) => { const out = {}; for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) { const v = (a[id] || 0) - (b[id] || 0); if (v) out[id] = v; } return out; };
  const soft = [
    { id: "melodic", cost: ({ U, t, d, struck }) => {
      if (!struck) return {};
      if (t >= 1 && deg(U[t - 1]) === d) return { repeat: W.repeat };
      const line = []; for (let j = 0; j < t; j++) if (j === 0 || U[j] !== U[j - 1] || isStart(j)) line.push(deg(U[j]));
      return melodicParts(line, d, W);
    } },
    { id: "accent", cost: ({ U, t, c, struck }) => {
      const s = sylAt[t], end = isEnd(t);
      if (!struck && !end) return {};
      const now = sylNotes(U, s, t, c), then = sylNotes(U, s, t);
      return diff(pen(U, s, now, end, c), pen(U, s, then, false));
    } },
  ];
  // one voice on solveVoices (the memo keyed by what the rules read, not by a window of beats)
  const at = (U, t, c) => ({ U, t, c, d: deg(c), struck: t === 0 || isStart(t) || c !== U[t - 1] });
  const check = (U, t, c) => { if (t >= n) return "the work is finished"; const x = at(U, t, c); for (const r of rules) { const e = r.check(x); if (e) return e; } return null; };
  const why = (U, t, c) => { if (t >= n) return { id: "edges", reason: "the work is finished" }; const x = at(U, t, c); for (const r of rules) { const e = r.check(x); if (e) return { id: r.id, reason: e }; } return null; };
  const costParts = (U, c) => { const x = at(U, U.length, c); return Object.assign({}, ...soft.map((f) => f.cost(x))); };
  const SV = solveVoices({ n, voices: [{ name: "melody", solver: { codes, check, costParts } }], between: [], key: (W, t) => memoKey(W[0], t), result: (W) => W[0] });
  const core = {
    codes, check, why, costParts, memo: SV.memo,
    count: (U = []) => SV.count([[...U]]),
    sample: (r = Math.random) => SV.sample(r),
    engine: (o = {}) => SV.engine(o),
    search: (o = {}) => SV.search(o),
    fan: (U = []) => SV.fan([[...U]]).map((f) => ({ note: f.x[0], name: S.pitchName(f.x[0]), futures: f.futures, parts: f.parts, cost: f.cost })),
    judge: (U) => SV.judgeW([U], `${U.length} beats, the text has ${n}`),
  };
  const name = (c) => S.pitchName(c);
  /** A melody's notes: [{code, at, beats, syl, first (of its syllable)}]. */
  const notesOf = (U) => {
    const out = [];
    for (let t = 0; t < U.length; t++) {
      if (struckAt(U, t)) out.push({ code: U[t], at: t, beats: 1, syl: sylAt[t], first: isStart(t) });
      else out[out.length - 1].beats++;
    }
    return out;
  };
  const pitchesOf = (U) => Y.map((y, s) => sylNotes(U, s, y.at + y.beats));
  return {
    ...core, plan: P, syllables: Y, S, key, deg, name, midi: (c) => S.midi(c), hz: (c) => S.hz(c), strict, weights: W, error: P.error, memoKey,
    // (for canonic(): the hard rules and the costs a beat, as the dux takes them)
    own: { finals, starts, lo, hi, maxSyl },
    count: (U = []) => (P.error || !n ? 0n : core.count(U)),
    countWithin: (ms, U = []) => { if (P.error || !n) return 0n; try { return within(ms, () => core.count(U)); } catch (e) { if (e.tooLong) return null; throw e; } },
    notesOf, pitchesOf,
    /** A melody's notes with the text they sing: notesOf's, each syllable's text on the first note of its melisma
     *  (text, and wordpos: "i", "m", "t" in its word, none for a word of one syllable) — what export.mjs writes as
     *  MEI's <verse><syl>; the notes after it in the syllable carry none. */
    lyricNotesOf: (U) => notesOf(U).map((x) => {
      if (!x.first) return x;
      const y = Y[x.syl], wordpos = y.first && y.last ? null : y.first ? "i" : y.last ? "t" : "m";
      return { ...x, text: y.text, ...(wordpos ? { wordpos } : {}) };
    }),
    /** How a melody keeps the accent: judgeAccent's {rule: [kept, applies, where not]}. */
    accentReport: (U) => judgeAccent(Y, pitchesOf(U)),
    /** How many syllables are sung on more than one note. */
    melismas: (U) => pitchesOf(U).filter((ps) => ps.length > 1).length,
    shape: (U) => shape([notesOf(U).map((x) => deg(x.code))]),
    /** The melody as notes for cac imitation (a note's units its beats), with a rest before it if it starts on a weak
     *  beat (the strong beats on the even units, as imitation reads them). */
    asDux: (U) => duxOf(Y, notesOf(U), (c) => S.midi(c)),
  };
}

/**
 * The Greek counterpoint: the canon's rules (canon-2) on a Greek system, whose concords are the unison, the 4th, the
 * 5th and the octave (greek.mjs) — every other interval a discord, on a strong beat never (no suspension: the system
 * knows none), on a weak one passing by step —, and without the rules a Greek ear did not keep: parallel concords
 * (the aulos with the voice, the octaves of the magadis), direct octaves, the same concord on consecutive strong
 * beats, a comes entering on the unison.
 */
export const GREEK_ON = { parallels: false, "direct-octaves": false, "strong-parallels": false, "entry-unison": false };

/**
 * The poem sung in canon (#192 as it was first thought: the singer choosing among the futuribles of the comes): the
 * dux sings the text — aoidos's voice, a beat a unit, with its rules and costs — and the comes answers it by canon.mjs's
 * rules (canon-2: the comes k steps away, d beats later, at a degree of imitation), the two counted together. spec:
 * aoidos()'s, and k (−7), d (4 beats: a foot; at 2 a long note held against the comes's move leaves a dissonance that
 * does not pass), imitation (1: a canon; 0.6 near; 0.3 by motion), invert (invertible counterpoint at the octave [8],
 * the 10th, the 12th), maxRepeat (1: a new syllable a new pitch). The dux keeps canon-2's own rules too (range, start,
 * its melodic intervals). → solveVoices's
 * count, sample, engine (→ {dux, comes} a code a beat), fan, judge; A (the dux's aoidos), beats.
 */
export function canonic(spec = {}) {
  // (in canon a new syllable strikes a new pitch: a canon reads a pitch struck again as held, and the holds stay short)
  const A = aoidos({ ...spec, maxRepeat: spec.maxRepeat ?? 1 });
  const n = A.plan.beats, own = A.own, Y = A.syllables;
  if (A.error || !n) return { error: A.error || "no text", A, count: () => 0n, countWithin: () => 0n, beats: n };
  const firstStrong = Y.find((x) => x.strong), phase = firstStrong ? firstStrong.at % 2 : 0;
  const maxHold = Math.max(2, own.maxSyl * (spec.maxRepeat ?? 1));
  const k = spec.k ?? -7, d = Math.min(spec.d ?? 4, Math.max(0, n - 1));
  // (in a Greek system the canon's world is the system itself, its degrees from the final, and the Greek counterpoint:
  // GREEK_ON)
  const greek = !!A.S.greek;
  const cspec = { key: A.key, ...(greek ? { system: A.S } : {}), ficta: false, tonic: 0, k, d, b: 2, phase, n, lo: own.lo, hi: own.hi, imitation: spec.imitation ?? 1, maxHold,
                  invert: spec.invert || [], starts: own.starts, soft: true, weights: A.weights, on: { approach: false, ...(greek ? GREEK_ON : {}) } };
  const CV = canonVoices(cspec, spec.canonStyle || "canon-2");
  const duxCheck = (D, t, x) => A.check(D, t, x) || CV.voices[0].solver.check(D, t, x);
  const duxSolver = { codes: CV.voices[0].solver.codes.filter((c) => c !== null), check: duxCheck, costParts: (D, x) => A.costParts(D, x) };
  // the memo: the dux as far back as aoidos's rules look, the comes as the canon's
  const w = CV.world, aug = w.aug;
  const LD = Math.max(maxHold + 1, d + 1), LC = Math.max(maxHold * aug + 1, 2);
  const key = (W, t) => t + ":" + A.memoKey(W[0], t) + ":" + W[0].slice(Math.max(0, t - LD), t).join(",") + ":" + W[1].slice(Math.max(0, t - LC), t).join(",");
  // (heterophony: the comes at once, d = 0 — the canon's rules read the dux's past, so the note it sings now is
  // read here: within a 3rd of it (in a Greek system a 4th: the concord below), k steps away, near; the same note, a
  // canon)
  const width = greek ? 3 : 2;
  const now = d === 0 ? [{ id: "heterophony", check: ({ x: [x, c] }) => {
    if (x === null || c === null) return null;
    const m = w.deg(x) + k, band = w.bnd;
    if (band === "canon" && w.deg(c) !== m) return "the aulos plays the voice's note";
    if (band === "near" && Math.abs(w.deg(c) - m) > width) return greek ? "the aulos keeps within a 4th of the voice" : "the aulos keeps within a 3rd of the voice";
    return null;
  } }] : [];
  const between = d === 0 ? CV.between.filter((r) => r.id !== "imitation") : CV.between;
  // (and the aulos stays near the voice by choice too: a cost a degree away from its note — heterophony is the same
  // melody, its deviations the exception)
  const apart = d === 0 ? [{ id: "apart", cost: ({ x: [x, c] }) => (x === null || c === null ? {} : { apart: (spec.apart ?? 0.3) * Math.abs(w.deg(c) - w.deg(x) - k) }) }] : [];
  const SV = solveVoices({ n, voices: [{ name: "dux", solver: duxSolver }, { name: "comes", solver: CV.voices[1].solver }],
                           between: [...between, ...now], soft: apart, key, result: (W) => ({ dux: W[0], comes: W[1] }) });
  return { ...SV, A, beats: n, k, d, phase, world: w, name: A.name, midi: A.midi, hz: A.hz, key: A.key,
           count: () => SV.count(),
           countWithin: (ms) => { try { return within(ms, () => SV.count()); } catch (e) { if (e.tooLong) return null; throw e; } },
           judge: (D, C) => SV.judgeW([D, C], `the voices are not ${n} beats long`) };
}

/**
 * The singer with an aulos (the double pipe that went with the voice): spec aoidos()'s, and practice —
 *   heterophony  the aulos plays the voice's melody at once with its own deviations, within a 3rd (canonic(), d 0,
 *                imitation 0.6, k 0 the same register; the counterpoint's rules between them, the two counted together)
 *   drone        one pipe holds the final, an octave below (the ison the Byzantine chant kept)
 *   ison         the held note follows the song: each line on the degree its last note ends on, below the voice
 * → for heterophony canonic()'s; else aoidos()'s, and comesOf (a melody → the aulos, a code a beat).
 */
export function aulos(spec = {}) {
  const practice = spec.practice || "heterophony";
  if (practice === "heterophony") return { ...canonic({ ...spec, d: 0, k: spec.k ?? 0, imitation: spec.imitation ?? 0.6 }), practice };
  const A = aoidos(spec), Y = A.syllables, at7 = (d) => ((d % 7) + 7) % 7 - 7;
  // (a degree an octave below, or the nearest octave up the system has: a Greek system ends at its proslambanomenos)
  const below = (d) => { for (let x = d; x <= d + 14; x += 7) { try { return A.S.at(x); } catch (e) { /* not in the system */ } } return A.S.at(0); };
  const comesOf = (U) => {
    if (practice === "drone") return U.map(() => below(-7));
    const lines = [...new Set(Y.map((y) => y.line))], out = [];
    for (const li of lines) {
      const ys = Y.filter((y) => y.line === li), last = ys[ys.length - 1], end = last.at + last.beats;
      const held = below(at7(A.deg(U[end - 1])));
      for (let t = ys[0].at; t < end; t++) out[t] = held;
    }
    return out;
  };
  return { ...A, A, practice, comesOf };
}

/** A melody's notes [{midi, units}] for imitation(): a beat a unit; a rest first where the first strong beat is odd. */
export function duxOf(Y, notes, midi) {
  const firstStrong = Y.find((x) => x.strong);
  const pad = firstStrong && firstStrong.at % 2 === 1 ? [{ midi: null, units: 1 }] : [];
  return [...pad, ...notes.map((x) => ({ midi: midi(x.code), units: x.beats }))];
}

/**
 * The examiner: a melody tried as the dux of cac imitation at each distance k (steps: −7 an octave below, −4 a 5th,
 * −3 a 4th, 7 an octave above…) and entry d (beats), at a degree of imitation (1 a canon, 0.6 near) → [{k, d,
 * imitation, comes (how many, or null: too long to count in ms), engine (one comes the engine chose, as names), sound
 * ({dux, comes}: MIDI or null a unit, and duxStruck: where the dux strikes — to hear them together)}],
 * the best first.
 */
export function examine(A, U, { ks = [-7, -4, -3, 7], ds = [2, 4], degrees = [1], ms = 1500, b = 2 } = {}) {
  const notes = A.asDux(U);
  const maxHold = Math.max(2, ...runs(notes));
  const out = [];
  for (const imitationDegree of degrees) for (const k of ks) for (const d of ds) {
    const I = A.S.greek ? imitationIn(A, U, notes, { k, d, b, imitation: imitationDegree, maxHold })
                        : imitation({ notes, key: A.key, k, d, b, imitation: imitationDegree, maxHold });
    const comes = I.unknown && I.unknown.length ? 0n : I.countWithin(ms);
    let engine = null, sound = null;
    if (comes) {
      const C = I.engine({ temp: 0 });
      if (C) {
        const cs = C.comes || C[1];
        engine = cs.map((c) => (c === null ? null : I.spell(c)));
        // (to hear it: both voices a unit a value, MIDI or null, and where each note is struck)
        const mid = (V) => V.map((c) => (c === null || c === undefined ? null : I.midi(c)));
        const duxStruck = []; notes.forEach((x) => { for (let j = 0; j < x.units; j++) duxStruck.push(j === 0); });
        sound = { dux: mid(I.dux), duxStruck, comes: mid(cs) };
      }
    }
    out.push({ k, d, imitation: imitationDegree, comes, engine, sound });
  }
  // (those with a comes first, the most first; then those too long to count; then those with none)
  const rank = (x) => (x.comes === null ? 1 : x.comes > 0n ? 2 : 0);
  return out.sort((x, y) => rank(y) - rank(x) || ((y.comes ?? 0n) > (x.comes ?? 0n) ? 1 : (y.comes ?? 0n) < (x.comes ?? 0n) ? -1 : 0));
}

/**
 * cac imitation's, in a Greek system: the melody (its codes, a beat a unit; a rest first where asDux puts one) the
 * given dux of imitation-2, the comes written in the same system by the Greek counterpoint (GREEK_ON).
 */
function imitationIn(A, U, notes, { k = -7, d = 2, b = 2, imitation: degree = 1, maxHold = 2 } = {}) {
  const dux = [...(notes.length && notes[0].midi === null ? [null] : []), ...U];
  const degs = U.map((c) => A.deg(c)), n = dux.length, dd = Math.min(d, Math.max(1, n - 1));
  const cspec = { tonic: 0, system: A.S, k, d: dd, b, n, lo: Math.min(...degs), hi: Math.max(...degs), imitation: degree, maxHold, given: dux,
                  starts: [...new Set([degs[0], 0, 4, 7])], soft: true, on: GREEK_ON };
  const CV = canonVoices(cspec, "imitation-2");
  return { ...CV, dux, unknown: [], spell: (c) => A.name(c), midi: (c) => A.midi(c),
           countWithin: (ms) => { try { return within(ms, () => CV.count()); } catch (e) { if (e.tooLong) return null; throw e; } } };
}

// (the longest run of one pitch in units: a held note and the same note struck again read alike in a canon)
function runs(notes) {
  const out = []; let cur = null, len = 0;
  for (const x of notes) { if (x.midi === cur) len += x.units; else { if (len) out.push(len); cur = x.midi; len = x.units; } }
  if (len) out.push(len);
  return out;
}

export default { aoidos, canonic, aulos, plan, examine, judgeAccent, duxOf, fromFinal, PROSODY, TEXTS, prosodyWeights };
