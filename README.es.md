# Kairotic

*[Read in English](README.md)* · **0.1.0-alpha** · [abrir la app](https://bonuoq.github.io/kairotic/) · [documentación](docs/README.es.md)

Un espacio colaborativo visual-acústico para improvisación, composición e interpretación musical:
un patcher donde **código y patch son la misma obra**, con una historia ramificada y compartida,
lienzos de frecuencia sobre tiempo, partituras, cajas de código (Faust, ClojureScript) y
componentes que cualquiera puede escribir y compartir.

*kairos* + *chaotic*: el momento oportuno y la divergencia de líneas temporales.

## Principios

- **Datos primero.** La obra es EDN; cada gesto es un evento que se escribe como código.
- **Dos vistas, una obra.** Código (REPL al estilo CAC) y patch (su representación gráfica).
- **Historia ramificada y colaborativa.** Un árbol de eventos; se bifurca ante gestos simultáneos o vueltas atrás, y las ramas se pueden mezclar.
- **Representación y lectura separadas.** Un lienzo es solo frecuencia sobre tiempo; su organización temporal la da quien lo lee.
- **Componentes.** Cada clase de caja es un mapa de datos y funciones con un contrato común, escrito por secciones: argumentos, lógica y una vista hecha de datos.
- **Estático.** ClojureScript interpretado con [Scittle](https://github.com/babashka/scittle) (sin compilar), dependencias desde CDN y WebAssembly (Faust, Verovio).

## Usarlo

- **[Abre la app](https://bonuoq.github.io/kairotic/)** (Kairotic Pages): obras solo y salas en GUN,
  Claude con tu propia clave de API de Anthropic. Dentro de claude.ai, el artefacto de Kairotic hace lo
  mismo con tu cuenta de claude.ai.
- Empieza por la **[Guía](docs/guide.es.md)** y luego los [Conceptos](docs/concepts.es.md); la pestaña Help
  tiene los tutoriales y una página para cada clase ([referencia](docs/reference.md)).
- Comparte lo que hagas con Claude en la
  [Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery); ideas y preguntas en
  [Discussions](https://github.com/bonuoq/kairotic/discussions).

## Estructura

```
app/                  la app: index.html (interfaz y estilos) y page/*.cljs (el ClojureScript de la página, en orden)
core/kairotic/        los módulos: componentes, motor, canvas, partitura, mt (árboles musicales), enlaces, asistente (Claude)…
core/backends/        el backend GUN de Pages (db, salas, usuario, Claude con tu propia clave)
site/                 la edición Pages: build.mjs, configuración (relays), GUN, la página de prueba de embeds
components/           paquete npm kairotic-components: knob, fifth, drift
packages/             paquetes oficiales: @kairotic/synth, @kairotic/spatial
examples/             el catálogo que Claude lee cuando escribe
docs/                 documentación (inglés y castellano), tutoriales, referencia de clases generada
tests/                pruebas (cljs/*.cljs), en el navegador (tests.html) y en CI
relay/                un relay GUN para las salas
studies/              los 23 ensayos del prototipo, tal como se publicaron
componentes/          el paquete anterior (kairotic-componentes), sustituido por kairotic-components
```

## Desarrollo

Kairotic es estático: ClojureScript interpretado por [Scittle](https://github.com/babashka/scittle) en el
navegador, sin compilador. Para construirlo y servirlo en local:

```sh
node site/build.mjs                 # → _site/ (edición Pages) y _artifact/ (edición claude.ai)
cd _site && python3 -m http.server 8000
# http://localhost:8000              la app
# http://localhost:8000/tests.html   las pruebas
```

`site/build.mjs` construye primero los componentes, los paquetes, los ejemplos de Claude y los
tutoriales. En cada push, GitHub Actions despliega Pages, ejecuta las pruebas en un Chromium sin
pantalla y regenera [docs/reference.md](docs/reference.md) a partir de la ayuda. Ver los
[cambios](CHANGELOG.md).

## Componentes

Ver [Escribir un componente](docs/writing-a-component.es.md), [`components/`](components/README.es.md) y
[`packages/`](packages/README.es.md). Dentro de una obra, los componentes publicados se importan con
`(import! "npm:kairotic-components@0.1.2/dist/knob.mjs")`; los paquetes oficiales llegan solos cuando una
caja usa una de sus clases.

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
