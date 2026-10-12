# From patch to code | Del patch al código
track: patch-code
order: 1

## Before starting | Antes de empezar
@en
Kairotic shows the same work in three ways at once: the **patch** (boxes and wires, on the left), its **code** (the Code tab, on the right) and its **history** (below), where every gesture is a point you can go back to.

This lesson builds a small instrument step by step. Each step is a point of the history: ◀ ▶ in this bar travel between them, and the REPL (at the bottom) shows, line by line, the gestures each step makes.

Put on headphones or turn the volume down a little: there will be sound.
@es
Kairotic muestra la misma obra de tres maneras a la vez: el **patch** (cajas y cables, a la izquierda), su **código** (la pestaña Code, a la derecha) y su **historia** (abajo), donde cada gesto es un punto al que puedes volver.

Esta lección construye un pequeño instrumento paso a paso. Cada paso es un punto de la historia: ◀ ▶ en esta barra viajan entre ellos, y la REPL (abajo del todo) muestra, línea a línea, los gestos que hace cada paso.

Ponte auriculares o baja un poco el volumen: habrá sonido.

## A box | Una caja
@en
A box is a line of text. The first word is its **class** (what it is: `osc~`, a sine oscillator) and the rest are its **arguments** (here, 220 Hz). The ~ marks classes that work with sound signals.

Look at the Code tab: the box is the line `(box :b1 "osc~ 220" 40 110)` — its id `:b1`, its text, and where it sits (x 40, y 110). The patch and the code are two views of the same thing.
@es
Una caja es una línea de texto. La primera palabra es su **clase** (lo que es: `osc~`, un oscilador sinusoidal) y el resto son sus **argumentos** (aquí, 220 Hz). La ~ marca las clases que trabajan con señales de sonido.

Mira la pestaña Code: la caja es la línea `(box :b1 "osc~ 220" 40 110)` — su id `:b1`, su texto y dónde está (x 40, y 110). El patch y el código son dos vistas de lo mismo.
@try.en
Click the box: below it you can change its argument. Then look at the Code tab again.
@try.es
Haz clic en la caja: debajo puedes cambiar su argumento. Luego vuelve a mirar la pestaña Code.
```kairotic
(box :b1 "osc~ 220" 40 110)
```

## Wires | Cables
@en
Alone, an oscillator is not heard. A `gain~` sets its level and `dac~` is the sound card: one inlet per channel, left and right.

Each wire is a `connect`: from an **outlet** of a box to an **inlet** of another, both numbered from 0, left to right. `(connect :b2 0 :b3 1)` takes the left outlet of the gain~ to the right inlet of the dac~.

Press ▶ (or the space bar) to start the engine.
@es
Solo, un oscilador no se oye. Un `gain~` fija su nivel y `dac~` es la tarjeta de sonido: una entrada por canal, izquierda y derecha.

Cada cable es un `connect`: de una **salida** de una caja a una **entrada** de otra, ambas numeradas desde 0, de izquierda a derecha. `(connect :b2 0 :b3 1)` lleva la salida izquierda del gain~ a la entrada derecha del dac~.

Pulsa ▶ (o la barra espaciadora) para poner en marcha el motor.
@try.en
Click a wire and press Delete: the right channel goes quiet. Draw it again from the outlet (the small mark at the bottom of the box) to the inlet.
@try.es
Haz clic en un cable y pulsa Supr: el canal derecho se calla. Vuelve a dibujarlo desde la salida (la pequeña marca abajo de la caja) hasta la entrada.
```kairotic
(box :b2 "gain~ 0.2" 40 170)
(box :b3 "dac~" 40 230)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b2 0 :b3 1)
```

## Messages that play | Mensajes que tocan
@en
A `number` box sends a number whenever it changes. Wired to the left inlet of the oscillator, it changes its frequency.

There are two kinds of wire: **messages** (numbers, lists, words, sent from time to time) and **signals** (sound, 48 000 values per second). A message into `osc~` sets its frequency; a signal into the same inlet *is* its frequency.
@es
Una caja `number` envía un número cada vez que cambia. Conectada a la entrada izquierda del oscilador, cambia su frecuencia.

Hay dos tipos de cable: **mensajes** (números, listas, palabras, enviados de vez en cuando) y **señales** (sonido, 48 000 valores por segundo). Un mensaje a `osc~` fija su frecuencia; una señal a esa misma entrada *es* su frecuencia.
@try.en
With the engine running, drag the number up and down (⇧ for finer steps).
@try.es
Con el motor en marcha, arrastra el número arriba y abajo (⇧ para pasos más finos).
```kairotic
(box :b4 "number 220" 40 40)
(connect :b4 0 :b1 0)
```

## The REPL speaks the same language | La REPL habla el mismo idioma
@en
Everything you do with the mouse is written as one of these lines, and anything you type in the REPL becomes a gesture of the patch. Here, a `msg` box with a MIDI pitch (57, the A below middle C) goes through `mtof` (MIDI to frequency) into the oscillator: 220 Hz again.

Click any `code` in these notes and it goes to the REPL, ready to run with Enter.
@es
Todo lo que haces con el ratón se escribe como una de estas líneas, y lo que escribes en la REPL se convierte en un gesto del patch. Aquí, una caja `msg` con una altura MIDI (57, el la por debajo del do central) pasa por `mtof` (de MIDI a frecuencia) hasta el oscilador: 220 Hz otra vez.

Haz clic en cualquier `code` de estas notas y va a la REPL, lista para ejecutarse con Intro.
@try.en
Type `(box "msg 64" 260 20)` in the REPL and wire it to the mtof; click both messages with the engine running. Or click `(send! :b5 60)`.
@try.es
Escribe `(box "msg 64" 260 20)` en la REPL y conéctala al mtof; pulsa los dos mensajes con el motor en marcha. O haz clic en `(send! :b5 60)`.
```kairotic
(box :b5 "msg 57" 170 20)
(box :b6 "mtof" 170 60)
(connect :b5 0 :b6 0)
(connect :b6 0 :b1 0)
```

## From code to patch | Del código al patch
@en
Changing the text of a box is a gesture too: `(text! :b2 "gain~ 0.1")` is what the inspector writes when you change the argument of the gain~ below it.

The Code tab goes the other way: edit the code there and run it with Ctrl+Enter, and the whole patch is rebuilt from it (as one single event in the history).
@es
Cambiar el texto de una caja también es un gesto: `(text! :b2 "gain~ 0.1")` es lo que escribe el inspector cuando cambias el argumento del gain~ debajo de la caja.

La pestaña Code va en sentido contrario: edita allí el código y ejecútalo con Ctrl+Intro, y todo el patch se reconstruye a partir de él (como un único evento en la historia).
@try.en
In the Code tab, change `osc~ 220` to `osc~ 330`, or move a box by changing its numbers, and press Ctrl+Enter.
@try.es
En la pestaña Code, cambia `osc~ 220` por `osc~ 330`, o mueve una caja cambiando sus números, y pulsa Ctrl+Intro.
```kairotic
(text! :b2 "gain~ 0.1")
```

## The history keeps everything | La historia lo guarda todo
@en
Every step of this lesson is a point in the history (the timeline below). Click any point, or use Ctrl+Z, to go back to that moment: the patch and its code are as they were then.

If you change something in the past, nothing is lost: a **branch** of your own is born from there, and the lesson stays on its line. ◀ ▶ in this bar take you back to it.
@es
Cada paso de esta lección es un punto de la historia (la línea de tiempo de abajo). Haz clic en cualquier punto, o usa Ctrl+Z, para volver a ese momento: el patch y su código están como estaban entonces.

Si cambias algo en el pasado no se pierde nada: nace una **rama** tuya desde ahí, y la lección sigue en su línea. ◀ ▶ en esta barra te devuelven a ella.
@try.en
Go back to the step "Wires", add a second `osc~` to the gain~, and look at the new branch in the history. Then press ▶ here.
@try.es
Vuelve al paso «Cables», añade un segundo `osc~` al gain~ y mira la rama nueva en la historia. Luego pulsa ▶ aquí.

## What next | Y ahora
@en
Select any box and press **?**: the Help tab tells what each inlet and outlet does, and most classes have a **help patch** that opens like this lesson.

Other tutorials are in the Help tab. When you want to keep what you build, open Sessions and create a work of your own (solo) or a room to share it.
@es
Selecciona cualquier caja y pulsa **?**: la pestaña Help explica qué hace cada entrada y salida, y la mayoría de clases tiene un **patch de ayuda** que se abre como esta lección.

Hay más tutoriales en la pestaña Help. Cuando quieras guardar lo que construyes, abre Sessions y crea una obra tuya (solo) o una sala para compartirla.
