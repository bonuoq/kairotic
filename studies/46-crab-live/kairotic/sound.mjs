// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 46 · crab live: the sound, a note at a time. Two organ registrations (Studies 38–43): a
// principal for your voice, a flute for the engine's, in a small room.
//
//   const s = synth()          (its AudioContext is made on the first call that needs it)
//   s.note(midi, seconds, 0 | 1)   0: yours, 1: the engine's
//   s.resume() · s.ctx

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function synth() {
  let ctx = null, waves = null, master = null;
  function make() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const wave = (ps) => { const re = new Float32Array(ps.length + 1), im = new Float32Array(ps.length + 1); ps.forEach((a, i) => { im[i + 1] = a; }); return ctx.createPeriodicWave(re, im); };
    waves = [wave([1, 0.55, 0.32, 0.22, 0.1, 0.12, 0.04, 0.06]), wave([1, 0.18, 0.05, 0.02])];
    const comp = ctx.createDynamicsCompressor(), dry = ctx.createGain(), wet = ctx.createGain(), conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    conv.buffer = ir; master = ctx.createGain(); master.gain.value = 0.9; dry.gain.value = 0.8; wet.gain.value = 0.3;
    master.connect(dry).connect(comp); master.connect(conv).connect(wet).connect(comp); comp.connect(ctx.destination);
  }
  return {
    get ctx() { return ctx; },
    resume() { if (!ctx) make(); if (ctx.state === "suspended") return ctx.resume(); return Promise.resolve(); },
    note(midi, seconds, which = 0) {
      if (midi == null) return;
      if (!ctx) make();
      const a = ctx.currentTime + 0.01, b = a + Math.max(0.1, seconds);
      const o = ctx.createOscillator(), g = ctx.createGain(), level = 0.12;
      o.setPeriodicWave(waves[which % 2]); o.frequency.setValueAtTime(mtof(midi), a);
      g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(level, a + 0.03);
      g.gain.setValueAtTime(level, b - 0.05); g.gain.linearRampToValueAtTime(0, b + 0.04);
      o.connect(g).connect(master); o.start(a); o.stop(b + 0.08);
    }
  };
}
