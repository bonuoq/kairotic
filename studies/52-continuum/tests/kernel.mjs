// SPDX-License-Identifier: MPL-2.0
// Study 52 · continuum: the kernel's tests. In a browser: tests/kernel.html; in Node:
//   node studies/52-continuum/tests/kernel.mjs
import { spell, spellName, heights, heightAt, curveAt, noteValue, quantize, project, sync, perform, Follower, hzOf } from "../kairotic/continuum.mjs";

export function run() {
  const results = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

  // ── spelling and heights ──
  is("a4 is A4, the second space of the treble staff: 3 steps above E4 (its bottom line)", spell(69).name === "A4" && heights(440).staff === 3);
  is("middle C is a step below the staff's first ledger line: C4 is 2 steps under E4", heights(hzOf(60)).staff === -2);
  is("in C a black key is a sharp (C#4), in F a flat (Bb4, written: the signature has it)",
     spell(61, 0).name === "C#4" && spell(70, -1).name === "Bb4" && spell(70, -1).acc === null);
  is("in D, F# needs no accidental, F natural does", spell(66, 2).acc === null && spell(65, 2).acc === "♮");
  is("in G minor (2 flats) E♭ is written without accidental and E natural with one", spell(63, -2).acc === null && spell(64, -2).acc === "♮");
  {
    const h = heights(hzOf(61.3));
    is("a pitch between keys: free above the grid, the grid on the key, the staff on its letter",
       near(h.free, 61.3 * 7 / 12 - 64 * 7 / 12) && near(h.grid, (61 - 64) * 7 / 12) && h.staff === -2);
    is("the pitch axis glides: 0 free, ½ the grid, 1 the staff, and halfway between them in between",
       near(heightAt(h, 0), h.free) && near(heightAt(h, 0.5), h.grid) && near(heightAt(h, 1), h.staff) &&
       near(heightAt(h, 0.75), (h.grid + h.staff) / 2));
  }

  {
    // a written name decides the staff (Study 55: the name the MEI has), the key only the accidental
    is("a name read in a key: Gb4 in D is a flat on G (an accidental), F#4 is not", spellName("gb4", 2).step === 4 * 7 + 4 && spellName("gb4", 2).acc === "♭" && spellName("f#4", 2).acc === null);
    is("… as Kairotic writes them: bb3, cn5, f##4", spellName("bb3").alter === -1 && spellName("cn5").alter === 0 && spellName("f##4").alter === 2 && spellName("h4") === null);
    is("a free pitch with a written name sits on the name's step (66 Hz-wise is F#4, written Gb4 it is on G)",
       heights(hzOf(66), 0, 440, "gb4").staff === 2 && heights(hzOf(66), 0).staff === 1);
    is("the projection takes an event's name when it has one", project([{ t: 0, dur: 1, hz: hzOf(66), name: "gb4" }], { time: 1, pitch: 1, glyph: 1 }).notes[0].y === 2);
  }

  // ── curves, values, grid ──
  is("a curve is linear between its points and held beyond them",
     curveAt([[0, 1], [2, 0]], 1) === 0.5 && curveAt([[0, 1], [2, 0]], -1) === 1 && curveAt([[0, 1], [2, 0]], 5) === 0 && curveAt(0.3, 9) === 0.3);
  is("note values: 1 a quarter, 1.5 a dotted quarter, 0.25 a sixteenth (two flags), 4 a whole (no stem)",
     noteValue(1).base === 1 && noteValue(1.5).dots === 1 && noteValue(0.25).flags === 2 && !noteValue(4).stem && !noteValue(2).filled);
  is("a value that is no value says so (1.25: a quarter, not exact)", noteValue(1.25).base === 1 && !noteValue(1.25).exact);
  {
    const q = quantize({ t: 1.13, dur: 0.4 }, { bpm: 60, div: 4 });
    is("on a grid of sixteenths at 60: 1.13 s → 1.25, ending 1.53 → 1.5 (a sixteenth)", near(q.t, 1.25) && near(q.dur, 0.25) && near(q.beats, 0.25));
    is("a note shorter than the grid still lasts a part of it", near(quantize({ t: 0, dur: 0.01 }).dur, 0.25));
  }

  // ── the projection ──
  const line = [
    { t: 0.02, dur: 0.95, hz: hzOf(64), amp: 0.5 },
    { t: 1.1, dur: 0.4, hz: hzOf(66.2), amp: 0.8 },
    { t: 1.55, dur: 1.4, hz: hzOf(69), hz2: hzOf(74), amp: 0.3 },
  ];
  {
    const p = project(line, { time: 1, pitch: 1, glyph: 1 });
    const [a, b, c] = p.notes;
    is("all at 1: written — on the grid of the bar, on the staff, as note values",
       near(a.x, 0) && near(b.x, 1) && a.y === 0 && b.y === 1 && a.head === 1 && a.stroke === 0 && a.durLine === 0 && a.stem === 1);
    is("… a quarter is filled with a stem and no flags; a written F#4 carries its sharp", a.filled && a.flags === 0 && b.acc === "♯" && b.accAlpha === 1);
    is("… a glissando keeps its end: from A4 up to D5", c.gliss && c.y === 3 && c.y1 === 6);
    is("bars every 4 beats, drawn where time is metric", p.bars.length === 1 && p.bars[0].alpha === 1 && p.staffAlpha(0) === 1 && p.gridAlpha(0) === 0);
  }
  {
    const p = project(line, { time: 0, pitch: 0, glyph: 0 });
    const [a, b] = p.notes;
    is("all at 0: a stroke where it sounds, at its exact pitch, as thick as it is loud",
       near(a.x, 0.02) && near(a.x1, 0.97) && near(b.y, (66.2 - 64) * 7 / 12) && a.stroke === 1 && a.head === 0 && a.thick === 0.5 && b.thick === 0.8);
    is("… no staff, no accidental, no stem, no bar", p.staffAlpha(0) === 0 && b.accAlpha === 0 && b.stem === 0 && p.bars[0].alpha === 0);
  }
  {
    const p = project(line, { time: 0, pitch: 0.5, glyph: 0.5 });
    const b = p.notes[1];
    is("proportional notation (time 0, glyph ½): a head with a line as long as the note, no stem", b.head === 0.5 && b.durLine === 0.5 && b.stem === 0);
    is("… on the semitone grid (pitch ½): F#4 at its key, the grid shown, the staff not", near(b.y, 2 * 7 / 12) && p.gridAlpha(0) === 1 && p.staffAlpha(0) === 0);
  }
  {
    // a line that dissolves: written at the start, a stroke at the end
    const res = { time: [[0, 1], [3, 0]], pitch: [[0, 1], [3, 0]], glyph: [[0, 1], [3, 0]] };
    const p = project(line, res);
    is("resolutions that change in time: the first note is written, the last mostly a stroke",
       p.notes[0].head > 0.99 && p.notes[2].head < 0.5 && p.notes[2].stroke > 0.5 && p.notes[0].stem > p.notes[1].stem && p.notes[1].stem > p.notes[2].stem);
    is("… and each axis on its own: a note can be on the staff and still a free stroke",
       project(line, { time: 0, pitch: 1, glyph: 0 }).notes[1].y === 1 && project(line, { time: 0, pitch: 1, glyph: 0 }).notes[1].stroke === 1);
  }

  // ── synchronisation ──
  const ev = [0, 1, 2, 3, 4, 5].map((t) => ({ t, dur: 1, hz: 440 }));
  const wires = [
    { id: "a", note: 1, kind: "rigid" },
    { id: "b", note: 3, kind: "elastic", leader: "performer", tol: 0.5 },
    { id: "c", note: 5, kind: "elastic", leader: "electronics" },
  ];
  const by = (rs) => Object.fromEntries(rs.map((r) => [r.id, r]));
  {
    const r = by(sync(ev, wires, [0, 1, 2, 3, 4, 5]));
    is("a performer on time: every wire starts on its note", r.a.at === 1 && r.a.status === "on the note" && r.b.at === 3 && r.b.status === "on the note" && r.c.at === 5 && r.c.status === "led" && r.c.gap === 0);
  }
  {
    const r = by(sync(ev, wires, [0, 1.7, 2.7, 3.9, 4.9, 6]));
    is("late: rigid waits for its note (1.7), whatever it takes", r.a.at === 1.7 && r.a.status === "on the note");
    is("… elastic expects the note where the last one put it (2.7 → 3.7) and takes it within 0.5 (3.9)", near(r.b.expected, 3.7) && r.b.at === 3.9 && r.b.status === "on the note");
    is("… elastic led by the electronics starts on their time (4.9 → 5.9) and writes down the performer's gap (+0.1)", near(r.c.at, 5.9) && r.c.status === "led" && near(r.c.gap, 0.1));
  }
  {
    const r = by(sync(ev, wires, [0, 1, 2, 4.2, 4.5, 5.5]));
    is("a breath longer than the tolerance: elastic goes on without the note, at 3.5, and writes how late it came (0.7)", r.b.at === 3.5 && r.b.status === "went on" && near(r.b.late, 0.7));
  }
  {
    const r = by(sync(ev, wires, [0, null, 2, 3, 4, 5]));
    is("the note of a rigid wire left out: caught up at the next note played (2)", r.a.at === 2 && r.a.status === "caught up" && r.a.at_note === 2);
  }
  {
    const r = by(sync(ev, wires, [0, 0.6, 1.6, 2.6, 3.6, 4.4]));
    is("early: rigid and elastic start on the note; led, the electronics keep the tempo the performer showed (3.6 → 4.6), not the note that came before it (4.4: a gap of −0.2)",
       r.a.at === 0.6 && r.b.at === 2.6 && near(r.c.at, 4.6) && near(r.c.gap, -0.2));
  }
  {
    const r = by(sync(ev, wires, [0, null, null, null, null, null]));
    is("a performer who stops: rigid never starts, elastic goes on (at 3.5), led starts on its time (5)",
       r.a.status === "never" && r.a.at === null && r.b.at === 3.5 && r.b.status === "went on" && r.c.at === 5);
  }
  {
    // live, as the page does it: ticks between notes
    const f = new Follower(ev, wires);
    const fired = [];
    for (let now = 0; now <= 7; now = Math.round((now + 0.05) * 100) / 100) {
      fired.push(...f.tick(now));
      if (now === 0 || now === 1.2 || now === 2.2) fired.push(...f.note([0, 1, 2][[0, 1.2, 2.2].indexOf(now)], now));
    }
    fired.push(...f.finish());
    const r = by(f.results());
    is("live, ticking between notes: the same decisions (a on its note at 1.2, b went on at 3.7, c led at 5.2)",
       r.a.at === 1.2 && near(r.b.at, 3.7) && r.b.status === "went on" && near(r.c.at, 5.2) && fired.length === 3);
  }
  {
    const a = perform(ev, { rubato: 0.2, seed: 7 }), b = perform(ev, { rubato: 0.2, seed: 7 }), c = perform(ev, { rubato: 0.2, seed: 8 });
    is("a performance is heard again with its seed, and differs with another", JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c));
    const d = perform(ev, { hold: { 3: 1 }, skip: [1] });
    is("… a breath delays the rest, a skipped note is null", d[1] === null && d[3] === 4 && d[5] === 6);
  }
  return results;
}

if (typeof process !== "undefined" && process.argv && import.meta.url === "file://" + process.argv[1]) {
  const rs = run(), bad = rs.filter((r) => !r[1]);
  for (const [w, ok] of rs) console.log((ok ? "  ok   " : "  FAIL ") + w);
  console.log(`${rs.length - bad.length} / ${rs.length} passed`);
  process.exitCode = bad.length ? 1 : 0;
}
