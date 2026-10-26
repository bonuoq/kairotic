// SPDX-License-Identifier: MPL-2.0
// The page looks for each official package on npm at the version pinned in core/kairotic/library.cljs, and
// only when it is not there uses its own copy (built from packages/<name>). A pin older than the package's
// package.json makes the page bring the older version from npm, without the changes made since (the
// patterns player once lost its [:gain] that way). Fails when a pin and its package.json differ.
// node tests/versions.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lib = readFileSync(join(root, "core", "kairotic", "library.cljs"), "utf8");
const pins = new Map([...lib.matchAll(/"(@kairotic\/[\w-]+)"\s+\{:version "([^"]+)"/g)].map((m) => [m[1], m[2]]));
let bad = 0;
for (const name of readdirSync(join(root, "packages"))) {
  const p = join(root, "packages", name, "package.json");
  if (!existsSync(p)) continue;
  const pkg = JSON.parse(readFileSync(p, "utf8"));
  const pin = pins.get(pkg.name);
  if (pin !== pkg.version) {
    bad += 1;
    const msg = `${pkg.name}: package.json is ${pkg.version}, the page pins ${pin ?? "nothing"} (core/kairotic/library.cljs)`;
    console.log("✗ " + msg);
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=versions::${msg}`);
  }
}
console.log(bad ? `${bad} package(s) pinned to another version` : `${pins.size} packages, each pinned to its own version`);
process.exit(bad ? 1 : 0);
