// about: a two-operator FM voice played by freq and gate (a reader's list of Hz sets freq and gate = 1)
import("stdfaust.lib");
freq = hslider("freq", 220, 20, 4000, 0.01);
gate = button("gate");
ratio = hslider("ratio", 2, 0.25, 8, 0.01);
index = hslider("index", 1.5, 0, 10, 0.01) : si.smoo;
env = en.adsr(0.01, 0.2, 0.5, 0.6, gate);
modulator = os.osc(freq * ratio) * index * freq * env;
process = os.osc(freq + modulator) * env * 0.3;
