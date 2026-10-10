;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · faust~
;; Una caja de código en Faust. El compilador oficial (faustwasm, WebAssembly) se descarga la
;; primera vez que hace falta; cada fuente se compila en esta pestaña y se ejecuta como AudioWorklet.
;; Las entradas y salidas de audio de la caja son las del `process` compilado; la entrada izquierda
;; también recibe mensajes para sus parámetros (hslider, nentry, button…):
;;   [:freq 440]  → el parámetro freq        (msg freq 440)
;;   440          → freq (o el primer parámetro si no hay freq)
;;   [440 660 …]  → freq = la primera, gate = 1 (lista vacía → gate = 0): así un lector toca un faust~

(ns kairotic.faust
  (:require [clojure.string :as str]
            [kairotic.componentes :as comp]
            [kairotic.codigo :as cod]))

(defonce carga (atom nil))

(defn cargar
  "Promesa del compilador: {F: el módulo faustwasm, compiler: FaustCompiler}."
  []
  (or @carga (reset! carga ((.-kairoticCargarFaust js/window)))))

(defn hash-texto [s]
  (let [h (reduce (fn [h c] (bit-or 0 (+ (* h 31) (.charCodeAt c 0)))) 7 (str s))]
    (.toString (js/Math.abs h) 36)))

(defn parametros
  "Recorre la descripción de interfaz de Faust y devuelve los controles de entrada."
  [ui]
  (vec (mapcat (fn walk [it]
                 (let [tipo (.-type it)]
                   (cond
                     (some? (.-items it)) (mapcat walk (array-seq (.-items it)))
                     (contains? #{"hslider" "vslider" "nentry" "button" "checkbox"} tipo)
                     [{:label (.-label it) :address (.-address it) :tipo tipo
                       :min (or (.-min it) 0) :max (or (.-max it) 1) :init (or (.-init it) 0) :step (or (.-step it) 0)}]
                     :else [])))
               (array-seq ui))))

(cod/registrar-lenguaje! "faust"
  (fn [fuente]
    (-> (cargar)
        (.then (fn [fx]
                 (let [F (.-F fx)
                       gen (js/Reflect.construct (.-FaustMonoDspGenerator F) #js [])
                       nombre (str "k" (hash-texto fuente))]
                   (-> (.compile gen (.-compiler fx) nombre fuente "-ftz 2")
                       (.then (fn [g]
                                (when (nil? g) (throw (js/Error. "Faust no pudo compilar esta fuente")))
                                (let [meta (js/JSON.parse (.. gen -factory -json))]
                                  {:valor gen
                                   :info {:nombre nombre :ins (.-inputs meta) :outs (.-outputs meta)
                                          :params (parametros (.-ui meta))}}))))))))))

(defn info [c] (:info (cod/compilado "faust" (get-in c [:data :fuente]))))

(defn buscar-param [nodo nombre]
  (let [ps (get-in nodo [:info :params])]
    (or (first (filter (fn [p] (= (:label p) nombre)) ps))
        (first (filter (fn [p] (str/ends-with? (:address p) (str "/" nombre))) ps)))))

(defn poner! [nodo p v at]
  (swap! (:valores nodo) assoc (:label p) v)
  (if-let [n @(:faust nodo)]
    (.setParamValue n (:address p) v (max at (.-currentTime (.-context n))))
    (swap! (:pend nodo) assoc (:address p) v)))

(defn param! [nodo [nombre v] at]
  (when-let [p (buscar-param nodo (name nombre))]
    (when (number? v) (poner! nodo p v at))))

(defn frecuencias! [nodo v at]
  (let [fs (if (number? v) [v] (filter number? v))
        pf (or (buscar-param nodo "freq") (when (number? v) (first (get-in nodo [:info :params]))))
        pg (buscar-param nodo "gate")]
    (if (seq fs)
      (do (when pf (poner! nodo pf (first fs) at))
          (when (and pg (sequential? v)) (poner! nodo pg 1 at)))
      (when pg (poner! nodo pg 0 at)))))

(defn crear [ac c _]
  (let [r (cod/compilado "faust" (get-in c [:data :fuente]))
        inf (:info r)
        ins (or (:ins inf) 0) outs (max 1 (or (:outs inf) 1))
        merger (when (pos? ins) (.createChannelMerger ac ins))
        splitter (.createChannelSplitter ac outs)
        nodo {:entradas (if merger (vec (for [i (range ins)] [merger i])) [])
              :salidas (vec (for [o (range outs)] [splitter o]))
              :merger merger :splitter splitter :info inf
              :faust (atom nil) :pend (atom {}) :vivo (atom true)
              :valores (atom (into {} (for [p (:params inf)] [(:label p) (:init p)])))}]
    (when (= :ok (:estado r))
      (-> (.createNode (:valor r) ac (:nombre inf))
          (.then (fn [n]
                   (when (and n @(:vivo nodo))
                     (when merger (.connect merger n))
                     (.connect n splitter)
                     (doseq [[a v] @(:pend nodo)] (.setParamValue n a v))
                     (reset! (:faust nodo) n))))
          (.catch (fn [e] (js/console.error "faust~" e)))))
    nodo))

(defn desechar [nodo]
  (reset! (:vivo nodo) false)
  (when-let [n @(:faust nodo)]
    (try (.disconnect n) (.destroy n) (catch :default _ nil))))

(def plantilla
  "import(\"stdfaust.lib\");
freq = hslider(\"freq\", 440, 40, 2000, 0.01);
gate = button(\"gate\");
corte = hslider(\"corte\", 2400, 200, 8000, 1);
process = os.sawtooth(freq) * en.adsr(0.01, 0.15, 0.6, 0.4, gate) * 0.25 : fi.lowpass(2, corte);")

(comp/definir! "faust~"
  {:doc "Caja de código Faust: se compila en la página y suena como AudioWorklet. Sus puertos de audio son los del process; la entrada izquierda también acepta parámetros ([:freq 440], una lista de Hz con gate)."
   :uso "faust~"
   :vista :codigo :lenguaje "faust" :datos cod/datos :plantilla plantilla
   :io-dinamico true
   :io (fn [c] (let [i (info c)] [(max 1 (or (:ins i) 0)) (max 1 (or (:outs i) 1))]))
   :parametros (fn [c] (:params (info c)))
   :recibir (fn [{:keys [entrada valor]}]
              (if (zero? entrada)
                (cond (and (vector? valor) (or (keyword? (first valor)) (string? (first valor)))) {:efectos [[:param valor]]}
                      (or (number? valor) (sequential? valor)) {:efectos [[:frecuencias valor]]}
                      :else {})
                {}))
   :audio {:crear crear :desechar desechar
           :clave (fn [c] [(get-in c [:data :fuente]) (:estado (cod/compilado "faust" (get-in c [:data :fuente])))])
           :efectos {:param param! :frecuencias frecuencias!}}})
