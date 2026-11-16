// SPDX-License-Identifier: MPL-2.0
// Study 46 · crab live: the game's tests. In a browser: tests/live.html; in Node:
//   node studies/46-crab-live/tests/live.mjs
import { mirror } from "../kairotic/mirror.mjs";
import { DIATONIC } from "../kairotic/kernel.mjs";
import { createLive, phase, options, nearest, choose, auto, read, rest, voices } from "../kairotic/live.mjs";

/** A seeded random (mulberry32), so a game can be played again. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function crab(bars = 5, kind = "crab", k = -7, b = 2) {
  const m = DIATONIC.modes.dorian, tonic = m.final, [a, z] = m.ambitus;
  return mirror({ tonic, lo: tonic + a, hi: tonic + z, n: b * (bars - 1) + 1, b, spacing: 11, system: DIATONIC,
                  starts: m.starts.map((x) => x + tonic), transform: { kind, k, axis: tonic } });
}

export function run() {
  const results = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const o = crab(5);                                   // 9 beats: 5 steps, the 5th the middle alone

  {
    const g = createLive(o, { rng: seeded(1) });
    is("it starts choosing, at beat 1", phase(g) === "choose" && g.t === 0);
    const ok = options(g).filter((c) => !c.reason && c.futures > 0).map((c) => c.note);
    is("the notes you may play are the ones that can close the work (and the others say why not)",
       ok.length > 0 && options(g).some((c) => c.reason));
    const b = choose(g, ok[0]);
    is("your note is written at the start and the engine's at the end", g.M[0] === ok[0] && g.M[o.n - 1] !== undefined);
    is("the engine sounds the end of your line, transposed", b.engine === o.T(g.M[o.n - 1]) && b.you === ok[0]);
  }
  {
    const g = createLive(o, { rng: seeded(2) });
    const b = choose(g, 99);
    is("a note that cannot close the work is taken as the nearest that can, and said", b.corrected && b.played === 99 && b.you !== 99);
    is("... nearest: a note it can play", nearest(createLive(o), 0) != null);
  }

  // whole games: always finished, always a crab
  let finished = 0, crabs = 0, midScores = 0, mirrored = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const g = createLive(o, { rng: seeded(seed) });
    const r = seeded(seed * 7 + 3);
    let midBeat = null;
    while (phase(g) === "choose") {
      const vs = options(g).filter((c) => !c.reason && c.futures > 0);
      const b = r() < 0.5 ? auto(g) : choose(g, vs[Math.floor(r() * vs.length)].note);
      if (b.score) midBeat = b;
    }
    if (midBeat && midBeat.t === o.steps - 1 && JSON.stringify(midBeat.score) === JSON.stringify(rest(g))) midScores++;
    const firstHalf = g.M.slice(0, o.steps);
    const reads = [];
    while (phase(g) === "read") reads.push(read(g));
    if (phase(g) === "done") finished++;
    if (o.count(g.M, o.steps) === 1) crabs++;
    // the second half: you read the engine's answers backwards, the engine plays your first half backwards
    if (reads.every((b) => b.you === g.M[b.t] && b.engine === o.T(firstHalf[o.n - 1 - b.t]))) mirrored++;
  }
  is("25 games, each finished", finished === 25);
  is("... each a whole crab under the rules (the kernel accepts it)", crabs === 25);
  is("... the score comes out once, at the middle, the rest of your line", midScores === 25);
  is("... and after it each voice plays the other's past backwards", mirrored === 25);

  {
    const g = createLive(o, { rng: seeded(5) });
    while (phase(g) === "choose") auto(g);
    const v = voices(g);
    is("the voices: the other one is yours backwards", v.engine.every((c, t) => c === o.T(v.you[o.n - 1 - t])));
    is("the score is to be read from the middle on", rest(g).length === o.n - o.steps && rest(g)[0][0] === o.steps);
    is("no choosing after the middle", choose(g, 3) === null && auto(g) === null);
  }
  {
    const g = createLive(o, { rng: seeded(3) });
    while (g.t < o.steps - 1) auto(g);
    const b = auto(g);
    is("an odd crab: the middle beat alone, your note against itself transposed", o.order[o.steps - 1].length === 1 && b.engine === o.T(b.you));
  }
  {
    const e = crab(4);                                  // 7 beats
    const g = createLive(e, { rng: seeded(9) });
    while (phase(g) !== "done") (phase(g) === "choose" ? auto(g) : read(g));
    is("a shorter crab, 7 beats, finished", e.count(g.M, e.steps) === 1);
  }
  {
    const tb = crab(4, "table", 0);
    const g = createLive(tb, { rng: seeded(4) });
    while (phase(g) !== "done") (phase(g) === "choose" ? auto(g) : read(g));
    const v = voices(g);
    is("a table canon live: the other voice backwards and upside down", tb.count(g.M, tb.steps) === 1 &&
       v.engine.every((c, t) => c === 2 * tb.axis - v.you[tb.n - 1 - t] + tb.k));
  }
  {
    // 3/2: the crab ends on a strong beat, so strong beats mirror strong beats; 4 bars are 10 beats, a middle of two
    const t3 = crab(4, "crab", -7, 3);
    is("3/2: 10 beats, the middle a pair", t3.n === 10 && t3.order[t3.steps - 1].length === 2);
    let ok3 = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const g = createLive(t3, { rng: seeded(seed) });
      while (phase(g) !== "done") (phase(g) === "choose" ? auto(g) : read(g));
      const v = voices(g);
      if (t3.count(g.M, t3.steps) === 1 && v.engine.every((c, t) => c === t3.T(v.you[t3.n - 1 - t]))) ok3++;
    }
    is("3/2: 10 games, each a crab the kernel accepts", ok3 === 10);
  }
  return results;
}

if (typeof process !== "undefined" && process.argv && import.meta.url === new URL(process.argv[1], "file://").href) {
  const rs = run(), bad = rs.filter((r) => !r[1]);
  for (const [w, ok] of rs) console.log((ok ? "  ok   " : "  FAIL ") + w);
  console.log(`${rs.length - bad.length} / ${rs.length}`);
  process.exit(bad.length ? 1 : 0);
}
