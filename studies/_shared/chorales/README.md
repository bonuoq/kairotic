# Bach's chorales, phrase by phrase

The corpus the chorale studies read (#301, #399): **2,272 phrases from the 370 chorales**, cut at the fermatas.

- `phrases.json` — `{source, license, phrases}`; a phrase is
  `{id, chorale, bwv, title, meter, key: {tonic, mode, church?}, cadence, satb, held, strong, A, B, lines}`:
  - `satb` — the four voices a quarter at a time, MIDI, soprano first: the note sounding on each quarter (the eighths
    between, passing and neighbour notes, are in `lines`);
  - `held` — for each quarter and voice, whether its note began before it (a half note, a tie);
  - `strong` — the quarters on a strong beat (1 and 3 in 4/4, the downbeat in 3/4);
  - `A`, `B` — the first and the last chord (the ends of a bridge, Study 63);
  - `key` — the chorale's key as the edition gives it (a church mode in `church`); `cadence` — the triad the phrase
    ends on, `null` when it is not a complete major or minor 5/3;
  - `lines` — each voice's notes in the phrase, `[onset in quarters, MIDI, quarters]`.
- `tools/kern.mjs` — the extractor: `node studies/_shared/chorales/tools/kern.mjs <the edition's kern/ dir>`.
  A voice entering late after a rest begins its phrase where all four sound; 5 phrases (chorales 43, 280 and 283)
  are left out, with a rest inside or too short.

**License:** `phrases.json` is CC BY-NC-SA 4.0, after Craig Sapp's edition — not the MPL-2.0 of the rest of the
repository. See [LICENSE.md](LICENSE.md).
