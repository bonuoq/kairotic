// SPDX-License-Identifier: MPL-2.0
// One Claude for every box (discussion #351, step 1): a box read in one common shape (describe-box, describe-tree),
// any class applied to a box apart (apply-class, run-class), both as tools Claude has while it makes a patch; and an
// agent's offers (agent 2 "…"): sibling points of its line, the first played, another chosen. Claude is answered
// here by the test, as in tests/agent.mjs. In the app loaded by tests/browser.mjs with a local work open.
// check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 30000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};
// a promise of the page, awaited: its value as EDN
const awaited = async (page, src, ms = 30000) => {
  await cljs(page, `(do (def craft-got nil) (.then ${src} (fn [r] (def craft-got r))) nil)`);
  return until(page, "craft-got", (x) => x !== "nil", ms);
};
const answer = (code, doc) => JSON.stringify({ content: [{ type: "text", text: "Here it is.\n" + (doc ? "```agent\n" + doc + "\n```\n" : "") + "```clojure\n" + code + "\n```" }], stop_reason: "end_turn" });
const ADD = (k) => ['(box :b1 "inlet" 20 20)', ...Array.from({ length: k }, (_, i) => `(box :b${i + 2} "inc" 20 ${80 + 60 * i})`),
  `(box :b${k + 2} "outlet" 20 ${80 + 60 * k})`, ...Array.from({ length: k + 1 }, (_, i) => `(connect :b${i + 1} 0 :b${i + 2} 0)`)].join("\n");
const DOC1 = '{:about "Adds one." :inlets ["a number"] :outlets ["plus one"]}';
const DOC2 = '{:about "Adds two." :inlets ["a number"] :outlets ["plus two"]}';
const DOC3 = '{:about "Adds three." :inlets ["a number"] :outlets ["plus three"]}';

// the Rule of the Octave up in C (as tests/cac.mjs), its chords as figures; the book's four voices; a wrong one
const RO = `[:voice {:name "bass" :key "C major"} ${["c3 5/3", "d3 6/4/3", "e3 6/3", "f3 6/5", "g3 5/3", "a3 6/3", "b3 6/5", "c4 5/3"]
  .map((x) => { const [p, f] = x.split(" "); return `[:note {:pitch "${p}" :dur 2 :fig "${f}"}]`; }).join(" ")}]`;
const voice = (name, ps) => `[:voice {:name "${name}"} ${ps.split(" ").map((p) => `[:note {:pitch "${p}" :dur 2}]`).join(" ")}]`;
const BOOK = `[:piece ${voice("s", "g5 g5 g5 a5 g5 f5 f5 e5")} ${voice("a", "e5 f5 e5 d5 d5 c5 d5 c5")} ${voice("t", "c5 b4 c5 c5 b4 a4 g4 g4")} ${voice("b", "c3 d3 e3 f3 g3 a3 b3 c4")}]`;
const WRONG = `[:piece ${voice("s", "e5 f5 e5 d5 e5")} ${voice("a", "g4 a4 g4 g4 g4")} ${voice("t", "c4 d4 c4 b3 c4")} ${voice("b", "c3 f3 g3 g2 c3")}]`;

export async function craft(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the craft tests", false); return; }
  const made = [];
  try {
    // ── a tree as Claude reads it ──
    const line = await cljs(page, '(voice-line (mt/notes [:voice "c4/1 d4/0.5 r/0.5 c4+e4/2"]) 0)');
    check("a voice as a line of the melody shorthand: rests where nothing sounds, chords together", line === '"c4/1 d4/0.5 r/0.5 c4+e4/2"', line);
    const ro = await cljs(page, `(let [d (describe-tree ${RO})] [(:key d) (mapv (juxt :name :line :range) (:voices d)) (mapv (juxt :beat :note :fig) (take 3 (:analysis d)))])`);
    check("describe-tree: its key, its voices as lines with their range, the analysis on its notes",
      ro === '["C major" [["bass" "c3/2 d3/2 e3/2 f3/2 g3/2 a3/2 b3/2 c4/2" ["c3" "c4"]]] [[0 "c3" "5/3"] [2 "d3" "6/4/3"] [4 "e3" "6/3"]]]', ro);
    const order = await cljs(page, `(mapv :name (:voices (describe-tree ${BOOK})))`);
    check("... voices from the highest down", order === '["s" "a" "t" "b"]', order);
    const tb = (await cljs(page, '(box "tree" 9700 100)')).trim(); made.push(tb);
    await cljs(page, `(tree! ${tb} ${BOOK})`);
    const db = await cljs(page, `(let [d (describe-box ${tb})] [(:class d) (:ports d) (count (:voices (:tree d))) (:beats (:tree d))])`);
    check("describe-box: a tree box, its class, ports and tree", /^\["tree" \[\d+ \d+\] 4 16\]$/.test(db), db);

    // ── a class applied apart ──
    const judged = (b) => `(.then (run-class "cac judge" [[0 (as-tree ${b})]]) (fn [r] [(:ok r) (some (fn [[o v]] (when (= 1 o) ((juxt :ok :why) v))) (:outs r))]))`;
    const okJ = await awaited(page, judged(tb));
    check("run-class: cac judge on the book's RO in four parts — by the rules", okJ === "[true [true nil]]", okJ);
    const wb = (await cljs(page, '(box "tree" 9700 300)')).trim(); made.push(wb);
    await cljs(page, `(tree! ${wb} ${WRONG})`);
    const bad = await awaited(page, judged(wb));
    check("... and on the inner voices inverted: why it breaks them", /^\[true \[false "[^"]+"\]\]$/.test(bad), bad);
    const told = await awaited(page, `(apply-class "cac judge" ${wb})`);
    check("apply-class: the same, as Claude reads it (its outlets as EDN)", /:ok true/.test(told) && /:why/.test(told), told.slice(0, 300));
    const rb = (await cljs(page, '(box "tree" 9700 500)')).trim(); made.push(rb);
    await cljs(page, `(tree! ${rb} ${RO})`);
    const real = await awaited(page, `(.then (apply-class "cac partimento 3" ${rb}) (fn [r] [(:ok r) (some (fn [[o v]] (when (= 0 o) (count (:voices (:tree v))))) (:outs r))]))`);
    check("... cac partimento 3 on a bass: a realization out, as a tree described (three voices)", real === "[true 3]", real);
    check("nothing went into the work: no box of those classes", (await cljs(page, '(count (filter #(str/starts-with? (:text %) "cac") (vals (:boxes (current)))))')) === "0");
    const none = await awaited(page, '(run-class "no-such-class" [[0 1]])');
    check("a class that does not exist: an error, not a throw", /:ok false/.test(none) && /no class/.test(none), none);
    const tools = await cljs(page, "(set (map #(.-name %) (patch-tools {})))");
    const help = await awaited(page, '(.then ((.-execute (first (filter #(= "class_help" (.-name %)) (patch-tools {})))) #js {:class "cac partimento"} nil) (fn [r] [(.-ok r) (.-class r) (boolean (seq (.-doc r)))]))');
    check("class_help takes a box's text: cac partimento is the class cac, with its doc", help === '[true "cac" true]', help);
    const cat = await cljs(page, '(let [k (first (for [[_ p] lib/packages k (sort (:classes p)) :when (not (contains? @comp/registry k))] k)) line (first (filter #(str/includes? % "official packages") (ai/classes)))] (boolean (and line (or (nil? k) (str/includes? line (str k " (@kairotic/"))))))');
    check("the catalog names the official packages' classes the work does not have yet", cat === "true", cat);
    // ── an offer tried before it is offered: what flows in it (a bass to cac partimento) ──
    const BASS_NONE = `[:voice {:key "A major"} [:note {:pitch "a2" :dur 2}] [:note {:pitch "c#3" :dur 2 :fig "6"}] [:note {:pitch "d3" :dur 2}] [:note {:pitch "b2" :dur 2 :fig "6"}] [:note {:pitch "e3" :dur 2}] [:note {:pitch "e3" :dur 2 :fig "7"}] [:note {:pitch "a2" :dur 4}] [:note {:pitch "c#3" :dur 2 :fig "6"}] [:note {:pitch "d3" :dur 2}] [:note {:pitch "e3" :dur 2}] [:note {:pitch "c#3" :dur 2 :fig "6"}] [:note {:pitch "d3" :dur 2}] [:note {:pitch "e3" :dur 2}] [:note {:pitch "e3" :dur 4}] [:note {:pitch "a3" :dur 2}] [:note {:pitch "g#3" :dur 2 :fig "6"}] [:note {:pitch "f#3" :dur 2}] [:note {:pitch "e3" :dur 2}] [:note {:pitch "d3" :dur 2}] [:note {:pitch "c#3" :dur 2 :fig "6"}] [:note {:pitch "b2" :dur 2}] [:note {:pitch "e3" :dur 2}] [:note {:pitch "a2" :dur 2}] [:note {:pitch "d3" :dur 2}] [:note {:pitch "b2" :dur 2 :fig "6"}] [:note {:pitch "e3" :dur 2}] [:note {:pitch "e3" :dur 2}] [:note {:pitch "e3" :dur 2 :fig "7"}] [:note {:pitch "a2" :dur 4}]]`, BASS_SOME = `[:voice {:key "A major"} [:note {:pitch "a2" :dur 4}] [:note {:pitch "b2" :dur 4 :fig "6"}] [:note {:pitch "c#3" :dur 4 :fig "6"}] [:note {:pitch "d3" :dur 4}] [:note {:pitch "e3" :dur 4}] [:note {:pitch "f#3" :dur 4 :fig "6"}] [:note {:pitch "g#3" :dur 4 :fig "6"}] [:note {:pitch "a3" :dur 4}] [:note {:pitch "f#3" :dur 4}] [:note {:pitch "b2" :dur 4}] [:note {:pitch "e3" :dur 4 :fig "7"}] [:note {:pitch "a2" :dur 4}] [:note {:pitch "d3" :dur 4}] [:note {:pitch "b2" :dur 4 :fig "6/5"}] [:note {:pitch "e3" :dur 4}] [:note {:pitch "a2" :dur 4}]]`;
    const code = (t, txt) => `(str "(box :b1 \\"tree\\" 20 20)\\n(tree! :b1 " (pr-str '${t}) ")\\n(box :b2 \\"${txt}\\" 20 200)\\n(box :b3 \\"tree\\" 20 300)\\n(connect :b1 0 :b2 0)\\n(connect :b2 0 :b3 0)")`;
    const triedNone = await awaited(page, `(agent-trial ${code(BASS_NONE, "cac partimento 4 A")})`, 40000);
    check("agent-trial: a bass with no realization (an agent's offer, 16 bars in A) is an error, with where and why", /b2 .*no realization over this bass — nothing can go on at note \d+/.test(triedNone), triedNone.slice(0, 400));
    const triedSome = await awaited(page, `(agent-trial ${code(BASS_SOME, "cac partimento 3 A major")})`, 40000);
    check("... a bass that has them passes (and A major after the parts is the key, not a style)", triedSome === "[]", triedSome.slice(0, 400));
    const fresh = await cljs(page, '(let [[n] (fresh-ids [{:id "local-x1" :parent nil :events [[:batch [[:data :b3 {:built ["local-x1" 1] :offers [["local-x1" 1]]}] [:pin :b3 ["local-x1" 1]]]]]}])] [(= (:id n) (get-in n [:events 0 1 0 2 :built 0]) (get-in n [:events 0 1 1 2 0]) (get-in n [:events 0 1 0 2 :offers 0 0])) (not= "local-x1" (:id n))])');
    check("a local work opened from a file: an agent's pin and offers follow its points' new ids", fresh === "[true true]", fresh);
    check("both are tools Claude has while it makes a patch", /describe_box/.test(tools) && /apply_class/.test(tools) && /check_patch/.test(tools), tools);

    // ── an agent's offers ──
    const parts = await cljs(page, '[(agent-parts "agent 3 \\"add one\\"") (agent-parts "agent \\"x\\"") (agent-text "x" 2) (agent-offers "agent 9 \\"x\\"")]');
    check("agent 3 \"…\": three offers for each request (at most five)", parts === '[{:offers 3, :request "add one"} {:offers 1, :request "x"} "agent 2 \\"x\\"" 5]', parts);
    check("... the box shows the start of a long one", /^"agent 2 \\"harmonize this melody in four .*…\\""$/.test(await cljs(page, '(shown-text "agent 2 \\"harmonize this melody in four parts in the style of Mozart, at a basic level\\"")')));
    if ((await cljs(page, "(boolean @sample-fn)")) !== "true") { check("Claude is offered in this view", false); return; }
    const bodies = [], answers = [answer(ADD(1), DOC1), answer(ADD(2), DOC2), answer(ADD(3), DOC3)];
    const api = "https://api.anthropic.com/**";
    await page.route(api, (route) => {
      bodies.push(route.request().postData() || "");
      route.fulfill({ status: 200, contentType: "application/json", body: answers[Math.min(bodies.length - 1, answers.length - 1)] });
    });
    const s = "window.kairoticBackend.sample";
    const hadKey = await page.evaluate(`${s}.hasKey()`);
    await page.evaluate(`${s}.hasKey() || ${s}.setKey("sk-ant-test")`);
    try {
      await cljs(page, '(box :b960 "agent 2 \\"add something\\"" 9900 900)');
      await cljs(page, '(box :b961 "number" 9900 840)');
      await cljs(page, '(box :b962 "number" 9900 980)');
      made.push(":b960", ":b961", ":b962");
      await cljs(page, "(ask-agent :b960)");
      const n = await until(page, "(:offers (agent-info :b960))", (x) => x === "2", 30000);
      check("agent 2 \"…\": two offers built, two calls", n === "2" && bodies.length === 2, `${n} · ${bodies.length} calls`);
      check("... Claude is told the patch around the agent, and that it can read its boxes and apply classes",
        /The patch the agent box \(b960\) is in/.test(bodies[0]) && /describe_box/.test(bodies[0]) && /apply_class/.test(bodies[0]), bodies[0].slice(0, 300));
      check("... and, for the second, that it is an offer, and what the first one was", /Offer 2 of 2/.test(bodies[1]) && /Adds one\./.test(bodies[1]));
      check("... two sibling points of its line, from the same point",
        (await cljs(page, "(let [ns (line-nodes (agent-line (get-in (current) [:boxes :b960]))) ps (map (comp :parent ns first) (:offers (:data (get-in (current) [:boxes :b960]))))] [(count (vals ns)) (apply = ps)])")) === "[3 true]");
      check("... it plays the first: what it is, its ports", (await cljs(page, "((juxt :chosen :about :stale) (agent-info :b960))")) === '[1 "Adds one." false]');
      await cljs(page, "(connect :b961 0 :b960 0) (connect :b960 0 :b962 0) (send! :b961 41)");
      check("... 41 in, 42 out", await until(page, "(second (get-in @eng/rt [:shows :b962 0]))", (x) => x === "42") === "42");
      await cljs(page, "(choose-offer :b960 2)");
      check("choose-offer: the second plays, as it said", (await cljs(page, "((juxt :chosen :about :stale) (agent-info :b960))")) === '[2 "Adds two." false]');
      await cljs(page, "(send! :b961 50)");
      check("... 50 in, 52 out", /\b52\b/.test(await until(page, "(pr-str (get-in @eng/rt [:shows :b962]))", (x) => /\b52\b/.test(x))));
      await page.evaluate(() => document.getElementById("tab-claude").click());
      const offers = await until(page, '(.-textContent (.querySelector js/document "#agents-list li[data-agent*=\\"b960\\"] .ag-offers"))', (x) => /offers/.test(x), 5000);
      check("the Agents section shows its offers, to choose from", /offers: 12/.test(offers), offers);
      // the next request goes on from the one chosen (one offer now: agent "…")
      const second = await cljs(page, "(first (second (:offers (:data (get-in (current) [:boxes :b960])))))");
      await cljs(page, '(dispatch! [:text :b960 "agent \\"add more\\""]) (ask-agent :b960)');
      const one = await until(page, "(:built-from (agent-info :b960))", (x) => x === '"add more"', 30000);
      const from = await cljs(page, `(let [b (get-in (current) [:boxes :b960]) ns (line-nodes (agent-line b))] [(= (:parent (get ns (first (agent-front b)))) ${second}) (:pin b)])`);
      check("one more request: a point after the offer chosen, and it follows its line again", one === '"add more"' && from === "[true nil]", `${one} · ${from}`);
    } finally {
      await page.unroute(api);
      if (!hadKey) await page.evaluate(`${s}.setKey(null)`);
    }
    // ── safe mode: a page that froze ──
    await cljs(page, '(risky! "(a gesture)")');
    check("a gesture opens a window: what it was, in this tab's session storage", /a gesture/.test(await page.evaluate(() => sessionStorage.getItem("kairotic-risky") || "")));
    await page.waitForTimeout(4500);
    check("... erased when the window closes (the page did not freeze)", (await page.evaluate(() => sessionStorage.getItem("kairotic-risky"))) === null);
    await page.evaluate(() => sessionStorage.setItem("kairotic-risky", JSON.stringify({ what: "(send! :b3 :bang)", work: "w", t: Date.now() })));
    const froze = await cljs(page, "((juxt :what :work) (froze-last-time))");
    check("a window left open (the page froze): the next page finds what it was, and forgets it", froze === '["(send! :b3 :bang)" "w"]' && (await page.evaluate(() => sessionStorage.getItem("kairotic-risky"))) === null, froze);
    const sb = (await cljs(page, '(box "number" 9900 1200)')).trim(), sc = (await cljs(page, '(box "number" 9900 1260)')).trim();
    made.push(sb, sc);
    await cljs(page, `(connect ${sb} 0 ${sc} 0)`);
    try {
      await cljs(page, '(safe-mode! {:what "(send! :b3 :bang)" :work "w" :t 0})');
      check("safe mode: the engine held, no code runs, the notice on top", (await cljs(page, "[@eng/held @cbox/held (cbox/allowed? \"x\")]")) === "[true true false]" &&
        /Safe mode/.test(await page.evaluate(() => (document.getElementById("safe-banner") || {}).textContent || "")));
      await cljs(page, `(send! ${sb} 7)`);
      await page.waitForTimeout(300);
      check("... a message is not delivered", (await cljs(page, `(second (get-in @eng/rt [:shows ${sc} 0]))`)) !== "7");
      check("... and no class is applied", /safe mode/.test(await awaited(page, '(run-class "cac judge" [[0 [:voice "c4/2"]]])')));
    } finally {
      await cljs(page, '(do (reset! eng/held false) (reset! cbox/held false) (reset! safe-mode nil) (some-> (.getElementById js/document "safe-banner") .remove))');
    }
  } catch (e) {
    check("the craft tests ran: " + (e.message || e), false);
  } finally {
    if (made.length) await cljs(page, `(delete ${made.join(" ")})`).catch(() => null);
  }
}
