// SPDX-License-Identifier: MPL-2.0
// Sound from outside and back into messages: an osc~ through snapshot~ and scope~, and adc~ with the fake
// microphone of the test browser (tests/browser.mjs launches Chromium with a fake capture device).
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function audioin(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the audio input tests", false); return; }
  const osc = (await cljs(page, '(box "osc~ 220" 3000 100)')).trim();
  const snap = (await cljs(page, '(box "snapshot~ 50 peak" 3000 160)')).trim();
  const scope = (await cljs(page, '(box "scope~ 20" 3200 160)')).trim();
  const adc = (await cljs(page, '(box "adc~ 1" 3000 300)')).trim();
  const level = (await cljs(page, '(box "snapshot~ 1000 peak" 3000 360)')).trim();
  await cljs(page, `(connect ${osc} 0 ${snap} 0) (connect ${osc} 0 ${scope} 0) (connect ${adc} 0 ${level} 0)`);
  await cljs(page, "(play)");
  const running = await until(page, '(= "running" (.-state (eng/ctx)))', (g) => g === "true", 5000);
  check("the engine sounds in the test browser", running === "true", running);

  const peak = await until(page, `(get-in @eng/rt [:states ${snap}])`, (g) => Number(g) > 0.9);
  check("snapshot~ peak: the level of an osc~ comes back as a number", Number(peak) > 0.9 && Number(peak) <= 1.001, peak);
  const pts = await until(page, `(count (:pts (second (last-shown ${scope}))))`, (g) => g === "320");
  check("scope~ shows a picture: a min and a max for each of 160 columns", pts === "320", pts);
  const svg = await cljs(page, `(boolean (re-find #"polyline" (str (.-innerHTML ($ "cursors")))))`);
  check("... drawn in the patch", svg === "true", svg);

  const mic = await until(page, `(get-in @eng/rt [:states ${level}])`, (g) => Number(g) > 0, 10000);
  const printed = await cljs(page, '(pr-str (filter (fn [[_ v]] (re-find #"adc~" (str v))) (:prints @eng/rt)))');
  check("adc~: the (fake) microphone is heard", Number(mic) > 0, mic + " " + printed);

  await cljs(page, `(text! ${snap} "snapshot~ 50")`);
  const value = await until(page, `(get-in @eng/rt [:states ${snap}])`, (g) => g !== "nil" && Math.abs(Number(g)) <= 1);
  check("snapshot~ without a word sends values between -1 and 1", value !== "nil" && Math.abs(Number(value)) <= 1, value);

  await cljs(page, "(stop)");
  await until(page, "(eng/running?)", (g) => g === "false", 2000);
  await page.waitForTimeout(2300);
  check("the microphone is closed a moment after the engine stops", (await cljs(page, "(nil? @kairotic.input/mic)")) === "true");
  await cljs(page, `(delete ${osc} ${snap} ${scope} ${adc} ${level})`);
}
