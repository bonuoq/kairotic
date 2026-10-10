;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · motor
;; Hace que el patch funcione sin saber nada de clases concretas: todo lo pregunta al registro de
;; componentes (kairotic.componentes). Encamina las salidas por las conexiones, guarda una cola de
;; mensajes futuros y lo procesa todo con un poco de antelación sobre el reloj del AudioContext, de
;; modo que los efectos sonoros se programan en el instante exacto (`at`).
;; Lo que está sonando vive en esta pestaña y no entra en la historia de la obra.

(ns kairotic.motor
  (:require [clojure.string :as str]
            [kairotic.componentes :as comp]
            [kairotic.lienzo :as lz]))

(defonce ctx* (atom nil))
(defn ctx [] (or @ctx* (reset! ctx* (js/AudioContext.))))
(defn ahora [] (.-currentTime (ctx)))

(defonce rt (atom {:on false :vistas {} :prints []}))

(def antelacion 0.12)

;; compatibilidad con quien ya usaba estas funciones desde el motor
(def klass comp/klass)
(def args-de comp/args-de)
(def num-de comp/num-de)

(defn def-de [p id] (comp/de (comp/klass (get-in p [:boxes id :text]))))
(defn audio? [p id] (boolean (:audio (def-de p id))))

(defn patch [] (if-let [f (:patch-fn @rt)] (f) {:boxes {} :lines []}))

;; ───────── audio ─────────

(defn desechar! [nodo]
  (try (when-let [f (get-in nodo [:def :audio :desechar])] (f nodo)) (catch :default e (js/console.error e)))
  (doseq [[n _] (:salidas nodo)] (try (.disconnect n) (catch :default _ nil))))

(defn firma [p]
  [(into (sorted-map)
         (for [[id b] (:boxes p) :let [d (comp/de (comp/klass (:text b)))] :when (:audio d)]
           [id [(:text b) (when-let [f (get-in d [:audio :clave])] (f (comp/caja b)))]]))
   (vec (filter (fn [[a _ b _]] (and (audio? p a) (audio? p b))) (:lines p)))])

(defn sincronizar!
  "Ajusta los nodos de audio al patch: crea los que faltan, retira los que sobran o cambiaron, rehace las conexiones."
  []
  (let [p (patch) [cajas lineas :as f] (firma p)]
    (when (not= f (:firma @rt))
      (doseq [[id nodo] (:nodos @rt) :when (not= (get cajas id) (:firma nodo))]
        (desechar! nodo)
        (swap! rt update :nodos dissoc id))
      (doseq [[id fi] cajas :when (not (get-in @rt [:nodos id]))]
        (let [b (get-in p [:boxes id]) d (comp/de (comp/klass (:text b)))]
          (try
            (when-let [nodo ((get-in d [:audio :crear]) (ctx) (comp/caja b) {:master (:master @rt)})]
              (swap! rt assoc-in [:nodos id] (assoc nodo :firma fi :def d)))
            (catch :default e (js/console.error "no se pudo crear el audio de" (str id) e)))))
      (doseq [[_ nodo] (:nodos @rt) [n _] (:salidas nodo)] (try (.disconnect n) (catch :default _ nil)))
      (doseq [[a o b i] lineas]
        (let [[sn so] (get-in @rt [:nodos a :salidas o]) [dn di] (get-in @rt [:nodos b :entradas i])]
          (when (and sn dn) (try (.connect sn dn so di) (catch :default e (js/console.error e))))))
      (swap! rt update :estados (fn [es] (into {} (filter (fn [[id _]] (get-in p [:boxes id])) es))))
      (swap! rt assoc :firma f))))

(defn efecto! [id [k x] at]
  (if (= k :print)
    (swap! rt update :prints (fn [ps] (conj (vec (take-last 200 ps)) [at x])))
    (when-let [nodo (get-in @rt [:nodos id])]
      (when-let [f (get-in nodo [:def :audio :efectos k])]
        (try (f nodo x at) (catch :default e (js/console.error e)))))))

;; ───────── mensajes ─────────

(defn buffer-de
  "El lienzo (o score) conectado a la entrada derecha de una caja: [id datos]."
  [p id]
  (some (fn [[a _ b i]]
          (when (and (= b id) (= i 1) (#{"lienzo" "score"} (comp/klass (get-in p [:boxes a :text]))))
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
      (let [d (comp/de (comp/klass (:text b)))]
        (when-let [f (:recibir d)]
          (let [[bid bdata] (when (:lee-buffer d) (buffer-de p id))
                r (try (f {:id id :estado (get-in @rt [:estados id]) :args (comp/args-de (:text b)) :data (:data b)
                           :entrada entrada :valor valor :at at :buffer bdata :buffer-id bid})
                       (catch :default e
                         {:efectos [[:print (str (comp/klass (:text b)) " " (name id) ": " (or (.-message e) e))]]}))]
            (when (map? r)
              (when (contains? r :estado) (swap! rt assoc-in [:estados id] (:estado r)))
              (when (contains? r :vista) (vista! id at (:vista r)))
              (doseq [e (:efectos r)] (efecto! id e at))
              (doseq [[at2 inl v] (:luego r)] (encolar! at2 id inl v))
              (doseq [[o v] (:salidas r)
                      [a oo bb ii] (:lines p)
                      :when (and (= a id) (= oo o))]
                (entregar! p bb ii v at)))))))))

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
      (let [master (.createGain ac) compr (.createDynamicsCompressor ac)]
        (set! (.. master -gain -value) 0.8)
        (.connect master compr)
        (.connect compr (.-destination ac))
        (swap! rt assoc :on true :patch-fn patch-fn :estados {} :nodos {} :cola [] :firma nil
               :master master :comp compr :prints [])
        (sincronizar!)
        (swap! rt assoc :timer (js/setInterval tick! 25))))
    (when loadbang?
      (let [p (patch) at (+ (ahora) 0.05)]
        (reset! cuenta 0)
        (doseq [[id b] (:boxes p) :when (= "loadbang" (comp/klass (:text b)))]
          (entregar! p id 0 :bang at))))))

(defn parar! []
  (when (:on @rt)
    (js/clearInterval (:timer @rt))
    (doseq [[_ nodo] (:nodos @rt)] (desechar! nodo))
    (try (.disconnect (:master @rt)) (catch :default _ nil))
    (swap! rt assoc :on false :cola [] :nodos {} :estados {} :firma nil)))

(defn inyectar!
  "Un gesto (o la REPL) manda un mensaje a una caja ahora mismo. Arranca el motor si hace falta."
  [patch-fn id entrada valor]
  (arrancar! patch-fn false)
  (sincronizar!)
  (reset! cuenta 0)
  (entregar! (patch) id entrada valor (+ (ahora) 0.03)))

(defn nodo [id] (get-in @rt [:nodos id]))

(defn sacar-prints!
  "Los print cuyo instante ya ha llegado (y los quita de la cola)."
  []
  (let [t (ahora) [ya luego] ((juxt filter remove) (fn [[at _]] (<= at t)) (:prints @rt))]
    (when (seq ya) (swap! rt assoc :prints (vec luego)))
    ya))
