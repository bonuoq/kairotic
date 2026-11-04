// SPDX-License-Identifier: MPL-2.0
// Issue #146: an html box draws a small interface written as hiccup, made safe by an allowlist, and
// what its elements give goes out of its outlets.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(80); }
  return got;
};

// waits until something inside the box gives `want`
const untilBox = async (page, id, fn, want, ms = 4000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await inBox(page, id, fn); if (got === want) return got; await page.waitForTimeout(80); }
  return got;
};

// something inside the shadow root of the html box `id`
const inBox = (page, id, fn, arg) => page.evaluate(([id, fnSrc, arg]) => {
  const host = document.querySelector(`#scene .box[data-box="${id}"] .html-slot .html-host`);
  if (!host || !host.shadowRoot) return "no host";
  return (new Function("root", "arg", fnSrc))(host.shadowRoot, arg);
}, [id, fn, arg]);

export async function html(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the html tests", false); return; }
  const events = "(depth-of (norm (:pos @world)))";

  const hb = (await cljs(page, '(box "html" 2300 760)')).trim();
  const id = hb.slice(1);
  check("an html box is drawn as html", (await cljs(page, `(display-of (get-in (current) [:boxes ${hb}]))`)) === ":html");
  const host = await page.waitForSelector(`#scene .box[data-box="${id}"] .html-slot .html-host`, { timeout: 5000 }).then(() => true).catch(() => false);
  check("... its element is in its slot", host);
  check("... with the default view: a slider", (await inBox(page, id, "return !!root.querySelector('input[type=range]')")) === true);
  check("... and two outlets", (await cljs(page, `(io (get-in (current) [:boxes ${hb}]))`)) === "[1 2]");

  // a view written as EDN: what is not allowed is dropped
  const before = Number(await cljs(page, events));
  await cljs(page, `(code ${hb} "[:div.col [:script \\"alert(1)\\"] [:input {:type \\"range\\" :name :v :min 0 :max 10 :value 2 :out 0 :onchange \\"x\\"}] [:span.val :$v] [:input.t {:type \\"text\\" :name :t}] [:button {:out 1 :send 5 :onclick \\"x\\"} \\"go\\"]]")`);
  check("writing its view is one event of the history", Number(await cljs(page, events)) === before + 1, await cljs(page, events));
  check("its outlets follow the view", (await cljs(page, `(io (get-in (current) [:boxes ${hb}]))`)) === "[1 2]");
  await until(page, "true", () => true, 200);
  check("a script in the view is not drawn", (await inBox(page, id, "return root.querySelectorAll('script').length")) === 0);
  check("... nor any on* attribute", (await inBox(page, id, "return [...root.querySelectorAll('*')].some(e => [...e.attributes].some(a => a.name.startsWith('on')))")) === false);
  check("the hole shows the slider's own value", (await inBox(page, id, "return root.querySelector('.val').textContent")) === "2");

  // a slider while it moves: its value goes out, and is shown, without an event of the history
  const num = (await cljs(page, '(box "number" 2300 960)')).trim();
  const num2 = (await cljs(page, '(box "number" 2420 960)')).trim();
  await cljs(page, `(connect ${hb} 0 ${num} 0) (connect ${hb} 1 ${num2} 0)`);
  const b2 = Number(await cljs(page, events));
  await inBox(page, id, "const s = root.querySelector('input[type=range]'); s.value = '7'; s.dispatchEvent(new Event('input', { bubbles: true })); return true");
  check("moving the slider sends its value out", (await until(page, `(get-in @eng/rt [:states ${num}])`, (g) => g === "7")) === "7");
  check("... the hole shows it", (await untilBox(page, id, "return root.querySelector('.val').textContent", "7")) === "7");
  check("... and no event of the history yet", Number(await cljs(page, events)) === b2);
  await cljs(page, `(send! ${num} 0)`);
  await inBox(page, id, "const s = root.querySelector('input[type=range]'); s.dispatchEvent(new Event('change', { bubbles: true })); return true");
  check("letting it go sends it once more", (await until(page, `(get-in @eng/rt [:states ${num}])`, (g) => g === "7")) === "7");
  check("... a message, not an event of the history", Number(await cljs(page, events)) === b2, await cljs(page, events));

  // a button
  await inBox(page, id, "root.querySelector('button').click(); return true");
  check("a button sends its :send out of its outlet", (await until(page, `(get-in @eng/rt [:states ${num2}])`, (g) => g === "5")) === "5");

  // values from the inlet
  await cljs(page, `(send! ${hb} {:v 3})`);
  const hole = await untilBox(page, id, "return root.querySelector('.val').textContent", "3");
  check("a map on the inlet sets the hole", hole === "3", hole);
  const slid = await untilBox(page, id, "return root.querySelector('input[type=range]').value", "3");
  check("... and the slider named so", slid === "3", slid);

  // what is typed keeps the focus when the scene is written again
  await inBox(page, id, "const t = root.querySelector('input.t'); t.focus(); t.value = 'ab'; return true");
  await cljs(page, "(render-all!)");
  check("a field keeps the focus when the patch is drawn again", (await inBox(page, id, "return root.activeElement && root.activeElement.className")) === "t");
  check("... and what is typed in it", (await inBox(page, id, "return root.querySelector('input.t').value")) === "ab");
  const wasOn = await cljs(page, "(eng/running?)");
  await page.keyboard.type(" c");
  check("a space typed in it is text, not ▶ or ■", (await cljs(page, "(eng/running?)")) === wasOn);
  await page.keyboard.press("Enter");
  check("Enter keeps the text as its value", (await until(page, `(get-in @eng/rt [:states (fid ${hb}) :values :t])`, (g) => g === '"ab c"')) === '"ab c"');

  // HTML pasted as its view is read as hiccup and made safe
  await cljs(page, `(code ${hb} "<div><img src=x onerror=alert(1)><b>hi $v</b><a href='javascript:x'>l</a><button data-out='2' data-send=':go'>go</button></div>")`);
  const kept = await cljs(page, `(:view (:data (get-in (current) [:boxes ${hb}])))`);
  check("pasted HTML is kept as hiccup", kept === '[:div [:b "hi " :$v] [:button {:out 2, :send :go} "go"]]', kept);
  check("... with no image or link drawn", (await untilBox(page, id, "return root.querySelectorAll('b').length", 1), await inBox(page, id, "return root.querySelectorAll('img, a').length")) === 0);
  check("... and three outlets", (await cljs(page, `(io (get-in (current) [:boxes ${hb}]))`)) === "[1 3]");
  check("its source reads back as EDN", (await cljs(page, `(str/starts-with? (source ${hb}) "[:div")`)) === "true");
  check("an unreadable view is refused", /ERR/.test(await cljs(page, `(code ${hb} "[:div")`)));

  // a size of its own
  check("an html box can be resized", (await cljs(page, `(resize ${hb} 400 220)`)) === "[400 220]");
  check("... and the work's code keeps its view", (await cljs(page, `(str/includes? (patch->code (current)) "(code ${hb}")`)) === "true");

  await cljs(page, `(delete ${hb} ${num} ${num2})`);
  check("a deleted html box forgets its element", (await cljs(page, `(contains? @html-nodes (fid ${hb}))`)) === "false");
}
