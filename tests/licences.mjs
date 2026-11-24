// SPDX-License-Identifier: MPL-2.0
// Data under a licence other than the code's stays apart from what Kairotic distributes. Bach's chorales corpus
// (studies/_shared/chorales, CC BY-NC-SA 4.0: non-commercial) lives with the studies and carries its own LICENSE.md;
// nothing in the app, the core, the official packages, the relay, the site's build or what they generate may load it,
// so @kairotic/app, the @kairotic/* packages and the relay stay MPL-2.0 alone.
// In Node, from the repository:  node tests/licences.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const APART = [{ dir: "studies/_shared/chorales", spdx: "CC BY-NC-SA 4.0", pattern: /_shared\/chorales|chorales\/phrases/ }];
const DISTRIBUTED = /^(app|core|packages|relay|site|examples|docs\/tutorials)\//;

const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
let failed = 0;
for (const { dir, spdx, pattern } of APART) {
  const lic = join(root, dir, "LICENSE.md");
  if (!existsSync(lic) || !readFileSync(lic, "utf8").includes(spdx)) {
    console.log(`✗ ${dir}: no LICENSE.md naming ${spdx}`); failed++;
  }
  for (const f of files.filter((f) => DISTRIBUTED.test(f) && !/\.(png|jpg|wasm|woff2?)$/.test(f))) {
    if (pattern.test(readFileSync(join(root, f), "utf8"))) { console.log(`✗ ${f} refers to ${dir} (${spdx})`); failed++; }
  }
}
if (failed) process.exit(1);
console.log(`✓ ${APART.map((a) => a.dir).join(", ")}: kept apart from the app, the packages and the relay`);
