# @kairotic/analysis

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

From any signal — an `adc~`, a `sample` played by a `reader~`, a `faust~` — into messages and pictures:

| Class | What it gives |
|---|---|
| `features~ [ms] [descriptor …]` | one outlet per descriptor written after it, every ms (20): `rms`, `energy`, `zcr`, `loudness`, `centroid` and `spread` (Hz), `flatness`, `rolloff` (Hz), `kurtosis`, `skewness`, `slope`, `crest`, `sharpness`, `perceptualSpread`, `mfcc` (13), `chroma` (12). Without words: `rms centroid flatness` |
| `pitch~ [lo hi] [threshold]` | the frequency in Hz (0 once when it stops hearing one) and how clearly periodic it is, by YIN, between lo and hi (60 – 1500 Hz) |
| `onset~ [threshold] [ms]` | a bang at the beginning of each sound (a note, a stroke, a syllable) and its strength |
| `chroma~ [ms]` | 12 values from C to B and the strongest pitch class as a word (`:a`, `:c#`…) |
| `spectrum~ [lo hi]` | the spectrum drawn in the patch, on a log scale of frequency |
| `transcribe [bpm] [notes\|glide] [ms]` | what `pitch~` hears (and `onset~` splits), written into a `freqt` as strokes: flat notes at their median pitch, or contours that follow the voice; times in beats at bpm. `rec` starts from 0, `stop` ends |

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

An improvisation into notation: `adc~` → `pitch~` → `transcribe` → `freqt`, with `onset~` on the right
of `transcribe`; `rec`, play, `stop`; then `(view :bN :score)` on the freqt, or `(keep! …)` and `mt`.

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).
