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
| `:scale` | note | `{:system :key :mode :melodic-minor true :chroma [...]}` | not a note of the key; melodic minor (raised up, natural down, ⑥♯ on to ⑦♯, the exceptions over a rising bass); the dominant major in minor; ②'s leading tone to ① (ch. 4); a unit's chromatic tones (aug. 6th); the system's own notes (`comes`) | 1 |
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

## Next

- Then three and four parts, styles in EDN with `:extends`, `[:style …]` in `cac`; `comes` last.
- Local search (OMClouds-like) or lazy counting where a count would take more than about 10 s.
