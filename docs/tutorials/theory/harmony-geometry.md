# Harmony as geometry | La armonía como geometría
track: theory
order: 2

## Three pictures of a chord | Tres imágenes de un acorde
@en
Music theory has long drawn harmony as shapes: a set of pitch classes as a polygon on a clock, a scale by how evenly it divides the octave, triads as triangles of a lattice. The package `@kairotic/theory` draws them from what arrives as messages: lists of MIDI pitches, single notes, or a chroma (twelve weights, from `chroma~`).

Writing one of its classes in a box brings the package into the work, as a `component` box beside the patch: that is the box that appeared on its own.

This lesson uses only messages: click them, nothing needs ▶.
@es
La teoría musical lleva mucho tiempo dibujando la armonía como formas: un conjunto de clases de altura como un polígono sobre un reloj, una escala por lo regular que divide la octava, las tríadas como triángulos de una red. El paquete `@kairotic/theory` las dibuja a partir de lo que le llega como mensajes: listas de alturas MIDI, notas sueltas o un croma (doce pesos, de `chroma~`).

Escribir una de sus clases en una caja trae el paquete a la obra, como una caja `component` junto al patch: es la caja que ha aparecido sola.

Esta lección solo usa mensajes: haz clic en ellos, no hace falta ▶.

## The clock | El reloj
@en
`pcclock` places each pitch class on a clock face (C at the top, a semitone per hour) and joins the ones that sound into a polygon. Its outlets give the **prime form** of the set (its normal shape, transposed to 0) and its **interval vector** (how many of each interval it contains); the dashed lines are its axes of symmetry.

The major triad has none: it is not the same read upwards and downwards. The diminished seventh has four, and the same polygon after any transposition by a minor third.
@es
`pcclock` coloca cada clase de altura en la esfera de un reloj (Do arriba, un semitono por hora) y une las que suenan en un polígono. Sus salidas dan la **forma prima** del conjunto (su forma normal, transportada a 0) y su **vector interválico** (cuántos intervalos de cada clase contiene); las líneas discontinuas son sus ejes de simetría.

La tríada mayor no tiene ninguno: no es la misma leída hacia arriba y hacia abajo. La séptima disminuida tiene cuatro, y es el mismo polígono tras cualquier transposición de tercera menor.
@try.en
Click the two messages and read print in the REPL. Press a pitch class on the clock: its number comes out of the right outlet.
@try.es
Haz clic en los dos mensajes y lee print en la REPL. Pulsa una clase de altura en el reloj: su número sale por la salida derecha.
```kairotic
(box :b1 "msg 60 64 67" 40 30)
(box :b2 "msg 60 63 66 69" 150 30)
(box :b3 "pcclock" 40 90)
(box :b4 "print" 40 360)
(connect :b1 0 :b3 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
```

## The six coefficients | Los seis coeficientes
@en
`fourier` measures a set by the discrete Fourier transform of its twelve classes. Each of its six circles asks one question — how chromatic, how dyadic (tritones), how triadic (augmented), how octatonic, how **diatonic**, how whole-tone — and the point's distance from the centre is the answer (0…1). Its angle tells which transposition.

The diatonic scale is almost all f5; the augmented triad is all f3 and f6. The trail shows where the last sets were.
@es
`fourier` mide un conjunto con la transformada de Fourier discreta de sus doce clases. Cada uno de sus seis círculos hace una pregunta —cuán cromático, cuán diádico (tritonos), cuán triádico (aumentado), cuán octatónico, cuán **diatónico**, cuán de tonos enteros— y la distancia del punto al centro es la respuesta (0…1). Su ángulo dice qué transposición.

La escala diatónica es casi toda f5; la tríada aumentada es toda f3 y f6. El rastro muestra dónde estaban los últimos conjuntos.
@try.en
Click the scale, then the augmented triad, then the chords above: watch which circle each one fills.
@try.es
Haz clic en la escala, luego en la tríada aumentada, luego en los acordes de arriba: mira qué círculo llena cada uno.
```kairotic
(box :b5 "msg 60 62 64 65 67 69 71" 330 30)
(box :b6 "msg 60 64 68" 540 30)
(box :b7 "fourier" 330 90)
(connect :b5 0 :b7 0)
(connect :b6 0 :b7 0)
(connect :b1 0 :b7 0)
(connect :b2 0 :b7 0)
(connect :b5 0 :b3 0)
(connect :b6 0 :b3 0)
```

## The path on the Tonnetz | El camino en el Tonnetz
@en
On the **Tonnetz** fifths run across and thirds run up, so every triad is a triangle and two triads that share two notes share an edge. The neo-Riemannian moves are those edges: **P** (parallel: C ↔ c), **L** (leading-tone exchange: C ↔ e) and **R** (relative: C ↔ a).

`tonnetz` lights the triad it receives and joins it to the ones before, on the nearest copy of the lattice: a progression becomes a path. C – c – A♭ – g♯ is P, L, P: three single steps.
@es
En el **Tonnetz** las quintas van en horizontal y las terceras hacia arriba, así que cada tríada es un triángulo y dos tríadas que comparten dos notas comparten un lado. Los movimientos neorriemannianos son esos lados: **P** (paralelo: Do ↔ do), **L** (intercambio de sensible: Do ↔ mi) y **R** (relativo: Do ↔ la).

`tonnetz` ilumina la tríada que recibe y la une a las anteriores, sobre la copia más cercana de la red: una progresión se vuelve un camino. Do – do – La♭ – sol♯ es P, L, P: tres pasos sencillos.
@try.en
Click the four messages from left to right: print writes the name of each triad. Then click C and the major triad of F♯ (write it in a msg: 66 70 73): a long way across the lattice.
@try.es
Haz clic en los cuatro mensajes de izquierda a derecha: print escribe el nombre de cada tríada. Después Do y la tríada de Fa♯ (escríbela en un msg: 66 70 73): un camino largo por la red.
```kairotic
(box :b8 "msg 60 63 67" 120 430)
(box :b9 "msg 60 63 68" 230 430)
(box :b10 "msg 59 63 68" 340 430)
(box :b11 "tonnetz" 40 480)
(box :b12 "print" 40 760)
(connect :b1 0 :b11 0)
(connect :b8 0 :b11 0)
(connect :b9 0 :b11 0)
(connect :b10 0 :b11 0)
(connect :b11 0 :b12 0)
```

## What you play | Lo que tocas
@en
The three boxes also take a **chroma**: twelve weights, one per pitch class, as `chroma~` hears them in a signal. `adc~ 1` → `chroma~` → `pcclock`, `fourier` or `tonnetz` draws, as you sing or play, what the harmony is doing.

A box can also be drawn again large on a layer, behind the presentation: `(project :b11 :viz [40 40 800 600])` (see the guide, *Annotations and layers*).
@es
Las tres cajas también aceptan un **croma**: doce pesos, uno por clase de altura, como los oye `chroma~` en una señal. `adc~ 1` → `chroma~` → `pcclock`, `fourier` o `tonnetz` dibuja, mientras cantas o tocas, lo que está haciendo la armonía.

Una caja también se puede dibujar otra vez en grande sobre una capa, detrás de la presentación: `(project :b11 :viz [40 40 800 600])` (ver la guía, *Anotaciones y capas*).
@try.en
Press ▶, allow the microphone and play a chord near it (an instrument, or a recording): the chroma lights the classes that sound.
@try.es
Pulsa ▶, permite el micrófono y toca un acorde cerca (un instrumento o una grabación): el croma ilumina las clases que suenan.
```kairotic
(box :b13 "adc~ 1" 640 430)
(box :b14 "chroma~" 640 480)
(connect :b13 0 :b14 0)
(connect :b14 0 :b7 0)
```
