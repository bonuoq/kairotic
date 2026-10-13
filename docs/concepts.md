# Concepts

*[Leer en castellano](concepts.es.md)* · [Documentation](README.md)

## A work is data

A work is a **patch**: boxes and the lines between them, written as data (EDN).

```clojure
{:boxes {:b1 {:text "osc~ 440" :x 40 :y 40}
         :b2 {:text "dac~ 1 2" :x 40 :y 100}}
 :lines [[:b1 0 :b2 0]]}            ; from :b1 outlet 0 to :b2 inlet 0
```

A box's **text** is its class (the first word) and its arguments. Some boxes also keep **data** —
the strokes of a canvas, the source of a code box, the tree of a `tree` box — and a place in the
**presentation**. Ports are numbered from 0, left to right.

The patch and its **code** are the same work: every gesture is a call (`box`, `connect`, `move`,
`text!`, `stroke`, `tree!`…), and the Code tab writes the whole work as those calls. Drawing writes
code; writing code draws.

## The history is a tree

Every gesture is an **event**. Events form a **history**, a tree: going back and doing something else
makes a branch; two gestures at the same time (within the *simultaneity*, 1.5 s by default) make two
branches. Nothing is overwritten.

- The **front** is the newest point; in a room, *Follow the front* keeps you there.
- **Merging** brings the events of another branch to where you are. Events that touch the same thing
  differently clash and are left out (for a tree box, only edits of the same node clash).
- Authorship is per **session** (a browser tab), so two tabs of the same person are told apart.

## Boxes are components

Every class is a **component**: a map of data and functions with one contract —
`:receive` (messages in, results out, pure), `:state`, `:show` (what the box shows), `:later` (things
scheduled in time), `:audio` (Web Audio nodes), a `:view` made of shapes, `:help`.

Classes come from four places: the **core**; official **packages** (`@kairotic/synth` with `adsr~` and
`synth~`, `@kairotic/spatial` with `pan~` and `space~`, the single `knob`, `fifth`, `drift`), which come
into the work by themselves when a box uses them; **component boxes** that define a class inside the
work; and components **imported** from npm. A `patch` box holds a sub-patch, and a class can be a
patch (an **abstraction**, with `$1 $2` for its arguments and a panel of presented boxes). See
[Writing a component](writing-a-component.md).

## Messages and signals

Two things travel along lines:

- **Messages** — numbers, keywords (`:bang`), strings, vectors, maps, musical trees — delivered at once,
  with or without ▶.
- **Signals** — audio, between `~` boxes, once ▶ has started the sound.

▶ starts sound and **time**: everything a box asks for *later* (`metro`, `ramp`, `mt play`) waits in a
queue on the audio clock. ■ silences and brings boxes back to their initial state.

Two rules keep the flow sane: a message that comes back to the same box 100 times in one instant is a
**loop without time**, and it is cut (and said in the REPL); and **the same value twice changes
nothing** that is going on — a player does not start over. See [Data that flows](flow.md).

## Data boxes and views

- A **canvas** is a buffer of strokes in two dimensions; a **freqt** is frequency over time (Hz on a log
  scale, tunings, bar grids). A **reader** (messages) or **reader~** (audio rate, with a `phasor~`)
  reads them; how it moves gives the time. The representation does not decide the reading.
- A **tree** box holds a **musical tree** and sends it whenever it changes — or when the patch after
  it changes, only toward what needs it. A **score** draws it as notation and sends back the edits made
  on it; `mt` boxes transform it; `mt play` plays it. See [Musical trees](mt.md).

## Code inside the work

- `faust~` — Faust compiled in the browser, played as an AudioWorklet; its parameters take messages
  `[:name value]`, what a named knob sends.
- `script` — a ClojureScript function with the same contract as any component.
- `component` — the definition of a class.

Code written by someone else runs only when you allow it: in a **shared room**, and in a **link**,
scripts and components wait for *Run them* / `(trust-scripts true)`. Official definitions, exactly as
the page brings them, run without asking.

## Where works live

- **Inside claude.ai** (the Kairotic artifact): works, rooms and Claude come from claude.ai and your
  account.
- **On Kairotic Pages**: works and rooms in [GUN](https://gun.eco), synced through a relay; solo works
  are encrypted in your browser; Claude with your own Anthropic API key, kept only in your browser.
  See [Kairotic Pages](pages.md).
- **Locally**: nothing is saved.

## Claude in the work

The Claude tab makes a **patch** from a description, or changes the open one, or writes a
**component**. Claude checks what it makes with the page's own tools (classes, ports, Faust compiled,
components evaluated) before it arrives, as one event of the history. It uses your own Claude account
or key; every request is kept in your browser, and you can share it in the Gallery. See
[Asking Claude](ask.md).

## Links carry data

A link can carry a patch (`?code=`, `?src=`), a tutorial step, a help patch or a description for
Claude (`?ask=`) — never a key. Patch code in a link is read as data: only the calls a patch is made of,
with literal arguments, go through. See [Embedding](embed.md).
