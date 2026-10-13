;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 12 of 12: startup
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── startup ─────────────────────────

(render-all!)
(render-comp!)
(render-controls!)
(render-manager!)
(repl-print! "out" (str "; Kairotic " version " — " (cond (.-claude js/window) "inside claude.ai: works, rooms and Claude come from claude.ai." (backend) "on its own: works and rooms in GUN (your solo works are encrypted in this browser), Claude with your own API key (Claude tab)." :else "without a database: local works only.")))
(repl-print! "out" "; New here? The Help tab has the tutorials and a page for every class (select a box and press ?). The Claude tab makes patches and components from a description. Embed puts a patch in another page.")

(let [h (.-hash js/location) m (re-matches #"#room-(.+)" (str h))]
  (when m (swap! mgr assoc :invite (second m))))

(defn start-backend! []
 (-> (js/Promise.all #js [(cuse "db") (cuse "user") (cuse "room")])
    (.then (fn [arr]
             (let [db (aget arr 0) user (aget arr 1) room (aget arr 2)]
               (reset! userref user)
               (reset! roomref room)
               (when room
                 (.onPeers room
                           (fn [ch]
                             (reset! lobby-peers
                                     (vec (for [p (array-seq (.-peers ch))]
                                            {:me (.-isMe p) :room (let [s (.. p -presence -room)] (when (string? s) s))}))))
                           (fn [_] nil))
                 (lobby-presence!))
               (if (nil? db)
                 (do (swap! hist assoc :mode :none :writable false) (render-manager!))
                 (-> (js/Promise.all #js [(if user (.id user) (js/Promise.resolve nil))
                                          (if user (.can user "data.write") (js/Promise.resolve nil))])
                     (.then (fn [r]
                              (let [id (aget r 0) can (aget r 1)
                                    writable (boolean (and id (not (false? can))))]
                                (swap! me assoc :id id)
                                (reset! dbref db)
                                (listen-library! db)
                                (swap! hist assoc :mode :none :writable writable)
                                (.onSnapshot (.collection db "rooms")
                                             (fn [snap] (reset! rooms (into {} (for [d (array-seq (.-docs snap)) :when (.-exists d)] (let [s (meta-of d)] [(:id s) s])))))
                                             db-failed!)
                                (when id
                                  (.onSnapshot (.collection db (str "data/users/" id))
                                               (fn [snap] (reset! solo-works (into {} (for [d (array-seq (.-docs snap)) :when (.-exists d)] (let [s (meta-of d)] [(:id s) s])))))
                                               (fn [_] nil)))
                                (render-manager!)))))))))
    (.catch (fn [_] (swap! hist assoc :mode :none) (render-manager!)))))

;; an embed works on its own (no database, no relay); the whole editor connects first, then opens
;; what the address asks for
(if embed-mode
  (start-from-url!)
  (.then (start-backend!) (fn [_] (start-from-url!))))
