// SPDX-License-Identifier: MPL-2.0
// @kairotic/io (discussion #135, Study 34): writing midiin brings the package; with ▶, MIDI from a fake
// input becomes events, Hz and voice ids; midiout sends them to a fake output as MPE (a channel per note,
// the bend before the note-on, a bend for a glide); oscout writes them as /kairotic/… to a fake bridge,
// oscin takes what the bridge brings when its address matches; a fake gamepad, a phone's tilt and a fake
// serial port become events too. Nothing here needs a device: the page's MIDI, OSC sockets, pads and serial
// port are stood in for where the components look for them.
// In the audio app of tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};
const js = (page, f, a) => page.evaluate(f, a);
// the same, for what the page keeps in JavaScript (the stand-ins' records), as JSON
const untilJs = async (page, f, ok, ms = 4000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await page.evaluate(f); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function io(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the io tests", false); return; }
  await cljs(page, "(stop)");

  // the stand-ins: a MIDI input and output, the OSC bridge's socket, a serial port
  await js(page, () => {
    const input = new EventTarget(); input.name = "Fake in"; input.id = "in1";
    window.__midiSent = [];
    const output = { name: "Fake out", id: "out1", send: (b, ts) => window.__midiSent.push(Array.from(b)) };
    const access = new EventTarget(); access.inputs = new Map([["in1", input]]); access.outputs = new Map([["out1", output]]);
    window.kairoticMidi = Promise.resolve(access);
    window.__midiIn = (bytes) => input.dispatchEvent(Object.assign(new Event("midimessage"), { data: new Uint8Array(bytes) }));
    window.__oscSent = [];
    const url = "ws://localhost:8765/osc";
    try { localStorage.removeItem("kairotic-osc-relay"); } catch (e) {}
    window.kairoticOsc = { [url]: { ws: { readyState: 1, send: (j) => window.__oscSent.push(JSON.parse(j)) }, listeners: [], queue: [] } };
    window.__oscIn = (f) => window.kairoticOsc[url].listeners.forEach((l) => l(f));
    window.__serialSent = [];
    const port = {
      open: async () => {}, close: async () => {},
      readable: new ReadableStream({ start(c) { window.__serialPush = (t) => c.enqueue(new TextEncoder().encode(t)); } }),
      writable: new WritableStream({ write(ch) { window.__serialSent.push(new TextDecoder().decode(ch)); } }),
    };
    Object.defineProperty(navigator, "serial", { value: { requestPort: async () => port }, configurable: true });
    window.kairoticFakePads = [];
  });

  const X = 9000;
  const mi = (await cljs(page, `(box "midiin" ${X} 100)`)).trim();
  const known = await until(page, '(boolean (comp/lookup "midiin"))', (x) => x === "true", 20000);
  check("writing midiin brings @kairotic/io into the work", known === "true", known);
  if (known !== "true") { await cljs(page, `(delete ${mi})`); return; }
  check("... with its help patch", (await cljs(page, '(boolean (:example (hlp/of "midiin")))')) === "true");
  const mo = (await cljs(page, `(box "midiout mpe" ${X} 200)`)).trim();
  const oo = (await cljs(page, `(box "oscout" ${X + 150} 200)`)).trim();
  const oi = (await cljs(page, `(box "oscin /synth/*" ${X + 300} 100)`)).trim();
  const gp = (await cljs(page, `(box "gamepad" ${X + 450} 100)`)).trim();
  const mt = (await cljs(page, `(box "motion 0" ${X + 600} 100)`)).trim();
  const se = (await cljs(page, `(box "serial 9600" ${X + 750} 100)`)).trim();
  // what reaches the sink, in order (print gives its lines to the console while ▶ runs)
  await cljs(page, `(comp/define! "iosink" {:io [1 0] :receive (fn [{:keys [value state]}] {:state (conj (or state []) value)})})`);
  const pr = (await cljs(page, `(box "iosink" ${X} 320)`)).trim();
  const printed = `(get-in @eng/rt [:states ${pr}])`;
  const printedHas = (page, ...xs) => until(page, printed, (p) => xs.every((x) => p.includes(x)), 4000);
  await cljs(page, `(connect ${mi} 0 ${mo} 0) (connect ${mi} 1 ${mo} 1) (connect ${mi} 2 ${oo} 0) (connect ${mi} 2 ${pr} 0)
                    (connect ${oi} 0 ${pr} 0) (connect ${gp} 1 ${pr} 0) (connect ${mt} 0 ${pr} 0) (connect ${se} 0 ${pr} 0)`);
  check("their inlets and outlets", (await cljs(page, `[(io (get-in (current) [:boxes ${mi}])) (io (get-in (current) [:boxes ${mo}])) (io (get-in (current) [:boxes ${oi}]))]`)) === "[[1 3] [2 0] [1 2]]");

  // oscout works without ▶: a list that starts with an address goes as it is
  await cljs(page, `(send! ${oo} ["/synth/freq" 440 "saw"])`);
  const pre = await untilJs(page, () => JSON.stringify(window.__oscSent), (x) => x.includes("/synth/freq"));
  check("oscout sends a list with an address, with or without ▶", pre.includes('{"address":"/synth/freq","args":[440,"saw"]}'), pre);

  await cljs(page, "(play)");
  const ready = await until(page, `(:label (second (last-shown ${mi})))`, (x) => x.includes("1 in"), 8000);
  check("with ▶, midiin finds the input", ready.includes("1 in"), ready);
  const setup = await until(page, "(.-length js/window.__midiSent)", (x) => Number(x) >= 78, 4000);
  check("midiout mpe announces the zone and the bend ranges at ▶ (3 + 15 × 5 messages)", Number(setup) === 78, setup);

  // a note in, through the patch: an event, Hz and ids to midiout (MPE), the event to oscout
  await js(page, () => window.__midiIn([0x90, 60, 100]));
  const note = await printedHas(page, ":type :note, :id 60, :ch 1, :note 60, :freq 261.626, :amp 0.787, :gate true");
  check("a note in is an event with its Hz", note.includes(":freq 261.626"), note);
  const midiSent = () => JSON.stringify(window.__midiSent.slice(78));
  let s = await untilJs(page, midiSent, (x) => x.includes("[145,60,100]"));
  check("midiout: its own channel (2), the bend before the note-on", s.startsWith("[[225,0,64],[145,60,100]"), s);
  const osc = await untilJs(page, () => JSON.stringify(window.__oscSent), (x) => x.includes("/kairotic/note"));
  check("oscout writes it as /kairotic/note id freq amp gate", osc.includes('{"address":"/kairotic/note","types":"iffi","args":[60,261.626,0.787,1]}'), osc);
  await js(page, () => window.__midiIn([0xe0, 0x7f, 0x7f]));
  s = await untilJs(page, midiSent, (x) => x.includes("[225,85,66]"));
  check("a bend in glides the note: out as a bend of its channel (+2 of 48 semitones)", s.includes("[225,85,66]"), s);
  check("... and the glide is an event", (await printedHas(page, ":type :glide, :id 60")).includes(":type :glide"));
  await js(page, () => window.__midiIn([0x80, 60, 0]));
  s = await untilJs(page, midiSent, (x) => x.includes("[129,60,0]"));
  check("the note-off ends it on its channel", s.includes("[129,60,0]"), s);
  await js(page, () => window.__midiIn([0xb0, 74, 127]));
  check("a controller is {:type :cc … :value 0…1}", (await printedHas(page, ":type :cc, :ch 1, :cc 74, :value 1")).includes(":cc 74"));

  // oscin: what the bridge brings, when its address matches the pattern
  await js(page, () => { window.__oscIn({ hello: { listen: 57121 } }); window.__oscIn({ address: "/other/x", args: [1] }); window.__oscIn({ address: "/synth/cut", args: [0.5, "lp"], from: "127.0.0.1:57120" }); });
  const oin = await printedHas(page, ':address "/synth/cut"');
  check("oscin: a matching address arrives as an event, with where it came from", oin.includes('{:src :osc, :from "127.0.0.1:57120", :type :osc, :address "/synth/cut", :args [0.5 "lp"]}'), oin);
  check("... and one that does not match does not", !(await cljs(page, printed)).includes("/other/x"));

  // a gamepad: connected, a button pressed
  await js(page, () => {
    const b = []; for (let i = 0; i < 17; i++) b.push({ pressed: false, value: 0 });
    window.kairoticFakePads = [{ index: 0, id: "Fake pad", mapping: "standard", axes: [0, 0, 0, 0], buttons: b }];
  });
  await page.waitForTimeout(200);
  await js(page, () => { window.kairoticFakePads[0].buttons[0] = { pressed: true, value: 1 }; window.kairoticFakePads[0].axes[0] = 1; });
  const pad = await printedHas(page, "[:a 1]", "[:lx 1]");
  check("gamepad: a button and a stick by name, as [name value]", pad.includes("[:a 1]") && pad.includes("[:lx 1]"), pad);

  // a phone's tilt
  await js(page, () => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta: 0, gamma: 45 })));
  const tilt = await printedHas(page, "[0.75 0.5]");
  check("motion: a tilt to the right is [0.75 0.5]", tilt.includes("[0.75 0.5]"), tilt);

  // a board on a serial port
  await cljs(page, `(send! ${se} :open)`);
  await until(page, `(:label (second (last-shown ${se})))`, (x) => x.includes("open"), 4000);
  await js(page, () => { window.__serialPush("pot:5"); window.__serialPush("12\r\n1 2 3\n"); });
  const ser = await printedHas(page, '["pot" 512]', "[1 2 3]");
  check("serial: its lines as [key value] and as numbers, even cut in two", ser.includes('["pot" 512]') && ser.includes("[1 2 3]"), ser);
  await cljs(page, `(send! ${se} "hello board")`);
  const wrote = await untilJs(page, () => JSON.stringify(window.__serialSent), (x) => x.includes("hello board"));
  check("... and a text goes to the board as a line", wrote.includes("hello board\\n"), wrote);

  // ■: midiout leaves nothing sounding (all notes off on every channel)
  await js(page, () => { window.__midiSent = []; });
  await cljs(page, "(stop)");
  const off = await until(page, "(.-length js/window.__midiSent)", (x) => Number(x) >= 16, 3000);
  check("■: midiout sends all-notes-off on its 16 channels", Number(off) === 16, off);

  await cljs(page, `(delete ${mi} ${mo} ${oo} ${oi} ${gp} ${mt} ${se} ${pr})`);
  await js(page, () => { delete window.kairoticMidi; delete window.kairoticOsc; window.kairoticFakePads = null; });
}
