;; adsr~ · an envelope that follows a gate
;; Part of @kairotic/synth. Written against the Kairotic API (api/…), with its AudioWorklet inside.
(let [;; ── the worklet: a linear envelope, one value per sample ──
      worklet "class KairoticAdsr extends AudioWorkletProcessor {
  // An envelope that follows a gate: the input signal plus the gate parameter. Above 0 it attacks
  // (to the gate's level, from wherever it is), decays to sustain × that level and stays; at 0 it
  // releases from wherever it is. Times in seconds, every segment linear.
  static get parameterDescriptors() {
    return [{ name: 'gate', defaultValue: 0 },
            { name: 'a', defaultValue: 0.01, minValue: 0, automationRate: 'k-rate' },
            { name: 'd', defaultValue: 0.1, minValue: 0, automationRate: 'k-rate' },
            { name: 's', defaultValue: 0.7, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
            { name: 'r', defaultValue: 0.2, minValue: 0, automationRate: 'k-rate' }];
  }
  constructor() { super(); this.v = 0; this.stage = 0; this.on = false; this.peak = 1; this.rel = 0; }
  process(inputs, outputs, params) {
    const inp = inputs[0] && inputs[0][0], o = outputs[0][0], gp = params.gate;
    const sr = sampleRate, a = params.a[0], d = params.d[0], s = params.s[0], r = params.r[0];
    for (let i = 0; i < o.length; i++) {
      const g = (inp ? inp[i] : 0) + (gp.length > 1 ? gp[i] : gp[0]);
      if (g > 0 && !this.on) { this.on = true; this.peak = g; this.stage = 1; }
      else if (g <= 0 && this.on) { this.on = false; this.stage = 4; this.rel = this.v / Math.max(1, r * sr); }
      if (this.stage === 1) {
        this.v += this.peak / Math.max(1, a * sr);
        if (this.v >= this.peak) { this.v = this.peak; this.stage = 2; }
      } else if (this.stage === 2) {
        const lo = s * this.peak;
        this.v -= (this.peak - lo) / Math.max(1, d * sr);
        if (this.v <= lo) { this.v = lo; this.stage = 3; }
      } else if (this.stage === 3) {
        this.v = s * this.peak;
      } else if (this.stage === 4) {
        this.v -= this.rel;
        if (this.v <= 0) { this.v = 0; this.stage = 0; }
      }
      o[i] = this.v;
    }
    return true;
  }
}
registerProcessor('kairotic-adsr', KairoticAdsr);
"
      default [10 100 0.7 200]
      shape-of (fn [v] (when (and (sequential? v) (= 4 (count v)) (every? number? v))
                         (let [[a d s r] v]
                           [(api/clamp a 0 20000) (api/clamp d 0 20000) (api/clamp s 0 1) (api/clamp r 0 20000)])))
      written (fn [args] (shape-of (api/padded args default)))
      current (fn [{:keys [shown state args]}]
                (or (shape-of shown) (shape-of state)
                    (if (map? args) (shape-of [(:a args) (:d args) (:s args) (:r args)]) (written args))
                    default))
      ;; ── view: the envelope in a 148 × 64 box; the sustain is held for a quarter of the rest ──
      x0 6 x1 142 top 8 bottom 46
      points (fn [[a d s r]]
               (let [total (max 1 (+ a d r)) hold (* 0.25 total)
                     k (/ (- x1 x0) (+ total hold))
                     xa (+ x0 (* k a)) xd (+ xa (* k d)) xs (+ xd (* k hold)) xr (+ xs (* k r))
                     ys (- bottom (* s (- bottom top)))]
                 [[x0 bottom] [xa top] [xd ys] [xs ys] [xr bottom]]))
      ms (fn [x] (if (>= x 1000) (str (api/nice (/ x 1000)) "s") (str (js/Math.round x))))
      set-shape! (fn [node [a d s r] at]
                   (when-let [w @(:worklet node)]
                     (doseq [[k v] [["a" (/ a 1000)] ["d" (/ d 1000)] ["s" s] ["r" (/ r 1000)]]]
                       (.setValueAtTime (api/param w k) v at))))]
  {;; ── about ──
   :class "adsr~"
   :license "MPL-2.0"
   :doc "An envelope that follows a gate, for the factor of a gain~. On the left a gate: a signal (reader~ … gate) or numbers (above 0 it attacks to that level, 0 releases); a bang plays attack and decay and then releases. A list [a d s r] changes its shape (a, d, r in ms; s, the sustain, from 0 to 1), and so does dragging over it: attack, decay and release sideways, sustain up and down (⇧ finer); on release the new shape is written in the box."
   :usage "adsr~ [a d s r]"
   :io [1 1]
   :size [148 64]

   ;; ── arguments ──
   :args [[:a 10] [:d 100] [:s 0.7] [:r 200]]
   :persist (fn [[a d s r]] {:a a :d d :s s :r r})

   ;; ── logic ──
   :receive (fn [{:keys [value] :as m}]
              (let [sh (current m)]
                (cond
                  (shape-of value) (let [v (shape-of value)] {:state v :show v :effects [[:shape v]]})
                  (= value :bang) {:state sh :show sh :effects [[:bang sh]]}
                  (api/num-of value) {:state sh :show sh :effects [[:gate (max 0 (api/num-of value))]]}
                  :else {:state sh :show sh})))
   :gesture (fn [{:keys [start x dx dy fine] :as m}]
              (let [[a d s r :as sh] (or (shape-of start) (current m))
                    [_ [xa] [xd] [xs]] (points sh)
                    from (- x dx) k (if fine 4 1)
                    stretch (fn [t] (js/Math.round (* (max t 1) (js/Math.pow 2 (/ dx (* 30 k))))))
                    sus (fn [] (/ (js/Math.round (* 100 (api/clamp (- s (/ dy (* 40 k))) 0 1))) 100))]
                (cond
                  (< from xa) [(stretch a) d s r]
                  (< from xd) [a (stretch d) (sus) r]
                  (< from xs) [a d (sus) r]
                  :else [a d s (stretch r)])))

   ;; ── view ──
   :derive (fn [m]
             (let [[a d s r :as sh] (current m)]
               {:pts (points sh)
                :label (str "a " (ms a) " · d " (ms d) " · s " (api/nice s) " · r " (ms r))}))
   :view [[:rect {:x 2 :y 2 :w 144 :h 60 :r 4 :stroke :grid :fill :bg}]
          [:line {:x1 6 :y1 46 :x2 142 :y2 46 :stroke :grid}]
          [:path {:points :$pts :stroke :accent :weight 1.5}]
          [:text {:x 6 :y 58 :size 9 :fill :soft} :$label]]

   ;; ── audio ──
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac) out (.createGain ac)
                           node {:in in :out out :shape (atom (or (shape-of (:state b)) (written (:args b))))
                                 :worklet (atom nil) :alive (atom true) :inlets [[in 0]] :outlets [[out 0]]}]
                       (-> (api/worklet-node ac "kairotic-adsr" worklet
                                             {:numberOfInputs 1 :numberOfOutputs 1 :outputChannelCount [1]
                                              :channelCount 1 :channelCountMode "explicit"})
                           (.then (fn [w]
                                    (when @(:alive node)
                                      (.connect in w) (.connect w out)
                                      (reset! (:worklet node) w)
                                      (set-shape! node @(:shape node) (.-currentTime ac)))))
                           (.catch (fn [e] (js/console.error "adsr~" e))))
                       node))
           ;; a new text (dragging over it rewrites it): the new shape, without rebuilding the node
           :update (fn [node b at] (let [v (written (:args b))] (reset! (:shape node) v) (set-shape! node v at)))
           :effects {:shape (fn [node v at] (reset! (:shape node) v) (set-shape! node v at))
                     :gate (fn [node g at] (when-let [w @(:worklet node)] (.setValueAtTime (api/param w "gate") g at)))
                     :bang (fn [node [a d] at]
                             (when-let [w @(:worklet node)]
                               (let [gp (api/param w "gate")]
                                 (.setValueAtTime gp 1 at)
                                 (.setValueAtTime gp 0 (+ at (/ (+ a d) 1000) 0.001)))))}
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (when-let [w @(:worklet node)] (try (.disconnect w) (catch :default _ nil))))}})
