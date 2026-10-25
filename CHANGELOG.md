# Changelog

## Unreleased

- **Components off the patch** (issue #8): a `component` box defines a class and has no inlets nor
  outlets, so the patch no longer draws it (nor selects, frames or anchors marks to it). The
  **Components** tab keeps the work's definitions — the class each defines, whether it compiles (and
  why not), where it is (sub-patches too) — with **New component**, **Edit** (its code in the code
  window), **Publish** and ×; a click on a row chooses it, and the Claude tab's "change the selected
  component" changes the one chosen (or the one open in the code window). Writing `component` in a new
  box makes a definition there; `(new-component!)` from the REPL. It is still a box of the work: its
  history, its code (`(box :bN "component" 0 0)`, `(code :bN …)`), links and embeds are unchanged, so
  older works open as they were, without the column of definitions on their paper.

## 0.2.0-alpha — 2026-10-23

The second cycle: the app learns to draw and to write on itself. After four new studies (24–27:
draw, overlay, layers, geometry), a patch has **layers** with annotations anchored to its boxes and
projections of their views; components get a richer **shapes** vocabulary, parts you can press and a
generic **`draw`** box; music theory becomes geometry in **`@kairotic/theory`**; listening grows
(`monitor`, recording from a point, overwriting a take); and each community can run **its own relay**.

### Highlights

- **Annotations and layers**: **Annotate** draws lines, arrows and texts on a layer, each point anchored
  to the box nearest it (it follows the box; a deleted box leaves its marks on the paper). Layers go over
  or under the boxes, in the patch view and/or the presentation. Marks can be moved, whole or by one
  end. `(mark …)`, `(move-mark …)`, `(unmark …)`, `(layer …)`, `(project …)`: one event each, part of the
  code and of links.
- **Projections**: `(project :b9 :viz [x y w h])` draws a box's view again, at another size, on a layer
  — a `monitor` or a `tonnetz` large behind the presentation.
- **Shapes**: `:curve`, `:group` (moved, turned, scaled), `:opacity` and `:hit` (a part of a view that can
  be pressed: the component's `:gesture` gets `:hit`).
- **`draw [w h]`**: a view made of the shapes that arrive as messages (also written as a msg: `circle 40
  40 10 accent hit sun`), with named shapes to move and shapes that send their `:hit` when pressed.
- **`@kairotic/theory` 0.1.0**: `pcclock`, `fourier`, `tonnetz`.
- **`@kairotic/analysis` 0.3.0**: `monitor`; `transcribe` records from a point and over a take.
- **Relays**: choose, test and share the relay from the session manager; `npx @kairotic/relay`.
- **Storage**: the browser's copy of the graph in IndexedDB (no more `localStorage max!`).
- **Before the release**: help patches with several steps, a rest of a score becomes a note again, parts
  of a view easier to press, boxes never see-through, nothing moved by mistake in presentation.

### All the changes

- **Help**: a help patch can have several steps, one use each (`:steps` in the help of a class): it
  opens as a lesson, ◀ ▶ travel between them, and the Help tab lists them (a click opens that step).
  `freqt` gets its help patch (drawing and playing it, a tuning and a grid, as a score, the viewer of a
  tree); `canvas` (an automation, a path) and `mt` (a canon, playing it) more uses. The Help tab no
  longer shows the history of the prototype (the studies and the glossary of old names stay in the
  repository), nor mentions of the studies in its pages. Two new tutorials: *Harmony as geometry*
  (`pcclock`, `fourier`, `tonnetz`) and *Annotations and layers* (marks, layers, `draw`).
- **Score**: a rest can be selected and becomes a note again — Enter (the pitch of the note before
  it in its staff), ↑ ↓ (a step above or below that one), a…g (the nearest note of that name); on a
  note, a…g changes its pitch to the nearest one of that name.
- **Patch**: boxes are always opaque (a selected box and a msg mixed their tint with the box colour), so
  wires never show through them.
- **Presentation**: a plain drag no longer moves a box — so a `freqt`, a `canvas` or a knob is not moved
  by its header or its grip while playing; ⌥/Alt+drag moves it.
- **Parts of a view** (`:hit`): a press near a small part finds it (the nearest within 10 px,
  `shp/hit-near`), the part under the pointer is highlighted (`shp/only-hit`), and the pointer is the
  same hand over every played view (no resize arrows on `draw`, `tonnetz`, `pcclock`, `fourier`, knobs
  or numbers).

- **Layers** (Study 26): a patch can have `:layers` (`{:z :over|:under :show #{:patch :present}}`),
  `:marks` (`{:layer :kind :line|:arrow|:text :pts|:at …}`, points `[:bN dx dy]` or `[:patch x y]`) and
  `:projections` (`{:bN {:layer :rect [x y w h]}}`), changed by the events `[:layer id l]`,
  `[:annot id m]` and `[:project id p]` (nil removes). Deleting a box moves its marks' points onto the
  paper and drops its projection; merging keeps each mark, layer and projection as its own unit. In the
  presentation a mark follows where its boxes are presented (and is not drawn if one of them is not).
  The **Annotate** bar: Draw, Arrow, Text, Move, Erase, the layer, over/under, patch/presentation;
  `(annotate :arrow)` · `(annotate false)`. **Move** drags a mark — each point keeps its anchor, so one
  anchored to a box still follows it — or one end of a line or an arrow, anchored again to the box
  nearest where it is let go; `(move-mark :a1 dx dy)`. Tests: `tests/layers.mjs`.
- **`kairotic.shapes`**: `[:curve {:points …}]`, `[:group {:x :y :rotate :scale} [shapes]]` (4 deep),
  `:opacity` on groups too, and `:hit` on any shape; `shp/hit-at` finds the shape pressed from the
  shapes themselves (on top wins; inside groups, turned or scaled). The `:gesture` of a component gets
  `:hit`. Tests: `tests/theory.mjs`.
- **`draw [w h]`** (core): a shape adds, a list of shapes replaces, `[:set k shape]` adds or replaces the
  one called k, `[:unset k]`, `clear`; positional shapes for msg boxes (`circle cx cy r`, `rect`, `line`,
  `arc`, `text x y "…"`, with a colour and `hit name`); a shape with `:hit k`, pressed, sends k.
- **`@kairotic/theory` 0.1.0** (Study 27): `pcclock [notes]` (the set, the sets before it, axes of
  symmetry; prime form, interval vector, the class pressed), `fourier [notes]` (six coefficients with
  their trails; magnitudes and phases), `tonnetz [notes]` (lit nodes, triads, the path of the harmony on
  the nearest copy of the lattice; the triad, the class pressed). Lists of pitches, notes one by one, or a
  chroma. The first version is published by hand; then `theory-vX.Y.Z` tags publish it.
- **Studies 24–27** in `studies/`: draw (thi.ng/geom and WebGL), overlay (marks on Verovio, monitor),
  layers (marks, projections, a WebGL background), geometry (theory views and the new shapes).
- **Choosing the relay (Pages)**: in the session manager, **Relay** shows the relays the page syncs
  through and whether each answers (connected, connecting, waiting for it); a relay can be tested
  (`wss://host/gun`, also written as `https://host` or `host`), used, removed, and the page can go back
  to the site's relays or work without one. Choosing reloads the page with `?peer=…`. While the relays
  are not the site's, the address keeps `?peer=…` and each room has **Copy link**, which carries it: whoever
  opens it syncs through the same relay and finds the room.
- **`@kairotic/relay`**: the relay as an npm package, `npx @kairotic/relay [--port 8765] [--data ./radata]`
  (`--help`), so each community can run its own; with a Dockerfile, `relay/fly.toml`, `render.yaml` and a
  workflow that publishes it on a tag `relay-vX.Y.Z` (the first version by hand).
  0.1.1 is the same code as 0.1.0, published by that workflow (trusted publishing, with provenance).
- **Pages: the browser's copy of the graph in IndexedDB** (GUN's RAD, `site/vendor/gun/lib/`), not
  in localStorage. GUN's localStorage adapter kept everything the browser had seen — its works and the
  rooms a relay sent — as one JSON of at most 5 MB; once full, every save failed with
  `localStorage max!` (the intermittent failures of the tests). What an earlier version left there is
  brought over the first time the page opens (merged by its states: what a relay has that is newer
  stays), and leaves localStorage a minute later or more (other GUN apps of the same origin keep theirs).
  Read from IndexedDB, a large document can arrive in parts: a read waits for the whole of it (json and
  del), and subscriptions skip the parts.
- **`?peer=off`**: no relay at all, remembered like any other choice (`?peer=none` still goes back to the
  site's relays). The browser tests open the app this way, so they no longer write to, or depend on, the
  public relay. Tests: `tests/browser.mjs` (storage).
- **`monitor [seconds] [name …]`** (`@kairotic/analysis` 0.3.0): draws whatever arrives over the last
  seconds (6 by default), one lane per inlet — one per name written after the seconds (`monitor 6 rms
  centroid chroma` has 3 inlets), or one. A number is a line in the range it has had in the window, a
  list of numbers a strip of cells with one row per element (chroma, mfcc), anything else (a bang, a
  word) a mark. Time is that of the messages: the right edge is the last one. Lines keep about 150 points
  in the window, strips 48 columns, marks the last 64; a clock that goes back (the engine started again)
  starts it over. Tests: `tests/analysis.mjs`.
- **Shapes: `:opacity`** (0…1) on any shape of a component's view (`kairotic.shapes`), for the cells
  of `monitor`.
- **Overwrite (punch-in/out)**: `ovr t` — `msg ovr 4`, or `[:ovr 4]`; `ovr` alone from 0 — on a
  `sample`, a `record` or a `transcribe` replaces only what the take covers, from t to where it stops,
  and keeps what came after it (`rec t` still replaces everything after t). A sample joins its first t
  seconds, the take and the rest of its sound after the take; a record or transcribe cuts, at each
  write, what the take covered since the last one, with the new edit `[:cut t1 t2]`: strokes inside are
  erased, those that cross an edge end or begin there, one that spans the window is split in two (the
  part after it a new stroke). `[:cut t]` keeps meaning everything from t on. `@kairotic/analysis` 0.2.2.
- **Recording from a point (punch-in)**: `rec t` — `msg rec 4`, or `[:rec 4]` — on a `sample`, a
  `record` or a `transcribe` keeps what was there before t and records from t on, replacing what came
  after; plain `rec` still starts from 0 and clears. t is in seconds (beats for transcribe). A sample
  joins its first t seconds (silence if it was shorter) with the take, in as many channels as it had; a
  canvas or freqt gets the new edit `[:cut t]`, which erases the strokes that begin at t or later and
  ends at t those that cross it (the point at t interpolated on the scale of the axis), in the same event
  as the first strokes of the take. Strokes of a `record` take from t have ids of their own, so they do
  not replace kept ones; its Y axis is left as it was. `@kairotic/analysis` 0.2.1. Tests:
  `tests/cljs/record.cljs`, `tests/record.mjs`, `tests/sounds.mjs`, `tests/analysis.mjs`.
- **`record [lo hi] [log] [tolerance]`**, a new core class: any stream of numbers into a canvas (or a
  freqt) as strokes over time — a knob, `snapshot~ 50 rms`, a descriptor of `features~`, a position.
  `rec` starts a take from 0 (its first write clears the buffer), `stop` ends it, a bang on the right
  ends a stroke. A value holds until the next one (a staircase: senders like snapshot~ send only what
  changed), simplified within `tolerance` (1% of the range without it). Time in seconds from rec; the
  axes of a canvas follow the take (Y fixed with lo hi). At most one write every 2 seconds, each one
  event of the history. Read back with `reader~` as an automation. Tests: `tests/cljs/record.cljs`,
  `tests/record.mjs`.
- **`transcribe`** (step 4 of audio input; `@kairotic/analysis` 0.2.0): writes what `pitch~` hears into
  a `freqt`. `rec` starts a take from 0 (its first write clears the freqt), `stop` writes what is left;
  in `notes` mode each note is a flat stroke at the pitch it holds longest (the freqt's tuning or score view
  rounds it, so microtones stay), a new one when the pitch moves more than 0.6 of a semitone or an
  `onset~` bang arrives on the right; in `glide` mode a stroke follows the pitch (points every 10 cents,
  64 at most). Times are beats at bpm (60 by default: one beat a second); notes shorter than ms (60) are
  left out. It writes at most every 2 seconds, each write one `[:batch …]` event of the history. Tests:
  `tests/analysis.mjs`.
- **A sound loaded in an earlier session keeps its length and picture**: read back from this browser's
  store, it was not described again, so `(load-sound! :bN url)` wrote only `{:audio … :url …}` and the
  box drew no waveform. Now it learns its sample rate, length, channels and peaks as when it was stored.
- **`github:` without `@ref` finds the file**: jsDelivr then serves the latest semver tag of the
  repository, not its default branch, so a file added after that tag was not found (in this repository
  the only such tag is `v0.1.0-alpha`). Now it looks at `@main`, then `@master`, then that tag; a
  file jsDelivr does not have comes without the CORS header, so any failure tries the next place. Why a
  sound could not be loaded is said in words — not found (and where it looked), refused by the site
  (CORS) or unreachable, not a sound — instead of always suggesting CORS.
- **`msg` sends strings**: text between quotes is a string — `msg "https://…"`, `msg "two words"`,
  `msg url "github:…" 3` — with `\"` and `\\` inside; numbers and words are as before (`msg stop` is
  still `:stop`). Until now every word was a keyword, so a box that takes text got `:"…"` with its quotes.
  Tests: `tests/cljs/msg.cljs`.
- **A `msg` with a URL loads a sample**: `msg https://…`, `msg "https://…"` and `msg url github:…` now
  work (a msg sends its words as keywords, which the sample ignored). A word or string the sample does
  not understand is said in the REPL instead of doing nothing.
- **Sources of sounds that work without CORS problems**: a sample's URL can be
  `github:owner/repo@ref/path.wav` — any file of a public GitHub repository, served by jsDelivr (the
  banks of Dirt-Samples, a repository of your own sounds) — or `freesound:id`, the preview of a
  Freesound sound fetched with the API key of whoever opens the work: each person their own,
  `(freesound-key! "…")`, kept only in their browser and never in a work, a link or a room. A Freesound
  sound keeps its credit (name, author, licence, page) beside its description and shows it in the box;
  `(credits)` lists the credits of the work; `(sounds "kick" {:max 2 :license "cc0"})` searches
  Freesound and prints the line that loads each result. Without a key the box says it needs one. Tests:
  `tests/cljs/sounds.cljs`, `tests/sounds.mjs`.
- **Presentation is for playing** (issue #57): in Present and in Release/Perform embeds a double-click
  creates no box, no wires can be drawn, and nothing is selected with the mouse (no frame, ⇧+click,
  ⌘/Ctrl+click, ⌘/Ctrl+A; a click on a box does not select it, so Delete removes nothing). Switching to
  presentation clears the selection. In the editor's Present a box can still be dragged to a new place,
  one at a time; in a Release/Perform embed it stays. Tests: `tests/present.mjs`, `tests/embed.mjs`.
- **Share/Export** is the new name of the Embed button and its panel: a link to share the patch, or
  an iframe to put it in another page. The class names and the commands stay (`embed-link`, `?embed`).
- **Links after `#`** (issue #55): every link Kairotic makes (Embed, `(embed-link)`, `ask-link`, the
  links of the Claude log and of Feedback) carries its parameters after `#` — `…/kairotic/#code=…&present`
  — so a long patch is no longer refused by the server (414: the request line too long). The page reads
  the same parameters after `?` or `#` (after `#` wins), the Pages boot too (`#embed`, `#present`: no
  relay), and a new link pasted in the same tab opens it. `?` links keep working.
  Tests: `tests/embed.mjs` (a link after `#` with a patch of about 20 KB).
- **Samples from URLs**: a `sample` can hold a sound from a URL — `(load-sound! :bN "https://…")`, a
  string (or `[:url "…"]`) on its left, or `(sample! :bN {:url "…"})` in the work's code, links and
  rooms. Every browser that opens the work fetches it by itself when the box is drawn (or a `reader~`
  needs it), decodes it at the engine's rate and keeps it in IndexedDB under a key made from the URL, so
  shared sessions and tests have the same sounds everywhere without sending audio through the history.
  A description that is only a URL learns its length and peaks once loaded; the box says "loading…" or
  "could not load its URL". Accepted: http(s), paths of the page (`sounds/voice.ogg`), `data:` and
  `blob:`; never `javascript:`. A test sound, `tests/assets/a440.wav` (CC0), is served with the tests.
  Tests: `tests/cljs/sounds.cljs`, `tests/sounds.mjs`.
- **Embed: Release/Perform** (issue #50), in place of *Presentation, fullscreen*: its link always
  carries a release of the patch (its presets boxes keeping their presets, as `(release)` makes it; also
  from a tutorial or a help patch) and always opens in Perform, so what is played or changed in the
  frame is a take, never the work. The link work is named «Link · release». `?present` stays its
  address, so links made before open the same way; `(embed-link :release)` (or `:perform`, `:present`).
  Tests: `tests/embed.mjs`, and a check in `tests/release.mjs`.
- **`@kairotic/analysis` 0.1.1**, the first version published from GitHub with trusted publishing
  (0.1.0 was published by hand): the same components. Works pin 0.1.1; the publishing workflow now
  answers to `analysis-v*` tags.
- **`@kairotic/analysis`**, a new official package (step 3 of audio input): from any signal into
  messages and pictures. `pitch~ [lo hi] [threshold]` — YIN in its own AudioWorklet, every 1024
  samples: Hz on the left (0 once when it stops hearing a pitch), clarity on the right, a view with the
  note and its cents. `onset~ [threshold] [ms]` — a bang at each attack and its strength, from the
  growth of the spectrum against the median of the last frames. `chroma~ [ms]` — 12 values from C to B
  and the strongest class as a word, with 12 bars. `features~ [ms] [descriptor …]` — one outlet per
  descriptor (rms, energy, zcr, loudness, centroid, spread, flatness, rolloff, kurtosis, skewness,
  slope, crest, sharpness, perceptualSpread, mfcc, chroma; centroid, spread and rolloff in Hz).
  `spectrum~ [lo hi]` — the spectrum drawn on a log scale. Every box sends only what changed. The
  descriptors are [Meyda](https://meyda.js.org)'s (MIT), loaded from jsDelivr the first time one is
  used; all the boxes use frames of 2048 (Meyda keeps filter banks for one size). The API learns
  `api/load-script` (a classic script, once per page; `npm:` through jsDelivr) and `api/hz->midi`,
  `api/midi->hz`, `api/midi-name`, `api/pitch-class`. Essentia.js stays out (AGPL): a separate package
  later, if wanted. Tests: `tests/analysis.mjs`.
- **Recording buffers** (step 2 of audio input, after `adc~`): a new core class, `sample [seconds]`,
  records what reaches its left inlet on `rec` until `stop` (or until it has `seconds`, 60 by default;
  ■ keeps what was heard), `clear` empties it and a bang sends its length in seconds, as does every new
  recording. Its right outlet is a buffer like a canvas's: a `reader~` plays it at the position of a
  `phasor~` (0 its start, 1 its end), so speed, direction and scrubbing are a matter of the position
  signal; the new `!/` (and `!-`), arithmetic the other way round, turns its length into Hz. The sound
  stays in this browser (IndexedDB) under the hash of its samples; the history and the work's code keep
  only its description, `(sample! :bN {:audio hash :sr :frames :channels :peaks})`, enough to draw
  it anywhere and to say when its sound is not there. `(load-sound! :bN)` decodes a file into it,
  `(save-sound :bN)` saves it as WAV. The native loops live in `core/kairotic/sounds.mjs`; the tap of
  the API learns `:active` and `:flush`, and `api/effect!` lets an audio node ask the page for an effect
  of its box. Tests: `tests/cljs/sounds.cljs`, `tests/sounds.mjs`.
- **Release, presets that travel, and points of the history forgotten** ([#45](https://github.com/bonuoq/kairotic/issues/45)):
  - A `presets` box can keep its presets in its data — `(store-presets! :bN)` copies the keyframes it
    uses, only what changes between them; `(presets! :bN […])` sets them. A box that keeps presets uses
    them instead of the history, and they are part of the patch: its code, `?code=` links and embeds.
  - **Release…** in the history bar (`(release)`) makes a new work (solo, or local without an account)
    with a compact history: one point per keyframe, labels kept, each written as the changes from the one
    before in one `[:batch …]`, then the work as it is, every presets box keeping its presets. The original
    work is not touched.
  - In a solo or local work, ⇧+click points of the history and **Forget…** them, after a warning: the
    moments after them stay exactly as they are (runs of points become one change), the work at those
    moments is lost. Tips of branches and branch points cannot be forgotten; rooms use a release instead.
    REPL: `(forget-points [["id" k] …])`.
  - New history event `[:data :bN d]`, the whole data of a box (merges treat it as the whole box), and
    `kairotic.release/patch-diff`, the events that turn one patch into another. Tests:
    `tests/cljs/release.cljs`, `tests/release.mjs`.
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
- **The panel on the right can be hidden and resized** ([#40](https://github.com/bonuoq/kairotic/issues/40)):
  **»** in its header (or **›** on the bar beside it) hides it and the patch takes the room; **‹** brings
  it back, and so does asking for a tab (? or F1 on a box, `(docs …)`, a tutorial, the Code tab). Drag
  the bar between patch and panel to set its width (a double-click on it hides or shows it). Kept in this
  browser, not in the work. REPL: `(side-panel false)`, `(side-panel true)`, `(side-panel 480)`,
  `(side-panel :auto)`.
- **Canvas, freqt and score boxes can be resized** ([#40](https://github.com/bonuoq/kairotic/issues/40)):
  drag their bottom-right corner; the size stays in the work as one event, `[:size :bN w h]` (a change of
  layout for Perform, its own unit for merges), and the work's code writes `(resize :bN w h)`. A score
  reflows its notation to the width and keeps the height of the notation. A double-click on the corner,
  or `(resize :bN)`, brings back the default size. Tests: `tests/layout.mjs`.
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
