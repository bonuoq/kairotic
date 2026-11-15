// SPDX-License-Identifier: MPL-2.0
// Kairotic · Studies 38 to 41: the canon's sound. Two sustained voices, legato, so the counterpoint can be heard:
// an organ (two registrations, a principal for the dux and a flute for the comes) or two sung voices (a sawtooth
// through the formants of a vowel, with a slow vibrato), in a small room.
//
//   play({voices: [[midi | null, …], …], beat: seconds per note, timbre: "organ" | "voices"})
//   → {ctx, t0, beat, length, stop()}   (t0: when the first note sounds, in ctx time)
//
// A note lasts its whole beat and joins the next one (legato). In Study 41 a note repeated is held (a tie).

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function registration(ctx, partials) {
  const real = new Float32Array(partials.length + 1), imag = new Float32Array(partials.length + 1);
  partials.forEach((a, i) => { imag[i + 1] = a; });
  return ctx.createPeriodicWave(real, imag);
}

function room(ctx, seconds = 2.2) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds), ir = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  return conv;
}

const VOWELS = { a: [[730, 1], [1090, 0.5], [2440, 0.25]], o: [[570, 1], [840, 0.45], [2410, 0.2]] };

export function play({ voices, beat = 0.6, timbre = "organ" }) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  master.gain.value = 0.9; dry.gain.value = 0.8; wet.gain.value = timbre === "organ" ? 0.35 : 0.28;
  const rev = room(ctx);
  master.connect(dry).connect(comp); master.connect(rev).connect(wet).connect(comp); comp.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.1;
  const waves = timbre === "organ"
    ? [registration(ctx, [1, 0.55, 0.32, 0.22, 0.1, 0.12, 0.04, 0.06]),     // principal 8' with some 4' and 2'
       registration(ctx, [1, 0.18, 0.05, 0.02])]                              // flute 8'
    : null;
  const level = 0.22 / Math.max(1, voices.length);
  let length = 0;

  voices.forEach((line, vi) => {
    length = Math.max(length, line.length);
    // notes as [start, end, midi]: legato, a repeated note struck again
    const events = [];
    line.forEach((m, i) => {
      if (m === null || m === undefined) return;
      const last = events[events.length - 1];
      // Study 41: the same pitch on the next beat is the note held (a tie), not struck again
      if (last && last.end === i && last.midi === m) { last.end = i + 1; return; }
      events.push({ start: i, end: i + 1, midi: m });
    });
    events.forEach((e, ei) => {
      const next = events[ei + 1];
      const a = t0 + e.start * beat;
      const joined = next && next.start === e.end && next.midi !== e.midi;
      const b = t0 + e.end * beat - (next && next.start === e.end && next.midi === e.midi ? 0.07 : 0) + (joined ? 0.035 : 0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, a);
      if (timbre === "organ") {
        const o = ctx.createOscillator();
        o.setPeriodicWave(waves[vi % 2]);
        o.frequency.setValueAtTime(mtof(e.midi), a);
        g.gain.linearRampToValueAtTime(level, a + 0.03);
        g.gain.setValueAtTime(level, b);
        g.gain.linearRampToValueAtTime(0, b + 0.06);
        o.connect(g); o.start(a); o.stop(b + 0.1);
      } else {
        const o = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(mtof(e.midi), a);
        lfo.frequency.value = 5 + vi * 0.4;
        depth.gain.setValueAtTime(0, a);
        depth.gain.linearRampToValueAtTime(mtof(e.midi) * 0.006, a + 0.35);
        lfo.connect(depth).connect(o.frequency);
        const mix = ctx.createGain(); mix.gain.value = 1;
        for (const [f, amp] of VOWELS[vi % 2 ? "o" : "a"]) {
          const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 6;
          const ga = ctx.createGain(); ga.gain.value = amp * 2.2;
          o.connect(bp).connect(ga).connect(mix);
        }
        g.gain.linearRampToValueAtTime(level * 1.4, a + 0.08);
        g.gain.setValueAtTime(level * 1.4, b);
        g.gain.linearRampToValueAtTime(0, b + 0.1);
        mix.connect(g); o.start(a); lfo.start(a); o.stop(b + 0.15); lfo.stop(b + 0.15);
      }
      g.connect(master);
    });
  });
  return { ctx, t0, beat, length, stop: () => ctx.close() };
}
