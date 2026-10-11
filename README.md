# Kairotic

*[Leer en castellano](README.es.md)*

A collaborative visual-acoustic space for musical improvisation, composition and performance:
a patcher where **code and patch are the same work**, with a branching, shared history,
frequency-over-time canvases, scores, code boxes (Faust, ClojureScript) and components
that anyone can write and share.

*kairos* + *chaotic*: the opportune moment and the divergence of timelines.

## Principles

- **Data first.** A work is EDN; every gesture is an event written as code.
- **Two views, one work.** Code (a REPL in the CAC tradition) and patch (its graphic representation).
- **Branching, collaborative history.** A tree of events; it branches on simultaneous gestures or going back, and branches can be merged.
- **Representation and reading are separate.** A canvas is only frequency over time; whoever reads it gives it a temporal organisation.
- **Components.** Every box class is a map of data and functions with a common contract, written in sections: arguments, logic and a view made of data.
- **Static.** ClojureScript interpreted with [Scittle](https://github.com/babashka/scittle) (no compiler), dependencies from a CDN and WebAssembly (Faust, Verovio).

## Layout

```
core/kairotic/        current modules of the system (ClojureScript)
  components.cljs     component registry, core classes, helpers for writing components
  engine.cljs         execution: messages, a time queue on the audio clock, Web Audio nodes
  canvas.cljs         graphic buffers: generic canvas (any data, read along X or Y) and freqt (frequency × time, Scala tunings)
  score.cljs          voice → MEI for Verovio, time ⇄ space
  code.cljs           code boxes: compilers per language, script (ClojureScript)
  signal.cljs         reading at audio rate: phasor~, reader~ (AudioWorklet), sig~
  faust.cljs          faust~: Faust compiled in the browser (faustwasm) as an AudioWorklet
  library.cljs        component box, importing published components
  shapes.cljs         a component's own view: shapes as data → SVG, templates with holes
studies/NN-name/      every study as it was published (index.html + its modules)
components/           npm package kairotic-components (src/*.cljs → dist/*.mjs)
docs/                 glossary (es ⇄ en) and guides, in English and Spanish
tests/                feasibility tests (Faust in artifacts, what can be loaded)
```

Studies 1–8 were written in Spanish and are kept as they were published; from Study 9 on, code
and interface are in English. The [glossary](docs/glossary.md) maps the old names to the new ones.

## Studies

| | Study | What it tests |
|---|---|---|
| 1 | Patcher | code ⇄ patch, EDN, REPL |
| 2 | History | collaborative event tree, front, simultaneity, merging, rooms |
| 3 | Score | piano roll and notation (Verovio) synchronised by time ⇄ space |
| 4 | Patch | editors as patch boxes, one voice per box |
| 5 | Canvas | frequency × time, grids and Scala; reader, ramp, steps; message engine |
| 6 | Components | component registry; code boxes: faust~ and script |
| 7 | Library | components defined in the work, shared library, importing |
| 8 | Controls | a component's own view: knobs playing a faust~ |
| 9 | Sections | everything in English; components in sections (`:args`, logic, `:view` template) |
| 10 | Subpatches | patches inside patches: `patch` boxes with `inlet`/`outlet`, abstractions with `$1`, `(abstract …)` |
| 11 | Presentation | a performer's view (`(present …)`, Present button) and sub-patches seen as panels of their controls |
| 12 | Space | a generic `canvas` read along X or Y (and `freqt` for frequency over time); `dac~` with real channels, `pan~`, binaural `space~` |
| 13 | Signal | reading at audio rate (`phasor~` → `reader~`, an AudioWorklet; signals into `osc~`/`gain~` parameters) and along 2D paths (`reader path`); per-voice gates (`reader~ 2 gate`) into envelopes (`adsr~`); boxes edited from the patch (inspector), and gestures that rewrite the box text |

## Trying it

The studies were published as claude.ai artifacts, which provide the database and the shared
rooms. Outside claude.ai they work in **local mode** (no saving or sharing):

```sh
cd studies/13-signal && python3 -m http.server 8000
# open http://localhost:8000 and choose "Try locally, without saving"
```

## Components

See [`components/`](components/README.md) and the guide
[Writing a component](docs/writing-a-component.md). Inside a work they are imported with
`(import! "npm:kairotic-components@0.1.1/dist/knob.mjs")`; inside claude.ai a page can only load
JavaScript modules from npm through jsDelivr, which is why components are published that way.

## Licences and credits

- **Code** (core, studies, scripts and official components): [Mozilla Public License 2.0](LICENSE).
  It is a file-level copyleft: whoever distributes a modified Kairotic shares their changes to these
  files, while components, works and anything built around them can carry whatever licence their
  authors choose.
- **Documentation** (these READMEs and the project documents):
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Works belong to whoever creates them.** Kairotic imposes no licence on the works, patches,
  canvases, scores or components made with it.
- **Community components:** every definition declares its licence with `:license` (an
  [SPDX](https://spdx.org/licenses/) id); when imported, the licence stays in the header of the copy.

### Dependencies (loaded from a CDN, not included in the repository)

| | Licence |
|---|---|
| [Scittle](https://github.com/babashka/scittle) (SCI, interpreted ClojureScript) | EPL-1.0 |
| [Verovio](https://www.verovio.org) (notation) | LGPL-3.0 or later |
| [faustwasm](https://github.com/grame-cncm/faustwasm) (Faust compiler in WebAssembly) | LGPL-3.0 |
| [IBM Plex](https://github.com/IBM/plex) (typefaces, via Google Fonts) | OFL-1.1 |

Faust code written in a `faust~` box can use the [Faust libraries](https://faustlibraries.grame.fr/);
every function declares its licence, and whoever distributes a work must respect those of the
functions it uses.

### Inspiration

Ideas, not code: [DSim](https://github.com/helins/dsim.cljc) (state and time as data),
[editscript](https://github.com/juji-io/editscript), [INScore](https://inscore.grame.fr/) (time ⇄ space),
[bach](https://www.bachproject.net/) (scores as patch objects),
[JSPatcher](https://github.com/Fr0stbyteR/jspatcher), [OSSIA score](https://ossia.io/),
[Oscilla](https://oscilla.app), [Scala](https://www.huygens-fokker.org/scala/) (tuning format),
OpenMusic, Opusmodus, FOMUS and the LISP tradition of computer-assisted composition.
