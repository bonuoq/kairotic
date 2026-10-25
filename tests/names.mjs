// SPDX-License-Identifier: MPL-2.0
// The page's files (app/page/*.cljs) are all evaluated in the namespace user, one after another: a name
// defined in two of them is silently replaced by the later one (the release popup's ask! once replaced
// the Claude tab's, and "Write it" showed "undefined"). Fails when a top-level name is defined twice.
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
console.log(twice.length ? `${twice.length} names defined more than once` : `${where.size} names, each defined once`);
process.exit(twice.length ? 1 : 0);
