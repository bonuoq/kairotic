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

  // the parameters each page declared, for OSCQuery: ws → Map(address → {type, value, range, description})
  const declared = new Map();
  const params = () => { const all = new Map(); for (const ps of declared.values()) for (const [a, p] of ps) all.set(a, p); return all; };

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ hello: { listen: opts.listen, targets: targets.map((t) => t.name), oscquery: opts.oscquery || null } }));
    ws.on("close", () => declared.delete(ws));
    ws.on("message", (data) => {
      let m;
      try {
        m = JSON.parse(String(data));
        if (Array.isArray(m.declare)) {
          const ps = new Map();
          for (const p of m.declare) if (p && typeof p.address === "string" && p.address[0] === "/") ps.set(p.address, p);
          return declared.set(ws, ps);
        }
        if (m.value && typeof m.value.address === "string") {
          const p = declared.has(ws) && declared.get(ws).get(m.value.address);
          if (p) p.value = m.value.value;
          return;
        }
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
      // a declared parameter set from outside keeps its new value (what OSCQuery shows)
      for (const ps of declared.values()) if (ps.has(m.address) && m.args.length) ps.get(m.address).value = m.args[0];
      const frame = JSON.stringify({ ...m, from });
      for (const c of wss.clients) if (c.readyState === 1) c.send(frame);
    }
  });

  const ready = new Promise((ok, no) => {
    udp.once("error", no);
    udp.bind(opts.listen || 57121, opts.bind || "127.0.0.1", () => ok(udp.address().port));
  });

  return {
    wss, udp, targets, ready, params, oscPort: () => udp.address().port,
    close() { for (const c of wss.clients) c.terminate(); wss.close(); try { udp.close(); } catch (e) {} },
  };
}

// ── OSCQuery ──
// Pages say which of their parameters other tools may see and set: { declare: [{ address, type, value,
// range: [min, max], description }] } (type an OSC type tag: f i s T…; T for a boolean), and later
// { value: { address, value } } when one changes. The relay publishes them all as an OSCQuery tree over
// HTTP (GET / for the tree, /?HOST_INFO for how to reach it, /a/b?VALUE for one value), so tools such as
// ossia score, Chataigne or TouchDesigner find them; what those tools send to the relay's OSC port goes to
// the pages, like any OSC, and is kept as the new value. Without mDNS (no dependency), add the relay by
// hand in those tools: http://<host>:<oscquery port>.

const http = require("http");

function oscquery(params, { name, oscPort }) {
  // params: Map(address → {type, value, range, description}) → the tree, with a node for each folder
  const root = { FULL_PATH: "/", CONTENTS: {} };
  for (const [address, p] of [...params].sort(([a], [b]) => a.localeCompare(b))) {
    const parts = address.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      node.CONTENTS = node.CONTENTS || {};
      const full = "/" + parts.slice(0, i + 1).join("/");
      node = node.CONTENTS[part] = node.CONTENTS[part] || { FULL_PATH: full };
    });
    const bool = p.type === "T" || p.type === "F";
    Object.assign(node, {
      TYPE: bool ? "T" : p.type || "f",
      ACCESS: 3,
      VALUE: [bool ? !!p.value : p.value],
      ...(p.range ? { RANGE: [{ MIN: p.range[0], MAX: p.range[1] }] } : {}),
      ...(p.description ? { DESCRIPTION: p.description } : {}),
    });
  }
  return {
    tree: root,
    hostInfo: { NAME: name, OSC_PORT: oscPort, OSC_TRANSPORT: "UDP",
                EXTENSIONS: { ACCESS: true, VALUE: true, RANGE: true, TYPE: true, DESCRIPTION: true } },
  };
}

function find(tree, path) {
  if (path === "/" || path === "") return tree;
  let node = tree;
  for (const part of path.split("/").filter(Boolean)) {
    node = node.CONTENTS && node.CONTENTS[part];
    if (!node) return null;
  }
  return node;
}

/** Serves the pages' parameters as OSCQuery on its own HTTP port. Returns { server, ready, close }. */
function serveQuery(bridge, { port, bind, name }) {
  const server = http.createServer((req, res) => {
    const [path, query] = (req.url || "/").split("?");
    const { tree, hostInfo } = oscquery(bridge.params(), { name, oscPort: bridge.oscPort() });
    const reply = (code, body) => {
      res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    if (query === "HOST_INFO") return reply(200, hostInfo);
    const node = find(tree, decodeURIComponent(path));
    if (!node) return reply(404);
    if (query) return query in node ? reply(200, { [query]: node[query] }) : reply(204);
    reply(200, node);
  });
  const ready = new Promise((ok, no) => { server.once("error", no); server.listen(port, bind, () => ok(server.address().port)); });
  return { server, ready, close() { server.close(); } };
}

module.exports = { attach, parseTarget, originAllowed, oscquery, serveQuery };
