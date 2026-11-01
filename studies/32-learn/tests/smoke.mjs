// Study 32 · the two pieces of maths, on problems whose answer is known.
//   node studies/32-learn/tests/smoke.mjs
import { cmaes } from "../kairotic/cmaes.mjs";
import { create, train, predict, forward, backward, trainThrough } from "../kairotic/learn.mjs";

let fails = 0;
const check = (label, ok, detail = "") => { console.log((ok ? "✓ " : "✗ ") + label + (detail ? " · " + detail : "")); if (!ok) fails++; };

// CMA-ES finds the minimum of a rotated, badly scaled quadratic inside [0, 1]^10
const target = Array.from({ length: 10 }, (_, i) => 0.1 + 0.08 * i);
const f = (x) => x.reduce((s, v, i) => s + (i + 1) * (v - target[i]) ** 2 + (i ? 3 * (v - target[i]) * (x[i - 1] - target[i - 1]) * 0.3 : 0), 0);
const r = cmaes(f, new Array(10).fill(0.5), { budget: 1500, seed: 1 });
const err = Math.max(...r.x.map((v, i) => Math.abs(v - target[i])));
check("CMA-ES finds a known minimum", err < 0.02, `max error ${err.toFixed(4)} in ${r.evals} evaluations`);
check("... never evaluates more than its budget", r.evals <= 1500, String(r.evals));
check("... and its best only improves", r.history.every((h, i) => i === 0 || h[1] <= r.history[i - 1][1]));
// a target on the edge of the box: candidates are clipped, the search still gets there
const edge = cmaes((x) => (x[0] - 1) ** 2 + x[1] ** 2, [0.5, 0.5], { budget: 400, seed: 2 });
check("... a minimum on the edge of [0, 1]", edge.x[0] > 0.99 && edge.x[1] < 0.01, edge.x.map((v) => v.toFixed(3)).join(", "));

// the network learns a smooth mapping from 6 numbers to 3 in [0, 1]
let s = 7;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const gen = (n) => Array.from({ length: n }, () => {
  const x = Float32Array.from({ length: 6 }, () => rnd() * 2 - 1);
  return [x, [0.5 + 0.4 * Math.tanh(x[0] + x[1]), 1 / (1 + Math.exp(-2 * x[2] * x[3])), 0.5 + 0.25 * (x[4] - x[5])]];
});
const tr = gen(2000), te = gen(300);
const net = create([6, 32, 16, 3], 1);
const mse = (set) => set.reduce((a, [x, y]) => { const p = predict(net, x); return a + p.reduce((b, v, k) => b + (v - y[k]) ** 2, 0) / 3; }, 0) / set.length;
const before = mse(te);
train(net, tr.map((e) => e[0]), tr.map((e) => e[1]), { epochs: 40, lr: 3e-3, seed: 1 });
const after = mse(te);
check("the network learns a known mapping", after < before / 5 && after < 0.004, `test error ${before.toFixed(4)} → ${after.toFixed(4)}`);

// the gradient through two networks (what the loss that listens needs), against finite differences
const inv = create([4, 8, 3], 5), imi = create([3, 7, 5], 6, "linear");
const x0 = Float32Array.from([0.3, -0.7, 0.2, 0.9]), dt = Float32Array.from([0.1, -0.4, 0.5, 0.2, -0.3]);
const E = () => { const z = predict(imi, predict(inv, x0)); return z.reduce((a, v, k) => a + (v - dt[k]) ** 2, 0); };
const g = { W: inv.layers.map((l) => new Float32Array(l.W.length)), b: inv.layers.map((l) => new Float32Array(l.m)) };
const ai = forward(inv, x0), af = forward(imi, ai[ai.length - 1]), z = af[af.length - 1];
backward(inv, ai, backward(imi, af, z.map((v, k) => 2 * (v - dt[k])), null), g);
let worst = 0;
for (const [l, k] of [[0, 0], [0, 13], [1, 5], [1, 20]]) {
  const W = inv.layers[l].W, w0 = W[k], h = 1e-3;
  W[k] = w0 + h; const ep = E(); W[k] = w0 - h; const em = E(); W[k] = w0;
  worst = Math.max(worst, Math.abs((ep - em) / (2 * h) - g.W[l][k]) / Math.max(1e-6, Math.abs(g.W[l][k]) + Math.abs((ep - em) / (2 * h))));
}
check("the gradient through two networks matches finite differences", worst < 0.02, `worst relative difference ${worst.toExponential(1)}`);

// a network learnt through another one that imitates a known mapping: its outputs end up sounding right
const fwdMap = (u) => Float32Array.from([u[0] + u[1], u[1] - u[2], u[0] * 2 - 1, u[2] * u[2], 0.5 * u[0]]);
const imit = create([3, 32, 5], 7, "linear"), U = gen(1500).map(([, y]) => Float32Array.from(y));
train(imit, U, U.map(fwdMap), { epochs: 60, lr: 3e-3, seed: 2 });
const guess = create([6, 32, 16, 3], 1), Xs = tr.slice(0, 1500).map((e) => e[0]), Ys = tr.slice(0, 1500).map((e) => e[1]);
const Ds = Ys.map(fwdMap);
const heard = () => Xs.slice(0, 300).reduce((a, x, i) => a + fwdMap(predict(guess, x)).reduce((b, v, k) => b + (v - Ds[i][k]) ** 2, 0) / 5, 0) / 300;
const h0 = heard();
trainThrough(guess, imit, Xs, Ds, Ys, { epochs: 30, lr: 3e-3, alpha: 0.1, seed: 1 });
const h1 = heard();
check("a network learns through an imitation of the mapping", h1 < h0 / 5, `error of what it gives ${h0.toFixed(4)} → ${h1.toFixed(4)}`);

console.log(fails ? fails + " failed" : "all passed");
process.exitCode = fails ? 1 : 0;
