// SPDX-License-Identifier: MPL-2.0
// Kairotic · OSC bridge: a page cannot speak UDP, so the relay does it for it (discussion #135).
//
//   page ⇄ WebSocket (ws://<relay>/osc, JSON) ⇄ relay ⇄ UDP (OSC) ⇄ SuperCollider, Max, Pd, TouchOSC…
//
// Frames are JSON text. The page sends { address, args, types?, to? } (`to` the name of a target, the
// first when left out); the relay sends what arrives on its UDP port as { address, args, types, from,
// timetag? } (a bundle as its messages, each with the bundle's timetag), and on connecting
// { hello: { listen, targets: [names] } }.
//
// The relay only sends to the targets it was started with (--osc-out), never to an address a page asks
// for, and only takes pages from the origins it was told (--osc-origin): a page on the internet must not
// be able to drive the synth on your machine just because you have the relay running.

"use strict";

const dgram = require("dgram");
const osc = require("./osc.js");

function originAllowed(origin, allowed) {
  if (!origin) return true; // not a browser (a test, a script on this machine)
  return allowed.some((a) => a === "*" || origin === a || origin.startsWith(a + ":"));
}

function parseTarget(s) {
  // name=host:port, host:port or a port alone (on this machine)
  const m = String(s).match(/^(?:([\w.-]+)=)?(?:([^:=]+):)?(\d+)$/);
  if (!m) throw new Error(`--osc-out ${s}: write name=host:port, host:port or a port`);
  const host = m[2] || "127.0.0.1", port = Number(m[3]);
  return { name: m[1] || `${host}:${port}`, host, port };
}

/**
 * Adds the bridge to an http server that may already have other WebSockets on it (GUN's, on /gun).
 * opts: { WebSocketServer, listen (UDP port), bind (address), targets: ["sc=127.0.0.1:57120", …],
 *         origins: ["https://bonuoq.github.io", "http://localhost", …], path ("/osc"), log }
 * Returns { close(), udp, wss, targets, ready } (ready: a promise, the UDP port bound).
 */
function attach(server, opts) {
  const path = opts.path || "/osc";
  const log = opts.log || (() => {});
  const targets = (opts.targets && opts.targets.length ? opts.targets : ["sc=127.0.0.1:57120"]).map(parseTarget);
  const origins = opts.origins || ["https://bonuoq.github.io", "http://localhost", "http://127.0.0.1"];
  const wss = new opts.WebSocketServer({ noServer: true });
  const udp = dgram.createSocket("udp4");

  // every other upgrade keeps going where it went before (GUN), this one path comes here
  const before = server.listeners("upgrade");
  server.removeAllListeners("upgrade");
  server.on("upgrade", (req, socket, head) => {
    const url = (req.url || "").split("?")[0];
    if (url !== path) return before.forEach((l) => l.call(server, req, socket, head));
    if (!originAllowed(req.headers.origin, origins)) {
      log(`osc: refused a page from ${req.headers.origin}`);
      socket.write("HTTP/1.1 403 Forbidden\r\nconnection: close\r\n\r\n");
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ hello: { listen: opts.listen, targets: targets.map((t) => t.name) } }));
    ws.on("message", (data) => {
      let m;
      try {
        m = JSON.parse(String(data));
        const t = m.to ? targets.find((x) => x.name === m.to) : targets[0];
        if (!t) throw new Error(`no target called ${m.to}`);
        const bytes = osc.encode(m.elements ? m : { address: m.address, args: m.args || [], types: m.types });
        udp.send(bytes, t.port, t.host);
      } catch (e) {
        ws.send(JSON.stringify({ error: String(e.message || e), sent: m }));
      }
    });
  });

  udp.on("message", (bytes, rinfo) => {
    let ms;
    try { ms = osc.messages(osc.decode(bytes)); } catch (e) { return log(`osc: unreadable packet from ${rinfo.address}:${rinfo.port}`); }
    const from = `${rinfo.address}:${rinfo.port}`;
    for (const m of ms) {
      const frame = JSON.stringify({ ...m, from });
      for (const c of wss.clients) if (c.readyState === 1) c.send(frame);
    }
  });

  const ready = new Promise((ok, no) => {
    udp.once("error", no);
    udp.bind(opts.listen || 57121, opts.bind || "127.0.0.1", () => ok(udp.address().port));
  });

  return {
    wss, udp, targets, ready,
    close() { for (const c of wss.clients) c.terminate(); wss.close(); try { udp.close(); } catch (e) {} },
  };
}

module.exports = { attach, parseTarget, originAllowed };
