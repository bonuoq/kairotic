// Study 32 · a bank of patches that sound (discussion #114).
//
// Study 30 drew patches anywhere in the space, so about one in eleven was nearly silent (a cutoff far below
// the note) or a click (a short decay and no sustain). Their descriptors say almost nothing about most
// parameters (what does not sound has no pitch nor waveform), so they taught a model to average, and nobody
// would choose one as a target. Here such a patch is drawn again, from the same seeded generator: the bank
// keeps its size, it is still reproducible from its seed, and it counts what it left out. Noise is kept: it
// is a sound, and the synth's noise parameter is one of the things to find.

import { rng, render } from "../../30-inverse/kairotic/synth.mjs";
import { draw, analyse, header as header30 } from "../../30-inverse/kairotic/dataset.mjs";
import { pitchOf } from "./pitch.mjs";

export const MIN_PEAK = 0.01;   // the loudest frame's rms, at least
export const MIN_FRAMES = 4;    // frames above a tenth of that peak, at least (≈ 90 ms)

// why a patch is left out, from its descriptor frames: "silent", "click", or null (it sounds)
export function verdict(f) {
  let peak = 0;
  for (const r of f) if (r[0] > peak) peak = r[0];
  if (peak < MIN_PEAK) return "silent";
  let on = 0;
  for (const r of f) if (r[0] > 0.1 * peak && r[0] > 1e-3) on++;
  return on < MIN_FRAMES ? "click" : null;
}

const round = (x) => +x.toPrecision(5);

// the pitch YIN hears, as the network takes it: [MIDI pitch in the synth's range mapped to 0…1, or -1
// when there is none (noise), and how sure it is]
export function pitchFeature(y) {
  const p = pitchOf(y);
  return p.midi === null ? [-1, round(p.sure)] : [round((p.midi - 36) / 48), round(p.sure)];
}

// one example that sounds, and how many draws it took ({silent, click} left out on the way)
export function example(Meyda, seed, mode) {
  const rnd = rng(seed), left = { silent: 0, click: 0 };
  for (let tries = 0; tries < 50; tries++) {
    const u = draw(rnd, mode), y = render(u, seed);
    const f = analyse(Meyda, y);
    const v = verdict(f);
    if (!v) return { seed, u: u.map(round), f: f.map((r) => r.map(round)), p: pitchFeature(y), left };
    left[v]++;
  }
  throw new Error("no patch that sounds in 50 draws (seed " + seed + ")");
}

export function header(mode, seed, n) {
  const h = header30(mode, seed, n);
  h.kairotic = "study-32-learn";
  h.sampling.audible = { minPeak: MIN_PEAK, minFrames: MIN_FRAMES };
  h.analysis.pitch = { yin: "as pitch~: window 1024, threshold 0.15, 60–1500 Hz", p: "[(midi - 36) / 48 or -1, sure]" };
  return h;
}
