// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 60 · development: the incipit (Study 58) with motives and a form (discussion #309).
//
//   the material  the incipit's motive, found (the span that recurs most, else its head) or marked by hand; more
//                 motives may be marked on any phrase
//   a phrase      declares its derivation ("motive a's head, inverted, in sequence a step lower"); the page measures
//                 it (motif.mjs): where each motive is in the phrase, by which exact transformation, or how near
//   the ranking   the rules' soft cost, less the kinship's sweet spot (coherence without literal repetition) and the
//                 memory of the work (the figures already heard), more where the phrase misses its place in the form
//   the form      a plan chosen at the start — a period, a sentence of phrases, a small ternary, or free —: each
//                 phrase a step of it (its role), with what that step asks (to begin as the first did, a contrast,
//                 a return home, a perfect cadence)

import * as I from "./incipit.mjs";
import { notesOf, motiveNotes, findIn, discover, memory, sweet, shiftName } from "./motif.mjs";
import { keyOf, codeOf, codeDegree } from "./partimento.mjs";

export { notesOf, discover, sweet };

// ─── the forms ───
export const PLANS = {
  period: { name: "a period", steps: [
    { role: "antecedent", about: "the motive stated; an open close (a half or an imperfect cadence)" },
    { role: "consequent", about: "begins as the antecedent began — the motive again, at the same pitch or a step away — and closes with a perfect cadence", starts: true, cadence: ["perfect", "authentic"] },
  ] },
  sentence: { name: "a sentence (of phrases)", steps: [
    { role: "presentation", about: "the motive stated" },
    { role: "repetition", about: "the motive again, in sequence (a step or a 3rd away) or answered on the dominant", starts: true },
    { role: "continuation", about: "fragmentation: the motive's head or tail in sequence, the harmony moving faster; it may modulate", fragment: true },
    { role: "cadential", about: "the motive liquidated into a perfect cadence, home", cadence: ["perfect", "authentic"], home: true },
  ] },
  ternary: { name: "a small ternary (A B A′)", steps: [
    { role: "A", about: "the motive stated" },
    { role: "B", about: "a contrast: the motive changed (inverted, backwards or in another rhythm), in the dominant or the relative key, closing there or with a half cadence", contrast: true },
    { role: "A′", about: "the return: the motive as at the start, home, closing with a perfect cadence", starts: true, home: true, cadence: ["perfect", "authentic"] },
  ] },
  free: { name: "free", steps: [] },
};

/** A tree from an incipit, with its motive (found, or {from, to} its units) and its plan. */
export function treeOf(incipit, { key, motive = null, plan = "free" } = {}) {
  const T = I.treeOf(incipit, { key });
  const m = motive ? { ...motive, notes: motiveNotes(incipit.melody, motive.from, motive.to).map((x) => x.name), why: motive.why || "marked by hand" } : discover(incipit.melody);
  const tree = { ...T, plan: PLANS[plan] ? plan : "free", motives: [{ id: "a", node: T.root, from: m.from, to: m.to, notes: m.notes, why: m.why }] };
  return withDev(tree, T.root);
}

/** The tree with a motive marked on a phrase (its units, from, to), named by the next letter. */
export function addMotive(tree, node, from, to) {
  const ph = tree.nodes[node].phrase, ns = motiveNotes(ph.melody, from, to);
  if (ns.length < 2) throw new Error("a motive has two notes at least");
  const id = "abcdefghijklmnopqrstuvwxyz"[tree.motives.length];
  const t = { ...tree, motives: [...tree.motives, { id, node, from, to, notes: ns.map((x) => x.name), why: "marked by hand" }] };
  return Object.keys(t.nodes).reduce((acc, k) => withDev(acc, k), t);
}

/** The role of the phrase at a depth (0: the incipit) in the tree's plan, or null. */
export const roleAt = (tree, depth) => (PLANS[tree.plan].steps[depth] || null);

const HINTS = [[/invert|inversion|upside/i, "inversion"], [/retrograd|backward|crab/i, "retrograde"], [/sequence|sequential/i, "sequence"], [/transpos/i, "transposition"], [/repeat|repetition|literal|again|same pitch|own pitch|as at the start|as in phrase/i, "repetition"]];
const PART_HINTS = [[/\bhead\b|opening|first (two|three) notes/i, "head"], [/\btail\b|last (two|three) notes|ending/i, "tail"]];
const RHYTHM_HINTS = [[/augment/i, "augmented"], [/diminu/i, "diminished"]];

/** What a phrase does with the material, measured: {matches: [{motive, from, to (units, 1-based), name, kinship,
 *  exact, kept, notes}], kinship (the best), memory, role, fits: [{ok, what}], declared, confirmed, score}. */
export function measure(tree, id) {
  const node = tree.nodes[id], ph = node.phrase, path = I.pathTo(tree, id), depth = path.length - 1;
  const ns = notesOf(ph.melody);
  const matches = tree.motives.map((m) => {
    const M = motiveNotes(tree.nodes[m.node].phrase.melody, m.from, m.to);
    const self = m.node === id;
    const r = self ? { from: m.from, to: m.to, name: "the motive itself", kinship: 1, exact: true, kept: ["intervals", "contour", "rhythm"], notes: m.notes } : findIn(M, ns);
    return r && { motive: m.id, ...r, from: r.from + 1, to: r.to + 1 };
  }).filter(Boolean).sort((a, b) => b.kinship - a.kinship);
  const best = matches[0] || null, kinship = best ? best.kinship : 0;
  const mem = depth ? memory(path.slice(0, -1).map((x) => x.phrase.melody), ph.melody) : 0;
  const role = roleAt(tree, depth), fits = [];
  if (role && depth) {
    const ending = I.endingOf(ph.cadence), keys = node.check && node.check.keys;
    const home = I.keyLabel(tree.key), last = keys && keys.length ? keys[keys.length - 1] : home;
    if (role.cadence) fits.push({ ok: role.cadence.includes(ending), what: `a ${role.cadence[0]} cadence` });
    if (role.home) fits.push({ ok: last === home, what: `closing home, in ${home}` });
    if (role.starts) fits.push({ ok: !!best && best.from <= 2 && best.kinship >= 0.7, what: "beginning with the motive, as the first phrase began" });
    if (role.contrast) fits.push({ ok: !!best && best.kinship < 0.9 && !(best.exact && /repetition|transposition/.test(best.kind || "")) || (last !== home), what: "a contrast: the motive changed, or another key" });
    if (role.fragment) fits.push({ ok: tree.motives.some((m) => { const M = motiveNotes(tree.nodes[m.node].phrase.melody, m.from, m.to); return M.length > 2 && [0, 1].some((k) => { const part = M.slice(k, k + M.length - 1), r = findIn(part, ns); return r && r.kinship >= 0.7; }); }), what: "a fragment of the motive (its head or its tail)" });
  }
  // the derivation declared, against what was measured
  let confirmed = null;
  const declared = ph.derivation || "";
  // (what is checked is the first clause: the material the phrase begins from — "motive a in sequence a step
  // higher, then its tail worn away into the cadence" — not what it then does with it)
  const first = declared.split(/[;:(]|,?\s+then\b|,\s+(?:its|the)\s+(?:tail|head|last|ending)\b/i)[0];
  if (declared && best) {
    const says = HINTS.filter(([re]) => re.test(first)).map(([, k]) => k), saysR = RHYTHM_HINTS.filter(([re]) => re.test(first)).map(([, k]) => k);
    const found0 = (r) => (r.exact ? [r.kind, ...(r.kind === "transposition" ? ["sequence"] : r.kind === "sequence" ? ["transposition"] : [])] : []);
    const saysP = PART_HINTS.filter(([re]) => re.test(first)).map(([, k]) => k);
    // (a fragment said: looked for as such, its best place may not be the phrase's best match)
    let rel = best;
    if (saysP.length && !saysP.includes(best.part)) {
      const m = tree.motives.find((x) => new RegExp(`motive ${x.id}\\b`).test(first)) || tree.motives[0];
      const alt = findIn(motiveNotes(tree.nodes[m.node].phrase.melody, m.from, m.to), ns, { only: saysP[0] });
      if (alt && alt.kinship >= 0.65) rel = alt;
    }
    const partOk = !saysP.length || saysP.includes(rel.part) || (saysP.includes("head") && !rel.part);
    const ok = (r) => says.some((k) => found0(r).includes(k)) && (!saysR.length || saysR.includes(r.rhythm));
    confirmed = !says.length ? (rel.kinship >= 0.65 && partOk ? (rel === best ? "related, as it says" : `related, as it says: ${rel.name}`) : "little related")
      : partOk && ok(rel) ? (rel === best ? "confirmed" : `confirmed: ${rel.name}`) : best.exact ? `measured otherwise: ${best.name}` : `not exactly: the nearest is ${best.name} (${best.kinship})`;
  }
  const cost = node.check && node.check.ok && Number.isFinite(node.check.cost) ? node.check.cost : 0;
  const misses = fits.filter((f) => !f.ok).length;
  const score = Math.round((cost - 1.2 * sweet(kinship) - 0.6 * mem + 0.8 * misses) * 100) / 100;
  return { matches, kinship, memory: mem, role, fits, declared, confirmed, score };
}
const withDev = (tree, id) => ({ ...tree, nodes: { ...tree.nodes, [id]: { ...tree.nodes[id], dev: measure(tree, id) } } });

/** The tree with a phrase added under a point, measured: [tree, node]. */
export function addPhrase(tree, parent, phrase, opts) {
  const [t, node] = I.addPhrase(tree, parent, phrase, opts);
  const t2 = withDev(t, node.id);
  return [t2, t2.nodes[node.id]];
}
/** A tree saved with its phrases only ({key, plan, motives, root, nodes: {id: {id, parent, phrase, by, state}}}),
 *  rebuilt: each phrase checked by the rules and measured again, parents first. */
export function rebuild(saved) {
  const nodes = Object.values(saved.nodes), root = saved.nodes[saved.root];
  let t = treeOf(root.phrase, { key: saved.key, plan: saved.plan });
  t = { ...t, motives: saved.motives || t.motives };
  const done = new Set([saved.root]);
  while (done.size < nodes.length) {
    const next = nodes.filter((n) => !done.has(n.id) && done.has(n.parent));
    if (!next.length) break;
    for (const n of next) { [t] = I.addPhrase(t, n.parent, n.phrase, { by: n.by, state: n.state, id: n.id }); done.add(n.id); }
  }
  return remeasure({ ...t, motives: saved.motives || t.motives });
}

/** Every phrase measured again (a tree saved by an earlier page, or read from elsewhere). */
export const remeasure = (tree) => Object.keys(tree.nodes).reduce((t, k) => withDev(t, k), tree);
export const choose = (tree, id, on = true) => ({ ...I.choose(tree, id, on), motives: tree.motives, plan: tree.plan });

/** What Claude is asked: the incipit's prompt, with the material, its development and the form. */
export function promptFor(ctx) {
  const { tree, at } = ctx, base = I.promptFor(ctx);
  const depth = I.pathTo(tree, at).length, role = roleAt(tree, depth), plan = PLANS[tree.plan];
  const mot = tree.motives.map((m) => {
    const ns = motiveNotes(tree.nodes[m.node].phrase.melody, m.from, m.to);
    const steps = ns.slice(1).map((x, i) => x.d - ns[i].d), durs = ns.map((x) => x.dur);
    return `- motive ${m.id}: ${ns.map((x) => x.name).join(" ")} (phrase ${I.pathTo(tree, m.node).length}, units ${m.from + 1}–${m.to + 1}); its intervals in steps ${steps.map((s) => (s > 0 ? "+" + s : s)).join(" ")}; its durations in units ${durs.join(" ")}`;
  }).join("\n");
  const material = [
    `The material of the piece:\n${mot}`,
    "Develop it, as a composer does: every continuation derives from a motive by operations you name — a sequence (a step or a 3rd away), a transposition, an inversion, a retrograde, augmentation or diminution, fragmentation (its head or its tail, then in sequence), a change of mode, embellishment (its notes kept on the strong units, others between them), liquidation (the motive worn away into a cadence). Say how in \"derivation\" (\"motive a's head, inverted, then in sequence a step lower\"). Kairotic measures it — the intervals, the contour, the rhythm — and shows whether it is there: be exact. Prefer a relation to a literal repetition, and keep the harmony related too (the same schema at another pitch, the same frame with another cadence).",
    plan.steps.length ? `The form: ${plan.name} — ${plan.steps.map((s, i) => `phrase ${i + 1} ${s.role}`).join(", ")}. ` + (role ? `The next phrase is phrase ${depth + 1}, the ${role.role}: ${role.about}.` : `The plan is complete: the next phrase extends it (a codetta, or a new section built on the material).`) : "",
  ].filter(Boolean).join("\n\n");
  const i = base.lastIndexOf("\n\nWrite ");
  return (base.slice(0, i) + "\n\n" + material + base.slice(i))
    .replace('"about": "one line on what it does"}', '"derivation": "motive a, in sequence a step higher, then its head inverted", "about": "one line on what it does"}');
}

/** Asks Claude for continuations (incipit.mjs's continueWith with this prompt), each measured. */
export async function continueWith(sample, tree, at, opts = {}) {
  const r = await I.continueWith(sample, tree, at, { ...opts, prompt: promptFor });
  let t = { ...r.tree, motives: tree.motives, plan: tree.plan };
  for (const n of r.added) t = withDev(t, n.id);
  return { ...r, tree: t, added: r.added.map((n) => t.nodes[n.id]) };
}

/** The children of a point, the best developed first (the lowest score). */
export const ranked = (tree, id) => I.childrenOf(tree, id).sort((a, b) => (a.dev ? a.dev.score : 0) - (b.dev ? b.dev.score : 0));

/** The motive's transformations the engine may begin a phrase with: sequences, inversions, its head, each as names a
 *  unit (a note held repeated) with what it is. */
export function transformsOf(tree, m) {
  const K = keyOf(tree.key), ns = motiveNotes(tree.nodes[m.node].phrase.melody, m.from, m.to);
  const deg = ns.map((x) => codeDegree(codeOf(K, x.name)));
  const name = (d) => K.name(d, 0).replace("♯", "#").replace("♭", "b");
  const units = (ds, durs) => ds.flatMap((d, i) => Array(durs[i]).fill(name(d)));
  const out = [], durs = ns.map((x) => x.dur), ones = ns.map(() => 1), head = Math.max(2, ns.length - 1);
  for (const s of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
    out.push({ start: units(deg.map((d) => d + s), durs), what: `motive ${m.id}${s ? ", in sequence " + shiftName(s) : ", at the same pitch"}` });
    out.push({ start: units(deg.map((d) => 2 * deg[0] + s - d), durs), what: `motive ${m.id}, inverted${s ? ", " + shiftName(s) : ", at the same pitch"}` });
    out.push({ start: units(deg.slice(0, head).map((d) => d + s), durs.slice(0, head)), what: `motive ${m.id}'s head${s ? ", in sequence " + shiftName(s) : ", at the same pitch"}` });
    if (durs.some((d) => d > 1)) out.push({ start: units(deg.map((d) => d + s), ones), what: `motive ${m.id} in even notes${s ? ", in sequence " + shiftName(s) : ", at the same pitch"}` });
  }
  return out;
}

/** The engine's melody for a bass, developing the material: phrases begun with each of the motives'
 *  transformations (as transformsOf gives them), and a few drawn freely, each finished by the engine under the rules;
 *  the one with the best score. {melody, dev, derivation} or null. */
export function engineDevelop(tree, at, bass, { keys = "", cadence = "authentic", tries = 3, r = Math.random } = {}) {
  let best = null;
  const cands = [...tree.motives.flatMap((m) => transformsOf(tree, m)), ...Array.from({ length: tries }, () => ({ start: [], what: "" }))];
  for (const c of cands) {
    const m = I.engineMelody(tree, at, bass, { keys, cadence, r, temp: 0.6, start: c.start });
    if (!m) continue;
    const [, node] = addPhrase(tree, at, { bass, keys, melody: m, cadence, plan: "by the engine", derivation: c.what }, { id: "probe" });
    if (!node.check.ok) continue;
    // (one begun freely is named by what was found in it)
    const found = node.dev.matches[0], what = c.what || (found && found.kinship >= 0.65 ? `motive ${found.motive}, ${found.name} (found)` : "");
    if (!best || node.dev.score < best.dev.score) best = { melody: m, dev: node.dev, derivation: what };
  }
  return best;
}

/** The piece up to a point as a MEI file for the app (incipit.mjs's exportOf), with the material and, for each
 *  phrase, its role in the form and what was measured of its derivation. */
export function exportOf(tree, id, { title = "A piece developed" } = {}) {
  return I.exportOf(tree, id, {
    title, source: "Kairotic Study 60 · development",
    extra: { form: tree.plan, motives: tree.motives.map((m) => ({ id: m.id, notes: m.notes.join(" "), phrase: I.pathTo(tree, m.node).length, units: [m.from + 1, m.to + 1], why: m.why })) },
    more: (n) => (n.dev ? { role: n.dev.role ? n.dev.role.role : null, measured: n.dev.matches[0] ? `motive ${n.dev.matches[0].motive}, ${n.dev.matches[0].name}` : null,
                            kinship: n.dev.kinship, confirmed: n.dev.confirmed, score: n.dev.score } : {}),
  });
}

export const { pathTo, childrenOf, pieceAt, meiOf, hzOf, keyLabel, INCIPITS, check, endingOf, rangeOf, engineMelody } = I;
