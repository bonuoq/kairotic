# Presets: recall, morph, generate | Presets: recuperar, transformar, generar
track: composition
order: 2

## An instrument to play | Un instrumento para tocar
@en
A small FM synthesizer in Faust with a pulse that cuts it rhythmically. Three knobs drive it by name: **strobe** (how fast the pulse beats, on a log scale), **index** (how bright the FM is) and **duty** (how long each pulse stays open). Each knob sends `[:name value]` to the left inlet of `faust~`; the keyboard sends the notes.

A knob keeps its value **in its text**: `knob 0.5 50 2 log strobe` is at 2. That is what makes it part of a preset.
@es
Un pequeño sintetizador FM en Faust con un pulso que lo corta rítmicamente. Tres knobs lo controlan por nombre: **strobe** (lo rápido que late el pulso, en escala logarítmica), **index** (el brillo de la FM) y **duty** (cuánto queda abierto cada pulso). Cada knob envía `[:nombre valor]` a la entrada izquierda de `faust~`; el teclado envía las notas.

Un knob guarda su valor **en su texto**: `knob 0.5 50 2 log strobe` está en 2. Eso es lo que lo hace parte de un preset.
@try.en
Press ▶ and play the keyboard; turn the knobs.
@try.es
Pulsa ▶ y toca el teclado; gira los knobs.
```kairotic
(box :b9 "faust~" 146 265)
(code :b9 "import(\"stdfaust.lib\");\nfreq = hslider(\"freq\", 220, 20, 2000, 0.01) : si.smoo;\ngate = hslider(\"gate\", 0, 0, 127, 1) > 0;\nratio = hslider(\"ratio\", 2, 0.5, 8, 0.01) : si.smoo;\nindex = hslider(\"index\", 3, 0, 12, 0.01) : si.smoo;\nstrobe = hslider(\"strobe\", 8, 0.5, 40, 0.01) : si.smoo;\nduty = hslider(\"duty\", 0.4, 0.05, 0.95, 0.01) : si.smoo;\natk = hslider(\"attack\", 0.01, 0.001, 1, 0.001);\nrel = hslider(\"release\", 0.3, 0.01, 3, 0.001);\nenv = gate : en.adsr(atk, 0.1, 0.8, rel);\npulse = (os.lf_saw(strobe) < duty) : si.smooth(0.995);\nmod = os.osc(freq*ratio) * freq * ratio * index * (0.3 + pulse);\ncar = os.osc(freq + mod);\nprocess = car * env * pulse * 0.5 <: _,_;")
(box :b10 "gain~ 0.2" 226 532)
(box :b11 "dac~ 1 2" 226 592)
(box :b15 "knob 0.05 0.95 0.8 duty" 96 136)
(box :b14 "knob 0 12 1 index" 179 137)
(box :b13 "knob 0.5 50 2 log strobe" 262 136)
(box :b20 "keyboard" 461 100)
(connect :b9 0 :b10 0)
(connect :b9 1 :b10 0)
(connect :b10 0 :b11 0)
(connect :b10 0 :b11 1)
(connect :b13 0 :b9 0)
(connect :b14 0 :b9 0)
(connect :b15 0 :b9 0)
(connect :b20 0 :b9 0)
```

## Three keyframes | Tres fotogramas clave
@en
**◆ Snapshot** keeps the work as it is now: a keyframe, a square in the history. Here are three, made one after the other: `calm` (slow pulse, soft FM), `pulse` and `storm` (fast pulse, bright FM). Between them only the knobs changed.

Every keyframe is also a **preset**: the text of every box at that moment. They are numbered in order: calm is 1, pulse 2, storm 3. `(keyframes)` in the REPL lists them.
@es
**◆ Snapshot** guarda la obra tal como está ahora: un fotograma clave, un cuadrado en la historia. Aquí hay tres, hechos uno tras otro: `calm` (pulso lento, FM suave), `pulse` y `storm` (pulso rápido, FM brillante). Entre ellos solo cambiaron los knobs.

Cada fotograma es también un **preset**: el texto de cada caja en ese momento. Se numeran por orden: calm es 1, pulse 2, storm 3. `(keyframes)` en la REPL los lista.
```kairotic
(snapshot "calm")
(text! :b13 "knob 0.5 50 8 log strobe")
(text! :b14 "knob 0 12 5 index")
(text! :b15 "knob 0.05 0.95 0.5 duty")
(snapshot "pulse")
(text! :b13 "knob 0.5 50 32 log strobe")
(text! :b14 "knob 0 12 11 index")
(text! :b15 "knob 0.05 0.95 0.15 duty")
(snapshot "storm")
```

## Recall | Recuperar
@en
A `presets` box plays the keyframes. A number on its left inlet **recalls** one: every box takes its text of then, and the knobs send their values to the synth. It is one event of the history, so one Ctrl+Z undoes it. A label works too: a `msg calm`.

Boxes added since a keyframe (this presets box, these messages) stay as they are: a preset never rebuilds the patch.
@es
Una caja `presets` toca los fotogramas. Un número en su entrada izquierda **recupera** uno: cada caja toma su texto de entonces, y los knobs envían sus valores al sintetizador. Es un solo evento de la historia, así que un Ctrl+Z lo deshace. También sirve una etiqueta: un `msg calm`.

Las cajas añadidas después de un fotograma (esta caja presets, estos mensajes) quedan como están: un preset nunca reconstruye el patch.
@try.en
With ▶ on and a key held (⇧-click keeps it), click 1, 2 and 3.
@try.es
Con ▶ y una nota sostenida (⇧-clic la mantiene), haz clic en 1, 2 y 3.
```kairotic
(box :b18 "presets" 538 408)
(box :b23 "msg 1" 542 304)
(box :b24 "msg 2" 586 303)
(box :b25 "msg 3" 631 303)
(connect :b23 0 :b18 0)
(connect :b24 0 :b18 0)
(connect :b25 0 :b18 0)
```

## Morph | Transformar
@en
A position on the **right** inlet morphs between keyframes: 1.5 is halfway from calm to pulse, 2.5 halfway from pulse to storm. The knobs move as messages, as when you drag them (strobe geometrically, since its knob is `log`); the knob that drives the morph is left alone.

Nothing is written while you morph: `keep` writes the knobs where they are, as one event.
@es
Una posición en la entrada **derecha** transforma entre fotogramas: 1.5 es la mitad entre calm y pulse, 2.5 la mitad entre pulse y storm. Los knobs se mueven como mensajes, igual que al arrastrarlos (strobe de forma geométrica, porque su knob es `log`); el knob que conduce la transformación no se mueve.

Mientras transformas no se escribe nada: `keep` escribe los knobs donde están, como un evento.
@try.en
Drag the knob on the right slowly from 1 to 3 while a note sounds. Stop somewhere you like and click keep.
@try.es
Arrastra despacio el knob de la derecha de 1 a 3 mientras suena una nota. Para donde te guste y haz clic en keep.
```kairotic
(box :b21 "knob 1 3 1" 705 308)
(box :b27 "msg keep" 640 250)
(connect :b21 0 :b18 1)
(connect :b27 0 :b18 0)
```

## A new preset | Un preset nuevo
@en
A **bang** generates a preset from what changes and what remains: what is the same in every keyframe stays (the synth, the gain, the range of each knob), and each value that changes takes a new one within the range the keyframes span. `[:generate 42]` gives the same one every time.

If you like what you hear, ◆ Snapshot keeps it: it becomes keyframe 4.
@es
Un **bang** genera un preset a partir de lo que cambia y lo que permanece: lo que es igual en todos los fotogramas se queda (el sintetizador, la ganancia, el rango de cada knob), y cada valor que cambia toma uno nuevo dentro del rango que abarcan los fotogramas. `[:generate 42]` da siempre el mismo.

Si te gusta lo que oyes, ◆ Snapshot lo guarda: se convierte en el fotograma 4.
@try.en
Click the bang a few times while a note sounds.
@try.es
Haz clic en el bang varias veces mientras suena una nota.
```kairotic
(box :b26 "bang" 542 250)
(connect :b26 0 :b18 0)
```

## A panel to perform | Un panel para tocar
@en
For a performer, only the controls matter. Select the boxes you want (a frame drawn around them, or ⇧+click) and press **Present**: it asks whether to present the selection, and puts each box where it is in the patch. Here it is already done, with `(present-in-place …)`.

Pressing **Edit** brings the whole patch back. You can also play the panel in **Perform**: what the presets change there goes to the take, not to the history.
@es
Para quien toca, solo importan los controles. Selecciona las cajas que quieras (un marco a su alrededor, o ⇧+clic) y pulsa **Present**: pregunta si presentar la selección, y pone cada caja donde está en el patch. Aquí ya está hecho, con `(present-in-place …)`.

**Edit** devuelve el patch entero. También puedes tocar el panel en **Perform**: lo que cambian los presets allí va a la toma, no a la historia.
@try.en
Press Present and play the panel: keyboard, knobs, 1 2 3, the morph knob and the bang.
@try.es
Pulsa Present y toca el panel: teclado, knobs, 1 2 3, el knob de transformación y el bang.
```kairotic
(present-in-place :b13 :b14 :b15 :b20 :b21 :b23 :b24 :b25 :b26 :b27)
```
