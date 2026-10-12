# Relay de Kairotic

*[English version](README.md)*

Un relay de [GUN](https://gun.eco) para Kairotic Pages: pasa el grafo entre navegadores (salas,
presencia, obras guardadas) y guarda una copia en disco en `radata/`. Ver [docs/pages.es.md](../docs/pages.es.md).

```sh
npm install
npm start                 # ws://localhost:8765/gun
PORT=9000 RADATA=/data/radata npm start
```

Después pon `wss://<tu host>/gun` en `site/config.js` (o abre el sitio con `?peer=wss://<tu host>/gun`).

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
