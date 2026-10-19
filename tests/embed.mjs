// SPDX-License-Identifier: MPL-2.0
// Issue #50: the embed option Release/Perform (?present) carries a release of the patch and always opens in
// Perform: what is played or changed there is a take, never the work. In a page of its own.
// check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 20000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === expected) return got; await page.waitForTimeout(80); }
  return got;
};

export async function embed(browser, base, check) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const src = '(box :b1 "metro 500" 20 20) (box :b2 "metro 250" 160 20) (present :b1 10 10)';
  await page.goto(base + "?present&src=" + encodeURIComponent(src));
  await page.waitForFunction(() => { try { return scittle.core.eval_string("(in-ns 'user) (fn? present-what!)") === true; } catch (_) { return false; } },
                             null, { timeout: 90000 });

  check("a Release/Perform link opens in Perform", (await until(page, "(some? @perf)", "true")) === "true", await cljs(page, "[(:mode @hist) (:name @work)]"));
  check("... as a release of the patch", (await cljs(page, "(str/includes? (str (:name @work)) \"release\")")) === "true", await cljs(page, "(:name @work)"));
  check("... showing its presentation", (await until(page, "@pres-mode", "true")) === "true");
  check("... with the patch it carries", (await cljs(page, "(set (keys (:boxes (work-patch))))")) === "#{:b1 :b2}");
  // a change there is a take: the history of the release stays as it came
  const before = await cljs(page, "(history-size)");
  await cljs(page, '(text! :b2 "metro 125")');
  check("a change in it is a take, not a point of the history",
    (await cljs(page, "(:text (get-in (work-patch) [:boxes :b2]))")) === '"metro 125"' && (await cljs(page, "(history-size)")) === before,
    await cljs(page, "[(history-size) (:text (get-in (work-patch) [:boxes :b2]))]"));

  // the Embed panel: the option is called Release/Perform, and its link is always the patch, never a lesson
  const label = await page.evaluate(() => document.querySelector("input[name=ep-mode][value=present]").parentElement.textContent.trim());
  check("the embed option is called Release/Perform", label === "Release/Perform", label);
  check("(embed-link :release) and :perform mean Release/Perform",
    (await cljs(page, "[(link-mode :release) (link-mode :perform) (link-mode \"present\") (link-mode nil)]")) === "[:present :present :present :embed]");
  check("no page errors in a Release/Perform embed", errors.length === 0, errors.join("; "));
  await page.close();
}
