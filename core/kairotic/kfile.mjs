// SPDX-License-Identifier: MPL-2.0
// Kairotic · a work as a file (discussion #149): the zip container and the sound files of a .kairotic.
// Plain JavaScript, no dependency: a zip of stored and deflated entries (deflate with the browser's
// CompressionStream, where there is one), read back the same way; and sounds as 32-bit float WAV, so the
// samples come back exactly as they were kept (their hash is their key in this browser).

const enc = new TextEncoder();
const dec = new TextDecoder();

// ───── CRC-32 (the zip's) ─────
const table = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function through(bytes, stream) {
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}
const canDeflate = () => typeof CompressionStream !== "undefined";

// ───── zip ─────
// files: [{name, data: Uint8Array | string, deflate?: boolean}] → Promise<Uint8Array>
async function zip(files) {
  const entries = [];
  for (const f of files) {
    const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const name = enc.encode(f.name);
    let body = data, method = 0;
    if (f.deflate !== false && canDeflate() && data.length > 64) {
      const z = await through(data, new CompressionStream("deflate-raw"));
      if (z.length < data.length) { body = z; method = 8; }
    }
    entries.push({ name, data, body, method, crc: crc32(data) });
  }
  const parts = [];
  const central = [];
  let offset = 0;
  const u16 = (v, a, i) => a.setUint16(i, v, true);
  const u32 = (v, a, i) => a.setUint32(i, v >>> 0, true);
  for (const e of entries) {
    const h = new DataView(new ArrayBuffer(30));
    u32(0x04034b50, h, 0); u16(20, h, 4); u16(0x0800, h, 6); u16(e.method, h, 8); u16(0, h, 10); u16(0x21, h, 12);
    u32(e.crc, h, 14); u32(e.body.length, h, 18); u32(e.data.length, h, 22); u16(e.name.length, h, 26); u16(0, h, 28);
    parts.push(new Uint8Array(h.buffer), e.name, e.body);
    const c = new DataView(new ArrayBuffer(46));
    u32(0x02014b50, c, 0); u16(20, c, 4); u16(20, c, 6); u16(0x0800, c, 8); u16(e.method, c, 10); u16(0, c, 12); u16(0x21, c, 14);
    u32(e.crc, c, 16); u32(e.body.length, c, 20); u32(e.data.length, c, 24); u16(e.name.length, c, 28);
    u16(0, c, 30); u16(0, c, 32); u16(0, c, 34); u16(0, c, 36); u32(0, c, 38); u32(offset, c, 42);
    central.push(new Uint8Array(c.buffer), e.name);
    offset += 30 + e.name.length + e.body.length;
  }
  const size = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  u32(0x06054b50, end, 0); u16(0, end, 4); u16(0, end, 6); u16(entries.length, end, 8); u16(entries.length, end, 10);
  u32(size, end, 12); u32(offset, end, 16); u16(0, end, 20);
  return new Uint8Array(await new Blob([...parts, ...central, new Uint8Array(end.buffer)]).arrayBuffer());
}

// bytes → Promise<[{name, data: Uint8Array}]> (stored and deflated entries; the CRC is checked)
async function unzip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = bytes.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not a zip file");
  const n = v.getUint16(e + 10, true);
  let p = v.getUint32(e + 16, true);
  const files = [];
  for (let i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("a broken zip file");
    const method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true);
    const csize = v.getUint32(p + 20, true), size = v.getUint32(p + 24, true);
    const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const body = bytes.subarray(start, start + csize);
    let data;
    if (method === 0) data = body.slice();
    else if (method === 8) {
      if (typeof DecompressionStream === "undefined") throw new Error("this browser cannot read deflated zip entries");
      data = await through(body, new DecompressionStream("deflate-raw"));
    } else throw new Error("zip method " + method + " is not supported (" + name + ")");
    if (data.length !== size || crc32(data) !== crc) throw new Error("a damaged entry in the file: " + name);
    files.push({ name, data });
    p += 46 + nlen + xlen + clen;
  }
  return files;
}

// ───── sounds: 32-bit float WAV ─────
// (sample rate, [Float32Array per channel]) → Uint8Array
function wav(sr, chans) {
  const nc = chans.length, frames = nc ? chans[0].length : 0, bytes = frames * nc * 4;
  const b = new ArrayBuffer(44 + bytes), v = new DataView(b);
  const s = (i, t) => { for (let k = 0; k < t.length; k++) v.setUint8(i + k, t.charCodeAt(k)); };
  s(0, "RIFF"); v.setUint32(4, 36 + bytes, true); s(8, "WAVE");
  s(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, nc, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nc * 4, true); v.setUint16(32, nc * 4, true); v.setUint16(34, 32, true);
  s(36, "data"); v.setUint32(40, bytes, true);
  const out = new Float32Array(b, 44, frames * nc);
  for (let i = 0; i < frames; i++) for (let c = 0; c < nc; c++) out[i * nc + c] = chans[c][i];
  return new Uint8Array(b);
}

// Uint8Array of a float WAV written above → {sr, chans}
function unwav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (i) => String.fromCharCode(v.getUint8(i), v.getUint8(i + 1), v.getUint8(i + 2), v.getUint8(i + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not a WAV file");
  let p = 12, fmt = null, data = null;
  while (p + 8 <= bytes.length) {
    const id = tag(p), len = v.getUint32(p + 4, true);
    if (id === "fmt ") fmt = { format: v.getUint16(p + 8, true), nc: v.getUint16(p + 10, true), sr: v.getUint32(p + 12, true), bits: v.getUint16(p + 22, true) };
    if (id === "data") data = { at: p + 8, len };
    p += 8 + len + (len % 2);
  }
  if (!fmt || !data || fmt.format !== 3 || fmt.bits !== 32) throw new Error("a sound of a .kairotic is a 32-bit float WAV");
  const frames = Math.floor(data.len / (4 * fmt.nc));
  const chans = Array.from({ length: fmt.nc }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < fmt.nc; c++) chans[c][i] = v.getFloat32(data.at + (i * fmt.nc + c) * 4, true);
  return { sr: fmt.sr, chans };
}

const text = (bytes) => dec.decode(bytes);

export default { zip, unzip, wav, unwav, text, crc32 };
