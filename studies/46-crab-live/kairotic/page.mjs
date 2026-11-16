// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 46 · crab live: the page. You play the first half choosing among the notes that can close
// the crab; the engine answers each beat with the end of your own line; at the middle the rest of your line comes
// out as a score to read, and the engine plays your first half backwards. By turns (a note in is a beat) or on a
// pulse (the beat goes on: the note you played since the last one, or the engine's for you). No score following:
// in the second half the engine only plays its part.
import { mirror } from "./mirror.mjs";
import { makeSystem, DIATONIC } from "./kernel.mjs";
import { createLive, phase, options, nearest, choose, auto, read, rest, voices } from "./live.mjs";
import { synth } from "./sound.mjs";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const KEYS = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"];

export function mount() {
  const ui = { kind: "crab", k: -7, mode: "dorian", bars: 5, timing: "turns", tempo: 72, sound: true, seed: 1 };
  const S = makeSystem(DIATONIC);
  const snd = synth();
  let o = null, g = null, pending = null, timer = null, nextAt = 0, total = null;

  function spec() {
    const m = DIATONIC.modes[ui.mode], tonic = m.final, [a, z] = m.ambitus, b = 2;
    return { tonic, lo: tonic + a, hi: tonic + z, n: b * (ui.bars - 1) + 1, b, spacing: 11, system: DIATONIC,
             starts: m.starts.map((x) => x + tonic), transform: { kind: ui.kind, k: ui.k, axis: tonic } };
  }
  function rng() { let a = (ui.seed * 2654435761) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function newGame() {
    stopPulse();
    o = mirror(spec()); g = createLive(o, { rng: rng() }); pending = null;
    total = o.count();
    ui.seed++;
    render();
  }
  const beatSec = () => 60 / ui.tempo;

  // ── playing ──
  function sound(b, playedMidi) {
    if (!ui.sound || !b) return;
    snd.note(playedMidi ?? (b.you != null ? S.midi(b.you) : null), beatSec() * 0.95, 0);
    if (b.engine != null) snd.note(S.midi(b.engine), beatSec() * 0.95, 1);
  }
  function play(x) {                                  // a note of yours (a step of the system)
    if (!g) return;
    snd.resume();
    if (ui.timing === "pulse") { pending = x; render(); return; }
    if (phase(g) === "choose") { const b = choose(g, x); sound(b); }
    else if (phase(g) === "read") { const b = read(g); sound(b, S.midi(x)); }
    render();
  }
  function tick() {                                   // a beat of the pulse
    if (!g) return;
    let b = null;
    if (phase(g) === "choose") b = pending != null ? choose(g, pending) : auto(g);
    else if (phase(g) === "read") { b = read(g); sound(b, pending != null ? S.midi(pending) : undefined); pending = null; render(); if (phase(g) === "done") stopPulse(); return; }
    pending = null;
    sound(b);
    if (phase(g) === "done") stopPulse();
    render();
  }
  function startPulse() {
    stopPulse(); snd.resume();
    nextAt = performance.now() + beatSec() * 1000;
    timer = setInterval(() => { if (performance.now() >= nextAt) { nextAt += beatSec() * 1000; tick(); } }, 15);
    render();
  }
  function stopPulse() { if (timer) clearInterval(timer); timer = null; }

  // ── drawing ──
  const colw = 40, rowh = 12, left = 46, top = 16;
  function render() {
    if (!g) return;
    const sp = o.spec, n = o.n, v = voices(g), ph = phase(g), t = g.t;
    const [clo, chi] = [o.T(sp.lo), o.T(sp.hi)].sort((a, b) => a - b);
    const lo = Math.min(sp.lo, clo) - 1, hi = Math.max(sp.hi, chi) + 1;
    const y = (s) => top + rowh * (hi - s), x = (c) => left + colw * c + colw / 2;
    const w = left + colw * n + 24, h = top + rowh * (hi - lo) + 36;
    const fin = ((sp.tonic % S.N) + S.N) % S.N;
    let out = "";
    for (let s = lo; s <= hi; s++) {
      const f = ((s % S.N) + S.N) % S.N === fin;
      out += `<line class="row${f ? " final" : ""}" x1="${left}" x2="${w - 10}" y1="${y(s)}" y2="${y(s)}"/>`;
      if (f || (s - lo) % 2 === 0) out += `<text class="pname${f ? " final" : ""}" x="6" y="${y(s)}">${S.pitchName(s)}</text>`;
    }
    for (let c = 0; c < n; c++) {
      out += `<line class="col${c === t && ph !== "done" ? " now" : ""}" x1="${x(c)}" x2="${x(c)}" y1="${top - 6}" y2="${top + rowh * (hi - lo) + 4}"/>`;
      if (c % sp.b === 0) { const xb = x(c) - colw / 2; out += `<line class="barline" x1="${xb}" x2="${xb}" y1="${top - 8}" y2="${top + rowh * (hi - lo) + 6}"/>`; }
      out += `<text class="tnum" x="${x(c)}" y="${h - 6}">${c + 1}</text>`;
    }
    const xm = left + colw * (n / 2);
    out += `<line class="mirrorline" x1="${xm}" x2="${xm}" y1="${top - 10}" y2="${top + rowh * (hi - lo) + 8}"><title>the middle: from here you read</title></line>`;
    // the score to read, from the middle, once it is written
    if (ph !== "choose") out += `<rect class="readzone" x="${left + colw * o.steps}" y="${top - 8}" width="${colw * (n - o.steps)}" height="${rowh * (hi - lo) + 16}"/>`;
    for (let c = 0; c < n; c++) {
      const you = v.you[c], en = v.engine[c];
      const played = c < t;
      if (en !== undefined && en !== null && played)
        out += `<rect class="comes" x="${x(c) - 5}" y="${y(en) - 5}" width="10" height="10" rx="2"><title>engine ${S.pitchName(en)}</title></rect>`;
      if (you !== undefined) {
        // before the middle: your notes the engine has written ahead; after it, the score to read
        const cls = played ? "dux" : ph === "choose" ? "dux ahead" : "dux toread";
        out += `<circle class="${cls}" cx="${x(c)}" cy="${y(you)}" r="6"><title>${played ? "you" : ph !== "choose" ? "to read" : "your note, written ahead by the engine"} ${S.pitchName(you)}</title></circle>`;
      }
    }
    // what you may play now
    if (ph === "choose") {
      for (const c of options(g)) {
        const yy = y(c.note), xx = x(t);
        if (c.reason) out += `<g><title>${S.pitchName(c.note)}: ${esc(c.reason)}</title><line class="nope" x1="${xx - 3}" y1="${yy - 3}" x2="${xx + 3}" y2="${yy + 3}"/><line class="nope" x1="${xx - 3}" y1="${yy + 3}" x2="${xx + 3}" y2="${yy - 3}"/></g>`;
        else if (c.futures > 0) out += `<circle class="cand${pending === c.note ? " hot" : ""}" data-play="${c.note}" cx="${xx}" cy="${yy}" r="6.5"><title>${S.pitchName(c.note)}: ${c.futures} ways to close the crab</title></circle><text class="futn" x="${xx + 10}" y="${yy}">${c.futures}</text>`;
      }
    } else if (ph === "read") {
      out += `<circle class="readnow" cx="${x(t)}" cy="${y(g.M[t])}" r="9"/>`;
    }
    const svg = $("score");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.setAttribute("width", w); svg.setAttribute("height", h);
    svg.innerHTML = out;

    // the keys: the notes of your range
    const opts = options(g), byNote = new Map(opts.map((c) => [c.note, c]));
    let keys = "";
    for (let s = sp.lo, i = 0; s <= sp.hi; s++, i++) {
      const c = byNote.get(s), ok = ph === "choose" ? c && !c.reason && c.futures > 0 : ph === "read" ? s === g.M[t] : false;
      keys += `<button type="button" class="key${ok ? " ok" : ""}${pending === s ? " hot" : ""}" data-play="${s}" ${ph === "done" ? "disabled" : ""}>`
            + `<b>${S.pitchName(s)}</b><small>${ph === "choose" && c && !c.reason && c.futures > 0 ? c.futures : ""}</small><i>${KEYS[i] || ""}</i></button>`;
    }
    $("keys").innerHTML = keys;

    // the outlet: the score from the middle
    $("outlet").textContent = g.score
      ? "[" + g.score.map(([b, s]) => `[${b + 1} ${S.pitchName(s)}]`).join(" ") + "]"
      : `comes out at the middle (beat ${o.steps + 1}), when the engine has written the end of your line`;
    $("outlet-sub").textContent = g.score ? `read it: beats ${o.steps + 1}–${n}` : "not yet";
    // the log
    $("log").innerHTML = g.log.slice(-10).reverse().map((b) =>
      `<li>beat ${b.t + 1}: you ${b.you != null ? S.pitchName(b.you) : "–"} · engine ${b.engine != null ? S.pitchName(b.engine) : "–"}`
      + (b.corrected ? ` <span class="warn">(${S.pitchName(b.played)} cannot close the crab)</span>` : "")
      + (b.auto ? ` <span class="soft">(the engine played for you)</span>` : "") + (b.score ? ` <b>· the score</b>` : "") + `</li>`).join("");
    const here = ph === "choose" ? o.count(g.M.slice(), t) : 1;
    $("status").textContent = ph === "done" ? `finished: ${n} beats · ${total} crabs under these rules`
      : ph === "choose" ? `beat ${t + 1} of ${n}: choose · ${here} ways to close it · ${total} crabs`
      : `beat ${t + 1} of ${n}: read`;
    $("here").textContent = ph === "choose" ? "first half: you choose, the engine writes the end of your line"
      : ph === "read" ? "second half: you read, the engine plays your first half backwards" : "the crab is finished";
    controls();
  }
  function controls() {
    $("kind").value = ui.kind; $("k").value = String(ui.k); $("mode").value = ui.mode; $("bars").value = ui.bars;
    $("tempo").value = ui.tempo; $("sound").checked = ui.sound;
    document.querySelectorAll("input[name=timing]").forEach((el) => { el.checked = el.value === ui.timing; });
    $("go").textContent = ui.timing === "pulse" ? (timer ? "■ Stop" : "▶ Start the pulse") : "New crab";
    $("go").hidden = false;
  }

  // ── wiring ──
  $("mode").innerHTML = Object.keys(DIATONIC.modes).map((m) => `<option value="${m}">${m}</option>`).join("");
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-play]"); if (p) { play(+p.dataset.play); return; }
    if (e.target.closest("#go")) {
      if (ui.timing === "pulse") { if (timer) { stopPulse(); controls(); } else { if (!g || phase(g) === "done") newGame(); startPulse(); } }
      else { snd.resume(); newGame(); }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) || !o) return;
    const i = KEYS.indexOf(e.key); if (i < 0) return;
    const s = o.spec.lo + i; if (s > o.spec.hi) return;
    e.preventDefault(); play(s);
  });
  const set = (f) => (e) => { f(e.target); newGame(); };
  $("kind").addEventListener("change", set((el) => { ui.kind = el.value; }));
  $("k").addEventListener("change", set((el) => { ui.k = +el.value; }));
  $("mode").addEventListener("change", set((el) => { ui.mode = el.value; }));
  $("bars").addEventListener("change", set((el) => { ui.bars = Math.max(3, Math.min(7, +el.value || 5)); }));
  $("tempo").addEventListener("change", (e) => { ui.tempo = Math.max(30, Math.min(200, +e.target.value || 72)); });
  $("sound").addEventListener("change", (e) => { ui.sound = e.target.checked; });
  document.querySelectorAll("input[name=timing]").forEach((el) => el.addEventListener("change", (e) => { ui.timing = e.target.value; newGame(); }));

  newGame();
  window.kairoticCrab = { game: () => g, kernel: () => o, ui: () => ({ ...ui, pulsing: !!timer }), play, tick, newGame, system: S, nearest: (x) => nearest(g, x), rest: () => rest(g) };
}
