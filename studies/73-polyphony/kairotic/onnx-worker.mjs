// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 73 · ONNX models off the main thread (discussion #137): ONNX Runtime Web, loaded once from
// jsDelivr, runs the sessions here so the page does not stop while a model thinks. Messages:
//   {op: "load", id, urls: [url …], sha256?, ep?}  →  {id, sid, inputs, outputs, ep, url, cached, bytes}
//   {op: "run", id, sid, feeds: {name: {data, dims, type?}}}  →  {id, outputs: {name: {data, dims}}, ms}
//   {op: "drop", id, sid}  →  {id}
//   any error  →  {id, error}
// A model is fetched once and kept in Cache Storage ("kairotic-onnx"), by its URL; with sha256 its bytes are checked
// (a model that is not the one asked for is refused and forgotten).
export const ORT_VERSION = "1.20.1";
const ORT = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

let ort = null, bundle = null;
async function runtime(ep) {
  const want = ep === "webgpu" && self.navigator && navigator.gpu ? "ort.webgpu.min.mjs" : "ort.min.mjs";
  if (ort) return ort;                         // a worker keeps the first runtime it loaded
  ort = await import(ORT + want);
  bundle = want;
  ort.env.wasm.wasmPaths = ORT;
  // threads need a cross-origin isolated page; GitHub Pages and claude.ai are not, so one thread there
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  return ort;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function bytes(url, sha256) {
  let cache = null;
  // a file dropped in (blob:) is not cached; nor anything where there is no Cache Storage (an opaque origin)
  if (/^https?:/.test(url)) try { cache = await caches.open("kairotic-onnx"); } catch (e) { cache = null; }
  let res = cache && await cache.match(url), cached = !!res;
  if (!res) {
    res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    if (cache) await cache.put(url, res.clone()).catch(() => {});
  }
  const buf = await res.arrayBuffer();
  if (sha256) {
    const h = hex(await crypto.subtle.digest("SHA-256", buf));
    if (h !== sha256.toLowerCase()) {
      if (cache) await cache.delete(url).catch(() => {});
      throw new Error(`not the model asked for (SHA-256 ${h.slice(0, 12)}…, expected ${sha256.slice(0, 12)}…): ${url}`);
    }
  }
  return { buf, cached };
}

const sessions = new Map();
let next = 1;

async function load({ urls, sha256, ep }) {
  const o = await runtime(ep);
  const errors = [];
  for (const url of [].concat(urls)) {
    try {
      const { buf, cached } = await bytes(url, sha256);
      let session = null, used = "wasm";
      if (ep === "webgpu" && bundle === "ort.webgpu.min.mjs") {
        try { session = await o.InferenceSession.create(buf, { executionProviders: ["webgpu"] }); used = "webgpu"; } catch (e) { errors.push("webgpu: " + e.message); }
      }
      if (!session) session = await o.InferenceSession.create(buf, { executionProviders: ["wasm"] });
      const sid = next++;
      sessions.set(sid, session);
      return { sid, inputs: [...session.inputNames], outputs: [...session.outputNames], ep: used, url, cached, bytes: buf.byteLength };
    } catch (e) { errors.push(String(e.message || e)); }
  }
  throw new Error("could not load the model: " + errors.join(" · "));
}

async function run({ sid, feeds }) {
  const s = sessions.get(sid);
  if (!s) throw new Error("no such session: " + sid);
  const t0 = performance.now();
  const ins = {};
  for (const [name, { data, dims, type }] of Object.entries(feeds)) ins[name] = new ort.Tensor(type || "float32", data, dims);
  const r = await s.run(ins);
  const outputs = {}, transfer = [];
  for (const [name, t] of Object.entries(r)) {
    const data = t.data instanceof Float32Array ? t.data : Float32Array.from(t.data);
    outputs[name] = { data, dims: [...t.dims] };
    transfer.push(data.buffer);
  }
  return [{ outputs, ms: performance.now() - t0 }, transfer];
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.op === "load") self.postMessage({ id: m.id, ...(await load(m)) });
    else if (m.op === "run") { const [r, transfer] = await run(m); self.postMessage({ id: m.id, ...r }, transfer); }
    else if (m.op === "drop") { const s = sessions.get(m.sid); sessions.delete(m.sid); if (s && s.release) await s.release(); self.postMessage({ id: m.id }); }
    else throw new Error("unknown op: " + m.op);
  } catch (err) {
    self.postMessage({ id: m.id, error: String((err && err.message) || err) });
  }
};
