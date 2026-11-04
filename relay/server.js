#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
// Kairotic · GUN relay
// A small server that passes the GUN graph between the browsers of Kairotic Pages and keeps a copy
// on disk, so a room is there when its people come back. It stores what it is sent: rooms in clear
// (as anyone with the link would see them), solo works encrypted by their owners.
//
//   npx @kairotic/relay [--port 8765] [--data ./radata]      → ws://localhost:8765/gun
//   PORT=… RADATA=… npx @kairotic/relay                       (the same, from the environment)
//   npx @kairotic/relay --osc [--osc-out sc=127.0.0.1:57120]   also ws://localhost:8765/osc, an OSC bridge
//                                                              (see oscbridge.js)
//   ws://localhost:8765/signal                                 rooms for WebRTC and a shared clock
//                                                              (see signal.js; --no-signal turns it off)
//
// The page connects with wss://<host>/gun: in its session manager (Relay), with ?peer=… in the
// address, or for a whole site in site/config.js.
const http = require("http");
const path = require("path");

// every value of an option given several times, or as a comma-separated list
function options(name) {
  const args = process.argv.slice(2), out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--" + name) out.push(args[i + 1]);
    else if (args[i].startsWith("--" + name + "=")) out.push(args[i].slice(name.length + 3));
  }
  return out.flatMap((v) => String(v).split(",")).map((v) => v.trim()).filter(Boolean);
}

function option(name, short) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--" + name || (short && a === "-" + short)) return args[i + 1];
    if (a.startsWith("--" + name + "=")) return a.slice(name.length + 3);
  }
  return undefined;
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log([
    "Kairotic relay: passes works and rooms between the browsers of Kairotic Pages, and keeps a copy.",
    "",
    "  npx @kairotic/relay [--port 8765] [--data ./radata]",
    "",
    "  --port, -p   where it listens (or PORT; 8765)",
    "  --data, -d   the folder where it keeps the graph (or RADATA; ./radata). Back it up.",
    "",
    "  --no-signal  no rooms on /signal (where pages open direct channels to each other and agree on a clock)",
    "",
    "  OSC bridge, for SuperCollider, Max, Pd, TouchOSC… on this machine (off unless --osc):",
    "  --osc               pages connect to ws://<this host>:<port>/osc",
    "  --osc-in 57121      the UDP port where OSC arrives, for the pages",
    "  --osc-bind 127.0.0.1  the address it listens on (0.0.0.0 to take OSC from other machines)",
    "  --osc-out name=host:port  where the pages' OSC goes; several allowed, the first by default",
    "                      (sc=127.0.0.1:57120: SuperCollider's sclang)",
    "  --oscquery 5678     the HTTP port where the pages' parameters are published as OSCQuery (0: none)",
    "  --osc-origin url    the pages allowed to use it (https://bonuoq.github.io, http://localhost,",
    "                      http://127.0.0.1 by default; * for any — then any site you visit can send OSC)",
    "",
    "Then, in Kairotic: Sessions → Relay → wss://<this host>/gun (ws://localhost:<port>/gun on this machine).",
  ].join("\n"));
  process.exit(0);
}

const port = Number(option("port", "p") || process.env.PORT) || 8765;
const data = path.resolve(option("data", "d") || process.env.RADATA || "radata");
const Gun = require("gun");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*" });
  res.end("Kairotic GUN relay · connect with wss://<this host>/gun\n");
});

Gun({ web: server, file: data, axe: false, multicast: false });

const osc = process.argv.includes("--osc") || options("osc-out").length > 0;

const signal = !process.argv.includes("--no-signal");

server.listen(port, () => {
  console.log(`Kairotic relay on :${port} · data in ${data}`);
  const { WebSocketServer, Server } = require("ws");
  if (signal) {
    // after GUN has its WebSocket on the server: /signal comes here, the rest goes on to GUN
    require("./signal.js").attach(server, { WebSocketServer: WebSocketServer || Server, log: console.log });
  }
  if (osc) {
    // the bridge takes only /osc and passes the rest on
    const bridge = require("./oscbridge.js").attach(server, {
      WebSocketServer: WebSocketServer || Server,
      listen: Number(option("osc-in")) || 57121,
      bind: option("osc-bind") || "127.0.0.1",
      targets: options("osc-out"),
      origins: options("osc-origin").length ? options("osc-origin") : undefined,
      oscquery: option("oscquery") === "0" ? null : Number(option("oscquery")) || 5678,
      log: console.log,
    });
    const qport = option("oscquery") === "0" ? 0 : Number(option("oscquery")) || 5678;
    if (qport) {
      const { serveQuery } = require("./oscbridge.js");
      bridge.ready.then(() => serveQuery(bridge, { port: qport, bind: option("osc-bind") || "127.0.0.1", name: "Kairotic" }).ready)
        .then((p) => console.log(`              OSCQuery: http://localhost:${p} (add it by hand in ossia score, Chataigne…)`),
              (e) => console.error(`  OSCQuery: could not listen on ${qport}: ${e.message}`));
    }
    bridge.ready.then((p) => {
      console.log(`  OSC bridge: pages on ws://localhost:${port}/osc · OSC in on udp ${option("osc-bind") || "127.0.0.1"}:${p}`);
      console.log(`              OSC out to ${bridge.targets.map((t) => `${t.name} (${t.host}:${t.port})`).join(", ")}`);
    }, (e) => { console.error(`  OSC bridge: could not listen on udp: ${e.message}`); process.exit(1); });
  }
  console.log(`  on this machine: ws://localhost:${port}/gun`);
  console.log(`  for others: put it behind TLS and use wss://<your host>/gun (Sessions → Relay in Kairotic)`);
});
