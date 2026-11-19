// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 58 · incipit: a given phrase (a bass and a melody over it) taken on, phrase by phrase, by Claude.
// Claude offers a few continuations at each step; each is checked by the rules of two-part writing (@kairotic/cac's
// partimento.mjs, its copy here, through Study 56's figuring.mjs), joined to the phrase before it; a failing one goes
// back to Claude with its errors; the soft rules (soft.mjs) rank the ones that pass; the person chooses which go on.
// The phrases make a tree, a history with branches: any point of it can be taken on again, by Claude or by hand.
//
//   a phrase      {bass: "C3 E3 F3 G3 C3", melody: "G4 C5 C5 B4 …", cadence, plan, about}: each bass note a bar,
//                 two units (strong, weak), the last one unit; the melody a note a unit (a note held is written again)
//   a step        one phrase at least (MIN_NOTES bass notes): a phrase, a reworking, a section — not a note
//   the join      the last note of the phrase before is held over its bar, and the next phrase starts on a strong unit;
//                 the rules are asked of the two phrases together, so the join is judged too
//   the cadence   each phrase closes with one: perfect, imperfect (either: authentic), deceptive (⑤–⑥) or half (on ⑤)
//   the tree      {nodes: {id: {id, parent, phrase, by, state: "chosen" | "offered", check}}, root}

import { figuring, parseBass } from "./figuring.mjs";
import { keyOf, codeOf, SCHEMATA, SCHEMATA3, CADENCES } from "./partimento.mjs";
import { total } from "./soft.mjs";

const mod = (a, m) => ((a % m) + m) % m;
export const MIN_NOTES = 4;
export const PER = 2;
export const LINE = "moderate";

// ─── incipits ───
export const INCIPITS = {
  "short-c": { name: "① ③ ④ ⑤ ①, a perfect cadence (C major)", key: { tonic: "C" },
               phrase: { bass: "C3 E3 F3 G3 C3", melody: "G4 C5 C5 B4 A4 A4 B4 D5 C5", cadence: "perfect", plan: "a cadential phrase", about: "the scale's first step up, then ④ ⑤ ①" } },
  "scale-76": { name: "the scale down, a 7–6 chain (C major)", key: { tonic: "C" },
                phrase: { bass: "C4 B3 A3 G3 F3 E3 D3 C3", melody: "E5 A5 A5 G5 G5 F5 F5 E5 E5 D5 D5 C5 C5 B4 C5", cadence: "perfect", plan: "7–6 suspensions", about: "a 7–6 chain over the scale down, a compound cadence 7–6–8" } },
  "short-am": { name: "① ③ ④ ⑤ ①, a perfect cadence (A minor)", key: { tonic: "A", mode: "minor" },
                phrase: { bass: "A2 C3 D3 E3 A2", melody: "C5 B4 A4 E4 F4 A4 G#4 B4 A4", cadence: "perfect", plan: "a cadential phrase", about: "the leading tone raised over the dominant" } },
};

// ─── the cadences a phrase may close with ───
export const ENDINGS = {
  perfect: { name: "perfect", ending: "perfect", needs: "a bass closing ⑤–① or ②–①, the melody on ①'s octave" },
  imperfect: { name: "imperfect", ending: "imperfect", needs: "a bass closing ⑤–① or ②–①, the melody on ①'s 3rd" },
  authentic: { name: "perfect or imperfect", ending: "authentic", needs: "a bass closing ⑤–① or ②–①" },
  deceptive: { name: "deceptive", ending: "deceptive", needs: "a bass closing ⑤–⑥, a step up" },
  half: { name: "half", ending: "half", needs: "a bass ending on ⑤" },
};
/** The ending a cadence's name means ("compound", "perfect authentic"… are perfect or imperfect). */
export function endingOf(name) {
  const s = String(name || "authentic").toLowerCase();
  if (/decept|interrupt/.test(s)) return "deceptive";
  if (/half|semi|open/.test(s)) return "half";
  if (/imperfect/.test(s)) return "imperfect";
  if (/perfect/.test(s)) return "perfect";
  return "authentic";
}

const split = (s) => (Array.isArray(s) ? s : String(s || "").trim().split(/[\s,]+/).filter(Boolean)).map((x) => x.replace("♯", "#").replace("♭", "b"));
/** The units of a phrase of n bass notes. */
export const unitsFor = (n, per = PER) => (n - 1) * per + 1;

/** The melody's range for a piece, from its incipit's bass: {lo, hi} in degrees (as Study 56 places it). */
export function rangeOf(phrase, key) {
  const K = keyOf(key), p = parseBass(split(phrase.bass).join(" "), K);
  if (p.error) throw new Error(p.error);
  const top = Math.max(...p.notes.map((x) => x.d)), lo = Math.max(7, top + 4);
  return { lo, hi: lo + 12 };
}

/**
 * The check of a phrase, after the one before it (prev, or null for the incipit), in the piece's key and range:
 * {ok, errors: [{unit (of the phrase, 1-based; 0: the join), at, note, bass, reason}], cost (the mean soft cost a
 *  unit), figures (the likeliest chord a unit), schemata (what the two lines make in it), units}.
 */
export function check(prev, phrase, { key, range, per = PER, line = LINE } = {}) {
  const K = keyOf(key), errors = [];
  const fail = (reason, extra = {}) => ({ ok: false, errors: [{ unit: null, reason, ...extra }], cost: Infinity });
  const bassNames = split(phrase.bass), mel = split(phrase.melody);
  const p = parseBass(bassNames.join(" "), K);
  if (p.error) return fail(`the bass: ${p.error}`);
  const notes = p.notes, n = notes.length;
  if (n < MIN_NOTES) return fail(`a step is a phrase at least: ${MIN_NOTES} bass notes or more (this one has ${n})`);
  const ending = endingOf(phrase.cadence);
  const last = notes[n - 1], pen = notes[n - 2], dl = mod(last.d, 7), dp = mod(pen.d, 7);
  const closes = ending === "half" ? dl === 4
    : ending === "deceptive" ? dp === 4 && dl === 5 && last.d === pen.d + 1
    : (dp === 4 && dl === 0) || (dp === 1 && dl === 0 && Math.abs(pen.d - last.d) === 1);
  if (!closes) return fail(`the bass does not close with a ${ENDINGS[ending].name} cadence: it needs ${ENDINGS[ending].needs}`);
  const want = unitsFor(n, per);
  if (mel.length !== want) return fail(`the melody has ${mel.length} notes, the bass ${n} notes make ${want} units (a note a unit, ${per} a bass note, the last one 1)`);
  const codes = [];
  for (const [i, nm] of mel.entries()) {
    try { codes.push(codeOf(K, nm)); } catch (e) { return fail(`the melody's note ${i + 1}: ${e.message}`, { unit: i + 1, note: nm }); }
  }
  // the join: the phrase before, its last note held over its bar
  let all = notes, U = codes, offset = 0;
  if (prev) {
    const pn = parseBass(split(prev.bass).join(" "), K).notes, pm = split(prev.melody).map((x) => codeOf(K, x));
    all = [...pn, ...notes];
    U = [...pm, ...Array(per - 1).fill(pm[pm.length - 1]), ...codes];
    offset = pm.length + per - 1;
  }
  const F = figuring({ bass: all, key: K, per, ending, line, lo: range.lo, hi: range.hi });
  const V = F.voice;
  for (let t = 0; t < F.n && errors.length < 4; t++) {
    const r = V.check(U.slice(0, t), t, U[t]);
    if (r) errors.push({ unit: t < offset ? 0 : t - offset + 1, at: t < offset ? "the join" : `unit ${t - offset + 1}`, note: V.name(U[t]), bass: F.bassName(t), reason: r });
  }
  if (errors.length) return { ok: false, errors, cost: Infinity, units: want };
  let c = 0;
  for (let t = offset; t < F.n; t++) c += total(V.costParts(U.slice(0, t), U[t]));
  const figs = F.figuresOf(U).slice(offset).map((f) => (f.chords[0] ? f.chords[0].chord : null));
  const found = F.schemataIn(U).filter((x) => x.to >= offset).map((x) => ({ name: x.name, from: Math.max(1, x.from - offset + 1), to: x.to - offset + 1 }));
  return { ok: true, errors: [], cost: Math.round((c / want) * 100) / 100, figures: figs, schemata: found, units: want, ending };
}

// ─── the tree ───
let seq = 0;
const newId = () => "p" + Date.now().toString(36) + (seq++).toString(36);
/** A tree whose root is an incipit. */
export function treeOf(incipit, { key, by = "the incipit" } = {}) {
  const root = { id: "p0", parent: null, phrase: incipit, by, state: "chosen" };
  const range = rangeOf(incipit, key);
  root.check = check(null, incipit, { key, range });
  return { key, range, root: root.id, nodes: { [root.id]: root } };
}
/** The tree with a phrase added under a point: [tree, the new node]. */
export function addPhrase(tree, parent, phrase, { by = "Claude", state = "offered", id = newId() } = {}) {
  const node = { id, parent, phrase, by, state, check: check(tree.nodes[parent].phrase, phrase, { key: tree.key, range: tree.range }) };
  return [{ ...tree, nodes: { ...tree.nodes, [id]: node } }, node];
}
/** The tree with a node chosen (to go on) or not. */
export const choose = (tree, id, on = true) => ({ ...tree, nodes: { ...tree.nodes, [id]: { ...tree.nodes[id], state: on ? "chosen" : "offered" } } });
/** The nodes from the root to a point. */
export function pathTo(tree, id) {
  const out = [];
  for (let x = tree.nodes[id]; x; x = x.parent ? tree.nodes[x.parent] : null) out.unshift(x);
  return out;
}
export const childrenOf = (tree, id) => Object.values(tree.nodes).filter((x) => x.parent === id);
/** The piece up to a point: its bass and melody unit by unit (names), where each phrase starts, and its MEI. */
export function pieceAt(tree, id, per = PER) {
  const path = pathTo(tree, id), bass = [], melody = [], starts = [];
  path.forEach((x, i) => {
    const b = split(x.phrase.bass), m = split(x.phrase.melody);
    if (i) { const held = melody[melody.length - 1]; for (let k = 1; k < per; k++) { melody.push(held); bass.push(bass[bass.length - 1]); } }
    starts.push(melody.length);
    b.forEach((nm, j) => { for (let k = 0; k < (j === b.length - 1 ? 1 : per); k++) bass.push(nm); });
    m.forEach((nm) => melody.push(nm));
  });
  return { path, bass, melody, starts, units: melody.length };
}

// ─── the score (MEI for Verovio): the melody and the bass, a unit a half note, 2/2 ───
const SIG = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
const RELATIVE = { A: "C", E: "G", B: "D", "F#": "A", "C#": "E", "G#": "B", "D#": "F#", D: "F", G: "Bb", C: "Eb", F: "Ab", Bb: "Db", Eb: "Gb" };
const SHARPS = "FCGDAEB", FLATS = "BEADGCF";
export function meiOf(piece, key) {
  const tonic = key.tonic.replace("♯", "#").replace("♭", "b");
  const fifths = SIG[key.mode === "minor" ? RELATIVE[tonic] ?? "C" : tonic] ?? 0;
  const sig = fifths >= 0 ? SHARPS.slice(0, fifths) : FLATS.slice(0, -fifths), sAcc = fifths >= 0 ? "s" : "f";
  const nBars = Math.ceil(piece.units / 2);
  const voice = (names, phraseMarks) => {
    const bars = Array.from({ length: nBars }, () => []);
    for (let t = 0; t < names.length;) {
      let e = t + 1;
      while (e < names.length && names[e] === names[t] && !(phraseMarks && piece.starts.includes(e))) e++;
      // split at the barlines (a bar: two units)
      for (let s = t; s < e;) {
        const bar = Math.floor(s / 2), end = Math.min(e, (bar + 1) * 2), len = end - s;
        const m = /^([A-G])([#b]*)(-?\d+)$/.exec(names[t]);
        const acc = { "": "n", "#": "s", b: "f", "##": "x", bb: "ff" }[m[2]];
        const inSig = sig.includes(m[1]) ? sAcc : "n";
        const accA = acc === inSig ? (acc === "n" ? "" : ` accid.ges="${acc}"`) : ` accid="${acc}"`;
        const tie = e - t === len ? "" : s === t ? ' tie="i"' : end === e ? ' tie="t"' : ' tie="m"';
        bars[bar].push(`<note pname="${m[1].toLowerCase()}" oct="${m[3]}" dur="${len === 2 ? "1" : "2"}"${accA}${tie}/>`);
        s = end;
      }
      t = e;
    }
    return bars;
  };
  const top = voice(piece.melody.map((x) => x.replace("♯", "#").replace("♭", "b")), true);
  const low = voice(piece.bass.map((x) => x.replace("♯", "#").replace("♭", "b")), true);
  const fill = (xs, b) => (xs[b].length ? xs[b].join("") + (b === nBars - 1 && piece.units % 2 ? "<rest dur=\"2\"/>" : "") : "<mRest/>");
  const measures = Array.from({ length: nBars }, (_, b) => `<measure n="${b + 1}"${b === nBars - 1 ? ' right="end"' : piece.starts.includes(2 * b + 2) || piece.starts.includes(2 * b + 1) ? ' right="dbl"' : ""}>` +
    `<staff n="1"><layer n="1">${fill(top, b)}</layer></staff><staff n="2"><layer n="1">${fill(low, b)}</layer></staff></measure>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0"><music><body><mdiv><score>` +
    `<scoreDef keysig="${fifths === 0 ? "0" : Math.abs(fifths) + sAcc}" meter.count="2" meter.unit="2" meter.sym="cut"><staffGrp symbol="brace" bar.thru="true">` +
    `<staffDef n="1" lines="5" clef.shape="G" clef.line="2"/><staffDef n="2" lines="5" clef.shape="F" clef.line="4"/></staffGrp></scoreDef>` +
    `<section>${measures}</section></score></mdiv></body></music></mei>`;
}

// ─── asking Claude ───
const vocabulary = () => [
  "Schemata of two parts (IJzerman, Harmony, Counterpoint, Partimento, ch. 1): " + Object.values(SCHEMATA).map((s) => `${s.name} (${s.about})`).join("; "),
  "Schemata of three parts (ch. 2), usable as plans for the bass: " + Object.values(SCHEMATA3).map((s) => `${s.name} (${s.about})`).join("; "),
  "Cadences (ch. 3): " + Object.values(CADENCES).map((s) => `${s.name} (${s.about})`).join("; "),
].join("\n");

export const RULES = `The rules every phrase is checked by (two parts, as a partimento is realized; @kairotic/cac's partimento.mjs):
- Time: a unit is half a bar (strong, weak). Each bass note lasts a bar (two units); the last bass note of a phrase lasts one unit. The melody has one note per unit: (bass notes − 1) × 2 + 1 notes. A note held is written again.
- The join: the last melody note of the phrase before is held over its bar; your phrase starts on a strong unit. The motion from that note into your first is judged too, and your first note must differ from it (a note is held two units at most).
- Strong units: a consonance with the bass (3rd, 5th, 6th, octave and their compounds; no 4th), or a suspension: a 7th, 4th or 9th held (prepared as a consonance on the unit before, the same note), resolved down by step on the next unit. Over a bass note struck, a dissonance struck is refused.
- Weak units: a consonance, or a passing tone or neighbour note by step over the held bass (a passing tone goes on by step the same way).
- No parallel or direct 5ths or octaves between the voices; no unison with the bass but at the very end; the melody above the bass, never crossing it.
- The melody moves by step or by leaps up to an octave, never by an augmented interval; ${LINE === "moderate" ? "after a leap of a 5th or more it turns back by step" : ""}; no note held for more than two units.
- Minor: ⑥ and ⑦ raised going up a step, natural going down; over a dominant ⑤ (going to ① or ⑥, or closing) the leading tone ⑦ is raised. Spell raised notes with # (G#4 in A minor).
- Cadences: perfect or imperfect over ⑤–① or ②–① (②–①: 3–3 imperfect, 6–8 perfect, 7–6–8 compound; ⑤–①: ⑦ or ② to ① perfect, to the 3rd imperfect, 4–3 compound), deceptive over ⑤–⑥ (a step up), half on a last ⑤ (the melody on its octave or 3rd).`;

/**
 * The prompt for k continuations of the piece at a point. ctx: {tree, at (the point), k, request (what the person
 * asks, or ""), repair: [{phrase, errors}] (proposals that failed, to repair), offered: [phrases already offered here]}.
 */
export function promptFor({ tree, at, k = 3, request = "", repair = [], offered = [] }) {
  const K = keyOf(tree.key), piece = pieceAt(tree, at), path = piece.path;
  const lo = K.name(tree.range.lo), hi = K.name(tree.range.hi);
  const fmt = (x) => `  plan: ${x.phrase.plan || "—"}${x.phrase.cadence ? ` · cadence: ${x.phrase.cadence}` : ""}\n  bass:   ${split(x.phrase.bass).join(" ")}\n  melody: ${split(x.phrase.melody).join(" ")}`;
  return [
    `You continue a piece of music in two parts, a bass and a melody over it, in ${K.tonic} ${K.mode}, phrase by phrase, as an improviser on a partimento would. Kairotic checks every phrase you write by the rules below; a person then chooses which of your continuations go on.`,
    RULES,
    `The melody's range: ${lo} to ${hi}. Write the bass between E2 and E4.`,
    vocabulary(),
    `The piece so far, ${path.length} phrase${path.length > 1 ? "s" : ""} (the last is where you go on from):\n` + path.map((x, i) => `phrase ${i + 1}${x.phrase.about ? ` (${x.phrase.about})` : ""}\n${fmt(x)}`).join("\n"),
    request ? `What the person asks of the next phrase: ${request}` : "Nothing more is asked: go on as the piece itself suggests — an answer, a contrast, a sequence, a return, a modulation by a cadence elsewhere.",
    offered.length ? "Already offered from this point (write different ones):\n" + offered.map((p) => `- ${p.plan || "—"}: bass ${split(p.bass).join(" ")} · melody ${split(p.melody).join(" ")}`).join("\n") : "",
    repair.length ? "These continuations of yours failed the rules; repair each one, or replace it:\n" + repair.map((r) => `- bass ${split(r.phrase.bass).join(" ")} · melody ${split(r.phrase.melody).join(" ")}\n  errors: ${r.errors.map((e) => (e.at ? `${e.at}${e.note ? ` (${e.note} over ${e.bass})` : ""}: ` : "") + e.reason).join("; ")}`).join("\n") : "",
    `Write ${repair.length ? repair.length : k} continuation${(repair.length || k) > 1 ? "s" : ""}, each one phrase (at least ${MIN_NOTES} bass notes, usually 4 to 8), large and distinct from each other: name its plan by the schemata and cadences above. Count the melody's notes: (bass notes − 1) × 2 + 1. Answer with a short sentence, then one block:\n` +
      "```json\n[{\"plan\": \"a Monte, then a compound cadence\", \"cadence\": \"perfect\", \"bass\": \"C3 D3 E3 F3 G3 C3\", \"melody\": \"…\", \"about\": \"one line on what it does\"}]\n```\n" +
      "cadence: perfect, imperfect, deceptive or half.",
  ].filter(Boolean).join("\n\n");
}

/** The continuations in Claude's answer (the ```json block, or the first JSON array in it), or why none. */
export function proposalsOf(text) {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text || "");
  const src = m ? m[1] : (/\[[\s\S]*\]/.exec(text || "") || [""])[0];
  let v;
  try { v = JSON.parse(src); } catch (e) { return { error: "the answer had no JSON block of continuations" }; }
  if (v && !Array.isArray(v)) v = v.continuations || v.phrases || [v];
  const out = (v || []).filter((x) => x && x.bass && x.melody).map((x) => ({ plan: String(x.plan || ""), cadence: String(x.cadence || "authentic"), bass: split(x.bass).join(" "), melody: split(x.melody).join(" "), about: String(x.about || "") }));
  return out.length ? { proposals: out } : { error: "the JSON block had no continuation with a bass and a melody" };
}

/**
 * Asks Claude (sample: claude.ai's sample capability, or a scripted one) for k continuations at a point, checks them,
 * sends the failing ones back with their errors (tries in all); → {tree (with the passing ones offered under the
 * point), added: [nodes], failed: [{phrase, errors}], tries}. onTry(k) is told each try.
 */
export async function continueWith(sample, tree, at, { k = 3, request = "", tries = 3, signal, onTry, onText } = {}) {
  const offered = childrenOf(tree, at).map((x) => x.phrase);
  let repair = [], added = [], failed = [], t = tree, i = 0;
  for (i = 1; i <= tries; i++) {
    const want = i === 1 ? k : repair.length;
    if (!want) break;
    onTry && onTry(i);
    const ans = await sample(promptFor({ tree: t, at, k: want, request, repair, offered: [...offered, ...added.map((x) => x.phrase)] }), { modelTier: "default", signal, cache: false, onText });
    const got = proposalsOf(ans.text);
    if (got.error) { repair = repair.length ? repair : [{ phrase: { bass: "", melody: "" }, errors: [{ reason: got.error }] }]; failed = repair; continue; }
    const next = [];
    for (const ph of got.proposals.slice(0, want)) {
      const [t2, node] = addPhrase(t, at, ph, { by: i > 1 ? `Claude (try ${i})` : "Claude" });
      if (node.check.ok) { t = t2; added.push(node); } else next.push({ phrase: ph, errors: node.check.errors });
    }
    repair = next; failed = next;
    if (!repair.length) break;
  }
  return { tree: t, added, failed, tries: Math.min(i, tries) };
}

/** The frequency of a note's name in a key. */
export function hzOf(key, name) { const K = keyOf(key), c = codeOf(K, split([name])[0]); return K.hz(c >> 1, c & 1); }

/** The engine's melody for a bass under a point (no Claude): the phrase written by the soft rules, or null. */
export function engineMelody(tree, at, bass, { cadence = "authentic", temp = 0.5, r = Math.random } = {}) {
  const K = keyOf(tree.key), prev = tree.nodes[at].phrase;
  const pn = parseBass(split(prev.bass).join(" "), K).notes, pm = split(prev.melody).map((x) => codeOf(K, x));
  const p = parseBass(split(bass).join(" "), K);
  if (p.error) throw new Error(p.error);
  const F = figuring({ bass: [...pn, ...p.notes], key: K, per: PER, ending: endingOf(cadence), line: LINE, lo: tree.range.lo, hi: tree.range.hi });
  const U0 = [...pm, ...Array(PER - 1).fill(pm[pm.length - 1])];
  const U = F.engine({ temp, r }, U0);
  return U ? U.slice(U0.length).map((c) => F.name(c).replace("♯", "#").replace("♭", "b")).join(" ") : null;
}
