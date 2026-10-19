# Changelog

## Unreleased

- **Sound from outside, and back into messages** (step 1 of audio input, recording buffers and the
  `@kairotic/analysis` package): three core classes in a new module, `core/kairotic/input.cljs`.
  `adc~ [channel …]` is the audio input — the microphone or the sound card, one outlet per channel
  (`adc~ 1` by default) —; at ▶ it asks for the microphone once and takes its sound as it is, without
  the echo cancellation, noise suppression and automatic gain made for calls; every `adc~` shares one
  stream, closed a moment after the last one stops. `snapshot~ [ms] [rms|peak|db]` turns a signal into
  numbers every ms: its value, or its level; it sends only what changed and has a small meter of its
  own. `scope~ [ms] [zoom]` is an oscilloscope in the patch, steady on a rising zero crossing; dragging
  over it zooms and changes the time, written in its text on release. Underneath, the **API** (still
  version 1: only additions) opens the way back from the sound: `api/report!` lets an audio node give
  its own box what it finds, which the box's `:receive` gets on inlet `:audio`; `api/tap` is a worklet
  that hands a signal to the page every hop samples as frames, a summary (last, rms, peak) or a trace
  (min and max per column), with the loops over samples in the worklet; `api/retap`, `api/db`. Docs:
  guide · guía, writing a component · escribir un componente. Tests: `tests/cljs/input.cljs`,
  `tests/audioin.mjs` (the test browser runs with a fake microphone).
- **Present the selection** ([#42](https://github.com/bonuoq/kairotic/issues/42)): pressing **Present**
  with boxes selected that are not in the presentation yet asks whether to present them; *Present the
  selection* puts them in it where they are in the patch, as one event of the history. REPL:
  `(present-in-place :b3 :b4)`. Tests: `tests/present.mjs`.
- **Tutorial: Presets — recall, morph, generate** (`(tutorial "presets")`, composition track), with the
  FM synthesizer of [#42](https://github.com/bonuoq/kairotic/issues/42): three keyframes (calm, pulse,
  storm), a `presets` box played by `msg 1 2 3`, a knob that morphs, `keep`, a bang that generates, and
  the controls presented as a panel.
- **Presets from the keyframes of the history** ([#35](https://github.com/bonuoq/kairotic/issues/35)):
  every keyframe (◆ snapshot, or take kept from Perform) is a preset of the work — the text of each
  box then, sub-patches included: its arguments and the values its controls keep (a knob, `adsr~`,
  `space~`). The new core class `presets` plays them: a number or a label on the left **recalls** a
  keyframe, as one event of the history (boxes added or removed since, lines and buffers are not
  touched); a position on the right **morphs** — `1.5` is halfway from the first to the second — moving
  the controls as messages, as a drag does (log knobs geometrically, envelopes element by element, the
  knob that drives it left alone), until `keep` writes them; a **bang** (or `[:generate seed]`)
  **generates** a new preset: what is the same in every keyframe stays, numbers that change take a
  value within their range, words that change are one of theirs. Its outlet sends the values of the
  controls it set. `presets intro verse` uses only those snapshots. REPL: `(keyframes)`, `(recall 2)`,
  `(morph 1 2 0.5)`, `(morph :keep)`, `(generate 42)`. A new history event, `[:batch [ev …]]`, writes
  several changes as one (merges and takes understand it). Docs: guide · guía. Tests:
  `tests/cljs/presets.cljs`, `tests/presets.mjs`.
- **Type the value of a numeric control** ([#32](https://github.com/bonuoq/kairotic/issues/32)): a
  double-click on a `number` box, on a knob — or any component whose `:gesture` gives numbers (a keyboard
  gives notes, so it plays as before) —, on a slider of a code box such as `faust~` or on the value
  written beside it, or on such a control presented in the panel of a sub-patch, opens a small field
  with its value. Enter (or leaving the field) applies the number as the same gesture a drag leaves in
  the history: a knob is rewritten with it in its text, after its own `:receive` has kept it within its
  range; a slider keeps it within its min and max; a number box sends it. Esc closes the field with no
  change (on a slider it also undoes the jump of the first click). Accepted: `440`, `-3.5`, `.25`, a
  decimal comma (`0,5`), `1e-3`, a ratio (`3/2`); anything else is refused and the field stays open.
  Tests: `tests/numinput.mjs`.
- **Recipes beside kept buffers** ([discussion #17](https://github.com/bonuoq/kairotic/discussions/17), after
  [Rastrum](https://github.com/smoge/Rastrum)): `(keep! :bN)` now keeps, beside the buffer it writes,
  the recipe that made it: the tree as it arrived, the boxes and lines upstream as code, and the box it
  came from, all in one event (`[:kept …]`). While the buffer is unchanged, a freqt shown as a score keeps showing the
  tree in measured notation and `as-tree` returns it; once the buffer changes the recipe is marked
  stale (the header says so). `(recipe :bN)` reads it, `(remake! :bN)` writes its tree back. The work's
  code writes recipes as `(recipe :bN {…})`; the Data view shows `:recipe` beside `:data`; merges treat
  a recipe as its own unit.
- **No more `score` class: a score is a view of a `freqt`** ([discussion #30](https://github.com/bonuoq/kairotic/discussions/30)):
  `score` and `freqt` were the same buffer with the same behaviour, so only `freqt` remains. It is drawn
  as a canvas or as a score (`(view :bN :score)`, ⇄ in its header) and has the third outlet, **edits**,
  for the tree it shows as a score. A box written `"score"` — in older works and histories, in code, or
  typed — is read as a `freqt` shown as a score (a score drawn as a canvas becomes a plain freqt), so
  nothing breaks. Help, docs, tutorials and Claude's guidance now use `freqt` + `(view … :score)`.
- **One box, several views of its data; any buffer as text** ([discussion #30](https://github.com/bonuoq/kairotic/discussions/30)):
  a class can offer `:views`, and each box keeps the one it shows — `(view :b2 :score)`, or **⇄** in its
  header. A `tree` box can be shown as a score in the same box, and its notes (↑ ↓ + − Delete) edit its
  own tree, with no edits wire; a `freqt` can be drawn as a score and a `score` as a canvas. A separate
  `score` box is still the viewer of a transformed tree (`tree → mt … → score`). Models can write and
  read their data as text (`:source`, `:read`, `:diff`): the buffer of a `canvas`, `freqt` or `score`
  opens as EDN in the code window (**{ }** in the header, a double-click on its right, or `(source :bN)`),
  and applying it (Ctrl+Enter, or `(code :bN "…")`) writes only what changed, as one event of the history.
  Text that cannot be read is refused, saying why, and stays in the window. Tests: `tests/cljs/views.cljs`,
  `tests/views.mjs`.
- **Grouped meters and metric weight** ([discussion #17](https://github.com/bonuoq/kairotic/discussions/17)):
  a measure groups its units with `:groups [2 3]` or `{:meter "5/8[2+3]"}` (inherited with the meter,
  checked to add up). Scores write grouped meters as 2+3/8 and now **beam** eighths and shorter notes
  by group, or by beat (dotted beats in 6/8, 9/8, 12/8); tuplets beam their own notes. Metric weight
  as composition data: `mt/meter-level`, Barlow's `mt/indispensability` (3/4 and 6/8 rank the same
  eighths differently), `mt/indispensability-at`, `mt/pulses`, and `mt/thin` / the box `mt thin 0.5`,
  which keeps the notes on the strongest positions of each measure. Docs: `docs/mt.md` · `docs/mt.es.md`.
- **Proportional rhythm in musical trees** ([discussion #17](https://github.com/bonuoq/kairotic/discussions/17),
  after [Rastrum](https://github.com/smoge/Rastrum)): `[:rtm {:shares [1 [1 [1 1 1]] -1 2] :pitches "c4 d4"}]`
  writes a rhythm as shares (negative: a rest; `[weight [shares]]` divides one) that fill their measure
  or their `:dur`. Note values and tuplets follow from shares and meter (three shares of a 3/4 bar are
  quarters, of a 4/4 bar a 3:2 of halves; common factors change nothing), nested tuplets included.
  Pitches are given apart and start again when they run out (talea and color); shares can be RTM text.
  `mt/cell-retrograde`, `mt/cell-rotate`, `mt/cell-at` and `mt/cell-replace-at` transform the shares
  (a cell can grow inside itself). Docs: `docs/mt.md` · `docs/mt.es.md`.
- **Fix an issue with Claude**: each open issue in the Feedback tab has a **Claude ↗** link that opens a new
  Claude chat (claude.ai/new) with a prompt written for that issue — review it, fix it on a branch with
  tests, open a pull request. You read the prompt and send it yourself.
- **Canvas, freqt and score answer and obey messages** ([#26](https://github.com/bonuoq/kairotic/issues/26)):
  on the left inlet, edits — `[:stroke pts]`, `[:note t "c4" dur]`, `[:move :t1 dx dy]`, `[:stretch :t1 k]`,
  `[:erase :t1]`, `[:clear]`, `[:axis :y lo hi :log]`, `[:grid-x 0.25 [4]]`, `[:tuning "19-tet"]`, or several
  in `[:batch [...]]` — change the buffer as one event of the history (`canvas-edit!`); questions —
  `[:read x]`, `[:read :y v]`, `[:strokes]`, `[:get :t1]`, `[:count]`, `[:end]`, `[:range]`, `[:data]` —
  are answered on the left outlet. Numbers and musical trees work as before.
- **`reader~` no longer freezes the page** (the patch of [discussion #22](https://github.com/bonuoq/kairotic/discussions/22)):
  its table of a canvas was sampled again after every change of the history (a knob released: about
  0.6 s per `reader~`, 2.4 s with four), because the canvas, rebuilt, was a new object. Buffers are now
  compared by value, tables are kept by what they depend on (several readers of one canvas share one),
  and sampling only asks the strokes that can pass at each point (≈30× faster). Profiling script:
  `tests/profile/d22.mjs`.
- **Calls / Data in the Code tab** ([#15](https://github.com/bonuoq/kairotic/discussions/15)): the EDN tab
  is gone; the Code tab shows the work as **Calls** (editable, as before) or as **Data**, the state the
  history produces as EDN, now in the code editor (read-only, with colours, folding and search) and
  pretty-printed: one box per line, `:text :x :y` first and `:data` last, `:b2` before `:b10`, long
  values broken over lines. The editor bundle takes a `readOnly` option for it.
- **Code editor** ([#8](https://github.com/bonuoq/kairotic/issues/8)): code boxes (`faust~`, `script`,
  `component`, `tree`) are compact in the patch — one row of their code, their status and their
  parameters — and their code opens with a double-click in a window you can move and resize. Inside is
  CodeMirror 6: line numbers, automatic indentation, matching and closing brackets, structural editing
  for Clojure (`@nextjournal/clojure-mode`), Faust highlighting, search and completion (Faust libraries,
  `api/…`, `clojure.core`, tree tags). Ctrl/⌘+Enter applies and keeps it open. The editor is one
  vendored module (`core/vendor/codemirror.mjs`, built by the `vendor` workflow), so Kairotic stays
  static; without it, a plain text area does the same.
  The **Code tab** and the **REPL** use the same editor: in the REPL, Enter evaluates once the brackets
  are closed (otherwise a new line; ⇧+Enter always), ↑ ↓ bring back earlier expressions.
- **Jams carry what is played** ([#11](https://github.com/bonuoq/kairotic/issues/11)): a knob turned,
  a number dragged or a `msg` clicked in a jam is played in the engines of the others too, not only
  drawn. And a control whose value stays in its text (`knob`) sends that value when the text changes
  from elsewhere — another tab of a room, a jam, or a moment of the history you travel to.
- **Functions of `clojure.core` as boxes** ([#12](https://github.com/bonuoq/kairotic/discussions/12)):
  `into [440]`, `map inc`, `get % :freq`, `conj % 440`, `str/upper-case`… are boxes by themselves. Their
  words are EDN arguments; the message goes last (or where `%` is); each argument has a cold inlet; a
  bang sends again. Only pure, finite functions (results of at most 4096 elements), so they are safe in
  rooms. Components can now read their arguments from the whole text with `:parse`, and classes can be
  supplied on demand (`comp/fallbacks`).
- **`keyboard`** in `@kairotic/controls`, from the Gallery ([#2](https://github.com/bonuoq/kairotic/discussions/2)):
  a virtual MIDI keyboard that plugs straight into `synth~` (Hz 0→0, voice ids 1→1) or `faust~` (Hz and
  `[:gain velocity]`), with a gate for `adsr~`. Press and release follow the mouse; ⇧ builds chords that
  stay, `hold` latches. Gestures are now asked once more on release (`:up true`), so what stays in the
  history is a release or the held chord, never a stuck note; ⇧ on the body of such a box reaches the
  gesture and the grip still selects.

- **`@kairotic/controls`**, a new official package: `knob` moves there (written against the Kairotic
  API) and comes into a work by itself when a box uses it, like `adsr~` or `pan~`. The app no longer
  uses the deprecated npm package `kairotic-components`; its sample components `fifth` and `drift` are
  not carried on (they stay in `components/` and on npm for the works of the studies). Single official
  components are gone: every official class now belongs to a package.

- **Inspector on ⌘/Ctrl+click** ([#4](https://github.com/bonuoq/kairotic/issues/4)): a plain click
  selects and moves a box; ⌘/Ctrl+click opens its inspector (arguments and text). Esc closes it.
- **Several boxes at once**: ⇧+click adds a box to the selection (or takes it out), a frame drawn
  from an empty place of the paper selects every box it touches (⇧ adds), ⌘/Ctrl+A selects all.
  The selection moves together (in the patch or in presentation) and Delete removes it. New REPL
  commands: `(move-by [:b1 :b2] dx dy)`, `(present-by [:b1 :b2] dx dy)`, and `(delete :b1 :b2 …)`
  takes several boxes.
- **Compose and Perform** ([#5](https://github.com/bonuoq/kairotic/issues/5)): **Perform** opens a
  take outside the history, from where you are, to rehearse, try and improvise; going back to Compose
  keeps it as a new point (a branch) or discards it. Ctrl+Z works inside the take. In a shared room,
  whoever performs from the same point plays one take together (a **jam**); the others get an
  invitation to join. Commands: `(perform)`, `(compose)`, `(compose :keep)`, `(compose :discard)`,
  `(jam "id")`.
- **Snapshot**: ◆ in the history, or `(snapshot "name")`, writes a keyframe with the work as it is
  now, in Compose or in Perform.

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
