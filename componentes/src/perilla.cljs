;; Un mando giratorio con vista propia en el patch: se dibuja con figuras y responde al arrastre.
(let [rango (fn [args]
              (let [[mn mx ini] (filter number? args)
                    mn (or mn 0) mx (or mx 1)]
                {:mn mn :mx mx :ini (or ini mn)
                 :log (boolean (and (some #{:log} args) (pos? mn) (pos? mx)))
                 :nombre (first (remove #{:log} (filter keyword? args)))}))
      ->u (fn [{:keys [mn mx log]} v]
            (let [u (cond (= mn mx) 0
                          log (/ (js/Math.log (/ v mn)) (js/Math.log (/ mx mn)))
                          :else (/ (- v mn) (- mx mn)))]
              (if (js/isFinite u) (max 0 (min 1 u)) 0)))
      redondo (fn [v]
                (let [a (js/Math.abs v)
                      e (cond (>= a 100) 1 (>= a 10) 10 (>= a 1) 100 :else 1000)]
                  (/ (js/Math.round (* v e)) e)))
      ->v (fn [{:keys [mn mx log]} u]
            (redondo (if log (* mn (js/Math.pow (/ mx mn) u)) (+ mn (* u (- mx mn))))))
      sacar (fn [r v] (if (:nombre r) [(:nombre r) v] v))]
  {:clase "perilla"
   :licencia "MPL-2.0"
   :doc "Mando giratorio: arrástralo hacia arriba o hacia abajo (⇧ para afinar). Manda su valor entre mín y máx; con log el recorrido es logarítmico (frecuencias) y con un nombre manda [:nombre valor] (p. ej. un parámetro de faust~). Un número lo coloca y lo reenvía; un bang lo reenvía."
   :uso "perilla [mín máx inicial] [log] [nombre]"
   :io [1 1]
   :tam [72 78]
   :recibir (fn [{:keys [estado args valor]}]
              (let [r (rango args)
                    cur (if (number? estado) estado (:ini r))
                    lim (fn [v] (max (min (:mn r) (:mx r)) (min (max (:mn r) (:mx r)) v)))]
                (cond
                  (number? valor) (let [v (lim valor)] {:estado v :salidas [[0 (sacar r v)]] :vista v})
                  (= valor :bang) {:estado cur :salidas [[0 (sacar r cur)]] :vista cur}
                  :else {:estado cur})))
   :gesto (fn [{:keys [inicio args dy fino]}]
            (let [r (rango args)
                  v0 (if (number? inicio) inicio (:ini r))]
              (->v r (max 0 (min 1 (- (->u r v0) (/ dy (if fino 800 160))))))))
   :dibujo (fn [{:keys [vista args w]}]
             (let [r (rango args)
                   v (if (number? vista) vista (:ini r))
                   u (->u r v)
                   cx (/ w 2) cy 33 rad 23
                   a (+ -135 (* 270 u))
                   p (fn [d] (let [t (* a (/ js/Math.PI 180))]
                               [(+ cx (* d (js/Math.sin t))) (- cy (* d (js/Math.cos t)))]))
                   [x1 y1] (p 5) [x2 y2] (p (- rad 6))]
               [[:arco {:cx cx :cy cy :r rad :desde -135 :hasta 135 :trazo :rejilla :grosor 5}]
                [:arco {:cx cx :cy cy :r rad :desde -135 :hasta a :trazo :acento :grosor 5}]
                [:circulo {:cx cx :cy cy :r (- rad 7) :trazo :suave :relleno :fondo}]
                [:linea {:x1 x1 :y1 y1 :x2 x2 :y2 y2 :trazo :tinta :grosor 2.5}]
                [:texto {:x cx :y 72 :ancla :medio :tam 11}
                 (str (when (:nombre r) (str (name (:nombre r)) " ")) (redondo v))]]))})
