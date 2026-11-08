;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · page · box ids (issue #163)
;; Boxes are named by their ids everywhere ((connect :b1 0 :b2 0), (send! :b7 …), @b3 in the Room tab), so:
;;   - each box shows its id over its top right corner when it is hovered or selected; I shows them all
;;     (02-patch-view.cljs draws it, the page's CSS shows it);
;;   - ( on the patch opens a line of the REPL there, in the field of a new box (05-gestures.cljs);
;;   - while a line of code waits for a box — the REPL, the Code tab, the field opened with (, the Room tab's
;;     message — a click on a box writes its id there (:b7, or @b7 in a message), as a click on a cell does in
;;     a spreadsheet's formula. It waits for one when what is before the cursor ends with a space, ( [ {, or the
;;     : or @ that begins an id; otherwise a click on a box does what it always does.

(defn cm-of
  "The CodeMirror view of a wrapper made by 14-editor.cljs, if its text is where the focus is (asked of the
   document's active element: the view's own hasFocus is false while the window itself is not in front)."
  [ed] (when-let [v (some-> ed .-view)] (when (identical? (.-activeElement js/document) (.-contentDOM v)) v)))

(declare mark-picking!)

;; ───── the line of the REPL on the patch, as an editor (the same as the REPL's) ─────
;; The field of a new box becomes a line of the REPL when what is written in it starts with ( (05-gestures.cljs);
;; once the code editor is loaded, that line is one, as the REPL at the bottom is: completion of Kairotic's
;; commands and clojure.core, brackets closed and matched, Enter runs it once its brackets are balanced
;; (Shift+Enter: a new line), ↑ ↓ the REPL's history, Esc closes it. What it gave shows below it.

(defonce line-ed (atom nil))   ; {:ed editor :el the line :words what it completes} while the line is open

(defn close-repl-line!
  "Closes the line of the REPL on the patch, without running anything."
  []
  (when-let [{:keys [ed el]} @line-ed]
    (reset! line-ed nil)
    (try (.destroy ed) (catch :default _ nil))
    (.remove el)
    (mark-picking!)))

(defn repl-line-text "What is written in the line of the REPL on the patch (nil if it is not open)." []
  (some-> @line-ed :ed .getValue))

(defn open-repl-cm!
  "Opens the line of the REPL on the patch as a code editor (cm, the editor's module), at x y, with text."
  [cm x y text]
  (close-repl-line!)
  (let [el (js/document.createElement "div") host (js/document.createElement "div")
        out (js/document.createElement "div")
        ed (atom nil) hidx (atom nil)
        free? (fn [] (not (.completing @ed)))
        start (if (= "(" (str/trim (str text))) "()" (str text))
        words (vec (concat (command-words) (ns-names 'clojure.core "")))
        [px py] (wrap-px x (- y 4))
        run (fn []
              (let [code (str/trim (.getValue @ed))]
                (if (str/blank? code)
                  (close-repl-line!)
                  (do (reset! hidx nil)
                      (repl-line-run! code out)
                      (.setValue @ed "")
                      (.focus @ed)))
                true))
        recall (fn [up?]
                 (let [h (:hist @ui) n (count h)]
                   (when (pos? n)
                     (let [i (if up? (max 0 (dec (or @hidx n))) (min n (inc (or @hidx n))))]
                       (reset! hidx i)
                       (.setValue @ed (if (< i n) (nth h i) ""))
                       (.cursorToEnd @ed)
                       true))))]
    (set! (.-id el) "repl-line")
    (set! (.-className el) "edit as-repl repl-line")
    (set! (.-className host) "repl-line-host")
    (set! (.-id out) "box-edit-out")
    (set! (.-className out) "edit-out")
    (set! (.. el -style -left) (str px "px"))
    (set! (.. el -style -top) (str py "px"))
    (.appendChild el host)
    (.appendChild el out)
    ;; keys typed in it are its own: a space is not ▶, Delete does not delete a box
    (.addEventListener el "keydown" (fn [e] (.stopPropagation e)))
    (.appendChild ($ "canvas-wrap") el)
    (reset! ed ((.-createEditor cm)
                #js {:parent host :doc start :language "clojurescript" :gutter false
                     :placeholder "(command) · Enter runs it · Esc closes"
                     :words (clj->js words)
                     :onCancel (fn [] (close-repl-line!))
                     :keys #js [#js {:key "Enter" :run (fn [] (when (and (free?) (balanced? (.getValue @ed))) (run)))}
                                #js {:key "Shift-Enter" :run (fn [] (.newline @ed) true)}
                                #js {:key "ArrowUp" :run (fn [] (boolean (and (free?) (= 1 (.cursorLine @ed)) (recall true))))}
                                #js {:key "ArrowDown" :run (fn [] (boolean (and (free?) (= (.cursorLine @ed) (.lineCount @ed)) (recall false))))}]}))
    (.setAttribute (.-contentDOM (.-view @ed)) "aria-label" "A line of the REPL")
    (reset! line-ed {:ed @ed :el el :words words})
    ;; the cursor inside the brackets of a new line, or at the end of what was written
    (let [v (.-view @ed)]
      (.dispatch v #js {:selection #js {:anchor (if (= start "()") 1 (count start))}}))
    (.focus @ed)
    ;; leaving it closes it (a click on a box that writes its id keeps the focus here)
    (.addEventListener el "focusout"
      (fn [_] (js/setTimeout (fn [] (when (and (= el (:el @line-ed)) (not (.contains el (.-activeElement js/document))))
                                      (close-repl-line!)))
                             0)))
    @ed))

(defn upgrade-repl-line!
  "The field of a new box that became a line of the REPL (input inp, at x y), as a code editor once it is loaded;
   until then, or without it, the field itself is the line. close-field! removes the field without running it."
  [inp x y close-field!]
  (.then (load-cm)
         (fn [cm]
           (when (and cm (.-createEditor cm) (.-isConnected inp))
             (let [text (.-value inp)]
               (close-field!)
               (open-repl-cm! cm x y text))))))

(defn id-target
  "Where an id would be written now: {:cm view :mark \":\"}, {:el input :mark \":\" or \"@\"}, or nil."
  []
  (let [a (.-activeElement js/document) id (some-> a .-id)]
    (cond
      (cm-of (:ed @line-ed)) {:cm (cm-of (:ed @line-ed)) :mark ":"}
      (cm-of @repl-ed) {:cm (cm-of @repl-ed) :mark ":"}
      (cm-of @code-ed) {:cm (cm-of @code-ed) :mark ":"}
      (#{"repl-in" "code"} id) {:el a :mark ":"}
      (and (= id "box-edit") (.contains (.-classList a) "as-repl")) {:el a :mark ":"}
      (= id "talk-say") {:el a :mark "@"}
      :else nil)))

(defn before-cursor
  "The text before the cursor of a target."
  [{:keys [cm el]}]
  (cond cm (let [h (.. cm -state -selection -main -from)] (.sliceDoc (.-state cm) 0 h))
        el (subs (str (.-value el)) 0 (or (.-selectionStart el) (count (.-value el))))
        :else ""))

(defn waits-for-id?
  "Does the text before the cursor wait for a box: not empty, and ending with a space, ( [ {, or the mark."
  [t before]
  (and (seq (str/trim before))
       (boolean (re-find (re-pattern (str "[\\s(\\[{" (if (= "@" (:mark t)) "@" ":") "]$")) before))))

(defn picking-target
  "The target, when a click on a box would write its id there; nil otherwise."
  []
  (when-not (locked?)
    (when-let [t (id-target)]
      (when (waits-for-id? t (before-cursor t)) t))))

(defn write-id!
  "Writes the id of box id at the cursor of target t (after its mark, if it is already there), then a space."
  [t id]
  (let [before (before-cursor t)
        mark (:mark t)
        text (str (if (str/ends-with? before mark) "" mark) (name id) " ")]
    (if-let [cm (:cm t)]
      ;; as typed (input.type): the Clojure editor keeps the space after it, before a closing bracket too
      (let [sel (.. cm -state -selection -main) from (.-from sel)]
        (.dispatch cm #js {:changes #js {:from from :to (.-to sel) :insert text}
                           :selection #js {:anchor (+ from (count text))}
                           :userEvent "input.type"}))
      (let [el (:el t) s (.-selectionStart el) e (.-selectionEnd el)]
        (.setRangeText el text s e "end")
        (.dispatchEvent el (js/Event. "input" #js {:bubbles true}))))))

(defn mark-picking!
  "The patch shows (a copy pointer, a box marked under it) whether a click on a box would write its id."
  []
  (.toggle (.-classList svg) "picking" (some? (picking-target))))

(doseq [ev ["selectionchange" "focusin" "focusout" "keyup" "input"]]
  (.addEventListener js/document ev (fn [_] (mark-picking!)) true))

;; the click: before the patch's own handler (capture), and without taking the focus from the line
(defonce id-click (atom false))

(.addEventListener svg "pointerdown"
  (fn [e]
    (reset! id-click false)
    (when-let [t (picking-target)]
      (when-let [el (when-not (closest e ".port") (closest e ".box"))]
        (let [id (keyword (.. el -dataset -box))]
          (when (get-in (current) [:boxes id])
            (reset! id-click true)
            (.preventDefault e)
            (.stopImmediatePropagation e)
            (write-id! t id)
            ;; the box named lights up a moment
            (.add (.-classList el) "picked")
            (js/setTimeout (fn [] (some-> (.querySelector ($ "scene") (str "g.box[data-box=\"" (name id) "\"]"))
                                          .-classList (.remove "picked")))
                           400)
            (mark-picking!))))))
  true)

;; the press that wrote an id keeps the focus where it was
(.addEventListener svg "mousedown" (fn [e] (when @id-click (.preventDefault e))) true)
(.addEventListener svg "click" (fn [e] (when @id-click (.stopImmediatePropagation e) (reset! id-click false))) true)

;; ───── keys on the patch: ( opens a line of the REPL, I shows every id ─────

(defonce last-patch-pt (atom nil))   ; where the pointer last was over the patch, in patch coordinates
(.addEventListener svg "pointermove" (fn [e] (reset! last-patch-pt (pt e))))
(.addEventListener svg "pointerleave" (fn [_] (reset! last-patch-pt nil)))

(defn patch-middle
  "The middle of the part of the patch on screen, in patch coordinates."
  []
  (let [w ($ "canvas-wrap")]
    [(+ (.-scrollLeft w) (* 0.3 (.-clientWidth w))) (+ (.-scrollTop w) (* 0.4 (.-clientHeight w)))]))

(defn open-repl-line!
  "Opens a line of the REPL on the patch, where the pointer is (or in the middle of what is on screen)."
  []
  (let [[x y] (or @last-patch-pt (patch-middle))]
    (open-editor! {:x x :y y :text "("})))

(defn show-ids!
  "Shows the id of every box (true), only of the one hovered or selected (false), or switches."
  ([] (show-ids! (not (.contains (.-classList svg) "show-ids"))))
  ([on]
   (.toggle (.-classList svg) "show-ids" (boolean on))
   (try (.setItem js/localStorage "kairotic.show-ids" (if on "1" "0")) (catch :default _ nil))
   (boolean on)))

(try (when (= "1" (.getItem js/localStorage "kairotic.show-ids")) (show-ids! true)) (catch :default _ nil))

(.addEventListener js/document "keydown"
  (fn [e]
    (let [a (.-activeElement js/document)
          typing? (or (#{"INPUT" "TEXTAREA" "SELECT"} (some-> a .-tagName)) (some-> a .-isContentEditable))
          k (.-key e)]
      (when (and (not typing?) (not (.-ctrlKey e)) (not (.-metaKey e)) (not (.-altKey e))
                 (.-hidden ($ "manager")) (not (locked?)) (not embed-mode))
        (cond
          (= k "(") (do (.preventDefault e) (open-repl-line!))
          (and (#{"i" "I"} k) (not (:tsel @ui)) (not (:nsel @ui))) (do (.preventDefault e) (show-ids!))
          :else nil)))))
