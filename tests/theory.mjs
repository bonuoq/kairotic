// SPDX-License-Identifier: MPL-2.0
// Shapes (:curve, :group, :hit), the draw box, @kairotic/theory (pcclock, fourier, tonnetz), @kairotic/cac (comes) and @kairotic/rhythm. In the app
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
  const pc = (await cljs(page, '(box "pcclock midi" 7300 100)')).trim();
  const loaded = await until(page, '(boolean (comp/lookup "pcclock"))', (g) => g === "true");
  check("pcclock brings @kairotic/theory", loaded === "true", loaded);
  const fo = (await cljs(page, '(box "fourier midi" 7600 100)')).trim();
  const tz = (await cljs(page, '(box "tonnetz midi" 7300 360)')).trim();
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
  // without midi, pitches are Hz, as a keyboard sends them
  const ph = (await cljs(page, '(box "pcclock" 7600 360)')).trim();
  // (sent again until the new box answers: a box just made may not be listening yet)
  const phSet = await until(page, `(do (send! ${ph} [261.63 329.63 392]) (:set (second (last-shown ${ph}))))`, (x) => x === "[0 4 7]", 5000);
  check("pcclock without midi: Hz (C4 E4 G4 from a keyboard) are the set (0 4 7)", phSet === "[0 4 7]", phSet);
  await cljs(page, `(send! ${ph} 0)`);
  check("... 0 Hz (a silence) is nothing", (await cljs(page, `(:set (second (last-shown ${ph})))`)) === "[0 4 7]");
  await cljs(page, `(delete ${d} ${out} ${pc} ${fo} ${tz} ${p2} ${ph})`);

  // comes: counterpoint live (Study 40): a note a beat, corrected when it breaks a rule, and the comes answering
  const cm = (await cljs(page, '(box "comes midi" 7600 400)')).trim();
  const cp = (await cljs(page, '(box "print" 7600 480)')).trim();
  const cq = (await cljs(page, '(box "print" 7800 480)')).trim();
  await cljs(page, `(connect ${cm} 3 ${cp} 0) (connect ${cm} 0 ${cq} 0)`);
  check("comes brings @kairotic/cac: two inlets (notes, the pulse) and five outlets", (await until(page, `(io (get-in (current) [:boxes ${cm}]))`, (x) => x === "[2 5]", 20000)) === "[2 5]");
  const st = (k) => `(get-in @eng/rt [:states ${cm} :fwd ${k}])`;
  await cljs(page, `(swap! eng/rt assoc :prints []) (send! ${cm} 62)`);
  check("comes: the first note waits for the futures to be counted, then is played",
    (await until(page, st(":D"), (x) => x === "[1]", 30000)) === "[1]", await cljs(page, `[${st(":D")} ${st(":error")}]`));
  await cljs(page, `(send! ${cm} 61)`);
  const fixed = await until(page, `(:reason (second (last-shown ${cm})))`, (x) => /not a note of the system/.test(x), 3000);
  check("... a black key is corrected to a note of the mode, and it says why", /not a note of the system/.test(fixed), fixed);
  await cljs(page, `(send! ${cm} 65) (send! ${cm} 67)`);
  const C = await until(page, st(":C"), (x) => /\d+\]$/.test(x), 3000);
  check("... from the fourth note on the comes answers (a canon: the first note, an octave below)", C.endsWith(" -6]"), C);
  check("... and sounds, both voices as a list of Hz (the dux, then the comes D3)", (await until(page, "(pr-str (map second (:prints @eng/rt)))", (x) => /146\.8\d*\]/.test(x), 3000)).match(/146\.8\d*\]/) !== null);
  // the voice ids: a note held keeps its id (it goes on sounding), a new note a new one; with the comes, two voices
  const ids = await cljs(page, `(let [d (comp/lookup "comes") st (get-in @eng/rt [:states ${cm}]) a (comp/args-for d (:text (get-in (current) [:boxes ${cm}])))
                                      go (fn [[s _] m] (let [r ((:receive d) {:inlet 0 :value m :state s :args a})] [(:state r) (:out r)]))
                                      steps (vec (rest (reductions go [st nil] [:reset 62 :hold 64 65 67])))
                                      ids (fn [i] (some (fn [[o v]] (when (= o 1) v)) (second (nth steps i))))
                                      hz (fn [i] (some (fn [[o v]] (when (= o 0) v)) (second (nth steps i))))]
                                  [(:D (:fwd (first (nth steps 2)))) (= (ids 1) (ids 2)) (not= (ids 2) (ids 3)) (count (ids 5)) (count (hz 5))])`);
  check("... with their voice ids (outlet 1): held over the beat the dux keeps its id, a new note a new one, and two voices once the comes enters",
        ids === "[[1 1] true true 2 2]", ids);
  // an event from a player (:hz, a list) is a note too
  const pev = await cljs(page, `(let [d (comp/lookup "comes") st (get-in @eng/rt [:states ${cm}]) a (comp/args-for d (:text (get-in (current) [:boxes ${cm}])))
                                      r ((:receive d) {:inlet 0 :value {:beat 3 :hz [329.63] :ids [64]} :state st :args a})]
                                  (count (:D (:fwd (:state r)))))`);
  check("... a player's event (:hz) plays as a note", pev === String(Number(await cljs(page, `(count ${st(":D")})`)) + 1), pev);
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
  check("... [:k -4]: a new canon, the comes a 5th below", (await until(page, `[(count ${st(":D")}) (:k (:over (get-in @eng/rt [:states ${cm} :fwd])))]`, (x) => x === "[0 -4]", 20000)) === "[0 -4]");
  await cljs(page, `(delete ${cm} ${cp} ${cq})`);

  // live: a pulse is a beat, a note lasts until the next one; three pulses turn the canon to 3/2
  const lv = (await cljs(page, '(box "comes midi live" 7600 600)')).trim();
  const lp = (await cljs(page, '(box "print" 7600 680)')).trim();
  await cljs(page, `(connect ${lv} 3 ${lp} 0)`);
  const ls = (k) => `(get-in @eng/rt [:states ${lv} :fwd ${k}])`;
  await cljs(page, `(swap! eng/rt assoc :prints []) (send! ${lv} 62)`);
  await until(page, `(count (:cps (get-in @eng/rt [:states ${lv} :fwd])))`, (x) => x === "2", 30000);
  check("live: the canon is counted, in 2/2 and in 3/2", (await cljs(page, `(count (:cps (get-in @eng/rt [:states ${lv} :fwd])))`)) === "2");
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
  const ns = (k) => `(get-in @eng/rt [:states ${nc} :fwd ${k}])`;
  await cljs(page, `(send! ${nc} 62)`);
  await until(page, `(count (:cps (get-in @eng/rt [:states ${nc} :fwd])))`, (x) => x === "2", 30000);
  for (let i = 0; i < 4; i++) await cljs(page, `(send! ${nc} 1 :bang)`);
  check("nocues: held four pulses, no 3/2 and no end of section: the canon waits", (await until(page, `[${ns(":D")} (boolean ${ns(":idle")}) ${ns(":meter")}]`, (x) => x === "[[1 1] false nil]", 3000)) === "[[1 1] false nil]",
        await cljs(page, `[${ns(":D")} ${ns(":idle")} ${ns(":meter")}]`));
  await cljs(page, `(send! ${nc} [:beats 3])`);
  check("... and [:beats 3] from outside: 3/2 at the next section", (await cljs(page, ns(":meter"))) === "3");
  await cljs(page, `(delete ${nc})`);

  // comes inverted: the comes upside down about D4
  const iv = (await cljs(page, '(box "comes midi 1 0 inverted" 7800 600)')).trim();
  const is_ = (k) => `(get-in @eng/rt [:states ${iv} :fwd ${k}])`;
  await cljs(page, `(send! ${iv} 62)`);
  await until(page, `(count ${is_(":D")})`, (x) => x === "1", 30000);
  for (const m of [64, 65, 67, 65]) await cljs(page, `(send! ${iv} ${m})`);
  const ivDC = await until(page, `[${is_(":D")} ${is_(":C")}]`, (x) => /^\[\[\d+ \d+ \d+ \d+ \d+\]/.test(x), 5000);
  const [ivD, ivC] = JSON.parse(ivDC.replace(/nil/g, "null").replace(/\] \[/, "],[").replace(/ /g, ","));
  check("comes inverted: the comes is the dux upside down about D, three beats later", ivC.every((c, t) => (t < 3 ? c === null : c === 2 - ivD[t - 3])), ivDC);
  await cljs(page, `(delete ${iv})`);

  // comes with a temperature and a seed: the same seed, the same game
  const ct = (await cljs(page, '(box "comes midi 1 -7 3 2 0.5" 7800 760)')).trim();
  await cljs(page, `(send! ${ct} 62)`);
  await until(page, `(some? (get-in @eng/rt [:states ${ct} :fwd :cp]))`, (x) => x === "true", 30000);
  const ctChance = await cljs(page, `(let [d (comp/lookup "comes") st (get-in @eng/rt [:states ${ct}]) a (comp/args-for d (:text (get-in (current) [:boxes ${ct}])))
                                          go (fn [s m] (:state ((:receive d) {:inlet 0 :value m :state s :args a})))
                                          play (fn [temp seed] (let [s (-> st (go [:temp temp]) (go [:seed seed]) (go :reset))]
                                                                 (loop [s s i 0] (if (< i 7) (recur (go s :engine) (inc i)) [(:D (:fwd s)) (:C (:fwd s))]))))]
                                      [(= (play 3 7) (play 3 7)) (> (count (distinct (map #(play 3 %) [1 2 3 4 5 6]))) 1)
                                       (= 1 (count (distinct (map #(play 0 %) [1 2 3]))))])`);
  check("comes [:temp 3]: the same seed plays the same game, others others; at 0 always the same", ctChance === "[true true true]", ctChance);
  await cljs(page, `(delete ${ct})`);

  // comes -1: a crab written from both ends to the middle, sent as a tree when it closes
  const cz = (await cljs(page, '(box "comes midi -1 -7 3 2 1 4" 8000 600)')).trim();
  const zp = (await cljs(page, '(box "print" 8000 680)')).trim();
  await cljs(page, `(connect ${cz} 0 ${zp} 0)`);
  const zs = (k) => `(get-in @eng/rt [:states ${cz} :crab ${k}])`;
  await cljs(page, `(send! ${cz} 62)`);
  check("comes -1: the first note waits for the futures, then is the note at the start", (await until(page, `(some? ${zs(":pending")})`, (x) => x === "true", 30000)) === "true");
  await cljs(page, `(send! ${cz} 62)`);
  check("... then the note at the end: a step written at both ends", (await until(page, zs(":s"), (x) => x === "1", 3000)) === "1" &&
        (await cljs(page, `[(first ${zs(":M")}) (last ${zs(":M")})]`)) === "[1 1]");
  for (let i = 0; i < 12 && (await cljs(page, `(:main (second (last-shown ${cz})))`)) !== null && !/closed/.test(await cljs(page, `(:sub (second (last-shown ${cz})))`)); i++)
    await cljs(page, `(send! ${cz} :engine)`);
  check("... the engine closes the work in the middle", /closed/.test(await cljs(page, `(:sub (second (last-shown ${cz})))`)), await cljs(page, `(second (last-shown ${cz}))`));
  check("... a crab: the comes is the dux backwards, an octave below", (await cljs(page, `(let [M ${zs(":M")}] (= (count M) 7))`)) === "true");
  const czTree = await cljs(page, `(let [d (comp/lookup "comes") st (get-in @eng/rt [:states ${cz}]) a (comp/args-for d (:text (get-in (current) [:boxes ${cz}])))
                                        s1 (:state ((:receive d) {:inlet 0 :value :back :state st :args a}))
                                        out (:out ((:receive d) {:inlet 0 :value :engine :state s1 :args a}))
                                        t (some (fn [[o v]] (when (= o 4) v)) out)]
                                    [(first t) (count (rest t)) (mapv first (rest t)) (get-in t [1 1 1])])`);
  check("... and as a score: both voices as a musical tree (outlet 4)", czTree === "[:piece 2 [:voice :voice] {:meter [2 2]}]", czTree);
  await cljs(page, `(send! ${cz} :back)`);
  check("... back: not closed any more", !/closed/.test(await cljs(page, `(:sub (second (last-shown ${cz})))`)));
  await cljs(page, `(delete ${cz} ${zp})`);

  // comes -1 live (Study 46): the crab played beat by beat — your note, and the end of your line answered
  const lz = (await cljs(page, '(box "comes midi live -1 -7 3 2 1 4" 8200 600)')).trim();
  const ls_ = (k) => `(get-in @eng/rt [:states ${lz} :crab ${k}])`;
  await cljs(page, `(send! ${lz} 62)`);
  check("comes -1 live: a note is a beat (no pulse): yours at the start, the box's at the end", (await until(page, ls_(":t"), (x) => x === "1", 30000)) === "1" &&
        (await cljs(page, `[(first ${ls_(":M")}) (last ${ls_(":M")})]`)) === "[1 1]",
        await cljs(page, `[(dissoc (get-in @eng/rt [:states ${lz} :crab]) :cp :mi :sig) (second (last-shown ${lz}))]`));
  for (const m of [64, 65, 64]) await cljs(page, `(send! ${lz} ${m})`);
  check("... at the middle the rest of the line is written: the score to read", (await until(page, ls_(":t"), (x) => x === "4", 3000)) === "4" &&
        (await cljs(page, `(every? some? ${ls_(":M")})`)) === "true");
  await cljs(page, `(send! ${lz} 50)`);
  check("... a note that is not the one written is said: a deviation", (await until(page, `(or ${ls_(":devs")} 0)`, (x) => x === "1", 3000)) === "1");
  check("... the box shows what to read next", /read:/.test(await cljs(page, `(:sub (second (last-shown ${lz})))`)));
  // the futuribles say beforehand what the box will answer at the end of your line (:end), and it does
  const endChk = await cljs(page, `(let [d (comp/lookup "comes") st (get-in @eng/rt [:states ${lz}])
                                         a (comp/args-for d (:text (get-in (current) [:boxes ${lz}])))
                                         r0 ((:receive d) {:inlet 0 :value :reset :state st :args a})
                                         opts (some (fn [[o v]] (when (= o 2) v)) (:out r0))
                                         o62 (first (filter #(= 62 (:midi %)) opts))
                                         r1 ((:receive d) {:inlet 0 :value 62 :state (:state r0) :args a})
                                         M (:M (:crab (:state r1)))]
                                     [(count opts) (every? :end opts) (:end o62) (.midi (:cp (:crab st)) (last M))])`);
  check("... its futuribles for the first note, each with :end, what the box will answer — and it does", /^\[\d+ true (\d+) \1\]$/.test(endChk), endChk);
  // the score to read, as a tree: from the middle what is left of your line, each beat read a rest; at the end the crab
  const lzTree = await cljs(page, `(let [d (comp/lookup "comes") st (get-in @eng/rt [:states ${lz}]) a (comp/args-for d (:text (get-in (current) [:boxes ${lz}])))
                                         go (fn [[s _] m] (let [r ((:receive d) {:inlet 0 :value m :state s :args a})] [(:state r) (:out r)]))
                                         steps (vec (reductions go [st nil] [:reset 62 64 65 64 64 64 64]))
                                         tree (fn [i] (some (fn [[o v]] (when (= o 4) v)) (second (nth steps i))))]
                                     [(tree 4) (first (tree 5)) (count (rest (tree 5))) (tree 6) (first (get-in (tree 5) [1 2])) (first (tree 8))])`);
  check("... the score to read as a tree (outlet 4, for a tree box): at the middle, then nothing more until the whole crab at the end",
        /^\[nil :voice 2 nil :note :piece\]$/.test(lzTree), lzTree);
  const lzSound = await cljs(page, `(let [d (comp/lookup "comes") st (get-in @eng/rt [:states ${lz}]) a (comp/args-for d (:text (get-in (current) [:boxes ${lz}])))
                                          go (fn [[s _] m] (let [r ((:receive d) {:inlet 0 :value m :state s :args a})] [(:state r) (:out r)]))
                                          steps (vec (rest (reductions go [st nil] [:reset 62 {:beat 1 :hz [329.63] :ids [64]}])))
                                          o (fn [i k] (some (fn [[p v]] (when (= p k) v)) (second (nth steps i))))]
                                      [(o 0 1) (count (o 1 1)) (count (o 1 0)) (count (:M (:crab (first (nth steps 1))))) (:t (:crab (first (nth steps 2))))])`);
  check("... live it sounds both voices with their voice ids (a reset lets them go); a player's event (:hz) is a note too",
        /^\[\[\] 2 2 7 2\]$/.test(lzSound), lzSound);
  // with a temperature the box draws among its answers, with its seed: the same seed, the same game
  const seeded = await cljs(page, `(let [d (comp/lookup "comes") st (get-in @eng/rt [:states ${lz}]) a (comp/args-for d (:text (get-in (current) [:boxes ${lz}])))
                                         go (fn [s m] (:state ((:receive d) {:inlet 0 :value m :state s :args a})))
                                         play (fn [seed] (let [s (-> st (go [:temp 3]) (go [:seed seed]) (go :reset))]
                                                           (loop [s s i 0] (if (< i 4) (recur (go s :engine) (inc i)) (:M (:crab s))))))]
                                     [(= (play 7) (play 7)) (> (count (distinct (map play [1 2 3 4 5 6 8 9]))) 1)])`);
  check("... with [:temp 3] the box draws among its answers: the same seed plays the same game, others others", seeded === "[true true]", seeded);
  await cljs(page, `(delete ${lz})`);

  // on a pulse: if you play nothing, the box plays your note for you
  const pz = (await cljs(page, '(box "comes midi live -1 -7 3 2 1 4" 8400 600)')).trim();
  const ps_ = (k) => `(get-in @eng/rt [:states ${pz} :crab ${k}])`;
  await cljs(page, `(send! ${pz} 1 :bang)`);
  await until(page, `(some? ${ps_(":mi")})`, (x) => x === "true", 30000);
  for (let i = 0; i < 12 && (await cljs(page, `(or ${ps_(":t")} 0)`)) !== "7"; i++) await cljs(page, `(send! ${pz} 1 :bang)`);
  check("comes -1 live on a pulse: the crab played to the end without a note of yours", (await until(page, ps_(":t"), (x) => x === "7", 3000)) === "7" &&
        /done/.test(await cljs(page, `(:sub (second (last-shown ${pz})))`)),
        await cljs(page, `[(dissoc (get-in @eng/rt [:states ${pz} :crab]) :cp :mi :sig) (second (last-shown ${pz}))]`));
  await cljs(page, `(delete ${pz})`);

  // systems (Study 42) in the boxes: the pentatonic, then septimal 31 on the way; a pentatonic crab
  const sy = (await cljs(page, '(box "comes pentatonic midi" 8600 600)')).trim();
  const ys = (k) => `(get-in @eng/rt [:states ${sy} :fwd ${k}])`;
  await cljs(page, `(send! ${sy} 60)`);
  check("comes pentatonic: C4 as played, the first note of penta-C", (await until(page, ys(":D"), (x) => x === "[0]", 30000)) === "[0]", await cljs(page, `[${ys(":D")} ${ys(":error")}]`));
  await cljs(page, `(send! ${sy} 65)`);
  const pf = await until(page, `(:reason (second (last-shown ${sy})))`, (x) => /not a note of the system/.test(x), 3000);
  check("... F4 is not a note of the pentatonic: corrected, and it says why", /not a note of the system/.test(pf), pf);
  await cljs(page, `(send! ${sy} [:system :septimal31])`);
  await until(page, `(count ${ys(":D")})`, (x) => x === "0", 20000);
  await cljs(page, `(send! ${sy} 60)`);
  const b7 = await until(page, `(some-> ${ys(":cp")} (.midi 6) (* 100) js/Math.round)`, (x) => x === "6968", 30000);
  check("... [:system :septimal31]: a new canon, its B♭ a harmonic seventh above C (MIDI 69.68)", b7 === "6968", b7);
  await cljs(page, `(delete ${sy})`);
  // the words name the system and a mode of it, in any order; a mode it does not have is said
  const wm = (await cljs(page, '(box "comes dorian pentatonic midi" 8600 680)')).trim();
  await cljs(page, `(send! ${wm} 60)`);
  const wmr = await until(page, `(:reason (second (last-shown ${wm})))`, (x) => /not a mode of pentatonic/.test(x), 30000);
  check("comes dorian pentatonic: dorian is not a mode of the pentatonic, it says so and takes penta-C",
        /dorian is not a mode of pentatonic/.test(wmr) && (await cljs(page, `(.-mode (get-in @eng/rt [:states ${wm} :fwd :cp]))`)) === '"penta-C"', wmr);
  await cljs(page, `(delete ${wm})`);
  const pc5 = (await cljs(page, '(box "comes pentatonic midi -1 -7 3 2 1 4" 8600 760)')).trim();
  const p5 = (k) => `(get-in @eng/rt [:states ${pc5} :crab ${k}])`;
  await cljs(page, `(send! ${pc5} 60)`);
  await until(page, `(some? ${p5(":pending")})`, (x) => x === "true", 30000);
  for (let i = 0; i < 14 && !/closed/.test(await cljs(page, `(:sub (second (last-shown ${pc5})))`)); i++) await cljs(page, `(send! ${pc5} :engine)`);
  const pent = await cljs(page, `(let [st (get-in @eng/rt [:states ${pc5} :crab]) cp (:cp st)] [(count (:M st)) (every? (fn [x] (#{0 2 4 7 9} (mod (js/Math.round (.midi cp x)) 12))) (:M st))])`);
  const pentDetail = await cljs(page, `(let [st (get-in @eng/rt [:states ${pc5} :crab]) cp (:cp st)] [(:M st) (mapv #(.midi cp %) (:M st)) (.-mode cp) (.-N cp) (.-k cp)])`);
  check("comes pentatonic -1: the crab closed, every note a note of the pentatonic", /closed/.test(await cljs(page, `(:sub (second (last-shown ${pc5})))`)) && pent === "[7 true]", pentDetail);
  const hypo = (await cljs(page, '(box "comes hypodorian midi -1 -7 3 2 1 4" 8800 760)')).trim();
  await cljs(page, `(send! ${hypo} 62)`);
  check("comes hypodorian -1: the mode in the box's text is the mode (it was lost before a message)",
    (await until(page, `(some-> (get-in @eng/rt [:states ${hypo} :crab :cp]) .-mode)`, (x) => x === '"hypodorian"', 30000)) === '"hypodorian"');
  await cljs(page, `(delete ${hypo})`);
  await cljs(page, `(delete ${pc5})`);

  // @kairotic/rhythm · euclid: a Euclidean rhythm (Bjorklund, after Toussaint), a generator of pulses
  const eu = (await cljs(page, '(box "euclid 3 8" 9000 600)')).trim();
  const ep = (await cljs(page, '(box "print" 9000 660)')).trim();
  await cljs(page, `(connect ${eu} 0 ${ep} 0)`);
  // (an unknown class is [1 1] too: wait for the class itself)
  const euIo = await until(page, `(when (comp/lookup "euclid") [(io (get-in (current) [:boxes ${eu}])) (boolean (comp/own-view? (get-in (current) [:boxes ${eu}])))])`, (x) => x === "[[1 1] false]", 20000);
  check("euclid brings @kairotic/rhythm: one inlet, one outlet (pulses), no view of its own", euIo === "[[1 1] false]", euIo);
  const eGo = `(fn [args msgs] (let [d (comp/lookup "euclid")]
                 (reduce (fn [[s _] [i m]] (let [r ((:receive d) {:inlet i :value m :state s :args args})] [(:state r) (:out r)])) [nil nil] msgs)))`;
  const eOut = `(fn [out o] (some (fn [[p v]] (when (= p o) v)) out))`;
  const ps = (args, msgs = "[[0 :bang]]") => `(let [go ${eGo} at ${eOut}] (at (second (go ${args} ${msgs})) 0))`;
  const known = await cljs(page, `[${ps("{:k 3 :n 8}")} ${ps("{:k 5 :n 8}")} ${ps("{:k 5 :n 16}")} ${ps("{:k 7 :n 12}")} ${ps("{:k 0 :n 4}")} ${ps("{:k 4 :n 4}")}]`);
  check("euclid: Toussaint's table — tresillo, cinquillo x.xx.xx., E(5,16), bembé x.xx.x.xx.x., silence, every pulse",
        known === "[[1 0 0 1 0 0 1 0] [1 0 1 1 0 1 1 0] [1 0 0 1 0 0 1 0 0 1 0 0 1 0 0 0] [1 0 1 1 0 1 0 1 1 0 1 0] [0 0 0 0] [1 1 1 1]]", known);
  const orders = await cljs(page, `[${ps("{:k 3 :n 8}", "[[0 [:rotation 1]]]")} ${ps("{:k 3 :n 8}", "[[0 5]]")} ${ps("{:k 3 :n 8}", "[[0 {:k 5 :n 16 :rotation 6}]]")}
                                     ${ps("{:k 3 :n 8}", "[[0 [:n 12]]]")} ${ps("{:k 3 :n 8}", "[[0 [:rotation 1]] [0 [:rotation 1]]]")}]`);
  check("... [:rotation 1] starts it a pulse later; a number is k; a map changes several (E(5,16) from pulse 6: the bossa nova); [:n 12]; the same again sends nothing",
        orders === "[[0 0 1 0 0 1 0 1] [1 0 1 1 0 1 1 0] [1 0 0 1 0 0 1 0 0 0 1 0 0 1 0 0] [1 0 0 0 1 0 0 0 1 0 0 0] nil]", orders);
  await cljs(page, `(swap! eng/rt assoc :prints []) (send! ${eu} :bang)`);
  check("... in the patch a bang sends the pulses", (await printedHas(page, "[1 0 0 1 0 0 1 0]")).includes("[1 0 0 1 0 0 1 0]"), await printed(page));
  await cljs(page, `(delete ${eu} ${ep})`);

  // necklace: the rhythm box — holds pulses, draws, edits, measures (Toussaint, Fourier), writes trees with pitches
  const nk = (await cljs(page, '(box "necklace" 9300 600)')).trim();
  const np = (await cljs(page, '(box "print" 9300 860)')).trim();
  await cljs(page, `(connect ${nk} 2 ${np} 0)`);
  check("necklace: three inlets (a rhythm, pitches, the clock) and five outlets",
        (await until(page, `(when (comp/lookup "necklace") (io (get-in (current) [:boxes ${nk}])))`, (x) => x === "[3 5]", 20000)) === "[3 5]");
  const nGo = `(fn [args msgs] (let [d (comp/lookup "necklace")]
                 (reduce (fn [[s _] [i m]] (let [r ((:receive d) {:inlet i :value m :state s :args args})] [(:state r) (:out r)])) [nil nil] msgs)))`;
  const ms = (src) => `(let [go ${nGo} at ${eOut}] (at (second (go {:n 16 :bars 1} [[0 ${src}]])) 3))`;
  const son = await cljs(page, `(let [m ${ms('"x..x..x...x.x..."')}] [(:ivec m) (:axes m) (:oddity m) (:gap m) (:k m) (:intervals m)])`);
  check("the son clave from box notation: interval vector [0 1 2 2 0 3 2 0] (Toussaint), one axis of symmetry, rhythmic oddity, longest gap 4",
        son === "[[0 1 2 2 0 3 2 0] [3] true 4 5 [3 3 4 2 4]]", son);
  const claves = await cljs(page, `(let [e (fn [s] (:evenness ${ms("s")}))] [(< (e "x..x...x..x.x...") (e "x..x..x...x..x..")) (:euclid ${ms('"x..x..x...x..x.."')})])`);
  check("... the rumba is less even than the bossa nova (chords, not arcs); the bossa nova is E(5,16) from pulse 6", claves === "[true 6]", claves);
  const kinds = await cljs(page, `(let [go ${nGo} at ${eOut} m (fn [args v] (at (second (go args [[0 v]])) 3))
                                        bembe (m {:n 12} "x.x.xx.x.x.x") flat (m {:n 12} [1 1 0 0 1 0 1 0 0 0 0 0])]
                                    [(:deep bembe) (:ivec bembe) (count (:axes bembe)) (:flat flat) (:deep flat) (:even (m {:n 8} [3 3 2])) (:even (m {:n 8} "xxx....."))])`);
  check("... the bembé is deep (as the diatonic scale: <2 5 4 3 6 1>); x x . . x . x . . . . . is flat; the tresillo as even as E(3,8), three onsets together less",
        /^\[true \[2 5 4 3 6 1\] 1 true false 1 0\.\d+\]$/.test(kinds), kinds);
  // Fourier (Amiot, Milne): |f_k| largest when maximally even; |f1| 0 when balanced; f4 of a quarter-note pulse
  const four = await cljs(page, `(let [f (fn [s] (:fourier ${ms("s")}))]
                                   [(count (f "x..x..x...x.x...")) (nth (f "x...x...x...x...") 3) (nth (f "x...x...x...x...") 0)
                                    (> (nth (f "x..x..x..x..x...") 4) (nth (f "x..x...x..x.x...") 4))])`);
  check("... its Fourier magnitudes: 8 in 16 pulses; four quarter notes wholly f4 and balanced (f1 0); E(5,16) has a larger f5 than the rumba",
        four === "[8 1 0 true]", four);
  const forms = await cljs(page, `(let [go ${nGo} at ${eOut} p (fn [v] (at (second (go {:n 16 :bars 1} [[0 v]])) 2))]
                                    [(p [3 3 2]) (p {:shares [-1 3 3 1]}) (p {:onsets [0 3 6] :n 8})
                                     (p [:voice [:measure {:meter [4 4]} [:rtm {:shares [3 3 2]}]]]) (p [261.63 329.63])])`);
  check("... a rhythm arrives as intervals, an :rtm map, onsets with n, or a tree; a list of Hz is not one",
        forms === "[[1 0 0 1 0 0 1 0] [0 1 0 0 1 0 0 1] [1 0 0 1 0 0 1 0] [1 0 0 1 0 0 1 0] nil]", forms);
  const edits = await cljs(page, `(let [go ${nGo} at ${eOut} p (fn [msgs] (at (second (go {:n 16 :bars 1} msgs)) 2))]
                                    [(p [[0 "x..x..x."] [0 [:pressed 1]]]) (p [[0 "x..x..x."] [0 :complement]]) (p [[0 "x..x..x."] [0 [:rotate 1]]])
                                     (p [[0 "x..x..x."] [0 [:n 4]]]) (p [[0 "x..x..x."] [0 "x..x..x."]])])`);
  check("... pressing a pulse adds an onset; :complement; [:rotate 1]; [:n 4] cuts the circle; the same again sends nothing",
        edits === "[[1 1 0 1 0 0 1 0] [0 1 1 0 1 1 0 1] [0 0 1 0 0 1 0 1] [1 0 0 1] nil]", edits);
  // as a tree: a bar of n pulses (its meter as the pulses say), the :rtm shares the intervals, a rotation's silence first
  const tres = await cljs(page, `(let [go ${nGo} at ${eOut} [_ out] (go {:n 16 :bars 1} [[0 [1 0 0 1 0 0 1 0]]])]
                                   [(get-in (at out 0) [1 1]) (at out 1) (mapv :t (mt/notes (at out 0))) (:shares (at (second (go {:n 16 :bars 1} [[0 [0 0 1 0 0 1 0 1]]])) 1))])`);
  check("... the tresillo as a tree: a bar of 4/4 whose :rtm shares are 3 3 2, notes at 0, 1.5 and 3 beats; rotated, a silence first",
        tres === "[{:meter [4 4]} {:shares [3 3 2]} [0 1.5 3] [-2 3 2 1]]", tres);
  const meters = await cljs(page, `(let [go ${nGo} at ${eOut} m (fn [n] (get-in (at (second (go {:n 16 :bars 1} [[0 (vec (cons 1 (repeat (dec n) 0)))]])) 0) [1 1 :meter]))
                                         [_ o34] (go {:n 16 :bars 1} [[0 "x..x..x."] [0 [:meter "3/4"]]])]
                                     [(m 8) (m 16) (m 12) (m 5) (m 7) (m 24) (m 13) (get-in (at o34 0) [1 1])])`);
  check("... the bar as the pulses say: 4/4 for 8 and 16, 12/8 for 12 and 24, n/8 up to 12, else n/16; [:meter \"3/4\"]",
        meters === '[[4 4] [4 4] [12 8] [5 8] [7 8] [12 8] [13 16] {:meter "3/4"}]', meters);
  // the pitches on the right (cold): Hz by default, a melody string, a map of pitches, a pattern; :clear
  const pit = await cljs(page, `(let [go ${nGo} at ${eOut}
                                      rtm (fn [args msgs] (at (second (go args (conj msgs [0 "x..x..x."]))) 1))]
                                  [(:pitches (rtm {:n 8 :bars 1} [[1 [261.63 329.63 392]]]))
                                   (:pitches (rtm {:n 8 :bars 1 :midi true} [[1 [60 64 67]]]))
                                   (rtm {:n 8 :bars 1} [[1 "c4 e4 g4"]])
                                   (rtm {:n 8 :bars 1} [[1 {:pitches [62 65] :other 1}]])
                                   (:pitches (rtm {:n 8 :bars 1} [[1 {:note [62 nil 64] :dur [1 1 1]}]]))
                                   (rtm {:n 8 :bars 1} [[1 "c4 e4 g4"] [1 :clear]])
                                   (second (go {:n 8 :bars 1} [[1 "c4"]]))])`);
  check("... the right inlet gives the pitches: Hz (a keyboard) as MIDI, MIDI with midi, a melody string, a map of pitches as it is, a pattern (nil a rest); :clear; and it is cold",
        pit === '[[60 64 67] [60 64 67] {:shares [3 3 2], :pitches "c4 e4 g4"} {:shares [3 3 2], :pitches [62 65]} [62 "r" 64] {:shares [3 3 2]} nil]', pit);
  const nTree = await cljs(page, `(let [go ${nGo} at ${eOut} [_ out] (go {:n 16 :bars 2} [[1 "c4 e4 g4 b4"] [0 "x..x..x...x.x..."]]) t (at out 0)]
                                    [(get-in t [1 1]) (at out 1) (mt/pitches t) (mt/duration t)])`);
  check("... talea and color: with bars the pitches go on from bar to bar (the tree, as mt reads it)",
        nTree === '[{:meter [4 4]} {:shares [3 3 4 2 4], :pitches "c4 e4 g4 b4"} ["c4" "e4" "g4" "b4" "c4" "e4" "g4" "b4" "c4" "e4"] 8]', nTree);
  // step by step: a bang on the right inlet moves the hand and plays the onsets (outlet 4); a number moves it there
  const steps = await cljs(page, `(let [go ${nGo} d (comp/lookup "necklace")
                                        run (fn [msgs] (reduce (fn [[s outs sh] [i m]] (let [x ((:receive d) {:inlet i :value m :state s :args {:n 16 :bars 1}})] [(or (:state x) s) (conj outs (some (fn [[p v]] (when (= p 4) v)) (:out x))) (or (:show x) sh)])) [nil [] nil] msgs))
                                        [_ outs sh] (run [[0 "x..x..x."] [2 :bang] [2 :bang] [2 :bang] [2 :bang] [2 6] [2 :reset] [2 :bang] [0 [:pressed 1]] [2 :bang]])]
                                    [(vec (rest outs)) (:hand sh)])`);
  check("... step by step: the hand plays x..x..x. (bang, -, -, bang), jumps to 6 (bang), :reset begins again, and finds an onset just pressed",
        steps === "[[:bang nil nil :bang :bang nil :bang nil :bang] 1]", steps);
  // in the patch: euclid's pulses into a necklace; drawn with its axes, and with fourier its bars
  const ne = (await cljs(page, '(box "euclid 5 16" 9600 600)')).trim();
  await cljs(page, `(connect ${ne} 0 ${nk} 0)`);
  await cljs(page, `(swap! eng/rt assoc :prints []) (send! ${ne} [:rotation 6])`);
  check("... euclid 5 16 into a necklace: the bossa nova, recognised as E(5,16) ↻6",
        (await until(page, `(:euclid (second (last-shown ${nk})))`, (x) => x === "6", 3000)) === "6", await cljs(page, `(second (last-shown ${nk}))`));
  const nkDraw = await cljs(page, `(let [b (get-in (current) [:boxes ${nk}]) sh (ctl-shapes* (ctl-m ${nk} b) b)]
                                     [(count (filter (fn [f] (and (= :group (first f)) (number? (:hit (second f))))) sh))
                                      (count (filter (fn [f] (and (= :line (first f)) (= 0.5 (:opacity (second f))))) sh))])`);
  check("... drawn: sixteen pulses to press and its one axis of symmetry", nkDraw === "[16 1]", nkDraw);
  const nf = (await cljs(page, '(box "necklace fourier" 9900 600)')).trim();
  await cljs(page, `(connect ${ne} 0 ${nf} 0) (send! ${ne} :bang)`);
  const nfDraw = await until(page, `(let [b (get-in (current) [:boxes ${nf}])] [(comp/size-of b) (count (filter (fn [f] (= :rect (first f))) (ctl-shapes* (ctl-m ${nf} b) b)))])`, (x) => x === "[[200 296] 8]", 4000);
  check("... necklace fourier: a taller box, a bar for each of the eight magnitudes", nfDraw === "[[200 296] 8]", nfDraw);
  await cljs(page, `(delete ${nk} ${np} ${ne} ${nf})`);
  // the other generators and a relation: chance (seeded draws), homometric (same interval vector), swap (Toussaint's distance)
  const gen = `(fn [cls args msgs] (let [d (comp/lookup cls)]
                 (second (reduce (fn [[s _] [i m]] (let [r ((:receive d) {:inlet i :value m :state s :args args})] [(:state r) (:out r)])) [nil nil] msgs))))`;
  const ch = (await cljs(page, '(box "chance 5 16 7" 10200 600)')).trim();
  const hm = (await cljs(page, '(box "homometric" 10200 660)')).trim();
  const sw = (await cljs(page, '(box "swap" 10200 720)')).trim();
  check("chance, homometric and swap bring @kairotic/rhythm",
        (await until(page, `(every? some? (map comp/lookup ["chance" "homometric" "swap"]))`, (x) => x === "true", 20000)) === "true");
  const chs = await cljs(page, `(let [g ${gen} p (fn [args msgs] (some (fn [[o v]] (when (= o 0) v)) (g "chance" args msgs))) a {:k 5 :n 16 :seed 7}]
                                  [(count (p a [[0 :bang]])) (reduce + (p a [[0 :bang]])) (= (p a [[0 :bang]]) (p a [[0 :bang] [0 :bang] [0 :reset] [0 :bang]]))
                                   (not= (p a [[0 :bang]]) (p a [[0 :bang] [0 :bang]])) (not= (p a [[0 :bang]]) (p (assoc a :seed 8) [[0 :bang]]))
                                   (= (p a [[0 :bang]]) (p {:k 3 :n 8 :seed 1} [[0 {:k 5 :n 16 :seed 7}] [0 :bang]]))])`);
  check("chance 5 16 7: five onsets in sixteen; the same seed the same draws (:reset starts them again), the next draw another, another seed another; a map sets it",
        chs === "[16 5 true true true true]", chs);
  const hms = await cljs(page, `(let [g ${gen}] [(g "homometric" {} [[0 [1 1 0 0 1 0 1 0 0 0 0 0]]]) (g "homometric" {} [[0 [1 0 0 1 0 0 1 0 0 0 1 0 1 0 0 0]]])])`);
  check("homometric: the flat rhythm x x . . x . x . . . . . has one partner, x x . x . . . x . . . .; the son clave none",
        hms === "[[[1 1] [0 [[1 1 0 1 0 0 0 1 0 0 0 0]]]] [[1 0] [0 []]]]", hms);
  const sws = await cljs(page, `(let [g ${gen} m (fn [ref a] (some (fn [[o v]] (when (= o 0) v)) (g "swap" {} [[1 ref] [0 a]])))
                                      son [1 0 0 1 0 0 1 0 0 0 1 0 1 0 0 0] rumba [1 0 0 1 0 0 0 1 0 0 1 0 1 0 0 0] bossa [1 0 0 1 0 0 1 0 0 0 1 0 0 1 0 0]
                                      t (m [1 0 0 1 0 0 1 0] [0 0 1 0 0 1 0 1])]
                                  [((juxt :swap :hamming) (m son rumba)) ((juxt :swap :hamming) (m son bossa))
                                   ((juxt :swap :circular :necklace :rotation :hamming :necklace-hamming) t)
                                   (:swap (m [1 0 1 1 0 1 1 0] [1 0 0 1 0 0 1 0])) (g "swap" {} [[0 son]]) (g "swap" {} [[1 son] [0 [1 0 0 1 0 0 1 0]]])])`);
  check("swap: the rumba and the bossa nova each 1 swap from the son (2 by Hamming); the tresillo a pulse later: 5 in the bar, 3 around the circle, 0 as a necklace (rotation 1); the tresillo 0 from the cinquillo (directed); nothing without a reference or of another length",
        sws === "[[1 2] [1 2] [5 3 0 1 6 0] 0 nil nil]", sws);
  await cljs(page, `(delete ${ch} ${hm} ${sw})`);
  // morph and vary: the way between two rhythms, and a variation by a measured amount (#206, #207, #321)
  const mo = (await cljs(page, '(box "morph" 10500 600)')).trim();
  const va = (await cljs(page, '(box "vary" 10500 660)')).trim();
  check("morph and vary bring @kairotic/rhythm",
        (await until(page, `(every? some? (map comp/lookup ["morph" "vary"]))`, (x) => x === "true", 20000)) === "true");
  const G = `(fn [cls args msgs] (let [d (comp/lookup cls)]
                (reduce (fn [[s _] [i m]] (let [x ((:receive d) {:inlet i :value m :state s :args args})] [(or (:state x) s) (:out x)])) [nil nil] msgs)))`;
  const O = `(fn [r k] (some (fn [[p v]] (when (= p k) v)) (second r)))`;
  const mor = await cljs(page, `(let [G ${G} O ${O} r (fn [a b t] (G "morph" {} [[1 b] [2 t] [0 a]]))
                                      son [1 0 0 1 0 0 1 0 0 0 1 0 1 0 0 0] bossa [1 0 0 1 0 0 1 0 0 0 1 0 0 1 0 0]
                                      tres [1 0 0 1 0 0 1 0] cinq [1 0 1 1 0 1 1 0]]
                                  [(= bossa (O (r son bossa 1) 0)) (= son (O (r son bossa 0) 0)) (O (r tres [0 1 0 0 1 0 0 1] 0.5) 1)
                                   (O (r tres [0 1 0 0 1 0 0 1] 0.5) 0) (:steps (O (r tres cinq 1) 1)) (O (r cinq tres 1) 0) (:steps (O (r cinq tres 0) 1))
                                   (second (G "morph" {} [[1 [1 0 1]] [0 tres]]))])`);
  check("morph: the son becomes the bossa nova in one swap; the tresillo a pulse later in three, taking turns (two at 0.5); the tresillo grows into the cinquillo (two onsets appear) and back (they go first); nothing for another length",
        mor === "[true true {:steps [[:swap 0 1] [:swap 3 4] [:swap 6 7]], :swaps 3, :at 2, :of 3} [0 1 0 0 1 0 1 0] [[:add 2] [:add 5]] [1 0 0 1 0 0 1 0] [[:remove 2] [:remove 5]] nil]", mor);
  const var_ = await cljs(page, `(let [G ${G} O ${O} son [1 0 0 1 0 0 1 0 0 0 1 0 1 0 0 0] p (fn [args msgs] (G "vary" args msgs))
                                       sw (fn [a b] (:swap (O (G "swap" {} [[1 b] [0 a]]) 0)))
                                       v2 (O (p {:d 2 :seed 1} [[0 son]]) 0)
                                       dep (p {:d 1 :seed 1 :depth true} [[0 son]])]
                                   [(sw v2 son) (reduce + v2) (= v2 (O (p {:d 2 :seed 1} [[0 son] [0 :bang] [0 :reset] [0 :bang]]) 0))
                                    (not= v2 (O (p {:d 2 :seed 1} [[0 son] [0 :bang]]) 0)) (not= v2 (O (p {:d 2 :seed 2} [[0 son]]) 0))
                                    (:kept (O dep 1)) (nth (O dep 0) 0) (reduce + (O dep 0)) (nth (O dep 0) 8)
                                    (every? (fn [s] (and (pos? (nth (O (p {:d 3 :seed s :downbeat true} [[0 son]]) 0) 0)))) (range 1 9))])`);
  check("vary: exactly 2 swaps from the son, as many onsets; the same seed the same draws (:reset), the next draw or another seed another; with depth 1 the downbeat kept and the four others drawn again off the strong pulses; downbeat keeps the first pulse",
        var_ === "[2 5 true true true [0] 1 5 0 true]", var_);
  await cljs(page, `(delete ${mo} ${va})`);
  // phase: where a performer is in a cycle, from onsets on a pulse clock (#204)
  const phb = (await cljs(page, '(box "phase" 10800 600)')).trim();
  check("phase brings @kairotic/rhythm: three inlets (onsets, reference, clock), two outlets",
        (await until(page, `(when (comp/lookup "phase") (io (get-in (current) [:boxes ${phb}])))`, (x) => x === "[3 2]", 20000)) === "[3 2]");
  const phs = await cljs(page, `(let [d (comp/lookup "phase") son [1 0 0 1 0 0 1 0 0 0 1 0 1 0 0 0]
                                      run (fn [start ticks off drop extra]
                                            (let [msgs (concat [[1 son 0]]
                                                               (sort-by (fn [[_ _ t]] t)
                                                                        (mapcat (fn [i] (let [t (* 0.125 (inc i)) p (mod (+ start i) 16)
                                                                                              on (or (contains? extra i) (and (= 1 (nth son p)) (not (contains? drop i))))]
                                                                                          (concat [[2 :bang t]] (when on [[0 :bang (+ t off)]]))))
                                                                                (range ticks))))]
                                              (:phases (reduce (fn [acc [i m at]] (let [x ((:receive d) {:inlet i :value m :state (:s acc) :args {:min 0} :at at})]
                                                                                   (cond-> (assoc acc :s (or (:state x) (:s acc)))
                                                                                     (some (fn [[p _]] (= p 0)) (:out x)) (update :phases conj (some (fn [[p v]] (when (= p 0) v)) (:out x))))))
                                                               {:s nil :phases []} msgs))))
                                      ok (fn [start ticks ph] (let [n (count ph)] [(count ph) (= ph (mapv (fn [k] (mod (+ start (- ticks n) k) 16)) (range n)))]))]
                                  [(ok 5 24 (run 5 24 -0.01 #{} #{})) (ok 5 24 (run 5 24 0.03 #{} #{}))
                                   (ok 0 40 (run 0 40 0.03 (set (range 12 21)) #{})) (ok 3 40 (run 3 40 0.02 #{} #{20 25}))])`);
  check("phase: the son clave clapped from its sixth pulse, early or late, is found after half a cycle and followed; nine pulses missing or two extra onsets do not throw it",
        phs === "[[16 true] [16 true] [32 true] [32 true]]", phs);
  await cljs(page, `(delete ${phb})`);
  // click~ (@kairotic/synth): a tick each bang, every accent bangs one accented; a number 0 accented
  const ck = (await cljs(page, '(box "click~ 1200 4" 11100 600)')).trim();
  check("click~ brings @kairotic/synth", (await until(page, `(boolean (comp/lookup "click~"))`, (x) => x === "true", 20000)) === "true");
  const cks = await cljs(page, `(let [d (comp/lookup "click~")
                                      fx (reduce (fn [[s acc] m] (let [r ((:receive d) {:inlet 0 :value m :state s :args {:freq 1200 :accent 4 :decay 0.03}})]
                                                                   [(or (:state r) s) (conj acc (first (second (first (:effects r)))))]))
                                                 [nil []] [:bang :bang :bang :bang :bang 0 2])]
                                  (second fx))`);
  check("... accents the first of every four bangs; a number is a tick, accented when 0", cks === "[true false false false true true false]", cks);
  const ckd = await cljs(page, `(let [d (comp/lookup "click~")]
                                  (mapv (fn [m] (mapv (fn [[k [acc _]]] [k acc]) (:effects ((:receive d) {:inlet 0 :value m :state nil :args {:freq 500 :accent 0 :decay 0.06 :downbeat true}}))))
                                        [0 3 15 :bang]))`);
  check("... click~ downbeat: a number ticks only when it is 0 (where a cycle begins); a bang still ticks", ckd === "[[[:tick true]] [] [] [[:tick false]]]", ckd);
  await cljs(page, `(delete ${ck})`);
}
