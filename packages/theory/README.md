# @kairotic/theory

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

Music theory you can see and touch: what sounds, as geometry. Each class draws itself in the patch
(with the shapes of the core, in the theme's colours) and its parts can be pressed.

| Class | What it shows and sends |
|---|---|
| `pcclock [notes]` | a pitch-class set on the clock face (C at the top): its polygon, the sets before it fading behind, its axes of symmetry by inversion; its **prime form** (left), **interval vector** (middle) and the pitch class pressed (right) |
| `fourier [notes]` | the six **Fourier coefficients** of the distribution of pitch classes — f1 chromatic, f2 dyadic, f3 triadic, f4 octatonic, f5 diatonic, f6 whole-tone — each a point in its circle with its trail; magnitudes (0…1) on the left, phases (degrees) on the right |
| `tonnetz [notes]` | the **Tonnetz** (fifths across, major and minor thirds up): the nodes that sound, the triads they contain, and the **path of the harmony** — each triad found joined to the ones before, on the copy of the lattice nearest the last; the triad (`:C`, `:am`…) on the left, the pitch class pressed on the right |
| `comes [mode] [k -7] [d 3] [beats 2] [imitation 1] [bars 8] [upbeat 0] [midi]` | **counterpoint live**: you play the dux, one note a beat, and the **comes** answers, as a canon in a mode (Study 40). A note that breaks a rule of the style, or from which the canon could not be finished, is corrected to the nearest one that can be played, and the box says why. The comes (Hz, left), the dux as played or corrected, the **futuribles** — the next notes, the most plausible first, with their futures counted exactly — and where the canon is (right) |

The three views take the same messages: a **list of pitches** (MIDI, or 0…11) is the set; a **list of 12
values between 0 and 1** is a chroma (from `chroma~` of `@kairotic/analysis`); a **number** is one
note, and the last `notes` of them are the set (4, or 3 for `tonnetz`); `clear` empties it.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "chroma~" 40 90)
(box :b3 "tonnetz" 40 160)
(box :b4 "fourier" 440 160)
(connect :b1 0 :b2 0) (connect :b2 0 :b3 0) (connect :b2 0 :b4 0)
```

Sing or play: the Tonnetz follows the triads and draws their path, the coefficients their trails.
From a score, connect what a `reader` or a `mt` box plays (numbers, as notes) or the chords of a tree.

`comes` takes notes as a `keyboard` or `midiin` sends them (Hz; the list of notes held, the first new one
played), `[:midi 62]`, or MIDI numbers with the word `midi`; `engine` (or bang) lets it choose the next pair,
`back` and `reset`. Less imitation (`comes dorian -7 3 2 0.8`) lets the comes move near the dux's notes; 0.3, only
follow its motion; below 0.2, free counterpoint. Its counterpoint is `counterpoint.mjs`, beside the components
(Study 40's kernel, the futures of every point counted exactly).

```clojure
(box :b1 "keyboard 60 24" 40 30)
(box :b2 "comes" 40 130)
(box :b3 "synth~" 40 200)
(box :b4 "dac~" 40 260)
(connect :b1 0 :b2 0) (connect :b2 0 :b3 0) (connect :b3 0 :b4 0) (connect :b3 0 :b4 1)
```

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).
