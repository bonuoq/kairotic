;; cancrizans · a crab canon written from both ends to the middle (discussions #172 and #192, Study 43)
;; Part of @kairotic/theory. Written against the Kairotic API (api/…).
;; The comes is the dux backwards, both voices at once (a crab); with table, backwards and upside down — the one
;; score read by a second player from across the table, a musical ambigram. Such a canon cannot be written from
;; the beginning: the comes at the start is the dux at the end. It is written from both ends to the middle, by
;; turns: each step a note at the start, then one at the end, and the futuribles are the ways to close the work in
;; the middle, counted exactly (mirror.mjs beside this component: Study 43's kernel, on counterpoint.mjs). A note
;; that breaks a rule, or from which the work could not be closed, is corrected to the nearest one that can. When
;; the work is closed, both voices go out as patterns, for a pbind and a player.
;; With live (Study 46) the crab is played, beat by beat: in the first half you play your note and the box answers at
;; the same beat with the end of your own line (written ahead, among the notes with a future, the ones that leave
;; more of them first); a cue comes two beats before the middle; at the middle the rest of your line comes out as a
;; score to read, and in the second half the box plays your first half backwards while you read it (a note you play
;; that is not the one written is said, as a deviation). On a pulse (the right inlet) a beat goes on whether you
;; played or not (the box plays your note for you); without one, a note in is a beat.
(let [origins-cp ["npm:@kairotic/theory@0.8.0/dist/counterpoint.mjs" "kairotic/packages/theory/counterpoint.mjs"]
      origins-mi ["npm:@kairotic/theory@0.8.0/dist/mirror.mjs" "kairotic/packages/theory/mirror.mjs"]
      semis-of-hz (fn [f] (* 12 (/ (js/Math.log (/ f 261.6255653005986)) (js/Math.log 2))))
      log2 (fn [x] (/ (js/Math.log x) (js/Math.log 2)))
      params #{:mode :system :k :beats :bars :table :axis}
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
                :show {:main "cancrizans" :sub "counting the futures…"}
                :effects [[:kernel {:k k :opts o}]]}))
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
                 (merge {:step s :steps steps :closed (>= s steps)
                         :writing (cond (>= s steps) :closed (some? (:pending st)) :end :else :start)
                         :beat (when pos (inc (if (some? (:pending st)) (peek pos) (first pos))))
                         :futures (.count mi (js-M st n) s)
                         :dux (mapv mid (array-seq (.-D lns))) :comes (mapv mid (array-seq (.-C lns)))}
                        extra)))
      shown (fn [cp mi st]
              (let [steps (.-steps mi) s (:s st)]
                {:main (str (if (.-inverted mi) "table · " "crab · ") (count (remove nil? (:M st))) "/" (.-n mi) " notes")
                 :sub (cond (>= s steps) "closed: the work is written"
                            (some? (:pending st)) (str "now the note at the end · " (.count mi (js-M st (.-n mi)) s) " ways")
                            :else (str "step " (inc s) "/" steps ": the note at the start"))}))
      ;; a line as a musical tree, for a score (a freqt shown as a score): a measure of b beats, a beat a half note
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
                           true (conj [3 (report cp mi st extra)] [2 (futs cp mi st)])
                           closed (conj [1 (pattern cp (array-seq (.-C lns)))] [0 (pattern cp (array-seq (.-D lns)))]))}))
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
      live-out (fn [cp mi st b]
                 (let [ph (live-phase mi st) t (:t st 0) n (.-n mi) steps (.-steps mi)
                       mid (fn [v] (when (some? v) (.midi cp v)))
                       score (when (and (= ph :read) (= t steps)) (vec (for [i (range steps n)] (get (:M st) i))))
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
                                    ;; the score: from the middle what is left of your line to read, the beats played
                                    ;; as rests; at the end the whole crab, both voices
                                    :read [4 (voice-of cp (:M st) (.. mi -spec -b) t t)]
                                    :done [4 (piece-of cp mi (js-M st n))]
                                    nil)
                                  [3 (merge {:t (:t b) :phase ph :you (mid (:you b)) :engine (mid (:engine b)) :n n :middle steps
                                             :ways (if (= ph :choose) (.count mi (js-M st n) t) 1)}
                                            (select-keys b [:played :corrected :auto :deviation :expected])
                                            (when (= t (- steps 2)) {:cue :middle :in 2}))]
                                  [2 next-opts]]
                           true (#(vec (remove nil? %)))
                           (some? (:engine b)) (conj [0 [(hz-of cp (:engine b))]])
                           score (conj [1 (pattern cp score)]))}))
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
                   (and (map? value) (number? (:freq value)) (pos? (or (:gate value) 1))) (semis-of-hz (:freq value))
                   (and (sequential? value) (seq value) (every? number? value))
                   (if (:midi args) (- (first value) 60) (semis-of-hz (first value)))
                   :else nil))]
  {;; ── about ──
   :class "cancrizans"
   :license "MPL-2.0"
   :doc "A crab canon written from both ends to the middle (Study 43): the comes is the dux backwards, both voices at once; with table, backwards and upside down about an axis ([:axis 62], a MIDI note; the final by default) — the one score read by a second player from across the table, a musical ambigram. It cannot be written from the beginning (the comes at the start is the dux at the end), so it is written by turns from both ends: each step a note at the start, then one at the end. A note that breaks a rule of the style (as comes's), or from which the work could not be closed, is corrected to the nearest one that can. On the right, the futuribles — the notes that can come next and the ways each leaves to close the work in the middle, counted exactly — and where the work is. When it closes, the dux and the comes go out (left) as patterns, {:note [...] :dur [...]} with the notes held joined, for a pbind and a player, and both as a musical tree (outlet 4), for a freqt shown as a score. Notes as comes takes them: Hz, a list of keys held, [:midi 62], or MIDI numbers with midi. :engine writes the next note itself; :back takes one back; :reset starts again. The system (Study 42) is comes's: diatonic by default, or meantone, septimal31 or pentatonic (cancrizans pentatonic, [:system :septimal31]), or an EDN map; its modes, distances and tuning come with it. [:k -4], [:mode :hypodorian], [:system :pentatonic], [:bars 5], [:table true], [:axis 62] change the canon (and start again). With live (Study 46) the crab is played beat by beat: in the first half you play your note (or the nearest that can close the crab) and the box answers at the same beat with the end of your own line, written ahead (the notes that leave more futures first) — its futuribles say beforehand, as :end, what it will answer to each note (at temp 0, the default, exactly that; above it, the most likely, the box drawing among the answers with its seed: the same seed, the same game); two beats before the middle a cue {:cue :middle :in 2}; at the middle the rest of your line goes out (outlet 1, and as a tree on outlet 4, each beat read turned into a rest; at the end the whole crab) as the score to read — the box's answers so far, backwards, the first the last end of your line it wrote (with an odd number of beats the middle note is shared) —, and in the second half the box plays your first half backwards (outlet 0, Hz) while you read it — a note that is not the one written is said, as a deviation. On a pulse (the right inlet: a metro, a pulse) a beat goes on whether you played or not; without one, a note in is a beat. After the last beat, a note begins a new crab."
   :usage "cancrizans [mode] [system] [k -7] [beats 2] [bars 6] [temp 0] [seed 1] [table] [live] [midi]"
   :io [2 5]
   :size [170 46]
   :args [[:mode nil] [:system nil] [:k -7] [:beats 2] [:bars 6] [:temp 0] [:seed 1] [:table false] [:live false] [:midi false]]

   ;; ── tasks: the kernel and its count, outside the pure logic ──
   :tasks {:kernel (fn [{:keys [opts]} _box]
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
                        (:error value) {:state (assoc st :loading false) :show {:main "cancrizans" :sub (str "✗ " (:error value))}}
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
                  (and (:live args) (#{:reset "reset"} value))
                  (live-out cp mi (assoc st :M [] :t 0 :s 0 :devs 0 :struck nil :seed (:seed0 st 1)) {:t 0})
                  (and (:live args) (#{:engine "engine" :bang} value)) (live-beat cp mi st nil)
                  (and (:live args) (#{:back "back"} value)) {:state st}
                  (and (:live args) (some? (asked-of value args)))
                  (let [a (asked-of value args)] (if (:pulsed st) {:state (assoc st :struck a)} (live-beat cp mi st a)))

                  (#{:reset "reset"} value) (at-point cp mi (assoc st :M [] :s 0 :pending nil :hist []) nil)
                  (#{:back "back"} value)
                  (cond (some? (:pending st)) (at-point cp mi (assoc st :pending nil) nil)
                        (seq (:hist st)) (at-point cp mi (merge st (peek (:hist st)) {:hist (pop (:hist st))}) nil)
                        :else {:state st})
                  (#{:engine "engine" :bang} value)
                  (if-let [a (engine cp mi st)] (choose cp mi st a) {:state st})

                  :else
                  (if-let [a (asked-of value args)] (choose cp mi st a) {:state st}))))

   ;; ── view ──
   :derive (fn [{:keys [shown]}] {:main (or (:main shown) "cancrizans") :sub (or (:sub shown) "write the dux from both ends")})
   :view [[:rect {:x 2 :y 2 :w 166 :h 42 :r 3 :stroke :grid :fill :bg}]
          [:text {:x 10 :y 20 :size 13} :$main]
          [:text {:x 10 :y 36 :size 9 :fill :soft} :$sub]]})
