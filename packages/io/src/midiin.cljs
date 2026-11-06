;; midiin · MIDI from a keyboard, a controller or another program, as Kairotic events
;; Part of @kairotic/io. Written against the Kairotic API (api/…). Discussion #135, Study 34 · io.
(let [;; ── the page's MIDI, asked once and shared by every midi box (Chrome, Edge, Firefox; not Safari) ──
      access (fn []
               (or (.-kairoticMidi js/window)
                   (let [p (if (.-requestMIDIAccess js/navigator)
                             (.requestMIDIAccess js/navigator #js {:sysex false})
                             (js/Promise.reject (js/Error. "this browser has no Web MIDI (Chrome, Edge or Firefox; not Safari)")))]
                     (set! (.-kairoticMidi js/window) p)
                     ;; refused: ask again next time
                     (.catch p (fn [_] (set! (.-kairoticMidi js/window) nil)))
                     p)))
      r3 (fn [x] (/ (js/Math.round (* x 1000)) 1000))
      r4 (fn [x] (/ (js/Math.round (* x 10000)) 10000))
      ;; ── bytes → messages ──
      decode (fn [[s a b]]
               (let [hi (bit-and (or s 0) 0xF0) ch (inc (bit-and (or s 0) 0x0F))]
                 (case hi
                   0x80 {:type :note-off :ch ch :note a}
                   0x90 (if (zero? b) {:type :note-off :ch ch :note a} {:type :note-on :ch ch :note a :vel b})
                   0xA0 {:type :poly :ch ch :note a :value b}
                   0xB0 {:type :cc :ch ch :cc a :value b}
                   0xC0 {:type :program :ch ch :value a}
                   0xD0 {:type :pressure :ch ch :value a}
                   0xE0 {:type :bend :ch ch :value (- (+ a (* 128 b)) 8192)}
                   0xF0 (case s 0xF8 {:type :clock} 0xFA {:type :start} 0xFB {:type :continue} 0xFC {:type :stop} nil)
                   nil)))
      ;; ── messages → events, with the state of what is held ──
      ;; a voice id names a note on a channel: the same key on two MPE channels is two voices
      voice-id (fn [ch note] (+ note (* 128 (dec ch))))
      fresh (fn [range0] {:range0 range0 :ranges {} :bends {} :rpn {} :held {} :order []})
      freq-of (fn [st ch note] (api/midi->hz (+ note (* (get (:bends st) ch 0) (get (:ranges st) ch (:range0 st))))))
      ev (fn [m] (assoc m :src :midi))
      step (fn [st m]
             (let [ch (:ch m)]
               (case (:type m)
                 :note-on (let [id (voice-id ch (:note m)) f (r3 (freq-of st ch (:note m))) a (r3 (/ (:vel m) 127))
                                offs (when (get (:held st) id) [(ev {:type :note :id id :ch ch :note (:note m) :freq f :gate false})])]
                            [(-> st (assoc-in [:held id] {:ch ch :note (:note m) :freq f})
                                 (update :order (fn [o] (vec (cons id (remove #(= % id) o))))))
                             (conj (vec offs) (ev {:type :note :id id :ch ch :note (:note m) :freq f :amp a :gate true}))])
                 :note-off (let [id (voice-id ch (:note m)) h (get (:held st) id)]
                             (if h
                               [(-> st (update :held dissoc id) (update :order (fn [o] (vec (remove #(= % id) o)))))
                                [(ev {:type :note :id id :ch ch :note (:note m) :freq (:freq h) :gate false})]]
                               [st []]))
                 :bend (let [st (assoc-in st [:bends ch] (/ (:value m) (if (neg? (:value m)) 8192 8191)))]
                         (reduce (fn [[st out] id]
                                   (let [{:keys [note]} (get (:held st) id) f (r3 (freq-of st ch note))]
                                     [(assoc-in st [:held id :freq] f) (conj out (ev {:type :glide :id id :ch ch :note note :freq f}))]))
                                 [st []] (filter #(= ch (:ch (get (:held st) %))) (:order st))))
                 ;; RPN 0 (CC 101 = 0, CC 100 = 0, then CC 6) is the bend range an MPE controller announces: read, not sent
                 :cc (let [n (:cc m) rpn (get (:rpn st) ch {})]
                       (cond (= n 101) [(assoc-in st [:rpn ch :msb] (:value m)) []]
                             (= n 100) [(assoc-in st [:rpn ch :lsb] (:value m)) []]
                             (and (= n 6) (= 0 (:msb rpn)) (= 0 (:lsb rpn))) [(assoc-in st [:ranges ch] (:value m)) []]
                             (= n 38) [st []]
                             :else [st [(ev {:type :cc :ch ch :cc n :value (r4 (/ (:value m) 127))})]]))
                 :pressure (let [id (first (filter #(= ch (:ch (get (:held st) %))) (:order st)))]
                             [st [(ev (cond-> {:type :pressure :ch ch :value (r4 (/ (:value m) 127))} id (assoc :id id)))]])
                 :poly [st [(ev {:type :pressure :ch ch :id (voice-id ch (:note m)) :value (r4 (/ (:value m) 127))})]]
                 :program [st [(ev {:type :program :ch ch :value (:value m)})]]
                 (:clock :start :stop :continue) [st [(ev {:type (:type m)})]]
                 [st []])))
      sounding (fn [st] [(:order st) (mapv #(:freq (get (:held st) %)) (:order st))])
      label (fn [e] (case (:type e)
                      :note (str (api/midi-name (:note e)) (if (:gate e) (str " " (js/Math.round (* 127 (or (:amp e) 0)))) " off"))
                      :glide (str (api/nice (:freq e)) " Hz")
                      :cc (str "cc " (:cc e) " " (api/nice (:value e)))
                      (name (:type e))))]
  {;; ── about ──
   :class "midiin"
   :license "MPL-2.0"
   :doc "MIDI from every input of the page (a keyboard, a controller, another program) as Kairotic events, while ▶ runs: a note is {:type :note :id :ch :note :freq :amp :gate}, a pitch bend moves the notes of its channel ({:type :glide :id :freq}), and controllers, pressure, program changes and the clock come as {:type :cc :ch :cc :value 0…1}, {:type :pressure …}, {:type :clock}…. Pitch travels as :freq in Hz: a bend, or an MPE controller (a channel per note; its bend range, RPN 0, is read), is only a different :freq. Out: the Hz of the notes sounding (with [:gain amp] just before a note starts) and their voice ids, as a keyboard or a player sends them, for synth~ or a polyphonic faust~; and every event. channel (0, all) keeps one; range (2) is the bend range of a controller that does not say its own. clear (or :stop) lets every held note go. Chrome, Edge and Firefox ask once to use MIDI; Safari has no MIDI."
   :usage "midiin [channel] [range]"
   :io [1 3]
   :size [96 30]
   :args [[:channel 0] [:range 2]]
   :help {:inlets ["clear (or :stop): every held note goes"]
          :outlets ["the Hz of the notes sounding, most recent first ([:gain amp] before a note starts)" "their voice ids (note + 128 per channel above the first)" "every event, as a map"]
          :example "(box :b1 \"midiin\" 40 30)\n(box :b2 \"synth~\" 40 90)\n(box :b3 \"dac~\" 40 140)\n(box :b4 \"print\" 160 90)\n(connect :b1 0 :b2 0)\n(connect :b1 1 :b2 1)\n(connect :b2 0 :b3 0)\n(connect :b2 0 :b3 1)\n(connect :b1 2 :b4 0)"
          :try "Press ▶ and play a MIDI keyboard: synth~ plays it and print shows every event. Bend a note: it glides."
          :see ["midiout" "keyboard" "synth~" "oscin"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (let [st (or state (fresh (api/clamp (:range args) 1 96)))]
                (cond
                  (and (= inlet :audio) (:error value)) {:effects [[:print (:error value)]] :show {:label "no MIDI"}}
                  (and (= inlet :audio) (:ports value)) {:state st :show {:label (if (pos? (:ports value)) (str "midi · " (:ports value) " in") "no MIDI input")}}
                  (and (= inlet :audio) (:bytes value))
                  (let [m (decode (:bytes value))
                        ch (:channel args)]
                    (if (or (nil? m) (and (pos? ch) (:ch m) (not= ch (:ch m))))
                      {:state st}
                      (let [[st2 es] (step st m)]
                        (if (empty? es)
                          {:state st2}
                          (let [[ids hz] (sounding st2)
                                notes? (some #(#{:note :glide} (:type %)) es)
                                on (first (filter #(and (= :note (:type %)) (:gate %)) es))]
                            {:state st2
                             :show {:label (label (last es))}
                             :out (vec (concat (when notes? [[1 ids]])
                                               (when on [[0 [:gain (:amp on)]]])
                                               (when notes? [[0 hz]])
                                               (map (fn [e] [2 e]) es)))})))))
                  (#{:clear :stop "clear"} value)
                  (let [offs (for [id (:order st) :let [h (get (:held st) id)]]
                               {:src :midi :type :note :id id :ch (:ch h) :note (:note h) :freq (:freq h) :gate false})]
                    {:state (fresh (:range0 st)) :out (vec (concat [[1 []] [0 []]] (map (fn [e] [2 e]) offs)))})
                  :else {:state st})))

   ;; ── view ──
   :derive (fn [{:keys [shown]}] {:label (or (:label shown) "midiin")})
   :view [[:rect {:x 1 :y 1 :w 94 :h 28 :r 3 :stroke :accent :fill :bg}]
          [:text {:x 8 :y 19 :size 11} :$label]]

   ;; ── outside: the inputs, while ▶ runs ──
   :audio {:create (fn [_ b _]
                     (let [node {:alive (atom true) :ins (atom []) :inlets [] :outlets []}
                           on-msg (fn [e] (when @(:alive node) (api/report! (:id b) {:bytes (vec (js/Array.from (.-data e)))} nil)))
                           wire! (fn [m]
                                   (doseq [i @(:ins node)] (.removeEventListener i "midimessage" on-msg))
                                   (let [ins (vec (js/Array.from (.values (.-inputs m))))]
                                     (doseq [i ins] (.addEventListener i "midimessage" on-msg))
                                     (reset! (:ins node) ins)
                                     (api/report! (:id b) {:ports (count ins)} nil)))]
                       (assoc node :unwire (fn [] (doseq [i @(:ins node)] (.removeEventListener i "midimessage" on-msg)))
                              :ready (-> (access)
                                         (.then (fn [m] (when @(:alive node)
                                                          (wire! m)
                                                          (.addEventListener m "statechange" (fn [_] (when @(:alive node) (wire! m)))))))
                                         (.catch (fn [e] (api/report! (:id b) {:error (str "midiin: " (.-message e))} nil)))))))
           :dispose (fn [node] (reset! (:alive node) false) ((:unwire node)))}})
