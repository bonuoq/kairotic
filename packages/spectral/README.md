# @kairotic/spectral

*Part of [Kairotic](https://github.com/bonuoq/kairotic) · [the official packages](../README.md)*

Components that work on the spectrum of a sound.

| Class | What it does |
|---|---|
| `shift~ [factor …]` | pitch shifting in real time: the signal transposed by every factor at once (one interval or a whole chord), with the formants kept if asked, one frame (1024 samples) late |

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "shift~ 1 5/4 3/2" 40 100)     ; a just major triad over what comes in
(box :b3 "dac~ 1 2" 40 170)
(connect :b1 0 :b2 0) (connect :b2 0 :b3 0) (connect :b2 0 :b3 1)
```

A factor is a ratio (`1.5`, `3/2`), semitones with a sign (`+7`, `-12`, `+0`) or cents (`386c`). Messages:
a list of factors (the chord) · `[:semitones 0 4 7]` · `[:cents 0 386 702]` · `[:transpose st]` (every
factor at once: a glide without retyping the chord) · `[:formants q]` / `[:formants q t]` (a lifter of
`q` ms keeps the formants, 1 is a good start for a voice; `t` shifts them) · `[:rms 1]` · `[:dry x]`.

## Inside

The shifting is [stftPitchShift](https://github.com/jurihock/stftPitchShift) 2.0 by Jürgen Hock (C++,
MIT), compiled to WebAssembly with wasi-sdk ([native/](native/README.md)). The WebAssembly travels in
`dist/shift.mjs` (about 115 KB), not in the source of the component, so it does not weigh on the history
of a work: `shift~` loads it from npm, at the version of the package, the first time it sounds, or the
page's own copy (`kairotic/packages/spectral/shift.mjs`), and hands it to its AudioWorklet as bytes. With a
three-note chord and the formants kept it takes about 5% of a core. Studies 28 (offline, a buffer with
its recipe) and 29 (real time) tried it first.

```sh
node packages/spectral/native/build.mjs    # the WebAssembly → assets/shift.mjs (and the two studies)
node packages/build.mjs spectral           # the package → dist/ (assets/ copied as they are)
```

Planned: an offline `shift` that writes a new buffer with its recipe beside it (Study 28), once the API
lets a package keep sounds.

Licence: the components MPL-2.0 (`shift~` itself MIT, as the library it is made with).
