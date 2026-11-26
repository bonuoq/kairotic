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

(declare set-editor-text!)

(defn hidden-layers
  "The layers of a tree box the code window hides: :performance (real times, wires, takes, the continuum: discussion
   #308), :analysis (figures, degrees, keys, why: #323) and :lyrics (the text it sings, #192), each but the ones the box
   shows (show-layers), its own."
  [b]
  (set (remove (shown-layers b) mt/layer-names)))

(defn editor-source
  "The text of a box in the code window: a tree box's tree as written, with the layers its buttons show (Performed,
   Analysis); any other box's source."
  [b]
  (if (= "tree" (klass (:text b)))
    (let [t (mtb/tree-of (:data b)) hide (when t (set (filter #(mt/has-layer? t %) (hidden-layers b))))]
      (if (or (nil? t) (empty? hide)) (str (comp/source-of b)) (mt/pp (mt/without-layers t hide))))
    (str (comp/source-of b))))

(defn toggle-code-layer!
  "A layer of the tree box open in the code window shown or hidden — in its code window and its score, the box's own
   (show-layers): :performance (Performed), :analysis (Analysis) or :lyrics (Lyrics)."
  [layer]
  (when-let [{:keys [id path dirty]} @code-win]
    (if dirty
      (repl-print! "out" "; apply or discard what is edited first: the layers show the tree again")
      (when-let [b (get-in (patch-in (root-patch) path) [:boxes id])]
        (let [now (shown-layers b) ks (if (now layer) (disj now layer) (conj now layer))]
          (gesture! (wrap-path path (str "(show-layers " id (apply str (map #(str " " (pr-str %)) (sort ks))) ")")))
          (when-let [btn (some-> (cw-el) (.querySelector (str "[data-cw=" (name layer) "]")))] (.setAttribute btn "aria-pressed" (str (contains? ks layer))))
          (let [v (editor-source (assoc b :shows (vec ks)))]
            (swap! code-win assoc :original v)
            (set-editor-text! v)))))))

(defn toggle-code-all! "Older name: the performance layer." [] (toggle-code-layer! :performance))

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
               (when (= "tree" (klass (:text b)))
                 (str "<button class=\"act cw-pv\" data-cw=\"performance\" aria-pressed=\"" (contains? (shown-layers b) :performance)
                      "\" title=\"Show also what belongs to performing it: real times, wires, takes, the continuum\">Performed</button>"
                      "<button class=\"act cw-pv\" data-cw=\"analysis\" aria-pressed=\"" (contains? (shown-layers b) :analysis)
                      "\" title=\"Show also what an analysis wrote on it: figures, degrees, keys, why a rule is broken\">Analysis</button>"
                      "<button class=\"act cw-pv\" data-cw=\"lyrics\" aria-pressed=\"" (contains? (shown-layers b) :lyrics)
                      "\" title=\"Show the text it sings: the syllables on its notes (:syl, :wordpos, :con, :verses)\">Lyrics</button>"))
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
          "performance" (toggle-code-layer! :performance)
          "analysis" (toggle-code-layer! :analysis)
          "lyrics" (toggle-code-layer! :lyrics)
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
              original (editor-source b)
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
        (let [src (editor-source b)]
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

;; ───── a form of the Code tab, alone (discussion #407) ─────
;; ⇧+Enter evaluates the selection, or the form the cursor is in (or the one just before it), without applying
;; the rest of the tab: live coding a line at a time. Calls that make the patch (box, connect, text!, the data of
;; a box…) change it as the whole tab does, by the difference, as one event: a box written again as it was keeps
;; what it keeps. Anything else — (play), (send! :b3 60), (snapshot), a def — is a line of the REPL.

(defn top-forms
  "The top-level forms of a piece of code, as [from to] (to exclusive), outside comments: lists, vectors,
   maps, strings and words, with what goes before them (#{ ' @ ^)."
  [s]
  (let [n (count s) prefix? (fn [c] (contains? #{"#" "'" "@" "`" "~" "^"} c))
        space? (fn [c] (or (= c ",") (re-matches #"\s" c)))]
    (loop [i 0 depth 0 in-str false start nil pre false out []]
      (if (>= i n)
        (if start (conj out [start n]) out)
        (let [c (.charAt s i)]
          (cond
            in-str (cond (= c "\\") (recur (+ i 2) depth true start pre out)
                         (= c "\"") (if (zero? depth)
                                      (recur (inc i) 0 false nil false (conj out [start (inc i)]))
                                      (recur (inc i) depth false start pre out))
                         :else (recur (inc i) depth true start pre out))
            (= c ";") (let [j (let [k (.indexOf s "\n" i)] (if (neg? k) n k))]
                        (if (and (zero? depth) start)
                          (recur j 0 false nil false (conj out [start i]))
                          (recur j depth false start pre out)))
            (or (= c "\"") (contains? #{"(" "[" "{"} c))
            (let [str? (= c "\"")]
              (if (zero? depth)
                (let [[out st] (cond (nil? start) [out i] pre [out start] :else [(conj out [start i]) i])]
                  (recur (inc i) (if str? 0 1) str? st false out))
                (recur (inc i) (if str? depth (inc depth)) str? start false out)))
            (contains? #{")" "]" "}"} c)
            (cond (zero? depth) (recur (inc i) 0 false start pre out)
                  (and (= depth 1) start) (recur (inc i) 0 false nil false (conj out [start (inc i)]))
                  :else (recur (inc i) (dec depth) false start pre out))
            (= c "\\") (if (and (zero? depth) (nil? start))
                         (recur (+ i 2) 0 false i false out)
                         (recur (+ i 2) depth false start false out))
            (space? c) (if (and (zero? depth) start)
                         (recur (inc i) 0 false nil false (conj out [start i]))
                         (recur (inc i) depth false start pre out))
            :else (if (and (zero? depth) (nil? start))
                    (recur (inc i) 0 false i (prefix? c) out)
                    (recur (inc i) depth false start (and pre (prefix? c)) out))))))))

(defn form-at
  "The top-level form of code s at position pos, as [from to]: the one the cursor is in or touches, otherwise the
   last one before it with only spaces between; nil if there is none."
  [s pos]
  (let [fs (top-forms s)]
    (or (first (filter (fn [[a b]] (and (<= a pos) (< pos b))) fs))
        ;; only spaces and comments between it and the cursor
        (last (filter (fn [[_ b]] (and (<= b pos) (str/blank? (str/replace (subs s b pos) #";[^\n]*" "")))) fs)))))

(def patch-calls
  "The calls that make the patch, as the Code tab writes it: a form of them alone changes it by the difference."
  #{"box" "to" "name-box" "connect" "disconnect" "move" "text!" "delete" "present" "unpresent" "view" "resize" "show-layers"
    "pin-ref" "layer" "mark" "unmark" "project" "recipe" "code" "stroke" "axis" "tuning" "grid-x" "grid-y"
    "tree!" "values!" "presets!"})

(defn form-head "The name a list form starts with, or nil." [f] (second (re-find #"^\(\s*([^\s()\[\]{}\"]+)" f)))

(defn keep-what-stays
  "Patch p made by code on top of cur: a box made again as `box` makes it (a text and a place) over one that was
   there keeps what that one kept (its data, presentation, view, size…), as a line evaluated alone must not empty it."
  [cur p]
  (update p :boxes
          (fn [bs] (into (empty bs)
                         (for [[id b] bs :let [a (get-in cur [:boxes id])]]
                           [id (if (and a (= #{:text :x :y} (set (keys b)))) (merge a b) b)])))))

;; A chain owns the lines it wrote (#432): evaluated again, it takes away those it no longer writes — taking a box out
;; of (-> :osc (to :amp …) (to :out …)) takes its lines with it. A chain is known by the box it starts from; what each
;; one wrote is kept in this browser for each work (not in the work). Lines made by anything else stay.

(defn chains-key "Where this browser keeps the lines each chain of the work wrote." []
  (let [{:keys [kind id]} @work] (when kind (str "kairotic.chains/" (name kind) "/" id))))

(defn owned-lines "{box the chain starts from #{lines it wrote}}, as kept for the work open." []
  (or (try (some-> (chains-key) (->> (.getItem js/localStorage)) clojure.edn/read-string) (catch :default _ nil)) {}))

(defn keep-owned! [m] (when-let [k (chains-key)] (try (.setItem js/localStorage k (pr-str m)) (catch :default _ nil))))

(defn chain-form? "Whether a form is a chain of calls: (-> …) or (doto …)." [f] (contains? #{"->" "doto"} (form-head f)))

(defn calls-chain-ok?
  "Whether a Clojure chain, (-> …) or (doto …), makes the patch: every step a call that does — (-> :osc (to :amp
   \"gain~ 0.2\")), as the Code tab writes the work. It is Clojure's own -> (or doto): (-> 1 inc) stays code."
  [f]
  (let [inner (subs f 1 (max 1 (dec (count f))))
        [_ e0 & steps] (mapv (fn [[a b]] (subs inner a b)) (top-forms inner))]
    (boolean (and e0 (seq steps)
                  (every? (fn [g] (and (str/starts-with? g "(") (contains? patch-calls (form-head g)))) steps)))))

(defn patch-call?
  "Whether a form makes the patch: a call that does (box, connect, to…), or a chain of them: (-> :osc (to :amp \"gain~\"))."
  [f]
  (let [h (form-head f)]
    (or (contains? patch-calls h) (and (contains? #{"->" "doto"} h) (calls-chain-ok? f)))))

(defn patch-form?
  "Whether a piece of code is only calls that make the patch (and at least one)."
  [code]
  (let [fs (map (fn [[a b]] (subs code a b)) (top-forms code))]
    (boolean (and (seq fs) (every? patch-call? fs)))))

(defn build-forms
  "Evaluates the forms of code one by one on a copy of patch cur: [the patch after, {box #{lines}}: the lines each
   chain wrote — made now, or already there — by the box it starts from]."
  [cur code]
  (let [prev-s @scratch prev-t @tried]
    (reset! scratch cur)
    (reset! tried [])
    (try
      (let [written (reduce (fn [acc [a b]]
                              (let [f (subs code a b) n (count @tried)]
                                (eval-str f)
                                (let [ls (when (chain-form? f)
                                           (keep (fn [[op & args]] (when (= op :connect) (vec args))) (drop n @tried)))]
                                  (if (seq ls) (update acc (first (first ls)) (fnil into #{}) ls) acc))))
                            {} (top-forms code))]
        [@scratch written])
      (finally (reset! scratch prev-s) (reset! tried prev-t)))))

(declare eval-values!)
(defn eval-calls!
  "Evaluates calls of the Code tab on the patch on screen (discussion #407): calls that make the patch change it by
   the difference, as one event, and a chain evaluated again takes away the lines it no longer writes (#432);
   anything else is evaluated form by form as lines of the REPL, and a value that is a patch as data, (=> …) or
   voices, is played (its own event). Returns how many changes it made."
  [code]
  (if (patch-form? code)
    (do
      (repl-print! "in" (str "<span class=\"p\">λ</span>" (esc code)))
      (try
        (let [cur (current)
              [p0 written] (build-forms cur code)
              owned (owned-lines)
              gone (set (mapcat (fn [[k ls]] (remove ls (get owned k))) written))
              p (keep-what-stays cur (update p0 :lines (fn [ls] (vec (remove gone ls)))))
              evs (code-events cur p)
              evs (or evs (fail "These calls cannot be applied as changes: apply the whole tab (Ctrl/⌘+Enter)."))
              taken (count (filter (fn [[op]] (= op :disconnect)) evs))]
          (doseq [[op id] evs :when (#{:box :delete} op)] (forget-box! id))
          (with-tx (or @tx-now {:via :repl}) (fn [] (dispatch-all! evs)))
          (when (seq written) (keep-owned! (merge owned written)))
          (repl-print! "out" (esc (str "; " (count evs) (if (= 1 (count evs)) " change" " changes")
                                       (when (pos? taken) (str " (" taken (if (= 1 taken) " line" " lines") " taken away)")))))
          (count evs))
        (catch :default e (repl-print! "err" (esc (or (.-message e) (str e)))) nil)))
    (eval-values! code)))

;; ───── a patch as data (discussion #407) ─────
;; A patch written as plain EDN, which Clojure's reader and any editor read: values, made by any code, and played as
;; they are given — the Live view plays the value of each form it evaluates, and (play value) anywhere:
;;
;;   [:=> {:osc [:osc- 220]} [:gain- 0.2] [:_ :_] [:dac- 1 2]]
;;   (=> {:osc [:osc- 220]} [:gain- 0.2] [:_ :_] [:dac- 1 2])      the same: => is a pure function that writes it
;;
;; - a box is a vector of its class and arguments, as hiccup writes a tag: [:mtof], [:gain- 0.2], [:map 'inc],
;;   ["osc~" 220]. A class with ~ is written with - ([:osc- 220] is osc~ 220), since Clojure's reader reads ~ as
;;   unquote; a class whose own name ends in - (-, !-) stays itself.
;; - => is in series, each element fed by the one before; a vector that is not a box is in parallel (after one wire
;;   every element is fed by it, after as many wires as it has elements each by its own), :_ a wire that goes on, and
;;   a box after several wires takes them on its inlets 0, 1…; [:=> …] a chain inside another.
;; - a map names: {:osc [:osc- 220]} is that box called :osc, the same box each time; :osc alone is it; [:to o box i]
;;   chooses the ports.
;; - {:lead [:=> …] :bass [:=> …]}: voices, each a chain known by its key, as d1 in Tidal. Evaluated again, a voice
;;   changes only what changed, a voice gone from the map is taken away, and :frame holds the boxes every voice uses —
;;   {:frame {:mic [:adc- 1] :out [:dac- 1 2]}} —, never taken away by a voice.
;; - #_ before a box leaves it out (Clojure's reader does): evaluated again, the chain goes round it.
;; A chain owns the boxes and wires it made: evaluated again, each box takes the box it made before with the same class
;; (its text changed if it changed), a box put in is the only new one, and a box or a wire it no longer writes is taken
;; away. Named boxes are never taken away so. What each chain made is kept in this browser for each work.

(defn class-known? [k] (boolean (and (seq k) (or (comp/lookup k) (lib/package-of k)))))

(defn class-name
  "The class a box vector starts with: a string as it is, a keyword by its name — with ~ for a final - ([:osc- …] is
   osc~), unless a class has that name ending in - (- and !- stay themselves)."
  [h]
  (cond (string? h) h
        (or (keyword? h) (symbol? h))
        (let [n (name h)]
          (if (and (> (count n) 1) (str/ends-with? n "-") (not (class-known? n)))
            (str (subs n 0 (dec (count n))) "~")
            n))))

(def data-ops #{:=> :to :_})

(defn box-vec?
  "Whether a vector is a box: it starts with a class (a string, or a keyword or symbol a class answers to)."
  [v]
  (boolean (and (vector? v) (seq v)
                (let [h (first v)]
                  (or (string? h)
                      (and (or (keyword? h) (symbol? h)) (not (contains? data-ops h)) (class-known? (class-name h))))))))

(defn arg-text [a] (cond (string? a) (pr-str a) (number? a) (str a) (or (keyword? a) (symbol? a)) (str a) :else (pr-str a)))

(defn source-arg?
  "Whether an argument of a box is itself a part of the patch that feeds it — a box, a chain, or a box named by a map
   — rather than a value: [:osc- [:mtof]], [:gain- (=> [:osc- 2] [:gain- 0.5])]."
  [a]
  (boolean (or (box-vec? a)
               (and (vector? a) (= :=> (first a)))
               (and (map? a) (= 1 (count a)) (keyword? (ffirst a)) (box-vec? (val (first a)))))))

(defn code-class?
  "Whether boxes of class cls keep a source (a code box — pbind, pattern, script —, or one with a model: a canvas…);
   a class of a package not loaded yet is taken to."
  [cls]
  (let [d (comp/lookup cls)]
    (if d (boolean (or (= :code (:display d)) (string? (:language d)) (:model d))) (boolean (lib/package-of cls)))))

(defn source-of-vec
  "[k a]: the argument of box vector v that is its source — its last, a map for a box that keeps a source
   ([:pbind 7 {:degree [0 2 4]}]), or a string for one of a class loaded ([:script \"(fn …)\"]) —, or nil."
  [v]
  (let [cls (class-name (first v)) as (vec (rest v)) a (peek as)]
    (when (and (seq as) (not= "faust~" cls) (code-class? cls)
               (or (and (map? a) (not (source-arg? a))) (and (string? a) (comp/lookup cls))))
      [(dec (count as)) a])))

(defn box-text
  "The text of the box a vector writes: [:gain- 0.2] → \"gain~ 0.2\". An argument that is a part of the patch is not
   written (0 holds its place if values follow it): it feeds the box; nor is its source."
  [v]
  (let [as (if-let [[k] (source-of-vec v)] (subvec (vec (rest v)) 0 k) (rest v))
        kept (if (= "faust~" (class-name (first v))) [] (reverse (drop-while source-arg? (reverse as))))]
    (str/join " " (cons (class-name (first v)) (map (fn [a] (if (source-arg? a) "0" (arg-text a))) kept)))))

(defn source-data!
  "Writes src as the source of box id, if it is not that already: with code once its class is loaded, or else as its
   data, which the class reads when its package comes."
  [id src]
  (let [b (get-in (current) [:boxes id])]
    (if (comp/lookup (klass (:text b)))
      (when (not= src (comp/source-of b)) (code id src))
      (when (not= src (get-in b [:data :source])) (dispatch! [:data id {:source src}])))))

(def arg-inlets
  "The inlet each argument of a class sets, where it is not the one after the left (as + 1, gain~ 0.2, metro 500):
   osc~ 220 sets the frequency, its left inlet; a number, the inlet every argument that is a part of the patch
   goes to (a player takes its pattern on the right)."
  {"osc~" [0] "phasor~" [0] "sig~" [0] "player" 1})

(defn arg-inlet
  "The inlet that argument k of a box of class cls sets: the class says it (:arg-inlets, or arg-inlets), or else the
   one after the left (k + 1), as Pd and Max give arguments to the cold inlets."
  [cls k]
  (let [m (or (:arg-inlets (comp/lookup cls)) (get arg-inlets cls))]
    (cond (number? m) m m (get m k) :else (inc k))))

(def chain-outlets
  "The outlets a box of a class leaves to the next one in a chain, where it is not its left one alone: a player and a
   keyboard send the Hz and the voice ids together, to a synth~ or a polyphonic faust~."
  {"player" [0 1] "keyboard" [0 1]})

(defn ends-of "The ends box id leaves in a chain: its outlets, as its class says (chain-outlets), or its left one." [id]
  (let [cls (klass (str (get-in (current) [:boxes id :text])))]
    (mapv (fn [o] [id o]) (or (:chain-outlets (comp/lookup cls)) (get chain-outlets cls) [0]))))

(defn spliced [xs] (mapcat (fn [x] (if (seq? x) x [x])) xs))

(defn below [ends j]
  (if-let [[id] (first ends)]
    (let [b (get-in (current) [:boxes id])] (if b [(+ (:x b) (* j 110)) (+ (:y b) to-gap)] [nil nil]))
    [nil nil]))

(defn data-box!
  "A box a chain writes: the one it made before with the same class (its text changed if it changed), or a new one."
  [ctx t [x y]]
  (let [h (first (str/split t #"\s+"))
        old (first (filter (fn [id] (and (get-in (current) [:boxes id]) (not (get-in (current) [:boxes id :name]))))
                           (get-in @ctx [:old h])))]
    (when old
      (swap! ctx update-in [:old h] (fn [q] (vec (remove #{old} q))))
      (when (not= t (get-in (current) [:boxes old :text])) (text! old t)))
    (let [id (or old (if (number? x) (box t x y) (box t)))]
      (swap! ctx update :made conj [h id])
      id)))

(defn named-data-box!
  "A box by a name: made the first time (where its chain puts it), the same box after, its text changed if it changed."
  [nm t [x y]]
  (if (get-in (current) [:boxes (rid nm)]) (named-box nm t nil nil) (named-box nm t x y)))

;; ───── #pat/… in live code ─────
;; The generators of @kairotic/patterns, written in a pattern as in a pbind's source — {:degree #pat/shuffle [0 2 4 7]
;; :dur #pat/euclid [5 8]} —, are read by the code you evaluate as tagged literals: values that print as they were
;; written, so a pbind written as data gets them in its source. Any other tag is still an error.

(def pat-tags '[seq choose shuffle white walk series hold chord euclid pulses necklace chance])

(alter-var-root #'*data-readers* merge
                (into {} (for [g pat-tags :let [t (symbol "pat" (name g))]] [t (fn [x] (tagged-literal t x))])))

;; ───── Faust as data (discussion #407, #115) ─────
;; [:faust- …] is a faust~ box whose code is written by the same grammar: its arguments, a chain of Faust's own
;; elements, are its process —
;;   [:faust- [:os.sawtooth 110] [:fi.lowpass 2 800] [:* 0.1]]  →  process = os.sawtooth(110) : fi.lowpass(2, 800) : *(0.1);
;; a box is a Faust function with the first arguments given ([:fi.lowpass 2 800] is fi.lowpass(2, 800): partial
;; application, the rest its inputs); a chain, (=> …) or [:=> …], is : (<: before a vector, :> after one); a vector
;; that is not a box is , (in parallel); :_ is _ and :! is ! ; a number is a constant signal, a string is Faust code
;; as it is; an argument may be a signal itself: [:os.osc (=> [:os.osc 5] [:* 10] [:+ 440])].
;; Names, as in the patch: {:lfo [:os.osc 5]} defines lfo = os.osc(5); (once) and is it, :lfo after is it again.
;; [:rec a b] is Faust's a ~ b, a feedback loop. A first map of options, {:nvoices 8 :effect …}, makes it polyphonic:
;; :freq, :gain and :gate are the voice's own (the sliders and the button Faust's allocator sets), and :effect is applied
;; once to the sum of the voices.

(def ^:dynamic *faust-defs* nil)

(defn faust-box-vec? [v] (boolean (and (vector? v) (seq v) (let [h (first v)] (or (string? h) (and (or (keyword? h) (symbol? h)) (not (contains? #{:=> :_ :! :to :rec} h))))))))

(defn faust-name? [x] (and (map? x) (= 1 (count x)) (or (keyword? (ffirst x)) (symbol? (ffirst x)))))

(defn unwrap "Faust code without the parentheses round all of it." [e]
  (if (and (str/starts-with? e "(") (str/ends-with? e ")") (= 1 (count (top-forms e)))) (subs e 1 (dec (count e))) e))

(defn faust-expr
  "The Faust code of an element written as data; the names it defines are added to *faust-defs*."
  [x]
  (letfn [(wire [k] (case k :_ "_" :! "!" nil))
          (arg [a] (cond (number? a) (str a) (string? a) (pr-str a)
                         (or (vector? a) (seq? a) (faust-name? a)) (faust-expr a)
                         (or (keyword? a) (symbol? a)) (or (wire a) (name a))
                         :else (fail (str "Not a Faust argument: " (pr-str a)))))
          (par? [e] (and (vector? e) (not (faust-box-vec? e)) (not (#{:=> :rec} (first e)))))]
    (cond
      (number? x) (str x)
      (string? x) x
      (and (keyword? x) (wire x)) (wire x)
      (or (keyword? x) (symbol? x)) (name x)
      (faust-name? x)
      (let [[[k v]] (seq x) nm (name k) e (unwrap (faust-expr v)) defs *faust-defs*]
        (when defs
          (let [had (some (fn [[n d]] (when (= n nm) d)) @defs)]
            (cond (nil? had) (swap! defs conj [nm e])
                  (not= had e) (fail (str "Two Faust definitions of " nm ": " had " and " e)))))
        nm)
      (seq? x) (faust-expr (into [:=>] x))
      (and (vector? x) (= :rec (first x)))
      (let [[_ a b] x] (when-not (= 3 (count x)) (fail "[:rec a b] is a ~ b")) (str "(" (faust-expr a) " ~ " (faust-expr b) ")"))
      (and (vector? x) (= :=> (first x)))
      (let [es (vec (spliced (rest x)))]
        (when (empty? es) (fail "An empty chain"))
        (if (= 1 (count es))
          (faust-expr (first es))
          (str "(" (faust-expr (first es))
               (apply str (map (fn [a b] (str (cond (par? b) " <: " (par? a) " :> " :else " : ") (faust-expr b)))
                               es (rest es)))
               ")")))
      (faust-box-vec? x)
      (let [h (first x) nm (if (string? h) h (name h)) as (rest x)]
        (if (seq as) (str nm "(" (str/join ", " (map arg as)) ")") nm))
      (vector? x) (str "(" (str/join ", " (map faust-expr (spliced x))) ")")
      :else (fail (str "Not a part of a Faust process: " (pr-str x))))))

(def faust-voice
  "What a voice of a polyphonic faust~ has of its own, set note by note by Faust's allocator."
  [["freq" "hslider(\"freq\", 440, 20, 20000, 0.01)"] ["gain" "hslider(\"gain\", 0.8, 0, 1, 0.01)"] ["gate" "button(\"gate\")"]])

(defn faust-options? [m] (and (map? m) (seq m) (every? #{:nvoices :effect} (keys m))))

(defn faust-code
  "The code of a faust~ box written as data, its process the chain of els: (faust-code [:os.osc 220] [:* 0.1])
   writes process = os.osc(220) : *(0.1); after importing stdfaust.lib, and the names it defines before it. A first
   map of options, {:nvoices 8 :effect [:ef.echo 1 0.33 0.45]}, makes it polyphonic: :freq, :gain and :gate are its
   voice's own."
  [& els]
  (let [[opts els] (if (faust-options? (first els)) [(first els) (rest els)] [nil els])
        defs (atom [])
        e (binding [*faust-defs* defs] (unwrap (faust-expr (into [:=>] els))))
        eff (when-let [x (:effect opts)] (binding [*faust-defs* defs] (unwrap (faust-expr x))))
        n (:nvoices opts)
        mine (set (map first @defs))]
    (when (and n (not (pos-int? n))) (fail "nvoices is a whole number of voices"))
    (str "import(\"stdfaust.lib\");\n"
         (when n (str "declare options \"[nvoices:" n "]\";\n"
                      (apply str (for [[nm d] faust-voice :when (not (mine nm))] (str nm " = " d ";\n")))))
         (apply str (for [[nm d] @defs] (str nm " = " d ";\n")))
         "process = " e ";"
         (when eff (str "\neffect = " eff ";")))))

(defn faust-vec? [v] (and (vector? v) (seq v) (or (keyword? (first v)) (symbol? (first v)) (string? (first v))) (= "faust~" (class-name (first v)))))

(defn faust-source!
  "The code of faust~ box id written by its vector v, if it is not that already."
  [id v]
  (let [src (apply faust-code (rest v))]
    (when (not= src (comp/source-of (get-in (current) [:boxes id]))) (code id src))))

(declare run-data)
(defn feed-args!
  "The arguments of box vector v that are parts of the patch, each made and wired to the inlet its argument sets."
  [ctx v id j]
  (let [cls (class-name (first v)) t (get-in (current) [:boxes id :text])
        n-in (first (comp/io {:text t}))]
    (when-let [[_ src] (source-of-vec v)] (source-data! id (if (string? src) src (pr-str src))))
    (if (= "faust~" cls)
      (faust-source! id v)
    (doseq [[k a] (map-indexed vector (rest v)) :when (source-arg? a)]
      (let [i (arg-inlet cls k)]
        (when-not (and i (or (< i n-in) (nil? (comp/lookup cls)) (comp/dynamic? {:text t})))
          (fail (str cls " has no inlet for its argument " (inc k))))
        (doseq [[b o] (run-data ctx [] a (+ j k))]
          (connect b o id i)
          (swap! ctx update :wrote conj [b o id i])))))))

(defn feed! [ctx ends id]
  (doseq [[j [a o]] (map-indexed vector ends)]
    (let [l [a o id (if (= 1 (count ends)) 0 j)]]
      (apply connect l)
      (swap! ctx update :wrote conj l))))

(defn existing! [k] (let [id (rid k)] (if (get-in (current) [:boxes id]) id (fail (str "No box called " k ", nor a class " (class-name k))))))

(defn run-chain-data
  "The elements of a chain, in series: each fed by the wires the one before leaves."
  [ctx els ends]
  (reduce (fn [acc x] (run-data ctx acc x 0)) ends (spliced els)))

(defn run-data
  "Runs an element of a patch written as data, fed by `ends` ([[box outlet] …]); returns the ends it leaves."
  [ctx ends x j]
  (let [make (fn [id] (when (seq ends) (feed! ctx ends id)) (ends-of id))]
    (cond
      (= x :_) (if (seq ends) ends (fail "A wire (:_) with nothing before it"))
      (or (keyword? x) (symbol? x)) (make (existing! x))
      (map? x) (let [[[nm b]] (seq x)]
                 (when (not= 1 (count x)) (fail "A map names one box: {:osc [:osc- 220]}"))
                 (if (box-vec? b)
                   (let [id (named-data-box! (keyword (name nm)) (box-text b) (below ends j))]
                     (feed-args! ctx b id j) (make id))
                   (fail (str "Not a box: " (pr-str b)))))
      (box-vec? x) (let [id (data-box! ctx (box-text x) (below ends j))]
                     (feed-args! ctx x id j) (make id))
      (and (vector? x) (= :=> (first x))) (run-chain-data ctx (rest x) ends)
      (and (vector? x) (= :to (first x)))
      (let [args (vec (rest x)) [[a]] ends
            [o b i] (if (= 3 (count args)) args [0 (first args) 0])
            id (ffirst (run-data ctx [] b j))]
        (when-not a (fail "[:to …] with nothing before it"))
        (connect a o id i) (swap! ctx update :wrote conj [a o id i]) [[id 0]])
      (vector? x)
      (let [es (vec (spliced x)) n (count ends)]
        (vec (apply concat (map-indexed (fn [k e] (run-data ctx (cond (<= n 1) ends (= n (count es)) [(nth ends k)]
                                                                      :else (fail (str n " wires into a vector of " (count es))))
                                                            e (+ j k)))
                                        es))))
      (seq? x) (run-chain-data ctx x ends)
      :else (fail (str "Not a box nor a part of a patch: " (pr-str x))))))

(defn made-key "Where this browser keeps the boxes and wires each chain of the work made." []
  (let [{:keys [kind id]} @work] (when kind (str "kairotic.patchdata/" (name kind) "/" id))))
(defn made-records [] (or (try (some-> (made-key) (->> (.getItem js/localStorage)) clojure.edn/read-string) (catch :default _ nil)) {}))
(defn keep-records! [m] (when-let [k (made-key)] (try (.setItem js/localStorage k (pr-str m)) (catch :default _ nil))))

(defn chain-key-of "A chain known by its first box's name, or by the classes it is made of." [els]
  (let [e0 (first els)]
    (cond (keyword? e0) e0
          (map? e0) (keyword (name (ffirst e0)))
          :else (str/join " " (map (fn [x] (cond (box-vec? x) (class-name (first x)) (map? x) (name (ffirst x)) :else (pr-str x))) els)))))

(defn run-owned!
  "Runs a chain as its key's: boxes reused by class, and the boxes and wires it made before and no longer writes taken
   away. Returns [ends record]."
  [k els records]
  (let [{:keys [boxes lines]} (get records k)
        ctx (atom {:made [] :wrote [] :old (reduce (fn [m [h id]] (update m h (fnil conj []) id)) {} boxes)})
        ends (run-chain-data ctx els [])
        made (set (map second (:made @ctx))) wrote (set (:wrote @ctx))]
    (doseq [l lines :when (and (not (wrote l)) (some #{l} (:lines (current))))] (apply disconnect l))
    (doseq [[_ id] boxes :let [b (get-in (current) [:boxes id])] :when (and b (not (:name b)) (not (made id)))] (delete id))
    [ends {:boxes (:made @ctx) :lines (vec wrote)}]))

(defn drop-voice! [{:keys [boxes lines]}]
  (doseq [l lines :when (some #{l} (:lines (current)))] (apply disconnect l))
  (doseq [[_ id] boxes :let [b (get-in (current) [:boxes id])] :when (and b (not (:name b)))] (delete id)))

(defn chain-vec? [v] (and (vector? v) (= :=> (first v))))

(defn voices-map?
  "Whether a map is voices: each value a chain, [:=> …], and perhaps a :frame. {} is no voices: all of them stop."
  [m]
  (boolean (and (map? m) (or (contains? m :frame) (every? chain-vec? (vals m))))))

(defn playable?
  "Whether a value is a patch as data that the Live view plays: a chain, [:=> …], or voices, {:lead [:=> …] …}."
  [v]
  (or (chain-vec? v) (voices-map? v)))

(defn play-data!
  "Puts a patch written as data in the patch on screen, as one event of the history (discussion #407): a chain,
   [:=> …] or a box, or voices, {:frame {…} :lead [:=> …] …}. Evaluated again, a chain changes what changed: its
   boxes are reused by class, and what it no longer writes is taken away; a voice gone from the map stops. Returns
   the id of the last box of a chain, or the keys of the voices."
  [v]
  (let [els (cond (chain-vec? v) (vec (rest v))
                  (voices-map? v) [v]
                  (or (box-vec? v) (map? v)) [v]
                  :else (fail (str "Not a patch as data: " (pr-str v))))
        records (made-records)
        voices? (and (= 1 (count els)) (voices-map? (first els)))
        out (atom nil) recs (atom records)]
    (as-one-event!
     (fn []
       (if voices?
         (let [m (first els) prev (get records ::voices #{})]
           ;; the frame: boxes by their names, made once, never taken away by a voice
           (doseq [[nm b] (:frame m)]
             (when-not (box-vec? b) (fail (str "Not a box in :frame: " (pr-str b))))
             (let [id (named-data-box! (keyword (name nm)) (box-text b) [nil nil])]
               (when (faust-vec? b) (faust-source! id b))
               (when-let [[_ src] (source-of-vec b)] (source-data! id (if (string? src) src (pr-str src))))))
           (doseq [[k v] (dissoc m :frame)]
             (let [[_ rec] (run-owned! [::voice k] (rest v) records)] (swap! recs assoc [::voice k] rec)))
           (doseq [k prev :when (not (contains? m k))]
             (drop-voice! (get records [::voice k])) (swap! recs dissoc [::voice k]))
           (swap! recs assoc ::voices (set (keys (dissoc m :frame))))
           (reset! out (vec (keys (dissoc m :frame)))))
         (let [k (chain-key-of els) [ends rec] (run-owned! k els records)]
           (swap! recs assoc k rec)
           (reset! out (ffirst ends))))))
    (keep-records! @recs)
    @out))

(defn =>
  "A chain, as data: (=> [:osc- 220] [:gain- 0.2] :out) is [:=> [:osc- 220] [:gain- 0.2] :out]. Pure: it changes
   nothing; the Live view plays the chains a block gives, and (play chain) anywhere. So chains nest, and are made,
   kept and joined as any value: (def lead (=> …)), (for …), (assoc voices :bass (=> …))."
  [& els]
  (into [:=>] els))

(defn eval-values!
  "Evaluates code form by form, as lines of the REPL: a form whose value is a patch as data — a chain, [:=> …], or
   voices — is played, as (play value)."
  [code]
  (repl-print! "in" (str "<span class=\"p\">λ</span>" (esc code)))
  (risky! (if (> (count code) 160) (str (subs code 0 150) " …") code))
  (try
    (with-tx (or @tx-now {:via :repl})
      (fn []
        (doseq [[a b] (top-forms code)]
          (let [v (eval-str (subs code a b))]
            (if (playable? v)
              (let [r (play v)] (repl-print! "out" (esc (str "; ▶ " (if (vector? r) (str/join " " r) (pr-str r))))))
              (repl-print! "out" (esc (pr-str v))))))))
    (catch :default e (repl-print! "err" (esc (or (.-message e) (str e)))) nil)))

(defn same-code? [a b]
  (= (str/replace (str/trim (str a)) #"\s+" " ") (str/replace (str/trim (str b)) #"\s+" " ")))

(defn editor-selection
  "[text from to] of an editor (or of its text area, before the editor is loaded)."
  [ed ta]
  (if ed
    (let [m (.. ed -view -state -selection -main)] [(.getValue ed) (.-from m) (.-to m)])
    [(.-value ta) (.-selectionStart ta) (.-selectionEnd ta)]))

(defn code-selection
  "What the Code tab has selected, or the form at its cursor: [text from to], or nil."
  []
  (let [[text a b] (editor-selection @code-ed ($ "code"))]
    (if (< a b) [text a b] (when-let [[f t] (form-at text a)] [text f t]))))

(defn eval-code-form!
  "⇧+Enter in the Code tab (discussion #407): evaluates the selection, or the form at the cursor, alone. If the tab
   held nothing else that was not applied, it is written again from the patch, the cursor kept on its line."
  []
  (let [[text from to] (code-selection)
        code (when from (str/trim (subs text from to)))]
    (if-not (and (seq code) (balanced? code))
      (repl-print! "err" "Nothing to evaluate here: put the cursor on a form, or select some code.")
      (let [rest-clean (same-code? (str (subs text 0 from) (subs text to)) (shown-code (current)))
            line (when-let [e @code-ed] (.cursorLine e))]
        (swap! ui (fn [u] (-> u (update :hist conj code) (assoc :hidx nil))))
        (eval-calls! code)
        (when (or rest-clean (same-code? (code-text) (shown-code (current))))
          (swap! ui assoc :dirty false)
          (render-code (current))
          (when-let [e @code-ed]
            (let [v (.-view e) doc (.. v -state -doc) l (.line doc (max 1 (min (or line 1) (.-lines doc))))]
              (.dispatch v #js {:selection #js {:anchor (.-to l)}}))))))))

(defn host-for!
  "A place for an editor next to element `el`, which hides: keys typed there stay there."
  [el cls]
  (let [h (js/document.createElement "div")]
    (set! (.-className h) cls)
    (.insertBefore (.-parentNode el) h el)
    (set! (.-hidden el) true)
    (.addEventListener h "keydown" (fn [e] (.stopPropagation e)))
    h))

;; ───── the Code tab and the patch, seen together (issue #165) ─────
;; Lines longer than 160 characters (the source of a code box, a buffer kept as data…) are folded after their
;; first 48 characters, saying how many they hide; a click (or the fold gutter) shows them, and a line unfolded
;; stays so while the tab is open. The lines of the boxes selected in the patch are marked, and the tab scrolls to
;; them; the other way round, the cursor on a line of a box selects that box in the patch.

(defonce code-unfolded (atom #{}))   ; the lines unfolded by the person, by their beginning: "(code :b7"
(defonce code-line-pick (atom false)) ; the selection comes from the cursor in the code: the tab does not scroll

(defn line-key "The beginning of a line of the code that names its box: \"(code :b7\", or nil." [text]
  (re-find #"^\([^\s()]+ :b\d+" (str text)))

(defn ids-in-line "The box ids a line of code names, in order." [text]
  (map keyword (map (fn [m] (subs m 1)) (re-seq #"(?<![\w:-]):b\d+(?![\w-])" (str text)))))

(defn code-mark-lines!
  "Marks the lines of the Code tab that name a box selected in the patch; returns their numbers."
  []
  (when-let [e @code-ed]
    (when (.-highlight e)
      (let [chosen (set (sel-ids))
            ls (if (empty? chosen) []
                   (vec (keep-indexed (fn [i l] (when (some chosen (ids-in-line l)) (inc i)))
                                      (str/split-lines (.getValue e)))))]
        (.highlight e (clj->js ls))
        ls))))

(defn code-tab-refresh!
  "After the code of the tab is written again: long lines folded (not the ones unfolded), boxes marked."
  []
  (when-let [e @code-ed]
    (when (.-foldLong e) (.foldLong e 160 48 (fn [t] (contains? @code-unfolded (line-key t)))))
    (code-mark-lines!)))

(defn code-line-chosen!
  "The cursor went to a line of the Code tab: the boxes it names (one, or the two of a connect) are selected."
  [text]
  (let [p (current) ids (vec (distinct (filter (fn [id] (get-in p [:boxes id])) (ids-in-line text))))]
    (when (seq ids)
      (reset! code-line-pick true)
      (try (swap! ui assoc :sel (sel-of ids) :insp nil :nsel nil :tsel nil)
           (render-scene (current))
           (finally (reset! code-line-pick false)))
      ;; the patch shows the first one
      (some-> (.querySelector ($ "scene") (str "g.box[data-box=\"" (name (first ids)) "\"]"))
              (.scrollIntoView #js {:block "nearest" :inline "nearest"})))))

;; the selection changed: its lines are marked, and the tab goes to them (unless the cursor chose them)
(add-watch ui ::code-marks
  (fn [_ _ o n]
    (when (not= (:sel o) (:sel n))
      (let [ls (code-mark-lines!)]
        (when (and (seq ls) (not @code-line-pick) @code-ed (.-showLine @code-ed))
          (.showLine @code-ed (first ls)))))))

(defn upgrade-code-tab! [cm]
  (when-not @code-ed
    (let [ta ($ "code") host (host-for! ta "code-host")
          ed ((.-createEditor cm)
              #js {:parent host :doc (.-value ta) :language "clojurescript" :words (clj->js (command-words))
                   :onApply (fn [_] (run-panel-code!))
                   :keys #js [#js {:key "Shift-Enter" :run (fn [] (eval-code-form!) true)}]
                   :onChange (fn [_] (when-not (:dirty @ui) (swap! ui assoc :dirty true) (render-code (current))))
                   :onLine (fn [_ text] (code-line-chosen! text))
                   :onUnfold (fn [text] (when-let [k (line-key text)] (swap! code-unfolded conj k)))})]
      (.setAttribute (.-contentDOM (.-view ed)) "aria-label" "Patch code")
      (reset! code-ed ed)
      (code-tab-refresh!))))

(defn upgrade-data-view!
  "The Data view of the Code tab: the same editor, read-only, with EDN colours, folding and search."
  [cm]
  (when-not @data-ed
    (let [pre ($ "edn")
          host (host-for! pre "data-host")
          ed ((.-createEditor cm) #js {:parent host :doc (.-textContent pre) :language "edn" :readOnly true})]
      (.setAttribute (.-contentDOM (.-view ed)) "aria-label" "The work as data (EDN)")
      (reset! data-ed ed))))

;; ───── Live: your own code, to play the work (discussion #407) ─────
;; A third view of the Code tab, beside Calls and Data: a page of your own that the work never writes over, where
;; names (def) and chains (->, to) stay as you wrote them. ⇧+Enter evaluates the form at the cursor (or the
;; selection), Ctrl/⌘+Enter the block it is in (the lines between two empty ones), as the Calls view does with a
;; form: calls that make the patch by the difference, as one event; anything else as a line of the REPL. What was
;; evaluated flashes. It is kept in this browser for each work, not in the work.

(defonce live-ed (atom nil))

(def live-start
  ";; Live: your own code, kept in this browser (not in the work).
;; ⇧+Enter evaluates a form, Ctrl/⌘+Enter a block (lines between empty ones).

;; a patch as data, played as it is evaluated: a box is a vector of its class and arguments
;; ([:osc- 220] is osc~ 220), => in series, [:_ :_] one wire split in two, a map gives a box a name
(=> {:osc [:osc- 220]} [:gain- 0.2] [:_ :_] [:dac- 1 2])

;; voices, each known by its key: evaluated again, only what changed changes;
;; #_ leaves a box out, and a voice taken out of the map stops
{:frame {:out [:dac- 1 2]}
 :lead  (=> [:gendy- 110] #_[:gain- 0.5] [:gain- 0.2] [:_ :_] :out)}

;; chains are values: kept, made by functions, joined as any data
(defn drone [f] (=> [:osc- f] [:gain- 0.1] :out))
{:frame {:out [:dac- 1 2]}
 :lead  (=> [:gendy- 110] [:gain- 0.2] [:_ :_] :out)
 :low   (drone 55)}

(stop)
")

(defn live-key "Where this browser keeps the Live code of the work open." []
  (let [{:keys [kind id]} @work] (when kind (str "kairotic.live/" (name kind) "/" id))))

(defn live-text [] (if-let [e @live-ed] (.getValue e) (.-value ($ "live"))))
(defn set-live-text! [v] (if-let [e @live-ed] (when (not= v (.getValue e)) (.setValue e v)) (set! (.-value ($ "live")) v)))

(defn save-live! []
  (when-let [k (live-key)] (try (.setItem js/localStorage k (live-text)) (catch :default _ nil))))

(defn load-live! []
  (set-live-text! (or (when-let [k (live-key)] (try (.getItem js/localStorage k) (catch :default _ nil))) live-start)))

(defn block-at
  "The block of code s around position pos, as [from to]: its lines between two empty ones (from the cursor on
   an empty line, the block just above); nil if there is none."
  [s pos]
  (let [ls (loop [i 0 out []]
             (let [j (.indexOf s "\n" i)]
               (if (neg? j) (conj out [i (count s)]) (recur (inc j) (conj out [i j])))))
        blank? (fn [[a b]] (str/blank? (subs s a b)))
        k (or (first (keep-indexed (fn [i [a b]] (when (<= a pos b) i)) ls)) (dec (count ls)))
        k (loop [k k] (if (and (>= k 0) (blank? (nth ls k))) (recur (dec k)) k))]
    (when (>= k 0)
      (let [top (loop [i k] (if (and (pos? i) (not (blank? (nth ls (dec i))))) (recur (dec i)) i))
            bot (loop [i k] (if (and (< (inc i) (count ls)) (not (blank? (nth ls (inc i))))) (recur (inc i)) i))]
        [(first (nth ls top)) (second (nth ls bot))]))))

(defn flash-lines!
  "Marks for a moment the lines of an editor from position a to b: what was just evaluated."
  [ed a b]
  (when (and ed (.-highlight ed))
    (let [doc (.. ed -view -state -doc)
          l1 (.-number (.lineAt doc a)) l2 (.-number (.lineAt doc (max a (dec b))))]
      (.highlight ed (clj->js (range l1 (inc l2))))
      (js/setTimeout (fn [] (.highlight ed #js [])) 350))))

(defn eval-live!
  "Evaluates the selection of the Live view, or the form (what :form) or block (:block) at its cursor."
  [what]
  (let [[text a b] (editor-selection @live-ed ($ "live"))
        [from to] (if (< a b) [a b] (if (= what :block) (block-at text a) (form-at text a)))
        code (when from (str/trim (subs text from to)))]
    (if-not (and (seq code) (balanced? code))
      (repl-print! "err" "Nothing to evaluate here: put the cursor on a form, or select some code.")
      (do (save-live!)
          (swap! ui (fn [u] (-> u (update :hist conj code) (assoc :hidx nil))))
          (flash-lines! @live-ed from to)
          (eval-calls! code)))))

(defn upgrade-live-view! [cm]
  (when-not @live-ed
    (let [ta ($ "live") host (host-for! ta "live-host")
          ed ((.-createEditor cm)
              #js {:parent host :doc (.-value ta) :language "clojurescript" :words (clj->js (command-words))
                   :onApply (fn [_] (eval-live! :block))
                   :keys #js [#js {:key "Shift-Enter" :run (fn [] (eval-live! :form) true)}]
                   :onChange (fn [_] (save-live!))})]
      (.setAttribute (.-contentDOM (.-view ed)) "aria-label" "Live code")
      (reset! live-ed ed))))

;; the text area, before the editor is loaded (or without it)
(.addEventListener ($ "live") "input" (fn [_] (save-live!)))
(.addEventListener ($ "live") "keydown"
  (fn [e] (when (= (.-key e) "Enter")
            (cond (.-shiftKey e) (do (.preventDefault e) (eval-live! :form))
                  (or (.-ctrlKey e) (.-metaKey e)) (do (.preventDefault e) (eval-live! :block))))))

;; each work has its own: the page of the work opened
(add-watch work ::live (fn [_ _ o n] (when (not= (select-keys o [:kind :id]) (select-keys n [:kind :id])) (load-live!))))

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
   (fn [] (.then (load-cm) (fn [cm] (when cm (upgrade-code-tab! cm) (upgrade-data-view! cm) (upgrade-live-view! cm) (upgrade-repl! cm)
                         ;; the hosts take the place of what was shown: show again the view that was chosen
                         (show-code-view! (or (:code-view @ui) :calls))))))
   300))
