// SPDX-License-Identifier: MPL-2.0
// Study 71 · blind: a deck of whole phrases (Study 76 · continuo), drawn once and kept, so every listener hears the
// same trials: Bach's soprano given, a figured bass written under it (Study 63's under.mjs on @kairotic/rules'
// continuo.mjs) and the voices that play it (bach-4, the figures as a wish), against Bach's own phrase.
//   node studies/71-blind/tools/deck-continuo.mjs [per variant] [seed] [out] [unresolved: "keep" to keep them]
// A phrase of Bach's whose quarters leave a dissonance unresolved — its resolution in the eighths the deck does not
// play (bach-4 refuses it, read in quarters, on a dissonance rule) — is left out, so his phrase does not sound wrong for
// lack of them; the deck lists them (`unresolved`), and with "keep" they are in it again (when both sides have eighths).
// Only the phrases the tables were not counted on (every fifth chorale), no longer than 16 quarters, each phrase once
// in the deck. Variants: continuo (every layer of the bass on), continuo-no-keys (every quarter in the chorale's key),
// continuo-no-functions. Writes studies/_shared/chorales/deck.json (adapted from phrases.json: CC BY-NC-SA 4.0).
import { readFileSync, writeFileSync } from "node:fs";
import { realize, isHeldOut } from "../../76-continuo/kairotic/realize.mjs";
import { rng, bachOf } from "../kairotic/blind.mjs";
import { fromOuter } from "../kairotic/rules.mjs";

const per = +(process.argv[2] || 40), seed = +(process.argv[3] || 76), out = process.argv[4] || "studies/_shared/chorales/deck.json", keep = process.argv[5] === "keep";

// (Bach's phrase read in quarters by bach-4: the dissonance rule it breaks first, or null)
const DISSONANCE = /dissonan|suspension|prepared|held into|resolves|7th|passes by step/;
const kn = (k) => k.replace("♯", "#").replace("♭", "b");
const notes = (p, v) => { const out = []; p.satb.forEach((c, t) => { if (t && p.held[t][v] && out.length) { const o = out.at(-1); o.units++; o.strong.push(!!p.strong[t]); return; }
  out.push({ midi: c[v], name: p.names[t][v], units: 1, strong: [!!p.strong[t]], key: kn(p.keys[t]) }); }); return out; };
export function unresolved(p) {
  const ob = fromOuter({ bass: notes(p, 3), soprano: notes(p, 0), key: `${kn(p.key.tonic)} ${p.key.mode}` });
  const j = ob.judge({ soprano: p.satb.map((c, t) => ob.code(p.names[t][0], t)), alto: p.satb.map((c, t) => ob.code(p.names[t][1], t)), tenor: p.satb.map((c, t) => ob.code(p.names[t][2], t)) });
  return j !== null && DISSONANCE.test(String(j)) ? String(j) : null;
}
const P = JSON.parse(readFileSync("studies/_shared/chorales/phrases.json", "utf8"));
const VARIANTS = { continuo: "all", "continuo-no-keys": "no-keys", "continuo-no-functions": "no-functions" };
const r = rng(seed), t0 = Date.now();
const candidates = P.phrases.filter((p) => isHeldOut(p) && p.satb.length <= 16), left = [];
const ids = keep ? candidates : candidates.filter((p) => { const w = unresolved(p); if (w) left.push({ phrase: p.id, why: w }); return !w; });
for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
const trials = [], tried = Object.fromEntries(Object.keys(VARIANTS).map((v) => [v, { tried: 0, filled: 0 }])), failures = {};
let next = 0;
for (let k = 0; k < per; k++) for (const [v, under] of Object.entries(VARIANTS)) {
  let done = false;
  while (!done && next < ids.length) {
    const p = ids[next++];
    tried[v].tried++;
    const x = realize(p, { variant: under, r });
    if (!x.satb) { const w = String(x.fail).replace(/quarter \d+/, "quarter #").replace(/\d+/g, "#"); failures[w] = (failures[w] || 0) + 1; continue; }
    tried[v].filled++;
    trials.push({ id: `${p.id}/${v}/0`, phrase: p.id, variant: v, draw: 0, title: p.title, bwv: p.bwv, key: p.key, strong: p.strong,
                  bach: bachOf(p), bridge: { satb: x.satb, held: x.held, figures: x.figures, keys: x.keys } });
    done = true;
    process.stderr.write(`\r${trials.length} trials · ${p.id} ${v}`.padEnd(60));
  }
}
process.stderr.write("\n");
const deck = {
  source: "Kairotic Study 71 · blind, on Study 76 · continuo: Bach's phrases (phrases.json, the chorales the tables were not counted on) and, under his soprano, a figured bass (Study 63's under.mjs) and its voices (@kairotic/rules' bach-4)",
  license: P.license, seed, perVariant: per, kind: "continuo", drawn: new Date().toISOString().slice(0, 16) + "Z",
  variants: Object.keys(VARIANTS), trials, tried, failures, unresolved: keep ? null : left,
};
writeFileSync(out, JSON.stringify(deck));
console.log(keep ? "unresolved phrases kept" : `${left.length} of ${candidates.length} phrases left out (a dissonance resolved only in the eighths)`);
console.log(`${trials.length} trials in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
for (const v of deck.variants) console.log(`  ${v}: ${tried[v].filled} of ${tried[v].tried} phrases realized`);
console.log(Object.entries(failures).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w, n]) => `  ${n} ${w}`).join("\n"));
