# Datos que fluyen (Ensayo 21)

*[English version](flow.md)*

## Mensajes y tiempo

Los mensajes viajan siempre que algo los envía —un clic en un bang o en un mensaje, un número
arrastrado, una caja de datos que ha cambiado, la REPL— con o sin ▶, como en Max y Pd (donde solo el
audio necesita el DSP encendido). **▶ pone en marcha lo que necesita un reloj**: el sonido (los nodos de
audio) y el tiempo (loadbang, metro, ramp, `mt play`: todo lo que pide algo *para más tarde*). **■**
silencia y devuelve las cajas a su estado inicial; después, las cajas de datos vuelven a enviar lo que
contienen.

## Las cajas de datos se envían solas

Una caja `tree` envía su árbol **cada vez que cambia** —una edición de su texto, `tree!`, `tree-edit!`, la
historia que se mueve, la edición de otra persona en una sala— y también cuando cambia el patch a su
alrededor (un cable nuevo, un texto nuevo como `mt transpose` → `mt retrograde`), así que lo que depende
de ella siempre está al día. Envía como mucho una vez por momento y solo si algo cambió de verdad. Un
bang lo vuelve a enviar; `tree manual` solo envía con un bang (para el directo, cuando preparas un
cambio y lo lanzas tú).

## Vistas que devuelven sus ediciones

Una `score` que muestra un árbol tiene una tercera salida, **ediciones**: cuando cambias una nota en ella
(clic, y luego ↑ ↓ + − ← → Supr), envía `[:edit [[:attrs [0 1 2] {…}] …]]`. Conectada de vuelta a la caja
tree —una **línea discontinua**, que se dibuja sola cuando conectas con el ratón un tree a una score— las
ediciones cambian el árbol (como `tree-edit!`, un evento de la historia), y el árbol, cambiado, vuelve a la
partitura. Nada se acopla por detrás del patch: el bucle es una línea que se ve, en el patch y en el
código.

Las ediciones nombran el nodo donde está escrita cada nota, así que funcionan a través de
transformaciones: una partitura que muestra `mt transpose 7` de un árbol puede editar el propio árbol.
Las ediciones son mensajes como cualquier otro: se pueden filtrar, mandar a otro tree o escribirlas un
componente.

Una caja tree también acepta árboles enteros por su entrada (la copia de otro árbol, o uno transformado).

## Bucles

- **En un instante**: un mensaje que vuelve a la misma caja 100 veces en un instante es un bucle sin
  tiempo; se corta, y la REPL dice dónde. Un bucle que pasa por el tiempo (metro, un retardo,
  `mt play`) no se corta: es la realimentación que sí quieres.
- **Su propio árbol de vuelta**: una caja tree que recibe su propio árbol, aunque venga transformado
  por cajas `mt`, no cambia (y lo dice): si no, se reescribiría para siempre.
- **Por ritmo**: una caja tree reescrita por mensajes 20 veces en 10 segundos deja de aceptarlos;
  `(resume! :bN)` vuelve a dejarlos pasar.
- Una partitura no envía lo que recibe, solo lo que tú editas, y un tree solo envía lo que cambió: el
  bucle tree ⇄ score termina tras una vuelta.
