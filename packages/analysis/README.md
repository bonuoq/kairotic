# @kairotic/analysis

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

From any signal — an `adc~`, a `sample` played by a `reader~`, a `faust~` — into messages and pictures:

| Class | What it gives |
|---|---|
| `features~ [ms] [descriptor …]` | one outlet per descriptor written after it, every ms (20): `rms`, `energy`, `zcr`, `loudness`, `centroid` and `spread` (Hz), `flatness`, `rolloff` (Hz), `kurtosis`, `skewness`, `slope`, `crest`, `sharpness`, `perceptualSpread`, `mfcc` (13), `chroma` (12). Without words: `rms centroid flatness` |
| `pitch~ [lo hi] [threshold]` | the frequency in Hz (0 once when it stops hearing one) and how clearly periodic it is, by YIN, between lo and hi (60 – 1500 Hz) |
| `onset~ [threshold] [ms]` | a bang at the beginning of each sound (a note, a stroke, a syllable), its strength, and the growth of the spectrum of every frame (the onset strength envelope). An onset is reported about 6 ms after it starts (one hop at most, measured); a sound cut at once is not one |
| `chroma~ [ms]` | 12 values from C to B and the strongest pitch class as a word (`:a`, `:c#`…) |
| `spectrum~ [lo hi]` | the spectrum drawn in the patch, on a log scale of frequency |
| `transcribe [bpm] [notes\|glide] [ms]` | what `pitch~` hears (and `onset~` splits), written into a `freqt` as strokes: notes where the contour settles on another pitch (a slide, a vibrato or an ornament that passes does not start notes), each at its median pitch, or contours that follow the voice; times in beats at bpm. `rec` starts from 0, `rec t` from beat t, `ovr t` over only what the take covers, `stop` ends |
| `follow [ahead] [band] [hmm\|dtw] [descriptor …]` | a performer followed through a tree (discussion #204): Hz from `pitch~` on the left, onsets from `onset~` in the middle, the tree (from a `tree` box) on the right; `start`, `stop`. Each note heard is matched with a note a little ahead of where the performer was (with `hmm`, a probability is kept for every note instead, as in Antescofo: a doubtful sound does not lose the place, and a wrong step is undone when the next sounds point back; with `dtw`, frame by frame — online DTW, as Dixon's MATCH — what it hears against what the score should sound like, timed by the work's last take, without detecting notes), by its pitch (an octave off still counts) and by when it was expected at the performer's tempo; wrong notes and ornaments pass, skipped notes are skipped. Out: the written beat where the performer is, `[:note id]`, what each wire sends when it goes on — wires are written on their notes (`[:note {… :wire {:send :swell :kind :elastic :tol 0.5}}]`, or `(wire! :bN note :swell {…})`): rigid on its note (or caught up once at the next note found), elastic on its note if the performer gets there in time and else on its own at the expected time plus its tolerance, or led by the electronics at that time whatever the performer does —, and at `stop` the take — where each note was played, and with descriptors named after its numbers (`follow rms centroid chroma`: an inlet each, from `features~` or `chroma~`) what each note sounded like, their means while it sounded (`:profile`) — as `[:take {…}]`; with descriptors, notes are also matched by how they sound (by the notation's chroma, or by what `(learn! :bN)` learned from the takes), and a sound without a pitch — a multiphonic, a noise — is found by that alone: into the tree box it is kept only for you (`[:take … :work]` in the tree), and its continuum can show it |
| `paths [sure]` | an open form (discussion #212, [Study 70](../../studies/70-open/)): a work of fragments and rules of succession, `[:open {:start :any :end {:repeat 3}} [:frag {:id :A :next :any :not #{:B} :near 6 :then {:tempo 1.5 :dyn "pp"}} …notes…] …]`, from a `tree` box on the left, the performer choosing the path. Choose by hand (`[:choose :A]`, `:next` for one at random, `:back`, `:reset`), or `start` and play: Hz from `pitch~`, onsets from `onset~`, or MIDI notes (numbers, or `midiin`) — every fragment that can come next is a hypothesis, its opening aligned with what is heard (wrong, missed and added notes allowed), and the one it is sure of (p ≥ sure, 0.9) is taken: the follower decides the form. Out: the fragment chosen, it as a tree to play with the indications the one before left (tempo, dynamics, touch), what can come next, and at `stop` the performance read again whole, `[:performance {:path :live :notes}]`, kept as a branch |
| `form~ [seconds] [step] [kernel]` | how alike the moments of what arrives are (a chroma, mfcc, onset~'s envelope) over the last seconds (20): a self-similarity matrix of one frame every step (0.25 s), drawn; the novelty of each frame (how much the music changes there), a bang and `[:segment {:t :at :length :period}]` where a segment begins, and the period that repeats most, in seconds. `[:seconds x]` `[:step x]` `[:kernel x]` change it, `clear` forgets |
| `realize~ [settings] [midi]` | plays a `faust~` from descriptors ([Study 37](../../studies/37-notation/)): loudness (dB or a level), brightness (Hz), noisiness (0…1) and pitch (Hz, or MIDI with `midi`) in, `[:slider value]` for the `faust~` out — its `pitch`/`freq` and `gain` sliders follow pitch and loudness, the others take the settings of that `faust~` that sound nearest. It learns the `faust~` its outlet reaches first (steady settings played offline and heard, `@kairotic/faust-units`' `notation.mjs`), on the first values or `learn`. With `features~` of the `faust~`'s sound on its last three inlets (rms, centroid, flatness heard) it listens to what it plays and corrects what it asks, little by little. On the right, how far the nearest setting is (above 1: beyond that `faust~`) |
| `monitor [seconds] [name …]` | whatever arrives, drawn over the last seconds (6), one lane per inlet: a lane for each name written (`monitor 6 rms centroid chroma` has 3 inlets), or one. A number is a line in the range it has had in the window, a list of numbers a strip with a row per element (chroma, mfcc), a bang or a word a mark. It sends nothing |

Each sends only what changed. `pitch~` runs YIN in its own AudioWorklet; the others take frames of 2048
samples through the Kairotic API (`api/tap`) and compute them with
[Meyda](https://meyda.js.org) (MIT), loaded from jsDelivr the first time one is used.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "pitch~ 80 1000" 40 90)
(box :b3 "ftom" 40 150)
(box :b4 "print" 40 200)
(connect :b1 0 :b2 0) (connect :b2 0 :b3 0) (connect :b3 0 :b4 0)
```

To watch what a sound does over time, several descriptors side by side:

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "features~ 20 rms centroid" 40 90)
(box :b3 "chroma~" 260 90)
(box :b4 "monitor 6 rms centroid chroma" 40 160)
(connect :b1 0 :b2 0) (connect :b1 0 :b3 0)
(connect :b2 0 :b4 0) (connect :b2 1 :b4 1) (connect :b3 0 :b4 2)
```

An improvisation into notation: `adc~` → `pitch~` → `transcribe` → `freqt`, with `onset~` on the right
of `transcribe` (its second outlet, the strength: each note is then written with the weight of its attack); `rec`,
play, `stop`; then a `quantize` box (the freqt's second outlet on its right inlet; `:time :track` to find its beats, a bang)
writes it in measures as a tree for a `tree` box — or `(track! :bN)` and `(view :bN :score)` on the freqt to preview it, or `(keep! …)` and
`mt`.

The form of what is played, and onsets that adapt to it: `form~` on a `chroma~`, its fourth outlet into
`onset~` (each `[:segment …]` makes `onset~` forget the usual change of the section before, so a quiet
section after a loud one is heard), or into a message box that sends `onset~` a `[:threshold x]` of its own.
The SSM, novelty and beat spectrum are those of the core (`kairotic.structure`, issue #120), in the API for any
component: `api/ssm`, `api/novelty`, `api/novelty-at`, `api/beat-spectrum`, `api/periods`, `api/boundaries`, and
`api/note-frames` for notes (a take, a tree) instead of sound.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "chroma~" 40 90)
(box :b3 "onset~" 200 90)
(box :b4 "form~" 40 150)
(connect :b1 0 :b2 0) (connect :b1 0 :b3 0)
(connect :b2 0 :b4 0) (connect :b4 3 :b3 0)
```

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).
