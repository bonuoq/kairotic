# Guía

*[Read in English](guide.md)* · [Documentación](README.es.md)

Kairotic es un patcher de música —cajas unidas por líneas, como en Max o Pure Data— donde **el patch y
su código son la misma obra**, y cada gesto queda en una historia que puedes recorrer, ramificar y
compartir. Esta guía recorre la interfaz; [Conceptos](concepts.es.md) explica lo que hay detrás.

## 1. Abrir una obra

Abre [la app](https://bonuoq.github.io/kairotic/) (o el artefacto de Kairotic dentro de claude.ai). La
ventana **Sessions** ofrece tres entradas:

- **Solo** — tus obras, guardadas (en claude.ai, en tu cuenta; en Pages, cifradas en tu navegador).
- **Shared rooms** — una obra que todos los de la sala editan a la vez, cada gesto en la misma historia.
- **Try locally, without saving** — un patch para jugar; no se guarda nada.

Una obra solo puede copiarse a una sala y una sala a una obra solo (con su historia). **Sessions**, arriba
a la derecha, vuelve a abrir esta ventana.

## 2. Hacer un patch

- **Crear una caja**: doble clic en un sitio vacío, escribe su texto —la clase y sus argumentos, como
  `osc~ 440`— y pulsa Intro. Las clases que acaban en `~` son sonido.
- **Conectar**: arrastra desde una salida (las marcas pequeñas bajo una caja) hasta una entrada (encima
  de otra caja).
- **Seleccionar** una caja o una línea con un clic; una caja seleccionada se edita debajo de ella (sus
  argumentos y su texto). **Supr** borra lo seleccionado.
- **Mover** una caja arrastrándola. Las cajas para tocar —`bang`, `msg`, `number`, knobs— se seleccionan
  por el asa de su izquierda; su cuerpo es para tocar.
- **Editar el texto** de una caja: doble clic. Cajas de código (`faust~`, `script`, `component`, `tree`):
  doble clic en el código, y Ctrl+Intro lo aplica.

Un primer patch:

```clojure
(box :b1 "osc~ 440" 40 40)
(box :b2 "gain~ 0.2" 40 100)
(box :b3 "dac~ 1 2" 40 160)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b2 0 :b3 1)
```

Puedes hacerlo con el ratón, escribirlo en la pestaña **Code** (Run · Ctrl+Intro) o en la REPL de abajo,
una llamada cada vez. Las tres cosas son la misma obra: lo que dibujas aparece como código y lo que
escribes aparece como cajas.

## 3. Sonido y tiempo

- **▶** (o la barra espaciadora) pone en marcha el sonido y el tiempo: audio, `metro`, `ramp`,
  `loadbang`, `mt play`. El primer ▶ también pide permiso al navegador para sonar.
- **■** silencia y devuelve cada caja a su estado inicial.
- Los mensajes viajan sin ▶: un clic en un `bang` o un `msg`, un número arrastrado, una caja de datos
  que cambió.

## 4. La historia

Cada gesto es un evento de la historia, abajo en la página.

- **Ctrl+Z** va atrás, **Ctrl+Mayús+Z** (o Ctrl+Y) adelante; o haz clic en cualquier punto de la historia.
- Hacer algo después de volver atrás crea una **rama**: no se pierde nada.
- **Merge…** trae aquí los eventos de otra rama, cuando no chocan.
- En una sala, los gestos de los demás llegan a la misma historia; *Follow the front* te mantiene en el
  punto más nuevo.

## 5. Las pestañas de la derecha

- **Code** — la obra como llamadas (`box`, `connect`, …), editable.
- **EDN** — la obra como datos.
- **Components** — las clases que conoce esta obra; escribe las tuyas, importa las publicadas.
- **Claude** — Claude hace un patch (o cambia el abierto), o escribe un componente, a partir de lo que
  describes. Ver [Pedírselo a Claude](ask.es.md).
- **Help** — esta **documentación** (guía, conceptos, temas, referencia), una página para cada clase,
  entrada por entrada, con un patch de ayuda, y los **tutoriales**. Selecciona una caja y pulsa **?** (o
  F1) para ver su página; `(docs "concepts")` en la REPL abre una página de la documentación.

## 6. La música como datos

Una caja `tree` guarda música en EDN —voces, compases, notas, acordes, dinámicas:
`[:voice [:measure {:meter [4 4]} "c4/1 e4 g4/2"]]`. Conectada a una `score`, se dibuja como partitura;
a través de cajas `mt` se transforma (`mt transpose 7`, `mt retrograde`, `mt canon 2 7`); con
`mt play` → `synth~` suena. Haz clic en una nota de una partitura para editarla (↑ ↓ + − ← → Supr). Ver
[Árboles musicales](mt.es.md).

## 7. Presentación

**Present** muestra solo las cajas que has puesto en la presentación —`(present :b4 x y)`, o
arrastrándolas en modo presentación— como un panel para quien toca. **Edit** vuelve.

## 8. Compartir e insertar

- En una sala, todos están en la misma obra.
- **Embed** da un enlace y un iframe con este patch (o este paso de tutorial) para Notion, un blog o un
  curso; *Presentation, fullscreen* muestra solo el panel. Ver [Insertar](embed.es.md).
- Una petición a Claude se puede compartir en la
  [Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery).

## 9. Teclas

| | |
|---|---|
| doble clic en un sitio vacío | una caja nueva |
| Supr / Retroceso | borra la caja o línea seleccionada |
| espacio | ▶ / ■ |
| ? o F1 | ayuda de la caja seleccionada |
| Ctrl+Z · Ctrl+Mayús+Z · Ctrl+Y | atrás · adelante en la historia |
| Ctrl+Intro | aplica código (pestaña Code, cajas de código, pestaña Claude) |
| ↑ ↓ + − ← → Supr | edita la nota seleccionada de una partitura, o el trazo de un canvas |
