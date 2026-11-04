// SPDX-License-Identifier: MPL-2.0
// Kairotic · signal: rooms where pages find each other and a clock they can agree on (discussion #135).
//
// GUN keeps the state of a work (its history). Gestures are a stream: a knob moved from a phone must not
// become a hundred events of the history. Pages send that stream to each other directly, over WebRTC
// data channels; to open them they need to exchange a few messages first (offers, answers, network
// candidates), and this is where they do it. While a direct channel is not open, the relay passes the
// stream itself, so it always arrives.
//
// JSON frames on ws://<relay>/signal:
//   page → relay  {join: "room", name?}            relay → page  {welcome: {id, peers: [{id, name}]}}
//                                                   relay → the others {joined: {id, name}}
//   page → relay  {to: id | "*", data}              relay → them  {from: id, data}
//   page → relay  {ping: t0}                        relay → page  {pong: t0, t: the relay's time in ms}
//                                                   relay → the others, when one goes {left: id}
// The relay keeps nothing: a room exists while someone is in it.

"use strict";

const { performance } = require("perf_hooks");

// the relay's time: milliseconds since 1970, with the resolution of performance.now()
const now = () => performance.timeOrigin + performance.now();

function attach(server, opts) {
  const path = opts.path || "/signal";
  const log = opts.log || (() => {});
  const maxRoom = opts.maxRoom || 64;
  const wss = new opts.WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
  const rooms = new Map(); // room → Map(id → ws)
  let next = 1;

  const before = server.listeners("upgrade");
  server.removeAllListeners("upgrade");
  server.on("upgrade", (req, socket, head) => {
    if ((req.url || "").split("?")[0] !== path) return before.forEach((l) => l.call(server, req, socket, head));
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };

  wss.on("connection", (ws) => {
    const id = "p" + (next++).toString(36);
    let room = null, name = "";

    ws.on("message", (raw) => {
      let m;
      try { m = JSON.parse(String(raw)); } catch (e) { return send(ws, { error: "not JSON" }); }
      if (m.ping !== undefined) return send(ws, { pong: m.ping, t: now() });
      if (m.join !== undefined) {
        if (room) return send(ws, { error: "already in a room" });
        const r = String(m.join).slice(0, 120);
        const members = rooms.get(r) || new Map();
        if (members.size >= maxRoom) return send(ws, { error: `the room is full (${maxRoom})` });
        room = r; name = String(m.name || "").slice(0, 60);
        ws.kairotic = { id, name };
        send(ws, { welcome: { id, room, peers: [...members.values()].map((o) => o.kairotic) } });
        for (const o of members.values()) send(o, { joined: { id, name } });
        members.set(id, ws); rooms.set(r, members);
        return;
      }
      if (m.to !== undefined) {
        if (!room) return send(ws, { error: "join a room first" });
        const members = rooms.get(room);
        const frame = { from: id, data: m.data };
        if (m.to === "*") { for (const [oid, o] of members) if (oid !== id) send(o, frame); }
        else if (members.has(m.to)) send(members.get(m.to), frame);
        else send(ws, { error: `no ${m.to} in the room` });
        return;
      }
      send(ws, { error: "join, to or ping" });
    });

    ws.on("close", () => {
      if (!room) return;
      const members = rooms.get(room);
      members.delete(id);
      if (members.size === 0) rooms.delete(room);
      else for (const o of members.values()) send(o, { left: id });
    });
  });

  log(`  signal: rooms and a clock on ws://<this host>${path}`);
  return { wss, rooms, close() { for (const c of wss.clients) c.terminate(); wss.close(); } };
}

module.exports = { attach, now };
