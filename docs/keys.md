# Keys and gestures

How to edit, select, play and draw in the patch. (It used to be the line under the patch's header; the **?** beside
**Annotate** opens this page.)

## Messages and time

- **Messages travel without ▶.** A bang, a number, a message clicked go through the wires at once.
- **▶** starts sound and time (the engine, metros, players, `loadbang`); **■** stops them.

## Boxes

- **⌘/Ctrl+click a box** to edit it below the patch: its arguments and its text (**Enter** applies).
- **⇧+click**, or a frame drawn on the paper, selects several: drag them together, **Delete** removes them,
  **⌘/Ctrl+A** selects all.
- **Playable boxes** (bang, msg, number, knobs…) are selected by their left grip; their body only plays.
- **Code boxes** (faust~, script…): double-click their code row to open the code window (a window you can move;
  **Ctrl/⌘+Enter** applies). Their sliders can be dragged.
- **Tree boxes**: click a note of the score to select it (↑ ↓ move it, a letter gives it that pitch, Delete makes it a
  rest, Enter a note again). The chips in their header: **⇄** another view, **{ }** its code, **analysis** shows or
  hides what an analysis wrote on it (the figures under the bass), for that box only — `(show-layers :b3 :analysis)`; **lyrics**, on a tree that sings a text, shows or hides its syllables
  under the notes (shown until the box hides them: `(show-layers :b3)` hides them, `(show-layers :b3 :lyrics)` shows them). Its score is written through a lens, chosen for that box only: the open
  score by default (each voice on its staff, from the highest to the lowest, its clef by its range), `(lens :b3 :closed)`
  the closed score (SA on a treble staff, TB on a bass one), `(lens :b3 :grand)` a keyboard's grand staff (a voice
  crossing to the other staff where it needs to); the tree itself does not change, and its MEI is written through the
  same lens.

## Canvas

- **Drag** draws a stroke; **⇧** a straight one, **⌥** freehand; a **click** sets a position.

## The menu ☰

Sessions (your works and the shared rooms), Share/Export (a link, an iframe), the work as a file (`.kairotic`),
Feedback, this page and the documentation.
