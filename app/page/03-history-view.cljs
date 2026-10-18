;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 4 of 12: history-view
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── interface: history ─────────────────────────

(def palette ["#2f55d4" "#b4472e" "#2e7d4f" "#8a4fbf" "#b07a12" "#167c88" "#c0457e"])

(defn hash-color [s]
  (nth palette (mod (reduce (fn [a c] (mod (+ (* a 31) (.charCodeAt c 0)) 1000003)) 7 (str s)) (count palette))))

(defn author-color [a] (or (not-empty (get-in @profiles [a :color])) (hash-color a)))
(defn session-color [s] (hash-color (str "session" s)))
(defn peer-color [p] (session-color (or (:session p) (:peer p))))
(defn person-name [a] (or (not-empty (get-in @profiles [a :name])) (if (= a (my-author)) "you" "someone")))

(defn valid-pos? [p] (and (vector? p) (= 2 (count p)) (string? (first p)) (number? (second p))))

(defn lane-layout
  "One lane per line: the first segment that continues at the tip of another shares its lane;
   the other children (branches) open a new lane."
  []
  (let [ns (vals (:nodes @hist))
        ids (set (map :id ns))
        kids (group-by :parent ns)
        roots (sort-by (fn [n] (or (:t n) 0)) (filter (fn [n] (or (nil? (:parent n)) (not (ids (:parent n))))) ns))
        lane-of (atom {})
        order (atom [])
        counter (atom -1)
        visit (fn visit [n lane seen]
                (when-not (seen (:id n))
                  (swap! lane-of assoc (:id n) lane)
                  (swap! order conj n)
                  (let [cs (sort-by (fn [c] [(:at c) (or (:t c) 0)]) (get kids (:id n)))
                        cont (first (filter (fn [c] (= (:at c) (count (:events n)))) cs))
                        seen2 (conj seen (:id n))]
                    (when cont (visit cont lane seen2))
                    (doseq [c cs :when (not= (:id c) (:id cont))]
                      (visit c (swap! counter inc) seen2)))))]
    (doseq [r roots] (visit r (swap! counter inc) #{}))
    {:order @order :lane-of @lane-of :lanes (inc @counter)}))

(def hx 18)
(def hy 26)
(def hx0 30)
(def hy0 34)

(defn render-tree! []
  (let [{:keys [order lane-of lanes]} (lane-layout)
        ls order
        svg ($ "tree")
        h @hist
        show-empty (and (empty? ls) (:loaded h) (#{:shared :readonly :solo} (:mode h)))]
    (set! (.-hidden ($ "hist-empty")) (not show-empty))
    (set! (.. svg -style -display) (if (empty? ls) "none" "block"))
    (when (seq ls)
      (let [starts (into {} (for [n ls] [(:id n) (start-of (:id n))]))
            X (fn [d] (+ hx0 (* d hx)))
            Y (fn [i] (+ hy0 (* i hy)))
            maxd (apply max 1 (for [n ls] (+ (starts (:id n)) (count (:events n)))))
            w (+ (X maxd) 48)
            ht (+ (Y (dec lanes)) 24)
            ticks (for [d (range 0 (inc maxd) 8)]
                    (str "<line class=\"tick\" x1=\"" (X d) "\" x2=\"" (X d) "\" y1=\"20\" y2=\"" (- ht 6) "\"></line>"
                         "<text class=\"axis\" x=\"" (X d) "\" y=\"13\" text-anchor=\"middle\">" d "</text>"))
            body (for [n ls]
                   (let [i (lane-of (:id n)) s (starts (:id n)) cnt (count (:events n)) y (Y i)
                         c (session-color (node-session n)) nid (esc (:id n))
                         who (person-name (:author n))
                         pl (when (:parent n) (lane-of (:parent n)))
                         [mn mk] (when (vector? (:merge n)) (:merge n))
                         ml (when mn (lane-of mn))]
                     (str (when (and pl (not= pl i))
                            (str "<path class=\"fork\" stroke=\"" c "\" d=\"M" (X s) " " (Y pl) " V" y "\"></path>"))
                          (when (and ml (starts mn))
                            (let [x1 (X (+ (starts mn) mk)) y1 (Y ml) x2 (X (+ s 1))]
                              (str "<path class=\"merge\" stroke=\"" c "\" d=\"M" x1 " " y1 " C" (+ x1 30) " " y1 " " (- x2 30) " " y " " x2 " " y "\"></path>")))
                          (when (pos? cnt)
                            (str "<line class=\"lane\" stroke=\"" c "\" stroke-opacity=\"0.5\" x1=\"" (X s) "\" x2=\"" (X (+ s cnt)) "\" y1=\"" y "\" y2=\"" y "\"></line>"))
                          (when-not pl
                            (str "<circle class=\"origin\" data-goto=\"" nid "|0\" cx=\"" (X s) "\" cy=\"" y "\" r=\"4.5\"><title>origin</title></circle>"))
                          (apply str
                                 (map-indexed
                                  (fn [k ev]
                                    (let [mark? (= :merge-from (first ev))
                                          ;; a snapshot, or a take kept from Perform: a keyframe of the work
                                          key? (= :mark (first ev))
                                          xk (X (+ s k 1))]
                                      (cond
                                        key?
                                        (let [{:keys [label kind]} (when (map? (second ev)) (second ev))]
                                          (str "<rect class=\"ev keyframe" (when (= kind :take) " take") "\" data-goto=\"" nid "|" (inc k) "\""
                                               " x=\"" (- xk 5.5) "\" y=\"" (- y 5.5) "\" width=\"11\" height=\"11\" rx=\"2\" stroke=\"" c "\">"
                                               "<title>" (esc (str who " · " (if (= kind :take) "take kept from Perform" "snapshot")
                                                                   (when (seq (str label)) (str ": " label)))) "</title></rect>"))
                                        :else
                                        (str "<" (if mark? "rect" "circle") " class=\"ev" (when mark? " mergemark") "\" data-goto=\"" nid "|" (inc k) "\""
                                             (if mark?
                                               (str " x=\"" (- xk 5) "\" y=\"" (- y 5) "\" width=\"10\" height=\"10\" transform=\"rotate(45 " xk " " y ")\"")
                                               (str " cx=\"" xk "\" cy=\"" y "\" r=\"4.5\""))
                                             " fill=\"" c "\">"
                                             "<title>" (esc (str who " · " (if mark? "merge" (let [t (pr-str ev)] (if (> (count t) 90) (str (subs t 0 90) "…") t))))) "</title></"
                                             (if mark? "rect" "circle") ">"))))
                                  (:events n))))))
            mark (fn [pos r cls color]
                   (let [p (norm pos)]
                     (when (and p (lane-of (first p)))
                       (str "<circle class=\"" cls "\" cx=\"" (X (+ (starts (first p)) (second p))) "\" cy=\"" (Y (lane-of (first p)))
                            "\" r=\"" r "\"" (when color (str " stroke=\"" color "\"")) "></circle>"))))
            others (filter (fn [p] (and (not (:same p)) (:pos p))) @peers)
            peer-marks (map-indexed (fn [k p] (mark (:pos p) (+ 11 (* 3 k)) "peer" (peer-color p))) others)]
        (.setAttribute svg "width" w)
        (.setAttribute svg "height" ht)
        (set! (.-innerHTML svg)
              (str (apply str ticks) (apply str body) (apply str peer-marks) (mark (:pos @world) 8 "here" nil)
                   ;; in Perform: the point the take starts from
                   (when-let [st @perf] (mark (:origin st) 13 "perform-at" nil))))))))

(defn scroll-to-here! []
  (let [p (norm (:pos @world)) wrap ($ "hist-wrap")]
    (when p
      (let [x (+ hx0 (* hx (depth-of p)))
            l (.-scrollLeft wrap) vw (.-clientWidth wrap)]
        (when (or (< x (+ l 30)) (> x (- (+ l vw) 30)))
          (set! (.-scrollLeft wrap) (max 0 (- x (/ vw 2)))))))))

(defn render-peers! []
  (let [others (remove (fn [p] (or (:same p) (= "agent" (:kind p)))) @peers)
        f (:follow @ui)]
    (set! (.-innerHTML ($ "peers"))
          (str "<span class=\"chip me\"><span class=\"dot\" style=\"background:" (esc (session-color session-id)) "\"></span>you</span>"
               (apply str
                      (for [p others]
                        (let [nm (if (:me p) "you, another tab" (or (not-empty (get-in @profiles [(:by p) :name])) "Someone"))
                              col (peer-color p)
                              on (= f (:peer p))]
                          (str "<button class=\"chip" (when on " following") "\" data-peer=\"" (esc (:peer p))
                               "\" title=\"" (if on "Stop following" "Follow their position in the history") "\">"
                               "<span class=\"dot\" style=\"background:" (esc col) "\"></span>" (esc nm) (when on " · following") "</button>"))))))))

(defn render-foot! []
  (let [{:keys [mode nodes]} @hist
        p (norm (:pos @world))
        total (reduce + (map (comp count :events) (vals nodes)))
        n (when p (node (first p)))
        ahead (when n (- (count (:events n)) (second p)))
        mine? (and n (= (node-session n) session-id))
        who (when n (if mine? "by this session" (str "by " (person-name (:author n)) (when (= (:author n) (my-author)) ", another session"))))
        kids (when (and n (zero? ahead)) (children-at (first p) (second p)))]
    (set! (.-innerHTML ($ "hist-foot"))
          (str "<span>" (if p (str "Moment " (depth-of p) " · segment " (esc who)) "No events yet") "</span>"
               "<span>" (count nodes) (if (= 1 (count nodes)) " segment · " " segments · ") total " events</span>"
               (cond
                 (:merge-pick @ui)
                 "<span class=\"ahead\">Pick in the tree the point of the branch you want to bring here · Esc to cancel</span>"
                 (and ahead (pos? ahead))
                 (str "<span class=\"ahead\">" ahead (if (= 1 ahead) " event" " events") " further along this branch: if you act here, you open a new branch</span>")
                 (seq kids)
                 "<span class=\"ahead\">This line continues further on: if you act here, you open a new branch</span>"
                 (:auto @world)
                 "<span>Following the front: you move forward with anyone's gestures</span>")
               "<span style=\"margin-left:auto\">"
               (case mode
                 :shared "Shared room: whoever enters it sees and extends the same tree."
                 :solo "Solo: only you see this work."
                 :readonly "You can walk through the history; your branches stay in this tab."
                 :local "Local mode: the history lives only in this tab."
                 :none "Open or create a work from the session manager."
                 "Connecting to the shared history…")
               "</span>"))))

(defn render-status! []
  (let [{:keys [mode]} @hist p (current) n (count (remove :same @peers))]
    (set! (.-innerHTML ($ "status"))
          (str (case mode
                 :shared "<b class=\"on\">● shared room</b>"
                 :solo "<b class=\"on\">● solo</b>"
                 :readonly "<b class=\"off\">● read only</b>"
                 :local "<b class=\"off\">● local</b>"
                 :none "<b>○ no work open</b>"
                 "<b>○ connecting…</b>")
               " · " (count (:boxes p)) " boxes · " (count (:lines p)) " lines"
               (when (pos? n) (str " · " (inc n) " in the room"))))))

(declare render-comp!)

;; ───── data that flows by itself (Study 21) ─────
;; A tree box sends its tree whenever it changes (an edit, the history moving, someone in the room), at
;; most once per moment and only if it really changed; `tree manual` waits for a bang. A tree box that
;; receives edits or trees changes itself through a gesture of the work; one that keeps being rewritten
;; by messages (a loop without time) is stopped.

(defonce sent-trees (atom {}))     ; engine id → the tree it last sent
(defonce emit-timer (atom nil))
(defonce msg-edits (atom {}))      ; box → instants it was changed by messages; :stopped #{boxes}
(defonce echoed (atom {}))         ; engine id → the text a gesture here wrote after sending its value

(defn drain-prints!
  "What boxes printed (and the loops the engine cut), written in the REPL when the engine is off too."
  []
  (doseq [[_ v] (eng/take-prints!)]
    (let [t (if (string? v) v (pr-str v))]
      (if (re-find #"^(loop cut|too many messages)" t)
        (repl-print! "err" (esc (str "; " t)))
        (repl-print! "out" (esc (str "print: " t)))))))

(declare sync-live-trees!)

(defonce sent-shape (atom nil))     ; the boxes and lines the trees were last sent through

(defn reaching
  "The boxes from which one of `goal` can be reached along `lines` (the goal boxes included)."
  [lines goal]
  (loop [acc (set goal)]
    (let [more (into acc (keep (fn [[a _ b _]] (when (acc b) a)) lines))]
      (if (= (count more) (count acc)) acc (recur more)))))

(defn emit-trees!
  "Every tree box sends its tree when it changed. When the patch changed (a new line, a box new or with a
   new text), a tree goes again only toward what needs it: along its lines that lead to one of those
   boxes (Study 23). A control whose value stays in its text (:persist, a knob) sends it when that text
   changes: from another tab, a jam or a moment of the history (issue #11); not after a drag here,
   which already sent it."
  []
  (reset! emit-timer nil)
  (let [p (eng/flat (work-patch))
        shape [(:lines p) (into {} (map (fn [[id b]] [id (:text b)])) (:boxes p))]
        [old-lines old-texts] @sent-shape
        changed (when (not= shape @sent-shape)
                  (into (set (for [[f text] (second shape) :when (not= text (get old-texts f))] f))
                        (let [olds (set old-lines)] (for [l (:lines p) :when (not (olds l))] (nth l 2)))))
        upstream (when (seq changed) (reaching (:lines p) changed))]
    (when changed
      ;; a box that is new, or whose text changed, starts empty: nothing of what an earlier box with
      ;; that id showed or held
      (doseq [[f text] (second shape) :when (not= text (get old-texts f))]
        (eng/forget! f)
        (swap! live-trees dissoc f)
        (swap! score-cache dissoc f))
      (reset! sent-shape shape)
      (doseq [[f text] (second shape)
              :when (and old-texts (contains? old-texts f) (not= text (get old-texts f))
                         (:persist (comp/lookup (klass text))))]
        (if (= text (get @echoed f))
          (swap! echoed dissoc f)
          (try (eng/inject! (fn [] (work-patch)) f 0 :bang)
               (catch :default e (js/console.error e))))))
    (doseq [[f b] (:boxes p)
            :when (and (= "tree" (klass (:text b))) (not (some #{:manual} (eng/args-of (:text b)))))]
      (let [t (mtb/tree-of (:data b))]
        (when (some? t)
          (try
            (cond
              ;; the tree changed: it goes everywhere
              (or (not= t (get @sent-trees f)) (contains? changed f))
              (do (swap! sent-trees assoc f t)
                  (eng/emit! (fn [] (work-patch)) f 0 (mt/expand-source t f)))
              ;; the patch after it changed: only along the lines that lead there
              upstream
              (let [targets (set (for [[a o bb ii] (:lines p) :when (and (= a f) (= o 0) (upstream bb))] [bb ii]))]
                (when (seq targets)
                  (eng/emit-to! (fn [] (work-patch)) f 0 (mt/expand-source t f) targets))))
            (catch :default e (js/console.error e)))))))
  (when (sync-live-trees!) (render-scene (current)))
  (drain-prints!))

(defn schedule-emit! [] (when-not @emit-timer (reset! emit-timer (js/setTimeout emit-trees! 30))))

(defn refill-data! "Every tree box sends its tree again (after ■)." [] (reset! sent-trees {}) (schedule-emit!))

(defn forget-box!
  "A box that is created or deleted starts from nothing: what a box with its id showed and held is forgotten."
  [id]
  (let [f (fid id)]
    (eng/forget! f)
    (swap! live-trees dissoc f)
    (swap! dismissed-trees dissoc f)
    (swap! sent-trees dissoc f)
    (swap! score-cache dissoc id)))

(defn resume!
  "Lets a tree box be changed by messages again, after a loop was stopped: (resume! :b2)."
  [id] (swap! msg-edits (fn [m] (-> m (update :stopped disj id) (dissoc id)))) :ok)

(defn tree-effect!
  "A tree box or a canvas asked (by a message) to change: done as a gesture, unless it keeps happening."
  [f [k x] _]
  (js/setTimeout
   (fn []
     (let [id f now (js/Date.now)
           times (filterv (fn [t] (> t (- now 10000))) (get @msg-edits id))]
       (cond
         (not (get-in (current) [:boxes id]))
         (repl-print! "err" (esc (str "; " (name f) " is inside a sub-patch: edits by message reach only the boxes of the patch on screen")))
         (contains? (:stopped @msg-edits) id) nil
         (>= (count times) 20)
         (do (swap! msg-edits update :stopped (fnil conj #{}) id)
             (repl-print! "err" (esc (str "; loop stopped: " id " was rewritten by messages 20 times in 10 seconds. Look for a line that brings its own tree back to it; (resume! " id ") lets messages change it again."))))
         :else
         (do (swap! msg-edits assoc id (conj times now))
             (case k
               :tree-edit (gesture! (str "(tree-edit! " id " " (str/join " " (map pr-str x)) ")"))
               :tree-set (gesture! (str "(tree! " id " " (pr-str x) ")"))
               :canvas-edit (gesture! (str "(canvas-edit! " id " " (pr-str x) ")"))
               nil)))))
   0))

(swap! eng/rt assoc :effect-hook tree-effect!)
(js/setInterval (fn [] (when-not (eng/running?) (drain-prints!))) 200)

(defn sync-live-trees!
  "Takes the trees that canvases and freqts have received from the engine. True if any changed."
  []
  (let [changed (atom false)]
    (doseq [[id b] (:boxes (current)) :when (#{"canvas" "freqt"} (klass (:text b)))]
      (let [f (fid id) t (:tree (second (shown-flat f)))]
        (when (and t (not= t (get @live-trees f)) (not= t (get @dismissed-trees f)))
          (swap! dismissed-trees dissoc f)
          (swap! live-trees assoc f t)
          (reset! changed true))))
    @changed))

(defn render-all! []
  (sync-live-trees!)
  (schedule-emit!)
  (let [p (current)
        changed (lib/sync! (eng/flat (root-patch)))]
    (when changed (reset! eng/flat-cache [nil nil]) (render-comp!))
    (render-scene p)
    (render-code p)
    (render-tree!)
    (render-peers!)
    (render-foot!)
    (render-status!)
    (update-trust-bar!)))

;; ───────────────────────── presence and following ─────────────────────────

(defonce named-room (atom nil))

(defn publish-presence! []
  (when-let [room @named-room]
    (when-let [p (:pos @world)]
      ;; in a jam (Perform in a shared room): from which point, so others can be invited to it
      (let [{:keys [jam origin]} @perf]
        (.catch (.presence room (clj->js (cond-> {:pos p :session session-id}
                                           jam (assoc :jam jam :jamAt (or (:at @perf) origin)))))
                (fn [_] nil))))))

(defn sync-follow! []
  (when-let [f (:follow @ui)]
    (if-let [p (first (filter (fn [p] (= (:peer p) f)) @peers))]
      (let [pos (:pos p)]
        (when (and (valid-pos? pos) (node (first pos)) (not= pos (:pos @world)))
          (swap! world assoc :pos pos)))
      (swap! ui assoc :follow nil))))

(defonce asked (atom #{}))

(defn want-profiles! []
  (when-let [u @userref]
    (let [ids (disj (set (concat (keep :author (vals (:nodes @hist))) (keep :by @peers))) "local" nil)]
      (when (and (seq ids) (not= ids @asked))
        (reset! asked ids)
        (-> (.profiles u (clj->js (vec ids)))
            (.then (fn [ps]
                     (reset! profiles
                             (into {} (for [k (array-seq (.keys js/Object ps))]
                                        (let [p (aget ps k)] [k {:name (.-name p) :color (.-color p)}])))))))))))

(defn render-controls! []
  (set! (.-checked ($ "auto")) (boolean (:auto @world)))
  (let [inp ($ "simul")]
    (when-not (= inp (.-activeElement js/document))
      (set! (.-value inp) (str (:simul-ms @settings)))))
  (let [b ($ "merge-btn")]
    (set! (.-textContent b) (if (:merge-pick @ui) "Cancel merge" "Merge…"))
    (.toggle (.-classList b) "primary" (boolean (:merge-pick @ui)))))

(add-watch hist ::render (fn [_ _ _ _] (reset! cache {}) (auto-advance!) (render-all!) (want-profiles!)))
(add-watch world ::render (fn [_ _ o n] (render-all!) (render-controls!) (scroll-to-here!) (when (not= (:pos o) (:pos n)) (publish-presence!))))
(add-watch settings ::render (fn [_ _ _ _] (render-controls!)))
(add-watch peers ::render (fn [_ _ _ _] (sync-follow!) (render-tree!) (render-peers!) (render-status!) (want-profiles!)))
(add-watch profiles ::render (fn [_ _ _ _] (render-tree!) (render-peers!) (render-foot!)))
(add-watch ui ::render
  (fn [_ _ o n]
    (when (not= (select-keys o [:sel :insp :drag :wire :hover-in :nsel :ldrag]) (select-keys n [:sel :insp :drag :wire :hover-in :nsel :ldrag]))
      (render-scene (current)))
    (when (not= (:follow o) (:follow n)) (render-peers!))
    (when (not= (:merge-pick o) (:merge-pick n)) (render-controls!) (render-foot!))))

;; ───────────────────────── REPL ─────────────────────────

(defn repl-eval! [code source]
  ;; a gesture that writes a long source (a package copied into the work) is shown shortened
  (repl-print! (str "in" (when (= source :patch) " from-patch"))
               (str "<span class=\"p\">" (if (= source :patch) "⟵" "λ") "</span>"
                    (esc (if (and (= source :patch) (> (count code) 240)) (str (subs code 0 200) " … (" (count code) " characters)") code))))
  (try
    (let [v (eval-str code)]
      (when (= source :repl) (repl-print! "out" (esc (pr-str v)))))
    (catch :default e
      (repl-print! "err" (esc (or (.-message e) (str e)))))))

(defn gesture! [code] (repl-eval! code :patch))

(defn repl-submit!
  "Evaluates what is written in the REPL line, keeps it in its history and empties the line."
  []
  (let [code (str/trim (repl-text))]
    (when (seq code)
      (swap! ui (fn [u] (-> u (update :hist conj code) (assoc :hidx nil))))
      (set-repl-text! "")
      (repl-eval! code :repl))))

(defn repl-recall!
  "↑ / ↓ in the REPL line: the earlier or later expressions written there."
  [up?]
  (let [{:keys [hist hidx]} @ui n (count hist)]
    (when (pos? n)
      (let [i (if up?
                (if (nil? hidx) (dec n) (max 0 (dec hidx)))
                (if (nil? hidx) nil (if (>= (inc hidx) n) nil (inc hidx))))]
        (swap! ui assoc :hidx i)
        (set-repl-text! (if (nil? i) "" (nth hist i)))
        true))))

(.addEventListener ($ "repl-in") "keydown"
  (fn [e]
    (let [k (.-key e)]
      (cond
        (= k "Enter") (repl-submit!)
        (or (= k "ArrowUp") (= k "ArrowDown")) (when (repl-recall! (= k "ArrowUp")) (.preventDefault e))))))
