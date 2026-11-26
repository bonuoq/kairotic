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
- **`functions.mjs`** — what a chord does in a key (T, S, D, or an applied dominant with its target, after Riemann as Rohrmeier's grammar reads it; the cadential 6/4 a dominant, a diminished 7th the dominant's where it holds the leading tone) and the grammar of a tonal phrase: never D → S, every applied dominant resolved, the end on the tonic. `functionOf`, `functionsOf`, `grammarErrors`, `label`, and `impliedChord`: the chord two voices imply (a bass and a melody, as a partimento's are heard). A judge for the reductions and the bridges, so that the economy (`bits.mjs`) never takes away what makes the harmony go where it goes (GTTM's prolongational reduction). Study 67 keeps a copy.
- **`tension.mjs`** — how far a chord is from another and how tense it is where it stands, after Lerdahl's *Tonal Pitch Space*: the basic space (root, fifth, chord, scale), the chord distance δ = i + j + k (I → V 5, I → ii 8, as his tables), an applied dominant's region its target's key, surface tension (inversion, 7th, foreign note), and sequential, global and hierarchical tension (from a reduction's prolongational parents). `distance`, `placed`, `tensions`, `hierarchical`, `surface`. Study 67 keeps a copy.
- **`continuo.mjs`** — Bach's chorales read as a figured bass (Study 76): a quarter's intervals over the bass, its chord (`chordOf`: 5/3, 6/3, 6/4, 7, 6/5, 4/3, 4/2, or a dissonance), the figure Bach would write for it in the key signature (`figureOf`, his abbreviations as the Bach Chorales Figured Bass dataset has them: nothing over a 5/3, 6/4/2 for a 4/2, an accidental alone for the 3rd), and the tables counted from his chorales that a bass written under his soprano is weighed by: `BACH_OUTER_VERTICAL`, `BACH_OUTER_PAIR`, `BACH_DEGREE_CHORD` (the rule of the octave as he played it, in major and minor), `BACH_CADENCES`; a quarter that is no chord read as a chord and the voice not of it (`dissonanceOf`: a suspension, a passing note, a note held over a moving bass…) and how often each (`BACH_DISSONANCES`).
- **`bits.mjs`** — the length of a description (discussions #342, #399): a piece, a line or an analysis said as words (a cell, a step of a reduction, a bar's figure), each costing the bits a listener learning it as it goes needs — a word heard before cheap, its inversion half as good, a new one dear. `lexicon`, `lengthOf`, `economyOf` (an engine's discount for a word heard before). One measure for composing and analysing: Studies 61 (reduction), 63 (bridges) and 64 (florid) keep a copy.

Step 2 of #353: the style `partimento-1` reproduces `partimento.mjs`'s one voice over a bass to the number — every
count of Study 51's schemata, every voice of Studies 54, 57, 59 and 62 counted alone, the reasons and the engine's
choices (`tests/rules.mjs`). Several voices (`solveVoices`, `BETWEEN`, the styles `partimento-2` and `chorale-4`, `fromNotes` for a bass as notes) reproduce `partimento.mjs`'s `parts` and `four` the same way; the cac box loads it. The comes (`canon.mjs`, on `systems.mjs`): two free voices on a system, a canon or free counterpoint, counted as `counterpoint.mjs` counts it. Next: its engine, one tonal layer for both worlds, styles in EDN.
