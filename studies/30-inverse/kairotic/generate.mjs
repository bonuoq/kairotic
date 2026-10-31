// Study 30 · the same dataset, made in Node when it has to be large.
//
//   npm i meyda@5.6.3
//   node generate.mjs --n 20000 --mode plausible --seed 1 --out inverse-20000.ndjson
//
// The first line is the header (synth, analysis, sampling); every other line is one example
// {seed, u, f}: the patch in [0, 1] and its descriptors frame by frame. NDJSON so a large set can be
// streamed, both here and in whatever trains on it.

import { createWriteStream } from "node:fs";
import { createRequire } from "node:module";
import { example, header } from "./dataset.mjs";

const require = createRequire(import.meta.url);
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const n = +arg("n", 1000), mode = arg("mode", "plausible"), seed = +arg("seed", 1);
const out = arg("out", `inverse-${mode}-${n}.ndjson`);
const meydaPath = arg("meyda", "meyda");

const M = require(meydaPath);
const Meyda = M.default || M;

const w = createWriteStream(out);
w.write(JSON.stringify(header(mode, seed, n)) + "\n");
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  // every example has its own seed, derived from the set's: any one of them can be made again alone
  w.write(JSON.stringify(example(Meyda, seed * 1000003 + i, mode)) + "\n");
  if ((i + 1) % 500 === 0) process.stderr.write(`${i + 1}/${n} · ${((Date.now() - t0) / (i + 1)).toFixed(1)} ms each\n`);
}
w.end(() => process.stderr.write(`→ ${out}\n`));
