// SPDX-License-Identifier: MPL-2.0
// The open issues in the Feedback tab each have a link that opens Claude Code with a prompt about them.
// In the app already loaded by tests/browser.mjs. check(label, ok, detail) records one result.
import { cljs } from "./gestures.mjs";

export async function feedback(page, check) {
  await cljs(page, '(reset! fb-issues [{:number 26 :title "left inlet and outlet of canvas/freqt" :url "https://github.com/bonuoq/kairotic/issues/26" :body "It only goes through." :labels ["enhancement"]}]) (render-fb-issues!)');
  const href = await page.evaluate(() => document.querySelector("#fb-list a.fb-claude")?.getAttribute("href") || "");
  check("an open issue has a link to Claude", href.startsWith("https://claude.ai/code?"), href.slice(0, 80));
  const u = href ? new URL(href) : null;
  check("... with the repository", u && u.searchParams.get("repositories") === "bonuoq/kairotic", u && u.search.slice(0, 120));
  const p = u ? u.searchParams.get("prompt") || "" : "";
  check("... and a prompt about that issue", p.includes("#26") && p.includes("left inlet and outlet") && p.includes("issues/26") && p.includes("It only goes through."), p.slice(0, 200));
  check("... short enough to travel in an address", href.length < 4000, String(href.length));
  check("it opens in a new tab", await page.evaluate(() => document.querySelector("#fb-list a.fb-claude")?.target === "_blank"));
  await cljs(page, "(reset! fb-issues nil)");
}
