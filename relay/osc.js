// SPDX-License-Identifier: MPL-2.0
// Kairotic · OSC 1.0 in plain Node (no dependency): messages and bundles to bytes and back.
//
// A message is { address: "/a/b", args: [1, 2.5, "x"], types: "ifs" }. `types` may be left out: then an
// integer is i (int32), any other number f (float32), a string s, a boolean T/F, null N, a Buffer or
// Uint8Array b. Given, it says exactly: i f d (float64) h (int64) s S b T F N I c t (a timetag).
// A bundle is { timetag, elements: [message or bundle, …] }; a timetag is [seconds since 1900, fraction]
// or 1 (immediately).

"use strict";

function pad4(n) { return (4 - (n % 4)) % 4; }

function str(s) {
  const b = Buffer.from(String(s), "utf8");
  return Buffer.concat([b, Buffer.alloc(1 + pad4(b.length + 1))]);
}

function blob(x) {
  const b = Buffer.from(x);
  const len = Buffer.alloc(4); len.writeInt32BE(b.length);
  return Buffer.concat([len, b, Buffer.alloc(pad4(b.length))]);
}

function timetag(t) {
  const b = Buffer.alloc(8);
  if (t === 1 || t == null) { b.writeUInt32BE(0, 0); b.writeUInt32BE(1, 4); }
  else { b.writeUInt32BE(t[0] >>> 0, 0); b.writeUInt32BE(t[1] >>> 0, 4); }
  return b;
}

function inferType(v) {
  if (typeof v === "number") return Number.isInteger(v) && v >= -2147483648 && v <= 2147483647 ? "i" : "f";
  if (typeof v === "string") return "s";
  if (typeof v === "boolean") return v ? "T" : "F";
  if (v === null || v === undefined) return "N";
  if (typeof v === "bigint") return "h";
  if (v instanceof Uint8Array || Buffer.isBuffer(v) || Array.isArray(v)) return "b";
  throw new Error("OSC: no type for " + JSON.stringify(v));
}

// the types that carry no argument bytes
const NO_DATA = new Set(["T", "F", "N", "I"]);

function encodeMessage({ address, args = [], types }) {
  if (typeof address !== "string" || address[0] !== "/") throw new Error("OSC: an address starts with /");
  const ts = types != null ? String(types) : args.map(inferType).join("");
  const parts = [str(address), str("," + ts)];
  let k = 0;
  for (const t of ts) {
    if (NO_DATA.has(t)) { if (args.length === ts.length) k++; continue; }
    const v = args[k++];
    let b;
    switch (t) {
      case "i": b = Buffer.alloc(4); b.writeInt32BE(Math.trunc(Number(v))); break;
      case "f": b = Buffer.alloc(4); b.writeFloatBE(Number(v)); break;
      case "d": b = Buffer.alloc(8); b.writeDoubleBE(Number(v)); break;
      case "h": b = Buffer.alloc(8); b.writeBigInt64BE(BigInt(v)); break;
      case "c": b = Buffer.alloc(4); b.writeUInt32BE(typeof v === "string" ? v.codePointAt(0) : Number(v)); break;
      case "s": case "S": b = str(v); break;
      case "b": b = blob(v); break;
      case "t": b = timetag(v); break;
      default: throw new Error("OSC: unknown type " + t);
    }
    parts.push(b);
  }
  return Buffer.concat(parts);
}

function encode(p) {
  if (p.elements) {
    const parts = [str("#bundle"), timetag(p.timetag)];
    for (const e of p.elements) {
      const b = encode(e); const len = Buffer.alloc(4); len.writeInt32BE(b.length);
      parts.push(len, b);
    }
    return Buffer.concat(parts);
  }
  return encodeMessage(p);
}

function readStr(buf, i) {
  let end = buf.indexOf(0, i);
  if (end < 0) throw new Error("OSC: an unterminated string");
  const s = buf.toString("utf8", i, end);
  return [s, end + 1 + pad4(end + 1 - i)];
}

function decode(buf, at = 0, end = buf.length) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  const [head, i0] = readStr(buf, at);
  if (head === "#bundle") {
    const t = [buf.readUInt32BE(i0), buf.readUInt32BE(i0 + 4)];
    const elements = [];
    let i = i0 + 8;
    while (i < end) {
      const len = buf.readInt32BE(i);
      elements.push(decode(buf, i + 4, i + 4 + len));
      i += 4 + len;
    }
    return { timetag: t[0] === 0 && t[1] === 1 ? 1 : t, elements };
  }
  if (head[0] !== "/") throw new Error("OSC: not a message or bundle");
  let [ts, i] = i0 < end ? readStr(buf, i0) : [",", i0];
  if (ts[0] !== ",") throw new Error("OSC: no type tag string");
  ts = ts.slice(1);
  const args = [];
  for (const t of ts) {
    switch (t) {
      case "i": args.push(buf.readInt32BE(i)); i += 4; break;
      case "f": args.push(Math.fround(buf.readFloatBE(i))); i += 4; break;
      case "d": args.push(buf.readDoubleBE(i)); i += 8; break;
      case "h": { const v = buf.readBigInt64BE(i); args.push(Number.isSafeInteger(Number(v)) ? Number(v) : String(v)); i += 8; break; }
      case "c": args.push(String.fromCodePoint(buf.readUInt32BE(i))); i += 4; break;
      case "s": case "S": { const [s, j] = readStr(buf, i); args.push(s); i = j; break; }
      case "b": { const n = buf.readInt32BE(i); args.push(Array.from(buf.subarray(i + 4, i + 4 + n))); i += 4 + n + pad4(n); break; }
      case "t": args.push([buf.readUInt32BE(i), buf.readUInt32BE(i + 4)]); i += 8; break;
      case "T": args.push(true); break;
      case "F": args.push(false); break;
      case "N": args.push(null); break;
      case "I": args.push("Infinity"); break;
      default: throw new Error("OSC: unknown type " + t);
    }
  }
  return { address: head, types: ts, args };
}

// Every message of a packet, a bundle's messages with the bundle's timetag
function messages(p, t) {
  if (p.elements) return p.elements.flatMap((e) => messages(e, p.timetag));
  return [t && t !== 1 ? { ...p, timetag: t } : p];
}

module.exports = { encode, decode, messages, inferType };
