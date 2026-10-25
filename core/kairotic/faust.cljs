;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · faust~
;; A Faust code box. The official compiler (faustwasm, WebAssembly) is downloaded the
;; first time it is needed; each source is compiled in this tab and runs as an AudioWorklet.
;; The box's audio inlets and outlets are those of the compiled `process`; the left inlet
;; also receives messages for its parameters (hslider, nentry, button…):
;;   [:freq 440]  → the freq parameter       (msg freq 440)
;;   440          → freq (or the first parameter if there is no freq)
;;   [440 660 …]  → freq = the first one, gate = 1 (empty list → gate = 0): this way a reader plays a faust~
;;
;; Polyphonic: a source that declares  declare options "[nvoices:8]";  (the Faust convention, as in the
;; Faust IDE) is compiled as voices, each with its freq, gain and gate, played by faustwasm's own
;; allocator (one AudioWorklet; a voice taken from the oldest when they run out), and an optional
;;   effect = …;  in the same source, applied once to the sum of the voices. Then, as synth~:
;;   [440 550 660] on the left · voice ids on the right (a keyboard, a reader, mt play): each id a voice;
;;   a new id starts a note, one that disappears releases it, one whose pitch changes plays it again ·
;;   a number: one voice · [:gain 0.5] the velocity of the next notes · :stop releases them all ·
;;   [:cutoff 1200] any other parameter, for every voice (or for the effect).
;; Notes are sent as MIDI pitches with decimals (its allocator turns them into Hz without rounding),
;; so any tuning sounds as written.

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

(defn poly-voices
  "The number of voices a source declares (declare options \"[nvoices:8]\"), or nil: then it is mono."
  [source]
  (when-let [[_ n] (re-find #"declare\s+options\s+\"[^\"]*\[\s*nvoices\s*:\s*(\d+)\s*\]" (str source))]
    (max 1 (min 64 (js/parseInt n 10)))))

;; the controls of a voice its allocator sets itself, note by note: not parameters of the box
(def voice-controls #{"freq" "gain" "gate" "key" "vel" "velocity"})

(defn voice-control? [p] (contains? voice-controls (last (str/split (str (:address p)) #"/"))))

(defn compile-mono [fx source dsp-name]
  (let [gen (js/Reflect.construct (.-FaustMonoDspGenerator (.-F fx)) #js [])]
    (-> (.compile gen (.-compiler fx) dsp-name source "-ftz 2")
        (.then (fn [g]
                 (when (nil? g) (throw (js/Error. "Faust could not compile this source")))
                 (let [meta (js/JSON.parse (.. gen -factory -json))]
                   {:value gen
                    :info {:name dsp-name :ins (.-inputs meta) :outs (.-outputs meta)
                           :params (params-of (.-ui meta))
                           :summary (str (.-inputs meta) " in · " (.-outputs meta) " out · " (count (params-of (.-ui meta))) " params")}}))))))

(defn compile-poly
  "Voices, and the effect if the source has one (faustwasm compiles `effect` from the same source)."
  [fx source dsp-name n]
  (let [gen (js/Reflect.construct (.-FaustPolyDspGenerator (.-F fx)) #js [])]
    (-> (.compile gen (.-compiler fx) dsp-name source "-ftz 2")
        (.then (fn [g]
                 (when (or (nil? g) (nil? (.-voiceFactory gen))) (throw (js/Error. "Faust could not compile this source")))
                 (let [vm (js/JSON.parse (.. gen -voiceFactory -json))
                       em (some-> (.-effectFactory gen) .-json js/JSON.parse)
                       vps (params-of (.-ui vm))
                       ps (vec (concat (remove voice-control? vps) (when em (params-of (.-ui em)))))
                       outs (if em (.-outputs em) (.-outputs vm))]
                   (when-not (some (fn [p] (= "freq" (last (str/split (str (:address p)) #"/")))) vps)
                     (throw (js/Error. "a polyphonic voice needs a freq control (and gate, and gain for the velocity): freq = hslider(\"freq\", 440, 20, 20000, 0.01);")))
                   {:value gen
                    :info {:name dsp-name :poly n :effect (some? em) :ins (.-inputs vm) :outs outs :params ps
                           :summary (str n " voices" (when em " + effect") " · " outs " out · " (count ps) " params")}}))))))

(code/register-language! "faust"
  (fn [source]
    (-> (load)
        (.then (fn [fx]
                 (let [dsp-name (str "k" (hash-text source))]
                   (if-let [n (poly-voices source)]
                     (compile-poly fx source dsp-name n)
                     (compile-mono fx source dsp-name))))))))

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

;; ───── voices (polyphonic) ─────

(defn hz->pitch
  "A frequency as the MIDI pitch faustwasm's allocator takes (with decimals: it does not round)."
  [hz] (+ 69 (* 12 (/ (js/Math.log (/ hz 440)) (js/Math.log 2)))))

(defn voices!
  "Plays the voices {:pairs [[id hz] …] :vel 0…1}: an id that is new starts a note, one that is gone
   releases it, one whose pitch changed plays it again (one note per id, as synth~)."
  [node {:keys [pairs vel]} at]
  (if-let [n @(:faust node)]
    (let [t (max at (.-currentTime (.-context n)))
          old @(:voices node)
          incoming (into {} (for [[id hz] (take (* 2 (or (get-in node [:info :poly]) 8)) pairs)
                                  :when (and (number? hz) (pos? hz) (js/isFinite hz))]
                              [id (hz->pitch hz)]))
          v (js/Math.round (* 127 (max 0 (min 1 (if (number? vel) vel 0.8)))))]
      (doseq [[id p] old :when (not= p (get incoming id))] (.keyOff n 0 p 0 t))
      (doseq [[id p] incoming :when (not= p (get old id))] (.keyOn n 0 p (max 1 v) t))
      (reset! (:voices node) incoming))
    ;; the node is still being made: what it should play when it is ready
    (reset! (:want node) [{:pairs pairs :vel vel} at])))

(defn create [ac c _]
  (let [r (code/compiled "faust" (get-in c [:data :source]))
        inf (:info r)
        ins (or (:ins inf) 0) outs (max 1 (or (:outs inf) 1))
        merger (when (pos? ins) (.createChannelMerger ac ins))
        splitter (.createChannelSplitter ac outs)
        node {:inlets (if merger (vec (for [i (range ins)] [merger i])) [])
              :outlets (vec (for [o (range outs)] [splitter o]))
              :merger merger :splitter splitter :info inf
              :faust (atom nil) :pending (atom {}) :alive (atom true) :voices (atom {}) :want (atom nil)
              :values (atom (into {} (for [p (:params inf)] [(:label p) (:init p)])))}]
    (when (= :ok (:status r))
      (-> (if (:poly inf) (.createNode (:value r) ac (:poly inf) (:name inf)) (.createNode (:value r) ac (:name inf)))
          (.then (fn [n]
                   (when (and n @(:alive node))
                     (when merger (.connect merger n))
                     (.connect n splitter)
                     (doseq [[a v] @(:pending node)] (.setParamValue n a v))
                     (reset! (:faust node) n)
                     (when-let [[w at] @(:want node)] (reset! (:want node) nil) (voices! node w at)))))
          (.catch (fn [e] (js/console.error "faust~" e)))))
    node))

(defn dispose [node]
  (reset! (:alive node) false)
  (when-let [n @(:faust node)]
    (try (when (get-in node [:info :poly]) (.allNotesOff n true)) (.disconnect n) (.destroy n) (catch :default _ nil))))

(defn receive-poly
  "The messages of a polyphonic faust~ (see the header): as synth~, with ids on the right."
  [{:keys [state inlet value]}]
  (let [st (if (map? state) state {})
        vel (:vel st)
        play (fn [pairs] {:state (dissoc st :ids) :effects [[:voices {:pairs pairs :vel vel}]]})]
    (cond
      (= inlet 1) {:state (assoc st :ids (if (sequential? value) (vec value) [value]))}
      (not (zero? inlet)) {}
      (and (vector? value) (#{:gain :vel :velocity "gain" "vel" "velocity"} (first value)) (number? (second value)))
      (let [v (second value)] {:state (assoc st :vel (if (> v 1) (/ (min v 127) 127) (max 0 v)))})
      (and (vector? value) (or (keyword? (first value)) (string? (first value)))) {:effects [[:param value]]}
      (number? value) (play (if (pos? value) [[:v0 value]] []))
      (= value :stop) (play [])
      (sequential? value)
      (let [fs (filterv number? value)
            ids (:ids st)
            ids (if (= (count ids) (count fs)) ids (mapv (fn [i] (keyword (str "v" i))) (range (count fs))))]
        (play (mapv vector ids fs)))
      :else {})))

(def template
  "import(\"stdfaust.lib\");
freq = hslider(\"freq\", 440, 40, 2000, 0.01);
gate = button(\"gate\");
cutoff = hslider(\"cutoff\", 2400, 200, 8000, 1);
process = os.sawtooth(freq) * en.adsr(0.01, 0.15, 0.6, 0.4, gate) * 0.25 : fi.lowpass(2, cutoff);")

(comp/define! "faust~"
  {:doc "Faust code box: compiled in the page and played as an AudioWorklet. Its audio ports are those of process; the left inlet also accepts parameters ([:freq 440], a list of Hz with gate). With declare options \"[nvoices:8]\" it is polyphonic: Hz on the left and voice ids on the right, as synth~ (a keyboard, a reader, mt play), and an effect = …; for all of them."
   :usage "faust~"
   :display :code :language "faust" :model code/model :template template
   :dynamic-io true
   ;; polyphonic, a second inlet for the voice ids (as synth~)
   :io (fn [c] (let [i (info c)] [(max (if (:poly i) 2 1) (or (:ins i) 0)) (max 1 (or (:outs i) 1))]))
   :params (fn [c] (:params (info c)))
   :receive (fn [{:keys [inlet value data] :as m}]
              (cond
                (:poly (info {:data data})) (receive-poly m)
                (not (zero? inlet)) {}
                (and (vector? value) (or (keyword? (first value)) (string? (first value)))) {:effects [[:param value]]}
                (or (number? value) (sequential? value)) {:effects [[:freqs value]]}
                :else {}))
   :audio {:create create :dispose dispose
           :key (fn [c] [(get-in c [:data :source]) (:status (code/compiled "faust" (get-in c [:data :source])))])
           :effects {:param param! :freqs freqs! :voices voices!}}})
