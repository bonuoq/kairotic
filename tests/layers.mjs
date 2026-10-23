// SPDX-License-Identifier: MPL-2.0
// Layers (Study 26): marks anchored to boxes or to the paper, which follow the boxes, stay on the paper when
// their box is deleted, travel in the code of the patch and in links; layers over or under, shown in the patch
// view or the presentation; projections of a box's view. In the app loaded by tests/browser.mjs with a local
// work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

export async function layers(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the layer tests", false); return; }
  const a = (await cljs(page, '(box "print" 6000 100)')).trim();
  const b = (await cljs(page, '(box "print" 6300 160)')).trim();
  const m = (await cljs(page, `(mark :notes {:kind :arrow :pts [[${a} 60 10] [${b} -6 8]]})`)).trim();
  check("(mark …) adds a mark, and the layer it names", (await cljs(page, `(get-in (current) [:marks ${m} :layer])`)) === ":notes"
        && (await cljs(page, "(contains? (:layers (current)) :notes)")) === "true", m);
  const pts = (await cljs(page, `(mark-points (current) (get-in (current) [:marks ${m}]))`));
  check("its points are where their boxes are", pts === "[[6060 110] [6294 168]]", pts);
  await cljs(page, `(move ${b} 6400 200)`);
  const moved = await cljs(page, `(mark-points (current) (get-in (current) [:marks ${m}]))`);
  check("... and follow a box that moves", moved === "[[6060 110] [6394 208]]", moved);
  const code = await cljs(page, "(patch->code (current))");
  check("the code of the patch writes it", code.includes(`(mark :notes ${m} {:kind :arrow`), code.slice(-400));
  const link = await cljs(page, `(links/read-code "(mark :notes :a9 {:kind :text :at [:patch 10 20] :txt \\"hi\\"})")`);
  check("... and a link may carry it", link.includes("(mark :notes :a9"), link);
  // a mark anchored to a box that is deleted stays where it was, on the paper
  await cljs(page, `(delete ${b})`);
  const left = await cljs(page, `(get-in (current) [:marks ${m} :pts])`);
  check("a box deleted leaves its marks on the paper, where they were", left === `[[${a} 60 10] [:patch 6394 208]]`, left);
  const t = (await cljs(page, `(mark :notes {:kind :text :at [${a} 0 -10] :txt "breathe"})`)).trim();
  check("a text mark", (await cljs(page, `(get-in (current) [:marks ${t} :txt])`)) === '"breathe"');
  await cljs(page, `(unmark ${t})`);
  check("(unmark …) erases it", (await cljs(page, `(get-in (current) [:marks ${t}])`)) === "nil");
  // layers: over or under, in the patch view and/or the presentation
  await cljs(page, "(layer :viz {:z :under :show #{:present}})");
  check("a layer only for the presentation is not shown in the patch view", (await cljs(page, "(layer-shown? (current) :viz)")) === "false");
  check("... and one for both is", (await cljs(page, "(layer-shown? (current) :notes)")) === "true");
  // a projection: the view of a box drawn again, at another size
  const d = (await cljs(page, '(box "draw 120 80" 6000 300)')).trim();
  await cljs(page, `(send! ${d} [:circle 60 40 20 :accent])`);
  await cljs(page, `(project ${d} :viz [6000 500 480 320])`);
  check("(project …) keeps where it goes", (await cljs(page, `(get-in (current) [:projections ${d} :rect])`)) === "[6000 500 480 320]");
  const svg = await cljs(page, `(projection-svg (current) ${d} (get-in (current) [:projections ${d}]))`);
  check("... and draws the view again at that size", svg.includes("proj") && svg.includes("<circle"), svg.slice(0, 300));
  const noView = await cljs(page, `(project ${a} :viz [0 0 100 100])`);
  check("a box without a view of its own cannot be projected", noView.startsWith("ERR"), noView);
  await cljs(page, `(delete ${d})`);
  check("a box deleted takes its projection", (await cljs(page, `(get-in (current) [:projections ${d}])`)) === "nil");
  // what is drawn on the paper
  await cljs(page, "(render-scene (current))");
  const drawn = await page.evaluate(() => document.querySelectorAll("#layers-over .amark").length);
  check("the marks are drawn over the boxes", drawn >= 1, String(drawn));
  // the Annotate bar
  await cljs(page, "(annotate :arrow)");
  const bar = await page.evaluate(() => ({ shown: !document.getElementById("annot-bar").hidden,
                                           tool: document.querySelector('#annot-bar [data-atool="arrow"]').getAttribute("aria-pressed") }));
  check("(annotate :arrow) opens the Annotate bar with that tool", bar.shown && bar.tool === "true", JSON.stringify(bar));
  check("... where a point is anchored to the box nearest it", (await cljs(page, `(first (anchor-of [6070 120]))`)) === a);
  await cljs(page, "(annotate false)");
  // leave the work as it was
  await cljs(page, `(layer :notes nil) (layer :viz nil) (delete ${a})`);
  check("(layer … nil) removes a layer with its marks", (await cljs(page, "(:marks (current))")) === "nil", await cljs(page, "(:marks (current))"));
}
