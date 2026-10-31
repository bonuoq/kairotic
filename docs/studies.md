# The studies

*[Leer en castellano](studies.es.md)* · [Documentation](README.md)

Kairotic was built as a series of **studies**: each one a question, answered by a working page
published as a claude.ai artifact, and kept as it was in [`studies/`](../studies). Studies 1–8 were
written in Spanish; from Study 9 on, code and interface are in English (the [glossary](glossary.md)
maps the old names to the new ones). From 0.1.0-alpha on, the app lives in [`app/`](../app) and grows
as one.

**Opening a study.** Kairotic Pages serves every study at its folder:
`https://bonuoq.github.io/kairotic/studies/<folder>/`, for example
[`studies/29-live/`](https://bonuoq.github.io/kairotic/studies/29-live/). There a study can use what a
page published on claude.ai cannot, such as the microphone. On your own computer, serve the folder and
open it on `localhost` (a page opened as a file cannot load its modules):

```sh
cd studies && python3 -m http.server 8000     # then http://localhost:8000/29-live/
```

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
| 14 | Packages | official packages by category (`@kairotic/synth`: adsr~, synth~ · `@kairotic/spatial`: pan~, space~), brought into a work when one of their classes is written; the Kairotic API (`api/…`) for components |
| 15 | Claude | components written with Claude inside the work (the Claude tab, `(ask-component …)`), on the viewer's own Claude account; Claude tries what it writes with the page's tools before it arrives as a component box |
| 16 | Faust | Claude also writes Faust (compiling it to check it), abstractions with faust~ boxes and knobs, and bpatchers whose instances show their knobs as a panel; a catalog of examples by category that Claude reads with a tool ([examples/](../examples/README.md)) |
| 17 | Pages | the same page outside claude.ai: a backend adapter (db, rooms, user, Claude) so it runs on GitHub Pages with [GUN](https://gun.eco) rooms through a [relay](../relay/README.md) and Claude with each person's own Anthropic API key ([docs/pages.md](pages.md)) |
| 18 | Learn | the Help tab: what each class does, inlet by inlet, with a help patch (**?** on a selected box, `:help` in a component); tutorials in Spanish and English that open as lessons — each step a point of the history, ◀ ▶ between steps, a branch of your own when you change something ([docs/tutorials/](tutorials/README.md)) |
| 19 | Time | music as data: musical trees in EDN (hiccup, like bach's llll) with measures, tuplets, chords, dynamics, articulations, texts, parameter changes and reusable fragments; `tree` and `mt` boxes write, transform (transpose, invert, retrograde, augment, canon…) and play them; a score, freqt or canvas shows them live; a theory tutorial ([docs/mt.md](mt.md)) |
| 20 | Work | the work as a tree: a `:piece` of `:section`s, each with its voices (a staff per voice across sections, section names, double bars); a tree box's history is made of node edits (`tree-edit!`, and the text editor or `tree!` write only the difference), so branches that change different nodes merge; scores edit the tree (click a note: ↑ ↓ + − ← → Delete); a composition tutorial |
| 21 | Flow | data that flows: messages travel without ▶ (▶ is for sound and time); a tree sends itself when it changes (or the patch around it does); a score sends the edits made on it by a third outlet, back to the tree by a dashed line; loops without time are cut and reported ([docs/flow.md](flow.md)) |
| 22 | Embed | Kairotic inside other pages (Notion, a blog): links that carry a patch (its code, compressed, read as data), a tutorial step or a help patch; `?embed` shows only the patch, `?present` only its presentation, filling the frame, with a fullscreen button; the Embed button and `(embed-link)` ([docs/embed.md](embed.md)) |
| 23 | Ask | the Claude tab makes patches from a description, or changes the open one, checked with the page's tools (classes, ports, Faust, components) and loaded as one event; `?ask=` links carry a description — never a key — and whoever opens them makes the patch with their own Claude ([docs/ask.md](ask.md)) |
| 24 | Draw | one buffer, two renderers: a `freqt` drawn as SVG (with thi.ng/geom) over a WebGL spectrum made from the same strokes |
| 25 | Overlay | graphic marks on a Verovio score, stored in beats and staff steps so they follow its reflow; a `monitor` of incoming messages (descriptors with Meyda) — now in `@kairotic/analysis` |
| 26 | Layers | components drawn in SVG only; layers over or under the patch with marks anchored to boxes and projections of a box's view; one WebGL background for the whole patch (left for later) — layers are in the app from 0.2.0-alpha |
| 27 | Geometry | a score seen as music theory: pitch-class clock, Fourier coefficients and Tonnetz path; new shapes `:opacity`, `:curve`, `:group`, `:hit` — now `@kairotic/theory` and `kairotic.shapes` |
| 28 | Shift | a sound pitch-shifted offline into a new buffer with [stftPitchShift](https://github.com/jurihock/stftPitchShift) (C++, MIT) built to WebAssembly with wasi-sdk, in a worker; factors read as music (ratios, semitones, cents), several at once as a chord, changing over time as a progression; formant preservation; the new buffer keeps its recipe (source by hash and the shift as data), and remaking it from the recipe gives the same hash |
| 29 | Live | `shift~` in real time: the same WebAssembly as Study 28, frame by frame inside an AudioWorklet (one frame of latency, about 5% of a core with a chord and formants at overlap 8), its output equal to the offline shift; chords, looped progressions on the audio clock, live transposition and formants; what a work keeps of a take is the stream of messages to `shift~`, logged on the audio clock |
| 30 | Inverse | inverse synthesis, first step: a bank of random patches of one synth (plain JavaScript, so the same seed gives the same samples in the page, a worker or Node) analysed with Meyda as `features~` does, exported as NDJSON (`generate.mjs` makes large banks in Node); a first way back — the nearest neighbour in descriptor space — measured against a random pick, by descriptor distance and by patch distance |
| 31 | Units | a `faust~` box opened as a patch of Faust's own elements (`@kairotic/faust-units`: primitives, controls, library functions, `in`/`out`) beside its code, one piece of data in two views: a patch gives code (one definition per box, loops through the one-sample delay `'` written with `~`, the layout in a last comment) and code gives a patch (read with Faust's block-diagram algebra; what the boxes do not know becomes a box of code with the inputs and outputs the compiler finds); round trip checked sample by sample (`tests/roundtrip.mjs`) |
