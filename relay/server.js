// SPDX-License-Identifier: MPL-2.0
// Kairotic · GUN relay
// A small server that passes the GUN graph between the browsers of Kairotic Pages and keeps a copy
// on disk (folder radata/), so a room is there when its people come back. It stores what it is sent:
// rooms in clear (as anyone with the link would see them), solo works encrypted by their owners.
//
//   npm install && npm start          → ws://localhost:8765/gun
//   PORT=… RADATA=… npm start
//
// The page connects with wss://<host>/gun (in site/config.js, or ?peer=… in the address).
const http = require("http");
const Gun = require("gun");

const port = Number(process.env.PORT) || 8765;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("Kairotic GUN relay · connect with wss://<this host>/gun\n");
});

Gun({ web: server, file: process.env.RADATA || "radata", axe: false, multicast: false });

server.listen(port, () => console.log(`Kairotic relay on :${port} (ws path /gun)`));
