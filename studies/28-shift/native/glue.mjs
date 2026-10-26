// SPDX-License-Identifier: MPL-2.0
// Kairotic · shift (the JavaScript around the WebAssembly of stftPitchShift)
// stftPitchShift by Jürgen Hock, MIT licence: https://github.com/jurihock/stftPitchShift
//
// No Emscripten glue and no fetch: the WebAssembly travels inside this module (base64), so the same file
// works in a page, in a worker and, later, in an AudioWorklet, from jsDelivr or from the page's own folder.
//
//   await ready()                                  compiles it (once)
//   shift(chans, sr, opts) → {chans, ms}           every channel (Float32Array) shifted, as long as before
//   stream(sr, frame, hop) → {process, factors…}   the same, block by block, for real time
//
//   opts.steps      [[seconds [factor …]] …]       factors that change over time (a progression); or
//   opts.factors    [factor …]                     the same factors all the time (default [1])
//   opts.quefrency  ms of the formant lifter       0 = no formant preservation (1 is a good start for voice)
//   opts.timbre     the timbre (formant) factor    1 = unchanged; works only with quefrency > 0
//   opts.frame      STFT frame, a power of 2       1024
//   opts.overlap    frame / hop                    32 (the library's default; 8 is faster, rougher)
//   opts.rms        spectral RMS normalization     false

const WASM_BASE64 = "%WASM%";

const ERRORS = {
  "-1": "the sample rate must be positive",
  "-2": "the frame must be a power of 2 (512, 1024, 2048…)",
  "-3": "the overlap must leave a hop between 1 sample and the whole frame",
  "-4": "quefrency must be 0 or more, and timbre more than 0",
  "-5": "there must be at least one step",
  "-6": "each step needs from 1 to 16 factors",
  "-7": "every factor must be a positive number",
  "-8": "the steps must be in order of time",
};

function bytes(b64) {
  // atob is not in every scope (an AudioWorklet has none): decoded by hand
  const T = new Uint8Array(128);
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < 64; i++) T[A.charCodeAt(i)] = i;
  const n = b64.length, pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const out = new Uint8Array((n * 3) / 4 - pad);
  for (let i = 0, o = 0; i < n; i += 4) {
    const v = (T[b64.charCodeAt(i)] << 18) | (T[b64.charCodeAt(i + 1)] << 12) | (T[b64.charCodeAt(i + 2)] << 6) | T[b64.charCodeAt(i + 3)];
    if (o < out.length) out[o++] = (v >> 16) & 255;
    if (o < out.length) out[o++] = (v >> 8) & 255;
    if (o < out.length) out[o++] = v & 255;
  }
  return out;
}

let module = null, instance = null, compiling = null;

/** The compiled WebAssembly.Module (to hand to a worker or a worklet), once ready() has resolved. */
export function wasmModule() { return module; }

/** Promise of true once the WebAssembly is compiled and instantiated (once). */
export function ready(mod) {
  if (instance) return Promise.resolve(true);
  if (!compiling) {
    // the few WASI calls the C library links are never reached in practice: they answer "not supported"
    const nosys = () => 52;
    const imports = { wasi_snapshot_preview1: { fd_close: nosys, fd_seek: nosys, fd_write: nosys, proc_exit: (c) => { throw new Error("shift: exit " + c); } } };
    compiling = (mod ? Promise.resolve(mod) : WebAssembly.compile(bytes(WASM_BASE64)))
      .then((m) => { module = m; return WebAssembly.instantiate(m, imports); })
      .then((i) => { instance = i; if (i.exports._initialize) i.exports._initialize(); return true; })
      .catch((e) => { compiling = null; throw e; });
  }
  return compiling;
}

/** The version of stftPitchShift inside ("2.0"). */
export function version() {
  if (!instance) return null;
  const v = instance.exports.ks_version();
  return Math.floor(v / 100) + "." + (v % 100);
}

/** [[t [f …]] …] from opts: its steps, or its factors from 0, sorted by time. */
export function stepsOf(opts) {
  const o = opts || {};
  const steps = Array.isArray(o.steps) && o.steps.length ? o.steps : [[0, Array.isArray(o.factors) && o.factors.length ? o.factors : [1]]];
  return steps.map(([t, fs]) => [Number(t) || 0, (Array.isArray(fs) ? fs : [fs]).map(Number)]).sort((a, b) => a[0] - b[0]);
}

/**
 * Every channel of a sound shifted, as long as the original. Synchronous (call ready() first): a minute of
 * mono sound at 48 kHz takes about a second with the default frame and overlap.
 */
export function shift(chans, sr, opts) {
  if (!instance) throw new Error("shift: call ready() first");
  const o = opts || {}, X = instance.exports;
  const frame = o.frame || 1024, hop = Math.max(1, Math.round(frame / (o.overlap || 32)));
  const steps = stepsOf(o);
  const flat = steps.flatMap((s) => s[1]);
  const n = chans.length ? chans[0].length : 0;
  const t0 = (typeof performance !== "undefined" ? performance : Date).now();

  const pIn = X.ks_alloc(n * 4), pOut = X.ks_alloc(n * 4);
  const pT = X.ks_alloc(steps.length * 8), pC = X.ks_alloc(steps.length * 4), pF = X.ks_alloc(flat.length * 8);
  try {
    // the views are made again after every call that may grow the memory
    new Float64Array(X.memory.buffer, pT, steps.length).set(steps.map((s) => s[0]));
    new Int32Array(X.memory.buffer, pC, steps.length).set(steps.map((s) => s[1].length));
    new Float64Array(X.memory.buffer, pF, flat.length).set(flat);
    const out = [];
    for (const c of chans) {
      new Float32Array(X.memory.buffer, pIn, n).set(c);
      const r = X.ks_shift(sr, n, pIn, pOut, frame, hop, (o.quefrency || 0) / 1000, o.timbre || 1, o.rms ? 1 : 0,
                           steps.length, pT, pC, pF);
      if (r !== 0) throw new Error("shift: " + (ERRORS[r] || "error " + r));
      out.push(new Float32Array(X.memory.buffer, pOut, n).slice());
    }
    return { chans: out, ms: Math.round((typeof performance !== "undefined" ? performance : Date).now() - t0) };
  } finally {
    for (const p of [pIn, pOut, pT, pC, pF]) X.ks_free(p);
  }
}

/**
 * A stream for real time (an AudioWorklet): blocks of any length in, as many out, one frame later.
 *   const st = stream(sampleRate, 1024, 128)   frame and hop (frame / overlap)
 *   st.process(input, output)                   two Float32Arrays of the same length
 *   st.factors([1, 1.25, 1.5]) · st.formants(quefrencyMs, timbre, rms) · st.dry(0…1) · st.latency · st.free()
 * Nothing here allocates on the JavaScript side while it runs: the two blocks live in the WebAssembly memory.
 */
export function stream(sr, frame, hop) {
  if (!instance) throw new Error("shift: call ready() first");
  const X = instance.exports;
  const h = X.ks_stream_new(sr, frame, hop);
  if (!h) throw new Error("shift: a stream needs a frame that is a power of 2 and a hop that divides it");
  const BLOCK = 4096;
  const pIn = X.ks_alloc(BLOCK * 4), pOut = X.ks_alloc(BLOCK * 4), pF = X.ks_alloc(16 * 8);
  let vin = null, vout = null;
  const views = () => {
    if (!vin || vin.buffer !== X.memory.buffer) {
      vin = new Float32Array(X.memory.buffer, pIn, BLOCK);
      vout = new Float32Array(X.memory.buffer, pOut, BLOCK);
    }
  };
  return {
    latency: X.ks_stream_latency(h),
    process(input, output) {
      for (let o = 0; o < input.length; o += BLOCK) {
        const n = Math.min(BLOCK, input.length - o);
        views();
        vin.set(n === input.length ? input : input.subarray(o, o + n));
        X.ks_stream_process(h, pIn, pOut, n);
        views();
        output.set(vout.subarray(0, n), o);
      }
    },
    factors(fs) {
      const a = (Array.isArray(fs) ? fs : [fs]).slice(0, 16).map(Number);
      new Float64Array(X.memory.buffer, pF, a.length).set(a);
      const r = X.ks_stream_factors(h, a.length, pF);
      if (r !== 0) throw new Error("shift: " + (ERRORS[r] || "error " + r));
    },
    formants(quefrencyMs, timbre, rms) {
      const r = X.ks_stream_formants(h, (quefrencyMs || 0) / 1000, timbre || 1, rms ? 1 : 0);
      if (r !== 0) throw new Error("shift: " + (ERRORS[r] || "error " + r));
    },
    dry(x) { X.ks_stream_dry(h, Math.max(0, Math.min(1, Number(x) || 0))); },
    free() { X.ks_stream_free(h); for (const p of [pIn, pOut, pF]) X.ks_free(p); },
  };
}

export default { ready, shift, stream, stepsOf, version, wasmModule };
