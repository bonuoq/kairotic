# Kairotic

Un espacio colaborativo visual-acústico para improvisación, composición e interpretación musical:
un patcher donde **código y patch son la misma obra**, con una historia ramificada y compartida,
lienzos de frecuencia sobre tiempo, partituras, cajas de código (Faust, ClojureScript) y
componentes que cualquiera puede escribir y compartir.

*kairos* + *chaotic*: el momento oportuno y la divergencia de líneas temporales.

## Principios

- **Datos primero.** La obra es EDN; cada gesto es un evento que se escribe como código.
- **Dos vistas, una obra.** Código (REPL al estilo CAD/CAC) y patch (su representación gráfica).
- **Historia ramificada y colaborativa.** Un árbol de eventos; se bifurca ante gestos simultáneos o vueltas atrás, y las ramas se pueden mezclar.
- **Representación y lectura separadas.** Un lienzo es solo frecuencia sobre tiempo; su organización temporal la da quien lo lee.
- **Componentes.** Cada clase de caja es un mapa de datos y funciones con un contrato común; las cajas de código son la base para crear otros.
- **Estático.** ClojureScript interpretado con [Scittle](https://github.com/babashka/scittle) (sin compilar), dependencias desde CDN y WebAssembly (Faust, Verovio).

## Estructura

```
nucleo/kairotic/      módulos actuales del sistema (ClojureScript)
  componentes.cljs    registro de componentes y clases del núcleo
  motor.cljs          ejecución: mensajes, cola temporal sobre el reloj de audio, nodos Web Audio
  lienzo.cljs         buffer gráfico frecuencia × tiempo, rejillas, afinaciones Scala
  partitura.cljs      modelo de voz, MEI para Verovio, relación tiempo ⇄ espacio
  codigo.cljs         cajas de código: compiladores por lenguaje, script (ClojureScript)
  faust.cljs          faust~: Faust compilado en el navegador (faustwasm) como AudioWorklet
  biblioteca.cljs     caja componente, importación de componentes publicados
ensayos/NN-nombre/    cada ensayo tal como se publicó (index.html + sus módulos)
componentes/          paquete npm kairotic-componentes (src/*.cljs → dist/*.mjs)
pruebas/              pruebas de viabilidad (Faust en artefactos, qué se puede cargar)
```

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

## Probarlo

Los ensayos se publicaron como artefactos de claude.ai, que aportan la base de datos y las salas
compartidas. Fuera de claude.ai funcionan en **modo local** (sin guardar ni compartir):

```sh
cd ensayos/07-biblioteca && python3 -m http.server 8000
# abre http://localhost:8000 y elige «Probar en local, sin guardar»
```

## Componentes

Ver [`componentes/`](componentes/README.md). Dentro de una obra se importan con
`(importar "npm:kairotic-componentes@0.1.0/dist/quinta.mjs")`; dentro de claude.ai solo se pueden
cargar módulos JavaScript de npm a través de jsDelivr, por eso los componentes se publican así.

## Licencias y créditos

- **Código** (núcleo, ensayos, scripts y componentes oficiales): [Mozilla Public License 2.0](LICENSE).
  Es un copyleft por archivo: quien distribuya Kairotic modificado comparte sus cambios en estos
  archivos, mientras que los componentes, las obras y lo que se construya alrededor pueden llevar la
  licencia que quieran sus autores.
- **Documentación** (este README y los documentos del proyecto):
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es).
- **Las obras son de quien las crea.** Kairotic no impone ninguna licencia a las obras, patches,
  lienzos, partituras ni componentes que se hagan con él.
- **Componentes de la comunidad:** cada definición declara su licencia con `:licencia` (identificador
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
