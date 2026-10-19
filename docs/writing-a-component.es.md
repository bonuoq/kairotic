# Escribir un componente

*[Read in English](writing-a-component.md)*

Cada caja de un patch de Kairotic es una instancia de un **componente**: un mapa de datos y
funciones escrito en ClojureScript. Se puede escribir dentro de una obra (una caja `component`),
compartir en la biblioteca de un espacio o publicar en npm. Esta guía construye uno pequeño paso a
paso y después lee la `knob`, el primer componente con vista propia.

El código y los nombres están en inglés (desde el Ensayo 9); el [glosario](glossary.md) da la
equivalencia de cada término.

## 1. El componente más pequeño

Crea una caja `component`, haz doble clic en su código y escribe:

```clojure
{:class "twice"
 :doc "Doubles every number it receives."
 :io [1 1]
 :receive (fn [{:keys [value]}]
            (if (number? value) {:out [[0 (* 2 value)]]} {}))}
```

Aplícalo (Ctrl/⌘+Enter). La caja muestra `✓ defines «twice»` y ya puedes crear cajas `twice`.

- `:class` es la primera palabra del texto de la caja.
- `:io [entradas salidas]`.
- `:receive` es una **función pura**: recibe un mensaje y devuelve lo que debe pasar.

## 2. Mensajes

`:receive` recibe un mapa:

| clave | qué es |
|---|---|
| `:inlet` | la entrada por la que llega el mensaje (0 es la izquierda) |
| `:value` | el mensaje: un número, una lista, una palabra como `:bang` |
| `:state` | lo que la caja guardó la última vez (nil al principio) |
| `:args` | los argumentos escritos en el texto de la caja |
| `:at` | el instante del mensaje en el reloj de audio |

…y devuelve un mapa con cualquiera de estas claves:

| clave | qué hace |
|---|---|
| `:out [[salida valor] …]` | manda valores, en este orden |
| `:state x` | guarda `x` para el siguiente mensaje |
| `:later [[at entrada valor] …]` | programa mensajes a sí misma en el futuro |
| `:effects [[k x] …]` | efectos en su nodo de audio, o `[:print x]` |
| `:show v` | lo que muestra la caja (una caja number lo enseña; una vista propia lo dibuja) |

## 3. Argumentos declarados

Escribe los argumentos como una sección en vez de interpretar el texto a mano:

```clojure
 :args [[:factor 2]]
```

Ahora `twice 3` da `(:args m)` = `{:factor 3}`, y `twice` solo da `{:factor 2}`. El tipo del valor
por defecto decide cómo se rellena cada argumento con las palabras de la caja:

- un **número**, o la clave de un argumento anterior (`[:initial :min]`), toma el siguiente número;
- `true` / `false` es un **interruptor**, activo si se escribe su nombre (`[:log false]` ↔ `knob 20 20000 log`);
- cualquier otra cosa (`nil`, un texto) toma la siguiente **palabra** libre, como keyword (`[:name nil]` ↔ `knob 0 1 cutoff`).

## 4. Una vista propia

Un componente puede dibujarse en el patch y responder al arrastre. La vista son **datos**: una
lista de figuras en coordenadas de la caja, no HTML. Los valores que cambian son **huecos**,
keywords que empiezan por `$`, y `:derive` les da valor:

```clojure
 :size [72 78]
 :derive (fn [{:keys [shown args]}] {:angle … :label …})
 :view [[:arc  {:cx 36 :cy 33 :r 23 :from -135 :to :$angle :stroke :accent :weight 5}]
        [:text {:x 36 :y 72 :anchor :middle} :$label]]
```

Figuras: `:rect` `:circle` `:line` `:arc` `:needle` `:path` `:text`. Los colores salen de una
paleta que sigue el tema claro u oscuro: `:ink` `:soft` `:accent` `:kairos` `:bg` `:grid`, en
`:stroke` y `:fill`; `:weight` es el grosor. Un hueco también puede nombrar un argumento (`:$min`) o
`:shown`, `:w`, `:h`.

`:shown` es lo último que la caja devolvió como `:show`. `:gesture` convierte un arrastre en un valor:

```clojure
 :gesture (fn [{:keys [start dy fine]}] …)   ; start = lo que se veía al pulsar, dy desde la pulsación
```

El valor llega a la entrada 0 de la propia caja mientras arrastras. Al soltar, `:gesture` se llama
una vez más con `:up true`, y lo que devuelve queda escrito en la historia como `(send! :bN valor)`.
Un gesto que ignora `:up` (un knob) repite su último valor; uno que necesita pulsar y soltar (un
teclado) devuelve un mensaje de soltar, para que ni la historia ni el resto de la sala se queden con
una nota pulsada.

Para vistas difíciles de expresar como plantilla existe una salida de emergencia:
`:draw (fn [m] figuras)`.

## 5. Secciones

Escribe las secciones en este orden, con una línea de comentario antes de cada una:

```clojure
;; knob · a rotary control with its own view in the patch
{;; ── about ──
 :class "knob" :license "MPL-2.0" :doc "…" :usage "knob [min max initial] [log] [name]"
 :io [1 1] :size [72 78]

 ;; ── arguments ──
 :args [[:min 0] [:max 1] [:initial :min] [:log false] [:name nil]]

 ;; ── logic ──
 :receive (fn [m] …)
 :gesture (fn [m] …)
 :derive  (fn [m] …)

 ;; ── view ──
 :view [[:arc …] [:circle …] [:needle …] [:text … :$label]]}
```

Solo la lógica es código; el resto son datos que se pueden leer, comprobar y cambiar sin ejecutar
nada. Lee la [knob](../packages/controls/src/knob.cljs) completa (en `@kairotic/controls`).

Las utilidades disponibles en la lógica vienen de la **API de Kairotic**, `api/…` (desde el Ensayo 14;
antes eran `comp/…`): `api/clamp`, `api/nice` (redondeo razonable), `api/num-of`, `api/to-unit` y
`api/from-unit` (un valor ⇄ 0…1, lineal o logarítmico), `api/padded` (los números del texto de una
caja con valores por defecto), y para audio `api/stereo-outlets`, `api/worklet-node` (un AudioWorklet
cuyo JavaScript viaja dentro del componente) y `api/param`. La API tiene versión (`api/version`): un
paquete declara para cuál se escribió, y el núcleo solo la rompe con una versión mayor nueva. Ver
[`core/kairotic/api.cljs`](../core/kairotic/api.cljs).

**Del sonido de vuelta a los mensajes.** Un nodo de audio no puede enviar mensajes: *informa* de lo que
encuentra a su propia caja con `(api/report! (:id b) valor at)` (`b` es la caja que recibió su
`:create`, `at` el instante del sonido), y el `:receive` de la caja lo recibe por el inlet `:audio`,
donde decide qué enviar, mostrar y guardar, como con cualquier otro mensaje. Para escuchar una señal,
`(api/tap ac opts on-block)` da un worklet que la entrega cada `:hop` muestras, como `:frames` (las
muestras), un `:summary` (último valor, rms, pico) o un `:trace` (mínimo y máximo por columna, estable
sobre un cruce por cero, para dibujarla); los bucles sobre las muestras se ejecutan en el worklet.
`api/retap` cambia sus tamaños y `api/db` pasa un nivel a decibelios. Lee
[`snapshot~` y `scope~`](../core/kairotic/input.cljs).

## 5½. El mismo valor dos veces

Una caja puede recibir otra vez el mismo valor: las cajas de datos (un `tree`) vuelven a enviar lo que
tienen después de ■, cuando una línea hacia la caja es nueva o cambió una caja anterior, y cuando el
gesto de otra persona llega en una sala. Recibirlo otra vez **no debe cambiar nada de lo que está en
marcha**: un reproductor no vuelve a empezar, un acumulador no lo cuenta dos veces, un aprendiz no lo
aprende dos veces. Compara el valor con lo que ya guarda `:state` y, si es el mismo, devuelve el estado
tal cual:

```clojure
(cond (= value (:last state)) {:state state}          ; lo mismo otra vez: nada cambia
      …)
```

## 6. Un componente hecho de un patch

No todas las clases necesitan código. Un **sub-patch** es una caja `patch`: doble clic para abrirla
(o `(enter :b5)`, y `(up)` para volver). Dentro, las cajas `inlet` / `outlet` (mensajes) e
`inlet~` / `outlet~` (audio) son sus puertos, numerados de izquierda a derecha. En código se lee:

```clojure
(box :b5 "patch voice" 40 360)
(inside :b5
  (box :b1 "inlet" 20 20)
  (box :b2 "synth~" 20 80)
  (box :b3 "outlet~" 20 140)
  (connect :b1 0 :b2 0)
  (connect :b2 0 :b3 0))
```

`(abstract :b5 "voice")` lo convierte en clase: una caja `component` con `:patch` en vez de
`:receive`, y `:b5` pasa a ser una instancia. En los textos de dentro, `$1 $2 …` toman las palabras
escritas después del nombre de la clase:

```clojure
{:class "detune"
 :doc "Multiplies every frequency by a ratio ($1)."
 :usage "detune ratio"
 :patch {:boxes {:b1 {:text "inlet" :x 20 :y 20}
                 :b2 {:text "* $1" :x 20 :y 70}
                 :b3 {:text "outlet" :x 20 :y 120}}
         :lines [[:b1 0 :b2 0] [:b2 0 :b3 0]]}}
```

`detune 1.5` sube entonces una quinta. El motor sustituye cada sub-patch por sus cajas (`:b5.b2`…),
así que no cuestan nada al sonar.

### Vistos desde fuera: paneles

Marca cajas dentro de un sub-patch con `(present :b4 x y)` (o solo `(present :b4)`) y el sub-patch se
dibuja desde fuera como un **panel** con ellas, como un bpatcher de Max: sus knobs se pueden tocar sin
abrirlo. También funciona con las abstracciones, porque `:present` viaja dentro de `:patch`. En la
obra, las cajas presentadas forman la **presentación**: pulsa *Present* (o `(presentation true)`) para
ver solo esas, donde las necesita quien interpreta. Mover una caja ahí cambia su lugar en la
presentación, no su lugar en el patch.

## 6½. Pedírselo a Claude

Desde el Ensayo 15, la pestaña **Claude** (o `(ask-component "…")` en la REPL) escribe un componente a
partir de una descripción. Claude lee este mismo contrato, la API y componentes reales como ejemplos, y
antes de responder prueba lo que ha escrito con las herramientas de la página: lo evalúa y valida, le
envía mensajes y dibuja su vista. El resultado es una caja `component` normal, con una cabecera que dice
que se escribió con Claude y qué se pidió; se edita como cualquier otra. Con una caja de componente
seleccionada, "change the selected component" pide un cambio sobre ella. Usa la cuenta de Claude de
quien usa la página, a quien se pide permiso la primera vez.

Desde el Ensayo 16 también escribe Faust (lo compila para comprobarlo), abstracciones con cajas `faust~`
y knobs, y bpatchers (abstracciones cuyas cajas presentadas forman el panel de cada instancia), y un
paquete cuando necesita varias definiciones juntas. Lee ejemplos del [catálogo](../examples/README.md),
que es como le enseñamos nuevos tipos de componentes.

## 6¾. Su ayuda

Desde el Ensayo 18 la pestaña Help (o **?** sobre una caja seleccionada) explica qué hace una clase,
entrada por entrada, con un patch de ayuda que se abre como una lección. Un componente trae la suya con `:help`:

```clojure
:help {:inlets  ["un número: la frecuencia en Hz" "la profundidad, 0…1"]   ; una línea por entrada, desde 0
       :outlets ["la señal"]
       :messages [["bang" "vuelve a empezar"]]
       :example "(box :b1 \"wobble~ 4\" 40 30)\n(box :b2 \"dac~\" 40 90)\n(connect :b1 0 :b2 0)"
       :try "Pulsa ▶ y cambia la velocidad."
       :see ["osc~" "gain~"]}
```

El ejemplo es código de patch, un gesto por línea: al abrir el patch de ayuda se hacen uno a uno.

## 7. Compartirlo

- **En la obra:** la caja `component` viaja con la obra y su historia.
- **En la biblioteca del espacio:** `(publish :bN)` y, en otra obra, `(use! "clase")`.
- **En npm:** publica un módulo que exporte el componente (`export default {class, version, author,
  license, doc, source}`, el formato que escribe [`packages/build.mjs`](../packages/build.mjs));
  cualquiera podrá hacer `(import! "npm:<tu-paquete>@x.y.z/dist/<nombre>.mjs")`.
- **En un paquete oficial** (Ensayo 14): añádelo a `packages/<categoría>/src/` (ver
  [`packages/`](../packages/README.es.md)). Un paquete viaja como una sola caja `component`, y escribir
  una de sus clases en una obra lo trae.

Importar siempre **copia** la definición en una caja `component` de la obra, con una cabecera que
dice de dónde viene y con qué licencia: la obra queda completa y suena igual aunque el paquete
cambie después.
