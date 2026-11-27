// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 75 · the voice (discussion #467): a glottal source through the tract.
// The source is a train of glottal pulses (the derivative of a KLGLOTT88 flow: open for `open` of each period, then a
// sharp closure), softened by a spectral tilt; its loudness is AV. A voice is never exactly periodic: its pitch
// wavers a little from cycle to cycle (jitter) and so does its loudness (shimmer), both slow random wanderings here;
// its vibrato comes in as a note is held (VD, from the curves: 0 at a note's start, 1 once it has lasted). The tract
// is a cascade of four formant resonators — Klatt's (1980) two-pole resonator, unity gain at 0 Hz, so the formants'
// heights come out right by themselves — and, before them, the nose: a pole at 270 Hz and a zero at FNZ (the
// antiformant of a nasal: where the mouth, closed, swallows the sound); away from a nasal FNZ is 270 too, and the two
// cancel. The singer's formant (ring) is a peak near 3 kHz, the brightness of a voice trained to carry over an
// orchestra (Sundberg); 0 for none. noise.dsp sends its aspiration through the same four resonators, at the same F
// and B.
import("stdfaust.lib");

sm = si.smooth(ba.tau2pole(0.003));
pitch = hslider("pitch", 60, 24, 96, 0.01) : sm;
AV = hslider("AV", 0, 0, 1, 0.001) : sm;
VD = hslider("VD", 1, 0, 1, 0.001) : si.smooth(ba.tau2pole(0.05));
vibrato = hslider("vibrato [unit:cents]", 25, 0, 100, 1);
jitter = hslider("jitter [unit:cents]", 8, 0, 50, 0.1);
shimmer = hslider("shimmer", 0.06, 0, 0.5, 0.001);
ring = hslider("ring", 0.3, 0, 1, 0.01);
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
FNZ = hslider("FNZ [unit:Hz]", 270, 200, 3000, 1) : sm;

// Klatt's resonator: y = a x + b y[n-1] + c y[n-2]; his antiresonator is its inverse, a zero
kc(bw) = 0 - exp(-2 * ma.PI * bw / ma.SR);
kb(f, bw) = 2 * exp(0 - ma.PI * bw / ma.SR) * cos(2 * ma.PI * f / ma.SR);
ka(f, bw) = 1 - kb(f, bw) - kc(bw);
res(f, bw) = fi.tf2(ka(f, bw), 0, 0, 0 - kb(f, bw), 0 - kc(bw));
antires(f, bw) = fi.tf2(1 / ka(f, bw), 0 - kb(f, bw) / ka(f, bw), 0 - kc(bw) / ka(f, bw), 0, 0);
nose = res(270, 100) : antires(FNZ, 100);
tract = nose : res(F1, B1) : res(F2, B2) : res(F3, B3) : res(F4, B4);
singer = _ <: _, (fi.resonbp(3000, 3, 1) : *(ring * 4)) :> _;

// slow random wanderings (noise low-passed at hz, brought back to about 1 in amplitude), for jitter and shimmer
wander(hz) = no.noise : fi.lowpass(2, hz) : *(1.7 * sqrt(ma.SR / (2 * hz)));
f0 = ba.midikey2hz(pitch + VD * vibrato / 100 * os.osc(5.5) + jitter / 100 * wander(12));
glottal = pulse(os.phasor(1, f0)) with {
  pulse(p) = select2(p < open, 0, 2 * x - 3 * x * x) with { x = p / open; };
};
source = glottal - 0.5 * open : fi.dcblocker : fi.lowpass(1, tilt);
process = source * AV * 0.5 * (1 + shimmer * wander(20)) : tract : singer;
