;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · núcleo común
;; Utilidades compartidas por todos los ensayos: escapar texto, codificar EDN ⇄ JSON
;; sin evaluar nada, y la REPL donde cada gesto se escribe como código.

(ns kairotic.nucleo
  (:require [clojure.string :as str]))

(defn esc [s]
  (-> (str s)
      (str/replace "&" "&amp;")
      (str/replace "<" "&lt;")
      (str/replace ">" "&gt;")
      (str/replace "\"" "&quot;")))

;; ───────── EDN ⇄ JSON (para guardar en db) ─────────
;; Las palabras clave y los mapas se marcan para volver a EDN sin evaluar código ajeno.

(defn enc [x]
  (cond (keyword? x) {"k" (name x)}
        (map? x) {"m" (mapv (fn [[k v]] [(enc k) (enc v)]) x)}
        (sequential? x) (mapv enc x)
        :else x))

(defn dec* [x]
  (cond (map? x) (cond (contains? x "k") (keyword (str (get x "k")))
                       (contains? x "m") (into {} (for [kv (get x "m") :when (and (sequential? kv) (= 2 (count kv)))]
                                                    [(dec* (first kv)) (dec* (second kv))]))
                       :else nil)
        (sequential? x) (mapv dec* x)
        :else x))

;; ───────── evaluación ─────────
;; Todo el código de la REPL y de los gestos se evalúa en el espacio de nombres `user`,
;; donde cada página define sus comandos.

(defn eval-str [code]
  (js/scittle.core.eval_string (str "(in-ns 'user)\n" code)))

;; ───────── REPL ─────────

(defonce repl-state (atom {:out nil :hist [] :hidx nil}))

(defn repl-print! [cls html]
  (when-let [out (some-> (:out @repl-state) (js/document.getElementById))]
    (let [d (js/document.createElement "div")]
      (set! (.-className d) cls)
      (set! (.-innerHTML d) html)
      (.appendChild out d)
      (set! (.-scrollTop out) (.-scrollHeight out)))))

(defn repl-eval!
  "Evalúa código y lo muestra en la REPL. `source` es :repl (escrito) o :gesto (generado por la interfaz)."
  [code source]
  (repl-print! (str "in" (when (= source :gesto) " from-patch"))
               (str "<span class=\"p\">" (if (= source :gesto) "⟵" "λ") "</span>" (esc code)))
  (try
    (let [v (eval-str code)]
      (when (= source :repl) (repl-print! "out" (esc (pr-str v))))
      v)
    (catch :default e
      (repl-print! "err" (esc (or (.-message e) (str e))))
      nil)))

(defn gesture!
  "Un gesto de la interfaz se escribe como código y se evalúa: así interfaz y código son lo mismo."
  [code]
  (repl-eval! code :gesto))

(defn montar-repl!
  "Conecta una línea de entrada y un área de salida (por id) como REPL con historial ↑ ↓."
  [out-id in-id]
  (swap! repl-state assoc :out out-id)
  (let [inp (js/document.getElementById in-id)]
    (.addEventListener inp "keydown"
      (fn [e]
        (let [k (.-key e)]
          (cond
            (= k "Enter")
            (let [code (str/trim (.-value inp))]
              (when (seq code)
                (swap! repl-state (fn [s] (-> s (update :hist conj code) (assoc :hidx nil))))
                (set! (.-value inp) "")
                (repl-eval! code :repl)))
            (or (= k "ArrowUp") (= k "ArrowDown"))
            (let [{:keys [hist hidx]} @repl-state n (count hist)]
              (when (pos? n)
                (.preventDefault e)
                (let [i (if (= k "ArrowUp")
                          (if (nil? hidx) (dec n) (max 0 (dec hidx)))
                          (if (nil? hidx) nil (if (>= (inc hidx) n) nil (inc hidx))))]
                  (swap! repl-state assoc :hidx i)
                  (set! (.-value inp) (if (nil? i) "" (nth hist i))))))))))))
