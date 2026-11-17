# @kairotic/rhythm

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

Rhythm as geometry, after Godfried Toussaint (*The Geometry of Musical Rhythm*; discussion
[#252](https://github.com/bonuoq/kairotic/discussions/252)). A rhythm that repeats is a **necklace**: k onsets among n
pulses around a circle — the same object as a pitch-class set on `pcclock` (in `@kairotic/theory`), measured with the
same geometry. Each class draws itself in the patch, and its pulses can be pressed.

| Class | What it shows and sends |
|---|---|
| `euclid [k 3] [n 8] [rotation 0] [bars 1] [midi]` | **a Euclidean rhythm** (Bjorklund's algorithm, after Toussaint): k onsets as evenly as they can be over n pulses — `euclid 3 8` the tresillo, `5 8` the cinquillo, `5 16` a rotation of the bossa nova, `7 12` the bembé —, drawn as a **necklace** (the pulses around a circle, the onsets a polygon; pressing a pulse makes the rhythm start there). Out: a **musical tree** for a `tree` box (left), the **`:rtm` map** alone (middle) and the **pulses** as ones and zeros (right) |
| `necklace [n 16] [bars 1] [midi]` | **a cyclic rhythm on the circle and its geometry** (Toussaint): the same object as a pitch-class set on `pcclock`, k onsets among n pulses. It takes pulses (`euclid`'s right outlet), intervals (`[3 3 2]`), box notation (`"x..x..x."`), an `:rtm` map or a tree; pressing a pulse adds or takes away an onset. Its **axes of mirror symmetry** are drawn. Out as `euclid` (tree, `:rtm` map, pulses), and its **measures** (right): interval vector, evenness, deep, flat, axes, longest gap, rhythmic oddity, the rotation of E(k,n) it is |

Both send rhythm **apart from pitch**, the same way: a musical tree for a `tree` box (outlet 0), its `:rtm` map
alone (outlet 1) and its pulses as ones and zeros (outlet 2); their right inlet gives the notes their pitches.

`euclid` keeps **rhythm apart from pitch**, as the `:rtm` of a musical tree does (see *Musical trees*,
`docs/mt.md`): the rhythm goes out as `[:rtm {:shares [3 3 2]}]`, the intervals between onsets as shares (a
negative share is a silence, as when a rotation leaves the first pulses empty), in a bar of n pulses (4/4 for
8 or 16, 12/8 for 12, n/8 up to 12, else n/16; `[:meter "3/4"]` for another). Its **right inlet** (cold) takes the
pitches its notes take in turn, starting again when they run out — *talea* and *color*: a map with `:pitches`
or `:pitch` (kept as it is), a pattern (`{:note [...]}`), a melody string, a list of Hz
(the keys held on a keyboard; MIDI with `midi`), notes or chords of a tree; `:clear` forgets them. With `bars`
the color goes on from bar to bar. Its middle outlet is the `:rtm` map alone, so any map of pitches can be
merged with it elsewhere (`merge`, then `vector :rtm %`). A bang sends it; `[:k 5]`, `[:n 16]`, `[:rotation 2]`,
`[:bars 4]`, `[:meter "3/4"]` (or one map of them) change it and send it when it is new; a number is k.

```clojure
(box :b1 "msg :bang" 40 20)
(box :b2 "keyboard 60 24" 160 20)
(box :b3 "euclid 5 8" 40 120)
(box :b4 "tree" 40 340)
(connect :b2 0 :b3 1) (connect :b1 0 :b3 0) (connect :b3 0 :b4 0)
```

Hold a chord on the keyboard and click bang: the cinquillo, its notes taking the chord's pitches in turn.

`necklace` measures what Toussaint measures. The **interval vector** (`:ivec`) counts how often each distance
between onsets occurs (the son clave: `[0 1 2 2 0 3 2 0]`). **Evenness** (`:evenness`) is the sum of the chords
between all pairs of onsets (Block and Douthett) — arcs would give the six 4/4 claves the same value; chords
tell the rumba from the bossa nova —, and `:even` is that sum against the Euclidean rhythm's, 1 when it is as
even. A rhythm is **deep** when each distance occurs a different number of times (the bembé, as the diatonic
scale), **flat** when each occurs once. `:axes` are its axes of mirror symmetry (in pulses), `:gap` its longest
interval, `:oddity` true when no two onsets halve the cycle, and `:euclid` the rotation of E(k,n) it is (or nil).
It is an editor too: pressing a pulse (or a number, its index), `:complement`, `[:rotate 1]`, `[:n 12]`, `:clear`.
Its outlets are `euclid`'s, so either can feed the same trees and pitches; a necklace after a `euclid` names what
the euclid made:

```clojure
(box :b1 "msg [:rotation 6]" 40 20)
(box :b2 "euclid 5 16" 40 60)
(box :b3 "necklace" 260 60)
(box :b4 "print" 260 320)
(connect :b1 0 :b2 0) (connect :b2 2 :b3 0) (connect :b3 3 :b4 0)
```

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).
