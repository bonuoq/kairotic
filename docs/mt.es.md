# Árboles musicales (kairotic.mt)

*[English version](mt.md)*

Desde el Ensayo 19, la música en Kairotic se puede escribir como **datos**: un árbol en EDN, al estilo
*hiccup* `[:etiqueta {atributos} & hijos]`. Es el idioma común de la notación, la composición y la CAC:
cajas y componentes reciben árboles y devuelven árboles, y una `score`, un `freqt` o un `canvas` pueden
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
| `:measure {:meter [3 4]}` | uno detrás de otro; un compás sin `:meter` conserva el anterior |
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

## Cajas

| caja | |
|---|---|
| `tree` | contiene un árbol como texto EDN (doble clic para editarlo). Un bang lo envía. Leer EDN no evalúa nada, así que una caja tree es segura en una sala compartida |
| `mt transpose 7` · `mt invert c4` · `mt retrograde` · `mt augment 2` · `mt rotate 1` · `mt canon 4 7` | transformaciones (la entrada derecha cambia la cantidad) |
| `mt seq` · `mt par` | une el árbol de la izquierda con el de la derecha, uno detrás de otro o a la vez |
| `mt events` · `mt pitches` · `mt duration` | el árbol como datos planos |
| `mt play [loop]` | toca el último árbol al recibir un bang: Hz (0) e ids de voz (1) para `synth~`, parámetros `[nombre valor]` (2), dinámicas y textos (3) |
| `score` · `freqt` · `canvas` | un árbol en su entrada **se muestra en vivo** sobre su buffer; `(keep! :bN)` lo escribe en el buffer como un evento de la historia |

Una score muestra un árbol escrito en `:measure` como notación medida (grupos irregulares, acordes,
silencios, dinámicas, articulaciones, textos, cambios de compás). Sin compases muestra una aproximación
sobre una rejilla de semicorcheas.

## REPL y componentes

Las funciones están en `mt/`: `mt/transpose`, `mt/invert`, `mt/retrograde`, `mt/augment`, `mt/rotate`,
`mt/canon`, `mt/expand`, `mt/events`, `mt/notes`, `mt/pitches`, `mt/duration`, `mt/problems`,
`mt/pp`, `mt/->mei`, `mt/->strokes`, `mt/<-strokes`, `mt/schedule`. En la REPL:

- `(tree! :b2 [:voice …])` escribe un árbol en una caja tree;
- `(as-tree :bN)` lee como árbol una caja tree, el árbol que muestra una score, o los trazos de un freqt;
- `(keep! :bN)` y `(unlive! :bN)`.

Un componente puede enviar árboles desde su `:receive` y usar `mt/…`. Ver el ejemplo
`examples/claude/notation/walk.cljs`.

## Historia

Un árbol vive en la obra como el texto de una caja `tree`, así que cada edición es un evento, con su
diff, en la historia ramificada. Una score que muestra un árbol no ha cambiado: su buffer solo cambia
con `keep!`. Próximos pasos: un árbol que sea la obra entera, con secciones cuyas ediciones sean diffs
del propio árbol (nodo a nodo), y partituras que editen el árbol directamente.
