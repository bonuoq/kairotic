# Kairotic official packages

*[Leer en castellano](README.es.md)*

Components that are not structural live outside the core, in packages by category, published on
npm under the scope `@kairotic` and served inside claude.ai by jsDelivr.

| Package | Classes |
|---|---|
| [`@kairotic/synth`](synth/) | `adsr~ [a d s r]` an envelope that follows a gate · `synth~` a polyphonic synthesizer · `gendy~ [freq x-step y-min y-max y-step breakpoints]` a dynamic stochastic oscillator, after Xenakis |
| [`@kairotic/spatial`](spatial/) | `pan~ [position]` stereo panning · `space~ [x y]` binaural placement around the listener |
| [`@kairotic/controls`](controls/) | `knob [min max initial] [log] [name]` a rotary control with its own view in the patch · `keyboard [low keys] [hold]` a virtual MIDI keyboard with velocity and chords, for synth~ and faust~ |
| [`@kairotic/analysis`](analysis/) | `features~ [ms] [descriptor …]` descriptors (rms, centroid, flatness, mfcc… with Meyda) · `pitch~ [lo hi]` the pitch, by YIN · `onset~ [threshold] [ms]` the beginnings of sounds · `chroma~` the 12 pitch classes · `spectrum~ [lo hi]` the spectrum, drawn · `transcribe [bpm] [notes|glide]` what pitch~ hears, into a freqt · `monitor [seconds] [name …]` any stream of messages, drawn over time |
| [`@kairotic/data`](data/) | `fetch [json\|text\|edn] [live]` what is at a URL, brought in as a task and kept in the work · `edn [width height]` any value as a tree to open, read and pick from |
| [`@kairotic/theory`](theory/) | `pcclock [notes]` a pitch-class set on the clock face, its prime form, interval vector and symmetries · `fourier [notes]` the six Fourier coefficients of a pitch-class distribution · `tonnetz [notes]` triads on the Tonnetz and the path of the harmony — all drawn in the patch, and clickable |
| [`@kairotic/patterns`](patterns/) | `pbind [seed] [repeat] [loop]` a pattern as EDN data, with `#pat/…` generators and seeded randomness · `pattern [seed] [repeat] [loop]` a pattern as Clojure code (lazy sequences, as in Overtone) · `player [bpm] [quant]` plays one by its own clock, step by step, or at a position in beats |
| [`@kairotic/spectral`](spectral/) | `shift~ [factor …]` pitch shifting in real time, one interval or a whole chord (ratios, semitones, cents), with the formants kept — stftPitchShift in WebAssembly |

Planned: `cac`, `notation`.

## In a work

Writing a class of a package (`adsr~ 20 300 0.5 800`) in a work that does not have it brings the
whole package into the work, as **one** `component` box pinned to its version. The work stays
complete and sounds the same even if the package changes later. You can also bring one by hand:

```clojure
(packages)                         ; the official packages and their classes
(add-package! "@kairotic/synth")
(import! "npm:@kairotic/synth@0.2.0/dist/index.mjs")
```

## Writing for a package

One file per component in `<package>/src/`, a ClojureScript expression that evaluates to a definition
(often `(let [helpers …] {…})`). It uses the core only through the [Kairotic API](../core/kairotic/api.cljs),
`api/…`, and carries its own AudioWorklet code if it needs one (`api/worklet-node`). What is too big to travel
in a source, such as a WebAssembly, goes in `<package>/assets/`: the build copies it into `dist/`, and the
component loads it with `api/import-module` from npm at the package's own version (the build checks that
the version it names is the package's), falling back on the page's copy (`kairotic/packages/<package>/`). Each package
declares the API version it was written for (`"kairotic": {"api": 1}` in its `package.json`).

```sh
node packages/build.mjs          # every package → <package>/dist/{<component>.mjs, index.mjs}
node packages/build.mjs synth    # one
```

`dist/index.mjs` is the whole package (what a work imports); `dist/<component>.mjs` is each component
on its own, for `(import! …)` of a single class.

## Publishing

A GitHub release with the tag `<package>-vX.Y.Z` (`synth-v0.1.0`) publishes that package
([workflow](../.github/workflows/publish-packages.yml)), with trusted publishing (no tokens). npm
only lets a trusted publisher be set on a package that exists, so the first version of each package
is published by hand once.

Licence: [MPL-2.0](../LICENSE).
