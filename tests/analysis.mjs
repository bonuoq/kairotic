// SPDX-License-Identifier: MPL-2.0
// @kairotic/analysis: writing one of its classes brings the package; an osc~ is heard as a pitch, a chroma,
// descriptors and a spectrum; a sound that starts and stops makes onsets. Meyda is loaded from jsDelivr.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 12000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function analysis(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the analysis tests", false); return; }
  const logs = [];
  // a 404 is the package looked for on npm first, before the page's own copy (until it is published)
  const onLog = (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) logs.push(m.text()); };
  page.on("console", onLog);
  const osc = (await cljs(page, '(box "osc~ 220" 4200 100)')).trim();
  const pitch = (await cljs(page, '(box "pitch~" 4200 160)')).trim();
  const loaded = await until(page, '(boolean (comp/lookup "pitch~"))', (g) => g === "true", 20000);
  check("pitch~ brings the analysis package", loaded === "true", loaded);
  const feats = (await cljs(page, '(box "features~ 20 rms centroid" 4200 220)')).trim();
  const chroma = (await cljs(page, '(box "chroma~" 4400 160)')).trim();
  const spec = (await cljs(page, '(box "spectrum~" 4600 160)')).trim();
  const g = (await cljs(page, '(box "gain~ 0" 4900 100)')).trim();
  const onset = (await cljs(page, '(box "onset~" 4900 160)')).trim();
  const count = (await cljs(page, '(box "counter 1 1000" 4900 220)')).trim();
  check("features~ has an outlet per descriptor", (await cljs(page, `(io (get-in (current) [:boxes ${feats}]))`)) === "[1 2]");
  await cljs(page, `(connect ${osc} 0 ${pitch} 0) (connect ${osc} 0 ${feats} 0) (connect ${osc} 0 ${chroma} 0)
                    (connect ${osc} 0 ${spec} 0) (connect ${osc} 0 ${g} 0) (connect ${g} 0 ${onset} 0) (connect ${onset} 0 ${count} 0)`);
  await cljs(page, "(play)");

  const hz = await until(page, `(:hz (get-in @eng/rt [:states ${pitch}]))`, (x) => Math.abs(Number(x) - 220) < 1);
  check("pitch~ hears an osc~ 220 as 220 Hz", Math.abs(Number(hz) - 220) < 1, hz);
  const rms = await until(page, `(:rms (get-in @eng/rt [:states ${feats}]))`, (x) => Number(x) > 0);
  check("features~ sends the rms", Number(rms) > 0, rms + " " + logs.join(" | "));
  const cen = await until(page, `(:spectralCentroid (get-in @eng/rt [:states ${feats}]))`, (x) => Number(x) > 150 && Number(x) < 320);
  check("... and the centroid, in Hz", Number(cen) > 150 && Number(cen) < 320, cen);
  const top = await until(page, `(:top (get-in @eng/rt [:states ${chroma}]))`, (x) => x === ":a");
  check("chroma~: the strongest class of an A is :a", top === ":a", top);
  const cols = await until(page, `(count (second (last-shown ${spec})))`, (x) => x === "116");
  check("spectrum~ draws 116 columns", cols === "116", cols);

  for (let i = 0; i < 3; i++) {
    await cljs(page, `(send! ${g} 1 1)`); await page.waitForTimeout(350);
    await cljs(page, `(send! ${g} 1 0)`); await page.waitForTimeout(350);
  }
  const n = await until(page, `(get-in @eng/rt [:states ${count}])`, (x) => Number(x) >= 2, 3000);
  check("onset~: a sound that starts three times makes onsets", Number(n) >= 2 && Number(n) <= 6, n);

  await cljs(page, "(stop)");
  await cljs(page, `(delete ${osc} ${pitch} ${feats} ${chroma} ${spec} ${g} ${onset} ${count})`);
  page.off("console", onLog);
  check("no errors in the console during the analysis tests", logs.length === 0, logs.join(" | ").slice(0, 800));
}
