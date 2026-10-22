# Kairotic official packages

*[Leer en castellano](README.es.md)*

Components that are not structural live outside the core, in packages by category, published on
npm under the scope `@kairotic` and served inside claude.ai by jsDelivr.

| Package | Classes |
|---|---|
| [`@kairotic/synth`](synth/) | `adsr~ [a d s r]` an envelope that follows a gate · `synth~` a polyphonic synthesizer |
| [`@kairotic/spatial`](spatial/) | `pan~ [position]` stereo panning · `space~ [x y]` binaural placement around the listener |
| [`@kairotic/controls`](controls/) | `knob [min max initial] [log] [name]` a rotary control with its own view in the patch · `keyboard [low keys] [hold]` a virtual MIDI keyboard with velocity and chords, for synth~ and faust~ |
| [`@kairotic/analysis`](analysis/) | `features~ [ms] [descriptor …]` descriptors (rms, centroid, flatness, mfcc… with Meyda) · `pitch~ [lo hi]` the pitch, by YIN · `onset~ [threshold] [ms]` the beginnings of sounds · `chroma~` the 12 pitch classes · `spectrum~ [lo hi]` the spectrum, drawn · `transcribe [bpm] [notes|glide]` what pitch~ hears, into a freqt · `monitor [seconds] [name …]` any stream of messages, drawn over time |

Planned: `cac`, `notation`.

## In a work

Writing a class of a package (`adsr~ 20 300 0.5 800`) in a work that does not have it brings the
whole package into the work, as **one** `component` box pinned to its version. The work stays
complete and sounds the same even if the package changes later. You can also bring one by hand:

```clojure
(packages)                         ; the official packages and their classes
(add-package! "@kairotic/synth")
(import! "npm:@kairotic/synth@0.1.1/dist/index.mjs")
```

## Writing for a package

One file per component in `<package>/src/`, a ClojureScript expression that evaluates to a definition
(often `(let [helpers …] {…})`). It uses the core only through the [Kairotic API](../core/kairotic/api.cljs),
`api/…`, and carries its own AudioWorklet code if it needs one (`api/worklet-node`). Each package
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
