// Study 32 · a small network that learns the way back: descriptors → a patch (discussion #114).
//
// Plain JavaScript, no library: the same code trains in a worker, in Node and runs in the page, and a
// trained model is a small JSON (its weights) that a work could keep.
//
// Input: the 42 frames × 18 descriptors of Study 30, each descriptor shaped as the matcher shapes it (level
// and Hz on log scales), standardised with the training set's statistics, then pooled over time into SEGS
// segments (their means): the envelope stays, the input is 8 × 18 = 144 numbers instead of 756.
// Output: the 10 parameters in [0, 1] (a sigmoid). Loss: squared error on the parameters. That is the
// ill-posed part (patches that sound alike but differ are pulled towards their average), which is why the
// guess is then refined by a search that listens (cmaes.mjs).

import { DIMS } from "../../30-inverse/kairotic/dataset.mjs";

export const SEGS = 8;
const D = DIMS.length;

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

// frames → the network's input: standardised, pooled into SEGS segments
export function input(f, st) {
  const x = new Float32Array(SEGS * D), cnt = new Float32Array(SEGS), T = f.length;
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

// a multilayer perceptron: ReLU between the layers, a sigmoid at the end
export function create(sizes, seed = 1) {
  const r = rng(seed), gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
  const layers = [];
  for (let l = 0; l + 1 < sizes.length; l++) {
    const n = sizes[l], m = sizes[l + 1], W = new Float32Array(n * m), b = new Float32Array(m), s = Math.sqrt(2 / n);
    for (let i = 0; i < W.length; i++) W[i] = gauss() * s;
    layers.push({ n, m, W, b });
  }
  return { sizes, layers };
}

export function predict(net, x) {
  let a = x;
  net.layers.forEach((L, l) => {
    const z = new Float32Array(L.m), last = l === net.layers.length - 1;
    for (let j = 0; j < L.m; j++) {
      let s = L.b[j];
      for (let i = 0; i < L.n; i++) s += a[i] * L.W[i * L.m + j];
      z[j] = last ? 1 / (1 + Math.exp(-s)) : Math.max(0, s);
    }
    a = z;
  });
  return a;
}

// training with Adam on mini-batches; onEpoch(epoch, trainLoss, validLoss) after each epoch, and training
// stops when it returns false (a stop button)
export function train(net, X, Y, { epochs = 40, batch = 64, lr = 2e-3, seed = 1, valid = null, onEpoch = () => true } = {}) {
  const r = rng(seed), L = net.layers, K = L.length;
  const mW = L.map((l) => new Float32Array(l.W.length)), vW = L.map((l) => new Float32Array(l.W.length));
  const mb = L.map((l) => new Float32Array(l.m)), vb = L.map((l) => new Float32Array(l.m));
  const gW = L.map((l) => new Float32Array(l.W.length)), gb = L.map((l) => new Float32Array(l.m));
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  let step = 0;
  const idx = Array.from(X, (_, i) => i);
  const loss = (Xs, Ys) => { let s = 0; for (let i = 0; i < Xs.length; i++) { const p = predict(net, Xs[i]); for (let k = 0; k < p.length; k++) s += (p[k] - Ys[i][k]) ** 2; } return s / (Xs.length * Ys[0].length); };
  for (let ep = 0; ep < epochs; ep++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    let sum = 0;
    for (let s0 = 0; s0 < idx.length; s0 += batch) {
      const bs = Math.min(batch, idx.length - s0);
      gW.forEach((g) => g.fill(0)); gb.forEach((g) => g.fill(0));
      for (let q = 0; q < bs; q++) {
        const i = idx[s0 + q];
        // forward, keeping every layer's output
        const acts = [X[i]];
        for (let l = 0; l < K; l++) {
          const Ll = L[l], a = acts[l], z = new Float32Array(Ll.m), last = l === K - 1;
          for (let j = 0; j < Ll.m; j++) {
            let s = Ll.b[j];
            for (let u = 0; u < Ll.n; u++) s += a[u] * Ll.W[u * Ll.m + j];
            z[j] = last ? 1 / (1 + Math.exp(-s)) : Math.max(0, s);
          }
          acts.push(z);
        }
        // backward: squared error through the sigmoid, then ReLUs
        const out = acts[K];
        let delta = new Float32Array(out.length);
        for (let k = 0; k < out.length; k++) { const e = out[k] - Y[i][k]; sum += e * e; delta[k] = 2 * e * out[k] * (1 - out[k]) / out.length; }
        for (let l = K - 1; l >= 0; l--) {
          const Ll = L[l], a = acts[l], prev = new Float32Array(Ll.n);
          for (let u = 0; u < Ll.n; u++) {
            const au = a[u], row = u * Ll.m;
            let s = 0;
            for (let j = 0; j < Ll.m; j++) { gW[l][row + j] += au * delta[j]; s += Ll.W[row + j] * delta[j]; }
            prev[u] = l > 0 && au > 0 ? s : 0;
          }
          for (let j = 0; j < Ll.m; j++) gb[l][j] += delta[j];
          delta = prev;
        }
      }
      // Adam
      step++;
      const c1 = 1 - Math.pow(b1, step), c2 = 1 - Math.pow(b2, step);
      for (let l = 0; l < K; l++) {
        const Ll = L[l];
        for (let k = 0; k < Ll.W.length; k++) {
          const g = gW[l][k] / bs;
          mW[l][k] = b1 * mW[l][k] + (1 - b1) * g; vW[l][k] = b2 * vW[l][k] + (1 - b2) * g * g;
          Ll.W[k] -= lr * (mW[l][k] / c1) / (Math.sqrt(vW[l][k] / c2) + eps);
        }
        for (let k = 0; k < Ll.m; k++) {
          const g = gb[l][k] / bs;
          mb[l][k] = b1 * mb[l][k] + (1 - b1) * g; vb[l][k] = b2 * vb[l][k] + (1 - b2) * g * g;
          Ll.b[k] -= lr * (mb[l][k] / c1) / (Math.sqrt(vb[l][k] / c2) + eps);
        }
      }
    }
    const tl = sum / (idx.length * Y[0].length), vl = valid ? loss(valid.X, valid.Y) : null;
    if (onEpoch(ep + 1, tl, vl) === false) break;
  }
  return net;
}

// a trained model as JSON (with the statistics its input needs), and back
export function save(net, st) {
  return { kairotic: "study-32-learn", segs: SEGS, dims: DIMS, stats: st, sizes: net.sizes,
    layers: net.layers.map((l) => ({ W: Array.from(l.W, (v) => +v.toPrecision(5)), b: Array.from(l.b, (v) => +v.toPrecision(5)) })) };
}
export function load(json) {
  if (!json || json.kairotic !== "study-32-learn" || json.dims.join() !== DIMS.join()) throw new Error("not a model of this study");
  const net = { sizes: json.sizes, layers: json.layers.map((l, i) => ({ n: json.sizes[i], m: json.sizes[i + 1], W: Float32Array.from(l.W), b: Float32Array.from(l.b) })) };
  return { net, stats: json.stats };
}
