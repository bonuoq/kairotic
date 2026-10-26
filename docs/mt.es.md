# Árboles musicales (kairotic.mt)

*[English version](mt.md)*

La música en Kairotic se puede escribir como **datos**: un árbol en EDN, al estilo
*hiccup* `[:etiqueta {atributos} & hijos]`. Es el idioma común de la notación, la composición y la CAC:
cajas y componentes reciben árboles y devuelven árboles, y un `freqt` (como lienzo o como partitura) o un `canvas` pueden
mostrar uno. La idea viene del *llll* de [bach](https://www.bachproject.net) para Max: listas que se
anidan libremente. La diferencia es que aquí los atributos tienen nombre, así que cualquier dato extra
(los *slots* de bach) es una clave más.

```clojure
[:piece {:tempo 72 :defs {:celula "e5/.5 d5 c5"}}
 [:voice {:name "flauta"}
  [:measure {:meter [3 4]}
   [:note {:pitch "e5" :dur 1 :dyn "p" :art [:tenuto]}]
   [:tuplet {:ratio [3 2]} "d5/.5 c5 b4"]                ; un tresillo de corcheas
   [:chord {:dur 1} [:note {:pitch "g4"}] [:note {:pitch 64.5}]]]   ; 64.5 = mi un cuarto de tono alto
  [:measure
   [:note {:pitch "a4" :dur 3 :gliss [[0 0] [1 -150]]}]]            ; un glissando en cents
  [:measure [:use {:ref :celula :transpose -12}] [:rest {:dur 1.5}]]]
 [:voice {:name "electrónica"}
  [:par
   [:param {:name :cutoff :value 300 :to 3000 :dur 6}]              ; una rampa de un parámetro de síntesis
   [:text {:text "abriendo lentamente"}]
   [:seq "c3/2 r/1 g2/3"]]]]
```

## Tiempo

El tiempo está en **pulsos** (la negra = 1). `:tempo` (pulsos por minuto, 60 por defecto) lo convierte
en segundos al tocar el árbol.

| etiqueta | sus hijos van… |
|---|---|
| `:seq` `:voice` `:section` | uno detrás de otro |
| `:measure {:meter [3 4]}` | uno detrás de otro; un compás sin `:meter` conserva el anterior; `:groups [2 3]` o `"5/8[2+3]"` agrupa sus unidades |
| `:tuplet {:ratio [3 2]}` | uno detrás de otro, 3 en el tiempo de 2 |
| `:par` `:piece` | a la vez |
| `:chord {:dur 1}` | notas a la vez, con la duración del acorde |

Cualquier nodo puede llevar `:at`: un desplazamiento desde el inicio de su padre que no mueve su cursor
(una voz que entra más tarde, un cambio de parámetro en medio de una nota). Una nota o un silencio sin
`:dur` dura lo mismo que el anterior de su contenedor (1 al principio).

## Hojas

| etiqueta | atributos |
|---|---|
| `:note` | `:pitch` (`"c4"`, `"f#3"`, `"bb2"`, o un número MIDI con decimales para microtonos) o `:hz`; `:dur`; y opcionalmente `:dyn "mf"`, `:art [:staccato :accent :tenuto :marcato]`, `:text`, `:gliss [[x cents] …]`, `:env [[x nivel] …]`, `:vel`, o cualquier clave propia |
| `:rest` | `:dur` |
| `:param` | `:name`, `:value`, y para una rampa `:to` y `:dur`: un cambio de parámetro coordinado con la partitura |
| `:dyn` | `:mark "mf"`; `"<"` o `">"` con `:dur` es un regulador |
| `:text` | `:text "dolce"` |
| `:use` | `:ref` (una clave de `:defs`) y opcionalmente `:transpose`, `:invert`, `:retrograde`, `:augment` |

Las curvas (`:gliss`, `:env`) van de 0 a 1 a lo largo de la duración de la nota, igual que se dibuja un
trazo en un freqt.

**Los textos** son una abreviatura de notas en cualquier contenedor: `"c4/1 e4/.5 r/1 c4+e4+g4/2 f4"`
(altura/duración; `r` es un silencio, `+` forma un acorde, un elemento sin duración conserva la anterior).

**Fragmentos**: `:defs` (un mapa en los atributos de cualquier contenedor) define fragmentos, y
`[:use {:ref :celula :transpose 5}]` los escribe, variados. Una sección de una obra más grande puede
ser una `:section`, colocada con `:at` dentro de una `:piece`.

## Ritmo proporcional (`:rtm`)

Un ritmo puede escribirse como **proporciones** en vez de duraciones, como en los árboles rítmicos
(RTM) de OpenMusic y PWGL. La idea para Kairotic viene de [Rastrum](https://github.com/smoge/Rastrum)
([discusión #17](https://github.com/bonuoq/kairotic/discussions/17)):

```clojure
[:measure {:meter [4 4]}
 [:rtm {:shares [1 [1 [1 1 1]] -1 2] :pitches "c4 d4 e4 f4 g4"}]]
```

- Un número es una proporción; un número negativo, un silencio; `[peso [proporciones …]]` divide una
  proporción.
- Las proporciones son relativas: `[2 2 2]` es el mismo ritmo que `[1 1 1]`.
- El `:rtm` dura su `:dur` (en pulsos) o, sin él, **llena su compás** (el compás vigente, también si
  lo hereda). Fuera de un compás y sin `:dur`, dura 4 pulsos.
- **Las figuras y los grupos irregulares no se escriben: salen de las proporciones y del compás.**
  Cuando la unidad igual de un nivel es una figura (un pulso, medio, dos…) las notas la toman tal cual;
  cuando no, ese nivel se vuelve un grupo irregular de la figura más pequeña que no sea más corta.
  Tres proporciones de un 3/4 son negras; de un 4/4, un 3:2 de blancas; cinco en un pulso, un 5:4 de
  semicorcheas. El ejemplo de arriba es un 5:4 de negras con un tresillo de corcheas dentro.
- `:pitches` (un texto de melodía, o una lista de alturas) van a las notas en orden y **vuelven a
  empezar cuando se acaban**: ritmo y alturas pueden tener longitudes distintas (*talea* y *color*);
  una `r` ahí hace de esa nota un silencio. Sin `:pitches`, cada nota toma `:pitch` (`"c4"` por defecto).
- `:shares` también puede ser texto RTM, `"(1 (1 (1 1 1)) -1 2)"`, o una lista EDN.

Ritmo y alturas van por separado: una célula puede rotarse o pasar a otro compás sin tocar sus alturas.
Las funciones `mt/cell-retrograde`, `mt/cell-rotate`, `mt/cell-at` y `mt/cell-replace-at` cambian las
proporciones mismas; `cell-replace-at` divide una proporción en una célula, así una célula puede crecer
dentro de sí misma:

```clojure
(def semilla [2 [2 [1 1 1]] 3])
(mt/cell-replace-at semilla [1] semilla)   ; [2 [2 [2 [2 [1 1 1]] 3]] 3]
```

Las notas de un `:rtm` no se editan una a una desde una partitura: edita sus `:shares` o `:pitches`.


## Compases, grupos y peso métrico

Un compás puede decir cómo se agrupan sus unidades: `{:meter [5 8] :groups [2 3]}`, o escrito como se
lee, `{:meter "5/8[2+3]"}` (también `"7/8[2+2+3]"`, `"3/4"`). Un compás sin `:meter` conserva el compás
anterior y sus grupos; un compás nuevo sin grupos no los tiene. Los grupos tienen que sumar el compás.

La partitura escribe un compás agrupado como sus grupos (2+3 sobre 8) y **barra** las corcheas y figuras
más breves por grupo o, sin grupos, por pulso: negras en 2/4, 3/4 y 4/4, negras con puntillo en 6/8, 9/8
y 12/8, el compás entero en 3/8. Un grupo irregular barra sus propias notas. Los silencios cortan la barra.

**El peso métrico** (a partir de [Rastrum](https://github.com/smoge/Rastrum) y de Clarence Barlow) es un
dato de composición, no de notación:

| función | |
|---|---|
| `(mt/meter-level compás pulso)` | 0 en el compás, 1 en un grupo, más profundo en cada división: `[4 4]` en corcheas → 0 3 2 3 1 3 2 3 |
| `(mt/indispensability compás [pulso])` | la ordenación de Barlow de cada pulso (la más alta, la parte fuerte): `[3 4]` en corcheas → 5 0 3 1 4 2, `[6 8]` → 5 0 2 4 1 3 |
| `(mt/indispensability-at compás pulso [pulso])` · `(mt/pulses compás [pulso])` | una posición · dónde están los pulsos, en pulsos |
| `(mt/thin cantidad árbol)` · caja `mt thin 0.5` | conserva, en cada compás, las notas de sus posiciones más fuertes (una proporción, o cuántas) y hace silencio de las demás |

3/4 y 6/8 tienen las mismas seis corcheas y las ordenan distinto, que es el argumento de Barlow: `mt thin 2`
conserva la primera y la quinta corchea de un 3/4, y la primera y la cuarta de un 6/8. Un compás se puede
dar como `[p q]`, como texto `"5/8[2+3]"` o como un compás del árbol. En un compás agrupado Kairotic ordena
por nivel métrico, luego por Barlow dentro de cada grupo y luego el grupo anterior.

## La obra, su historia y su partitura

**Una obra como árbol.** En una `:piece` (y en una `:section`), las voces y los `:par` suenan a la vez
desde su inicio, y todo lo demás —secciones en una pieza, compases en una sección— se sucede en orden:

```clojure
[:piece {:tempo 80}
 [:section {:name "A"} [:voice {:name "fl"} [:measure {:meter [3 4]} "e5/1 d5 c5"]] [:voice {:name "vc"} [:measure "c3/3"]]]
 [:section {:name "B"} [:voice {:name "fl"} [:measure "c5/3"]] [:voice {:name "vc"} [:measure "g2/3"]]]]
```

La partitura mantiene un pentagrama por nombre de voz a lo largo de las secciones, escribe el nombre de
cada sección sobre su primer compás y una doble barra entre secciones.

**Una historia de nodos.** El dato de una caja `tree` es el propio árbol, y cada evento de su historia es
una lista de ediciones de nodos, señalados por su **camino** (los índices de hijos desde la raíz; los
atributos no cuentan):

| edición | |
|---|---|
| `[:set camino x]` | sustituye el nodo (o el texto de melodía) del camino |
| `[:attrs camino {…}]` | sustituye sus atributos |
| `[:insert camino x]` | inserta x para que quede en ese camino |
| `[:remove camino]` | lo elimina |

`(tree-edit! :b2 [:set [1 0 0 0] "e5/.5 f5 g5"])` escribe las ediciones tal cual; `(tree! :b2 árbol)` y
editar el texto de la caja escriben la diferencia con lo que tenía (`mt/diff`). Dos ramas se pueden
fundir cuando cambian nodos distintos; si una cambió un nodo y la otra ese nodo o algo dentro de él, la
fusión dice cuál.

**Editar desde la partitura.** Una partitura que muestra un árbol que viene de una caja tree sabe dónde
está escrita cada nota. Haz clic en una nota y luego ↑ ↓ (altura, ⇧ una octava), a…g (la nota más cercana con ese
nombre), + − (duración), ← → (anterior, siguiente), Supr (un silencio), Esc. También se puede hacer clic
en un silencio: Intro lo vuelve nota (la altura de la nota anterior), ↑ ↓ un paso por encima o por
debajo, a…g esa nota. Cada cambio es un `(tree-edit! …)`; una nota escrita en
un texto de melodía se escribe primero como notas, en el mismo evento. Las notas que vienen de `:defs` se
editan en su definición.

Un compás que no cuadra es un aviso (⚠ en la REPL y en la caja), no un error, mientras escribes.

## Cajas

| caja | |
|---|---|
| `tree` | contiene un árbol como texto EDN (doble clic para editarlo). Un bang lo envía. Leer EDN no evalúa nada, así que una caja tree es segura en una sala compartida |
| `mt transpose 7` · `mt invert c4` · `mt retrograde` · `mt augment 2` · `mt rotate 1` · `mt canon 4 7` · `mt thin 0.5` | transformaciones (la entrada derecha cambia la cantidad) |
| `mt seq` · `mt par` | une el árbol de la izquierda con el de la derecha, uno detrás de otro o a la vez |
| `mt events` · `mt pitches` · `mt duration` | el árbol como datos planos |
| `mt play [loop]` | toca el último árbol al recibir un bang: Hz (0) e ids de voz (1) para `synth~`, parámetros `[nombre valor]` (2), dinámicas y textos (3) |
| `freqt` · `canvas` | un árbol en su entrada **se muestra en vivo** sobre su buffer; `(keep! :bN)` lo escribe en el buffer como un evento de la historia |

Un freqt mostrado como partitura muestra un árbol escrito en `:measure` como notación medida (grupos irregulares, acordes,
silencios, dinámicas, articulaciones, textos, cambios de compás). Sin compases, y para los trazos de un `freqt`,
los muestra **cuantizados** en compases (más abajo).

Fuera de los grupos irregulares cada valor se escribe donde se puedan ver las partes del compás: una negra a
contratiempo sobre la parte 2 de un 4/4 sigue siendo una negra sincopada, pero sobre la mitad del compás pasa a
ser dos corcheas ligadas; una negra con puntillo en la parte 2 de un 3/4 se queda con su puntillo, en la parte 2
de un 4/4 deja ver la parte 3. Dos claves más de una nota: `:tie true` sigue en la siguiente nota de la misma
altura (un solo sonido, ligado sobre la barra o dentro de un grupo irregular) y `:grace true` es una nota de
adorno antes de la siguiente (no ocupa tiempo).

## Cuantización: el tiempo libre como notación medida

Un `freqt` mostrado como partitura se cuantiza: sus trazos pasan a ser un árbol de compases, grupos
irregulares, ligaduras y notas de adorno (issue [#86](https://github.com/bonuoq/kairotic/issues/86); a partir
de bach.quantize, FOMUS y Nauert).

- **El compás** sale de la rejilla de compás del buffer: `(grid-x :bN 0.25 [4])` es 4/4, `[3]` 3/4,
  `[1.5 1.5]` 6/8, `[1.5 1.5 1]` 8/8 en 3+3+2. Sin rejilla, 4/4.
- **Cada compás** se corta en tramos (las partes de un compás simple, las partes con puntillo o los grupos de
  6/8, 7/8…), y cada tramo toma la división (de 1 a 8, y las de sus propias unidades) que menos cuesta: lo lejos
  que quedan las notas de sus puntos, lo hondos que son los puntos que usa (la parte, su mitad, sus cuartos; las
  fusas cuestan mucho), ser un grupo irregular (un tresillo menos que un quintillo) y las notas que se pierden
  (dos ataques en un punto, una nota que se queda en nada). Dos partes pueden ir juntas (un tresillo de blancas),
  y una parte se puede partir en mitades (o una parte con puntillo en sus corcheas) con una división cada una
  (una corchea y un tresillo de semicorcheas).
- **Voces**: las notas que se solapan van a voces distintas, cada nota a la voz libre más cercana en altura (como
  mucho `:voices`, 2 por defecto); las notas que empiezan y acaban juntas siguen siendo un acorde. Todas las voces
  se cuantizan sobre los mismos puntos y se escriben como capas de un pentagrama (la más aguda primero, plicas
  arriba). Una nota tenida durante el tresillo de otra voz no se escribe dentro del tresillo.
- **Las notas** se colocan en esos puntos: acordes donde coinciden ataques, silencios en los huecos (un hueco
  pequeño antes de la nota siguiente es legato, no un silencio), una ligadura sobre la barra o al salir de un grupo
  irregular, una nota de adorno para una nota demasiado corta para cualquier punto. Una altura a medio camino entre
  semitonos lleva una alteración de cuarto de tono, las demás conservan sus cents como texto; un trazo que se curva
  hacia la nota siguiente es una línea de glissando hasta ella (un texto, *gliss. ↗ +120¢*, si no llega a ninguna).

En el REPL, `(quantize :bN)` da ese árbol (se puede guardar, editar, mandar a una caja tree), y unas opciones
cambian cómo se hace:

```clojure
(quantize :b1)                                   ; lo que muestra la partitura
(quantize :b1 {:meter "6/8"})                    ; otro compás que el de la rejilla
(quantize :b1 {:divs [1 2 4] :merge [] :nest false})   ; sin grupos irregulares
(quantize :b1 {:grace false :legato 0})          ; sin notas de adorno; cada hueco un silencio
(quantize :b1 {:voices 1})                       ; una voz: las notas solapadas se cortan
(qz/quantize-tree [:par [:note {:at 0 :pitch "c4" :dur 1.5}] …] {:meter [3 4]})   ; un árbol sin compases
```

Las otras opciones son `:chord` (lo cerca que deben estar dos ataques para ser un acorde, 0.04 partes), `:overlap`
(cuánto puede entrar una nota en la siguiente y seguir en su voz, 0.15 partes) y `:w`, los pesos del coste
(`{:err 8 :off 0.35 :cpx 1 :lost 1.5}`). `(as-tree :bN)` sigue leyendo los trazos de un freqt tal cual, sin
cuantizarlos.

**Elegir otra división.** El cuantizador adivina; cuando se equivoca, **alt+clic en una nota** de la partitura:
su parte toma la siguiente manera de dividirla (primero la del cuantizador, luego las demás, de más barata a más
cara: otra división, la parte en mitades, la parte junto con la siguiente). Cada elección se guarda en el buffer,
con las opciones, como un evento de la historia:

```clojure
(quant :b1 {:meter "6/8" :divs [1 2 3 4 6]})     ; cómo se cuantiza la partitura de este freqt (en su buffer)
(quant :b1)                                      ; → {:meter "6/8" …}
(divisions :b1 2.5)                              ; las maneras de dividir la parte en 2.5, la actual primero
(division! :b1 2.5)                              ; la siguiente (lo que hace el alt+clic) → en :fix
(division! :b1 2.5 [:merge 3])                   ; esta: n, [n1 n2] (en mitades) o [:merge n]
(division! :b1 2.5 nil)                          ; que vuelva a elegir el cuantizador
(quant :b1 nil)                                  ; las opciones por defecto
```

El texto del buffer las muestra como `:quant {:meter "6/8" :fix {2 [:merge 3]}}`, y un mensaje `[:quantize {…}]`
en la entrada del freqt también las cambia. Lo siguiente: grafía según la tonalidad (#88), y una sola caja para
freqt, tree y partitura (discusión #92).

## REPL y componentes

Las funciones están en `mt/`: `mt/transpose`, `mt/invert`, `mt/retrograde`, `mt/augment`, `mt/rotate`,
`mt/canon`, `mt/expand`, `mt/events`, `mt/notes`, `mt/pitches`, `mt/duration`, `mt/problems`,
`mt/pp`, `mt/->mei`, `mt/->strokes`, `mt/<-strokes`, `mt/schedule`, y para el ritmo proporcional
`mt/cell-retrograde`, `mt/cell-rotate`, `mt/cell-at`, `mt/cell-replace-at`, y para los compases `mt/meter-of`,
`mt/meter-level`, `mt/indispensability`, `mt/indispensability-at`, `mt/pulses`, `mt/thin`. En la REPL:

- `(tree! :b2 [:voice …])` escribe un árbol en una caja tree;
- `(as-tree :bN)` lee como árbol una caja tree, el árbol que muestra un freqt, o los trazos de un freqt;
- `(quantize :bN [opciones])` da los trazos de un freqt (o un árbol sin compases) cuantizados en compases;
- `(quant :bN opciones)`, `(divisions :bN t)`, `(division! :bN t [elección])`: cómo se cuantiza la partitura de un freqt, guardado en su buffer;
- `(keep! :bN)` y `(unlive! :bN)`;
- `(recipe :bN)` y `(remake! :bN)` (abajo).

Un componente puede enviar árboles desde su `:receive` y usar `mt/…`. Ver el ejemplo
`examples/claude/notation/walk.cljs`.

## Recetas: de dónde viene un buffer fijado

`(keep! :bN)` escribe en su buffer, como trazos, el árbol que muestra un freqt o un canvas.
El buffer son datos sin más, pero **junto a él la caja guarda la receta que lo hizo** (la idea viene de
[Rastrum](https://github.com/smoge/Rastrum), [discusión #17](https://github.com/bonuoq/kairotic/discussions/17)):

```clojure
(recipe :b5)
;; {:tree  [:voice [:measure {:meter [4 4]} …]]      el árbol tal como llegó
;;  :calls "(box :b2 \"tree\" 40 60)\n(box :b3 \"mt transpose 7\" …)…"   las cajas y líneas de antes, como código
;;  :from  :b3}                                       la caja de la que vino
```

- Mientras el buffer no cambie, un freqt **mostrado como partitura** sigue mostrando el árbol en notación medida (compases,
  grupos irregulares, dinámicas), no una aproximación de sus trazos, y `(as-tree :bN)` da el árbol mismo.
- En cuanto el buffer cambia (un trazo dibujado, un mensaje en su entrada), la receta se conserva pero
  marcada `:stale`: dice de dónde vino el buffer, ya no lo que es. La cabecera dice *changed since kept*.
- `(remake! :bN)` vuelve a escribir en el buffer el árbol de la receta (un evento), sin los cambios.
- `:calls` es el código de las cajas de antes, así que la receta sigue diciendo cómo se hizo aunque esas
  cajas se borren o cambien: pégalo en la pestaña Code para volver a construirlas.
- El código de la obra (Calls) escribe cada receta como `(recipe :b5 {…})`, después de los datos; la
  vista Data la muestra como `:recipe`, junto a `:data`.

## Historia

Un árbol vive en la obra como el texto de una caja `tree`, así que cada edición es un evento, con su
diff, en la historia ramificada. Un freqt que muestra un árbol no ha cambiado: su buffer solo cambia
con `keep!`, que guarda junto a él la receta. Próximos pasos: un árbol que sea la obra entera, con secciones cuyas ediciones sean diffs
del propio árbol (nodo a nodo), y partituras que editen el árbol directamente.
