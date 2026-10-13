;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · faust~
;; A Faust code box. The official compiler (faustwasm, WebAssembly) is downloaded the
;; first time it is needed; each source is compiled in this tab and runs as an AudioWorklet.
;; The box's audio inlets and outlets are those of the compiled `process`; the left inlet
;; also receives messages for its parameters (hslider, nentry, button…):
;;   [:freq 440]  → the freq parameter       (msg freq 440)
;;   440          → freq (or the first parameter if there is no freq)
;;   [440 660 …]  → freq = the first one, gate = 1 (empty list → gate = 0): this way a reader plays a faust~

(ns kairotic.faust
  (:refer-clojure :exclude [load])
  (:require [clojure.string :as str]
            [kairotic.components :as comp]
            [kairotic.code :as code]))

(defonce loading (atom nil))

(defn load
  "Promise of the compiler: {F: the faustwasm module, compiler: FaustCompiler}."
  []
  (or @loading (reset! loading ((.-kairoticLoadFaust js/window)))))

(defn hash-text [s]
  (let [h (reduce (fn [h c] (bit-or 0 (+ (* h 31) (.charCodeAt c 0)))) 7 (str s))]
    (.toString (js/Math.abs h) 36)))

(defn params-of
  "Walks Faust's interface description and returns the input controls."
  [ui]
  (vec (mapcat (fn walk [it]
                 (let [kind (.-type it)]
                   (cond
                     (some? (.-items it)) (mapcat walk (array-seq (.-items it)))
                     (contains? #{"hslider" "vslider" "nentry" "button" "checkbox"} kind)
                     [{:label (.-label it) :address (.-address it) :type kind
                       :min (or (.-min it) 0) :max (or (.-max it) 1) :init (or (.-init it) 0) :step (or (.-step it) 0)}]
                     :else [])))
               (array-seq ui))))

(code/register-language! "faust"
  (fn [source]
    (-> (load)
        (.then (fn [fx]
                 (let [F (.-F fx)
                       gen (js/Reflect.construct (.-FaustMonoDspGenerator F) #js [])
                       dsp-name (str "k" (hash-text source))]
                   (-> (.compile gen (.-compiler fx) dsp-name source "-ftz 2")
                       (.then (fn [g]
                                (when (nil? g) (throw (js/Error. "Faust could not compile this source")))
                                (let [meta (js/JSON.parse (.. gen -factory -json))]
                                  {:value gen
                                   :info {:name dsp-name :ins (.-inputs meta) :outs (.-outputs meta)
                                          :params (params-of (.-ui meta))
                                          :summary (str (.-inputs meta) " in · " (.-outputs meta) " out · " (count (params-of (.-ui meta))) " params")}}))))))))))

(defn info [c] (:info (code/compiled "faust" (get-in c [:data :source]))))

(defn find-param [node pname]
  (let [ps (get-in node [:info :params])]
    (or (first (filter (fn [p] (= (:label p) pname)) ps))
        (first (filter (fn [p] (str/ends-with? (:address p) (str "/" pname))) ps)))))

(defn set-param! [node p v at]
  (swap! (:values node) assoc (:label p) v)
  (if-let [n @(:faust node)]
    (.setParamValue n (:address p) v (max at (.-currentTime (.-context n))))
    (swap! (:pending node) assoc (:address p) v)))

(defn param! [node [pname v] at]
  (when-let [p (find-param node (name pname))]
    (when (number? v) (set-param! node p v at))))

(defn freqs! [node v at]
  (let [fs (if (number? v) [v] (filter number? v))
        pf (or (find-param node "freq") (when (number? v) (first (get-in node [:info :params]))))
        pg (find-param node "gate")]
    (if (seq fs)
      (do (when pf (set-param! node pf (first fs) at))
          (when (and pg (sequential? v)) (set-param! node pg 1 at)))
      (when pg (set-param! node pg 0 at)))))

(defn create [ac c _]
  (let [r (code/compiled "faust" (get-in c [:data :source]))
        inf (:info r)
        ins (or (:ins inf) 0) outs (max 1 (or (:outs inf) 1))
        merger (when (pos? ins) (.createChannelMerger ac ins))
        splitter (.createChannelSplitter ac outs)
        node {:inlets (if merger (vec (for [i (range ins)] [merger i])) [])
              :outlets (vec (for [o (range outs)] [splitter o]))
              :merger merger :splitter splitter :info inf
              :faust (atom nil) :pending (atom {}) :alive (atom true)
              :values (atom (into {} (for [p (:params inf)] [(:label p) (:init p)])))}]
    (when (= :ok (:status r))
      (-> (.createNode (:value r) ac (:name inf))
          (.then (fn [n]
                   (when (and n @(:alive node))
                     (when merger (.connect merger n))
                     (.connect n splitter)
                     (doseq [[a v] @(:pending node)] (.setParamValue n a v))
                     (reset! (:faust node) n))))
          (.catch (fn [e] (js/console.error "faust~" e)))))
    node))

(defn dispose [node]
  (reset! (:alive node) false)
  (when-let [n @(:faust node)]
    (try (.disconnect n) (.destroy n) (catch :default _ nil))))

(def template
  "import(\"stdfaust.lib\");
freq = hslider(\"freq\", 440, 40, 2000, 0.01);
gate = button(\"gate\");
cutoff = hslider(\"cutoff\", 2400, 200, 8000, 1);
process = os.sawtooth(freq) * en.adsr(0.01, 0.15, 0.6, 0.4, gate) * 0.25 : fi.lowpass(2, cutoff);")

(comp/define! "faust~"
  {:doc "Faust code box: compiled in the page and played as an AudioWorklet. Its audio ports are those of process; the left inlet also accepts parameters ([:freq 440], a list of Hz with gate)."
   :usage "faust~"
   :display :code :language "faust" :model code/model :template template
   :dynamic-io true
   :io (fn [c] (let [i (info c)] [(max 1 (or (:ins i) 0)) (max 1 (or (:outs i) 1))]))
   :params (fn [c] (:params (info c)))
   :receive (fn [{:keys [inlet value]}]
              (if (zero? inlet)
                (cond (and (vector? value) (or (keyword? (first value)) (string? (first value)))) {:effects [[:param value]]}
                      (or (number? value) (sequential? value)) {:effects [[:freqs value]]}
                      :else {})
                {}))
   :audio {:create create :dispose dispose
           :key (fn [c] [(get-in c [:data :source]) (:status (code/compiled "faust" (get-in c [:data :source])))])
           :effects {:param param! :freqs freqs!}}})
