# Los ensayos

*[Read in English](studies.md)* · [Documentación](README.es.md)

Kairotic se construyó como una serie de **ensayos**: cada uno una pregunta, respondida con una página
que funciona, publicada como artefacto de claude.ai y conservada tal cual en [`studies/`](../studies).
Los ensayos 1–8 se escribieron en castellano; desde el Ensayo 9 el código y la interfaz están en inglés
(el [glosario](glossary.md) relaciona los nombres antiguos con los nuevos). Desde la 0.1.0-alpha, la app
vive en [`app/`](../app) y crece como una sola.

**Abrir un ensayo.** Kairotic Pages sirve cada ensayo en su carpeta:
`https://bonuoq.github.io/kairotic/studies/<carpeta>/`, por ejemplo
[`studies/29-live/`](https://bonuoq.github.io/kairotic/studies/29-live/). Ahí un ensayo puede usar lo que
una página publicada en claude.ai no puede, como el micrófono. En tu ordenador, sirve la carpeta y ábrela en
`localhost` (una página abierta como fichero no puede cargar sus módulos):

```sh
cd studies && python3 -m http.server 8000     # luego http://localhost:8000/29-live/
```

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
| 16 | Faust | Claude escribe también Faust (lo compila para comprobarlo), abstracciones con cajas faust~ y knobs, y bpatchers cuyas instancias muestran sus knobs como panel; un catálogo de ejemplos por categorías que Claude lee con una herramienta ([examples/](../examples/README.md)) |
| 17 | Pages | la misma página fuera de claude.ai: un adaptador de backend (base de datos, salas, usuario, Claude) para que funcione en GitHub Pages con salas [GUN](https://gun.eco) a través de un [relay](../relay/README.es.md) y Claude con la propia clave de API de Anthropic de cada persona ([docs/pages.es.md](pages.es.md)) |
| 18 | Learn | la pestaña Help: qué hace cada clase, entrada por entrada, con un patch de ayuda (**?** sobre una caja seleccionada, `:help` en un componente); tutoriales en castellano e inglés que se abren como lecciones — cada paso un punto de la historia, ◀ ▶ entre pasos, una rama tuya cuando cambias algo ([docs/tutorials/](tutorials/README.es.md)) |
| 19 | Time | la música como datos: árboles musicales en EDN (hiccup, como el llll de bach) con compases, grupos irregulares, acordes, dinámicas, articulaciones, textos, cambios de parámetro y fragmentos reutilizables; las cajas `tree` y `mt` los escriben, transforman (transponer, invertir, retrogradar, aumentar, canon…) y tocan; una score, un freqt o un canvas los muestran en vivo; un tutorial de teoría ([docs/mt.es.md](mt.es.md)) |
| 20 | Work | la obra como árbol: una `:piece` de `:section`s, cada una con sus voces (un pentagrama por voz a lo largo de las secciones, nombres de sección, dobles barras); la historia de una caja tree está hecha de ediciones de nodos (`tree-edit!`, y el editor de texto o `tree!` escriben solo la diferencia), así que las ramas que cambian nodos distintos se funden; las partituras editan el árbol (clic en una nota: ↑ ↓ + − ← → Supr); un tutorial de composición |
| 21 | Flow | datos que fluyen: los mensajes viajan sin ▶ (▶ es para el sonido y el tiempo); un tree se envía solo cuando cambia (o cambia el patch a su alrededor); una score envía por una tercera salida las ediciones que se hacen en ella, de vuelta al tree por una línea discontinua; los bucles sin tiempo se cortan y se avisan ([docs/flow.es.md](flow.es.md)) |
| 22 | Embed | Kairotic dentro de otras páginas (Notion, un blog): enlaces que llevan un patch (su código, comprimido, leído como datos), un paso de tutorial o un patch de ayuda; `?embed` muestra solo el patch, `?present` solo su presentación, llenando el marco, con un botón de pantalla completa; el botón Embed y `(embed-link)` ([docs/embed.es.md](embed.es.md)) |
| 23 | Ask | la pestaña Claude hace patches a partir de una descripción, o cambia el abierto, comprobados con las herramientas de la página (clases, puertos, Faust, componentes) y cargados como un evento; los enlaces `?ask=` llevan una descripción —nunca una clave— y quien los abre hace el patch con su propio Claude ([docs/ask.es.md](ask.es.md)) |
| 24 | Draw | un buffer, dos maneras de dibujarlo: un `freqt` en SVG (con thi.ng/geom) sobre un espectro WebGL hecho con los mismos trazos |
| 25 | Overlay | marcas gráficas sobre una partitura de Verovio, guardadas en pulsos y pasos de pentagrama para que sigan su recolocación; un `monitor` de mensajes que llegan (descriptores con Meyda) —ahora en `@kairotic/analysis` |
| 26 | Layers | componentes dibujados solo en SVG; capas encima o debajo del patch con marcas ancladas a cajas y proyecciones de la vista de una caja; un único fondo WebGL para todo el patch (para más adelante) —las capas están en la app desde la 0.2.0-alpha |
| 27 | Geometry | una partitura vista como teoría musical: reloj de clases de altura, coeficientes de Fourier y camino en el Tonnetz; figuras nuevas `:opacity`, `:curve`, `:group`, `:hit` —ahora `@kairotic/theory` y `kairotic.shapes` |
| 28 | Shift | un sonido transportado offline a un buffer nuevo con [stftPitchShift](https://github.com/jurihock/stftPitchShift) (C++, MIT) compilado a WebAssembly con wasi-sdk, en un worker; factores leídos como música (razones, semitonos, cents), varios a la vez como acorde, cambiando en el tiempo como progresión; preservación de formantes; el buffer nuevo guarda su receta (la fuente por hash y el transporte como datos), y rehacerlo desde la receta da el mismo hash |
| 29 | Live | `shift~` en tiempo real: el mismo WebAssembly del Estudio 28, trama a trama dentro de un AudioWorklet (una trama de latencia, cerca de un 5% de un núcleo con un acorde y formantes a solapamiento 8), con una salida igual a la del transporte offline; acordes, progresiones en bucle sobre el reloj de audio, transporte y formantes en vivo; lo que una obra guarda de una toma es el flujo de mensajes a `shift~`, anotado sobre el reloj de audio |
| 30 | Inverse | síntesis inversa, primer paso: un banco de patches aleatorios de un sintetizador (JavaScript puro, así que la misma semilla da las mismas muestras en la página, un worker o Node) analizados con Meyda como hace `features~`, exportado como NDJSON (`generate.mjs` hace bancos grandes en Node); un primer camino de vuelta —el vecino más cercano en el espacio de descriptores— medido frente a una elección al azar, por distancia de descriptores y por distancia de patch |
| 31 | Units | una caja `faust~` abierta como patch de los elementos de Faust (`@kairotic/faust-units`: primitivas, controles, funciones de librería, `in`/`out`) junto a su código, un mismo dato en dos vistas: un patch da código (una definición por caja, los bucles a través del retardo de una muestra `'` escritos con `~`, la disposición en un último comentario) y el código da un patch (leído con el álgebra de diagramas de bloques de Faust; lo que las cajas no conocen se vuelve una caja de código con las entradas y salidas que encuentra el compilador); ida y vuelta comprobada muestra a muestra (`tests/roundtrip.mjs`) |
