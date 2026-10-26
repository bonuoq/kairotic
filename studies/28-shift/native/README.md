# Study 28 · the WebAssembly of stftPitchShift

*[Leer en castellano](README.es.md)*

[stftPitchShift](https://github.com/jurihock/stftPitchShift) by Jürgen Hock (C++, MIT licence) built for
the web without Emscripten: [wasi-sdk](https://github.com/WebAssembly/wasi-sdk) compiles a thin C entry
point (`shift.cpp`) into an 80 KB WebAssembly, and `glue.mjs` wraps it into one ES module with the
WebAssembly inside (`../kairotic/shift.mjs`). No fetch and no `atob`, so the same file works in a page,
in a worker and, later, in an AudioWorklet.

```sh
node studies/28-shift/native/build.mjs     # fetches stftPitchShift v2.0 and wasi-sdk 25 into .cache/ once
```

| File | What it is |
|---|---|
| `shift.cpp` | `ks_shift(sr, n, in, out, frame, hop, quefrency, distortion, normalize, steps, times, counts, factors)`: one channel, with a **schedule** of factors (they can change from one STFT frame to the next, through `StftPitchShiftCore::factors`), padded by a frame on each side so the output is as long as the input and its ends are not faded |
| `shim/StftPitchShift/Timer.h` | stands in for the library's timers, which bring all of iostream (200 KB) only to print measurements this build never asks for |
| `glue.mjs` | `ready()`, `shift(chans, sr, {steps \| factors, quefrency, timbre, frame, overlap, rms})`, `stepsOf`, `version`, `wasmModule` |
| `build.mjs` | the build: clang++ `--target=wasm32-wasip1 -mexec-model=reactor -O3 -fno-exceptions` |

Checked: compiled natively, `ks_shift` gives exactly the samples of the library's own
`StftPitchShift::shiftpitch` on the same padded input (difference 0). The library throws only on
wrong parameters; `shift.cpp` checks them first and returns a negative code, so a throw is unreachable
(this build has no exceptions).

Speed (one channel of a minute at 48 kHz, frame 1024, Node 22): overlap 8 about 2 s, 16 about 3.5 s,
32 (the library's default) about 7 s; with formants and three factors about 11 s at 32. SIMD and the
library's fast arctangent gain less than 15%, so the build stays plain.
