;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page: the agent box (issue #269, after Study 53 and discussion #256)
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).
;;
;; `agent "harmonize it in four parts in the style of Mozart"`: the request is the box's text, and Claude builds
;; what answers it inside the box, as a patch you can open, read, edit and play without Claude. Its content is a
;; line (#117): double-click opens it in its tab, each build is one more point of that line (going back and asking
;; for something else branches), and it can be used elsewhere as a `patch @name`.
;;
;; Its ports are those of its content (its inlet / outlet boxes), and one more of each, last: a message to the
;; last inlet (a string, or [:ask "…"]) is a new request, so a patch can ask it asynchronously; the last outlet
;; says what it is doing (:building, :built, [:error "…"]).
;;
;; Who pays: whoever asks — who writes the box's text, or whose patch sends the message to its last inlet (in a
;; room, whoever pressed ▶: the engine plays there). Once built it plays with no call to Claude, in releases,
;; rooms and on phones. Guards: one build at a time per box, and a request equal to the one that built it is
;; not sent again.
;;
;; The build is what the Claude tab does for a whole patch (07-claude.cljs: the catalog of classes, the page's
;; tools, check-patch-code), with what an agent's content must be, and with up to three tries: when a patch
;; does not pass the checks, its errors go back to Claude.

(in-ns 'user)

;; ───────────────────────── the box ─────────────────────────

(defn agent? [b] (and b (= "agent" (klass (:text b)))))

(defn agent-request
  "The request written in an agent box's text: agent \"…\" (or the words after agent)."
  [text]
  (let [t (str/trim (str text)) r (str/trim (if (> (count t) 5) (subs t 5) ""))]
    (if (and (> (count r) 1) (str/starts-with? r "\"") (str/ends-with? r "\""))
      (-> (subs r 1 (dec (count r))) (str/replace "\\\"" "\"") (str/replace "\\\\" "\\"))
      r)))

(defn agent-text [request] (str "agent " (pr-str (str request))))

(comp/define! "agent"
  {:doc "A box Claude builds inside, from the request in its text: agent \"…\". Its content is a patch you can open (double-click), read, edit and play without Claude; a new request is a new text, or a message to its last inlet."
   :usage "agent \"request\""
   ;; the content's ports, and the agent's own request inlet and state outlet, last
   :io (fn [b] (comp/patch-io (or (eng/inner-patch b) empty-patch)))
   :dynamic-io true})

(comp/define! "agent-core"
  {:doc "Inside an agent box, put there by the engine (not written by hand): it takes the requests of the agent's last inlet and says, by its last outlet, what the agent is doing."
   ;; not a class to write: out of the lists, of Claude's catalog and of the Help tab (issue #275)
   :internal true
   :io [1 1]
   :receive (fn [{:keys [inlet value state]}]
              (cond
                ;; what the page says of a build
                (= inlet :task)
                (let [v (:value value)]
                  {:state (if (= :building v) {:building true} {})
                   :out [[0 v]]})
                ;; a request: a string, or [:ask "…"]
                (or (string? value) (and (vector? value) (= :ask (first value)) (string? (second value))))
                (let [r (str/trim (if (string? value) value (second value)))]
                  (cond (str/blank? r) {:out [[0 [:error "an empty request"]]]}
                        (:building state) {:out [[0 [:error "still building the last request"]]]}
                        :else {:state {:building true} :effects [[:agent-ask r]]}))
                :else {}))})

;; ───────────────────────── its content: a line ─────────────────────────

(defonce agent-busy (atom #{}))   ; the agent boxes building now, by [line path id]

(defn agent-line [b] (get-in b [:data :line]))

(defn agent-front [b] (when-let [lid (agent-line b)] (nodes-front (line-nodes lid))))

(defn agent-content
  "What an agent box holds now: the patch at the newest point of its line (empty before its first build)."
  [b]
  (if-let [lid (agent-line b)]
    (line-patch-at lid (nodes-front (line-nodes lid)))
    empty-patch))

(defn agent-stale?
  "Whether an agent's content was changed after Claude built it: its line has moved past the point it built."
  [b]
  (let [built (get-in b [:data :built]) front (agent-front b)]
    (boolean (and built front (not= (vec built) (vec front))))))

(defn agent-line-name
  "A free name for the line of agent box id: agent b3, agent b3 2…"
  [id]
  (let [base (str "agent " (name id)) taken (set (map line-name (known-lines)))]
    (first (remove taken (cons base (map (fn [k] (str base " " k)) (range 2 100)))))))

(defn append-line-node!
  "Events evs as one more point of line lid (not the one on screen), after its newest one. Its new front."
  [lid evs]
  (if-let [[pid at] (nodes-front (line-nodes lid))]
    (let [id (new-id)
          n {:id id :parent pid :at at :author (my-author) :session session-id :t (js/Date.now) :merge nil
             :events (vec evs) :line lid}]
      (swap! hist assoc-in [:other lid id] n)
      (when (and (persist?) (not (str/starts-with? id "local-")))
        (let [path (str (hist-path) "/" id) body (node->js n)]
          (enqueue! path (fn [] (.set (.doc @dbref path) body)))))
      [id (count evs)])
    [(write-line-node! lid evs) (count evs)]))

;; ───────────────────────── what it says ─────────────────────────

(defn agent-say!
  "Tells the agent-core of box id (at path, in the patch that plays) what the agent is doing, if it plays."
  [path id v]
  (let [f (keyword (str (str/join "." (map name (conj (vec path) id))) ".agent-core"))]
    (try (eng/arrive! f {:task :ask :value v} false) (catch :default e (js/console.error e)))))

(defn agent-log! [cls msg] (repl-print! cls (esc (str "; " msg))))

;; ───────────────────────── building ─────────────────────────

(defn agent-host-patch
  "The patch at path (embedded patches, from the top) of the line on screen."
  [path]
  (reduce (fn [p id] (or (get-in p [:boxes id :data]) empty-patch)) (work-patch) path))

(def agent-rules
  "What Claude is told of an agent's content, before the request."
  (str "You are building the CONTENT of an `agent` box: a patch that lives inside that box, as a sub-patch. "
       "What reaches the agent box's inlets comes out of the `inlet` boxes of your patch (numbered left to right by their x), "
       "and what reaches its `outlet` boxes leaves the agent box (use `inlet~` / `outlet~` for sound): give it the inlets and "
       "outlets the request needs, and place them left to right in the order you mean. Inside it adc~ and dac~ are quiet: "
       "sound goes in and out by inlet~ / outlet~. Build with the classes that exist — the official packages carry the "
       "rules of counterpoint, rhythm and harmony of Kairotic (comes, euclid, patterns, mt…) and are to be preferred — and "
       "write a component only for what none of them does, small. Keep the patch readable: it will be opened and read.\n\n"
       "Say what you built, for whoever sees the agent box from outside: BEFORE the patch code, write a block fenced as "
       "```agent holding one EDN map — {:about \"what it does, in one short paragraph\" :inlets [\"what inlet 0 takes, and in what "
       "form\" …] :outlets [\"what outlet 0 sends, and in what form\" …]} — one string per inlet (inlet, inlet~) and per outlet "
       "(outlet, outlet~) box of your patch, in their order left to right; not the agent's own request inlet and state outlet, "
       "which come after them."))

(def agent-doc-re #"```agent\s*\n([\s\S]*?)```")

(defn agent-doc-of
  "What Claude said of what it built (its ```agent block): {:about :inlets :outlets}, or nil."
  [text]
  (when-let [[_ src] (re-find agent-doc-re (str text))]
    (let [m (try (clojure.edn/read-string src) (catch :default _ nil))
          strs (fn [v] (when (sequential? v) (vec (map str (take 32 v)))))]
      (when (map? m)
        (cond-> {}
          (string? (:about m)) (assoc :about (ai/cut (:about m) 1200))
          (strs (:inlets m)) (assoc :inlets (strs (:inlets m)))
          (strs (:outlets m)) (assoc :outlets (strs (:outlets m))))))))

(def agent-tries 3)

(defn agent-build!
  "Asks Claude for the content of agent box id (in the patch at path of line host), for request. Promise of
   the new front of its line, or nil."
  [host path id request]
  (let [s @sample-fn key [host path id]]
    (cond
      (nil? s) (do (agent-log! "err" "agent: Claude is not available in this view.") (agent-say! path id [:error "Claude is not available here"]) (js/Promise.resolve nil))
      (contains? @agent-busy key) (do (agent-log! "err" (str "agent " (name id) ": still building the last request.")) (js/Promise.resolve nil))
      :else
      (let [b (get-in (agent-host-patch path) [:boxes id])
            current (let [p (agent-content b)] (when (seq (:boxes p)) (patch->code p)))
            ask (fn [previous]
                  (str (ai/patch-prompt {:request (str agent-rules "\n\n" request) :current current :classes (ai/classes)})
                       (when previous
                         (str "\n━━━ Your last patch did not pass the checks ━━━\n" (:src previous)
                              "\n\nIts errors: " (str/join "; " (take 6 (:errors previous))) "\nMend it, and check it again.\n"))))]
        (swap! agent-busy conj key)
        (agent-say! path id :building)
        (agent-log! "" (str "agent " (name id) ": building · " (ai/cut request 120)))
        (letfn [(attempt [k previous]
                  (-> (js/Promise.all #js [(load-ask-refs) (-> (js/Promise.resolve (when (fn? (.-limits s)) (.limits s))) (.catch (fn [_] nil)))])
                      (.then (fn [a]
                               (let [refs (aget a 0) lim (aget a 1)]
                                 (s (ask previous) (clj->js (cond-> {:modelTier "default"}
                                                              (and lim (.-tools lim)) (assoc :tools (patch-tools refs))))))))
                      (.then (fn [r]
                               (let [text (str (.-text r)) doc (agent-doc-of text)
                                     src (ai/source-of (str/replace text agent-doc-re ""))]
                                 (if (nil? src)
                                   (if (< k agent-tries) (attempt (inc k) {:src "(none)" :errors ["the answer had no patch code"]})
                                       (throw (js/Error. "Claude's answer had no patch code")))
                                   (.then (check-patch-code src)
                                          (fn [chk]
                                            (cond (:ok chk) {:src src :doc doc}
                                                  (< k agent-tries) (attempt (inc k) {:src src :errors (:errors chk)})
                                                  :else (throw (js/Error. (str "after " agent-tries " tries: " (str/join "; " (take 3 (:errors chk)))))))))))))))]
          (-> (attempt 1 nil)
              (.then (fn [{:keys [src doc]}]
                       (let [code (link-code src) p (build code)
                             srcs (for [bx (vals (:boxes p)) :when (#{"script" "component"} (klass (:text bx)))] (str (get-in bx [:data :source])))
                             b (get-in (agent-host-patch path) [:boxes id])]
                         (when-not (agent? b) (throw (js/Error. "the agent box is gone")))
                         (when-not (= host (active-line)) (throw (js/Error. "its line is no longer on screen: built, but not kept")))
                         (swap! cbox/trusted into srcs)
                         (let [lid (or (agent-line b)
                                       (let [lid (new-line-id)]
                                         (save-line! lid {:name (agent-line-name id) :created (js/Date.now) :archived false})
                                         lid))
                               front (append-line-node! lid [[:load p]])]
                           (dispatch-root! (wrap-in path [:data id (merge {:line lid :request request :built front :by (my-author) :t (js/Date.now)}
                                                                          (select-keys doc [:about :inlets :outlets]))]))
                           (doseq [bx (vals (:boxes (eng/flat p)))] (ensure-class! (str (:text bx))))
                           (render-all!)
                           (agent-say! path id :built)
                           (agent-log! "ok" (str "agent " (name id) ": built (" (count (:boxes p)) " boxes) in its line «" (line-name lid) "»: double-click to open it"))
                           front))))
              (.catch (fn [e]
                        (let [msg (or (.-message e) (str e)) code (.-code e)]
                          (agent-say! path id [:error (if code (ask-error-copy code) msg)])
                          (agent-log! "err" (str "agent " (name id) ": " (if code (ask-error-copy code) msg))))
                        nil))
              (.finally (fn [] (swap! agent-busy disj key)))))))))

;; ───────────────────────── commands ─────────────────────────

(defn ask-agent
  "(ask-agent :b3) builds agent box :b3 from the request in its text; (ask-agent :b3 \"…\") writes a new
   request in its text and builds from it. Uses your own Claude (or your own API key outside claude.ai). A
   request equal to the one it was built from is not sent again."
  ([id] (ask-agent id nil))
  ([id request]
   (let [b (need-box id)]
     (when-not (agent? b) (fail (str id " is not an agent box")))
     (when (or @perf @lesson @scratch) (fail "Not now: an agent is asked outside Perform, a lesson or the scratch patch."))
     (let [r (str/trim (str (or request (agent-request (:text b)))))]
       (when (str/blank? r) (fail "An agent needs a request: agent \"…\""))
       (when (and request (not= (agent-text r) (:text b)))
         (dispatch! [:text id (agent-text r)]))
       (cond
         (and (= r (get-in b [:data :request])) (agent-line b) (not (agent-stale? b)))
         (do (agent-say! (cmd-path) id :built) :built)
         :else (do (agent-build! (active-line) (cmd-path) id r) :building))))))

(defn agent-info
  "(agent-info :b3): what agent box :b3 was built from — its request, its line, who asked, and whether its
   content was changed after."
  [id]
  (let [b (need-box id)]
    (when-not (agent? b) (fail (str id " is not an agent box")))
    (let [d (:data b)]
      (cond-> {:request (agent-request (:text b)) :built-from (:request d)
               :line (some-> (agent-line b) line-name) :by (:by d)
               :stale (agent-stale? b) :boxes (count (:boxes (agent-content b)))}
        (:about d) (assoc :about (:about d))
        (:inlets d) (assoc :inlets (:inlets d))
        (:outlets d) (assoc :outlets (:outlets d))))))

;; ? on an agent box: what this one does and what its ports take and send, before the page of the class
(reset! help-extra
        (fn [cls]
          (when (= cls "agent")
            (when-let [id (:help-box @ui)]
              (let [b (get-in (current) [:boxes id]) d (:data b)]
                (when (agent? b)
                  (let [[ins outs] (io b)
                        row (fn [label n names own]
                              (str "<h4>" label "</h4><ol start=\"0\">"
                                   (apply str (for [i (range n)]
                                                (str "<li>" (esc (if (= i (dec n)) (str "(the agent's own) " (last own)) (or (get names i) "—"))) "</li>")))
                                   "</ol>"))
                        h (hlp/of "agent")]
                    (str "<div class=\"agent-own\"><h3>" (esc (name id)) " · " (esc (ai/cut (agent-request (:text b)) 90)) "</h3>"
                         (if (:about d)
                           (str "<p>" (esc (:about d)) "</p>")
                           (str "<p><small>" (if (agent-line b) "Claude did not describe what it built." "Not built yet.") "</small></p>"))
                         (row "Its inlets" ins (:inlets d) (:inlets h))
                         (row "Its outlets" outs (:outlets d) (:outlets h))
                         (when (agent-stale? b) "<p><small>Its content was changed after Claude built it.</small></p>")
                         "<hr></div>"))))))))

;; a message to an agent's last inlet (the effect [:agent-ask request]): as a gesture of whoever sent it
(let [before (:effect-hook @eng/rt)]
  (swap! eng/rt assoc :effect-hook
         (fn [f [k x :as e] at]
           (if (= k :agent-ask)
             (js/setTimeout
              (fn []
                (let [parts (str/split (name f) #"\.")
                      id (when (= 2 (count parts)) (keyword (first parts)))]
                  (if (and id (agent? (get-in (current) [:boxes id])) (empty? (cmd-path)))
                    (try (gesture! (str "(ask-agent " id " " (pr-str x) ")"))
                         (catch :default err (agent-say! [] id [:error (or (.-message err) (str err))])))
                    (do (agent-log! "err" (str "agent: a request reached " (name f) ", which is not an agent of the patch on screen (only those are asked)"))
                        (when id (agent-say! [] id [:error "only an agent of the patch on screen is asked"]))))))
              0)
             (when before (before f e at))))))
