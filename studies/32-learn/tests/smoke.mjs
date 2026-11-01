// Study 32 · the two pieces of maths, on problems whose answer is known.
//   node studies/32-learn/tests/smoke.mjs
import { cmaes } from "../kairotic/cmaes.mjs";
import { create, train, predict } from "../kairotic/learn.mjs";

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

console.log(fails ? fails + " failed" : "all passed");
process.exitCode = fails ? 1 : 0;
