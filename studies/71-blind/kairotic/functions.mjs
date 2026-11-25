// SPDX-License-Identifier: MPL-2.0
// @kairotic/rules · functions.mjs: what a chord does in a key, and which successions of functions a tonal phrase
// allows (discussions #399, #321, #353).
//
// The economy of a description (bits.mjs) prefers the briefest derivation; it must not buy brevity with the steps a
// listener needs to hear where the harmony goes. GTTM's prolongational reduction keeps them: a chord is taken away
// as the prolongation of another, never so that what is left goes backwards. Here that is a hard rule the engines and
// the reductions read like any other (a judge: a level, a bridge, a variation that breaks it weighs nothing):
//
//   a chord        its pitch classes read as a triad or a seventh (one note may be foreign to it: a pedal, a
//                  suspension), its root, its kind and its bass
//   its function   in a key (tonic and mode), after Riemann as the generative grammars of harmony read it
//                  (Rohrmeier's GSM):
//                    T  the tonic: ①, and ⑥ and ③ (its parallel and its counter-chord); the tonic with its major
//                       7th still the tonic; with a minor 7th (a dominant 7th) it is V of ④, an applied dominant
//                       that must go to ④
//                    S  the subdominant: ④ and ②, the Neapolitan, ④ minor in major
//                    D  the dominant: ⑤ and ⑦ (the diminished triad and seventh on the leading tone), and the tonic
//                       in second inversion over ⑤ (the cadential 6/4: a dominant with its suspensions)
//                    A  an applied dominant (secondary): a major triad or a dominant seventh on a degree that is
//                       not its own, or a diminished chord whose root is not the leading tone — the dominant of the
//                       chord it leads to (its target: a 5th below its root; a semitone above a diminished root)
//   the grammar    T → T S D · S → S D T (plagal) · D → D T (the deceptive cadence is T: ⑥) — never D → S, the
//                  retrogression that takes back a dominant before it is resolved (but a chain of 6/3s over a bass
//                  moving by step is a line, a sequence, not a succession of functions); an applied dominant goes to its
//                  target (its root, or its bass: the target's cadential 6/4) or to another applied dominant (a
//                  chain), and may come after anything; the phrase ends on the tonic
//
// Pure data and functions.

const mod = (a, m) => ((a % m) + m) % m;
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const TONICS = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

/** A key: {tonic (pitch class), minor}. From {tonic: "C", mode: "minor"} or a pitch class. */
export function keyPc(k = {}) {
  if (typeof k === "number") return { tonic: mod(k, 12), minor: false };
  const t = String(k.tonic || "C").replace("♯", "#").replace("♭", "b");
  return { tonic: TONICS[t] ?? 0, minor: k.mode === "minor" || k.mode === "aeolian" };
}

const KINDS = [["", [0, 4, 7]], ["m", [0, 3, 7]], ["°", [0, 3, 6]], ["+", [0, 4, 8]], ["7", [0, 4, 7, 10]], ["m7", [0, 3, 7, 10]],
               ["maj7", [0, 4, 7, 11]], ["°7", [0, 3, 6, 9]], ["ø7", [0, 3, 6, 10]]];

/** A chord read from pitches (MIDI): {root, kind, bass (pitch classes), extra (a pitch class foreign to it, or
 *  null)} or null. The kind that holds every pitch class (or all but one), with the fewest missing; the bass breaks
 *  ties (a root in the bass preferred), and a diminished seventh's root is the one a semitone below the bass where
 *  one may be chosen, as the leading tone of what follows. */
export function chordOf(pitches) {
  const pcs = [...new Set(pitches.map((p) => mod(p, 12)))], bass = mod(Math.min(...pitches), 12);
  let best = null;
  const tryWith = (set, extra) => {
    for (let r = 0; r < 12; r++) for (const [kind, iv] of KINDS) {
      const cs = iv.map((x) => (x + r) % 12);
      if (!set.every((x) => cs.includes(x))) continue;
      const missing = cs.length - set.length;
      if (missing > 1) continue;
      const score = missing * 2 + cs.length * 0.5 + (r === bass ? 0 : 0.6) + (extra === null ? 0 : 3);
      if (!best || score < best.score) best = { score, root: r, kind, bass, extra };
    }
  };
  tryWith(pcs, null);
  if (pcs.length >= 3) for (const x of pcs) tryWith(pcs.filter((y) => y !== x), x);
  if (!best) return null;
  const { score, ...c } = best;
  return c;
}

/**
 * What a chord does in a key: {fn: "T" | "S" | "D" | "A", target (an applied dominant's: the pitch class of the
 * chord it leads to), targets (a diminished 7th's: any of the four), degree (of its root, 0 … 11 semitones above the
 * tonic), chord}.
 */
export function functionOf(pitches, key = { tonic: "C" }) {
  const K = keyPc(key), c = chordOf(pitches);
  if (!c) return null;
  const deg = mod(c.root - K.tonic, 12), scale = K.minor ? MINOR : MAJOR, bassDeg = mod(c.bass - K.tonic, 12);
  const dim = c.kind === "°" || c.kind === "°7" || c.kind === "ø7";
  const out = (fn, target = null, targets = target === null ? [] : [target]) => ({ fn, target, targets, degree: deg, chord: c });
  // the tonic, any kind but the dominant's own (a 7th over the tonic stays the tonic) — in second inversion over ⑤,
  // the cadential 6/4: the dominant
  // (but a dominant 7th on the tonic is no longer the tonic: it is V of ④, and goes there)
  if (deg === 0 && !dim && c.kind !== "7") return bassDeg === 7 && c.bass !== c.root ? out("D") : out("T");
  // the leading tone's diminished chords (in minor too: the raised ⑦), and the dominant — a diminished 7th is
  // symmetric, any of its notes may be its root: it is the dominant's where the leading tone is one of them, the
  // leading-tone chord of any chord a semitone above one of its notes otherwise
  if (c.kind === "°7") {
    const tones = [0, 3, 6, 9].map((x) => mod(c.root + x, 12));
    if (tones.includes(mod(K.tonic + 11, 12))) return out("D");
    return out("A", mod(c.root + 1, 12), tones.map((x) => mod(x + 1, 12)));
  }
  if (dim && (deg === 11)) return out("D");
  if (deg === 7 && (c.kind === "" || c.kind === "7" || (K.minor && c.kind === "m"))) return out("D");
  // a diminished chord on another degree: the leading tone of the chord a semitone above it
  if (dim && !(K.minor && deg === 2 && c.kind !== "°7")) return out("A", mod(c.root + 1, 12));
  // a major triad or a dominant 7th on a degree whose own chord is not that: an applied dominant (V of its 5th below)
  const own = (d) => { const i = scale.indexOf(d); if (i < 0) return null; const third = mod(scale[(i + 2) % 7] - d, 12), fifth = mod(scale[(i + 4) % 7] - d, 12); return third === 4 && fifth === 7 ? "" : third === 3 && fifth === 7 ? "m" : third === 3 && fifth === 6 ? "°" : "?"; };
  const dom7 = c.kind === "7";
  if ((c.kind === "" && own(deg) !== "") || dom7) {
    // (the Neapolitan, major on ♭②, is the subdominant's; ④ major in minor's melodic form, too)
    if (deg === 1 && c.kind === "") return out("S");
    if (K.minor && deg === 5 && c.kind === "") return out("S");
    if (K.minor && (deg === 8 || deg === 3 || deg === 10) && c.kind === "") return deg === 10 ? out("D") : out("T");
    return out("A", mod(c.root + 5, 12));
  }
  // the diatonic rest
  if (deg === 5 || deg === 2 || (K.minor && deg === 2)) return out("S");
  if (deg === 9 || deg === 4 || (K.minor && (deg === 8 || deg === 3))) return out("T");
  if (deg === 10 || deg === 11) return out("D");
  return out("T");
}

/**
 * The chord two voices imply (a bass and a melody, as a partimento's are heard): the missing members added, the
 * notes sounding kept — over a 3rd or a 5th the bass the root (its 5th or 3rd added, as the key's scale has it), over
 * a 6th the melody the root (the bass its 3rd: its 5th added), over a 4th the bass the 5th (the root's 3rd added: a
 * 6/4), over an octave the bass's triad; a dissonance (a 2nd, a 7th: a suspension, a passing note) the bass's triad.
 * Three notes or more that already make a chord are taken as they are. → MIDI pitches.
 */
export function impliedChord(pitches, key = { tonic: "C" }) {
  if (pitches.length >= 3 && chordOf(pitches) && chordOf(pitches).extra === null) return pitches;
  const K = keyPc(key), scale = K.minor ? MINOR : MAJOR;
  const lo = Math.min(...pitches), hi = Math.max(...pitches);
  // (a pitch's degree: the scale's note at or below it; its pitch class back from a degree, ⑦ raised in minor's ⑤)
  const degOf = (p) => { const x = mod(p - K.tonic, 12); let i = 6; while (i > 0 && scale[i] > x) i--; return 7 * Math.floor((p - K.tonic) / 12) + i; };
  const pcOf = (d, rootDeg) => { let x = scale[mod(d, 7)]; if (K.minor && mod(rootDeg, 7) === 4 && mod(d, 7) === 6) x += 1; return mod(K.tonic + x, 12); };
  const iv = mod(degOf(hi) - degOf(lo), 7), b = degOf(lo);
  const add = [];
  if (iv === 2) add.push([b, 4]);
  else if (iv === 4) add.push([b, 2]);
  else if (iv === 5) add.push([b - 2, 4]);
  else if (iv === 3) add.push([b - 4, 2]);
  else { add.push([b, 2]); add.push([b, 4]); }
  const out = [lo, hi];
  for (const [root, off] of add) { const pc = pcOf(root + off, root); let p = lo; while (mod(p, 12) !== pc) p++; out.push(p); }
  return out.sort((a, b2) => a - b2);
}

/** The functions of a succession of chords (pitches each). */
export const functionsOf = (chords, key) => chords.map((ps) => functionOf(ps, key));

/** The function of the chord on a degree of the key (semitones above the tonic), or null where none is diatonic. */
export function fnOfDegree(d, minor = false) {
  if (d === 0 || d === 9 || d === 4 || (minor && (d === 8 || d === 3))) return "T";
  if (d === 2 || d === 5) return "S";
  if (d === 7 || d === 11 || (minor && d === 10)) return "D";
  return null;
}

const ALLOWED = { T: ["T", "S", "D"], S: ["S", "D", "T"], D: ["D", "T"] };
/**
 * Where a succession of functions breaks the grammar: [{i (the chord that breaks it), reason}]. A dominant followed
 * by a subdominant (a retrogression), an applied dominant not followed by its target (its root or its bass), by a
 * chord of its target's function in the key, nor by another applied dominant, and — with end — a phrase not ending
 * on the tonic. key: the key the functions were read in. passing: an inverted chord over a bass going on by step from
 * the chord before is a passing chord, never a retrogression (V – IV6 over ⑤–⑥: Bach's chorales do it in one phrase of
 * ten) — off by default, so that the engine's rule reads the grammar as it was.
 */
export function grammarErrors(fs, { end = true, key = { tonic: "C" }, passing = false } = {}) {
  const errs = [], K = keyPc(key);
  for (let i = 0; i + 1 < fs.length; i++) {
    const a = fs[i], b = fs[i + 1];
    if (!a || !b) continue;
    if (a.fn === "A") {
      // (resolved: into its target — its root, or its bass, the target's 6/4 — or into a chord of the function its
      // target has in the key: V/V into the cadential 6/4 or a dominant 7th over another bass)
      // (a diminished 7th, symmetric, resolves into a chord a semitone above any of its notes, or slides into another
      // diminished 7th; only a dominant's own target says which function may stand for it)
      const dim7 = a.chord.kind === "°7";
      const ok = b.fn === "A" || a.targets.includes(b.chord.root) || a.targets.includes(b.chord.bass) ||
        (dim7 ? b.chord.kind === "°7" : fnOfDegree(mod(a.target - K.tonic, 12), K.minor) === b.fn);
      if (!ok) errs.push({ i: i + 1, reason: `an applied dominant not resolved: its target is ${NAMES[a.target]}` });
      continue;
    }
    if (b.fn === "A") continue;
    // (a chain of 6/3s, the bass by step under them — a fauxbourdon, a 7–6 chain resolved — is a line, not a
    // succession of functions: the sequence prolongs, and the grammar holds again where it ends)
    // (and a chord inverted over a bass going on by step from the one before is a passing chord: V – IV6 over ⑤–⑥,
    // as Bach's chorales pass — the bass's line, not a function taken back)
    const sixth = (f) => f.chord.bass !== f.chord.root && mod(f.chord.bass - f.chord.root, 12) <= 4 && mod(f.chord.bass - f.chord.root, 12) >= 3;
    const step = mod(a.chord.bass - b.chord.bass, 12), byStep = step === 1 || step === 2 || step === 10 || step === 11;
    if (sixth(a) && sixth(b) && byStep) continue;
    if (passing && b.chord.bass !== b.chord.root && byStep) continue;
    if (!ALLOWED[a.fn].includes(b.fn)) errs.push({ i: i + 1, reason: `${a.fn} → ${b.fn}: the dominant taken back before it is resolved` });
  }
  if (end && fs.length && fs[fs.length - 1] && fs[fs.length - 1].fn !== "T") errs.push({ i: fs.length - 1, reason: "the phrase does not end on the tonic" });
  return errs;
}

const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const KEYNAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/** The keys closely related to a key (as {tonic, mode}): itself, its dominant's and subdominant's, and its relative
 *  (in minor: its relative major, its minor dominant's and subdominant's). */
export function relatedKeys(key = { tonic: "C" }) {
  const K = keyPc(key), k = (pc, mode) => ({ tonic: KEYNAMES[mod(pc, 12)], mode });
  return K.minor ? [k(K.tonic, "minor"), k(K.tonic + 3, "major"), k(K.tonic + 7, "minor"), k(K.tonic + 5, "minor")]
                 : [k(K.tonic, "major"), k(K.tonic + 7, "major"), k(K.tonic + 5, "major"), k(K.tonic + 9, "minor")];
}

/**
 * The functions of a succession of chords read in local keys: a phrase moves (a chorale's tonicizes where it closes),
 * so each chord is read in one of the keys close to the home key — and in the key it ends in, where given — the
 * succession that breaks the grammar least, a change of key costing `change` (a modulation is heard, not free). The
 * last chord in `end` where given. → {keys (one a chord), fs (each chord's function in its key), errors ([{i,
 * reason}], each succession read in the later chord's key)}.
 */
export function localFunctions(chords, home = { tonic: "C" }, { end = null, change = 0.6, passing = true } = {}) {
  const keys = relatedKeys(home);
  if (end && !keys.some((k) => keyPc(k).tonic === keyPc(end).tonic && keyPc(k).minor === keyPc(end).minor)) keys.push(end);
  const n = chords.length, K = keys.length;
  if (!n) return { keys: [], fs: [], errors: [] };
  const fs = keys.map((k) => functionsOf(chords, k));
  const errAt = (k, i) => grammarErrors([fs[k][i - 1], fs[k][i]], { key: keys[k], end: false, passing }).length;
  let cost = keys.map(() => 0);
  const from = [];
  for (let i = 1; i < n; i++) {
    const nc = [], fr = [];
    for (let k = 0; k < K; k++) {
      let best = Infinity, bj = 0;
      for (let j = 0; j < K; j++) { const c = cost[j] + (j === k ? 0 : change); if (c < best) { best = c; bj = j; } }
      nc.push(best + errAt(k, i)); fr.push(bj);
    }
    cost = nc; from.push(fr);
  }
  let k = end ? keys.findIndex((x) => keyPc(x).tonic === keyPc(end).tonic && keyPc(x).minor === keyPc(end).minor) : cost.indexOf(Math.min(...cost));
  const path = [k];
  for (let i = n - 1; i >= 1; i--) { k = from[i - 1][k]; path.unshift(k); }
  const errors = [];
  for (let i = 1; i < n; i++) for (const e of grammarErrors([fs[path[i]][i - 1], fs[path[i]][i]], { key: keys[path[i]], end: false, passing })) errors.push({ ...e, i, key: keys[path[i]] });
  return { keys: path.map((x) => keys[x]), fs: path.map((x, i) => fs[x][i]), errors };
}

/** A function in words: T, S, D, or V/x for an applied dominant. */
export const label = (f) => (!f ? "?" : f.fn === "A" ? "V/" + NAMES[f.target] : f.fn);
