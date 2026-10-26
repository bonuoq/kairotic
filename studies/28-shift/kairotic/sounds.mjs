// SPDX-License-Identifier: MPL-2.0
// Kairotic · sounds (the native part of kairotic/sounds.cljs)
// Recorded or loaded sound is too big for the history: it is kept in this browser (IndexedDB), by the
// hash of its samples, and the history keeps only {:audio hash :sr :frames :channels :peaks}. The loops
// over samples live here, in JavaScript, not in the interpreted ClojureScript of the page.

const DB = "kairotic-sounds", STORE = "sounds";

/** One Float32Array from blocks (Float32Arrays) in order, at most `max` samples. */
function concat(blocks, max) {
  let n = 0;
  for (const b of blocks) n += b.length;
  if (typeof max === "number" && max >= 0) n = Math.min(n, max);
  const out = new Float32Array(n);
  let o = 0;
  for (const b of blocks) {
    if (o >= n) break;
    const k = Math.min(b.length, n - o);
    out.set(k === b.length ? b : b.subarray(0, k), o);
    o += k;
  }
  return out;
}

/** The largest absolute value of a Float32Array. */
function peak(f) {
  let p = 0;
  for (let i = 0; i < f.length; i++) { const a = f[i] < 0 ? -f[i] : f[i]; if (a > p) p = a; }
  return p;
}

/** n columns [min, max] over every channel, rounded to 2 decimals: the picture of a sound. */
function peaks(chans, n) {
  const frames = chans.length ? chans[0].length : 0, out = [];
  if (!frames) return out;
  n = Math.max(1, Math.min(n | 0 || 200, frames));
  for (let k = 0; k < n; k++) {
    const a = Math.floor(k * frames / n), b = Math.max(a + 1, Math.floor((k + 1) * frames / n));
    let lo = Infinity, hi = -Infinity;
    for (const c of chans) for (let i = a; i < b; i++) { const x = c[i]; if (x < lo) lo = x; if (x > hi) hi = x; }
    out.push([Math.round(lo * 100) / 100, Math.round(hi * 100) / 100]);
  }
  return out;
}

/** Promise of the hash of a sound (its sample rate and samples): 32 hex characters of SHA-256. */
async function hash(chans, sr) {
  const head = new Float64Array([sr, chans.length]);
  const parts = [new Uint8Array(head.buffer)];
  for (const c of chans) parts.push(new Uint8Array(c.buffer, c.byteOffset, c.byteLength));
  const total = parts.reduce((s, p) => s + p.length, 0), bytes = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { bytes.set(p, o); o += p.length; }
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(d.subarray(0, 16), (x) => x.toString(16).padStart(2, "0")).join("");
}

let opening = null;
function db() {
  if (!opening) opening = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("this browser keeps no sounds (no IndexedDB)")); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => { opening = null; reject(r.error); };
  });
  return opening;
}

/** Keeps a sound under its hash. Promise of true. */
async function put(h, sr, chans) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, "readwrite");
    t.objectStore(STORE).put({ sr, chans }, h);
    t.oncomplete = () => resolve(true);
    t.onerror = () => reject(t.error);
  });
}

/** Promise of the sound kept under a hash ({sr, chans}), or null if this browser does not have it. */
async function get(h) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE, "readonly").objectStore(STORE).get(h);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

/** A WAV file (16-bit PCM) of a sound, as a Blob. */
function wav(chans, sr) {
  const C = chans.length, n = C ? chans[0].length : 0, bytes = 44 + n * C * 2;
  const v = new DataView(new ArrayBuffer(bytes));
  const s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  s(0, "RIFF"); v.setUint32(4, bytes - 8, true); s(8, "WAVE"); s(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, C, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * C * 2, true); v.setUint16(32, C * 2, true); v.setUint16(34, 16, true);
  s(36, "data"); v.setUint32(40, n * C * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < C; c++) {
    const x = Math.max(-1, Math.min(1, chans[c][i]));
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
  }
  return new Blob([v.buffer], { type: "audio/wav" });
}

export default { concat, peak, peaks, hash, put, get, wav };
