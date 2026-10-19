// SPDX-License-Identifier: MPL-2.0
// Issue #35: presets from the keyframes of the history. A keyframe recalled gives the boxes their texts of
// then, as one event; a morph moves the controls as messages until (morph :keep) writes them; a generated
// preset keeps what remains and varies what changes; the presets box asks for all of it.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === expected) return got; await page.waitForTimeout(60); }
  return got;
};

export async function presets(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the presets tests", false); return; }
  const ready = await until(page, '(some? (comp/lookup "knob"))', "true", 20000);
  check("the knob class is there for the presets tests", ready === "true", ready);
  const events = "(depth-of (norm (:pos @world)))";
  const text = (id) => `(:text (get-in (current) [:boxes ${id}]))`;
  const texts = (ids) => `(mapv (fn [id] (:text (get-in (current) [:boxes id]))) [${ids.join(" ")}])`;

  // a knob, a log knob, a metro and a knob inside a sub-patch: keyframe a, then keyframe b
  const k = (await cljs(page, '(box "knob 0 1 0.25" 2400 100)')).trim();
  const lk = (await cljs(page, '(box "knob 20 20000 100 log" 2500 100)')).trim();
  const m = (await cljs(page, '(box "metro 250" 2600 100)')).trim();
  const sp = (await cljs(page, '(box "patch" 2700 100)')).trim();
  const ik = (await cljs(page, `(let [r (atom nil)] (inside ${sp} (reset! r (box "knob 0 10 2" 20 20))) @r)`)).trim();
  const inner = `(get-in (current) [:boxes ${sp} :data :boxes ${ik} :text])`;
  await cljs(page, '(snapshot "p35-a")');
  await cljs(page, `(text! ${k} "knob 0 1 0.75") (text! ${lk} "knob 20 20000 10000 log") (text! ${m} "metro 500")`);
  await cljs(page, `(inside ${sp} (text! ${ik} "knob 0 10 8"))`);
  await cljs(page, '(snapshot "p35-b")');
  const ids = [k, lk, m];
  const A = '["knob 0 1 0.25" "knob 20 20000 100 log" "metro 250"]';
  const B = '["knob 0 1 0.75" "knob 20 20000 10000 log" "metro 500"]';

  const kfs = await cljs(page, '(mapv :label (filter (fn [k] (#{"p35-a" "p35-b"} (:label k))) (keyframes)))');
  check("the snapshots are keyframes, in order of moment", kfs === '["p35-a" "p35-b"]', kfs);
  check("every keyframe has its number", (await cljs(page, "(= (map :n (keyframes)) (range 1 (inc (count (keyframes)))))")) === "true");

  // recall: one event, sub-patches too
  let before = Number(await cljs(page, events));
  const r = await cljs(page, '(recall "p35-a")');
  check("recall gives the boxes their texts of the keyframe", (await cljs(page, texts(ids))) === A, await cljs(page, texts(ids)) + " " + r);
  check("... inside sub-patches too", (await cljs(page, inner)) === '"knob 0 10 2"', await cljs(page, inner));
  check("... as one event of the history", Number(await cljs(page, events)) === before + 1, await cljs(page, events));
  check("... a [:batch …] of text changes",
    (await cljs(page, "(let [[op evs] (last (:events (node (first (:pos @world)))))] [op (count evs)])")) === "[:batch 4]");
  check("a merge sees every change inside a batch",
    (await cljs(page, '(:mod (summarize [[:batch [[:text :b1 "a"] [:in :b4 [:text :b2 "b"]]]]]))')) === "#{:b1 :b4}");
  check("... and renames the boxes inside it",
    (await cljs(page, '(remap-ev {:b1 :b9} [:batch [[:text :b1 "a"] [:text :b2 "b"]]])')) === '[:batch [[:text :b9 "a"] [:text :b2 "b"]]]');
  await cljs(page, "(rewind)");
  check("one step back undoes the whole recall", (await cljs(page, texts(ids))) === B, await cljs(page, texts(ids)));
  await cljs(page, "(forward)");
  check("(recall …) of what is already there changes nothing", (await cljs(page, '(:changed (recall "p35-a"))')) === "0");
  check("a keyframe that is not there is refused", (await cljs(page, "(recall 9999)")).startsWith("ERR There is no keyframe 9999"));
  check("... and so is a label nobody wrote", (await cljs(page, '(recall "nope")')).startsWith("ERR No snapshot"));

  // morph: the controls move as messages; nothing is written until (morph :keep)
  before = Number(await cljs(page, events));
  const mv = await cljs(page, `(let [v (morph "p35-a" "p35-b" 0.5)] [(get v ${k}) (js/Math.round (get v ${lk})) (get v ${sp}.${ik.slice(1)}) (contains? v ${m})])`);
  check("a morph moves the controls between two keyframes (geometrically for a log knob)", mv === "[0.5 1000 5 false]", mv);
  check("... the knob plays the value", (await cljs(page, `(get-in @eng/rt [:states (fid ${k})])`)) === "0.5");
  check("... and nothing is written", Number(await cljs(page, events)) === before && (await cljs(page, texts(ids))) === A);
  await cljs(page, "(morph :keep)");
  check("(morph :keep) keeps the morph in the texts",
    (await cljs(page, texts(ids))) === '["knob 0 1 0.5" "knob 20 20000 1000 log" "metro 250"]', await cljs(page, texts(ids)));
  check("... inside sub-patches too", (await cljs(page, inner)) === '"knob 0 10 5"', await cljs(page, inner));
  check("... as one event", Number(await cljs(page, events)) === before + 1, await cljs(page, events));

  // generate: within the ranges, what remains stays, the same seed makes the same preset
  before = Number(await cljs(page, events));
  const g = await cljs(page, '(generate 7 ["p35-a" "p35-b"])');
  check("a preset is generated from what changes", /:generated \d/.test(g) && Number(await cljs(page, events)) === before + 1, g);
  const nums = await cljs(page, `(mapv (fn [[id i]] (pst/num (nth (pst/words (:text (get-in (current) [:boxes id]))) i))) [[${k} 3] [${lk} 3] [${m} 1]])`);
  const [gk, glk, gm] = nums.replace(/[\[\]]/g, "").split(" ").map(Number);
  check("... its numbers stay within the range of the keyframes", gk >= 0.25 && gk <= 0.75 && glk >= 100 && glk <= 10000 && gm >= 250 && gm <= 500, nums);
  check("... a whole number stays whole", Number.isInteger(gm), nums);
  check("... what remains stays", (await cljs(page, `(str/starts-with? ${text(lk)} "knob 20 20000 ")`)) === "true", await cljs(page, text(lk)));
  const first = await cljs(page, texts(ids));
  await cljs(page, "(rewind)");
  await cljs(page, '(generate 7 ["p35-a" "p35-b"])');
  check("the same seed makes the same preset", (await cljs(page, texts(ids))) === first, (await cljs(page, texts(ids))) + " vs " + first);
  check("generating needs two keyframes", (await cljs(page, '(generate 1 ["p35-a"])')).startsWith("ERR That needs 2 keyframes"));

  // the presets box: a number recalls, a position on the right morphs, its outlet says what it set
  const pb = (await cljs(page, '(box "presets p35-a p35-b" 2400 220)')).trim();
  const gt = (await cljs(page, `(box "get % ${k}" 2400 280)`)).trim();
  const nb = (await cljs(page, '(box "number" 2400 330)')).trim();
  await cljs(page, `(connect ${pb} 0 ${gt} 0) (connect ${gt} 0 ${nb} 0)`);
  before = Number(await cljs(page, events));
  await cljs(page, `(send! ${pb} 2)`);
  check("a number into the presets box recalls its keyframe", (await until(page, texts(ids), B)) === B, await cljs(page, texts(ids)));
  check("... as one gesture", Number(await cljs(page, events)) === before + 1, await cljs(page, events));
  check("... and its outlet sends the values of the controls", (await until(page, `(get-in @eng/rt [:states (fid ${nb})])`, "0.75")) === "0.75");
  await cljs(page, `(send! ${pb} :p35-a)`);
  check("a label recalls too", (await until(page, texts(ids), A)) === A, await cljs(page, texts(ids)));
  await cljs(page, `(send! ${pb} 1 1.5)`);
  check("a position on the right morphs between its keyframes",
    (await until(page, `(get-in @eng/rt [:states (fid ${k})])`, "0.5")) === "0.5", await cljs(page, `(get-in @eng/rt [:states (fid ${k})])`));
  check("... and the outlet says so", (await until(page, `(get-in @eng/rt [:states (fid ${nb})])`, "0.5")) === "0.5");
  before = Number(await cljs(page, events));
  await cljs(page, `(send! ${pb} :keep)`);
  check("keep writes the morph", (await until(page, text(k), '"knob 0 1 0.5"')) === '"knob 0 1 0.5"', await cljs(page, text(k)));
  await cljs(page, `(send! ${pb} :bang)`);
  check("a bang generates a preset as one gesture", (await until(page, events, String(before + 2))) === String(before + 2), await cljs(page, events));

  // in Perform, a recall goes to the take, not to the history
  await cljs(page, "(perform)");
  await cljs(page, '(recall "p35-b")');
  check("in Perform a recall changes the take", (await cljs(page, texts(ids))) === B, await cljs(page, texts(ids)));
  check("... not the history", (await cljs(page, `(:text (get-in (patch-at (:pos @world)) [:boxes ${k}]))`)) !== '"knob 0 1 0.75"');
  await cljs(page, "(compose :discard)");

  await cljs(page, `(delete ${k} ${lk} ${m} ${sp} ${pb} ${gt} ${nb})`);
}
