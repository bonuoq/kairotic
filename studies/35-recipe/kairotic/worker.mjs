// Study 35 · the rendering and the search happen here, away from the page. The page compiles the code
// (faustwasm) and hands over its WebAssembly and its JSON; this worker renders it as many times as the
// search asks, and listens with Meyda's web build (the one features~ loads).

/* global importScripts */
const MEYDA_URL = "https://cdn.jsdelivr.net/npm/meyda@5.6.3/dist/web/meyda.min.js";
let mods = null, render = null, json = null;

function ready() {
  if (mods) return mods;
  importScripts(MEYDA_URL);
  mods = Promise.all([import("./render.mjs"), import("./fit.mjs"), import("../../30-inverse/kairotic/synth.mjs"),
    import("../../32-learn/kairotic/bank.mjs")]).then(([r, f, synth, bank]) => ({ r, f, synth, bank }));
  return mods;
}
const post = (m, t) => self.postMessage(m, t || []);

self.onmessage = async (msg) => {
  const m = msg.data;
  try {
    const M = await ready();
    if (!self.Meyda) throw new Error("Meyda did not load");
    if (m.type === "dsp") {
      json = m.json;
      render = M.r.renderer(m.code, m.json);
      render({}, { dur: 0.05 });   // fails here, not later, if the module cannot be played
      post({ type: "dsp", id: m.id, sliders: M.f.sliders(json) });
    } else if (m.type === "random") {
      // a setting of this code that sounds, drawn from a seed (its truth is known)
      if (!render) throw new Error("no code yet");
      const cs = M.f.sliders(json);
      let a = m.seed >>> 0;
      const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      for (let k = 0; k < 50; k++) {
        const u = cs.map((c) => (/^noise$/i.test(c.label) ? 0.3 * r() : r()));
        const y = render(M.f.valuesOf(cs, u));
        let peak = 0; for (const v of y) peak = Math.max(peak, Math.abs(v));
        if (peak > 0.02) { post({ type: "target", id: m.id, y, u, values: M.f.valuesOf(cs, u) }, [y.buffer]); return; }
      }
      throw new Error("no setting of this code that sounds in 50 draws");
    } else if (m.type === "synth") {
      // a patch of Study 30's synth (in JS): the Faust twin can only come near it
      const e = M.bank.example(self.Meyda, m.seed, "plausible");
      const y = M.synth.render(e.u, e.seed);
      post({ type: "target", id: m.id, y, values: M.synth.values(e.u) }, [y.buffer]);
    } else if (m.type === "fit") {
      if (!render) throw new Error("no code yet");
      const r = M.f.fit(self.Meyda, render, json, m.y, { bank: m.bank, budget: m.budget, seed: m.seed || 1,
        onProgress: (phase, done, total, best) => post({ type: "progress", id: m.id, phase, done, total, best }) });
      const y = render(r.values);
      post({ type: "fitted", id: m.id, values: r.values, u: r.u, fx: r.fx, nearestFx: r.nearestFx, pitch: r.pitch, history: r.history, y }, [y.buffer]);
    } else if (m.type === "render") {
      const y = render(m.values);
      post({ type: "rendered", id: m.id, y }, [y.buffer]);
    } else if (m.type === "frames") {
      // descriptors of a sound, for the plots (as features~)
      const { analyse } = await import("../../30-inverse/kairotic/dataset.mjs");
      post({ type: "frames", id: m.id, f: analyse(self.Meyda, m.y) });
    }
  } catch (e) {
    post({ type: "error", id: m.id, message: String((e && e.message) || e), during: m.type });
  }
};
