# @kairotic/data

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

Data from outside the work, and a way to read any value. `fetch` brings in what is at a URL without
leaving the pure logic of a box (a **task**: the engine makes the request and gives the outcome back to
the box); `edn` shows any value as a tree, after [Portal](https://github.com/djblue/portal).

| Class | What it does |
|---|---|
| `fetch [json\|text\|edn] [live]` | a URL (a msg with it, a string, `[:fetch url]`, or `github:owner/repo@ref/path` through jsDelivr) brings in what is there: JSON read as EDN (keys that can be keywords become keywords), text or EDN. It goes out on the left and is **kept as the data of the box**: one gesture of the history, the same for everyone in a room, and going back in the history does not fetch again (a URL it already keeps is sent again, not fetched; `refresh` fetches it again). With `live` it is only held in this tab, for answers that change. `[:get k …]` sends a part of it; on the right, `:loading`, `:ready` or `[:error "…"]` |
| `edn [width height]` | any value as a tree: maps, vectors, sets and lists open and close (▸ ▾), each value coloured by its kind, a closed collection previewed on its line. Picking a line sends that part (left) and its path (right) — the path `fetch` takes as `[:get …]`. Dragging scrolls; `depth n` opens it n levels down |

```clojure
(box :b1 "msg github:bonuoq/kairotic@main/packages/data/package.json" 40 30)
(box :b2 "fetch" 40 80)
(box :b3 "edn 340 260" 40 150)
(box :b4 "print" 400 150)
(connect :b1 0 :b2 0) (connect :b2 0 :b3 0) (connect :b3 0 :b4 0)
```

Most sites refuse to be read by a page of another site (CORS): public APIs that allow it, files of a
public GitHub repository (`github:…`) and anything served by jsDelivr work. Inside claude.ai a page can
only reach jsDelivr, so there `github:…` is the way. What is kept travels in the history and in links:
at most 64 KB of it; beyond that it is still sent, and held only in that tab.

To write a component of your own that asks the world for something, see *From outside: tasks* in
[Writing a component](../../docs/writing-a-component.md).

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).
