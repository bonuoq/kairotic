// SPDX-License-Identifier: MPL-2.0
// The relay's rooms (relay/signal.js, discussion #135): starts the relay, joins with three sockets and
// checks welcome, joined, left, messages to one and to all, the clock's pong, and that /gun still
// answers. Needs the relay's packages: (cd relay && npm install) && node tests/signal.mjs
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(new URL("../relay/package.json", import.meta.url));
const WebSocket = require("ws");

let total = 0; const failed = [];
const is = (what, ok, detail) => { total++; if (!ok) failed.push(what + (detail ? ` — ${detail}` : "")); console.log(`${ok ? "✓" : "✗"} ${what}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const port = 18766;
const relay = spawn(process.execPath, ["relay/server.js", "--port", port, "--data", mkdtempSync(join(tmpdir(), "radata-"))],
  { stdio: ["ignore", "pipe", "inherit"] });
let out = ""; relay.stdout.on("data", (d) => { out += d; });

const open = (path) => new Promise((ok) => {
  const ws = new WebSocket(`ws://localhost:${port}${path}`);
  const frames = [];
  ws.on("message", (d) => frames.push(JSON.parse(String(d))));
  ws.on("open", () => ok({ ws, frames, ok: true, send: (m) => ws.send(JSON.stringify(m)) }));
  ws.on("error", (e) => ok({ ws, frames, ok: false, error: String(e.message) }));
});

try {
  for (let i = 0; i < 100 && !/signal: rooms/.test(out); i++) await wait(100);
  is("the relay starts with rooms on /signal", /signal: rooms and a clock/.test(out), out);

  const a = await open("/signal"), b = await open("/signal"), c = await open("/signal");
  is("three pages connect", a.ok && b.ok && c.ok);

  a.send({ ping: 1234.5 });
  await wait(100);
  const pong = a.frames.find((f) => f.pong !== undefined);
  is("ping → pong with the relay's time", pong && pong.pong === 1234.5 && Math.abs(pong.t - Date.now()) < 2000, JSON.stringify(pong));

  a.send({ to: "*", data: 1 });
  await wait(100);
  is("before joining, sending is an error", a.frames.some((f) => /join a room first/.test(f.error || "")));

  a.send({ join: "r1", name: "Ana" });
  await wait(100);
  const wa = a.frames.find((f) => f.welcome);
  is("the first is welcomed alone, with an id", wa && wa.welcome.peers.length === 0 && /^p/.test(wa.welcome.id));
  b.send({ join: "r1", name: "Bo" });
  c.send({ join: "r2" });
  await wait(150);
  const wb = b.frames.find((f) => f.welcome);
  is("the second is welcomed with the first", wb && wb.welcome.peers.length === 1 && wb.welcome.peers[0].name === "Ana");
  is("the first hears that the second joined", a.frames.some((f) => f.joined && f.joined.name === "Bo"));
  is("another room is apart", c.frames.find((f) => f.welcome).welcome.peers.length === 0 && !a.frames.some((f) => f.joined && f.joined.name === ""));

  b.send({ to: wa.welcome.id, data: { sdp: "offer" } });
  a.send({ to: "*", data: { ev: { type: "note" } } });
  await wait(150);
  is("a message to one", a.frames.some((f) => f.from === wb.welcome.id && f.data.sdp === "offer"));
  is("a message to all the others", b.frames.some((f) => f.from === wa.welcome.id && f.data.ev.type === "note"));
  is("not to the sender, nor to another room", !a.frames.some((f) => f.data && f.data.ev) && !c.frames.some((f) => f.from));

  b.ws.close();
  await wait(150);
  is("the first hears that the second left", a.frames.some((f) => f.left === wb.welcome.id));

  const gun = await open("/gun");
  is("GUN's /gun still answers", gun.ok, gun.error);
  for (const s of [a, c, gun]) s.ws.close();
} catch (e) {
  is("no error", false, String(e && e.stack || e));
}
console.log(`\n${total - failed.length} / ${total} pass`);
for (const f of failed) console.log(`✗ ${f}`);
relay.kill();
process.exit(failed.length ? 1 : 0);
