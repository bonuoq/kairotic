# The work as a tree | La obra como árbol
track: composition
order: 1

## A work, written as data | Una obra escrita como datos
@en
A whole work can be one tree: a `:piece` holds `:section`s that follow one another, each section holds the `:voice`s that sound together, and a voice holds its measures. The score keeps one staff per voice, by name, from section to section.

The history of a tree box is made of **edits of nodes**: change one measure and only that measure changes in the history. That is what lets two people (or two of your own branches) work on different parts of the work and then bring them together.

The tree sends itself whenever it changes: the score follows it without ▶ and without a bang.
@es
Una obra entera puede ser un solo árbol: una `:piece` contiene `:section`s que se suceden, cada sección contiene las `:voice`s que suenan a la vez, y una voz contiene sus compases. La partitura mantiene un pentagrama por voz, por su nombre, de una sección a otra.

La historia de una caja tree está hecha de **ediciones de nodos**: cambia un compás y en la historia solo cambia ese compás. Eso permite que dos personas (o dos ramas tuyas) trabajen en partes distintas de la obra y luego las junten.

El árbol se envía solo cada vez que cambia: la partitura lo sigue sin ▶ y sin bang.

## Two sections, two voices | Dos secciones, dos voces
@en
Section A and section B, each with a flute and a cello. The score shows the whole work, with the name of each section over its first bar and a double bar between them.

Look at the Code tab: the tree box is one call, `(tree! :b2 …)`, with the tree laid out one container per line.

The dashed line goes back from the score's third outlet to the tree: it carries the **edits** you make on the score. (When you connect a tree to a score with the mouse, it is drawn for you.)
@es
La sección A y la sección B, cada una con flauta y violonchelo. La partitura muestra toda la obra, con el nombre de cada sección sobre su primer compás y una doble barra entre ellas.

Mira la pestaña Code: la caja tree es una sola llamada, `(tree! :b2 …)`, con el árbol escrito un contenedor por línea.

La línea discontinua vuelve de la tercera salida de la partitura al tree: lleva las **ediciones** que hagas en la partitura. (Cuando conectas con el ratón un tree a una score, se dibuja sola.)
```kairotic
(box :b1 "bang" 40 20)
(box :b2 "tree" 40 60)
(tree! :b2 [:piece {:tempo 80} [:section {:name "A"} [:voice {:name "fl"} [:measure {:meter [3 4]} "e5/1 d5 c5"] [:measure "d5/2 g4/1"]] [:voice {:name "vc"} [:measure "c3/3"] [:measure "g2/3"]]] [:section {:name "B"} [:voice {:name "fl"} [:measure "e5/.5 f5 g5/2"] [:measure "c5/3"]] [:voice {:name "vc"} [:measure "a2/3"] [:measure "c3/3"]]]])
(box :b3 "freqt" 420 60)
(view :b3 :score)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b3 2 :b2 0)
```

## Editing one node | Editar un nodo
@en
A **path** says where a node is: the list of child indices from the root. `[1 0 0 0]` is: section B (1), its flute (0), its first measure (0), and the melody inside it (0).

`(tree-edit! :b2 [:set [1 0 0 0] "e5/.5 f5 g5 a5 b5/1"])` replaces just that melody. In the history it is one event, and the REPL shows it as you see it here. The other operations are `[:attrs path {…}]`, `[:insert path node]` and `[:remove path]`.
@es
Un **camino** dice dónde está un nodo: la lista de índices de hijos desde la raíz. `[1 0 0 0]` es: la sección B (1), su flauta (0), su primer compás (0) y la melodía que contiene (0).

`(tree-edit! :b2 [:set [1 0 0 0] "e5/.5 f5 g5 a5 b5/1"])` sustituye solo esa melodía. En la historia es un evento, y la REPL lo muestra tal como lo ves aquí. Las otras operaciones son `[:attrs camino {…}]`, `[:insert camino nodo]` y `[:remove camino]`.
@try.en
The score already shows the change. Double-click the tree box, change a note in its text and apply with Ctrl+Enter: the REPL shows that it became a `tree!`, and the history only keeps the node that changed.
@try.es
La partitura ya muestra el cambio. Haz doble clic en la caja tree, cambia una nota en su texto y aplica con Ctrl+Intro: la REPL muestra que se convirtió en un `tree!`, y la historia solo guarda el nodo que cambió.
```kairotic
(tree-edit! :b2 [:set [1 0 0 0] "e5/.5 f5 g5 a5 b5/1"])
```

## Editing from the score | Editar desde la partitura
@en
In a score that shows a tree, **click a note**: it is selected. Then:

↑ ↓ change its pitch (⇧ an octave) · **+** **−** double or halve its duration · ← → select the previous or next note · **Delete** turns it into a rest · Esc deselects.

Each change leaves the score by its edits outlet as `[:edit …]`, reaches the tree by the dashed line, and becomes a `(tree-edit! …)`: you can see it in the REPL and in the history. The tree, changed, comes back to the score. A note written inside a melody string is first written out as notes, in the same event.
@es
En una partitura que muestra un árbol, **haz clic en una nota**: queda seleccionada. Después:

↑ ↓ cambian su altura (⇧ una octava) · **+** **−** duplican o dividen su duración · ← → seleccionan la nota anterior o la siguiente · **Supr** la convierte en silencio · Esc quita la selección.

Cada cambio sale de la partitura por su salida de ediciones como `[:edit …]`, llega al tree por la línea discontinua y se convierte en un `(tree-edit! …)`: lo ves en la REPL y en la historia. El árbol, cambiado, vuelve a la partitura. Una nota escrita dentro de un texto de melodía se escribe primero como notas, en el mismo evento.
@try.en
Change the cello's last note of section A with ↑ ↓, and halve a flute note with −: the score warns (⚠ in the REPL) that its measure no longer adds up, until you fix it.
@try.es
Cambia con ↑ ↓ la última nota del violonchelo en la sección A, y divide una nota de la flauta con −: la partitura avisa (⚠ en la REPL) de que su compás ya no cuadra, hasta que lo arregles.

## Branches that merge | Ramas que se funden
@en
Because the history keeps edits of nodes, branches that change **different nodes** can be merged.

Try it: go back one step in the history (◀ in the History pane), change the cello of section B from the score, and a branch of your own grows. Then press **Merge…** and click the tip of the other branch: both changes end up in one tree. If both branches changed the same measure (or one changed a measure and the other something inside it), the merge says which node they both touched.
@es
Como la historia guarda ediciones de nodos, las ramas que cambian **nodos distintos** se pueden fundir.

Pruébalo: retrocede un paso en la historia (◀ en el panel History), cambia desde la partitura el violonchelo de la sección B, y crece una rama tuya. Después pulsa **Merge…** y haz clic en el extremo de la otra rama: los dos cambios quedan en un solo árbol. Si las dos ramas cambiaron el mismo compás (o una un compás y la otra algo dentro de él), la fusión dice qué nodo tocaron ambas.

## A fragment, reused | Un fragmento reutilizado
@en
This step adds two things in one event: a fragment `:cell` in the `:defs` of the piece, and a section C that uses it twice, the second time a fourth lower: `[:use {:ref :cell :transpose -5}]`.

Notes that come from a fragment are not edited from the score (they are the fragment's): change the definition and every use changes with it.
@es
Este paso añade dos cosas en un evento: un fragmento `:cell` en los `:defs` de la pieza, y una sección C que lo usa dos veces, la segunda una cuarta más abajo: `[:use {:ref :cell :transpose -5}]`.

Las notas que vienen de un fragmento no se editan desde la partitura (son del fragmento): cambia la definición y cambian todos sus usos.
@try.en
Click `(tree-edit! :b2 [:attrs [] {:tempo 80 :defs {:cell "g5/.5 f5 e5/2"}}])`, and press Enter in the REPL: section C changes at once.
@try.es
Haz clic en `(tree-edit! :b2 [:attrs [] {:tempo 80 :defs {:cell "g5/.5 f5 e5/2"}}])` y pulsa Intro en la REPL: la sección C cambia al momento.
```kairotic
(tree-edit! :b2 [:attrs [] {:tempo 80 :defs {:cell "e5/.5 d5 c5/2"}}] [:insert [2] [:section {:name "C"} [:voice {:name "fl"} [:measure [:use {:ref :cell}]] [:measure [:use {:ref :cell :transpose -5}]]] [:voice {:name "vc"} [:measure "c3/3"] [:measure "c3/3"]]]])
```

## What next | Y ahora
@en
A work is now a tree you can write as text, edit node by node from the REPL or the score, transform with the `mt` boxes, play with `mt play`, and share in a room where each person's edits are nodes of the same history.

The format is described in the guide *Musical trees* (`docs/mt.md`); the tutorial *A motif and its transformations* shows the `mt` boxes.
@es
Una obra es ahora un árbol que puedes escribir como texto, editar nodo a nodo desde la REPL o la partitura, transformar con las cajas `mt`, tocar con `mt play` y compartir en una sala donde las ediciones de cada persona son nodos de la misma historia.

El formato está descrito en la guía *Árboles musicales* (`docs/mt.es.md`); el tutorial *Un motivo y sus transformaciones* muestra las cajas `mt`.
