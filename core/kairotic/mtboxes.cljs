;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · boxes for musical trees (Study 19)
;;   tree   a code box whose source is a tree in EDN (kairotic.mt): a bang sends it
;;   mt     operations on trees: mt transpose 7 · mt invert c4 · mt retrograde · mt augment 2 ·
;;          mt rotate 1 · mt canon 2 7 · mt seq · mt par · mt events · mt pitches · mt duration · mt play
;; A canvas, freqt or score that receives a tree shows it (kairotic.components/canvas-box).

(ns kairotic.mtboxes
  (:require [clojure.string :as str]
            [kairotic.components :as comp]
            [kairotic.code :as cbox]
            [kairotic.mt :as mt]))

;; ───────── tree: EDN data in the patch ─────────
;; Reading EDN evaluates nothing, so a tree box is safe in a shared room (no trust needed).

(cbox/register-language! "edn"
  (fn [source]
    (js/Promise.
     (fn [res rej]
       (try
         (let [t (mt/read-tree source) ps (when t (mt/errors t)) ws (when t (mt/warnings t))]
           (cond (nil? t) (rej (js/Error. "empty"))
                 (seq ps) (rej (js/Error. (str (first ps) (when (> (count ps) 1) (str " (+" (dec (count ps)) " more)")))))
                 :else (res {:value (mt/expand t)
                             :info {:summary (str (mt/summary t) (when (seq ws) (str " · ⚠ " (first ws))))}})))
         (catch :default e (rej e)))))))

;; The data of a tree box is the tree itself: {:tree t :source text}. Its history events are edits of
;; nodes ([:edit [[:attrs [0 1 2] {…}] …]], kairotic.mt/apply-op), so two branches that change different
;; measures can be merged; the text is only how it is shown (and edited: an edit of the text becomes
;; the node operations that make the difference, kairotic.mt/diff).

(defn- parse [text] (try (mt/read-tree text) (catch :default _ nil)))

(defn tree-of "The tree of a tree box's data (older works kept only its text)." [d]
  (or (:tree d) (parse (:source d))))

(defn- with-tree [t] {:tree t :source (if (some? t) (mt/pp t) "")})

(defn step [d [op & args]]
  (let [d (or d {:tree nil :source ""})]
    (case op
      :source (let [[text] args t (parse text)] (if (some? t) {:tree t :source (str text)} (assoc d :source (str text))))
      :load (let [[x] args]
              (cond (and (map? x) (contains? x :tree)) (with-tree (:tree x))
                    (and (map? x) (string? (:source x))) (step nil [:source (:source x)])
                    :else d))
      :edit (let [[ops] args]
              (try (with-tree (reduce mt/apply-op (tree-of d) ops))
                   (catch :default _ d)))
      d)))

(def model
  {:empty {:tree nil :source ""}
   :step step
   :load (fn [x] (step nil [:load x]))
   ;; in the Code tab, the tree as one call: (tree! :b2 [:voice …])
   :code (fn [id d] (when-let [t (tree-of d)]
                      (concat [(str "(tree! " id)] (map (fn [l] (str "  " l)) (str/split-lines (mt/pp t))) [")"])))})

(comp/define! "tree"
  {:doc "A musical tree written in EDN (hiccup style: [:voice [:measure {:meter [4 4]} \"c4/1 e4 g4/2\"]]). A bang (or anything) sends it, expanded: strings become notes and [:use …] the fragments of :defs."
   :usage "tree"
   :display :code :language "edn" :model model
   :io [1 1]
   :template "[:voice {:name \"motif\"}\n [:measure {:meter [4 4]} \"c4/1 d4/.5 e4 g4/1 e4\"]\n [:measure \"f4/.5 e4 d4 c4 d4/2\"]]"
   :receive (fn [m]
              (let [t (tree-of (:data m))]
                (if (some? t)
                  (try {:out [[0 (mt/expand-source t (:id m))]] :show :bang}
                       (catch :default e {:effects [[:print (str "tree: " (.-message e))]]}))
                  {:effects [[:print "tree: empty, or text that does not read as EDN"]]})))})

;; ───────── mt: operations ─────────

(defn op-of [args] (some-> (first args) name))

(def two-inlets #{"transpose" "invert" "augment" "rotate" "canon" "seq" "par"})

(defn num-arg [x d] (if (number? x) x d))

(defn transform
  "What `mt <op> args` does to a tree (with the right inlet's value r, if it came)."
  [op args r t]
  (let [[a b] args]
    (case op
      "transpose" (mt/transpose (num-arg (or r a) 0) t)
      "invert" (mt/invert (or r (when (some? a) (if (keyword? a) (name a) a))) t)
      "retrograde" (mt/retrograde t)
      "augment" (mt/augment (num-arg (or r a) 2) t)
      "rotate" (mt/rotate (num-arg (or r a) 1) t)
      "canon" (mt/canon (num-arg (or r a) 1) (num-arg b 0) t)
      "seq" [:seq (mt/expand t) (if (mt/tree? r) (mt/expand r) [:seq])]
      "par" [:par (mt/expand t) (if (mt/tree? r) (mt/expand r) [:seq])]
      "expand" (mt/expand t)
      "events" (mt/events t)
      "pitches" (mt/pitches t)
      "duration" (mt/duration t)
      (throw (js/Error. (str "mt: unknown operation " (pr-str op)))))))

(defn play [{:keys [state args inlet value at]}]
  (let [st (or state {:gen 0})
        tick? (and (vector? value) (= :tick (first value)))
        loop? (some #{:loop} (rest args))]
    (cond
      tick?
      (let [[_ g i] value sch (:sch st)]
        (if (and (= g (:gen st)) sch (< i (count sch)))
          (let [[_ outs] (nth sch i)
                nxt (inc i)]
            (cond
              (< nxt (count sch)) {:state st :out outs :show i
                                   :later [[(+ (:t0 st) (first (nth sch nxt))) 0 [:tick g nxt]]]}
              loop? (let [t0 (+ (:t0 st) (:len st))]
                      {:state (assoc st :t0 t0) :out outs :later [[t0 0 [:tick g 0]]]})
              :else {:state st :out outs}))
          {:state st}))

      (mt/tree? value)
      (let [sch (mt/schedule value)]
        {:state (assoc st :sch sch :len (* (/ 60 (mt/tempo-of value)) (mt/duration value)) :gen (inc (:gen st)))})

      (= value :stop)
      {:state (update st :gen inc) :out [[1 []] [0 []]]}

      (or (= value :bang) (= value :start) (number? value))
      (if (seq (:sch st))
        (let [g (inc (:gen st))]
          {:state (assoc st :gen g :t0 at) :later [[(+ at (first (first (:sch st)))) 0 [:tick g 0]]]})
        {:state st})

      :else {:state st})))

(comp/define! "mt"
  {:doc "Operations on musical trees: a tree on the left comes out transformed. transpose n · invert [pivot] · retrograde · augment f · rotate k · canon delay [interval] · seq / par (joins the left tree with the one on the right) · events · pitches · duration · play [loop] (a bang plays the last tree: Hz and voice ids for synth~, parameters and marks)."
   :usage "mt <operation> [arguments]"
   :io (fn [b] (let [op (op-of (:args b))]
                 (cond (= op "play") [1 4]
                       (two-inlets op) [2 1]
                       :else [1 1])))
   :dynamic-io true
   :receive (fn [{:keys [state args inlet value] :as m}]
              (let [op (op-of args)]
                (cond
                  (= op "play") (play m)
                  (= inlet 1) {:state (assoc state :r value)}
                  (mt/tree? value)
                  (try {:state state :out [[0 (transform op (rest args) (:r state) value)]]}
                       (catch :default e {:state state :effects [[:print (str "mt " op ": " (.-message e))]]}))
                  :else {:state state})))})
