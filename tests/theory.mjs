// SPDX-License-Identifier: MPL-2.0
// Shapes (:curve, :group, :hit), the draw box, and @kairotic/theory (pcclock, fourier, tonnetz, comes). In the app
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

  // comes: counterpoint live (Study 40): a note a beat, corrected when it breaks a rule, and the comes answering
  const cm = (await cljs(page, '(box "comes midi" 7600 400)')).trim();
  const cp = (await cljs(page, '(box "print" 7600 480)')).trim();
  const cq = (await cljs(page, '(box "print" 7800 480)')).trim();
  await cljs(page, `(connect ${cm} 3 ${cp} 0) (connect ${cm} 0 ${cq} 0)`);
  check("comes has two inlets (notes, the pulse) and four outlets", (await cljs(page, `(io (get-in (current) [:boxes ${cm}]))`)) === "[2 4]");
  const st = (k) => `(get-in @eng/rt [:states ${cm} ${k}])`;
  await cljs(page, `(swap! eng/rt assoc :prints []) (send! ${cm} 62)`);
  check("comes: the first note waits for the futures to be counted, then is played",
    (await until(page, st(":D"), (x) => x === "[1]", 30000)) === "[1]", await cljs(page, `[${st(":D")} ${st(":error")}]`));
  await cljs(page, `(send! ${cm} 61)`);
  const fixed = await until(page, `(:reason (second (last-shown ${cm})))`, (x) => /not a note of the mode/.test(x), 3000);
  check("... a black key is corrected to a note of the mode, and it says why", /not a note of the mode/.test(fixed), fixed);
  await cljs(page, `(send! ${cm} 65) (send! ${cm} 67)`);
  const C = await until(page, st(":C"), (x) => /\d+\]$/.test(x), 3000);
  check("... from the fourth note on the comes answers (a canon: the first note, an octave below)", C.endsWith(" -6]"), C);
  check("... and sounds, as a list of Hz", (await until(page, "(pr-str (map second (:prints @eng/rt)))", (x) => x.includes("[146.8"), 3000)).includes("[146.8"));
  check("... the box shows the pair", (await cljs(page, `(:comes (second (last-shown ${cm})))`)) === '"D3"', await cljs(page, `(second (last-shown ${cm}))`));
  for (let i = 0; i < 11; i++) await cljs(page, `(send! ${cm} :engine)`);
  check("... engine plays on to the end of the canon", (await until(page, `(count ${st(":D")})`, (x) => x === "15", 5000)) === "15");
  check("... and it is finished: the next note begins a new canon", (await until(page, st(":idle"), (x) => x === "true", 3000)) === "true");
  await cljs(page, `(send! ${cm} :back)`);
  check("... back takes the last pair back", (await until(page, `(count ${st(":D")})`, (x) => x === "14", 3000)) === "14");
  await cljs(page, `(send! ${cm} :reset)`);
  check("... reset starts again", (await until(page, `(count ${st(":D")})`, (x) => x === "0", 3000)) === "0");
  // by turns, the same note again is held over the beat
  await cljs(page, `(send! ${cm} 62)`);
  await until(page, `(count ${st(":D")})`, (x) => x === "1", 3000);
  await cljs(page, `(send! ${cm} :hold)`);
  check("... hold holds the note over the beat (a tie)", (await until(page, st(":D"), (x) => x === "[1 1]", 3000)) === "[1 1]");
  // a parameter on the way: by turns, a new canon at once
  await cljs(page, `(send! ${cm} [:k -4])`);
  check("... [:k -4]: a new canon, the comes a 5th below", (await until(page, `[(count ${st(":D")}) (:k (:over (get-in @eng/rt [:states ${cm}])))]`, (x) => x === "[0 -4]", 20000)) === "[0 -4]");
  await cljs(page, `(delete ${cm} ${cp} ${cq})`);

  // live: a pulse is a beat, a note lasts until the next one; three pulses turn the canon to 3/2
  const lv = (await cljs(page, '(box "comes midi live" 7600 600)')).trim();
  const lp = (await cljs(page, '(box "print" 7600 680)')).trim();
  await cljs(page, `(connect ${lv} 3 ${lp} 0)`);
  const ls = (k) => `(get-in @eng/rt [:states ${lv} ${k}])`;
  await cljs(page, `(swap! eng/rt assoc :prints []) (send! ${lv} 62)`);
  await until(page, `(count (:cps (get-in @eng/rt [:states ${lv}])))`, (x) => x === "2", 30000);
  check("live: the canon is counted, in 2/2 and in 3/2", (await cljs(page, `(count (:cps (get-in @eng/rt [:states ${lv}])))`)) === "2");
  await cljs(page, `(send! ${lv} 1 :bang)`);
  check("live: the note struck is played on the pulse", (await until(page, ls(":D"), (x) => x === "[1]", 3000)) === "[1]");
  await cljs(page, `(send! ${lv} 1 :bang)`);
  check("... and held over the next one (a tie)", (await until(page, ls(":D"), (x) => x === "[1 1]", 3000)) === "[1 1]");
  await cljs(page, `(send! ${lv} 1 :bang)`);
  check("... held three pulses in 2/2: the canon turns to 3/2", (await until(page, ls(":meter"), (x) => x === "3", 3000)) === "3" &&
        (await cljs(page, `[${ls(":idle")} ${ls(":section")}]`)) === "[true 2]");
  // (D4: the dux begins on the final, its 5th or its octave; a note struck just after a pulse counts for it)
  await cljs(page, `(send! ${lv} 62) (send! ${lv} 1 :bang)`);
  check("... the next note begins a new canon, in 3/2", /^\[\[1( 1)?\] 3\]$/.test(await until(page, `[${ls(":D")} (.-beats ${ls(":cp")})]`, (x) => /^\[\[1\]|^\[\[1 1\] 3/.test(x), 5000)),
        await cljs(page, `[${ls(":D")} ${ls(":section")} ${ls(":idle")}]`));
  for (let i = 0; i < 4 && (await cljs(page, ls(":idle"))) !== "true"; i++) await cljs(page, `(send! ${lv} 1 :bang)`);
  check("... held longer than a bar: the end of the section", (await until(page, ls(":idle"), (x) => x === "true", 3000)) === "true" &&
        (await cljs(page, ls(":section"))) === "3");
  // end, from outside: the section ends
  await cljs(page, `(send! ${lv} 62) (send! ${lv} 1 :bang)`);
  await until(page, ls(":idle"), (x) => x === "false", 3000);
  const sec = Number(await cljs(page, ls(":section")));
  await cljs(page, `(send! ${lv} :end)`);
  check("... end, from an analysis: the section ends", (await until(page, ls(":idle"), (x) => x === "true", 3000)) === "true" &&
        Number(await cljs(page, ls(":section"))) === sec + 1);
  await cljs(page, `(delete ${lv} ${lp})`);

  // nocues: the meter and the sections are for other boxes; a note held too long makes the canon wait
  const nc = (await cljs(page, '(box "comes midi live nocues" 7600 760)')).trim();
  const ns = (k) => `(get-in @eng/rt [:states ${nc} ${k}])`;
  await cljs(page, `(send! ${nc} 62)`);
  await until(page, `(count (:cps (get-in @eng/rt [:states ${nc}])))`, (x) => x === "2", 30000);
  for (let i = 0; i < 4; i++) await cljs(page, `(send! ${nc} 1 :bang)`);
  check("nocues: held four pulses, no 3/2 and no end of section: the canon waits", (await until(page, `[${ns(":D")} (boolean ${ns(":idle")}) ${ns(":meter")}]`, (x) => x === "[[1 1] false nil]", 3000)) === "[[1 1] false nil]",
        await cljs(page, `[${ns(":D")} ${ns(":idle")} ${ns(":meter")}]`));
  await cljs(page, `(send! ${nc} [:beats 3])`);
  check("... and [:beats 3] from outside: 3/2 at the next section", (await cljs(page, ns(":meter"))) === "3");
  await cljs(page, `(delete ${nc})`);
}
