;; Kairotic · cajas de código
;; La base de cualquier componente programable: una caja cuyo dato es un texto fuente en un
;; lenguaje. El texto forma parte de la obra (viaja por la historia y por las salas); cada pestaña
;; lo compila en local con el compilador registrado para su lenguaje, y guarda el resultado en
;; una caché por fuente. Faust y ClojureScript son los dos primeros lenguajes; otros (JavaScript,
;; GLSL, un lenguaje de reglas…) solo tienen que registrar su compilador y su componente.

(ns kairotic.codigo
  (:require [clojure.string :as str]
            [kairotic.componentes :as comp]))

;; ───────── datos (con historia) ─────────

(def vacio {:fuente ""})
(def max-fuente 20000)

(defn step [d [op & args]]
  (let [d (or d vacio)]
    (case op
      :fuente (let [[s] args] (if (string? s) (assoc d :fuente (subs s 0 (min (count s) max-fuente))) d))
      :cargar (let [[x] args] (if (and (map? x) (string? (:fuente x))) {:fuente (subs (:fuente x) 0 (min (count (:fuente x)) max-fuente))} d))
      d)))

(defn ->codigo [id d]
  (when (seq (str/trim (str (:fuente d))))
    [(str "(codigo " id " " (pr-str (:fuente d)) ")")]))

(def datos {:vacio vacio :step step :cargar (fn [x] (step vacio [:cargar x])) :codigo ->codigo})

;; ───────── compilación ─────────
;; compiladores: lenguaje → (fn [fuente] promesa de {:valor x :info {…}})

(defonce compiladores (atom {}))
(defonce cache (atom {}))          ; [lenguaje fuente] → {:estado :compilando|:ok|:error :error :valor :info :n}
(defonce oyentes (atom {}))        ; clave → (fn []) a quien avisar cuando termina una compilación
(defonce contador (atom 0))

(defn avisar! [] (doseq [[_ f] @oyentes] (try (f) (catch :default e (js/console.error e)))))

(defn registrar-lenguaje! [lenguaje f] (swap! compiladores assoc lenguaje f) lenguaje)

(defn podar! []
  (when (> (count @cache) 60)
    (swap! cache (fn [c] (into {} (take-last 40 (sort-by (fn [[_ v]] (:n v)) c)))))))

(defn compilado
  "Estado de compilación de una fuente; si no se ha pedido, la pide (y avisa al terminar)."
  [lenguaje fuente]
  (let [fuente (str fuente) k [lenguaje fuente]]
    (cond
      (str/blank? fuente) {:estado :vacio}
      (get @cache k) (get @cache k)
      :else
      (if-let [f (get @compiladores lenguaje)]
        (let [n (swap! contador inc)]
          (swap! cache assoc k {:estado :compilando :n n})
          (podar!)
          (-> (js/Promise.resolve nil)
              (.then (fn [_] (f fuente)))
              (.then (fn [r] (swap! cache assoc k (assoc r :estado :ok :n n)) (avisar!)))
              (.catch (fn [e] (swap! cache assoc k {:estado :error :n n :error (or (.-message e) (str e))}) (avisar!))))
          (get @cache k))
        {:estado :error :error (str "No hay compilador para " lenguaje)}))))

(defn olvidar-lenguaje! [lenguaje]
  (swap! cache (fn [c] (into {} (remove (fn [[[l _] _]] (= l lenguaje)) c)))))

;; ───────── script: ClojureScript dentro del patch ─────────
;; La fuente es una función (fn [m] …) con el mismo contrato que cualquier componente: recibe
;; {:entrada :valor :estado :args :at} y devuelve {:estado :salidas [[o v]] :luego … :efectos …}.
;; Un script ejecuta código de quien lo escribió dentro de esta página, así que en una sala
;; compartida no se evalúa hasta que esta pestaña lo permite: (confiar-scripts true).

(defonce confianza (atom false))

(registrar-lenguaje! "clojurescript"
  (fn [fuente]
    (js/Promise.
     (fn [res rej]
       (if-not @confianza
         (rej (js/Error. "sin ejecutar: esta obra es compartida; (confiar-scripts true) para evaluar sus scripts"))
         (try
           (let [f (js/scittle.core.eval_string (str "(do " fuente "\n)"))]
             (if (fn? f) (res {:valor f :info {:resumen "listo"}}) (rej (js/Error. "un script es una función (fn [m] …)"))))
           (catch :default e (rej e))))))))

(defn entero [x d] (if (number? x) (max 0 (js/Math.round x)) d))

(comp/definir! "script"
  {:doc "Caja de código ClojureScript: su fuente es una función (fn [m] …) que recibe y devuelve mensajes como cualquier componente."
   :uso "script [entradas] [salidas]"
   :vista :codigo :lenguaje "clojurescript" :datos datos
   :io (fn [c] (let [[i o] (:args c)] [(max 1 (entero i 1)) (entero o 1)]))
   :plantilla "(fn [{:keys [entrada valor estado]}]\n  ;; devuelve {:salidas [[salida valor]] :estado …}\n  {:salidas [[0 valor]]})"
   :recibir (fn [m]
              (let [r (compilado "clojurescript" (get-in m [:data :fuente]))]
                (if (= :ok (:estado r))
                  (try
                    (let [x ((:valor r) m)] (if (map? x) x {}))
                    (catch :default e {:efectos [[:print (str "script: " (or (.-message e) e))]]}))
                  {})))})
