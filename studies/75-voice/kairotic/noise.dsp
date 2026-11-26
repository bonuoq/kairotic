// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 75 · the noise (discussion #467): the consonants' breath, beside the voice.
// Aspiration (AH: h, and the aspirated stops φ θ χ after their burst) goes through the same four formant
// resonators as the voice, at the same F and B, so it sounds as the vowel it leads into. Frication (AF: σ, ζ) and a
// stop's burst (AB) come from a narrower place in the mouth: a band of noise at FC with bandwidth FB.
import("stdfaust.lib");

sm = si.smooth(ba.tau2pole(0.003));
AH = hslider("AH", 0, 0, 1, 0.001) : sm;
AF = hslider("AF", 0, 0, 1, 0.001) : sm;
AB = hslider("AB", 0, 0, 1, 0.001) : si.smooth(ba.tau2pole(0.0005));
FC = hslider("FC [unit:Hz]", 4000, 500, 8000, 1) : sm;
FB = hslider("FB [unit:Hz]", 2000, 200, 6000, 1) : sm;
F1 = hslider("F1 [unit:Hz]", 500, 150, 1200, 1) : sm;
F2 = hslider("F2 [unit:Hz]", 1500, 500, 3000, 1) : sm;
F3 = hslider("F3 [unit:Hz]", 2500, 1500, 4000, 1) : sm;
F4 = hslider("F4 [unit:Hz]", 3500, 2500, 5000, 1) : sm;
B1 = hslider("B1 [unit:Hz]", 80, 30, 500, 1) : sm;
B2 = hslider("B2 [unit:Hz]", 100, 30, 500, 1) : sm;
B3 = hslider("B3 [unit:Hz]", 150, 30, 500, 1) : sm;
B4 = hslider("B4 [unit:Hz]", 200, 30, 500, 1) : sm;

res(f, bw) = fi.tf2(a, 0, 0, -b, -c) with {
  T = 1.0 / ma.SR;
  c = 0 - exp(-2 * ma.PI * bw * T);
  b = 2 * exp(0 - ma.PI * bw * T) * cos(2 * ma.PI * f * T);
  a = 1 - b - c;
};
tract = res(F1, B1) : res(F2, B2) : res(F3, B3) : res(F4, B4);

aspiration = no.noise * AH * 0.25 : fi.highpass(1, 300) : tract;
fricative = no.noise * (AF + 2 * AB) * 0.6 : fi.resonbp(FC, FC / FB, 1);
process = aspiration + fricative;
