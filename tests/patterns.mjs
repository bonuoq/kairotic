// SPDX-License-Identifier: MPL-2.0
// @kairotic/patterns: a pbind sends its pattern when it changes (:sends), a pattern box from code, and a
// player that moves by steps, by a position in beats, and by its own clock (with ▶).
// In the audio app of tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function patterns(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the patterns tests", false); return; }
  await cljs(page, "(stop)");
  const pb = (await cljs(page, '(box "pbind 7" 5200 100)')).trim();
  const known = await until(page, '(boolean (and (comp/lookup "pbind") (comp/lookup "player") (comp/lookup "pattern")))', (x) => x === "true", 20000);
  check("writing pbind brings @kairotic/patterns (pbind, pattern, player)", known === "true", known);
  if (known !== "true") { await cljs(page, `(delete ${pb})`); return; }
  check("their help patches have steps",
    (await cljs(page, '[(count (hlp/patch-steps "pbind")) (count (hlp/patch-steps "player"))]')) === "[3 3]",
    await cljs(page, '[(count (hlp/patch-steps "pbind")) (count (hlp/patch-steps "player"))]'));

  // what reaches the four outlets of the player: [outlet value] in order
  await cljs(page, `(comp/define! "psink" {:io [4 0] :receive (fn [{:keys [inlet value state]}] {:state (conj (or state []) [inlet value])})})`);
  const pl = (await cljs(page, '(box "player 120" 5200 220)')).trim();
  const sk = (await cljs(page, '(box "psink" 5200 300)')).trim();
  await cljs(page, `(connect ${pl} 0 ${sk} 0) (connect ${pl} 1 ${sk} 1) (connect ${pl} 2 ${sk} 2) (connect ${pl} 3 ${sk} 3)`);
  await cljs(page, `(code ${pb} "{:degree [0 2 4] :dur [0.5 0.5 1]}")`);
  await cljs(page, `(connect ${pb} 0 ${pl} 1)`);
  const pkey = `(:key (:pattern (get-in @eng/rt [:states ${pl}])))`;
  const k = await until(page, pkey, (x) => x.includes(":pbind"));
  check("a pbind sends its pattern by itself when it is written and connected", k.includes("{:degree [0 2 4], :dur [0.5 0.5 1]} 7 1"), k);
  check("... its summary is the status of the code box",
    (await cljs(page, `(get-in (compilation ${pb}) [:info :summary])`)) === '"2 keys · 3 events a pass"', await cljs(page, `(compilation ${pb})`));

  const sink = `(get-in @eng/rt [:states ${sk}])`;
  const events = `(mapv (fn [[_ e]] [(:degree e) (:beat e)]) (filter (fn [[o]] (= o 2)) (get-in @eng/rt [:states ${sk}])))`;
  const clear = () => cljs(page, `(do (swap! eng/rt assoc-in [:states ${sk}] []) nil)`);

  // steps: a bang plays the next event now (messages travel without ▶)
  await clear();
  await cljs(page, `(send! ${pl} :bang)`);
  const s1 = await until(page, sink, (x) => x.includes("[3 0]"));
  check("a bang: the event, the Hz and voice ids of what sounds, and the beat",
    s1.includes("[2 {:degree 0, :dur 0.5, :beat 0, :hz [261.626], :ids [:p1]}]") && s1.includes("[1 [:p1]]") && s1.includes("[0 [261.626]]"), s1);
  await cljs(page, `(send! ${pl} :bang) (send! ${pl} :bang) (send! ${pl} :bang)`);
  check("... the next ones, and again from the beginning at the end",
    (await until(page, events, (x) => x.split("[").length > 5)) === "[[0 0] [2 0.5] [4 1] [0 0]]", await cljs(page, events));

  // a position in beats: every event is a span, [onset, onset + sustain): degree 0 [0, 0.4), 2 [0.5, 0.9), 4 [1, 1.8)
  await clear();
  await cljs(page, `(send! ${pl} 0)`);
  await cljs(page, `(send! ${pl} 1.2)`);
  check("a position: what contains it, then what it passes and enters",
    (await until(page, events, (x) => x.includes("[4 1]"))) === "[[0 0] [2 0.5] [4 1]]", await cljs(page, events));
  await clear();
  await cljs(page, `(send! ${pl} 0.2)`);
  check("... going back, the spans it passes are entered from their end",
    (await until(page, events, (x) => x.includes("[0 0]"))) === "[[2 0.5] [0 0]]", await cljs(page, events));
  check("... marked :dir :back", (await cljs(page, sink)).includes(":dir :back"), await cljs(page, sink));
  await clear();
  await cljs(page, `(send! ${pl} 0.6)`);
  check("... and forwards again from there", (await until(page, events, (x) => x.includes("[2 0.5]"))) === "[[2 0.5]]", await cljs(page, events));

  // the player's logic, step by step (pure: messages to its :receive, as the engine sends them)
  const pure = `(let [d (comp/lookup "player")
        mk (fn [src opts] (api/pbind-pattern (api/read-pbind src) opts))
        go (fn [text st msgs] (reduce (fn [[st rs] [inl v at]]
                                        (let [r ((:receive d) {:state st :args (comp/args-for d text) :inlet inl :value v :at at})]
                                          [(:state r) (conj rs r)]))
                                      [st []] msgs))
        evs (fn [rs] (vec (for [r rs [o v] (:out r) :when (= o 2)] [(:degree v) (:dir v)])))
        p1 (mk "{:degree [0 2 4] :dur [0.5 0.5 1]}" {:seed 1 :repeat 1})
        [s0 _] (go "player" nil [[1 p1 0] [0 [:seek 2] 1]])
        [s1 back] (go "player" s0 (vec (for [i (range 1 9)] [0 (- 2 (* i 0.25)) (+ 1 (* i 0.01))])))
        [s2 fwd] (go "player" s1 (conj (vec (for [i (range 1 17)] [0 (* i 0.125) (+ 2 (* i 0.01))])) [0 0 2.2]))
        [s3 sk] (go "player" s2 [[0 [:seek 1.5] 3]])
        [s4 ed] (go "player 120 0 8 8 edges" s3 [[0 [:seek 1.6] 3.1] [0 [:seek 0.2] 3.2] [0 [:seek 0.5] 3.3]])
        [s5 sp] (go "player 120 0 8 8 spread" s4 [[0 [:seek 0] 4] [0 0.25 4.1] [0 1.5 4.2]])
        [s6 same] (go "player" s5 [[0 1.5 4.3]])
        far (mk "{:degree [0 1 2 3] :dur 0.25}" {:seed 1 :repeat :inf})
        [_ curve] (go "player" (first (go "player" nil [[1 p1 0] [0 [:seek 0] 1]]))
                      [[0 0.001 1.01] [0 0.016 1.02] [0 0.1 1.03] [0 [:seek 0.2] 1.04]])
        [s7 w] (go "player 120 0 8 100000" s6 [[1 far 5] [0 [:seek 0] 5] [0 [:seek 5000] 5.1] [0 [:seek 3] 5.2] [0 2.75 5.3]])]
    [(evs back) (evs fwd) (evs sk) (evs ed)
     (:out (last sp)) (count (:later (last sp))) (mapv (fn [[t]] (js/Math.round (* 1000 t))) (:later (last sp)))
     (:out (first same)) (evs (take-last 2 w)) (< (count (pr-str s7)) 20000)
     (evs curve) (boolean (some (fn [r] (some (fn [o] (= o [1 []])) (:out r))) curve))])`;
  const got = await cljs(page, pure);
  check("pure: a ramp going back enters every span from its end, in reverse order",
    got.startsWith("[[[4 :back] [2 :back] [0 :back]] "), got);
  check("... a ramp going forwards enters them at their onsets, and its wrap back to 0 is a seek (what is at 0 sounds, nothing in between)",
    got.includes(" [[2 nil] [4 nil] [0 nil]] "), got);
  check("... seek 1.5: what contains it", got.includes(" [[4 nil]] "), got);
  check("... with edges, a seek keeps what still sounds, is silent inside a span and sounds one at its onset", got.includes(" [[4 nil]] [[2 nil]] [[3 1.5]] 4 "), got);
  check("... with spread, what a step passes keeps its rhythm, later within one step", got.includes(" [4212 4220 4252 4260] "), got);
  check("... the same position again changes nothing", got.includes(" nil "), got);
  check("... an endless pattern: far ahead and back again, from the window", got.includes(" [[0 nil] [3 :back]] true "), got);
  check("... a curve leaving rest (each step 15 times the one before) is motion, and a seek inside a sounding note neither cuts nor restarts it",
    got.endsWith(" [] false]"), got);
  // the same pattern again changes nothing; a new one goes on from the same place
  const before = await cljs(page, `(:pos (get-in @eng/rt [:states ${pl}]))`);
  await cljs(page, "(refill-data!)");
  await page.waitForTimeout(300);
  check("the same pattern again changes nothing", (await cljs(page, `(:pos (get-in @eng/rt [:states ${pl}]))`)) === before);
  await cljs(page, `(code ${pb} "{:degree [7 9 11] :dur [0.5 0.5 1]}")`);
  await until(page, pkey, (x) => x.includes("[7 9 11]"));
  await clear();
  await cljs(page, `(send! ${pl} 1.1)`);
  check("a new pattern goes on from the same position", (await until(page, events, (x) => x.includes("11"))) === "[[11 1]]", await cljs(page, events));

  // a map on its inlet rewrites the pbind, one event of the history; [:set k v] one key
  const depth = "(depth-of (norm (:pos @world)))";
  const d0 = Number(await cljs(page, depth));
  await cljs(page, `(send! ${pb} [:set :degree [0 1]])`);
  const src = await until(page, `(get-in (current) [:boxes ${pb} :data :source])`, (x) => x.includes("[0 1]"), 4000);
  check("[:set :degree [0 1]] rewrites its source", src.includes(":degree [0 1]") && src.includes(":dur [0.5 0.5 1]"), src);
  check("... as one event of the history", Number(await cljs(page, depth)) === d0 + 1, await cljs(page, depth));

  // a pattern from code
  const pc = (await cljs(page, '(box "pattern 3" 5500 100)')).trim();
  await cljs(page, `(code ${pc} "(for [d (range 4)] {:note (+ 60 d) :dur 0.25})")`);
  // one source per inlet: the pbind would be sent again toward a new line into the player
  await cljs(page, `(disconnect ${pb} 0 ${pl} 1) (connect ${pc} 0 ${pl} 1)`);
  await until(page, pkey, (x) => x.includes(":code"));
  await clear();
  await cljs(page, `(send! ${pl} :reset) (send! ${pl} :bang) (send! ${pl} :bang)`);
  check("a pattern box: events from code", (await until(page, sink, (x) => x.includes(":note 61"))).includes("{:note 61, :dur 0.25, :beat 0.25"), await cljs(page, sink));
  await cljs(page, `(code ${pc} "(map (fn [_] {:note (+ 60 (rand-int 12))}) (range 6))")`);
  const notes = `(mapv :note (take 6 (api/pattern-events (:pattern (get-in @eng/rt [:states ${pl}])))))`;
  await until(page, pkey, (x) => x.includes("rand-int"));
  const n1 = await cljs(page, notes);
  check("... with its randomness seeded: every stream the same", n1 === (await cljs(page, notes)) && n1.startsWith("["), n1);
  check("... and a mistake is told in its status",
    (await (async () => { await cljs(page, `(code ${pc} "(map inc")`); return until(page, `(:status (compilation ${pc}))`, (x) => x === ":error"); })()) === ":error");

  // loudness: :amp → [:gain amp] before the notes, and synth~ takes it; nil is a silence
  const sy = (await cljs(page, '(box "synth~" 5700 100)')).trim();
  const synthed = await until(page, '(boolean (comp/lookup "synth~"))', (x) => x === "true", 20000);
  const loud = await cljs(page, `(let [d (comp/lookup "player") s (comp/lookup "synth~")
        p (api/pbind-pattern (api/read-pbind "{:degree [0 nil 4] :amp [0.8 0.5 0.2]}") {:seed 0 :repeat 1})
        go (fn [st msgs] (reduce (fn [[st rs] [inl v at]]
                                   (let [r ((:receive d) {:state st :args (comp/args-for d "player") :inlet inl :value v :at at})]
                                     [(:state r) (conj rs r)])) [st []] msgs))
        [_ rs] (go nil [[1 p 0] [0 :bang 0] [0 :bang 0.1] [0 :bang 0.2]])
        outs (mapv (fn [r] (vec (keep (fn [[o v]] (when (#{0 1} o) v)) (:out r)))) rs)
        sr (fn [st v inl] ((:receive s) {:state st :inlet inl :value v :args []}))
        a (sr nil [:gain 0.8] 0) b (sr (:state a) [:p1] 1) c (sr (:state b) [261.6] 0)]
    [(subvec outs 1) (:effects c)])`);
  check("an event with :amp: [:gain amp] before its notes; nil is a silence",
    synthed === "true" && loud.startsWith("[[[[:gain 0.8] [:p1] [261.626]] [] [[:gain 0.2] [:p1 :p2] [261.626 391.995]]] "), loud);
  check("... and synth~ starts its next notes at that level", loud.endsWith("[[:voices [[[:p1 261.6]] 0.8]]]]"), loud);
  await cljs(page, `(delete ${sy})`);

  // render: a stretch of the pattern into a freqt, shown live, kept with its recipe; a canvas as a time map
  const rd = (await cljs(page, '(box "render 0 4" 5900 100)')).trim();
  const fq = (await cljs(page, '(box "freqt" 5900 160)')).trim();
  const known2 = await until(page, '(boolean (comp/lookup "render"))', (x) => x === "true", 20000);
  check("render comes with @kairotic/patterns", known2 === "true", known2);
  await cljs(page, `(code ${pb} "{:degree [0 2 4 5] :dur 1 :legato 1 :amp [0.5 1 0.5 1]}") (text! ${pb} "pbind 7")`);
  await cljs(page, `(connect ${rd} 0 ${fq} 0) (connect ${pb} 0 ${rd} 0)`);
  const live = await until(page, `(count (rest (rest (live-tree ${fq}))))`, (x) => x === "4", 6000);
  check("a pbind into render: the freqt shows its notes live", live === "4", live + " " + await cljs(page, `(pr-str (live-tree ${fq}))`));
  await cljs(page, `(keep! ${fq})`);
  const kept = await cljs(page, `(let [d (get-in (current) [:boxes ${fq} :data])] [(count (:strokes d)) (get-in d [:strokes :t2 :look]) (boolean (:recipe (get-in (current) [:boxes ${fq}])))])`);
  check("... keep! writes them, each with its look (:amp as weight), and the recipe beside them", kept === "[4 {:w 2.8} true]", kept);
  const cm = (await cljs(page, '(box "canvas" 6200 100)')).trim();
  await cljs(page, `(axis ${cm} :x 0 4) (axis ${cm} :y 0 4) (stroke ${cm} [[0 4] [4 0]]) (connect ${cm} 1 ${rd} 1) (send! ${rd} :bang)`);
  const back = await until(page, `(mapv (fn [[_ a]] (:back a)) (rest (rest (live-tree ${fq}))))`, (x) => x.includes("true"), 6000);
  check("a canvas on its right: a time map; going down, the phrase backwards, each note from its end", back === "[true true true true]", back);
  await cljs(page, `(delete ${rd} ${fq} ${cm})`);

  // its own clock, with ▶
  await cljs(page, `(delete ${pc}) (connect ${pb} 0 ${pl} 1)`);
  await cljs(page, `(code ${pb} "{:degree [0 2 4 5] :dur 0.25}") (text! ${pb} "pbind 7 loop")`);
  await until(page, pkey, (x) => x.includes(":inf"));
  await cljs(page, "(play)");
  await clear();
  await cljs(page, `(send! ${pl} :start)`);
  await page.waitForTimeout(1300);
  const clocked = await cljs(page, events);
  const beats = [...clocked.matchAll(/\[\d+ ([\d.]+)\]/g)].map((m) => Number(m[1]));
  check("start: its own clock, every event after its :dur (0.25 beats at 120 bpm: about 8 a second)",
    beats.length >= 6 && beats.length <= 14 && beats.every((b, i) => i === 0 || Math.abs(b - beats[i - 1] - 0.25) < 1e-6), clocked);
  check("... and the notes it plays end (sustain)", (await cljs(page, sink)).includes("[1 []]") || (await cljs(page, sink)).match(/\[1 \[:p\d+\]\]/) !== null);
  check("the state of a player prints, even playing an endless pattern (its stream is behind a function)",
    Number(await cljs(page, `(count (pr-str (get-in @eng/rt [:states ${pl}])))`)) < 20000);
  await cljs(page, `(send! ${pl} :stop)`);
  await page.waitForTimeout(300);
  const after = await cljs(page, events);
  await page.waitForTimeout(500);
  check("stop: it stops", (await cljs(page, events)) === after, after);
  await cljs(page, "(stop)");
  await cljs(page, `(delete ${pb} ${pl} ${sk})`);
}
