;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · ring~ and writer~: a span of sound and the heads that write it (discussion "Heads on a span of time";
;; Studies 45 and 48). One AudioWorklet node per ring~ (kairotic/ringcore.mjs) holds the buffer and every head on
;; it: the writer~ and reader~ boxes connected to its right outlet take a slot of that node, so they share the
;; buffer and a feedback inside the ring is exact (a loop through other boxes costs a block, 128 samples).
;;
;;   ring~ [seconds]
;;     left: the sound written where its time is (its own write head, a tape head: the last seconds are kept;
;;           with nothing on its left it does not write, and the ring is what its writer~s write); :clear
;;     right outlet: the buffer, for reader~ and writer~ (on their right / middle inlet)
;;
;;   writer~ [ovr|mix [keep]] [jump s] [norm]
;;     left: the sound it writes; :rec t / :ovr t (from t at speed 1, replacing; rec erases the ring first);
;;           :stop holds it where it is
;;     middle: the ring~'s buffer
;;     right: a position signal (seconds, or 0…1 with norm; a phasor~); without one it writes where the ring's
;;            head is — ovr replaces what the ring writes there, mix adds to it
;;
;; reader~ on a ring~ (kairotic.signal): with a position signal on its left it reads there; without one it
;; follows the ring's head d behind, then its speed (reader~ d 1 speed 0.5; msg :d 2, :speed −1).

(ns kairotic.ringaudio
  (:require [kairotic.components :as comp]
            [kairotic.code :as code]))

(def slots 8)

(defonce modules (atom {}))

(defn ready
  "Promise that resolves when kairotic/ringcore.mjs is loaded as a worklet module in this AudioContext."
  [ac]
  (or (get @modules ac)
      (let [p (.addModule (.-audioWorklet ac) (.-href (js/URL. "kairotic/ringcore.mjs" (.-baseURI js/document))))]
        (swap! modules assoc ac p)
        p)))

(defn handle? [x] (and (map? x) (= ::ring (:kind x))))

(defn post!
  "A message to the ring's node, once it is there (in the order they were sent)."
  [h m]
  (when h (.then (:ready h) (fn [w] (when w (.postMessage (.-port w) (clj->js m)))))))

(defn attach!
  "A head takes a free slot of ring h: a promise of [worklet slot], or of nil when it is full or gone."
  [h opts]
  (.then (:ready h)
         (fn [w]
           (when (and w @(:alive h))
             (when-let [s (first (remove @(:used h) (range slots)))]
               (swap! (:used h) conj s)
               (post! h {:attach (assoc opts :slot s)})
               [w s])))))

(defn detach! [h s]
  (when (and h s)
    (swap! (:used h) disj s)
    (post! h {:detach s})))

(defn- after-word [args k] (let [x (second (drop-while #(not= k %) args))] (when (number? x) x)))

(defn head-args
  "What a reader~ or writer~ says about its head on a ring~: d, speed, jump, norm, ovr/mix, keep."
  [args]
  (cond-> {:norm (boolean (some #{:norm} args))}
    (after-word args :d) (assoc :d (after-word args :d))
    (after-word args :speed) (assoc :speed (after-word args :speed))
    (after-word args :jump) (assoc :jump (after-word args :jump))
    (some #{:mix} args) (assoc :write "mix" :keep (or (after-word args :mix) 1))))

(defn head-message
  "A message to a head (:d 2, :speed 0.5, :jump 1, :gain 0.5) as the change it makes, or nil."
  [v]
  (when (and (vector? v) (#{:d :speed :jump :gain :keep} (first v)) (number? (second v)))
    {(first v) (second v)}))

;; ───────── a box that is a head of a ring~ (its node: :ring the ring it is on, :slot its slot) ─────────

(defn hook!
  "Puts the head of box node on ring h (nil: on none): it leaves the slot it had, takes one on h, and wires
   its input (and, for a reader, the slot's output) there."
  [node h role]
  (let [{:keys [ring slot]} node]
    (when-let [[w s] @slot]
      (try (.disconnect (:m node) w) (catch :default _ nil))
      (when-let [o (:out node)] (try (.disconnect w o) (catch :default _ nil)))
      (detach! @ring s))
    (reset! slot nil) (reset! ring h)
    (when h
      (-> (attach! h (merge {:role role} @(:opts node)))
          (.then (fn [ws]
                   (when-let [[w s] ws]
                     (if (and @(:alive node) (= h @ring))
                       (do (reset! slot ws)
                           (.connect (:m node) w 0 (inc s))
                           (when-let [o (:out node)] (.connect w o s 0)))
                       (detach! h s)))))))))

(defn set-head!
  "Changes the head of box node (kept for when it is hooked again)."
  [node o]
  (swap! (:opts node) merge o)
  (when-let [[_ s] @(:slot node)] (post! @(:ring node) {:set (assoc o :slot s)})))

(defn unhook! "The box is gone: its head leaves the ring." [node] (reset! (:alive node) false) (hook! node nil nil))

;; ───────── ring~ ─────────

(comp/define! "ring~"
  {:doc "A span of sound: it keeps the last seconds (8 by default) of what reaches its left inlet, written where its time is, going round as a tape head. Its right outlet is the buffer for reader~ (d behind its head, then a speed: a canon, a delay, an octave down at 0.5, backwards at −1; or at a position signal) and for writer~ (more heads, anywhere, from any signal). Up to 8 heads share one node, so a feedback inside the ring is exact. :clear silences it."
   :usage "ring~ [seconds]"
   :license "MPL-2.0"
   :io [1 2]
   :size [124 30]
   :receive (fn [{:keys [value]}] (if (= value :clear) {:effects [[:clear true]]} {}))
   :derive (fn [{:keys [args]}] {:label (str "ring~ " (comp/nice (or (comp/num-of (first args)) 8)) " s")})
   :view [[:rect {:x 2 :y 2 :w 120 :h 26 :r 13 :stroke :grid :fill :bg}]
          [:text {:x 10 :y 19 :size 10 :fill :soft} :$label]]
   :audio {:create (fn [ac b _]
                     (let [len (or (comp/num-of (first (:args b))) 8)
                           in (.createGain ac)
                           w (atom nil) alive (atom true)
                           p (-> (ready ac)
                                 (.then (fn [_]
                                          (when @alive
                                            (let [n (js/AudioWorkletNode.
                                                     ac "kairotic-ring"
                                                     (clj->js {:numberOfInputs (inc slots) :numberOfOutputs slots
                                                               :outputChannelCount (vec (repeat slots 1))
                                                               :channelCount 2 :channelCountMode "explicit" :channelInterpretation "discrete"
                                                               :processorOptions {:len len :max 60 :slots slots}}))]
                                              (.connect in n 0 0)
                                              (reset! w n)
                                              n))))
                                 (.catch (fn [e] (js/console.error "ring~" e) nil)))]
                       {:in in :inlets [[in 0]] :outlets []
                        :ring {:kind ::ring :w w :ready p :used (atom #{}) :alive alive :len len}}))
           ;; with nothing on its left its own head does not write: the ring is only what its writer~s write
           :wired (fn [node ins] (post! (:ring node) {:own (contains? ins 0)}))
           :effects {:clear (fn [node _ _] (post! (:ring node) {:clear true}))}
           :dispose (fn [node]
                      (reset! (:alive (:ring node)) false)
                      (when-let [n @(:w (:ring node))] (try (.disconnect n) (catch :default _ nil)))
                      (try (.disconnect (:in node)) (catch :default _ nil)))}})

;; ───────── writer~ ─────────

(comp/define! "writer~"
  {:doc "A write head on a ring~: the sound on its left is written where it is, as a tape head — ovr (the default) replaces what is there, silence too; mix adds to it (mix 0.8: what was there fades a little at each pass). Its position: a signal on the right (seconds, or 0…1 with norm: a phasor~), any speed, either way — a jump larger than its jump is a seek; or, without one, the ring's head. :rec t / :ovr t send it to t, moving on at speed 1 (rec erases the ring first); :stop holds it. The ring~'s right outlet goes to its middle inlet."
   :usage "writer~ [ovr|mix [keep]] [jump s] [norm]"
   :license "MPL-2.0"
   :io [3 0]
   :reads-buffer true
   :receive (fn [{:keys [inlet value]}]
              (cond
                (not= inlet 0) {}
                (or (#{:rec :ovr} value) (and (vector? value) (#{:rec :ovr} (first value))))
                (let [[k t] (if (vector? value) value [value 0])] {:effects [[:cue {:kind (name k) :t (or (comp/num-of t) 0)}]]})
                (= value :stop) {:effects [[:cue {:kind "stop"}]]}
                (head-message value) {:effects [[:head (head-message value)]]}
                :else {}))
   :audio {:create (fn [ac b _]
                     (let [vin (.createGain ac) pin (.createGain ac) m (.createChannelMerger ac 2)]
                       (.connect vin m 0 0) (.connect pin m 0 1)
                       {:m m :inlets [[vin 0] nil [pin 0]] :outlets []
                        :fed (atom ::none) :ring (atom nil) :slot (atom nil) :alive (atom true) :folded (atom nil)
                        :opts (atom (merge {:mode "head"} (head-args (:args b))))}))
           ;; a position signal on the right: it writes there; without one, where the ring's head is
           :wired (fn [node ins] (set-head! node {:mode (if (contains? ins 2) "pos" "head")}))
           :feed (fn [node d] (hook! node (when (handle? d) d) "write"))
           :effects {:cue (fn [node x _]
                            (when-let [[_ s] @(:slot node)] (post! @(:ring node) {:cue (assoc x :slot s)})))
                     :head (fn [node x _] (set-head! node x))}
           :dispose unhook!}})

;; ───────── a faust~ in a loop of a ring~ runs inside it (Study 49) ─────────
;; reader~ → faust~ → writer~, all on one ring~: the faust~'s compiled bytes go to the ring's node, where they run
;; one sample at a time in the writer's slot, hearing those readers; the line from the faust~ to the writer~ is
;; taken away (what it would bring, a block late, is already written). The faust~ keeps its own node for whatever
;; else it is connected to (a dac~), and its parameters reach its copy in the ring as well. Every tick, after the
;; nodes are fed: a loop that appears is folded, one that is gone unfolded.

(defn loops
  "The faust~ boxes in a loop of a ring~: [{:faust id :ring id :readers [id …] :writers [id …]}]. Every input of
   the faust~ comes from a reader~ on the ring, and its output reaches the left inlet of a writer~ on the same ring."
  [p]
  (let [k (fn [id] (comp/klass (get-in p [:boxes id :text])))
        ring-of (fn [id] (some (fn [[a _ b i]] (when (and (= b id) (= i 1) (= "ring~" (k a))) a)) (:lines p)))]
    (vec (for [[f _] (:boxes p) :when (= "faust~" (k f))
               :let [ins (filter (fn [[_ _ b _]] (= b f)) (:lines p))
                     rs (vec (distinct (map first ins)))
                     ring (when (seq rs) (ring-of (first rs)))
                     ws (vec (distinct (keep (fn [[a _ b i]] (when (and (= a f) (= i 0) (= "writer~" (k b)) (= ring (ring-of b))) b)) (:lines p))))]
               :when (and ring (seq ws) (every? (fn [r] (and (= "reader~" (k r)) (= ring (ring-of r)))) rs))]
           {:faust f :ring ring :readers rs :writers ws}))))

(defn- bytes-of [source]
  (let [r (code/compiled "faust" source)]
    (when (and (= :ok (:status r)) (not (:poly (:info r))) (:value r))
      (let [f (.-factory (:value r))] (when (and f (.-code f)) [f (:info r)])))))

(defn fold-pass!
  "Folds the loops of p into their rings, and unfolds what no longer is one (called every tick by the engine)."
  [p nodes sig]
  (let [want (into {} (for [{:keys [faust ring readers writers]} (loops p) w writers] [w [faust ring readers]]))]
    ;; unfolded: a writer~ that was folded and no longer is
    (doseq [[id node] nodes :let [fa (:folded node)] :when (and fa @fa (not (contains? want id)))]
      (when-let [[_ s] @(:slot node)] (post! @(:ring node) {:unfold s}))
      (when-let [m (:mirrors (get nodes (:faust @fa)))] (swap! m dissoc id))
      (reset! fa nil))
    ;; folded: when every head has its slot and the faust~ is compiled
    (doseq [[w [faust ring readers]] want
            :let [wn (get nodes w) fnode (get nodes faust) rnode (get nodes ring)
                  h (:ring rnode) ws @(:slot wn)
                  rslots (mapv (fn [r] (second @(:slot (get nodes r)))) readers)
                  src (get-in p [:boxes faust :data :source])
                  [fac info] (bytes-of src)]
            :when (and wn fnode h ws (= h @(:ring wn)) (every? some? rslots) fac)
            :let [key [h (second ws) rslots src sig]]
            :when (not= key (:key @(:folded wn)))]
      (post! h {:fold {:slot (second ws) :readers rslots :code (.slice (.-code fac)) :json (.-json fac)}})
      ;; its parameters as they are, and from now on as they change
      (doseq [prm (:params info) :let [v (get @(:values fnode) (:label prm))] :when (number? v)]
        (post! h {:param {:slot (second ws) :address (:address prm) :value v}}))
      (swap! (:mirrors fnode) assoc w (fn [address v] (post! h {:param {:slot (second ws) :address address :value v}})))
      ;; what the faust~'s own node would bring into the writer~, a block late, is taken away
      (let [vin (ffirst (:inlets wn))]
        (doseq [[n _] (:outlets fnode)] (try (.disconnect n vin) (catch :default _ nil))))
      (reset! (:folded wn) {:key key :faust faust}))))

(reset! comp/after-feed fold-pass!)
