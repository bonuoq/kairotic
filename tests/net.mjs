// SPDX-License-Identifier: MPL-2.0
// @kairotic/net on one page (outside a room, the boxes work for this page alone): share → shared as a bus,
// with who shared it; pulse counts the tempo started with start, on its beat, changes with bpm keeping the
// beat, and says 0 at stop. Two pages in one room: tests/talk.mjs.
// In the audio app of tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function net(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the net tests", false); return; }
  await cljs(page, "(stop) (net-set-tempo! nil)");
  const X = 9600;
  const sh = (await cljs(page, `(box "share chords" ${X} 100)`)).trim();
  const known = await until(page, '(boolean (comp/lookup "share"))', (x) => x === "true", 20000);
  check("writing share brings @kairotic/net into the work", known === "true", known);
  if (known !== "true") { await cljs(page, `(delete ${sh})`); return; }
  await cljs(page, `(comp/define! "netsink" {:io [2 0] :receive (fn [{:keys [inlet value state]}] {:state (conj (or state []) [inlet value])})})`);
  const rd = (await cljs(page, `(box "shared chords" ${X} 160)`)).trim();
  const other = (await cljs(page, `(box "shared other" ${X + 150} 160)`)).trim();
  const pu = (await cljs(page, `(box "pulse 2" ${X + 300} 160)`)).trim();
  const sk = (await cljs(page, `(box "netsink" ${X} 240)`)).trim();
  const sk2 = (await cljs(page, `(box "netsink" ${X + 300} 240)`)).trim();
  await cljs(page, `(connect ${rd} 0 ${sk} 0) (connect ${rd} 1 ${sk} 1) (connect ${other} 0 ${sk} 0) (connect ${pu} 0 ${sk2} 0) (connect ${pu} 1 ${sk2} 1)`);
  await cljs(page, `(set! (.-value ($ "talk-name")) "Me") (play)`);
  await page.waitForTimeout(500);

  await cljs(page, `(send! ${sh} [60 64 67])`);
  const got = await until(page, `(get-in @eng/rt [:states ${sk}])`, (x) => x.includes("[60 64 67]"));
  check("share → shared: the value on the left, who shared it on the right", got.includes('[1 "Me"]') && got.includes("[0 [60 64 67]]"), got);
  check("... only on its channel", !got.includes(":other"), got);
  await cljs(page, `(send! ${sh} {:type :note :freq 440.0 :gate true})`);
  const ev = await until(page, `(get-in @eng/rt [:states ${sk}])`, (x) => x.includes(":freq 440"));
  check("... an event map travels as it is (EDN)", ev.includes("{:type :note, :freq 440, :gate true}"), ev);

  await cljs(page, `(send! ${pu} [:start 240])`);
  const bpm = await until(page, `(get-in @eng/rt [:states ${sk2}])`, (x) => x.includes("[1 240]"), 4000);
  check("pulse: start 240 sets the tempo (its bpm on the right)", bpm.includes("[1 240]"), bpm);
  const counts = await until(page, `(mapv second (filter (fn [[i]] (= i 0)) (get-in @eng/rt [:states ${sk2}])))`, (x) => (x.match(/\d+/g) || []).length >= 6, 6000);
  const ns = (counts.match(/\d+/g) || []).map(Number);
  check("... and counts it, divided (2: eighths), one after another from 0", ns.length >= 6 && ns[0] === 0 && ns.every((n, i) => n === i), counts);
  const before = Number(await cljs(page, "(net-beat)"));
  await cljs(page, `(send! ${pu} [:bpm 120])`);
  await page.waitForTimeout(200);
  const after = Number(await cljs(page, "(net-beat)"));
  check("bpm 120 changes the tempo keeping the beat where it is", Math.abs(after - before) < 0.6 && (await cljs(page, "(:bpm @net-tempo)")) === "120", before + " → " + after);
  await cljs(page, `(send! ${pu} :stop)`);
  const stop = await until(page, `(last (get-in @eng/rt [:states ${sk2}]))`, (x) => x === "[1 0]", 3000);
  check("stop: the bpm goes to 0, and the tempo is gone", stop === "[1 0]" && (await cljs(page, "@net-tempo")) === "nil", stop);
  check("the window bridge is there for the package", (await cljs(page, "(boolean (.-kairoticRoom js/window))")) === "true");

  await cljs(page, `(stop) (delete ${sh} ${rd} ${other} ${pu} ${sk} ${sk2})`);
}
