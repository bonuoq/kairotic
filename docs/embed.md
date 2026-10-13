# Embedding Kairotic (Study 22)

*[Versión en español](embed.es.md)*

A patch, a tutorial step or a help patch can live inside another page — a Notion page, a blog, a
course — and still play there.

## Making the link

In the editor, **Embed** (next to Present) opens a panel with two choices:

- **Patch**: the patch, scaled to fit the frame, with ▶ ■, the lesson bar if it is a tutorial, and
  **Kairotic ↗**, which opens the same thing in the whole editor.
- **Presentation, fullscreen**: only the presented boxes (see `(present :bN x y)`), filling the frame,
  with small controls in a corner (▶ ■ ⛶ ↗) that fade while you play. The first touch starts the sound.
  Without presented boxes, the whole patch.

The panel gives the **link** and an **iframe**. From the REPL: `(embed-link)` and
`(embed-link :present)` print both and copy the link.

What the link carries depends on what is open: a tutorial at a step (`?tutorial=work-tree&step=2`), a
help patch (`?help=mt`) or, otherwise, **the patch itself** (`?code=…`, its code compressed). A patch
link is a copy of that moment, not the live work.

## In Notion

Type `/embed`, paste the link, and resize the block. In other pages, paste the iframe. The iframe
has `allow="fullscreen"`; where a page does not allow fullscreen inside its frames, ⛶ opens the
presentation in a tab of its own.

## Addresses

| | |
|---|---|
| `?code=…` | a patch (deflate-raw + base64url) |
| `?tutorial=id&step=n` | a tutorial at step n |
| `?help=class` | the help patch of a class |
| `?lang=es` / `?lang=en` | the language of lessons and help |
| `?embed` | only the patch |
| `?present` | only the presentation, filling the window |

Without `embed` or `present` the same addresses open in the whole editor, as a local work: from
Sessions it can be copied into a solo work or a room.

## Safety

An embed works on its own: no relay, nothing saved, no Claude. The code in a link is read as data
and only the calls a patch is made of go through (`box`, `connect`, `present`, `code`, `stroke`,
`axis`, `tree!`, `inside`…), with literal arguments: a link cannot run code in the page. Its script and
component boxes wait, as in a shared room, until whoever opened it presses **Run them** — except
definitions that are exactly an official package or component as the page brings it, which run
without asking (also in rooms).

There is a test page with three frames at [embed-test.html](https://bonuoq.github.io/kairotic/embed-test.html).
