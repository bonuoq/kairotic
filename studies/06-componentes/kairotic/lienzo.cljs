;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · lienzo
;; Un buffer gráfico: frecuencia sobre tiempo. No suena ni avanza por sí mismo; es solo una
;; representación que otros componentes leen (kairotic.motor, caja `lector`).
;;
;; datos: {:trazos {:t1 {:pts [[t hz] ...]}}
;;         :rx {:paso 0.25 :ciclos [4]}                       ; rejilla X (opcional)
;;         :ry {:nombre "12-tet" :cents [100 ... 1200] :ref 261.63}}  ; rejilla Y = afinación (opcional)
;; El tiempo va en unidades abstractas: su sentido lo da quien lee.
;; Entre dos puntos de un trazo la frecuencia se interpola en escala logarítmica (altura).

(ns kairotic.lienzo
  (:require [clojure.string :as str]))

(def vacio {:trazos {} :rx nil :ry nil})

(defn num? [x] (and (number? x) (not (js/isNaN x)) (js/isFinite x)))
(defn redondear [x d] (let [k (js/Math.pow 10 d)] (/ (js/Math.round (* x k)) k)))
(defn log2 [x] (/ (js/Math.log x) (js/Math.log 2)))

(defn hz->cents [hz ref] (* 1200 (log2 (/ hz ref))))
(defn cents->hz [c ref] (* ref (js/Math.pow 2 (/ c 1200))))
(defn midi->hz [m] (* 440 (js/Math.pow 2 (/ (- m 69) 12))))
(defn hz->midi [hz] (+ 69 (* 12 (log2 (/ hz 440)))))

(def nombres ["C" "C#" "D" "D#" "E" "F" "F#" "G" "G#" "A" "A#" "B"])
(defn nombre-midi [m] (str (nth nombres (mod m 12)) (dec (js/Math.floor (/ m 12)))))

(defn fmt
  "Número corto para el código: sin ceros sobrantes."
  [x] (let [r (redondear x 3)] (if (= r (js/Math.round r)) (str (js/Math.round r)) (str r))))

;; ───────── afinaciones (rejilla Y) ─────────
;; Como en Scala: los grados en cents sobre la referencia, sin el 1/1, y el último es el periodo.

(defn ratio->cents [s]
  (let [[a b] (str/split (str/trim s) #"/")
        a (js/parseFloat a) b (if b (js/parseFloat b) 1)]
    (* 1200 (log2 (/ a b)))))

(defn edo [n periodo] (vec (for [k (range 1 (inc n))] (redondear (* k (/ periodo n)) 4))))

(def escalas
  {"12-tet" {:nombre "12-tet" :cents (edo 12 1200)}
   "24-tet" {:nombre "24-tet" :cents (edo 24 1200)}
   "19-tet" {:nombre "19-tet" :cents (edo 19 1200)}
   "31-tet" {:nombre "31-tet" :cents (edo 31 1200)}
   "justa-5" {:nombre "justa-5"
              :cents (mapv (fn [r] (redondear (ratio->cents r) 4))
                           ["16/15" "9/8" "6/5" "5/4" "4/3" "45/32" "3/2" "8/5" "5/3" "9/5" "15/8" "2/1"])}
   "pitagorica" {:nombre "pitagorica"
                 :cents (mapv (fn [r] (redondear (ratio->cents r) 4))
                              ["256/243" "9/8" "32/27" "81/64" "4/3" "729/512" "3/2" "128/81" "27/16" "16/9" "243/128" "2/1"])}
   "bohlen-pierce" {:nombre "bohlen-pierce" :cents (edo 13 1901.955)}})

(def ref-defecto 261.6256)

(defn parse-scl
  "Texto de un archivo .scl de Scala → {:nombre :cents}. Las líneas con ! son comentarios;
   la primera línea útil es la descripción, la segunda el número de grados; un valor con punto
   está en cents y uno sin punto es una razón (3/2) o un entero (2)."
  [txt]
  (let [ls (remove (fn [l] (str/starts-with? (str/trim l) "!")) (str/split-lines (str txt)))
        [desc nl & more] ls
        n (js/parseInt (str/trim (str nl)) 10)
        vals (take n (keep (fn [l] (let [w (first (str/split (str/trim l) #"\s+"))] (when (seq w) w))) more))
        cents (mapv (fn [v] (if (str/includes? v ".") (js/parseFloat v) (ratio->cents v))) vals)]
    (when (or (js/isNaN n) (zero? n) (not= n (count cents)) (some (fn [c] (not (num? c))) cents) (not (pos? (peek cents))))
      (throw (js/Error. "No es un .scl válido: hace falta descripción, número de grados y los grados (el último es el periodo).")))
    {:nombre (if (str/blank? desc) "scala" (str/trim desc)) :cents (mapv (fn [c] (redondear c 4)) cents)}))

(defn grados [ry] (vec (cons 0 (butlast (:cents ry)))))
(defn periodo [ry] (peek (:cents ry)))

(defn hz->grado
  "Índice del grado más cercano (0 = la referencia; puede ser negativo o pasar del periodo)."
  [ry hz]
  (let [gs (grados ry) m (count gs) P (periodo ry)
        c (hz->cents hz (:ref ry))
        k (js/Math.floor (/ c P))
        r (- c (* k P))
        cands (conj gs P)
        i (apply min-key (fn [i] (js/Math.abs (- (nth cands i) r))) (range (count cands)))]
    (+ (* k m) i)))

(defn grado->hz [ry n]
  (let [gs (grados ry) m (count gs)
        k (js/Math.floor (/ n m))
        i (- n (* k m))]
    (cents->hz (+ (* k (periodo ry)) (nth gs i)) (:ref ry))))

(defn cuantizar-f [ry hz] (if ry (grado->hz ry (hz->grado ry hz)) hz))

;; ───────── rejilla X ─────────

(defn ciclo [rx] (reduce + (or (seq (:ciclos rx)) [4])))
(defn paso-x [rx] (or (:paso rx) 0.25))
(defn cuantizar-t [rx t] (if rx (let [p (:paso rx)] (redondear (* p (js/Math.round (/ t p))) 6)) t))

(defn parse-ciclos
  "[4], 4, \"3+3+2\" o [3 3 2] → vector de duraciones de grupo (en unidades de tiempo)."
  [x]
  (cond (num? x) [x]
        (string? x) (vec (keep (fn [s] (let [n (js/parseFloat s)] (when (num? n) n))) (str/split x #"\+")))
        (sequential? x) (vec (filter num? x))
        :else []))

;; ───────── modelo ─────────

(defn sane-pts [pts]
  (when (sequential? pts)
    (let [ps (->> pts
                  (filter (fn [p] (and (sequential? p) (= 2 (count p)) (num? (first p)) (num? (second p))
                                       (>= (first p) 0) (< 1 (second p) 30000))))
                  (map (fn [[t f]] [(redondear t 4) (redondear f 3)]))
                  (sort-by first)
                  vec)]
      (when (and (>= (count ps) 2) (> (first (peek ps)) (first (first ps)))) ps))))

(defn sane-rx [rx]
  (when (map? rx)
    (let [p (:paso rx) cs (filter (fn [c] (and (num? c) (pos? c))) (parse-ciclos (:ciclos rx)))]
      (when (and (num? p) (> p 0.001))
        {:paso p :ciclos (vec cs)}))))

(defn sane-ry [ry]
  (when (map? ry)
    (let [cs (:cents ry) ref (:ref ry)]
      (when (and (sequential? cs) (seq cs) (every? num? cs) (pos? (peek (vec cs))) (< (count cs) 400))
        {:nombre (str (or (:nombre ry) "escala")) :cents (vec cs) :ref (if (and (num? ref) (< 1 ref 20000)) ref ref-defecto)}))))

(defn transformar [pts f] (sane-pts (mapv f pts)))

(defn step
  "Datos + evento → datos. Todo cambio en un lienzo pasa por aquí."
  [d [op & args]]
  (let [d (or d vacio)]
    (case op
      :trazo   (let [[id pts] args ps (sane-pts pts)]
                 (if (and (keyword? id) ps) (assoc-in d [:trazos id] {:pts ps}) d))
      :mover   (let [[id dt dc] args pts (get-in d [:trazos id :pts])]
                 (if (and pts (num? dt) (num? dc))
                   (let [dt (max dt (- (ffirst pts))) k (js/Math.pow 2 (/ dc 1200))]
                     (if-let [ps (transformar pts (fn [[t f]] [(+ t dt) (* f k)]))] (assoc-in d [:trazos id :pts] ps) d))
                   d))
      :estirar (let [[id k] args pts (get-in d [:trazos id :pts])]
                 (if (and pts (num? k) (pos? k))
                   (let [t0 (ffirst pts)]
                     (if-let [ps (transformar pts (fn [[t f]] [(+ t0 (* k (- t t0))) f]))] (assoc-in d [:trazos id :pts] ps) d))
                   d))
      :borrar  (update d :trazos dissoc (first args))
      :limpiar (assoc d :trazos {})
      :rejilla-x (assoc d :rx (sane-rx (first args)))
      :afinacion (assoc d :ry (sane-ry (first args)))
      :cargar  (let [[x] args]
                 (if (map? x)
                   {:trazos (into {} (for [[k t] (:trazos x) :let [ps (and (keyword? k) (map? t) (sane-pts (:pts t)))] :when ps] [k {:pts ps}]))
                    :rx (sane-rx (:rx x))
                    :ry (sane-ry (:ry x))}
                   d))
      d)))

(defn id-num [k] (let [m (re-matches #"t(\d+)" (name k))] (if m (js/parseInt (second m) 10) 1e9)))

(defn next-id [d]
  (let [ns-ids (keep (fn [k] (let [n (id-num k)] (when (< n 1e9) n))) (keys (:trazos d)))]
    (keyword (str "t" (inc (if (seq ns-ids) (apply max ns-ids) 0))))))

(defn ordenados [d] (sort-by (fn [[id t]] [(ffirst (:pts t)) (id-num id)]) (:trazos d)))

(defn fin [d] (reduce max 0 (map (fn [t] (first (peek (:pts t)))) (vals (:trazos d)))))

;; ───────── lectura ─────────

(defn valor-en
  "Frecuencia de un trazo en el instante t, o nil si el trazo no pasa por ahí (el final es abierto)."
  [pts t]
  (let [t0 (ffirst pts) t1 (first (peek pts))]
    (when (and (>= t t0) (< t t1))
      (loop [[[ta fa] & more] pts]
        (let [[tb fb] (first more)]
          (cond (nil? tb) fa
                (< t tb) (if (= tb ta) fb (* fa (js/Math.pow (/ fb fa) (/ (- t ta) (- tb ta)))))
                :else (recur more)))))))

(defn leer
  "Todo lo que suena en el instante t: [[id hz] ...] en orden de trazo."
  [d t]
  (vec (keep (fn [[id tr]] (when-let [f (valor-en (:pts tr) t)] [id f])) (ordenados d))))

;; ───────── geometría y dibujo ─────────

(def W 420)
(def H 200)
(def x0 40)

(defn rango [d]
  (let [ps (mapcat :pts (vals (:trazos d)))
        L (ciclo (:rx d))
        T0 (if (seq ps) (apply max (map first ps)) 0)
        T (* L (max 2 (inc (js/Math.ceil (/ T0 L)))))
        fs (map second ps)
        [lo hi] (if (seq fs) [(apply min fs) (apply max fs)] [220 880])
        clo (- (log2 lo) 0.3) chi (+ (log2 hi) 0.3)
        span (max 1.6 (- chi clo)) mid (/ (+ clo chi) 2)]
    {:T T :lf0 (- mid (/ span 2)) :lf1 (+ mid (/ span 2))}))

(defn geom [d hdr]
  (let [y0 (+ hdr 3)]
    (merge (rango d) {:x0 x0 :y0 y0 :w (- W x0 6) :h (- H y0 6)})))

(defn t->x [g t] (+ (:x0 g) (* (/ t (:T g)) (:w g))))
(defn x->t [g x] (* (:T g) (/ (- x (:x0 g)) (:w g))))
(defn f->y [g f] (+ (:y0 g) (* (/ (- (:lf1 g) (log2 f)) (- (:lf1 g) (:lf0 g))) (:h g))))
(defn y->f [g y] (js/Math.pow 2 (- (:lf1 g) (* (/ (- y (:y0 g)) (:h g)) (- (:lf1 g) (:lf0 g))))))

(defn lineas-x
  "[[t nivel etiqueta]]: nivel 0 = paso, 1 = grupo, 2 = inicio de ciclo."
  [rx g]
  (let [T (:T g) px-unidad (/ (:w g) T)]
    (if-not rx
      (for [t (range 0 (inc T))] [t (if (zero? (mod t 4)) 1 0) nil])
      (let [p (:paso rx) cs (or (seq (:ciclos rx)) [4]) L (reduce + cs)
            bounds (butlast (reductions + 0 cs))
            pasos (when (>= (* p px-unidad) 5)
                    (for [k (range 0 (inc (js/Math.floor (/ T p))))] [(* k p) 0 nil]))]
        (concat pasos
                (for [c (range 0 (inc (js/Math.floor (/ T L)))) b bounds :let [t (+ (* c L) b)] :when (<= t T)]
                  [t (if (zero? b) 2 1) (when (zero? b) (inc c))]))))))

(defn lineas-y
  "[[hz nivel etiqueta]] dentro del rango visible."
  [ry g]
  (let [f0 (js/Math.pow 2 (:lf0 g)) f1 (js/Math.pow 2 (:lf1 g))]
    (if-not ry
      (for [k (range (js/Math.ceil (log2 (/ f0 55))) (inc (js/Math.floor (log2 (/ f1 55)))))
            :let [f (* 55 (js/Math.pow 2 k))]]
        [f 1 (str (redondear f 1))])
      (let [m (count (grados ry)) a (hz->grado ry f0) b (hz->grado ry f1)
            denso? (> (/ (- b a) (max 1 (/ (:h g) 3.5))) 1)
            tet12? (= (:cents ry) (:cents (get escalas "12-tet")))]
        (for [n (range (dec a) (+ b 2))
              :let [f (grado->hz ry n) inicio? (zero? (mod n m))]
              :when (and (<= f0 f f1) (or inicio? (not denso?)))]
          [f (if inicio? 1 0)
           (when inicio?
             (if (and tet12? (< (js/Math.abs (- (:ref ry) ref-defecto)) 0.01))
               (nombre-midi (js/Math.round (hz->midi f)))
               (str (redondear f 1))))])))))

(defn camino [g pts]
  (str/join " " (map-indexed (fn [i [t f]] (str (if (zero? i) "M" "L") (redondear (t->x g t) 2) " " (redondear (f->y g f) 2))) pts)))

(defn svg
  "SVG del contenido de una caja lienzo. `idn` es el id de la caja (texto), `sel` el trazo elegido,
   `previas` {id pts} para dibujar un arrastre en curso y `nuevo` los puntos de un trazo que se está dibujando."
  [idn d g sel previas nuevo]
  (let [{:keys [x0 y0 w h]} g]
    (str "<rect class=\"lbg mus-body\" data-box=\"" idn "\" x=\"" x0 "\" y=\"" y0 "\" width=\"" w "\" height=\"" h "\"></rect>"
         "<svg x=\"0\" y=\"" y0 "\" width=\"" (+ x0 w) "\" height=\"" h "\" overflow=\"hidden\" pointer-events=\"none\">"
         "<g transform=\"translate(0," (- y0) ")\">"
         (apply str (for [[f nivel etq] (lineas-y (:ry d) g) :let [y (redondear (f->y g f) 2)]]
                      (str "<line class=\"lgy" nivel "\" x1=\"" x0 "\" x2=\"" (+ x0 w) "\" y1=\"" y "\" y2=\"" y "\"></line>"
                           (when etq (str "<text class=\"rlabel\" x=\"4\" y=\"" (+ y 3) "\">" etq "</text>")))))
         (apply str (for [[t nivel etq] (lineas-x (:rx d) g) :let [x (redondear (t->x g t) 2)]]
                      (str "<line class=\"lgx" nivel "\" x1=\"" x "\" x2=\"" x "\" y1=\"" y0 "\" y2=\"" (+ y0 h) "\"></line>"
                           (when etq (str "<text class=\"rlabel\" x=\"" (+ x 3) "\" y=\"" (+ y0 9) "\">" etq "</text>")))))
         "</g></svg>"
         (apply str (for [[id tr] (:trazos d)
                          :let [pts (or (get previas id) (:pts tr)) dd (camino g pts) idt (name id)]]
                      (str "<path class=\"trazo" (when (= sel id) " sel") "\" d=\"" dd "\"></path>"
                           "<path class=\"trazo-hit\" data-box=\"" idn "\" data-trazo=\"" idt "\" d=\"" dd "\"><title>"
                           idt " · " (fmt (ffirst pts)) "→" (fmt (first (peek pts))) " · " (fmt (second (first pts))) " Hz</title></path>")))
         (when (and nuevo (>= (count nuevo) 2))
           (str "<path class=\"trazo nuevo\" d=\"" (camino g nuevo) "\"></path>")))))

(defn resumen [d]
  (str (if-let [ry (:ry d)] (:nombre ry) "Hz continuos")
       " · " (if-let [rx (:rx d)] (str "paso " (fmt (:paso rx)) " · ciclo " (str/join "+" (map fmt (or (seq (:ciclos rx)) [4])))) "tiempo libre")
       " · " (count (:trazos d)) " trazos"))

;; ───────── proyecciones ─────────

(defn ->codigo
  "Líneas de código que reconstruyen el lienzo de la caja `id`."
  [id d]
  (concat
   (when-let [ry (:ry d)]
     (let [preset (some (fn [[k v]] (when (= (:cents v) (:cents ry)) k)) escalas)]
       [(str "(afinacion " id " " (if preset (pr-str preset) (pr-str {:nombre (:nombre ry) :cents (:cents ry)})) " " (fmt (:ref ry)) ")")]))
   (when-let [rx (:rx d)]
     [(str "(rejilla-x " id " " (fmt (:paso rx)) " " (pr-str (mapv (fn [c] (js/parseFloat (fmt c))) (:ciclos rx))) ")")])
   (for [[tid tr] (ordenados d)]
     (str "(trazo " id " " tid " [" (str/join " " (map (fn [[t f]] (str "[" (fmt t) " " (fmt f) "]")) (:pts tr))) "])"))))

(defn ->voz
  "Aproximación del lienzo como una voz de kairotic.partitura: cada trazo es una nota en el
   semitono más cercano a su primer punto; la desviación en cents y los glissandi se anotan."
  [d]
  (let [L (ciclo (:rx d))
        snap (fn [x] (/ (js/Math.round (* x 4)) 4))]
    {:tempo 90 :compas [(max 1 (js/Math.round L)) 4]
     :eventos (into {} (for [[id tr] (:trazos d)
                             :let [pts (:pts tr) [t0 f0] (first pts) [t1 f1] (peek pts)
                                   m (hz->midi f0) mr (js/Math.round m) dv (js/Math.round (* 100 (- m mr)))
                                   gl (let [c (* 1200 (log2 (/ f1 f0)))] (cond (> c 30) "↗" (< c -30) "↘" :else nil))
                                   txt (str (when (>= (js/Math.abs dv) 5) (str (when (pos? dv) "+") dv)) gl)]]
                         [id (cond-> {:t (snap t0) :altura (max 0 (min 127 mr)) :dur (max 0.25 (snap (- t1 t0)))}
                               (seq txt) (assoc :txt txt))]))}))

(defn simplificar
  "Ramer–Douglas–Peucker sobre puntos [x y] (en píxeles): deja los que se separan más de `eps`."
  [ps eps]
  (if (< (count ps) 3)
    (vec ps)
    (let [[ax ay] (first ps) [bx by] (peek ps)
          dx (- bx ax) dy (- by ay) L (max 1e-9 (js/Math.hypot dx dy))
          dist (fn [[x y]] (/ (js/Math.abs (- (* dy (- x ax)) (* dx (- y ay)))) L))
          [i dmax] (reduce (fn [[bi bd] i] (let [dd (dist (nth ps i))] (if (> dd bd) [i dd] [bi bd]))) [0 0] (range 1 (dec (count ps))))]
      (if (> dmax eps)
        (vec (concat (butlast (simplificar (subvec ps 0 (inc i)) eps)) (simplificar (subvec ps i) eps)))
        [(first ps) (peek ps)]))))
