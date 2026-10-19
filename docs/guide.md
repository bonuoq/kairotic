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

## 2. Make a patch

- **Create a box**: double-click an empty place, write its text — the class and its arguments, such as
  `osc~ 440` — and press Enter. Classes ending in `~` are sound.
- **Connect**: drag from an outlet (the small marks under a box) to an inlet (above another box).
- **Select** a box or a line by clicking it. **⌘/Ctrl+click** a box to edit it below (its arguments,
  and its text). **Delete** removes what is selected.
- **Select several**: ⇧+click adds a box to the selection (or takes it out); a frame drawn from an
  empty place of the paper selects every box it touches (⇧ adds them); ⌘/Ctrl+A selects all. Drag one
  of them and they all move; Delete removes them all.
- **Move** a box by dragging it. Playable boxes — `bang`, `msg`, `number`, knobs — are selected by the
  grip on their left; their body is for playing.
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
and the message that arrives goes last, as with `->>`. `%` puts it elsewhere.

| box | message | sends |
|---|---|---|
| `into [440]` | `[1 2]` | `[440 1 2]` |
| `conj % 440` | `[1 2]` | `[1 2 440]` |
| `map inc` | `[1 2]` | `[2 3]` |
| `get % :freq` | `{:freq 440}` | `440` |
| `str/upper-case` | `"do"` | `"DO"` |

Each argument has an inlet on the right that replaces it without sending; a bang on the left sends again
with the last message. Only pure functions are there (`map`, `filter`, `take`, `assoc`, `sort`,
`frequencies`…), so these boxes are safe in a shared room; a class with the same name (`+`, `print`)
comes first.

## 3. Sound and time

- **▶** (or the space bar) starts the sound and time: audio, `metro`, `ramp`, `loadbang`, `mt play`.
  The first ▶ also asks the browser for permission to play sound.
- **■** silences and brings every box back to its initial state.
- Messages travel without ▶: a click on a `bang` or a `msg`, a number dragged, a data box that changed.

## 4. The history

Every gesture is an event of the history, at the bottom of the page.

- **Ctrl+Z** goes back, **Ctrl+Shift+Z** (or Ctrl+Y) forward; or click any point of the history.
- Doing something after going back makes a **branch**: nothing is lost.
- **Merge…** brings the events of another branch here, when they do not clash.
- In a room, the gestures of others arrive in the same history; *Follow the front* keeps you at the
  newest point.
- **◆ Snapshot** — `(snapshot)`, or `(snapshot "intro")` with a name — writes a keyframe: a point of
  the history with the work as it is now. It is drawn as a square.

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

## 5. The tabs on the right

- **Code** — the work as **Calls** (`box`, `connect`, …), editable: Ctrl/⌘+Enter runs them and rebuilds
  the patch. **Data** shows the same work as data (EDN): the state the history produces, every key of
  every box, read-only, to inspect it (folding and search with Ctrl/⌘+F). Edits not run yet stay in the
  calls while you look at the data.
- **Components** — the classes this work knows; write your own, import published ones.
- **Claude** — Claude makes a patch (or changes the open one), or writes a component, from what you
  describe. See [Asking Claude](ask.md).
- **Help** — this **documentation** (guide, concepts, topics, reference), a page for every class,
  inlet by inlet, with a help patch, and the **tutorials**. Select a box and press **?** (or F1) to see
  its page; `(docs "concepts")` in the REPL opens a page of the documentation.

- **Feedback** — during the alpha: report what fails, propose an idea or ask a question. It writes a
  GitHub issue for you, with the patch on screen, recent errors and your browser if you want; you
  publish it on GitHub. The open issues are listed, so you can add to one instead of writing it twice.

## 6. Music as data

A `tree` box holds music in EDN — voices, measures, notes, chords, dynamics:
`[:voice [:measure {:meter [4 4]} "c4/1 e4 g4/2"]]`. Shown as a score (⇄ in its header), or connected to a `freqt` shown as a score, it is drawn as notation;
through `mt` boxes it is transformed (`mt transpose 7`, `mt retrograde`, `mt canon 2 7`); with
`mt play` → `synth~` it sounds. Click a note in a score to edit it (↑ ↓ + − ← → Delete). See
[Musical trees](mt.md).

## 7. Presentation

**Present** shows only the boxes you put in the presentation — `(present :b4 x y)`, or drag them in
presentation mode — as a performer's panel. **Edit** goes back.

If boxes are selected when you press **Present** and some of them are not in the presentation yet, it
asks first: *Present the selection* puts them in it where they are in the patch (one event of the
history), *Present without them* leaves them out. From the REPL: `(present-in-place :b3 :b4)`.

## 8. Share and embed

- In a room, everyone is in the same work.
- **Embed** gives a link and an iframe with this patch (or this tutorial step) for Notion, a blog or a
  course; *Presentation, fullscreen* shows only the panel. See [Embedding](embed.md).
- A request to Claude can be shared in the
  [Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery).

## 9. Keys

| | |
|---|---|
| double-click empty space | a new box |
| double-click a number, knob or slider | type its value (Enter applies, Esc closes) |
| Delete / Backspace | delete the selected boxes or line |
| ⌘/Ctrl+click | edit a box below it (its arguments and text) |
| ⇧+click · a frame · ⌘/Ctrl+A | select several boxes · all |
| Esc | deselect, or close the box editor |
| space | ▶ / ■ |
| ? or F1 | help of the selected box |
| Ctrl+Z · Ctrl+Shift+Z · Ctrl+Y | back · forward in the history (in Perform, in the take) |
| Ctrl+Enter | apply code (Code tab, code boxes, Claude tab) |
| ↑ ↓ + − ← → Delete | edit the selected note of a score, or the stroke of a canvas |
