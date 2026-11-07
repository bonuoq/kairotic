// SPDX-License-Identifier: MPL-2.0
// Talking in a room, in the app (discussion #135, app/page/20-talk.cljs): two people (two browser contexts)
// open the same shared room through a real relay, their pages meet on its /signal and connect directly;
// a message with anchors, keeping your own and someone else's (asked, allowed, declined) as annotations,
// push-to-talk with voice flowing, a voice note kept as a sample box (and its sound in both browsers), a
// camera frame kept as an image annotation. Chromium's fake microphone and camera.
//   node relay/server.js --osc & npx http-server _site -p 8000 &
//   node tests/talk.mjs http://localhost:8000/ ws://localhost:8765/gun
import { chromium } from "playwright";

const base = (process.argv[2] || "http://localhost:8000/").replace(/\/?$/, "/");
const relay = process.argv[3] || "ws://localhost:8765/gun";
let total = 0; const failed = [];
const check = (label, ok, detail) => { total++; if (!ok) failed.push(label + (detail ? " — " + String(detail).slice(0, 400) : "")); console.log(`${ok ? "✓" : "✗"} ${label}`); };
const cljs = (page, src) => page.evaluate((s) => {
  try { return String(scittle.core.eval_string("(in-ns 'user) (pr-str (do " + s + "))")); } catch (e) { return "ERR " + (e.message || e); }
}, src);
// a promise the ClojureScript returns, awaited in the page
const awaitCljs = (page, src) => page.evaluate(async (s) => {
  try { const v = await scittle.core.eval_string("(in-ns 'user) " + s); return JSON.stringify(v); } catch (e) { return "ERR " + (e.message || e); }
}, src);
const until = async (page, src, ok, ms = 15000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(150); }
  return got;
};

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
  "--autoplay-policy=no-user-gesture-required", "--disable-features=WebRtcHideLocalIpsWithMdns"] });
const errors = [];
const open = async (who) => {
  const ctx = await browser.newContext({ permissions: ["microphone", "camera"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(who + ": " + e.message));
  await page.goto(base + "?peer=" + encodeURIComponent(relay));
  await page.waitForFunction(() => {
    try { return /local|room|solo|work|Error/i.test(document.getElementById("status").textContent) &&
                 scittle.core.eval_string("(in-ns 'user) (fn? talk-sync!)") === true; } catch (_) { return false; }
  }, null, { timeout: 90000 });
  await cljs(page, `(set! (.-value ($ "talk-name")) "${who}")`);
  return page;
};

try {
  const A = await open("Ana"), B = await open("Bo");
  check("the app loads with the Room tab", (await cljs(A, '(boolean ($ "tab-talk"))')) === "true");
  check("the rooms are on the relay's /signal", (await cljs(A, "(talk-signal-url)")) === JSON.stringify(relay.replace(/\/gun$/, "/signal")),
        await cljs(A, "(talk-signal-url)"));

  // Ana creates a shared room, Bo opens it
  await cljs(A, '(create-work! :room "talk test" false)');
  const rid = (await until(A, "(when (= :room (:kind @work)) (:id @work))", (x) => x !== "nil")).replace(/"/g, "");
  check("Ana makes a shared room", rid !== "nil", rid);
  await cljs(B, `(open-work! :room "${rid}" "talk test")`);
  await until(B, "(:id @work)", (x) => x.includes(rid));
  const p2p = (page) => until(page, '(count (filter (fn [[_ p]] (= "p2p" (:state p))) (:peers @talk-room)))', (x) => x === "1", 20000);
  const [pa, pb] = await Promise.all([p2p(A), p2p(B)]);
  check("in the same room, their pages meet and connect directly (WebRTC)", pa === "1" && pb === "1", pa + " / " + pb);
  check("... and agree on a clock (the relay's time)", (await cljs(A, "(some? (tk/clock-offset (:clock @talk-room)))")) === "true");

  // a message with anchors
  const box = (await cljs(A, '(box "msg hello" 200 160)')).trim();
  const said = (await cljs(A, `(talk-say! "from #12, @${box.slice(1)} enters")`)).replace(/"/g, "");
  const got = await until(B, "(count (:order @talk-state))", (x) => x === "1");
  check("a message reaches the other", got === "1");
  check("... with who said it and its anchors",
        (await cljs(B, `(let [it (get-in @talk-state [:items "${said}"])] [(:name it) (:anchors it)])`)) === `["Ana" [{:point 12} {:box "${box.slice(1)}"}]]`,
        await cljs(B, `(get-in @talk-state [:items "${said}"])`));
  // keeping your own: at once, an annotation on the box it names, in both pages (the history)
  await cljs(A, `(talk-keep! "${said}")`);
  const markOf = (txt) => `(some (fn [[_ m]] (when (and (= :talk (:layer m)) (re-find #"${txt}" (str (:txt m)))) m)) (:marks (current)))`;
  const own = await until(B, markOf("Ana: from #12"), (x) => x !== "nil", 20000);
  check("keeping your own message: an annotation on the box it names, for everyone in the room",
        own.includes(`:at [${box} 0 -12]`), own);
  check("... and the other page hears it was kept", (await until(B, `(:kept (get-in @talk-state [:items "${said}"]))`, (x) => x === "true")) === "true");

  // Bo keeps Ana's: she is asked, and allows
  const second = (await cljs(A, '(talk-say! "second idea")')).replace(/"/g, "");
  await until(B, "(count (:order @talk-state))", (x) => x === "2");
  // a gesture made less than the room's simultaneity interval (1.5 s) after moving over someone else's is
  // parallel to it (a branch): people take longer than that; the test waits as long
  const settle = (page) => page.waitForTimeout(1700);
  await settle(B);
  await cljs(B, `(talk-keep! "${second}")`);
  const asked = await until(A, "(count (:asks @talk-state))", (x) => x === "1");
  check("keeping someone else's asks them", asked === "1");
  check("... and the Room tab shows it", (await cljs(A, '(.contains (.-classList ($ "tab-talk")) "attn")')) === "true");
  await cljs(A, `(talk-answer! "${second}" true)`);
  const allowed = await until(A, markOf("Ana: second idea"), (x) => x !== "nil", 20000);
  check("allowed: Bo's keeping reaches the work", allowed !== "nil", allowed);
  // ... and declines another
  const third = (await cljs(A, '(talk-say! "not this one")')).replace(/"/g, "");
  await until(B, "(count (:order @talk-state))", (x) => x === "3");
  await settle(B);
  await cljs(B, `(talk-keep! "${third}")`);
  await until(A, "(count (:asks @talk-state))", (x) => x === "1");
  await cljs(A, `(talk-answer! "${third}" false)`);
  const declined = await until(B, `(get-in @talk-state [:mine-asks "${third}"])`, (x) => x === ":declined");
  check("declined: not kept, and Bo sees why", declined === ":declined" && (await cljs(A, markOf("not this one"))) === "nil");

  // push to talk
  await cljs(A, "(talk-mic!)");
  await until(A, '(.-disabled ($ "talk-ptt"))', (x) => x === "false");
  await cljs(A, "(talk-push! true)");
  const talking = await until(B, '(some (fn [[_ p]] (:talk p)) (:peers @talk-room))', (x) => x === "true");
  check("holding to talk: Bo sees Ana talking", talking === "true");
  await A.waitForTimeout(1200);
  const bytes = await awaitCljs(B, "(talk-audio-in)");
  check("... and her voice reaches him", JSON.parse(bytes).reduce((a, b) => a + b, 0) > 1000, bytes);
  await cljs(A, "(talk-push! false)");
  check("letting go: no longer talking", (await until(B, '(boolean (some (fn [[_ p]] (:talk p)) (:peers @talk-room)))', (x) => x === "false")) === "false");

  // a voice note, kept by Bo as a sample box: Ana allows; both browsers have its sound
  await cljs(A, "(talk-note-start!)");
  await A.waitForTimeout(1300);
  await cljs(A, "(talk-note-stop!)");
  const note = (await until(B, '(some (fn [[id it]] (when (and (= :note (:kind it)) (:b64 it)) id)) (:items @talk-state))', (x) => x !== "nil", 15000)).replace(/"/g, "");
  check("a voice note arrives whole", note !== "nil");
  await settle(B);
  await cljs(B, `(talk-keep! "${note}")`);
  await until(A, "(count (:asks @talk-state))", (x) => x === "1");
  await cljs(A, `(talk-answer! "${note}" true)`);
  const sample = await until(B, '(some (fn [[id b]] (when (= "sample" (:text b)) (get-in b [:data :audio]))) (:boxes (current)))', (x) => /"[0-9a-f]{32}"/.test(x), 20000);
  check("kept as a sample box, its sound by hash", /"[0-9a-f]{32}"/.test(sample), sample);
  const h = sample.replace(/"/g, "");
  const inA = await (async () => { const t0 = Date.now(); let v; while (Date.now() - t0 < 15000) { v = await awaitCljs(A, `(.then (snd/sound "${h}") boolean)`); if (v === "true") break; await A.waitForTimeout(300); } return v; })();
  check("... and the sound is in Ana's browser too, under the same hash", inA === "true", inA);
  check("... with a caption on it", (await until(A, markOf("voice note · Ana"), (x) => x !== "nil", 20000)) !== "nil");

  // a camera frame: Bo's camera, a frame kept by Ana, asked to Bo
  await cljs(B, "(talk-cam!)");
  const seen = await until(A, '(let [v (.querySelector js/document ".ttile:not([hidden]) video")] (and v (pos? (.-videoWidth v))))', (x) => x === "true", 15000);
  check("Bo's camera: Ana sees him", seen === "true");
  const bo = (await cljs(A, '(some (fn [[id p]] (when (:camera p) id)) (:peers @talk-room))')).replace(/"/g, "");
  const frame = (await cljs(A, `(talk-frame! "${bo}")`)).replace(/"/g, "");
  await until(A, "(count (:order @talk-state))", (x) => Number(x) >= 5);
  await settle(A);
  await cljs(A, `(talk-keep! "${frame}")`);
  await until(B, "(count (:asks @talk-state))", (x) => x === "1");
  await cljs(B, `(talk-answer! "${frame}" true)`);
  const img = await until(B, '(some (fn [[_ m]] (when (= :image (:kind m)) (subs (:src m) 0 23))) (:marks (current)))', (x) => x !== "nil", 20000);
  check("a frame of Bo, kept by Ana with his consent: an image annotation in the work", img === '"data:image/jpeg;base64,"', img);

  // @kairotic/net between the two: a value shared by Ana reaches Bo's shared box; one tempo for both
  await cljs(B, `(comp/define! "netsink" {:io [2 0] :receive (fn [{:keys [inlet value state]}] {:state (conj (or state []) [inlet value])})})`);
  const share = (await cljs(A, '(box "share notes" 400 300)')).trim();
  const shared = (await cljs(B, '(box "shared notes" 400 360)')).trim();
  const sink = (await cljs(B, '(box "netsink" 400 420)')).trim();
  await until(B, '(boolean (comp/lookup "shared"))', (x) => x === "true", 20000);
  await cljs(B, `(connect ${shared} 0 ${sink} 0) (connect ${shared} 1 ${sink} 1) (play)`);
  await B.waitForTimeout(800);
  await until(A, '(boolean (comp/lookup "share"))', (x) => x === "true", 20000);
  await cljs(A, `(send! ${share} [60 64 67])`);
  const arrived = await until(B, `(get-in @eng/rt [:states ${sink}])`, (x) => x.includes("[60 64 67]"), 10000);
  check("@kairotic/net: what Ana shares reaches Bo's shared box, with her name", arrived.includes("[0 [60 64 67]]") && arrived.includes('[1 "Ana"]'), arrived);
  await cljs(A, "(net-start! 120)");
  const tempo = await until(B, "(:bpm @net-tempo)", (x) => x === "120", 10000);
  await B.waitForTimeout(1500);
  const [ba, bb] = [Number(await cljs(A, "(net-beat)")), Number(await cljs(B, "(net-beat)"))];
  check("... one tempo for the room: started by Ana, the same beat for Bo", tempo === "120" && Math.abs(ba - bb) < 0.1, ba + " / " + bb);
  await cljs(B, "(stop)");
} catch (e) {
  check("no error", false, e && e.stack || e);
}
check("no page errors", errors.length === 0, errors.join("; "));
await browser.close();
console.log(`\n${total - failed.length} / ${total} pass`);
for (const f of failed) console.log("✗ " + f);
process.exit(failed.length ? 1 : 0);
