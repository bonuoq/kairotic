// SPDX-License-Identifier: MPL-2.0
// Issue #50: the embed option Release/Perform (?present) carries a release of the patch and always opens in
// Perform: what is played or changed there is a take, never the work. In a page of its own.
// check(label, ok, detail).
import zlib from "zlib";
import { cljs } from "./gestures.mjs";

const pack = (t) => "z" + zlib.deflateRawSync(Buffer.from(t, "utf8")).toString("base64url");
const ready = (page) => page.waitForFunction(() => {
  try { return scittle.core.eval_string("(in-ns 'user) (fn? present-what!)") === true; } catch (_) { return false; }
}, null, { timeout: 90000 });

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
  // issue #57: in a Release/Perform embed a presented box does not move, and is not selected
  {
    const r = await page.evaluate(() => { const el = document.querySelector('#scene .box[data-box="b1"] rect.body');
                                          if (!el) return null; const b = el.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    if (r) {
      await page.mouse.move(r[0] - 30, r[1]); await page.mouse.down();
      await page.mouse.move(r[0] + 30, r[1] + 30, { steps: 6 }); await page.mouse.up();
      await page.waitForTimeout(150);
    }
    check("in a Release/Perform embed a presented box is not moved nor selected",
      !!r && (await cljs(page, "[(:present (get-in (work-patch) [:boxes :b1])) (:sel @ui)]")) === "[[10 10] nil]",
      await cljs(page, "[(:present (get-in (work-patch) [:boxes :b1])) (:sel @ui)]"));
  }
  // a change there is a take: the history of the release stays as it came
  const before = await cljs(page, "(history-size)");
  await cljs(page, '(text! :b2 "metro 125")');
  check("a change in it is a take, not a point of the history",
    (await cljs(page, "(:text (get-in (work-patch) [:boxes :b2]))")) === '"metro 125"' && (await cljs(page, "(history-size)")) === before,
    await cljs(page, "[(history-size) (:text (get-in (work-patch) [:boxes :b2]))]"));

  // the Share/Export panel (it was Embed): the option is called Release/Perform, and its link is always the patch
  check("the action is called Share/Export",
    (await page.evaluate(() => document.getElementById("embed-btn").textContent.trim())) === "Share/Export");
  const label = await page.evaluate(() => document.querySelector("input[name=ep-mode][value=present]").parentElement.textContent.trim());
  check("the embed option is called Release/Perform", label === "Release/Perform", label);
  check("(embed-link :release) and :perform mean Release/Perform",
    (await cljs(page, "[(link-mode :release) (link-mode :perform) (link-mode \"present\") (link-mode nil)]")) === "[:present :present :present :embed]");
  check("no page errors in a Release/Perform embed", errors.length === 0, errors.join("; "));

  // issue #55: links carry the patch after #, which never reaches the server
  check("a link is written after #",
    (await cljs(page, '(str/starts-with? (url-with [["code" "zabc"]] :present) (str (site-url) "#code=zabc&present"))')) === "true",
    await cljs(page, '(url-with [["code" "zabc"]] :present)'));
  await page.close();

  // a long patch after # (a Faust code box of 30 000 characters, about 20 KB once packed): it opens
  const long = await browser.newPage();
  const lerrors = [];
  long.on("pageerror", (e) => lerrors.push(e.message));
  let noise = "";
  for (let i = 0; noise.length < 30000; i++) noise += `// ${i} ${Math.sin(i * 7.31).toFixed(9)} ${(i * 2654435761 % 4294967296).toString(36)}\n`;
  const code = '(box :b1 "metro 500" 20 20) (present :b1 10 10) (box :b2 "faust~" 20 120) ' +
               `(code :b2 "${noise}process = 0;")`;
  const z = pack(code);
  await long.goto(base + "#code=" + z + "&present");
  await ready(long);
  check("a link after # with a long patch opens", (await until(long, "(count (:boxes (work-patch)))", "2")) === "2",
        `${z.length} characters; ` + await cljs(long, "[(:name @work) (count (:boxes (work-patch)))]"));
  check("... in Release/Perform", (await until(long, "(some? @perf)", "true")) === "true");
  check("... with the code of its box", (await cljs(long, "(count (str (get-in (work-patch) [:boxes :b2 :data :source])))")) >= "3", 
        await cljs(long, "(count (str (get-in (work-patch) [:boxes :b2 :data :source])))"));
  check("... and the embed knows it from the #", (await cljs(long, "embed-mode")) === ":present");
  check("no page errors in a long link", lerrors.length === 0, lerrors.join("; "));
  await long.close();
}
