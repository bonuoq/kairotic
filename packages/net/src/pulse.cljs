;; pulse · the room's beat: one tempo for everyone in the room, the same beat on every page
;; Part of @kairotic/net. Written against the Kairotic API (api/…). Discussion #135.
(let [room (fn [] (.-kairoticRoom js/window))]
  {;; ── about ──
   :class "pulse"
   :license "MPL-2.0"
   :doc "The room's beat, while ▶ runs: the count of each pulse (0 at the start of the tempo) on the left, on the audio clock, divided (1, beats; 2, eighths; 0.25, bars of four); on the right, the bpm when the tempo starts or changes, and 0 when it stops. The tempo is one for the whole room — the same beat on every page, from the room's clock, whatever each computer's clock says —; start [bpm], stop and bpm n (which keeps the beat where it is) change it for everyone, as the Room tab does. Outside a room it is this page's tempo."
   :usage "pulse [division]"
   :io [1 2]
   :size [96 30]
   :args [[:division 1]]
   :help {:inlets ["start [bpm] · stop · bpm n: the tempo of the whole room"]
          :outlets ["the count of each pulse, on its beat" "the bpm (0 when it stops)"]
          :example "(box :b1 \"msg start 100\" 40 30)\n(box :b2 \"msg stop\" 140 30)\n(box :b3 \"pulse\" 40 80)\n(box :b4 \"print\" 40 130)\n(connect :b1 0 :b3 0)\n(connect :b2 0 :b3 0)\n(connect :b3 0 :b4 0)"
          :try "Press ▶ and click start 100: a count every beat, a second later. In a shared room, every page with a pulse box counts the same beat."
          :see ["share" "shared" "metro" "player"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value]}]
              (cond
                (and (= inlet :audio) (number? (:count value))) {:out [[0 (:count value)]] :show {:count (:count value)}}
                (and (= inlet :audio) (contains? value :bpm)) {:out [[1 (or (:bpm value) 0)]] :show {:bpm (:bpm value)}}
                (= inlet :task) {}
                (#{:stop "stop"} value) {:effects [[:tempo [:stop]]]}
                (#{:start "start"} value) {:effects [[:tempo [:start 120]]]}
                (and (sequential? value) (#{:start "start"} (first value))) {:effects [[:tempo [:start (or (api/num-of (rest value)) 120)]]]}
                (and (sequential? value) (#{:bpm "bpm"} (first value)) (api/num-of (rest value))) {:effects [[:tempo [:bpm (api/num-of (rest value))]]]}
                :else {}))
   :tasks {:tempo (fn [[op x] _]
                    (if-let [r (room)]
                      (do (case op :start ((.-start r) x) :bpm ((.-bpm r) x) :stop ((.-stop r))) (js/Promise.resolve true))
                      (js/Promise.reject (js/Error. "pulse: this page has no room layer"))))}

   ;; ── view ──
   :derive (fn [{:keys [shown]}] {:label (cond (number? (:count shown)) (str "pulse " (:count shown))
                                               (:bpm shown) (str "pulse · " (api/nice (:bpm shown)) " bpm")
                                               :else "pulse")
                                  :dot (if (number? (:count shown)) :kairos :grid)})
   :view [[:rect {:x 1 :y 1 :w 94 :h 28 :r 3 :stroke :kairos :fill :bg}]
          [:circle {:cx 84 :cy 15 :r 5 :stroke :$dot :fill :$dot}]
          [:text {:x 8 :y 19 :size 11} :$label]]

   ;; ── outside: the room's tempo, read every 25 ms, each pulse reported 100 ms ahead on the audio clock ──
   :audio {:create (fn [ac b _]
                     (let [div (let [n (js/parseFloat (second (.split (.trim (str (:text b))) #"\s+")))] (if (and (js/isFinite n) (pos? n)) n 1))
                           node {:alive (atom true) :until (atom nil) :tempo (atom :none) :inlets [] :outlets []}
                           tick (fn []
                                  (when-let [r (room)]
                                    (let [t ((.-tempo r)) t (when t (js->clj t :keywordize-keys true)) n ((.-now r))]
                                      (when (not= t @(:tempo node))
                                        (reset! (:tempo node) t) (reset! (:until node) nil)
                                        (api/report! (:id b) {:bpm (:bpm t)} nil))
                                      (when-let [{:keys [t0 bpm]} t]
                                        (let [per (/ 60000 (* bpm div))
                                              from (max n (or @(:until node) n)) to (+ n 100)]
                                          (doseq [k (range (js/Math.ceil (/ (- from t0) per)) (inc (js/Math.floor (/ (- to t0) per))))
                                                  :let [at (+ t0 (* k per))] :when (and (>= k 0) (>= at from) (< at to))]
                                            (api/report! (:id b) {:count k} (+ (.-currentTime ac) (/ (- at n) 1000))))
                                          (reset! (:until node) to))))))
                           timer (js/setInterval (fn [] (when @(:alive node) (tick))) 25)]
                       (assoc node :timer timer)))
           :dispose (fn [node] (reset! (:alive node) false) (js/clearInterval (:timer node)))}})
