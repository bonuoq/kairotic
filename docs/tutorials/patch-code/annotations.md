# Annotations and layers | Anotaciones y capas
track: patch-code
order: 2

## A patch to write on | Un patch sobre el que escribir
@en
A patch can carry its own notes: texts, lines and arrows drawn on **layers** over or under the boxes. They are part of the work like any box: each mark is one event of the history and a line of its code, and they travel in links and embeds.

Here is a small patch to annotate: a number sets the frequency of an oscillator.
@es
Un patch puede llevar sus propias notas: textos, líneas y flechas dibujados en **capas** por encima o por debajo de las cajas. Forman parte de la obra como cualquier caja: cada marca es un evento de la historia y una línea de su código, y viajan en los enlaces y los embeds.

Aquí hay un patch pequeño para anotar: un número fija la frecuencia de un oscilador.
```kairotic
(box :b1 "number 220" 60 60)
(box :b2 "osc~ 220" 60 130)
(box :b3 "gain~ 0.2" 60 190)
(box :b4 "dac~" 60 250)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
(connect :b3 0 :b4 1)
```

## A text and an arrow | Un texto y una flecha
@en
`mark` draws on a layer (`:notes` here). Each point of a mark is **anchored**: to a box, as `[:b1 dx dy]` from its top-left corner, or to the paper, as `[:patch x y]`. A point anchored to a box follows it.

With the mouse: **Annotate** in the bar above the patch opens the tools (Draw, Arrow, Text, Move, Erase); each point drawn is anchored to the box nearest it.
@es
`mark` dibuja en una capa (aquí `:notes`). Cada punto de una marca está **anclado**: a una caja, como `[:b1 dx dy]` desde su esquina superior izquierda, o al papel, como `[:patch x y]`. Un punto anclado a una caja la sigue.

Con el ratón: **Annotate** en la barra sobre el patch abre las herramientas (Draw, Arrow, Text, Move, Erase); cada punto dibujado se ancla a la caja más cercana.
@try.en
Drag the number box somewhere else: the arrow follows it, the text stays on the paper. Then try `(move-mark :a1 0 40)`.
@try.es
Arrastra la caja del número a otro sitio: la flecha la sigue, el texto se queda en el papel. Prueba después `(move-mark :a1 0 40)`.
```kairotic
(mark :notes :a1 {:kind :text :at [:patch 260 40] :txt "drag up and down"})
(mark :notes :a2 {:kind :arrow :pts [[:patch 255 46] [:b1 96 12]]})
```

## Layers | Capas
@en
A layer goes **over** or **under** the boxes, and shows in the patch view, in the presentation, or both: `(layer :guide {:z :under :show #{:patch :present}})`. Marks under the boxes are good for regions and paths; marks over them, for notes.

`(layer :guide nil)` removes a layer with its marks; `(unmark :a3)` erases one.
@es
Una capa va **por encima** o **por debajo** de las cajas, y se ve en la vista del patch, en la presentación o en ambas: `(layer :guide {:z :under :show #{:patch :present}})`. Las marcas bajo las cajas sirven para regiones y recorridos; las de encima, para notas.

`(layer :guide nil)` quita una capa con sus marcas; `(unmark :a3)` borra una.
@try.en
Delete the gain~ box: the end of the line anchored to it stays on the paper, where it was.
@try.es
Borra la caja gain~: el extremo de la línea anclado a ella se queda en el papel, donde estaba.
```kairotic
(layer :guide {:z :under :show #{:patch :present}})
(mark :guide :a3 {:kind :line :pts [[:b1 -20 -14] [:b3 160 -14] [:b4 160 50]]})
(mark :guide :a4 {:kind :text :at [:b4 0 60] :txt "the signal path"})
```

## Drawing from messages | Dibujar con mensajes
@en
Marks are written by you. A `draw` box draws what arrives to it: shapes as messages (`circle 60 55 22 accent hit sun`), or any shape of `kairotic.shapes` from code. A shape with `hit` is a part that can be pressed: it sends its name.

So a patch can draw its own score as it plays, or offer a performer a few things to touch.
@es
Las marcas las escribes tú. Una caja `draw` dibuja lo que le llega: figuras como mensajes (`circle 60 55 22 accent hit sun`), o cualquier figura de `kairotic.shapes` desde el código. Una figura con `hit` es una parte que se puede pulsar: envía su nombre.

Así un patch puede dibujar su propia partitura mientras suena, u ofrecer a quien toca unas pocas cosas que tocar.
@try.en
Click the two messages, then press the circles: print writes sun or moon. Connect the outlet of draw to a msg 330 and then to the number: a circle that changes the pitch.
@try.es
Haz clic en los dos mensajes y pulsa los círculos: print escribe sun o moon. Conecta la salida de draw a un msg 330 y este al número: un círculo que cambia la altura.
```kairotic
(box :b5 "msg circle 60 55 22 accent hit sun" 300 150)
(box :b6 "msg circle 160 55 14 kairos hit moon" 300 190)
(box :b7 "draw 240 120" 300 240)
(box :b8 "print" 300 390)
(connect :b5 0 :b7 0)
(connect :b6 0 :b7 0)
(connect :b7 0 :b8 0)
```
