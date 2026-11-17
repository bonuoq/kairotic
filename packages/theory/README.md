# @kairotic/theory

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

Music theory you can see and touch: what sounds, as geometry. Each class draws itself in the patch
(with the shapes of the core, in the theme's colours) and its parts can be pressed.

| Class | What it shows and sends |
|---|---|
| `pcclock [notes] [midi]` | a pitch-class set on the clock face (C at the top): its polygon, the sets before it fading behind, its axes of symmetry by inversion; its **prime form** (left), **interval vector** (middle) and the pitch class pressed (right) |
| `fourier [notes] [midi]` | the six **Fourier coefficients** of the distribution of pitch classes — f1 chromatic, f2 dyadic, f3 triadic, f4 octatonic, f5 diatonic, f6 whole-tone — each a point in its circle with its trail; magnitudes (0…1) on the left, phases (degrees) on the right |
| `tonnetz [notes] [midi]` | the **Tonnetz** (fifths across, major and minor thirds up): the nodes that sound, the triads they contain, and the **path of the harmony** — each triad found joined to the ones before, on the copy of the lattice nearest the last; the triad (`:C`, `:am`…) on the left, the pitch class pressed on the right |
| `comes [system] [mode] [speed 1] [k -7] [d 3] [beats 2] [imitation 1] [bars 0] [upbeat 0] [inverted] [fourth] [live] [midi]` | **counterpoint live**: the **comes** reads the dux at a **speed** — `1` a canon, `0.5` an augmentation, `-1` a **crab**, written from both ends to the middle — and with `inverted` upside down (an inversion; backwards, a **table canon**). Forwards you play the dux and the comes answers, by turns or `live` on a pulse (Study 41: ties, suspensions, fourth species, the degree of imitation); backwards, a note at the start and then one at the end, or `live` beat by beat, the box answering at the end of your own line (Study 46). Every note is checked against the rules and against the future (the **futuribles**, counted exactly), and corrected to the nearest one that can be played. Both voices sound as Hz after their voice ids, for one `synth~`; the finished work goes out as a musical tree for a `tree` box (Studies 41–46, 50) |
| `euclid [k 3] [n 8] [rotation 0] [bars 1] [midi]` | **a Euclidean rhythm** (Bjorklund's algorithm, after Toussaint): k onsets as evenly as they can be over n pulses — `euclid 3 8` the tresillo, `5 8` the cinquillo, `5 16` a rotation of the bossa nova, `7 12` the bembé —, drawn as a **necklace** (the pulses around a circle, the onsets a polygon; pressing a pulse makes the rhythm start there). Out: a **musical tree** for a `tree` box (left), the **`:rtm` map** alone (middle) and the **pulses** as ones and zeros (right) |

The three views take the same messages: a **list of pitches** — Hz, as a `keyboard`, `midiin`, a `player` or `pitch~` send them, or MIDI (or 0…11) with the word `midi` — is the set; a **list of 12
values between 0 and 1** is a chroma (from `chroma~` of `@kairotic/analysis`); a **number** is one
note, and the last `notes` of them are the set (4, or 3 for `tonnetz`); `:clear` empties it.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "chroma~" 40 90)
(box :b3 "tonnetz" 40 160)
(box :b4 "fourier" 440 160)
(connect :b1 0 :b2 0) (connect :b2 0 :b3 0) (connect :b2 0 :b4 0)
```

Sing or play: the Tonnetz follows the triads and draws their path, the coefficients their trails.
From a score, connect what `mt play` or a `player` plays (Hz) or what a `reader` reads from a freqt.

`comes` takes notes as a `keyboard` or `midiin` sends them (Hz; the list of notes held, the first new one
played), `[:midi 62]`, or MIDI numbers with the word `midi`; `:engine` lets it choose the next pair,
`:back`, `:reset`, `:hold`; `[:k -4]`, `[:imitation 0.5]`, `[:mode :hypodorian]`, `[:beats 3]`, `[:species 4]` change the
canon (by turns at once, live at the next section); `fourth` makes the dux a cantus firmus and the comes syncopated; `inversion` turns the comes upside down about an axis (`[:axis 62]`), `augmentation` makes it twice as slow. `:end` ends the section from outside. `comes` only reacts:
what is more — the mode heard, a modulation, the meter, phrases — is for boxes of analysis, which tell it with these
messages; with `nocues` it leaves them the meter and the sections too.
Both take a **system** (Study 42): the scale, its tuning and its rules as data — `diatonic` (the default),
`meantone`, `septimal31`, `pentatonic` (`comes pentatonic`, `comes pentatonic penta-A` — the words name the system and one of its modes, in any order; a mode it does not have is said, `[:system :septimal31]`), or
an EDN map with `:tuning`, `:steps`, `:vertical`, `:melodic`, `:modes`, `:canon`…; its modes and the distances
at which it imitates come with it, a key is taken as the nearest note of the system, and the notes out are tuned.
Less imitation (`comes dorian -7 3 2 0.8`) lets the comes move near the dux's notes; 0.3, only
follow its motion; below 0.2, free counterpoint. Its counterpoint is `counterpoint.mjs`, beside the components
(Study 41's kernel, the futures of every point counted exactly).

**How every engine weighs its decisions: `soft.mjs`.** The hard rules of a kernel decide what may be; the soft rules
decide what is likely: a candidate costs something by the shape of its own line (`melodicParts`) and by the vertical
it makes with another voice (`verticalParts`), each rule by its id and weight (`SOFT`, `defaultWeights()`), and an
engine chooses among the candidates with a future by a softmax of −cost / temperature (`choose`, `pick`), colder
where few futures are left (`temperature`). The comes box weighs with it (adding its own two rules, the mode and the
imitation), and so do the engines of the studies and the agents Claude builds: the same weights mean the same music
everywhere. A component or an agent reaches it as the page's own copy, `kairotic/packages/theory/soft.mjs`, or from
npm (`npm:@kairotic/theory@0.13.0/dist/soft.mjs`).

```clojure
(box :b1 "keyboard 60 24" 40 30)
(box :b2 "comes" 40 130)
(box :b3 "synth~" 40 200)
(box :b4 "dac~" 40 260)
(connect :b1 0 :b2 0) (connect :b2 0 :b3 0) (connect :b3 0 :b4 0) (connect :b3 0 :b4 1)
```

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

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).
