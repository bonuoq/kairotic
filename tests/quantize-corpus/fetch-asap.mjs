// SPDX-License-Identifier: MPL-2.0
// Kairotic · the quantization benchmark's real performances (issue #105, layer 2; issue #106).
//
//   node tests/quantize-corpus/fetch-asap.mjs [--n 40] [--seed 106] [--secs 30]
//
// Clones ASAP (Foscarin et al., ISMIR 2020: piano performances aligned with their scores, with every beat and
// downbeat annotated; CC BY-NC-SA 4.0, so into the git-ignored cache, not redistributed) and writes a seeded
// sample of n performances, one per piece, their first `secs` seconds:
//
//   .cache/asap.edn   [{:id "asap/Bach/Fugue/bwv_846/Shi05M" :source :asap :meter [4 4]
//                       :notes [[on off midi velocity] …] (seconds) :beats [t …] :downbeats [t …]} …]
//
// The benchmark (bench.mjs --asap) finds the beats of each performance (kairotic.tempo, through the
// quantizer) and compares them with the annotated ones.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, ".cache");
const dir = join(cache, "asap");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const N = arg("n", 40), SEED = arg("seed", 106), SECS = arg("secs", 30);
mkdirSync(cache, { recursive: true });
if (!existsSync(dir)) { console.log("cloning ASAP …"); execFileSync("git", ["clone", "-q", "--depth", "1", "https://github.com/fosfrancesco/asap-dataset", dir], { stdio: "inherit" }); }

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (xs, r) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

// ── a standard MIDI file: its notes in seconds (all tracks, the tempo map applied) ──
function midiNotes(file) {
  const b = readFileSync(file);
  let p = 0;
  const u32 = () => { const v = b.readUInt32BE(p); p += 4; return v; }, u16 = () => { const v = b.readUInt16BE(p); p += 2; return v; };
  const vlq = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
  if (b.toString("ascii", 0, 4) !== "MThd") throw new Error("not a MIDI file");
  p = 4; const hl = u32(); u16(); const ntr = u16(); const div = u16(); p = 8 + hl;
  if (div & 0x8000) throw new Error("SMPTE time");
  const events = []; // [tick, kind, a, b]
  for (let tr = 0; tr < ntr; tr++) {
    if (b.toString("ascii", p, p + 4) !== "MTrk") break;
    p += 4; const len = u32(), end = p + len; let tick = 0, status = 0;
    while (p < end) {
      tick += vlq();
      let s = b[p];
      if (s & 0x80) { status = s; p++; } else s = status;
      if (s === 0xff) { const type = b[p++], l = vlq(); if (type === 0x51) events.push([tick, "tempo", (b[p] << 16) | (b[p + 1] << 8) | b[p + 2]]); p += l; }
      else if (s === 0xf0 || s === 0xf7) { p += vlq(); }
      else {
        const hi = s & 0xf0;
        if (hi === 0x90 || hi === 0x80) { const k = b[p++], v = b[p++]; events.push([tick, hi === 0x90 && v > 0 ? "on" : "off", k, v, s & 0x0f]); }
        else if (hi === 0xc0 || hi === 0xd0) p += 1; else p += 2;
      }
    }
    p = end;
  }
  events.sort((x, y) => x[0] - y[0] || (x[1] === "tempo" ? -1 : 0));
  let us = 500000, lastTick = 0, sec = 0;
  const open = new Map(), notes = [];
  for (const e of events) {
    sec += (e[0] - lastTick) * us / div / 1e6; lastTick = e[0];
    if (e[1] === "tempo") us = e[2];
    else if (e[1] === "on") { const k = e[4] * 128 + e[2]; (open.get(k) || open.set(k, []).get(k)).push([sec, e[3]]); }
    else { const k = e[4] * 128 + e[2], st = open.get(k); if (st && st.length) { const [t, v] = st.shift(); notes.push([t, sec, e[2], v]); } }
  }
  return notes.sort((x, y) => x[0] - y[0]);
}

// ── the sample: one performance per piece ──
const r = rng(SEED);
const perfs = walk(dir).filter((f) => f.endsWith(".mid") && !f.endsWith("midi_score.mid") && existsSync(f.replace(/\.mid$/, "_annotations.txt")));
const byPiece = new Map();
for (const f of perfs.sort()) { const k = dirname(f); (byPiece.get(k) || byPiece.set(k, []).get(k)).push(f); }
const pieces = shuffle([...byPiece.keys()], r);
const out = [];
const r3 = (x) => Math.round(x * 1000) / 1000;
for (const k of pieces) {
  if (out.length >= N) break;
  const f = byPiece.get(k)[Math.floor(r() * byPiece.get(k).length)];
  try {
    const ann = readFileSync(f.replace(/\.mid$/, "_annotations.txt"), "utf8").trim().split("\n").map((l) => l.split("\t"));
    const first = ann.find((a) => /^db,\d+\/\d+/.test(a[2]));
    if (!first) continue;
    const [p, q] = first[2].split(",")[1].split("/").map(Number);
    // one time signature in the window, so that it can be given to the quantizer
    const t0 = Number(ann[0][0]), t1 = t0 + SECS;
    const inWin = ann.filter((a) => Number(a[0]) >= t0 - 0.01 && Number(a[0]) < t1);
    if (inWin.some((a) => /^db,\d+\/\d+/.test(a[2]) && a[2].split(",")[1] !== `${p}/${q}`)) continue;
    const notes = midiNotes(f).filter((n) => n[0] >= t0 - 2 && n[0] < t1).map((n) => [r3(n[0]), r3(n[1]), n[2], n[3]]);
    if (notes.length < 16) continue;
    out.push({ id: "asap/" + relative(dir, f).replace(/\.mid$/, ""), meter: [p, q],
               beats: inWin.map((a) => r3(Number(a[0]))), downbeats: inWin.filter((a) => a[2].startsWith("db")).map((a) => r3(Number(a[0]))), notes });
  } catch (e) { /* a file that does not read is left out */ }
}
const edn = "[\n" + out.map((x) => ` {:id ${JSON.stringify(x.id)} :source :asap :meter [${x.meter.join(" ")}]\n  :beats [${x.beats.join(" ")}]\n  :downbeats [${x.downbeats.join(" ")}]\n  :notes [${x.notes.map((n) => `[${n.join(" ")}]`).join(" ")}]}`).join("\n") + "]\n";
writeFileSync(join(cache, "asap.edn"), edn);
writeFileSync(join(cache, "SOURCES-asap.md"), `# ASAP sample\n\nhttps://github.com/fosfrancesco/asap-dataset · CC BY-NC-SA 4.0 · not to be redistributed.\n\nFoscarin, F., McLeod, A., Rigaux, P., Jacquemard, F., Sakai, M. (2020). ASAP: a dataset of aligned scores and performances for piano transcription. ISMIR 2020.\n\n${out.length} performances (seed ${SEED}, first ${SECS} s):\n\n` + out.map((x) => `- ${x.id} (${x.meter.join("/")})`).join("\n") + "\n");
console.log(`${out.length} ASAP performances → ${relative(process.cwd(), join(cache, "asap.edn"))}`);
