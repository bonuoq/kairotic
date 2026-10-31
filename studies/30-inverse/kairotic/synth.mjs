// Study 30 · the synth whose sounds the dataset is made of.
//
// A small subtractive voice written in plain JavaScript, sample by sample, so that the same parameters give
// the same samples in a browser, in a worker and in Node: the dataset can be made anywhere and is always
// reproducible from (parameters, seed). One note of DUR seconds, released at GATE seconds.
//
//   saw ↔ square (polyBLEP) ─┐
//                            ├─ mix ─→ lowpass (state variable, cutoff × envelope) ─→ × envelope ─→ out
//   white noise ─────────────┘
//
// Every parameter lives in [0, 1] (what a model predicts) and is mapped to its musical range here.

export const SR = 44100;
export const DUR = 1.0;   // seconds rendered
export const GATE = 0.65; // seconds until the note is released

// key, short doc, range and how [0, 1] is mapped onto it
export const PARAMS = [
  { key: "pitch",     doc: "note (MIDI)",                      min: 36,    max: 84,    scale: "lin", unit: "" },
  { key: "wave",      doc: "saw (0) ↔ square (1)",             min: 0,     max: 1,     scale: "lin", unit: "" },
  { key: "noise",     doc: "oscillator (0) ↔ noise (1)",       min: 0,     max: 1,     scale: "lin", unit: "" },
  { key: "cutoff",    doc: "lowpass cutoff",                   min: 60,    max: 14000, scale: "log", unit: "Hz" },
  { key: "resonance", doc: "lowpass Q",                        min: 0.5,   max: 14,    scale: "log", unit: "" },
  { key: "envamt",    doc: "envelope → cutoff, in octaves",    min: 0,     max: 6,     scale: "lin", unit: "oct" },
  { key: "attack",    doc: "attack",                           min: 0.002, max: 0.4,   scale: "log", unit: "s" },
  { key: "decay",     doc: "decay",                            min: 0.02,  max: 0.6,   scale: "log", unit: "s" },
  { key: "sustain",   doc: "sustain level",                    min: 0,     max: 1,     scale: "lin", unit: "" },
  { key: "release",   doc: "release",                          min: 0.02,  max: 0.3,   scale: "log", unit: "s" }
];

// [0, 1] → the parameter's own range
export function denorm(p, u) {
  u = Math.min(1, Math.max(0, u));
  return p.scale === "log" ? p.min * Math.pow(p.max / p.min, u) : p.min + (p.max - p.min) * u;
}
export function values(us) {
  const o = {};
  PARAMS.forEach((p, i) => { o[p.key] = denorm(p, us[i]); });
  return o;
}

// a small seeded generator (mulberry32): the same seed, the same noise and the same random patches
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the correction that takes the aliasing out of a naive saw or square at a discontinuity
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

// us: the parameters in [0, 1] (PARAMS order); seed: for the noise. Returns a Float32Array of DUR·SR samples.
export function render(us, seed = 1, sr = SR) {
  const v = values(us);
  const n = Math.round(DUR * sr), y = new Float32Array(n), rnd = rng(seed);
  const f0 = 440 * Math.pow(2, (v.pitch - 69) / 12), dt = f0 / sr;
  const k = 1 / v.resonance, nyq = 0.45 * sr, gateAt = Math.round(GATE * sr);
  const aStep = 1 / (v.attack * sr);
  const dCoef = Math.exp(-1 / (v.decay * sr / 4.6));   // ~1 % of the way left after `decay`
  const rCoef = Math.exp(-1 / (v.release * sr / 4.6));
  let ph = 0, env = 0, stage = 0, ic1 = 0, ic2 = 0;    // stage: 0 attack, 1 decay/sustain, 2 release
  for (let i = 0; i < n; i++) {
    // envelope
    if (i === gateAt) stage = 2;
    if (stage === 0) { env += aStep; if (env >= 1) { env = 1; stage = 1; } }
    else if (stage === 1) env = v.sustain + (env - v.sustain) * dCoef;
    else env *= rCoef;
    // oscillator
    const saw = 2 * ph - 1 - blep(ph, dt);
    let sq = ph < 0.5 ? 1 : -1;
    sq += blep(ph, dt) - blep((ph + 0.5) % 1, dt);
    ph += dt; if (ph >= 1) ph -= 1;
    const osc = (1 - v.wave) * saw + v.wave * sq;
    const x = (1 - v.noise) * osc + v.noise * (2 * rnd() - 1);
    // lowpass: a state-variable filter in its TPT form, stable while its cutoff moves
    const fc = Math.min(nyq, v.cutoff * Math.pow(2, v.envamt * env));
    const g = Math.tan(Math.PI * fc / sr);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    y[i] = Math.tanh(0.3 * v2 * env); // a soft ceiling, for high resonances
  }
  return y;
}

// a patch in Kairotic's own words would be its recipe; until the synth is a faust~ box, an EDN map of values
export function edn(us) {
  const v = values(us);
  return "{" + PARAMS.map((p) => ":" + p.key + " " + (+v[p.key].toPrecision(4))).join(" ") + "}";
}
