;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 11 of 12: embed
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── embedding (Study 22) ─────────────────────────
;; A link carries what it shows: a patch (its code, compressed), a tutorial step or a help patch. It
;; opens as a local work (nothing is saved, and in ?embed / ?present nothing connects to a relay).
;; The code of a link is read as data and only a few calls are let through, with literal arguments:
;; a link cannot run code in this page. Its script and component boxes wait, as in a shared room,
;; until whoever opened it runs them.
;; Release/Perform (issue #50): the link carries a release of the patch (its presets boxes keeping their
;; presets, as `(release)` makes it) and opens in Perform, so what whoever plays it changes is a take,
;; never the work. Old ?present links open the same way.

(declare with-stored-presets perform)

(def link-calls links/calls)
(defn link-code
  "The code of a link, read as data and written again with only the calls a patch is made of
   (kairotic.links)."
  [src] (links/read-code src))

(defn script-boxes
  "The script, component and pattern boxes of the work that would run code nobody has allowed yet."
  []
  (count (filter (fn [b] (and (#{"script" "component" "pattern"} (klass (:text b)))
                              (not (cbox/allowed? (str (get-in b [:data :source]))))))
                 (vals (:boxes (eng/flat (root-patch)))))))

(defn trust-official!
  "The component boxes of a link that are exactly an official package (as this page
   brings it) run without asking."
  []
  (let [srcs (keep (fn [b] (when (= "component" (klass (:text b))) (str (get-in b [:data :source]))))
                   (vals (:boxes (eng/flat (root-patch)))))
        pkgs (distinct (for [s srcs [_ p] (re-seq #":package \"([^\"]+)\"" s) :when (get lib/packages p)] p))
        wanted (set srcs)]
    (-> (js/Promise.all
         (into-array
          (for [p pkgs] (-> (lib/import-package p) (.then (fn [[m origin]] (lib/package-source m origin))) (.catch (fn [_] nil))))))
        (.then (fn [arr]
                 (let [ok (filter wanted (array-seq arr))]
                   (when (seq ok)
                     (swap! cbox/trusted into ok)
                     (cbox/forget-language! "component")
                     (render-all!))))))))

(defn update-trust-bar! []
  (when-let [el ($ "trust-bar")]
    (let [n (if (and (= "link" (:id @work)) (not @cbox/trust)) (script-boxes) 0)]
      (set! (.-hidden el) (zero? n))
      (when (pos? n)
        (set! (.-textContent ($ "trust-text"))
              (if (es?)
                (str "Este patch trae " n (if (= n 1) " script" " scripts") " (ClojureScript de quien hizo el enlace): no se ejecutan hasta que lo permitas.")
                (str "This patch brings " n (if (= n 1) " script" " scripts") " (ClojureScript by whoever made the link): they do not run until you allow it.")))
        (set! (.-textContent ($ "trust-run")) (if (es?) "Ejecutarlos" "Run them"))))))

(.addEventListener ($ "trust-run") "click" (fn [_] (trust-scripts true)))

(defn open-link-work!
  "Opens a local work whose history starts with the patch of a link."
  [nm code]
  (let [p (build code)]
    (eng/stop!)
    (reset! lesson nil)
    (reset! cbox/trust false)
    (cbox/forget-language! "clojurescript")
    (reset! work {:kind :local :id "link" :name nm})
    (reset-work-state! :local)
    (swap! mgr assoc :open false :confirm nil :invite nil)
    (swap! hist assoc :mode :local :loaded true)
    (let [id (new-node! nil 0 [[:load p]] nil)]
      (swap! world assoc :pos [id 1]))
    (ensure-classes!)
    (trust-official!)
    (repl-print! "out" (esc (str "; " (if (es?) "Desde un enlace" "From a link") ": «" nm "» (" (if (es?) "local: no se guarda" "local: not saved") ")")))
    (render-all!)))

(defn site-url
  "Where links point: this page on Kairotic Pages (inside claude.ai, the public site)."
  []
  (if (pages?)
    (str (.-origin js/location) (.-pathname js/location))
    "https://bonuoq.github.io/kairotic/"))

(defn release-code
  "The code of the patch as a release carries it: its presets boxes keeping their presets (issue #50)."
  []
  (patch->code (try (with-stored-presets (work-patch)) (catch :default _ (work-patch)))))

(defn link-mode
  "The mode of a link: :present (Release/Perform; also asked as :release or :perform) or :embed."
  [mode]
  (if (#{:present :release :perform "present" "release" "perform"} mode) :present :embed))

(defn packed-code
  "Promise of the patch as a link carries it: in Release/Perform, its release."
  [mode]
  (-> (js/Promise.resolve nil)
      (.then (fn [_] ((.-kairoticPack js/window) (if (= mode :present) (release-code) (patch->code (work-patch))))))))

(defn link-params
  "Promise of the parameters that bring back what is shown now: the tutorial step, the help patch, or
   the patch itself — or, if asked in the Share/Export panel, a description for Claude (Study 23). In
   Release/Perform (:present), always the release of the patch (issue #50)."
  ([] (link-params :embed))
  ([mode]
   (let [l @lesson
         ask (when (some-> ($ "ep-ask") .-checked) (str/trim (str (.-value ($ "ep-ask-text")))))]
     (cond
       (seq ask) (js/Promise.resolve [["ask" ask]])
       (= mode :present) (.then (packed-code :present) (fn [z] [["code" z]]))
       (and l (:id l)) (js/Promise.resolve [["tutorial" (:id l)] ["step" (str (inc (:at l)))] ["lang" (name @lang)]])
       (and l (:help l)) (js/Promise.resolve [["help" (:help l)] ["lang" (name @lang)]])
       :else (.then (packed-code :embed) (fn [z] [["code" z]]))))))

(defn url-with
  "A link to the site with these parameters, after # (issue #55: a long patch is not refused by the server)."
  [ps mode]
  (let [q (js/URLSearchParams.)]
    (doseq [[k v] ps] (.set q k v))
    (case mode :embed (.set q "embed" "") :present (.set q "present" "") nil)
    (str (site-url) "#" (str/replace (.toString q) #"=(&|$)" "$1"))))

(defn iframe-of [url mode]
  (str "<iframe src=\"" (esc url) "\" width=\"100%\" height=\"" (if (= mode :present) 560 480)
       "\" style=\"border:0\" allow=\"fullscreen; autoplay\" allowfullscreen loading=\"lazy\"></iframe>"))

(defn copy-text! [text]
  (-> (js/Promise.resolve)
      (.then (fn [_] (.writeText (.-clipboard js/navigator) text)))
      (.then (fn [_] true))
      (.catch (fn [_] false))))

(defn embed-link
  "A link (and an iframe) that shows what is open now in another page: the patch, or with :release
   (also :perform or :present) a release of it, in Perform, only its presentation, fullscreen. The link is
   copied. In Notion: /embed and paste it."
  ([] (embed-link :embed))
  ([mode]
   (let [mode (link-mode mode)]
     (-> (link-params mode)
         (.then (fn [ps]
                  (let [u (url-with ps mode)]
                    (repl-print! "out" (esc (str "; " u)))
                    (repl-print! "out" (esc (str "; " (iframe-of u mode))))
                    (.then (copy-text! u) (fn [ok] (repl-print! "out" (if ok "; (link copied)" "; (copy it from here)")))))))
         (.catch (fn [e] (repl-print! "err" (esc (str (or (.-message e) e)))))))
     :making-link)))

;; ───── the Share/Export panel (it was Embed) ─────

(defn ep-mode [] (if (.-checked (.querySelector js/document "input[name=ep-mode][value=present]")) :present :embed))

(defn render-embed-pop! []
  (set! (.-hidden ($ "ep-ask-row")) (not (.-checked ($ "ep-ask"))))
  (when (and (.-checked ($ "ep-ask")) (str/blank? (.-value ($ "ep-ask-text"))))
    (set! (.-value ($ "ep-ask-text")) (str/trim (str (.-value ($ "ask-text"))))))
  (let [mode (ep-mode) l @lesson]
    (set! (.-textContent ($ "ep-what"))
          (cond (= mode :present) "A release of this patch (its presets boxes keep their presets), opened in Perform: whatever is played or changed there is a take, never the work. Only the presented boxes, filling the frame, with a fullscreen button (without presented boxes, the whole patch)."
                (and l (:id l)) (str "This tutorial, at step " (inc (:at l)) ", with its lesson bar.")
                (and l (:help l)) (str "The help patch of " (:help l) ".")
                :else "This patch, scaled to the frame, with ▶ ■ and a link to open it in Kairotic."))
    (-> (link-params mode)
        (.then (fn [ps]
                 (let [u (url-with ps mode)]
                   (set! (.-value ($ "ep-url")) u)
                   (set! (.-value ($ "ep-iframe")) (iframe-of u mode)))))
        (.catch (fn [e] (set! (.-value ($ "ep-url")) (str "Error: " (or (.-message e) e))))))))

(.addEventListener ($ "embed-btn") "click"
  (fn [_]
    (let [el ($ "embed-pop")]
      (set! (.-hidden el) (not (.-hidden el)))
      (when-not (.-hidden el) (render-embed-pop!)))))

(.addEventListener ($ "embed-pop") "change" (fn [_] (render-embed-pop!)))

(.addEventListener ($ "embed-pop") "click"
  (fn [e]
    (let [t (.-target e)]
      (cond
        (.closest t "#ep-close") (set! (.-hidden ($ "embed-pop")) true)
        (.closest t "[data-copy]")
        (let [b (.closest t "[data-copy]") src ($ (.getAttribute b "data-copy"))]
          (.select src)
          (.then (copy-text! (.-value src))
                 (fn [ok] (set! (.-textContent b) (if ok "Copied" "Select + copy"))
                   (js/setTimeout (fn [] (set! (.-textContent b) "Copy")) 1500))))))))

;; ───── inside the frame ─────

(defn mode-url
  "This same address in another mode: nil (the whole editor), :embed or :present."
  [mode]
  (let [q (js/URLSearchParams. (.toString url-params))]
    (.delete q "embed")
    (.delete q "present")
    (case mode :embed (.set q "embed" "") :present (.set q "present" "") nil)
    (let [s (str/replace (.toString q) #"=(&|$)" "$1")]
      (str (.-origin js/location) (.-pathname js/location) (when (seq s) (str "#" s))))))

(defn fullscreen!
  "Fills the screen with the presentation (or leaves it). Where the frame does not allow it, the
   presentation opens in a tab of its own."
  []
  (let [d js/document el (.-documentElement d)]
    (cond
      (.-fullscreenElement d) (.exitFullscreen d)
      (and (.-fullscreenEnabled d) (.-requestFullscreen el)) (.catch (.requestFullscreen el) (fn [_] (js/window.open (mode-url :present) "_blank" "noopener")))
      (and (.-webkitFullscreenEnabled d) (.-webkitRequestFullscreen el)) (.webkitRequestFullscreen el)
      :else (js/window.open (mode-url :present) "_blank" "noopener"))))

(.addEventListener ($ "fs-btn") "click" (fn [_] (fullscreen!)))

(defonce resize-timer (atom nil))
(defonce first-touch (atom false))
(when embed-mode
  (.add (.-classList js/document.body) "embed")
  (when (= embed-mode :present) (.add (.-classList js/document.body) "present"))
  (set! (.-href ($ "open-full")) (mode-url nil))
  (doseq [ev ["resize" "fullscreenchange" "webkitfullscreenchange"]]
    (.addEventListener (if (= ev "resize") js/window js/document) ev
      (fn [_]
        (js/clearTimeout @resize-timer)
        (reset! resize-timer (js/setTimeout (fn [] (render-scene (current))) 80))))))

(defn perform-release!
  "In ?present (Release/Perform, issue #50): the work opens in Perform, so what is played or changed there is
   a take and the release stays as it came. Not in a lesson, which has steps of its own."
  ([] (perform-release! 0))
  ([tries]
   (when (and (= embed-mode :present) (not @perf) (not @lesson))
     (if (#{:connecting :none} (:mode @hist))
       ;; the work is still opening: a moment later
       (when (< tries 40) (js/setTimeout (fn [] (perform-release! (inc tries))) 150))
       (try (perform)
            (catch :default e (js/console.warn "Release/Perform: not in Perform" e)))))))

(defn present-what!
  "In ?present (Release/Perform): in Perform, the presentation if the patch has presented boxes (otherwise
   the whole patch); the first touch starts the sound."
  []
  (when (= embed-mode :present)
    (perform-release!)
    (presentation (boolean (some :present (vals (:boxes (work-patch))))))
    (when-not @first-touch
      (reset! first-touch true)
      (.addEventListener ($ "canvas-wrap") "pointerdown"
        (fn [_] (when-not (eng/running?) (play)))
        #js {:once true :capture true}))))

;; ───── a link that carries a description: ?ask=… (Study 23) ─────
;; The link carries what to make, never a key: whoever opens it makes the patch with Claude on their own
;; key (outside claude.ai, kept in their browser) or account. The result stays in their browser, so it is
;; not made again on every visit, and "Copy the link of this result" gives a link that carries it.

(defonce link-ask (atom nil))   ; {:text :base :key :done :busy :hidden}
(defonce link-base (atom nil))  ; the code of the patch a ?code / ?src link brought, if any

(defn ask-store-key [text base] (str "kairotic.ask:" (hash [text base])))

(defn render-askbar! []
  (let [a @link-ask el ($ "askbar")]
    (set! (.-hidden el) (or (nil? a) (boolean (:hidden a))))
    (when a
      (let [s @sample-fn byok (some-> s .-byok) need-key (boolean (and s byok (not (.hasKey s))))]
        (set! (.-textContent ($ "ab-text")) (str "«" (:text a) "»"))
        (set! (.-hidden ($ "ab-keyrow")) (not need-key))
        (set! (.-disabled ($ "ab-go")) (boolean (or (nil? s) need-key (:busy a))))
        (set! (.-textContent ($ "ab-go")) (if (:done a) "Make it again" "Make it with Claude"))
        (set! (.-hidden ($ "ab-fix")) (not (:done a)))
        (set! (.-innerHTML ($ "ab-note"))
              (cond
                (nil? s) "Claude is not available here: open it in Kairotic ↗."
                byok (str "Claude makes this patch from the description with <b>your own Anthropic API key</b>"
                          (when embed-mode " (saved only in this browser, for this frame)")
                          ", sent only to api.anthropic.com. The link carries the description, never a key.")
                :else "Claude makes this patch from the description with your own Claude account."))))))

(defn ask-link! []
  (when-let [a @link-ask]
    (when-not (:busy a)
      (swap! link-ask assoc :busy true)
      (render-askbar!)
      ;; from the patch the link brought (or an empty one), not from an earlier result
      (dispatch! [:load (build (or (:base a) ""))])
      (-> (ask-patch! (:text a) (boolean (:base a)))
          (.then (fn [code]
                   (when code
                     (try (.setItem js/localStorage (:key a) code) (catch :default _ nil))
                     (swap! link-ask assoc :done true)
                     (present-what!))))
          (.finally (fn [] (swap! link-ask assoc :busy false) (render-askbar!)))))))

(defn setup-ask!
  "A link with ?ask: the bar with the description; what this browser made from it before, if anything."
  [text base]
  (let [k (ask-store-key text base)
        made (try (.getItem js/localStorage k) (catch :default _ nil))]
    (reset! link-ask {:text text :base base :key k})
    (when (seq made)
      (try (apply-patch-code! made)
           (swap! link-ask assoc :done true)
           (ask-log! "done" "made earlier in this browser")
           (catch :default _ nil)))
    (render-askbar!)))

(.addEventListener ($ "ab-go") "click" (fn [_] (ask-link!)))
(.addEventListener ($ "ab-hide") "click" (fn [_] (swap! link-ask assoc :hidden true) (render-askbar!)))
(.addEventListener ($ "ab-key-save") "click"
  (fn [_] (when-let [s @sample-fn]
            (let [v (str/trim (.-value ($ "ab-key")))]
              (when (seq v) (.setKey s v) (set! (.-value ($ "ab-key")) "") (render-askbar!) (render-key!))))))
(.addEventListener ($ "ab-fix") "click"
  (fn [_]
    (-> (packed-code (or embed-mode :embed))
        (.then (fn [z]
                 (let [u (url-with [["code" z]] (or embed-mode :embed))]
                   (.then (copy-text! u)
                          (fn [ok] (set! (.-textContent ($ "ab-status"))
                                         (if ok "Link copied: put it in place of this one, and everyone sees this patch."
                                             (str "Copy this link: " u)))))))))))

(defn ask-link
  "A link that carries a description for Claude: (ask-link \"a sine at 440 Hz with an FM knob\"),
   (ask-link \"…\" :present). Whoever opens it makes the patch with their own key or account."
  ([text] (ask-link text :embed))
  ([text mode]
   (let [u (url-with [["ask" (str text)]] (link-mode mode))]
     (repl-print! "out" (esc (str "; " u)))
     (.then (copy-text! u) (fn [ok] (repl-print! "out" (if ok "; (link copied)" "; (copy it from here)"))))
     :making-link)))


;; ───── the log of requests to Claude: shown, loaded again, exported, shared ─────

(defn ask-play-url
  "Promise of a link that plays what an entry made: its patch, or a patch with its component."
  [e]
  (let [code (if (= "component" (:kind e))
               (str "(box :b1 \"component\" 20 20)\n(code :b1 " (pr-str (str (:code e))) ")")
               (str (:code e)))]
    (.then ((.-kairoticPack js/window) code) (fn [z] (url-with [["code" z]] nil)))))

(defn ask-markdown
  "An entry as Markdown, to read or to share."
  [e url max-code]
  (let [code (str (:code e))]
    (str "**Asked Claude** (" (:kind e) (when (:change e) ", changing the open one") " · " (:tier e) ") in Kairotic\n\n"
         "> " (str/replace (str (:request e)) #"\n" "\n> ") "\n\n"
         (when url (str "▶ [Open it in Kairotic](" url ")\n\n"))
         (when (seq code)
           (if (> (count code) max-code)
             (str "_The code (" (count code) " characters) is in the link._\n\n")
             (str "```clojure\n" code "\n```\n\n")))
         "<details><summary>How it went: " (:status e) "</summary>\n\n"
         (str/join "\n" (map #(str "- " %) (take 30 (:lines e))))
         "\n</details>\n")))

(defn render-ask-history! []
  (when-let [ol ($ "ask-hist-list")]
    (let [es (reverse (ask-entries))]
      (set! (.-textContent ($ "ask-hist-n")) (str "(" (count es) ")"))
      (set! (.-innerHTML ol)
            (apply str
                   (for [e es]
                     (str "<li data-ask=\"" (esc (:id e)) "\">"
                          "<div class=\"ah-top\">" (esc (:kind e)) " · " (esc (clojure.core/subs (str (:t e)) 0 16)) " · <span class=\"" (esc (:status e)) "\">" (esc (:status e)) "</span>"
                          (when (:work e) (str " · " (esc (:work e)))) "</div>"
                          "<div class=\"ah-q\">" (esc (ai/cut (:request e) 300)) "</div>"
                          "<div class=\"ah-acts\">"
                          (when (seq (:code e)) "<button class=\"act\" data-act=\"load\" title=\"Into the open work, as one event\">Load</button>")
                          "<button class=\"act\" data-act=\"copy\" title=\"As Markdown\">Copy</button>"
                          (when (seq (:code e)) "<button class=\"act\" data-act=\"share\" title=\"Opens a discussion already written in the Gallery of the Kairotic repository: you read it and publish it, under your own account\">Share on GitHub…</button>")
                          "<button class=\"act\" data-act=\"del\" title=\"Delete this entry\">✕</button>"
                          "</div></li>")))))))

(def share-repo "https://github.com/bonuoq/kairotic")

(.addEventListener ($ "ask-hist-list") "click"
  (fn [ev]
    (when-let [btn (.closest (.-target ev) "[data-act]")]
      (let [id (.getAttribute (.closest btn "[data-ask]") "data-ask")
            e (first (filter #(= id (:id %)) (ask-entries)))
            act (.getAttribute btn "data-act")]
        (when e
          (case act
            "load" (try
                     (if (= "component" (:kind e))
                       (let [src (str ";; written with Claude\n;; asked: " (str/replace (ai/cut (:request e) 300) #"\s+" " ") "\n" (:code e))]
                         (swap! cbox/trusted conj src)
                         (new-definition! src))
                       (apply-patch-code! (:code e)))
                     (catch :default x (repl-print! "err" (esc (str "; " (or (.-message x) x))))))
            "copy" (-> (ask-play-url e)
                       (.then (fn [u] (copy-text! (ask-markdown e u 20000))))
                       (.then (fn [ok] (set! (.-textContent btn) (if ok "Copied" "Not copied")))))
            "share" (let [w (js/window.open "about:blank" "_blank")]
                      ;; the window is opened at the click (a popup blocker allows it), then filled
                      (-> (ask-play-url e)
                          (.then (fn [u]
                                   (let [q (js/URLSearchParams.)]
                                     (.set q "category" "gallery")
                                     (.set q "labels" "gallery")
                                     (.set q "title" (ai/cut (str/replace (str (:request e)) #"\s+" " ") 90))
                                     (.set q "body" (ask-markdown e u 3500))
                                     (let [href (str share-repo "/discussions/new?" (.toString q))]
                                       (if w (set! (.. w -location -href) href) (js/window.open href "_blank"))))))))
            "del" (do (save-ask-entries! (vec (remove #(= id (:id %)) (ask-entries))))
                      (render-ask-history!))
            nil))))))

(.addEventListener ($ "ask-hist-export") "click"
  (fn [_]
    (let [text (str/join "\n" (map #(js/JSON.stringify (clj->js %)) (ask-entries)))
          a (js/document.createElement "a")]
      (set! (.-href a) (js/URL.createObjectURL (js/Blob. #js [text] #js {:type "application/x-ndjson"})))
      (set! (.-download a) "kairotic-claude-log.jsonl")
      (.click a))))

(.addEventListener ($ "ask-hist-clear") "click"
  (fn [_]
    (let [b ($ "ask-hist-clear")]
      (if (= "Sure?" (.-textContent b))
        (do (save-ask-entries! []) (set! (.-textContent b) "Clear") (render-ask-history!))
        (do (set! (.-textContent b) "Sure?") (js/setTimeout (fn [] (set! (.-textContent b) "Clear")) 3000))))))

(render-ask-history!)

(defn tutorials-ready []
  (js/Promise.
   (fn [res]
     (load-tutorials!)
     (if (sequential? @tutorials)
       (res @tutorials)
       (add-watch tutorials ::ready (fn [_ _ _ n] (when (sequential? n) (remove-watch tutorials ::ready) (res n))))))))

(defn start-from-url!
  "Opens what the address asks for (?code, ?src, ?tutorial & ?step, ?help); in an embed, a local work if nothing."
  []
  (when-let [l (url-param "lang")] (when (#{"es" "en"} l) (reset! lang (keyword l)) (render-lesson!) (render-help!)))
  (let [code (url-param "code") src (raw-param "src") ask (some-> (url-param "ask") str/trim not-empty) tut (url-param "tutorial") hc (url-param "help")
        step (js/parseInt (or (url-param "step") "1") 10)
        link-name (str (if (es?) "Enlace" "Link") (when (= embed-mode :present) " · release"))
        fallback (fn [e]
                   (when e (repl-print! "err" (esc (str "; " (or (.-message e) e)))))
                   (when (and embed-mode (nil? (:kind @work))) (open-work! :local "local" "Local"))
                   (present-what!))]
    (-> (cond
          (seq code) (.then ((.-kairoticUnpack js/window) code)
                            (fn [src] (open-link-work! link-name (reset! link-base (link-code src)))))
          ;; the code itself, readable (written by hand, or by Claude in a Notion page)
          (seq src) (.then (js/Promise.resolve nil) (fn [_] (open-link-work! link-name (reset! link-base (link-code src)))))
          (seq ask) (.then (js/Promise.resolve nil) (fn [_] (open-link-work! link-name "")))
          (seq tut) (.then (tutorials-ready)
                           (fn [_] (or (open-tutorial! tut) (throw (js/Error. (str "no tutorial " (pr-str tut)))))))
          (seq hc) (or (open-help-patch! hc) (js/Promise.reject (js/Error. (str "no help patch for " (pr-str hc)))))
          :else (js/Promise.resolve nil))
        (.then (fn [_]
                 (when (and @lesson (> step 1)) (lesson-go! (dec step)))
                 (when (and ask (= "link" (:id @work))) (setup-ask! ask @link-base))
                 (fallback nil)))
        (.catch fallback))))
