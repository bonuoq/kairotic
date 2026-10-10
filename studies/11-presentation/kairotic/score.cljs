;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · score
;; A musical voice in time as EDN data, projected to notation (MEI, drawn with Verovio), with a
;; time ⇄ space relation built from the drawn notation, in the style of INScore.
;; Voice data: {:tempo beats-per-minute :meter [4 4] :events {:e1 {:t beat :pitch midi :dur beats :txt "…"}}}
;; (a canvas gives one with kairotic.canvas/->voice). Also: pitch names and a melody parser for the REPL.

(ns kairotic.score
  (:require [clojure.string :as str]))

(defn num? [x] (and (number? x) (not (js/isNaN x))))

(defn sorted-events [s] (sort-by (fn [[_ e]] [(:t e) (- (:pitch e))]) (:events s)))

;; ───────── pitches ─────────

(def pcs {"c" 0 "d" 2 "e" 4 "f" 5 "g" 7 "a" 9 "b" 11})
(def sharp-names ["c" "c" "d" "d" "e" "f" "f" "g" "g" "a" "a" "b"])
(def sharp-acc [nil "s" nil "s" nil nil "s" nil "s" nil "s" nil])

(defn pitch
  "60, \"c4\", \"f#3\", \"bb2\" → MIDI number (c4 = 60)."
  [x]
  (cond (num? x) x
        (keyword? x) (pitch (name x))
        (string? x) (let [m (re-matches #"(?i)([a-g])(#|s|b)?(-?\d)" (str/trim x))]
                      (when m
                        (+ (* 12 (inc (js/parseInt (nth m 3) 10)))
                           (get pcs (str/lower-case (nth m 1)))
                           (case (nth m 2) "#" 1 "s" 1 "b" -1 0))))
        :else nil))

(defn parse-melody
  "\"c4/1 d4/.5 r/1 c4+e4+g4/2\" → [[t pitch dur] ...] starting at beat t0."
  [txt t0]
  (loop [toks (remove str/blank? (str/split (str/trim (str txt)) #"\s+")) t t0 out []]
    (if (empty? toks)
      out
      (let [[p d] (str/split (first toks) #"/")
            dur (if d (js/parseFloat d) 1)
            dur (if (js/isNaN dur) 1 dur)]
        (if (= (str/lower-case p) "r")
          (recur (rest toks) (+ t dur) out)
          (let [ps (map pitch (str/split p #"\+"))]
            (when (some nil? ps) (throw (js/Error. (str "I don't understand the note «" p "». Use for example c4, f#3 or bb2."))))
            (recur (rest toks) (+ t dur) (into out (map (fn [a] [t a dur]) ps)))))))))

;; ───────── projection to MEI (notation) ─────────
;; A sixteenth-note grid; one voice per staff: notes that start together form a chord,
;; a note is cut when the next one starts.
;; Every element has its own id (n-<event>-<piece>) so that the notation can be related to the model.

(def unit 0.25)
(defn slots [x] (js/Math.round (/ x unit)))
(def lens [[16 "1" 0] [12 "2" 1] [8 "2" 0] [6 "4" 1] [4 "4" 0] [3 "8" 1] [2 "8" 0] [1 "16" 0]])
(defn bar-slots [s] (let [[n d] (:meter s)] (* n (/ 4 d) 4)))

(defn segments [notes total]
  (let [groups (vec (sort-by key (group-by :s notes)))
        starts (mapv key groups)]
    (loop [i 0 cur 0 out []]
      (if (>= i (count groups))
        (if (< cur total) (conj out {:s cur :e total :notes nil}) out)
        (let [[s g] (nth groups i)
              nxt (get starts (inc i))
              e (min (apply min (map :e g)) (or nxt js/Infinity))
              e (max e (inc s))
              out (if (> s cur) (conj out {:s cur :e s :notes nil}) out)]
          (recur (inc i) (max cur e) (conj out {:s s :e e :notes (sort-by :pitch g)})))))))

(defn pieces [s e bar]
  (loop [p s out []]
    (if (>= p e)
      out
      (let [room (- bar (mod p bar))
            remaining (- e p)
            [len du dots] (first (filter (fn [[l]] (<= l (min room remaining))) lens))]
        (recur (+ p len) (conj out {:p p :len len :dur du :dots dots}))))))

(defn nid [pre id k] (str "n-" pre (name id) "-" k))

(defn note-xml [pre n k durattr]
  (let [a (:pitch n) pc (mod a 12)]
    (str "<note xml:id=\"" (nid pre (:id n) k) "\" pname=\"" (nth sharp-names pc) "\" oct=\"" (dec (js/Math.floor (/ a 12))) "\""
         (when-let [ac (nth sharp-acc pc)] (str " accid=\"" ac "\""))
         durattr
         ;; a text under the note (e.g. the deviation in cents of an untempered pitch)
         (if (and (:txt n) (zero? k))
           (str "><verse n=\"1\"><syl>" (-> (str (:txt n)) (str/replace "&" "&amp;") (str/replace "<" "&lt;")) "</syl></verse></note>")
           "/>"))))

(defn ->mei*
  "MEI of the voice. `staves` = [[n filter clef-shape clef-line] ...]; `pre` prefixes the ids
   (so that several scores can live on one page). Returns {:mei text :pieces [{:id :t :ev :staff}]}."
  [s staves pre]
  (let [bar (bar-slots s)
        notes (for [[id e] (sorted-events s)]
                (let [a (slots (:t e))]
                  {:id id :s a :e (max (inc a) (slots (+ (:t e) (:dur e)))) :pitch (:pitch e) :txt (:txt e)}))
        nbars (max 2 (js/Math.ceil (/ (reduce max 0 (map :e notes)) bar)))
        total (* nbars bar)
        measures (atom (vec (repeat nbars {:ties []})))
        placed (atom [])]
    (doseq [[st keep? _ _] staves]
      (doseq [[si seg] (map-indexed vector (segments (filter keep? notes) total))]
        (let [pz (pieces (:s seg) (:e seg) bar)]
          (doseq [[k pc] (map-indexed vector pz)]
            (let [m (quot (:p pc) bar)
                  durattr (str " dur=\"" (:dur pc) "\"" (when (pos? (:dots pc)) " dots=\"1\""))
                  t (* (:p pc) unit)
                  ns-seg (:notes seg)
                  xml (if (seq ns-seg)
                        (do
                          (doseq [n ns-seg]
                            (swap! placed conj {:id (nid pre (:id n) k) :t t :ev (:id n) :staff st}))
                          (when (< (inc k) (count pz))
                            (swap! measures update-in [m :ties] into
                                   (for [n ns-seg]
                                     (str "<tie startid=\"#" (nid pre (:id n) k) "\" endid=\"#" (nid pre (:id n) (inc k)) "\"/>"))))
                          (if (= 1 (count ns-seg))
                            (note-xml pre (first ns-seg) k durattr)
                            (str "<chord xml:id=\"c-" pre st "-" si "-" k "\"" durattr ">"
                                 (apply str (map (fn [n] (note-xml pre n k "")) ns-seg))
                                 "</chord>")))
                        (let [rid (str "r-" pre st "-" si "-" k)]
                          (swap! placed conj {:id rid :t t :ev nil :staff st})
                          (str "<rest xml:id=\"" rid "\"" durattr "/>")))]
              (swap! measures update-in [m st] (fnil conj []) xml))))))
    {:mei (str "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
               "<mei xmlns=\"http://www.music-encoding.org/ns/mei\" meiversion=\"5.0\">"
               "<meiHead><fileDesc><titleStmt><title>Kairotic</title></titleStmt><pubStmt/></fileDesc></meiHead>"
               "<music><body><mdiv><score>"
               "<scoreDef meter.count=\"" (first (:meter s)) "\" meter.unit=\"" (second (:meter s)) "\" key.sig=\"0\">"
               "<staffGrp" (when (> (count staves) 1) " symbol=\"brace\" bar.thru=\"true\"") ">"
               (apply str (for [[st _ shape line] staves]
                            (str "<staffDef n=\"" st "\" lines=\"5\" clef.shape=\"" shape "\" clef.line=\"" line "\"/>")))
               "</staffGrp></scoreDef><section>"
               (apply str (map-indexed (fn [i m]
                                         (str "<measure n=\"" (inc i) "\">"
                                              (apply str (for [[st] staves]
                                                           (str "<staff n=\"" st "\"><layer n=\"1\">" (apply str (get m st)) "</layer></staff>")))
                                              (apply str (:ties m))
                                              "</measure>"))
                                       @measures))
               "</section></score></mdiv></body></music></mei>")
     :pieces (vec (sort-by :t @placed))}))

(defn ->mei
  "Grand staff (treble and bass, split at middle C)."
  [s]
  (->mei* s [[1 (fn [n] (>= (:pitch n) 60)) "G" 2] [2 (fn [n] (< (:pitch n) 60)) "F" 4]] ""))

(defn ->mei-voice
  "A single voice on one staff, with treble or bass clef according to its mean register."
  [s pre]
  (let [as (map :pitch (vals (:events s)))
        low? (and (seq as) (< (/ (reduce + as) (count as)) 57))]
    (->mei* s [[1 (constantly true) (if low? "F" "G") (if low? 4 2)]] pre)))

;; ───────── notation: time ⇄ space relation from the drawn notation ─────────
;; After drawing, each piece (note or rest) with its beat is located on the page: those
;; anchors {:t :x :y0 :y1 :right} (built by the page) map time to position (cursor).

(defn t->pos [as t]
  (when (seq as)
    (let [a (last (filter (fn [x] (<= (:t x) t)) as))
          b (first (filter (fn [x] (> (:t x) t)) as))]
      (cond
        (nil? a) (first as)
        (nil? b) a
        :else
        (let [f (/ (- t (:t a)) (- (:t b) (:t a)))]
          (if (< (js/Math.abs (- (:y0 a) (:y0 b))) 2)
            (assoc a :x (+ (:x a) (* f (- (:x b) (:x a)))))
            (assoc a :x (+ (:x a) (* f (- (- (:right a) 8) (:x a)))))))))))
