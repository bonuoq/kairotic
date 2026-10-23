# Relay de Kairotic

*[English version](README.md)*

Un relay de [GUN](https://gun.eco) para Kairotic Pages: pasa el grafo entre navegadores (salas,
presencia, obras guardadas) y guarda una copia en disco. Cada comunidad puede tener el suyo y
colaborar a través de él: las salas de un relay no se ven desde otro. Ver [docs/pages.es.md](../docs/pages.es.md).

```sh
npx @kairotic/relay                          # ws://localhost:8765/gun, datos en ./radata
npx @kairotic/relay --port 9000 --data /srv/kairotic
PORT=9000 RADATA=/srv/kairotic npx @kairotic/relay
```

Desde esta carpeta: `npm install && npm start`. Node 18 o posterior, y git (GUN viene de su
repositorio, en el commit que usa la página).

Después, en Kairotic: **Sessions → Relay**, escribe `wss://<tu host>/gun` y **Use**. La página se
recarga sincronizando a través de él, y mientras no sea el relay del sitio la dirección y los enlaces a
salas lo llevan (`?peer=…`), así que quien los recibe llega al mismo relay. Para todo un sitio, ponlo en
`site/config.js`.

### Dónde ejecutarlo

| | |
|---|---|
| Un VPS o un servidor propio | `npx @kairotic/relay --data /srv/kairotic` detrás de un proxy inverso con TLS (Caddy, nginx) |
| Docker | `docker build -t kairotic-relay relay/` · `docker run -p 8765:8765 -v kairotic-radata:/data kairotic-relay` |
| [Fly.io](https://fly.io) | desde `relay/`: `fly launch --copy-config`, `fly volumes create radata --size 1`, `fly deploy` ([fly.toml](fly.toml)) |
| [Render](https://render.com/deploy?repo=https://github.com/bonuoq/kairotic) | el botón usa [render.yaml](../render.yaml); las instancias gratuitas se duermen y pierden el disco |
| Railway | un servicio nuevo desde este repositorio con directorio raíz `relay` (encuentra el Dockerfile); añade un volumen en `/data` |
| Tu ordenador | `npx @kairotic/relay` y un túnel con TLS (cloudflared, ngrok) para que otros lleguen |

## Notas

- **ws 7.** El código de servidor de GUN espera tramas de texto; `ws` 8 entrega Buffers que GUN
  ignora, así que el relay acepta conexiones pero no pasa nada. `package.json` fija `ws` 7 (también
  como override).
- **Versión de GUN.** El mismo commit que los archivos de navegador de `site/vendor/gun/`.
- **Alojamiento.** Cualquier host que ejecute un proceso Node con WebSockets y una carpeta escribible:
  un VPS pequeño, Fly.io, Railway, Render (una instancia gratuita se duerme y pierde el disco; vale
  para probar, no para guardar obras), o un ordenador en casa detrás de un túnel. El navegador
  necesita `wss://` (TLS) cuando el sitio se sirve por https, y estos hosts lo dan.
- Qué guarda el relay: las salas en claro, las obras solo cifradas por sus dueños. Haz copia de `radata/`.
