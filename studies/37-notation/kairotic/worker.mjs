// Study 37 · the bank, the realisation and the listening happen here, away from the page. The page compiles
// the voice (faustwasm) and hands over its WebAssembly and its JSON; Meyda is the web build features~ loads.

/* global importScripts */
const MEYDA_URL = "https://cdn.jsdelivr.net/npm/meyda@5.6.3/dist/web/meyda.min.js";
let N = null, play = null, json = null, B = null;

async function ready() {
  if (N) return N;
  importScripts(MEYDA_URL);
  N = await import("./notation.mjs");
  return N;
}
const post = (m, t) => self.postMessage(m, t || []);

self.onmessage = async (msg) => {
  const m = msg.data;
  try {
    const N = await ready();
    if (!self.Meyda) throw new Error("Meyda did not load");
    if (m.type === "dsp") {
      json = m.json;
      play = N.player(m.code, json);
      play([{}]);   // fails here, not later, if the module cannot be played
      B = null;
      const R = N.roles(json), lab = (i) => R.cs[i].label;
      post({ type: "dsp", id: m.id, pitch: R.pitch ? lab(R.pitch.index) : null, gain: R.gain ? lab(R.gain.index) : null,
             timbre: R.timbre.map(lab) });
    } else if (m.type === "bank") {
      if (!play) throw new Error("no voice yet");
      B = N.bank(self.Meyda, play, json, { n: m.n, seed: m.seed || 3,
        onProgress: (done, total) => { if (done % 5 === 0 || done === total) post({ type: "progress", id: m.id, phase: "bank", done, total }); } });
      post({ type: "bank", id: m.id, kept: B.entries.length });
    } else if (m.type === "realize") {
      if (!B) throw new Error("no bank yet");
      const r = N.realize(self.Meyda, play, B, m.target, { passes: m.passes || 3,
        onPass: (done, total, err) => post({ type: "progress", id: m.id, phase: "pass", done, total, score: err.score }) });
      const c = N.constant(self.Meyda, play, B, m.target);
      post({ type: "realized", id: m.id, y: r.y, got: r.got, err: r.err, passes: r.passes, reach: r.reach,
             frames: r.frames.map((f) => ({ ...f })), still: { y: c.y, got: c.got, err: c.err } }, [r.y.buffer, c.y.buffer]);
    } else if (m.type === "curves") {
      post({ type: "curves", id: m.id, curves: N.curves(self.Meyda, m.y) });
    }
  } catch (e) {
    post({ type: "error", id: m.id, message: String((e && e.message) || e), during: m.type });
  }
};
