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

;; ───────── sub-patches: the engine works on a flat patch ─────────
;; Every embedded `patch` box and every instance of an abstraction is replaced by its boxes, with
;; ids prefixed by the path (:b5 inside :b2 → :b2.b5). A line to port i of a sub-patch goes to its
;; i-th inlet box, and a line from port o comes from its o-th outlet box.

(def max-depth 8)

(defn flat-id
  "The id of box `id` of the sub-patch at `path` in the flat patch."
  [path id]
  (if (empty? path) id (keyword (str (str/join "." (map name path)) "." (name id)))))

(defn substitute
  "$1 $2 … in a box text → the words written after the class of the instance."
  [text words]
  (str/replace (str text) #"\$(\d)"
               (fn [[_ n]] (or (get words (dec (js/parseInt n 10))) "0"))))

(defn inner-patch
  "The patch inside a box: the data of an embedded `patch`, or the :patch of an abstraction with its
   $-arguments filled in. nil for any other box."
  [b]
  (let [k (comp/klass (:text b)) d (comp/lookup k)]
    (cond
      (= k "patch") (or (:data b) {:boxes {} :lines []})
      (map? (:patch d)) (let [words (vec (rest (str/split (str/trim (str (:text b))) #"\s+")))]
                          (update (:patch d) :boxes
                                  (fn [bs] (into {} (for [[id ib] bs] [id (update ib :text substitute words)])))))
      :else nil)))

(defn flatten-patch
  ([p] (flatten-patch p [] 0))
  ([p path depth]
   (let [subs (into {} (for [[id b] (:boxes p) :let [inner (when (< depth max-depth) (inner-patch b))] :when inner]
                         [id inner]))
         ports (into {} (for [[id inner] subs] [id (comp/patch-ports inner)]))
         flats (for [[id inner] subs] (flatten-patch inner (conj path id) (inc depth)))
         own (into {} (for [[id b] (:boxes p) :when (not (contains? subs id))] [(flat-id path id) b]))
         from (fn [a o] (if-let [pt (get ports a)]
                          (when-let [x (get (:outlets pt) o)] [(flat-id (conj path a) x) 0])
                          [(flat-id path a) o]))
         to (fn [b i] (if-let [pt (get ports b)]
                        (when-let [x (get (:inlets pt) i)] [(flat-id (conj path b) x) 0])
                        [(flat-id path b) i]))]
     {:boxes (apply merge own (map :boxes flats))
      :lines (vec (concat (keep (fn [[a o b i]] (let [s (from a o) t (to b i)] (when (and s t) (into s t)))) (:lines p))
                          (mapcat :lines flats)))})))

(defonce flat-cache (atom [nil nil]))

(defn flat
  "flatten-patch, remembered for the last patch (the engine asks for it on every tick)."
  [p]
  (let [[k v] @flat-cache]
    (if (identical? k p) v (let [f (flatten-patch p)] (reset! flat-cache [p f]) f))))

(defn patch [] (if-let [f (:patch-fn @rt)] (flat (f)) {:boxes {} :lines []}))

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
            ;; :create gets the box (text, args, data) with its id and its current state
            (when-let [node ((get-in d [:audio :create]) (ctx) (assoc (comp/box-info b) :id id :state (get-in @rt [:states id])) (:env @rt))]
              (swap! rt assoc-in [:nodes id] (assoc node :signature sig :def d)))
            (catch :default e (js/console.error "could not create the audio of" (str id) e)))))
      (doseq [[_ node] (:nodes @rt) [n _] (:outlets node)] (try (.disconnect n) (catch :default _ nil)))
      (doseq [[a o b i] lines]
        (let [[sn so] (get-in @rt [:nodes a :outlets o]) [dn di] (get-in @rt [:nodes b :inlets i])]
          ;; an inlet can also be an AudioParam (a frequency, a gain): the signal is added to its value
          (when (and sn dn) (try (if (instance? js/AudioParam dn) (.connect sn dn so) (.connect sn dn so di))
                                 (catch :default e (js/console.error e))))))
      ;; every node learns which of its inlets receive a signal (osc~ and gain~ then let it take over)
      (doseq [[id node] (:nodes @rt) :let [f (get-in node [:def :audio :wired])] :when f]
        (try (f node (set (keep (fn [[_ _ b i]] (when (= b id) i)) lines))) (catch :default e (js/console.error e))))
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
          (when (and (= b id) (= i 1) (#{"canvas" "freqt" "score"} (comp/klass (get-in p [:boxes a :text]))))
            [a (or (get-in p [:boxes a :data]) (:empty (comp/model-of (get-in p [:boxes a]))) cv/empty)]))
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

(defn feed!
  "Audio nodes that read a buffer (:audio :feed) get it again whenever it changes."
  []
  (let [p (patch)]
    (doseq [[id node] (:nodes @rt) :let [f (get-in node [:def :audio :feed])] :when (and f (:fed node))]
      (let [[_ data] (buffer-of p id)]
        (when-not (identical? data @(:fed node))
          (reset! (:fed node) data)
          (try (f node data) (catch :default e (js/console.error e))))))))

(defn tick! []
  (when (:on @rt)
    (try
      (sync!)
      (feed!)
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

;; ───────── output: one input per channel of the sound card ─────────
;; Every channel has its own mono input (dac~ 1 → channel 1); they meet in a merger, go through the
;; master gain and, in stereo, through a gentle compressor. The sound card's channels are used if it
;; has more than two.

(defn explicit! [node n interpretation]
  (set! (.-channelCount node) n)
  (set! (.-channelCountMode node) "explicit")
  (set! (.-channelInterpretation node) interpretation))

(defn output! [ac]
  (let [dest (.-destination ac)
        n (max 2 (min 32 (or (.-maxChannelCount dest) 2)))]
    (try (explicit! dest n "discrete") (catch :default _ nil))
    (let [n (or (.-channelCount dest) 2)
          merger (.createChannelMerger ac n)
          master (.createGain ac)
          silent (.createGain ac)
          ins (vec (for [i (range n)]
                     (let [g (.createGain ac)] (explicit! g 1 "speakers") (.connect g merger 0 i) g)))]
      (set! (.. master -gain -value) 0.8)
      (set! (.. silent -gain -value) 0)
      (explicit! master n "discrete")
      (.connect merger master)
      (if (= n 2)
        (let [c (.createDynamicsCompressor ac)] (.connect master c) (.connect c dest) {:master master :comp c :ins ins :n n :silent silent})
        (do (.connect master dest) {:master master :ins ins :n n :silent silent})))))

(defn start!
  "Starts the engine (if it was not running). With `loadbang?`, fires the loadbang boxes."
  [patch-fn loadbang?]
  (let [ac (ctx)]
    (.resume ac)
    (when-not (:on @rt)
      (let [{:keys [master] :as out} (output! ac)]
        (swap! rt assoc :on true :patch-fn patch-fn :states {} :nodes {} :queue [] :signature nil
               :master master :out out :prints []
               :env {:master master :channels (:n out) :silent (:silent out)
                     :channel (fn [i] (get (:ins out) i))})
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
