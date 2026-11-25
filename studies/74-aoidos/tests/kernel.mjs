// SPDX-License-Identifier: MPL-2.0
// Study 74 · aoidos: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/74-aoidos/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { readText, scan, scansionText, timeOf, wordSyllables } from "../kairotic/prosody.mjs";
import { aoidos, canonic, examine, TEXTS } from "../kairotic/aoidos.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const line = (t) => readText(t)[0];
const syl = (w) => wordSyllables(w).map((s) => s.text).join("-");
const q = (t) => line(t).syllables.map((s) => s.quantity[0]).join("");

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // ─── prosody ───
  is("syllables: ἄν-δρα, πο-λύ-τρο-πον (a stop and a liquid begin the next), Πη-λη-ϊ-ά-δε-ω (the diaeresis parts ηϊ), Ἀ-χαι-οῖς (a diphthong)",
     syl("ἄνδρα") === "ἄν-δρα" && syl("πολύτροπον") === "πο-λύ-τρο-πον" && syl("Πηληϊάδεω") === "Πη-λη-ϊ-ά-δε-ω" && syl("Ἀχαιοῖς") === "Ἀ-χαι-οῖς");
  const od = line("ἄνδρα μοι ἔννεπε, Μοῦσα, πολύτροπον, ὃς μάλα πολλὰ").syllables;
  is("quantity: ἄν long by position, μοι before a vowel doubtful (epic correption), Μοῦ long (a circumflex), λύ before τρ common",
     od[0].quantity === "long" && od[2].correption && od[2].quantity === "doubtful" && od[6].quantity === "long" && od[9].position === "common");
  const ol = line("πρὸς ὀλίγον").syllables;
  is("the laws of the accent: ὀλίγον's acute on a doubtful penult before a short last vowel: λί short", ol[2].text === "λί" && ol[2].quantity === "short" && !!ol[2].law);
  is("accents read: ζῇς circumflex (and long by its iota subscript), δὲν grave, φαί acute",
     (() => { const s = line("Ὅσον ζῇς φαίνου μηδὲν").syllables; return s[2].accent === "circumflex" && s[2].nature === "long" && s[3].accent === "acute" && s[6].accent === "grave"; })());
  const il = scan(line("μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος"), "hexameter");
  is("Iliad 1.1 scans as Homer's line: – ⏑ ⏑ | – ⏑ ⏑ | – – | – ⏑ ⏑ | – ⏑ ⏑ | – ⏑, -δεω one long syllable (synizesis)",
     il.ok && scansionText(il) === "– ⏑ ⏑ | – ⏑ ⏑ | – – | – ⏑ ⏑ | – ⏑ ⏑ | – ⏑" && il.units.some((u) => u.synizesis));
  const ody = scan(line("ἄνδρα μοι ἔννεπε, Μοῦσα, πολύτροπον, ὃς μάλα πολλὰ"), "hexameter");
  is("Odyssey 1.1: five dactyls and a spondee, λύ long by position (common, settled by the metre)", ody.ok && scansionText(ody) === "– ⏑ ⏑ | – ⏑ ⏑ | – ⏑ ⏑ | – ⏑ ⏑ | – ⏑ ⏑ | – –");
  is("Iliad 1.2: οὐλομένην, ἣ μυρί’ Ἀχαιοῖς ἄλγε’ ἔθηκε — two elisions, – ⏑ ⏑ | – – | – ⏑ ⏑ | – – | – ⏑ ⏑ | – ⏑",
     scansionText(scan(line("οὐλομένην, ἣ μυρί’ Ἀχαιοῖς ἄλγε’ ἔθηκε"), "hexameter")) === "– ⏑ ⏑ | – – | – ⏑ ⏑ | – – | – ⏑ ⏑ | – ⏑");
  const pen = scan(line("μνήμης ἀθανάτου σῆμα πολυχρόνιον."), "pentameter");
  is("the stele's pentameter: μνήμης ἀθανάτου σῆμα πολυχρόνιον", pen.ok && scansionText(pen) === "– – | – ⏑ ⏑ | – | – ⏑ ⏑ | – ⏑ ⏑ | ⏑");
  is("a line that does not scan says so", !scan(line("ὅσον ζῇς φαίνου"), "hexameter").ok);
  const T = timeOf(line("ἄνδρα μοι ἔννεπε, Μοῦσα, πολύτροπον, ὃς μάλα πολλὰ"), ody);
  is("the time: a long two beats, a short one, every foot four, the thesis strong; the line 24 beats",
     T.reduce((a, u) => a + u.beats, 0) === 24 && T.filter((u) => u.strong).length === 6 && T.every((u) => u.beats === (u.q === "long" ? 2 : 1)));
  const sk = readText(TEXTS.seikilos.text).map((l) => timeOf(l, scan(l, "free")));
  is("Seikilos, free: each line's last syllable held one beat longer, to an even bar (φαίνου's νου three beats: a triseme)",
     sk.length === 4 && sk[0][sk[0].length - 1].beats === 3 && sk.every((L) => L.reduce((a, u) => a + u.beats, 0) % 2 === 0));

  // ─── the melody ───
  const counts = {};
  for (const id of ["odyssey", "iliad", "seikilos", "stele"]) for (const strict of [false, true]) {
    const t = TEXTS[id], A = aoidos({ text: t.text, metre: t.metre, key: t.key, strict });
    counts[id + (strict ? "/strict" : "")] = A.count();
  }
  is("the melodies counted exactly: Odyssey 1.1, 11362047911977; strict (the peak and the circumflex hard), 157525198582",
     counts.odyssey === 11362047911977n && counts["odyssey/strict"] === 157525198582n);
  is("... Iliad 1.1–2, Seikilos's song, Seikilos's distich: the same counts as when they were pinned, strict always fewer",
     counts.iliad === 76193894516030340618831606n && counts["iliad/strict"] === 7830014576611333749156n &&
     counts.seikilos === 12030033595000660744092898n && counts["seikilos/strict"] === 5102027822327224988529n &&
     counts.stele === 47348559582470248882371n && counts["stele/strict"] === 28308794420499260125n);
  notes.push(`melodies: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);

  const O = TEXTS.odyssey, A = aoidos({ text: O.text, metre: O.metre, key: O.key });
  is("a note a syllable, two on a long circumflex (Μοῦ-σα: three notes), 18 for Odyssey 1.1", A.n === 18 && A.notes[6].accent === "circumflex" && A.notes[7].accent === "circumflex-tail");
  const r = rng(73);
  let okAll = true; for (let i = 0; i < 10; i++) { const U = A.sample(r); if (!U || A.judge(U) || A.deg(U[0]) === undefined || A.deg(U[U.length - 1]) % 7 !== 0) okAll = false; }
  is("any valid melody keeps the hard rules and ends on the final", okAll);
  const As = aoidos({ text: O.text, metre: O.metre, key: O.key, strict: true });
  let strictOk = true; for (let i = 0; i < 10; i++) { const U = As.sample(r); const R = As.accentReport(U); if (R.peak[0] !== R.peak[1] || R["circumflex-fall"][0] !== R["circumflex-fall"][1]) strictOk = false; }
  is("strict: every melody keeps the peak and the circumflex", strictOk);
  // the engine follows the accent; a uniform draw does not
  const share = (draw, n) => { const k = { a: [0, 0], f: [0, 0] }; for (let i = 0; i < n; i++) { const R = A.accentReport(draw()); for (const [id, x] of [["acute-rise", "a"], ["after-accent", "f"]]) { k[x][0] += R[id][0]; k[x][1] += R[id][1]; } } return { a: k.a[0] / k.a[1], f: k.f[0] / k.f[1] }; };
  const eng = share(() => A.engine({ temp: 0.5, r }), 30), uni = share(() => A.sample(r), 30);
  is("the engine sings the accent: the voice rises to the acute and falls after it far more often than in a uniform draw", eng.a > uni.a + 0.2 && eng.f > uni.f + 0.1);
  notes.push(`rises to the acute: engine ${Math.round(100 * eng.a)}%, uniform ${Math.round(100 * uni.a)}%; falls after it: engine ${Math.round(100 * eng.f)}%, uniform ${Math.round(100 * uni.f)}%`);

  // ─── imitation ───
  const U0 = A.engine({ temp: 0, r });
  const E = examine(A, U0, { degrees: [1, 0.6], ks: [-7], ds: [4], ms: 1500 });
  is("the examiner: a melody of the engine tried as a dux — no strict canon, but imitation near it (0.6)",
     E.find((e) => e.imitation === 1).comes === 0n && E.find((e) => e.imitation === 0.6).comes > 0n && E[0].imitation === 0.6);
  const near = E.find((e) => e.imitation === 0.6);
  is("... and its comes can be heard: both voices a value a unit, as long as each other, the dux struck where its syllables begin",
     near.sound && near.sound.dux.length === near.sound.comes.length && near.sound.duxStruck.filter(Boolean).length === A.n && near.sound.comes.slice(0, 4).every((m) => m === null));
  const C = canonic({ text: O.text, metre: O.metre, key: O.key, strict: true, k: -7, d: 4 });
  const cc = C.count();
  is("in canon (the dux sings the text, the comes an octave below a foot later): 4285 canons, strict", cc === 4285n);
  is("... at two beats none: a long note held against the comes's move", canonic({ text: O.text, metre: O.metre, key: O.key, k: -7, d: 2 }).count() === 0n);
  const Wc = C.engine({ temp: 0.4, r });
  const M = C.melody(Wc.dux), R = C.A.accentReport(M);
  is("... a canon of the engine: valid, the comes the dux an octave below four beats later, the longs held and every syllable a new note",
     C.judge(Wc.dux, Wc.comes) === null && Wc.comes.every((c, t) => t < 4 ? c === null : C.world.deg(c) === C.world.deg(Wc.dux[t - 4]) - 7)
     && C.struck.every((s, t) => t === 0 || (s ? Wc.dux[t] !== Wc.dux[t - 1] : Wc.dux[t] === Wc.dux[t - 1])) && M.length === C.notes.length);
  is("... and its dux keeps the accent (peak and circumflex, strict)", R.peak[0] === R.peak[1] && R["circumflex-fall"][0] === R["circumflex-fall"][1]);
  const S = TEXTS.seikilos, Cs = canonic({ text: S.text, metre: S.metre, key: S.key, strict: true });
  is("Seikilos's song in canon, strict, E dorian: 6522", Cs.count() === 6522n);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
