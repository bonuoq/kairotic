;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 7 of 12: connection
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── connection to the shared history ─────────────────────────

(defn js->node [d]
  (let [m (js->clj (.data d))
        at (get m "at") parent (get m "parent") evs (get m "events") t (get m "t")
        sess (get m "session") mg (get m "merge")]
    {:id (.-id d)
     :parent (when (string? parent) parent)
     :at (if (number? at) at 0)
     :author (str (get m "author"))
     :session (when (string? sess) sess)
     :merge (when (valid-pos? mg) mg)
     :t (if (number? t) t 0)
     :events (if (sequential? evs)
               (vec (keep (fn [x] (let [v (dec* x)] (when (and (vector? v) (keyword? (first v))) v))) evs))
               [])}))

(defn on-history [snap]
  (let [incoming (into {} (for [d (array-seq (.-docs snap)) :when (.-exists d)]
                            (let [n (js->node d)] [(:id n) n])))]
    (swap! hist
           (fn [h]
             (let [local (:nodes h)
                   mine? (fn [n] (= (:author n) (my-author)))
                   pending (into {} (filter (fn [[k n]] (and (not (contains? incoming k)) (mine? n))) local))
                   merged (into pending
                                (for [[k r] incoming :let [l (get local k)]]
                                  [k (if (and l (mine? l) (> (count (:events l)) (count (:events r)))) l r)]))]
               (assoc h :nodes merged :loaded true))))
    (when (nil? (:pos @world))
      (when-let [t (newest-tip)] (swap! world assoc :pos t)))))

(defn start-local! []
  (swap! hist assoc :mode :local :loaded true)
  (when (empty? (:nodes @hist))
    (let [id (new-node! nil 0 [[:load (build example)]] nil)]
      (swap! world assoc :pos [id 1]))))

(defn setup-room!
  "Presence inside the open room (one named room per shared work)."
  [room]
  (.onPeers room
            (fn [ch]
              (reset! peers
                      (vec (for [p (array-seq (.-peers ch)) :when (not= "agent" (.-kind p))]
                             {:peer (.-peer p) :by (.-by p) :me (.-isMe p) :same (.-sameTab p) :kind (.-kind p)
                              :session (let [s (.. p -presence -session)] (when (string? s) s))
                              :pos (let [pp (js->clj (.. p -presence -pos))] (when (valid-pos? pp) pp))
                              ;; performing in a jam (issue #5): its id and the point of the history it starts from
                              :jam (let [j (.. p -presence -jam)] (when (string? j) j))
                              :jam-at (let [pp (js->clj (.. p -presence -jamAt))] (when (valid-pos? pp) pp))}))))
            (fn [_] nil))
  (publish-presence!))

;; Where the page gets its database, rooms, user and Claude: inside claude.ai from the viewer
;; (window.claude); anywhere else from a backend with the same shape (window.kairoticBackend: GUN for
;; data and rooms, Claude with your own API key — see kairotic/backends/gun-backend.js). Study 17.
(defn backend [] (.-kairoticBackend js/window))
(defn pages? "True outside claude.ai, when the page runs on its own backend (Kairotic Pages)."
  [] (boolean (and (not (.-claude js/window)) (backend))))
(defn relay-note
  "On Pages, which relays the page syncs through (or that it works alone)."
  []
  (when (pages?)
    (let [ps (js->clj (or (.-kairoticPeers js/window) #js []))]
      (str "<p class=\"mgr-note\">"
           (if (seq ps)
             (str "Synced through " (str/join ", " (map #(str "<code>" (esc %) "</code>") ps))
                  " (a free relay may take up to a minute to wake up).")
             "No relay: works stay in this browser and rooms reach nobody else. Add <code>?peer=wss://…/gun</code> to the address.")
           "</p>"))))

(defn cuse [nm]
  (cond
    (.-claude js/window) (.catch (.use (.-claude js/window) nm) (fn [_] nil))
    (backend) (js/Promise.resolve (aget (backend) nm))
    :else (js/Promise.resolve nil)))
