# Writing a component

*[Leer en castellano](writing-a-component.es.md)*

Every box in a Kairotic patch is an instance of a **component**: a map of data and functions,
written in ClojureScript. You can write one inside a work (a `component` box), share it in the
library of a space, or publish it on npm. This guide builds a small one step by step and then
reads the `knob`, the first component with its own view.

## 1. The smallest component

Create a `component` box, double-click its code and write:

```clojure
{:class "twice"
 :doc "Doubles every number it receives."
 :io [1 1]
 :receive (fn [{:keys [value]}]
            (if (number? value) {:out [[0 (* 2 value)]]} {}))}
```

Apply it (Ctrl/⌘+Enter). The box shows `✓ defines «twice»`, and now you can create boxes
called `twice`.

- `:class` is the first word of the box text.
- `:io [inlets outlets]`.
- `:receive` is a **pure function**: it gets a message and returns what should happen.

## 2. Messages

`:receive` gets a map:

| key | what it is |
|---|---|
| `:inlet` | the inlet the message arrived at (0 is the left one) |
| `:value` | the message: a number, a list, a keyword such as `:bang` |
| `:state` | what the box kept last time (nil at first) |
| `:args` | the arguments written in the box text |
| `:at` | the time of the message on the audio clock |

…and returns a map with any of:

| key | what it does |
|---|---|
| `:out [[outlet value] …]` | sends values out, in this order |
| `:state x` | keeps `x` for the next message |
| `:later [[at inlet value] …]` | schedules messages to itself in the future |
| `:effects [[k x] …]` | effects on its audio node, or `[:print x]` |
| `:show v` | what the box shows (a number box displays it; an own view draws it) |

## 3. Declared arguments

Write the arguments as a section instead of parsing the text yourself:

```clojure
 :args [[:factor 2]]
```

Now `twice 3` gives `(:args m)` = `{:factor 3}`, and `twice` alone gives `{:factor 2}`. The kind of
the default decides how the words of the box fill each argument:

- a **number**, or the key of an earlier argument (`[:initial :min]`), takes the next number;
- `true` / `false` is a **flag**, on when its own name is written (`[:log false]` ↔ `knob 20 20000 log`);
- anything else (`nil`, a string) takes the next free **word**, as a keyword (`[:name nil]` ↔ `knob 0 1 cutoff`).

## 4. A view of its own

A component can be drawn in the patch and respond to dragging. The view is **data**: a list of
shapes in box coordinates, not HTML. The values that change are **holes**, keywords that start with
`$`, and `:derive` gives their values:

```clojure
 :size [72 78]
 :derive (fn [{:keys [shown args]}] {:angle … :label …})
 :view [[:arc  {:cx 36 :cy 33 :r 23 :from -135 :to :$angle :stroke :accent :weight 5}]
        [:text {:x 36 :y 72 :anchor :middle} :$label]]
```

Shapes: `:rect` `:circle` `:line` `:arc` `:needle` `:path` `:text`. Colours come from a palette
that follows the light or dark theme: `:ink` `:soft` `:accent` `:kairos` `:bg` `:grid`, in
`:stroke` and `:fill`; `:weight` is the line width. Holes can also name an argument (`:$min`) or
`:shown`, `:w`, `:h`.

`:shown` is the last thing the box returned as `:show`. `:gesture` turns a drag into a value:

```clojure
 :gesture (fn [{:keys [start dy fine]}] …)   ; start = what was shown on press, dy since the press
```

The value goes to the box's own inlet 0 while you drag, and when you let go it is written in the
history as `(send! :bN value)`.

For views that are hard to express as a template there is an escape hatch, `:draw (fn [m] shapes)`.

## 5. Sections

Put the sections in this order, with a comment line before each one:

```clojure
;; knob · a rotary control with its own view in the patch
{;; ── about ──
 :class "knob" :license "MPL-2.0" :doc "…" :usage "knob [min max initial] [log] [name]"
 :io [1 1] :size [72 78]

 ;; ── arguments ──
 :args [[:min 0] [:max 1] [:initial :min] [:log false] [:name nil]]

 ;; ── logic ──
 :receive (fn [m] …)
 :gesture (fn [m] …)
 :derive  (fn [m] …)

 ;; ── view ──
 :view [[:arc …] [:circle …] [:needle …] [:text … :$label]]}
```

Only the logic is code; the rest is data that can be read, checked and changed without running
anything. Read the whole [knob](../components/src/knob.cljs).

Helpers available in the logic come from the **Kairotic API**, `api/…` (from Study 14; before it the
same functions were `comp/…`): `api/clamp`, `api/nice` (sensible rounding), `api/num-of`,
`api/to-unit` and `api/from-unit` (a value ⇄ 0…1, linear or logarithmic), `api/padded` (the numbers
of a box text with defaults), and for audio `api/stereo-outlets`, `api/worklet-node` (an
AudioWorklet whose JavaScript travels inside the component) and `api/param`. The API has a version
(`api/version`): a package declares the one it was written for, and the core only breaks it with a
new major version. See [`core/kairotic/api.cljs`](../core/kairotic/api.cljs).

## 5½. The same value twice

A box can receive the same value again: data boxes (a `tree`) send what they hold again after ■, when
a line toward the box is new or a box before it changed, and when someone else's gesture reaches it in
a room. Receiving it again must change **nothing that is going on**: a player does not start over, an
accumulator does not count it twice, a learner does not learn it twice. Compare the value with what
`:state` already keeps and, if it is the same, return the state as it is:

```clojure
(cond (= value (:last state)) {:state state}          ; the same again: nothing changes
      …)
```

## 6. A component made of a patch

Not every class needs code. A **sub-patch** is a `patch` box: double-click it to open it (or
`(enter :b5)`, and `(up)` to come back). Inside, `inlet` / `outlet` (messages) and `inlet~` /
`outlet~` (audio) boxes are its ports, numbered from left to right. In code it reads:

```clojure
(box :b5 "patch voice" 40 360)
(inside :b5
  (box :b1 "inlet" 20 20)
  (box :b2 "synth~" 20 80)
  (box :b3 "outlet~" 20 140)
  (connect :b1 0 :b2 0)
  (connect :b2 0 :b3 0))
```

`(abstract :b5 "voice")` turns it into a class: a `component` box with a `:patch` instead of
`:receive`, and `:b5` becomes an instance. In the texts inside, `$1 $2 …` take the words written
after the class name:

```clojure
{:class "detune"
 :doc "Multiplies every frequency by a ratio ($1)."
 :usage "detune ratio"
 :patch {:boxes {:b1 {:text "inlet" :x 20 :y 20}
                 :b2 {:text "* $1" :x 20 :y 70}
                 :b3 {:text "outlet" :x 20 :y 120}}
         :lines [[:b1 0 :b2 0] [:b2 0 :b3 0]]}}
```

`detune 1.5` is then a fifth above. The engine replaces every sub-patch by its boxes (`:b5.b2`…),
so they cost nothing at run time.

### Seen from outside: panels

Mark boxes inside a sub-patch with `(present :b4 x y)` (or just `(present :b4)`) and the sub-patch is
drawn from outside as a **panel** of them, like a bpatcher in Max: its knobs can be played without
opening it. This also works for abstractions, since `:present` travels inside `:patch`. In the work
itself, the presented boxes make up the **presentation**: press *Present* (or `(presentation true)`)
to see only them, where the performer needs them. Moving a box there changes its presentation place,
not its place in the patch.

## 6½. Asking Claude to write it

From Study 15, the **Claude** tab (or `(ask-component "…")` in the REPL) writes a component from a
description. Claude reads this same contract, the API and real components as examples, and before it
answers it tries what it wrote with the page's tools: it evaluates and validates it, sends it
messages and draws its view. The result is an ordinary `component` box, with a header saying it was
written with Claude and what was asked; edit it like any other. With a component box selected,
"change the selected component" asks for a change to it instead. It runs on the Claude account of
whoever uses the page, who is asked for permission the first time.

From Study 16 it can also write Faust (it compiles it to check it), abstractions with `faust~` boxes
and knobs, and bpatchers (abstractions whose presented boxes make the panel of every instance), and a
package when it needs several definitions together. It reads examples from the
[catalog](../examples/README.md), which is how we teach it new kinds of components.

## 6¾. Its help

Since Study 18 the Help tab (or **?** on a selected box) shows what a class does port by port, with a
help patch that opens as a lesson. A component brings its own with `:help`:

```clojure
:help {:inlets  ["a number: the frequency in Hz" "the depth, 0…1"]   ; one line per inlet, from 0
       :outlets ["the signal"]
       :messages [["bang" "starts again"]]
       :example "(box :b1 \"wobble~ 4\" 40 30)\n(box :b2 \"dac~\" 40 90)\n(connect :b1 0 :b2 0)"
       :try "Press ▶ and change the rate."
       :see ["osc~" "gain~"]}
```

The example is patch code, one gesture per line: opening the help patch makes them one by one.

## 7. Sharing it

- **In the work:** the `component` box travels with the work and its history.
- **In the library of the space:** `(publish :bN)` and, in another work, `(use! "class")`.
- **On npm:** add `src/<name>.cljs` to [`components/`](../components/README.md) and publish a
  version; anyone can then `(import! "npm:kairotic-components@x.y.z/dist/<name>.mjs")`.
- **In an official package** (Study 14): add it to `packages/<category>/src/` (see
  [`packages/`](../packages/README.md)). A package travels as one `component` box, and writing one of
  its classes in a work brings it in.

Importing always **copies** the definition into a `component` box of the work, with a header that
says where it came from and under which licence: the work stays complete and sounds the same even
if the package changes later.

All the old and new names are in the [glossary](glossary.md).
