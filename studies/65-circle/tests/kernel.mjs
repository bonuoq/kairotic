// SPDX-License-Identifier: MPL-2.0
// Study 65 · circle: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/65-circle/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { circle, PHRASES } from "../kairotic/circle.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const VOICES = ["soprano", "alto", "tenor"];
const PINNED = { "vii-minor": 211043n, "vii-major": 4794n, meyer: 53n, fifths: 5147n, "fifths-53": 49708n, "fifths-minor": 4216n,
                 "thirds-seconds": 392n, "thirds-seconds-minor": 19302n, "tied-bass": 16359770n, "tied-bass-minor": 14077321n,
                 "descending-thirds": 18176n, "descending-thirds-minor": 25957n, folia: 572n };

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const r = rng(65);
  const cls = (P, W, t) => VOICES.map((v, i) => P.voices[i].vertical(t, W[v][t]).cls);
  const every = (P, n, f) => { for (let i = 0; i < n; i++) { const W = P.sample(r); if (!W || !f(W)) return false; } return true; };

  // the counts, pinned; the same in another key
  const counts = {};
  for (const id of Object.keys(PHRASES)) counts[id] = circle({ phrase: id }).count();
  notes.push(Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · "));
  is("every phrase realizable, the counts pinned", Object.entries(PINNED).every(([k, v]) => counts[k] === v));
  for (const [id, tonic] of [["vii-minor", "D"], ["fifths", "F"], ["descending-thirds-minor", "E"], ["folia", "D"]])
    is(`${PHRASES[id].name} in ${tonic}: the same count (${counts[id]})`, circle({ phrase: id, key: { tonic } }).count() === counts[id]);

  // 7.1 the diminished 7th family
  const VM = circle({ phrase: "vii-minor" });
  const dimUnits = [1, 3, 5, 7, 9];
  is("vii° in minor: the 7/5/3 on ⑦♯, the 6/5/3 on ②, the 6/4/3 on ④, the 6/4/2 on ⑥ — every one complete, its G♯ raised (30 drawn)",
     every(VM, 30, (W) => dimUnits.every((t) => VOICES.some((v) => VM.name(W[v][t]).startsWith("G♯")) || VM.units[t].r === 1)));
  is("... the diminished 7th (F) goes down a half step, to E, in the voice that has it (30 drawn)",
     every(VM, 30, (W) => dimUnits.every((t) => VOICES.every((v) => !VM.name(W[v][t]).startsWith("F") || VM.name(W[v][t + 1]).startsWith("E")))));
  is("... free to enter: in some realization its 7th comes without being held (unprepared, as the dominant's)",
     (() => { for (let i = 0; i < 60; i++) { const W = VM.sample(r); if (dimUnits.some((t) => VOICES.some((v) => VM.name(W[v][t]).startsWith("F") && W[v][t - 1] !== W[v][t]))) return true; } return false; })());
  const asDiatonic = (() => { const P = circle({ phrase: "vii-minor", style: { extends: "chorale-4", between: [["seventh", {}]] } }); return P.count(); })();
  is("... a style that names it so changes nothing: the family is the engine's (chorale-4 1.1.0)", asDiatonic === counts["vii-minor"]);
  const VMa = circle({ phrase: "vii-major" });
  is("vii° in major with the lowered ⑥ (A♭ in C): A♭ in every diminished chord, going down to G (30 drawn)",
     every(VMa, 30, (W) => [1, 3].every((t) => VOICES.some((v) => VMa.name(W[v][t]).startsWith("A♭") && VMa.name(W[v][t + 1]).startsWith("G")))));
  const MY = circle({ phrase: "meyer" });
  is("the Meyer (ex. 7.4b): the diminished 6/5/3 on ② and the dominant's on ⑦♯ — B♭ in the first, C♯ in the second", every(MY, 20, (W) =>
     VOICES.some((v) => MY.name(W[v][1]).startsWith("B♭")) && VOICES.some((v) => MY.name(W[v][1]).startsWith("C♯")) && VOICES.some((v) => MY.name(W[v][2]).startsWith("A"))));

  // 7.2 the circle of fifths
  const FI = circle({ phrase: "fifths" });
  is("Fifth Down Fourth Up (ex. 7.12a): every 7th prepared — held from the chord before in the same voice — and going down by step (30 drawn)",
     every(FI, 30, (W) => [1, 2, 3, 4, 5].every((t) => VOICES.every((v, i) => FI.voices[i].vertical(t, W[v][t]).cls !== 6 || (W[v][t - 1] === W[v][t] && FI.degree(W[v][t + 1]) === FI.degree(W[v][t]) - 1)))));
  const E = FI.engine({ temp: 0, r });
  is("... the engine's: 7ths complete and incomplete (the 5th left out, the bass doubled)", (() => {
    const kinds = [1, 2, 3, 4, 5, 6].map((t) => cls(FI, E, t).includes(4) ? "complete" : "incomplete");
    notes.push("fifths, the engine: " + kinds.join(" "));
    return kinds.includes("complete") && kinds.includes("incomplete");
  })());
  const FM = circle({ phrase: "fifths-minor" });
  is("... in minor (ex. 7.12c): the natural ⑦ (G) in the sequence, G♯ only over ⑤ at the end (30 drawn)", every(FM, 30, (W) =>
     [1, 2, 3, 4, 5].every((t) => VOICES.every((v) => !FM.name(W[v][t]).startsWith("G♯"))) && VOICES.some((v) => FM.name(W[v][6]).startsWith("G♯"))));
  const F5 = circle({ phrase: "fifths-53" });
  is("... with 5/3s (ex. 7.12b): every chord complete or with its bass doubled — the diminished triad on ⑦ taken for the sequence's sake, its F down to E", every(F5, 30, (W) =>
     VOICES.every((v) => !F5.name(W[v][2]).startsWith("F") || F5.name(W[v][3]).startsWith("E"))));
  const TS = circle({ phrase: "thirds-seconds" });
  is("Third Down Second Up (ex. 7.16a): each 6/5's 5th (the chord's 7th) prepared and resolved down (30 drawn)", every(TS, 30, (W) =>
     [1, 3, 5].every((t) => VOICES.every((v, i) => TS.voices[i].vertical(t, W[v][t]).cls !== 4 || (W[v][t - 1] === W[v][t] && TS.degree(W[v][t + 1]) === TS.degree(W[v][t]) - 1)))));
  const TSm = circle({ phrase: "thirds-seconds-minor" });
  is("... in minor (ex. 7.16b): 6/3s, and the leading tone only in the penultimate chord (30 drawn)", every(TSm, 30, (W) =>
     [0, 1, 2, 3, 4, 5].every((t) => VOICES.every((v) => !TSm.name(W[v][t]).startsWith("G♯")))));

  // 7.3 the Tied Bass
  const TB = circle({ phrase: "tied-bass" });
  is("the Tied Bass (ex. 7.20a): over each tied note a 6/4/2, complete — the bass its 7th, resolved down — then a 6/3 (30 drawn)", every(TB, 30, (W) => {
    const ch = TB.chords(W);
    return [2, 4, 6, 8].every((t) => ch[t] === "6/4/2" && !TB.units[t].struck && TB.units[t + 1].d === TB.units[t].d - 1) && [3, 5, 7, 9].every((t) => ch[t] === "6/3");
  }));
  const TBm = circle({ phrase: "tied-bass-minor" });
  is("... in minor (ex. 7.20b): the natural scale until the 6/4♯/2 on ④ (G♯), which leaves the sequence (30 drawn)", every(TBm, 30, (W) =>
     [0, 1, 2, 3, 4, 5, 6, 7].every((t) => VOICES.every((v) => !TBm.name(W[v][t]).startsWith("G♯"))) && VOICES.some((v) => TBm.name(W[v][8]).startsWith("G♯"))));

  // 7.4 descending thirds
  const DT = circle({ phrase: "descending-thirds" });
  is("Descending Thirds (ex. 7.26a): a 5/3 on ①, ⑥, ④, ② — two tones shared with the chord before (the engine's)", (() => {
    const W = DT.engine({ temp: 0, r }), pcs = (t) => new Set(VOICES.map((v) => DT.name(W[v][t]).replace(/-?\d+$/, "")).concat(DT.K.name(DT.units[t].d, 0).replace(/-?\d+$/, "")));
    return [1, 2, 3].every((t) => [...pcs(t)].filter((x) => pcs(t - 1).has(x)).length >= 2);
  })());
  const DM = circle({ phrase: "descending-thirds-minor" });
  is("... in minor (ex. 7.26b): the Neapolitan B♭ in the bass, a major 5/3 over it (D, F); then the diminished 7th on G♯, its F down to E (30 drawn)", every(DM, 30, (W) =>
     DM.K.name(DM.units[3].d, DM.units[3].r).startsWith("B♭") && VOICES.every((v) => !/^B\d/.test(DM.name(W[v][3]))) &&
     VOICES.every((v) => !DM.name(W[v][4]).startsWith("F") || DM.name(W[v][5]).startsWith("E"))));

  // 7.5 the Folia
  const FO = circle({ phrase: "folia" });
  is("the modulating Folia (ex. 7.31): A minor, C major, E minor — a third higher each", [0, 1, 2, 3, 4, 5, 6].map((t) => FO.keyName(t)).join(", ") ===
     "A minor, A minor, C major, C major, C major, E minor, E minor");
  is("... ⑥–⑤ a whole tone in C major (A–G), and in E minor ⑤ major, its D♯ (20 drawn)", every(FO, 20, (W) => VOICES.some((v) => FO.name(W[v][5]).startsWith("D♯"))) &&
     FO.K.semi(FO.units[2].d, 0) - FO.K.semi(FO.units[3].d, 0) === 2);

  // the engine
  for (const id of Object.keys(PHRASES)) {
    const P = circle({ phrase: id });
    let ok = true;
    for (let i = 0; i < 2 && ok; i++) { const W = P.engine({ temp: 0.5, r }); ok = W && !P.judge(W); }
    is(`${PHRASES[id].name}: the engine's realizations sound`, ok);
  }
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
