# Kairotic official packages

*[Leer en castellano](README.es.md)*

Components that are not structural live outside the core, in packages by category, published on
npm under the scope `@kairotic` and served inside claude.ai by jsDelivr.

| Package | Classes |
|---|---|
| [`@kairotic/synth`](synth/) | `adsr~ [a d s r]` an envelope that follows a gate · `synth~` a polyphonic synthesizer · `gendy~ [freq x-step y-min y-max y-step breakpoints]` a dynamic stochastic oscillator, after Xenakis · `click~ [freq accent decay]` a metronome's click, the beats accented |
| [`@kairotic/spatial`](spatial/) | `pan~ [position]` stereo panning · `space~ [x y]` binaural placement around the listener |
| [`@kairotic/controls`](controls/) | `knob [min max initial] [log] [name]` a rotary control with its own view in the patch · `keyboard [low keys] [hold]` a virtual MIDI keyboard with velocity and chords, for synth~ and faust~ · `scale [in-lo in-hi out-lo out-hi] [log] [ms]` a number from one range to another, in equal ratios with log, gliding with ms, learning its input range |
| [`@kairotic/analysis`](analysis/) | `features~ [ms] [descriptor …]` descriptors (rms, centroid, flatness, mfcc… with Meyda) · `pitch~ [lo hi]` the pitch, by YIN · `onset~ [threshold] [ms]` the beginnings of sounds · `chroma~` the 12 pitch classes · `spectrum~ [lo hi]` the spectrum, drawn · `transcribe [bpm] [notes|glide]` what pitch~ hears, into a freqt · `follow [ahead] [band] [descriptor …]` a performer followed through a tree: where they are, its wires, the take and what each note sounded like · `paths [sure]` an open form: fragments and rules of succession, the path chosen by hand, played, or followed from what is heard · `form~ [seconds] [step] [kernel]` self-similarity: where segments begin, the period that repeats · `monitor [seconds] [name …]` any stream of messages, drawn over time |
| [`@kairotic/data`](data/) | `fetch [json\|text\|edn] [live]` what is at a URL, brought in as a task and kept in the work · `edn [width height]` any value as a tree to open, read and pick from |
| [`@kairotic/theory`](theory/) | `pcclock [notes]` a pitch-class set on the clock face, its prime form, interval vector and symmetries · `fourier [notes]` the six Fourier coefficients of a pitch-class distribution · `tonnetz [notes]` triads on the Tonnetz and the path of the harmony — the views drawn in the patch, and clickable |
| [`@kairotic/cac`](cac/) | composition assisted by computer: `cac partimento|judge` the voices over a bass, or the rules questioned, on a tree (2–4 parts) · `comes [system mode speed …]` counterpoint live — you play the dux and the comes answers, reading it at a speed (a canon, an augmentation, a crab or table canon), a note against the rules corrected to the nearest one that can be played, with its futuribles · the kernels every engine shares (`counterpoint.mjs`, `mirror.mjs`, `soft.mjs`, `partimento.mjs`: a given bass realized in two, three or four parts) |
| [`@kairotic/rhythm`](rhythm/) | `necklace [n] [fourier]` the rhythm box: a cyclic rhythm on the circle, drawn, edited and measured (interval vector, evenness, deep, flat, axes of symmetry, oddity, Fourier coefficients), written as a musical tree whose `:rtm` merges with any pitches · `euclid [k n rotation]` a generator of Euclidean rhythms (Bjorklund, after Toussaint), as pulses · `chance [k n seed]` k onsets drawn with a seed · `homometric` the other rhythms with the same interval vector · `swap` how far apart two rhythms are (Toussaint's swap distance) · `morph [ratio]` from one rhythm to another, swap by swap · `vary [d seed]` again but different: d swaps away, or redrawn below a metrical depth · `phase` where a performer is in a timeline, from the onsets heard |
| [`@kairotic/patterns`](patterns/) | `pbind [seed] [repeat] [loop]` a pattern as EDN data, with `#pat/…` generators and seeded randomness · `pattern [seed] [repeat] [loop]` a pattern as Clojure code (lazy sequences, as in Overtone) · `player [bpm] [quant]` plays one by its own clock, step by step, or at a position in beats |
| [`@kairotic/spectral`](spectral/) | `shift~ [factor …]` pitch shifting in real time, one interval or a whole chord (ratios, semitones, cents), with the formants kept — stftPitchShift in WebAssembly |
| [`@kairotic/io`](io/) | `midiin [channel] [range]` MIDI in as events, and Hz and voice ids for synth~ · `midiout [mpe] [channel] [port] [range]` notes to a MIDI port, MPE for microtones · `oscin [pattern]` · `oscout [target]` OSC through a relay's bridge · `motion` a phone's tilt and shakes · `gamepad` buttons and sticks · `serial [baud]` a board's lines (Web Serial) · `control kind [which]` one control (cc 74, pad lx, tilt x, osc /addr…) out of their events |
| [`@kairotic/net`](net/) | `share [channel]` a value to everyone in the room · `shared [channel]` what anyone in the room shares · `pulse [division]` the room's beat: one tempo for every page · `transport [smooth]` where that beat is, for a `player` (or a performer's beat) |
| [`@kairotic/faust-units`](faust-units/) | no classes: modules for the page — the patch view of a `faust~`, Faust's own elements as boxes, kept in sync with its code; the recipe of a `faust~` from a sound |
| [`@kairotic/rules`](rules/) | no classes: one constraint engine for every style (#353) — the core (count, draw, engine, judge), a catalogue of general rules with parameters, styles named, versioned and inheriting; today one voice over a bass, as `@kairotic/cac`'s `partimento.mjs` |

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
