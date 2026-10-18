// SPDX-License-Identifier: MPL-2.0
// Issue #32: a double-click on a numeric control (a number box, a knob, any component whose :gesture gives
// numbers, the sliders of a code box) opens a field to type its value. Enter applies it as the gesture a
// drag leaves in the history; Esc closes it with no change; what is not a number is refused.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === expected) return got; await page.waitForTimeout(50); }
  return got;
};

const settled = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// the centre of a box's body on screen (right of its grip), scrolled into view first
const centre = async (page, n) => {
  await page.waitForFunction((n) => document.querySelector('#scene .box[data-box="' + n + '"] rect.body'), n, { timeout: 10000 });
  await page.evaluate((n) => document.querySelector('#scene .box[data-box="' + n + '"] rect.body')
    .scrollIntoView({ block: "center", inline: "center" }), n);
  await settled(page);
  return page.evaluate((n) => {
    const r = document.querySelector('#scene .box[data-box="' + n + '"] rect.body').getBoundingClientRect();
    return [r.x + r.width / 2 + 4, r.y + r.height / 2];
  }, n);
};

const field = (page) => page.evaluate(() => {
  const f = document.getElementById("num-edit");
  return f ? { value: f.value, bad: f.classList.contains("bad"), focused: document.activeElement === f } : null;
});

// double-clicks a box and waits for the field (it opens once the click has ended)
const openOn = async (page, n) => {
  const [x, y] = await centre(page, n);
  await page.mouse.dblclick(x, y);
  await page.waitForSelector("#num-edit", { timeout: 3000 }).catch(() => {});
  return field(page);
};

export async function numinput(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the number input tests", false); return; }

  // what can be typed
  const parsed = await cljs(page, '(mapv typed-number ["440" " -3.5 " ".25" "0,5" "3/2" "1e-3" "abc" "1/0" "" "1,5,3" "1e999"])');
  check("typed numbers: integers, decimals (point or comma), ratios, exponents; nothing else",
    parsed === "[440 -3.5 0.25 0.5 1.5 0.001 nil nil nil nil nil]", parsed);
  const written = await cljs(page, "(mapv typed-str [440 0.0005 (/ 1 3) -2.5])");
  check("a typed number is written as typed, up to six decimals", written === '["440" "0.0005" "0.333333" "-2.5"]', written);
  const clamped = await cljs(page, "(mapv (fn [v] (param-typed-value {:min 40 :max 2000} v)) [5000 10 440])");
  check("a value typed into a slider stays between its min and max", clamped === "[2000 40 440]", clamped);

  const events = "(depth-of (norm (:pos @world)))";
  const state = (id) => `(get-in @eng/rt [:states ${id}])`;

  // ── a number box ──
  const n = (await cljs(page, '(box "number 2" 1700 1500)')).trim();
  const nn = n.slice(1);
  let f = await openOn(page, nn);
  check("a double-click on a number box opens a field with its value", f && f.value === "2" && f.focused, JSON.stringify(f));
  if (f) {
    await page.fill("#num-edit", "3,25");
    await page.press("#num-edit", "Enter");
    check("Enter sends the number typed", (await until(page, state(n), "3.25")) === "3.25", await cljs(page, state(n)));
    check("... and closes the field", (await field(page)) === null);

    // what is not a number: the field stays open and says so; Esc closes it, nothing changes
    f = await openOn(page, nn);
    await page.fill("#num-edit", "abc");
    await page.press("#num-edit", "Enter");
    f = await field(page);
    check("a text that is not a number is refused, the field stays open", f && f.bad, JSON.stringify(f));
    await page.press("#num-edit", "Escape");
    check("Esc closes the field", (await field(page)) === null);
    check("... and the number is unchanged", (await cljs(page, state(n))) === "3.25", await cljs(page, state(n)));

    // Esc after typing a valid number: nothing is sent
    await openOn(page, nn);
    await page.fill("#num-edit", "9");
    await page.press("#num-edit", "Escape");
    await page.waitForTimeout(150);
    check("Esc does not send what was typed", (await cljs(page, state(n))) === "3.25", await cljs(page, state(n)));
  }

  // ── a knob: its value stays in its text, as after a drag; its own :receive keeps it in range ──
  const ready = await until(page, '(some? (comp/lookup "knob"))', "true", 20000);
  check("the knob class is there (@kairotic/controls)", ready === "true", ready);
  const k = (await cljs(page, '(box "knob 0 1000 100" 1700 1600)')).trim();
  const kn = k.slice(1);
  const kv = await cljs(page, `(some-> (ctl-number (fid ${k}) (get-in (current) [:boxes ${k}])) typed-str)`);
  check("a knob's gesture gives numbers: it can be typed", kv === '"100"', kv);
  const kb = (await cljs(page, '(box "keyboard" 1900 1600)')).trim();
  check("a keyboard's gesture gives notes, not numbers: a double-click plays it as before",
    (await cljs(page, `(ctl-number (fid ${kb}) (get-in (current) [:boxes ${kb}]))`)) === "nil");
  f = await openOn(page, kn);
  check("a double-click on a knob opens a field with its value", f && f.value === "100", JSON.stringify(f));
  if (f) {
    const before = Number(await cljs(page, events));
    await page.fill("#num-edit", "440");
    await page.press("#num-edit", "Enter");
    const t = await until(page, `(:text (get-in (current) [:boxes ${k}]))`, '"knob 0 1000 440"');
    check("the typed value stays in the knob's text", t === '"knob 0 1000 440"', t);
    // its value as the knob holds it: what it shows, or the initial value of its text (rewriting the text
    // gives the box a new node, so its engine state starts empty, as after a drag)
    const kval = `(some-> (ctl-number (fid ${k}) (get-in (current) [:boxes ${k}])) typed-str)`;
    check("... it is its value now", (await until(page, kval, '"440"')) === '"440"', await cljs(page, kval));
    check("... as one event of the history, as a drag", Number(await cljs(page, events)) === before + 1, await cljs(page, events));

    await openOn(page, kn);
    await page.fill("#num-edit", "5000");
    await page.press("#num-edit", "Enter");
    const t2 = await until(page, `(:text (get-in (current) [:boxes ${k}]))`, '"knob 0 1000 1000"');
    check("a value past its max is kept at its max, as the knob itself keeps it", t2 === '"knob 0 1000 1000"', t2);
  }

  await cljs(page, `(delete ${n} ${k} ${kb})`);
}
