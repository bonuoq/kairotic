;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 9 of 12: sessions
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── session manager ─────────────────────────

(defonce rooms (atom {}))
(defonce solo-works (atom {}))
(defonce lobby-peers (atom []))
(defonce snapshot-subs (atom []))   ; not `subs`: the page shares one namespace with components, and clojure.core/subs must stay a function there
(defonce mgr (atom {:open true :confirm nil :busy nil :invite nil :relays false}))

(defn room-name [id] (str "room-" (str/lower-case id)))

(defn meta-of [d]
  (let [m (js->clj (.data d))]
    {:id (.-id d)
     :name (let [n (get m "name")] (if (and (string? n) (seq n)) n "Untitled"))
     :created (let [t (get m "created")] (if (number? t) t 0))
     :origin (let [o (get m "origin")] (when (string? o) o))}))

(defn lobby-presence! []
  (when-let [r @roomref]
    (.catch (.presence r (clj->js {:room (when (= :room (:kind @work)) (:id @work))})) (fn [_] nil))))

(defn people-in [id] (count (filter (fn [p] (= (:room p) id)) @lobby-peers)))

(defn unsub-all! []
  (doseq [u @snapshot-subs] (u))
  (reset! snapshot-subs []))

(defn leave-room! []
  (when-let [r @named-room]
    (.catch (.leave r) (fn [_] nil))
    (reset! named-room nil))
  (reset! peers []))

(defn set-hash! [h]
  (try (if (seq h)
         (set! (.-hash js/location) h)
         (.replaceState js/history nil "" (str (.-pathname js/location) (.-search js/location))))
       (catch :default _ nil)))

(defn show-manager! [] (swap! mgr assoc :open true :confirm nil))
(defn hide-manager!
  "Closes the session manager: back to the open work, or — when none is open yet — into a local one."
  []
  (if (:kind @work)
    (swap! mgr assoc :open false :confirm nil)
    (open-work! :local "local" "Local")))

(defn on-meta [d]
  (when (.-exists d)
    (let [m (js->clj (.data d)) v (get m "simultaneity_ms") n (get m "name")]
      (when (string? n) (swap! work assoc :name n))
      (when (and (number? v) (<= 0 v 10000) (not= v (:simul-ms @settings)))
        (swap! settings assoc :simul-ms v)))))

(defn reset-work-state! [mode]
  ;; what boxes of the previous work showed and held is forgotten (a new box with the same id starts empty)
  (swap! eng/rt assoc :shows {} :states {} :loops #{})
  (reset! score-cache {})
  (reset! live-trees {})
  (reset! dismissed-trees {})
  (reset! sent-trees {})
  (reset! sent-data {})
  (reset! sent-shape nil)
  (reset! msg-edits {})
  (unsub-all!)
  (leave-room!)
  (reset! queues {})
  (reset! cache {})
  (reset! settings {:simul-ms 1500})
  (swap! ui assoc :follow nil :merge-pick false :sel nil :drag nil :wire nil)
  (.remove (.-classList ($ "hist-wrap")) "picking")
  (reset! world {:pos nil :auto true :prev-pos nil :jumped-at 0})
  (swap! hist assoc :nodes {} :loaded false :mode mode))

(defonce lesson (atom nil))   ; the open lesson (a tutorial or a help patch), Study 18

(defn open-work!
  "Opens a work: :room (shared), :solo (private) or :local (not saved)."
  [kind id nm]
  (eng/stop!)
  (reset! lesson nil)
  (reset! cbox/trust (not= kind :room))
  (cbox/forget-language! "clojurescript")
  (reset! work {:kind kind :id id :name nm})
  (reset-work-state! (case kind
                       :room (if (:writable @hist) :shared :readonly)
                       :solo :solo
                       :local))
  (swap! mgr assoc :open false :confirm nil :invite nil)
  (set-hash! (if (= kind :room) (str "room-" id) ""))
  (lobby-presence!)
  (if (= kind :local)
    (start-local!)
    (let [db @dbref]
      (swap! snapshot-subs conj (.onSnapshot (.collection db (hist-path)) on-history db-failed!))
      (swap! snapshot-subs conj (.onSnapshot (.doc db (work-base)) on-meta (fn [_] nil)))
      (when (and (= kind :room) @roomref)
        (-> (.join @roomref (room-name id))
            (.then (fn [r]
                     (if (and (= :room (:kind @work)) (= id (:id @work)))
                       (do (reset! named-room r) (setup-room! r))
                       (.catch (.leave r) (fn [_] nil)))))
            (.catch (fn [_] nil))))))
  (repl-print! "out" (esc (str "; " (case kind :room "Shared room" :solo "Solo work" "Local work") ": «" nm "»"))))

(defn close-work! []
  (reset! lesson nil)
  (reset! work {:kind nil :id nil :name nil})
  (reset-work-state! :none)
  (set-hash! "")
  (lobby-presence!)
  (show-manager!))

(defn coll-for [kind] (case kind :room "rooms" :solo (str "data/users/" (uid))))

(defn busy! [msg] (swap! mgr assoc :busy msg))

(defn mgr-fail! [e]
  (busy! nil)
  (db-failed! e))

(defn create-work! [kind nm example?]
  (let [db @dbref
        ref (.doc (.collection db (coll-for kind)))
        id (.-id ref)]
    (busy! "Creating…")
    (-> (.set ref (clj->js {:name nm :created (js/Date.now) :author (uid) :simultaneity_ms 1500}))
        (.then (fn [_]
                 (busy! nil)
                 (open-work! kind id nm)
                 (when example? (gesture! "(load-example)"))))
        (.catch mgr-fail!))))

(defn plain [o] (js/JSON.parse (js/JSON.stringify o)))

(defn copy-work!
  "Copies a work with all its history into a new work (from room to solo or the other way round)."
  [from-kind from-id to-kind nm]
  (let [db @dbref
        src (str (base-of from-kind from-id) "/history")
        ref (.doc (.collection db (coll-for to-kind)))
        id (.-id ref)
        dst (str (coll-for to-kind) "/" id "/history")]
    (busy! "Copying the history…")
    (-> (.set ref (clj->js {:name nm :created (js/Date.now) :author (uid) :simultaneity_ms 1500
                            :origin (str (name from-kind) ":" from-id)}))
        (.then (fn [_] (.get (.collection db src))))
        (.then (fn [snap]
                 (reduce (fn [p d] (.then p (fn [_] (.set (.doc db (str dst "/" (.-id d))) (plain (.data d))))))
                         (js/Promise.resolve nil)
                         (array-seq (.-docs snap)))))
        (.then (fn [_] (busy! nil) (open-work! to-kind id nm)))
        (.catch mgr-fail!))))

(defn delete-work!
  "Deletes a work and all its history."
  [kind id]
  (let [db @dbref base (base-of kind id)]
    (when (and (= kind (:kind @work)) (= id (:id @work))) (close-work!))
    (busy! "Deleting…")
    (-> (.get (.collection db (str base "/history")))
        (.then (fn [snap]
                 (reduce (fn [p d] (.then p (fn [_] (.delete (.doc db (str base "/history/" (.-id d)))))))
                         (js/Promise.resolve nil)
                         (array-seq (.-docs snap)))))
        (.then (fn [_] (.delete (.doc db base))))
        (.then (fn [_] (busy! nil) (swap! mgr assoc :confirm nil)))
        (.catch mgr-fail!))))

(defn fmt-date [t]
  (if (pos? t)
    (let [d (js/Date. t)]
      (str (.toLocaleDateString d "en-GB" #js {:day "numeric" :month "short"}) " · "
           (.toLocaleTimeString d "en-GB" #js {:hour "2-digit" :minute "2-digit"})))
    ""))

(defn room-link
  "A link to room id on this site, with this page's relays when they are not the site's."
  [id]
  (with-relay (str (.-origin js/location) (.-pathname js/location) "#room-" id)))

(defn item-html [kind {:keys [id created origin] nm :name}]
  (let [k (name kind)
        current? (and (= kind (:kind @work)) (= id (:id @work)))
        confirm? (= (:confirm @mgr) [k id])
        n (when (= kind :room) (people-in id))
        can-write (:writable @hist)]
    (str "<li class=\"item" (when current? " current") (when (= id (:invite @mgr)) " invited") "\">"
         "<div class=\"item-main\"><span class=\"item-name\">" (esc nm) "</span>"
         "<span class=\"item-meta\">" (fmt-date created)
         (when origin (str " · copy"))
         (when (and n (pos? n)) (str " · <b>" n (if (= 1 n) " person inside" " people inside") "</b>"))
         (when current? " · open now")
         "</span></div>"
         "<div class=\"item-acts\">"
         "<button class=\"act primary\" data-act=\"open\" data-kind=\"" k "\" data-id=\"" (esc id) "\">" (if current? "Back" "Open") "</button>"
         (when (and (= kind :room) (pages?))
           (str "<button class=\"act\" data-act=\"link\" data-kind=\"room\" data-id=\"" (esc id) "\" title=\"Copies a link to this room"
                (when (relay-param) ", with the relay it is on") "\">Copy link</button>"))
         (when can-write
           (str (if (= kind :solo)
                  (str "<button class=\"act\" data-act=\"copy\" data-kind=\"" k "\" data-to=\"room\" data-id=\"" (esc id) "\" title=\"Creates a shared room with a copy of this work and its history\">Share a copy</button>")
                  (str "<button class=\"act\" data-act=\"copy\" data-kind=\"" k "\" data-to=\"solo\" data-id=\"" (esc id) "\" title=\"Creates a solo work with a copy of this room and its history\">Copy for me</button>"))
                "<button class=\"act danger" (when confirm? " armed") "\" data-act=\"delete\" data-kind=\"" k "\" data-id=\"" (esc id) "\">"
                (if confirm? "Sure? Delete" "Delete") "</button>"))
         "</div></li>")))

(defn welcome
  "What the session manager says before any work is open: what Kairotic is, how to start, and that it is an alpha."
  []
  (if (es?)
    (str "<div class=\"mgr-welcome\">"
         "<p class=\"wt\">Te damos la bienvenida a <b>Kairotic</b> <span class=\"alpha\">0.2.0-alpha</span></p>"
         "<p>Un espacio para componer, improvisar e interpretar música donde <b>el patch y su código son la misma obra</b>: cajas unidas por líneas, como en Max o Pure Data, cada gesto guardado en una historia que puedes recorrer, ramificar y compartir.</p>"
         "<ul>"
         "<li><b>Empieza</b> abajo: una obra <b>solo</b> (se guarda para ti), una <b>sala compartida</b> (con otras personas en la misma historia) o <b>en local</b>, sin guardar.</li>"
         "<li><b>Doble clic</b> en un sitio vacío crea una caja (<code>osc~ 440</code>); arrastra de una salida a una entrada para conectar; <b>▶</b> pone en marcha el sonido.</li>"
         "<li>La pestaña <b>Help</b> tiene la guía, los conceptos, los tutoriales y una página para cada caja; <b>Claude</b> hace patches a partir de lo que describes.</li>"
         "</ul>"
         "<p class=\"alpha-note\">Es una <b>versión alfa</b>: puede fallar, y cambiará. Lo que nos cuentes decide lo que viene después; la pestaña <b>Feedback</b> lo convierte en un aviso en GitHub. ¡Gracias por probarla!</p>"
         "<p class=\"wb\"><button class=\"act primary\" data-act=\"guide\">Leer la guía</button> <button class=\"act\" data-act=\"local\">Empezar en local</button> <button class=\"act\" data-act=\"feedback\">Feedback</button></p>"
         "</div>")
    (str "<div class=\"mgr-welcome\">"
         "<p class=\"wt\">Welcome to <b>Kairotic</b> <span class=\"alpha\">0.2.0-alpha</span></p>"
         "<p>A space to compose, improvise and perform music where <b>the patch and its code are the same work</b>: boxes joined by lines, as in Max or Pure Data, every gesture kept in a history you can travel, branch and share.</p>"
         "<ul>"
         "<li><b>Start</b> below: a <b>solo</b> work (saved for you), a <b>shared room</b> (with others, in the same history) or <b>locally</b>, without saving.</li>"
         "<li><b>Double-click</b> an empty place to create a box (<code>osc~ 440</code>); drag from an outlet to an inlet to connect; <b>▶</b> starts the sound.</li>"
         "<li>The <b>Help</b> tab has the guide, the concepts, the tutorials and a page for every box; <b>Claude</b> makes patches from what you describe.</li>"
         "</ul>"
         "<p class=\"alpha-note\">This is an <b>alpha</b>: it may fail, and it will change. What you tell us decides what comes next; the <b>Feedback</b> tab turns it into a GitHub issue. Thank you for trying it!</p>"
         "<p class=\"wb\"><button class=\"act primary\" data-act=\"guide\">Read the guide</button> <button class=\"act\" data-act=\"local\">Start locally</button> <button class=\"act\" data-act=\"feedback\">Feedback</button></p>"
         "</div>")))

(defn render-manager! []
  (let [{:keys [open busy invite]} @mgr
        el ($ "manager")
        db? (some? @dbref)
        can-write (:writable @hist)
        connecting? (= :connecting (:mode @hist))
        solo-list (sort-by :created > (vals @solo-works))
        room-list (sort-by (fn [s] [(if (= (:id s) invite) 0 1) (- (people-in (:id s))) (- (:created s))]) (vals @rooms))
        inv (when invite (get @rooms invite))]
    (set! (.-hidden el) (not open))
    (set! (.-innerHTML ($ "work-name"))
          (if (:kind @work)
            (str (case (:kind @work) :room "Room" :solo "Solo" "Local") " · <b>" (esc (or (:name @work) "")) "</b>")
            "No work open"))
    (when open
      ;; the lists update live: whatever you are typing in the forms is kept
      (let [keep (into {} (for [k ["new-solo" "new-room" "relay-url"] :let [i ($ k)] :when i] [k (.-value i)]))
            keep-ex (into {} (for [k ["new-solo-ex" "new-room-ex"] :let [i ($ k)] :when i] [k (.-checked i)]))
            focus (.. js/document -activeElement -id)]
        (js/setTimeout
         (fn []
           (doseq [[k v] keep] (when-let [i ($ k)] (set! (.-value i) v)))
           (doseq [[k v] keep-ex] (when-let [i ($ k)] (set! (.-checked i) v)))
           (when (and (seq focus) ($ focus) (contains? keep focus)) (.focus ($ focus))))
         0))
      (set! (.-innerHTML ($ "mgr-body"))
            (str
             (when (nil? (:kind @work)) (welcome))
             (when busy (str "<p class=\"mgr-busy\">" (esc busy) "</p>"))
             (cond
               connecting? "<p class=\"mgr-note\">Connecting…</p>"
               (not db?)
               (str "<p class=\"mgr-note\">This view has no database (outside claude.ai or not signed in): you can only work locally, without saving.</p>"
                    "<button class=\"act primary\" data-act=\"local\">Start locally</button>")
               :else
               (str
                (when inv
                  (str "<div class=\"invite\">You have been invited to the room <b>" (esc (:name inv)) "</b>."
                       " <button class=\"act primary\" data-act=\"open\" data-kind=\"room\" data-id=\"" (esc (:id inv)) "\">Enter</button></div>"))
                (when-not can-write
                  "<p class=\"mgr-note\">You can enter the rooms and walk through their history, but not create or change works: your access to this artifact is read only.</p>")
                (relay-section (:relays @mgr))
                "<div class=\"mgr-cols\">"
                (if (pages?)
                  "<section class=\"mgr-col\"><h3>Solo</h3><p class=\"mgr-hint\">Only you see these works: they are encrypted with a key that stays in this browser.</p>"
                  "<section class=\"mgr-col\"><h3>Solo</h3><p class=\"mgr-hint\">Only you see these works, not even whoever shares the artifact.</p>")
                (if (seq solo-list)
                  (str "<ul class=\"items\">" (apply str (map (fn [o] (item-html :solo o)) solo-list)) "</ul>")
                  "<p class=\"mgr-empty\">You have no solo works yet.</p>")
                (when (and can-write (uid))
                  "<form class=\"new\" data-kind=\"solo\"><input id=\"new-solo\" placeholder=\"Name of the work\" maxlength=\"60\" required><label class=\"opt\"><input type=\"checkbox\" id=\"new-solo-ex\"> with the example work</label><button class=\"act primary\">Create</button></form>")
                "</section>"
                (if (pages?)
                  "<section class=\"mgr-col\"><h3>Shared rooms</h3><p class=\"mgr-hint\">Anyone using this site with the same relay sees them and can enter.</p>"
                  "<section class=\"mgr-col\"><h3>Shared rooms</h3><p class=\"mgr-hint\">Anyone with access to this artifact sees them and can enter.</p>")
                (if (seq room-list)
                  (str "<ul class=\"items\">" (apply str (map (fn [s] (item-html :room s)) room-list)) "</ul>")
                  "<p class=\"mgr-empty\">No rooms yet.</p>")
                (when can-write
                  "<form class=\"new\" data-kind=\"room\"><input id=\"new-room\" placeholder=\"Name of the room\" maxlength=\"60\" required><label class=\"opt\"><input type=\"checkbox\" id=\"new-room-ex\"> with the example work</label><button class=\"act primary\">Create</button></form>")
                "</section></div>"
                "<p class=\"mgr-foot\"><button class=\"act\" data-act=\"local\">Try locally, without saving</button> <button class=\"act\" data-act=\"learn\" title=\"Tutorials and the help of every component\">Learn: tutorials and help</button></p>")))))))

(add-watch mgr ::render (fn [_ _ _ _] (render-manager!)))
(add-watch rooms ::render (fn [_ _ _ _] (render-manager!)))
(add-watch solo-works ::render (fn [_ _ _ _] (render-manager!)))
(add-watch lobby-peers ::render (fn [_ _ _ _] (when (:open @mgr) (render-manager!))))
(add-watch work ::render (fn [_ _ _ _] (render-manager!)))

(.addEventListener ($ "mgr-body") "click"
  (fn [e]
    (when-let [b (.closest (.-target e) "[data-act]")]
      (let [act (.. b -dataset -act)
            kind (keyword (.. b -dataset -kind))
            id (.. b -dataset -id)
            item (get (if (= kind :room) @rooms @solo-works) id)]
        (case act
          "open" (if (and (= kind (:kind @work)) (= id (:id @work)))
                   (hide-manager!)
                   (open-work! kind id (:name item)))
          "copy" (let [to (keyword (.. b -dataset -to))]
                   (copy-work! kind id to (str (:name item) (if (= to :room) " (shared)" " (my copy)"))))
          "delete" (if (= (:confirm @mgr) [(name kind) id])
                     (delete-work! kind id)
                     (do (swap! mgr assoc :confirm [(name kind) id])
                         (js/setTimeout (fn [] (when (= (:confirm @mgr) [(name kind) id]) (swap! mgr assoc :confirm nil))) 4000)))
          "local" (open-work! :local "local" "Local")
          "link" (let [u (room-link id)]
                   (-> (js/Promise.resolve)
                       (.then (fn [_] (.writeText (.-clipboard js/navigator) u)))
                       (.then (fn [_] (set! (.-textContent b) "Copied")))
                       (.catch (fn [_] (repl-print! "out" (esc (str "; " u)))
                                 (set! (.-textContent b) "In the REPL")))
                       (.then (fn [_] (js/setTimeout (fn [] (render-manager!)) 1500)))))
          "relay-test" (let [u (normalize-relay (.-value ($ "relay-url")))]
                         (if-let [why (relay-problem u)]
                           (reset! relay-test {:url (str/trim (.-value ($ "relay-url"))) :state :fail :msg why})
                           (test-relay! u)))
          "relay-site" (choose-relays! "none")
          "relay-off" (choose-relays! "off")
          "relay-drop" (let [u (.. b -dataset -url)]
                         (choose-relays! (let [left (remove #{u} (current-relays))] (if (seq left) (str/join "," left) "off"))))
          "learn" (do (open-work! :local "local" "Local") (show-help! nil))
          "guide" (do (open-work! :local "local" "Local") (docs "guide"))
          "feedback" (do (when-not (:kind @work) (open-work! :local "local" "Local")) (swap! mgr assoc :open false) (.click ($ "tab-feedback")))
          nil)))))

(.addEventListener ($ "mgr-body") "submit"
  (fn [e]
    (.preventDefault e)
    (let [f (.-target e)
          kind (keyword (.. f -dataset -kind))]
      (if (= kind :relay)
        ;; use this relay (only it): the page reloads syncing through it
        (let [typed (str/trim (.-value ($ "relay-url"))) u (normalize-relay typed)]
          (if-let [why (relay-problem u)]
            (reset! relay-test {:url typed :state :fail :msg why})
            (choose-relays! u)))
        (let [nm (str/trim (.-value ($ (str "new-" (name kind)))))
              ex (.-checked ($ (str "new-" (name kind) "-ex")))]
          (when (seq nm) (create-work! kind nm ex)))))))

;; the relay section: open or closed stays as it was when the manager is drawn again, and while it is
;; open its relays' state is looked at every two seconds
(.addEventListener ($ "mgr-body") "toggle"
  (fn [e] (let [t (.-target e)]
            (when (and (= "relays" (.-id t)) (not= (boolean (.-open t)) (:relays @mgr)))
              (swap! mgr assoc :relays (boolean (.-open t))))))
  true)
(add-watch relay-status ::render (fn [_ _ _ _] (when (:open @mgr) (render-manager!))))
(add-watch relay-test ::render (fn [_ _ _ _] (when (:open @mgr) (render-manager!))))
(defonce relay-timer
  (js/setInterval (fn [] (when (and (:open @mgr) (pages?)) (refresh-relay-status!))) 2000))

(.addEventListener ($ "open-manager") "click" (fn [_] (show-manager!)))
(.addEventListener ($ "mgr-close") "click" (fn [_] (hide-manager!)))
(.addEventListener js/document "keydown"
  (fn [e] (when (and (= (.-key e) "Escape") (:open @mgr) (not (:merge-pick @ui))) (hide-manager!))))

;; when a compilation finishes, the status, ports and parameters of code boxes change
(swap! cbox/listeners assoc :page (fn [] (render-all!)))

;; ───────────────────────── transport ─────────────────────────

(.addEventListener ($ "play") "click" (fn [_] (gesture! "(play)")))
(.addEventListener ($ "stop") "click" (fn [_] (gesture! "(stop)")))

(-> (.-kairoticVerovio js/window)
    (.then (fn [tk]
             (reset! vrv tk)
             (reset! vrv-status :ok)
             (reset! score-cache {})
             (render-scene (current))))
    (.catch (fn [_]
              (reset! vrv-status :error)
              (render-scene (current)))))
