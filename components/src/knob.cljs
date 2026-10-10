;; knob · a rotary control with its own view in the patch
{;; ── about ──────────────────────────────────────────────
 :class "knob"
 :license "MPL-2.0"
 :doc "Rotary knob: drag it up or down (⇧ for fine control). Sends its value between min and max; with log the travel is logarithmic (frequencies), and with a name it sends [:name value] (e.g. a faust~ parameter). A number sets it and sends it on; a bang sends it again."
 :usage "knob [min max initial] [log] [name]"
 :io [1 1]
 :size [72 78]

 ;; ── arguments ──────────────────────────────────────────
 ;; numbers fill min, max and initial in order; "log" is a flag; any other word is the name
 :args [[:min 0] [:max 1] [:initial :min] [:log false] [:name nil]]

 ;; ── logic ──────────────────────────────────────────────
 :receive (fn [{:keys [state args value]}]
            (let [current (if (number? state) state (:initial args))
                  outgoing (fn [v] (if (:name args) [(:name args) v] v))]
              (cond
                (number? value) (let [v (comp/clamp value (:min args) (:max args))]
                                  {:state v :out [[0 (outgoing v)]] :show v})
                (= value :bang) {:state current :out [[0 (outgoing current)]] :show current}
                :else {:state current})))

 :gesture (fn [{:keys [start args dy fine]}]
            (let [{lo :min hi :max log? :log} args
                  u (comp/to-unit (if (number? start) start (:initial args)) lo hi log?)]
              (comp/from-unit (- u (/ dy (if fine 800 160))) lo hi log?)))

 ;; values for the holes of the view
 :derive (fn [{:keys [shown args]}]
           (let [{lo :min hi :max log? :log} args
                 v (if (number? shown) shown (:initial args))]
             {:angle (+ -135 (* 270 (comp/to-unit v lo hi log?)))
              :label (str (when (:name args) (str (name (:name args)) " ")) (comp/nice v))}))

 ;; ── view ───────────────────────────────────────────────
 :view [[:arc    {:cx 36 :cy 33 :r 23 :from -135 :to 135 :stroke :grid :weight 5}]
        [:arc    {:cx 36 :cy 33 :r 23 :from -135 :to :$angle :stroke :accent :weight 5}]
        [:circle {:cx 36 :cy 33 :r 16 :stroke :soft :fill :bg}]
        [:needle {:cx 36 :cy 33 :r0 5 :r 17 :angle :$angle :stroke :ink :weight 2.5}]
        [:text   {:x 36 :y 72 :anchor :middle :size 11} :$label]]}
