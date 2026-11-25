// SPDX-License-Identifier: MPL-2.0
// Study 73 · polyphony: the kernel's tests, without the model. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/73-polyphony/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as BP from "../kairotic/basicpitch.mjs";
import * as L from "../kairotic/listen.mjs";

const B = BP.NOTES;
// a posteriorgram of n frames drawn by hand: [bin, from, to, value]
function gram(n, marks) {
  const g = new Float32Array(n * B);
  for (const [f, a, b, v] of marks) for (let t = a; t < b; t++) g[t * B + f] = v;
  return g;
}
const key = (midi) => midi - BP.MIDI_OFFSET;

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // ── the windows ──
  is("the constants of Basic Pitch: 86 frames a second, windows of 43844 samples, 36164 apart",
     BP.FPS === 86 && BP.WINDOW === 43844 && BP.STEP === 36164 && BP.OVERLAP / 2 === 3840);
  const one = BP.windows(new Float32Array(BP.SR));
  is("a second of sound: one window, 86 frames", one.windows.length === 1 && one.frames === 86 && one.windows[0].length === BP.WINDOW);
  const ten = BP.windows(new Float32Array(10 * BP.SR));
  is("ten seconds: seven windows, 860 frames", ten.windows.length === 7 && ten.frames === 860);
  const imp = new Float32Array(3 * BP.SR);
  imp[0] = 1; imp[BP.STEP - 3840] = 2; imp[BP.STEP - 3840 + 5] = 3;
  const W = BP.windows(imp).windows;
  is("the audio starts after 3840 samples of silence (15 frames)", W[0][3840] === 1 && W[0].slice(0, 3840).every((x) => x === 0));
  is("… and each window starts STEP after the one before", W[1][0] === 2 && W[1][5] === 3 && W[0][BP.STEP] === 2);
  is("the last window is padded with silence", W[W.length - 1].length === BP.WINDOW);

  // ── sewing the windows back ──
  const outs = [0, 1, 2].map((w) => Float32Array.from({ length: BP.WINDOW_FRAMES * 2 }, (_, i) => w * 1000 + Math.floor(i / 2)));
  const u = BP.unwrap(outs, 2, 300);
  is("sewn: 15 frames dropped from each side of each window, 142 kept", u[0] === 15 && u[2 * 141] === 156 && u[2 * 142] === 1015 && u[2 * 284] === 2015);
  is("… cut to the frames of the audio", u.length === 600);
  is("frame times: 0 at 0, a little earlier than frame/86 for each window passed",
     BP.frameTime(0) === 0 && Math.abs(BP.frameTime(171) - 171 * 256 / 22050) < 1e-12 && BP.frameTime(172) < 172 * 256 / 22050
     && Math.abs((172 * 256 / 22050 - BP.frameTime(172)) - 0.010329) < 1e-4);

  // ── notes from the posteriorgrams ──
  const n = 200;
  const fr = gram(n, [[key(60), 20, 80, 0.8], [key(64), 50, 120, 0.7], [key(61), 20, 80, 0.25]]);
  const on = gram(n, [[key(60), 20, 21, 0.9]]);
  const found = BP.notes(fr, on, n);
  notes.push("notes: " + JSON.stringify(found.map((x) => [x.midi, x.start, x.end, Math.round(x.amp * 100) / 100])));
  is("a note from its onset: C4 from frame 20 to 80", found.some((x) => x.midi === 60 && x.start === 20 && x.end === 80));
  is("a note without an onset of its own: E4, from where its frames rise (inferred onsets)", found.some((x) => x.midi === 64 && x.start === 50 && x.end === 120));
  is("a faint neighbour a semitone above (under 0.3) is no note", !found.some((x) => x.midi === 61));
  is("the note's amplitude is the mean of its frames", Math.abs(found.find((x) => x.midi === 60).amp - 0.8) < 1e-6);

  const gap = BP.notes(gram(n, [[key(67), 10, 40, 0.8], [key(67), 45, 90, 0.8]]), gram(n, [[key(67), 10, 11, 0.9]]), n, { inferOnsets: false, melodia: false });
  is("a gap shorter than the tolerance (5 frames < 11) is still one note", gap.length === 1 && gap[0].start === 10 && gap[0].end === 90);
  const split = BP.notes(gram(n, [[key(67), 10, 40, 0.8], [key(67), 60, 90, 0.8]]), gram(n, [[key(67), 10, 11, 0.9], [key(67), 60, 61, 0.9]]), n, { inferOnsets: false, melodia: false });
  is("… a longer one, two notes", split.length === 2 && split[0].end === 40 && split[1].start === 60);
  const short = BP.notes(gram(n, [[key(72), 30, 40, 0.9]]), gram(n, [[key(72), 30, 31, 0.9]]), n);
  is("a note no longer than 11 frames (127.7 ms) is not a note", short.length === 0);
  const weak = BP.notes(gram(n, [[key(72), 30, 90, 0.9]]), gram(n, [[key(72), 30, 31, 0.4]]), n, { inferOnsets: false, melodia: false });
  is("an onset under 0.5 starts nothing (without inferred onsets nor melodia)", weak.length === 0);
  const mel = BP.notes(gram(n, [[key(72), 30, 90, 0.6]]), gram(n, [[key(72), 30, 31, 0.4]]), n, { inferOnsets: false });
  is("… what is left above 0.3 is still read by the melodia trick, from its loudest frame both ways", mel.length === 1 && mel[0].start === 30 && mel[0].end === 89);

  // ── what a follower could hear ──
  const piece = L.pieceNotes();
  const pn = Math.floor(6.5 * BP.FPS);
  const ideal = new Float32Array(pn * B);
  for (const { t, dur, midi } of piece) {
    const a = L.frameAt(t, pn), b = L.frameAt(t + dur, pn);
    for (let i = a; i < b; i++) ideal[i * B + key(midi)] = 0.9;
  }
  const oct = L.octaves(ideal, pn, L.pieceChords());
  notes.push(`octaves on an ideal posteriorgram: keys ${oct.keys.join("/")}, chroma ${oct.chroma.join("/")}`);
  is("an octave off: the 88 keys always tell it from the written chord", oct.keys[0] === oct.keys[1] && oct.keys[1] > 20);
  is("… a chroma never can (the same pitch classes)", oct.chroma[0] === 0);
  is("the salience of a chord's keys while it sounds", L.salience(ideal, pn, 0.2, 0.6)[key(36)] > 0.85 && L.salience(ideal, pn, 0.2, 0.6)[key(41)] === 0);
  const ev = L.events([{ start: 86, end: 172, midi: 60, amp: 0.5 }]);
  is("notes as events in seconds", Math.abs(ev[0].t - 1) < 0.01 && Math.abs(ev[0].dur - 1) < 0.02 && ev[0].midi === 60);
  const truth = [{ t: 0, midi: 60 }, { t: 0.5, midi: 64 }, { t: 1, midi: 67 }];
  const sc = L.score([{ t: 0.02, midi: 60 }, { t: 0.5, midi: 65 }, { t: 1.04, midi: 67 }, { t: 1.2, midi: 67 }], truth);
  is("a note-level score: same pitch, start within 50 ms, each written note used once", sc.matched === 2 && sc.precision === 0.5 && sc.recall === 0.667);
  is("EDN of the events", L.edn([{ t: 0, dur: 0.5, midi: 60, amp: 0.4 }]) === "[{:t 0 :dur 0.5 :midi 60 :amp 0.4}]");

  // ── the piece's sound ──
  const s1 = L.render(piece), s2 = L.render(piece);
  let peak = 0; for (const x of s1) peak = Math.max(peak, Math.abs(x));
  notes.push(`the piece: ${(s1.length / BP.SR).toFixed(2)} s, peak ${peak.toFixed(3)}`);
  is("the piece rendered: 6.5 s at 22050 Hz, the same samples every time, never clipping",
     s1.length === Math.ceil(6.5 * BP.SR) && s1.every((x, i) => x === s2[i]) && peak > 0.1 && peak < 1);

  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(results.map(([w, ok]) => (ok ? "  ok   " : "  FAIL ") + w).join("\n"));
  console.log(notes.map((s) => "  · " + s).join("\n"));
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
