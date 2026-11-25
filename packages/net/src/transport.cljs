;; transport · one clock for every box that keeps time: the room's beat, or a performer's (discussion #450, piece 3)
;; Part of @kairotic/net. Written against the Kairotic API (api/…).
;; Where pulse counts the beat (for boxes that move one pulse at a time: a necklace, comes, phase), transport
;; says where the beat is — [:sync t0 bpm], the audio-clock time of beat 0 and the tempo — for the boxes that
;; keep their own clock (a player), so that they play on the same grid and follow it when it moves.
;;   the room       its tempo (start [bpm], stop, bpm n: the same as pulse and the Room tab)
;;   a performer    a beat on the right: follow's written beat, a counter, or phase's {:phase :n :pulse}
;; Its logic is pure: what it follows is in its state, in this tab.
(let [room (fn [] (.-kairoticRoom js/window))
      eps 1e-9
      ;; the tempo that fits the last beats heard: [t0 bpm] by least squares (beats against seconds), or nil
      fit (fn [pts]
            (when (>= (count pts) 2)
              (let [n (count pts)
                    mt (/ (reduce + (map first pts)) n)
                    mb (/ (reduce + (map second pts)) n)
                    sxx (reduce + (map (fn [[t]] (* (- t mt) (- t mt))) pts))
                    sxy (reduce + (map (fn [[t b]] (* (- t mt) (- b mb))) pts))]
                (when (> sxx eps)
                  (let [s (/ sxy sxx)]                    ; beats per second
                    (when (> s eps) [(- mt (/ mb s)) (* 60 s)]))))))
      sync-out (fn [t0 bpm] [[1 bpm] [0 [:sync t0 bpm]]])
      ;; a beat heard at time t: the tempo that fits it and the ones before (a jump starts again from it)
      heard (fn [st t b T args]
              (let [k (max 2 (js/Math.round (or (:smooth args) 4)))
                    [pt0 pbpm] (:sync st)
                    expected (when pt0 (/ (* (- t pt0) pbpm) 60))
                    jump? (and expected (> (js/Math.abs (- b expected)) 2))
                    pts (if jump? [[t b]] (vec (take-last k (conj (or (:pts st) []) [t b]))))
                    ;; phase says its pulse; else the slope of what was heard; else, after a jump, the tempo it had
                    [t0 bpm] (cond (and (number? T) (pos? T)) [(- t (* b T)) (/ 60 T)]
                                   (fit pts) (fit pts)
                                   pbpm [(- t (/ (* b 60) pbpm)) pbpm]
                                   :else nil)
                    st (assoc st :pts pts :mode :follow)]
                (if bpm
                  {:state (assoc st :sync [t0 bpm]) :out (sync-out t0 bpm) :show {:follow b :bpm bpm}}
                  {:state st :show {:follow b}})))
      ;; phase's cycle unwrapped: a phase smaller than the last one is the next turn
      unwrap (fn [st p n]
               (let [[lp turn] (or (:cycle st) [nil 0])
                     turn (if (and lp (< p (- lp (/ n 2)))) (inc turn) turn)]
                 [(assoc st :cycle [p turn]) (+ p (* turn n))]))]
  {;; ── about ──
   :class "transport"
   :license "MPL-2.0"
   :doc "One clock for every box that keeps time (discussion #450): [:sync t0 bpm] on the left — the audio-clock time of beat 0 and the tempo —, into a player's left inlet, plays it on that grid (it joins on the next beat, or the next multiple of its quant, and follows every change without a jump), so that every player of the page — and of the room — plays on the same beat. While ▶ runs it follows the room's tempo, the one pulse counts (start [bpm], stop and bpm n change it for everyone, as the Room tab does; outside a room it is this page's tempo): [:sync t0 bpm] when it starts, changes or drifts, [:sync] when it stops. A beat on the right makes it follow a performer instead: a number (follow's written beat, a counter) or phase's map {:phase :n :pulse} (from its right outlet: the cycle unwrapped, a beat a pulse); the tempo is fitted to the last smooth (4) beats heard, a jump starts it again from there, and :room on the left goes back to the room. On the right outlet, the bpm (0 when it stops)."
   :usage "transport [smooth]"
   :io [2 2]
   :size [110 30]
   :args [[:smooth 4]]
   :help {:inlets [":start [bpm] · :stop · :bpm n: the tempo of the whole room · :room: follow the room again"
                   "a beat to follow: a number (follow's written beat) or phase's {:phase :n :pulse}"]
          :outlets ["[:sync t0 bpm] (the audio-clock time of beat 0, the tempo), [:sync] when it stops: into a player" "the bpm (0 when it stops)"]
          :example "(box :b1 \"msg :start 100\" 40 30)\n(box :b2 \"transport\" 40 80)\n(box :b3 \"pbind 1 loop\" 200 30)\n(code :b3 \"{:note [:c4 :e4 :g4] :dur 0.5}\")\n(box :b4 \"player\" 40 130)\n(box :b5 \"synth~\" 40 180)\n(box :b6 \"dac~\" 40 230)\n(connect :b1 0 :b2 0)\n(connect :b2 0 :b4 0)\n(connect :b3 0 :b4 1)\n(connect :b4 1 :b5 0)\n(connect :b4 0 :b5 1)\n(connect :b5 0 :b6 0)"
          :try "Press ▶ and click start 100: the player joins on the next beat. Two players on one transport, or on two pages of a room, play on the same beat; bpm 140 moves them both without a jump."
          :see ["pulse" "player" "follow" "phase"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [st (or state {})
                    t (or at 0)]
                (cond
                  ;; the room's tempo, from outside: {:room [t0 bpm]} on the audio clock, or {:room nil}
                  (= inlet :audio)
                  (let [r (:room value) st2 (assoc st :room r)]
                    (cond
                      (= :follow (:mode st)) {:state st2}
                      r {:state (assoc st2 :sync r) :out (sync-out (first r) (second r)) :show {:bpm (second r)}}
                      (:sync st) {:state (dissoc st2 :sync) :out [[1 0] [0 [:sync]]] :show {}}
                      :else {:state st2}))
                  (= inlet :task) {}
                  ;; a beat to follow
                  (= inlet 1)
                  (cond
                    (number? value) (heard st t value nil args)
                    (and (map? value) (number? (:phase value)) (number? (:n value)) (pos? (:n value)))
                    (let [[st2 b] (unwrap st (:phase value) (:n value))] (heard st2 t b (:pulse value) args))
                    :else {})
                  (#{:room} value)
                  (let [st2 (dissoc st :mode :pts :cycle)]
                    (if-let [r (:room st)]
                      {:state (assoc st2 :sync r) :out (sync-out (first r) (second r)) :show {:bpm (second r)}}
                      {:state (dissoc st2 :sync) :out [[1 0] [0 [:sync]]] :show {}}))
                  (#{:stop} value) {:effects [[:tempo [:stop]]]}
                  (#{:start} value) {:effects [[:tempo [:start 120]]]}
                  (and (sequential? value) (#{:start} (first value))) {:effects [[:tempo [:start (or (api/num-of (rest value)) 120)]]]}
                  (and (sequential? value) (#{:bpm} (first value)) (api/num-of (rest value))) {:effects [[:tempo [:bpm (api/num-of (rest value))]]]}
                  :else {})))
   :tasks {:tempo (fn [[op x] _]
                    (if-let [r (room)]
                      (do (case op :start ((.-start r) x) :bpm ((.-bpm r) x) :stop ((.-stop r))) (js/Promise.resolve true))
                      (js/Promise.reject (js/Error. "transport: this page has no room layer"))))}

   ;; ── view ──
   :derive (fn [{:keys [shown]}] {:label (cond (number? (:follow shown)) (str "transport ↝ " (api/nice (:follow shown))
                                                                                (when (:bpm shown) (str " · " (api/nice (:bpm shown)))))
                                               (:bpm shown) (str "transport · " (api/nice (:bpm shown)) " bpm")
                                               :else "transport")
                                  :dot (if (or (:bpm shown) (:follow shown)) :kairos :grid)})
   :view [[:rect {:x 1 :y 1 :w 108 :h 28 :r 3 :stroke :kairos :fill :bg}]
          [:circle {:cx 98 :cy 15 :r 5 :stroke :$dot :fill :$dot}]
          [:text {:x 8 :y 19 :size 11} :$label]]

   ;; ── outside: the room's tempo, read every 25 ms, as the audio-clock time of its beat 0; reported when it
   ;; starts, changes or stops, and when the two clocks drift apart by more than 5 ms ──
   :audio {:create (fn [ac b _]
                     (let [node {:alive (atom true) :last (atom :none) :inlets [] :outlets []}
                           tick (fn []
                                  (when-let [r (room)]
                                    (let [t ((.-tempo r)) t (when t (js->clj t :keywordize-keys true)) n ((.-now r))
                                          cur (when-let [{:keys [t0 bpm]} t] [(+ (.-currentTime ac) (/ (- t0 n) 1000)) bpm])
                                          prev @(:last node)]
                                      (when (or (= prev :none)
                                                (not= (nil? cur) (nil? prev))
                                                (and cur (or (not= (second cur) (second prev))
                                                             (> (js/Math.abs (- (first cur) (first prev))) 0.005))))
                                        (reset! (:last node) cur)
                                        (api/report! (:id b) {:room cur} nil)))))
                           timer (js/setInterval (fn [] (when @(:alive node) (tick))) 25)]
                       (assoc node :timer timer)))
           :dispose (fn [node] (reset! (:alive node) false) (js/clearInterval (:timer node)))}})
