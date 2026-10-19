;; pitch~ · the pitch of a sound, by YIN
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…), with its AudioWorklet inside.
(let [worklet "class KairoticYin extends AudioWorkletProcessor {
  // YIN (de Cheveigné & Kawahara, 2002) on the last W samples, every `hop` samples: the period whose
  // cumulative mean normalized difference first falls under the threshold (refined by a parabola),
  // between lo and hi Hz. Hands {hz, clarity, rms}; hz 0 where it finds no pitch or hears silence.
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.W = 1024; this.hop = p.hop || 1024; this.count = 0;
    this.set(p.lo || 60, p.hi || 1500, p.threshold || 0.15);
    this.port.onmessage = (e) => { const d = e.data || {}; this.set(d.lo || this.lo, d.hi || this.hi, d.threshold || this.th); };
  }
  set(lo, hi, th) {
    this.lo = Math.max(20, Math.min(lo, hi)); this.hi = Math.max(this.lo + 1, hi); this.th = Math.max(0.01, Math.min(0.9, th));
    this.T = Math.min(4096, Math.ceil(sampleRate / this.lo) + 1);
    this.tmin = Math.max(2, Math.floor(sampleRate / this.hi));
    this.N = this.W + this.T + 1;
    this.ring = new Float32Array(this.N); this.buf = new Float32Array(this.N); this.d = new Float32Array(this.T + 2);
    this.w = 0;
  }
  analyse() {
    const N = this.N, b = this.buf, r = this.ring, W = this.W, T = this.T, d = this.d;
    for (let i = 0; i < N; i++) b[i] = r[(this.w + i) % N];
    let e = 0; for (let i = N - W; i < N; i++) e += b[i] * b[i];
    const rms = Math.sqrt(e / W);
    if (rms < 0.002) return { hz: 0, clarity: 0, rms };
    // the difference function, stopped as soon as the first dip under the threshold has its minimum
    d[0] = 1; let sum = 0, best = -1;
    for (let tau = 1; tau <= T; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const x = b[j] - b[j + tau]; s += x * x; }
      sum += s; d[tau] = sum > 0 ? s * tau / sum : 1;
      if (tau - 1 >= this.tmin && d[tau - 1] < this.th && d[tau] >= d[tau - 1]) { best = tau - 1; break; }
    }
    if (best < 1) return { hz: 0, clarity: 0, rms };
    let t = best;
    const a = d[best - 1], c = d[best], z = d[best + 1], den = a + z - 2 * c;
    if (den > 0) t = best + (a - z) / (2 * den);
    return { hz: sampleRate / t, clarity: Math.max(0, Math.min(1, 1 - c)), rms };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    const n = ch ? ch.length : 128;
    for (let i = 0; i < n; i++) {
      this.ring[this.w] = ch ? ch[i] : 0;
      this.w = (this.w + 1) % this.N;
      if (++this.count >= this.hop) {
        this.count = 0;
        const r = this.analyse();
        this.port.postMessage({ hz: r.hz, clarity: r.clarity, rms: r.rms, at: currentTime + (i + 1) / sampleRate });
      }
    }
    return true;
  }
}
registerProcessor('kairotic-yin', KairoticYin);
"
      ;; what it says between a pitch it heard and the last one it sent: a change of more than a tenth of a cent
      changed? (fn [a b] (or (nil? a) (nil? b) (zero? a) (> (js/Math.abs (- (api/hz->midi b) (api/hz->midi a))) 0.001)))
      label (fn [hz]
              (if (and (number? hz) (pos? hz))
                (let [m (api/hz->midi hz) r (js/Math.round m) c (js/Math.round (* 100 (- m r)))]
                  (str (api/midi-name r) " " (if (neg? c) "" "+") c "¢"))
                "–"))]
  {;; ── about ──
   :class "pitch~"
   :license "MPL-2.0"
   :doc "The pitch of the signal on its left, by YIN, every 1024 samples (about 21 ms): its frequency in Hz on the left, when it finds one between lo and hi (60 and 1500 by default), and 0 once when it no longer does (silence, noise, a chord); how clearly it is periodic (0…1) on the right. It sends only what changed. threshold (0.15) is how strict it is: lower finds fewer pitches, surer ones. Into ftom (Hz → MIDI pitch), a synth~, or a faust~."
   :usage "pitch~ [lo hi] [threshold]"
   :io [1 2]
   :size [124 34]
   :args [[:lo 60] [:hi 1500] [:threshold 0.15]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state]}]
              (if (and (= inlet :audio) (map? value))
                (let [{:keys [hz clarity]} value
                      hz (if (and (number? hz) (pos? hz)) (/ (js/Math.round (* hz 100)) 100) 0)
                      cl (/ (js/Math.round (* 100 (or clarity 0))) 100)
                      last-hz (:hz state)
                      send-hz (cond (pos? hz) (when (changed? last-hz hz) hz)
                                    (and last-hz (pos? last-hz)) 0)
                      outs (cond-> []
                             (some? send-hz) (conj [0 send-hz])
                             (not= cl (:clarity state)) (conj [1 cl]))]
                  (if (seq outs)
                    {:state {:hz (if (some? send-hz) send-hz last-hz) :clarity cl} :out outs :show {:hz hz :clarity cl}}
                    {}))
                {}))

   ;; ── view ──
   :derive (fn [{:keys [shown]}]
             (let [hz (:hz shown)]
               {:note (label hz)
                :hz (if (and (number? hz) (pos? hz)) (str (api/nice hz) " Hz") "")
                :bar (* 116 (api/clamp (or (:clarity shown) 0) 0 1))}))
   :view [[:rect {:x 2 :y 2 :w 120 :h 30 :r 3 :stroke :grid :fill :bg}]
          [:rect {:x 4 :y 28 :w :$bar :h 2 :r 1 :stroke nil :fill :accent}]
          [:text {:x 6 :y 20 :size 13} :$note]
          [:text {:x 118 :y 20 :anchor :end :size 9 :fill :soft} :$hz]]

   ;; ── audio ──
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac)
                           args (:args b)
                           [lo hi th] (api/padded args [60 1500 0.15])
                           node {:in in :w (atom nil) :alive (atom true) :inlets [[in 0]] :outlets []}]
                       (-> (api/worklet-node ac "kairotic-yin" worklet
                                             {:numberOfInputs 1 :numberOfOutputs 0 :channelCount 1 :channelCountMode "explicit"
                                              :processorOptions {:lo lo :hi hi :threshold th}})
                           (.then (fn [w]
                                    (if @(:alive node)
                                      (do (set! (.. w -port -onmessage)
                                                (fn [e] (let [d (.-data e)]
                                                          (when @(:alive node)
                                                            (api/report! (:id b) {:hz (.-hz d) :clarity (.-clarity d)} (.-at d))))))
                                          (.connect in w)
                                          (reset! (:w node) w))
                                      (try (.disconnect w) (catch :default _ nil)))))
                           (.catch (fn [e] (js/console.error "pitch~" e))))
                       node))
           ;; a new text: new limits, without a new worklet
           :update (fn [node b _]
                     (when-let [w @(:w node)]
                       (let [[lo hi th] (api/padded (:args b) [60 1500 0.15])]
                         (.postMessage (.-port w) #js {:lo lo :hi hi :threshold th}))))
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (try (.disconnect (:in node)) (catch :default _ nil)))}})
