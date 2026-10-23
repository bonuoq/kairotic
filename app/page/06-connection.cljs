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
;; ───── relays (Pages): which ones this page syncs through, chosen in the session manager ─────
;; The choice is ?peer= in the address (boot.js reads it and remembers it in this browser): a list of
;; wss://…/gun, off (no relay at all) or none (back to the site's, site/config.js). Choosing reloads the
;; page with it. While the relays are not the site's, the address and the room links carry ?peer=, so
;; whoever opens them syncs through the same relays and sees the same rooms.

(defn site-relays [] (vec (js->clj (or (.-KAIROTIC_PEERS js/window) #js []))))
(defn current-relays [] (vec (js->clj (or (.-kairoticPeers js/window) #js []))))

(defn relay-param
  "What ?peer= must say for someone else to sync through the relays of this page: nil when they are the site's."
  []
  (let [c (current-relays)]
    (cond (= c (site-relays)) nil
          (empty? c) "off"
          :else (str/join "," c))))

(defn with-relay
  "url with the ?peer= of this page's relays (or without one, when they are the site's)."
  [url]
  (let [u (js/URL. url (.-href js/location)) p (relay-param)]
    (if p (.set (.-searchParams u) "peer" p) (.delete (.-searchParams u) "peer"))
    (str/replace (.toString u) #"peer=([^&#]*)" (fn [[_ v]] (str "peer=" (js/decodeURIComponent v))))))

(defn normalize-relay
  "What someone writes as a relay, as GUN wants it: https://host → wss://host/gun, host:port → ws(s)://host:port/gun.
   nil if it cannot be a relay."
  [s]
  (let [s (str/trim (str s))
        s (cond (str/starts-with? s "https://") (str "wss://" (subs s 8))
                (str/starts-with? s "http://") (str "ws://" (subs s 7))
                (re-find #"^wss?://" s) s
                (re-find #"^(localhost|127\.0\.0\.1)(:|/|$)" s) (str "ws://" s)
                (seq s) (str "wss://" s)
                :else s)]
    (when-let [[_ scheme host path] (re-matches #"(wss?)://([^/\s,]+)(/[^\s,]*)?" s)]
      (str scheme "://" host (if (or (nil? path) (= "/" path)) "/gun" path)))))

(defn relay-problem
  "Why a page could not use relay url, or nil."
  [url]
  (cond (nil? url) "That is not a relay address: it looks like wss://host/gun."
        (and (= "https:" (.-protocol js/location)) (str/starts-with? url "ws://")
             (not (re-find #"^ws://(localhost|127\.0\.0\.1)[:/]" url)))
        "This page is served over https, so it can only reach a relay at wss:// (a host with TLS)."
        :else nil))

(defn choose-relays!
  "Reloads the page syncing through v: a list of relays, \"off\" (no relay) or \"none\" (the site's)."
  [v]
  (let [u (js/URL. (.-href js/location))]
    (.set (.-searchParams u) "peer" v)
    (.assign js/location (str/replace (.toString u) #"peer=([^&#]*)" (fn [[_ x]] (str "peer=" (js/decodeURIComponent x)))))))

(defn address-carries-relay!
  "Keeps ?peer= in the address while the relays are not the site's (so a copied address takes them along),
   and takes it away when they are."
  []
  (when (and (pages?) (not embed-mode))
    (let [now (.-href js/location) want (with-relay now)]
      (when (not= now want)
        (try (.replaceState js/history nil "" want) (catch :default _ nil))))))

(defonce relay-status (atom []))   ; [{:url :state}] while the session manager is open
(defonce relay-test (atom nil))    ; {:url :state :testing|:ok|:fail :msg}

(defn refresh-relay-status! []
  (when-let [f (and (pages?) (.-relays (backend)))]
    (let [st (vec (for [r (array-seq (f))] {:url (.-url r) :state (keyword (.-state r))}))]
      (when (not= st @relay-status) (reset! relay-status st)))))

(defn test-relay!
  "Tries to open a connection to a relay (a free one may take up to a minute to wake up)."
  [url]
  (reset! relay-test {:url url :state :testing})
  (try
    (let [ws (js/WebSocket. url)
          done (fn [state msg]
                 (when (= (:url @relay-test) url)
                   (when (= :testing (:state @relay-test)) (reset! relay-test {:url url :state state :msg msg})))
                 (try (.close ws) (catch :default _ nil)))]
      (set! (.-onopen ws) (fn [_] (done :ok "It answers.")))
      (set! (.-onerror ws) (fn [_] (done :fail "It does not answer: check the address, or that the relay is running.")))
      (js/setTimeout (fn [] (done :fail "No answer after 20 seconds (a free relay may take up to a minute to wake up: try again).")) 20000))
    (catch :default e (reset! relay-test {:url url :state :fail :msg (str (.-message e))}))))

(def relay-states {:open ["ok" "connected"] :connecting ["wait" "connecting…"] :waiting ["wait" "waiting for it (a free relay may take a minute to wake up)"]})

(defn relay-section
  "On Pages, the relays of this page in the session manager: their state, choosing others, running your own."
  [open?]
  (when (pages?)
    (let [cur (current-relays) site (site-relays) default? (= cur site)
          st (into {} (map (juxt :url :state) @relay-status))
          {t-url :url t-state :state t-msg :msg} @relay-test
          dot (fn [u] (let [[cls word] (get relay-states (get st u :waiting))]
                        (str "<span class=\"rdot " cls "\"></span><span class=\"rstate\">" word "</span>")))
          summary (cond (empty? cur) "No relay: works stay in this browser, rooms reach nobody else"
                        default? (str "The site's relay" (when (> (count cur) 1) "s"))
                        :else (str "Your relay" (when (> (count cur) 1) "s")))
          all-open (and (seq cur) (every? (fn [u] (= :open (get st u))) cur))]
      (str "<details class=\"relays\" id=\"relays\"" (when open? " open") ">"
           "<summary><span class=\"rlabel\">Relay</span> " (esc summary)
           (when (seq cur) (str " <span class=\"rdot " (if all-open "ok" "wait") "\"></span>")) "</summary>"
           "<p class=\"mgr-hint\">A relay is a small server that passes works and rooms between browsers and keeps a copy. "
           "Everyone in a community uses the same one: the rooms of one relay are not seen through another.</p>"
           (when (seq cur)
             (str "<ul class=\"rlist\">"
                  (apply str (for [u cur]
                               (str "<li><code>" (esc u) "</code> " (dot u)
                                    (when (> (count cur) 1)
                                      (str " <button class=\"act small\" data-act=\"relay-drop\" data-url=\"" (esc u) "\">Remove</button>"))
                                    "</li>")))
                  "</ul>"))
           "<form class=\"new\" data-kind=\"relay\"><input id=\"relay-url\" placeholder=\"wss://your-relay.example/gun\" spellcheck=\"false\" autocomplete=\"off\">"
           "<button type=\"button\" class=\"act\" data-act=\"relay-test\">Test</button>"
           "<button class=\"act primary\">Use</button></form>"
           (when t-url
             (str "<p class=\"rtest " (name t-state) "\"><code>" (esc t-url) "</code>: "
                  (case t-state :testing "trying…" (esc t-msg)) "</p>"))
           "<p class=\"rchoices\">"
           (when-not default? (str "<button class=\"act\" data-act=\"relay-site\">Use the site's relay" (when (> (count site) 1) "s") "</button> "))
           (when (seq cur) "<button class=\"act\" data-act=\"relay-off\">Work without a relay</button>")
           "</p>"
           "<p class=\"mgr-hint\">Changing it reloads the page. While it is not the site's, the address and the room links carry it "
           "(<code>?peer=…</code>), so whoever opens them syncs through it too.</p>"
           "<details class=\"rown\"><summary>Run your own relay</summary>"
           "<p>On any computer or server with Node.js 18 or later:</p>"
           "<pre>npx @kairotic/relay --port 8765 --data ./radata</pre>"
           "<p>It answers at <code>ws://localhost:8765/gun</code>. For others to reach it, put it on a host with TLS — a small VPS, "
           "<a href=\"https://render.com/deploy?repo=https://github.com/bonuoq/kairotic\" target=\"_blank\" rel=\"noopener\">Render</a>, "
           "Fly.io, Railway, or your machine behind a tunnel — and use <code>wss://&lt;that host&gt;/gun</code> here. "
           "It keeps what it is sent in its data folder: rooms in clear, solo works encrypted. Back that folder up. "
           "<a href=\"https://github.com/bonuoq/kairotic/tree/main/relay#readme\" target=\"_blank\" rel=\"noopener\">More</a></p>"
           "</details>"
           "</details>"))))

(defn cuse [nm]
  (cond
    (.-claude js/window) (.catch (.use (.-claude js/window) nm) (fn [_] nil))
    (backend) (js/Promise.resolve (aget (backend) nm))
    :else (js/Promise.resolve nil)))
