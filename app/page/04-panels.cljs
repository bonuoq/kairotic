;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 5 of 12: panels
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── component library ─────────────────────────
;; Whatever is imported or taken from the library is copied into a component box of the work.

(defonce shared-lib (atom {}))   ; class → {:class :source :doc :version :author :t}

(defn doc-id [cls-name] (str/replace (str cls-name) #"[^A-Za-z0-9_\-]" "_"))

(defn component-slot
  "Where a new component box goes: in a column to the right of everything else in the patch."
  []
  (let [bs (:boxes (current))
        defs (filter (fn [[_ b]] (= "component" (klass (:text b)))) bs)
        others (remove (fn [[_ b]] (= "component" (klass (:text b)))) bs)
        right (reduce max 300 (for [[id b] others] (+ (:x b) (first (box-dims id b)))))
        x (if (seq defs) (apply min (map (comp :x second) defs)) (+ right 40))
        bottom (reduce max 0 (for [[id b] defs] (+ (:y b) (second (box-dims id b)))))]
    [x (if (seq defs) (+ bottom 16) 20)]))

(defn new-definition!
  "Creates, as gestures written in code, a component box with this source."
  [source]
  (let [id (next-id) [x y] (component-slot)]
    (gesture! (str "(box " id " \"component\" " x " " y ")"))
    (gesture! (str "(code " id " " (pr-str source) ")"))
    id))

(defn import!
  "Copies a published component into the work: \"npm:package@version/path.mjs\" (jsDelivr) or a file
   of this page (\"kairotic/library/drift.mjs\"). It stays as an editable component box."
  [origin]
  (-> (lib/import-module origin)
      (.then (fn [m]
               (if (:package m)
                 (let [id (new-definition! (lib/package-source m origin))]
                   (repl-print! "out" (esc (str "; imported " (:package m) " " (:version m) " ("
                                                (str/join ", " (map :class (:components m))) ") into " id))))
                 (let [id (new-definition! (str (lib/header m origin) (:source m)))]
                   (repl-print! "out" (esc (str "; imported «" (:class m) "» into " id)))))))
      (.catch (fn [e] (repl-print! "err" (esc (str "Could not import " origin ": " (or (.-message e) e)))))))
  :importing)

;; ───── official packages: brought into the work when one of their classes is written ─────

(defonce fetching (atom #{}))

(defn work-package?
  "Whether the work (at its top level or the sub-patch on screen) already carries package `pkg`."
  [pkg]
  (let [needle (str ":package " (pr-str pkg))]
    (some (fn [p] (some (fn [[_ b]] (and (= "component" (klass (:text b)))
                                          (str/includes? (str (get-in b [:data :source])) needle)))
                        (:boxes p)))
          [(current) (root-patch)])))

(defn add-package!
  "Brings an official package into the work, as one component box pinned to its version:
   (add-package! \"@kairotic/synth\"). It is looked for on npm and, if it is not there yet, in this page."
  [pkg]
  (when-not (get lib/packages pkg) (fail (str "Unknown package " pkg ": see (packages)")))
  (when-not (or (@fetching pkg) (work-package? pkg))
    (swap! fetching conj pkg)
    (-> (lib/import-package pkg)
        (.then (fn [[m origin]]
                 (when-not (work-package? pkg)
                   (let [src (lib/package-source m origin)
                         _ (swap! cbox/trusted conj src)   ; official: it runs without asking
                         id (new-definition! src)]
                     (repl-print! "out" (esc (str "; " pkg " " (:version m) " ("
                                                  (str/join ", " (map :class (:components m))) ") is now in the work: " id
                                                  (when-not (str/starts-with? origin "npm:") " · from this page"))))))))
        (.catch (fn [e] (repl-print! "err" (esc (str "Could not bring " pkg ": " (or (.-message e) e))))))
        (.finally (fn [] (swap! fetching disj pkg)))))
  pkg)

(defn packages
  "The official packages and their classes: [[package version [class …]] …]."
  []
  (vec (for [[n p] (sort-by key lib/packages)] [n (:version p) (vec (sort (:classes p)))])))

(defn work-class?
  "Whether a component box of the work already defines class k."
  [k]
  (let [needle (str ":class " (pr-str k))]
    (some (fn [p] (some (fn [[_ b]] (and (= "component" (klass (:text b)))
                                          (str/includes? (str (get-in b [:data :source])) needle)))
                        (:boxes p)))
          [(current) (root-patch)])))

(defn add-single!
  "Brings an official single component (knob, fifth, drift) into the work as a component box."
  [k]
  (when-not (or (@fetching k) (work-class? k))
    (swap! fetching conj k)
    (-> (lib/import-single k)
        (.then (fn [[m origin]]
                 (when-not (work-class? k)
                   (let [src (str (lib/header m origin) (:source m))
                         _ (swap! cbox/trusted conj src)   ; official: it runs without asking
                         id (new-definition! src)]
                     (repl-print! "out" (esc (str "; «" k "» is now in the work: " id)))))))
        (.catch (fn [e] (repl-print! "err" (esc (str "Could not bring " k ": " (or (.-message e) e))))))
        (.finally (fn [] (swap! fetching disj k)))))
  k)

(defn ensure-class!
  "If box text t uses a class nobody defines yet but an official package or single component does,
   brings it into the work."
  [t]
  (let [k (klass t)]
    (when-not (comp/lookup k)
      (cond
        (lib/package-of k) (add-package! (first (lib/package-of k)))
        (lib/single-of k) (add-single! k)))))

(defn publish
  "Saves the definition of a component box to the shared library of this space (a new version)."
  [id]
  (let [b (need-box id)]
    (when-not (= "component" (klass (:text b))) (fail (str id " is not a component box")))
    (let [source (str (get-in b [:data :source])) r (cbox/compiled "component" source)]
      (when-not (= :ok (:status r)) (fail "The definition does not compile yet: fix it before publishing it"))
      (when-not (and @dbref (:writable @hist)) (fail "No shared library available (you need to be signed in and able to write)"))
      (let [cls-name (get-in r [:info :class]) prev-entry (get @shared-lib cls-name)
            v (inc (or (:version prev-entry) 0))]
        (-> (.set (.doc @dbref (str "library/" (doc-id cls-name)))
                  (clj->js {:class cls-name :source source :doc (str (:doc (:value r))) :version v
                            :author (my-author) :t (js/Date.now)}))
            (.then (fn [_] (repl-print! "out" (esc (str "; «" cls-name "» version " v " published to the library")))))
            (.catch db-failed!))
        [cls-name v]))))

(defn library
  "The components of the shared library: [[class version doc] …]."
  []
  (vec (for [[c m] (sort-by key @shared-lib)] [c (:version m) (:doc m)])))

(defn use!
  "Copies a component of the shared library into the work."
  [cls-name]
  (let [m (or (get @shared-lib (str cls-name)) (fail (str "The library has no «" cls-name "»: see (library)")))]
    (new-definition! (str ";; " (:class m) " v" (:version m) " · from the library of this space\n" (:source m)))))

(defn listen-library! [db]
  (.onSnapshot (.collection db "library")
               (fn [snap]
                 (reset! shared-lib (into {} (for [d (array-seq (.-docs snap)) :when (.-exists d)
                                               :let [m (js->clj (.data d) :keywordize-keys true)]
                                               :when (and (string? (:class m)) (string? (:source m)))]
                                           [(:class m) m]))))
               (fn [_] nil)))

(defn render-comp! []
  (when-let [el ($ "comp-list")]
    (let [work-defs @lib/work-classes
          core-defs (filter (fn [[_ d]] (= :core (:origin d))) (sort-by key @comp/registry))
          row (fn [label detail button]
                 (str "<li><code>" (esc label) "</code><span>" (esc detail) "</span>" button "</li>"))]
      (set! (.-innerHTML el)
            (str "<h4>In this work</h4>"
                 (if (seq work-defs)
                   (str "<ul>" (apply str (for [[c [id m]] (sort-by key work-defs)]
                                            (row c (str "box " (name id) (when (:doc m) (str " · " (:doc m))))
                                                  (str "<button class=\"act\" data-publish=\"" (esc (name id)) "\">Publish</button>"))))
                        "</ul>")
                   "<p class=\"empty\">None yet: create a <code>component</code> box or import one.</p>")
                 "<h4>Shared library</h4>"
                 (if (seq @shared-lib)
                   (str "<ul>" (apply str (for [[c m] (sort-by key @shared-lib)]
                                            (row c (str "v" (:version m) (when (seq (:doc m)) (str " · " (:doc m))))
                                                  (str "<button class=\"act\" data-use=\"" (esc c) "\">Use</button>"))))
                        "</ul>")
                   "<p class=\"empty\">Empty: publish a definition of the work here to use it in others.</p>")
                 "<h4>Import</h4>"
                 "<form id=\"comp-import\"><input id=\"comp-origin\" placeholder=\"npm:package@1.0.0/comp.mjs or kairotic/library/drift.mjs\" value=\"kairotic/library/drift.mjs\">"
                 "<button class=\"act\">Import</button></form>"
                 "<h4>Core</h4><p class=\"core-defs\">"
                 (str/join " " (for [[c d] core-defs] (str "<code class=\"help-link\" data-help=\"" (esc c) "\" title=\"" (esc (:doc d)) "\">" (esc c) "</code>")))
                 "</p>")))))

(add-watch shared-lib ::comp (fn [_ _ _ _] (render-comp!)))

(.addEventListener ($ "panel-comp") "click"
  (fn [e]
    (when-let [b (.closest (.-target e) "[data-help]")]
      (show-help! (.getAttribute b "data-help")))
    (when-let [b (.closest (.-target e) "[data-use]")]
      (gesture! (str "(use! " (pr-str (.getAttribute b "data-use")) ")")))
    (when-let [b (.closest (.-target e) "[data-publish]")]
      (gesture! (str "(publish :" (.getAttribute b "data-publish") ")")))))

(.addEventListener ($ "panel-comp") "submit"
  (fn [e]
    (.preventDefault e)
    (let [v (str/trim (.-value ($ "comp-origin")))]
      (when (seq v) (gesture! (str "(import! " (pr-str v) ")"))))))

;; ───────────────────────── code panel ─────────────────────────

(defn run-panel-code! []
  (let [code (.-value ($ "code"))]
    (try
      (run-code! code)
      (swap! ui assoc :dirty false)
      (render-code (current))
      (repl-print! "out" "; code run: the patch has been rebuilt (1 :load event)")
      (catch :default e
        (repl-print! "err" (esc (str "Error in the code: " (or (.-message e) (str e)))))))))

(.addEventListener ($ "code") "input" (fn [_] (when-not (:dirty @ui) (swap! ui assoc :dirty true) (render-code (current)))))
(.addEventListener ($ "code") "keydown"
  (fn [e] (when (and (= (.-key e) "Enter") (or (.-ctrlKey e) (.-metaKey e)))
            (.preventDefault e) (run-panel-code!))))
(.addEventListener ($ "code-run") "click" (fn [_] (run-panel-code!)))
(.addEventListener ($ "code-revert") "click" (fn [_] (swap! ui assoc :dirty false) (render-code (current))))

(doseq [t (array-seq (.querySelectorAll js/document ".tab"))]
  (.addEventListener t "click"
    (fn [_]
      (let [tab (.. t -dataset -tab)]
        (doseq [x (array-seq (.querySelectorAll js/document ".tab"))]
          (.setAttribute x "aria-selected" (str (= x t))))
        (doseq [[k pid] [["code" "panel-code"] ["edn" "panel-edn"] ["comp" "panel-comp"] ["claude" "panel-claude"] ["help" "panel-help"] ["feedback" "panel-feedback"]]]
          (set! (.-hidden ($ pid)) (not= k tab)))
        ;; opened by itself, the Help tab shows its index (or the page it was on)
        (when (= tab "help") (refresh-help!))))))

;; ───────────────────────── gestures in the history ─────────────────────────

(.addEventListener ($ "nav-back") "click" (fn [_] (gesture! "(rewind)")))
(.addEventListener ($ "nav-fwd") "click" (fn [_] (gesture! "(forward)")))
(.addEventListener ($ "nav-tip") "click" (fn [_] (gesture! "(tip)")))
(.addEventListener ($ "start-example") "click" (fn [_] (gesture! "(load-example)")))

(.addEventListener ($ "tree") "click"
  (fn [e]
    (when-let [el (.closest (.-target e) "[data-goto]")]
      (let [[nid k] (str/split (.getAttribute el "data-goto") #"\|")]
        (if (:merge-pick @ui)
          (do (swap! ui assoc :merge-pick false)
              (.remove (.-classList ($ "hist-wrap")) "picking")
              (gesture! (str "(merge-from " (pr-str nid) " " k ")")))
          (gesture! (str "(goto " (pr-str nid) " " k ")")))))))

(.addEventListener ($ "merge-btn") "click"
  (fn [_]
    (let [on (not (:merge-pick @ui))]
      (swap! ui assoc :merge-pick on)
      (.toggle (.-classList ($ "hist-wrap")) "picking" on))))

(.addEventListener ($ "auto") "change"
  (fn [e] (gesture! (str "(front " (.. e -target -checked) ")"))))

(.addEventListener ($ "simul") "change"
  (fn [e]
    (let [v (js/parseInt (.. e -target -value) 10)]
      (if (js/isNaN v)
        (render-controls!)
        (gesture! (str "(simultaneity " v ")"))))))

(.addEventListener ($ "peers") "click"
  (fn [e]
    (when-let [el (.closest (.-target e) "[data-peer]")]
      (let [pr (.getAttribute el "data-peer")]
        (swap! ui assoc :follow (if (= pr (:follow @ui)) nil pr))
        (sync-follow!)))))
