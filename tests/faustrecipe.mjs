// SPDX-License-Identifier: MPL-2.0
// Discussion #114 (Study 35, @kairotic/faust-units): Recipe, in the window of a faust~, finds the values of
// its sliders that sound closest to the sound of a sample box, and writes them in the code: edited, not
// applied, so applying is one event and the box keeps its parameters in sight. In the app already loaded by
// tests/browser.mjs with a local work open (the audio app: it compiles Faust). check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const text = (s) => { try { return JSON.parse(s); } catch (_) { return String(s); } };
const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};
const status = (page) => page.evaluate(() => (document.querySelector("#code-win .rcp-st") || {}).textContent || "");

const source = `import("stdfaust.lib");
freq = hslider("freq", 220, 80, 1000, 0.01);
cutoff = hslider("cutoff", 800, 100, 8000, 1);
process = os.sawtooth(freq) : fi.lowpass(2, cutoff) : *(0.3);`;

export async function faustrecipe(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the recipe tests", false); return; }
  const f = (await cljs(page, '(box "faust~" 7400 1400)')).trim();
  const s = (await cljs(page, '(box "sample" 7400 1300)')).trim();
  await cljs(page, `(code ${f} ${JSON.stringify(source)})`);
  const st = await until(page, `(:status (cbox/compiled "faust" (source ${f})))`, (x) => x === ":ok" || x === ":error", 60000);
  check("the faust~ compiles", st === ":ok", st);

  // the sound to match: the same code at freq 330 and cutoff 3000, played offline and kept in the sample box
  const kept = await page.evaluate(async ({ source, s }) => {
    const R = await window.kairoticImport("kairotic/packages/faust-units/recipe.mjs");
    const faust = await scittle.core.eval_string("(in-ns 'user) (kairotic.faust/load)");
    const { render } = await R.compileOffline(faust, source);
    window.__rcpY = render({ freq: 330, cutoff: 3000 }, { dur: 1.2 });
    return scittle.core.eval_string(`(in-ns 'user) (.then (snd/keep! 44100 #js [(.-__rcpY js/window)]) (fn [d] (sample! ${s} d)))`);
  }, { source, s }).catch((e) => "error: " + e.message);
  check("the sample box keeps the sound to match", typeof kept === "number" && kept > 1, String(kept));

  await cljs(page, `(open-code-editor! ${f})`);
  const open = await page.waitForSelector('#code-win [data-cw="recipe"]', { timeout: 5000 }).then(() => true).catch(() => false);
  check("the window of a faust~ has Recipe in its bar", open);
  if (!open) { await cljs(page, `(delete ${f}) (delete ${s})`); return; }
  await page.waitForSelector("#code-win .cm-editor", { timeout: 15000 }).catch(() => {});
  await page.click('#code-win [data-cw="recipe"]');
  const opts = await page.evaluate(() => [...document.querySelectorAll("#code-win .rcp-src option")].map((o) => o.value));
  check("Recipe offers the sample boxes of the patch, and a file", opts.includes(s.slice(1)) && opts.includes("file"), JSON.stringify(opts));
  await page.selectOption("#code-win .rcp-src", s.slice(1));
  const n0 = Number(await cljs(page, "(depth-of (norm (:pos @world)))"));

  // Find, then Stop: it stops, and nothing is written
  await page.click('#code-win [data-cw="find"]');
  await page.waitForFunction(() => /listening to random|searching/.test(document.querySelector("#code-win .rcp-st").textContent), null, { timeout: 60000 }).catch(() => {});
  check("Find becomes Stop while it listens", (await page.textContent('#code-win [data-cw="find"]')) === "Stop", await status(page));
  await page.click('#code-win [data-cw="find"]');
  await page.waitForFunction(() => /^stopped/.test(document.querySelector("#code-win .rcp-st").textContent), null, { timeout: 10000 }).catch(() => {});
  check("Stop stops it, and nothing is written", /^stopped/.test(await status(page)) && (await cljs(page, "(:dirty @code-win)")) !== "true", await status(page));

  // Find, to the end
  await page.click('#code-win [data-cw="find"]');
  await page.waitForFunction(() => /^found|✗/.test(document.querySelector("#code-win .rcp-st").textContent), null, { timeout: 120000 }).catch(() => {});
  const said = await status(page);
  check("Find finds a setting", /^found/.test(said), said);
  const m = said.match(/distance ([\d.]+) \(the nearest random setting: ([\d.]+)\)/);
  check("... closer than the nearest of the random settings", m && +m[1] < +m[2], said);
  const code = text(await cljs(page, "(cw-text)"));
  const fq = +((code.match(/hslider\("freq", ([\d.]+),/) || [])[1]);
  check("... the pitch where it is heard, written in the code", Math.abs(12 * Math.log2(fq / 330)) < 0.5, String(fq));
  check("... edited, not applied", (await cljs(page, "(:dirty @code-win)")) === "true" && (await cljs(page, `(str/includes? (source ${f}) "220")`)) === "true");
  check("... and the two sounds can be heard", await page.evaluate(() => [...document.querySelectorAll("#code-win .rcp-play")].every((b) => !b.hidden)));

  await cljs(page, "(apply-code!)");
  check("Apply writes the recipe to the box", (await until(page, `(str/includes? (source ${f}) ${JSON.stringify('hslider("freq", ' + fq + ",")})`, (x) => x === "true", 3000)) === "true");
  check("... as one event of the history", Number(await cljs(page, "(depth-of (norm (:pos @world)))")) === n0 + 1);

  await cljs(page, "(close-code-win!)");
  await cljs(page, `(delete ${f}) (delete ${s})`);
}
