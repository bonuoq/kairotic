;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 1 of 12: work
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(ns user (:require [clojure.string :as str] [clojure.set] [kairotic.score :as sc] [kairotic.canvas :as cv]
                   [kairotic.components :as comp] [kairotic.api :as api] [kairotic.code :as cbox] [kairotic.faust] [kairotic.library :as lib] [kairotic.help :as hlp] [kairotic.mt :as mt] [kairotic.quantize :as qz] [kairotic.spell :as sp] [kairotic.treecanvas :as tc] [kairotic.mtboxes :as mtb] [kairotic.assistant :as ai] [kairotic.engine :as eng] [kairotic.presets :as pst] [kairotic.release :as rel] [kairotic.sounds :as snd]
                   [kairotic.shapes :as shp] [kairotic.signal] [kairotic.links :as links] [clojure.edn]))

(def version "0.2.0-alpha")

;; kairotic.code is aliased `cbox` (not `code`) because `code` is a REPL command defined below.

;; ───────────────────────── model of the work ─────────────────────────

(def empty-patch {:boxes (sorted-map) :lines []})

;; Box classes are components registered in kairotic.components: their ports, their view,
;; their data with its own history, their behaviour with messages and their audio all come from there.

(declare es? docs open-work! show-help! refresh-help! tsel-piece-id refill-data! forget-box! update-trust-bar! render-askbar! present-what! url-with copy-text!)   ; the Help tab (Study 18), defined further down
(def klass comp/klass)
(defn box-def [b] (comp/lookup (klass (:text b))))
;; how a box is shown: the view it chose among those of its class (a tree as a score or a roll, a freqt
;; as a canvas or a score: discussion #30), or the :display of its class
(defn display-of "How a box is drawn (a tree's roll is drawn as a canvas)." [b] (comp/drawn-as b))
(defn view-of "The view a box is shown in, by its name (:score, :roll, :canvas…)." [b] (comp/shown-as b))
(def own-view? comp/own-view?)

(defn io
  "Inlets and outlets of a box (or of a bare text)."
  [b] (comp/io (if (string? b) {:text b} b)))

;; boxes with a graphic buffer inside: score is another view of the same buffer
(def music-classes #{"canvas" "freqt"})
;; boxes that act when pressed (they are moved by their left grip)
(def action-classes #{"number" "msg" "bang"})
(def kairos-classes #{"state" "transition" "instruction" "region"})

(defn prune-lines
  "Removes the lines that no longer fit the ports of their boxes. Boxes with computed ports
   (such as faust~, which depends on its compilation) are not pruned: so the history does not depend
   on when each tab finished compiling."
  [p]
  (let [bx (:boxes p)
        ok? (fn [[a o b i]]
              (and (contains? bx a) (contains? bx b)
                   (or (comp/dynamic? (get bx a)) (< o (second (io (get bx a)))))
                   (or (comp/dynamic? (get bx b)) (< i (first (io (get bx b)))))))]
    (update p :lines (fn [ls] (vec (filter ok? ls))))))

;; ───── recipes (discussion #17) ─────
;; A buffer filled from a tree with (keep! :bN) keeps, beside its :data, the recipe that made it:
;; {:tree the tree as it arrived (measures, tuplets, dynamics…), :calls the boxes and lines upstream as
;; code, :from the box it came from, :stale true once the buffer has been changed since}. The recipe is
;; not part of the buffer: the buffer stays plain data, and the recipe says where it came from.

(defn sane-recipe [r]
  (when (and (map? r) (or (vector? (:tree r)) (string? (:tree r))))
    (cond-> {:tree (:tree r)}
      (string? (:calls r)) (assoc :calls (:calls r))
      (keyword? (:from r)) (assoc :from (:from r))
      (true? (:stale r)) (assoc :stale true))))


;; ───── layers: annotations and projections over or under the boxes (Study 26) ─────
;; A patch can have layers, drawn over or under its boxes, in the patch view, in the presentation or in
;; both. A layer holds marks — a line drawn by hand, an arrow, a text — whose points are anchored to a box
;; ([:b4 dx dy], from its top-left corner: they follow it when it moves) or to the paper ([:patch x y]),
;; and projections: the view of a box drawn again, at another size, somewhere on the paper.
;;   :layers      {:notes {:z :over :show #{:patch :present}}}
;;   :marks       {:a1 {:layer :notes :kind :line :pts [[:b4 -10 20] [:b7 0 -8] …]}
;;                 :a2 {:layer :notes :kind :text :at [:patch 400 60] :txt "enters the clarinet"}}
;;   :projections {:b9 {:layer :viz :rect [x y w h]}}
;; A mark anchored to a box that is deleted stays where it was, anchored to the paper.

(def layer-default {:z :over :show #{:patch :present}})

(defn sane-layer [l]
  (let [l (if (map? l) l {})
        show (set (filter #{:patch :present} (if (coll? (:show l)) (:show l) [])))]
    {:z (if (= :under (:z l)) :under :over)
     :show (if (and (coll? (:show l)) (contains? l :show)) show (:show layer-default))}))

(defn sane-anchor [a]
  (when (and (sequential? a) (= 3 (count a)) (keyword? (first a)) (number? (second a)) (number? (nth a 2))
             (js/isFinite (second a)) (js/isFinite (nth a 2)))
    [(first a) (/ (js/Math.round (* 10 (second a))) 10) (/ (js/Math.round (* 10 (nth a 2))) 10)]))

(defn sane-mark [m]
  (when (and (map? m) (keyword? (:layer m)))
    (case (:kind m)
      (:line :arrow) (let [ps (vec (keep sane-anchor (take 400 (:pts m))))]
                       (when (>= (count ps) 2) {:layer (:layer m) :kind (:kind m) :pts (if (= :arrow (:kind m)) [(first ps) (peek ps)] ps)}))
      :text (when-let [a (sane-anchor (:at m))]
              (let [t (str (:txt m))] (when (seq t) {:layer (:layer m) :kind :text :at a :txt (subs t 0 (min 200 (count t)))})))
      nil)))

(defn sane-projection [pr]
  (let [[x y w h] (:rect pr)]
    (when (and (map? pr) (keyword? (:layer pr)) (every? number? [x y w h]))
      {:layer (:layer pr) :rect [(js/Math.round x) (js/Math.round y) (max 40 (min 2400 (js/Math.round w))) (max 30 (min 2400 (js/Math.round h)))]})))

(defn with-layers
  "The layers, marks and projections of x, normalized, into patch p (only those it has)."
  [p x]
  (let [ls (into {} (for [[k l] (:layers x) :when (keyword? k)] [k (sane-layer l)]))
        ms (into (sorted-map) (for [[k m] (:marks x) :let [m (sane-mark m)] :when (and (keyword? k) m)] [k m]))
        ps (into (sorted-map) (for [[k pr] (:projections x) :let [pr (sane-projection pr)] :when (and (keyword? k) pr)] [k pr]))]
    (cond-> p (seq ls) (assoc :layers ls) (seq ms) (assoc :marks ms) (seq ps) (assoc :projections ps))))

(defn ensure-layer [p id] (if (get-in p [:layers id]) p (assoc-in p [:layers id] layer-default)))

(defn unanchor
  "The marks anchored to box id, with those points on the paper where they were (the box is going)."
  [p id]
  (let [b (get-in p [:boxes id])
        fix (fn [[a x y :as pt]] (if (and b (= a id)) [:patch (+ (:x b) x) (+ (:y b) y)] pt))]
    (if-not (:marks p)
      p
      (update p :marks (fn [ms] (into (sorted-map) (for [[k m] ms]
                                                      [k (cond-> m (:pts m) (update :pts (fn [ps] (mapv fix ps)))
                                                                   (:at m) (update :at fix))])))))))

(defn drop-empty [p k] (if (empty? (get p k)) (dissoc p k) p))

(defn shift-mark
  "Mark m moved by dx dy: each point keeps its anchor (a box or the paper) and moves from it."
  [m dx dy]
  (let [f (fn [[a x y]] (sane-anchor [a (+ x dx) (+ y dy)]))]
    (cond-> m (:pts m) (update :pts (fn [ps] (mapv f ps))) (:at m) (update :at f))))

(defn set-point
  "Mark m with its point i (of a line or an arrow) anchored as a, now [anchor dx dy]."
  [m i a]
  (if (and (:pts m) (< -1 i (count (:pts m))) (sane-anchor a)) (assoc-in m [:pts i] (sane-anchor a)) m))

(defn sane-patch
  "Events may come from other people: whatever arrives is normalized."
  [x]
  (if (map? x)
    (with-layers
    {:boxes (into (sorted-map)
                  (for [[k b0] (:boxes x) :when (and (keyword? k) (map? b0))
                        :let [b (comp/upgrade-box b0)]]
                    [k (cond-> {:text (str (:text b)) :x (or (:x b) 0) :y (or (:y b) 0)}
                         (and (vector? (:present b)) (= 2 (count (:present b))) (every? number? (:present b)))
                         (assoc :present (:present b))
                         (keyword? (:view b)) (assoc :view (:view b))
                         (and (vector? (:size b)) (= 2 (count (:size b))) (every? number? (:size b)))
                         (assoc :size (:size b))
                         (and (map? (:data b)) (comp/model-of b)) (assoc :data ((:load (comp/model-of b)) (:data b)))
                         (sane-recipe (:recipe b)) (assoc :recipe (sane-recipe (:recipe b))))]))
     :lines (vec (filter (fn [l] (and (vector? l) (= 4 (count l)))) (:lines x)))}
    x)
    empty-patch))

(defn step [p [op & args]]
  (case op
    ;; a box written with the name of a class that became a view of another one (score → freqt) is read
    ;; as that class, in that view: older works and histories keep working
    :box        (let [[id text x y] args] (if (keyword? id) (assoc-in p [:boxes id] (comp/upgrade-box {:text (str text) :x x :y y})) p))
    :text       (let [[id text] args]
                  (if (get-in p [:boxes id])
                    (prune-lines (update-in p [:boxes id] (fn [b] (comp/upgrade-box (assoc b :text (str text))))))
                    p))
    :move       (let [[id x y] args] (if (get-in p [:boxes id]) (update-in p [:boxes id] assoc :x x :y y) p))
    ;; where a box appears in presentation (and in the panel of the sub-patch it is in), or nil
    :present    (let [[id x y] args]
                  (cond (not (get-in p [:boxes id])) p
                        (and (number? x) (number? y)) (assoc-in p [:boxes id :present] [x y])
                        :else (update-in p [:boxes id] dissoc :present)))
    ;; how a box is shown, among the views of its class (discussion #30), or nil for its default
    :view       (let [[id k] args]
                  (cond (not (get-in p [:boxes id])) p
                        (keyword? k) (assoc-in p [:boxes id :view] k)
                        :else (update-in p [:boxes id] dissoc :view)))
    ;; the size of a box drawn with a size of its own (a canvas, a freqt, a score: issue #40), or nil for its default
    :size       (let [[id w h] args]
                  (cond (not (get-in p [:boxes id])) p
                        (and (number? w) (number? h)) (assoc-in p [:boxes id :size] [w h])
                        :else (update-in p [:boxes id] dissoc :size)))
    :connect    (let [l (vec args)] (if (some #{l} (:lines p)) p (update p :lines conj l)))
    :disconnect (let [l (vec args)] (update p :lines (fn [ls] (vec (remove #{l} ls)))))
    :delete     (let [[id] args]
                  (-> p (unanchor id)
                      (update :boxes dissoc id)
                      (update :lines (fn [ls] (vec (remove (fn [[a _ b _]] (or (= a id) (= b id))) ls))))
                      (update :projections dissoc id) (drop-empty :projections)))
    ;; [:layer :notes {:z :under :show #{:present}}] · [:layer :notes nil] removes it with its marks and projections
    :layer      (let [[id l] args]
                  (cond (not (keyword? id)) p
                        (nil? l) (-> p (update :layers dissoc id)
                                     (update :marks (fn [ms] (into (sorted-map) (remove (fn [[_ m]] (= id (:layer m))) ms))))
                                     (update :projections (fn [ps] (into (sorted-map) (remove (fn [[_ pr]] (= id (:layer pr))) ps))))
                                     (drop-empty :layers) (drop-empty :marks) (drop-empty :projections))
                        :else (assoc-in p [:layers id] (sane-layer l))))
    ;; [:annot :a1 {:layer :notes :kind :line :pts […]}] (its layer is made if missing) · [:annot :a1 nil] erases it
    ;; (not [:mark …]: that one is a point of the history, a snapshot or a take)
    :annot      (let [[id m] args]
                  (cond (not (keyword? id)) p
                        (nil? m) (-> p (update :marks dissoc id) (drop-empty :marks))
                        :else (if-let [m (sane-mark m)]
                                (-> p (ensure-layer (:layer m)) (update :marks (fnil assoc (sorted-map)) id m))
                                p)))
    ;; [:project :b9 {:layer :viz :rect [x y w h]}] · [:project :b9 nil]
    :project    (let [[id pr] args]
                  (cond (not (get-in p [:boxes id])) (if (nil? pr) (-> p (update :projections dissoc id) (drop-empty :projections)) p)
                        (nil? pr) (-> p (update :projections dissoc id) (drop-empty :projections))
                        :else (if-let [pr (sane-projection pr)]
                                (-> p (ensure-layer (:layer pr)) (update :projections (fnil assoc (sorted-map)) id pr))
                                p)))
    ;; event addressed to the data of a box, interpreted by its component:
    ;; [:in :b2 [:stroke :t1 [[0 440] [1 440]]]] · [:in :b7 [:source "process = …;"]]
    :in         (let [[id ev] args dd (comp/model-of (get-in p [:boxes id]))]
                  (if (and dd (vector? ev))
                    (let [d0 (get-in p [:boxes id :data])
                          d1 ((:step dd) (or d0 (:empty dd)) ev)]
                      (cond-> (assoc-in p [:boxes id :data] d1)
                        ;; the buffer changed after it was kept: its recipe no longer made it
                        (and (get-in p [:boxes id :recipe]) (not= d0 d1)) (assoc-in [:boxes id :recipe :stale] true)))
                    p))
    ;; [:kept :b5 data recipe]: a buffer written from a tree, with the recipe that made it, as one event
    :kept       (let [[id data r] args b (get-in p [:boxes id]) dd (comp/model-of b) r (sane-recipe r)]
                  (if (and dd (map? data) r)
                    (-> p (assoc-in [:boxes id :data] ((:load dd) data))
                        (assoc-in [:boxes id :recipe] (dissoc r :stale)))
                    p))
    ;; [:recipe :b5 r] sets the recipe of a box (as the code of a work writes it); nil removes it
    :recipe     (let [[id r] args]
                  (cond (not (get-in p [:boxes id])) p
                        (sane-recipe r) (assoc-in p [:boxes id :recipe] (sane-recipe r))
                        :else (update-in p [:boxes id] dissoc :recipe)))
    ;; [:data :b5 d]: the whole data of a box (a release, points forgotten: issue #45), nil to empty it
    :data       (let [[id d] args b (get-in p [:boxes id]) dd (comp/model-of b)]
                  (cond (not b) p
                        (and dd (map? d)) (assoc-in p [:boxes id :data] ((:load dd) d))
                        ;; a class not defined yet (a package still loading): its data as it was written
                        (map? d) (assoc-in p [:boxes id :data] d)
                        (nil? d) (update-in p [:boxes id] dissoc :data)
                        :else p))
    ;; [:batch [ev …]]: several changes as one event of the history (a preset recalled: issue #35)
    :batch      (let [[evs] args] (if (sequential? evs) (reduce step p (filter vector? evs)) p))
    :load       (sane-patch (first args))
    :clear      empty-patch
    p))

;; ───────────────────────── EDN ⇄ JSON encoding ─────────────────────────
;; db stores JSON; keywords and maps are tagged so they come back as EDN without evaluating anything.

(defn enc [x]
  (cond (keyword? x) {"k" (name x)}
        (map? x) {"m" (mapv (fn [[k v]] [(enc k) (enc v)]) x)}
        ;; a set (the views a layer is shown in) travels as a list: whoever reads it makes it a set again
        (or (sequential? x) (set? x)) (mapv enc x)
        :else x))

(defn dec* [x]
  (cond (map? x) (cond (contains? x "k") (keyword (str (get x "k")))
                       (contains? x "m") (into {} (for [kv (get x "m") :when (and (sequential? kv) (= 2 (count kv)))]
                                                    [(dec* (first kv)) (dec* (second kv))]))
                       :else nil)
        (sequential? x) (mapv dec* x)
        :else x))

;; ───────────────────────── history: a tree of segments ─────────────────────────
;; node = segment of consecutive events by one person: {:id :parent :at :author :t :events}
;; position = [node-id n] = after the first n events of that node.

(def max-events 64)

(defonce hist (atom {:nodes {} :loaded false :mode :connecting :writable false}))
(defonce world (atom {:pos nil :auto true :prev-pos nil :jumped-at 0}))
(defonce me (atom {:id nil}))
(defonce peers (atom []))
(defonce profiles (atom {}))
(defonce scratch (atom nil))
(defonce cache (atom {}))
(defonce dbref (atom nil))
(defonce roomref (atom nil))
(defonce userref (atom nil))
(defonce settings (atom {:simul-ms 1500}))

;; a session = a tab; it survives reloads of that tab
(def session-id
  (or (try (.getItem js/sessionStorage "kairotic-session") (catch :default _ nil))
      (let [s (str "s" (.toString (js/Math.floor (* (js/Math.random) 2176782336)) 36))]
        (try (.setItem js/sessionStorage "kairotic-session" s) (catch :default _ nil))
        s)))

(defn my-author [] (or (:id @me) "local"))
(defn node [nid] (get-in @hist [:nodes nid]))
(defn node-session [n] (or (:session n) (:author n)))

(defn norm
  "A position at the start of a child node is the same as its branching point."
  [pos]
  (loop [[nid idx :as pos] pos guard 0]
    (let [n (node nid)]
      (cond (or (nil? pos) (nil? n) (> guard 512)) pos
            (and (zero? idx) (:parent n) (node (:parent n))) (recur [(:parent n) (:at n)] (inc guard))
            :else [nid (max 0 (min idx (count (:events n))))]))))

(defn patch-at
  ([pos] (patch-at pos 0))
  ([pos depth]
   (if (or (nil? pos) (> depth 512))
     empty-patch
     (or (get @cache pos)
         (let [[nid idx] pos n (node nid)]
           (if (nil? n)
             empty-patch
             (let [base (if (and (:parent n) (node (:parent n))) (patch-at [(:parent n) (:at n)] (inc depth)) empty-patch)
                   p (reduce step base (take idx (:events n)))]
               (swap! cache assoc pos p)
               p)))))))

;; ───── where the commands act: the work, or a sub-patch inside it ─────
;; view-path is the sub-patch on screen ([] = the work, [:b5] = inside :b5 …); (inside :b5 …) adds to it
;; while its body runs. Commands read (current) and their events are wrapped as [:in :b5 event].

;; ───── Perform (issue #5): a time of its own to rehearse, try and improvise with the work ─────
;; In Perform the changes do not go to the history: they make a take that starts from a point of it
;; (:origin), and the patch on screen (and in the engine) is that take. Leaving it (compose) keeps the
;; take as a new point or discards it. In a shared room, the takes of those who perform from the same
;; point are one jam: everyone's changes, in time order. 13-perform.cljs has the rest.
;; {:from pos  :origin pos  :base patch  :patch patch  :own [{:t :s :ev}]  :others {session [{:t :s :ev}]}
;;  :redo [entry]  :cut t  :jam id-or-nil}

(declare jam-push!)

(defonce perf (atom nil))

(defn perf-events
  "The changes of the take after its last snapshot (:cut), from everyone in the jam, in time order."
  [{:keys [own others cut]}]
  (sort-by (juxt :t :s) (filter (fn [e] (> (:t e) (or cut 0))) (concat own (apply concat (vals others))))))

(defn perf-recompute [st] (assoc st :patch (reduce step (:base st) (map :ev (perf-events st)))))

(defn perform-event!
  "A change made in Perform: it goes to the take (and to the jam), not to the history."
  [ev]
  (swap! perf (fn [st] (-> st (update :own conj {:t (js/Date.now) :s session-id :ev ev}) (assoc :redo []) (update :patch step ev))))
  (jam-push!))

(defn work-patch [] (or (:patch @perf) (patch-at (:pos @world))))

(declare played!)

(defn inject-local!
  "A message played here (a gesture, the REPL) into box f of the engine. In a jam it is also played to the
   others (issue #11): messages are not events of the take, so they travel apart (13-perform.cljs)."
  [f inlet v]
  (eng/inject! (fn [] (work-patch)) f inlet v)
  (played! f inlet v))
(defn root-patch [] (or @scratch (work-patch)))

(defonce view-path (atom []))
(def ^:dynamic *inside* [])

(defn cmd-path [] (if @scratch *inside* (into @view-path *inside*)))

(defn embedded? [b] (and b (= "patch" (klass (:text b)))))

;; a component box defines a class: it has no inlets nor outlets, so it is not drawn in the patch but kept
;; in the Components tab (issue #8). It is still a box of the work: its history, its code and links.
(defn definition? [b] (and b (= "component" (klass (:text b)))))

(defn without-definitions [boxes] (into (or (empty boxes) (sorted-map)) (remove (fn [[_ b]] (definition? b)) boxes)))

(defn valid-prefix
  "The longest part of `path` that still leads through embedded patches of p."
  [p path]
  (loop [q p acc [] ids (seq path)]
    (if-let [id (first ids)]
      (let [b (get-in q [:boxes id])]
        (if (embedded? b) (recur (or (:data b) empty-patch) (conj acc id) (next ids)) acc))
      acc)))

(defn patch-in [p path]
  (reduce (fn [q id] (or (get-in q [:boxes id :data]) empty-patch)) p (valid-prefix p path)))

(defn current []
  (let [r (root-patch)]
    (when-not @scratch
      (let [ok (valid-prefix r @view-path)]
        (when (< (count ok) (count @view-path)) (reset! view-path ok))))
    (patch-in r (cmd-path))))

(defn wrap-in [path ev] (reduce (fn [e id] [:in id e]) ev (reverse path)))

(defn fid
  "The id the engine knows a box of the current view by."
  [id] (eng/flat-id (cmd-path) id))

(defn target
  "Where a message to inlet i of box id goes in the engine: a sub-patch receives it in its i-th inlet box."
  [id inlet]
  (let [b (get-in (current) [:boxes id])]
    (if (and b (comp/subpatch? b))
      (let [inner (eng/inner-patch b) x (get (:inlets (comp/patch-ports inner)) inlet)]
        (if x [(eng/flat-id (conj (cmd-path) id) x) 0] (throw (js/Error. (str id " has no inlet " inlet)))))
      [(fid id) inlet])))

(defn local-id
  "From an engine id back to an id of the current view (nil if it lives elsewhere)."
  [fid*]
  (let [path (cmd-path) n (name fid*)]
    (if (empty? path)
      (when-not (str/includes? n ".") fid*)
      (let [pre (str (str/join "." (map name path)) ".") rest-n (subs n (min (count n) (count pre)))]
        (when (and (str/starts-with? n pre) (not (str/includes? rest-n "."))) (keyword rest-n))))))

(defn start-of
  "Depth (number of events from the root) at which a node starts."
  ([nid] (start-of nid 0))
  ([nid depth]
   (let [n (node nid)]
     (if (and n (:parent n) (node (:parent n)) (< depth 512))
       (+ (start-of (:parent n) (inc depth)) (:at n))
       0))))

(defn depth-of [[nid idx]] (+ (start-of nid) idx))

(defn tip-of [nid] [nid (count (:events (node nid)))])

(defn newest-tip []
  (let [ns (vals (:nodes @hist))]
    (when (seq ns) (tip-of (:id (apply max-key (fn [n] (or (:t n) 0)) ns))))))

;; ───────────────────────── storage ─────────────────────────

(defonce queues (atom {}))

(defonce recent-errors (atom []))   ; the last errors the REPL showed (for the Feedback tab)

(defn repl-print! [cls html]
  (when (= cls "err")
    (let [d (js/document.createElement "div")]
      (set! (.-innerHTML d) html)
      (swap! recent-errors (fn [es] (vec (take-last 10 (conj es (.-textContent d))))))))
  (let [out (js/document.getElementById "repl-out") d (js/document.createElement "div")]
    (set! (.-className d) cls)
    (set! (.-innerHTML d) html)
    (.appendChild out d)
    (set! (.-scrollTop out) (.-scrollHeight out))))

(defn esc [s] (-> (str s) (str/replace "&" "&amp;") (str/replace "<" "&lt;") (str/replace ">" "&gt;") (str/replace "\"" "&quot;")))

(defn db-failed! [e]
  (let [code (or (.-code e) "error")]
    (when (#{"invalid_argument" "revoked" "not_granted"} code)
      (swap! hist assoc :writable false :mode :readonly))
    (repl-print! "err" (esc (str "Could not save to the shared history (" code "). Your gestures stay in this tab.")))))

(defn enqueue! [k f]
  (let [prev (get @queues k (js/Promise.resolve nil))
        p (-> prev (.then (fn [_] (f))) (.catch db-failed!))]
    (swap! queues assoc k p)))

(defn node->js [n]
  (clj->js {:parent (:parent n) :at (:at n) :author (:author n) :session (:session n) :t (:t n)
            :merge (:merge n) :events (mapv enc (:events n))}))

;; ───────────────────────── works: shared rooms and solo work ─────────────────────────
;; room:  rooms/<id>                      (metadata)  ·  rooms/<id>/history/<segment>
;; solo:  data/users/<uid>/<id>          (private)   ·  data/users/<uid>/<id>/history/<segment>

(defonce work (atom {:kind nil :id nil :name nil}))

(defn uid [] (:id @me))

(defn base-of [kind id]
  (case kind
    :room (str "rooms/" id)
    :solo (when (uid) (str "data/users/" (uid) "/" id))
    nil))

(defn work-base [] (base-of (:kind @work) (:id @work)))
(defn hist-path [] (when-let [b (work-base)] (str b "/history")))

(defn persist? []
  (and @dbref (:writable @hist) (#{:room :solo} (:kind @work)) (hist-path)))

(defn new-id []
  (if (persist?)
    (.-id (.doc (.collection @dbref (hist-path))))
    (str "local-" (.toString (js/Math.floor (* (js/Math.random) 2176782336)) 36) (.toString (js/Date.now) 36))))

(defn new-node! [parent at evs merge]
  (let [id (new-id)
        n {:id id :parent parent :at at :author (my-author) :session session-id :t (js/Date.now)
           :merge merge :events (vec evs)}]
    (swap! hist assoc-in [:nodes id] n)
    (when (and (persist?) (not (str/starts-with? id "local-")))
      (let [path (str (hist-path) "/" id) body (node->js n)]
        (enqueue! path (fn [] (.set (.doc @dbref path) body)))))
    id))

(defn append-event! [nid ev]
  (swap! hist update-in [:nodes nid] (fn [n] (-> n (update :events conj ev) (assoc :t (js/Date.now)))))
  (when (and (persist?) (not (str/starts-with? nid "local-")))
    (let [n (node nid)
          path (str (hist-path) "/" nid)
          body (clj->js {:events (mapv enc (:events n)) :t (:t n)})]
      (enqueue! path (fn [] (.update (.doc @dbref path) body))))))

(defn own-open-tip? [[nid idx]]
  (let [n (node nid)]
    (and n (= (node-session n) session-id) (= idx (count (:events n))) (< idx max-events))))

(defn commit!
  "Adds an event where you are. If you have just moved forward over someone else's event less than the
   simultaneity interval ago, your event is considered parallel and starts from where you were (a branch)."
  [ev]
  (let [{:keys [pos prev-pos jumped-at]} @world
        parallel? (and prev-pos (< (- (js/Date.now) jumped-at) (:simul-ms @settings)))
        base (if parallel? prev-pos pos)]
    (if (and base (own-open-tip? base))
      (do (append-event! (first base) ev)
          (swap! world assoc :pos [(first base) (inc (second base))] :auto true :prev-pos nil))
      (let [id (new-node! (first base) (if base (second base) 0) [ev] nil)]
        (swap! world assoc :pos [id 1] :auto true :prev-pos nil)))))

;; ───────────────────────── paths, front and merge ─────────────────────────

(defn segments
  "Path from the root to a position, as [[segment n] ...]."
  [pos]
  (loop [[nid idx :as p] pos acc () guard 0]
    (let [n (node nid)]
      (if (and n (:parent n) (node (:parent n)) (< guard 512))
        (recur [(:parent n) (:at n)] (cons p acc) (inc guard))
        (vec (cons p acc))))))

(defn reaches?
  "Is `tip` reached by moving forward from `pos`?"
  [pos tip]
  (let [[pn pi] pos]
    (boolean (some (fn [[sn si]] (and (= sn pn) (>= si pi))) (segments tip)))))

(defn front-from
  "The newest tip reached by moving forward from pos."
  [pos]
  (let [cands (filter (fn [t] (reaches? pos t)) (map (fn [n] (tip-of (:id n))) (vals (:nodes @hist))))]
    (when (seq cands) (apply max-key (fn [[nid _]] (or (:t (node nid)) 0)) cands))))

(defn seg-events [[nid n] from]
  (let [evs (vec (take n (:events (node nid))))]
    (subvec evs (min from (count evs)))))

(defn diverge
  "Common point of two paths and the events each one adds from there."
  [ts ss]
  (loop [i 0]
    (let [t (nth ts i nil) s (nth ss i nil)]
      (when (and t s (= (first t) (first s)))
        (let [nt (nth ts (inc i) nil) nx (nth ss (inc i) nil)]
          (if (and (= (second t) (second s)) nt nx (= (first nt) (first nx)))
            (recur (inc i))
            (let [k (min (second t) (second s))
                  extra (fn [segs] (vec (concat (seg-events (nth segs i) k) (mapcat (fn [g] (seg-events g 0)) (drop (inc i) segs)))))]
              {:base [(first t) k] :t-extra (extra ts) :s-extra (extra ss)})))))))

(defn unbatch
  "The events of a history with the changes of every [:batch …] in its place."
  [evs]
  (mapcat (fn [e] (if (and (vector? e) (= :batch (first e)) (sequential? (second e))) (unbatch (second e)) [e])) evs))

(defn summarize [evs]
  (reduce (fn [acc [op & args]]
            (case op
              (:box :text :move :size) (update acc :mod conj (first args))
              ;; each mark, layer and projection is its own unit; a mark refers to the boxes it is anchored to
              :annot (-> acc (update :mod conj [:annot (first args)])
                        (update :ref into (let [m (second args)] (filter (fn [a] (and (keyword? a) (not= a :patch)))
                                                                         (map first (concat (:pts m) (when (:at m) [(:at m)])))))))
              :layer (update acc :mod conj [:layer (first args)])
              :project (-> acc (update :mod conj [:project (first args)]) (update :ref conj (first args)))
              :delete (-> acc (update :mod conj (first args)) (update :del conj (first args)))
              (:connect :disconnect) (update acc :ref into [(first args) (nth args 2 nil)])
              :load (assoc acc :load true)
              ;; a kept buffer rewrites the whole box data; a recipe alone is its own unit
              :data (-> acc (update :mod conj (first args)) (update :ref conj (first args)) (update :whole conj (first args)))
              :kept (-> acc (update :mod conj (first args)) (update :ref conj (first args)) (update :whole conj (first args)))
              :recipe (-> acc (update :mod conj [(first args) :recipe]) (update :ref conj (first args)))
              ;; in a canvas, each stroke is its own unit of change, and so is each grid;
              ;; clear or load affects the whole canvas
              :in (let [[id [iop eid]] args]
                    (case iop
                      (:stroke :move :stretch :erase) (-> acc (update :mod conj [id eid]) (update :ref conj id))
                      :grid-x (-> acc (update :mod conj [id :grid-x]) (update :ref conj id))
                      :tuning (-> acc (update :mod conj [id :tuning]) (update :ref conj id))
                      :quantize (-> acc (update :mod conj [id :quant]) (update :ref conj id))
                      ;; in a tree, each edited node is its own unit; inserting or removing changes its container
                      ;; units: [box path kind] — :node (replaced), :kids (children added or removed, so their
                      ;; indices move), :attrs (only its attributes)
                      :edit (-> acc
                                (update :tree into (for [[op p] eid :let [p (vec p)]]
                                                     (case op
                                                       :attrs [id p :attrs]
                                                       (:insert :remove) [id (if (seq p) (pop p) p) :kids]
                                                       [id p :node])))
                                (update :ref conj id))
                      (-> acc (update :mod conj id) (update :ref conj id) (update :whole conj id))))
              acc))
          {:mod #{} :ref #{} :del #{} :whole #{} :tree #{} :load false} (unbatch evs)))

(defn remap-ev [m [op & args :as e]]
  (let [f (fn [x] (get m x x))]
    (case op
      (:box :text :move :size :delete :kept :recipe :data :project) (into [op (f (first args))] (rest args))
      :annot (let [[id m] args fa (fn [[a x y]] [(f a) x y])]
              [op id (cond-> m (:pts m) (update :pts (fn [ps] (mapv fa ps))) (:at m) (update :at fa))])
      :in (let [[id inner] args]
            [op (f id) (if-let [ne (get-in m [:stroke-ids [id (second inner)]])] (assoc inner 1 ne) inner)])
      (:connect :disconnect) (let [[a o b i] args] [op (f a) o (f b) i])
      :batch [op (mapv (fn [x] (remap-ev m x)) (first args))]
      e)))

(defn free-box-id [used]
  (loop [k 1] (let [id (keyword (str "b" k))] (if (used id) (recur (inc k)) id))))

(defn tree-units-clash?
  "Whether two edits of one tree touch the same thing: a replaced node and anything inside it, children
   added or removed and anything below them (their indices move), or the attributes of the same node."
  [[p kp] [q kq]]
  (let [prefix? (fn [a b] (and (<= (count a) (count b)) (= a (subvec b 0 (count a)))))
        proper? (fn [a b] (and (< (count a) (count b)) (prefix? a b)))
        one-way (fn [[a ka] [b kb]]
                  (case ka
                    :node (prefix? a b)
                    :kids (or (proper? a b) (and (= a b) (= kb :kids)))
                    :attrs (and (= a b) (= kb :attrs))))]
    (or (one-way [p kp] [q kq]) (one-way [q kq] [p kp]))))

(defn tree-clash
  "Edits of the same tree that touch the same thing in both branches: [[box path] …]."
  [S T]
  (concat
   (for [[i p kp] (:tree S) [j q kq] (:tree T) :when (and (= i j) (tree-units-clash? [p kp] [q kq]))]
     [i (if (<= (count p) (count q)) p q)])
   (for [[i] (:tree S) :when (contains? (:whole T) i)] [i []])
   (for [[i] (:tree T) :when (contains? (:whole S) i)] [i []])))

(defn plan-merge
  "Which events of branch `src` must be brought to `tgt`, or why it cannot be done."
  [tgt src]
  (let [ts (segments tgt) ss (segments src)
        ;; what was already brought by earlier merges is not brought again
        merged (keep (fn [g] (:merge (node (first g)))) ts)
        done (last (filter (fn [m] (and (vector? m) (node (first m)) (reaches? m src))) merged))
        d (diverge ts ss)
        s-extra (if done (or (:s-extra (diverge (segments done) ss)) []) (:s-extra d))]
    (cond
      (nil? d) {:error "Those two positions do not share an origin."}
      (empty? s-extra) {:error "That branch has nothing new to bring here: it is already included."}
      :else
      (let [base (patch-at (:base d))
            base-ids (set (keys (:boxes base)))
            in-base? (fn [x] (if (vector? x)
                               (or (#{:grid-x :tuning :quant} (second x)) (get-in base [:boxes (first x) :data :strokes (second x)]))
                               (base-ids x)))
            S (summarize s-extra) T (summarize (:t-extra d))
            note-boxes (fn [X] (set (keep (fn [x] (when (vector? x) (first x))) (:mod X))))
            clash (filter in-base? (concat (clojure.set/intersection (:mod S) (:mod T))
                                           (clojure.set/intersection (:ref S) (:del T))
                                           (clojure.set/intersection (:ref T) (:del S))
                                           (clojure.set/intersection (:whole S) (note-boxes T))
                                           (clojure.set/intersection (:whole T) (note-boxes S))))
            clash-name (fn [x] (cond (not (vector? x)) (str x)
                                     (#{:grid-x :tuning :quant} (second x)) (str "the " (name (second x)) " of " (first x))
                                     :else (str "stroke " (second x) " of " (first x))))]
        (cond
          (or (and (:load S) (seq (:t-extra d))) (and (:load T) (seq s-extra)))
          {:error "They are not compatible: one of the branches rebuilds the whole work (:load)."}
          (seq (concat clash (tree-clash S T)))
          {:error (str "They are not compatible: both branches change "
                       (str/join ", " (concat (map clash-name (distinct clash))
                                              (map (fn [[id p]] (str "the tree of " id (when (seq p) (str " at " (pr-str p)))))
                                                   (distinct (tree-clash S T)))))
                       ".")}
          :else
          (let [target (patch-at tgt)
                created (distinct (keep (fn [[op id]] (when (and (= op :box) (not (base-ids id))) id)) s-extra))
                m (loop [[c & more] created used (into (set (keys (:boxes target))) created) m {}]
                    (cond (nil? c) m
                          (contains? (:boxes target) c) (let [nid (free-box-id used)] (recur more (conj used nid) (assoc m c nid)))
                          :else (recur more used m)))
                ;; new strokes in both branches with the same id: the incoming ones are renamed
                tbox (fn [id] (get-in target [:boxes (get m id id) :data :strokes]))
                created-notes (distinct (keep (fn [[op id inner]]
                                                (when (and (= op :in) (vector? inner) (= :stroke (first inner))
                                                           (not (get-in base [:boxes id :data :strokes (second inner)])))
                                                  [id (second inner)]))
                                              s-extra))
                nm (loop [[[id eid :as c] & more] created-notes used {} nm {}]
                     (cond (nil? c) nm
                           (contains? (tbox id) eid)
                           (let [taken (into (set (keys (tbox id))) (get used id))
                                 ne (loop [k 1] (let [x (keyword (str "t" k))] (if (taken x) (recur (inc k)) x)))]
                             (recur more (update used id (fnil conj #{}) ne eid) (assoc nm c ne)))
                           :else (recur more (update used id (fnil conj #{}) eid) nm)))]
            {:events (vec (cons [:merge-from (first src) (second src)] (map (fn [e] (remap-ev (assoc m :stroke-ids nm) e)) s-extra)))
             :renamed (merge m (into {} (for [[[id eid] ne] nm] [(keyword (str (name id) "." (name eid))) ne])))}))))))
