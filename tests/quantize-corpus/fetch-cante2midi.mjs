// SPDX-License-Identifier: MPL-2.0
// Kairotic · flamenco singing for the transcription benchmark (issue #106, the transcription layer).
//
//   node tests/quantize-corpus/fetch-cante2midi.mjs <zip or folder> …  [--every 4]
//
// cante2midi (Kroher & Gómez, "Automatic transcription of flamenco singing from polyphonic music recordings",
// IEEE/ACM TASLP 2016; https://zenodo.org/records/1322526): 20 a cappella and accompanied cantes, each with
//   · the predominant melody, frame by frame (.f0.csv: seconds, Hz; ≤ 0 where no voice is heard), from the
//     cantes' recordings (2.9 ms apart);
//   · a manual note transcription (groundTruth: .notes, "onset,duration,midi,0", seconds);
//   · the authors' automatic transcription (automaticTranscription: .notes.csv, "onset, duration, midi").
// Give it the three zips of the record (or folders with their files): they are read, not redistributed.
// Writes .cache/cante2midi.edn:
//
//   [{:id "cante2midi/01_GabrielMoreno_YoNoTeHeDaoMotivos" :source :cante2midi
//     :truth [[on dur midi] …] :auto [[on dur midi] …]
//     :f0 [t0 dt [hz …]]} …]          (every 4th frame, 11.6 ms apart, as pitch~ hears: 0 where no voice)
//
// The benchmark (bench.mjs --cante) gives the f0 to transcribe, as pitch~ would, and compares the notes it
// writes with the manual ones (note F-measure: onsets within 50 ms, pitch within 50 cents, and offsets).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, ".cache");
const unpacked = join(cache, "cante2midi");
const argv = process.argv.slice(2);
const ei = argv.indexOf("--every"), EVERY = ei >= 0 ? Number(argv[ei + 1]) : 4;
const inputs = argv.filter((a, i) => !a.startsWith("--") && (ei < 0 || i !== ei + 1));
if (!inputs.length && !existsSync(unpacked)) {
  console.error("Give the zips of cante2midi (f0, groundTruth, automaticTranscription) or folders with their files.");
  process.exit(1);
}
mkdirSync(unpacked, { recursive: true });
for (const p of inputs) {
  if (p.endsWith(".zip")) execFileSync("unzip", ["-oq", p, "-d", join(unpacked, basename(p, ".zip"))], { stdio: "inherit" });
  else execFileSync("cp", ["-r", p, join(unpacked, basename(p))]);
}
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "__MACOSX" ? [] : walk(p)) : [p]; });
const files = walk(unpacked);
const piece = (f) => basename(f).replace(/\.(f0\.csv|notes\.csv|notes)$/, "");
const byPiece = {};
for (const f of files) {
  const kind = f.endsWith(".f0.csv") ? "f0" : f.endsWith(".notes.csv") ? "auto" : f.endsWith(".notes") ? "truth" : null;
  if (kind) (byPiece[piece(f)] ||= {})[kind] = f;
}
const rows = (f) => readFileSync(f, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(",").map((x) => Number(x.trim())));
const r3 = (x) => Math.round(x * 1000) / 1000;
const notes = (f) => rows(f).filter((r) => r.length >= 3 && r.every((x) => !isNaN(x))).map(([on, dur, midi]) => [r3(on), r3(dur), midi]);

const out = [];
for (const name of Object.keys(byPiece).sort()) {
  const p = byPiece[name];
  if (!p.f0 || !p.truth) { console.log("(skipped", name, "— no", !p.f0 ? "f0" : "manual transcription", ")"); continue; }
  const fr = rows(p.f0).filter((r) => r.length >= 2 && !isNaN(r[0]) && !isNaN(r[1]));
  const kept = fr.filter((_, i) => i % EVERY === 0);
  const dt = kept.length > 1 ? (kept[kept.length - 1][0] - kept[0][0]) / (kept.length - 1) : 0;
  out.push(`{:id "cante2midi/${name.replace(/"/g, "")}" :source :cante2midi\n :truth ${JSON.stringify(notes(p.truth)).replace(/,/g, " ")}\n :auto ${p.auto ? JSON.stringify(notes(p.auto)).replace(/,/g, " ") : "nil"}\n :f0 [${kept[0][0].toFixed(6)} ${dt.toFixed(6)} [${kept.map(([, hz]) => (hz > 0 ? Math.round(hz * 100) / 100 : 0)).join(" ")}]]}`);
}
writeFileSync(join(cache, "cante2midi.edn"), "[" + out.join("\n") + "]\n");
console.log(`${out.length} cantes → ${join(cache, "cante2midi.edn")} (${(statSync(join(cache, "cante2midi.edn")).size / 1e6).toFixed(1)} MB)`);
