;; SPDX-License-Identifier: MPL-2.0
;; paths · an open form: fragments and rules of succession, the performer choosing the path, the follower deciding it
;; (discussion #212, Study 70). Part of @kairotic/analysis. Written against the Kairotic API (api/…).
(let [;; ── a note heard: where the pitch settles (as follow's) ──
      settle-s 0.06      ; seconds a new pitch must hold before it is a new note
      onset-s 0.15       ; an onset at most this long before a pitch begins the note there
      apart 0.6          ; semitones: a pitch this far from the note that sounds is another note
      sure-of (fn [args] (api/clamp (or (first (filter number? args)) 0.9) 0.5 0.999))
      path-str (fn [p] (str/join " " (map name p)))
      shown (fn [st]
              (let [w (:work st) p (:path st)]
                {:on (:on st) :frags (count (:frags w)) :path (vec (map name p))
                 :choices (vec (map name (if w (api/paths-choices w p) [])))
                 :done (boolean (and w (api/paths-done? w p))) :kept (count (:kept st))
                 :guess (:guess st)}))
      ;; a step of the path: the fragment chosen (0), it as a tree to play with the indications left before it (1), what
      ;; can come next (2)
      step-out (fn [st id]
                 (let [w (:work st) before (:path st) p (conj before id)
                       ;; (chosen by hand or played by the box: the fragment sounds; followed, the performer plays it)
                       sound? (not (:on st))]
                   [(assoc st :path p)
                    (cond-> [[0 id] [1 (api/paths-fragment w before id)]]
                      sound? (conj [1 :bang])
                      true (conj [2 (api/paths-choices w p)]))]))
      ;; the box plays the form itself: a fragment at random, the next when it ends
      auto (fn [st at]
             (let [w (:work st) cs (api/paths-choices w (:path st))]
               (if (empty? cs)
                 [(assoc st :auto nil) []]
                 (let [id (rand-nth cs) secs (api/paths-seconds w (:path st) id) [st outs] (step-out st id)]
                   [st outs {:later [[(+ at secs) 0 [:auto (:auto st)]]]}]))))
      ;; a note heard (MIDI): the follower moves on, and says the fragment it recognised
      note-on (fn [st m]
                (let [[fl found] (api/paths-hear (:work st) (:fl st) m (:sure st))
                      ids (keep (fn [[k id]] (when (= k :frag) id)) found)
                      guess (first (api/paths-recognize (:work st) (:path fl) (:heard fl)))]
                  (reduce (fn [[st outs] id] (let [[st o] (step-out st id)] [st (into outs o)]))
                          [(assoc st :fl fl :guess (when (and guess (not (:decided fl))) [(name (:id guess)) (api/nice (:p guess))]))
                           []]
                          ids)))
      hear (fn [st hz t]
             (let [cur (:cur st) m (when (pos? hz) (js/Math.round (api/hz->midi hz)))]
               (cond
                 (nil? m) [(assoc st :pend nil :cur nil) []]
                 (or (nil? cur)) (note-on (assoc st :cur {:t t :midi m} :pend nil) m)
                 (and (:onset st) (> (:onset st) (+ (:t cur) 0.05)) (<= (- t (:onset st)) onset-s))
                 (note-on (assoc st :onset nil :cur {:t t :midi m} :pend nil) m)
                 (<= (js/Math.abs (- m (:midi cur))) apart) [(assoc st :pend nil) []]
                 (and (:pend st) (= m (second (:pend st))) (>= (- t (first (:pend st))) settle-s))
                 (note-on (assoc st :cur {:t t :midi m} :pend nil) m)
                 (and (:pend st) (= m (second (:pend st)))) [st []]
                 :else [(assoc st :pend [t m]) []])))
      result (fn [[st outs extra2] extra]
               (cond-> {:state st :show (shown st)} (seq outs) (assoc :out outs) extra (merge extra) extra2 (merge extra2)))]
  {;; ── about ──
   :class "paths"
   :license "MPL-2.0"
   :doc "An open form (discussion #212, Study 70): a work of fragments and rules of succession — [:open {:start :any :end {:repeat 3}} [:frag {:id :A :next :any :not #{:B} :near 6 :then {:tempo 1.5 :dyn \"pp\"}} …notes…] …] from a tree box —, the performer choosing the path. Choose a fragment yourself ([:choose :A], or :next for one at random among those that can come: it sounds, through an mt play on its second outlet), :play to let it play the form itself, or :start and play: every fragment that can come next is a hypothesis, its opening aligned with what is heard (pitch~ on the second inlet and onset~ on the third, or MIDI notes — numbers, or midiin — on the fourth; wrong, missed and added notes allowed), and the one it is sure of is taken — the follower decides the form. A fragment's :then is how the next is played (tempo, dynamics, touch); the performance ends when a fragment comes a third time (:end {:repeat 3}), after n fragments ({:after n}) or at a :final one. At :stop the performance is read again whole, and kept: each a branch."
   :usage "paths [sure]"
   :io [4 4]
   :size [124 30]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [st (or state {}) w (:work st)]
                (cond
                  ;; the work
                  (and (= inlet 0) (api/paths-open? value))
                  (let [w (api/paths-work value) st (assoc st :work w :path [] :on false :fl nil :guess nil)]
                    {:state st :show (shown st) :out [[2 (api/paths-choices w [])]]})
                  (nil? w) (if (= inlet 0) {:effects [[:print "paths: no work yet (an [:open …] tree from a tree box on its left inlet)"]]} {})
                  ;; choosing, by hand or at random
                  (or (and (vector? value) (= :choose (first value))) (and (= inlet 0) (keyword? value) (some #{value} (api/paths-ids w))))
                  (let [id (keyword (name (if (vector? value) (second value) value)))]
                    (if (some #{id} (api/paths-choices w (:path st)))
                      (result (step-out st id) nil)
                      {:effects [[:print (str "paths: " (name id) " cannot come after " (or (some-> (peek (:path st)) name) "the beginning"))]]}))
                  (= value :next)
                  (let [cs (api/paths-choices w (:path st))]
                    (if (seq cs) (result (step-out st (rand-nth cs)) nil) {}))
                  ;; the box plays the form itself, from the beginning: :play, and :stop
                  (= value :play)
                  (let [g (inc (or (:gen st) 0))] (result (auto (assoc st :path [] :auto g :gen g :on false) at) nil))
                  (and (vector? value) (= :auto (first value)))
                  (if (and (:auto st) (= (second value) (:auto st))) (result (auto st at) nil) {})
                  (and (= value :stop) (:auto st)) (result [(assoc st :auto nil) [[1 :stop]]] nil)
                  (= value :back) (let [st (update st :path (fn [p] (if (seq p) (pop p) p)))] (result [st [[2 (api/paths-choices w (:path st))]]] nil))
                  (= value :reset) (let [st (assoc st :path [] :guess nil)] (result [st [[2 (api/paths-choices w [])]]] nil))
                  ;; following a performer
                  (= value :start)
                  (let [st (assoc st :on true :t0 at :path [] :fl (api/paths-follow-start) :sure (sure-of args) :cur nil :pend nil :onset nil :guess nil)]
                    (result [st [[2 (api/paths-choices w [])]]] nil))
                  (= value :stop)
                  (let [heard (get-in st [:fl :all] [])
                        live (:path st)
                        again (when (seq heard) (:path (api/paths-decode w heard)))
                        perf (cond-> {:path (vec (or again live)) :live (vec live) :notes (count heard)}
                               (:t0 st) (assoc :seconds (api/nice (- at (:t0 st)))))
                        st (cond-> (assoc st :on false :guess nil)
                             (seq (:path perf)) (update :kept (fnil conj []) (:path perf)))]
                    (result [st (when (seq (:path perf)) [[3 [:performance perf]]])] nil))
                  (not (:on st)) {}
                  ;; an onset (from onset~): a note begins there, even on the same pitch
                  (= inlet 2) {:state (assoc st :onset (- at (:t0 st)))}
                  ;; MIDI: a number, or a note from midiin ({:type :note :note n :gate 1})
                  (= inlet 3)
                  (let [m (cond (number? value) (js/Math.round value)
                                (and (map? value) (= :note (:type value)) (pos? (or (:gate value) 1))) (:note value))]
                    (if m (result (note-on st m) nil) {}))
                  (and (= value [:settle]) (:pend st)) (result (hear st (api/midi->hz (second (:pend st))) (- at (:t0 st))) nil)
                  ;; Hz from pitch~
                  (and (= inlet 1) (number? value))
                  (let [t (- at (:t0 st)) [st2 outs] (hear st value t)]
                    (result [st2 outs] (when (and (:pend st2) (not= (:pend st2) (:pend st)))
                                         {:later [[(+ at settle-s 0.005) 0 [:settle]]]})))
                  :else {})))

   ;; ── view ──
   :derive (fn [{:keys [shown]}]
             {:label (str (if (:on shown) "● " "") "paths · "
                          (if (seq (:path shown)) (str/join " " (:path shown)) (str (or (:frags shown) 0) " fragments"))
                          (cond (:done shown) " ■"
                                (:guess shown) (str " · " (first (:guess shown)) "?")
                                (seq (:choices shown)) (str " → " (count (:choices shown)))
                                :else ""))})
   :view [[:rect {:x 2 :y 2 :w 120 :h 26 :r 3 :stroke :grid :fill :bg}]
          [:text {:x 8 :y 19 :size 10 :fill :soft} :$label]]})
