// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 45 · ring~: the page. The sound comes from a phrase that loops, the microphone or the keys,
// goes into the ring (an AudioWorklet running ringcore.mjs) and out; the ring is drawn as a circle of time with
// the sound's peaks around it, the write head and the read head d behind (and, while it crossfades, where it
// was). mount() wires the markup of index.html; window.kairoticRingAudio is there for the tests.

const $ = (id) => document.getElementById(id);
const KEYS = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k"];
const BLACK = new Set([1, 3, 6, 8, 10]);
const PHRASE = [60, 62, 64, 67, 64, 62, 60, null, 67, 65, 64, 62, 64, null, 72, null];   // eighths at 120

export function mount() {
  const p = { dur: 8, d: 0.75, mode: "both", rate: 1, jump: 0.25, xfade: 0.03, interp: "cubic", feedback: 0.35, mix: 0.6, freeze: false };
  let ac = null, node = null, inBus = null, master = null, mic = null, timer = null, next = 0, step = 0;
  let source = "phrase", last = null, on = false, error = null;

  // ── sound ──
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function note(m, at, len) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.value = hz(m);
    f.type = "lowpass"; f.frequency.value = 1800;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.22, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(f); f.connect(g); g.connect(inBus); o.start(at); o.stop(at + len + 0.02);
  }
  function schedule() {
    if (!ac || source !== "phrase") return;
    while (next < ac.currentTime + 0.15) {
      const m = PHRASE[step % PHRASE.length];
      if (m != null) note(m, next, 0.22);
      step++; next += 0.25;
    }
  }
  function setSource(s) {
    source = s;
    if (mic) { mic.src.disconnect(); mic.stream.getTracks().forEach((t) => t.stop()); mic = null; }
    clearInterval(timer); timer = null;
    if (!ac) return Promise.resolve();
    if (s === "phrase") { next = ac.currentTime + 0.05; step = 0; timer = setInterval(schedule, 40); schedule(); return Promise.resolve(); }
    if (s === "mic") {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error("this page cannot use a microphone here"));
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        .then((stream) => { const src = ac.createMediaStreamSource(stream); src.connect(inBus); mic = { stream, src }; },
              () => { throw new Error("the microphone was refused (a page published on claude.ai cannot ask for it; open the study from Kairotic Pages)"); });
    }
    return Promise.resolve();
  }
  function send(m) { const { clear, ...rest } = m; Object.assign(p, rest); if (node) node.port.postMessage(m); }

  async function start() {
    error = null;
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") await ac.resume();
    if (!node) {
      if (!ac.audioWorklet) throw new Error("this browser has no AudioWorklet");
      await ac.audioWorklet.addModule(new URL("./ring-worklet.mjs", import.meta.url));
      node = new AudioWorkletNode(ac, "kairotic-ring", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
                                                         processorOptions: { maxSeconds: 30, opts: { ...p } } });
      node.port.onmessage = (e) => { if (e.data.state) last = e.data.state; };
      node.onprocessorerror = () => { error = "the ring~ node stopped with an error"; };
      inBus = ac.createGain(); master = ac.createGain(); master.gain.value = 0.8;
      inBus.connect(node); node.connect(master); master.connect(ac.destination);
    }
    on = true;
    await setSource(source);
  }
  function stop() {
    on = false; clearInterval(timer); timer = null;
    if (mic) { mic.src.disconnect(); mic.stream.getTracks().forEach((t) => t.stop()); mic = null; }
    if (ac) ac.suspend();
  }

  // ── drawing ──
  const C = 210, R0 = 92, AMP = 96;
  const polar = (f, r) => { const a = 2 * Math.PI * f - Math.PI / 2; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
  const head = (f, cls, label) => {
    const [x1, y1] = polar(f, R0 - 16), [x2, y2] = polar(f, R0 + AMP + 8), [lx, ly] = polar(f, R0 - 28);
    return `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="hlab ${cls}" x="${lx}" y="${ly}">${label}</text>`;
  };
  function draw() {
    const s = last;
    let svg = `<circle class="track" cx="${C}" cy="${C}" r="${R0}"/><circle class="track" cx="${C}" cy="${C}" r="${R0 + AMP}"/>`;
    if (s) {
      const n = s.peaks.length;
      let d = "";
      for (let i = 0; i < n; i++) {
        const a = Math.min(1, s.peaks[i]);
        if (a <= 0.002) continue;
        const [x1, y1] = polar((i + 0.5) / n, R0), [x2, y2] = polar((i + 0.5) / n, R0 + a * AMP);
        d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
      }
      svg += `<path class="wave${s.freeze ? " frozen" : ""}" d="${d}"/>`;
      if (s.old != null) svg += head(s.old, "ohead", "");
      svg += head(s.w, "whead", s.freeze ? "w ❄" : "w") + head(s.read, "rhead", "r");
      svg += `<text class="center" x="${C}" y="${C - 9}">d ${s.d.toFixed(3)} s</text>`;
      svg += `<text class="center soft" x="${C}" y="${C + 9}">${Math.abs(s.d - s.target) > 0.0005 ? "→ " + s.target.toFixed(3) + " s" : "keeps " + s.dur.toFixed(0) + " s"}</text>`;
    } else {
      svg += `<text class="center" x="${C}" y="${C}">press Start</text>`;
    }
    $("ring").innerHTML = svg;
    $("status").textContent = error ? "Error: " + error : on ? `sounding · ${p.mode} · d ${p.d.toFixed(2)} s${p.freeze ? " · frozen" : ""}` : "silent";
    $("status").style.color = error ? "var(--error)" : "";
    requestAnimationFrame(draw);
  }

  // ── controls ──
  function controls() {
    $("dur").value = p.dur; $("d").max = p.dur; $("d").value = p.d; $("d-v").textContent = p.d.toFixed(2) + " s";
    document.querySelectorAll("input[name=head]").forEach((el) => { el.checked = el.value === p.mode; });
    $("rate").value = p.rate; $("rate-v").textContent = p.rate.toFixed(2);
    $("jump").value = p.jump; $("xfade").value = Math.round(p.xfade * 1000);
    $("interp").value = p.interp; $("feedback").value = p.feedback; $("fb-v").textContent = p.feedback.toFixed(2);
    $("mix").value = p.mix; $("mix-v").textContent = p.mix.toFixed(2); $("freeze").checked = p.freeze; $("source").value = source;
    $("rate-group").hidden = p.mode === "seek"; $("seek-group").hidden = p.mode === "tape";
    $("start").textContent = on ? "■ Stop" : "▶ Start";
  }
  $("keys").innerHTML = KEYS.map((k, i) =>
    `<button type="button" class="${BLACK.has(i % 12) ? "black" : ""}" data-key="${60 + i}" aria-label="MIDI ${60 + i}">${k}</button>`).join("");
  function press(m) {
    if (!ac || !on) return;
    note(m, ac.currentTime + 0.005, 0.4);
    const b = document.querySelector(`[data-key="${m}"]`);
    if (b) { b.classList.add("down"); setTimeout(() => b.classList.remove("down"), 140); }
  }
  const num = (el, lo, hi, dflt) => { const v = parseFloat(el.value); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt; };
  $("keys").addEventListener("pointerdown", (e) => { const b = e.target.closest("[data-key]"); if (b) { e.preventDefault(); press(+b.dataset.key); } });
  document.addEventListener("keydown", (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    const i = KEYS.indexOf(e.key); if (i >= 0) { e.preventDefault(); press(60 + i); }
  });
  $("start").addEventListener("click", () => {
    (on ? Promise.resolve(stop()) : start()).catch((e) => { error = e.message || String(e); on = false; }).then(controls);
  });
  $("source").addEventListener("change", (e) => { setSource(e.target.value).catch((err) => { error = err.message || String(err); }); });
  $("dur").addEventListener("change", (e) => { const v = num(e.target, 1, 30, 8); send({ dur: v }); if (p.d > v - 0.01) send({ d: Math.max(0, v - 0.01) }); controls(); });
  $("d").addEventListener("input", (e) => { send({ d: num(e.target, 0, p.dur, p.d) }); $("d-v").textContent = p.d.toFixed(2) + " s"; });
  document.querySelectorAll("input[name=head]").forEach((el) => el.addEventListener("change", (e) => { send({ mode: e.target.value }); controls(); }));
  $("rate").addEventListener("input", (e) => { send({ rate: num(e.target, 0.05, 4, 1) }); $("rate-v").textContent = p.rate.toFixed(2); });
  $("jump").addEventListener("change", (e) => send({ jump: num(e.target, 0, 30, 0.25) }));
  $("xfade").addEventListener("change", (e) => send({ xfade: num(e.target, 1, 500, 30) / 1000 }));
  $("interp").addEventListener("change", (e) => send({ interp: e.target.value }));
  $("feedback").addEventListener("input", (e) => { send({ feedback: num(e.target, 0, 0.95, 0) }); $("fb-v").textContent = p.feedback.toFixed(2); });
  $("mix").addEventListener("input", (e) => { send({ mix: num(e.target, 0, 1, 0.6) }); $("mix-v").textContent = p.mix.toFixed(2); });
  $("freeze").addEventListener("change", (e) => send({ freeze: e.target.checked }));
  document.addEventListener("click", (e) => { if (e.target.closest("[data-act=clear]")) send({ clear: true }); });

  controls();
  draw();                                        // the first drawing at once; then every frame
  window.kairoticRingAudio = { state: () => last, params: () => ({ ...p }), node: () => node, context: () => ac, on: () => on, error: () => error };
}
