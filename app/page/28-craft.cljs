;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page: the craft as tools (discussion #351, step 1)
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).
;;
;; One Claude for every box: what Claude makes (an agent's content, the Claude tab's patch) it makes knowing the
;; boxes around it, read in one common shape, and with the craft of the work's classes at hand. Two tools:
;;
;;   describe_box   a box of the patch on screen as Claude reads it: its class, text and ports, and for a tree (a tree
;;                  box, or the tree a score or canvas shows) its key, meter, voices — each as a line of notes, with
;;                  its range — and the analysis it carries (on its root: phrases, plans…; on its notes: :fig :deg…).
;;   apply_class    any class applied to a box (or to a value), as a box of that class would receive it: its outlets
;;                  (a tree described as above), what it shows, its errors. `cac judge` says where a tree breaks the
;;                  rules, `cac partimento` realizes a bass, `comes` writes a canon… Every class is a tool, so a new
;;                  class is a new tool with nothing to add here.
;;
;; Nothing goes into the work: the class runs here, apart (its :tasks too, a package fetched if the work has none of
;; it), with no box, no history and no sound.

(in-ns 'user)

;; ───────────────────────── a tree, as Claude reads it ─────────────────────────

(defn craft-num
  "A number as short as it reads: 2 → 2, 0.5 → 0.5, 1/3 → 0.333."
  [x]
  (let [r (/ (js/Math.round (* x 1000)) 1000)] (if (== r (js/Math.round r)) (js/Math.round r) r)))

(defn craft-name
  "A note's name as the melody shorthand writes it: its written name, or the name of its pitch (a microtone stays a
   number of MIDI with its cents)."
  [e]
  (str/lower-case (str (or (:name e) (mt/pitch-name (:pitch e))))))

(defn voice-line
  "The notes of one voice (events in time order) in the melody shorthand: \"c4/1 d4/1 r/2 c4+e4/2\" — durations in
   beats, a rest where nothing sounds, notes that start together as a chord."
  [es t0]
  (loop [es (seq (sort-by :t es)) t t0 out []]
    (if-not es
      (str/join " " out)
      (let [s (:t (first es))
            same (sort-by :pitch (take-while #(< (js/Math.abs (- (:t %) s)) 1e-6) es))
            more (drop (count same) es)
            d (apply max (map :dur same))
            gap (- s t)
            out (if (> gap 1e-6) (conj out (str "r/" (craft-num gap))) out)]
        (recur (seq more) (max t (+ s d))
               (conj out (str (str/join "+" (map craft-name same)) "/" (craft-num d))))))))

(def craft-skip
  ;; what an event carries that is not for Claude to read (where it is in the tree, its time, what was performed)
  (into #{:kind :t :dur :pitch :voice :path :name} mt/performative-keys))

(defn describe-tree
  "A tree as Claude reads it (discussion #351): its key, meter and tempo, its voices — name, range, the notes as a line
   of the melody shorthand — the analysis on its root (phrases, plans…) and on its notes (with the beat and voice of
   each). opts {:max-notes 400}."
  ([tree] (describe-tree tree {}))
  ([tree {:keys [max-notes] :or {max-notes 400}}]
   (let [t (mt/expand tree)
         root (mt/attrs t)
         es (mt/events t)
         notes (filter #(= :note (:kind %)) es)
         t0 (if (seq es) (apply min (map :t es)) 0)
         names (distinct (map :voice notes))
         by-voice (group-by :voice notes)
         voice (fn [v]
                 (let [ns (get by-voice v) ps (map :pitch ns)
                       lo (apply min-key :pitch ns) hi (apply max-key :pitch ns)]
                   {:name (str (or v "voice"))
                    :notes (count ns)
                    :range [(craft-name lo) (craft-name hi)]
                    :mean (craft-num (/ (reduce + ps) (count ps)))
                    :line (if (> (count ns) max-notes) (str (voice-line (take max-notes ns) t0) " …") (voice-line ns t0))}))
         voices (sort-by :mean > (map voice names))
         marks (vec (for [e notes
                          :let [a (into {} (remove (fn [[k v]] (or (craft-skip k) (nil? v)))) e)]
                          :when (seq a)]
                      (merge {:beat (craft-num (:t e)) :voice (str (:voice e)) :note (craft-name e)} a)))
         meter (some (fn [x] (when (mt/node? x) (:meter (mt/attrs x)))) (tree-seq mt/node? mt/kids t))]
     (cond-> {:summary (mt/summary t)
              :beats (craft-num (mt/duration t))
              :voices (mapv #(dissoc % :mean) voices)}
       (:key root) (assoc :key (:key root))
       (some? meter) (assoc :meter (if (vector? meter) (str/join "/" meter) (str meter)))
       (:tempo root) (assoc :tempo (:tempo root))
       (seq (dissoc root :key :tempo :meter :name)) (assoc :root (dissoc root :key :tempo :meter :name))
       (seq marks) (assoc :analysis (if (> (count marks) 120) (conj (vec (take 120 marks)) "…") marks))
       (seq (mt/problems t)) (assoc :problems (vec (take 6 (mt/problems t))))))))

(defn box-tree
  "The tree box id holds (or a score or canvas shows), or nil."
  [id]
  (try (as-tree id) (catch :default _ nil)))

(defn describe-box
  "(describe-box :b3): box :b3 of the patch on screen as Claude reads it — {:id :class :text :ports} and, if it holds
   music, :tree (see describe-tree); an agent says what it was built from; a component its doc."
  [id]
  (let [id (if (keyword? id) id (keyword (str/replace (str id) #"^:" "")))
        b (need-box id)
        k (klass (:text b))
        tr (box-tree id)]
    (cond-> {:id id :class k :text (:text b)
             :ports (try (io b) (catch :default _ nil))
             :to (vec (for [[a o z i] (:lines (current)) :when (= a id)] [o z i]))
             :from (vec (for [[a o z i] (:lines (current)) :when (= z id)] [a o i]))}
      tr (assoc :tree (describe-tree tr))
      (agent? b) (assoc :agent (try (agent-info id) (catch :default _ nil)))
      (and (not tr) (some? (:data b)) (not (embedded? b)) (not (definition? b)))
      (assoc :data (ai/cut (pr-str (:data b)) 1500))
      (embedded? b) (assoc :inside (vec (for [[cid cb] (:boxes (or (:data b) empty-patch))] (str (name cid) " " (:text cb))))))))

(defn around-agent
  "What Claude is told of the patch an agent box is in: the boxes beside it, and what reaches its inlets."
  [p id]
  (let [bs (sort-by (fn [[i _]] (box-num i)) (remove (fn [[i b]] (or (= i id) (definition? b))) (:boxes p)))
        line (fn [[i b]] (str (name i) "  " (:text b)
                              (when-let [t (box-tree i)] (str "  · " (try (mt/summary t) (catch :default _ ""))))))
        ins (for [[a o z i] (:lines p) :when (= z id)] (str (name a) " outlet " o " → its inlet " i))]
    (when (seq bs)
      (str "━━━ The patch the agent box (" (name id) ") is in ━━━\n"
           (str/join "\n" (map line (take 60 bs)))
           (when (> (count bs) 60) "\n…")
           (when (seq ins) (str "\nWhat reaches the agent: " (str/join "; " ins)))
           "\nRead any of these boxes with the tool describe_box (a tree box: its voices as lines of notes, its key, "
           "meter and analysis), and apply any class to one with apply_class (cac judge, cac partimento, comes, mt…): "
           "the work's craft, to check and measure what you write before you answer."))))

;; ───────────────────────── a class, applied apart ─────────────────────────

(defonce craft-defs (atom {}))   ; class → its definition, for classes the work does not have

(defn craft-def
  "Promise of the definition of class k: the work's own, or its official package's (fetched, not added to the work)."
  [k]
  (if-let [d (comp/lookup k)]
    (js/Promise.resolve d)
    (if-let [d (get @craft-defs k)]
      (js/Promise.resolve d)
      (if-let [[pkg _] (lib/package-of k)]
        (-> (lib/import-package pkg)
            (.then (fn [[m origin]]
                     (let [src (lib/package-source m origin)
                           _ (swap! cbox/trusted conj src)   ; official: it runs without asking
                           {:keys [ok error]} (ai/definition src k)]
                       (when error (throw (js/Error. error)))
                       (swap! craft-defs assoc k ok)
                       ok))))
        (js/Promise.reject (js/Error. (str "no class " k)))))))

(def craft-steps 64)

(defn run-class
  "Promise of what box text `text` (\"cac judge\", \"comes 2 :canon\"…) does with messages [[inlet value] …], as a box
   of that class would: its state threaded, its :later messages delivered, its tasks run and their outcome sent back
   on inlet :task. {:ok :text :outs [[outlet value] …] :shown v :state-keys} or {:ok false :error}. Nothing goes into
   the work."
  [text msgs]
  (let [k (klass text)]
    (-> (if @eng/held (js/Promise.reject (js/Error. "safe mode: no class runs (reload the page to leave it)")) (craft-def k))
        (.then
         (fn [d]
           (when-not (fn? (:receive d)) (throw (js/Error. (str k " receives no messages"))))
           (let [args (comp/args-for d text)
                 box (fn [st] {:text text :args args :data nil :id :craft :state st :wired []})]
             (letfn [(step [{:keys [queue state outs shown n] :as acc}]
                       (if (or (empty? queue) (>= n craft-steps))
                         (js/Promise.resolve acc)
                         (let [[inlet value] (first queue)
                               r ((:receive d) {:id :craft :state state :args args :inlet inlet :value value
                                                :at (* n 0.01) :data nil})
                               r (if (map? r) r {})
                               st (if (contains? r :state) (:state r) state)
                               later (for [[_ i v] (:later r)] [i v])
                               tasks (for [[tk x] (:effects r) :let [f (get-in d [:tasks tk])] :when f] [tk x f])
                               acc (assoc acc :queue (into (vec (rest queue)) later) :state st :n (inc n)
                                               :outs (into outs (:out r)) :shown (if (contains? r :show) (:show r) shown))]
                           (if (empty? tasks)
                             (step acc)
                             (-> (js/Promise.all
                                  (into-array (for [[tk x f] tasks]
                                                (-> (js/Promise.resolve nil)
                                                    (.then (fn [_] (f x (box st))))
                                                    (.then (fn [v] [:task {:task tk :arg x :value v}])
                                                           (fn [e] [:task {:task tk :arg x :error (str (or (.-message e) e))}]))))))
                                 (.then (fn [rs] (step (update acc :queue into (array-seq rs))))))))))]
               (-> (step {:queue (vec msgs) :state nil :outs [] :shown nil :n 0})
                   (.then (fn [{:keys [outs shown state n]}]
                            {:ok true :text text :outs outs :shown shown :steps n
                             :state-keys (when (map? state) (vec (keys state)))})))))))
        (.catch (fn [e] {:ok false :text text :error (str (or (.-message e) e))})))))

(defn craft-value
  "A value sent out, as Claude reads it: a tree described (and its EDN, cut), anything else as EDN, cut."
  [v]
  (if (and (mt/node? v) (try (mt/tree? v) (catch :default _ false)))
    {:tree (try (describe-tree v) (catch :default e {:error (.-message e)})) :edn (ai/cut (pr-str v) 3000)}
    (ai/cut (pr-str v) 1500)))

(defn apply-class
  "(apply-class \"cac judge\" :b3): promise of what a box of that class does with box :b3's tree (sent to its inlet 0).
   (apply-class \"cac judge\" :b3 [[0 :bang]]) sends more messages after it; with nil instead of a box, only the
   messages. Its outlets come as Claude reads them (see craft-value)."
  ([text box] (apply-class text box nil))
  ([text box msgs]
   (let [tr (when box (or (box-tree box) (fail (str box " holds no tree (a tree box, a score, a canvas)"))))
         msgs (vec (concat (when tr [[0 tr]]) msgs))]
     (when (empty? msgs) (fail "Nothing to send: a box, or messages [[inlet value] …]"))
     (.then (run-class text msgs)
            (fn [r] (if (:ok r)
                      (-> r (update :outs (fn [os] (mapv (fn [[o v]] [o (craft-value v)]) os)))
                          (update :shown #(ai/cut (pr-str %) 400)))
                      r))))))

;; ───────────────────────── the tools, for Claude ─────────────────────────

(defn craft-box-id [s] (keyword (str/replace (str/trim (str s)) #"^:" "")))

(defn craft-tools
  "describe_box and apply_class, for Claude while it makes a patch (the Claude tab, an agent)."
  []
  (let [logged (fn [label f]
                 (fn [input _]
                   (-> (js/Promise.resolve nil)
                       (.then (fn [_] (f input)))
                       (.catch (fn [e] {:ok false :error (or (.-message e) (str e))}))
                       (.then (fn [r]
                                (ask-log! (if (false? (:ok r)) "err" "ok")
                                          (str label (when-let [e (:error r)] (str " · " (ai/cut e 160)))))
                                (clj->js r))))))]
    [#js {:name "describe_box"
          :description (str "A box of the patch on screen as you read it: its class, text, ports and connections; for a tree "
                            "(a tree box, a score, a canvas) its key, meter and voices — each as a line of the melody shorthand "
                            "(c4/1 d4/0.5 r/1 c4+e4/2, durations in beats) with its range — and the analysis it carries, on its "
                            "root (phrases, plans, keys…) and on its notes (:fig the chord over a bass note, :deg, :local, :why…).")
          :inputSchema (clj->js {:type "object" :properties {:box {:type "string" :description "the box's id, e.g. b3"}} :required ["box"]})
          :execute (logged "describe" (fn [i] (assoc (describe-box (craft-box-id (.-box i))) :ok true)))}
     #js {:name "apply_class"
          :description (str "Applies a class to a box's tree, or to messages, apart (nothing goes into the work), as a box of "
                            "that class would receive them: returns its outlets ([outlet value], a tree described as "
                            "describe_box does), what it shows and its errors. Every class of the work and of the official "
                            "packages is a tool this way: `cac judge` (where voices break the rules of counterpoint and "
                            "thoroughbass, and why; the chords over the bass), `cac partimento` (the voices over a bass), "
                            "`comes` (canons), mt's operations… Use it to check and measure what you write before you answer.")
          :inputSchema (clj->js {:type "object"
                                 :properties {:text {:type "string" :description "the box text: the class and its words, e.g. \"cac judge\" or \"cac partimento 3 G\""}
                                              :box {:type "string" :description "a box whose tree goes to inlet 0 first, e.g. b3 (optional)"}
                                              :messages {:type "string" :description "EDN vector of [inlet value] sent after it, e.g. [[0 :bang]] or [[0 [:voice \"c4/2 d4 e4\"]]] (optional)"}}
                                 :required ["text"]})
          :execute (logged "apply"
                           (fn [i]
                             (let [msgs (when (seq (str (.-messages i))) (ai/read-edn (str (.-messages i))))]
                               (when (and (some? msgs) (not (sequential? msgs))) (throw (js/Error. "messages: a vector of [inlet value]")))
                               (apply-class (str (.-text i)) (when (seq (str (.-box i))) (craft-box-id (.-box i))) msgs))))}]))

(swap! more-patch-tools conj (fn [_] (first (craft-tools))) (fn [_] (second (craft-tools))))
