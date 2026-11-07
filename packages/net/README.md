# @kairotic/net

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

Kairotic in a shared room (discussion [#135](https://github.com/bonuoq/kairotic/discussions/135), tried in
Studies 34 and 36). The pages of a room are connected to each other directly (WebRTC, through the
relay's `/signal`: the **Room** tab), and these boxes use that connection: values shared on channels, and
**one tempo for the whole room**, the same beat on every page from the room's clock — whatever each
computer's clock says.

| Class | What it does |
|---|---|
| `share [channel]` | what arrives goes to everyone in the room on that channel (`main` if none): any value, an event, a list; in order, with or without ▶. A message of the moment: the history does not keep it |
| `shared [channel]` | what anyone in the room shares on that channel — this page included —, while ▶ runs; on the right, who shared it |
| `pulse [division]` | the room's beat, while ▶ runs: the count of each pulse on the audio clock (division 1 beats, 2 eighths, 0.25 bars of four), the bpm on the right; `start [bpm]`, `stop`, `bpm n` change the tempo for everyone |

```clojure
;; on one page: a keyboard that others play
(box :b1 "midiin" 40 30)
(box :b2 "share notes" 40 80)
(connect :b1 2 :b2 0)
;; on another: what the first one plays, on its own synth~
(box :b3 "shared notes" 40 30)
(box :b4 "synth~" 40 80)
(connect :b3 0 :b4 0)
```

The Room tab shows the tempo, starts and stops it for everyone, and has a metronome. Outside a shared
room the boxes work for this page alone. Values travel as EDN (at most 60 KB each).

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).
