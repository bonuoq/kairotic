# Guía

*[Read in English](guide.md)* · [Documentación](README.es.md)

Kairotic es un patcher de música —cajas unidas por líneas, como en Max o Pure Data— donde **el patch y
su código son la misma obra**, y cada gesto queda en una historia que puedes recorrer, ramificar y
compartir. Esta guía recorre la interfaz; [Conceptos](concepts.es.md) explica lo que hay detrás.

## 1. Abrir una obra

Abre [la app](https://bonuoq.github.io/kairotic/) (o el artefacto de Kairotic dentro de claude.ai). La
ventana **Sessions** ofrece tres entradas:

- **Solo** — tus obras, guardadas (en claude.ai, en tu cuenta; en Pages, cifradas en tu navegador).
- **Shared rooms** — una obra que todos los de la sala editan a la vez, cada gesto en la misma historia.
- **Try locally, without saving** — un patch para jugar; no se guarda nada.

Una obra solo puede copiarse a una sala y una sala a una obra solo (con su historia). **Sessions**, arriba
a la derecha, vuelve a abrir esta ventana.

## 2. Hacer un patch

- **Crear una caja**: doble clic en un sitio vacío, escribe su texto —la clase y sus argumentos, como
  `osc~ 440`— y pulsa Intro. Las clases que acaban en `~` son sonido.
- **Conectar**: arrastra desde una salida (las marcas pequeñas bajo una caja) hasta una entrada (encima
  de otra caja).
- **Seleccionar** una caja o una línea con un clic. **⌘/Ctrl+clic** en una caja la edita debajo (sus
  argumentos y su texto). **Supr** borra lo seleccionado.
- **Seleccionar varias**: ⇧+clic añade una caja a la selección (o la quita); un marco dibujado desde un
  sitio vacío del papel selecciona todas las cajas que toca (con ⇧ se añaden); ⌘/Ctrl+A las selecciona
  todas. Al arrastrar una se mueven todas; Supr las borra todas.
- **Mover** una caja arrastrándola. Las cajas para tocar —`bang`, `msg`, `number`, knobs— se seleccionan
  por el asa de su izquierda; su cuerpo es para tocar.
- **Escribir un valor**: doble clic en un control numérico —un `number`, un knob (o cualquier componente
  que se arrastra para dar un número), un deslizador de una caja `faust~` o su valor— y escribe el
  número: `440`, `-3.5`, `0,5`, `3/2`. Intro lo aplica, como lo haría un arrastre (un knob lo guarda en su
  texto, dentro de su rango; un deslizador, entre su mínimo y su máximo); Esc cierra el campo y deja el
  valor como estaba. Lo que no es un número se rechaza y el campo sigue abierto.
- **Editar el texto** de una caja: doble clic. Cajas de código (`faust~`, `script`, `component`, `tree`):
  en el patch muestran una fila de su código; con doble clic se abre el **editor de código**, una ventana
  que se mueve por su barra y cambia de tamaño por su esquina, con números de línea, sangría automática,
  paréntesis emparejados, edición estructural para Clojure (Ctrl+→ / Ctrl+← saltan entre formas, Alt+↑
  amplía la selección), búsqueda (Ctrl/⌘+F) y autocompletado. Ctrl/⌘+Intro aplica el código y deja la
  ventana abierta; Esc la cierra, preguntando antes si algo no está aplicado.

Un primer patch:

```clojure
(box :b1 "osc~ 440" 40 40)
(box :b2 "gain~ 0.2" 40 100)
(box :b3 "dac~ 1 2" 40 160)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b2 0 :b3 1)
```

Puedes hacerlo con el ratón, escribirlo en la pestaña **Code** (Run · Ctrl+Intro) o en la REPL de abajo,
una llamada cada vez. Las tres cosas son la misma obra: lo que dibujas aparece como código y lo que
escribes aparece como cajas.

La pestaña Code y la REPL usan el mismo editor que las cajas de código (paréntesis que se cierran y se
emparejan, autocompletado de los comandos). En la REPL, Intro evalúa cuando todos los paréntesis están
cerrados —si no, empieza una línea nueva, y ⇧+Intro siempre lo hace— y ↑ ↓ recuperan lo escrito antes.

**Funciones como cajas.** Una caja con el nombre de una función pura de `clojure.core` (o de
`clojure.string`, como `str/…`) es esa función, sin escribir ningún componente: sus otras palabras son
sus argumentos, leídos como EDN, y el mensaje que llega va al final, como con `->>`. `%` lo pone en otro
sitio.

| caja | mensaje | envía |
|---|---|---|
| `into [440]` | `[1 2]` | `[440 1 2]` |
| `conj % 440` | `[1 2]` | `[1 2 440]` |
| `map inc` | `[1 2]` | `[2 3]` |
| `get % :freq` | `{:freq 440}` | `440` |
| `str/upper-case` | `"do"` | `"DO"` |

Cada argumento tiene una entrada a la derecha que lo sustituye sin enviar nada; un bang a la izquierda
vuelve a enviar con el último mensaje. Solo hay funciones puras (`map`, `filter`, `take`, `assoc`, `sort`,
`frequencies`…), así que estas cajas son seguras en una sala compartida; una clase con el mismo nombre
(`+`, `print`) va primero.

## 3. Sonido y tiempo

- **▶** (o la barra espaciadora) pone en marcha el sonido y el tiempo: audio, `metro`, `ramp`,
  `loadbang`, `mt play`. El primer ▶ también pide permiso al navegador para sonar.
- **■** silencia y devuelve cada caja a su estado inicial.
- Los mensajes viajan sin ▶: un clic en un `bang` o un `msg`, un número arrastrado, una caja de datos
  que cambió.

## 4. La historia

Cada gesto es un evento de la historia, abajo en la página.

- **Ctrl+Z** va atrás, **Ctrl+Mayús+Z** (o Ctrl+Y) adelante; o haz clic en cualquier punto de la historia.
- Hacer algo después de volver atrás crea una **rama**: no se pierde nada.
- **Merge…** trae aquí los eventos de otra rama, cuando no chocan.
- En una sala, los gestos de los demás llegan a la misma historia; *Follow the front* te mantiene en el
  punto más nuevo.
- **◆ Snapshot** —`(snapshot)`, o `(snapshot "intro")` con un nombre— escribe un fotograma clave: un
  punto de la historia con la obra tal como está ahora. Se dibuja como un cuadrado.

### Componer y tocar (Compose y Perform)

Componer es el modo habitual: cada cambio en la obra es un punto de la historia. **Perform** abre un
tiempo propio para ensayar, probar e improvisar con la obra: lo que cambias forma una *toma* que parte
de donde estás y queda fuera de la historia (el patch tiene un marco rojo mientras tocas).

- Ctrl+Z / ◀ deshacen tus últimos cambios de la toma; ▶ los rehace.
- Un snapshot en Perform escribe en la historia la toma hasta ahí, y la toma sigue desde ese punto.
- Pulsar otra vez **Perform** vuelve a Compose: *Keep it as a new point* escribe la toma como una rama
  desde donde empezó (cerrada por un cuadrado relleno), *Discard* vuelve a donde estabas.
- En una sala, quienes tocan desde el mismo punto de la historia tocan la misma toma: una **jam**. Solo
  ellos reciben los cambios de los demás; al resto se le invita a unirse.
- Desde la REPL: `(perform)`, `(compose)`, `(compose :keep)`, `(compose :discard)`, `(jam "id")`.
  Perform y Present son independientes: puedes tocar con el patch entero o con el panel.

### Presets: fotogramas clave para recuperar, transformar y generar

Cada fotograma clave —un snapshot, o una toma guardada desde Perform— es también un **preset** de la
obra: el texto de cada caja en ese momento (sus argumentos, y los valores que los controles guardan en
él: un knob, una envolvente, un pad), con los subpatches incluidos. Una caja `presets` los toca:

- Un número o una etiqueta en su entrada izquierda —`2`, `intro`— **recupera** ese fotograma: cada caja
  que también está allí toma el texto que tenía entonces, como un solo evento de la historia (un Ctrl+Z
  lo deshace). Las cajas añadidas o quitadas desde entonces, las líneas y los búferes quedan como están.
- Una posición en su entrada derecha **transforma** (morph): `1.5` lleva los controles a medio camino
  entre el primer fotograma y el segundo. Se mueven como mensajes, igual que al arrastrarlos (en vivo, y
  se tocan en una jam), y no se escribe nada hasta `keep`. Un knob que conduce el morph no se mueve con él.
- Un **bang** genera un preset nuevo a partir de lo que cambia y lo que permanece: lo que es igual en
  todos los fotogramas se queda; un número que cambia toma un valor dentro de su rango (geométrico en un
  knob `log`, entero si siempre lo fue); una palabra que cambia es una de las suyas. `[:generate 42]` da
  siempre el mismo preset; haz un snapshot para guardarlo como un fotograma más.
- Su salida envía los valores de los controles que ha cambiado, `{:b3 0.5 :b5 880}`.
- Los fotogramas se numeran por orden de momento, igual en todas las pestañas de una sala.
  `presets intro verse` usa solo esos snapshots, en ese orden.
- Desde la REPL, con todos los fotogramas de la obra: `(keyframes)`, `(recall 2)`, `(recall "intro")`,
  `(morph 1 2 0.5)`, `(morph :keep)`, `(generate)`, `(generate 42)`. En Perform, todo va a la toma,
  como cualquier cambio.
- El tutorial *Presets: recuperar, transformar, generar* (Help → tutoriales, o `(tutorial "presets")`)
  lo recorre todo con un sintetizador FM.

## 5. Las pestañas de la derecha

El panel de la derecha puede dejar sitio al patch: **»** en su cabecera (o **›** en la barra entre ambos)
lo oculta, y **‹** lo devuelve; pedir una pestaña —**?** o F1 sobre una caja, `(docs …)`, un tutorial—
también lo muestra. Arrastra la barra entre el patch y el panel para darle otro ancho; un doble clic en
la barra lo oculta o lo muestra. Este navegador recuerda cómo lo dejaste. Desde la REPL:
`(side-panel false)`, `(side-panel true)`, `(side-panel 480)`, `(side-panel :auto)`.

- **Code** — la obra como **Calls** (llamadas: `box`, `connect`, …), editable: Ctrl/⌘+Enter las ejecuta y
  reconstruye el patch. **Data** muestra la misma obra como datos (EDN): el estado que produce la
  historia, todas las claves de todas las cajas, en solo lectura, para inspeccionarlo (plegado y búsqueda
  con Ctrl/⌘+F). Lo que hayas editado sin ejecutar sigue en las llamadas mientras miras los datos.
- **Components** — las clases que conoce esta obra; escribe las tuyas, importa las publicadas.
- **Claude** — Claude hace un patch (o cambia el abierto), o escribe un componente, a partir de lo que
  describes. Ver [Pedírselo a Claude](ask.es.md).
- **Help** — esta **documentación** (guía, conceptos, temas, referencia), una página para cada clase,
  entrada por entrada, con un patch de ayuda, y los **tutoriales**. Selecciona una caja y pulsa **?** (o
  F1) para ver su página; `(docs "concepts")` en la REPL abre una página de la documentación.

- **Feedback** — durante la alfa: cuenta qué falla, propón una idea o haz una pregunta. Escribe por ti
  un issue de GitHub, con el patch en pantalla, los errores recientes y tu navegador si quieres; tú lo
  publicas en GitHub. Se listan los issues abiertos, para sumarte a uno en vez de escribirlo dos veces.

## 6. La música como datos

Una caja `tree` guarda música en EDN —voces, compases, notas, acordes, dinámicas:
`[:voice [:measure {:meter [4 4]} "c4/1 e4 g4/2"]]`. Mostrada como partitura (⇄ en su cabecera), o conectada a un `freqt` mostrado como partitura, se dibuja como partitura;
a través de cajas `mt` se transforma (`mt transpose 7`, `mt retrograde`, `mt canon 2 7`); con
`mt play` → `synth~` suena. Haz clic en una nota de una partitura para editarla (↑ ↓ + − ← → Supr). Ver
[Árboles musicales](mt.es.md).

Un `canvas`, un `freqt` y una partitura se redimensionan desde su esquina inferior derecha, como un evento
de la historia (`(resize :b3 640 300)`); un doble clic en la esquina les devuelve su tamaño. Una partitura
toma el ancho que le das y redistribuye su notación; su altura sigue a la notación.

## 7. Presentación

**Present** muestra solo las cajas que has puesto en la presentación —`(present :b4 x y)`, o
arrastrándolas en modo presentación— como un panel para quien toca. **Edit** vuelve.

Si hay cajas seleccionadas al pulsar **Present** y alguna aún no está en la presentación, primero
pregunta: *Present the selection* las pone en ella donde están en el patch (un evento de la historia),
*Present without them* las deja fuera. Desde la REPL: `(present-in-place :b3 :b4)`.

## 8. Compartir e insertar

- En una sala, todos están en la misma obra.
- **Embed** da un enlace y un iframe con este patch (o este paso de tutorial) para Notion, un blog o un
  curso; *Presentation, fullscreen* muestra solo el panel. Ver [Insertar](embed.es.md).
- Una petición a Claude se puede compartir en la
  [Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery).

## 9. Teclas

| | |
|---|---|
| doble clic en un sitio vacío | una caja nueva |
| doble clic en un number, knob o deslizador | escribe su valor (Intro lo aplica, Esc cierra) |
| Supr / Retroceso | borra las cajas o la línea seleccionadas |
| ⌘/Ctrl+clic | edita una caja debajo de ella (sus argumentos y su texto) |
| ⇧+clic · un marco · ⌘/Ctrl+A | selecciona varias cajas · todas |
| Esc | deselecciona, o cierra el editor de la caja |
| arrastrar la esquina de un canvas, freqt o partitura | la redimensiona (doble clic: su tamaño por defecto) |
| arrastrar la barra junto al panel · » · ‹ | redimensiona el panel de la derecha · lo oculta · lo muestra |
| espacio | ▶ / ■ |
| ? o F1 | ayuda de la caja seleccionada |
| Ctrl+Z · Ctrl+Mayús+Z · Ctrl+Y | atrás · adelante en la historia (en Perform, en la toma) |
| Ctrl+Intro | aplica código (pestaña Code, cajas de código, pestaña Claude) |
| ↑ ↓ + − ← → Supr | edita la nota seleccionada de una partitura, o el trazo de un canvas |
