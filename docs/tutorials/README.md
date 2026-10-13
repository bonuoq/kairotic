# Tutorials

*[Versión en español](README.es.md)*

Tutorials are lessons that open inside Kairotic (Help tab, or `(tutorial "id")` in the REPL). A lesson
is a local work built step by step: each step makes its gestures, and leaves a point in the history.
The lesson bar shows the note of the step you are at, in Spanish or English; ◀ ▶ travel between
steps; changing something at any step starts a branch of your own, and the lesson stays on its line.

## Tracks

| track | |
|---|---|
| `patch-code` | Patch ⇄ code · Patch ⇄ código |
| `theory` | Notation and theory · Notación y teoría |
| `composition` | Composition and CAC · Composición y CAC |
| `dsp` | Electroacoustics and DSP · Electroacústica y DSP |
| `faust` | Faust |

## Writing one

One Markdown file per tutorial, in the folder of its track: `docs/tutorials/<track>/<id>.md`.

````markdown
# From patch to code | Del patch al código
track: patch-code
order: 1

## A box | Una caja
@en
A paragraph with `code` (a click puts it in the REPL) and **bold**.

Another paragraph.
@es
Un párrafo con `código` y **negrita**.
@try.en
Something to do at this step (optional).
@try.es
Algo que hacer en este paso (opcional).
```kairotic
(box :b1 "osc~ 220" 40 110)
```
````

- `# English | Español` is the title; `## English | Español` starts a step.
- Every step needs `@en` and `@es`; `@try.*` goes in both languages or in neither.
- The `kairotic` block holds the gestures of the step: the same lines as the Code tab and the REPL
  (`box`, `connect`, `text!`, `stroke`, `code`…), one form each. A step without code is a note on
  the same point of the history.
- Give boxes explicit ids (`:b1`) so later steps and notes can name them.

Then build the catalog the app reads (`site/build.mjs` does it too, on every build):

```sh
node docs/tutorials/build.mjs
```

The build checks the format (titles, both languages, balanced code) and stops at the first error.
