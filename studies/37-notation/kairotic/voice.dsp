// Study 37 · a voice to be written by descriptors: no envelope of its own (the loudness lane is its
// envelope), every slider smoothed so it can move while it sounds. pitch and gain are set directly from
// their lanes; wave, noise, cutoff and resonance are what the realiser chooses to give the brightness and
// the noisiness asked for.
import("stdfaust.lib");
pitch = hslider("pitch", 60, 36, 84, 0.01) : si.smoo;
gain = hslider("gain [unit:dB]", -12, -80, 6, 0.1) : ba.db2linear : si.smoo;
wave = hslider("wave", 0.5, 0, 1, 0.001) : si.smoo;
noise = hslider("noise", 0.1, 0, 1, 0.001) : si.smoo;
cutoff = hslider("cutoff [scale:log] [unit:Hz]", 1000, 60, 14000, 1) : si.smoo;
resonance = hslider("resonance [scale:log]", 1, 0.5, 8, 0.01) : si.smoo;
f0 = ba.midikey2hz(pitch);
osc = os.sawtooth(f0) * (1 - wave) + os.square(f0) * wave;
src = osc * (1 - noise) + no.noise * noise;
process = src : fi.svf.lp(min(cutoff, 0.45 * ma.SR), resonance) * gain;
