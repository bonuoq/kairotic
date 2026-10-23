# Kairotic fuera de claude.ai (GitHub Pages)

*[English version](pages.md)*

Kairotic es una página estática: HTML, ClojureScript evaluado por Scittle y unos pocos módulos.
Dentro de claude.ai el visor le da cuatro cosas: una **base de datos** (las obras y su historia),
**salas** (presencia de quienes están en una obra compartida), el **usuario** y **Claude**. La
página las pide a través de una capa pequeña, así que la misma página funciona también
en otro sitio con otro backend:

| | dentro de claude.ai | Kairotic Pages (GitHub Pages) |
|---|---|---|
| base de datos | la del artefacto | [GUN](https://gun.eco), un grafo que se sincroniza entre navegadores a través de relays |
| obras solo | solo las ves tú | cifradas con un par de claves que no sale de tu navegador |
| salas | quien tenga acceso al artefacto | quien tenga el sitio y el mismo relay |
| usuario | tu cuenta de claude.ai | un par de claves creado en este navegador (sin cuenta) |
| Claude | tu cuenta de claude.ai (lo permites la primera vez) | **tu propia clave de la API de Anthropic**, pegada en la pestaña Claude |

La página elige: si existe `window.claude` (claude.ai) lo usa; si no, usa `window.kairoticBackend`,
que instala la edición Pages (`core/backends/gun-backend.js`).

## Claude con tu propia clave (BYOK)

Desde principios de 2026 una suscripción de claude.ai no se puede usar para iniciar sesión desde
aplicaciones de terceros, así que en Pages Claude funciona con una **clave de API** de
[console.anthropic.com](https://console.anthropic.com) (se factura por uso a quien es dueño de la
clave). En la pestaña Claude, pega la clave y pulsa *Save*:

- se guarda **solo en este navegador** (localStorage `kairotic.anthropicKey`), nunca en la obra, la
  sala ni el relay;
- se envía **solo a api.anthropic.com**, directamente desde el navegador (cabecera
  `anthropic-dangerous-direct-browser-access`), sin ningún servidor en medio;
- *Forget* la borra. Cada persona que usa el sitio usa su propia clave: nadie gasta el uso de otra.

Modelos: rápido → `claude-haiku-5-5`, equilibrado → `claude-sonnet-5-5`, complejo → `claude-opus-5-5`.

## Relays

GUN se sincroniza a través de **relays**: servidores Node pequeños que pasan el grafo entre
navegadores y guardan una copia para que una sala siga ahí cuando la gente vuelve. GitHub Pages solo
sirve archivos, así que el relay va en otro sitio ([relay/](../relay/README.es.md)). Sin relay, cada
navegador trabaja solo.

Los relays del sitio están en `site/config.js`. En el gestor de sesiones, **Relay** muestra por cuáles
se sincroniza la página y si cada uno responde; ahí se puede probar y usar otro (el de la propia
comunidad, [con `npx @kairotic/relay`](../relay/README.es.md)), volver a los del sitio o trabajar sin
relay. La página se recarga con la elección, y mientras no sea la del sitio la dirección y los enlaces a
salas (**Copy link**) la llevan, así que quien los abre se sincroniza por el mismo relay. Lo mismo se
hace en la dirección: quien visita puede elegir otros para su navegador con
`?peer=wss://host/gun` (varios separados por comas; `?peer=none` vuelve a los del sitio);
`?peer=off` trabaja solo, sin ningún relay, hasta otro `?peer=` (así abren la app los tests).

Cada navegador guarda su propia copia de lo que ha visto en IndexedDB (RAD de GUN), así que obras y
salas se abren sin conexión y se sincronizan cuando vuelve. Las versiones anteriores la guardaban en
localStorage, donde caben solo 5 MB (una vez lleno, no se podía guardar nada: «localStorage max!»);
esa copia pasa a IndexedDB la primera vez que se abre la página.

Qué ve un relay: las salas en claro (como cualquiera en la sala), las obras solo cifradas.

## Construir y publicar

```sh
node site/build.mjs            # → _site/ (la app + GUN + adaptador + config + boot)
cd _site && python3 -m http.server 8000
```

`.github/workflows/pages.yml` lo construye y lo despliega con cada push a `main` que cambie la página,
el adaptador o el sitio. Una vez: *Settings → Pages → Source: GitHub Actions*. GitHub Pages sirve
repositorios públicos con cualquier plan; uno privado necesita un plan de pago.

## Límites conocidos

- GUN no tiene control de acceso por sí mismo: quien tenga el relay puede escribir en una sala. Las
  obras solo están protegidas porque van cifradas y firmadas con la clave, no por el relay.
- El par de claves vive en un navegador: cambiar de navegador es una identidad nueva (exportar e
  importar el par queda para más adelante).
- Las cajas `script` en salas siguen necesitando `(trust-scripts true)`, como en claude.ai.
