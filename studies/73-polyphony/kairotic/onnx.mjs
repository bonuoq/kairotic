// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 73 · ONNX models in the browser, for any component (discussion #137): the shape proposed there for
// the API — (api/onnx-session url opts) and (api/onnx-run session inputs) — here as two functions over one worker.
//   const s = await session(url | [url …], {sha256, ep: "wasm" | "webgpu"})
//       → {sid, inputs: [name …], outputs: [name …], ep, url, cached, bytes}
//   const out = await run(s, {name: {data: Float32Array, dims: [..]}})  → {name: {data, dims}}, out.ms
//   await drop(s)
// Every model is downloaded once (Cache Storage); with sha256 it must be that model.

let worker = null, next = 1;
const waiting = new Map();

function call(msg, transfer = []) {
  if (!worker) {
    worker = new Worker(new URL("./onnx-worker.mjs", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.error) w.reject(new Error(e.data.error)); else w.resolve(e.data);
    };
    worker.onerror = (e) => { for (const w of waiting.values()) w.reject(new Error(e.message || "the ONNX worker failed")); waiting.clear(); };
  }
  const id = next++;
  return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); worker.postMessage({ ...msg, id }, transfer); });
}

export async function session(urls, { sha256, ep = "wasm" } = {}) {
  const r = await call({ op: "load", urls: [].concat(urls), sha256, ep });
  delete r.id;
  return r;
}

export async function run(s, feeds) {
  // the inputs are copied, so the caller keeps its arrays
  const fs = {}, transfer = [];
  for (const [k, v] of Object.entries(feeds)) { const data = v.data.slice(); fs[k] = { ...v, data }; transfer.push(data.buffer); }
  const r = await call({ op: "run", sid: s.sid, feeds: fs }, transfer);
  return Object.defineProperty(r.outputs, "ms", { value: r.ms, enumerable: false });
}

export function drop(s) { return call({ op: "drop", sid: s.sid }); }
