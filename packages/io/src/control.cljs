;; control · one control of a controller, out of the events of midiin, gamepad, motion, oscin or serial
;; Part of @kairotic/io. Written against the Kairotic API (api/…). Discussion #135.
(let [num (fn [s] (let [n (js/parseFloat s)] (when (js/isFinite n) n)))
      ;; an OSC address pattern, only * and ? (the rest as it is)
      osc-re (fn [p] (js/RegExp. (str "^" (-> p (.replace (js/RegExp. "[.+^${}()|[\\]\\\\]" "g") "\\$&") (.replaceAll "*" "[^/]*") (.replaceAll "?" "[^/]")) "$")))
      ;; the spec, from the words after the class: [kind & words]
      ;; (a word such as /synth/cut is read as a keyword with an empty namespace: put its / back)
      spec-of (fn [args] (mapv (fn [a] (cond (and (keyword? a) (re-find #"/" (str a))) (subs (str a) 1)
                                             (keyword? a) (name a)
                                             :else (str a)))
                               args))
      ;; the value of the event for the spec, or nil if the event is not that control
      pick (fn [[kind a b] e]
             (case kind
               "cc" (when (and (= :cc (:type e)) (= (num a) (:cc e)) (or (nil? b) (= (num b) (:ch e)))) (:value e))
               "note" (when (and (= :note (:type e)) (or (nil? a) (= (num a) (:note e))))
                        (if (:gate e) (or (:amp e) 1) 0))
               "bend" (when (= :glide (:type e)) (:freq e))
               "pad" (when (and (#{:axis :button} (:type e))
                                (or (= a (some-> (:name e) name))
                                    (= a (str (if (= :axis (:type e)) "a" "b") (or (:axis e) (:button e))))))
                       (:value e))
               "tilt" (when (= :tilt (:type e)) (if (= a "y") (:y e) (:x e)))
               "shake" (when (= :shake (:type e)) (:value e))
               "osc" (when (and a (:address e) (.test (osc-re a) (:address e)))
                       (let [v (first (:args e))] (when (number? v) v)))
               "serial" (when (= :serial (:type e))
                          (cond (and (:key e) (= a (:key e))) (:value e)
                                (and (:values e) (num a)) (get (:values e) (js/Math.round (num a)))))
               nil))]
  {;; ── about ──
   :class "control"
   :license "MPL-2.0"
   :doc "One control of a controller, out of the events that midiin, gamepad, motion, oscin or serial send (on their event outlet): its value, every time it moves. cc 74 [channel] a MIDI controller (0…1); note [n] a key (its loudness on, 0 off); bend the pitch of a glided note (Hz); pad lx · pad a · pad a3 a stick or button of a gamepad (by name, or a0 b3); tilt x · tilt y a phone's tilt (0…1); shake; osc /synth/cut the first number of an OSC address (* and ? allowed); serial pot · serial 0 a board's key, or the nth number of its lines. Into scale, to bring it to the range of what it moves — which is what learn makes."
   :usage "control kind [which] [channel]"
   :io [1 1]
   :size [110 24]
   :help {:inlets ["the events of midiin, gamepad, motion, oscin or serial"]
          :outlets ["the value of that one control, when it moves"]
          :example "(box :b1 \"midiin\" 40 30)\n(box :b2 \"control cc 1\" 40 80)\n(box :b3 \"scale 0 1 200 2000 log\" 40 120)\n(box :b4 \"print\" 40 160)\n(connect :b1 2 :b2 0)\n(connect :b2 0 :b3 0)\n(connect :b3 0 :b4 0)"
          :try "Press ▶ and move the modulation wheel (CC 1) of a MIDI keyboard: 200 to 2000, in tune with the ear."
          :see ["scale" "midiin" "gamepad" "motion" "oscin"]}

   ;; ── logic ──
   :receive (fn [{:keys [value args]}]
              (if-let [v (and (map? value) (pick (spec-of args) value))]
                {:out [[0 v]] :show {:v v}}
                {}))

   ;; ── view ──
   :derive (fn [{:keys [shown args]}]
             (let [s (str "control " (apply str (interpose " " (spec-of args))))]
               {:label (if (number? (:v shown)) (str s " · " (api/nice (:v shown))) s)}))
   :view [[:rect {:x 1 :y 1 :w 108 :h 22 :r 3 :stroke :accent :fill :bg}]
          [:text {:x 6 :y 16 :size 10.5} :$label]]})
