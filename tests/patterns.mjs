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
  const pkey = `(pr-str (:key (:pattern (get-in @eng/rt [:states ${pl}]))))`;
  const k = await until(page, pkey, (x) => x.includes(":pbind"));
  check("a pbind sends its pattern by itself when it is written and connected", k.includes("{:degree [0 2 4], :dur [0.5 0.5 1]} 7 1"), k);
  check("... its summary is the status of the code box",
    (await cljs(page, `(get-in (compilation ${pb}) [:info :summary])`)) === '"2 keys · 3 events a pass"', await cljs(page, `(pr-str (compilation ${pb}))`));

  const sink = `(pr-str (get-in @eng/rt [:states ${sk}]))`;
  const events = `(pr-str (mapv (fn [[_ e]] [(:degree e) (:beat e)]) (filter (fn [[o]] (= o 2)) (get-in @eng/rt [:states ${sk}]))))`;
  const clear = () => cljs(page, `(swap! eng/rt assoc-in [:states ${sk}] [])`);

  // steps: a bang plays the next event now (messages travel without ▶)
  await clear();
  await cljs(page, `(send! ${pl} :bang)`);
  const s1 = await until(page, sink, (x) => x.includes("[3 0]"));
  check("a bang: the event, the Hz and voice ids of what sounds, and the beat",
    s1.includes("[2 {:degree 0, :dur 0.5, :beat 0, :hz [261.626], :ids [:p1]}]") && s1.includes("[1 [:p1]]") && s1.includes("[0 [261.626]]"), s1);
  await cljs(page, `(send! ${pl} :bang) (send! ${pl} :bang) (send! ${pl} :bang)`);
  check("... the next ones, and again from the beginning at the end",
    (await until(page, events, (x) => x.split("[").length > 5)) === "[[0 0] [2 0.5] [4 1] [0 0]]", await cljs(page, events));

  // a position in beats
  await clear();
  await cljs(page, `(send! ${pl} 0)`);
  await cljs(page, `(send! ${pl} 1.2)`);
  check("a position: what starts at it, then the events whose start it crosses",
    (await until(page, events, (x) => x.includes("[4 1]"))) === "[[0 0] [2 0.5] [4 1]]", await cljs(page, events));
  await clear();
  await cljs(page, `(send! ${pl} 0.2)`);
  await page.waitForTimeout(200);
  check("... going back moves there silently", (await cljs(page, events)) === "[]", await cljs(page, events));
  check("... and lets go of what sounded", (await cljs(page, sink)).includes("[1 []]"), await cljs(page, sink));
  await cljs(page, `(send! ${pl} 0.6)`);
  check("... and goes on from there", (await until(page, events, (x) => x.includes("[2 0.5]"))) === "[[2 0.5]]", await cljs(page, events));

  // the same pattern again changes nothing; a new one goes on from the same place
  const before = await cljs(page, `(pr-str (:pos (get-in @eng/rt [:states ${pl}])))`);
  await cljs(page, "(refill-data!)");
  await page.waitForTimeout(300);
  check("the same pattern again changes nothing", (await cljs(page, `(pr-str (:pos (get-in @eng/rt [:states ${pl}])))`)) === before);
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
  await cljs(page, `(connect ${pc} 0 ${pl} 1)`);
  await until(page, pkey, (x) => x.includes(":code"));
  await clear();
  await cljs(page, `(send! ${pl} :reset) (send! ${pl} :bang) (send! ${pl} :bang)`);
  check("a pattern box: events from code", (await until(page, sink, (x) => x.includes(":note 61"))).includes("{:note 61, :dur 0.25, :beat 0.25"), await cljs(page, sink));
  await cljs(page, `(code ${pc} "(map (fn [_] {:note (+ 60 (rand-int 12))}) (range 6))")`);
  const notes = `(pr-str (mapv :note (take 6 (api/pattern-events (:pattern (get-in @eng/rt [:states ${pl}]))))))`;
  await until(page, pkey, (x) => x.includes("rand-int"));
  const n1 = await cljs(page, notes);
  check("... with its randomness seeded: every stream the same", n1 === (await cljs(page, notes)) && n1.startsWith("["), n1);
  check("... and a mistake is told in its status",
    (await (async () => { await cljs(page, `(code ${pc} "(map inc")`); return until(page, `(pr-str (:status (compilation ${pc})))`, (x) => x === ":error"); })()) === ":error");

  // its own clock, with ▶
  await cljs(page, `(delete ${pc})`);
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
  await cljs(page, `(send! ${pl} :stop)`);
  await page.waitForTimeout(300);
  const after = await cljs(page, events);
  await page.waitForTimeout(500);
  check("stop: it stops", (await cljs(page, events)) === after, after);
  await cljs(page, "(stop)");
  await cljs(page, `(delete ${pb} ${pl} ${sk})`);
}
