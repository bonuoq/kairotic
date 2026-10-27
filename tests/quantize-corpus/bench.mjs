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
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const site = join(root, "_site");
const cache = join(here, ".cache");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const seeds = arg("seeds", 3), key = process.argv.includes("--key");
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

const outside = existsSync(join(cache, "corpus.edn")) ? readFileSync(join(cache, "corpus.edn"), "utf8") : null;
if (!outside) console.log("(no outside corpus: node tests/quantize-corpus/fetch.mjs fetches it; running Kairotic's own)");

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(url);
await page.waitForFunction(() => { try { return scittle.core.eval_string("(boolean (find-ns 'kairotic.qbench))") === true; } catch (_) { return false; } },
                           null, { timeout: 180000 });
const t0 = Date.now();
const out = await page.evaluate(([edn, seeds, key]) => {
  window.__corpus = edn;
  return scittle.core.eval_string(`
    (do (require '[kairotic.qbench :as qb] '[kairotic.mt :as mt])
        (let [outside (when js/window.__corpus (mt/read-tree js/window.__corpus))
              rs (qb/run-corpus (into (qb/own-corpus) outside) {:seeds ${seeds} :key? ${key}})]
          (js/JSON.stringify (clj->js {:report (qb/report rs) :results rs}))))`);
}, [outside, seeds, key]);
const { report, results } = JSON.parse(out);
const head = `Quantization benchmark · ${new Date().toISOString().slice(0, 10)} · seeds ${seeds}${key ? " · with keys" : ""} · ${((Date.now() - t0) / 1000).toFixed(0)} s\n\n`;
console.log(head + report);
mkdirSync(cache, { recursive: true });
writeFileSync(join(cache, "report.md"), head + report + "\n");
writeFileSync(join(cache, "results.json"), JSON.stringify(results, null, 1));
await browser.close();
server.close();
