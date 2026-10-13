// Kairotic Pages · build
// Makes the GitHub Pages edition in _site/ from the current study (studies/21-flow): the same page
// and modules, plus GUN (vendored), the adapter and the boot script, loaded before the ClojureScript.
//
//   node site/build.mjs            → _site/
//   node site/build.mjs out/dir    → another folder
//
// Nothing is downloaded: Scittle, Verovio and Faust still come from jsDelivr at run time, as in claude.ai.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const study = join(root, "studies", "21-flow");
const out = resolve(root, process.argv[2] || "_site");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// the page's modules and libraries, as published in claude.ai
cpSync(join(study, "kairotic"), join(out, "kairotic"), { recursive: true });
// the adapter always from core (the study keeps a copy for claude.ai)
cpSync(join(root, "core", "backends", "gun-backend.js"), join(out, "kairotic", "backends", "gun-backend.js"));
cpSync(join(root, "site", "vendor"), join(out, "vendor"), { recursive: true });
for (const f of ["config.js", "boot.js"]) cpSync(join(root, "site", f), join(out, f));

const scittle = '<script src="https://cdn.jsdelivr.net/npm/scittle@';
let html = readFileSync(join(study, "index.html"), "utf8");
if (!html.includes(scittle)) throw new Error("index.html: Scittle script tag not found");
const inject = [
  "<!-- Pages edition: data in GUN, Claude with the visitor's own key -->",
  '<script src="vendor/gun/gun.js"></script>',
  '<script src="vendor/gun/sea.js"></script>',
  '<script src="kairotic/backends/gun-backend.js"></script>',
  '<script src="config.js"></script>',
  '<script src="boot.js"></script>',
  "",
].join("\n");
html = html.replace(scittle, inject + scittle);
writeFileSync(join(out, "index.html"), html);
writeFileSync(join(out, ".nojekyll"), "");   // serve files as they are

for (const f of ["index.html", "vendor/gun/gun.js", "vendor/gun/sea.js", "kairotic/core.cljs", "kairotic/backends/gun-backend.js"])
  if (!existsSync(join(out, f))) throw new Error("missing " + f);
console.log("Kairotic Pages →", out);
