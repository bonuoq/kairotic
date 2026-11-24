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

Una obra solo puede copiarse a una sala y una sala a una obra solo (con su historia). **Sessions**, en el
menú ☰ de arriba a la izquierda, junto al logo, vuelve a abrir esta ventana (el menú tiene también Share/Export, la obra como archivo,
Feedback y las teclas y gestos).

En Pages, las salas se sincronizan a través de un **relay**. **Relay**, en la misma ventana, muestra los
que se usan y si responden; una comunidad puede tener el suyo (`npx @kairotic/relay`) y elegirlo ahí, y
los enlaces que compartes lo llevan. Ver [Kairotic Pages](pages.es.md).

## 2. Hacer un patch

- **Crear una caja**: doble clic en un sitio vacío, escribe su texto —la clase y sus argumentos, como
  `osc~ 440`— y pulsa Intro. Las clases que acaban en `~` son sonido. Mientras escribes la clase, un menú
  ofrece las que coinciden, cada una con su origen (el núcleo, un paquete, clojure.core) y qué hace: ↑ ↓
  eligen, Tab o Intro toman una (o un clic), y luego muestra qué argumentos espera. Escribir una clase de un
  paquete oficial trae el paquete a la obra. El **?** de cada una, o F1 (Ctrl/⌘ + ?) en el campo, abre su
  ayuda, con el campo aún abierto.
- **Conectar**: arrastra desde una salida (las marcas pequeñas bajo una caja) hasta una entrada (encima
  de otra caja). No hace falta acertar en la marca: cerca de una salida se ilumina y el puntero se vuelve
  una cruz, y un cable que sueltas sobre una caja, o justo encima de una de sus entradas, llega a la
  entrada más cercana. Los cables son curvos, aquí y en el patch de un `faust~`, que funciona igual.
- **Ids**: cada caja tiene un id (`:b7`), que es como la nombran el código, la REPL y los mensajes de Room.
  Aparece sobre su esquina superior derecha cuando pasas por encima o la seleccionas; **I** los muestra
  todos. **`(`** en el patch abre ahí una línea de la REPL (como el campo de una caja nueva cuando lo que
  escribes empieza por `(`), con el mismo editor que la REPL —sugerencias, paréntesis que se cierran—: Intro
  la ejecuta cuando sus paréntesis están equilibrados y muestra debajo lo que dio, ↑ ↓ recorren la historia
  de la REPL, Esc la cierra. Mientras una línea de código espera una caja —la REPL, la pestaña Code, esa línea, un
  mensaje de Room— tras un espacio, `(` `[` `{` o `:` (`@` en un mensaje), un clic en una caja escribe ahí su
  id en vez de seleccionarla, como un clic en una celda dentro de una fórmula de hoja de cálculo:
  `(connect ` clic, `0 ` clic, `0)`.
- **La pestaña Code y el patch**: al seleccionar cajas, sus líneas se marcan en la pestaña Code (su caja, sus
  líneas, sus datos…) y la pestaña se desplaza hasta ellas; poner el cursor en una línea de una caja la
  selecciona (las dos cajas, en un `connect`). Las líneas de más de 160 caracteres —el código de una caja de
  código, un buffer guardado como datos— se pliegan tras su principio, diciendo cuántos caracteres ocultan; un
  clic las muestra, y se quedan así.
- **Cajas unas encima de otras**: el tamaño real de una caja solo se sabe al dibujarla (un `faust~` crece con
  sus deslizadores, una partitura con su notación). `(overlaps)` lista las cajas que se tapan, y `(tidy)` baja
  cajas hasta que ninguna tape a otra, cada una en su columna, en un solo evento.
- **Sondas en las conexiones**: ⌥/Alt+clic en una conexión (o `(probe :b1 0 :b2 0)`) y muestra, en su mitad, el
  último valor que pasó por ella, con un destello cuando pasa uno, y cuántos por segundo cuando llegan seguidos.
  Otra vez la quita; `(unprobe-all!)` las quita todas. Las sondas son solo de esta pestaña: no forman parte de la
  obra, ni de su historia ni de su código. Las conexiones que salen de una caja de sub-patch, y las de señal, aún
  no muestran nada.
- **Seleccionar** una caja o una línea con un clic. **⌘/Ctrl+clic** en una caja la edita debajo (sus
  argumentos y su texto). **Supr** borra lo seleccionado.
- **Seleccionar varias**: ⇧+clic añade una caja a la selección (o la quita); un marco dibujado desde un
  sitio vacío del papel selecciona todas las cajas que toca (con ⇧ se añaden); ⌘/Ctrl+A las selecciona
  todas. Al arrastrar una se mueven todas; Supr las borra todas.
- **Copiar, cortar, pegar, duplicar**: ⌘/Ctrl+C copia las cajas seleccionadas, ⌘/Ctrl+X las corta, ⌘/Ctrl+V
  las pega donde está el puntero, conservando su disposición, y ⌘/Ctrl+D las duplica un poco más abajo y a la
  derecha (`(duplicate :b3 :b4)` desde código). Las cajas pegadas reciben ids nuevos y conservan sus líneas
  entre ellas, y sus líneas con cajas que no se copiaron si esas cajas están en el patch. Pegar es un solo
  evento de la historia. Lo que se copia es el código de las cajas, así que también se puede pegar en un
  mensaje o un documento; al pegar, su última línea se lee como datos y nunca se ejecuta.
- **Mover** una caja arrastrándola. Las cajas para tocar —`bang`, `msg`, `number`, knobs— se seleccionan
  por el asa de su izquierda; su cuerpo es para tocar.
- **Qué caja queda encima**: las cajas se dibujan en el orden en que se crearon, la más nueva encima, y
  la caja que arrastras pasa al frente, para que lo que mueves no quede nunca tapado. Es solo cómo las
  muestra tu pestaña, como la selección: no forma parte de la obra, de su historia ni de su código.
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

**Live coding en la pestaña Code** (discusión #407). Ctrl/⌘+Intro aplica toda la pestaña por la diferencia: lo
que el código cambia es un evento de la historia (las cajas, líneas y textos que cambiaron), y lo que sigue igual
queda como estaba, en la historia y en el sonido. **⇧+Intro** evalúa solo la selección, o la forma donde está el
cursor (o la que acaba justo antes): las llamadas que hacen el patch —`box`, `connect`, `text!`, los datos de una
caja…— también lo cambian por la diferencia, y una caja escrita otra vez como estaba conserva lo que guarda; todo
lo demás —`(play)`, `(send! :b3 60)`, `(snapshot)`, un `def`— es una línea de la REPL. Así un set se puede tocar
solo desde la pestaña, forma a forma:

```clojure
(def o (box "osc~ 220"))      ; ⇧+Intro: una caja
(def d (box "dac~ 1 2"))
(connect o 0 d 0)
(play)
(text! o "osc~ 330")          ; cambia el oscilador, el sonido sigue
```

Si la pestaña no tenía nada más sin aplicar, después se escribe de nuevo desde el patch (la caja nueva como
`(box :b7 "osc~ 220" …)`), con el cursor en su línea.

**Live**, la tercera vista de la pestaña Code (junto a Calls y Data), es una página tuya que la obra nunca
reescribe: los nombres (`def`) y las cadenas quedan como los escribiste. ⇧+Intro evalúa la forma del cursor,
**Ctrl/⌘+Intro el bloque** donde está (las líneas entre dos vacías), y lo evaluado parpadea. Se guarda en este
navegador para cada obra, no en la obra. **`to`** hace una caja debajo de otra, alimentada por ella, como un evento,
y devuelve su id, así que una cadena se lee como va la señal —`(-> (box "osc~ 220") (to "gain~ 0.2") (to "dac~ 1 2"))`,
toda la cadena un evento si se evalúa desde la pestaña; `(to a o "texto" i)` elige la salida y la entrada, y
`(to :b3 :b9)` solo conecta.

**Nombres.** `(box :osc "osc~ 220")` hace una caja que el código llama `:osc`: evaluada otra vez es la misma caja, con
su texto cambiado si ha cambiado (`(box :osc "osc~ 330")` cambia el oscilador, como un evento, y el sonido sigue), así
que un bloque se puede evaluar tantas veces como quieras. La caja conserva su id (`:b7`) para la obra; el nombre es
una cosa más que guarda, se muestra junto a su id, se escribe en el código como `(name-box :b7 :osc)`, y todos los
comandos lo aceptan en lugar del id: `(connect :osc 0 :out 0)`, `(text! :osc "osc~ 440")`, `(send! :osc 220)`,
`(-> :osc (to "dac~ 1 2"))`. Un nombre es de una sola caja: `(name-box :b9 :osc)` se lo da a otra; `(name-box :b9 nil)`
se lo quita.

**Funciones como cajas.** Una caja con el nombre de una función pura de `clojure.core` (o de
`clojure.string`, como `str/…`) es esa función, sin escribir ningún componente: sus otras palabras son
sus argumentos, leídos como EDN, y el mensaje que llega va al final, como con `->>`. `%` lo pone en otro
sitio. El texto se lee como Clojure y las entradas como Max: esté donde esté escrito `%`, el mensaje es
siempre la **entrada izquierda, la única caliente**; los demás argumentos tienen cada uno una entrada a la
derecha, en el orden en que están escritos, que los sustituye sin enviar nada. Un bang a la izquierda
vuelve a enviar con el último mensaje; un resultado `nil` no envía nada.

| caja | mensaje | envía | entradas |
|---|---|---|---|
| `into [440]` | `[1 2]` | `[440 1 2]` | el mensaje · `[440]` |
| `conj % 440` | `[1 2]` | `[1 2 440]` | el mensaje · `440` |
| `vector % 0 0` | `1` | `[1 0 0]` | el mensaje · `0` · `0` (un *pack*) |
| `hash-map :freq % :amp 0.5` | `440` | `{:freq 440 :amp 0.5}` | el mensaje · `:freq` · `:amp` · `0.5` |
| `map inc` | `[1 2]` | `[2 3]` | el mensaje · `inc` |
| `str/upper-case` | `"do"` | `"DO"` | el mensaje |

Solo hay funciones puras (`map`, `filter`, `take`, `assoc`, `sort`, `frequencies`…), así que estas cajas
son seguras en una sala compartida; una clase con el mismo nombre (`+`, `print`) va primero.

**Datos como funciones.** Como en Clojure, una keyword, un conjunto o un mapa escritos primero también
son funciones, y el mensaje va primero, `(:freq msg)`:

| caja | mensaje | envía |
|---|---|---|
| `:freq` | `{:freq 440 :amp 1}` | `440` — un campo de un evento |
| `:freq 220` | `{:amp 1}` | `220` — el valor por defecto, que tiene entrada |
| `#{60 64 67}` | `64` · `62` | `64` · nada — un filtro |
| `{60 :c 64 :e}` | `64` | `:e` — una tabla |

**Todas las entradas calientes: `^:hot`.** Escrito antes de la clase, como Clojure escribe los metadatos,
`^:hot` hace que un argumento nuevo envíe enseguida con el último mensaje (`nil` antes del primero), como
`pak` en Max: `^:hot vector % 0 0`.

**Sobre un flujo: `xf/`.** `xf/` delante de una función convierte su *transductor* en una caja con
memoria: recorre los mensajes que llegan uno a uno, no una colección, y lo que deja pasar sale mensaje a
mensaje.

| caja | hace |
|---|---|
| `xf/partition-all 4` | junta 4 mensajes y los envía como un vector |
| `xf/partition 4 1` | los últimos 4 en cada mensaje (una ventana deslizante) |
| `xf/dedupe` | deja pasar un mensaje solo cuando cambia |
| `xf/take 1` | solo el primer mensaje (un bang también es un mensaje) |
| `xf/filter odd?`, `xf/map inc`, `xf/mapcat reverse`… | como en Clojure, mensaje a mensaje |

`:flush` lo completa (`partition-all` envía lo que guarda) y vuelve a empezar, `:clear` vuelve a empezar
sin enviar, y un argumento nuevo a la derecha también vuelve a empezar. La ayuda de cada una de estas cajas
(**?**) enlaza a su página de [clojuredocs.org](https://clojuredocs.org) y a la referencia de
[clojure.org](https://clojure.org/reference/transducers).

**Elegir un camino: `dispatch`.** `dispatch n` envía lo que llega por la izquierda por una de sus n salidas,
numeradas desde 0 como todos los puertos. La entrada derecha elige: `msg 1` (salida 1), `msg nil` o
`msg false` (cerrado: no sale nada), `msg true` (salida 0, así que `dispatch 1` es una puerta que se abre y se
cierra). Una función elige para cada mensaje, y nil no lo deja pasar por ninguna: un mapa `{60 0 64 1}`, una
keyword `:to` (el camino escrito en el evento), un nombre o una forma (`even?`, `(comp …)`); un conjunto
deja pasar a sus miembros por la salida 0. El selector puede escribirse después de n:
`dispatch 2 {60 0 64 1}`. Su nombre viene de la *dispatch function* de los multimétodos de Clojure,
que mira un valor y elige adónde va.

**Funciones por los cables.** Una función viaja como su forma, datos EDN. `comp`, `partial`, `juxt`,
`complement`, `fnil`, `constantly`, `every-pred` y `some-fn` son cajas que envían una con un bang:
`comp inc (partial * 2)` envía `(comp inc (partial * 2))`. Allí donde una caja toma un argumento, un
nombre o una forma así *es* esa función, de modo que una forma enviada a la entrada de `inc` en `map inc`
cambia la función en directo (igual con `xf/filter odd?` o `sort-by :freq`). Las formas también se pueden
escribir en una caja y anidar: `map (partial * 2)`, `map (juxt inc dec)`. Con `%`, un constructor toma la
función que llega: `comp % inc`. De una forma solo se hacen estas funciones puras (y `+ - * /`), y cada
navegador la reconstruye a partir de ellas, así que es tan segura en una sala compartida como cualquier
argumento; un nombre que no conoce (o una llamada como `(inc 1)` en lugar de una función) no se envía y se
escribe en el REPL. Para enviar una función por su nombre, un `msg` con el nombre: `msg inc` (una
keyword, `msg :inc`, sigue siéndolo: una clave, y una función por sí misma).

## 3. Sonido y tiempo

- **▶** (o la barra espaciadora) pone en marcha el sonido y el tiempo: audio, `metro`, `ramp`,
  `loadbang`, `mt play`. El primer ▶ también pide permiso al navegador para sonar.
- **■** silencia y devuelve cada caja a su estado inicial.
- **`print`** escribe en el REPL lo que le llega, tras su etiqueta: `print out0` escribe `out0: 60` (sin
  ella, `print: 60`); un string tal cual, lo demás como EDN. Para dar forma al texto, **`format`** delante,
  como el de Clojure (el printf de Java): `format "%.1f Hz"` envía `"440.1 Hz"`, `apply format "%s Hz · %.1f dB"`
  rellena varios desde una lista — `%s`, `%d`, `%.2f`, `%e`, `%x`, anchos (`%5.1f`, `%-8s`, `%03d`) y `%%`.
- Los mensajes viajan sin ▶: un clic en un `bang` o un `msg`, un número arrastrado, una caja de datos
  que cambió.
- Un `msg` envía lo que lleva escrito, leído como en Clojure: números (`msg 0 8 4`), **keywords con sus
  dos puntos** (`msg :stop`, `msg :rec 4`), **nombres** (`msg inc`: una función allí donde una caja toma
  una; también texto libre como una nota `e4`, un ratio `6/5`, una URL o una dirección OSC), `true`,
  `false`, `nil`, **texto entre comillas como cadena** (`msg "https://…/voz.ogg"`, `msg "dos palabras"`) y
  formas EDN (`msg [0 4 7]`, `msg {:freq 440}`), solos o en una lista (`msg :url "github:…" 3`). Una
  palabra sin sus dos puntos es un nombre, no una keyword: `msg stop` no para un `metro`, `msg :stop` sí.
- **Síntesis estocástica**: `gendy~ 110` (en `@kairotic/synth`) es un oscilador a partir del GENDY de
  Xenakis: una onda de puntos de quiebre cuyas amplitudes y duraciones hacen paseos aleatorios ciclo a
  ciclo — una altura que deriva, un timbre que no deja de cambiar. `[:x-step 40]` deja vagar la altura,
  `[:y-step 0.2]` el timbre; una señal en su entrada modula su frecuencia. Su patch de ayuda tiene cuatro
  pasos.
- **Faust como patch** (Estudio 31, `@kairotic/faust-units`): el código de un `faust~` se abre junto a su
  caja con su **patch** a la izquierda, el mismo código como elementos de Faust —primitivas (`+ * ' @ sin
  select2`…), controles (`hslider button`…), funciones de librería (`os.osc fi.lowpass en.adsr`…), `in` y
  `out`—. Doble clic en el papel para una caja nueva (un nombre, un número o cualquier expresión de Faust,
  que se queda como caja de código), arrastra de una salida a una entrada, Supr borra. Editar el patch
  reescribe el código de al lado y editar el código redibuja el patch; Ctrl/⌘+Enter o Aplicar lo aplica,
  como siempre. Un bucle debe pasar por el retardo de una muestra `'` (en código, `~`). El código que las
  cajas no pueden leer sigue sonando, con el patch marcado como desactualizado. **Patch** en la barra de la
  ventana lo oculta. La ventana se abre junto a la caja, para que sus parámetros sigan a la vista en el patch.
- **Una receta a partir de un sonido** (Estudio 35): **Recipe** en la barra de la ventana de un `faust~`
  busca los valores de sus sliders que suenan más cerca de un sonido: una caja sample del patch o un
  archivo de sonido. Toca el código sin conexión, una nota de un segundo (un botón `gate`, si lo hay,
  pulsado 0,65 s), muchas veces: primero ajustes al azar, luego una búsqueda que escucha como `features~`,
  con la altura oída como la oye `pitch~` y fijada, en un slider llamado `pitch`, `key`, `note` o `midi`
  (MIDI) o `freq` (Hz). *quick* lo toca unas 200 veces, *careful* unas 450; **Stop** la detiene. Los
  valores encontrados se escriben en el código, cada slider empezando ahí: editado, no aplicado, así que
  Ctrl/⌘+Enter los aplica como un solo evento y la caja los muestra en sus parámetros. **▶ sound** y
  **▶ found** tocan el segundo que escuchó y lo que encontró. Compara timbres con independencia del
  volumen; una escala logarítmica donde el código dice `[scale:log]` le ayuda.
- **Los descriptores como partitura: `realize~`** (Estudio 37, `@kairotic/analysis`): una caja delante de
  un `faust~` que lo toca a partir de cuatro descriptores: **sonoridad** (dB, o un nivel 0…1 como el `rms`
  de `features~`), **brillo** (el centroide espectral, Hz), **ruido** (la planitud espectral, 0…1) y
  **altura** (Hz como los envía `pitch~`, 0 si no hay; MIDI con `realize~ midi`). El slider `pitch` o `freq`
  del `faust~` toma la altura, su slider `gain` la sonoridad, y los demás sliders toman los ajustes de ese
  `faust~` que suenan más cerca del brillo y el ruido escritos. Para conocerlos **aprende** el `faust~` al
  que llega su salida izquierda: cuando llegan los primeros valores (o con `:learn`, tras cambiar su código)
  toca unos cientos de ajustes estables sin conexión y los escucha. Lo que entra pueden ser `features~` y
  `pitch~` de otro sonido —cantas, y un sintetizador sigue tu sonoridad, brillo, ruido y altura con su
  propio sonido— o curvas dibujadas en canvas leídos con `reader~` y `snapshot~`. Su salida derecha dice lo
  lejos que está el ajuste más cercano de lo escrito (por encima de 1, el `faust~` no puede sonar así: un
  ruido tan oscuro como un tono, por ejemplo); un `monitor` muestra lo escrito junto a lo que `features~`
  oye en el resultado. Puede **escuchar lo que toca**: un `features~ 20` sobre el `faust~`, con sus tres
  salidas (rms, centroid, flatness) en las tres últimas entradas de `realize~`, y pide más donde lo que se oye
  se queda corto de lo escrito, poco a poco y con límites; la sonoridad pasa a ser el nivel tal como lo oye
  `features~`.
- **Faust a varias voces**: un `faust~` cuyo código declara `declare options "[nvoices:8]";` es
  polifónico. Su voz usa `freq`, `gain` y `gate`, que se fijan nota a nota; los Hz van a su entrada
  izquierda y los ids de voz a la derecha, como con `synth~` (un `keyboard` 0→0, 1→1, 3→0; `mt play`
  0→0, 1→1), en cualquier afinación; `effect = …;` en el mismo código se aplica a la suma de las voces.
  Su patch de ayuda lo muestra.
- **Sonido de fuera**: `adc~ 1` es el micrófono (o una entrada de la tarjeta de sonido: `adc~ 1 2`). Al
  pulsar ▶ el navegador lo pide una vez; su sonido llega tal cual, sin el procesado pensado para
  llamadas. `scope~` dibuja una señal y `snapshot~ 50 db` la convierte en números (su nivel), para que
  lo que se oye mueva el patch. Usa auriculares antes de enviar un `adc~` a `dac~`: se realimenta.
- **Grabar**: una caja `sample` graba lo que le llega con `:rec` hasta `:stop` (o hasta su duración:
  `sample 10`), y un `reader~` con el sample a su derecha lo reproduce en la posición de su izquierda, en
  segundos —o, como `reader~ norm`, de 0 a 1: un `phasor~` directo, con `!/ 1` convirtiendo su duración (su
  outlet izquierdo) en la velocidad del phasor~—; cualquier otra velocidad lo toca más rápido, más lento o
  al revés. Todo reader y reader~ lee así: en las unidades de su buffer (el eje X de un canvas, el tiempo de
  un freqt, segundos), o de 0 a 1 con `norm`. El sonido se queda en este navegador; la obra
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
  `form~` compara cada momento con los demás (una matriz de autosimilitud de un chroma o un mfcc, dibujada):
  un bang donde empieza una sección, el periodo que se repite y un `[:segment …]` que hace que `onset~` empiece de nuevo.
  `transcribe` escribe lo que oye `pitch~` en un `freqt` — `:rec`, tocar, `:stop` — como notas a su
  altura o, con `transcribe 60 glide`, como contornos que siguen la voz (un `onset~` a su derecha separa
  las notas repetidas); el freqt visto como partitura la muestra en notación, y una caja `quantize` (la
  segunda salida del freqt en su entrada derecha, un bang) la escribe en compases como árbol, para una caja
  `tree` — con el compás, las divisiones y las demás opciones que le des, y `:time :track` para una frase
  cantada libremente.
- **Grabar un gesto**: `record [lo hi]` escribe cualquier flujo de números en un `canvas` como trazos en
  el tiempo — un knob, una envolvente (`snapshot~ 50 rms`), un descriptor (`features~ 20 centroid`) —:
  `:rec`, tocar, `:stop`. Un valor se mantiene hasta el siguiente; los ejes siguen a la toma. Se edita
  como cualquier dibujo y se vuelve a leer con `phasor~` → `reader~ norm` como automatización.
- **Grabar desde un punto**: `:rec t` (`msg :rec 4`) en un `sample`, `record` o `transcribe` conserva lo
  que había antes de t (segundos; pulsos en transcribe) y graba desde t, sustituyendo lo que venía
  después: un punch-in. `:ovr t` (`msg :ovr 4`; `:ovr` solo, desde 0) sobrescribe solo lo que cubre la
  toma, de t a donde se para, y conserva lo que venía después: un punch-in/out. Un canvas o freqt acepta
  `[:cut t]` para eso (todo desde t) y `[:cut t1 t2]` (lo que hay entre ambos; un trazo que lo cruza se
  parte en dos).
- **Un tramo de tiempo con cabezales**: un `ring [segundos]` guarda los mensajes de los últimos segundos,
  cada uno en su tiempo; su cabezal de escritura da la vuelta como uno de cinta. Un `reader` en su salida
  derecha es un cabezal propio: `reader d 1` sigue al cabezal del ring 1 s por detrás —un canon, un
  delay—; dos lectores, un canon a tres voces; `reader d 1 speed 0.5`, una aumentación; a −1 vuelve atrás
  por lo escrito. Un número en la izquierda de un reader lo mueve en su lugar (una rampa, un counter), en
  cualquier sentido; un movimiento mayor que su `jump` es un salto. Un `writer` (lo que escribe · el buffer
  del ring · una posición) escribe donde está, desde cualquier fuente, borrando lo que pasa (o `writer
  mix`, dejándolo); `:rec t` / `:ovr t` lo llevan a t a velocidad 1. Un reader que entra en un writer del
  mismo ring es una realimentación: un canon perpetuo.
- **Lo mismo con sonido**: `ring~ [segundos]` guarda los últimos segundos del sonido de su izquierda (sin
  nada ahí, su cabezal no escribe: el ring es lo que escriben sus `writer~`). Un `reader~` en su salida
  derecha sin señal de posición sigue a su cabezal: `reader~ d 1` un delay, `reader~ d 1 speed 0.5` una
  octava abajo y quedándose atrás, `speed -1` al revés; una `d` nueva (`msg :d 0.25`) se desliza, doblando
  la altura, o salta con un fundido. Con una señal de posición lee ahí (segundos; `norm`: 0…1, un
  `phasor~`). Un `writer~` (sonido · el buffer del ring~ · una señal de posición) escribe como un cabezal de
  cinta: `ovr` sustituye, también con silencio; `writer~ mix 0.8` suma, conservando lo que había por 0,8.
  Hasta 8 cabezales comparten el único nodo del ring~, así que una realimentación dentro de él es exacta (a
  través de otras cajas cuesta un bloque de 128 muestras). Un `faust~` entre un `reader~` y un `writer~` del
  mismo ring~ (`reader~ → faust~ → writer~`) corre dentro del nodo del ring, muestra a muestra: el bucle sigue
  siendo exacto, así que una d corta con un paso bajo en el bucle es una cuerda pulsada (estudio 49).

## 4. La historia

Cada gesto es un evento de la historia, abajo en la página.

- **Ctrl+Z** va atrás, **Ctrl+Mayús+Z** (o Ctrl+Y) adelante; o haz clic en cualquier punto de la historia.
- Hacer algo después de volver atrás crea una **rama**: no se pierde nada.
- **Merge…** trae aquí los eventos de otra rama, cuando no chocan.
- En una sala, los gestos de los demás llegan a la misma historia; *Follow the front* te mantiene en el
  punto más nuevo.
- **◆ Snapshot** —`(snapshot)`, o `(snapshot "intro")` con un nombre— escribe un fotograma clave: un
  punto de la historia con la obra tal como está ahora. Se dibuja como un cuadrado.

### La historia como base de datos

La obra en cada punto de su historia es un valor: los eventos hasta ahí, aplicados en orden (como la base de
datos de Datomic es sus hechos acumulados). Cada evento guarda su **transacción**: cuándo se hizo y de dónde vino
—un gesto, la REPL, la pestaña Claude, una caja agent (con su petición), un merge, una toma de Perform—. Lo dicen
los tooltips de la historia, y la REPL lo lee como datos (discusión #382).

- `(as-of ["segmento" n])` — la obra tal como era en ese punto; `(as-of)` donde estás.
- `(with "(box \"osc~ 440\" 40 40)")` **prueba** un cambio sin hacerlo: `{:db-before :db-after :tx-data}`, la
  obra tal como quedaría y los eventos que haría, sin guardar nada. También prueba eventos
  (`(with [[:move :b3 40 60]])`), en un punto del pasado (`(with ["segmento" n] …)`) o sobre un patch.
- `(transact! (with …))` hace lo que se probó, como un solo cambio, desde el punto donde se probó.
- `(tx-at)` — la transacción del evento que lleva hasta aquí: `{:event :kind :author :t :via :box :why}`, donde
  `:kind` es `:work`, `:layout` (cajas movidas, colocadas, mostradas en otra vista) o `:mark`.
- `(tx-log)` — las transacciones desde el principio hasta aquí, una secuencia para leer con Clojure:
  `(filter #(= :agent (:via %)) (tx-log))`, `(remove #(= :layout (:kind %)) (tx-log))`, `(group-by :author (tx-log))`.

- `(db)` — la historia como **valor**: no cambia cuando la historia crece, así que una consulta larga, un agente o
  Claude leen un valor coherente. Todas las funciones de aquí lo aceptan como primer argumento: `(as-of db)`,
  `(tx-log db)`, `(with db …)`, `(datoms db)`.
- `(datoms)` — los **hechos** de la historia hasta aquí, como los datoms de Datomic: `{:e :a :v :added}` (una entidad
  —una caja por su ruta, `[:b3]`, o `[:b5 :b2]` dentro de un subpatch—, un atributo —`:text`, `:x`, `:y`, `:data`,
  `:line`…—, un valor, afirmado o retirado), cada uno con su transacción. Se leen de la obra antes y después de cada
  evento, así que todos los eventos los tienen, sea cual sea su forma. `(history-of :b3)` — los hechos de una caja,
  del más antiguo al más nuevo.
- Claude, en la pestaña Claude y en una caja agent, lee la historia igual: su herramienta `work_history` da las últimas
  transacciones, o los hechos de una caja, del valor que tenía la historia cuando empezó la petición.
- `(schema)` — qué son los atributos de un árbol y los eventos de la historia, como datos: `(schema :tree)`, cada
  atributo con su capa (`:performance`, `:analysis`; ninguna para lo escrito), que leen las capas, la ventana de
  código y las lentes (#380); `(schema :events)`, cada evento con lo que cambia.

Los eventos hechos antes de esto no tienen transacción: dicen quién los hizo (los de su segmento), no cuándo ni de
dónde.

En una sala compartida con relay, el *cuándo* se lee de un solo reloj para toda la sala: el del relay, tal como lo
lee cada página (el mismo reloj que usan la conversación y el tempo de la sala). Así todas las páginas ven el mismo
punto más nuevo de la historia y el mismo orden de los cambios en un jam, diga lo que diga el reloj de cada máquina.
En otro caso es el reloj de esta máquina. `(work-clock)` dice cuál: `{:source :relay :offset … :error …}` o
`{:source :local}`.

### Consultar la historia con Datalog

`(q '[:find … :where …])` le hace una pregunta a la historia en Datalog, el lenguaje de consultas de Datomic, y
[DataScript](https://github.com/tonsky/datascript) la responde: se carga desde el CDN la primera vez que hace falta
(la primera consulta puede contestar que todavía está cargando: vuelve a preguntar un momento después). La historia
sigue siendo lo que es; para cada valor suyo que se consulta, DataScript recibe un índice, hecho una vez y ampliado a
medida que la historia crece.

- `(q query)` donde estás; `(q query db)` en un valor de la historia; `(q query db ["segmento" n])` en cualquier punto
  de cualquier rama; `(q query (with …))` sobre una prueba, como si se hubiera hecho. Más argumentos son las entradas
  de su `:in`.
- Lo que puede preguntar, `(schema :history)`: las **transacciones** (`:tx/via`, `:tx/box`, `:tx/why`, `:tx/kind`,
  `:tx/op`, `:tx/seq`, `:tx/t`, `:tx/author`, `:tx/pos`), los **hechos** que cada una afirmó o retiró (`:fact/tx`,
  `:fact/e` —una caja por su ruta, `[:b3]`—, `:fact/a`, `:fact/v`, `:fact/added`), y la **obra en ese punto**
  (`:box/id`, `:box/class`, `:box/text`, `:box/path`, `:box/parent`…; `:line/from`, `:line/outlet`, `:line/to`,
  `:line/inlet`).
- `(pull '[*] [:box/path [:b3]])` — una entidad con sus atributos; `(entity e)` es `(pull '[*] e)`.
- Una ruta o un punto se comparan a través de `:in`, no escritos dentro de una cláusula:
  `(q '[:find … :in $ ?e :where [?f :fact/e ?e] …] (db) [:b3])`.
- Claude lee la historia igual: su herramienta `work_history` también acepta una consulta.
- DataScript llega en cuanto se abre la REPL o la pestaña Code, así que la primera consulta suele encontrarlo ya.
- Lo que cuesta: el índice de un valor se hace la primera vez que se consulta, se guarda y crece solo con los
  eventos nuevos cuando la historia sigue. Medido en el Chromium sin interfaz de los tests (GitHub Actions, noviembre
  de 2026), con una historia de un segmento sobre 100 cajas: 300 eventos, unos 40 ms la primera vez, 2–3 ms otra vez,
  11–14 ms tras un evento más; 2000 eventos, 270 ms la primera vez, 17 ms otra vez, 20 ms tras un evento más; 5000
  eventos, alrededor de 0,5 s la primera vez (medido a solas; con el resto de los tests a la vez, más o menos el doble). (`KAIROTIC_BENCH=1`, o *bench* al lanzar a mano el workflow de
  tests, ejecuta solo estas medidas, con 2000 y 5000 eventos.)

Algunas preguntas:

```clojure
;; qué cajas cambió Claude en esta rama
(q '[:find [?id ...] :where [?t :tx/via :claude] [?f :fact/tx ?t] [?f :fact/e ?p] [?b :box/path ?p] [?b :box/id ?id]])

;; todos los textos que ha tenido la caja del bajo :b3, en orden (la voz que tocaba antes de ser lo que es)
(sort-by first (q '[:find ?s ?v :in $ ?e :where [?f :fact/e ?e] [?f :fact/a :text] [?f :fact/added true]
                                               [?f :fact/v ?v] [?f :fact/tx ?t] [?t :tx/seq ?s]] (db) [:b3]))

;; qué hizo el agente :b7 desde un punto de la historia: cada cambio y su petición
(q '[:find ?s ?why ?op :in $ ?from :where [?x :tx/pos ?from] [?x :tx/seq ?s0] [?t :tx/box :b7] [?t :tx/seq ?s]
                                         [(>= ?s ?s0)] [?t :tx/why ?why] [?t :tx/op ?op]] (db) ["segmento" 12])

;; qué alimenta el dac~: las cajas conectadas a él ahora
(q '[:find [?id ...] :where [?d :box/class "dac~"] [?l :line/to ?d] [?l :line/from ?b] [?b :box/id ?id]])
```

### Líneas

Una obra puede tener varias **líneas**: historias independientes, cada una en una pestaña sobre el patch.
La línea principal (★) es la obra como siempre fue; las otras son estudios, bocetos, partes — cada una con
su propio patch, sus propias ramas, fusiones y snapshots.

- **+** crea una línea nueva, vacía — `(new-line "boceto")`. Un clic en una pestaña pone su línea en
  pantalla — `(go-line "boceto")`; cada pestaña vuelve al punto donde la dejaste.
- Doble clic en la pestaña en pantalla para renombrarla — `(rename-line "intro")`; **×** la archiva (se
  guarda, con su historia, y vuelve desde *archived* — `(restore-line "boceto")`). `(work-lines)` las lista.
- La línea en pantalla es aquella con la que trabajan el patch, Perform, Share/Export, Release y Claude.
- El motor toca la línea donde pulsaste ▶ (su pestaña también muestra ▶): cambiar de pestaña no lo para, y el
  transporte dice qué línea suena. Los mensajes de la pestaña en pantalla siguen viajando; sus cajas de audio
  callan hasta que pulsas ▶ en ella, que la convierte en la línea que suena. En una sala, las posiciones de los demás se dibujan solo en la
  línea en la que están; seguir a alguien a otra línea abre su pestaña.
- Las líneas no cambian mientras tocas en Perform, en una lección o en el patch de pruebas.

**Una línea dentro de otra.** `patch @nombre` usa la línea llamada *nombre* como subpatch (los espacios de su
nombre se escriben `-`: `patch @linea-de-bajo`); sus cajas `inlet` / `outlet` son los puertos de la caja. Doble
clic abre la línea en su pestaña.

- **Sigue** la línea (↻): es la línea en su punto más nuevo, así que cambia cuando la línea avanza, para todas
  las cajas que la usan. `(pin-ref :b3)` la **fija** en el punto que lee ahora (⌖ y ese momento);
  `(follow-ref :b3)` vuelve a seguirla. Una línea no puede contenerse a sí misma, ni a una línea que la usa.
- Mientras tocas en Perform, las líneas seguidas se quedan donde estaban al empezar. Un snapshot guarda dónde
  están, y su punto las toca así: volviendo atrás en la historia, un punto posterior a un snapshot oye las líneas
  como eran entonces (en el punto más nuevo, como son ahora).
- Dentro de una línea usada así, `adc~` y `dac~` callan: suenan cuando la línea suena sola (su propio ▶), así
  que una línea se puede probar con su propia entrada y salida. El sonido entra y sale por `inlet~` / `outlet~`;
  la caja avisa (⚠) cuando su línea tiene `dac~` y ningún `outlet~`, o `adc~` y ningún `inlet~`.
- Renombrar una línea reescribe las cajas en pantalla que la usan; las de otras partes la siguen encontrando por
  su nombre anterior.
- Mientras la línea que suena usa la línea en pantalla (y su pestaña está en su punto más nuevo), la pestaña la
  muestra donde suena, y lo que tocas ahí va a todas las cajas que la usan (el transporte dice ×2, ×3…). Para
  tocar una sola, toca la línea que la usa.
- El inspector de una caja patch (⌘/Ctrl+clic) tiene lo que puede hacer con las líneas: un patch embebido se
  puede **extraer** a una línea nueva, con la historia que tenía dentro de la caja — `(extract-line :b3
  "filtros")`; un `patch @nombre` se puede fijar, seguir, abrir o **incrustar** — `(inline-ref :b3)`: una copia de
  su línea dentro de la caja, separada de ella.
- Un enlace (Share/Export) o un release lleva **una sola línea**: cada `patch @nombre` pasa a ser un patch
  embebido con su línea tal como suena ahí — en cada fotograma clave de un release, como lo guardó el snapshot.

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
  se tocan en una jam), y no se escribe nada hasta `:keep`. Un knob que conduce el morph no se mueve con él.
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
  compacta es un release. Desde la REPL: `(excise! [["segmento" 3] …])` —la única manera de que algo salga de una
  historia, como la excisión de Datomic: el cambio que sustituye a los puntos lo dice (`:via :excise`), y cada
  segmento guarda constancia de ello (`(excisions)`).

## 5. Las pestañas de la derecha

El panel de la derecha puede dejar sitio al patch: **»** en su cabecera (o **›** en la barra entre ambos)
lo oculta, y **‹** lo devuelve; pedir una pestaña —**?** o F1 sobre una caja, `(docs …)`, un tutorial—
también lo muestra. Arrastra la barra entre el patch y el panel para darle otro ancho; un doble clic en
la barra lo oculta o lo muestra. Este navegador recuerda cómo lo dejaste. Desde la REPL:
`(side-panel false)`, `(side-panel true)`, `(side-panel 480)`, `(side-panel :auto)`.

- **Code** — la obra como **Calls** (llamadas: `box`, `connect`, …), editable: Ctrl/⌘+Enter las aplica (solo
  lo que cambian, como un evento), ⇧+Intro evalúa sola la forma del cursor. **Data** muestra la misma obra como datos (EDN): el estado que produce la
  historia, todas las claves de todas las cajas, en solo lectura, para inspeccionarlo (plegado y búsqueda
  con Ctrl/⌘+F). Lo que hayas editado sin ejecutar sigue en las llamadas mientras miras los datos.
- **Components** — las clases que conoce esta obra. Las cajas que las definen (`component`) se guardan
  aquí, no en el patch, porque no tienen entradas ni salidas: **New component**, **Edit** (su código en
  la ventana de código), **Publish**, ×; un clic en una fila la elige para que Claude la cambie. Importa
  las publicadas, o usa las de la biblioteca compartida.
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
`[:curve …]`, `[:text …]`, `[:group {:x :y :rotate} […]]`— o como las escribe un msg: `msg :circle 40 40
10 :accent :hit :sun`. Una lista las sustituye todas, `[:set k figura]` mueve la llamada k, `:clear` la
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
- **La obra como archivo**: lo primero de **Share/Export** (y *Download this work* en **Sessions**) guarda la obra
  como un archivo `.kairotic` — cada línea, toda su historia y los sonidos grabados — o un release de ella;
  *anonymous* deja fuera quién la hizo. **Sessions → Open a file…** abre uno como una obra nueva (solo, o local
  sin base de datos): una copia de seguridad, o una manera de llevar una obra de Pages a claude.ai y al revés. Los
  samples cargados desde una URL quedan como referencias. `(export-work)`, `(export-work {:release true :anonymous true})`.
  Un `.kairotic` es un zip de EDN (`manifest.edn`, `work.edn`, `lines.edn`, `history.edn`, `people.edn`) y
  `sounds/<hash>.wav` (float de 32 bits).
- **Share/Export** da un enlace y un iframe con este patch (o este paso de tutorial) para Notion, un blog o un
  curso; *Release/Perform* da un release que se abre en Perform, mostrando solo el panel. Ver [Insertar](embed.es.md).
- Una petición a Claude se puede compartir en la
  [Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery).

## 10. Teclas

| | |
|---|---|
| doble clic en un sitio vacío | una caja nueva (lo que empieza por `(` es una línea de la REPL) |
| `(` en el patch | una línea de la REPL, ahí (Intro la ejecuta, ↑ ↓ su historia, Esc la cierra) |
| I | mostrar el id de todas las cajas (una caja lo muestra siempre al pasar por encima o seleccionada) |
| clic en una caja mientras una línea de código espera una | escribir ahí su id (`:b7`, `@b7` en un mensaje de Room) |
| doble clic en un number, knob o deslizador | escribe su valor (Intro lo aplica, Esc cierra) |
| Supr / Retroceso | borra las cajas o la línea seleccionadas |
| ⌘/Ctrl+C · X · V · D | copiar · cortar · pegar (donde está el puntero) · duplicar las cajas seleccionadas |
| ⌘/Ctrl+clic | edita una caja debajo de ella (sus argumentos y su texto) |
| ⇧+clic · un marco · ⌘/Ctrl+A | selecciona varias cajas · todas |
| Esc | deselecciona, o cierra el editor de la caja |
| arrastrar la esquina de un canvas, freqt o partitura | la redimensiona (doble clic: su tamaño por defecto) |
| arrastrar la barra junto al panel · » · ‹ | redimensiona el panel de la derecha · lo oculta · lo muestra |
| espacio | ▶ / ■ |
| ? o F1 | ayuda de la caja seleccionada |
| F1 o Ctrl/⌘ + ? (escribiendo una caja) | ayuda de la clase elegida en el menú, o escrita |
| Ctrl+Z · Ctrl+Mayús+Z · Ctrl+Y | atrás · adelante en la historia (en Perform, en la toma) |
| Ctrl+Intro | aplica código (pestaña Code, cajas de código, pestaña Claude) |
| ⇧+Intro (pestaña Code) | evalúa sola la selección, o la forma del cursor |
| Ctrl/⌘+Intro (vista Live) | evalúa el bloque del cursor (las líneas entre vacías) |
| ↑ ↓ + − ← → Supr | edita la nota seleccionada de una partitura, o el trazo de un canvas |
| Intro · a…g | el silencio seleccionado de una partitura se vuelve nota (a…g también cambia la altura de una nota) |
