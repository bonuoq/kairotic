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
;;
;; Offers (discussion #351): `agent 3 "…"` answers each request with three contents, three sibling points of its
;; line made from the same point; the box reads the first (pinned to it), and (choose-offer :b3 2) or the Agents
;; section of the Claude panel chooses another. The next request goes on from the one chosen. Claude is told the
;; patch the agent is in, and reads its boxes and applies the work's classes to them while it writes (28-craft.cljs).

(in-ns 'user)

;; ───────────────────────── the box ─────────────────────────

(defn agent? [b] (and b (= "agent" (klass (:text b)))))

(def agent-max-offers 5)

(defn agent-parts
  "An agent box's text: agent \"…\", agent 3 \"…\" (three offers) or the words after agent → {:offers n :request r}."
  [text]
  (let [t (str/trim (str text)) r (str/trim (if (> (count t) 5) (subs t 5) ""))
        [_ n more] (re-matches #"(\d+)(?:\s+([\s\S]*))?" r)
        r (if n (str/trim (str more)) r)]
    {:offers (if n (max 1 (min agent-max-offers (js/parseInt n 10))) 1)
     :request (if (and (> (count r) 1) (str/starts-with? r "\"") (str/ends-with? r "\""))
                (-> (subs r 1 (dec (count r))) (str/replace "\\\"" "\"") (str/replace "\\\\" "\\"))
                r)}))

(defn agent-request "The request written in an agent box's text." [text] (:request (agent-parts text)))

(defn agent-offers "How many contents an agent offers for each request: agent 3 \"…\" → 3; 1 if it says none." [text]
  (:offers (agent-parts text)))

(defn agent-text
  ([request] (agent-text request 1))
  ([request offers] (str "agent " (when (> offers 1) (str offers " ")) (pr-str (str request)))))

(comp/define! "agent"
  {:doc "A box Claude builds inside, from the request in its text: agent \"…\". Its content is a patch you can open (double-click), read, edit and play without Claude; a new request is a new text, or a message to its last inlet. agent 3 \"…\" offers three contents for each request, three branches of its line: it plays the first, and (choose-offer :b3 2) or the Agents section of the Claude panel chooses another."
   :usage "agent [offers] \"request\""
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

(defn agent-front
  "The point of its line an agent box reads: the one it is pinned to (an offer chosen), or the newest."
  [b] (when-let [lid (agent-line b)] (ref-pos b lid)))

(defn agent-content
  "What an agent box holds now: the patch at the point of its line it reads (empty before its first build)."
  [b]
  (if-let [lid (agent-line b)]
    (line-patch-at lid (agent-front b))
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
  "Events evs as one more point of line lid (not the one on screen), after point pos (by default its newest one):
   the new point."
  ([lid evs] (append-line-node! lid evs (nodes-front (line-nodes lid))))
  ([lid evs pos]
  (if-let [[pid at] pos]
    (let [id (new-id)
          n {:id id :parent pid :at at :author (my-author) :session session-id :t (js/Date.now) :merge nil
             :events (vec evs) :meta (vec (repeat (count evs) (tx-meta))) :line lid}]
      (swap! hist assoc-in [:other lid id] n)
      (when (and (persist?) (not (str/starts-with? id "local-")))
        (let [path (str (hist-path) "/" id) body (node->js n)]
          (enqueue! path (fn [] (.set (.doc @dbref path) body)))))
      [id (count evs)])
    [(write-line-node! lid evs) (count evs)])))

;; ───────────────────────── what it says ─────────────────────────

(defonce agent-state (atom {}))   ; [path id] → :building · :built · [:error "…"], what it said last (this tab)
(defonce agent-logs (atom {}))    ; [path id] → [[class message time] …], its last builds (this tab)

(defn agent-say!
  "Tells the agent-core of box id (at path, in the patch that plays) what the agent is doing, if it plays; and
   the Agents section of the Claude panel."
  [path id v]
  (swap! agent-state assoc [(vec path) id] v)
  (let [f (keyword (str (str/join "." (map name (conj (vec path) id))) ".agent-core"))]
    (try (eng/arrive! f {:task :ask :value v} false) (catch :default e (js/console.error e)))))

(defn agent-log!
  "What happened to agent id (at path), in its log in the Claude panel (#275); without an agent, in the REPL."
  ([cls msg] (repl-print! cls (esc (str "; " msg))))
  ([path id cls msg]
   (swap! agent-logs update [(vec path) id] (fn [l] (vec (take-last 12 (conj (or l []) [cls msg (js/Date.now)])))))))

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
       "write a component only for what none of them does, small. Keep the patch readable: it will be opened and read. "
       "Before it is offered the page tries what flows in it — each tree box's tree sent to the box of a package's class it "
       "goes to (a bass to cac partimento) —, and a box that answers ✗ (a bass with no realization) sends it back to you "
       "with why: try it yourself first with apply_class.\n\n"
       "If it has controls to play it (knobs, sliders, number boxes, a keyboard), present them with (present :bN x y), laid "
       "out as a small panel: the presented boxes of an agent's content are its panel, played from outside without "
       "opening it.\n\n"
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

(declare around-agent agent-trial)

(defn agent-answer
  "Promise of {:src :doc}: one content asked of Claude (sample function s) with prompt (fn [previous] text), up to
   agent-tries times — a patch that fails the checks goes back with its errors."
  [s prompt path id]
  (letfn [(attempt [k previous]
            (-> (js/Promise.all #js [(load-ask-refs) (-> (js/Promise.resolve (when (fn? (.-limits s)) (.limits s))) (.catch (fn [_] nil)))])
                (.then (fn [a]
                         (let [refs (aget a 0) lim (aget a 1)]
                           (s (prompt previous) (clj->js (cond-> {:modelTier "default"}
                                                           (and lim (.-tools lim)) (assoc :tools (patch-tools refs))))))))
                (.then (fn [r]
                         (let [text (str (.-text r)) doc (agent-doc-of text)
                               src (ai/source-of (str/replace text agent-doc-re ""))]
                           (if (nil? src)
                             (if (< k agent-tries) (attempt (inc k) {:src "(none)" :errors ["the answer had no patch code"]})
                                 (throw (js/Error. "Claude's answer had no patch code")))
                             (-> (do (risky! (str "checking what Claude wrote for agent " (name id))) (check-patch-code src))
                                 ;; it holds together: then what flows in it is tried (a tree into a class of the work's craft)
                                 (.then (fn [chk] (if (:ok chk)
                                                    (.then (agent-trial src) (fn [errs] {:ok (empty? errs) :errors errs :tried true}))
                                                    chk)))
                                 (.then (fn [chk]
                                          (cond (:ok chk) {:src src :doc doc}
                                                (< k agent-tries) (do (agent-log! path id "err" (str "try " k (when (:tried chk) " (tried)") ": " (ai/cut (first (:errors chk)) 200) " · sent back to Claude"))
                                                                      (attempt (inc k) {:src src :errors (:errors chk)}))
                                                :else (throw (js/Error. (str "after " agent-tries " tries: " (str/join "; " (take 3 (:errors chk))))))))))))))))]
    (attempt 1 nil)))

(defn agent-offer-note
  "What Claude is told when it makes offer k of n: what the earlier ones were, so that this one is another."
  [k n docs]
  (when (> n 1)
    (str "\n━━━ Offer " k " of " n " ━━━\nThis request is answered with " n " different contents, to choose from. "
         (if (seq docs)
           (str "The earlier offers were:\n"
                (str/join "\n" (map-indexed (fn [i d] (str (inc i) ". " (or (:about d) "(not described)"))) docs))
                "\nMake this one a real alternative to them: another approach, another material, another reading of the request.")
           "This is the first: answer it as you think best; the next ones will be alternatives to it.")
         "\n")))

(defn agent-build!
  "Asks Claude for the content of agent box id (in the patch at path of line host), for request: one content, or
   as many as its text offers (agent 3 \"…\"), each a point of its line made from the point it reads. Promise of
   the point it reads then, or nil."
  [host path id request]
  (let [s @sample-fn key [host path id]]
    (cond
      (nil? s) (do (agent-log! path id "err" "Claude is not available in this view.") (agent-say! path id [:error "Claude is not available here"]) (js/Promise.resolve nil))
      (contains? @agent-busy key) (do (agent-log! path id "err" "still building the last request") (js/Promise.resolve nil))
      :else
      (let [b (get-in (agent-host-patch path) [:boxes id])
            n (agent-offers (:text b))
            base (agent-front b)
            current (let [p (agent-content b)] (when (seq (:boxes p)) (patch->code p)))
            around (try (around-agent (agent-host-patch path) id) (catch :default _ nil))
            prompt (fn [k docs]
                     (fn [previous]
                       (str (ai/patch-prompt {:request (str agent-rules "\n\n" (when around (str around "\n\n")) request)
                                              :current current :classes (ai/classes)})
                            (agent-offer-note k n docs)
                            (when previous
                              (str "\n━━━ Your last patch did not pass the checks ━━━\n" (:src previous)
                                   "\n\nIts errors: " (str/join "; " (take 6 (:errors previous))) "\nMend it, and check it again.\n")))))
            ;; the answers, one after another (each told of the earlier ones); an offer that fails is left out
            answers (fn []
                      (reduce (fn [p k]
                                (.then p (fn [got]
                                           (-> (agent-answer s (prompt k (map :doc got)) path id)
                                               (.then (fn [a] (conj got a))
                                                      (fn [e] (if (= n 1) (throw e)
                                                                  (do (agent-log! path id "err" (str "offer " k ": " (or (.-message e) e))) got))))))))
                              (js/Promise.resolve []) (range 1 (inc n))))]
        (swap! agent-busy conj key)
        (agent-say! path id :building)
        (agent-log! path id "" (str "building" (when (> n 1) (str " " n " offers")) " · " (ai/cut request 120)))
        (-> (answers)
            (.then (fn [got]
                     ;; what it builds comes from this agent box and its request (#382)
                     (with-tx {:via :agent :box id :why request} (fn []
                     (when (empty? got) (throw (js/Error. "no offer passed the checks")))
                     (let [b (get-in (agent-host-patch path) [:boxes id])]
                       (when-not (agent? b) (throw (js/Error. "the agent box is gone")))
                       (when-not (= host (active-line)) (throw (js/Error. "its line is no longer on screen: built, but not kept")))
                       (let [made (vec (for [{:keys [src doc]} got
                                             :let [p (build (link-code src))]]
                                         {:p p :doc doc
                                          :srcs (for [bx (vals (:boxes p)) :when (#{"script" "component"} (klass (:text bx)))] (str (get-in bx [:data :source])))}))
                             _ (swap! cbox/trusted into (mapcat :srcs made))
                             new? (nil? (agent-line b))
                             lid (or (agent-line b)
                                     (let [lid (new-line-id)]
                                       (save-line! lid {:name (agent-line-name id) :created (js/Date.now) :archived false})
                                       lid))
                             ;; every offer from the same point: the one it read, or (a new line, several offers) an
                             ;; empty first point they all grow from
                             from (cond (not new?) base
                                        (> (count made) 1) [(write-line-node! lid []) 0]
                                        :else nil)
                             points (mapv (fn [{:keys [p]}] (append-line-node! lid [[:load p]] from)) made)
                             docs (mapv #(select-keys (:doc %) [:about :inlets :outlets]) made)
                             chosen (first points)
                             data (merge {:line lid :request request :built chosen :by (my-author) :t (js/Date.now)}
                                         (first docs)
                                         (when (> (count points) 1) {:offers points :offer-docs docs}))]
                         (risky! (str "the content agent " (name id) " built, arriving"))
                         (dispatch-root! [:batch [(wrap-in path [:data id data])
                                                  ;; several offers: it reads the first (pinned); one: it follows its line again
                                                  (wrap-in path [:pin id (when (> (count points) 1) chosen)])]])
                         (doseq [{:keys [p]} made bx (vals (:boxes (eng/flat p)))] (ensure-class! (str (:text bx))))
                         (render-all!)
                         (agent-say! path id :built)
                         (agent-log! path id "ok" (if (> (count points) 1)
                                                    (str "built " (count points) " offers, " (count points) " branches of its line «" (line-name lid) "»: it plays the first")
                                                    (str "built: " (count (:boxes (:p (first made)))) " boxes, a new point of its line «" (line-name lid) "»")))
                         chosen))))))
            (.catch (fn [e]
                      (let [msg (or (.-message e) (str e)) code (.-code e)]
                        (agent-say! path id [:error (if code (ask-error-copy code) msg)])
                        (agent-log! path id "err" (if code (ask-error-copy code) msg)))
                      nil))
            (.finally (fn [] (swap! agent-busy disj key))))))))

(defn choose-offer
  "(choose-offer :b3 2): agent box :b3 plays its second offer for the last request (agent 3 \"…\"); the next
   request goes on from it."
  [id k]
  (let [b (need-box id) d (:data b) offers (:offers d)]
    (when-not (agent? b) (fail (str id " is not an agent box")))
    (when (empty? offers) (fail (str id " has no offers: write agent 3 \"…\" for three")))
    (when-not (and (integer? k) (<= 1 k (count offers))) (fail (str "Which offer: 1 to " (count offers))))
    (let [pos (nth offers (dec k))]
      (dispatch! [:batch [[:data id (merge d (get (:offer-docs d) (dec k)) {:built pos})] [:pin id pos]]])
      (render-all!)
      k)))

(defn agent-offer-chosen
  "Which offer agent box b plays (1…), or nil if it has none or reads another point."
  [b]
  (let [d (:data b) i (.indexOf (to-array (:offers d)) (agent-front b))] (when (>= i 0) (inc i))))

;; ───────────────────────── commands ─────────────────────────

(defn ask-agent
  "(ask-agent :b3) builds agent box :b3 from the request in its text; (ask-agent :b3 \"…\") writes a new
   request in its text and builds from it. Uses your own Claude (or your own API key outside claude.ai). A
   request equal to the one it was built from is not sent again."
  ([id] (ask-agent id nil))
  ([id request] (ask-agent id request false))
  ([id request force?]
   (let [b (need-box id)]
     (when-not (agent? b) (fail (str id " is not an agent box")))
     (when (or @perf @lesson @scratch) (fail "Not now: an agent is asked outside Perform, a lesson or the scratch patch."))
     (let [r (str/trim (str (or request (agent-request (:text b)))))]
       (when (str/blank? r) (fail "An agent needs a request: agent \"…\""))
       (when (and request (not= (agent-text r (agent-offers (:text b))) (:text b)))
         (dispatch! [:text id (agent-text r (agent-offers (:text b)))]))
       (cond
         (and (not force?) (= r (get-in b [:data :request])) (agent-line b) (not (agent-stale? b)))
         (do (agent-say! (cmd-path) id :built) :built)
         :else (do (agent-build! (active-line) (cmd-path) id r) :building))))))

(defn rebuild-agent
  "(rebuild-agent :b3): builds agent box :b3 again from the request in its text, even if it is the one it was
   built from (another answer of Claude: a new point of its line)."
  [id] (ask-agent id nil true))

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
        (:outlets d) (assoc :outlets (:outlets d))
        (seq (:offers d)) (assoc :offers (count (:offers d)) :chosen (agent-offer-chosen b)
                                 :offered (mapv :about (:offer-docs d)))))))

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

;; ───────────────────────── the Agents section of the Claude panel (#275) ─────────────────────────
;; Every agent box of the work, through its embedded patches: its request, its line, what it is doing, who asked,
;; whether its content was changed by hand, what Claude said it does, and the log of its builds; with buttons to
;; open its line, build it again and ask it for something else. An agent inside an embedded patch is asked from
;; that patch (enter it first).

(defn agents-in
  "The agent boxes of patch p, through its embedded patches: [[path id box] …]."
  ([p] (agents-in p []))
  ([p path]
   (mapcat (fn [[id b]]
             (cond (agent? b) [[path id b]]
                   (embedded? b) (agents-in (or (:data b) empty-patch) (conj path id))
                   :else []))
           (sort-by (fn [[id _]] (box-num id)) (:boxes p)))))

(defn who-name
  "How a person who asked is shown: themselves as you, others by what the room knows of them."
  [author] (if (= author (my-author)) "you" (str author)))

(defonce agent-asking (atom nil))   ; [path id] of the agent whose "Ask…" field is open

(defn agent-state-text [path id b]
  (let [st (get @agent-state [(vec path) id])]
    (cond (contains? @agent-busy [(active-line) (vec path) id]) ["busy" "building…"]
          (and (vector? st) (= :error (first st))) ["err" (str "error: " (second st))]
          (agent-line b) ["ok" "built"]
          :else ["" "not built yet"])))

(defn render-agents! []
  (when-let [el ($ "agents-list")]
    (let [as (if (:kind @work) (vec (agents-in (work-patch))) [])
          here (vec (cmd-path))]
      (set! (.-hidden ($ "agents-empty")) (boolean (seq as)))
      (set! (.-textContent ($ "agents-n")) (if (seq as) (str (count as)) ""))
      (set! (.-innerHTML el)
            (apply str
                   (for [[path id b] as
                         :let [d (:data b) [cls st] (agent-state-text path id b)
                               k (pr-str [path id]) on-screen? (= (vec path) here)
                               off (when-not on-screen? " disabled title=\"Enter the patch it is in first\"")
                               logs (get @agent-logs [(vec path) id])]]
                     (str "<li data-agent=\"" (esc k) "\">"
                          "<div class=\"ag-top\"><code>" (esc (str/join " › " (map name (conj path id)))) "</code> "
                          "<span class=\"ag-st " cls "\">" (esc st) "</span>"
                          (when (:by d) (str " <span class=\"ag-by\">· asked by " (esc (who-name (:by d))) "</span>"))
                          (when (agent-stale? b) " <span class=\"ag-stale\" title=\"Its content was changed after Claude built it\">· changed by hand</span>")
                          "</div>"
                          "<div class=\"ag-q\">" (esc (agent-request (:text b))) "</div>"
                          (when-let [a (:about d)] (str "<div class=\"ag-about\">" (esc (ai/cut a 240)) "</div>"))
                          (when-let [lid (agent-line b)] (str "<div class=\"ag-line\">its line: «" (esc (line-name lid)) "»</div>"))
                          (when (seq (:offers d))
                            (let [ch (agent-offer-chosen b)]
                              (str "<div class=\"ag-offers\">offers: "
                                   (apply str (for [k (range 1 (inc (count (:offers d))))
                                                    :let [about (:about (get (:offer-docs d) (dec k)))]]
                                                (str "<button class=\"act" (when (= k ch) " primary") "\" data-agent-act=\"offer\" data-offer=\"" k "\""
                                                     (when about (str " title=\"" (esc (ai/cut about 300)) "\""))
                                                     (when-not on-screen? " disabled") ">" k "</button>")))
                                   "</div>")))
                          "<div class=\"ag-acts\">"
                          "<button class=\"act\" data-agent-act=\"open\"" (if (agent-line b) off " disabled title=\"Not built yet\"") ">Open</button>"
                          "<button class=\"act\" data-agent-act=\"rebuild\"" off ">Build again</button>"
                          "<button class=\"act\" data-agent-act=\"ask\"" off ">Ask…</button>"
                          "</div>"
                          (when (= @agent-asking [(vec path) id])
                            (str "<div class=\"ag-ask\"><input class=\"ag-ask-in\" spellcheck=\"true\" value=\"" (esc (agent-request (:text b)))
                                 "\" aria-label=\"A new request for " (esc (name id)) "\"><button class=\"act primary\" data-agent-act=\"send\">Build</button></div>"))
                          (when (seq logs)
                            (str "<ol class=\"ask-log ag-log\">"
                                 (apply str (for [[c m _] logs] (str "<li class=\"" c "\">" (esc m) "</li>")))
                                 "</ol>"))
                          "</li>")))))))

(defonce agents-frame (atom nil))
(defn agents-soon!
  "Draws the section on the next frame, only while the Claude panel is open (and when it opens)."
  []
  (when (and (not @agents-frame) (some-> ($ "panel-claude") .-hidden not))
    (reset! agents-frame (js/requestAnimationFrame (fn [_] (reset! agents-frame nil) (render-agents!))))))
(some-> ($ "tab-claude") (.addEventListener "click" (fn [_] (js/setTimeout render-agents! 0))))
(doseq [a [hist agent-state agent-logs agent-busy agent-asking]] (add-watch a ::agents (fn [_ _ _ _] (agents-soon!))))

(let [el ($ "agents-list")]
  (when el
    (.addEventListener el "click"
      (fn [e]
        (when-let [btn (.closest (.-target e) "[data-agent-act]")]
          (let [li (.closest btn "li[data-agent]") [path id] (clojure.edn/read-string (.getAttribute li "data-agent"))]
            (case (.getAttribute btn "data-agent-act")
              "open" (gesture! (str "(open-ref " id ")"))
              "rebuild" (gesture! (str "(rebuild-agent " id ")"))
              "offer" (gesture! (str "(choose-offer " id " " (.getAttribute btn "data-offer") ")"))
              "ask" (reset! agent-asking (if (= @agent-asking [path id]) nil [path id]))
              "send" (let [v (str/trim (.-value (.querySelector li ".ag-ask-in")))]
                       (when (seq v)
                         (reset! agent-asking nil)
                         (gesture! (str "(ask-agent " id " " (pr-str v) ")"))))
              nil)))))
    (.addEventListener el "keydown"
      (fn [e]
        (when (and (= "Enter" (.-key e)) (.closest (.-target e) ".ag-ask-in"))
          (.preventDefault e)
          (some-> (.closest (.-target e) "li[data-agent]") (.querySelector "[data-agent-act=send]") (.click)))))))

(render-agents!)
