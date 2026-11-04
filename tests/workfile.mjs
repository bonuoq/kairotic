// SPDX-License-Identifier: MPL-2.0
// Discussion #149: a work as a file, .kairotic (a zip of EDN, and its recorded sounds as float WAV).
// In the app already loaded by tests/browser.mjs. It opens a local work and the solo work a file makes, deletes
// that one, and opens a local work again. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 10000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === expected) return got; await page.waitForTimeout(80); }
  return got;
};
// a promise of the page, its value kept in (:v @t-file) when it settles
const settle = async (page, src, ms = 15000) => {
  await cljs(page, `(do (defonce t-file (atom {})) (reset! t-file {}) (-> ${src} (.then (fn [v] (swap! t-file assoc :v v :done true))) (.catch (fn [e] (swap! t-file assoc :err (or (.-message e) (str e)) :done true)))) nil)`);
  await until(page, "(:done @t-file)", "true", ms);
  return cljs(page, "(:err @t-file)");
};

export async function workfile(page, check) {
  await cljs(page, '(open-work! :local "local" "Local")');
  await until(page, "(:loaded @hist)", "true");
  for (let last = "", same = 0, t0 = Date.now(); same < 8 && Date.now() - t0 < 20000; ) {
    const now = await cljs(page, "(count (:boxes (current)))");
    same = now === last ? same + 1 : 0; last = now; await page.waitForTimeout(150);
  }

  // a work with two lines, a snapshot and a recorded sound
  await cljs(page, '(snapshot "start")');
  const err0 = await settle(page, `(snd/keep! 48000 (into-array [(js/Float32Array. (clj->js (map (fn [i] (js/Math.sin (* i 0.05))) (range 4800))))]))`);
  check("a sound kept in this browser for the test", err0 === "nil", err0);
  const hash = await cljs(page, "(:audio (:v @t-file))");
  await cljs(page, '(box :b90 "sample" 40 900)');
  await cljs(page, "(dispatch! [:data :b90 (:v @t-file)])");
  await cljs(page, '(new-line "second")');
  await cljs(page, '(box "msg 1" 40 40)');
  await cljs(page, '(box "number" 40 120)');
  await cljs(page, "(connect :b1 0 :b2 0)");
  await cljs(page, '(go-line "main")');
  const segs = await cljs(page, "(sort (map :id (all-segments)))");
  const mainCode = await cljs(page, "(patch->code (work-patch))");

  // export
  const err1 = await settle(page, "(export-bytes {})");
  check("(export-bytes {}) makes the bytes of a .kairotic", err1 === "nil" && (await cljs(page, "(pos? (.-length (:v @t-file)))")) === "true", err1);
  await cljs(page, "(defonce t-bytes (atom nil)) (reset! t-bytes (:v @t-file))");
  const err2 = await settle(page, "(read-work-bytes @t-bytes)");
  check("... which reads back", err2 === "nil", err2);
  check("... a zip whose manifest says what it is", (await cljs(page, "(select-keys (:manifest (:v @t-file)) [:format :kind :anonymous])")) === "{:format 1, :kind :history, :anonymous false}");
  check("... with every segment of every line", (await cljs(page, "(sort (map :id (:history (:v @t-file))))")) === segs);
  check("... the names of the lines", (await cljs(page, "(sort (map :name (vals (:lines (:v @t-file)))))")) === '("main" "second")');
  check("... and the sound recorded, sample by sample", (await cljs(page, `(let [s (get-in (:v @t-file) [:sounds ${hash}])] [(:sr s) (.-length (aget (:chans s) 0)) (js/Math.abs (- (aget (aget (:chans s) 0) 100) (js/Math.sin 5)))])`)).startsWith("[48000 4800 "),
    await cljs(page, `(keys (:sounds (:v @t-file)))`));
  check("... a WAV of 32-bit floats", (await cljs(page, `(let [s (get-in (:v @t-file) [:sounds ${hash}])] (= (aget (aget (:chans s) 0) 100) (js/Math.fround (js/Math.sin 5))))`)) === "true");

  // EDN, readable
  check("the history is EDN: a work is data", (await settle(page, "(.then (kfile-lib) (fn [K] (.then (.unzip K @t-bytes) (fn [fs] (.text K (.-data (first (filter (fn [f] (= \"history.edn\" (.-name f))) (array-seq fs)))))))))")) === "nil" &&
    (await cljs(page, '(str/starts-with? (:v @t-file) "[{")')) === "true");

  // a release, and anonymous
  await settle(page, "(.then (export-bytes {:release true :anonymous true}) read-work-bytes)");
  check("a release holds one line with one segment", (await cljs(page, "[(count (:history (:v @t-file))) (count (:lines (:v @t-file))) (:kind (:manifest (:v @t-file)))]")) === "[1 1 :release]");
  check("... anonymous: no one's id, no names, no origin",
    (await cljs(page, "[(every? (fn [n] (re-matches #\"p\\d+\" (:author n))) (:history (:v @t-file))) (empty? (:people (:v @t-file))) (contains? (:work (:v @t-file)) :origin)]")) === "[true true false]");
  await settle(page, "(.then (export-bytes {:anonymous true}) read-work-bytes)");
  check("... and anonymous with its history: every author a plain name, the same segments",
    (await cljs(page, "(every? (fn [n] (re-matches #\"p\\d+\" (:author n))) (:history (:v @t-file)))")) === "true" &&
    (await cljs(page, "(sort (map :id (:history (:v @t-file))))")) === segs);

  // a file of a newer Kairotic is not opened half
  const newer = await settle(page, '(.then (kfile-lib) (fn [K] (.then (.zip K (clj->js [{:name "manifest.edn" :data (pr-str {:format 99})}])) read-work-bytes)))');
  check("a file saved by a newer Kairotic says so", /newer Kairotic/.test(newer), newer);
  const notOne = await settle(page, '(read-work-bytes (js/Uint8Array. 40))');
  check("... and something else is not taken for a work", /not a zip/.test(notOne), notOne);

  // opening it: a new work, the same history
  const before = await cljs(page, "[(:kind @work) (:id @work)]");
  const err3 = await settle(page, '(open-work-bytes! @t-bytes "a file")', 30000);
  check("opening a .kairotic makes a new work", err3 === "nil" && (await cljs(page, "[(:kind @work) (:id @work)]")) !== before, err3);
  const kind = await cljs(page, "(:kind @work)");
  const n = (segs.match(/"/g) || []).length / 2;
  check("... with every segment of every line (those of a local work under ids of their own)",
    (await until(page, "(count (all-segments))", String(n), 15000)) === String(n) &&
    (await cljs(page, '(not-any? (fn [n] (str/starts-with? (:id n) "local-")) (all-segments))')) === "true");
  check("... its lines", (await until(page, "(:lines (work-lines))", '["main" "second"]')) === '["main" "second"]');
  check("... the main line as it was", (await until(page, "(patch->code (work-patch))", mainCode)) === mainCode);
  await cljs(page, '(go-line "second")');
  check("... and the other line too", (await cljs(page, "(mapv :text (vals (:boxes (current))))")) === '["msg 1" "number"]');
  await cljs(page, '(go-line "main")');
  check("... and its snapshot", (await cljs(page, '(some (fn [k] (= "start" (:label k))) (keyframes))')) === "true");
  if (kind === ":solo") {
    const id = await cljs(page, "(:id @work)");
    await cljs(page, `(delete-work! :solo ${id})`);
    await page.waitForTimeout(1500);
  }

  // where it is offered
  await cljs(page, '(open-work! :local "local" "Local")');
  await until(page, "(:loaded @hist)", "true");
  await page.click("#embed-btn");
  check("Share/Export offers the work as a file first", await page.evaluate(() => {
    const pop = document.getElementById("embed-pop");
    const blocks = [...pop.children].filter((el) => !el.hidden);
    return blocks[1] && blocks[1].id === "ep-file" && !!pop.querySelector('[data-kfile="history"]') && !!pop.querySelector('[data-kfile="release"]');
  }));
  await page.click("#ep-close");
  await cljs(page, "(show-manager!)");
  check("the session manager opens a file", await page.evaluate(() => !!document.querySelector('#mgr-body [data-act="open-file"]')));
  await cljs(page, "(hide-manager!)");
  await until(page, "(:loaded @hist)", "true");
}
