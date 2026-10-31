# @kairotic/faust-units

Faust's own elements as boxes: the **patch view of a Kairotic `faust~` box**, kept in sync with its code
both ways (discussion [#115](https://github.com/bonuoq/kairotic/discussions/115),
[Study 31](../../studies/31-units/)). This package carries modules for the page, not box classes: the
app loads them from npm at the version it pins (`module-packages` in `core/kairotic/library.cljs`), or
from its own copy.

| Module | What it does |
|---|---|
| `units.mjs` | the boxes: primitives (`+ - * / % ^ < > min max sin cos tanh abs sqrt exp log floor select2 ' @`), controls (`hslider nentry button checkbox`), library functions (`os.osc os.sawtooth os.square os.triangle no.noise fi.lowpass fi.highpass fi.resonlp en.adsr en.ar ba.db2linear ba.midikey2hz si.smoo de.delay ma.SR ma.PI`), `in` and `out`; numbers after a box's name fill its inlets the way Faust fills arguments |
| `graph.mjs` | patch → code: one definition per box, in the order signals flow back from the outputs; a loop goes through the one-sample delay `'` and is written with `~`; the layout travels in a last comment |
| `parse.mjs` | code → patch: Faust's block-diagram algebra (`: , <: :> ~`, infix operators, partial application, `with`, `letrec`); what the boxes do not know becomes a box of Faust code, with the inputs and outputs the compiler finds |
| `view.mjs` | the pane: `mount(host, { code, onCode, loadFaust })` → `{ setCode, destroy }` |

The round trip (code → boxes → code, compiled and run sample by sample) is tested by
[`studies/31-units/tests/roundtrip.mjs`](../../studies/31-units/tests/roundtrip.mjs).

Licence: [MPL-2.0](../../LICENSE).
