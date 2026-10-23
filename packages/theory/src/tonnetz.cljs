;; tonnetz · triads on the Tonnetz, and the path of the harmony
;; Part of @kairotic/theory. Written against the Kairotic API (api/…).
;; Pitch classes on a triangular lattice: fifths to the right, major thirds up and to the right, minor
;; thirds up and to the left. A major or minor triad is a triangle; moving between triads that share two
;; notes (the neo-Riemannian P, L and R) is crossing an edge. What sounds lights its nodes, fills the
;; triads it contains, and the triad found is joined to the ones before: the path of the harmony, placed
;; at each step on the copy nearest the last (the lattice repeats). Pressing a node sends its class.
(let [names ["C" "C♯" "D" "E♭" "E" "F" "F♯" "G" "A♭" "A" "B♭" "B"]
      kws [:C :C# :D :Eb :E :F :F# :G :Ab :A :Bb :B]
      I (range -4 5) J (range -2 3)
      path-max 24
      notes-of (fn [args] (api/clamp (or (first (filter number? args)) 3) 1 24))
      pcs-of (fn [xs]
               (if (and (= 12 (count xs)) (every? (fn [x] (and (number? x) (<= 0 x 1))) xs))
                 (set (keep-indexed (fn [i x] (when (> x 0.5) i)) xs))
                 (set (map (fn [x] (mod (js/Math.round x) 12)) (filter number? xs)))))
      node-pc (fn [i j] (mod (+ (* 7 i) (* 4 j)) 12))
      ;; the triangles of the lattice in unit coordinates: [kind root nodes]
      tris (vec (for [i I j J [kind ns] [[:major [[i j] [(inc i) j] [i (inc j)]]] [:minor [[(inc i) j] [i (inc j)] [(inc i) (inc j)]]]]
                      :when (every? (fn [[a b]] (and (<= -4 a 4) (<= -2 b 2))) ns)]
                  {:kind kind :nodes ns :pcs (set (map (fn [[a b]] (node-pc a b)) ns))
                   :root (if (= kind :major) (node-pc i j) (node-pc i (inc j)))}))
      uxy (fn [[i j]] [(+ i (/ j 2)) (* j 0.8660254)])
      centre (fn [t] (let [ps (map uxy (:nodes t))] [(/ (reduce + (map first ps)) 3) (/ (reduce + (map second ps)) 3)]))
      d2 (fn [[a b] [c d]] (+ (* (- a c) (- a c)) (* (- b d) (- b d))))
      triad-of (fn [t] (if (= :major (:kind t)) (nth kws (:root t)) (keyword (str (str/lower-case (name (nth kws (:root t)))) "m"))))
      ;; the triad inside the set nearest the last one (or the centre), or nil
      find-triad (fn [s prev]
                   (first (sort-by (fn [t] (d2 (centre t) (or prev [0 0])))
                                   (filter (fn [t] (every? s (:pcs t))) tris))))]
  {;; ── about ──
   :class "tonnetz"
   :license "MPL-2.0"
   :doc "Triads on the Tonnetz: pitch classes on a lattice of fifths (to the right) and major and minor thirds (up), where a major or minor triad is a triangle and the neo-Riemannian moves P, L and R cross an edge. A list of pitches (MIDI or 0…11) or of 12 weights (a chroma, above 0.5), or a number as a note (the last n notes count: 3); clear forgets the path. It lights what sounds, fills the triads it contains and joins the triad found to the ones before (the path of the harmony, up to 24 steps). The triad goes out on the left when it changes (:C, :am…); pressing a node sends its pitch class (right)."
   :usage "tonnetz [notes]"
   :io [1 2]
   :size [380 230]

   ;; ── logic ──
   :receive (fn [{:keys [value state args]}]
              (let [st (or state {:notes [] :pcs #{} :path [] :triad nil})
                    step (fn [st s]
                           (let [prev (when-let [t (peek (:path st))] (centre t))
                                 t (find-triad s prev)
                                 st (cond-> (assoc st :pcs s :triad t)
                                      (and t (not= t (peek (:path st)))) (update :path (fn [p] (vec (take-last path-max (conj p t))))))]
                             {:state st :show st
                              :out (if (and t (not= (:triad-name st) (triad-of t))) [[0 (triad-of t)]] [])}))
                    named (fn [r] (if-let [t (get-in r [:state :triad])] (assoc-in r [:state :triad-name] (triad-of t)) r))]
                (cond
                  (and (vector? value) (= :pressed (first value)) (number? (second value))) {:out [[1 (second value)]]}
                  (#{:clear "clear"} value) {:state nil :show nil}
                  (number? value) (let [ns (vec (take-last (notes-of args) (conj (:notes st) value)))]
                                    (named (step (assoc st :notes ns) (pcs-of ns))))
                  (and (sequential? value) (every? number? value)) (named (step (assoc st :notes []) (pcs-of value)))
                  :else {})))

   ;; ── view ──
   :draw (fn [{:keys [shown w h]}]
           (let [U (min (/ (- w 24) 10) (/ (- h 40) 3.6)) cx (/ w 2) cy (/ (- h 18) 2)
                 xy (fn [[ux uy]] [(+ cx (* U ux)) (- cy (* U uy))])
                 node (fn [i j] (xy (uxy [i j])))
                 on (or (:pcs shown) #{}) path (:path shown []) cur (:triad shown)]
             (concat
              (for [i I j J [di dj] [[1 0] [0 1] [-1 1]]
                    :let [a (+ i di) c (+ j dj)] :when (and (<= -4 a 4) (<= -2 c 2))]
                (let [[x1 y1] (node i j) [x2 y2] (node a c)] [:line {:x1 x1 :y1 y1 :x2 x2 :y2 y2 :stroke :grid :weight 1}]))
              (for [t tris :when (every? on (:pcs t))]
                [:path {:points (mapv (fn [n] (xy (uxy n))) (:nodes t)) :closed true :fill (if (= :major (:kind t)) :accent :kairos) :stroke nil :opacity 0.25}])
              (when cur [[:path {:points (mapv (fn [n] (xy (uxy n))) (:nodes cur)) :closed true :stroke (if (= :major (:kind cur)) :accent :kairos) :weight 2}]])
              (when (> (count path) 1) [[:curve {:points (mapv (fn [t] (xy (centre t))) path) :stroke :ink :weight 1.2 :opacity 0.6}]])
              (for [[k t] (map-indexed vector path)]
                (let [[x y] (xy (centre t))] [:circle {:cx x :cy y :r 2 :fill :ink :stroke nil :opacity (if (= k (dec (count path))) 1 0.45)}]))
              (for [i I j J]
                (let [[x y] (node i j) p (node-pc i j) lit (on p) r (* 0.26 U)]
                  [:group {:hit p}
                   [[:circle {:cx x :cy y :r r :fill (if lit :accent :bg) :stroke (if lit :accent :grid)}]
                    [:text {:x x :y (+ y 3.2) :anchor :middle :size (max 7 (* 0.22 U)) :fill (if lit :bg :soft)} (nth names p)]]]))
              [[:text {:x 8 :y (- h 5) :size 9 :fill :ink}
                (if cur (str (name (triad-of cur)) " · " (count path) (if (= 1 (count path)) " triad" " triads") " on the path") "no triad")]])))
   ;; pressing a node: its pitch class, sent once, on release
   :gesture (fn [{:keys [up hit]}] (when (and up (number? hit)) [:pressed hit]))})
