// SPDX-License-Identifier: MPL-2.0
// Issue #165: in the Code tab, long lines are folded (saying how much they hide), the lines of the boxes selected
// in the patch are marked, and the cursor on a line of a box selects it.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 6000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(60); }
  return got;
};

// the number of the first line of the Code tab that starts with `start`
const lineOf = (page, start) => cljs(page, `(some (fn [[i l]] (when (str/starts-with? l ${JSON.stringify(start)}) (inc i))) (map-indexed vector (str/split-lines (.getValue @code-ed))))`);

export async function codetab(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the Code tab tests", false); return; }
  await cljs(page, '(side-panel true) (select-tab! "code") (show-code-view! :calls) (swap! ui assoc :dirty false)');
  const ready = await until(page, "(boolean (and @code-ed (.-foldLong @code-ed)))", (g) => g === "true", 20000);
  check("the Code tab's editor can fold long lines and mark lines", ready === "true", ready);
  if (ready !== "true") return;

  // a script box with a long source, and two boxes connected
  const s = (await cljs(page, '(box "script" 9800 300)')).trim();
  const long = "(fn [m] {:out [[0 (str " + Array.from({ length: 300 }, (_, i) => `"w${i}"`).join(" ") + ")]]})";
  await cljs(page, `(code ${s} ${JSON.stringify(long)})`);
  const a = (await cljs(page, '(box "mtof" 9800 400)')).trim();
  const b = (await cljs(page, '(box "mtof" 9900 400)')).trim();
  await cljs(page, `(connect ${a} 0 ${b} 0) (swap! ui assoc :sel nil)`);

  // ── long lines folded ──
  // the editor draws only the lines in view: the tab is scrolled to the line of this box first (the work these
  // tests share has long lines of other suites too)
  const ownFold = (id) => page.evaluate((id) => {
    const f = [...document.querySelectorAll("#panel-code .cm-fold-long")].find((e) => (e.closest(".cm-line")?.textContent || "").startsWith(`(code ${id} `));
    return f ? f.textContent : null;
  }, id);
  const showOwn = async () => cljs(page, `(.showLine @code-ed ${await lineOf(page, `(code ${s} `)})`);
  await until(page, `(boolean (some (fn [l] (str/starts-with? l "(code ${s} ")) (str/split-lines (.getValue @code-ed))))`, (g) => g === "true");
  await showOwn();
  let label = null;
  for (let i = 0; i < 40 && !label; i++) { label = await ownFold(s); if (!label) { await page.waitForTimeout(80); await showOwn(); } }
  check("a long source is folded in the Code tab", !!label, String(label));
  check("... saying how many characters it hides", /⋯ [\d ]+ characters/.test(label || ""), String(label));
  check("... and its beginning is still there", (await cljs(page, `(str/includes? (.-textContent (.-contentDOM (.-view @code-ed))) "(code ${s} \\"(fn [m]")`)) === "true");

  // ── the selected box, marked ──
  await cljs(page, `(swap! ui assoc :sel [:box ${a}])`);
  const marked = await page.evaluate(() => [...document.querySelectorAll("#panel-code .cm-mark-line")].map((e) => e.textContent));
  check("selecting a box marks its lines in the code", marked.length >= 2 && marked.every((t) => new RegExp(`${a.slice(1)}(?![0-9])`).test(t)), JSON.stringify(marked));
  check("... its box and its line", marked.some((t) => t.startsWith(`(box ${a} `)) && marked.some((t) => t.startsWith(`(connect ${a} 0 ${b} 0)`)));
  await cljs(page, "(swap! ui assoc :sel nil)");
  check("nothing selected, nothing marked", (await page.evaluate(() => document.querySelectorAll("#panel-code .cm-mark-line").length)) === 0);

  // ── the cursor on a line selects its box ──
  const n = await lineOf(page, `(box ${b} `);
  await cljs(page, `(let [v (.-view @code-ed) l (.line (.. v -state -doc) ${n})] (.dispatch v #js {:selection #js {:anchor (.-from l)} :userEvent "select.pointer"}))`);
  check("the cursor on a line of a box selects it in the patch", (await until(page, "(:sel @ui)", (g) => g === `[:box ${b}]`)) === `[:box ${b}]`);
  const c = await lineOf(page, `(connect ${a} 0 ${b} 0)`);
  await cljs(page, `(let [v (.-view @code-ed) l (.line (.. v -state -doc) ${c})] (.dispatch v #js {:selection #js {:anchor (.-from l)} :userEvent "select.pointer"}))`);
  check("... on a connect, the two boxes", (await until(page, "(sel-ids)", (g) => g === `#{${a} ${b}}` || g === `#{${b} ${a}}`)).replace(/[#{}]/g, "").split(" ").sort().join(" ") === [a, b].sort().join(" "));

  // ── a line unfolded stays so ──
  // (the work these tests share has long lines of other suites: the one of this box)
  await showOwn();
  await page.waitForTimeout(80);
  const clicked = await page.evaluate((id) => {
    const f = [...document.querySelectorAll("#panel-code .cm-fold-long")].find((e) => (e.closest(".cm-line")?.textContent || "").startsWith(`(code ${id} `));
    if (f) f.click();
    return !!f;
  }, s);
  check("the folded part of this box's line is there to click", clicked);
  const shown = await until(page, `(str/includes? (.-textContent (.-contentDOM (.-view @code-ed))) "w299")`, (g) => g === "true");
  check("a click shows the folded part", shown === "true");
  await cljs(page, `(move ${a} 9800 420)`);
  await until(page, `(str/includes? (.getValue @code-ed) "9800 420")`, (g) => g === "true");
  await showOwn();
  await page.waitForTimeout(80);
  check("... and it stays shown when the code is written again", (await ownFold(s)) === null
        && (await cljs(page, `(str/includes? (.-textContent (.-contentDOM (.-view @code-ed))) "w299")`)) === "true");

  await cljs(page, `(swap! ui assoc :sel nil) (reset! code-unfolded #{}) (delete ${s} ${a} ${b})`);

  // ── live coding in the Code tab (discussion #407) ──
  const lastEv = "(last (:events (node (first (:pos @world)))))";
  const c1 = (await cljs(page, '(box "mtof" 9800 600)')).trim();
  const c2 = (await cljs(page, '(box "freqt" 9900 600)')).trim();
  await cljs(page, `(stroke ${c2} [[0 220] [1 440]])`);
  const strokes = `(count (:strokes (get-in (current) [:boxes ${c2} :data])))`;
  // applying the tab: only what it changes, as one event
  const r1 = await cljs(page, `(run-code! (str/replace (patch->code (current)) "(box ${c1} \\"mtof\\"" "(box ${c1} \\"ftom\\""))`);
  check("applying the Code tab with one text changed makes one change", r1 === "1", r1 + " · " + await cljs(page, lastEv));
  check("... written as that change, not as the whole patch (:load)", (await cljs(page, lastEv)) === `[:text ${c1} "ftom"]`, await cljs(page, lastEv));
  check("... and a buffer it did not touch keeps its strokes", (await cljs(page, strokes)) === "1", await cljs(page, strokes));
  check("applying it again unchanged changes nothing", (await cljs(page, "(run-code! (patch->code (current)))")) === "0");

  // forms of the tab, found by the cursor
  check("the top-level forms of some code", (await cljs(page, '(top-forms "(a 1) ;c\n[b] x #{1} \\"s\\" (c (d))")'))
        === "[[0 5] [9 12] [13 14] [15 19] [20 23] [24 31]]", await cljs(page, '(top-forms "(a 1) ;c\n[b] x #{1} \\"s\\" (c (d))")'));
  check("... the form the cursor is in", (await cljs(page, '(form-at "(a 1) ;c\n[b] x #{1} \\"s\\" (c (d))" 28)')) === "[24 31]");
  check("... or the one just before it (a comment between)", (await cljs(page, '(form-at "(a 1) ;c\n" 8)')) === "[0 5]");
  check("... and none in an empty place", (await cljs(page, '(form-at "  (a 1)" 0)')) === "nil");
  check("calls that make the patch, and those that do not",
        (await cljs(page, '[(patch-form? "(box \\"osc~\\") (connect :b1 0 :b2 0)") (patch-form? "(play)") (patch-form? "(def o (box \\"osc~\\"))")]')) === "[true false false]");

  // a form alone: a box written again as it was keeps what it keeps
  const r2 = await cljs(page, `(eval-calls! "(box ${c2} \\"freqt\\" 9950 600)")`);
  check("a box written again in another place is one change", r2 === "1", r2);
  check("... a move", (await cljs(page, lastEv)) === `[:move ${c2} 9950 600]`, await cljs(page, lastEv));
  check("... and its strokes stay", (await cljs(page, strokes)) === "1", await cljs(page, strokes));
  check("a connect alone", (await cljs(page, `(eval-calls! "(connect ${c1} 0 ${c2} 0)")`)) === "1"
        && (await cljs(page, `(boolean (some #{[${c1} 0 ${c2} 0]} (:lines (current))))`)) === "true");

  // ⇧+Enter: the form at the cursor, written at the end of the tab
  await cljs(page, '(swap! ui assoc :dirty false) (render-code (current))');
  await cljs(page, `(let [t (str (shown-code (current)) "\n(box \\"mtof\\" 9800 700)")] (.setValue @code-ed t)
                      (.dispatch (.-view @code-ed) #js {:selection #js {:anchor (count t)}}) (swap! ui assoc :dirty true) (eval-code-form!))`);
  const c3 = await cljs(page, '(some (fn [[id b]] (when (and (= "mtof" (:text b)) (= 9800 (:x b)) (= 700 (:y b))) id)) (:boxes (current)))');
  check("⇧+Enter evaluates the form at the cursor: a new box", /^:b\d+$/.test(c3), c3);
  check("... and the tab, with nothing else unapplied, is written again from the patch",
        (await cljs(page, `[(:dirty @ui) (str/includes? (.getValue @code-ed) "(box ${c3} \\"mtof\\" 9800 700)")]`)) === "[false true]",
        await cljs(page, `[(:dirty @ui) (str/includes? (.getValue @code-ed) "(box ${c3} ")]`));

  await cljs(page, `(delete ${c1} ${c2} ${c3})`);

  // ── a short syntax (#407, step 2): to, chains, the Live view ──
  const nEv = "(count (:events (node (first (:pos @world)))))";
  const t0 = await cljs(page, nEv);
  const t1 = (await cljs(page, '(box "mtof" 9800 800)')).trim();
  const t2 = (await cljs(page, `(to ${t1} "ftom")`)).trim();
  check("to makes a box below its source and returns its id", /^:b\d+$/.test(t2)
        && (await cljs(page, `(let [b (get-in (current) [:boxes ${t2}])] [(:text b) (:x b) (:y b)])`)) === `["ftom" 9800 ${800 + 60}]`,
        await cljs(page, `(get-in (current) [:boxes ${t2}])`));
  check("... connected to it, as one event", (await cljs(page, `(boolean (some #{[${t1} 0 ${t2} 0]} (:lines (current))))`)) === "true"
        && Number(await cljs(page, nEv)) === Number(t0) + 2, `${t0} → ${await cljs(page, nEv)}`);
  check("... and with an id, it only connects", (await cljs(page, `(to ${t2} ${t1})`)) === t1
        && (await cljs(page, `(boolean (some #{[${t2} 0 ${t1} 0]} (:lines (current))))`)) === "true");
  await cljs(page, `(delete ${t1} ${t2})`);
  check("chains of calls that make the patch", (await cljs(page, '[(patch-call? "(-> (box \\"osc~\\") (to \\"dac~\\"))") (patch-call? "(-> o (to 0 \\"dac~ 1 2\\" 1))") (patch-call? "(-> 1 inc)")]')) === "[true true false]");
  const before = Number(await cljs(page, nEv));
  const ch = await cljs(page, '(eval-calls! "(-> (box \\"mtof\\" 9800 900) (to \\"ftom\\") (to \\"mtof\\"))")');
  check("a chain evaluated alone: three boxes and two lines, one event", ch === "5" && Number(await cljs(page, nEv)) === before + 1, `${ch} · ${before} → ${await cljs(page, nEv)}`);
  await cljs(page, '(apply delete (keep (fn [[id b]] (when (and (= 9800 (:x b)) (<= 900 (:y b) 1020)) id)) (:boxes (current))))');

  // blocks: the lines between empty ones
  check("the block around the cursor", (await cljs(page, '(block-at "a\\nb\\n\\nc\\nd\\n" 5)')) === "[5 8]", await cljs(page, '(block-at "a\\nb\\n\\nc\\nd\\n" 5)'));
  check("... and from an empty line, the block above", (await cljs(page, '(block-at "a\\nb\\n\\nc" 4)')) === "[0 3]");

  // the Live view: yours, evaluated a form or a block at a time, never written over
  await cljs(page, "(show-code-view! :live)");
  check("the Live view is shown, Calls and Data hidden", (await page.evaluate(() => {
    const p = document.getElementById("panel-code");
    const vis = (sel, id) => { const e = p.querySelector(sel) || document.getElementById(id); return e && !e.hidden; };
    return [vis(".live-host", "live"), vis(".code-host", "code"), vis(".data-host", "edn")].join(" ");
  })) === "true false false");
  const liveCode = ';; mine\n(def lv (box "mtof" 9800 1100))\n\n(-> lv (to "ftom"))\n';
  await cljs(page, `(set-live-text! ${JSON.stringify(liveCode)}) (.dispatch (.-view @live-ed) #js {:selection #js {:anchor 20}}) (eval-live! :block)`);
  const lv = await cljs(page, "lv");
  check("Ctrl/⌘+Enter in the Live view evaluates its block: a def and a box", /^:b\d+$/.test(lv) && (await cljs(page, `(:text (get-in (current) [:boxes ${lv}]))`)) === '"mtof"', lv);
  await cljs(page, `(.dispatch (.-view @live-ed) #js {:selection #js {:anchor ${liveCode.indexOf("(to")}}}) (eval-live! :form)`);
  check("⇧+Enter there evaluates the form at the cursor: the chain", (await cljs(page, `(some (fn [[a _ b _]] (when (= a ${lv}) b)) (:lines (current)))`)) !== "nil");
  check("... and the Live view keeps what you wrote", (await cljs(page, "(live-text)")) === JSON.stringify(liveCode));
  check("... kept in this browser for the work", (await cljs(page, "(= (live-text) (.getItem js/localStorage (live-key)))")) === "true");
  await cljs(page, `(apply delete (keep (fn [[id b]] (when (and (= 9800 (:x b)) (<= 1100 (:y b) 1200)) id)) (:boxes (current)))) (show-code-view! :calls)`);

  // ── names (#407): (box :osc "osc~ 220") is always the same box, still :bN for the system ──
  check("a name is a keyword that is not a box id", (await cljs(page, "[(live-name? :osc) (live-name? :b7) (live-name? \"osc\") (live-name? :a/b)]")) === "[true false false false]");
  const e0 = Number(await cljs(page, nEv));
  const n1 = (await cljs(page, '(box :tosc "mtof" 9800 1300)')).trim();
  check("a box made by its name has an id of the system and the name", /^:b\d+$/.test(n1) && (await cljs(page, `(:name (get-in (current) [:boxes ${n1}]))`)) === ":tosc"
        && Number(await cljs(page, nEv)) === e0 + 1, `${n1} ${await cljs(page, `(get-in (current) [:boxes ${n1}])`)}`);
  const n1b = (await cljs(page, '(box :tosc "ftom")')).trim();
  check("... made again by its name, it is the same box, its text changed in one event", n1b === n1
        && (await cljs(page, `(let [b (get-in (current) [:boxes ${n1}])] [(:text b) (:x b) (:y b)])`)) === '["ftom" 9800 1300]'
        && (await cljs(page, lastEv)) === `[:text ${n1} "ftom"]`, `${n1b} · ${await cljs(page, lastEv)}`);
  check("... and as it was, nothing", (await cljs(page, '(box :tosc "ftom")')).trim() === n1 && (await cljs(page, lastEv)) === `[:text ${n1} "ftom"]`);
  const n2 = (await cljs(page, '(box :tmtof "mtof" 9900 1300)')).trim();
  await cljs(page, "(connect :tosc 0 :tmtof 0)");
  check("names are ids for every command: a line between two named boxes, kept by their ids",
        (await cljs(page, `(boolean (some #{[${n1} 0 ${n2} 0]} (:lines (current))))`)) === "true");
  await cljs(page, '(text! :tmtof "ftom")');
  check("... text!", (await cljs(page, `(:text (get-in (current) [:boxes ${n2}]))`)) === '"ftom"');
  check("... to, with a name, connects to that box", (await cljs(page, "(to :tmtof :tosc)")) === n1);
  check("the work's code writes the names", (await cljs(page, `(str/includes? (patch->code (current)) "(name-box ${n1} :tosc)")`)) === "true"
        && (await cljs(page, "(run-code! (patch->code (current)))")) === "0");
  await cljs(page, `(name-box ${n2} :tosc)`);
  check("a name given to another box leaves the first", (await cljs(page, `[(:name (get-in (current) [:boxes ${n1}])) (:name (get-in (current) [:boxes ${n2}]))]`)) === "[nil :tosc]");
  let tag = null;
  for (let i = 0; i < 30 && tag !== `${n2.slice(1)} :tosc`; i++) {
    tag = await page.evaluate((id) => document.querySelector(`#scene g.box[data-box="${id}"] text.idtag`)?.textContent, n2.slice(1));
    if (tag !== `${n2.slice(1)} :tosc`) await page.waitForTimeout(60);
  }
  check("... and the id shown over a box says its name", tag === `${n2.slice(1)} :tosc`, String(tag));
  await cljs(page, `(delete ${n1} ${n2})`);

  // ── chains that can be evaluated again (#407): to with a name ──
  const chain = (t) => `(eval-calls! "(-> (box :ca \\"mtof\\" 9800 1500) (to :cb \\"${t}\\") (to :cc \\"mtof\\"))")`;
  const k0 = Number(await cljs(page, nEv));
  await cljs(page, chain("ftom"));
  const [ca, cb, cc] = await Promise.all([":ca", ":cb", ":cc"].map((n) => cljs(page, `(rid ${n})`)));
  check("a chain with names: three named boxes below each other, two lines, one event",
        [ca, cb, cc].every((x) => /^:b\d+$/.test(x)) && Number(await cljs(page, nEv)) === k0 + 1
        && (await cljs(page, `[(:y (get-in (current) [:boxes ${cb}])) (:y (get-in (current) [:boxes ${cc}]))]`)) === "[1560 1620]"
        && (await cljs(page, `(every? (set (:lines (current))) [[${ca} 0 ${cb} 0] [${cb} 0 ${cc} 0]])`)) === "true",
        `${ca} ${cb} ${cc} · ${k0} → ${await cljs(page, nEv)}`);
  check("... evaluated again as it was: nothing changes", (await cljs(page, chain("ftom"))) === "0" && Number(await cljs(page, nEv)) === k0 + 1);
  await cljs(page, `(move ${cb} 9950 1560)`);
  check("... with a text changed: that change only, and a box moved by hand stays where it is",
        (await cljs(page, chain("mtof"))) === "1" && (await cljs(page, lastEv)) === `[:text ${cb} "mtof"]`
        && (await cljs(page, `(:x (get-in (current) [:boxes ${cb}]))`)) === "9950",
        await cljs(page, lastEv));
  await cljs(page, `(delete ${ca} ${cb} ${cc})`);

  // ── the work's code in chains (#407, a lens of the code: #380, #399) ──
  const x = (await cljs(page, '(box "mtof" 9800 1800)')).trim(), y = (await cljs(page, '(box "ftom" 9800 1860)')).trim();
  const z = (await cljs(page, '(box "mtof" 9800 1920)')).trim(), w = (await cljs(page, '(box "mtof" 9900 1920)')).trim();
  await cljs(page, `(connect ${x} 0 ${y} 0) (connect ${y} 0 ${z} 0) (connect ${w} 0 ${x} 0) (connect ${w} 0 ${y} 0)`);
  const chn = await cljs(page, "(lines->chains (current))");
  check("lines that follow each other are written as a chain", chn.includes(`"(-> ${x} (to ${y}) (to ${z}))"`), chn.slice(-300));
  check("... lines in a row from one box, with doto", chn.includes(`"(doto ${w} (to ${x}) (to ${y}))"`), chn.slice(-300));
  check("the whole work written in chains gives back its lines, in their order",
        (await cljs(page, "(= (:lines (current)) (:lines (build (patch->code (current) :chains))))")) === "true");
  check("... and applied, it changes nothing", (await cljs(page, "(run-code! (patch->code (current) :chains))")) === "0");
  await cljs(page, `(name-box ${x} :cx)`);
  check("names are written in place of ids", (await cljs(page, "(lines->chains (current))")).includes(`"(-> :cx (to ${y}) (to ${z}))"`));
  const v = (await cljs(page, '(box "+" 9900 1980)')).trim();
  await cljs(page, `(connect ${z} 0 ${v} 1) (connect ${v} 0 ${w} 0)`);
  check("other ports are written in the step", (await cljs(page, "(lines->chains (current))")).includes(`"(-> ${z} (to 0 ${v} 1) (to ${w}))"`), await cljs(page, "(last (lines->chains (current)))"));
  await cljs(page, '(swap! ui assoc :dirty false) (chains! true)');
  check("the Code tab writes the work in chains when asked", (await cljs(page, `(str/includes? (.getValue @code-ed) "(-> :cx (to ${y})")`)) === "true"
        && (await page.evaluate(() => document.getElementById("code-chains").getAttribute("aria-pressed"))) === "true");
  await cljs(page, '(chains! false)');
  check("... and a connect each again", (await cljs(page, `(str/includes? (.getValue @code-ed) "(connect :b")`)) === "true"
        && (await cljs(page, '(.getItem js/localStorage "kairotic.code-style")')) === '"flat"');
  await cljs(page, `(delete ${x} ${y} ${z} ${w} ${v}) (chains! true)`);
  check("chains are the default writing (#433)", (await cljs(page, '(do (.removeItem js/localStorage "kairotic.code-style") (try (some-> (.getItem js/localStorage "kairotic.code-style") keyword) (catch :default _ nil)))')) === "nil"
        && (await cljs(page, "@code-style")) === ":chains");

  // ── a chain owns the lines it wrote (#432) ──
  await cljs(page, '(.removeItem js/localStorage (chains-key))');
  await cljs(page, '(eval-calls! "(-> (box :pa \\"mtof\\" 9800 2100) (to :pb \\"ftom\\") (to :pc \\"mtof\\"))")');
  const [pa, pb, pc] = await Promise.all([":pa", ":pb", ":pc"].map((n) => cljs(page, `(rid ${n})`)));
  await cljs(page, `(connect ${pa} 0 ${pc} 0)`);   // a line made by something else
  const k1 = Number(await cljs(page, nEv));
  const r432 = await cljs(page, '(eval-calls! "(-> :pa (to :pd \\"ftom\\") (to :pb \\"ftom\\") (to :pc \\"mtof\\"))")');
  const pd = await cljs(page, "(rid :pd)");
  const has = (l) => cljs(page, `(boolean (some #{${l}} (:lines (current))))`);
  check("a chain evaluated again with a box put in: the box and its lines, in one event", /^:b\d+$/.test(pd)
        && (await has(`[${pa} 0 ${pd} 0]`)) === "true" && (await has(`[${pd} 0 ${pb} 0]`)) === "true" && Number(await cljs(page, nEv)) === k1 + 1, r432);
  check("... the line it no longer writes is taken away", (await has(`[${pa} 0 ${pb} 0]`)) === "false");
  check("... the lines it still writes, and a line made by something else, stay",
        (await has(`[${pb} 0 ${pc} 0]`)) === "true" && (await has(`[${pa} 0 ${pc} 0]`)) === "true");
  check("... and what it wrote is kept for the work, by the box it starts from",
        (await cljs(page, `(= #{[${pa} 0 ${pd} 0] [${pd} 0 ${pb} 0] [${pb} 0 ${pc} 0]} (get (owned-lines) ${pa}))`)) === "true");
  await cljs(page, `(delete ${pa} ${pb} ${pc} ${pd})`);

  // ── a patch as data (#407): => plays EDN ──
  check("a class with ~ written with -, a class ending in - itself", (await cljs(page, '[(class-name :osc-) (class-name :-) (class-name :!-) (class-name "osc~") (class-name :mtof)]'))
        === '["osc~" "-" "!-" "osc~" "mtof"]');
  check("a box is a vector that starts with a class; any other vector is in parallel",
        (await cljs(page, "[(box-vec? [:gain- 0.2]) (box-vec? [:map 'inc]) (box-vec? [:_ :_]) (box-vec? [:osc :amp]) (box-vec? [[:mtof] [:mtof]])]")) === "[true true false false false]");
  check("... and writes its text", (await cljs(page, "(box-text [:gain- 0.2])")) === '"gain~ 0.2"' && (await cljs(page, '(box-text ["dispatch" 2 {60 0}])')) === '"dispatch 2 {60 0}"');
  const k2 = Number(await cljs(page, nEv));
  const fd = await cljs(page, "(=> {:fo [:mtof]} [:ftom] [:_ :_] [:+])");
  const fo = await cljs(page, "(rid :fo)"), fg = await cljs(page, `(some (fn [[a _ b _]] (when (= a ${fo}) b)) (:lines (current)))`);
  const txt = (id) => cljs(page, `(:text (get-in (current) [:boxes ${id}]))`);
  check("=>: the boxes in series, a name, as one event", /^:b\d+$/.test(fo) && (await txt(fg)) === '"ftom"' && (await txt(fd)) === '"+"'
        && Number(await cljs(page, nEv)) === k2 + 1, `${fo} ${fg} ${fd}`);
  check("... [:_ :_]: one wire split in two, on the inlets 0 and 1 of the box after", (await has(`[${fg} 0 ${fd} 0]`)) === "true" && (await has(`[${fg} 0 ${fd} 1]`)) === "true");
  check("... each box below the one that feeds it", (await cljs(page, `(- (:y (get-in (current) [:boxes ${fg}])) (:y (get-in (current) [:boxes ${fo}])))`)) === "60");
  await cljs(page, "(=> {:fo [:mtof]} [:ftom] [:_ :_] [:+])");
  check("evaluated again as it was: nothing changes", Number(await cljs(page, nEv)) === k2 + 1);
  await cljs(page, "(=> {:fo [:mtof]} [:ftom 1] [:_ :_] [:+])");
  check("... a number changed: that box's text only", (await cljs(page, lastEv)) === `[:text ${fg} "ftom 1"]`, await cljs(page, lastEv));
  await cljs(page, "(=> {:fo [:mtof]} [:mtof 2] [:ftom 1] [:_ :_] [:+])");
  const fl = await cljs(page, `(some (fn [[a _ b _]] (when (= a ${fo}) b)) (:lines (current)))`);
  check("... a box put in: only that box new, the others the same, the old wire taken away",
        fl !== fg && (await txt(fl)) === '"mtof 2"' && (await has(`[${fl} 0 ${fg} 0]`)) === "true" && (await has(`[${fo} 0 ${fg} 0]`)) === "false" && (await txt(fg)) === '"ftom 1"', `${fl} ${fg}`);
  await cljs(page, "(=> {:fo [:mtof]} [:mtof 2] #_[:ftom 1] [:_ :_] [:+])");
  check("... #_ leaves a box out: it goes, its wires with it", (await cljs(page, `(contains? (:boxes (current)) ${fg})`)) === "false" && (await has(`[${fl} 0 ${fd} 1]`)) === "true");
  await cljs(page, "(=> {:fv [:mtof (* 2 110)]})");
  check("arguments are values: computed", (await txt(await cljs(page, "(rid :fv)"))) === '"mtof 220"');
  await cljs(page, `(delete ${fo} ${fl} ${fd} (rid :fv))`);

  // voices: each chain known by its key; the frame never taken away
  const k3 = Number(await cljs(page, nEv));
  await cljs(page, "(=> {:frame {:vout [:+]} :va [:=> [:mtof 1] :vout] :vb [:=> [:mtof 2] [:ftom] :vout]})");
  const vout = await cljs(page, "(rid :vout)");
  const into = () => cljs(page, `(vec (sort (keep (fn [[a _ b _]] (when (= b ${vout}) (:text (get-in (current) [:boxes a])))) (:lines (current)))))`);
  check("voices: each chain made, into the frame's box, as one event", (await into()) === '["ftom" "mtof 1"]' && Number(await cljs(page, nEv)) === k3 + 1, await into());
  await cljs(page, "(=> {:frame {:vout [:+]} :va [:=> [:mtof 1] :vout]})");
  check("... a voice taken out of the map stops: its boxes go, the frame stays", (await into()) === '["mtof 1"]' && (await cljs(page, `(contains? (:boxes (current)) ${vout})`)) === "true", await into());
  await cljs(page, "(=> {:frame {:vout [:+]} :va [:=> [:mtof 3] :vout]})");
  check("... a voice changed: only what changed", (await into()) === '["mtof 3"]' && (await cljs(page, lastEv)).startsWith("[:text "), await cljs(page, lastEv));
  await cljs(page, `(=> {:frame {:vout [:+]}}) (delete ${vout})`);

}
