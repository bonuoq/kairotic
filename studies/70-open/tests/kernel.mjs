// SPDX-License-Identifier: MPL-2.0
// Study 70 · open form: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/70-open/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as O from "../kairotic/open.mjs";
import { ELEVEN } from "../kairotic/works.mjs";

const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

// a performance played and heard: each note, with probability, missed, a little wrong, or followed by one added
function hear(notes, r, { wrong = 0, miss = 0, extra = 0 } = {}) {
  const out = [];
  for (const n of notes) {
    const x = r();
    if (x < miss) continue;
    let m = n.midi;
    if (x < miss + wrong) m += (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2));
    out.push({ midi: m });
    if (r() < extra) out.push({ midi: m + (r() < 0.5 ? 2 : -3) });
  }
  return out;
}

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const w = ELEVEN;

  // ─── the form ───
  is("any fragment first", O.choices(w, []).length === 10);
  is("a fragment's rules: F never followed by F or G, H never by itself", !O.choices(w, ["F"]).includes("F") && !O.choices(w, ["F"]).includes("G") && !O.choices(w, ["H"]).includes("H"));
  is("… C followed only by rhythms at most 6 swaps from its own (a necklace's distance)",
     O.choices(w, ["C"]).every((id) => O.rhythmDistance(O.fragOf(w, "C"), O.fragOf(w, id)) <= 6) && O.choices(w, ["C"]).length < 10);
  is("the performance ends when a fragment comes a third time", O.done(w, ["A", "B", "A", "C", "A"]) && !O.done(w, ["A", "B", "A", "C"]) && O.choices(w, ["A", "B", "A", "C", "A"]).length === 0);
  is("swap distance: a rhythm and its rotation 0, the tresillo and the son clave's first bar 2",
     O.swapDistance([0, 3, 6, 8, 11, 14], [0, 3, 5, 8, 11, 14].map((x) => (x + 4) % 16)) === 1 && O.swapDistance([0, 3, 6, 10, 12], [0, 3, 6, 10, 12].map((x) => (x + 5) % 16)) === 0 && O.swapDistance([0, 3, 6, 9, 12], [0, 3, 6, 10, 12]) === 1);
  const r = rng(7), drawn = Array.from({ length: 50 }, () => O.draw(w, r));
  is("every performance drawn is legal and has ended", drawn.every((p) => O.legal(w, p) && O.done(w, p)));
  is("an illegal path is refused", !O.legal(w, ["F", "G"]) && !O.legal(w, ["A", "A", "A", "B"]));
  const n8 = O.countPerformances(w, 8);
  notes.push(`performances of at most 8 fragments: ${n8.toLocaleString("en")}`);
  is("the futuribles of the form: millions of performances of at most 8 fragments, every one counted (of 3, a fragment three times: not F or H)", n8 > 1e6 && O.countPerformances(w, 3) === 8);

  // ─── playing a path ───
  const R = O.realize(w, ["A", "I", "A"]);
  const segA2 = R.segments[2];
  is("a path played: its fragments one after the other, each with what the one before left (after I: slower, ppp, legato)",
     R.segments.length === 3 && R.notes.length === 6 + 2 + 6 && segA2.tempo === 0.75 && segA2.dyn === "ppp" && segA2.touch === "legato" &&
     Math.abs((segA2.end - segA2.on) / (R.segments[0].end - R.segments[0].on) - 4 / 3) < 1e-9);
  is("… the first with the work's indications, the second with A's (faster, pp)", R.segments[0].dyn === "mf" && R.segments[1].tempo === 1.5 && R.segments[1].dyn === "pp");

  // ─── following ───
  const rr = rng(3);
  let exact = 0, dF = 0, dD = 0, len = 0, decided = [];
  for (let t = 0; t < 60; t++) {
    const p = O.draw(w, rr), h = hear(O.realize(w, p).notes, rr);
    const f = O.follow(w, h);
    if (f.path.join() === p.join()) exact++;
    decided.push(...f.decisions.map((d) => d.after));
  }
  decided.sort((a, b) => a - b);
  is("followed, played as written: every fragment recognised, after 2 notes (the median)", exact === 60 && decided[decided.length >> 1] <= 3);
  for (let t = 0; t < 60; t++) {
    const p = O.draw(w, rr), h = hear(O.realize(w, p).notes, rr, { wrong: 0.08, miss: 0.05, extra: 0.03 });
    dF += O.pathDistance(O.follow(w, h).path, p); dD += O.pathDistance(O.decode(w, h).path, p); len += p.length;
  }
  notes.push(`with 8 % wrong, 5 % missed and 3 % added notes: followed ${(100 * dF / len).toFixed(1)} % of fragments off, read again ${(100 * dD / len).toFixed(1)} %`);
  is("… with wrong, missed and added notes, live: under 8 % of the fragments off", dF / len < 0.08);
  is("… and read again once it is over (decode), fewer: under 3 %", dD / len < 0.03 && dD <= dF);
  const two = O.recognize(w, ["A"], [57, 65]), four = O.recognize(w, ["A"], [57, 65, 78, 49]);
  is("recognised among the candidates: H and J begin alike (J an octave higher); after two notes H likelier, after four all but sure",
     two[0].id === "H" && two[1].id === "J" && two[0].p > 0.6 && two[0].p < 0.95 && four[0].id === "H" && four[0].p > 0.95);

  // ─── the performances as branches ───
  const B = O.branches([["A", "B", "C"], ["A", "B", "D"], ["E"]]);
  is("performances as branches: a common beginning one branch (A B, then C or D), another start another",
     B.children.length === 2 && B.children[0].n === 2 && B.children[0].children[0].children.length === 2);
  is("the distance between two performances: fragments to change, add or leave out", O.pathDistance(["A", "B", "C"], ["A", "C"]) === 1 && O.pathDistance(["A", "B"], ["B", "A"]) === 2);
  is("how far each step travelled: the rhythmic distance between fragments", O.curve(w, ["A", "B", "A"]).length === 2 && O.curve(w, ["A", "B"])[0] === O.rhythmDistance(O.fragOf(w, "A"), O.fragOf(w, "B")));

  // ─── in a tree ───
  const edn = O.toEdn(w);
  is("the work as a tree: [:open {:start :any :end {:repeat 3}} [:frag {:id :A …} notes…] …]",
     edn.startsWith('[:open {:name "Eleven cells" :start :any :end {:repeat 3}}') && (edn.match(/\[:frag /g) || []).length === 10 &&
     edn.includes(":id :F :not #{:F :G}") && edn.includes(":near 6") && edn.includes(':then {:tempo 0.75 :dyn "ppp" :touch "legato"}'));
  return { results, notes };
}

export function report({ results, notes }) {
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const s of notes) console.log("  · " + s);
  const bad = results.filter((r) => !r[1]).length;
  console.log(`${results.length - bad} / ${results.length}`);
  return bad ? 1 : 0;
}
