;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 15 of 15: the code editor
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── the code editor (issue #8) ─────────────────────────
;; The code of a box (faust~, script, component, tree) is written in a window of its own, over the page:
;; it can be moved by its bar and resized by its corner, and it stays open while you play. Inside is
;; CodeMirror 6 (core/vendor/codemirror.mjs, bundled from core/vendor/codemirror/): line numbers, automatic
;; indentation, matching and closing brackets, structural editing for Clojure, search, and completion of
;; the names each language knows. Ctrl/⌘+Enter applies the code (one event of the history) and keeps the
;; window open, to go on; Esc or × closes it, asking first if something is not applied.
;; If the editor cannot be loaded, a plain text area does the same.

(defonce code-win (atom nil))   ; {:id :path :lang :ed :original :dirty :confirm}
(defonce cm-module (atom nil))  ; Promise of the bundle

(defn code-win-box
  "The box whose code is open in the editor (in the patch on screen), or nil."
  [] (when-let [w @code-win] (when (= (:path w) (cmd-path)) (:id w))))

(defn load-cm []
  (or @cm-module
      (reset! cm-module
              (-> ((.-kairoticImport js/window) "kairotic/vendor/codemirror.mjs")
                  (.catch (fn [e] (js/console.warn "code editor: a plain text area instead" e) nil))))))

;; ───── what completion offers, by language ─────

(def faust-words
  ["process" "import(\"stdfaust.lib\");" "declare" "with" "letrec" "environment" "hslider" "vslider" "nentry"
   "button" "checkbox" "hgroup" "vgroup" "tgroup" "hbargraph" "vbargraph" "attach" "mem" "min" "max" "abs"
   "os.osc" "os.sawtooth" "os.square" "os.triangle" "os.phasor" "os.lf_saw" "os.pulsetrain" "os.oscsin"
   "no.noise" "no.pink_noise" "fi.lowpass" "fi.highpass" "fi.resonlp" "fi.resonhp" "fi.resonbp" "fi.bandpass"
   "fi.dcblocker" "fi.zero" "fi.pole" "ve.moog_vcf" "ve.korg35LPF" "en.adsr" "en.ar" "en.asr" "en.adsre"
   "de.delay" "de.fdelay" "de.sdelay" "re.mono_freeverb" "re.stereo_freeverb" "re.zita_rev1_stereo"
   "ef.echo" "ef.cubicnl" "co.compressor_mono" "co.limiter_1176_R4_mono" "si.smoo" "si.smooth" "si.bus"
   "si.block" "ba.db2linear" "ba.linear2db" "ba.midikey2hz" "ba.hz2midikey" "ba.beat" "ba.pulse" "ba.if"
   "ba.selectn" "ma.SR" "ma.PI" "ma.EPSILON" "sp.panner" "pm.ks" "aa.tanh1"])

(def tree-words
  [":voice" ":measure" ":section" ":seq" ":par" ":piece" ":chord" ":note" ":rest" ":tuplet" ":rtm" ":shares"
   ":pitches" ":meter" ":groups" ":dur"
   ":pitch" ":tempo" ":key" ":dyn" ":defs" ":use" ":vel" ":ties"])

(def component-words
  [":class" ":doc" ":usage" ":license" ":io" ":args" ":receive" ":view" ":derive" ":draw" ":gesture"
   ":persist" ":size" ":audio" ":patch" ":params" ":model" ":state" ":value" ":inlet" ":out" ":show"
   ":effects" ":later" ":display"])

(defn ns-names
  "The public names of a namespace, written with a prefix (\"api/clamp\"), when this runtime knows them."
  [ns-sym prefix]
  (try (vec (sort (map (fn [s] (str prefix s)) (keys (ns-publics ns-sym))))) (catch :default _ [])))

(defn words-for [lang]
  (case lang
    "faust" faust-words
    "edn" tree-words
    "component" (vec (concat component-words (ns-names 'kairotic.api "api/") (ns-names 'clojure.core "")))
    "clojurescript" (vec (concat (ns-names 'clojure.core "") (ns-names 'clojure.string "str/")))
    []))

;; ───── the window ─────

(defn cw-el [] ($ "code-win"))

(defn cw-status!
  "The foot of the window: whether the code is applied, and how its compilation went."
  []
  (when-let [{:keys [id dirty gone lang]} @code-win]
    (when-let [el (.querySelector (cw-el) ".cw-foot")]
      (let [b (when-not gone (get-in (patch-in (root-patch) (:path @code-win)) [:boxes id]))
            r (when b (cbox/compiled lang (str (get-in b [:data :source]))))
            comp-st (case (:status r)
                      :ok (str "✓ " (or (get-in r [:info :summary]) "ready"))
                      :compiling "compiling…"
                      :error (str "✗ " (first (str/split-lines (str (:error r)))))
                      "")]
        (set! (.-className el) (str "cw-foot" (when (= :error (:status r)) " err")))
        (set! (.-textContent el)
              (cond gone "This box is not in the patch any more: copy what you need, then close."
                    dirty (str "edited · Ctrl/⌘+Enter applies" (when (seq comp-st) (str " · last applied: " comp-st)))
                    :else (str "applied" (when (seq comp-st) (str " · " comp-st)))))))))

(defn cw-text [] (when-let [w @code-win] (if (:ed w) (.getValue (:ed w)) (.-value (:ta w)))))

(defn wrap-path
  "A call made in the sub-patch `path`, written from the patch on screen: (inside :b5 …) for each step down."
  [path code]
  (let [here (cmd-path)]
    (when-not (= here (vec (take (count here) path)))
      (fail "That code belongs to a patch that is not on screen: go back to it to apply it."))
    (reduce (fn [c id] (str "(inside " id " " c ")")) code (reverse (drop (count here) path)))))

(defn apply-code! []
  (when-let [{:keys [id path original gone]} @code-win]
    (let [v (cw-text)]
      (cond
        gone nil
        (= v original) (do (swap! code-win assoc :dirty false) (cw-status!))
        (str/blank? v) (repl-print! "err" "; the code is empty: write something, or delete the box")
        :else (do (gesture! (wrap-path path (str "(code " id " " (pr-str v) ")")))
                  (swap! code-win assoc :original v :dirty false)
                  (cw-status!))))))

(defn close-code-win! []
  (when-let [w @code-win]
    (when-let [ed (:ed w)] (.destroy ed))
    (when-let [el (cw-el)] (.remove el))
    (reset! code-win nil)
    (render-scene (current))))

(defn ask-close! []
  (if (and (:dirty @code-win) (not (:gone @code-win)))
    (do (swap! code-win assoc :confirm true)
        (when-let [c (.querySelector (cw-el) ".cw-confirm")] (set! (.-hidden c) false)))
    (close-code-win!)))

(defn place-window!
  "Over the box, inside the window of the browser."
  [el id b]
  (let [r (when-let [g (.querySelector js/document (str "#scene .box[data-box=\"" (name id) "\"]"))] (.getBoundingClientRect g))
        vw (.-innerWidth js/window) vh (.-innerHeight js/window)
        w (min 620 (- vw 32)) h (min 420 (- vh 32))
        x (if r (.-left r) 40) y (if r (+ (.-top r) hdr) 80)]
    (set! (.. el -style -width) (str w "px"))
    (set! (.. el -style -height) (str h "px"))
    (set! (.. el -style -left) (str (max 16 (min x (- vw w 16))) "px"))
    (set! (.. el -style -top) (str (max 16 (min y (- vh h 16))) "px"))))

(defn drag-window!
  "The window moves with its bar."
  [el e]
  (when-not (.closest (.-target e) "button")
    (.preventDefault e)
    (let [x0 (.-clientX e) y0 (.-clientY e)
          l0 (.-offsetLeft el) t0 (.-offsetTop el)
          move (fn [ev]
                 (set! (.. el -style -left) (str (max 0 (min (- (.-innerWidth js/window) 80) (+ l0 (- (.-clientX ev) x0)))) "px"))
                 (set! (.. el -style -top) (str (max 0 (min (- (.-innerHeight js/window) 40) (+ t0 (- (.-clientY ev) y0)))) "px")))
          up (fn up [_]
               (.removeEventListener js/window "pointermove" move)
               (.removeEventListener js/window "pointerup" up))]
      (.addEventListener js/window "pointermove" move)
      (.addEventListener js/window "pointerup" up))))

(defn window-shell [id b lang]
  (let [el (js/document.createElement "div")]
    (set! (.-id el) "code-win")
    (set! (.-className el) "code-win")
    (.setAttribute el "role" "dialog")
    (.setAttribute el "aria-label" (str "Code of " (name id)))
    (set! (.-innerHTML el)
          (str "<div class=\"cw-bar\"><span class=\"cw-title\"><b>" (esc (name id)) "</b> " (esc (:text b)) "</span>"
               "<span class=\"cw-lang\">" (esc lang) "</span>"
               "<button class=\"act primary\" data-cw=\"apply\" title=\"Apply the code (Ctrl/⌘+Enter)\">Apply</button>"
               "<button class=\"act cw-x\" data-cw=\"close\" title=\"Close (Esc)\" aria-label=\"Close\">×</button></div>"
               "<div class=\"cw-confirm\" hidden>Something is not applied. "
               "<button class=\"act primary\" data-cw=\"apply-close\">Apply and close</button>"
               "<button class=\"act\" data-cw=\"discard\">Discard</button>"
               "<button class=\"act\" data-cw=\"stay\">Keep editing</button></div>"
               "<div class=\"cw-body\"></div><div class=\"cw-foot\"></div>"))
    (.addEventListener (.querySelector el ".cw-bar") "pointerdown" (fn [e] (drag-window! el e)))
    (.addEventListener el "click"
      (fn [e]
        (case (some-> (.closest (.-target e) "[data-cw]") (.getAttribute "data-cw"))
          "apply" (apply-code!)
          "close" (ask-close!)
          "apply-close" (do (apply-code!) (when-not (:dirty @code-win) (close-code-win!)))
          "discard" (close-code-win!)
          "stay" (do (swap! code-win assoc :confirm false)
                     (set! (.-hidden (.querySelector el ".cw-confirm")) true)
                     (some-> (:ed @code-win) .focus))
          nil)))
    ;; keys typed in the editor are the editor's (space, Delete, ⌘A… do not reach the patch)
    (.addEventListener el "keydown" (fn [e] (.stopPropagation e)))
    el))

(defn textarea-editor!
  "Without CodeMirror: a plain text area with the same keys."
  [body text]
  (let [ta (js/document.createElement "textarea")]
    (set! (.-className ta) "cw-plain")
    (set! (.-spellcheck ta) false)
    (set! (.-value ta) text)
    (.appendChild body ta)
    (.addEventListener ta "input" (fn [_] (swap! code-win assoc :dirty (not= (.-value ta) (:original @code-win))) (cw-status!)))
    (.addEventListener ta "keydown"
      (fn [e]
        (let [k (.-key e)]
          (cond
            (and (= k "Enter") (or (.-ctrlKey e) (.-metaKey e))) (do (.preventDefault e) (apply-code!))
            (= k "Escape") (do (.preventDefault e) (ask-close!))
            (= k "Tab") (do (.preventDefault e)
                            (let [a (.-selectionStart ta) z (.-selectionEnd ta) v (.-value ta)]
                              (set! (.-value ta) (str (subs v 0 a) "  " (subs v z)))
                              (set! (.-selectionStart ta) (+ a 2))
                              (set! (.-selectionEnd ta) (+ a 2))))))))
    (.focus ta)
    ta))

(defn open-code-editor!
  "Opens the code of a box in the editor window (or brings it back if it is the one open)."
  [id]
  (let [b (get-in (current) [:boxes id]) d (box-def b)]
    (cond
      (nil? b) nil
      (= id (code-win-box)) (some-> (:ed @code-win) .focus)
      (and @code-win (:dirty @code-win) (not (:gone @code-win)))
      (do (ask-close!) (repl-print! "out" "; first apply or discard the code that is open"))
      :else
      (do
        (close-code-win!)
        (let [lang (str (:language d))
              original (str (get-in b [:data :source]))
              text (if (str/blank? original) (or (:template d) "") original)
              el (window-shell id b lang)
              body (.querySelector el ".cw-body")]
          (.appendChild (.-body js/document) el)
          (place-window! el id b)
          (reset! code-win {:id id :path (cmd-path) :lang lang :original original :dirty (not= text original)})
          (cw-status!)
          (render-scene (current))
          (.then (load-cm)
                 (fn [cm]
                   (when (= (:id @code-win) id)
                     (if-let [create (and cm (.-createEditor cm))]
                       (let [ed (create #js {:parent body :doc text :language lang :words (clj->js (words-for lang))
                                             :onApply (fn [_] (apply-code!))
                                             :onCancel (fn [] (ask-close!))
                                             :onChange (fn [v] (swap! code-win assoc :dirty (not= v (:original @code-win))) (cw-status!))})]
                         (swap! code-win assoc :ed ed)
                         (.focus ed))
                       (swap! code-win assoc :ta (textarea-editor! body text)))))))))))

(defn refresh-code-win!
  "After the patch changed: if the box is gone, say so; if its code changed elsewhere and nothing is
   edited here, show the new code."
  []
  (when-let [{:keys [id path ed ta dirty original]} @code-win]
    (let [b (get-in (patch-in (root-patch) path) [:boxes id])]
      (if (nil? b)
        (swap! code-win assoc :gone true)
        (let [src (str (get-in b [:data :source]))]
          (swap! code-win assoc :gone false)
          (when (and (not dirty) (not= src original) (not (str/blank? src)))
            (swap! code-win assoc :original src)
            (cond ed (.setValue ed src) ta (set! (.-value ta) src))
            (swap! code-win assoc :dirty false))))
      (cw-status!))))

(add-watch hist ::code-win (fn [_ _ _ _] (refresh-code-win!)))
(add-watch perf ::code-win (fn [_ _ _ _] (refresh-code-win!)))
(add-watch world ::code-win (fn [_ _ _ _] (refresh-code-win!)))

;; ───────────────────────── the Code tab and the REPL line ─────────────────────────
;; The same editor (CodeMirror, Clojure) replaces the text area of the Code tab and the input of the REPL
;; once the bundle is loaded, a moment after the page starts. In the Code tab, Ctrl/⌘+Enter runs the code.
;; In the REPL, Enter evaluates when the brackets are closed (otherwise it starts a new line; ⇧+Enter
;; always does), and ↑ ↓ on the first or last line bring back what was written before.

(defn command-words
  "The commands of the page that have a doc string, for completion in the Code tab and the REPL."
  []
  (try (vec (sort (keep (fn [[s v]] (when (:doc (meta v)) (str s))) (ns-publics 'user))))
       (catch :default _ [])))

(defn balanced?
  "Whether every bracket of a piece of code is closed (outside strings, comments and characters)."
  [s]
  (loop [cs (seq s) depth 0 in-str false]
    (if-let [c (first cs)]
      (cond
        in-str (case c "\\" (recur (nnext cs) depth true) "\"" (recur (next cs) depth false) (recur (next cs) depth true))
        (= c "\"") (recur (next cs) depth true)
        (= c "\\") (recur (nnext cs) depth false)
        (= c ";") (recur (drop-while (fn [x] (not= x "\n")) cs) depth false)
        (#{"(" "[" "{"} c) (recur (next cs) (inc depth) false)
        (#{")" "]" "}"} c) (recur (next cs) (dec depth) false)
        :else (recur (next cs) depth false))
      (and (<= depth 0) (not in-str)))))

(defn host-for!
  "A place for an editor next to element `el`, which hides: keys typed there stay there."
  [el cls]
  (let [h (js/document.createElement "div")]
    (set! (.-className h) cls)
    (.insertBefore (.-parentNode el) h el)
    (set! (.-hidden el) true)
    (.addEventListener h "keydown" (fn [e] (.stopPropagation e)))
    h))

(defn upgrade-code-tab! [cm]
  (when-not @code-ed
    (let [ta ($ "code") host (host-for! ta "code-host")
          ed ((.-createEditor cm)
              #js {:parent host :doc (.-value ta) :language "clojurescript" :words (clj->js (command-words))
                   :onApply (fn [_] (run-panel-code!))
                   :onChange (fn [_] (when-not (:dirty @ui) (swap! ui assoc :dirty true) (render-code (current))))})]
      (.setAttribute (.-contentDOM (.-view ed)) "aria-label" "Patch code")
      (reset! code-ed ed))))

(defn upgrade-data-view!
  "The Data view of the Code tab: the same editor, read-only, with EDN colours, folding and search."
  [cm]
  (when-not @data-ed
    (let [pre ($ "edn")
          host (host-for! pre "data-host")
          ed ((.-createEditor cm) #js {:parent host :doc (.-textContent pre) :language "edn" :readOnly true})]
      (.setAttribute (.-contentDOM (.-view ed)) "aria-label" "The work as data (EDN)")
      (reset! data-ed ed))))

(defn upgrade-repl! [cm]
  (when-not @repl-ed
    (let [inp ($ "repl-in") host (host-for! inp "repl-host")
          ed (atom nil)
          free? (fn [] (not (.completing @ed)))]
      (reset! ed ((.-createEditor cm)
                  #js {:parent host :doc (.-value inp) :language "clojurescript" :gutter false
                       :placeholder (.-placeholder inp)
                       :words (clj->js (concat (command-words) (ns-names 'clojure.core "")))
                       :keys #js [#js {:key "Enter" :run (fn [] (when (and (free?) (balanced? (.getValue @ed))) (repl-submit!) true))}
                                  #js {:key "Shift-Enter" :run (fn [] (.newline @ed) true)}
                                  #js {:key "ArrowUp" :run (fn [] (boolean (and (free?) (= 1 (.cursorLine @ed)) (repl-recall! true))))}
                                  #js {:key "ArrowDown" :run (fn [] (boolean (and (free?) (= (.cursorLine @ed) (.lineCount @ed)) (repl-recall! false))))}]}))
      (.setAttribute (.-contentDOM (.-view @ed)) "aria-label" "REPL")
      (when-let [l (.querySelector js/document "label[for=repl-in]")]
        (.addEventListener l "click" (fn [_] (.focus @ed))))
      (reset! repl-ed @ed))))

;; a moment after the page starts (not in an embed, which shows neither)
(when-not embed-mode
  (js/setTimeout
   (fn [] (.then (load-cm) (fn [cm] (when cm (upgrade-code-tab! cm) (upgrade-data-view! cm) (upgrade-repl! cm)
                         ;; the hosts take the place of what was shown: show again the view that was chosen
                         (show-code-view! (or (:code-view @ui) :calls))))))
   300))
