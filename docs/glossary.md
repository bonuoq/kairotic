# Kairotic glossary · Glosario

From Study 09 on, all code, class names, REPL commands and the interface are in English.
This table maps the Spanish names used up to Study 08 (Ensayo 8) to their English names.

Desde el Ensayo 9, el código, las clases, los comandos de la REPL y la interfaz están en inglés.
Esta tabla relaciona los nombres en castellano (hasta el Ensayo 8) con los nombres en inglés.

## Words · Palabras

| es | en |
|---|---|
| obra | work |
| sala (compartida) | room |
| en solitario | solo |
| ensayo | study |
| caja | box |
| conexión / línea | line |
| entrada / salida (puerto) | inlet / outlet |
| historia, tramo, frente | history, segment, front |
| lienzo | canvas |
| trazo | stroke |
| rejilla | grid |
| afinación | tuning |
| lector | reader |
| puerta | gate |
| envolvente | envelope (adsr~) |
| recorrido (trayectoria) | path |
| componente | component |
| biblioteca | library |
| motor | engine |
| figuras | shapes |
| núcleo | core |
| sub-patch, abstracción | sub-patch, abstraction |
| presentación, panel | presentation, panel |

## Namespaces · Espacios de nombres

| es | en | alias |
|---|---|---|
| kairotic.partitura | kairotic.score | `sc` |
| kairotic.lienzo | kairotic.canvas | `cv` |
| kairotic.componentes | kairotic.components | `comp` |
| kairotic.codigo | kairotic.code | `code` |
| kairotic.faust | kairotic.faust | |
| kairotic.biblioteca | kairotic.library | `lib` |
| kairotic.motor | kairotic.engine | `eng` |
| kairotic.figuras | kairotic.shapes | `shp` |
| kairotic.nucleo | kairotic.core | |

Folders: `nucleo/` → `core/`, `ensayos/` → `studies/`, `componentes/` → `components/` (npm package `kairotic-components`).

## Box classes · Clases de caja

| es | en |
|---|---|
| lienzo | canvas (Study 9–11: frequency over time; from Study 12 a generic canvas, and **freqt** for frequency over time) |
| score | score |
| lector | reader |
| rampa | ramp |
| metro | metro |
| contador | counter |
| numero | number |
| msg, bang, loadbang, print, mtof, ftom, + - * / | (same) |
| synth~, osc~, gain~, dac~, faust~, script | (same) |
| componente | component |
| estado / transicion / consigna / region | state / transition / instruction / region |
| perilla | knob |
| — | patch (sub-patch), inlet, outlet, inlet~, outlet~ (Study 10) |
| — | phasor~, reader~ (audio rate; `reader~ 2 gate` adds one gate outlet per voice, 0 or 1), sig~, adsr~ [a d s r]; `reader path [stroke]` (Study 13) |
| quinta | fifth |
| deriva | drift |

## Component definition · Definición de componente

| es | en | notes |
|---|---|---|
| :clase | :class | |
| :doc | :doc | |
| :uso | :usage | |
| :licencia | :license | SPDX id |
| :io | :io | `[inlets outlets]` or `(fn [box] …)` |
| :io-dinamico | :dynamic-io | |
| :recibir | :receive | `(fn [msg] result)` |
| :vista (tipo: :texto :lienzo :score :codigo :numero :msg :bang) | :display (:text :canvas :score :code :number :msg :bang) | how the patch shows built-in boxes |
| :tam | :size | `[w h]` of a component's own view |
| :dibujo | :draw | `(fn [m] shapes)` – escape hatch |
| — | :view | **new**: shapes template whose values can be holes, keywords starting with `$` (`:$angle`) |
| — | :derive | **new**: `(fn [m] {key value})` fills the holes of `:view` |
| — | :args | **new**: declared arguments `[[:name default] …]` |
| :gesto | :gesture | `(fn [m] value)` |
| :datos {:vacio :step :cargar :codigo} | :model {:empty :step :load :code} | box data with its own history |
| :lenguaje | :language | code boxes |
| :plantilla | :template | initial source of a code box |
| :parametros | :params | |
| :lee-buffer | :reads-buffer | |
| :audio {:crear :efectos :clave :desechar} | :audio {:create :effects :key :dispose :wired :feed} | `:wired (fn [node inlets])`: which inlets receive a signal; `:feed (fn [node data])`: the buffer, for audio nodes that read it (Study 13). An inlet can be an AudioParam: `:inlets [[(.-frequency o) 0]]` |
| :origen (:nucleo :obra :usuario) | :origin (:core :work :user) | |
| :desde | :from | box that defines a work class |

## Messages · Mensajes

`:receive` gets `{:state :args :inlet :value :at :data :buffer :buffer-id :id}`
and returns `{:state :out [[outlet v]] :later [[at inlet v]] :effects [[k x]] :show v}`.

| es | en |
|---|---|
| :estado | :state |
| :entrada | :inlet |
| :valor | :value |
| :salidas | :out |
| :luego | :later |
| :efectos | :effects |
| :vista (lo que muestra la caja) | :show |

`:draw`, `:derive` and `:gesture` get `{:shown :state :args :text :data :w :h}`; `:gesture` also
`{:start :x :y :dx :dy :fine}`.

| es | en |
|---|---|
| :vista (en :dibujo/:gesto) | :shown |
| :inicio | :start |
| :fino | :fine |
| :texto | :text |

## Shapes · Figuras

| es | en |
|---|---|
| :rect | :rect |
| :circulo | :circle |
| :linea | :line |
| :arco {:desde :hasta} | :arc {:from :to} |
| :ruta {:puntos :cerrada} | :path {:points :closed} |
| :texto {:ancla (:inicio :medio :fin) :tam} | :text {:anchor (:start :middle :end) :size} |
| — | :needle {:cx :cy :r :angle} (new) |
| :trazo / :relleno / :grosor | :stroke / :fill / :weight |
| :tinta :suave :acento :kairos :fondo :rejilla | :ink :soft :accent :kairos :bg :grid |

## Canvas data · Datos del lienzo

| es | en |
|---|---|
| {:trazos {:t1 {:pts …}} :rx :ry} | {:strokes {:t1 {:pts …}} :gx :gy} |
| :rx {:paso :ciclos} | :gx {:step :cycles} |
| :ry {:nombre :cents :ref} | :gy {:name :cents :ref} |
| eventos :trazo :mover :estirar :borrar :limpiar :rejilla-x :afinacion :cargar | :stroke :move :stretch :erase :clear :grid-x :tuning :load |

Code box data: `{:fuente}` → `{:source}`; events `:fuente :cargar` → `:source :load`.

## REPL commands · Comandos de la REPL

`send!`, `import!` and `use!` end in `!` because `send`, `import` and `use` already exist in Clojure.
`send!`, `import!` y `use!` llevan `!` porque `send`, `import` y `use` ya existen en Clojure.

| es | en |
|---|---|
| (box …) (connect …) (disconnect …) (move …) (text! …) (delete …) | (same) |
| (trazo :b1 [[t hz] …]) | (stroke :b1 [[t hz] …]) |
| (nota :b1 t "c4" dur) | (note :b1 t "c4" dur) |
| (grado :b1 t n dur) | (degree :b1 t n dur) |
| (melodia :b1 "c4/1 e4/.5") | (melody :b1 "c4/1 e4/.5") |
| (mover-trazo :b1 :t1 dt cents) | (move-stroke :b1 :t1 dt cents) |
| (estirar :b1 :t1 k) | (stretch :b1 :t1 k) |
| (borrar-trazo :b1 :t1) | (erase-stroke :b1 :t1) |
| (limpiar :b1) | (clear :b1) |
| (rejilla-x :b1 0.25 "3+3+2") | (grid-x :b1 0.25 "3+3+2") |
| (afinacion :b1 "31-tet" 261.63) | (tuning :b1 "31-tet" 261.63) |
| (escalas) | (tunings) |
| (leer :b1 t) | (read-at :b1 t) |
| (play) (stop) | (same) |
| (enviar :b5 2.5) | (send! :b5 2.5) |
| (codigo :b6 "…") (fuente :b6) (compilacion :b6) | (code :b6 "…") (source :b6) (compilation :b6) |
| (confiar-scripts true) | (trust-scripts true) |
| (componentes) (ayuda "rampa") | (components) (help "ramp") |
| (importar "npm:…") (publicar :b5) (biblioteca) (usar "quinta") | (import! "npm:…") (publish :b5) (library) (use! "fifth") |
| (frente) (simultaneidad 1500) | (front) (simultaneity 1500) |
| — | (enter :b5) (up) (top) (inside :b5 …) (abstract :b5 "voice") (Study 10) |
| — | (present :b4 x y) (unpresent :b4) (presentation true) (send-to! :b7.b4 v) (Study 11) |
| — | (axis :b6 :y -1 1) (grid-y :b6 0.25) (read-at :b6 :y 0.5) · classes freqt, pan~, space~; dac~ 1 2 … (Study 12) |
| (rewind) (forward) (tip) (goto …) (here) (branches) (merge-from …) | (same) |

## Storage · Almacenamiento (new artifact, new database)

| es | en |
|---|---|
| salas/<id> | rooms/<id> |
| data/users/<uid>/<id> | data/users/<uid>/<id> |
| …/historia/<tramo> | …/history/<segment> |
| biblioteca/<clase> | library/<class> |
