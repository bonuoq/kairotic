# @kairotic/rhythm

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

Rhythm as geometry, after Godfried Toussaint (*The Geometry of Musical Rhythm*; discussion
[#252](https://github.com/bonuoq/kairotic/discussions/252)). A rhythm that repeats is a **necklace**: k onsets among n
pulses around a circle — the same object as a pitch-class set on `pcclock` (in `@kairotic/theory`), measured with the
same geometry.

The package separates **making** a rhythm from **being** one. **Pulses** — ones and zeros, `[1 0 0 1 0 0 1 0]` — are
the common tongue of its boxes, as Hz are of pitch: generators make them, and the `necklace` holds them, draws them,
is their editor, measures them and writes them as music.

| Class | What it does |
|---|---|
| `euclid [k 3] [n 8] [rotation 0]` | **a generator**: a Euclidean rhythm (Bjorklund's algorithm, after Toussaint) as pulses — k onsets as evenly as they can be over n pulses: `euclid 3 8` the tresillo, `5 8` the cinquillo, `5 16 6` the bossa nova, `7 12` the bembé. No view of its own: a bang sends the pulses; `[:k 5]`, `[:n 16]`, `[:rotation 6]` (or a map) change them, a number is k |
| `necklace [n 16] [bars 1] [midi] [fourier]` | **the rhythm box**: takes a rhythm in any notation, draws it on the circle with its axes of symmetry, lets you edit it (pressing a pulse adds or takes away an onset), sends its **measures** (interval vector, evenness, deep, flat, axes, gap, oddity, the rotation of E(k,n) it is, Fourier coefficients) and writes it as a **musical tree** with the pitches of its right inlet |
| `chance [k 3] [n 8] [seed 1]` | **a generator**: k onsets among n pulses drawn with a seed — each bang another rhythm, the same seed the same rhythms in the same order (in a room, from the history); `:reset` starts them again |
| `homometric` | **a generator from a rhythm**: the other rhythms with the same interval vector, not the same necklace turned or in a mirror (the two flat rhythms of 4 in 12; a half of an even cycle and its complement) — a list of pulses, and how many |
| `swap` | **how far apart two rhythms are** (Toussaint's swap distance): the left one against the right one (the reference, cold) — in the bar, around the circle, and as necklaces at the best rotation; with the Hamming distance beside it, and the directed swap distance when they hold different numbers of onsets |

```clojure
(box :b1 "msg [:rotation 6]" 40 20)
(box :b2 "euclid 5 16" 40 60)
(box :b3 "necklace fourier" 40 100)
(box :b4 "tree" 260 100)
(box :b5 "print" 40 420)
(connect :b1 0 :b2 0) (connect :b2 0 :b3 0) (connect :b3 0 :b4 0) (connect :b3 3 :b5 0)
```

## necklace

**In (left)**: pulses (`euclid`'s outlet), intervals between onsets (`[3 3 2]`), box notation (`"x..x..x."`), an `:rtm`
map (`{:shares [3 3 2]}`), a tree with an `:rtm`, or `{:onsets [0 3 6] :n 8}`. A number (or pressing a pulse) adds or
takes away that onset; `:complement` swaps onsets and silences, `[:rotate 1]` starts it a pulse later, `[:n 12]` makes
the circle longer or shorter, `:clear` empties it, `[:bars 4]` and `[:meter "3/4"]` shape the tree, a bang sends it again.
The same rhythm again sends nothing.

**Its measures** (outlet 3), what Toussaint measures. The **interval vector** (`:ivec`) counts how often each distance
between onsets occurs (the son clave: `[0 1 2 2 0 3 2 0]`). **Evenness** (`:evenness`) is the sum of the chords between
all pairs of onsets (Block and Douthett) — arcs would give the six 4/4 claves the same value; chords tell the rumba from
the bossa nova —, and `:even` is that sum against the Euclidean rhythm's, 1 when it is as even. A rhythm is **deep**
when each distance occurs a different number of times (the bembé, as the diatonic scale), **flat** when each occurs
once. `:axes` are its axes of mirror symmetry (in pulses, drawn across the circle), `:gap` its longest interval,
`:oddity` true when no two onsets halve the cycle, and `:euclid` the rotation of E(k,n) it is (or nil). `:fourier` and
`:phases` are its **Fourier coefficients** f1 … f⌊n/2⌋ (after Amiot and Milne), magnitudes 0…1 and phases in degrees:
|f1| near 0 is a balanced rhythm, |f_k| is largest when k onsets are maximally even, the others are its periodicities
(in 16 pulses f4 the quarter notes, f3 a three against the four). With the word `fourier` the magnitudes are drawn,
a bar each, f_k in the kairos colour.

**As music** — rhythm **apart from pitch**, as the `:rtm` of a musical tree is (see *Musical trees*, `docs/mt.md`):

| outlet | |
|---|---|
| 0 | a **musical tree** for a `tree` box: `[:voice [:measure {:meter [4 4]} [:rtm {:shares [3 3 2]}]] …]` — the shares are the intervals between onsets, a negative share the silence before the first one; a bar of n pulses (4/4 for 8 or 16, 12/8 for 12 or 24, n/8 up to 12, else n/16; `[:meter …]` for another); `bars` repeat it |
| 1 | the **`:rtm` map** alone (`{:shares [3 3 2] :pitches …}`): merge any map of pitches into it (`merge`) and write it as a node (`vector :rtm %`) |
| 2 | the **pulses** |
| 3 | the **measures** |

Its **right inlet** (cold) takes the pitches the notes take in turn, starting again when they run out — *talea* and
*color*: a map with `:pitches` or `:pitch` (kept as it is), a pattern (`{:note [...]}`, as `comes` sends), a melody
string, a list of Hz (the keys held on a keyboard; MIDI with `midi`), notes or chords of a tree; `:clear` forgets them.
With `bars` the color goes on from bar to bar.

## Generators and relations

`euclid`, `chance` and `homometric` make pulses; `swap` compares two. They have no view: put a `necklace` after
a generator to see, edit, measure and hear what it made.

**swap** answers `{:swap :circular :necklace :rotation :hamming :necklace-hamming :n :k}`. A swap exchanges an onset
and the silence beside it; the distance is how many turn one rhythm into the other, so an onset moved far counts
more than one moved near — the Hamming distance (how many pulses differ) cannot tell: the son clave is 1 swap from
the rumba and 1 from the bossa nova, and 2 by Hamming from both. With different numbers of onsets it is the directed
swap distance (the tresillo is 0 from the cinquillo: it is inside it). `:circular` lets a swap cross the end of the
bar; `:necklace` turns the reference to where it comes nearest, and `:rotation` says how far.

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).
