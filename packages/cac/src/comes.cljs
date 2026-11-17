;; comes · counterpoint live: you play the dux and the comes answers (discussions #172, #192 and #248)
;; Part of @kairotic/cac. Written against the Kairotic API (api/…).
;; One box for the canon and its mirrors, as Study 50 found them: the comes is a reader of the dux at a speed — 1 a
;; canon, 1/2 an augmentation (twice as slow), −1 a crab (the dux backwards) — k steps away, d beats late, upright or
;; inverted (an inversion; backwards and inverted, a table canon). The speed decides how the work is written, and so
;; how it is played:
;;   speed > 0   forwards: you play the dux and the comes answers (Study 41's kernel in counterpoint.mjs). By turns
;;               (the default) one note in is one beat, the same note again the note held (a tie); live, a pulse on
;;               the right inlet is a beat and a note lasts until the next one is struck — a note of three pulses in
;;               2/2 turns the canon to 3/2, one longer than a bar ends the section (unless nocues).
;;   speed −1    from both ends to the middle (Study 43's mirror.mjs): by turns, a note at the start, then one at the
;;               end; live (Study 46), your note and at the same beat the box's answer at the end of your own line,
;;               and at the middle the rest of your line to read while the box plays your first half backwards.
;; The other speeds of Study 50 (a hemiola, 2/3; a sesquialtera, 3/2; a diminution, 2…) are not in the box yet.
(let [;; a line as a musical tree (for a tree box): a measure of b beats, a beat a half note (:dur 2), a note held
      ;; over the beat tied, the last note to the end of its bar, nothing sounding a rest
      work-tree (fn [midi b & lines]
                  (let [voice (fn [xs]
                                (let [xs (vec xs) n (count xs)
                                      beat (fn [i] (let [v (get xs i) dur (if (= i (dec n)) (* 2 (- b (mod i b))) 2)]
                                                     (if (nil? v)
                                                       [:rest {:dur dur}]
                                                       [:note (cond-> {:pitch (/ (js/Math.round (* 1000 (midi v))) 1000) :dur dur}
                                                                (and (< (inc i) n) (= v (get xs (inc i)))) (assoc :tie true))])))]
                                  (into [:voice] (for [bar (partition-by #(quot % b) (range n))]
                                                   (into [:measure {:meter [b 2]}] (map beat bar))))))]
                    (into [:piece] (map voice lines))))
      ;; ── forwards: a canon, an inversion, an augmentation ──
      fwd (let [origins ["npm:@kairotic/cac@0.1.0/dist/counterpoint.mjs" "kairotic/packages/cac/counterpoint.mjs"]
            hz (fn [m] (* 440 (js/Math.pow 2 (/ (- m 69) 12))))
            semis-of-hz (fn [f] (* 12 (/ (js/Math.log (/ f 261.6255653005986)) (js/Math.log 2))))
            ev-hz (fn [e] (let [h (or (:freq e) (:hz e))] (if (sequential? h) (first h) h)))
            log2 (fn [x] (/ (js/Math.log x) (js/Math.log 2)))
            round2 (fn [x] (/ (js/Math.round (* 100 x)) 100))
            ;; the parameters that can change on the way (a message [:k -4], [:imitation 0.5], [:mode :hypodorian]…)
            params #{:mode :system :k :d :beats :imitation :bars :upbeat :species :axis}
            ;; the canon as the kernel is asked for it: the box's text, what was changed since, the meter now
            opts-of (fn [st args]
                      (let [o (merge {:mode (:mode args) :system (:system args) :k (:k args) :d (:d args) :beats (:beats args)
                                      :imitation (:imitation args) :bars (:bars args) :upbeat (:upbeat args)
                                      :species (if (:fourth args) 4 2)
                                      :transform (cond (:inversion args) :inversion (:augmentation args) :augmentation :else :canon)}
                                     (:over st))
                            b (or (:meter st) (:beats o))]
                        (-> o (assoc :beats b :maxHold b) (update :mode #(some-> % name)) (update :transform #(some-> % name))
                            ;; a system: a name (:pentatonic) or the data itself (an EDN map, Study 42)
                            (update :system #(if (keyword? %) (name %) %)))))
            ;; (a new text starts over)
            fresh (fn [args] {:sig args :D [] :C [] :pending [] :held [] :cps {} :wanted #{} :section 1
                              :temp (:temp args) :seed (:seed args) :seed0 (:seed args)})
            ;; chance (the temperature and the seed): a random number of the box's own (Park–Miller), kept in its state;
            ;; at temperature 0 none is used, and the comes is the one the futuribles say
            rnd (fn [st] (let [x (mod (* (max 1 (:seed st 1)) 16807) 2147483647)] [(assoc st :seed x) (/ (dec x) 2147483646)]))
            chance (fn [st] (if (> (:temp st 0) 0.001)
                              (let [[st r] (rnd st) [st r2] (rnd st)] [st #js {:temp (:temp st) :r r :r2 r2}])
                              [st #js {}]))
            ;; a kernel for the canon o: counted already, being counted, or asked for now (a task, outside the pure logic)
            ensure (fn [st o]
                     (if (or (contains? (:cps st) o) (contains? (:wanted st) o))
                       [st []]
                       [(update st :wanted conj o) [[:kernel {:opts o}]]]))
            ;; live: the canon as it is, and the same in 3/2 (a note of three pulses may turn it)
            ensure-live (fn [st args]
                          (let [[st fx] (ensure st (opts-of st args))
                                [st fx2] (ensure st (opts-of (assoc st :meter 3) args))]
                            [st (into fx fx2)]))
            futs (fn [cp D C]
                   (mapv (fn [f] (let [x (.-note f)]
                                   {:midi (.midi cp x) :name (.name cp x) :futures (.-futures f)
                                    :bits (round2 (log2 (.-futures f))) :score (round2 (.-score f))
                                    :comes (when (some? (.-comes f)) (.midi cp (.-comes f)))}))
                         (.futuribles cp (clj->js D) (clj->js C))))
            report (fn [cp st r]
                     (let [D (:D st) C (:C st) t (count D) n (.-n cp) b (.-beats cp) ph (.. cp -spec -phase)
                           pos (+ (dec t) ph) cnt (.count cp (clj->js D) (clj->js C))]
                       (cond-> {:t t :n n :finished (>= t n) :section (:section st) :meter b :system (.-systemName cp) :mode (.-mode cp)
                                :futures cnt :bits (round2 (if (pos? cnt) (log2 cnt) -1))
                                :dux (mapv (fn [x] (.midi cp x)) D)
                                :comes-line (mapv (fn [c] (when (some? c) (.midi cp c))) C)
                                :obligations (vec (.obligations cp (clj->js D) (clj->js C)))}
                         (.-modeNote cp) (assoc :note (.-modeNote cp))
                         (pos? t) (assoc :bar (inc (quot pos b)) :beat (inc (mod pos b))
                                         :held (and (> t 1) (= (peek D) (nth D (- t 2)))))
                         r (assoc :asked (+ 60 (.-asked r)) :played (.midi cp (.-note r)) :corrected (.-corrected r)
                                  :reason (.-reason r) :comes (when (some? (.-comes r)) (.midi cp (.-comes r)))))))
            shown (fn [cp st r]
                    (let [D (:D st) C (:C st) x (peek D) c (peek C)]
                      {:status (str (when (:live st) (str "§" (:section st) " · ")) (count D) "/" (.-n cp) " · "
                                    (round2 (log2 (max 1 (.count cp (clj->js D) (clj->js C))))) " bits"
                                    (when (:live st) (str " · " (.-beats cp) "/2")))
                       :dux (if x (.name cp x) "–") :comes (if (some? c) (.name cp c) "–")
                       :corrected (boolean (and r (.-corrected r))) :reason (or (when r (.-reason r)) (.-modeNote cp))}))
            ;; what sounds: both voices, as a keyboard or a player sends them — their Hz (outlet 0) after their voice ids
            ;; (outlet 1), for one synth~. A voice's id is where its note was struck (section and beat): a note held
            ;; keeps its id and goes on sounding; a note struck again, even the same, is a new id and is struck again.
            sounding (fn [cp st]
                       (let [D (:D st) C (:C st)
                             start (fn [xs] (loop [i (dec (count xs))] (if (and (pos? i) (= (nth xs i) (nth xs (dec i)))) (recur (dec i)) i)))
                             sec (:section st 1)
                             vs (cond-> []
                                  (seq D) (conj [(keyword (str "d" sec "-" (start D))) (hz (.midi cp (peek D)))])
                                  (some? (peek C)) (conj [(keyword (str "c" sec "-" (start C))) (hz (.midi cp (peek C)))]))]
                         [[1 (mapv first vs)] [0 (mapv second vs)]]))
            silence [[1 []] [0 []]]
            ;; one pair placed: the dux as played (or corrected) and the comes with it, sounding together
            placed (fn [cp st r]
                     (let [D0 (:D st) C0 (:C st)
                           st (-> st (update :D conj (.-note r)) (update :C conj (.-comes r)))
                           x (.-note r) c (.-comes r)
                           done (>= (count (:D st)) (.-n cp))]
                       {:state (cond-> st done (assoc :idle true :section (inc (:section st 1))))
                        :show (shown cp st r)
                        :out (cond-> (into [[3 (report cp st r)] [2 (futs cp (:D st) (:C st))]] (sounding cp st))
                               ;; finished: both voices as a musical tree (for a tree box, its score)
                               done (conj [4 (work-tree (fn [v] (.midi cp v)) (.-beats cp) (:D st) (:C st))]))}))
            ;; a pitch asked for: after the last canon, a new one
            play (fn [cp st asked]
                   (let [st (if (or (:idle st) (>= (count (:D st)) (.-n cp))) (assoc st :D [] :C [] :idle false) st)]
                     (let [[st o] (chance st)]
                       (if-let [r (.play cp (clj->js (:D st)) (clj->js (:C st)) asked o)]
                         (placed cp st r)
                         {:state st}))))
            merge-res (fn [a b] {:state (:state b) :show (or (:show b) (:show a)) :out (into (vec (:out a)) (:out b))
                                 :effects (into (vec (:effects a)) (:effects b))})
            chain (fn [cp st askeds] (reduce (fn [acc a] (merge-res acc (play cp (:state acc) a))) {:state st :out []} askeds))
            at-point (fn [cp st]
                       {:state st :show (shown cp st nil)
                        :out (into [[3 (report cp st nil)] [2 (futs cp (:D st) (:C st))]] silence)})
            ;; what a pitch asked for is (semitones above C4), from a number, a MIDI note, an event or the keys held
            asked-of (fn [value args st]
                       (let [num (fn [v] (if (:midi args) (- v 60) (when (pos? v) (semis-of-hz v))))]
                         (cond
                           (number? value) (if (or (:midi args) (pos? value)) [:note (num value)] [:release])
                           (and (vector? value) (= :midi (first value)) (number? (second value))) [:note (- (second value) 60)]
                           ;; an event: :freq (midiin, oscin) or :hz (a player's, a list: its first note)
                           (and (map? value) (number? (ev-hz value)))
                           (if (and (pos? (ev-hz value)) (pos? (or (:gate value) 1))) [:note (semis-of-hz (ev-hz value))] [:release])
                           (and (sequential? value) (every? number? value))
                           (cond (empty? value) [:release]
                                 (some #{(first value)} (:held st)) [:same]
                                 :else [:note (num (first value))])
                           :else nil)))
            ;; ── live: the section ends, and the next note begins a new canon ──
            cue (fn [st kind]
                  (let [st (cond-> (assoc st :idle true :cur nil :dur 0 :section (inc (:section st 1)))
                             (= kind :ternary) (assoc :meter 3))]
                    {:state st
                     :show {:status (str "§" (:section st) " · " (if (= kind :ternary) "3/2 next" "a new canon next"))}
                     :out (into [[3 {:cue kind :section (:section st) :meter (or (:meter st) (:beats (:over st)))}]] silence)}))
            ;; a pulse: the note struck since the last one, or the one sounding held over the beat
            pulse (fn [st args at late]
                    (let [period (when (and (:lastp st) (not late)) (- at (:lastp st)))
                          st (cond-> st (not late) (assoc :lastp at) (and period (pos? period)) (assoc :period period))
                          o (opts-of st args)
                          cp (if (or (:idle st) (nil? (:cp st))) (get (:cps st) o) (:cp st))
                          b (when cp (.-beats cp))]
                      (cond
                        ;; a new note: the canon goes on, or a new one begins (once its kernel is counted)
                        (:struck st)
                        (if cp
                          (let [res (play cp (assoc st :cp cp) (:struck st))]
                            (update res :state assoc :struck nil :cur (:struck st) :dur 1 :last :struck))
                          (let [[st fx] (ensure-live st args)] {:state st :effects fx}))
                        ;; nothing sounding: the comes rests (what still sounded is let go)
                        (or (:idle st) (nil? (:cur st)) (nil? cp))
                        {:state (assoc st :last :idle) :out (when (#{:hold :struck} (:last st)) silence)}
                        ;; held three pulses in 2/2: the canon turns to 3/2
                        (and (= 2 b) (>= (inc (:dur st)) 3) (not (:nocues args)))
                        (let [res (cue st :ternary) [s2 fx] (ensure (:state res) (opts-of (:state res) args))]
                          (assoc res :state (assoc s2 :last :cue) :effects fx))
                        ;; held longer than a bar: the end of the section
                        (and (> (inc (:dur st)) b) (not (:nocues args)))
                        (let [res (cue st :end)] (assoc-in res [:state :last] :cue))
                        ;; without cues, a note held longer than the canon allows: the canon waits for the next one
                        (> (inc (:dur st)) b)
                        {:state (assoc st :dur (inc (:dur st)) :last :wait)}
                        ;; held over the beat (a tie)
                        :else
                        (if-let [r (let [[_ o] (chance st)] (.hold cp (clj->js (:D st)) (clj->js (:C st)) o))]
                          (-> (placed cp (first (chance st)) r) (update :state assoc :dur (inc (:dur st)) :last :hold))
                          {:state st}))))
            ;; a note struck in live: for the next pulse, or for the last one if it came just after it (late)
            strike (fn [st args at s]
                     (let [late (and (:lastp st) (:period st) (< (- at (:lastp st)) (* 0.3 (:period st))))]
                       (cond
                         (and late (= :hold (:last st)) (seq (:D st)))
                         (let [st (-> st (update :D pop) (update :C pop))
                               res (play (:cp st) st s)]
                           (update res :state assoc :cur s :dur 1 :last :struck :struck nil))
                         (and late (#{:idle :cue} (:last st)))
                         (pulse (assoc st :struck s) args at true)
                         :else {:state (assoc st :struck s)})))]
        {;; ── tasks: a kernel and its count, outside the pure logic ──
         :tasks {:kernel (fn [{:keys [opts]} _box]
                           (-> (api/import-module origins)
                               (.then (fn [m]
                                        (let [cp (.live m (clj->js opts))]
                                          (.then (.warm cp) (fn [_] {:cp cp})))))))}
      
         ;; ── logic ──
         :receive (fn [{:keys [inlet value state args at]}]
                    (let [st (if (and state (= args (:sig state))) state (assoc (fresh args) :live (:live args)))
                          at (or at 0)
                          o (opts-of st args)
                          cp (:cp st)]
                      (cond
                        ;; a kernel counted: kept; the one the canon waits for is the canon's, and what waited is played
                        (= inlet :task)
                        (let [o2 (:opts (:arg value))]
                          (cond
                            (not (contains? (:wanted st) o2)) {}
                            (:error value) {:state (update st :wanted disj o2) :show {:status (str "✗ " (:error value))}}
                            :else
                            (let [k (:cp (:value value))
                                  st (-> st (update :wanted disj o2) (update :cps assoc o2 k))]
                              (cond
                                (or (not= o2 o) (and cp (not (:idle st)))) {:state st}
                                (:live st) {:state (assoc st :cp k) :show (shown k st nil)}
                                :else (let [waiting (:pending st) st (assoc st :cp k :pending [])]
                                        (if (seq waiting) (chain k st waiting) (at-point k st)))))))
      
                        ;; a parameter changed: by turns at once (a new canon), live at the next section
                        ;; chance: the temperature or the seed, kept (the canon as it is; a seed starts the chance again)
                        (and (vector? value) (#{:temp :seed} (first value)) (number? (second value)))
                        (let [[kk v] value] {:state (cond-> (assoc st kk v) (= kk :seed) (assoc :seed0 v))})
      
                        (and (vector? value) (contains? params (first value)) (some? (second value)))
                        (let [[kk v] value
                              st (cond-> (assoc-in st [:over kk] v) (= kk :beats) (assoc :meter v))
                              o (opts-of st args)
                              [st fx] (ensure st o)]
                          (if (:live st)
                            {:state st :effects fx}
                            (let [k (get (:cps st) o)
                                  st (assoc st :cp k :D [] :C [] :idle false)]
                              (if k (assoc (at-point k st) :effects fx) {:state st :effects fx}))))
      
                        ;; the pulse (live)
                        (= inlet 1)
                        (if (and (:live st) (or cp (get (:cps st) o)))
                          (pulse st args at false)
                          (let [[st fx] (if (:live st) (ensure-live st args) (ensure st o))] {:state st :effects fx}))
      
                        ;; nothing to play with yet: the kernel is asked for (and what arrives is kept)
                        (and (nil? cp) (not (:live st)))
                        (let [a (asked-of value args st)
                              st (cond-> st
                                   (= :note (first a)) (update :pending conj (second a))
                                   (and (sequential? value) (every? number? value)) (assoc :held (vec value)))
                              [st fx] (ensure st o)]
                          {:state st :effects fx :show {:status "counting the futures…"}})
      
                        ;; the end of the section, from outside (an analysis that heard a cadence, a phrase…)
                        (#{:end} value)
                        (if (:idle st) {:state st} (cue st :end))
      
                        (#{:reset} value)
                        (if cp (at-point cp (assoc st :D [] :C [] :held [] :idle false :cur nil :struck nil :seed (:seed0 st 1))) {:state st})
                        (#{:back} value)
                        (if cp (at-point cp (-> st (update :D (fn [v] (if (seq v) (pop v) v))) (update :C (fn [v] (if (seq v) (pop v) v))))) {:state st})
                        (#{:engine} value)
                        (if cp
                          (let [st (if (or (:idle st) (>= (count (:D st)) (.-n cp))) (assoc st :D [] :C [] :idle false) st)]
                            (let [[st o] (chance st)]
                              (if-let [r (.engine cp (clj->js (:D st)) (clj->js (:C st)) o)] (placed cp st r) {:state st})))
                          {:state st})
                        (and (not (:live st)) (#{:hold} value))
                        (if (and cp (seq (:D st)) (not (:idle st)))
                          (let [[st o] (chance st)]
                            (if-let [r (.hold cp (clj->js (:D st)) (clj->js (:C st)) o)] (placed cp st r) {:state st}))
                          {:state st})
      
                        :else
                        (let [[kind x] (asked-of value args st)
                              st (if (and (sequential? value) (every? number? value)) (assoc st :held (vec value)) st)]
                          (cond
                            (and (= kind :note) (:live st)) (let [[st fx] (ensure-live st args) res (strike st args at x)]
                                                               (update res :effects #(into (vec %) fx)))
                            (= kind :note) (play cp st x)
                            (and (= kind :release) (not (:live st))) {:state st :out [[1 []] [0 []]]}
                            :else {:state st})))))
      })
      ;; ── backwards: a crab or a table canon, from both ends to the middle ──
      crab (let [origins-cp ["npm:@kairotic/cac@0.1.0/dist/counterpoint.mjs" "kairotic/packages/cac/counterpoint.mjs"]
            origins-mi ["npm:@kairotic/cac@0.1.0/dist/mirror.mjs" "kairotic/packages/cac/mirror.mjs"]
            semis-of-hz (fn [f] (* 12 (/ (js/Math.log (/ f 261.6255653005986)) (js/Math.log 2))))
            ev-hz (fn [e] (let [h (or (:freq e) (:hz e))] (if (sequential? h) (first h) h)))
            log2 (fn [x] (/ (js/Math.log x) (js/Math.log 2)))
            params #{:mode :system :k :beats :bars :axis}
            ;; a key asked for is the note of the system it is nearest (within a quarter of a tone or so): not a correction
            off? (fn [asked x] (> (js/Math.abs (- asked x)) 0.45))
            ;; (chance: the temperature and the seed change the game, not the canon)
            chance #{:temp :seed}
            ;; (the box's words, then what was changed since: a mode or a system as a name, or a system as data)
            opts-of (fn [st args]
                      (-> (merge {:mode (:mode args) :system (:system args) :k (:k args) :beats (:beats args) :bars (:bars args)
                                  :table (boolean (:table args)) :axis nil}
                                 (:over st))
                          (update :mode #(some-> % name))
                          ;; a system: a name (:pentatonic) or the data itself (an EDN map, Study 42)
                          (update :system #(if (keyword? %) (name %) %))))
            fresh (fn [args] {:sig args :M [] :s 0 :pending nil :hist [] :k 0 :temp (:temp args) :seed (:seed args) :seed0 (:seed args)})
            load (fn [st o]
                   (let [k (inc (:k st 0))]
                     {:state (assoc st :k k :loading true :mi nil)
                      :show {:main "comes · crab" :sub "counting the futures…"}
                      :effects [[:mirror {:k k :opts o}]]}))
            ;; the dux as the kernel reads it: an array with holes where nothing is written yet
            js-M (fn [st n] (let [a (js/Array. n)] (doseq [[i v] (map-indexed vector (:M st))] (when (some? v) (aset a i v))) a))
            pos-of (fn [mi s] (when (< s (.-steps mi)) (vec (aget (.-order mi) s))))
            ;; the candidates for the next note: at the start of the step, or at its end once the start is chosen
            cands (fn [mi st]
                    (let [s (:s st) M (js-M st (.-n mi))]
                      (if (some? (:pending st)) (.fanSecond mi M s (:pending st)) (.fan mi M s))))
            futs (fn [cp mi st]
                   (vec (for [c (cands mi st) :when (pos? (or (.-futures c) 0))]
                          {:midi (.midi cp (.-note c)) :name (.name cp (.-note c)) :futures (.-futures c)})))
            ;; a voice as a pattern: the notes held over the beat joined
            pattern (fn [cp xs]
                      (let [runs (partition-by identity xs)]
                        {:note (mapv (fn [r] (.midi cp (first r))) runs) :dur (mapv count runs)}))
            report (fn [cp mi st extra]
                     (let [n (.-n mi) lns (.lines mi (js-M st n)) s (:s st) steps (.-steps mi) pos (pos-of mi s)
                           mid (fn [v] (when (and (some? v) (not (undefined? v))) (.midi cp v)))]
                       (merge {:step s :steps steps :closed (>= s steps) :system (.-systemName cp) :mode (.-mode cp)
                               :writing (cond (>= s steps) :closed (some? (:pending st)) :end :else :start)
                               :beat (when pos (inc (if (some? (:pending st)) (peek pos) (first pos))))
                               :futures (.count mi (js-M st n) s)
                               :dux (mapv mid (array-seq (.-D lns))) :comes (mapv mid (array-seq (.-C lns)))}
                              extra)))
            shown (fn [cp mi st]
                    (let [steps (.-steps mi) s (:s st)]
                      {:main (str (if (.-inverted mi) "table · " "crab · ") (count (remove nil? (:M st))) "/" (.-n mi) " notes")
                       :sub (cond (and (zero? s) (nil? (:pending st)) (.-modeNote cp)) (.-modeNote cp)
                                  (>= s steps) "closed: the work is written"
                                  (some? (:pending st)) (str "now the note at the end · " (.count mi (js-M st (.-n mi)) s) " ways")
                                  :else (str "step " (inc s) "/" steps ": the note at the start"))}))
            ;; a line as a musical tree, for a score (a tree box): a measure of b beats, a beat a half note
            ;; (:dur 2), a note held over the beat tied, the last note to the end of its bar; from the bar of beat
            ;; `from`, and the beats before `upto` as rests (what is already played)
            voice-of (fn [cp xs b from upto]
                       (let [n (count xs) x (fn [i] (let [v (get xs i)] (when (and (some? v) (not (undefined? v))) v)))
                             beat (fn [i]
                                    (let [v (x i) dur (if (= i (dec n)) (* 2 (- b (mod i b))) 2)]
                                      (if (or (< i upto) (nil? v))
                                        [:rest {:dur dur}]
                                        [:note (cond-> {:pitch (/ (js/Math.round (* 1000 (.midi cp v))) 1000) :dur dur}
                                                 (and (< (inc i) n) (>= (inc i) upto) (= v (x (inc i)))) (assoc :tie true))])))]
                         (into [:voice]
                               (for [bar (partition-by #(quot % b) (range (* b (quot from b)) n))]
                                 (into [:measure {:meter [b 2]}] (map beat bar))))))
            ;; the whole work, both voices, as a tree
            piece-of (fn [cp mi M]
                       (let [b (or (.. mi -spec -b) 1) lns (.lines mi M)]
                         [:piece (voice-of cp (vec (array-seq (.-D lns))) b 0 0) (voice-of cp (vec (array-seq (.-C lns))) b 0 0)]))
            at-point (fn [cp mi st extra]
                       (let [closed (>= (:s st) (.-steps mi)) n (.-n mi) lns (.lines mi (js-M st n))]
                         {:state st :show (shown cp mi st)
                          :out (cond-> []
                                 closed (conj [4 (piece-of cp mi (js-M st n))])
                                 true (conj [3 (report cp mi st extra)] [2 (futs cp mi st)]))}))
            ;; a pitch asked for (semitones above C4): the nearest candidate with a future; between two as near, the
            ;; one with more futures
            nearest (fn [cp cs asked]
                      (let [ok (filter #(pos? (or (.-futures %) 0)) cs)]
                        (when (seq ok)
                          (first (sort-by (juxt #(js/Math.abs (- (.semis cp (.-note %)) asked)) #(- (.-futures %))) ok)))))
            write (fn [mi st vals]
                    (let [pos (pos-of mi (:s st)) n (.-n mi)
                          M (vec (concat (:M st) (repeat (max 0 (- n (count (:M st)))) nil)))]
                      (assoc st :M (reduce (fn [M [p v]] (assoc M p v)) M (map vector pos vals))
                             :s (inc (:s st)) :pending nil :hist (conj (:hist st) (select-keys st [:M :s :pending])))))
            choose (fn [cp mi st asked]
                     (let [pos (pos-of mi (:s st))]
                       (if-not pos
                         {:state st}
                         (let [c (nearest cp (cands mi st) asked)
                               r (js/Math.round asked)
                               extra (when c {:asked (+ 60 r) :played (.midi cp (.-note c)) :corrected (off? asked (.semis cp (.-note c)))})]
                           (cond
                             (nil? c) {:state st}
                             (and (= 2 (count pos)) (nil? (:pending st))) (at-point cp mi (assoc st :pending (.-note c)) extra)
                             (= 2 (count pos)) (at-point cp mi (write mi st [(:pending st) (.-note c)]) extra)
                             :else (at-point cp mi (write mi st [(.-note c)]) extra))))))
            ;; the engine: the candidate nearest the note beside it (a step), more futures between two as near
            engine (fn [cp mi st]
                     (let [pos (pos-of mi (:s st)) M (:M st)]
                       (when pos
                         (let [second? (some? (:pending st))
                               nb (if second? (get M (inc (peek pos))) (get M (dec (first pos))))
                               cs (filter #(pos? (or (.-futures %) 0)) (cands mi st))]
                           (when (seq cs)
                             (let [c (first (sort-by (juxt #(if nb (js/Math.abs (- (js/Math.abs (- (.-note %) nb)) 1)) 0) #(- (.-futures %))) cs))]
                               (.semis cp (.-note c))))))))
            ;; ── live (Study 46): the crab played beat by beat ──
            leap-cost (fn [a b] (if (or (nil? a) (nil? b)) 0 (get {0 1.5 1 0 2 0.3 3 0.6 4 0.7 5 1 7 1} (js/Math.abs (- b a)) 2)))
            ;; a random number of the box's own (Park–Miller), kept in its state: a game can be played again
            rnd (fn [st] (let [x (mod (* (max 1 (:seed st 1)) 16807) 2147483647)] [(assoc st :seed x) (/ (dec x) 2147483646)]))
      ;; a choice among candidates by their cost: at temperature 0 the cheapest (no chance in it), above it a softmax of
            ;; -cost/temperature drawn with the box's own random numbers (its seed: the same game again with the same seed)
            choose-by (fn [st cs cost temp]
                        (let [cs (vec (sort-by (juxt cost #(.-note %)) cs))]
                          (cond (empty? cs) [st nil]
                                (<= (or temp 0) 0.001) [st (first cs)]
                                :else (let [m (cost (first cs)) ws (mapv #(js/Math.exp (/ (- m (cost %)) temp)) cs)
                                            [st r] (rnd st) x (* r (reduce + ws))]
                                        [st (loop [j 0 acc 0] (let [acc (+ acc (nth ws j))]
                                                                (if (or (< x acc) (= j (dec (count cs)))) (nth cs j) (recur (inc j) acc))))]))))
            ;; the end of your line, chosen by the box for your note a: a step from the note after it, the more futures
            ;; the better; :end in the futuribles is the cheapest (at temperature 0 the one the box will answer)
            end-cands (fn [mi st a]
                        (let [s (:t st 0) n (.-n mi) q (- n 1 s)
                              cs (filter #(pos? (or (.-futures %) 0)) (.fanSecond mi (js-M st n) s a))]
                          [cs (fn [c] (- (leap-cost (.-note c) (get (:M st) (inc q))) (* 0.2 (log2 (.-futures c)))))]))
            end-for (fn [mi st a] (let [[cs cost] (end-cands mi st a)] (some-> (second (choose-by st cs cost 0)) .-note)))
            pick-end (fn [mi st a] (let [[cs cost] (end-cands mi st a) [st c] (choose-by st cs cost (:temp st 0))] (when c [st (.-note c)])))
            live-phase (fn [mi st] (let [t (:t st 0)] (cond (< t (.-steps mi)) :choose (< t (.-n mi)) :read :else :done)))
            engine-note (fn [mi st t] (let [e (get (:M st) (.source mi t))] (when (some? e) (.T mi e))))
            hz-of (fn [cp v] (* 440 (js/Math.pow 2 (/ (- (.midi cp v) 69) 12))))
            ;; what sounds at beat t, live: your note (as played, corrected or read) and the box's, as a keyboard or a
            ;; player sends them — their Hz (outlet 0) after their voice ids (outlet 1), for one synth~. A voice's id is
            ;; the beat where its note was struck: a note held over the beat keeps it and goes on sounding.
            sounding (fn [cp mi st t]
                       (let [start (fn [xs] (loop [i (dec (count xs))] (if (and (pos? i) (= (nth xs i) (nth xs (dec i)))) (recur (dec i)) i)))
                             you (subvec (:M st) 0 (inc t))
                             box (mapv #(engine-note mi st %) (range (inc t)))
                             vs (cond-> []
                                  (some? (peek you)) (conj [(keyword (str "y" (start you))) (hz-of cp (peek you))])
                                  (some? (peek box)) (conj [(keyword (str "e" (start box))) (hz-of cp (peek box))]))]
                         [[1 (mapv first vs)] [0 (mapv second vs)]]))
            live-out (fn [cp mi st b]
                       (let [ph (live-phase mi st) t (:t st 0) n (.-n mi) steps (.-steps mi)
                             mid (fn [v] (when (some? v) (.midi cp v)))
                             next-opts (case ph
                                         :choose (let [two? (= 2 (count (pos-of mi t)))]
                                                   (vec (for [c (.fan mi (js-M st n) t) :when (pos? (or (.-futures c) 0))]
                                                          (cond-> {:midi (.midi cp (.-note c)) :name (.name cp (.-note c)) :futures (.-futures c)}
                                                            ;; what the box will answer at the end of your line if you play it
                                                            two? (assoc :end (some->> (end-for mi st (.-note c)) (.midi cp)))))))
                                         :read [{:midi (mid (get (:M st) t)) :name (.name cp (get (:M st) t)) :futures 1}]
                                         [])]
                         {:state st
                          :show {:main (str (if (.-inverted mi) "table" "crab") " live · beat " (min n t) "/" n)
                                 :sub (case ph :choose (str "play: " (count next-opts) " notes can close it")
                                               :read (str "read: " (.name cp (get (:M st) t)))
                                               "done: the crab is played")}
                          :out (cond-> [(case ph
                                          ;; the score (for a tree box): at the middle what is left of your line to read, the
                                          ;; beats of its bar already played as rests; at the end the whole crab, both voices.
                                          ;; Twice a crab, not every beat: each tree written into a tree box is an event of
                                          ;; the work's history
                                          :read (when (= t steps) [4 (voice-of cp (:M st) (.. mi -spec -b) t t)])
                                          :done [4 (piece-of cp mi (js-M st n))]
                                          nil)
                                        [3 (merge {:t (:t b) :phase ph :you (mid (:you b)) :engine (mid (:engine b)) :n n :middle steps :system (.-systemName cp) :mode (.-mode cp)
                                                   :ways (if (= ph :choose) (.count mi (js-M st n) t) 1)}
                                                  (select-keys b [:played :corrected :auto :deviation :expected])
                                                  (when (= t (- steps 2)) {:cue :middle :in 2}))]
                                        [2 next-opts]]
                                 true (#(vec (remove nil? %)))
                                 (some? (:t b)) (into (if (some? (:you b)) (sounding cp mi st (:t b)) [])))}))
            ;; a beat: what you played (asked, or nil: on a pulse the box plays for you), and what the box answers
            live-beat (fn [cp mi st asked]
                        (let [n (.-n mi) t (:t st 0) ph (live-phase mi st)]
                          (case ph
                            :choose
                            (let [cs (filter #(pos? (or (.-futures %) 0)) (.fan mi (js-M st n) t))
                                  [st c] (if (some? asked)
                                           [st (first (sort-by (juxt #(js/Math.abs (- (.semis cp (.-note %)) asked)) #(- (.-futures %))) cs))]
                                           ;; nothing played on the pulse: the box plays your note, by the same taste
                                           (choose-by st cs (fn [c] (leap-cost (get (:M st) (dec t)) (.-note c))) (:temp st 0)))]
                              (if-not c
                                {:state st}
                                (let [a (.-note c) pos (pos-of mi t)
                                      [st z] (if (= 2 (count pos)) (or (pick-end mi st a) [st nil]) [st nil])
                                      M (vec (concat (:M st) (repeat (max 0 (- n (count (:M st)))) nil)))
                                      M (cond-> (assoc M (first pos) a) (some? z) (assoc (second pos) z))
                                      st (assoc st :M M :t (inc t) :s (inc t))
                                      b {:t t :you a :engine (engine-note mi st t)
                                         :played (when (some? asked) (+ 60 (js/Math.round asked)))
                                         :corrected (and (some? asked) (off? asked (.semis cp a))) :auto (nil? asked)}]
                                  (live-out cp mi st b))))
                            :read
                            (let [w (get (:M st) t)
                                  dev (and (some? asked) (off? asked (.semis cp w)))
                                  st (cond-> (assoc st :t (inc t)) dev (update :devs (fnil inc 0)))]
                              (live-out cp mi st (cond-> {:t t :you w :engine (engine-note mi st t)}
                                                   dev (assoc :deviation true :played (+ 60 (js/Math.round asked)) :expected (.midi cp w)))))
                            ;; done: a note begins a new crab
                            (if (some? asked) (recur cp mi (assoc st :M [] :t 0 :s 0 :devs 0) asked) {:state st}))))
            asked-of (fn [value args]
                       (cond
                         (number? value) (if (:midi args) (- value 60) (when (pos? value) (semis-of-hz value)))
                         (and (vector? value) (= :midi (first value)) (number? (second value))) (- (second value) 60)
                         ;; an event: :freq (midiin, oscin) or :hz (a player's, a list: its first note)
                         (and (map? value) (number? (ev-hz value)) (pos? (ev-hz value)) (pos? (or (:gate value) 1))) (semis-of-hz (ev-hz value))
                         (and (sequential? value) (seq value) (every? number? value))
                         (if (:midi args) (- (first value) 60) (semis-of-hz (first value)))
                         :else nil))]
        {;; ── tasks: the kernel and its count, outside the pure logic ──
         :tasks {:mirror (fn [{:keys [opts]} _box]
                           (-> (js/Promise.all #js [(api/import-module origins-cp) (api/import-module origins-mi)])
                               (.then (fn [[cp mm]]
                                        ;; the canon's mode, range and system from live (the box's pitches too: L's midi, name, semis)
                                        (let [L (.live cp (clj->js {:mode (:mode opts) :system (:system opts) :k (:k opts)
                                                                    :beats (:beats opts) :bars (:bars opts) :axis (:axis opts)}))
                                              sp (.-spec L)
                                              mi (.mirror mm #js {:tonic (.-tonic sp) :lo (.-lo sp) :hi (.-hi sp) :n (.-n sp) :b (.-b sp)
                                                                  :spacing (.-spacing sp) :starts (.-starts sp) :maxHold (.-b sp) :system (.-system sp)
                                                                  :transform #js {:kind (if (:table opts) "table" "crab") :k (.-k L) :axis (.-axis L)}})]
                                          (.then (.countAsync mi #js {}) (fn [_] {:cp L :mi mi})))))))}
      
         ;; ── logic ──
         :receive (fn [{:keys [inlet value state args]}]
                    (let [st (if (and state (= args (:sig state))) state (assoc (fresh args) :k (:k state 0)))
                          o (opts-of st args)
                          {:keys [cp mi]} st]
                      (cond
                        (= inlet :task)
                        (cond (not= (:k (:arg value)) (:k st)) {}
                              (:error value) {:state (assoc st :loading false) :show {:main "comes · crab" :sub (str "✗ " (:error value))}}
                              :else (let [{:keys [cp mi]} (:value value)
                                          st (assoc st :cp cp :mi mi :loading false :M [] :s 0 :pending nil :hist [])]
                                      (cond (:live args) (if-let [a (:waiting st)] (live-beat cp mi (dissoc st :waiting) a) (live-out cp mi (assoc st :t 0) {:t 0}))
                                            (:waiting st) (choose cp mi (dissoc st :waiting) (:waiting st))
                                            :else (at-point cp mi st nil))))
      
                        ;; a parameter changed: a new work
                        ;; the temperature or the seed: kept, the kernel as it is (a seed starts the game's chance again)
                        (and (vector? value) (contains? chance (first value)) (number? (second value)))
                        (let [[kk v] value]
                          {:state (cond-> (assoc st kk v) (= kk :seed) (assoc :seed0 v))})
      
                        (and (vector? value) (contains? params (first value)))
                        (let [st (assoc-in st [:over (first value)] (second value))] (load st (opts-of st args)))
      
                        (nil? mi)
                        (let [a (asked-of value args) st (cond-> st (some? a) (assoc :waiting a))]
                          (if (:loading st) {:state st} (load st o)))
      
                        ;; live: a pulse is a beat (the note played since the last one, or the box's for you)
                        (and (:live args) (= inlet 1))
                        (let [a (:struck st)] (live-beat cp mi (assoc st :struck nil :pulsed true) a))
                        (and (:live args) (#{:reset} value))
                        (update (live-out cp mi (assoc st :M [] :t 0 :s 0 :devs 0 :struck nil :seed (:seed0 st 1)) {:t 0}) :out into [[1 []] [0 []]])
                        (and (:live args) (#{:engine :bang} value)) (live-beat cp mi st nil)
                        (and (:live args) (#{:back} value)) {:state st}
                        (and (:live args) (some? (asked-of value args)))
                        (let [a (asked-of value args)] (if (:pulsed st) {:state (assoc st :struck a)} (live-beat cp mi st a)))
      
                        (#{:reset} value) (at-point cp mi (assoc st :M [] :s 0 :pending nil :hist []) nil)
                        (#{:back} value)
                        (cond (some? (:pending st)) (at-point cp mi (assoc st :pending nil) nil)
                              (seq (:hist st)) (at-point cp mi (merge st (peek (:hist st)) {:hist (pop (:hist st))}) nil)
                              :else {:state st})
                        (#{:engine :bang} value)
                        (if-let [a (engine cp mi st)] (choose cp mi st a) {:state st})
      
                        :else
                        (if-let [a (asked-of value args)] (choose cp mi st a) {:state st}))))
      })
      ;; ── the relation: the box's words and what was changed since ([:speed -1], [:inverted true]) ──
      relation (fn [st args]
                 (let [o (merge (select-keys args [:speed :inverted]) (select-keys (:over st) [:speed :inverted]))]
                   {:speed (:speed o 1) :inverted (boolean (:inverted o))}))
      supported? (fn [{:keys [speed inverted]}] (or (== speed 1) (== speed -1) (and (== speed 0.5) (not inverted))))
      ;; the arguments each engine reads
      fwd-args (fn [args {:keys [speed inverted]}]
                 (-> (select-keys args [:system :mode :k :d :beats :imitation :bars :upbeat :temp :seed :fourth :live :nocues :midi])
                     (assoc :inversion (and inverted (== speed 1)) :augmentation (== speed 0.5))
                     ;; (bars 0: the relation's own length, 8 bars forwards)
                     (update :bars #(if (pos? %) % 8))))
      crab-args (fn [args {:keys [inverted]}]
                  (-> (select-keys args [:system :mode :k :beats :bars :temp :seed :live :midi]) (assoc :table inverted)
                      ;; (6 bars backwards: a crab is counted from both ends, and longer takes longer)
                      (update :bars #(if (pos? %) % 6))))]
  {;; ── about ──
   :class "comes"
   :license "MPL-2.0"
   :doc "Counterpoint live: you play the dux and the comes answers (Studies 41–46, 50). The comes is a reader of the dux at a speed: 1 a canon (the default), 0.5 an augmentation (twice as slow, a strict canon), −1 a crab (the dux backwards); inverted turns it upside down about the final (or [:axis 62]): an inversion, or with −1 a table canon, the score read from across the table. k steps away (−7 an octave below) and, forwards, d beats late. Each note is checked against the rules of the style — the mode's range, its melodic intervals, consonance on the strong beats, a dissonance passing on a weak one or held as a suspension, no parallel 5ths or octaves… — and against the future: a note from which the work could not be finished is not allowed either, and is corrected to the nearest one that can (a black key too), the box saying why. Forwards (speed 1 or 0.5) you play the dux and the comes answers: by turns (the default) one note in is one beat, the same note again (or :hold) held over it; with live a pulse on the right inlet (a metro) is a beat, a note lasts until the next, a note of three pulses in 2/2 turns the canon to 3/2 and one longer than a bar ends the section (with nocues neither: other boxes decide, with [:beats 3] and :end). With imitation below 1 the comes is chosen by the soft rules: near the dux's notes (0.5–0.9), following its motion (0.2–0.4) or free; with fourth your line is a cantus firmus and the comes syncopated. Backwards (speed −1) the work is written from both ends to the middle: by turns a note at the start, then one at the end; live (Study 46) your note, and at the same beat the box's answer at the end of your own line, a cue two beats before the middle, and at the middle the rest of your line to read (outlet 4) while the box plays your first half backwards. The system (Study 42) is diatonic by default, or meantone, septimal31, pentatonic, or an EDN map; the mode one of its modes; the box's words name them in any order (comes hypodorian, comes pentatonic penta-A -1). Out: the Hz of both voices sounding after their voice ids (outlet 1), for one synth~; the futuribles (outlet 2), the notes that can come next with their futures counted exactly; where the work is (outlet 3); and the finished work as a musical tree (outlet 4), for a tree box. [:speed -1], [:inverted true], [:k -4], [:d 2], [:mode …], [:system …], [:bars 5], [:imitation 0.5], [:beats 3], [:species 4], [:axis 62] change it; :engine, :back, :reset; [:temp 1.5], [:seed 7] its chance. Numbers are Hz (MIDI with midi); a list is the keys held; an event (:freq, or a player's :hz)."
   :usage "comes [system] [mode] [speed 1] [k -7] [d 3] [beats 2] [imitation 1] [bars 0] [upbeat 0] [temp 0] [seed 1] [inverted] [fourth] [live] [nocues] [midi]"
   :io [2 5]
   :size [170 46]
   :args [[:system nil] [:mode nil] [:speed 1] [:k -7] [:d 3] [:beats 2] [:imitation 1] [:bars 0] [:upbeat 0] [:temp 0] [:seed 1]
          [:inverted false] [:fourth false] [:live false] [:nocues false] [:midi false]]

   ;; ── tasks: a kernel and its count (forwards), or the mirror's (backwards), outside the pure logic ──
   :tasks {:kernel (:kernel (:tasks fwd)) :mirror (:mirror (:tasks crab))}

   ;; ── logic: the relation chooses the engine; each keeps its own state ──
   :receive (fn [{:keys [inlet value state args] :as ctx}]
              (let [st (or state {})
                    ;; the relation changed on the way: kept (a new work)
                    st (if (and (vector? value) (#{:speed :inverted} (first value)))
                         (assoc-in st [:over (first value)] (if (= :inverted (first value)) (boolean (second value)) (second value)))
                         st)
                    rel (relation st args)
                    back? (neg? (:speed rel))]
                (cond
                  (not (supported? rel))
                  {:state st :show {:main "comes" :sub (str "✗ speed " (:speed rel) (when (:inverted rel) " inverted") ": 1, 0.5 or −1 (inverted: 1 or −1)")}}
                  ;; a task: to the engine that asked for it
                  (= inlet :task)
                  (let [e (if (= :mirror (:task value)) crab fwd) k (if (= :mirror (:task value)) :crab :fwd)
                        a (if (= :mirror (:task value)) (crab-args args rel) (fwd-args args rel))
                        r ((:receive e) (assoc ctx :state (get st k) :args a))]
                    (cond-> (assoc r :state (assoc st k (:state r (get st k)))) (nil? (:state r)) (dissoc :state)))
                  :else
                  (let [[e k a] (if back? [crab :crab (crab-args args rel)] [fwd :fwd (fwd-args args rel)])
                        ;; a relation message starts the engine again (a new work, its kernel asked for)
                        value (if (and (vector? value) (#{:speed :inverted} (first value))) :reset value)
                        sub (get st k)
                        sub (if (and (= :reset value) (nil? sub)) nil sub)
                        r ((:receive e) (assoc ctx :state sub :args a :value value))]
                    (assoc r :state (assoc st k (if (contains? r :state) (:state r) sub)))))))

   ;; ── view ──
   :derive (fn [{:keys [shown]}]
             {:main (or (:main shown) (if (:dux shown) (str (:dux shown) "  →  " (:comes shown)) "comes"))
              :sub (or (:sub shown) (:status shown) "play the dux")
              :mark (if (:corrected shown) 4 0)})
   :view [[:rect {:x 2 :y 2 :w 166 :h 42 :r 3 :stroke :grid :fill :bg}]
          [:rect {:x 4 :y 4 :w :$mark :h 38 :r 1 :stroke nil :fill :kairos}]
          [:text {:x 12 :y 20 :size 13} :$main]
          [:text {:x 12 :y 36 :size 9 :fill :soft} :$sub]]})
