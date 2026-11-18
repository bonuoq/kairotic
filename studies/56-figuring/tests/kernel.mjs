// SPDX-License-Identifier: MPL-2.0
// Study 56 · figuring: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/56-figuring/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { figuring, parseBass, unitsOf, BASSES, RULE_OF_THE_OCTAVE } from "../kairotic/figuring.mjs";
import { keyOf } from "../kairotic/partimento.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // the bass: note names in a key, a note a bar (the last one a unit), ⑥ and ⑦ raised in minor going up
  const C = keyOf({ tonic: "C" });
  const p = parseBass("C3 B2 A2", C);
  is("a bass of note names: degrees in the key (C3 is ①, B2 ⑦ below it); a note out of the key refused", p.notes.map((x) => x.d).join(",") === "0,-1,-2" && /H2 is not a note/.test(parseBass("C3 H2", C).error));
  const S = figuring({ bass: BASSES["scale-down"].degrees, key: { tonic: "C" }, per: 2 });
  is("the scale down a bar a note: 15 units, struck on the strong ones, the final one unit", S.n === 15 && S.units.filter((u) => u.struck).length === 8 && S.units.every((u, t) => u.strong === (t % 2 === 0)) && S.units[14].struck);
  const Am = figuring({ bass: BASSES["scale-up"].degrees, key: { tonic: "A", mode: "minor" }, per: 1 });
  is("the scale up in A minor: F♯ and G♯ in the bass, going up to the tonic", Am.units.map((u, t) => Am.bassName(t)).join(" ") === "A2 B2 C3 D3 E3 F♯3 G♯3 A3");
  is("the rule of the octave, as the partimento schools taught it: ④ a 6 going up, a 4/2 going down", RULE_OF_THE_OCTAVE.up[3] === "6" && RULE_OF_THE_OCTAVE.down[3] === "4/2" && RULE_OF_THE_OCTAVE.up.join() === "5/3,6/3,6/3,6,5/3,6/3,6/3");

  // a melody played: a 7–6 chain over the scale down, closing with a compound cadence
  const c = (n) => S.voice.codes.find((x) => S.name(x) === n);
  const chain = "E5 A5 A5 G5 G5 F5 F5 E5 E5 D5 D5 C5 C5 B4 C5".split(" ").map(c);
  is("a melody over the scale down: a 7–6 chain, sound, one of the ways the bass allows", !S.judge(chain) && S.count(chain) === 1n && S.count() === 234212709n);
  const figs = S.figuresOf(chain);
  is("its figures found: a 7/3 on each strong unit (the 7th held), a 6/3 on the weak one (resolved), 5/3 at the ends", figs.map((f) => f.chords[0].chord).join(" ") === "5/3 6/3 7/3 6/3 7/3 6/3 7/3 6/3 7/3 6/3 7/3 6/3 7/3 6/3 5/3");
  is("... the two-part intervals: 3, 6, then 7 6 7 6…, the octave at the end", figs.map((f) => f.two).join(" ") === "3 6 7 6 7 6 7 6 7 6 7 6 7 6 8");
  is("... why a 7/3: the melody's 7th held", /dissonance of a 7\/3, held/.test(figs[2].chords[0].why.join()) && figs[2].chords.length === 1);
  is("... why the 5/3 at the start: ① at the start, and the rule of the octave", /① at the start/.test(figs[0].chords[0].why.join()) && /rule of the octave/.test(figs[0].chords[0].why.join()));
  const found = S.schemataIn(chain).map((x) => `${x.name} ${x.from + 1}–${x.to + 1}`);
  is("its schemata recognized: a 7–6 chain (units 3–14) and the compound cadence 7–6–8 on ②–①", found.join(" | ") === "a 7–6 chain 3–14 | a compound cadence 7–6–8 13–15");
  is("a note passing on a weak unit has no chord of its own", (() => { const a = S.chordsAt([c("E5"), c("D5")], 1); return a.length === 1 && a[0].chord === null && /passing/.test(a[0].why[0]); })());

  // the notes played: taken, or corrected to the nearest that can be, and why
  is("a note of the key that can follow is taken (E5 over C4)", (() => { const x = S.play([], 76); return !x.corrected && S.name(x.note) === "E5"; })());
  is("a note out of the key corrected to the nearest (C♯5 → C5 or D5), and said why", (() => { const x = S.play([], 73); return x.corrected && /not a note of the key/.test(x.reason) && ["C5", "D5"].includes(S.name(x.note)); })());
  is("a note below the melody's range corrected, and said why", /range/.test(S.play([], 50).reason));
  is("a note the rules refuse corrected, with the rule: A5 struck over B3, a 7th not prepared → B5", (() => { const x = S.play([c("E5"), c("G5")], 81); return x.corrected && /must be prepared/.test(x.reason) && S.name(x.note) === "B5"; })());

  // the cadences: where the bass can close, and the ways the melody so far leaves to each kind there
  const cl = S.closes();
  is("the scale down closes on ②–① (units 13–15)", cl.length === 1 && cl[0].kind === "②–①" && cl[0].from === 12 && cl[0].at === 14);
  const ways = S.cadenceWays(chain.slice(0, 6), cl[0]).map((w) => w.count);
  is(`after six units of the chain: ${ways.join(", ")} ways to an imperfect, a perfect and a compound cadence`, ways.join() === "3804,10919,1107");
  is("... and the whole chain closes with the compound one only", S.cadenceWays(chain, cl[0]).map((w) => w.count).join() === "0,0,1");
  const R = figuring({ bass: BASSES.romanesca.degrees, key: { tonic: "C" }, per: 1 });
  is("the leaping Romanesca closes on ⑤–⑥ (deceptive) and ⑤–① at its end", R.closes().map((x) => x.kind).join() === "⑤–⑥,⑤–①");
  const closed = (() => { const k = S.cadenceWays(chain.slice(0, 6), cl[0])[0]; return k.voice.engine({ temp: 0.5, r: rng(5) }, chain.slice(0, 6)); })();
  is("... the engine closes it so: an imperfect cadence 3–3 found at the end, the melody sound", closed && !S.judge(closed) && S.schemataIn(closed).some((x) => /imperfect cadence 3–3/.test(x.name)));

  // a third voice from the figures found
  const m = S.middle(chain, figs.map((f) => f.chords[0].chord), { r: rng(3) });
  is(`a middle voice under the chain, asked the figures found: ${m.count} written, sound, its chords 7/3 6/3…`, m.count === 2n && !m.judge && m.chords.slice(2, 14).join(" ") === "7/3 6/3 ".repeat(6).trim());
  const B = figuring({ bass: BASSES["scale-down"].degrees, key: { tonic: "C" }, per: 1 });
  const b = (n) => B.voice.codes.find((x) => B.name(x) === n);
  const lt = [b("G4"), b("B4")];
  const lt2 = B.engine({ temp: 0 }, lt);
  const none = B.middle(lt2);
  is("a melody that doubles the bass's leading tone (B4 over B3) leaves no room for a middle voice: it stops there and says why", none.count === 0n && none.stops === 1 && none.why.includes("the leading tone doubled"));
  is("... room for a middle voice: after G4 yes, after B4 no", B.roomFor([b("G4")]) && !B.roomFor(lt));
  is("... leaving room for a third voice, B4 asked is corrected, and said why", (() => { const x = B.play([b("G4")], 71, { room: true }), y = B.play([b("G4")], 71); return !y.corrected && x.corrected && /no room left for a middle voice/.test(x.reason); })());
  is("any of the figures found, or none asked: at least as many middle voices as the figures chosen", (() => {
    const fs = S.figuresOf(chain);
    const a = S.middle(chain, fs.map((f) => f.chords[0].chord)).count, f = S.middle(chain, fs.map((f) => f.chords.map((x) => x.chord))).count, n = S.middle(chain).count;
    notes.push(`the 7–6 chain: ${a} middle voices with the figures found, ${f} with any of them, ${n} with none asked`);
    return a <= f && f <= n;
  })());

  // the engine's melodies: sound; their figures and a middle voice, where one can be written
  const draw = rng(56);
  for (const [id, bb] of Object.entries(BASSES)) for (const key of [{ tonic: "C" }, { tonic: "A", mode: "minor" }]) {
    const F = figuring({ bass: bb.degrees, key, per: 2 });
    let sound = 0, mid = 0;
    for (let i = 0; i < 4; i++) {
      const U = F.engine({ temp: 0.5, r: draw });
      if (U && !F.judge(U)) sound++;
      const M = F.middle(U, F.figuresOf(U).map((f) => f.chords.map((x) => x.chord)), { r: draw });
      if (M.count && !M.judge) mid++;
    }
    is(`${bb.name} in ${F.key.tonic} ${F.key.mode}: the engine's melodies sound`, sound === 4);
    notes.push(`${bb.name} in ${F.key.tonic} ${F.key.mode}: ${F.count()} melodies; ${mid} of 4 of the engine's admit a middle voice with the figures found`);
  }

  // transposed: the same counts in C and E♭ major, in A and G minor (the rules are tonal, not of a key)
  for (const [id, bb] of Object.entries(BASSES)) {
    const k = [{ tonic: "C" }, { tonic: "Eb" }, { tonic: "A", mode: "minor" }, { tonic: "G", mode: "minor" }].map((key) => figuring({ bass: bb.degrees, key, per: 2 }).count());
    is(`${id}: the same count in C and E♭ major (${k[0]}), in A and G minor (${k[2]})`, k[0] === k[1] && k[2] === k[3] && k[0] > 0n && k[2] > 0n);
  }
  is("unitsOf: a note a beat, all struck", unitsOf([{ d: 0, r: 0 }, { d: 4, r: 0 }, { d: 0, r: 0 }], C, 1).every((u) => u.struck));
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
