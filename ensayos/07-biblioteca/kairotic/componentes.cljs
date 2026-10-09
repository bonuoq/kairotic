;; Kairotic · componentes
;; Cada clase de caja es un componente: un mapa de datos y funciones, registrado por nombre.
;; El patch, el motor y la proyección a código solo consultan este registro, así que añadir
;; una clase (del núcleo, de una biblioteca o escrita por quien usa el sistema) no toca nada más.
;;
;; {:clase    "rampa"                       la primera palabra del texto de la caja
;;  :doc      "…"  :uso "rampa desde hasta segundos [bucle]"
;;  :io       [2 1] | (fn [caja] [entradas salidas])     caja = {:text :args :data}
;;  :io-dinamico true                         sus puertos dependen de algo que se calcula (no se podan conexiones)
;;  :recibir  (fn [m] resultado)              mensajes; pura. m = {:estado :args :entrada :valor :at :data …}
;;                                            resultado = {:estado :salidas [[o v]] :luego [[at e v]] :efectos [[k x]] :vista v}
;;  :audio    {:crear    (fn [ac caja entorno] nodo)     nodo = {:entradas [[AudioNode i]] :salidas [[AudioNode o]] …}
;;             :efectos  {k (fn [nodo x at])}
;;             :clave    (fn [caja] x)       si cambia, el nodo se rehace
;;             :desechar (fn [nodo])}
;;  :datos    {:vacio x :step (fn [d ev]) :cargar (fn [x]) :codigo (fn [id d] líneas)}   datos con historia propia
;;  :vista    :texto | :lienzo | :score | :codigo | :numero | :msg | :bang
;;  :lenguaje "faust"                         para las cajas de código
;;  :lee-buffer true                          recibe en m el lienzo conectado a su entrada derecha
;;  :origen   :nucleo | :usuario}

(ns kairotic.componentes
  (:require [clojure.string :as str]
            [kairotic.lienzo :as lz]))

(defonce registro (atom {}))

(defn definir!
  "Registra (o reemplaza) un componente. Devuelve su nombre."
  [clase d]
  (swap! registro assoc clase (merge {:vista :texto :origen :nucleo :io [1 1]} d {:clase clase}))
  clase)

(defn de [clase] (get @registro clase))

;; ───────── texto de una caja ─────────

(defn klass [text] (first (str/split (str/trim (str text)) #"\s+")))

(defn token [s]
  (if (re-matches #"-?(\d+\.?\d*|\.\d+)(e-?\d+)?" s) (js/parseFloat s) (keyword s)))

(defn args-de [text] (mapv token (rest (remove str/blank? (str/split (str/trim (str text)) #"\s+")))))

(defn caja [b] {:text (:text b) :args (args-de (:text b)) :data (:data b)})

(defn io
  "Entradas y salidas de una caja (mapa con :text y, si tiene, :data)."
  [b]
  (let [d (de (klass (:text b))) x (:io d)]
    (cond (fn? x) (x (caja b)) (vector? x) x :else [1 1])))

(defn dinamico?
  "Puertos que no se deben podar: los calculados (una compilación) y los de clases que define la
   propia obra o que aún no existen, porque dependen de cuándo se evalúa su definición."
  [b]
  (let [d (de (klass (:text b)))]
    (boolean (or (nil? d) (:io-dinamico d) (= :obra (:origen d))))))

(defn datos-de [b] (:datos (de (klass (:text b)))))

;; ───────── utilidades para escribir componentes ─────────

(defn num-de [v] (cond (number? v) v (and (sequential? v) (number? (first v))) (first v) :else nil))
(defn mapear [f v] (cond (number? v) (f v) (sequential? v) (mapv (fn [x] (if (number? x) (f x) x)) v) :else v))
(defn r6 [x] (/ (js/Math.round (* x 1e6)) 1e6))
(defn tick? [v g] (and (vector? v) (= :tick (first v)) (or (nil? g) (= g (second v)))))
(def grano 0.01)

;; ───────── núcleo: mensajes ─────────

(defn arit [op]
  (fn [{:keys [estado args entrada valor]}]
    (let [b (if (some? estado) estado (or (num-de (first args)) 0))]
      (cond (= entrada 1) {:estado (or (num-de valor) b)}
            (or (number? valor) (sequential? valor)) {:estado b :salidas [[0 (mapear (fn [x] (op x b)) valor)]]}
            :else {:estado b}))))

(defn rampa [{:keys [estado args entrada valor at]}]
  (let [[a b s lp] args
        st (or estado {:gen 0 :a (or (num-de a) 0) :b (or (num-de b) 1) :s (max 0.01 (or (num-de s) 1))
                       :bucle (= lp :bucle) :on false})
        arrancar (fn [st a b s]
                   (let [g (inc (:gen st))]
                     {:estado (assoc st :gen g :a a :b b :s s :t0 at :on true)
                      :salidas [[0 a]] :vista a :luego [[(+ at grano) 0 [:tick g]]]}))]
    (cond
      (tick? valor nil)
      (if (and (:on st) (tick? valor (:gen st)))
        (let [u (/ (- at (:t0 st)) (:s st))]
          (cond
            (and (>= u 1) (:bucle st)) (arrancar st (:a st) (:b st) (:s st))
            (>= u 1) {:estado (assoc st :on false) :salidas [[0 (:b st)]] :vista (:b st)}
            :else (let [v (r6 (+ (:a st) (* u (- (:b st) (:a st)))))]
                    {:estado st :salidas [[0 v]] :vista v :luego [[(+ at grano) 0 [:tick (:gen st)]]]})))
        {:estado st})
      (= entrada 1) {:estado (assoc st :bucle (boolean (and (num-de valor) (not (zero? (num-de valor))))))}
      (= valor :bang) (arrancar st (:a st) (:b st) (:s st))
      (= valor :stop) {:estado (assoc st :on false :gen (inc (:gen st)))}
      (and (sequential? valor) (= 3 (count valor)) (every? number? valor))
      (let [[a b s] valor] (arrancar st a b (max 0.01 s)))
      (number? valor) {:estado (assoc st :on false :gen (inc (:gen st))) :salidas [[0 valor]] :vista valor}
      :else {:estado st})))

(defn metro [{:keys [estado args entrada valor at]}]
  (let [st (or estado {:on false :ms (max 5 (or (num-de (first args)) 500)) :gen 0})
        sig (fn [st] [[(+ at (/ (:ms st) 1000)) 0 [:tick (:gen st)]]])]
    (cond
      (tick? valor nil) (if (and (:on st) (tick? valor (:gen st)))
                          {:estado st :salidas [[0 :bang]] :vista :bang :luego (sig st)}
                          {:estado st})
      (= entrada 1) {:estado (assoc st :ms (max 5 (or (num-de valor) (:ms st))))}
      (or (= valor 0) (= valor :stop)) {:estado (assoc st :on false :gen (inc (:gen st)))}
      (or (= valor :bang) (number? valor) (= valor :start))
      (let [st (assoc st :on true :gen (inc (:gen st)))]
        {:estado st :salidas [[0 :bang]] :vista :bang :luego (sig st)})
      :else {:estado st})))

(defn contador [{:keys [estado args entrada valor]}]
  (let [[paso mx mn] args
        paso (or (num-de paso) 1) mn (or (num-de mn) 0) mx (num-de mx)
        v (if (some? estado) estado mn)]
    (cond
      (= entrada 1) {:estado (or (num-de valor) v)}
      (= valor :reset) {:estado mn}
      (or (= valor :bang) (number? valor))
      (let [nv (r6 (+ v paso)) nv (if (and mx (>= nv mx)) mn nv)]
        {:estado nv :salidas [[0 v]] :vista v})
      :else {:estado v})))

(defn numero [{:keys [estado args valor]}]
  (let [cur (if (some? estado) estado (or (num-de (first args)) 0))]
    (cond (= valor :bang) {:estado cur :salidas [[0 cur]] :vista cur}
          (num-de valor) (let [v (num-de valor)] {:estado v :salidas [[0 v]] :vista v})
          :else {:estado cur})))

(defn lector [{:keys [entrada valor buffer buffer-id]}]
  (if (and (zero? entrada) (num-de valor))
    (let [t (num-de valor) r (if buffer (lz/leer buffer t) [])]
      ;; como en Max, primero la salida de la derecha (ids) y luego la de la izquierda (frecuencias)
      {:salidas [[1 (mapv first r)] [0 (mapv second r)]] :vista {:t t :de buffer-id :n (count r)}})
    {}))

(defn lienzo [{:keys [entrada valor]}]
  (if (and (zero? entrada) (num-de valor))
    {:salidas [[0 (num-de valor)]] :vista {:t (num-de valor)}}
    {}))

(def datos-lienzo {:vacio lz/vacio :step lz/step :cargar (fn [x] (lz/step lz/vacio [:cargar x])) :codigo lz/->codigo})

(definir! "loadbang" {:doc "Manda un bang al poner el motor en marcha (▶)." :io [0 1] :recibir (fn [_] {:salidas [[0 :bang]]})})
(definir! "bang" {:doc "Un botón: al pulsarlo (o al recibir cualquier cosa) manda un bang." :io [1 1] :vista :bang
                  :recibir (fn [_] {:salidas [[0 :bang]] :vista :bang})})
(definir! "msg" {:doc "Mensaje: al pulsarlo manda su contenido (un valor, una lista o una palabra como stop)." :uso "msg 0 8 4"
                 :io [1 1] :vista :msg
                 :recibir (fn [{:keys [args]}] {:salidas [[0 (case (count args) 0 :bang 1 (first args) (vec args))]] :vista :bang})})
(definir! "numero" {:doc "Un número que se arrastra; lo manda al cambiar o al recibir un bang." :uso "numero [inicial]"
                    :io [1 1] :vista :numero :recibir numero})
(definir! "print" {:doc "Escribe en la REPL lo que recibe." :io [1 0] :recibir (fn [{:keys [valor]}] {:efectos [[:print valor]]})})
(definir! "mtof" {:doc "Altura MIDI → Hz (también listas)." :recibir (fn [{:keys [valor]}] (if (or (number? valor) (sequential? valor)) {:salidas [[0 (mapear lz/midi->hz valor)]]} {}))})
(definir! "ftom" {:doc "Hz → altura MIDI (también listas)." :recibir (fn [{:keys [valor]}] (if (or (number? valor) (sequential? valor)) {:salidas [[0 (mapear lz/hz->midi valor)]]} {}))})
(doseq [[nombre op] [["+" +] ["-" -] ["*" *] ["/" (fn [a b] (if (zero? b) 0 (/ a b)))]]]
  (definir! nombre {:doc (str "Aritmética: entrada izquierda " nombre " argumento (o lo último que llegó por la derecha); también listas.")
                    :uso (str nombre " n") :io [2 1] :recibir (arit op)}))
(definir! "metro" {:doc "Manda bangs periódicos: 1 o bang lo arranca, 0 o stop lo para." :uso "metro ms" :io [2 1] :recibir metro})
(definir! "contador" {:doc "Cada bang manda el valor y avanza un paso; vuelve al mínimo al llegar al máximo." :uso "contador paso [max] [min]" :io [2 1] :recibir contador})
(definir! "rampa" {:doc "Avance lineal: un bang (o [a b s]) recorre de a a b en s segundos; un número salta ahí." :uso "rampa a b s [bucle]" :io [2 1] :recibir rampa})
(definir! "lienzo" {:doc "Buffer gráfico de frecuencia sobre tiempo. Un número en la entrada (o un clic) sale por la izquierda; la salida derecha es el buffer para un lector."
                    :io [1 2] :vista :lienzo :recibir lienzo :datos datos-lienzo})
(definir! "score" {:doc "El mismo buffer que un lienzo, dibujado como partitura aproximada." :io [1 2] :vista :score :recibir lienzo :datos datos-lienzo})
(definir! "lector" {:doc "Lee el buffer conectado a su entrada derecha en la posición que llega por la izquierda: ids por la derecha y Hz por la izquierda."
                    :io [2 2] :recibir lector :lee-buffer true})
(doseq [[n io] [["estado" [1 1]] ["transicion" [2 1]] ["consigna" [1 0]] ["region" [1 1]]]]
  (definir! n {:doc "Clase de Kairotic sin semántica todavía." :io io}))

;; ───────── núcleo: audio ─────────

(defn voces!
  "synth~: cada id es una voz. Un id nuevo ataca, uno que sigue desliza su frecuencia hasta el nuevo
   valor en `at`, y uno que desaparece se apaga."
  [nodo pares at]
  (let [ac (.-context (:out nodo)) vs @(:voces nodo) nuevos (into {} pares)]
    (doseq [[vid {:keys [osc g]}] vs :when (not (contains? nuevos vid))]
      (.setTargetAtTime (.-gain g) 0 at 0.03)
      (.stop osc (+ at 0.4)))
    (reset! (:voces nodo)
            (into {}
                  (for [[vid hz] (take 16 pares)]
                    (if-let [v (get vs vid)]
                      (do (.linearRampToValueAtTime (.-frequency (:osc v)) hz at) [vid v])
                      (let [o (.createOscillator ac) g (.createGain ac)]
                        (set! (.-type o) "triangle")
                        (.setValueAtTime (.-frequency o) hz at)
                        (.setValueAtTime (.-gain g) 0 at)
                        (.linearRampToValueAtTime (.-gain g) 0.2 (+ at 0.015))
                        (.connect o g)
                        (.connect g (:out nodo))
                        (.start o at)
                        [vid {:osc o :g g}])))))))

(defn synth [{:keys [estado entrada valor]}]
  (cond
    (= entrada 1) {:estado (assoc estado :ids (if (sequential? valor) (vec valor) [valor]))}
    (number? valor) {:estado (dissoc estado :ids) :efectos [[:voces [[:v0 valor]]]]}
    (sequential? valor)
    (let [fs (filterv number? valor)
          ids (:ids estado)
          ids (if (= (count ids) (count fs)) ids (mapv (fn [i] (keyword (str "v" i))) (range (count fs))))]
      {:estado (dissoc estado :ids) :efectos [[:voces (mapv vector ids fs)]]})
    (= valor :stop) {:efectos [[:voces []]]}
    :else {}))

(definir! "synth~" {:doc "Sintetizador polifónico de onda triangular: frecuencias por la izquierda, ids de voz por la derecha."
                    :io [2 1] :recibir synth
                    :audio {:crear (fn [ac _ _] (let [out (.createGain ac)] (set! (.. out -gain -value) 0.3)
                                                  {:salidas [[out 0]] :out out :voces (atom {})}))
                            :efectos {:voces voces!}
                            :desechar (fn [nodo] (doseq [[_ v] @(:voces nodo)] (try (.stop (:osc v)) (catch :default _ nil))))}})
(definir! "osc~" {:doc "Oscilador sinusoidal; un número por la izquierda cambia su frecuencia." :uso "osc~ [hz]" :io [2 1]
                  :recibir (fn [{:keys [entrada valor]}] (if (and (zero? entrada) (num-de valor)) {:efectos [[:freq (num-de valor)]]} {}))
                  :audio {:crear (fn [ac c _] (let [o (.createOscillator ac) g (.createGain ac)]
                                                (set! (.. o -frequency -value) (or (num-de (first (:args c))) 440))
                                                (set! (.. g -gain -value) 0.15)
                                                (.connect o g) (.start o)
                                                {:osc o :salidas [[g 0]]}))
                          :efectos {:freq (fn [nodo x at] (.linearRampToValueAtTime (.-frequency (:osc nodo)) x at))}
                          :desechar (fn [nodo] (try (.stop (:osc nodo)) (catch :default _ nil)))}})
(definir! "gain~" {:doc "Ganancia: señal por la izquierda, factor por la derecha." :uso "gain~ [factor]" :io [2 1]
                   :recibir (fn [{:keys [entrada valor]}] (if (and (= 1 entrada) (num-de valor)) {:efectos [[:gain (num-de valor)]]} {}))
                   :audio {:crear (fn [ac c _] (let [g (.createGain ac)] (set! (.. g -gain -value) (or (num-de (first (:args c))) 0.5))
                                                 {:g g :entradas [[g 0]] :salidas [[g 0]]}))
                           :efectos {:gain (fn [nodo x at] (.setTargetAtTime (.-gain (:g nodo)) x at 0.01))}}})
(definir! "dac~" {:doc "Salida de audio (las dos entradas van a los altavoces)." :io [2 0]
                  :recibir (fn [_] {})
                  :audio {:crear (fn [_ _ entorno] {:entradas [[(:master entorno) 0] [(:master entorno) 0]] :salidas []})}})

(defn lista
  "Los componentes registrados: [[clase doc uso origen] …]."
  []
  (vec (for [[k d] (sort-by key @registro)] [k (:doc d) (:uso d) (:origen d)])))
