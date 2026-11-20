// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 60 · development: motives, and how two spans of a melody are related (discussion #309).
//
//   a note        {name, d (diatonic: 7·octave + letter, independent of key), semi (MIDI), on (unit), dur (units)}:
//                 a melody written a note a unit, a note held written again, read as notes with durations
//   viewpoints    the diatonic intervals (steps), the chromatic ones (semitones), the contour (+1, 0, −1), the
//                 rhythm (each duration over the first's) — after Conklin's multiple viewpoints and Lartillot
//   a relation    first an exact transformation, named: a repetition, a transposition (real) or a sequence
//                 (diatonic), an inversion, a retrograde, a retrograde inversion, each with its rhythm kept,
//                 augmented, diminished or changed; else a weighted edit distance over the intervals, the contour
//                 and the rhythm, which gives a kinship (0 … 1) and the dimensions kept
//   kinship       its sweet spot (0.65 … 0.9: coherence without literal repetition) as a soft rule, and the memory
//                 of the work (Study 38: the intervals' three-note figures already heard)

const LETTERS = "CDEFGAB", WHITE = [0, 2, 4, 5, 7, 9, 11];
const sign = (x) => (x > 0) - (x < 0);
const split = (s) => (Array.isArray(s) ? s : String(s || "").trim().split(/[\s,]+/).filter(Boolean)).map((x) => x.replace("♯", "#").replace("♭", "b"));

/** A note's name read: {d, semi}. */
export function pitchOf(name) {
  const m = /^([A-G])([#b]*)(-?\d+)$/.exec(name.replace("♯", "#").replace("♭", "b"));
  if (!m) throw new Error(`not a note: ${name}`);
  const L = LETTERS.indexOf(m[1]), o = Number(m[3]), acc = [...m[2]].reduce((a, c) => a + (c === "#" ? 1 : -1), 0);
  return { d: 7 * o + L, semi: 12 * (o + 1) + WHITE[L] + acc };
}

/** A melody (names, a unit each) as notes: a note held (the same name again) is one note, longer. */
export function notesOf(melody, start = 0) {
  const names = split(melody), out = [];
  names.forEach((nm, t) => {
    const last = out[out.length - 1];
    if (last && last.name === nm) last.dur++;
    else out.push({ name: nm, ...pitchOf(nm), on: start + t, dur: 1 });
  });
  return out;
}

/** The viewpoints of notes. */
export function views(ns) {
  const dia = [], chro = [], contour = [], rhythm = ns.map((x) => x.dur / ns[0].dur);
  for (let i = 1; i < ns.length; i++) { dia.push(ns[i].d - ns[i - 1].d); chro.push(ns[i].semi - ns[i - 1].semi); contour.push(sign(ns[i].d - ns[i - 1].d)); }
  return { dia, chro, contour, rhythm };
}

const eq = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
const STEP = ["the same pitch", "a 2nd", "a 3rd", "a 4th", "a 5th", "a 6th", "a 7th", "an octave"];
/** A diatonic shift in words: "a 3rd lower", "a step higher", "an octave lower", "at the same pitch". */
export function shiftName(s) {
  if (s === 0) return "at the same pitch";
  const a = Math.abs(s), w = a === 1 ? "a step" : a <= 7 ? STEP[a] : `${STEP[a % 7] === "the same pitch" ? `${a / 7} octaves` : STEP[a % 7] + " and an octave"}`;
  return `${w} ${s > 0 ? "higher" : "lower"}`;
}

// how close each exact relation is to the motive heard as itself
const EXACT = { repetition: 1, transposition: 0.85, sequence: 0.85, inversion: 0.75, retrograde: 0.7, "retrograde inversion": 0.65 };

/** The exact transformation that takes notes M to notes S (as many), or null: {kind, shift, rhythm, name, kinship}. */
export function exact(M, S) {
  if (M.length !== S.length || M.length < 2) return null;
  const a = views(M), b = views(S), shift = S[0].d - M[0].d;
  let kind = null;
  if (eq(a.dia, b.dia)) kind = eq(a.chro, b.chro) ? (shift === 0 ? "repetition" : "transposition") : "sequence";
  else if (eq(a.dia, b.dia.map((x) => -x))) kind = "inversion";
  else if (eq(a.dia, [...b.dia].reverse().map((x) => -x))) kind = "retrograde";
  else if (eq(a.dia, [...b.dia].reverse())) kind = "retrograde inversion";
  if (!kind) return null;
  // the rhythm: kept, augmented (×2), diminished (×½) or another (read forwards, or backwards for a retrograde)
  const md = M.map((x) => x.dur), sd = S.map((x) => x.dur), sdr = kind.startsWith("retrograde") ? [...sd].reverse() : sd;
  const ratio = sdr[0] / md[0], same = sdr.every((x, i) => Math.abs(x / md[i] - ratio) < 1e-9);
  const rhythm = !same ? "another rhythm" : ratio === 1 ? "kept" : ratio === 2 ? "augmented" : ratio === 0.5 ? "diminished" : `×${ratio}`;
  if (kind === "repetition" && rhythm !== "kept") kind = "sequence";
  const name = [kind === "sequence" && shift === 0 ? "a variant at the same pitch" : kind === "repetition" ? "repeated" : kind === "transposition" ? "transposed" : kind === "sequence" ? "in sequence" : kind === "inversion" ? "inverted" : kind === "retrograde" ? "backwards" : "backwards and inverted",
                kind === "repetition" || (kind === "sequence" && shift === 0) ? null : shiftName(shift),
                rhythm === "kept" ? null : rhythm === "another rhythm" ? "in another rhythm" : rhythm].filter(Boolean).join(", ");
  const kinship = Math.round(EXACT[kind] * (rhythm === "kept" ? 1 : rhythm === "another rhythm" ? 0.85 : 0.95) * 100) / 100;
  return { kind, shift, rhythm, name, kinship, exact: true };
}

/** A weighted edit distance (0 … 1, normalized) between two sequences, with a substitution cost sub(a, b). */
function edit(a, b, sub) {
  const n = a.length, m = b.length;
  if (!n && !m) return 0;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + sub(a[i - 1], b[j - 1])));
    prev = cur;
  }
  return prev[m] / Math.max(n, m);
}
// an interval for another: nothing if the same, less when the same way and near (a 3rd for a 4th), most the other way
const subInterval = (x, y) => (x === y ? 0 : sign(x) === sign(y) ? Math.min(1, 0.25 + 0.15 * Math.abs(x - y)) : 1);
const subRhythm = (x, y) => Math.min(1, Math.abs(Math.log2(x) - Math.log2(y)));

/** How S is related to M: the exact transformation if there is one, else a kinship by the weighted edit distances:
 *  {kinship, exact, name, kept: [the dimensions close: "intervals", "contour", "rhythm"]}. */
export function relate(M, S) {
  const x = exact(M, S);
  if (x) return { ...x, kept: ["intervals", "contour", ...(x.rhythm === "kept" || x.rhythm === "augmented" || x.rhythm === "diminished" ? ["rhythm"] : [])] };
  const a = views(M), b = views(S);
  const dI = edit(a.dia, b.dia, subInterval), dC = edit(a.contour, b.contour, (p, q) => (p === q ? 0 : 1)), dR = edit(a.rhythm, b.rhythm, subRhythm);
  const kinship = Math.max(0, 1 - (0.5 * dI + 0.25 * dC + 0.25 * dR));
  const kept = [dI < 0.25 && "intervals", dC < 0.25 && "contour", dR < 0.25 && "rhythm"].filter(Boolean);
  return { kinship: Math.round(kinship * 100) / 100, exact: false, kept, name: kept.length ? `its ${kept.join(" and ")} kept` : "loosely" };
}

/** The span of a melody most related to a motive — the whole motive, or its head or its tail (all but its last or
 *  its first note: a fragment) —: {from, to (units), notes, kinship, exact, name, kept, part}, or null. A fragment's
 *  kinship counts a little less (×0.9), a window one note longer or shorter than the motive less still (−0.05).
 *  only: "head" or "tail", to look for that fragment alone. */
export function findIn(M, ns, { only = null } = {}) {
  let best = null;
  const parts = only ? [] : [["", M]];
  if (M.length >= 4) for (const [k, P] of [["head", M.slice(0, -1)], ["tail", M.slice(1)]]) if (!only || only === k) parts.push([k, P]);
  for (const [part, P] of parts) {
    for (const len of [P.length, P.length - 1, P.length + 1]) {
      if (len < 2 || len > ns.length || (part && len !== P.length)) continue;
      for (let i = 0; i + len <= ns.length; i++) {
        const S = ns.slice(i, i + len), r = relate(P, S);
        const k = Math.max(0, r.kinship * (part ? 0.9 : 1) - (len !== P.length ? 0.05 : 0));
        const score = k + (r.exact ? 0.001 : 0);
        if (!best || score > best.score)
          best = { ...r, name: part ? `its ${part}, ${r.name}` : r.name, part: part || null, kinship: Math.round(k * 100) / 100, score,
                   from: S[0].on, to: S[len - 1].on + S[len - 1].dur - 1, notes: S.map((x) => x.name) };
      }
    }
  }
  if (best) delete best.score;
  return best;
}

/** The motive of a melody: the span of 3 to 5 notes that recurs most (exactly transformed, not overlapping),
 *  earliest first; or, none recurring, its head (the first 4 notes, or fewer). {from, to (units), notes, why}. */
export function discover(melody) {
  const ns = notesOf(melody);
  let best = null;
  for (const len of [5, 4, 3]) {
    for (let i = 0; i + len <= ns.length; i++) {
      const M = ns.slice(i, i + len), hits = [];
      for (let j = i + len; j + len <= ns.length; j++) {
        const x = exact(M, ns.slice(j, j + len));
        if (x && (!hits.length || j >= hits[hits.length - 1].j + len)) hits.push({ j, x });
      }
      const score = hits.length * len;
      if (hits.length && (!best || score > best.score)) best = { score, M, hits };
    }
  }
  if (best) {
    const M = best.M;
    return { from: M[0].on, to: M[M.length - 1].on + M[M.length - 1].dur - 1, notes: M.map((x) => x.name),
             why: `it recurs ${best.hits.length === 1 ? "once more" : best.hits.length + " more times"}: ${best.hits.map((h) => h.x.name).join("; ")}` };
  }
  const M = ns.slice(0, Math.min(4, ns.length));
  return { from: 0, to: M[M.length - 1].on + M[M.length - 1].dur - 1, notes: M.map((x) => x.name), why: "nothing recurs exactly: the head of the phrase" };
}

/** The motive's notes, from a melody and its units (from, to). */
export function motiveNotes(melody, from, to) {
  return notesOf(split(melody).slice(from, to + 1));
}

/** The memory of the work (Study 38): the share of a melody's three-note figures (two diatonic intervals) heard
 *  before, in the melodies given. */
export function memory(before, melody) {
  const grams = (ns) => { const v = views(ns).dia, g = []; for (let i = 0; i + 1 < v.length; i++) g.push(v[i] + "," + v[i + 1]); return g; };
  const heard = new Set(before.flatMap((m) => grams(notesOf(m))));
  const mine = grams(notesOf(melody));
  return mine.length ? Math.round((mine.filter((g) => heard.has(g)).length / mine.length) * 100) / 100 : 0;
}

/** How welcome a kinship is: most in its sweet spot (0.65 … 0.9), less as a literal repetition, little when far. */
export function sweet(k) {
  if (k >= 0.95) return 0.5;
  if (k >= 0.65) return 1;
  return Math.max(0, k / 0.65);
}
