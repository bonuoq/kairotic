;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · figuras
;; La vista propia de un componente se describe con datos, no con HTML: una lista de figuras en
;; coordenadas de la caja (0,0 arriba a la izquierda). Así una clase escrita por cualquiera puede
;; dibujarse en el patch sin poder inyectar marcado en la página, y sigue su tema claro u oscuro.
;;
;;   [:rect    {:x :y :w :h :r}]
;;   [:circulo {:cx :cy :r}]
;;   [:linea   {:x1 :y1 :x2 :y2}]
;;   [:arco    {:cx :cy :r :desde :hasta}]          grados: 0 arriba, en sentido horario
;;   [:ruta    {:puntos [[x y] …] :cerrada true}]   una polilínea (una forma de onda, una envolvente…)
;;   [:texto   {:x :y :ancla :inicio|:medio|:fin :tam 11} "texto"]
;;
;; Todas aceptan :trazo y :relleno con un color de la paleta, y :grosor en píxeles.
;; Paleta: :tinta :suave :acento :kairos :fondo :rejilla (nil = sin trazo o sin relleno).
;; Los nil de la lista se ignoran, así que se puede escribir (when cond [:texto …]).

(ns kairotic.figuras
  (:require [clojure.string :as str]))

(def paleta #{:tinta :suave :acento :kairos :fondo :rejilla})
(def maximo 600)   ; figuras por caja

(defn esc [s]
  (-> (str s) (str/replace "&" "&amp;") (str/replace "<" "&lt;") (str/replace ">" "&gt;") (str/replace "\"" "&quot;")))

(defn n
  "Un número seguro para un atributo SVG (con dos decimales)."
  [x]
  (if (and (number? x) (js/isFinite x)) (/ (js/Math.round (* x 100)) 100) 0))

(defn clases [o trazo relleno]
  (let [t (if (contains? o :trazo) (:trazo o) trazo)
        r (if (contains? o :relleno) (:relleno o) relleno)]
    (str " class=\"fig" (when (paleta t) (str " t-" (name t))) (when (paleta r) (str " r-" (name r))) "\""
         (when (number? (:grosor o)) (str " stroke-width=\"" (n (max 0 (min 24 (:grosor o)))) "\"")))))

(defn polar
  "Punto a distancia r del centro, con el ángulo en grados (0 arriba, sentido horario)."
  [cx cy r a]
  (let [t (* a (/ js/Math.PI 180))]
    [(+ cx (* r (js/Math.sin t))) (- cy (* r (js/Math.cos t)))]))

(defn arco-d [cx cy r desde hasta]
  (let [span (- hasta desde)]
    (when (> (js/Math.abs span) 0.01)
      (if (>= (js/Math.abs span) 359.99)
        (str "M" (n (- cx r)) " " (n cy) "a" (n r) " " (n r) " 0 1 0 " (n (* 2 r)) " 0a" (n r) " " (n r) " 0 1 0 " (n (* -2 r)) " 0")
        (let [[x1 y1] (polar cx cy r desde) [x2 y2] (polar cx cy r hasta)]
          (str "M" (n x1) " " (n y1) "A" (n r) " " (n r) " 0 " (if (> (js/Math.abs span) 180) 1 0) " " (if (pos? span) 1 0)
               " " (n x2) " " (n y2)))))))

(defn figura [f]
  (if-not (and (vector? f) (keyword? (first f)))
    ""
    (let [[tipo o texto] f o (if (map? o) o {})]
      (case tipo
        :rect (str "<rect x=\"" (n (:x o)) "\" y=\"" (n (:y o)) "\" width=\"" (n (max 0 (:w o 0))) "\" height=\"" (n (max 0 (:h o 0)))
                   "\" rx=\"" (n (:r o 0)) "\"" (clases o :tinta nil) "></rect>")
        :circulo (str "<circle cx=\"" (n (:cx o)) "\" cy=\"" (n (:cy o)) "\" r=\"" (n (max 0 (:r o 0))) "\"" (clases o :tinta nil) "></circle>")
        :linea (str "<line x1=\"" (n (:x1 o)) "\" y1=\"" (n (:y1 o)) "\" x2=\"" (n (:x2 o)) "\" y2=\"" (n (:y2 o)) "\"" (clases o :tinta nil) "></line>")
        :arco (if-let [d (arco-d (n (:cx o)) (n (:cy o)) (n (:r o)) (n (:desde o 0)) (n (:hasta o 360)))]
                (str "<path d=\"" d "\"" (clases o :tinta nil) "></path>")
                "")
        :ruta (let [ps (filter (fn [p] (and (sequential? p) (= 2 (count p)))) (take 2000 (:puntos o)))]
                (if (< (count ps) 2)
                  ""
                  (str "<" (if (:cerrada o) "polygon" "polyline") " points=\""
                       (str/join " " (map (fn [[x y]] (str (n x) "," (n y))) ps)) "\"" (clases o :tinta nil) "></"
                       (if (:cerrada o) "polygon" "polyline") ">")))
        :texto (str "<text x=\"" (n (:x o)) "\" y=\"" (n (:y o)) "\" text-anchor=\""
                    (case (:ancla o) :medio "middle" :fin "end" "start") "\""
                    " font-size=\"" (n (max 7 (min 28 (or (:tam o) 11)))) "\"" (clases o nil :tinta) ">"
                    (esc (let [s (str texto)] (if (> (count s) 80) (subs s 0 80) s))) "</text>")
        ""))))

(defn svg
  "El SVG (como texto) de una lista de figuras."
  [figs]
  (if (sequential? figs)
    (apply str (map figura (take maximo (remove nil? figs))))
    ""))
