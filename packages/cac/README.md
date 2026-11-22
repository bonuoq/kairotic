# @kairotic/cac

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

Composition assisted by computer (*CAC*, *composition assistée par ordinateur*, after IRCAM's OpenMusic): the
engines that write music with you — they propose, correct and write notes — apart from the views of
[`@kairotic/theory`](../theory/), which draw what sounds. Discussion [#172](https://github.com/bonuoq/kairotic/discussions/172)
(the futuribles) is where they come from.

| Class | What it does |
|---|---|
| `cac partimento\|judge [voices 4] [key] [temp 0.5] [seed 1] [unit 0]` | **operations on a tree that follow rules** (discussion #323), beside `mt`'s mechanical ones: **`cac partimento`** takes a tree whose lowest voice is a bass (its notes' figures, `:fig "6/5"`, and keys, `:local "G major"`, if it has them) and writes the voices above it — 4 parts by default, or 3 or 2 — by the engine of Studies 51–62, counting the realizations exactly (for 1.5 s at most: a bass too long to count — say 16 bars without figures in four parts — is realized by search instead, without freezing the page); a bang writes another, `:any` any valid one. **`cac judge`** takes voices (the lowest the bass) and says whether they keep the rules, where and why not. What the analysis finds goes back on the bass's notes as the tree's **analysis layer** (`:fig` the chord made, `:deg`, `:local`), which a tree box's code window shows with **Analysis** |
| `comes [system] [mode] [speed 1] [k -7] [d 3] [beats 2] [imitation 1] [bars 0] [upbeat 0] [inverted] [fourth] [live] [midi]` | **counterpoint live**: the **comes** reads the dux at a **speed** — `1` a canon, `0.5` an augmentation, `-1` a **crab**, written from both ends to the middle — and with `inverted` upside down (an inversion; backwards, a **table canon**). Forwards you play the dux and the comes answers, by turns or `live` on a pulse (Study 41: ties, suspensions, fourth species, the degree of imitation); backwards, a note at the start and then one at the end, or `live` beat by beat, the box answering at the end of your own line (Study 46). Every note is checked against the rules and against the future (the **futuribles**, counted exactly), and corrected to the nearest one that can be played. Both voices sound as Hz after their voice ids, for one `synth~`; the finished work goes out as a musical tree for a `tree` box (Studies 41–46, 50) |

Its kernels travel with it as modules for the page (`dist/`, or the page's own copy under `kairotic/packages/cac/`):
`counterpoint.mjs` (two voices note by note, Studies 40–42), `mirror.mjs` (canons by transformation, Study 43),
`soft.mjs` (how every engine weighs its decisions) and `partimento.mjs` (a given bass realized in two or three
parts, Studies 51 and 54).

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
npm (`npm:@kairotic/cac@0.1.0/dist/soft.mjs`).

**A given bass in two or three parts: `partimento.mjs`.** The hard rules of tonal counterpoint over a bass, after Job
IJzerman's *Harmony, Counterpoint, Partimento*: `schemata(spec)` writes one voice over a bass (chapter 1: suspensions
prepared and resolved, passing tones, the melodic minor), `parts(spec)` two (chapters 2–3: the rules of upper voices,
a 4th a consonance between them, three notes of a chord — its 3rd not doubled, nor the leading tone —, the chord on
a dominant major in minor), each counting its realizations exactly, drawing one uniformly or by the engine (with
`soft.mjs`). The schemata of the book and its cadences come with it as data (`SCHEMATA`, `SCHEMATA3`, `CADENCES`),
and its prototypes (`PROTOTYPES`). Studies 51 and 54 publish copies of it; a change to a rule is made here.

```clojure
(box :b1 "keyboard 60 24" 40 30)
(box :b2 "comes" 40 130)
(box :b3 "synth~" 40 200)
(box :b4 "dac~" 40 260)
(connect :b1 0 :b2 0) (connect :b2 0 :b3 0) (connect :b3 0 :b4 0) (connect :b3 0 :b4 1)
```

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).
