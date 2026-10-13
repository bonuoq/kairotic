# Asking for a patch (Study 23)

*[Versión en español](ask.es.md)*

## In the Claude tab

The Claude tab now makes **patches** as well as components. Choose *A patch*, describe it — «a hello
world: a sine at 440 Hz with a volume knob» — and **Make it**. With *change the open patch* checked
(the default), Claude gets the open patch and changes it: «now add a knob that does FM synthesis».

Claude answers with the patch's code, the same calls a link carries (`box`, `connect`, `code`,
`present`, `tree!`…). Before answering it checks it with the page's own tools:

- `list_classes` and `class_help`: which classes exist, what each inlet takes and each outlet sends;
- `check_faust`: for sound the core classes do not make (FM, filters, effects), a `faust~` box whose
  parameters are driven by named knobs (`knob 50 2000 440 log carrier` sends `[:carrier v]`);
- `check_patch`: the whole code — only patch calls, classes that exist, lines between ports that exist,
  every Faust source compiled and every component evaluated.

The page checks it again, and the patch loads as **one event of the history**: you can go back, branch
or merge as with any other gesture. From the REPL: `(ask-patch "…")`, `(ask-patch "…" false)` for a
new patch.

## Links that carry a description: `?ask=`

```
https://bonuoq.github.io/kairotic/?embed&ask=a hello world with a sine at 440 Hz and a knob that does FM
```

The link carries **what to make, never a key**. Whoever opens it sees the description and **Make it
with Claude**: the patch is made with *their* Claude — their own Anthropic API key outside claude.ai
(saved only in their browser; inside an embed, only for that frame) or their account inside claude.ai.
Nobody spends anybody else's credit, and a key never lands in a Notion page, its history or a server.

What a browser made from a link stays in that browser: opening it again shows the same patch without
asking again (**Make it again** asks anew). **Copy the link of this result** gives a `?code=` link
with the patch in it: put it in place of the description, and everyone sees the same patch without
asking Claude.

`?ask=` can go with `?code=` or `?src=`: then Claude changes that patch. The Embed panel has a
*Carry a description instead* option, and the REPL `(ask-link "…")`, `(ask-link "…" :present)`.

## Safety

The patch Claude makes is read like a link (only patch calls, literal arguments). Its own scripts and
components run without asking, because you asked for them; the page's checks (Faust compiled,
components evaluated) happen before anything enters the work.
