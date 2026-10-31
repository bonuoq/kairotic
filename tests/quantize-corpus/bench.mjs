// SPDX-License-Identifier: MPL-2.0
// Kairotic · the quantization benchmark (issue #105): Kairotic's own corpus and, if fetched, the outside one.
//
//   node site/build.mjs                       (the site the benchmark runs in: _site/)
//   node tests/quantize-corpus/fetch.mjs      (once: Essen and SymbTr into .cache/, a sample of 200 pieces)
//   node tests/quantize-corpus/bench.mjs [--seeds 3] [--key]
//
// Serves _site/, opens its tests page in a headless Chromium, runs kairotic.qbench over every piece at every
// level of imprecision, and prints the table (also written to .cache/report.md, with every result in
// .cache/results.json). --key gives the quantizer each piece's key (Essen), to tell spelling from key finding.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const site = join(root, "_site");
const cache = join(here, ".cache");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const seeds = arg("seeds", 3), key = process.argv.includes("--key");
// --timed: play the pieces in seconds, at a tempo that moves, and quantize them through the beats found (#106)
const timed = process.argv.includes("--timed");
// --asap: the beats found in real piano performances against the annotated ones (fetch-asap.mjs first)
const asap = process.argv.includes("--asap");
// --cante: what transcribe writes from the f0 of flamenco singing against a manual transcription (fetch-cante2midi.mjs
// first); --opts are then transcribe's arguments, e.g. "{:min-ms 100}"
const cante = process.argv.includes("--cante");
// --weimar: jazz solos of the Weimar Jazz Database (fetch-weimar.py first): the beats found, and the notes quantized
// through the annotated beats against their written place; --n solos (40), their first --secs seconds (30), --seed
const weimar = process.argv.includes("--weimar");
// --opts "{:w {:coh 1}}": options for the quantizer (EDN), for every piece
const qopts = (() => { const i = process.argv.indexOf("--opts"); return i > 0 ? process.argv[i + 1] : "nil"; })();
if (!existsSync(join(site, "tests.html"))) { console.error("Build the site first: node site/build.mjs"); process.exit(1); }

const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css",
                ".json": "application/json", ".wasm": "application/wasm", ".cljs": "text/plain" };
const server = createServer((req, res) => {
  let p = join(site, decodeURIComponent(req.url.split("?")[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": (types[extname(p)] || "application/octet-stream") + "; charset=utf-8" });
  res.end(readFileSync(p));
}).listen(0);
const url = `http://localhost:${server.address().port}/tests.html`;

if (cante && !existsSync(join(cache, "cante2midi.edn"))) { console.error("Convert cante2midi first: node tests/quantize-corpus/fetch-cante2midi.mjs <zips>"); process.exit(1); }
if (asap && !existsSync(join(cache, "asap.edn"))) { console.error("Fetch ASAP first: node tests/quantize-corpus/fetch-asap.mjs"); process.exit(1); }
if (weimar && !existsSync(join(cache, "weimar.json.gz"))) { console.error("Export the Weimar Jazz Database first: python3 tests/quantize-corpus/fetch-weimar.py"); process.exit(1); }
const outside = weimar ? weimarSample(arg("n", 40), arg("secs", 30), arg("seed", 106)) : cante ? readFileSync(join(cache, "cante2midi.edn"), "utf8") : asap ? readFileSync(join(cache, "asap.edn"), "utf8") : existsSync(join(cache, "corpus.edn")) ? readFileSync(join(cache, "corpus.edn"), "utf8") : null;
if (!outside) console.log("(no outside corpus: node tests/quantize-corpus/fetch.mjs fetches it; running Kairotic's own)");

// A seeded sample of solos in 4/4, from their first downbeat: notes [on off midi loudness 0…1], each note's written
// place [beat division] (beats counted from that downbeat: the bar's beat, its tatum over the division), the beats.
function weimarSample(N, SECS, SEED) {
  const solos = JSON.parse(gunzipSync(readFileSync(join(cache, "weimar.json.gz"))).toString("utf8"));
  let a = SEED >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pool = solos.filter((s) => s.signature === "4/4" && s.beats.length > 16 && s.notes.length > 16);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const edn = [];
  for (const s of pool.slice(0, N)) {
    const first = s.beats.findIndex((b) => b[2] === 1);
    const bs = s.beats.slice(first).filter((b) => b[0] <= s.beats[first][0] + SECS + 1);
    const k = new Map(bs.map((b, i) => [b[1] + ":" + b[2], i]));
    const end = s.beats[first][0] + SECS;
    const ns = s.notes.filter((n) => n[0] >= bs[0][0] - 0.05 && n[0] < end && k.has(n[4] + ":" + n[5]) && n[7] > 0);
    const ls = ns.map((n) => n[3]).filter((x) => x != null), lo = Math.min(...ls), hi = Math.max(...ls);
    const q = (x) => Math.round(x * 1e4) / 1e4;
    const notes = ns.map((n) => `[${q(n[0])} ${q(n[0] + n[1])} ${n[2]} ${n[3] == null || hi <= lo ? "nil" : q((n[3] - lo) / (hi - lo))}]`);
    const written = ns.map((n) => `[${q(k.get(n[4] + ":" + n[5]) + (n[6] - 1) / n[7])} ${n[7]}]`);
    const downs = bs.filter((b) => b[2] === 1).map((b) => q(b[0]));
    edn.push(`{:id ${JSON.stringify(`weimar/${s.id} ${s.performer} – ${s.title}`)} :source :weimar :meter [4 4] :feel ${JSON.stringify(s.feel || "")}\n :notes [${notes.join(" ")}]\n :written [${written.join(" ")}]\n :beats [${bs.map((b) => q(b[0])).join(" ")}] :downbeats [${downs.join(" ")}]}`);
  }
  const out = "[" + edn.join("\n") + "]";
  writeFileSync(join(cache, "weimar-sample.edn"), out + "\n");   // what was run, to look at
  return out;
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(url);
await page.waitForFunction(() => { try { return scittle.core.eval_string("(boolean (find-ns 'kairotic.qbench))") === true; } catch (_) { return false; } },
                           null, { timeout: 180000 });
const t0 = Date.now();
const tsrc = cante ? readFileSync(join(root, "packages", "analysis", "src", "transcribe.cljs"), "utf8") : null;
const out = await page.evaluate(([edn, seeds, key, qopts, timed, asap, tsrc, weimar]) => {
  window.__corpus = edn; window.__qopts = qopts; window.__tsrc = tsrc;
  if (tsrc) return scittle.core.eval_string(`
    (do (require '[kairotic.qbench :as qb] '[kairotic.mt :as mt] '[kairotic.api :as api])
        (let [d (load-string js/window.__tsrc)
              pieces (mt/read-tree js/window.__corpus)
              args (or (mt/read-tree js/window.__qopts) {})
              rs (mapv (fn [p] (qb/run-transcribed p d args)) pieces)]
          (js/JSON.stringify (clj->js {:report (qb/transcribed-report rs) :results rs}))))`);
  return scittle.core.eval_string(`
    (do (require '[kairotic.qbench :as qb] '[kairotic.mt :as mt])
        (let [outside (when js/window.__corpus (mt/read-tree js/window.__corpus))
              qopts (mt/read-tree js/window.__qopts)
              rs (if ${weimar}
                   (mapv (fn [p] (qb/run-weimar p qopts)) outside)
                   (if ${asap}
                   (mapv (fn [p] (qb/run-performed p qopts)) outside)
                   (qb/run-corpus (into (qb/own-corpus) outside) {:seeds ${seeds} :key? ${key} :qopts qopts :timed? ${timed}})))]
          (js/JSON.stringify (clj->js {:report (if ${weimar} (qb/weimar-report rs) (if ${asap} (qb/performed-report rs) (qb/report rs))) :results rs}))))`);
}, [outside, seeds, key, qopts, timed, asap, tsrc, weimar]);
const { report, results } = JSON.parse(out);
const head = `Quantization benchmark · ${new Date().toISOString().slice(0, 10)} · seeds ${seeds}${key ? " · with keys" : ""}${timed ? " · timed" : ""}${asap ? " · ASAP performances" : ""}${cante ? " · cante2midi, transcribe" : ""}${weimar ? " · Weimar Jazz Database" : ""}${qopts !== "nil" ? " · " + qopts : ""} · ${((Date.now() - t0) / 1000).toFixed(0)} s\n\n`;
console.log(head + report);
mkdirSync(cache, { recursive: true });
writeFileSync(join(cache, "report.md"), head + report + "\n");
writeFileSync(join(cache, "results.json"), JSON.stringify(results, null, 1));
await browser.close();
server.close();
