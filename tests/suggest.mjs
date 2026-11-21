// SPDX-License-Identifier: MPL-2.0
// The menu of classes while a box is written: what matches the first word typed, with where each class comes
// from (core, a package, clojure.core) and the first sentence of its doc; ↑ ↓ choose, Tab or Enter take one.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 4000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === expected) return got; await page.waitForTimeout(50); }
  return got;
};
const value = (page) => page.evaluate(() => document.getElementById("box-edit")?.value);
const shown = (page) => page.evaluate(() => [...document.querySelectorAll("#box-suggest .sg-name")].map((e) => e.textContent));
const open = async (page) => {
  await cljs(page, "(open-editor! {:x 8000 :y 400})");
  await page.waitForSelector("#box-edit", { timeout: 2000 }).catch(() => {});
};

export async function suggest(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the suggestion tests", false); return; }

  // what is offered
  const metro = await cljs(page, '(first (hlp/suggest "metro"))');
  check("the class written exactly comes first, from the core, with the first sentence of its doc",
    /:cls "metro"/.test(metro) && /:from "core"/.test(metro) && /:doc "Sends periodic bangs/.test(metro), metro);
  const met = await cljs(page, '(mapv :cls (hlp/suggest "met"))');
  check("those that begin with what is typed", /"metro"/.test(met), met);
  const pan = await cljs(page, '(some (fn [s] (when (= "pan~" (:cls s)) (:from s))) (hlp/suggest "pan"))');
  check("a class of a package not brought in yet, with its package", pan === '"@kairotic/spatial"', pan);
  const map = await cljs(page, '(some (fn [s] (when (= "map" (:cls s)) (:from s))) (hlp/suggest "map"))');
  check("the functions of clojure.core too", map === '"clojure.core"', map);
  const order = await cljs(page, '(let [cs (mapv :cls (hlp/suggest "re" 30))] [(first cs) (count cs)])');
  check("at most as many as asked", /^\[".+" (\d+)\]$/.test(order) && Number(order.match(/(\d+)\]$/)[1]) <= 30, order);
  check("nothing for an empty field", (await cljs(page, '(hlp/suggest "  ")')) === "nil");

  // the menu
  await open(page);
  await page.keyboard.type("metr");
  const names = await shown(page);
  check("typing shows a menu with the classes that match", names[0] === "metro", JSON.stringify(names));
  check("... each with where it comes from and what it does", await page.evaluate(() => {
    const it = document.querySelector("#box-suggest .sg");
    return !!it && it.querySelector(".sg-from")?.textContent === "core" && /bangs/.test(it.querySelector(".sg-doc")?.textContent || "");
  }));
  await page.keyboard.press("ArrowDown");
  check("↓ chooses the first", await page.evaluate(() => document.querySelector("#box-suggest .sg")?.classList.contains("on")));
  await page.keyboard.press("Enter");
  check("Enter takes it; a class with arguments stays open to write them", (await value(page)) === "metro ", await value(page));
  const hint = await page.evaluate(() => document.querySelector("#box-suggest .sg.hint .sg-name")?.textContent);
  check("... and shows what it takes", hint === "metro ms", hint);
  const before = await cljs(page, "(count (:boxes (current)))");
  await page.keyboard.type("500");
  await page.keyboard.press("Enter");
  check("... then Enter writes the box", (await until(page, "(count (:boxes (current)))", String(Number(before) + 1))) === String(Number(before) + 1)
        && (await cljs(page, "(some #(= \"metro 500\" (:text %)) (vals (:boxes (current))))")) === "true");

  await open(page);
  await page.keyboard.type("loadb");
  await page.keyboard.press("Tab");
  check("Tab takes the first, with no space when the class takes no arguments", (await value(page)) === "loadbang", await value(page));
  check("... and the field keeps the focus", await page.evaluate(() => document.activeElement?.id === "box-edit"));
  await page.keyboard.press("Escape");
  check("Esc closes the field and its menu", await page.evaluate(() => !document.getElementById("box-edit") && !document.getElementById("box-suggest")));

  await open(page);
  await page.keyboard.type("loadb");
  const n0 = await cljs(page, "(count (:boxes (current)))");
  await page.click("#box-suggest .sg");
  check("a click on a class takes it, without closing the field", (await value(page)) === "loadbang"
        && await page.evaluate(() => document.activeElement?.id === "box-edit")
        && (await cljs(page, "(count (:boxes (current)))")) === n0, await value(page));
  await page.keyboard.press("Escape");

  // the help, from the menu
  await open(page);
  await page.keyboard.type("metr");
  check("each class in the menu has a ? for its help", await page.evaluate(() =>
    document.querySelector('#box-suggest .sg [data-help="metro"]')?.textContent === "?"));
  await page.click('#box-suggest [data-help="metro"]');
  check("its ? opens the help of that class", (await until(page, "@help-cls", '"metro"')) === '"metro"');
  check("... and the field stays open, with what was typed and the focus", (await value(page)) === "metr"
        && await page.evaluate(() => document.activeElement?.id === "box-edit"));
  await cljs(page, "(show-help! nil)");
  await page.keyboard.press("F1");
  check("F1 in the field: the help of the first offered when nothing is chosen", (await until(page, "@help-cls", '"metro"')) === '"metro"');
  await page.keyboard.press("Escape");
  await open(page);
  await page.keyboard.type("loadbang 1");
  await page.keyboard.press("Control+/");
  check("Ctrl + ? (or ⌘): the help of the class written", (await until(page, "@help-cls", '"loadbang"')) === '"loadbang"'
        && (await value(page)) === "loadbang 1", await value(page));
  check("... the hint has its ? too", await page.evaluate(() => !!document.querySelector('#box-suggest .sg.hint [data-help="loadbang"]')));
  await page.keyboard.press("Escape");
  check("Esc still closes it, without writing a box", await page.evaluate(() => !document.getElementById("box-edit")));

  await open(page);
  await page.keyboard.type("(+ 1");
  check("no menu on a line of the REPL", (await shown(page)).length === 0);
  await page.keyboard.press("Escape");
}
