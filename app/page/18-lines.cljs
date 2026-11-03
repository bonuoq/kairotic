;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page: lines (discussion #117, phase 1)
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).
;;
;; A work is a project of lines: independent histories, each a whole tree of its own (branches, merges,
;; snapshots), shown as tabs above the patch. The main line is the work as it always was; the others are
;; studies, sketches, parts. Their segments are kept with the work's history, each one marked with its line
;; (00-work.cljs), and their names in <work>/lines, one document per line. The tab on screen is the line
;; everything else works on: the patch, the history view, Perform and its jams, Share/Export, Claude.
;; The engine plays the line where ▶ was pressed, whichever tab is on screen (decision 6, 00-work.cljs).
;; One line is used inside another as `patch @name` (phase 2, below).

(in-ns 'user)

;; ───────────────────────── names ─────────────────────────

(defn line-entry [lid] (get-in @line-state [:index lid]))

(defn line-name
  "The name of line lid as the tabs show it."
  [lid]
  (or (not-empty (:name (line-entry lid))) (if (= lid main-line) "main" "a line")))

(defn known-lines
  "Every line of the work: the main one, those with a name, and those whose segments arrived before their name."
  []
  (-> (set (keys (:index @line-state))) (into (keys (:other @hist))) (conj main-line (active-line))))

(defn line-order [lid] [(if (= lid main-line) 0 1) (or (:created (line-entry lid)) 9e15) (line-name lid)])

(defn tab-lines
  "The lines shown as tabs, in order: the main one first, then by creation (the one on screen always)."
  []
  (sort-by line-order (remove (fn [l] (and (:archived (line-entry l)) (not= l (active-line)))) (known-lines))))

(defn archived-lines [] (sort-by line-order (filter (fn [l] (and (:archived (line-entry l)) (not= l (active-line)))) (known-lines))))

(defn line-by-name
  "The id of the line called nm (or with that id), archived or not."
  [nm]
  (let [nm (str/trim (str nm)) ls (known-lines)]
    (or (first (filter (fn [l] (= nm (line-name l))) (sort-by line-order ls)))
        (when (contains? ls nm) nm))))

(defn ref-slug
  "How a box writes a line's name after @: its spaces as - (patch @bass-line uses the line \"bass line\")."
  [nm] (str/replace (str/trim (str nm)) #"\s+" "-"))

(defn line-by-ref
  "The id of the line a `patch @r` box uses: by its name (spaces as -), or by a name it had before."
  [r]
  (let [ls (sort-by line-order (known-lines))]
    (or (first (filter (fn [l] (= r (ref-slug (line-name l)))) ls))
        (first (filter (fn [l] (some (fn [a] (= r (ref-slug a))) (:aliases (line-entry l)))) ls))
        (when (contains? (set ls) r) r))))

;; ───────────────────────── storage: <work>/lines/<id> ─────────────────────────

(defn lines-path [] (when-let [b (work-base)] (str b "/lines")))

(defn on-lines
  "The names of the lines, as they arrive (they are only ever added to or changed: a line is archived, not deleted)."
  [snap]
  (let [incoming (into {} (for [d (array-seq (.-docs snap)) :when (.-exists d)
                                :let [m (js->clj (.data d))]]
                            [(.-id d) {:name (let [n (get m "name")] (when (string? n) n))
                                       :created (let [t (get m "created")] (if (number? t) t 0))
                                       :archived (true? (get m "archived"))
                                       :aliases (let [a (get m "aliases")] (if (sequential? a) (vec (filter string? a)) []))}]))]
    (swap! line-state update :index merge incoming)))

(defn save-line!
  "Writes what changed of line lid's entry (its name, archived) where the others read it."
  [lid changes]
  (swap! line-state update-in [:index lid] merge changes)
  (when (persist?)
    (let [path (str (lines-path) "/" lid)
          body (clj->js (merge (select-keys (line-entry lid) [:name :created :archived :aliases]) {:author (my-author)} changes))]
      (enqueue! path (fn [] (.set (.doc @dbref path) body))))))

(defn new-line-id []
  (if (persist?)
    (.-id (.doc (.collection @dbref (lines-path))))
    (str "l" (.toString (js/Math.floor (* (js/Math.random) 2176782336)) 36) (.toString (js/Date.now) 36))))

;; ───────────────────────── a line used as a sub-patch: patch @name (phase 2) ─────────────────────────
;; A `patch @name` box reads the line called name: at its newest point (it follows the line, so it changes
;; as the line advances, like an abstraction of Max or Pd), or at the point it is pinned to ([:pin id pos]).
;; While performing, the lines followed stay where they were when Perform started (decision 4); away from
;; the newest point of the line on screen, they read where they were at the last snapshot before it, if it
;; kept them (decision 5). Inside a line used so, adc~ and dac~ are quiet: they play when the line plays
;; alone, and sound goes in and out through inlet~ / outlet~ (decision 7).

(defn line-nodes [lid] (if (= lid (active-line)) (:nodes @hist) (get-in @hist [:other lid] {})))

(defn nodes-front [nodes]
  (when (seq nodes) (let [n (apply max-key (fn [n] (or (:t n) 0)) (vals nodes))] [(:id n) (count (:events n))])))

(defn nodes-depth
  "How many events from the root of a line to pos (its moment)."
  [nodes [nid idx]]
  (loop [nid nid acc idx guard 0]
    (let [n (get nodes nid)]
      (if (and n (:parent n) (get nodes (:parent n)) (< guard 512))
        (recur (:parent n) (+ acc (:at n)) (inc guard))
        acc))))

(defonce ref-cache (atom {}))   ; [line pos] → [its nodes, the patch]

(defn line-patch-at [lid pos]
  (let [nodes (line-nodes lid) [k p] (get @ref-cache [lid pos])]
    (if (identical? k nodes)
      p
      (let [p (if pos (nodes-patch nodes pos) empty-patch)]
        (swap! ref-cache (fn [c] (assoc (if (> (count c) 200) {} c) [lid pos] [nodes p])))
        p))))

(defonce fronts-cache (atom [nil nil nil]))

(defn snapshot-fronts
  "Where the lines followed were at the last snapshot before the point on screen, when it is not the newest
   point of its line (decision 5): {line pos}, or nil."
  []
  (let [here (norm (:pos @world)) nodes (:nodes @hist) [k1 k2 v] @fronts-cache]
    (if (and (identical? k1 nodes) (= k2 here))
      v
      (let [v (when (and here (not= here (newest-tip)))
                (some (fn [e] (when (and (vector? e) (= :mark (first e))) (:fronts (second e))))
                      (reverse (mapcat (fn [g] (seg-events g 0)) (segments here)))))]
        (reset! fronts-cache [nodes here v])
        v))))

(defn ref-pos
  "The point of its line that box b reads."
  [b lid]
  (or (:pin b)
      (get-in @perf [:pins lid])
      (get (snapshot-fronts) lid)
      (nodes-front (line-nodes lid))))

(defn resolve-ref
  "{:line :pos :pinned :patch} for a `patch @name` box, or {:error}."
  [b]
  (let [r (eng/line-ref b) lid (when r (line-by-ref r))]
    (cond (nil? r) {:error "not a patch @name box"}
          (nil? lid) {:error (str "There is no line called " r " in this work.")}
          :else (let [pos (ref-pos b lid)]
                  {:line lid :pos pos :pinned (some? (:pin b)) :patch (if pos (line-patch-at lid pos) empty-patch)}))))

(defn refs-in
  "The `patch @name` boxes of a patch, through its embedded patches: [[path id box] …]."
  ([p] (refs-in p []))
  ([p path]
   (mapcat (fn [[id b]]
             (cond (line-ref? b) [[path id b]]
                   (embedded? b) (refs-in (or (:data b) empty-patch) (conj path id))
                   :else []))
           (:boxes p))))

(defn lines-reached
  "Every line reached from patch p through references, at the point each one is read: {line pos}."
  [p]
  (loop [todo [p] seen {} guard 0]
    (if (or (empty? todo) (> guard 64))
      seen
      (let [found (for [[_ _ b] (refs-in (peek todo)) :let [r (resolve-ref b)] :when (:line r)] r)
            new (remove (fn [r] (contains? seen (:line r))) found)]
        (recur (into (pop todo) (map :patch new))
               (into seen (map (fn [r] [(:line r) (:pos r)]) found)) (inc guard))))))

(defn check-ref-text!
  "Fails when box text t is a `patch @name` that cannot be: no such line, or one that would contain itself."
  [t]
  (when-let [r (eng/line-ref {:text t})]
    (let [lid (line-by-ref r) here (active-line)]
      (cond (nil? lid) (fail (str "There is no line called " r " in this work (spaces in a name are written -)."))
            (= lid here) (fail "A line cannot contain itself.")
            (contains? (lines-reached (line-patch-at lid (nodes-front (line-nodes lid)))) here)
            (fail (str (line-name lid) " already uses " (line-name here) ": that would be a cycle."))
            :else nil))))

(defn followed-fronts
  "The lines the work on screen follows (not pinned), where each one is now: {line pos}."
  []
  (into {} (for [[lid pos] (lines-reached (work-patch))
                 :when (not-any? (fn [[_ _ b]] (and (:pin b) (= lid (line-by-ref (eng/line-ref b))))) (refs-in (work-patch)))]
             [lid pos])))

(defn quiet
  "A line as a sub-patch plays: without its adc~ and dac~ (decision 7)."
  [p]
  (let [io (set (keep (fn [[id b]] (when (#{"adc~" "dac~"} (klass (:text b))) id)) (:boxes p)))]
    (if (empty? io)
      p
      (-> p (update :boxes (fn [bx] (into (sorted-map) (remove (fn [[id _]] (io id)) bx))))
          (update :lines (fn [ls] (vec (remove (fn [[a _ b _]] (or (io a) (io b))) ls))))))))

(reset! eng/line-resolver (fn [b] (let [r (resolve-ref b)] (when-let [p (:patch r)] (quiet p)))))

(defn ref-badge
  "What a `patch @name` box shows beside its name: ↻ following its line, ⌖ and the moment it is pinned to,
   ⚠ when something is wrong."
  [b]
  (let [r (resolve-ref b)]
    (cond (:error r) "⚠"
          (or (ref-warning b)) "⚠"
          (:pinned r) (str "⌖" (nodes-depth (line-nodes (:line r)) (:pos r)))
          :else "↻")))

(defn ref-warning
  "Why a `patch @name` box may not do what it seems, or nil."
  [b]
  (let [r (resolve-ref b) cls (frequencies (map (comp klass :text) (vals (:boxes (:patch r)))))]
    (cond (:error r) (:error r)
          (and (cls "dac~") (not (cls "outlet~")))
          (str (line-name (:line r)) " has dac~ but no outlet~: nothing comes out here (its dac~ plays only when the line plays alone)")
          (and (cls "adc~") (not (cls "inlet~")))
          (str (line-name (:line r)) " has adc~ but no inlet~: no sound goes in (its adc~ listens only when the line plays alone)")
          :else nil)))

(defn need-ref [id]
  (let [b (or (get-in (current) [:boxes id]) (fail (str "There is no box " id)))]
    (when-not (line-ref? b) (fail (str id " is not a patch @name box")))
    b))

(defn pin-ref
  "(pin-ref :b3): the line box :b3 uses stays at the point it reads now. (pin-ref :b3 [node n]) at that one."
  ([id] (pin-ref id nil))
  ([id pos]
   (let [b (need-ref id)
         pos (or pos (:pos (resolve-ref b)) (fail (str (eng/line-ref b) " has no history yet: nothing to pin")))]
     (dispatch! [:pin id (vec pos)])
     pos)))

(defn follow-ref
  "(follow-ref :b3): the box follows its line again (its newest point)."
  [id]
  (need-ref id)
  (dispatch! [:pin id nil])
  :follows)

(declare need-switch)

(defn open-ref
  "(open-ref :b3): the line box :b3 uses, in its tab (at the point it is pinned to, if it is)."
  [id]
  (let [b (need-ref id) r (resolve-ref b)]
    (when (:error r) (fail (:error r)))
    (need-switch (:line r))
    (swap! ui assoc :follow nil)
    (when (:pinned r)
      (swap! world assoc :pos (:pos r) :auto false :prev-pos nil))
    (line-name (:line r))))

;; a line that changes changes what its users play: the engine's flat patch is made again
(add-watch hist ::refs (fn [_ _ o n] (when-not (and (identical? (:nodes o) (:nodes n)) (identical? (:other o) (:other n)))
                                      (reset! eng/flat-cache [nil nil]))))

;; ───────────────────────── the line on screen ─────────────────────────

(defn switch-line!
  "Puts line lid on screen: its segments become the history, at the point its tab was left (or its newest).
   The engine goes on playing the line where ▶ was pressed (decision 6): the boxes of the one on screen are
   known to it under the prefix of their line, so nothing of what they show or hold meets the other's. With
   the engine stopped, what the boxes showed is forgotten, as when another work opens. False when it cannot
   be now (in Perform, a lesson or the scratch patch)."
  [lid]
  (cond
    (= lid (active-line)) true
    (or @perf @lesson @scratch) false
    :else
    (let [from (active-line) on? (eng/running?)]
      (swap! line-state (fn [st] (-> st (assoc-in [:pos from] (:pos @world)) (assoc :active lid))))
      (reset! world {:pos nil :auto true :prev-pos nil :jumped-at 0})
      (swap! hist (fn [h] (-> h
                              (assoc-in [:other from] (:nodes h))
                              (assoc :nodes (get-in h [:other lid] {}))
                              (update :other dissoc lid))))
      (reset! cache {})
      (when-not on? (reset-patch-state!))
      (reset! view-path [])
      (swap! ui assoc :sel nil :drag nil :wire nil :merge-pick false)
      (let [saved (get-in @line-state [:pos lid])]
        (swap! world assoc :pos (if (and saved (node (first saved))) saved (newest-tip))))
      (publish-presence!)
      (transport-info!)
      (render-all!)
      (render-lines!)
      ;; the official classes its boxes use and no definition of its own brings (one asked for while
      ;; another line was on screen waits for this one)
      (ensure-classes!)
      true)))

;; ───────────────────────── commands (what the tabs write in the REPL) ─────────────────────────

(defn check-line-name [nm except]
  (let [nm (str/trim (str nm))]
    (cond (str/blank? nm) (fail "A line needs a name.")
          (> (count nm) 40) (fail "A line's name: 40 characters at most.")
          (re-find #"[\n\r\"]" nm) (fail "A line's name: one line, without quotes.")
          (some (fn [l] (and (not= l except) (= nm (line-name l)))) (known-lines))
          (fail (str "There is already a line called " (pr-str nm) "."))
          :else nm)))

(defn need-line [nm]
  (or (line-by-name nm) (fail (str "There is no line called " (pr-str (str nm)) ". (work-lines) lists them."))))

(defn need-switch [lid]
  (when-not (switch-line! lid)
    (fail "Not now: lines change outside Perform, a lesson or the scratch patch.")))

(defn go-line
  "(go-line \"sketch\"): puts the line called so on screen (its tab). (go-line) says which one is."
  ([] (line-name (active-line)))
  ([nm]
   (let [lid (need-line nm)]
     (need-switch lid)
     (swap! ui assoc :follow nil)
     (line-name lid))))

(defn new-line
  "(new-line \"sketch\"): a new line in this work, empty, with a history of its own; it goes on screen."
  [nm]
  (when-not (:kind @work) (fail "Open or create a work first."))
  (when (or @perf @lesson @scratch) (fail "Not now: lines change outside Perform, a lesson or the scratch patch."))
  (let [nm (check-line-name nm nil) lid (new-line-id)]
    (save-line! lid {:name nm :created (js/Date.now) :archived false})
    (need-switch lid)
    (swap! ui assoc :follow nil)
    nm))

(defn rename-line
  "(rename-line \"intro\"): another name for the line on screen. (rename-line \"old\" \"new\") for any line."
  ([nm] (rename-line (line-name (active-line)) nm))
  ([old nm]
   (let [lid (need-line old) nm (check-line-name nm lid) was (line-name lid)]
     ;; the old name stays as an alias: boxes of other lines (and older points) that say patch @old still find it
     (save-line! lid {:name nm :created (or (:created (line-entry lid)) (if (= lid main-line) 0 (js/Date.now)))
                      :aliases (vec (distinct (remove #{nm} (conj (vec (:aliases (line-entry lid))) was))))})
     ;; the boxes of the line on screen that use it say the new name
     (when-not (or @perf @scratch)
       (let [evs (for [[path id b] (refs-in (work-patch)) :when (= lid (line-by-ref (eng/line-ref b)))]
                   (wrap-in path [:text id (str/join " " (into ["patch" (str "@" (ref-slug nm))] (drop 2 (str/split (str/trim (:text b)) #"\s+"))))]))]
         (when (seq evs) (dispatch-root! [:batch (vec evs)]))))
     (render-lines!)
     nm)))

(defn archive-line
  "(archive-line \"sketch\"): hides a line's tab (it is kept, with its history: (restore-line \"sketch\")).
   The main line cannot be archived."
  ([] (archive-line (line-name (active-line))))
  ([nm]
   (let [lid (need-line nm)]
     (when (= lid main-line) (fail "The main line cannot be archived."))
     (when (= lid (active-line)) (need-switch main-line))
     (save-line! lid {:archived true})
     (render-lines!)
     (line-name lid))))

(defn restore-line
  "(restore-line \"sketch\"): its tab again, on screen."
  [nm]
  (let [lid (need-line nm)]
    (save-line! lid {:archived false})
    (need-switch lid)
    (line-name lid)))

(defn work-lines
  "The lines of this work: {:on \"main\" :lines [\"main\" \"sketch\" …] :archived […]}."
  []
  {:on (line-name (active-line)) :lines (mapv line-name (tab-lines)) :archived (mapv line-name (archived-lines))})

;; ───────────────────────── the tabs ─────────────────────────

(defonce line-edit (atom nil))   ; nil, :new, or the id of the line being renamed

(defn render-lines! []
  (let [el ($ "line-tabs")
        show? (and (:kind @work) (not @lesson) (not embed-mode))]
    (set! (.-hidden el) (not show?))
    (when show?
      (let [ed @line-edit
            others (remove :same @peers)
            on-line (fn [l] (count (filter (fn [p] (= (or (:line p) main-line) l)) others)))
            busy? (boolean (or @perf @scratch))]
        (set! (.-innerHTML el)
              (str (apply str
                          (for [l (tab-lines) :let [sel? (= l (active-line)) n (on-line l)]]
                            (if (= ed l)
                              (str "<input id=\"line-name-in\" data-line=\"" (esc l) "\" value=\"" (esc (line-name l)) "\" aria-label=\"Name of the line\" spellcheck=\"false\" autocomplete=\"off\">")
                              (str "<button class=\"ltab\" role=\"tab\" data-line=\"" (esc l) "\" aria-selected=\"" sel? "\""
                                   (when (and busy? (not sel?)) " disabled")
                                   " title=\"" (if sel? "The line on screen · double-click to rename it" (str "Put the line " (esc (line-name l)) " on screen")) "\">"
                                   (when (= l main-line) "<span class=\"star\" title=\"the main line\">★</span>")
                                   (when (= l (playing-line)) "<span class=\"plays\" title=\"The engine plays this line (■ stops it, ▶ on another tab plays that one)\">▶</span>")
                                   (esc (line-name l))
                                   (when (pos? n) (str "<span class=\"who\" title=\"" n (if (= 1 n) " person" " people") " on this line\">●" (when (> n 1) n) "</span>"))
                                   (when (and sel? (not= l main-line) (not busy?)) "<span class=\"x\" data-line-archive=\"1\" title=\"Archive this line (it is kept, with its history)\">×</span>")
                                   "</button>"))))
                   (if (= ed :new)
                     "<input id=\"line-name-in\" placeholder=\"name of the new line\" aria-label=\"Name of the new line\" spellcheck=\"false\" autocomplete=\"off\">"
                     (str "<button class=\"ladd\" id=\"line-add\" title=\"A new line: an empty history of its own, in this work\" aria-label=\"New line\""
                          (when busy? " disabled") ">+</button>"))
                   (let [arch (archived-lines)]
                     (when (seq arch)
                       (str "<select id=\"line-restore\" aria-label=\"Archived lines\"><option value=\"\">archived (" (count arch) ")</option>"
                            (apply str (for [l arch] (str "<option value=\"" (esc l) "\">restore " (esc (line-name l)) "</option>")))
                            "</select>")))))
        (when ed (when-let [i ($ "line-name-in")] (.focus i) (.select i)))))))

(defn line-gesture! [code] (swap! line-edit (constantly nil)) (gesture! code))

(let [el ($ "line-tabs")]
  (.addEventListener el "click"
    (fn [e]
      (let [t (.-target e)]
        (cond
          (.closest t "[data-line-archive]")
          (line-gesture! "(archive-line)")
          (.closest t "#line-add")
          (do (reset! line-edit :new) (render-lines!))
          :else
          (when-let [b (.closest t "button.ltab")]
            (let [lid (.getAttribute b "data-line")]
              (when (not= lid (active-line)) (line-gesture! (str "(go-line " (pr-str (line-name lid)) ")")))))))))
  (.addEventListener el "dblclick"
    (fn [e]
      (when-let [b (.closest (.-target e) "button.ltab")]
        (let [lid (.getAttribute b "data-line")]
          (when (= lid (active-line)) (reset! line-edit lid) (render-lines!))))))
  (.addEventListener el "change"
    (fn [e]
      (when (= "line-restore" (.. e -target -id))
        (let [lid (.. e -target -value)]
          (when (seq lid) (line-gesture! (str "(restore-line " (pr-str (line-name lid)) ")")))))))
  (.addEventListener el "keydown"
    (fn [e]
      (when (= "line-name-in" (.. e -target -id))
        (let [k (.-key e) v (str/trim (.. e -target -value)) ed @line-edit]
          (cond
            (= k "Escape") (do (reset! line-edit nil) (render-lines!))
            (= k "Enter") (do (.preventDefault e)
                              (cond (str/blank? v) (do (reset! line-edit nil) (render-lines!))
                                    (= ed :new) (line-gesture! (str "(new-line " (pr-str v) ")"))
                                    (= v (line-name ed)) (do (reset! line-edit nil) (render-lines!))
                                    :else (line-gesture! (str "(rename-line " (pr-str (line-name ed)) " " (pr-str v) ")"))))
            :else nil)))))
  (.addEventListener el "focusout"
    (fn [e]
      (when (and (= "line-name-in" (.. e -target -id)) @line-edit)
        (js/setTimeout (fn [] (when (and @line-edit (not= ($ "line-name-in") (.-activeElement js/document)))
                                (reset! line-edit nil) (render-lines!)))
                       150)))))

(add-watch eng/rt ::lines (fn [_ _ o n] (when (not= (:on o) (:on n)) (render-lines!))))
(add-watch line-state ::render (fn [_ _ o n] (when (not= o n) (render-lines!))))
(add-watch work ::lines (fn [_ _ o n] (when (not= (select-keys o [:kind :id]) (select-keys n [:kind :id])) (render-lines!))))
(add-watch peers ::lines (fn [_ _ _ _] (render-lines!)))
(add-watch perf ::lines (fn [_ _ o n] (when (not= (some? o) (some? n)) (render-lines!))))
(add-watch lesson ::lines (fn [_ _ _ _] (render-lines!)))
(add-watch hist ::lines (fn [_ _ o n] (when (not= (set (keys (:other o))) (set (keys (:other n)))) (render-lines!))))
(render-lines!)
