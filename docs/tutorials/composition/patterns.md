# Patterns: play them, draw them | Patterns: tocarlos, dibujarlos
track: composition
order: 3

## A pattern and a player | Un pattern y un player
@en
A **pattern** is a sequence of events, each a map of keys: `{:degree 2 :dur 0.5}`. A `pbind` writes one as data: every key holds a constant, a vector (a sequence) or a generator. Here `:degree` goes through four steps of the major scale, each lasting half a beat.

The `pbind` sends its pattern to the **right** inlet of a `player`. The **left** inlet says how time moves: `start` and `stop` use its own clock (`player 110`: 110 beats per minute). It sends the Hz of the notes and their voice ids to `synth~`, which plays them.

What travels is the **source** and a **seed**, not the notes: every tab makes the same events from them.
@es
Un **pattern** es una secuencia de eventos, cada uno un mapa de claves: `{:degree 2 :dur 0.5}`. Un `pbind` lo escribe como datos: cada clave tiene una constante, un vector (una secuencia) o un generador. Aquí `:degree` recorre cuatro grados de la escala mayor, de medio beat cada uno.

El `pbind` envía su pattern a la entrada **derecha** de un `player`. La **izquierda** dice cómo se mueve el tiempo: `start` y `stop` usan su propio reloj (`player 110`: 110 pulsos por minuto). Envía los Hz de las notas y sus ids de voz a `synth~`, que las toca.

Lo que viaja es la **fuente** y una **semilla**, no las notas: cada pestaña hace los mismos eventos a partir de ellas.
@try.en
Press ▶, then click `start`. Double-click the pbind, change a degree, and apply (Ctrl+Enter): the player goes on with it from the same beat.
@try.es
Pulsa ▶ y luego haz clic en `start`. Haz doble clic en el pbind, cambia un grado y aplica (Ctrl+Enter): el player sigue con él desde el mismo beat.
```kairotic
(box :b1 "pbind 1 loop" 40 40)
(code :b1 "{:degree [0 2 4 7]\n :dur    0.5}")
(box :b2 "msg start" 40 170)
(box :b3 "msg stop" 120 170)
(box :b4 "player 110" 40 220)
(box :b5 "synth~" 40 290)
(box :b6 "dac~" 40 350)
(connect :b2 0 :b4 0)
(connect :b3 0 :b4 0)
(connect :b1 0 :b4 1)
(connect :b4 0 :b5 0)
(connect :b4 1 :b5 1)
(connect :b5 0 :b6 0)
(connect :b5 0 :b6 1)
```

## Sequences of different lengths | Secuencias de distinta longitud
@en
When keys hold sequences of different lengths, the shorter ones **start again** until the longest ends: four degrees against three durations make a figure that shifts against itself, a small polymeter. `:rest` (or `nil`) is a silence.

`:amp` (0…1) is the loudness of each note: the player sends it to `synth~` just before the note.
@es
Cuando las claves tienen secuencias de distinta longitud, las más cortas **vuelven a empezar** hasta que acaba la más larga: cuatro grados contra tres duraciones dan una figura que se desplaza sobre sí misma, una pequeña polimetría. `:rest` (o `nil`) es un silencio.

`:amp` (0…1) es la intensidad de cada nota: el player se la envía a `synth~` justo antes de la nota.
@try.en
Listen for where the figure meets itself again. Put another `:rest` in `:degree`.
@try.es
Escucha dónde vuelve a coincidir la figura. Pon otro `:rest` en `:degree`.
```kairotic
(code :b1 "{:degree [0 2 4 :rest 7]\n :dur    [0.5 0.25 0.25]\n :amp    [0.8 0.3 0.5]}")
```

## Chance, the same for everyone | Azar, el mismo para todos
@en
A **generator** is written `#pat/…`. `#pat/shuffle` plays its values in a new order every pass; `#pat/white [lo hi]` picks a number between two. Their randomness comes from the **seed**, the number after `pbind`, and every key has a seed of its own, so changing `:dur` leaves the chance of `:amp` as it was.

Same seed, same music: for everyone in a room, and again whenever you go back in the history.
@es
Un **generador** se escribe `#pat/…`. `#pat/shuffle` toca sus valores en un orden nuevo en cada vuelta; `#pat/white [lo hi]` elige un número entre dos. Su azar viene de la **semilla**, el número que sigue a `pbind`, y cada clave tiene su propia semilla, así que cambiar `:dur` deja como estaba el azar de `:amp`.

Misma semilla, misma música: para todos en una sala, y otra vez cada vez que vuelves atrás en la historia.
@try.en
Change the seed (`pbind 2 loop`): other orders. Change it back to 1: the same as before.
@try.es
Cambia la semilla (`pbind 2 loop`): otros órdenes. Vuelve a 1: lo mismo que antes.
```kairotic
(code :b1 "{:degree #pat/shuffle [0 2 4 7 9]\n :dur    [0.5 0.25 0.25]\n :amp    #pat/white [0.2 0.9]}")
```

## Harmony that follows time | Armonía que sigue al tiempo
@en
`#pat/hold [4 [:c :f :g :c]]` gives one value **every 4 beats**, whatever the rhythm: here the root of the scale changes every bar while the figure keeps shuffling over it. `:scale` can be a name (`:dorian`, `:minor-pentatonic`…) or a vector of semitones, fractional for microtones.
@es
`#pat/hold [4 [:c :f :g :c]]` da un valor **cada 4 beats**, sea cual sea el ritmo: aquí la tónica de la escala cambia cada compás mientras la figura se sigue barajando encima. `:scale` puede ser un nombre (`:dorian`, `:minor-pentatonic`…) o un vector de semitonos, con decimales para microtonos.
@try.en
Try `:scale :dorian`, then `:scale [0 2.5 5 7 9.5]`.
@try.es
Prueba `:scale :dorian` y luego `:scale [0 2.5 5 7 9.5]`.
```kairotic
(code :b1 "{:degree #pat/shuffle [0 2 4 7 9]\n :dur    [0.5 0.25 0.25]\n :amp    #pat/white [0.2 0.9]\n :root   #pat/hold [4 [:c :f :g :c]]\n :scale  :major}")
```

## Step by step | Paso a paso
@en
A **bang** on the left of the player plays the next event **now**, whatever its `:dur`. The pattern follows whatever moves it: a `metro`, an `onset~` of what someone plays, a key. The rhythm is no longer in the pattern but in the hand.
@es
Un **bang** a la izquierda del player toca el siguiente evento **ahora**, sea cual sea su `:dur`. El pattern sigue a lo que lo mueva: un `metro`, un `onset~` de lo que alguien toca, una tecla. El ritmo ya no está en el pattern sino en la mano.
@try.en
Click `stop`, then `1` to start the metro: one note every 300 ms. Click `0`, then the bang yourself.
@try.es
Haz clic en `stop` y luego en `1` para arrancar el metro: una nota cada 300 ms. Haz clic en `0` y luego en el bang tú.
```kairotic
(box :b7 "msg 1" 220 120)
(box :b8 "msg 0" 270 120)
(box :b9 "metro 300" 220 170)
(box :b10 "bang" 330 170)
(connect :b7 0 :b9 0)
(connect :b8 0 :b9 0)
(connect :b9 0 :b4 0)
(connect :b10 0 :b4 0)
```

## At a position, either way | En una posición, en ambos sentidos
@en
A **number** on the left of the player is a position in beats, as a `reader` reads a buffer. Every event is a **span**, from its onset to its end, and sounds while the position is inside it. A `ramp` moves through it: going up, each note starts at its onset; **going down, each note starts from its end**, and the phrase comes out backwards.

The wrap of a looping ramp, a step far larger than the ones before, is a **jump**: the player goes there at once, without sounding what is in between.
@es
Un **número** a la izquierda del player es una posición en beats, como un `reader` lee un buffer. Cada evento es un **tramo**, de su inicio a su final, y suena mientras la posición está dentro. Un `ramp` se mueve por ella: al subir, cada nota empieza en su inicio; **al bajar, cada nota empieza por su final**, y la frase sale al revés.

La vuelta de un ramp en bucle, un paso mucho mayor que los anteriores, es un **salto**: el player va allí de golpe, sin hacer sonar lo que hay en medio.
@try.en
Stop the metro (`0`) and click the bang above the ramp: eight beats in four seconds. Then write `ramp 8 0 4 loop` in the ramp: backwards.
@try.es
Para el metro (`0`) y haz clic en el bang sobre el ramp: ocho beats en cuatro segundos. Luego escribe `ramp 8 0 4 loop` en el ramp: al revés.
```kairotic
(box :b11 "bang" 420 120)
(box :b12 "ramp 0 8 4 loop" 420 170)
(connect :b11 0 :b12 0)
(connect :b12 0 :b4 0)
```

## Drawing it | Dibujarlo
@en
`render 0 8` works out at once what a player would play from beat 0 to beat 8, and sends it to a `freqt` as a musical tree: you **see** the pattern. Each note is as thick as its `:amp`; a `:pan` would shade it from one edge to the other.

The drawing follows the pbind while you edit it. To keep it, write `(keep! :b14)` in the REPL: it is written into the freqt as one event of the history, with its **recipe** beside it (the pbind, the seed, the render), so `(remake! :b14)` can make it again after you edit it by hand.
@es
`render 0 8` calcula de una vez lo que un player tocaría del beat 0 al 8, y lo envía a un `freqt` como árbol musical: **ves** el pattern. Cada nota es tan gruesa como su `:amp`; un `:pan` la sombrearía de un borde al otro.

El dibujo sigue al pbind mientras lo editas. Para guardarlo, escribe `(keep! :b14)` en la REPL: se escribe en el freqt como un evento de la historia, con su **receta** al lado (el pbind, la semilla, el render), así que `(remake! :b14)` puede rehacerlo después de que lo edites a mano.
@try.en
Change the seed of the pbind: the drawing changes with it. Then `(keep! :b14)`.
@try.es
Cambia la semilla del pbind: el dibujo cambia con ella. Luego `(keep! :b14)`.
```kairotic
(box :b13 "render 0 8" 560 40)
(box :b14 "freqt" 560 100)
(connect :b1 0 :b13 0)
(connect :b13 0 :b14 0)
```

## Time maps | Mapas temporales
@en
A `canvas` on the right inlet of `render` is a **time map**: each stroke says which beat of the pattern (up, y) is at each beat of the drawing (across, x). The diagonal is the pattern as it is. Here, the first stroke goes up for 8 beats (the pattern), comes down for 4 (**backwards**, each note from its end) and stays flat (the note it is in, **held**). The second stroke starts later and climbs more slowly: a **canon by augmentation**, in the same freqt.

A steeper line is faster, a curve is an accelerando, a vertical step is a cut.
@es
Un `canvas` en la entrada derecha de `render` es un **mapa temporal**: cada trazo dice qué beat del pattern (arriba, y) está en cada beat del dibujo (a lo ancho, x). La diagonal es el pattern tal cual. Aquí el primer trazo sube 8 beats (el pattern), baja 4 (**al revés**, cada nota desde su final) y se queda plano (la nota en la que está, **sostenida**). El segundo empieza más tarde y sube más despacio: un **canon por aumentación**, en el mismo freqt.

Una línea más inclinada es más rápida, una curva es un accelerando, un escalón vertical es un corte.
@try.en
Click the bang next to the render to draw it again. Redraw the canvas (drag a stroke, or draw a new one), and bang again.
@try.es
Haz clic en el bang junto al render para dibujarlo otra vez. Redibuja el canvas (arrastra un trazo o dibuja uno nuevo) y vuelve a hacer bang.
```kairotic
(box :b15 "canvas" 860 100)
(axis :b15 :x 0 16)
(axis :b15 :y 0 8)
(stroke :b15 [[0 0] [8 8] [12 4] [16 4]])
(stroke :b15 [[2 0] [16 7]])
(box :b16 "bang" 680 40)
(connect :b15 1 :b13 1)
(connect :b16 0 :b13 0)
```

## As a score | Como partitura
@en
A freqt can also be **read as a score**: ⇄ in its header, or `(view :b14 :score)`. The notes are quantized into real measures, with voices where the layers overlap, so a pattern and its time map become notation that someone can play.
@es
Un freqt también se puede **leer como partitura**: ⇄ en su cabecera, o `(view :b14 :score)`. Las notas se cuantizan en compases reales, con voces donde las capas se superponen, así que un pattern y su mapa temporal se vuelven notación que alguien puede tocar.
@try.en
Switch back to the drawing (⇄) and change the time map: the score follows.
@try.es
Vuelve al dibujo (⇄) y cambia el mapa temporal: la partitura le sigue.
```kairotic
(view :b14 :score)
```

## Patterns as code | Patterns como código
@en
A `pattern` box says the same in Clojure: any expression that gives events. `pbind`, `pwhite`, `pchoose` and the others give **lazy sequences**, which can be endless, as in Overtone; `rand` and its friends are seeded by the box. In a shared room it runs only once you allow it, `(trust-scripts true)`, because it is code: a `pbind` needs no trust.
@es
Una caja `pattern` dice lo mismo en Clojure: cualquier expresión que dé eventos. `pbind`, `pwhite`, `pchoose` y los demás dan **secuencias perezosas**, que pueden ser infinitas, como en Overtone; `rand` y los suyos llevan la semilla de la caja. En una sala compartida solo se ejecuta cuando lo permites, `(trust-scripts true)`, porque es código: un `pbind` no necesita confianza.
@try.en
Connect it to the player or to the render instead of the pbind.
@try.es
Conéctalo al player o al render en lugar del pbind.
```kairotic
(box :b17 "pattern 3" 220 40)
(code :b17 "(pbind {:degree (pwhite 0 9)\n        :dur    (pchoose [0.25 0.25 0.5])\n        :octave [5 5 6]}\n       :inf)")
```
