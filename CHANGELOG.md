# Changelog

## 0.1.0-alpha — 2026-10-14

The first version of Kairotic as one app, after 23 studies ([docs/studies.md](docs/studies.md)).
From here on the app grows on itself: components, packages and features added to `app/` and `core/`.

### What it is

- A patcher of music where **patch and code are one work**: every gesture is a call, the Code tab
  and the REPL write what the patch draws, and the other way round.
- A **history** that is a tree of events: going back, branching, merging, simultaneous gestures,
  authorship per session; **solo works** and **shared rooms** (claude.ai, or GUN on Kairotic Pages).
- **Sound and time**: Web Audio boxes, Faust compiled in the browser (`faust~`), reading graphic
  buffers at audio rate (`phasor~` → `reader~`), a time queue on the audio clock; official packages
  (`@kairotic/synth`, `@kairotic/spatial`) and published components (`knob`, `fifth`, `drift`).
- **Graphic buffers**: `canvas` (two dimensions) and `freqt` (frequency over time, Scala tunings, bar
  grids), read by `reader`/`reader~`.
- **Music as data**: musical trees in EDN (`tree`, `mt`), drawn as notation (`score`, Verovio),
  transformed, played and edited from the score; the work as a tree of sections and voices.
- **Data that flows**: messages without ▶, data boxes that send themselves only toward what needs
  them, views that send their edits back, loops without time cut.
- **Components** with one contract (logic, view as data, gestures, audio, help), sub-patches,
  abstractions and panels; components defined inside the work; a presentation mode.
- **Learning**: a Help page for every class with a help patch, and bilingual tutorials that open as
  lessons in the history.
- **Claude in the work**: patches and components from a description, checked with the page's tools
  before they arrive; your own Claude account or API key; a log of requests in your browser, shareable
  in the [Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery).
- **Embedding**: a patch, a tutorial step, a help patch or a fullscreen presentation inside Notion or
  any page; links carry the patch as data (`?code`, `?src`) or a description for Claude (`?ask`), never
  a key.

### Since the first build of 0.1.0-alpha

- The documentation inside the app, in the Help tab.
- A Feedback tab: bugs, ideas and questions written as GitHub issues.

### New in this version (since Study 23)

- One app in `app/` (the page split in `app/page/*.cljs`) built with `core/` into Pages and the
  claude.ai edition by `site/build.mjs`.
- `kairotic.links`: reading the code a link carries, as a module of its own.
- Tests (links, musical trees, data that flows) in the browser (`tests.html`) and in GitHub Actions.
- Documentation: an index, a guide, concepts, the studies, and a class reference generated from the help.
