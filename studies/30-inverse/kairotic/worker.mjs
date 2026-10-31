// Study 30 · the bank is made here, away from the page, so the page keeps playing while it grows.
// A classic worker: Meyda's web build (the one features~ loads) puts itself on `self`; the study's
// modules come in with import().

/* global importScripts, Meyda */
const MEYDA_URL = "https://cdn.jsdelivr.net/npm/meyda@5.6.3/dist/web/meyda.min.js";
let lib = null, stop = false;

function ready() {
  if (lib) return lib;
  importScripts(MEYDA_URL);
  lib = import("./dataset.mjs");
  return lib;
}

self.onmessage = async (msg) => {
  const m = msg.data;
  if (m.type === "stop") { stop = true; return; }
  if (m.type !== "make") return;
  stop = false;
  try {
    const D = await ready();
    const M = self.Meyda;
    if (!M) throw new Error("Meyda did not load");
    self.postMessage({ type: "header", header: D.header(m.mode, m.seed, m.n) });
    let batch = [], i = 0;
    const flush = () => { if (batch.length) self.postMessage({ type: "examples", examples: batch, done: i }); batch = []; };
    for (; i < m.n && !stop; ) {
      batch.push(D.example(M, m.seed * 1000003 + i, m.mode));
      i++;
      if (batch.length === 25) {
        flush();
        await new Promise((r) => setTimeout(r, 0)); // lets a "stop" in
      }
    }
    flush();
    self.postMessage({ type: "end", stopped: stop });
  } catch (e) {
    self.postMessage({ type: "error", message: String((e && e.message) || e) });
  }
};
