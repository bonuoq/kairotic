// SPDX-License-Identifier: MPL-2.0
// Builds the tutorials Kairotic opens as lessons (Study 18):
//   docs/tutorials/<track>/<id>.md  →  docs/tutorials/catalog.mjs
//   export default { tutorials: [{ id, track, order, title: {en, es}, steps: [{ title, note, try, code: [...] }] }] }
//
//   node docs/tutorials/build.mjs [copy/to/tutorials.mjs …]
//
// The format (see README.md) reads as plain Markdown on GitHub:
//
//   # From patch to code | Del patch al código
//   track: patch-code
//   order: 1
//
//   ## A box | Una caja
//   @en
//   Text of the step, with `code` and **bold**. Blank lines separate paragraphs.
//   @es
//   Texto del paso…
//   @try.en
//   Something to do here (optional).
//   @try.es
//   Algo que hacer aquí (opcional).
//   ```kairotic
//   (box :b1 "osc~ 220" 40 90)
//   ```
//
// The code of a step is made gesture by gesture when the lesson opens (one form, one event), so each
// step is a point in the history. A step without code is a note on the same point.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TRACKS = ["patch-code", "theory", "composition", "dsp", "faust"];

function bilingual(s, where) {
  const parts = s.split("|").map((x) => x.trim());
  if (parts.length > 2) throw new Error(`${where}: more than one | in a title`);
  return { en: parts[0], es: parts[1] ?? parts[0] };
}

// splits code into top-level forms, minding strings and comments
function forms(src, where) {
  const out = [];
  let depth = 0, start = -1, inStr = false, esc = false, comment = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (comment) { if (c === "\n") comment = false; continue; }
    if (inStr) {
      if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false;
      continue;
    }
    if (c === ";") { comment = true; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "(" || c === "[" || c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth < 0) throw new Error(`${where}: unbalanced ${c}`);
      if (depth === 0) out.push(src.slice(start, i + 1).replace(/\s*\n\s*/g, " "));
    }
  }
  if (depth !== 0 || inStr) throw new Error(`${where}: unbalanced code`);
  return out;
}

function parse(text, file) {
  const id = basename(file, ".md");
  const t = { id, track: basename(dirname(file)), order: 99, title: null, steps: [] };
  let step = null, field = null, code = null;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, n) => {
    const where = `${file}:${n + 1}`;
    if (code !== null) {
      if (/^```\s*$/.test(line)) { step.code.push(...forms(code, where)); code = null; }
      else code += line + "\n";
      return;
    }
    let m;
    if ((m = line.match(/^# (.+)$/)) && !t.title) { t.title = bilingual(m[1], where); return; }
    if (!step && (m = line.match(/^(id|track|order):\s*(.+)$/))) {
      t[m[1]] = m[1] === "order" ? Number(m[2]) : m[2].trim();
      return;
    }
    if ((m = line.match(/^## (.+)$/))) {
      step = { title: bilingual(m[1], where), note: { en: "", es: "" }, try: { en: "", es: "" }, code: [] };
      t.steps.push(step); field = null; return;
    }
    if ((m = line.match(/^@(en|es|try\.en|try\.es)\s*$/))) {
      if (!step) throw new Error(`${where}: @${m[1]} before the first step (## …)`);
      field = m[1]; return;
    }
    if (/^```kairotic\s*$/.test(line)) {
      if (!step) throw new Error(`${where}: code before the first step`);
      code = ""; return;
    }
    if (step && field) {
      const [k, l] = field.startsWith("try.") ? ["try", field.slice(4)] : ["note", field];
      step[k][l] += line + "\n";
    }
  });
  if (code !== null) throw new Error(`${file}: a code block is not closed`);
  if (!t.title) throw new Error(`${file}: no title (# English | Español)`);
  if (!TRACKS.includes(t.track)) throw new Error(`${file}: unknown track ${t.track} (${TRACKS.join(", ")})`);
  if (!t.steps.length) throw new Error(`${file}: no steps (## …)`);
  t.steps.forEach((s, i) => {
    for (const k of ["note", "try"]) for (const l of ["en", "es"]) s[k][l] = s[k][l].trim();
    if (!s.note.en || !s.note.es) throw new Error(`${file}: step ${i + 1} needs @en and @es`);
    if (!!s.try.en !== !!s.try.es) throw new Error(`${file}: step ${i + 1} has @try in one language only`);
  });
  return t;
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : (f.endsWith(".md") && dir !== here ? [p] : []);
  });
}

const tutorials = walk(here)
  .map((f) => parse(readFileSync(f, "utf8"), f.slice(here.length + 1)))
  .sort((a, b) => TRACKS.indexOf(a.track) - TRACKS.indexOf(b.track) || a.order - b.order);

const ids = new Set();
for (const t of tutorials) { if (ids.has(t.id)) throw new Error(`two tutorials with the id ${t.id}`); ids.add(t.id); }

const body = "// Generated by docs/tutorials/build.mjs — edit the .md files, not this.\n" +
  "export default " + JSON.stringify({ tutorials }, null, 1) + ";\n";
const outs = [join(here, "catalog.mjs"), ...process.argv.slice(2).map((p) => resolve(p))];
for (const o of outs) writeFileSync(o, body);
console.log(`${tutorials.length} tutorial(s), ${tutorials.reduce((n, t) => n + t.steps.length, 0)} steps → ${outs.join(", ")}`);
