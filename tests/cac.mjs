// SPDX-License-Identifier: MPL-2.0
// @kairotic/cac · cac: operations on a tree that follow rules (discussion #323) — cac partimento, cac judge — and the
// analysis layer a tree box's code window shows or hides. In the app loaded by tests/browser.mjs with a local work
// open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 30000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

// the Rule of the Octave up in C, in half notes, its chords as figures (Study 62's "RO up")
const RO = `[:voice {:key "C major"} ${["c3 5/3", "d3 6/4/3", "e3 6/3", "f3 6/5", "g3 5/3", "a3 6/3", "b3 6/5", "c4 5/3"]
  .map((x) => { const [p, f] = x.split(" "); return `[:note {:pitch "${p}" :dur 2 :fig "${f}"}]`; }).join(" ")}]`;
// the book's realization (ex. 6.37a), four voices, the lowest the bass
const voice = (name, ps) => `[:voice {:name "${name}"} ${ps.split(" ").map((p) => `[:note {:pitch "${p}" :dur 2}]`).join(" ")}]`;
const BOOK = `[:piece ${voice("s", "g5 g5 g5 a5 g5 f5 f5 e5")} ${voice("a", "e5 f5 e5 d5 d5 c5 d5 c5")} ${voice("t", "c5 b4 c5 c5 b4 a4 g4 g4")} ${voice("b", "c3 d3 e3 f3 g3 a3 b3 c4")}]`;
// the Galant cadence's wrong one (ex. 6.13c): the inner voices inverted, parallel 5ths
const WRONG = `[:piece ${voice("s", "e5 f5 e5 d5 e5")} ${voice("a", "g4 a4 g4 g4 g4")} ${voice("t", "c4 d4 c4 b3 c4")} ${voice("b", "c3 f3 g3 g2 c3")}]`;

export async function cac(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the cac tests", false); return; }
  const tb = (await cljs(page, '(box "tree" 9400 100)')).trim();
  await cljs(page, `(tree! ${tb} ${RO})`);
  const cb = (await cljs(page, '(box "cac partimento" 9400 300)')).trim();
  const out = (await cljs(page, '(box "tree" 9400 400)')).trim();
  const io = await until(page, `(when (comp/lookup "cac") (io (get-in (current) [:boxes ${cb}])))`, (x) => x === "[1 2]");
  check("cac brings @kairotic/cac: a tree in; a tree and what was counted out", io === "[1 2]", io);
  await cljs(page, `(connect ${tb} 0 ${cb} 0) (connect ${cb} 0 ${out} 0) (send! ${tb} :bang)`);
  const n = await until(page, `(count (filter #(= :voice (first %)) (rest (tree-data ${out}))))`, (x) => x === "4");
  check("cac partimento: the RO's bass in, four voices out (soprano, alto, tenor, the bass)", n === "4",
        await cljs(page, `[(second (last-shown ${cb})) (get-in @eng/rt [:states ${cb} :count])]`));
  const cnt = await cljs(page, `(get-in @eng/rt [:states ${cb} :count])`);
  check("... the realizations counted exactly: 13,925, as Study 62 counts them", cnt === '"13925"', cnt);
  const figs = await cljs(page, `(vec (keep #(when (vector? %) (:fig (second %))) (last (tree-data ${out}))))`);
  check("... the bass written again with the chords made over it (the analysis layer)", figs === '["5/3" "6/4/3" "6/3" "6/5/3" "5/3" "6/3" "6/5/3" "5/3"]', figs);
  const hidden = await cljs(page, `(str/includes? (editor-source (get-in (current) [:boxes ${out}])) ":fig")`);
  check("... its code window hides the analysis (Analysis off)", hidden === "false", hidden);
  await cljs(page, "(swap! ui assoc :code-analysis true)");
  const shown = await cljs(page, `(str/includes? (editor-source (get-in (current) [:boxes ${out}])) ":fig")`);
  await cljs(page, "(swap! ui assoc :code-analysis false)");
  check("... and shows it with Analysis on", shown === "true", shown);
  // the written tree edited: its analysis kept
  const before = await cljs(page, `(get-in (tree-data ${out}) [1])`);
  await cljs(page, `(code ${out} (editor-source (get-in (current) [:boxes ${out}])))`);
  check("the written tree applied again: the analysis kept on its notes", (await cljs(page, `(vec (keep #(when (vector? %) (:fig (second %))) (last (tree-data ${out}))))`)) === figs);
  // another realization, any valid one, three voices
  const first = await cljs(page, `(pr-str (rest (second (tree-data ${out}))))`);
  await cljs(page, `(send! ${cb} :any)`);
  const second = await until(page, `(pr-str (rest (second (tree-data ${out}))))`, (x) => x !== first, 10000);
  check(":any: another realization, any valid one", second !== first);
  await cljs(page, `(send! ${cb} [:voices 3])`);
  const n3 = await until(page, `(count (filter #(= :voice (first %)) (rest (tree-data ${out}))))`, (x) => x === "3");
  check("[:voices 3]: three parts", n3 === "3");
  // cac judge
  const jb = (await cljs(page, '(box "cac judge" 9600 300)')).trim();
  await cljs(page, `(send! ${jb} ${BOOK})`);
  const ok = await until(page, `(:sub (second (last-shown ${jb})))`, (x) => /✓|✗/.test(x));
  check("cac judge: the book's RO in four parts is by the rules", /✓/.test(ok), ok);
  await cljs(page, `(send! ${jb} ${WRONG})`);
  const bad = await until(page, `(:sub (second (last-shown ${jb})))`, (x) => /parallel/.test(x));
  check("... the book's wrong Galant cadence: its parallel 5ths between the alto and the tenor", /parallel 5ths between the alto and the tenor/.test(bad), bad);
  await cljs(page, `(delete ${tb}) (delete ${cb}) (delete ${out}) (delete ${jb})`);
}
