// Study 31 · Faust code → a subpatch of unit boxes.
//
// Not a compiler: a small evaluator of Faust's block-diagram algebra over the vocabulary of units.mjs.
// Every expression is a block {nin, nout, build(inputs) → outputs}; building a block makes the boxes
// and wires it stands for. The operators mean what they mean in Faust:
//   A : B   sequence        A , B   parallel     A <: B  split     A :> B  merge (a sum)
//   A ~ B   recursion, through one-sample delay boxes (')
//   a + b   is  a, b : +   and  +(b)  is  _, b : +  (partial application, from the right)
//   x'      one-sample delay    a @ n   delay by n
//   f(a, b) a unit or a definition of the program called with arguments
//   … with { definitions }   … letrec { 'y = …; }
// What is not in the vocabulary (a library function the boxes do not know) becomes a box of Faust code
// kept as written, once the compiler has said how many inputs and outputs it has (`arity`).

import { UNITS, CODE } from "./units.mjs";
import { newBox, layout, name } from "./graph.mjs";

// ── tokens ──
const OPS = ["<:", ":>", "<=", ">=", "==", "!=", ":", ",", "~", "+", "-", "*", "/", "%", "^", "@", "'", "<", ">", "=", ";", "(", ")", "{", "}", "!"];
export function lex(src) {
  const out = [], layoutLines = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith("//", i)) {
      const e = src.indexOf("\n", i), line = src.slice(i, e < 0 ? src.length : e);
      if (line.startsWith("//@ layout")) layoutLines.push(line.slice(10));
      i = e < 0 ? src.length : e; continue;
    }
    if (src.startsWith("/*", i)) { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"') {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== '"') { if (src[j] === "\\") j++; s += src[j++]; }
      out.push({ t: "str", v: s, at: i, end: j + 1 }); i = j + 1; continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e-?\d+)?f?/i.exec(src.slice(i, i + 40));
    if (num) { out.push({ t: "num", v: parseFloat(num[0]), at: i, end: i + num[0].length }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(src.slice(i, i + 200));
    if (id) { out.push({ t: "id", v: id[0], at: i, end: i + id[0].length }); i += id[0].length; continue; }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) { out.push({ t: "op", v: op, at: i, end: i + op.length }); i += op.length; continue; }
    throw new Error(`a character Faust does not use here: ${c}`);
  }
  out.push({ t: "eof", at: src.length, end: src.length });
  const lay = new Map();
  for (const l of layoutLines) for (const part of l.split(",")) {
    const m = /^\s*(\S+)\s+(-?\d+)\s+(-?\d+)\s*$/.exec(part);
    if (m) lay.set(m[1], { x: +m[2], y: +m[3] });
  }
  return { toks: out, layout: lay };
}

// ── syntax ──
const INFIX = { "<:": 1, ":>": 1, ":": 2, ",": 3, "~": 4, "<": 5, ">": 5, "<=": 5, ">=": 5, "==": 5, "!=": 5,
  "+": 6, "-": 6, "*": 7, "/": 7, "%": 7, "^": 8, "@": 9 };
const COMPOSE = new Set(["<:", ":>", ":", ",", "~"]);

export function parseProgram(src) {
  const { toks, layout: lay } = lex(src);
  let p = 0;
  const peek = (k = 0) => toks[p + k], next = () => toks[p++];
  const is = (v, k = 0) => toks[p + k].t === "op" && toks[p + k].v === v;
  const expect = (v) => { const t = next(); if (!(t.t === "op" && t.v === v)) throw new Error(`expected ${v} at ${t.at}`); return t; };

  function expr(minBp = 0, noComma = false) {
    let left = nud(noComma);
    for (;;) {
      const t = peek();
      if (t.t === "op" && t.v === "'") { next(); left = { k: "mem", x: left, at: left.at, end: t.end }; continue; }
      if (t.t !== "op" || !(t.v in INFIX)) break;
      if (noComma && t.v === ",") break;
      const bp = INFIX[t.v];
      if (bp <= minBp) break;
      next();
      const right = expr(bp, noComma);
      left = { k: COMPOSE.has(t.v) ? "comp" : "bin", op: t.v, l: left, r: right, at: left.at, end: right.end };
    }
    return left;
  }
  function full(noComma = false) {
    let e = expr(0, noComma);
    for (;;) {
      const t = peek();
      if (t.t === "id" && t.v === "with") { next(); expect("{"); const defs = definitions(); expect("}"); e = { k: "with", x: e, defs, at: e.at, end: t.end }; continue; }
      if (t.t === "id" && t.v === "letrec") { next(); expect("{"); const defs = recdefs(); expect("}"); e = { k: "letrec", x: e, defs, at: e.at, end: t.end }; continue; }
      return e;
    }
  }
  function args() {
    expect("(");
    const a = [];
    if (!is(")")) { a.push(full(true)); while (is(",")) { next(); a.push(full(true)); } }
    expect(")");
    return a;
  }
  function nud() {
    const t = next();
    if (t.t === "num") return { k: "num", v: t.v, at: t.at, end: t.end };
    if (t.t === "str") return { k: "str", v: t.v, at: t.at, end: t.end };
    if (t.t === "op" && t.v === "(") { const e = full(false); const c = expect(")"); return { ...e, at: t.at, end: c.end, paren: true }; }
    if (t.t === "op" && t.v === "-" && peek().t === "num") { const n = next(); return { k: "num", v: -n.v, at: t.at, end: n.end }; }
    if (t.t === "op" && t.v === "!") return { k: "id", v: "!", at: t.at, end: t.end };
    if ((t.t === "op" && t.v in INFIX && !COMPOSE.has(t.v)) || t.t === "id") {
      const node = { k: "id", v: t.v, at: t.at, end: t.end };
      if (is("(")) { const a = args(); return { k: "call", f: node, args: a, at: t.at, end: toks[p - 1].end }; }
      return node;
    }
    throw new Error(`unexpected ${t.v === undefined ? "end" : t.v} at ${t.at}`);
  }
  function definitions() {
    const defs = [];
    while (peek().t === "id" && (is("=", 1) || is("(", 1))) defs.push(definition());
    return defs;
  }
  function definition() {
    const n = next().v, params = [];
    if (is("(")) { next(); for (;;) { params.push(next().v); if (is(",")) { next(); continue; } expect(")"); break; } }
    expect("=");
    const body = full(false);
    expect(";");
    return { name: n, params, body };
  }
  function recdefs() {
    const defs = [];
    while (is("'")) { next(); const n = next().v; expect("="); const body = full(false); expect(";"); defs.push({ name: n, body }); }
    return defs;
  }
  const top = [];
  while (peek().t !== "eof") {
    const t = peek();
    if (t.t === "id" && (t.v === "import" || t.v === "declare")) { while (!is(";")) next(); next(); continue; }
    top.push(definition());
  }
  return { defs: top, layout: lay, src };
}

// ── evaluation ──
export class NeedArity extends Error { constructor(texts) { super("needs the compiler"); this.texts = texts; } }

const P = (box, k = 0) => ({ box, k });
const N = (v) => ({ num: v });
const portsBlock = (ports) => ({ nin: 0, nout: ports.length, build: () => ports });

export function toGraph(src, arity = () => undefined) {
  const prog = parseProgram(src);
  const graph = { boxes: [], wires: [] };
  const need = new Set();
  const lay = prog.layout;

  // boxes are named after parsing: a definition's name wins over an automatic one
  const box = (type, args, extra) => { const b = newBox(graph, type, args, undefined, undefined, extra); delete b.name; b.autoName = true; return b; };
  const named = (b, n) => { b.name = n; delete b.autoName; return b; };
  const nameBox = (b, n) => { if (b.autoName) named(b, n); };
  const fresh = (b) => b;
  function asPort(port) {
    if (port.num !== undefined) return P(fresh(box("num", [port.num])).id);
    return port;
  }
  function wire(port, to, inlet) {
    if (port.sum) { port.sum.forEach((q) => wire(q, to, inlet)); return; }
    const q = asPort(port);
    graph.wires.push({ from: [q.box, q.k], to: [to, inlet] });
  }

  // a unit applied to its slot ports (or numbers)
  function unitBox(u, ports, extraArgs) {
    const slots = u.slots;
    let args = [];
    if (u.kind === "prim") {
      let j = slots.length;
      while (j > 0 && ports[j - 1] && ports[j - 1].num !== undefined) j--;
      if (u.mem) j = slots.length; // x' keeps x as a wire, even a number
      args = ports.slice(j).map((q) => q.num);
      const b = fresh(box(u.name, args));
      ports.slice(0, j).forEach((q, i) => wire(q, b.id, i));
      return b;
    }
    if (u.kind === "lib") {
      let last = -1;
      slots.forEach((s, i) => { if (s.kind !== "in" && ports[i] && ports[i].num !== undefined) last = i; });
      slots.forEach((s, i) => { if (s.kind !== "in" && i <= last) args.push(ports[i] && ports[i].num !== undefined ? ports[i].num : s.def); });
      const b = fresh(box(u.name, args));
      let inlet = 0;
      slots.forEach((s, i) => {
        if (s.kind === "const") { if (!ports[i] || ports[i].num === undefined) throw new Error(`${u.name}: ${s.name} must be a number`); return; }
        if (ports[i] && !(s.kind !== "in" && ports[i].num !== undefined)) wire(ports[i], b.id, inlet);
        inlet++;
      });
      return b;
    }
    return fresh(box(u.name, extraArgs || []));
  }

  const constNum = (blk) => {
    if (blk.nin !== 0 || blk.nout !== 1) return undefined;
    const q = blk.build([])[0];
    return q.num;
  };

  // blocks for the vocabulary
  const uiMemo = new Map();
  function unitBlock(u, callArgs, env, node) {
    if (u.kind === "ui") {
      const vals = callArgs.map((a) => (a.k === "str" ? a.v : constNum(evaluate(a, env))));
      const args = u.defs.map((d, i) => (vals[i] !== undefined ? vals[i] : d));
      const key = u.name + JSON.stringify(args);
      return { nin: 0, nout: 1, build: () => {
        if (!uiMemo.has(key)) uiMemo.set(key, P(unitBox(u, [], args).id));
        return [uiMemo.get(key)];
      } };
    }
    const argBlocks = (callArgs || []).map((a) => evaluate(a, env));
    argBlocks.forEach((b) => { if (b.nin !== 0 || b.nout !== 1) throw new Error(`${u.name}: an argument must be one signal`); });
    const n = u.slots.length;
    let filled; // slot index → block
    if (u.kind === "prim") {
      filled = new Map(argBlocks.map((b, j) => [n - argBlocks.length + j, b]));
    } else {
      const params = u.slots.map((s, i) => [s, i]).filter(([s]) => s.kind !== "in").map(([, i]) => i);
      if (argBlocks.length && argBlocks.length !== params.length) throw new Error(`${u.name} takes ${params.length} arguments`);
      filled = new Map(argBlocks.map((b, j) => [params[j], b]));
      if (!argBlocks.length && u.slots.some((s) => s.kind === "const")) throw new Error(`${u.name} needs its arguments`);
    }
    const open = u.slots.map((_, i) => i).filter((i) => !filled.has(i));
    return { nin: open.length, nout: u.outs, build: (inputs) => {
      const ports = u.slots.map((_, i) => (filled.has(i) ? filled.get(i).build([])[0] : inputs[open.indexOf(i)]));
      return [P(unitBox(u, ports).id)];
    } };
  }

  function codeBlock(node) {
    const text = prog.src.slice(node.at, node.end).trim().replace(/^\((.*)\)$/s, "$1");
    const a = arity(text);
    if (!a) throw new NeedArity([text]);
    return { nin: a.ins, nout: a.outs, build: (inputs) => {
      const b = fresh(box("faust", [text], { io: { ins: a.ins, outs: a.outs } }));
      inputs.forEach((q, i) => wire(q, b.id, i));
      return Array.from({ length: a.outs }, (_, k) => P(b.id, k));
    } };
  }

  function lookup(env, n) { for (let e = env; e; e = e.up) if (e.vars.has(n)) return e.vars.get(n); return undefined; }

  // a definition of the program, used by name: a block (or a function when it has parameters)
  function defBlock(d, env, callArgs, callEnv) {
    if (!d.params.length) {
      if (callArgs) throw new Error(`${d.name} takes no arguments`);
      if (!d.memo) {
        const blk = evaluate(d.body, d.env);
        if (blk.nin === 0) {
          let ports = blk.build([]);
          ports = ports.map((q) => {
            if (q.num !== undefined && lay.has(d.name)) return P(named(box("num", [q.num]), d.name).id);
            return q;
          });
          const ids = new Set(ports.map((q) => q.box));
          if (ports.length && ids.size === 1 && ports[0].box !== undefined) {
            const b = graph.boxes.find((x) => x.id === ports[0].box);
            if (b.autoName && b.type !== "in") nameBox(b, d.name);
          }
          d.memo = portsBlock(ports);
        } else d.memo = blk;
      }
      return d.memo;
    }
    // a function: bound to blocks (its arguments), or used bare, its parameters taken as inputs
    if (callArgs) {
      const blocks = callArgs.map((a) => evaluate(a, callEnv));
      if (blocks.length !== d.params.length) throw new Error(`${d.name} takes ${d.params.length} arguments`);
      const key = blocks.every((b) => b.nin === 0) ? JSON.stringify(blocks.map((b) => b.build([]))) : null;
      d.calls = d.calls || new Map();
      if (key && d.calls.has(key)) return d.calls.get(key);
      const inner = { vars: new Map(d.params.map((p, i) => [p, { block: blocks[i] }])), up: d.env };
      let blk = evaluate(d.body, inner);
      if (key && blk.nin === 0) {
        const ports = blk.build([]);
        if (ports.length === 1 && ports[0].box !== undefined) {
          const b = graph.boxes.find((x) => x.id === ports[0].box);
          if (b.autoName) nameBox(b, d.name);
        }
        blk = portsBlock(ports);
        d.calls.set(key, blk);
      }
      return blk;
    }
    return { nin: d.params.length, nout: undefined, params: d.params, build: (inputs) => {
      const inner = { vars: new Map(d.params.map((p, i) => [p, { block: portsBlock([inputs[i]]) }])), up: d.env };
      const blk = evaluate(d.body, inner);
      if (blk.nin !== 0) throw new Error(`${d.name}: too many inputs`);
      return blk.build([]);
    } };
  }

  function evaluate(node, env) {
    switch (node.k) {
      case "num": return portsBlock([N(node.v)]);
      case "str": throw new Error("a text is only a label of a control");
      case "id": case "call": {
        const fnode = node.k === "id" ? node : node.f;
        const n = fnode.v, callArgs = node.k === "call" ? node.args : null;
        if (n === "_" && !callArgs) return { nin: 1, nout: 1, build: (i) => [i[0]] };
        if (n === "!" && !callArgs) return { nin: 1, nout: 0, build: () => [] };
        if (n === "ba.selector" && callArgs) {
          const [k, m] = callArgs.map((a) => constNum(evaluate(a, env)));
          return { nin: m, nout: 1, build: (i) => [i[k]] };
        }
        const v = lookup(env, n);
        if (v) {
          if (v.block) { if (callArgs) throw new Error(`${n} is a signal, not a function`); return v.block; }
          return defBlock(v.def, env, callArgs, env);
        }
        if (UNITS[n] && UNITS[n].kind !== "num" && UNITS[n].kind !== "io") return unitBlock(UNITS[n], callArgs, env, node);
        if (/^[A-Za-z_]/.test(n)) return codeBlock(node);
        throw new Error(`${n} is not something the boxes know`);
      }
      case "mem": return evaluate({ k: "comp", op: ":", l: node.x, r: { k: "id", v: "'" } }, env);
      case "bin": return evaluate({ k: "comp", op: ":", l: { k: "comp", op: ",", l: node.l, r: node.r }, r: { k: "id", v: node.op } }, env);
      case "comp": {
        const A = evaluate(node.l, env), B = evaluate(node.r, env);
        if (node.op === ",") return { nin: A.nin + B.nin, nout: A.nout !== undefined && B.nout !== undefined ? A.nout + B.nout : undefined, build: (i) => A.build(i.slice(0, A.nin)).concat(B.build(i.slice(A.nin))) };
        if (node.op === ":") return { nin: A.nin, nout: B.nout, build: (i) => {
          const o = A.build(i);
          if (o.length !== B.nin) throw new Error(`${o.length} outputs into ${B.nin} inputs (:)`);
          return B.build(o);
        } };
        if (node.op === "<:") return { nin: A.nin, nout: B.nout, build: (i) => {
          const o = A.build(i);
          if (!o.length || B.nin % o.length) throw new Error(`${o.length} outputs cannot split into ${B.nin} inputs (<:)`);
          return B.build(Array.from({ length: B.nin }, (_, j) => o[j % o.length]));
        } };
        if (node.op === ":>") return { nin: A.nin, nout: B.nout, build: (i) => {
          const o = A.build(i);
          if (!B.nin || o.length % B.nin) throw new Error(`${o.length} outputs cannot merge into ${B.nin} inputs (:>)`);
          const sums = Array.from({ length: B.nin }, () => []);
          o.forEach((q, j) => sums[j % B.nin].push(q));
          // a merge is a sum: explicit + boxes
          return B.build(sums.map((s) => s.reduce((a, q) => P(unitBox(UNITS["+"], [a, q]).id))));
        } };
        if (node.op === "~") {
          if (B.nout === undefined) throw new Error("~: cannot tell how many signals come back");
          const k = B.nout;
          return { nin: A.nin - k, nout: A.nout, build: (i) => {
          // B's outputs come back into A's first inputs through one-sample delays
          // named after the loop function's parameters when there is one (the form the code of a patch takes)
          const mems = Array.from({ length: k }, (_, j) => (A.params && A.params[j] ? named(box("'", []), A.params[j]) : box("'", [])));
          const o = A.build(mems.map((m) => P(m.id)).concat(i));
          const fb = B.build(o.slice(0, B.nin));
          fb.forEach((q, j) => wire(q, mems[j].id, 0));
          return o;
        } };
        }
        break;
      }
      case "with": {
        const inner = { vars: new Map(), up: env };
        for (const d of node.defs) inner.vars.set(d.name, { def: { ...d, env: inner } });
        return evaluate(node.x, inner);
      }
      case "letrec": {
        // 'v = e: inside the definitions of a letrec, v is its own value one sample before (a delay's
        // output); in the expression the letrec belongs to, v is the value itself (that delay's input)
        // both appear only when used: an unused variable leaves no box behind
        const inside = { vars: new Map(), up: env }, outside = { vars: new Map(), up: env };
        const PENDING = {}, mem = new Map(), val = new Map(), defs = new Map(node.defs.map((d) => [d.name, d]));
        const memOf = (n) => {
          if (!mem.has(n)) { const m = box("'", []); mem.set(n, m); if (val.get(n) && val.get(n) !== PENDING) wire(val.get(n), m.id, 0); }
          return mem.get(n);
        };
        const valOf = (n) => {
          if (!val.has(n)) {
            val.set(n, PENDING); // while its own definition is being read
            const b = evaluate(defs.get(n).body, inside);
            const o = b.nin === 0 ? b.build([]) : [];
            if (o.length !== 1) throw new Error(`'${n} must be one signal`);
            val.set(n, o[0]);
            if (mem.has(n)) wire(o[0], mem.get(n).id, 0);
          }
          return val.get(n);
        };
        for (const d of node.defs) {
          inside.vars.set(d.name, { block: { nin: 0, nout: 1, build: () => { const m = memOf(d.name); valOf(d.name); return [P(m.id)]; } } });
          outside.vars.set(d.name, { block: { nin: 0, nout: 1, build: () => [valOf(d.name)] } });
        }
        return evaluate(node.x, outside);
      }
    }
    throw new Error("cannot read this part");
  }

  // the program
  const env = { vars: new Map(), up: null };
  for (const d of prog.defs) env.vars.set(d.name, { def: { ...d, env } });
  const pd = env.vars.get("process");
  if (!pd) throw new Error("no process");
  const d = pd.def;
  let ins = [], blk;
  if (d.params.length) {
    ins = d.params.map((pn, j) => P(named(box("in", [j + 1]), pn).id));
    const inner = { vars: new Map(d.params.map((pn, j) => [pn, { block: portsBlock([ins[j]]) }])), up: env };
    blk = evaluate(d.body, inner);
  } else blk = evaluate(d.body, env);
  for (let j = 0; j < (blk.nin || 0); j++) { const b = box("in", [ins.length + 1]); ins.push(P(b.id)); }
  const extra = ins.slice(d.params.length);
  const outs = blk.build(d.params.length ? extra : ins);
  if (need.size) throw new NeedArity([...need]);
  outs.forEach((q, j) => { const b = box("out", [j + 1]); wire(q, b.id, 0); });

  // names: what the code called them (unique), then automatic ones; positions: from the layout comment
  const taken = new Set();
  for (const b of graph.boxes) {
    if (b.autoName) continue;
    if (taken.has(b.name)) { b.autoName = true; continue; }
    taken.add(b.name);
  }
  for (const b of graph.boxes) if (b.autoName) { delete b.autoName; delete b.name; name(graph, b); }
  graph.boxes.forEach((b) => { if (lay.has(b.name)) Object.assign(b, lay.get(b.name)); });
  return layout(graph);
}

// parse, asking the compiler (async) for the inputs and outputs of the Faust code the boxes do not know
export async function toGraphAsync(src, arityOf, cache = new Map()) {
  for (let round = 0; round < 8; round++) {
    try {
      return toGraph(src, (t) => cache.get(t));
    } catch (e) {
      if (!(e instanceof NeedArity)) throw e;
      for (const t of e.texts) if (!cache.has(t)) {
        const a = await arityOf(t);
        if (!a) throw new Error(`the compiler does not understand: ${t}`);
        cache.set(t, a);
      }
    }
  }
  throw new Error("could not read the code");
}

export { CODE };
