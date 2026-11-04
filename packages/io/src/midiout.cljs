;; midiout · Kairotic events and notes to a MIDI port, plain or MPE (microtones without rounding)
;; Part of @kairotic/io. Written against the Kairotic API (api/…). Discussion #135, Study 34 · io.
(let [access (fn []
               (or (.-kairoticMidi js/window)
                   (let [p (if (.-requestMIDIAccess js/navigator)
                             (.requestMIDIAccess js/navigator #js {:sysex false})
                             (js/Promise.reject (js/Error. "this browser has no Web MIDI (Chrome, Edge or Firefox; not Safari)")))]
                     (set! (.-kairoticMidi js/window) p)
                     (.catch p (fn [_] (set! (.-kairoticMidi js/window) nil)))
                     p)))
      clamp (fn [x lo hi] (max lo (min hi x)))
      ;; ── messages → bytes ──
      encode (fn [{:keys [type ch note vel value cc]}]
               (let [c (dec (or ch 1)) b7 (fn [x] (clamp (js/Math.round x) 0 127))]
                 (case type
                   :note-on [(+ 0x90 c) (b7 note) (b7 vel)]
                   :note-off [(+ 0x80 c) (b7 note) 0]
                   :cc [(+ 0xB0 c) (b7 cc) (b7 value)]
                   :pressure [(+ 0xD0 c) (b7 value)]
                   :bend (let [v (+ 8192 (clamp (js/Math.round value) -8192 8191))] [(+ 0xE0 c) (bit-and v 127) (bit-shift-right v 7)])
                   :clock [0xF8] :start [0xFA] :continue [0xFB] :stop [0xFC]
                   nil)))
      ;; ── events → messages: plain (one channel, rounded) or MPE (a member channel per note) ──
      fresh (fn [mpe ch r] {:mode (if mpe :mpe :plain) :ch ch :range r :voices {} :free (vec (range 2 17)) :n 0})
      bend-of (fn [semis r] (clamp (js/Math.round (* (/ semis r) (if (neg? semis) 8192 8191))) -8192 8191))
      key-and-bend (fn [hz r]
                     (let [m (api/hz->midi hz) k (clamp (js/Math.round m) 0 127)
                           k (if (> (js/Math.abs (- m k)) r) (clamp (js/Math.round (- m (* (js/Math.sign (- m k)) r))) 0 127) k)]
                       [k (bend-of (- m k) r)]))
      vel-of (fn [e] (clamp (js/Math.round (* 127 (or (:amp e) 0.8))) 1 127))
      off (fn [st id]
            (if-let [v (get-in st [:voices id])]
              [(-> st (update :voices dissoc id) (update :free #(if (= :mpe (:mode st)) (conj % (:ch v)) %)))
               [{:type :note-off :ch (:ch v) :note (:key v)}]]
              [st []]))
      on (fn [st e]
           (let [id (or (:id e) (js/Math.round (api/hz->midi (:freq e))))
                 [st pre] (off st id)]
             (if (= :mpe (:mode st))
               (let [[st ch pre] (if (seq (:free st))
                                   [st (first (:free st)) pre]
                                   ;; every channel busy: the oldest voice gives its own
                                   (let [[oid v] (apply min-key (fn [[_ v]] (:n v)) (:voices st))]
                                     [(update st :voices dissoc oid) (:ch v) (conj pre {:type :note-off :ch (:ch v) :note (:key v)})]))
                     [k b] (key-and-bend (:freq e) (:range st))]
                 [(-> st (update :free #(vec (remove #{ch} %))) (assoc-in [:voices id] {:ch ch :key k :n (:n st)}) (update :n inc))
                  (into pre [{:type :bend :ch ch :value b} {:type :note-on :ch ch :note k :vel (vel-of e)}])])
               (let [k (clamp (js/Math.round (api/hz->midi (:freq e))) 0 127)]
                 [(-> st (assoc-in [:voices id] {:ch (:ch st) :key k :n (:n st)}) (update :n inc))
                  (conj pre {:type :note-on :ch (:ch st) :note k :vel (vel-of e)})]))))
      out-step (fn [st e]
                 (let [e (if (and (nil? (:freq e)) (number? (:note e))) (assoc e :freq (api/midi->hz (:note e))) e)]
                   (case (:type e)
                     (:note nil) (cond (false? (:gate e)) (off st (:id e))
                                       (and (number? (:freq e)) (pos? (:freq e))) (on st e)
                                       :else [st []])
                     :glide (let [v (get-in st [:voices (:id e)])]
                              (if (and v (= :mpe (:mode st)) (number? (:freq e)))
                                [st [{:type :bend :ch (:ch v) :value (bend-of (- (api/hz->midi (:freq e)) (:key v)) (:range st))}]]
                                [st []]))
                     :cc [st [{:type :cc :ch (or (:ch e) (:ch st)) :cc (:cc e) :value (* 127 (:value e))}]]
                     :pressure [st (if-let [v (get-in st [:voices (:id e)])] [{:type :pressure :ch (:ch v) :value (* 127 (:value e))}] [])]
                     (:clock :start :stop :continue) [st [{:type (:type e)}]]
                     [st []])))
      events (fn [st es] (reduce (fn [[st ms] e] (let [[st m] (out-step st e)] [st (into ms m)])) [st []] es))
      ;; a snapshot of what sounds (Hz and voice ids, as a player or a keyboard sends them) against the one before
      diff (fn [before after amp]
             (let [pairs (fn [{:keys [hz ids]}] (into {} (map vector (or (seq ids) (map #(js/Math.round (api/hz->midi %)) hz)) hz)))
                   a (pairs before) b (pairs after)]
               (vec (concat (for [[id _] a :when (not (contains? b id))] {:type :note :id id :gate false})
                            (for [[id f] b :when (and (contains? a id) (not= f (get a id)))] {:type :glide :id id :freq f})
                            (for [[id f] (reverse (seq b)) :when (not (contains? a id))] {:type :note :id id :freq f :amp amp :gate true})))))
      setup (fn [r] (vec (concat [{:type :cc :ch 1 :cc 101 :value 0} {:type :cc :ch 1 :cc 100 :value 6} {:type :cc :ch 1 :cc 6 :value 15}]
                                 (mapcat (fn [ch] [{:type :cc :ch ch :cc 101 :value 0} {:type :cc :ch ch :cc 100 :value 0}
                                                   {:type :cc :ch ch :cc 6 :value r} {:type :cc :ch ch :cc 101 :value 127} {:type :cc :ch ch :cc 100 :value 127}])
                                         (range 2 17)))))
      send (fn [st ms] (if (seq ms) {:state st :effects [[:send (vec (keep encode ms))]] :show {:n (count ms)}} {:state st}))]
  {;; ── about ──
   :class "midiout"
   :license "MPL-2.0"
   :doc "Notes and events to a MIDI port, while ▶ runs. On the left, what sounds as a player, a keyboard or a reader send it — the Hz of the notes (after their voice ids on the right, and [:gain amp] for the next ones) —, or an event from midiin, oscin or a room ({:type :note :freq :amp :gate}, :glide, :cc…). With mpe, each note gets a channel of its own (2…16) and its exact frequency as a key plus a pitch bend of that channel (range 48 semitones): microtones, just intervals and glides reach the synthesizer without rounding; at ▶ it announces the zone and the range (the MPE configuration message). Without it, one channel (channel, 1) and the nearest key. port (1) is which output of the page. clear (or :stop) ends every note."
   :usage "midiout [mpe] [channel] [port] [range]"
   :io [2 0]
   :size [96 30]
   :args [[:mpe false] [:channel 1] [:port 1] [:range 48]]
   :help {:inlets ["the Hz of the notes sounding (a list), [:gain amp], an event map, or clear" "the voice ids of the Hz that follow"]
          :outlets []
          :example "(box :b1 \"keyboard\" 40 30)\n(box :b2 \"midiout mpe\" 40 120)\n(connect :b1 0 :b2 0)\n(connect :b1 1 :b2 1)"
          :try "Press ▶ and play the keyboard: the notes go to the first MIDI output of the page. With an MPE synthesizer, a freqt read by a reader~ glides there without steps."
          :see ["midiin" "synth~" "player" "oscout"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (let [st (or state {:enc (fresh (:mpe args) (api/clamp (:channel args) 1 16) (api/clamp (:range args) 1 96)) :snap {:hz [] :ids []} :ids nil :amp 0.8})
                    enc (:enc st)]
                (cond
                  (and (= inlet :audio) (:error value)) {:state st :effects [[:print (:error value)]] :show {:label "no MIDI"}}
                  (and (= inlet :audio) (contains? value :port)) {:state st :show {:label (or (:port value) "no MIDI output")}}
                  (= inlet :audio) {:state st}
                  (= inlet 1) {:state (assoc st :ids (when (sequential? value) (vec value)))}
                  (and (vector? value) (= :gain (first value)) (number? (second value))) {:state (assoc st :amp (api/clamp (second value) 0 1))}
                  (#{:clear :stop "clear"} value)
                  (let [[e2 ms] (events enc (map (fn [id] {:type :note :id id :gate false}) (keys (:voices enc))))]
                    (send (assoc st :enc e2 :snap {:hz [] :ids []}) ms))
                  (map? value) (let [[e2 ms] (out-step enc value)] (send (assoc st :enc e2) ms))
                  (or (number? value) (sequential? value))
                  (let [hz (vec (filter number? (if (number? value) [value] value)))
                        snap {:hz hz :ids (when (= (count (:ids st)) (count hz)) (:ids st))}
                        [e2 ms] (events enc (diff (:snap st) snap (:amp st)))]
                    (send (assoc st :enc e2 :snap snap) ms))
                  :else {:state st})))

   ;; ── view ──
   :derive (fn [{:keys [shown args]}] {:label (or (:label shown) (str "midiout" (when (:mpe args) " mpe")))})
   :view [[:rect {:x 1 :y 1 :w 94 :h 28 :r 3 :stroke :accent :fill :bg}]
          [:text {:x 8 :y 19 :size 11} :$label]]

   ;; ── outside: the port, while ▶ runs ──
   :audio {:create (fn [ac b _]
                     (let [words (rest (.split (.trim (str (:text b))) #"\s+"))
                           mpe (some #{"mpe"} words)
                           nums (keep #(let [n (js/parseFloat %)] (when-not (js/isNaN n) n)) words)
                           port-n (or (second nums) 1)
                           r (or (nth nums 2 nil) 48)
                           node {:ac ac :port (atom nil) :alive (atom true) :inlets [] :outlets []}]
                       (-> (access)
                           (.then (fn [m]
                                    (when @(:alive node)
                                      (let [outs (vec (js/Array.from (.values (.-outputs m))))
                                            p (get outs (dec port-n))]
                                        (reset! (:port node) p)
                                        (api/report! (:id b) {:port (when p (str "→ " (.-name p)))} nil)
                                        (when (and p mpe) (doseq [msg (setup r)] (.send p (clj->js (encode msg)))))))))
                           (.catch (fn [e] (api/report! (:id b) {:error (str "midiout: " (.-message e))} nil))))
                       node))
           :effects {:send (fn [node bytes at]
                             (when-let [p @(:port node)]
                               (let [ac (:ac node)
                                     ;; at the time of the message on the audio clock, as a time of the page
                                     ts (+ (js/performance.now) (* 1000 (max 0 (- (or at 0) (.-currentTime ac)))))]
                                 (doseq [b bytes] (.send p (clj->js b) ts)))))}
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      ;; nothing left sounding on the synthesizer
                      (when-let [p @(:port node)]
                        (doseq [ch (range 16)] (.send p #js [(+ 0xB0 ch) 123 0]))))}})
