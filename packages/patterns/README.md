# @kairotic/patterns

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

Patterns after SuperCollider's (`Pbind`, `Pseq`, `Pwhite`…), on Clojure's lazy sequences as
[Overtone](https://cljdoc.org/d/overtone/overtone/0.16.3331/doc/pattern-library) does: a pattern is a
(possibly endless) sequence of event maps such as `{:degree 2 :dur 0.5 :amp 0.3}`. Design: discussion
[#84](https://github.com/bonuoq/kairotic/discussions/84).

| Class | What it does |
|---|---|
| `pbind [seed] [repeat] [loop]` | a pattern as **data**: an EDN map whose values are constants, sequences (vectors: the shorter ones start again until the longest ends) and `#pat/…` generators. Reading it evaluates nothing, so it is safe in a shared room. It sends its pattern whenever it changes. A map on its inlet replaces it, `[:set :dur [1 0.5]]` changes one key |
| `pattern [seed] [repeat] [loop]` | a pattern as **code**: a Clojure expression that returns event maps (or one map, read as a pbind), with `rand`, `rand-int`, `rand-nth` and `shuffle` seeded, and `pbind`, `pseq`, `pwhite`, `pchoose`, `pshuffle`, `pseries`, `pwalk` at hand. Like a script, it runs in a shared room only after `(trust-scripts true)` |
| `player [bpm] [quant] [jump] [limit] [edges] [spread]` | plays a pattern (on its right inlet) the way the left inlet says: `start`/`stop` by its own clock, `bang` one step, a number a position in beats (as a `reader` reads a buffer, in either direction), `seek p` a jump. Out: the Hz of the notes sounding, their voice ids (for `synth~` or a polyphonic `faust~`), the whole event, and the beat |
| `render [from] [to] [tex key] [tone key]` | draws a stretch of a pattern into a `freqt`: it sends a musical tree, which the freqt shows live, `(keep! :bN)` writes with its recipe, and a score quantizes. A canvas on its right inlet is a **time map**: each stroke says which beat of the pattern (y) is at each beat of the drawing (x) |

```clojure
(box :b1 "pbind 7 loop" 40 30)
(code :b1 "{:degree #pat/shuffle [0 2 4 7]\n :dur    [0.5 0.5 1]\n :octave #pat/hold [4 [5 6]]}")
(box :b2 "msg start" 40 130) (box :b3 "msg stop" 110 130)
(box :b4 "player 110" 40 180)
(box :b5 "synth~" 40 240) (box :b6 "dac~" 40 290)
(connect :b2 0 :b4 0) (connect :b3 0 :b4 0) (connect :b1 0 :b4 1)
(connect :b4 0 :b5 0) (connect :b4 1 :b5 1) (connect :b5 0 :b6 0) (connect :b5 0 :b6 1)
```

## The source travels, the stream is made here

The history, the rooms and the links of a work travel as data, and an endless sequence does not.
So what a `pbind` or `pattern` box keeps is its **source** and a **seed**, and what goes along a line is
a pattern value: a factory of streams. Each tab makes the events from the same source and seed, so
everyone hears the same, and going back in the history plays the same again. Every key of a pbind has
a seed of its own, made of the box's seed and its name: changing `:dur` does not change the randomness
of `:amp`.

## Generators

| | |
|---|---|
| `#pat/seq [a b c]` | the same as a vector |
| `#pat/choose [a b c]` | one at random, each time (endless) |
| `#pat/shuffle [a b c]` | every pass in a new order |
| `#pat/white [lo hi]` | random between lo and hi (whole numbers if both are) |
| `#pat/walk [start step lo hi]` | a random walk between lo and hi |
| `#pat/series [start step]` · `[start step n]` | an arithmetic series (endless, or n long) |
| `#pat/hold [beats [a b]]` | one value every `beats`, following time rather than events |
| `#pat/chord [0 4 7]` | a vector as one value (a chord), not as a sequence |

A generator can be an element of a vector: `[0 #pat/choose [2 4] 7]`. As in Overtone, a pattern with an
endless key is endless; otherwise a pass lasts as long as its longest sequence.

## Events

Pitch: `:freq` in Hz, `:note` (MIDI, `"c4"` or `:c4`), or `:degree` with `:scale` (`:major`, `:dorian`,
`:minor-pentatonic`… or a vector of semitones, fractional for microtones), `:root` (`:d`, `:eb`, 2) and
`:octave` (5 → C4), as SuperCollider's default event; `:transpose` in semitones. A vector of pitches is
a chord. Length: `:dur` in beats (1), and `:legato` (0.8) or `:sustain` (beats). Silence: `:rest` (or
`:_`, `:-`, `:r`, or `nil`) as the note, degree or freq — `{:degree [0 2 :rest 4]}`, `[0 nil 4]` — or
`{:type :rest}`. Loudness: `:amp` (0…1); the player sends `[:gain amp]` on its Hz outlet just before the
notes of that event, which `synth~` and a polyphonic `faust~` take as the level of the notes that start
(notes that start at the same instant share the last one). Any other key goes out with the event, for
whatever reads it (`get % :pan`, a score, an instruction for a performer: events need not sound).

## Playing it

| On the left of `player` | |
|---|---|
| `start` · `stop` | its own clock: every event lasts its `:dur` in beats at its bpm; `player 120 4` starts on a multiple of 4 beats, so players with the same tempo meet; `[:bpm 90]` changes the tempo without a jump |
| `bang` | one step: the next event now (from a `metro`, an `onset~`, a key, a performer), going on from where its steps or its clock were |
| a number | a position in beats, as a `reader` reads a buffer (from `ramp 0 16 8 loop`, a `counter`, a number you drag, or `phasor~ → snapshot~`): every event is a **span**, from its onset to its end (`:sustain`, or `:dur` × `:legato`), that sounds while the position is inside it. Forwards a note starts at its onset; **backwards it starts at its end** and goes out with `:dir :back`, so a ramp going down plays the phrase in reverse, each note for its own length. What one step passes over sounds within it; an event of no length sounds when it is crossed, either way |
| `seek p` | a jump: there at once, without sounding what is in between. It is a difference: what sounds and still contains `p` goes on (not cut, not started again), what no longer does ends, and what newly contains `p` starts (with `edges`, only what starts exactly at `p`). A step more than `jump` (8) times the one before it, or longer than `limit` (8) beats, is a seek too: the wrap of a looping ramp, a counter starting again, a click far away — so a ramp needs nothing special. Steps under a sixteenth of a beat are always motion, so a curve that leaves rest steeply (a power, an exponential) passes through every event |
| `reset` | back to the beginning, silently |

With `spread`, what one step passes over keeps its rhythm: each start and end is sent as far into the
next step as it lies into this one, one step (about 10 ms with a `ramp`) late; it needs ▶. The events
already made are kept in a window, the same ones every time thanks to the seed, so moving back does not
make the stream again.

A new pattern while it plays goes on from the beat it is on. The same pattern again (a data box sending
itself again) changes nothing. One pattern can feed several players moving in different ways.

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).

## Drawing it: render and time maps

`render 0 8` draws the beats 0 to 8 of a pattern into a `freqt` — what a `player` at a position would play,
worked out at once. Every event is a span, from its onset to its end, and a note of the drawing lasts as
long as the map stays inside it. Without a canvas the map is the diagonal from `from` to `to`; with a canvas
on its right inlet, each stroke is a map, x the beats of the drawing and y those of the pattern:

| A stroke that… | gives |
|---|---|
| is steeper · flatter | faster · slower (a curve: accelerando, ritardando) |
| goes down | the phrase backwards, each note entered from its end (`:back true`) |
| is flat | the note it is in, held |
| steps vertically | a cut: what no longer sounds ends, what is there starts, what still sounds goes on |
| is one of several | a layer of the same pattern (`:layer n`): a canon, a canon by augmentation |

How each note is drawn: `:amp` is its weight, `:pan` a vertical gradient across it, from its colour to the
paper (−1 one side, 1 the other), and `render 0 16 tex art tone inst` draws the values of `:art` as textures
and those of `:inst` as colours, one for each value met. The other keys travel with each note under `:ev`.
Silences are left to the quantizer of the score. After changing the canvas, a bang renders again.
