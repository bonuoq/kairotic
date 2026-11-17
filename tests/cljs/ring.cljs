;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · ring, writer and reader on a ring: the heads of Study 47 in the app
(ns kairotic.test.ring
  (:require [kairotic.components :as comp]
            [kairotic.span :as span]
            [kairotic.ring]
            [kairotic.test :as t]))

(defn near [a b] (and (number? a) (number? b) (< (js/Math.abs (- a b)) 1e-6)))

(defn sim
  "A small engine: boxes {id {:klass :args}}, lines [[from outlet to inlet] …], inputs [[at id inlet value] …],
   run until instant `until`. A box on inlet 1 of a reader or writer gives it the ring's state as its buffer;
   :later goes into the queue, :out along the lines at once. Returns {:states … :outs [[at id value] …]} with what
   left outlet 0 of the readers."
  [boxes lines inputs until]
  (let [states (atom {}) outs (atom [])
        queue (atom (vec (sort-by first inputs)))
        buffer (fn [id] (some (fn [[a _ b i]] (when (and (= b id) (= i 1) (= "ring" (:klass (get boxes a))))
                                                 (or (get @states a) (span/ring (first (:args (get boxes a)))))))
                               lines))
        deliver (fn deliver [id inlet value at]
                  (let [{:keys [klass args]} (get boxes id)
                        r ((:receive (comp/lookup klass)) {:id id :state (get @states id) :args args :inlet inlet :value value
                                                           :at at :buffer (buffer id)})]
                    (when (contains? r :state) (swap! states assoc id (:state r)))
                    (doseq [[a2 i2 v2] (:later r)] (swap! queue (fn [q] (vec (sort-by first (conj q [a2 id i2 v2]))))))
                    (doseq [[o v] (:out r)]
                      (when (and (= "reader" klass) (= 0 o)) (swap! outs conj [at id v]))
                      (doseq [[a oo b i] lines :when (and (= a id) (= oo o))] (deliver b i v at)))))]
    (loop [n 0]
      (let [[at id inlet value :as e] (first @queue)]
        (when (and e (<= at until) (< n 100000))
          (swap! queue (comp vec rest))
          (deliver id inlet value at)
          (recur (inc n)))))
    {:states @states :outs @outs}))

(defn vals-of [outs id] (mapv (fn [[_ _ v]] v) (filter #(= id (second %)) outs)))
(defn times-of [outs id] (mapv first (filter #(= id (second %)) outs)))

(t/run! "ring"
  (fn []
    ;; ── the model ──
    (let [r (-> (span/ring 4) (span/write 10 60) (span/write 10.5 62))]
      (t/eq "a ring's time starts at its first message" (:t0 r) 10)
      (t/eq "... and keeps what it gets, each at its time" (mapv (juxt :t :v) (span/alive r 11)) [[0 60] [0.5 62]])
      (t/eq "what is older than one turn is gone (its head, a tape head, passed it)" (mapv :v (span/alive r 14.2)) [62])
      (t/eq "a head going forwards meets them in order" (mapv (comp :v second) (span/crossings r 11 -0.1 0.6)) [60 62])
      (t/eq "... backwards, in reverse" (mapv (comp :v second) (span/crossings r 11 0.6 -0.1)) [62 60])
      (t/eq "... round the ring, again at every turn" (mapv first (span/crossings r 11 0.2 8.6)) [0.5 4 4.5 8 8.5])
      (t/is "the shortest move: a phasor~ back at 0 has gone on" (near (span/shortest 4 3.9 0.1) 0.2))
      (t/is "... and back" (near (span/shortest 4 0.1 3.9) -0.2)))
    (let [r (-> (span/ring 4) (span/write 10 :now 60 :mix) (span/write 11 1 62 :ovr))]
      (t/eq "a writer at a position: there, in this turn" (mapv (juxt :t :v) (:events r)) [[0 60] [1 62]])
      (let [r2 (-> r (span/write 11.5 1 64 :ovr) (span/write 11.5 1 67 :ovr))]
        (t/eq "ovr: what was written there before goes, what arrives with it stays (a chord)" (mapv :v (:events r2)) [60 64 67]))
      (t/eq "mix: it stays" (mapv :v (:events (span/write r 11.5 1 64 :mix))) [60 62 64])
      (t/eq "a cut: what a writer passed, round the ring" (mapv :v (:events (span/cut r 11.6 3.5 4.5))) [62])
      (t/eq "... backwards" (mapv :v (:events (span/cut r 11.6 1.5 0.5))) [60])
      (t/eq "erase: everything" (:events (span/erase r)) []))
    (let [r (span/write (span/ring 8) 10 60) st {:d 1 :speed 0.5 :drift0 0 :since 10}]
      (t/is "a following reader: first the distance, then the speed" (near (span/follow-at r st 12) (- 2 1 1)))
      (t/is "... the instant it meets a place" (near (span/when-met 0 12 0.5 0.25) 12.5)))

    ;; ── the ring box ──
    (let [recv (fn [st v at] ((:receive (comp/lookup "ring")) {:state st :args [4] :inlet 0 :value v :at at}))
          r1 (recv nil 60 10) r2 (recv (:state r1) 62 10.5)]
      (t/eq "ring: its first message starts its time and tells its readers" (:out r1) [[1 :start]])
      (t/is "... only the first" (empty? (:out r2)))
      (t/eq "[:data]: what it keeps" (first (:out (recv (:state r2) [:data] 11))) [0 {:dur 4 :events [[0 60] [0.5 62]]}])
      (t/eq ":clear: empty, its time starts again at the next message" (:t0 (:state (recv (:state r2) :clear 11))) nil)
      (t/eq "a writer's edit: position 2 of this turn (the head is at 1: two seconds ago)"
            (mapv (juxt :t :v) (:events (:state (recv (:state r2) [:write 2 64 :ovr] 11)))) [[-2 64] [0 60] [0.5 62]]))

    ;; ── canons: a ring and readers that follow its head ──
    (let [boxes {:r {:klass "ring" :args [8]} :a {:klass "reader" :args [:d 1]} :b {:klass "reader" :args [:d 2]}}
          {:keys [outs]} (sim boxes [[:r 1 :a 1] [:r 1 :b 1]] [[10.2 :r 0 60] [10.7 :r 0 62]] 14)]
      (t/eq "reader d 1 on a ring: a canon (it starts when the ring's time does)" (vals-of outs :a) [60 62])
      (t/is "... each note 1 s after it was played, at its instant" (every? true? (map near (times-of outs :a) [11.2 11.7])))
      (t/is "two readers: a canon in three voices" (every? true? (map near (times-of outs :b) [12.2 12.7]))))
    (let [boxes {:r {:klass "ring" :args [8]} :a {:klass "reader" :args [:d 1 :speed 0.5]}}
          {:keys [outs]} (sim boxes [[:r 1 :a 1]] [[10.2 :r 0 60] [10.7 :r 0 62]] 15)]
      (t/is "reader d 1 speed 0.5: an augmentation (it falls behind, twice as slow)"
            (and (= [60 62] (vals-of outs :a)) (every? true? (map near (times-of outs :a) [12.2 13.2])))))
    (let [boxes {:r {:klass "ring" :args [8]} :a {:klass "reader" :args []}}
          {:keys [outs]} (sim boxes [[:r 1 :a 1]] [[10 :r 0 60] [10.9 :r 0 62] [11 :a 0 [:d 0.25]]] 12)]
      (t/is "msg :d 0.25: a reader without a d follows from then (what is already behind it, it does not meet)"
            (and (= [62] (vals-of outs :a)) (near (first (times-of outs :a)) 11.15))))
    (let [boxes {:r {:klass "ring" :args [8]} :a {:klass "reader" :args [:d 0.5]}}
          {:keys [outs]} (sim boxes [[:r 1 :a 1]] [[10 :r 0 60] [10.2 :a 0 :stop] [10.3 :r 0 62]] 12)]
      (t/eq ":stop: it stops following" (vals-of outs :a) []))

    ;; ── a reader moved from outside ──
    (let [boxes {:r {:klass "ring" :args [4]} :a {:klass "reader" :args []}}
          {:keys [outs]} (sim boxes [[:r 1 :a 1]]
                              [[10 :r 0 60] [10.5 :r 0 62] [11 :a 0 0.2] [11.1 :a 0 0.6] [11.2 :a 0 0.1] [11.3 :a 0 3.5]] 12)]
      (t/eq "a reader moved by positions: what it crosses, either way; a jump is a seek" (vals-of outs :a) [62 62]))
    (let [boxes {:r {:klass "ring" :args [4]} :a {:klass "reader" :args [:norm]}}
          {:keys [outs]} (sim boxes [[:r 1 :a 1]] [[10 :r 0 60] [10.1 :r 0 62] [11 :a 0 0.99] [11.1 :a 0 0.01]] 12)]
      (t/eq "norm: 0…1, and a phasor~ going back to 0 has gone on" (vals-of outs :a) [60]))

    ;; ── writers ──
    (let [boxes {:r {:klass "ring" :args [4]} :w {:klass "writer" :args []} :a {:klass "reader" :args [:d 1]}}
          lines [[:w 0 :r 0] [:r 1 :w 1] [:r 1 :a 1]]
          {:keys [outs states]} (sim boxes lines [[10 :w 0 60] [10.5 :w 0 62]] 12)]
      (t/eq "a writer without a position writes where the ring's head is" (vals-of outs :a) [60 62])
      (t/eq "... and the ring keeps them" (mapv :t (:events (:r states))) [0 0.5]))
    (let [boxes {:r {:klass "ring" :args [4]} :w {:klass "writer" :args []}}
          lines [[:w 0 :r 0] [:r 1 :w 1]]
          {:keys [states]} (sim boxes lines [[10 :r 0 60] [10.5 :r 0 62] [10.6 :r 0 64]
                                             [11 :w 2 0.2] [11.1 :w 2 0.55] [11.2 :w 2 3]] 12)]
      (t/eq "a writer moved by positions (ovr): it erases what it passes; a jump erases nothing" (mapv :v (:events (:r states))) [60 64]))
    (let [boxes {:r {:klass "ring" :args [4]} :w {:klass "writer" :args [:mix]}}
          lines [[:w 0 :r 0] [:r 1 :w 1]]
          {:keys [states]} (sim boxes lines [[10 :r 0 60] [10.5 :r 0 62] [11 :w 2 0.2] [11.1 :w 2 0.7] [11.2 :w 0 67]] 12)]
      (t/eq "mix: it leaves what it passes, and writes where it is" (mapv (juxt :v #(js/Math.round (* 10 (span/wrap (:r states) (:t %))))) (:events (:r states)))
            [[60 0] [62 5] [67 7]]))
    (let [boxes {:r {:klass "ring" :args [4]} :w {:klass "writer" :args []}}
          lines [[:w 0 :r 0] [:r 1 :w 1]]
          {:keys [states]} (sim boxes lines [[10 :r 0 60] [10.5 :r 0 62] [10.6 :r 0 64] [11 :w 0 [:ovr 0.3]]] 11.5)]
      (t/eq ":ovr t: from t at speed 1, erasing what it passes, silence too" (mapv :v (:events (:r states))) [60]))
    (let [boxes {:r {:klass "ring" :args [4]} :w {:klass "writer" :args []}}
          lines [[:w 0 :r 0] [:r 1 :w 1]]
          {:keys [states]} (sim boxes lines [[10 :r 0 60] [10.5 :r 0 62] [11 :w 0 [:rec 2]] [11.2 :w 0 67]] 11.5)]
      (t/eq ":rec t on a ring: everything is erased, then it writes from t" (mapv (juxt :v #(js/Math.round (* 10 (span/wrap (:r states) (:t %))))) (:events (:r states)))
            [[67 22]]))
    (let [boxes {:r {:klass "ring" :args [4]} :w {:klass "writer" :args []} :a {:klass "reader" :args [:d 1]}}
          lines [[:w 0 :r 0] [:r 1 :w 1] [:r 1 :a 1] [:a 0 :w 0]]
          {:keys [outs]} (sim boxes lines [[10 :w 0 60]] 13.6)]
      (t/is "a reader into a writer on the same ring: feedback, a round (the note every second)"
            (and (= [60 60 60] (vals-of outs :a)) (every? true? (map near (times-of outs :a) [11 12 13])))))))
