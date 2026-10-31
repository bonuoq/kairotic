// SPDX-License-Identifier: MPL-2.0
// Discussion #115 (Study 31, @kairotic/faust-units): the code of a faust~ opens beside its box as a patch
// of Faust's own elements and as code, kept in sync; applying is still one event; the parameters stay
// in the box in the patch, in sight. In the app already loaded by tests/browser.mjs with a local work
// open (the audio app: it compiles Faust). check(label, ok, detail) records one result.
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};
const rowCentre = async (page, id) => {
  await page.waitForFunction((id) => document.querySelector('#scene .code-area[data-box="' + id + '"]'), id, { timeout: 10000 });
  return page.evaluate((id) => {
    const el = document.querySelector('#scene .code-area[data-box="' + id + '"]');
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }, id);
};
const boxTexts = (page) => page.evaluate(() => [...document.querySelectorAll("#code-win .cw-patch .b text")].map((t) => t.textContent));
// a double-click on the paper of the patch pane, at (dx, dy) from its corner, then a box written there
// (from its bottom-right corner, where the boxes read from code are not)
const writeBox = async (page, dx, dy, text) => {
  const c = await page.evaluate(() => { const r = document.querySelector("#code-win .fu-canvas").getBoundingClientRect(); return [r.right, r.bottom]; });
  await page.mouse.click(c[0] - dx, c[1] - dy);
  await page.mouse.click(c[0] - dx, c[1] - dy);
  await page.waitForSelector("#code-win .fu-editor", { timeout: 3000 });
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
};

const source = `import("stdfaust.lib");
cutoff = hslider("cutoff", 900, 50, 5000, 1);
process = no.noise : fi.lowpass(2, cutoff) * 0.2;`;

export async function faustview(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the faust~ patch tests", false); return; }
  const f = (await cljs(page, '(box "faust~" 7400 100)')).trim();
  const fid = f.slice(1);
  await cljs(page, `(code ${f} ${JSON.stringify(source)})`);
  const st = await until(page, `(:status (cbox/compiled "faust" (source ${f})))`, (x) => x === ":ok" || x === ":error", 60000);
  check("the faust~ compiles", st === ":ok", st);
  const params = () => page.evaluate((id) => [...document.querySelectorAll('#scene .param[data-box="' + id + '"]')].map((p) => p.dataset.param), fid);
  check("its parameters are in the box in the patch", JSON.stringify(await params()) === '["cutoff"]', JSON.stringify(await params()));

  // a double-click on its code row: the code window, split, with the patch on the left
  const [x, y] = await rowCentre(page, fid);
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
  const open = await page.waitForSelector("#code-win .cw-body.split .cw-patch", { timeout: 5000 }).then(() => true).catch(() => false);
  check("a double-click opens the code with its patch beside it", open);
  if (!open) { await cljs(page, `(delete ${f})`); return; }
  const drawn = await page.waitForFunction(() => document.querySelectorAll("#code-win .cw-patch .b").length >= 5, null, { timeout: 30000 }).then(() => true).catch(() => false);
  const t0 = await boxTexts(page);
  check("the patch shows the code as boxes", drawn && ["no.noise", "hslider cutoff 900 50 5000 1", "fi.lowpass 2", "* 0.2", "out 1"].every((t) => t0.includes(t)), JSON.stringify(t0));
  await page.waitForSelector("#code-win .cm-editor", { timeout: 15000 }).catch(() => {});

  // the window covers nothing of the box: its parameters stay in sight
  const overlap = await page.evaluate((id) => {
    const a = document.querySelector('#scene .box[data-box="' + id + '"]').getBoundingClientRect(), b = document.getElementById("code-win").getBoundingClientRect();
    return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
  }, fid);
  check("the window opens beside the box, not over it", !overlap, JSON.stringify(await page.evaluate(() => document.getElementById("code-win").getBoundingClientRect().toJSON())));

  // the patch writes the code in the editor: edited, not applied
  await writeBox(page, 200, 40, "hslider depth 0.5 0 1 0.01");
  const edited = await until(page, "(cw-text)", (t) => t.includes('hslider("depth", 0.5, 0, 1, 0.01)'), 3000);
  check("a box written in the patch is in the editor's code", edited.includes('hslider("depth"'), edited);
  check("... edited, not applied yet", (await cljs(page, "(:dirty @code-win)")) === "true");
  check("... the box keeps its code until then", (await cljs(page, `(str/includes? (source ${f}) "depth")`)) === "false");

  // wire it: depth into the right inlet of the * (the gain)
  const ends = await page.evaluate(() => {
    const gs = [...document.querySelectorAll("#code-win .cw-patch .b")], t = (g) => g.querySelector("text").textContent;
    const a = gs.find((g) => t(g).startsWith("hslider depth")).querySelector(".port.out").getBoundingClientRect();
    const ins = gs.find((g) => t(g) === "* 0.2").querySelectorAll(".port.in");
    const b = ins[ins.length - 1].getBoundingClientRect();
    return [a.x + a.width / 2, a.y + 1, b.x + b.width / 2, b.y + 2];
  });
  await page.mouse.move(ends[0], ends[1]);
  await page.mouse.down();
  await page.mouse.move(ends[2], ends[3], { steps: 8 });
  await page.mouse.up();
  const wired = await until(page, "(cw-text)", (t) => /\* depth\)/.test(t), 3000);
  check("a wire drawn in the patch is in the code", /\* depth\)/.test(wired), wired);

  // Apply: one event, and the box's parameters follow (cutoff and depth, in the patch)
  const events = "(depth-of (norm (:pos @world)))";
  const n0 = Number(await cljs(page, events));
  await page.click('#code-win [data-cw="apply"]');
  check("Apply writes the code to the box", (await until(page, `(str/includes? (source ${f}) "depth")`, (x) => x === "true", 3000)) === "true");
  const n1 = Number(await cljs(page, events));
  check("... as one event of the history", n1 === n0 + 1, n0 + " → " + n1);
  await page.waitForFunction((id) => document.querySelectorAll('#scene .param[data-box="' + id + '"]').length === 2, fid, { timeout: 60000 }).catch(() => {});
  check("the new parameter is in the box in the patch", JSON.stringify(await params()) === '["cutoff","depth"]', JSON.stringify(await params()));

  // code written in the editor redraws the patch
  await cljs(page, `(set-editor-text! ${JSON.stringify('import("stdfaust.lib");\nprocess = os.osc(330) * 0.1;\n')})`);
  await cljs(page, `(.setCode (:fv @code-win) (cw-text))`);
  const redrawn = await page.waitForFunction(() => [...document.querySelectorAll("#code-win .cw-patch .b text")].some((t) => t.textContent === "os.osc 330"), null, { timeout: 5000 }).then(() => true).catch(() => false);
  check("code written in the editor redraws the patch", redrawn, JSON.stringify(await boxTexts(page)));

  // code the boxes cannot read: the patch is marked out of date, the code is still the code
  await cljs(page, `(.setCode (:fv @code-win) "process = \\\\(x).(x * 2);")`);
  const stale = await page.waitForFunction(() => document.querySelector("#code-win .fu-canvas.stale"), null, { timeout: 5000 }).then(() => true).catch(() => false);
  check("code the boxes cannot read marks the patch out of date", stale);

  // Patch in the bar hides it, and the next faust~ remembers
  await page.click('#code-win [data-cw="patch"]');
  check("Patch in the bar hides the patch", await page.evaluate(() => !!document.querySelector("#code-win .cw-body.split.nopatch")));
  await page.click('#code-win [data-cw="patch"]');
  check("... and shows it again", await page.evaluate(() => !document.querySelector("#code-win .cw-body.split.nopatch")));

  // closing without applying asks, as for any code; discarding leaves the box as it was applied
  await cljs(page, "(ask-close!)");
  const asked = await page.evaluate(() => !document.querySelector("#code-win .cw-confirm").hidden);
  check("closing with edits asks first", asked);
  await page.click('#code-win [data-cw="discard"]');
  check("Discard closes the window", !(await page.evaluate(() => !!document.getElementById("code-win"))));
  check("... and the box keeps the code applied", (await cljs(page, `(str/includes? (source ${f}) "depth")`)) === "true");

  // other code boxes open as before, without a patch
  const s = (await cljs(page, '(box "script" 7400 500)')).trim();
  await cljs(page, `(code ${s} "(fn [{:keys [value]}] {:out [[0 value]]})")`);
  await cljs(page, `(open-code-editor! ${s})`);
  await page.waitForSelector("#code-win", { timeout: 5000 });
  check("a script opens without a patch", await page.evaluate(() => !document.querySelector("#code-win .cw-patch") && !document.querySelector('#code-win [data-cw="patch"]')));
  await cljs(page, "(close-code-win!)");
  await cljs(page, `(delete ${s}) (delete ${f})`);
}
