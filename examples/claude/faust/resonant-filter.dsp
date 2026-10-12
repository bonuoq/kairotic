// about: a resonant low-pass filter for one signal; cutoff and q are parameters ([:cutoff 800], [:q 4])
import("stdfaust.lib");
cutoff = hslider("cutoff", 1200, 40, 12000, 1) : si.smoo;
q = hslider("q", 2, 0.5, 20, 0.01) : si.smoo;
process = fi.resonlp(cutoff, q, 1);
