;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · biblioteca
;; Componentes que no vienen del núcleo. Tres niveles, con el mismo formato:
;;   1. en la obra:   una caja `componente` cuya fuente es la definición; viaja con la obra y su historia
;;   2. compartida:   la biblioteca de este espacio (base de datos del artefacto), para usar en otras obras
;;   3. publicada:    un paquete npm servido por jsDelivr, fijado por versión
;; Lo que se usa de 2 y 3 se copia en una caja `componente` de la obra: así cada obra es completa,
;; funciona sin conexión y suena igual aunque la biblioteca cambie después.
;;
;; Formato de un componente publicado (un módulo .mjs):
;;   export default { clase: "deriva", version: "1.0.0", autor: "…", doc: "…",
;;                    fuente: `{:clase "deriva" :io [1 1] :recibir (fn [m] …)}` };

(ns kairotic.biblioteca
  (:require [clojure.string :as str]
            [kairotic.componentes :as comp]
            [kairotic.codigo :as cod]))

(def plantilla
  "{:clase \"eco-msg\"
 :doc \"Devuelve lo que recibe (cámbialo por lo que quieras).\"
 :io [1 1]
 :recibir (fn [{:keys [entrada valor estado args at]}]
            ;; devuelve {:salidas [[salida valor]] :estado … :luego [[at entrada valor]]}
            {:salidas [[0 valor]]})}")

(defn validar
  "nil si la definición es válida; si no, el motivo."
  [m]
  (cond
    (not (map? m)) "la fuente de un componente es un mapa {:clase … :recibir …}"
    (not (and (string? (:clase m)) (re-matches #"[^\s()\[\]{}\"]+" (:clase m)))) "falta :clase (una palabra, p. ej. \"quinta\")"
    (= :nucleo (:origen (comp/de (:clase m)))) (str "«" (:clase m) "» es una clase del núcleo; usa otro nombre")
    (not (or (fn? (:recibir m)) (map? (:audio m)))) "falta :recibir (fn [m] …) o :audio"
    (and (contains? m :io) (not (or (fn? (:io m)) (and (vector? (:io m)) (= 2 (count (:io m))) (every? number? (:io m))))))
    ":io es [entradas salidas] o una función"
    :else nil))

;; el lenguaje de las cajas componente: ClojureScript que evalúa a un mapa de definición
(cod/registrar-lenguaje! "componente"
  (fn [fuente]
    (js/Promise.
     (fn [res rej]
       (if-not @cod/confianza
         (rej (js/Error. "sin ejecutar: esta obra es compartida; (confiar-scripts true) para evaluar sus componentes"))
         (try
           (let [m (js/scittle.core.eval_string (str "(do " fuente "\n)"))]
             (if-let [motivo (validar m)]
               (rej (js/Error. motivo))
               (let [io (:io m)]
                 (res {:valor m
                       :info {:clase (:clase m)
                              :resumen (str "define «" (:clase m) "»"
                                            (when (vector? io) (str " · " (first io) " ent · " (second io) " sal")))}}))))
           (catch :default e (rej e))))))))

(comp/definir! "componente"
  {:doc "Define una clase de caja dentro de la obra: su fuente es un mapa {:clase :doc :io :recibir …} con el mismo contrato que cualquier componente."
   :uso "componente"
   :vista :codigo :lenguaje "componente" :datos cod/datos :plantilla plantilla
   :io [0 0]})

;; ───────── el registro sigue a las definiciones de la obra ─────────

(defonce de-obra (atom {}))   ; clase → [id-caja definición]

(defn box-num [k] (let [m (re-matches #"b(\d+)" (name k))] (if m (js/parseInt (second m) 10) 1e9)))

(defn sincronizar!
  "Registra las clases que definen las cajas componente del patch (la de número más bajo gana si dos
   definen la misma) y retira las que ya no están. Devuelve true si el registro cambió."
  [patch]
  (let [defs (for [[id b] (sort-by (fn [[k _]] (box-num k)) (:boxes patch))
                   :when (= "componente" (comp/klass (:text b)))
                   :let [r (cod/compilado "componente" (get-in b [:data :fuente]))]
                   :when (= :ok (:estado r))]
               [(:clase (:valor r)) [id (:valor r)]])
        nuevas (reduce (fn [acc [c v]] (if (contains? acc c) acc (assoc acc c v))) {} defs)
        antes @de-obra]
    (when (not= nuevas antes)
      (doseq [[c _] antes :when (not (contains? nuevas c))]
        (when (= :obra (:origen (comp/de c))) (swap! comp/registro dissoc c)))
      (doseq [[c [id m]] nuevas :when (not= (get antes c) [id m])]
        (when-not (= :nucleo (:origen (comp/de c)))
          (comp/definir! c (merge (dissoc m :clase) {:origen :obra :desde id}))))
      (reset! de-obra nuevas)
      true)))

;; ───────── importar ─────────

(defn url-de
  "npm:paquete@versión/ruta → jsDelivr; una ruta relativa es un archivo de esta página."
  [s]
  (let [s (str/trim (str s))]
    (cond
      (str/starts-with? s "npm:") (str "https://cdn.jsdelivr.net/npm/" (subs s 4))
      :else s)))

(defn cabecera [{:keys [clase version autor]} origen]
  (str ";; " clase (when version (str " " version)) (when autor (str " · " autor)) "\n;; importado de " origen "\n"))

(defn importar
  "Promesa del componente publicado en `origen`: {:clase :version :autor :doc :fuente}."
  [origen]
  (-> ((.-kairoticImportar js/window) (url-de origen))
      (.then (fn [obj]
               (let [m (js->clj obj :keywordize-keys true)]
                 (when-not (and (map? m) (string? (:fuente m)))
                   (throw (js/Error. "ese módulo no exporta un componente {clase, fuente, …}")))
                 m)))))
