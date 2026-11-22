;; follow · where a performer is in a tree, from what pitch~ and onset~ hear (discussion #204)
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…). Pure logic: no audio of its own.
(let [;; ── a note heard: where the pitch settles ──
      settle-s 0.06      ; seconds a new pitch must hold before it is a new note (a slide or a vibrato that passes is not)
      onset-s 0.15       ; an onset at most this long before a pitch begins the note there (onset~ hears the attack first)
      apart 0.6          ; semitones: a pitch this far from the note that sounds is another note
      r3 (fn [x] (/ (js/Math.round (* x 1000)) 1000))
      ;; its words: follow [ahead] [band] [descriptor …] — numbers first, then the names of what it listens to on
      ;; inlets 3, 4 … (from features~, chroma~: a number or a list of numbers each)
      ;; the word hmm: the probabilistic follower (discussion #308)
      opts (fn [args] (let [ns (filter number? args) ws (filter keyword? args)]
                        {:ahead (or (first ns) 4) :band (or (second ns) 0.6)
                         :model (if (some #{:hmm} ws) :hmm :greedy)
                         :listen (vec (remove #{:hmm :greedy} ws))}))
      ;; what a note sounded like (discussion #308): the mean of each descriptor while it sounded, kept in the take
      mean (fn [[sum n]] (if (number? sum)
                           (/ (js/Math.round (* 10000 (/ sum n))) 10000)
                           (mapv (fn [x] (/ (js/Math.round (* 10000 (/ x n))) 10000)) sum)))
      add (fn [acc v] (let [[sum n] acc]
                        (cond (nil? acc) [v 1]
                              (and (number? sum) (number? v)) [(+ sum v) (inc n)]
                              (and (vector? sum) (sequential? v) (= (count sum) (count v))) [(mapv + sum v) (inc n)]
                              :else acc)))
      close-note (fn [st] (cond-> (dissoc st :acc :cur-id)
                            (and (:cur-id st) (seq (:acc st)))
                            (update-in [:prof (:cur-id st)] merge (into {} (map (fn [[k a]] [k (mean a)]) (:acc st))))))
      ;; what it shows: its label, and where the performer is on the tree it follows (its box, :from), which the page
      ;; draws on that tree's continuum
      shown (fn [st] (cond-> {:on (:on st) :notes (count (remove :rest (:score st))) :at (:at st) :found (count (get-in st [:fl :played])) :cue (:cue st)
                              :from (:from st)}
                       (:fl st) (merge (api/follow-view (:fl st)))))
      ;; what the follower found: where the performer is (outlets 0 and 1), the wires that went on (what they send, 2)
      found-out (fn [st found]
                  (let [at (last (keep (fn [[k x]] (when (= k :at) x)) found))
                        cues (keep (fn [[k x]] (when (= k :wire) x)) found)]
                    [(cond-> st at (assoc :at (:beat at)) (seq cues) (assoc :cue (:send (last cues))))
                     (vec (concat (when at [[0 (:beat at)] [1 [:note (:id at)]]])
                                  (map (fn [c] [2 (:send c)]) cues)))]))
      ;; a note begins at t (seconds from start) at midi: the follower hears it
      note-on (fn [st t midi]
                (let [fl (if (:cur st) (api/follow-release (:fl st) t) (:fl st))
                      [fl found] (api/follow-hear fl t midi (:desc st))]
                  (found-out (assoc (close-note st) :fl fl :cur {:t t :midi midi :pitchless (nil? midi)} :pend nil
                                    :cur-id (:id (second (last (filter (fn [[k]] (= k :at)) found)))))
                             found)))
      ;; an elastic wire that will go on by itself if no note comes first: a look again then
      wake (fn [st at]
             (let [d (when (:on st) (api/follow-due (:fl st)))]
               (when (and d (not= d (:wake st))) [[(+ (:t0 st) d 0.001) 0 [:tick]]])))
      out-of (fn [[st outs] extra at]
               (let [w (wake st at)
                     st (if w (assoc st :wake (api/follow-due (:fl st))) st)]
                 (cond-> {:state st :show (shown st)}
                   (seq outs) (assoc :out outs)
                   extra (merge extra)
                   w (update :later (fnil into []) w))))
      ;; one value of pitch~ (Hz; 0 when it hears none), at t
      hear (fn [st hz t]
             (let [cur (:cur st) m (when (pos? hz) (api/hz->midi hz))]
               (cond
                 (nil? m) [(cond-> (assoc (close-note st) :pend nil :cur nil) cur (update :fl api/follow-release t)) []]
                 ;; after silence (or a sound without a pitch), or an onset just before: a note begins
                 (or (nil? cur) (:pitchless cur)) (note-on st (if (and (:onset st) (<= (- t (:onset st)) onset-s)) (:onset st) t) m)
                 (and (:onset st) (> (:onset st) (+ (:t cur) 0.05)) (<= (- t (:onset st)) onset-s))
                 (note-on (assoc st :onset nil) (:onset st) m)
                 ;; near the note that sounds: still it
                 (<= (js/Math.abs (- m (:midi cur))) apart) [(assoc st :pend nil) []]
                 ;; another pitch: a new note if it holds (a look again in a moment, as pitch~ sends only changes)
                 (and (:pend st) (<= (js/Math.abs (- m (second (:pend st)))) 0.5) (>= (- t (first (:pend st))) settle-s))
                 (note-on st (first (:pend st)) m)
                 (and (:pend st) (<= (js/Math.abs (- m (second (:pend st)))) 0.5)) [st []]
                 :else [(assoc st :pend [t m]) []])))]
  {;; ── about ──
   :class "follow"
   :license "MPL-2.0"
   :doc "Follows a performer through a tree (discussion #204): a tree on the right (from a tree box), Hz on the left (from pitch~: 0 when it hears none) and onsets in the middle (from onset~: a note begins there even on the same pitch). start begins at the top of the tree, stop ends; [:here id] tells it where the performer is (a click on a note of the tree's continuum does). Each note heard is matched with a note of the tree a little ahead of where the performer was (with the word hmm, a probability is kept for every note instead, so that a doubtful sound does not lose the place and a wrong step is undone when the next sounds point elsewhere), by its pitch (an octave off still counts) and by when it was expected at the tempo the performer goes; wrong notes and ornaments are let pass, skipped notes are skipped. Out: the written beat where the performer is, [:note id], what each wire sends when it goes on — wires are written on their notes ([:note {… :wire {:send :swell :kind :elastic :tol 0.5}}], or (wire! :bN note :swell {…})): a rigid one on its note (or caught up once at the next note found if it was passed over), an elastic one on its note if the performer gets there in time and else on its own, at the time the note was expected plus its tolerance (or at that time whatever the performer does, if the electronics lead) —, and at stop the take — where each note was played, in seconds, and with descriptors named after its numbers (follow rms centroid chroma: one inlet each, from features~ or chroma~) what each note sounded like (their means while it sounded, :profile) — as [:take {…}]: into the tree box's inlet it is kept only for you (a message [:take … :work] keeps it in the tree), and its continuum can show it."
   :usage "follow [ahead] [band] [hmm] [descriptor …]"
   :io (fn [b] [(+ 3 (count (remove #{:hmm :greedy} (filter keyword? (:args b))))) 4])
   :dynamic-io true
   :size [124 30]


   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [st (or state {})]
                (cond
                  ;; the tree to follow
                  (= inlet 2)
                  (if (and (vector? value) (keyword? (first value)))
                    (let [sc (api/follow-score value)
                          st (assoc st :score sc :wires (api/follow-wires sc) :from (:from (meta value))
                                    ;; what rehearsals learned of how its notes sound ((learn! :bN), discussion #308)
                                    :profiles (when (map? (second value)) (:profiles (second value))))]
                      {:state st :show (shown st)})
                    {})
                  (= value :start)
                  (if (seq (:score st))
                    (let [st (assoc st :on true :t0 at :fl (api/follow-start (:score st) {:ahead (api/clamp (:ahead (opts args)) 1 32) :band (api/clamp (:band (opts args)) 0.1 2)
                                                                                         :wires (:wires st) :profiles (:profiles st) :model (:model (opts args))})
                                    :cur nil :pend nil :onset nil :at nil :cue nil :wake nil :acc nil :cur-id nil :prof {} :desc {})]
                      (out-of [st []] nil at))
                    {:effects [[:print "follow: no tree yet (connect a tree box to its right inlet)"]]})
                  (not (:on st)) {}
                  (= value :stop)
                  (let [t (- at (:t0 st))
                        st (close-note st)
                        fl (if (:cur st) (api/follow-release (:fl st) t) (:fl st))
                        n (inc (or (:takes st) 0))
                        tk (api/follow-take fl {:id (str "follow-" (r3 (:t0 st))) :name (str "followed " n)
                                                :made (.toISOString (js/Date.))})
                        ;; what each note sounded like, for the notes the take played
                        tk (if (and tk (seq (:prof st)))
                             (assoc tk :profile (into {} (filter (fn [[id _]] (contains? (:when tk) id))) (:prof st)))
                             tk)
                        st (assoc st :on false :fl fl :cur nil :takes n)]
                    (cond-> {:state st :show (shown st)} tk (assoc :out [[3 [:take tk]]])))
                  ;; an onset: a note begins there; with descriptors and no pitch heard soon after, a sound without a pitch
                  ;; (a multiphonic, a noise), found by what is heard of it
                  (= inlet 1) (cond-> {:state (assoc st :onset (- at (:t0 st)))}
                                (seq (:listen (opts args))) (assoc :later [[(+ at 0.08) 0 [:pitchless (- at (:t0 st))]]]))
                  (and (vector? value) (= :pitchless (first value)))
                  (if (and (seq (:desc st)) (or (nil? (:cur st)) (:pitchless (:cur st))) (= (second value) (:onset st)))
                    (out-of (note-on (assoc st :onset nil) (second value) nil) nil at)
                    {})
                  ;; a descriptor (inlet 3 on: features~, chroma~), added to what the note that sounds sounded like
                  (>= inlet 3)
                  (if-let [k (get (:listen (opts args)) (- inlet 3))]
                    (if (or (number? value) (and (sequential? value) (every? number? value)))
                      (let [v (if (number? value) value (vec value))]
                        ;; the latest value of each (what a note is matched with), and its mean while a note sounds (the take)
                        {:state (cond-> (assoc-in st [:desc k] v) (:cur-id st) (update-in [:acc k] add v))})
                      {})
                    {})
                  ;; "I am here" (a click on a note of the continuum, discussion #308): the follower goes there
                  (and (vector? value) (= :here (first value)))
                  (if-let [j (first (keep-indexed (fn [i e] (when (= (str (second value)) (:id e)) i)) (:score st)))]
                    (let [t (- at (:t0 st))
                          [fl found] (api/follow-here (:fl st) t j)]
                      (out-of (found-out (assoc (close-note st) :fl fl :cur nil :pend nil :wake nil) found) nil at))
                    {})
                  (and (= value [:settle]) (:pend st)) (out-of (hear st (api/midi->hz (second (:pend st))) (- at (:t0 st))) nil at)
                  ;; time passes: the elastic wires due go on
                  (= value [:tick])
                  (let [[fl found] (api/follow-tick (:fl st) (- at (:t0 st)))]
                    (out-of (found-out (assoc st :fl fl :wake nil) found) nil at))
                  (and (= inlet 0) (number? value))
                  (let [t (- at (:t0 st)) [st2 outs] (hear st value t)]
                    (out-of [st2 outs] (when (and (:pend st2) (not= (:pend st2) (:pend st)))
                                         {:later [[(+ at settle-s 0.005) 0 [:settle]]]}) at))
                  :else {})))

   ;; ── view ──
   :derive (fn [{:keys [shown]}]
             {:label (cond (:on shown) (str "● follow · " (if (:at shown) (str "beat " (api/nice (:at shown))) "…") (when (:cue shown) (str " · " (:cue shown))))
                           :else (str "follow · " (or (:notes shown) 0) " notes"))})
   :view [[:rect {:x 2 :y 2 :w 120 :h 26 :r 3 :stroke :grid :fill :bg}]
          [:text {:x 8 :y 19 :size 10 :fill :soft} :$label]]})
