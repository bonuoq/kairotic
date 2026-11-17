// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 54 · parts: a given bass realized in three parts — the schemata of chapter 2 of Job IJzerman's
// Harmony, Counterpoint, Partimento (the Fauxbourdon, the Monte, the 7–6 Fauxbourdon, the stepwise Romanesca, the
// Fifth Down Fourth Up, the Tied Bass) closed by a cadence of chapter 3 (simple, compound with 6/4 or 5/4, Galant,
// deceptive, half): a phrase as a plan, a schema then a cadence, as the book's exercises ask.
//
// Each of the two upper voices is held to Study 51's rules against the bass (schemata.mjs, the copy here: a 7th, a
// 4th or a 9th held in the voice, a 2nd or a 4th held in the bass, passing tones, no parallel perfect intervals…).
// Between the upper voices the rules of upper voices: a 4th is a consonance there (the Fauxbourdon is parallel 4ths
// above the parallel 6ths), no parallel 5ths or octaves, no crossing, within an octave; a 2nd or a 7th only where
// one of the two is itself the dissonance against the bass (the 5/4 of a compound cadence). The figures of a chord
// (5/3, 6/3, 7/3, 4/2, 6/4, 5/4) say which intervals there are above the bass, not which voice has them: a 5/3 may
// leave out its 5th and double the bass (the book's (5)/3), never its 3rd; a 6/3 and a 7/3 sound complete.
//
// The realizations are counted exactly, drawn uniformly, or drawn by the engine with the soft rules of Studies
// 38–42 (soft.mjs).

import { schemata as voiceOf, keyOf, codeOf } from "./schemata.mjs";
import { total, choose, temperature } from "./soft.mjs";

const mod = (a, m) => ((a % m) + m) % m;
const sign = (x) => (x > 0) - (x < 0);

// ─── chords: the classes of interval above the bass (0 the octave, 2 the 3rd, 4 the 5th, 5 the 6th…) ───
// need: every one of them sounds; ok: nothing else does
export const CHORDS = {
  "5/3": { need: [2], ok: [2, 4, 0] },
  "6/3": { need: [5, 2], ok: [5, 2] },
  "7/3": { need: [6, 2], ok: [6, 2] },
  "4/2": { need: [1, 3], ok: [1, 3, 5] },
  "6/4": { need: [5, 3], ok: [5, 3, 0] },
  "5/4": { need: [3], ok: [3, 4, 0] },
};
const FIG = [8, 2, 3, 4, 5, 6, 7];

// ─── the phrase: a schema (chapter 2), then a cadence (chapter 3) ───
// An event: [degree of the bass, units, the chord over each unit]; a unit is half a bar. A schema may have its own
// meter (meter 1: every unit strong, a chord a beat, as the 7/3 chain moves). ap: a unit that allows an accented
// passing tone.
const run = (from, to, len, figs) => { const out = []; for (let d = from; from > to ? d >= to : d <= to; d += from > to ? -1 : 1) out.push([d, len, figs]); return out; };
export const SCHEMATA = {
  fauxbourdon: { name: "Fauxbourdon", ref: "IJzerman 2.1, ex. 2.7", about: "parallel 6/3 chords on the scale, down from the high ①: the upper voices in 4ths, over the bass in 6ths and 3rds",
                 events: [[7, 2, ["5/3", "5/3"]], ...run(6, 1, 2, ["6/3", "6/3"]), [0, 2, ["5/3", "5/3"]]] },
  monte: { name: "Monte (5–6)", ref: "IJzerman 2.2, ex. 2.8–2.12", about: "a 5/3 and a 6/3 on each step of a rising bass: the middle voice in 10ths with it, the upper syncopated, 5–6",
           events: [...run(0, 2, 2, ["5/3", "6/3"])] },
  "fauxbourdon-76": { name: "7–6 Fauxbourdon", ref: "IJzerman 2.2, ex. 2.13–2.15", about: "the Monte's mirror: a 7/3 and a 6/3 on each step of a falling bass, the 7th prepared by the 6th before it",
                      events: [[7, 2, ["5/3", "6/3"]], ...run(6, 2, 2, ["7/3", "6/3"])] },
  romanesca: { name: "stepwise Romanesca", ref: "IJzerman 2.3, ex. 2.16–2.21", about: "a falling scale from ① to ③: a 5/3 on the strong units, a 6/3 on the weak, the middle voice in 3rds with the bass",
               events: [[7, 1, ["5/3"]], [6, 1, ["6/3"]], [5, 1, ["5/3"]], [4, 1, ["6/3"]], [3, 1, ["5/3"]], [2, 1, ["6/3"]]] },
  "fifths-73": { name: "Fifth Down Fourth Up (7/3)", ref: "IJzerman 2.4, ex. 2.22–2.25", about: "7/3 chords on falling 5ths and rising 4ths, a chord a beat: the 3rd of each chord held into the 7th of the next, the 7th resolving to the 3rd of the next",
                 meter: 1, events: [[7, 1, ["5/3"]], [3, 1, ["7/3"]], [6, 1, ["7/3"]], [2, 1, ["7/3"]], [5, 1, ["7/3"]], [1, 1, ["7/3"]]] },
  "tied-bass": { name: "Tied Bass (4/2–6/3)", ref: "IJzerman 2.5, ex. 2.26–2.30", about: "the 2–3 in three parts: each bass note tied over the bar, a 4/2 on the strong unit and the 6/3 of its resolution on the weak",
                 events: [[7, 3, ["5/3", "5/3", "4/2"]], ...run(6, 3, 2, ["6/3", "4/2"]), [2, 1, ["6/3"]]] },
};
// the cadences: ⑤ placed by the bass of the schema before it (the nearest), the rest after it
export const CADENCES = {
  simple: { name: "simple", ref: "IJzerman 3.1, ex. 3.5", about: "⑤–① with 5/3 chords only: perfect when the upper voice closes on 1̂, imperfect on 3̂",
            events: [[4, 2, ["5/3", "5/3"]], [0, 1, ["5/3"]]] },
  "compound-64": { name: "compound (6/4)", ref: "IJzerman 3.2, ex. 3.8", about: "⑤ parted into a 6/4 and a 5/3: the 4th held over from the chord before (a suspension), resolving to the 3rd",
                   events: [[4, 2, ["6/4", "5/3"]], [0, 1, ["5/3"]]] },
  "compound-54": { name: "compound (5/4)", ref: "IJzerman 3.2, ex. 3.8–3.10", about: "⑤ parted into a 5/4 and a 5/3: a 4–3 suspension in one of the upper voices",
                   events: [[4, 2, ["5/4", "5/3"]], [0, 1, ["5/3"]]] },
  galant: { name: "Galant", ref: "IJzerman 3.4, ex. 3.19–3.21", about: "④–⑤–①: a 6/3 on ④, then on ⑤ a 6/4–5/3 of accented passing tones (no preparation), the upper voices in parallel 6ths or 3rds",
            events: [[3, 2, ["6/3", "6/3"]], [4, 2, ["6/4", "5/3"], { ap: [0] }], [0, 1, ["5/3"]]] },
  deceptive: { name: "deceptive", ref: "IJzerman 3.2, ex. 3.11–3.12", about: "a compound cadence whose bass goes up to ⑥ instead of ①: the middle voice goes down by step, the phrase asks to go on",
               events: [[4, 2, ["5/4", "5/3"]], [5, 1, ["5/3"]]] },
  half: { name: "half", ref: "IJzerman 3.1, ex. 3.1–3.2", about: "a close on the penultimate ⑤, on a strong unit: open, waiting for the answer",
          events: [[3, 2, ["5/3", "6/3"]], [4, 1, ["5/3"]]] },
};

/** The bass of a phrase, unit by unit: {d, r, struck, strong, chord, ap}. The cadence's degrees are placed in the
 *  octave nearest the end of the schema; in minor ⑥ and ⑦ are raised going up a step (and ⑦ before ①). */
export function phraseBass(schema, cadence, K) {
  const evs = [];
  schema.events.forEach(([d, len, figs]) => evs.push({ d, len, figs, meter: schema.meter || 2, part: "schema" }));
  if (cadence) {
    let last = evs.length ? evs[evs.length - 1].d : 0;
    const near = (deg) => { const base = deg % 7; let best = base; for (let o = -14; o <= 14; o += 7) if (Math.abs(base + o - last) < Math.abs(best - last)) best = base + o; return best; };
    for (const [deg, len, figs, extra] of cadence.events) { const d = near(deg); evs.push({ d, len, figs, meter: 2, part: "cadence", ap: extra && extra.ap }); last = d; }
  }
  const units = [];
  let partStart = 0, part = null;
  evs.forEach((e, i) => {
    if (e.part !== part) { part = e.part; partStart = units.length; }
    const next = evs[i + 1];
    const r = K.mutable(e.d) && next && next.d === e.d + 1 ? 1 : 0;
    for (let j = 0; j < e.len; j++) {
      const k = units.length - partStart;
      units.push({ d: e.d, r, struck: j === 0, strong: e.meter === 1 ? true : k % 2 === 0, chord: e.figs[Math.min(j, e.figs.length - 1)], ap: !!(e.ap && e.ap.includes(j)), part: e.part });
    }
  });
  return units;
}

/**
 * spec: {schema, cadence (a name, or null), key: {tonic, mode}, figured (the chords asked: true), top: [lo, hi],
 *        middle: [lo, hi] (degrees, 7 the tonic above the bass's), apart (degrees between the upper voices at most)}
 */
export function parts(spec = {}) {
  const schema = typeof spec.schema === "string" ? SCHEMATA[spec.schema] : spec.schema || SCHEMATA.fauxbourdon;
  const cadence = spec.cadence === null ? null : typeof spec.cadence === "string" ? CADENCES[spec.cadence] : spec.cadence || CADENCES.simple;
  if (!schema) throw new Error(`no such schema: ${spec.schema}`);
  const K = keyOf(spec.key || { tonic: "C" });
  const B = phraseBass(schema, cadence, K), n = B.length;
  const figured = spec.figured ?? true;
  const [tlo, thi] = spec.top || [9, 22], [mlo, mhi] = spec.middle || [4, 17];
  const apart = spec.apart ?? 7;
  const S = { schema: { events: [] }, key: K, bass: B, figured: false };
  // (the upper voice may be two octaves and a 4th above the bass: a bass that leaps down to ⑤ at a cadence)
  const T = voiceOf({ ...S, lo: tlo, hi: thi, voice: "top", spacing: spec.spacing ?? 18, weights: spec.weights });
  const M = voiceOf({ ...S, lo: mlo, hi: mhi, voice: "middle", weights: spec.weights });
  const D = T.degree, R = T.raised;
  const semi = (c) => K.semi(D(c), R(c));

  /** Why the pair (a over b) at unit t is refused by the voices between them and the chord, or null. */
  function between(TT, MM, t, a, b) {
    if (D(b) >= D(a)) return "the middle voice under the upper";
    if (D(a) - D(b) > apart) return "the upper voices within an octave";
    const cls = mod(D(a) - D(b), 7), s = mod(semi(a) - semi(b), 12);
    const perfect = (cls === 0 && s === 0) || (cls === 4 && s === 7);
    const vt = T.vertical(t, a), vm = M.vertical(t, b);
    if ((cls === 1 || cls === 6) && vt.q !== "dissonant" && vm.q !== "dissonant") return "a 2nd or a 7th between the upper voices, neither of them the dissonance";
    if (vt.q === "dissonant" && vm.q === "dissonant" && vt.cls === vm.cls) return "the dissonance doubled";
    if (t >= 1) {
      const pa = TT[t - 1], pb = MM[t - 1];
      const pcls = mod(D(pa) - D(pb), 7), ps = mod(semi(pa) - semi(pb), 12);
      const pperfect = (pcls === 0 && ps === 0) || (pcls === 4 && ps === 7);
      if (perfect && pperfect && pcls === cls && a !== pa && b !== pb) return `parallel ${cls === 0 ? "octaves" : "5ths"} between the upper voices`;
    }
    if (figured && B[t].chord) {
      const ch = CHORDS[B[t].chord], have = new Set([vt.cls, vm.cls]);
      if (!ch.need.every((c) => have.has(c)) || ![...have].every((c) => ch.ok.includes(c))) return `the chord asked is ${B[t].chord}`;
    }
    return null;
  }
  /** Why the pair at unit t is refused, or null: each voice against the bass, then between them. */
  function check(TT, MM, t, a, b) {
    return T.check(TT.slice(0, t), t, a) || M.check(MM.slice(0, t), t, b) || between(TT, MM, t, a, b);
  }
  /** The pairs that may come at unit t (before the futures). */
  function pairs(TT, MM) {
    const t = TT.length, out = [];
    const ta = T.codes.filter((a) => T.check(TT, t, a) === null), mb = M.codes.filter((b) => M.check(MM, t, b) === null);
    for (const a of ta) for (const b of mb) if (between(TT, MM, t, a, b) === null) out.push([a, b]);
    return out;
  }

  // ─── the count, exact, memoized on the last three units of both voices ───
  const memo = new Map();
  function countFrom(TT, MM) {
    const t = TT.length;
    if (t >= n) return 1n;
    const k = t + ":" + TT.slice(Math.max(0, t - 3)).join(",") + "|" + MM.slice(Math.max(0, t - 3)).join(",");
    const got = memo.get(k);
    if (got !== undefined) return got;
    let v = 0n;
    for (const [a, b] of pairs(TT, MM)) { TT.push(a); MM.push(b); v += countFrom(TT, MM); TT.pop(); MM.pop(); }
    memo.set(k, v);
    return v;
  }
  const count = (TT = [], MM = []) => countFrom([...TT], [...MM]);
  /** The pairs at the next unit with their futures and their soft cost. */
  function fan(TT = [], MM = []) {
    return pairs(TT, MM).map(([a, b]) => {
      const parts_ = { ...T.costParts(TT, a), ...Object.fromEntries(Object.entries(M.costParts(MM, b)).map(([k, v]) => ["middle/" + k, v])) };
      return { top: a, middle: b, futures: count([...TT, a], [...MM, b]), parts: parts_, cost: total(parts_) };
    });
  }
  function sample(r = Math.random) {
    const TT = [], MM = [];
    while (TT.length < n) {
      const cs = fan(TT, MM).filter((c) => c.futures > 0n);
      if (!cs.length) return null;
      const tot = cs.reduce((s, c) => s + c.futures, 0n);
      let x = (tot * BigInt(Math.floor(r() * 2 ** 52))) / 2n ** 52n;
      const c = cs.find((c) => (x -= c.futures) < 0n) || cs[cs.length - 1];
      TT.push(c.top); MM.push(c.middle);
    }
    return { top: TT, middle: MM };
  }
  /** The engine: each pair a softmax of −cost / temperature among those with a future. */
  function engine({ temp = 1, follow = true, r = Math.random } = {}) {
    const TT = [], MM = [];
    while (TT.length < n) {
      const cs = fan(TT, MM).filter((c) => c.futures > 0n).map((c, i) => ({ ...c, note: i }));
      const pick = choose(cs, temperature(temp, follow, count(TT, MM)), r);
      if (!pick) return null;
      TT.push(pick.top); MM.push(pick.middle);
    }
    return { top: TT, middle: MM };
  }
  function judge(W) {
    if (W.top.length !== n || W.middle.length !== n) return `${W.top.length} units, the bass has ${n}`;
    for (let t = 0; t < n; t++) { const r = check(W.top, W.middle, t, W.top[t], W.middle[t]); if (r) return `unit ${t + 1}: ${r}`; }
    return null;
  }
  /** The chords a realization makes, unit by unit: "6/3", "(5)/3" (a 5/3 without its 5th), "7/3", "4/2"… */
  function chords(W) {
    return W.top.map((a, t) => {
      const b = W.middle[t], fs = [...new Set([T.vertical(t, a).cls, M.vertical(t, b).cls])].map((c) => FIG[c]).sort((x, y) => y - x);
      if (fs.length === 2 && fs[0] === 8 && fs[1] === 3) return "(5)/3";
      if (fs.length === 1) return fs[0] === 3 ? "(5)/3" : String(fs[0]);
      return fs.filter((f) => f !== 8).join("/") || "8";
    });
  }
  return { spec, schema, cadence, key: K, bass: B, n, strong: (t) => B[t].strong, top: T, middle: M, check, pairs, count, fan, sample, engine, judge, chords,
           code: (name) => codeOf(K, name), name: (c) => K.name(D(c), R(c)), degree: D, hz: (c) => K.hz(D(c), R(c)), memo };
}
