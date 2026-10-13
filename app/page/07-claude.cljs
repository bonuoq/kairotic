;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 8 of 12: claude
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── components written with Claude (Study 15) ─────────────────────────
;; The page asks Claude through claude.ai's `sample` capability: on the viewer's own Claude account,
;; with their consent. Claude gets the contract, the API, real components and the request, and can call
;; the page's tools (kairotic.assistant) to check what it writes before it answers. The answer's source
;; becomes a component box, written as gestures like any other.

(defonce sample-fn (atom nil))
(defonce ask-ctl (atom nil))
(defonce ask-refs (atom nil))

;; ───── the log of requests to Claude, kept in this browser (Study 23) ─────

(def ask-log-key "kairotic.claude-log")
(defonce asking (atom nil))   ; the request on its way: {:id :t :kind :request :change :tier :lines :status :code :answer}

(defn ask-entries []
  (or (try (some-> (.getItem js/localStorage ask-log-key) js/JSON.parse (js->clj :keywordize-keys true) vec)
           (catch :default _ nil))
      []))

(defn save-ask-entries! [es]
  (let [es (vec (take-last 200 es))]
    (try (.setItem js/localStorage ask-log-key (js/JSON.stringify (clj->js es)))
         (catch :default _
           ;; full: the older half goes
           (try (.setItem js/localStorage ask-log-key (js/JSON.stringify (clj->js (vec (take-last (quot (count es) 2) es)))))
                (catch :default _ nil))))))

(declare render-ask-history!)

(defn begin-ask! [kind request change?]
  (reset! asking {:id (str (js/Date.now)) :t (.toISOString (js/Date.)) :kind (name kind) :request request
                  :change (boolean change?) :tier (some-> ($ "ask-tier") .-value) :work (:name @work)
                  :lines [] :status "asked"}))

(defn note-answer! [r src]
  (when @asking (swap! asking assoc :answer (ai/cut (.-text r) 8000) :code src :model (.-modelTierApplied r))))

(defn end-ask! []
  (when-let [a @asking]
    (reset! asking nil)
    (save-ask-entries! (conj (ask-entries) a))
    (render-ask-history!)))

(defn ask-log! [cls text]
  (when @asking
    (swap! asking (fn [a] (cond-> (update a :lines conj (str (when (seq cls) (str cls ": ")) text))
                            (= cls "done") (assoc :status "made")
                            (and (= cls "err") (not= "made" (:status a))) (assoc :status "failed" :error text)))))
  ;; the bar of a link (?ask=) shows the last line too
  (when-let [st ($ "ab-status")] (set! (.-textContent st) text))
  (when-let [ol ($ "ask-log")]
    (let [li (js/document.createElement "li")]
      (set! (.-className li) (or cls ""))
      (set! (.-textContent li) text)
      (.appendChild ol li))))

(defn fetch-text [path] (-> (js/fetch path) (.then (fn [r] (if (.-ok r) (.text r) (throw (js/Error. (str path " " (.-status r)))))))))

(defn load-ask-refs
  "Promise of what Claude reads besides the request: the contract and shapes documentation, the API
   and the catalog of examples (two of them given whole, the rest read with a tool). Loaded once."
  []
  (or @ask-refs
      (let [p (-> (js/Promise.all #js [(fetch-text "kairotic/components.cljs") (fetch-text "kairotic/shapes.cljs")
                                       (fetch-text "kairotic/api.cljs")
                                       ((.-kairoticImport js/window) "kairotic/examples.mjs")])
                  (.then (fn [a]
                           (let [examples (:examples (js->clj (aget a 3) :keywordize-keys true))
                                 by-name (fn [n] (first (filter #(= n (:name %)) examples)))]
                             {:contract (str (ai/header-of (aget a 0)) "\n\nViews — " (ai/header-of (aget a 1)))
                              :api (aget a 2)
                              :examples (vec examples)
                              :always (vec (keep by-name ["knob" "filter-panel"]))})))
                  (.catch (fn [e] (reset! ask-refs nil) (throw e))))]
        (reset! ask-refs p)
        p)))

(defn ask-tools
  "The page functions Claude may call while it writes (small plain-data results)."
  [refs]
  (let [src-schema {:type "string" :description "the complete source (a component, an abstraction or a package)"}
        cls-schema {:type "string" :description "which class, when the source is a package (else omit)"}
        logged (fn [label f]
                 (fn [input _]
                   (-> (js/Promise.resolve nil)
                       (.then (fn [_] (f input)))
                       (.catch (fn [e] {:ok false :error (or (.-message e) (str e))}))
                       (.then (fn [r]
                                (ask-log! (if (:ok r) "ok" "err")
                                          (str label (when-let [c (or (:class r) (:box-text r) (:name r)
                                                                      (some->> (:definitions r) (map :class) seq (str/join ", ")))]
                                                       (str " · " c))
                                               (when-let [e (or (:error r) (first (:errors r)))] (str " · " (ai/cut e 160)))))
                                (clj->js r))))))]
    #js [#js {:name "read_example"
              :description "The whole source of an example of the catalog, by name. Read the ones close to the request before writing."
              :inputSchema (clj->js {:type "object" :properties {:name {:type "string"}} :required ["name"]})
              :execute (logged "read example"
                               (fn [i] (if-let [e (first (filter #(= (str (.-name i)) (:name %)) (:examples refs)))]
                                         {:ok true :name (:name e) :kind (:kind e) :source (:source e)}
                                         {:ok false :error (str "no example " (.-name i))})))}
         #js {:name "check_faust"
              :description "Compiles Faust code with the page's compiler. Returns {ok, ins, outs, params} or {ok:false, error} with the compiler's message. Use it for every Faust source before putting it in a faust~ box."
              :inputSchema (clj->js {:type "object" :properties {:code {:type "string" :description "the Faust source"}} :required ["code"]})
              :execute (logged "check Faust" (fn [i] (ai/compile-faust (str (.-code i)))))}
         #js {:name "check_component"
              :description "Evaluates the whole source and validates it: every definition, the patch of abstractions (classes that exist, valid ports in every line) and the Faust inside them, compiled. Returns {ok, definitions, errors}. Call it before answering, and again after every fix."
              :inputSchema (clj->js {:type "object" :properties {:source src-schema} :required ["source"]})
              :execute (logged "check" (fn [i] (ai/check-full (str (.-source i)))))}
         #js {:name "try_messages"
              :description "Sends messages to a component's :receive one after another (its state carried over, as in the engine) and returns what each returned (out, show, effects, later, state) or the error. Not for abstractions (they are patches). args_text is what follows the class in the box text, e.g. \"0 1 log\"."
              :inputSchema (clj->js {:type "object"
                                     :properties {:source src-schema :class cls-schema
                                                  :args_text {:type "string" :description "words after the class in the box text (may be empty)"}
                                                  :messages {:type "string" :description "EDN vector of [inlet value], e.g. [[0 440] [0 :bang] [1 [1 2]]]"}}
                                     :required ["source" "messages"]})
              :execute (logged "try messages" (fn [i] (ai/try-receive (str (.-source i)) (str (or (.-class i) "")) (str (or (.-args_text i) "")) (str (.-messages i)))))}
         #js {:name "try_view"
              :description "Draws a component's own view (:view with :derive, or :draw) for a shown value and box text, and reports shapes without a valid kind, holes without a value and non-finite numbers; with a :gesture it also tries one drag and what :persist would write."
              :inputSchema (clj->js {:type "object"
                                     :properties {:source src-schema :class cls-schema
                                                  :args_text {:type "string"}
                                                  :shown {:type "string" :description "EDN of the last shown value, e.g. 0.5 or [0.2 0.8], or empty"}}
                                     :required ["source"]})
              :execute (logged "try view" (fn [i] (ai/try-view (str (.-source i)) (str (or (.-class i) "")) (str (or (.-args_text i) "")) (str (or (.-shown i) "")))))}
         #js {:name "list_classes"
              :description "The box classes the work knows now (core, packages, the work's own), one line each: name, [inlets outlets], first sentence of its doc."
              :execute (logged "list classes" (fn [_] {:ok true :classes (ai/classes)}))}]))

(defn selected-component []
  (let [[kind id] (:sel @ui) b (when (= kind :box) (get-in (current) [:boxes id]))]
    (when (and b (= "component" (klass (:text b)))) [id (str (get-in b [:data :source]))])))

(defn ask-busy! [busy?]
  (set! (.-disabled ($ "ask-go")) busy?)
  (set! (.-disabled ($ "ask-stop")) (not busy?)))

(defn ask-error-copy [code]
  (case code
    "not_granted" (if (some-> @sample-fn .-byok) "There is no API key, or it was refused: paste yours above." "Claude is not allowed for this page (you can allow it next time you open it).")
    "sampling_disabled" "Claude is not available for this account."
    "rate_limited" "Too many requests, or your Claude usage limit: try again later."
    "session_expired" "Sign in to Claude again."
    "refused" "Claude declined this request: try asking it differently."
    "prompt_too_large" "The request is too large."
    "no_credit" "Your Anthropic account has no credit left (console.anthropic.com → Billing)."
    "overloaded" "Claude is overloaded right now: try again in a moment."
    "no_model" "The API does not know the model asked for."
    "tools_unavailable" "This view cannot let Claude try the component."
    (str "Claude could not answer (" code ").")))

(defn ask-component!
  "Asks Claude for a component (or a change to the selected component box) described by `request`."
  ([] (ask-component! (.-value ($ "ask-text"))))
  ([request]
   (let [s @sample-fn request (str/trim (str request))
         change (when (.-checked ($ "ask-change")) (selected-component))
         out ($ "ask-out")]
     (cond
       (nil? s) (repl-print! "err" "Claude is not available in this view (it needs claude.ai).")
       (empty? request) (ask-log! "err" "Describe the component first.")
       :else
       (let [ctl (js/AbortController.)]
         (reset! ask-ctl ctl)
         (set! (.-innerHTML ($ "ask-log")) "")
         (set! (.-textContent out) "")
         (ask-busy! true)
         (begin-ask! :component request change)
         (ask-log! "" (if change (str "changing " (name (first change)) " · thinking…") "thinking…"))
         ;; everything inside the promise chain: whatever fails, the panel is released in .finally
         (-> (js/Promise.resolve nil)
             (.then (fn [_] (js/Promise.all #js [(load-ask-refs)
                                                 (-> (js/Promise.resolve (when (fn? (.-limits s)) (.limits s)))
                                                     (.catch (fn [_] nil)))])))
             (.then (fn [a]
                      (let [refs (aget a 0) lim (aget a 1)
                            input (ai/prompt (assoc refs :request request :change (second change)))
                            opts (cond-> {:modelTier (.-value ($ "ask-tier")) :signal (.-signal ctl)
                                          :onText (fn [u] (set! (.-textContent out) (.-text u)))}
                                   (and lim (.-tools lim)) (assoc :tools (ask-tools refs)))]
                        (s input (clj->js opts)))))
             (.then (fn [r]
                      (let [src (ai/source-of (.-text r)) _ (note-answer! r src)]
                        (if (nil? src)
                          (ask-log! "err" "The answer has no source block: try again or ask differently.")
                          (-> (ai/check-full src)
                              (.then (fn [chk]
                                       (if-not (:ok chk)
                                         (ask-log! "err" (str "The source does not work: " (or (:error chk) (str/join "; " (:errors chk))) " (it is in the answer above)."))
                                         (let [names (mapv :class (:definitions chk))
                                               what (or (:package chk) (first names))
                                               hdr (str ";; " what " · written with Claude\n"
                                                        ";; asked: " (str/replace (ai/cut request 300) #"\s+" " ") "\n")
                                               id (if change
                                                    (let [id (first change)] (gesture! (str "(code " id " " (pr-str (str hdr src)) ")")) id)
                                                    (new-definition! (str hdr src)))]
                                           ;; the official classes its abstractions use come into the work too
                                           (doseq [k (ai/used-classes src)] (ensure-class! (str k)))
                                           (ask-log! "done" (str (str/join ", " (map #(str "«" % "»") names)) " in the work (" (name id) "): write "
                                                                 (str "«" (last names) "»") " in a box to use it."))
                                           (when (.-truncated r) (ask-log! "err" "The answer was cut short.")))))))))))
             (.catch (fn [e]
                       (let [code (or (.-code e) "error")]
                         (when-not (= code "cancelled")
                           (ask-log! "err" (if (= code "error") (str "Error: " (or (.-message e) e)) (str (ask-error-copy code) (when-let [m (.-message e)] (str " — " (ai/cut m 400))))))))))
             (.finally (fn [] (ask-busy! false) (reset! ask-ctl nil) (end-ask!)))))))
   :asking))

(defn ask-what [] (if (.-checked (.querySelector js/document "input[name=ask-what][value=component]")) :component :patch))

(defn render-ask-mode! []
  (let [patch? (= :patch (ask-what)) byok (some-> @sample-fn .-byok)]
    (set! (.-textContent ($ "ask-change-t")) (if patch? "change the open patch" "change the selected component"))
    (set! (.-title ($ "ask-change-l")) (if patch? "Claude gets the open patch and changes it; unchecked, it makes a new one" "Select a component box in the patch first"))
    (set! (.-checked ($ "ask-change")) patch?)
    (set! (.-textContent ($ "ask-go")) (if patch? "Make it" "Write it"))
    (set! (.-placeholder ($ "ask-text"))
          (if patch?
            "A hello world: a sine at 440 Hz with a volume knob… · add a knob that does FM synthesis… · a canon in two voices played by synth~…"
            "A stereo chorus in Faust with rate and depth knobs on its panel… · a resonant filter whose cutoff follows an envelope… · a Markov chain of pitch classes…"))
    (set! (.-innerHTML ($ "ask-note"))
          (str (if patch?
                 "Describe a patch and Claude makes it — or changes the open one — checks it (classes, ports, Faust) and loads it as one event of the history."
                 "Describe a component and Claude writes it, tries it and puts it in the work as a component box, like one you wrote.")
               (if byok
                 " Here, outside claude.ai, it uses <b>your own Anthropic API key</b> (console.anthropic.com): it stays in this browser and is only sent to api.anthropic.com, so you pay your own use."
                 " It uses <b>your own</b> Claude account: the first time, Claude asks you to allow this page.")))))

(.addEventListener (.querySelector js/document ".ask-what") "change" (fn [_] (render-ask-mode!)))

;; ───── patches made by Claude (Study 23) ─────

(declare link-code)

(defn ensure-classes!
  "After a whole patch is loaded: the official classes its boxes use come into the work (a definition
   that was there before the load may have gone with it)."
  []
  (doseq [b (vals (:boxes (eng/flat (root-patch))))] (ensure-class! (str (:text b)))))

(defn check-patch-code
  "Promise of {:ok :errors :boxes}: whether patch code (as a link carries it) makes a patch that works —
   only patch calls, classes that exist, lines between ports that exist, Faust that compiles and
   components that evaluate. Nothing goes into the work."
  [src]
  (-> (js/Promise.resolve nil)
      (.then (fn [_]
               (let [p (build (link-code src))
                     bs (:boxes p)
                     k-of (fn [b] (klass (:text b)))
                     known? (fn [k] (or (comp/lookup k) (lib/package-of k) (lib/single-of k)))
                     unknown (vec (for [[id b] bs :let [k (k-of b)] :when (not (known? k))] (str (name id) ": no class «" k "»")))
                     fausts (vec (for [[id b] bs :when (= "faust~" (k-of b))] [id (str (get-in b [:data :source]))]))
                     comps (vec (for [[id b] bs :when (#{"component"} (k-of b))] [id (str (get-in b [:data :source]))]))]
                 (-> (js/Promise.all (into-array (concat (for [[_ src] fausts] (ai/compile-faust src))
                                                         (for [[_ src] comps] (ai/check-full src)))))
                     (.then (fn [rs]
                              (let [rs (vec (array-seq rs))
                                    code-errs (vec (keep (fn [[[id _] r]] (when-not (:ok r) (str (name id) ": " (or (:error r) (first (:errors r))))))
                                                         (map vector (concat fausts comps) rs)))
                                    ;; ports, now that the Faust boxes know theirs (package classes not loaded yet are left out)
                                    io-of (fn [id] (let [b (get bs id)] (when (and b (comp/lookup (k-of b))) (io b))))
                                    line-errs (vec (for [[a o b i :as l] (:lines p)
                                                         :let [[_ outs] (io-of a) [ins _] (io-of b)]
                                                         e [(when-not (get bs a) (str (pr-str l) ": no box " a))
                                                            (when-not (get bs b) (str (pr-str l) ": no box " b))
                                                            (when (and outs (>= o outs)) (str (pr-str l) ": " (name a) " has " outs " outlet(s)"))
                                                            (when (and ins (>= i ins)) (str (pr-str l) ": " (name b) " has " ins " inlet(s)"))]
                                                         :when e] e))
                                    errs (vec (concat unknown code-errs line-errs))]
                                {:ok (empty? errs) :errors errs
                                 :boxes (vec (for [[id b] bs] (str (name id) " " (:text b) (when-let [x (io-of id)] (str " " (pr-str x))))))})))))))
      (.catch (fn [e] {:ok false :errors [(str (or (.-message e) e))]}))))

(defn patch-tools
  "The page functions Claude may call while it makes a patch."
  [refs]
  (let [comp-tools (ask-tools refs)
        pick (fn [n] (first (filter #(= n (.-name %)) (array-seq comp-tools))))
        logged (fn [label f]
                 (fn [input _]
                   (-> (js/Promise.resolve nil)
                       (.then (fn [_] (f input)))
                       (.catch (fn [e] {:ok false :errors [(or (.-message e) (str e))]}))
                       (.then (fn [r]
                                (ask-log! (if (:ok r) "ok" "err") (str label (when-let [e (first (:errors r))] (str " · " (ai/cut e 160)))))
                                (clj->js r))))))]
    #js [(pick "list_classes") (pick "check_faust") (pick "read_example") (pick "check_component")
         #js {:name "class_help"
              :description "What one class does: its doc, usage, inlets and outlets (what each takes and sends), and an example."
              :inputSchema (clj->js {:type "object" :properties {:class {:type "string"}} :required ["class"]})
              :execute (logged "help"
                               (fn [i] (let [k (str (.-class i)) d (comp/lookup k) h (hlp/of k)]
                                         (if (or d (seq h) (lib/package-of k) (lib/single-of k))
                                           {:ok true :class k :doc (or (:doc d) (:doc h)) :usage (:usage d)
                                            :io (let [x (:io d)] (if (vector? x) x "depends on its arguments"))
                                            :inlets (:inlets h) :outlets (:outlets h) :example (:example h)
                                            :note (when-not d "an official class: it comes into the work when a box uses it")}
                                           {:ok false :errors [(str "no class " k)]}))))}
         #js {:name "check_patch"
              :description "Checks the WHOLE patch code: only patch calls with literal arguments, classes that exist, every line between ports that exist, every Faust source compiled and every component evaluated. Returns {ok, errors, boxes}. Call it before answering, and again after every fix."
              :inputSchema (clj->js {:type "object" :properties {:code {:type "string" :description "the whole patch code"}} :required ["code"]})
              :execute (logged "check patch" (fn [i] (check-patch-code (str (.-code i)))))}]))

(defn apply-patch-code!
  "Loads patch code made by Claude into the open work (one event). Its scripts and components run: you
   asked for them."
  [src]
  (let [code (link-code src) p (build code)
        srcs (for [b (vals (:boxes p)) :when (#{"script" "component"} (klass (:text b)))] (str (get-in b [:data :source])))]
    (swap! cbox/trusted into srcs)
    (cbox/forget-language! "component")
    (cbox/forget-language! "clojurescript")
    (dispatch! [:load p])
    (ensure-classes!)
    (render-all!)
    code))

(defn ask-patch!
  "Asks Claude for a patch described by `request` (or a change to the open one, when change? is true).
   Promise of the code loaded, or nil."
  [request change?]
  (let [s @sample-fn request (str/trim (str request)) out ($ "ask-out")]
    (cond
      (nil? s) (do (ask-log! "err" "Claude is not available here.") (js/Promise.resolve nil))
      (empty? request) (do (ask-log! "err" "Describe the patch first.") (js/Promise.resolve nil))
      (nil? (:kind @work)) (do (ask-log! "err" "Open or create a work first.") (js/Promise.resolve nil))
      :else
      (let [ctl (js/AbortController.)
            current (when change? (let [p (work-patch)] (when (seq (:boxes p)) (patch->code p))))]
        (reset! ask-ctl ctl)
        (set! (.-innerHTML ($ "ask-log")) "")
        (set! (.-textContent out) "")
        (ask-busy! true)
        (begin-ask! :patch request current)
        (ask-log! "" (if current "changing the patch · thinking…" "making the patch · thinking…"))
        (-> (js/Promise.resolve nil)
            (.then (fn [_] (js/Promise.all #js [(load-ask-refs)
                                                (-> (js/Promise.resolve (when (fn? (.-limits s)) (.limits s))) (.catch (fn [_] nil)))])))
            (.then (fn [a]
                     (let [refs (aget a 0) lim (aget a 1)
                           input (ai/patch-prompt {:request request :current current :classes (ai/classes)})
                           opts (cond-> {:modelTier (.-value ($ "ask-tier")) :signal (.-signal ctl)
                                         :onText (fn [u] (set! (.-textContent out) (.-text u)))}
                                  (and lim (.-tools lim)) (assoc :tools (patch-tools refs)))]
                       (s input (clj->js opts)))))
            (.then (fn [r]
                     (let [src (ai/source-of (.-text r)) _ (note-answer! r src)]
                       (if (nil? src)
                         (do (ask-log! "err" "The answer has no patch code: try again or ask differently.") nil)
                         (.then (check-patch-code src)
                                (fn [chk]
                                  (if-not (:ok chk)
                                    (do (ask-log! "err" (str "The patch does not work yet: " (str/join "; " (take 3 (:errors chk))) " (it is in the answer, in the Claude tab).")) nil)
                                    (let [code (apply-patch-code! src)]
                                      (ask-log! "done" (str "Patch loaded (" (count (:boxes (work-patch))) " boxes): ▶ to hear it."
                                                            (when (.-truncated r) " The answer was cut short.")))
                                      code))))))))
            (.catch (fn [e]
                      (let [code (or (.-code e) "error")]
                        (when-not (= code "cancelled")
                          (ask-log! "err" (if (= code "error") (str "Error: " (or (.-message e) e)) (str (ask-error-copy code) (when-let [m (.-message e)] (str " — " (ai/cut m 400))))))))
                      nil))
            (.finally (fn [] (ask-busy! false) (reset! ask-ctl nil) (end-ask!))))))))

(defn ask!
  "The Claude tab's button: a patch or a component, as chosen."
  ([] (ask! (.-value ($ "ask-text"))))
  ([request]
   (if (= :patch (ask-what))
     (do (ask-patch! request (.-checked ($ "ask-change"))) :asking)
     (ask-component! request))))

(defn ask-patch
  "Asks Claude to make a patch, or change the open one: (ask-patch \"add a knob that does FM\"). Uses your
   own Claude account (or your own API key outside claude.ai)."
  ([request] (ask-patch request true))
  ([request change?]
   (set! (.-value ($ "ask-text")) (str request))
   (.click ($ "tab-claude"))
   (ask-patch! request change?)
   :asking))

(defn ask-component
  "Asks Claude to write a component: (ask-component \"a slow LFO with its waveform drawn\"). The result
   is a component box in the work. Uses your own Claude account."
  [request]
  (set! (.-value ($ "ask-text")) (str request))
  (.click ($ "tab-claude"))
  (ask-component! request))

(.addEventListener ($ "ask-go") "click" (fn [_] (ask!)))
(.addEventListener ($ "ask-stop") "click" (fn [_] (when-let [c @ask-ctl] (.abort c))))
(.addEventListener ($ "ask-text") "keydown"
  (fn [e] (when (and (= "Enter" (.-key e)) (or (.-ctrlKey e) (.-metaKey e))) (.preventDefault e) (ask!))))

;; outside claude.ai Claude runs with your own Anthropic API key, kept only in this browser
(defn render-key! []
  (when-let [s @sample-fn]
    (when (.-byok s)
      (set! (.-hidden ($ "ask-key")) false)
      (set! (.-textContent ($ "ask-key-state")) (if (.hasKey s) "a key is saved in this browser" "no key yet")))))

(.addEventListener ($ "ask-key-save") "click"
  (fn [_] (when-let [s @sample-fn]
            (let [v (str/trim (.-value ($ "ask-key-in")))]
              (when (seq v) (.setKey s v) (set! (.-value ($ "ask-key-in")) "") (render-key!))))))
(.addEventListener ($ "ask-key-forget") "click"
  (fn [_] (when-let [s @sample-fn] (.setKey s nil) (render-key!))))

(-> (cuse "sample")
    (.then (fn [s]
             (reset! sample-fn s)
             (set! (.-hidden ($ "tab-claude")) (nil? s))
             (render-key!)
             (render-ask-mode!)
             (render-askbar!))))
