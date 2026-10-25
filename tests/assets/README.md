# Test sounds

Served with the tests (`_site/tests/assets/`), so tests and examples can load them by URL:
`(sample! :b4 {:url "tests/assets/a440.wav"})`.

- `a440.wav` — one second of a sine at 440 Hz, amplitude 0.5, 22 050 Hz, 16 bits, mono. Made by
  `core/kairotic/sounds.mjs` (`wav`); dedicated to the public domain (CC0).
- `data.json` — a small JSON document for `fetch` and `edn` (tests/data.mjs).
