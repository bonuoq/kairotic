;; gamepad · a game controller's buttons and sticks as Kairotic events
;; Part of @kairotic/io. Written against the Kairotic API (api/…). Discussion #135, Study 34 · io.
(let [buttons [:a :b :x :y :lb :rb :lt :rt :back :start :ls :rs :up :down :left :right :home]
      axes [:lx :ly :rx :ry]
      r3 (fn [x] (/ (js/Math.round (* x 1000)) 1000))
      ;; a stick's value without its dead zone (its rest is never exactly 0), still −1…1 outside it
      dead (fn [v dz] (if (< (js/Math.abs v) dz) 0 (* (js/Math.sign v) (/ (- (js/Math.abs v) dz) (- 1 dz)))))
      ;; one pad now against the same pad before: the events between them
      pad-diff (fn [i before pad dz]
                 (let [std? (= "standard" (:mapping pad))
                       ev (fn [m] (assoc m :src :gamepad :pad i))
                       ax (mapv (fn [v] (r3 (dead v dz))) (:axes pad))
                       axis-evs (for [[k v] (map-indexed vector ax)
                                      :let [old (get-in before [:axes k] 0)]
                                      :when (or (>= (js/Math.abs (- v old)) 0.01) (and (zero? v) (not (zero? old))))]
                                  (ev (cond-> {:type :axis :axis k :value v} (and std? (< k 4)) (assoc :name (nth axes k)))))
                       btn-evs (for [[k [p v]] (map-indexed vector (:buttons pad))
                                     :let [[op ov] (get-in before [:buttons k] [false 0]) v (r3 v)]
                                     :when (or (not= (boolean p) (boolean op)) (>= (js/Math.abs (- v ov)) 0.01))]
                                 (ev (cond-> {:type :button :button k :value v}
                                       (and std? (< k 17)) (assoc :name (nth buttons k))
                                       (not= (boolean p) (boolean op)) (assoc :gate (boolean p)))))]
                   [{:axes ax :buttons (mapv (fn [[p v]] [(boolean p) (r3 v)]) (:buttons pad))} (vec (concat btn-evs axis-evs))]))
      read-pads (fn []
                  (let [raw (or (.-kairoticFakePads js/window) (when (.-getGamepads js/navigator) (.getGamepads js/navigator)) #js [])]
                    (vec (for [p (js/Array.from raw) :when p]
                           {:index (.-index p) :id (.-id p) :mapping (.-mapping p) :axes (vec (js/Array.from (.-axes p)))
                            :buttons (mapv (fn [b] [(.-pressed b) (.-value b)]) (js/Array.from (.-buttons p)))}))))]
  {;; ── about ──
   :class "gamepad"
   :license "MPL-2.0"
   :doc "A game controller while ▶ runs (press a button to wake it): each button pressed or let go is {:type :button :pad :button :name :value :gate}, a trigger that moves without crossing is the same without :gate, and a stick {:type :axis :pad :axis :name :value −1…1}, with its dead zone (deadzone, 0.12) taken out. With the standard mapping they have names: :a :b :x :y :lb :rb :lt :rt :back :start :ls :rs :up :down :left :right :home, and :lx :ly :rx :ry. pad (-1, all) keeps one. Out: every event, and [name value] for a route or a number box."
   :usage "gamepad [pad] [deadzone]"
   :io [0 2]
   :size [96 30]
   :args [[:pad -1] [:deadzone 0.12]]
   :help {:inlets []
          :outlets ["every event, as a map" "[name value]: (:a 1), (:lx -0.4)…"]
          :example "(box :b1 \"gamepad\" 40 30)\n(box :b2 \"print\" 40 80)\n(connect :b1 1 :b2 0)"
          :try "Press ▶, then any button of a controller to wake it: print shows the buttons and sticks by name."
          :see ["motion" "midiin" "oscout"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value args]}]
              (if (and (= inlet :audio) (:event value))
                (let [e (:event value)]
                  (if (and (>= (:pad args) 0) (:pad e) (not= (:pad args) (:pad e)))
                    {}
                    {:out (cond-> [[0 e]] (#{:button :axis} (:type e)) (conj [1 [(or (:name e) (if (= :axis (:type e)) (:axis e) (:button e))) (:value e)]]))
                     :show {:label (case (:type e)
                                     :connect (str "pad " (:pad e))
                                     :disconnect "no pad"
                                     (str (name (or (:name e) (:type e))) " " (api/nice (:value e))))}}))
                {}))

   ;; ── view ──
   :derive (fn [{:keys [shown]}] {:label (or (:label shown) "gamepad")})
   :view [[:rect {:x 1 :y 1 :w 94 :h 28 :r 3 :stroke :accent :fill :bg}]
          [:text {:x 8 :y 19 :size 11} :$label]]

   ;; ── outside: the pads, read on every frame while ▶ runs ──
   :audio {:create (fn [_ b _]
                     (let [dz (let [n (js/parseFloat (nth (.split (.trim (str (:text b))) #"\s+") 2 ""))] (if (js/isNaN n) 0.12 n))
                           node {:alive (atom true) :last (atom {}) :inlets [] :outlets []}
                           report (fn [e] (api/report! (:id b) {:event e} nil))
                           poll (fn poll [& _]
                                  (when @(:alive node)
                                    (let [pads (into {} (map (fn [p] [(:index p) p]) (read-pads)))
                                          before @(:last node)]
                                      (doseq [i (keys before) :when (not (contains? pads i))] (report {:src :gamepad :type :disconnect :pad i}))
                                      (reset! (:last node)
                                              (into {} (for [[i p] (sort-by key pads)]
                                                         (let [[after es] (pad-diff i (get before i) p dz)]
                                                           (when-not (contains? before i) (report {:src :gamepad :type :connect :pad i :name (:id p)}))
                                                           (doseq [e es] (report e))
                                                           [i after])))))
                                    (js/requestAnimationFrame poll)))]
                       (poll)
                       node))
           :dispose (fn [node] (reset! (:alive node) false))}})
