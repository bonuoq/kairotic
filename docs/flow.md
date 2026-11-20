# Data that flows

*[Versión en español](flow.es.md)*

## Messages and time

Messages travel whenever something sends them — a click on a bang or a message, a number dragged, a
data box that changed, the REPL — with or without ▶, as in Max and Pd (where only the audio needs the
DSP on). **▶ starts what needs a clock**: the sound (audio nodes) and time (loadbang, metro, ramp,
`mt play`: everything that asks for something *later*). **■** silences and brings boxes back to their
initial state; the data boxes then send what they hold again.

## Data boxes send themselves

A `tree` box sends its tree **whenever it changes** — an edit of its text, `tree!`, `tree-edit!`, the
history moving, someone else's edit in a room — and also when the patch around it changes (a new
line, a new text such as `mt transpose` → `mt retrograde`), so what depends on it is always up to
date. It sends at most once per moment and only if something really changed. When the patch changes, the tree
goes again only toward what needs it: along its lines that lead to a new line or to a box that is new or
has a new text. Moving a knob, whose value stays in its text, sends nothing. A bang sends it again;
`tree manual` sends only on a bang (for live performance, when you prepare a change and launch it).

## Views that send their edits back

A `freqt` shown as a score that shows a tree has a third outlet, **edits**: when you change a note on
it (click, then ↑ ↓ + − ← → Delete), it sends `[:edit [[:attrs [0 1 2] {…}] …]]`. Connected back to the tree box —
a **dashed line**, drawn for you when you connect a tree to a freqt shown as a score with the mouse — the edits
change the tree (as `tree-edit!`, one event of the history), and the tree, changed, comes back to the
score. Nothing is coupled behind the patch: the loop is a line you see, in the patch and in the code.
A tree box can also show itself as a score (⇄ in its header, `(view :bN :score)`): then its notes
edit it directly, with no wire. The wired loop is for a score that shows the tree after `mt` boxes.
Or as a **continuum** (`(view :bN :continuum)`, `(continuum! :bN :dissolve)`): between a piano roll and a score,
each axis at its own resolution, changing over the piece — time from where each note sounded to where it is written,
pitch from its exact frequency to the nearest key to its step on the staff, the glyph from a stroke as thick as it is
loud to a head with a line to its written value. The resolutions are kept in the tree (one event of the history, part
of its MEI). A take — where one performance played each note — can be shown in place of the notes' own time:
`(keep-take! :bN take)` keeps it only for you (in this browser, as Learn keeps your mappings), `:work` in the tree.
Wires join a note to the electronics. They are written on the note (`[:note {:pitch "g4" :dur 1 :wire {:send :swell}}]`,
several in a vector), so they move with it when the tree is edited, and drawn on the continuum from the note up to a lane:
`(wire! :bN 2 :swell)` is **rigid** — a `follow` box listening to the performer sends `:swell` on that note, or at
the next note it finds if that one was passed over, never before and never twice; `{:kind :elastic :tol 0.5}` is
**elastic** — on the note if the performer gets there in time, else on its own half a second after the note was
expected at the performer's tempo; `{:leader :electronics}` — at the expected time, whatever the performer does.
A rest can carry wires too — `[:rest {:dur 4 :wire {:send :drone}}]`: an event of the electronics alone, silent, which a
follow box sends at its time (from where the performer is) and the continuum draws on its lane; a tree of such rests,
fragments and `[:param …]` ramps is a score of electronics. `mt play` sends what the wires send (its fifth outlet) at
their written time: the same patch of electronics, driven live by `follow` or in fixed time by `mt play`.

The edits name the node where each note is written, so they work through transformations: a score
showing `mt transpose 7` of a tree can edit the tree itself. Edits are messages like any other: they
can be filtered, sent to another tree, or written by a component.

A tree box also takes whole trees on its inlet (a copy of another tree, or a transformed one).

## Loops

- **In one instant**: a message that comes back to the same box 100 times in one instant is a loop
  without time; it is cut, and the REPL says where. A loop that goes through time (metro, a delay,
  `mt play`) is not cut: that is feedback you mean.
- **Its own tree back**: a tree box that receives its own tree, even transformed by `mt` boxes,
  does not change (and says so): otherwise it would rewrite itself for ever.
- **By rate**: a tree box rewritten by messages 20 times in 10 seconds stops accepting them;
  `(resume! :bN)` lets them in again.
- A score does not send what it receives, only what you edit, and a tree sends only what changed:
  the tree ⇄ score loop ends after one round.
