# Kairotic relay

*[Versión en español](README.es.md)*

A [GUN](https://gun.eco) relay for Kairotic Pages: it passes the graph between browsers (rooms,
presence, saved works) and keeps a copy on disk. Each community can run its own and collaborate
through it: the rooms of one relay are not seen through another. See [docs/pages.md](../docs/pages.md).

```sh
npx @kairotic/relay                          # ws://localhost:8765/gun, data in ./radata
npx @kairotic/relay --port 9000 --data /srv/kairotic
PORT=9000 RADATA=/srv/kairotic npx @kairotic/relay
```

From this folder instead: `npm install && npm start`. Node 18 or later, and git (GUN comes from its
repository, at the commit the page uses).

Then, in Kairotic: **Sessions → Relay**, write `wss://<your host>/gun` and **Use**. The page reloads
syncing through it, and while it is not the site's relay the address and the room links carry it
(`?peer=…`), so whoever you send them to lands on the same relay. For a whole site, put it in
`site/config.js`.

### Where to run it

| | |
|---|---|
| A VPS or a server of your own | `npx @kairotic/relay --data /srv/kairotic` behind a reverse proxy with TLS (Caddy, nginx) |
| Docker | `docker build -t kairotic-relay relay/` · `docker run -p 8765:8765 -v kairotic-radata:/data kairotic-relay` |
| [Fly.io](https://fly.io) | from `relay/`: `fly launch --copy-config`, `fly volumes create radata --size 1`, `fly deploy` ([fly.toml](fly.toml)) |
| [Render](https://render.com/deploy?repo=https://github.com/bonuoq/kairotic) | the button uses [render.yaml](../render.yaml); free instances sleep and lose their disk |
| Railway | a new service from this repository with root directory `relay` (it finds the Dockerfile); add a volume at `/data` |
| Your own computer | `npx @kairotic/relay` and a tunnel with TLS (cloudflared, ngrok) for others to reach it |

## OSC bridge

A page cannot send or receive UDP, so the relay can do it for it: with `--osc` it also answers on
`ws://<host>/osc` and passes [OSC](https://opensoundcontrol.stanford.edu) between the pages and
SuperCollider, Max, Pd, TouchOSC, Open Stage Control… (discussion
[#135](https://github.com/bonuoq/kairotic/discussions/135)). It is meant for **your own machine**:

```sh
npx @kairotic/relay --osc                                  # pages → udp 127.0.0.1:57120 (sclang), udp 57121 → pages
npx @kairotic/relay --osc --osc-out sc=57120 --osc-out max=127.0.0.1:7400 --osc-in 9000
```

| | |
|---|---|
| `--osc-out name=host:port` | where the pages' OSC goes (several allowed; a page picks one by name, the first by default). The relay never sends anywhere else |
| `--osc-in 57121` | the UDP port where OSC arrives for the pages (`--osc-bind 0.0.0.0` to take it from other machines, such as a phone with TouchOSC) |
| `--osc-origin url` | the sites allowed to use the bridge: `https://bonuoq.github.io`, `http://localhost` and `http://127.0.0.1` by default. With `*`, any site you visit could send OSC to your synths |

A page sends JSON frames `{"address": "/x", "args": [1, 2.5, "a"], "types": "ifs", "to": "max"}`
(`types` and `to` optional: an integer is `i`, any other number `f`, a string `s`, `true`/`false`
`T`/`F`) and receives `{"address", "args", "types", "from", "timetag"?}`; a bundle arrives as its
messages. Bytes are made with `osc.js` (OSC 1.0, no dependency).

From `https://bonuoq.github.io` the page reaches `ws://localhost` because browsers treat localhost as
secure; Chrome may first ask to let the site reach devices on your local network. Safari may refuse it:
serve the page from your machine too, or use Chrome or Firefox.

## Notes

- **ws 7.** GUN's server code expects text frames; `ws` 8 delivers Buffers that GUN ignores, so the
  relay accepts connections but passes nothing. `package.json` pins `ws` 7 (also as an override).
- **GUN version.** The same commit as the browser files in `site/vendor/gun/`.
- **Hosting.** Any host that runs a Node process with WebSockets and a writable folder: a small VPS,
  Fly.io, Railway, Render (a free instance sleeps and loses its disk; fine for trying, not for
  keeping works), or a machine at home behind a tunnel. The browser needs `wss://` (TLS) when the
  site is served over https, which these hosts give.
- What the relay keeps: rooms in clear, solo works encrypted by their owners. Back up `radata/`.
