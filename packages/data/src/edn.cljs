;; edn · any value as a tree to open, read and pick from
;; Part of @kairotic/data. Written against the Kairotic API (api/…).
;; After Portal (djblue/portal): what arrives is shown as a tree whose collections open and close, each
;; value coloured by its kind, a closed collection previewed on its line. Picking a line sends that part
;; of the value (left) and its path (right), the path a fetch box takes as [:get …]. Dragging scrolls.
;; What happens in the view (open, pick, scroll) is a message to the box itself, like any gesture, so
;; the same value sent again changes nothing.
(let [row-h 14 top-y 22 foot-h 16 cw 5.6            ; a line, where lines start, the footer, a character (size 9)
      max-children 200 max-rows 3000
      coll-kind (fn [v] (cond (map? v) :map (vector? v) :vector (set? v) :set (sequential? v) :list :else nil))
      opener {:map "{" :vector "[" :set "#{" :list "("}
      plural (fn [n one many] (str n " " (if (= 1 n) one many)))
      size-text (fn [v] (case (coll-kind v)
                          :map (plural (count v) "key" "keys")
                          (:vector :list) (plural (count v) "item" "items")
                          :set (plural (count v) "element" "elements")
                          nil))
      ;; the colour of a value, by its kind (the palette of the patch, light or dark)
      ink-of (fn [v] (cond (string? v) :ink (number? v) :kairos (keyword? v) :accent
                           (or (nil? v) (boolean? v)) :soft (coll-kind v) :soft :else :ink))
      ;; one level down: the parts of a collection, in a steady order, at most max-children of them
      entries (fn [c]
                (let [es (case (coll-kind c)
                           :map (for [[k v] (sort-by (fn [[k _]] (pr-str k)) c)] {:k k :label (pr-str k) :key? true :v v})
                           :set (for [v (sort-by pr-str c)] {:k v :label "" :v v})
                           (map-indexed (fn [i v] {:k i :label (str i) :v v}) c))
                      shown (vec (take max-children es))]
                  (if (> (count c) max-children)
                    (conj shown {:more (- (count c) max-children)})
                    shown)))
      ;; a part of the value by its path: get-in, also through lists and sets
      part (fn [root path]
             (reduce (fn [c k] (case (coll-kind c)
                                 (:map :set) (get c k)
                                 (:vector :list) (if (number? k) (nth (seq c) k nil) nil)
                                 nil))
                     root path))
      ;; the lines of the tree as it is open: [{:path :depth :label :key? :v :open? :more}]
      rows-of (fn [{:keys [root open]}]
                (if-not (coll-kind root)
                  []
                  (loop [todo (into () (reverse (map (fn [e] (assoc e :path [(:k e)] :depth 0)) (entries root))))
                         out (transient [])]
                    (if (or (empty? todo) (>= (count out) max-rows))
                      (persistent! out)
                      (let [r (first todo) more (rest todo)
                            open? (and (coll-kind (:v r)) (contains? open (:path r)) (not (:more r)))
                            kids (when open? (map (fn [e] (assoc e :path (conj (:path r) (:k e)) :depth (inc (:depth r))))
                                                  (entries (:v r))))]
                        (recur (if open? (into more (reverse kids)) more)
                               (conj! out (assoc r :open? open?))))))))
      visible (fn [h] (max 1 (js/Math.floor (/ (- h top-y foot-h) row-h))))
      size-of (fn [args] (api/padded (filter number? args) [320 300]))
      ;; every collection down to depth n, open (at most max-rows of them)
      open-to (fn [root n]
                (loop [todo (list [[] root 0]) acc #{}]
                  (if (or (empty? todo) (> (count acc) max-rows))
                    acc
                    (let [[p v d] (first todo)
                          kids (when (and (coll-kind v) (< d n))
                                 (for [e (entries v) :when (and (not (:more e)) (coll-kind (:v e)))] [(conj p (:k e)) (:v e) (inc d)]))]
                      (recur (into (rest todo) kids) (if (and (seq p) (coll-kind v) (<= d n)) (conj acc p) acc))))))
      shown-of (fn [st] {:top (:top st 0) :sel (:sel st) :open (count (:open st))})
      with-top (fn [st top h] (let [n (count (rows-of st))] (assoc st :top (max 0 (min (js/Math.round top) (- n (visible h)))))))]
  {;; ── about ──
   :class "edn"
   :license "MPL-2.0"
   :doc "Shows any value as a tree, like Portal: maps, vectors, sets and lists open and close (▸ ▾), each value coloured by its kind, a closed collection previewed on its line. Picking a line sends that part of the value (left) and its path (right): the path a fetch box takes as [:get …]. Dragging scrolls (or the bar on the right). depth n opens it n levels down; bang sends the picked part again (the whole value if none); clear empties it."
   :usage "edn [width height]"
   :io [1 2]
   :size (fn [box] (size-of (:args box)))

   ;; ── logic ──
   :receive (fn [{:keys [value state args]}]
              (let [st (or state {:open #{} :top 0})
                    [_ h] (size-of args)
                    msg? (fn [k] (and (vector? value) (= k (first value))))
                    view (fn [st2] {:state st2 :show (shown-of st2)})]
                (cond
                  ;; what happens in the view
                  (msg? :edn-open)
                  (let [[_ p on] value]
                    (view (with-top (update st :open (if on conj disj) p) (:top st 0) h)))
                  (msg? :edn-top) (view (with-top st (second value) h))
                  (msg? :edn-pick)
                  (let [p (second value)]
                    (if (or (= p (:sel st)) (not (contains? st :root)))
                      {:state st}
                      {:state (assoc st :sel p) :show (shown-of (assoc st :sel p))
                       :out [[1 p] [0 (part (:root st) p)]]}))
                  ;; messages
                  (and (msg? :depth) (number? (second value)))
                  (view (with-top (assoc st :open (open-to (:root st) (max 0 (dec (second value))))) 0 h))
                  (#{:bang "bang"} value)
                  (if (contains? st :root)
                    (let [p (or (:sel st) [])] {:out [[1 p] [0 (part (:root st) p)]]})
                    {})
                  (#{:clear "clear"} value) (view {:open #{} :top 0})
                  ;; a value: the same again changes nothing; another keeps what was open and picked
                  (and (contains? st :root) (= value (:root st))) {:state st}
                  :else
                  (let [st2 (assoc st :root value)]
                    (view (with-top st2 (:top st 0) h))))))

   ;; a line pressed (on its arrow: open or close it; elsewhere: pick it), or a drag that scrolls
   :gesture (fn [{:keys [up hit dy start state h]}]
              (let [st (or state {}) rows (rows-of st) n (count rows) vis (visible h)
                    t0 (:top start (:top st 0))]
                (cond
                  (>= (js/Math.abs dy) 3)
                  [:edn-top (if (= hit :bar)
                              (+ t0 (* dy (/ n (* vis row-h))))
                              (- t0 (/ dy row-h)))]
                  (not up) nil
                  (keyword? hit)
                  (let [i (js/parseInt (subs (name hit) 1) 10) r (get rows i)]
                    (when (and r (not= hit :bar)) [:edn-open (:path r) (not (:open? r))]))
                  (number? hit) (when-let [r (get rows hit)] (when-not (:more r) [:edn-pick (:path r)]))
                  :else nil)))

   ;; ── view ──
   :draw (fn [{:keys [state w h]}]
           (let [st (or state {}) root (:root st) rows (rows-of st) n (count rows)
                 vis (visible h) top (max 0 (min (:top st 0) (- n vis))) bar? (> n vis)
                 right (- w (if bar? 14 6))
                 chars (fn [x] (max 0 (js/Math.floor (/ (- right x) cw))))
                 cut (fn [s x] (let [m (chars x)] (if (> (count s) m) (str (subs s 0 (max 0 (dec m))) "…") s)))
                 line (fn [j r i]
                        (let [y (+ top-y (* j row-h)) base (+ y 10)
                              x (+ 8 (* 12 (:depth r))) v (:v r) kind (coll-kind v)
                              lbl (:label r) vx (+ x 12 (if (seq lbl) (* cw (inc (count lbl))) 0))
                              sel? (= (:sel st) (:path r))]
                          (if (:more r)
                            [[:text {:x (+ x 12) :y base :size 9 :fill :soft} (str "… " (:more r) " more")]]
                            (concat
                             [[:rect {:x 2 :y y :w (- right 2) :h row-h :fill (if sel? :accent :bg) :opacity (if sel? 0.14 0) :hit i}]]
                             (when kind
                               [[:rect {:x (- x 2) :y y :w 12 :h row-h :fill :bg :opacity 0 :hit (keyword (str "t" i))}]
                                [:text {:x x :y base :size 9 :fill :soft} (if (:open? r) "▾" "▸")]])
                             (when (seq lbl)
                               [[:text {:x (+ x 12) :y base :size 9 :fill (if (:key? r) :accent :soft)} (cut lbl (+ x 12))]])
                             [[:text {:x vx :y base :size 9 :fill (ink-of v)}
                               (cut (cond (and kind (:open? r)) (str (opener kind) " " (size-text v))
                                          kind (pr-str v)
                                          :else (pr-str v))
                                    vx)]]))))]
             (concat
              [[:rect {:x 1 :y 1 :w (- w 2) :h (- h 2) :r 4 :stroke :grid :fill :bg}]
               [:text {:x 8 :y 15 :size 9 :fill :soft}
                (cond (not (contains? st :root)) "edn · send it a value"
                      (coll-kind root) (str (name (coll-kind root)) " · " (size-text root))
                      :else (str (cond (string? root) "string" (number? root) "number" (keyword? root) "keyword"
                                       (nil? root) "nil" (boolean? root) "boolean" :else "value")))]
               [:line {:x1 1 :y1 19 :x2 (- w 1) :y2 19 :stroke :grid}]]
              ;; a value that is not a collection: itself, on one line
              (when (and (contains? st :root) (not (coll-kind root)))
                [[:text {:x 8 :y (+ top-y 10) :size 9 :fill (ink-of root)} (cut (pr-str root) 8)]])
              (mapcat (fn [j] (line j (nth rows (+ top j)) (+ top j))) (range (min vis (- n top))))
              (when bar?
                (let [track (* vis row-h) th (max 14 (* track (/ vis n))) ty (+ top-y (* (- track th) (/ top (max 1 (- n vis)))))]
                  [[:rect {:x (- w 10) :y top-y :w 6 :h track :r 3 :fill :grid :hit :bar}]
                   [:rect {:x (- w 10) :y ty :w 6 :h th :r 3 :fill :soft :hit :bar}]]))
              [[:line {:x1 1 :y1 (- h foot-h) :x2 (- w 1) :y2 (- h foot-h) :stroke :grid}]
               [:text {:x 8 :y (- h 5) :size 8 :fill :soft}
                (cut (cond (:sel st) (str "→ " (pr-str (:sel st)))
                           (seq rows) (str n (if (= 1 n) " line" " lines") (when bar? (str " · " (inc top) "–" (min n (+ top vis)))) " · pick a line")
                           :else "")
                     8)]])))

   ;; ── help ──
   :help {:inlets ["any value: a map, a vector, a set, a list, or a single value; depth n · bang · clear"]
          :outlets ["the part picked" "its path, for [:get …] of a fetch box"]
          :messages [["depth 2" "opens it two levels down"]
                     ["bang" "sends the part picked again (the whole value if none)"]
                     ["clear" "empties it"]]
          :try "Send it a fetch's answer and open the branches: pick a line and its path comes out on the right."}})
