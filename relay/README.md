# Kairotic relay

*[Versión en español](README.es.md)*

A [GUN](https://gun.eco) relay for Kairotic Pages: it passes the graph between browsers (rooms,
presence, saved works) and keeps a copy on disk in `radata/`. See [docs/pages.md](../docs/pages.md).

```sh
npm install
npm start                 # ws://localhost:8765/gun
PORT=9000 RADATA=/data/radata npm start
```

Then put `wss://<your host>/gun` in `site/config.js` (or open the site with `?peer=wss://<your host>/gun`).

## Notes

- **ws 7.** GUN's server code expects text frames; `ws` 8 delivers Buffers that GUN ignores, so the
  relay accepts connections but passes nothing. `package.json` pins `ws` 7 (also as an override).
- **GUN version.** The same commit as the browser files in `site/vendor/gun/`.
- **Hosting.** Any host that runs a Node process with WebSockets and a writable folder: a small VPS,
  Fly.io, Railway, Render (a free instance sleeps and loses its disk; fine for trying, not for
  keeping works), or a machine at home behind a tunnel. The browser needs `wss://` (TLS) when the
  site is served over https, which these hosts give.
- What the relay keeps: rooms in clear, solo works encrypted by their owners. Back up `radata/`.
