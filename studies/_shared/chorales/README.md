# Bach's chorales, phrase by phrase

The corpus the chorale studies read (#301, #399): **2,272 phrases from the 370 chorales**, cut at the fermatas.

- `phrases.json` — `{source, license, phrases}`; a phrase is
  `{id, chorale, bwv, title, meter, key: {tonic, mode, church?}, cadence, keys, satb, names, held, strong, A, B, lines}`:
  - `satb` — the four voices a quarter at a time, MIDI, soprano first: the note sounding on each quarter (the eighths
    between, passing and neighbour notes, are in `lines`);
  - `names` — the same notes as the edition spells them (`"F#4"`, `"Bb3"`): the engine reads them as they are spelt
    (a note's `name`, `fromNotes`'s `code("F#4")`), a 6th as a 6th where a MIDI number could be read as a 7th;
  - `held` — for each quarter and voice, whether its note began before it (a half note, a tie);
  - `strong` — the quarters on a strong beat (1 and 3 in 4/4, the downbeat in 3/4);
  - `A`, `B` — the first and the last chord (the ends of a bridge, Study 63);
  - `key` — the chorale's key as the edition gives it (a church mode in `church`); `cadence` — the triad the phrase
    ends on, `null` when it is not a complete major or minor 5/3;
  - `lines` — each voice's notes in the phrase, `[onset in quarters, MIDI, quarters, name]`.
  - `keys` — the key each quarter is in (`"G major"`, `"E minor"`), read from the four voices: among the chorale's key
    and its neighbours two 5ths either way, in either mode, the path whose scales hold most of the notes (in minor ⑥ and
    ⑦ raised; the natural ⑦ counts as out of it, the relative major's), a change of key costing as one note out, the
    chorale's key a little preferred, and the last chord the key's I or V (`localKeys` in `tools/kern.mjs`). 0.45
    changes of key a phrase; read in them, `bach-4` keeps nearly twice as many of Bach's phrases as in the chorale's key.
- `tools/kern.mjs` — the extractor: `node studies/_shared/chorales/tools/kern.mjs <the edition's kern/ dir>`.
  A voice entering late after a rest begins its phrase where all four sound; 5 phrases (chorales 43, 280 and 283)
  are left out, with a rest inside or too short.

**License:** `phrases.json` is CC BY-NC-SA 4.0, after Craig Sapp's edition — not the MPL-2.0 of the rest of the
repository. See [LICENSE.md](LICENSE.md).

## `bridges.json` — the outer voices for the blind test (Study 63)

`{source, license, count, seed, bridges}`; a bridge is `{phrase, soprano, bass, key, keys, readIn, strong, layers, variant, fillable}`:
the soprano and the bass of a phrase drawn from its first chord A to its last chord B by Study 63's `outer.mjs`, as
`fromOuter` reads them — for every phrase, two draws of each variant: `all` (functions, tension, economy) and each layer
off (`no-functions`, `no-tension`, `no-economy`), and `arch` (all on, the tension following a generic arch instead).
The tension layer's target is the corpus's profile (`outer.mjs`' `PROFILE`: Bach's mean tension by tenth of a phrase,
a plateau released at the cadence) — the same for every phrase, so no phrase's own curve leaks into its bridge. Each
voice moves as often as Bach's does (`BACH_OUTER_MOTION`); `keys`, one a unit (`"A minor"`), is the path of keys the
bridge goes through — drawn on Bach's own moves between keys (`KEY_MOVES`, from phrases.json's), from the key his
phrase begins in to the one it ends in, four times as eager (`KEY_RATE`) for his quick tonicizations —, each key
entered on its dominant with its leading tone in the soprano or the bass, minor's ⑥–⑦ raised going up and natural
coming down; and each bridge is drawn again, ten times at most, until
bach-4 can fill its inner voices (`fillable`: fromOuter's count above 0; false where no draw could be). `readIn`: the key the tension is read in (the cadence's, or the
chorale's); the functions are read in the keys close to the chorale's and the cadence's. Written by
`node studies/63-bridges/tools/bridges.mjs studies/_shared/chorales studies/_shared/chorales/bridges.json 2 1 i/2` for
i = 0, 1 (two shards, side by side), then `node studies/63-bridges/tools/merge.mjs studies/_shared/chorales/bridges.json 2`.
Adapted from `phrases.json` (its A and B), so under the same license, CC BY-NC-SA 4.0.


## `deck.json` — the blind test's trials (Study 71)

`{source, license, seed, perVariant, variants, trials, tried, failures}`; a trial is `{id, phrase, variant, draw, title,
bwv, key, strong, bach, bridge}`, `bach` and `bridge` each `{satb, held}` (MIDI a quarter, soprano to bass; a note held
where it is): a phrase of Bach's and one of its bridges of that variant, from his first chord to his last kept whole
(the alto and the tenor given there), the inner voices between written by `@kairotic/rules`' `fromOuter` (`bach-4`,
its moves weighed as his: `bach-motion`; the engine at temperature 1). Every phrase is in the deck once, `perVariant` trials of each variant; `tried`
counts, by variant, the phrases tried and those whose bridge `bach-4` could fill, and `failures` why it could not. The
same trials for every listener. Written by `node studies/71-blind/tools/deck.mjs 40 71`. Adapted from `phrases.json`
and `bridges.json`, so under the same license, CC BY-NC-SA 4.0.
