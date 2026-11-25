// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 71 · reveal: a patch laid out by its flow (discussion #407).
// A layered drawing (after Sugiyama, Tagawa & Toda): every box gets a row (a rank) after the boxes that feed it, the
// boxes of a row are ordered so that wires cross as little as they can, and each box sits under the boxes that feed
// it. Sources at the top, the dac~ at the bottom: the patch reads as the signal goes. Pure: a patch in, places out.
//
//   layout(patch, opts) → { places: {id: [x, y]}, ranks: {id: r}, rows: [[id…]…] (with the "·n" points of long
//                          wires), crossings, size: [w, h] }
//   patch: { boxes: {id: {text}}, lines: [[a, o, b, i], …] }   opts: { width(id, box), height, rowGap, gap, margin,
//                                                                         sweeps }
//   crossings(rows, edges) counts the wires that cross between neighbouring rows.

export const boxWidth = (b) => Math.max(36, Math.round(14 + 7.2 * String((b && b.text) || "").length));

// a feedback loop makes no order: the wires that go back (found by a depth-first walk from the sources, in the
// boxes' order) are left out of the ranks, and drawn as they are
function forwardEdges(ids, edges) {
  const out = new Map(ids.map((id) => [id, []]));
  for (const [a, b] of edges) out.get(a).push(b);
  const state = new Map(), back = new Set();
  const indeg = new Map(ids.map((id) => [id, 0]));
  for (const [, b] of edges) indeg.set(b, indeg.get(b) + 1);
  const starts = [...ids.filter((id) => indeg.get(id) === 0), ...ids];
  for (const s of starts) {
    if (state.has(s)) continue;
    const stack = [[s, 0]];
    state.set(s, 1);
    while (stack.length) {
      const top = stack[stack.length - 1], [v, k] = top, nexts = out.get(v);
      if (k < nexts.length) {
        top[1] += 1;
        const w = nexts[k];
        if (state.get(w) === 1) back.add(v + "\u0000" + w);
        else if (!state.has(w)) { state.set(w, 1); stack.push([w, 0]); }
      } else { state.set(v, 2); stack.pop(); }
    }
  }
  return edges.filter(([a, b]) => !back.has(a + "\u0000" + b));
}

// the rank of a box: one more than the boxes that feed it (the longest way from a source)
function ranksOf(ids, fwd) {
  const preds = new Map(ids.map((id) => [id, []]));
  for (const [a, b] of fwd) preds.get(b).push(a);
  const rank = new Map();
  const visit = (id) => {
    if (rank.has(id)) return rank.get(id);
    rank.set(id, 0);   // (no cycles are left; this guards anyway)
    const r = preds.get(id).length ? 1 + Math.max(...preds.get(id).map(visit)) : 0;
    rank.set(id, r);
    return r;
  };
  ids.forEach(visit);
  return rank;
}

export function crossings(rows, edges) {
  const pos = new Map();
  rows.forEach((row) => row.forEach((id, i) => pos.set(id, i)));
  const rankOf = new Map();
  rows.forEach((row, r) => row.forEach((id) => rankOf.set(id, r)));
  let n = 0;
  for (let r = 0; r + 1 < rows.length; r++) {
    const es = edges.filter(([a, b]) => rankOf.get(a) === r && rankOf.get(b) === r + 1).map(([a, b]) => [pos.get(a), pos.get(b)]);
    for (let i = 0; i < es.length; i++)
      for (let j = i + 1; j < es.length; j++)
        if ((es[i][0] - es[j][0]) * (es[i][1] - es[j][1]) < 0) n++;
  }
  return n;
}

const boxNum = (id) => { const m = /^b(\d+)$/.exec(String(id).replace(/^:/, "")); return m ? +m[1] : 1e9; };

export function layout(patch, opts = {}) {
  const { height = 24, rowGap = 46, gap = 26, margin = 30, sweeps = 8 } = opts;
  const width = opts.width || ((id, b) => boxWidth(b));
  const boxes = patch.boxes || {};
  const ids = Object.keys(boxes).sort((a, b) => boxNum(a) - boxNum(b) || (a < b ? -1 : a > b ? 1 : 0));
  const known = new Set(ids);
  const seen = new Set(), edges = [];
  for (const [a, , b] of patch.lines || []) {
    const k = a + "\u0000" + b;
    if (known.has(a) && known.has(b) && a !== b && !seen.has(k)) { seen.add(k); edges.push([a, b]); }
  }
  const wired = new Set(edges.flat());
  const linked = ids.filter((id) => wired.has(id)), alone = ids.filter((id) => !wired.has(id));
  const fwd = forwardEdges(linked, edges);
  const rank = ranksOf(linked, fwd);
  // a wire over several rows passes through points ("·n") on the rows between, so it takes part in the order
  const W = new Map(linked.map((id) => [id, width(id, boxes[id])]));
  const segs = [];
  let dummies = 0;
  const nRanks = linked.length ? 1 + Math.max(...linked.map((id) => rank.get(id))) : 0;
  const rows = Array.from({ length: nRanks }, () => []);
  linked.forEach((id) => rows[rank.get(id)].push(id));
  for (const [a, b] of fwd) {
    let prev = a;
    for (let r = rank.get(a) + 1; r < rank.get(b); r++) {
      const d = "·" + dummies++;
      rank.set(d, r); W.set(d, 8); rows[r].push(d);
      segs.push([prev, d]); prev = d;
    }
    segs.push([prev, b]);
  }
  const preds = new Map(), succs = new Map();
  for (const r of rows) for (const id of r) { preds.set(id, []); succs.set(id, []); }
  for (const [a, b] of segs) { succs.get(a).push(b); preds.get(b).push(a); }

  // the order inside each row: barycentres, down and up, keeping the best order seen
  const order = () => { const m = new Map(); rows.forEach((row) => row.forEach((id, i) => m.set(id, i))); return m; };
  const sweep = (r, from) => {
    const pos = order();
    const bary = new Map(rows[r].map((id, i) => {
      const ns = from.get(id);
      return [id, ns.length ? ns.reduce((s, n) => s + pos.get(n), 0) / ns.length : i];
    }));
    rows[r].sort((x, y) => bary.get(x) - bary.get(y));
  };
  let best = rows.map((r) => [...r]), bestN = crossings(rows, segs);
  for (let s = 0; s < sweeps && bestN > 0; s++) {
    if (s % 2 === 0) for (let r = 1; r < rows.length; r++) sweep(r, preds);
    else for (let r = rows.length - 2; r >= 0; r--) sweep(r, succs);
    const n = crossings(rows, segs);
    if (n < bestN) { bestN = n; best = rows.map((row) => [...row]); }
  }
  for (let r = 0; r < rows.length; r++) rows[r] = best[r];

  // places: each row from the left, each box as near as it can be to under the boxes that feed it
  const cx = new Map();
  for (let r = 0; r < rows.length; r++) {
    const want = rows[r].map((id) => {
      const ps = preds.get(id).filter((p) => cx.has(p));
      return ps.length ? ps.reduce((s, p) => s + cx.get(p), 0) / ps.length : null;
    });
    // left to right without overlapping, then pulled back towards where each wants to be
    let x = margin;
    const left = rows[r].map((id, i) => {
      const w = W.get(id), l = Math.max(x, want[i] == null ? x : want[i] - w / 2);
      x = l + w + gap;
      return l;
    });
    for (let i = rows[r].length - 2; i >= 0; i--) {
      const id = rows[r][i], w = W.get(id), limit = left[i + 1] - gap - w;
      const target = want[i] == null ? left[i] : want[i] - w / 2;
      left[i] = Math.max(i ? left[i - 1] + W.get(rows[r][i - 1]) + gap : margin, Math.min(limit, Math.max(left[i], target)));
    }
    rows[r].forEach((id, i) => cx.set(id, left[i] + W.get(id) / 2));
  }
  const places = {};
  let maxX = margin;
  rows.forEach((row, r) => row.forEach((id) => {
    if (id.startsWith("·")) return;
    const l = Math.round(cx.get(id) - W.get(id) / 2);
    places[id] = [l, margin + r * (height + rowGap)];
    maxX = Math.max(maxX, l + W.get(id));
  }));
  // boxes with no wire: a row of their own, below
  let x = margin;
  const yAlone = margin + rows.length * (height + rowGap);
  for (const id of alone) { places[id] = [x, yAlone]; x += width(id, boxes[id]) + gap; maxX = Math.max(maxX, x - gap); }
  const ranks = {};
  for (const id of linked) ranks[id] = rank.get(id);
  return { places, ranks, rows: rows.map((r) => [...r]), crossings: bestN, size: [maxX + margin, yAlone + (alone.length ? height + margin : margin - rowGap)] };
}
