;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · Study 33 · lines (discussion #117)
;;
;; A work becomes a project: several independent history lines, each with a name, each a whole history
;; tree of its own (root, branches, front), shown as tabs above the patcher. A `patch @name` box in any line
;; refers to another line and takes its inlet/outlet boxes as ports, like an embedded `patch` box today:
;;
;;   patch          an embedded patch: its inside lives in the box (:data), its edits in the history
;;   patch filters  of the line it is in, wrapped as [:in :b3 event] (as in the app, where a word after
;;                  `patch` is only a label: it stays so, so no work changes meaning)
;;   patch @gain     the line `gain`, followed: it is the line at its front (its newest point), so it
;;                  changes as that line advances, like an abstraction of Max or Pd
;;   patch @gain     with :pin [node n], the line frozen at that point (a version)
;;
;; Nesting is allowed and cycles are refused. An embedded patch can be extracted to a line of its own
;; (with the history it had inside its box), and a reference inlined back into the box. A release takes
;; the main line and every line it reaches, each at the point it uses, into a new project where every
;; reference is pinned.
;;
;; Decided in #117: references are written `patch @name` (a plain word stays a label), and a line is the
;; working form of a reusable sub-patch while an abstraction or component is its published form, a line
;; pinned at a point (extract to line takes the place of `abstract` as the gesture).
;;
;; Pure data and functions: no DOM, no atoms (the page keeps the project in one).
;;
;;   project {:title "…" :main :main :order [:main :gain …] :clock 7
;;            :lines {:gain {:id :gain :aliases #{:old-name} :note "…" :archived false :from [:main pos]
;;                           :nodes {"n3" {:id "n3" :parent nil :at 0 :t 5 :events [ev …]}}
;;                           :pos ["n3" 2]}}}
;;   position [node-id n] = after the first n events of that node (as in the app)

(ns kairotic.lines
  (:require [clojure.string :as str]
            [clojure.edn :as edn]))

(def empty-patch {:boxes (sorted-map) :lines []})

(defn fail [msg] (throw (ex-info msg {:kairotic/lines true})))

;; ───────────────────────── boxes ─────────────────────────

(defn words [text] (vec (remove str/blank? (str/split (str/trim (str text)) #"\s+"))))
(defn klass [b] (first (words (:text b))))
(defn ref-name
  "The line a `patch @name` box refers to (as a keyword), or nil."
  [b] (let [w (words (:text b)) r (second w)]
        (when (and (= "patch" (first w)) r (str/starts-with? r "@") (> (count r) 1)) (keyword (subs r 1)))))
(defn sub? [b] (= "patch" (klass b)))
(defn embedded? [b] (and (sub? b) (nil? (ref-name b))))
(defn ref? [b] (some? (ref-name b)))

(def name-re #"^[a-z][a-z0-9-]{0,31}$")
(defn valid-name? [s] (boolean (and (string? s) (re-matches name-re s))))

;; ───────────────────────── a patch, event by event ─────────────────────────
;; The events of the app that matter here, and two of this study: [:pin id pos] (nil follows again).

(defn step [p [op & args]]
  (let [p (or p empty-patch)]
    (case op
      :box        (let [[id text x y] args] (if (keyword? id) (assoc-in p [:boxes id] {:text (str text) :x (or x 0) :y (or y 0)}) p))
      :text       (let [[id text] args] (if (get-in p [:boxes id]) (assoc-in p [:boxes id :text] (str text)) p))
      :move       (let [[id x y] args] (if (get-in p [:boxes id]) (update-in p [:boxes id] assoc :x x :y y) p))
      :connect    (let [l (vec args)] (if (some #{l} (:lines p)) p (update p :lines conj l)))
      :disconnect (let [l (vec args)] (update p :lines (fn [ls] (vec (remove #{l} ls)))))
      :delete     (let [[id] args]
                    (-> p (update :boxes dissoc id)
                        (update :lines (fn [ls] (vec (remove (fn [[a _ b _]] (or (= a id) (= b id))) ls))))))
      :in         (let [[id e] args b (get-in p [:boxes id])]
                    (if (and b (embedded? b) (vector? e)) (assoc-in p [:boxes id :data] (step (or (:data b) empty-patch) e)) p))
      :data       (let [[id d] args]
                    (cond (not (get-in p [:boxes id])) p
                          (map? d) (assoc-in p [:boxes id :data] d)
                          :else (update-in p [:boxes id] dissoc :data)))
      :pin        (let [[id pos] args]
                    (cond (not (get-in p [:boxes id])) p
                          (and (vector? pos) (= 2 (count pos))) (assoc-in p [:boxes id :pin] (vec pos))
                          :else (update-in p [:boxes id] dissoc :pin)))
      :batch      (let [[evs] args] (reduce step p (filter vector? evs)))
      :load       (let [[q] args] (if (map? q) {:boxes (into (sorted-map) (:boxes q)) :lines (vec (:lines q))} p))
      :clear      empty-patch
      p)))

(defn wrap-in
  "An event for the patch at `path` (ids of embedded boxes from the line's top), as the top receives it."
  [path ev] (reduce (fn [e id] [:in id e]) ev (reverse path)))

(defn patch-in [p path] (reduce (fn [q id] (or (get-in q [:boxes id :data]) empty-patch)) p path))

;; ───────────────────────── a line: a history tree ─────────────────────────

(defn node [l nid] (get-in l [:nodes nid]))

(defn norm
  "A position at the start of a child node is the same as its branching point."
  [l pos]
  (loop [[nid idx :as pos] pos guard 0]
    (let [n (node l nid)]
      (cond (or (nil? pos) (nil? n) (> guard 4096)) pos
            (and (zero? idx) (:parent n) (node l (:parent n))) (recur [(:parent n) (:at n)] (inc guard))
            :else [nid (max 0 (min idx (count (:events n))))]))))

(defn events-to
  "Every event from the root to pos, in order."
  [l pos]
  (loop [[nid idx] pos acc () guard 0]
    (let [n (node l nid)]
      (if (or (nil? n) (> guard 4096))
        (vec (apply concat acc))
        (let [acc (cons (take idx (:events n)) acc)]
          (if (and (:parent n) (node l (:parent n)))
            (recur [(:parent n) (:at n)] acc (inc guard))
            (vec (apply concat acc))))))))

(defn patch-at [l pos] (reduce step empty-patch (events-to l pos)))

(defn depth-of [l pos] (count (events-to l pos)))

(defn tip-of [l nid] [nid (count (:events (node l nid)))])

(defn front
  "The line's newest point: the tip of the node touched last (nil while it has no events)."
  [l]
  (when-let [ns (seq (vals (:nodes l)))]
    (tip-of l (:id (reduce (fn [a n] (if (pos? (compare [(or (:t n) 0) (:id n)] [(or (:t a) 0) (:id a)])) n a)) ns)))))

(defn children [l nid at] (filter (fn [n] (and (= nid (:parent n)) (= at (:at n)))) (vals (:nodes l))))

(defn line-patch "The patch of a line where its tab stands." [l] (patch-at l (:pos l)))

;; ───────────────────────── the project ─────────────────────────

(defn line
  "The line called lid (or that was called so: renaming keeps the old name as an alias)."
  [proj lid]
  (or (get-in proj [:lines lid])
      (some (fn [[_ l]] (when (contains? (:aliases l) lid) l)) (:lines proj))))

(defn line-id [proj lid] (:id (line proj lid)))

(defn taken? [proj lid] (some? (line proj lid)))

(defn new-line [lid & {:keys [note from]}]
  (cond-> {:id lid :aliases #{} :nodes {} :pos nil :archived false}
    note (assoc :note note)
    from (assoc :from from)))

(defn new-project
  ([title] (new-project title "main"))
  ([title main & {:keys [note]}]
   (let [k (keyword main)] {:title title :main k :order [k] :clock 0 :lines {k (new-line k :note note)}})))

(defn tick [proj] (update proj :clock inc))

(defn append
  "Event ev added to line lid where its tab stands: at the tip of a node it continues it; anywhere else
   (the tab went back) it starts a branch there."
  [proj lid ev]
  (let [lid (or (line-id proj lid) (fail (str "There is no line " (name lid) ".")))
        proj (tick proj)
        t (:clock proj)
        l (get-in proj [:lines lid])
        [nid idx] (norm l (:pos l))
        n (node l nid)
        l (if (and n (= idx (count (:events n))))
            (-> l (update-in [:nodes nid] (fn [n] (-> n (update :events conj ev) (assoc :t t))))
                (assoc :pos [nid (inc idx)]))
            (let [id (str "n" t)]
              (-> l (assoc-in [:nodes id] {:id id :parent (when n nid) :at (if n idx 0) :t t :events [ev]})
                  (assoc :pos [id 1]))))]
    (assoc-in proj [:lines lid] l)))

(defn append-all [proj lid evs] (reduce (fn [p e] (append p lid e)) proj evs))

(defn goto [proj lid pos] (assoc-in proj [:lines (line-id proj lid) :pos] (norm (line proj lid) pos)))

(defn back [proj lid]
  (let [l (line proj lid) [nid idx :as pos] (norm l (:pos l))]
    (if (and pos (pos? idx)) (goto proj lid [nid (dec idx)]) proj)))

(defn forward [proj lid]
  (let [l (line proj lid) [nid idx :as pos] (norm l (:pos l)) n (node l nid)]
    (cond (nil? pos) (if-let [r (first (sort-by :t (filter (fn [n] (nil? (:parent n))) (vals (:nodes l)))))] (goto proj lid [(:id r) 1]) proj)
          (< idx (count (:events n))) (goto proj lid [nid (inc idx)])
          :else (if-let [c (last (sort-by :t (children l nid idx)))] (assoc-in proj [:lines (:id l) :pos] [(:id c) 1]) proj))))

(defn to-front [proj lid] (goto proj lid (front (line proj lid))))

;; ───────────────────────── references ─────────────────────────

(defn ref-pos
  "Where box b (a `patch @name`) reads its line: its pin, or the line's front."
  [proj b] (when-let [l (line proj (ref-name b))] (if (:pin b) (norm l (:pin b)) (front l))))

(defn resolve-ref
  "{:line lid :pos pos :patch p :pinned bool}, or {:error …}."
  [proj b]
  (let [r (ref-name b) l (line proj r)]
    (cond (nil? l) {:error (str "no line " (name r))}
          (and (:pin b) (nil? (node l (first (:pin b))))) {:error (str "the pinned point is not in " (name (:id l)))}
          :else (let [pos (ref-pos proj b)]
                  {:line (:id l) :pos pos :patch (if pos (patch-at l pos) empty-patch) :pinned (some? (:pin b))}))))

(defn inner
  "The patch inside a sub-patch box: its data, or the line it refers to."
  [proj b]
  (cond (embedded? b) (or (:data b) empty-patch)
        (ref? b) (:patch (resolve-ref proj b))
        :else nil))

(defn refs-in
  "The `patch @name` boxes of a patch, through its embedded patches: [[path id box] …]."
  ([p] (refs-in p []))
  ([p path]
   (mapcat (fn [[id b]]
             (cond (ref? b) [[path id b]]
                   (embedded? b) (refs-in (or (:data b) empty-patch) (conj path id))
                   :else []))
           (:boxes p))))

(defn uses
  "The lines a patch uses directly: {lid #{pos …}}."
  [proj p]
  (reduce (fn [m [_ _ b]] (let [r (resolve-ref proj b)] (if (:line r) (update m (:line r) (fnil conj #{}) (:pos r)) m)))
          {} (refs-in p)))

(defn reaches
  "Every line reached from patch p, through references at the points they read."
  [proj p]
  (loop [todo [p] seen #{} guard 0]
    (if (or (empty? todo) (> guard 256))
      seen
      (let [found (for [[lid poss] (uses proj (peek todo)) pos poss] [lid pos])
            new (remove (fn [[lid _]] (seen lid)) found)]
        (recur (into (pop todo) (map (fn [[lid pos]] (patch-at (line proj lid) pos)) new))
               (into seen (map first found)) (inc guard))))))

(defn cycle-error
  "Why box text `text` cannot go in line lid (it would reach itself), or nil."
  [proj lid text]
  (let [r (ref-name {:text text}) here (line-id proj lid)]
    (when r
      (let [l (line proj r)]
        (cond (nil? l) (str "There is no line " (name r) " (make it first, as a tab).")
              (= (:id l) here) (str "A line cannot contain itself: " (name here) ".")
              (contains? (reaches proj (patch-at l (front l))) here)
              (str (name (:id l)) " already uses " (name here) ": that would be a cycle.")
              :else nil)))))

(defn used-by
  "Which lines use line lid where their tabs stand: [{:line … :path … :box … :pinned …}]."
  [proj lid]
  (let [lid (line-id proj lid)]
    (for [[k l] (:lines proj) :when (not (:archived l))
          [path id b] (refs-in (line-patch l))
          :when (= lid (line-id proj (ref-name b)))]
      {:line k :path path :box id :pinned (some? (:pin b))})))

;; ───────────────────────── ports ─────────────────────────

(defn patch-ports [p]
  (let [of (fn [k] (->> (:boxes p) (filter (fn [[_ b]] (= k (klass b))))
                        (sort-by (fn [[id b]] [(or (:x b) 0) (or (:y b) 0) (name id)])) (mapv first)))]
    {:inlets (of "inlet") :outlets (of "outlet")}))

(def fixed-io {"inlet" [0 1] "outlet" [1 0] "msg" [1 1] "number" [1 1] "+" [2 1] "-" [2 1] "*" [2 1] "/" [2 1]})

(defn io
  "[inlets outlets] of box b, and for a sub-patch its inside's port boxes."
  [proj b]
  (if (sub? b)
    (let [q (inner proj b)]
      (if q (let [pp (patch-ports q)] (assoc pp :io [(count (:inlets pp)) (count (:outlets pp))])) {:io [0 0] :inlets [] :outlets []}))
    {:io (get fixed-io (klass b) [1 1])}))

;; ───────────────────────── the project's lines as tabs ─────────────────────────

(defn add-line [proj nm & {:keys [note from events]}]
  (when-not (valid-name? nm) (fail (str "A line's name: lowercase letters, digits and -, starting with a letter (" (pr-str nm) ").")))
  (let [lid (keyword nm)]
    (when (taken? proj lid) (fail (str "There is already a line " nm ".")))
    (-> proj (assoc-in [:lines lid] (new-line lid :note note :from from))
        (update :order conj lid)
        (append-all lid (or events [])))))

(defn retarget
  "Event that makes every reference to `old` in patch p (through embedded patches) say `new`."
  [p old new-name]
  (let [evs (for [[path id b] (refs-in p) :when (= old (ref-name b))]
              (wrap-in path [:text id (str/join " " (into ["patch" (str "@" new-name)] (drop 2 (words (:text b)))))]))]
    (when (seq evs) [:batch (vec evs)])))

(defn rename-line
  "Line lid is called nm from now on. The old name stays as an alias (older points still find it), and
   every line whose tab uses it gets an event that writes the new name."
  [proj lid nm]
  (when-not (valid-name? nm) (fail (str "A line's name: lowercase letters, digits and -, starting with a letter (" (pr-str nm) ").")))
  (let [old (line-id proj lid) new (keyword nm)]
    (when (and (taken? proj new) (not= new old) (not (contains? (:aliases (line proj new)) old)))
      (fail (str "There is already a line " nm ".")))
    (if (= old new)
      proj
      (let [l (-> (get-in proj [:lines old]) (assoc :id new) (update :aliases (fnil conj #{}) old) (update :aliases disj new))
            proj (-> proj (update :lines dissoc old) (assoc-in [:lines new] l)
                     (update :order (fn [o] (mapv (fn [k] (if (= k old) new k)) o)))
                     (update :main (fn [m] (if (= m old) new m))))]
        (reduce (fn [p [k l]] (if-let [ev (retarget (line-patch l) old nm)] (append p k ev) p))
                proj (:lines proj))))))

(defn archive-line [proj lid on?]
  (let [lid (line-id proj lid)]
    (when (and on? (= lid (:main proj))) (fail "The main line cannot be archived."))
    (assoc-in proj [:lines lid :archived] (boolean on?))))

(defn duplicate-line
  "A new line nm that starts as line lid is at pos (its patch, loaded as its first event)."
  [proj lid pos nm]
  (let [l (line proj lid)]
    (add-line proj nm :from [(:id l) pos] :events [[:load (patch-at l pos)]])))

;; ───────────────────────── extract and inline ─────────────────────────

(defn unwrap
  "The event as the patch at `path` receives it, if ev goes there; else nil."
  [path ev]
  (loop [path (seq path) ev ev]
    (cond (nil? path) ev
          (and (vector? ev) (= :in (first ev)) (= (first path) (second ev))) (recur (next path) (nth ev 2 nil))
          :else nil)))

(defn box-history
  "The events box id (in the patch at path) received inside, along the history up to pos: the history
   an embedded patch had inside its box."
  [l pos path id]
  (letfn [(one [acc e]
            (if-not (vector? e)
              acc
              (let [[op a b] e]
                (case op
                  :box (if (= a id) [] acc)
                  :delete (if (= a id) [] acc)
                  :data (if (= a id) (if (map? b) [[:load b]] []) acc)
                  :in (if (= a id) (conj acc b) acc)
                  :batch (reduce one acc b)
                  :load (if-let [d (get-in a [:boxes id :data])] [[:load d]] [])
                  :clear []
                  acc))))]
    (reduce (fn [acc ev] (if-let [e (unwrap path ev)] (one acc e) acc)) [] (events-to l pos))))

(defn extract
  "The embedded patch id (at path, in line lid where its tab stands) becomes line nm, with its history,
   and the box refers to it (following it)."
  [proj lid path id nm]
  (let [l (line proj lid) b (get-in (patch-in (line-patch l) path) [:boxes id])]
    (when-not (and b (embedded? b)) (fail "Only an embedded patch can be extracted to a line."))
    (let [evs (box-history l (:pos l) path id)
          evs (if (and (empty? evs) (:data b)) [[:load (:data b)]] evs)]
      (-> proj
          (add-line nm :from [(:id l) (:pos l)] :events evs)
          (append (:id l) (wrap-in path [:batch [[:text id (str "patch @" nm)] [:data id nil]]]))))))

(defn inline
  "The reference id (at path, in line lid) becomes an embedded patch again: the line's patch at the point
   it reads, copied into the box, detached from the line."
  [proj lid path id]
  (let [l (line proj lid) b (get-in (patch-in (line-patch l) path) [:boxes id]) r (when b (resolve-ref proj b))]
    (when-not (and b (ref? b) (:patch r)) (fail "Only a reference to a line can be inlined."))
    (append proj (:id l) (wrap-in path [:batch [[:text id "patch"] [:pin id nil] [:data id (:patch r)]]]))))

(defn pin [proj lid path id pos] (append proj lid (wrap-in path [:pin id pos])))

;; ───────────────────────── release ─────────────────────────

(defn release
  "A new project: the main line where its tab stands and every line it reaches, each at the point it
   uses, as one event each; every reference pinned. A line used at two points becomes two lines."
  [proj]
  (let [main (line proj (:main proj))
        start [(:id main) (:pos main)]
        ;; every version reached, in the order found
        versions (loop [todo [start] seen [] guard 0]
                   (if (or (empty? todo) (> guard 512))
                     seen
                     (let [[lid pos :as v] (first todo)]
                       (if (some #{v} seen)
                         (recur (subvec todo 1) seen (inc guard))
                         (let [p (patch-at (line proj lid) pos)
                               found (for [[lid2 poss] (sort-by (comp str key) (uses proj p)) pos2 (sort-by str poss)] [lid2 pos2])]
                           (recur (into (subvec todo 1) found) (conj seen v) (inc guard)))))))
        ids (loop [vs versions acc {} used #{}]
              (if-let [[lid _ :as v] (first vs)]
                (let [base (name lid)
                      k (if (used lid) (first (remove (fn [k] (used k)) (map (fn [i] (keyword (str base "-v" i))) (iterate inc 2)))) lid)]
                  (recur (rest vs) (assoc acc v k) (conj used k)))
                acc))
        node-id (fn [k] (str "r-" (name k)))
        rewrite (fn rewrite [p]
                  (update p :boxes
                          (fn [bx]
                            (into (sorted-map)
                                  (for [[id b] bx]
                                    [id (cond (ref? b) (let [r (resolve-ref proj b) k (get ids [(:line r) (:pos r)])]
                                                         (if k (assoc b :text (str "patch @" (name k)) :pin [(node-id k) 1]) b))
                                              (embedded? b) (update b :data (fn [d] (when d (rewrite d))))
                                              :else b)])))))
        lines (into {} (for [[lid pos :as v] versions :let [k (get ids v)]]
                         [k (-> (new-line k :from [lid pos])
                                (assoc :nodes {(node-id k) {:id (node-id k) :parent nil :at 0 :t 0
                                                             :events [[:load (rewrite (patch-at (line proj lid) pos))]]}}
                                       :pos [(node-id k) 1]))]))]
    {:title (str (:title proj) " · release") :main (get ids start) :clock 0
     :order (mapv (fn [v] (get ids v)) versions) :lines lines}))

;; ───────────────────────── export and import of a line ─────────────────────────

(defn export-line [proj lid]
  (let [l (line proj lid)]
    (pr-str {:kairotic/line (select-keys l [:id :note :nodes :pos])})))

(defn import-line
  "A line exported from another project, renamed if its name is taken here. Its node ids get a prefix so
   they never meet the ones here. Returns [project lid]."
  [proj text]
  (let [x (try (edn/read-string text) (catch :default _ nil))
        l (:kairotic/line x)]
    (when-not (and (map? l) (keyword? (:id l)) (map? (:nodes l))) (fail "That is not an exported line."))
    (let [proj (tick proj)
          pre (str "i" (:clock proj) "-")
          rn (fn [nid] (when nid (str pre nid)))
          base (name (:id l))
          k (first (remove (fn [k] (taken? proj k)) (cons (:id l) (map (fn [i] (keyword (str base "-" i))) (iterate inc 2)))))
          nodes (into {} (for [[nid n] (:nodes l)] [(rn nid) (-> n (update :id rn) (update :parent rn))]))
          nl (-> (new-line k :note (:note l)) (assoc :nodes nodes :pos (when-let [[nid i] (:pos l)] [(rn nid) i])))]
      [(-> proj (assoc-in [:lines k] nl) (update :order conj k)) k])))

;; ───────────────────────── messages (a tiny engine, to hear follow and pin) ─────────────────────────
;; Every sub-patch is replaced by its boxes (as the app's engine does): a box is known by its path from
;; the line on screen. An inlet box passes on what its sub-patch box receives; an outlet box passes out
;; what it receives.

(defn graph
  "{:nodes {path box} :edges {[path outlet] [[path inlet] …]} :errors {path msg}} of the patch p."
  [proj p]
  (let [acc (volatile! {:nodes {} :edges {} :errors {}})
        add-edge (fn [src dst] (vswap! acc update-in [:edges src] (fnil conj []) dst))]
    (letfn [(walk [p prefix chain]
              (doseq [[id b] (:boxes p)]
                (let [path (conj prefix id)]
                  (vswap! acc assoc-in [:nodes path] b)
                  (when (sub? b)
                    (let [r (when (ref? b) (resolve-ref proj b))
                          lid (:line r)]
                      (cond (:error r) (vswap! acc assoc-in [:errors path] (:error r))
                            (and lid (contains? chain lid)) (vswap! acc assoc-in [:errors path] "cycle")
                            (> (count prefix) 24) (vswap! acc assoc-in [:errors path] "too deep")
                            :else (walk (inner proj b) path (if lid (conj chain lid) chain)))))))
              (doseq [[a o b i] (:lines p)
                      :let [ba (get-in p [:boxes a]) bb (get-in p [:boxes b])]
                      :when (and ba bb)]
                (let [pa (conj prefix a) pb (conj prefix b)
                      src (if (sub? ba)
                            (when-let [ob (get (:outlets (patch-ports (or (inner proj ba) empty-patch))) o)] [(conj pa ob) 0])
                            [pa o])
                      dst (if (sub? bb)
                            (when-let [ib (get (:inlets (patch-ports (or (inner proj bb) empty-patch))) i)] [(conj pb ib) 0])
                            [pb i])]
                  (when (and src dst) (add-edge src dst)))))]
      (walk p [] #{})
      @acc)))

(defn num-of [x] (let [n (js/parseFloat x)] (when-not (js/isNaN n) n)))

(defn send
  "Box at path receives v at inlet. Returns the state {:vals {path v} :right {path n} :count n}."
  [g st path inlet v]
  (if (> (:count st 0) 256)
    (assoc st :overflow true)
    (let [st (update st :count (fnil inc 0))
          b (get-in g [:nodes path])
          w (words (:text b))
          out (fn [st v] (reduce (fn [st [p i]] (send g st p i v)) st (get-in g [:edges [path 0]])))]
      (case (first w)
        ("inlet" "outlet") (out st v)
        "msg" (out st (or (num-of (second w)) (second w)))
        "number" (out (assoc-in st [:vals path] v) v)
        ("+" "-" "*" "/") (if (= 1 inlet)
                            (assoc-in st [:right path] v)
                            (let [r (get-in st [:right path] (or (num-of (second w)) 0))
                                  x (num-of v)]
                              (if (and x (number? r))
                                (out (assoc-in st [:vals path] nil)
                                     (case (first w) "+" (+ x r) "-" (- x r) "*" (* x r) "/" (if (zero? r) 0 (/ x r))))
                                st)))
        st))))

(defn click
  "A msg box clicked: what it sends, through the patch."
  [g st path] (send g (assoc st :count 0) path 0 :bang))

;; ───────────────────────── a patch as code ─────────────────────────

(defn calls
  "The patch as the calls that make it (the Code tab of the app, in short)."
  ([p] (str/join "\n" (calls p 0)))
  ([p depth]
   (let [ind (apply str (repeat depth "  "))]
     (concat
      (mapcat (fn [[id b]]
                (concat [(str ind "(box " id " " (pr-str (:text b)) " " (js/Math.round (:x b)) " " (js/Math.round (:y b)) ")"
                              (when (:pin b) (str "  (pin " id " " (pr-str (:pin b)) ")")))]
                        (when (and (embedded? b) (seq (:boxes (:data b))))
                          (concat [(str ind "(inside " id)] (calls (:data b) (inc depth)) [(str ind ")")]))))
              (:boxes p))
      (for [[a o b i] (:lines p)] (str ind "(connect " a " " o " " b " " i ")"))))))

(defn next-id [p] (keyword (str "b" (inc (reduce max 0 (keep (fn [k] (some-> (re-matches #"b(\d+)" (name k)) second js/parseInt)) (keys (:boxes p))))))))
