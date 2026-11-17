// SPDX-License-Identifier: MPL-2.0
// ring~'s core (core/kairotic/ringcore.mjs), sample by sample: in Node (node tests/ringcore.mjs), and in CI
// from tests/ringaudio.mjs (run() → [[label ok] …])
import { RingCore } from "../core/kairotic/ringcore.mjs";

export function run() {
const results = [];
const is = (what, ok) => results.push([what, !!ok]);
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const SR = 1000;

// runs n samples: in0 the ring's input (a function of the sample index), ins[s] = [value fn, position fn] for
// the slots; returns the outputs of the slots
function run(c, n, in0, ins = {}, from = 0) {
  const S = c.slots.length;
  const inputs = [[Float32Array.from({ length: n }, (_, i) => (in0 ? in0(from + i) : 0))]];
  for (let s = 0; s < S; s++) {
    const f = ins[s];
    inputs.push(f ? [Float32Array.from({ length: n }, (_, i) => (f[0] ? f[0](from + i) : 0)),
                     Float32Array.from({ length: n }, (_, i) => (f[1] ? f[1](from + i) : 0))] : []);
  }
  const outputs = Array.from({ length: S }, () => [new Float32Array(n)]);
  c.process(inputs, outputs);
  return outputs.map((o) => o[0]);
}
const impulse = (i) => (i === 0 ? 1 : 0);
const crossings = (a) => { let c = 0; for (let i = 1; i < a.length; i++) if ((a[i - 1] < 0) !== (a[i] < 0)) c++; return c; };
const sine = (hz) => (i) => Math.sin(2 * Math.PI * hz * i / SR);

// the ring's own head and readers that follow it
{
  const c = new RingCore(SR, 2);
  c.attach(0, { role: "read", d: 0.1 }); c.attach(3, { role: "read", d: 0.25 });
  const o = run(c, 400, impulse);
  is("a reader~ 0.1 s behind the ring's head: the impulse 100 samples later", near(o[0][100], 1) && o[0].reduce((s, v) => s + Math.abs(v), 0) < 1.000001);
  is("another in another slot, 0.25 s behind: a canon in three voices", near(o[3][250], 1));
  is("an empty slot is silent", o[1].every((v) => v === 0));
}
{
  const c = new RingCore(SR, 4);
  c.attach(0, { role: "read", d: 0.05, speed: 0.5 });
  const o = run(c, 2000, sine(20));
  const inC = crossings(Float32Array.from({ length: 1000 }, (_, i) => sine(20)(i)));
  is("speed 0.5: it falls behind and sounds an octave down", Math.abs(crossings(o[0].slice(400, 1400)) - inC / 2) <= 1);
}
{
  const c = new RingCore(SR, 2);
  c.attach(0, { role: "read", d: 0.1, jump: 0.25 });
  run(c, 500, sine(5));
  c.set(0, { d: 0.15 }); run(c, 10, sine(5), 500);
  is("a small new d glides at a second per second", near(c.slots[0].dc, 0.11, 1e-9));
  c.set(0, { d: 0.9 }); run(c, 5, sine(5), 510);
  is("a larger one seeks, crossfaded", near(c.slots[0].dc, 0.9) && c.slots[0].old != null);
}
// a reader~ moved by a position signal
{
  const c = new RingCore(SR, 1);
  c.attach(0, { role: "read", mode: "pos" });
  const o = run(c, 1600, (i) => (i < 1000 ? i / 1000 : 0), { 0: [null, (i) => (i < 1000 ? 0 : 0.999 - (i - 1000) / 1000)] });
  const back = Array.from(o[0].slice(1050, 1550));
  is("a reader~ at a position signal going back: what was written, reversed", back.every((v, i) => i === 0 || v <= back[i - 1] + 1e-6) && back[0] > 0.9 && back[back.length - 1] < 0.5);
}
{
  const c = new RingCore(SR, 1);
  c.attach(0, { role: "read", mode: "pos", norm: true });
  const ph = (i) => ((i % 500) / 500);   // a phasor~ at 2 Hz: 0…1 twice a second
  const o = run(c, 2000, (i) => (i < 1000 ? 0.5 : 0), { 0: [null, ph] });
  is("norm and a phasor~: it wraps and goes on, no seek", c.slots[0].old == null && near(o[0][1100], 0.5, 1e-6) && near(o[0][1300], 0.5, 1e-6));
}
// writers
{
  const c = new RingCore(SR, 0.5);
  c.attach(1, { role: "write" });
  c.attach(0, { role: "read", d: 0.1 });
  const o = run(c, 300, () => 0.2, { 1: [() => 0.7, null] });
  is("a writer~ at the ring's head (ovr): what it writes replaces the ring's input", near(o[0][200], 0.7));
}
{
  const c = new RingCore(SR, 0.5);
  c.attach(1, { role: "write", write: "mix" });
  c.attach(0, { role: "read", d: 0.1 });
  const o = run(c, 300, () => 0.2, { 1: [() => 0.3, null] });
  is("mix: added to what the ring writes (an overdub)", near(o[0][200], 0.5));
}
{
  const c = new RingCore(SR, 1);
  c.attach(0, { role: "write", mode: "pos" });
  c.buf.fill(0.5, 0, c.N);
  // the ring's input is silent and erases where its head goes: look only where its head has not been yet
  run(c, 300, null, { 0: [() => 0.9, (i) => 0.6 + i / 1000 * 0.5] });
  is("a writer~ at a position signal writes where the signal says, as it goes", near(c.buf[650], 0.9) && near(c.buf[740], 0.9) && near(c.buf[800], 0.5));
}
{
  const c = new RingCore(SR, 1);
  c.attach(0, { role: "write", mode: "pos", jump: 0.25 });
  c.buf.fill(0.5, 0, c.N);
  run(c, 2, null, { 0: [() => 0.9, (i) => (i === 0 ? 0.4 : 0.9)] });
  is("a writer~ whose position jumps further than jump writes nothing between (a seek)", near(c.buf[600], 0.5) && (near(c.buf[899], 0.9) || near(c.buf[900], 0.9)));
}
{
  const c = new RingCore(SR, 1);
  c.attach(0, { role: "write" });
  c.buf.fill(0.5, 0, c.N);
  run(c, 100);
  c.cue(0, "ovr", 0.5);
  run(c, 100, null, { 0: [() => 0, null] }, 100);
  is(":ovr t: from t at speed 1, replacing what it passes (silence too)", near(c.buf[520], 0) && near(c.buf[590], 0) && near(c.buf[700], 0.5));
  c.cue(0, "rec", 0.2);
  is(":rec t: the ring is erased first", c.buf.every((v) => v === 0));
}
// feedback inside the node: exact, as Study 48
{
  const c = new RingCore(SR, 1);
  c.attach(0, { role: "read", d: 0.1 });
  const o = run(c, 400, impulse);
  is("the ring keeps it: met again only after a turn", near(o[0][100], 1) && o[0].slice(101, 400).every((v) => near(v, 0)));
}
{
  const c = new RingCore(SR, 2);
  c.attach(0, { role: "read", d: 0.5 });
  run(c, 2500, () => 0.5);
  const s = c.state();
  is("the state: where the heads are", near(s.head, 0.5) && Math.min(s.slots[0].p, 2 - s.slots[0].p) < 0.002 && s.slots[1] === null);
}

{
  const c = new RingCore(SR, 1);
  c.message({ own: false });
  c.attach(0, { role: "write", mode: "pos" });
  run(c, 100, null, { 0: [() => 0.9, (i) => 0.5 + i / 1000] });
  c.detach(0);
  run(c, 1000, null, {}, 100);
  is("own: false (nothing on the ring's left): its head does not erase what a writer~ wrote", near(c.buf[550], 0.9));
}

return results;
}

if (import.meta.url === "file://" + process.argv[1]) {
  const results = run(), bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  process.exitCode = bad.length ? 1 : 0;
}
