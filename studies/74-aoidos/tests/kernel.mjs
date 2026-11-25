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

  // ─── the melody, a beat at a time ───
  const counts = {};
  for (const id of ["odyssey", "iliad", "seikilos", "stele"]) for (const strict of [false, true]) {
    const t = TEXTS[id], A = aoidos({ text: t.text, metre: t.metre, key: t.key, strict });
    counts[id + (strict ? "/strict" : "")] = A.count();
  }
  const O = TEXTS.odyssey, A1 = aoidos({ text: O.text, metre: O.metre, key: O.key, melisma: 1 });
  is("the melodies counted exactly: Odyssey 1.1, a note a syllable (a circumflex one or two), 9838366916296; up to three a syllable, 135750965863333805; strict, 3972124968366906",
     A1.count() === 9838366916296n && counts.odyssey === 135750965863333805n && counts["odyssey/strict"] === 3972124968366906n);
  is("... Iliad 1.1–2, Seikilos's song, Seikilos's distich: the same counts as when they were pinned, strict always fewer",
     counts.iliad === 98258012225665708323973475676566373n && counts["iliad/strict"] === 6544294955928588393410734168492n &&
     counts.seikilos === 52757259759741367847053356546230301n && counts["seikilos/strict"] === 4347075043436625556698248236523n &&
     counts.stele === 111737324044788942016617210354618n && counts["stele/strict"] === 50428265663625438974521346670n);
  notes.push(`melodies: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);

  const A = aoidos({ text: O.text, metre: O.metre, key: O.key });
  const r = rng(73);
  let okAll = true, mels = 0;
  for (let i = 0; i < 10; i++) {
    const U = A.sample(r), N = U && A.notesOf(U), P = U && A.pitchesOf(U);
    if (!U || A.judge(U) || A.deg(U[U.length - 1]) % 7 !== 0 || P.some((ps) => ps.length > 3) || N[0].at !== 0) okAll = false;
    else mels += A.melismas(U);
  }
  is("any valid melody keeps the hard rules, ends on the final, three notes a syllable at most", okAll);
  is("... and a note a syllable when asked (melisma 1): only a circumflex may take two",
     (() => { for (let i = 0; i < 10; i++) { const U = A1.sample(r); if (A1.pitchesOf(U).some((ps, s) => ps.length > (A1.syllables[s].accent === "circumflex" ? 2 : 1))) return false; } return true; })());
  const As = aoidos({ text: O.text, metre: O.metre, key: O.key, strict: true });
  let strictOk = true;
  for (let i = 0; i < 10; i++) {
    const U = As.sample(r), R = As.accentReport(U), P = As.pitchesOf(U);
    if (R.peak[0] !== R.peak[1] || As.syllables.some((y, s) => y.accent === "circumflex" && P[s].some((x, k) => k > 0 && x > P[s][k - 1]))) strictOk = false;
  }
  is("strict: every melody keeps the peak, and no circumflex rises", strictOk);
  // the engine follows the accent; a uniform draw does not
  const share = (draw, n) => { const k = { a: [0, 0], f: [0, 0] }; for (let i = 0; i < n; i++) { const R = A.accentReport(draw()); for (const [id, x] of [["acute-rise", "a"], ["after-accent", "f"]]) { k[x][0] += R[id][0]; k[x][1] += R[id][1]; } } return { a: k.a[0] / k.a[1], f: k.f[0] / k.f[1] }; };
  const eng = share(() => A.engine({ temp: 0.5, r }), 30), uni = share(() => A.sample(r), 30);
  is("the engine sings the accent: the voice rises to the acute and falls after it more often than in a uniform draw", eng.a > uni.a + 0.1 && eng.f > uni.f + 0.1);
  notes.push(`rises to the acute: engine ${Math.round(100 * eng.a)}%, uniform ${Math.round(100 * uni.a)}%; falls after it: engine ${Math.round(100 * eng.f)}%, uniform ${Math.round(100 * uni.f)}%`);

  // ─── imitation ───
  const U0 = A.engine({ temp: 0, r });
  const E = examine(A, U0, { degrees: [1, 0.6, 0.3], ks: [-7], ds: [4], ms: 1500 });
  const at = (deg) => E.find((e) => e.imitation === deg).comes;
  is("the examiner: the engine's melody (temperature 0) tried as a dux an octave below a foot later — no strict canon, but imitation by its motion (0.3)",
     at(1) === 0n && at(0.3) > 0n && E[0].comes > 0n);
  notes.push(`the engine's melody as a dux: canon ${at(1)}, near ${at(0.6)}, by motion ${at(0.3)}`);
  const withComes = E.find((e) => e.comes > 0n);
  is("... and its comes can be heard: both voices a value a unit, as long as each other, the dux struck where its notes begin",
     withComes.sound && withComes.sound.dux.length === withComes.sound.comes.length && withComes.sound.duxStruck.filter(Boolean).length === A.notesOf(U0).length && withComes.sound.comes.slice(0, 4).every((m) => m === null));
  const C1 = canonic({ text: O.text, metre: O.metre, key: O.key, strict: true, melisma: 1, k: -7, d: 4 });
  is("in canon (the dux sings the text, the comes an octave below a foot later), a note a syllable, strict: 7823 canons", C1.count() === 7823n);
  is("... at two beats none: a long note held against the comes's move", canonic({ text: O.text, metre: O.metre, key: O.key, strict: true, melisma: 1, k: -7, d: 2 }).count() === 0n);
  const C3 = canonic({ text: O.text, metre: O.metre, key: O.key, strict: true, k: -7, d: 2 });
  is("... but with melismas the dux moves within its long syllables, and two beats are possible: 1934946", C3.count() === 1934946n);
  const Wc = C1.engine({ temp: 0.4, r }), R = C1.A.accentReport(Wc.dux);
  is("... a canon of the engine: valid, the comes the dux an octave below four beats later, every syllable a new pitch",
     C1.judge(Wc.dux, Wc.comes) === null && Wc.comes.every((c, t) => t < 4 ? c === null : C1.world.deg(c) === C1.world.deg(Wc.dux[t - 4]) - 7)
     && C1.A.syllables.every((y) => y.at === 0 || Wc.dux[y.at] !== Wc.dux[y.at - 1]));
  is("... and its dux keeps the accent's peak (strict)", R.peak[0] === R.peak[1]);
  const S = TEXTS.seikilos, Cs = canonic({ text: S.text, metre: S.metre, key: S.key, strict: true, melisma: 1 });
  is("Seikilos's song in canon, in its own rhythm, strict, a note a syllable, E dorian: 175807", Cs.count() === 175807n);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
