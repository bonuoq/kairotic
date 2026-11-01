;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page: lines (discussion #117, phase 1)
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).
;;
;; A work is a project of lines: independent histories, each a whole tree of its own (branches, merges,
;; snapshots), shown as tabs above the patch. The main line is the work as it always was; the others are
;; studies, sketches, parts. Their segments are kept with the work's history, each one marked with its line
;; (00-work.cljs), and their names in <work>/lines, one document per line. The tab on screen is the line
;; everything else works on: the patch, the engine, the history view, Perform and its jams, Share/Export,
;; Claude. Using one line inside another (`patch @name`, Study 33) comes later.

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

;; ───────────────────────── storage: <work>/lines/<id> ─────────────────────────

(defn lines-path [] (when-let [b (work-base)] (str b "/lines")))

(defn on-lines
  "The names of the lines, as they arrive (they are only ever added to or changed: a line is archived, not deleted)."
  [snap]
  (let [incoming (into {} (for [d (array-seq (.-docs snap)) :when (.-exists d)
                                :let [m (js->clj (.data d))]]
                            [(.-id d) {:name (let [n (get m "name")] (when (string? n) n))
                                       :created (let [t (get m "created")] (if (number? t) t 0))
                                       :archived (true? (get m "archived"))}]))]
    (swap! line-state update :index merge incoming)))

(defn save-line!
  "Writes what changed of line lid's entry (its name, archived) where the others read it."
  [lid changes]
  (swap! line-state update-in [:index lid] merge changes)
  (when (persist?)
    (let [path (str (lines-path) "/" lid)
          body (clj->js (merge (select-keys (line-entry lid) [:name :created :archived]) {:author (my-author)} changes))]
      (enqueue! path (fn [] (.set (.doc @dbref path) body))))))

(defn new-line-id []
  (if (persist?)
    (.-id (.doc (.collection @dbref (lines-path))))
    (str "l" (.toString (js/Math.floor (* (js/Math.random) 2176782336)) 36) (.toString (js/Date.now) 36))))

;; ───────────────────────── the line on screen ─────────────────────────

(defn switch-line!
  "Puts line lid on screen: its segments become the history, at the point its tab was left (or its newest).
   The engine stops, as when another work opens: the patch is another one. False when it cannot be now
   (in Perform, a lesson or the scratch patch)."
  [lid]
  (cond
    (= lid (active-line)) true
    (or @perf @lesson @scratch) false
    :else
    (let [from (active-line)]
      (eng/stop!)
      (swap! line-state (fn [st] (-> st (assoc-in [:pos from] (:pos @world)) (assoc :active lid))))
      (reset! world {:pos nil :auto true :prev-pos nil :jumped-at 0})
      (swap! hist (fn [h] (-> h
                              (assoc-in [:other from] (:nodes h))
                              (assoc :nodes (get-in h [:other lid] {}))
                              (update :other dissoc lid))))
      (reset! cache {})
      (reset-patch-state!)
      (reset! view-path [])
      (swap! ui assoc :sel nil :drag nil :wire nil :merge-pick false)
      (let [saved (get-in @line-state [:pos lid])]
        (swap! world assoc :pos (if (and saved (node (first saved))) saved (newest-tip))))
      (publish-presence!)
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
   (let [lid (need-line old) nm (check-line-name nm lid)]
     (save-line! lid {:name nm :created (or (:created (line-entry lid)) (if (= lid main-line) 0 (js/Date.now)))})
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

(add-watch line-state ::render (fn [_ _ o n] (when (not= o n) (render-lines!))))
(add-watch work ::lines (fn [_ _ o n] (when (not= (select-keys o [:kind :id]) (select-keys n [:kind :id])) (render-lines!))))
(add-watch peers ::lines (fn [_ _ _ _] (render-lines!)))
(add-watch perf ::lines (fn [_ _ o n] (when (not= (some? o) (some? n)) (render-lines!))))
(add-watch lesson ::lines (fn [_ _ _ _] (render-lines!)))
(add-watch hist ::lines (fn [_ _ o n] (when (not= (set (keys (:other o))) (set (keys (:other n)))) (render-lines!))))
(render-lines!)
