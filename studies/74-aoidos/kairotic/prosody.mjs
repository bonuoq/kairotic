// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 74 · aoidos: the prosody of classical Greek (discussion #192). A text in polytonic Greek → its
// syllables, the quantity of each, its accent, and a line's scansion in a metre: what the singer (ἀοιδός) reads before
// singing it.
//
//   syllables    a word's vowels are its nuclei — a diphthong one (αι ει οι υι αυ ευ ου ηυ ωυ, unless a diaeresis
//                parts it, or a breathing or an accent stands on its first vowel); between two nuclei one consonant
//                begins the next syllable, of two or more the first closes the syllable before — a stop before a
//                liquid or a nasal (muta cum liquida) may begin the next together
//   quantity     long by nature: η, ω, a diphthong, an iota subscript, a circumflex, a macron; short: ε, ο, a breve;
//                doubtful: α, ι, υ — the laws of the accent settle some (an acute on the antepenult or a circumflex on
//                the penult: the last vowel short; an acute on a doubtful penult before a short last: short), the
//                metre the rest. Long by position: a vowel before two consonants or ζ ξ ψ, across words too; before
//                a stop and a liquid it is common (either). A long vowel at the end of a word before a vowel may be
//                shortened (epic correption): doubtful too
//   accent       acute, grave or circumflex, on the syllable that carries it (a diphthong's on its second vowel)
//   metre        a line's syllables matched to a metre's feet — the hexameter's dactyls (– ⏑ ⏑) and spondees (– –),
//                the iambic trimeter's metra (× – ⏑ –) — or free (each syllable as its vowel and position say):
//                the doubtful ones settled, and the line's time in beats (a short 1, a long 2), the longum of a
//                foot its strong beat (the thesis), the last syllable longer (a triseme, as Seikilos ends its lines)

const VOWELS = "αεηιουω", DOUBLE = "ζξψ", STOPS = "πβφκγχτδθ", LIQUIDS = "λρμν";
const CONSONANTS = "βγδζθκλμνξπρστφχψ";
const DIPH = new Set(["αι", "ει", "οι", "υι", "αυ", "ευ", "ου", "ηυ", "ωυ"]);
const MARK = { "́": "acute", "́": "acute", "̀": "grave", "̀": "grave", "͂": "circumflex", "̃": "circumflex",
               "̓": "smooth", "̔": "rough", "̈": "diaeresis", "ͅ": "subscript", "̄": "macron", "̆": "breve" };
const ELISION = /[’'ʼ᾽]/;
// (punctuation that ends a phrase: a pause in the melody, Greek's ano teleia · and its question mark ;)
const PAUSE = /[.,;·;:!?·]/;

/** A word's letters, each {ch (the base letter, lower case, σ for ς), marks (a set), raw (as written)}. */
function letters(word) {
  const out = [];
  for (const ch of word.normalize("NFD")) {
    if (MARK[ch] || /\p{M}/u.test(ch)) { if (out.length) { if (MARK[ch]) out[out.length - 1].marks.add(MARK[ch]); out[out.length - 1].raw += ch; } continue; }
    const c = ch.toLowerCase() === "ς" ? "σ" : ch.toLowerCase();
    if (VOWELS.includes(c) || CONSONANTS.includes(c)) out.push({ ch: c, marks: new Set(), raw: ch });
  }
  return out;
}

const accentOf = (marks) => (marks.has("circumflex") ? "circumflex" : marks.has("acute") ? "acute" : marks.has("grave") ? "grave" : null);

/** A word's nuclei: [{from, to (letter indices), v (the vowel or diphthong), marks (merged)}]. */
function nuclei(L) {
  const out = [];
  for (let i = 0; i < L.length; i++) {
    if (!VOWELS.includes(L[i].ch)) continue;
    const a = L[i], b = L[i + 1];
    const pair = b && VOWELS.includes(b.ch) ? a.ch + b.ch : null;
    if (pair && DIPH.has(pair) && !b.marks.has("diaeresis") && !accentOf(a.marks) && !a.marks.has("smooth") && !a.marks.has("rough")) {
      out.push({ from: i, to: i + 1, v: pair, marks: new Set([...a.marks, ...b.marks]) });
      i++;
    } else out.push({ from: i, to: i, v: a.ch, marks: new Set(a.marks) });
  }
  return out;
}

/** A vowel's quantity by nature: "long", "short" or "doubtful". */
function nature(v, marks) {
  if (v.length === 2 || marks.has("subscript") || marks.has("circumflex") || marks.has("macron")) return "long";
  if (v === "η" || v === "ω") return "long";
  if (marks.has("breve") || v === "ε" || v === "ο") return "short";
  return "doubtful";
}

/**
 * One word's syllables: [{text, vowel, nature, accent, onset, coda (the consonants written in it), mcl (its vowel
 * stands before a stop and a liquid that begin the next)}]. The consonants after the last vowel close the last
 * syllable; an elided word ends in its consonant.
 */
export function wordSyllables(word) {
  const L = letters(word), N = nuclei(L);
  if (!N.length) return [];
  const syl = N.map((n) => ({ from: n.from, to: n.to, vowel: n.v, marks: n.marks }));
  syl[0].from = 0;
  for (let i = 0; i < syl.length - 1; i++) {
    const a = syl[i].to + 1, z = syl[i + 1].from;          // the consonants between two nuclei: L[a..z-1]
    const cs = L.slice(a, z).map((x) => x.ch), k = cs.length;
    let split;                                             // how many of them close syllable i
    if (k <= 1) split = 0;
    else if (k === 2 && STOPS.includes(cs[0]) && LIQUIDS.includes(cs[1])) { split = 0; syl[i].mcl = true; }
    else split = 1;
    syl[i].to = a + split - 1 >= syl[i].to ? a + split - 1 : syl[i].to;
    syl[i + 1].from = a + split;
  }
  syl[syl.length - 1].to = L.length - 1;
  return syl.map((s, i) => {
    const ls = L.slice(s.from, s.to + 1);
    const vAt = ls.findIndex((x) => VOWELS.includes(x.ch));
    const onset = ls.slice(0, vAt).map((x) => x.ch).join("");
    let vEnd = vAt; while (vEnd + 1 < ls.length && VOWELS.includes(ls[vEnd + 1].ch)) vEnd++;
    const coda = ls.slice(vEnd + 1).map((x) => x.ch).join("");
    return { text: ls.map((x) => x.raw).join("").normalize("NFC"), vowel: s.vowel, nature: nature(s.vowel, s.marks), accent: accentOf(s.marks),
             onset, coda, mcl: !!s.mcl, rough: s.marks.has("rough") };
  });
}

/** The laws of the accent, settling a word's doubtful vowels where they can (the last three syllables). */
function accentLaws(S) {
  const n = S.length, ult = S[n - 1], pen = n >= 2 ? S[n - 2] : null, ant = n >= 3 ? S[n - 3] : null;
  const shortUlt = () => { if (ult.nature === "doubtful") { ult.nature = "short"; ult.law = "the acute on the antepenult: the last vowel short"; } };
  if (ant && ant.accent === "acute") shortUlt();
  if (pen && pen.accent === "circumflex" && ult.nature === "doubtful") { ult.nature = "short"; ult.law = "the circumflex on the penult: the last vowel short"; }
  if (pen && pen.accent === "acute" && pen.nature === "doubtful" && ult.nature === "short") { pen.nature = "short"; pen.law = "an acute, not a circumflex, on the penult before a short last vowel: short"; }
  if (pen && pen.accent === "acute" && ult.nature === "doubtful" && pen.nature === "long") { ult.nature = "long"; ult.law = "an acute on a long penult: the last vowel long"; }
  return S;
}

/**
 * A text in lines (a line a verse; "/" also ends one) → [{text, words: [{text, syllables, pause (a punctuation
 * after it)}], syllables (all of the line, each with its word and its place in it, its quantity: long, short or
 * doubtful — nature and position together)}].
 */
export function readText(text) {
  const lines = String(text).split(/\n|\//).map((s) => s.trim()).filter(Boolean);
  return lines.map((line) => {
    const words = [];
    for (const tok of line.split(/\s+/)) {
      const clean = tok.replace(/[.,;·;:!?·"“”«»()\[\]]/g, "");
      const syllables = accentLaws(wordSyllables(clean.replace(ELISION, "")));
      if (!syllables.length) continue;
      words.push({ text: clean, syllables, pause: PAUSE.test(tok), elided: ELISION.test(tok) });
    }
    const syl = [];
    words.forEach((w, wi) => w.syllables.forEach((s, si) => syl.push({ ...s, word: wi, inWord: si, wordLength: w.syllables.length,
                                                                       last: si === w.syllables.length - 1, pause: si === w.syllables.length - 1 && w.pause })));
    // position: the consonants after a vowel up to the next vowel, across the words of a line
    for (let i = 0; i < syl.length; i++) {
      const s = syl[i], next = syl[i + 1];
      const after = s.coda + (next ? next.onset : "");
      const count = [...after].reduce((a, c) => a + (DOUBLE.includes(c) ? 2 : 1), 0);
      const mclHere = s.mcl || (!s.coda && next && next.onset.length === 2 && STOPS.includes(next.onset[0]) && LIQUIDS.includes(next.onset[1]) && s.last === false);
      s.position = count >= 2 && !mclHere ? "long" : mclHere ? "common" : null;
      // epic correption: a long vowel or a diphthong at the end of a word, before a vowel
      s.correption = s.last && next && !s.coda && !next.onset && s.nature === "long";
      s.quantity = s.position === "long" ? (s.correption ? "doubtful" : "long")
        : s.correption ? "doubtful"
        : s.nature === "long" ? "long"
        : s.position === "common" || s.nature === "doubtful" ? "doubtful" : "short";
    }
    return { text: line, words, syllables: syl };
  });
}

// ─── metres: feet as patterns of quantities (L a long, S a short, X either: the anceps) ───
// (each foot's first element its thesis, the strong beat)
// (bar: a line's time is filled up to a multiple of it, its last syllable held longer — the hexameter's sixth foot
// four beats whatever its last syllable, as a foot is)
export const METRES = {
  hexameter: { name: "dactylic hexameter", feet: [...Array(5).fill([["L", "S", "S"], ["L", "L"]]), [["L", "X"]]], bar: 4 },
  pentameter: { name: "elegiac pentameter", feet: [[["L", "S", "S"], ["L", "L"]], [["L", "S", "S"], ["L", "L"]], [["L"]], [["L", "S", "S"]], [["L", "S", "S"]], [["X"]]], bar: 4 },
  "iambic-trimeter": { name: "iambic trimeter", feet: Array(3).fill([["X", "L", "S", "L"]]), bar: 6 },
  "iambic-dimeter": { name: "iambic dimeter", feet: Array(2).fill([["X", "L", "S", "L"]]), bar: 6 },
  free: { name: "free (as the syllables are)", feet: null, bar: 2 },
};

const fits = (q, p) => p === "X" || q === "doubtful" || (p === "L" ? q === "long" : q === "short");

// (synizesis: an ε before another vowel of the same word sung as one long syllable with it — Πηληϊάδεω, the Iliad's
// first line —, tried only where the line does not scan without it)
const canMerge = (syl, i) => i + 1 < syl.length && syl[i + 1].inWord > 0 && !syl[i + 1].onset && !syl[i].coda && syl[i].vowel === "ε";

/**
 * A line's scansion in a metre: every way its syllables fit the feet (the doubtful ones settled by the pattern), the
 * first by the metre's preference (fewer synizeses; in the hexameter more dactyls, the fifth foot a dactyl) → {ok,
 * units (the syllables sung: [{syl (indices: one, or two in synizesis), q ("long" | "short")}]), feet [{pattern, from
 * (a unit)}], all (how many scansions)} or {ok: false}.
 */
export function scan(line, metreId = "hexameter") {
  const M = METRES[metreId] || METRES.free, syl = line.syllables, n = syl.length;
  if (!M.feet) return { ok: true, metre: metreId, feet: null, all: 1,
                        units: syl.map((s, i) => ({ syl: [i], q: s.quantity === "doubtful" ? (s.position === "common" || s.nature === "long" ? "long" : "short") : s.quantity })) };
  const ways = [];
  // (f the foot, i the syllable; units the line's sung syllables so far)
  const go = (f, i, feet, units, merges) => {
    if (ways.length > 256) return;
    if (f === M.feet.length) { if (i === n) ways.push({ feet, units, merges }); return; }
    for (const pat of M.feet[f]) {
      // each element of the pattern takes one syllable, or two in synizesis (a long)
      const fill = (j, k, us, m) => {
        if (j === pat.length) { go(f + 1, k, [...feet, { pattern: pat, from: units.length }], [...units, ...us], merges + m); return; }
        if (k >= n) return;
        const p = pat[j], s = syl[k];
        if (fits(s.quantity, p)) fill(j + 1, k + 1, [...us, { syl: [k], q: p === "L" ? "long" : p === "S" ? "short" : s.quantity === "doubtful" ? "long" : s.quantity }], m);
        if (p !== "S" && canMerge(syl, k)) fill(j + 1, k + 2, [...us, { syl: [k, k + 1], q: "long", synizesis: true }], m + 1);
      };
      fill(0, i, [], 0);
    }
  };
  go(0, 0, [], [], 0);
  if (!ways.length) return { ok: false, metre: metreId, all: 0 };
  const dactyls = (w) => w.feet.filter((x) => x.pattern.length === 3 && x.pattern[1] === "S").length + (w.feet[4] && w.feet[4].pattern.length === 3 ? 0.5 : 0);
  ways.sort((a, b) => a.merges - b.merges || dactyls(b) - dactyls(a));
  return { ok: true, metre: metreId, feet: ways[0].feet, units: ways[0].units, all: ways.length };
}

/**
 * A line's time: each sung syllable's beats (a short 1, a long 2, the line's last one more) and whether it falls on a
 * strong beat (the first element of a foot; in a free line, a long one) → [{text, accent (of its syllables', the one
 * there is), word, first/last (in its word), q, beats, at, strong, pause}].
 */
export function timeOf(line, sc, { lastLonger = true } = {}) {
  const strongAt = new Set(sc.feet ? sc.feet.map((f) => f.from) : sc.units.map((u, i) => (u.q === "long" ? i : -1)).filter((i) => i >= 0));
  const bar = (METRES[sc.metre] || METRES.free).bar, plain = sc.units.reduce((a, u) => a + (u.q === "long" ? 2 : 1), 0);
  // (the last syllable held to the end of its bar — a foot's time; in a free line one beat longer, then to the bar)
  const extra = !lastLonger ? 0 : sc.feet ? (bar - (plain % bar)) % bar : 1 + ((bar - ((plain + 1) % bar)) % bar);
  let at = 0;
  return sc.units.map((u, i) => {
    const ss = u.syl.map((k) => line.syllables[k]), s0 = ss[0], s1 = ss[ss.length - 1];
    const beats = (u.q === "long" ? 2 : 1) + (i === sc.units.length - 1 ? extra : 0);
    const r = { text: ss.map((s) => s.text).join(""), accent: ss.map((s) => s.accent).find(Boolean) || null, word: s0.word,
                first: s0.inWord === 0, last: s1.last, pause: s1.pause, q: u.q, beats, at, strong: strongAt.has(i), synizesis: !!u.synizesis };
    at += beats;
    return r;
  });
}

/** The scansion as text: – long, ⏑ short, | between feet. */
export function scansionText(sc) {
  const mark = (u) => (u.q === "long" ? "–" : "⏑");
  if (!sc.feet) return sc.units.map(mark).join(" ");
  return sc.feet.map((f, k) => sc.units.slice(f.from, f.from + f.pattern.length).map(mark).join(" ")).join(" | ");
}

export default { readText, wordSyllables, scan, timeOf, scansionText, METRES };
