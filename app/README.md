# @kairotic/app

The Kairotic app (index.html, the ClojureScript of `app/page` and `core/kairotic`, the official packages, docs and
tutorials) as built by `site/build.mjs`, published so that the Kairotic artifact on claude.ai can stay a thin shell
(`site/shell.html`) that loads the current app from jsDelivr instead of carrying a copy of it.

`sources.mjs` holds, as strings, every file the page reads with `fetch` (a page on claude.ai may import modules from
cdn.jsdelivr.net/npm but not fetch files there); the `.mjs` files are imported from their own URL.

Not meant to be installed. The app itself: <https://github.com/bonuoq/kairotic>.
