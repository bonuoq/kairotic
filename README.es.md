# Kairotic

*[Read in English](README.md)*

Un espacio colaborativo visual-acústico para improvisación, composición e interpretación musical:
un patcher donde **código y patch son la misma obra**, con una historia ramificada y compartida,
lienzos de frecuencia sobre tiempo, partituras, cajas de código (Faust, ClojureScript) y
componentes que cualquiera puede escribir y compartir.

*kairos* + *chaotic*: el momento oportuno y la divergencia de líneas temporales.

> Desde el Ensayo 9 (Study 9), el código, las clases, los comandos y la interfaz están en inglés,
> para una comunidad de cualquier lugar; la documentación, los ejemplos y las guías están en inglés
> y en castellano. El [glosario](docs/glossary.md) relaciona los nombres antiguos con los nuevos
> (`lienzo` → `canvas`, `perilla` → `knob`, `(enviar …)` → `(send! …)`…).

## Principios

- **Datos primero.** La obra es EDN; cada gesto es un evento que se escribe como código.
- **Dos vistas, una obra.** Código (REPL al estilo CAC) y patch (su representación gráfica).
- **Historia ramificada y colaborativa.** Un árbol de eventos; se bifurca ante gestos simultáneos o vueltas atrás, y las ramas se pueden mezclar.
- **Representación y lectura separadas.** Un lienzo es solo frecuencia sobre tiempo; su organización temporal la da quien lo lee.
- **Componentes.** Cada clase de caja es un mapa de datos y funciones con un contrato común, escrito por secciones: argumentos, lógica y una vista hecha de datos.
- **Estático.** ClojureScript interpretado con [Scittle](https://github.com/babashka/scittle) (sin compilar), dependencias desde CDN y WebAssembly (Faust, Verovio).

## Estructura

```
core/kairotic/        módulos actuales del sistema (ClojureScript)
  assistant.cljs      escribir componentes con Claude: el encargo y las herramientas con que Claude prueba lo que escribe
  api.cljs            la API de Kairotic: lo que pueden usar los componentes de fuera del núcleo (api/…), con versión
  components.cljs     registro de componentes, clases del núcleo, utilidades para escribir componentes
  engine.cljs         ejecución: mensajes, cola temporal sobre el reloj de audio, nodos Web Audio
  canvas.cljs         buffers gráficos: canvas genérico (cualquier dato, se lee en X o en Y) y freqt (frecuencia × tiempo, afinaciones Scala)
  score.cljs          voz → MEI para Verovio, tiempo ⇄ espacio
  code.cljs           cajas de código: compiladores por lenguaje, script (ClojureScript)
  signal.cljs         lectura a velocidad de audio: phasor~, reader~ (AudioWorklet), sig~
  faust.cljs          faust~: Faust compilado en el navegador (faustwasm) como AudioWorklet
  library.cljs        caja component, importación de componentes publicados
  shapes.cljs         vista propia de un componente: figuras como datos → SVG, plantillas con huecos
studies/NN-nombre/    cada ensayo tal como se publicó (index.html + sus módulos)
components/           paquete npm kairotic-components (src/*.cljs → dist/*.mjs)
examples/             el catálogo de ejemplos que lee Claude (controles, síntesis, espacio, faust, abstracciones, cac, notación)
packages/             paquetes oficiales por categorías: @kairotic/synth, @kairotic/spatial (src/*.cljs → dist/*.mjs)
docs/                 glosario (es ⇄ en) y guías, en inglés y castellano
tests/                pruebas de viabilidad (Faust en artefactos, qué se puede cargar)
```

Los ensayos 1–8 están en castellano y se conservan tal como se publicaron. `componentes/` es el
paquete anterior (`kairotic-componentes`), ya sustituido por `kairotic-components`.

## Ensayos

| | Ensayo | Qué valida |
|---|---|---|
| 1 | Patcher | código ⇄ patch, EDN, REPL |
| 2 | Historia | árbol de eventos colaborativo, frente, simultaneidad, mezcla, salas |
| 3 | Partitura | piano roll y notación (Verovio) sincronizados por tiempo ⇄ espacio |
| 4 | Patch | editores como cajas del patch, una voz por caja |
| 5 | Lienzo | frecuencia × tiempo, rejillas y Scala; lector, rampa, pasos; motor de mensajes |
| 6 | Componentes | registro de componentes; cajas de código: faust~ y script |
| 7 | Biblioteca | componentes definidos en la obra, biblioteca compartida, importación |
| 8 | Controles | vista propia de un componente: perillas que tocan un faust~ |
| 9 | Sections | todo en inglés; componentes por secciones (`:args`, lógica, plantilla `:view`) |
| 10 | Subpatches | patches dentro de patches: cajas `patch` con `inlet`/`outlet`, abstracciones con `$1`, `(abstract …)` |
| 11 | Presentation | una vista para quien interpreta (`(present …)`, botón Present) y sub-patches vistos como paneles de sus controles |
| 12 | Space | un `canvas` genérico que se lee en X o en Y (y `freqt` para frecuencia sobre tiempo); `dac~` con canales reales, `pan~`, `space~` binaural |
| 13 | Signal | lectura a velocidad de audio (`phasor~` → `reader~`, un AudioWorklet; señales a los parámetros de `osc~`/`gain~`) y por recorridos 2D (`reader path`); puertas por voz (`reader~ 2 gate`) hacia envolventes (`adsr~`); cajas editables desde el patch (inspector) y gestos que reescriben el texto de la caja |
| 14 | Packages | paquetes oficiales por categorías (`@kairotic/synth`: adsr~, synth~ · `@kairotic/spatial`: pan~, space~), que llegan a la obra al escribir una de sus clases; la API de Kairotic (`api/…`) para componentes |
| 15 | Claude | componentes escritos con Claude dentro de la obra (la pestaña Claude, `(ask-component …)`), con la cuenta de Claude de quien lo usa; Claude prueba lo que escribe con las herramientas de la página antes de que llegue como caja de componente |
| 16 | Faust | Claude escribe también Faust (lo compila para comprobarlo), abstracciones con cajas faust~ y knobs, y bpatchers cuyas instancias muestran sus knobs como panel; un catálogo de ejemplos por categorías que Claude lee con una herramienta ([examples/](examples/README.md)) |
| 17 | Pages | la misma página fuera de claude.ai: un adaptador de backend (base de datos, salas, usuario, Claude) para que funcione en GitHub Pages con salas [GUN](https://gun.eco) a través de un [relay](relay/README.es.md) y Claude con la propia clave de API de Anthropic de cada persona ([docs/pages.es.md](docs/pages.es.md)) |
| 18 | Learn | la pestaña Help: qué hace cada clase, entrada por entrada, con un patch de ayuda (**?** sobre una caja seleccionada, `:help` en un componente); tutoriales en castellano e inglés que se abren como lecciones — cada paso un punto de la historia, ◀ ▶ entre pasos, una rama tuya cuando cambias algo ([docs/tutorials/](docs/tutorials/README.es.md)) |
| 19 | Time | la música como datos: árboles musicales en EDN (hiccup, como el llll de bach) con compases, grupos irregulares, acordes, dinámicas, articulaciones, textos, cambios de parámetro y fragmentos reutilizables; las cajas `tree` y `mt` los escriben, transforman (transponer, invertir, retrogradar, aumentar, canon…) y tocan; una score, un freqt o un canvas los muestran en vivo; un tutorial de teoría ([docs/mt.es.md](docs/mt.es.md)) |
| 20 | Work | la obra como árbol: una `:piece` de `:section`s, cada una con sus voces (un pentagrama por voz a lo largo de las secciones, nombres de sección, dobles barras); la historia de una caja tree está hecha de ediciones de nodos (`tree-edit!`, y el editor de texto o `tree!` escriben solo la diferencia), así que las ramas que cambian nodos distintos se funden; las partituras editan el árbol (clic en una nota: ↑ ↓ + − ← → Supr); un tutorial de composición |
| 21 | Flow | datos que fluyen: los mensajes viajan sin ▶ (▶ es para el sonido y el tiempo); un tree se envía solo cuando cambia (o cambia el patch a su alrededor); una score envía por una tercera salida las ediciones que se hacen en ella, de vuelta al tree por una línea discontinua; los bucles sin tiempo se cortan y se avisan ([docs/flow.es.md](docs/flow.es.md)) |

## Probarlo

Los ensayos se publicaron como artefactos de claude.ai, que aportan la base de datos y las salas
compartidas. Fuera de claude.ai funcionan en **modo local** (sin guardar ni compartir):

```sh
cd studies/21-flow && python3 -m http.server 8000
# abre http://localhost:8000 y elige «Try locally, without saving»
```

La edición Pages (`node site/build.mjs` → `_site/`) guarda y comparte con GUN y usa Claude con tu
propia clave de API: ver [Kairotic fuera de claude.ai](docs/pages.es.md).

## Componentes

Ver [`components/`](components/README.es.md) y la guía
[Escribir un componente](docs/writing-a-component.es.md). En una obra se importan con
`(import! "npm:kairotic-components@0.1.2/dist/knob.mjs")`; dentro de claude.ai una página solo
puede cargar módulos JavaScript de npm a través de jsDelivr, por eso los componentes se publican así.

## Licencias y créditos

- **Código** (núcleo, ensayos, scripts y componentes oficiales): [Mozilla Public License 2.0](LICENSE).
  Es un copyleft por archivo: quien distribuya Kairotic modificado comparte sus cambios en estos
  archivos, mientras que los componentes, las obras y lo que se construya alrededor pueden llevar la
  licencia que quieran sus autores.
- **Documentación** (estos README y los documentos del proyecto):
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es).
- **Las obras son de quien las crea.** Kairotic no impone ninguna licencia a las obras, patches,
  lienzos, partituras ni componentes que se hagan con él.
- **Componentes de la comunidad:** cada definición declara su licencia con `:license` (identificador
  [SPDX](https://spdx.org/licenses/)); al importarla, la licencia queda en la cabecera de la copia.

### Dependencias (se cargan desde CDN, no se incluyen en el repositorio)

| | Licencia |
|---|---|
| [Scittle](https://github.com/babashka/scittle) (SCI, ClojureScript interpretado) | EPL-1.0 |
| [Verovio](https://www.verovio.org) (notación) | LGPL-3.0 o posterior |
| [faustwasm](https://github.com/grame-cncm/faustwasm) (compilador Faust en WebAssembly) | LGPL-3.0 |
| [IBM Plex](https://github.com/IBM/plex) (tipografías, vía Google Fonts) | OFL-1.1 |

El código Faust que se escribe en una caja `faust~` puede usar las
[librerías de Faust](https://faustlibraries.grame.fr/); cada función declara su licencia, y quien
distribuya una obra debe respetar las de las funciones que use.

### Inspiración

Ideas, no código: [DSim](https://github.com/helins/dsim.cljc) (estado y tiempo como datos),
[editscript](https://github.com/juji-io/editscript), [INScore](https://inscore.grame.fr/) (relación
tiempo ⇄ espacio), [bach](https://www.bachproject.net/) (partituras como objetos del patch),
[JSPatcher](https://github.com/Fr0stbyteR/jspatcher), [OSSIA score](https://ossia.io/),
[Oscilla](https://oscilla.app), [Scala](https://www.huygens-fokker.org/scala/) (formato de afinaciones),
OpenMusic, Opusmodus, FOMUS y la tradición LISP de la composición asistida.
