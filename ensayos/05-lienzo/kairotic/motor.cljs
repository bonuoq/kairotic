;; Kairotic · motor
;; Hace que el patch funcione. Cada clase de caja es una función pura:
;;   {:estado :args :entrada :valor :at ...} → {:estado :salidas [[salida valor]] :luego [[at entrada valor]]
;;                                               :efectos [[tipo dato]] :vista valor}
;; El motor encamina las salidas por las conexiones, guarda una cola de mensajes futuros y lo procesa
;; todo con un poco de antelación sobre el reloj del AudioContext, de modo que los efectos sonoros
;; se programan en el instante exacto (`at`) y no cuando llega el temporizador de JavaScript.
;; Lo que está sonando vive en esta pestaña y no entra en la historia de la obra.

(ns kairotic.motor
  (:require [clojure.string :as str]
            [kairotic.lienzo :as lz]))

(defonce ctx* (atom nil))
(defn ctx [] (or @ctx* (reset! ctx* (js/AudioContext.))))
(defn ahora [] (.-currentTime (ctx)))

(defonce rt (atom {:on false :vistas {} :prints []}))

(def antelacion 0.12)   ; segundos que se procesan por adelantado
(def grano 0.01)        ; resolución de rampa (s)

(defn klass [text] (first (str/split (str/trim (str text)) #"\s+")))

(defn token [s]
  (if (re-matches #"-?(\d+\.?\d*|\.\d+)(e-?\d+)?" s) (js/parseFloat s) (keyword s)))

(defn args-de [text] (mapv token (rest (remove str/blank? (str/split (str/trim (str text)) #"\s+")))))

(defn num-de [v] (cond (number? v) v (and (sequential? v) (number? (first v))) (first v) :else nil))
(defn mapear [f v] (cond (number? v) (f v) (sequential? v) (mapv (fn [x] (if (number? x) (f x) x)) v) :else v))
(defn r6 [x] (/ (js/Math.round (* x 1e6)) 1e6))
(defn tick? [v g] (and (vector? v) (= :tick (first v)) (or (nil? g) (= g (second v)))))

;; ───────── clases ─────────

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

(defn mensaje [{:keys [args]}]
  {:salidas [[0 (case (count args) 0 :bang 1 (first args) (vec args))]] :vista :bang})

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

(def clases
  {"loadbang" (fn [_] {:salidas [[0 :bang]]})
   "bang"     (fn [_] {:salidas [[0 :bang]] :vista :bang})
   "msg"      mensaje
   "numero"   numero
   "print"    (fn [{:keys [valor]}] {:efectos [[:print valor]]})
   "mtof"     (fn [{:keys [valor]}] (if (or (number? valor) (sequential? valor)) {:salidas [[0 (mapear lz/midi->hz valor)]]} {}))
   "ftom"     (fn [{:keys [valor]}] (if (or (number? valor) (sequential? valor)) {:salidas [[0 (mapear lz/hz->midi valor)]]} {}))
   "+" (arit +) "-" (arit -) "*" (arit *) "/" (arit (fn [a b] (if (zero? b) 0 (/ a b))))
   "metro"    metro
   "contador" contador
   "rampa"    rampa
   "lector"   lector
   "lienzo"   lienzo
   "score"    lienzo
   "synth~"   synth
   "osc~"     (fn [{:keys [entrada valor]}] (if (and (zero? entrada) (num-de valor)) {:efectos [[:freq (num-de valor)]]} {}))
   "gain~"    (fn [{:keys [entrada valor]}] (if (and (= 1 entrada) (num-de valor)) {:efectos [[:gain (num-de valor)]]} {}))
   "dac~"     (fn [_] {})})

;; ───────── audio ─────────

(defn audio? [cls] (contains? #{"synth~" "osc~" "gain~" "dac~"} cls))

(defn crear-nodo [cls args]
  (let [ac (ctx)]
    (case cls
      "synth~" (let [out (.createGain ac)] (set! (.. out -gain -value) 0.3) {:out out :voces {}})
      "osc~" (let [o (.createOscillator ac) g (.createGain ac)]
               (set! (.. o -frequency -value) (or (num-de (first args)) 440))
               (set! (.. g -gain -value) 0.15)
               (.connect o g) (.start o)
               {:osc o :out g})
      "gain~" (let [g (.createGain ac)] (set! (.. g -gain -value) (or (num-de (first args)) 0.5)) {:in g :out g})
      "dac~" {:in (:master @rt)}
      nil)))

(defn desechar! [nd]
  (try (when-let [o (:osc nd)] (.stop o)) (catch :default _ nil))
  (doseq [[_ v] (:voces nd)] (try (.stop (:osc v)) (catch :default _ nil)))
  (try (when-let [o (:out nd)] (.disconnect o)) (catch :default _ nil)))

(defn voces!
  "Un synth~ polifónico: cada id es una voz. Un id nuevo ataca, uno que sigue desliza su frecuencia
   hasta el nuevo valor en `at`, y uno que desaparece se apaga."
  [id pares at]
  (when-let [nd (get-in @rt [:nodos id])]
    (let [ac (ctx) vs (:voces nd) nuevos (into {} pares)]
      (doseq [[vid {:keys [osc g]}] vs :when (not (contains? nuevos vid))]
        (.setTargetAtTime (.-gain g) 0 at 0.03)
        (.stop osc (+ at 0.4)))
      (let [vs2 (into {}
                      (for [[vid hz] (take 16 pares)]
                        (if-let [v (get vs vid)]
                          (do (.linearRampToValueAtTime (.-frequency (:osc v)) hz at) [vid v])
                          (let [o (.createOscillator ac) g (.createGain ac)]
                            (set! (.-type o) "triangle")
                            (.setValueAtTime (.-frequency o) hz at)
                            (.setValueAtTime (.-gain g) 0 at)
                            (.linearRampToValueAtTime (.-gain g) 0.2 (+ at 0.015))
                            (.connect o g)
                            (.connect g (:out nd))
                            (.start o at)
                            [vid {:osc o :g g}]))))]
        (swap! rt assoc-in [:nodos id :voces] vs2)))))

(defn efecto! [id [k x] at]
  (case k
    :print (swap! rt update :prints (fn [ps] (conj (vec (take-last 200 ps)) [at x])))
    :voces (voces! id x at)
    :freq (when-let [o (get-in @rt [:nodos id :osc])] (.linearRampToValueAtTime (.-frequency o) x at))
    :gain (when-let [g (get-in @rt [:nodos id :in])] (.setTargetAtTime (.-gain g) x at 0.01))
    nil))

(defn patch [] (if-let [f (:patch-fn @rt)] (f) {:boxes {} :lines []}))

(defn firma [p]
  [(into (sorted-map) (for [[id b] (:boxes p) :when (audio? (klass (:text b)))] [id (:text b)]))
   (vec (filter (fn [[a _ b _]] (and (audio? (klass (get-in p [:boxes a :text]))) (audio? (klass (get-in p [:boxes b :text])))))
                (:lines p)))])

(defn sincronizar!
  "Ajusta los nodos de audio al patch actual: crea los que faltan, retira los que sobran y rehace las conexiones."
  []
  (let [p (patch) [cajas lineas :as f] (firma p)]
    (when (not= f (:firma @rt))
      (doseq [[id nd] (:nodos @rt) :when (not= (get cajas id) (:text nd))]
        (desechar! nd)
        (swap! rt update :nodos dissoc id))
      (doseq [[id text] cajas :when (not (get-in @rt [:nodos id]))]
        (when-let [nd (crear-nodo (klass text) (args-de text))]
          (swap! rt assoc-in [:nodos id] (assoc nd :text text))))
      (doseq [[_ nd] (:nodos @rt)] (when-let [o (:out nd)] (try (.disconnect o) (catch :default _ nil))))
      (doseq [[a _ b _] lineas]
        (let [o (get-in @rt [:nodos a :out]) i (get-in @rt [:nodos b :in])]
          (when (and o i) (.connect o i))))
      ;; las cajas cuyo texto cambió empiezan con estado nuevo
      (swap! rt update :estados (fn [es] (into {} (filter (fn [[id _]] (get-in p [:boxes id])) es))))
      (swap! rt assoc :firma f))))

;; ───────── mensajes ─────────

(defn buffer-de
  "El lienzo (o score) conectado a la entrada derecha de un lector: [id datos]."
  [p id]
  (some (fn [[a _ b i]]
          (when (and (= b id) (= i 1) (#{"lienzo" "score"} (klass (get-in p [:boxes a :text]))))
            [a (or (get-in p [:boxes a :data]) lz/vacio)]))
        (:lines p)))

(defn vista! [id at v]
  (swap! rt update-in [:vistas id] (fn [q] (conj (vec (take-last 31 q)) [at v]))))

(defn vista-en
  "Lo último que una caja mostró hasta el instante `t`: [at valor] o nil."
  [id t]
  (last (filter (fn [[at _]] (<= at t)) (get-in @rt [:vistas id]))))

(defn encolar! [at id entrada valor]
  (swap! rt update :cola (fn [q] (vec (sort-by first (conj (or q []) [at id entrada valor]))))))

(defonce cuenta (atom 0))

(defn entregar! [p id entrada valor at]
  (when (< (swap! cuenta inc) 20000)
    (when-let [b (get-in p [:boxes id])]
      (let [cls (klass (:text b))]
        (when-let [f (get clases cls)]
          (let [[bid bdata] (when (= cls "lector") (buffer-de p id))
                r (f {:id id :estado (get-in @rt [:estados id]) :args (args-de (:text b))
                      :entrada entrada :valor valor :at at :buffer bdata :buffer-id bid})]
            (when (contains? r :estado) (swap! rt assoc-in [:estados id] (:estado r)))
            (when (contains? r :vista) (vista! id at (:vista r)))
            (doseq [e (:efectos r)] (efecto! id e at))
            (doseq [[at2 inl v] (:luego r)] (encolar! at2 id inl v))
            (doseq [[o v] (:salidas r)
                    [a oo bb ii] (:lines p)
                    :when (and (= a id) (= oo o))]
              (entregar! p bb ii v at))))))))

(defn tick! []
  (when (:on @rt)
    (try
      (sincronizar!)
      (reset! cuenta 0)
      (let [limite (+ (ahora) antelacion) p (patch)]
        (loop []
          (let [e (first (:cola @rt))]
            (when (and e (<= (first e) limite) (< @cuenta 20000))
              (swap! rt update :cola (fn [q] (vec (rest q))))
              (let [[at id inl v] e] (entregar! p id inl v (max at (ahora))))
              (recur)))))
      (catch :default ex (js/console.error ex)))))

(defn en-marcha? [] (boolean (:on @rt)))

(defn arrancar!
  "Pone el motor en marcha (si no lo estaba). Con `loadbang?`, dispara las cajas loadbang."
  [patch-fn loadbang?]
  (let [ac (ctx)]
    (.resume ac)
    (when-not (:on @rt)
      (let [master (.createGain ac) comp (.createDynamicsCompressor ac)]
        (set! (.. master -gain -value) 0.8)
        (.connect master comp)
        (.connect comp (.-destination ac))
        (swap! rt assoc :on true :patch-fn patch-fn :estados {} :nodos {} :cola [] :firma nil
               :master master :comp comp :prints [])
        (sincronizar!)
        (swap! rt assoc :timer (js/setInterval tick! 25))))
    (when loadbang?
      (let [p (patch) at (+ (ahora) 0.05)]
        (reset! cuenta 0)
        (doseq [[id b] (:boxes p) :when (= "loadbang" (klass (:text b)))]
          (entregar! p id 0 :bang at))))))

(defn parar! []
  (when (:on @rt)
    (js/clearInterval (:timer @rt))
    (doseq [[_ nd] (:nodos @rt)] (desechar! nd))
    (try (.disconnect (:master @rt)) (catch :default _ nil))
    (swap! rt assoc :on false :cola [] :nodos {} :estados {} :firma nil)))

(defn inyectar!
  "Un gesto (o la REPL) manda un mensaje a una caja ahora mismo. Arranca el motor si hace falta."
  [patch-fn id entrada valor]
  (arrancar! patch-fn false)
  (reset! cuenta 0)
  (entregar! (patch) id entrada valor (+ (ahora) 0.03)))

(defn sacar-prints!
  "Los print cuyo instante ya ha llegado (y los quita de la cola)."
  []
  (let [t (ahora) [ya luego] ((juxt filter remove) (fn [[at _]] (<= at t)) (:prints @rt))]
    (when (seq ya) (swap! rt assoc :prints (vec luego)))
    ya))
