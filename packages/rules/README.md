# @kairotic/rules

*Official package of [Kairotic](https://github.com/bonuoq/kairotic) · [all packages](../README.md)*

One constraint engine for every style — discussion [#353](https://github.com/bonuoq/kairotic/discussions/353), and its
inventory of the rules Kairotic's engines hold, [`docs/rules.md`](../../docs/rules.md). No classes: modules for the
engines of [`@kairotic/cac`](../cac/) and the studies.

- **`rules.mjs`** — the core, `solve()`: voices advancing unit by unit, candidates from a system, **hard rules** that
  refuse with a reason and **soft rules** that cost, the **exact count** of every realization memoized on a window as
  wide as the rules look back, the engine (a softmax of −cost / temperature among the candidates with a future), a
  uniform draw, a judgement, and which rule refuses a note (`why`). The **catalogue**, `RULES`: general rules with
  parameters, each a context and a condition and how far back it looks — today those of a voice over a given bass
  (`range`, `scale`, `from-bass`, `figures`, `leading-tone-raised`, `hold`, `intervals`, `leaps`, `melodic-minor`,
  `dissonance`, `parallels`, `edges`) and the soft rules (`soft.mjs`, `leading-tone`). **Styles**, `STYLES`: rules
  chosen and parametrized, named and versioned, `:extends` another (a rule named again takes new parameters, `[id false]`
  removes it). `overBass()`: one voice over a bass in a style.
- **`tonal.mjs`** — keys, degrees and alterations, a note's code, a unit's key.
- **`soft.mjs`** — the soft rules' weights and costs (as `@kairotic/cac`'s).

Step 2 of #353: the style `partimento-1` reproduces `partimento.mjs`'s one voice over a bass to the number — every
count of Study 51's schemata, every voice of Studies 54, 57, 59 and 62 counted alone, the reasons and the engine's
choices (`tests/rules.mjs`). Next: two and three upper voices on the core, styles in EDN, `comes`.
