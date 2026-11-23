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
  check("... the realizations counted exactly: 3,610, as Study 62 counts them", cnt === '"3610"', cnt);
  const figs = await cljs(page, `(vec (keep #(when (vector? %) (:fig (second %))) (last (tree-data ${out}))))`);
  check("... the bass written again with the chords made over it (the analysis layer)", figs === '["5/3" "6/4/3" "6/3" "6/5/3" "5/3" "6/3" "6/5/3" "5/3"]', figs);
  // the score: the voices in the tree's order, soprano, alto, tenor (treble clef an octave down), bass
  const defs = await cljs(page, `(vec (map (fn [x] [(second (re-find #"label=\\"([^\\"]*)\\"" x)) (str/includes? x "clef.dis")]) (re-seq #"<staffDef[^>]*>" (mei ${out}))))`);
  check("... written in open score, in order: soprano, alto, tenor (its treble clef an octave down), bass",
        defs === '[["soprano" false] ["alto" false] ["tenor" true] ["bass" false]]', defs);
  const fb = await cljs(page, `(let [m (mei ${out})] [(count (re-seq #"<fb>" m)) (boolean (re-find #"<f>6</f><f>4</f><f>3</f>" m))])`);
  check("... the figures under the bass in the score (figured bass, <harm><fb>): one a chord, the 6/4/3 on ②", fb === "[8 true]", fb);
  // the layers are each box's own (show-layers), in its score and its code window: hidden by default, shown by the
  // analysis chip of its header or (show-layers :bN :analysis); another tree box keeps its own
  const harms = `(some-> (get @score-cache ${out}) :node (.querySelectorAll "g.harm") .-length)`;
  const off = await until(page, harms, (x) => x === "0", 10000);
  const chip = await cljs(page, `(boolean (some (fn [[k]] (= k :analysis)) (header-chips ${out} (get-in (current) [:boxes ${out}]))))`);
  await cljs(page, `(show-layers ${out} :analysis)`);
  const on = await until(page, harms, (x) => x === "8", 10000);
  const other = await cljs(page, `(shown-layers (get-in (current) [:boxes ${tb}]))`);
  const kept = await cljs(page, `(str/includes? (patch->code (current)) "(show-layers ${out} :analysis)")`);
  await cljs(page, `(show-layers ${out})`);
  const off2 = await until(page, harms, (x) => x === "0", 10000);
  check("the layers are the box's: its score hides the figures by default, shows them with (show-layers … :analysis), hides them again",
        off === "0" && on === "8" && off2 === "0", `${off} ${on} ${off2}`);
  check("... the tree box with an analysis has an analysis chip in its header; another tree box keeps its own layers; the work's code keeps it",
        chip === "true" && other === "#{}" && kept === "true", `${chip} ${other} ${kept}`);
  // and back: a MEI's figured bass read into the tree's analysis layer (:fig) — by @startid (kairotic's) and by @tstamp
  // (the studies' exports, elsewhere's)
  const back = await cljs(page, `(vec (keep (fn [n] (when (and (vector? n) (= :note (first n))) (:fig (second n)))) (tree-seq vector? seq (mei/<-mei (str/replace (mei ${out}) #"<extMeta[\\s\\S]*?</extMeta>" "")))))`);
  check("a MEI imported: its figured bass back on its notes as :fig (by startid)", back === figs, back);
  const ts = await cljs(page, `(vec (keep (fn [n] (when (and (vector? n) (= :note (first n))) [(:pitch (second n)) (:fig (second n))])) (tree-seq vector? seq (mei/<-mei "<mei xmlns='http://www.music-encoding.org/ns/mei' meiversion='5.0'><music><body><mdiv><score><scoreDef meter.count='4' meter.unit='4'><staffGrp><staffDef n='1' lines='5' clef.shape='F' clef.line='4'/></staffGrp></scoreDef><section><measure n='1'><staff n='1'><layer n='1'><note xml:id='a' pname='c' oct='3' dur='2'/><note xml:id='b' pname='f' oct='3' dur='2'/></layer></staff><harm staff='1' tstamp='3'><fb><f>6</f><f>5</f></fb></harm></measure></section></score></mdiv></body></music></mei>"))))`);
  check("... and by tstamp: the 6/5 on the note at beat 3", ts === '[["c3" nil] ["f3" "6/5"]]', ts);
  await cljs(page, `(send! ${cb} [:staves 2])`);
  const two = await until(page, `(vec (map second (re-seq #"<staffDef[^>]*label=\\"([^\\"]*)\\"" (mei ${out}))))`, (x) => x === '["S A" "T B"]', 30000);
  check("[:staves 2]: short score, soprano and alto on one staff, tenor and bass on another", two === '["S A" "T B"]', two);
  await cljs(page, `(send! ${cb} [:staves 4])`);
  await until(page, `(count (re-seq #"<staffDef" (mei ${out})))`, (x) => x === "4", 30000);
  const hidden = await cljs(page, `(str/includes? (editor-source (get-in (current) [:boxes ${out}])) ":fig")`);
  check("... its code window hides the analysis (the box does not show it)", hidden === "false", hidden);
  await cljs(page, `(show-layers ${out} :analysis)`);
  const shown = await cljs(page, `(str/includes? (editor-source (get-in (current) [:boxes ${out}])) ":fig")`);
  await cljs(page, `(show-layers ${out})`);
  check("... and shows it when the box shows its analysis", shown === "true", shown);
  // the written tree edited: its analysis kept
  const before = await cljs(page, `(get-in (tree-data ${out}) [1])`);
  await cljs(page, `(code ${out} (editor-source (get-in (current) [:boxes ${out}])))`);
  check("the written tree applied again: the analysis kept on its notes", (await cljs(page, `(vec (keep #(when (vector? %) (:fig (second %))) (last (tree-data ${out}))))`)) === figs);
  // another realization, any valid one, three voices
  const first = await cljs(page, `(pr-str (nth (tree-data ${out}) 2))`);
  await cljs(page, `(send! ${cb} :any)`);
  const second = await until(page, `(pr-str (nth (tree-data ${out}) 2))`, (x) => x !== first, 10000);
  check(":any: another realization, any valid one", second !== first);
  await cljs(page, `(send! ${cb} [:voices 3])`);
  const n3 = await until(page, `(count (filter #(= :voice (first %)) (rest (tree-data ${out}))))`, (x) => x === "3");
  check("[:voices 3]: three parts", n3 === "3");
  // styles: by name (the parts it writes), and one in EDN that extends another
  await cljs(page, `(send! ${cb} [:voices nil])`);
  await cljs(page, `(send! ${cb} [:style :partimento-2])`);
  const s3 = await until(page, `[(count (filter #(= :voice (first %)) (rest (tree-data ${out})))) (:main (second (last-shown ${cb})))]`, (x) => /^\[3 /.test(x) && /partimento-2/.test(x));
  check("[:style :partimento-2]: its rules, and the three parts it writes", /^\[3 /.test(s3) && /partimento-2/.test(s3), s3);
  await cljs(page, `(send! ${cb} [:style {:style :free-sevenths :extends [:chorale-4 "1.0.0"] :between [[:seventh {:free true}]]}])`);
  const s4 = await until(page, `[(count (filter #(= :voice (first %)) (rest (tree-data ${out})))) (get-in @eng/rt [:states ${cb} :count]) (:main (second (last-shown ${cb})))]`, (x) => /^\[4 /.test(x) && /free-sevenths/.test(x));
  check("[:style {…}]: a style in EDN extending chorale-4, the dominant's 7th free — the RO up, 8,557 realizations", /^\[4 "8557"/.test(s4), s4);
  const badStyle = await (async () => { await cljs(page, `(send! ${cb} [:style {:extends :chorale-4 :between [[:sevenths]]}])`);
    return until(page, `(:sub (second (last-shown ${cb})))`, (x) => /no rule sevenths/.test(x), 10000); })();
  check("... a rule the catalogue does not have: the box says which", /no rule sevenths/.test(badStyle), badStyle);
  await cljs(page, `(send! ${cb} [:style nil])`);
  await cljs(page, `(send! ${cb} [:voices 3])`);
  // cac judge
  const jb = (await cljs(page, '(box "cac judge" 9600 300)')).trim();
  await cljs(page, `(send! ${jb} ${BOOK})`);
  const ok = await until(page, `(:sub (second (last-shown ${jb})))`, (x) => /✓|✗/.test(x));
  check("cac judge: the book's RO in four parts is by the rules", /✓/.test(ok), ok);
  await cljs(page, `(send! ${jb} ${WRONG})`);
  const bad = await until(page, `(:sub (second (last-shown ${jb})))`, (x) => /parallel/.test(x));
  check("... the book's wrong Galant cadence: its parallel 5ths between the alto and the tenor", /parallel 5ths between the alto and the tenor/.test(bad), bad);
  await cljs(page, `(delete ${tb}) (delete ${cb}) (delete ${out}) (delete ${jb})`);

  // cac imitation: a melody in, the comes found against it (canon.mjs, imitation-2): Frère Jacques, a canon at the
  // octave below two bars later — exactly one, the round itself; two units later, none
  const JQ = `[:voice {:key "C major"} ${"c4 d4 e4 c4 c4 d4 e4 c4 e4 f4 g4 g4 e4 f4 g4 g4".split(" ").map((p) => `[:note {:pitch "${p}" :dur 1}]`).join(" ")}]`;
  const it = (await cljs(page, '(box "tree" 9800 100)')).trim();
  await cljs(page, `(tree! ${it} ${JQ})`);
  const ib = (await cljs(page, '(box "cac imitation" 9800 300)')).trim();
  const io2 = (await cljs(page, '(box "tree" 9800 400)')).trim();
  await until(page, `(io (get-in (current) [:boxes ${ib}]))`, (x) => x === "[1 2]");
  await cljs(page, `(connect ${it} 0 ${ib} 0) (connect ${ib} 0 ${io2} 0) (send! ${it} :bang)`);
  const none = await until(page, `(:sub (second (last-shown ${ib})))`, (x) => /✗|comes/.test(x), 20000);
  check("cac imitation: Frère Jacques, a canon two units later — none (the box says so)", /✗ no comes/.test(none), none);
  await cljs(page, `(send! ${ib} [:d 8])`);
  const one = await until(page, `[(get-in @eng/rt [:states ${ib} :count]) (count (filter #(= :voice (first %)) (rest (tree-data ${io2}))))]`, (x) => x === '["1" 2]', 20000);
  const comes = await cljs(page, `(vec (map (fn [n] (if (= :rest (first n)) [:rest (:dur (second n))] (:pitch (second n)))) (drop 2 (nth (tree-data ${io2}) 3))))`);
  check("... two bars later, at the octave below: exactly one comes, the round itself, struck as the dux strikes it", one === '["1" 2]' && comes === '[[:rest 8] "c3" "d3" "e3" "c3" "c3" "d3" "e3" "c3"]', `${one} ${comes}`);
  await cljs(page, `(delete ${it}) (delete ${ib}) (delete ${io2})`);

  // a long bass (16 bars of half notes in A major): the box answers in a few seconds — counted within its limit, or,
  // too long to count, realized by search (tests/rules.mjs times both) — and the page goes on
  const LONG = `[:voice {:key "A major"} ${"a2 b2 c#3 d3 e3 f#3 g#3 a3 a3 e3 f#3 c#3 d3 a2 d3 e3 d3 c#3 b2 a2 f#3 d3 e3 e3 a2 d3 e3 e3 f#3 d3 e3 a2"
    .split(" ").map((p) => `[:note {:pitch "${p}" :dur 2}]`).join(" ")}]`;
  const lt = (await cljs(page, '(box "tree" 9400 600)')).trim();
  await cljs(page, `(tree! ${lt} ${LONG})`);
  const lc = (await cljs(page, '(box "cac partimento" 9400 700)')).trim();
  await until(page, `(io (get-in (current) [:boxes ${lc}]))`, (x) => x === "[1 2]");
  const t0 = Date.now();
  await cljs(page, `(connect ${lt} 0 ${lc} 0) (send! ${lt} :bang)`);
  const sub = await until(page, `(:sub (second (last-shown ${lc})))`, (x) => /realizations|too many|✗/.test(x), 20000);
  check("a long bass: the box answers in a few seconds, and the page with it", /realizations|too many|✗/.test(sub) && Date.now() - t0 < 15000, `${sub} · ${Date.now() - t0} ms`);
  await cljs(page, `(delete ${lt}) (delete ${lc})`);
}
