# kairotic-components

> **Deprecated.** Replaced by [`@kairotic/controls`](../packages/README.md) (`knob`); `fifth` and `drift` were small examples for the studies and are not carried on. Kept for the works of Studies 9–23. The app no longer uses it and no more versions are published.

*[Leer en castellano](README.es.md)*

Components for [Kairotic](../README.md). Each component is a file `src/<name>.cljs` whose source
is a ClojureScript definition with the same contract as the core ones, written in sections
(about · arguments · logic · view). See the guide [Writing a component](../docs/writing-a-component.md).

`npm run build` generates `dist/<name>.mjs` (`export default {class, version, author, license, doc, source}`)
and `dist/index.mjs`. Inside claude.ai a page can only load JavaScript modules from npm through
jsDelivr, so this is the published format. In a work:

```clojure
(import! "npm:kairotic-components@0.1.2/dist/knob.mjs")
```

Importing **copies** the definition into a `component` box of the work (with a header saying where
it came from): the work stays complete and sounds the same even if the package changes.

## Components

| class | what it does |
|---|---|
| `knob` | rotary control with its own view: linear or logarithmic range, optional parameter name |
| `fifth` | adds a just fifth above every frequency, as a voice of its own |
| `drift` | detunes every frequency with a slow random walk, different for every voice |
| `keyboard` | virtual MIDI keyboard: press and release with the mouse, velocity, ⇧ chords, `hold`; outlets Hz, voice ids, gate and gain (for synth~ and faust~) |


## Licence

MPL-2.0 (see [LICENSE](../LICENSE)). Every component declares its own with `:license`.
