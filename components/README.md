# kairotic-components

*[Leer en castellano](README.es.md)*

Components for [Kairotic](../README.md). Each component is a file `src/<name>.cljs` whose source
is a ClojureScript definition with the same contract as the core ones, written in sections
(about · arguments · logic · view). See the guide [Writing a component](../docs/writing-a-component.md).

`npm run build` generates `dist/<name>.mjs` (`export default {class, version, author, license, doc, source}`)
and `dist/index.mjs`. Inside claude.ai a page can only load JavaScript modules from npm through
jsDelivr, so this is the published format. In a work:

```clojure
(import! "npm:kairotic-components@0.1.1/dist/knob.mjs")
```

Importing **copies** the definition into a `component` box of the work (with a header saying where
it came from): the work stays complete and sounds the same even if the package changes.

## Components

| class | what it does |
|---|---|
| `knob` | rotary control with its own view: linear or logarithmic range, optional parameter name |
| `fifth` | adds a just fifth above every frequency, as a voice of its own |
| `drift` | detunes every frequency with a slow random walk, different for every voice |

## Publishing a version

1. Raise the version in `package.json`.
2. Create a GitHub release with the tag `components-vX.Y.Z` on `main`.
3. The `publish-components` Action builds `dist/` and publishes to npm with *trusted publishing*
   (OIDC, no tokens).

This package replaces `kairotic-componentes` (Spanish names, up to Study 8).

## Licence

MPL-2.0 (see [LICENSE](../LICENSE)). Every component declares its own with `:license`.
