{:clase "deriva"
 :doc "Desafina cada frecuencia con un paseo aleatorio lento (en cents), distinto para cada voz."
 :uso "deriva [cents-max]"
 :io [2 2]
 :recibir (fn [{:keys [entrada valor estado args]}]
            (let [maximo (or (first (filter number? args)) 25)
                  st (or estado {:ids nil :c {}})]
              (cond
                ;; los ids llegan antes que las frecuencias (salida derecha del lector)
                (= entrada 1) {:estado (assoc st :ids valor) :salidas [[1 valor]]}
                (sequential? valor)
                (let [ids (or (:ids st) (range (count valor)))
                      c (into {} (for [i ids]
                                   [i (max (- maximo) (min maximo (+ (get (:c st) i 0) (- (* 4 (js/Math.random)) 2))))]))]
                  {:estado (assoc st :c c)
                   :salidas [[0 (mapv (fn [i f] (* f (js/Math.pow 2 (/ (get c i 0) 1200)))) ids valor)]]})
                :else {:estado st})))}
