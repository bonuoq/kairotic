;; space~ · a sound placed around the listener (binaural)
;; Part of @kairotic/spatial. Written against the Kairotic API (api/…).
(let [pos-of (fn [v] (when (and (sequential? v) (= 2 (count v)) (every? number? v))
                       [(api/clamp (first v) -1 1) (api/clamp (second v) -1 1)]))
      ;; An HRTF panner clicks whenever its position changes (it swaps filters), so space~ keeps two:
      ;; the silent one jumps to the new place and they crossfade, at most every `step` seconds; it
      ;; gets its place `settle` seconds before it is heard. A move that comes sooner waits for the
      ;; next crossfade (and the latest one wins). Measured offline: a path every 10 ms clicked 57
      ;; times in 8 s with one panner, none in 20 s like this.
      step 0.05 settle 0.01
      move! (fn [node [x y] at]
              (let [{:keys [a s]} @(:live node) pair (:pair node)
                    place! (fn [i t] (let [p (:p (pair i))]
                                       (doseq [prm [(.-positionX p) (.-positionZ p)]] (.cancelScheduledValues prm t))
                                       (.setValueAtTime (.-positionX p) (* 2 x) t)
                                       (.setValueAtTime (.-positionZ p) (* -2 y) t)))]
                (if (< at s)
                  (place! a s)                                  ; a crossfade is already waiting: move its target
                  (let [t (max at (+ s step)) b (- 1 a)]
                    (place! b t)
                    (doseq [[i v] [[b 1] [a 0]] :let [g (.-gain (:g (pair i)))]]
                      (.cancelScheduledValues g t)
                      (.setTargetAtTime g v (+ t settle) (/ step 4)))
                    (reset! (:live node) {:a b :s t})))))]
  {;; ── about ──
   :class "space~"
   :license "MPL-2.0"
   :doc "A sound placed around the listener (binaural, HRTF): drag the dot, or send [x y] (−1…1; y = 1 is in front). Two outlets: left and right, for headphones. Dragging rewrites the box."
   :usage "space~ [x y]"
   :io [1 2]
   :size [104 104]

   ;; ── arguments ──
   :args [[:x 0] [:y 1]]
   :persist (fn [[x y]] {:x x :y y})

   ;; ── logic ──
   :receive (fn [{:keys [value state args]}]
              (if-let [p (pos-of value)]
                {:state p :show p :effects [[:pos p]]}
                (let [p (or state (pos-of [(:x args) (:y args)]) [0 1])]
                  (if (= value :bang) {:state p :show p :effects [[:pos p]]} {:state p}))))
   :gesture (fn [{:keys [x y]}]
              [(/ (js/Math.round (* 100 (api/clamp (/ (- x 52) 46) -1 1))) 100)
               (/ (js/Math.round (* 100 (api/clamp (/ (- 52 y) 46) -1 1))) 100)])

   ;; ── view ──
   :derive (fn [{:keys [shown args]}]
             (let [[x y] (or (pos-of shown) (pos-of [(:x args) (:y args)]) [0 1])]
               {:px (+ 52 (* 46 x)) :py (- 52 (* 46 y))
                :label (str (api/nice x) " · " (api/nice y))}))
   :view [[:rect {:x 2 :y 2 :w 100 :h 100 :r 4 :stroke :grid :fill :bg}]
          [:line {:x1 52 :y1 6 :x2 52 :y2 98 :stroke :grid}]
          [:line {:x1 6 :y1 52 :x2 98 :y2 52 :stroke :grid}]
          [:circle {:cx 52 :cy 52 :r 30 :stroke :grid}]
          [:path {:points [[47 50] [52 43] [57 50]] :closed true :fill :soft}]
          [:circle {:cx 52 :cy 52 :r 5 :stroke :soft :fill :bg}]
          [:line {:x1 52 :y1 52 :x2 :$px :y2 :$py :stroke :accent :weight 1}]
          [:circle {:cx :$px :cy :$py :r 6 :fill :accent}]
          [:text {:x 6 :y 98 :size 9 :fill :soft} :$label]]

   ;; ── audio ──
   :audio {:create (fn [ac b _]
                     (let [[x y] (api/padded (:args b) [0 1])
                           in (.createGain ac) out (.createGain ac)
                           pair (vec (for [i [0 1]]
                                       (let [p (.createPanner ac) g (.createGain ac)]
                                         (set! (.-panningModel p) "HRTF")
                                         (set! (.-distanceModel p) "inverse")
                                         (set! (.-refDistance p) 1)
                                         (set! (.. p -positionX -value) (* 2 (api/clamp x -1 1)))
                                         (set! (.. p -positionY -value) 0)
                                         (set! (.. p -positionZ -value) (* -2 (api/clamp y -1 1)))
                                         (set! (.. g -gain -value) (if (zero? i) 1 0))
                                         (.connect in p) (.connect p g) (.connect g out)
                                         {:p p :g g})))]
                       {:pair pair :live (atom {:a 0 :s -1}) :inlets [[in 0]] :outlets (api/stereo-outlets ac out)}))
           :effects {:pos (fn [node xy at] (move! node xy at))}
           ;; a new text (dragging the dot rewrites it): the sound goes to the new place
           :update (fn [node b at] (move! node (pos-of (api/padded (:args b) [0 1])) at))}})
