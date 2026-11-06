;; motion · a phone's tilt and shake as Kairotic events
;; Part of @kairotic/io. Written against the Kairotic API (api/…). Discussion #135, Study 34 · io.
(let [r (fn [x d] (let [k (js/Math.pow 10 d)] (/ (js/Math.round (* x k)) k)))
      clamp (fn [x lo hi] (max lo (min hi x)))
      ;; the tilt as x (left 0 … right 1) and y (towards you 0 … away 1), both 0.5 lying flat
      tilt-xy (fn [beta gamma] [(clamp (/ (+ gamma 90) 180) 0 1) (clamp (/ (+ (clamp beta -90 90) 90) 180) 0 1)])
      mag (fn [[x y z]] (js/Math.sqrt (+ (* x x) (* y y) (* z z))))
      ;; a reading: smoothed, and sent only when it moves (sensors read ~60 times a second, moving or not);
      ;; a shake is one event, with a pause after it
      step (fn [st t rd smooth shake]
             (cond
               (number? (:gamma rd))
               (let [[tx ty] (tilt-xy (or (:beta rd) 0) (:gamma rd))
                     x (if (:x st) (+ (* smooth (:x st)) (* (- 1 smooth) tx)) tx)
                     y (if (:y st) (+ (* smooth (:y st)) (* (- 1 smooth) ty)) ty)
                     [sx sy] (:sent st) st (assoc st :x x :y y)]
                 (if (and sx (< (js/Math.abs (- x sx)) 0.004) (< (js/Math.abs (- y sy)) 0.004))
                   [st nil]
                   [(assoc st :sent [x y])
                    (cond-> {:src :motion :type :tilt :x (r x 3) :y (r y 3) :beta (r (or (:beta rd) 0) 1) :gamma (r (:gamma rd) 1)}
                      (number? (:alpha rd)) (assoc :alpha (r (:alpha rd) 1)))]))
               (or (:acc rd) (:accg rd))
               (let [m (if (:acc rd) (mag (:acc rd)) (js/Math.abs (- (mag (:accg rd)) 9.81)))]
                 (if (and (> m shake) (or (nil? (:last-shake st)) (>= (- t (:last-shake st)) 0.3)))
                   [(assoc st :last-shake t) {:src :motion :type :shake :value (r m 1)}]
                   [st nil]))
               :else [st nil]))]
  {;; ── about ──
   :class "motion"
   :license "MPL-2.0"
   :doc "A phone's (or a tablet's) motion while ▶ runs: its tilt as x (left 0 … right 1) and y (towards you 0 … away 1), both 0.5 lying flat — smoothed, and sent only when it moves —; and a shake, when it is shaken harder than shake (14 m/s²), once with a pause after it. Out: [x y], the strength of each shake, and the events ({:type :tilt :x :y :alpha :beta :gamma}, {:type :shake :value}) for oscout or a room. smooth (0.3) is how much of the last value stays at each reading. iOS asks for permission at ▶. Open the work on the phone (Share/Export, Release/Perform) to play with it."
   :usage "motion [smooth] [shake]"
   :io [0 3]
   :size [96 30]
   :args [[:smooth 0.3] [:shake 14]]
   :help {:inlets []
          :outlets ["[x y], 0…1 each, when the tilt moves" "the strength of a shake (m/s²)" "every event, as a map"]
          :example "(box :b1 \"motion\" 40 30)\n(box :b2 \"print\" 40 80)\n(connect :b1 0 :b2 0)"
          :try "Open this on a phone, press ▶, and tilt it."
          :see ["gamepad" "oscout"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (if (and (= inlet :audio) (map? value))
                (if (:error value)
                  {:effects [[:print (:error value)]] :show {:label "no motion"}}
                  (let [[st e] (step (or state {}) (or at 0) value (api/clamp (:smooth args) 0 0.95) (api/clamp (:shake args) 2 60))]
                    (cond
                      (nil? e) {:state st}
                      (= :tilt (:type e)) {:state st :out [[0 [(:x e) (:y e)]] [2 e]] :show {:x (:x e) :y (:y e)}}
                      :else {:state st :out [[1 (:value e)] [2 e]] :show (assoc (select-keys st [:x :y]) :shake true)})))
                {}))

   ;; ── view: where the tilt is ──
   :derive (fn [{:keys [shown]}] {:cx (+ 60 (* 30 (- (or (:x shown) 0.5) 0.5) 2)) :cy (+ 15 (* 10 (- 0.5 (or (:y shown) 0.5)) 2))
                                  :dot (if (:shake shown) :kairos :accent)})
   :view [[:rect {:x 1 :y 1 :w 94 :h 28 :r 3 :stroke :accent :fill :bg}]
          [:text {:x 6 :y 19 :size 10 :fill :soft} "motion"]
          [:rect {:x 46 :y 4 :w 46 :h 22 :r 2 :stroke :grid :fill :bg}]
          [:circle {:cx :$cx :cy :$cy :r 4 :stroke :$dot :fill :$dot}]]

   ;; ── outside: the sensors, while ▶ runs ──
   :audio {:create (fn [_ b _]
                     (let [node {:alive (atom true) :inlets [] :outlets []}
                           report (fn [rd] (when @(:alive node) (api/report! (:id b) rd nil)))
                           on-tilt (fn [e] (when (number? (.-gamma e)) (report {:alpha (.-alpha e) :beta (.-beta e) :gamma (.-gamma e)})))
                           on-move (fn [e] (let [a (.-acceleration e) g (.-accelerationIncludingGravity e)]
                                             (cond (and a (number? (.-x a))) (report {:acc [(.-x a) (.-y a) (.-z a)]})
                                                   (and g (number? (.-x g))) (report {:accg [(.-x g) (.-y g) (.-z g)]}))))
                           listen! (fn [] (.addEventListener js/window "deviceorientation" on-tilt)
                                     (.addEventListener js/window "devicemotion" on-move))
                           ask (some-> (.-DeviceOrientationEvent js/window) .-requestPermission)]
                       ;; iOS asks first, and only from a gesture: ▶ is one
                       (if (fn? ask)
                         (-> (ask) (.then (fn [r] (if (= r "granted") (listen!) (report {:error "motion: refused"}))))
                             (.catch (fn [e] (report {:error (str "motion: " (.-message e))}))))
                         (listen!))
                       (assoc node :off (fn [] (.removeEventListener js/window "deviceorientation" on-tilt)
                                          (.removeEventListener js/window "devicemotion" on-move)))))
           :dispose (fn [node] (reset! (:alive node) false) ((:off node)))}})
