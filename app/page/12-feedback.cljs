;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 13 of 13: feedback
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── feedback (0.1.0-alpha) ─────────────────────────
;; A bug, an idea or a question becomes a GitHub issue (or a Q&A discussion) written for you: the page
;; only opens GitHub with the text filled in; it is published there, under your own account, or not.
;; What is added is chosen: the patch on screen (as a link), recent errors, version and browser. The
;; draft stays in this browser until it is written.

(def fb-repo "https://github.com/bonuoq/kairotic")
(def fb-draft-key "kairotic.feedback-draft")

(js/window.addEventListener "error"
  (fn [e] (swap! recent-errors (fn [es] (vec (take-last 10 (conj es (str "page: " (or (.-message e) e)))))))))

(defn fb-kind []
  (keyword (.-value (.querySelector js/document "input[name=fb-kind]:checked"))))

(def fb-templates
  {:bug "What I did:\n\n\nWhat I expected:\n\n\nWhat happened:\n"
   :idea "What I would like to do:\n\n\nWhy (what it would let me make, play or teach):\n"
   :question ""})

(defn fb-edition []
  (cond (.-claude js/window) "claude.ai"
        embed-mode (str "embed (" (name embed-mode) ")")
        (pages?) "Kairotic Pages"
        :else "local"))

(defn fb-body
  "Promise of the text of the issue, with what was chosen."
  []
  (let [text (str/trim (.-value ($ "fb-text")))
        patch? (and (.-checked ($ "fb-patch")) (seq (:boxes (work-patch))))
        errs (when (.-checked ($ "fb-errors")) (seq @recent-errors))
        env? (.-checked ($ "fb-env"))]
    (-> (if patch?
          (.then ((.-kairoticPack js/window) (patch->code (work-patch))) (fn [z] (url-with [["code" z]] nil)))
          (js/Promise.resolve nil))
        (.then (fn [link]
                 (let [link (when (and link (< (count link) 5000)) link)]
                   (str text "\n"
                        (when link (str "\n**The patch:** [open it in Kairotic](" link ")\n"))
                        (when (and patch? (nil? link)) "\n_The patch is too large for a link: paste its code (Code tab) here._\n")
                        (when errs (str "\n<details><summary>Recent errors</summary>\n\n```\n" (str/join "\n" (map #(ai/cut % 300) errs)) "\n```\n</details>\n"))
                        (when env? (str "\n---\nKairotic " version " · " (fb-edition) " · " (.-userAgent js/navigator) "\n")))))))))

(defn fb-save-draft! []
  (try (.setItem js/localStorage fb-draft-key
                 (js/JSON.stringify #js {:kind (name (fb-kind)) :title (.-value ($ "fb-title")) :text (.-value ($ "fb-text"))}))
       (catch :default _ nil)))

(defn render-fb-preview! []
  (set! (.-textContent ($ "fb-errn")) (str "(" (count @recent-errors) ")"))
  (set! (.-placeholder ($ "fb-text"))
        (case (fb-kind)
          :bug "What you did, what you expected, what happened. The steps to make it happen again help most."
          :idea "What you would like Kairotic to do, and what for."
          "Your question."))
  (set! (.-textContent ($ "fb-go")) (if (= :question (fb-kind)) "Ask it on GitHub…" "Write it on GitHub…"))
  (.then (fb-body) (fn [b] (set! (.-textContent ($ "fb-preview")) b))))

(defn fb-url [title body]
  (let [q (js/URLSearchParams.) kind (fb-kind)]
    (.set q "title" (if (seq title) title (case kind :bug "Bug: " :idea "Idea: " "Question: ")))
    (.set q "body" body)
    (if (= kind :question)
      (do (.set q "category" "q-a") (str fb-repo "/discussions/new?" (.toString q)))
      (do (.set q "labels" (if (= kind :bug) "bug" "enhancement")) (str fb-repo "/issues/new?" (.toString q))))))

(.addEventListener ($ "fb-go") "click"
  (fn [_]
    (let [w (js/window.open "about:blank" "_blank") title (str/trim (.-value ($ "fb-title")))]
      ;; the window opens at the click (popup blockers allow it), then gets its address
      (.then (fb-body)
             (fn [b] (let [u (fb-url title b)] (if w (set! (.. w -location -href) u) (js/window.open u "_blank")))
               ;; written: the draft starts again
               (set! (.-value ($ "fb-title")) "")
               (set! (.-value ($ "fb-text")) (get fb-templates (fb-kind)))
               (fb-save-draft!))))))

(.addEventListener ($ "fb-copy") "click"
  (fn [_]
    (-> (fb-body)
        (.then (fn [b] (copy-text! (str "# " (.-value ($ "fb-title")) "\n\n" b))))
        (.then (fn [ok] (set! (.-textContent ($ "fb-copy")) (if ok "Copied" "Not copied"))
                 (js/setTimeout (fn [] (set! (.-textContent ($ "fb-copy")) "Copy")) 1500))))))

(.addEventListener (.querySelector js/document ".fb-kind") "change"
  (fn [_]
    ;; an untouched template follows the kind
    (when (or (str/blank? (.-value ($ "fb-text"))) (some #(= (.-value ($ "fb-text")) %) (vals fb-templates)))
      (set! (.-value ($ "fb-text")) (get fb-templates (fb-kind))))
    (fb-save-draft!)
    (render-fb-preview!)))

(doseq [id ["fb-title" "fb-text"]]
  (.addEventListener ($ id) "input" (fn [_] (fb-save-draft!))))
(doseq [id ["fb-text" "fb-patch" "fb-errors" "fb-env"]]
  (.addEventListener ($ id) "change" (fn [_] (render-fb-preview!))))

;; the open issues, read from GitHub's public API (where the page may reach it)
(defonce fb-issues (atom nil))

(defn render-fb-issues! []
  (let [is @fb-issues]
    (set! (.-innerHTML ($ "fb-list"))
          (cond
            (nil? is) "<li class=\"soft\">…</li>"
            (= :error is) (str "<li class=\"soft\">They could not be read from here: <a href=\"" fb-repo "/issues\" target=\"_blank\" rel=\"noopener\">see them on GitHub</a>.</li>")
            (empty? is) "<li class=\"soft\">None yet.</li>"
            :else (str (apply str (for [i is]
                                    (str "<li><a href=\"" (esc (:url i)) "\" target=\"_blank\" rel=\"noopener\">" (esc (:title i)) "</a>"
                                         (when (seq (:labels i)) (str "<span class=\"lb\">" (esc (str/join " · " (:labels i))) "</span>")) "</li>")))
                       "<li class=\"soft\"><a href=\"" fb-repo "/issues\" target=\"_blank\" rel=\"noopener\">all of them…</a></li>")))))

(defn load-fb-issues! []
  (when (or (nil? @fb-issues) (= :error @fb-issues))
    (-> (js/fetch "https://api.github.com/repos/bonuoq/kairotic/issues?state=open&per_page=20")
        (.then (fn [r] (if (.-ok r) (.json r) (throw (js/Error. (str (.-status r)))))))
        (.then (fn [a]
                 (reset! fb-issues
                         (vec (for [i (array-seq a) :when (nil? (.-pull_request i))]
                                {:title (.-title i) :url (.-html_url i)
                                 :labels (vec (for [l (array-seq (.-labels i))] (.-name l)))})))))
        (.catch (fn [_] (reset! fb-issues :error)))
        (.finally (fn [] (render-fb-issues!))))))

(.addEventListener ($ "tab-feedback") "click" (fn [_] (render-fb-preview!) (load-fb-issues!)))

;; the draft that was being written
(let [d (try (some-> (.getItem js/localStorage fb-draft-key) js/JSON.parse) (catch :default _ nil))]
  (when-let [k (some-> d .-kind)]
    (when-let [r (.querySelector js/document (str "input[name=fb-kind][value=" k "]"))] (set! (.-checked r) true)))
  (set! (.-value ($ "fb-title")) (or (some-> d .-title) ""))
  (set! (.-value ($ "fb-text")) (or (some-> d .-text) (get fb-templates (fb-kind)))))

(defn feedback
  "Opens the Feedback tab: (feedback), or with a title (feedback \"the score does not redraw\")."
  ([] (.click ($ "tab-feedback")) :feedback)
  ([title] (set! (.-value ($ "fb-title")) (str title)) (fb-save-draft!) (feedback)))
