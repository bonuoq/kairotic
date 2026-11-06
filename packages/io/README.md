# @kairotic/io

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

Kairotic talking to the outside (discussion [#135](https://github.com/bonuoq/kairotic/discussions/135),
first tried in Study 34 · io). Whatever comes in or goes out is **one kind of event**: an EDN map in the
shape of a pattern event, with pitch as `:freq` in Hz, so a patch never needs to know where a message came
from — `midiin` can feed `synth~` or `oscout`, a phone's tilt can glide an MPE synthesizer.

```clojure
{:src :midi :type :note :id 60 :ch 1 :note 60 :freq 261.626 :amp 0.79 :gate true}
{:src :midi :type :glide :id 60 :freq 266.1}          ; a pitch bend moves the notes of its channel
{:src :midi :type :cc :ch 1 :cc 74 :value 0.42}
{:src :osc :type :osc :address "/synth/cutoff" :args [1200] :from "127.0.0.1:57120"}
{:src :motion :type :tilt :x 0.62 :y 0.48}
{:src :gamepad :type :button :pad 0 :button 0 :name :a :value 1 :gate true}
{:src :serial :type :serial :key "pot" :value 512}
```

| Class | What it does |
|---|---|
| `midiin [channel] [range]` | MIDI from every input of the page as events; out: the Hz of the notes sounding and their voice ids (as a keyboard or a player, for `synth~` or a polyphonic `faust~`) and every event. A bend glides the notes of its channel; an MPE controller's bend range (RPN 0) is read |
| `midiout [mpe] [channel] [port] [range]` | notes and events to a MIDI port: what sounds as a player sends it (Hz after voice ids), or events. With `mpe`, a channel per note and its exact Hz as key + bend: microtones and glides without rounding |
| `oscout [target]` | events as `/kairotic/note id freq amp gate`, `/kairotic/glide`, `/kairotic/cc`, `/kairotic/tilt`…, or a list that starts with an address as it is — through a relay's OSC bridge |
| `oscin [pattern]` | OSC from the bridge as events (the `/kairotic/…` addresses) or `{:type :osc …}`; an OSC address pattern (`/synth/*/cutoff`, `{note,glide}`) keeps some |
| `motion [smooth] [shake]` | a phone's tilt as `[x y]` (0…1, flat 0.5), smoothed and sent only when it moves, and its shakes |
| `gamepad [pad] [deadzone]` | a controller's buttons (with a gate when pressed or let go) and sticks (−1…1, without their dead zone), by name with the standard mapping |
| `serial [baud]` | a board on a serial port (Web Serial): `open` asks for the port; lines of numbers or `key:value` go out as values and events; a text on the left goes to the board |

```clojure
(box :b1 "midiin" 40 30)
(box :b2 "midiout mpe" 40 90)
(box :b3 "oscout" 180 90)
(connect :b1 0 :b2 0) (connect :b1 1 :b2 1) (connect :b1 2 :b3 0)
```

## While ▶ runs

Input from outside is like sound: `midiin`, `oscin`, `motion`, `gamepad` and `serial` listen while ▶
runs, and so `midiout` sends (on the audio clock: a note of a player goes out at its time). `oscout` sends
with or without ▶, as a message.

## Where each works

| | Chrome, Edge | Firefox | Safari, iOS |
|---|---|---|---|
| MIDI (Web MIDI) | ✓ (asks once) | ✓ (asks once) | — |
| OSC (relay bridge) | ✓ | ✓ | the page may not reach `ws://localhost` from https |
| motion | ✓ on phones | ✓ on phones | ✓ (asks at ▶) |
| gamepad | ✓ | ✓ | ✓ |
| serial (Web Serial) | ✓ | 151+ | — |

**OSC** needs a relay with the bridge on the same machine as SuperCollider, Max or Pd:
`npx @kairotic/relay --osc` (pages on `ws://localhost:8765/osc`, OSC out to sclang on 57120, OSC in on
57121; see [relay/README.md](../../relay/README.md#osc-bridge)). `[:relay "ws://…/osc"]` to an `oscin` or
`oscout` changes the bridge for the page.

Writing one of its classes in a work brings the package into it. Licence: [MPL-2.0](../../LICENSE).
