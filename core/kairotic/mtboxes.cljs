;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · boxes for musical trees (Study 19)
;;   tree   a tree in EDN (kairotic.mt), seen as a score or a roll, its text in the code window: a bang sends it
;;   mt     operations on trees: mt transpose 7 · mt invert c4 · mt retrograde · mt augment 2 ·
;;          mt rotate 1 · mt canon 2 7 · mt thin 0.5 · mt seq · mt par · mt events · mt pitches · mt duration · mt play
;; A canvas, freqt or score that receives a tree shows it (kairotic.components/canvas-box).

(ns kairotic.mtboxes
  (:require [clojure.string :as str]
            [kairotic.components :as comp]
            [kairotic.code :as cbox]
            [kairotic.mt :as mt]
            [kairotic.quantize :as qz]
            [kairotic.treecanvas :as tc]))

;; ───────── tree: EDN data in the patch ─────────
;; Reading EDN evaluates nothing, so a tree box is safe in a shared room (no trust needed).

;; a canvas, freqt or score that shows a tree gives it as its buffer (a reader~ plays it): Study 23
(reset! comp/tree-buffer mt/->strokes)

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
  {:doc "A musical tree written in EDN (hiccup style: [:voice [:measure {:meter [4 4]} \"c4/1 e4 g4/2\"]]), seen as a score, as a roll of frequency over time, or as a continuum between them (⇄ in its header; (continuum! :bN :dissolve), discussion #217), its text in the code window ({ } in its header) — one tree, two views (discussion #92): drawing on its roll writes notes into the tree (free time without measures, quantized bars with them). It sends its tree, expanded, whenever it changes (and again on a bang); `tree manual` only on a bang. Its second outlet is its notes as a buffer, for a reader~. On its inlet it takes edits [:edit [[:attrs path {…}] …]] (from a score's edits outlet) and whole trees, which change it, and takes [:take {…}] (from a follow box: where a performance played each note), kept only for you, or [:take {…} :work] in the tree."
   :usage "tree"
   ;; two views (score, roll); its text opens in the code window from { }. Works that showed it as code
   ;; or as a canvas open it as a score or a roll
   :display :score :views [:score :roll :continuum] :view-as {:roll :canvas} :view-aliases {:canvas :roll :code :score}
   :language "edn" :model model
   :io [1 2]
   :template "[:voice {:name \"motif\"}\n [:measure {:meter [4 4]} \"c4/1 d4/.5 e4 g4/1 e4\"]\n [:measure \"f4/.5 e4 d4 c4 d4/2\"]]"
   :receive (fn [m]
              (let [t (tree-of (:data m)) v (:value m)]
                (cond
                  ;; edits and trees change the box: that is a gesture of the work, done by the page
                  (and (vector? v) (= :edit (first v))) {:effects [[:tree-edit (second v)]]}
                  ;; a take (from a follow box, discussion #289): kept only for whoever played it, or with :work in
                  ;; the tree; the page does it
                  (and (vector? v) (= :take (first v)) (map? (second v)))
                  {:effects [[:take [(second v) (if (= :work (get v 2)) :work :me)]]]}
                  ;; its own tree come back (through mt boxes): a loop that would rewrite it for ever
                  (and (mt/node? v) (= (:from (meta v)) (:id m)))
                  {:effects [[:print (str "loop: " (name (:id m)) " received its own tree back; it does not change")]]}
                  (mt/node? v) {:effects [[:tree-set v]]}
                  (some? t)
                  (try {:out [[0 (mt/expand-source t (:id m))]] :show :bang}
                       (catch :default e {:effects [[:print (str "tree: " (.-message e))]]}))
                  :else {:effects [[:print "tree: empty, or text that does not read as EDN"]]})))})

;; ───────── quantize: free time written in measures, by hand ─────────
;; The material is the freqt on its right inlet (what transcribe or a drawing wrote), or a tree that came on the
;; left (free time, or measured: it is first made free again); the options are kept as they come; only a bang
;; quantizes and sends — a tree into a tree box is an event of the work's history, so nothing goes out while the
;; options are being tried.

(def quantize-keys #{:meter :meters :divs :merge :grace :chord :legato :voices :overlap :nest :key :tempo :time :ref-bpm :w :spell :real})

(defn quantize-report
  "What a quantization found: its bars, its meter, its tempo, its notes and its voices."
  [t]
  (let [xt (mt/expand t)
        ms (filter (fn [x] (and (mt/node? x) (= :measure (mt/tag x)))) (tree-seq mt/node? mt/kids xt))
        vs (filter (fn [x] (and (mt/node? x) (= :voice (mt/tag x)))) (tree-seq mt/node? mt/kids xt))
        m0 (some (fn [m] (:meter (mt/attrs m))) ms)]
    {:bars (if (seq vs) (quot (count ms) (max 1 (count vs))) (count ms))
     :meter (when m0 (str/join "/" m0))
     :tempo (:tempo (mt/attrs xt))
     :notes (count (filter (fn [e] (= :note (:kind e))) (mt/events xt)))
     :voices (max 1 (count vs))}))

(comp/define! "quantize"
  {:doc "Free time written in measures, when you ask: what transcribe or a drawing left in a freqt (connect the freqt's second outlet to its right inlet), or a tree in free time that comes on the left (a measured one is made free first), becomes a measured tree — measures, tuplets, ties, grace notes, voices —, for a tree box. Only a bang quantizes and sends it, so its options can be tried first: [:meter \"6/8\"], [:meter \"7/8[2+2+3]\"], [:meters [\"3/4\" \"5/8\"]], [:divs [1 2 3 4]] (the divisions a beat may take), [:merge []] (no beats joined into a tuplet), [:legato 0.25] (the largest gap that is not a rest, in beats), [:chord 0.04] (starts that close are one chord), [:voices 1], [:grace false], [:key \"eb\"], [:tempo 72], [:time :track] (find the beats of what was played freely, as track), or a map of them; [:meter nil] forgets one, :reset all of them. With the word track it finds the beats from the start. It is the quantization a freqt shown as a score uses (that is a preview); here it is a step of the patch, with its options in view, and two quantize boxes can write the same take two ways."
   :usage "quantize [track]"
   :io [2 2]
   :reads-buffer true
   :receive (fn [{:keys [inlet value state args buffer buffer-id]}]
              (let [st (or state {:opts (if (some #{:track} args) {:time :track} {})})
                    show (fn [st extra] (merge {:opts (:opts st) :from (cond (:tree st) "a tree" buffer-id (name buffer-id) :else nil)} extra))]
                (cond
                  ;; the right inlet: the freqt is read when the bang comes (nothing to keep)
                  (= inlet 1) {}
                  ;; an option, or several; nil forgets it
                  (and (vector? value) (= 2 (count value)) (quantize-keys (first value)))
                  (let [[k v] value st (if (nil? v) (update st :opts dissoc k) (assoc-in st [:opts k] v))] {:state st :show (show st nil)})
                  (and (map? value) (seq value) (every? quantize-keys (keys value)))
                  (let [st (update st :opts merge value)] {:state st :show (show st nil)})
                  (#{:reset} value) (let [st (assoc st :opts {})] {:state st :show (show st nil)})
                  ;; a tree: the material, kept until the next bang
                  (mt/node? value) (let [st (assoc st :tree value)] {:state st :show (show st {:waiting true})})
                  (#{:clear} value) (let [st (dissoc st :tree)] {:state st :show (show st nil)})
                  ;; a bang: quantized now, and sent
                  (= value :bang)
                  (let [t (:tree st)
                        free (fn [t] (if (mt/measured? t) (tc/free-form t) t))]
                    (try
                      (let [q (cond t (qz/quantize-tree (free t) (:opts st))
                                    (and (map? buffer) (seq (:strokes buffer))) (qz/quantize buffer (merge (:quant buffer) (:opts st)))
                                    :else nil)]
                        (if q
                          (let [r (quantize-report q)] {:state st :show (show st r) :out [[1 r] [0 q]]})
                          {:show (show st {:error "nothing to quantize: a freqt on the right, or a tree on the left"})}))
                      (catch :default e {:show (show st {:error (.-message e)})
                                         :effects [[:print (str "quantize: " (.-message e))]]})))
                  :else {})))
   :size [190 40]
   :derive (fn [{:keys [shown]}]
             {:main (str "quantize" (when-let [m (get-in shown [:opts :meter])] (str " · " m)) (when (= :track (get-in shown [:opts :time])) " · track"))
              :sub (cond (:error shown) (str "✗ " (:error shown))
                         (:notes shown) (str (:bars shown) " bars of " (:meter shown) " · " (:notes shown) " notes" (when (:tempo shown) (str " · ♩ " (:tempo shown))))
                         (:waiting shown) "a tree is here: bang to quantize it"
                         :else "bang: quantize and send")})
   :view [[:rect {:x 2 :y 2 :w 186 :h 36 :r 3 :stroke :grid :fill :bg}]
          [:text {:x 10 :y 18 :size 12} :$main]
          [:text {:x 10 :y 32 :size 9 :fill :soft} :$sub]]})

;; ───────── mt: operations ─────────

(defn op-of [args] (some-> (first args) name))

(def two-inlets #{"transpose" "invert" "augment" "rotate" "canon" "thin" "seq" "par"})

(defn num-arg [x d] (if (number? x) x d))

(defn transform
  "What `mt <op> args` does to a tree (with the right inlet's value r, if it came)."
  [op args r t]
  (let [[a b] args]
    (case op
      "transpose" (mt/transpose (let [x (or r a)] (cond (number? x) x (or (symbol? x) (keyword? x) (string? x)) (name x) :else 0)) t)
      "invert" (mt/invert (or r (when (some? a) (if (keyword? a) (name a) a))) t)
      "retrograde" (mt/retrograde t)
      "augment" (mt/augment (num-arg (or r a) 2) t)
      "rotate" (mt/rotate (num-arg (or r a) 1) t)
      "thin" (mt/thin (num-arg (or r a) 0.5) t)
      ;; mt canon 2 7 · or with the heads' words: mt canon d 2 k P5 speed 0.5 inversion
      "canon" (if (some #{:d :k :speed :inversion} args)
                (let [after (fn [w] (second (drop-while #(not= w %) args)))
                      k (after :k)]
                  (mt/canon {:d (num-arg (or r (after :d)) 1)
                             :k (cond (number? k) k (or (keyword? k) (symbol? k) (string? k)) (name k) :else 0)
                             :speed (num-arg (after :speed) 1) :inversion (boolean (some #{:inversion} args))}
                            t))
                (mt/canon (num-arg (or r a) 1) (num-arg b 0) t))
      "seq" [:seq (mt/expand t) (if (mt/tree? r) (mt/expand r) [:seq])]
      "par" [:par (mt/expand t) (if (mt/tree? r) (mt/expand r) [:seq])]
      "expand" (mt/expand t)
      "events" (mt/events t)
      "pitches" (mt/pitches t)
      "duration" (mt/duration t)
      (throw (js/Error. (str "mt: unknown operation " (pr-str op)))))))

(defn play-speed
  "The speed of mt play: its words (mt play speed 0.5), or what a [:speed s] message set."
  [st args]
  (or (:speed st) (let [x (second (drop-while #(not= :speed %) args))] (when (and (number? x) (not (zero? x))) x)) 1))

(defn play-schedule
  "What mt play plays at speed s: the times divided by |s|, and backwards (the tree's retrograde) when s < 0."
  [tree s]
  (let [t (if (neg? s) (mt/retrograde tree) tree) a (js/Math.abs s)]
    {:sch (mapv (fn [[sec outs]] [(/ sec a) outs]) (mt/schedule t))
     :len (/ (* (/ 60 (mt/tempo-of t)) (mt/duration t)) a)}))

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
              :else {:state (assoc st :playing false) :out outs}))
          {:state st}))

      ;; another speed (msg :speed 0.5, −1 backwards): from the next start, or now for what is playing
      (and (vector? value) (= :speed (first value)) (number? (second value)) (not (zero? (second value))))
      (let [st (assoc st :speed (second value))]
        (if-let [t (:tree st)]
          (let [{:keys [sch len]} (play-schedule t (second value)) st (assoc st :sch sch :len len)]
            ;; playing: it starts again, at the new speed
            (if (and (:playing st) (seq sch))
              (let [g (inc (:gen st))]
                {:state (assoc st :gen g :t0 at) :later [[(+ at (first (first sch))) 0 [:tick g 0]]]})
              {:state st}))
          {:state st}))

      (mt/tree? value)
      (let [{:keys [sch len]} (play-schedule value (play-speed st args))]
        (cond
          ;; the same music again (a tree box re-sends its tree when the patch around it changes, e.g. a
          ;; knob that keeps its value in its text): nothing changes, and what is playing goes on
          (= sch (:sch st)) {:state st}
          ;; other music while playing: it goes on with the new one, from its beginning
          (and (:playing st) (seq sch))
          (let [g (inc (:gen st))]
            {:state (assoc st :tree value :sch sch :len len :gen g :t0 at) :later [[(+ at (first (first sch))) 0 [:tick g 0]]]})
          :else {:state (assoc st :tree value :sch sch :len len :gen (inc (:gen st)))}))

      (= value :stop)
      {:state (-> st (update :gen inc) (assoc :playing false)) :out [[1 []] [0 []]]}

      (or (= value :bang) (= value :start) (number? value))
      (if (seq (:sch st))
        (let [g (inc (:gen st))]
          {:state (assoc st :gen g :t0 at :playing true) :later [[(+ at (first (first (:sch st)))) 0 [:tick g 0]]]})
        {:state st})

      :else {:state st})))

(comp/define! "mt"
  {:doc "Operations on musical trees: a tree on the left comes out transformed. transpose n (semitones, or an interval: M3, -P5, A4) · invert [pivot] · retrograde · augment f · rotate k · canon delay [interval], or with the words of a reader on a ring: canon d 2 k P5 speed 0.5 inversion (the comes d beats later, k away, at a speed — 0.5 twice as slow, −1 backwards —, upside down) · thin amount (keeps the notes on the strongest positions of each measure: a share, 0.5, or how many, 3) · seq / par (joins the left tree with the one on the right) · events · pitches · duration · play [loop] [speed s] (a bang plays the last tree: Hz and voice ids for synth~, parameters and marks; at a speed, 0.5 twice as slow, −1 the tree backwards — msg :speed −1 —: the reader of a tree on its own clock, as a reader on a ring follows its head)."
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
                  (try {:state state
                        ;; the result remembers which tree box the tree comes from (a loop back to it is seen)
                        :out [[0 (let [x (transform op (rest args) (:r state) value)]
                                   (if (and (mt/node? x) (:from (meta value))) (vary-meta x assoc :from (:from (meta value))) x))]]}
                       (catch :default e {:state state :effects [[:print (str "mt " op ": " (.-message e))]]}))
                  :else {:state state})))})
