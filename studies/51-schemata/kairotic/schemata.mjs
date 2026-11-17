// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 51 · schemata: a given bass realized in two parts, as a partimento is (after Job IJzerman,
// Harmony, Counterpoint, Partimento, OUP 2018, chapter 1).
//
// The bass is given — a schema of the book as data, in a key — and the upper voice is written over it, unit by unit,
// under the rules of two-part realization:
//
//   a unit is half a bar: the first strong, the second weak (an upbeat, phase 1, begins on a weak one)
//   verticals   3rds and 6ths imperfect, 8ves and 5ths perfect; 2nds, 4ths and 7ths dissonant
//   strong      a consonance, or a suspension: one voice holds its note from a consonance (the preparation) — the
//               upper a 7th, a 4th or a 9th (7–6, 4–3, 9–8), the bass a 2nd (2–3) — and on the next unit the voice
//               that holds it goes down a step to a consonance (the resolution); the other voice may move with it
//               (7–3, 2–6: Fifth Down Fourth Up, the Tied Bass)
//   weak        a consonance, or a passing tone: over a held bass, by step and on by step the same way
//   lines       steps, 3rds, 4ths, 5ths (the diminished one too), 6ths, the octave, and in minor the diminished
//               7th; after a leap of a 4th or more the line turns; in minor ⑥ and ⑦ go up raised and down natural
//   the voices  no parallel 5ths or 8ves, none by direct motion with a leap in the upper voice; the upper starts
//               on an 8ve, a 5th or a 3rd over ① (a sixth there "would be unsatisfactory"), ends on an 8ve or a 3rd
//               over the last bass note, reached by step
//
// The figures of the schema (the numbers under the bass) may be asked too: then the upper voice realizes them, and
// what is left to choose is little (the octave, a passing tone); without them the rules alone choose. The futures
// are counted exactly (BigInt), a realization is drawn uniformly from them, and a voice written by hand is shown the
// futures of each of its next notes — the partimento as improvisation.

const mod = (a, m) => ((a % m) + m) % m;
const sign = (x) => (x > 0) - (x < 0);

// ─── keys: a pitch is a degree (0 = the tonic of the bass's octave, 7 its octave) and, in minor, raised or not ───
const PAT = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"], WHITE = [0, 2, 4, 5, 7, 9, 11];
const ACC = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };

/** A key: {tonic: "C" | "A" | "Bb" | "F#"…, mode: "major" | "minor"}. Degree 0 is the tonic in the bass's octave
 *  (C3 to F3, F♯2 to B2). */
export function keyOf(k = {}) {
  const name = k.tonic || "C", mode = k.mode === "minor" ? "minor" : "major";
  const L = LETTERS.indexOf(name[0].toUpperCase());
  if (L < 0) throw new Error(`no such tonic: ${name}`);
  const acc = [...name.slice(1)].reduce((a, ch) => a + (ch === "#" || ch === "♯" ? 1 : ch === "b" || ch === "♭" ? -1 : 0), 0);
  const pc = mod(WHITE[L] + acc, 12);
  const oct = pc > 5 ? 2 : 3;
  const tonicMidi = 12 * (oct + 1) + WHITE[L] + acc;
  const pat = PAT[mode];
  /** Semitones above the tonic of a degree d, raised (r = 1) or not. */
  const semi = (d, r = 0) => 12 * Math.floor(d / 7) + pat[mod(d, 7)] + r;
  const midi = (d, r = 0) => tonicMidi + semi(d, r);
  const name_ = (d, r = 0) => {
    const la = 7 * oct + L + d, o = Math.floor(la / 7), l = mod(la, 7);
    const a = midi(d, r) - (12 * (o + 1) + WHITE[l]);
    return LETTERS[l] + (ACC[a] ?? (a > 0 ? "+" + a : String(a))) + o;
  };
  /** Whether a degree has two forms in this key (⑥ and ⑦ in minor). */
  const mutable = (d) => mode === "minor" && mod(d, 7) >= 5;
  return { tonic: name, mode, tonicMidi, semi, midi, name: name_, mutable,
           hz: (d, r = 0) => 440 * Math.pow(2, (midi(d, r) - 69) / 12),
           circled: (d) => "①②③④⑤⑥⑦"[mod(d, 7)] };
}

// ─── the schemata of chapter 1, as data ───
// A schema: its events, each [degree of the bass, units it lasts, the figures over each of its units]. A unit is
// half a bar; phase 1 begins on a weak unit (an upbeat). The bass's ⑥ and ⑦ in minor are raised when the next note
// is a step up, and natural otherwise.
const run = (from, to, len, figs) => { const out = []; for (let d = from; from > to ? d >= to : d <= to; d += from > to ? -1 : 1) out.push([d, len, figs]); return out; };
export const SCHEMATA = {
  thirds: { name: "parallel thirds", ref: "IJzerman 1.1, ex. 1.4(a), 1.6(a)", about: "the scale up and down, the upper voice a third above it; an imperfect cadence, 3–3 on ②–①",
            events: [...run(0, 7, 2, [3, 3]), ...run(6, 1, 2, [3, 3]), [0, 1, [3]]] },
  sixths: { name: "parallel sixths", ref: "IJzerman 1.1, ex. 1.4(b), 1.6(c)", about: "the same scale in sixths: it starts and ends on the octave, and the high ① takes a third; a perfect cadence, 6–8",
            events: [[0, 2, [8, 8]], ...run(1, 6, 2, [6, 6]), [7, 2, [3, 3]], ...run(6, 1, 2, [6, 6]), [0, 1, [8]]] },
  "3-6": { name: "3–6 progression", ref: "IJzerman 1.2, ex. 1.10–1.12", about: "a third and a sixth on each bass note of a descending scale: the upper voice falls by fifths and rises by fourths",
           events: [...run(7, 2, 2, [3, 6]), [1, 2, [6, 6]], [0, 1, [8]]] },
  "third-down": { name: "Third Down Second Up", ref: "IJzerman 1.2, ex. 1.14–1.17", about: "the bass falls a third and rises a step, 3 and 6 by turns: underneath, a stepwise descent",
                  events: [[7, 2, [3, 3]], [5, 2, [6, 6]], [6, 2, [3, 3]], [4, 2, [6, 6]], [5, 2, [3, 3]], [3, 2, [6, 6]], [4, 2, [3, 3]], [2, 2, [6, 6]], [3, 2, [3, 3]], [1, 2, [6, 6]], [0, 1, [8]]] },
  "7-6": { name: "7–6 suspensions", ref: "IJzerman 1.3, ex. 1.19–1.20, 1.24(a)", about: "parallel sixths with a seventh inserted: tied in the upper voice, prepared, struck on the strong unit and resolved; a compound cadence 7–6–8",
           phase: 1, events: [[7, 1, [8]], [8, 2, [7, 6]], ...run(7, 1, 2, [7, 6]), [0, 1, [8]]] },
  "2-3": { name: "2–3 suspensions", ref: "IJzerman 1.3, ex. 1.22–1.24(b)", about: "the 7–6 inverted: the ties in the bass, which holds its note under a second and resolves down to a third; a compound cadence 2–3–1",
           events: [[7, 3, [3, 3, 2]], ...run(6, 0, 2, [3, 2]), [-1, 1, [3]], [0, 1, [8]]] },
  "7-3": { name: "Fifth Down Fourth Up (7–3)", ref: "IJzerman 1.4, ex. 1.27–1.28, 1.31(a)", about: "a 7–6 whose bass moves with the resolution, up a fourth: the circle of fifths seen from the bass; it closes with the leaping compound cadence 7–3–8 on ②–⑤–①",
           phase: 1, events: [[5, 1, [6]], [4, 1, [7]], [7, 1, [3]], [3, 1, [7]], [6, 1, [3]], [2, 1, [7]], [5, 1, [3]], [1, 1, [7]], [4, 1, [3]], [0, 1, [8]]] },
  "tied-bass": { name: "Tied Bass (2–6)", ref: "IJzerman 1.4, ex. 1.29–1.31(b)", about: "a 2–3 whose upper voice moves with the resolution, to a sixth: rising fourths and falling fifths over a syncopated bass; a compound cadence 7–6–8",
                 events: [[7, 3, [3, 3, 2]], ...run(6, 3, 2, [6, 2]), [2, 1, [6]], [1, 2, [7, 6]], [0, 1, [8]]] },
};

// The prototypes of chapter 1 as the book writes them (C major, A minor): the upper voice unit by unit (a note held
// is written again), and the cadence the book names. Each is a realization of its schema (the tests judge them).
const twice = (s) => s.split(" ").flatMap((x) => [x, x]);
export const PROTOTYPES = {
  thirds: { key: { tonic: "C" }, upper: [...twice("E4 F4 G4 A4 B4 C5 D5 E5 D5 C5 B4 A4 G4 F4"), "E4"], cadence: "imperfect" },
  "thirds-minor": { schema: "thirds", key: { tonic: "A", mode: "minor" }, upper: [...twice("C4 D4 E4 F#4 G#4 A4 B4 C5 B4 A4 G4 F4 E4 D4"), "C4"], cadence: "imperfect" },
  sixths: { key: { tonic: "C" }, upper: [...twice("C5 B4 C5 D5 E5 F5 G5 E5 G5 F5 E5 D5 C5 B4"), "C5"], cadence: "perfect" },
  "3-6": { key: { tonic: "C" }, upper: ["E5", "A5", "D5", "G5", "C5", "F5", "B4", "E5", "A4", "D5", "G4", "C5", "B4", "B4", "C5"], cadence: "perfect" },
  "third-down": { key: { tonic: "C" }, upper: [...twice("E5 F5 D5 E5 C5 D5 B4 C5 A4 B4"), "C5"], cadence: "perfect" },
  "7-6": { key: { tonic: "C" }, upper: ["C6", "C6", "B5", "B5", "A5", "A5", "G5", "G5", "F5", "F5", "E5", "E5", "D5", "D5", "C5", "C5", "B4", "C5"], cadence: "compound" },
  "2-3": { key: { tonic: "A", mode: "minor" }, upper: [...twice("C5 B4 A4 G4 F4 E4 D4 C4 B3"), "A3"], cadence: "compound" },
  "7-3": { key: { tonic: "A", mode: "minor" }, upper: ["D5", "D5", "C5", "C5", "B4", "B4", "A4", "A4", "G#4", "A4"], cadence: "compound (leaping)" },
  "tied-bass": { key: { tonic: "C" }, upper: ["E5", "E5", "D5", "G5", "C5", "F5", "B4", "E5", "A4", "D5", "G4", "C5", "C5", "B4", "C5"], cadence: "compound" },
};


/** The bass of a schema in a key, unit by unit: {d, r, struck, fig: [figures] | null}. */
export function bassOf(schema, key) {
  const K = key.semi ? key : keyOf(key);
  const ev = schema.events, units = [];
  ev.forEach(([d, len, figs], i) => {
    const next = ev[i + 1];
    const r = K.mutable(d) && next && next[0] === d + 1 ? 1 : 0;
    for (let j = 0; j < len; j++) units.push({ d, r, struck: j === 0, fig: figs ? [].concat(figs[Math.min(j, figs.length - 1)]) : null });
  });
  return units;
}

// ─── the figures: a class of interval (degrees apart, modulo 7) and its number ───
const FIG_CLASS = (f) => mod(f - 1, 7);                      // 8 → 0, 3 and 10 → 2, 9 → 1 …
const CLASS_FIG = [8, 2, 3, 4, 5, 6, 7];

/**
 * spec: {schema (a name or {events, phase}), key: {tonic, mode}, figured (true: the upper voice realizes the
 *        figures), lo, hi (the upper voice's range, in degrees: 7 the tonic above the bass's, 21 two octaves
 *        higher), spacing (degrees between the voices at most), maxHold (units a note may last, held: 2)}
 */
export function schemata(spec = {}) {
  const schema = typeof spec.schema === "string" ? SCHEMATA[spec.schema] : spec.schema || SCHEMATA.thirds;
  if (!schema) throw new Error(`no such schema: ${spec.schema}`);
  const K = keyOf(spec.key || { tonic: schema.tonic || "C", mode: schema.mode || "major" });
  const B = spec.bass || bassOf(schema, K);
  const n = B.length, phase = schema.phase ?? spec.phase ?? 0;
  const lo = spec.lo ?? 7, hi = spec.hi ?? 21, spacing = spec.spacing ?? 16, maxHold = spec.maxHold ?? 2;
  const figured = spec.figured ?? true;
  const strong = (t) => (t + phase) % 2 === 0;

  // a note of the upper voice is a code: 2·degree + raised
  const D = (c) => c >> 1, R = (c) => c & 1;
  const semiU = (c) => K.semi(D(c), R(c));
  const semiB = (t) => K.semi(B[t].d, B[t].r);
  const codes = [];
  for (let d = lo; d <= hi; d++) { codes.push(2 * d); if (K.mutable(d)) codes.push(2 * d + 1); }

  /** The vertical at unit t with the upper note c: {steps, cls, q: "perfect" | "imperfect" | "dissonant"}. */
  function vertical(t, c) {
    const steps = D(c) - B[t].d, cls = mod(steps, 7), s = mod(semiU(c) - semiB(t), 12);
    const q = cls === 0 ? (s === 0 ? "perfect" : "dissonant") : cls === 4 ? (s === 7 ? "perfect" : "dissonant")
            : cls === 2 ? (s === 3 || s === 4 ? "imperfect" : "dissonant") : cls === 5 ? (s === 8 || s === 9 ? "imperfect" : "dissonant") : "dissonant";
    return { steps, cls, q };
  }
  const consonant = (v) => v.q !== "dissonant";

  /** Why a move of the upper voice from a to b (struck) is not melodic, or null. */
  function melodicError(a, b) {
    const n = Math.abs(D(b) - D(a)), s = Math.abs(semiU(b) - semiU(a));
    if (n === 0) return "a chromatic step";
    if (n === 1) return s <= 2 ? null : "an augmented 2nd";
    if (n === 2) return s === 3 || s === 4 ? null : "this 3rd";
    if (n === 3) return s === 5 ? null : "an augmented 4th";
    if (n === 4) return s === 6 || s === 7 ? null : "an augmented 5th";
    if (n === 5) return s === 8 || s === 9 ? null : "this 6th";
    if (n === 6) return K.mode === "minor" && s === 9 ? null : "a 7th (only the diminished one, in minor)";
    if (n === 7) return s === 12 ? null : "this octave";
    return "a leap wider than the octave";
  }

  /** The note struck before the one sounding at unit j in U (its index), or −1. */
  const onsetOf = (U, j) => { let i = j; while (i > 0 && U[i - 1] === U[j]) i--; return i; };

  /** Why the upper note c at unit t (after U[0..t-1]) is refused, or null. */
  function check(U, t, c) {
    if (t >= n) return "the work is finished";
    if (D(c) < lo || D(c) > hi) return "out of range";
    const v = vertical(t, c);
    // the voices
    if (v.steps < 0) return "below the bass";
    if (v.steps === 0 && t < n - 1) return "the unison with the bass (only at the end)";
    if (v.steps > spacing) return "too far from the bass";
    if (figured && B[t].fig && !B[t].fig.some((f) => FIG_CLASS(f) === v.cls)) return `the figures ask for ${B[t].fig.join(" or ")}`;
    const prev = t >= 1 ? U[t - 1] : null;
    const held = prev !== null && c === prev, struck = !held;
    // the line: a note held two units at most; the moves struck
    if (held) {
      const on = onsetOf(U, t - 1);
      if (t - on >= maxHold) return `a note is held ${maxHold} units at most`;
    } else if (prev !== null) {
      const e = melodicError(prev, c); if (e) return e;
      const on = onsetOf(U, t - 1), a1 = on >= 1 ? U[on - 1] : null;
      const step = D(c) - D(prev);
      if (a1 !== null && Math.abs(D(prev) - D(a1)) >= 3 && sign(step) === sign(D(prev) - D(a1))) return "after a leap of a 4th or more the line turns";
      // in minor: ⑥ and ⑦ go up raised and down natural
      if (K.mutable(D(prev)) && Math.abs(step) === 1) {
        if (step > 0 && !R(prev)) return `${K.name(D(prev), 0)} goes up raised (melodic minor)`;
        if (step < 0 && R(prev)) return `${K.name(D(prev), 1)} goes down natural (melodic minor)`;
      }
    }
    // what the unit before asks
    if (t >= 1) {
      const pv = vertical(t - 1, prev);
      if (!consonant(pv)) {
        if (strong(t - 1)) {
          // the suspension before resolves: the voice that held it goes down a step, to a consonance
          const upperHeld = t >= 2 && U[t - 2] === prev;
          if (upperHeld) { if (!(struck && D(c) === D(prev) - 1)) return "the suspension resolves down by step (the upper voice)"; }
          else if (!(B[t].struck && B[t].d === B[t - 1].d - 1)) return "the suspension resolves down by step (the bass)";
          if (!consonant(v)) return "the suspension resolves to a consonance";
        } else {
          // a passing tone goes on by step, the same way
          const a = U[onsetOf(U, t - 1) - 1];
          if (!(struck && D(c) - D(prev) === D(prev) - D(a))) return "the passing tone goes on by step, the same way";
        }
      }
    }
    if (!consonant(v)) {
      if (t === n - 1) return "the work does not end on a dissonance";
      if (strong(t)) {
        const bassHeld = !B[t].struck;
        if (held === bassHeld) return held ? "a dissonance with both voices held" : `a ${CLASS_FIG[v.cls]} (dissonant) on a strong unit must be prepared, one voice holding its note`;
        if (!consonant(vertical(t - 1, prev))) return "a suspension is prepared by a consonance";
        if (held && !(v.cls === 6 || v.cls === 3 || (v.cls === 1 && v.steps >= 8))) return "held in the upper voice: a 7th, a 4th or a 9th";
        if (bassHeld && v.cls !== 1) return "held in the bass: a 2nd (or 9th)";
      } else {
        if (B[t].struck) return "a dissonance on a weak unit: over a held bass";
        if (!struck || t === 0 || Math.abs(D(c) - D(prev)) !== 1) return "a dissonance on a weak unit passes by step";
        if (!consonant(vertical(t - 1, prev))) return "two dissonances in a row";
      }
    }
    // parallels and direct motion into a perfect consonance
    if (t >= 1 && v.q === "perfect" && struck && B[t].struck) {
      const pv = vertical(t - 1, prev);
      const bm = B[t].d - B[t - 1].d, um = D(c) - D(prev);
      if (pv.q === "perfect" && pv.cls === v.cls && (bm !== 0 || um !== 0)) return `parallel ${v.cls === 0 ? "octaves" : "5ths"}`;
      if (sign(bm) === sign(um) && bm !== 0 && Math.abs(um) > 1) return `${v.cls === 0 ? "an octave" : "a 5th"} by direct motion, the upper voice leaping`;
    }
    // the start and the end
    if (t === 0 && !(figured && B[0].fig) && B[0].d % 7 === 0 && ![0, 2, 4].includes(v.cls)) return "over ① the upper voice starts on an octave, a 5th or a 3rd";
    if (t === n - 1) {
      if (![0, 2].includes(v.cls)) return "it ends on an octave or a 3rd";
      if (prev !== null && Math.abs(D(c) - D(prev)) !== 1) return "the last note is reached by step";
    }
    return null;
  }

  // ─── the count, exact, memoized on the last three units (the rules look no further back) ───
  const memo = new Map();
  const keyOfU = (U, t) => t + ":" + U.slice(Math.max(0, t - 3), t).join(",");
  function countFrom(U) {
    const t = U.length;
    if (t >= n) return 1n;
    const k = keyOfU(U, t), got = memo.get(k);
    if (got !== undefined) return got;
    let v = 0n;
    for (const c of codes) if (check(U, t, c) === null) { U.push(c); v += countFrom(U); U.pop(); }
    memo.set(k, v);
    return v;
  }
  const count = (U = []) => (U.length > n ? 0n : countFrom([...U]));
  /** The candidates for the next unit: {note, name, reason} or {note, name, futures}. */
  const fan = (U = []) => codes.map((c) => {
    const r = check(U, U.length, c);
    return r ? { note: c, name: K.name(D(c), R(c)), reason: r } : { note: c, name: K.name(D(c), R(c)), reason: null, futures: count([...U, c]) };
  });
  /** A whole realization, drawn uniformly from the futures (r in [0, 1)). */
  function sample(r = Math.random, U0 = []) {
    const U = [...U0];
    while (U.length < n) {
      const cs = fan(U).filter((x) => !x.reason && x.futures > 0n);
      if (!cs.length) return null;
      const tot = cs.reduce((a, x) => a + x.futures, 0n);
      // a BigInt below tot, uniform enough: 52 random bits scaled
      let x = (tot * BigInt(Math.floor(r() * 2 ** 52))) / 2n ** 52n;
      const pick = cs.find((c) => (x -= c.futures) < 0n) || cs[cs.length - 1];
      U.push(pick.note);
    }
    return U;
  }
  /** Why a whole voice is refused (the first unit that refuses it), or null. */
  function judge(U) {
    if (U.length !== n) return `${U.length} units, the bass has ${n}`;
    for (let t = 0; t < n; t++) { const r = check(U.slice(0, t), t, U[t]); if (r) return `unit ${t + 1}: ${r}`; }
    return null;
  }

  // ─── analysis: the figures a voice realizes, what each dissonance is, the cadence ───
  function figures(U) {
    return U.map((c, t) => {
      if (c === undefined || c === null) return null;
      const v = vertical(t, c);
      const f = v.cls === 0 ? (v.steps === 0 ? 1 : 8) : v.cls === 1 && v.steps >= 8 && t >= 1 && U[t - 1] === c ? 9 : CLASS_FIG[v.cls];
      let role = null;
      if (!consonant(v)) role = strong(t) ? (U[t - 1] === c ? "s (upper)" : "s (bass)") : "pt";
      else if (t >= 1 && !consonant(vertical(t - 1, U[t - 1])) && strong(t - 1)) role = "r";
      if (t + 1 < U.length && U[t + 1] !== undefined && !consonant(vertical(t + 1, U[t + 1])) && strong(t + 1)) role = role === "r" ? "r/p" : "p";
      return { fig: f, q: v.q, role };
    });
  }
  function cadence(U) {
    if (U.length !== n || n < 3) return null;
    const F = figures(U), last = F[n - 1].fig, a = F[n - 2].fig, z = F[n - 3].fig;
    const bassLeap = Math.abs(B[n - 1].d - B[n - 2].d) > 1;
    if (F[n - 3].role === "s (upper)" || F[n - 3].role === "s (bass)") return { kind: "compound" + (bassLeap ? " (leaping)" : ""), figs: [z, a, last] };
    if (F[n - 2].role === "r" || F[n - 2].role === "r/p") return { kind: "compound" + (bassLeap ? " (leaping)" : ""), figs: [z, a, last] };
    return { kind: last === 8 || last === 1 ? "perfect" : "imperfect", figs: [a, last] };
  }

  return { spec, schema, key: K, bass: B, n, phase, strong, lo, hi, figured, codes, vertical, check, count, fan, sample, judge, figures, cadence,
           code: (name) => codeOf(K, name), name: (c) => K.name(D(c), R(c)), degree: D, raised: R, hz: (c) => K.hz(D(c), R(c)), memo };
}

/** The code of a note name in a key ("E5", "G#4"): 2·degree + raised. */
export function codeOf(K, name) {
  const m = /^([A-Ga-g])([#♯b♭]*)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`not a note: ${name}`);
  for (let d = -14; d <= 35; d++) for (const r of K.mutable(d) ? [0, 1] : [0]) if (K.name(d, r).replace("♯", "#").replace("♭", "b") === name.replace("♯", "#").replace("♭", "b")) return 2 * d + r;
  throw new Error(`${name} is not a note of ${K.tonic} ${K.mode}`);
}
