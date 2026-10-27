# Musical trees (kairotic.mt)

*[Versión en español](mt.es.md)*

Music in Kairotic can be written as **data**: a tree in EDN, in the *hiccup* style
`[:tag {attributes} & children]`. It is the common language of notation, composition and CAC: boxes
and components take trees and return trees, and a `freqt` (as a canvas or as a score) or a `canvas` can show one.
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
| `:note` | `:pitch` (`"c4"`, `"f#3"`, `"bb2"`, `"f##3"`, `"ebb2"`, or a MIDI number with decimals for microtones; a name may carry `:cents`, its deviation) or `:hz`; `:dur`; and optionally `:dyn "mf"`, `:art [:staccato :accent :tenuto :marcato]`, `:text`, `:gliss [[x cents] …]`, `:env [[x level] …]`, `:vel`, or any key of your own |
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

## The work, its history and its score

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

**Editing from the score.** A tree box shown as a score (⇄ in its header), or a `freqt` shown as a score that receives a tree from a tree box, knows where each note is
written. Click a note, then ↑ ↓ (pitch, ⇧ an octave), a…g (the nearest note of that name), + − (duration),
← → (previous, next), Delete (a rest), Esc. A rest can be clicked too: Enter makes it a note again (the
pitch of the note before it), ↑ ↓ a step above or below that one, a…g that note. Each change is one `(tree-edit! …)`; a note written in a melody string is first written out
as notes, in the same event. Notes that come from `:defs` are edited in their definition.

A measure that does not add up is a warning (⚠ in the REPL and on the box), not an error, while you
write.

## Boxes

| box | |
|---|---|
| `tree` | holds a tree, seen as **code**, as a **score** or as a **canvas** (⇄ in its header): one tree, three views (below). A bang sends it; its second outlet is its notes as a buffer, for a `reader~`. Reading EDN evaluates nothing, so a tree box is safe in a shared room |
| `mt transpose 7` · `mt invert c4` · `mt retrograde` · `mt augment 2` · `mt rotate 1` · `mt canon 4 7` · `mt thin 0.5` | transformations (the right inlet changes the amount) |
| `mt seq` · `mt par` | joins the left tree with the right one, one after the other or at once |
| `mt events` · `mt pitches` · `mt duration` | the tree as plain data |
| `mt play [loop]` | plays the last tree on a bang: Hz (0) and voice ids (1) for `synth~`, parameters `[name value]` (2), dynamics and texts (3) |
| `freqt` · `canvas` | a tree on their inlet is **shown live** over their buffer; `(keep! :bN)` writes it into the buffer as one event of the history |

A score shows a tree written in `:measure`s as measured notation (tuplets, chords, rests, dynamics,
articulations, texts, changes of meter). Without measures, and for the strokes of a `freqt`, it shows them
**quantized** into measures (below).

Outside tuplets each value is written where the beats can be seen: a quarter off the beat over beat 2 of
4/4 stays one syncopated quarter, but over the middle of the bar it becomes two tied eighths; a dotted
quarter on beat 2 of 3/4 stays dotted, on beat 2 of 4/4 it shows beat 3. Two more keys of a note:
`:tie true` goes on into the next note of the same pitch (one sound, tied across a barline or into a
tuplet) and `:grace true` is a grace note before the next one (it takes no time).

## One box: the tree as code, score and canvas

A `tree` box is the one box for music in time (discussion [#92](https://github.com/bonuoq/kairotic/discussions/92)):
its data is the tree, and **code**, **score** and **canvas** are views of it (⇄ in its header, or
`(view :bN :canvas)`). The canvas draws its notes as strokes of frequency over time, as a freqt does,
and what is drawn there becomes edits of the tree — one event of the history each, merged between
branches like any edit of a tree.

- **Free time** (a tree without measures): drawing adds a note placed with `:at`, dragging moves it,
  stretching (from its end) lengthens it, Delete erases it. A free tree is kept as
  `[:voice {…} [:par [:note {:at 0 :dur 1 :pitch 60} …]]]`; one written otherwise (a melody string, a
  sequence) takes that form the first time a note's time changes. Its score shows it quantized, with its
  divisions chosen by alt-click and its names by shift-alt-click, kept in the tree's `:quant`.
- **Measures**: a change of pitch alone is written in the note (in its melody string, if it is in one); a
  change of time re-quantizes the bars it touches, in their meter; an erased note leaves a rest as long.
  A note drawn in a measured tree goes into its bar (one voice: a note drawn on a held one joins it as a
  chord). With **⌥** (dragging a note, or drawing freehand) a note leaves the measures for a free voice
  of the tree (`{:name "free"}`), which the score quantizes on its own staff.
- **Its grid and tuning** are attributes of the tree's root: `(grid-x :bN 0.25 [4])` writes `:grid`,
  `(tuning :bN "19-tet")` writes `:tuning`. A tree is drawn in semitones (12-tet) unless it says otherwise
  (`:tuning false` is continuous frequency); a measured tree without `:grid` shows its bars.

```clojure
(view :b2 :canvas)                 ; draw on it
(stroke :b2 [[0 261.63] [1 261.63]])   ; or by code: a note c4 from 0 to 1
(quantize! :b2)                    ; its free time written in measures (one event; undo goes back)
(unquantize! :b2)                  ; its notes in free time again
(to-tree! :b5)                     ; a new tree box beside the freqt :b5, with its strokes as notes
```

A `freqt` stays the buffer of raw frequency over time (what `transcribe` writes from a voice, a
drawing in continuous Hz): `(to-tree! :bN)` turns its drawing into a tree when it is to become a score.

## Quantization: free time as measured notation

A `freqt` shown as a score is quantized: its strokes become a tree of measures, tuplets, ties and grace
notes (issue [#86](https://github.com/bonuoq/kairotic/issues/86); after bach.quantize, FOMUS and Nauert).

- **The meter** comes from the buffer's bar grid: `(grid-x :bN 0.25 [4])` is 4/4, `[3]` 3/4,
  `[1.5 1.5]` 6/8, `[1.5 1.5 1]` 8/8 in 3+3+2. Without a grid, 4/4.
- **Each bar** is cut in spans (the beats of a simple meter, the dotted beats or groups of 6/8, 7/8 …),
  and each span takes the division (1 to 8, and those of its own units) that costs least: how far the
  notes are from its points, how deep the points it uses are (the beat, its half, its quarters; 32nds
  cost much), being a tuplet (a triplet less than a quintuplet), and notes lost (two starts on one
  point, a note shrunk to nothing). Two beats can go together (a half-note triplet), and a beat can be
  cut in halves (or a dotted beat in its eighths) with a division each (an eighth and a triplet of
  sixteenths).
- **Voices**: notes that overlap go to different voices, each note to the free voice nearest in pitch
  (at most `:voices`, 2 by default); notes that start and end together stay one chord. All the voices
  are quantized on the same points and written as layers of one staff (the highest first, stems up). A
  note held through another voice's triplet is not written in the triplet.
- **The notes** go on those points: chords where starts meet, rests in the gaps (a small gap before the
  next note is legato, not a rest), a tie over a barline or out of a tuplet, a grace note for a note too
  short for any point. A pitch half-way between semitones takes a quarter-tone accidental, others keep
  their cents as a text; a stroke that bends into the next note is a glissando line to it (a text,
  *gliss. ↗ +120¢*, when it bends into nothing).

At the REPL, `(quantize :bN)` gives that tree (it can be kept, edited, sent to a tree box), and options
change how it is made:

```clojure
(quantize :b1)                                   ; what the score shows
(quantize :b1 {:meter "6/8"})                    ; another meter than the grid's
(quantize :b1 {:divs [1 2 4] :merge [] :nest false})   ; no tuplets at all
(quantize :b1 {:grace false :legato 0})          ; no grace notes; every gap a rest
(quantize :b1 {:voices 1})                       ; one voice: overlapping notes cut
(qz/quantize-tree [:par [:note {:at 0 :pitch "c4" :dur 1.5}] …] {:meter [3 4]})   ; a tree without measures
```

The other options are `:chord` (how close two starts are to be one chord, 0.04 beats), `:overlap` (how
much a note may run into the next one and stay in its voice, 0.15 beats) and `:w`, the weights of the
cost (`{:err 8 :off 0.35 :cpx 1 :lost 1.5}`). `(as-tree :bN)` still reads a freqt's strokes exactly,
without quantizing them.

**Choosing another division.** The quantizer guesses; when it guesses wrong, **alt-click a note** of the
score: its beat takes the next way to divide it (the quantizer's own first, then the others, cheapest
first: another division, the beat in halves, the beat with the next one). Each choice is kept in the
buffer, with the options, as one event of the history:

```clojure
(quant :b1 {:meter "6/8" :divs [1 2 3 4 6]})     ; how this freqt's score is quantized (kept in its buffer)
(quant :b1)                                      ; → {:meter "6/8" …}
(divisions :b1 2.5)                              ; the ways the beat at 2.5 can be divided, the current first
(division! :b1 2.5)                              ; the next one (what alt-click does) → kept in :fix
(division! :b1 2.5 [:merge 3])                   ; this one: n, [n1 n2] (in halves) or [:merge n]
(division! :b1 2.5 nil)                          ; the quantizer chooses again
(quant :b1 nil)                                  ; the defaults
```

The buffer's text shows them as `:quant {:meter "6/8" :fix {2 [:merge 3]}}`, and a message
`[:quantize {…}]` on the freqt's inlet sets them too. Next: one box for freqt, tree and score
(discussion #92).

## How pitches are written: names, keys, accidentals

A pitch is written as a **letter, an alteration and an octave** (issue [#88](https://github.com/bonuoq/kairotic/issues/88)):
G# and Ab sound alike and are written apart, and a tree keeps the name it was given. `kairotic.spell`
places each name on the **line of fifths** (… Bb F C G D A E B F# C# …), where transposing, inverting and
choosing a name are arithmetic.

- **Written names stay**: `"bb4"`, `"f##3"` (or `"fx3"`), `"ebb2"` are written as they are, and `mt/pitches`
  gives them back. A name may carry `:cents` (`{:pitch "c4" :cents 50}` is a quarter tone above C).
- **Transposing keeps the spelling**: `(mt/transpose "m3" "c4 e4 g4")` is eb4 g4 bb4; by a number of
  semitones a tree moves by the interval it is usually written as (1 a minor second: c4 e4 g4 → db4 f4
  ab4; 6 the augmented fourth or the diminished fifth, whichever needs fewer alterations). Intervals are
  `"M3"`, `"-P5"`, `"A4"`, `"d5"`, `"m9"`… (`mt transpose M3` in a box). `mt/invert` around a written pivot
  mirrors names on the line of fifths too (c4 around e4 is g#4). A tree's keys move with it: `{:key "eb"}`
  transposed by `"M3"` is `{:key "g"}`.
- **Keys**: `{:key "eb"}` on the tree, a section, a voice or a measure (from there on): `"c#m"`,
  `"d dorian"`, `"f lydian"`, a number of sharps (`3`) or flats (`-2`), or `:none`. The score writes its
  signature and its changes; an accidental lasts to the end of its bar (and comes back as a courtesy in the
  next one); `:key :none`, or `:accidentals :every` on the tree, writes every accidental (atonal music).
- **Notes without a name** (numbers, Hz, a freqt's strokes) are named by `mt/spell`, which ->mei and the
  quantizer use: near the key (the one written, or estimated bar by bar with Temperley's profiles; without
  four pitch classes to go on, or when they fit no key clearly, as a chromatic line does, C), moving well in each voice (a chromatic line rises in sharps and falls in
  flats, no augmented second where a minor third does) and stacked well in each chord (Ab C Eb, not
  G# C D#), over the whole line at once (a Viterbi on the line of fifths). `(mt/spell tree)` writes those
  names into the tree. Without `:key` the score has no signature, only those names.
- **Another name by hand**: on a selected note of a tree's score, `#` cycles its spelling (c#4 → db4 →
  b##3); on a freqt's score, **shift-alt-click** a note (`(enharmonic! :bN beat midi [name])`), kept in its
  `:quant` as `:spell {[beat midi] name}`. `(quant :bN {:key "eb"})` gives a freqt's score a key.
- Quarter tones take quarter-tone accidentals; for tunings by ratios, HEJI (later) builds on these same
  names.

## REPL and components

The functions are in `mt/`: `mt/transpose`, `mt/invert`, `mt/retrograde`, `mt/augment`, `mt/rotate`,
`mt/canon`, `mt/expand`, `mt/events`, `mt/notes`, `mt/pitches`, `mt/duration`, `mt/problems`,
`mt/pp`, `mt/->mei`, `mt/->strokes`, `mt/<-strokes`, `mt/schedule`, and for proportional rhythm
`mt/cell-retrograde`, `mt/cell-rotate`, `mt/cell-at`, `mt/cell-replace-at`, and for meters `mt/meter-of`,
`mt/meter-level`, `mt/indispensability`, `mt/indispensability-at`, `mt/pulses`, `mt/thin`. At the REPL:

- `(tree! :b2 [:voice …])` writes a tree into a tree box;
- `(as-tree :bN)` reads a tree box, or the tree a score is showing, or a freqt's strokes, as a tree;
- `(quantize :bN [opts])` gives a freqt's strokes (or a tree without measures) quantized into measures;
- `(quant :bN opts)`, `(divisions :bN t)`, `(division! :bN t [choice])`: how a freqt's score is quantized, kept in its buffer;
- `(quantize! :bN [opts])`, `(unquantize! :bN)`, `(to-tree! :bN)`: a tree box's free time in measures and back, a freqt's strokes as a tree;
- `(enharmonic! :bN beat midi [name])`: another name for a note of a freqt's score; `mt/spell`, `mt/transpose "M3"`, and `kairotic.spell` (`sp/parse`, `sp/interval`, `sp/parse-key`, `sp/estimate-key`…);
- `(keep! :bN)` and `(unlive! :bN)`;
- `(recipe :bN)` and `(remake! :bN)` (below).

A component can send trees from its `:receive` and use `mt/…`. See the example `examples/claude/notation/walk.cljs`.

## Recipes: where a kept buffer came from

`(keep! :bN)` writes the tree a freqt or canvas is showing into its buffer, as strokes. The
buffer is plain data, but **beside it the box keeps the recipe that made it** (the idea comes from
[Rastrum](https://github.com/smoge/Rastrum), [discussion #17](https://github.com/bonuoq/kairotic/discussions/17)):

```clojure
(recipe :b5)
;; {:tree  [:voice [:measure {:meter [4 4]} …]]      the tree as it arrived
;;  :calls "(box :b2 \"tree\" 40 60)\n(box :b3 \"mt transpose 7\" …)…"   the boxes and lines upstream, as code
;;  :from  :b3}                                       the box it came from
```

- While the buffer is unchanged, a freqt **shown as a score** keeps showing the tree as measured notation (measures,
  tuplets, dynamics), not an approximation of its strokes, and `(as-tree :bN)` gives the tree itself.
- Once the buffer changes (a stroke drawn, a message on its inlet), the recipe is kept but marked
  `:stale`: it says where the buffer came from, no longer what it is. The header says *changed since
  kept*.
- `(remake! :bN)` writes the recipe's tree back into the buffer (one event), dropping the changes.
- `:calls` is the code of the boxes upstream, so the recipe still says how it was made after those
  boxes are deleted or changed: paste it into the Code tab to build them again.
- The work's code (Calls) writes each recipe as `(recipe :b5 {…})`, after the data; the Data view
  shows it as `:recipe`, beside `:data`.

## History

A tree lives in the work as the text of a `tree` box, so each edit is one event, with its diff, in
the branching history. A score that is showing a tree has not changed: its buffer only changes with
`keep!`, which keeps the recipe beside it. Next steps: a tree that is the whole work, with sections whose edits are diffs of the tree
itself (node by node), and scores that edit the tree directly.
