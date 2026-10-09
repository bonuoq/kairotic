;; Kairotic · componente de partitura
;; Una obra musical en el tiempo como datos EDN, con vistas intercambiables (piano roll,
;; notación con Verovio) y una relación tiempo ⇄ espacio para cada vista, al estilo de INScore.
;; El componente no guarda historia: recibe eventos y devuelve un estado nuevo (step).

(ns kairotic.partitura
  (:require [clojure.string :as str]))

;; ───────── modelo ─────────
;; {:tempo pulsos-por-minuto :compas [4 4] :eventos {:e1 {:t pulso :altura midi :dur pulsos}}}

(def vacia {:tempo 90 :compas [4 4] :eventos {}})

(defn snap [x] (/ (js/Math.round (* x 4)) 4))

(defn num? [x] (and (number? x) (not (js/isNaN x))))

(defn step
  "Estado + evento → estado. Todo cambio en la partitura pasa por aquí."
  [s [op & args]]
  (case op
    :nota     (let [[id t alt dur] args]
                (if (and (keyword? id) (num? t) (num? alt) (num? dur))
                  (assoc-in s [:eventos id] {:t (max 0 t) :altura (min 127 (max 0 alt)) :dur (max 0.25 dur)})
                  s))
    :mover    (let [[id t alt] args]
                (if (and (get-in s [:eventos id]) (num? t) (num? alt))
                  (update-in s [:eventos id] assoc :t (max 0 t) :altura (min 127 (max 0 alt)))
                  s))
    :duracion (let [[id d] args]
                (if (and (get-in s [:eventos id]) (num? d)) (assoc-in s [:eventos id :dur] (max 0.25 d)) s))
    :borrar   (update s :eventos dissoc (first args))
    :tempo    (let [[b] args] (if (and (num? b) (<= 20 b 300)) (assoc s :tempo b) s))
    :limpiar  (assoc s :eventos {})
    :cargar   (let [[x] args]
                (if (map? x)
                  (-> vacia
                      (merge (select-keys x [:tempo :compas]))
                      (assoc :eventos (into {} (for [[k e] (:eventos x)
                                                     :when (and (keyword? k) (map? e) (num? (:t e)) (num? (:altura e)) (num? (:dur e)))]
                                                 [k (select-keys e [:t :altura :dur])]))))
                  s))
    s))

(defn next-id [s]
  (let [nums (keep (fn [k] (let [m (re-matches #"e(\d+)" (name k))] (when m (js/parseInt (second m) 10))))
                   (keys (:eventos s)))]
    (keyword (str "e" (inc (if (seq nums) (apply max nums) 0))))))

(defn fin [s] (reduce max 0 (map (fn [e] (+ (:t e) (:dur e))) (vals (:eventos s)))))

(defn ordenados [s] (sort-by (fn [[_ e]] [(:t e) (- (:altura e))]) (:eventos s)))

;; ───────── alturas ─────────

(def pcs {"c" 0 "d" 2 "e" 4 "f" 5 "g" 7 "a" 9 "b" 11})
(def nombres ["C" "C#" "D" "D#" "E" "F" "F#" "G" "G#" "A" "A#" "B"])
(def sharp-names ["c" "c" "d" "d" "e" "f" "f" "g" "g" "a" "a" "b"])
(def sharp-acc [nil "s" nil "s" nil nil "s" nil "s" nil "s" nil])

(defn altura
  "60, \"c4\", \"f#3\", \"bb2\" → número MIDI (c4 = 60)."
  [x]
  (cond (num? x) x
        (keyword? x) (altura (name x))
        (string? x) (let [m (re-matches #"(?i)([a-g])(#|s|b)?(-?\d)" (str/trim x))]
                      (when m
                        (+ (* 12 (inc (js/parseInt (nth m 3) 10)))
                           (get pcs (str/lower-case (nth m 1)))
                           (case (nth m 2) "#" 1 "s" 1 "b" -1 0))))
        :else nil))

(defn nombre [m] (str (nth nombres (mod m 12)) (dec (js/Math.floor (/ m 12)))))

(defn parse-melodia
  "\"c4/1 d4/.5 r/1 c4+e4+g4/2\" → [[t altura dur] ...] a partir del pulso t0."
  [txt t0]
  (loop [toks (remove str/blank? (str/split (str/trim (str txt)) #"\s+")) t t0 out []]
    (if (empty? toks)
      out
      (let [[p d] (str/split (first toks) #"/")
            dur (if d (js/parseFloat d) 1)
            dur (if (js/isNaN dur) 1 dur)]
        (if (= (str/lower-case p) "r")
          (recur (rest toks) (+ t dur) out)
          (let [alts (map altura (str/split p #"\+"))]
            (when (some nil? alts) (throw (js/Error. (str "No entiendo la nota «" p "». Usa por ejemplo c4, f#3 o bb2."))))
            (recur (rest toks) (+ t dur) (into out (map (fn [a] [t a dur]) alts)))))))))

;; ───────── proyecciones de texto ─────────

(defn fmt [x] (if (= x (js/Math.round x)) (str (js/Math.round x)) (str x)))

(defn ->codigo [s]
  (str/join "\n"
            (concat [(str "(tempo " (:tempo s) ")")]
                    (for [[id e] (ordenados s)]
                      (str "(nota " id " " (fmt (:t e)) " " (:altura e) " " (fmt (:dur e)) ")   ; " (nombre (:altura e)))))))

(defn ->edn [s]
  (str "{:tempo " (:tempo s) " :compas " (pr-str (:compas s)) "\n :eventos\n {"
       (str/join "\n  " (for [[id e] (ordenados s)] (str id " " (pr-str e))))
       "}}"))

;; ───────── proyección a MEI (notación) ─────────
;; Cuadrícula de semicorcheas; dos pentagramas (sol y fa, separados en el do central);
;; una voz por pentagrama: notas que empiezan juntas forman acorde, una nota se corta cuando empieza la siguiente.
;; Cada elemento lleva un id propio (n-<evento>-<trozo>) para poder relacionar la notación con el modelo.

(def unit 0.25)
(defn slots [x] (js/Math.round (/ x unit)))
(def lens [[16 "1" 0] [12 "2" 1] [8 "2" 0] [6 "4" 1] [4 "4" 0] [3 "8" 1] [2 "8" 0] [1 "16" 0]])
(defn bar-slots [s] (let [[n d] (:compas s)] (* n (/ 4 d) 4)))

(defn segmentos [notas total]
  (let [grupos (vec (sort-by key (group-by :s notas)))
        starts (mapv key grupos)]
    (loop [i 0 cur 0 out []]
      (if (>= i (count grupos))
        (if (< cur total) (conj out {:s cur :e total :notas nil}) out)
        (let [[s g] (nth grupos i)
              nxt (get starts (inc i))
              e (min (apply min (map :e g)) (or nxt js/Infinity))
              e (max e (inc s))
              out (if (> s cur) (conj out {:s cur :e s :notas nil}) out)]
          (recur (inc i) (max cur e) (conj out {:s s :e e :notas (sort-by :alt g)})))))))

(defn trozos [s e bar]
  (loop [p s out []]
    (if (>= p e)
      out
      (let [room (- bar (mod p bar))
            remaining (- e p)
            [len du dots] (first (filter (fn [[l]] (<= l (min room remaining))) lens))]
        (recur (+ p len) (conj out {:p p :len len :dur du :dots dots}))))))

(defn nid [pre id k] (str "n-" pre (name id) "-" k))

(defn note-xml [pre n k durattr]
  (let [a (:alt n) pc (mod a 12)]
    (str "<note xml:id=\"" (nid pre (:id n) k) "\" pname=\"" (nth sharp-names pc) "\" oct=\"" (dec (js/Math.floor (/ a 12))) "\""
         (when-let [ac (nth sharp-acc pc)] (str " accid=\"" ac "\""))
         durattr "/>")))

(defn ->mei*
  "MEI de la obra. `staves` = [[n filtro forma-clave línea-clave] ...]; `pre` prefija los ids
   (para que varias partituras convivan en una página). Devuelve {:mei texto :piezas [{:id :t :ev :staff}]}."
  [s staves pre]
  (let [bar (bar-slots s)
        notas (for [[id e] (ordenados s)]
                (let [a (slots (:t e))]
                  {:id id :s a :e (max (inc a) (slots (+ (:t e) (:dur e)))) :alt (:altura e)}))
        nbars (max 2 (js/Math.ceil (/ (reduce max 0 (map :e notas)) bar)))
        total (* nbars bar)
        measures (atom (vec (repeat nbars {:ties []})))
        piezas (atom [])]
    (doseq [[st keep? _ _] staves]
      (doseq [[si seg] (map-indexed vector (segmentos (filter keep? notas) total))]
        (let [tz (trozos (:s seg) (:e seg) bar)]
          (doseq [[k tr] (map-indexed vector tz)]
            (let [m (quot (:p tr) bar)
                  durattr (str " dur=\"" (:dur tr) "\"" (when (pos? (:dots tr)) " dots=\"1\""))
                  t (* (:p tr) unit)
                  ns-seg (:notas seg)
                  xml (if (seq ns-seg)
                        (do
                          (doseq [n ns-seg]
                            (swap! piezas conj {:id (nid pre (:id n) k) :t t :ev (:id n) :staff st}))
                          (when (< (inc k) (count tz))
                            (swap! measures update-in [m :ties] into
                                   (for [n ns-seg]
                                     (str "<tie startid=\"#" (nid pre (:id n) k) "\" endid=\"#" (nid pre (:id n) (inc k)) "\"/>"))))
                          (if (= 1 (count ns-seg))
                            (note-xml pre (first ns-seg) k durattr)
                            (str "<chord xml:id=\"c-" pre st "-" si "-" k "\"" durattr ">"
                                 (apply str (map (fn [n] (note-xml pre n k "")) ns-seg))
                                 "</chord>")))
                        (let [rid (str "r-" pre st "-" si "-" k)]
                          (swap! piezas conj {:id rid :t t :ev nil :staff st})
                          (str "<rest xml:id=\"" rid "\"" durattr "/>")))]
              (swap! measures update-in [m st] (fnil conj []) xml))))))
    {:mei (str "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
               "<mei xmlns=\"http://www.music-encoding.org/ns/mei\" meiversion=\"5.0\">"
               "<meiHead><fileDesc><titleStmt><title>Kairotic</title></titleStmt><pubStmt/></fileDesc></meiHead>"
               "<music><body><mdiv><score>"
               "<scoreDef meter.count=\"" (first (:compas s)) "\" meter.unit=\"" (second (:compas s)) "\" key.sig=\"0\">"
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
     :piezas (vec (sort-by :t @piezas))}))

(defn ->mei
  "Gran pentagrama (sol y fa, separados en el do central)."
  [s]
  (->mei* s [[1 (fn [n] (>= (:alt n) 60)) "G" 2] [2 (fn [n] (< (:alt n) 60)) "F" 4]] ""))

(defn ->mei-voz
  "Una sola voz en un pentagrama, con clave de sol o de fa según su registro medio."
  [s pre]
  (let [as (map :altura (vals (:eventos s)))
        grave? (and (seq as) (< (/ (reduce + as) (count as)) 57))]
    (->mei* s [[1 (constantly true) (if grave? "F" "G") (if grave? 4 2)]] pre)))

;; ───────── piano roll: geometría y relación tiempo ⇄ espacio lineal ─────────

(def ppb 56)
(def rowh 11)
(def kbw 46)
(def ruler 22)
(def black? #{1 3 6 8 10})

(defn rango [s]
  (let [as (map :altura (vals (:eventos s)))]
    [(min 48 (if (seq as) (- (apply min as) 2) 48))
     (max 84 (if (seq as) (+ (apply max as) 2) 84))]))

(defn geom [s]
  (let [[lo hi] (rango s)
        bar (/ (bar-slots s) 4)
        beats (max (* 4 bar) (* bar (inc (js/Math.ceil (/ (fin s) bar)))))]
    {:lo lo :hi hi :bar bar :beats beats
     :w (+ kbw (* beats ppb) 1)
     :h (+ ruler (* (inc (- hi lo)) rowh) 1)}))

(defn t->x [g t] (+ kbw (* t ppb)))
(defn x->t [g x] (/ (- x kbw) ppb))
(defn alt->y [g a] (+ ruler (* (- (:hi g) a) rowh)))
(defn y->alt [g y] (- (:hi g) (js/Math.floor (/ (- y ruler) rowh))))

(defn pianoroll-svg
  "SVG del piano roll. `preview` = {id {:t :altura :dur}} para dibujar un arrastre en curso."
  [s g sel preview]
  (let [{:keys [lo hi beats w h bar]} g
        rows (for [a (range lo (inc hi))]
               (str "<rect class=\"row" (when (black? (mod a 12)) " blk") "\" x=\"" kbw "\" y=\"" (alt->y g a)
                    "\" width=\"" (- w kbw) "\" height=\"" rowh "\"></rect>"
                    "<rect class=\"key" (when (black? (mod a 12)) " blk") "\" x=\"0\" y=\"" (alt->y g a)
                    "\" width=\"" (- kbw 4) "\" height=\"" rowh "\"></rect>"))
        labels (for [a (range lo (inc hi)) :when (zero? (mod a 12))]
                 (str "<text class=\"klabel\" x=\"5\" y=\"" (+ (alt->y g a) rowh -2) "\">" (nombre a) "</text>"))
        lines (for [b (range 0 (inc beats))]
                (str "<line class=\"" (if (zero? (mod b bar)) "bar" "beat") "\" x1=\"" (t->x g b) "\" x2=\"" (t->x g b)
                     "\" y1=\"" ruler "\" y2=\"" h "\"></line>"))
        nums (for [b (range 0 beats bar)]
               (str "<text class=\"num\" x=\"" (+ (t->x g b) 4) "\" y=\"15\">" (inc (quot b bar)) "</text>"))
        notes (for [[id e] (:eventos s)]
                (let [{:keys [t altura dur]} (merge e (get preview id))]
                  (str "<rect class=\"nota" (when (= sel id) " sel") "\" data-id=\"" (name id) "\" x=\"" (t->x g t)
                       "\" y=\"" (+ (alt->y g altura) 1) "\" width=\"" (max 6 (- (* dur ppb) 2)) "\" height=\"" (- rowh 2)
                       "\" rx=\"2\"><title>" (nombre altura) " · pulso " (fmt t) " · " (fmt dur) "</title></rect>")))]
    (str "<rect class=\"ruler\" x=\"0\" y=\"0\" width=\"" w "\" height=\"" ruler "\"></rect>"
         (apply str rows) (apply str lines) (apply str labels) (apply str nums) (apply str notes)
         "<line id=\"pr-cursor\" class=\"cursor\" x1=\"" kbw "\" x2=\"" kbw "\" y1=\"0\" y2=\"" h "\"></line>")))

;; ───────── notación: relación tiempo ⇄ espacio a partir de la notación dibujada ─────────
;; Tras dibujar, cada pieza (nota o silencio) con su pulso se localiza en la página: esos
;; anclajes {t x y0 y1} permiten pasar de tiempo a posición (cursor) y de posición a tiempo (clic).

(defn anclas [container piezas]
  (let [cr (.getBoundingClientRect container)
        ox (- (.-scrollLeft container) (.-left cr))
        oy (- (.-scrollTop container) (.-top cr))
        raw (keep (fn [{:keys [id t]}]
                    (when-let [el (.querySelector container (str "#" id))]
                      (let [head (or (.querySelector el ".notehead") el)
                            r (.getBoundingClientRect head)
                            sys (or (.closest el ".system") el)
                            sr (.getBoundingClientRect sys)]
                        (when (pos? (.-width r))
                          {:t t
                           :x (+ (.-left r) ox)
                           :y0 (+ (.-top sr) oy -6)
                           :y1 (+ (.-bottom sr) oy 6)
                           :right (+ (.-right sr) ox)}))))
                  piezas)]
    ;; un anclaje por pulso: el más a la izquierda
    (->> raw
         (group-by :t)
         (map (fn [[_ as]] (apply min-key :x as)))
         (sort-by :t)
         vec)))

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

;; ───────── sonido ─────────

(defonce audio (atom nil))

(defn ctx []
  (or @audio (reset! audio (js/AudioContext.))))

(declare programar!)

(defn sonar!
  "Programa en Web Audio los eventos que empiezan desde el pulso t0. Devuelve el estado de reproducción."
  [s t0]
  (let [ac (ctx)
        _ (.resume ac)
        now (+ (.-currentTime ac) 0.08)
        spb (/ 60 (:tempo s))
        nodes (programar! s t0 now (:tempo s))]
    {:t0 t0 :at now :spb spb :nodes nodes :end (fin s)}))

(defn programar!
  "Programa los eventos de `s` desde el pulso t0, empezando en el instante `at` (segundos del
   AudioContext) y con el tempo dado. Varias voces programadas con el mismo `at` suenan sincronizadas."
  [s t0 at tempo]
  (let [ac (ctx)
        now at
        spb (/ 60 tempo)]
    (doall
               (for [[_ e] (:eventos s) :when (>= (:t e) t0)]
                 (let [st (+ now (* (- (:t e) t0) spb))
                       d (* (:dur e) spb)
                       f (* 440 (js/Math.pow 2 (/ (- (:altura e) 69) 12)))
                       o (.createOscillator ac)
                       gn (.createGain ac)]
                   (set! (.-type o) "triangle")
                   (.setValueAtTime (.-frequency o) f st)
                   (.setValueAtTime (.-gain gn) 0 st)
                   (.linearRampToValueAtTime (.-gain gn) 0.16 (+ st 0.012))
                   (.setTargetAtTime (.-gain gn) 0 (+ st (max 0.03 (- d 0.06))) 0.05)
                   (.connect o gn)
                   (.connect gn (.-destination ac))
                   (.start o st)
                   (.stop o (+ st d 0.4))
                   o)))))

(defn callar! [h]
  (doseq [o (:nodes h)] (try (.stop o) (catch :default _ nil))))

(defn pulso-actual [h]
  (+ (:t0 h) (/ (- (.-currentTime (ctx)) (:at h)) (:spb h))))
