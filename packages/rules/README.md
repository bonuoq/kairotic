# @kairotic/rules

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

One constraint engine for every style — discussion [#353](https://github.com/bonuoq/kairotic/discussions/353), and its
inventory of the rules Kairotic's engines hold, [`docs/rules.md`](../../docs/rules.md). No classes: modules for the
engines of [`@kairotic/cac`](../cac/) and the studies.

- **`rules.mjs`** — the core, `solve()`: voices advancing unit by unit, candidates from a system, **hard rules** that
  refuse with a reason and **soft rules** that cost, the **exact count** of every realization memoized on a window as
  wide as the rules look back, the engine (a softmax of −cost / temperature among the candidates with a future), a
  uniform draw, a judgement, and which rule refuses a note (`why`). A count may be given a time limit (`within(ms, f)`: past it, `TooLong`, its memo kept) and a realization found without counting (`search`: depth first in the engine's order, back from dead ends), for what is too long to count in a page. The **catalogue**, `RULES`: general rules with
  parameters, each a context and a condition and how far back it looks — today those of a voice over a given bass
  (`range`, `scale`, `from-bass`, `figures`, `leading-tone-raised`, `hold`, `intervals`, `leaps`, `melodic-minor`,
  `dissonance`, `parallels`, `edges`) and the soft rules (`soft.mjs`, `leading-tone`). **Styles**, `STYLES`: rules
  chosen and parametrized, named and versioned, `:extends` another (a rule named again takes new parameters, `[id false]`
  removes it). `overBass()`: one voice over a bass in a style.
- **`tonal.mjs`** — keys, degrees and alterations, a note's code, a unit's key.
- **`soft.mjs`** — the soft rules' weights and costs (as `@kairotic/cac`'s).
- **`functions.mjs`** — what a chord does in a key (T, S, D, or an applied dominant with its target, after Riemann as Rohrmeier's grammar reads it; the cadential 6/4 a dominant, a diminished 7th the dominant's where it holds the leading tone) and the grammar of a tonal phrase: never D → S, every applied dominant resolved, the end on the tonic. `functionOf`, `functionsOf`, `grammarErrors`, `label`. A judge for the reductions and the bridges, so that the economy (`bits.mjs`) never takes away what makes the harmony go where it goes (GTTM's prolongational reduction). Study 67 keeps a copy.
- **`bits.mjs`** — the length of a description (discussions #342, #399): a piece, a line or an analysis said as words (a cell, a step of a reduction, a bar's figure), each costing the bits a listener learning it as it goes needs — a word heard before cheap, its inversion half as good, a new one dear. `lexicon`, `lengthOf`, `economyOf` (an engine's discount for a word heard before). One measure for composing and analysing: Studies 61 (reduction), 63 (bridges) and 64 (florid) keep a copy.

Step 2 of #353: the style `partimento-1` reproduces `partimento.mjs`'s one voice over a bass to the number — every
count of Study 51's schemata, every voice of Studies 54, 57, 59 and 62 counted alone, the reasons and the engine's
choices (`tests/rules.mjs`). Several voices (`solveVoices`, `BETWEEN`, the styles `partimento-2` and `chorale-4`, `fromNotes` for a bass as notes) reproduce `partimento.mjs`'s `parts` and `four` the same way; the cac box loads it. The comes (`canon.mjs`, on `systems.mjs`): two free voices on a system, a canon or free counterpoint, counted as `counterpoint.mjs` counts it. Next: its engine, one tonal layer for both worlds, styles in EDN.
