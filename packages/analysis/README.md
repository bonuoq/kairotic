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
| `transcribe [bpm] [notes\|glide] [ms]` | what `pitch~` hears (and `onset~` splits), written into a `freqt` as strokes: flat notes at the pitch they hold longest, or contours that follow the voice; times in beats at bpm. `rec` starts from 0, `rec t` from beat t, `ovr t` over only what the take covers, `stop` ends |
| `form~ [seconds] [step] [kernel]` | how alike the moments of what arrives are (a chroma, mfcc, onset~'s envelope) over the last seconds (20): a self-similarity matrix of one frame every step (0.25 s), drawn; the novelty of each frame (how much the music changes there), a bang and `[:segment {:t :at :length :period}]` where a segment begins, and the period that repeats most, in seconds. `[:seconds x]` `[:step x]` `[:kernel x]` change it, `clear` forgets |
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
play, `stop`; then `(track! :bN)` to find its beats and bars, `(view :bN :score)` on the freqt, or `(keep! …)` and
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
