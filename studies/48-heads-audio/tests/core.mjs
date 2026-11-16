// SPDX-License-Identifier: MPL-2.0
// Study 48 · heads~: the core's tests, sample by sample. In a browser: tests/core.html; in Node:
//   node studies/48-heads-audio/tests/core.mjs
import { HeadsCore, writer, reader } from "../kairotic/headscore.mjs";

export function run() {
  const results = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
  const SR = 1000;
  const core = (len, circular, heads) => new HeadsCore(SR, 4, { len, circular, heads });
  // runs n samples of input xs (a function of the sample index, or nothing), returns the output (the readers' sum)
  const play = (c, n, xs, from = 0) => {
    const inp = new Float32Array(n), out = new Float32Array(n);
    if (xs) for (let i = 0; i < n; i++) inp[i] = xs(from + i);
    c.process(inp, out); return out;
  };
  const impulse = (i) => (i === 0 ? 1 : 0);
  const crossings = (a) => { let c = 0; for (let i = 1; i < a.length; i++) if ((a[i - 1] < 0) !== (a[i] < 0)) c++; return c; };
  const sine = (hz) => (i) => Math.sin(2 * Math.PI * hz * i / SR);

  // a canon: a reader d behind
  {
    const out = play(core(2, true, [writer("w"), reader("r", { d: 0.1 })]), 300, impulse);
    is("a reader 0.1 s behind: the impulse comes back 100 samples later", near(out[100], 1) && out.reduce((s, v) => s + Math.abs(v), 0) < 1.000001);
  }
  {
    const out = play(core(2, true, [writer("w"), reader("r1", { d: 0.1 }), reader("r2", { d: 0.2 })]), 300, impulse);
    is("two readers: a canon in three voices (100 and 200 samples later)", near(out[100], 1) && near(out[200], 1));
  }
  // speed: an augmentation is an octave down
  {
    const c = core(4, true, [writer("w"), reader("r", { d: 0.05, speed: 0.5 })]);
    const out = play(c, 2000, sine(20));
    const outC = crossings(out.slice(400, 1400)), inC = crossings(Float32Array.from({ length: 1000 }, (_, i) => sine(20)(i)));
    is("speed 0.5: it falls behind and sounds an octave down (half the crossings)", Math.abs(outC - inC / 2) <= 1);
    is("... its drift grows by half a second each second", near(c.state().heads[1].p, 2 - 0.05 - 1, 0.002));
  }
  // backwards
  {
    const c = core(1, false, [writer("w"), reader("r", { at: "clock", p0: 2, speed: -1 })]);
    const out = play(c, 2000, (i) => (i < 1000 ? i / 1000 : 0));
    const back = Array.from(out.slice(1100, 1900));
    is("speed −1 on a fixed span: what was written comes back reversed", back.every((v, i) => i === 0 || v <= back[i - 1] + 1e-6) && back[0] > 0.85 && back[back.length - 1] < 0.15);
  }
  // writing: ovr erases as it goes (silence too), mix keeps
  {
    const c = core(0.1, true, [writer("w")]);
    play(c, 50, impulse);
    const kept = c.buf[0];
    play(c, 100, null, 50);
    is("ovr: an impulse is written…", kept === 1);
    is("… and a turn later, hearing nothing, the writer has erased it (silence written)", c.buf.every((v) => v === 0));
  }
  {
    const c = core(0.1, true, [writer("w", { mode: "mix" })]);
    play(c, 250, impulse);
    is("mix (keep 1): the impulse stays, turn after turn (an overdub)", c.buf[0] === 1);
  }
  {
    const c = core(0.1, true, [writer("w", { mode: "mix", keep: 0.5 })]);
    play(c, 301, () => 1);
    is("mix keep 0.5: what was there halves at each pass (1, 1.5, 1.75…)", near(c.buf[50], 1.75) && near(c.buf[0], 1.875));
  }
  {
    const c = core(1, false, [writer("w", { listen: [] })]);
    c.buf.fill(0.5);
    play(c, 300);
    is("a writer that listens to nothing erases what it passes (a tape's erase head)", c.buf[150] === 0 && c.buf[400] === 0.5);
  }
  // a writer's jump: a seek writes nothing between
  {
    const c = core(1, false, [writer("w", { at: "hand", target: 0.1, glide: 0.001 })]);
    c.buf.fill(0.5);
    c.set("w", { target: 0.8 }); play(c, 1);
    is("a writer sent further than its jump writes nothing between (a seek)", c.buf[400] === 0.5 && c.buf[800] === 0);
  }
  // two writers from both ends: a palindrome, in sound
  {
    const c = core(1, false, [writer("a", { mode: "mix" }), writer("b", { p0: 1, speed: -1, mode: "mix" })]);
    play(c, 1000, (i) => (i < 500 ? Math.sin(i / 7) : 0));
    let ok = true;
    for (let k = 1; k < 500; k++) if (!near(c.buf[k], c.buf[1000 - k], 1e-6)) ok = false;
    is("two writers from both ends (mix): the span is a palindrome — its second half is the first, reversed", ok && Math.abs(c.buf[100]) > 0.1);
  }
  // feedback: a writer that listens to its reader
  {
    const c = core(1, true, [writer("w", { listen: ["in", "r"], feed: 0.5 }), reader("r", { d: 0.1 })]);
    const out = play(c, 400, impulse);
    is("a writer listening to its reader (feed 0.5): echoes every d, halving", near(out[100], 1) && near(out[200], 0.5) && near(out[300], 0.25));
  }
  {
    const c = core(1, true, [writer("w", { listen: ["in", "r"], feed: 1 }), reader("r", { d: 0.25 })]);
    const out = play(c, 2000, impulse);
    is("feed 1: a round — it comes back every d, for ever", [250, 500, 750, 1000, 1250, 1500, 1750].every((i) => near(out[i], 1)));
  }
  // a reader's new d: a glide when small, a seek (a crossfade) when larger than its jump
  {
    const c = core(2, true, [writer("w"), reader("r", { d: 0.1, jump: 0.25 })]);
    play(c, 500, sine(5));
    c.set("r", { d: 0.15 }); play(c, 10, sine(5), 500);
    is("a small new d glides at a second per second", near(c.head("r").dc, 0.11, 1e-9));
    c.set("r", { d: 0.9 }); play(c, 5, sine(5), 510);
    is("a larger one is a seek: it crossfades from where it was", near(c.head("r").dc, 0.9) && c.head("r").old != null);
    play(c, 40, sine(5), 515);
    is("... and the crossfade ends", c.head("r").old == null);
  }
  // a writer on a signal
  {
    const c = core(4, true, [writer("w", { at: "signal", depth: 0.05, rate: 1 })]);
    play(c, 251);
    is("a writer on a signal: at 0.25 s it is at 0.25 + 0.05", near(c.state().heads[0].p, 0.3, 1e-9));
  }
  // by hand: it glides towards the target
  {
    const c = core(4, true, [writer("w"), reader("r", { at: "hand", target: 1, jump: 0.5, glide: 0.03 })]);
    c.set("r", { target: 1.2 }); const out = play(c, 3);
    const p3 = c.head("r").p;
    play(c, 300);
    is("by hand: a small move glides (no seek)", p3 > 1 && p3 < 1.05 && c.head("r").old == null && near(c.head("r").p, 1.2, 1e-3) && out.length === 3);
  }
  // :ovr t and :rec t
  {
    const c = core(1, false, [writer("w")]);
    play(c, 600, () => 1);
    c.cue("w", "ovr", 0.1);
    play(c, 100);
    is(":ovr t: from t at speed 1, replacing (here with silence) what it passes", c.buf[150] === 0 && c.buf[250] === 1 && near(c.head("w").p, 0.2, 0.0015));
    c.cue("w", "rec", 0.4);
    is(":rec t: what is after t is cut", c.buf[350] === 1 && c.buf[450] === 0 && c.buf[550] === 0);
  }
  {
    const c = core(1, true, [writer("w")]);
    play(c, 600, () => 1);
    c.cue("w", "rec", 0.3);
    is(":rec t on a ring: everything", c.buf.every((v) => v === 0));
  }
  // what the page draws
  {
    const c = core(2, true, [writer("w"), reader("r", { d: 0.5 })]);
    play(c, 2500, () => 0.5);
    const s = c.state();
    is("the state: the heads wrapped on the ring, the peaks", near(s.heads[0].p, 0.5, 0.0015) && Math.min(s.heads[1].p, 2 - s.heads[1].p) < 0.0015 && s.peaks.length === 360 && near(s.peaks[10], 0.5));
  }
  return results;
}

// in Node: node studies/48-heads-audio/tests/core.mjs
if (typeof process !== "undefined" && process.argv && import.meta.url === "file://" + process.argv[1]) {
  const rs = run(), bad = rs.filter((r) => !r[1]);
  for (const [w, ok] of rs) console.log((ok ? "  ok   " : "  FAIL ") + w);
  console.log(`${rs.length - bad.length} / ${rs.length} passed`);
  process.exitCode = bad.length ? 1 : 0;
}
