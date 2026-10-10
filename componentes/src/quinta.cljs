{:clase "quinta"
 :licencia "MPL-2.0"
 :doc "Añade una quinta justa (3/2) sobre cada frecuencia, como voz propia."
 :uso "quinta"
 :io [2 2]
 :recibir (fn [{:keys [entrada valor estado]}]
            (if (= entrada 1)
              {:estado valor}
              (let [fs (filterv number? valor)
                    ids (if (= (count estado) (count fs)) estado (range (count fs)))
                    q (fn [i] (keyword (str (if (keyword? i) (name i) i) "-5")))]
                {:salidas [[1 (vec (concat ids (map q ids)))]
                           [0 (vec (concat fs (map (fn [f] (* f 1.5)) fs)))]]})))}
