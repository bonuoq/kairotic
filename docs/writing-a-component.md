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

Helpers available in the logic: `comp/clamp`, `comp/nice` (sensible rounding), `comp/to-unit` and
`comp/from-unit` (a value ⇄ 0…1, linear or logarithmic).

## 6. Sharing it

- **In the work:** the `component` box travels with the work and its history.
- **In the library of the space:** `(publish :bN)` and, in another work, `(use! "class")`.
- **On npm:** add `src/<name>.cljs` to [`components/`](../components/README.md) and publish a
  version; anyone can then `(import! "npm:kairotic-components@x.y.z/dist/<name>.mjs")`.

Importing always **copies** the definition into a `component` box of the work, with a header that
says where it came from and under which licence: the work stays complete and sounds the same even
if the package changes later.

All the old and new names are in the [glossary](glossary.md).
