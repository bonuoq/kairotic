# Changelog

## Unreleased

- **The bass under Bach's soprano reads the chorale thread's position and cadence tables** (#353, after #515).
  Study 63's `under.mjs`, with `continuo`, takes its harmonic map from BACH_DEGREE_BY_POSITION (in place of
  under-tables.mjs's `position`) and its cadence from BACH_CADENCE_STEPS: each of the last three steps into the
  fermata weighed by its own pairs (degrees over the key of the quarter it goes to; a dissonant quarter "x"), cadence
  0.7 and the two before 0.5 (set on chorales ≡ 1 mod 5). On the 150 held-out phrases: Bach's bass 2.34 bits a note
  (2.38), note for note 25.9% (23.0), ⑤–① ends 60.0% (64.7; Bach 57.3). Study 76's copy synced.
- **The harmonic map and the cadence as steps, for the bass engine** (#353, in the shapes the structural thread asked).
  `@kairotic/rules` 0.29.0: `continuo.mjs`' `BACH_DEGREE_BY_POSITION` — counts of the chord over each degree by tenth of
  the phrase, in the quarter's local key — and `BACH_CADENCE_STEPS` — counts of every pair of quarters at each of the
  last three steps into the fermata (in major IV6/5 → V and V → I first). `@kairotic/cac` 0.16.20 (its pin).
- **The inner voices' turns, and where they dissonate in the phrase; Bach's four-quarter cadences** (Study 76; the
  listener hears Bach in the leading of the voices and in dissonance weighed against metre and the phrase's climax).
  `@kairotic/rules` 0.28.0: `continuo.mjs`' `BACH_INNER_TURNS` / `turnCost` (an inner voice's move after its two
  before, on that beat: 2.73 bits a move on the chorales kept out, 2.92 knowing nothing before), `BACH_DISSONANCE_MAP` /
  `dissonanceMapCost` (Bach's inner dissonances by beat and tenth of the phrase — his strong beats consonant at the start
  and the cadence, dissonant on a third of them in the middle — against the engine's own, `ENGINE_DISSONANCE_MAP`, a
  step of iterative scaling), and `BACH_CADENCES_4` (the last four quarters: ii6/5 or IV6/5 – V – I first). `bach-4`
  1.9.0 weighs `bach-turns` (1) and `dissonance-map` (2). Fixed: the tables' writer put a space into keys with a comma.
  On 30 phrases kept out the inner moves come to kept / step / 3rd 25/44/20 (Bach 28/41/19); the dissonances move
  little (15%, Bach 22%): what refuses them is the hard rules. Study 71's deck of whole phrases drawn again.
  `@kairotic/cac` 0.16.19 (its pin).
- **Study 74 · aoidos: Limenios's paean in the corpus, the Greek style fitted to the three** (#192). `corpus.mjs`
  reads DAGM no. 21 as the edition transcribes it (38 fragments, 367 notes), each Delphic paean with the Greek system
  it is read in (Athenaios the Hyperdorian, Limenios the Hyperlydian). Unseen, Limenios is explained by the style
  learned from Mesomedes and Athenaios (his note the cheapest 228 → 342 of 482 times); `GREEK` is fitted again to the
  three (1012 choices). Seikilos, held out, 22 → 26 of 48 beats (29 with the two-source style).
- **The bass under Bach's soprano: a harmonic map, secondary dominants that resolve** (#353: what the listener
  heard in Study 71's whole phrases — the functions most). Study 63's `under.mjs` weighs each quarter's chord over its
  degree by where it falls in the phrase (a tenth of it, as PROFILE): −log P(degree, figure | tenth) + log P(degree,
  figure), counted by `tools/under-tables.mjs` (`position`), so the position says only what the chord table does not;
  and a secondary dominant — an applied dominant in the chorale's key, whatever the local key — costs `resolve` (1.5)
  where it does not go to its chord (off with no-functions). `tools/under-measure.mjs` counts them. On the 150
  held-out phrases: secondary dominants 7.0 a 100 quarters (Bach 8.0), resolved 75.6% (no-functions 31.6%; Bach's
  51.1% by the same strict count); figures 5/3 52.8 (Bach 54.4), 6/3 21.1 (23.1); held 10.2% (9.9); ⑤–① ends 64.7%
  (57.3); Bach's bass 2.38 bits a note. Study 76's copies of under.mjs and under-tables.mjs synced.
- **The grand staff, and the MEI through a lens** (discussion #380, steps 4–5). `(lens :b3 :grand)`: a keyboard's
  grand staff, two staves in a brace, the upper voices at home above and the lower ones below; a voice keeps its
  identity (its layer, its stems) and crosses to the other staff only where its notes would need two or more ledger
  lines on their own and fewer there (`{:ledgers n}`), a whole beat at a time (a tuplet, a chord), so it does not jump
  note by note — MEI's cross-staff notes (`@staff`), which Verovio engraves. `kairotic.mt` writes a note's or a chord's
  `:cross` as `@staff`, and leaves unnamed (and braced, two of them) the staves of voices with `:staff-label false`:
  what a lens writes, never kept in a tree. `(mei :b3)` and Export MEI write the notation through the lens the box
  shows, the EDN keeping the tree as it is (`:lens {:spec … :order …}`): read back, the same tree as without a lens.
  To come: a clef change where a voice stays long in the other register, voices moving together merged into chords.
- **Study 74 · aoidos: the ison as a bass** (#192). `aoidos({pedal})`: the voice written over a held note, every
  strong beat a concord with it (the Greek concords in a tonos, any consonance in a church mode); `aulos()`'s
  practice `over` (the drone the final an octave below, the voice over it) and `bass` (`isonBass`: the voice and an
  ison written together, the ison changing only where a line begins, on a fixed note of the Greek system or the final,
  ending on the final, below the voice). The page: two more ways to sing with the aulos.
- **Lenses: how a tree is written on staves, as a choice** (discussion #380, steps 1–3). A tree holds only music;
  the staves, the order of the voices on them and the clefs are a lens's (`kairotic.lens`), a pure function tree →
  layout, and a tree box keeps only which lens it shows: `(lens :b3 :closed)`, `[:closed {:upper 1}]`, kept in the work
  as `[:lens id …]`. `:open` (the default): each voice on its own staff, from the highest to the lowest, its clef by
  its range — treble, bass, or the treble an octave down where it saves the ledger lines a tenor needs on both —,
  `{:order :tree}` keeping the tree's order. `:closed`: the upper voices on a treble staff, the lower ones on a bass
  staff (SA · TB). The `:staff` and `:clef` older trees carry (cac partimento's) are hints the open lens keeps. Under
  them, **optics** (`kairotic.optics`): paths into a tree — `:voices`, `[:voice "alto"]`, `[:measures 3 5]`, `:notes`,
  `[:id x]`, a predicate — to read a part (`view`) or change it in place (`over`, `put`, `over-attrs`), with the lens
  laws as tests: `(over t [[:voice "soprano"] [:measures 3 5]] #(mt/transpose 2 %))` moves those measures and nothing else.
- **Fuller chords and Bach's inner dissonances** (Study 76; the listener found Bach by his inner voices' dissonances
  and turns, and his fuller, well-led chords). Measured on the deck of whole phrases: Bach sounds three pitch classes or
  more on 97% of his quarters, ours on 74%; his chords dissonate against the bass on 21%, ours on 9%.
  `@kairotic/rules` 0.27.0: `bach-4` 1.8.0 adds `complete` (between the voices, weight 6: a chord of two pitch classes, or
  one, pays for each missing); `figuresWeight` no longer charges a voice off the chord that comes as Bach's dissonances
  come — held from the quarter before or reached by step, the hard rules seeing to its resolution — but still charges
  twice a note whose own degree, altered, is the tone asked (the figure's accidental not taken). Study 76 realizes at
  temperature 1, as `bach-4` was measured. On 30 phrases kept out: chords complete 76% → 88% (Bach 96%), dissonant
  8% → 14% (Bach 22%). Study 71's deck of whole phrases drawn again on them. `@kairotic/cac` 0.16.18 (its pin).
- **Study 71's deck: whole phrases** (Study 76). `tools/deck-continuo.mjs` draws a deck whose trials put Bach's phrase
  against one written under his soprano alone — the figured bass and its voices of Study 76 — on the phrases the tables
  were not counted on: 120 trials, 40 of each of `continuo`, `continuo-no-keys`, `continuo-no-functions` (40 of 43,
  46 and 45 phrases realized). The page names them ("the continuo") and shows their figures in the reveal. Measured:
  their inner voices move as Bach's within a few points, but dissonate against the bass half as often (9.2% of the
  chords, Bach 20.9%) and trade notes less (2.9 exchanges per 100 chords, Bach 5.0).
- **The inner voices go as Bach's over a figured bass** (Study 76, #353). `@kairotic/rules` 0.26.0: `continuo.mjs`'
  `BACH_INNER_ROLES` counts where Bach's alto and tenor go — each one's interval over the bass, given the chord before,
  this chord, the bass's move between them and its interval before (848 contexts, the chorales but every fifth) — and
  `roleCost` reads it (1.23 bits a role on the chorales kept out, against 1.64 knowing the chord alone: the 7th of a 6/5
  down to the 3rd as the bass rises to ①, a common tone kept, the leading tone up). `bach-4` 1.7.0 weighs its inner
  voices so (`SOFT_BETWEEN`'s `bach-roles`, 2): on 39 of Bach's phrases realized on his bass and figures, the roles'
  mean cost per move falls from 0.96 to 0.84 nats (his own: 0.86). The studies with a copy of `rules.mjs` keep one of
  `continuo.mjs` beside it. `@kairotic/cac` 0.16.17 (its pin).
- **A figured ♯ played as one** (Study 76; heard by the listener). `@kairotic/rules` 0.25.1: a bass note may give its
  chord's pitch classes (`pcs`), and `figuresWeight` then asks those: a tone of the chord left out (its 5th may be) or a
  voice off it pays, a voice a semitone off a tone asked (the ♯ of a raised 3rd not taken) twice. Study 76 passes
  `under.mjs`' chords as `pcsOf`. On 25 short phrases kept out, the quarters figured with an accidental whose voices
  played the note unaltered: 10 of 38 before, 1 after. `@kairotic/cac` 0.16.16 (its pin).
- **Study 74 sings with Study 75's voice; Seikilos in the Greek system** (#467, #192). Study 74's melodies are sung by
  the voice (its notes, syllables and pitches as the system has them — a Greek tonos's cents too —, Koine for
  Seikilos's stele, Attic for Homer), the comes or the aulos played with it; a plain tone still on choice. Study 75
  sings Seikilos's song in the Iastian diatonic of `greek.mjs`, in Aristoxenus's shade or in Archytas's (g and d' 37
  and 35 cents low), the cents shown under the notes (`tuning.mjs`).
- **Study 74 · aoidos: the Greek counterpoint** (#192). In a Greek tonos, `canonic()` (the canon and the heterophony)
  and the examiner (imitation-2 on a given dux, `imitationIn`) write the comes in the same system, by canon-2's rules
  with the Greek concords (unison, 4th, 5th, octave) and `GREEK_ON`: parallel concords, direct octaves, the same
  concord on consecutive strong beats and an entry on the unison allowed. Odyssey 1.1 in the Lydian: 2,215 strict
  canons at the octave below. The aulos in heterophony keeps within a 4th of the voice (a 3rd in a church mode) and
  near it by a soft cost (`apart`, 0.3 a degree): as the engine plays it, about four beats in five in unison.
- **Study 63's page: a bass under Bach's soprano** (#353). A new section draws Study 76's engine (`under.mjs`) under
  the soprano of a phrase the tables never saw (the chorales numbered a multiple of 5): our bass and Bach's under his
  soprano as a score (Verovio; `under-score.mjs` writes the MEI — a measure a quarter, our figures in Bach's
  abbreviations, Bach's from his four voices by continuo.mjs's `figureOf`, the notes spelt by each quarter's local key),
  the local keys ours and his, how many bits a note the model gives his bass and ours, and both played (with his four
  voices too); the tables (continuo.mjs's or under-tables.mjs's), the variant and the temperature to choose. Study 63
  keeps a copy of continuo.mjs (`tests/rules.mjs` checks it). `figureText` spells each chord's notes by its letters
  (G7 in G "♮7", not "♯7").
- **Study 76 · continuo** (discussion #353): Bach's soprano given, a figured bass written under it and the voices that
  play it, beside his. The bass and its local keys are Study 63's `under.mjs` on `continuo.mjs`' tables; the figures are
  written as Bach abbreviates them (`abbreviate`, after BCFB); the inner voices are `bach-4`'s with the chords asked as
  a wish (`figuresWeight` 8). On the phrases kept out of the tables: realize, compare against Bach (bass notes, pitch
  classes, chords, inner notes), his own figures under his phrase where his continuo part survives. Kernel tests in
  Node and the browser, a page test. Studies 71 and 76 in the studies' list.
- **Where the bar starts** (issue #106). **⌥⌘-click a note** of a quantized score (alt-ctrl-click) — or
  `(downbeat! :bN t)` — says that it starts a bar: its time as played is kept in `:quant` as `:downbeat`, one event of
  the history. Tracked (`:time :track`), the beats are found again with it on a downbeat, and a kept map (`track!`) is
  found again too; with time already in beats, the quantizer now moves the bars so that it starts one (what comes
  before is a pickup). `(downbeat! :bN nil)` forgets it. The most common error on played material, the whole rhythm
  shifted by a beat or two, is now one click. Measured (`bench.mjs --asap --opts "{:downbeat :first}"`): one downbeat
  given lifts ASAP's downbeat F from 41.0 to 49.5 %; on Weimar, where the beat is mostly found at half the tempo, it
  does not help. A freqt's buffer now keeps the quantizer's newer options too (`:downbeat`, `:ref-bpm`, `:repeat`,
  `:describe`): `(quant :b1 {:describe true})` was dropped before.
- **The bass under Bach's soprano: his soprano's dissonances, his tables in plain −log** (#353, after #491 and #499).
  Study 63's `under.mjs` reads continuo.mjs's BACH_DISSONANCES: the soprano may be a suspension (held into the quarter,
  down a step after, resolved over the same bass or its octave, figured 4 3, 9 8, 7 6), a passing or neighbour note
  (over the chord before or a 4/2) or a note held over a moving bass (into a 4/2 or a 7) — each at −log of how often,
  of the soprano's quarters of that motion on that beat (under-tables.mjs's `sopMotion`), Bach makes it that
  dissonance; `chords[t].dissonance` says which. A tritone or a 7th in the bass is no longer refused, only as rare as
  Bach's. The weights for continuo.mjs's tables set again on its plain −log (chorales ≡ 1 mod 5). On the 150 held-out
  phrases: Bach's bass 2.37 bits a note, 6 phrases outside the model (13 before), note for note 22.3%, leaps 55.1%
  (Bach 54.5), ⑤–① ends 60.7% (57.3).
- **Study 73 · polyphony: following by the 88 keys** (#137, #308). kairotic.follow's dtw follower, ported as it is
  (`follow.mjs`), fed every 50 ms with Basic Pitch's posteriorgram as 88 keys or folded into a chroma. Sixteen chords
  of C and G in every register played with rubato: by the keys each chord is found within tens of ms (on ideal
  posteriorgrams a median of 6–14 ms, none skipped); a chroma hears runs of one chord and skips 10 of 15. On the
  cadence, every chord another, both follow alike. In the page, and tested in CI with the model itself.
- **The figures as a wish** (Study 76's step 2, #353). `@kairotic/rules` 0.25.0: `fourOverBass` and `fromOuter` take
  `figuresWeight`: each bass unit's chord is asked, not ordered — a realization that leaves out a tone of it, or sounds a
  tone not of it, pays the weight for each (`SOFT_BETWEEN`'s `figures`). Bach's soprano, bass and chords given to
  `bach-4` on 60 short phrases: as orders 30 can be realized (his inner notes 56%, his chords 86%), as a wish 59
  (weight 8: his inner notes 47%, his chords 68%; with no figures 32% and 38%). `@kairotic/cac` 0.16.15 (its pin).
- **The continuo tables as a plain −log** (#353, the structural thread's suggestion). `@kairotic/rules` 0.24.1: every table
  of `continuo.mjs` is −log of its frequency, no longer shifted so that each row's lowest is 0 — a shift a row of its own
  that skewed the choice between degrees in Study 63's bass under a soprano, and made its `logProb` inexact. Measured
  there (150 held-out phrases): Bach's bass 2.36 bits a note (2.37), its pitch class 38.2% (37.8%), the motion with the
  soprano closer to his; the leaps 58.7% (55.4%, Bach 54.5%), the engine's weights set on the old scale.
  `@kairotic/cac` 0.16.14 (its pin).
- **Study 75 · voice, less of a machine** (#467): its pitch and loudness waver from cycle to cycle (jitter, shimmer),
  its vibrato comes in as a note is held (`VD` in the curves), a singer's formant near 3 kHz (`ring`), and the nasals
  open the nose: a pole at 270 Hz and a zero at each nasal's antiformant (`FNZ` in the table: μ 1000, ν 1500, ŋ 2500 Hz),
  cancelling elsewhere. Jitter and the singer's formant on the page; the antiformant checked by its spectrum in CI.
- **Study 74 · aoidos written in the Greek system** (#192). `aoidos({system, final})`: a melody in a tonos of
  `greek.mjs`, its degrees counted by place from its final (`fromFinal`), the accent's rises and falls judged by pitch,
  a melisma by its size, the sound in cents; `style.mjs` reads the corpus there (`codesInSystem`). Mesomedes in the
  Lydian and Athenaios in the Hyperdorian lose their refusals of the chromatic genus; `GREEK` is fitted again to both
  (530 choices; the written note the cheapest 221 → 345 times); Seikilos, in the Iastian (final e), not in the fit,
  22 → 29 of 48 beats. The page: a Greek tonos, its genus and tuning, its final; the canon, the heterophony and the
  examiner wait for the Greek counterpoint. The aulos's drone and ison stay inside the system's two octaves.
- **Study 74 · aoidos: the Greek pitch system** (#192). `greek.mjs`: `greekSystem({tonos, genera, synemmenon, shade})`
  — the Immutable System in any of the fifteen tonoi, its genera in Aristoxenus's or Archytas's shade, notes named and
  counted by their place; the Greek concords (unison, 4th, 5th, octave) and moves judged by size; the same answers as
  `keySystem` (deg, codesIn, cents, midi, quality, melodicError…) so that aoidos can be written in it next. Tested
  against the signs of Mesomedes (Lydian) and Seikilos (Iastian).
- **Study 74 · aoidos: the Delphic paean of Athenaios in the corpus** (#192). `corpus.mjs` reads DAGM no. 20 as the
  edition transcribes it, a note as its pitch, checked against the stone's signs: 16 fragments, 273 notes, the
  melismas the stone writes as a doubled vowel; `runsOf` gives each fragment alone and `aoidos({open})` leaves a
  fragment's start and end free. The hard rules refuse 28 notes (22 the chromatic genus); the Greek style, learned from
  Mesomedes alone, makes the paean's notes more likely (the cheapest 144 → 187 of 317 times). Only the melodies and the
  readings are kept, with their references.
- **Chords that sing a syllable, and chords through the MEI and back** (#192, #217). A chord sings its syllable as a
  note does: on its attributes (`[:chord {:dur 1 :syl "Ἄν" :wordpos :i} …]`), written as the `<verse>` of the
  `<chord>` (not of one of its notes) and read back from it — or from one of its notes, in a MEI from elsewhere. A
  melisma goes on over chords too (the next chord struck with no syllable, a tied chord's piece no new one), so the
  extender is derived before them. Tested: a chord tied across the bar line, with and without text, tree → MEI → tree
  and MEI → tree → MEI (there was no test of chords through the MEI before). **Fixed:** a chord read from a MEI came
  back with no notes (each note was read as a layer, its children: none); now its notes, their `<accid>`s too.
- **Bach's dissonant quarters, read** (Study 76, for the bass engine of #487). `@kairotic/rules` 0.24.0's `continuo.mjs`:
  `dissonanceOf(phrase, t)` reads a quarter that is no chord as a chord and the one voice not of it, by how that voice
  moves (`motionOf`: a suspension, up or down, a note held over a moving bass, a passing or neighbour note, an
  appoggiatura, an escape, an anticipation); `BACH_DISSONANCES` counts each by voice, motion, interval and beat. Of
  Bach's 17,941 quarters 1,719 are no chord: the alto's 958, the tenor's 438, the soprano's 174 (in 159 phrases — the
  ones a bass under his soprano cannot yet follow: a 4–3 on a strong beat the commonest), the bass's 147.
  `@kairotic/cac` 0.16.13 (its pin).
- **The bass under Bach's soprano reads the chorale thread's tables** (#353, after #485). Study 63's `under.mjs`
  takes `continuo` (@kairotic/rules' continuo.mjs, or its tables): BACH_DEGREE_CHORD for the chord over a degree and
  the degree, BACH_OUTER_VERTICAL, BACH_OUTER_PAIR for the two voices' moves together (in place of the motion, the
  held bass and the step), BACH_CADENCES for the fermata's two quarters; which chord a figure is, a leap's size and the
  key a phrase begins in stay under-tables.mjs's. On the 150 held-out phrases (`UNDER_COSTS=continuo
  tools/under-measure.mjs`): Bach's bass 2.37 bits a note (2.39 with under-tables.mjs alone), note for note 22.6%
  (21.7), leaps 55.4% (62.1; Bach 54.5), ⑤–① ends 60.0% (Bach 57.3); held 12.1% (Bach 9.9).
- **Bach's own figures, and the chorales read as a figured bass** (Study 76 · continuo, #353). `studies/_shared/chorales/figures.json`:
  the figures of Bach's continuo parts for 562 of the corpus's phrases (93 chorales), from the Bach Chorales Figured Bass
  dataset (Ju et al., ISMIR 2020, after the NBA; CC BY 4.0), each phrase found in its chorale by its soprano and its bass
  (`tools/bcfb.mjs`). `@kairotic/rules` 0.23.0's `continuo.mjs`: a quarter's chord over the bass (`chordOf`) and the figure
  Bach would write for it (`figureOf`: 85% of his figures over a struck bass, the restated 5s and 8s aside; the rest
  mostly what he left unfigured), and the tables counted from the chorales but every fifth (kept out to measure against;
  `tools/continuo.mjs`): the soprano over the bass (`BACH_OUTER_VERTICAL`), their moves together (`BACH_OUTER_PAIR`), the
  chord over each degree of the bass in the key the quarter is in (`BACH_DEGREE_CHORD`, major and minor), the cadences
  (`BACH_CADENCES`). `@kairotic/cac` 0.16.12 (its pin).
- **A bass under Bach's soprano: the engine of Study 76 · continuo** (#353). Study 63's `under.mjs`: the bridge of the
  outer voices with the soprano given at every quarter — each quarter's state (local key, bass note, chord over it),
  drawn exactly (backward messages) — `bassUnder({soprano, key, strong, fermata, costs, weights, variant})` →
  `{bass, figures, chords, keys}` a quarter, and `underBridge(…).logProb(bass)`, the probability of a given bass, every
  chord and key under it summed. Hard: the soprano a chord tone, the bass in its range and below it, no tritone, 7th
  or augmented 2nd leaps nor wider than the octave, no parallel or direct 5ths and octaves between the outer voices.
  Soft, −log of how often Bach does it (`under-tables.mjs`, counted by `tools/under-tables.mjs` in each quarter's own
  key, the chorales numbered a multiple of 5 left out — the chorale thread's tables replace them through `costs`):
  the chord over its bass degree by mode, the soprano over the bass, their relative motion, the bass's move, held on
  strong or weak beats, the cadence's bass and chord, the key it begins in; the functions in the local keys; the
  local keys moving as Bach's (`KEY_MOVES`); the economy of the bass's figures. Variants `all`, `no-functions`,
  `no-keys`, `no-economy`. `figureText` writes the figures against the key signature (♯, ♭, ♮; not yet Bach's
  abbreviations). `tools/under-measure.mjs`, on 150 held-out phrases: Bach's bass note for note 21.7% (its pitch class
  36.5%), Bach's bass 2.39 bits a note under the model (no-keys 2.85); figures 5/3 61.5% (Bach 54.4), 6/3 15.9 (23.1),
  7 8.4 (5.1), 6/5 7.4 (5.1); held 7.7% (9.9), steps 30.2% (35.6), leaps 62.1% (54.5); ⑤–① ends 54.7% (57.3; no-keys
  38.0).
- **The motive layer, step 3: compression in the core.** `kairotic.compress` is Study 66's shortest description of a piece
  (figures, motifs and repeats as rules, minimum description length, always written out again the same notes), and
  `kairotic.bits` the measure of `@kairotic/rules`' `bits.mjs`, so that a description is counted in bits as a listener
  hears it (`code-length`). Describing a tree (`:describe true`, `motif/annotate`) now writes on its root, in the
  analysis layer, `:compression {:bits :raw :ratio :rules}`: how much of what is written its own formulas say — a
  diagnosis, not a preference. Bach's C major prelude: its five-note broken chord used in 32 bars, 16 % of the bits;
  folk melodies 65 to 98 %. Tests: Study 66's, ported (`tests/cljs/compress.cljs`).
- **Lyrics in the app's MEI ↔ tree, drawn under the notes** (#192). `mt/->mei` writes a tree's syllables (the lyrics
  layer: `:syl`, `:wordpos`, `:con`, `:verses`) as MEI's `<verse n><syl wordpos con>` on the note that begins each one
  — the hyphen and the extender derived where `:con` is not written (`mt/with-cons`) — so Verovio engraves them under
  the notes in a tree box's score. `kairotic.mei/<-mei` reads them back (a MEI from elsewhere, or a study's export, too;
  the line of cents is not taken for a verse), leaving out each `:con` that is the derived one
  (`mt/without-derived-cons`): tree → MEI → tree gives the tree, MEI → tree → MEI the MEI; the extMeta keeps nothing of
  them. The layer is shown by default: a box hides it with its **lyrics** chip, the code window's **Lyrics** button or
  `(show-layers :b3)` (and shows it with `(show-layers :b3 :lyrics)`); its `:shows` keeps the layers turned from their
  default, so works saved before keep their layers.
- **Study 75 · voice** (discussion #467): a sung line made of parts that can be read, instead of a neural voice.
  Syllables (Seikilos's song, or an MEI from Study 74 with its text under the notes) → phonemes in a chosen
  pronunciation (Attic or Koine) → each phoneme's targets from a table shown and edited as EDN → curves every 5 ms
  (consonants before the beat, stops as closure, burst and aspiration, formant glides, F1 raised over a high pitch) →
  two faust~ following them: the voice (a glottal source through four Klatt resonators) and the noise (aspiration
  through the same formants, frication, bursts). Kernel tests in Node; the two faust~ checked by their spectra in CI.
- **Study 74 · aoidos: the singer with an aulos** (#192). `aulos()`: in heterophony the aulos plays the melody at once
  with its own deviations, within a 3rd of the voice (`canonic()` with the comes entering at once — a rule of its own
  reads the voice's note at the same beat —, imitation 0.6), the two counted together; as a drone, the final an octave
  below; as an ison, each line held on the note it ends on. The page: three ways to sing with the aulos, heard as a
  reed. Fixed: in canon the Greek style was passed to the canon's engine as one of its own styles.

- **The lyrics layer, and the cents on a line of their own** (#192). `kairotic.mt`'s schema has a layer `:lyrics`:
  the text a voice sings, on its notes — `:syl` (the syllable a note begins, verse 1; the notes after it with none
  sing it on), `:wordpos` (`:i`, `:m`, `:t`), `:con` (where not derived), `:verses` (the verses after the first) —
  read by `(schema :tree)`, `without-layers` and `with-layers` like the others (`mt/lyrics-keys`). A note's cents off its name, which `mt/->mei` writes under it, are now a verse of
  their own (`type="cents"`) on the line after its staff's lyrics, so they will not take a verse of the text.
- **Study 71's deck with a sixth variant, `no-keys`** (#477: the bridges without tonicizations, every unit in the
  chorale's key): 240 trials, `bach-4` filling 40 of 53 `no-keys` phrases tried (the others 40 of 42–45). The deck
  carries when it was `drawn`, and each answer the deck it answered: the scores count the answers to this deck only,
  those to earlier ones kept and said, not counted (a deck drawn again is other bridges).

- **Study 74 · aoidos: a Greek style learned from Mesomedes** (#192). `corpus.mjs`: Mesomedes's hymns with music (DAGM
  nos. 24, 25, 27, 28), sign by sign with their chronoi, the notes the editors supply and the lines only N carries
  marked. `style.mjs`: the engine's choice as a softmax of −cost over the notes its hard rules allow, the weights fitted
  so that what Mesomedes wrote is most likely (a conditional logit with a pull towards the engine's own weights).
  `GREEK` (`aoidos({style: "greek"})`): leaps dear, a note struck again free (up to eight times), a melisma dear, no
  turn asked after a 4th or a 5th (`turnAfterSmallLeap`). Seikilos, held out, becomes more likely. The engine takes a
  given rhythm (`time`) and altered notes (`chromatic`). Tests: `tests/style.html`; the page: a style to choose.
- **The chorale test's sixth variant, `no-keys`** (#353). Study 63's `outer.mjs` draws bridges without a path of keys
  — every unit in the chorale's key, the rest as `all` — so the blind test can hear how much the tonicizations do.
  `tools/bridges.mjs` can draw one variant by itself (its last argument) and `tools/merge.mjs` puts it in place in
  `bridges.json`.
- **Study 74 · aoidos exports its text under the notes** (#192). `export!` sends the dux with its syllables: each
  syllable's text on the first note of its melisma, its `wordpos` from its word (`i`, `m`, `t`; none for a word of one
  syllable), through the kernel's `lyricNotesOf`; the app's MEI has them as `<verse><syl>` (the text and the
  scansion stay in the extMeta). Tested in the kernel's tests (Odyssey 1.1: ἄν-δρα μοι ἔν-νε-πε Μοῦ-σα) and the page's.
- **The studies' export writes lyrics** (#192, #319). In `studies/_shared/export.mjs` (and its copies beside every
  study's kernel) a note may carry the syllable it begins — `{name, units, syl, wordpos, con}` — and the syllables of
  the verses after the first, `verses: [{syl, wordpos, con} …]` (a strophe and its antistrophe); `exportMei` writes
  them as MEI's `<verse n><syl wordpos con>` on the note, on its first piece when it is cut at a bar line and tied.
  The notes after it with no syllable of that verse sing it on (a melisma); `con`, when not given, is a hyphen (`d`)
  after a word's first or middle syllable, an extender (`u`) after its last one (or a word of one) when a melisma
  follows. Tested in `tests/export.mjs`: syllables, melismas, a word over three notes, a tie, two verses.
- **The blind test's deck drawn on bridges that tonicize** (Study 71; `@kairotic/rules` 0.22.1, `bach-4` 1.6.1;
  `@kairotic/cac` 0.16.11; discussion #353, #466). The bridges now carry their keys (a key a unit) and tonicize ii, V,
  vi and IV as Bach does; `fill` reads them, so the inner voices may take a tonicization's leading tone. `bach-4` fills
  89–98% of the bridges tried (before 55–58%). With the keys the inner voices kept fewer dissonances (15.7% of the
  chords, Bach 21.8%): `bach-vertical` weighs 1 (was 1.5) — now 19.4%.

- **The chorale test's bridges tonicize, and say their keys** (#353). Study 63's `outer.mjs` draws for each bridge a
  path of keys (`keyPathFor`), one a unit, on Bach's own moves between keys (`KEY_MOVES`: phrases.json's keys, each
  against the chorale's — in major ii, V, vi and IV, in minor iv, III, VII and v), from the key his phrase begins in to
  the one it ends in, a move four times as likely as there (`KEY_RATE`: the corpus's keys, read by scales over spans,
  miss his quick tonicizations); the outer voices go through it (`unitKeys`): each unit's notes in its key, a
  succession read in the keys of its two units, a key entered on its dominant with its leading tone in the soprano or
  the bass. In minor, the outer voices' ⑥–⑦ go up raised and come down natural, a natural ⑦ next to ① dearer — as
  Bach writes them. In major, per 100 chords, a leading tone rising in the soprano 1.4 (Bach 1.1) and in the bass 2.3
  (Bach 3.7; before 1.2, toward V alone), toward ii, V and vi. Every bridge carries its `keys`, and Study 71's fill reads
  them: with them bach-4 fills 87% of single draws (without, 50%). `bridges.json` drawn again.
- **Study 71 reads its variants from the bridges** (discussion #353): the deck, the listenings, the scores and the page
  take the variants `bridges.json` has (`variantsOf`: Study 63's known ones in their order, any new one after them), so
  a layer Study 63 turns off — `no-keys`, the bridges without tonicizations — is compared as the others with nothing
  changed here; `deck.json` keeps its `variants`.
- **Study 74 · aoidos: melismas, and Seikilos's rhythm** (#192). The melody is written a beat at a time (`solveVoices`
  with one voice, its memo keyed by what the rules read: the syllable's notes, the pitch sounding and the one before,
  how often it was struck): a syllable may take up to three notes (`melisma`, by step or a 3rd), the accent judged on
  each syllable's notes (a circumflex on one note costs half). `prosody.mjs`'s metre `seikilos` — twelve chronoi a
  line, the last syllable and then the longs from the end lengthened — gives the stele's rhythm syllable by syllable;
  the stele's melody keeps every hard rule of the engine. In canon melismas open the entry two beats later (Odyssey 1.1,
  strict: 1,934,946); a new syllable strikes a new pitch there. The page: notes a syllable, the metre, the stele's melody.

- **Study 74 · aoidos: Seikilos's own melody against the rules** (#192). `seikilos.mjs`: the song as the stele has it
  (Pöhlmann and West, DAGM no. 23), sign by sign with its chronoi. Its rhythm is the quantities `prosody.mjs` reads
  (every long syllable 2 or 3 chronoi, every short one 1, each line twelve) once a stop and a liquid across words count
  as common (ὁ χρόνος); its melody keeps the accent rules 4/5 (rise to the acute), 9/10 (the word's highest), 3/4 (the
  circumflex falling), 5/6 (a fall after the accent), 4/6 (no fall after a grave). Tests: `tests/seikilos.html`.

- **Only the code** (discussion #407): ‹ under the splitter's › (or Ctrl/⌘+Shift+L) hides the patch, and the Live view
  takes the whole work; the patch is not drawn meanwhile (the sound, the history and the REPL go on) and › brings it
  back. **⇆ work** shows beside the code the work as data as it is now. The views of the Code tab are now **Work**,
  **Live** and **EDN** (were Calls, Live, Data). `(code-only true)`, `(live-mirror true)`.
- **The Code tab writes the work as data** (discussion #407, plan step 5): **[:=> data]** writes the boxes and lines
  as chains of box vectors — `(=> {:b1 [:osc- 220]} {:b2 [:gain- 0.2]} [:_ :_] {:b3 [:dac- 1 2]})`, each box by its id
  the first time, `[:to o box i]` for other ports, the boxes alone after — and `(places {…})`; applied, the same work.
  A box's text a vector would not write again exactly stays a string. Applying code builds each chain or voices value
  it gives (plain: no records of what live code made); `(code-style! :data)`.
- **Faust as data: names, feedback, voices** (discussions #407, #115): in `[:faust- …]`, `{:lfo [:os.osc 5]}` defines
  `lfo` once and `:lfo` is it after; `[:rec a b]` is `a ~ b`; a first map `{:nvoices 8 :effect …}` makes it polyphonic,
  with `:freq`, `:gain` and `:gate` each voice's own and `:effect` applied to their sum — played by a `player`.
- **Patterns as data** (discussion #407): a box that keeps a source takes it as its last argument — a map for a `pbind`
  (`[:pbind 7 {:degree [0 2 4] :dur #pat/euclid [3 8]}]`), a string for a code box —, written only if it changed; the
  `#pat/…` generators are read in live code as tagged literals, printed as written; a `player` takes a nested pattern
  on its right inlet and, as a `keyboard`, leaves its Hz and voice ids together to the next box of a chain.
- **Faust as data** (discussions #407, #115): `[:faust- …]` is a `faust~` box whose `process` the same grammar writes —
  `[:faust- [:os.osc (=> [:os.osc 5] [:* 10] [:+ 440])] [:* 0.1]]` is `process = os.osc((os.osc(5) : *(10) : +(440))) :
  *(0.1);` —: a box is a function with its first arguments given, a chain `:` (`<:` before a vector, `:>` after it), a
  vector `,`, `:_` and `:!` Faust's wires, a string Faust code as it is. Evaluated again, the code is written only if it
  changed. `(faust-code …)` gives it.
- **Arguments that are boxes** (discussion #407): in a patch as data an argument can be a box, a chain or a named box,
  made and wired to the inlet that argument sets — `[:osc- (=> [:metro 250] [:counter 1 72 60] [:mtof])]` —, the one
  after the left as in Pd and Max unless the class says another (`osc~`, `phasor~`, `sig~`: the left one).
- **A patch as data is a value** (discussion #407): `=>` is a pure function that writes `[:=> …]` and changes nothing;
  the Live view (and ⇧+Enter in the Code tab) plays each form whose value is a chain or voices, and `(play value …)`
  plays it anywhere, starting the engine if it is not running. So chains nest — `(=> [:mtof] (=> [:ftom] [:mtof 3]))` —
  and are kept, made by functions and joined as any data; voices are just a map, `{:frame {…} :lead (=> …)}`, and
  `(play {})` stops them all.
- **Live code as data** (discussion #407): a patch written as plain EDN, which Clojure's reader and any editor read,
  played with one function, `=>`: `(=> {:osc [:osc- 220]} [:gain- 0.2] [:_ :_] [:dac- 1 2])`. A box is a vector of its
  class and arguments, as hiccup writes a tag, a class with `~` written with `-` (`[:osc- 220]` is `osc~ 220`); `=>` in
  series, a vector that is not a box in parallel, `:_` a wire (Faust's `:`, `,`, `<:`); a map names a box; `#_` leaves a
  box out. **Voices**: `(=> {:frame {:out [:dac- 1 2]} :lead [:=> … :out]})`, each chain known by its key as `d1` in
  Tidal, a voice taken out of the map stopped, `:frame` the ins and outs every voice uses (or a line's `inlet~` and
  `outlet~`). A chain owns the boxes and wires it made: evaluated again, only what changed changes. The forms written
  as lists (`(osc~ 220)`, #451) are gone: one grammar, data. `->` and `doto` are Clojure's own again.
- **One clock for every box that keeps time: `transport`** (discussion #450, piece 3; `@kairotic/net` 0.2.0,
  `@kairotic/patterns` 0.3.2). Where `pulse` counts the room's beat, `transport` says where it is — `[:sync t0 bpm]`,
  the audio-clock time of beat 0 and the tempo — and a `player` that gets it plays on that grid: it joins on the next
  beat (or multiple of its quant) from the beginning of its pattern, follows every change of tempo without a jump
  (the next tick moves), and joins again after a jump; stopped by hand it waits for `start`, `[:sync]` lets it go. So
  a pattern, a canon from `comes` (piece 2) and the players of every page in a room play on one beat. A beat on
  `transport`'s right makes it follow a performer instead: `follow`'s written beat or `phase`'s `{:phase :n :pulse}`
  (its cycle unwrapped), the tempo fitted to the last `smooth` (4) beats heard; `:room` goes back to the room.
- **The bridges' dissonances as rare as Bach's, his melodic minor's raised ⑥ as seldom** (`@kairotic/rules` 0.22.0,
  `bach-4` 1.6.0; `@kairotic/cac` 0.16.10; Study 71). Heard by @bonuoq: dissonances that did not seem justified. The
  inner voices dissonated against the bass twice as often as Bach's, with seven times his semitone clashes (a ♭9, a
  major 7th) — mostly notes held into a dissonance and neighbours. Two of the species' rewards (`passing`,
  `suspension-life`: "the life of second and fourth species") are off in `bach-4`, and a voice weighs what it sounds
  against the bass by Bach's own frequencies (`bach-vertical`, 1.5: −log of how often his alto and tenor sound each
  interval, `BACH_INNER_VERTICAL`), its moves weighed more (`bach-motion` 4) so it does not leap to keep consonant,
  the voice exchange more (4). In minor, the raised ⑥ in an inner voice costs (`raised-sixth`, 2), more where it does
  not go on up. In the deck: chords with a dissonance 18.1% (Bach 21.8%, before 37.7%), semitone clashes 1.7 per 100
  chords (Bach 1.7, before 9.8). Study 71's `fill` reads a bridge's `keys` (a key a unit) where it has them, so its
  inner voices may take a tonicization's leading tone, as Bach's do. Bach's phrases judged as before (504).
- **Study 74 · aoidos** (discussion #192): a poem sung syllable by syllable. `prosody.mjs` reads polytonic Greek —
  syllables, quantity (by nature, by position, doubtful; the laws of the accent; epic correption), accents — and scans
  a line (hexameter, pentameter, iambic, free; synizesis), the scansion its time (a short a beat, a long two, held).
  `aoidos.mjs`: the melody as one voice of `@kairotic/rules` (`solve()`), the accent as costs (rise to the acute, the
  accent the word's highest, the circumflex falling, a fall after the accent; `strict` makes the peak and the
  circumflex hard), an examiner that tries a melody as the dux of `cac imitation`, and `canonic()`: the dux written
  with its comes on `canon-2`, the singer choosing among the comes's futuribles (Odyssey 1.1 in strict canon at the
  octave below a foot later: 4,285 canons).
- **The rules as the judge of a pattern** (discussion #450, piece 2; `@kairotic/cac` 0.16.10). A pattern on `comes`'s left
  inlet (a `pbind`, a `pattern` box) gives a pattern on a new outlet 5, for a `player`: each note with a pitch is the
  dux's note asked for, kept or corrected to the nearest one that keeps the rules and leaves a future (the same `play`
  as a note played into the box), sounding with the comes's beside it — a chord `[dux comes]` in `:freq`, and what was
  done in `:counter {:dux :comes :asked :corrected :reason}`. Rests and events without a pitch pass as they are; a
  finished canon begins another; the chance (temperature, seed) the box's, so every tab makes the same stream. With
  `imitation` below 1 the comes is free counterpoint over the pattern's line. `api/make-pattern` for components.

- **Quantize → describe → annotate** (step 2 of the motive layer; #108). With `:describe true`, the quantizer writes on
  what it wrote its motives: `kairotic.motif/motives` finds spans of 3 to 5 notes that come back repeated, transposed,
  in sequence or inverted (with their rhythm, augmented or diminished), in the same voice or another (an imitation),
  the one covering most notes first; `annotate` writes `:motif` (the label) and `:motif.rel` (how a return is related
  to the statement) on their first notes, two new keys of the analysis layer (#382). The score draws them above the
  notes. `api/motif-annotate` for components. Docs: `docs/mt.md`.
- **The chorale test's outer voices move as Bach's; every bridge fillable** (#353). Study 63's `outer.mjs` costs each
  voice's move by how often Bach's soprano and bass make it (`BACH_OUTER_MOTION`: −log of the frequency of a move of
  0…13 semitones in the corpus, times the temperature, so the draw moves as often as he does), in place of the fixed
  step/leap/repeat costs. Over the corpus (`all`): the soprano keeps its note 18% of the time (was 2%; Bach 22%), the
  bass leaps a 3rd or more 48% (was 24%; Bach 53%), oblique motion 18% (was 3%; Bach 25%); similar motion no dearer
  than contrary, the tessitura looser. `bridgesFor`'s `accept` draws a bridge again until it says yes, and
  `tools/bridges.mjs` asks whether bach-4 can fill the inner voices (fromOuter's count above 0) — `fillable` on every
  bridge (20,155 of 22,690, 89%; was 55–58%), false where ten
  draws could not; the tool runs in shards (`tools/merge.mjs`). `bridges.json` drawn again.
- **Live code as forms** (discussion #407): a box is the form it reads as — `(osc~ 220)` is the box `osc~ 220`, `(map
  inc)` the box `map inc` —, so live code needs no `box`, quotes or ids: `(-> :osc (gain~ 0.2) [_ _] (dac~ 1 2))`. The
  grammar of Faust's `:`, `,` and `<:`: `->` in series, a vector in parallel (a split after one wire, wire by wire
  after as many), `_` a wire that goes on, a box after several wires taking them on its inlets 0, 1…; `(def osc (osc~
  220))` a box by a name; `~expr` a value computed now. A chain owns the boxes it made, as it owns its wires: evaluated
  again, each form takes the box it made with the same class, so a number changed is one text, a box put in the only
  new one, a box taken out deleted. At the top level a command or Clojure function is code; inside a chain every list
  is a box. The Live view's example is written so; the whole tab can be too (`run-form`, `forms-code?`).
- **Study 73 · polyphony** (discussions #137, #308): the first ONNX model run in the page — Spotify's Basic Pitch
  (Apache-2.0, code and weights), from jsDelivr, checked by its SHA-256 and kept in Cache Storage, through ONNX Runtime
  Web 1.20.1 in a worker (`onnx.mjs`: a session from a URL, a run with arrays, the API #137 proposes). Its windows and
  its way of reading notes ported to plain JS (`basicpitch.mjs`, under Basic Pitch's own licence); the notes read again
  as the thresholds move, without running the model again. On a cadence rendered in the page the notes are scored
  against what was written, and each chord heard against itself with a note an octave off: the 88 keys tell them
  apart, a chroma cannot — what the followers of #308 would gain. Not in the app yet (after 0.3.0-alpha).
- **`kairotic.motif`: one motive module for the whole system** (discussion: one motive layer; issues #108, #309). Study
  60's motives move into the core: notes from a melody or from notes as played, Conklin's viewpoints, the exact
  relations (repetition, transposition, sequence, inversion, retrograde, with the rhythm kept, augmented, diminished or
  another), a kinship by weighted edit distance, `find-in`, `discover`, the memory of the work and the sweet spot. For
  played time, rhythms are compared by their onsets within a tolerance. `returns` groups a rhythm played several
  times: the quantizer's repetition (#108) is now that case of it. In the API as `api/motif-notes`, `api/motif-relate`,
  `api/motif-find` and `api/motif-discover`. Tests: Study 60's, ported (`tests/cljs/motif.cljs`).
- **The blind test's bridges between two of Bach's chords, their inner voices moving as his** (`@kairotic/rules`
  0.21.0, `bach-4` 1.5.0; `@kairotic/cac` 0.16.9; Study 71). A bridge now begins and ends on Bach's chords whole: the
  alto and the tenor given there (`fromOuter`'s `inner`, `fourOverBass`'s `given.alto` / `given.tenor`, where a unit has
  a note) — before, only 31 of 200 began on his chord. `bach-4`'s voices weigh each move by how often Bach's alto and
  tenor make it (`bach-motion`, weight 2: −log of its frequency in the chorales, `BACH_INNER_MOTION`), so the voice that
  takes each chord tone is the one whose line it suits: in the deck the inner voices keep a note, step, leap a 3rd, a
  4th or wider 30.9 / 40.9 / 13.9 / 9.3 / 4.9% of the time, Bach's 30.0 / 40.5 / 18.2 / 7.6 / 3.7% (before: 20 / 41 /
  14 / 12 / 13). And a **voice exchange** costs less (`voice-exchange`, weight 2, `bach-4` 1.5.0): an inner voice and
  another trading their notes in contrary motion, over one unit (a 3rd or 6th each way) or two (a passing note
  between) — the chord kept and each line moving where one voice alone would leap, a shortcut of four-part writing;
  the bridges do it about as often as Bach (with an inner voice, 9 chords in 100). A kept note is struck again, as Bach mostly does, unless it is held into a dissonance. The deck drawn
  again: `bach-4` fills 55–58% of the bridges tried. Bach's phrases judged as before (504).
- **A tree as the events of a pattern** (discussion #450, piece 1; `@kairotic/patterns` 0.3.1). `:tree` in a pbind is a
  musical tree whose notes are its events (`:midinote :sustain :dur :voice :amp`, in time order, `:dur` the time to the
  next onset — 0 for notes that start together —, a silence first when it does not begin at 0), every other key going
  on over them note by note: `{:tree … :dur #pat/euclid [3 8]}` its pitches on a tresillo, `{:tree {:of … :voices
  [0]}}` some of its voices. A tree on a pbind's inlet (a tree box, `cac partimento`, `comes`, a transcription)
  becomes its `:tree`; `(ptree t)` in a `pattern` box. The way back of `render` (#93): what cac writes can now be
  played by a `player` and varied with the generators.

- **A rhythm that comes back is written the same way** (issue #108, point 2). The quantizer finds the spans whose onsets
  fall at the same places, prefers for all of them the division of their mean (`:rep` 1 for another; `:repeat` the
  tolerance, 0.08 of the span; `:repeat false` for none), and so writes a repeated rhythm alike each time. On the
  benchmark, onsets gain up to 2 points and durations up to 7 (Essen rough 57.9 → 64.7 %); Weimar 66.6 → 67.2 %.
- **Study 72 · reveal** (discussion #407): a live-coding set is only code while it is played; at the end it reveals
  its patch, drawn by its flow (`layout.mjs`: a layered drawing after Sugiyama — rows after what feeds them, the order
  uncrossing the wires, each box under what feeds it; the app's example work in seven rows with no crossing), and its
  history on a time axis, every change a tick and every segment a row. The set can be played again from any point, at
  ×1–×64, as it was, with its silences shortened or a step each change, and from another branch. A short set is built
  in; a `.kairotic` exported from the app opens too.
- **Study 71 · blind: the chorale test** (discussions #353, #399). A phrase of Bach's and a bridge — Study 63's outer
  voices from its first chord to its last, the alto and the tenor by `fromOuter` (`bach-4`) — heard one after the
  other: which is Bach? Five variants of the bridges (`all`, `no-functions`, `no-tension`, `no-economy`, `arch`); a
  deck of 200 trials drawn once (`studies/_shared/chorales/deck.json`, `tools/deck.mjs`), the same for every listener;
  the scores by variant with their 95% interval and an exact binomial p against chance; answers kept in the browser,
  exported and pooled. `bach-4` fills 63–82% of the bridges tried (`arch` the most); the rest it cannot, most often for
  a leap wider than the octave or a weak-unit dissonance not passing by step.
- **A voice no longer meets the bass a semitone under it** (`@kairotic/rules` 0.20.1, `bach-4` 1.3.1;
  `@kairotic/cac` 0.16.8). `from-bass`'s `unison: "any"` took the bass's letter lowered (D over D♯) for a unison; it is
  below the bass. Bach's phrases are kept as before (504).

- **The tonal functions in Bach's local keys, as a cost; and a plagal ending** (`@kairotic/rules` 0.20.0, `bach-4`
  1.3.0; `@kairotic/cac` 0.16.7; discussion #353). `functions` reads each unit in its own key (`local`: the bass
  note's — the corpus's `keys`), two units in different keys kept where either key reads them well, and lets a passing
  chord pass (`passing`: an inverted chord over a bass going on by step, V – IV6 over ⑤–⑥). Read so, Bach breaks the
  grammar in 78 of his 2,272 phrases (136 in the chorale's key): in `bach-4` it is a cost (`SOFT_BETWEEN`'s
  `functions`, weight 2), no longer a refusal, and `bach-4` keeps **504** of his phrases (494). A style's soft rules
  between the voices take their weight by their id (`weights`). `chorale-4` as it was. Study 56's figuring (and its
  copies) knows a **plagal ending**: `ending: "plagal"`, the bass ④–①, IV a 5/3, the melody 5–8 (the tonic held),
  3–5 (⑥ to ⑤) or 8–3 (④ to ③).

- **The chorale test's tension: Bach's profile, the arch a variant** (#399, #353). Study 63's `outer.mjs` draws the
  implied harmony's tension toward the corpus's profile (`PROFILE`, `profileOf`: Bach's mean tension by tenth of a phrase,
  read in the cadence's key — 5.9 6.7 6.6 6.9 6.5 6.7 6.9 6.6 6.0 0.6, a plateau released at the cadence), the same
  for every phrase, so none of a phrase's own curve leaks into its bridge; the generic arch (rising two thirds of the
  way, released into B) is kept as a variant, `arch` (`target: "arch"`), for the blind test to compare.
  `studies/_shared/chorales/bridges.json` drawn again: five variants per phrase.
- **A chain owns the lines it wrote** (#432, discussion #407). A chain (`->`, `doto`) evaluated from the Code tab
  (a form, or a block of calls that make the patch) takes away, when evaluated again, the lines it wrote before and no
  longer writes, in the same event: put a box into `(-> :osc (to :amp …) (to :out …))` and the old line goes. A chain is
  known by the box it starts from; lines made otherwise stay; what each chain wrote is kept in this browser for each
  work (`build-forms`, `owned-lines`).
- **The Code tab writes the work in chains by default** (#433, discussion #407): lines that follow each other as
  `(-> :b1 (to :b2) (to :b3))` and `(doto …)`, a `connect` for a line alone; **-> chains** off writes a `connect` for
  each line. Links, the clipboard, Claude and the agents keep reading and writing the work flat. The tutorial *From
  patch to code* and the guide say so.
- **Bach's 7ths, and his notes spelt in their keys** (`@kairotic/rules` 0.19.0, `bach-4` 1.2.0; `@kairotic/cac` 0.16.6).
  `bach-4` keeps 494 of Bach's 2,272 phrases as he wrote them (1.1.0: 426). `dissonance`'s `bachSevenths`: a 7th held
  while the bass moves under it into a consonance (ii7 → I6, vi7 over the bass rising a step), up by step where the bass
  takes the note it would have gone down to (V7 → I6, V4/3 → I6), free where the bass takes the 7th itself. And a
  note given with a key — a bass note's `key`, `fromNotes`'s `code(m, t)`, the soprano given — is spelt in it
  (`degreeIn` in `tonal.mjs`): F in A minor where the chorale is in G, not E♯, which read a 6th as a 7th.
  The corpus keeps **Bach's own spelling**: `names` beside `satb` (`"F#4"`, `"Bb3"`, as Sapp's edition writes them),
  and a name in each note of `lines`; the engine reads a note as it is spelt — a bass or soprano note's `name`,
  `fromNotes`'s `code("F#4")` — (486 phrases kept spelling the MIDI numbers in their keys, 494 as Bach spelt them).
  `chorale-4` and the book's studies as they were.
- **The chorales' phrases in their keys** (#301, #399). Every phrase of `studies/_shared/chorales/phrases.json` has
  `keys`: the key each quarter is in, read from the four voices (`localKeys` in `tools/kern.mjs`: among the chorale's
  key and its neighbours, the path whose scales hold most of the notes, a change of key costing as one note out; in
  minor the natural ⑦ is the relative major's). 0.45 changes a phrase; nearly half the phrases (1,058) end in another key than the
  chorale's. Judged in them, Bach's inner voices are kept by `bach-4` in 426 of 2,272 phrases (in the chorale's key:
  234) — `tests/chorales.mjs` gives the bass's notes their keys, as `fromOuter` takes them.
- **The chorale test's outer voices, for the whole corpus; the functions read in local keys** (`@kairotic/rules`
  0.18.0: `localFunctions`, `relatedKeys`, `grammarErrors`' `passing`; Study 63 · bridges; #399 / #353).
  - **Against Bach:** his 2,272 phrases read in the home key alone break the grammar in 491 phrases (an applied
    dominant read in the wrong key, a passing V – IV6); read in local keys — each chord in one of the keys related to
    the chorale's or in the cadence's, a change of key costing — with passing chords (an inverted chord over a bass
    by step), in 161 (7 %). `localFunctions` gives each chord its key, its function and the errors left.
  - **Study 63's outer voices:** a succession is grammatical where it is so in one of those keys; the tension read
    in the cadence's key. Bach's own outer voices break the local grammar 0.09 times a phrase, the bridges with all
    their layers 0.07 (150 phrases).
  - **`studies/_shared/chorales/bridges.json`:** for every phrase, two draws of each variant (all layers, each
    off), as `fromOuter` reads them (CC BY-NC-SA, as `phrases.json`).
- **`bach-4` learns from Bach** (`@kairotic/rules` 0.17.0, `bach-4` 1.1.0; `@kairotic/cac` 0.16.5). Judged on the
  corpus, Bach's own inner voices: 234 of his 2,272 phrases kept as he wrote them (1.0.0: 112). The voices' ranges as
  his, the same in every key (a style's `ranges`, in MIDI: soprano A3–A5, alto E3–D5, tenor C3–A4); a passing tone
  against a bass that moves too (`dissonance`'s `overStruck`), a neighbour note (`neighbour`), a note held into a
  dissonance as the bass moves under it on a weak unit, down by step after (`weakHeld`); direct 5ths and octaves free
  in the inner voices (`parallels` `direct: "outer"`). `chorale-4`, the book's, is as it was.
- **The `paths` box: an open form in the app** (`@kairotic/analysis` 0.9.0; discussion #212, Study 70). A work of
  fragments and rules of succession, `[:open {:start :any :end {:repeat 3}} [:frag {:id :A :next … :not … :near n
  :then {:tempo :dyn :touch}} …notes…] …]`, from a tree box; the performer chooses the path. Chosen by hand
  (`[:choose :A]`, `:next`), played by the box itself (`:play`: a fragment at random, the next when it ends), or
  followed (`:start`, with `pitch~` and `onset~` or MIDI notes): every fragment that can come next a hypothesis, its
  opening aligned with what is heard, the one it is sure of taken — the follower decides the form. Out: the fragment
  chosen, it as a tree to play with the indications the one before left (into `mt play`), what can come next, and at
  `:stop` the performance read again whole and kept. The kernel, `kairotic.paths` (on `kairotic.mt`), through the API
  (`paths-…`).
- **The work's code in chains** (discussions #407, #380, #399). The Code tab can write the lines of the work as
  chains (**-> chains**, remembered in this browser): lines that follow each other in the work's order as
  `(-> :b1 (to :b2) (to 1 :b3 0))`, lines in a row from one box as `(doto :b1 (to :b2) (to :b3))`, a line alone as a
  `connect`, and names in place of ids. Applied, it gives back the same lines in the same order (the order messages
  fan out in), so it changes nothing: a second writing of the same patch, its structure easier to read
  (`lines->chains`, `(patch->code p :chains)`, `(chains! true)`).
- **Live coding: chains that can be evaluated again** (discussion #407). `to` takes a name for the box it makes,
  `(-> (box :osc "osc~ 220") (to :amp "gain~ 0.2") (to :out "dac~ 1 2"))`: the first time the boxes are made below
  each other; evaluated again only what changed changes (nothing, or one text), a named box moved by hand stays where
  it is, and a line already there is not made twice. `(to a o :amp "text" i)` for other ports. The Live view's example
  uses it.
- **Bach's chorales, phrase by phrase** (#301, #399). `studies/_shared/chorales/phrases.json`: 2,272 phrases from the
  370 chorales, cut at the fermatas, in the engine's format (`satb` a quarter at a time, `held`, `strong`, the ends
  `A` and `B`, the key and the cadence, each voice's `lines` with its eighths) — what Study 63's `bridges.mjs` and
  `fromOuter` read. Cut from Craig Sapp's Humdrum edition by `tools/kern.mjs`; the data is **CC BY-NC-SA 4.0**, after
  Sapp's edition, not MPL-2.0 (the folder's `LICENSE.md`). `tests/chorales.mjs`: the corpus whole, BWV 269's first
  phrase, and Bach's own inner voices judged by `bach-4` — it keeps 112 of the 2,272 as he wrote them; the others
  break first on the ranges, a dissonance over a held bass, direct 5ths and octaves, the 7th's resolution: what the
  rules are to learn from him.
- **Bach's chorales: `bach-4`, neighbouring voices meeting on one note** (`@kairotic/rules` 0.16.0; `@kairotic/cac`
  0.16.4). A style for the chorales (the corpus, the bridges filled from A to B): `chorale-4`, and two neighbouring
  voices may meet on the unison — the tenor and the bass, the alto and the tenor, the soprano and the alto —, a
  doubling: what binds a doubled note binds it (the parallels, the doublings; an augmented unison stays a false
  relation). The rule `order` takes `unison`, `from-bass` its `unison: "any"`. Bach's own alto and tenor in BWV 269's
  first phrase (the tenor on the bass's G) are by `bach-4`'s rules, not by `chorale-4`'s. `fromOuter` writes in
  `bach-4` by default. `chorale-4` (the book's, Studies 62, 65 and 69) is as it was.
- **Tonal functions in four parts, and the inner voices between a soprano and a bass given** (`@kairotic/rules`
  0.15.0, `chorale-4` 1.4.0; `@kairotic/cac` 0.16.3; discussions #353, #399, #321). The rule `functions` reads the
  chord on each strong unit as `functions.mjs` does — T, S, D or an applied dominant — and keeps the grammar into it,
  from the unit before or from the strong one before: never D → S, an applied dominant into its target (on a weak unit
  too). The weak units between are the prolongation's (the RO's 6/3 on ⑥ going up, a passing chord), as GTTM's
  prolongational reduction reads them; an augmented 6th prepares the dominant (S); a chain of 6/3s and 7–6s over a
  bass by step (the Lamento) is a line; a figured 7th chord is read whole (a diminished 7th without its 5th is still
  one). Every prototype of Studies 62, 65 and 69 keeps the grammar: the same counts with the rule. `fromOuter` (and
  `fromNotes`'s `soprano`): a soprano given with the bass, the alto and the tenor written between, the chords free —
  the step for the chorales (A to B: a bridge's outer voices, filled in four parts). Bach's *Aus meines Herzens
  Grunde* (BWV 269), its first phrase's soprano and bass: 14,267,964 inner voices (15,105,996 without the functions),
  the grammar kept in every one drawn.
- **Voice leading in the new harmonies and the morphs; MEI from Studies 63 and 67.**
  - **Study 67:** a new harmony is now an exact bridge over chords, span by span between the chords kept (the
    chords reached by every voice's step, a beam of the cheapest, the backward weights exact over it): triads or
    sevenths (a 7th going down by step), the five voices in order — none lost on another's pitch —, no upper voice
    leaping more than a 4th nor the bass more than a 5th, into the chord kept next too, no parallel 5ths or octaves
    between any two voices, the same chord again a little dearer. Where no new way keeps them Bach's chords stay
    (`rows.kept`). From the frame: about 16 chords new, the tension curve's correlation with Bach's 0.92 (0.61 without
    the shape). Before, the voices met (unisons), and leapt into the chords kept.
  - **Study 63:** `leapCost` — a leap beyond a 3rd costs `smooth · (semitones − 4) / 3`, a unit's cost (the bridge
    exact); "Smooth" (2) on the page for the variation and the morph: a morph's mean interval 2.67 → 2.19 semitones.
  - **MEI:** Study 67 exports the new prelude (a staff for each of the figure's voices, in 16ths), its chords and any
    level (a staff a voice); Study 63 the variation and the morph (`meiOfPhrase`).
- **C7 is V of ④, not the tonic** (`functions.mjs`, `@kairotic/rules` 0.14.0). A dominant 7th on the tonic now
  reads as an applied dominant whose target is ④ (a major 7th on the tonic is still the tonic): it must go to F. In
  Study 67 BWV 846's frame keeps the coda's plagal close, C – … – C/G – C7 – F/C – C, where it ended C7 → C.
- **Live coding, names** (discussion #407). `(box :osc "osc~ 220")` makes the box live code calls `:osc`; evaluated
  again it is the same box, its text (and place, if given) changed as one event if they changed, so a block can be
  evaluated again and again. The box keeps its `:bN` id for the system: the name is one more thing it keeps (`:name`,
  a `[:name id :osc]` event, one box per name), shown beside its id, written as `(name-box :b7 :osc)`, and every
  command takes it in place of the id (`rid`: events name boxes by their ids in the history).
- **Study 70 · open form: the performer chooses the path, the follower decides the form** (discussion #212). A work of
  fragments and rules of succession (`next`, `not`, `near` a rhythm at most n swaps away; `then` how the next is
  played; ending when a fragment comes a third time), in *Klavierstück XI*'s manner: "Eleven cells", ten rhythm cells
  over a twelve-tone row, 8.4 million performances of at most eight fragments. Followed live, each fragment that may
  come a hypothesis aligned with what is heard (after 2 notes, the median); read again whole once the performance is
  over (under 1 % of fragments off with slips). The performances kept as a tree of branches; the work as EDN,
  `[:open … [:frag …] …]`.
- **Live coding in the Code tab, step 2: a short syntax and a page of your own** (discussion #407). **`to`** makes a
  box below another, fed by it, as one event, and returns its id: `(-> (box "osc~ 220") (to "gain~ 0.2") (to "dac~ 1 2"))`
  (`(to a o "text" i)` for other ports, `(to :b3 :b9)` to connect only); a chain (`->`, `doto`) of calls that make the
  patch evaluated from the tab is one event (`as-one-event!`). **Live**, a third view of the Code tab beside Calls and
  Data: your own code, never written over by the work, kept in this browser for each work; ⇧+Enter evaluates the form
  at the cursor, Ctrl/⌘+Enter the block (the lines between empty ones), and what was evaluated flashes.
- **Study 63 · bridges: the outer voices of a chorale phrase, from A to B** (`outer.mjs`; the chorale test, #399 /
  #353). A bridge whose states are pairs (soprano, bass), exact for every cost one unit back: the rules (consonant,
  no parallel or direct 5ths and octaves, no augmented or diminished melodic interval, an altered note going on the
  way it was bent, the ends pinned, the cadence's bass ⑤–① or ⑦–① and its soprano by step), the line (steps cheap,
  a new chord each unit, each voice near its register), and three layers, each on or off: **functions** (the implied
  harmony's grammar, `functions.mjs`), **tension** (`tension.mjs`, an arch rising to two thirds of the phrase and
  released into B) and **economy** (`bits.mjs`, the voices' motion as words). On two invented test phrases (20 draws):
  without functions the grammar breaks 0.70 / 0.95 times a phrase, with them never; the arch correlates 0.27 / 0.31
  without tension, 0.64 / 0.55 with it; fewer different motions with economy. `bridgesFor` gives the engine's format
  for every variant (all layers, each off); `tools/bridges.mjs` writes them for the corpus once it is in
  `studies/_shared/chorales/`.
- **One clock for a room** (discussion #382, idea 8, phase 1). In a shared room with a relay, the time things are made
  at — each transaction's `:t`, each segment's (where the newest point of the history comes from), each change of a
  jam in Perform and its live messages — is the room's shared time: the relay's clock as each page reads it on
  `/signal` (`talk.cljs`), so every page sees the same front and the same order in a jam whatever its own clock says.
  Elsewhere, and before the relay first answers, it is the machine's clock as before. `(work-now)`, `(work-clock)`.
  Phase 2, a transactor on `/signal`, is proposed in #382 for after 0.3.0.

- **Tension: `tension.mjs`** (`@kairotic/rules` 0.14.0; discussions #399, #321). Lerdahl's *Tonal Pitch Space*: a
  chord's basic space in a region, the chord distance δ = i + j + k (I → V 5, I → ii 8, as his tables), an applied
  dominant's region its target's key, surface tension (an inversion, a 7th, a foreign note), and sequential, global
  and hierarchical tension. In Study 67:
  - **BWV 846's tension**, hierarchically from its reduction (each chord's δ from the chord it prolongs, the frame's
    from the tonic): 0 where it begins and ends, tighter in the tonicization of G and over the dominant pedal, drawn
    on the page under the chords.
  - **A new harmony keeps Bach's tension shape** (`rewrite`'s `shape`, 3 on the page: each new chord as far from the
    tonic as his at that bar): its tension curve correlates 0.74 with his from the frame, 0.50 without.
  - `reduceNotes` takes an `extra` cost (the tension a step takes away, `tensionCost`); on BWV 846 it changes no
    level — the functions and the ornaments already decide them.
- **The soprano does not double the bass's line at the octave** (`@kairotic/rules` 0.14.0, `chorale-4` 1.3.0;
  `@kairotic/cac` 0.16.2). In Fifth Down Fourth Up the engine still wrote the soprano F–E–D held over each weak unit
  above F–B–E–A–D: an octave with the bass on every strong unit, both moving down — a sequence's parallels, a chord of
  its own between and the bass leaping, which the rules allowed (the book writes them in ex. 7.12b; Bach's chorales,
  in 1 of their 24 circle-of-fifths stretches). The rule `outer-octaves`: no octave between the soprano and the bass
  on two strong units in a row, the soprano held between them and moving the bass's way. The sequence's other
  parallels (between inner voices, 5ths between the outer ones) stay allowed. Study 65's counts: Fifth Down Fourth Up
  5,621, with 5/3s 139,158, in minor 3,753, Third Down Second Up 992 and in minor 19,238; Study 69's Chain of
  Dominants in minor 530. The parity with Study 62's kernel is kept (none of its phrases has such octaves).
- **Datalog: DataScript comes with the REPL or the Code tab**, opened (a focus or a click there), so the first query
  finds it. The tests workflow, run by hand, takes *bench* (`KAIROTIC_BENCH=1`: the index with 2000 and 5000
  events); the numbers are in the guide (2000 events: 360–700 ms the first query, 20–30 ms again; 5000: about 1 s).

- **The tonal functions in two voices: Studies 61 and 63** (`@kairotic/rules` 0.13.0: `impliedChord`; discussion
  #399). Two voices imply their chord (a 3rd or a 5th over the bass its root, a 6th the bass its 3rd, a 4th the
  cadential 6/4), so the grammar of `functions.mjs` reads a partimento's phrase too:
  - **Study 61 · reduction:** `reduce(…, {functional: true})` (on in the page) — no level may break the grammar where
    the surface did not (`functionalJudge`, any notes: `reduceNotes`' `functional`), never given up even where
    nothing else is left. A chain of 6/3s over a bass moving by step (a fauxbourdon, a 7–6 chain resolved) is a line,
    not a succession of functions: the 7–6 chain reads as before; the rising sequence keeps its direction (without
    them the economy reached D → S).
  - **Study 63 · bridges:** `functionalCost` — each unit's implied chord, a succession the grammar refuses costing
    `functional` more (6 on the page, for the variation and the morph): a unit's cost, so the bridge stays exact. A
    morph broke the grammar 0.95 times a line with the economy alone, 0.05 with the functions.
  - Study 64 (florid) keeps the copies but not the rule: its counterpoint is modal, Fux's, where these functions do
    not hold.
- **Tonal functions the economy may not take away: `functions.mjs`** (`@kairotic/rules` 0.13.0; discussions #399,
  #321). What a chord does in a key (T, S, D, an applied dominant and its target; the cadential 6/4 a dominant, a
  diminished 7th the dominant's where it holds the leading tone) and the grammar of a tonal phrase: never D → S,
  every applied dominant resolved, the end on the tonic. Study 67 reads it as its reduction's judge, strictly
  (`reduceNotes`' new `strict`: where no legal step is left, the frame): BWV 846's frame becomes C – Am/C – D7 – C♯°7 –
  Dm/F – G7 – C – Fmaj7 – F♯°7 – G7 – C/G – C7 – C, every level a tonal phrase, where the economy alone reached
  G7 → F/C (a retrogression) and left D7 without its G. The rewrite keeps the grammar too, span by span between the
  chords kept. The page marks each chord's function, and with the functions off shows in red the levels that break
  them.
- **Study 69 · chromatic: IJzerman's chapter 8** (`@kairotic/rules` 0.13.0, `@kairotic/cac` 0.16.1). Twelve phrases on
  the engine — the **Fonte** (ii then I a step down; inverted; with diminished 7ths), the **chromatic Monte** (ii, IV,
  V, vi tonicized; in minor III, iv, V), **tonicizations in Descending Thirds**, the **Lamento** in three and four
  parts, the **Morte** (IV tonicized, then the augmented 6th — in major on the molldur ⑥) and the **Chain of
  Dominants** — each a unit in a key of its own where a degree is tonicized, the book's prototypes (ex. 8.8, 8.17,
  8.22, 8.27, 8.33, 8.42) checked among the realizations counted. What the engine finds is what the book says: in four
  parts every Lamento has a voice that leaps a 4th or more (1,298 of 1,298), in three none does; in the chain every
  leading tone goes down a chromatic half step into the next 7th. What the engine learnt:
  - **a 7th by chromatic step**: the dominant's 7th held, or come to by step — a chromatic one too (A to A♭ into the
    molldur's diminished 7th, a leading tone down into the next dominant's 7th);
  - **a 7th held into a weak unit** (the alto's suspensions in Fifth Down Fourth Up, ex. 7.12a: "inevitably on the
    weak beat"), resolving down as every 7th;
  - **in a sequence ⑦ is a degree as the others**: its bass doubled where the 7th chord is incomplete (ex. 7.12a–b);
  - **the 6/4 in two steps**, a 5/4 asked between (the 6 to the 5, the 4 held);
  - **structural parallels between the upper voices** (chorale-4 1.2.0): the same 5th or octave on two strong units in
    a row with only ornaments between, as each voice's with the bass already was. The sequence's — a chord of its own
    between, the bass leaping — stay allowed: Bach writes them (in 21 of the 24 circle-of-fifths stretches of the 371
    chorales, 8 of them between soprano and bass), and so does the book (ex. 7.12a–b);
  - **the memo reads back to where a held note began**: it read three units back, and two states it took for one could
    have different futures (a soprano held three units). Three of Study 62's counts were its memo's — RO down 8,390
    (not 8,450), in minor 142,905 (not 143,615), Bach's 131,519 (not 132,347) —, checked against every realization
    enumerated without a memo.
  Study 65's Fifth Down Fourth Up now has the book's bars (① | ④ ⑦ | ③ ⑥ | ② ⑤ | ①), and its counts what the engine
  now allows: Fifth Down Fourth Up 6,336, with 5/3s 239,000, Third Down Second Up 998, the Tied Bass 27,685,639 and in
  minor 12,635,133.
- **Live coding in the Code tab, step 1: changes instead of a whole patch** (discussion #407). Ctrl/⌘+Enter applies
  the tab by the difference with the patch on screen: one event of the history with the boxes, lines, texts and data
  that changed (a `[:batch …]`), instead of a `:load` of the whole patch, so the history stays granular and mergeable
  and what stays the same stays as it was (a `:load` only if the changes could not rebuild the patch exactly).
  **⇧+Enter** evaluates the selection, or the form at the cursor, alone: calls that make the patch change it by the
  difference (a box written again as it was keeps its data, presentation…), anything else (`(play)`, `(send! …)`,
  a `def`) is a line of the REPL; the tab is written again from the patch if nothing else in it was unapplied.
  `patch-diff` (`kairotic.release`) now also writes pinned lines, layers, marks and projections, so a release keeps
  them too.
- **Querying the history with Datalog** (discussion #382, idea 7). `(q '[:find …])` and `(pull pattern eid)` /
  `(entity eid)`, answered by DataScript itself (`datascript@1.8.1`, its npm build from jsDelivr, loaded with the
  first query; EPL-1.0): `(q query)` where you are, `(q query db)`, `(q query db pos)` at any point of any branch,
  `(q query (with …))` over a try; more arguments are the inputs of its `:in`. The history stays the source of truth:
  DataScript gets an index made from it, one per value of the history, when a query first asks for it, kept while
  that value serves and grown with the new events when the history goes on along the same path (only what is new is
  read); nothing is written back. The index holds the transactions (`:tx/via :tx/box :tx/why :tx/kind :tx/op :tx/seq
  :tx/t :tx/author :tx/pos`), the facts of each (`:fact/tx :fact/e :fact/a :fact/v :fact/added`) and the work at the
  point (`:box/…`, `:line/…`), with the schema made from `(schema :history)`. Through DataScript's JS API keywords
  travel as their text and vectors as EDN, and q writes the query and decodes the results the same way. Claude's
  `work_history` tool takes a Datalog query too. Nothing changes in the interface and nothing loads with the page.

- **Study 66 · compression: the uses heard, and the description as a tree** (discussion #399). The same rules, their
  uses coded the way a listener learns them (`bits.mjs`): which rule comes is a word of a lexicon (the first time an
  escape and its number), a figure's pitches each voice's step from the same voice of its last use, a motif's start
  its step from the last; a lexicon for each context. BWV 846 comes to 864 bits, 16.1 % of its notes (28.7 % at fixed
  prices), BWV 999 22.0 %, the cello preludes about 49 %. **One coder for both sides** (`coder`, `sayRows`): Study 67
  says its levels with it, so its surface and Study 66's heard figure pitches are the same measure; its frame 270
  bits against the surface's 591, with the derivation back (a step never heard said by its parts) 1025. **The harmony
  where no figure is** (`harmonySpans`, `sonorityOf`): a chord a bar, the bars no figure covers read from their notes
  (weighed by how long they sound; an anticipation of the next chord and the lightest passing notes left out), so BWV
  846's cadence over the tonic pedal, C7 – F/C – G7 – C, is in Study 66's harmony and in Study 67's levels (its frame
  now C – Am/C – D7 – Dm/F – G7 – G7 – F/C – C). And **`:use` takes `:voices`** too (each voice's
  step from the same voice of the fragment's use before): `treeOf(c, {voices: true})` writes BWV 846 as 32 uses of one
  figure, `[:use {:ref :F1 :voices [0 -2 2 2 1]}]`… And the description written as a tree (`treeOf`): the rules in `:defs`, each use a
  `[:use {:ref :F1 :pitches [...]}]` — **`:use` takes `:pitches`** in `kairotic.mt` (`repitch`: a fragment's distinct
  pitches, in the order they first come, become these: a figure said again over another chord). The page shows both
  codings and the tree to copy; read back, every tree is the piece again.
- **Study 68 · mixture: a piece said bar by bar the cheaper of two ways** (discussion #399). The surface way (a
  figure and its pitches, Study 66's) or the genetic way (the bar's sonority, its notes as chord tones or ornaments,
  Studies 61 and 67's), in one measure (`bits.mjs`), a word saying which, both ways learning every bar. Lossless; the
  mixture never worse than the better way, better than both in the cello preludes (BWV 1009: 4483 as figures, 5375
  genetically, 4237 mixed). Which way each bar took is the piece's signature: BWV 846 3 % genetic, 999 9 %, the cello's
  1007 27 % and 1009 28 %.
- **Study 67 · prelude: the second level of a prelude's description** (discussions #399, #321). Study 66's figure
  leaves BWV 846's harmony: read as five voices (a voice keeping its pitch holds its note), it is reduced by Study
  61's grammar (`reduceNotes`: any notes, any number of voices, a `keep` for the frame's retention) to its frame, C –
  Am/C – D7 – Dm/F – G7 – G7 (the pedal) – C/G – C7 – C. Each level said in bits (`bits.mjs`): the frame's voices 282
  bits against the surface's 442, but with the derivation back to the surface 532 — the reduction explains the
  harmony more than it compresses it. And the way back: a new harmony drawn from a level's frame (triads, the steps
  already said preferred), Study 66's figure on it, a new prelude, played on the page.
- **One measure of a description: `bits.mjs`** (`@kairotic/rules` 0.13.0 — the release `rules-v0.12.0` was made before it came in; discussions #342, #399). The length of a
  piece, a line or an analysis said as words — a cell of a florid line, a step of a reduction, a bar's figure — each
  costing the bits a listener learning it as it goes needs: a word heard before cheap, its inversion half as good, a
  new one dear (`lexicon`, `lengthOf`; `economyOf`, an engine's discount for a word heard before). Studies 64
  (florid) and 61 (reduction) now use it instead of their own copies of the formula (the same numbers), and:
  - **Study 63 · bridges: the economy of a way.** A bar's figure (its shape from its first note) is a word, and the
    bridge's forward draw prefers a figure the line has already said: a morph from the C major incipit to the 7–6
    chain goes from 61.9 bits in 7.8 different figures to 46.8 in 5.2 (20 draws each), every note legal; economy 0
    draws exactly as before. The page has an Economy field for the variation and the morph (3) and says each line's
    figures in bits.
  - The studies keep a copy of `bits.mjs`, checked equal to the package's (`tests/rules.mjs`).
- **`cac judge` with a canon's style: two voices judged by the canon's rules** (`@kairotic/rules` 0.12.0,
  `@kairotic/cac` 0.16.0; discussion #353). `[:style :canon-2]` (or a style that extends it) and a tree of two voices:
  each voice's line and what is between them (parallels, dissonances and their suspensions, the imitation), unit by
  unit — the reasons on outlet 1, each with its unit and its voice (the dux, the comes or both), and the voices written
  again with `:why` on the notes that break a rule (their analysis layer). The dux is the voice that enters first (the
  lower if together, or `[:dux :upper]`); k and d are read from their entries (or `[:k -4]`, `[:d 2]`); a canon if the
  comes enters later, free counterpoint if they enter together (or `[:imitation 0.6]`). With another style the two
  voices are judged over their bass, as before. `canon.mjs`'s `judgeTwo`: the canons the engine draws are judged by
  the rules, and a first species written badly shows its parallel 5ths and its leaps.
- **Study 66 · compression** (discussion #399): the shortest description of a piece — figures (a pattern of a few
  pitches with its rhythm, over other pitches), motifs (the same intervals elsewhere) and repeats, counted in bits
  (MDL), taken greedily and checked lossless. Bach's preludes from the Mutopia Project's public-domain typesets: BWV 846
  is one figure over 32 chords (28.7 %), and what is left is its harmony; BWV 999 39.9 %; the cello suites' preludes
  BWV 1007 and 1009 a little more than half.
- **Study 61 · reduction: the briefest reading** (discussion #342). The analysis now weighs what its derivation takes
  to say, as Study 64's florid lines do: each step is a word — its operation and, for each note it explains, the
  ornament, the voice and the step from its parent, wherever it stands — and is discounted by `economy · (bits − bits of a new word) / 4`, the bits of
  that word given the words already said (a word said before cheap, its inversion half as good, a new one dear). An
  unsplit now offers every way to explain its notes (`unsplits`), so where a note could be read two ways the
  analysis can prefer the way it has used. **Measured:** the three incipits read exactly as before; a rising sequence
  (`D3 E3 F3 G3 G2 C3` under `B4 A4 C5 B4 D5 C5 E5 D5 D5 B4 C5`, a new phrase in the list) is read with one figure at
  all four links, the step below an incomplete neighbour, where without economy the last link was an anticipation:
  28.0 bits in 4 different steps become 21.5 in 3, every level passing the rules. The page has an Economy field
  (3) and says the derivation's length. The copies in Studies 63 and 64 follow.
- **The history as a value, and its facts** (discussion #382, ideas 2 and 3). `(db)`: the history of the line on
  screen as a value that does not change while the history grows; `as-of`, `with`, `tx-at`, `tx-log` take it as their
  first argument (`db-norm`, `db-patch`, `db-segments` read it). `(datoms)`: the facts of the history as Datomic's
  datoms — `{:e :a :v :added}` with each one's transaction, an entity a box by its path (`[:b5 :b2]` inside a
  sub-patch), a patch for its lines, a layer, a mark or a projection —, read from the work before and after every event
  (`patch-datoms`), so every event has them whatever its form; `(history-of :b3)`. Claude (the Claude tab, agent boxes)
  gets a `work_history` tool: the last transactions, or a box's facts, from the value the history had when the request
  began. `text!` no longer resets the engine's state of a box while trying (`with`, `build`).

- **The schema as data, and one excision** (discussion #382, ideas 5 and 6). `kairotic.mt/attr-schema`: each
  attribute of a tree with its layer (`:performance`, `:analysis`) and, where it matters, the nodes it belongs to on
  (`:on`, as a note's `:id`); `performative-keys`, `analysis-keys` and the layers are read from it (`mt/layer-of`,
  `mt/layer-keys`), and so is what `quantize` carries of an analysis. `event-schema` (the page): each event of the
  history with what it changes (`:work`, `:layout`, `:mark`), read by a take's summary and `tx-at`. `(schema)`,
  `(schema :tree)`, `(schema :events)` in the REPL. `forget-points` is now `excise!`: the one way anything leaves a
  history; the change that replaces the points says `:via :excise`, each event keeps its transaction (they no longer
  shift when points are forgotten), and each segment changed keeps a record (`:excised`, saved, carried by files,
  anonymized with them; `(excisions)`).

- **`phase` keeps time between onsets** (`@kairotic/rhythm` 0.8.0; discussion #204). Without a clock, from the last
  onset judged the box sends itself a beat each pulse it found (`:later`, with ▶): the phase walks on, so a
  `necklace` after it plays in the gaps of what the performer plays. The next onset takes over (a new generation
  forgets the beats planned), early or late, and nothing is said twice; a whole cycle without onsets and it waits.
  On the right a kept beat is `{:phase :n :pulse :kept true}`. The help's example shows it with the metro taken away.
- **An agent's offers tried before they are offered, and kept when a work is opened from a file**
  (`@kairotic/rules` 0.11.1, `@kairotic/cac` 0.15.1). Asked for a 16-bar partimento in A major, an agent offered two
  basses with no realization and a third whose `cac partimento 3 A major` gave nothing; opened on Pages, its offers
  were empty. Now:
  - **The page tries what flows in an offer** before offering it: each tree box's tree is sent, apart, to the box of a
    package's class it goes to (a bass to `cac partimento`), and a box that answers ✗ sends the offer back to Claude
    with why — one of its three tries. Claude is told so, and to try it first with `apply_class`.
  - **`cac partimento` says where a bass dies**: *no realization over this bass — nothing can go on at note 22 (e3,
    5/3): the 7th of the chord goes down by step; …* (`rules.mjs`: `fromNotes().deadEnd()`, going forward through the
    states the rules allow until a unit none reaches, and the reasons that refused its candidates).
  - **A mode after the key is the key's**: `cac partimento 3 A major`, `d dorian` (the second word filled the style's
    place, and the box gave nothing).
  - **A local work opened from a file keeps its agents' offers**: its points get new ids, and now so does every id in
    its events — the point an agent (or a `patch @name`) is pinned to, its offers, the point it built.
- **Study 64 · florid: coherence, read both ways** (discussion #342). A line's derivation — its cells, each a rhythm
  and a shape relative to the frame, so a figure in sequence is the same cell — has a length: the bits a listener
  learning the piece as it goes needs for it (`derivationLength`, `lexicon`: a cell heard before is cheap, its
  inversion half as good, a new one dear). Read: Fux's own examples take 2.85 bits a half bar and about five distinct
  cells a line (`measure`'s coherence). Drawn: `florid({economy})` weighs it as a cost, the derivation's length beside
  every other preference; with his economy (`FUX_ECONOMY`, 3) and his costs refitted with it, the engine's lines over
  his canti firmi take 2.8 bits and 5.3 cells (3.7 and 7.5 without), as near his figures as before. The page's
  *Economy*, and each line's coherence in its facts.
- **`cac imitation`: a dux with rests, and a long dux counted within a limit** (`@kairotic/rules` 0.11.0,
  `@kairotic/cac` 0.15.0). The dux may rest (the gaps between its notes, read from the start; they were lost, and what
  came after them shifted): a canon's comes rests where the dux rested, a near or free one need not, and the dux is
  written again with its rests. A long dux is counted within the box's limit, as `cac partimento`'s bass is
  (`imitation`'s `countWithin`); past it, a comes is found by search, and the page does not freeze. Fux's cantus
  firmus as a dux, a near imitation a 5th below: 375 comes, pinned.
- **`cac imitation`: a melody in, the comes added** (`@kairotic/rules` 0.10.0, `@kairotic/cac` 0.14.0; discussion
  #353). The tree's highest voice is the dux, given note by note (its unit its shortest note); the comes is found
  against it by the comes's engine on the one engine (`canon.mjs`'s `imitation`, the style `imitation-2`: `canon-2`
  with the dux's own rules off and `given`), weighed by the soft rules every engine weighs a line with. `[:k -7]` steps
  away, `[:d 2]` units later, `[:imitation 1]` a canon (0.6 near, 0.3 by motion, 0 free counterpoint), `[:species 4]`,
  `[:invert 12]`, in the tree's key or `[:key "d dorian"]` with its musica ficta; a bang another comes, `:any` any,
  counted (outlet 1). Frère Jacques two bars later at the octave below: exactly one comes, the round itself; two
  units later, none — the box says so.
- **Claude knows the official packages' classes before the work has them.** Its catalog listed only the classes the
  work had loaded, so an agent asked for a partimento did not see `cac`, and `class_help` answered *no class* to `cac
  partimento` (a box's text, not a class). Now the catalog adds every official package's classes the work does not
  have yet (with the first sentence of their help: a box of one brings its package), and `class_help` takes the class
  out of a box's text and gives its help's text when the class is not loaded.
- **The menu ☰ beside the logo, and a dialog for what it opens.** The menu's button is larger, the first thing of the
  header at the top left. What it opens that is a place of its own opens in the app's dialog, over the app as Sessions
  does (Close, Esc or a click on the shade back to the work): **Share/Export** and **Feedback** (no longer a tab);
  the global preferences will go there too. Help pages (keys and gestures, the documentation) stay in the Help tab.

- **Room on screen, and the layers each box's own.** The layers of a tree (its analysis — the figures under the bass,
  degrees, keys —, what belongs to playing it) are shown or hidden **box by box**, in its score and its code window
  alike: the **analysis** chip in a tree box's header (when its tree has one), the Performed/Analysis buttons of the
  code window, or `(show-layers :b3 :analysis)`; kept in the work (and in links, releases). Hidden by default; no
  global switch any more. A **menu ☰** at the top right holds what took room all the time: Sessions, Share/Export, the
  work as a file (and a release), Keys and gestures, Feedback (its tab is gone from the side panel), the documentation
  and the edition. The fixed line of keys under the patch's header is a page of the Help tab now, **Keys and gestures**
  (`docs/keys.md`, in Spanish too), opened by the **?** beside Annotate. A lesson's text folds (**▾**) to its head and
  stays folded from step to step and lesson to lesson.

- **Following frame by frame** (discussion #308; `@kairotic/analysis` 0.8.8): `follow dtw` — online dynamic time
  warping, in the manner of Dixon's MATCH: the score turned into what it should sound like, a frame every 50 ms (each
  event as long as the work's last take played it, or as written; each frame its profile — learned, `:listen` or its
  pitch class — and its pitch), and what is heard every 50 ms aligned with it along the cheapest path in a band
  around where the performer was. No notes are detected: good with rubato and with sounds that are not notes; it
  never goes back. `fl/reference`, `fl/dtw-start`, `fl/dtw-step`. A descriptor's distance uses its spread when it has
  one (a tenth of its value only when it has none).
- **The figures in the score.** A note's `:fig` (`"6/5"`, the analysis layer's or the bass's own) is written under it
  as figured bass (`<harm><fb>`), and Verovio shows it: the chords `cac partimento` made, or a bass's figures, under
  the bass of a tree box's score. The score obeys the layers as the code window does: with **Analysis** off its
  figures are hidden. And back: a MEI's figured bass is read into the tree's analysis layer (`:fig` on the note, by
  `@startid` as Kairotic writes it, or by `@tstamp` and `@staff` as the studies' exports and other programs do).
  Quantizing a tree in free time keeps what an analysis wrote on its notes (`:fig`, `:deg`, `:local`, `:why`,
  `:harmony`).
- **The history as a database, in Datomic's terms** (discussion #382, ideas 1 and 4). Every event keeps its
  **transaction** beside it (`:meta`, parallel to a segment's `:events`): when it was made (`:t`) and where from
  (`:via` — `:gesture`, `:repl`, `:claude`, `:agent` with its `:box` and request as `:why`, `:merge`, `:take` from
  Perform, `:with`); who made it stays the segment's. Saved with the history, carried by `.kairotic` files, told in
  the history's tooltips; segments written before have none. `(with "…")` / `(with [events])` tries a change without
  making it, as `d/with`: `{:db-before :db-after :tx-data}`, at a point of the past or on a patch too, and
  `(transact! r)` makes it from where it was tried. `(as-of pos)`, `(tx-at pos)` (with `:kind` — `:work`, `:layout`,
  `:mark` —, read from the event, issue #5) and `(tx-log)`, the transactions to here as a seq. `build` is a `with` on
  an empty patch; a try no longer resets the engine's state of the work's boxes with the same ids.

- **One tonal layer for both worlds** (`@kairotic/rules` 0.9.0; discussion #353, step 5). `keySystem(key)`: a key of
  `tonal.mjs` — major, minor, a church mode with its musica ficta — as a system the comes sings in (a pitch a degree
  and an alteration, intervals by their real size). The canon in a key (`canonVoices({key})`) reads the partimento's
  ficta (rule `ficta`: a raised note up by step, the cadence's leading tone raised where the mode raises it, the
  final's raised 3rd only at the end): a D dorian canon cadences through C♯; without the ficta a church mode counts as
  on the white keys, canon by canon. And the comes's invertible counterpoint in the partimento's world: rule
  `invertible` (`{at: 8 | 10 | 12}`), a voice over a bass that stands inversion — in the app through a style
  (`@kairotic/cac` 0.13.0): `cac partimento [:voices 2]` then `[:style {:extends :partimento-1 :rules [[:invertible {:at 8}]]}]`.
- **The comes on the one engine** (`@kairotic/rules` 0.8.0; discussion #353, step 5). `systems.mjs`: the comes's
  systems as data (a tuning, a scale's steps, each interval's quality by its real size), the same as
  `counterpoint.mjs`'s. `canon.mjs`: two free voices on a system — the dux and the comes, a canon, an imitation or free
  counterpoint, species and suspensions, the comes inverted or augmented, the counterpoint asked to stand inversion —
  on `solveVoices`, its rules entries of the catalogue (`CANON_VOICE`, `CANON_BETWEEN`) and the style `canon-2` naming
  them. The same counts as `counterpoint.canon` in 40 random canons over the four systems (`tests/rules.mjs`); a memo
  key of its own (`solveVoices({key})`). Its style is one of the styles in EDN (`canon-2`, `:engine "canon"`): extended,
  reparametrized, a rule removed, checked against the canon's catalogue. Next: its engine and soft rules, and one
  tonal layer for both worlds.
- **Study 65 · circle: beyond the Rule of the Octave** (IJzerman, chapter 7; `@kairotic/rules` 0.7.0, `@kairotic/cac`
  0.12.0). The **diminished 7th family** (7/5/3 on ⑦♯, 6/5/3 on ②, 6/4/3 on ④, 6/4/2 on ⑥; in major with the lowered
  ⑥) joins the dominant's as semi-consonances: free to enter, its 7th down a half step, a tritone in it free where it
  is the chord's 7th or held while the bass moves on (style `chorale-4` 1.1.0; nothing counted before changes). A
  unit may be part of a `sequence` (a diminished triad taken for the pattern's sake, its tritone going on by step the
  way it leans) and of minor's `natural` scale (⑥ and ⑦ not raised, a 7th on the natural ⑦ diatonic); a chroma may be
  required (`[degree alteration true]`). The study: thirteen phrases — vii° in minor and major, the Meyer, Fifth Down
  Fourth Up (7ths or 5/3s, major and minor), Third Down Second Up, the Tied Bass in four parts, Descending Thirds (the
  Neapolitan ②♭ in minor), the modulating Folia —, each prototype's properties checked in every realization drawn
  (kernel 36/36, page 8/8). Studies on `@kairotic/rules` keep a copy of it, checked equal in `tests/rules.mjs`.

- **Styles in EDN** (`@kairotic/rules` 0.6.0, `@kairotic/cac` 0.11.0; step 4 of discussion #353). A style is data, and
  every part of it inherits: its rules, those between the voices, its voices' own style, its weights — a rule named
  again takes its new parameters, `[:rule false]` removes it. `:extends` takes a name or `[name version]` (the same major
  version, its minor at least). A style says how many parts it writes; `checkStyle` names a rule the catalogue does
  not have, `defineStyle` makes one nameable. In the app, `cac partimento [:style :partimento-2]` (three parts) or a
  style written in EDN, `[:style {:style :free-sevenths :extends [:chorale-4 "1.0.0"] :between [[:seventh {:free true}]]}]`;
  `:styles` lists them; the box shows the style it writes in.

- **The probabilistic follower** (discussion #308; `@kairotic/analysis` 0.8.7): `follow hmm` — a hidden Markov model
  over the events of the score, in the manner of Antescofo: a probability for every event the performer may be at,
  moved by each sound heard (on to the next events, each skipped one less likely, weighed by how the sound fits —
  pitch, octave errors, what is heard against the profile — and by when it comes against when each was expected at
  the performer's tempo), or staying (a wrong note). A doubtful sound lowers a probability instead of losing the place;
  a wrong step is undone when the next sounds point back (its wires to go on again). Wires, ticks, takes and
  corrections as before. `(fl/start evs {:model :hmm})`.
- **`cac` does not freeze the page** (`@kairotic/rules` 0.5.1, `@kairotic/cac` 0.10.1). The exact count runs in the
  page, and a long bass without figures in four parts takes minutes (16 bars of half notes in A major: about a minute;
  of whole notes, more than eight) — an agent asked for a 16-bar partimento hung the page that way. Now `cac
  partimento` counts for 1.5 s at most; past it, it says *too many to count here* and finds a realization by
  **search** — depth first, the candidates in the engine's order (a softmax of the soft rules' cost, drawn), back from
  dead ends, the dead states remembered on the memo's window — within 2.5 s, or says it found none in time. `cac judge`
  no longer counts at all. In `rules.mjs`: `within(ms, f)` and `TooLong` (a deadline every count checks; what it
  counted stays in its memo), `search` on `solve` and `solveVoices`, `fan(W, false)` (without the futures), and
  `fromNotes`'s `countWithin` and `search`.
- **The modes in three and four parts: Fux's style** (`@kairotic/rules` 0.5.0, `@kairotic/cac` 0.10.1; discussion #353).
  Styles `modal-1`, `modal-2` and `modal-4`, the default for a church mode's bass (`cac partimento d dorian`; no Rule
  of the Octave filled in there, the style chooses between a 5/3 and a 6/3 itself): every chord a consonant 5/3 or 6/3 (a 5/3 only where its 5th is perfect; the bass falling by step to the last note under a
  6/3; the last chord without a 6th — rule `modal`), and what his practice lets in where the galant style does not:
  a unison with the bass, a note held longer, the voices crossing, direct 5ths and octaves among three or four, a leap
  not always turned, a chromatic step over a held bass, the top voice ending on the 5th. Read against Fux's 27
  examples note against note in three and four parts (Gotham's encoding, CC0, in `tests/assets/fux`), the modal
  styles accept 26 (the one left: a voice crossing under the bass), the galant ones almost none. And the ficta as he
  writes it: the final's raised 3rd in any chord on the final (his phrygian starts on E major), a lowered note free to
  go up (his B♭ to C), the aeolian's F♯ on up to G♯ — in both engines.
- **Safe mode: a page that froze starts the next one safe.** Code of a work (a component, a script, a package's
  kernel) can keep the page busy until nothing answers, and a frozen page cannot say so — the next one can. Each
  gesture or line of the REPL, opening a work, ▶ and an agent's content arriving open a window of a few seconds in the
  tab's session storage (what, in which work), erased when it closes or when the page is closed or reloaded normally.
  A page that froze inside one never erases it, so after reloading the tab Kairotic starts in **safe mode**: the
  engine held (no message, no task, no ▶) and no code of the work or of the packages runs, with a notice saying what
  froze it — open the work, take the cause away (choose another offer of an agent, delete a box), and *Leave safe
  mode* (a reload). `(safe-mode!)` enters it by hand. Other tabs are not affected.
- **`phase` without a clock** (`@kairotic/rhythm` 0.7.0; discussion #204). With nothing on its right inlet, `phase`
  finds the pulse from the onsets themselves: of the last intervals between them, the longest pulse they fill as
  whole numbers of it (the fit plus a small price for each pulse, so the simplest grid wins, after Sethares'
  periodicity), each interval rounded on its own from the last onset back, so that a tempo that moves is followed.
  It says the phase at each onset, of the pulse that onset is on — the first from five onsets, and only when one
  rotation of the reference is nearer than every other —, and the pulse found (`:pulse`, in seconds, also with a
  clock) on the right. Tested on the son clave and the bembé with loose hands, missing and extra onsets, and an
  accelerando from 200 to 160 ms.
- **`cac partimento`: notes without figures, and the score as a choir writes it** (`@kairotic/rules` 0.4.0,
  `@kairotic/cac` 0.10.0). A note of the bass without figures took any chord the rules allowed (a 4/3/2 on ⑤ between
  figured notes); it now takes the one a partimento player would — the Rule of the Octave's where the bass moves by step
  through it, a 5/3 where it leaps (a 6/3 on ⑦) and at the start and the end (`fromNotes({fill})`, `octaveDefault`;
  `cac judge` still reads the chords the voices make). The help's RO counts 3,610 again, Study 62's. The voices come
  out in the tree's order, soprano, alto, tenor, bass (a tree in free time was quantized with its voices sorted by
  name: alto, bass, soprano, tenor), in open score with the tenor in the treble clef an octave down; `[:staves 2]`
  writes them in short score, soprano and alto on a treble staff, tenor and bass on a bass staff. In any tree a voice's
  `:clef` ("G", "F", "G8", "C3", "C4") sets its staff's clef, and quantizing keeps a voice's `:staff` and `:clef`.

- **Where to rehearse more** (discussion #308, step 5): `(confidence :bN)` — how sure a follower can be at each note,
  weakest first: a note is easy to find when it sounds unlike its neighbours (by its learned profile, or its
  notation) and, once rehearsed, when the takes found it. Once a tree has been learned (`(learn! :bN)`), its
  continuum shows a mark under each note, red to green. `kairotic.follow/confidence`.
- **Study 64 · florid: the frame measured** (discussion #342). Fux's frames (the notes on his half bars' downbeats)
  hold a note over the bar or move by a third far more often than the engine's (held 28%, thirds 31%; the engine 10%
  and 15%): the room his passing notes need. The frame's bridge takes a cost by interval (`costs.frame`, through
  `bridgeVoice`'s `extra(t, c, U)`, which now sees the line before), measured and fitted with the rest: `FUX_COSTS`,
  on seeds the fit did not see, from 0.53 to 0.15 of his figures, 0.61 to 0.11 of his bars' rhythms and 0.40 to 0.16
  of his frames' moves (total variation).
- **Several voices on one engine: `cac partimento` and `cac judge` on `@kairotic/rules`** (`@kairotic/rules` 0.3.0,
  `@kairotic/cac` 0.9.0; step 3 of discussion #353). The core takes several voices (`solveVoices`: each voice a style of
  one voice over the bass, tuples of their candidates, rules between them, the exact count memoized on every voice's
  last units, the engine, a uniform draw, a judgement) and the catalogue rules between the voices (`BETWEEN`: `order`,
  `imitation`, `exchange`, `apart`, `seconds`, `six-four`, `parallels-upper`, `false-relation`, `chord`, `doubling`,
  `seventh`, `leading-tone-doubled`, `resolution`, `dominant-major`; soft, `doubling`), each with its parameters (three
  parts or four). Two styles order them as `partimento.mjs` did: `partimento-2` (two upper voices, `partsOverBass`) and
  `chorale-4` (three, `fourOverBass`); `fromNotes` takes a bass given as notes, as the cac box does. Every count the same
  — the 38 phrases of Studies 54, 57, 59 and 62 (up to 839,310 realizations), the same reasons tuple by tuple, the same
  engine, judgement and chords made (`tests/rules.mjs`) —, and the cac box now loads `rules.mjs`. Next: styles in EDN
  (`[:style …]` in `cac`), then `comes`.

- **Study 64 · florid: Fux's own, measured** (discussion #342, step 3). Fux's twelve two-part florid examples
  (*Gradus ad Parnassum*, figures 82–88; Mark Gotham's `**kern` encoding, CC0, in `studies/64-florid/corpus/fux`)
  read back into the catalogue (`fromKern`, `loadFux`; a note struck again told from one tied): half bars held over
  the bar (his syncopations), passing notes, skips, a run now and then; quarters and halves, the dotted rhythms never;
  every tie to an equal or shorter value. Fux's six canti firmi join the study in their modes, and `FUX_COSTS`, the
  costs fitted to him (`corpus/fit.mjs`), bring the engine's lines over them from 0.53 to 0.18 of his figures and from
  0.61 to 0.05 of his bars' rhythms (total variation); the page's *Costs*. The figures keep the spelling of the frame's
  notes (a cadence's C♯ stays C♯); the MEI export writes a mode's signature (D dorian none, G dorian one flat).
- **The church modes, with their musica ficta** (`@kairotic/cac` 0.8.0, `@kairotic/rules` 0.2.0; discussions #342,
  #353). A key may be a church mode — `{tonic: "D", mode: "dorian"}`, `"d dorian"` in `cac partimento` — ionian,
  dorian, phrygian, lydian, mixolydian, aeolian, on any tonic, with the ficta Fux writes in the *Gradus*'s examples
  (counted in Mark Gotham's encoding): dorian C♯ B♭ and F♯, phrygian G♯, lydian B♭, mixolydian F♯, aeolian G♯ F♯. A
  raised note leads up by step, a lowered one goes down, at the last cadence the leading tone is raised where the mode
  raises it, and the final's raised 3rd (dorian F♯, phrygian G♯) sounds only in the last chord. Major and minor are unchanged (every count the same); both engines count the modes alike
  (`tests/rules.mjs`: 80 cases, counts and reasons).
- **Study 64 · florid: measured** (discussion #342, step 3). `measure.mjs` reads a florid line back into what the
  engine draws — its frame (given, or found by Study 61's reduction), each half bar's cell and figure, its ties —
  counts them over a corpus, and turns the counts into costs (`costsOf`, a first guess), then fits them (`fitCosts`:
  rounds of drawing, measuring, and moving each cost by the log of the two shares' ratio — how often a figure is heard
  is not how much it is preferred, where the frame leaves it more or less room). `florid({costs})` and
  `elaborate({costs})` take them. Read back, every half bar of the engine's own lines is found as drawn (93% with the
  reduced frame); fitted to a corpus drawn with other costs, the engine's figures come from 0.48 to 0.08 of it (total
  variation). Next: Fux's own fifth-species examples as the corpus.
- **Study 64 · florid: ties as Fux writes them** (discussion #342). A note is never tied to a longer one, nor is an
  eighth tied: the first of a tied pair as long as the second or longer (a half note to a half, a dotted quarter or a
  quarter; never a quarter to a half). A hard rule of the rhythm's bridge, which draws no rhythm that would force it
  (`tieOk`); 23 of the 42 ties of the 18 test lines broke it before, mostly anticipations. A suspension is prepared by
  a half note held over the bar (the neighbour in eighths tied into it is gone); the anticipation is a quarter; a
  double neighbour in eighths (*groppo*) takes the place of the neighbour in eighths that came back tied.
- **One Claude for every box, step 1: the craft as tools, and offers** (discussion #351). While Claude makes a
  patch — an agent's content, the Claude tab's — it can read any box of the patch on screen in one common shape
  (`describe_box`: class, text, ports, connections, and for a tree its key, meter, voices as lines of the melody
  shorthand with their range, and the analysis on its root and notes) and apply any class to a box apart, as a box of
  that class would receive it (`apply_class`: `cac judge`, `cac partimento`, `comes`…; its tasks run, a package
  fetched if the work has none, nothing goes into the work): every class is a tool. From the page, `(describe-box
  :bN)`, `(describe-tree t)`, `(apply-class "cac judge" :bN)` and `(run-class text msgs)`. An agent is told the boxes
  beside it and what reaches its inlets. **Offers:** `agent 3 "…"` answers each request with three contents (up to
  five), each told of the earlier ones, three sibling points of its line; it plays the first, and `(choose-offer :bN
  2)` or the Agents section of the Claude panel chooses another; the next request goes on from the one chosen.
- **`@kairotic/rules` 0.1.0: one constraint engine, step 2 of #353.** A package of its own, no classes: the core
  (`solve()`: hard rules that refuse with a reason, soft rules that cost, the exact count on a window as wide as the rules
  look back, the engine, a uniform draw, a judgement, `why` a note is refused), the catalogue's first general rules —
  those of a voice over a given bass — and styles named, versioned and inheriting (`resolveStyle`, `:extends`). The style
  `partimento-1` reproduces `partimento.mjs`'s voice over a bass to the number: 288 counts of Study 51's schemata, every
  voice of Studies 54, 57, 59 and 62, the reasons and the engine's choices (`tests/rules.mjs`, in CI).
- **Study 53's soft rules: the package's** (`soft.mjs` of `@kairotic/cac`). Its copy had stayed behind; it now weighs
  as every engine does, and `tests/counterpoint.mjs` checks it with the others. Studies 38–42 keep their own kernels,
  frozen as the record of each step.
- **Study 64 · florid: rhythm and melody of their own** (discussion #342). The rhythm is now chosen first, a cell a
  half bar — a half note, two quarters, a dotted quarter and an eighth, a quarter and two eighths (eighths in pairs,
  on the weak quarter, as Fux writes them) — drawn by a bridge over the bars with GTTM's preferences: the downbeat's
  note the longest (MPR 5), a bar like the one before it once but not a third time (parallelism, MPR 1), the bar's
  second half the busier, and an arc of activity over the phrase. The figures are then chosen for their cells with
  the melody's coherence on the surface: every engine's soft rules on the florid line itself, a direction that goes
  on, a figure in sequence. `CELLS`, `RHYTHM` (the weights); `elaborate` returns the `rhythm`; the page draws it.
- **Rules: an inventory, toward one engine** (`docs/rules.md`; discussion #353, step 1). Every rule the constraint
  engines hold today (`counterpoint.mjs`, `partimento.mjs`, `soft.mjs`, Studies 61–64), gathered into some twenty
  general, parametrized rules by context (note, line, vertical, pair, chord, progression, given, edge) with their
  lookback — the catalogue of a package of its own, `@kairotic/rules`, with styles in EDN (named, versioned,
  inheriting), local search beyond about 10 s, and room for learning.
- **Rehearsal: the score learns how it sounds** (discussion #308, steps 2–4; `@kairotic/analysis` 0.8.6). Each note
  has a profile — from the notation (its pitch class as a chroma), or learned with `(learn! :bN)` from the takes that
  kept what each note sounded like: each descriptor's mean, spread, and weight (how well it tells the note from its
  neighbours, for how little it varies). `follow` with descriptors matches notes by pitch and by how near what it
  hears is to their profile, and finds a sound **without a pitch** (a multiphonic, a noise: an onset and no pitch)
  by its profile alone. Profiles are kept on the tree's root (`:profiles`, a performative key: hidden in the code
  window); `(unlearn! :bN)` forgets them. `kairotic.follow`: `default-profile`, `learn`, `obs-dist`, `hear` with
  what is heard.
- **Study 64 · florid: florid counterpoint over a cantus firmus, every note justified by a derivation** (discussion
  #342, step 3 of #321's road). A frame (second and fourth species, the kernel's strict line and the species' leaps:
  no tritone, no 6th but the minor one going up) drawn by a bridge over the kernel, each half bar
  elaborated into four eighths by a figure of a catalogue (transitus, tirata, circulatio, anticipatio, escape tone,
  cambiata, chord skip, a suspension prepared with a neighbour or resolved later), the dissonance each brings
  justified by the frame. Reduced back by Study 61's grammar on the eighths' grid, the frame's downbeats return. Study 61's `meter` now weighs the units inside the bar (GTTM: the half bar, the quarters, the eighths; with
  two units a bar nothing changes), and `reduce` takes a `judge` for a level read on another grid.
- **7ths prepared** (`@kairotic/cac` 0.7.1). In four parts the 7th of a chord that is not the dominant's — ii6/5 on
  ④, ii7 — is prepared: the same note, in the same voice, in the chord before. The dominant's family stays a
  semi-consonance (IJzerman 6.4–6.6: no preparation needed), but its 7th is held or comes by step — a passing or
  neighbour tone (ex. 6.23, 6.32) —, never by leap, except where nothing comes before it (`four({freeSevenths: true})`
  lifts it). The four-part RO up counts 3,610 (it was 13,925), down 8,450; the book's realizations are still among them,
  and `cac partimento` / `cac judge` follow the same rules.
- **Study 63 · bridges: the most natural legal way from A to B** (discussion #341, step 2 of #321's road). The
  futuribles' exact count turned into a Schrödinger bridge: each way weighs exp(−cost / temperature) by the soft
  rules of every engine, the hard rules refuse, the ends are pinned; backward messages in the log domain on the
  kernel's window, the forward draw by the product, so a bridge draws only legal lines and never gets stuck. Used
  three ways: Study 61's *vary from a level* through its waypoints (no backtracking), a morph between two phrases
  (A's beginning, B's end, the way between), and a bridge between two rhythms by swaps weighed by the metre.
- **Help from the menu of classes**: each class the field of a box offers has a **?** that opens its help; F1, or
  Ctrl/⌘ + ?, in the field opens the help of the class chosen, or else the one written, or else the first offered.
  The field stays open, with what was typed.
- **Voice leading at the level of the structure** (`@kairotic/cac` 0.7.0; Study 61, #321, step 1 of the road
  there). `partimento.mjs` refuses **parallel 5ths and octaves hidden by the diminution**: the same perfect interval
  on two strong units in a row, both voices moved the same way, with only ornaments between them (steps or
  dissonances). A consonant leap between them breaks them, in the upper voice or in the bass, as the treatises allow
  and IJzerman's prototypes show (the 5–8 of the Monte Romanesca, the leaping Romanesca's octaves); `structural: false`
  turns the rule into a soft cost (`structural-parallels`). And **compound melody**: a skip inside the chord (the
  bass held, both notes consonant with it) is one voice unfolding two, its leap costing `chord-skip` (half) less and
  asking no compensation. Every book prototype and pinned count of Studies 51–62 holds; Study 61's levels, checked
  by the same voice, now have the rule too.
- **`cac`: operations on a tree that follow rules** (`@kairotic/cac` 0.6.0; discussion #323). Beside `mt`'s mechanical
  operations, `cac partimento` takes a tree whose lowest voice is a bass (its notes' `:fig` figures and `:local` keys, if
  it has them) and writes the voices above it, 2–4 parts, by the engine of Studies 51–62, counting the realizations
  (a bang another, `:any` any valid one); `cac judge` says whether voices keep the rules, where and why not.
  `partimento.mjs` reads a bass of MIDI notes (`overBass`, `degreeOf`, `guessKey`). **Layers of a tree**: over the
  written tree, `:performance` (#308) and now `:analysis` (`:fig :deg :local :why :harmony`), each shown or hidden in a
  tree box's code window — **Performed** and **Analysis** in its bar, instead of All — and kept when the written tree
  is edited (`mt/without-layers`, `mt/with-layers`). `api/tree-events`, `api/tree-attrs`, `api/tree?`.
- **Study 61: a suspension reduced as one** (discussion #321). The dissonance on the strong unit is the moment that
  matters; what it delays is the consonance. A new operation, `unsuspend`: a note held over the beat, dissonant, going
  down a step while the rest is held — reduced, its resolution sounds on the beat with the bass it was delayed from
  (read forwards: `suspend`). The 7–6 chain's first pass brings its five resolutions onto their beats: parallel 6ths
  on the strong units. A level below the surface is now checked on the phrase's own metrical grid (every rule but how
  long a note may be held), so a strong unit stays strong.
- **A note held is written as long as it lasts** (`@kairotic/cac` 0.5.1). Every engine reads the same note again
  as the note held; what the studies and the `comes` box write for a score now says so too: one note with its whole
  duration, tied only over the bar line, so a score draws the tie. The `comes` box's tree (outlet 4) merges the
  beats of a held note in each measure (it wrote tied half notes); Studies 38, 39 and 40 export a repeated note as
  held (they struck it again, unlike 41–43, 50–60). **Study 61** exports a level, or a variation, as MEI for the
  app: the outer lines of each level's slices, a note held across slices one note (the 7–6 chain's suspensions as
  half notes tied over the bar lines). **Study 62** exports its four parts as MEI too (soprano, alto, tenor, bass, the chords under the bass, the keys
  over it), under the same rule.
- **`click~ downbeat`, and help patches that start by themselves** (`@kairotic/synth` 0.4.1). With the word
  `downbeat`, a number ticks only when it is 0: a lower `click~ 500 0 0.06 downbeat` after a `counter 0 15`, a
  `phase` or any cycle's position marks where the cycle begins, to hear whether two clocks agree. The help patches of
  `click~`, `phase` and `necklace` step by step start their metro with a `loadbang` (▶ is enough) and sound that
  lower click where the cycle begins — in `phase`'s, where the follower believes the clave begins.

- **What each note sounded like, in the take** (discussion #308, step 1; `@kairotic/analysis` 0.8.5): `follow rms
  centroid chroma` has an inlet for each descriptor written after its numbers (from `features~`, `chroma~`); while a
  note of the tree sounds, their values are averaged, and at `stop` the take keeps them per note as its `:profile`
  (`{"n3" {:rms 0.21 :centroid 1840 :chroma [...]}}`) — the measured fingerprint a rehearsal mode will learn from. A
  take shown on the continuum gives its strokes the weight of how loud each note was heard (`:loudness`, `:rms` or
  `:energy`).
- **Study 61: a level plays as it is drawn** (fix): the player put a level's bass on the bars' starts only, but a
  slice of a reduced level may begin on a weak unit (in the 7–6 chain's first level B3 enters on unit 3), so the bass
  sounded a unit late. Each level now plays its slices' own notes (`eventsOf`), and the phrase and the variation
  their notes as written.
- **Study 61: a level is a pass over the whole phrase** (discussion #321). The reduction took one step a level, the
  cheapest anywhere, so it went bar by bar; now each level is a pass, as GTTM's time-span reduction goes down the
  metrical grid: every step that can be taken is, cheapest first, judged against the level below (a parent kept is
  not taken in the same pass, a sonority spread waits for the next), on the metrical stratum reached (the weak units,
  then the bars by their weight; a dissonance wherever it stands). The 7–6 chain loses five suspensions in its first
  pass; the page groups the steps by pass and marks on each level the slices the next pass takes.
- **Study 62 · four: harmony in four parts** (IJzerman, chapter 6; `@kairotic/cac` 0.5.0). `partimento.mjs` has
  `four()`: soprano, alto and tenor over a given bass, counted exactly and written by the engine. The inner voices fill
  the chords (a common tone held long, no turning after a leap); no crossing, an octave at most between neighbours, no
  parallels between any two voices; the bass doubled as a rule, never the leading tone, a dissonance or a chord's 7th;
  the dominant's 7th chord and its family (7, 6/5, 6/4/3, 4/2) as semi-consonances, their 7th going down, the leading
  tone up (an inner voice may fall to ⑤), the deceptive ⑥ doubling its 3rd; the augmented 6th chords, a unit's
  chromatic tones (`chroma`). As data: `CHORDS4`, `RULE_OF_THE_OCTAVE4` (`octaveChord4`). The book's realizations of
  the four-part RO (ex. 6.37, 6.39, 6.42) and of the cadences (perfect, tenor, alto, discant, Galant: ex. 6.13, 6.16)
  are among the ones counted; its «wrong!» Galant cadence is refused for its parallel 5ths.
- **The studies export what they make, for the app** (discussion #319, step 2). One module, `studies/_shared/export.mjs`
  (each study keeps a copy, checked equal by `tests/export.mjs`), writes MEI that the app opens as a tree box: voices
  labelled, notes cut at the bar lines and tied, accidentals for their bar, an upbeat, figures under the bass
  (`<harm><fb>`), keys reached over the staff, double bars between sections, and in `<extMeta type="kairotic">` what
  each study knows that MEI has no place for. An **Export MEI** button in Studies 51 (the schema, its figures), 54, 57
  and 59 (three voices, the chords, the keys), 56 (the melody, its middle voice, the chords and intervals found), the
  canons 38–43 (the dux and the comes, mode, interval, delay; a system without staff names said so) and 50 (a canon
  at any speed whose lattice is binary; thirds need tuplets, not yet). On claude.ai it is saved as `.mei.txt`.
  Studies 58 and 60 now write through it too.
- **`click~`: hear the clock you play along with** (`@kairotic/synth` 0.4.0). A metronome's click: each bang a short
  tick, every `accent` bangs one accented (a fifth higher, louder); a number is a tick, accented when it is 0 (a
  counter's cycle). The help of `phase` and of `necklace` step by step now let you hear their metro, the beats
  accented — following or playing along with a clock you cannot hear was all but impossible.

- **Following, seen on the continuum** (discussions #204, #308; `@kairotic/analysis` 0.8.4): while a `follow` box
  follows a tree, that tree's continuum shows the notes found, the ones skipped, where the performer is (its note and
  a line through it) and the wires that went on. **"I am here"**: a click on a note of the continuum (or `(here! :bN
  note)`, `[:here id]` to the box) tells the follower where the performer is — ahead, as if heard there; back, from
  there again, its wires going on again: the correction a rehearsal needs. `kairotic.follow`: `here`, `view`.
- **`phase`: where a performer is in a cycle** (`@kairotic/rhythm` 0.6.0; discussion #204). A timeline follower, onsets
  only: a pulse clock (a metro, the room's `pulse`) gives the grid, onsets (`onset~`, taps) fall on its nearest pulse,
  and at each pulse the last pulses heard are compared with every rotation of the reference (Toussaint's swap distance,
  plus two for each onset one has and the other has not): the nearest is the phase. The pulse just begun is not judged
  (its onset may come late, as onset~ hears it); ties and near ties go to the phase the walk expects, so missing or
  extra onsets do not throw it. Into a necklace's clock inlet, its hand follows the performer.

- **A menu of classes while a box is written**: the field of a box offers the classes that match the first word
  typed — the core's, the work's own components, the classes of the official packages (in the work or not yet:
  writing one brings its package) and the functions of clojure.core —, each with where it comes from and the first
  sentence of its doc. ↑ ↓ choose, Tab or Enter take one, a click too; once the class is written it shows what it
  takes (its usage). `hlp/suggest` and `hlp/about` give the same from code.
- **`morph` and `vary`: rhythms that move by a measured amount** (`@kairotic/rhythm` 0.5.0; discussions #206, #207,
  #321). `morph` turns one rhythm into another swap by swap: a ratio 0…1 is a point on the fewest swaps from the left
  rhythm to the target — always a real rhythm —, and the way goes out as data (`[:swap from to]`, `[:remove i]`,
  `[:add j]`; onsets paired in order, as the directed swap distance pairs them, taking turns). `vary` is "again, but
  different", seeded: exactly d swaps away (each swap an onset one pulse further from home), or with `depth` the onsets
  on the strong pulses kept down to metrical level d and the rest drawn again (the same skeleton, a new surface:
  #321's "vary from depth k", metre as the grammar); `downbeat` keeps the first pulse. The steps they make are the
  operations `swap` counts: one grammar read both ways.


- **The written tree and the performed one** (discussion #308): `mt/descriptive` leaves out what belongs to performing a
  tree — real times and velocities (`:tstamp.real :dur.real :vel`), wires, takes, the continuum, the ids notes have
  only for takes — and `mt/with-performative` puts back into the whole tree a written tree edited from it, each node
  keeping what it had (an edit of its attributes, or a node replaced by one of its kind). A tree box's code window
  shows it as written (**All** shows everything); `(code :bN text)` with nothing of performing it keeps what the
  tree had. `(mei :bN :written)`, `(export-mei! :bN :written)`: MEI with only what is written, for notation programs.
- **Study 61 · reduction: a phrase analysed into levels, and varied from any of them** (discussion #321). One grammar
  read both ways: the proto-voice model's operations (Finkensiep & Rohrmeier 2021, after DCMLab/protovoices-haskell)
  read backwards reduce a phrase of Study 58's slice by slice to its frame (unsplit: a slice of ornaments taken
  away; unspread: two slices heard as one sonority), and read forwards they are the derivation that composes it. Each
  step chosen by one policy: the ornaments' cost, GTTM's metrical weight and cadential retention, dissonance, the
  soft rules of every engine (`soft.mjs`) and the hard rules of every phrase (`partimento.mjs`, a level checked note
  against note). The 7–6 chain shows its parallel 6ths; *vary from level k* keeps the melody's notes that survive at
  k and writes the rest again with the engine of Studies 56–60, under the same rules.
- **A canon loops from its end** (fix): a sequence lasted only until its last child placed in turn, not until a child
  placed `:at` a time ended — a canon's comes (`[:voice [:seq {:at 2} …]]`) — so `mt/duration` of a canon was the
  dux's, and `mt play loop` started again while the comes still sounded. A sequence now lasts until its last child
  ends; and a loop never starts again before the last thing mt play sends (its final silence).
- **«Any valid one»** in Studies 51, 54, 57 and 59: the button that was «Draw uniformly» — any realization that
  keeps the hard rules, each as likely, without the engine's soft rules.
- **Wires in fixed time, and rests that carry them** (discussion #217; `@kairotic/analysis` 0.8.3): `mt play` sends
  what the wires of notes and rests send on a fifth outlet, at their written time — the same patch of electronics,
  driven live by `follow` or in fixed time by `mt play` (rehearsing without the performer, a virtual performer, fixed
  electronics). A rest can carry wires, `[:rest {:dur 4 :wire {:send :drone}}]`: an event of the electronics alone,
  silent (`mt/events` gives it as `:kind :event`), which `follow` sends led at its time and the continuum draws on its
  lane; with fragments and `[:param …]` ramps, a score of electronics. MEI keeps them (extMeta: it writes rests in a
  row as one).
- **The leading tone goes up to the tonic, over the whole phrase** (IJzerman 2–3; `@kairotic/cac` 0.4.1). A soft rule in
  `partimento.mjs` (`leading-tone`, weight 1.5): not only at the cadence — where it is a hard rule — but wherever the
  leading tone sounds, it costs to leave it otherwise than up to ①; full where it functions (its bass a dominant, or
  going to ①), half in a sequence. Its exceptions cost nothing: a middle voice down to ⑤ over ① (the tonic chord
  completed, as Bach's inner voices do), down a scale by step, a suspension resolving down, the dominant going on
  (the bass on ⑤ still), a change of key, held. **Study 56**'s cadence lets the middle voice go down to ⑤, the leading
  tone read in each unit's key. Measured: where it functions the engine now resolves it (or has a reason not to)
  about 70% of the time, 60% without the rule; the rest refused by hard rules (octaves, a leap that must turn).
- **Study 60 · development: motives, their derivation measured, and a form** (discussion #309). On Study 58's
  incipit: the motive found (the span that recurs most) or marked; Claude asked to develop it and to say how; the
  page measures it (`motif.mjs`: exact transformations by name, else a kinship by weighted edit distance over
  intervals, contour and rhythm) and says whether it is there; a form (period, sentence, small ternary) gives each
  phrase its role; continuations ranked by cost, kinship's sweet spot, the memory of the work and the form's asks;
  the engine develops by beginning phrases with the motive transformed. Study 58's `incipit.mjs` gains a prompt
  option for `continueWith`, a kept `derivation`, and an engine melody begun from given notes.
- **Study 59 · galant: the Galant schemata** (IJzerman, chapter 5; `@kairotic/cac` 0.4.0). `partimento.mjs` has the
  leaping Romanesca, the Quiescenza, the Prinner (and the modulating Prinner), the Monte Romanesca, the Fenaroli and
  the Folia as data (`GALANT`, `galantBass`), the book's prototypes among their realizations, and what they need: a
  **pedal** (the bass held under chords of its own, dissonances coming and going by step; the 7/4), an upper voice
  held long, a **canon with the bass** (`parts`' `imitate`), `hold` per voice, a schema that is not a close
  (`end: false`), a chromatic step where the key changes, the diminished 4th in minor. **Study 56** has chapter 4's
  rules on by default, writes its middle voice with the bass's keys and those rules, finds the Galant schemata by
  their basses, and offers four of them to play over.

- **Wires on their notes** (`@kairotic/analysis` 0.8.2): a wire is written on its note, `[:note {… :wire {:send :swell
  :kind :elastic :tol 0.5 :leader :electronics}}]` (several in a vector), instead of a list on the continuum that
  pointed at note ids: it moves with its note when the tree is edited, and needs no ids. `:cue` is gone (a rigid
  wire, `{:send x}`, says it). `(wire! :bN note send {…})` writes it there (a melody string that holds the note is
  written out), `(unwire! :bN note [send])`, `(wires :bN)`. The follow help patch shows a rigid and an elastic wire.
- **Wires** (discussions #217, #204; `@kairotic/analysis` 0.8.1): `(wire! :bN note send {:kind :rigid|:elastic :tol s
  :leader :performer|:electronics})`, `(unwire! :bN id)`, `(wires :bN)` — a note joined to the electronics, kept on
  the tree's continuum (history, MEI) and drawn on it (rigid solid, elastic dashed with its tolerance, led by the
  electronics a diamond). The `follow` box sends what each wire sends: rigid on its note or caught up once at the
  next, elastic on its note in time or on its own at the expected time plus its tolerance (the box wakes itself up
  for it), led at the expected time. A note's own `:cue` is a rigid wire. `kairotic.follow`: `wires`, `tick`,
  `next-due` (Study 52's Follower, now on the performer's tempo).
- **Study 58 · incipit: phrases that modulate** (after trying it), as Study 57 does (IJzerman, chapter 4). A bass note
  may carry a key of its own (`keys: "C C G G G"`, or `key` for a whole phrase), read there — its degree, a dominant,
  the cadence it closes —, with chapter 4's semi-consonances; Claude is taught the Rule of the Octave, its
  pentachords and tetrachords as the ways between keys, and modulates when asked; the score names the key reached.
  `figuring.mjs` (Study 56) learns a key for each note, unchanged without one.
- **Rhythm and patterns meet** (discussion #252; `@kairotic/patterns` 0.3.0, `@kairotic/rhythm` 0.4.0). A `pbind` takes
  rhythms as generators — `#pat/euclid [k n rotation pulse]`, `#pat/pulses [1 0 0 1 …]`, `#pat/necklace "x..x..x."`,
  `#pat/chance [k n]` (drawn again each pass, with the key's seed). In `:dur` a rhythm gives the lengths between its
  onsets (a pulse as in a necklace's bar, or the one given), so the other keys go on note by note — talea and color,
  as a necklace writes them; in another key (`:pulse`) the pulses one by one, and `:pulse 0` is a silence (a step
  sequencer). `necklace` plays step by step: a bang on its new right inlet moves a hand (drawn) to the next pulse
  and, on an onset, sends a bang out of its new outlet 4 — into a `player`'s left inlet, one event of a pattern a
  step; a number moves the hand there, `:reset` begins again. Help (a step for each), READMEs, assistant, tests
  (`tests/cljs/patterns.cljs`, `tests/theory.mjs`).

- **Study 58 · incipit: a phrase taken on by Claude, phrase by phrase** (discussion #296). A bass and a melody given;
  at a point of the piece Claude offers a few continuations, each a whole phrase with its plan (IJzerman's schemata
  and cadences), checked by `partimento.mjs`'s two-part rules joined to the phrase before it; a failing one goes back
  to Claude with its errors, the soft rules rank the ones that pass, and the person chooses which go on. The phrases
  make a tree of branches; any chosen point can be taken on again, by Claude or by hand (the engine writes a melody
  for a bass given). Kernel `kairotic/incipit.mjs`, the page in ClojureScript, tested with a scripted Claude.
- **Study 57 · octave: the Rule of the Octave, and modulation** (IJzerman, chapter 4; `@kairotic/cac` 0.3.0).
  `partimento.mjs` takes **a key for each bass note**: a note is now a degree in the letters of the key of the whole
  and an alteration (−1, 0, +1) — its code `3·degree + alteration + 1` (`codeOf3`, `codeDegree`, `codeAlter`;
  `codeOf` reads any note within a semitone of the key) —, and what it is is read in the key of its unit
  (`localOf`, `localNote`). One key for the whole counts exactly as before (Studies 51, 54, 56 unchanged). **Chapter
  4's rules** (`ro`): the augmented 4th and the diminished 5th over the bass as semi-consonances (unprepared,
  resolved), a note of the chord before over a passing bass (the descending ④'s 4/2), in minor the leading tone in
  the 6/3 on ② going to ①. `RULE_OF_THE_OCTAVE` and `octaveChord` as data, the 6/5 among the `CHORDS`; `parts` takes a
  bass as it is (`spec.bass`). Study 57 realizes the complete RO (the book's prototypes among the realizations), its
  pentachords and tetrachords, and Bach's and Beethoven's modulating sequences, with the keys boxed.

- **follow** (`@kairotic/analysis` 0.8.0, discussion #204): a performer followed through a tree — Hz from `pitch~`,
  onsets from `onset~`, the tree from a tree box; out the written beat where they are, `[:note id]`, the `:cue` of the
  notes that have one (on the note, or caught up once if passed over), and at `stop` the take, which the tree box keeps
  only for you by default (`[:take … :work]` in the tree). Matching by pitch (an octave off still counts) and by
  expected time at the performer's tempo; wrong notes pass, skipped notes are skipped. `kairotic.follow` (pure, in the
  API as `api/follow-…`); `mei/with-note-ids`: a tree written without ids names its notes as takes point at them.
- **A tree box as a continuum** (discussion #217, Study 52 in the app): `(view :bN :continuum)` or ⇄ — between a
  roll and a score, time (as it sounded → as written), pitch (Hz → keys → staff) and glyph (stroke → head → value)
  each at a resolution that changes over the piece; `(continuum! :bN :dissolve)` and the other presets
  (`:written :proportional :tempered :graphic :mixed :crystallize`) or `{:res …}`, kept on the tree's root (history,
  MEI). Clef and key signature by Verovio, placed on the drawn staff. `kairotic.continuum` (events, project, svg).
- **Takes in the app** (discussion #289): `(keep-take! :bN take)` keeps a performance only for you by default, in
  this browser beside the work (as Learn's mappings), or `:work` in the tree; `(takes :bN)`, `(forget-take! :bN id)`,
  `(continuum! :bN {:take id})` shows one.
- **How strictly a line moves** (`@kairotic/cac` 0.2.2, `partimento.mjs`'s `line`; Study 56): beyond the two-part
  rules, a voice may be held to more of counterpoint's melodic ones — *moderate*, a leap of a 5th or more turns back
  by step; *strict*, leaps up to a 5th or the octave, turned back by step from a 4th, never two the same way. `parts`
  takes one for both upper voices or one each. Off by default (*free*: the counts of Studies 51 and 54 unchanged);
  Study 56's melody is moderate, its middle voice strict, and the number of melodies falls by one or two orders.
- **Takes** (discussion #289): several performances of one tree, on its root as `:takes [{:id :name :made :audio
  :when {note-id [onset dur]}}]` — note times only, with an optional reference to the audio; curves are derived.
  `kairotic.mei` writes them to MEI's performance module (`<performance>`/`<recording>`/`<when absolute
  data="#note">`, before `<body>`) and keeps them exactly in its EDN; a MEI from elsewhere with a performance is
  read into takes (the notes they point at get their `xml:id` as `:id`). `tree->line` takes `{:take id}`;
  `add-take`, `remove-take`, `take-of-line`, `promote-take` (a take as the line's own time) and `ensure-ids` (an
  `:id` for every note that begins a sound). The app's takes, kept "only for me" by default as Learn does, come with
  the continuum view.

- **Study 56 · figuring: a voice that allows a third, and the phrase closed by a cadence** (after trying it). Written
  for three, the melody and its figures are chosen in three parts: a note only where a middle voice can still be
  written under it to the end, and at each unit the likeliest chord such a voice can make with the chords before it,
  so a middle voice can always be written from the figures. The phrase ends with a perfect or imperfect cadence where
  the bass closes on ①; a deceptive or a half one only when chosen, the end of the bass made to fit. In three parts the
  cadence is a cadence: the last chord a 5/3 (never a 6), and from the dominant the leading tone goes up to the
  tonic and the 7th (④) down to ③, in either upper voice.

- **Saving files on claude.ai.** A page there may not start a download; the app now offers its files through the
  artifact's `downloads` capability, and the viewer confirms each one. A work exported as a file is saved as
  `.kairotic.zip` there (claude.ai allows zip, not .kairotic; it is a zip, and Open a file takes it as it is), so a work
  goes from the artifact to Kairotic Pages with its whole history, lines and sounds. The log of your requests to
  Claude is saved as `.jsonl.txt`; a recorded sound (.wav) cannot be saved on claude.ai, and it says so.

- **A long agent request no longer makes a wide box.** The box shows the start of its request (the whole of it on
  hover, in its help and in the Agents section).
- **adc~ on claude.ai says why it cannot listen.** A page on claude.ai may not use the microphone whatever the
  browser allows; instead of the browser's error, adc~ now says so and points to Kairotic Pages (where the same work
  listens: Share/Export carries it) or to recorded sound in a sample box.
- **Study 56 · figuring: the partimento turned round.** A bass without figures, a melody improvised over it on the
  keyboard, and the figures found as it goes — the rule of the octave, the melody's own dissonances, the dominant —
  with the schemata the two lines make, the cadences the bass offers counted ahead, and a middle voice written from
  the figures under the three-part rules (or where and why none can be). The melody is held to `partimento.mjs`'s
  two-part rules: a note played is taken, or corrected to the nearest that can be, and why.

- **MEI in the app** (discussion #217, phase 1 after Study 55). The kernel of Study 55 is a module of the core,
  `kairotic.mei`: a tree as MEI (mt/->mei's notation, `@tstamp.real`, `@dur.real` and `@vel` where a note has them,
  and one `<extMeta type="kairotic">` with the rest as EDN) and MEI as a tree, now with several voices, keys and meters
  written as `<keySig>`/`<meterSig>` elements, and MusicXML through Verovio. In the app: `(mei :bN)` and
  `(export-mei! :bN)` (a tree in free time is quantized first), `(import-mei!)` / `(import-mei! :bN)`, and a .mei or
  MusicXML file dropped on the patch becomes a tree box. **Quantize keeps where the notes really sounded**: each note's
  first piece has `:tstamp.real` and `:dur.real` (seconds, at the material's tempo; `[:real false]` leaves them out),
  and `(unquantize! :bN)` puts the notes back there (the roll's own edits keep the written times). Tests:
  `tests/cljs/mei.cljs`, and the tree box's MEI in `tests/views.mjs`.

- **A 6/4 resolves as a double appoggiatura** (`@kairotic/cac` 0.2.1, `partimento.mjs`; Study 54): over a held
  bass the 6/4 goes to the 5/3 with each voice down a step, the 6th to the 5th and the 4th to the 3rd, without the
  voices exchanging them. The Galant cadence takes the book's 6/(3) on ④ (ex. 3.21: a sixth chord with its bass
  doubled, chord `6`), which its prototype needs; its count rises again (the stepwise Romanesca: 2,246).

- **`@kairotic/rhythm` 0.3.0: more generators, and how far apart two rhythms are** (discussion #252). `chance k n
  [seed]` draws k onsets among n pulses, each bang another rhythm, the same seed the same rhythms in the same order;
  `homometric` gives the other rhythms with the same interval vector (not the same necklace turned or mirrored: the
  two flat rhythms of four in twelve), as a list of pulses; `swap` is Toussaint's swap distance between two rhythms —
  in the bar, around the circle, as necklaces at the best rotation, directed when they hold different numbers of
  onsets — with the Hamming distance beside it. All speak pulses, as `euclid` and `necklace` do.

- **`@kairotic/cac` 0.2.0: `partimento.mjs`**, the hard rules of tonal counterpoint over a given bass, shared:
  one voice (`schemata`, the two-part rules of Study 51) and two (`parts`, the three-part rules of Study 54), with
  the book's schemata, cadences and prototypes as data, beside `soft.mjs`, which weighs what they allow. Studies 51
  and 54 publish copies of it (their `schemata.mjs` and `parts.mjs` re-export it), and `tests/counterpoint.mjs`
  checks that the copies are the package's. Two parts get the minor-mode rules of three: over a dominant ⑦ is
  raised, a raised ⑥ goes on up to the raised ⑦, and a 7th may put off its resolution by one chord.

- **Study 54 · parts, the rules of three voices**: the 3rd of a chord is not doubled, nor the leading tone, and no
  false relation sounds between the upper voices; in minor the chord on the dominant is major (⑦ raised over a ⑤
  going to ① or ⑥, while a ⑤ passed in a sequence keeps the natural minor), and a raised ⑥ goes on up to the raised
  ⑦. A 7th may put off its resolution by one chord — the 7th of ② held into the 4th of the 6/4 or 5/4 over ⑤ —, so
  the Fifth Down Fourth Up closes with a compound or deceptive cadence too.

- **An agent's panel.** The presented controls of an agent's content show on the agent box itself, as those of a
  `patch` box do (Study 11): an instrument Claude built is played from outside without opening it. Claude is told
  to present the controls it builds; presenting or hiding them by hand in its content changes the panel too.
- **Study 55 · MEI** (discussion #217, its second study): the continuum of Study 52 deterministic and coherent
  between the tree and MEI. A line becomes a canonical tree of `kairotic.mt` (a note per measure it sounds in, tied
  on; free notes in Hz; the real times, loudness and glissando on its first piece; the resolutions, wires and
  electronics on the voice); its MEI is the app's `mt/->mei` with `@tstamp.real`, `@dur.real` and `@vel`, and one
  `<extMeta type="kairotic">` with the rest as EDN by `xml:id`. Tree → MEI → tree and MEI → tree → MEI are
  fixpoints (byte for byte) and the line comes back exactly; a MEI written elsewhere reads as its notation. Kernel
  `studies/55-mei/kairotic/meitree.cljs` (tested in the browser on the app's modules) and a page; Study 52's kernel
  takes a written name for a note's staff step (`spellName`).

- **`state`, `transition`, `instruction` and `region` leave the core** (breaking). They came from Study 1 — the
  temporal, conditional, opportune changes of state a work would be made of — but never had a behaviour: boxes with
  ports that did nothing. A layer of form (states, transitions with time windows and conditions, instructions for
  the performers, regions) is a discussion of its own, and will come back as a package once a study shows it.

- **The Agents section of the Claude panel** (issue #275). Every agent box of the work, through its embedded
  patches: its request, whether it is building, built or failed, who asked, whether its content was changed by hand,
  what Claude said it does, its line, and the log of its builds (each try sent back to Claude, the build, the error),
  which no longer goes to the REPL. Buttons open its line, build it again (`(rebuild-agent :bN)`: the same request,
  another answer, a new point of its line) and ask it for something else.

- **Agents you can read from outside** (issue #275). Claude now says what it built: a paragraph and a line per inlet
  and outlet (an ```agent block before the patch code), kept in the box's recipe. **?** on an agent box shows that
  agent's own description and ports before the page of the class, `(agent-info :bN)` returns them, and its ports say
  it on hover — and the ports of every class now say on hover what their help says of them. `agent-core`, put
  inside every agent by the engine, is internal: out of the class lists, Claude's catalog, the Help tab and the
  patch checks.

- **`@kairotic/rhythm` 0.2.0: making a rhythm apart from being one** (discussion #252). Pulses — ones and zeros — are
  the common tongue of the rhythm boxes, as Hz are of pitch. `euclid k n [rotation]` is now a generator with no view:
  a bang sends the pulses of a Euclidean rhythm. `necklace` is the rhythm box: it holds them, draws them, is their
  editor, measures them and writes them as a musical tree with pitches (the outlets, the right inlet, `bars` and
  `[:meter …]` `euclid` had are its own now): `euclid → necklace → tree`. Its measures gain the **Fourier
  coefficients** (`:fourier`, `:phases`, after Amiot and Milne: |f1| near 0 balanced, |f_k| largest when maximally
  even, the others periodicities), drawn as bars with the word `fourier`. Breaking for patches that took a tree from
  `euclid`: put a `necklace` between them.
- **The `agent` box** (issue #269, after Study 53 and discussion #256). Its request is its text,
  `agent "harmonize this melody in four parts"`, and Claude builds its content with the classes the work knows,
  checked as the Claude tab checks a patch, with up to three tries (a patch that fails goes back with its errors).
  The content is a line of its own (`agent b3`): double-click opens it in its tab, each build is one more point
  of it, and once built it plays with no call to Claude. Its ports are the content's and one more of each, last:
  a message to the last inlet (a string or `[:ask "…"]`) is a new request, so a patch can ask it
  asynchronously, and the last outlet says `:building`, `:built` or `[:error "…"]`. Whoever asks pays: who writes
  the text, or whose patch sends the message (never a jam's). One build at a time per box, and a request equal to
  the one that built it is not sent again. `(ask-agent :bN ["…"])`, `(agent-info :bN)`.

- **`@kairotic/cac` 0.1.1 and `@kairotic/rhythm` 0.1.1**, the first versions published through their trusted
  publisher (0.1.0 went to npm by hand). `publish-packages.yml` no longer fails on a tag whose version is already on
  npm: it says so and ends green.

- **`@kairotic/cac`: composition assisted by computer.** The engines that write music with you leave the views:
  `comes` moves from `@kairotic/theory` (0.14.0: `pcclock`, `fourier`, `tonnetz`) to the new `@kairotic/cac` 0.1.0,
  with the kernels every engine shares — `counterpoint.mjs`, `mirror.mjs`, `soft.mjs` (the page's copy now under
  `kairotic/packages/cac/`). Writing `comes` brings the new package; works that already carry theory with `comes`
  inside keep their copy. The place for the next engines of discussion #172 (the futuribles, partimento, the
  realization of schemata). `tests/counterpoint.mjs` reads the kernels there.

- **`@kairotic/rhythm`, a package for rhythm as geometry** (discussion #252): `euclid` moves there from
  `@kairotic/theory` (0.13.0 without it; writing `euclid` brings the new package), beside `necklace`. A package
  travels as one component box, and `@kairotic/theory` with both would have passed the 100 000 characters a code
  box keeps (its source was cut and did not compile): that limit is now 250 000.

- **`necklace`: a cyclic rhythm and its geometry** (discussion #252, `@kairotic/rhythm` 0.1.0). k onsets among n
  pulses around a circle — the object of `pcclock`, now for time —, measured as Toussaint does: the interval vector,
  evenness as the sum of chords (Block and Douthett; the rumba less even than the bossa nova, where arcs see them
  equal), `:even` against the Euclidean rhythm, deep (the bembé, as the diatonic scale), flat, axes of mirror
  symmetry (drawn), the longest gap, rhythmic oddity and the rotation of E(k,n) it is. It takes pulses (`euclid`'s
  right outlet), intervals (`[3 3 2]`), box notation (`"x..x..x."`), an `:rtm` map or a tree; pressing a pulse adds
  or takes away an onset, `:complement`, `[:rotate 1]`, `[:n 12]`. Its outlets 0–2 are `euclid`'s (tree, `:rtm`
  map, pulses) and its right inlet takes pitches the same way; the measures go out on outlet 3. Help, README,
  assistant, tests in `tests/theory.mjs`.
- **One way to weigh decisions: `@kairotic/theory`'s `soft.mjs`** (0.13.0). The soft rules of Studies 38–42 —
  what a candidate costs by the shape of its line and by the vertical it makes, each rule by its id and weight, and
  the engine's softmax of −cost / temperature — are now one module, exported once for every engine: the comes box
  weighs with it (adding its own two rules, the mode and the imitation; its fans and its canons are the same as
  before, note for note and cost for cost), and the studies' engines and the agents Claude builds use it. The tests
  check that the comes box's weights are the module's and that Studies 50 and 51 weigh as it does.
- **Study 54 · parts**: a given bass realized in three parts — a schema of chapter 2 of IJzerman's book
  (Fauxbourdon, Monte, 7–6 Fauxbourdon, stepwise Romanesca, Fifth Down Fourth Up, Tied Bass) closed by a cadence of
  chapter 3 (simple, compound 6/4 or 5/4, Galant, deceptive, half). Each upper voice under Study 51's rules against
  the bass, the upper voices under their own (the 4th a consonance there), the chords as which intervals sound;
  counted exactly, drawn uniformly or by the engine. Kernel `studies/54-parts/kairotic/parts.mjs` with its tests
  (Node and browser) and a page.

- **Study 53 · harmonize** (discussion #256, its first study): an `agent` box — given a melody and a request, Claude
  builds a harmonizer inside it as a sub-patch that can be opened, edited and run again without Claude (the request
  and the melody kept as its recipe). It builds with the study's boxes and writes a `code` box or a class of its own in
  `:defs` (an Alberti bass) for what none of them does; a failing patch goes back to Claude with its error. `bass` is
  Study 51 turned upside down (the melody given, the bass written under it by the same rules, plus ① to begin, ⑤–① and
  half cadences, its futures counted, the engine with three soft rules of style); `inner` realizes the figures in four
  parts by the rule of the octave, with the cadential 6/4, without parallels. Kernels
  `studies/53-harmonize/kairotic/harmonize.mjs` and `agent.mjs` with their tests (Node and browser), the page in
  ClojureScript tested with a scripted Claude.

- **Study 52 · continuum: the start of the staff by Verovio.** The treble clef, the key signature (two sharps in D)
  and the meter are engraved by Verovio and scaled onto the staff, where the clef used to float off it; the meter
  shows as much as time is metric at the start. Without Verovio the key signature is drawn by the page.

- **One box, `comes`, for the canon and its mirrors** (`@kairotic/theory` 0.12.0; breaking, for 0.3.0). As Study 50
  found, the comes is a reader of the dux at a **speed**: `comes` reads it at 1 (a canon), `comes 0.5` twice as
  slow (an augmentation), `comes -1` backwards (a crab, written from both ends to the middle, or played live beat by
  beat as Study 46 plays it); `inverted` turns it upside down (an inversion, or with −1 a table canon). The box
  `cancrizans` is gone, with no alias: its engine is the backwards half of `comes`. The words `inversion`,
  `augmentation` and `table` and the messages `[:transform …]` and `[:table …]` give way to `speed`, `inverted`,
  `[:speed -1]` and `[:inverted true]`; the numbers in the box's text begin with the speed
  (`comes [system] [mode] [speed 1] [k -7] [d 3] …`), and `bars 0` is the relation's own length (8 forwards, 6
  backwards). Five outlets for every speed: the Hz of both voices, their voice ids, the futuribles, where the work
  is, and the finished work as a musical tree for a `tree` box (forwards too, now) — backwards the patterns for
  `pbind` are gone: the help plays the crab from its tree with `mt play`. Its help has the canon, live, the crab and
  the crab live as four steps; the assistant knows it.

- **`euclid`: rhythm as geometry begins** (discussion #252, `@kairotic/theory` 0.11.0). A Euclidean rhythm by
  Bjorklund's algorithm, after Toussaint: `euclid 3 8` the tresillo, `5 8` the cinquillo, `5 16` a rotation of the
  bossa nova, `7 12` the bembé. Drawn as a necklace (the pulses around a circle, the onsets a polygon); pressing a
  pulse makes the rhythm start there. Rhythm apart from pitch: it sends a musical tree for a `tree` box — a bar of
  n pulses (4/4 for 8 or 16, 12/8 for 12, n/8 up to 12, else n/16, or `[:meter …]`) with an `:rtm` whose shares are
  the intervals between onsets —, the `:rtm` map alone (outlet 1), to merge with any map of pitches elsewhere, and
  the pulses as ones and zeros (outlet 2). Its right inlet (cold) gives the pitches the notes take in turn, starting
  again when they run out (talea and color; with `bars` the color goes on from bar to bar): a keyboard's keys in
  Hz (MIDI with `midi`), a melody string, a map with `:pitches` or `:pitch`, a pattern of `comes` or `cancrizans`.
  `[:k 5]`, `[:n 16]`, `[:rotation 2]`, `[:bars 4]`, `[:meter "3/4"]` (or a map) change it. Help with a lesson,
  the assistant knows it, tests in `tests/theory.mjs`.
- **The claude.ai artifact as a thin shell.** `site/build.mjs` makes a third edition, `_app/`, published to npm as
  `@kairotic/app` (tag `app-vX.Y.Z`, version in `app/package.json`): the app as built for claude.ai plus
  `sources.mjs`, every file the page fetches (index.html, the `.cljs`) as strings. The artifact becomes
  `site/shell.html`, which imports `@kairotic/app@latest` from jsDelivr, pins the version it gets, sets a `<base>` at
  the package (so the app's `.mjs`, CodeMirror, the packages and the ring~ worklet come from there) and answers the
  app's `fetch` from `sources.mjs` — a page on claude.ai may import modules from jsDelivr but not fetch files there.
  The app is unchanged, and the artifact no longer needs republishing when it changes. Tested on claude.ai with the
  package simulated by the artifact's own files.

- **Study 52 · continuum** (discussion #217, its first study): one line of events drawn at a resolution per axis —
  time (proportional → metric), pitch (Hz → a semitone grid → the staff, spelled in the key), glyph (a stroke → a
  head with a duration line → a note value) — each changing over time, so a phrase can begin written and dissolve
  into proportional notation and strokes over the same data. Live electronics wired to its notes: rigid (on the
  note; a note left out caught up at the next) or elastic (expected from the performer's last note; the performer
  leads and the electronics wait up to a tolerance, or the electronics lead and the performer follows). One
  follower decides offline (simulated performers) and live (a key per note); the electronics are a faust~. Kernel
  `studies/52-continuum/kairotic/continuum.mjs` with its tests (Node and browser) and a page in ClojureScript.

- **Study 51 · schemata**: a given bass realized in two parts, as a partimento is — the schemata of chapter 1 of
  Job IJzerman's *Harmony, Counterpoint, Partimento* as data (parallel 3rds and 6ths, 3–6, Third Down Second Up,
  7–6, 2–3, Fifth Down Fourth Up 7–3, Tied Bass 2–6), in any key. The upper voice is written unit by unit under the
  rules of two-part realization (suspensions prepared and resolved, passing tones, melodic minor); the realizations
  are counted exactly with the figures and without them, the book's prototypes are realizations of their schemata
  and close as the book names it, and the page lets the voice be written by hand, each next note with its futures.
  Kernel `studies/51-schemata/kairotic/schemata.mjs` with its tests (Node and browser) and a page.
- **The soft rules in JavaScript** (`kairotic/soft.mjs` in Studies 50 and 51): the melodic contour after Bach and
  the motion between the voices of Studies 38–42, ported from canon.cljs with the same weights, and their engine (a
  softmax of −cost / temperature). Drawn uniformly, a work leaps because most works do; the engine draws the
  stepwise ones. Study 51 chooses note by note and shows each next note's cost; Study 50 weighs whole works (a crab
  is not written forwards). A hemiola leaps by its nature: none of its 7,794 works has more than 4 steps in 9 moves.
- **Study 51 counts figurings**: realizations with the same figures on the strong units are the same music (an
  octave away, the bar divided otherwise). With the book's figures each schema has one figuring; without them, from
  1,102 (Fifth Down Fourth Up) to millions. "Another figuring" draws one among them, realized by the engine.

- **Study 50 · lines** (discussion #248): counterpoint between two timed lines, whatever their relation in time.
  The comes is a reader of the dux at a signed speed p/q; the lines are spelled on the finest lattice both fall on
  and Study 42's rules are asked unit by unit. A canon, an inversion, an augmentation, a crab and a table canon
  count exactly as Studies 41–43 counted them; the order of writing follows from the relation (forwards, from both
  ends, or — for a crab in augmentation — from both ends meeting off the middle). New: hemiola (⅔), sesquialtera
  (3/2), diminution (2, which needs a free last note of the comes), crab in augmentation (−½), crab in hemiola (−⅔,
  only at the unison). Kernel `studies/50-lines/kairotic/lines.mjs` with its tests (Node and browser) and a page.

- **A local work begins empty.** Starting locally no longer opens the example work: the patch and the history are
  empty, the first gesture is the root, and the history pane offers "Start with the example work" (as an empty solo
  work or room already did).

- **Docs, tutorials and the assistant follow the last changes.** The guide (EN/ES) and *Musical trees* (`docs/mt`)
  present `quantize` beside `quantize!`; *Writing a component* documents `:about` and `:args` in `:help`; the READMEs
  of `@kairotic/theory` (pitches in Hz, `midi`, `:clear`) and `@kairotic/analysis` (`transcribe` → `quantize`). The
  tutorials send trees to tree boxes instead of a freqt shown as a score (*A motif and its transformations*, *Names
  and keys* in *One, two, tree*, and *A work as a tree*, where the tree box is its own score and the dashed line of
  edits is gone), mention `quantize` for a freqt's drawing, and write `pcclock midi`, `fourier midi`, `tonnetz midi`
  in *Harmony as geometry* — in their Markdown sources this time (the catalog is built from them: the change of
  #242 to the catalog alone would have been lost at the next build). The in-app assistant knows `quantize`, that
  trees go to tree boxes, the Hz/`midi` convention, `comes` and `cancrizans`, and that orders are keywords.

- **`mt` speaks as the heads do.** `mt canon d 2 k P5 speed 0.5 inversion`: the comes d beats later, k away
  (semitones or an interval name, as `mt transpose`), at a speed — 0.5 twice as slow (an augmentation canon), 2
  twice as fast, −1 backwards (a crab) — and upside down; `mt canon 2 7` stays. `mt play speed 0.5` (or `msg :speed
  -1`, the tree backwards) plays at a speed: the reader of a tree on its own clock, as a reader on a ring follows
  its head; a `reader` moved by positions reads the tree box instead (what sounds where it is, Hz and ids, an empty
  list where nothing does). There is no writer of trees: writing in time into measures is quantizing, which
  `record` / `transcribe` → `freqt` → `quantize!` do in view. Tests in `tests/cljs/mt.cljs`.

- **`quantize`: free time written in measures, as a box.** What `transcribe` or a drawing left in a `freqt` (its
  second outlet on the right inlet), or a tree in free time on the left (a measured one is made free first), becomes
  a measured tree — measures, tuplets, ties, grace notes, voices — for a `tree` box. It is manual: options come as
  messages and are kept (`[:meter "3/4"]`, `[:meters …]`, `[:divs [1 2 3 4]]`, `[:merge []]`, `[:legato 0.25]`,
  `[:chord 0.04]`, `[:voices 1]`, `[:grace false]`, `[:key "eb"]`, `[:tempo 72]`, `[:time :track]`, a map of
  them, `[:meter nil]`, `:reset`), and only a bang quantizes and sends — a tree into a tree box is an event of the
  work's history. Its second outlet says what it found (`{:bars :meter :tempo :notes :voices}`). It is the same
  quantization a `freqt` shown as a score uses, which stays as a preview. Help patch (a phrase played freely, in
  4/4 and in 3/4; then from your voice through `transcribe`), and `transcribe`'s help points to it. Tests in
  `tests/views.mjs`.

- **Pitches in Hz, MIDI with `midi`; trees into `tree` boxes** (breaking; `@kairotic/theory` 0.10.0).
  - `pcclock`, `fourier` and `tonnetz` take Hz by default, as `keyboard`, `midiin`, `player` and `pitch~` send them
    (0 Hz, a silence, is nothing), and MIDI (or 0…11) with the word `midi` — as `comes`, `cancrizans` and `realize~`
    already did. A chroma (12 values between 0 and 1) is taken as it is. Their help patches, which send MIDI
    messages, now write `pcclock midi`, `fourier midi`, `tonnetz midi`; so does the tutorial on pitch-class sets.
  - Boxes that give music as a tree send it to a `tree` box in their help patches, which shows it as a score: the
    help of `tree` (through `mt transpose 7` into a second tree), of `mt`, and of `cancrizans` (its outlet 4).
    `freqt` stays for what has no musical form yet — strokes of frequency over time (`transcribe`, `record`, drawing),
    `render`'s time maps — and its own help still shows it as the viewer of a tree.
  - `cancrizans live` sends its score twice a crab — at the middle what is left to read, and the whole crab at the
    end — instead of at every beat read, since a tree written into a tree box is an event of the work's history.

- **A faust~ in a loop of a ring~ runs inside it** (Study 49 in the app). `reader~ → faust~ → writer~`, all on one
  ring~: the engine sees the loop (every tick, after the nodes are fed) and sends the faust~'s compiled bytes to the
  ring's node, where they run one sample at a time in the writer's slot, hearing those readers; the line from the
  faust~ to the writer~ is taken away, so nothing arrives twice. The loop is exact at any d (a string, a comb). The
  faust~ keeps its own node for whatever else it feeds, and its parameters (messages, sliders) reach its copy in
  the ring. Not a polyphonic faust~. Tests: `tests/ringcore.mjs` (+3) and `tests/ringaudio.mjs` (folded, the level,
  a parameter, unfolded).

- **Help pages for boxes with many options.** A help entry can now carry `:about`, an introduction in short paragraphs
  (bold, `code`), shown first, with the box's whole description folded below it ("Everything it does"), and `:args`,
  what each argument does, as a third column of the Arguments table (and in the reference). `comes` and `cancrizans`
  use them: what the box is, the two ways to play, the system and its mode, how the comes imitates, what comes out;
  each argument explained; their messages ordered (playing, then changing the canon, then chance) and complete.

- **`comes` and `cancrizans`: the system and its mode, named as such** (`@kairotic/theory` 0.9.2). The box's words
  were `[mode] [system]`, and a system written in the place of the mode (`comes pentatonic`) was quietly taken as a
  system — so `mode` did not always name a mode, and a mode the system does not have (`comes pentatonic dorian`)
  was quietly replaced by its first one. Now the words name the system and one of its modes in any order (`comes
  dorian`, `comes pentatonic penta-A`, `comes penta-A pentatonic`), the usage reads `[system] [mode]`, a mode the
  system does not have is said (`dorian is not a mode of pentatonic (penta-C, penta-A, penta-D): penta-C`, in the box
  and as `:note` in its report), the reports carry `:system` and `:mode`, and a key outside the scale is "not a note
  of the system (pentatonic)" rather than "of the mode" (a mode is a final, a tenor and a range over the system's
  scale, not a scale of its own).

- **Orders are keywords only.** Since `msg` is read as Clojure (#197) a word without its colon is a name, and an
  order was still also matched as a string in 14 boxes (`#{:clear "clear"}`): a string that came as data was taken
  for an order — `serial` could not send the line `"open"` or `"close"` to a board, `edn` could not hold `"clear"`,
  `fetch` took `"get"` or `"refresh"`. Now only the keyword is the order, and a string is always data: `comes`
  (`:end :reset :back :engine :hold`), `cancrizans` (`:reset :back :engine`), `pcclock`, `fourier`, `tonnetz`, `midiin`,
  `midiout`, `edn`, `fetch` (`:clear`, `:bang`, `:refresh`, `[:get …]`, `[:fetch …]`), `serial` (`:open :close`),
  `pulse` (`:start :stop`, `[:bpm n]`), `scale` and `realize~` (`:learn`, `[:learn :off]`), `faust~` (`[:gain v]`),
  and the core's `:clear`/`:flush` of transducer boxes and the `:clear` of a sub-patch's state. `tests/keywords.mjs`
  (in CI) checks that no component matches an order as a string again; data sets (a tree's `:every`, a pattern's
  rests, a page's mode in its URL) stay. Packages: `@kairotic/analysis` 0.7.5, `controls` 0.2.3, `data` 0.1.4, `io`
  0.2.4, `net` 0.1.3, `theory` 0.9.1.

- **Study 49 · insert**: a Faust DSP in the feedback of a ring of sound, inside the same node. The page compiles the
  code (faustwasm) and sends its WebAssembly module to the worklet that holds the span; there it is instantiated
  (its math imports, its memory laid out as faustwasm lays it) and runs one sample at a time (`compute(1)`) between
  what a reader sends, times feed, and what the writer writes — so the loop is exact at any d. A plucked string is a
  ring whose d is its period; `outside` makes the feedback wait a block, as through other boxes. Presets: tape echo,
  dub, spiral, string, comb. `studies/49-insert/` (core `insertcore.mjs` with `tests/core.mjs`, 6, also in Node;
  `tests/page.html` with real Faust). The studies' runner waits up to 120 s for a page.

- **Every reader reads alike** (breaking). `reader` and `reader~` take a position in the units of their buffer —
  the X axis of a canvas (Y with `y`), the time of a freqt, the seconds of a sample, a ring or a ring~ — or, with
  `norm`, from 0 to 1; along a stroke (`path`) it is always 0…1. Before, `reader~` read a canvas, freqt or sample
  only from 0 to 1: a `phasor~` straight into a `reader~` is now `reader~ norm`. The words of a head on a ring
  (`d`, `speed`, `jump`) are the same for both; the help patches, the guides and the tests say `reader~ norm` where
  a phasor~ drives it.

- **`comes` and `cancrizans live` sound as a keyboard or a player does** (breaking; `@kairotic/theory` 0.9.0). Both
  voices go out together on the left — the dux as played or corrected, and the comes (or your note and the box's
  answer) — after their voice ids on the second outlet, so one `synth~` (0→0, 1→1) or a polyphonic `faust~` plays
  them, as with `keyboard`, `midiin` and `player`. A voice's id is where its note was struck: a note held over the
  beat keeps it and goes on sounding, a note struck again (even the same) is struck again. Before, `comes` sent the
  comes on 0 and the dux on 1, each a list of Hz without ids (two `synth~` were needed, and one alone played only
  the last line it got); `cancrizans live` sent only its own answer, and the score to read as a pattern on 1 (now the
  tree on outlet 4 only). Both also take a player's event (`:hz`, a list) as a note, beside `:freq` (midiin, oscin).
  The help patches play both voices on one `synth~`. Text: `:clear` with its colon in the help of `pcclock`,
  `fourier`, `midiin` and `midiout` (`@kairotic/io` 0.2.3).

- **ring~, writer~, and reader~ on a ring~** (the heads with sound in the app; Study 48's core). `ring~ [seconds]`
  keeps the last seconds of the sound on its left (with nothing there its own head does not write). One
  AudioWorklet node per ring~ (`core/kairotic/ringcore.mjs`) holds the buffer and up to 8 heads: the `writer~` and
  `reader~` boxes on its right outlet take a slot there, so they share the buffer and a feedback inside the ring is
  exact. `reader~` on a ring~ follows its head without a position signal (`reader~ d 1 speed 0.5`; `msg :d`,
  `:speed`, `:jump`, `:gain`; a new d glides or seeks with a crossfade) or reads at a position signal (seconds,
  `norm` for 0…1). `writer~ [ovr|mix [keep]] [jump s] [norm]` (sound · buffer · position) writes as a tape head, at
  a position signal or at the ring's head; `:rec t` / `:ovr t`, `:stop`. Tests: `tests/ringcore.mjs` (the core sample by
  sample, in Node and from the app's tests) and `tests/ringaudio.mjs` (in the app, with sound). Readers and `norm`:
  `reader norm` on a canvas or freqt reads 0…1 along its axis (reader~ always read them so); `norm`, `d`, `speed`,
  `jump` are never taken for a stroke's name (`reader~ path norm`) nor, in reader~, for a count of voices.

- **ring, writer, and reader on a ring** (the heads of Study 47 in the app, messages first; discussion "Heads on a
  span of time"). `ring [seconds]` keeps the messages of the last seconds, each at its time (from its first
  message); its write head goes round as a tape head, so what is older than one turn is gone; `:clear`, `[:data]`.
  Its right outlet is the buffer, and says `:start` when its time starts. A `reader` on it is a head of its own,
  two ways: it **follows** (`reader d 1`, `msg :d 1`; then `speed`: first the distance, then the speed — a canon, a
  delay, an augmentation, backwards), moving on the engine's clock and sending each value at the instant it meets
  it; or it is **moved** by numbers on its left (a ramp, a counter; `norm` for 0…1), sending what it crosses either
  way, a move larger than its `jump` a seek. A `writer` (what to write · the ring's buffer · a position) writes where
  it is, from any source — without a position, where the ring's head is —, erasing what it passes (`ovr`, silence
  too) or leaving it (`mix`); `:rec t` / `:ovr t` send it to t at speed 1. A reader into a writer on the same ring is
  feedback: a round. The model is `core/kairotic/span.cljs` (pure); the boxes are `core/kairotic/ring.cljs` and the
  reader in `components.cljs`. Tests: `tests/cljs/ring.cljs` (a small engine runs the heads in time) and
  `tests/ring.mjs` (in the app, with ▶).
- **`cancrizans` as a score, and the `html` box shows lists as tables** (`@kairotic/theory` 0.8.0). A fifth outlet
  sends the crab as a musical tree, for a `freqt` shown as a score: when the work closes, both voices; live, from the
  middle what is left of your line to read (the beats already read as rests, so the bar stays where it was), and at
  the end the whole crab. The `html` box shows a list of maps in a hole as a table (a row each, a column per key), and
  keeps anything else that reaches it — a number, a list — as the value `:in` (`:$in`): the futuribles of `comes` or
  `cancrizans` straight into a table. The help of `cancrizans live` shows both: an `html` with the beat, the phase, the
  ways left and the futuribles (with `:end`, what the box will answer), and the score to read. The score to read was
  checked: it is the rest of your line, the first note the last end of your line the box wrote (with an odd number of
  beats the middle note is shared, the box playing it with you an octave below); the help now says so.

- **`comes` and `cancrizans`: the help with keywords, and two voices heard** (`@kairotic/theory` 0.7.1). The help
  of `cancrizans` still sent `msg engine`, which since `msg` is read as Clojure is a name and does nothing: now
  `msg :engine`, and the orders written with their colon in both boxes' help, `:doc` and README (`:engine`,
  `:back`, `:reset`, `:hold`, `:end`). In the example the dux and the comes each have their own `synth~` (with one
  the second player's note took the place of the first's, and only one voice was heard), and in the live step your
  keyboard sounds on a `synth~` of its own beside the box's answers.

- **Study 48 · heads~**: Study 47's heads with sound. A span of samples (a ring~, or a fixed work) and heads, each a
  head of its own: writers are tape heads — they write what they listen to (the input, or a reader times its feed)
  on every sample they pass, silence too, replacing (`ovr`) or keeping what was there times `keep` (`mix`); readers
  sound where they are, following a writer (d, then speed: pitch as well as time), on a clock, a signal or by hand,
  a new d gliding or, beyond the jump, seeking with a crossfade. `:rec t` / `:ovr t`. Presets: canon, canon in
  three, augmentation (an octave down), reverse delay, a palindrome in sound from both ends, scrubbing by hand, a
  writer on a signal (wow), a round (feedback), an eraser. The core (`studies/48-heads-audio/kairotic/headscore.mjs`,
  JS, in an AudioWorklet) has `tests/core.mjs` (23, also in Node); the page is ClojureScript, with `tests/page.html`.
- **Systems in `comes` and `cancrizans`** (`@kairotic/theory` 0.7.0, Study 42 in the app): the scale, its tuning
  and its rules as data. `comes pentatonic`, `cancrizans septimal31`, `comes penta-A pentatonic`, or on the way
  `[:system :meantone]` or an EDN map `[:system {…}]`: the modes, the distances at which the comes may imitate (an
  octave below is the system's period) and the tuning come with the system. A key is taken as the nearest note of
  the system (within a quarter of a tone or so), and the notes out are tuned (Hz, or MIDI with a fraction). Fixed:
  `cancrizans` lost the mode written in its text (`cancrizans hypodorian` played dorian).

- **Study 47 · heads**: canons and rings as one model — a span of time (a ring, or a fixed work) and heads that
  write and read it, each a head of its own. Writers write where they are (replacing, or mixing); readers send what
  they cross, either way, with a jump that is a seek; a head's position comes from a clock (start and speed), a hand,
  a signal (a clock moved by a slow wave), or following a writer (first the distance, then the speed). A writer
  writes what it listens to — the keys, or what a reader sends (feedback) —; still, it replaces what was written where
  it is (a chord stays); a move larger than its jump is a seek; `:rec t` / `:ovr t` send it to t at speed 1. Presets:
  canon, canon in three, augmentation, reverse delay, a palindrome written from both ends, a reader by hand, a writer
  on a signal, a round. The model is pure ClojureScript
  (`studies/47-heads/kairotic/heads.cljs`), with `tests/heads.cljs` and `tests/page.html`.
- **`comes`: a temperature and a seed** (`@kairotic/theory` 0.6.0), as `cancrizans live` has: `temp` (`[:temp 1.5]`)
  draws the comes among its candidates when the imitation is below 1, and in `engine` the dux among the futuribles
  (by their score), with the box's own seed (`seed`, `[:seed 7]`; reset starts the same game again). At 0, the
  default, nothing changes: the comes is the one the futuribles say (`:comes`).

- **`cancrizans live`** (`@kairotic/theory` 0.5.0, Study 46 in the app): the crab played beat by beat. In the
  first half your note (or the nearest that can close the crab) and, at the same beat, the box's answer — the end
  of your own line, written ahead, the notes that leave more futures first; a cue two beats before the middle; at
  the middle the rest of your line goes out as the score to read (a pattern), and in the second half the box plays
  your first half backwards while you read it, a note not read as written said as a deviation. Its futuribles
  (outlet 2) say for each note what the box will answer at the end of your line (`:end`): at temperature 0 (the
  default) exactly that; with `temp` (or `[:temp 2]`) the box draws among its answers, and among your notes when it
  plays for you, with its own seed (`seed`, `[:seed 7]`; reset starts the same game again). A `loadbang` counts the futures before the first note (the help shows it). On a pulse (the new
  right inlet) the beat goes on and the box plays for you when you do not; without one, a note is a beat. Study 46
  plays on Study 43's kernels as they are now (a test keeps them so).

- **Study 46 in ClojureScript**, as the other studies: the game (`studies/46-crab-live/kairotic/live.cljs`, pure: a
  game is a map, each move returns the next) and the page (inline, as in Study 43) are ClojureScript; Study 43's
  kernel (`kernel.mjs`, `mirror.mjs`) and the sound stay JS, as in Studies 38–43. Tests: `tests/live.cljs` (18)
  and `tests/page.html`.

- **Study 46 · crab live**: a crab canon played live, on Study 43's kernel. In the first half you choose your note
  among the ones that can still close the crab, and the engine answers at the same beat with the end of your own line
  (written ahead on the score); at the middle the rest of your line comes out as a score to read, and in the second
  half the engine plays your first half backwards. In 2/2 or 3/2 (the crabs counted without blocking the page). By turns or on a pulse (the engine plays your note if you don't);
  crab or table canon; no score following yet. The game is pure (`studies/46-crab-live/kairotic/live.mjs`): 18 tests
  (also in Node) and 25 on the page.

- **`comes` inverted or augmented, and `cancrizans`** (`@kairotic/theory` 0.4.0, Study 43): `comes inversion` plays
  the comes upside down about an axis (`[:axis 62]`, the final by default) and `comes augmentation` twice as slow
  (a strict canon, six bars at most: its futures still counted); `[:transform …]` changes it on the way. The new
  box **`cancrizans`** writes a crab canon (with `table`, a table canon: a musical ambigram) by turns from both ends
  to the middle — the note at the start, then the one at the end —, its futuribles the ways to close the work, and
  sends both voices as patterns when it closes. `counterpoint.mjs` carries Study 43's kernel (the systems, the comes
  inverted or augmented); `mirror.mjs` is Study 43's mirror kernel. Study 43's kernel learns the comes's
  transformation (`spec.transform`), checked against the mirror kernel.
- **Study 45 · ring~**: Study 44's ring for sound. A circular buffer of audio in an AudioWorklet keeps the last
  seconds; the read head is d behind the write head, and the study compares how it moves when d changes: **tape**
  (glides at a rate: the pitch changes, and above 1 the head goes backwards), **seek** (jumps with a crossfade) and
  **both** (glides small changes, jumps large ones). Also **freeze** (a looper), feedback, mix, cubic or linear
  interpolation. Sources: a phrase that loops, the keys, the microphone. The DSP is a pure module
  (`studies/45-ring-audio/kairotic/ringcore.mjs`) with 21 sample-by-sample tests (`tests/core.html`, and in Node);
  `tests/page.html` runs the page with real sound.

- **`print` with a label, and `format`.** `print out0` writes `out0: 60` in the REPL (everything after `print` is
  its label; without one, `print: 60`), so two prints say which is which — the help patch of `dispatch` now says by
  which outlet each note went. The REPL writes a string as it is and anything else as EDN, the same with the engine
  running or not (it used to quote strings only while it ran). **`format`** joins the Clojure boxes, as
  `clojure.core/format` (Java's printf) for what a patch needs: `%s`, `%d`, `%.2f`/`%f`, `%e`, `%x`, `%%`, `%n`,
  widths (`%5.1f`, `%-8s`, `%03d`); `format "%.1f Hz"` takes the message, `apply format "%s Hz · %.1f dB"` a list,
  and `partial format "…"` travels as a function. Help patch of `print`, guide (EN/ES), tests.

- **Study 44 · ring**: a circular buffer of messages in time, for a delay that changes while it plays. It keeps the
  last seconds from its first message (or `:clear`) and forgets what is older. Three readings side by side, to choose
  the `ring` box's: **pipe** (each message d after it came in, with the d it had then), **tape** (a read head d behind
  sends what it crosses, either way; a jump of d is a seek) and **tap** (what was there d ago, held or interpolated).
  Model `studies/44-ring/kairotic/ring.cljs` (pure), page with keys, a gliding value, the ring drawn with its two heads,
  sound as a canon; tests `tests/model.html` and `tests/page.html`.

- **Study 43 · mirrors** (#172, #192): canons by transformation, the transformation as data — canon, inversion
  about an axis, augmentation, crab (retrograde) and table canon (retrograde inversion, a musical ambigram). A crab or
  a table canon is written from both ends to the middle, and its futuribles are the ways to close it there. A
  generic kernel (`mirror.mjs`) asks Study 42's rules at every time whose window of notes is known, in any order of
  writing, and counts exactly over the notes that still bear on a time not asked; forwards it counts what Study 42
  counts. The page writes a crab's step in two clicks (the note at the start, then the one at the end) and turns the
  page: mirrored for a crab, upside down for a table canon.

- **Study 42: the canon in the system.** A system says at which distances the comes may imitate and to which
  inversions the counterpoint may be asked to stand (`:canon {:at [-7 7 0 -4 4 -3 3] :invertible [8 10 12]}`); the
  page offers those. The septimal system imitates at the harmonic seventh too; the pentatonic inverts at the period
  and two steps more.
- **Orders written with their colon everywhere.** After `msg` began to be read as Clojure (#197), the help tables
  wrote the orders as keywords, but the descriptions of inlets, the `:doc` of boxes, the guide and the tutorials still
  wrote some bare (`0 or stop`, `reset: back to the minimum`, `rec starts, stop ends`, click `start`), which `msg stop`
  no longer does. Now `:stop`, `:start`, `:reset`, `:rec t`, `:ovr t`, `:clear`, `:learn :off`, `:depth n`,
  `:seek p`, `:open`/`:close`, `:bpm n`, `comes`' `:hold` `:end` `:engine` `:back`, and `draw`'s
  `:circle … :accent :hit …`. Text only; the packages whose help changed are bumped so the page shows it:
  `@kairotic/analysis` 0.7.4, `controls` 0.2.2, `data` 0.1.3, `io` 0.2.2, `net` 0.1.2, `theory` 0.3.1.
- **`dispatch`: a message to one of several outlets.** `dispatch n` has n outlets, numbered from 0 as every port is;
  the right inlet chooses the way: a number k (outlet k), `nil` or `false` (closed), `true` (outlet 0: `dispatch 1` is a
  gate), or a function that chooses for each message — a map (`{60 0 64 1}`), a keyword (`:to`, the way written in
  the event), a name or a form (`even?`, `(comp …)`) — where `nil` lets the message through nowhere; a set lets its
  members through outlet 0. It covers Max's gate, spigot and route in one box. The selector can be written after n
  (`dispatch 2 {60 0 64 1}`). Help patch, guide (EN/ES), tests in `tests/cljs/corefns.cljs`.

- **A `msg` is read as Clojure** (breaking). What a `msg` box sends is what is written in it, as EDN:
  - **keywords with their colon**: `msg :stop`, `msg :rec 4`, `msg :circle 40 40 10 :accent :hit :sun`;
  - **any other word is a name** (a symbol): `msg inc` is the function `inc` where a box takes one (into the inlet of
    `inc` in `map inc`, it changes the function); free text stays a name with its whole text — a note `e4`, a ratio
    `6/5`, `+7`, a URL, `github:…`, an OSC address — and the boxes that read such text (`sample`, `fetch`, `shift~`,
    `oscout`, `presets`, notes and intervals) take names too;
  - `true`, `false`, `nil`, text between quotes as a string, and **EDN forms** read whole: `msg [0 4 7]`,
    `msg {:freq 440} 3`, `msg #{60 64}`, `msg (comp inc (partial * 2))`.
  A word without its colon is no longer a keyword: `msg stop` does not stop a `metro`, `msg :stop` does. There is no
  conversion of older works: the help patches, tutorials, examples of the packages, the guide and the tests are
  written anew with keywords (`msg :stop`, `msg :start`, `msg :rec 4`, `msg :open`…), and the help tables of the boxes
  write the orders they understand as keywords (`:clear`, `:learn :off`, `:seek 8`, `comes`' `:engine` `:end`). Names travel through the db and
  the room tagged, as keywords do (`enc`/`dec*`). Packages: `@kairotic/analysis` 0.7.3, `controls` 0.2.1, `data`
  0.1.2, `io` 0.2.1, `net` 0.1.1, `patterns` 0.2.1, `spectral` 0.1.2. Tests: `tests/cljs/msg.cljs`, `tests/corefns.mjs`.

- **Study 42 · systems** (#172, #192): the system as data. Study 41's kernel takes `spec.system`: a tuning (degrees
  in cents up to the period, as Scala lists them, and the reference in Hz), the steps of a scale in it, the quality
  of each class of vertical (a list by real size in cents when that decides), the melodic moves, the leaps, the
  suspensions, the cadences, and the modes. The diatonic system of Studies 38–41 is one of them (`DIATONIC`) and counts
  the same canons; quarter-comma meantone, a septimal scale in 31-TET (the 7:4 a consonance) and the pentatonic are
  the others. The page edits the system in EDN under the canon; the sound takes fractional MIDI.


- **`comes` live, with ties** (`@kairotic/theory` 0.3.0, #172, #192): the box plays on Study 41's kernel — notes
  held over the beat, suspensions, fourth species (`fourth`: the dux a cantus firmus, the comes syncopated). Two ways
  to play it:
  - **by turns** (as before): one note is one beat; the same note again, or `hold`, is a tie;
  - **live** (`live`): a pulse on the new right inlet is a beat, and a note lasts until the next one is struck (a note
    struck just after a pulse counts for it). A note of three pulses in 2/2 turns the canon to 3/2; one longer than a
    bar ends the section, and the next note begins a new canon. Both kernels are counted beforehand.

  `[:k -4]`, `[:d 2]`, `[:imitation 0.5]`, `[:mode :hypodorian]`, `[:beats 3]`, `[:species 4]` change the canon on
  the way: by turns at once, live at the next section. The comes goes out only when it changes (a note held is not
  struck again). `end` ends the section from outside, and `nocues` turns the two cues off: `comes` only reacts, and
  what is more — the mode heard, modulations, the meter, phrases — is for boxes of analysis, which tell it with
  messages. The Study 41 kernel takes `maxHold` (the beats a note may be held; 2 by default, a bar in the box).

- **Study 41 · suspensions** (discussions #172 and #192): ties and fourth species, on Study 40. In a voice the same
  pitch on the next beat is the note held over the beat (two beats at most, drawn ‿ and heard held), and a dissonance
  may fall on a strong beat as a suspension: prepared by a consonance, held by one voice while the other moves,
  resolved a step down to a consonance (hard rules `:suspension`, `:suspension-kinds` — 7-6, 4-3, 9-8 above, 2-3
  below —; soft `:tie` and `:suspension-life`). The melodic rules and costs look at the notes struck. Species **4th:
  syncopation** (`:syncopation`) is Fux's fourth species: the dux is the cantus firmus, a note a bar (chosen on the
  strong beat, held for the bar), and the comes is syncopated, holding its notes over the strong beats; in a strict
  canon it is the cantus firmus half a bar later, breaking off into its cadence. Such canons are few (101 an octave
  below a beat later, 700 an octave above); 0.8 of imitation opens them to 3611.
  Tests: kernel 27 (also in Node), model 19, page 44.

- **`comes`, counterpoint live** (`@kairotic/theory` 0.2.0, discussion #172): Study 40 as a box. You play the dux,
  one note a beat (Hz from a `keyboard` or `midiin`, `[:midi 62]`, or with `midi` MIDI numbers), and the comes
  answers on the left, as a list of Hz for a `synth~` or a `midiout`. A note that breaks a rule of the style, or
  from which the canon could not be finished, is corrected to the nearest one that can be played (a black key
  too; one out of the range taken by octaves into it; between two as near, the more plausible by the soft rules),
  and the box says why. Outlets: the comes, the dux as played or corrected, the **futuribles** (the next notes, the
  most plausible first, with their futures counted exactly and the comes each would bring) and where the canon is
  (bar, beat, the correction and its reason, the divergence, the obligations). Arguments: `comes [mode] [k -7]
  [d 3] [beats 2] [imitation 1] [bars 8] [upbeat 0] [midi]`; `engine` (or bang) lets it choose the next pair, `back`
  takes one back, `reset` starts again, and after the last bar a new canon begins. The counterpoint is in
  `counterpoint.mjs` beside the component (Study 40's kernel as it is, its soft rules in JavaScript), loaded the
  first time and counted in a task. Tests: `tests/counterpoint.mjs` (20, in Node, in the tests workflow) and the
  box in `tests/theory.mjs`.

- **Studies 39 and 40: no final cadence from a 7th to a 5th** (hard rule `:cadence`, in both kernels and rule sets,
  with why? and "try without it" like any other). Study 39's default canon goes from 445443 canons to 442780; Study
  38's kernel (a copy of Study 39's) has it too, without effect in first species.
- **Studies 39 and 40: an upbeat.** The dux may begin after a rest (2/2 or 3/2) or two (3/2), on a weak beat:
  **Upbeat** in the canon's toolbar. The meter counts the rests (a beat is strong when `(t + phase) % b` is 0, in the
  kernels as `phase`), the score draws them before the first note, the sound waits for them, and the bars keep their
  number (8 bars of 2/2 after a rest: 14 notes).

- **Study 40 · imitation** (discussion #172): from a canon to free counterpoint. The comes is chosen note by note,
  and how much it imitates the dux is a degree: 1 a canon (hard); 0.9–0.5 near notes, within a 3rd of the dux's
  (hard) and each step away costing more the nearer to 1 (soft `:imitation`); 0.4–0.2 only the motion (going the
  other way costs); below 0.2 free. You choose the dux; the engine chooses the comes, the cheapest by its own line
  (its costs as `comes/…`), the verticals and the imitation, and you can change it (dashed squares beside the last
  comes, or the table under Here): a branch like any choice. A diamond marks where a canon would put the comes.
  Both voices end together. A new kernel (`studies/40-imitation/kairotic/kernel.mjs`) checks pairs and counts the
  futures exactly over pairs (at 1 the same as Study 39). Tests: kernel 17 (also in Node), model 19, page 39.

- **Studies 38 and 39: the modes, and contrary motion weighing more.** Eight modes on the white keys, authentic
  and plagal (hypodorian, hypoionian, hypomixolydian, hypoaeolian): each has its final, its **tenor** (the
  reciting tone: A in dorian, F in hypodorian, D in mixolydian, C in hypomixolydian…) and its **ambitus** — the
  authentic from the final to its octave, the plagal from the 4th below to the 5th above, with a step of licence
  beyond each end — which is now the dux's range. A plagal dux may also start on the 4th below the final. A soft
  rule, `:modal`, makes the final and the tenor cost less (one and a half times on a strong beat in Study 39).
  Contrary motion weighs more by default (`:motion` 2.5, was 1). The kernel takes the start notes from the model
  (`starts`).
  When more than one inversion is asked for, a selector beside **▶ Inverted** chooses which one is played.

- **Studies 38 and 39: counting without blocking, and a sound to hear the counterpoint.** Study 38 now uses
  Study 39's kernel in plain JavaScript for its hard rules and its count (every beat strong), so changes no longer
  block the page. In both, the futures are counted a few milliseconds at a time (`countAsync` in the kernel): the
  page dims the score and says how far it is ("counting the futures… 37% · 12400 points") and draws when done;
  **why?** counts each rule the same way. The sound is sustained and legato, an **organ** (a principal for the dux,
  a flute for the comes) or two **voices** (a sawtooth through the formants of a vowel, with a slow vibrato), in a
  small room, at a **tempo** set in the toolbar; a repeated note is struck again. Tests: the kernel's (29, also in
  Node) include the count without blocking (the same number, progress growing, cancellable); the page tests wait
  for the count.

- **Study 39 · meter** (discussion #172): dissonance and meter in Study 38's canon. First species is a note per bar;
  second species two (2/2) or three (3/2), a note per beat. Strong beats are consonant; on a weak beat a dissonance
  passes if both voices come to it and leave it by step (passing or neighbour, P / N on the score), never two in a
  row; no 5ths or octaves on consecutive strong beats. The comes's delay is in beats, so an odd delay puts it on the
  other beats. A passing dissonance costs less. The hard rules and the exact count are a small kernel in plain
  JavaScript (`studies/39-meter/kairotic/kernel.mjs`), the rest ClojureScript as in Study 38: 496320 canons of 8
  bars of 2/2 counted in about 0.15 s. Found: in a canon both voices move on every beat, so dissonance is rare (4
  of 30 canons by the engine) — a voice that holds while the other moves (fourth species) is the next step. Tests:
  `tests/kernel.html` (22 checks, also in Node; its counts checked against a Python port), `tests/model.html` (20),
  `tests/page.html` (30).

- **Study 38 · futuribles: why?** A note can be closed in two ways: a hard rule forbids it, or it is allowed but no
  canon finishes after it. **why?** (beside a note not allowed, a note with no future, or a point with none) counts
  the futures again with each hard rule turned off, one at a time and one per tick so the page stays alive, and
  shows what each would open — "→ 15 canons" — the one that opens the most, or that no rule alone does (several
  close it together). **try without it** turns that rule off. `fu/why` and `fu/why-rule` in the model. Tests: 8 more
  checks in `tests/model.html`, 6 more in `tests/page.html` (a mixolydian canon at the octave below, invertible at
  the 10th and strict about direct octaves, where starting on the final has no future until `:direct-octaves` is off).
- **Study 38: an octave or a unison by direct motion is allowed when the upper voice moves by step** (as in Bach;
  `:strict-direct`, off by default, forbids it as Fux does), and **the voices may be further apart**: up to a 12th by
  default, set in the canon's toolbar (a 10th, a 12th, two octaves; `:spacing` in the canon's data).

- **Probes on wires** (discussion #183, first idea). To see what travels along a wire without wiring a `print` in:
  ⌥/Alt+click a wire, or `(probe :b1 0 :b2 0)`. The wire is drawn dashed and a label at its middle shows the last
  value that went along it (shortened), flashing when one passes, with the rate when they come often (`440 · 12/s`).
  Again takes it away; `(unprobe-all!)` takes them all.
  - Probes are this tab's, like the selection: no event of the history, nothing in the code of the work, and two
    people in a room each watch their own. A wire that is deleted (or undone) loses its probe.
  - The engine watches the outlet a wire leaves from (`kairotic.engine/probes`, `probe-seen`): `deliver!`, `emit!`
    and `emit-to!` note what leaves a watched outlet, and do nothing more when there are no probes.
  - Not yet: wires out of a sub-patch box (their messages leave from a box inside it) and signal wires.
  - Tests: `tests/probes.mjs`.
- **Help patches without boxes over one another** (issue #166, 2). A box's real size is only known once it is drawn
  (a `faust~` with the sliders its code compiles to, a score with its notation), so boxes placed by hand in help
  patches ended up under others.
  - A new test block opens every help patch, step by step, waits until its code boxes are compiled and its scores
    drawn, and fails when boxes cover one another (`tests/helplayout.mjs`, in an app of its own, beside the others).
    It found seven: `draw`, `form~`, `freqt` (step 4), `gendy~` (steps 2–4), `mt` (steps 1 and 3), `player` (steps 2
    and 3) and `realize~`, whose boxes are moved now.
  - `(overlaps)` lists the boxes on screen that cover each other, at the size they are drawn, and `(tidy)` moves
    boxes down until none does, in their own columns and order, as one event; `(layout-settled?)` says whether
    every box has its size yet.
  - A test block's suite can have a time limit of its own (`tests/browser.mjs`).
- **Study 38 · futuribles: a contour after Bach** (discussion #172). The engine repeated notes and chained the same
  figures. Leaps are no longer penalised for being leaps (a 3rd costs 0.2, an octave 0.8): they are compensated by
  contrary motion — a hard rule now asks only that a 4th or a 5th turn back (a 6th or an octave by step), and soft
  rules make going on the same way after a leap, or turning back by leap rather than by step, cost. What costs is a
  line that stays still (a repeated note: 6), hovers over the same notes, goes straight back, runs one way, stays
  inside a 5th, or repeats its last two or three moves mechanically; a two-move figure used earlier costs less (the
  memory of the work), and the same vertical every other note (3 6 3 6) costs too. The engine now looks ahead: each
  note is weighed with the cheapest way the line can go on for the next notes (0 to 3, 2 by default), so a cheap note
  leading into a corridor of forced repetitions is avoided. Over 24 seeds of the default canon: 1% repeated notes
  (4.4% before), 38% leaps, 22 different canons, about 30 ms each in Scittle. Tests: 61 checks in `tests/model.html`.
  The unison is treated as the octave: neither is reached by direct motion (a hard rule, also under inversion; a 5th
  reached so still only costs), and the comes does not enter on the unison.
- **Functions as values through the wires** (issue #177). A function travels as its form, EDN data:
  - `comp`, `partial`, `juxt`, `complement`, `fnil`, `constantly`, `every-pred` and `some-fn` are boxes that send one
    on a bang (`comp inc (partial * 2)` sends `(comp inc (partial * 2))`); their inlets replace the arguments, `^:hot`
    sends at once, and with `%` they take the function that arrives (`comp % inc`).
  - Wherever a function box takes an argument, a name or such a form is that function: sent into the inlet of `inc` in
    `map inc` (or of `odd?` in `xf/filter odd?`, `:freq` in `sort-by :freq`) it changes the function live. Forms can be
    written in a box and nest: `map (partial * 2)`, `map (juxt inc dec)`.
  - Safe in a shared room: only the pure function boxes and `+ - * /` are ever made from a form, rebuilt in each
    browser; a name it does not know, or a call in place of a function (`(inc 1)`), is not sent and is said in the REPL.
    Keywords stay keywords (`:inc` is a key); a name is a function (`msg inc`, above).
  - The arguments of these boxes are now kept as written and become functions when the box calls them
    (`kairotic.corefns/as-fn`); boxes written before work as they did.
  Docs: `docs/guide.md`, `docs/guide.es.md`. Tests: `tests/cljs/corefns.cljs` (20 more checks).

- **The Code tab and the patch, seen together** (issue #165).
  - **Long lines folded**: a line over 160 characters (the source of a code box, a package copied into a work, a
    buffer kept as data) is folded after its first 48 characters with `⋯ 26 000 characters`. A click, or the fold
    gutter, shows it, and a line unfolded stays so while the tab is open, also when the code is written again.
  - **The selected boxes marked**: selecting boxes in the patch marks their lines in the Code tab (their `box`, their
    lines, their data…) and scrolls to them.
  - **The cursor selects a box**: the cursor on a line of a box (a click, the arrows) selects it in the patch, and
    the two boxes of a `connect`.
  - The editor bundle (`core/vendor/codemirror/entry.mjs`) gains `foldLong`, `highlight`, `showLine` and the
    `onLine` / `onUnfold` callbacks. Tests: `tests/codetab.mjs` (13 checks).
- **Copy, cut, paste and duplicate boxes** (issue #164). ⌘/Ctrl+C copies the selected boxes, ⌘/Ctrl+X cuts them,
  ⌘/Ctrl+V pastes them where the pointer is (keeping their layout), ⌘/Ctrl+D duplicates them a little below and to
  the right; `(duplicate :b3 :b4)` from code.
  - The clipboard holds their code, as the Code tab writes it (so it can go in a message, an issue or a document),
    and on its last line the same boxes as data (`;; kairotic-paste {…}`). Pasting reads that line as EDN, which
    runs nothing, and passes it through the same checks as what comes from a room; text without it is not pasted.
  - Pasted boxes get the next free ids (`:bN` stay as they are: no long unique ids), with their data, views and
    sizes; their lines among themselves follow the new ids, and a line to a box that was not copied is kept when
    that box is in the patch. A paste, a cut or a duplicate is one event of the history.
  - While something is being written or selected (a field, an editor, text on the page, a field of an `html` box),
    the keys do what they always did.
  - Tests: `tests/clipboard.mjs` (23 checks).
- **Clojure boxes: `%` is the left inlet, data as functions, `^:hot` and `xf/` transducers.** The text of a box of
  `clojure.core` reads as Clojure, its inlets as Max:
  - **`%` is always the left inlet**, the only hot one, wherever it is written; it no longer has an inlet of its own,
    so the inlets on the right are the other arguments in the order they are written (`vector % 0 0` is a pack,
    `hash-map :freq % :amp 0.5` makes an event, and its keys can be changed too). Boxes without `%` are unchanged.
  - **Keywords, sets and maps written first are functions**, the message first, as in Clojure: `:freq` (a field of
    an event, `:freq 220` with a default), `#{60 64 67}` (a filter), `{60 :c 64 :e}` (a table). `nil` sends nothing.
  - **`^:hot`** before the class makes every inlet hot (`pak`): a new argument sends at once with the last message.
  - **`xf/`** before a function makes its transducer a box with memory over the stream of messages:
    `xf/partition-all 4` collects, `xf/partition 4 1` is a sliding window, `xf/dedupe` (change), `xf/take 1`
    (onebang), `xf/filter`, `xf/map`, `xf/mapcat`…; `flush` completes it, `clear` starts again.
  - **The help links to Clojure's documentation**: each of these boxes carries `:ref` links (clojuredocs.org, and
    clojure.org for transducers, data structures and metadata), shown in the Help tab and the class reference; a
    component can carry its own in `:help`.
  - The class of a box may now start with `^:flags` and be a whole map or set (`kairotic.components/klass`).
  Docs: `docs/guide.md` and `docs/guide.es.md`. Tests: `tests/cljs/corefns.cljs` (42 more checks).

- **The patch and the panel on the right have heights of their own** (issue #166, 1). They were two columns of
  one grid row, so a long step of a lesson made the row taller and stretched the panel on the right with it, pushing
  its lower controls (Run, the Room's microphone…) below the window until the page was scrolled. Now both take a
  height from the window (`--work-h`: between 460 and 660 px, the window less 120); the lesson strip takes at most
  45 % of the patch pane and its explanation scrolls inside it, the patch keeps the rest, and a long tab on the right
  scrolls inside the panel. Embeds are unchanged. Tests: 5 more checks in `tests/layout.mjs`.

- **Study 38 · futuribles** (discussion #172): the possible futures of a work beside its history. The history keeps
  only choices; the futuribles are never stored, a pure function of a point of it and a rule set as data, and a
  choice is the only bridge between them. First domain: a canon at a diatonic interval and a delay, first species
  (hard rules with their reasons, soft costs with the memory of the work and novelty), invertible counterpoint at
  the octave, 10th or 12th as a transform checked by the same rules, obligations (leap recovery, the final). The
  ways to finish from any point are counted exactly, memoized on the window the hard rules look at; their log₂ is
  the divergence, drawn under the score beside the fan of futuribles. The engine chooses only among notes with a
  future, seeded, with a temperature that can follow the divergence (after Copycat). Tests: `tests/model.html`
  (49 checks) and `tests/page.html` (25 checks, the page driven as a person would).

- **The line of the REPL on the patch is a code editor** (issue #163). The line opened with `(` on the patch (or the
  field of a new box once what is written starts with `(`) becomes, as soon as the code editor is loaded, the same
  editor as the REPL at the bottom: completion of Kairotic's commands and of `clojure.core`, brackets closed and
  matched (a new line starts as `()` with the cursor inside), Enter runs it once its brackets are balanced
  (Shift+Enter: a new line), ↑ ↓ the REPL's history, Esc closes it; what it gave shows below it. Until the editor is
  loaded, or without it, the plain field is the line, as before. A box's id written by clicking it is now inserted
  as typed, so the Clojure editors keep the space after it (before a closing bracket too). `box`, `connect`,
  `disconnect`, `move` and `text!` now have a doc string, so the REPL, the Code tab and this line complete them
  (only commands with one are offered). Tests: `tests/ids.mjs` (30 checks).

- **Box ids, seen and written by clicking** (issue #163).
  - Every box shows its id (`b7`) over its top right corner when it is hovered or selected; **I** shows them all
    (`(show-ids! true)`, remembered in the tab).
  - **`(`** on the patch opens a line of the REPL there, in the field of a new box, which also becomes one when
    what is written in it starts with `(`. Enter runs it and shows what it gave under the field (the REPL prints
    it as usual), and the line stays open for the next one; ↑ ↓ go through the REPL's history; Esc closes it.
  - **A click on a box writes its id** where a line of code waits for one — the REPL, the Code tab, that line, the
    Room tab's message (`@b7`) — as a click on a cell does in a spreadsheet formula. It waits for one after a space,
    `(` `[` `{`, or the `:` / `@` already typed; the patch then shows a copy pointer and marks the box under it, the
    line keeps the focus, and the box is not selected nor moved. Otherwise a click on a box does what it always did.
  - Tests: `tests/ids.mjs` (26 checks).

- **Which box is on top** (issue #166, 3). Boxes were drawn in the order of their ids as text, so `:b10`–`:b19`
  went under `:b2`; now they are stacked by the number of their id (the newest on top), and **a box dragged comes to
  the front**, so that what is moved is never hidden. That order belongs to the tab, as the selection does: it is not
  part of the work, its history or its code. `move-by` (and dragging several boxes) is now one event of the history.
  - What a box draws over itself while it plays — a number's value, a flash, a control's own view, a `faust~`'s
    sliders, a panel — is now drawn inside the box (`g.live`), so a box on top covers it too; reading cursors are
    still drawn over everything.
  - Tests: `tests/zorder.mjs` (14 checks).

- **Analysis boxes after ■ ▶** (`@kairotic/analysis` 0.7.2): `features~`, `chroma~`, `onset~` and `spectrum~`
  did not check that their box was still there, and their taps were never disconnected, so after ■ ▶ (or when
  their node was rebuilt) the old tap went on handing the box silence, alternating with the new one. With
  `realize~` this read as a silence half the time: its `gain` sat at −80 until `learn` happened to start it
  afresh. They now check, and `api/untap` stops a tap and disconnects it (`pitch~`, `snapshot~`, `scope~` too).
- **`realize~` listening, steadier**: a correction it cannot play (darker than the `faust~`'s darkest setting, a
  gain beyond its slider) no longer grows; what it corrected fades unless it is still needed; and the attack of a
  sound (its first quarter second) is not corrected.
- **`realize~` keeps up with a live sound** (`@kairotic/analysis` 0.7.1, `@kairotic/faust-units` 0.1.5): the
  search for the nearest settings ran in the box's interpreted logic, about 300 settings for every frame, and with
  a microphone (some 150 values a second) it could not keep up — the faust~ stayed where it was. It is now the
  bank's own query (`index` in `notation.mjs`, plain loops over typed arrays, a few microseconds). Learning is
  about three times quicker (only the descriptors it needs, YIN on four windows), and it gives the page a moment with a message to itself, not a timer, so it does not crawl in a tab that is not in front (the recipe of a `faust~` too). The pitch is sent even when the
  level is low, and below −60 dB (not −50) counts as silence.
- **`realize~` listens to what it plays** (discussion #114; `@kairotic/analysis` 0.7.0): three more inlets take
  `features~` of the `faust~`'s sound (rms, centroid, flatness), and a correction grows where what is heard
  falls short of what is written — the passes of Study 37, while it sounds. Tests: 2 more checks in
  `tests/realize.mjs`.
- **`realize~`: descriptors as a score, in the app** (discussion #114, Study 37; `@kairotic/analysis` 0.6.0,
  `@kairotic/faust-units` 0.1.4). A box before a `faust~` that plays it from loudness, brightness, noisiness and
  pitch — `features~` and `pitch~` of another sound, or curves drawn — setting its `pitch`/`freq` and `gain`
  sliders directly and its other sliders to the settings of that `faust~` that sound nearest. It learns the
  `faust~` its outlet reaches (a few hundred steady settings played offline and heard, in the page a moment at a
  time) on the first values or `learn`; its right outlet says how far the `faust~` is from what is written. The
  task a box asks for now knows what its outlets reach (`:wired`). Tests: `tests/realize.mjs` (15 checks).
- **A number keeps its value in its text, like a knob** (issue #146). Let go after a drag, or typed (double-click), a
  `number` box rewrites its text with its new value (`number 523.25`), one event of the history, as a knob does on
  release: the value travels with the work and going back in the history brings back the number it had (and sends
  it). A click without dragging still sends it again. It declares `:args [[:initial 0]]` and `:persist`, so presets
  see it as a control too: a preset recalls its number and a morph moves it. Tests: `tests/cljs/number.cljs` (8
  checks), 4 more in `tests/numinput.mjs`.
- **Study 37 · notation** (discussion #114): descriptors as a score — pitch, loudness, brightness and noisiness
  drawn as four lanes over time (or read from a sound file as `features~` and `pitch~` hear it) and realised by a
  `faust~`: `pitch` and `gain` follow their lanes, the other sliders are chosen frame by frame from a bank of the
  voice's own steady settings, and it listens to what it played and corrects itself (three passes). Off by 0.3 dB,
  2.2 semitones of brightness and 0.014 of noisiness on average, against 5.0 dB, 7.3 semitones and 0.022 held
  still; the frames that ask for what the voice cannot do are shaded. Tests: `tests/notation.html` (CI, real
  faustwasm) and `tests/realize.mjs` (Node).
- **A work as a file: `.kairotic`** (discussion #149). The first thing in Share/Export, and *Download this work* in
  the session manager: the whole work — every line, its whole history, the sounds recorded — or a release of it
  (one line, one point per keyframe), optionally **anonymous** (authors and sessions as p1, s1…, no names, no
  origin). **Open a file…** in the session manager makes a new work of one: solo, or local without a database;
  segments made in a local work get ids of their own, so they are saved from then on. `(export-work)`,
  `(export-work {:release true :anonymous true})`, `(open-work-file!)`.
  - The file is a zip of EDN — `manifest.edn` (`:format 1`), `work.edn`, `lines.edn`, `history.edn`, `people.edn` —
    and `sounds/<hash>.wav`, 32-bit float, so the samples come back exactly (their hash is their key). Samples
    loaded from a URL stay references. A file of a newer format says so instead of opening half.
  - `kairotic/kfile.mjs`: the zip (stored and deflated entries with the browser's `CompressionStream`, CRC
    checked) and the WAV, plain JavaScript, no dependency.
  - Tests: `tests/workfile.mjs` (22 checks).
- **An html box: small interfaces written as hiccup** (issue #146). `html` draws a little HTML document in the
  patch — sliders, number and text fields, menus, checkboxes, buttons, text and tables, laid out with flex or grid —
  written as hiccup in EDN (`[:div.row [:input {:type "range" :name :freq :out 0}] [:output :$freq]]`). An element
  with `:out o` sends what it gives out of outlet o (the box has as many outlets as its view asks for); one with
  `:name n` keeps it as a value, shown wherever the hole `:$n` is. A map `{:freq 220}` on its inlet sets values as a
  number sets a knob: the elements named so show it (a slider within its range) and those with `:out` send it on; a
  bang sends again what they hold.
  - **Safe in a shared room**, like a tree box: the view is data, kept and drawn only after an allowlist of tags,
    attributes and style properties (no scripts, links, images, positions or `on*` attributes; palette colours
    `:ink :accent …` follow the theme), and built with the DOM in a shadow root, never with `innerHTML`.
  - HTML can be pasted as its view (`{ }` in its header, or `(code :bN "<div>…</div>")`): read by the browser,
    `data-out` / `data-send` become `:out` / `:send`, `$freq` in a text becomes a hole, and only the hiccup is kept.
  - **Like a knob**: a slider sends while it moves (to a jam too); let go — or a menu chosen, a text entered — the
    value of a named element is kept in the box's data, `(values! :bN {:freq 440})`, one event of the history, so it
    travels with the work and going back in the history brings back the value it had. A button (no name) only
    sends, `(send! :bN [:ui outlet value name])` in the REPL. Its element is kept between redraws, so what is typed
    keeps its focus; keys typed in it are its own (a space is not ▶). `(resize :bN w h)` gives it a size.
  - In the core (`core/kairotic/hiccup.cljs`, page `app/page/19-html.cljs`). Tests: `tests/cljs/hiccup.cljs` (62
    checks) and `tests/html.mjs` (41).

- **Lines, what was left** (discussion #117):
  - **One line when the work leaves** (decision 8): a link (Share/Export, Release/Perform) and a release carry one
    line. Every `patch @name` becomes an embedded patch holding its line as it plays there, quiet as it played
    (without its `adc~`/`dac~`), and so on inside it. At each keyframe of a release, the lines are as that snapshot
    kept them, and its marks lose their `:fronts`.
  - **From a box to a line and back** (decision 2): `(extract-line :b3 "name")` makes a new line of an embedded patch,
    with the history it had inside the box, and the box uses it. `(inline-ref :b3)` copies the line a
    `patch @name` uses into the box, detached from it. The inspector of a patch box has buttons for these, and for
    pin / follow / open.
  - **A line's tab while the line that plays uses it**: the tab shows it where it plays (its first instance), and
    what you play there goes to every instance that follows it; the transport says ×N.
  - Tests: 13 more checks in `tests/lines.mjs` (78).
- **A recipe from a sound, in the app** (discussion #114, Study 35): **Recipe** in the bar of a `faust~`'s
  window finds the values of its sliders that sound closest to the sound of a sample box of the patch, or of a
  sound file, and writes them in the code — edited, not applied, so Ctrl/⌘+Enter applies them as one event and
  the box shows them among its parameters. It runs in the page a moment at a time (the patch keeps playing),
  *quick* or *careful*, and **Stop** stops it; **▶ sound** and **▶ found** play the two. The search moves into
  `@kairotic/faust-units` 0.1.3 (`recipe.mjs`, with `render.mjs`, `listen.mjs` and `cmaes.mjs`): a recording at
  any sample rate, level and number of channels, with silence before it, is brought to what the search hears.
  Tests: `tests/faustrecipe.mjs` (13 checks).
- **A line inside another: `patch @name`** (discussion #117, phase 2). A `patch` box whose word is `@name` uses the
  line called *name* as a sub-patch (spaces written `-`), its `inlet` / `outlet` boxes as ports; a plain word stays
  the label of an embedded patch, so no existing work changes meaning. Double-click (or `(open-ref :b3)`) opens the
  line in its tab.
  - It **follows** the line (↻, its newest point) or is **pinned** (`(pin-ref :b3)`, ⌖ and the moment; the pin is in
    the patch's code; `(follow-ref :b3)` follows again). A line cannot contain itself nor a line that uses it.
  - Decision 4: Perform keeps the lines followed where they were when it started. Decision 5: a snapshot keeps where
    the lines followed are (`:fronts` in its mark), and a point after it, away from the newest one, plays them so.
  - Decision 7: inside a line used so, `adc~` and `dac~` are left out (they play when the line plays alone); the box
    warns (⚠) when its line has `dac~` without `outlet~`, or `adc~` without `inlet~`.
  - Renaming a line rewrites the boxes on screen that use it, and keeps the old name as an alias for the others.
  - The engine reads the lines through a hook (`eng/line-resolver`), and makes its flat patch again whenever a
    line changes. `engine-patch` is the same object while nothing changes (the engine flattened it every tick while
    another line played).
  - Tests: 23 more checks in `tests/lines.mjs` (65).
- **The engine plays the line where ▶ was pressed** (discussion #117, decision 6): changing tabs no longer stops
  it. Its tab shows ▶ and the transport says *playing* plus the line's name when another tab is on screen. The
  line on screen still runs its messages, beside the one that plays, its boxes known to the engine under the prefix
  of their line (`:@<line>.b1`), so the ids of two lines never meet, and without its audio boxes: only the line that
  plays sounds. ▶ on that tab makes it the one that plays; ■ stops. With the engine stopped, changing lines is as
  before. Tests: 11 more checks in `tests/lines.mjs`.
- **Lines** (discussion #117, phase 1): a work can have several independent histories, each a tab above the
  patch — the main line (★) is the work as it always was, the others studies, sketches, parts, each with its own
  patch, branches, merges and snapshots. **+** or `(new-line "sketch")` makes one; a click on a tab or
  `(go-line "sketch")` puts it on screen, back at the point where it was left; double-click renames it
  (`(rename-line …)`), **×** archives it (`(restore-line …)` brings it back); `(work-lines)` lists them.
  - Kept with the work: each segment of the history carries its line (none for the main line, so works
    without lines are as they were), and the names live in `<work>/lines`. Copying a work to a room or to solo
    takes its lines; deleting it deletes them.
  - The line on screen is what everything works on: the patch, the engine (it stopped when the line changed,
    until the entry above), Perform and its jams (a jam is offered only to whoever is on its line),
    Share/Export, Release, Claude. Lines do not change in Perform, a lesson or the scratch patch.
  - In a room, presence says which line each person is on: the others' positions are drawn on their line,
    the people list says where the others are, and following someone onto another line opens its tab.
  - An official package asked for by one line while another is on screen goes into its own line when that one
    is back, not into the one on screen.
  - The status bar counts the patch's connections as *wires* (a *line* is now a history).
  - Tests: `tests/lines.mjs` (31 checks: names, switching, tabs, Perform, arriving segments, a solo work
    opened again, a copy to a room).
- **Study 33 · lines** (discussion #117): a work as a project of several independent history lines, each a tab
  above the patcher, each usable from any other line as `patch @name` — following the line (its newest point) or
  pinned to a point of its history. Nesting, cycles refused, extract an embedded `patch` to a line with its
  history, inline a reference back, rename (users rewritten, the old name kept as an alias), release (every line
  reached, each at the point it uses, all pinned), export and import a line. A pure model
  (`studies/33-lines/kairotic/lines.cljs`) with its tests (`tests/model.html`); not in the app yet.
- **Onsets and the cante** (issue #106): `fetch-cante2midi.mjs` also reads cante2midi's Bark band energies, and
  `bench.mjs --cante --onsets` runs `onset~`'s logic on them into `transcribe`. On these recordings onsets do not
  help the contour (`onset~` fires on consonants and the guitar: 18 % precision); for voice, the contour alone is
  best. `transcribe` no longer cuts at an onset while the contour is moving between two notes.
- **The quantizer weighs the error of played notes in seconds** (`:ref-bpm`, 100 by default; issue #106). With
  played time (`:time :track` or a time map), the error of a note was measured in beats, so at fast tempos what a
  player is off by in milliseconds counted double and became finer divisions. Now, faster than ref-bpm, it weighs
  less in proportion (down to a third). On 40 solos of the Weimar Jazz Database, through their annotated beats:
  notes in their written place 58.2 → 66.6 % (another sample of 60: 59.3 → 66.0 %). Nothing changes without played
  time. `:ref-bpm nil` measures in beats as before.
- **Patching, the same in every patcher**: wires are curves (in the patch and in the patch of a `faust~`); an outlet
  within reach of the pointer lights up and the pointer becomes a cross, and pressing there starts a wire; the inlet a
  wire would land on lights up, and a wire dropped just above an inlet lands on it. The patch of a `faust~` takes the
  patch's measures and look (boxes, ports, wires). `@kairotic/faust-units` 0.1.1.
- **`transcribe` segments the contour** (issue #106, measured on cante2midi). In notes mode it no longer starts a
  note each time the pitch moves 0.6 of a semitone: each voiced stretch is read as a contour (every 10 ms, a median
  of 100 ms), and a new note begins only where the contour, a semitone away from the note, has held still for 70 ms;
  each note is written at its median pitch, when the voice stops. Slides, vibrato and ornaments that pass no longer
  start notes; an onset on the right still does. The shortest note is now 80 ms. On the 20 cantes of cante2midi,
  from the same f0: onsets 35.5 → 55.9 %, with pitch 23.0 → 36.6 %, with offsets 12.8 → 26.8 % (the authors'
  automatic transcription: 59.7, 40.6, 26.3 %).
- **The Weimar Jazz Database in the benchmark** (`bench.mjs --weimar`): the beats found in 40 jazz solos, and the
  quantizer alone through their annotated beats against the written place of each note.
- **A `faust~` as a patch** (discussion #115, Study 31): its code opens beside its box with a patch of Faust's own
  elements on the left, kept in sync with the code both ways; applying is still one event, and the parameters stay
  in the box in the patch, in sight (the window opens beside the box). The boxes and the reading of code are a new
  package, `@kairotic/faust-units` 0.1.0, which carries modules for the page (`assets/`) and no box classes:
  `library/module-packages` pins it, and `packages/build.mjs` builds a package without `src/`.
- **The form of what is heard or played** (issue #120). A new core module, `kairotic.structure`: the
  self-similarity matrix of frames (Foote 1999), the novelty of each frame by a checkerboard kernel (Foote 2000),
  the beat spectrum and its periods (Foote & Uchihashi 2001), segment boundaries, and notes as frames (pitch
  classes, onset strength) for a take or a tree. In the API for any component (`api/ssm`, `api/novelty`,
  `api/novelty-at`, `api/beat-spectrum`, `api/periods`, `api/boundaries`, `api/note-frames`).
  `@kairotic/analysis` 0.5.0:
  - **`form~ [seconds] [step] [kernel]`**: a self-similarity matrix over the last seconds of what arrives (a
    chroma, an mfcc, onset~'s envelope), drawn; the novelty of each frame, a bang and a `[:segment …]` where a
    segment begins, and the period that repeats.
  - `onset~` is adaptive: `[:threshold x]` and `[:ms y]` change it while it listens, and a `[:segment …]` makes it
    forget the usual change of the section before.
  - Measured on the quantization benchmark (40 ASAP performances), the SSM gave the beat tracker nothing: as a
    term of the analysis by synthesis (bar and phase) the scores stayed within noise or fell, and tracking each
    segment apart fell (any-level F 0.684 against 0.714). The tracker is unchanged; the component is there for
    its own uses.
- **The logo** (`brand/`): the icon (k) — parentheses around a K whose stem is a timeline branching at the
  kairos point — and the logotype `(kairotic` + a branch + `)` in IBM Plex Mono, its first k drawn as that K.
  Outlined SVGs (logotype for light and dark, closed, wordmark, icon, small icon, app icon) and a guide
  ([brand/README.md](brand/README.md)). The app shows the logotype in its header, in the theme's colours, and
  the small icon as its favicon; the READMEs open with it.
- **The strength of each attack, from `onset~` to the quantizer** (issue #106, after the analysis of `onset~` in it).
  `@kairotic/analysis` 0.4.0:
  - `onset~` has a third outlet, the growth of the spectrum of every frame (the onset strength envelope).
  - `onset~` no longer takes a sound cut at once for an onset: the energy must not fall.
  - `transcribe` takes `onset~`'s strength on its right inlet, and writes each note with the weight of its attack:
    the stroke's `:look {:w}`, as an event's `:amp` is.
  - The quantizer reads that weight as the note's `:vel`, and `kairotic.tempo` weighs onsets by it (`:accent`, on by
    default; `:bass` weighs low notes, off). Options of the tracker go in `:track`.
  - The delay of `onset~` was measured: 6 ms median, one hop at most.
- **Real performances in the benchmark**: `tests/quantize-corpus/fetch-asap.mjs` samples 40 piano performances of
  ASAP (with annotated beats and downbeats) into the cache. `bench.mjs --asap` measures the beats found (F-measure
  at 70 ms, also at any metric level), the downbeats and the tempo. With velocities: beats 57.5 % (71.8 % at any
  level), downbeats 41 % (36 % without them).
- **Played time** (issue #106). `kairotic.tempo` finds the beats of notes played freely (in seconds, or at a
  tempo nobody chose: `transcribe` writes at 60 bpm): the tempo from the intervals between onsets, the beats by a
  dynamic programme that follows rubato (after Ellis 2007), and, by analysis by synthesis, what each beat is
  worth and where the bar starts (each candidate quantized, the cheapest kept). The quantizer takes it as an
  option: `:time :track` (found each time) or a time map `[[time beat] …]` (kept), and writes the tempo found into
  the tree; `:downbeat t` fixes the bar by hand. REPL: `(track! :bN)` finds the map of a freqt or a free tree box
  and keeps it in its `:quant` (`(track! :bN nil)` forgets it). The benchmark gains `--timed` (pieces played in
  seconds, at 60–150 bpm, steady, with rubato or free) and two columns, tempo found and tempo at another level.
- **Meters that change, given** (issue #107): `{:meters ["3/4" "3/4" "5/8[2+3]"]}` gives each bar its meter, the
  last going on (`qz/bars`); the score says each meter where it changes, and alt-click works in any bar.
- **Grace notes as they are played**: a very short note just before a longer one (`:grace-dur`, 0.1 beat) is
  written as its grace note instead of asking for a fine division of the beat. On the benchmark, SymbTr played
  exactly goes from 82 % to 97 % perfect, and its çarpmas are found 94 % of the time.
- **Coherence across beats in the quantizer** (issue #108). Each span keeps its few cheapest divisions and the
  plan of a bar chooses among them with its neighbours in view: changing kind of division (binary, triplet,
  quintuplet…, by the points the notes use) between neighbouring regions costs `:coh` (0.5 by default; `0`
  decides each beat on its own), and a bar starts from the kind the one before ended with. Notes played a little
  early or late no longer become tuplets as often: on the benchmark (#105), invented tuplets fall by 80 % in
  Essen played loosely, 75 % in SymbTr played exactly, with onsets and durations up at every level.
  `qz/family`; tests in `tests/cljs/quantize.cljs`.
- **A tree's roll follows its meter changes.** The roll of a tree whose measures change meter drew every bar in
  the meter of the first one, so its barlines drifted away from the score. Its grid now lists the bars one by one
  (`:bars [{:s :L :groups}]` in the canvas grid, drawn by `cv/bar-lines`, going on in the last meter past the
  end), each with its groups; its step is the smallest unit of them. A tree with a `:grid` of its own keeps it.
- **A benchmark for the quantizer** (issue #105). `kairotic.qbench` (`tests/cljs/qbench.cljs`) performs
  measured trees (onsets moved, notes shortened, a drifting beat, seeded, at four levels: exact, tight, loose,
  rough), quantizes them back and compares them with what was written: onsets, precision, durations, spelling,
  tuplets added or lost, grace notes. Kairotic's own corpus (twenty small cases) runs with the unit tests, with
  thresholds. `tests/quantize-corpus/fetch.mjs` samples 200 pieces from the Essen Folksong Collection and SymbTr
  (Turkish makam, microtones and aksak meters) into a git-ignored cache (their licenses do not allow
  redistribution), and `tests/quantize-corpus/bench.mjs` prints the table. First results and what they say in
  `tests/quantize-corpus/README.md`.
- **A tree box has two views, score and roll**: a new tree box is a score; ⇄ shows its **roll** (the piano
  roll of frequency over time that was its canvas view; `(view :bN :roll)`). Its text is no longer a view:
  **{ }** in its header (or a double-click on its right half, or `(source :bN)`) opens it in the code window,
  where Ctrl+Enter applies it as edits of the nodes that changed. Works that showed a tree as code open it
  as a score, and as a canvas, as a roll; `(view :bN :canvas)` still works. Classes can name their views
  apart from how they are drawn (`:view-as`, `:view-aliases`, `comp/drawn-as`; `view-of` in the REPL), and a
  class with a `:language` keeps its text in the code window whatever its display. The tutorial
  "One, two, tree" now reads: one box, two views, tree.
- **Tutorial «Patterns: play them, draw them»** (composition, 3): a `pbind` played by a `player` (by its 
  clock, by steps, at a position going either way), its generators and seed, `:amp` and rests, `#pat/hold` 
  harmony; `render` into a `freqt`, `keep!`, a canvas time map (backwards, held, a canon by augmentation), 
  the score; and the `pattern` code box. Tested as a lesson in tests/present.mjs.
- **Lessons with package classes**: the packages a lesson needs are compiled before it is built, and their 
  classes registered as soon as their component box is written, so the gestures after it (the `code` of a 
  `pbind`) find them. Before, the source of a box of a package class written in the same lesson was lost.
- **Tutorial "One, two, tree | Uno, dos, tree"** (Notation and theory): every way Kairotic understands
  notation and time, in thirteen steps — one `tree` box seen as code, score and canvas; measured time
  (meters with groups, tuplets, ties, grace notes, chords, `:rtm`) and free time (`:at`, drawing, grid and
  tuning); the score as a quantized reading (alt-click, `divisions`, `division!`, `quant`), written with
  `quantize!`; the `freqt` as a raw buffer and `to-tree!`; names and keys (`#`, shift-alt-click,
  `mt transpose M3`); `:cents`, quarter tones and `:gliss`; and listening with `mt play`. Test:
  `oneTwoTreeTutorial` in `tests/present.mjs`.
- **Spelling**: a key is estimated only when the notes fit one clearly (`sp/estimate-sig`, a correlation of
  0.5 or more), so an unnamed chromatic line is spelled near C, up in sharps and down in flats (it was read
  as C# minor, with B#). **Transposing moves keys**: `mt/transpose` by an interval moves every `:key` of
  the tree with its notes (`sp/transpose-key`, `sp/key-name`), so `{:key "eb"}` up a major third is
  `{:key "g"}`.
- **`@kairotic/patterns` 0.2.0: `render [from] [to] [tex key] [tone key]`** (discussion #93): a stretch of a
  pattern drawn into a `freqt`, as a musical tree — shown live, kept with its recipe by `keep!`, quantized as
  a score. A canvas on its right inlet is a **time map** (x the beats of the drawing, y those of the
  pattern): steeper is faster, down plays backwards with each note entered from its end, flat holds, a
  vertical step cuts, several strokes are layers. Each note's `:amp` is its weight, `:pan` a vertical
  gradient, and the keys named after `tex` / `tone` textures and colours.
- **How a stroke looks**: a `canvas` or `freqt` stroke can carry `:look {:w :pan :tex :tone}` — weight,
  vertical gradient to the paper, `:dash`/`:dot`, `:kairos`/`:ink`/`:soft` — kept in the history, in its
  source and in links (`(stroke :b1 :t1 pts {:w 2 :tex :dash})`); a tree note's `:look` reaches its stroke.
- **One box for freqt, tree and score** (discussion #92). A `tree` box is seen as code, as a score or as a
  **canvas** (⇄ cycles code → score → canvas): `kairotic.treecanvas` draws its notes as strokes of frequency
  over time and turns what is drawn into edits of the tree. Free time: drawing adds a note with `:at`,
  dragging and stretching move and lengthen it, erasing removes it (a tree written otherwise takes the
  free form `[:voice [:par notes]]` the first time a note's time changes). Measures: a change of pitch is
  written in the note (even in a melody string); a change of time re-quantizes the bars it touches; an
  erased note leaves a rest; ⌥ (a drag, or freehand drawing) takes a note to a free voice, which the score
  quantizes on its own staff (`qz/measure-free-voices`). Grid and tuning are the root's `:grid` and
  `:tuning` (12-tet by default, `false` continuous). Its second outlet is its notes as a buffer for a
  `reader~`. A free tree's score keeps its divisions and names in the root's `:quant` (alt-click,
  shift-alt-click, `quant`, `division!`, `enharmonic!` work on tree boxes too). REPL: `(quantize! :bN)`,
  `(unquantize! :bN)`, `(to-tree! :bN)` (a freqt's strokes as a new tree box). The freqt stays the raw
  buffer (recordings, `transcribe`). Tests: `tests/cljs/treecanvas.cljs`, checks in `tests/views.mjs`.
- **`@kairotic/spectral` 0.1.0: `shift~`, pitch shifting in real time.** The signal transposed by every
  factor written after it at once (one interval or a whole chord), one frame (1024 samples) late: ratios
  (`1.5`, `3/2`), semitones with a sign (`+7`) or cents (`386c`); `[:semitones …]`, `[:cents …]`,
  `[:transpose st]` (a glide without retyping the chord), `[:formants q t]`, `[:rms 1]`, `[:dry x]`. Made
  with stftPitchShift 2.0 by Jürgen Hock (MIT), compiled to WebAssembly with wasi-sdk
  (`packages/spectral/native`, moved from Study 28), about 5% of a core with a three-note chord. The
  WebAssembly travels in `dist/shift.mjs`, not in the component's source, so it does not weigh on the
  history of a work. Packages can now carry such files in `assets/` (copied into `dist/` and into the
  page's own copy), loaded with the new **`api/import-module`** (npm at the package's version, then the
  page's copy); the package build checks that a source names its own version. Studies 28 (offline, a
  buffer with its recipe) and 29 (real time) tried it first; Pages now serves the studies at
  `studies/<folder>/`. Tests: `tests/spectral.mjs`.
- **How pitches are written** (issue #88). A new core module, `kairotic.spell`: names with one or two
  alterations (`"f##3"`, `"fx3"`, `"ebb2"`, also in `sc/pitch`), the line of fifths, intervals (`"M3"`,
  `"-P5"`, `"A4"`), keys (`"eb"`, `"c#m"`, `"d dorian"`, a signature, `:none`) and key estimation (Temperley's
  profiles). Written names are kept (`->mei` writes them; `mt/pitches` gives them back; `set-midi` keeps a
  flat a flat); `mt/transpose` takes intervals and moves names by them (a number of semitones becomes the
  interval it is usually written as) and `mt/invert` mirrors names on the line of fifths; `mt transpose M3`.
  `:key` on the tree, a section, a voice or a measure: key signatures and their changes, accidentals that
  last the bar, courtesy accidentals, `accid.ges` for the sounding ones; `:key :none` / `:accidentals
  :every` write every accidental. Notes without a name (numbers, Hz, a freqt's strokes) are named by
  `mt/spell` (a Viterbi on the line of fifths: near the key, chromatic lines rising in sharps and falling in
  flats, chords in thirds), used by ->mei and the quantizer. By hand: `#` on a selected note of a tree's
  score cycles its spelling; shift-alt-click a note of a freqt's score (`(enharmonic! :bN t midi [name])`,
  kept in `:quant :spell`); `(quant :bN {:key "eb"})`. `:cents` on a named note is now a deviation in cents
  (it was added as semitones). Tests: `tests/cljs/spell.cljs`.
- **Quantization, stages 4–6** (issue #86). **Voices**: overlapping strokes (or notes of a tree without
  measures) are separated into voices by pitch proximity (`:voices`, 2 by default; chords stay together, two
  lines that meet go one to each), quantized on the same points and written as layers of one staff (`:staff`
  on a `:voice`: voices that share it are its layers; an empty second layer is not written); a note held
  through another voice's triplet is not written in the triplet. **Nested divisions**: a beat in halves (a
  dotted beat in its eighths) with a division each — an eighth and a triplet of sixteenths (`:nest`).
  **Microtones and glissandi** in `mt/->mei`: quarter-tone accidentals (`1qs`, `3qs`) for pitches half-way
  between semitones; a note that bends (`:gliss`) into the next one is a `<gliss>` line, else a text.
  **Choosing another division**: alt-click a note of a freqt's score divides its beat the next way
  (`qz/choices`, `qz/next-choice`; `:fix {beat choice}` with n, `[n1 n2]` or `[:merge n]`); the choices and
  options are kept in the buffer as `:quant` (a `[:quantize {…}]` event, in its text, its diff and the
  merge of branches). REPL: `(quant :bN [opts])`, `(divisions :bN t)`, `(division! :bN t [choice])`.
- **Quantization: a freqt's score in real measures** (issue #86, stages 1–3). A `freqt` shown as a score is
  no longer rounded to a sixteenth grid: `kairotic.quantize` turns its strokes into a measured tree that
  `mt/->mei` writes. The meter comes from the bar grid (`[1.5 1.5]` → 6/8, `[1.5 1.5 1]` → 8/8 [3+3+2]);
  each beat (or group) takes the division that costs least — distance of the notes to its points, depth of
  the points it uses, being a tuplet, notes lost — and two beats can make a half-note triplet; small gaps
  before the next note are legato, a note too short for any point is a grace note, ties cross barlines and
  leave tuplets. The same for trees without measures (each voice on its staff). `(quantize :bN [opts])`
  gives the tree (`:meter :divs :merge :grace :legato :chord :w`); `(as-tree :bN)` still reads the strokes
  exactly. The header says *quantized*.
- **Metric spelling in `mt/->mei`** (`mt/metric-split`): outside tuplets a value is cut where the beats must
  be seen (a quarter off the beat over the middle of 4/4 → two tied eighths; quarter–half–quarter and
  eighth–quarter–eighth syncopations stay), a rest that fills its bar is a bar rest, and a dotted whole and a
  breve are written as such. Notes take **`:tie true`** (one sound with the next note of the same pitch,
  tied across a barline or into a tuplet; `mt/events` joins them) and **`:grace true`** (a grace note, no
  time). Tests: `tests/cljs/quantize.cljs`, more in `tests/cljs/mt.cljs`.
- **Loudness and silences in patterns**: an event with `:amp` (0…1) makes the player send `[:gain amp]` on
  its Hz outlet just before its notes; **`@kairotic/synth` 0.3.0**: `synth~` takes `[:gain v]` (also `:amp`,
  `:vel`) as the level of the notes that start after it, as a polyphonic `faust~` already did. `nil` is a
  silence too, as `:rest` is, in `:degree`, `:note` or `:freq` (`[0 nil 4]`).
- **`@kairotic/patterns` 0.1.0: patterns after SuperCollider's and Overtone's** (discussion #84). A pattern is
  a lazy, perhaps endless, sequence of event maps; what travels (history, rooms, links) is its source and a
  seed, and each tab makes the events, so everyone hears the same. `pbind [seed] [repeat] [loop]` is a code
  box in EDN — constants, vectors (the shorter ones start again until the longest ends) and generators
  `#pat/seq` `#pat/choose` `#pat/shuffle` `#pat/white` `#pat/walk` `#pat/series` `#pat/hold [beats […]]`
  `#pat/chord`, each key with a seed of its own — safe in a room; a map on its inlet replaces it,
  `[:set k v]` one key. `pattern [seed]` is the same as Clojure code (pbind, pwhite, pchoose… and seeded
  `rand`), trusted like a script. `player [bpm] [quant]` plays one on `start`/`stop` (its own clock, quant to
  meet other players, `[:bpm x]` without a jump), one step per bang, or at a position in beats (a number,
  from a ramp: every event a span that sounds while the position is inside it, entered at its onset going
  forwards and at its end going backwards, `:dir :back`; `seek p`, or a step far larger than the ones before
  it, jumps; `edges`, `spread`): Hz and voice ids for
  synth~ or a polyphonic faust~, the whole event, the beat. A new pattern while it plays goes on from the
  same beat. Pitch: `:freq`, `:note`, or `:degree` with `:scale` `:root` `:octave`. The machinery is in the
  core (`kairotic.patterns`, through `api/…`: `api/pattern-events`, `api/event-hz`, `api/compiled`,
  `api/code-model`…). Tests: `tests/cljs/patterns.cljs`, `tests/patterns.mjs`.
- **Data boxes of any class**: a component with `:sends (fn [box] value)` is sent by the page when its text or
  data changes, as a tree box sends its tree (how pbind and pattern send their patterns).
- **Polyphonic `faust~`**: a source that declares `declare options "[nvoices:8]";` (the Faust
  convention) is compiled as voices played by faustwasm's own allocator, in one AudioWorklet, with an
  optional `effect = …;` from the same source applied to their sum. As `synth~`: Hz on the left and
  voice ids on a second inlet (a `keyboard`, a `reader`, `mt play`), one note per id — a new id starts
  it, one that is gone releases it, one whose pitch changes plays it again; a number plays one voice,
  `[:gain v]` sets the velocity of the next notes, `:stop` releases them all, and any other `[:name v]`
  goes to every voice (or to the effect). Notes are sent as MIDI pitches with decimals, which the
  allocator turns into Hz without rounding: any tuning sounds as written. `freq`, `gain` and `gate`
  leave the box's sliders (the voices set them). A source without `nvoices` is mono, as before. The
  help of `faust~` has four more steps (a keyboard, a score in several voices, a just triad, an
  effect), and Claude knows how to write one. Tests: `tests/faustpoly.mjs`.

- **`@kairotic/synth` 0.2.0: `gendy~ [freq x-step y-min y-max y-step breakpoints]`**, a dynamic
  stochastic oscillator after Xenakis's GENDY (and GendyJS by Andrew Bernstein, MIT): each breakpoint
  keeps its own amplitude and duration, both walking between mirror barriers cycle after cycle. A
  number sets freq, `[:x-step 40]` one parameter, a list of six all of them; a signal on its inlet adds
  to the frequency (FM). Quiet by default (±0.15, 220 Hz), with a one-pole DC blocker; changing its
  breakpoints keeps the wave (no click) and a new text updates it without rebuilding the node. Its help
  patch has four steps (the two walks, breakpoints, FM). Tests: `tests/gendy.mjs`. The new version is
  served by the page until the tag `synth-v0.2.0` publishes it on npm.

- **Components off the patch** (issue #8): a `component` box defines a class and has no inlets nor
  outlets, so the patch no longer draws it (nor selects, frames or anchors marks to it). The
  **Components** tab keeps the work's definitions — the class each defines, whether it compiles (and
  why not), where it is (sub-patches too) — with **New component**, **Edit** (its code in the code
  window), **Publish** and ×; a click on a row chooses it, and the Claude tab's "change the selected
  component" changes the one chosen (or the one open in the code window). Writing `component` in a new
  box makes a definition there; `(new-component!)` from the REPL. It is still a box of the work: its
  history, its code (`(box :bN "component" 0 0)`, `(code :bN …)`), links and embeds are unchanged, so
  older works open as they were, without the column of definitions on their paper.
- **Tasks**: a component can ask the world for something (a URL, an API) without leaving its pure logic.
  It declares `:tasks {:get (fn [x box] promise)}`, asks with the effect `[:get x]`, and the engine gives
  the outcome back on inlet `:task` (`{:task :get :arg x :value v}` or `:error`), with or without ▶. The
  effect `[:keep d]` keeps it as the data of the box, as a gesture of the history (`(keep! :bN d)`): the
  same for everyone in a room, and going back does not ask again; in a jam, only whoever played the
  message keeps it. `api/http-get` and `api/url-of` help the tasks; the in-app Claude knows the pattern.
- **`@kairotic/data` 0.1.0**: `fetch [json|text|edn] [live]` (what is at a URL, kept in the work) and
  `edn [w h]` (any value as a tree to open and pick from, after Portal).
- The whole data of a box written while its class is still loading (a package) is no longer lost.

## 0.2.0-alpha — 2026-10-23

The second cycle: the app learns to draw and to write on itself. After four new studies (24–27:
draw, overlay, layers, geometry), a patch has **layers** with annotations anchored to its boxes and
projections of their views; components get a richer **shapes** vocabulary, parts you can press and a
generic **`draw`** box; music theory becomes geometry in **`@kairotic/theory`**; listening grows
(`monitor`, recording from a point, overwriting a take); and each community can run **its own relay**.

### Highlights

- **Annotations and layers**: **Annotate** draws lines, arrows and texts on a layer, each point anchored
  to the box nearest it (it follows the box; a deleted box leaves its marks on the paper). Layers go over
  or under the boxes, in the patch view and/or the presentation. Marks can be moved, whole or by one
  end. `(mark …)`, `(move-mark …)`, `(unmark …)`, `(layer …)`, `(project …)`: one event each, part of the
  code and of links.
- **Projections**: `(project :b9 :viz [x y w h])` draws a box's view again, at another size, on a layer
  — a `monitor` or a `tonnetz` large behind the presentation.
- **Shapes**: `:curve`, `:group` (moved, turned, scaled), `:opacity` and `:hit` (a part of a view that can
  be pressed: the component's `:gesture` gets `:hit`).
- **`draw [w h]`**: a view made of the shapes that arrive as messages (also written as a msg: `circle 40
  40 10 accent hit sun`), with named shapes to move and shapes that send their `:hit` when pressed.
- **`@kairotic/theory` 0.1.0**: `pcclock`, `fourier`, `tonnetz`.
- **`@kairotic/analysis` 0.3.0**: `monitor`; `transcribe` records from a point and over a take.
- **Relays**: choose, test and share the relay from the session manager; `npx @kairotic/relay`.
- **Storage**: the browser's copy of the graph in IndexedDB (no more `localStorage max!`).
- **Before the release**: help patches with several steps, a rest of a score becomes a note again, parts
  of a view easier to press, boxes never see-through, nothing moved by mistake in presentation.

### All the changes

- **Help**: a help patch can have several steps, one use each (`:steps` in the help of a class): it
  opens as a lesson, ◀ ▶ travel between them, and the Help tab lists them (a click opens that step).
  `freqt` gets its help patch (drawing and playing it, a tuning and a grid, as a score, the viewer of a
  tree); `canvas` (an automation, a path) and `mt` (a canon, playing it) more uses. The Help tab no
  longer shows the history of the prototype (the studies and the glossary of old names stay in the
  repository), nor mentions of the studies in its pages. Two new tutorials: *Harmony as geometry*
  (`pcclock`, `fourier`, `tonnetz`) and *Annotations and layers* (marks, layers, `draw`).
- **Score**: a rest can be selected and becomes a note again — Enter (the pitch of the note before
  it in its staff), ↑ ↓ (a step above or below that one), a…g (the nearest note of that name); on a
  note, a…g changes its pitch to the nearest one of that name.
- **Patch**: boxes are always opaque (a selected box and a msg mixed their tint with the box colour), so
  wires never show through them.
- **Presentation**: a plain drag no longer moves a box — so a `freqt`, a `canvas` or a knob is not moved
  by its header or its grip while playing; ⌥/Alt+drag moves it.
- **Parts of a view** (`:hit`): a press near a small part finds it (the nearest within 10 px,
  `shp/hit-near`), the part under the pointer is highlighted (`shp/only-hit`), and the pointer is the
  same hand over every played view (no resize arrows on `draw`, `tonnetz`, `pcclock`, `fourier`, knobs
  or numbers).

- **Layers** (Study 26): a patch can have `:layers` (`{:z :over|:under :show #{:patch :present}}`),
  `:marks` (`{:layer :kind :line|:arrow|:text :pts|:at …}`, points `[:bN dx dy]` or `[:patch x y]`) and
  `:projections` (`{:bN {:layer :rect [x y w h]}}`), changed by the events `[:layer id l]`,
  `[:annot id m]` and `[:project id p]` (nil removes). Deleting a box moves its marks' points onto the
  paper and drops its projection; merging keeps each mark, layer and projection as its own unit. In the
  presentation a mark follows where its boxes are presented (and is not drawn if one of them is not).
  The **Annotate** bar: Draw, Arrow, Text, Move, Erase, the layer, over/under, patch/presentation;
  `(annotate :arrow)` · `(annotate false)`. **Move** drags a mark — each point keeps its anchor, so one
  anchored to a box still follows it — or one end of a line or an arrow, anchored again to the box
  nearest where it is let go; `(move-mark :a1 dx dy)`. Tests: `tests/layers.mjs`.
- **`kairotic.shapes`**: `[:curve {:points …}]`, `[:group {:x :y :rotate :scale} [shapes]]` (4 deep),
  `:opacity` on groups too, and `:hit` on any shape; `shp/hit-at` finds the shape pressed from the
  shapes themselves (on top wins; inside groups, turned or scaled). The `:gesture` of a component gets
  `:hit`. Tests: `tests/theory.mjs`.
- **`draw [w h]`** (core): a shape adds, a list of shapes replaces, `[:set k shape]` adds or replaces the
  one called k, `[:unset k]`, `clear`; positional shapes for msg boxes (`circle cx cy r`, `rect`, `line`,
  `arc`, `text x y "…"`, with a colour and `hit name`); a shape with `:hit k`, pressed, sends k.
- **`@kairotic/theory` 0.1.0** (Study 27): `pcclock [notes]` (the set, the sets before it, axes of
  symmetry; prime form, interval vector, the class pressed), `fourier [notes]` (six coefficients with
  their trails; magnitudes and phases), `tonnetz [notes]` (lit nodes, triads, the path of the harmony on
  the nearest copy of the lattice; the triad, the class pressed). Lists of pitches, notes one by one, or a
  chroma. The first version is published by hand; then `theory-vX.Y.Z` tags publish it.
- **Studies 24–27** in `studies/`: draw (thi.ng/geom and WebGL), overlay (marks on Verovio, monitor),
  layers (marks, projections, a WebGL background), geometry (theory views and the new shapes).
- **Choosing the relay (Pages)**: in the session manager, **Relay** shows the relays the page syncs
  through and whether each answers (connected, connecting, waiting for it); a relay can be tested
  (`wss://host/gun`, also written as `https://host` or `host`), used, removed, and the page can go back
  to the site's relays or work without one. Choosing reloads the page with `?peer=…`. While the relays
  are not the site's, the address keeps `?peer=…` and each room has **Copy link**, which carries it: whoever
  opens it syncs through the same relay and finds the room.
- **`@kairotic/relay`**: the relay as an npm package, `npx @kairotic/relay [--port 8765] [--data ./radata]`
  (`--help`), so each community can run its own; with a Dockerfile, `relay/fly.toml`, `render.yaml` and a
  workflow that publishes it on a tag `relay-vX.Y.Z` (the first version by hand).
  0.1.1 is the same code as 0.1.0, published by that workflow (trusted publishing, with provenance).
- **Pages: the browser's copy of the graph in IndexedDB** (GUN's RAD, `site/vendor/gun/lib/`), not
  in localStorage. GUN's localStorage adapter kept everything the browser had seen — its works and the
  rooms a relay sent — as one JSON of at most 5 MB; once full, every save failed with
  `localStorage max!` (the intermittent failures of the tests). What an earlier version left there is
  brought over the first time the page opens (merged by its states: what a relay has that is newer
  stays), and leaves localStorage a minute later or more (other GUN apps of the same origin keep theirs).
  Read from IndexedDB, a large document can arrive in parts: a read waits for the whole of it (json and
  del), and subscriptions skip the parts.
- **`?peer=off`**: no relay at all, remembered like any other choice (`?peer=none` still goes back to the
  site's relays). The browser tests open the app this way, so they no longer write to, or depend on, the
  public relay. Tests: `tests/browser.mjs` (storage).
- **`monitor [seconds] [name …]`** (`@kairotic/analysis` 0.3.0): draws whatever arrives over the last
  seconds (6 by default), one lane per inlet — one per name written after the seconds (`monitor 6 rms
  centroid chroma` has 3 inlets), or one. A number is a line in the range it has had in the window, a
  list of numbers a strip of cells with one row per element (chroma, mfcc), anything else (a bang, a
  word) a mark. Time is that of the messages: the right edge is the last one. Lines keep about 150 points
  in the window, strips 48 columns, marks the last 64; a clock that goes back (the engine started again)
  starts it over. Tests: `tests/analysis.mjs`.
- **Shapes: `:opacity`** (0…1) on any shape of a component's view (`kairotic.shapes`), for the cells
  of `monitor`.
- **Overwrite (punch-in/out)**: `ovr t` — `msg ovr 4`, or `[:ovr 4]`; `ovr` alone from 0 — on a
  `sample`, a `record` or a `transcribe` replaces only what the take covers, from t to where it stops,
  and keeps what came after it (`rec t` still replaces everything after t). A sample joins its first t
  seconds, the take and the rest of its sound after the take; a record or transcribe cuts, at each
  write, what the take covered since the last one, with the new edit `[:cut t1 t2]`: strokes inside are
  erased, those that cross an edge end or begin there, one that spans the window is split in two (the
  part after it a new stroke). `[:cut t]` keeps meaning everything from t on. `@kairotic/analysis` 0.2.2.
- **Recording from a point (punch-in)**: `rec t` — `msg rec 4`, or `[:rec 4]` — on a `sample`, a
  `record` or a `transcribe` keeps what was there before t and records from t on, replacing what came
  after; plain `rec` still starts from 0 and clears. t is in seconds (beats for transcribe). A sample
  joins its first t seconds (silence if it was shorter) with the take, in as many channels as it had; a
  canvas or freqt gets the new edit `[:cut t]`, which erases the strokes that begin at t or later and
  ends at t those that cross it (the point at t interpolated on the scale of the axis), in the same event
  as the first strokes of the take. Strokes of a `record` take from t have ids of their own, so they do
  not replace kept ones; its Y axis is left as it was. `@kairotic/analysis` 0.2.1. Tests:
  `tests/cljs/record.cljs`, `tests/record.mjs`, `tests/sounds.mjs`, `tests/analysis.mjs`.
- **`record [lo hi] [log] [tolerance]`**, a new core class: any stream of numbers into a canvas (or a
  freqt) as strokes over time — a knob, `snapshot~ 50 rms`, a descriptor of `features~`, a position.
  `rec` starts a take from 0 (its first write clears the buffer), `stop` ends it, a bang on the right
  ends a stroke. A value holds until the next one (a staircase: senders like snapshot~ send only what
  changed), simplified within `tolerance` (1% of the range without it). Time in seconds from rec; the
  axes of a canvas follow the take (Y fixed with lo hi). At most one write every 2 seconds, each one
  event of the history. Read back with `reader~` as an automation. Tests: `tests/cljs/record.cljs`,
  `tests/record.mjs`.
- **`transcribe`** (step 4 of audio input; `@kairotic/analysis` 0.2.0): writes what `pitch~` hears into
  a `freqt`. `rec` starts a take from 0 (its first write clears the freqt), `stop` writes what is left;
  in `notes` mode each note is a flat stroke at the pitch it holds longest (the freqt's tuning or score view
  rounds it, so microtones stay), a new one when the pitch moves more than 0.6 of a semitone or an
  `onset~` bang arrives on the right; in `glide` mode a stroke follows the pitch (points every 10 cents,
  64 at most). Times are beats at bpm (60 by default: one beat a second); notes shorter than ms (60) are
  left out. It writes at most every 2 seconds, each write one `[:batch …]` event of the history. Tests:
  `tests/analysis.mjs`.
- **A sound loaded in an earlier session keeps its length and picture**: read back from this browser's
  store, it was not described again, so `(load-sound! :bN url)` wrote only `{:audio … :url …}` and the
  box drew no waveform. Now it learns its sample rate, length, channels and peaks as when it was stored.
- **`github:` without `@ref` finds the file**: jsDelivr then serves the latest semver tag of the
  repository, not its default branch, so a file added after that tag was not found (in this repository
  the only such tag is `v0.1.0-alpha`). Now it looks at `@main`, then `@master`, then that tag; a
  file jsDelivr does not have comes without the CORS header, so any failure tries the next place. Why a
  sound could not be loaded is said in words — not found (and where it looked), refused by the site
  (CORS) or unreachable, not a sound — instead of always suggesting CORS.
- **`msg` sends strings**: text between quotes is a string — `msg "https://…"`, `msg "two words"`,
  `msg url "github:…" 3` — with `\"` and `\\` inside; numbers and words are as before (`msg stop` is
  still `:stop`). Until now every word was a keyword, so a box that takes text got `:"…"` with its quotes.
  Tests: `tests/cljs/msg.cljs`.
- **A `msg` with a URL loads a sample**: `msg https://…`, `msg "https://…"` and `msg url github:…` now
  work (a msg sends its words as keywords, which the sample ignored). A word or string the sample does
  not understand is said in the REPL instead of doing nothing.
- **Sources of sounds that work without CORS problems**: a sample's URL can be
  `github:owner/repo@ref/path.wav` — any file of a public GitHub repository, served by jsDelivr (the
  banks of Dirt-Samples, a repository of your own sounds) — or `freesound:id`, the preview of a
  Freesound sound fetched with the API key of whoever opens the work: each person their own,
  `(freesound-key! "…")`, kept only in their browser and never in a work, a link or a room. A Freesound
  sound keeps its credit (name, author, licence, page) beside its description and shows it in the box;
  `(credits)` lists the credits of the work; `(sounds "kick" {:max 2 :license "cc0"})` searches
  Freesound and prints the line that loads each result. Without a key the box says it needs one. Tests:
  `tests/cljs/sounds.cljs`, `tests/sounds.mjs`.
- **Presentation is for playing** (issue #57): in Present and in Release/Perform embeds a double-click
  creates no box, no wires can be drawn, and nothing is selected with the mouse (no frame, ⇧+click,
  ⌘/Ctrl+click, ⌘/Ctrl+A; a click on a box does not select it, so Delete removes nothing). Switching to
  presentation clears the selection. In the editor's Present a box can still be dragged to a new place,
  one at a time; in a Release/Perform embed it stays. Tests: `tests/present.mjs`, `tests/embed.mjs`.
- **Share/Export** is the new name of the Embed button and its panel: a link to share the patch, or
  an iframe to put it in another page. The class names and the commands stay (`embed-link`, `?embed`).
- **Links after `#`** (issue #55): every link Kairotic makes (Embed, `(embed-link)`, `ask-link`, the
  links of the Claude log and of Feedback) carries its parameters after `#` — `…/kairotic/#code=…&present`
  — so a long patch is no longer refused by the server (414: the request line too long). The page reads
  the same parameters after `?` or `#` (after `#` wins), the Pages boot too (`#embed`, `#present`: no
  relay), and a new link pasted in the same tab opens it. `?` links keep working.
  Tests: `tests/embed.mjs` (a link after `#` with a patch of about 20 KB).
- **Samples from URLs**: a `sample` can hold a sound from a URL — `(load-sound! :bN "https://…")`, a
  string (or `[:url "…"]`) on its left, or `(sample! :bN {:url "…"})` in the work's code, links and
  rooms. Every browser that opens the work fetches it by itself when the box is drawn (or a `reader~`
  needs it), decodes it at the engine's rate and keeps it in IndexedDB under a key made from the URL, so
  shared sessions and tests have the same sounds everywhere without sending audio through the history.
  A description that is only a URL learns its length and peaks once loaded; the box says "loading…" or
  "could not load its URL". Accepted: http(s), paths of the page (`sounds/voice.ogg`), `data:` and
  `blob:`; never `javascript:`. A test sound, `tests/assets/a440.wav` (CC0), is served with the tests.
  Tests: `tests/cljs/sounds.cljs`, `tests/sounds.mjs`.
- **Embed: Release/Perform** (issue #50), in place of *Presentation, fullscreen*: its link always
  carries a release of the patch (its presets boxes keeping their presets, as `(release)` makes it; also
  from a tutorial or a help patch) and always opens in Perform, so what is played or changed in the
  frame is a take, never the work. The link work is named «Link · release». `?present` stays its
  address, so links made before open the same way; `(embed-link :release)` (or `:perform`, `:present`).
  Tests: `tests/embed.mjs`, and a check in `tests/release.mjs`.
- **`@kairotic/analysis` 0.1.1**, the first version published from GitHub with trusted publishing
  (0.1.0 was published by hand): the same components. Works pin 0.1.1; the publishing workflow now
  answers to `analysis-v*` tags.
- **`@kairotic/analysis`**, a new official package (step 3 of audio input): from any signal into
  messages and pictures. `pitch~ [lo hi] [threshold]` — YIN in its own AudioWorklet, every 1024
  samples: Hz on the left (0 once when it stops hearing a pitch), clarity on the right, a view with the
  note and its cents. `onset~ [threshold] [ms]` — a bang at each attack and its strength, from the
  growth of the spectrum against the median of the last frames. `chroma~ [ms]` — 12 values from C to B
  and the strongest class as a word, with 12 bars. `features~ [ms] [descriptor …]` — one outlet per
  descriptor (rms, energy, zcr, loudness, centroid, spread, flatness, rolloff, kurtosis, skewness,
  slope, crest, sharpness, perceptualSpread, mfcc, chroma; centroid, spread and rolloff in Hz).
  `spectrum~ [lo hi]` — the spectrum drawn on a log scale. Every box sends only what changed. The
  descriptors are [Meyda](https://meyda.js.org)'s (MIT), loaded from jsDelivr the first time one is
  used; all the boxes use frames of 2048 (Meyda keeps filter banks for one size). The API learns
  `api/load-script` (a classic script, once per page; `npm:` through jsDelivr) and `api/hz->midi`,
  `api/midi->hz`, `api/midi-name`, `api/pitch-class`. Essentia.js stays out (AGPL): a separate package
  later, if wanted. Tests: `tests/analysis.mjs`.
- **Recording buffers** (step 2 of audio input, after `adc~`): a new core class, `sample [seconds]`,
  records what reaches its left inlet on `rec` until `stop` (or until it has `seconds`, 60 by default;
  ■ keeps what was heard), `clear` empties it and a bang sends its length in seconds, as does every new
  recording. Its right outlet is a buffer like a canvas's: a `reader~` plays it at the position of a
  `phasor~` (0 its start, 1 its end), so speed, direction and scrubbing are a matter of the position
  signal; the new `!/` (and `!-`), arithmetic the other way round, turns its length into Hz. The sound
  stays in this browser (IndexedDB) under the hash of its samples; the history and the work's code keep
  only its description, `(sample! :bN {:audio hash :sr :frames :channels :peaks})`, enough to draw
  it anywhere and to say when its sound is not there. `(load-sound! :bN)` decodes a file into it,
  `(save-sound :bN)` saves it as WAV. The native loops live in `core/kairotic/sounds.mjs`; the tap of
  the API learns `:active` and `:flush`, and `api/effect!` lets an audio node ask the page for an effect
  of its box. Tests: `tests/cljs/sounds.cljs`, `tests/sounds.mjs`.
- **Release, presets that travel, and points of the history forgotten** ([#45](https://github.com/bonuoq/kairotic/issues/45)):
  - A `presets` box can keep its presets in its data — `(store-presets! :bN)` copies the keyframes it
    uses, only what changes between them; `(presets! :bN […])` sets them. A box that keeps presets uses
    them instead of the history, and they are part of the patch: its code, `?code=` links and embeds.
  - **Release…** in the history bar (`(release)`) makes a new work (solo, or local without an account)
    with a compact history: one point per keyframe, labels kept, each written as the changes from the one
    before in one `[:batch …]`, then the work as it is, every presets box keeping its presets. The original
    work is not touched.
  - In a solo or local work, ⇧+click points of the history and **Forget…** them, after a warning: the
    moments after them stay exactly as they are (runs of points become one change), the work at those
    moments is lost. Tips of branches and branch points cannot be forgotten; rooms use a release instead.
    REPL: `(forget-points [["id" k] …])`.
  - New history event `[:data :bN d]`, the whole data of a box (merges treat it as the whole box), and
    `kairotic.release/patch-diff`, the events that turn one patch into another. Tests:
    `tests/cljs/release.cljs`, `tests/release.mjs`.
- **Sound from outside, and back into messages** (step 1 of audio input, recording buffers and the
  `@kairotic/analysis` package): three core classes in a new module, `core/kairotic/input.cljs`.
  `adc~ [channel …]` is the audio input — the microphone or the sound card, one outlet per channel
  (`adc~ 1` by default) —; at ▶ it asks for the microphone once and takes its sound as it is, without
  the echo cancellation, noise suppression and automatic gain made for calls; every `adc~` shares one
  stream, closed a moment after the last one stops. `snapshot~ [ms] [rms|peak|db]` turns a signal into
  numbers every ms: its value, or its level; it sends only what changed and has a small meter of its
  own. `scope~ [ms] [zoom]` is an oscilloscope in the patch, steady on a rising zero crossing; dragging
  over it zooms and changes the time, written in its text on release. Underneath, the **API** (still
  version 1: only additions) opens the way back from the sound: `api/report!` lets an audio node give
  its own box what it finds, which the box's `:receive` gets on inlet `:audio`; `api/tap` is a worklet
  that hands a signal to the page every hop samples as frames, a summary (last, rms, peak) or a trace
  (min and max per column), with the loops over samples in the worklet; `api/retap`, `api/db`. Docs:
  guide · guía, writing a component · escribir un componente. Tests: `tests/cljs/input.cljs`,
  `tests/audioin.mjs` (the test browser runs with a fake microphone).
- **The panel on the right can be hidden and resized** ([#40](https://github.com/bonuoq/kairotic/issues/40)):
  **»** in its header (or **›** on the bar beside it) hides it and the patch takes the room; **‹** brings
  it back, and so does asking for a tab (? or F1 on a box, `(docs …)`, a tutorial, the Code tab). Drag
  the bar between patch and panel to set its width (a double-click on it hides or shows it). Kept in this
  browser, not in the work. REPL: `(side-panel false)`, `(side-panel true)`, `(side-panel 480)`,
  `(side-panel :auto)`.
- **Canvas, freqt and score boxes can be resized** ([#40](https://github.com/bonuoq/kairotic/issues/40)):
  drag their bottom-right corner; the size stays in the work as one event, `[:size :bN w h]` (a change of
  layout for Perform, its own unit for merges), and the work's code writes `(resize :bN w h)`. A score
  reflows its notation to the width and keeps the height of the notation. A double-click on the corner,
  or `(resize :bN)`, brings back the default size. Tests: `tests/layout.mjs`.
- **Present the selection** ([#42](https://github.com/bonuoq/kairotic/issues/42)): pressing **Present**
  with boxes selected that are not in the presentation yet asks whether to present them; *Present the
  selection* puts them in it where they are in the patch, as one event of the history. REPL:
  `(present-in-place :b3 :b4)`. Tests: `tests/present.mjs`.
- **Tutorial: Presets — recall, morph, generate** (`(tutorial "presets")`, composition track), with the
  FM synthesizer of [#42](https://github.com/bonuoq/kairotic/issues/42): three keyframes (calm, pulse,
  storm), a `presets` box played by `msg 1 2 3`, a knob that morphs, `keep`, a bang that generates, and
  the controls presented as a panel.
- **Presets from the keyframes of the history** ([#35](https://github.com/bonuoq/kairotic/issues/35)):
  every keyframe (◆ snapshot, or take kept from Perform) is a preset of the work — the text of each
  box then, sub-patches included: its arguments and the values its controls keep (a knob, `adsr~`,
  `space~`). The new core class `presets` plays them: a number or a label on the left **recalls** a
  keyframe, as one event of the history (boxes added or removed since, lines and buffers are not
  touched); a position on the right **morphs** — `1.5` is halfway from the first to the second — moving
  the controls as messages, as a drag does (log knobs geometrically, envelopes element by element, the
  knob that drives it left alone), until `keep` writes them; a **bang** (or `[:generate seed]`)
  **generates** a new preset: what is the same in every keyframe stays, numbers that change take a
  value within their range, words that change are one of theirs. Its outlet sends the values of the
  controls it set. `presets intro verse` uses only those snapshots. REPL: `(keyframes)`, `(recall 2)`,
  `(morph 1 2 0.5)`, `(morph :keep)`, `(generate 42)`. A new history event, `[:batch [ev …]]`, writes
  several changes as one (merges and takes understand it). Docs: guide · guía. Tests:
  `tests/cljs/presets.cljs`, `tests/presets.mjs`.
- **Type the value of a numeric control** ([#32](https://github.com/bonuoq/kairotic/issues/32)): a
  double-click on a `number` box, on a knob — or any component whose `:gesture` gives numbers (a keyboard
  gives notes, so it plays as before) —, on a slider of a code box such as `faust~` or on the value
  written beside it, or on such a control presented in the panel of a sub-patch, opens a small field
  with its value. Enter (or leaving the field) applies the number as the same gesture a drag leaves in
  the history: a knob is rewritten with it in its text, after its own `:receive` has kept it within its
  range; a slider keeps it within its min and max; a number box sends it. Esc closes the field with no
  change (on a slider it also undoes the jump of the first click). Accepted: `440`, `-3.5`, `.25`, a
  decimal comma (`0,5`), `1e-3`, a ratio (`3/2`); anything else is refused and the field stays open.
  Tests: `tests/numinput.mjs`.
- **Recipes beside kept buffers** ([discussion #17](https://github.com/bonuoq/kairotic/discussions/17), after
  [Rastrum](https://github.com/smoge/Rastrum)): `(keep! :bN)` now keeps, beside the buffer it writes,
  the recipe that made it: the tree as it arrived, the boxes and lines upstream as code, and the box it
  came from, all in one event (`[:kept …]`). While the buffer is unchanged, a freqt shown as a score keeps showing the
  tree in measured notation and `as-tree` returns it; once the buffer changes the recipe is marked
  stale (the header says so). `(recipe :bN)` reads it, `(remake! :bN)` writes its tree back. The work's
  code writes recipes as `(recipe :bN {…})`; the Data view shows `:recipe` beside `:data`; merges treat
  a recipe as its own unit.
- **No more `score` class: a score is a view of a `freqt`** ([discussion #30](https://github.com/bonuoq/kairotic/discussions/30)):
  `score` and `freqt` were the same buffer with the same behaviour, so only `freqt` remains. It is drawn
  as a canvas or as a score (`(view :bN :score)`, ⇄ in its header) and has the third outlet, **edits**,
  for the tree it shows as a score. A box written `"score"` — in older works and histories, in code, or
  typed — is read as a `freqt` shown as a score (a score drawn as a canvas becomes a plain freqt), so
  nothing breaks. Help, docs, tutorials and Claude's guidance now use `freqt` + `(view … :score)`.
- **One box, several views of its data; any buffer as text** ([discussion #30](https://github.com/bonuoq/kairotic/discussions/30)):
  a class can offer `:views`, and each box keeps the one it shows — `(view :b2 :score)`, or **⇄** in its
  header. A `tree` box can be shown as a score in the same box, and its notes (↑ ↓ + − Delete) edit its
  own tree, with no edits wire; a `freqt` can be drawn as a score and a `score` as a canvas. A separate
  `score` box is still the viewer of a transformed tree (`tree → mt … → score`). Models can write and
  read their data as text (`:source`, `:read`, `:diff`): the buffer of a `canvas`, `freqt` or `score`
  opens as EDN in the code window (**{ }** in the header, a double-click on its right, or `(source :bN)`),
  and applying it (Ctrl+Enter, or `(code :bN "…")`) writes only what changed, as one event of the history.
  Text that cannot be read is refused, saying why, and stays in the window. Tests: `tests/cljs/views.cljs`,
  `tests/views.mjs`.
- **Grouped meters and metric weight** ([discussion #17](https://github.com/bonuoq/kairotic/discussions/17)):
  a measure groups its units with `:groups [2 3]` or `{:meter "5/8[2+3]"}` (inherited with the meter,
  checked to add up). Scores write grouped meters as 2+3/8 and now **beam** eighths and shorter notes
  by group, or by beat (dotted beats in 6/8, 9/8, 12/8); tuplets beam their own notes. Metric weight
  as composition data: `mt/meter-level`, Barlow's `mt/indispensability` (3/4 and 6/8 rank the same
  eighths differently), `mt/indispensability-at`, `mt/pulses`, and `mt/thin` / the box `mt thin 0.5`,
  which keeps the notes on the strongest positions of each measure. Docs: `docs/mt.md` · `docs/mt.es.md`.
- **Proportional rhythm in musical trees** ([discussion #17](https://github.com/bonuoq/kairotic/discussions/17),
  after [Rastrum](https://github.com/smoge/Rastrum)): `[:rtm {:shares [1 [1 [1 1 1]] -1 2] :pitches "c4 d4"}]`
  writes a rhythm as shares (negative: a rest; `[weight [shares]]` divides one) that fill their measure
  or their `:dur`. Note values and tuplets follow from shares and meter (three shares of a 3/4 bar are
  quarters, of a 4/4 bar a 3:2 of halves; common factors change nothing), nested tuplets included.
  Pitches are given apart and start again when they run out (talea and color); shares can be RTM text.
  `mt/cell-retrograde`, `mt/cell-rotate`, `mt/cell-at` and `mt/cell-replace-at` transform the shares
  (a cell can grow inside itself). Docs: `docs/mt.md` · `docs/mt.es.md`.
- **Fix an issue with Claude**: each open issue in the Feedback tab has a **Claude ↗** link that opens a new
  Claude chat (claude.ai/new) with a prompt written for that issue — review it, fix it on a branch with
  tests, open a pull request. You read the prompt and send it yourself.
- **Canvas, freqt and score answer and obey messages** ([#26](https://github.com/bonuoq/kairotic/issues/26)):
  on the left inlet, edits — `[:stroke pts]`, `[:note t "c4" dur]`, `[:move :t1 dx dy]`, `[:stretch :t1 k]`,
  `[:erase :t1]`, `[:clear]`, `[:axis :y lo hi :log]`, `[:grid-x 0.25 [4]]`, `[:tuning "19-tet"]`, or several
  in `[:batch [...]]` — change the buffer as one event of the history (`canvas-edit!`); questions —
  `[:read x]`, `[:read :y v]`, `[:strokes]`, `[:get :t1]`, `[:count]`, `[:end]`, `[:range]`, `[:data]` —
  are answered on the left outlet. Numbers and musical trees work as before.
- **`reader~` no longer freezes the page** (the patch of [discussion #22](https://github.com/bonuoq/kairotic/discussions/22)):
  its table of a canvas was sampled again after every change of the history (a knob released: about
  0.6 s per `reader~`, 2.4 s with four), because the canvas, rebuilt, was a new object. Buffers are now
  compared by value, tables are kept by what they depend on (several readers of one canvas share one),
  and sampling only asks the strokes that can pass at each point (≈30× faster). Profiling script:
  `tests/profile/d22.mjs`.
- **Calls / Data in the Code tab** ([#15](https://github.com/bonuoq/kairotic/discussions/15)): the EDN tab
  is gone; the Code tab shows the work as **Calls** (editable, as before) or as **Data**, the state the
  history produces as EDN, now in the code editor (read-only, with colours, folding and search) and
  pretty-printed: one box per line, `:text :x :y` first and `:data` last, `:b2` before `:b10`, long
  values broken over lines. The editor bundle takes a `readOnly` option for it.
- **Code editor** ([#8](https://github.com/bonuoq/kairotic/issues/8)): code boxes (`faust~`, `script`,
  `component`, `tree`) are compact in the patch — one row of their code, their status and their
  parameters — and their code opens with a double-click in a window you can move and resize. Inside is
  CodeMirror 6: line numbers, automatic indentation, matching and closing brackets, structural editing
  for Clojure (`@nextjournal/clojure-mode`), Faust highlighting, search and completion (Faust libraries,
  `api/…`, `clojure.core`, tree tags). Ctrl/⌘+Enter applies and keeps it open. The editor is one
  vendored module (`core/vendor/codemirror.mjs`, built by the `vendor` workflow), so Kairotic stays
  static; without it, a plain text area does the same.
  The **Code tab** and the **REPL** use the same editor: in the REPL, Enter evaluates once the brackets
  are closed (otherwise a new line; ⇧+Enter always), ↑ ↓ bring back earlier expressions.
- **Jams carry what is played** ([#11](https://github.com/bonuoq/kairotic/issues/11)): a knob turned,
  a number dragged or a `msg` clicked in a jam is played in the engines of the others too, not only
  drawn. And a control whose value stays in its text (`knob`) sends that value when the text changes
  from elsewhere — another tab of a room, a jam, or a moment of the history you travel to.
- **Functions of `clojure.core` as boxes** ([#12](https://github.com/bonuoq/kairotic/discussions/12)):
  `into [440]`, `map inc`, `get % :freq`, `conj % 440`, `str/upper-case`… are boxes by themselves. Their
  words are EDN arguments; the message goes last (or where `%` is); each argument has a cold inlet; a
  bang sends again. Only pure, finite functions (results of at most 4096 elements), so they are safe in
  rooms. Components can now read their arguments from the whole text with `:parse`, and classes can be
  supplied on demand (`comp/fallbacks`).
- **`keyboard`** in `@kairotic/controls`, from the Gallery ([#2](https://github.com/bonuoq/kairotic/discussions/2)):
  a virtual MIDI keyboard that plugs straight into `synth~` (Hz 0→0, voice ids 1→1) or `faust~` (Hz and
  `[:gain velocity]`), with a gate for `adsr~`. Press and release follow the mouse; ⇧ builds chords that
  stay, `hold` latches. Gestures are now asked once more on release (`:up true`), so what stays in the
  history is a release or the held chord, never a stuck note; ⇧ on the body of such a box reaches the
  gesture and the grip still selects.

- **`@kairotic/controls`**, a new official package: `knob` moves there (written against the Kairotic
  API) and comes into a work by itself when a box uses it, like `adsr~` or `pan~`. The app no longer
  uses the deprecated npm package `kairotic-components`; its sample components `fifth` and `drift` are
  not carried on (they stay in `components/` and on npm for the works of the studies). Single official
  components are gone: every official class now belongs to a package.

- **Inspector on ⌘/Ctrl+click** ([#4](https://github.com/bonuoq/kairotic/issues/4)): a plain click
  selects and moves a box; ⌘/Ctrl+click opens its inspector (arguments and text). Esc closes it.
- **Several boxes at once**: ⇧+click adds a box to the selection (or takes it out), a frame drawn
  from an empty place of the paper selects every box it touches (⇧ adds), ⌘/Ctrl+A selects all.
  The selection moves together (in the patch or in presentation) and Delete removes it. New REPL
  commands: `(move-by [:b1 :b2] dx dy)`, `(present-by [:b1 :b2] dx dy)`, and `(delete :b1 :b2 …)`
  takes several boxes.
- **Compose and Perform** ([#5](https://github.com/bonuoq/kairotic/issues/5)): **Perform** opens a
  take outside the history, from where you are, to rehearse, try and improvise; going back to Compose
  keeps it as a new point (a branch) or discards it. Ctrl+Z works inside the take. In a shared room,
  whoever performs from the same point plays one take together (a **jam**); the others get an
  invitation to join. Commands: `(perform)`, `(compose)`, `(compose :keep)`, `(compose :discard)`,
  `(jam "id")`.
- **Snapshot**: ◆ in the history, or `(snapshot "name")`, writes a keyframe with the work as it is
  now, in Compose or in Perform.

## 0.1.0-alpha — 2026-10-14

The first version of Kairotic as one app, after 23 studies ([docs/studies.md](docs/studies.md)).
From here on the app grows on itself: components, packages and features added to `app/` and `core/`.

### What it is

- A patcher of music where **patch and code are one work**: every gesture is a call, the Code tab
  and the REPL write what the patch draws, and the other way round.
- A **history** that is a tree of events: going back, branching, merging, simultaneous gestures,
  authorship per session; **solo works** and **shared rooms** (claude.ai, or GUN on Kairotic Pages).
- **Sound and time**: Web Audio boxes, Faust compiled in the browser (`faust~`), reading graphic
  buffers at audio rate (`phasor~` → `reader~`), a time queue on the audio clock; official packages
  (`@kairotic/synth`, `@kairotic/spatial`) and published components (`knob`, `fifth`, `drift`).
- **Graphic buffers**: `canvas` (two dimensions) and `freqt` (frequency over time, Scala tunings, bar
  grids), read by `reader`/`reader~`.
- **Music as data**: musical trees in EDN (`tree`, `mt`), drawn as notation (`score`, Verovio),
  transformed, played and edited from the score; the work as a tree of sections and voices.
- **Data that flows**: messages without ▶, data boxes that send themselves only toward what needs
  them, views that send their edits back, loops without time cut.
- **Components** with one contract (logic, view as data, gestures, audio, help), sub-patches,
  abstractions and panels; components defined inside the work; a presentation mode.
- **Learning**: a Help page for every class with a help patch, and bilingual tutorials that open as
  lessons in the history.
- **Claude in the work**: patches and components from a description, checked with the page's tools
  before they arrive; your own Claude account or API key; a log of requests in your browser, shareable
  in the [Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery).
- **Embedding**: a patch, a tutorial step, a help patch or a fullscreen presentation inside Notion or
  any page; links carry the patch as data (`?code`, `?src`) or a description for Claude (`?ask`), never
  a key.

### Since the first build of 0.1.0-alpha

- The documentation inside the app, in the Help tab.
- A Feedback tab: bugs, ideas and questions written as GitHub issues.

### New in this version (since Study 23)

- One app in `app/` (the page split in `app/page/*.cljs`) built with `core/` into Pages and the
  claude.ai edition by `site/build.mjs`.
- `kairotic.links`: reading the code a link carries, as a module of its own.
- Tests (links, musical trees, data that flows) in the browser (`tests.html`) and in GitHub Actions.
- Documentation: an index, a guide, concepts, the studies, and a class reference generated from the help.
