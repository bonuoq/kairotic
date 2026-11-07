;; shared · what is shared in the room on a channel
;; Part of @kairotic/net. Written against the Kairotic API (api/…). Discussion #135.
(let [room (fn [] (.-kairoticRoom js/window))]
  {;; ── about ──
   :class "shared"
   :license "MPL-2.0"
   :doc "What anyone in the room shares on a channel (main if none) with a share box — this page included —, while ▶ runs: the value on the left, the name of who shared it on the right. A midiin on one page and a shared box feeding synth~ on another is playing someone else's instrument; an event map from motion on a phone moves a knob on the computer."
   :usage "shared [channel]"
   :io [0 2]
   :size [96 30]
   :args [[:channel nil]]
   :help {:inlets []
          :outlets ["the value shared" "who shared it"]
          :example "(box :b1 \"shared notes\" 40 30)\n(box :b2 \"synth~\" 40 80)\n(box :b3 \"dac~\" 40 130)\n(connect :b1 0 :b2 0)\n(connect :b2 0 :b3 0)\n(connect :b2 0 :b3 1)"
          :try "In a shared room, press ▶: what someone sends to a share notes box, you hear."
          :see ["share" "pulse"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value]}]
              (cond
                (and (= inlet :audio) (contains? value :v))
                {:out [[1 (str (:from value))] [0 (:v value)]] :show {:label (str (:from value) " → " (let [s (pr-str (:v value))] (if (> (count s) 10) (str (subs s 0 9) "…") s)))}}
                (and (= inlet :audio) (:error value)) {:effects [[:print (:error value)]]}
                :else {}))

   ;; ── view ──
   :derive (fn [{:keys [shown args]}] {:label (or (:label shown) (str "shared " (if (:channel args) (name (:channel args)) "main")))})
   :view [[:rect {:x 1 :y 1 :w 94 :h 28 :r 3 :stroke :kairos :fill :bg}]
          [:text {:x 8 :y 19 :size 11} :$label]]

   ;; ── outside: the room's channel, while ▶ runs ──
   :audio {:create (fn [_ b _]
                     (let [ch (or (second (.split (.trim (str (:text b))) #"\s+")) "main")
                           node {:alive (atom true) :inlets [] :outlets []}]
                       (if-let [r (room)]
                         (assoc node :off ((.-onShare r) ch (fn [v from] (when @(:alive node) (api/report! (:id b) {:v v :from from} nil)))))
                         (do (api/report! (:id b) {:error "shared: this page has no room layer"} nil) (assoc node :off (fn [] nil))))))
           :dispose (fn [node] (reset! (:alive node) false) ((:off node)))}})
