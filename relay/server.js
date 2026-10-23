#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
// Kairotic · GUN relay
// A small server that passes the GUN graph between the browsers of Kairotic Pages and keeps a copy
// on disk, so a room is there when its people come back. It stores what it is sent: rooms in clear
// (as anyone with the link would see them), solo works encrypted by their owners.
//
//   npx @kairotic/relay [--port 8765] [--data ./radata]      → ws://localhost:8765/gun
//   PORT=… RADATA=… npx @kairotic/relay                       (the same, from the environment)
//
// The page connects with wss://<host>/gun: in its session manager (Relay), with ?peer=… in the
// address, or for a whole site in site/config.js.
const http = require("http");
const path = require("path");

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

server.listen(port, () => {
  console.log(`Kairotic relay on :${port} · data in ${data}`);
  console.log(`  on this machine: ws://localhost:${port}/gun`);
  console.log(`  for others: put it behind TLS and use wss://<your host>/gun (Sessions → Relay in Kairotic)`);
});
