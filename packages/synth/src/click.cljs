;; click~ · a metronome's click: a short tick each bang, louder and higher on the accents
;; Part of @kairotic/synth. Written against the Kairotic API (api/…).
;; To play along with a clock you have to hear it: a metro, the room's pulse or a necklace into click~, and
;; click~ into a dac~. Each bang is a tick (a sine that dies in a few milliseconds); every `accent` bangs one is
;; accented (a fifth higher, louder): click~ 1200 4 on a metro of sixteenths ticks them and marks the beats.
;; A number is a tick too, accented when it is 0 — what a counter sends at the start of its cycle.
(let [tick! (fn [node [accent? level] at]
              (let [ac (.-context (:out node)) o (.createOscillator ac) g (.createGain ac)
                    f (* (:freq node) (if accent? 1.5 1)) d (:decay node)
                    peak (* level (if accent? 1 0.45))]
                (set! (.-type o) "sine")
                (.setValueAtTime (.-frequency o) f at)
                (.setValueAtTime (.-gain g) 0 at)
                (.linearRampToValueAtTime (.-gain g) peak (+ at 0.002))
                (.exponentialRampToValueAtTime (.-gain g) 0.0001 (+ at d))
                (.connect o g)
                (.connect g (:out node))
                (.start o at)
                (.stop o (+ at d 0.02))))]
  {;; ── about ──
   :class "click~"
   :license "MPL-2.0"
   :doc "A metronome's click, to hear a clock while you play along with it: each bang a short tick (a sine of freq Hz that dies in decay seconds); every accent bangs (0: none) one is accented, a fifth higher and louder — click~ 1200 4 on a metro of sixteenths ticks them and marks the beats. A number is a tick too, accented when it is 0 (a counter's cycle). [:gain v] (0…1, 0.6 by default) its level; :reset counts the accents from the next bang."
   :usage "click~ [freq 1200] [accent 0] [decay 0.03]"
   :io [1 1]

   ;; ── arguments ──
   :args [[:freq 1200] [:accent 0] [:decay 0.03]]

   ;; ── logic ──
   :receive (fn [{:keys [state value args]}]
              (let [st (or state {:n 0 :level 0.6})
                    every (js/Math.round (or (:accent args) 0))]
                (cond
                  (#{:bang} value) {:state (update st :n inc)
                                    :effects [[:tick [(and (pos? every) (zero? (mod (:n st) every))) (:level st)]]]}
                  (number? value) {:state st :effects [[:tick [(zero? value) (:level st)]]]}
                  (#{:reset} value) {:state (assoc st :n 0)}
                  (and (vector? value) (#{:gain :amp} (first value)) (number? (second value)))
                  {:state (assoc st :level (api/clamp (second value) 0 1))}
                  :else {})))

   ;; ── audio ──
   :audio {:create (fn [ac b _]
                     (let [out (.createGain ac)
                           [freq _ decay] (api/padded (:args b) [1200 0 0.03])]
                       (set! (.. out -gain -value) 0.5)
                       {:outlets [[out 0]] :out out
                        :freq (api/clamp freq 50 12000)
                        :decay (api/clamp decay 0.005 1)}))
           :effects {:tick tick!}
           :dispose (fn [_] nil)}})
