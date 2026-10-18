# A motif and its transformations | Un motivo y sus transformaciones
track: theory
order: 1

## Music as data | La música como datos
@en
In Kairotic a fragment of music can be written as a **tree** of data: `[:tag {attributes} children…]`. A `:voice` holds `:measure`s, a measure holds notes, rests, chords and tuplets, and any container can hold others. Strings like `"c4/1 e4/.5"` are a shorthand for notes: pitch / duration in beats (a quarter note = 1).

The same tree can be shown as a score, drawn on a freqt, played, and transformed by the `mt` boxes. In this lesson we take a motif through the classical transformations of counterpoint: transposition, inversion, retrograde, augmentation and canon.

A tree sends itself whenever it changes, so every score below follows it at once. ▶ (or the space bar) is only needed to hear it, at the end.
@es
En Kairotic un fragmento de música se puede escribir como un **árbol** de datos: `[:etiqueta {atributos} hijos…]`. Una `:voice` contiene `:measure` (compases), un compás contiene notas, silencios, acordes y grupos irregulares, y cualquier contenedor puede contener otros. Los textos como `"c4/1 e4/.5"` son una abreviatura de notas: altura / duración en pulsos (la negra = 1).

El mismo árbol se puede ver como partitura, dibujar en un freqt, tocar y transformar con las cajas `mt`. En esta lección llevamos un motivo por las transformaciones clásicas del contrapunto: transposición, inversión, retrogradación, aumentación y canon.

Un árbol se envía solo cada vez que cambia, así que cada partitura lo sigue al momento. ▶ (o la barra espaciadora) solo hace falta para escucharlo, al final.

## The motif | El motivo
@en
The `tree` box holds the motif as EDN text: two bars of 4/4. It is connected to a `freqt` shown as a score, which draws it bar by bar as soon as it arrives (the bang only sends it again). (The second bar has no `:meter`: it keeps the one before.)

Double-click the code to edit it (Ctrl+Enter applies), or write a new one from the REPL with `(tree! :b2 [:voice [:measure {:meter [3 4]} "g4/1 a4 b4"]])`.
@es
La caja `tree` contiene el motivo como texto EDN: dos compases de 4/4. Está conectada a un `freqt` mostrado como partitura, que lo dibuja compás a compás en cuanto llega (el bang solo lo vuelve a enviar). (El segundo compás no lleva `:meter`: conserva el anterior.)

Haz doble clic en el código para editarlo (Ctrl+Intro aplica), o escribe uno nuevo desde la REPL con `(tree! :b2 [:voice [:measure {:meter [3 4]} "g4/1 a4 b4"]])`.
@try.en
Change a note in the code and apply it: the score follows.
@try.es
Cambia una nota en el código y aplícalo: la partitura lo sigue.
```kairotic
(box :b1 "bang" 40 20)
(box :b2 "tree" 40 60)
(tree! :b2 [:voice {:name "motif"} [:measure {:meter [4 4]} "c4/1 d4/.5 e4 g4/1 e4"] [:measure "f4/.5 e4 d4 c4 d4/2"]])
(box :b3 "freqt" 40 190)
(view :b3 :score)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
```

## Transposition | Transposición
@en
`mt transpose 7` moves every pitch seven semitones up: a perfect fifth. The shape of the motif — its intervals and its rhythm — does not change; only its register.

The number is in semitones; negative goes down, and decimals give microtones (`mt transpose 0.5` is a quarter tone).
@es
`mt transpose 7` sube todas las alturas siete semitonos: una quinta justa. La forma del motivo —sus intervalos y su ritmo— no cambia; solo su registro.

El número está en semitonos; negativo baja, y los decimales dan microtonos (`mt transpose 0.5` es un cuarto de tono).
@try.en
⌘/Ctrl+click the `mt` box and change 7 for -12 in the inspector: the second score follows.
@try.es
Haz ⌘/Ctrl+clic en la caja `mt` y cambia 7 por -12 en el inspector: la segunda partitura lo sigue.
```kairotic
(box :b4 "mt transpose 7" 480 150)
(box :b5 "freqt" 480 190)
(view :b5 :score)
(connect :b2 0 :b4 0)
(connect :b4 0 :b5 0)
```

## Inversion | Inversión
@en
`mt invert c4` mirrors every pitch around c4: what went up a step now goes down a step. The size of every interval is kept, its direction is reversed. Without a pivot, the first note is the axis.

This step only changes the text of the `mt` box: the patch is the same, its meaning is different.
@es
`mt invert c4` refleja cada altura alrededor de c4: lo que subía un grado ahora baja un grado. Se conserva el tamaño de cada intervalo y se invierte su dirección. Sin eje, la primera nota es el eje.

Este paso solo cambia el texto de la caja `mt`: el patch es el mismo, su sentido es otro.
@try.en
Compare both scores: the contours are mirror images.
@try.es
Compara las dos partituras: los contornos son imágenes especulares.
```kairotic
(text! :b4 "mt invert c4")
```

## Retrograde | Retrogradación
@en
`mt retrograde` reads the motif backwards: the last note first. The bars are reversed too, and so is what is inside them, so the rhythm is also read backwards.

Inversion and retrograde together (first one box, then another) give the **retrograde inversion**: the four forms of a row in serial music.
@es
`mt retrograde` lee el motivo al revés: la última nota primero. También se invierten los compases y su contenido, así que el ritmo se lee hacia atrás.

Inversión y retrogradación juntas (una caja detrás de otra) dan la **retrogradación de la inversión**: las cuatro formas de una serie en la música serial.
@try.en
Make the retrograde inversion: put a box `mt invert c4` between the `mt retrograde` and the score.
@try.es
Haz la retrogradación de la inversión: pon una caja `mt invert c4` entre la `mt retrograde` y la partitura.
```kairotic
(text! :b4 "mt retrograde")
```

## Augmentation | Aumentación
@en
`mt augment 2` doubles every duration. The bars double too: 4/4 becomes 8/4, so the music still fits them. `mt augment 0.5` is a diminution: twice as fast, in 2/4.
@es
`mt augment 2` duplica todas las duraciones. Los compases también: 4/4 pasa a 8/4, así que la música sigue cabiendo en ellos. `mt augment 0.5` es una disminución: el doble de rápido, en 2/4.
```kairotic
(text! :b4 "mt augment 2")
```

## Canon | Canon
@en
`mt canon 4 7` plays the motif against itself: a second voice (the *comes*) enters four beats — one bar — later, a fifth higher. When the delay is a whole number of bars, the second voice starts with rest bars, and the score shows two staves.

Listen to it in the next step.
@es
`mt canon 4 7` toca el motivo contra sí mismo: una segunda voz (el *comes*) entra cuatro pulsos —un compás— más tarde, una quinta más arriba. Cuando el retardo es un número entero de compases, la segunda voz empieza con compases de silencio, y la partitura muestra dos pentagramas.

Escúchalo en el paso siguiente.
@try.en
Try `mt canon 4 12` (at the octave) or `mt canon 2 7`: with a delay of half a bar there are no rest bars, so the score shows the two voices without the right offset — listen to them instead.
@try.es
Prueba `mt canon 4 12` (a la octava) o `mt canon 2 7`: con un retardo de medio compás no hay compases de silencio, así que la partitura no muestra bien el desfase entre voces; mejor escúchalas.
```kairotic
(text! :b4 "mt canon 4 7")
```

## Listening | Escucharlo
@en
`mt play` keeps the last tree it receives and plays it when it gets a bang: on its left outlet the frequencies of the notes sounding, on the second their voice ids — exactly what `synth~` needs, one voice per note.

Start the engine with ▶ (sound and time need it) and click the bang next to `mt play`. `mt play loop` plays it again and again.
@es
`mt play` guarda el último árbol que recibe y lo toca cuando le llega un bang: por su salida izquierda, las frecuencias de las notas que suenan; por la segunda, sus ids de voz —justo lo que necesita `synth~`, una voz por nota.

Pon en marcha el motor con ▶ (el sonido y el tiempo lo necesitan) y pulsa el bang junto a `mt play`. `mt play loop` lo repite una y otra vez.
@try.en
Go back in the lesson to the inversion or the retrograde, click the bang of `mt play`, and listen to each transformation.
@try.es
Vuelve en la lección a la inversión o a la retrogradación, pulsa el bang de `mt play` y escucha cada transformación.
```kairotic
(box :b6 "bang" 480 420)
(box :b7 "mt play" 540 420)
(box :b8 "synth~" 540 470)
(box :b9 "dac~" 540 520)
(connect :b4 0 :b7 0)
(connect :b6 0 :b7 0)
(connect :b7 1 :b8 1)
(connect :b7 0 :b8 0)
(connect :b8 0 :b9 0)
(connect :b8 0 :b9 1)
```

## Your own variations | Tus propias variaciones
@en
Every step of this lesson is a point in the history: go back to any of them and change the motif or the operation, and a branch of your own grows from there.

A tree can also reuse fragments: `[:voice {:defs {:a "c4/1 d4 e4"}} [:use {:ref :a}] [:use {:ref :a :transpose 5 :retrograde true}]]` defines a motif once and writes two variations of it. Try it with `tree!`, and read the format in the guide *Musical trees* (`docs/mt.md`).
@es
Cada paso de esta lección es un punto de la historia: vuelve a cualquiera, cambia el motivo o la operación, y desde ahí crece una rama tuya.

Un árbol también puede reutilizar fragmentos: `[:voice {:defs {:a "c4/1 d4 e4"}} [:use {:ref :a}] [:use {:ref :a :transpose 5 :retrograde true}]]` define un motivo una vez y escribe dos variaciones. Pruébalo con `tree!`, y lee el formato en la guía *Árboles musicales* (`docs/mt.es.md`).
