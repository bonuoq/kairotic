;; gendy~ · a dynamic stochastic oscillator, after Iannis Xenakis's GENDY
;; Part of @kairotic/synth. Written against the Kairotic API (api/…), with its AudioWorklet inside.
;; After GendyJS by Andrew Bernstein (https://github.com/abbernie/gendy, MIT License).
(let [;; ── the worklet ──
      ;; A waveform of n breakpoints. Each breakpoint keeps its own amplitude and its own duration, and
      ;; both take a random walk between mirror barriers every time the wave passes through it: the
      ;; wave repeats almost the same from one cycle to the next and is reshaped little by little, so
      ;; it is heard as a pitch that drifts and a timbre that changes. Between breakpoints, linear.
      worklet "class KairoticGendy extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'freq', defaultValue: 220, minValue: 0.01, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'xStep', defaultValue: 10, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'yMin', defaultValue: -0.15, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'yMax', defaultValue: 0.15, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'yStep', defaultValue: 0.05, minValue: 0, maxValue: 2, automationRate: 'k-rate' }
    ];
  }
  constructor(options) {
    super();
    const p = options.processorOptions || {};
    this.size(p.breakpoints || 16);
    this.value = 0; this.next = 0; this.left = 0; this.length = 1; this.index = 0;
    // a high-pass of one pole (about 5 Hz): no offset reaches the output, even with y-min and y-max apart
    this.r = 1 - 2 * Math.PI * 5 / sampleRate; this.x1 = 0; this.y1 = 0;
    this.port.onmessage = (e) => this.size(e.data);
  }
  // n breakpoints. Changing it keeps the wave: the new ones are read from the old ones, and the segment
  // under way ends where it was going, so there is no click.
  size(k) {
    const n = Math.max(2, Math.min(128, k | 0 || 16));
    if (this.amps && n === this.amps.length) return;
    const amps = new Float32Array(n), durs = new Float32Array(n).fill(1);
    if (this.amps) {
      const m = this.amps.length;
      for (let i = 0; i < n; i++) { const j = Math.floor(i * m / n); amps[i] = this.amps[j]; durs[i] = this.durs[j]; }
      this.index = Math.floor(this.index * n / m) % n;
    }
    this.amps = amps; this.durs = durs;
  }
  mirror(v, lo, hi) {
    const r = hi - lo; if (r <= 0) return lo;
    let t = (v - lo) % (2 * r); if (t < 0) t += 2 * r;
    return lo + (t > r ? 2 * r - t : t);
  }
  process(inputs, outputs, p) {
    const out = outputs[0][0], fm = inputs[0] && inputs[0][0], sr = sampleRate;
    const lo = Math.min(p.yMin[0], p.yMax[0]), hi = Math.max(p.yMin[0], p.yMax[0]);
    const x = Math.max(0, Math.min(95, p.xStep[0])) / 100, step = Math.max(0, p.yStep[0]);
    const base = p.freq[0];
    for (let i = 0; i < out.length; i++) {
      // (a segment shorter than a sample: several breakpoints pass within one, so the pitch keeps rising)
      while (this.left <= 0) {
        const n = this.amps.length, a = (this.index + 1) % n, b = (a + 1) % n;
        this.index = a;
        // the breakpoint the wave reaches now walks, and so does the duration of the segment that leaves it
        this.amps[b] = this.mirror(this.amps[b] + (Math.random() * 2 - 1) * step, lo, hi);
        this.durs[a] = this.mirror(this.durs[a] + (Math.random() * 2 - 1) * x * 0.3, 1 - x, 1 + x);
        this.value = this.next;
        this.next = this.amps[b];
        // a signal on the inlet adds to the frequency, in Hz (frequency modulation)
        const f = Math.max(0.01, base + (fm ? fm[i] : 0));
        this.length = Math.max(0.05, sr / f / n * this.durs[a]);
        // what the last segment overran is taken from this one: the period keeps its fraction of a sample
        this.left += this.length;
      }
      const s = this.value + (this.next - this.value) * (1 - this.left / this.length);
      const y = s - this.x1 + this.r * this.y1;
      this.x1 = s; this.y1 = y;
      out[i] = y;
      this.left--;
    }
    return true;
  }
}
registerProcessor('kairotic-gendy', KairoticGendy);
"
      default [220 10 -0.15 0.15 0.05 16]
      names {:freq 0 :x-step 1 :y-min 2 :y-max 3 :y-step 4 :breakpoints 5}
      ;; [freq x-step y-min y-max y-step breakpoints], each within its range (or nil)
      params-of (fn [v]
                  (when (and (sequential? v) (= 6 (count v)) (every? number? v))
                    (let [[f x lo hi y n] v]
                      [(api/clamp f 0.01 20000) (api/clamp x 0 100)
                       (api/clamp lo -1 1) (api/clamp hi -1 1)
                       (api/clamp y 0 2) (js/Math.round (api/clamp n 2 128))])))
      written (fn [args]
                (if (map? args)
                  (params-of (mapv (fn [[k i]] (or (get args k) (nth default i))) (sort-by val names)))
                  (params-of (api/padded args default))))
      current (fn [{:keys [shown state args]}]
                (or (params-of shown) (params-of state) (written args) default))
      set-params! (fn [node [f x lo hi y n] at]
                    (when-let [w @(:worklet node)]
                      (doseq [[k v] [["freq" f] ["xStep" x] ["yMin" lo] ["yMax" hi] ["yStep" y]]]
                        (.setValueAtTime (api/param w k) v at))
                      (.postMessage (.-port w) n)))]
  {;; ── about ──
   :class "gendy~"
   :license "MIT"
   :doc "A dynamic stochastic oscillator, after Xenakis's GENDY (and GendyJS by Andrew Bernstein, MIT): a wave of breakpoints whose amplitudes and durations each take a random walk between mirror barriers, cycle after cycle, heard as a pitch that drifts and a timbre that changes. freq in Hz (a signal on the inlet adds to it: FM); x-step (0–100 %) how far each segment's duration may wander; y-min and y-max (−1…1) the barriers of the amplitudes, y-step how far they move each cycle; breakpoints (2–128) how many. A number sets freq; [:y-step 0.2] one of them; a list of six all of them."
   :usage "gendy~ [freq x-step y-min y-max y-step breakpoints]"
   :io [1 1]

   ;; ── arguments ──
   :args [[:freq 220] [:x-step 10] [:y-min -0.15] [:y-max 0.15] [:y-step 0.05] [:breakpoints 16]]

   ;; ── logic ──
   :receive (fn [{:keys [value] :as m}]
              (let [v (current m)
                    put (fn [nv] (if-let [p (params-of nv)] {:state p :show p :effects [[:params p]]} {:state v :show v}))]
                (cond
                  (params-of value) (put value)
                  (api/num-of value) (put (assoc v 0 (api/num-of value)))
                  (and (vector? value) (= 2 (count value)) (contains? names (first value)) (number? (second value)))
                  (put (assoc v (names (first value)) (second value)))
                  :else {:state v :show v})))

   ;; ── audio ──
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac) out (.createGain ac)
                           v (current {:args (:args b) :state (:state b)})
                           node {:in in :out out :params (atom v) :worklet (atom nil) :alive (atom true)
                                 :inlets [[in 0]] :outlets [[out 0]]}]
                       (-> (api/worklet-node ac "kairotic-gendy" worklet
                                             {:numberOfInputs 1 :numberOfOutputs 1 :outputChannelCount [1]
                                              :channelCount 1 :channelCountMode "explicit"
                                              :processorOptions {:breakpoints (nth v 5)}})
                           (.then (fn [w]
                                    (when @(:alive node)
                                      (.connect in w) (.connect w out)
                                      (reset! (:worklet node) w)
                                      (set-params! node @(:params node) (.-currentTime ac)))))
                           (.catch (fn [e] (js/console.error "gendy~" e))))
                       node))
           ;; a new text: its parameters, without rebuilding the node (the wave goes on)
           :update (fn [node b at] (let [v (current {:args (:args b)})] (reset! (:params node) v) (set-params! node v at)))
           :effects {:params (fn [node v at] (reset! (:params node) v) (set-params! node v at))}
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (when-let [w @(:worklet node)] (try (.disconnect w) (catch :default _ nil))))}})
