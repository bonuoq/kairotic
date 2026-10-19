;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 2 of 12: commands
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── commands ─────────────────────────

(defonce ui (atom {:sel nil :drag nil :wire nil :hover-in nil :dirty false :hist [] :hidx nil :follow nil}))

;; What is selected: [:box id] · [:boxes #{id …}] (several, by ⇧+click or a frame) · [:line l] · nil.
;; :insp is the box whose inspector is open (⌘/Ctrl+click): a plain click selects and moves, nothing more.

(defn sel-ids
  "The boxes selected now (a set)."
  []
  (let [[kind v] (:sel @ui)] (case kind :box #{v} :boxes v #{})))

(defn sel-of
  "The selection made of these boxes."
  [ids]
  (case (count ids) 0 nil 1 [:box (first ids)] [:boxes (set ids)]))

(defn fail [msg] (throw (js/Error. msg)))

(defn dispatch-root!
  "An event of the whole work (its ids already lead from the top: [:in :b5 …] for a sub-patch), wherever the
   view is: to the scratch patch, to the take in Perform, or to the history."
  [ev]
  (cond
    @scratch (swap! scratch step ev)
    @perf (perform-event! ev)
    (= :connecting (:mode @hist)) (fail "Still connecting to the shared history; try again in a moment.")
    (= :none (:mode @hist)) (fail "Open or create a work from the session manager.")
    :else (do (when (:follow @ui) (swap! ui assoc :follow nil))
              (commit! ev))))

(defn dispatch! [ev] (dispatch-root! (wrap-in (cmd-path) ev)))

(declare ensure-class!)

(defn need-box [id]
  (or (get-in (current) [:boxes id]) (fail (str "There is no box " id))))

(defn next-id []
  (let [nums (keep (fn [k] (let [m (re-matches #"b(\d+)" (name k))] (when m (js/parseInt (second m) 10))))
                   (keys (:boxes (current))))]
    (keyword (str "b" (inc (if (seq nums) (apply max nums) 0))))))

(defn auto-pos []
  (let [n (count (:boxes (current)))]
    [(+ 40 (* 24 (mod n 12))) (+ 40 (* 36 (mod n 12)))]))

(defn box
  ([text] (let [[x y] (auto-pos)] (box (next-id) text x y)))
  ([text x y] (box (next-id) text x y))
  ([id text x y]
   (when-not (keyword? id) (fail "A box id is a keyword, e.g. :b3"))
   (forget-box! id)
   (dispatch! [:box id (str text) (js/Math.round x) (js/Math.round y)])
   (ensure-class! text)
   id))

(defn connect [a o b i]
  (let [[_ outs] (io (need-box a))
        [ins _] (io (need-box b))]
    ;; boxes with computed ports (or of classes not defined yet) accept any port
    (when-not (or (comp/dynamic? (need-box a)) (< -1 o outs)) (fail (str a " has no outlet " o " (it has " outs ")")))
    (when-not (or (comp/dynamic? (need-box b)) (< -1 i ins)) (fail (str b " has no inlet " i " (it has " ins ")")))
    (when (= a b) (fail "A box cannot be connected to itself"))
    (dispatch! [:connect a o b i])
    [a o b i]))

(defn disconnect [a o b i] (dispatch! [:disconnect a o b i]) :ok)
(defn move [id x y] (need-box id) (dispatch! [:move id (js/Math.round x) (js/Math.round y)]) [x y])
(defn text! [id text] (need-box id) (dispatch! [:text id (str text)]) (eng/forget! (fid id)) (ensure-class! text) id)

(defn delete
  "Deletes boxes, with their lines: (delete :b3) · (delete :b3 :b4 :b7)."
  [& ids]
  (when (empty? ids) (fail "Which box? (delete :b3)"))
  (doseq [id ids] (need-box id))
  (doseq [id (distinct ids)] (forget-box! id) (dispatch! [:delete id]))
  :ok)

(defn- shift-ids [ids dx dy where]
  (when-not (and (sequential? ids) (seq ids)) (fail "Give the boxes as a vector: [:b1 :b2]"))
  (when-not (and (number? dx) (number? dy)) (fail "dx and dy are numbers"))
  (let [ids (distinct ids) p (current)]
    (doseq [id ids] (need-box id))
    (let [pos (for [id ids :let [b (get-in p [:boxes id])]]
                [id (if (= where :present) (:present b) [(:x b) (:y b)])])]
      (when (and (= where :present) (some (comp nil? second) pos))
        (fail (str "Not in presentation: " (str/join " " (keep (fn [[id xy]] (when-not xy id)) pos)))))
      ;; nobody goes past the top or the left edge: the group stops there together
      (let [dx (max dx (- (apply min (map (comp first second) pos))))
            dy (max dy (- (apply min (map (comp second second) pos))))]
        (doseq [[id [x y]] pos]
          (dispatch! [where id (js/Math.round (+ x dx)) (js/Math.round (+ y dy))]))
        [(js/Math.round dx) (js/Math.round dy)]))))

(defn move-by
  "Moves several boxes together: (move-by [:b1 :b2 :b5] 40 0)."
  [ids dx dy] (shift-ids ids dx dy :move))

(declare child-dims)

(defn present
  "Shows a box in presentation (and in the panel of its sub-patch) at x y; without x y, next to the others."
  ([id]
   (need-box id)
   (let [p (current)
         right (for [[k b] (:boxes p) :let [[x _] (:present b)] :when (and x (not= k id))]
                 (+ x (first (child-dims b))))]
     (present id (if (seq right) (+ 8 (apply max right)) 0) 0)))
  ([id x y]
   (need-box id)
   (dispatch! [:present id (js/Math.round x) (js/Math.round y)])
   [x y]))

(def size-min [220 110])
(def size-max [2400 1600])

(defn resizable?
  "Boxes drawn with a size of their own: a canvas, a freqt, and a score (a freqt or a tree shown as a score)."
  [b] (contains? #{:canvas :score} (display-of b)))

(defn resize
  "Gives a canvas, freqt or score box a size of its own, as one event: (resize :b3 640 300). A score keeps
   the height of its notation, and its width reflows it. (resize :b3) brings back its default size."
  ([id]
   (need-box id)
   (dispatch! [:size id nil])
   :default)
  ([id w h]
   (let [b (need-box id)]
     (when-not (resizable? b) (fail (str id " is not drawn with a size of its own (a canvas, a freqt or a score is)")))
     (when-not (and (number? w) (number? h)) (fail "A size is a width and a height: (resize :b3 640 300)"))
     (let [[w0 h0] size-min [w1 h1] size-max
           w (js/Math.round (max w0 (min w1 w))) h (js/Math.round (max h0 (min h1 h)))]
       (dispatch! [:size id w h])
       [w h]))))

(defn present-in-place
  "Shows boxes in presentation where they are in the patch, as one event (issue #42): (present-in-place :b3 :b4)."
  [& ids]
  (when (empty? ids) (fail "Which boxes? (present-in-place :b3 :b4)"))
  (let [evs (vec (for [id (distinct ids) :let [b (need-box id)]] [:present id (js/Math.round (:x b)) (js/Math.round (:y b))]))]
    (dispatch! (if (= 1 (count evs)) (first evs) [:batch evs]))
    (vec (distinct ids))))

(defn unpresent "Takes a box out of presentation." [id] (need-box id) (dispatch! [:present id nil]) :ok)

(defn present-by
  "Moves several presented boxes together in presentation: (present-by [:b1 :b5] 0 24)."
  [ids dx dy] (shift-ids ids dx dy :present))

(declare box-num box-num-e)

;; canvases: each canvas box (or its score view) keeps a graphic buffer of frequency × time;
;; its events arrive wrapped in [:in box event]

(defn music? [b] (contains? music-classes (klass (:text b))))

(defn need-canvas [id]
  (let [b (need-box id)]
    (when-not (music? b) (fail (str id " is not a canvas (nor a freqt or a score)")))
    b))

(defn canvas-data
  "The buffer of a canvas box, or the empty one of its class (generic canvas or freqt)."
  [b] (or (:data b) (:empty (comp/model-of b)) cv/empty))

;; ───── musical trees shown live (Study 19) ─────
;; A canvas, freqt or score that receives a tree (kairotic.mt) shows it over its buffer, without
;; touching the history; (keep! :bN) writes it into the buffer, as one event.

(defonce live-trees (atom {}))   ; engine id → tree
;; trees kept (keep!) or put away (unlive!): the engine still remembers them as the last thing the box
;; received, so they are not shown again until a different tree arrives
(defonce dismissed-trees (atom {}))   ; engine id → tree

(defn live-tree [id] (get @live-trees (fid id)))

(defn shown-data
  "What a canvas or freqt draws: its buffer, or the tree it received (with the buffer's grids)."
  [id b]
  (let [d (canvas-data b)]
    (if-let [t (live-tree id)]
      (try (if (cv/generic? d)
             (let [x (mt/->canvas t)] (assoc d :strokes (:strokes x) :ax (:ax x)))
             (assoc d :strokes (:strokes (mt/->strokes t))))
           (catch :default _ d))
      d)))

(defn box-data
  "The buffer of a canvas: {:strokes {:t1 {:pts [[x y] ...]}} :ax axes :gx grid :gy grid or tuning}."
  [id] (canvas-data (need-canvas id)))

(defn need-stroke [id tid]
  (or (get-in (box-data id) [:strokes tid]) (fail (str id " has no stroke " tid))))

(defn need-pitch [a]
  (or (sc/pitch a) (fail (str "I do not understand the pitch " (pr-str a) ". Use 60, \"c4\", \"f#3\" or \"bb2\"."))))

(defn need-pts
  ([pts] (need-pts cv/empty pts))
  ([d pts]
   (or (cv/sane-pts-for d pts)
       (fail (if (cv/generic? d)
               "A stroke is at least two different points [x y], e.g. [[0 0] [8 1]]"
               "A stroke is at least two points [t hz] with increasing times, e.g. [[0 440] [1 440]]")))))

(defn need-freqt [id]
  (when (cv/generic? (box-data id)) (fail (str id " is a generic canvas: notes, degrees and tunings belong to a freqt")))
  id)

(defn stroke
  "Draws (or rewrites) a stroke: (stroke :b1 [[0 440] [1 440]]) or (stroke :b1 :t4 [[0 440] [2 660]])."
  ([id pts] (stroke id (cv/next-id (box-data id)) pts))
  ([id tid pts]
   (need-canvas id)
   (when-not (keyword? tid) (fail "A stroke id is a keyword, e.g. :t3"))
   (dispatch! [:in id [:stroke tid (need-pts (box-data id) pts)]])
   tid))

(defn note
  "A horizontal stroke: (note :b1 t \"c4\" dur), with the pitch as MIDI or by name (a4 = 440 Hz)."
  [id t pch dur]
  (need-freqt id)
  (when-not (and (number? t) (number? dur) (>= t 0) (pos? dur)) (fail "A note is (note box t pitch duration)"))
  (let [f (cv/round-to (cv/midi->hz (need-pitch pch)) 3)]
    (stroke id [[t f] [(+ t dur) f]])))

(defn degree
  "A horizontal stroke on degree n of the canvas tuning (0 = the reference)."
  [id t n dur]
  (let [gy (or (:gy (box-data id)) (fail (str id " has no tuning: use (tuning " id " \"12-tet\")")))
        f (cv/round-to (cv/degree->hz gy n) 3)]
    (when-not (and (number? t) (number? dur) (>= t 0) (pos? dur)) (fail "A degree is (degree box t n duration)"))
    (stroke id [[t f] [(+ t dur) f]])))

(defn melody
  "A line of notes from t0 (by default, where the canvas ends): \"c4/1 d4/.5 r/1 c4+e4/2\"."
  ([id txt] (melody id txt (cv/end-t (box-data id))))
  ([id txt t0]
   (need-canvas id)
   (need-freqt id)
   (doall (for [[t a d] (sc/parse-melody txt t0)] (note id t a d)))))

(defn move-stroke
  "Shifts a stroke by dx along X and dy along Y (in cents on a freqt or a log axis)."
  [id tid dt dc]
  (need-stroke id tid)
  (dispatch! [:in id [:move tid dt dc]])
  tid)

(defn stretch
  "Lengthens (k > 1) or shortens (k < 1) a stroke in time, from its start."
  [id tid k]
  (need-stroke id tid)
  (when-not (and (number? k) (pos? k)) (fail "The stretch factor is a positive number"))
  (dispatch! [:in id [:stretch tid k]])
  tid)

(defn erase-stroke [id tid] (need-stroke id tid) (dispatch! [:in id [:erase tid]]) :ok)

(defn canvas-edit!
  "Several edits of a canvas as one event: (canvas-edit! :b1 [[:stroke :t5 [[0 1] [1 2]]] [:erase :t2]]).
   What the messages on the left inlet of a canvas become (issue #26)."
  [id evs]
  (need-canvas id)
  (when-not (and (sequential? evs) (every? vector? evs)) (fail "The edits are a vector of events: [[:stroke :t1 pts] …]"))
  (dispatch! [:in id [:batch (vec evs)]])
  (count evs))

(defn clear [id] (need-canvas id) (dispatch! [:in id [:clear]]) :ok)

(defn grid-x
  "Time grid: (grid-x :b1 0.25 [4]) · (grid-x :b1 0.5 \"3+3+2\") · (grid-x :b1 nil).
   The step quantizes while drawing; the cycles group (like bars, simple or additive)."
  ([id gx] (if (nil? gx) (do (need-canvas id) (dispatch! [:in id [:grid-x nil]]) :no-grid) (fail "Use (grid-x box step cycles) or nil")))
  ([id step-size cycles]
   (need-canvas id)
   (let [gx (cv/sane-gx {:step step-size :cycles cycles})]
     (when-not gx (fail "The step is a positive number"))
     (dispatch! [:in id [:grid-x gx]])
     gx)))

(defn tunings
  "Tunings available by name (besides any Scala .scl pasted as text)."
  [] (vec (sort (keys cv/tunings))))

(defn tuning
  "Frequency grid: a name from (tunings), the text of a .scl or {:name :cents}, and the
   reference frequency of degree 0 (by default C4 = 261.63 Hz). With nil, continuous frequency."
  ([id tun] (tuning id tun cv/default-ref))
  ([id tun ref]
   (need-canvas id)
   (need-freqt id)
   (if (nil? tun)
     (do (dispatch! [:in id [:tuning nil]]) :continuous)
     (let [base (cond (map? tun) tun
                      (and (string? tun) (get cv/tunings (str/lower-case tun))) (get cv/tunings (str/lower-case tun))
                      (string? tun) (cv/parse-scl tun)
                      :else (fail "Use a name from (tunings), the text of a .scl or a map {:name :cents}"))
           gy (cv/sane-gy (assoc base :ref ref))]
       (when-not gy (fail "That tuning is not valid"))
       (dispatch! [:in id [:tuning gy]])
       (select-keys gy [:name :ref])))))

(defn read-at
  "What a canvas holds at x = v (or along :y): [[stroke value] ...], every crossing."
  ([id v] (read-at id :x v))
  ([id axis v] (cv/read-along (box-data id) axis v)))

(defn axis
  "Range and scale of an axis of a generic canvas: (axis :b1 :y -1 1) · (axis :b1 :x 20 20000 :log)."
  [id k lo hi & [scale]]
  (need-canvas id)
  (when-not (cv/generic? (box-data id)) (fail (str id " is a freqt: its axes are time and frequency")))
  (when-not (#{:x :y} k) (fail "The axis is :x or :y"))
  (let [ax (assoc (:ax (box-data id)) k {:lo lo :hi hi :log (= scale :log)})
        ok (cv/sane-ax ax)]
    (when-not (= (get ok k) (get ax k)) (fail "An axis goes from lo to hi (lo < hi; both positive if :log)"))
    (dispatch! [:in id [:axis ok]])
    (get ok k)))

(defn grid-y
  "A regular grid on Y (values snap to it while drawing): (grid-y :b1 0.25) · (grid-y :b1 nil)."
  [id step-size]
  (need-canvas id)
  (if (nil? step-size)
    (do (dispatch! [:in id [:grid-y nil]]) :no-grid)
    (let [gy (cv/sane-gy {:step step-size})]
      (when-not gy (fail "The step is a positive number"))
      (dispatch! [:in id [:grid-y gy]])
      gy)))

;; code boxes: their source is data of the work; each tab compiles it locally

(declare render-all!)

(defn need-code-box [id]
  (let [b (need-box id) d (box-def b)]
    (when-not (= :code (:display d)) (fail (str id " is not a code box (faust~, script…)")))
    d))

(declare tree!)

(defn code-source!
  "Writes the source of a code box (as one event)."
  [id source]
  (let [d (need-code-box id)]
    (when-not (string? source) (fail "The source is a string"))
    (dispatch! [:in id [:source source]])
    (:status (cbox/compiled (:language d) source))))

(defn data-source!
  "Writes the data of a box from its text, as its model reads it (a canvas, freqt or score: the EDN of its
   buffer). What changed, and only that, is one event of the history (discussion #30)."
  [id text]
  (let [b (need-box id) m (comp/model-of b)]
    (when-not (and (fn? (:read m)) (fn? (:diff m))) (fail (str id " has no data that can be written as text")))
    (when-not (string? text) (fail "The text is a string"))
    (let [d (or (:data b) (:empty m))
          d2 (try ((:read m) d text) (catch :default e (fail (.-message e))))
          evs ((:diff m) d d2)]
      (if (seq evs)
        (do (dispatch! [:in id [:batch (vec evs)]])
            (str (count evs) (if (= 1 (count evs)) " edit" " edits")))
        :unchanged))))

(defn code
  "Writes the source of a code box: (code :b7 \"process = os.osc(440) * 0.1;\"). For a tree box the text
   is read as a tree, and what changed becomes edits of its nodes (tree!). For a canvas, freqt or score
   it is the EDN of its buffer ((source :bN) gives it), and what changed becomes edits of its strokes."
  [id source]
  (let [b (need-box id)]
    (cond
      (= "tree" (klass (:text b)))
      (do (when-not (string? source) (fail "The source is a string"))
          (tree! id (try (mt/read-tree source) (catch :default e (fail (str "That is not EDN: " (.-message e)))))))
      (fn? (:read (comp/model-of b))) (data-source! id source)
      :else (code-source! id source))))

(defn source
  "The source of a code box, or the data of a canvas, freqt or score as EDN text."
  [id]
  (or (comp/source-of (need-box id)) (fail (str id " has no code (faust~, script, tree…) nor a buffer (canvas, freqt, score)"))))

(defn view
  "How a box is shown, among the views of its class: (view :b2 :score) shows a tree as a score and
   (view :b2 :code) as code again; a freqt can be a :canvas or a :score; :next is the next one. Its data
   does not change: a tree shown as a score is edited from its notes, and its code opens from { }."
  [id k]
  (let [b (need-box id) vs (vec (comp/views-of b))]
    (when (< (count vs) 2) (fail (str id " has one view only")))
    (let [cur (display-of b)
          k (if (= k :next)
              (nth vs (mod (inc (or (first (keep-indexed (fn [i v] (when (= v cur) i)) vs)) 0)) (count vs)))
              k)]
      (when-not (or (nil? k) (some #{k} vs))
        (fail (str id " can be shown as " (str/join " or " (map pr-str vs)))))
      (when-not (= (or k (first vs)) cur)
        (dispatch! [:view id (when-not (= k (first vs)) k)]))
      (or k (first vs)))))

;; musical trees (Study 19): mt/… are the functions on trees (mt/transpose, mt/events, mt/pp …)
;; A tree box keeps its tree and its history is made of node edits (Study 20): tree! writes the
;; difference with what it had; tree-edit! writes exact edits.

(defn need-tree-box [id]
  (let [b (need-box id)]
    (when-not (= "tree" (klass (:text b))) (fail (str id " is not a tree box")))
    b))

(defn tree-data "The tree a tree box holds (as written)." [id] (mtb/tree-of (:data (need-tree-box id))))

(defn tree!
  "Writes a tree into a tree box: (tree! :b3 [:voice \"c4/1 e4 g4\"]). What changes is written as edits of
   its nodes, in one event of the history."
  [id t]
  (need-tree-box id)
  (when-let [ps (seq (mt/errors t))] (fail (first ps)))
  (doseq [w (mt/warnings t)] (repl-print! "out" (esc (str "; ⚠ " w))))
  (let [old (tree-data id)
        ops (if (some? old) (mt/diff old t) [[:set [] t]])]
    (if (seq ops)
      (do (dispatch! [:in id [:edit ops]])
          (str (count ops) (if (= 1 (count ops)) " edit" " edits") " · " (mt/summary t)))
      :unchanged)))

(defn tree-edit!
  "Edits the nodes of a tree box, as one event: (tree-edit! :b2 [:attrs [0 1 2] {:pitch \"d4\" :dur 1}]).
   Edits: [:set path x] · [:attrs path {…}] · [:insert path x] · [:remove path]; a path is the list of child
   indices from the root (attributes are not counted)."
  [id & ops]
  (need-tree-box id)
  (let [t (tree-data id)
        t2 (try (reduce mt/apply-op t ops) (catch :default e (fail (.-message e))))]
    (when-let [ps (seq (mt/errors t2))] (fail (first ps)))
    (doseq [w (mt/warnings t2)] (repl-print! "out" (esc (str "; ⚠ " w))))
    (dispatch! [:in id [:edit (vec ops)]])
    (mt/summary t2)))

(defn node-at "The node of a tree box at a path: (node-at :b2 [0 1])." [id path] (mt/node-at (tree-data id) path))

(defn as-tree
  "A box as a tree: a tree box, the tree a canvas or score is showing, or the strokes of its buffer."
  [id]
  (let [b (need-box id)]
    (cond
      (= "tree" (klass (:text b))) (mt/expand (mtb/tree-of (:data b)))
      (live-tree id) (live-tree id)
      ;; a buffer kept from a tree, unchanged since: the tree itself, not an approximation of its strokes
      (and (:recipe b) (not (:stale (:recipe b)))) (:tree (:recipe b))
      (music? b) (mt/<-strokes (canvas-data b))
      :else (fail (str id " is not a tree, a canvas, a freqt or a score")))))

(declare patch->code)

(defn tree->buffer
  "The buffer d with the strokes of tree t (and, in a generic canvas, axes that fit it)."
  [d t]
  (if (cv/generic? d)
    (let [x (mt/->canvas t)] (assoc d :strokes (:strokes x) :ax (:ax x)))
    (assoc d :strokes (:strokes (mt/->strokes t)))))

(defn without-meta
  "x without metadata (a tree remembers where it was written; its recipe keeps only the tree)."
  [x]
  (cond (map? x) (into {} (map (fn [[k v]] [(without-meta k) (without-meta v)]) x))
        (vector? x) (mapv without-meta x)
        (seq? x) (apply list (map without-meta x))
        :else x))

(defn upstream-of
  "The boxes of patch p whose output reaches box id, through any chain of lines."
  [p id]
  (loop [front #{id} seen #{}]
    (let [new (set (for [[a _ b _] (:lines p) :when (and (front b) (not= a id) (not (seen a)))] a))]
      (if (empty? new) seen (recur new (into seen new))))))

(defn recipe-for
  "The recipe of tree t arriving at box id of the current patch: the tree, the boxes and lines upstream
   as code (their own recipes left out), and the box it came from."
  [id t]
  (let [p (current)
        up (upstream-of p id)
        sub {:boxes (into (sorted-map) (for [k up :let [b (get-in p [:boxes k])] :when b] [k (dissoc b :recipe)]))
             :lines (vec (filter (fn [[a _ b _]] (and (up a) (or (up b) (= b id)))) (:lines p)))}]
    (cond-> {:tree (without-meta t)}
      (seq up) (assoc :calls (patch->code sub))
      (some (fn [[a _ b _]] (when (= b id) a)) (:lines p)) (assoc :from (some (fn [[a _ b _]] (when (= b id) a)) (:lines p))))))

(defn keep!
  "Writes the tree a canvas, freqt or score is showing into its buffer, keeping beside it the recipe that
   made it (the tree and the boxes upstream): one event in the history."
  [id]
  (let [b (need-canvas id) t (or (live-tree id) (fail (str id " is not showing a tree: send it one first")))]
    (dispatch! [:kept id (tree->buffer (canvas-data b) t) (recipe-for id t)])
    (swap! dismissed-trees assoc (fid id) t)
    (swap! live-trees dissoc (fid id))
    (mt/summary t)))

(defn recipe
  "The recipe kept beside a buffer: (recipe :b5) → {:tree … :calls … :from … :stale true if the buffer
   changed since}. (recipe :b5 r) sets it (the code of a work does), (recipe :b5 nil) removes it."
  ([id] (:recipe (need-box id)))
  ([id r] (need-box id) (dispatch! [:recipe id r]) (some? (sane-recipe r))))

(defn remake!
  "Writes the tree of a buffer's recipe back into the buffer (one event): what keep! wrote, without the
   changes made since."
  [id]
  (let [b (need-canvas id)
        r (or (:recipe b) (fail (str id " has no recipe: it was not kept from a tree")))]
    (dispatch! [:kept id (tree->buffer (canvas-data b) (:tree r)) r])
    (mt/summary (:tree r))))

(defn unlive!
  "Stops showing the tree a box received: its buffer again."
  [id]
  (when-let [t (live-tree id)] (swap! dismissed-trees assoc (fid id) t))
  (swap! live-trees dissoc (fid id))
  :ok)

(defn compilation
  "How the compilation of a code box went: {:status :error :info}."
  [id]
  (let [d (need-code-box id)]
    (select-keys (cbox/compiled (:language d) (source id)) [:status :error :info])))

(defn trust-scripts
  "Allows (or not) this tab to evaluate the script boxes of the open work. Solo and
   local works always allow it; in a shared room it has to be asked for, because a script runs the
   code of whoever wrote it inside this page."
  [on?]
  (reset! cbox/trust (boolean on?))
  (cbox/forget-language! "clojurescript")
  (cbox/forget-language! "component")
  (render-all!)
  (boolean on?))

(defn components
  "The available box classes."
  [] (mapv first (comp/listing)))

(defn help
  "What a box class does: (help \"ramp\")."
  [cls-name]
  (let [d (or (comp/lookup (str cls-name))
              (when (seq (hlp/of (str cls-name))) (assoc (hlp/of (str cls-name)) :class (str cls-name)))
              (fail (str "There is no class " (pr-str cls-name) "; see (components)")))]
    (show-help! (:class d))
    (cond-> {:class (:class d) :doc (:doc d)}
      (:usage d) (assoc :usage (:usage d))
      (vector? (:io d)) (assoc :inlets (first (:io d)) :outlets (second (:io d))))))

(defn patch [] (current))

(defn boxes
  ([] (keys (:boxes (current))))
  ([s] (keep (fn [[id b]] (when (str/includes? (:text b) s) id)) (:boxes (current)))))

;; navigating the history (creates no events: it only changes where you are)

(defn here []
  (let [p (norm (:pos @world))]
    (if p {:segment (first p) :n (second p) :moment (depth-of p)} :no-events)))

(defn stop-follow! [] (when (:follow @ui) (swap! ui assoc :follow nil)))

(defn children-at [nid idx]
  (filter (fn [n] (and (= (:parent n) nid) (= (:at n) idx))) (vals (:nodes @hist))))

(defn leaf? [[nid idx]]
  (and (node nid) (= idx (count (:events (node nid)))) (empty? (children-at nid idx))))

(defn auto-advance!
  "With front on, moves forward to the newest tip that continues your line."
  []
  (let [{:keys [pos auto]} @world]
    (when (and auto pos (not (:follow @ui)))
      (let [p (norm pos) f (front-from p)]
        (when (and f (not= (norm f) p))
          (swap! world assoc :prev-pos p :pos f :jumped-at (js/Date.now)))))))

(defn front
  "Turns on or off moving forward with anyone's gestures."
  [on?]
  (swap! world assoc :auto (boolean on?) :prev-pos nil)
  (when on? (auto-advance!))
  (boolean on?))

(declare show-leave-dialog!)

(defn not-performing!
  "Travelling in the history leaves the take behind: in Perform, it is asked for first."
  [] (when @perf
       (show-leave-dialog!)
       (fail "You are in Perform: leave it first with (compose), keeping the take or not.")))

(defn perf-undo!
  "In Perform, ◀ and Ctrl+Z take back your last changes of the take (and ▶ brings them again)."
  [k]
  (swap! perf (fn [st]
                (loop [st st k k]
                  (let [e (peek (:own st))]
                    (if (or (zero? k) (nil? e) (<= (:t e) (or (:cut st) 0)))
                      (perf-recompute st)
                      (recur (-> st (update :own pop) (update :redo conj e)) (dec k)))))))
  (jam-push!)
  {:take (count (perf-events @perf))})

(defn perf-redo! [k]
  (swap! perf (fn [st]
                (loop [st st k k]
                  (let [e (peek (:redo st))]
                    (if (or (zero? k) (nil? e))
                      (perf-recompute st)
                      ;; brought again now: it takes its place at the end of the take
                      (recur (-> st (update :redo pop) (update :own conj (assoc e :t (js/Date.now)))) (dec k)))))))
  (jam-push!)
  {:take (count (perf-events @perf))})

(defn goto [nid n]
  (not-performing!)
  (when-not (node nid) (fail (str "There is no segment " (pr-str nid))))
  (stop-follow!)
  (let [p (norm [nid n])]
    (swap! world assoc :pos p :auto (leaf? p) :prev-pos nil))
  (here))

(defn rewind
  ([] (rewind 1))
  ([k]
   (if @perf
     (perf-undo! k)
     (do (stop-follow!)
         (swap! world assoc :auto false :prev-pos nil)
         (dotimes [_ k]
           (let [p (norm (:pos @world))]
             (when (and p (pos? (second p)))
               (swap! world assoc :pos (norm [(first p) (dec (second p))])))))
         (here)))))

(defn undo [] (rewind 1))

(defn forward
  ([] (forward 1))
  ([k]
   (if @perf
     (perf-redo! k)
     (do (stop-follow!)
         (swap! world assoc :auto false :prev-pos nil)
         (dotimes [_ k]
           (let [p (norm (:pos @world))]
             (when p
               (let [[nid idx] p n (node nid)]
                 (if (< idx (count (:events n)))
                   (swap! world assoc :pos [nid (inc idx)])
                   (when-let [c (last (sort-by :t (children-at nid idx)))]
                     (swap! world assoc :pos [(:id c) 1])))))))
         (here)))))

(defn tip []
  (not-performing!)
  (stop-follow!)
  (when-let [p (norm (:pos @world))] (swap! world assoc :pos (tip-of (first p)) :auto true :prev-pos nil))
  (auto-advance!)
  (here))

(defn merge-from
  "Brings to where you are the events of the branch that goes through [segment n]. The merge is one more event."
  [nid n]
  (not-performing!)
  (when-not (node nid) (fail (str "There is no segment " (pr-str nid))))
  (when (#{:connecting :none} (:mode @hist)) (fail "Open a work before merging."))
  (let [src (norm [nid n]) tgt (norm (:pos @world))]
    (when-not tgt (fail "First place yourself at some point of the history."))
    (let [{:keys [error events renamed]} (plan-merge tgt src)]
      (when error (fail error))
      (stop-follow!)
      (let [id (new-node! (first tgt) (second tgt) events src)]
        (swap! world assoc :pos [id (count events)] :auto true :prev-pos nil))
      (cond-> {:events-merged (dec (count events))}
        (seq renamed) (assoc :renamed renamed)))))

(defn simultaneity
  "Interval (ms) below which two gestures are considered parallel and branch."
  ([] (:simul-ms @settings))
  ([ms]
   (when-not (and (number? ms) (<= 0 ms 10000)) (fail "Use a number of milliseconds between 0 and 10000."))
   (swap! settings assoc :simul-ms ms)
   (when (persist?)
     (let [path (work-base)]
       (enqueue! path (fn [] (.update (.doc @dbref path) (clj->js {:simultaneity_ms ms}))))))
   ms))

(defn branches []
  (let [ns (vals (:nodes @hist))
        parents (set (keep :parent ns))]
    {:segments (count ns)
     :tips (count (remove (fn [n] (parents (:id n))) ns))
     :events (reduce + (map (comp count :events) ns))}))

;; ───────────────────────── projections ─────────────────────────

(defn box-num [k] (let [m (re-matches #"b(\d+)" (name k))] (if m (js/parseInt (second m) 10) 1e9)))

(defn patch->code [p]
  (let [ids (sort-by box-num (keys (:boxes p)))]
    (str/join "\n"
              (concat [";; boxes"]
                      (for [id ids :let [{:keys [text x y]} (get-in p [:boxes id])]]
                        (str "(box " id " " (pr-str text) " " x " " y ")"))
                      (let [pr (filter (fn [id] (:present (get-in p [:boxes id]))) ids)]
                        (when (seq pr)
                          (concat ["" ";; presentation"]
                                  (for [id pr :let [[x y] (get-in p [:boxes id :present])]]
                                    (str "(present " id " " x " " y ")")))))
                      (let [vw (filter (fn [id] (:view (get-in p [:boxes id]))) ids)]
                        (when (seq vw)
                          (concat ["" ";; views"]
                                  (for [id vw] (str "(view " id " " (pr-str (get-in p [:boxes id :view])) ")")))))
                      (let [sz (filter (fn [id] (:size (get-in p [:boxes id]))) ids)]
                        (when (seq sz)
                          (concat ["" ";; sizes"]
                                  (for [id sz :let [[w h] (get-in p [:boxes id :size])]] (str "(resize " id " " w " " h ")")))))
                      (when (seq (:lines p)) ["" ";; lines"])
                      (for [[a o b i] (:lines p)]
                        (str "(connect " a " " o " " b " " i ")"))
                      (mapcat (fn [id]
                                (let [b (get-in p [:boxes id])
                                      ls ((:code (comp/model-of b)) id (:data b))]
                                  (when (seq ls) (concat ["" (str ";; data of " id)] ls))))
                              (filter (fn [id] (let [b (get-in p [:boxes id])] (and (:data b) (:code (comp/model-of b))))) ids))
                      ;; beside the data, the recipe that made it (keep!)
                      (mapcat (fn [id]
                                (when-let [r (get-in p [:boxes id :recipe])]
                                  ["" (str ";; recipe of " id (when (:stale r) " (stale: the buffer changed since)"))
                                   (str "(recipe " id " " (pr-str r) ")")]))
                              ids)))))

;; ───── the work as data, pretty: what the Data view of the Code tab shows ─────
;; Collections that fit in the width stay on one line; the others put one entry per line, aligned.
;; Keys come in a readable order: :text :x :y first, :data last, and :b2 before :b10.

(def edn-width 72)
(def key-rank {:class 0 :text 1 :x 2 :y 3 :present 4 :view 5 :size 6 :data 98 :recipe 99})

(defn natural-key
  "A sort key for map keys: the rank of known keys, then the name split into text and numbers."
  [k]
  (let [nm (if (keyword? k) (str (when (namespace k) (str (namespace k) "/")) (name k)) (pr-str k))]
    [(get key-rank k 50)
     (if (keyword? k) 0 1)
     (vec (map (fn [[_ txt num]] (if num [1 (js/parseInt num 10)] [0 txt]))
               (re-seq #"(\D+)|(\d+)" nm)))]))

(defn sorted-entries [m]
  (try (sort-by (comp natural-key key) m)
       (catch :default _ (seq m))))

(defn edn-line
  "EDN of x on one line, with the keys of its maps in the readable order."
  [x]
  (cond
    (map? x) (str "{" (str/join " " (for [[k v] (sorted-entries x)] (str (edn-line k) " " (edn-line v)))) "}")
    (vector? x) (str "[" (str/join " " (map edn-line x)) "]")
    (set? x) (str "#{" (str/join " " (map edn-line x)) "}")
    (seq? x) (str "(" (str/join " " (map edn-line x)) ")")
    :else (pr-str x)))

(defn pp-edn
  "EDN of x, at most `edn-width` wide where it can be, indented from column `col`."
  ([x] (pp-edn x 0))
  ([x col]
   (let [flat (edn-line x)]
     (if (or (<= (+ col (count flat)) edn-width) (not (coll? x)) (empty? x))
       flat
       (let [pad (fn [n] (apply str (repeat n " ")))]
         (cond
           (map? x)
           (str "{"
                (str/join (str "\n" (pad (inc col)))
                          (for [[k v] (sorted-entries x)]
                            (let [ks (edn-line k)
                                  vs (pp-edn v (+ col 2 (count ks)))]
                              (if (and (coll? v) (seq v) (str/includes? vs "\n") (> (count ks) 12))
                                (str ks "\n" (pad (+ col 2)) (pp-edn v (+ col 2)))
                                (str ks " " vs)))))
                "}")
           :else
           (let [[o c] (cond (vector? x) ["[" "]"] (set? x) ["#{" "}"] :else ["(" ")"])
                 inner (+ col (count o))]
             (str o (str/join (str "\n" (pad inner)) (map (fn [e] (pp-edn e inner)) x)) c))))))))

(defn patch->edn [p]
  (pp-edn {:boxes (:boxes p) :lines (vec (:lines p))}))

;; ───────────────────────── sub-patches ─────────────────────────
;; A `patch` box keeps a whole patch as its data, with its own history: editing inside it produces
;; events [:in :b5 [:box …]] in the history of the work, and its code is (inside :b5 …).

(comp/define! "patch"
  {:doc "An embedded sub-patch: double-click to open it. Its inlet / outlet boxes (numbered left to right) are its ports."
   :usage "patch [name]"
   :io (fn [b] (comp/patch-io (or (:data b) empty-patch)))
   :dynamic-io true
   :model {:empty empty-patch :step step :load sane-patch
           :code (fn [id d] (concat [(str "(inside " id)]
                                    (map (fn [l] (if (str/blank? l) l (str "  " l))) (str/split-lines (patch->code d)))
                                    [")"]))}})

(defn need-patch-box [id]
  (let [b (need-box id)]
    (when-not (embedded? b) (fail (str id " is not a patch box (create one with (box \"patch\" x y))")))
    id))

(defmacro inside
  "Runs the body inside the sub-patch :bN: (inside :b5 (box \"inlet\" 20 20) (connect …))."
  [id & body]
  `(do (need-patch-box ~id)
       (binding [*inside* (conj *inside* ~id)] ~@body)
       ~id))

(declare render-all!)

(defn enter
  "Opens the sub-patch :bN: the patch, the code and the commands now act inside it."
  [id]
  (need-patch-box id)
  (swap! view-path conj id)
  (swap! ui assoc :sel nil :nsel nil :dirty false)
  (render-all!)
  (cmd-path))

(defn up
  "Goes back to the patch that contains this one (or n levels up)."
  ([] (up 1))
  ([n] (swap! view-path (fn [p] (vec (drop-last (min n (count p)) p))))
       (swap! ui assoc :sel nil :nsel nil :dirty false)
       (render-all!)
       (cmd-path)))

(defn top "Goes back to the work itself." [] (up (count @view-path)))

(defn patch->source
  "A patch as EDN for the :patch of an abstraction."
  [p]
  (str "{:boxes {"
       (str/join "\n          " (for [id (sort-by box-num (keys (:boxes p)))] (str id " " (pr-str (get-in p [:boxes id])))))
       "}\n  :lines " (pr-str (:lines p)) "}"))

(defn abstract
  "Turns the sub-patch :bN into a class: a new component box defines it with :patch, and :bN becomes an
   instance of it. Write $1 $2 … in the texts inside to take the words of each instance."
  [id class-name]
  (need-patch-box id)
  (when-not (and (string? class-name) (re-matches #"[A-Za-z][A-Za-z0-9_~+*/<>=!?-]*" class-name))
    (fail "The class name is one word, e.g. \"voice\""))
  (when (comp/lookup class-name) (fail (str "«" class-name "» already exists")))
  (let [b (need-box id)
        src (str ";; " class-name " · an abstraction made from a patch\n"
                 "{:class " (pr-str class-name) "\n"
                 " :doc " (pr-str (str "Abstraction made from the sub-patch " id ".")) "\n"
                 " :usage " (pr-str class-name) "\n"
                 " :patch " (patch->source (or (:data b) empty-patch)) "}")
        nid (next-id)]
    (box nid "component" (+ (:x b) 180) (:y b))
    (code nid src)
    (text! id class-name)
    nid))

;; ───────────────────────── evaluation ─────────────────────────

(defn eval-str [code] (js/scittle.core.eval_string code))

(def example "\n(box :b1 \"canvas\" 40 60)\n(box :b2 \"loadbang\" 40 15)\n(box :b3 \"ramp 0 1 10 loop\" 140 15)\n(box :b4 \"reader path\" 40 290)\n(box :b5 \"freqt\" 500 60)\n(box :b6 \"phasor~ 0.25\" 500 15)\n(box :b7 \"reader~ 2 gate\" 500 290)\n(box :b8 \"osc~\" 500 340)\n(box :b9 \"osc~\" 600 340)\n(box :b10 \"gain~ 0.4\" 500 500)\n(box :b13 \"gain~\" 500 450)\n(box :b14 \"gain~\" 600 450)\n(box :b15 \"adsr~ 30 200 0.6 400\" 700 340)\n(box :b16 \"adsr~ 5 120 0.4 900\" 870 340)\n(box :b11 \"space~ 0 1\" 240 330)\n(box :b12 \"dac~ 1 2\" 240 470)\n(connect :b2 0 :b3 0)\n(connect :b3 0 :b4 0)\n(connect :b1 1 :b4 1)\n(connect :b6 0 :b7 0)\n(connect :b5 1 :b7 1)\n(connect :b7 0 :b8 0)\n(connect :b7 1 :b9 0)\n(connect :b8 0 :b13 0)\n(connect :b9 0 :b14 0)\n(connect :b7 2 :b15 0)\n(connect :b7 3 :b16 0)\n(connect :b15 0 :b13 1)\n(connect :b16 0 :b14 1)\n(connect :b13 0 :b10 0)\n(connect :b14 0 :b10 0)\n(connect :b10 0 :b11 0)\n(connect :b4 0 :b11 0)\n(connect :b11 0 :b12 0)\n(connect :b11 1 :b12 1)\n(axis :b1 :x -1 1)\n(axis :b1 :y -1 1)\n(stroke :b1 [[0 0.9] [0.7 0.6] [0.9 -0.1] [0.5 -0.7] [-0.2 -0.85] [-0.8 -0.4] [-0.9 0.3] [-0.45 0.8] [0 0.9]])\n(stroke :b5 [[0 220] [1 220] [2 330] [2.5 293.66] [3 440] [4 220]])\n(stroke :b5 [[0 330] [1.5 392]])\n(stroke :b5 [[2 261.63] [3 293.66] [4 330]])\n(present :b1 0 0)\n(present :b5 430 0)\n(present :b11 0 210)")






(defn box-num-e [k] (cv/id-num k))

(defn build
  "Evaluates code in a scratch patch and returns the resulting patch, without touching the history."
  [code]
  (reset! scratch empty-patch)
  (try
    (eval-str (str "(do " code "\n nil)"))
    (let [p @scratch] (reset! scratch nil) p)
    (catch :default e (reset! scratch nil) (throw e))))

(defn run-code!
  "Rebuilds the patch from the code: it stays as a single :load event."
  [code]
  (let [p (build code)] (dispatch! [:load p]) :ok))

(defn load-example [] (run-code! example))
