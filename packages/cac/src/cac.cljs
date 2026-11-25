;; cac · composition assisted by computer, on a tree: operations that follow rules and look ahead (discussion #323)
;; Part of @kairotic/cac. Written against the Kairotic API (api/…).
;; mt's operations change a tree mechanically, and do not question it; cac's take a tree as what is given and add to
;; it, or question it, by the rules of a style — @kairotic/rules (discussion #353): its styles partimento-1 (one upper
;; voice), partimento-2 (two) and chorale-4 (three), Studies 51–62's kernel ported onto one engine:
;;   cac partimento   a bass in (a tree: its lowest voice, its notes' figures if it has them, :fig "6/5"), the voices
;;                    above it out — 2, 3 or 4 parts (the bass and 1, 2 or 3 upper voices), realized by the engine
;;                    (its soft rules) or any valid one, the realizations counted exactly
;;   cac judge        a tree of voices in (the lowest the bass): where it breaks the rules, and why — and the chords
;;                    it makes
;; What an analysis finds is written on the tree as its analysis layer (:fig the chord over a bass note, :deg its
;; degree, :local the key it is read in, :why a rule broken there), which a tree box's code window shows or hides
;; (Analysis).
(let [origins ["npm:@kairotic/rules@0.20.1/dist/rules.mjs" "kairotic/packages/rules/rules.mjs"]
      canon-origins ["npm:@kairotic/rules@0.20.1/dist/canon.mjs" "kairotic/packages/rules/canon.mjs"]
      ;; how long the page may count, and search when it cannot (ms): past them the page would freeze (a long bass
      ;; without figures in four parts takes minutes to count), so the box gives up counting and finds a realization
      ;; by search, or says it found none in time
      count-ms 1500
      search-ms 2500
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
      ;; a mode written after the key (cac partimento 3 A major, d dorian) is the key's: its words would else fill
      ;; the next word's place, the style
      mode-words #{"major" "minor" "ionian" "dorian" "phrygian" "lydian" "mixolydian" "aeolian" "locrian"}
      mode-word? (fn [x] (and (or (keyword? x) (string? x) (symbol? x)) (contains? mode-words (str/lower-case (name x)))))
      key-of (fn [st args tree] (or (some-> (get-in st [:over :key]) name)
                                    (when-let [k (some-> (:key args) name)]
                                      (if (mode-word? (:style args)) (str k " " (str/lower-case (name (:style args)))) k))
                                    (some-> (:key (api/tree-attrs tree)) str)))
      voices-n (fn [st args] (let [v (or (get-in st [:over :voices]) (:voices args) 4)] (if (#{2 3 4} v) v 4)))
      ;; the style: a name (:chorale-4, "partimento-2") or one written in EDN ({:style :my-chorale :extends
      ;; [:chorale-4 "1.0.0"] :between [[:seventh {:free true}]]}), from [:style …] or the box's words
      style-of (fn [st args] (let [x (or (get-in st [:over :style]) (when-not (mode-word? (:style args)) (:style args)))]
                               (cond (map? x) x (keyword? x) (name x) (string? x) x :else nil)))
      style-name (fn [ob] (when-let [s (.-style ob)] (str (.-style s) (when (.-version s) (str " " (.-version s))))))
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
      ;; how each voice is written: in open score (a staff each, the tenor in the treble clef an octave down) or, with
      ;; [:staves 2], in short score (soprano and alto on a treble staff, tenor and bass on a bass staff)
      written (fn [vn staves n]
                (if (and (= 2 staves) (> n 2))
                  (if (#{"soprano" "alto"} vn) {:staff "S A" :clef "G"} {:staff "T B" :clef "F"})
                  ({"tenor" {:clef "G8"} "bass" {:clef "F"}} vn {})))
      ;; the realization as a tree: the upper voices, then the bass
      realization (fn [ob st bass R]
                    (let [n (.-voices ob) ks (kernel-keys n) u (:u bass)
                          staves (or (get-in st [:over :staves]) (:staves st) 4)
                          chords (when (.-chords (.-P ob)) (.chords ob R))
                          k (.-key ob)]
                      (into [:piece {:key (str (.-tonic k) " " (.-mode k))}]
                            (concat (map (fn [vn kk] (into [:voice (merge {:name vn} (written vn staves n))] (line ob (vec (aget R kk)) u (constantly {}))))
                                         (names n) ks)
                                    [(into [:voice (merge {:name "bass"} (written "bass" staves n))] (bass-line ob bass chords))]))))
      ;; cac imitation: the dux (the tree's highest voice) written again, the comes under it from the canon's codes, one
      ;; a unit (silent before it enters)
      ;; (a note again where the dux strikes one, d units before: the comes articulates as the dux it imitates)
      comes-line (fn [ob codes u strikes]
                   (loop [i 0 out []]
                     (if (>= i (count codes))
                       out
                       (let [c (nth codes i)
                             j (loop [j (inc i)] (if (and (< j (count codes)) (= c (nth codes j)) (not (strikes j))) (recur (inc j)) j))]
                         (recur j (conj out (if (nil? c) [:rest {:dur (* u (- j i))}] [:note {:pitch (.spell ob c) :dur (* u (- j i))}])))))))
      ;; (a melody's rests, which voices-of does not see: the gaps between its notes, from the start, as units without
      ;; a note — the dux rests there, and a canon's comes after it)
      with-rests (fn [ns u]
                   (loop [ns ns end 0 out []]
                     (if-let [nt (first ns)]
                       (let [gap (js/Math.round (/ (- (:t nt) end) u))]
                         (recur (rest ns) (+ (:t nt) (:dur nt))
                                (cond-> out (pos? gap) (conj {:midi nil :units gap :dur (* gap u)}) true (conj nt))))
                       out)))
      imitation-tree (fn [ob st R]
                       (let [k (.-K ob) u (:u (:dux st)) ns (:notes (:dux st))
                             onsets (keep (fn [[t nt]] (when (:midi nt) t)) (map vector (reductions + 0 (map :units ns)) ns))
                             strikes (set (map #(+ % (.-d ob)) onsets))]
                         [:piece {:key (str (.-tonic k) " " (.-mode k))}
                          (into [:voice {:name "dux"}] (map (fn [nt] (if (:midi nt) [:note {:pitch (or (:name nt) (api/midi-name (:midi nt))) :dur (:dur nt)}] [:rest {:dur (:dur nt)}])) ns))
                          (into [:voice {:name "comes" :clef (if (neg? (.-k ob)) "F" "G")}] (comes-line ob (vec (.-comes R)) u strikes))]))
      band-name (fn [x] (cond (>= x 0.999) "a canon" (>= x 0.5) "near imitation" (>= x 0.2) "imitation by motion" :else "free counterpoint"))
      shown (fn [ob st] {:main (str "cac " (name (:op st :partimento)) " · " (.-voices ob) " parts" (when-let [s (style-name ob)] (str " · " s)))
                         :sub (str (if (:count st) (str (:count st) " realizations") "too many to count here")
                                   " · " (.. ob -key -tonic) " " (.. ob -key -mode))})]
  {:class "cac"
   :license "MPL-2.0"
   :doc "Composition assisted by computer on a tree: operations that follow the rules of a style and look ahead, beside mt's mechanical ones (discussion #323; Studies 51–62). cac partimento: a bass in (a tree — its lowest voice; its notes' figures, :fig \"6/5\", if it has them; a note's key, :local \"G major\", if it is read in another), the voices above it out, as a tree for a tree box: 4 parts by default (soprano, alto, tenor over the bass; [:voices 3] or 2), realized by the engine (its soft rules: steps rather than leaps, the leading tone up…) — a bang another one, :any any valid one, each as likely — and the realizations counted exactly (outlet 1). The bass written again carries the analysis: the chord made over each note (:fig), its degree (:deg), its key where it is read in another (:local) — the tree box's code window shows them with Analysis. The key: the box's words (cac partimento G, cac partimento e: lower case minor; cac partimento d dorian: a church mode, with its musica ficta), the tree's :key, or guessed from the bass. Its unit is the shortest note of the bass (or [:unit 2]); the even units are strong. cac judge: a tree of voices in, the lowest the bass: where they break the rules, and why (outlet 1), and the tree out with the chords over its bass and :why on the notes that break one. A note without figures takes the chord a partimento player would: the Rule of the Octave's where the bass moves by step through it, a 5/3 where it leaps (a 6/3 on ⑦) and at the start and the end. The voices are written in open score, soprano, alto, tenor (in the treble clef an octave down) and bass; [:staves 2] writes them in short score, soprano and alto on a treble staff, tenor and bass on a bass staff. A style chooses the rules: [:style :partimento-2] (or :chorale-4, :partimento-1, :modal-4…) by its name, or one written in EDN that extends another — [:style {:style :free-sevenths :extends [:chorale-4 \"1.0.0\"] :between [[:seventh {:free true}]]}]: a rule named again takes its new parameters, [:rule false] removes it, :voice the style of each voice ({:rules [[:leaps {:line :strict}]]}), :weights the soft rules' weights; a style with its name is defined, and may be named from then on. A style says how many parts it writes. :styles lists them (outlet 1). cac judge with a canon's style ([:style :canon-2], or one that extends it): two voices judged by the canon's rules — each voice's line, and what is between them (parallels, dissonances, suspensions, the imitation) —, unit by unit: the reasons (outlet 1, each with its unit and its voice, the dux, the comes or both) and the voices written again with :why on the notes that break a rule (their analysis layer); the dux the voice that enters first (the lower if together, or [:dux :upper]), k and d read from their entries (or [:k -4], [:d 2]), a canon if the comes enters later, free counterpoint if together (or [:imitation 0.6]). cac imitation: a melody in (a tree — its highest voice, the dux, its unit its shortest note), the comes added under it (or over it), as the comes's engine finds it against the dux given (@kairotic/rules's canon.mjs, the style imitation-2): [:k -7] steps away (−7 an octave below, −4 a 5th below, 7 an octave above), [:d 2] units later, [:imitation 1] a canon (0.6 near, 0.3 by motion, 0 free counterpoint), [:species 4], [:invert 12] (the counterpoint must stand inversion at the 12th); in the key of the tree or [:key \"d dorian\"], with its musica ficta; the comes found by the engine, a bang another, :any any, counted (outlet 1). [:voices 3], [:key \"a minor\"], [:temp 1], [:seed 7], [:unit 1], [:staves 2] change it."
   :usage "cac partimento|judge|imitation [voices 4] [key] [temp 0.5] [seed 1] [unit 0] [staves 4] [style] [k -7] [d 2] [imitation 1] [species] [invert] ([:dux :upper] for cac judge with a canon's style)"
   :io [1 2]
   :size [190 46]
   :args [[:op nil] [:voices 4] [:key nil] [:temp 0.5] [:seed 1] [:unit 0] [:staves 4] [:style nil] [:k -7] [:d 2] [:imitation 1] [:species nil] [:invert nil]]

   ;; ── a task: the kernel over the bass, counted (outside the pure logic) ──
   :tasks {:imitate (fn [{:keys [notes key k d imitation species invert style]} _box]
                      (-> (api/import-module canon-origins)
                          (.then (fn [m]
                                   (let [ob (.imitation m (clj->js (cond-> {:notes notes :key key :k k :d d :imitation imitation}
                                                                      species (assoc :species species)
                                                                      invert (assoc :invert (if (number? invert) [invert] invert))
                                                                      style (assoc :style (if (map? style) (clj->js style) style)))))]
                                     ;; counted within count-ms (nil: too long to count here, then found by search)
                                     {:ob ob :count (some-> (.countWithin ob count-ms) str)})))))
           ;; cac judge with a canon's style (canon-2, or one that extends it): two voices judged by the canon's rules —
           ;; another style's engine answers {:bass true}, and the voices are judged over their bass as before
           :judge-two (fn [{:keys [upper lower key style dux k d imitation species invert]} _box]
                        (-> (js/Promise.all #js [(api/import-module origins) (api/import-module canon-origins)])
                            (.then (fn [ms]
                                     (let [m (aget ms 0) c (aget ms 1)
                                           sj (if (map? style) (clj->js style) style)
                                           _ (when (and (map? style) (:style style)) (.defineStyle m sj))]
                                       (if (not= "canon" (.-engine (.resolveStyle m sj)))
                                         {:bass true}
                                         {:judgement (js->clj (.judgeTwo c (clj->js (cond-> {:upper upper :lower lower :key key :style sj}
                                                                                      dux (assoc :dux (name dux)) k (assoc :k k) d (assoc :d d)
                                                                                      imitation (assoc :imitation imitation) species (assoc :species species)
                                                                                      invert (assoc :invert (if (number? invert) [invert] invert)))))
                                                              :keywordize-keys true)}))))))
           :build (fn [{:keys [notes key voices fill count? style]} _box]
                    (-> (api/import-module origins)
                        (.then (fn [m]
                                 ;; (a style written with its name is defined: from then on it may be named, and extended)
                                 (let [sj (cond (map? style) (clj->js style) style style)
                                       _ (when (and (map? style) (:style style)) (.defineStyle m sj))
                                       ob (.fromNotes m (clj->js (cond-> {:notes notes :key key :voices voices :fill fill} sj (assoc :style sj))))
                                       ;; counted within count-ms (nil: too long to count here); judging needs no count
                                       c (when count? (if (fn? (.-countWithin ob)) (.countWithin ob count-ms) (.count ob)))]
                                   {:ob ob :count (some-> c str) :module m})))))
           ;; the styles there are: each with its version, the parts it writes, what it extends
           :styles (fn [_ _box]
                     (-> (api/import-module origins)
                         (.then (fn [m]
                                  (into (sorted-map)
                                        (for [[k v] (js->clj (.-STYLES m) :keywordize-keys true)]
                                          [k (cond-> {:version (:version v)}
                                               (.partsOf m (name k)) (assoc :parts (.partsOf m (name k)))
                                               (:extends v) (assoc :extends (:extends v)))]))))))}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (let [st (or state {})
                    op (or (some-> (:op args) name keyword) :partimento)
                    st (assoc st :op op)
                    ;; a change asked for on the way: kept, and the tree done again
                    over? (and (vector? value) (#{:voices :key :temp :seed :unit :staves :style :k :d :imitation :species :invert :dux} (first value)))
                    st (if over? (assoc-in st [:over (first value)] (second value)) st)
                    temp (or (get-in st [:over :temp]) (:temp args) 0.5)
                    arg (fn [k dflt] (let [v (get-in st [:over k] (get args k))] (if (nil? v) dflt v)))
                    build (fn [st tree]
                            (let [vs (voices-of tree)]
                              (cond
                                (empty? vs) {:state st :show {:main "cac" :sub "✗ no notes in the tree"}}
                                ;; cac imitation: the highest voice is the dux; the comes is found against it
                                (= op :imitation)
                                (let [dux (bass-of (last vs) (arg :unit nil))
                                      dux (update dux :notes with-rests (:u dux))]
                                  {:state (assoc st :tree tree :dux dux :seed (arg :seed 1))
                                   :show {:main "cac imitation" :sub "counting…"}
                                   :effects [[:imitate {:notes (mapv (fn [nt] {:midi (:midi nt) :units (:units nt)}) (:notes dux))
                                                        :key (key-of st args tree) :k (arg :k -7) :d (arg :d 2) :imitation (arg :imitation 1)
                                                        :species (arg :species nil) :invert (arg :invert nil) :style (style-of st args)}]]})
                                ;; cac judge, two voices, a style: perhaps a canon's (the task says; if not, as below)
                                (and (= op :judge) (= 2 (count vs)) (style-of st args) (not (:bass-judge st)))
                                (let [unit (or (get-in st [:over :unit]) (let [x (:unit args)] (when (and x (pos? x)) x)))
                                      u (or unit (apply min (map :dur (concat (first vs) (second vs)))))
                                      one (fn [ns] (let [b (bass-of ns u)] (update b :notes with-rests u)))
                                      lo (one (first vs)) hi (one (second vs))
                                      notes-of (fn [b] (mapv (fn [nt] {:midi (:midi nt) :units (:units nt)}) (:notes b)))
                                      o (fn [k] (get-in st [:over k]))]
                                  {:state (assoc st :tree tree :two {:u u :upper hi :lower lo})
                                   :show {:main "cac judge" :sub "judging…"}
                                   :effects [[:judge-two {:upper (notes-of hi) :lower (notes-of lo) :key (key-of st args tree) :style (style-of st args)
                                                          :dux (o :dux) :k (o :k) :d (o :d) :imitation (o :imitation) :species (o :species) :invert (o :invert)}]]})
                                :else
                                (let [style (style-of st args)
                                      ;; (a style says how many parts it writes, unless [:voices n] asks)
                                      n (cond (= op :judge) (count vs) (and style (nil? (get-in st [:over :voices]))) nil :else (voices-n st args))
                                      bass (bass-of (first vs) (or (get-in st [:over :unit]) (:unit args)))]
                                  (cond
                                    (and n (not (#{2 3 4} n))) {:state st :show {:main "cac judge" :sub (str "✗ " n " voices: 2, 3 or 4")}}
                                    :else
                                    {:state (assoc st :tree tree :bass bass :uppers (vec (rest vs)) :n n :seed (or (get-in st [:over :seed]) (:seed args) 1)
                                                    :staves (:staves args))
                                     :show {:main (str "cac " (name op)) :sub "counting…"}
                                     :effects [[:build {:notes (mapv #(dissoc % :t :dur :name) (:notes bass)) :key (key-of st args tree) :voices n :fill (not= op :judge)
                                                        :count? (not= op :judge) :style style}]]})))))
                    ;; one realization, or the judgement, sent out
                    emit (fn [st how]
                           (let [ob (:ob st)]
                             (cond
                               (= op :imitation)
                               (let [r (rng (:seed st 1))
                                     ;; (not counted — too long here —: found by search, or none in time)
                                     R (cond
                                         (nil? (:count st)) (try (.search ob #js {:temp (if (= how :any) (max 2 temp) temp) :r r :ms search-ms})
                                                                 (catch :default e (if (.-tooLong e) nil (throw e))))
                                         (not= "0" (:count st)) (if (= how :any) (.sample ob r) (.engine ob #js {:temp temp :r r})))
                                     info {:count (or (:count st) "too many to count here") :k (.-k ob) :d (.-d ob) :imitation (band-name (arg :imitation 1))
                                           :key (str (.. ob -K -tonic) " " (.. ob -K -mode))}]
                                 (cond
                                   (seq (.-unknown ob))
                                   {:state st :show {:main "cac imitation" :sub (str "✗ out of the key: " (first (.-unknown ob)))}
                                    :out [[1 (assoc info :count 0 :why (str "notes out of the key: " (apply str (interpose ", " (.-unknown ob)))))]]}
                                   (and (nil? R) (nil? (:count st)))
                                   {:state st :show {:main "cac imitation" :sub "✗ too long: no comes found in time"}
                                    :out [[1 (assoc info :count nil :why "too many to count here, and no comes found in time")]]}
                                   (nil? R)
                                   {:state st :show {:main "cac imitation" :sub (str "✗ no comes: " (band-name (arg :imitation 1)) " · k " (.-k ob) " · d " (.-d ob))}
                                    :out [[1 (assoc info :count 0 :why "no comes for this dux: another k or d, a freer imitation")]]}
                                   :else
                                   {:state (update st :seed #(mod (* (or % 1) 48271) 2147483647))
                                    :show {:main (str "cac imitation · " (band-name (arg :imitation 1)))
                                           :sub (str (or (:count st) "too many to count:") " comes · k " (.-k ob) " · d " (.-d ob) " · " (.. ob -K -tonic) " " (.. ob -K -mode))}
                                    :out [[1 info] [0 (imitation-tree ob st R)]]}))
                               (= op :judge)
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
                               :else
                               (let [r (rng (:seed st 1))
                                     ;; not counted (too many): found by search — :any with more chance in its order
                                     R (if (nil? (:count st))
                                         (try (.search ob #js {:temp (if (= how :any) (max 2 temp) temp) :r r :ms search-ms})
                                              (catch :default e (if (.-tooLong e) :too-long (throw e))))
                                         (if (= how :any) (.sample ob r) (.engine ob #js {:temp temp :r r})))]
                                 (cond
                                   (= R :too-long)
                                   {:state st :show {:main "cac partimento" :sub "✗ too long: no realization found in time"}
                                    :out [[1 {:count nil :why "too many to count here, and no realization found in time"}]]}
                                   (nil? R)
                                   ;; where it dies, and why: for whoever wrote the bass (a person, or Claude)
                                   (let [d (when (fn? (.-deadEnd ob)) (try (.deadEnd ob) (catch :default _ nil)))
                                         nt (when d (get (:notes (:bass st)) (.-note d)))
                                         where (when nt (str "nothing can go on at note " (inc (.-note d)) " (" (or (:name nt) (api/midi-name (:midi nt)))
                                                             (when-let [f (some-> (aget (.-units ob) (.-unit d)) .-chord)] (str ", " f)) ")"
                                                             (when-let [rs (seq (js->clj (.-reasons d)))]
                                                               (str ": " (str/join "; " (map first (take 3 rs)))))))
                                         why (str "no realization over this bass" (when where (str " — " where)))]
                                     {:state st :show {:main "cac partimento" :sub (str "✗ " why)}
                                      :out [[1 (cond-> {:count 0 :why why} d (assoc :note (inc (.-note d))))]]})
                                   :else
                                   {:state (update st :seed #(mod (* (or % 1) 48271) 2147483647))
                                    :show (shown ob st)
                                    :out [[1 (cond-> {:count (or (:count st) "too many to count here") :key (str (.. ob -key -tonic) " " (.. ob -key -mode))
                                                      :style (style-name ob)}
                                               (seq (.-unknown ob)) (assoc :unknown (js->clj (.-unknown ob))))]
                                          [0 (realization ob st (:bass st) R)]]})))))]
                (cond
                  ;; the kernel counted: kept, and the first realization (or the judgement) sent
                  ;; the styles listed (outlet 1)
                  (and (= inlet :task) (= :styles (:task value)))
                  (if (:error value) {:state st :show {:main "cac" :sub (str "✗ " (:error value))}} {:state st :out [[1 {:styles (:value value)}]]})
                  (= value :styles) {:state st :effects [[:styles {}]]}
                  ;; two voices judged by a canon's rules: where they break them, and why (outlet 1), and the voices written
                  ;; again with :why on the notes that break one (their analysis layer)
                  (and (= inlet :task) (= :judge-two (:task value)))
                  (cond
                    (:error value) {:state st :show {:main "cac judge" :sub (str "✗ " (:error value))}}
                    (:bass (:value value)) (build (dissoc (assoc st :bass-judge true) :ob) (:tree st))
                    :else
                    (let [J (:judgement (:value value)) {:keys [upper lower]} (:two st) dv (:dux J)
                          write (fn [b vname]
                                  (let [role (if (= vname dv) "dux" "comes")
                                        rs (filter #(#{role "both"} (:voice %)) (:reasons J))]
                                    (into [:voice {:name role}]
                                          (map (fn [s nt]
                                                 (let [w (seq (distinct (keep #(when (and (<= s (:unit %)) (< (:unit %) (+ s (:units nt)))) (:why %)) rs)))
                                                       a (cond-> {:dur (:dur nt)} w (assoc :why (str/join "; " w)))]
                                                   (if (:midi nt) [:note (assoc a :pitch (or (:name nt) (api/midi-name (:midi nt))))] [:rest a])))
                                               (reductions + 0 (map :units (:notes b))) (:notes b)))))
                          ;; (from the highest voice down, whichever is the dux)
                          voices [(write upper "upper") (write lower "lower")]]
                      {:state (dissoc st :bass-judge)
                       :show {:main (str "cac judge · " (:style J))
                              :sub (cond (:ok J) (str "✓ by the rules · " (:imitation J) " · k " (:k J) " · d " (:d J))
                                         (:reasons J) (str "✗ " (count (:reasons J)) " · " (:why J))
                                         :else (str "✗ " (:why J)))}
                       :out (cond-> [[1 (-> (select-keys J [:ok :why :dux :k :d :imitation :key :style])
                                            (assoc :reasons (mapv #(update % :unit inc) (:reasons J)))
                                            (cond-> (seq (:unknown J)) (assoc :unknown (:unknown J))))]]
                              (:dux J) (conj [0 (into [:piece {:key (:key J)}] voices)]))}))
                  (= inlet :task)
                  (if (:error value)
                    {:state st :show {:main (str "cac " (name op)) :sub (str "✗ " (:error value))}}
                    (emit (assoc st :ob (:ob (:value value)) :count (:count (:value value))) :engine))
                  ;; (a change first: [:voices 3] is a vector with a keyword first, as a tree's node is)
                  over? (if (:tree st) (build (dissoc st :ob :bass-judge) (:tree st)) {:state st})
                  ;; a tree: the given
                  (api/tree? value) (build (dissoc st :ob :bass-judge) value)
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
