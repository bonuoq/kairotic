// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: the bass under a soprano (Study 76 · continuo, #353) — the bridge of the outer voices with the
// soprano given at every unit: a bass in quarters, its figures and its local keys, drawn exactly (backward messages,
// as outer.mjs's bridges) under Bach's soprano.
//
//   the state      of each quarter: (local key, bass note, chord over it — its figure)
//   the rules      always: the soprano a chord tone (or, with continuo.mjs's BACH_DISSONANCES, a suspension, passing,
//                  neighbour or held note as Bach's); the bass in its range, below the soprano, no augmented 2nd, nor
//                  wider than the octave (a tritone or a 7th as rare as his); no parallel 5ths or octaves between the outer
//                  voices, nor direct ones with the soprano leaping
//   the costs      −log of how often Bach does it (under-tables.mjs, counted on his chorales, or the `costs` given):
//                  the chord over its bass degree (the rule of the octave as he plays it, by mode, in the local key),
//                  the soprano over the bass, their relative motion, the bass's move, a bass held on a strong beat
//                  or a weak one, the cadence into the fermata and its chord, the key the phrase begins in
//   functions      a succession the grammar of a tonal phrase refuses (functions.mjs, read in the local keys) costing
//                  `functions` (so applied dominants resolve, the one- and two-chord tonicizations among them)
//   keys           the local key moves as Bach's do (outer.mjs's KEY_MOVES, KEY_RATE times as eager); off (no-keys):
//                  every quarter in the chorale's key
//   economy        the bass's figures (its move and its chord) as words, one heard before cheaper — in the forward
//                  draw only, as the bridges' economy
//
// Pure data and functions.

import { functionOf, grammarErrors } from "./functions.mjs";
import { KEY_MOVES, KEY_RATE, keyName, keyOfName } from "./outer.mjs";
import { lexicon, economyOf } from "./bits.mjs";
import { UNDER_TABLES } from "./under-tables.mjs";

export { keyOfName };
const mod = (a, m) => ((a % m) + m) % m;
const LOG0 = -Infinity;
const lse = (a, b) => (a === LOG0 ? b : b === LOG0 ? a : Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b))));
const TONICS = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const tonicPc = (key) => TONICS[String(key.tonic || "C").replace("♯", "#").replace("♭", "b")] ?? 0;
const isMinor = (key) => key.mode === "minor" || key.mode === "aeolian";
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];

/** The chords' kinds (functions.mjs's), their intervals above the root. */
export const KIND_INTERVALS = { "": [0, 4, 7], m: [0, 3, 7], "°": [0, 3, 6], "+": [0, 4, 8], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], "°7": [0, 3, 6, 9], "ø7": [0, 3, 6, 10] };
const TRIAD = ["5/3", "6/3", "6/4"], SEVENTH = ["7", "6/5", "4/3", "4/2"];
/** A chord's figure over its bass ({root, kind, bass}, pitch classes): "5/3", "6/3", "6/4", "7", "6/5", "4/3", "4/2". */
export function figureOf(ch) {
  const iv = KIND_INTERVALS[ch.kind];
  if (!iv) return null;
  const i = iv.indexOf(mod(ch.bass - ch.root, 12));
  return i < 0 ? null : (iv.length === 3 ? TRIAD : SEVENTH)[i];
}
/** The root of the chord of a kind with this figure over this bass (pitch classes). */
export function rootOf(bass, figure, kind) {
  const iv = KIND_INTERVALS[kind], i = (iv.length === 3 ? TRIAD : SEVENTH).indexOf(figure);
  return i < 0 ? null : mod(bass - iv[i], 12);
}
/** Whether a phrase is one the tables leave out, to measure on: its chorale's number a multiple of 5. */
export const isHeldOut = (p) => Number(p.chorale) % 5 === 0;

// (each chord tone's figure number by inversion: which of the chord's notes is the bass → the numbers of the others)
const NUMBERS = { "5/3": [1, 3, 5], "6/3": [6, 1, 3], "6/4": [4, 6, 1], 7: [1, 3, 5, 7], "6/5": [6, 1, 3, 5], "4/3": [4, 6, 1, 3], "4/2": [2, 4, 6, 1] };
const NATURAL = [0, 2, 4, 5, 7, 9, 11], LETTER = "CDEFGAB";
/** The pitch class each letter (C … B) has in the key signature of `key`. */
export function letterPcs(key) {
  const t = LETTER.indexOf(String(key.tonic || "C")[0].toUpperCase()), sc = isMinor(key) ? MINOR : MAJOR, out = [];
  for (let i = 0; i < 7; i++) out[(t + i) % 7] = mod(tonicPc(key) + sc[i], 12);
  return out;
}
/** A chord's root as a letter (0 … 6) in `key`: the letter the signature gives it; a root out of the signature the
 *  letter above lowered (♭VII, ♭VI), or the one below raised for a diminished chord (a leading tone's: ♯iv°). */
function rootLetter(root, kind, sig) {
  const i = sig.indexOf(root);
  if (i >= 0) return i;
  const up = sig.findIndex((pc) => mod(pc - 1, 12) === root), down = sig.findIndex((pc) => mod(pc + 1, 12) === root);
  if (/°|ø/.test(kind)) return down >= 0 ? down : up;
  return up >= 0 ? up : down;
}
/**
 * A chord's figure as a continuo player reads it against the key signature of `home`: the figure's numbers, top down,
 * a note out of the signature marked on its number (♯, ♭, or ♮ where it undoes the signature) — a number the figure
 * leaves out added where its note is altered ("6/5/♯3"). Each note is spelt as the chord's letters have it (its root's
 * letter, a 3rd, a 5th, a 7th above). Not yet Bach's abbreviations (continuo.mjs's BACH_WRITES do those).
 */
export function figureText(root, kind, figure, home) {
  const iv = KIND_INTERVALS[kind], nums = NUMBERS[figure], sig = letterPcs(home), r = rootLetter(root, kind, sig);
  const shown = figure.split("/").map(Number), marks = {};
  iv.forEach((x, i) => {
    const pc = mod(root + x, 12), num = nums[i];
    if (num === 1) return;
    const L = (r + 2 * i) % 7, d = mod(pc - sig[L] + 6, 12) - 6;
    if (!d) return;
    marks[num] = mod(pc - NATURAL[L], 12) === 0 ? "♮" : d > 0 ? (d === 2 ? "𝄪" : "♯") : (d === -2 ? "𝄫" : "♭");
  });
  const all = [...new Set([...shown, ...Object.keys(marks).map(Number)])].sort((a, b) => b - a);
  return all.map((x) => (marks[x] || "") + x).join("/");
}

/** −log of a count's share of its table (counts {category: n}), smoothed: an unseen category as one seen half a time. */
function coster(table, alpha = 0.5) {
  const entries = Object.entries(table || {}), N = entries.reduce((a, [, c]) => a + c, 0), V = entries.length + 1;
  const z = Math.log(N + alpha * V), unseen = z - Math.log(alpha);
  const m = new Map(entries.map(([k, c]) => [String(k), z - Math.log(c + alpha)]));
  return (k) => m.get(String(k)) ?? unseen;
}
const costersOf = (T) => ({
  vertical: coster(T.vertical), motion: coster(T.motion), move: coster(Object.fromEntries(Object.entries(T.move).filter(([k]) => k !== "0"))), chord: coster(T.chord), end: coster(T.end),
  endChord: coster(T.endChord), held: { strong: coster(T.held.strong), weak: coster(T.held.weak) }, start: coster(T.start),
});
/** The chords over each bass degree Bach uses at least `min` times, by mode: [{bassRel, figure, kind}]. */
/** −log P(kind | the bass degree and the figure), from counts as under-tables.mjs's: which chord a figure is. */
const kindCoster = (T) => {
  const tot = {};
  for (const [k, c] of Object.entries(T.chord)) { const [b, f] = k.split("|"); tot[`${b}|${f}`] = (tot[`${b}|${f}`] || 0) + c; }
  return (bassRel, figure, kind) => { const c = T.chord[`${bassRel}|${figure}|${kind}`] || 0, z = tot[`${bassRel}|${figure}`] || 0; return Math.log(z + 1) - Math.log(c + 0.5); };
};
/**
 * The costs of @kairotic/rules' continuo.mjs (the chorale thread's tables: BACH_OUTER_VERTICAL, BACH_OUTER_PAIR,
 * BACH_DEGREE_CHORD, BACH_CADENCES) as the bridge reads them: the chord over a degree and the degree, the vertical,
 * the two voices' moves together (in place of the motion, the bass held and the step), the cadence's two quarters (in
 * place of the cadence's bass and chord). The kind of chord a figure is, the size of a leap and the key a phrase
 * begins in stay under-tables.mjs's.
 */
function continuoCosters(K) {
  const D = K.BACH_DEGREE_CHORD, cls = (d) => (d === 0 ? 2 : d < 0 ? (d >= -2 ? 1 : 0) : d <= 2 ? 3 : 4);
  const cad = Object.fromEntries(["major", "minor"].map((m) => {
    const rows = K.BACH_CADENCES[m] || [], floor = -Math.log(Math.min(...rows.map(([, x]) => x), 0.01) / 2);
    const map = new Map(rows.map(([w, x]) => [w, -Math.log(x)]));
    return [m, (w) => map.get(w) ?? floor];
  }));
  return Object.fromEntries(["major", "minor"].map((m) => [m, {
    chord: (bassRel, figure) => { const j = D[m].chords.indexOf(figure); return D[m].degree[bassRel] + (j < 0 ? 8 : D[m].chord[bassRel][j]); },
    vertical: (iv) => K.BACH_OUTER_VERTICAL[iv],
    pair: (ds, db) => K.BACH_OUTER_PAIR[cls(ds) * 5 + cls(db)],
    cadence: cad[m],
  }]));
}
const inventoryOf = (T, min) => Object.entries(T.chord).filter(([, c]) => c >= min).map(([k]) => { const [b, figure, kind] = k.split("|"); return { bassRel: Number(b), figure, kind }; });

export const UNDER_RANGE = [36, 64];
export const UNDER_VARIANTS = [{ name: "all" }, { name: "no-functions", functions: 0 }, { name: "no-keys", keys: false }, { name: "no-economy", economy: 0 }];

/**
 * The bridge of a bass under a soprano: {soprano: [MIDI a quarter], key (the chorale's), strong: [bool], fermata:
 * [bool] (the cadences; by default the last quarter), costs (tables as under-tables.mjs's, in place of them), continuo
 * (@kairotic/rules' continuo.mjs, or its tables: the chorale thread's costs, read by continuoCosters),
 * weights, variant, temp}. → {possible, logZ, n, draw(r) → {bass, figures, chords, keys}, logProb(bass) (the
 * probability of a given bass line, every chord and key under it summed, the economy aside)}.
 */
export function underBridge({ soprano, key, strong = [], fermata = null, costs = null, continuo = null, weights = {}, variant = "all", temp = 1, min = 3, range = UNDER_RANGE }) {
  const V = typeof variant === "string" ? UNDER_VARIANTS.find((v) => v.name === variant) || UNDER_VARIANTS[0] : variant;
  const W = { chord: 0.7, vertical: 0.5, motion: 0.5, move: 1.2, held: 1, end: 1, endChord: 1, keys: 1, start: 1, functions: 3, sameChord: 0.7, leading: 2, economy: 1,
              position: 1, applied: 0, resolve: 1.5, ...weights };
  if (V.functions === 0) { W.functions = 0; W.resolve = 0; }
  if (V.economy === 0) W.economy = 0;
  const tables = costs || UNDER_TABLES;
  if (!tables) throw new Error("bassUnder: no tables (run tools/under-tables.mjs, or give costs)");
  const n = soprano.length, T = Math.max(1e-3, temp), home = key, hm = isMinor(home) ? "minor" : "major";
  const C = { major: costersOf(tables.major), minor: costersOf(tables.minor) }, INV = { major: inventoryOf(tables.major, min), minor: inventoryOf(tables.minor, min) };
  // (the harmonic map: what the chord over its degree costs at this tenth of the phrase beyond what it costs anywhere —
  // −log P(degree|figure | tenth) + log P(degree|figure), so the chord is not counted twice; and an applied dominant's
  // figure as Bach's secondary dominants have it)
  const ratio = (part, whole, alpha = 0.5) => {
    const pz = Object.values(part || {}).reduce((a, b) => a + b, 0), wz = Object.values(whole || {}).reduce((a, b) => a + b, 0), V = Object.keys(whole || {}).length + 1;
    return (k) => (pz && wz ? -Math.log(((part[k] || 0) + alpha) / (pz + alpha * V)) + Math.log(((whole[k] || 0) + alpha) / (wz + alpha * V)) : 0);
  };
  const POS = Object.fromEntries(["major", "minor"].map((m) => {
    const P = (tables[m] && tables[m].position) || [], all = {};
    for (const d of P) for (const [k, c] of Object.entries(d)) all[k] = (all[k] || 0) + c;
    return [m, P.map((d) => ratio(d, all))];
  }));
  // (−log P(figure | a secondary dominant), its likeliest 0: it shapes which figure, never makes one likelier)
  const APPLIED = (() => {
    const F = tables.applied && tables.applied.figure;
    if (!F) return () => 0;
    const z = Object.values(F).reduce((a, b) => a + b, 0), c = (k) => -Math.log(((F[k] || 0) + 0.5) / (z + 4)), m = Math.min(...Object.keys(F).map(c));
    return (k) => c(k) - m;
  })();
  const tenth = (t) => Math.min(9, Math.floor(10 * t / Math.max(1, n - 1)));
  // (with `continuo`, the chorale thread's tables in place of the chord, the vertical, the moves and the cadence)
  const CC = continuo ? continuoCosters(continuo) : null, KC = CC ? { major: kindCoster(tables.major), minor: kindCoster(tables.minor) } : null;
  if (CC) Object.assign(W, { chord: 0.6, kind: 1, vertical: 0.4, pair: 0.6, leap: 0.5, cadence: 1.5, sameChord: 1, dissonance: 1, ...weights });
  const fer = Array.from({ length: n }, (_, t) => (fermata ? !!fermata[t] : t === n - 1));
  // the local keys: the chorale's and those Bach goes to from it (KEY_MOVES), or the chorale's alone
  const M = KEY_MOVES[hm], rels = V.keys === false ? [hm === "minor" ? "0m" : "0M"] : Object.keys(M);
  const KEYS = rels.map((rel) => ({ rel, key: { tonic: NAMES[mod(tonicPc(home) + parseInt(rel, 10), 12)], mode: rel.endsWith("m") ? "minor" : "major" } }));
  const keyMove = KEYS.map((a) => KEYS.map((b) => {
    const row = M[a.rel] || {}, tot = Object.entries(row).reduce((s, [y, c]) => s + (y === a.rel ? c : c * KEY_RATE), 0);
    const c = row[b.rel] ? (b.rel === a.rel ? row[b.rel] : row[b.rel] * KEY_RATE) : 0;
    return c ? -Math.log(c / tot) : Infinity;
  }));
  // the states of each quarter
  const chordMemo = new Map();
  const chordIn = (ki, inv) => {
    const k = `${ki}|${inv.bassRel}|${inv.figure}|${inv.kind}`;
    let v = chordMemo.get(k);
    if (!v) {
      const K = KEYS[ki].key, bass = mod(tonicPc(K) + inv.bassRel, 12), root = rootOf(bass, inv.figure, inv.kind);
      const pcs = KIND_INTERVALS[inv.kind].map((x) => mod(root + x, 12));
      const pitches = [48 + bass, ...pcs.map((pc) => 48 + bass + mod(pc - bass, 12) + 12)];
      const mode = isMinor(K) ? "minor" : "major";
      v = { ki, inv, bass, root, pcs: new Set(pcs), kind: inv.kind, figure: inv.figure, pitches, mode,
            cost: CC ? CC[mode].chord(inv.bassRel, inv.figure) + W.kind * KC[mode](inv.bassRel, inv.figure, inv.kind) / W.chord : C[mode].chord(`${inv.bassRel}|${inv.figure}|${inv.kind}`),
            endCost: CC ? 0 : C[mode].endChord(`${inv.bassRel}|${inv.figure}|${inv.kind}`),
            fn: functionOf(pitches, K), fnHome: functionOf(pitches, home), fnIn: new Map() };
      chordMemo.set(k, v);
    }
    return v;
  };
  // (the soprano's own motion at each quarter, as continuo.mjs's motionOf reads it — it is given: held from the quarter
  // before and down a step after, a suspension; in and out by step, passing or neighbour; held over the next…)
  const STEP = (d) => Math.abs(d) >= 1 && Math.abs(d) <= 2;
  const smotion = soprano.map((s, t) => {
    const into = t ? s - soprano[t - 1] : null, out = t < n - 1 ? soprano[t + 1] - s : null, held = t > 0 && into === 0;
    if (held && out !== null && out < 0 && STEP(out)) return "suspension";
    if (held && out !== null && out > 0 && STEP(out)) return "suspension-up";
    if (held && out === 0) return "held";
    if (into !== null && out !== null && STEP(into) && STEP(out)) return Math.sign(into) === Math.sign(out) ? "passing" : "neighbour";
    if (held) return "held";
    return null;
  });
  // (the dissonances the soprano may be: continuo.mjs's BACH_DISSONANCES, "soprano|motion|interval|beat" → count;
  // only those whose shape the bridge keeps — a suspension resolved over the same bass, a passing or neighbour quarter
  // over the chord before or a 4/2, a note held over a moving bass into a 4/2 or a 7 — and never at a fermata)
  const DIS = CC && continuo.BACH_DISSONANCES ? continuo.BACH_DISSONANCES : null;
  // (−log of how often, of the soprano's quarters of that motion on that beat, Bach makes it this dissonance:
  // BACH_DISSONANCES's count over under-tables.mjs's sopMotion)
  const disCost = (motion, interval, beat) => {
    const c = DIS && DIS[`soprano|${motion}|${interval}|${beat}`], z = tables.sopMotion && tables.sopMotion[`${motion}|${beat}`];
    return c && z ? -Math.log(Math.min(c, z) / z) : Infinity;
  };
  const generic = (hi, lo, K) => { const g = (p) => { const x = mod(p - tonicPc(K), 12), sc = isMinor(K) ? MINOR : MAJOR; let i = 6; while (i > 0 && sc[i] > x) i--; return 7 * Math.floor((p - tonicPc(K)) / 12) + i; }; return mod(g(hi) - g(lo), 7) + 1; };
  const states = Array.from({ length: n }, (_, t) => {
    const s = soprano[t], out = [];
    const sm = smotion[t], canDis = DIS && sm && !fer[t] && ["suspension", "passing", "neighbour", "held"].includes(sm);
    KEYS.forEach((_, ki) => {
      const mode = isMinor(KEYS[ki].key) ? "minor" : "major";
      for (const inv of INV[mode]) {
        const ch = chordIn(ki, inv), tone = ch.pcs.has(mod(s, 12));
        if (!tone && !canDis) continue;
        for (let b = range[0]; b <= range[1]; b++) {
          if (mod(b, 12) !== ch.bass || s - b < 3 || s - b > 36) continue;
          let dis = null;
          if (!tone) {
            const interval = generic(s, b, KEYS[ki].key), c = disCost(sm, interval, strong[t] ? "strong" : "weak");
            if (c === Infinity) continue;
            dis = { motion: sm, interval, cost: c };
          }
          let u = W.chord * ch.cost + W.vertical * (CC ? CC[mode].vertical(mod(s - b, 12)) : C[mode].vertical(mod(s - b, 12)));
          if (dis) u += W.dissonance * dis.cost;
          if (W.position && POS[mode][tenth(t)]) u += W.position * POS[mode][tenth(t)](`${inv.bassRel}|${inv.figure}`);
          if (W.applied && ch.fnHome && ch.fnHome.fn === "A") u += W.applied * APPLIED(inv.figure);
          if (fer[t] && t > 0) u += W.endChord * ch.endCost;
          if (t === 0) u += W.start * C[hm].start(KEYS[ki].rel);
          out.push({ ki, b, ch, u, dis });
        }
      }
    });
    return out;
  });
  const fnOf = (ch, ki) => { if (ki === ch.ki) return ch.fn; let f = ch.fnIn.get(ki); if (f === undefined) { f = functionOf(ch.pitches, KEYS[ki].key); ch.fnIn.set(ki, f); } return f; };
  const gram = new Map();
  const fnErrors = (a, z) => {
    const k = `${a.ch.ki}|${a.ch.inv.bassRel}|${a.ch.figure}|${a.ch.kind}>${z.ch.ki}|${z.ch.inv.bassRel}|${z.ch.figure}|${z.ch.kind}`;
    let v = gram.get(k);
    if (v === undefined) {
      const g = (ki) => grammarErrors([fnOf(a.ch, ki), fnOf(z.ch, ki)], { key: KEYS[ki].key, end: false, passing: true }).length;
      v = a.ki === z.ki ? g(z.ki) : Math.min(g(z.ki), g(a.ki));
      gram.set(k, v);
    }
    return v;
  };
  const perfect = (i) => i === 0 || i === 7;
  /** The cost of going from state a at t − 1 to z at t (Infinity: a rule broken). */
  const step = (t, a, z) => {
    const s0 = soprano[t - 1], s = soprano[t], d = z.b - a.b, ad = Math.abs(d);
    // (a dissonance's shape: a suspension resolves over the same bass (or its octave); a passing or neighbour soprano over the chord
    // before or a 4/2; a note held over a bass that moves, into a 4/2 or a 7)
    if (a.dis && a.dis.motion === "suspension" && mod(z.b - a.b, 12) !== 0) return Infinity;
    if (z.dis) {
      const m = z.dis.motion, same = d === 0 && a.ch.root === z.ch.root && a.ch.kind === z.ch.kind;
      if ((m === "passing" || m === "neighbour") && !same && z.ch.figure !== "4/2") return Infinity;
      if (m === "held" && (d === 0 || !["4/2", "7"].includes(z.ch.figure))) return Infinity;
    }
    // (a tritone or a 7th as rare as Bach makes them — his table's cost —, past the octave never)
    if (ad > 12) return Infinity;
    const K = KEYS[z.ki].key;
    if (isMinor(K) && ad === 3) { const r0 = mod(a.b - tonicPc(K), 12), r1 = mod(z.b - tonicPc(K), 12); if ((r0 === 8 && r1 === 11) || (r0 === 11 && r1 === 8)) return Infinity; }
    const ds = Math.sign(s - s0), db = Math.sign(d), iv = mod(s - z.b, 12);
    if (perfect(iv) && ds && ds === db && ((perfect(mod(s0 - a.b, 12)) && mod(s0 - a.b, 12) === iv) || Math.abs(s - s0) > 2)) return Infinity;
    const mode = z.ch.mode, Cm = C[mode];
    // (the bass's move: held or not by the beat, how far among the moves)
    let c = z.u;
    if (CC) c += W.pair * CC[mode].pair(s - s0, d) + (ad > 2 ? W.leap * Cm.move(Math.min(13, ad)) : 0);
    else {
      c += (ad ? W.move * Cm.move(Math.min(13, ad)) : 0) + W.motion * Cm.motion(!ds && !db ? "static" : !ds || !db ? "oblique" : ds === db ? "similar" : "contrary");
      c += W.held * Cm.held[strong[t] ? "strong" : "weak"](d === 0 ? "held" : "moved");
    }
    if (a.ki !== z.ki) { const km = keyMove[a.ki][z.ki]; if (km === Infinity) return Infinity; c += W.keys * km; }
    else c += W.keys * keyMove[a.ki][a.ki];
    if (W.functions) c += W.functions * fnErrors(a, z);
    // (a secondary dominant — an applied dominant in the chorale's key — goes to its chord, or stays itself)
    if (W.resolve && a.ch.fnHome && a.ch.fnHome.fn === "A" && !(a.ch.root === z.ch.root && a.ch.kind === z.ch.kind) &&
        !(a.ch.fnHome.targets || [a.ch.fnHome.target]).includes(z.ch.root)) c += W.resolve;
    if (a.ch.root === z.ch.root && a.ch.kind === z.ch.kind && a.ki === z.ki) c += W.sameChord;
    // (the leading tone in the bass of a dominant goes up)
    if (a.ch.fn && a.ch.fn.fn === "D" && mod(a.b - tonicPc(KEYS[a.ki].key), 12) === 11 && d !== 1) c += W.leading;
    if (fer[t]) c += CC ? W.cadence * CC[mode].cadence(`${mod(a.b - tonicPc(K), 12)}:${a.ch.figure} ${mod(z.b - tonicPc(K), 12)}:${z.ch.figure}`)
                        : W.end * Cm.end(`${mod(a.b - tonicPc(K), 12)}>${mod(z.b - tonicPc(K), 12)}`);
    return c;
  };
  // the backward messages
  const back = Array.from({ length: n }, () => null);
  back[n - 1] = states[n - 1].map(() => 0);
  for (let t = n - 2; t >= 0; t--) {
    back[t] = states[t].map((a) => {
      let z = LOG0;
      states[t + 1].forEach((y, j) => {
        if (back[t + 1][j] === LOG0) return;
        const c = step(t + 1, a, y);
        if (c !== Infinity) z = lse(z, -c / T + back[t + 1][j]);
      });
      return z;
    });
  }
  let logZ = LOG0;
  states[0].forEach((a, i) => { if (back[0][i] !== LOG0) logZ = lse(logZ, -a.u / T + back[0][i]); });
  const pick = (cs, r) => {
    const m = Math.max(...cs.map((x) => x.lw));
    let tot = 0;
    for (const x of cs) tot += (x.w = Math.exp(x.lw - m));
    let u = r() * tot;
    for (const x of cs) { u -= x.w; if (u <= 0) return x.j; }
    return cs[cs.length - 1].j;
  };
  const word = (a, z) => `${z.b - a.b}|${z.ch.figure}`;
  // (a suspension figured as Bach figures it, its number then its resolution's over the same bass: 4 3, 9 8, 7 6)
  const RESOLVES = { 4: 3, 2: 8, 9: 8, 7: 6 };
  const out = (path) => ({
    bass: path.map((x) => x.b),
    figures: path.map((x, t) => (x.dis && x.dis.motion === "suspension" ? String(x.dis.interval === 2 ? 9 : x.dis.interval)
      : t > 0 && path[t - 1].dis && path[t - 1].dis.motion === "suspension" && mod(path[t - 1].b - x.b, 12) === 0 ? String(RESOLVES[path[t - 1].dis.interval] || "")
      : figureText(x.ch.root, x.ch.kind, x.ch.figure, home))),
    chords: path.map((x) => ({ root: NAMES[x.ch.root], kind: x.ch.kind, figure: x.ch.figure, ...(x.dis ? { dissonance: { motion: x.dis.motion, interval: x.dis.interval } } : {}) })),
    keys: path.map((x) => keyName(KEYS[x.ki].key)),
  });
  return {
    n, logZ, possible: logZ !== LOG0,
    /** A bass line drawn: each quarter in proportion to every way from it to the end (the economy, forward only). */
    draw(r = Math.random) {
      if (logZ === LOG0) return null;
      const lex = W.economy ? lexicon({ kinds: 60 }) : null;
      let cs = states[0].map((a, j) => ({ j, lw: -a.u / T + back[0][j] })).filter((x) => x.lw !== LOG0);
      const path = [states[0][pick(cs, r)]];
      for (let t = 1; t < n; t++) {
        const a = path[t - 1];
        cs = [];
        states[t].forEach((z, j) => {
          if (back[t][j] === LOG0) return;
          let c = step(t, a, z);
          if (c === Infinity) return;
          if (lex) c += economyOf(lex, word(a, z), W.economy);
          cs.push({ j, lw: -c / T + back[t][j] });
        });
        if (!cs.length) return null;
        const z = states[t][pick(cs, r)];
        if (lex) lex.add(word(a, z));
        path.push(z);
      }
      return out(path);
    },
    /** ln P(the bass line), every chord and key under it summed — the model's surprise at a given bass (Bach's). */
    logProb(bass) {
      if (logZ === LOG0 || bass.length !== n) return LOG0;
      let f = states[0].map((a) => (a.b === bass[0] ? -a.u / T : LOG0));
      for (let t = 1; t < n; t++) {
        f = states[t].map((z) => {
          if (z.b !== bass[t]) return LOG0;
          let v = LOG0;
          states[t - 1].forEach((a, i) => { if (f[i] === LOG0) return; const c = step(t, a, z); if (c !== Infinity) v = lse(v, f[i] - c / T); });
          return v;
        });
      }
      return f.reduce((a, v) => lse(a, v), LOG0) - logZ;
    },
  };
}

/** A bass under a soprano, drawn once: {bass, figures, chords, keys} a quarter (null where none can be). */
export function bassUnder({ r = Math.random, ...spec }) {
  const B = underBridge(spec);
  return B.possible ? B.draw(r) : null;
}
