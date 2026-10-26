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
  // monitor: the rms of features~ as a line, the chroma as a strip, the onsets (below) as marks; connected
  // before ▶ so that their first values reach it (they send only what changes, and the osc~ does not change)
  const mon = (await cljs(page, '(box "monitor 6 rms chroma onset" 4600 300)')).trim();
  check("monitor has an inlet per name", (await cljs(page, `(io (get-in (current) [:boxes ${mon}]))`)) === "[3 0]");
  await cljs(page, `(connect ${feats} 0 ${mon} 0) (connect ${chroma} 0 ${mon} 1) (connect ${onset} 0 ${mon} 2)`);
  const lane = (i) => `(get-in (second (last-shown ${mon})) [:lanes ${i}])`;
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
  const nr = await until(page, `(count (filter (fn [[_ v]] (number? v)) ${lane(0)}))`, (x) => Number(x) > 0);
  check("monitor draws what features~ sends in its first lane", Number(nr) > 0, nr);
  // and some values sent to it directly, for a line and a strip that are fresh in the window
  for (let i = 0; i < 6; i++) {
    await cljs(page, `(send! ${mon} 0 ${(0.1 + 0.05 * i).toFixed(2)}) (send! ${mon} 1 [${Array.from({ length: 12 }, (_, j) => ((i + j) % 12) / 11).map((x) => x.toFixed(2)).join(" ")}])`);
    await page.waitForTimeout(120);
  }
  const nl = await cljs(page, `(count (filter (fn [[_ v]] (number? v)) ${lane(0)}))`);
  check("... a line of the numbers it gets", Number(nl) >= 5, nl);
  const nc = await cljs(page, `(count (filter (fn [[_ v]] (= 12 (count v))) ${lane(1)}))`);
  check("... and of the lists of 12 in the second lane", Number(nc) >= 2, nc);
  const cells = await cljs(page, `(let [b (get-in (current) [:boxes ${mon}])]
                                    (count (filter (fn [f] (and (= :rect (first f)) (number? (:opacity (second f)))))
                                                   (ctl-shapes* (ctl-m ${mon} b) b))))`);
  check("... drawn as cells with an opacity", Number(cells) > 0, cells);


  for (let i = 0; i < 3; i++) {
    await cljs(page, `(send! ${g} 1 1)`); await page.waitForTimeout(350);
    await cljs(page, `(send! ${g} 1 0)`); await page.waitForTimeout(350);
  }
  const n = await until(page, `(get-in @eng/rt [:states ${count}])`, (x) => Number(x) >= 2, 3000);
  check("onset~: a sound that starts three times makes onsets", Number(n) >= 2 && Number(n) <= 6, n);
  const marks = await cljs(page, `(count ${lane(2)})`);
  check("monitor marks the onsets in its third lane", Number(marks) >= 2, marks);

  // transcribe: a sound that starts three times, then moves to another pitch, written into a freqt
  // (the pitch~ above hears the osc~ itself: this one hears it through the gain~ that starts and stops it)
  const p2 = (await cljs(page, '(box "pitch~" 5200 100)')).trim();
  const tr = (await cljs(page, '(box "transcribe 60" 5200 160)')).trim();
  const fq = (await cljs(page, '(box "freqt" 5200 220)')).trim();
  await cljs(page, `(connect ${g} 0 ${p2} 0) (connect ${p2} 0 ${tr} 0) (connect ${tr} 0 ${fq} 0)`);
  await cljs(page, `(send! ${g} 1 0)`); await page.waitForTimeout(300);
  await cljs(page, `(send! ${tr} :rec)`);
  for (let i = 0; i < 3; i++) {
    await cljs(page, `(send! ${g} 1 1)`); await page.waitForTimeout(400);
    await cljs(page, `(send! ${g} 1 0)`); await page.waitForTimeout(300);
  }
  await cljs(page, `(send! ${osc} 330) (send! ${g} 1 1)`); await page.waitForTimeout(500);
  await cljs(page, `(send! ${g} 1 0)`); await page.waitForTimeout(300);
  await cljs(page, `(send! ${tr} :stop)`);
  const strokes = `(mapv (fn [[_ s]] (:pts s)) (sort-by (fn [[_ s]] (ffirst (:pts s))) (:strokes (box-data ${fq}))))`;
  const n4 = await until(page, `(count ${strokes})`, (x) => x === "4", 8000);
  const pts = await cljs(page, strokes);
  const evs = await cljs(page, `(pr-str (take-last 6 (filter (fn [e] (= ${fq} (second e))) (:events (node (first (:pos @world)))))))`);
  check("transcribe writes each note as a stroke of the freqt", n4 === "4", pts.slice(0, 300) + " · events: " + evs.slice(0, 900));
  // within 10 cents (the attack of a note moves its median a little)
  const hzs = await cljs(page, `(mapv (fn [p hz] (< (js/Math.abs (* 1200 (/ (js/Math.log (/ (second (first p)) hz)) js/Math.LN2))) 10))
                                       ${strokes} [220 220 220 330])`);
  check("... at the pitch heard (220 three times, then 330)", hzs === "[true true true true]",
        hzs + " " + await cljs(page, `(mapv (fn [p] (second (first p))) ${strokes})`));
  const durs = await cljs(page, `(mapv (fn [p] (/ (js/Math.round (* 10 (- (first (last p)) (first (first p))))) 10)) ${strokes})`);
  check("... with their length in beats (about 0.4, and 0.5)", /^\[0\.[345] 0\.[345] 0\.[345] 0\.[456]\]$/.test(durs), durs);
  const starts = await cljs(page, `(mapv (fn [p] (first (first p))) ${strokes})`);
  check("... from the beginning of the take", Number(JSON.parse(starts.replace(/ /g, ","))[0]) < 0.3, starts);

  // punch-in: rec 1 keeps what is before beat 1 (the second note cut there) and writes from it
  await cljs(page, `(send! ${osc} 440) (send! ${tr} [:rec 1])`);
  await cljs(page, `(send! ${g} 1 1)`); await page.waitForTimeout(500);
  await cljs(page, `(send! ${g} 1 0)`); await page.waitForTimeout(300);
  await cljs(page, `(send! ${tr} :stop)`);
  const after = await until(page, `(mapv (fn [p] [(js/Math.round (second (first p))) (first (first p)) (first (last p))]) ${strokes})`,
                            (x) => (x.match(/\[/g) || []).length === 4, 8000);
  const ok = await cljs(page, `(let [s (mapv (fn [p] [(second (first p)) (first (first p)) (first (last p))]) ${strokes})
                                     near (fn [a b] (< (js/Math.abs (* 1200 (/ (js/Math.log (/ a b)) js/Math.LN2))) 15))]
                                 [(count s) (near (first (nth s 0)) 220) (near (first (nth s 1)) 220) (<= (nth (nth s 1) 2) 1)
                                  (near (first (nth s 2)) 440) (>= (second (nth s 2)) 1)])`);
  check("transcribe rec t keeps what is before t and writes from it", ok === "[3 true true true true true]", ok + " " + after);

  // overwrite: ovr 0.6 writes a 330 over what was there from beat 0.6, and keeps the 440 after the take
  await cljs(page, `(send! ${osc} 330) (send! ${tr} [:ovr 0.6])`);
  await cljs(page, `(send! ${g} 1 1)`); await page.waitForTimeout(300);
  await cljs(page, `(send! ${g} 1 0)`); await page.waitForTimeout(100);
  await cljs(page, `(send! ${tr} :stop)`);
  const ovr = await until(page, `(let [s (mapv (fn [p] [(second (first p)) (first (first p)) (first (last p))]) ${strokes})
                                       near (fn [a b] (< (js/Math.abs (* 1200 (/ (js/Math.log (/ a b)) js/Math.LN2))) 15))
                                       of (fn [hz] (filter (fn [x] (near (first x) hz)) s))]
                                   [(count (of 330)) (boolean (some (fn [x] (>= (second x) 0.6)) (of 330)))
                                    (count (of 440)) (boolean (some (fn [x] (< (second x) 0.3)) (of 220)))])`,
                          (x) => x === "[1 true 1 true]", 8000);
  check("transcribe ovr t writes over the take and keeps what came after", ovr === "[1 true 1 true]",
        ovr + " " + await cljs(page, `(mapv (fn [p] [(js/Math.round (second (first p))) (first (first p)) (first (last p))]) ${strokes})`));

  await cljs(page, "(stop)");
  await cljs(page, `(delete ${osc} ${pitch} ${feats} ${chroma} ${spec} ${g} ${onset} ${count} ${p2} ${tr} ${fq})`);
  page.off("console", onLog);
  check("no errors in the console during the analysis tests", logs.length === 0, logs.join(" | ").slice(0, 800));
}
