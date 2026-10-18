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
| `:measure {:meter [3 4]}` | one after another; a measure without `:meter` keeps the previous one; `:groups [2 3]` or `"5/8[2+3]"` groups its units |
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

## Proportional rhythm (`:rtm`)

A rhythm can be written as **shares** instead of durations, as in the rhythm trees (RTM) of OpenMusic
and PWGL. The idea for Kairotic comes from [Rastrum](https://github.com/smoge/Rastrum) ([discussion
#17](https://github.com/bonuoq/kairotic/discussions/17)):

```clojure
[:measure {:meter [4 4]}
 [:rtm {:shares [1 [1 [1 1 1]] -1 2] :pitches "c4 d4 e4 f4 g4"}]]
```

- A number is a share; a negative number is a silence; `[weight [shares …]]` divides a share further.
- Shares are relative: `[2 2 2]` is the same rhythm as `[1 1 1]`.
- The `:rtm` lasts its `:dur` (in beats) or, without it, **fills its measure** (the meter in force,
  also when the measure inherits it). Outside a measure and without `:dur`, it lasts 4 beats.
- **Note values and tuplets are not written: they follow from the shares and the meter.** When the
  equal unit of a level is a written value (a beat, half a beat, two beats…) the notes take it as it
  is; when it is not, that level becomes a tuplet of the smallest written value that is not shorter.
  Three shares of a 3/4 bar are quarters; three of a 4/4 bar, a 3:2 of halves; five in a beat, a 5:4
  of sixteenths. The example above is a 5:4 of quarters with a triplet of eighths inside.
- `:pitches` (a melody string, or a list of pitches) go to the notes in order and **start again when
  they run out**, so rhythm and pitches can have different lengths (*talea* and *color*); `r` there
  makes that note a rest. Without `:pitches`, every note takes `:pitch` (`"c4"` by default).
- `:shares` can also be RTM text, `"(1 (1 (1 1 1)) -1 2)"`, or an EDN list.

Rhythm and pitches stay apart, so a cell can be rotated or moved to another meter without touching
its pitches. The functions `mt/cell-retrograde`, `mt/cell-rotate`, `mt/cell-at` and
`mt/cell-replace-at` change the shares themselves; `cell-replace-at` divides a share into a cell, so
a cell can grow inside itself:

```clojure
(def seed [2 [2 [1 1 1]] 3])
(mt/cell-replace-at seed [1] seed)   ; [2 [2 [2 [2 [1 1 1]] 3]] 3]
```

The notes of an `:rtm` are not edited one by one from a score: edit its `:shares` or `:pitches`.


## Meters, groups and metric weight

A measure can say how its units group: `{:meter [5 8] :groups [2 3]}`, or written as it reads,
`{:meter "5/8[2+3]"}` (also `"7/8[2+2+3]"`, `"3/4"`). A measure without a meter keeps the previous
meter and its groups; a new meter without groups has none. The groups must add up to the meter.

The score writes a grouped meter as its groups (2+3 over 8) and **beams** eighths and shorter notes
by group, or, without groups, by beat: quarters in 2/4, 3/4 and 4/4, dotted quarters in 6/8, 9/8 and
12/8, the whole bar in 3/8. A tuplet beams its own notes. Rests break beams.

**Metric weight** (after [Rastrum](https://github.com/smoge/Rastrum) and Clarence Barlow) is
composition data, not notation:

| function | |
|---|---|
| `(mt/meter-level meter beat)` | 0 at the bar, 1 at a group, deeper for each division: `[4 4]` in eighths → 0 3 2 3 1 3 2 3 |
| `(mt/indispensability meter [pulse])` | Barlow's ranking of every pulse (the highest, the downbeat): `[3 4]` in eighths → 5 0 3 1 4 2, `[6 8]` → 5 0 2 4 1 3 |
| `(mt/indispensability-at meter beat [pulse])` · `(mt/pulses meter [pulse])` | one position · where the pulses are, in beats |
| `(mt/thin amount tree)` · box `mt thin 0.5` | keeps, in every measure, the notes on its strongest positions (a share of them, or how many) and turns the others into rests |

3/4 and 6/8 hold the same six eighths and rank them differently, which is Barlow's argument: `mt thin 2`
keeps the first and fifth eighths of a 3/4 bar, and the first and fourth of a 6/8 one. A meter can be
given as `[p q]`, as text `"5/8[2+3]"` or as a measure. For a grouped meter Kairotic ranks by metric
level, then by Barlow inside each group, then the earlier group.

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
| `mt transpose 7` · `mt invert c4` · `mt retrograde` · `mt augment 2` · `mt rotate 1` · `mt canon 4 7` · `mt thin 0.5` | transformations (the right inlet changes the amount) |
| `mt seq` · `mt par` | joins the left tree with the right one, one after the other or at once |
| `mt events` · `mt pitches` · `mt duration` | the tree as plain data |
| `mt play [loop]` | plays the last tree on a bang: Hz (0) and voice ids (1) for `synth~`, parameters `[name value]` (2), dynamics and texts (3) |
| `score` · `freqt` · `canvas` | a tree on their inlet is **shown live** over their buffer; `(keep! :bN)` writes it into the buffer as one event of the history |

A score shows a tree written in `:measure`s as measured notation (tuplets, chords, rests, dynamics,
articulations, texts, changes of meter). Without measures it shows an approximation on a sixteenth grid.

## REPL and components

The functions are in `mt/`: `mt/transpose`, `mt/invert`, `mt/retrograde`, `mt/augment`, `mt/rotate`,
`mt/canon`, `mt/expand`, `mt/events`, `mt/notes`, `mt/pitches`, `mt/duration`, `mt/problems`,
`mt/pp`, `mt/->mei`, `mt/->strokes`, `mt/<-strokes`, `mt/schedule`, and for proportional rhythm
`mt/cell-retrograde`, `mt/cell-rotate`, `mt/cell-at`, `mt/cell-replace-at`, and for meters `mt/meter-of`,
`mt/meter-level`, `mt/indispensability`, `mt/indispensability-at`, `mt/pulses`, `mt/thin`. At the REPL:

- `(tree! :b2 [:voice …])` writes a tree into a tree box;
- `(as-tree :bN)` reads a tree box, or the tree a score is showing, or a freqt's strokes, as a tree;
- `(keep! :bN)` and `(unlive! :bN)`.

A component can send trees from its `:receive` and use `mt/…`. See the example `examples/claude/notation/walk.cljs`.

## History

A tree lives in the work as the text of a `tree` box, so each edit is one event, with its diff, in
the branching history. A score that is showing a tree has not changed: its buffer only changes with
`keep!`. Next steps: a tree that is the whole work, with sections whose edits are diffs of the tree
itself (node by node), and scores that edit the tree directly.
