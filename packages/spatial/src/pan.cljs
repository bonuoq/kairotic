;; pan~ · stereo panning with equal power
;; Part of @kairotic/spatial. Written against the Kairotic API (api/…).
{;; ── about ──
 :class "pan~"
 :license "MPL-2.0"
 :doc "Stereo panning with equal power: signal on the left inlet, position on the right (−1 left … 1 right). Two outlets: left and right."
 :usage "pan~ [position]"
 :io [2 2]

 ;; ── arguments ──
 :args [[:position 0]]

 ;; ── logic ──
 :receive (fn [{:keys [inlet value]}]
            (if (and (= 1 inlet) (api/num-of value))
              {:effects [[:pan (api/clamp (api/num-of value) -1 1)]] :show (api/num-of value)}
              {}))

 ;; ── audio ──
 :audio {:create (fn [ac b _]
                   (let [p (.createStereoPanner ac)]
                     (set! (.. p -pan -value) (api/clamp (first (api/padded (:args b) [0])) -1 1))
                     {:p p :inlets [[p 0]] :outlets (api/stereo-outlets ac p)}))
         :effects {:pan (fn [node x at] (.setTargetAtTime (.-pan (:p node)) x at 0.01))}
         ;; a new text: the new position, without rebuilding the node
         :update (fn [node b at] (.setTargetAtTime (.-pan (:p node)) (api/clamp (first (api/padded (:args b) [0])) -1 1) at 0.01))}}
