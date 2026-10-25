// SPDX-License-Identifier: MPL-2.0
// The Claude tab's button (Make it / Write it) asks Claude: with nothing written it says so, and with a
// request the call reaches the API (here answered by the test with a refusal, so nothing is spent and
// no key is needed). In the app already loaded by tests/browser.mjs (Pages, Claude with your own key).
// check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const logText = (page) => page.evaluate(() => [...document.querySelectorAll("#ask-log li")].map((l) => l.textContent).join(" | "));
const popShown = (page) => page.evaluate(() => [...document.querySelectorAll(".perform-pop")].some((el) => !el.hidden));
const until = async (page, ok, ms = 10000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await logText(page); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function claude(page, check) {
  if ((await cljs(page, "(boolean @sample-fn)")) !== "true") { check("Claude is offered in this view", false); return; }
  let requests = 0;
  const api = "https://api.anthropic.com/**";
  await page.route(api, (route) => { requests += 1; route.fulfill({ status: 401, contentType: "application/json", body: '{"error":{"message":"test"}}' }); });
  const s = "window.kairoticBackend.sample";
  const hadKey = await page.evaluate(`${s}.hasKey()`);
  await page.evaluate(`${s}.hasKey() || ${s}.setKey("sk-ant-test")`);
  await page.evaluate(() => document.getElementById("tab-claude").click());
  try {
    for (const [what, button] of [["component", "Write it"], ["patch", "Make it"]]) {
      await page.click(`input[name=ask-what][value=${what}]`);
      check(`${what}: the button says ${button}`, (await page.textContent("#ask-go")) === button, await page.textContent("#ask-go"));
      await page.fill("#ask-text", "");
      await page.click("#ask-go");
      const empty = await until(page, (t) => /Describe the/.test(t));
      check(`... with nothing written, it asks for a description`, /Describe the (component|patch) first/.test(empty), empty);
      check("... and shows no popup", !(await popShown(page)));
      const before = requests;
      await page.fill("#ask-text", "a slow LFO with its waveform drawn");
      await page.click("#ask-go");
      const sent = await until(page, (t) => /refused|API key/.test(t), 30000);
      check("... with a request, it is sent to Claude", requests > before, `requests: ${requests - before} · log: ${sent}`);
      check("... and a refused key is said in the log", /API key/.test(sent), sent);
    }
  } finally {
    await page.unroute(api);
    if (!hadKey) await page.evaluate(`${s}.setKey(null)`);
    await page.fill("#ask-text", "");
  }
}
