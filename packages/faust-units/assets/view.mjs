// SPDX-License-Identifier: MPL-2.0
// @kairotic/faust-units · the patch view of a faust~ box (discussion #115, Study 31).
//
// A pane that shows Faust code as a patch of unit boxes and edits it: moving a box, wiring an outlet to
// an inlet, writing a box (a name, a number or any Faust expression), Delete. Every edit of the patch
// gives new code (onCode); new code given to it (setCode) redraws the patch. The code is what the box
// keeps; this is a view of it, so the page decides when code is applied.
//
//   const v = mount(host, { code, onCode: (code) => …, loadFaust: () => Promise<{F, compiler}> });
//   v.setCode(code)   // the code was written elsewhere (the editor beside it)
//   v.destroy()

import { UNITS, readBox, boxText, unitOf } from "./units.mjs";
import { toFaust, inlets, outlets, newBox, name } from "./graph.mjs";
import { toGraphAsync } from "./parse.mjs";

const CSS = `
.fu { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--sheet); }
.fu-canvas { position: relative; flex: 1; min-height: 0; overflow: auto; touch-action: none; outline: none; }
.fu-canvas:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); }
.fu-canvas.stale svg { opacity: 0.35; }
.fu-canvas svg { display: block; }
.fu .b rect { fill: var(--box); stroke: var(--rule); stroke-width: 1; }
.fu .b.io rect { stroke: var(--accent); stroke-width: 1.5; }
.fu .b.ui rect { fill: color-mix(in srgb, var(--kairos) 10%, var(--box)); stroke: var(--kairos); }
.fu .b.mem rect { fill: var(--accent-soft); stroke: var(--accent); }
.fu .b.code rect { stroke-dasharray: 4 3; stroke: var(--ink-soft); }
.fu .b.sel rect { stroke: var(--accent); stroke-width: 2; }
.fu .b text { font: 12px var(--f-code); fill: var(--ink); pointer-events: none; dominant-baseline: central; }
.fu .b .port { fill: var(--ink-soft); stroke: none; }
.fu .b .port.out { fill: var(--ink); }
.fu .b { cursor: grab; }
.fu .wire { fill: none; stroke: var(--ink-soft); stroke-width: 1.4; }
.fu .wire.loop { stroke: var(--accent); stroke-dasharray: 5 3; }
.fu .wire.sel { stroke: var(--accent); stroke-width: 2.4; }
.fu .wire-hit { fill: none; stroke: transparent; stroke-width: 10; cursor: pointer; }
.fu .temp { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 3 3; }
.fu-editor { position: absolute; font: 12px var(--f-code); padding: 3px 5px; border: 1.5px solid var(--accent); border-radius: 3px;
  background: var(--box); color: var(--ink); min-width: 160px; z-index: 2; }
.fu-foot { padding: 4px 10px; border-top: 1px solid var(--rule); font: 11.5px/1.45 var(--f-code); color: var(--ink-soft); overflow-wrap: anywhere; }
.fu-foot b { color: var(--ink); font-weight: 500; }
.fu-foot .ok { color: var(--ok); } .fu-foot .bad { color: var(--error); } .fu-foot .warn { color: var(--kairos); }
`;

function style() {
  if (document.getElementById("faust-units-css")) return;
  const s = document.createElement("style");
  s.id = "faust-units-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}
function names() {
  if (document.getElementById("faust-units-names")) return;
  const d = document.createElement("datalist");
  d.id = "faust-units-names";
  d.innerHTML = Object.keys(UNITS).filter((n) => n !== "num").map((n) => `<option value="${esc(n)}">${esc(UNITS[n].doc)}</option>`).join("");
  document.body.appendChild(d);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

export function mount(host, { code = "", onCode = () => {}, loadFaust } = {}) {
  style(); names();
  host.innerHTML = `<div class="fu"><div class="fu-canvas" tabindex="0" aria-label="The patch of this faust~ box: boxes and wires. Double-click to add a box."><svg xmlns="${NS}"></svg></div>
    <div class="fu-foot"><div class="fu-sync"></div><div class="fu-info"></div></div></div>`;
  const canvas = host.querySelector(".fu-canvas"), svg = host.querySelector("svg");
  const syncEl = host.querySelector(".fu-sync"), infoEl = host.querySelector(".fu-info");
  let graph = { boxes: [], wires: [] }, sel = null, emitted = null, current = code, alive = true;

  // how many inputs and outputs a piece of Faust code has, asked of the compiler
  const arity = new Map();
  async function arityOf(text) {
    if (arity.has(text)) return arity.get(text);
    let a = null;
    try {
      const fx = await loadFaust();
      const gen = new fx.F.FaustMonoDspGenerator();
      const g = await gen.compile(fx.compiler, "fu" + (arity.size + 1), 'import("stdfaust.lib");\nprocess = ' + text + ";\n", "-ftz 2");
      if (g) { const j = JSON.parse(gen.factory.json); a = { ins: j.inputs, outs: j.outputs }; }
    } catch (_) { a = null; }
    arity.set(text, a);
    return a;
  }

  const sync = (kind, text) => { syncEl.innerHTML = `<span class="${kind}">${kind === "ok" ? "✓" : kind === "bad" ? "✗" : "⚠"}</span> ${esc(text)}`; };

  // ── patch → code ──
  function changed() {
    try {
      const c = toFaust(graph);
      emitted = c; current = c;
      canvas.classList.remove("stale");
      sync("ok", "the patch wrote the code: apply it to hear it");
      onCode(c);
    } catch (e) { sync("bad", e.message); }
    render(); info();
  }
  // ── code → patch ──
  let timer = 0, seq = 0;
  async function read(c) {
    const my = ++seq;
    // code the boxes do not know is asked of the compiler, which can take a moment the first time
    const slow = setTimeout(() => { if (my === seq) sync("ok", "reading the code…"); }, 300);
    try {
      const g = await toGraphAsync(c, arityOf, arity);
      if (!alive || my !== seq) return;
      graph = g; sel = null;
      canvas.classList.remove("stale");
      sync("ok", "the patch is the code");
    } catch (e) {
      if (!alive || my !== seq) return;
      canvas.classList.add("stale");
      sync("warn", "outside what the boxes can show: " + e.message + " — the code still compiles and plays");
    }
    clearTimeout(slow);
    render(); info();
  }
  function setCode(c) {
    c = String(c || "");
    if (c === emitted || c === current) return;
    current = c;
    clearTimeout(timer);
    timer = setTimeout(() => read(c), 400);
  }

  // ── drawing ──
  const H = 22, PORT = 8;
  const width = (b) => Math.max(44, boxText(b).length * 7.3 + 16, Math.max(inlets(b), outlets(b)) * 16);
  const portX = (b, i, n) => (n <= 1 ? b.x : b.x + (width(b) - PORT) * (i / (n - 1)));
  const kindOf = (b) => { const u = unitOf(b); return b.type === "'" ? "mem" : u.kind === "io" ? "io" : u.kind === "ui" ? "ui" : u.kind === "code" ? "code" : ""; };
  function render() {
    const W = Math.max(canvas.clientWidth - 2, ...graph.boxes.map((b) => b.x + width(b) + 40));
    const Hh = Math.max(canvas.clientHeight - 2, ...graph.boxes.map((b) => b.y + H + 60));
    svg.setAttribute("width", W); svg.setAttribute("height", Hh);
    svg.innerHTML = "";
    const byId = new Map(graph.boxes.map((b) => [b.id, b]));
    const wiresG = el("g", {}, svg);
    graph.wires.forEach((w, wi) => {
      const a = byId.get(w.from[0]), b = byId.get(w.to[0]);
      if (!a || !b) return;
      const x1 = portX(a, w.from[1], outlets(a)) + PORT / 2, y1 = a.y + H, x2 = portX(b, w.to[1], inlets(b)) + PORT / 2, y2 = b.y;
      const back = y2 < y1 + 10;
      const d = back ? `M${x1},${y1} C${x1},${y1 + 50} ${x2},${y2 - 50} ${x2},${y2}` : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
      el("path", { d, class: "wire" + (back ? " loop" : "") + (sel && sel.wire === wi ? " sel" : "") }, wiresG);
      el("path", { d, class: "wire-hit", "data-wire": wi }, wiresG);
    });
    for (const b of graph.boxes) {
      const g = el("g", { class: "b " + kindOf(b) + (sel && sel.box === b.id ? " sel" : ""), "data-id": b.id }, svg);
      el("rect", { x: b.x, y: b.y, width: width(b), height: H, rx: 3 }, g);
      el("text", { x: b.x + 8, y: b.y + H / 2 + 1 }, g).textContent = boxText(b);
      const ni = inlets(b), no = outlets(b);
      for (let i = 0; i < ni; i++) el("rect", { class: "port in", x: portX(b, i, ni), y: b.y, width: PORT, height: 3 }, g);
      for (let i = 0; i < no; i++) el("rect", { class: "port out", x: portX(b, i, no), y: b.y + H - 3, width: PORT, height: 3 }, g);
    }
  }
  function info() {
    const b = sel && sel.box !== undefined && graph.boxes.find((x) => x.id === sel.box);
    if (!b) {
      infoEl.innerHTML = sel && sel.wire !== undefined ? "a wire · <b>Delete</b> removes it"
        : `${graph.boxes.length} boxes · ${graph.wires.length} wires · <b>double-click</b>: a box · drag outlet → inlet · <b>Delete</b>`;
      return;
    }
    const line = current.split("\n").find((l) => new RegExp("^\\s*" + b.name + "(\\(|\\s*=)").test(l));
    infoEl.innerHTML = `<b>${esc(boxText(b))}</b> — ${esc(unitOf(b).doc || "")}${line ? " · " + esc(line.trim()) : ""}`;
  }

  // ── gestures ──
  let drag = null, lastDown = { t: 0, x: 0, y: 0 }, editing = null;
  const pt = (e) => { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const boxAt = (p) => [...graph.boxes].reverse().find((b) => p.x >= b.x - 2 && p.x <= b.x + width(b) + 2 && p.y >= b.y - 4 && p.y <= b.y + H + 4);
  const nearest = (b, n, x) => { let k = 0, best = 1e9; for (let i = 0; i < n; i++) { const d = Math.abs(portX(b, i, n) + PORT / 2 - x); if (d < best) { best = d; k = i; } } return k; };
  svg.addEventListener("pointerdown", (e) => {
    if (editing) return;
    const p = pt(e);
    const hit = e.target.closest && e.target.closest(".wire-hit");
    if (hit) { sel = { wire: +hit.getAttribute("data-wire") }; canvas.focus({ preventScroll: true }); render(); info(); return; }
    const b = boxAt(p);
    // a double-click, told by hand: the view is redrawn on every press, so the browser never sees two clicks on one element
    const now = performance.now(), dbl = now - lastDown.t < 400 && Math.abs(p.x - lastDown.x) < 6 && Math.abs(p.y - lastDown.y) < 6;
    lastDown = dbl ? { t: 0, x: 0, y: 0 } : { t: now, x: p.x, y: p.y };
    if (dbl) { e.preventDefault(); edit(b, b ? b.x : p.x, b ? b.y : p.y); return; }
    canvas.focus({ preventScroll: true });
    if (!b) { sel = null; render(); info(); return; }
    const no = outlets(b);
    if (no && p.y >= b.y + H - 7) { const k = nearest(b, no, p.x); drag = { wire: [b.id, k], x0: portX(b, k, no) + PORT / 2, y0: b.y + H }; }
    else drag = { box: b, dx: p.x - b.x, dy: p.y - b.y, moved: false };
    sel = { box: b.id };
    svg.setPointerCapture(e.pointerId);
    render(); info();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = pt(e);
    if (drag.box) { drag.box.x = Math.max(0, Math.round(p.x - drag.dx)); drag.box.y = Math.max(0, Math.round(p.y - drag.dy)); drag.moved = true; render(); }
    else { render(); el("path", { class: "temp", d: `M${drag.x0},${drag.y0} L${p.x},${p.y}` }, svg); }
  });
  svg.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const p = pt(e), d = drag;
    drag = null;
    if (d.box) { if (d.moved) changed(); return; }
    const b = boxAt(p);
    if (b && b.id !== d.wire[0] && inlets(b)) {
      const k = nearest(b, inlets(b), p.x);
      if (!graph.wires.some((w) => w.from[0] === d.wire[0] && w.from[1] === d.wire[1] && w.to[0] === b.id && w.to[1] === k)) {
        graph.wires.push({ from: d.wire, to: [b.id, k] });
        sel = { box: b.id };
        changed();
        return;
      }
    }
    render();
  });
  canvas.addEventListener("keydown", (e) => {
    if (editing || !sel || !(e.key === "Delete" || e.key === "Backspace")) return;
    e.preventDefault();
    if (sel.wire !== undefined) graph.wires.splice(sel.wire, 1);
    else if (sel.box !== undefined) {
      graph.boxes = graph.boxes.filter((b) => b.id !== sel.box);
      graph.wires = graph.wires.filter((w) => w.from[0] !== sel.box && w.to[0] !== sel.box);
    }
    sel = null;
    changed();
  });
  function edit(b, x, y) {
    if (editing) editing.remove();
    const inp = document.createElement("input");
    inp.className = "fu-editor";
    inp.setAttribute("list", "faust-units-names");
    inp.setAttribute("aria-label", b ? "Change the box" : "A new box");
    inp.value = b ? boxText(b) : "";
    inp.placeholder = "os.osc 440 · + 0.5 · hslider freq 440 20 2000 1 · '";
    inp.style.left = x + "px"; inp.style.top = (y - 2) + "px";
    canvas.appendChild(inp);
    editing = inp;
    inp.focus(); inp.select();
    let done = false;
    const finish = async (ok) => {
      if (done) return; done = true;
      const text = inp.value.trim();
      inp.remove(); editing = null;
      canvas.focus({ preventScroll: true });
      if (!ok || !text) return;
      const r = readBox(text);
      let io;
      if (r.type === "faust") {
        io = await arityOf(r.args[0]);
        if (!io) { sync("bad", "the compiler does not understand: " + r.args[0]); return; }
      }
      if (b) {
        b.type = r.type; b.args = r.args;
        if (io) b.io = io; else delete b.io;
        delete b.name; name(graph, b);
        graph.wires = graph.wires.filter((w) => !(w.to[0] === b.id && w.to[1] >= inlets(b)) && !(w.from[0] === b.id && w.from[1] >= outlets(b)));
      } else {
        if ((r.type === "in" || r.type === "out") && !r.args.length) r.args = [graph.boxes.filter((q) => q.type === r.type).length + 1];
        if (UNITS[r.type] && UNITS[r.type].kind === "ui" && !r.args.length) r.args = UNITS[r.type].defs.slice();
        const nb = newBox(graph, r.type, r.args, Math.round(x), Math.round(y), io ? { io } : {});
        sel = { box: nb.id };
      }
      changed();
    };
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") finish(true); if (e.key === "Escape") finish(false); });
    inp.addEventListener("blur", () => finish(true));
  }

  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => render()) : null;
  if (ro) ro.observe(canvas);
  sync("ok", "reading the code…");
  read(code);
  return {
    setCode,
    graph: () => graph,
    focus: () => canvas.focus({ preventScroll: true }),
    destroy() { alive = false; clearTimeout(timer); if (ro) ro.disconnect(); host.innerHTML = ""; }
  };
}

// what api/import-module gives the page (it takes a module's default export)
export default { mount };
