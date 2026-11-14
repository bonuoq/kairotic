# Guide

*[Leer en castellano](guide.es.md)* · [Documentation](README.md)

Kairotic is a patcher of music — boxes joined by lines, as in Max or Pure Data — where **the patch
and its code are the same work**, and every gesture stays in a history you can travel, branch and
share. This guide walks through the interface; [Concepts](concepts.md) explains what is behind it.

## 1. Open a work

Open [the app](https://bonuoq.github.io/kairotic/) (or the Kairotic artifact inside claude.ai). The
**Sessions** window offers three ways in:

- **Solo** — your own works, saved (in claude.ai, in your account; on Pages, encrypted in your browser).
- **Shared rooms** — a work that everyone in the room edits at the same time, each gesture in the same
  history.
- **Try locally, without saving** — a patch to play with; nothing is kept.

A solo work can be copied into a room and a room into a solo work (with its history). **Sessions**, at
the top right, brings this window back.

On Pages, rooms sync through a **relay**. **Relay**, in the same window, shows the ones in use and
whether they answer; a community can run its own (`npx @kairotic/relay`) and choose it there, and the
links you share carry it. See [Kairotic Pages](pages.md).

## 2. Make a patch

- **Create a box**: double-click an empty place, write its text — the class and its arguments, such as
  `osc~ 440` — and press Enter. Classes ending in `~` are sound.
- **Connect**: drag from an outlet (the small marks under a box) to an inlet (above another box). You need
  not hit the mark: near an outlet it lights up and the pointer becomes a cross, and a wire dropped on a
  box, or just above one of its inlets, lands on the nearest inlet. Wires are curves, here and in the
  patch of a `faust~`, which works the same way.
- **Ids**: every box has an id (`:b7`), which code, the REPL and Room messages name it by. It shows over the
  box's top right corner when the box is hovered or selected; **I** shows them all. **`(`** on the patch opens
  a line of the REPL there (as the field of a new box does when what you write starts with `(`), with the same
  editor as the REPL — completion, brackets closed: Enter runs it once its brackets are balanced and shows
  what it gave below, ↑ ↓ go through the REPL's history, Esc closes it. While a line of code
  waits for a box — the REPL, the Code tab, that line, a Room message — after a space, `(` `[` `{` or `:`
  (`@` in a message), a click on a box writes its id there instead of selecting it, as a click on a cell does
  in a spreadsheet formula: `(connect ` click, `0 ` click, `0)`.
- **The Code tab and the patch**: selecting boxes marks their lines in the Code tab (their box, lines, data…)
  and scrolls to them; putting the cursor on a line of a box selects that box (both boxes, on a `connect`).
  Lines longer than 160 characters — the source of a code box, a buffer kept as data — are folded after
  their beginning, saying how many characters they hide; a click shows them, and they stay shown.
- **Boxes over one another**: a box's real size is only known once it is drawn (a `faust~` grows with its
  sliders, a score with its notation). `(overlaps)` lists the boxes that cover each other, and `(tidy)` moves
  boxes down until none does, in their columns, as one event.
- **Probes on wires**: ⌥/Alt+click a wire (or `(probe :b1 0 :b2 0)`) and it shows, at its middle, the last
  value that went along it, flashing when one passes, and how many a second when they come often. Again takes it
  away; `(unprobe-all!)` takes them all. Probes are only for this tab: they are not part of the work, its history
  or its code. Wires out of a sub-patch box, and signal wires, show nothing yet.
- **Select** a box or a line by clicking it. **⌘/Ctrl+click** a box to edit it below (its arguments,
  and its text). **Delete** removes what is selected.
- **Select several**: ⇧+click adds a box to the selection (or takes it out); a frame drawn from an
  empty place of the paper selects every box it touches (⇧ adds them); ⌘/Ctrl+A selects all. Drag one
  of them and they all move; Delete removes them all.
- **Copy, cut, paste, duplicate**: ⌘/Ctrl+C copies the selected boxes, ⌘/Ctrl+X cuts them, ⌘/Ctrl+V pastes
  them where the pointer is, keeping their layout, and ⌘/Ctrl+D duplicates them a little below and to the
  right (`(duplicate :b3 :b4)` from code). Pasted boxes get new ids and keep their lines among themselves, and
  their lines to boxes that were not copied when those are in the patch. A paste is one event of the
  history. What is copied is the boxes' code, so it can also be pasted in a message or a document; pasting
  reads its last line as data and never runs it.
- **Move** a box by dragging it. Playable boxes — `bang`, `msg`, `number`, knobs — are selected by the
  grip on their left; their body is for playing.
- **Which box is on top**: boxes are drawn in the order they were made, the newest on top, and the box
  you drag comes to the front, so that what you move is never hidden. That is only how your tab shows them,
  as the selection is: it is not part of the work, its history or its code.
- **Type a value**: double-click a numeric control — a `number`, a knob (or any component that is
  dragged for a number), a slider of a `faust~` box or its value — and write the number: `440`, `-3.5`,
  `0,5`, `3/2`. Enter applies it, as a drag would (a knob keeps it in its text, within its range; a
  slider within its min and max); Esc closes the field and leaves the value as it was. What is not a
  number is refused and the field stays open.
- **Edit a box's text**: double-click it. Code boxes (`faust~`, `script`, `component`, `tree`):
  in the patch they show one row of their code; double-click it to open the **code editor**, a window
  you can move by its bar and resize by its corner, with line numbers, automatic indentation, matching
  brackets, structural editing for Clojure (Ctrl+→ / Ctrl+← move over forms, Alt+↑ widens the
  selection), search (Ctrl/⌘+F) and completion. Ctrl/⌘+Enter applies the code and keeps the window
  open; Esc closes it, asking first if something is not applied.

A first patch:

```clojure
(box :b1 "osc~ 440" 40 40)
(box :b2 "gain~ 0.2" 40 100)
(box :b3 "dac~ 1 2" 40 160)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b2 0 :b3 1)
```

You can make it with the mouse, or write it in the **Code** tab (Run · Ctrl+Enter), or in the REPL at
the bottom, one call at a time. The three are the same work: what you draw appears as code, and what
you write appears as boxes.

The Code tab and the REPL use the same code editor as code boxes (brackets that close and match,
completion of the commands). In the REPL, Enter evaluates when every bracket is closed — otherwise it
starts a new line, and ⇧+Enter always does — and ↑ ↓ bring back what you wrote before.

**Functions as boxes.** A box named after a pure function of `clojure.core` (or `clojure.string`, as
`str/…`) is that function, with no component to write: its other words are its arguments, read as EDN,
and the message that arrives goes last, as with `->>`. `%` puts it elsewhere. The text reads as Clojure,
the inlets as Max: wherever `%` is written, the message is always the **left inlet, the only hot one**;
the other arguments have an inlet each on the right, in the order they are written, which replaces them
without sending. A bang on the left sends again with the last message; a result that is `nil` sends
nothing.

| box | message | sends | inlets |
|---|---|---|---|
| `into [440]` | `[1 2]` | `[440 1 2]` | the message · `[440]` |
| `conj % 440` | `[1 2]` | `[1 2 440]` | the message · `440` |
| `vector % 0 0` | `1` | `[1 0 0]` | the message · `0` · `0` (a *pack*) |
| `hash-map :freq % :amp 0.5` | `440` | `{:freq 440 :amp 0.5}` | the message · `:freq` · `:amp` · `0.5` |
| `map inc` | `[1 2]` | `[2 3]` | the message · `inc` |
| `str/upper-case` | `"do"` | `"DO"` | the message |

Only pure functions are there (`map`, `filter`, `take`, `assoc`, `sort`, `frequencies`…), so these boxes
are safe in a shared room; a class with the same name (`+`, `print`) comes first.

**Data as functions.** As in Clojure, a keyword, a set or a map written first is a function too, and
the message goes first, `(:freq msg)`:

| box | message | sends |
|---|---|---|
| `:freq` | `{:freq 440 :amp 1}` | `440` — a field of an event |
| `:freq 220` | `{:amp 1}` | `220` — the default, which has an inlet |
| `#{60 64 67}` | `64` · `62` | `64` · nothing — a filter |
| `{60 :c 64 :e}` | `64` | `:e` — a table |

**Every inlet hot: `^:hot`.** Written before the class, as Clojure writes metadata, `^:hot` makes a new
argument send at once with the last message (`nil` before the first one), like `pak` in Max:
`^:hot vector % 0 0`.

**Over a stream: `xf/`.** `xf/` before a function makes its *transducer* a box with memory: it goes
through the messages that arrive one by one, not through a collection, and what it lets through goes out
one message at a time.

| box | does |
|---|---|
| `xf/partition-all 4` | collects 4 messages and sends them as a vector |
| `xf/partition 4 1` | the last 4 at every message (a sliding window) |
| `xf/dedupe` | lets a message through only when it changes |
| `xf/take 1` | the first message only (a bang is a message too) |
| `xf/filter odd?`, `xf/map inc`, `xf/mapcat reverse`… | as in Clojure, message by message |

`:flush` completes it (`partition-all` sends what it holds) and starts again, `:clear` starts again
without sending, and a new argument on the right starts again too. The help of each of these boxes (**?**)
links to its page at [clojuredocs.org](https://clojuredocs.org) and to the reference at
[clojure.org](https://clojure.org/reference/transducers).

**Choosing a way: `branch`.** `branch n` sends what arrives on the left by one of its n outlets, numbered
from 0 as every port is. The right inlet chooses: `msg 1` (outlet 1), `msg nil` or `msg false` (closed:
nothing goes out), `msg true` (outlet 0, so `branch 1` is a gate that opens and closes). A function chooses
for each message, and nil lets it through nowhere: a map `{60 0 64 1}`, a keyword `:to` (the way written in
the event), a name or a form (`even?`, `(comp …)`); a set lets its members through outlet 0. The selector
can be written after n: `branch 2 {60 0 64 1}`.

**Functions through the wires.** A function travels as its form, EDN data. `comp`, `partial`, `juxt`,
`complement`, `fnil`, `constantly`, `every-pred` and `some-fn` are boxes that send one on a bang:
`comp inc (partial * 2)` sends `(comp inc (partial * 2))`. Wherever a box takes an argument, a name or such
a form *is* that function, so a form sent into the inlet of `inc` in `map inc` changes the function live
(`xf/filter odd?`, `sort-by :freq` likewise). Forms can also be written in a box and nest:
`map (partial * 2)`, `map (juxt inc dec)`. With `%`, a builder takes the function that arrives:
`comp % inc`. Only these pure functions (and `+ - * /`) are ever made from a form, and each browser
rebuilds it from them, so it is as safe in a shared room as any argument; a name it does not know (or a
call such as `(inc 1)` in place of a function) is not sent and is written in the REPL. To send a function
by its name, a `msg` with the name: `msg inc` (a keyword, `msg :inc`, stays a keyword: a key, and a
function by itself).

## 3. Sound and time

- **▶** (or the space bar) starts the sound and time: audio, `metro`, `ramp`, `loadbang`, `mt play`.
  The first ▶ also asks the browser for permission to play sound.
- **■** silences and brings every box back to its initial state.
- Messages travel without ▶: a click on a `bang` or a `msg`, a number dragged, a data box that changed.
- A `msg` sends what is written in it, read as in Clojure: numbers (`msg 0 8 4`), **keywords with their
  colon** (`msg :stop`, `msg :rec 4`), **names** (`msg inc`: a function where a box takes one; also free
  text such as a note `e4`, a ratio `6/5`, a URL or an OSC address), `true`, `false`, `nil`, **text
  between quotes as a string** (`msg "https://…/voice.ogg"`, `msg "two words"`) and EDN forms
  (`msg [0 4 7]`, `msg {:freq 440}`), alone or in a list (`msg :url "github:…" 3`). A word without its
  colon is a name, not a keyword: `msg stop` does not stop a `metro`, `msg :stop` does.
- **Stochastic synthesis**: `gendy~ 110` (in `@kairotic/synth`) is an oscillator after Xenakis's GENDY:
  a wave of breakpoints whose amplitudes and durations take random walks cycle after cycle — a pitch
  that drifts, a timbre that keeps changing. `[:x-step 40]` lets the pitch wander, `[:y-step 0.2]` the
  timbre; a signal on its inlet modulates its frequency. Its help patch has four steps.
- **Faust as a patch** (Study 31, `@kairotic/faust-units`): the code of a `faust~` opens beside its box
  with its **patch** on the left, the same code as Faust's own elements — primitives (`+ * ' @ sin
  select2`…), controls (`hslider button`…), library functions (`os.osc fi.lowpass en.adsr`…), `in` and
  `out`. Double-click the paper for a new box (a name, a number, or any Faust expression, kept as a box of
  code), drag from an outlet to an inlet, Delete removes. Editing the patch rewrites the code beside it,
  editing the code redraws the patch; Ctrl/⌘+Enter or Apply applies, as always. A loop must go through the
  one-sample delay `'` (in code, `~`). Code the boxes cannot read still plays, with the patch marked out of
  date. **Patch** in the window's bar hides it. The window opens beside the box, so its parameters stay in
  sight in the patch.
- **A recipe from a sound** (Study 35): **Recipe** in the bar of a `faust~`'s window finds the values of
  its sliders that sound closest to a sound — a sample box of the patch, or a sound file. It plays the code
  offline, a note of one second (a `gate` button, if there is one, held for 0.65 s), many times: random
  settings first, then a search that listens as `features~` does, the pitch heard as `pitch~` hears it
  and held, on a slider called `pitch`, `key`, `note` or `midi` (MIDI) or `freq` (Hz). *quick* plays it
  about 200 times, *careful* about 450; **Stop** stops it. The values found are written in the code, each
  slider starting there: edited, not applied, so Ctrl/⌘+Enter applies them as one event and the box shows
  them in its parameters. **▶ sound** and **▶ found** play the second it listened to and what it found.
  It compares timbres apart from loudness; a log scale where the code says `[scale:log]` helps it.
- **Descriptors as a score: `realize~`** (Study 37, `@kairotic/analysis`): a box before a `faust~` that
  plays it from four descriptors — **loudness** (dB, or a level 0…1 as `features~` sends `rms`),
  **brightness** (the spectral centroid, Hz), **noisiness** (the spectral flatness, 0…1) and **pitch** (Hz as
  `pitch~` sends it, 0 for none; MIDI with `realize~ midi`). The `faust~`'s `pitch` or `freq` slider takes
  the pitch, its `gain` slider the loudness, and its other sliders are set to the settings of that `faust~`
  that sound nearest to the brightness and noisiness written. To know them it **learns** the `faust~` its
  left outlet reaches: when the first values arrive (or on `learn`, after changing its code) it plays a few
  hundred steady settings offline and listens to them. What comes in can be `features~` and `pitch~` of
  another sound — sing, and a synth follows your loudness, brightness, noisiness and pitch with its own
  sound — or curves drawn on canvases read by `reader~` and `snapshot~`. Its right outlet says how far the
  nearest setting is from what is written (above 1, the `faust~` cannot sound like that: noise as dark as a
  tone, say); a `monitor` shows what is written beside what `features~` hears in the result. It can
  **listen to what it plays**: a `features~ 20` on the `faust~`, its three outlets (rms, centroid, flatness)
  into the last three inlets of `realize~`, and it asks for more where what is heard falls short of what is
  written, little by little, within limits — the loudness then means the level as `features~` hears it.
- **Faust in several voices**: a `faust~` whose source declares `declare options "[nvoices:8]";` is
  polyphonic. Its voice uses `freq`, `gain` and `gate`, set note by note; Hz go to its left inlet and
  voice ids to its right one, as with `synth~` (a `keyboard` 0→0, 1→1, 3→0; `mt play` 0→0, 1→1), in any
  tuning; `effect = …;` in the same source is applied to the sum of the voices. Its help patch shows it.
- **Sound from outside**: `adc~ 1` is the microphone (or an input of the sound card: `adc~ 1 2`). At ▶
  the browser asks for it once; its sound comes as it is, without the processing made for calls.
  `scope~` draws a signal and `snapshot~ 50 db` turns it into numbers (its level), so what is heard can
  drive the patch. Use headphones before sending an `adc~` to `dac~`: it feeds back.
- **Recording**: a `sample` box records what reaches it on `rec` until `stop` (or its length:
  `sample 10`), and a `reader~` with the sample on its right plays it at the position of a `phasor~`
  — `!/ 1` turns its length (its left outlet) into the speed of the phasor~, and any other speed plays
  it faster, slower or backwards. The sound stays in this browser; the work keeps its picture, so a work
  opened elsewhere shows it and says it is not there. `(load-sound! :bN)` brings in a file,
  `(save-sound :bN)` saves it as WAV. A sound **from a URL** — `(load-sound! :bN "https://…/voice.ogg")`,
  a string sent to the sample, or `(sample! :bN {:url "…"})` in the code — is fetched by every browser that
  opens the work, so a shared session or a link has the same sounds everywhere (a URL of another site
  must allow it: CORS). Two sources always work: `github:owner/repo@ref/path.wav`, any file of a public
  GitHub repository, served by jsDelivr (for instance the banks of
  [Dirt-Samples](https://github.com/tidalcycles/Dirt-Samples): `github:tidalcycles/Dirt-Samples@master/bd/BT0A0A7.wav`),
  and `freesound:id`, a sound of [Freesound](https://freesound.org) with your own API key, kept only in
  your browser (`(freesound-key! "…")`, from freesound.org/apiv2/apply). `(sounds "rain" {:max 10})`
  searches Freesound and prints the line that loads each result; a Freesound sound keeps its author and
  licence, and `(credits)` lists them for the work.
- **Listening**: the package `@kairotic/analysis` (it comes into a work when one of its classes is
  written) turns what is heard into data: `pitch~` the pitch by YIN (Hz, and 0 when it stops hearing
  one), `onset~` a bang at each attack, `chroma~` the 12 pitch classes and the strongest one,
  `features~ rms centroid flatness …` descriptors (with Meyda), and `spectrum~` draws the spectrum.
  `monitor 6 rms centroid chroma` draws whatever arrives on its inlets over the last 6 seconds, one lane
  each: numbers as lines, lists (chroma, mfcc) as strips, bangs and words as marks.
  `form~` compares every moment with the others (a self-similarity matrix of a chroma or an mfcc, drawn): a
  bang where a section begins, the period that repeats, and a `[:segment …]` that makes `onset~` start afresh.
  `transcribe` writes what `pitch~` hears into a `freqt` — `rec`, play, `stop` — as notes at their pitch
  or, with `transcribe 60 glide`, as contours that follow the voice (an `onset~` on its right splits
  repeated notes); the freqt shown as a score is then the improvisation in notation.
- **Recording a gesture**: `record [lo hi]` writes any stream of numbers into a `canvas` as strokes over
  time — a knob, an envelope (`snapshot~ 50 rms`), a descriptor (`features~ 20 centroid`) —: `rec`,
  play, `stop`. A value holds until the next one; the axes follow the take. Edit it like any drawing and
  read it back with `phasor~` → `reader~` as an automation.
- **Recording from a point**: `rec t` (`msg :rec 4`) on a `sample`, `record` or `transcribe` keeps what
  was there before t (seconds; beats for transcribe) and records from t on, replacing what came after —
  a punch-in. `ovr t` (`msg :ovr 4`; `ovr` alone, from 0) overwrites only what the take covers, from t
  to where it stops, and keeps what came after it — a punch-in/out. A canvas or freqt takes `[:cut t]`
  for that (everything from t on) and `[:cut t1 t2]` (what is between them; a stroke across is split).

## 4. The history

Every gesture is an event of the history, at the bottom of the page.

- **Ctrl+Z** goes back, **Ctrl+Shift+Z** (or Ctrl+Y) forward; or click any point of the history.
- Doing something after going back makes a **branch**: nothing is lost.
- **Merge…** brings the events of another branch here, when they do not clash.
- In a room, the gestures of others arrive in the same history; *Follow the front* keeps you at the
  newest point.
- **◆ Snapshot** — `(snapshot)`, or `(snapshot "intro")` with a name — writes a keyframe: a point of
  the history with the work as it is now. It is drawn as a square.

### Lines

A work can have several **lines**: independent histories, each a tab above the patch. The main line
(★) is the work as it always was; the others are studies, sketches, parts — each with its own patch,
its own branches, merges and snapshots.

- **+** makes a new, empty line — `(new-line "sketch")`. Click a tab to put its line on screen —
  `(go-line "sketch")`; each tab comes back at the point where you left it.
- Double-click the tab on screen to rename it — `(rename-line "intro")`; **×** archives it (it is kept,
  with its history, and comes back from *archived* — `(restore-line "sketch")`). `(work-lines)` lists them.
- The line on screen is what the patch, Perform, Share/Export, Release and Claude work on.
- The engine plays the line where you pressed ▶ (its tab shows ▶ too): changing tabs does not stop it, and the
  transport says which line plays. The messages of the tab on screen still travel; its audio boxes stay quiet
  until you press ▶ there, which makes it the line that plays. In a room, the others' positions are drawn only on the line they are on;
  following someone onto another line opens their tab.
- Lines do not change while you perform, in a lesson or in the scratch patch.

**A line inside another.** `patch @name` uses the line called *name* as a sub-patch (spaces in its name are
written `-`: `patch @bass-line`); its `inlet` / `outlet` boxes are the box's ports. Double-click opens the line
in its tab.

- It **follows** the line (↻): it is the line at its newest point, so it changes as the line advances, for every
  box that uses it. `(pin-ref :b3)` **pins** it to the point it reads now (⌖ and that moment);
  `(follow-ref :b3)` follows again. A line cannot contain itself, nor a line that uses it.
- While you perform, the lines followed stay where they were when Perform started. A snapshot keeps where they
  are, and its point plays them so: going back in the history, a point after a snapshot hears the lines as they
  were then (at the newest point, as they are now).
- Inside a line used so, `adc~` and `dac~` are quiet: they play when the line plays alone (its own ▶), so a line
  can be tried with its own input and output. Sound goes in and out through `inlet~` / `outlet~`; the box warns
  (⚠) when its line has a `dac~` and no `outlet~`, or an `adc~` and no `inlet~`.
- Renaming a line rewrites the boxes on screen that use it; boxes elsewhere still find it by its old name.
- While the line that plays uses the line on screen (and its tab is at its newest point), the tab shows it
  where it plays, and what you play there goes to every box that uses it (the transport says ×2, ×3…).
  To play one of them alone, play the line that uses it.
- The inspector of a patch box (⌘/Ctrl+click) has what it can do with lines: an embedded patch can be
  **extracted** to a new line, with the history it had inside the box — `(extract-line :b3 "filters")`; a
  `patch @name` can be pinned, followed, opened, or **inlined** — `(inline-ref :b3)`: a copy of its line
  inside the box, detached from it.
- A link (Share/Export) or a release carries **one line**: every `patch @name` in it becomes an embedded patch
  holding its line as it plays there — at each keyframe of a release, as the snapshot kept it.

### Compose and Perform

Composing is the usual mode: every change to the work is a point of the history. **Perform** opens a
time of its own to rehearse, try and improvise with the work: what you change makes a *take* that
starts from where you are and stays out of the history (the patch has a red frame while you perform).

- Ctrl+Z / ◀ take back your last changes of the take; ▶ brings them again.
- A snapshot in Perform writes the take so far into the history, and the take goes on from there.
- Pressing **Perform** again goes back to Compose: *Keep it as a new point* writes the take as a branch
  from where it started (closed by a filled square), *Discard* goes back to where you were.
- In a room, whoever performs from the same point of the history plays the same take: a **jam**. Only
  they receive each other's changes; the others are invited to join it.
- From the REPL: `(perform)`, `(compose)`, `(compose :keep)`, `(compose :discard)`, `(jam "id")`.
  Perform and Present are independent: you can perform with the whole patch or with the panel.

### Presets: keyframes to recall, morph and generate

Every keyframe — a snapshot, or a take kept from Perform — is also a **preset** of the work: the text of
each box at that moment (its arguments, and the values controls keep there: a knob, an envelope, a
pad), sub-patches included. A `presets` box plays them:

- A number or a label into its left inlet — `2`, `intro` — **recalls** that keyframe: every box that
  is also there takes its text of then, as one event of the history (one Ctrl+Z undoes it). Boxes added
  or removed since, lines and buffers stay as they are.
- A position into its right inlet **morphs**: `1.5` puts the controls halfway between the first
  keyframe and the second. They move as messages, as a drag does (live, and played in a jam), and
  nothing is written until `keep`. A knob that drives the morph is not moved by it.
- A **bang** makes a new preset from what changes and what remains: what is the same in every keyframe
  stays; a number that changes takes a value within its range (geometric for a `log` knob, whole if it
  always was); a word that changes is one of its words. `[:generate 42]` gives the same preset every
  time; snapshot it to keep it as one more keyframe.
- Its outlet sends the values of the controls it set, `{:b3 0.5 :b5 880}`.
- Keyframes are numbered in order of moment, the same in every tab of a room. `presets intro verse`
  uses only those snapshots, in that order.
- From the REPL, with every keyframe of the work: `(keyframes)`, `(recall 2)`, `(recall "intro")`,
  `(morph 1 2 0.5)`, `(morph :keep)`, `(generate)`, `(generate 42)`. In Perform, all of it goes to
  the take, as any change does.
- The tutorial *Presets: recall, morph, generate* (Help → tutorials, or `(tutorial "presets")`) walks
  through all of it with an FM synthesizer.

### Release, and points forgotten

Keyframes live in the history, and the patch's code, a link or an embed carry only the patch. To make
presets travel, a `presets` box can **keep** them: `(store-presets! :b18)` copies into it the keyframes it
uses, only what changes between them. A box that keeps presets uses them instead of the history, and the
work's code writes them as `(presets! :b18 […])`, so they go wherever the patch goes. `(presets! :b18 nil)`
forgets them.

- **Release…** (in the history bar), or `(release)`, makes a **new work** with a compact history: one
  point per keyframe, with its label, each written as the changes from the one before, and then the work
  as it is. Every presets box keeps its presets in it. The work you released from stays as it was, with
  all its history.
- In a solo or local work you can **forget points**: ⇧+click them in the history, then **Forget…**. The
  work at those moments is lost (and a snapshot there with it), and the moments after them stay exactly as
  they are. The tip of a branch and a point where a branch starts cannot be forgotten, and in a shared room
  the history belongs to everyone, so there a release is the way to a compact version. From the REPL:
  `(forget-points [["segment" 3] …])`.

## 5. The tabs on the right

The panel on the right can make way for the patch: **»** in its header (or **›** on the bar between them)
hides it, and **‹** brings it back; asking for a tab — **?** or F1 on a box, `(docs …)`, a tutorial —
shows it too. Drag the bar between the patch and the panel to give it another width; a double-click on
the bar hides or shows it. This browser remembers how you left it. From the REPL: `(side-panel false)`,
`(side-panel true)`, `(side-panel 480)`, `(side-panel :auto)`.

- **Code** — the work as **Calls** (`box`, `connect`, …), editable: Ctrl/⌘+Enter runs them and rebuilds
  the patch. **Data** shows the same work as data (EDN): the state the history produces, every key of
  every box, read-only, to inspect it (folding and search with Ctrl/⌘+F). Edits not run yet stay in the
  calls while you look at the data.
- **Components** — the classes this work knows. The boxes that define them (`component`) are kept
  here, not in the patch, since they have no inlets nor outlets: **New component**, **Edit** (its code
  in the code window), **Publish**, ×; a click on a row chooses it for Claude to change. Import
  published ones, or use those of the shared library.
- **Claude** — Claude makes a patch (or changes the open one), or writes a component, from what you
  describe. See [Asking Claude](ask.md).
- **Help** — this **documentation** (guide, concepts, topics, reference), a page for every class,
  inlet by inlet, with a help patch (some have several steps, one use each, that ◀ ▶ travel like a
tutorial), and the **tutorials**. Select a box and press **?** (or F1) to see
  its page; `(docs "concepts")` in the REPL opens a page of the documentation.

- **Feedback** — during the alpha: report what fails, propose an idea or ask a question. It writes a
  GitHub issue for you, with the patch on screen, recent errors and your browser if you want; you
  publish it on GitHub. The open issues are listed, so you can add to one instead of writing it twice.

## 6. Music as data

A `tree` box holds music in EDN — voices, measures, notes, chords, dynamics:
`[:voice [:measure {:meter [4 4]} "c4/1 e4 g4/2"]]`. Shown as a score (⇄ in its header), or connected to a `freqt` shown as a score, it is drawn as notation;
through `mt` boxes it is transformed (`mt transpose 7`, `mt retrograde`, `mt canon 2 7`); with
`mt play` → `synth~` it sounds. Click a note in a score to edit it (↑ ↓ + − ← → a…g Delete), or a rest to make it a note again (Enter). See
[Musical trees](mt.md).

A `canvas`, a `freqt` and a score are resized by their bottom-right corner, as one event of the history
(`(resize :b3 640 300)`); a double-click on the corner brings back their size. A score takes the width
you give it and reflows its notation; its height follows the notation.

**Seeing it as geometry.** The package `@kairotic/theory` draws what sounds as music theory:
`pcclock` a pitch-class set on the clock face (its prime form, interval vector and axes of symmetry),
`fourier` its six Fourier coefficients (chromatic … diatonic, whole-tone), `tonnetz` the triads on the
Tonnetz and the path of the harmony. They take lists of pitches, notes one by one, or a chroma from
`chroma~`, and their parts can be pressed (a pitch class comes out).

**Drawing from messages.** A `draw [w h]` box draws the shapes that reach it — the same shapes as a
component's view: `[:circle {:cx 40 :cy 40 :r 10 :fill :accent}]`, `[:line …]`, `[:path …]`,
`[:curve …]`, `[:text …]`, `[:group {:x :y :rotate} […]]` — or as a msg writes them: `msg :circle 40 40 10
:accent :hit :sun`. A list replaces them all, `[:set k shape]` moves the one called k, `:clear` empties it,
and a shape with `:hit k` sends k when it is pressed.

## 7. Annotations and layers

**Annotate** (above the patch) opens a bar to write on the patch: **Draw** a line by hand, an
**Arrow**, a **Text**, **Move** a mark or **Erase** it. Moving a mark keeps the anchor of each point (a
point anchored to a box still follows it, from where you left it); dragging one end of a line or an
arrow moves only that end, and anchors it again to the box nearest where you let it go. Each point is anchored to the box nearest it — the mark follows the
box when it moves — or to the paper when no box is near; a box deleted leaves its marks where they were.
What is drawn goes to a **layer** (`notes` unless you name another), over or under the boxes, shown in the
patch view, in the presentation or in both; each mark is one event of the history and part of the code:

```clojure
(layer :notes {:z :over :show #{:patch :present}})
(mark :notes :a1 {:kind :arrow :pts [[:b1 120 10] [:b4 -6 10]]})
(mark :notes {:kind :text :at [:patch 300 40] :txt "breathe"})
(move-mark :a1 20 -10)
(unmark :a1)
```

A layer can also hold **projections**: the view of a box drawn again, at another size —
`(project :b9 :viz [40 40 800 480])` puts a `monitor`, a `spectrum~` or a `tonnetz` large behind the
presentation, drawn from what it shows (not scaled), while the box keeps its place. `(unproject :b9)`.

## 8. Presentation

**Present** shows only the boxes you put in the presentation — `(present :b4 x y)`, or ⌥+drag them in
presentation mode — as a performer's panel. **Edit** goes back.
In presentation the paper is for playing: a double-click creates no box and nothing is selected with
the mouse. A plain drag plays a box (or does nothing): to move a presented box, drag it with ⌥/Alt
held, so a freqt, a canvas or a knob is not moved by its header or its grip by mistake.

If boxes are selected when you press **Present** and some of them are not in the presentation yet, it
asks first: *Present the selection* puts them in it where they are in the patch (one event of the
history), *Present without them* leaves them out. From the REPL: `(present-in-place :b3 :b4)`.

## 9. Share and embed

- In a room, everyone is in the same work.
- **The work as a file**: the first thing in **Share/Export** (and *Download this work* in **Sessions**) saves
  the work as a `.kairotic` file — every line, its whole history and the sounds recorded — or a release of it;
  *anonymous* leaves out who made it. **Sessions → Open a file…** opens one as a new work (solo, or local
  without a database): a backup, or a way to take a work from Pages to claude.ai and back. Samples loaded from
  a URL stay references. `(export-work)`, `(export-work {:release true :anonymous true})`.
  A `.kairotic` is a zip of EDN (`manifest.edn`, `work.edn`, `lines.edn`, `history.edn`, `people.edn`) and
  `sounds/<hash>.wav` (32-bit float).
- **Share/Export** gives a link and an iframe with this patch (or this tutorial step) for Notion, a blog or a
  course; *Release/Perform* gives a release of it that opens in Perform, showing only the panel. See [Embedding](embed.md).
- A request to Claude can be shared in the
  [Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery).

## 10. Keys

| | |
|---|---|
| double-click empty space | a new box (what starts with `(` is a line of the REPL) |
| `(` on the patch | a line of the REPL, there (Enter runs it, ↑ ↓ its history, Esc closes) |
| I | show the id of every box (hovered or selected, a box always shows it) |
| click a box while a line of code waits for one | write its id there (`:b7`, `@b7` in a Room message) |
| double-click a number, knob or slider | type its value (Enter applies, Esc closes) |
| Delete / Backspace | delete the selected boxes or line |
| ⌘/Ctrl+C · X · V · D | copy · cut · paste (where the pointer is) · duplicate the selected boxes |
| ⌘/Ctrl+click | edit a box below it (its arguments and text) |
| ⇧+click · a frame · ⌘/Ctrl+A | select several boxes · all |
| Esc | deselect, or close the box editor |
| drag the corner of a canvas, freqt or score | resize it (double-click: its default size) |
| drag the bar beside the panel · » · ‹ | resize the panel on the right · hide it · show it |
| space | ▶ / ■ |
| ? or F1 | help of the selected box |
| Ctrl+Z · Ctrl+Shift+Z · Ctrl+Y | back · forward in the history (in Perform, in the take) |
| Ctrl+Enter | apply code (Code tab, code boxes, Claude tab) |
| ↑ ↓ + − ← → Delete | edit the selected note of a score, or the stroke of a canvas |
| Enter · a…g | the selected rest of a score becomes a note (a…g also re-pitches a note) |
