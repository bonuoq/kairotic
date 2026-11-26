// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 75 · the voice (discussion #467): a glottal source through the tract.
// The source is a train of glottal pulses (the derivative of a KLGLOTT88 flow: open for `open` of each period, then a
// sharp closure), softened by a spectral tilt, with a little vibrato; its loudness is AV. The tract is a cascade of
// four formant resonators — Klatt's (1980) two-pole resonator, unity gain at 0 Hz, so the formants' heights come out
// right by themselves. noise.dsp sends its aspiration through the same four resonators, at the same F and B.
import("stdfaust.lib");

sm = si.smooth(ba.tau2pole(0.003));
pitch = hslider("pitch", 60, 24, 96, 0.01) : sm;
AV = hslider("AV", 0, 0, 1, 0.001) : sm;
vibrato = hslider("vibrato [unit:cents]", 25, 0, 100, 1);
open = hslider("open", 0.6, 0.3, 0.9, 0.01);
tilt = hslider("tilt [unit:Hz]", 3000, 500, 8000, 1);
F1 = hslider("F1 [unit:Hz]", 500, 150, 1200, 1) : sm;
F2 = hslider("F2 [unit:Hz]", 1500, 500, 3000, 1) : sm;
F3 = hslider("F3 [unit:Hz]", 2500, 1500, 4000, 1) : sm;
F4 = hslider("F4 [unit:Hz]", 3500, 2500, 5000, 1) : sm;
B1 = hslider("B1 [unit:Hz]", 80, 30, 500, 1) : sm;
B2 = hslider("B2 [unit:Hz]", 100, 30, 500, 1) : sm;
B3 = hslider("B3 [unit:Hz]", 150, 30, 500, 1) : sm;
B4 = hslider("B4 [unit:Hz]", 200, 30, 500, 1) : sm;

// Klatt's resonator: y = a x + b y[n-1] + c y[n-2]
res(f, bw) = fi.tf2(a, 0, 0, -b, -c) with {
  T = 1.0 / ma.SR;
  c = 0 - exp(-2 * ma.PI * bw * T);
  b = 2 * exp(-ma.PI * bw * T) * cos(2 * ma.PI * f * T);
  a = 1 - b - c;
};
tract = res(F1, B1) : res(F2, B2) : res(F3, B3) : res(F4, B4);

f0 = ba.midikey2hz(pitch + vibrato / 100 * os.osc(5.5));
glottal = pulse(os.phasor(1, f0)) with {
  pulse(p) = select2(p < open, 0, 2 * x - 3 * x * x) with { x = p / open; };
};
source = glottal - 0.5 * open : fi.dcblocker : fi.lowpass(1, tilt);
process = source * AV * 0.5 : tract;
