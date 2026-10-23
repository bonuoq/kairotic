// SPDX-License-Identifier: MPL-2.0
// Shapes (:curve, :group, :hit), the draw box, and @kairotic/theory (pcclock, fourier, tonnetz). In the app
// loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 20000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};
const printed = (page) => cljs(page, "(pr-str (map second (:prints @eng/rt)))");
// what reached a print box, waiting a moment for it (a message may be due an instant later)
const printedHas = (page, ...xs) => until(page, "(pr-str (map second (:prints @eng/rt)))", (p) => xs.every((x) => p.includes(x)), 3000);

export async function theory(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the theory tests", false); return; }
  await cljs(page, "(stop)");
  // shapes
  const curve = await cljs(page, "(shp/svg [[:curve {:points [[0 0] [10 5] [20 0]] :stroke :accent}]])");
  check("shapes: a :curve is a smooth path", curve.includes(" C"), curve);
  const grp = await cljs(page, "(shp/svg [[:group {:x 10 :y 5 :rotate 90} [[:circle {:cx 0 :cy 0 :r 3}]]]])");
  check("... a :group moves and turns its shapes", grp.includes("translate(10,5) rotate(90)") && grp.includes("<circle"), grp);
  const hits = await cljs(page, `[(shp/hit-at [[:rect {:x 0 :y 0 :w 50 :h 50 :hit :back}] [:group {:x 20 :y 20 :hit :g} [[:circle {:cx 0 :cy 0 :r 5}]]]] [21 19])
                                 (shp/hit-at [[:rect {:x 0 :y 0 :w 50 :h 50 :hit :back}] [:group {:x 20 :y 20 :hit :g} [[:circle {:cx 0 :cy 0 :r 5}]]]] [40 40])
                                 (shp/hit-at [[:group {:x 30 :y 0 :rotate 90} [[:rect {:x 0 :y 0 :w 20 :h 4 :hit :bar}]]]] [28 10])
                                 (shp/hit-at [[:circle {:cx 5 :cy 5 :r 3}]] [5 5])]`);
  check("... and :hit finds the shape pressed (on top, inside groups, turned)", hits === "[:g :back :bar nil]", hits);
  // a press near a small part finds it too (within 10 px), the nearest one; a part shown alone to highlight it
  const near = await cljs(page, `[(shp/hit-near [[:circle {:cx 10 :cy 10 :r 3 :hit :a}] [:circle {:cx 40 :cy 10 :r 3 :hit :b}]] [18 12])
                                  (shp/hit-near [[:circle {:cx 10 :cy 10 :r 3 :hit :a}] [:circle {:cx 40 :cy 10 :r 3 :hit :b}]] [33 10])
                                  (shp/hit-near [[:circle {:cx 10 :cy 10 :r 3 :hit :a}]] [30 30])
                                  (shp/hit-near [[:group {:x 50 :y 50 :hit :g} [[:circle {:cx 0 :cy 0 :r 3}]]]] [58 50])
                                  (count (shp/only-hit [[:rect {:hit :x}] [:group {} [[:circle {:hit :y}] [:line {:hit :x}]]]] :x))]`);
  check("hit-near: the nearest part within 10 px, nothing farther; only-hit keeps that part", near === "[:a :b nil :g 2]", near);

  // draw
  const d = (await cljs(page, '(box "draw 200 100" 7000 100)')).trim();
  const out = (await cljs(page, '(box "print" 7000 260)')).trim();
  await cljs(page, `(connect ${d} 0 ${out} 0)`);
  await cljs(page, `(send! ${d} [:circle {:cx 20 :cy 20 :r 8 :fill :accent :hit :sun}])
                    (send! ${d} [:circle 60 20 8 :kairos :hit :moon])
                    (send! ${d} [:set :label :text 10 90 "hello"])`);
  const shown = await until(page, `(mapv first (second (last-shown ${d})))`, (x) => x === "[:circle :circle :text]", 4000);
  check("draw keeps the shapes that arrive (also as a msg writes them)", shown === "[:circle :circle :text]", shown);
  await cljs(page, `(send! ${d} [:set :label [:text {:x 10 :y 90} "again"]])`);
  check("... [:set k …] replaces the shape called k", (await until(page, `(mapv first (second (last-shown ${d})))`, (x) => x === "[:circle :circle :text]" , 3000)) === "[:circle :circle :text]");
  const sh = await cljs(page, `(let [b (get-in (current) [:boxes ${d}])] (count (filter (fn [f] (= :circle (first f))) (ctl-shapes* (ctl-m ${d} b) b))))`);
  check("... and draws them", sh === "2", sh);
  await cljs(page, `(send! ${d} [:pressed :moon])`);
  check("... pressing a shape with :hit sends it", (await until(page, "(pr-str (map second (:prints @eng/rt)))", (x) => x.includes(":moon"), 3000)).includes(":moon"), await printed(page));
  await cljs(page, `(send! ${d} :clear)`);
  check("... clear empties it", (await until(page, `(count (second (last-shown ${d})))`, (x) => x === "0", 3000)) === "0");

  // @kairotic/theory
  const pc = (await cljs(page, '(box "pcclock" 7300 100)')).trim();
  const loaded = await until(page, '(boolean (comp/lookup "pcclock"))', (g) => g === "true");
  check("pcclock brings @kairotic/theory", loaded === "true", loaded);
  const fo = (await cljs(page, '(box "fourier" 7600 100)')).trim();
  const tz = (await cljs(page, '(box "tonnetz" 7300 360)')).trim();
  const p2 = (await cljs(page, '(box "print" 7300 640)')).trim();
  await cljs(page, `(connect ${pc} 0 ${p2} 0) (connect ${tz} 0 ${p2} 0) (connect ${tz} 1 ${p2} 0)`);
  await cljs(page, `(swap! eng/rt assoc :prints []) (send! ${pc} [60 64 67])`);
  check("pcclock: a major triad is the set (0 4 7)", (await until(page, `(:set (second (last-shown ${pc})))`, (x) => x === "[0 4 7]", 3000)) === "[0 4 7]");
  check("... whose prime form is (0 3 7)", (await printedHas(page, "[0 3 7]")).includes("[0 3 7]"), await printed(page));
  await cljs(page, `(send! ${pc} [0 3 6 9])`);
  const axes = await until(page, `(let [b (get-in (current) [:boxes ${pc}])] (count (filter (fn [f] (and (= :line (first f)) (= :kairos (:stroke (second f))))) (ctl-shapes* (ctl-m ${pc} b) b))))`, (x) => x === "4", 3000);
  check("... a diminished seventh has four axes of symmetry", axes === "4", axes);
  await cljs(page, `(send! ${fo} [0 4 8])`);
  const f3 = await until(page, `(let [[a b] (get-in (second (last-shown ${fo})) [:f 2])] (js/Math.round (* 100 (js/Math.hypot a b))))`, (x) => x === "100", 3000);
  check("fourier: the augmented triad is wholly triadic (|f3| = 1)", f3 === "100", f3);
  await cljs(page, `(swap! eng/rt assoc :prints []) (send! ${tz} [60 64 67]) (send! ${tz} [60 63 67]) (send! ${tz} [60 63 68])`);
  const tri = await printedHas(page, ":C", ":cm", ":Ab");
  check("tonnetz: C, c, A♭ are named as they come", tri.includes(":C") && tri.includes(":cm") && tri.includes(":Ab"), tri);
  check("... and make a path of three triads", (await until(page, `(count (:path (second (last-shown ${tz}))))`, (x) => x === "3", 3000)) === "3");
  await cljs(page, `(swap! eng/rt assoc :prints []) (send! ${tz} [:pressed 7])`);
  check("... pressing a node sends its pitch class", (await printedHas(page, "7")).includes("7"), await printed(page));
  await cljs(page, `(delete ${d} ${out} ${pc} ${fo} ${tz} ${p2})`);
}
