// SPDX-License-Identifier: MPL-2.0
// The page's files (app/page/*.cljs) are all evaluated in the namespace user, one after another: a name
// defined in two of them is silently replaced by the later one (the release popup's ask! once replaced
// the Claude tab's, and "Write it" showed "undefined"). Fails when a top-level name is defined twice.
// Components written in a work are evaluated in that same namespace, so a top-level name that is also a
// function of clojure.core replaces it for them too (an atom called subs once broke every (subs …) in a
// component): it fails as well when a name is in tests/clojure-core-names.txt.
// node tests/names.mjs
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "page");
const where = new Map();
for (const f of readdirSync(dir).filter((f) => f.endsWith(".cljs")).sort()) {
  readFileSync(join(dir, f), "utf8").split("\n").forEach((line, i) => {
    const m = line.match(/^\((?:defn-?|def|defonce|defmulti|defmacro)\s+(?:\^\S+\s+)*([^\s()\[\]]+)/);
    if (m) where.set(m[1], [...(where.get(m[1]) || []), `${f}:${i + 1}`]);
  });
}
const twice = [...where].filter(([, at]) => at.length > 1);
for (const [name, at] of twice) {
  console.log(`✗ ${name} is defined more than once: ${at.join(", ")}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=names::${name} is defined more than once in app/page: ${at.join(", ")}`);
}
const core = new Set(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "clojure-core-names.txt"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
const shadows = [...where].filter(([name]) => core.has(name));
for (const [name, at] of shadows) {
  console.log(`✗ ${name} replaces clojure.core/${name} for the page and every component: ${at.join(", ")}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=names::${name} in app/page replaces clojure.core/${name} (the page and components share the namespace user): ${at.join(", ")}`);
}
const failed = twice.length + shadows.length;
console.log(failed ? `${twice.length} names defined more than once, ${shadows.length} that replace clojure.core`
                   : `${where.size} names, each defined once, none replacing clojure.core`);
process.exit(failed ? 1 : 0);
