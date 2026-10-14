// SPDX-License-Identifier: MPL-2.0
// Bundles the code editor (entry.mjs and the CodeMirror packages it uses) into one ES module,
// core/vendor/codemirror.mjs, that the page imports as it is: Kairotic stays static, without a build of
// its own. Run by .github/workflows/vendor.yml (npm install, then node build.mjs) when this folder changes.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(here, "entry.mjs")],
  outfile: join(here, "..", "codemirror.mjs"),
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2020",
  legalComments: "eof",
  banner: { js: "// Kairotic code editor: CodeMirror 6 (MIT, Marijn Haverbeke and others) and @nextjournal/clojure-mode (ISC), bundled by core/vendor/codemirror/build.mjs. Do not edit: edit entry.mjs." },
});
console.log("core/vendor/codemirror.mjs");
