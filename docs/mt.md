# Musical trees (kairotic.mt)

*[Versión en español](mt.es.md)*

Since Study 19, music in Kairotic can be written as **data**: a tree in EDN, in the *hiccup* style
`[:tag {attributes} & children]`. It is the common language of notation, composition and CAC: boxes
and components take trees and return trees, and a `score`, a `freqt` or a `canvas` can show one.
The idea comes from the *llll* of [bach](https://www.bachproject.net) for Max: lists that nest freely.
The difference is that here attributes have names, so any extra data (bach's *slots*) is one more key.

```clojure
[:piece {:tempo 72 :defs {:cell "e5/.5 d5 c5"}}
 [:voice {:name "flute"}
  [:measure {:meter [3 4]}
   [:note {:pitch "e5" :dur 1 :dyn "p" :art [:tenuto]}]
   [:tuplet {:ratio [3 2]} "d5/.5 c5 b4"]                ; a triplet of eighths
   [:chord {:dur 1} [:note {:pitch "g4"}] [:note {:pitch 64.5}]]]   ; 64.5 = E a quarter tone up
  [:measure
   [:note {:pitch "a4" :dur 3 :gliss [[0 0] [1 -150]]}]]            ; a glissando in cents
  [:measure [:use {:ref :cell :transpose -12}] [:rest {:dur 1.5}]]]
 [:voice {:name "electronics"}
  [:par
   [:param {:name :cutoff :value 300 :to 3000 :dur 6}]              ; a ramp of a synth parameter
   [:text {:text "slowly opening"}]
   [:seq "c3/2 r/1 g2/3"]]]]
```

## Time

Time is in **beats** (a quarter note = 1). `:tempo` (beats per minute, 60 by default) turns it into
seconds when the tree is played.

| tag | children are… |
|---|---|
| `:seq` `:voice` `:section` | one after another |
| `:measure {:meter [3 4]}` | one after another; a measure without `:meter` keeps the previous one |
| `:tuplet {:ratio [3 2]}` | one after another, 3 in the time of 2 |
| `:par` `:piece` | at the same time |
| `:chord {:dur 1}` | notes at the same time, lasting the chord's duration |

Any node can carry `:at`: an offset from the start of its parent that does not move its cursor
(a voice entering later, a parameter change in the middle of a note). A note or rest without
`:dur` lasts as long as the previous one in its container (1 at first).

## Leaves

| tag | attributes |
|---|---|
| `:note` | `:pitch` (`"c4"`, `"f#3"`, `"bb2"`, or a MIDI number with decimals for microtones) or `:hz`; `:dur`; and optionally `:dyn "mf"`, `:art [:staccato :accent :tenuto :marcato]`, `:text`, `:gliss [[x cents] …]`, `:env [[x level] …]`, `:vel`, or any key of your own |
| `:rest` | `:dur` |
| `:param` | `:name`, `:value`, and for a ramp `:to` and `:dur`: a parameter change coordinated with the score |
| `:dyn` | `:mark "mf"`; `"<"` or `">"` with `:dur` is a hairpin |
| `:text` | `:text "dolce"` |
| `:use` | `:ref` (a key of `:defs`) and optionally `:transpose`, `:invert`, `:retrograde`, `:augment` |

The curves (`:gliss`, `:env`) go from 0 to 1 over the duration of the note, the same way a stroke
of a freqt is drawn.

**Strings** are a shorthand for notes in any container: `"c4/1 e4/.5 r/1 c4+e4+g4/2 f4"` (pitch/duration;
`r` is a rest, `+` makes a chord, a token without a duration keeps the previous one).

**Fragments**: `:defs` (a map in the attributes of any container) defines fragments, and
`[:use {:ref :cell :transpose 5}]` writes them, varied. A section of a larger work can be a `:section`,
placed with `:at` in a `:piece`.

## The work, its history and its score (Study 20)

**A work as a tree.** In a `:piece` (and in a `:section`), voices and `:par` sound together from its
start, and everything else — sections in a piece, measures in a section — follows in order:

```clojure
[:piece {:tempo 80}
 [:section {:name "A"} [:voice {:name "fl"} [:measure {:meter [3 4]} "e5/1 d5 c5"]] [:voice {:name "vc"} [:measure "c3/3"]]]
 [:section {:name "B"} [:voice {:name "fl"} [:measure "c5/3"]] [:voice {:name "vc"} [:measure "g2/3"]]]]
```

The score keeps one staff per voice name across sections, writes each section's name over its first
bar and a double bar between sections.

**A history of nodes.** The data of a `tree` box is the tree itself, and each event of its history is a
list of edits of nodes, addressed by **path** (the child indices from the root; attributes are not
counted):

| edit | |
|---|---|
| `[:set path x]` | replaces the node (or melody string) at path |
| `[:attrs path {…}]` | replaces its attributes |
| `[:insert path x]` | inserts x so that it ends up at path |
| `[:remove path]` | removes it |

`(tree-edit! :b2 [:set [1 0 0 0] "e5/.5 f5 g5"])` writes edits as they are; `(tree! :b2 tree)` and editing
the text of the box write the difference with what it had (`mt/diff`). Two branches can be merged when
they change different nodes; if one changed a node and the other that node or something inside it,
the merge says which.

**Editing from the score.** A score that shows a tree coming from a tree box knows where each note is
written. Click a note, then ↑ ↓ (pitch, ⇧ an octave), + − (duration), ← → (previous, next), Delete (a
rest), Esc. Each change is one `(tree-edit! …)`; a note written in a melody string is first written out
as notes, in the same event. Notes that come from `:defs` are edited in their definition.

A measure that does not add up is a warning (⚠ in the REPL and on the box), not an error, while you
write.

## Boxes

| box | |
|---|---|
| `tree` | holds a tree as EDN text (double-click to edit). A bang sends it. Reading EDN evaluates nothing, so a tree box is safe in a shared room |
| `mt transpose 7` · `mt invert c4` · `mt retrograde` · `mt augment 2` · `mt rotate 1` · `mt canon 4 7` | transformations (the right inlet changes the amount) |
| `mt seq` · `mt par` | joins the left tree with the right one, one after the other or at once |
| `mt events` · `mt pitches` · `mt duration` | the tree as plain data |
| `mt play [loop]` | plays the last tree on a bang: Hz (0) and voice ids (1) for `synth~`, parameters `[name value]` (2), dynamics and texts (3) |
| `score` · `freqt` · `canvas` | a tree on their inlet is **shown live** over their buffer; `(keep! :bN)` writes it into the buffer as one event of the history |

A score shows a tree written in `:measure`s as measured notation (tuplets, chords, rests, dynamics,
articulations, texts, changes of meter). Without measures it shows an approximation on a sixteenth grid.

## REPL and components

The functions are in `mt/`: `mt/transpose`, `mt/invert`, `mt/retrograde`, `mt/augment`, `mt/rotate`,
`mt/canon`, `mt/expand`, `mt/events`, `mt/notes`, `mt/pitches`, `mt/duration`, `mt/problems`,
`mt/pp`, `mt/->mei`, `mt/->strokes`, `mt/<-strokes`, `mt/schedule`. At the REPL:

- `(tree! :b2 [:voice …])` writes a tree into a tree box;
- `(as-tree :bN)` reads a tree box, or the tree a score is showing, or a freqt's strokes, as a tree;
- `(keep! :bN)` and `(unlive! :bN)`.

A component can send trees from its `:receive` and use `mt/…`. See the example `examples/claude/notation/walk.cljs`.

## History

A tree lives in the work as the text of a `tree` box, so each edit is one event, with its diff, in
the branching history. A score that is showing a tree has not changed: its buffer only changes with
`keep!`. Next steps: a tree that is the whole work, with sections whose edits are diffs of the tree
itself (node by node), and scores that edit the tree directly.
