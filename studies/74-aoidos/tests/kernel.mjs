// SPDX-License-Identifier: MPL-2.0
// Study 74 · aoidos: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/74-aoidos/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { readText, scan, scansionText, timeOf, wordSyllables } from "../kairotic/prosody.mjs";
import { aoidos, canonic, aulos, examine, TEXTS } from "../kairotic/aoidos.mjs";

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
  {
    // the text under the notes (export.mjs's <verse><syl>): a melody with melismas
    let U = null; for (let i = 0; i < 40 && !U; i++) { const x = A.sample(r); if (x && A.melismas(x) > 0) U = x; }
    const L = U && A.lyricNotesOf(U), sung = L ? L.filter((x) => x.text) : [];
    const wp = sung.slice(0, 9).map((x) => `${x.text}:${x.wordpos || "-"}`).join(" ");
    is("the text sung: each syllable on the first note of its melisma, the others none; its place in its word (ἄν-δρα μοι ἔν-νε-πε Μοῦ-σα)",
       !!U && sung.length === A.syllables.length && sung.map((x) => x.text).join("") === A.syllables.map((y) => y.text).join("")
       && L.length > sung.length && L.every((x) => !!x.text === !!x.first)
       && wp === "ἄν:i δρα:t μοι:- ἔν:i νε:m πε:t Μοῦ:i σα:t πο:i");
    if (U) notes.push(`lyrics: ${wp} … (${L.length} notes, ${sung.length} syllables)`);
  }
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
  // ─── the aulos ───
  const H = aulos({ text: O.text, metre: O.metre, key: O.key, melisma: 1 });
  is("with an aulos in heterophony (at once, within a 3rd, the counterpoint's rules between them): Odyssey 1.1, a note a syllable, 465209704599378834", H.count() === 465209704599378834n);
  const Wh = H.engine({ temp: 0.5, r });
  is("... the engine's: valid, the aulos within a 3rd of the voice at every beat, often on its note",
     H.judge(Wh.dux, Wh.comes) === null && Wh.comes.every((c, t) => Math.abs(H.world.deg(c) - H.world.deg(Wh.dux[t])) <= 2) && Wh.comes.some((c, t) => c === Wh.dux[t]));
  const Dr = aulos({ text: O.text, metre: O.metre, key: O.key, practice: "drone" }), Ud = Dr.engine({ temp: 0.5, r });
  const Sk = TEXTS.seikilos, Is = aulos({ text: Sk.text, metre: Sk.metre, key: Sk.key, practice: "ison" }), Ui = Is.engine({ temp: 0.5, r }), I = Is.comesOf(Ui);
  is("... as a drone the final an octave below; as an ison each line held on the note it ends on, below the voice",
     Dr.comesOf(Ud).every((c) => Dr.deg(c) === -7) && [...new Set(Is.syllables.map((y) => y.line))].every((li) => {
       const ys = Is.syllables.filter((y) => y.line === li), end = ys[ys.length - 1].at + ys[ys.length - 1].beats;
       const held = I.slice(ys[0].at, end);
       return held.every((c) => c === held[0]) && ((Is.deg(held[0]) - Is.deg(Ui[end - 1])) % 7 + 7) % 7 === 0 && Is.deg(held[0]) < 0;
     }));
  is("the canon in the Greek style (its weights the dux's, its rules the canon's): 7823, as in the engine's", canonic({ text: O.text, metre: O.metre, key: O.key, strict: true, melisma: 1, style: "greek" }).count() === 7823n);
  // in a Greek system (greek.mjs): the degrees by place, the accent by pitch, the sound in cents
  const Gs = { text: Sk.text, metre: Sk.metre, system: Sk.system, final: Sk.final };
  const GA = aoidos(Gs), GU = GA.engine({ temp: 0 });
  is("in a Greek system: Seikilos's song in the Iastian tonos, diatonic, its final e the lichanos meson — 45,786,887,676,467,977,169,702,651,733,325,568,672 melodies on its eleven notes (d to f♯'), the engine's ending on e (329.63 Hz)",
     GA.count() === 45786887676467977169702651733325568672n && GA.codes.length === 11 && GA.name(GU.at(-1)) === "e" && Math.abs(GA.hz(GU.at(-1)) - 329.63) < 0.01 && GA.judge(GU) === null);
  const Ody = (system) => aoidos({ text: O.text, metre: O.metre, system, final: 0, melisma: 1 }).count();
  is("... Odyssey 1.1 a note a syllable in the Lydian, its final the mese: diatonic 57,609,870,580,663; chromatic 2,844,577,477,911,816 (its lichanos a step below the mese, a minor 3rd away); enharmonic, in Archytas's ratios, 1,330,881,641,079,072",
     Ody({ tonos: "lydian", genera: ["diatonic"] }) === 57609870580663n && Ody({ tonos: "lydian", genera: ["chromatic"] }) === 2844577477911816n
     && Ody({ tonos: "lydian", genera: ["enharmonic"], shade: "archytas" }) === 1330881641079072n);
  const Gd = aulos({ ...Gs, practice: "drone" });
  is("... the aulos's drone on the final where the system has no octave below it (the Iastian's lowest note is f♯)", Gd.name(Gd.comesOf(GU)[0]) === "e");
  // the Greek counterpoint (GREEK_ON): concords only the unison, 4th, 5th and octave; parallel concords allowed
  const Lyd = { text: O.text, metre: O.metre, system: { tonos: "lydian", genera: ["diatonic"] }, final: 0, melisma: 1 };
  is("the Greek counterpoint: Odyssey 1.1 in canon in the Lydian, the comes an octave below a foot later, a note a syllable — 2,215 strict canons, 310,795 free (in a church mode, 7,823 and 948,547)",
     canonic({ ...Lyd, strict: true }).count() === 2215n && canonic(Lyd).count() === 310795n);
  const GH = aulos({ ...Lyd, practice: "heterophony", style: "greek" });
  let gr = 7; const rg = () => { gr = (gr * 16807) % 2147483647; return gr / 2147483647; };
  let gUni = 0, gTot = 0, gDisc = 0, gStrong = true;
  for (let i = 0; i < 20; i++) {
    const E = GH.engine({ temp: 0.5, r: rg });
    for (let t = 0; t < E.dux.length; t++) { const q = GH.A.S.concord(E.dux[t], E.comes[t]); gTot++; if (q === "unison") gUni++; if (!q) { gDisc++; if (GH.world.strong(t)) gStrong = false; } }
  }
  is("... the aulos in heterophony, within a 4th: 14,338,522,811,655,342,992 ways; as the engine plays it, mostly in unison with the voice (more than 70%), a discord only passing on a weak beat, every strong beat a concord",
     GH.count() === 14338522811655342992n && gUni / gTot > 0.7 && gDisc > 0 && gStrong);
  notes.push(`Greek heterophony, 20 engine's: ${gUni} of ${gTot} beats in unison, ${gDisc} discords (all on weak beats)`);
  const GE = examine(GA, GU, { degrees: [1, 0.6], ms: 600 });
  is("... and the examiner in a Greek tonos: the melody tried as the dux of imitation-2 by the Greek counterpoint, its comes in the same system",
     GE.length === 16 && GE.every((e) => e.comes !== undefined) && GE.filter((e) => e.engine).every((e) => e.sound && e.sound.comes.some((m) => m !== null)));
  // the ison as a bass: the voice over the drone, and the voice and an ison written together
  const OverG = aulos({ ...Lyd, melisma: 3, practice: "over" }), OverC = aulos({ text: O.text, metre: O.metre, key: O.key, practice: "over" });
  const UO = OverG.engine({ temp: 0.5, r: rg });
  is("the voice over the drone (the final an octave below): Odyssey 1.1 in the Lydian, 19,691,663,393,233 melodies of the 1,744,451,647,718,654,456; in E dorian 22,588,545,252,607; every strong beat a concord with it",
     OverG.count() === 19691663393233n && OverC.count() === 22588545252607n && UO.every((c, t) => !OverG.strongAt(t) || OverG.S.concord(c, OverG.pedal)));
  const BS = aulos({ text: Sk.text, metre: Sk.metre, system: Sk.system, final: Sk.final, practice: "bass", style: "greek" });
  const BE = BS.engine({ temp: 0.7, r: rg }), starts = new Set(BS.A.syllables.filter((y, i) => i === 0 || BS.A.syllables[i - 1].line !== y.line).map((y) => y.at));
  is("the ison as a bass: Seikilos in the Iastian, Greek style, the voice and the ison written together — 7,680,200,566,319,157,400,963,234,687,687 ways; the ison changes only where a line begins, on a fixed note or the final, ends on the final (e), below the voice, every strong beat a concord",
     BS.count() === 7680200566319157400963234687687n && BS.judge(BE.dux, BE.comes) === null
     && BE.comes.every((c, t) => t === 0 || starts.has(t) || c === BE.comes[t - 1]) && BS.name(BE.comes.at(-1)) === "e"
     && BE.comes.every((c, t) => BS.midi(c) <= BS.midi(BE.dux[t])) && BE.dux.every((c, t) => !BS.A.strongAt(t) || BS.A.S.concord(c, BE.comes[t])));
  notes.push("the ison as a bass, Seikilos: " + BE.comes.filter((c, t) => t === 0 || c !== BE.comes[t - 1]).map((c) => BS.name(c)).join(" → "));
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
