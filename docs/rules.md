# Rules: an inventory, toward one engine (discussion #353)

*Step 1 of [#353](https://github.com/bonuoq/kairotic/discussions/353): every rule the constraint engines of Kairotic
hold today, grouped into the few general, parametrized rules a single engine would offer — the catalogue of
`@kairotic/rules`.*

## Decisions (#353)

1. **Few general rules with parameters** for the styles we already have; the door open to systems with **dimensions
   of their own** (a rhythm engine, a reduction, a bridge) that bring their own rule families.
2. **A package of its own**: `@kairotic/rules` — the engine and its catalogue — that `@kairotic/cac` and later others
   (rhythm, harmony) use.
3. **Styles named and versioned, with inheritance** (`:extends`).
4. **Beyond about 10 s of computation, local search or lazy computation** instead of the exact count, and the page
   says so.
5. **Open to learning**: weights (and later rules) fitted to a corpus, when we get there — the format must allow it
   (weights as data, every cost decomposed by rule, as `costParts` already does).

## What there is

| Engine | Where | Voices | Hard rules | Soft rules |
|---|---|---|---|---|
| `counterpoint.mjs` (`comes`) | `@kairotic/cac`; Studies 40–46, 50 | 2: dux and comes (canon, imitation, species) | ~40 reasons, in code | `soft.mjs` + `modal`, `imitation` |
| `partimento.mjs` — `schemata` | Studies 51–64, `cac partimento 2` | 1 over a given bass | ~45 | `soft.mjs` + `leading-tone` |
| `partimento.mjs` — `parts` | Studies 54–59, `cac partimento 3` | 2 over a bass | ~12 more (between the voices) | per voice, weighted |
| `partimento.mjs` — `four` | Study 62, `cac partimento`, `cac judge` | 3 over a bass | ~15 more | per voice, `doubling` |
| `mirror.mjs` | Studies 43, 46, 50; `comes -1` | 2, written from both ends | counterpoint's, in another order | — |
| reduction, bridges, florid | Studies 61, 63, 64 | their own dimensions (levels, paths, diminutions) | their own | their own |
| `soft.mjs` | everywhere | — | — | **23 rules, already as data** (`id`, `scope`, `weight`, `doc`) |

Every engine has the same shape: voices advancing unit by unit; candidates from a system (a key, a mode, a tuning);
hard rules that refuse with a reason; soft rules that cost; an exact count memoized on the last units (today three);
the engine (a softmax of −cost / temperature), a uniform draw, a judgement.

## The catalogue: general rules, and what each gathers

A rule is **a context and a condition** (as PWConstraints/Score-PMC and Strasheela have it). Contexts:

- **note** — a voice alone at a unit (its range, its scale, where it starts and ends)
- **line** — a voice's moves (lookback 1–3)
- **vertical** — a voice against the bass (or the dux)
- **pair** — two voices from one unit to the next (parallels, crossings)
- **chord** — all the voices at a unit (the chord asked, doublings, spacing)
- **progression** — the chord before and this one (resolutions)
- **given** — a voice against a given one, later (canon, imitation)
- **edge** — the start, the end, a cadence

Each rule declares its **lookback** (how many units back it reads): the engine's memo window is the largest of the
rules in a style, so the count stays exact.

| Rule | Context | Parameters (default: the styles we have) | Gathers today | Lookback |
|---|---|---|---|---|
| `:range` | note | `{:lo :hi}` per voice; `:from-bass` (spacing to the bass) | out of range; too far from the bass; below the bass; the unison with the bass only at the end | 0 |
| `:scale` | note | `{:system :key :mode :melodic-minor true :ficta true :chroma [...]}` | not a note of the key; melodic minor (raised up, natural down, ⑥♯ on to ⑦♯, the exceptions over a rising bass); the dominant major in minor; ②'s leading tone to ① (ch. 4); a unit's chromatic tones (aug. 6th); the system's own notes (`comes`); a church mode's musica ficta (the final's raised 3rd only at the end; `ficta`: raised up by step, lowered down) | 1 |
| `:intervals` | line | `{:allowed [...] :max :octave :dim7-in-minor true :chromatic-at-key-change true}` | augmented 2nd, 4th, 5th; 7ths (only the diminished, in minor); wider than the octave; a chromatic step | 1 |
| `:leaps` | line | `{:turn-after 4 :line :free|:moderate|:strict}` | the line turns after a leap; the `line` levels (a leap ≤ 5th, no two leaps the same way); `comes`'s leap rules | 2 |
| `:hold` | line | `{:max 2}` per voice | a note held n units at most | ≤ 3 |
| `:consonance` | vertical | `{:perfect [1 5 8] :imperfect [3 6] :fourth :dissonant-over-bass :semi [:A4 :d5]}` | what is consonant; chapter 4's semi-consonances | 0 |
| `:dissonance` | vertical, line | `{:strong :suspension :weak :passing :accented-passing :asked :pedal :by-step :held {:upper [7 4 9] :bass [2 4]} :two-in-a-row false :resolve :down-by-step :to [:consonance :semi]}` | ~15 reasons in each engine: a dissonance on a strong unit prepared; on a weak one passing by step; never two in a row; held in the upper voice a 7th/4th/9th, in the bass a 2nd/4th; resolved down by step to a consonance (or a semi-consonance, ch. 4); over a pedal by step; the accented passing tone; a 9th not resolving to the unison (`comes`) | 2 |
| `:semi-consonance` | vertical, line | `{:A4 :up-to-6th :d5 :down-to-3rd :passing-bass :exchange}` | ch. 4: unprepared, resolved; over a passing bass a note of the chord before, held or exchanged | 2 |
| `:seventh` | chord, line | `{:resolve :down-by-step :prepared :non-dominant :dominant :held-or-by-step :delayed-into-6/4 true}` | the 7th goes down by step; held into the 4th over the next bass (ii7 → V); prepared unless the dominant's; the dominant's held or by step (#347) | 2 |
| `:parallels` | pair | `{:perfect [1 5 8] :pairs :all :direct {:outer :upper-leaps} :structural false}` | parallel 5ths/8ves (bass–voice, voice–voice); a 5th/8ve by direct motion with a leap; the unison by parallel motion | 1 |
| `:spacing` | chord, pair | `{:adjacent 8 :cross false :unison :end-only}` | under the voice above; within an octave; the voices cross (`comes`); more than an interval apart | 0 |
| `:chord` | chord | `{:asked :figures :tables CHORDS|CHORDS4 :complete :optional-5th}` | the chord asked; the figures ask for…; complete or not | 0 |
| `:doubling` | chord | `{:never [:leading-tone :dissonance :seventh] :third false :prefer :bass :deceptive :third}` | the 3rd doubled (3 parts); the leading tone, the dissonance, the 7th doubled; the deceptive ⑥ doubles its 3rd; (soft) the bass doubled in a 5/3 | 0 |
| `:resolution` | progression | `{:leading-tone {:at :dominant :inner-to-5th true} :six-four :down-by-step :aug6 :up}` | the leading tone up (an inner voice may fall to ⑤); the 6/4 to the 5/3; the augmented 6th up; the second dissonance left by step (`comes`) | 1 |
| `:relation` | chord, pair | `{:false-relation :within-chord}` | a false relation (an augmented unison or octave between voices) | 0 |
| `:edges` | edge | `{:start [8 5 3] :end [8 3] :end-6th-over-3rd true :by-step true :last :perfect :no-dissonance true :mode-entries [...]}` | where a voice starts and ends; the dux on the final, its 5th, its octave or the 4th below; the final by step; the last vertical perfect; not ending on a dissonance | 1 |
| `:cadence` | progression, edge | `{:not [[7 5]] :kinds [...]}` | the cadence does not go from a 7th to a 5th (`comes`); the cadences named (perfect, half, deceptive…) as bass data | 2 |
| `:imitation` | given | `{:voice :delay :steps :band :canon|:near|:motion|:free}` | a canon: the comes is the dux's note; within a 3rd; the Fenaroli's canon with the bass; (soft) `imitation` | delay |
| `:species` | line, vertical | `{:species 4}` | fourth species: the cantus firmus moves on every strong beat and holds its note; the comes syncopated | 2 |

**Soft rules** (`soft.mjs`, already data; each with an id, a scope, a weight and a doc): `leap-size`, `tie`,
`contrary-after-leap`, `step-back`, `leap-after-leap`, `return`, `hover`, `run`, `open`, `climax`, `sequence`, `memory`,
`novelty`, `motion`, `direct-perfect`, `imperfect-run`, `passing`, `suspension-life`, `alternation`,
`structural-parallels`, `chord-skip`, `modal`, `imitation`; and in `partimento.mjs` `leading-tone` and `doubling`. In
the catalogue a soft rule is the same entry as a hard one with `:soft weight` instead of `:hard true` — so one rule can
be strict in one style and a preference in another (the leading tone: hard at a cadence, soft in a phrase).

**Systems with dimensions of their own** (decision 1): the reduction (levels, slices — Study 61), the bridges (paths
between two states — 63), florid diminutions (64), `mirror.mjs`'s order of writing (from both ends), and later rhythm
and metre (as Cluster Engine has engines per parameter). They bring their own contexts and rules to the catalogue as
a family (`:rules/reduction`, `:rules/rhythm`), on the same engine where they share its shape, beside it where they
do not.

## A style in EDN (a sketch)

```clojure
{:style :chorale-4 :version "1.0.0" :extends [:galant-3 "1.2.0"]
 :system :diatonic :voices [:soprano :alto :tenor :bass] :given #{:bass}
 :rules [[:range {:soprano [9 20] :alto [6 17] :tenor [3 14]}]
         [:spacing {:adjacent 8 :cross false}]
         [:parallels {:pairs :all}]
         [:doubling {:never [:leading-tone :dissonance :seventh] :prefer :bass :deceptive :third}]
         [:seventh {:prepared :non-dominant :dominant :held-or-by-step}]
         [:resolution {:leading-tone {:at :dominant :inner-to-5th true}}]
         [:leading-tone-resolves {:soft 1.5}]]
 :weights {:motion 2.5 :leap-size 1 :doubling 0.6}}
```

`:extends` takes the parent's rules and weights; a rule named again replaces the parent's (its parameters merged), `[:rule false]`
removes it. A style's version is semver: a change that alters what it counts raises the minor version (the studies pin
their counts to a version).

## The oracle

Each study pins its exact counts and the book's prototypes (IJzerman's examples, Fux's, Bach's): Studies 41–46, 50,
51–64. A port of an engine onto the core is right when it reproduces them **to the number** — first Study 51 (one voice
over a bass), then 54–62 (three and four parts) and `cac partimento`, then `comes` and Studies 61–64.

## Step 2: the core (done)

`@kairotic/rules` 0.1.0: `solve()` — the core —, the catalogue's first rules (`range`, `scale`, `from-bass`, `figures`,
`leading-tone-raised`, `hold`, `intervals`, `leaps`, `melodic-minor`, `dissonance`, `parallels`, `edges`; soft: `soft.mjs`,
`leading-tone`), the style `partimento-1` and `resolveStyle` (`:extends`, a rule reparametrized or removed). `tests/rules.mjs`:
the same counts as `partimento.mjs` in 288 cases of Study 51's schemata and for every voice of Studies 54, 57, 59 and 62
counted alone, the same reasons candidate by candidate, the same engine.

## Step 3: several voices (done)

`@kairotic/rules` 0.3.0: `solveVoices()` — several voices, each a style of one voice over the bass, the rules between
them in a style's order —, the catalogue's rules between voices (`BETWEEN`: `order`, `imitation`, `exchange`, `apart`,
`seconds`, `six-four`, `parallels-upper`, `false-relation`, `chord`, `doubling`, `seventh`, `leading-tone-doubled`,
`resolution`, `dominant-major`; soft: `doubling`), the styles `partimento-2` (two upper voices) and `chorale-4` (three),
and `fromNotes` (a bass as notes). `tests/rules.mjs`: the same counts as `partimento.mjs`'s `parts` and `four` in the 38
phrases of Studies 54, 57, 59 and 62, the same reason tuple by tuple, the same engine, judgement and chords; the cac box
(`@kairotic/cac` 0.9.0) loads `rules.mjs`.

## Step 4: styles in EDN (done)

`@kairotic/rules` 0.6.0, `@kairotic/cac` 0.11.0. A style is data — EDN in the app, the object `clj->js` makes of it
here — and every part of it inherits: its rules (`:rules`, `:soft`), those between voices (`:between`,
`:softBetween`), its voices' style (`:voice`: a name, or a style that extends the parent's voice), its weights. A rule
named again takes its new parameters, `[:rule false]` removes it, a new one goes at the end. `:extends` takes a name or
`[name version]`: the same major version, the minor at least, or it says why not. A style says how many parts it
writes (`:parts`). `checkStyle` names a rule the catalogue does not have; `defineStyle` makes a style nameable (and
extensible) from then on. In `cac`: `[:style :partimento-2]`, `[:style {…}]`, `:styles`.

```clojure
[:style {:style :free-sevenths :extends [:chorale-4 "1.0.0"]
         :between [[:seventh {:free true}]]           ; the dominant's 7th may leap in
         :voice {:rules [[:leaps {:line :strict}]]}   ; every voice by step, or a leap and back
         :weights {:doubling 2}}]
```

The styles there are: `partimento-1` (a voice over a bass, 2 parts), `partimento-2` (3), `chorale-4` (4), `modal-1`,
`modal-voice`, `modal-2`, `modal-4` (Fux's church modes). `tests/rules.mjs`: a style that frees the dominant's 7th
counts as `freeSevenths`, one whose voices are strict as `line: "strict"`, versions and unknown rules refused.

## Chapter 7 (Study 65)

`@kairotic/rules` 0.7.0: the 7th chords' families — the dominant's (on ⑤) and the diminished 7th's (on the leading
tone: in minor ⑦♯, the bass raised in root position; in major with the lowered ⑥) — are semi-consonances, free to
enter; a tritone in the diminished family is free where it is the chord's 7th (going down by step) or held while the
bass moves on. A unit may say it is part of a `sequence` (a diminished triad's tritone goes on by step into whatever
consonance comes) and of minor's `natural` scale; `family` names a 7th chord's family outright; a chroma may be
required (`[degree alteration true]`). `chorale-4` is 1.1.0 (nothing it counted before changes).

## Step 5: the comes (begun)

`@kairotic/rules` 0.8.0: `systems.mjs` — the comes's systems as data (a tuning, the steps of a scale, what each interval
is by its real size: the diatonic one, meantone, a septimal scale in 31-TET, the pentatonic), the same as
`counterpoint.mjs`'s — and `canon.mjs`: two free voices on a system, the dux and the comes, on `solveVoices`. Its
rules are now entries of the catalogue, of a voice (`CANON_VOICE`: `range`, `entry`, `final`, `approach`,
`syncopation`, `melodic` — the system's melodic intervals and the leap's recovery, small and large) and between the
two (`CANON_BETWEEN`: `resolution`, `imitation` — a canon, near, under a transformation —, `crossing`, `vertical` —
the counterpoint as it is and under every inversion asked: parallels, direct octaves, perfect intervals on consecutive
strong beats, a strong dissonance a suspension of the kinds the system allows, a weak one passing —, the entry, the
final, the cadence); the style `canon-2` names them. `tests/rules.mjs`: the same counts as `counterpoint.canon` in 40
random canons, imitations and free counterpoints over the four systems, with species, inversions asked, the comes
inverted or augmented and rules turned off. The memo takes a key of its own (`solveVoices({key})`: a window for each
voice, the dux's reaching back to the note the comes repeats).

Its style is one of the others (`STYLES["canon-2"]`, `:engine "canon"`, `:parts 2`): written as data, it extends,
reparametrizes and removes as any style — its voices' lists (`:dux`, `:comes`) and the rules between them, a rule
taken twice told apart by what it is of (`["resolution" {:of :dux}]`) —; `checkStyle` reads the catalogue of the
engine a style names (`CATALOGUES`: the bass's, and the canon's that `canon.mjs` registers); a style of the canon is
refused for a bass's upper voices.

**One tonal layer for both worlds.** `keySystem(key)` (`systems.mjs`): a key of `tonal.mjs` — major, minor, a church
mode with its musica ficta — as a system the comes sings in, a pitch a code (a degree and an alteration), its
intervals judged by their real size. The canon (`canonVoices({key})`) then counts degrees and reads the key's ficta
(rule `ficta`: a raised note leads up by step, the cadence's leading tone raised where the mode raises it, the final's
raised 3rd only at the end) — the partimento's, the same rules. A church mode without its ficta counts as on the
white keys of the diatonic system, to the canon (`tests/rules.mjs`); with it, a D dorian canon cadences through C♯.
And the other way, the comes's invertible counterpoint is the partimento's too (rule `invertible`, `{at: 8 | 10 | 12}`,
compound intervals as simple ones): a voice over a bass that stands inversion — named by a style, as any rule:
`[:style {:extends :partimento-1 :rules [[:invertible {:at 8}]]}]` in `cac partimento [:voices 2]`.

What the comes's rules bring the rest, as they come in: the system as data (a vertical's quality by its real size,
not by a key's letters: the same rules in 31-TET or a pentatonic), invertible counterpoint as a condition every
vertical must stand, the suspensions a system allows by kind, perfect intervals on consecutive strong beats, a leap's
recovery by its size.

`@kairotic/rules` 0.10.0: `imitation(spec)` — a dux given (a tree's voice), the comes found against it — and the style
`imitation-2` (`canon-2`, the dux's own rules off, the rule `given`); the comes weighed by `soft.mjs` on its degrees.
`@kairotic/rules` 0.11.0: a given dux may rest (a null code): a canon's comes rests there too; `countWithin(ms)` counts within a limit.
`cac imitation` (`@kairotic/cac` 0.14.0) is its box: the bench of `canon.mjs` with real trees.
`@kairotic/rules` 0.12.0: `judgeTwo(spec)` — two voices judged by the canon's rules, unit by unit (each voice's line and what
is between them), the dux, k and d read from their entries; `cac judge` with `[:style :canon-2]` is its box.
`@kairotic/rules` 0.13.0 (Study 69, IJzerman's chapter 8): a 7th by chromatic step, a 7th held into a weak unit, ⑦
in a sequence as the others, the 6/4 in two steps (a 5/4 between), structural parallels between the upper voices
(`chorale-4` 1.2.0), the memo reading back to where a held note began; `bits.mjs`.
`@kairotic/rules` 0.14.0: `outer-octaves` (`chorale-4` 1.3.0): no octave between the soprano and the bass on two strong
units in a row, the soprano held between them and moving the bass's way — not even a sequence's.
`@kairotic/rules` 0.15.0: `functions` (`chorale-4` 1.4.0): the tonal grammar of `functions.mjs` on the strong units (an applied
dominant resolved on the weak ones too); `fromOuter`: the inner voices between a soprano and a bass given.
`@kairotic/rules` 0.16.0: the style `bach-4` (Bach's chorales): `chorale-4`, neighbouring voices meeting on one note as a
doubling (`order`'s `unison`, `from-bass`'s `unison: "any"`); `fromOuter`'s default.
`@kairotic/rules` 0.17.0: `bach-4` 1.1.0, learnt from Bach's own chorales (`tests/chorales.mjs`): the voices' ranges as his,
in MIDI (a style's `ranges`); `dissonance`'s `overStruck` (a passing tone against a moving bass), `neighbour` and
`weakHeld` (a note held into a dissonance on a weak unit, down by step after); `parallels` `direct: "outer"`.
`@kairotic/rules` 0.19.0: `bach-4` 1.2.0, `dissonance`'s `bachSevenths` (a 7th held while the bass moves under it into a
consonance; up by step where the bass takes its resolution, V4/3 → I6; free where the bass takes the 7th itself);
notes given with a key (a bass note's `key`, `fromNotes`'s `code(m, t)`) are spelt in it (`degreeIn` in `tonal.mjs`), and
notes given with a name (a note's `name`, `code("F#4")`) as they are spelt.
`@kairotic/rules` 0.20.0: `bach-4` 1.3.0: `functions`' `local` (each unit read in its own key, the bass note's; two units
in different keys kept where either key reads them well) and `passing` (an inverted chord over a bass going on by step
is a passing chord); in `bach-4` it is a cost (`SOFT_BETWEEN`'s `functions`, weight 2), not a refusal — read in his local
keys Bach breaks it in 78 of his 2,272 phrases (136 in the chorale's key). `chorale-4` as it was (discussion #353).
`@kairotic/rules` 0.20.1: `bach-4` 1.3.1: `from-bass` takes a unison a semitone under the bass (D over D♯) as below it.
`@kairotic/rules` 0.21.0: `bach-4` 1.4.0: `bach-motion` (a voice's soft rule: a move costs −log of how often Bach's alto and
tenor make it, `BACH_INNER_MOTION`; weight 2); `fourOverBass`'s `given.alto` / `given.tenor` and `fromOuter`'s `inner`
(an inner voice given where a unit has a note: a bridge's ends as Bach's chords). `bach-4` 1.5.0: `voice-exchange` (between
the voices, weight 2: an inner voice and another trading their notes in contrary motion, over one unit or two by step,
costs less).
`@kairotic/rules` 0.22.0: `bach-4` 1.6.0: `bach-vertical` (a voice's interval above the bass costs −log of how often Bach's alto
and tenor sound it, `BACH_INNER_VERTICAL`; weight 1.5), `raised-sixth` (minor's raised ⑥ in an inner voice costs, more
where it does not go on up; weight 2); `passing` and `suspension-life` 0, `bach-motion` 4, `voice-exchange` 4.
`@kairotic/rules` 0.22.1: `bach-4` 1.6.1: `bach-vertical` 1, measured on bridges that tonicize (#466).
`@kairotic/rules` 0.23.0: `continuo.mjs` (Study 76 · continuo): a chorale's quarter read as a figured bass — its intervals
over the bass, its chord (5/3, 6/3, 6/4, 7, 6/5, 4/3, 4/2, or a dissonance), Bach's figure for it in the key signature
(`figureOf`, as he abbreviates in the BCFB dataset: 85% of his figures over a struck bass) — and the tables a bass under
his soprano is weighed by: the soprano over the bass, their moves together, the chord over each degree, the cadences.
`@kairotic/rules` 0.24.0: `continuo.mjs`' `dissonanceOf` and `motionOf`: a quarter that is no chord read as a chord and the
one voice not of it, by how it moves (a suspension, a passing or neighbour note, a note held over a moving bass, an
appoggiatura, an escape, an anticipation); `BACH_DISSONANCES`, how often each (the states the bass engine must allow
under a soprano that is not a chord tone, #487).
`@kairotic/rules` 0.24.1: the continuo tables a plain −log (no row's lowest set to 0: summed, a probability's).

## Next

- The comes's engine on it: its soft rules (the mode, the imitation) and the box's `live` (a note asked for, corrected
  to the nearest legal one with a future); the box loading `canon.mjs` once it counts as fast (its keys numbers, as
  `counterpoint.mjs`'s, not strings).
- Coherence as a preference (discussion #342's grammar, read the other way): of the legal solutions, the simpler ones —
  a derivation with fewer distinct cells, a figure or a rhythm heard again, transformed (inverted, augmented, in
  sequence) rather than new — as Bach's cells that unfold and vary without losing what holds them together. A soft rule
  that costs the description, not the note.
- Local search (OMClouds-like) or lazy counting where a count would take more than about 10 s.

## The church modes (#362, and Fux's style)

`keyOf` takes the church modes with their musica ficta (the `:scale` and `:ficta` rules). Their figures are mode-
neutral; what chooses chords in a mode is the style `modal` (`modal-1`, `modal-2`, `modal-4`): note against note,
every chord a consonant 5/3 or 6/3 (rule `modal`), the cadence's 6/3 over a bass falling by step to the last note,
and the freedoms Fux's three and four parts take (a unison with the bass, voices crossing, direct 5ths and octaves
among them, a leap not always turned, a chromatic step over a held bass, the top voice ending on the 5th). The
oracle: his 27 examples in three and four parts (`tests/assets/fux`), 26 of them accepted; the 17th century's
cadences of each mode (on the final, its 5th, its 3rd) come next.

