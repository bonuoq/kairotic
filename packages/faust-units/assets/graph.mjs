// SPDX-License-Identifier: MPL-2.0
// @kairotic/faust-units · a subpatch of unit boxes, and the Faust code it is.
//
// The graph: {boxes: [{id, type, args, name, x, y, io?}], wires: [{from: [id, outlet], to: [id, inlet]}]}
// (io = {ins, outs} for a box of Faust code, whose ports come from compiling it).
//
// patch → code: each box is one definition named after it, in a `with`, in the order signals flow;
// a loop goes through a one-sample delay box ('): the network becomes a function of the delays' outputs,
// fed back with ~ (which is the delay); a definition that depends on a delay's output takes it as a parameter. The layout of
// the boxes travels in a comment at the end, so the code alone is enough to rebuild the patch.

import { UNITS, unitOf, inletSlots, fmt, boxText } from "./units.mjs";

// names Faust or its libraries already use: a box is never named like this
const RESERVED = new Set(("process with letrec case seq par sum prod import component library environment declare " +
  "inputs outputs route waveform soundfile ffunction fconstant fvariable button checkbox hslider vslider nentry " +
  "hbargraph vbargraph hgroup vgroup tgroup attach enable control mem prefix int float rdtable rwtable select2 select3 " +
  "sin cos tan asin acos atan atan2 exp log log10 pow sqrt abs min max fmod remainder floor ceil rint round tanh " +
  "sinh cosh lowest highest ma ba os no fi en de si re ef co sp an aa ve pf ho dm sf ro mi ot ds wd vl fd").split(" "));

export function inlets(box) {
  const u = unitOf(box);
  return u.kind === "code" ? (box.io ? box.io.ins : 0) : inletSlots(u).length;
}
export function outlets(box) {
  const u = unitOf(box);
  return u.kind === "code" ? (box.io ? box.io.outs : 0) : u.outs;
}

// a valid, unused Faust name for a box
export function nameFor(base, taken) {
  let b = String(base).replace(/[^A-Za-z0-9_]/g, "_").replace(/^([^A-Za-z_])/, "_$1") || "b";
  if (!RESERVED.has(b) && !taken.has(b)) return b;
  for (let i = 1; ; i++) if (!taken.has(b + i) && !RESERVED.has(b + i)) return b + i;
}
export function name(graph, box) {
  if (box.name) return box.name;
  const u = unitOf(box), taken = new Set(graph.boxes.map((b) => b.name).filter(Boolean));
  if (box.type === "in") return (box.name = nameFor("x" + (box.args[0] || 1), taken));
  if (box.type === "out") return (box.name = nameFor("y" + (box.args[0] || 1), taken));
  if (u.kind === "ui") return (box.name = nameFor(box.args[0], taken));
  return (box.name = nameFor(u.base, taken));
}

// what each slot of a box gets from the numbers written after its name
export function slotArgs(box) {
  const u = unitOf(box), args = box.args || [], out = new Array(u.slots.length).fill(undefined);
  if (u.kind === "prim") {
    const n = u.slots.length, k = Math.min(args.length, n);
    for (let j = 0; j < k; j++) out[n - k + j] = args[j];
  } else if (u.kind === "lib") {
    let j = 0;
    u.slots.forEach((s, i) => { if (s.kind !== "in" && j < args.length) out[i] = args[j++]; });
  }
  return out;
}

export function toFaust(graph) {
  const byId = new Map(graph.boxes.map((b) => [b.id, b]));
  graph.boxes.forEach((b) => name(graph, b));
  const into = new Map(); // "id:inlet" → [ports]
  for (const w of graph.wires) {
    if (!byId.has(w.from[0]) || !byId.has(w.to[0])) continue;
    const k = w.to[0] + ":" + w.to[1];
    if (!into.has(k)) into.set(k, []);
    into.get(k).push(w.from);
  }
  const sources = (b) => {
    const out = [];
    for (let i = 0; i < inlets(b); i++) (into.get(b.id + ":" + i) || []).forEach((p) => out.push(p[0]));
    return out;
  };
  const isMem = (b) => b.type === "'";

  // which delay boxes close a loop: those whose input depends on themselves
  const rec = new Set();
  for (const m of graph.boxes.filter(isMem)) {
    const seen = new Set(), stack = sources(m);
    while (stack.length) {
      const id = stack.pop();
      if (id === m.id) { rec.add(m.id); break; }
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...sources(byId.get(id)));
    }
  }
  // the order of definitions follows the signal back from the outputs (so the same patch always gives the
  // same code), then from what feeds each loop; it also finds the loop variables each one depends on, and
  // loops with no delay in them
  const ins = graph.boxes.filter((b) => b.type === "in").sort((a, b) => (a.args[0] || 1) - (b.args[0] || 1));
  const outs = graph.boxes.filter((b) => b.type === "out").sort((a, b) => (a.args[0] || 1) - (b.args[0] || 1));
  const order = [], recOrder = [], deps = new Map(), state = new Map();
  const noteRec = (id) => { if (!recOrder.includes(id)) recOrder.push(id); };
  function visit(id) {
    if (rec.has(id)) { noteRec(id); return new Set(); }
    if (state.get(id) === 2) return deps.get(id);
    if (state.get(id) === 1) throw new Error("a loop without a one-sample delay: put a ' box in it");
    state.set(id, 1);
    const d = new Set();
    for (const s of sources(byId.get(id))) {
      if (rec.has(s)) { d.add(byId.get(s).name); noteRec(s); }
      else visit(s).forEach((x) => d.add(x));
    }
    state.set(id, 2);
    deps.set(id, d);
    order.push(id);
    return d;
  }
  outs.forEach((b) => visit(b.id));
  for (let i = 0; i < recOrder.length; i++) sources(byId.get(recOrder[i])).forEach(visit);
  graph.boxes.forEach((b) => visit(b.id));
  for (let i = 0; i < recOrder.length; i++) sources(byId.get(recOrder[i])).forEach(visit);

  const params = (d) => (d && d.size ? "(" + [...d].sort().join(", ") + ")" : "");
  const ref = ([id, k]) => {
    const b = byId.get(id);
    if (rec.has(id) || b.type === "in") return b.name;
    const r = b.name + params(deps.get(id));
    const n = outlets(b);
    return n > 1 ? `(${r} : ba.selector(${k}, ${n}))` : r;
  };
  const inletText = (b, i, fallback) => {
    const ps = into.get(b.id + ":" + i) || [];
    if (!ps.length) return fallback;
    const rs = ps.map(ref);
    return rs.length > 1 ? "(" + rs.join(" + ") + ")" : rs[0];
  };
  const exprOf = (b) => {
    const u = unitOf(b);
    if (b.type === "num") return fmt(b.args[0]);
    if (u.kind === "code") {
      const ins = [];
      for (let i = 0; i < inlets(b); i++) ins.push(inletText(b, i, "0"));
      return ins.length ? `(${ins.join(", ")} : ${b.args[0]})` : `(${b.args[0]})`;
    }
    if (u.kind === "ui") return u.code([], b.args.map((a, i) => (i ? fmt(a) : a)));
    const sa = slotArgs(b), il = inletSlots(u);
    const v = u.slots.map((s, i) => {
      const inlet = il.indexOf(i);
      const fallback = fmt(sa[i] !== undefined ? sa[i] : s.def);
      return inlet >= 0 ? inletText(b, inlet, fallback) : fallback;
    });
    return u.code(v, b.args);
  };

  const defs = [];
  for (const id of order) {
    const b = byId.get(id);
    if (b.type === "in" || b.type === "out") continue;
    defs.push(`  ${b.name}${params(deps.get(id))} = ${exprOf(b)};`);
  }
  const head = `process${ins.length ? "(" + ins.map((b) => b.name).join(", ") + ")" : ""} = `;
  const outExprs = outs.length ? outs.map((b) => inletText(b, 0, "0")) : ["0"];
  let body;
  if (recOrder.length) {
    // a loop: the whole network as a function of the delays' outputs, returning what goes into the
    // delays and then the outputs; ~ feeds the first ones back one sample later (that is the delay)
    const mems = recOrder.map((id) => byId.get(id)), K = mems.length;
    const loop = nameFor("loop", new Set(graph.boxes.map((b) => b.name)));
    defs.unshift(`  ${loop}(${mems.map((m) => m.name).join(", ")}) = ${mems.map((m) => inletText(m, 0, "0")).concat(outExprs).join(", ")};`);
    body = `${loop} ~ (${Array(K).fill("_").join(", ")}) : (${Array(K).fill("!").concat(Array(outExprs.length).fill("_")).join(", ")})`;
  } else body = outExprs.join(", ");
  let code = 'import("stdfaust.lib");\n\n' + head + body;
  if (defs.length) code += "\nwith {\n" + defs.join("\n") + "\n}";
  code += ";\n";
  const seq = ins.concat(order.map((id) => byId.get(id)).filter((b) => b.type !== "in" && b.type !== "out"),
    recOrder.map((id) => byId.get(id)), outs);
  const lay = seq.map((b) => `${b.name} ${Math.round(b.x)} ${Math.round(b.y)}`);
  for (let i = 0; i < lay.length; i += 6) code += (i ? "" : "\n") + "//@ layout " + lay.slice(i, i + 6).join(", ") + "\n";
  return code;
}

// boxes without a position: in rows by depth, top to bottom as signals flow
export function layout(graph, W = 640) {
  const byId = new Map(graph.boxes.map((b) => [b.id, b]));
  const ups = new Map(graph.boxes.map((b) => [b.id, []]));
  for (const w of graph.wires) if (ups.has(w.to[0]) && byId.get(w.from[0]).type !== "'") ups.get(w.to[0]).push(w.from[0]);
  const depth = new Map();
  const d = (id, seen = new Set()) => {
    if (depth.has(id)) return depth.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const v = Math.max(-1, ...ups.get(id).map((u) => d(u, seen))) + 1;
    depth.set(id, v);
    return v;
  };
  graph.boxes.forEach((b) => d(b.id));
  const rows = new Map();
  for (const b of graph.boxes) {
    if (b.x !== undefined && b.y !== undefined) continue;
    const r = b.type === "out" ? Math.max(...depth.values()) : depth.get(b.id);
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r).push(b);
  }
  // side by side, each as wide as its text (as the patch view draws it)
  const w = (b) => Math.max(44, boxText(b).length * 7.3 + 16);
  for (const [r, bs] of rows) {
    let x = 20;
    for (const b of bs) { b.x = Math.round(x); b.y = 24 + r * 60; x += w(b) + 24; }
  }
  return graph;
}

export function newBox(graph, type, args, x, y, extra = {}) {
  const id = graph.boxes.reduce((m, b) => Math.max(m, b.id), 0) + 1;
  const b = { id, type, args: args || [], x, y, ...extra };
  graph.boxes.push(b);
  name(graph, b);
  return b;
}

export { UNITS };
