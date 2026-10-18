;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 3 of 12: patch-view
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── interface: patch ─────────────────────────

(defn $ [id] (js/document.getElementById id))

;; ───── embedding (Study 22): the address says what to show and how ─────
;;   ?code=…  a patch (its code, compressed) · ?tutorial=id&step=n · ?help=class · ?lang=es|en
;;   ?embed   only the patch, to put inside another page (an iframe, a Notion /embed block)
;;   ?present only the presentation, filling the window (with a fullscreen button)

(def url-params (js/URLSearchParams. (.-search js/location)))
(defn url-param [k] (.get url-params k))
(defn raw-param
  "A parameter as written in the address, where + stays + (code written by hand: ?src=…)."
  [k]
  (some (fn [part]
          (let [i (.indexOf part "=")]
            (when (and (pos? i) (= k (subs part 0 i)))
              (try (js/decodeURIComponent (subs part (inc i))) (catch :default _ nil)))))
        (str/split (subs (str (.-search js/location)) 1) #"&")))
(def embed-mode (cond (.has url-params "present") :present (.has url-params "embed") :embed))

(defn wrap-px
  "Where a point of the patch is inside the patch pane, in pixels (an embedded patch is shown scaled)."
  [x y]
  (let [cv ($ "canvas")]
    (if-not (.hasAttribute cv "viewBox")
      [x y]
      (let [q (.createSVGPoint cv) wrap ($ "canvas-wrap") r (.getBoundingClientRect wrap)]
        (set! (.-x q) x)
        (set! (.-y q) y)
        (let [s (.matrixTransform q (.getScreenCTM cv))]
          [(+ (- (.-x s) (.-left r)) (.-scrollLeft wrap)) (+ (- (.-y s) (.-top r)) (.-scrollTop wrap))])))))

(def box-h 24)
(def pw 10)
(defn box-w [text] (max 56 (+ 20 (* 7.6 (count text)))))
(defn port-x [w n i] (if (<= n 1) 0 (* i (/ (- w pw) (dec n)))))

;; ───── buffer boxes (canvas, score) and action boxes (number, msg, bang) ─────

(def hdr 20)
(def grip 8)
(defonce score-cache (atom {}))   ; box → {:key data :node <g> :h height :pieces [...] :anchors [...]}
(defonce vrv (atom nil))
(defonce vrv-status (atom :loading))

(def code-w 260)
(def code-lh 13)
(def code-row 22)   ; a code box shows its code as one row (issue #8): the editor opens with a double-click
(def param-h 18)

(defn code-lines [b] (str/split-lines (let [f (str (get-in b [:data :source]))] (if (str/blank? f) " " f))))

(defn code-params [b]
  (when-let [f (:params (box-def b))] (f (comp/box-info b))))

(defn code-geom
  "Parts of a code box: its code row, the status of its compilation, its parameters. The code itself is
   written in the editor (a double-click on the row), not in the patch (issue #8)."
  [b]
  (let [ch code-row
        y-st (+ hdr ch 13)
        y-par (+ hdr ch 20)
        ps (code-params b)]
    {:ch ch :y-st y-st :y-par y-par :params ps :h (+ y-par (* (count ps) param-h) 4)}))

(defn code-gist
  "What the code row of a box shows: its first line that says something (not a comment), and how long it is."
  [b]
  (let [ls (code-lines b)
        first-line (or (first (remove (fn [l] (or (str/blank? l) (re-find #"^\s*(;|//)" l))) ls)) "")
        n (count (remove str/blank? ls))]
    [(str/trim first-line) n]))

(declare panel-layout)

(defn box-dims [id b]
  (let [t (:text b)]
    (cond
      (= :code (display-of b)) [code-w (:h (code-geom b))]
      (panel-layout b) (let [{:keys [w h]} (panel-layout b)] [w h])
      (own-view? b) (let [[w h] (comp/size-of b)] [(+ grip w) h])
      (= :canvas (display-of b)) [cv/W cv/H]
      (= :score (display-of b)) [cv/W (max 90 (+ hdr 8 (or (get-in @score-cache [id :h]) 70)))]
      :else
    (case (klass t)
      "bang" [34 26]
      "number" [76 box-h]
      "msg" [(max 44 (+ grip 14 (* 7.6 (count (str/trim (subs (str/trim t) 3)))))) box-h]
      [(box-w t) box-h]))))

(defn box-pos [id b]
  (let [d (:drag @ui)]
    (cond
      ;; several boxes moving together: each from where it started, by the same offset
      (and d (:moved d) (:ids d) (contains? (:ids d) id))
      (let [[x0 y0] (get (:ids d) id)] [(+ x0 (:gx d)) (+ y0 (:gy d))])
      (and d (= (:id d) id) (:moved d)) [(:x d) (:y d)]
      :else [(:x b) (:y b)])))

(defn out-xy [p id o]
  (let [b (get-in p [:boxes id]) [x y] (box-pos id b) [w h] (box-dims id b) [_ n] (io b)]
    [(+ x (port-x w n o) (/ pw 2)) (+ y h)]))

(defn in-xy [p id i]
  (let [b (get-in p [:boxes id]) [x y] (box-pos id b) [w _] (box-dims id b) [n _] (io b)]
    [(+ x (port-x w n i) (/ pw 2)) y]))

(defn canvas-geom [d] (cv/geom (or d cv/empty) hdr))

;; a tree box shown as a score (discussion #30): its own tree, expanded, remembering where each note is
;; written, so its notes edit it directly
(defn own-tree [id b]
  (when-let [t (mtb/tree-of (:data b))] (try (mt/expand-source t id) (catch :default _ nil))))

(defn kept-tree
  "The tree a buffer was kept from, while the buffer has not changed since (its recipe is not stale)."
  [b] (let [r (:recipe b)] (when (and r (not (:stale r))) (:tree r))))

;; score: Verovio draws an approximation of the buffer; the SVG node is kept and put back on every repaint
(defn score-entry! [id b]
  (let [tree-box? (= "tree" (klass (:text b)))
        d0 (if tree-box? cv/empty (canvas-data b))
        ;; a tree shown live, or the tree a buffer was kept from while it is unchanged (its recipe)
        lt (if tree-box? (own-tree id b) (or (live-tree id) (kept-tree b)))
        d [d0 lt] c (get @score-cache id)]
    (cond
      (and c (= (:key c) d)) c
      (nil? @vrv) nil
      :else
      (try
        (let [tk @vrv scale 30
              {:keys [mei pieces]} (if lt
                                     (mt/->score lt (str (name id) "-"))
                                     (sc/->mei-voice (cv/->voice d0) (str (name id) "-")))
              g (js/document.createElementNS "http://www.w3.org/2000/svg" "g")]
          (.setOptions tk (clj->js {:pageWidth (js/Math.round (/ (* (- cv/W 8) 100) scale)) :pageHeight 60000
                                    :adjustPageHeight true :breaks "auto" :scale scale
                                    :header "none" :footer "none" :lyricSize 3.2
                                    :pageMarginTop 24 :pageMarginBottom 12 :pageMarginLeft 20 :pageMarginRight 20}))
          (.loadData tk mei)
          (set! (.-innerHTML g) (.renderToSVG tk 1))
          (let [sv (.querySelector g "svg")
                h (if sv (js/parseFloat (.getAttribute sv "height")) 70)
                e {:key d :node g :h (if (js/isNaN h) 70 h) :pieces pieces :anchors nil :from (:from (meta lt))}]
            (swap! score-cache assoc id e)
            e))
        (catch :default ex
          (let [e {:key d :node nil :h 40 :error (or (.-message ex) (str ex))}]
            (swap! score-cache assoc id e)
            e))))))

(defn local-box
  "Box of an SVG element in the coordinates of `ref` (without going through screen pixels,
   which change when the page is zoomed in or out)."
  [el ref]
  (let [b (.getBBox el)
        m (.multiply (.inverse (.getScreenCTM ref)) (.getScreenCTM el))
        tp (fn [x y] (let [q (.createSVGPoint ($ "canvas"))] (set! (.-x q) x) (set! (.-y q) y) (.matrixTransform q m)))
        a (tp (.-x b) (.-y b))
        c (tp (+ (.-x b) (.-width b)) (+ (.-y b) (.-height b)))]
    {:left (.-x a) :top (.-y a) :right (.-x c) :bottom (.-y c) :w (- (.-x c) (.-x a))}))

(defn score-anchors
  "Time ⇄ space anchors of a placed score, in the coordinates of its box."
  [node pieces]
  (when (and node (.querySelector node "svg") (.-isConnected node))
    (->> pieces
         (keep (fn [{:keys [id t]}]
                 (when-let [el (.querySelector node (str "#" id))]
                   (let [head (or (.querySelector el ".notehead") el)
                         r (local-box head node)
                         sys (or (.closest el ".system") el)
                         sr (local-box sys node)]
                     (when (pos? (:w r))
                       {:t t :x (:left r) :y0 (- (:top sr) 6) :y1 (+ (:bottom sr) 6) :right (:right sr)})))))
         (group-by :t)
         (map (fn [[_ as]] (apply min-key :x as)))
         (sort-by :t)
         vec)))

;; ───── live layer: number values, flashes, reading cursors ─────

(defn shown-flat
  "The last thing a box (by its engine id) showed: with the engine running, up to the instant sounding now."
  [f]
  (if (eng/running?)
    (eng/shown-at f (eng/now))
    (last (get-in @eng/rt [:shows f]))))

(defn last-shown "The same, for a box of the current view." [id] (shown-flat (fid id)))

(defn recent? [[at _]] (and at (eng/running?) (< (- (eng/now) at) 0.15)))

(defn cursor-at
  "A vertical line at time t of box `bid` (canvas or score), with dots on what sounds."
  ([p bid t cls dots?] (cursor-at p bid t cls dots? :x nil))
  ([p bid t cls dots? axis] (cursor-at p bid t cls dots? axis nil))
  ([p bid t cls dots? axis pt]
  (when-let [b (get-in p [:boxes bid])]
    (let [[x y] (box-pos bid b) d (canvas-data b)]
      (case (display-of b)
        :canvas
        (cond
          (= axis :path)
          (when pt
            (let [g (canvas-geom d)]
              (str "<circle class=\"sounding\" cx=\"" (+ x (cv/t->x g (first pt))) "\" cy=\"" (+ y (cv/f->y g (second pt))) "\" r=\"6\"></circle>")))
          (= axis :y)
          (let [g (canvas-geom d) cy (+ y (cv/f->y g (max (:ya g) (min t (:yb g)))))]
            (str "<line class=\"" cls "\" x1=\"" (+ x (:x0 g)) "\" x2=\"" (+ x (:x0 g) (:w g)) "\" y1=\"" cy "\" y2=\"" cy "\"></line>"
                 (when dots?
                   (apply str (for [[_ v] (cv/read-along d :y t)]
                                (str "<circle class=\"sounding\" cx=\"" (+ x (cv/t->x g v)) "\" cy=\"" cy "\" r=\"4\"></circle>"))))))
          :else
          (let [g (canvas-geom d) cx (+ x (cv/t->x g (max (:xa g) (min t (:xb g)))))]
                   (str "<line class=\"" cls "\" x1=\"" cx "\" x2=\"" cx "\" y1=\"" (+ y (:y0 g)) "\" y2=\"" (+ y (:y0 g) (:h g)) "\"></line>"
                        (when dots?
                          (apply str (for [[_ f] (cv/read-at d t)]
                                       (str "<circle class=\"sounding\" cx=\"" cx "\" cy=\"" (+ y (cv/f->y g f)) "\" r=\"4\"></circle>")))))))
        :score (when-let [a (sc/t->pos (get-in @score-cache [bid :anchors]) t)]
                  (let [cx (+ x 4 (:x a)) oy (+ y hdr 4)]
                    (str "<line class=\"" cls "\" x1=\"" cx "\" x2=\"" cx "\" y1=\"" (+ oy (max 0 (:y0 a))) "\" y2=\"" (+ oy (:y1 a)) "\"></line>")))
        nil)))))

(def param-x0 96)

;; ───── own view of a component: its :view template filled by :derive (or what :draw returns),
;;       from the last thing it showed ─────

(defn ctl-shown [id] (second (last-shown id)))

(defn ctl-m*
  "What :derive, :draw and :gesture receive, for box b known to the engine as f."
  [f b]
  (let [[w h] (comp/size-of b)]
    {:id f :shown (second (shown-flat f)) :state (get-in @eng/rt [:states f]) :args (comp/args-for (box-def b) (:text b))
     :text (:text b) :data (:data b) :w w :h h}))

(defn ctl-m [id b] (ctl-m* (fid id) b))

(defn ctl-shapes*
  "The shapes of a component's own view: :view filled with its holes, or :draw."
  [m b]
  (let [d (box-def b)]
    (cond
      (some? (:view d))
      (let [derived (if-let [f (:derive d)] (f m) {})]
        (shp/fill (:view d) (merge (when (map? (:args m)) (:args m)) (select-keys m [:shown :w :h]) derived)))
      (fn? (:draw d)) ((:draw d) m)
      :else [])))

(defn shapes-at
  "The SVG of the own view of box b (engine id f) with its top-left corner at x y."
  [f b x y]
  (let [shape-list (try (ctl-shapes* (ctl-m* f b) b)
                        (catch :default e [[:text {:x 4 :y 14 :fill :kairos :size 10} (str "✗ " (or (.-message e) e))]]))]
    (str "<g class=\"shapes\" transform=\"translate(" x "," y ")\">" (shp/svg shape-list) "</g>")))

(defn ctl-overlay [id b x y] (shapes-at (fid id) b (+ x grip) y))

;; ───── panels: a sub-patch seen from outside shows the boxes presented inside it ─────

(defn child-dims
  "Size of a box in presentation: its own view, or a small chip with its text."
  [b]
  (if (own-view? b) (comp/size-of b) [(box-w (:text b)) box-h]))

(def panel-pad 4)

(defn panel-layout
  "The presented boxes of a sub-patch box and the size of its panel, or nil if none is presented."
  [b]
  (when (comp/subpatch? b)
    (let [inner (eng/inner-patch b)
          kids (vec (for [[cid cb] (sort-by (fn [[k _]] (box-num k)) (:boxes inner))
                          :let [[px py] (:present cb)] :when px]
                      (let [[w h] (child-dims cb)] {:id cid :b cb :x px :y py :w w :h h})))]
      (when (seq kids)
        {:kids kids
         :w (max (box-w (:text b)) (+ (* 2 panel-pad) (apply max (map (fn [k] (+ (:x k) (:w k))) kids))))
         :h (+ hdr (* 2 panel-pad) (apply max (map (fn [k] (+ (:y k) (:h k))) kids)))}))))

(defn kid-origin [x y k] [(+ x panel-pad (:x k)) (+ y hdr panel-pad (:y k))])

(defn panel-svg
  "The fixed part of a panel: its header and, for each presented box, a hit area or a chip."
  [id b w]
  (let [{:keys [kids]} (panel-layout b) idn (esc (name id))]
    (str "<rect class=\"head\" x=\"0.5\" y=\"0.5\" width=\"" (- w 1) "\" height=\"" (- hdr 1) "\"></rect>"
         "<text class=\"lbl\" x=\"8\" y=\"14\">" (esc (:text b)) "</text>"
         (apply str
                (for [k kids :let [[kx ky] (kid-origin 0 0 k)]]
                  (if (own-view? (:b k))
                    (str "<rect class=\"pres-area\" data-box=\"" idn "\" data-kid=\"" (esc (name (:id k))) "\" x=\"" kx "\" y=\"" ky
                         "\" width=\"" (:w k) "\" height=\"" (:h k) "\"><title>" (esc (:text (:b k))) "</title></rect>")
                    (str "<rect class=\"chip\" x=\"" kx "\" y=\"" ky "\" width=\"" (:w k) "\" height=\"" (:h k) "\" rx=\"3\"></rect>"
                         "<text x=\"" (+ kx 8) "\" y=\"" (+ ky 16) "\">" (esc (:text (:b k))) "</text>")))))))

(defn panel-overlay
  "The live part of a panel: the own views of its presented boxes."
  [id b x y]
  (apply str (for [k (:kids (panel-layout b)) :when (own-view? (:b k)) :let [[kx ky] (kid-origin x y k)]]
               (shapes-at (eng/flat-id (conj (cmd-path) id) (:id k)) (:b k) kx ky))))

;; ───── presentation mode: only the presented boxes, at their presentation places ─────

(defonce pres-mode (atom false))

(defn view-box
  "A box as it is placed on screen: in presentation, at its presentation place."
  [b]
  (if (and @pres-mode (:present b)) (assoc b :x (first (:present b)) :y (second (:present b))) b))

(defn scene-of
  "The patch that is drawn: in presentation, only its presented boxes, without lines."
  [p]
  (if @pres-mode
    {:boxes (into (sorted-map) (for [[id b] (:boxes p) :when (:present b)] [id (view-box b)])) :lines []}
    p))

(defn presentation
  "Switches the patch between editing and presentation (only the presented boxes, where the performer sees them)."
  ([] (presentation (not @pres-mode)))
  ([on]
   (reset! pres-mode (boolean on))
   (.toggle (.-classList ($ "canvas-wrap")) "pres" @pres-mode)
   (.toggle (.-classList ($ "pres-toggle")) "on" @pres-mode)
   (set! (.-textContent ($ "pres-toggle")) (if @pres-mode "Edit" "Present"))
   (swap! ui assoc :sel nil :nsel nil)
   (render-all!)
   @pres-mode))

(declare code-win-box)

(defn code-view
  "SVG of a code box: the source text, the status of its compilation and its parameters."
  [id b w]
  (let [d (box-def b) idn (esc (name id))
        {:keys [ch y-st y-par params]} (code-geom b)
        [gist n] (code-gist b)
        source (str (get-in b [:data :source]))
        open? (= id (code-win-box))
        r (cbox/compiled (:language d) source)
        inf (:info r)
        [st cls] (case (:status r)
                   :empty ["empty · double-click to write" "st-wait"]
                   :compiling ["compiling…" "st-wait"]
                   :ok [(str "✓ " (or (:summary inf) "ready")) "st-ok"]
                   :error [(str "✗ " (first (str/split-lines (str (:error r))))) "st-err"]
                   ["" "st-wait"])]
    (str "<svg x=\"2\" y=\"" hdr "\" width=\"" (- w 4) "\" height=\"" ch "\" overflow=\"hidden\">"
         "<rect class=\"code-area" (when open? " open") "\" data-box=\"" idn "\" x=\"0\" y=\"0\" width=\"" (- w 4) "\" height=\"" ch "\">"
         "<title>Double-click to edit the code</title></rect>"
         "<text class=\"code\" xml:space=\"preserve\" x=\"6\" y=\"15\">"
         (esc (cond (str/blank? source) "{ } double-click to write"
                    (> (count gist) 30) (str (subs gist 0 30) "…")
                    :else gist))
         "</text>"
         (when (pos? n)
           (str "<text class=\"code lines\" x=\"" (- w 10) "\" y=\"15\" text-anchor=\"end\">"
                (if open? "✎ open" (str n (if (= 1 n) " line" " lines"))) "</text>"))
         "</svg>"
         "<text class=\"lbl " cls "\" x=\"8\" y=\"" y-st "\">" (esc (if (> (count st) 52) (str (subs st 0 52) "…") st))
         (when (= :error (:status r)) (str "<title>" (esc (:error r)) "</title>")) "</text>"
         (apply str (map-indexed
                     (fn [i p]
                       (let [y (+ y-par (* i param-h))]
                         (str "<text class=\"lbl pname\" x=\"8\" y=\"" (+ y 12) "\">" (esc (:label p)) "</text>"
                              "<rect class=\"param" (when (#{"button" "checkbox"} (:type p)) " button") "\" data-box=\"" idn "\" data-param=\"" (esc (:label p))
                              "\" x=\"" param-x0 "\" y=\"" (+ y 3) "\" width=\"" (- w param-x0 64) "\" height=\"11\" rx=\"2\"></rect>"
                              ;; its value (drawn on top, in the live layer): a double-click there types it (issue #32)
                              (when-not (#{"button" "checkbox"} (:type p))
                                (str "<rect class=\"pval-hit\" data-box=\"" idn "\" data-param=\"" (esc (:label p))
                                     "\" x=\"" (- w 62) "\" y=\"" (+ y 1) "\" width=\"58\" height=\"15\">"
                                     "<title>Double-click to type a value</title></rect>")))))
                     params)))))

(defn param-value [id b p]
  (let [v (when-let [nd (eng/node (fid id))] (get @(:values nd) (:label p)))]
    (if (number? v) v (:init p))))

(defn params-overlay
  "Fill and value of the parameters of a code box (they change while it sounds)."
  [id b x y w]
  (let [{:keys [y-par params]} (code-geom b) tw (- w param-x0 64)]
    (apply str (map-indexed
                (fn [i p]
                  (let [v (param-value id b p)
                        u (if (> (:max p) (:min p)) (/ (- v (:min p)) (- (:max p) (:min p))) (if (pos? v) 1 0))
                        yy (+ y y-par (* i param-h))]
                    (str "<rect class=\"pfill\" x=\"" (+ x param-x0) "\" y=\"" (+ yy 3) "\" width=\"" (* tw (max 0 (min 1 u))) "\" height=\"11\" rx=\"2\"></rect>"
                         "<text class=\"pval\" x=\"" (+ x (- w 8)) "\" y=\"" (+ yy 12) "\" text-anchor=\"end\">" (cv/fmt v) "</text>")))
                params))))

(defn render-overlay! []
  (let [p (scene-of (current))
        on (eng/running?)
        parts (for [[id b] (:boxes p) :let [kc (klass (:text b)) [x y] (box-pos id b) [w h] (box-dims id b)]]
                (case kc
                  "number" (let [v (or (second (last-shown id)) (get-in @eng/rt [:states (fid id)])
                                       (eng/num-of (first (eng/args-of (:text b)))) 0)]
                             (str "<text class=\"value\" x=\"" (+ x grip 8) "\" y=\"" (+ y 16) "\">▸ " (esc (if (number? v) (cv/fmt v) (pr-str v))) "</text>"))
                  ("msg" "bang") (when (recent? (last-shown id))
                                   (str "<rect class=\"flash\" x=\"" (+ x grip) "\" y=\"" y "\" width=\"" (- w grip) "\" height=\"" h "\" rx=\"3\"></rect>"))
                  "reader" (when on
                             (when-let [[_ {:keys [t from axis pt]}] (last-shown id)]
                               (when-let [from (and from (number? t) (local-id from))] (cursor-at p from t "cur" true (or axis :x) pt))))
                  ("faust~") (params-overlay id b x y w)
                  ("canvas" "freqt") (when on
                                       (when-let [[at {:keys [t]}] (last-shown id)]
                                         (when (and (number? t) (< (- (eng/now) at) 2)) (cursor-at p id t "cur2" false))))
                  (when (own-view? b) (ctl-overlay id b x y))))]
    (set! (.-innerHTML ($ "cursors"))
          (str (apply str parts)
               ;; in presentation the readers are usually hidden, but their cursors still show on the canvases
               (when (and @pres-mode on)
                 (apply str (for [[id b] (:boxes (current))
                                  :when (and (= "reader" (klass (:text b))) (not (get-in p [:boxes id])))]
                              (when-let [[_ {:keys [t from axis pt]}] (last-shown id)]
                                (when-let [from (and from (number? t) (local-id from))]
                                  (cursor-at p from t "cur" true (or axis :x) pt))))))
               (apply str (for [[id b] (:boxes p) :when (panel-layout b) :let [[x y] (box-pos id b)]] (panel-overlay id b x y)))))))

;; ───── the header of a box with data: ⇄ shows it in its next view, { } opens its data as text in the
;;       code window (discussion #30) ─────

(defn next-view
  "The view after the one a box shows now, if its class has more than one."
  [b]
  (let [vs (vec (comp/views-of b)) cur (display-of b)]
    (when (> (count vs) 1)
      (nth vs (mod (inc (or (first (keep-indexed (fn [i v] (when (= v cur) i)) vs)) 0)) (count vs))))))

(defn header-chips
  "[[kind label title] …] for the header of a box: from right to left."
  [id b]
  (let [nv (next-view b)]
    (cond-> []
      (and (comp/source-of b) (not= :code (display-of b)))
      (conj [:code "{ }" (str "Its data as text, in the code window: (source " id ")")])
      nv (conj [:view (str "⇄ " (name nv)) (str "Show it as " (name nv) ": (view " id " " nv ")")]))))

(def chip-ch 6.4)   ; width of a character of a chip (10.5px mono)

(defn chips-svg
  "The chips drawn from the right edge `x1` of the header; returns [svg width]."
  [id chips x1]
  (reduce (fn [[acc right] [kind label title]]
            (let [cw (+ 10 (* chip-ch (count label))) x (- right cw)]
              [(str acc "<g class=\"hchip\" data-chip=\"" (name kind) "\" data-box=\"" (esc (name id)) "\">"
                    "<rect x=\"" x "\" y=\"3\" width=\"" cw "\" height=\"" (- hdr 6) "\" rx=\"3\"></rect>"
                    "<text x=\"" (+ x (/ cw 2)) "\" y=\"" (- hdr 6) "\" text-anchor=\"middle\">" (esc label) "</text>"
                    "<title>" (esc title) "</title></g>")
               (- x 4)]))
          ["" x1] chips))

(defn box-header [id b w]
  (let [tree-box? (= "tree" (klass (:text b)))
        [chips x1] (chips-svg id (header-chips id b) (- w 4))]
    (str "<rect class=\"head\" x=\"0.5\" y=\"0.5\" width=\"" (- w 1) "\" height=\"" (- hdr 1) "\"></rect>"
         "<text class=\"lbl\" x=\"8\" y=\"14\">" (esc (:text b)) "</text>"
         "<text class=\"lbl info\" x=\"" (- x1 (if (seq chips) 2 4)) "\" y=\"14\" text-anchor=\"end\">"
         (esc (cond
                (= :code (display-of b)) (str (:language (box-def b)) " · ✎")
                tree-box? (if-let [t (mtb/tree-of (:data b))] (mt/summary t) "empty")
                :else (cond
                        (live-tree id) (str "tree · " (mt/summary (live-tree id)) " · (keep! " id ")")
                        (kept-tree b) (str "kept · " (mt/summary (kept-tree b))
                                           (when-let [f (:from (:recipe b))] (str " · from " f)))
                        :else (str (when (= :score (display-of b)) "approx. · ") (cv/summary (canvas-data b))
                                   (when (:recipe b) (str " · changed since kept (remake! " id ")")))))) "</text>"
         chips)))

(declare gesture!)

(defn render-crumbs!
  "Where the patch on screen is: work › :b5 patch voice › …"
  []
  (let [path @view-path root (root-patch)]
    (set! (.-innerHTML ($ "crumbs"))
          (if (empty? path)
            ""
            (str "<button data-up=\"" (count path) "\">work</button>"
                 (apply str (map-indexed
                             (fn [i id]
                               (let [b (get-in (patch-in root (take i path)) [:boxes id])
                                     label (esc (str id " " (:text b)))]
                                 (str " › " (if (= i (dec (count path)))
                                              (str "<span class=\"here\">" label "</span>")
                                              (str "<button data-up=\"" (- (count path) i 1) "\">" label "</button>")))))
                             path)))))))

(.addEventListener ($ "pres-toggle") "click" (fn [_] (gesture! (str "(presentation " (not @pres-mode) ")"))))

(.addEventListener ($ "crumbs") "click"
  (fn [e] (when-let [n (.. e -target -dataset -up)] (gesture! (str "(up " n ")")))))

(declare render-inspector!)

(defn render-scene [p]
  (let [p (scene-of p)
        {:keys [sel wire hover-in nsel ldrag]} @ui
        chosen (sel-ids)
        _ (doseq [[id b] (:boxes p) :when (= :score (display-of b))] (score-entry! id b))
        lines (map-indexed
               (fn [idx [a o b i :as l]]
                 (if (and (get-in p [:boxes a]) (get-in p [:boxes b]))
                   (let [[x1 y1] (out-xy p a o) [x2 y2] (in-xy p b i)
                         s (str (if (= sel [:line l]) " sel" "")
                                (when (and (= o 2) (= "freqt" (klass (get-in p [:boxes a :text])))) " edits"))
                         buf (and (= i 1) (music-classes (klass (get-in p [:boxes a :text]))))]
                     (str "<line class=\"wire" s (when buf " buffer") "\" x1=\"" x1 "\" y1=\"" y1 "\" x2=\"" x2 "\" y2=\"" y2 "\"></line>"
                          "<line class=\"wire-hit\" data-line=\"" idx "\" x1=\"" x1 "\" y1=\"" y1 "\" x2=\"" x2 "\" y2=\"" y2 "\"></line>"))
                   ""))
               (:lines p))
        bxs (for [[id b] (:boxes p)]
              (let [[x y] (box-pos id b) t (:text b) [w h] (box-dims id b) [ins outs] (io b)
                    kc (klass t)
                    music-box? (contains? #{:canvas :score} (display-of b))
                    code-box? (= :code (display-of b))
                    ctl? (own-view? b)
                    action-box? (or ctl? (contains? action-classes kc))
                    cls (str "box" (when (kairos-classes kc) " kairos") (when (comp/subpatch? b) " sub") (when (or music-box? code-box?) " mus") (when code-box? " code")
                             (when action-box? (str " act " (if ctl? "ctl" kc)))
                             (when (contains? chosen id) " sel") (when (= id (first hover-in)) " drop")
                             (when (and (:present b) (not @pres-mode)) " presented") (when (panel-layout b) " panel"))
                    idn (esc (name id))
                    d (if (music? b) (shown-data id b) (canvas-data b))
                    content (case (if music-box? (display-of b) kc)
                              :canvas (let [dr (when (and ldrag (= (:box ldrag) id)) ldrag)
                                             g (if dr (:g dr) (canvas-geom d))]
                                         (cv/svg idn d g (when (= (first nsel) id) (second nsel))
                                                 (when (and dr (= :move (:kind dr)) (:moved dr)) {(:tid dr) (:pts dr)})
                                                 (when (and dr (= :draw (:kind dr))) (:pts dr))))
                              :score (let [c (get @score-cache id)]
                                        (str "<rect class=\"paper mus-body\" data-box=\"" idn "\" x=\"2\" y=\"" hdr "\" width=\"" (- w 4) "\" height=\"" (- h hdr 2) "\"></rect>"
                                             "<g class=\"score-slot\" data-box=\"" idn "\" transform=\"translate(4," (+ hdr 4) ")\"></g>"
                                             (cond
                                               (nil? c) (str "<text class=\"wait\" x=\"12\" y=\"" (+ hdr 26) "\">"
                                                             (if (= :error @vrv-status)
                                                               "Could not load Verovio (the notation): ⇄ shows it another way"
                                                               "Loading the notation (Verovio, about 8 MB)…")
                                                             "</text>")
                                               (:error c) (str "<text class=\"wait\" x=\"12\" y=\"" (+ hdr 26) "\">"
                                                               (esc (str "Could not draw: " (:error c))) "</text>"))))
                              "bang" (str "<circle class=\"bangc\" cx=\"" (+ grip (/ (- w grip) 2)) "\" cy=\"" (/ h 2) "\" r=\"7\"></circle>")
                              "msg" (str "<text x=\"" (+ grip 6) "\" y=\"16\">" (esc (str/trim (subs (str/trim t) 3))) "</text>")
                              (when ctl?
                                (str "<rect class=\"ctl-area\" x=\"" grip "\" y=\"0\" width=\"" (- w grip) "\" height=\"" h "\"><title>"
                                     (esc (str t (when-let [u (:doc (box-def b))] (str " — " u)))) "</title></rect>")))]
                (str "<g class=\"" cls "\" data-box=\"" idn "\" transform=\"translate(" x "," y ")\">"
                     "<rect class=\"body\" width=\"" w "\" height=\"" h "\" rx=\"3\"></rect>"
                     (cond code-box? (str (box-header id b w) (code-view id b w))
                           music-box? (str (box-header id b w) content)
                           (panel-layout b) (panel-svg id b w)
                           action-box? (str "<rect class=\"grip\" x=\"0\" y=\"0\" width=\"" grip "\" height=\"" h "\" rx=\"2\"></rect>" content)
                           :else (str "<text x=\"10\" y=\"16\">" (esc t) "</text>"))
                     (apply str (for [i (range ins)]
                                  (str "<rect class=\"port in" (when (= hover-in [id i]) " target") "\" data-box=\"" idn "\" data-in=\"" i "\" x=\"" (port-x w ins i) "\" y=\"-1\" width=\"" pw "\" height=\"4\"></rect>")))
                     (apply str (for [o (range outs)]
                                  (str "<rect class=\"port out\" data-box=\"" idn "\" data-out=\"" o "\" x=\"" (port-x w outs o) "\" y=\"" (- h 3) "\" width=\"" pw "\" height=\"4\"></rect>")))
                     "</g>")))
        temp (when (and wire (get-in p [:boxes (:from wire)]))
               (let [[x1 y1] (out-xy p (:from wire) (:out wire))]
                 (str "<line class=\"wire temp\" x1=\"" x1 "\" y1=\"" y1 "\" x2=\"" (:x wire) "\" y2=\"" (:y wire) "\"></line>")))]
    (set! (.-innerHTML ($ "scene")) (str (apply str lines) (apply str bxs) temp))
    ;; the paper grows with what is on it (with room to keep going), so nothing at the edge is cut off
    (let [[mx my] (reduce (fn [[mx my] [id b]]
                            (let [[x y] (box-pos id b) [w h] (box-dims id b)]
                              [(max mx (+ x w)) (max my (+ y h))]))
                          [0 0] (:boxes p))
          cv ($ "canvas") st (.-style cv)]
      (if (and embed-mode (seq (:boxes p)))
        ;; embedded: the whole patch in the frame, scaled (a patch only shrinks; a presentation fills it)
        (let [[x0 y0] (reduce (fn [[ax ay] [id b]] (let [[x y] (box-pos id b)] [(min ax x) (min ay y)]))
                              [js/Infinity js/Infinity] (:boxes p))
              pad 14 x0 (- x0 pad) y0 (- y0 pad)
              bw (- (+ mx pad) x0) bh (- (+ my pad) y0)
              wrap ($ "canvas-wrap") cw (max 1 (.-clientWidth wrap)) ch (max 1 (.-clientHeight wrap))
              fill? (= embed-mode :present)
              [vw vh] (if fill? [bw bh] [(max bw cw) (max bh ch)])]
          (.setAttribute cv "viewBox" (str x0 " " y0 " " vw " " vh))
          (.setAttribute cv "preserveAspectRatio" (if fill? "xMidYMid meet" "xMinYMin meet"))
          (set! (.-width st) "100%")
          (set! (.-height st) "100%"))
        (do (.removeAttribute cv "viewBox")
            (set! (.-width st) (str (max 900 (+ mx 160)) "px"))
            (set! (.-height st) (str (max 680 (+ my 200)) "px")))))
    (render-crumbs!)
    ;; scores already drawn are put back in their box, with the chosen stroke marked
    (doseq [slot (array-seq (.querySelectorAll ($ "scene") ".score-slot"))]
      (let [id (keyword (.. slot -dataset -box)) c (get @score-cache id)]
        (when-let [node (:node c)]
          (.appendChild slot node)
          ;; the note selected for editing (Study 20)
          (doseq [el (array-seq (.querySelectorAll node ".tsel"))] (.remove (.-classList el) "tsel"))
          (when-let [ts (:tsel @ui)]
            (when (= (:score ts) id)
              (when-let [pid (tsel-piece-id ts (:pieces c))]
                (when-let [el (.querySelector node (str "#" pid))] (.add (.-classList el) "tsel")))))
          (when (empty? (:anchors c))
            (swap! score-cache assoc-in [id :anchors] (score-anchors node (:pieces c))))
          (doseq [el (array-seq (.querySelectorAll node "g.note.sel"))] (.remove (.-classList el) "sel"))
          (when (= (first nsel) id)
            (doseq [el (array-seq (.querySelectorAll node (str "[id^=\"n-" (name id) "-" (name (second nsel)) "-\"]")))]
              (.add (.-classList el) "sel"))))))
    (render-overlay!)
    (render-inspector!)))

;; ───── inspector: the selected box, editable from the patch ─────
;; Under a box opened with ⌘/Ctrl+click (a plain click only selects and moves it): its class and usage,
;; one field per declared argument (:args) and its whole text. Changing a field rewrites the box with
;; (text! …), as if it had been typed.

(defonce insp-key (atom nil))

(defn arg-kind [v] (cond (boolean? v) :flag (or (number? v) (keyword? v)) :num :else :word))

(defn spec-of [d]
  (let [sp (:args d)] (when (and (sequential? sp) (seq sp) (every? (fn [x] (and (vector? x) (keyword? (first x)))) sp)) sp)))

(defn insp-field [a v cur]
  (case (arg-kind v)
    :flag (str "<label><input type=\"checkbox\" data-arg=\"" (name a) "\"" (when cur " checked") "> " (name a) "</label>")
    :num (str "<label>" (name a) " <input data-arg=\"" (name a) "\" value=\"" (if (number? cur) (cv/fmt cur) "") "\" size=\"6\" inputmode=\"decimal\"></label>")
    (str "<label>" (name a) " <input data-arg=\"" (name a) "\" value=\"" (esc (if (keyword? cur) (name cur) (str (or cur "")))) "\" size=\"8\"></label>")))

(defonce insp-busy (atom false))

(defn insp-commit! [input]
  (let [id (first @insp-key) b (when id (get-in (current) [:boxes id]))]
    (when b
      (let [d (box-def b) role (.. input -dataset -role) arg (.. input -dataset -arg)]
        (reset! insp-busy true)
        (try (cond
          (= role "text")
          (let [v (str/trim (.-value input))]
            (when (and (seq v) (not= v (:text b))) (gesture! (str "(text! " id " " (pr-str v) ")"))))
          arg
          (let [a (keyword arg) sv (some (fn [[k v]] (when (= k a) v)) (spec-of d))
                vals (comp/args-for d (:text b)) raw (str/trim (.-value input))
                nv (case (arg-kind sv)
                     :flag (.-checked input)
                     :num (let [n (js/parseFloat raw)] (if (js/isNaN n) (get vals a) n))
                     (when (seq raw) (keyword raw)))
                t (comp/args-text d (klass (:text b)) (assoc vals a nv))]
            (when (not= t (:text b)) (gesture! (str "(text! " id " " (pr-str t) ")")))))
          (finally (reset! insp-busy false)))))))

(defn render-inspector! []
  (let [old ($ "inspector") [kind id] (:sel @ui)
        moving? (let [d (:drag @ui)] (and d (:moved d)))   ; hidden while a box is being moved
        b (when (and (= kind :box) (= id (:insp @ui)) (not @pres-mode) (not moving?)) (get-in (current) [:boxes id]))
        k (when b [id (:text b) (:x b) (:y b) (cmd-path)])
        focused (.-activeElement js/document)]
    ;; a field being edited is applied before the inspector goes away or is redrawn
    (when (and old (not @insp-busy) (not= k @insp-key) (.contains old focused) (= "INPUT" (.-tagName focused)))
      (insp-commit! focused))
    (cond
      (nil? b) (do (reset! insp-key nil) (when old (.remove old)))
      (= k @insp-key) nil
      :else
      (let [d (box-def b) spec (spec-of d) vals (when spec (comp/args-for d (:text b)))
            [_ h] (box-dims id b)
            el (or old (let [el (js/document.createElement "div")]
                         (set! (.-id el) "inspector")
                         (.addEventListener el "change" (fn [e] (insp-commit! (.-target e))))
                         (.addEventListener el "keydown"
                           (fn [e] (case (.-key e)
                                     "Enter" (.blur (.-target e))
                                     "Escape" (do (reset! insp-key nil) (swap! ui assoc :insp nil) (render-inspector!))
                                     nil)))
                         (.appendChild ($ "canvas-wrap") el)
                         el))]
        (reset! insp-key k)
        (set! (.-title el) (or (:doc d) ""))
        (let [[px py] (wrap-px (:x b) (+ (:y b) h 8))]
          (set! (.. el -style -left) (str px "px"))
          (set! (.. el -style -top) (str py "px")))
        (set! (.-innerHTML el)
              (str "<div class=\"insp-head\"><b>" (esc (klass (:text b))) "</b> <span>" (esc (or (:usage d) "")) "</span></div>"
                   (when spec (str "<div class=\"insp-args\">" (apply str (for [[a v] spec] (insp-field a v (get vals a)))) "</div>"))
                   "<input class=\"insp-text\" data-role=\"text\" spellcheck=\"false\" value=\"" (esc (:text b)) "\">"))))))

;; ───── engine: start, stop and messages ─────

(defn transport-info! []
  (let [on (eng/running?)]
    (set! (.-textContent ($ "transport-info")) (if on "engine running" "engine stopped"))
    (.toggle (.-classList ($ "play")) "on" on)))

(declare sync-live-trees!)

(defn live! []
  (when (eng/running?)
    (when (sync-live-trees!) (render-scene (current)))
    (render-overlay!)
    (let [ps (eng/take-prints!)]
      (doseq [[_ v] (take 12 ps)] (repl-print! "out" (esc (str "print: " (pr-str v)))))
      (when (> (count ps) 12) (repl-print! "out" (esc (str "print: … and " (- (count ps) 12) " more")))))
    (js/requestAnimationFrame (fn [_] (live!)))))

(defn play
  "Starts the engine and fires the loadbang boxes. Everything else acts when messages reach it."
  []
  (let [was-on (eng/running?)]
    (eng/start! (fn [] (work-patch)) true)
    (transport-info!)
    (when-not was-on (js/requestAnimationFrame (fn [_] (live!))))
    :running))

(defn stop
  "Stops the engine: silence, and ramps, metros and counters go back to their initial state."
  []
  (eng/stop!)
  (transport-info!)
  (render-overlay!)
  ;; back to the initial state: the data boxes send what they hold again, so what depends on them has it
  (refill-data!)
  :stopped)

(defn send!
  "Sends a message to a box, as if it came through a line: (send! :b5 2.5) · (send! :b4 0 [0 8 2]) · (send! :b8 :bang)."
  ([id v] (send! id 0 v))
  ([id inlet v]
   (need-box id)
   (let [was-on (eng/running?)]
     (let [[tid ti] (target id inlet)] (inject-local! tid ti v))
     (when-not was-on (transport-info!) (js/requestAnimationFrame (fn [_] (live!))))
     v)))

;; ───── the Code tab and the REPL line: CodeMirror once it is loaded (14-editor.cljs), a textarea and an
;; input until then (or if it cannot be loaded). Everything reads and writes them through these.

(defonce code-ed (atom nil))   ; the editor of the Code tab
(defonce repl-ed (atom nil))   ; the editor of the REPL line

(defn code-text [] (if-let [e @code-ed] (.getValue e) (.-value ($ "code"))))
(defn set-code-text! [v] (if-let [e @code-ed] (when (not= v (.getValue e)) (.setValue e v)) (set! (.-value ($ "code")) v)))
(defn repl-text [] (if-let [e @repl-ed] (.getValue e) (.-value ($ "repl-in"))))
(defn set-repl-text! [v] (if-let [e @repl-ed] (do (.setValue e v) (.cursorToEnd e)) (set! (.-value ($ "repl-in")) v)))
(defn focus-repl! [] (if-let [e @repl-ed] (.focus e) (.focus ($ "repl-in"))))

(defonce data-ed (atom nil))   ; the read-only editor of the Data view of the Code tab

(defn data-view? [] (= :data (:code-view @ui)))

(defn set-data-text! [v]
  (if-let [e @data-ed]
    (when (not= v (.getValue e)) (.setValue e v))
    (when (not= v (.-textContent ($ "edn"))) (set! (.-textContent ($ "edn")) v))))

(defn render-code [p]
  (let [{:keys [dirty]} @ui data (data-view?)]
    (when-not dirty (set-code-text! (patch->code p)))
    ;; the data is written only while it is shown: it is the whole state, pretty-printed
    (when data (set-data-text! (patch->edn p)))
    (let [st ($ "code-state")]
      (set! (.-textContent st) (cond data "read-only: the state the history produces"
                                     dirty "edited: run it to apply it to the patch"
                                     :else "in sync with the patch"))
      (set! (.-className st) (if (and dirty (not data)) "state dirty" "state")))
    (set! (.-hidden ($ "code-run")) data)
    (set! (.-hidden ($ "code-revert")) data)
    (set! (.-disabled ($ "code-run")) (not dirty))
    (set! (.-disabled ($ "code-revert")) (not dirty))))
