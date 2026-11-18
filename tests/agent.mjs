// SPDX-License-Identifier: MPL-2.0
// The agent box (issue #269): its request is its text, Claude builds its content in a line of its own, a patch
// that fails the checks goes back to Claude with its errors, a message to its last inlet asks again, and once
// built it plays with no call. Claude is answered here by the test (Pages: your own key, the API routed), with
// patches that add one, then two. In the app already loaded by tests/browser.mjs. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 20000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};
const answer = (code, doc) => JSON.stringify({ content: [{ type: "text", text: "Here it is.\n" + (doc ? "```agent\n" + doc + "\n```\n" : "") + "```clojure\n" + code + "\n```" }], stop_reason: "end_turn" });
const DOC = '{:about "Adds one to every number it gets." :inlets ["a number"] :outlets ["the number plus one"]}';
const ADD_ONE = ['(box :b1 "inlet" 20 20)', '(box :b2 "inc" 20 80)', '(box :b3 "outlet" 20 140)', "(connect :b1 0 :b2 0)", "(connect :b2 0 :b3 0)"].join("\n");
const ADD_TWO = ['(box :b1 "inlet" 20 20)', '(box :b2 "inc" 20 80)', '(box :b3 "inc" 20 140)', '(box :b4 "outlet" 20 200)',
                 "(connect :b1 0 :b2 0)", "(connect :b2 0 :b3 0)", "(connect :b3 0 :b4 0)"].join("\n");
const ADD_TWO_PANEL = ADD_TWO + '\n(box :b5 "number" 120 20)\n(present :b5 0 0)';

export async function agent(page, check) {
  if ((await cljs(page, "(boolean @sample-fn)")) !== "true") { check("Claude is offered in this view", false); return; }
  const bodies = [], answers = [answer('(box :b1 "no-such-class" 20 20)'), answer(ADD_ONE, DOC), answer(ADD_TWO), answer(ADD_TWO_PANEL)];
  const api = "https://api.anthropic.com/**";
  await page.route(api, (route) => {
    bodies.push(route.request().postData() || "");
    route.fulfill({ status: 200, contentType: "application/json", body: answers[Math.min(bodies.length - 1, answers.length - 1)] });
  });
  const s = "window.kairoticBackend.sample";
  const hadKey = await page.evaluate(`${s}.hasKey()`);
  await page.evaluate(`${s}.hasKey() || ${s}.setKey("sk-ant-test")`);
  try {
    check("the request is the box's text", (await cljs(page, '[(agent-request "agent \\"add one\\"") (agent-text "a \\"b\\"")]')) === '["add one" "agent \\"a \\\\\\"b\\\\\\"\\""]',
      await cljs(page, '[(agent-request "agent \\"add one\\"") (agent-text "a \\"b\\"")]'));
    await cljs(page, '(box :b900 "agent \\"add one\\"" 900 900)');
    check("an agent not built yet: only its request inlet and its state outlet", (await cljs(page, "(io (get-in (current) [:boxes :b900]))")) === "[1 1]");
    await cljs(page, '(box :b901 "number" 900 840)');
    await cljs(page, '(box :b902 "number" 900 980)');

    // built: the first patch fails the checks (a class that does not exist), its errors go back, the second passes
    await cljs(page, "(ask-agent :b900)");
    const built = await until(page, "(:line (agent-info :b900))", (x) => x && x !== "nil", 30000);
    check("built in a line of its own", /^"agent b900/.test(built), built + " · " + await page.evaluate(() => [...document.querySelectorAll("#repl-out div")].slice(-4).map((d) => d.textContent).join(" | ")));
    check("... after two tries: the first patch's errors went back to Claude", bodies.length === 2 && /did not pass the checks/.test(bodies[1]) && /no-such-class/.test(bodies[1]), `${bodies.length} calls`);
    check("... what Claude is told: the content of an agent, its request, the classes", /CONTENT of an `agent` box/.test(bodies[0]) && /add one/.test(bodies[0]) && /comes/.test(bodies[0]));
    check("its ports: the content's, then its own", (await cljs(page, "(io (get-in (current) [:boxes :b900]))")) === "[2 2]");
    check("its content: the patch Claude made", (await cljs(page, "(count (:boxes (agent-content (get-in (current) [:boxes :b900]))))")) === "3");
    check("its recipe: the request, who asked, not changed since", (await cljs(page, "((juxt :built-from :stale :boxes) (agent-info :b900))")) === '["add one" false 3]');
    // what it is, from outside (#275): Claude's description, its help, its ports on hover
    check("Claude said what it built: what it does and what each port takes and sends", (await cljs(page, "((juxt :about :inlets :outlets) (agent-info :b900))")) === '["Adds one to every number it gets." ["a number"] ["the number plus one"]]');
    check("... and ? on it shows that first, in the Help tab", (await cljs(page, '(do (swap! ui assoc :help-box :b900) (let [h (help-page "agent")] [(str/includes? h "Adds one to every number") (str/includes? h "the number plus one") (str/includes? h "the agent\'s own")]))')) === "[true true true]");
    check("... its ports say it on hover", (await cljs(page, '[(port-doc (get-in (current) [:boxes :b900]) :in 0 2) (some? (port-doc (get-in (current) [:boxes :b900]) :out 1 2))]')) === '["a number" true]');
    check("... the other classes' ports too, from their help", (await cljs(page, '(string? (port-doc {:text "metro 500"} :in 0 2))')) === "true");
    check("agent-core is not a class to write: out of the lists and of Claude's catalog", (await cljs(page, '[(some #{"agent-core"} (map first (comp/listing))) (some (fn [l] (str/starts-with? l "agent-core")) (ai/classes))]')) === "[nil nil]");
    await cljs(page, "(connect :b901 0 :b900 0)");
    await cljs(page, "(connect :b900 0 :b902 0)");
    await cljs(page, "(send! :b901 41)");
    check("it plays with no call: 41 in, 42 out", await until(page, "(second (get-in @eng/rt [:shows :b902 0]))", (x) => x === "42") === "42" && bodies.length === 2);

    // a request equal to the one it was built from is not sent again
    check("the same request again: nothing is sent", (await cljs(page, "(ask-agent :b900)")) === ":built" && bodies.length === 2);

    // a message to its last inlet asks again: its text changes to it, and its line gets one more point
    await cljs(page, '(eng/inject! (:patch-fn @eng/rt) :b900.agent-core 0 "add two")');
    const again = await until(page, "(:built-from (agent-info :b900))", (x) => x === '"add two"', 30000);
    check("a message to its last inlet is a new request, built", again === '"add two"' && bodies.length === 3, `${again} · ${bodies.length} calls`);
    check("... its text says it", (await cljs(page, "(:text (get-in (current) [:boxes :b900]))")) === '"agent \\"add two\\""');
    check("... its line has one more point", (await cljs(page, "(count (vals (line-nodes (agent-line (get-in (current) [:boxes :b900])))))")) === "2");
    await cljs(page, "(send! :b901 50)");
    const got = await until(page, "(pr-str (get-in @eng/rt [:shows :b902]))", (x) => /\b52\b/.test(x));
    check("... and it plays the new content: 50 in, 52 out", /\b52\b/.test(got), got);
    check("... its state outlet said :built", (await cljs(page, "(get-in @eng/rt [:states :b900.agent-core])")) === "{}");
    check("an agent opens like a patch @name: its line, in its tab", (await cljs(page, "(line-ref? (get-in (current) [:boxes :b900]))")) === "true");

    // the Agents section of the Claude panel (#275): the work's agents, what they do, their builds, and buttons
    await page.evaluate(() => document.getElementById("tab-claude").click());
    const row = async () => page.evaluate(() => { const li = [...document.querySelectorAll("#agents-list > li")].find((l) => /b900/.test(l.querySelector(".ag-top").textContent)); return li ? li.textContent : ""; });
    const r1 = await (async () => { for (let i = 0; i < 50; i++) { const t = await row(); if (/add two/.test(t) && /built/.test(t)) return t; await page.waitForTimeout(100); } return row(); })();
    check("the Claude panel lists the agent: its request, built, its line, who asked", /add two/.test(r1) && /built/.test(r1) && /its line: «agent b900/.test(r1) && /asked by you/.test(r1), r1.slice(0, 300));
    check("... and the log of its builds: the try sent back, then built", /try 1: .*no-such-class.*sent back to Claude/.test(r1) && /built: 4 boxes/.test(r1), r1.slice(0, 600));
    await page.click('#agents-list li[data-agent*="b900"] [data-agent-act=ask]');
    await page.waitForSelector('#agents-list li[data-agent*="b900"] .ag-ask-in', { timeout: 5000 }).catch(() => null);
    check("Ask… opens a field with its request", await page.evaluate(() => { const i = document.querySelector('#agents-list li[data-agent*="b900"] .ag-ask-in'); return !!i && i.value === "add two"; }));
    await page.fill('#agents-list li[data-agent*="b900"] .ag-ask-in', "add three");
    await page.click('#agents-list li[data-agent*="b900"] [data-agent-act=send]');
    const third = await until(page, "(:built-from (agent-info :b900))", (x) => x === '"add three"', 30000);
    check("... and Build asks it: a new request, built (on your own Claude)", third === '"add three"' && bodies.length === 4, `${third} · ${bodies.length} calls`);
    check("the controls it presents are its panel, on the box itself, as a patch's", (await cljs(page, "(mapv :id (:kids (panel-layout (get-in (current) [:boxes :b900]))))")) === "[:b5]");
    check("... and Claude is told to present them", /present them with \(present :bN x y\)/.test(bodies[3]));
    await page.click('#agents-list li[data-agent*="b900"] [data-agent-act=rebuild]');
    const fourth = await until(page, "(count (vals (line-nodes (agent-line (get-in (current) [:boxes :b900])))))", (x) => x === "4", 30000);
    check("Build again: the same request, another answer, one more point of its line", fourth === "4" && bodies.length === 5, `${fourth} points · ${bodies.length} calls`);
  } catch (e) {
    check("the agent tests ran: " + (e.message || e), false);
  } finally {
    await page.unroute(api);
    if (!hadKey) await page.evaluate(`${s}.setKey(null)`);
    await cljs(page, "(delete :b900 :b901 :b902)");
  }
}
