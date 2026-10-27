# One, two, tree | Uno, dos, tree
track: theory
order: 3

## One box | Una caja
@en
In Kairotic, music in time lives in **one box**, `tree`. Its data is a tree written as EDN, `[:tag {attributes} children…]`. A `:voice` holds `:measure`s. A measure holds notes, rests, chords and tuplets. A string like `"c4/1 d4/.5"` is shorthand for notes: pitch / duration in beats, where a quarter note = 1.

That one tree is seen in **two views**: a **score** and a **roll** (⇄ in the box's header switches between them). Its text opens in the code window from **{ }** in the header. Whatever you change, in either view or in the text, is an edit of the same tree, one event of the history. Hence the title: one box, two views, tree.

A tree box is a score from the start: Verovio draws it from the tree, bar by bar. Beams follow the beat, and the second bar keeps the meter of the first.
@es
En Kairotic, la música en el tiempo vive en **una caja**, `tree`. Su dato es un árbol escrito en EDN, `[:etiqueta {atributos} hijos…]`. Una `:voice` contiene `:measure` (compases). Un compás contiene notas, silencios, acordes y grupos irregulares. Un texto como `"c4/1 d4/.5"` es una abreviatura de notas: altura / duración en pulsos, donde la negra = 1.

Ese único árbol se ve en **dos vistas**: una **partitura** y un **roll** (⇄ en la cabecera de la caja pasa de una a otra). Su texto se abre en la ventana de código desde **{ }** en la cabecera. Lo que cambias, en cualquiera de las vistas o en el texto, es una edición del mismo árbol, un evento de la historia. De ahí el título: una caja, dos vistas, tree.

Una caja tree es una partitura desde el principio: Verovio la dibuja a partir del árbol, compás a compás. Las barras de corchea siguen el pulso, y el segundo compás conserva la métrica del primero.
@try.en
Press { } in the header, change a note in the text and apply it with Ctrl+Enter: the score follows. Only the nodes that change go into the history.
@try.es
Pulsa { } en la cabecera, cambia una nota en el texto y aplícalo con Ctrl+Intro: la partitura lo sigue. Solo los nodos que cambian entran en la historia.
```kairotic
(box :b1 "tree" 40 30)
(tree! :b1 [:voice {:name "motif"} [:measure {:meter [4 4]} "c4/1 d4/.5 e4 g4/1 e4"] [:measure "f4/.5 e4 d4 c4 d4/2"]])
```

## Two: editing the score | Dos: editar la partitura
@en
The score is also a place to edit. Click a note and press ↑ ↓ to change its pitch (⇧ moves an octave), a…g for the nearest note of that name, + − for its duration, and ← → to go to the next note. Delete turns it into a rest, and Enter on a rest turns it back into a note. Each key press is one edit of the tree.
@es
La partitura también es un lugar para editar. Haz clic en una nota y pulsa ↑ ↓ para cambiar su altura (⇧ mueve una octava), a…g para la nota más cercana de ese nombre, + − para su duración, y ← → para pasar a la nota siguiente. Supr la convierte en silencio, e Intro sobre un silencio la vuelve a hacer nota. Cada tecla es una edición del árbol.
@try.en
Click the first note and press ↑ twice, then open { }: the melody string has changed.
@try.es
Haz clic en la primera nota y pulsa ↑ dos veces; luego abre { }: el texto de la melodía ha cambiado.

## Tree: the roll | Tree: el roll
@en
The second view is a **piano roll**: the notes as **strokes of frequency over time**, as a `freqt` draws them, one line per note, at its height in Hz, as long as it lasts (⇄ in the header, or `(view :b1 :roll)`).

Drawing there writes into the tree. Dragging a note up or down changes only its pitch, inside its melody string. Moving or stretching it in time **re-quantizes the bar it touches**, in that bar's meter. A note drawn in a measured tree goes into its bar. With **⌥** (dragging, or drawing freehand), a note leaves the measures for a **free voice** of the tree, which the score writes on a staff of its own.
@es
La segunda vista es un **piano roll**: las notas como **trazos de frecuencia en el tiempo**, como los dibuja un `freqt`, una línea por nota, a su altura en Hz, tan larga como dura (⇄ en la cabecera, o `(view :b1 :roll)`).

Dibujar ahí escribe en el árbol. Arrastrar una nota arriba o abajo cambia solo su altura, dentro de su texto de melodía. Moverla o estirarla en el tiempo **vuelve a cuantizar el compás que toca**, en la métrica de ese compás. Una nota dibujada en un árbol con compases entra en su compás. Con **⌥** (al arrastrar o al dibujar a mano alzada), una nota sale de los compases hacia una **voz libre** del árbol, que la partitura escribe en un pentagrama propio.
@try.en
Drag the last note half a beat to the right, then ⇄ to see the score. Then hold ⌥ and draw a long note above: it appears on a second staff.
@try.es
Arrastra la última nota medio pulso a la derecha y pasa con ⇄ a la partitura. Después mantén ⌥ y dibuja una nota larga por encima: aparece en un segundo pentagrama.
```kairotic
(view :b1 :roll)
```

## Meters, groups, tuplets, ties | Métricas, agrupaciones, grupos irregulares, ligaduras
@en
Measured time is written with a few tags. `{:meter "7/8[2+2+3]"}` is a meter with its groups: the score writes it as 2+2+3 over 8 and beams by group. `[:tuplet {:ratio [3 2]} …]` puts 3 notes in the time of 2.

`:tie true` carries a note into the next one of the same pitch, here across the barline. `:grace true` makes a grace note, which takes no time. In a melody string, `+` makes a chord and `r` a rest.
@es
El tiempo medido se escribe con unas pocas etiquetas. `{:meter "7/8[2+2+3]"}` es una métrica con sus agrupaciones: la partitura la escribe como 2+2+3 sobre 8 y agrupa las barras por grupo. `[:tuplet {:ratio [3 2]} …]` pone 3 notas en el tiempo de 2.

`:tie true` prolonga una nota en la siguiente de la misma altura, aquí a través de la barra de compás. `:grace true` hace una apoyatura, que no ocupa tiempo. En un texto de melodía, `+` hace un acorde y `r` un silencio.
@try.en
Change the meter to `"7/8[3+2+2]"` in its text ({ }): the beams regroup.
@try.es
Cambia la métrica a `"7/8[3+2+2]"` en su texto ({ }): las barras se reagrupan.
```kairotic
(box :b2 "tree" 40 300)
(tree! :b2 [:voice [:measure {:meter "7/8[2+2+3]"} "d4/.5 e4 f4 g4 a4/1.5"] [:measure {:meter [3 4]} [:tuplet {:ratio [3 2]} "b4/.5 c5 d5"] [:note {:pitch "g4" :dur 0.25 :grace true}] [:note {:pitch "e5" :dur 1 :tie true}]] [:measure "e5/1 r/.5 c4+e4+g4/1.5"]])
```

## Proportional rhythm | Ritmo proporcional
@en
A rhythm can also be written as **shares** instead of durations, as in the rhythm trees of OpenMusic: `[:rtm {:shares […]}]`. A number is a share and a negative number is a silence. `[weight [shares…]]` divides a share further.

The note values and tuplets are not written: they **follow from the shares and the meter**. The `:pitches` cycle when they run out, so rhythm and pitches can have different lengths (talea and color).

Here, five shares fill each bar of 4/4, giving a quintuplet of quarters, and the second share holds a triplet.
@es
Un ritmo también puede escribirse como **proporciones** en lugar de duraciones, como en los árboles rítmicos de OpenMusic: `[:rtm {:shares […]}]`. Un número es una proporción y un número negativo es un silencio. `[peso [proporciones…]]` divide una proporción más.

Las figuras y los grupos irregulares no se escriben: **se deducen de las proporciones y la métrica**. Las `:pitches` vuelven a empezar cuando se acaban, así que ritmo y alturas pueden tener longitudes distintas (talea y color).

Aquí, cinco proporciones llenan cada compás de 4/4, lo que da un quintillo de negras, y la segunda proporción contiene un tresillo.
@try.en
In its text, change `:shares` to `[1 1 1]`: a 3:2 of halves. Or put the measure in `[3 4]`: three quarters, no tuplet at all.
@try.es
En su texto, cambia `:shares` por `[1 1 1]`: un 3:2 de blancas. O pon el compás en `[3 4]`: tres negras, sin grupo irregular.
```kairotic
(box :b3 "tree" 480 30)
(tree! :b3 [:voice [:measure {:meter [4 4]} [:rtm {:shares [1 [1 [1 1 1]] -1 2] :pitches "c4 d4 e4 f4 g4 a4 b4"}]] [:measure [:rtm {:shares [2 1 1 -1 1] :pitches "c5 a4 f4"}]]])
```

## Free time | Tiempo libre
@en
A tree **without measures** is in free time. Each note says when it starts with `:at` and how long it lasts with `:dur`, inside a `[:par …]`. Nothing has been decided yet about meter or note values. These notes were played, not written: a little early, a little late.

As a roll, drawing adds a note, dragging moves it, stretching from its end lengthens it, and Delete erases it. From code, `(stroke :b4 [[t hz] [t2 hz]])` draws one. The tree also keeps its **grid and tuning** on its root: `(grid-x :b4 0.25 [3])` snaps drawing to sixteenths in bars of 3/4. A tree is drawn in semitones (12-tet) unless it says otherwise, for example with `(tuning :b4 "19-tet")`.
@es
Un árbol **sin compases** está en tiempo libre. Cada nota dice cuándo empieza con `:at` y cuánto dura con `:dur`, dentro de un `[:par …]`. Todavía no se ha decidido nada sobre la métrica ni sobre las figuras. Estas notas se tocaron, no se escribieron: un poco antes, un poco después.

Como roll, dibujar añade una nota, arrastrar la mueve, estirarla desde su final la alarga, y Supr la borra. Desde código, `(stroke :b4 [[t hz] [t2 hz]])` dibuja una. El árbol también guarda su **rejilla y su afinación** en su raíz: `(grid-x :b4 0.25 [3])` ajusta el dibujo a semicorcheas en compases de 3/4. Un árbol se dibuja en semitonos (12-tet) salvo que diga otra cosa, por ejemplo con `(tuning :b4 "19-tet")`.
@try.en
Draw a few notes of your own after the last one: they snap to the grid and to the semitones.
@try.es
Dibuja unas notas tuyas después de la última: se ajustan a la rejilla y a los semitonos.
```kairotic
(box :b4 "tree" 480 300)
(tree! :b4 [:voice [:par [:note {:at 0 :dur 0.95 :pitch "e4"}] [:note {:at 1.02 :dur 0.3 :pitch "f#4"}] [:note {:at 1.36 :dur 0.3 :pitch "g4"}] [:note {:at 1.68 :dur 0.3 :pitch "a4"}] [:note {:at 2.03 :dur 0.95 :pitch "b4"}] [:note {:at 3 :dur 0.48 :pitch "d5"}] [:note {:at 3.52 :dur 0.45 :pitch "c5"}] [:note {:at 4 :dur 2 :pitch "b4"}]]])
(grid-x :b4 0.25 [3])
(view :b4 :roll)
```

## Quantized: a guess | Cuantizado: una conjetura
@en
Shown as a score, free time is **quantized**: the notes are written in measures, in the meter of the grid (3/4 here). Each beat takes the division that costs least. The cost counts how far the notes are from its points, how deep those points are, whether it is a tuplet, and how many notes are lost. The three quick notes become a triplet, and the notes played a little early or late fall on the beat.

The quantizer only guesses. When it guesses wrong, **alt-click a note**: its beat takes the next way to divide it (another division, the beat in halves, or the beat merged with the next one). The choice is kept in the tree's `:quant`, as one event of the history.

From the REPL, `(divisions :b4 1)` lists the ways for the beat at 1, the current one first, and `(division! :b4 1 4)` divides it in four. `(quant :b4 {:meter "6/8"})` quantizes the score in another meter, and `(quant :b4 nil)` goes back to the defaults.

Nothing in the notes has changed: the score is a reading of them.
@es
Mostrado como partitura, el tiempo libre se **cuantiza**: las notas se escriben en compases, en la métrica de la rejilla (aquí 3/4). Cada pulso toma la división que menos cuesta. El coste cuenta lo lejos que quedan las notas de sus puntos, lo profundos que son esos puntos, si es un grupo irregular y cuántas notas se pierden. Las tres notas rápidas se vuelven un tresillo, y las que se tocaron un poco antes o después caen en el pulso.

El cuantizador solo conjetura. Cuando se equivoca, **haz alt-clic en una nota**: su pulso toma la siguiente manera de dividirse (otra división, el pulso en mitades, o el pulso unido al siguiente). La elección se guarda en el `:quant` del árbol, como un evento de la historia.

Desde la REPL, `(divisions :b4 1)` da las maneras para el pulso en 1, la actual primero, y `(division! :b4 1 4)` lo divide en cuatro. `(quant :b4 {:meter "6/8"})` cuantiza la partitura en otra métrica, y `(quant :b4 nil)` vuelve a los valores por defecto.

Nada ha cambiado en las notas: la partitura es una lectura de ellas.
@try.en
Alt-click one of the triplet notes a few times and watch the beat change: four sixteenths, then other divisions, then the triplet again.
@try.es
Haz alt-clic varias veces en una nota del tresillo y mira cómo cambia el pulso: cuatro semicorcheas, luego otras divisiones, y otra vez el tresillo.
```kairotic
(view :b4 :score)
```

## Written in measures | Escrito en compases
@en
When the reading is the right one, `(quantize! :b4)` **writes it into the tree**. The free notes become measures, tuplets and ties, as the score showed them. It is one event of the history, so undo goes back. From now on the tree is measured: edits in the canvas re-quantize only the bars they touch.

`(unquantize! :b4)` does the opposite: the notes go back to free time, each one with its `:at`.
@es
Cuando la lectura es la buena, `(quantize! :b4)` **la escribe en el árbol**. Las notas libres se vuelven compases, grupos irregulares y ligaduras, tal como los mostraba la partitura. Es un evento de la historia, así que deshacer vuelve atrás. A partir de ahí el árbol tiene compases: las ediciones en el lienzo solo vuelven a cuantizar los compases que tocan.

`(unquantize! :b4)` hace lo contrario: las notas vuelven al tiempo libre, cada una con su `:at`.
@try.en
Open { } to see what was written. Then try `(unquantize! :b4)` and look at the text again.
@try.es
Abre { } para ver lo que se ha escrito. Después prueba `(unquantize! :b4)` y vuelve a mirar el texto.
```kairotic
(quantize! :b4)
```

## A raw buffer: freqt | Un búfer crudo: freqt
@en
A `freqt` is something else: a **raw buffer of frequency over time**, with no tree behind it. It is what `transcribe` writes from a voice, or a drawing in continuous Hz. Here it holds a chromatic line that goes up and comes back down, written in Hz, so the notes have no names.

Its score is quantized in the same way, and **named** in the same way. Pitches without a name are spelled near the key and moving well in each voice. A chromatic line rises in sharps and falls in flats.

When a drawing is to become a score of its own, `(to-tree! :b5)` makes a new tree box beside it with its strokes as free notes, and the tree, unlike the freqt, can then be edited note by note.
@es
Un `freqt` es otra cosa: un **búfer crudo de frecuencia en el tiempo**, sin un árbol detrás. Es lo que `transcribe` escribe a partir de una voz, o un dibujo en Hz continuos. Aquí contiene una línea cromática que sube y vuelve a bajar, escrita en Hz, así que las notas no tienen nombre.

Su partitura se cuantiza de la misma manera, y se **nombra** de la misma manera. Las alturas sin nombre se escriben cerca de la tonalidad y moviéndose bien en cada voz. Una línea cromática sube con sostenidos y baja con bemoles.

Cuando un dibujo tiene que llegar a ser una partitura propia, `(to-tree! :b5)` crea una caja tree a su lado con sus trazos como notas libres; el árbol, a diferencia del freqt, se puede editar nota a nota.
@try.en
Shift-alt-click a note to give it another name (c#4 → db4). `(quant :b5 {:key "d"})` puts the score in D major.
@try.es
Haz shift-alt-clic en una nota para darle otro nombre (c#4 → db4). `(quant :b5 {:key "d"})` pone la partitura en re mayor.
```kairotic
(box :b5 "freqt" 40 570)
(grid-x :b5 0.5 [4])
(melody :b5 "c4/.5 c#4/.5 d4/.5 d#4/.5 e4/.5 f4/.5 e4/.5 eb4/.5 d4/.5 db4/.5 c4/1" 0)
(view :b5 :score)
```

## Names and keys | Nombres y tonalidades
@en
A tree keeps the names it was given: G♯ and A♭ sound alike and are written apart. `{:key "eb"}` on the tree, a voice or a measure gives the score its signature. An accidental lasts to the end of its bar, and `:key :none` writes every accidental, for atonal music.

Transposing keeps the spelling too. `mt transpose M3` moves the melody up a major third, and E♭ becomes G, not F𝄪. A number of semitones moves by the interval that is usually written for it.
@es
Un árbol guarda los nombres que se le dieron: sol♯ y la♭ suenan igual y se escriben distinto. `{:key "eb"}` en el árbol, una voz o un compás da a la partitura su armadura. Una alteración dura hasta el final de su compás, y `:key :none` escribe todas las alteraciones, para la música atonal.

La transposición también conserva la grafía. `mt transpose M3` sube la melodía una tercera mayor, y mi♭ se vuelve sol, no fa𝄪. Un número de semitonos mueve por el intervalo con que se suele escribir.
@try.en
Click a note of the upper score and press `#`: it cycles through its names (ab4 → g#4 → …). Change the key of the tree to `"c#m"`.
@try.es
Haz clic en una nota de la partitura de arriba y pulsa `#`: pasa por sus nombres (ab4 → g#4 → …). Cambia la tonalidad del árbol a `"c#m"`.
```kairotic
(box :b6 "tree" 480 570)
(tree! :b6 [:voice {:key "eb"} [:measure {:meter [4 4]} "eb4/1 f4/.5 g4 ab4/1 a4/.5 bb4"] [:measure "c5/1 b4/.5 bb4 eb4/2"]])
(box :b7 "mt transpose M3" 480 720)
(box :b8 "freqt" 480 760)
(view :b8 :score)
(connect :b6 0 :b7 0)
(connect :b7 0 :b8 0)
```

## Between semitones | Entre semitonos
@en
Time can be free, and so can pitch. A name can carry `:cents`: `{:pitch "c4" :cents 50}` is a quarter tone above C, and the score writes it with a quarter-tone accidental. A MIDI number with decimals works too: 64.5 is E a quarter tone up. Other deviations are written as cents above the note.

`:gliss [[0 0] [1 -150]]` bends a note over its duration, here down 150 cents. The score writes the glissando as a text.
@es
El tiempo puede ser libre, y la altura también. Un nombre puede llevar `:cents`: `{:pitch "c4" :cents 50}` es un cuarto de tono por encima de do, y la partitura lo escribe con una alteración de cuarto de tono. También sirve un número MIDI con decimales: 64.5 es mi un cuarto de tono arriba. Las demás desviaciones se escriben como cents encima de la nota.

`:gliss [[0 0] [1 -150]]` curva una nota a lo largo de su duración, aquí 150 cents hacia abajo. La partitura escribe el glissando como un texto.
@try.en
⇄ to the roll: the quarter tones sit between the lines of the semitones, and the glissando is a curve.
@try.es
Pasa con ⇄ al roll: los cuartos de tono quedan entre las líneas de los semitonos, y el glissando es una curva.
```kairotic
(box :b9 "tree" 40 840)
(tree! :b9 [:voice [:measure {:meter [4 4]} [:note {:pitch "c4" :dur 1}] [:note {:pitch "c4" :cents 50 :dur 1}] [:note {:pitch 64.5 :dur 1}] [:note {:pitch "g4" :cents 14 :dur 1}]] [:measure [:note {:pitch "a4" :dur 4 :gliss [[0 0] [1 -150]]}]]])
```

## Listening | Escucharlo
@en
Every view is the same tree, so they all sound the same. `mt play` keeps the last tree it receives and plays it on a bang. Its left outlet gives the frequencies of the notes sounding and its second outlet their voice ids: what `synth~` needs.

A tree box has a second outlet as well: its notes as a **buffer** of strokes, for the right inlet of a `reader~`. Free time and measured time are both, in the end, frequency over time.
@es
Todas las vistas son el mismo árbol, así que todas suenan igual. `mt play` guarda el último árbol que recibe y lo toca con un bang. Su salida izquierda da las frecuencias de las notas que suenan y la segunda sus ids de voz: lo que necesita `synth~`.

Una caja tree también tiene una segunda salida: sus notas como **búfer** de trazos, para la entrada derecha de un `reader~`. El tiempo libre y el tiempo medido son, al final, frecuencia en el tiempo.
@try.en
Start the engine with ▶ and click the bang. Then connect `:b4` or `:b9` to `mt play` instead of `:b1`, and listen.
@try.es
Pon en marcha el motor con ▶ y pulsa el bang. Después conecta `:b4` o `:b9` a `mt play` en lugar de `:b1`, y escucha.
```kairotic
(box :b10 "bang" 480 880)
(box :b11 "mt play" 540 880)
(box :b12 "synth~" 540 930)
(box :b13 "dac~" 540 980)
(connect :b1 0 :b11 0)
(connect :b10 0 :b11 0)
(connect :b11 0 :b12 0)
(connect :b11 1 :b12 1)
(connect :b12 0 :b13 0)
(connect :b12 0 :b13 1)
```

## One, two, tree | Uno, dos, tree
@en
**One box**: `tree`, whose text opens from { }.

**Two views**: a score and a roll of one tree, and every edit, in either of them or in the text, is one event of the history.

**Tree**: and in it, two times. Measured (`:measure`, `:meter`, `:tuplet`, `:rtm`) and free (`[:par [:note {:at …}]]`). The score of free time is a quantized reading of it (alt-click, `division!`, `quant`). `quantize!` writes that reading into the tree, and `unquantize!` takes it back.

Around it: `freqt`, the raw buffer of frequency over time, which `to-tree!` turns into a tree. Names that stay as they were written, keys, `mt transpose M3`, `#` and shift-alt-click. And everything between the semitones: `:cents`, quarter tones, `:gliss`, tunings.

The full reference is in the Help tab, under **Musical trees**. The design behind it is discussed in issues #86 (quantization) and #88 (pitch spelling), and in discussion #92 (one box), on the GitHub of Kairotic.
@es
**Una caja**: `tree`, cuyo texto se abre desde { }.

**Dos vistas**: una partitura y un roll de un mismo árbol, y cada edición, en cualquiera de ellas o en el texto, es un evento de la historia.

**Tree**: y en él, dos tiempos. Medido (`:measure`, `:meter`, `:tuplet`, `:rtm`) y libre (`[:par [:note {:at …}]]`). La partitura del tiempo libre es una lectura cuantizada de él (alt-clic, `division!`, `quant`). `quantize!` escribe esa lectura en el árbol, y `unquantize!` la deshace.

A su alrededor: `freqt`, el búfer crudo de frecuencia en el tiempo, que `to-tree!` vuelve árbol. Los nombres que se quedan como se escribieron, las tonalidades, `mt transpose M3`, `#` y shift-alt-clic. Y todo lo que hay entre los semitonos: `:cents`, cuartos de tono, `:gliss`, afinaciones.

La referencia completa está en la pestaña Ayuda, en **Árboles musicales**. El diseño que hay detrás se discute en los issues #86 (cuantización) y #88 (grafía de alturas), y en la discusión #92 (una caja), en el GitHub de Kairotic.
