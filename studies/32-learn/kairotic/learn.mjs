// Study 32 · a small network that learns the way back: descriptors → a patch (discussion #114).
//
// Plain JavaScript, no library: the same code trains in a worker, in Node and runs in the page, and a
// trained model is a small JSON (its weights) that a work could keep.
//
// Input: the 42 frames × 18 descriptors of Study 30, each descriptor shaped as the matcher shapes it (level
// and Hz on log scales), standardised with the training set's statistics, then pooled over time into SEGS
// segments (their means): the envelope stays, the input is 8 × 18 = 144 numbers instead of 756.
// Output: the 10 parameters in [0, 1] (a sigmoid). Loss: squared error on the parameters (train). That is
// the ill-posed part (patches that sound alike but differ are pulled towards their average), so it can
// also learn through a second network that imitates the synth (parameters → descriptors, an easy
// direction to learn), whose error is about how the patch would sound (trainThrough); and its guess is
// then refined by a search that listens to the real synth (cmaes.mjs).

import { DIMS } from "../../30-inverse/kairotic/dataset.mjs";

export const SEGS = 8;
const D = DIMS.length;
// the input: the pooled descriptors, then the pitch YIN heard (whether there is one, and where)
export const INPUT = SEGS * D + 2;

// as dataset.mjs's matcher: level and Hz on log scales
const shape = (row) => row.map((x, j) => (j === 0 ? Math.log10(x + 1e-4) : j === 1 || j === 3 ? Math.log2(1 + x) : x));

// the statistics of each descriptor over every frame of the training set
export function stats(bank) {
  const mu = new Float64Array(D), sd = new Float64Array(D);
  let n = 0;
  for (const e of bank) for (const r of e.f) { const s = shape(r); for (let j = 0; j < D; j++) mu[j] += s[j]; n++; }
  for (let j = 0; j < D; j++) mu[j] /= n || 1;
  for (const e of bank) for (const r of e.f) { const s = shape(r); for (let j = 0; j < D; j++) sd[j] += (s[j] - mu[j]) ** 2; }
  for (let j = 0; j < D; j++) sd[j] = Math.sqrt(sd[j] / (n || 1)) || 1;
  return { mu: Array.from(mu), sd: Array.from(sd) };
}

// frames (and the pitch heard, p = [0…1 or -1, sure]) → the network's input: standardised, pooled into
// SEGS segments, then two numbers for the pitch (a pitch class or none: no pitch is 0 and the middle)
export function input(f, st, p = null) {
  const x = new Float32Array(INPUT), cnt = new Float32Array(SEGS), T = f.length;
  const has = p && p[0] >= 0;
  x[SEGS * D] = has ? 1 : 0;
  x[SEGS * D + 1] = has ? 2 * p[0] - 1 : 0;
  for (let t = 0; t < T; t++) {
    const s = Math.min(SEGS - 1, Math.floor((t * SEGS) / T)), r = shape(f[t]);
    cnt[s]++;
    for (let j = 0; j < D; j++) x[s * D + j] += (r[j] - st.mu[j]) / st.sd[j];
  }
  for (let s = 0; s < SEGS; s++) if (cnt[s]) for (let j = 0; j < D; j++) x[s * D + j] /= cnt[s];
  return x;
}

// a seeded generator (mulberry32), for the initial weights and the order of the examples
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// a multilayer perceptron: ReLU between the layers, and at the end a sigmoid (parameters in [0, 1]) or
// nothing (out: "linear", for descriptors)
export function create(sizes, seed = 1, out = "sigmoid") {
  const r = rng(seed), gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
  const layers = [];
  for (let l = 0; l + 1 < sizes.length; l++) {
    const n = sizes[l], m = sizes[l + 1], W = new Float32Array(n * m), b = new Float32Array(m), s = Math.sqrt(2 / n);
    for (let i = 0; i < W.length; i++) W[i] = gauss() * s;
    layers.push({ n, m, W, b });
  }
  return { sizes, layers, out };
}

// every layer's output, from the input (acts[0]) to the network's (acts[K])
export function forward(net, x) {
  const acts = [x], K = net.layers.length, lin = net.out === "linear";
  for (let l = 0; l < K; l++) {
    const L = net.layers[l], a = acts[l], z = new Float32Array(L.m), last = l === K - 1;
    for (let j = 0; j < L.m; j++) {
      let s = L.b[j];
      for (let i = 0; i < L.n; i++) s += a[i] * L.W[i * L.m + j];
      z[j] = last ? (lin ? s : 1 / (1 + Math.exp(-s))) : Math.max(0, s);
    }
    acts.push(z);
  }
  return acts;
}
export function predict(net, x) { const a = forward(net, x); return a[a.length - 1]; }

// back from dE/d(output) through the network: adds dE/dW and dE/db into g (unless null) and returns
// dE/d(input) — so the error can go on through a network before this one
export function backward(net, acts, dOut, g) {
  const K = net.layers.length, out = acts[K];
  let delta = net.out === "linear" ? Float32Array.from(dOut) : Float32Array.from(dOut, (d, k) => d * out[k] * (1 - out[k]));
  for (let l = K - 1; l >= 0; l--) {
    const L = net.layers[l], a = acts[l], prev = new Float32Array(L.n);
    for (let u = 0; u < L.n; u++) {
      const au = a[u], row = u * L.m;
      let s = 0;
      for (let j = 0; j < L.m; j++) { if (g) g.W[l][row + j] += au * delta[j]; s += L.W[row + j] * delta[j]; }
      prev[u] = l === 0 ? s : au > 0 ? s : 0;
    }
    if (g) for (let j = 0; j < L.m; j++) g.b[l][j] += delta[j];
    delta = prev;
  }
  return delta;
}

// Adam, for one network
function adam(net, lr) {
  const L = net.layers, b1 = 0.9, b2 = 0.999, eps = 1e-8;
  const mW = L.map((l) => new Float32Array(l.W.length)), vW = L.map((l) => new Float32Array(l.W.length));
  const mb = L.map((l) => new Float32Array(l.m)), vb = L.map((l) => new Float32Array(l.m));
  const g = { W: L.map((l) => new Float32Array(l.W.length)), b: L.map((l) => new Float32Array(l.m)) };
  let step = 0;
  return {
    g,
    zero() { g.W.forEach((x) => x.fill(0)); g.b.forEach((x) => x.fill(0)); },
    step(bs) {
      step++;
      const c1 = 1 - Math.pow(b1, step), c2 = 1 - Math.pow(b2, step);
      L.forEach((Ll, l) => {
        for (let k = 0; k < Ll.W.length; k++) {
          const gg = g.W[l][k] / bs;
          mW[l][k] = b1 * mW[l][k] + (1 - b1) * gg; vW[l][k] = b2 * vW[l][k] + (1 - b2) * gg * gg;
          Ll.W[k] -= lr * (mW[l][k] / c1) / (Math.sqrt(vW[l][k] / c2) + eps);
        }
        for (let k = 0; k < Ll.m; k++) {
          const gg = g.b[l][k] / bs;
          mb[l][k] = b1 * mb[l][k] + (1 - b1) * gg; vb[l][k] = b2 * vb[l][k] + (1 - b2) * gg * gg;
          Ll.b[k] -= lr * (mb[l][k] / c1) / (Math.sqrt(vb[l][k] / c2) + eps);
        }
      });
    }
  };
}

// mini-batches over a shuffled order, each example given to `each(i)`, which returns its error
function epochs(n, { epochs: E = 40, batch = 64, seed = 1, onEpoch = () => true }, opt, each, validLoss) {
  const r = rng(seed), idx = Array.from({ length: n }, (_, i) => i);
  for (let ep = 0; ep < E; ep++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    let sum = 0;
    for (let s0 = 0; s0 < n; s0 += batch) {
      const bs = Math.min(batch, n - s0);
      opt.zero();
      for (let q = 0; q < bs; q++) sum += each(idx[s0 + q]);
      opt.step(bs);
    }
    if (onEpoch(ep + 1, sum / n, validLoss ? validLoss() : null) === false) break;
  }
}

// training on the squared error of the outputs (the parameters for the network that guesses them, the
// descriptors for the one that imitates the synth); onEpoch(epoch, trainLoss, validLoss) after each
// epoch, and training stops when it returns false (a stop button)
export function train(net, X, Y, { epochs: E = 40, batch = 64, lr = 2e-3, seed = 1, valid = null, onEpoch = () => true } = {}) {
  const opt = adam(net, lr), m = Y[0].length;
  const mse = (Xs, Ys) => { let s = 0; for (let i = 0; i < Xs.length; i++) { const p = predict(net, Xs[i]); for (let k = 0; k < m; k++) s += (p[k] - Ys[i][k]) ** 2; } return s / (Xs.length * m); };
  epochs(X.length, { epochs: E, batch, seed, onEpoch }, opt, (i) => {
    const acts = forward(net, X[i]), out = acts[acts.length - 1], d = new Float32Array(m);
    let e2 = 0;
    for (let k = 0; k < m; k++) { const e = out[k] - Y[i][k]; e2 += e * e; d[k] = (2 * e) / m; }
    backward(net, acts, d, opt.g);
    return e2 / m;
  }, valid ? () => mse(valid.X, valid.Y) : null);
  return net;
}

// a loss that listens: the guessing network trained through a network that imitates the synth (fwd,
// parameters → the pooled descriptors, kept as it is): its error is how far the descriptors of its patch
// would be from the target's, plus `alpha` times the error on the parameters (which keeps it near real
// patches where the imitation is unsure). D[i] is the target's pooled descriptors (fwd's outputs).
export function trainThrough(net, fwd, X, D, Y, { epochs: E = 20, batch = 64, lr = 1e-3, seed = 1, alpha = 0.3, valid = null, onEpoch = () => true } = {}) {
  const opt = adam(net, lr), nd = D[0].length, np = Y[0].length;
  const lossOf = (x, dd, y) => {
    const u = predict(net, x), z = predict(fwd, u);
    let a = 0, b = 0;
    for (let k = 0; k < nd; k++) a += (z[k] - dd[k]) ** 2;
    for (let k = 0; k < np; k++) b += (u[k] - y[k]) ** 2;
    return a / nd + (alpha * b) / np;
  };
  epochs(X.length, { epochs: E, batch, seed, onEpoch }, opt, (i) => {
    const acts = forward(net, X[i]), u = acts[acts.length - 1];
    const fa = forward(fwd, u), z = fa[fa.length - 1], dz = new Float32Array(nd);
    let a = 0, b = 0;
    for (let k = 0; k < nd; k++) { const e = z[k] - D[i][k]; a += e * e; dz[k] = (2 * e) / nd; }
    const du = backward(fwd, fa, dz, null);   // through the imitation, which stays as it is
    for (let k = 0; k < np; k++) { const e = u[k] - Y[i][k]; b += e * e; du[k] += (2 * alpha * e) / np; }
    backward(net, acts, du, opt.g);
    return a / nd + (alpha * b) / np;
  }, valid ? () => { let s = 0; for (let i = 0; i < valid.X.length; i++) s += lossOf(valid.X[i], valid.D[i], valid.Y[i]); return s / valid.X.length; } : null);
  return net;
}

// a trained model as JSON (with the statistics its input needs), and back
export function save(net, st) {
  return { kairotic: "study-32-learn", segs: SEGS, dims: DIMS, input: INPUT, stats: st, sizes: net.sizes, out: net.out || "sigmoid",
    layers: net.layers.map((l) => ({ W: Array.from(l.W, (v) => +v.toPrecision(5)), b: Array.from(l.b, (v) => +v.toPrecision(5)) })) };
}
export function load(json) {
  if (!json || json.kairotic !== "study-32-learn" || json.dims.join() !== DIMS.join() || json.sizes[0] !== INPUT) throw new Error("not a model of this study (or of an older version of it)");
  const net = { sizes: json.sizes, out: json.out || "sigmoid", layers: json.layers.map((l, i) => ({ n: json.sizes[i], m: json.sizes[i + 1], W: Float32Array.from(l.W), b: Float32Array.from(l.b) })) };
  return { net, stats: json.stats };
}
