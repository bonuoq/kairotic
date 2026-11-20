// SPDX-License-Identifier: MPL-2.0
// The studies' export (discussion #319): studies/_shared/export.mjs, and its copies beside each study's kernel.
// In Node:  node tests/export.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as X from "../studies/_shared/export.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const is = (what, ok, detail) => { results.push([what, !!ok]); if (!ok && detail) console.log("     " + detail); };

const notes = X.fromUnits(["E5", "E5", "D5", "C5", null, "G4"]);
is("a name repeated is held; null a rest", JSON.stringify(notes) === JSON.stringify([{ name: "E5", units: 2 }, { name: "D5", units: 1 }, { name: "C5", units: 1 }, { name: null, units: 1 }, { name: "G4", units: 1 }]));
is("… or struck again where it says so", X.fromUnits(["C3", "C3", "C3"], [true, false, true]).map((n) => n.units).join() === "2,1");
const m = X.exportMei({ title: "A test", source: "test", key: { tonic: "G" }, voices: [
  { label: "upper", notes: [{ name: "F#5", units: 1 }, { name: "F#5", units: 1 }, { name: "F5", units: 1 }, { name: "E5", units: 3 }, { name: "D5", units: 1 }] },
  { label: "bass", notes: X.fromUnits(["G3", "G3", "D3", "D3", "C3", "C3", "G2"]) }],
  figures: [{ unit: 2, figs: ["6", "4"] }], marks: [{ unit: 4, text: "C major" }], doubleBars: [4], root: { schema: "test", count: 12n } });
is("one measure a bar of two units, the last one unit", (m.mei.match(/<measure /g) || []).length === 4 && /<measure n="4" right="end">/.test(m.mei));
is("a note across the bar line cut and tied (E5: 3 units)", /<note xml:id="v1n4" pname="e" oct="5" dur="2" tie="i"\/><\/layer>/.test(m.mei) && /<note xml:id="v1n5" pname="e" oct="5" dur="1" tie="t"\/>/.test(m.mei), m.mei);
is("accidentals for their bar: F♯ in G as sounding only, the F after it natural, written", /pname="f" oct="5" dur="2" accid.ges="s"/.test(m.mei) && /pname="f" oct="5" dur="2" accid="n"/.test(m.mei));
is("the key signature, the meter, the labels", /key.sig="1s" meter.count="2" meter.unit="2" meter.sym="cut"/.test(m.mei) && /label="upper" lines="5" clef.shape="G"/.test(m.mei) && /label="bass" lines="5" clef.shape="F"/.test(m.mei));
is("figures under the bass, a mark over the top staff, a double bar before a section", /<harm place="below" staff="2" tstamp="1"><fb><f>6<\/f><f>4<\/f><\/fb><\/harm>/.test(m.mei) && /<dir place="above" staff="1" tstamp="1"><rend fontstyle="italic">C major<\/rend><\/dir>/.test(m.mei) && /<measure n="2" right="dbl">/.test(m.mei));
is("the study's own attributes in the extMeta, as EDN", /<extMeta type="kairotic"><!\[CDATA\[\{:kairotic 1, :root-tag :par, :root \{:name "A test", :source "test", :key "G major", :made "\d{4}-\d\d-\d\d", :schema "test", :count 12\}\}\]\]><\/extMeta>/.test(m.mei));
is("a file name from the title", m.name === "a-test.mei" && X.fileName("Bach: tetrachords, D → G → C") === "bach-tetrachords-d-g-c.mei");
const q = X.exportMei({ title: "q", voices: [{ notes: [{ name: "D4", units: 1 }, { name: "E4", units: 3 }, { name: "F4", units: 2 }] }], unitDen: 4, unitsPerBar: 3, pickup: 1 });
is("quarter-note units, 3/4, an upbeat: the pickup measure, a dotted half", /meter.count="3" meter.unit="4"/.test(q.mei) && /<measure n="0" metcon="false">/.test(q.mei) && /pname="e" oct="4" dur="2" dots="1"/.test(q.mei));
is("EDN: keywords, strings, vectors, nil, bigints", X.edn({ a: 1, b: "x\"y", c: [1, null, true], d: { kw: "par" }, e: 3n }) === '{:a 1, :b "x\\"y", :c [1 nil true], :d :par, :e 3}');

// microtones, as the app writes them: a name (or the nearest), a quarter tone, the exact Hz in the extMeta
const mt = X.exportMei({ title: "micro", voices: [{ notes: [{ name: "E4", midi: 63.86, units: 1 }, { midi: 60.5, units: 1 }, { midi: 70.42, units: 2 }, { name: "D4", units: 1 }] }] });
is("a note off 12-TET (meantone E, −14 cents) written E4, its Hz kept for it", /xml:id="v1n1" pname="e" oct="4"/.test(mt.mei) && /"v1n1" \{:hz 326\.97\d\}/.test(mt.mei), mt.mei);
is("… a quarter tone above C4: C with a quarter-tone sharp (1qs), its Hz kept", /xml:id="v1n2" pname="c" oct="4" dur="2" accid="1qs"/.test(mt.mei) && /"v1n2" \{:hz 269\.\d+\}/.test(mt.mei));
is("… a pitch with no name (31-EDO's B♭⁷, 70.42: A♯ and 42 cents): A three-quarter-tone sharp (3qs), its Hz kept; a 12-TET note keeps no Hz", /xml:id="v1n3" pname="a" oct="4" dur="1" accid="3qs"/.test(mt.mei) && /"v1n3" \{:hz 4\d\d\.\d+\}/.test(mt.mei) && !/"v1n4" \{/.test(mt.mei));
is("… the notes map, keyed by xml:id, beside the root, as kairotic.mei reads it", /, :notes \{"v1n1" \{:hz /.test(mt.mei));
is("held pitches with their midi: one note", X.fromUnits([{ name: "E4", midi: 63.86 }, { name: "E4", midi: 63.86 }, { midi: 60.5 }]).map((n) => n.units).join() === "2,1");

// tuplets: a unit a third of a half note (unitDen 6), as a hemiola needs it
const tu = X.exportMei({ title: "hemiola", voices: [
  { label: "dux", notes: [{ name: "D4", units: 3 }, { name: "E4", units: 3 }, { name: "F4", units: 6 }] },
  { label: "comes", notes: [{ name: "A3", units: 2 }, { name: "B3", units: 2 }, { name: "C4", units: 2 }, { name: "D4", units: 3 }, { name: "C4", units: 3 }] }], unitDen: 6, unitsPerBar: 6, meter: [2, 2] });
const bar1 = tu.mei.slice(tu.mei.indexOf('<measure n="1"'), tu.mei.indexOf('<measure n="2"'));
is("tuplets: a bar of thirds of a half note in one tuplet 3:2, its notes as half notes (the comes in a hemiola)", /<staff n="2"><layer n="1"><tuplet xml:id="v2t0" num="3" numbase="2"[^>]*><note[^>]*pname="a" oct="3" dur="2"\/><note[^>]*pname="b" oct="3" dur="2"\/><note[^>]*pname="c" oct="4" dur="2"\/><\/tuplet>/.test(bar1), bar1);
is("… a bar whose notes fall on whole halves written plainly (the dux)", /<staff n="1"><layer n="1"><note[^>]*pname="d" oct="4" dur="2"\/><note[^>]*pname="e" oct="4" dur="2"\/><\/layer>/.test(bar1));
is("… a bar of halves in a voice that needs no tuplet there: plain (the comes, bar 2)", /<staff n="2"><layer n="1"><note[^>]*pname="d" oct="4" dur="2"\/><note[^>]*pname="c" oct="4" dur="2"\/><\/layer>/.test(tu.mei));

// the copies, beside each study's kernel
const original = readFileSync(join(root, "studies/_shared/export.mjs"), "utf8");
const copies = readdirSync(join(root, "studies")).filter((s) => existsSync(join(root, "studies", s, "kairotic/export.mjs")));
is(`the studies' copies are the original (${copies.join(", ")})`, copies.length >= 1 && copies.every((s) => readFileSync(join(root, "studies", s, "kairotic/export.mjs"), "utf8") === original), copies.filter((s) => readFileSync(join(root, "studies", s, "kairotic/export.mjs"), "utf8") !== original).join(" "));

const bad = results.filter((r) => !r[1]);
for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
console.log(`${results.length - bad.length} / ${results.length} passed`);
process.exit(bad.length ? 1 : 0);
