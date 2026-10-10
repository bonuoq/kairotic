;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · engine
;; Makes the patch work without knowing anything about concrete classes: it asks everything of the
;; component registry (kairotic.components). It routes outlets along the lines, keeps a queue of
;; future messages and processes everything a little ahead of the AudioContext clock, so that
;; sound effects are scheduled at the exact instant (`at`).
;; What is sounding lives in this tab and does not enter the history of the work.

(ns kairotic.engine
  (:require [clojure.string :as str]
            [kairotic.components :as comp]
            [kairotic.canvas :as cv]))

(defonce ctx* (atom nil))
(defn ctx [] (or @ctx* (reset! ctx* (js/AudioContext.))))
(defn now [] (.-currentTime (ctx)))

(defonce rt (atom {:on false :shows {} :prints []}))

(def lookahead 0.12)

;; compatibility with code that already used these functions from the engine
(def klass comp/klass)
(def args-of comp/args-of)
(def num-of comp/num-of)

(defn def-of [p id] (comp/lookup (comp/klass (get-in p [:boxes id :text]))))
(defn audio? [p id] (boolean (:audio (def-of p id))))

(defn patch [] (if-let [f (:patch-fn @rt)] (f) {:boxes {} :lines []}))

;; ───────── audio ─────────

(defn dispose! [node]
  (try (when-let [f (get-in node [:def :audio :dispose])] (f node)) (catch :default e (js/console.error e)))
  (doseq [[n _] (:outlets node)] (try (.disconnect n) (catch :default _ nil))))

(defn signature [p]
  [(into (sorted-map)
         (for [[id b] (:boxes p) :let [d (comp/lookup (comp/klass (:text b)))] :when (:audio d)]
           [id [(:text b) (when-let [f (get-in d [:audio :key])] (f (comp/box-info b)))]]))
   (vec (filter (fn [[a _ b _]] (and (audio? p a) (audio? p b))) (:lines p)))])

(defn sync!
  "Fits the audio nodes to the patch: creates the missing ones, removes those left over or changed, redoes the connections."
  []
  (let [p (patch) [boxes lines :as s] (signature p)]
    (when (not= s (:signature @rt))
      (doseq [[id node] (:nodes @rt) :when (not= (get boxes id) (:signature node))]
        (dispose! node)
        (swap! rt update :nodes dissoc id))
      (doseq [[id sig] boxes :when (not (get-in @rt [:nodes id]))]
        (let [b (get-in p [:boxes id]) d (comp/lookup (comp/klass (:text b)))]
          (try
            (when-let [node ((get-in d [:audio :create]) (ctx) (comp/box-info b) {:master (:master @rt)})]
              (swap! rt assoc-in [:nodes id] (assoc node :signature sig :def d)))
            (catch :default e (js/console.error "could not create the audio of" (str id) e)))))
      (doseq [[_ node] (:nodes @rt) [n _] (:outlets node)] (try (.disconnect n) (catch :default _ nil)))
      (doseq [[a o b i] lines]
        (let [[sn so] (get-in @rt [:nodes a :outlets o]) [dn di] (get-in @rt [:nodes b :inlets i])]
          (when (and sn dn) (try (.connect sn dn so di) (catch :default e (js/console.error e))))))
      (swap! rt update :states (fn [ss] (into {} (filter (fn [[id _]] (get-in p [:boxes id])) ss))))
      (swap! rt assoc :signature s))))

(defn effect! [id [k x] at]
  (if (= k :print)
    (swap! rt update :prints (fn [ps] (conj (vec (take-last 200 ps)) [at x])))
    (when-let [node (get-in @rt [:nodes id])]
      (when-let [f (get-in node [:def :audio :effects k])]
        (try (f node x at) (catch :default e (js/console.error e)))))))

;; ───────── messages ─────────

(defn buffer-of
  "The canvas (or score) connected to the right inlet of a box: [id data]."
  [p id]
  (some (fn [[a _ b i]]
          (when (and (= b id) (= i 1) (#{"canvas" "score"} (comp/klass (get-in p [:boxes a :text]))))
            [a (or (get-in p [:boxes a :data]) cv/empty)]))
        (:lines p)))

(defn show! [id at v]
  (swap! rt update-in [:shows id] (fn [q] (conj (vec (take-last 31 q)) [at v]))))

(defn shown-at
  "The last thing a box showed up to instant `t`: [at value] or nil."
  [id t]
  (last (filter (fn [[at _]] (<= at t)) (get-in @rt [:shows id]))))

(defn enqueue! [at id inlet value]
  (swap! rt update :queue (fn [q] (vec (sort-by first (conj (or q []) [at id inlet value]))))))

(defonce counter (atom 0))

(defn deliver! [p id inlet value at]
  (when (< (swap! counter inc) 20000)
    (when-let [b (get-in p [:boxes id])]
      (let [d (comp/lookup (comp/klass (:text b)))]
        (when-let [f (:receive d)]
          (let [[bid bdata] (when (:reads-buffer d) (buffer-of p id))
                r (try (f {:id id :state (get-in @rt [:states id]) :args (comp/args-for d (:text b)) :data (:data b)
                           :inlet inlet :value value :at at :buffer bdata :buffer-id bid})
                       (catch :default e
                         {:effects [[:print (str (comp/klass (:text b)) " " (name id) ": " (or (.-message e) e))]]}))]
            (when (map? r)
              (when (contains? r :state) (swap! rt assoc-in [:states id] (:state r)))
              (when (contains? r :show) (show! id at (:show r)))
              (doseq [e (:effects r)] (effect! id e at))
              (doseq [[at2 inl v] (:later r)] (enqueue! at2 id inl v))
              (doseq [[o v] (:out r)
                      [a oo bb ii] (:lines p)
                      :when (and (= a id) (= oo o))]
                (deliver! p bb ii v at)))))))))

(defn tick! []
  (when (:on @rt)
    (try
      (sync!)
      (reset! counter 0)
      (let [limit (+ (now) lookahead) p (patch)]
        (loop []
          (let [e (first (:queue @rt))]
            (when (and e (<= (first e) limit) (< @counter 20000))
              (swap! rt update :queue (fn [q] (vec (rest q))))
              (let [[at id inl v] e] (deliver! p id inl v (max at (now))))
              (recur)))))
      (catch :default ex (js/console.error ex)))))

(defn running? [] (boolean (:on @rt)))

(defn start!
  "Starts the engine (if it was not running). With `loadbang?`, fires the loadbang boxes."
  [patch-fn loadbang?]
  (let [ac (ctx)]
    (.resume ac)
    (when-not (:on @rt)
      (let [master (.createGain ac) compr (.createDynamicsCompressor ac)]
        (set! (.. master -gain -value) 0.8)
        (.connect master compr)
        (.connect compr (.-destination ac))
        (swap! rt assoc :on true :patch-fn patch-fn :states {} :nodes {} :queue [] :signature nil
               :master master :comp compr :prints [])
        (sync!)
        (swap! rt assoc :timer (js/setInterval tick! 25))))
    (when loadbang?
      (let [p (patch) at (+ (now) 0.05)]
        (reset! counter 0)
        (doseq [[id b] (:boxes p) :when (= "loadbang" (comp/klass (:text b)))]
          (deliver! p id 0 :bang at))))))

(defn stop! []
  (when (:on @rt)
    (js/clearInterval (:timer @rt))
    (doseq [[_ node] (:nodes @rt)] (dispose! node))
    (try (.disconnect (:master @rt)) (catch :default _ nil))
    (swap! rt assoc :on false :queue [] :nodes {} :states {} :signature nil)))

(defn inject!
  "A gesture (or the REPL) sends a message to a box right now. Starts the engine if needed."
  [patch-fn id inlet value]
  (start! patch-fn false)
  (sync!)
  (reset! counter 0)
  (deliver! (patch) id inlet value (+ (now) 0.03)))

(defn node [id] (get-in @rt [:nodes id]))

(defn take-prints!
  "The prints whose instant has already arrived (and removes them from the queue)."
  []
  (let [t (now) [due later] ((juxt filter remove) (fn [[at _]] (<= at t)) (:prints @rt))]
    (when (seq due) (swap! rt assoc :prints (vec later)))
    due))
