// Study 32 · everything that takes time happens here, away from the page: making the bank, training the
// network, and the search that listens (it renders and analyses a patch for every step).
// A classic worker: Meyda's web build (the one features~ loads) puts itself on `self`; the study's modules
// come in with import().

/* global importScripts */
const MEYDA_URL = "https://cdn.jsdelivr.net/npm/meyda@5.6.3/dist/web/meyda.min.js";
let mods = null, stop = false, model = null, matcher = null;

function ready() {
  if (mods) return mods;
  importScripts(MEYDA_URL);
  mods = Promise.all([import("./bank.mjs"), import("./learn.mjs"), import("./cmaes.mjs"),
    import("../../30-inverse/kairotic/dataset.mjs"), import("../../30-inverse/kairotic/synth.mjs"), import("./pitch.mjs")])
    .then(([bank, learn, cma, dataset, synth, pitch]) => ({ bank, learn, cma, dataset, synth, pitch }));
  return mods;
}
const tick = () => new Promise((r) => setTimeout(r, 0)); // lets a "stop" in
const post = (m) => self.postMessage(m);

// the descriptor distance between a patch (rendered with a noise of its own) and a target's frames
function distance(M, u, tq) {
  return matcher.dist(matcher.vec(M.dataset.analyse(self.Meyda, M.synth.render(u, 424242))), tq);
}

// the search that listens, from the network's guess; with the pitch YIN heard (p = [0…1 or -1, sure]) it
// is held fixed, at the octave the guess points to, and the search looks for the other nine parameters
function searchFrom(M, guess, p, tq, opts) {
  const f = (u) => distance(M, u, tq);
  if (!p || p[0] < 0) { const r = M.cma.cmaes(f, guess, opts); return { ...r, pitch: null }; }
  const pm = M.pitch.octaveOf(36 + 48 * p[0], 36 + 48 * guess[0]);
  const p01 = Math.min(1, Math.max(0, (pm - 36) / 48));
  const r = M.cma.cmaes((u9) => f([p01, ...u9]), guess.slice(1), opts);
  return { ...r, x: [p01, ...r.x], history: r.history, pitch: pm };
}

self.onmessage = async (msg) => {
  const m = msg.data;
  if (m.type === "stop") { stop = true; return; }
  stop = false;
  try {
    const M = await ready();
    if (!self.Meyda) throw new Error("Meyda did not load");

    if (m.type === "make") {
      post({ type: "header", header: M.bank.header(m.mode, m.seed, m.n) });
      let batch = [], i = 0;
      const left = { silent: 0, click: 0 };
      for (; i < m.n && !stop; ) {
        const e = M.bank.example(self.Meyda, m.seed * 1000003 + i, m.mode);
        left.silent += e.left.silent; left.click += e.left.click;
        delete e.left;
        batch.push(e); i++;
        if (batch.length === 25) { post({ type: "examples", examples: batch, done: i, left }); batch = []; await tick(); }
      }
      if (batch.length) post({ type: "examples", examples: batch, done: i, left });
      post({ type: "made", stopped: stop, left });
    }

    else if (m.type === "train") {
      // m.train / m.valid: examples {u, f}; the statistics come from the training set
      const st = M.learn.stats(m.train);
      const X = m.train.map((e) => M.learn.input(e.f, st, e.p)), Y = m.train.map((e) => e.u);
      const V = { X: m.valid.map((e) => M.learn.input(e.f, st, e.p)), Y: m.valid.map((e) => e.u) };
      const net = M.learn.create([M.learn.INPUT, m.hidden[0], m.hidden[1], 10], m.seed || 1);
      const report = (phase, of) => (ep, tl, vl) => { post({ type: "epoch", phase, epoch: ep, of, train: tl, valid: vl }); return !stop; };
      // 1. guessing the numbers (the parameters)
      M.learn.train(net, X, Y, { epochs: m.epochs, batch: 64, lr: m.lr, seed: m.seed || 1, valid: V, onEpoch: report("numbers", m.epochs) });
      let listens = false;
      if (m.listen && !stop) {
        // 2. imitating the synth: parameters → the pooled descriptors (an easy direction to learn)
        const NP = M.learn.SEGS * 18, D = X.map((x) => x.slice(0, NP)), DV = V.X.map((x) => x.slice(0, NP));
        const imitation = M.learn.create([10, 128, 128, NP], (m.seed || 1) + 1, "linear");
        M.learn.train(imitation, Y, D, { epochs: 40, batch: 64, lr: 2e-3, seed: m.seed || 1, valid: { X: V.Y, Y: DV }, onEpoch: report("imitation", 40) });
        // 3. learning to listen: on through the imitation, its error about how the patch would sound
        if (!stop) {
          M.learn.trainThrough(net, imitation, X, D, Y, { epochs: 15, batch: 64, lr: 1e-3, alpha: 0.3, seed: m.seed || 1,
            valid: { X: V.X, D: DV, Y: V.Y }, onEpoch: report("listening", 15) });
          listens = !stop;
        }
      }
      model = { net, stats: st };
      const saved = M.learn.save(net, st);
      saved.listens = listens;
      post({ type: "trained", model: saved });
    }

    else if (m.type === "bank") {
      // the patches to search among (nearest neighbour) and whose statistics the distance uses: sent once
      matcher = M.dataset.matcher(m.bank);
      post({ type: "banked", n: m.bank.length });
    }

    else if (m.type === "model") {
      model = M.learn.load(m.model);
      post({ type: "loaded" });
    }

    else if (m.type === "guess") {
      // the network's guess for each target, without searching (fast)
      if (!model) throw new Error("no model yet");
      post({ type: "guesses", id: m.id, u: m.targets.map((t) => Array.from(M.learn.predict(model.net, M.learn.input(t.f, model.stats, t.p)))) });
    }

    else if (m.type === "refine") {
      // the search that listens, from a starting patch, towards a target's frames
      if (!matcher) throw new Error("no bank yet");
      const tq = matcher.vec(m.target);
      const r = searchFrom(M, m.from, m.yin ? m.p : null, tq, { budget: m.budget, seed: m.seed || 3,
        onStep: (best, evals) => post({ type: "step", id: m.id, evals, fx: best.fx }) });
      post({ type: "refined", id: m.id, x: r.x, fx: r.fx, f0: r.history[0][1], history: r.history, pitch: r.pitch });
    }

    else if (m.type === "measure") {
      // every way back on n targets set aside: nearest neighbour, network, network + search (all ten
      // parameters), network + YIN + search (the pitch held, nine searched)
      if (!model) throw new Error("no model yet");
      if (!matcher) throw new Error("no bank yet");
      const sum = { nn: [0, 0, 0], net: [0, 0, 0], search: [0, 0, 0], yin: [0, 0, 0], self: [0, 0, 0] };
      const per = { nn: new Array(10).fill(0), net: new Array(10).fill(0), search: new Array(10).fill(0), yin: new Array(10).fill(0) };
      let n = 0;
      for (const e of m.targets) {
        if (stop) break;
        const tq = matcher.vec(e.f), f = (u) => distance(M, u, tq);
        const nn = matcher.nearest(e.f).example.u;
        const net = Array.from(M.learn.predict(model.net, M.learn.input(e.f, model.stats, e.p)));
        const s = M.cma.cmaes(f, net, { budget: m.budget, seed: 3 });
        const y = searchFrom(M, net, e.p, tq, { budget: m.budget, seed: 3 });
        const truth = M.synth.values(e.u).pitch;
        const add = (k, u, fd) => { sum[k][0] += fd; sum[k][1] += M.dataset.paramError(u, e.u); sum[k][2] += Math.abs(M.synth.values(u).pitch - truth); if (per[k]) u.forEach((v, i) => { per[k][i] += Math.abs(v - e.u[i]); }); };
        add("self", e.u, f(e.u)); add("nn", nn, f(nn)); add("net", net, f(net)); add("search", s.x, s.fx); add("yin", y.x, y.fx);
        n++;
        post({ type: "measuring", done: n, of: m.targets.length });
        await tick();
      }
      const avg = (k) => ({ features: sum[k][0] / (n || 1), param: sum[k][1] / (n || 1), pitch: sum[k][2] / (n || 1) });
      post({ type: "measured", n, nn: avg("nn"), net: avg("net"), search: avg("search"), yin: avg("yin"), self: avg("self"),
        perParam: M.synth.PARAMS.map((p, i) => ({ key: p.key, nn: per.nn[i] / (n || 1), net: per.net[i] / (n || 1), search: per.search[i] / (n || 1), yin: per.yin[i] / (n || 1) })) });
    }
  } catch (e) {
    post({ type: "error", message: String((e && e.message) || e), during: m.type });
  }
};
