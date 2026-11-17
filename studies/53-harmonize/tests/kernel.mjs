// SPDX-License-Identifier: MPL-2.0
// Study 53 · harmonize: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/53-harmonize/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { harmonize, harmonizeAll, innerVoices, chordsOf, melodyUnits, keyOf, MELODIES } from "../kairotic/harmonize.mjs";
import { patchOf, runPatch, BOXES } from "../kairotic/agent.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const mod = (a, m) => ((a % m) + m) % m;

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // the melody
  const C = keyOf({ tonic: "C" });
  is("a melody: a note a unit, '-' holding the one before", melodyUnits("C5 - G5", C).length === 3 && melodyUnits("C5 - G5", C)[1] === melodyUnits("C5 - G5", C)[0]);

  // the bass under each melody: the futures counted, a bass drawn uniformly and one by the engine are sound
  for (const [id, m] of Object.entries(MELODIES)) {
    const H = harmonize(m), n = H.count();
    is(`${id}: basses under it, counted (${n})`, n > 0n);
    const U = H.sample(rng(1)), E = H.engine({ temp: 0.5, r: rng(2) });
    is(`${id}: a bass drawn uniformly is sound, and one of them`, U && !H.judge(U) && H.count(U) === 1n);
    is(`${id}: the engine's bass is sound`, E && !H.judge(E));
    const deg = (b) => mod(b >> 1, 7);
    is(`${id}: it begins on ① and ends ⑤–① (struck)`, deg(E[0]) === 0 && deg(E[n === 0n ? 0 : H.n - 2]) === 4 && deg(E[H.n - 1]) === 0 && E[H.n - 1] !== E[H.n - 2]
       || (m.cadences || []).some((c) => c.at === H.n - 1 && c.kind === "half") && deg(E[H.n - 1]) === 4);
    notes.push(`${id}: ${n} basses under the melody; the engine's: ${E.map(H.name).join(" ")}`);
  }

  // the rules, one by one
  const H = harmonize(MELODIES["ah-vous-dirai-je"]);
  const c = H.code;
  is("the bass does not begin elsewhere than on ①", /begins on ①/.test(H.check([], 0, c("E3")) || ""));
  const Hl = harmonize({ melody: "C4 D4 C4", key: { tonic: "C" } });
  is("no bass above the melody, nor a unison with it", /unison/.test(Hl.check([], 0, Hl.code("C4")) || ""));
  is("parallel octaves with the melody refused", /parallel octaves/.test(H.check([c("C3"), c("C3")], 2, c("G3")) || ""));
  is("a 4th under a struck melody on a strong unit, not prepared, refused", /prepared/.test(H.check([c("C3"), c("C3")], 2, c("D3")) || ""));
  const E0 = H.engine({ temp: 0.5, r: rng(4) });
  is("the unit before a perfect cadence: only ⑤ is left to the bass", H.fan(E0.slice(0, 13)).filter((x) => !x.reason).every((x) => mod(x.note >> 1, 7) === 4)
     && H.codes.some((b) => /before a perfect cadence/.test(H.check(E0.slice(0, 13), 13, b) || "")));
  is("a perfect cadence arrives on ①, from ⑤", /arrives on ①/.test(H.check([...Array(13).fill(c("C3")), c("G2")], 14, c("E3")) || ""));
  const Hb = harmonize(MELODIES["ah-vous-dirai-je-b"]);
  is("a half cadence rests on ⑤", /rests on ⑤/.test(Hb.check(Array(6).fill(Hb.code("C3")), 6, Hb.code("B2")) || ""));
  const Hm = harmonize(MELODIES["minor-period"]);
  is("melodic minor in the bass: F♯ going down refused", Hm.check([Hm.code("A2"), Hm.code("A2"), Hm.code("A2"), Hm.code("A2"), Hm.code("G2"), Hm.code("F#2")], 6, Hm.code("E2")) !== null);

  // the chords and the inner voices
  for (const [id, m] of Object.entries(MELODIES)) {
    const r = harmonizeAll(m, { r: rng(3) });
    is(`${id}: four parts${r.error ? " — " + r.error : ""}`, !r.error);
    if (r.error) continue;
    const { soprano, alto, tenor, bass } = r.parts, D = (x) => x >> 1;
    is(`${id}: the voices in order (S > A > T > B), each within an octave of the one above`, soprano.every((s, t) => D(s) > D(alto[t]) && D(alto[t]) > D(tenor[t]) && D(tenor[t]) > D(bass[t]) && D(s) - D(alto[t]) <= 7 && D(alto[t]) - D(tenor[t]) <= 7));
    is(`${id}: every chord has its third`, r.chords.every((ch, t) => [soprano[t], alto[t], tenor[t], bass[t]].some((x) => mod(D(x), 7) === mod(ch.root + 2, 7))));
    const inner = innerVoices(r.H, bass);
    is(`${id}: the inner voices without parallels where a way exists (${inner.parallels.length} kept)`, inner.parallels.length === 0);
    is(`${id}: a tree for the score`, /^\[:piece/.test(r.tree) && r.tree.includes(':name "lower"'));
  }
  const r1 = harmonizeAll(MELODIES["ah-vous-dirai-je"], { temp: 0.2, r: rng(1) });
  is("the cadential 6/4: I6/4 over ⑤ before V, at the end of the theme", r1.chords.some((ch) => ch.fig === "6/4"));
  is("chords: a melody tone of neither triad keeps the chord before over a held bass", (() => {
    const Hx = harmonize({ melody: "C5 D5 E5", key: { tonic: "C" } });
    const ch = chordsOf(Hx, [Hx.code("C3"), Hx.code("C3"), Hx.code("C3")]);
    return ch[1] === ch[0];
  })());

  // the agent's patches: the boxes, wired, make the same four parts
  const P = patchOf(`{:boxes {:m {:box :melody :args {:example "ah-vous-dirai-je"}}
                              :b {:box :bass :args {:temp 0.2 :seed 1}}
                              :i {:box :inner}
                              :t {:box :tree}}
                      :wires [[:m :b] [:b :i] [:i :t]]}`);
  const out = await runPatch(P);
  is("a patch of the agent's boxes runs: melody → bass → inner → tree", !out.error && /^\[:piece/.test(out.values.t));
  is("... and makes the same four parts as harmonizeAll", out.values.i.parts.bass.join() === r1.parts.bass.join());
  const bad = await runPatch(patchOf(`{:boxes {:m {:box :melody} :x {:box :nope}} :wires [[:m :x]]}`));
  is("a patch with a box that does not exist is refused, naming it", /nope/.test(bad.error || ""));
  const code = await runPatch(patchOf(`{:boxes {:m {:box :melody :args {:example "ah-vous-dirai-je"}}
                                                :up {:box :code :args {:js "return {...input, melody: input.melody.split(' ').map(x => x === '-' ? x : x.replace('5', '6')).join(' ')}"}}
                                                :b {:box :bass :args {:seed 1}}}
                                        :wires [[:m :up] [:up :b]]}`));
  is("a code box (JavaScript) Claude writes runs between two boxes", !code.error && /C6/.test(code.values.up.melody));
  is("the boxes are documented for Claude", Object.values(BOXES).every((b) => b.doc && b.inlets !== undefined));

  return { results, notes };
}

export function report({ results, notes }) {
  let bad = 0;
  for (const [what, ok] of results) { if (!ok) bad++; console.log((ok ? "✓ " : "✗ ") + what); }
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad}/${results.length}`);
  return bad ? 1 : 0;
}
