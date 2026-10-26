;; shift~ · pitch shifting in real time, one interval or a whole chord, with the formants kept
;; Part of @kairotic/spectral. Written against the Kairotic API (api/…), with its AudioWorklet inside.
;; The shifting is stftPitchShift 2.0 by Jürgen Hock (https://github.com/jurihock/stftPitchShift, MIT),
;; compiled to WebAssembly (packages/spectral/native). The WebAssembly is not in this source, so it does
;; not weigh on the history of a work: it is the module dist/shift.mjs of this same version of the
;; package, loaded the first time a shift~ sounds, and handed to the worklet as bytes.
(let [;; ── the WebAssembly: this version of the package on npm, or the page's own copy ──
      origins ["npm:@kairotic/spectral@0.1.0/dist/shift.mjs" "kairotic/packages/spectral/shift.mjs"]
      frame 1024
      hop 128

      ;; ── the worklet ──
      ;; The library's own STFT, one frame at a time: every block in, as many out, one frame late (1024
      ;; samples, some 21 ms at 48 kHz). The factors, the transposition, the formants and the dry mix change
      ;; between frames, without a click.
      worklet "class KairoticShift extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.frame = p.frame || 1024; this.hop = p.hop || 128;
    this.chord = [1]; this.semis = 0; this.form = [0, 1, 0]; this.dryMix = 0;
    this.X = null; this.h = 0; this.vin = null; this.vout = null;
    this.port.onmessage = (e) => this.message(e.data);
    const nosys = () => 52;
    const imports = { wasi_snapshot_preview1: { fd_close: nosys, fd_seek: nosys, fd_write: nosys, proc_exit: () => {} } };
    WebAssembly.instantiate(p.wasm, imports).then((r) => {
      const X = r.instance.exports;
      if (X._initialize) X._initialize();
      this.h = X.ks_stream_new(sampleRate, this.frame, this.hop);
      if (!this.h) throw new Error('shift~: the frame must be a power of 2 and the hop must divide it');
      this.pIn = X.ks_alloc(16384); this.pOut = X.ks_alloc(16384); this.pF = X.ks_alloc(128);
      this.X = X; this.apply();
      this.port.postMessage({ ready: true, latency: X.ks_stream_latency(this.h) });
    }).catch((err) => this.port.postMessage({ error: String((err && err.message) || err) }));
  }
  message(m) {
    if (m.factors) this.chord = m.factors;
    if (typeof m.transpose === 'number') this.semis = m.transpose;
    if (m.formants) this.form = m.formants;
    if (typeof m.dry === 'number') this.dryMix = m.dry;
    this.apply();
  }
  apply() {
    const X = this.X; if (!X) return;
    const g = Math.pow(2, this.semis / 12), fs = this.chord.slice(0, 16).map((f) => f * g);
    new Float64Array(X.memory.buffer, this.pF, fs.length).set(fs);
    X.ks_stream_factors(this.h, fs.length, this.pF);
    X.ks_stream_formants(this.h, this.form[0] / 1000, this.form[1], this.form[2] ? 1 : 0);
    X.ks_stream_dry(this.h, this.dryMix);
  }
  views() {
    const X = this.X;
    if (!this.vin || this.vin.buffer !== X.memory.buffer) {
      this.vin = new Float32Array(X.memory.buffer, this.pIn, 4096);
      this.vout = new Float32Array(X.memory.buffer, this.pOut, 4096);
    }
  }
  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0], X = this.X;
    if (!out || !out.length) return true;
    const n = out[0].length;
    if (!X) { for (const c of out) c.fill(0); return true; }
    for (let o = 0; o < n; o += 4096) {
      this.views();
      const k = Math.min(4096, n - o);
      // the input as one channel
      for (let i = 0; i < k; i++) {
        let s = 0;
        if (inp) for (let c = 0; c < inp.length; c++) s += inp[c][o + i];
        this.vin[i] = inp && inp.length > 1 ? s / inp.length : s;
      }
      X.ks_stream_process(this.h, this.pIn, this.pOut, k);
      // (the memory of the WebAssembly may have grown during the call: its views are made again)
      this.views();
      for (const c of out) c.set(this.vout.subarray(0, k), o);
    }
    return true;
  }
}
registerProcessor('kairotic-shift', KairoticShift);
"

      ;; ── factors, read as music ──
      ;; a number is a ratio (1.5); a word is a ratio (3/2), semitones with a sign (+7, -12, +3.86, +0) or
      ;; cents (386c, -50c). Words arrive as keywords: their whole text, slash included, is (subs (str k) 1).
      factor (fn [x]
               (let [ok (fn [f] (when (and (number? f) (js/isFinite f) (pos? f) (<= f 8)) f))]
                 (cond
                   (number? x) (ok x)
                   (or (keyword? x) (string? x))
                   (let [s (if (keyword? x) (subs (str x) 1) x)]
                     (cond
                       (re-matches #"\d+(\.\d+)?/\d+(\.\d+)?" s)
                       (let [[a b] (map js/parseFloat (.split s "/"))] (when (pos? b) (ok (/ a b))))
                       (re-matches #"[+-]\d+(\.\d+)?" s) (ok (js/Math.pow 2 (/ (js/parseFloat s) 12)))
                       (re-matches #"[+-]?\d+(\.\d+)?c" s) (ok (js/Math.pow 2 (/ (js/parseFloat s) 1200)))
                       :else nil))
                   :else nil)))
      ;; a chord from a list of factors: nil if any of them is not one, or there are none or more than 16
      chord (fn [xs]
              (let [fs (map factor xs)]
                (when (and (seq xs) (<= (count xs) 16) (every? some? fs)) (vec fs))))
      from-semitones (fn [xs] (when (and (seq xs) (every? number? xs))
                                (chord (map (fn [s] (js/Math.pow 2 (/ s 12))) xs))))
      from-cents (fn [xs] (when (and (seq xs) (every? number? xs))
                            (chord (map (fn [c] (js/Math.pow 2 (/ c 1200))) xs))))
      written (fn [args] (or (chord args) [1]))

      ;; what the box keeps: the chord, the transposition, the formants [quefrency-ms timbre rms], the dry mix
      settings (fn [args state]
                 (merge {:factors (written args) :transpose 0 :formants [0 1 false] :dry 0}
                        (select-keys state [:factors :transpose :formants :dry])))
      send! (fn [node]
              (when-let [w @(:w node)]
                (let [{:keys [factors transpose formants dry]} @(:settings node)]
                  (.postMessage (.-port w) (clj->js {:factors factors :transpose transpose :formants formants :dry dry})))))
      put (fn [state args k v]
            (let [s (assoc (settings args state) k v)]
              {:state s :effects [[:settings s]]}))]
  {;; ── about ──
   :class "shift~"
   :license "MIT"
   :doc "Pitch shifting in real time: the signal on the inlet, transposed by every factor written after it at once (one interval, or a chord), one frame late (1024 samples). A factor is a ratio (1.5 or 3/2), semitones with a sign (+7, -12, +0 for the unison) or cents (386c). A list of them changes the chord; [:semitones 0 4 7] and [:cents 0 386 702] write it in those units; [:transpose st] moves every factor by st semitones, without retyping the chord (a glide); [:formants q] keeps the formants with a lifter of q ms (1 is a good start for a voice, 0 off), [:formants q t] also shifts them by t; [:rms 1] keeps the loudness; [:dry x] mixes x (0…1) of the input in. Made with stftPitchShift 2.0 by Jürgen Hock (MIT); the library warns that the formants are kept less well with several factors and with small ones."
   :usage "shift~ [factor …]"
   :io [1 1]

   ;; ── logic ──
   :receive (fn [{:keys [value state args]}]
              (let [s (settings args state)
                    head (when (vector? value) (first value))
                    more (when (vector? value) (vec (rest value)))
                    nums (fn [xs] (filterv number? xs))]
                ;; (the same value again sets what is already set: nothing that is going on changes)
                (cond
                  (= head :transpose) (if-let [t (api/num-of more)] (put s args :transpose (api/clamp t -48 48)) {:state s})
                  (= head :semitones) (if-let [c (from-semitones more)] (put s args :factors c) {:state s})
                  (= head :cents) (if-let [c (from-cents more)] (put s args :factors c) {:state s})
                  (= head :formants) (let [[q t] (nums more)]
                                       (put s args :formants
                                            [(api/clamp (or q 0) 0 20) (api/clamp (or t 1) 0.25 4) (nth (:formants s) 2)]))
                  (= head :rms) (put s args :formants
                                     (assoc (:formants s) 2 (boolean (#{1 true :on} (first more)))))
                  (= head :dry) (if-let [d (api/num-of more)] (put s args :dry (api/clamp d 0 1)) {:state s})
                  :else (if-let [c (chord (if (vector? value) value [value]))]
                          (put s args :factors c)
                          {:state s}))))

   ;; ── audio ──
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac) out (.createGain ac)
                           node {:in in :out out :w (atom nil) :alive (atom true)
                                 :settings (atom (settings (:args b) (:state b)))
                                 :inlets [[in 0]] :outlets [[out 0]]}]
                       (-> (api/import-module origins)
                           (.then (fn [S]
                                    (api/worklet-node ac "kairotic-shift" worklet
                                                      {:numberOfInputs 1 :numberOfOutputs 1 :outputChannelCount [1]
                                                       :processorOptions {:frame frame :hop hop :wasm (.wasmBytes S)}})))
                           (.then (fn [w]
                                    (set! (.. w -port -onmessage)
                                          (fn [e] (when-let [err (.. e -data -error)] (js/console.error "shift~" err))))
                                    (if @(:alive node)
                                      (do (.connect in w) (.connect w out) (reset! (:w node) w) (send! node))
                                      (try (.disconnect w) (catch :default _ nil)))))
                           (.catch (fn [e] (js/console.error "shift~" e))))
                       node))
           :effects {:settings (fn [node s _] (reset! (:settings node) s) (send! node))}
           ;; a new text: its chord, without rebuilding the node (what came by messages besides the chord stays)
           :update (fn [node b _] (swap! (:settings node) assoc :factors (written (:args b))) (send! node))
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (when-let [w @(:w node)] (try (.disconnect w) (catch :default _ nil))))}

   ;; ── help ──
   :help {:inlets ["a signal to shift; a number or a list of factors (1.5 · 1 5/4 3/2 · +7 · 386c) is the chord; [:semitones …] [:cents …]; [:transpose st]; [:formants q t]; [:rms 1]; [:dry x]"]
          :outlets ["the shifted signal, every factor at once, one frame (1024 samples) late"]
          :example "(box :b1 \"adc~ 1\" 40 30)\n(box :b2 \"shift~ 1 5/4 3/2\" 40 150)\n(box :b3 \"dac~ 1 2\" 40 210)\n(box :b4 \"msg 1 6/5 3/2\" 160 30)\n(box :b5 \"msg transpose -5\" 160 70)\n(box :b6 \"msg formants 1\" 300 30)\n(box :b7 \"msg 1/2 +7\" 300 70)\n(connect :b1 0 :b2 0)\n(connect :b4 0 :b2 0)\n(connect :b5 0 :b2 0)\n(connect :b6 0 :b2 0)\n(connect :b7 0 :b2 0)\n(connect :b2 0 :b3 0)\n(connect :b2 0 :b3 1)"
          :try "Press ▶ and sing or play into the microphone: a major triad answers. Press the messages while it sounds: a minor triad, the whole chord a fourth down, the formants kept (a voice stops sounding small or big), an octave below and a fifth above. Use headphones."}})
