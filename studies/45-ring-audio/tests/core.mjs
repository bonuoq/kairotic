// SPDX-License-Identifier: MPL-2.0
// Study 45 · ring~: the core's tests, sample by sample. In a browser: tests/core.html; in Node:
//   node studies/45-ring-audio/tests/core.mjs
import { RingCore } from "../kairotic/ringcore.mjs";

export function run() {
  const results = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
  const SR = 1000;
  const core = (o) => new RingCore(SR, 4, Object.assign({ dur: 2, mix: 1, interp: "linear", mode: "seek" }, o));
  // runs n samples of input xs (a function of the sample index, or nothing), returns the output
  const play = (c, n, xs) => {
    const inp = new Float32Array(n), out = new Float32Array(n);
    if (xs) for (let i = 0; i < n; i++) inp[i] = xs(i);
    c.process(inp, out); return out;
  };
  const impulse = (i) => (i === 0 ? 1 : 0);

  // a delay of d
  {
    const out = play(core({ d: 0.1 }), 300, impulse);
    is("an impulse comes back d later (100 samples)", out[100] === 1 && out.reduce((s, v) => s + Math.abs(v), 0) === 1);
  }
  {
    const out = play(core({ d: 0.1005 }), 300, impulse);
    is("a fractional delay, linear: half on each side", near(out[100], 0.5) && near(out[101], 0.5));
  }
  {
    const out = play(core({ d: 0.0503, interp: "cubic" }), 300, () => 1);
    is("cubic keeps a constant as it is", out.slice(60).every((v) => near(v, 1, 1e-5)));
  }
  {
    const out = play(core({ d: 0.05, mix: 0 }), 100, (i) => i);
    is("mix 0: only what comes in", out[37] === 37);
  }
  {
    const c = core({ d: 0 });
    is("the delay is at least 2 samples", near(c.dt, 2) && near(c.state().target, 0.002));
    c.set({ d: 99 });
    is("and at most what it keeps", c.dt === c.L - 4);
  }

  // tape: the head glides at rate, and changes the pitch; above 1, backwards
  {
    const c = core({ d: 0.1, mode: "tape", rate: 0.5 });
    c.set({ d: 0.3 });
    play(c, 200);
    is("tape: the head glides at rate (0.5 s of delay a second)", near(c.dc, 200));
    play(c, 400);
    is("... and stops where it should be", near(c.dc, 300));
  }
  {
    const c = core({ d: 0.01, mode: "tape", rate: 0.5 });
    play(c, 500, (i) => i);                       // a ramp: what is read says where the head is
    c.set({ d: 0.4 });
    const out = play(c, 100, (i) => 500 + i);
    const steps = out.slice(1).map((v, i) => v - out[i]);
    is("tape, d growing at half the speed of time: the sound at half speed (an octave down)", steps.every((s) => near(s, 0.5, 1e-3)));
  }
  {
    const c = core({ d: 0.01, mode: "tape", rate: 2 });
    play(c, 500, (i) => i);
    c.set({ d: 0.4 });
    const out = play(c, 100, (i) => 500 + i);
    const steps = out.slice(1).map((v, i) => v - out[i]);
    is("tape, d growing faster than time: the head goes backwards, the sound reversed", steps.every((s) => near(s, -1, 1e-3)));
  }

  // seek: a jump, crossfaded
  {
    const c = core({ d: 0.1, mode: "seek", xfade: 0.01 });
    play(c, 500, () => 1);
    c.set({ d: 0.3 });
    play(c, 1);
    is("seek: the head is there at once", near(c.dc, 300) && c.old === 100);
    play(c, 10);
    is("... and the crossfade from where it was ends after xfade", c.old === null);
  }
  {
    const c = core({ d: 0.1, mode: "seek", xfade: 0.02 });
    play(c, 600, (i) => (i < 300 ? 0 : 1));       // silence, then a step: the old head reads 1, the new one 0
    c.set({ d: 0.5 });
    const out = play(c, 20, () => 1);
    is("... a crossfade, without a click", out[0] > 0.9 && near(out[10], 0.5, 0.06) && out[19] < 0.1 &&
       out.slice(1).every((v, i) => Math.abs(v - out[i]) < 0.06));
  }

  // both: small changes glide, large ones jump
  {
    const c = core({ d: 0.5, mode: "both", jump: 0.25, rate: 1 });
    c.set({ d: 0.6 }); play(c, 1);
    is("both: a small change glides", near(c.dc, 499 + 2) && c.old === null);
    c.set({ d: 1.5 }); play(c, 1);
    is("... a large one is a seek", near(c.dc, 1500) && c.old != null);
  }

  // freeze, feedback, clear
  {
    const c = core({ d: 0.1, dur: 1 });
    play(c, 50, impulse);
    c.set({ freeze: true });
    const out = play(c, 2100);
    const at = out.reduce((a, v, i) => (v === 1 ? a.concat(i + 50) : a), []);
    is("freeze: what it keeps loops, every turn of the ring", JSON.stringify(at) === "[100,1100,2100]");
  }
  {
    const out = play(core({ d: 0.1, feedback: 0.5 }), 400, impulse);
    is("feedback: echoes, each half the one before", out[100] === 1 && near(out[200], 0.5) && near(out[300], 0.25));
  }
  {
    const c = core({ d: 0.1 });
    play(c, 50, () => 1);
    c.set({ clear: true });
    const out = play(c, 200);
    is(":clear: silence", out.every((v) => v === 0) && c.peaks.every((p) => p === 0));
  }
  {
    const c = core({ d: 0.1 });
    play(c, 50, () => 0.5);
    c.set({ dur: 1 });
    is("another dur: a ring of that length, empty", c.L === 1000 && c.buf.every((v) => v === 0));
  }

  // what the page draws
  {
    const c = core({ d: 0.5, dur: 2 });
    play(c, 500, () => 0.8);
    const s = c.state();
    is("the state: where the heads are, as fractions of the ring", near(s.w, 0.25) && near(s.read, 0) && s.old === null);
    is("... and the peaks around it", s.peaks.length === 360 && near(s.peaks[0], 0.8) && s.peaks[300] === 0);
  }
  return results;
}

// in Node: run and say
if (typeof process !== "undefined" && process.argv && import.meta.url === new URL(process.argv[1], "file://").href) {
  const rs = run(), bad = rs.filter((r) => !r[1]);
  for (const [w, ok] of rs) console.log((ok ? "  ok   " : "  FAIL ") + w);
  console.log(`${rs.length - bad.length} / ${rs.length}`);
  process.exit(bad.length ? 1 : 0);
}
