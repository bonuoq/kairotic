// SPDX-License-Identifier: MPL-2.0
// Kairotic · the quantization benchmark's outside corpora (issue #105).
//
//   node tests/quantize-corpus/fetch.mjs [--n 200] [--seed 105] [--bars 8]
//
// Clones the Essen Folksong Collection (kern, ccarh/essen-folksong-collection) and SymbTr (Turkish makam,
// MTG/SymbTr) into tests/quantize-corpus/.cache/ (git-ignored: their licenses allow use, not redistribution
// here), takes a random sample of n pieces (half from each, by a seeded generator, so the same seed gives the
// same sample) and writes each excerpt (its first `bars` bars) as a measured Kairotic tree:
//
//   .cache/corpus.edn   [{:id "essen/europa/deutschl/…" :source :essen :meter [3 4] :groups nil :tree […]} …]
//   .cache/SOURCES.md   where each piece came from, with the licenses and citations
//
// The trees only need their times right (mt/notes reads them): tuplets are written as plain notes of 1/3
// beat, and a note across a barline is split and tied. What the benchmark compares is each note's onset,
// duration, pitch and written name.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, ".cache");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const N = arg("n", 200), SEED = arg("seed", 105), BARS = arg("bars", 8);

// ── the sources ──
const sources = {
  essen: { repo: "https://github.com/ccarh/essen-folksong-collection", dir: join(cache, "essen"),
           license: "CCARH license (see license.txt in the repository): data for research use; its legal status is unclear (music21: non-commercial use only). Not redistributed here.",
           cite: "Schaffrath, H. (1995). The Essen Folksong Collection in the Humdrum Kern Format. D. Huron (ed.), CCARH." },
  symbtr: { repo: "https://github.com/MTG/SymbTr", dir: join(cache, "symbtr"),
            license: "CC BY-NC-SA 4.0. Not redistributed here.",
            cite: "Karaosmanoğlu, M. K. (2012). A Turkish makam music symbolic database for music information retrieval: SymbTr. ISMIR 2012, 223–228." },
};
mkdirSync(cache, { recursive: true });
for (const [k, s] of Object.entries(sources))
  if (!existsSync(s.dir)) { console.log("cloning", k, "…"); execFileSync("git", ["clone", "-q", "--depth", "1", s.repo, s.dir], { stdio: "inherit" }); }

// ── a seeded generator (mulberry32), the same as the benchmark's ──
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (xs, r) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const walk = (d, ext) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : []; });

// ── events → a measured tree (EDN) ──
// evs: [{t, dur, pitch (a name or a MIDI number), grace?, rest?}] in beats from the start of bar 1 (a pickup
// starts after 0: the bar before it is filled with a rest)
const num = (x) => String(Math.round(x * 1e6) / 1e6);
const str = (s) => JSON.stringify(s);
function treeOf(evs, meter, groups, key) {
  const bar = meter[0] * 4 / meter[1];
  const measures = [];
  const at = (b) => (measures[b] ||= []);
  let cursor = 0;
  const put = (t, dur, item) => {
    // split at barlines, tied (a rest is split without a tie)
    while (dur > 1e-9) {
      const b = Math.floor((t + 1e-9) / bar), end = (b + 1) * bar, d = Math.min(dur, end - t);
      const tie = !item.rest && dur - d > 1e-9;
      at(b).push({ ...item, dur: d, tie });
      t += d; dur -= d;
    }
  };
  for (const e of evs) {
    if (e.grace) { at(Math.floor((e.t + 1e-9) / bar)).push({ ...e, dur: 0.25 }); continue; }
    if (e.t > cursor + 1e-9) put(cursor, e.t - cursor, { rest: true });
    put(e.t, e.dur, e);
    cursor = Math.max(cursor, e.t + e.dur);
  }
  const nb = measures.length;
  if (cursor < nb * bar - 1e-9) put(cursor, nb * bar - cursor, { rest: true });
  const leaf = (x) => x.rest ? `[:rest {:dur ${num(x.dur)}}]`
    : `[:note {:pitch ${typeof x.pitch === "string" ? str(x.pitch) : num(x.pitch)} :dur ${num(x.dur)}${x.grace ? " :grace true" : ""}${x.tie ? " :tie true" : ""}}]`;
  const m0 = `{:meter [${meter[0]} ${meter[1]}]${groups ? ` :groups [${groups.join(" ")}]` : ""}}`;
  return `[:voice${key ? ` {:key ${str(key)}}` : ""} ` +
    Array.from({ length: nb }, (_, b) => `[:measure ${b === 0 ? m0 + " " : ""}${(measures[b] || []).map(leaf).join(" ")}]`).join(" ") + "]";
}

// ── Essen: kern ──
// one spine, one meter (*M3/4; not *MX), its first `bars` bars after the pickup; ties merged; grace notes (q)
function essenPiece(file) {
  const lines = readFileSync(file, "latin1").split(/\r?\n/);
  if (lines.some((l) => l.includes("\t"))) return null;                      // more than one spine
  const meters = lines.filter((l) => /^\*M\d+\/\d+$/.test(l));
  if (meters.length !== 1 || lines.some((l) => /^\*M(X|\?)/.test(l))) return null;
  const [p, q] = meters[0].slice(2).split("/").map(Number);
  if (![2, 4, 8, 16].includes(q)) return null;
  const bar = p * 4 / q;
  const keyLine = lines.find((l) => /^\*[a-gA-G][#-]?:$/.test(l));
  const key = keyLine ? (keyLine[1] === keyLine[1].toUpperCase() ? keyLine.slice(1, -1).toLowerCase().replace("-", "b") : keyLine.slice(1, -1).replace("-", "b") + "m") : null;
  const evs = []; let t = 0, barNo = 0, pickup = null, tieOpen = null;
  for (const raw of lines) {
    if (!raw || raw[0] === "!" || raw[0] === "*") continue;
    if (raw[0] === "=") { if (pickup === null) pickup = t; barNo++; if (barNo > BARS) break; continue; }
    const tok = raw.trim();
    const m = tok.match(/^[^0-9a-gA-Gr]*(\d+)?(\.*)/);
    const grace = /q/.test(tok);
    const pitch = tok.match(/([a-gA-G])\1*([#-]*)/);
    const rest = /r/.test(tok) && !pitch;
    if (!m || (!m[1] && !grace)) return null;
    let dur = 0;
    if (m[1]) { const d = Number(m[1]); dur = d === 0 ? 8 : 4 / d; let add = dur / 2; for (const _ of m[2]) { dur += add; add /= 2; } }
    if (grace) { if (pitch) evs.push({ t, grace: true, pitch: name(pitch) }); continue; }
    if (rest) { t += dur; continue; }
    if (!pitch) return null;
    const nm = name(pitch);
    const tieStart = tok.includes("["), tieMid = tok.includes("_"), tieEnd = tok.includes("]");
    if ((tieMid || tieEnd) && tieOpen && tieOpen.pitch === nm) { tieOpen.dur += dur; if (tieEnd) tieOpen = null; t += dur; continue; }
    const e = { t, dur, pitch: nm };
    evs.push(e);
    tieOpen = tieStart ? e : null;
    t += dur;
  }
  if (pickup === null || barNo < BARS) return null;
  // a pickup shorter than a bar starts after the bar's beginning
  const shift = pickup > 1e-9 && pickup < bar - 1e-9 ? bar - pickup : 0;
  const end = (pickup > 1e-9 ? pickup : 0) + BARS * bar;
  const kept = evs.filter((e) => e.t < end - 1e-9).map((e) => ({ ...e, t: e.t + shift, dur: e.grace ? 0 : Math.min(e.dur, end - e.t) }));
  if (kept.filter((e) => !e.grace).length < 8) return null;
  return { meter: [p, q], groups: null, key, tree: treeOf(kept, [p, q], null, key) };
}
// kern pitch → a name: c = C4, cc = C5, C = C3, CC = C2; # sharp, - flat
function name(m) {
  const letters = m[0].replace(/[#-]/g, ""), l = letters[0];
  const oct = l === l.toLowerCase() ? 3 + letters.length : 4 - letters.length;
  const acc = (m[2] || "").replace(/#/g, "#").replace(/-/g, "b");
  return l.toLowerCase() + acc + oct;
}

// ── SymbTr: txt ──
// one usul (Kod 51), at most 10 beats a bar; times from the Offset column (the end of each row, in bars), so
// the ornaments that take time take it as written; Kod 8 (çarpma) is a grace note; Es is a rest.
// Pitches as MIDI with decimals from Koma53 (53 commas an octave; C5 = 318), so their microtones stay.
// The groups of a few aksak usuls (others: none, the quantizer's own spans)
const usulGroups = { "Aksak": [2, 2, 2, 3], "Aksaksemâî": [3, 2, 2, 3], "Curcuna": [3, 2, 2, 3], "Türkaksağı": [2, 3], "Devr-i Hindî (7/8)": [3, 2, 2] };
function symbtrPiece(file) {
  const rows = readFileSync(file, "utf8").split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split("\t"));
  const usuls = rows.filter((r) => r[1] === "51");
  if (usuls.length !== 1 || rows.some((r) => ["35", "56"].includes(r[1]))) return null;
  const [p, q] = [Number(usuls[0][6]), Number(usuls[0][7])];
  if (![2, 4, 8, 16].includes(q)) return null;
  const bar = p * 4 / q;
  if (bar > 10) return null;
  const groups = usulGroups[usuls[0][11]] || null;
  const evs = []; let prev = 0;
  for (const r of rows) {
    const kod = r[1], off = Number(r[12]);
    if (!["0", "1", "4", "7", "8", "9", "10", "11", "12", "23", "24", "28", "32", "43", "44"].includes(kod) || !Number.isFinite(off)) continue;
    const t = prev * bar, end = off * bar;
    if (end > BARS * bar + 1e-9) break;
    const rest = kod === "0" || r[2] === "Es" || !r[4];
    if (kod === "8" || end - t < 1e-9) { if (!rest) evs.push({ t, grace: true, pitch: midiOf(r[4]) }); prev = off; continue; }
    if (!rest) evs.push({ t, dur: end - t, pitch: midiOf(r[4]) });
    prev = off;
  }
  if (prev * bar < BARS * bar - 1e-6 || evs.filter((e) => !e.grace).length < 8) return null;
  return { meter: [p, q], groups, key: null, tree: treeOf(evs, [p, q], groups, null), usul: usuls[0][11] };
}
const midiOf = (koma) => Math.round((72 + (Number(koma) - 318) * 12 / 53) * 100) / 100;

// ── the sample ──
const r = rng(SEED);
const pick = (files, parse, k, src) => {
  const out = [];
  for (const f of shuffle(files.sort(), r)) {
    if (out.length >= k) break;
    let x = null; try { x = parse(f); } catch (_) { x = null; }
    if (x) out.push({ id: src + "/" + relative(sources[src].dir, f).replace(/\.(krn|txt)$/, ""), source: src, file: relative(sources[src].dir, f), ...x });
  }
  return out;
};
const essen = pick(walk(sources.essen.dir, ".krn"), essenPiece, Math.ceil(N / 2), "essen");
const symbtr = pick(walk(join(sources.symbtr.dir, "txt"), ".txt"), symbtrPiece, Math.floor(N / 2), "symbtr");
const all = [...essen, ...symbtr];
const edn = "[\n" + all.map((x) => ` {:id ${str(x.id)} :source :${x.source} :meter [${x.meter.join(" ")}]` +
  `${x.groups ? ` :groups [${x.groups.join(" ")}]` : ""}${x.key ? ` :key ${str(x.key)}` : ""}${x.usul ? ` :usul ${str(x.usul)}` : ""}\n  :tree ${x.tree}}`).join("\n") + "]\n";
writeFileSync(join(cache, "corpus.edn"), edn);
writeFileSync(join(cache, "SOURCES.md"),
  `# Quantization benchmark: outside corpus\n\nSample of ${all.length} pieces (seed ${SEED}, first ${BARS} bars), made by fetch.mjs. Not to be redistributed.\n\n` +
  Object.entries(sources).map(([k, s]) => `## ${k}\n\n${s.repo}\n\nLicense: ${s.license}\n\nCite: ${s.cite}\n\n` +
    all.filter((x) => x.source === k).map((x) => `- ${x.file}${x.usul ? " (" + x.usul + ")" : ""}`).join("\n")).join("\n\n") + "\n");
console.log(`${essen.length} Essen + ${symbtr.length} SymbTr pieces → ${relative(process.cwd(), join(cache, "corpus.edn"))}`);
