// SPDX-License-Identifier: MPL-2.0
// Orders are keywords: a box never takes a string as an order (#197: msg is read as Clojure, `msg clear` is a name and
// `msg :clear` the order). A string that reaches a box is data — a line for a board, a value for edn, a URL — so a set
// that holds both a keyword and a string, as orders were matched before (#{:clear "clear"}), is not allowed in the
// components. In Node:  node tests/keywords.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// sets of data, not orders: words written in a tree or a pattern, and the modes of a page's address
const allowed = [
  /#\{:every "every"\}/,                                  // mt: {:accidentals :every} in a tree, written either way
  /#\{:rest :_ :- :r "rest" "_" "-" "r"\}/,               // patterns: the rests of a melody string
  /#\{:present :release :perform "present" "release" "perform"\}/, // the mode in a page's URL
];
const files = [];
for (const p of readdirSync(join(root, "packages"))) {
  try { for (const f of readdirSync(join(root, "packages", p, "src"))) if (f.endsWith(".cljs")) files.push(join("packages", p, "src", f)); } catch (_) {}
}
for (const f of readdirSync(join(root, "core/kairotic"))) if (f.endsWith(".cljs")) files.push(join("core/kairotic", f));
for (const f of readdirSync(join(root, "app/page"))) if (f.endsWith(".cljs")) files.push(join("app/page", f));

const bad = [];
for (const f of files) {
  const lines = readFileSync(join(root, f), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/^\s*;/.test(line)) return;
    for (const m of line.matchAll(/#\{((?:[^{}"]|"[^"]*")*)\}/g)) {
      const items = m[1].match(/"[^"]*"|\S+/g) || [];
      if (items.some((x) => x.startsWith(":")) && items.some((x) => x.startsWith('"')) && !allowed.some((a) => a.test(m[0])))
        bad.push(`${f}:${i + 1}: ${m[0]}`);
    }
  });
}
console.log(bad.length ? `${bad.length} set(s) take a string as an order:` : `${files.length} files: no order taken as a string`);
for (const b of bad) console.log("  ✗ " + b);
process.exit(bad.length ? 1 : 0);
