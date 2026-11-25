// SPDX-License-Identifier: MPL-2.0
// Data under a licence other than the code's stays apart from what Kairotic distributes. Bach's chorales corpus
// (studies/_shared/chorales, CC BY-NC-SA 4.0: non-commercial) lives with the studies and carries its own LICENSE.md;
// nothing in the app, the core, the official packages, the relay, the site's build or what they generate may load it,
// so @kairotic/app, the @kairotic/* packages and the relay stay free of it.
// Third-party code (THIRD_PARTY.md) may travel in them, under its own permissive licence: a package that publishes
// any declares every licence of it in its package.json ("MPL-2.0 AND MIT"), and the publish workflow puts
// THIRD_PARTY.md, with the notices, into every package.
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

// ── third-party code in what is published ──
const listed = existsSync(join(root, "THIRD_PARTY.md"))
  ? [...readFileSync(join(root, "THIRD_PARTY.md"), "utf8").matchAll(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/gm)].map((m) => ({ path: m[1], spdx: m[2] }))
  : [];
const ids = (expr) => expr.split(/\s+(?:AND|OR|WITH)\s+|[()]/).map((x) => x.trim()).filter(Boolean);
// what each published package is made from (the app: site/build.mjs copies core/ and the packages' builds into it)
const units = [{ json: "app/package.json", from: ["app/", "core/", /^packages\/[^/]+\/(src|assets)\//] },
               { json: "relay/package.json", from: ["relay/"] }];
for (const d of execFileSync("git", ["ls-files", "packages/*/package.json"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean))
  units.push({ json: d, from: [d.replace(/package\.json$/, "")] });
const within = (path, from) => from.some((f) => (typeof f === "string" ? path.startsWith(f) : f.test(path)));
let carried = 0;
for (const u of units) {
  const pkg = JSON.parse(readFileSync(join(root, u.json), "utf8"));
  const declared = new Set(ids(pkg.license || ""));
  for (const e of listed.filter((e) => within(e.path, u.from))) {
    carried++;
    // an OR is a choice: one of its licences declared is enough
    const need = e.spdx.includes(" OR ") ? [ids(e.spdx).find((id) => declared.has(id)) || ids(e.spdx).join(" or ")] : ids(e.spdx);
    const lacking = need.filter((id) => !declared.has(id));
    if (lacking.length) { console.log(`✗ ${pkg.name} publishes ${e.path} (${e.spdx}) but its package.json says "${pkg.license}" (no ${lacking.join(", ")})`); failed++; }
  }
}
const publish = readFileSync(join(root, ".github", "workflows", "publish-packages.yml"), "utf8");
if (!/THIRD_PARTY\.md/.test(publish)) { console.log("✗ the publish workflow does not put THIRD_PARTY.md into the packages"); failed++; }

if (failed) process.exit(1);
console.log(`✓ ${APART.map((a) => a.dir).join(", ")}: kept apart from the app, the packages and the relay`);
console.log(`✓ third-party code in what is published (${carried} listed files): every licence declared by its package`);
