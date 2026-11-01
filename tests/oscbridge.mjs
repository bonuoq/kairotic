// SPDX-License-Identifier: MPL-2.0
// The relay's OSC bridge (relay/oscbridge.js, discussion #135): starts the relay with --osc, plays
// SuperCollider with a UDP socket, and checks both ways, the origins, the targets and that GUN's /gun
// still answers. Needs the relay's packages: (cd relay && npm install) && node tests/oscbridge.mjs
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import dgram from "node:dgram";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(new URL("../relay/package.json", import.meta.url));
const WebSocket = require("ws");
const osc = require("./osc.js");

let total = 0; const failed = [];
const is = (what, ok, detail) => { total++; if (!ok) failed.push(what + (detail ? ` — ${detail}` : "")); console.log(`${ok ? "✓" : "✗"} ${what}`); };
const near = (a, b) => Math.abs(a - b) < 1e-3;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the codec ──
{
  const m = { address: "/kairotic/note", args: [60, 261.625, 0.5, "x", true, null, [1, 2, 3]] };
  const b = osc.encode(m), d = osc.decode(b);
  is("codec: a message is a multiple of 4 bytes", b.length % 4 === 0);
  is("codec: types inferred (iffsTNb)", d.types === "iffsTNb");
  is("codec: round trip", JSON.stringify(d.args) === JSON.stringify(m.args));
  const exact = osc.decode(osc.encode({ address: "/d", args: [1.5, 2, 3], types: "dfi" }));
  is("codec: explicit types (d f i)", exact.types === "dfi" && exact.args[0] === 1.5 && exact.args[1] === 2);
  const bundle = osc.messages(osc.decode(osc.encode({ timetag: [3900000000, 5], elements: [{ address: "/a", args: [1] }, { address: "/b", args: ["s"] }] })));
  is("codec: a bundle is its messages, with its timetag", bundle.length === 2 && bundle[0].timetag[0] === 3900000000 && bundle[1].address === "/b");
  // what sclang sends: NetAddr("127.0.0.1", 57121).sendMsg("/freq", 440.0)
  const sc = Buffer.from("2f667265710000002c66000043dc0000", "hex");
  is("codec: reads a message as SuperCollider sends it", JSON.stringify(osc.decode(sc)) === JSON.stringify({ address: "/freq", types: "f", args: [440] }));
  let threw = false; try { osc.encode({ address: "no-slash" }); } catch (e) { threw = true; }
  is("codec: an address without / is refused", threw);
}

// ── the bridge ──
const port = 18765, udpIn = 18121, udpSc = 18120;
const relay = spawn(process.execPath, ["relay/server.js", "--port", port, "--data", mkdtempSync(join(tmpdir(), "radata-")),
  "--osc", "--osc-in", udpIn, "--osc-out", `sc=127.0.0.1:${udpSc}`, "--osc-out", `loop=127.0.0.1:${udpIn}`], { stdio: ["ignore", "pipe", "inherit"] });
let out = "";
relay.stdout.on("data", (d) => { out += d; });
const finish = (code) => { relay.kill(); process.exit(code); };
try {
  for (let i = 0; i < 100 && !/OSC out to/.test(out); i++) await wait(100);
  is("the relay starts with the bridge", /OSC bridge: pages on ws:\/\/localhost:18765\/osc/.test(out), out);

  const sc = dgram.createSocket("udp4");
  const scGot = [];
  sc.on("message", (b, r) => scGot.push({ m: osc.decode(b), from: r }));
  await new Promise((ok) => sc.bind(udpSc, "127.0.0.1", ok));

  const open = (path, origin) => new Promise((ok) => {
    const ws = new WebSocket(`ws://localhost:${port}${path}`, origin ? { origin } : {});
    const frames = [];
    ws.on("message", (d) => frames.push(JSON.parse(String(d))));
    ws.on("open", () => ok({ ws, frames, ok: true }));
    ws.on("error", (e) => ok({ ws, frames, ok: false, error: String(e.message) }));
  });

  const page = await open("/osc", "http://localhost:8000");
  is("a page from localhost connects", page.ok, page.error);
  await wait(100);
  is("it is greeted with the targets", JSON.stringify(page.frames[0]) === JSON.stringify({ hello: { listen: udpIn, targets: ["sc", "loop"] } }));

  page.ws.send(JSON.stringify({ address: "/kairotic/note", args: [60, 261.626, 0.5, 1] }));
  await wait(200);
  const n = scGot[0] && scGot[0].m;
  is("page → SuperCollider: the first target by default", n && n.address === "/kairotic/note" && n.types === "iffi" && n.args[0] === 60 && near(n.args[1], 261.626), JSON.stringify(n));

  sc.send(osc.encode({ timetag: [3900000000, 0], elements: [{ address: "/kairotic/glide", args: [60, 270.5] }, { address: "/x", args: ["hi"] }] }), udpIn, "127.0.0.1");
  await wait(200);
  const g = page.frames.find((f) => f.address === "/kairotic/glide");
  is("SuperCollider → page: a bundle as its messages, with from and timetag",
     g && near(g.args[1], 270.5) && g.from === `127.0.0.1:${udpSc}` && g.timetag[0] === 3900000000 && page.frames.some((f) => f.address === "/x"), JSON.stringify(page.frames));

  page.ws.send(JSON.stringify({ address: "/back", args: [1, "two"], to: "loop" }));
  await wait(200);
  is("a named target (loop: back to the relay's own port)", page.frames.some((f) => f.address === "/back" && f.args[1] === "two"));

  page.ws.send(JSON.stringify({ address: "/x", to: "elsewhere" }));
  page.ws.send(JSON.stringify({ address: "no-slash" }));
  await wait(200);
  is("an unknown target is an error, not a send", page.frames.some((f) => f.error && /elsewhere/.test(f.error)));
  is("a bad message is an error", page.frames.some((f) => f.error && /address/.test(f.error)));
  is("nothing else reached SuperCollider", scGot.length === 1);

  const evil = await open("/osc", "https://evil.example");
  is("a page from another site is refused", !evil.ok);
  const pages = await open("/osc", "https://bonuoq.github.io");
  is("Kairotic Pages is allowed", pages.ok);
  const gun = await open("/gun");
  is("GUN's /gun still answers", gun.ok, gun.error);

  for (const c of [page, pages, gun]) c.ws.close();
  sc.close();
} catch (e) {
  is("no error", false, String(e && e.stack || e));
}
console.log(`\n${total - failed.length} / ${total} pass`);
for (const f of failed) console.log(`✗ ${f}`);
finish(failed.length ? 1 : 0);
