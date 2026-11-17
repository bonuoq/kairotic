// SPDX-License-Identifier: MPL-2.0
// Study 49 · insert: the core's tests, sample by sample. In a browser: tests/core.html; in Node:
//   node studies/49-insert/tests/core.mjs
import { HeadsCore, writer, reader, BLOCK } from "../kairotic/insertcore.mjs";

export function run() {
  const results = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
  const SR = 1000;
  const play = (c, n, xs) => {
    const inp = new Float32Array(n), out = new Float32Array(n);
    if (xs) for (let i = 0; i < n; i++) inp[i] = xs(i);
    c.process(inp, out); return out;
  };
  const impulse = (i) => (i === 0 ? 1 : 0);
  const peaks = (out, from, to) => { const p = []; for (let i = from; i < to; i++) if (Math.abs(out[i]) > 1e-4) p.push(i); return p; };
  const loop = (o) => new HeadsCore(SR, 4, { len: 2, circular: true, heads: [writer("w", Object.assign({ listen: ["in", "r"] }, o)), reader("r", { d: 0.05 })] });

  {
    const out = play(loop({ feed: 1 }), 400, impulse);
    is("inside: a reader 50 samples behind its writer, fed back, comes back every 50 samples, to the sample", JSON.stringify(peaks(out, 0, 400)) === "[50,100,150,200,250,300,350]");
  }
  {
    const out = play(loop({ feed: 1, outside: true }), 600, impulse);
    is(`outside: the same loop through other boxes waits a block — every ${50 + BLOCK} samples`, JSON.stringify(peaks(out, 0, 600)) === JSON.stringify([0, 1, 2, 3].map((k) => 50 + k * (50 + BLOCK))));
  }
  {
    const out = play(loop({ feed: 1, insert: { step: (x) => 0.5 * x } }), 260, impulse);
    is("an insert in the feedback (here ×0.5): each pass goes through it", near(out[50], 1) && near(out[100], 0.5) && near(out[150], 0.25) && near(out[200], 0.125));
  }
  {
    // a one-pole lowpass: its state goes on between the samples it is given
    let z = 0;
    const lp = { step: (x) => (z = z + 0.5 * (x - z)) };
    const out = play(loop({ feed: 1, insert: lp }), 160, impulse);
    is("a filter in the loop: each pass is smoother (the impulse spreads)", near(out[100], 0.5) && near(out[101], 0.25) && out[150] < out[100]);
  }
  {
    let calls = 0;
    const c = loop({ feed: 0.5, listen: ["in"], insert: { step: (x) => { calls++; return x; } } });
    play(c, 100);
    is("the insert runs on every sample, even when the writer hears no reader (its state goes on)", calls === 100);
  }
  {
    // a plucked string: a burst of noise, a period of 2.5 ms at 8 kHz (20 samples): 400 Hz, exactly
    const c = new HeadsCore(8000, 1, { len: 0.5, circular: true, heads: [writer("w", { listen: ["in", "r"], feed: 0.99 }), reader("r", { d: 20 / 8000 })] });
    let s = 1; const noise = (i) => (i < 20 ? ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1 : 0);
    const out = play(c, 8000, noise);
    let best = 0, bestLag = 0;
    for (let lag = 10; lag < 200; lag++) { let a = 0; for (let i = 2000; i < 6000; i++) a += out[i] * out[i + lag]; if (a > best) { best = a; bestLag = lag; } }
    is("Karplus–Strong inside the node: the string's period is d (20 samples: 400 Hz at 8 kHz)", bestLag === 20);
  }
  return results;
}

if (typeof process !== "undefined" && process.argv && import.meta.url === "file://" + process.argv[1]) {
  const rs = run(), bad = rs.filter((r) => !r[1]);
  for (const [w, ok] of rs) console.log((ok ? "  ok   " : "  FAIL ") + w);
  console.log(`${rs.length - bad.length} / ${rs.length} passed`);
  process.exitCode = bad.length ? 1 : 0;
}
