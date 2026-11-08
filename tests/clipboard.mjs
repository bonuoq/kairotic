// SPDX-License-Identifier: MPL-2.0
// Issue #164: copy, cut, paste and duplicate boxes. The clipboard holds their code and, on its last line, the same
// boxes as data (read as EDN, never run); pasted boxes get new ids and keep their lines, also to boxes that were
// not copied when those are in the patch. In the app already loaded by tests/browser.mjs with a local work open.
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 5000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(60); }
  return got;
};

// a clipboard event as the browser sends it, with a clipboard of its own; returns what is on it afterwards
const clip = (page, type, text = "") => page.evaluate(([type, text]) => {
  const dt = new DataTransfer();
  if (text) dt.setData("text/plain", text);
  const e = new ClipboardEvent(type, { clipboardData: dt, bubbles: true, cancelable: true });
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  document.body.dispatchEvent(e);
  return { text: dt.getData("text/plain"), taken: e.defaultPrevented };
}, [type, text]);

export async function clipboard(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the clipboard tests", false); return; }
  const events = "(depth-of (norm (:pos @world)))";
  const ids = async () => cljs(page, "(set (keys (:boxes (current))))");
  const lines = "(set (:lines (current)))";

  // x → a → b → c, far from the rest
  const x = (await cljs(page, '(box "mtof" 9000 300)')).trim();
  const a = (await cljs(page, '(box "mtof" 9000 400)')).trim();
  const b = (await cljs(page, '(box "mtof" 9100 400)')).trim();
  const c = (await cljs(page, '(box "print" 9000 500)')).trim();
  await cljs(page, `(connect ${x} 0 ${a} 0) (connect ${a} 0 ${b} 0) (connect ${b} 0 ${c} 0)`);
  await cljs(page, `(swap! ui assoc :sel (sel-of [${a} ${b}]) :tsel nil :nsel nil)`);
  await page.evaluate(() => window.getSelection().removeAllRanges());

  // ── copy ──
  const copied = await clip(page, "copy");
  check("⌘C puts the selected boxes on the clipboard", copied.taken && copied.text.includes(`(box ${a} "mtof" 9000 400)`), copied.text.slice(0, 200));
  check("... with their lines, as code", copied.text.includes(`(connect ${a} 0 ${b} 0)`));
  check("... and the same as data on its last line", copied.text.trim().split("\n").at(-1).startsWith(";; kairotic-paste {"));

  // ── paste where the pointer is ──
  const before = await ids();
  const e0 = Number(await cljs(page, events));
  await cljs(page, "(reset! last-patch-pt [9300 700])");
  const pasted = await clip(page, "paste", copied.text);
  check("⌘V pastes them", pasted.taken);
  check("... as one event of the history", Number(await cljs(page, events)) === e0 + 1, await cljs(page, events));
  const sel = await cljs(page, "(vec (sort-by id-z (sel-ids)))");
  const [a2, b2] = sel.replace(/[\[\]]/g, "").split(" ");
  const had = before.split(/[\s#{}]+/);
  check("... with new ids, selected", !!a2 && !!b2 && !had.includes(a2) && !had.includes(b2), sel);
  check("... where the pointer is, keeping their layout",
    (await cljs(page, `[((juxt :x :y) (get-in (current) [:boxes ${a2}])) ((juxt :x :y) (get-in (current) [:boxes ${b2}]))]`)) === "[[9300 700] [9400 700]]");
  const ls = await cljs(page, lines);
  check("... with the line between them", ls.includes(`[${a2} 0 ${b2} 0]`), ls);
  check("... and their lines to the boxes not copied, which are here", ls.includes(`[${x} 0 ${a2} 0]`) && ls.includes(`[${b2} 0 ${c} 0]`), ls);
  check("the boxes copied are as they were", ls.includes(`[${a} 0 ${b} 0]`) && (await cljs(page, `(:x (get-in (current) [:boxes ${a}]))`)) === "9000");
  await cljs(page, "(rewind)");
  check("one step back takes the whole paste away", !(await cljs(page, `(contains? (:boxes (current)) ${a2})`)).includes("true"));
  await cljs(page, "(tip)");

  // ── text without boxes is not pasted; data in it is never run ──
  const e1 = Number(await cljs(page, events));
  const plain = await clip(page, "paste", "(box :b1 \"print\" 0 0)");
  check("text that is only code is not pasted as boxes", !plain.taken && Number(await cljs(page, events)) === e1);
  const evil = ';; kairotic-paste {:boxes {:b1 {:text "print" :x 9500 :y 900 :data (set! js/window.kairoticEvil 1)}} :lines [[:b1 0 :b77 0]]}';
  await cljs(page, "(reset! last-patch-pt nil)");
  await clip(page, "paste", evil);
  check("what a clipboard holds is read as data, never run", (await page.evaluate(() => window.kairoticEvil)) === undefined);
  check("... a line to a box that is not here is left out", !(await cljs(page, lines)).includes(":b77"));
  const ev = await cljs(page, "(first (sel-ids))");
  await cljs(page, `(delete ${ev})`);

  // ── cut ──
  await cljs(page, `(swap! ui assoc :sel (sel-of [${c}]))`);
  const e2 = Number(await cljs(page, events));
  const cut = await clip(page, "cut");
  check("⌘X puts the box on the clipboard", cut.taken && cut.text.includes(`"print"`));
  check("... and deletes it, in one event", (await until(page, `(contains? (:boxes (current)) ${c})`, (g) => g === "false")) === "false"
        && Number(await cljs(page, events)) === e2 + 1);
  await cljs(page, "(reset! last-patch-pt [9000 520])");
  await clip(page, "paste", cut.text);
  const c2 = (await cljs(page, "(first (sel-ids))")).trim();
  check("... and pasting brings it back, with a new id", c2 !== c && (await cljs(page, `(:text (get-in (current) [:boxes ${c2}]))`)) === '"print"', c2);
  check("... its line from a box that is here, too", (await cljs(page, lines)).includes(`[${b} 0 ${c2} 0]`));

  // ── duplicate, with its data ──
  const h = (await cljs(page, '(box "html" 9600 300)')).trim();
  await cljs(page, `(values! ${h} {:freq 330})`);
  const e3 = Number(await cljs(page, events));
  const d = (await cljs(page, `(first (duplicate ${h}))`)).trim();
  check("(duplicate …) makes a copy a little below and to the right", (await cljs(page, `((juxt :x :y) (get-in (current) [:boxes ${d}]))`)) === "[9620 320]");
  check("... in one event", Number(await cljs(page, events)) === e3 + 1);
  check("... with its data", (await cljs(page, `(get-in (current) [:boxes ${d} :data :values])`)) === "{:freq 330}");

  // ⌘/Ctrl+D on the selection
  await cljs(page, `(swap! ui assoc :sel (sel-of [${x}]))`);
  await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.getSelection().removeAllRanges(); });
  const n0 = Number(await cljs(page, "(count (:boxes (current)))"));
  await page.keyboard.press("Control+d");
  check("⌘/Ctrl+D duplicates the selected boxes", Number(await until(page, "(count (:boxes (current)))", (g) => Number(g) === n0 + 1)) === n0 + 1);
  const xd = (await cljs(page, "(first (sel-ids))")).trim();

  // while something is being written, the keys are the field's
  await cljs(page, `(swap! ui assoc :sel (sel-of [${a}]))`);
  await cljs(page, '(set-repl-text! "abc") (focus-repl!)');
  const inField = await page.evaluate(() => {
    const dt = new DataTransfer();
    const e = new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(e);
    return dt.getData("text/plain");
  });
  check("in the REPL, ⌘C copies its text, not the boxes", !inField.includes("kairotic-paste"));
  await cljs(page, '(set-repl-text! "")');

  await cljs(page, `(swap! ui assoc :sel nil) (reset! last-patch-pt nil) (delete ${x} ${a} ${b} ${a2} ${b2} ${c2} ${h} ${d} ${xd})`);
}
