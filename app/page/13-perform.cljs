;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 14 of 14: perform
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── Compose and Perform (issue #5) ─────────────────────────
;; Compose is the usual mode: every change to the work is a point of its history.
;; Perform opens a time of its own to rehearse, try and improvise with the work: the changes make a take
;; that starts from a point of the history and stays out of it (the patch on screen and in the engine is
;; the take). ◀ / Ctrl+Z take back your last changes of the take. Going back to Compose keeps the take as
;; a new point (a branch from where it started, closed by a keyframe) or discards it and goes back to
;; where you were. In a shared room, those who perform from the same point share one take: a jam, where
;; only they receive each other's changes; whoever is not performing is invited to join it.
;; A snapshot, in either mode, writes a keyframe: a point of the history with the work as it is now.
;; The state of the take is `perf` (00-work.cljs); the take is not kept if the page is reloaded.

(defn layout-ev?
  "A change of layout only: a box moved, placed in presentation or shown in another view (also inside a sub-patch)."
  [p [op & args]]
  (case op
    (:move :present :view) true
    :in (let [[id inner] args b (get-in p [:boxes id])]
          (boolean (and (embedded? b) (vector? inner) (layout-ev? (or (:data b) empty-patch) inner))))
    false))

(defn take-summary
  "How many changes a take has, and how many of them change the work (the rest only move boxes)."
  [st]
  (let [evs (map :ev (perf-events st))
        lay (count (filter (fn [e] (layout-ev? (:base st) e)) evs))]
    {:changes (count evs) :layout lay :work (- (count evs) lay)}))

(defn moment-name [pos] (if-let [p (norm pos)] (str "moment " (depth-of p)) "the start"))

;; ───── the jam: one document per performer in <work>/jams, with the changes of their take ─────

(defonce jam-unsub (atom nil))
(defonce jam-seen (atom #{}))   ; jams already offered here (or your own)

(defn jam-coll [] (when (and (= :room (:kind @work)) (persist?)) (str (work-base) "/jams")))

(defn new-jam-id []
  (str "j" (.toString (js/Date.now) 36) (.toString (js/Math.floor (* (js/Math.random) 1679616)) 36)))

(defn jam-push!
  "Writes your changes of the take where the others in the jam read them."
  []
  (when-let [{:keys [jam jam-path at own]} @perf]
    (when (and jam jam-path @dbref)
      (let [body (clj->js {:jam jam :at at :session session-id :author (my-author) :t (js/Date.now)
                           :events (mapv (fn [e] (enc [(:t e) (:ev e)])) own)})]
        (enqueue! jam-path (fn [] (.set (.doc @dbref jam-path) body)))))))

;; ───── messages played in the jam (issue #11) ─────
;; A knob turned, a number dragged, a msg clicked are messages, not changes of the take: they are written,
;; a few at a time, to a second document of each performer (<jam>-<session>-live, the last ones), and the
;; others play them in their engines as they arrive. What was there before you joined is not played.

(def live-keep 48)
(defonce live-buf (atom []))       ; your last messages: [{:t :f :i :v}]
(defonce live-seen (atom {}))      ; session → the newest message of theirs already played here
(defonce live-timer (atom nil))

(defn live-path [] (when-let [p (:jam-path @perf)] (str p "-live")))

(defn live-flush! []
  (reset! live-timer nil)
  (when-let [path (live-path)]
    (when @dbref
      (let [body (clj->js {:jam (:jam @perf) :kind "live" :session session-id :t (js/Date.now)
                           :msgs (mapv (fn [{:keys [t f i v]}] (enc [t f i v])) @live-buf)})]
        (enqueue! path (fn [] (.set (.doc @dbref path) body)))))))

(defn played!
  "A message played here: in a jam, it goes to the others too (sent every 60 ms at most)."
  [f inlet v]
  (when (and (:jam @perf) (:jam-path @perf))
    (swap! live-buf (fn [b] (vec (take-last live-keep (conj b {:t (js/Date.now) :f f :i inlet :v v})))))
    (when-not @live-timer (reset! live-timer (js/setTimeout live-flush! 60)))))

(defn play-live!
  "Plays here the new messages of another performer of the jam."
  [s msgs]
  (let [ms (sort-by first (filter (fn [[t f i]] (and (number? t) (keyword? f) (number? i))) msgs))
        newest (reduce max 0 (map first ms))
        seen (get @live-seen s)]
    (when (seq ms)
      (swap! live-seen assoc s (max newest (or seen 0)))
      ;; the first time: what was played before you came is not played again
      (when seen
        (let [p (work-patch)]
          (doseq [[t f i v] ms :when (> t seen)]
            (when (get-in (eng/flat p) [:boxes f])
              (try (eng/inject! (fn [] (work-patch)) f i v)
                   (catch :default e (js/console.error "jam message" e))))))
        (render-overlay!)))))

(defn on-jam
  "The documents of the jams of this work: the changes of the others in yours join the take, and their
   messages are played here."
  [snap]
  (when-let [{:keys [jam]} @perf]
    (doseq [d (array-seq (.-docs snap)) :when (.-exists d)
            :let [m (js->clj (.data d)) s (get m "session")]
            :when (and (= jam (get m "jam")) (= "live" (get m "kind")) (string? s) (not= s session-id))]
      (play-live! s (map dec* (get m "msgs"))))
    (let [others (into {} (for [d (array-seq (.-docs snap)) :when (.-exists d)
                                :let [m (js->clj (.data d)) s (get m "session")]
                                :when (and (= jam (get m "jam")) (not= "live" (get m "kind")) (string? s) (not= s session-id))]
                            [s (vec (keep (fn [x]
                                            (let [[t ev] (dec* x)]
                                              (when (and (number? t) (vector? ev) (keyword? (first ev))) {:t t :s s :ev ev})))
                                          (get m "events")))]))]
      (when (not= others (:others @perf))
        (swap! perf (fn [st] (when st (perf-recompute (assoc st :others others)))))))))

(defn jam-listen! []
  (when-let [f @jam-unsub] (f))
  (reset! jam-unsub (when-let [c (jam-coll)] (.onSnapshot (.collection @dbref c) on-jam db-failed!))))

(defn jam-at
  "The jam someone is playing from this point of the history, if any."
  [pos]
  (some (fn [p] (when (and (:jam p) (not (:same p)) (= (norm (:jam-at p)) pos)) (:jam p))) @peers))

(defn jam-mates
  "Who else is in your jam now."
  []
  (when-let [j (:jam @perf)] (filter (fn [p] (and (= j (:jam p)) (not (:same p)))) @peers)))

;; ───── commands ─────

(defn perform
  "Perform: rehearse, try and improvise outside the history, from where you are. In a shared room, with
   those performing from this same point (a jam). (compose) goes back, keeping the take or not."
  ([] (perform nil))
  ([jam-id]
   (when @perf (fail "You are already in Perform: (compose) to go back."))
   (when (#{:connecting :none} (:mode @hist)) (fail "Open a work before performing."))
   (stop-follow!)
   (let [pos (norm (:pos @world))
         base (work-patch)
         coll (jam-coll)
         jam (when coll (or jam-id (jam-at pos) (new-jam-id)))]
     (reset! perf {:from pos :origin pos :at pos :base base :patch base :own [] :others {} :redo [] :cut 0
                   :jam jam :jam-path (when jam (str coll "/" jam "-" session-id))})
     (when jam
       (swap! jam-seen conj jam)
       (jam-listen!)
       (jam-push!))
     (publish-presence!)
     (cond-> {:perform-from (moment-name pos)}
       jam (assoc :jam jam)))))

(defn jam
  "Joins the jam of someone performing in this room: from the same point of the history, with them."
  [id]
  (let [p (first (filter (fn [p] (= (:jam p) id)) @peers))]
    (cond
      (nil? p) (fail "Nobody is performing in that jam now.")
      (= id (:jam @perf)) (fail "You are already in that jam.")
      @perf (fail "You are in Perform: (compose) first, then join the jam.")
      (not (and (:jam-at p) (node (first (:jam-at p))))) (fail "That point of the history has not arrived here yet: try again in a moment."))
    (stop-follow!)
    (swap! world assoc :pos (norm (:jam-at p)) :auto false :prev-pos nil)
    (perform id)))

(declare show-leave-dialog! hide-leave-dialog!)

(defn end-perform!
  "Leaves Perform (and the jam): returns the take as it was."
  []
  (let [st @perf]
    (when-let [f @jam-unsub] (f) (reset! jam-unsub nil))
    (when-let [path (:jam-path st)]
      (when @dbref
        (enqueue! path (fn [] (.delete (.doc @dbref path))))
        (let [lp (str path "-live")] (enqueue! lp (fn [] (.delete (.doc @dbref lp)))))))
    (when-let [t @live-timer] (js/clearTimeout t) (reset! live-timer nil))
    (reset! live-buf [])
    (reset! live-seen {})
    (reset! perf nil)
    (hide-leave-dialog!)
    (publish-presence!)
    st))

(defn write-take!
  "Writes the changes of a take since its last snapshot as a new segment from where it starts, closed by
   `mark`; returns the position after it."
  [st mark]
  (let [evs (vec (map :ev (perf-events st))) origin (:origin st)
        id (new-node! (first origin) (if origin (second origin) 0) (conj evs mark) nil)]
    [id (inc (count evs))]))

(defn compose
  "Back to Compose. (compose) asks what to do with the take, if it has changes; (compose :keep) writes it
   into the history as a new point, a branch from where it started; (compose :discard) drops it and goes
   back to where you were before performing."
  ([] (when-not @perf (fail "You are already in Compose."))
      (if (pos? (:changes (take-summary @perf)))
        (do (show-leave-dialog!) :choose)
        (compose :discard)))
  ([how]
   (when-not @perf (fail "You are already in Compose."))
   (case how
     :keep (let [n (:changes (take-summary @perf))
                 st (end-perform!)]
             (if (pos? n)
               (let [tip (write-take! st [:mark {:kind :take}])]
                 (swap! world assoc :pos tip :auto true :prev-pos nil)
                 {:kept n :at (moment-name tip)})
               (do (swap! world assoc :pos (:origin st) :prev-pos nil) {:kept 0})))
     :discard (let [st (end-perform!) from (:from st)]
                (swap! world assoc :pos from :auto (if from (leaf? from) true) :prev-pos nil)
                {:back-to (moment-name from)})
     (fail "Use (compose), (compose :keep) or (compose :discard)."))))

(defn snapshot
  "A keyframe: a point of the history with the work as it is now, in Compose or in Perform (where the take
   so far is written, and goes on from there). (snapshot \"intro\") names it."
  ([] (snapshot nil))
  ([label]
   (let [mark [:mark (cond-> {:kind :snapshot} (some? label) (assoc :label (str label)))]]
     (if-let [st @perf]
       (let [evs (perf-events st)
             tip (write-take! st mark)]
         ;; the take goes on from the snapshot: what it had is now in the history
         (swap! perf (fn [s] (assoc s :origin tip :base (:patch s) :redo []
                                    :cut (reduce max (or (:cut s) 0) (map :t evs)))))
         (swap! world assoc :pos tip :auto false :prev-pos nil)
         {:snapshot (moment-name tip) :changes (count evs)})
       (do (dispatch! mark) (here))))))

;; ───── interface: the mode button, what the take has, leaving it, invitations ─────

(defn floating [id cls]
  (or ($ id)
      (let [el (js/document.createElement "div")]
        (set! (.-id el) id)
        (set! (.-className el) cls)
        (set! (.-hidden el) true)
        (.appendChild (.-body js/document) el)
        el)))

(defn hide-leave-dialog! [] (when-let [el ($ "perform-pop")] (set! (.-hidden el) true)))

(defn show-leave-dialog! []
  (let [st @perf {:keys [changes layout work]} (take-summary st) el (floating "perform-pop" "perform-pop")]
    (set! (.-innerHTML el)
          (str "<p><b>Back to Compose</b> · this take has " changes (if (= 1 changes) " change" " changes")
               " (" work " to the work, " layout " of layout)"
               (when (:jam st) " — the whole jam, everyone's changes") ".</p>"
               "<div class=\"pp-actions\">"
               "<button class=\"act primary\" data-perf=\":keep\" title=\"A new point of the history, as a branch from "
               (esc (moment-name (:origin st))) "\">Keep it as a new point</button>"
               "<button class=\"act\" data-perf=\":discard\">Discard: back to " (esc (moment-name (:from st))) "</button>"
               "<button class=\"act\" data-perf=\"stay\">Keep performing</button>"
               "</div>"))
    (set! (.-hidden el) false)))

(defn render-perform! []
  (let [st @perf on (boolean st) b ($ "perform-toggle") info ($ "perform-info")]
    (.toggle (.-classList (.-body js/document)) "performing" on)
    (when b
      (.toggle (.-classList b) "on" on)
      (set! (.-title b) (if on
                          "Back to Compose: keep the take as a new point of the history, or discard it"
                          "Perform: rehearse, try and improvise outside the history (in a shared room, a jam with whoever performs from the same point)")))
    (when info
      (set! (.-hidden info) (not on))
      (when on
        (let [{:keys [changes]} (take-summary st) n (count (jam-mates))]
          (set! (.-textContent info)
                (str "from " (moment-name (:origin st)) " · " changes (if (= 1 changes) " change" " changes")
                     (when (:jam st) (str " · jam" (if (pos? n) (str " with " n) ", alone for now"))))))))
    (when-not on (hide-leave-dialog!))))

(defn render-jam-invite! []
  (let [offer (when-not @perf
                (first (filter (fn [p] (and (:jam p) (not (:same p)) (not (contains? @jam-seen (:jam p))))) @peers)))
        el (floating "jam-invite" "jam-invite")]
    (if-not offer
      (set! (.-hidden el) true)
      (let [who (if (:me offer) "You, in another tab," (or (not-empty (get-in @profiles [(:by offer) :name])) "Someone"))
            at (if (and (:jam-at offer) (node (first (:jam-at offer)))) (moment-name (:jam-at offer)) "a point of the history")]
        (set! (.-innerHTML el)
              (str "<p><b>" (esc who) "</b> is performing from " (esc at) ". Jam together from there?</p>"
                   "<div class=\"pp-actions\">"
                   "<button class=\"act primary\" data-jam=\"" (esc (:jam offer)) "\">Jam together</button>"
                   "<button class=\"act\" data-jam-no=\"" (esc (:jam offer)) "\">Not now</button>"
                   "</div>"))
        (set! (.-hidden el) false)))))

(.addEventListener (floating "perform-pop" "perform-pop") "click"
  (fn [e]
    (when-let [a (.. e -target -dataset -perf)]
      (if (= a "stay") (hide-leave-dialog!) (gesture! (str "(compose " a ")"))))))

(.addEventListener (floating "jam-invite" "jam-invite") "click"
  (fn [e]
    (let [ds (.. e -target -dataset)]
      (cond
        (.-jam ds) (do (swap! jam-seen conj (.-jam ds)) (gesture! (str "(jam " (pr-str (.-jam ds)) ")")))
        (.-jamNo ds) (do (swap! jam-seen conj (.-jamNo ds)) (render-jam-invite!))))))

(when-let [b ($ "perform-toggle")]
  (.addEventListener b "click" (fn [_] (gesture! (if @perf "(compose)" "(perform)")))))

(when-let [b ($ "snap-btn")]
  (.addEventListener b "click" (fn [_] (gesture! "(snapshot)"))))

(add-watch perf ::render (fn [_ _ _ _] (render-all!) (render-perform!) (render-jam-invite!)))
(add-watch peers ::perform (fn [_ _ _ _] (render-perform!) (render-jam-invite!)))
;; another work opened: the take of the one before is left behind
(add-watch work ::perform (fn [_ _ o n] (when (and @perf (not= (select-keys o [:kind :id]) (select-keys n [:kind :id]))) (end-perform!))))

(render-perform!)
