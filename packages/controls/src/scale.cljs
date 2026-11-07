;; scale · a number from one range to another, straight or logarithmic, smoothed if asked
;; Part of @kairotic/controls. Written against the Kairotic API (api/…). Discussion #135.
(let [lin (fn [v a b] (if (== a b) 0 (/ (- v a) (- b a))))
      out-of (fn [u {:keys [out-lo out-hi log]}]
               (let [u (api/clamp u 0 1)]
                 (if (and log (pos? out-lo) (pos? out-hi))
                   (* out-lo (js/Math.pow (/ out-hi out-lo) u))
                   (+ out-lo (* u (- out-hi out-lo))))))
      ;; the number in a message: a number, the last number of a list ([:lx 0.3] from gamepad), or :value of a map
      number-in (fn [v] (cond (number? v) v
                              (map? v) (let [x (:value v)] (when (number? x) x))
                              (sequential? v) (let [x (last v)] (when (number? x) x))
                              :else nil))
      tick 0.02]
  {;; ── about ──
   :class "scale"
   :license "MPL-2.0"
   :doc "A number from one range (in-lo…in-hi, 0…1 by default) to another (out-lo…out-hi): straight, or with log in equal ratios (for frequencies, a cutoff, a speed: equal moves are equal intervals); clipped to the range, and reversed when out-hi is under out-lo. With ms, it glides there in that time (a jumpy sensor made smooth). It takes a number, a list whose last element is the number ([:lx 0.3] from gamepad), or a map with :value. learn: the next values it gets make the input range (move the controller from end to end), learn off stops. Between a controller (control, knob, motion…) and whatever it moves."
   :usage "scale [in-lo in-hi out-lo out-hi] [log] [ms]"
   :io [1 1]
   :size [130 24]
   :args [[:in-lo 0] [:in-hi 1] [:out-lo 0] [:out-hi 1] [:log false] [:ms 0]]
   :help {:inlets ["a number (or [name value], or {:value v}); learn; learn off"]
          :outlets ["the number in the new range"]
          :messages [["learn" "the next values make the input range"] ["learn off" "keeps the range learnt"]]
          :example "(box :b1 \"knob\" 40 30)\n(box :b2 \"scale 0 1 220 880 log 200\" 40 120)\n(box :b3 \"number\" 40 160)\n(connect :b1 0 :b2 0)\n(connect :b2 0 :b3 0)"
          :try "Turn the knob: 220 to 880 Hz in equal steps of pitch, gliding 200 ms."
          :see ["control" "knob" "mtof"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [st (or state {})
                    lo (or (:lo st) (:in-lo args)) hi (or (:hi st) (:in-hi args))
                    ms (max 0 (:ms args))]
                (cond
                  (#{:learn "learn"} value) {:state (assoc st :learning true :lo nil :hi nil :seen nil) :show {:learn true}}
                  (and (sequential? value) (#{:learn "learn"} (first value)) (#{:off "off" 0} (second value)))
                  {:state (dissoc st :learning) :show {:learn false}}
                  ;; a glide: one step of it, scheduled to itself
                  (and (= inlet 0) (vector? value) (= :scale-step (first value)))
                  (let [[_ gen] value]
                    (if (and (= gen (:gen st)) (:target st))
                      (let [k (min 1 (/ tick (max 0.001 (/ ms 1000))))
                            cur (+ (:cur st) (* k (- (:target st) (:cur st))))
                            done (< (js/Math.abs (- (:target st) cur)) (* 1e-4 (max 1 (js/Math.abs (:target st)))))
                            cur (if done (:target st) cur)]
                        (cond-> {:state (assoc st :cur cur) :out [[0 (api/nice cur)]] :show {:v cur}}
                          (not done) (assoc :later [[(+ at tick) 0 [:scale-step gen]]])))
                      {:state st}))
                  :else
                  (if-let [v (number-in value)]
                    (let [st (if (:learning st)
                               (let [s (vec (take-last 512 (conj (or (:seen st) []) v)))]
                                 (assoc st :seen s :lo (apply min s) :hi (apply max s)))
                               st)
                          lo (or (:lo st) (:in-lo args)) hi (or (:hi st) (:in-hi args))
                          target (out-of (lin v lo hi) args)]
                      (if (and (pos? ms) (number? (:cur st)))
                        (let [gen (inc (or (:gen st) 0))]
                          {:state (assoc st :target target :gen gen) :later [[(+ at tick) 0 [:scale-step gen]]] :show {:v (:cur st)}})
                        {:state (assoc st :cur target :target target) :out [[0 (api/nice target)]] :show {:v target}}))
                    {:state st}))))

   ;; ── view ──
   :derive (fn [{:keys [shown args]}]
             {:label (str (if (:learn shown) "learning… " "")
                          (api/nice (:in-lo args)) "…" (api/nice (:in-hi args)) " → " (api/nice (:out-lo args)) "…" (api/nice (:out-hi args))
                          (when (:log args) " log"))
              :w (* 126 (api/clamp (if (number? (:v shown)) (lin (:v shown) (:out-lo args) (:out-hi args)) 0) 0 1))})
   :view [[:rect {:x 1 :y 1 :w 128 :h 22 :r 3 :stroke :accent :fill :bg}]
          [:rect {:x 2 :y 19 :w :$w :h 3 :r 1 :stroke nil :fill :accent}]
          [:text {:x 6 :y 15 :size 10.5} :$label]]})
