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
- **Select** a box or a line by clicking it; a selected box is edited below it (its arguments, and
  its text). **Delete** removes what is selected.
- **Move** a box by dragging it. Playable boxes — `bang`, `msg`, `number`, knobs — are selected by the
  grip on their left; their body is for playing.
- **Edit a box's text**: double-click it. Code boxes (`faust~`, `script`, `component`, `tree`):
  double-click the code, and Ctrl+Enter applies it.

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

## 5. The tabs on the right

- **Code** — the work as calls (`box`, `connect`, …), editable.
- **EDN** — the work as data.
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
`[:voice [:measure {:meter [4 4]} "c4/1 e4 g4/2"]]`. Connected to a `score`, it is drawn as notation;
through `mt` boxes it is transformed (`mt transpose 7`, `mt retrograde`, `mt canon 2 7`); with
`mt play` → `synth~` it sounds. Click a note in a score to edit it (↑ ↓ + − ← → Delete). See
[Musical trees](mt.md).

## 7. Presentation

**Present** shows only the boxes you put in the presentation — `(present :b4 x y)`, or drag them in
presentation mode — as a performer's panel. **Edit** goes back.

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
| Delete / Backspace | delete the selected box or line |
| space | ▶ / ■ |
| ? or F1 | help of the selected box |
| Ctrl+Z · Ctrl+Shift+Z · Ctrl+Y | back · forward in the history |
| Ctrl+Enter | apply code (Code tab, code boxes, Claude tab) |
| ↑ ↓ + − ← → Delete | edit the selected note of a score, or the stroke of a canvas |
