// Study 32 · a search that listens: CMA-ES on the descriptor distance (discussion #114).
//
// Starting from a guess (the network's, or the nearest neighbour's), it renders candidate patches with the
// real synth, analyses them with Meyda as features~ does, and moves towards the ones whose descriptors come
// closest to the target's. No gradient is needed, so the same search works for any synth, a faust~ too.
// The covariance matrix adaptation evolution strategy (Hansen), in its plain (μ/μ_w, λ) form, in [0, 1]^n
// (candidates outside are clipped), with a seeded generator so a run can be repeated.

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// eigen-decomposition of a symmetric matrix (Jacobi): C = B diag(d) Bᵀ
function eig(C) {
  const n = C.length, A = C.map((r) => r.slice()), V = A.map((_, i) => A.map((_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  return { d: A.map((r, i) => Math.max(1e-20, r[i])), B: V };
}

// minimise f over [0, 1]^n from x0, with step sigma, in at most `budget` evaluations of f.
// onStep(best, evals) after each generation; returns { x, fx, evals, history: [[evals, best fx]…] }
export function cmaes(f, x0, { sigma = 0.15, budget = 120, lambda = 0, seed = 1, onStep = () => {} } = {}) {
  const n = x0.length, r = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
  const lam = lambda || 4 + Math.floor(3 * Math.log(n)), mu = Math.floor(lam / 2);
  let w = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1));
  const ws = w.reduce((a, b) => a + b, 0); w = w.map((x) => x / ws);
  const mueff = 1 / w.reduce((a, b) => a + b * b, 0);
  const cc = (4 + mueff / n) / (n + 4 + (2 * mueff) / n), cs = (mueff + 2) / (n + mueff + 5);
  const c1 = 2 / ((n + 1.3) ** 2 + mueff), cmu = Math.min(1 - c1, (2 * (mueff - 2 + 1 / mueff)) / ((n + 2) ** 2 + mueff));
  const damps = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (n + 1)) - 1) + cs, chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
  const clip = (x) => x.map((v) => Math.min(1, Math.max(0, v)));
  let m = clip(x0.slice()), sig = sigma, pc = new Array(n).fill(0), ps = new Array(n).fill(0);
  let C = m.map((_, i) => m.map((_, j) => (i === j ? 1 : 0))), B = C.map((r) => r.slice()), D = new Array(n).fill(1);
  let best = { x: m.slice(), fx: f(m) }, evals = 1, gen = 0;
  const history = [[evals, best.fx]];
  while (evals + lam <= budget) {
    gen++;
    const pop = [];
    for (let k = 0; k < lam; k++) {
      const z = Array.from({ length: n }, gauss), y = B.map((row) => row.reduce((s, b, j) => s + b * D[j] * z[j], 0));
      const x = clip(m.map((v, i) => v + sig * y[i]));
      const fx = f(x); evals++;
      pop.push({ x, y: x.map((v, i) => (v - m[i]) / sig), fx });
      if (fx < best.fx) best = { x: x.slice(), fx };
    }
    pop.sort((a, b) => a.fx - b.fx);
    const old = m.slice();
    m = m.map((_, i) => pop.slice(0, mu).reduce((s, p, k) => s + w[k] * p.x[i], 0));
    const yw = m.map((v, i) => (v - old[i]) / sig);
    // C^(-1/2) yw
    const Bt_yw = B[0].map((_, j) => B.reduce((s, row, i) => s + row[j] * yw[i], 0));
    const invsq = B.map((row) => row.reduce((s, b, j) => s + (b * Bt_yw[j]) / D[j], 0));
    ps = ps.map((v, i) => (1 - cs) * v + Math.sqrt(cs * (2 - cs) * mueff) * invsq[i]);
    const psn = Math.sqrt(ps.reduce((s, v) => s + v * v, 0));
    const hs = psn / Math.sqrt(1 - Math.pow(1 - cs, 2 * gen)) / chiN < 1.4 + 2 / (n + 1) ? 1 : 0;
    pc = pc.map((v, i) => (1 - cc) * v + hs * Math.sqrt(cc * (2 - cc) * mueff) * yw[i]);
    C = C.map((row, i) => row.map((c, j) => {
      let rank = 0;
      for (let k = 0; k < mu; k++) rank += w[k] * pop[k].y[i] * pop[k].y[j];
      return (1 - c1 - cmu) * c + c1 * (pc[i] * pc[j] + (1 - hs) * cc * (2 - cc) * c) + cmu * rank;
    }));
    sig *= Math.exp((cs / damps) * (psn / chiN - 1));
    sig = Math.min(0.5, Math.max(1e-4, sig));
    const e = eig(C); B = e.B; D = e.d.map(Math.sqrt);
    history.push([evals, best.fx]);
    onStep(best, evals);
  }
  return { x: best.x, fx: best.fx, evals, history };
}
