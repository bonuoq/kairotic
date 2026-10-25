;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 6 of 12: gestures
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── gestures in the patch ─────────────────────────

(def svg ($ "canvas"))

(defn pt
  "Pointer position in patch coordinates (even when the patch is shown scaled)."
  [e]
  (let [p (.createSVGPoint svg)]
    (set! (.-x p) (.-clientX e))
    (set! (.-y p) (.-clientY e))
    (let [q (.matrixTransform p (.inverse (.getScreenCTM svg)))]
      [(.-x q) (.-y q)])))

(defn closest [e sel] (.closest (.-target e) sel))

;; on touch screens the pointer is captured: look at what is under the finger
(defn under [e sel]
  (when-let [el (.elementFromPoint js/document (.-clientX e) (.-clientY e))] (.closest el sel)))

(defn drop-target
  "Box under the pointer (other than the source one) and its inlet nearest to the cursor."
  [e wire]
  (when-let [el (under e ".box")]
    (let [id (keyword (.. el -dataset -box)) b (get-in (current) [:boxes id])]
      (when (and b (not= id (:from wire)))
        (let [[ins _] (io b) [w _] (box-dims id b) [x _] (pt e)]
          (when (pos? ins)
            [id (apply min-key (fn [i] (js/Math.abs (- x (+ (:x b) (port-x w ins i) (/ pw 2))))) (range ins))]))))))

(defn open-editor! [{:keys [id x y text]}]
  (when-let [old ($ "box-edit")] (.remove old))
  (let [inp (js/document.createElement "input") done (atom false)
        finish (fn [commit?]
                 (when-not @done
                   (reset! done true)
                   (let [v (str/trim (.-value inp))]
                     (.remove inp)
                     (when (and commit? (seq v) (not= v text))
                       (cond
                         ;; a component is defined in the Components tab, not drawn in the patch (issue #8)
                         (and (= "component" (klass v)) (nil? id)) (gesture! "(new-component!)")
                         id (do (gesture! (str "(text! " id " " (pr-str v) ")"))
                                (when (= "component" (klass v))
                                  (select-tab! "comp")
                                  (js/setTimeout (fn [] (open-code-editor! id)) 0)))
                         :else (gesture! (str "(box " (pr-str v) " " (js/Math.round x) " " (js/Math.round y) ")")))))))]
    (set! (.-id inp) "box-edit")
    (set! (.-className inp) "edit")
    (set! (.-value inp) (or text ""))
    (set! (.-placeholder inp) "canvas, reader, ramp 0 8 4, number, msg 1, synth~…")
    (let [[px py] (wrap-px x (- y 4))]
      (set! (.. inp -style -left) (str px "px"))
      (set! (.. inp -style -top) (str py "px")))
    (.appendChild ($ "canvas-wrap") inp)
    (.focus inp)
    (.select inp)
    (.addEventListener inp "keydown" (fn [e] (case (.-key e) "Enter" (finish true) "Escape" (finish false) nil)))
    (.addEventListener inp "blur" (fn [_] (finish true)))))

;; ───── typing a number into a numeric control (issue #32) ─────
;; A double-click on a number box, on a component whose :gesture gives numbers (a knob), on a parameter
;; of a code box (its slider or its value) or on such a control presented in the panel of a sub-patch
;; opens a small field with its value. Enter, or leaving the field, applies what is typed as the same
;; gesture a drag leaves in the history; Esc closes it with no change.

(defn typed-number
  "The number written in s, or nil: 440, -3.5, .25, 1e-3, a decimal comma (0,5) or a ratio (3/2)."
  [s]
  (let [t (str/replace (str/trim (str s)) #"\s+" "")
        t (if (and (str/includes? t ",") (not (str/includes? t "."))) (str/replace t "," ".") t)
        num (fn [u] (when (re-matches #"[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?" u)
                      (let [v (js/Number u)] (when (js/isFinite v) v))))]
    (if-let [[_ a b] (re-matches #"([^/]+)/([^/]+)" t)]
      (let [x (num a) y (num b)] (when (and x y (not (zero? y))) (/ x y)))
      (num t))))

(defn typed-str
  "A typed number as it is written in the field and in the code of the gesture: up to six decimals, so
   it is kept as typed (a drag rounds what it sends to three) without the noise of a float."
  [v] (let [r (cv/round-to v 6)] (if (= r (js/Math.round r)) (str (js/Math.round r)) (str r))))

(defn open-number-input!
  "A small field over a numeric control at x y (patch coordinates), with its value. Enter, or leaving the
   field, gives the number typed to commit!; Esc closes it and calls cancel!, if given (it undoes what
   the first click of the double-click did). What is not a number is not applied: on Enter the field
   stays open and says so; on leaving it, it closes as with Esc. The field opens after the click that
   asked for it has ended, so that click does not take the focus away from it."
  [{:keys [x y value commit! cancel!]}]
  (js/setTimeout
   (fn []
     (when-let [old ($ "num-edit")] (.remove old))
     (let [inp (js/document.createElement "input") done (atom false)
           close! (fn [] (reset! done true) (.remove inp))
           finish (fn [how]
                    (when-not @done
                      (let [v (typed-number (.-value inp))]
                        (cond
                          (and (not= how :cancel) (some? v)) (do (close!) (commit! v))
                          (= how :enter) (do (.add (.-classList inp) "bad")
                                             (set! (.-title inp) "Not a number (440, -3.5, 0,5, 3/2) · Esc closes"))
                          :else (do (close!) (when cancel! (cancel!)))))))]
       (set! (.-id inp) "num-edit")
       (set! (.-className inp) "edit num")
       (.setAttribute inp "inputmode" "decimal")
       (.setAttribute inp "aria-label" "Value")
       (set! (.-value inp) (if (number? value) (typed-str value) ""))
       (let [[px py] (wrap-px x y)]
         (set! (.. inp -style -left) (str px "px"))
         (set! (.. inp -style -top) (str py "px")))
       (.appendChild ($ "canvas-wrap") inp)
       (.focus inp)
       (.select inp)
       (.addEventListener inp "input" (fn [_] (.remove (.-classList inp) "bad") (set! (.-title inp) "")))
       (.addEventListener inp "keydown"
         (fn [e] (case (.-key e)
                   "Enter" (do (.preventDefault e) (finish :enter))
                   "Escape" (do (.preventDefault e) (finish :cancel))
                   nil)))
       (.addEventListener inp "blur" (fn [_] (finish :blur)))))
   0))

(defn double-click-on
  "When this pointerdown is the second of a double-click on control k, the first click [k ms before];
   otherwise nil, and this click is remembered (with `before`, the value the control had before it). The
   first click redraws the box, so the browser's dblclick does not reach it: as for the code row, the
   double-click is detected here."
  [k before]
  (let [now (js/Date.now) [lk lt :as first-click] (:num-click @ui)]
    (if (and (= lk k) (< (- now lt) 450))
      (do (swap! ui assoc :num-click nil) first-click)
      (do (swap! ui assoc :num-click [k now before]) nil))))

(defn el-box [el]
  (let [id (keyword (.. el -dataset -box)) b (get-in (current) [:boxes id])] [id (when b (view-box b))]))

(defn pos-click!
  "Ask a buffer for an exact position: the box sends it through its left outlet (and marks it)."
  [id t]
  (gesture! (str "(send! " id " " (cv/fmt (max 0 t)) ")")))

(defn pts-code [pts] (str "[" (str/join " " (map (fn [[t f]] (str "[" (cv/fmt t) " " (cv/fmt f) "]")) pts)) "]"))

;; ───── editing a tree from its score (Study 20) ─────
;; A score that shows a tree coming from a tree box knows, for every note it draws, where that note is
;; written (kairotic.mt/expand-source). Click a note to select it; ↑ ↓ change its pitch (⇧ an octave),
;; + − double or halve its duration, ← → select the previous or next one, Delete turns it into a rest.
;; A rest can be selected too: Enter makes it a note (the pitch of the note before it), ↑ ↓ a note a step
;; above or below that one (⇧ an octave), and a letter a…g the nearest note of that name; on a note, a
;; letter changes its pitch to the nearest one of that name.
;; Every change is one (tree-edit! …) of the tree box: a node edit in its history.

(defn tsel-piece-id
  "The id, in the drawn score, of the selected note (it changes when the score is drawn again)."
  [ts pieces]
  (or (when (some (fn [pc] (= (:id pc) (:id ts))) pieces) (:id ts))
      (:id (first (filter (fn [pc] (= (:src pc) (:src ts))) pieces)))))

(defn select-tree-note! [score-id piece from]
  (swap! ui assoc :sel nil :nsel nil :tsel {:score score-id :from from :src (:src piece) :id (:id piece)})
  (render-scene (current)))

(defn writable-target
  "Edits that make a written note editable (a melody string becomes its nodes) and the path of the note:
   [ops path], or nil if it comes from a fragment (:defs)."
  [t {:keys [src sub use rtm]}]
  (cond
    (or use rtm (nil? src)) nil
    (nil? sub) [[] src]
    :else (let [s (mt/node-at t src) nodes (mt/melody s) parent (pop src) idx (peek src)]
            [(into [[:remove src]] (map-indexed (fn [k n] [:insert (conj parent (+ idx k)) n]) nodes))
             (into (conj parent (+ idx (first sub))) (rest sub))])))

(defn piece-midi
  "The pitch (MIDI) of a piece of a score drawn from a tree, read from the written tree t; nil for a rest."
  [t {:keys [src sub]}]
  (let [n (mt/node-at t src)
        n (if (and sub (string? n))
            (let [x (nth (mt/melody n) (first sub) nil)] (if (next sub) (nth (mt/kids x) (second sub) nil) x))
            n)
        n (if (= :chord (mt/tag n)) (first (filter (fn [k] (= :note (mt/tag k))) (mt/kids n))) n)]
    (when (= :note (mt/tag n)) (mt/midi-of (mt/attrs n)))))

(def letter-pcs {"c" 0 "d" 2 "e" 4 "f" 5 "g" 7 "a" 9 "b" 11})

(defn nearest-pc
  "The pitch nearest m whose pitch class is pc."
  [m pc]
  (let [r (js/Math.round m)]
    (first (sort-by (fn [x] (js/Math.abs (- x m))) (filter (fn [x] (= pc (mod x 12))) (range (- r 6) (+ r 7)))))))

(defn tree-key!
  "A key on the selected note (or rest) of a score."
  [k shift?]
  (let [{:keys [score from] :as ts} (:tsel @ui)
        pieces (get-in @score-cache [score :pieces])
        cur (tsel-piece-id ts pieces)
        order (vec (filter :src pieces))
        i (first (keep-indexed (fn [i pc] (when (= (:id pc) cur) i)) order))]
    (cond
      (= k "Escape") (do (swap! ui assoc :tsel nil) (render-scene (current)))
      (#{"ArrowLeft" "ArrowRight"} k)
      (when i (let [j (max 0 (min (dec (count order)) (+ i (if (= k "ArrowLeft") -1 1))))]
                (select-tree-note! score (nth order j) from)))
      :else
      (let [t (tree-data from)
            [pre target] (or (writable-target t (:src ts))
                             (fail (if (:rtm (:src ts))
                                     "That note comes from a proportional rhythm (:rtm): edit its :shares or :pitches"
                                     "That note comes from a fragment (:defs): edit the fragment, or write it out")))
            t1 (reduce mt/apply-op t pre)
            n (mt/node-at t1 target)
            parent (mt/node-at t1 (pop target))
            in-chord? (= :chord (mt/tag parent))
            dur-path (if in-chord? (pop target) target)
            dn (mt/node-at t1 dur-path)
            eff (or (:dur (mt/attrs dn)) (:dur (mt/attrs (mt/node-at (mt/explicit t1) dur-path))) 1)
            nxt-path (conj (pop dur-path) (inc (peek dur-path)))
            nxt (mt/node-at t1 nxt-path)
            keep-next (when (and (mt/node? nxt) (#{:note :rest :chord} (mt/tag nxt)) (nil? (:dur (mt/attrs nxt))))
                        [[:attrs nxt-path (assoc (mt/attrs nxt) :dur eff)]])
            ;; the pitch a rest becomes: from the note before it in the score (or after it), else B4
            staff (:staff (nth order (or i 0) nil))
            same (fn [pcs] (filter (fn [pc] (= staff (:staff pc))) pcs))
            near (or (last (keep (fn [pc] (piece-midi t (:src pc))) (same (take (or i 0) order))))
                     (first (keep (fn [pc] (piece-midi t (:src pc))) (same (drop (inc (or i 0)) order))))
                     71)
            to-note (fn [m] [[:set dur-path (mt/make :note (assoc (dissoc (mt/attrs n) :dur) :pitch (mt/pitch-name (js/Math.round m)) :dur eff) [])]])
            letter (get letter-pcs (str/lower-case k))
            edits (case (if (and (= :rest (mt/tag n)) (#{"ArrowUp" "ArrowDown" "Enter"} k)) :rest->note (if letter :letter k))
                    :rest->note
                    (into (to-note (case k "ArrowUp" (+ near (if shift? 12 1)) "ArrowDown" (- near (if shift? 12 1)) near)) keep-next)
                    :letter
                    (case (mt/tag n)
                      :rest (into (to-note (nearest-pc near letter)) keep-next)
                      :note [[:attrs target (mt/set-midi (mt/attrs n) (nearest-pc (mt/midi-of (mt/attrs n)) letter))]]
                      nil)
                    ("ArrowUp" "ArrowDown")
                    (when (= :note (mt/tag n))
                      (let [m (mt/midi-of (mt/attrs n)) d (* (if shift? 12 1) (if (= k "ArrowUp") 1 -1))]
                        [[:attrs target (mt/set-midi (mt/attrs n) (+ m d))]]))
                    ("+" "=" "-")
                    (into [[:attrs dur-path (assoc (mt/attrs dn) :dur (* eff (if (= k "-") 0.5 2)))]] keep-next)
                    ("Delete" "Backspace")
                    (if (and in-chord? (> (count (filter mt/node? (mt/kids parent))) 1))
                      [[:remove target]]
                      (into [[:set dur-path [:rest {:dur eff}]]] keep-next))
                    nil)]
        (when (seq edits)
          (let [ops (into pre edits)]
            (if (= score from)
              ;; a tree box shown as a score (discussion #30): its notes edit its own tree, directly
              (do (swap! ui assoc :tsel (assoc ts :src {:src (if (#{"Delete" "Backspace"} k) dur-path target)} :id nil))
                  (gesture! (str "(tree-edit! " from " " (str/join " " (map pr-str ops)) ")")))
              ;; a score box: the edits leave it by its third outlet; connected back to the tree box, they
              ;; change it, and the tree, changed, comes back to the score
              (do (when-not (some (fn [[a o]] (and (= a score) (= o 2))) (:lines (current)))
                    (fail (str "To edit " from " from this score, connect the score's third outlet (edits) to " from
                               ", or show " from " itself as a score: (view " from " :score)")))
                  (swap! ui assoc :tsel (assoc ts :src {:src (if (#{"Delete" "Backspace"} k) dur-path target)} :id nil))
                  (eng/emit! (fn [] (work-patch)) (fid score) 2 [:edit ops])))
            (render-scene (current))))))))

(defn score-click!
  "Click on a score: a note picks its stroke; elsewhere, the nearest position of that system is requested."
  [e id b x y]
  (let [gn (or (.closest (.-target e) "g.note") (.closest (.-target e) "g.rest"))
        m (when gn (re-matches #"n-([^-]+)-([^-]+)-(\d+)" (str (.-id gn))))
        tid (when m (keyword (nth m 2)))
        c (get @score-cache id)
        piece (when (and gn (:from c)) (first (filter (fn [pc] (= (:id pc) (.-id gn))) (:pieces c))))]
    (cond
      (and piece (:src piece))
      (select-tree-note! id piece (:from c))
      (and tid (get-in b [:data :strokes tid]))
      (swap! ui assoc :sel nil :nsel [id tid])
      :else
      (let [lx (- x (:x b) 4) ly (- y (:y b) hdr 4)
            as (filter (fn [a] (<= (:y0 a) ly (:y1 a))) (get-in @score-cache [id :anchors]))]
        (swap! ui assoc :sel nil :nsel nil :tsel nil)
        (when (seq as)
          (pos-click! id (:t (apply min-key (fn [a] (js/Math.abs (- (:x a) lx))) as))))))))

(defn snap-t [d t] (let [q (cv/quantize-t (:gx d) t)] (if (cv/generic? d) q (max 0 q))))
(defn snap-f [d f] (cv/quantize-f (:gy d) f))

(defn number-value [id b]
  (let [v (or (second (last-shown id)) (get-in @eng/rt [:states (fid id)]) (eng/num-of (first (eng/args-of (:text b)))) 0)]
    (if (number? v) v 0)))

;; the code of a box opens in the editor window (14-editor.cljs)
(declare open-code-editor!)

(defn data-header?
  "Is (x, y) on the right half of the header of a box whose data can be edited as text (not a code box,
   whose code row opens it)? There a double-click opens its data in the code window (discussion #30)."
  [id b x y]
  (let [[w _] (box-dims id b)]
    (boolean (and (comp/source-of b) (not= :code (display-of b))
                  (<= (:y b) y (+ (:y b) hdr)) (> x (+ (:x b) (/ w 2)))))))

(defn param-k
  "How a parameter is named in a message: a keyword if possible (:cutoff), otherwise a string."
  [label] (if (re-matches #"[A-Za-z][A-Za-z0-9_\-]*" (str label)) (keyword label) (str label)))

(defn param-of [b label] (first (filter (fn [p] (= (:label p) label)) (code-params b))))

(defn value-at-x [b p x]
  (let [[w _] (box-dims nil b) tw (- w param-x0 64)
        u (max 0 (min 1 (/ (- x (:x b) param-x0) tw)))
        v (+ (:min p) (* u (- (:max p) (:min p))))
        st (:step p)]
    (cv/round-to (if (and (number? st) (pos? st)) (* st (js/Math.round (/ v st))) v) 4)))

(defn send-quiet! [id v]
  (let [was-on (eng/running?)]
    (inject-local! (fid id) 0 v)
    (when-not was-on (transport-info!) (js/requestAnimationFrame (fn [_] (live!))))
    (render-overlay!)))

(defn send-flat-quiet! [f v]
  (let [was-on (eng/running?)]
    (inject-local! f 0 v)
    (when-not was-on (transport-info!) (js/requestAnimationFrame (fn [_] (live!))))
    (render-overlay!)))

(defn ctl-gesture!
  "Calls the :gesture of the box being dragged; if the value changes, sends it to its inlet 0."
  [x y fine]
  (when-let [{:keys [f b ox oy x0 y0 start hit] :as cd} (:ctldrag @ui)]
    (let [v (try ((:gesture (box-def b))
                  (assoc (ctl-m* f b) :start start :x (- x ox) :y (- y oy) :dx (- x x0) :dy (- y y0) :fine (boolean fine) :hit hit))
                 (catch :default e (js/console.error "gesture" e) nil))]
      (swap! ui update :ctldrag assoc :x x :y y :fine (boolean fine))
      (when (and (some? v) (not= v (:v cd)))
        (swap! ui assoc-in [:ctldrag :v] v)
        (send-flat-quiet! f v)))))

(defn ctl-release-value
  "On release, the :gesture of the box is asked once more with :up true; what it returns is the value
  that stays in the history. A :gesture that ignores :up returns the last value, as before."
  [{:keys [f b ox oy x0 y0 x y fine start v hit]}]
  (let [x (or x x0) y (or y y0)
        u (try ((:gesture (box-def b))
                (assoc (ctl-m* f b) :start start :x (- x ox) :y (- y oy) :dx (- x x0) :dy (- y y0)
                       :fine (boolean fine) :up true :hit hit))
               (catch :default e (js/console.error "gesture" e) v))]
    (if (some? u) u v)))

(defn ctl-commit!
  "Leaves the value v of a control in the history, as its drag does on release: a box whose class keeps
   it (:persist, a knob) is rewritten with its new arguments (this tab already sent the value); any other
   sends it as a gesture, whose code starts with `echo` ((send! :b3 … or (send-to! :b7.b4 …), the number
   written by `fmt`."
  [{:keys [f id echo]} v fmt]
  (let [b (when id (get-in (current) [:boxes id])) d (when b (box-def b))]
    (if (and b (:persist d))
      (when (some? v)
        (let [t (comp/args-text d (klass (:text b)) (merge (comp/args-for d (:text b)) ((:persist d) v)))]
          ;; this tab already sent the value: the new text need not send it again
          (swap! echoed assoc f t)
          (when (not= t (:text b)) (gesture! (str "(text! " id " " (pr-str t) ")")))))
      (gesture! (str echo (cond (number? v) (fmt v) (some? v) (pr-str v) :else ":bang") ")")))))

(defn send-to!
  "Sends a message to inlet 0 of a box inside a sub-patch of this view: (send-to! :b7.b4 0.5)."
  [rel v]
  (let [was-on (eng/running?)]
    (inject-local! (eng/flat-id (cmd-path) rel) 0 v)
    (when-not was-on (transport-info!) (js/requestAnimationFrame (fn [_] (live!))))
    v))

(defn start-ctl-drag!
  ([f b ox oy x y echo] (start-ctl-drag! f b ox oy x y echo false))
  ([f b ox oy x y echo fine]
   (swap! ui assoc :sel nil :nsel nil
          :ctldrag {:f f :b b :ox ox :oy oy :x0 x :y0 y :start (second (shown-flat f)) :v nil :echo echo
                    ;; the part of its view pressed (a shape with :hit), worked out from the shapes themselves
                    :hit (try (shp/hit-near (ctl-shapes* (ctl-m* f b) b) [(- x ox) (- y oy)]) (catch :default _ nil))})
   (ctl-gesture! x y fine)))

;; ───── the number typed, for each kind of control (issue #32) ─────

(defn ctl-number
  "The number a control with a :gesture (engine id f) holds now, or nil if its gesture does not give
   numbers (a keyboard gives notes): what it last showed, its state, or what its gesture gives at rest."
  [f b]
  (let [g (:gesture (box-def b))]
    (when (fn? g)
      (let [m (ctl-m* f b)
            at-rest (try (g (assoc m :start (:shown m) :x 0 :y 0 :dx 0 :dy 0 :fine false))
                         (catch :default _ nil))]
        (when (number? at-rest)
          (first (filter number? [(:shown m) (:state m) at-rest])))))))

(defn ctl-typed!
  "A number typed into a control with a :gesture (cd as for a drag: :f :b :id :echo). One that keeps its
   value in its text (a knob) gets it first, so the text keeps what its :receive made of it (a knob keeps
   it between its min and max); any other is sent it by the gesture itself."
  [{:keys [f b id] :as cd} v]
  (if (and id (:persist (box-def b)))
    (do (send-flat-quiet! f v)
        (let [st (get-in @eng/rt [:states f])] (ctl-commit! cd (if (number? st) st v) typed-str)))
    (ctl-commit! cd v typed-str)))

(defn type-ctl!
  "Opens the field over a control with a :gesture whose top-left corner is at x y and size [w h]."
  [cd x y [w h] v]
  (open-number-input! {:x x :y (+ y (max 0 (- (/ h 2) 13))) :value v :commit! (fn [n] (ctl-typed! cd n))}))

(defn type-number-box!
  "Opens the field over the number box id."
  [id b]
  (open-number-input! {:x (+ (:x b) grip) :y (- (:y b) 2) :value (number-value id b)
                       :commit! (fn [n] (gesture! (str "(send! " id " " (typed-str n) ")")))}))

(defn param-typed-value
  "A typed value for parameter p of a code box, kept between its min and max (Faust clamps it too: so
   the history keeps what sounds)."
  [p v] (if (< (:min p) (:max p)) (max (:min p) (min (:max p) v)) v))

(defn send-param! [id label v]
  (gesture! (str "(send! " id " [" (pr-str (param-k label)) " " (typed-str v) "])")))

(defn type-param!
  "Opens the field over parameter `label` of code box id. `before` is the value it had before the first
   click of the double-click (a click on the slider moves it there): Esc puts that back."
  [id b label before]
  (let [{:keys [y-par params]} (code-geom b)
        i (or (first (keep-indexed (fn [i q] (when (= (:label q) label) i)) params)) 0)
        p (nth params i nil)]
    (when p
      (open-number-input!
       {:x (+ (:x b) param-x0) :y (+ (:y b) y-par (* i param-h) -4) :value before
        :commit! (fn [n] (send-param! id label (param-typed-value p n)))
        :cancel! (fn [] (when (and (number? before) (not= before (param-value id b p))) (send-param! id label before)))}))))

;; ───── selection: one box, several (⇧+click or a frame drawn on the paper), moved or deleted together ─────
;; A plain click selects a box and moves it; ⌘/Ctrl+click also opens its inspector (its arguments and text).

(defn scene-boxes
  "The boxes on screen, where they are drawn (their presentation places, in presentation)."
  [] (:boxes (scene-of (current))))

(defn group-drag
  "Several boxes start moving together from the pointer at x y (nil if none of them is on screen)."
  [ids x y]
  (let [bs (scene-boxes)
        from (into {} (for [id ids :let [b (get bs id)] :when b] [id [(:x b) (:y b)]]))]
    (when (seq from) {:ids from :x0 x :y0 y :gx 0 :gy 0 :moved false})))

;; In presentation (issue #57) the paper is for playing: no new boxes, no wires, no selection with the mouse
;; (no frame, ⇧+click, ⌘/Ctrl+click, ⌘/Ctrl+A; a click does not select, so Delete cannot remove a box). In the
;; editor's Present a box can still be dragged to a new place, one at a time; in a Release/Perform embed not.

(defn locked? "In presentation: the paper is for playing." [] (boolean @pres-mode))

;; ⌥/Alt held at the last press: in presentation, only ⌥+drag moves a box (a plain drag plays it, or
;; does nothing), so that a freqt, a canvas or a knob is not moved by its header or its grip by mistake
(defonce alt-press (atom false))

(defn pick-box!
  "A plain click on a box: if it is one of several selected, they all start moving; otherwise it alone is
   selected (its inspector closed) and starts moving. `extra` is merged into the ui state. In presentation
   nothing is selected: in the editor ⌥+drag moves the box to a new place (a plain drag leaves it where it
   is), in an embed it stays."
  ([id b x y] (pick-box! id b x y nil))
  ([id b x y extra]
   (let [ids (sel-ids)]
     (cond
       (locked?)
       (swap! ui merge {:sel nil :insp nil :nsel nil
                        :drag (when (and (not embed-mode) @alt-press)
                                {:id id :dx (- x (:x b)) :dy (- y (:y b)) :x (:x b) :y (:y b) :moved false})}
              extra)
       (and (> (count ids) 1) (contains? ids id))
       ;; released without moving, the click selects that box alone (see end-gesture!)
       (swap! ui merge {:nsel nil :drag (some-> (group-drag ids x y) (assoc :clicked id))} extra)
       :else
       (swap! ui merge {:sel [:box id] :insp nil :nsel nil
                        :drag {:id id :dx (- x (:x b)) :dy (- y (:y b)) :x (:x b) :y (:y b) :moved false}}
              extra)))))

(defn inspect-box!
  "⌘/Ctrl+click on a box: selects it, opens its inspector, and it can be moved."
  [id b x y]
  (swap! ui assoc :sel [:box id] :insp id :nsel nil :tsel nil
         :drag {:id id :dx (- x (:x b)) :dy (- y (:y b)) :x (:x b) :y (:y b) :moved false}))

(defn shift-pick
  "The box a ⇧+click adds to (or takes out of) the selection; nil where ⇧ already means something else
   (on the drawing area of a canvas or a freqt it draws a straight stroke; on the body of a box with a
   :gesture it is part of the gesture, fine control or a chord: there the grip selects)."
  [e]
  (when (and (.-shiftKey e) (not (closest e ".port")) (not (locked?)))
    (when-let [el (closest e ".box")]
      (let [[id b] (el-box el)]
        (when (and b (not (and (closest e ".mus-body") (= :canvas (display-of b))))
                   (not (and (closest e ".box.act") (not (closest e ".grip")) (fn? (:gesture (box-def b))))))
          id)))))

(defn toggle-box!
  "⇧+click: the box joins the selection, or leaves it; what stays selected can be dragged at once."
  [id x y]
  (let [ids (sel-ids) now (if (contains? ids id) (disj ids id) (conj ids id))]
    (swap! ui assoc :sel (sel-of now) :insp nil :nsel nil :tsel nil
           :drag (when (contains? now id) (group-drag now x y)))))

(defn group-offset
  "The offset of a group being dragged, stopped so that no box goes past the top or the left edge."
  [{:keys [ids x0 y0]} x y]
  [(max (- x x0) (- (apply min (map first (vals ids)))))
   (max (- y y0) (- (apply min (map second (vals ids)))))])

;; the frame: drawn from an empty place of the paper, it selects every box it touches (⇧ adds to the selection)

(defn marquee-rect [{:keys [x0 y0 x y]}]
  [(min x0 x) (min y0 y) (js/Math.abs (- x x0)) (js/Math.abs (- y y0))])

(defn marquee-hits
  "The boxes on screen that the frame touches."
  [m]
  (let [[mx my mw mh] (marquee-rect m)]
    (set (for [[id b] (scene-boxes)
               :let [[w h] (box-dims id b)]
               :when (and (< mx (+ (:x b) w)) (< (:x b) (+ mx mw)) (< my (+ (:y b) h)) (< (:y b) (+ my mh)))]
           id))))

(defn mark-hits!
  "Marks on screen the boxes the frame is touching (without drawing the whole patch again)."
  [hits]
  (doseq [el (array-seq (.querySelectorAll ($ "scene") ".box"))]
    (.toggle (.-classList el) "hit" (contains? hits (keyword (.. el -dataset -box))))))

(defn draw-marquee! [m]
  (let [r (or ($ "marquee")
              (let [r (js/document.createElementNS "http://www.w3.org/2000/svg" "rect")]
                (.setAttribute r "id" "marquee")
                (.setAttribute r "class" "marquee")
                (.appendChild svg r)
                r))
        [x y w h] (marquee-rect m)]
    (.setAttribute r "x" x)
    (.setAttribute r "y" y)
    (.setAttribute r "width" w)
    (.setAttribute r "height" h)
    (mark-hits! (marquee-hits m))))

(defn end-marquee! [m]
  (when-let [r ($ "marquee")] (.remove r))
  (mark-hits! #{})
  (let [hits (if (:moved m) (marquee-hits m) #{})]
    (swap! ui assoc :marquee nil :insp nil :sel (sel-of (if (:add m) (into (:base m) hits) hits)))))

;; on a Mac, Ctrl+click is also a right click: on a box it opens the inspector, not the browser's menu
;; ───── annotating (Study 26): marks drawn on a layer, anchored to the box nearest each point ─────
;; (:annot @ui) = {:tool :draw|:arrow|:text|:move|:erase :layer :notes} while the Annotate bar is open;
;; (:adraw @ui) the mark being drawn. What is drawn stays in the history as (mark …).

(defn drawn-boxes
  "The boxes on screen now, with their place and size: [[id [x y w h]] …]."
  []
  (let [p (scene-of (current))]
    (for [[id b] (:boxes p)] (let [[x y] (box-pos id b) [w h] (box-dims id b)] [id [x y w h]]))))

(defn anchor-of
  "Where a point of a mark is anchored: to the box nearest it (within 150 px), from its top-left corner, or to the paper."
  [[x y]]
  (let [d (fn [[bx by bw bh]] (js/Math.hypot (max 0 (- bx x) (- x (+ bx bw))) (max 0 (- by y) (- y (+ by bh)))))
        [id [bx by] :as best] (first (sort-by (fn [[_ r]] (d r)) (drawn-boxes)))
        r1 (fn [v] (/ (js/Math.round (* 10 v)) 10))]
    (if (and best (< (d (second best)) 150))
      [id (r1 (- x bx)) (r1 (- y by))]
      [:patch (r1 x) (r1 y)])))

(defn annot-layer [] (or (:layer (:annot @ui)) (first (keys (:layers (current)))) :notes))

(defn mark-hit
  "The mark of a shown layer under [x y], or nil."
  [[x y :as q]]
  (let [p (current)
        sd (fn [[px py] [ax ay] [bx by]]
             (let [dx (- bx ax) dy (- by ay) L2 (+ (* dx dx) (* dy dy))
                   u (if (zero? L2) 0 (max 0 (min 1 (/ (+ (* (- px ax) dx) (* (- py ay) dy)) L2))))]
               (js/Math.hypot (- px (+ ax (* u dx))) (- py (+ ay (* u dy))))))]
    (->> (:marks p)
         (filter (fn [[_ m]] (layer-shown? p (:layer m))))
         (keep (fn [[id m]]
                 (when-let [ps (mark-points p m)]
                   (let [dist (if (= :text (:kind m))
                                (let [[[tx ty]] ps] (if (and (<= (- tx 4) x (+ tx (* 8 (count (:txt m))))) (<= (- ty 16) y (+ ty 5))) 0 99))
                                (apply min 99 (map (fn [a b] (sd q a b)) ps (rest ps))))]
                     (when (< dist 8) [dist id])))))
         (sort-by first) first second)))

(defn annot-preview []
  (when-let [{:keys [kind px]} (:adraw @ui)]
    (let [pts (str/join " " (map (fn [[x y]] (str (js/Math.round x) "," (js/Math.round y))) px))]
      (case kind
        :draw (str "<polyline class=\"amark new\" points=\"" pts "\"></polyline>")
        :arrow (str "<polyline class=\"amark new\" points=\"" pts "\"></polyline>")
        ""))))

(defn annot-down! [x y]
  (let [{:keys [tool]} (:annot @ui) lid (annot-layer)]
    (case tool
      :draw (swap! ui assoc :adraw {:kind :draw :px [[x y]]})
      :arrow (swap! ui assoc :adraw {:kind :arrow :px [[x y] [x y]]})
      :text (let [t (str/trim (str (some-> ($ "annot-text") .-value)))]
              (if (seq t)
                (gesture! (str "(mark " lid " " (next-mark-id) " " (pr-str {:kind :text :at (anchor-of [x y]) :txt t}) ")"))
                (some-> ($ "annot-text") .focus)))
      :erase (do (swap! ui assoc :adraw {:kind :erase})
                 (when-let [id (mark-hit [x y])] (gesture! (str "(unmark " id ")"))))
      ;; moving a mark: pressed near one end of a line or an arrow, only that end (it is anchored again where
      ;; it is let go); anywhere else on the mark, all of it (each point keeps its anchor)
      :move (when-let [id (mark-hit [x y])]
              (let [p (current) m (get-in p [:marks id]) ps (when (:pts m) (mark-points p m))
                    near (fn [i] (when-let [[px py] (and ps (nth ps i nil))] (< (js/Math.hypot (- x px) (- y py)) 9)))
                    end (cond (not ps) nil (near 0) 0 (near (dec (count ps))) (dec (count ps)) :else nil)]
                (swap! ui assoc :adraw {:kind :move :id id :x0 x :y0 y :x x :y y :end end})))
      nil)
    (render-layers!)))

(defn annot-move! [x y]
  (when-let [{:keys [kind px]} (:adraw @ui)]
    (case kind
      :draw (let [[lx ly] (peek px)]
              (when (> (js/Math.hypot (- x lx) (- y ly)) 3)
                (swap! ui update-in [:adraw :px] conj [x y])
                (render-layers!)))
      :arrow (do (swap! ui assoc-in [:adraw :px 1] [x y]) (render-layers!))
      :move (do (swap! ui update :adraw assoc :x x :y y) (render-layers!))
      :erase (when-let [id (mark-hit [x y])] (gesture! (str "(unmark " id ")")))
      nil)))

(defn annot-up! []
  (when-let [{:keys [kind px id x0 y0 x y end]} (:adraw @ui)]
    (swap! ui assoc :adraw nil)
    (let [lid (annot-layer)]
      (case kind
        :draw (when (> (count px) 1)
                (let [ps (cv/simplify (vec px) 1.2)]
                  (gesture! (str "(mark " lid " " (next-mark-id) " " (pr-str {:kind :line :pts (mapv anchor-of ps)}) ")"))))
        :arrow (let [[a b] px]
                 (when (> (js/Math.hypot (- (first b) (first a)) (- (second b) (second a))) 8)
                   (gesture! (str "(mark " lid " " (next-mark-id) " " (pr-str {:kind :arrow :pts [(anchor-of a) (anchor-of b)]}) ")"))))
        :move (let [r1 (fn [v] (/ (js/Math.round (* 10 v)) 10)) dx (r1 (- x x0)) dy (r1 (- y y0))
                    p (current) m (get-in p [:marks id])]
                (when (and m (> (+ (js/Math.abs dx) (js/Math.abs dy)) 2))
                  (if (some? end)
                    ;; one end: anchored again where it was let go (to the box nearest it, or to the paper)
                    (let [[ex ey] (nth (mark-points p m) end)]
                      (gesture! (str "(mark " (:layer m) " " id " " (pr-str (dissoc (set-point m end (anchor-of [(+ ex dx) (+ ey dy)])) :layer)) ")")))
                    (gesture! (str "(move-mark " id " " dx " " dy ")")))))
        nil))
    (render-layers!)))

(defn render-annot-bar!
  "The Annotate bar: its tool, its layer and how that layer is shown."
  []
  (let [bar ($ "annot-bar") a (:annot @ui)]
    (when bar
      (set! (.-hidden bar) (nil? a))
      (.toggle (.-classList ($ "annot-toggle")) "on" (some? a))
      (.toggle (.-classList js/document.body) "annotating" (some? (:tool a)))
      (.toggle (.-classList js/document.body) "annot-move" (= :move (:tool a)))
      (when a
        (let [p (current) lid (annot-layer) l (or (get-in p [:layers lid]) layer-default)
              inp ($ "annot-layer")]
          (doseq [btn (array-seq (.querySelectorAll bar "[data-atool]"))]
            (.setAttribute btn "aria-pressed" (str (= (name (or (:tool a) "")) (.. btn -dataset -atool)))))
          (when-not (= inp (.-activeElement js/document)) (set! (.-value inp) (name lid)))
          (set! (.-innerHTML ($ "annot-layers")) (apply str (for [k (sort (map name (keys (:layers p))))] (str "<option value=\"" (esc k) "\"></option>"))))
          (set! (.-textContent ($ "annot-z")) (name (:z l)))
          (set! (.-checked ($ "annot-show-patch")) (contains? (:show l) :patch))
          (set! (.-checked ($ "annot-show-present")) (contains? (:show l) :present)))))))

(defn annotate
  "Opens the Annotate bar (with a tool: :draw :arrow :text :erase), or closes it: (annotate) · (annotate :arrow) · (annotate false)."
  ([] (annotate (if (:annot @ui) false :draw)))
  ([tool]
   (if (false? tool)
     (swap! ui assoc :annot nil :adraw nil)
     (swap! ui assoc :annot {:tool (keyword tool) :layer (annot-layer)} :sel nil))
   (render-layers!)
   (boolean (:annot @ui))))

(.addEventListener ($ "annot-toggle") "click" (fn [_] (annotate)))
(.addEventListener ($ "annot-done") "click" (fn [_] (annotate false)))
(.addEventListener ($ "annot-bar") "click"
  (fn [e] (when-let [b (.closest (.-target e) "[data-atool]")] (annotate (.. b -dataset -atool)))))
(.addEventListener ($ "annot-layer") "change"
  (fn [e] (let [v (str/trim (.. e -target -value))]
            (when (re-matches #"[A-Za-z][A-Za-z0-9_-]*" v) (swap! ui assoc-in [:annot :layer] (keyword v)))
            (render-layers!))))
(.addEventListener ($ "annot-z") "click"
  (fn [_] (let [lid (annot-layer) l (or (get-in (current) [:layers lid]) layer-default)]
            (gesture! (str "(layer " lid " {:z " (if (= :over (:z l)) ":under" ":over") "})")))))
(doseq [[el k] [["annot-show-patch" :patch] ["annot-show-present" :present]]]
  (.addEventListener ($ el) "change"
    (fn [e] (let [lid (annot-layer) l (or (get-in (current) [:layers lid]) layer-default)
                  show ((if (.. e -target -checked) conj disj) (:show l) k)]
              (gesture! (str "(layer " lid " {:show " (pr-str show) "})"))))))

(.addEventListener svg "contextmenu"
  (fn [e] (when (and (.-ctrlKey e) (closest e ".box")) (.preventDefault e))))

(defonce corner-click (atom nil))   ; the last press on the corner of a box: {:id :t} (a double-click resets it)

(.addEventListener svg "pointerdown"
  (fn [e]
    (reset! alt-press (boolean (.-altKey e)))
    (let [[x y] (pt e) mod? (or (.-metaKey e) (.-ctrlKey e))]
      (cond
        ;; annotating: the pointer draws marks (the Annotate bar is open)
        (and (:annot @ui) (:tool (:annot @ui)))
        (do (.preventDefault e) (annot-down! x y))

        (and (closest e ".port.out") (not (locked?)))
        (let [el (closest e ".port.out")]
          (.preventDefault e)
          (swap! ui assoc :wire {:from (keyword (.. el -dataset -box)) :out (js/parseInt (.. el -dataset -out) 10) :x x :y y}))

        ;; the corner of a canvas, freqt or score: drag to resize it (issue #40)
        (closest e ".resize-corner")
        (let [[id b] (el-box (closest e ".resize-corner"))]
          (when b
            (.preventDefault e)
            (let [[w h] (box-size id b) now (js/Date.now) {pid :id pt :t} @corner-click]
              (reset! corner-click {:id id :t now})
              (if (and (= pid id) (< (- now pt) 400))
                ;; a double-click on the corner: back to its default size
                (do (reset! corner-click nil)
                    (when (:size b) (gesture! (str "(resize " id ")"))))
                (swap! ui assoc :sel nil :nsel nil :drag nil
                       :resize {:id id :x0 x :y0 y :w0 w :h0 h :w w :h h :moved false})))))

        ;; ⌘/Ctrl+click anywhere on a box: select it and open its inspector
        (and mod? (closest e ".box") (not (closest e ".port")) (not (locked?)))
        (let [[id b] (el-box (closest e ".box"))]
          (when b
            (.preventDefault e)
            (inspect-box! id b x y)))

        ;; ⇧+click: add the box to the selection, or take it out
        (shift-pick e)
        (do (.preventDefault e)
            (toggle-box! (shift-pick e) x y))

        ;; the chips of a header (discussion #30): ⇄ shows the box in its next view, { } opens its data as text
        (closest e ".hchip")
        (let [el (closest e ".hchip") [id b] (el-box el)]
          (when b
            (.preventDefault e)
            (swap! ui assoc :drag nil)
            (case (.. el -dataset -chip)
              "view" (gesture! (str "(view " id " " (next-view b) ")"))
              "code" (js/setTimeout (fn [] (open-code-editor! id)) 0)
              nil)))

        ;; a control presented in the panel of a sub-patch
        (closest e ".pres-area")
        (let [el (closest e ".pres-area") [id b] (el-box el) kid (keyword (.. el -dataset -kid))
              k (when b (first (filter (fn [k] (= (:id k) kid)) (:kids (panel-layout b)))))]
          (when (and k (fn? (:gesture (box-def (:b k)))))
            (.preventDefault e)
            (let [[kx ky] (kid-origin (:x b) (:y b) k)
                  f (eng/flat-id (conj (cmd-path) id) kid)
                  echo (str "(send-to! " (eng/flat-id [id] kid) " ")
                  v (ctl-number f (:b k))]
              ;; a double-click on a numeric control: its value is typed (issue #32)
              (if (and (number? v) (double-click-on [:kid f] v))
                (type-ctl! {:f f :b (:b k) :echo echo} kx ky [(:w k) (:h k)] v)
                (start-ctl-drag! f (:b k) kx ky x y echo (.-shiftKey e))))))

        ;; action boxes: the grip selects and moves them (⌘/Ctrl+click opens the inspector), the body only plays
        (and (closest e ".box.act") (not (closest e ".grip")) (not (closest e ".port")))
        (let [[id b] (el-box (closest e ".box.act"))]
          (when b
            (.preventDefault e)
            (swap! ui (fn [u] (assoc u :nsel nil :sel (when-not (= (:sel u) [:box id]) (:sel u)))))
            (let [num-box? (= "number" (klass (:text b)))
                  ctl? (fn? (:gesture (box-def b)))
                  cval (when (and ctl? (not num-box?)) (ctl-number (fid id) b))
                  ;; a double-click on a number box, or on a control whose gesture gives numbers:
                  ;; its value is typed (issue #32); the first click did what a click does
                  again? (and (or num-box? (some? cval)) (some? (double-click-on [:box id] nil)))]
              (cond
                (and again? num-box?) (type-number-box! id b)
                again? (type-ctl! {:f (fid id) :b b :id id :echo (str "(send! " id " ")}
                                  (+ (:x b) grip) (:y b) (comp/size-of b) cval)
                num-box? (swap! ui assoc :numdrag {:id id :y0 y :v0 (number-value id b) :v nil})
                ctl? (do (start-ctl-drag! (fid id) b (+ (:x b) grip) (:y b) x y (str "(send! " id " ") (.-shiftKey e))
                         (swap! ui assoc-in [:ctldrag :id] id))
                :else (gesture! (str "(send! " id " :bang)"))))))

        ;; the first click selects the box and redraws it, so the double click is detected here
        (closest e ".code-area")
        (let [[id b] (el-box (closest e ".code-area")) now-ms (js/Date.now) [lid lt] (:last-click @ui)]
          (when b
            (if (and (= lid id) (< (- now-ms lt) 450))
              (do (.preventDefault e)
                  (swap! ui assoc :last-click nil :drag nil)
                  (js/setTimeout (fn [] (open-code-editor! id)) 0))
              (pick-box! id b x y {:last-click [id now-ms]}))))

        (closest e ".param")
        (let [el (closest e ".param") [id b] (el-box el) label (.. el -dataset -param) p (param-of b label)]
          (when p
            (.preventDefault e)
            (swap! ui assoc :sel nil :nsel nil)
            (case (:type p)
              "button" (do (send-quiet! id [(param-k label) 1])
                           (swap! ui assoc :paramdrag {:id id :label label :button true}))
              "checkbox" (let [v (if (pos? (param-value id b p)) 0 1)]
                           (gesture! (str "(send! " id " [" (pr-str (param-k label)) " " v "])")))
              ;; a slider: a double-click types its value (issue #32), the one it had before the first click
              (if-let [[_ _ before] (double-click-on [:param id label] (param-value id b p))]
                (type-param! id b label before)
                (let [v (value-at-x b p x)]
                  (send-quiet! id [(param-k label) v])
                  (swap! ui assoc :paramdrag {:id id :label label :p p :v v}))))))

        ;; the value written beside a slider: a click is a click on the box, a double-click types the value
        (closest e ".pval-hit")
        (let [el (closest e ".pval-hit") [id b] (el-box el) label (.. el -dataset -param) p (param-of b label)]
          (when b
            (if-let [[_ _ before] (when p (double-click-on [:param id label] (param-value id b p)))]
              (do (.preventDefault e)
                  (swap! ui assoc :drag nil)
                  (type-param! id b label before))
              (pick-box! id b x y))))

        (closest e ".stroke-hit")
        (let [el (closest e ".stroke-hit") [id b] (el-box el) tid (keyword (.. el -dataset -stroke))
              d (canvas-data b) tr (get-in d [:strokes tid])]
          (when tr
            (.preventDefault e)
            (swap! ui assoc :sel nil :nsel [id tid]
                   :ldrag {:kind :move :box id :tid tid :g (canvas-geom d id b) :d d :x0 x :y0 y
                           :pts0 (:pts tr) :pts (:pts tr) :dt 0 :dc 0 :moved false})))

        (closest e ".score-slot")
        (let [[id b] (el-box (closest e ".score-slot"))]
          (when b (score-click! e id b x y)))

        (closest e ".mus-body")
        (let [[id b] (el-box (closest e ".mus-body"))]
          (when b
            (case (display-of b)
              :canvas (let [d (canvas-data b) g (canvas-geom d id b)
                             lx (- x (:x b)) ly (- y (:y b))
                             t0 (snap-t d (cv/x->t g lx)) f0 (snap-f d (cv/y->f g ly))
                             mode (cond (.-altKey e) :free (.-shiftKey e) :line :else :note)]
                         (.preventDefault e)
                         (swap! ui assoc :sel nil :nsel nil
                                :ldrag {:kind :draw :mode mode :box id :g g :d d :x0 x :y0 y :bx (:x b) :by (:y b)
                                        :t0 t0 :f0 f0 :click-t (cv/x->t g lx) :raw [[lx ly]] :pts nil :moved false}))
              :score (score-click! e id b x y)
              nil)))

        (closest e ".box")
        (let [el (closest e ".box") id (keyword (.. el -dataset -box)) b (some-> (get-in (current) [:boxes id]) view-box)]
          (when b
            ;; the first click redraws the box, so a double click on a patch box is detected here
            (let [now (js/Date.now) [lid lt] (:last-box-click @ui) again? (and (= lid id) (< (- now lt) 450))]
              (cond
                (and again? (embedded? b) (not (.-altKey e)))
                (do (.preventDefault e)
                    (swap! ui assoc :last-box-click nil :drag nil)
                    (js/setTimeout (fn [] (gesture! (str "(enter " id ")"))) 0))
                ;; a double-click on the right of the header of a box with data opens it as text
                (and again? (data-header? id b x y))
                (do (.preventDefault e)
                    (swap! ui assoc :last-box-click nil :drag nil)
                    (js/setTimeout (fn [] (open-code-editor! id)) 0))
                :else (pick-box! id b x y {:last-box-click [id now]})))))

        (closest e ".wire-hit")
        (let [idx (js/parseInt (.. (closest e ".wire-hit") -dataset -line) 10)]
          (swap! ui assoc :sel [:line (nth (:lines (current)) idx)] :nsel nil))

        ;; an empty place of the paper: a frame starts (a plain click there deselects); in presentation, nothing
        (locked?) (swap! ui assoc :sel nil :nsel nil :tsel nil :insp nil)
        :else (let [add? (.-shiftKey e)]
                (swap! ui assoc :nsel nil :tsel nil :insp nil
                       :sel (when add? (:sel @ui))
                       :marquee {:x0 x :y0 y :x x :y y :moved false :add add? :base (if add? (sel-ids) #{})}))))))

(defn move-ldrag [ld x y]
  (let [{:keys [g d x0 y0 pts0]} ld
        [t0 f0] (first pts0)
        dt (cv/round-to (- (snap-t d (cv/x->t g (+ (cv/t->x g t0) (- x x0)))) t0) 4)
        ft (snap-f d (cv/y->f g (+ (cv/f->y g f0) (- y y0))))
        dc (cv/round-to (cv/delta-y d ft f0) 3)]
    (assoc ld :moved true :dt dt :dc dc :pts (mapv (fn [[t f]] [(+ t dt) (cv/shift-y d f dc)]) pts0))))

(defn draw-ldrag [ld x y]
  (let [{:keys [g d mode t0 f0 bx by raw]} ld
        lx (- x bx) ly (- y by)]
    (case mode
      :note (assoc ld :pts [[t0 f0] [(snap-t d (cv/x->t g lx)) f0]])
      :line (assoc ld :pts [[t0 f0] [(snap-t d (cv/x->t g lx)) (snap-f d (cv/y->f g ly))]])
      :free (let [[px py] (peek raw)
                  far? (if (cv/generic? d) (> (js/Math.hypot (- lx px) (- ly py)) 2) (> lx (+ px 1)))
                  raw (if far? (conj raw [lx ly]) raw)]
               (assoc ld :raw raw :pts (mapv (fn [[px py]] [(cv/x->t g px) (cv/y->f g py)]) raw))))))

(defn hover-hit!
  "The part of a component's view (a shape with :hit) the pointer is over or near, highlighted."
  [e x y]
  (let [el (closest e ".box.act")
        [id b] (when el (el-box el))
        h (when (and b (fn? (:gesture (box-def b))) (not (closest e ".grip")))
            (let [f (fid id)
                  k (try (shp/hit-near (ctl-shapes* (ctl-m* f b) b) [(- x (:x b) grip) (- y (:y b))]) (catch :default _ nil))]
              (when (some? k) [id k])))]
    (when (not= h (:hover-hit @ui))
      (swap! ui assoc :hover-hit h)
      (render-overlay!))))

(.addEventListener svg "pointermove"
  (fn [e]
    (let [[x y] (pt e) {:keys [drag wire ldrag numdrag paramdrag ctldrag marquee resize adraw]} @ui]
      (cond
        adraw (annot-move! x y)
        resize (let [[w0 h0] size-min [w1 h1] size-max
                     w (js/Math.round (max w0 (min w1 (+ (:w0 resize) (- x (:x0 resize))))))
                     h (js/Math.round (max h0 (min h1 (+ (:h0 resize) (- y (:y0 resize))))))]
                 (when (or (not= w (:w resize)) (not= h (:h resize)))
                   (swap! ui assoc :resize (assoc resize :w w :h h :moved true))
                   (render-scene (current))))
        marquee (let [far (> (+ (js/Math.abs (- x (:x0 marquee))) (js/Math.abs (- y (:y0 marquee)))) 3)
                      m (assoc marquee :x x :y y :moved (or (:moved marquee) far))]
                  (swap! ui assoc :marquee m)
                  (when (:moved m) (draw-marquee! m)))
        (and drag (:ids drag))
        (let [[gx gy] (group-offset drag x y)]
          (when (or (:moved drag) (> (+ (js/Math.abs gx) (js/Math.abs gy)) 2))
            (swap! ui assoc :drag (assoc drag :gx gx :gy gy :moved true))))
        ctldrag (ctl-gesture! x y (.-shiftKey e))
        paramdrag (when-not (:button paramdrag)
                    (let [b (get-in (current) [:boxes (:id paramdrag)]) v (value-at-x b (:p paramdrag) x)]
                      (when (not= v (:v paramdrag))
                        (swap! ui assoc :paramdrag (assoc paramdrag :v v))
                        (send-quiet! (:id paramdrag) [(param-k (:label paramdrag)) v]))))
        numdrag (let [inc-size (if (.-shiftKey e) 0.01 0.1)
                      v (cv/round-to (+ (:v0 numdrag) (* inc-size (js/Math.round (- (:y0 numdrag) y)))) 4)]
                  (when (not= v (or (:v numdrag) (:v0 numdrag)))
                    (swap! ui assoc :numdrag (assoc numdrag :v v))
                    (let [was-on (eng/running?)]
                      (inject-local! (fid (:id numdrag)) 0 v)
                      (when-not was-on (transport-info!) (js/requestAnimationFrame (fn [_] (live!)))))
                    (render-overlay!)))
        ldrag (let [far (> (+ (js/Math.abs (- x (:x0 ldrag))) (js/Math.abs (- y (:y0 ldrag)))) 3)]
                (when (or (:moved ldrag) far)
                  (swap! ui assoc :ldrag
                         (if (= :move (:kind ldrag))
                           (move-ldrag ldrag x y)
                           (assoc (draw-ldrag ldrag x y) :moved true)))))
        drag (let [nx (max 0 (- x (:dx drag))) ny (max 0 (- y (:dy drag)))]
               (when (or (:moved drag) (> (+ (js/Math.abs (- nx (:x drag))) (js/Math.abs (- ny (:y drag)))) 2))
                 (swap! ui assoc :drag (assoc drag :x nx :y ny :moved true))))
        wire (swap! ui assoc :wire (assoc wire :x x :y y) :hover-in (drop-target e wire))
        :else (hover-hit! e x y)))))

(defn finish-drawing! [{:keys [box mode d g pts raw moved click-t]}]
  (if-not moved
    (pos-click! box click-t)
    (let [generic? (cv/generic? d)
          min-dur (if (:gx d) (cv/step-x (:gx d)) 0.05)
          pts (case mode
                :free (let [px (cv/simplify raw 1.5)]
                         (mapv (fn [[px py]] [(cv/round-to (cv/x->t g px) 4) (cv/round-to (cv/y->f g py) 4)]) px))
                (if generic? pts (sort-by first pts)))
          ps (cv/sane-pts-for d pts)]
      (when (and ps (or generic? (>= (- (first (peek ps)) (ffirst ps)) (* 0.99 min-dur))))
        (gesture! (str "(stroke " box " " (pts-code ps) ")"))))))

(defn end-gesture! [e]
  (let [{:keys [drag wire ldrag numdrag paramdrag ctldrag marquee resize adraw]} @ui]
    (cond
      adraw (annot-up!)
      resize (do (swap! ui assoc :resize nil)
                 (if (:moved resize)
                   (gesture! (str "(resize " (:id resize) " " (:w resize) " " (:h resize) ")"))
                   (render-scene (current))))
      marquee (end-marquee! marquee)
      (and drag (:ids drag) (:moved drag))
      (let [{:keys [ids gx gy]} drag ks (sort-by box-num (keys ids)) r (fn [v] (js/Math.round v))]
        (swap! ui assoc :drag nil)
        (if (= 1 (count ks))
          (let [[x0 y0] (get ids (first ks))]
            (gesture! (str (if @pres-mode "(present " "(move ") (first ks) " " (r (+ x0 gx)) " " (r (+ y0 gy)) ")")))
          (gesture! (str (if @pres-mode "(present-by [" "(move-by [") (str/join " " ks) "] " (r gx) " " (r gy) ")"))))
      (and drag (:clicked drag))
      (swap! ui assoc :drag nil :sel [:box (:clicked drag)])
      ctldrag
      (let [v (ctl-release-value ctldrag)]
        (swap! ui assoc :ctldrag nil)
        ;; the change stays in the work (a knob is rewritten with its new arguments), or is sent as a gesture
        (ctl-commit! ctldrag v cv/fmt))
      paramdrag
      (do (swap! ui assoc :paramdrag nil)
          (if (:button paramdrag)
            (do (send-quiet! (:id paramdrag) [(param-k (:label paramdrag)) 0])
                (repl-print! "in from-patch" (str "<span class=\"p\">⟵</span>" (esc (str "(send! " (:id paramdrag) " [" (pr-str (param-k (:label paramdrag))) " 1]) … [" (pr-str (param-k (:label paramdrag))) " 0]")))))
            (gesture! (str "(send! " (:id paramdrag) " [" (pr-str (param-k (:label paramdrag))) " " (cv/fmt (:v paramdrag)) "])"))))
      numdrag
      (do (swap! ui assoc :numdrag nil)
          (gesture! (str "(send! " (:id numdrag) " " (if (:v numdrag) (cv/fmt (:v numdrag)) ":bang") ")")))
      ldrag
      (do (swap! ui assoc :ldrag nil)
          (if (= :move (:kind ldrag))
            (when (and (:moved ldrag) (or (not (zero? (:dt ldrag))) (not (zero? (:dc ldrag)))))
              (gesture! (str "(move-stroke " (:box ldrag) " " (:tid ldrag) " " (cv/fmt (:dt ldrag)) " " (cv/fmt (:dc ldrag)) ")")))
            (finish-drawing! ldrag)))
      (and drag (:moved drag))
      (do (swap! ui assoc :drag nil)
          (gesture! (str (if @pres-mode "(present " "(move ") (:id drag) " " (js/Math.round (:x drag)) " " (js/Math.round (:y drag)) ")")))
      drag (swap! ui assoc :drag nil)
      wire
      (let [[to in] (when e (drop-target e wire))]
        (swap! ui assoc :wire nil :hover-in nil)
        (when to
          (gesture! (str "(connect " (:from wire) " " (:out wire) " " to " " in ")"))
          ;; a tree into a freqt shown as a score: the edits made on the score come back to the tree (a dashed line)
          (let [p (current) from (:from wire)]
            (when (and (= "tree" (klass (get-in p [:boxes from :text]))) (= "freqt" (klass (get-in p [:boxes to :text])))
                       (= :score (display-of (get-in p [:boxes to])))
                       (zero? in)
                       (not (some (fn [[a o b]] (and (= a to) (= o 2) (= b from))) (:lines p))))
              (gesture! (str "(connect " to " 2 " from " 0)"))
              (repl-print! "out" (esc (str "; and back: the edits made on " to " go to " from " (the dashed line)"))))))))))

(.addEventListener svg "pointerup" end-gesture!)
(.addEventListener svg "pointerleave" (fn [_] (when (:hover-hit @ui) (swap! ui assoc :hover-hit nil) (render-overlay!)) (when (or (:adraw @ui) (:drag @ui) (:wire @ui) (:ldrag @ui) (:numdrag @ui) (:paramdrag @ui) (:ctldrag @ui) (:marquee @ui) (:resize @ui)) (end-gesture! nil))))

(.addEventListener svg "dblclick"
  (fn [e]
    (let [[x y] (pt e)]
      (cond
        ;; in presentation no box is written or created
        (locked?) nil
        (closest e ".resize-corner") nil
        (closest e ".code-area") nil
        (or (closest e ".param") (closest e ".pval-hit") (closest e ".pres-area")
            (closest e ".stroke-hit") (closest e ".score-slot") (closest e ".mus-body")) nil
        (and (closest e ".box.act") (not (closest e ".grip"))) nil
        (closest e ".hchip") nil
        (closest e ".box")
        (let [el (closest e ".box") id (keyword (.. el -dataset -box)) b (get-in (current) [:boxes id])]
          (when b
            (if (or (and (embedded? b) (not (.-altKey e))) (data-header? id (view-box b) x y))
              nil
              (open-editor! {:id id :x (:x b) :y (:y b) :text (:text b)}))))
        :else (open-editor! {:x x :y y})))))

(defn stroke-key!
  "Arrows, + − and Delete on the chosen stroke, respecting the grids of the canvas."
  [e k [id tid]]
  (let [b (get-in (current) [:boxes id]) d (:data b) tr (get-in d [:strokes tid]) sh (.-shiftKey e)]
    (if (nil? tr)
      (swap! ui assoc :nsel nil)
      (let [pts (:pts tr) [t0 f0] (first pts) dur (- (first (peek pts)) t0)
            gy (:gy d) stp (cv/step-x (:gx d)) cyc (cv/cycle (:gx d))
            g (canvas-geom d id b)
            dc (fn [dir] (cond
                           (cv/generic? d) (* dir (if sh 5 1) (or (:step gy) (cv/nice-step (- (:yb g) (:ya g)) 20)))
                           (:cents gy)
                           (cv/round-to (cv/hz->cents (cv/degree->hz gy (+ (cv/hz->degree gy f0) (* dir (if sh (count (cv/degrees gy)) 1)))) f0) 3)
                           :else (* dir (if sh 1200 100))))
            move-by (fn [dt c] (gesture! (str "(move-stroke " id " " tid " " (cv/fmt dt) " " (cv/fmt c) ")")))
            stretch-to (fn [nd] (gesture! (str "(stretch " id " " tid " " (cv/fmt (/ nd dur)) ")")))]
        (case k
          "ArrowUp" (move-by 0 (dc 1))
          "ArrowDown" (move-by 0 (dc -1))
          "ArrowLeft" (when (or (cv/generic? d) (pos? t0)) (move-by (- (if (cv/generic? d) (if sh cyc stp) (min t0 (if sh cyc stp)))) 0))
          "ArrowRight" (move-by (if sh cyc stp) 0)
          ("+" "=") (stretch-to (+ dur stp))
          "-" (when (> dur stp) (stretch-to (- dur stp)))
          ("Delete" "Backspace") (do (swap! ui assoc :nsel nil) (gesture! (str "(erase-stroke " id " " tid ")")))
          "Escape" (swap! ui assoc :nsel nil)
          nil)))))

(.addEventListener js/document "keydown"
  (fn [e]
    (let [tag (.. js/document -activeElement -tagName) k (.-key e) mod? (or (.-ctrlKey e) (.-metaKey e))]
      (when (and (= k "Escape") (:merge-pick @ui))
        (swap! ui assoc :merge-pick false)
        (.remove (.-classList ($ "hist-wrap")) "picking"))
      (when-not (#{"INPUT" "TEXTAREA"} tag)
        (cond
          (and (or (= k "?") (= k "F1")) (not mod?))
          (let [[kind v] (:sel @ui) b (when (= kind :box) (get-in (current) [:boxes v]))]
            (.preventDefault e)
            (show-help! (when b (klass (:text b)))))
          (and (:tsel @ui) (not mod?)
               (or (#{"ArrowUp" "ArrowDown" "ArrowLeft" "ArrowRight" "+" "=" "-" "Delete" "Backspace" "Escape" "Enter"} k)
                   (letter-pcs (str/lower-case k))))
          (do (.preventDefault e)
              (try (tree-key! k (.-shiftKey e))
                   (catch :default ex (repl-print! "err" (esc (or (.-message ex) (str ex)))))))
          (and (:nsel @ui) (not mod?)
               (#{"ArrowUp" "ArrowDown" "ArrowLeft" "ArrowRight" "+" "=" "-" "Delete" "Backspace" "Escape"} k))
          (do (.preventDefault e) (stroke-key! e k (:nsel @ui)))
          (and (= k " ") (not= tag "BUTTON") (.-hidden ($ "manager")))
          (do (.preventDefault e) (gesture! (if (eng/running?) "(stop)" "(play)")))
          (and (#{"Delete" "Backspace"} k) (:sel @ui) (not (locked?)))
          (let [[kind v] (:sel @ui)]
            (.preventDefault e)
            (swap! ui assoc :sel nil :insp nil)
            (case kind
              :box (gesture! (str "(delete " v ")"))
              :boxes (gesture! (str "(delete " (str/join " " (sort-by box-num v)) ")"))
              (gesture! (str "(disconnect " (str/join " " v) ")"))))
          (and (= k "Escape") (or (:sel @ui) (:insp @ui)))
          (swap! ui assoc :sel nil :insp nil)
          ;; ⌘/Ctrl+A: every box on screen
          ;; (in presentation it selects nothing, and the browser does not select the page either)
          (and mod? (= (str/lower-case k) "a") (.-hidden ($ "manager")))
          (do (.preventDefault e)
              (when-not (locked?) (swap! ui assoc :sel (sel-of (keys (scene-boxes))) :insp nil :nsel nil :tsel nil)))
          (and mod? (= (str/lower-case k) "z") (.-shiftKey e))
          (do (.preventDefault e) (gesture! "(forward)"))
          (and mod? (= (str/lower-case k) "z"))
          (do (.preventDefault e) (gesture! "(rewind)"))
          (and mod? (= (str/lower-case k) "y"))
          (do (.preventDefault e) (gesture! "(forward)")))))))
