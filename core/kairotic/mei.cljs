;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · mei: a tree (kairotic.mt) in MEI and back, deterministically (Study 55, discussion #217)
;;
;;   ->mei   a tree as MEI: mt/->mei's notation (measures, spelling, ties, beams), MEI's own gestural attributes
;;           where a note has them (@tstamp.real, @dur.real, @vel), and one <extMeta type="kairotic"> holding, as
;;           EDN, what MEI has no place for: the root's and the voices' attributes, and each note's attributes beyond
;;           its written name, duration and tie, by the xml:id of its first written note
;;   <-mei   MEI as a tree: the written music from the notation (notes, rests, chords, tuplets, beams, ties, meters
;;           and keys as attributes or as <meterSig>/<keySig>, accidentals for their bar), the rest from <extMeta>;
;;           a MEI written elsewhere reads as its notation
;;
;; The written domain lives in MEI's notation, the gestural one in @*.real and the EDN; a note keeps where it really
;; sounded as :tstamp.real and :dur.real (seconds, named after MEI's attributes) on its first piece, a free note its
;; :hz (its name is chosen when it is written, by kairotic.spell). For a canonical tree — a :voice (or a :par of
;; voices) in measures that all say their :meter, a note per measure it sounds in, :tie true into the next, one rest
;; per silence per measure —
;;   (<-mei (->mei t)) = t      and      (->mei (<-mei m)) = m      (byte for byte).
;; Any other tree is written all the same (its expansion is what the MEI says).
;;
;; Takes (discussion #289): several performances of one tree, on its root as :takes [{:id :name :made :audio
;; :when {note-id [onset dur]}} …] (seconds; a note not played is absent; :audio a recorded sound's hash or a URL).
;; A note's own :tstamp.real/:dur.real stay the line's time; a take can be promoted to it. In MEI they are also
;; written to its performance module (<performance>/<recording>/<when absolute data="#note">), which a MEI from
;; elsewhere is read from; the EDN keeps them exactly.
;;
;; Through a lens (kairotic.lens, discussion #380): (->mei tree lens) writes the notation as that lens lays it out —
;; its staves, the order of the voices on them, their clefs, the notes drawn on another staff (@staff) — while the EDN
;; keeps the tree as it is (its voices' own attributes, in its own order: :lens {:spec … :order […]}), so that reading
;; it back gives the same tree: (<-mei (->mei t lens)) = (<-mei (->mei t)).
;;
;; line->tree and tree->line: a line of events in seconds and Hz ({:t :dur :hz :hz2 :amp}, as Study 52 draws it) as
;; a canonical voice on a grid, and back.

(ns kairotic.mei
  (:require [clojure.string :as str]
            [clojure.edn :as edn]
            [kairotic.canvas :as cv]
            [kairotic.spell :as sp]
            [kairotic.mt :as mt]
            [kairotic.optics :as o]
            [kairotic.lens :as lens]))

(def mei-ns "http://www.music-encoding.org/ns/mei")

;; ───────── line → tree ─────────

(defn gliss-cents [hz hz2] (* 1200 (/ (js/Math.log (/ hz2 hz)) (js/Math.log 2))))

(defn line->tree
  "A line of events {:t :dur (s) :hz :hz2? :amp?} as a canonical voice: written on a grid of `div` parts of a beat at
   `bpm`, in measures of `meter`, monophonic (a note is cut where the next begins), with what it really was kept on
   each note. `continuum` (resolutions, wires, electronics) rides on the voice."
  [line {:keys [bpm key meter div name continuum] :or {bpm 60 key 0 meter [4 4] div 4 name "line"}}]
  (let [unit (/ 60 bpm div)                                   ; seconds per part of the grid
        q (fn [s] (js/Math.round (/ s unit)))
        [p qq] meter
        bar (* p (/ 4 qq) div)                                    ; parts per measure
        evs (vec (sort-by :t (map-indexed (fn [i e] (assoc e :i i)) line)))
        spans (loop [i 0 prev 0 out []]
                (if (< i (count evs))
                  (let [e (nth evs i)
                        s0 (max prev (q (:t e)))
                        s1 (max (inc s0) (q (+ (:t e) (:dur e))))
                        nxt (when (< (inc i) (count evs)) (max s0 (q (:t (nth evs (inc i))))))
                        s1 (if (and nxt (> s1 nxt) (> nxt s0)) nxt s1)]
                    (recur (inc i) s1 (conj out [s0 s1 e])))
                  out))
        end (if (seq spans) (second (peek spans)) 0)
        nbars (max 1 (js/Math.ceil (/ end bar)))
        ;; the line as items over the grid: notes, and rests where nothing sounds
        items (loop [ss spans cur 0 out []]
                (if-let [[s0 s1 e] (first ss)]
                  (recur (rest ss) s1 (cond-> out (> s0 cur) (conj [:rest cur s0 nil]) true (conj [:note s0 s1 e])))
                  (cond-> out (< cur (* nbars bar)) (conj [:rest cur (* nbars bar) nil]))))
        head (fn [e d]
               (cond-> {:id (str "e" (:i e)) :hz (:hz e) :dur d :vel (or (:amp e) 0.6)
                        :tstamp.real (:t e) :dur.real (:dur e)}
                 (:hz2 e) (assoc :gliss [[0 0] [1 (gliss-cents (:hz e) (:hz2 e))]])))
        measure (fn [b]
                  (let [b0 (* b bar) b1 (+ b0 bar)]
                    (into [:measure {:meter [p qq]}]
                          (keep (fn [[k s0 s1 e]]
                                  (let [a (max s0 b0) z (min s1 b1)]
                                    (when (< a z)
                                      (let [d (/ (- z a) div)]
                                        (if (= k :rest)
                                          [:rest {:dur d}]
                                          [:note (cond-> (if (= a s0) (head e d) {:hz (:hz e) :dur d})
                                                   (< z s1) (assoc :tie true))])))))
                                items))))]
    (into [:voice (cond-> {:name name :key key :tempo bpm} continuum (assoc :continuum continuum))]
          (map measure (range nbars)))))

;; ───────── reading MEI ─────────

(defn- el-kids [el] (filter (fn [x] (= 1 (.-nodeType x))) (array-seq (.-childNodes el))))
(defn- lname [el] (.-localName el))
(defn- at [el k] (let [v (.getAttribute el k)] (when (and v (not= v "")) v)))
(defn- all [root nm] (array-seq (.getElementsByTagNameNS root "*" nm)))
(defn- strip-hash [s] (when s (str/replace s #"^#" "")))

(defn- verses-of
  "The syllables of a <note> (its <verse>s, not the line of cents kairotic.mt writes, type=\"cents\"): [verse-1 …],
   each {:syl :wordpos :con} (keywords), nil where a verse has none; nil when it has none."
  [el]
  (let [vs (keep (fn [[i v]]
                   (when (and (= "verse" (lname v)) (not= "cents" (at v "type")))
                     (let [ss (filter #(= "syl" (lname %)) (el-kids v))
                           n (or (some-> (at v "n") (js/parseInt 10)) (inc i))]
                       (when (seq ss)
                         [n (cond-> {:syl (apply str (map #(.-textContent %) ss))}
                              (at (first ss) "wordpos") (assoc :wordpos (keyword (at (first ss) "wordpos")))
                              (at (last ss) "con") (assoc :con (keyword (at (last ss) "con"))))]))))
                 (map-indexed vector (el-kids el)))
        top (reduce max 0 (map first vs))]
    (when (pos? top)
      (let [m (into {} vs)] (mapv #(get m %) (range 1 (inc top)))))))

(def accid-alter {"s" 1 "f" -1 "n" 0 "x" 2 "ss" 2 "ff" -2 "1qs" 0 "3qs" 1 "1qf" 0 "3qf" -1})
(def accid-cents {"1qs" 50 "3qs" 50 "1qf" -50 "3qf" -50})
(def letters ["c" "d" "e" "f" "g" "a" "b"])

(defn- beats-of [el scale]
  (let [d (at el "dur") dots (js/parseInt (or (at el "dots") "0") 10)
        base (case d "breve" 8 "long" 16 (/ 4 (js/parseFloat (or d "4"))))]
    (* scale base (- 2 (/ 1 (js/Math.pow 2 dots))))))

(defn- parse-sig [s] (cond (nil? s) nil (= s "0") 0
                           (str/ends-with? s "s") (js/parseInt s 10)
                           (str/ends-with? s "f") (- (js/parseInt s 10))
                           :else nil))

(defn- parse-meter [cnt unit]
  (when (and cnt unit)
    (let [parts (map #(js/parseInt % 10) (str/split cnt #"\+"))
          m [(reduce + parts) (js/parseInt unit 10)]]
      (cond-> {:meter m} (> (count parts) 1) (assoc :groups (vec parts))))))

(defn- def-meter
  "The meter a scoreDef or staffDef sets: its attributes, or a <meterSig> inside it."
  [el]
  (or (parse-meter (at el "meter.count") (at el "meter.unit"))
      (some (fn [m] (parse-meter (at m "count") (at m "unit"))) (all el "meterSig"))))

(defn- def-sig
  "The key signature a scoreDef or staffDef sets: @key.sig, or a <keySig sig> inside it."
  [el]
  (let [v (or (parse-sig (at el "key.sig")) (some (fn [k] (parse-sig (at k "sig"))) (all el "keySig")))]
    v))

(defn read-ext
  "The Kairotic EDN of a MEI document (its <extMeta type=\"kairotic\">), or nil."
  [doc]
  (when-let [x (first (filter #(= "kairotic" (at % "type")) (all doc "extMeta")))]
    (edn/read-string (.-textContent x))))

(defn- ties-of
  "{start-id end-id} of the ties of a document (<tie startid endid>, and @tie i/m/t in each layer)."
  [doc]
  (into {} (keep (fn [t] (when-let [s (strip-hash (at t "startid"))] [s (strip-hash (at t "endid"))])) (all doc "tie"))))

(defn segments
  "The written music of a MEI document as measures of voices: [{:attrs {:meter …} :voices {[staff layer] [seg …]}} …]
   where a seg is {:kind :note|:rest|:chord|:tuplet, :ids [xml:id …], :dur beats, :name, :cents, :tie bool,
   :grace bool, :kids (in a tuplet or a chord)} — tied notes inside a measure joined, rests in a row joined, a tie
   into the next measure kept as :tie. Also :sig (the key at the start) and :labels {staff label}."
  [doc]
  (let [ties (ties-of doc)
        tied-into (set (vals ties))
        sd (first (all doc "scoreDef"))
        state (atom {:meter (or (and sd (def-meter sd)) {:meter [4 4]})
                     :sig (or (and sd (def-sig sd)) 0)})
        sig0 (:sig @state)
        labels (into {} (for [d (all doc "staffDef")] [(at d "n") (at d "label")]))
        pitch-of (atom {})                                   ; id → [name cents] (a tie end takes its start's)
        figs (atom {})                                       ; id → "6/5": the figured bass under a note (<harm><fb>)
        out (atom [])
        layer-segs
        (fn layer-segs [el scale mem]
          ;; mem: atom of {[step oct] alter} for the bar (accidentals last to its end)
          (vec
           (mapcat
            (fn [x]
              (case (lname x)
                ("beam" "graceGrp") (layer-segs x scale mem)
                "tuplet" (let [n (js/parseInt (or (at x "num") "3") 10) nb (js/parseInt (or (at x "numbase") "2") 10)]
                           [{:kind :tuplet :ratio [n nb] :kids (layer-segs x 1 mem) :dur (* scale (/ nb n))}])
                "note" (let [id (at x "xml:id")
                             step (.indexOf letters (str/lower-case (or (at x "pname") "c")))
                             oct (js/parseInt (or (at x "oct") "4") 10)
                             acc (or (at x "accid") (at x "accid.ges")
                                     (some (fn [c] (when (= "accid" (lname c)) (or (at c "accid") (at c "accid.ges")))) (el-kids x)))
                             start (some (fn [[s e]] (when (= e id) s)) ties)
                             alter (cond acc (get accid-alter acc 0)
                                         (contains? @mem [step oct]) (get @mem [step oct])
                                         :else (sp/key-alter (:sig @state) step))
                             cents (get accid-cents acc 0)
                             _ (when acc (swap! mem assoc [step oct] alter))
                             [nm c] (or (and start (get @pitch-of start)) [(sp/->name {:step step :alter alter :oct oct}) cents])]
                         (swap! pitch-of assoc id [nm c])
                         [(cond-> {:kind :note :ids [id] :dur (beats-of x scale) :name nm :cents c
                                   :grace (some? (at x "grace")) :tie-out (contains? ties id) :tie-in (contains? tied-into id)}
                            (verses-of x) (assoc :lyr (verses-of x)))])
                "chord" (let [ns (filter #(= "note" (lname %)) (el-kids x))
                              ;; each note read as the only child of a layer (layer-segs reads an element's children):
                              ;; a whole copy (its <accid>s), with the chord's duration, without its <verse>s (the
                              ;; syllable is the chord's)
                              kids (vec (mapcat (fn [n]
                                                  (let [c (.cloneNode n true)
                                                        w (.createElementNS (.-ownerDocument x) mei-ns "layer")]
                                                    (doseq [v (filter #(= "verse" (lname %)) (el-kids c))] (.removeChild c v))
                                                    (.setAttribute c "dur" (or (at x "dur") "4"))
                                                    (when-let [d (at x "dots")] (.setAttribute c "dots" d))
                                                    (.appendChild w c)
                                                    (layer-segs w scale mem)))
                                                ns))]
                          ;; the syllable the chord sings: its own <verse>, or one of its notes' (a MEI from elsewhere)
                          [(cond-> {:kind :chord :ids [(at x "xml:id")] :dur (beats-of x scale) :kids kids}
                             (or (verses-of x) (some verses-of ns)) (assoc :lyr (or (verses-of x) (some verses-of ns))))])
                "rest" [{:kind :rest :ids [(at x "xml:id")] :dur (beats-of x scale)}]
                ("mRest" "mSpace") [{:kind :rest :ids [(at x "xml:id")] :dur :bar}]
                "space" [{:kind :rest :ids [(at x "xml:id")] :dur (beats-of x scale)}]
                []))
            (el-kids el))))
        join (fn [segs]
               ;; a note tied into from the note just before it (in this measure) is the same note; rests in a row too
               (reduce (fn [acc s]
                         (let [p (peek acc)]
                           (cond
                             (and p (= :note (:kind s) (:kind p)) (:tie-in s) (:tie-out p) (not (:grace s)))
                             (conj (pop acc) (assoc p :dur (+ (:dur p) (:dur s)) :ids (conj (:ids p) (first (:ids s))) :tie-out (:tie-out s)))
                             (and p (= :rest (:kind s) (:kind p)))
                             (conj (pop acc) (assoc p :dur (+ (:dur p) (:dur s)) :ids (into (:ids p) (:ids s))))
                             :else (conj acc s))))
                       [] segs))]
    (letfn [(walk [el]
              (doseq [x (el-kids el)]
                (case (lname x)
                  "scoreDef" (let [m (def-meter x) sg (def-sig x)]
                               (swap! state (fn [st] (cond-> st m (assoc :meter m) (some? sg) (assoc :sig sg)))))
                  ("section" "ending" "expansion" "lem" "rdg" "app") (walk x)
                  "measure" (let [{:keys [meter sig]} @state
                                  [p q] (:meter meter)
                                  len (* p (/ 4 q))
                                  prev-sig (:last-sig @state)
                                  voices (into {}
                                               (for [st (filter #(= "staff" (lname %)) (el-kids x))
                                                     ly (filter #(= "layer" (lname %)) (el-kids st))]
                                                 [[(at st "n") (at ly "n")]
                                                  (mapv (fn [s] (if (= :bar (:dur s)) (assoc s :dur len) s))
                                                        (join (layer-segs ly 1 (atom {}))))]))]
                              (swap! state assoc :last-sig sig)
                              ;; the figured bass of the measure (<harm><fb><f>6</f><f>5</f></fb></harm>): on the note
                              ;; it starts at (@startid), or the one sounding at its @tstamp on its staff (layer 1)
                              (doseq [h (filter #(= "harm" (lname %)) (el-kids x))
                                      :let [fb (first (filter #(= "fb" (lname %)) (el-kids h)))
                                            fs (when fb (map #(str/trim (.-textContent %)) (filter #(= "f" (lname %)) (el-kids fb))))
                                            f (str/join "/" (remove str/blank? fs))]
                                      :when (seq f)]
                                (if-let [id (strip-hash (at h "startid"))]
                                  (swap! figs assoc id f)
                                  (when-let [ts (some-> (at h "tstamp") js/parseFloat)]
                                    (let [onset (* (dec ts) (/ 4 q))
                                          st (or (at h "staff") (ffirst (sort (keys voices))))
                                          segs (get voices [(str st) "1"])]
                                      (loop [[sg & more] segs b 0]
                                        (when sg
                                          (if (< (js/Math.abs (- b onset)) 1e-6)
                                            (when (#{:note :chord} (:kind sg)) (swap! figs assoc (first (:ids sg)) f))
                                            (when (< b onset) (recur more (+ b (:dur sg)))))))))))
                              (swap! out conj {:attrs (cond-> meter (and (some? prev-sig) (not= prev-sig sig)) (assoc :key sig))
                                               :voices voices}))
                  nil)))]
      (walk (first (all doc "score"))))
    {:measures @out :sig sig0 :labels labels :figs @figs}))

(defn- seg->node
  "A segment as a node; figs: {xml:id \"6/5\"} the figured bass read, the note's :fig (its analysis layer)."
  ([s] (seg->node {} s))
  ([figs s]
   (let [f (some #(get figs %) (:ids s))]
     (case (:kind s)
       :rest [:rest {:dur (:dur s)}]
       :note (with-meta [:note (cond-> {:pitch (:name s) :dur (:dur s)}
                                 (not (zero? (:cents s))) (assoc :cents (:cents s))
                                 ;; its syllables (the lyrics layer): verse 1 on it, the others in :verses
                                 (first (:lyr s)) (merge (first (:lyr s)))
                                 (seq (rest (:lyr s))) (assoc :verses (vec (rest (:lyr s))))
                                 (:grace s) (-> (assoc :grace true) (dissoc :dur))
                                 (:tie-out s) (assoc :tie true)
                                 f (assoc :fig f))]
               {:written (:name s) :mei-id (first (:ids s))})
       :chord (into [:chord (cond-> {:dur (:dur s)}
                              f (assoc :fig f)
                              (first (:lyr s)) (merge (first (:lyr s)))
                              (seq (rest (:lyr s))) (assoc :verses (vec (rest (:lyr s)))))]
                    (map (fn [k] (let [[t a] (seg->node figs k)] [t (dissoc a :dur)])) (:kids s)))
       :tuplet (into [:tuplet {:ratio (:ratio s)}] (map #(seg->node figs %) (:kids s)))))))

(def ^:private eps 1e-6)

(defn- rest-extras
  "The rests of a written voice that carry more than their duration (a :wire, discussion #217), where they are:
   [[measure-index beat attrs] …] (beat from the start of the measure, top-level rests only). MEI writes rests in a
   row as one, and keeps nothing else of them; the extMeta does."
  [v]
  (vec (mapcat (fn [mi m]
                 (loop [[k & more] (mt/kids m) b 0 out []]
                   (if (nil? k)
                     out
                     (let [d (if (mt/node? k) (mt/duration k) 0)
                           a (when (mt/node? k) (mt/attrs k))
                           out (if (and (= :rest (mt/tag k)) (seq (dissoc a :dur))) (conj out [mi (cv/round-to b 6) a]) out)]
                       (recur more (+ b d) out)))))
               (range) (filter #(= :measure (mt/tag %)) (mt/kids v)))))

(defn- with-rests
  "A measure read from MEI with the rests extMeta kept ([[beat attrs] …]): the rest that covers each is cut there."
  [m entries]
  (if (empty? entries)
    m
    (let [cut (fn cut [s d es]
                ;; a rest from s lasting d, with the kept rests es that fall in it (sorted)
                (if-let [[b a] (first es)]
                  (let [db (:dur a)]
                    (concat (when (> (- b s) eps) [[:rest {:dur (cv/round-to (- b s) 6)}]])
                            [[:rest a]]
                            (let [s2 (+ b db) d2 (- (+ s d) s2)]
                              (when (> d2 eps) (cut s2 d2 (rest es))))))
                  [[:rest {:dur (cv/round-to d 6)}]]))
          kids (loop [[k & more] (mt/kids m) b 0 out []]
                 (if (nil? k)
                   out
                   (let [d (if (mt/node? k) (mt/duration k) 0)
                         es (when (= :rest (mt/tag k)) (seq (filter (fn [[x]] (and (>= x (- b eps)) (< x (- (+ b d) eps)))) entries)))]
                     (recur more (+ b d) (if es (into out (cut b d (sort-by first es))) (conj out k))))))]
      (with-meta (into [:measure (mt/attrs m)] kids) (meta m)))))

(defn- with-ext
  "A note read from MEI with what <extMeta> kept for it (by its xml:id): a free note loses its written name (it is
   Hz again; the name stays in its metadata, :written)."
  [n notes]
  (if (and (vector? n) (= :note (first n)))
    (if-let [x (get notes (:mei-id (meta n)))]
      (with-meta [:note (merge (cond-> (second n) (:hz x) (dissoc :pitch :cents)) x)] (meta n))
      n)
    (if (and (vector? n) (map? (second n)))
      (with-meta (into [(first n) (second n)] (map #(with-ext % notes) (subvec n 2))) (meta n))
      n)))

(defn- parse-iso
  "\"hh:mm:ss.sss\" (or seconds) → seconds."
  [s]
  (when s
    (let [ps (map js/parseFloat (str/split (str s) #":"))]
      (reduce (fn [acc x] (+ (* acc 60) x)) 0 ps))))

(defn- read-takes
  "The takes of a MEI's performance module: [{:id :name :audio :when {xml:id [onset nil]}}] (a <when> has no duration)."
  [doc]
  (vec (for [[k r] (map-indexed vector (all doc "recording"))
             :let [p (.-parentNode r)
                   ws (filter #(at % "data") (all r "when"))]
             :when (seq ws)]
         (cond-> {:id (or (at r "xml:id") (at p "xml:id") (str "take" (inc k)))
                  :when (into {} (for [w ws :let [id (strip-hash (first (str/split (at w "data") #"\s+")))]]
                                   [id [(parse-iso (at w "absolute")) nil]]))}
           (or (at p "label") (at r "label")) (assoc :name (or (at p "label") (at r "label")))
           (some (fn [f] (at f "target")) (all r "avFile")) (assoc :audio (some (fn [f] (at f "target")) (all r "avFile")))))))

(defn- node-map
  "A tree with f applied to every child of every node (with attributes or not), its structure and metadata kept."
  [t f]
  (if (and (vector? t) (keyword? (first t)))
    (let [n (if (map? (second t)) 2 1)]
      (with-meta (into (subvec t 0 n) (map f (subvec t n))) (meta t)))
    t))

(defn- with-ids
  "Notes read from a MEI from elsewhere that a take points at get their xml:id as :id."
  [n ids]
  (if (and (vector? n) (= :note (first n)) (contains? ids (:mei-id (meta n))))
    (with-meta [:note (assoc (second n) :id (:mei-id (meta n)))] (meta n))
    (node-map n #(with-ids % ids))))

(defn <-mei
  "A MEI text as a tree (canonical when the MEI was written by ->mei). Throws if it is not MEI."
  [text]
  (let [doc (.parseFromString (js/DOMParser.) text "application/xml")]
    (when (seq (all doc "parsererror")) (throw (js/Error. "this is not well-formed XML")))
    (when-not (first (all doc "score")) (throw (js/Error. "no <score> in this MEI")))
    (let [{:keys [measures sig labels figs]} (segments doc)
          ext (read-ext doc)
          vkeys (vec (sort-by (fn [[st ly]] [(js/parseInt st 10) (js/parseInt ly 10)]) (distinct (mapcat (comp keys :voices) measures))))
          kept (:voices ext)
          voice (fn [k]
                  (let [[st ly] k
                        i (.indexOf vkeys k)
                        label (get labels st)
                        a (or (and (= (count kept) (count vkeys)) (nth kept i))
                              (cond-> {:name (or label (str "voice " (inc i))) :key sig}
                                (> (count vkeys) 1) (assoc :staff (or label st))))]
                    (into [:voice a]
                          (map (fn [mi {:keys [attrs voices]}]
                                 (with-rests (with-ext (into [:measure attrs] (map #(seg->node figs %) (get voices k []))) (:notes ext))
                                   (keep (fn [[v m b x]] (when (and (= v i) (= m mi)) [b x])) (:rests ext))))
                               (range) measures))))]
      (let [vs (mapv voice vkeys)
            ;; written through a lens: the voices back in the tree's own order
            order (get-in ext [:lens :order])
            vs (if (and (= (count order) (count vs)) (= (set order) (set (range (count vs)))))
                 (mapv second (sort-by first (map vector order vs)))
                 vs)
            t (if (and (= 1 (count vkeys)) (not= :par (:root-tag ext)))
                (first vs)
                (into [(or (:root-tag ext) :par) (or (:root ext) {})] vs))
            ;; (a syllable's :con only where it is not the one derived: the canonical tree)
            t (if (some #(and (vector? %) (#{:note :chord} (first %)) (map? (second %)) (seq (mt/syllables-of (second %))))
                        (tree-seq vector? seq t))
                (mt/without-derived-cons t)
                t)
            ;; a MEI from elsewhere: its takes from its performance module (with the EDN, they are in the root's attributes)
            tks (when-not ext (read-takes doc))]
        (if (seq tks)
          (with-ids (update t 1 assoc :takes tks) (set (mapcat (comp keys :when) tks)))
          t)))))

;; ───────── writing MEI ─────────

(defn- iso-time [s]
  (let [h (js/Math.floor (/ s 3600)) m (js/Math.floor (/ (mod s 3600) 60)) x (- s (* 3600 h) (* 60 m))
        pad (fn [n w] (let [t (str n)] (str (apply str (repeat (- w (count t)) "0")) t)))]
    (str (pad h 2) ":" (pad m 2) ":" (if (< x 10) "0" "") (.toFixed x 3))))

(defn- notes-of
  "The notes of a voice, in order (a note per measure it sounds in, as its MEI writes them)."
  [v]
  (filterv (fn [n] (and (vector? n) (= :note (first n))))
           (tree-seq (fn [n] (and (vector? n) (keyword? (first n)))) (fn [n] (if (map? (second n)) (drop 2 n) (rest n))) v)))

(defn- voice-keys [segs]
  (vec (sort-by (fn [[st ly]] [(js/parseInt st 10) (js/parseInt ly 10)]) (distinct (mapcat (comp keys :voices) (:measures segs))))))

(defn- seg-notes
  "The notes of the segments of a document, voice by voice, in order."
  [segs]
  (letfn [(go [s] (case (:kind s) :note [s] (:chord :tuplet) (mapcat go (:kids s)) []))]
    (mapv (fn [k] (vec (for [m (:measures segs) s (get-in m [:voices k]) n (go s)] n))) (voice-keys segs))))

(defn- written
  "A tree as mt/->mei writes it, with its voices: [root-tag root-attrs voices]."
  [tree]
  (let [x (mt/with-meters (mt/explicit (mt/expand tree)))]
    (if (= :voice (mt/tag x))
      [:voice (mt/attrs x) [x]]
      [(mt/tag x) (mt/attrs x) (vec (mt/voices-of x))])))

(defn ->mei
  "The MEI of a tree: kairotic.mt's notation, with @tstamp.real, @dur.real and @vel on the notes that sound where they
   were really played, and an <extMeta type=\"kairotic\"> holding, as EDN, the voice's attributes and what each note
   has beyond its written name, duration and tie (by the xml:id of its first written note). Deterministic."
  ([tree] (->mei tree nil))
  ([tree0 lens-spec]
  (let [;; through a lens: the notation as it lays the tree out, the EDN the tree's own (its voices' attributes, and their
        ;; order: which voice of the tree each written one is)
        tagged (reduce (fn [t [i p]] (o/update-in-node t p #(mt/update-attrs % assoc ::ix i)))
                       tree0 (map-indexed vector (o/paths tree0 :voices)))
        own (mapv mt/attrs (o/view tree0 :voices))
        lensed (when lens-spec (lens/through tagged lens-spec))
        tree (if lensed (o/over-attrs lensed [:voices] dissoc ::ix) tree0)
        order (when lensed (mapv (comp ::ix mt/attrs) (o/view lensed :voices)))
        lens-keys [:cross]
        {:keys [mei]} (mt/->mei tree "k-")
        doc (.parseFromString (js/DOMParser.) mei "application/xml")
        segs (segments doc)
        sn (seg-notes segs)
        [rtag rattrs voices] (written tree)
        tn (mapv notes-of voices)
        ;; each note's attributes beyond what the notation says, by the xml:id of its first written note (when the
        ;; tree's voices and the MEI's line up, as they do for a canonical tree; else only the attributes are kept)
        same? (and (= (count sn) (count tn)) (every? true? (map (fn [a b] (= (count a) (count b))) sn tn)))
        notes (into (sorted-map)
                    (when same?
                      (keep (fn [[s n]]
                              (let [a (second n) x (apply dissoc a :dur :tie :pitch :cents :grace (concat lens-keys mt/lyrics-keys))]
                                (when (seq x) [(first (:ids s)) x])))
                            (map vector (apply concat sn) (apply concat tn)))))
        by-id (into {} (for [x (all doc "note")] [(at x "xml:id") x]))
        rests (vec (mapcat (fn [vi v] (map (fn [[mi b a]] [vi mi b a]) (rest-extras v))) (range) voices))
        ext (cond-> {:kairotic 1 :voices (if order (mapv own order) (mapv mt/attrs voices)) :notes notes}
              order (assoc :lens {:spec (lens/spec lens-spec) :order order})
              (seq rests) (assoc :rests rests)
              (not= rtag :voice) (assoc :root-tag rtag :root rattrs))]
    ;; MEI's own gestural attributes, as a mirror of the EDN (what other software can read)
    (doseq [[id x] notes :let [el (get by-id id)] :when el]
      (when-let [t (:tstamp.real x)] (.setAttribute el "tstamp.real" (iso-time t)))
      (when-let [d (:dur.real x)] (.setAttribute el "dur.real" (str (cv/round-to d 6))))
      (when-let [v (:vel x)] (.setAttribute el "vel" (str (js/Math.round (* 127 (max 0 (min 1 v))))))))
    ;; the takes (on the root) in MEI's performance module, before <body>: a <when> per note played, pointing at it
    (let [takes (:takes rattrs)
          music (first (all doc "music")) body (first (all doc "body"))
          ncname (fn [x] (str/replace (str x) #"[^A-Za-z0-9_.-]" "_"))
          id->mei (into {} (when same? (keep (fn [[s n]] (when-let [i (:id (second n))] [i (first (:ids s))]))
                                              (map vector (apply concat sn) (apply concat tn)))))
          order (when same? (keep (fn [n] (:id (second n))) (apply concat tn)))]
      (doseq [[k tk] (map-indexed vector takes) :when (map? tk)]
        (let [tid (ncname (or (:id tk) (str "t" k)))
              perf (.createElementNS doc mei-ns "performance")
              rec (.createElementNS doc mei-ns "recording")]
          (.setAttribute perf "xml:id" (str "perf-" tid))
          (when (:name tk) (.setAttribute perf "label" (str (:name tk))))
          (.setAttribute rec "xml:id" (str "rec-" tid))
          (.setAttribute rec "betype" "time")
          (when (string? (:audio tk))
            (let [f (.createElementNS doc mei-ns "avFile")] (.setAttribute f "target" (:audio tk)) (.appendChild rec f)))
          (doseq [[j nid] (map-indexed vector order)
                  :let [[t0 _] (get (:when tk) nid) mid (get id->mei nid)]
                  :when (and (number? t0) mid)]
            (let [w (.createElementNS doc mei-ns "when")]
              (.setAttribute w "xml:id" (str "when-" tid "-" j))
              (.setAttribute w "absolute" (iso-time t0))
              (.setAttribute w "data" (str "#" mid))
              (.appendChild rec w)))
          (.appendChild perf rec)
          (.insertBefore music perf body))))
    (let [head (first (all doc "meiHead"))
          em (.createElementNS doc mei-ns "extMeta")]
      (.setAttribute em "type" "kairotic")
      (.appendChild em (.createCDATASection doc (pr-str ext)))
      (.appendChild head em))
    (let [s (.serializeToString (js/XMLSerializer.) doc)]
      (if (str/starts-with? s "<?xml") s (str "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" s))))))

;; ───────── tree → line ─────────

(defn tree->line
  "The line of a voice: one event per note (a tied note is one event), where it really sounded when the tree knows it
   (:tstamp.real, :dur.real), else where it is written at the voice's tempo; its exact Hz (or its written pitch); its
   glissando's end; and the written name it has in the MEI it was read from (:name), when it has one. With {:take id},
   where that take played each note (a note it did not play is left out)."
  ([tree] (tree->line tree {}))
  ([tree {:keys [take]}]
  (let [v (if (= :voice (first tree)) tree (or (first (filter #(and (vector? %) (= :voice (first %))) tree)) tree))
        tempo (or (:tempo (second v)) (:tempo (second tree)) 60) spb (/ 60 tempo)
        tw (when take (:when (first (filter #(= take (:id %)) (:takes (second tree))))))]
    (loop [ms (filter #(and (vector? %) (= :measure (first %))) v) beat 0 open nil out []]
      (if-let [m (first ms)]
        (let [[beat open out]
              (reduce (fn [[b open out] n]
                        (let [a (second n) d (or (:dur a) 0)]
                          (case (first n)
                            :rest [(+ b d) nil out]
                            :note (if open
                                    ;; a tied piece: the event goes on
                                    [(+ b d) (when (:tie a) (update open :wdur + d)) (if (:tie a) out (conj out (update open :wdur + d)))]
                                    (let [hz (or (:hz a) (cv/midi->hz (mt/midi-of a)))
                                          g (:gliss a)
                                          [pt pd] (when take (get tw (:id a)))
                                          ev (cond-> {:t (if take pt (or (:tstamp.real a) (* b spb))) :hz hz :amp (or (:vel a) 0.6)
                                                      :real-dur (if take pd (:dur.real a)) :wdur d :beat b}
                                               (and take (nil? pt)) (assoc :skip true)
                                               (seq g) (assoc :hz2 (* hz (js/Math.pow 2 (/ (second (last g)) 1200))))
                                               (:id a) (assoc :id (:id a))
                                               (or (:written (meta n)) (:pitch a)) (assoc :name (or (:written (meta n)) (:pitch a))))]
                                      [(+ b d) (when (:tie a) ev) (if (:tie a) out (conj out ev))]))
                            [(+ b d) open out])))
                      [beat open out] (drop 2 m))]
          (recur (rest ms) beat open out))
        (->> (cond-> out open (conj open))
             (remove :skip)
             (mapv (fn [e] (-> e (assoc :dur (or (:real-dur e) (* (:wdur e) spb))) (dissoc :real-dur :wdur :beat))))))))))

;; ───────── checks ─────────

(defn same-line?
  "Two lines are the same: times, durations, Hz and amplitudes exactly, glissandi within 1e-9 (they pass through
   cents)."
  [a b]
  (and (= (count a) (count b))
       (every? (fn [[x y]]
                 (and (= (:t x) (:t y)) (= (:dur x) (:dur y)) (= (:hz x) (:hz y)) (= (or (:amp x) 0.6) (:amp y))
                      (= (some? (:hz2 x)) (some? (:hz2 y)))
                      (or (nil? (:hz2 x)) (< (js/Math.abs (- 1 (/ (:hz2 y) (:hz2 x)))) 1e-9))))
               (map vector (sort-by :t a) b))))

(defn round-trip
  "Every check of the continuum's coherence for a line written with opts: {check ok?}, and the tree and MEI made."
  [line opts]
  (let [t (line->tree line opts)
        m (->mei t)
        t2 (<-mei m)
        m2 (->mei t2)
        l2 (tree->line t2)]
    {:tree t :mei m :tree2 t2 :line2 l2
     :checks [["the tree read from its MEI is the tree" (= t t2)]
              ["the MEI written from that tree is the MEI (byte for byte)" (= m m2)]
              ["writing is deterministic: the same tree, the same MEI" (= m (->mei t))]
              ["the line read back is the line: times, durations, Hz, amplitudes, glissandi" (same-line? line l2)]
              ["the written music agrees: mt reads the same notes from both trees" (= (map (juxt :t :dur :pitch) (mt/notes t)) (map (juxt :t :dur :pitch) (mt/notes t2)))]
              ["the continuum (resolutions, wires, electronics) comes back" (= (:continuum (second t)) (:continuum (second t2)))]]}))

;; ───────── MusicXML (through Verovio) ─────────

(defn musicxml->mei
  "A MusicXML text as MEI, by a Verovio toolkit (Verovio reads MusicXML and writes MEI)."
  [tk text]
  (.setOptions tk (clj->js {:inputFrom "musicxml"}))
  (when-not (.loadData tk text) (throw (js/Error. "Verovio could not read this MusicXML")))
  (let [m (.getMEI tk (clj->js {:scoreBased true}))]
    (.setOptions tk (clj->js {:inputFrom "auto"}))
    m))

(defn musicxml? "Does a text look like MusicXML (and not MEI)?" [text]
  (boolean (re-find #"<(score-partwise|score-timewise)[\s>]" (str text))))

;; ───────── takes (discussion #289) ─────────

(defn- walk-notes
  "f applied to the attributes of every note of a tree (its structure kept)."
  [t f]
  (if (and (vector? t) (= :note (first t)))
    (with-meta (into [:note (f (if (map? (second t)) (second t) {}))] (subvec t (if (map? (second t)) 2 1))) (meta t))
    (node-map t #(walk-notes % f))))

(defn ensure-ids
  "Every note that begins a sound (not the piece a tie goes on into) gets an :id if it has none: \"n0\", \"n1\" … in
   order, skipping those already used. Takes point at notes by them."
  [tree]
  (let [used (atom (set (keep (fn [x] (when (and (vector? x) (= :note (first x))) (:id (second x))))
                              (tree-seq vector? seq tree))))
        k (atom 0)
        fresh (fn [] (loop [] (let [c (str "n" @k)] (swap! k inc) (if (contains? @used c) (recur) (do (swap! used conj c) c)))))
        open (atom false)]
    (letfn [(go [t]
              (cond
                (and (vector? t) (= :voice (first t))) (do (reset! open false) (node-map t go))
                (and (vector? t) (= :note (first t)))
                (let [has (map? (second t)) a (if has (second t) {}) cont? @open]
                  (when-not (:grace a) (reset! open (boolean (:tie a))))
                  (with-meta (into [:note (if (or cont? (:id a)) a (assoc a :id (fresh)))] (subvec t (if has 2 1))) (meta t)))
                (and (vector? t) (= :rest (first t))) (do (reset! open false) t)
                :else (node-map t go)))]
      (go tree))))

(defn with-note-ids
  "A tree as its notes are named for takes: written out (melody strings as notes) and every note that begins a sound
   with an :id (ensure-ids). The same tree, however it is written, names its notes the same way: a take made while
   following it (kairotic.follow) points at them even if they were never written with an :id."
  [tree]
  (ensure-ids (mt/explicit (mt/expand tree))))

(defn takes "The takes of a tree (on its root)." [tree] (vec (:takes (second tree))))

(defn add-take
  "A tree with one more take ({:id :name :made :audio :when {note-id [onset dur]}}); a take with the same :id is
   replaced."
  [tree tk]
  (update tree 1 (fn [a] (assoc a :takes (conj (vec (remove #(= (:id tk) (:id %)) (:takes a))) tk)))))

(defn remove-take [tree id]
  (update tree 1 (fn [a] (let [ts (vec (remove #(= id (:id %)) (:takes a)))] (if (seq ts) (assoc a :takes ts) (dissoc a :takes))))))

(defn take-of-line
  "A take from a line played (events with the :id of the note each one played, :t and :dur in seconds)."
  [line {:keys [id name made audio]}]
  (cond-> {:id id :when (into {} (for [e line :when (:id e)] [(:id e) [(:t e) (:dur e)]]))}
    name (assoc :name name) made (assoc :made made) audio (assoc :audio audio)))

(defn promote-take
  "The tree with a take as its own time: each note that take played keeps its onset (and duration) as :tstamp.real
   (and :dur.real)."
  [tree id]
  (if-let [tw (:when (first (filter #(= id (:id %)) (takes tree))))]
    (walk-notes tree (fn [a] (if-let [[t d] (get tw (:id a))]
                               (cond-> (assoc a :tstamp.real t) (number? d) (assoc :dur.real d))
                               a)))
    tree))
