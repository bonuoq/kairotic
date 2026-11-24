# Contributing to Kairotic

*[Leer en castellano](CONTRIBUTING.es.md)*

Thank you for wanting to help. Kairotic is a young project (alpha): components, studies, documentation,
translations, tests and bug reports are all welcome. Before you start, please read the
[Code of Conduct](CODE_OF_CONDUCT.md) and [How Kairotic is built](docs/how-kairotic-is-built.md).

## Ideas, questions, bugs

| You have… | Go to |
|---|---|
| an idea, a proposal, a new direction | [Discussions → Ideas](https://github.com/bonuoq/kairotic/discussions/categories/ideas) |
| something you made (a work, a patch, a component) | [Discussions → Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery) |
| a question about how something works | [Discussions → Q&A](https://github.com/bonuoq/kairotic/discussions/categories/q-a) |
| a bug: something that does not do what the docs say | [Issues](https://github.com/bonuoq/kairotic/issues/new/choose) |
| a new component you want to write or see | [Issues → New component](https://github.com/bonuoq/kairotic/issues/new/choose) |
| a security problem (above all in the relay) | **not** a public issue: see [SECURITY.md](SECURITY.md) |

Ideas are discussed before they are built: the direction of the project is decided in the open, in
Discussions. A pull request for a large change without a discussion behind it may be asked to start one.
Discussions are written in English so that everyone can follow them.

## Setting up

Kairotic is static: ClojureScript interpreted in the browser by [Scittle](https://github.com/babashka/scittle),
dependencies from a CDN and WebAssembly. There is no compiler and no `npm install` for the app itself.

You need [Node](https://nodejs.org) 22 (what CI uses; 18 or later works for most scripts), git, and a
recent Chromium, Firefox or Safari.

```sh
git clone https://github.com/bonuoq/kairotic.git
cd kairotic
node site/build.mjs                    # → _site/ (the Pages edition) and _artifact/ (the claude.ai edition)
cd _site && python3 -m http.server 8000
# http://localhost:8000              the app
# http://localhost:8000/tests.html   the tests, in your browser
```

`site/build.mjs` builds the packages (`packages/build.mjs`), Claude's examples (`examples/build.mjs`) and
the tutorials first. Any static server works in place of Python (`npx http-server _site -p 8000`).

To run a relay of your own (rooms, OSC): `cd relay && npm install && npm start`. See [relay/](relay/README.md).

## Running the tests

Every change comes with its tests, and the tests pass before it is merged. CI runs them on every pull
request ([tests.yml](.github/workflows/tests.yml), [studies.yml](.github/workflows/studies.yml),
[headers.yml](.github/workflows/headers.yml)); run them locally first:

```sh
# quick checks, in Node (seconds)
node tests/spdx.mjs          # every source file starts with its SPDX licence header
node tests/licences.mjs      # data under another licence (the chorales) kept out of the app and the packages
node tests/names.mjs         # every top-level name of the page defined once
node tests/versions.mjs      # every official package pinned by the page to its package.json version
node tests/keywords.mjs      # orders are keywords, never strings
node tests/counterpoint.mjs && node tests/rules.mjs && node tests/export.mjs

# the app's tests in a headless Chromium
node site/build.mjs
npm install --no-save playwright@1.56.0 && npx playwright install chromium
npx http-server _site -p 8000 -s &
node tests/browser.mjs http://localhost:8000/tests.html

# the studies' own test pages (the repository served at its root)
npx http-server . -p 8000 -s &
node tests/studies.mjs http://localhost:8000/ [study…]
```

The app's tests live in `tests/cljs/*.cljs` (ClojureScript, run in the page) and `tests/*.mjs` (the
browser driver and the Node checks). A study keeps its own tests in `studies/NN-name/tests/*.html`.

## Conventions

- **English in the code.** Names, classes, messages, comments and the interface are in English, with no
  aliases in other languages. Documentation, examples and tutorials are written in English and Spanish
  (`file.md` and `file.es.md`); if you can only write one, write it and say so in the pull request.
- **Names from `clojure.core`.** When a box does what a Clojure function does, it takes that function's
  name (`map`, `reduce`, `partition`…) rather than a Max-style name. Transformations of trees follow
  Clojure's vocabulary too.
- **Orders are keywords.** A box receives `:bang`, `:stop`, `:clear`… never `"bang"`
  ([tests/keywords.mjs](tests/keywords.mjs) checks it).
- **Pitches in Hz** by default, MIDI with a `midi` option. Notation components return trees.
- **Data first.** A work is EDN; every gesture is an event written as code. Components are maps of data
  and pure functions, written in sections (about · arguments · logic · view), using the core only through
  the [Kairotic API](core/kairotic/api.cljs). See [Writing a component](docs/writing-a-component.md).
- **Static.** No build step for the app: ClojureScript through Scittle, libraries from a CDN at a pinned
  version, WebAssembly for heavy kernels. JavaScript only where it has to be (DSP, worklets, kernels).
- **Graphics in SVG.** Components draw in SVG; WebGL only for the single background canvas of the patch,
  where it is really needed.
- **Studies before the app.** A new idea is tried first as a study (`studies/NN-name/`: one page, its
  kernel, its tests), and moves into a package or the core once it has proved itself. Build on what
  is there (the counterpoint kernels, the rules engine) rather than starting anew.
- **One behaviour, not two.** While Kairotic is in alpha, behaviours are unified even when that breaks
  older patches; say so in the Changelog.
- **Licence headers.** Every source file starts with `SPDX-License-Identifier: MPL-2.0` in a comment
  (after `<!DOCTYPE html>` in a page); [tests/spdx.mjs](tests/spdx.mjs) checks it. A component also
  declares its licence with `:license`.
- **Packages.** A change to a package bumps its version in `package.json`, and the page's pin with it.
- **Changelog.** Add a line under *Unreleased* in [CHANGELOG.md](CHANGELOG.md).
- **Commits.** A short subject saying what changes (`rhythm: vary redraws below a metrical depth`), the why
  in the body, the discussion or issue it belongs to (`#353`).

## Pull requests

1. Fork, and make a branch from `main`.
2. Make the change with its tests and its documentation; run the tests.
3. Sign off every commit (see below).
4. Open the pull request and fill in its template. Draft pull requests are welcome for early feedback.

A maintainer reviews it; once the checks pass it is merged.

## Developer Certificate of Origin (DCO)

Kairotic does not ask for a contributor licence agreement. Instead, every commit carries a
`Signed-off-by` line, by which you certify the [Developer Certificate of Origin 1.1](https://developercertificate.org/):
in short, that you wrote the change or have the right to submit it under the project's licence
(MPL-2.0 for code, CC BY-SA 4.0 for documentation).

```sh
git commit -s -m "theory: tonnetz draws the path of a progression"
# adds: Signed-off-by: Your Name <you@example.com>
```

The name and email must be those of the commit's author (your `git config user.name` and `user.email`).
Forgot it? `git commit --amend -s` for the last commit, or `git rebase --signoff main` for the whole branch,
then `git push --force-with-lease`.

**Commits written with an AI assistant.** You may use one (Kairotic itself is built with Claude Code,
see [How Kairotic is built](docs/how-kairotic-is-built.md)), and you stay responsible for what you submit.
Commit under **your own** Git identity: you are the author and you sign off. The assistant is credited
with a trailer, never as the author:

```
Co-Authored-By: Claude <noreply@anthropic.com>
Signed-off-by: Your Name <you@example.com>
```

If an assistant made commits under its own identity, take them over before you push — this makes you
their author and signs them off, keeping their messages and trailers:

```sh
git rebase origin/main --exec 'git commit --amend --no-edit --reset-author --signoff'
git push --force-with-lease
```

The [DCO check](.github/workflows/dco.yml) runs on every pull request and names any commit that has no
sign-off, whose sign-off is not its author's, or whose author is an AI assistant. Like any DCO check it
reads what commits say about themselves: the certification is yours.

## Licence

By contributing you agree that your contribution is licensed as the rest of the project: code under the
[Mozilla Public License 2.0](LICENSE), documentation under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Works you make with Kairotic remain yours.
