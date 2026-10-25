// SPDX-License-Identifier: MPL-2.0
// Tasks (:tasks, inlet :task, [:keep d]) and @kairotic/data (fetch, edn). In the app loaded by
// tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};
// what reached a sink box: prints are drained into the REPL every 200 ms while the engine is off
const got = (page, id) => cljs(page, `(pr-str (get-in @eng/rt [:states ${id}]))`);
const gotHas = (page, id, ...xs) => until(page, `(pr-str (get-in @eng/rt [:states ${id}]))`, (p) => xs.every((x) => p.includes(x)), 3000);
// with the stack of an error, to know where it comes from
const safe = (src) => `(try ${src} (catch :default e (str "ERR " (.-message e) " " (.-stack e))))`;

export async function data(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the data tests", false); return; }
  await cljs(page, "(stop)");
  const events = "(depth-of (norm (:pos @world)))";
  const origin = await page.evaluate(() => location.origin);
  const url = origin + "/tests/assets/data.json";

  // the API for tasks
  const urls = await cljs(page, `[(api/url-of "https://x.org/a.json") (api/url-of (keyword "https://x.org/a/b.json"))
                                  (api/url-of "github:bonuoq/kairotic/tests/assets/data.json")
                                  (api/url-of "github:bonuoq/kairotic@v1/a.json") (api/url-of "hello") (api/url-of 3)]`);
  check("api/url-of: a string, a word as msg sends it, github: through jsDelivr; nothing else",
        urls === '["https://x.org/a.json" "https://x.org/a/b.json" "https://cdn.jsdelivr.net/gh/bonuoq/kairotic@main/tests/assets/data.json" "https://cdn.jsdelivr.net/gh/bonuoq/kairotic@v1/a.json" nil nil]', urls);
  const keys = await cljs(page, `(api/json->edn {"name" 1 "a b" 2 "2024" [{"x/y" 3 "ok?" true}]})`);
  check("api/json->edn: keys become keywords only where they can be read back", keys === '{:name 1, "a b" 2, "2024" [{"x/y" 3, :ok? true}]}', keys);

  // a task: asked from :receive, its outcome back on inlet :task, without ▶; a late answer can be dropped
  await cljs(page, `(comp/define! "tsink" {:io [1 0] :receive (fn [{:keys [value state]}] {:state (conj (or state []) value)})})`);
  await cljs(page, `(comp/define! "ttask"
     {:io [1 1]
      :tasks {:wait (fn [x _] (js/Promise. (fn [ok fail] (js/setTimeout (fn [] (if (= x :boom) (fail (js/Error. "boom")) (ok (* 10 x)))) (if (= x 1) 300 30)))))}
      :receive (fn [{:keys [inlet value state]}]
                 (if (= inlet :task)
                   (if (= (:arg value) (:waiting state)) {:state {} :out [[0 (or (:value value) (:error value))]]} {})
                   {:state {:waiting value} :effects [[:wait value]]}))})`);
  const t = (await cljs(page, '(box "ttask" 9000 100)')).trim();
  const tp = (await cljs(page, '(box "tsink" 9000 160)')).trim();
  await cljs(page, `(connect ${t} 0 ${tp} 0)`);
  await cljs(page, `(send! ${t} 4)`);
  check("a task runs without ▶ and its outcome comes back to the box", (await gotHas(page, tp, "40")).includes("40"), await got(page, tp));
  await cljs(page, `(send! ${t} 1) (send! ${t} 2)`);
  await page.waitForTimeout(600);
  const late = await got(page, tp);
  check("... the answer to an older request, arriving late, is dropped by the box", late === '"[40 20]"', late);
  await cljs(page, `(send! ${t} :boom)`);
  check("... a task that fails comes back as an error", (await gotHas(page, tp, "boom")).includes("boom"), await got(page, tp));
  check("a component with :tasks that are not functions is refused", (await cljs(page, `(lib/validate {:class "bad" :receive identity :tasks {:get 3}})`)).includes(":tasks"));
  await cljs(page, `(delete ${t} ${tp})`);

  // @kairotic/data: fetch keeps what it finds, as a gesture of the history
  const f = (await cljs(page, '(box "fetch" 9300 100)')).trim();
  const loaded = await until(page, '(boolean (comp/lookup "fetch"))', (g) => g === "true", 20000);
  check("fetch brings @kairotic/data", loaded === "true", loaded);
  const e = (await cljs(page, '(box "edn 320 240" 9300 180)')).trim();
  const p = (await cljs(page, '(box "tsink" 9700 180)')).trim();
  await cljs(page, `(connect ${f} 0 ${e} 0) (connect ${e} 0 ${p} 0) (connect ${e} 1 ${p} 0) (connect ${f} 1 ${p} 0)`);
  const before = Number(await cljs(page, events));
  await cljs(page, `(send! ${f} ${JSON.stringify(url)})`);
  const kept = await until(page, `(get-in (current) [:boxes ${f} :data :value :piece])`, (x) => x === '"Kairos"', 6000);
  check("fetch: what is at a URL is kept as the data of the box", kept === '"Kairos"', kept + " " + await got(page, p));
  check("... in one event of the history", Number(await cljs(page, events)) === before + 1, await cljs(page, events));
  check("... with the keys of the JSON as keywords where they can be", (await cljs(page, `(contains? (get-in (current) [:boxes ${f} :data :value]) "2 voices")`)) === "true");
  check("... its status goes out on the right", (await gotHas(page, p, ":ready")).includes(":ready"), await got(page, p));
  check("... and the code of the work writes it with keep!", (await cljs(page, `(boolean (some (fn [l] (clojure.string/starts-with? l "(keep! ${f}")) (clojure.string/split-lines (patch->code (current)))))`)) === "true");
  await cljs(page, `(send! ${f} ${JSON.stringify(url)})`);
  await page.waitForTimeout(400);
  check("... the URL it already keeps is not fetched again: no new event", Number(await cljs(page, events)) === before + 1, await cljs(page, events));
  await cljs(page, `(send! ${f} [:get :voices 1 :name])`);
  const part = await until(page, `(:root (get-in @eng/rt [:states ${e}]))`, (x) => x.includes("bass"), 3000);
  check("... [:get …] sends a part of it", part.includes("bass"), part);
  await cljs(page, `(send! ${f} ${JSON.stringify(origin + "/tests/assets/nothing-here.json")})`);
  const err = await until(page, `(pr-str (get-in @eng/rt [:states ${p}]))`, (x) => x.includes(":error"), 4000);
  check("... a URL that fails says why, on the right", err.includes("404"), err);
  check("... and what it kept stays", (await cljs(page, `(get-in (current) [:boxes ${f} :data :value :piece])`)) === '"Kairos"');

  // edn: the value as a tree
  await cljs(page, `(send! ${f} :bang)`);
  const root = await until(page, `(:piece (:root (get-in @eng/rt [:states ${e}])))`, (x) => x === '"Kairos"', 3000);
  check("edn receives the value", root === '"Kairos"', root);
  const shapes = (expr) => cljs(page, safe(`(let [b (get-in (current) [:boxes ${e}])] ${expr})`));
  // temporary: the helpers of edn, one by one, in the page
  const src = await page.evaluate(async () => (await import("/kairotic/packages/data.mjs")).default.components.find((c) => c.class === "edn").source);
  const cases = ['{}', '{:root 3}', '{:root "s"}', '{:root {:a 1}}', '{:root [1 2]}', '{:root {:a [1]}}', '{:root {:a [1]} :open #{[:a]}}', '{:root {:a 1} :sel [:a]}'];
  const probeSrc = "(let [d " + src + " m {:w 320 :h 240}] [" +
    cases.map((c) => `(try (count ((:draw d) (assoc m :state ${c}))) (catch :default e (str "ERR " (.-message e))))`).join(" ") + " " +
    cases.map((c) => `(try (pr-str ((:gesture d) (assoc m :state ${c} :up true :hit :t0 :dy 0))) (catch :default e (str "ERR " (.-message e))))`).join(" ") + "])";
  const probe = await page.evaluate((s) => { try { return String(scittle.core.eval_string(s)); } catch (e) { return "EVAL ERR " + e.message; } }, probeSrc);
  const tries = cases;
  check("DIAGNOSTIC (temporary)", false, tries.map((t, k) => t).join(" | ") + " => " + probe);
  const lines = await shapes(`(count (filter (fn [s] (and (= :rect (first s)) (number? (:hit (second s))))) (ctl-shapes* (ctl-m ${e} b) b)))`);
  check("... one line per key, closed", lines === "5", lines);
  const svg = await shapes(`(shp/svg (ctl-shapes* (ctl-m ${e} b) b))`);
  console.log("edn view (closed):", svg.length, "characters");
  // the order is the printed order of the keys: "2 voices" :piece :tags :tempo :voices
  await cljs(page, `(send! ${e} [:edn-open [:voices] true])`);
  const open = await until(page, `(count (filter (fn [s] (and (= :rect (first s)) (number? (:hit (second s))))) (let [b (get-in (current) [:boxes ${e}])] (ctl-shapes* (ctl-m ${e} b) b))))`, (x) => x === "7", 3000);
  check("... opening a branch shows its parts", open === "7", open);
  await cljs(page, `(send! ${e} [:edn-open [:voices] true])`);
  check("... the same message again changes nothing", (await cljs(page, `(count (:open (get-in @eng/rt [:states ${e}])))`)) === "1");
  // a press on a line, as the gesture gets it (the rows: "2 voices" :piece :tags :tempo :voices 0 1)
  const g = await shapes(`[((:gesture (comp/lookup "edn")) (assoc (ctl-m ${e} b) :up true :hit 6 :dy 0 :start {}))
                           ((:gesture (comp/lookup "edn")) (assoc (ctl-m ${e} b) :up true :hit :t4 :dy 0 :start {}))
                           ((:gesture (comp/lookup "edn")) (assoc (ctl-m ${e} b) :up false :hit 2 :dy 30 :start {:top 0}))]`);
  check("... a line pressed picks it, its arrow closes it, a drag scrolls", g === "[[:edn-pick [:voices 1]] [:edn-open [:voices] false] [:edn-top -2.142857142857143]]", g);
  await cljs(page, `(send! ${e} [:edn-pick [:voices 1 :name]])`);
  const picked = await gotHas(page, p, "[:voices 1 :name]");
  check("... picking sends the part and its path", picked.includes("bass") && picked.includes("[:voices 1 :name]"), picked);
  await cljs(page, `(send! ${e} [:depth 3])`);
  const deep = await cljs(page, `(count (:open (get-in @eng/rt [:states ${e}])))`);
  check("... depth 3 opens it three levels down", deep === "4", deep);
  // the view, for whoever looks at the log
  console.log("edn view:", await shapes(`(shp/svg (ctl-shapes* (ctl-m ${e} b) b))`));

  // clear forgets what fetch kept, as a gesture
  await cljs(page, `(send! ${f} :clear)`);
  const gone = await until(page, `(get-in (current) [:boxes ${f} :data])`, (x) => x === "nil" || x === "{}", 3000);
  check("fetch: clear forgets what it kept", gone === "nil" || gone === "{}", gone);
  // live: only here, never in the history
  const lv = (await cljs(page, '(box "fetch live" 9300 460)')).trim();
  const n0 = Number(await cljs(page, events));
  await cljs(page, `(send! ${lv} ${JSON.stringify(url)})`);
  const held = await until(page, `(:piece (:value (:got (get-in @eng/rt [:states ${lv}]))))`, (x) => x === '"Kairos"', 6000);
  check("fetch live holds what it finds only here", held === '"Kairos"' && Number(await cljs(page, events)) === n0, held);
  await cljs(page, `(delete ${f} ${e} ${p} ${lv})`);
}
