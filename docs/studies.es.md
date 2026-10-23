# Los ensayos

*[Read in English](studies.md)* · [Documentación](README.es.md)

Kairotic se construyó como una serie de **ensayos**: cada uno una pregunta, respondida con una página
que funciona, publicada como artefacto de claude.ai y conservada tal cual en [`studies/`](../studies).
Los ensayos 1–8 se escribieron en castellano; desde el Ensayo 9 el código y la interfaz están en inglés
(el [glosario](glossary.md) relaciona los nombres antiguos con los nuevos). Desde la 0.1.0-alpha, la app
vive en [`app/`](../app) y crece como una sola.

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
