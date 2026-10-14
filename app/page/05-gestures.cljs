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
                       (if id
                         (gesture! (str "(text! " id " " (pr-str v) ")"))
                         (gesture! (str "(box " (pr-str v) " " (js/Math.round x) " " (js/Math.round y) ")")))))))]
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
  [t {:keys [src sub use]}]
  (cond
    (or use (nil? src)) nil
    (nil? sub) [[] src]
    :else (let [s (mt/node-at t src) nodes (mt/melody s) parent (pop src) idx (peek src)]
            [(into [[:remove src]] (map-indexed (fn [k n] [:insert (conj parent (+ idx k)) n]) nodes))
             (into (conj parent (+ idx (first sub))) (rest sub))])))

(defn tree-key!
  "A key on the selected note of a score."
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
                             (fail "That note comes from a fragment (:defs): edit the fragment, or write it out"))
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
            edits (case k
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
            ;; the edits leave the score by its third outlet: connected back to the tree box, they change it,
            ;; and the tree, changed, comes back to the score
            (when-not (some (fn [[a o]] (and (= a score) (= o 2))) (:lines (current)))
              (fail (str "To edit " from " from this score, connect the score's third outlet (edits) to " from)))
            (swap! ui assoc :tsel (assoc ts :src {:src (if (#{"Delete" "Backspace"} k) dur-path target)} :id nil))
            (eng/emit! (fn [] (work-patch)) (fid score) 2 [:edit ops])
            (render-scene (current))))))))

(defn score-click!
  "Click on a score: a note picks its stroke; elsewhere, the nearest position of that system is requested."
  [e id b x y]
  (let [gn (.closest (.-target e) "g.note")
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

(defn open-code-editor!
  "Editor for the source of a code box, over the box. Ctrl/⌘+Enter or leaving the editor
   writes it as an event (code …); Esc discards it."
  [id]
  (when-let [old ($ "code-edit")] (.remove old))
  (let [b (get-in (current) [:boxes id]) d (box-def b) [w _] (box-dims id b)
        ta (js/document.createElement "textarea") done (atom false)
        original (str (get-in b [:data :source]))
        initial-text (if (str/blank? original) (or (:template d) "") original)
        finish (fn [commit?]
                 (when-not @done
                   (reset! done true)
                   (let [v (.-value ta)]
                     (.remove ta)
                     (when (and commit? (not= v original) (not (str/blank? v)))
                       (gesture! (str "(code " id " " (pr-str v) ")"))))))]
    (set! (.-id ta) "code-edit")
    (set! (.-className ta) "code-edit")
    (set! (.-spellcheck ta) false)
    (set! (.-value ta) initial-text)
    (let [[px py] (wrap-px (:x b) (+ (:y b) hdr))]
      (set! (.. ta -style -left) (str px "px"))
      (set! (.. ta -style -top) (str py "px")))
    (set! (.. ta -style -width) (str (max w 440) "px"))
    (set! (.. ta -style -height) (str (max 180 (+ 40 (* 16 (count (str/split-lines initial-text))))) "px"))
    (.appendChild ($ "canvas-wrap") ta)
    (.focus ta)
    (.addEventListener ta "keydown"
      (fn [e]
        (let [k (.-key e)]
          (cond
            (and (= k "Enter") (or (.-ctrlKey e) (.-metaKey e))) (do (.preventDefault e) (finish true))
            (= k "Escape") (do (.preventDefault e) (finish false))
            (= k "Tab") (do (.preventDefault e)
                            (let [a (.-selectionStart ta) z (.-selectionEnd ta) v (.-value ta)]
                              (set! (.-value ta) (str (subs v 0 a) "  " (subs v z)))
                              (set! (.-selectionStart ta) (+ a 2))
                              (set! (.-selectionEnd ta) (+ a 2))))))))
    (.addEventListener ta "blur" (fn [_] (finish true)))))

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
    (eng/inject! (fn [] (work-patch)) (fid id) 0 v)
    (when-not was-on (transport-info!) (js/requestAnimationFrame (fn [_] (live!))))
    (render-overlay!)))

(defn send-flat-quiet! [f v]
  (let [was-on (eng/running?)]
    (eng/inject! (fn [] (work-patch)) f 0 v)
    (when-not was-on (transport-info!) (js/requestAnimationFrame (fn [_] (live!))))
    (render-overlay!)))

(defn ctl-gesture!
  "Calls the :gesture of the box being dragged; if the value changes, sends it to its inlet 0."
  [x y fine]
  (when-let [{:keys [f b ox oy x0 y0 start] :as cd} (:ctldrag @ui)]
    (let [v (try ((:gesture (box-def b))
                  (assoc (ctl-m* f b) :start start :x (- x ox) :y (- y oy) :dx (- x x0) :dy (- y y0) :fine (boolean fine)))
                 (catch :default e (js/console.error "gesture" e) nil))]
      (swap! ui update :ctldrag assoc :x x :y y :fine (boolean fine))
      (when (and (some? v) (not= v (:v cd)))
        (swap! ui assoc-in [:ctldrag :v] v)
        (send-flat-quiet! f v)))))

(defn ctl-release-value
  "On release, the :gesture of the box is asked once more with :up true; what it returns is the value
  that stays in the history. A :gesture that ignores :up returns the last value, as before."
  [{:keys [f b ox oy x0 y0 x y fine start v]}]
  (let [x (or x x0) y (or y y0)
        u (try ((:gesture (box-def b))
                (assoc (ctl-m* f b) :start start :x (- x ox) :y (- y oy) :dx (- x x0) :dy (- y y0)
                       :fine (boolean fine) :up true))
               (catch :default e (js/console.error "gesture" e) v))]
    (if (some? u) u v)))

(defn send-to!
  "Sends a message to inlet 0 of a box inside a sub-patch of this view: (send-to! :b7.b4 0.5)."
  [rel v]
  (let [was-on (eng/running?)]
    (eng/inject! (fn [] (work-patch)) (eng/flat-id (cmd-path) rel) 0 v)
    (when-not was-on (transport-info!) (js/requestAnimationFrame (fn [_] (live!))))
    v))

(defn start-ctl-drag!
  ([f b ox oy x y echo] (start-ctl-drag! f b ox oy x y echo false))
  ([f b ox oy x y echo fine]
   (swap! ui assoc :sel nil :nsel nil
          :ctldrag {:f f :b b :ox ox :oy oy :x0 x :y0 y :start (second (shown-flat f)) :v nil :echo echo})
   (ctl-gesture! x y fine)))

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

(defn pick-box!
  "A plain click on a box: if it is one of several selected, they all start moving; otherwise it alone is
   selected (its inspector closed) and starts moving. `extra` is merged into the ui state."
  ([id b x y] (pick-box! id b x y nil))
  ([id b x y extra]
   (let [ids (sel-ids)]
     (if (and (> (count ids) 1) (contains? ids id))
       ;; released without moving, the click selects that box alone (see end-gesture!)
       (swap! ui merge {:nsel nil :drag (some-> (group-drag ids x y) (assoc :clicked id))} extra)
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
  (when (and (.-shiftKey e) (not (closest e ".port")))
    (when-let [el (closest e ".box")]
      (let [[id b] (el-box el)]
        (when (and b (not (and (closest e ".mus-body") (#{"canvas" "freqt"} (klass (:text b)))))
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
(.addEventListener svg "contextmenu"
  (fn [e] (when (and (.-ctrlKey e) (closest e ".box")) (.preventDefault e))))

(.addEventListener svg "pointerdown"
  (fn [e]
    (let [[x y] (pt e) mod? (or (.-metaKey e) (.-ctrlKey e))]
      (cond
        (closest e ".port.out")
        (let [el (closest e ".port.out")]
          (.preventDefault e)
          (swap! ui assoc :wire {:from (keyword (.. el -dataset -box)) :out (js/parseInt (.. el -dataset -out) 10) :x x :y y}))

        ;; ⌘/Ctrl+click anywhere on a box: select it and open its inspector
        (and mod? (closest e ".box") (not (closest e ".port")))
        (let [[id b] (el-box (closest e ".box"))]
          (when b
            (.preventDefault e)
            (inspect-box! id b x y)))

        ;; ⇧+click: add the box to the selection, or take it out
        (shift-pick e)
        (do (.preventDefault e)
            (toggle-box! (shift-pick e) x y))

        ;; a control presented in the panel of a sub-patch
        (closest e ".pres-area")
        (let [el (closest e ".pres-area") [id b] (el-box el) kid (keyword (.. el -dataset -kid))
              k (when b (first (filter (fn [k] (= (:id k) kid)) (:kids (panel-layout b)))))]
          (when (and k (fn? (:gesture (box-def (:b k)))))
            (.preventDefault e)
            (let [[kx ky] (kid-origin (:x b) (:y b) k)]
              (start-ctl-drag! (eng/flat-id (conj (cmd-path) id) kid) (:b k) kx ky x y
                               (str "(send-to! " (eng/flat-id [id] kid) " ") (.-shiftKey e)))))

        ;; action boxes: the grip selects and moves them (⌘/Ctrl+click opens the inspector), the body only plays
        (and (closest e ".box.act") (not (closest e ".grip")) (not (closest e ".port")))
        (let [[id b] (el-box (closest e ".box.act"))]
          (when b
            (.preventDefault e)
            (swap! ui (fn [u] (assoc u :nsel nil :sel (when-not (= (:sel u) [:box id]) (:sel u)))))
            (cond
              (= "number" (klass (:text b)))
              (swap! ui assoc :numdrag {:id id :y0 y :v0 (number-value id b) :v nil})
              (fn? (:gesture (box-def b)))
              (do (start-ctl-drag! (fid id) b (+ (:x b) grip) (:y b) x y (str "(send! " id " ") (.-shiftKey e))
                  (swap! ui assoc-in [:ctldrag :id] id))
              :else (gesture! (str "(send! " id " :bang)")))))

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
              (let [v (value-at-x b p x)]
                (send-quiet! id [(param-k label) v])
                (swap! ui assoc :paramdrag {:id id :label label :p p :v v})))))

        (closest e ".stroke-hit")
        (let [el (closest e ".stroke-hit") [id b] (el-box el) tid (keyword (.. el -dataset -stroke))
              d (canvas-data b) tr (get-in d [:strokes tid])]
          (when tr
            (.preventDefault e)
            (swap! ui assoc :sel nil :nsel [id tid]
                   :ldrag {:kind :move :box id :tid tid :g (canvas-geom d) :d d :x0 x :y0 y
                           :pts0 (:pts tr) :pts (:pts tr) :dt 0 :dc 0 :moved false})))

        (closest e ".score-slot")
        (let [[id b] (el-box (closest e ".score-slot"))]
          (when b (score-click! e id b x y)))

        (closest e ".mus-body")
        (let [[id b] (el-box (closest e ".mus-body"))]
          (when b
            (case (klass (:text b))
              ("canvas" "freqt") (let [d (canvas-data b) g (canvas-geom d)
                             lx (- x (:x b)) ly (- y (:y b))
                             t0 (snap-t d (cv/x->t g lx)) f0 (snap-f d (cv/y->f g ly))
                             mode (cond (.-altKey e) :free (.-shiftKey e) :line :else :note)]
                         (.preventDefault e)
                         (swap! ui assoc :sel nil :nsel nil
                                :ldrag {:kind :draw :mode mode :box id :g g :d d :x0 x :y0 y :bx (:x b) :by (:y b)
                                        :t0 t0 :f0 f0 :click-t (cv/x->t g lx) :raw [[lx ly]] :pts nil :moved false}))
              "score" (score-click! e id b x y)
              nil)))

        (closest e ".box")
        (let [el (closest e ".box") id (keyword (.. el -dataset -box)) b (some-> (get-in (current) [:boxes id]) view-box)]
          (when b
            ;; the first click redraws the box, so a double click on a patch box is detected here
            (let [now (js/Date.now) [lid lt] (:last-box-click @ui)]
              (if (and (= lid id) (< (- now lt) 450) (embedded? b) (not (.-altKey e)))
                (do (.preventDefault e)
                    (swap! ui assoc :last-box-click nil :drag nil)
                    (js/setTimeout (fn [] (gesture! (str "(enter " id ")"))) 0))
                (pick-box! id b x y {:last-box-click [id now]})))))

        (closest e ".wire-hit")
        (let [idx (js/parseInt (.. (closest e ".wire-hit") -dataset -line) 10)]
          (swap! ui assoc :sel [:line (nth (:lines (current)) idx)] :nsel nil))

        ;; an empty place of the paper: a frame starts (a plain click there deselects)
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

(.addEventListener svg "pointermove"
  (fn [e]
    (let [[x y] (pt e) {:keys [drag wire ldrag numdrag paramdrag ctldrag marquee]} @ui]
      (cond
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
                      (eng/inject! (fn [] (work-patch)) (fid (:id numdrag)) 0 v)
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
        wire (swap! ui assoc :wire (assoc wire :x x :y y) :hover-in (drop-target e wire))))))

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
  (let [{:keys [drag wire ldrag numdrag paramdrag ctldrag marquee]} @ui]
    (cond
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
      (let [v (ctl-release-value ctldrag) id (:id ctldrag) b (when id (get-in (current) [:boxes id])) d (when b (box-def b))]
        (swap! ui assoc :ctldrag nil)
        (if (and b (:persist d))
          ;; the change stays in the work: the box is rewritten with its new arguments
          (when (some? v)
            (let [t (comp/args-text d (klass (:text b)) (merge (comp/args-for d (:text b)) ((:persist d) v)))]
              (when (not= t (:text b)) (gesture! (str "(text! " id " " (pr-str t) ")")))))
          (gesture! (str (:echo ctldrag) (cond (number? v) (cv/fmt v) (some? v) (pr-str v) :else ":bang") ")"))))
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
          ;; a tree into a score: the edits made on the score come back to the tree (a dashed line)
          (let [p (current) from (:from wire)]
            (when (and (= "tree" (klass (get-in p [:boxes from :text]))) (= "score" (klass (get-in p [:boxes to :text])))
                       (zero? in)
                       (not (some (fn [[a o b]] (and (= a to) (= o 2) (= b from))) (:lines p))))
              (gesture! (str "(connect " to " 2 " from " 0)"))
              (repl-print! "out" (esc (str "; and back: the edits made on " to " go to " from " (the dashed line)"))))))))))

(.addEventListener svg "pointerup" end-gesture!)
(.addEventListener svg "pointerleave" (fn [_] (when (or (:drag @ui) (:wire @ui) (:ldrag @ui) (:numdrag @ui) (:paramdrag @ui) (:ctldrag @ui) (:marquee @ui)) (end-gesture! nil))))

(.addEventListener svg "dblclick"
  (fn [e]
    (let [[x y] (pt e)]
      (cond
        (closest e ".code-area") nil
        (or (closest e ".param") (closest e ".stroke-hit") (closest e ".score-slot") (closest e ".mus-body")) nil
        (and (closest e ".box.act") (not (closest e ".grip"))) nil
        (closest e ".box")
        (let [el (closest e ".box") id (keyword (.. el -dataset -box)) b (get-in (current) [:boxes id])]
          (when b
            (if (and (embedded? b) (not (.-altKey e)))
              nil
              (open-editor! {:id id :x (:x b) :y (:y b) :text (:text b)}))))
        :else (open-editor! {:x x :y y})))))

(defn stroke-key!
  "Arrows, + − and Delete on the chosen stroke, respecting the grids of the canvas."
  [e k [id tid]]
  (let [d (get-in (current) [:boxes id :data]) tr (get-in d [:strokes tid]) sh (.-shiftKey e)]
    (if (nil? tr)
      (swap! ui assoc :nsel nil)
      (let [pts (:pts tr) [t0 f0] (first pts) dur (- (first (peek pts)) t0)
            gy (:gy d) stp (cv/step-x (:gx d)) cyc (cv/cycle (:gx d))
            g (canvas-geom d)
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
               (#{"ArrowUp" "ArrowDown" "ArrowLeft" "ArrowRight" "+" "=" "-" "Delete" "Backspace" "Escape"} k))
          (do (.preventDefault e)
              (try (tree-key! k (.-shiftKey e))
                   (catch :default ex (repl-print! "err" (esc (or (.-message ex) (str ex)))))))
          (and (:nsel @ui) (not mod?)
               (#{"ArrowUp" "ArrowDown" "ArrowLeft" "ArrowRight" "+" "=" "-" "Delete" "Backspace" "Escape"} k))
          (do (.preventDefault e) (stroke-key! e k (:nsel @ui)))
          (and (= k " ") (not= tag "BUTTON") (.-hidden ($ "manager")))
          (do (.preventDefault e) (gesture! (if (eng/running?) "(stop)" "(play)")))
          (and (#{"Delete" "Backspace"} k) (:sel @ui))
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
          (and mod? (= (str/lower-case k) "a") (.-hidden ($ "manager")))
          (do (.preventDefault e) (swap! ui assoc :sel (sel-of (keys (scene-boxes))) :insp nil :nsel nil :tsel nil))
          (and mod? (= (str/lower-case k) "z") (.-shiftKey e))
          (do (.preventDefault e) (gesture! "(forward)"))
          (and mod? (= (str/lower-case k) "z"))
          (do (.preventDefault e) (gesture! "(rewind)"))
          (and mod? (= (str/lower-case k) "y"))
          (do (.preventDefault e) (gesture! "(forward)")))))))
