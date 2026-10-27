# Quantization benchmark

Issue [#105](https://github.com/bonuoq/kairotic/issues/105). It measures how well `kairotic.quantize` gives back
written rhythm from played notes.

A corpus of measured trees whose notation is known is **performed**. Its notes are moved in time and shortened by
a seeded generator, at four levels of imprecision. The performance is quantized back and compared with what was
written. The same seed always gives the same performance, so a change to the quantizer can be measured against the
last one.

| level | onsets (σ, beats) | durations played | drift of the beat |
|---|---|---|---|
| `exact` | 0 | as written | 0 |
| `tight` | 0.02 | 90–100 % | 0 |
| `loose` | 0.05 | 75–100 % | ±0.03 |
| `rough` | 0.08 | 60–100 % | ±0.06 |

A grace note is played short (0.06 beat), just before its note. Pitches reach the quantizer as numbers, without
their names, so the spelling is the quantizer's (issue #88).

## What is measured

| column | |
|---|---|
| perfect | pieces where every note is in place, with its duration, and nothing is added |
| onsets | written notes found again: same onset (±0.001 beat) and pitch (±5 cents) |
| precision | of the notes the quantizer wrote, how many are written notes |
| durations | of the notes found, how many have their written duration |
| spelling | of the notes found, how many have their written name (where the source names them: Essen, our own) |
| tuplets +/− | onsets off the binary grid (tuplets) added where there were none / lost where there were |
| graces | grace notes found again as grace notes / written |
| ms | time per piece, quantizing in the browser (Scittle) |

## The corpora

- **Kairotic's own** (`tests/cljs/qbench.cljs`, MPL): twenty small cases, each about one thing the quantizer has
  to get right:
  - beat divisions: quarters, eighths, dotted rhythms, syncopation, sixteenths;
  - tuplets: triplets, an eighth plus triplet sixteenths, a quintuplet;
  - meters: 6/8, 7/8 [2+2+3], 5/8 [3+2], a pickup;
  - rests, a grace note, ties (also over a barline);
  - two voices, chords;
  - spelling: a chromatic line, a melody in E♭.

  They run with the unit tests (`tests.html`). Thresholds a little below what the quantizer reaches now make a
  regression fail.
- **Outside corpora**, fetched by `fetch.mjs` into `.cache/` (git-ignored). Their licenses allow research use,
  not redistribution here. A seeded random sample of 200 pieces, half from each, with the first 8 bars of each:
  - **Essen Folksong Collection** (kern, [ccarh/essen-folksong-collection](https://github.com/ccarh/essen-folksong-collection)):
    one spine, one meter, ties merged, pickups kept, written names kept. License: CCARH (see its `license.txt`).
    According to music21 its legal status is unclear, so non-commercial use only. Schaffrath, H. (1995), *The
    Essen Folksong Collection*, D. Huron (ed.), CCARH.
  - **SymbTr** (Turkish makam, [MTG/SymbTr](https://github.com/MTG/SymbTr)):
    - pieces with one usul of at most 10 beats a bar;
    - times from the `Offset` column;
    - çarpma (Kod 8) as grace notes;
    - pitches from the 53 commas of the octave (MIDI with decimals), so their microtones stay;
    - the groups of a few aksak usuls (Aksak 2+2+2+3, Aksaksemâî and Curcuna 3+2+2+3, Türkaksağı 2+3, Devr-i
      Hindî 7/8 3+2+2), and the quantizer's own spans for the others.

    License: CC BY-NC-SA 4.0. Karaosmanoğlu, M. K. (2012), *A Turkish makam music symbolic database for music
    information retrieval: SymbTr*, ISMIR, 223–228.

`.cache/SOURCES.md` lists the pieces of the sample with their licenses and citations.

## Running it

```sh
node site/build.mjs                       # the site the benchmark runs in (_site/)
node tests/quantize-corpus/fetch.mjs      # once: clones Essen and SymbTr into .cache/, writes the sample
node tests/quantize-corpus/bench.mjs      # the table; also .cache/report.md and .cache/results.json
```

Options:
- `fetch.mjs --n 200 --seed 105 --bars 8`: how many pieces, which sample, how many bars.
- `bench.mjs --seeds 3`: performances per piece and level.
- `bench.mjs --key`: gives the quantizer each piece's written key, to tell spelling from key finding.

## First results (2026-10-27, seed 1)

| source | level | runs | perfect | onsets | precision | durations | spelling | tuplets +/− | graces | errors | ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| essen | exact | 100 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 0 / 0 | 0 / 0 | 0 | 35 |
| essen | tight | 100 | 87.0% | 100.0% | 100.0% | 99.3% | 100.0% | 0 / 0 | 0 / 0 | 0 | 36 |
| essen | loose | 100 | 0.0% | 92.3% | 92.4% | 83.1% | 100.0% | 167 / 6 | 0 / 0 | 0 | 37 |
| essen | rough | 100 | 0.0% | 71.3% | 71.3% | 52.3% | 100.0% | 722 / 9 | 0 / 0 | 0 | 38 |
| own | exact | 20 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 0 / 0 | 1 / 1 | 0 | 15 |
| own | tight | 20 | 50.0% | 98.7% | 96.8% | 89.5% | 100.0% | 3 / 0 | 0 / 1 | 0 | 14 |
| own | loose | 20 | 5.0% | 83.8% | 81.6% | 60.5% | 100.0% | 18 / 7 | 0 / 1 | 0 | 14 |
| own | rough | 20 | 0.0% | 63.6% | 62.8% | 36.7% | 100.0% | 35 / 9 | 0 / 1 | 0 | 13 |
| symbtr | exact | 100 | 76.0% | 99.3% | 98.9% | 98.9% | – | 62 / 0 | 39 / 72 | 0 | 66 |
| symbtr | tight | 100 | 46.0% | 98.9% | 98.2% | 97.8% | – | 125 / 3 | 15 / 72 | 0 | 66 |
| symbtr | loose | 100 | 0.0% | 82.9% | 82.3% | 79.5% | – | 1199 / 53 | 16 / 72 | 0 | 72 |
| symbtr | rough | 100 | 0.0% | 58.4% | 57.9% | 52.6% | – | 2506 / 80 | 10 / 72 | 0 | 81 |

What it says so far:

- **With little imprecision the quantizer is reliable.** Played exactly, Essen and our own corpus come back
  perfect; played tightly, 99–100 % of onsets are in place.
- **It invents tuplets when the playing is loose.** From `loose` on, notes a little early or late become tuplets:
  167 onsets in Essen, which has almost none, and over a thousand in SymbTr. A cost that prefers the division of
  the neighbouring beats (#108) is the obvious answer.
- **The last note, and notes played short, lose their length.** A note played shorter than written becomes a
  shorter note plus a rest when nothing follows it (the end of a phrase or piece), so durations fall faster than
  onsets.
- **Grace notes are rarely found again once they are played.** Only 39 of SymbTr's 72 çarpmas come back as grace
  notes even played exactly, and few at the other levels: a short note just before the beat is taken as a note on
  a fine division. In makam practice the çarpma takes its time from the next note, on the beat, which a later
  version of the performance should model too.
- **SymbTr is harder even played exactly**:
  - its sextuplets of sixteenths (174 notes of 1/6 beat) get mixed with other divisions;
  - its very short ornaments sit at the limit of the divisions searched.
- **Spelling is right wherever the source names its notes** (Essen and our own: 100 %). SymbTr's names are
  microtonal and are not compared yet.
