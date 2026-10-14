;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 10 of 12: learn
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── learning: help and lessons (Study 18) ─────────────────────────
;; The Help tab shows what each class does, port by port (its :help, or kairotic.help), with a help
;; patch. A lesson (a tutorial, or a help patch) opens as a local work built step by step: each step
;; leaves a point in the history, the lesson bar shows the note of the step you are at, ◀ ▶ travel
;; between them, and changing something at any step simply starts a branch of your own.

(defonce lang (atom (let [saved (try (.getItem js/localStorage "kairotic.lang") (catch :default _ nil))]
                      (cond (#{"es" "en"} saved) (keyword saved)
                            (str/starts-with? (str (.-language js/navigator)) "es") :es
                            :else :en))))

(defn tr "A text in the chosen language (or the other one)." [m]
  (cond (string? m) m
        (map? m) (or (not-empty (get m @lang)) (not-empty (get m :en)) (not-empty (get m :es)) "")
        :else ""))

(defn es? [] (= @lang :es))

(defn rich
  "Note text to HTML: paragraphs (blank lines), **bold**, `code` (a click puts it in the REPL)."
  [t]
  (->> (str/split (str t) #"\n\s*\n")
       (remove str/blank?)
       (map (fn [para]
              (str "<p>"
                   (-> (esc (str/trim para))
                       (str/replace #"\*\*([^*]+)\*\*" "<b>$1</b>")
                       (str/replace #"`([^`]+)`"
                                    (fn [[_ c]] (str "<code class=\"run\" data-code=\"" c "\" title=\"Click: into the REPL\">" c "</code>"))))
                   "</p>")))
       (apply str)))

(defn select-tab! [tab] (when-let [t ($ (str "tab-" tab))] (.click t)))

(defn to-repl! [code]
  (let [inp ($ "repl-in")] (set! (.-value inp) code) (.focus inp)))

;; ───── tutorials (kairotic/tutorials.mjs, built from docs/tutorials) ─────

(def tracks [["patch-code" {:en "Patch ⇄ code" :es "Patch ⇄ código"}]
             ["theory" {:en "Notation and theory" :es "Notación y teoría"}]
             ["composition" {:en "Composition and CAC" :es "Composición y CAC"}]
             ["dsp" {:en "Electroacoustics and DSP" :es "Electroacústica y DSP"}]
             ["faust" {:en "Faust" :es "Faust"}]])

(defonce tutorials (atom nil))   ; nil · :loading · [{:id :track :order :title :steps} …]

(defn load-tutorials! []
  (when (nil? @tutorials)
    (reset! tutorials :loading)
    (-> ((.-kairoticImport js/window) (str "kairotic/tutorials.mjs?v=" (js/Date.now)))
        (.then (fn [m] (reset! tutorials (vec (js->clj (.-tutorials m) :keywordize-keys true)))))
        (.catch (fn [e] (reset! tutorials [])
                  (repl-print! "err" (esc (str "Could not read the tutorials: " (or (.-message e) e)))))))))

;; ───── the Help tab ─────

(defonce help-cls (atom nil))   ; nil = the index

(defn help-ports [label n names]
  (when (pos? n)
    (str "<h4>" label "</h4>"
         (if (= n (count names))
           (str "<ol start=\"0\">" (apply str (for [x names] (str "<li>" (esc x) "</li>"))) "</ol>")
           (str "<p>" n (if (= label "Inlets") " (numbered from 0, left to right)" " (numbered from 0)")
                (when (seq names) (str ": " (esc (str/join " · " names)))) "</p>")))))

(defn help-word [w]
  (if (str/starts-with? (str w) "(")
    (str "<code class=\"run\" data-code=\"" (esc w) "\">" (esc w) "</code>")
    (str "<code>" (esc w) "</code>")))

(defn help-page [cls]
  (let [d (comp/lookup cls) h (hlp/of cls)
        doc (or (:doc d) (:doc h)) usage (or (:usage d) (:usage h))
        [ins outs] (if d (try (io cls) (catch :default _ [0 0])) [(count (:inlets h)) (count (:outlets h))])
        spec (when d (spec-of d))]
    (str "<p class=\"back\"><a href=\"#\" data-help-index=\"1\">◀ Help</a></p>"
         "<h3>" (esc cls)
         (when-let [p (:package h)] (str "<span class=\"pkg\" title=\"Writing it in a box brings this package into the work\">" (esc p) "</span>"))
         (when (= :work (:origin d)) "<span class=\"pkg\">defined in this work</span>")
         "</h3>"
         (when usage (str "<div class=\"usage\">" (esc usage) "</div>"))
         (when doc (str "<p>" (esc doc) "</p>"))
         (when (and (nil? d) (empty? h)) "<p>There is no class with this name.</p>")
         (when spec
           (str "<h4>Arguments</h4><table>"
                (apply str (for [[a v] spec]
                             (str "<tr><td>" (esc (name a)) "</td><td>"
                                  (esc (cond (boolean? v) "a flag: on when its name is written"
                                             (keyword? v) (str "a number (by default, the value of " (name v) ")")
                                             (number? v) (str "a number, " (cv/fmt v) " by default")
                                             :else "a word"))
                                  "</td></tr>")))
                "</table>"))
         (help-ports "Inlets" ins (:inlets h))
         (help-ports "Outlets" outs (:outlets h))
         (when (seq (:messages h))
           (str "<h4>Messages and gestures</h4><table>"
                (apply str (for [[w x] (:messages h)] (str "<tr><td>" (help-word w) "</td><td>" (esc x) "</td></tr>")))
                "</table>"))
         (when (:example h)
           (str "<h4>Help patch</h4><p><button class=\"act primary\" data-help-open=\"" (esc cls) "\">Open the help patch</button> "
                "<small>a local work you can play and change; Close (in the lesson bar) brings back what you had open</small></p>"
                (when (:try h) (str "<div class=\"try\">" (esc (:try h)) "</div>"))))
         (when (and d (empty? h) (#{:work :user} (:origin d)))
           "<p><small>No help written yet: a component can carry its own, as <code>:help {:inlets […] :outlets […] :example \"…\"}</code> in its definition.</small></p>")
         (when (seq (:see h))
           (str "<h4>See also</h4><div class=\"chips\">"
                (apply str (for [c (:see h)] (str "<span class=\"chip\" data-help=\"" (esc c) "\">" (esc c) "</span>")))
                "</div>")))))

(declare docs-index)

(defn help-index []
  (let [ts @tutorials]
    (str "<input class=\"help-find\" id=\"help-find\" list=\"help-classes\" placeholder=\""
         (if (es?) "Una clase: osc~, ramp, reader~…" "A class: osc~, ramp, reader~…") "\" spellcheck=\"false\">"
         "<datalist id=\"help-classes\">" (apply str (for [c (hlp/known)] (str "<option value=\"" (esc c) "\">"))) "</datalist>"
         "<p><small>" (if (es?) "Selecciona una caja y pulsa <b>?</b> para ver aquí su ayuda." "Select a box and press <b>?</b> to see its help here.") "</small></p>"
         (docs-index)
         "<h4>" (if (es?) "Tutoriales" "Tutorials") "</h4>"
         (cond
           (= :loading ts) "<p>…</p>"
           (empty? ts) "<p><small>None.</small></p>"
           :else
           (apply str
                  (for [[tk tname] tracks
                        :let [ls (sort-by :order (filter (fn [t] (= tk (:track t))) ts))]
                        :when (seq ls)]
                    (str "<p><b>" (esc (tr tname)) "</b></p><ul class=\"tuts\">"
                         (apply str (for [t ls]
                                      (str "<li class=\"tut\" data-tut=\"" (esc (:id t)) "\"><span>" (esc (tr (:title t))) "</span>"
                                           "<small>" (count (:steps t)) (if (es?) " pasos" " steps") "</small></li>")))
                         "</ul>"))))
         "<h4>" (if (es?) "Componentes" "Components") "</h4><div class=\"chips\">"
         (apply str (for [c (hlp/known)] (str "<span class=\"chip\" data-help=\"" (esc c) "\">" (esc c) "</span>")))
         "</div>")))

;; ───── the documentation in the Help tab (kairotic/docs.mjs, built from docs/) ─────

(declare link-code open-link-work! render-help! show-help!)

(defonce doc-pages (atom nil))   ; nil · :loading · {"id" {"en" text "es" text}}
(defonce help-doc (atom nil))    ; the page of the documentation on screen, or nil

(def doc-groups
  [[{:en "Start here" :es "Para empezar"} ["guide" "concepts"]]
   [{:en "Topics" :es "Temas"} ["mt" "flow" "ask" "embed" "pages"]]
   [{:en "Extending" :es "Ampliarlo"} ["writing-a-component"]]
   [{:en "Reference" :es "Referencia"} ["reference" "glossary"]]
   [{:en "History" :es "Historia"} ["studies"]]])

(defn load-docs! []
  (when (nil? @doc-pages)
    (reset! doc-pages :loading)
    (-> ((.-kairoticImport js/window) (str "kairotic/docs.mjs?v=" (js/Date.now)))
        (.then (fn [m] (reset! doc-pages (get (js->clj m) "pages"))))
        (.catch (fn [e] (reset! doc-pages {})
                  (repl-print! "err" (esc (str "Could not read the documentation: " (or (.-message e) e)))))))))

(defn doc-text [id]
  (let [p (when (map? @doc-pages) (get @doc-pages id))]
    (or (when (es?) (get p "es")) (get p "en"))))

(defn doc-title [id]
  (or (some->> (doc-text id) (re-find #"(?m)^# (.+)$") second) id))

(def docs-base "https://github.com/bonuoq/kairotic/blob/main/docs/")

(defn md-link
  "A link of the documentation: to another page (shown here, in its language), to the web (a new tab),
   or to a file of the repository (on GitHub)."
  [label href]
  (let [[_ id es] (re-matches #"(?:\./)?([a-z-]+?)(\.es)?\.md(?:#.*)?" href)]
    (cond
      (and id (contains? (set (mapcat second doc-groups)) id))
      (str "<a href=\"#\" data-doc=\"" id "\" data-lang=\"" (if es "es" "en") "\">" label "</a>")
      (and id (= id "README")) (str "<a href=\"#\" data-help-index=\"1\">" label "</a>")
      (str/starts-with? href "#") label
      :else (let [u (if (re-find #"^https?:" href) href (.-href (js/URL. href docs-base)))]
              (str "<a href=\"" u "\" target=\"_blank\" rel=\"noopener\">" label "</a>")))))

(defn md-inline
  "Inline Markdown: `code`, [links](…), **bold**, *italic*."
  [s]
  (let [parts (str/split (str s) #"`" -1)]
    (apply str
           (map-indexed
            (fn [i p]
              (if (odd? i)
                (str "<code>" (esc p) "</code>")
                (-> (esc p)
                    (str/replace #"\[([^\]]+)\]\(([^)\s]+)\)" (fn [[_ l h]] (md-link l (str/replace h "&amp;" "&"))))
                    (str/replace #"\*\*([^*]+)\*\*" "<b>$1</b>")
                    (str/replace #"(^|[\s(])\*([^*\s][^*]*)\*" "$1<i>$2</i>"))))
            parts))))

(defn md-code [lang code]
  (let [patch? (and (#{"clojure" "clj" ""} lang) (str/includes? code "(box ")
                    (try (link-code code) true (catch :default _ false)))]
    (str "<pre>" (esc code) "</pre>"
         (when patch?
           (str "<p class=\"doc-try\"><button class=\"act\" data-doc-patch=\"" (esc code) "\">"
                (if (es?) "Abrir como patch local" "Open as a local patch") "</button></p>")))))

(defn md-block-start? [l]
  (or (str/starts-with? l "```") (re-matches #"#{1,6} .*" l) (str/starts-with? l "|") (str/starts-with? l "> ")
      (re-matches #"([-*]|\d+\.) .*" l)))

(defn md->html
  "The Markdown of docs/ as HTML: headings, paragraphs, lists, tables, quotes, code blocks."
  [text]
  (let [ls (vec (str/split-lines (str text))) n (count ls)
        take-while-from (fn [i pred] (loop [j i] (if (and (< j n) (pred (nth ls j))) (recur (inc j)) j)))]
    (loop [i 0 out []]
      (if (>= i n)
        (apply str out)
        (let [l (nth ls i)]
          (cond
            (str/starts-with? l "```")
            (let [j (take-while-from (inc i) #(not (str/starts-with? % "```")))]
              (recur (inc j) (conj out (md-code (str/trim (clojure.core/subs l 3)) (str/join "\n" (subvec ls (inc i) (min j n)))))))
            (str/blank? l) (recur (inc i) out)
            (re-matches #"#{1,6} .*" l)
            (let [k (count (re-find #"^#+" l))]
              (recur (inc i) (conj out (str "<h" (min 6 (inc k)) " class=\"dh\">" (md-inline (str/trim (clojure.core/subs l k))) "</h" (min 6 (inc k)) ">"))))
            (str/starts-with? l "|")
            (let [j (take-while-from i #(str/starts-with? % "|"))
                  rows (remove #(re-matches #"\|[\s:|-]+\|?" %) (subvec ls i j))
                  cells (fn [r] (map str/trim (butlast (rest (str/split r #"\|" -1)))))]
              (recur j (conj out (str "<table class=\"dt\">"
                                      (apply str (map-indexed (fn [k r] (str "<tr>" (apply str (for [c (cells r)] (str (if (zero? k) "<th>" "<td>") (md-inline c) (if (zero? k) "</th>" "</td>")))) "</tr>")) rows))
                                      "</table>"))))
            (str/starts-with? l "> ")
            (let [j (take-while-from i #(str/starts-with? % ">"))]
              (recur j (conj out (str "<blockquote>" (md-inline (str/join " " (map #(str/trim (clojure.core/subs % 1)) (subvec ls i j)))) "</blockquote>"))))
            (re-matches #"([-*]|\d+\.) .*" l)
            (let [ordered (re-matches #"\d+\. .*" l)
                  j (take-while-from i #(or (re-matches #"\s*([-*]|\d+\.) .*" %) (re-matches #"\s+\S.*" %)))
                  items (reduce (fn [acc x]
                                  (if-let [[_ t] (re-matches #"\s*(?:[-*]|\d+\.) (.*)" x)]
                                    (conj acc t)
                                    (conj (pop acc) (str (peek acc) " " (str/trim x)))))
                                [] (subvec ls i j))]
              (recur j (conj out (str (if ordered "<ol>" "<ul>") (apply str (for [t items] (str "<li>" (md-inline t) "</li>"))) (if ordered "</ol>" "</ul>")))))
            :else
            (let [j (take-while-from (inc i) #(not (or (str/blank? %) (md-block-start? %))))]
              (recur j (conj out (str "<p>" (md-inline (str/join " " (subvec ls i j))) "</p>"))))))))))

(defn doc-page [id]
  (str "<p class=\"back\"><a href=\"#\" data-help-index=\"1\">◀ Help</a></p>"
       (cond
         (= :loading @doc-pages) "<p>…</p>"
         (doc-text id) (str "<div class=\"doc\">" (md->html (doc-text id)) "</div>")
         :else (str "<p>" (esc (str "No page " id)) "</p>"))))

(defn docs-index []
  (str "<h4>" (if (es?) "Documentación" "Documentation") "</h4>"
       (if (map? @doc-pages)
         (apply str (for [[g ids] doc-groups]
                      (str "<p><b>" (esc (tr g)) "</b></p><ul class=\"tuts\">"
                           (apply str (for [id ids :when (doc-text id)]
                                        (str "<li class=\"tut\" data-doc=\"" id "\"><span>" (esc (doc-title id)) "</span></li>")))
                           "</ul>")))
         "<p>…</p>")))

(defn show-doc!
  "Opens a page of the documentation in the Help tab."
  [id]
  (load-docs!)
  (reset! help-cls nil)
  (reset! help-doc id)
  (render-help!)
  (select-tab! "help")
  (set! (.-scrollTop ($ "help-view")) 0))

(defn docs
  "The documentation in the Help tab: (docs) its index, (docs \"guide\") a page — guide, concepts, mt,
   flow, ask, embed, pages, writing-a-component, reference, glossary, studies."
  ([] (show-help! nil) (mapv first (mapcat (fn [[_ ids]] (map vector ids)) doc-groups)))
  ([id] (show-doc! (str id)) (str id)))

(add-watch doc-pages ::help (fn [_ _ _ _] (render-help!)))

(defn reference-md
  "The reference of every class with a help page, as Markdown (docs/reference.md is made with it):
   (reference-md)."
  []
  (let [md-ports (fn [label n names]
                   (when (pos? n)
                     (str "**" label "** " (if (= n (count names))
                                              (str "\n" (apply str (map-indexed (fn [i x] (str "\n" i ". " x)) names)) "\n")
                                              (str n (when (seq names) (str ": " (str/join " · " names))) "\n"))
                          "\n")))
        page (fn [cls]
               (let [d (comp/lookup cls) h (hlp/of cls)
                     doc (or (:doc d) (:doc h)) usage (or (:usage d) (:usage h))
                     [ins outs] (if d (try (io cls) (catch :default _ [0 0])) [(count (:inlets h)) (count (:outlets h))])]
                 (when (and doc (not (str/starts-with? (str doc) "Kairotic class with no semantics")))
                   (str "### " cls (when-let [p (:package h)] (str " · `" p "`")) "\n\n"
                        (when usage (str "`" usage "`\n\n"))
                        doc "\n\n"
                        (md-ports "Inlets" ins (:inlets h))
                        (md-ports "Outlets" outs (:outlets h))
                        (when (seq (:messages h))
                          (str "**Messages and gestures**\n\n" (apply str (for [[w x] (:messages h)] (str "- `" (if (string? w) w (pr-str w)) "`: " x "\n"))) "\n"))
                        (when-let [t (:try h)] (str "**Try:** " t "\n\n"))
                        (when-let [e (:example h)] (str "```clojure\n" (str/trim e) "\n```\n\n"))
                        (when (seq (:see h)) (str "See also: " (str/join ", " (map #(str "`" % "`") (:see h))) "\n\n"))))))]
    (str "# Class reference\n\n"
         "*Made from the help of Kairotic " version " (the Help tab shows the same, and the help of classes a work defines). "
         "Generated: do not edit by hand — `(reference-md)` in the REPL writes it.*\n\n"
         (str/join "" (keep page (hlp/known))))))

(defn render-help! []
  (when-let [el ($ "help-view")]
    (set! (.-innerHTML el) (cond @help-doc (doc-page @help-doc)
                                 @help-cls (help-page @help-cls)
                                 :else (help-index)))))

(defn show-help!
  "Opens the Help tab: the page of a class, or the index (nil)."
  [cls]
  (load-tutorials!)
  (load-docs!)
  (reset! help-doc nil)
  (reset! help-cls (when (seq cls) cls))
  (render-help!)
  (select-tab! "help")
  (set! (.-scrollTop ($ "help-view")) 0))

(defn refresh-help!
  "Draws the Help tab as it is (the index, or the page it was on), loading the tutorials if needed."
  [] (load-tutorials!) (load-docs!) (render-help!))

(add-watch tutorials ::help (fn [_ _ _ _] (render-help!)))

;; ───── lessons ─────

(defonce lesson-back (atom nil))   ; what was open before the first lesson

(defn render-lesson! []
  (let [el ($ "lesson") l @lesson]
    (set! (.-hidden el) (nil? l))
    (when l
      (let [steps (:steps l) n (count steps) i (min (:at l) (dec n)) st (nth steps i nil)
            here (norm (:pos @world))
            last-pos (some :pos (reverse steps))
            away? (and here last-pos (not (some (fn [s] (= here (:pos s))) steps)) (not (reaches? here last-pos)))]
        (set! (.-textContent ($ "lesson-title")) (tr (:title l)))
        (set! (.-textContent ($ "lesson-n")) (str (inc i) " / " n))
        (set! (.-disabled ($ "lesson-prev")) (zero? i))
        (set! (.-disabled ($ "lesson-next")) (>= i (dec n)))
        (set! (.-textContent ($ "lesson-back")) (if (es?) "Cerrar" "Close"))
        (doseq [b (array-seq (.querySelectorAll el "[data-lang]"))]
          (.setAttribute b "aria-pressed" (str (= (name @lang) (.. b -dataset -lang)))))
        (set! (.-innerHTML ($ "lesson-note"))
              (str (let [t (tr (:title st))] (when (seq t) (str "<p class=\"step-t\">" (esc t) "</p>")))
                   (rich (tr (:note st)))
                   (let [t (tr (:try st))]
                     (when (seq t) (str "<div class=\"try\">" (rich (str (if (es?) "**Prueba:** " "**Try:** ") t)) "</div>")))
                   (when away?
                     (str "<p class=\"away\">"
                          (if (es?) "Estás en una rama tuya: la lección sigue en la historia. ◀ ▶ te devuelven a ella."
                                    "You are on a branch of your own: the lesson is still in the history. ◀ ▶ take you back to it.")
                          "</p>"))))))))

(defn lesson-sync!
  "After moving in the history by other means, the step you are at."
  []
  (when-let [l @lesson]
    (let [here (norm (:pos @world)) steps (:steps l)]
      (when-not (= (:pos (nth steps (:at l) nil)) here)
        (let [i (last (keep-indexed (fn [i s] (when (and (:pos s) here (reaches? (:pos s) here)) i)) steps))]
          (swap! lesson assoc :at (or i 0)))))
    (render-lesson!)))

(add-watch world ::lesson (fn [_ _ o n] (when (and @lesson (not= (:pos o) (:pos n))) (lesson-sync!))))

(defn lesson-go! [i]
  (when-let [l @lesson]
    (let [i (max 0 (min (dec (count (:steps l))) i)) p (:pos (nth (:steps l) i))]
      (swap! lesson assoc :at i)
      (if p
        (goto (first p) (second p))
        (swap! world assoc :pos nil :auto false :prev-pos nil))
      (swap! lesson assoc :at i)
      (render-lesson!))))

(def box-class-re #"\(box\s+(?::\S+\s+)?\"([^\"\s]+)")

(defn lesson-definitions
  "Promise of [[name classes source] …]: the official packages and single components a lesson's boxes
   need and the work does not define yet, fetched before the lesson is built (so that their
   definitions are part of its history, in order, and not late arrivals on a branch of their own)."
  [l]
  (let [ks (distinct (for [st (:steps l) c (:code st) [_ k] (re-seq box-class-re c)] k))
        ;; a lesson starts from an empty history: every class of a package is needed, even if the
        ;; work open before it had defined it
        pkgs (distinct (keep (fn [k] (first (lib/package-of k))) ks))
        singles (filter (fn [k] (and (lib/single-of k) (not (lib/package-of k)))) ks)]
    (if (and (empty? pkgs) (empty? singles))
      (js/Promise.resolve [])
      (-> (js/Promise.all
           (into-array
            (concat (for [p pkgs] (.then (lib/import-package p) (fn [[m origin]] [p (set (map :class (:components m))) (lib/package-source m origin)])))
                    (for [k singles] (.then (lib/import-single k) (fn [[m origin]] [k #{k} (str (lib/header m origin) (:source m))]))))))
          (.then (fn [arr] (vec arr)))))))

(declare build-lesson!)

(defn open-lesson!
  "Opens a lesson: first the packages its boxes need, then the lesson itself (build-lesson!)."
  [l]
  (repl-print! "out" (esc (str "; " (if (es?) "Preparando la lección" "Preparing the lesson") "…")))
  (-> (lesson-definitions l)
      (.then (fn [defs] (build-lesson! (assoc l :defs defs))))
      (.catch (fn [e]
                (repl-print! "err" (esc (str "; " (or (.-message e) e) " · " (if (es?) "la lección se abre sin ese paquete" "the lesson opens without that package"))))
                (build-lesson! l)))))

(defn build-lesson!
  "Builds a lesson as a local work, step by step: the gestures of each step are made in order
   (they appear in the REPL) and each step remembers its point in the history."
  [l]
  (when-not @lesson (reset! lesson-back {:work @work :hist @hist :world @world :settings @settings}))
  (reset! lesson nil)
  (eng/stop!)
  (reset! cbox/trust true)
  (cbox/forget-language! "clojurescript")
  (reset! work {:kind :local :id "lesson" :name (tr (:title l))})
  (reset-work-state! :local)
  (swap! mgr assoc :open false :confirm nil :invite nil)
  (set-hash! "")
  (lobby-presence!)
  (swap! hist assoc :mode :local :loaded true)
  (repl-print! "out" (esc (str "; " (if (es?) "Lección" "Lesson") ": «" (tr (:title l)) "»")))
  (let [defs (atom (:defs l))   ; [[name classes source] …] of packages and singles not yet in the work
        ;; definition boxes get ids beyond any the lesson writes (lessons name their boxes)
        free-id (atom (inc (reduce max 0 (for [st (:steps l) c (:code st) [_ n] (re-seq #":b(\d+)" c)] (js/parseInt n 10)))))
        steps (reduce (fn [acc st]
                        (doseq [c (:code st)]
                          ;; a class from a package: its definition goes in just before the box that uses it
                          (let [used (set (map second (re-seq box-class-re c)))]
                            (doseq [[nm cls src :as d] @defs :when (some used cls)]
                              (let [id (keyword (str "b" @free-id)) [x y] (component-slot)]
                                (swap! free-id inc)
                                (gesture! (str "(box " id " \"component\" " x " " y ")"))
                                (gesture! (str "(code " id " " (pr-str src) ")")))
                              (swap! defs (fn [ds] (vec (remove #{d} ds))))))
                          (gesture! c))
                        (conj acc (assoc st :pos (norm (:pos @world)))))
                      [] (:steps l))]
    (reset! lesson (assoc l :steps steps :at 0))
    (lesson-go! 0)
    (render-all!)
    (render-lesson!)))

(defn close-lesson!
  "Closes the lesson and brings back what was open before it."
  []
  (let [b @lesson-back w (:work b)]
    (reset! lesson nil)
    (reset! lesson-back nil)
    (eng/stop!)
    (cond
      (#{:room :solo} (:kind w)) (open-work! (:kind w) (:id w) (:name w))
      (= :local (:kind w)) (do (reset! work w)
                               (reset-work-state! :local)
                               (reset! hist (:hist b))
                               (reset! settings (:settings b))
                               (reset! world (:world b))
                               (render-all!))
      :else (close-work!))
    (render-lesson!)))

(defn open-help-patch! [cls]
  (let [h (hlp/of cls) d (comp/lookup cls)]
    (when (:example h)
      (open-lesson! {:help cls
                     :title {:en (str "Help · " cls) :es (str "Ayuda · " cls)}
                     :steps [{:title cls
                              :note (or (:doc d) (:doc h) "")
                              :try (or (:try h) "")
                              :code (->> (str/split-lines (:example h)) (map str/trim) (remove str/blank?) vec)}]}))))

(defn open-tutorial! [id]
  (when-let [t (first (filter (fn [t] (= id (:id t))) (when (sequential? @tutorials) @tutorials)))]
    (open-lesson! t)))

(defn tutorial
  "Opens a tutorial by id: (tutorial \"patch-to-code\"). Without an id, the list."
  ([] (show-help! nil) (if (sequential? @tutorials) (mapv :id @tutorials) :loading))
  ([id] (if (sequential? @tutorials) (do (open-tutorial! id) id) (do (load-tutorials!) :loading))))

(defn set-lang! [l]
  (reset! lang l)
  (try (.setItem js/localStorage "kairotic.lang" (name l)) (catch :default _ nil))
  (render-lesson!)
  (render-help!))

(.addEventListener ($ "help-view") "click"
  (fn [e]
    (let [t (.-target e)]
      (cond
        (.closest t "[data-help-index]") (do (.preventDefault e) (show-help! nil))
        (.closest t "[data-doc]")
        (let [el (.closest t "[data-doc]") l (.getAttribute el "data-lang")]
          (.preventDefault e)
          (when (and l (not= l (name @lang))) (reset! lang (keyword l)) (render-lesson!))
          (show-doc! (.getAttribute el "data-doc")))
        (.closest t "[data-doc-patch]")
        (try (open-link-work! (if (es?) "Documentación" "Documentation")
                              (link-code (.getAttribute (.closest t "[data-doc-patch]") "data-doc-patch")))
             (catch :default x (repl-print! "err" (esc (str "; " (or (.-message x) x))))))
        (.closest t "[data-help-open]") (open-help-patch! (.getAttribute (.closest t "[data-help-open]") "data-help-open"))
        (.closest t "[data-help]") (show-help! (.getAttribute (.closest t "[data-help]") "data-help"))
        (.closest t "[data-tut]") (open-tutorial! (.getAttribute (.closest t "[data-tut]") "data-tut"))
        (.closest t "code.run") (to-repl! (.getAttribute (.closest t "code.run") "data-code"))))))

(.addEventListener ($ "help-view") "change"
  (fn [e]
    (when (= "help-find" (.. e -target -id))
      (let [v (str/trim (.. e -target -value))]
        (when (or (comp/lookup v) (seq (hlp/of v))) (show-help! v))))))

(.addEventListener ($ "lesson") "click"
  (fn [e]
    (let [t (.-target e)]
      (cond
        (.closest t "#lesson-prev") (lesson-go! (dec (:at @lesson)))
        (.closest t "#lesson-next") (lesson-go! (inc (:at @lesson)))
        (.closest t "#lesson-back") (close-lesson!)
        (.closest t "[data-lang]") (set-lang! (keyword (.. (.closest t "[data-lang]") -dataset -lang)))
        (.closest t "code.run") (to-repl! (.getAttribute (.closest t "code.run") "data-code"))))))
