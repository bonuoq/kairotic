# Kairotic

*[Leer en castellano](README.es.md)* · **0.2.0-alpha** · [open the app](https://bonuoq.github.io/kairotic/) · [documentation](docs/README.md)

A collaborative visual-acoustic space for musical improvisation, composition and performance:
a patcher where **code and patch are the same work**, with a branching, shared history, an EDN tree for extensible musical notation, Verovio integration, different graphical representations, DSP, code boxes (Faust, ClojureScript) and components
that anyone can write and share.

*kairos* + *chaotic*: the opportune moment and the divergence of timelines.

## Principles

- **Data first.** A work is EDN; every gesture is an event written as code.
- **Two views, one work.** Code (a REPL in the CAC tradition) and patch (its graphic representation).
- **Branching, collaborative history.** A tree of events; it branches on simultaneous gestures or going back, and branches can be merged.
- **Representation and reading are separate.** A canvas is only frequency over time; whoever reads it gives it a temporal organisation.
- **Components.** Every box class is a map of data and functions with a common contract, written in sections: arguments, logic and a view made of data.
- **Static.** ClojureScript interpreted with [Scittle](https://github.com/babashka/scittle) (no compiler), dependencies from a CDN and WebAssembly (Faust, Verovio).

## Using it

- **[Open the app](https://bonuoq.github.io/kairotic/)** (Kairotic Pages): solo works and rooms in GUN,
  Claude with your own Anthropic API key. Inside claude.ai, the Kairotic artifact does the same with your
  claude.ai account.
- Start with the **[Guide](docs/guide.md)**, then [Concepts](docs/concepts.md); the Help tab has the
  tutorials and a page for every class ([reference](docs/reference.md)).
- Share what you make with Claude in the
  [Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery); ideas and questions in
  [Discussions](https://github.com/bonuoq/kairotic/discussions).

## Layout

```
app/                  the app: index.html (interface and styles) and page/*.cljs (the page's ClojureScript, in order)
core/kairotic/        the modules: components, engine, canvas, score, mt (musical trees), links, assistant (Claude)…
core/backends/        the GUN backend for Pages (db, rooms, user, Claude with your own key)
site/                 the Pages edition: build.mjs, configuration (relays), GUN, the embed test page
packages/             official packages: @kairotic/synth, @kairotic/spatial, @kairotic/controls
examples/             the catalog Claude reads when it writes
docs/                 documentation (English and Spanish), tutorials, generated class reference
tests/                tests (cljs/*.cljs), run in the browser (tests.html) and in CI
relay/                a GUN relay for rooms
studies/              the 23 studies of the prototype, as they were published
components/           deprecated npm package kairotic-components (studies 9–23), replaced by @kairotic/controls
```

## Development

Kairotic is static: ClojureScript interpreted by [Scittle](https://github.com/babashka/scittle) in the
browser, no compiler. Build and serve it locally:

```sh
node site/build.mjs                 # → _site/ (Pages edition) and _artifact/ (claude.ai edition)
cd _site && python3 -m http.server 8000
# http://localhost:8000          the app
# http://localhost:8000/tests.html   the tests
```

`site/build.mjs` builds the packages, Claude's examples and the tutorials first. On every
push, GitHub Actions deploys Pages, runs the tests in a headless Chromium, and regenerates
[docs/reference.md](docs/reference.md) from the help. See the [Changelog](CHANGELOG.md).

## Components

See [Writing a component](docs/writing-a-component.md) and [`packages/`](packages/README.md). Official
packages come into a work by themselves when a box uses one of their classes (`knob` brings
`@kairotic/controls`); any published component or package is imported with
`(import! "npm:@kairotic/controls@0.1.0/dist/index.mjs")`.

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
