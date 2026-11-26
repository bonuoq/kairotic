// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 75 · voice: notes with their syllables → the curves a formant voice follows (discussion #467).
// The one control both faust~ boxes share: voice.dsp takes pitch, AV and the formants; noise.dsp takes AH, AF, AB,
// FC, FB and the same formants. Nothing is learnt — each phoneme's targets come from the table (phonemes.mjs), and
// the way from one to the next is drawn here, where it can be read:
//
//   - a syllable starts with its note, its onset consonants just before it (as singers put them, before the beat),
//     its coda consonants and the next syllable's onset together taking at most CONSONANTS_MAX of its time
//   - a stop is a closure (silence, or a voice bar if voiced), a burst, then its voice onset time as aspiration
//     (long for φ θ χ); h is aspiration through the next vowel's formants; a diphthong is two vowel targets
//   - a sung vowel's first formant is raised to just above the pitch where the pitch is higher (as sopranos tune it,
//     after Sundberg): an i on a high e" would otherwise lose its fundamental (tuneF1, on by default)
//   - each target holds while its phoneme sounds; the formants move from one to the next over FORMANT_GLIDE (the
//     transitions that make a consonant heard), the amplitudes over AMP_GLIDE, the pitch over PITCH_GLIDE
//
// notes: [{t, dur (seconds), midi, syl (the syllable as written; "" or null: the note goes on with the syllable before,
// a melisma)}]  →  {hop, frames: [{pitch, AV, AH, AF, AB, F1…F4, B1…B4, FC, FB}], segments: [{p, kind, from, to, syl}],
// duration, offset (where the first note's time is in the curves: the first consonants come before it)}

import { TABLE, scaled, linePhonemes } from "./phonemes.mjs";

export const HOP = 0.005;
export const CONSONANTS_MAX = 0.45;
export const REST_GAP = 0.03;
export const F1_TUNING = 1.05;
export const FORMANT_GLIDE = 0.035, AMP_GLIDE = 0.015, PITCH_GLIDE = 0.025;
export const PARAMS = ["pitch", "AV", "AH", "AF", "AB", "F1", "F2", "F3", "F4", "B1", "B2", "B3", "B4", "FC", "FB"];

const SILENCE = { AV: 0, AH: 0, AF: 0, AB: 0, FC: 4000, FB: 2000 };

/** The notes grouped into syllables: [{text, start, end, notes}] (a note without a syllable continues the one before). */
export function syllables(notes) {
  const out = [];
  for (const n of notes) {
    if (n.syl || !out.length) out.push({ text: n.syl || "", start: n.t, end: n.t + n.dur, notes: [n] });
    else { const s = out[out.length - 1]; s.notes.push(n); s.end = n.t + n.dur; }
  }
  // legato: a syllable lasts until the next begins, unless a rest parts them (more than REST_GAP)
  out.forEach((s, i) => { const nx = out[i + 1]; if (nx && nx.start - s.end <= REST_GAP) s.end = Math.max(s.end, nx.start); });
  return out;
}

/** The segments: each phoneme (a stop as closure, burst and aspiration) with its time and its targets. */
export function segments(notes, { table = TABLE, pron = "attic", size = 1 } = {}) {
  const T = scaled(table, size), S = syllables(notes);
  const ph = linePhonemes(S.map((s) => s.text), pron);
  ph.forEach((p) => { if (!p.nucleus.length) p.nucleus = ["a"]; });          // a syllable that is not Greek: sung on a
  const ms = (p) => (T[p] && T[p].ms ? T[p].ms : 60) / 1000;
  const segs = [];
  // the consonants before each boundary (coda of k, onset of k+1) and where they start
  // (after a rest the next onset is placed in the rest, before its note, and the coda before the rest)
  const gapAfter = (k) => (S[k + 1] ? S[k + 1].start - S[k].end : 0);
  const before = S.map((s, k) => {
    const parted = gapAfter(k) > REST_GAP;
    const cs = parted ? [...ph[k].coda] : [...ph[k].coda, ...(ph[k + 1] ? ph[k + 1].onset : [])];
    const span = s.end - s.start, want = cs.reduce((a, p) => a + ms(p), 0);
    return { cs, codaN: ph[k].coda.length, f: want ? Math.min(1, (CONSONANTS_MAX * span) / want) : 1, want, parted };
  });
  const firstOn = ph[0] ? ph[0].onset : [], lead = firstOn.reduce((a, p) => a + ms(p), 0);
  const put = (p, from, to, syl) => {
    const t = T[p] || T.a;
    if (t.kind !== "stop") { segs.push({ p, kind: t.kind, from, to, syl, ...pick(t) }); return; }
    const f = (to - from) / ms(p), clos = (t.closure / 1000) * f, burst = 0.008 * f;
    segs.push({ p, kind: "closure", from, to: from + clos, syl, ...pick(t), AV: t.AV, AB: 0 });
    segs.push({ p, kind: "burst", from: from + clos, to: from + clos + burst, syl, ...pick(t), AV: t.AV, AB: t.burst });
    if (to > from + clos + burst + 1e-6)
      segs.push({ p, kind: "aspiration", from: from + clos + burst, to, syl, ...pick(t), F: [null, null, null, null], B: [null, null, null, null],
                  AV: t.AV, AH: t.vot ? (t.vot > 40 ? 0.6 : 0.35) : 0, AB: 0 });
  };
  let at = 0;
  firstOn.forEach((p) => { put(p, at, at + ms(p), 0); at += ms(p); });
  const offset = lead - (S[0] ? S[0].start : 0);
  S.forEach((s, k) => {
    const b = before[k], start = s.start + offset, end = s.end + offset;
    const consStart = end - b.want * b.f;
    const vowels = ph[k].nucleus;
    const vEnd = Math.max(start + 0.02, consStart);
    vowels.forEach((v, j) => {
      const share = vowels.length === 1 ? [0, 1] : j === 0 ? [0, 0.65] : [0.65, 1];
      put(v, start + (vEnd - start) * share[0], start + (vEnd - start) * share[1], k);
    });
    let c = Math.max(vEnd, consStart);
    b.cs.forEach((p, j) => { const d = ms(p) * b.f; put(p, c, c + d, j < b.codaN ? k : k + 1); c += d; });
    if (b.parted && ph[k + 1] && ph[k + 1].onset.length) {
      const on = ph[k + 1].onset, want = on.reduce((a, p) => a + ms(p), 0), f = Math.min(1, gapAfter(k) / want);
      let d0 = S[k + 1].start + offset - want * f;
      on.forEach((p) => { const d = ms(p) * f; put(p, d0, d0 + d, k + 1); d0 += d; });
    }
  });
  // a consonant's formants left to its neighbours (null): the next vowel's, or the one before
  const vowelsAt = segs.map((s, i) => i).filter((i) => segs[i].kind === "vowel");
  segs.forEach((s, i) => {
    const nv = vowelsAt.find((j) => j > i) ?? [...vowelsAt].reverse().find((j) => j < i);
    const ref = nv != null ? segs[nv] : { F: T.a.F, B: T.a.B };
    s.F = s.F.map((f, q) => (f == null ? ref.F[q] : f));
    s.B = s.B.map((b, q) => (b == null ? ref.B[q] : b));
  });
  return { segments: segs, syllables: S, phonemes: ph, offset, duration: segs.length ? segs[segs.length - 1].to : 0 };
}

function pick(t) {
  return { F: t.F.slice(), B: t.B.slice(), AV: t.AV || 0, AH: t.AH || 0, AF: t.AF || 0, AB: 0, FC: t.FC || SILENCE.FC, FB: t.FB || SILENCE.FB };
}

const valueOf = (s, k) => (/^F\d$/.test(k) ? s.F[+k[1] - 1] : /^B\d$/.test(k) ? s.B[+k[1] - 1] : s[k]);

function smooth(xs, w) {
  if (w <= 1) return xs;
  const h = Math.floor(w / 2), out = new Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    let s = 0, n = 0;
    for (let j = i - h; j <= i + h; j++) { const v = xs[Math.min(xs.length - 1, Math.max(0, j))]; s += v; n++; }
    out[i] = s / n;
  }
  return out;
}

/** The curves, a frame every HOP seconds: each parameter the mean of its targets over the frame (a burst shorter
 *  than a frame still counts), then glided. */
export function curves(notes, opts = {}) {
  const { tail = 0.3 } = opts;
  const G = segments(notes, opts), segs = G.segments;
  const n = Math.ceil((G.duration + tail) / HOP);
  const cols = Object.fromEntries(PARAMS.map((k) => [k, new Array(n).fill(0)]));
  let last = segs[0] || { F: TABLE.a.F, B: TABLE.a.B, ...SILENCE };
  for (let i = 0, si = 0; i < n; i++) {
    const a = i * HOP, b = a + HOP;
    while (si < segs.length && segs[si].to <= a) last = segs[si++];
    const acc = {}, keys = PARAMS.filter((k) => k !== "pitch");
    for (const k of keys) acc[k] = 0;
    let covered = 0;
    for (let j = si; j < segs.length && segs[j].from < b; j++) {
      const s = segs[j], w = Math.min(b, s.to) - Math.max(a, s.from);
      if (w <= 0) continue;
      covered += w;
      for (const k of keys) acc[k] += valueOf(s, k) * w;
      last = s;
    }
    for (const k of keys) {
      const rest = HOP - covered;          // silence where no phoneme sounds; the tract stays where it was
      const fill = k[0] === "F" || k[0] === "B" ? valueOf(last, k) : SILENCE[k] ?? 0;
      cols[k][i] = (acc[k] + fill * Math.max(0, rest)) / HOP;
    }
  }
  // the pitch: each note's from its time (its onset consonants already at it), held after the last
  const ns = [...notes].sort((x, y) => x.t - y.t);
  for (let i = 0, j = 0; i < n; i++) {
    const t = i * HOP - G.offset;
    while (j + 1 < ns.length && ns[j + 1].t <= t) j++;
    cols.pitch[i] = ns.length ? ns[j].midi : 60;
  }
  const W = (s) => Math.max(1, Math.round(s / HOP) | 1);
  for (const k of PARAMS) {
    const w = k === "pitch" ? W(PITCH_GLIDE) : k === "AB" ? 1 : /^(F|B)/.test(k) ? W(FORMANT_GLIDE) : W(AMP_GLIDE);
    cols[k] = smooth(cols[k], w);
  }
  if (opts.tuneF1 !== false)
    for (let i = 0; i < n; i++) cols.F1[i] = Math.max(cols.F1[i], 440 * 2 ** ((cols.pitch[i] - 69) / 12) * F1_TUNING);
  const frames = Array.from({ length: n }, (_, i) => Object.fromEntries(PARAMS.map((k) => [k, Math.round(cols[k][i] * 1000) / 1000])));
  return { hop: HOP, frames, segments: G.segments, syllables: G.syllables, phonemes: G.phonemes, offset: G.offset, duration: n * HOP };
}
