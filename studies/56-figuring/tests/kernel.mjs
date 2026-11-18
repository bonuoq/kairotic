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
  is("a melody over the scale down: a 7–6 chain, sound, one of the ways the bass allows", !S.judge(chain) && S.count(chain) === 1n && S.count() === 138459287n);
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
  is(`after six units of the chain: ${ways.join(", ")} ways to an imperfect, a perfect and a compound cadence`, ways.join() === "14153,21345,1107");
  is("... and the whole chain closes with a perfect one, the compound 7–6–8", S.cadenceWays(chain, cl[0]).map((w) => w.count).join() === "0,1,1");
  const R = figuring({ bass: BASSES.romanesca.degrees, key: { tonic: "C" }, per: 1 });
  is("the leaping Romanesca closes at its end, on ⑤–①: perfect, imperfect or compound (4–3), the deceptive ⑤–⑥ inside it not a close", R.closes().map((x) => x.kind).join() === "⑤–①" && R.closes()[0].options.map((o) => o.kind).join() === "perfect,imperfect,perfect,imperfect");

  // the ending: perfect or imperfect; deceptive or half only when asked, the bass's end made to fit
  const Rp = figuring({ bass: BASSES.romanesca.degrees, key: { tonic: "C" }, per: 2, ending: "perfect" }), Ri = figuring({ bass: BASSES.romanesca.degrees, key: { tonic: "C" }, per: 2, ending: "imperfect" });
  const Ra = figuring({ bass: BASSES.romanesca.degrees, key: { tonic: "C" }, per: 2 });
  is(`the Romanesca ends perfect (${Rp.count()}) or imperfect (${Ri.count()}): either of them by default (${Ra.count()})`, Rp.count() + Ri.count() === Ra.count());
  is("... the melody ends on the octave for a perfect cadence, the 3rd for an imperfect one", Rp.voice.check(Rp.engine({ temp: 0.5, r: rng(1) }).slice(0, -1), Rp.n - 1, Rp.voice.codes.find((c) => Rp.name(c) === "E5")) !== null);
  const Rd = figuring({ bass: BASSES.romanesca.degrees, key: { tonic: "C" }, per: 2, ending: "deceptive" }), Rh = figuring({ bass: BASSES.romanesca.degrees, key: { tonic: "C" }, per: 2, ending: "half" });
  is("a deceptive ending: the last ① becomes the ⑥ above ⑤ (G3 A3), its cadence ⑤–⑥", Rd.notes.slice(-2).map((x) => Rd.key.name(x.d)).join(" ") === "G3 A3" && Rd.closes()[0].kind === "⑤–⑥" && Rd.count() > 0n);
  is("a half ending: the phrase ends on ⑤ (G3)", Rh.notes.length === 8 && Rh.key.name(Rh.notes[7].d) === "G3" && Rh.closes()[0].kind === "⑤" && Rh.count() > 0n);
  is("... a deceptive or half ending over a bass that does not end ⑤–① is refused, and why", (() => { try { figuring({ bass: BASSES["scale-down"].degrees, ending: "deceptive" }); return false; } catch (e) { return /needs a bass ending ⑤–①/.test(e.message); } })());
  is("the engine's melodies end with a perfect or imperfect cadence, recognized", (() => {
    const rr = rng(8);
    for (const id of ["romanesca", "fifths", "monte", "cadence", "scale-down"]) for (let i = 0; i < 4; i++) {
      const F = figuring({ bass: BASSES[id].degrees, key: { tonic: "C" }, per: 2 }), U = F.engine({ temp: 0.5, r: rr });
      const last = F.schemataIn(U).filter((x) => x.to === F.n - 1);
      if (!last.some((x) => /perfect|imperfect|compound/.test(x.name))) { notes.push(`${id}: ${U.map(F.name).join(" ")} ends with ${last.map((x) => x.name).join(", ") || "no cadence recognized"}`); return false; }
    }
    return true;
  })());
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
  is("... written for three, B4 asked is corrected, and said why", (() => { const x = B.play([b("G4")], 71, { three: true }), y = B.play([b("G4")], 71); return !y.corrected && x.corrected && /no middle voice could be written under it/.test(x.reason); })());
  is("... its ways on in three parts: none after G4 B4, some after G4", B.threeWays(lt) === 0n && B.threeWays([b("G4")]) > 0n);

  // written for three: the melody and its figures chosen so that a middle voice can always be written from them
  const ft = S.figuresThree(chain);
  is(`the 7–6 chain written for three: its figures ${ft.map((f) => f.chord).join(" ")}, a middle voice from them`, S.middle(chain, ft.map((f) => f.chord)).count > 0n && ft.slice(2, 14).map((f) => f.chord).join(" ") === "7/3 6/3 ".repeat(6).trim());
  const draw3 = rng(33);
  for (const [id, bb] of Object.entries(BASSES)) for (const per of [1, 2]) {
    const F = figuring({ bass: bb.degrees, key: per === 1 ? { tonic: "A", mode: "minor" } : { tonic: "C" }, per });
    let ok = true;
    for (let i = 0; i < 3 && ok; i++) {
      const U = F.engineThree({ temp: 0.5, r: draw3 }), fs = F.figuresThree(U);
      const m = F.middle(U, fs.map((f) => f.chord), { r: draw3 });
      ok = U && !F.judge(U) && m.count > 0n && !m.judge && fs.every((f) => f.chord || f.q === "dissonant" || f.chords[0].chord === null);
    }
    is(`${bb.name} (${per === 1 ? "a beat a note, A minor" : "a bar a note, C major"}), written for three by the engine: sound, and a middle voice from its figures every time`, ok);
  }
  is("the cadence in three parts: the last chord a 5/3 (never a 6), the leading tone up to the tonic and the 7th (④) down to ③ in either upper voice", (() => {
    const rr = rng(21), mod = (a, m) => ((a % m) + m) % m;
    for (const id of ["cadence", "romanesca", "monte", "fifths"]) for (const key of [{ tonic: "C" }, { tonic: "A", mode: "minor" }]) for (const ending of ["authentic", "deceptive"]) {
      const F = figuring({ bass: BASSES[id].degrees, key, per: 2, ending });
      for (let i = 0; i < 4; i++) {
        const U = F.engineThree({ temp: 0.8, r: rr }), m = F.middle(U, F.figuresThree(U).map((f) => f.chord), { r: rr });
        if (!m.count || m.judge) return false;
        if (!/^(\(5\)\/3|5\/3)$/.test(m.chords[F.n - 1])) { notes.push(`${id} ${ending}: ends on ${m.chords[F.n - 1]}`); return false; }
        const t = F.n - 1;
        for (const V of [U, m.voice]) {
          const p = F.degree(V[t - 1]), x = F.degree(V[t]);
          if ((mod(p, 7) === 6 && x !== p + 1) || (mod(p, 7) === 3 && x !== p - 1)) { notes.push(`${id} ${ending}: ${F.name(V[t - 1])} → ${F.name(V[t])}`); return false; }
        }
      }
    }
    return true;
  })());
  is("written for three, the figures the player asks are kept where a middle voice can make them, else the likeliest that can", (() => {
    const t = 3, alt = ft[t].chords.find((c) => c.three && c.chord !== ft[t].chord);
    if (!alt) return true;
    const f2 = S.figuresThree(chain, { [t]: alt.chord });
    return f2[t].chord === alt.chord && S.middle(chain, f2.map((f) => f.chord)).count > 0n;
  })());
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
