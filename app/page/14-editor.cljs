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
;; The same window opens the data of a canvas, freqt or score as EDN (discussion #30: { } in its header,
;; or a double-click on the right of it): applying it writes what changed as one event of the history.
;; The code of a faust~ also opens as a patch of Faust's own elements, beside it (discussion #115, Study
;; 31, @kairotic/faust-units): editing the patch rewrites the code in the editor, editing the code redraws
;; the patch, and applying is still one event. The window opens beside the box, so the parameters the box
;; shows in the patch stay in sight while you play them.

(defonce code-win (atom nil))   ; {:id :path :lang :data? :ed :original :dirty :confirm :error :fv}
(defonce cm-module (atom nil))  ; Promise of the bundle

(defn open-definition
  "[path id] of the component box open in the code window, or nil."
  [] (when-let [w @code-win] (when (= "component" (:lang w)) [(:path w) (:id w)])))

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

(def buffer-words
  (into [":strokes" ":gx" ":gy" ":ax" ":step" ":cycles" ":name" ":ref" ":cents" ":x" ":y" ":lo" ":hi" ":log"]
        (map pr-str (sort (keys cv/tunings)))))

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
    "pbind" ["#pat/seq" "#pat/choose" "#pat/shuffle" "#pat/white" "#pat/walk" "#pat/series" "#pat/hold" "#pat/chord"
             ":degree" ":note" ":freq" ":dur" ":legato" ":sustain" ":amp" ":scale" ":root" ":octave" ":transpose" ":rest"]
    "pattern" (vec (concat (map str kairotic.patterns/code-names) (ns-names 'clojure.core "")))
    []))

;; ───── the window ─────

(defn cw-el [] ($ "code-win"))

(defn cw-status!
  "The foot of the window: whether the code is applied, and how its compilation went."
  []
  (when-let [{:keys [id dirty gone lang data? error]} @code-win]
    (when-let [el (.querySelector (cw-el) ".cw-foot")]
      (let [b (when-not gone (get-in (patch-in (root-patch) (:path @code-win)) [:boxes id]))
            r (cond error {:status :error :error error}
                    (and b (not data?)) (cbox/compiled lang (str (get-in b [:data :source]))))
            comp-st (case (:status r)
                      :ok (str "✓ " (or (get-in r [:info :summary]) "ready"))
                      :compiling "compiling…"
                      :error (str "✗ " (first (str/split-lines (str (:error r)))))
                      "")]
        (set! (.-className el) (str "cw-foot" (when (= :error (:status r)) " err")))
        (set! (.-textContent el)
              (cond gone (if (= "component" lang)
                           "This component is not in the work any more: copy what you need, then close."
                           "This box is not in the patch any more: copy what you need, then close.")
                    error (str "✗ " (first (str/split-lines (str error))))
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
  (when-let [{:keys [id path original gone data?]} @code-win]
    (let [v (cw-text)]
      (cond
        gone nil
        (= v original) (do (swap! code-win assoc :dirty false :error nil) (cw-status!))
        (str/blank? v) (repl-print! "err" "; the code is empty: write something, or delete the box")
        :else (let [before @recent-errors
                    _ (gesture! (wrap-path path (str "(code " id " " (pr-str v) ")")))
                    err (when-not (identical? before @recent-errors) (last @recent-errors))]
                (if err
                  ;; what cannot be read is not applied: it stays here, edited, saying what is wrong
                  (swap! code-win assoc :error (str "not applied: " err))
                  (swap! code-win assoc :original v :dirty false :error nil))
                (cw-status!))))))

(defn close-code-win! []
  (when-let [w @code-win]
    (when-let [fv (:fv w)] (.destroy fv))
    (when-let [c (:rcp w)] (.abort c))
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
  "Over the box, inside the window of the browser; a wide one (a faust~ with its patch) beside the box,
   so that what the box shows in the patch (its parameters) stays in sight."
  ([el id b] (place-window! el id b false))
  ([el id b wide?]
   (let [r (when-let [g (.querySelector js/document (str "#scene .box[data-box=\"" (name id) "\"]"))] (.getBoundingClientRect g))
         vw (.-innerWidth js/window) vh (.-innerHeight js/window)
         ;; a wide one goes where it covers nothing of the box: beside it (on the side with more room, as
         ;; wide as that room) if a side has 560 px, else below or above it if there are 280, else beside
         ;; it if a side has 400; and over it as the others only when nothing else fits
         right-room (when r (- vw 16 (.-right r) 12)) left-room (when r (- (.-left r) 12 16))
         below-room (when r (- vh 16 (.-bottom r) 12)) above-room (when r (- (.-top r) 12 16))
         side-room (when r (max right-room left-room)) vert-room (when r (max below-room above-room))
         place (when (and wide? r)
                 (cond (>= side-room 560) (if (>= right-room left-room) :right :left)
                       (>= vert-room 280) (if (>= below-room above-room) :below :above)
                       (>= side-room 400) (if (>= right-room left-room) :right :left)))
         w (case place
             :right (min 1040 right-room) :left (min 1040 left-room)
             (min (if wide? 1040 620) (- vw 32)))
         h (case place
             :below (min 520 below-room) :above (min 520 above-room)
             (min (if wide? 520 420) (- vh 32)))
         [x y] (case place
                 :right [(+ (.-right r) 12) (.-top r)]
                 :left [(- (.-left r) 12 w) (.-top r)]
                 :below [(.-left r) (+ (.-bottom r) 12)]
                 :above [(.-left r) (- (.-top r) 12 h)]
                 [(if r (.-left r) 40) (if r (+ (.-top r) hdr) 80)])]
     (set! (.. el -style -width) (str w "px"))
     (set! (.. el -style -height) (str h "px"))
     (set! (.. el -style -left) (str (max 16 (min x (- vw w 16))) "px"))
     (set! (.. el -style -top) (str (max 16 (min y (- vh h 16))) "px")))))

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

(declare toggle-patch-view! toggle-recipe! find-recipe-click! find-recipe! play-recipe!)

(defn window-shell [id b lang]
  (let [el (js/document.createElement "div")]
    (set! (.-id el) "code-win")
    (set! (.-className el) "code-win")
    (.setAttribute el "role" "dialog")
    (.setAttribute el "aria-label" (str "Code of " (name id)))
    (set! (.-innerHTML el)
          (str "<div class=\"cw-bar\"><span class=\"cw-title\"><b>" (esc (name id)) "</b> "
               (esc (if (definition? b)
                      (let [c (get-in (cbox/compiled "component" (str (get-in b [:data :source]))) [:info :class])]
                        (str "component" (when c (str " · " c))))
                      (:text b)))
               "</span>"
               "<span class=\"cw-lang\">" (esc lang) "</span>"
               (when (= lang "faust")
                 (str "<button class=\"act cw-pv\" data-cw=\"patch\" aria-pressed=\"" (not (false? (:faust-patch? @ui)))
                      "\" title=\"Show or hide its patch: the code as Faust's own elements\">Patch</button>"
                      "<button class=\"act cw-pv\" data-cw=\"recipe\" aria-pressed=\"false\""
                      " title=\"Find the values of its sliders that sound closest to a sound: a recipe\">Recipe</button>"))
               "<button class=\"act primary\" data-cw=\"apply\" title=\"Apply the code (Ctrl/⌘+Enter)\">Apply</button>"
               "<button class=\"act cw-x\" data-cw=\"close\" title=\"Close (Esc)\" aria-label=\"Close\">×</button></div>"
               "<div class=\"cw-confirm\" hidden>Something is not applied. "
               "<button class=\"act primary\" data-cw=\"apply-close\">Apply and close</button>"
               "<button class=\"act\" data-cw=\"discard\">Discard</button>"
               "<button class=\"act\" data-cw=\"stay\">Keep editing</button></div>"
               (when (= lang "faust")
                 (str "<div class=\"cw-rcp\" hidden><label>Sliders that sound like <select class=\"rcp-src\"></select></label>"
                      "<select class=\"rcp-len\" title=\"How long it listens\"><option value=\"quick\">quick</option>"
                      "<option value=\"careful\">careful</option></select>"
                      "<button class=\"act primary\" data-cw=\"find\">Find</button>"
                      "<span class=\"rcp-st\" aria-live=\"polite\"></span>"
                      "<button class=\"act rcp-play\" data-cw=\"play-target\" hidden title=\"The sound it listened to (its first second)\">▶ sound</button>"
                      "<button class=\"act rcp-play\" data-cw=\"play-found\" hidden title=\"The code at the values found\">▶ found</button>"
                      "<input type=\"file\" accept=\"audio/*\" class=\"rcp-file\" hidden></div>"))
               "<div class=\"cw-body\"></div><div class=\"cw-foot\"></div>"))
    (.addEventListener (.querySelector el ".cw-bar") "pointerdown" (fn [e] (drag-window! el e)))
    (.addEventListener el "click"
      (fn [e]
        (case (some-> (.closest (.-target e) "[data-cw]") (.getAttribute "data-cw"))
          "apply" (apply-code!)
          "patch" (toggle-patch-view!)
          "recipe" (toggle-recipe!)
          "find" (find-recipe-click!)
          "play-target" (play-recipe! :target)
          "play-found" (play-recipe! :found)
          "close" (ask-close!)
          "apply-close" (do (apply-code!) (when-not (:dirty @code-win) (close-code-win!)))
          "discard" (close-code-win!)
          "stay" (do (swap! code-win assoc :confirm false)
                     (set! (.-hidden (.querySelector el ".cw-confirm")) true)
                     (some-> (:ed @code-win) .focus))
          nil)))
    (when-let [f (.querySelector el ".rcp-file")]
      (.addEventListener f "change"
        (fn [_] (when-let [file (aget (.-files f) 0)]
                  (set! (.-value f) "")
                  (find-recipe! (.then (.arrayBuffer file) snd/decode) (.-name file))))))
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
    (.addEventListener ta "input" (fn [_] (swap! code-win assoc :dirty (not= (.-value ta) (:original @code-win)) :error nil) (cw-status!)
                                    (when-let [fv (:fv @code-win)] (.setCode fv (.-value ta)))))
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

(declare open-code-editor-at!)

;; ───── the patch of a faust~ (@kairotic/faust-units) ─────

(defn set-editor-text!
  "Code the patch view wrote, into the editor: edited, not applied yet."
  [v]
  (when-let [{:keys [ed ta]} @code-win]
    (cond ed (.setValue ed v) ta (set! (.-value ta) v))
    (swap! code-win assoc :dirty (not= v (:original @code-win)) :error nil)
    (cw-status!)))

(defn mount-faust-view!
  "Draws the patch of the faust~ open in the window, in `pane`, once its module is loaded."
  [id pane text]
  (-> (api/import-module (lib/module-origins "@kairotic/faust-units" "view.mjs"))
      (.then (fn [m]
               (when (and @code-win (= id (:id @code-win)) (nil? (:fv @code-win)))
                 (let [w @code-win
                       fv ((.-mount m) pane #js {:code (if (or (:ed w) (:ta w)) (cw-text) text)
                                                 :onCode (fn [c] (set-editor-text! c))
                                                 :loadFaust (fn [] (kairotic.faust/load))})]
                   (swap! code-win assoc :fv fv)))))
      (.catch (fn [e]
                (set! (.-innerHTML pane) (str "<p class=\"cw-pv-err\">The patch could not be loaded: " (esc (or (.-message e) e)) "</p>"))))))

(defn toggle-patch-view!
  "Shows or hides the patch beside the code of a faust~ (remembered for the next ones)."
  []
  (when-let [body (some-> (cw-el) (.querySelector ".cw-body.split"))]
    (let [show? (.contains (.-classList body) "nopatch")]
      (.toggle (.-classList body) "nopatch" (not show?))
      (swap! ui assoc :faust-patch? show?)
      (some-> (cw-el) (.querySelector "[data-cw=patch]") (.setAttribute "aria-pressed" (str show?))))))

;; ───── the recipe of a faust~ (discussion #114, Study 35, @kairotic/faust-units) ─────
;; The values of the sliders of the code in the editor that sound closest to a sound: the sound of a
;; sample box of this patch, or a file. The code is compiled and played offline, a note of a second (a
;; gate button, if it has one, held for 0.65 s), many times: a few random settings first, then a search
;; that listens as features~ does (Meyda), the pitch heard apart (YIN, as pitch~) and held. What it finds
;; is written in the editor, the sliders starting at those values: edited, not applied, so applying it is
;; one event of the history and the box keeps its parameters in sight.

(def recipe-meyda "npm:meyda@5.6.3/dist/web/meyda.min.js")
(def recipe-lengths {"quick" {:bank 32 :budget 160} "careful" {:bank 64 :budget 400}})
(defonce recipe-sounds (atom nil))   ; {:target Float32Array :found Float32Array} of the last search

(defn rcp-el [sel] (some-> (cw-el) (.querySelector (str ".cw-rcp " sel))))

(defn rcp-status! [text & [err?]]
  (when-let [el (rcp-el ".rcp-st")]
    (set! (.-textContent el) text)
    (set! (.-className el) (str "rcp-st" (when err? " err")))))

(defn recipe-sources
  "The sample boxes with a sound in the patch of the code window: [[id seconds] …], in the order of their ids."
  []
  (when-let [{:keys [path]} @code-win]
    (->> (:boxes (patch-in (root-patch) path))
         (filter (fn [[_ b]] (and (= "sample" (klass (:text b))) (snd/sample? (:data b)))))
         (map (fn [[id b]] [id (snd/seconds (:data b))]))
         (sort-by (fn [[id _]] (js/parseInt (subs (name id) 1) 10))))))

(defn fill-recipe-sources! []
  (when-let [sel (rcp-el ".rcp-src")]
    (let [was (.-value sel)]
      (set! (.-innerHTML sel)
            (str (str/join (for [[id secs] (recipe-sources)]
                             (str "<option value=\"" (esc (name id)) "\">" (esc (name id)) " · "
                                  (.toFixed secs 1) " s</option>")))
                 "<option value=\"file\">a sound file…</option>"))
      (when (some #(= was (.-value %)) (array-seq (.-options sel))) (set! (.-value sel) was)))))

(defn toggle-recipe!
  "Shows or hides the recipe's line under the bar of a faust~'s window."
  []
  (when-let [p (some-> (cw-el) (.querySelector ".cw-rcp"))]
    (let [show? (.-hidden p)]
      (set! (.-hidden p) (not show?))
      (when show? (fill-recipe-sources!))
      (some-> (cw-el) (.querySelector "[data-cw=recipe]") (.setAttribute "aria-pressed" (str show?))))))

(defn find-recipe-click!
  "Find: from the sound chosen (a file asks for it first); Stop while it listens."
  []
  (if-let [c (:rcp @code-win)]
    (.abort c)
    (let [v (some-> (rcp-el ".rcp-src") .-value)]
      (cond
        (or (nil? v) (= v "file")) (some-> (rcp-el ".rcp-file") .click)
        :else (let [b (get-in (patch-in (root-patch) (:path @code-win)) [:boxes (keyword v)])]
                (if (snd/sample? (:data b))
                  (find-recipe! (snd/sound-for (:data b)) v)
                  (rcp-status! (str v " has no sound any more") true)))))))

(defn find-recipe!
  "Listens for the recipe of the code in the editor, the target being the promise of a sound ({:sr :chans})."
  [sound label]
  (when-let [{:keys [id path]} @code-win]
    (let [ctl (js/AbortController.)
          code (cw-text)
          {:keys [bank budget]} (get recipe-lengths (some-> (rcp-el ".rcp-len") .-value) (get recipe-lengths "quick"))
          mine? (fn [] (and @code-win (= id (:id @code-win)) (= path (:path @code-win)) (identical? ctl (:rcp @code-win))))
          btn (rcp-el "[data-cw=find]")]
      (swap! code-win assoc :rcp ctl)
      (when btn (set! (.-textContent btn) "Stop"))
      (doseq [b (array-seq (.querySelectorAll (cw-el) ".rcp-play"))] (set! (.-hidden b) true))
      (rcp-status! (str "loading what listens to " label "…"))
      (-> (js/Promise.all #js [(api/import-module (lib/module-origins "@kairotic/faust-units" "recipe.mjs"))
                               (kairotic.faust/load)
                               (api/load-script recipe-meyda)
                               sound])
          (.then (fn [[m fx _ s]]
                   (when-not (:chans s) (throw (js/Error. (str "the sound of " label " is not in this browser"))))
                   (rcp-status! "compiling…")
                   (.find m #js {:faust fx :code code :Meyda (.-Meyda js/window)
                                 :sound #js {:sr (:sr s) :chans (:chans s)}
                                 :bank bank :budget budget :signal (.-signal ctl)
                                 :onProgress (fn [phase done total best]
                                               (when (mine?)
                                                 (rcp-status! (if (= phase "bank")
                                                                (str "listening to random settings " done "/" total)
                                                                (str "searching " done "/" total " · distance " (.toFixed best 2))))))})))
          (.then (fn [r]
                   (when (mine?)
                     (reset! recipe-sounds {:target (.-target r) :found (.-y r)})
                     (doseq [b (array-seq (.querySelectorAll (cw-el) ".rcp-play"))] (set! (.-hidden b) false))
                     (let [p (.-pitch r)
                           what (str "distance " (.toFixed (.-fx r) 2) " (the nearest random setting: " (.toFixed (.-nearestFx r) 2) ")"
                                     (when (some? p) (str " · pitch " (api/midi-name (js/Math.round p)))))]
                       (if (= (cw-text) code)
                         (do (set-editor-text! (.-code r))
                             (when-let [fv (:fv @code-win)] (.setCode fv (.-code r)))
                             (rcp-status! (str "found: " what " · in the code, Ctrl/⌘+Enter applies it")))
                         (rcp-status! (str "found: " what ", but the code changed meanwhile: not written") true))))))
          (.catch (fn [e]
                    (when (mine?)
                      (if (= "AbortError" (.-name e))
                        (rcp-status! "stopped")
                        (rcp-status! (str "✗ " (or (.-message e) e)) true)))))
          (.finally (fn []
                      (when (mine?)
                        (swap! code-win dissoc :rcp)
                        (when btn (set! (.-textContent btn) "Find")))))))))

(defn play-recipe!
  "Plays the sound the last search listened to (:target) or what it found (:found), once."
  [which]
  (when-let [y (get @recipe-sounds which)]
    (let [ac (eng/ctx) buf (.createBuffer ac 1 (.-length y) 44100) src (.createBufferSource ac)]
      (.copyToChannel buf y 0)
      (set! (.-buffer src) buf)
      (.connect src (.-destination ac))
      (.then (.resume ac) (fn [_] (.start src))))))

(defn open-code-editor!
  "Opens the code of a box in the editor window (or brings it back if it is the one open)."
  [id] (open-code-editor-at! (cmd-path) id))

(defn open-code-editor-at!
  "Opens the code of box id of the sub-patch at path (from the patch the work starts at) in the editor
   window: a component box is not in the patch, so the Components tab opens it this way."
  [path id]
  (let [path (vec path) b (get-in (patch-in (root-patch) path) [:boxes id]) d (box-def b)]
    (cond
      (nil? b) nil
      (and @code-win (= id (:id @code-win)) (= path (:path @code-win))) (some-> (:ed @code-win) .focus)
      (and @code-win (:dirty @code-win) (not (:gone @code-win)))
      (do (ask-close!) (repl-print! "out" "; first apply or discard the code that is open"))
      :else
      (do
        (close-code-win!)
        (let [data? (fn? (:source (comp/model-of b)))
              lang (if data? "edn" (str (:language d)))
              original (str (comp/source-of b))
              text (if (and (not data?) (str/blank? original)) (or (:template d) "") original)
              el (window-shell id b lang)
              body (.querySelector el ".cw-body")
              ;; a faust~: its patch on the left, the code on the right
              faust? (and (not data?) (= lang "faust"))
              pane (when faust? (js/document.createElement "div"))
              body (if faust?
                     (let [t (js/document.createElement "div")]
                       (set! (.-className body) (str "cw-body split" (when (false? (:faust-patch? @ui)) " nopatch")))
                       (set! (.-className pane) "cw-patch")
                       (set! (.-className t) "cw-text")
                       (.appendChild body pane)
                       (.appendChild body t)
                       t)
                     body)]
          (.appendChild (.-body js/document) el)
          (place-window! el id b faust?)
          (reset! code-win {:id id :path path :lang lang :data? data? :original original :dirty (not= text original)})
          (cw-status!)
          (render-scene (current))
          (when faust? (mount-faust-view! id pane text))
          (.then (load-cm)
                 (fn [cm]
                   (when (= (:id @code-win) id)
                     (if-let [create (and cm (.-createEditor cm))]
                       (let [ed (create #js {:parent body :doc text :language lang
                                             :words (clj->js (if data? buffer-words (words-for lang)))
                                             :onApply (fn [_] (apply-code!))
                                             :onCancel (fn [] (ask-close!))
                                             :onChange (fn [v] (swap! code-win assoc :dirty (not= v (:original @code-win)) :error nil) (cw-status!)
                                                         (when-let [fv (:fv @code-win)] (.setCode fv v)))})]
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
        (let [src (str (comp/source-of b))]
          (swap! code-win assoc :gone false)
          (when (and (not dirty) (not= src original) (not (str/blank? src)))
            (swap! code-win assoc :original src)
            (cond ed (.setValue ed src) ta (set! (.-value ta) src))
            (when-let [fv (:fv @code-win)] (.setCode fv src))
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
