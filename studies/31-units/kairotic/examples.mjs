// Study 31 · examples, written as Faust code (what a faust~ box keeps); each opens as a patch.
const I = 'import("stdfaust.lib");\n\n';

export const EXAMPLES = [
  { key: "filtered", title: "Filtered noise", note: "A chain: noise, a lowpass whose cutoff is a parameter, a gain.",
    code: I + 'process = no.noise : fi.lowpass(2, hslider("cutoff", 800, 50, 5000, 1)) * 0.3;\n' },
  { key: "onepole", title: "A lowpass by hand (feedback)", note: "y = x·(1−a) + a·y′. The loop goes through a one-sample delay ('): in code it is ~.",
    code: I + 'a = hslider("pole", 0.99, 0, 0.999, 0.001);\nprocess = no.noise * (1 - a) : + ~ *(a) : *(0.5);\n' },
  { key: "fm", title: "FM", note: "One oscillator moves the frequency of another.",
    code: I + 'carrier = hslider("carrier", 330, 50, 1000, 1);\nratio = hslider("ratio", 1.5, 0.25, 8, 0.01);\nindex = hslider("index", 200, 0, 2000, 1);\nprocess = os.osc(carrier + os.osc(carrier * ratio) * index) * 0.2;\n' },
  { key: "echo", title: "Echo (a delay in a loop)", note: "Press hit: a burst of noise comes back, softer each time. The loop: @ (delay), × feedback, and the one-sample delay.",
    code: I + 'burst = no.noise * en.ar(0.001, 0.05, button("hit"));\ntime = hslider("delay", 11025, 1, 44100, 1);\nfeedback = hslider("feedback", 0.6, 0, 0.95, 0.01);\nprocess = burst : + ~ (@(time) : *(feedback)) : *(0.4);\n' },
  { key: "string", title: "Plucked string (Karplus-Strong)", note: "Noise into a delay as long as one period, averaged with itself one sample later: a string.",
    code: I + 'pluck = no.noise * en.ar(0.001, 0.004, button("pluck"));\nperiod = hslider("period", 100, 20, 400, 1);\ndamp = hslider("damping", 0.996, 0.9, 0.9999, 0.0001);\navg(x) = (x + x\') * 0.5;\nprocess = pluck : + ~ (@(period) : avg : *(damp)) : *(0.5);\n' },
  { key: "synth", title: "Study 30's synth", note: "The subtractive voice of Study 30 as a subpatch: saw ↔ square, noise, a resonant lowpass opened by the envelope. Press gate.",
    code: I + 'gate = button("gate");\nfreq = hslider("pitch", 48, 36, 84, 1) : ba.midikey2hz;\nwave = hslider("wave", 0.3, 0, 1, 0.01);\nnoise = hslider("noise", 0.1, 0, 1, 0.01);\ncutoff = hslider("cutoff", 600, 60, 14000, 1);\nres = hslider("resonance", 3, 0.5, 14, 0.01);\nenvamt = hslider("envamt", 3, 0, 6, 0.01);\nenv = en.adsr(hslider("attack", 0.01, 0.002, 0.4, 0.001), hslider("decay", 0.2, 0.02, 0.6, 0.001), hslider("sustain", 0.6, 0, 1, 0.01), hslider("release", 0.15, 0.02, 0.3, 0.001), gate);\nosc = os.sawtooth(freq) * (1 - wave) + os.square(freq) * wave;\nsrc = osc * (1 - noise) + no.noise * noise;\nfc = min(cutoff * 2 ^ (envamt * env), 18000);\nprocess = src : fi.resonlp(fc, res, 1) * env * 0.3;\n' },
  { key: "reverb", title: "A reverb (a box of code)", note: "re.stereo_freeverb is not one of the boxes: it stays as Faust code in its own box, with the inputs and outputs the compiler gives it.",
    code: I + 'hit = os.osc(220) * en.ar(0.01, 0.3, button("hit"));\nprocess = hit <: re.stereo_freeverb(0.7, 0.5, 0.5, 23);\n' }
];
