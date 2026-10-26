// SPDX-License-Identifier: MPL-2.0
// Discussion #30: a box can switch between the views of its data (a tree as code or as a score, a freqt
// as a canvas or a score), and the data of any buffer opens as text in the code window.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(80); }
  return got;
};

const chipCentre = async (page, id, kind) => {
  const sel = `#scene .box[data-box="${id}"] .hchip[data-chip="${kind}"] rect`;
  const found = await page.waitForSelector(sel, { timeout: 5000 }).then(() => true).catch(() => false);
  if (!found) return null;
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }, sel);
};

export async function views(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the view tests", false); return; }
  const events = "(depth-of (norm (:pos @world)))";

  // ── a tree box shown as a score, in the same box ──
  const tb = (await cljs(page, '(box "tree" 1700 760)')).trim();
  const tid = tb.slice(1);
  await cljs(page, `(code ${tb} "[:voice [:measure {:meter [4 4]} \\"c4/1 d4 e4 f4\\"]]")`);
  check("a tree box is code by default", (await cljs(page, `(display-of (get-in (current) [:boxes ${tb}]))`)) === ":code");
  const before = Number(await cljs(page, events));
  await cljs(page, `(view ${tb} :score)`);
  check("(view :bN :score) shows the tree as a score", (await cljs(page, `(display-of (get-in (current) [:boxes ${tb}]))`)) === ":score");
  check("... as one event of the history", Number(await cljs(page, events)) === before + 1, await cljs(page, events));
  check("... and its tree is the same", (await cljs(page, `(count (mt/pitches (tree-data ${tb})))`)) === "4");
  check("the work's code keeps the view", (await cljs(page, `(str/includes? (patch->code (current)) "(view ${tb} :score)")`)) === "true");
  check("an unknown view is refused", /ERR/.test(await cljs(page, `(view ${tb} :piano-roll)`)));

  // its notes edit its own tree, without a wire back
  const pieces = await until(page, `(count (filter :src (get-in @score-cache [${tb} :pieces])))`, (g) => Number(g) > 0, 30000);
  if (Number(pieces) > 0) {
    check("the score of a tree box knows it comes from the box", (await cljs(page, `(get-in @score-cache [${tb} :from])`)) === tb);
    await cljs(page, `(select-tree-note! ${tb} (first (filter :src (get-in @score-cache [${tb} :pieces]))) ${tb})`);
    await cljs(page, '(tree-key! "ArrowUp" false)');
    const p = await until(page, `(first (mt/pitches (tree-data ${tb})))`, (g) => g !== '"c4"');
    check("↑ on a note of a tree shown as a score edits the tree itself", p === '"c#4"' || p === '"db4"', p);
    check("... with no edits wire", (await cljs(page, `(count (filter (fn [[a]] (= a ${tb})) (:lines (current))))`)) === "0");
    // a rest becomes a note again: Delete on the second note, then Enter (the pitch of the note before it)
    const second = `(second (filter :src (get-in @score-cache [${tb} :pieces])))`;
    await until(page, `(count (filter :src (get-in @score-cache [${tb} :pieces])))`, (g) => Number(g) >= 4, 15000);
    await cljs(page, `(select-tree-note! ${tb} ${second} ${tb})`);
    await cljs(page, '(tree-key! "Delete" false)');
    const n3 = await until(page, `(count (mt/pitches (tree-data ${tb})))`, (g) => g === "3");
    check("Delete turns a note of the score into a rest", n3 === "3", n3);
    await until(page, `(some (fn [pc] (= (:src pc) (:src (:tsel @ui)))) (get-in @score-cache [${tb} :pieces]))`, (g) => g === "true", 15000);
    const sel = await cljs(page, `(:tag (mt/node-at (tree-data ${tb}) (:src (:src (:tsel @ui)))))`);
    await cljs(page, '(tree-key! "Enter" false)');
    const back = await until(page, `(vec (mt/pitches (tree-data ${tb})))`, (g) => /^\[(\S+ ){3}\S+\]$/.test(g));
    check("Enter on the selected rest makes it a note again, at the pitch of the note before it",
      /^\["(c#4|db4)" "(c#4|db4)"/.test(back), back + " " + sel);
    await cljs(page, '(tree-key! "d" false)');
    const d = await until(page, `(second (mt/pitches (tree-data ${tb})))`, (g) => g === '"d4"');
    check("a letter gives the selected note the nearest pitch of that name", d === '"d4"', d);
  } else check("the score of the tree box is drawn (Verovio)", false, pieces);

  // the header chips: ⇄ code brings the code back, { } opens it in the code window
  const brace = await chipCentre(page, tid, "code");
  check("a tree shown as a score has a { } chip", !!brace);
  if (brace) {
    await page.mouse.click(...brace);
    const open = await page.waitForSelector("#code-win", { timeout: 5000 }).then(() => true).catch(() => false);
    check("{ } opens its code in the code window", open);
    if (open) check("... the code of the tree", (await cljs(page, "(str/includes? (cw-text) \":voice\")")) === "true", await cljs(page, "(cw-text)"));
    await cljs(page, "(close-code-win!)");
  }
  const swap = await chipCentre(page, tid, "view");
  check("a tree shown as a score has a ⇄ chip", !!swap);
  if (swap) {
    // three views now (discussion #92): score → canvas → code
    await page.mouse.click(...swap);
    const v1 = await until(page, `(display-of (get-in (current) [:boxes ${tb}]))`, (g) => g === ":canvas");
    check("⇄ shows the tree as a canvas next", v1 === ":canvas", v1);
    const swap2 = await chipCentre(page, tid, "view");
    if (swap2) await page.mouse.click(...swap2);
    const v = await until(page, `(display-of (get-in (current) [:boxes ${tb}]))`, (g) => g === ":code");
    check("... and ⇄ again shows it as code", v === ":code", v);
  }

  // ── one box for freqt, tree and score (discussion #92): a tree drawn as a canvas ──
  const ct = (await cljs(page, '(box "tree" 1700 1500)')).trim();
  await cljs(page, `(tree! ${ct} [:voice [:par]])`);
  check("a tree box can be shown as a canvas", (await cljs(page, `(view ${ct} :canvas)`)) === ":canvas");
  await cljs(page, `(stroke ${ct} [[0 261.63] [1 261.63]]) (stroke ${ct} [[1 329.63] [3 329.63]])`);
  check("drawing on it writes notes into the tree", (await cljs(page, `(mt/pitches (tree-data ${ct}))`)) === '["c4" "e4"]');
  check("... placed in free time", (await cljs(page, `(mapv (juxt :t :dur) (mt/notes (tree-data ${ct})))`)) === "[[0 1] [1 2]]");
  await cljs(page, `(move-stroke ${ct} :n2 1 100)`);
  check("dragging a note moves it in the tree", (await cljs(page, `(mapv (juxt :t :dur) (mt/notes (tree-data ${ct})))`)) === "[[0 1] [2 2]]");
  await cljs(page, `(grid-x ${ct} 0.5 [4])`);
  check("its grid is the tree's", (await cljs(page, `(:grid (mt/attrs (tree-data ${ct})))`)) === "{:step 0.5, :cycles [4]}");
  const rdr = (await cljs(page, '(box "reader" 1900 1650)')).trim();
  await cljs(page, `(connect ${ct} 1 ${rdr} 1)`);
  check("its second outlet is its notes as a buffer, for a reader", (await cljs(page, `(count (:strokes (second (eng/buffer-of (current) ${rdr}))))`)) === "2");
  await cljs(page, `(quantize! ${ct})`);
  check("(quantize! :bN) writes its free time in measures", (await cljs(page, `(mt/measured? (tree-data ${ct}))`)) === "true");
  check("... and keeps its grid", (await cljs(page, `(some? (:grid (mt/attrs (tree-data ${ct}))))`)) === "true");
  await cljs(page, `(move-stroke ${ct} :n2 0 -100)`);
  check("in measures, a change of pitch is written in the note", (await cljs(page, `(mt/pitches (tree-data ${ct}))`)) === '["c4" "e4"]');
  await cljs(page, `(unquantize! ${ct})`);
  check("(unquantize! :bN) writes it in free time again", (await cljs(page, `(mt/measured? (tree-data ${ct}))`)) === "false");
  const fq = (await cljs(page, '(box "freqt" 1700 1800)')).trim();
  await cljs(page, `(send! ${fq} [:batch [[:note 0 60 1] [:note 1 62 1]]])`);
  const nt = (await cljs(page, `(to-tree! ${fq})`)).trim();
  check("(to-tree! :bN) makes a tree box of a freqt's strokes", (await cljs(page, `(mt/pitches (tree-data ${nt}))`)) === '["c4" "d4"]');
  check("... shown as a canvas", (await cljs(page, `(display-of (get-in (current) [:boxes ${nt}]))`)) === ":canvas");

  // ── a freqt: its buffer as text ──
  const f = (await cljs(page, '(box "freqt" 1700 1000)')).trim();
  const fid = f.slice(1);
  const src0 = await cljs(page, `(source ${f})`);
  check("(source :bN) gives a freqt's buffer as EDN", /:strokes \{\}/.test(src0), src0);
  const e0 = Number(await cljs(page, events));
  const r1 = await cljs(page, `(code ${f} "{:gx {:step 0.25 :cycles [4]} :gy nil :strokes {:t1 [[0 440] [1 440]] :t2 [[1 330] [2 330]]}}")`);
  check("writing the text draws the strokes", (await cljs(page, `(count (:strokes (box-data ${f})))`)) === "2", r1);
  check("... as one event of the history", Number(await cljs(page, events)) === e0 + 1, await cljs(page, events));
  const r2 = await cljs(page, `(code ${f} (source ${f}))`);
  check("the same text again changes nothing", r2 === ":unchanged" && Number(await cljs(page, events)) === e0 + 1, r2);
  const bad = await cljs(page, `(code ${f} "{:strokes {:t1 [[0 440] [1 99999]]}}")`);
  check("a text that cannot be read is refused, saying why", /ERR/.test(bad) && /t1/.test(bad), bad);
  check("... and the buffer is untouched", (await cljs(page, `(count (:strokes (box-data ${f})))`)) === "2");

  // the freqt drawn as a score, and back
  await cljs(page, `(view ${f} :score)`);
  check("a freqt can be shown as a score", (await cljs(page, `(display-of (get-in (current) [:boxes ${f}]))`)) === ":score");
  // ── its quantization (issue #86): options kept in the buffer, another division for a beat ──
  check("(quantize :bN) gives the measured tree its score shows", (await cljs(page, `(mt/measured? (quantize ${f}))`)) === "true");
  await cljs(page, `(quant ${f} {:meter "3/4"})`);
  check("(quant :bN opts) keeps the options in the buffer", (await cljs(page, `(:quant (box-data ${f}))`)) === '{:meter "3/4"}');
  check("... the score follows them", (await cljs(page, `(:meter (mt/attrs (first (filter (fn [x] (and (vector? x) (= :measure (first x)))) (tree-seq vector? seq (quantize ${f}))))))`)) === "[3 4]");
  check("... and they are in the buffer's text", (await cljs(page, `(str/includes? (source ${f}) ":quant")`)) === "true");
  const ch = await cljs(page, `(division! ${f} 0)`);
  check("(division! :bN t) divides the beat at t another way", ch !== "nil" && !/^ERR/.test(ch), ch);
  check("... and keeps the choice in :fix", (await cljs(page, `(some? (get-in (box-data ${f}) [:quant :fix 0]))`)) === "true");
  await cljs(page, `(quant ${f} nil)`);
  check("(quant :bN nil) goes back to the defaults", (await cljs(page, `(:quant (box-data ${f}))`)) === "nil");
  // ── another name for a note (issue #88) ──
  await cljs(page, `(send! ${f} [:clear]) (send! ${f} [:batch [[:note 0 61 1] [:note 1 62 1]]])`);
  const nm = await cljs(page, `(enharmonic! ${f} 0 61)`);
  check("(enharmonic! :bN t midi) writes a note of the score another way", nm === '"db4"', nm);
  check("... and the score's tree has that name", (await cljs(page, `(first (mt/pitches (quantize ${f})))`)) === '"db4"');
  await cljs(page, `(quant ${f} nil)`);
  await cljs(page, `(view ${f} :next)`);
  check("(view :bN :next) goes to the next view", (await cljs(page, `(display-of (get-in (current) [:boxes ${f}]))`)) === ":canvas");

  // { } on a freqt opens its buffer; an edit that cannot be read stays in the window, not applied
  const fb = await chipCentre(page, fid, "code");
  check("a freqt has a { } chip", !!fb);
  if (fb) {
    await page.mouse.click(...fb);
    const cm = await page.waitForSelector("#code-win .cm-editor", { timeout: 15000 }).then(() => true).catch(() => false);
    check("{ } opens the buffer in the code window", cm);
    if (cm) {
      check("... as EDN", (await cljs(page, "(:lang @code-win)")) === '"edn"');
      await page.click("#code-win .cm-content");
      await page.keyboard.press("Control+End");
      await page.keyboard.type(" oops");
      await page.keyboard.press("Control+Enter");
      const err = await until(page, "(:error @code-win)", (g) => g !== "nil", 3000);
      check("a text that cannot be read is not applied, and the window says why", err !== "nil", err);
      check("... the window stays edited", (await cljs(page, "(:dirty @code-win)")) === "true");
      check("... the buffer is untouched", (await cljs(page, `(count (:strokes (box-data ${f})))`)) === "2");
    }
    await cljs(page, "(close-code-win!)");
  }
  // ── a score box (older works) is a freqt shown as a score ──
  const sb = (await cljs(page, '(box "score" 1700 1300)')).trim();
  check("(box \"score\" …) makes a freqt", (await cljs(page, `(:text (get-in (current) [:boxes ${sb}]))`)) === '"freqt"');
  check("... shown as a score", (await cljs(page, `(display-of (get-in (current) [:boxes ${sb}]))`)) === ":score");
  await cljs(page, `(text! ${sb} "score")`);
  check("retyping a box as score does the same", (await cljs(page, `[(:text (get-in (current) [:boxes ${sb}])) (:view (get-in (current) [:boxes ${sb}]))]`)) === '["freqt" :score]');
  await cljs(page, `(delete ${tb} ${f} ${sb})`);
}
