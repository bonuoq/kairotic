;; cac · composition assisted by computer, on a tree: operations that follow rules and look ahead (discussion #323)
;; Part of @kairotic/cac. Written against the Kairotic API (api/…).
;; mt's operations change a tree mechanically, and do not question it; cac's take a tree as what is given and add to
;; it, or question it, by the rules of a style — Studies 51–62's kernel, partimento.mjs:
;;   cac partimento   a bass in (a tree: its lowest voice, its notes' figures if it has them, :fig "6/5"), the voices
;;                    above it out — 2, 3 or 4 parts (the bass and 1, 2 or 3 upper voices), realized by the engine
;;                    (its soft rules) or any valid one, the realizations counted exactly
;;   cac judge        a tree of voices in (the lowest the bass): where it breaks the rules, and why — and the chords
;;                    it makes
;; What an analysis finds is written on the tree as its analysis layer (:fig the chord over a bass note, :deg its
;; degree, :local the key it is read in, :why a rule broken there), which a tree box's code window shows or hides
;; (Analysis).
(let [origins ["npm:@kairotic/cac@0.6.0/dist/partimento.mjs" "kairotic/packages/cac/partimento.mjs"]
      names {2 ["soprano"] 3 ["soprano" "alto"] 4 ["soprano" "alto" "tenor"]}
      kernel-keys {2 ["top"] 3 ["top" "middle"] 4 ["soprano" "alto" "tenor"]}
      ;; the notes of a voice: its events, in time order
      voices-of (fn [tree]
                  (let [es (filter #(= :note (:kind %)) (api/tree-events tree))]
                    (->> (group-by :voice es) vals (map #(vec (sort-by :t %)))
                         (sort-by (fn [ns] (/ (reduce + (map :pitch ns)) (count ns)))))))
      ;; the bass as the kernel takes it: a unit (the shortest note, or :unit beats), each note its units, strong on
      ;; the even units from the start
      bass-of (fn [ns unit]
                (let [u (if (and unit (pos? unit)) unit (apply min (map :dur ns)))]
                  {:u u
                   :notes (mapv (fn [e] (let [k (max 1 (js/Math.round (/ (:dur e) u)))]
                                          {:midi (:pitch e) :name (:name e) :units k :fig (some-> (:fig e) str) :key (some-> (:local e) name)
                                           :strong (mapv #(even? (js/Math.round (/ (+ (:t e) (* % u)) u))) (range k))
                                           :t (:t e) :dur (:dur e)}))
                                ns)}))
      key-of (fn [st args tree] (or (some-> (get-in st [:over :key]) name) (some-> (:key args) name)
                                    (some-> (:key (api/tree-attrs tree)) str)))
      voices-n (fn [st args] (let [v (or (get-in st [:over :voices]) (:voices args) 4)] (if (#{2 3 4} v) v 4)))
      ;; chance: the box's own random numbers (Park–Miller), kept in its state
      rng (fn [seed] (let [s (atom (max 1 (mod seed 2147483647)))]
                       (fn [] (swap! s #(mod (* % 16807) 2147483647)) (/ (dec @s) 2147483646))))
      ;; a voice of the kernel's codes, one a unit, as notes: a note held over units is one note
      line (fn [ob codes u attrs-at]
             (loop [i 0 out []]
               (if (>= i (count codes))
                 out
                 (let [c (nth codes i)
                       j (loop [j (inc i)] (if (and (< j (count codes)) (= c (nth codes j))) (recur (inc j)) j))]
                   (recur j (conj out [:note (merge {:pitch (.spell ob c) :dur (* u (- j i))} (attrs-at i))]))))))
      ;; the bass written again, its notes carrying the analysis: the chord made over them, their degree, their key
      bass-line (fn [ob bass chords]
                  (let [units (.-units ob)]
                    (mapv (fn [i nt]
                            (let [t (first (keep-indexed (fn [k u] (when (= i (.-note u)) k)) units))
                                  u (aget units t)
                                  local (.-key u)]
                              [:note (cond-> {:pitch (or (:name nt) (api/midi-name (:midi nt))) :dur (:dur nt) :deg (inc (js/Math.round (.degAt ob t)))}
                                       (and chords (aget chords t)) (assoc :fig (aget chords t))
                                       local (assoc :local (str (.-tonic local) " " (.-mode local))))]))
                          (range) (:notes bass))))
      ;; the realization as a tree: the upper voices, then the bass
      realization (fn [ob st bass R]
                    (let [n (.-voices ob) ks (kernel-keys n) u (:u bass)
                          chords (when (.-chords (.-P ob)) (.chords ob R))
                          k (.-key ob)]
                      (into [:piece {:key (str (.-tonic k) " " (.-mode k))}]
                            (concat (map (fn [vn kk] (into [:voice {:name vn}] (line ob (vec (aget R kk)) u (constantly {}))))
                                         (names n) ks)
                                    [(into [:voice {:name "bass"}] (bass-line ob bass chords))]))))
      shown (fn [ob st] {:main (str "cac " (name (:op st :partimento)) " · " (.-voices ob) " parts")
                         :sub (str (:count st) " realizations · " (.. ob -key -tonic) " " (.. ob -key -mode))})]
  {:class "cac"
   :license "MPL-2.0"
   :doc "Composition assisted by computer on a tree: operations that follow the rules of a style and look ahead, beside mt's mechanical ones (discussion #323; Studies 51–62). cac partimento: a bass in (a tree — its lowest voice; its notes' figures, :fig \"6/5\", if it has them; a note's key, :local \"G major\", if it is read in another), the voices above it out, as a tree for a tree box: 4 parts by default (soprano, alto, tenor over the bass; [:voices 3] or 2), realized by the engine (its soft rules: steps rather than leaps, the leading tone up…) — a bang another one, :any any valid one, each as likely — and the realizations counted exactly (outlet 1). The bass written again carries the analysis: the chord made over each note (:fig), its degree (:deg), its key where it is read in another (:local) — the tree box's code window shows them with Analysis. The key: the box's words (cac partimento G, cac partimento e: lower case minor), the tree's :key, or guessed from the bass. Its unit is the shortest note of the bass (or [:unit 2]); the even units are strong. cac judge: a tree of voices in, the lowest the bass: where they break the rules, and why (outlet 1), and the tree out with the chords over its bass and :why on the notes that break one. [:voices 3], [:key \"a minor\"], [:temp 1], [:seed 7], [:unit 1] change it."
   :usage "cac partimento|judge [voices 4] [key] [temp 0.5] [seed 1] [unit 0]"
   :io [1 2]
   :size [190 46]
   :args [[:op nil] [:voices 4] [:key nil] [:temp 0.5] [:seed 1] [:unit 0]]

   ;; ── a task: the kernel over the bass, counted (outside the pure logic) ──
   :tasks {:build (fn [{:keys [notes key voices]} _box]
                    (-> (api/import-module origins)
                        (.then (fn [m]
                                 (let [ob (.overBass m (clj->js {:notes notes :key key :voices voices}))]
                                   {:ob ob :count (str (.count ob)) :module m})))))}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (let [st (or state {})
                    op (or (some-> (:op args) name keyword) :partimento)
                    st (assoc st :op op)
                    ;; a change asked for on the way: kept, and the tree done again
                    over? (and (vector? value) (#{:voices :key :temp :seed :unit} (first value)))
                    st (if over? (assoc-in st [:over (first value)] (second value)) st)
                    temp (or (get-in st [:over :temp]) (:temp args) 0.5)
                    build (fn [st tree]
                            (let [vs (voices-of tree)]
                              (if (empty? vs)
                                {:state st :show {:main "cac" :sub "✗ no notes in the tree"}}
                                (let [n (if (= op :judge) (count vs) (voices-n st args))
                                      bass (bass-of (first vs) (or (get-in st [:over :unit]) (:unit args)))]
                                  (cond
                                    (not (#{2 3 4} n)) {:state st :show {:main "cac judge" :sub (str "✗ " n " voices: 2, 3 or 4")}}
                                    :else
                                    {:state (assoc st :tree tree :bass bass :uppers (vec (rest vs)) :n n :seed (or (get-in st [:over :seed]) (:seed args) 1))
                                     :show {:main (str "cac " (name op)) :sub "counting…"}
                                     :effects [[:build {:notes (mapv #(dissoc % :t :dur :name) (:notes bass)) :key (key-of st args tree) :voices n}]]})))))
                    ;; one realization, or the judgement, sent out
                    emit (fn [st how]
                           (let [ob (:ob st)]
                             (if (= op :judge)
                               (let [u (:u (:bass st)) units (.-units ob) ks (kernel-keys (:n st))
                                     ;; each upper voice, at the start of each unit: the note sounding then
                                     at (fn [ns t] (some (fn [e] (when (and (<= (:t e) (+ t 1e-6)) (< (+ t 1e-6) (+ (:t e) (:dur e)))) e)) ns))
                                     t0 (:t (first (:notes (:bass st))))
                                     codes (mapv (fn [ns] (mapv (fn [i] (some->> (at ns (+ t0 (* i u))) :pitch (.code ob))) (range (.-length units)))) (:uppers st))
                                     R (clj->js (zipmap (reverse ks) codes))
                                     why (if (some #(some nil? %) codes) "a note out of the key, or a voice silent" (.judge ob R))
                                     chords (when-not (some #(some nil? %) codes) (.chords ob R))]
                                 {:state st :show {:main "cac judge" :sub (if why (str "✗ " why) "✓ by the rules")}
                                  :out [[1 {:ok (nil? why) :why why :chords (some-> chords js->clj)}]]})
                               (let [r (rng (:seed st 1))
                                     R (if (= how :any) (.sample ob r) (.engine ob #js {:temp temp :r r}))]
                                 (if (nil? R)
                                   {:state st :show {:main "cac partimento" :sub "✗ no realization over this bass"}
                                    :out [[1 {:count 0 :why "no realization over this bass"}]]}
                                   {:state (update st :seed #(mod (* (or % 1) 48271) 2147483647))
                                    :show (shown ob st)
                                    :out [[1 (cond-> {:count (:count st) :key (str (.. ob -key -tonic) " " (.. ob -key -mode))}
                                               (seq (.-unknown ob)) (assoc :unknown (js->clj (.-unknown ob))))]
                                          [0 (realization ob st (:bass st) R)]]})))))]
                (cond
                  ;; the kernel counted: kept, and the first realization (or the judgement) sent
                  (= inlet :task)
                  (if (:error value)
                    {:state st :show {:main (str "cac " (name op)) :sub (str "✗ " (:error value))}}
                    (emit (assoc st :ob (:ob (:value value)) :count (:count (:value value))) :engine))
                  ;; a tree: the given
                  (api/tree? value) (build (dissoc st :ob) value)
                  over? (if (:tree st) (build (dissoc st :ob) (:tree st)) {:state st})
                  (nil? (:ob st)) {:state st}
                  (= value :any) (emit st :any)
                  (#{:bang :engine} value) (emit st :engine)
                  :else {:state st})))

   ;; ── view ──
   :derive (fn [{:keys [shown]}]
             {:main (or (:main shown) "cac") :sub (or (:sub shown) "a tree in")})
   :view [[:rect {:x 2 :y 2 :w 186 :h 42 :r 3 :stroke :grid :fill :bg}]
          [:text {:x 10 :y 20 :size 13} :$main]
          [:text {:x 10 :y 36 :size 9 :fill :soft} :$sub]]})
