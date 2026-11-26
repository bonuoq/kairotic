# Teclas y gestos

Cómo editar, seleccionar, tocar y dibujar en el patch. (Era la línea bajo la cabecera del patch; el **?** junto a
**Annotate** abre esta página.)

## Mensajes y tiempo

- **Los mensajes viajan sin ▶.** Un bang, un número o un mensaje pulsados recorren los cables al instante.
- **▶** pone en marcha el sonido y el tiempo (el motor, los metros, los players, `loadbang`); **■** los para.

## Cajas

- **⌘/Ctrl+clic en una caja** para editarla bajo el patch: sus argumentos y su texto (**Enter** aplica).
- **⇧+clic**, o un marco dibujado en el papel, selecciona varias: se arrastran juntas, **Supr** las borra,
  **⌘/Ctrl+A** las selecciona todas.
- **Las cajas que se tocan** (bang, msg, number, knobs…) se seleccionan por su asa izquierda; su cuerpo solo toca.
- **Las cajas de código** (faust~, script…): doble clic en su fila de código abre la ventana de código (se puede
  mover; **Ctrl/⌘+Enter** aplica). Sus deslizadores se arrastran.
- **Las cajas `tree`**: clic en una nota de la partitura para seleccionarla (↑ ↓ la mueven, una letra le da esa
  altura, Supr la vuelve silencio, Enter otra vez nota). Las fichas de su cabecera: **⇄** otra vista, **{ }** su código,
  **analysis** muestra u oculta lo que un análisis escribió en él (las cifras bajo el bajo), solo en esa caja —
  `(show-layers :b3 :analysis)`; **lyrics**, en un árbol que canta un texto, muestra u oculta sus sílabas bajo las notas
  (se ven hasta que la caja las oculta: `(show-layers :b3)` las oculta, `(show-layers :b3 :lyrics)` las muestra).

## Lienzo

- **Arrastrar** dibuja un trazo; **⇧** recto, **⌥** a mano alzada; un **clic** fija una posición.

## El menú ☰

Sessions (tus obras y las salas compartidas), Share/Export (un enlace, un iframe), la obra como archivo (`.kairotic`),
Feedback, esta página y la documentación.
