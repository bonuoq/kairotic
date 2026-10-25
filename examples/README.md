# Examples for Claude · Ejemplos para Claude

The catalog Claude reads when it writes components inside Kairotic (Study 16 on). Claude sees one line
per example and reads the whole source of the ones it needs with a tool, so the catalog can grow
without the prompt growing.

El catálogo que lee Claude cuando escribe componentes dentro de Kairotic (desde el Ensayo 16). Claude ve
una línea por ejemplo y lee el código entero de los que necesita con una herramienta, así que el catálogo
puede crecer sin que crezca el encargo.

| Category | Examples |
|---|---|
| controls | knob |
| data | fetch (a task, kept in the work), edn (a tree view to pick from) |
| synth | adsr~, synth~ |
| spatial | pan~, space~ |
| faust | resonant-filter, fm-voice |
| abstraction | filter-panel (a Faust filter with its knobs as a panel: a bpatcher) |
| cac | row (twelve-tone row and its forms) |
| notation | note-name (Hz or MIDI → note names with cents) |

## Adding one · Añadir uno

- A new file: `examples/claude/<category>/<name>.cljs` (or `.dsp` for Faust) whose first line is
  `;; about: …` (or `// about: …`), one line saying what it shows.
- Or an existing component: add it to `refs` in [`build.mjs`](build.mjs).
- Then `node examples/build.mjs` writes `catalog.mjs`, which a study serves as `kairotic/examples.mjs`.

Every example should be checked before it is added: it is what Claude imitates.
Cada ejemplo debería probarse antes de añadirlo: es lo que Claude imita.
