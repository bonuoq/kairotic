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

En Pages, las salas se sincronizan a través de un **relay**. **Relay**, en la misma ventana, muestra los
que se usan y si responden; una comunidad puede tener el suyo (`npx @kairotic/relay`) y elegirlo ahí, y
los enlaces que compartes lo llevan. Ver [Kairotic Pages](pages.es.md).

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
- Un `msg` envía números (`msg 0 8 4`), palabras (`msg stop`) y **texto entre comillas como cadena**
  (`msg "https://…/voz.ogg"`, `msg "dos palabras"`), solos o en una lista (`msg url "github:…" 3`).
- **Sonido de fuera**: `adc~ 1` es el micrófono (o una entrada de la tarjeta de sonido: `adc~ 1 2`). Al
  pulsar ▶ el navegador lo pide una vez; su sonido llega tal cual, sin el procesado pensado para
  llamadas. `scope~` dibuja una señal y `snapshot~ 50 db` la convierte en números (su nivel), para que
  lo que se oye mueva el patch. Usa auriculares antes de enviar un `adc~` a `dac~`: se realimenta.
- **Grabar**: una caja `sample` graba lo que le llega con `rec` hasta `stop` (o hasta su duración:
  `sample 10`), y un `reader~` con el sample a su derecha lo reproduce en la posición de un `phasor~`
  — `!/ 1` convierte su duración (su outlet izquierdo) en la velocidad del phasor~, y cualquier otra
  velocidad lo toca más rápido, más lento o al revés. El sonido se queda en este navegador; la obra
  guarda su dibujo, así que una obra abierta en otro sitio lo muestra y dice que no está.
  `(load-sound! :bN)` trae un archivo, `(save-sound :bN)` lo guarda como WAV. Un sonido **desde una
  URL** — `(load-sound! :bN "https://…/voz.ogg")`, una cadena enviada al sample o
  `(sample! :bN {:url "…"})` en el código — lo descarga cada navegador que abre la obra, así que una
  sesión compartida o un enlace tienen los mismos sonidos en todas partes (una URL de otro sitio debe
  permitirlo: CORS). Dos fuentes funcionan siempre: `github:dueño/repo@ref/ruta.wav`, cualquier archivo
  de un repositorio público de GitHub, servido por jsDelivr (por ejemplo los bancos de
  [Dirt-Samples](https://github.com/tidalcycles/Dirt-Samples): `github:tidalcycles/Dirt-Samples@master/bd/BT0A0A7.wav`),
  y `freesound:id`, un sonido de [Freesound](https://freesound.org) con tu propia clave de API, guardada
  solo en tu navegador (`(freesound-key! "…")`, en freesound.org/apiv2/apply). `(sounds "lluvia" {:max 10})`
  busca en Freesound y escribe la línea que carga cada resultado; un sonido de Freesound guarda su autor
  y su licencia, y `(credits)` los lista para la obra.
- **Escuchar**: el paquete `@kairotic/analysis` (llega a la obra al escribir una de sus clases)
  convierte lo que se oye en datos: `pitch~` la altura por YIN (Hz, y 0 cuando deja de oír una),
  `onset~` un bang en cada ataque, `chroma~` las 12 clases de altura y la más fuerte,
  `features~ rms centroid flatness …` descriptores (con Meyda), y `spectrum~` dibuja el espectro.
  `monitor 6 rms centroid chroma` dibuja lo que llega a sus entradas en los últimos 6 segundos, un carril
  por entrada: los números como líneas, las listas (chroma, mfcc) como franjas, los bangs y las palabras
  como marcas.
  `transcribe` escribe lo que oye `pitch~` en un `freqt` — `rec`, tocar, `stop` — como notas a su
  altura o, con `transcribe 60 glide`, como contornos que siguen la voz (un `onset~` a su derecha separa
  las notas repetidas); el freqt visto como partitura es entonces la improvisación en notación.
- **Grabar un gesto**: `record [lo hi]` escribe cualquier flujo de números en un `canvas` como trazos en
  el tiempo — un knob, una envolvente (`snapshot~ 50 rms`), un descriptor (`features~ 20 centroid`) —:
  `rec`, tocar, `stop`. Un valor se mantiene hasta el siguiente; los ejes siguen a la toma. Se edita
  como cualquier dibujo y se vuelve a leer con `phasor~` → `reader~` como automatización.
- **Grabar desde un punto**: `rec t` (`msg rec 4`) en un `sample`, `record` o `transcribe` conserva lo
  que había antes de t (segundos; pulsos en transcribe) y graba desde t, sustituyendo lo que venía
  después: un punch-in. `ovr t` (`msg ovr 4`; `ovr` solo, desde 0) sobrescribe solo lo que cubre la
  toma, de t a donde se para, y conserva lo que venía después: un punch-in/out. Un canvas o freqt acepta
  `[:cut t]` para eso (todo desde t) y `[:cut t1 t2]` (lo que hay entre ambos; un trazo que lo cruza se
  parte en dos).

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

### Release, y puntos olvidados

Los fotogramas clave viven en la historia, y el código del patch, un enlace o una inserción solo llevan el
patch. Para que los presets viajen, una caja `presets` puede **guardarlos**: `(store-presets! :b18)` copia en
ella los fotogramas que usa, solo lo que cambia entre ellos. Una caja que guarda presets los usa en lugar de
la historia, y el código de la obra los escribe como `(presets! :b18 […])`, así que van adonde vaya el
patch. `(presets! :b18 nil)` los olvida.

- **Release…** (en la barra de la historia), o `(release)`, hace una **obra nueva** con una historia
  compacta: un punto por fotograma, con su etiqueta, cada uno escrito como los cambios desde el anterior, y
  después la obra tal como está. Cada caja presets guarda en ella sus presets. La obra de la que partes
  queda como estaba, con toda su historia.
- En una obra solo o local puedes **olvidar puntos**: ⇧+clic sobre ellos en la historia, y luego
  **Forget…**. La obra en esos momentos se pierde (y un snapshot que hubiera allí con ella), y los momentos
  posteriores quedan exactamente como están. No se pueden olvidar la punta de una rama ni un punto donde
  empieza una rama, y en una sala compartida la historia es de todos: allí el camino hacia una versión
  compacta es un release. Desde la REPL: `(forget-points [["segmento" 3] …])`.

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
  entrada por entrada, con un patch de ayuda (algunas tienen varios pasos, un uso cada uno, que ◀ ▶
recorren como un tutorial), y los **tutoriales**. Selecciona una caja y pulsa **?** (o
  F1) para ver su página; `(docs "concepts")` en la REPL abre una página de la documentación.

- **Feedback** — durante la alfa: cuenta qué falla, propón una idea o haz una pregunta. Escribe por ti
  un issue de GitHub, con el patch en pantalla, los errores recientes y tu navegador si quieres; tú lo
  publicas en GitHub. Se listan los issues abiertos, para sumarte a uno en vez de escribirlo dos veces.

## 6. La música como datos

Una caja `tree` guarda música en EDN —voces, compases, notas, acordes, dinámicas:
`[:voice [:measure {:meter [4 4]} "c4/1 e4 g4/2"]]`. Mostrada como partitura (⇄ en su cabecera), o conectada a un `freqt` mostrado como partitura, se dibuja como partitura;
a través de cajas `mt` se transforma (`mt transpose 7`, `mt retrograde`, `mt canon 2 7`); con
`mt play` → `synth~` suena. Haz clic en una nota de una partitura para editarla (↑ ↓ + − ← → a…g Supr), o en un silencio para volverlo nota (Intro). Ver
[Árboles musicales](mt.es.md).

Un `canvas`, un `freqt` y una partitura se redimensionan desde su esquina inferior derecha, como un evento
de la historia (`(resize :b3 640 300)`); un doble clic en la esquina les devuelve su tamaño. Una partitura
toma el ancho que le das y redistribuye su notación; su altura sigue a la notación.

**Verla como geometría.** El paquete `@kairotic/theory` dibuja lo que suena como teoría musical:
`pcclock` un conjunto de clases de altura en la esfera del reloj (su forma prima, su vector interválico
y sus ejes de simetría), `fourier` sus seis coeficientes de Fourier (cromático … diatónico, de tonos
enteros), `tonnetz` las tríadas en el Tonnetz y el camino de la armonía. Reciben listas de alturas,
notas de una en una o un chroma de `chroma~`, y sus partes se pueden pulsar (sale una clase de altura).

**Dibujar a partir de mensajes.** Una caja `draw [w h]` dibuja las figuras que le llegan —las mismas que
la vista de un componente: `[:circle {:cx 40 :cy 40 :r 10 :fill :accent}]`, `[:line …]`, `[:path …]`,
`[:curve …]`, `[:text …]`, `[:group {:x :y :rotate} […]]`— o como las escribe un msg: `msg circle 40 40
10 accent hit sun`. Una lista las sustituye todas, `[:set k figura]` mueve la llamada k, `clear` la
vacía, y una figura con `:hit k` envía k cuando se pulsa.

## 7. Anotaciones y capas

**Annotate** (encima del patch) abre una barra para escribir sobre el patch: **Draw** una línea a mano,
una flecha (**Arrow**), un texto (**Text**), mover una marca (**Move**) o borrarla (**Erase**). Mover una
marca mantiene el ancla de cada punto (un punto anclado a una caja la sigue siguiendo, desde donde lo
dejas); arrastrar un extremo de una línea o una flecha mueve solo ese extremo, y lo ancla de nuevo a la
caja más cercana al soltarlo. Cada punto se ancla a la caja más
cercana —la marca la sigue cuando se mueve— o al papel si no hay ninguna cerca; una caja borrada deja sus
marcas donde estaban. Lo dibujado va a una **capa** (`notes` si no nombras otra), encima o debajo de las
cajas, visible en el patch, en la presentación o en ambos; cada marca es un evento de la historia y parte
del código:

```clojure
(layer :notes {:z :over :show #{:patch :present}})
(mark :notes :a1 {:kind :arrow :pts [[:b1 120 10] [:b4 -6 10]]})
(mark :notes {:kind :text :at [:patch 300 40] :txt "respira"})
(move-mark :a1 20 -10)
(unmark :a1)
```

Una capa también puede tener **proyecciones**: la vista de una caja dibujada otra vez, a otro tamaño —
`(project :b9 :viz [40 40 800 480])` pone un `monitor`, un `spectrum~` o un `tonnetz` en grande detrás
de la presentación, dibujado a partir de lo que muestra (no escalado), mientras la caja sigue en su
sitio. `(unproject :b9)`.

## 8. Presentación

**Present** muestra solo las cajas que has puesto en la presentación —`(present :b4 x y)`, o
arrastrándolas con ⌥ en modo presentación— como un panel para quien toca. **Edit** vuelve.
En presentación el papel es para tocar: un doble clic no crea cajas y no se selecciona nada con el
ratón. Un arrastre normal toca la caja (o no hace nada): para mover una caja presentada, arrástrala
con ⌥/Alt pulsada, así un freqt, un canvas o un knob no se mueven por error desde su cabecera o su asa.

Si hay cajas seleccionadas al pulsar **Present** y alguna aún no está en la presentación, primero
pregunta: *Present the selection* las pone en ella donde están en el patch (un evento de la historia),
*Present without them* las deja fuera. Desde la REPL: `(present-in-place :b3 :b4)`.

## 9. Compartir e insertar

- En una sala, todos están en la misma obra.
- **Share/Export** da un enlace y un iframe con este patch (o este paso de tutorial) para Notion, un blog o un
  curso; *Release/Perform* da un release que se abre en Perform, mostrando solo el panel. Ver [Insertar](embed.es.md).
- Una petición a Claude se puede compartir en la
  [Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery).

## 10. Teclas

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
| Intro · a…g | el silencio seleccionado de una partitura se vuelve nota (a…g también cambia la altura de una nota) |
