// SPDX-License-Identifier: MPL-2.0
// scale (@kairotic/controls), control (@kairotic/io) and learn (app/page/22-learn.cljs), discussion #135:
// scale maps straight and in equal ratios, glides with ms, learns its input range; control picks one
// controller out of midiin's events; (learn :bN) wires the next controller that moves — a fake MIDI CC, a
// fake gamepad's stick — to a knob through midiin/gamepad → control → scale, in the knob's range.
// In the audio app of tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};
const nums = (s) => (s.match(/-?\d+(\.\d+)?/g) || []).map(Number);

export async function learn(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the learn tests", false); return; }
  await cljs(page, "(stop)");
  await page.evaluate(() => {
    const input = new EventTarget(); input.name = "Fake in";
    const access = new EventTarget(); access.inputs = new Map([["in1", input]]); access.outputs = new Map();
    window.kairoticMidi = Promise.resolve(access);
    window.__cc = (n, v) => input.dispatchEvent(Object.assign(new Event("midimessage"), { data: new Uint8Array([0xb0, n, v]) }));
    window.kairoticFakePads = [{ index: 0, id: "Fake pad", mapping: "standard", axes: [0, 0, 0, 0],
                                 buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }];
  });
  const X = 10200;
  await cljs(page, `(comp/define! "lsink" {:io [1 0] :receive (fn [{:keys [value state]}] {:state (conj (or state []) value)})})`);

  // scale
  const sc = (await cljs(page, `(box "scale 0 1 220 880 log" ${X} 100)`)).trim();
  const known = await until(page, '(boolean (comp/lookup "scale"))', (x) => x === "true", 20000);
  check("writing scale brings @kairotic/controls 0.2.0", known === "true", known);
  const sk = (await cljs(page, `(box "lsink" ${X} 160)`)).trim();
  await cljs(page, `(connect ${sc} 0 ${sk} 0) (play)`);
  await page.waitForTimeout(300);
  await cljs(page, `(send! ${sc} 0.5) (send! ${sc} [:lx 1]) (send! ${sc} {:value 0}) (send! ${sc} 7)`);
  let got = await until(page, `(get-in @eng/rt [:states ${sk}])`, (x) => nums(x).length >= 4);
  check("scale log: 0.5 is 440 (equal ratios), [:lx 1] 880, {:value 0} 220, beyond the range clipped",
        JSON.stringify(nums(got)) === "[440,880,220,880]", got);
  const gl = (await cljs(page, `(box "scale 0 1 0 100 300" ${X + 200} 100)`)).trim();
  const sk2 = (await cljs(page, `(box "lsink" ${X + 200} 160)`)).trim();
  await cljs(page, `(connect ${gl} 0 ${sk2} 0)`);
  await page.waitForTimeout(300);
  await cljs(page, `(send! ${gl} 0)`);
  await page.waitForTimeout(100);
  await cljs(page, `(send! ${gl} 1)`);
  got = await until(page, `(get-in @eng/rt [:states ${sk2}])`, (x) => nums(x).includes(100), 4000);
  const g = nums(got);
  check("scale with ms glides: steps between 0 and 100, rising, ending at 100", g.length > 5 && g[0] === 0 && g[g.length - 1] === 100 && g.every((v, i) => i === 0 || v >= g[i - 1]), got);
  const ln = (await cljs(page, `(box "scale 0 1 0 1" ${X + 400} 100)`)).trim();
  const sk3 = (await cljs(page, `(box "lsink" ${X + 400} 160)`)).trim();
  await cljs(page, `(connect ${ln} 0 ${sk3} 0)`);
  await page.waitForTimeout(200);
  await cljs(page, `(send! ${ln} :learn) (send! ${ln} 10) (send! ${ln} 20) (send! ${ln} [:learn :off]) (send! ${ln} 15) (send! ${ln} 25)`);
  got = await until(page, `(get-in @eng/rt [:states ${sk3}])`, (x) => nums(x).length >= 4);
  check("scale learn: the values seen make the range (10…20): 15 is 0.5, 25 is clipped to 1", JSON.stringify(nums(got).slice(-2)) === "[0.5,1]", got);

  // control
  const mi = (await cljs(page, `(box "midiin" ${X} 300)`)).trim();
  await until(page, '(boolean (comp/lookup "control"))', (x) => x === "true", 20000);
  const ct = (await cljs(page, `(box "control cc 74" ${X} 350)`)).trim();
  const sk4 = (await cljs(page, `(box "lsink" ${X} 400)`)).trim();
  await cljs(page, `(connect ${mi} 2 ${ct} 0) (connect ${ct} 0 ${sk4} 0) (stop) (play)`);
  await until(page, `(:label (second (last-shown ${mi})))`, (x) => x.includes("1 in"), 6000);
  await page.evaluate(() => { window.__cc(1, 127); window.__cc(74, 127); window.__cc(74, 0); });
  got = await until(page, `(get-in @eng/rt [:states ${sk4}])`, (x) => nums(x).length >= 2);
  check("control cc 74 picks that controller out of midiin's events, and nothing else", JSON.stringify(nums(got)) === "[1,0]", got);
  const osc = await cljs(page, `((:receive (comp/lookup "control")) {:value {:type :osc :address "/synth/1/cut" :args [0.3]} :args (comp/args-for (comp/lookup "control") "control osc /synth/*/cut")})`);
  check("control osc: an address pattern with *, its first number", osc.includes("[[0 0.3]]"), osc);

  // learn: a CC to a knob, in its range
  await cljs(page, `(delete ${mi} ${ct} ${sk4}) (stop)`);
  const kn = (await cljs(page, `(box "knob 20 20000 log" ${X + 600} 400)`)).trim();
  await until(page, '(boolean (comp/lookup "knob"))', (x) => x === "true", 20000);
  await cljs(page, `(learn ${kn})`);
  check("learn waits, saying so", (await cljs(page, '(boolean (and @learn-state (not (.-hidden ($ "learn-pop")))))')) === "true");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__cc(1, 64));
  const made = await until(page, `(sort (map :text (vals (:boxes (current)))))`, (x) => x.includes("control cc 1 1"), 4000);
  check("moving CC 1 wires it: midiin → control cc 1 1 → scale 0 1 20 20000 log",
        made.includes('"midiin"') && made.includes('"control cc 1 1"') && made.includes('"scale 0 1 20 20000 log"'), made);
  check("... learn stops waiting", (await cljs(page, "@learn-state")) === "nil");
  const lines = await cljs(page, `(let [p (current) id (fn [t] (some (fn [[k b]] (when (= t (:text b)) k)) (:boxes p)))]
                                   [(some #(= % [(id "midiin") 2 (id "control cc 1 1") 0]) (:lines p))
                                    (some #(= % [(id "control cc 1 1") 0 (id "scale 0 1 20 20000 log") 0]) (:lines p))
                                    (some #(= % [(id "scale 0 1 20 20000 log") 0 ${kn} 0]) (:lines p))])`);
  check("... connected in that order, into the knob", lines === "[true true true]", lines);
  await cljs(page, "(play)");
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__cc(1, 127));
  const kv = await until(page, `(second (last-shown ${kn}))`, (x) => nums(x).some((v) => Math.abs(v - 20000) < 1), 4000);
  check("... and the controller moves the knob, across its whole range", nums(kv).some((v) => Math.abs(v - 20000) < 1), kv);

  // learn, only for me: nothing in the work, kept in this browser, played as my gesture
  await cljs(page, "(stop)");
  const before = await cljs(page, "(count (:boxes (current)))");
  await cljs(page, `(learn ${kn} :me)`);
  check("the banner asks for whom, here only for me", (await cljs(page, '(boolean (.querySelector js/document "input[name=learn-scope][value=me]:checked"))')) === "true");
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__cc(7, 64));
  const mineNow = await until(page, "(my-controls)", (x) => x.includes("cc 7 1"), 4000);
  check("only for me: the mapping is mine (my-controls)", mineNow.includes(`"cc 7 1" ${kn}`), mineNow);
  check("... and nothing was added to the work", (await cljs(page, "(count (:boxes (current)))")) === before);
  check("... kept in this browser for this work", (await cljs(page, '(boolean (re-find #"cc" (str (.getItem js/localStorage (mine-key)))))')) === "true");
  await cljs(page, "(play)");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__cc(7, 64));
  const kv2 = await until(page, `(second (last-shown ${kn}))`, (x) => nums(x).some((v) => Math.abs(v - 652) < 3), 4000);
  check("... and moving CC 7 plays the knob (log: 64 of 127 is about 652 Hz between 20 and 20000)", nums(kv2).some((v) => Math.abs(v - 652) < 3), kv2);
  check("forget-control :all forgets them", (await cljs(page, "(forget-control :all)")) === "[]");
  await cljs(page, "(stop) (reset! learn-scope :work)");

  // learn: a gamepad's stick
  await cljs(page, "(stop)");
  const n2 = (await cljs(page, `(box "number" ${X + 800} 400)`)).trim();
  await cljs(page, `(learn ${n2})`);
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.kairoticFakePads[0].axes[2] = 0.9; });
  const made2 = await until(page, `(sort (map :text (vals (:boxes (current)))))`, (x) => x.includes("control pad rx"), 4000);
  check("a gamepad's stick: gamepad → control pad rx → scale -1 1 0 1", made2.includes('"gamepad"') && made2.includes('"control pad rx"') && made2.includes('"scale -1 1 0 1"'), made2);
  await cljs(page, "(learn false)");

  await cljs(page, "(stop)");
  const ids = await cljs(page, `(vec (keys (:boxes (current))))`);
  const mine = nums(ids.replace(/:b/g, " ")).filter((n) => n >= 0);
  await cljs(page, `(apply delete (for [[k b] (:boxes (current)) :when (#{"midiin" "gamepad" "lsink" "knob 20 20000 log" "number"} (:text b))] k))
                    (apply delete (for [[k b] (:boxes (current)) :when (re-find #"^(scale|control)" (:text b))] k))`);
  await page.evaluate(() => { delete window.kairoticMidi; window.kairoticFakePads = null; });
}
