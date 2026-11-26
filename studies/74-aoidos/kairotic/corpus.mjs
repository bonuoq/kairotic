// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 74 · aoidos: the corpus of the late branch — the melodies that follow the word's pitch accent — read
// sign by sign from E. Pöhlmann and M. L. West, Documents of Ancient Greek Music (Oxford 2001): Mesomedes's hymns (nos.
// 24, 25, 27, 28; Second century AD) and Seikilos's song (no. 23, seikilos.mjs). Only the melodies (ancient) and the
// edition's readings of their signs are kept here, with where they come from; the edition's pages are not.
//
// A line is written as its words, a space between them, a syllable "text=SIGNS" and a hyphen between syllables:
// each sign a letter of the vocal notation and its time in chronoi (a melisma several), "*" a note the editors supply
// (⟨I⟩, a note repeated where a copyist lost one, a half-line filled from another line). Mesomedes's signs are a
// segment of the Lydian scale (DAGM p. 109): ⌐ e, R f, Φ g, C a, P b♭, M c', I d', Z e', E f', Ʊ g', and an
// enharmonic N c♯' (from the chromatic Hypolydian). `reliable: false` marks where N alone carries the notation (27.13
// on, and no. 28): the edition advises not to rely on it for the accent (DAGM p. 114).
//
// The Delphic paean of Athenaios (no. 20, 128/7 BC) is older and a stone's: its signs survive where the stone does,
// and are written only where the note changes; it is kept as the edition transcribes it (DAGM pp. 63–67), a note as
// its pitch ("eb'2": e♭' for two chronoi; c' the c an octave above middle c, as Mesomedes's M; absolute, the
// transcription's key signatures applied), checked against the signs where they survive. Only the stretches with
// their notes are kept, each a fragment of its own (`fragments`): "…" a syllable lost at a word's edge, "*" a note
// the editors supply (a sign lost, or doubtful). A vowel written twice (Φοι-οῖ-βον, the stone's way with a melisma) is
// one syllable with its notes.

export const LYDIAN = { "⌐": 64, R: 65, Φ: 67, C: 69, P: 70, M: 72, N: 73, I: 74, Z: 76, E: 77, Ʊ: 79 };

const L = (n, text, o = {}) => ({ n, text, ...o });
export const MESOMEDES = [
  { id: "muse", name: "Mesomedes(?), Invocation of the Muse", ref: "DAGM no. 24", lines: [
    L(1, "Ἄ=C1-ει=Z2-δε=Z1 Μοῦ=Φ2-σά=Φ1 μοι=Φ2 φί=C1-λη=C2"),
    L(2, "μολ=C2*-πῆς=C2* δ'ἐ=I1*-μῆς=I2 κατ=Φ1-ἀρ=M2-χου=M3"),
    L(3, "αὔ=Z2-ρη=Z2 δὲ=Z1 σῶν=E1Z1 ἀπ'=N1 ἀλ=N2-σέ=I1-ων=I2"),
    L(4, "ἐ=M1-μὰς=Z1N1 φρέ=I1-νας=Φ1C1 δο=P1-νεί=M1-τω=Φ1C2"),
  ] },
  { id: "calliope", name: "Mesomedes, Invocation of Calliope and Apollo", ref: "DAGM no. 25", lines: [
    L(5, "Καλ=C2-λι=P1-ό=M1-πει=P2-α=C1 σο=Φ1-φά=C2"),
    L(6, "Μου=Φ2-σῶν=N1C1 προ=C1-καθ=C1-α=C2-γέ=C1-τι=⌐1 τερ=R2-πνῶν=Φ2"),
    L(7, "καὶ=R2 σο=Φ1-φὲ=C1 μυσ=P2-το=M1-δό=I1-τα=M2"),
    L(8, "Λα=M2-τοῦς=I2 γό=E1-νε=Z1 Δή=I2-λι=M1-ε=P1 Παι=C2-άν=M1I1"),
    L(9, "εὐ=M2-με=I1-νεῖς=Z1M1 πάρ=I1-εσ=Φ2-τέ=C1 μοι=C3"),
  ] },
  { id: "sun", name: "Mesomedes, Hymn to the Sun", ref: "DAGM no. 27", lines: [
    L(7, "Χι=C1-ο=C1-νοβ=C2-λε=C1-φά=I1-ρου=C2 πά=P1-τερ=C1 Ἀ=Φ3-οῦς=C2"),
    L(8, "ῥο=Φ1-δό=M1-εσ=M2-σαν=M1 ὃς=M1 ἄν=I2-τυ=C1-γα=Φ1 πώ=M1I2-λων=M2"),
    L(9, "πτα=M2-νοῖς=I1M1 ὑπ'=I1 ἴχ=I1-νεσ=P2-σι=M1 δι=I1-ώ=Z3-κεις=Z2"),
    L(10, "χρυ=M2-σέαι=Z1M1-σιν=Z1 ἀ=I1-γαλ=M2-λό=I1*-με=I1-νος=M2 κό=Z1-μαις=I2"),
    L(11, "πε=M1-ρὶ=I1 νῶ=Z2-τον=I1 ἀ=M1-πεί=I2-ρι=P1-τον=Φ1 οὐ=C2-ρα=P1-νοῦ=P1C1"),
    L(12, "ἀκ=C1P1-τῖ=M2-να=C1 πο=M1-λύσ=M2-τρο=M1-φον=M1 ἀμ=M2-πλέ=I1-κων=M2"),
    L(13, "αἴγ=I2-λας=M2 πο=P1-λυ=M1-δερ=I2-κέ=Z1-α=I1 πά=M1P2-γαν=P1C1", { reliable: false }),
    L(14, "πε=C1-ρὶ=P1 γαῖ=M2-αν=M1 ἅ=M1-πα=C2-σαν=R1 ἑ=Φ1-λίσ=M3-σων=M2", { reliable: false }),
    L(15, "πο=M1-τα=I1-μοὶ=Z2 δὲ=Z1 σέ=Z1-θεν=Z2* πυ=Z1-ρὸς=E1 ἀμ=I2-βρό=E1-του=Z2", { reliable: false }),
    L(16, "τίκ=P2-του=M2-σιν=I1 ἐ=Z1-πή=Z2-ρα=I1-τον=M1 ἀ=P2-μέ=I1*-ραν=C2", { reliable: false }),
    L(17, "σοὶ=C2 μὲν=Φ2 χο=C1-ρὸς=P1 εὔ=M2-δι=M1-ος=M1 ἀσ=P2-τέ=P1-ρων=C2", { reliable: false }),
    L(18, "κατ'=M1 Ὄ=I1-λυμ=M2-πον=M1 ἄ=I1-νακ=P2-τα=M1 χο=I1-ρεύ=Z3-ει=Z2", { reliable: false }),
    L(19, "ἄν=Z1-ε=Z1-τον=M2 μέ=Z1-λος=Z1 αἰ=M2-ὲν=Z1 ἀ=I1-εί=E3-δων=Z2", { reliable: false }),
    L(20, "Φοι=M2-βη=I2-ί=Z1-δι=Z1 τερ=M2-πό=I1-με=P1-νος=Φ2 λύ=Z1-ραι=Z2", { reliable: false }),
    L(21, "γλαυ=C1P1-κὰ=M2 δὲ=M1 πάρ=M1-οι=C2-θε=P1 Σε=M1-λά=M1I2-να=M2", { reliable: false }),
    L(22, "χρό=I1-νον=M1 ὥ=I2-ρι=M1-ον=M1 ἀ=P2-γε=M1-μο=I1-νεύ=Z3-ει=Z2", { reliable: false }),
    L(23, "λευ=M1I1-κῶν=Z2 ὑ=I1-πὸ=M1 σύρ=I2-μα=Φ1-σι=C1 μόσ=P1M1P1-χων=C2", { reliable: false }),
    L(24, "γά=C1-νυ=C1-ται=C2 δέ=C1 τέ=C1 σοι=C2 νό=P1-ος=C1 εὐ=P1Φ1-με=P1-νὴς=M2", { reliable: false }),
    L(25, "πο=M1-λυ=I1-εί=Z2-μο=I1-να=M1 κόσ=I2-μον=Φ1 ἑ=C1-λίσ=P1M1P1-σων=C2", { reliable: false }),
  ] },
  { id: "nemesis", name: "Mesomedes, Hymn to Nemesis", ref: "DAGM no. 28", reliable: false, lines: [
    L(1, "Νέ=I1-με=M1-σι=M2 πτε=M1-ρό=I1-εσ=M2-σα=M1 βί=I1-ου=C2 ῥο=P1-πά=M2"),
    L(2, "κυ=Φ1-αν=M1-ῶ=Z2-πι=Z1 θε=Z1-ά=Z2 θύ=E1-γα=Z1-τερ=I2 Δί=Z1-κας=M2"),
    L(3, "ἃ=M2 κοῦ=Ʊ2-φα=Ʊ1 φρυ=Ʊ1-άγ=Ʊ2-μα=E1-τα=Z1 θνα=E3-τῶν=Ʊ2"),
    L(4, "ἐπ=Ʊ1-έχ=Ʊ1-εις=M2 ἀ=I1-δά=Ʊ1-μαν=Z2-τι=E1 χα=I1-λι=M3-νῶι=I1*M1"),
    L(5, "ἔχ=M2-θου=M2-σα=M1 δ'ὕβ=M1-ριν=M2 ὀ=M1-λο=M1-ὰν=M2 βρο=C1-τῶν=M1Φ1"),
    L(6, "μέ=P1-λα=C1-να=Φ2 φθό=P1-νον=P1 ἐκ=M2*-τὸς=I1* ἐ=P1*-λαύ=M3*-νεις=M2*"),
    L(7, "ὑ=R1-πὸ=Φ1 σὸν=C2 τρο=Φ1-χὸν=I1* ἄσ=I2-τα=C1-τον=Φ1 ἀσ=P2-τι=M1-βῆ=I2"),
    L(8, "χα=Z1-ρο=E1-πὰ=Ʊ2 με=Z1-ρό=Z1*-πων=I2 στρέ=I1-φε=I1*-ται=M2 τύ=Z1-χα=M2"),
    L(9, "λή=M2-θου=M2-σα=M1 δὲ=M1 πὰρ=M2 πό=M1-δα=P1 βαί=M1C2-νεις=C1Φ1"),
    // (West's R R for με-νον, as the transcription has it; N gives P P)
    L(10, "γαυ=R2-ρού=Φ2-με=R1-νον=R1 αὐ=M2-χέ=I1-να=P1 κλί=M3-νεις=M2"),
    L(11, "ὑ=R1-πὸ=Φ1 πῆ=P2-χυν=C1 ἀ=Φ1-εὶ=P2 βί=P1-ο=C1-τον=P2 μετ=M1-ρεῖς=I2"),
    L(12, "νεύ=Ʊ2-εις=M2 δ'ὑ=I1-πὸ=Z1 κόλ=E2-πον=I1 ὀ=M1-φρῦν=M2 ἀ=Φ1-εὶ=M2"),
    L(13, "ζυ=Φ1-γὸν=M2 με=M1-τὰ=M1 χεῖ=P2-ρα=C1 κρα=M1-τοῦ=I3-σα=I1"),
    L(14, "ἵ=E2-λη=E2-θι=E1 μά=E1-και=Z2-ρα=Z1 δι=I1-κασ=M2-πό=I1-λε=P1"),
    L(15, "Νέ=E1-με=E1-σι=E2 πτε=Z1-ρό=Z1-εσ=I2-σα=M1 βί=I1-ου=I2 ῥο=Z1-πά=M2"),
    L(16, "Νέ=I1-με=M1-σιν=M2 θε=M1-ὸν=M1 ἄι=I2-δο=M1-μεν=C1 ἀφ=P2-θί=M1-ταν=M2"),
    L(17, "Νί=Z2-κην=M2 τα=I1-νυ=Z1-σίπ=E2-τε=I1-ρον=I1 ὀβ=M2-ρί=Z1-μαν=M2"),
    L(18, "νη=M2-μερ=M2-τέ=Ʊ1-α=Ʊ1 καὶ=Ʊ2 πάρ=Ʊ1-εδ=Z1-ρον=E2 Δί=Ʊ1-κας=M2"),
    L(19, "ἃ=P2 τὰν=M2 με=M1-γα=M1-λα=M2-νο=C1-ρί=I1*-αν=M2 βρο=P1-τῶν=M2"),
    // (all but the first note lost: the melody of line 8, as the edition restores it)
    L(20, "νε=Z1-με=E1*-σῶ=Ʊ2*-σα=Z1* φέ=Z1*-ρεις=I2* κα=I1*-τὰ=I1* Ταρ=M2*-τά=Z1*-ρου=M2*"),
  ] },
];

const A = (n, text) => ({ n, text });
export const DELPHIC = [
  { id: "athenaios", name: "Athenaios, Paean and hyporchema to the god", ref: "DAGM no. 20", notation: "pitch", fragments: true, lines: [
    // col. i, lines 1–8 (three flats)
    A(1, "βα=c'1-θύ=d'1-δεν=d'1-δρον=c'2 αἳ=ab1 λά=c'2-…"),
    A(2, "…-βρό=eb'1-μου=d'1c'1 θύ=d'1-γα=c'1-τρες=ab1 εὐ=c'2-ώ=c'2-…"),
    A(3, "μό=eb'1-λε=d'1*-τε=db'1* συν=eb'1-όμ=eb'1-αι=d'2-μον=c'1 ἵ=d'1-να=d'1 Φοῖ=d'1c'1-βον=ab1 ᾠ=c'2-δαῖ=c'1ab1-σι=ab1 "
       + "μέλ=c'2-ψη=eb2-τε=eb1 χρυ=g2-σε=g1-ο=ab1-κό=ab1-μαν=eb2 ὃς=eb'1 ἀ=eb'1-νὰ=eb'1 δι=g'1-κό=ab'1-ρυμ=g'2-βα=eb'1 "
       + "Παρ=g'2-νασ=g'2-σί=g'1-δος=eb'2 τᾶσ=eb'1c'1*-δε=c'1 πε=eb'1-τέ=eb'1-ρας=d'2 ἕ=d'1-δρα=c'1-ν'ἅμ'=ab1"),
    A(6, "…-γα=ab1-κλυ=c'1-ταῖς=c'1ab1 Δελ=c'1d'1-φί=eb'1-σιν=d'1eb'1 Κα=f'2-στα=g'1-λί=ab'1-δος=f'1 εὐ=f'1g'1-ύ=ab'1-δρου=g'2 "
       + "νά=g'2-ματ'=eb'1 ἐ=f'1-πι=f'1-νί=f'2-σε=db'1-ται=db'2 Δελ=c'2-φὸν=c'1 ἀ=c'1-νὰ=c'1 πρῶ=c'1ab1-να=ab1 "
       + "μαν=c'1d'1-τεῖ=eb'1d'1-ον=c'1 ἐφ=c'1-έ=c'1-πων=g2 πά=g1-γον=g2"),
    // lines 9–16 (four flats)
    A(9, "με=f'1-γα=g'1-λό=ab'1-πο=g'1-λις=g'1 Ἀθ=g'2-θίς=g'1 εὐ=g'2-χαῖ=g'2-σι=d'1 φε=db'1-ρό=c'1-πλοι=b2-ο=b1 "
       + "ναί=d'2-ου=db'2-σα=d'1 Τρι=f'2-τω=f'1g'1-νί=ab'1-δος=g'2 δά=g'1-…"),
    A(10, "…-δον=eb'1 ἄ=f'2-θραυσ=c'2-τον=c'1 ἁ=f'1-γί=gb'1-οις=f'2 δὲ=db'1 βω=d'2-μοῖ=f'1b1-σιν=c'1 Ἅ=f'2-φαισ=d'2-τος=c'1 "
       + "αἴ=db'1d'1-θει=db'2 νέ=db'1-ων=c'2 μῆ=c'2-ρα=c'1 ταύ=db'1c'1-ρων=b2 ὁ=b1-μοῦ=d'1db'1 δέ=f'1 νιν=c'1 Ἄ=g'1-ραψ=eb'2 "
       + "ἀτ=d'2-μὸς=eb'1 ἐς=f'1 Ὄ=f'1*-λυμ=eb'2*-πον=ab1 ἀ=b1-να=c'1-κίδ=db'2-να=c'1*-ται=b2 λι=ab1-γὺ=b1 δὲ=b1 "
       + "λω=b2-τὸς=b1c'1 βρέ=db'1-μων=c'2 αἰ=c'1db'1-όλ=d'1-οις=db'1c'1 μέ=db'1*-λε=c'1-σιν=ab1 ᾠ=b2-δὰν=b1c'1 "
       + "κρέ=db'1-κει=c'2 χρυ=f'2-σέ=f'1-α=db'2 δ'ἁ=d'2-δύ=f'1-θρους=c'2"),
    A(16, "…-θα=d'1-ρις=db'1 ὕμ=c'2-νοι=b2-σιν=ab1 ἀ=b1-να=c'1-μέλ=db'2-πε=c'1-ται=b2"),
    // col. ii, lines 17–26 (three flats; the stone broken on the right)
    A(17, "…-τῶν=ab'1f'1 πρό=g'1-πας=eb'2 ἐς=f'2-μὸς=f'1 Ἀθ=f'2-θί=ab'1-δα=ab'1 λα=g'1-χὼν=g'2"),
    A(18, "…-ζει=eb'2 κλυ=f'1-τὸν=f'2 παῖ=ab'2-δα=g'1 με=g'1-γά=ab'1-λου=f'2"),
    A(19, "ἀ=d'1-κρο=eb'1-νι=f'1-φῆ=g'2 τόν=ab'2-δε=g'1 πά=ab'1-γον=f'1 ἄμ=f'1g'1-…"),
    A(20, "πᾶ=ab'2-σι=g'1 θνα=g'2-τοῖς=db'1f'1 προ=g'1-φαί=g'2-…"),
    A(21, "τρί=c'1*-πο=ab1-δα=c'1 μαν=c'2-τεῖ=d'1c'1-ον=d'1 ὡς=eb'2"),
    A(22, "…-ρει=f'1g'1 δρά=ab'1-κων=g'2 ὅ=g'1-τε=g1 τέ=g'1-…"),
    A(23, "…-σας=f'1 αἰ=f'2-ό=ab'1-λον=ab'1 ἑ=g'1-λικ=g'2-τὰν=g'2"),
    A(24, "…-μαθ'=c'1 ἵ=d'1eb'1-εἰς=f'2 ἀ=f'1-θώ=ab'2-…"),
    A(25, "δὲ=g'1 Γα=g'1-λα=ab'1-τᾶν=a'1ab'1 ἄ=ab'1-ρης=g'2"),
  ] },
];

const accentOf = (t) => { const s = t.normalize("NFD"); return /͂/.test(s) ? "circumflex" : /́/.test(s) ? "acute" : /̀/.test(s) ? "grave" : null; };
const SIGN = /(⌐|Ʊ|[A-ZΦ])(\d)(\*?)/gu;
const PITCH = /([a-g])(b|#)?('*)(\d)(\*?)/g, PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const midiOf = (l, acc, oct) => 60 + PC[l] + (acc === "b" ? -1 : acc === "#" ? 1 : 0) + 12 * oct.length;

/**
 * A piece read: its lines as syllables [{text, accent, word (in the piece), line, first, last (in its word), lineEnd,
 * notes [{sign, midi, chronoi, supplied}], beats, reliable}], and the notes a beat at a time (midi, and where each is
 * struck).
 */
export function readPiece(piece, table = LYDIAN) {
  const syllables = [];
  let word = 0;
  const notesOf = (signs, where) => piece.notation === "pitch"
    ? [...signs.matchAll(PITCH)].map(([sign, l, acc, oct, c, star]) => ({ sign: sign.replace("*", ""), midi: midiOf(l, acc, oct), chronoi: Number(c), supplied: !!star }))
    : [...signs.matchAll(SIGN)].map(([, g, c, star]) => {
      if (!(g in table)) throw new Error(`${piece.id} ${where}: no such sign ${g}`);
      return { sign: g, midi: table[g], chronoi: Number(c), supplied: !!star };
    });
  piece.lines.forEach((line, li) => {
    const reliable = line.reliable ?? piece.reliable ?? true;
    const words = line.text.split(" ");
    words.forEach((w, wi) => {
      // ("…": a syllable lost at the word's edge, the word going on beyond what is kept)
      const all = w.split("-"), syls = all.filter((x) => x !== "…"), open0 = all[0] === "…", open1 = all.at(-1) === "…";
      syls.forEach((s, si) => {
        const [text, signs] = s.split("=");
        const last = si === syls.length - 1 && !open1;
        syllables.push({ text, accent: accentOf(text), word, line: li, lineNo: line.n, first: si === 0 && !open0, last,
                         lineEnd: wi === words.length - 1 && si === syls.length - 1 && !open1, notes: notesOf(signs, line.n), reliable });
        syllables.at(-1).beats = syllables.at(-1).notes.reduce((a, x) => a + x.chronoi, 0);
      });
      word++;
    });
  });
  let at = 0;
  for (const s of syllables) { s.at = at; at += s.beats; }
  const beats = [], struck = [];
  for (const s of syllables) s.notes.forEach((x) => { for (let j = 0; j < x.chronoi; j++) { beats.push(x.midi); struck.push(j === 0); } });
  return { ...piece, syllables, beats, struck, length: at };
}

/** A piece as the runs of notes that follow one another: the piece itself, or each fragment of it alone. */
export const runsOf = (piece) => (piece.fragments ? piece.lines.map((l) => readPiece({ ...piece, lines: [l] })) : [readPiece(piece)]);

export default { MESOMEDES, DELPHIC, LYDIAN, readPiece, runsOf };
