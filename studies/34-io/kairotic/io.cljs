;; SPDX-License-Identifier: MPL-2.0
;; Study 34 · io: Kairotic's common event format, and MIDI in and out of it (discussion #135).
;;
;; Everything that comes in from outside, or goes out, is an EDN map in the shape of a pattern event, so
;; a patch never knows where a message came from:
;;
;;   {:src :midi :type :note :id 60 :ch 1 :note 60 :freq 261.626 :amp 0.79 :gate true}   a note starts
;;   {:src :midi :type :note :id 60 :ch 1 :note 60 :freq 261.626 :gate false}             it ends
;;   {:src :midi :type :glide :id 60 :ch 1 :freq 266.1}      its pitch moves (a pitch bend on its channel)
;;   {:src :midi :type :cc :ch 1 :cc 74 :value 0.42}         a controller, 0…1
;;   {:src :midi :type :pressure :ch 2 :id 188 :value 0.3}   aftertouch (of the note on that channel)
;;   {:src :midi :type :clock} · :start · :stop · :continue  MIDI's own transport
;;
;; Pitch travels as :freq in Hz, never as a note number alone: a bend, MPE or a Scala tuning is just a
;; different :freq. :note is there for whoever wants it. :id names a voice (the note number, plus 128 per
;; channel above the first, so the same key on two MPE channels is two voices), as a reader, a player or
;; a keyboard name theirs, so synth~ and a polyphonic faust~ take them unchanged.
;;
;; Out, the same events become bytes in one of two modes:
;;   :plain  one channel, :freq rounded to the nearest key (microtones are lost)
;;   :mpe    one channel per sounding note (a zone of member channels above a manager channel), its exact
;;           :freq as a key plus a pitch bend of that channel alone (a range of 48 semitones by default)

(ns kairotic.io)

;; ───────── numbers ─────────

(defn round-to [x d] (let [k (js/Math.pow 10 d)] (/ (js/Math.round (* x k)) k)))
(defn midi->hz [m] (* 440 (js/Math.pow 2 (/ (- m 69) 12))))
(defn hz->midi [hz] (+ 69 (* 12 (/ (js/Math.log (/ hz 440)) (js/Math.log 2)))))
(defn clamp [x lo hi] (max lo (min hi x)))
(defn voice-id "The voice id of a note on a channel (1…16)." [ch note] (+ note (* 128 (dec ch))))

;; ───────── bytes ⇄ messages ─────────
;; A message is MIDI as it is, only readable: channels 1…16, data 0…127, bend −8192…8191.

(defn decode
  "The message in a MIDI packet (a sequence of bytes), or nil for what Kairotic does not read (sysex…)."
  [bytes]
  (let [[s a b] (vec bytes)
        hi (bit-and (or s 0) 0xF0) ch (inc (bit-and (or s 0) 0x0F))]
    (case hi
      0x80 {:type :note-off :ch ch :note a :vel b}
      0x90 (if (zero? b) {:type :note-off :ch ch :note a :vel 0} {:type :note-on :ch ch :note a :vel b})
      0xA0 {:type :poly :ch ch :note a :value b}
      0xB0 {:type :cc :ch ch :cc a :value b}
      0xC0 {:type :program :ch ch :value a}
      0xD0 {:type :pressure :ch ch :value a}
      0xE0 {:type :bend :ch ch :value (- (+ a (* 128 b)) 8192)}
      0xF0 (case s 0xF8 {:type :clock} 0xFA {:type :start} 0xFB {:type :continue} 0xFC {:type :stop} nil)
      nil)))

(defn encode
  "The bytes of a message (the inverse of decode)."
  [{:keys [type ch note vel value cc]}]
  (let [c (dec (or ch 1)) b7 (fn [x] (clamp (js/Math.round x) 0 127))]
    (case type
      :note-on [(+ 0x90 c) (b7 note) (b7 vel)]
      :note-off [(+ 0x80 c) (b7 note) (b7 (or vel 0))]
      :poly [(+ 0xA0 c) (b7 note) (b7 value)]
      :cc [(+ 0xB0 c) (b7 cc) (b7 value)]
      :program [(+ 0xC0 c) (b7 value)]
      :pressure [(+ 0xD0 c) (b7 value)]
      :bend (let [v (+ 8192 (clamp (js/Math.round value) -8192 8191))] [(+ 0xE0 c) (bit-and v 127) (bit-shift-right v 7)])
      :clock [0xF8] :start [0xFA] :continue [0xFB] :stop [0xFC]
      nil)))

;; ───────── in: messages → events ─────────
;; The state of what comes in: the bend and bend range of each channel, the RPN being set, and the notes
;; held, most recent first.

(defn new-in
  "The state of an input. range: the bend range in semitones of every channel (2, MIDI's default; an MPE
   controller says its own with RPN 0, which is read)."
  ([] (new-in {}))
  ([{r :range :or {r 2}}] {:range0 r :ranges {} :bends {} :rpn {} :held {} :order []}))

(defn- range-of [st ch] (get (:ranges st) ch (:range0 st)))
(defn- freq-of [st ch note] (midi->hz (+ note (* (get (:bends st) ch 0) (range-of st ch)))))
(defn- ev [m] (assoc m :src :midi))

(defn- note-on [st {:keys [ch note vel]}]
  (let [id (voice-id ch note) f (round-to (freq-of st ch note) 3)
        ;; the same key again before its note-off: the old one ends first
        [st offs] (if (get (:held st) id)
                    [st [(ev {:type :note :id id :ch ch :note note :freq f :gate false})]]
                    [st []])]
    [(-> st (assoc-in [:held id] {:ch ch :note note :freq f :amp (round-to (/ vel 127) 3)})
         (update :order (fn [o] (vec (cons id (remove #(= % id) o))))))
     (conj offs (ev {:type :note :id id :ch ch :note note :freq f :amp (round-to (/ vel 127) 3) :gate true}))]))

(defn- note-off [st {:keys [ch note]}]
  (let [id (voice-id ch note) h (get (:held st) id)]
    (if h
      [(-> st (update :held dissoc id) (update :order (fn [o] (vec (remove #(= % id) o)))))
       [(ev {:type :note :id id :ch ch :note note :freq (:freq h) :gate false})]]
      [st []])))

(defn- bend [st {:keys [ch value]}]
  (let [st (assoc-in st [:bends ch] (/ value (if (neg? value) 8192 8191)))
        ids (filter (fn [id] (= ch (:ch (get (:held st) id)))) (:order st))]
    (reduce (fn [[st out] id]
              (let [{:keys [note]} (get (:held st) id) f (round-to (freq-of st ch note) 3)]
                [(assoc-in st [:held id :freq] f) (conj out (ev {:type :glide :id id :ch ch :note note :freq f}))]))
            [st []] ids)))

(defn- cc [st {:keys [ch value] :as m}]
  ;; RPN 0 (pitch bend range): CC 101 = 0, CC 100 = 0, then data entry CC 6 (semitones) / CC 38 (cents)
  (let [n (:cc m) rpn (get (:rpn st) ch {})]
    (case n
      101 [(assoc-in st [:rpn ch :msb] value) []]
      100 [(assoc-in st [:rpn ch :lsb] value) []]
      6 (if (and (= 0 (:msb rpn)) (= 0 (:lsb rpn)))
          [(assoc-in st [:ranges ch] value) []]
          [st [(ev {:type :cc :ch ch :cc 6 :value (round-to (/ value 127) 4)})]])
      38 [st []]
      [st [(ev {:type :cc :ch ch :cc n :value (round-to (/ value 127) 4)})]])))

(defn in-step
  "A message in: [new state, events out]."
  [st m]
  (case (:type m)
    :note-on (note-on st m)
    :note-off (note-off st m)
    :bend (bend st m)
    :cc (cc st m)
    :pressure (let [id (first (filter #(= (:ch m) (:ch (get (:held st) %))) (:order st)))]
                [st [(ev (cond-> {:type :pressure :ch (:ch m) :value (round-to (/ (:value m) 127) 4)} id (assoc :id id)))]])
    :poly [st [(ev {:type :pressure :ch (:ch m) :id (voice-id (:ch m) (:note m)) :value (round-to (/ (:value m) 127) 4)})]]
    :program [st [(ev {:type :program :ch (:ch m) :value (:value m)})]]
    (:clock :start :stop :continue) [st [(ev {:type (:type m)})]]
    [st []]))

(defn in-bytes "Bytes in: [new state, events]." [st bytes] (if-let [m (decode bytes)] (in-step st m) [st []]))

(defn sounding
  "What is sounding, as a player or a keyboard sends it: Hz and voice ids, most recent first."
  [st]
  {:hz (mapv #(:freq (get (:held st) %)) (:order st)) :ids (:order st)})

;; ───────── out: events → messages ─────────

(defn new-out
  "The state of an output. mode :plain (channel ch) or :mpe (manager channel 1, member channels 2… for
   `zone` channels, a bend range of `range` semitones on each)."
  ([] (new-out {}))
  ([{:keys [mode ch zone] r :range :or {mode :plain ch 1 r 48 zone 15}}]
   {:mode mode :ch ch :range r :zone (clamp zone 1 15) :voices {} :free (vec (range 2 (+ 2 (clamp zone 1 15)))) :n 0}))

(defn note-and-bend
  "A frequency as the key nearest to it and the bend, −8192…8191, that reaches it with a range of r
   semitones (beyond the range, the key moves so that it fits)."
  [hz r]
  (let [m (hz->midi hz) k (clamp (js/Math.round m) 0 127)
        k (if (> (js/Math.abs (- m k)) r) (clamp (js/Math.round (- m (* (js/Math.sign (- m k)) r))) 0 127) k)
        semis (- m k)]
    [k (clamp (js/Math.round (* (/ semis r) (if (neg? semis) 8192 8191))) -8192 8191)]))

(defn- vel-of [e] (clamp (js/Math.round (* 127 (or (:amp e) (:gain e) 0.8))) 1 127))

(defn- alloc
  "A member channel for a new voice: a free one (the one free the longest), or else the oldest voice's."
  [st]
  (if (seq (:free st))
    [st (first (:free st)) nil]
    (let [[oid v] (apply min-key (fn [[_ v]] (:n v)) (:voices st))]
      [(update st :voices dissoc oid) (:ch v) v])))

(defn- out-on [st e]
  (let [id (or (:id e) (js/Math.round (hz->midi (:freq e))))
        ;; the same voice again: it ends first
        [st pre] (if-let [v (get-in st [:voices id])]
                   [(-> st (update :voices dissoc id) (update :free #(if (= :mpe (:mode st)) (conj % (:ch v)) %)))
                    [{:type :note-off :ch (:ch v) :note (:key v) :vel 0}]]
                   [st []])]
    (if (= :mpe (:mode st))
      (let [[st ch stolen] (alloc st)
            [k b] (note-and-bend (:freq e) (:range st))
            pre (cond-> pre stolen (conj {:type :note-off :ch ch :note (:key stolen) :vel 0}))]
        [(-> st (update :free #(vec (remove #{ch} %)))
             (assoc-in [:voices id] {:ch ch :key k :n (:n st)}) (update :n inc))
         (into pre [{:type :bend :ch ch :value b} {:type :note-on :ch ch :note k :vel (vel-of e)}])])
      (let [k (clamp (js/Math.round (hz->midi (:freq e))) 0 127)]
        [(-> st (assoc-in [:voices id] {:ch (:ch st) :key k :n (:n st)}) (update :n inc))
         (conj pre {:type :note-on :ch (:ch st) :note k :vel (vel-of e)})]))))

(defn- out-off [st e]
  (let [id (or (:id e) (when (:freq e) (js/Math.round (hz->midi (:freq e)))))]
    (if-let [v (get-in st [:voices id])]
      [(-> st (update :voices dissoc id) (update :free #(if (= :mpe (:mode st)) (conj % (:ch v)) %)))
       [{:type :note-off :ch (:ch v) :note (:key v) :vel 0}]]
      [st []])))

(defn- out-glide [st e]
  (let [v (get-in st [:voices (:id e)])]
    (if (and v (= :mpe (:mode st)))
      ;; within the range of the key that started the note; beyond it the bend stops at its end
      (let [semis (- (hz->midi (:freq e)) (:key v)) r (:range st)]
        [st [{:type :bend :ch (:ch v) :value (clamp (js/Math.round (* (/ semis r) (if (neg? semis) 8192 8191))) -8192 8191)}]])
      [st []])))

(defn out-step
  "An event out: [new state, messages]. Notes need :freq (or :note) and :gate; :glide moves a voice
   (only in MPE, where each note has a channel of its own)."
  [st e]
  (let [e (if (and (nil? (:freq e)) (number? (:note e))) (assoc e :freq (midi->hz (:note e))) e)]
    (case (:type e)
      (:note nil) (cond (false? (:gate e)) (out-off st e)
                        (and (number? (:freq e)) (pos? (:freq e))) (out-on st e)
                        :else [st []])
      :glide (out-glide st e)
      :cc [st [{:type :cc :ch (or (:ch e) (:ch st)) :cc (:cc e) :value (* 127 (:value e))}]]
      :pressure (let [v (get-in st [:voices (:id e)])]
                  [st [{:type :pressure :ch (or (:ch v) (:ch e) (:ch st)) :value (* 127 (:value e))}]])
      (:clock :start :stop :continue) [st [{:type (:type e)}]]
      [st []])))

(defn out-events "Several events out: [state, messages]." [st es]
  (reduce (fn [[st ms] e] (let [[st m] (out-step st e)] [st (into ms m)])) [st []] es))

(defn all-off "Every voice ends: [state, messages]." [st]
  (out-events st (map (fn [id] {:type :note :id id :gate false}) (keys (:voices st)))))

(defn rpn-range "The messages that set the bend range of channel ch to r semitones (RPN 0)." [ch r]
  [{:type :cc :ch ch :cc 101 :value 0} {:type :cc :ch ch :cc 100 :value 0}
   {:type :cc :ch ch :cc 6 :value r} {:type :cc :ch ch :cc 38 :value 0}
   {:type :cc :ch ch :cc 101 :value 127} {:type :cc :ch ch :cc 100 :value 127}])

(defn mpe-setup
  "The messages that announce an MPE lower zone of `zone` member channels (the MPE Configuration Message,
   RPN 6 on manager channel 1) and set the bend range of every member channel."
  [st]
  (vec (concat [{:type :cc :ch 1 :cc 101 :value 0} {:type :cc :ch 1 :cc 100 :value 6}
                {:type :cc :ch 1 :cc 6 :value (:zone st)}
                {:type :cc :ch 1 :cc 101 :value 127} {:type :cc :ch 1 :cc 100 :value 127}]
               (mapcat #(rpn-range % (:range st)) (range 2 (+ 2 (:zone st)))))))

;; ───────── snapshots → events ─────────
;; A player, a keyboard or a reader send what sounds as a whole (Hz and voice ids, most recent first);
;; the difference between two of them is notes starting, ending and gliding.

(defn diff
  "The events between two snapshots {:hz […] :ids […]} (ids may be missing: then the Hz name the voices)."
  ([before after] (diff before after nil))
  ([before after amp]
   (let [pairs (fn [{:keys [hz ids]}] (into {} (map vector (or ids (map #(js/Math.round (hz->midi %)) hz)) hz)))
         a (pairs before) b (pairs after)]
     (vec (concat
           (for [[id f] a :when (not (contains? b id))] {:src :patch :type :note :id id :freq f :gate false})
           (for [[id f] b :when (and (contains? a id) (not= f (get a id)))] {:src :patch :type :glide :id id :freq f})
           (for [[id f] (reverse (seq b)) :when (not (contains? a id))]
             (cond-> {:src :patch :type :note :id id :freq f :gate true} amp (assoc :amp amp))))))))

;; ───────── recording into a freqt ─────────
;; Notes as strokes of Hz over beats (seconds from the start, a beat a second, as record does); a glide
;; is one more point; the loudness is the stroke's weight, as render draws :amp.

(defn rec-start [t] {:t0 t :open {} :strokes {} :n 0})

(defn rec-step
  "The take with an event at time t (seconds)."
  [rec t e]
  (let [x (round-to (- t (:t0 rec)) 3) id (:id e) sid (get-in rec [:open id])]
    (case (:type e)
      :note (cond
              (and (:gate e) (number? (:freq e)))
              (let [sid (keyword (str "m" (inc (:n rec))))
                    rec (if-let [old (get-in rec [:open id])] (update rec :open dissoc id) rec)]
                (-> rec (update :n inc) (assoc-in [:open id] sid)
                    (assoc-in [:strokes sid] (cond-> {:pts [[x (round-to (:freq e) 3)]]}
                                               (number? (:amp e)) (assoc :look {:w (round-to (+ 0.5 (* 2 (:amp e))) 3)})))))
              (and (false? (:gate e)) sid)
              (let [f (second (peek (get-in rec [:strokes sid :pts])))]
                (-> rec (update-in [:strokes sid :pts] conj [x f]) (update :open dissoc id)))
              :else rec)
      :glide (if sid
               (let [pts (get-in rec [:strokes sid :pts]) f (second (peek pts))]
                 ;; the pitch held until now, then the new one: a staircase, as record writes
                 (assoc-in rec [:strokes sid :pts] (conj (if (> x (first (peek pts))) (conj pts [x f]) pts) [x (round-to (:freq e) 3)])))
               rec)
      rec)))

(defn rec-data
  "The take as freqt data at time t: the notes still held reach t."
  [rec t]
  (let [x (round-to (- t (:t0 rec)) 3)]
    {:strokes (reduce (fn [ss [_ sid]]
                        (update-in ss [sid :pts] (fn [pts] (let [[px f] (peek pts)] (if (> x px) (conj pts [x f]) pts)))))
                      (:strokes rec) (:open rec))}))

;; ───────── motion: a phone's sensors ─────────
;; DeviceOrientation gives the tilt (beta front/back −180…180, gamma left/right −90…90, alpha the compass
;; 0…360); DeviceMotion the acceleration. In:
;;   {:src :motion :type :tilt :x 0.62 :y 0.48 :alpha 12.3 :beta -4.1 :gamma 21.6}   x, y in 0…1, flat = 0.5
;;   {:src :motion :type :shake :value 23.4}                                           a shake, m/s²
;; The tilt is smoothed and sent only when it moves (sensors send ~60 times a second, whether or not
;; anything changes); a shake is a trigger, with a pause after it so that one shake is one event.

(defn new-motion
  "smooth: how much of the old value stays at each reading (0 none, 0.9 a lot); eps: the least change of x
   or y that is sent; shake: m/s² of acceleration that make a shake; every: seconds between two shakes."
  ([] (new-motion {}))
  ([{:keys [smooth eps shake every] :or {smooth 0.3 eps 0.004 shake 14 every 0.3}}]
   {:smooth smooth :eps eps :shake shake :every every :x nil :y nil :sent nil :last-shake nil}))

(defn tilt-xy
  "The tilt as x (left 0 … right 1) and y (towards you 0 … away 1), both 0.5 when the phone lies flat."
  [beta gamma]
  [(clamp (/ (+ gamma 90) 180) 0 1) (clamp (/ (+ (clamp beta -90 90) 90) 180) 0 1)])

(defn- mag [[x y z]] (js/Math.sqrt (+ (* x x) (* y y) (* z z))))

(defn motion-step
  "A reading at time t (seconds): {:beta :gamma :alpha} (orientation), {:acc [x y z]} (acceleration
   without gravity) or {:accg [x y z]} (with gravity, when the device gives no other). [state, events]."
  [st t r]
  (cond
    (number? (:gamma r))
    (let [[tx ty] (tilt-xy (or (:beta r) 0) (:gamma r))
          k (:smooth st)
          x (if (:x st) (+ (* k (:x st)) (* (- 1 k) tx)) tx)
          y (if (:y st) (+ (* k (:y st)) (* (- 1 k) ty)) ty)
          [sx sy] (:sent st)
          st (assoc st :x x :y y)]
      (if (and sx (< (js/Math.abs (- x sx)) (:eps st)) (< (js/Math.abs (- y sy)) (:eps st)))
        [st []]
        [(assoc st :sent [x y])
         [(cond-> {:src :motion :type :tilt :x (round-to x 3) :y (round-to y 3)
                   :beta (round-to (or (:beta r) 0) 1) :gamma (round-to (:gamma r) 1)}
            (number? (:alpha r)) (assoc :alpha (round-to (:alpha r) 1)))]]))
    (or (:acc r) (:accg r))
    (let [m (if (:acc r) (mag (:acc r)) (js/Math.abs (- (mag (:accg r)) 9.81)))]
      (if (and (> m (:shake st)) (or (nil? (:last-shake st)) (>= (- t (:last-shake st)) (:every st))))
        [(assoc st :last-shake t) [{:src :motion :type :shake :value (round-to m 1)}]]
        [st []]))
    :else [st []]))

;; ───────── gamepads ─────────
;; The Gamepad API is read, not listened to: the page asks for every pad on each frame, and the differences
;; are the events. With the standard mapping, buttons and sticks have names.
;;   {:src :gamepad :type :button :pad 0 :button 0 :name :a :value 1 :gate true}    pressed (and released)
;;   {:src :gamepad :type :button :pad 0 :button 7 :name :rt :value 0.42}           an analogue button moves
;;   {:src :gamepad :type :axis :pad 0 :axis 0 :name :lx :value -0.37}              a stick, −1…1
;;   {:src :gamepad :type :connect :pad 0 :name "Xbox Wireless Controller"} · :disconnect

(def standard-buttons [:a :b :x :y :lb :rb :lt :rt :back :start :ls :rs :up :down :left :right :home])
(def standard-axes [:lx :ly :rx :ry])

(defn new-pads
  "deadzone: how far a stick moves before it counts (its rest is never exactly 0); eps: the least change sent."
  ([] (new-pads {}))
  ([{:keys [deadzone eps] :or {deadzone 0.12 eps 0.01}}] {:deadzone deadzone :eps eps :pads {}}))

(defn dead
  "A stick's value with its dead zone taken out: 0 inside it, and still −1…1 outside."
  [v dz]
  (if (< (js/Math.abs v) dz) 0 (* (js/Math.sign v) (/ (- (js/Math.abs v) dz) (- 1 dz)))))

(defn- pad-diff [st i before pad]
  (let [std? (= "standard" (:mapping pad))
        ev (fn [m] (assoc m :src :gamepad :pad i))
        axes (map-indexed (fn [k v] (round-to (dead v (:deadzone st)) 3)) (:axes pad))
        axis-evs (for [[k v] (map-indexed vector axes)
                       :let [old (get-in before [:axes k] 0)]
                       :when (or (>= (js/Math.abs (- v old)) (:eps st)) (and (zero? v) (not (zero? old))))]
                   (ev (cond-> {:type :axis :axis k :value v} (and std? (< k 4)) (assoc :name (nth standard-axes k)))))
        btn-evs (for [[k [p v]] (map-indexed vector (:buttons pad))
                      :let [[op ov] (get-in before [:buttons k] [false 0]) v (round-to v 3)
                            named (fn [m] (cond-> m (and std? (< k 17)) (assoc :name (nth standard-buttons k))))]
                      :when (or (not= (boolean p) (boolean op)) (>= (js/Math.abs (- v ov)) (:eps st)))]
                  (ev (named (cond-> {:type :button :button k :value v} (not= (boolean p) (boolean op)) (assoc :gate (boolean p))))))]
    [{:axes (vec axes) :buttons (mapv (fn [[p v]] [(boolean p) (round-to v 3)]) (:buttons pad))}
     (vec (concat btn-evs axis-evs))]))

(defn pads-step
  "The pads as they are now — a sequence of {:index :id :mapping :axes [..] :buttons [[pressed value] ..]}
   (nil for an empty slot) — against the last ones: [state, events]."
  [st pads]
  (let [now (into {} (keep (fn [p] (when p [(:index p) p])) pads))
        gone (for [i (keys (:pads st)) :when (not (contains? now i))] {:src :gamepad :type :disconnect :pad i})
        [ps evs] (reduce (fn [[ps evs] [i pad]]
                           (let [before (get-in st [:pads i])
                                 [after es] (pad-diff st i (:last before) pad)]
                             [(assoc ps i {:last after :name (:id pad)})
                              (cond-> evs (nil? before) (conj {:src :gamepad :type :connect :pad i :name (:id pad)})
                                      true (into es))]))
                         [{} []] (sort-by key now))]
    [(assoc st :pads ps) (vec (concat gone evs))]))

;; ───────── OSC ─────────
;; Through the relay's bridge (relay/oscbridge.js) a message is JSON: {address, args, types?, from?}. An
;; event goes out under /kairotic/<type>, with its values in a fixed order, so that a SynthDef or a Max
;; patch can take it without parsing; the same addresses coming in are events again. Any other address
;; arrives as it is: {:src :osc :type :osc :address "/x" :args [..] :from "127.0.0.1:57120"}.
;;
;;   /kairotic/note    id freq amp gate     (i f f i; gate 1 or 0)
;;   /kairotic/glide   id freq              (i f)
;;   /kairotic/cc      ch cc value          (i i f; value 0…1)
;;   /kairotic/pressure id value            (i f)
;;   /kairotic/tilt    x y                  (f f)
;;   /kairotic/shake   value                (f)
;;   /kairotic/pad/<name> value [gate]      (f [i]; a gamepad's button or axis, by name or b3, a1)
;;   /kairotic/clock · /start · /stop · /continue

(defn- num [x] (if (number? x) x 0))

(defn event->osc
  "An event as an OSC message for the bridge, or nil (an event from OSC is not sent back)."
  [e]
  (case (:type e)
    :note {:address "/kairotic/note" :types "iffi"
           :args [(num (:id e)) (num (:freq e)) (num (or (:amp e) (when (:gate e) 0.8))) (if (:gate e) 1 0)]}
    :glide {:address "/kairotic/glide" :types "if" :args [(num (:id e)) (num (:freq e))]}
    :cc {:address "/kairotic/cc" :types "iif" :args [(num (:ch e)) (num (:cc e)) (num (:value e))]}
    :pressure {:address "/kairotic/pressure" :types "if" :args [(num (:id e)) (num (:value e))]}
    :tilt {:address "/kairotic/tilt" :types "ff" :args [(:x e) (:y e)]}
    :shake {:address "/kairotic/shake" :types "f" :args [(:value e)]}
    (:button :axis) {:address (str "/kairotic/pad/" (if (:name e) (name (:name e)) (str (if (= :axis (:type e)) "a" "b") (or (:axis e) (:button e)))))
                     :types (if (some? (:gate e)) "fi" "f")
                     :args (if (some? (:gate e)) [(:value e) (if (:gate e) 1 0)] [(:value e)])}
    (:clock :start :stop :continue) {:address (str "/kairotic/" (name (:type e))) :args []}
    :osc (when-not (= :osc (:src e)) {:address (:address e) :args (vec (:args e))})
    nil))

(defn osc->event
  "An OSC message from the bridge as an event."
  [{:keys [address args from]}]
  (let [a (vec args) r (fn [x] (if (number? x) (round-to x 4) x))
        base (cond-> {:src :osc} from (assoc :from from))]
    (merge base
           (case address
             "/kairotic/note" (cond-> {:type :note :id (nth a 0 0) :gate (not= 0 (nth a 3 1))}
                                (number? (get a 1)) (assoc :freq (r (get a 1)))
                                (and (number? (get a 2)) (not= 0 (nth a 3 1))) (assoc :amp (r (get a 2))))
             "/kairotic/glide" {:type :glide :id (nth a 0 0) :freq (r (nth a 1 0))}
             "/kairotic/cc" {:type :cc :ch (nth a 0 1) :cc (nth a 1 0) :value (r (nth a 2 0))}
             "/kairotic/pressure" {:type :pressure :id (nth a 0 0) :value (r (nth a 1 0))}
             "/kairotic/tilt" {:type :tilt :x (r (nth a 0 0.5)) :y (r (nth a 1 0.5))}
             "/kairotic/shake" {:type :shake :value (r (nth a 0 0))}
             ("/kairotic/clock" "/kairotic/start" "/kairotic/stop" "/kairotic/continue")
             {:type (keyword (subs address 10))}
             {:type :osc :address address :args (mapv r a)}))))

(defn- pattern-re
  "An OSC address pattern (OSC 1.0) as a regular expression: ? one character, * any run, [abc] [a-z]
   [!a] one of (or none of) them, {foo,bar} one of the words; none of them crosses a /."
  [p]
  (loop [cs (seq p) out "^"]
    (if-not cs
      (js/RegExp. (str out "$"))
      (let [c (first cs)]
        (case c
          "?" (recur (next cs) (str out "[^/]"))
          "*" (recur (next cs) (str out "[^/]*"))
          "[" (let [body (take-while #(not= "]" %) (next cs))
                    neg (= "!" (first body))
                    body (apply str (if neg (rest body) body))]
                (recur (next (drop-while #(not= "]" %) (next cs)))
                       (str out "[" (when neg "^") (.replace body (js/RegExp. "[\\\\^]" "g") "\\$&") "]")))
          "{" (let [body (apply str (take-while #(not= "}" %) (next cs)))
                    alts (map #(.replace % (js/RegExp. "[.*+?^${}()|[\\]\\\\]" "g") "\\$&") (.split body ","))]
                (recur (next (drop-while #(not= "}" %) (next cs))) (str out "(?:" (apply str (interpose "|" alts)) ")")))
          (recur (next cs) (str out (.replace c (js/RegExp. "[.*+?^${}()|[\\]\\\\]" "g") "\\$&"))))))))

(defn osc-match?
  "Whether an address matches an OSC address pattern (an empty pattern matches every address)."
  [pattern address]
  (or (empty? pattern) (boolean (.test (pattern-re pattern) address))))

;; ───────── the stream between pages ─────────
;; Events travel between the pages of a room as JSON (over a WebRTC data channel, or through the relay
;; while there is none). A keyword value is written ":name" and read back as a keyword; keys are always
;; keywords. What arrives is taken with {:src :net :peer id} and the source it had, as :via.

(defn ->wire
  "An event as a JS object to send."
  [e]
  (clj->js (into {} (map (fn [[k v]] [(name k) (cond (keyword? v) (str ":" (name v))
                                                      (vector? v) (mapv #(if (keyword? %) (str ":" (name %)) %) v)
                                                      :else v)]) e))))

(defn <-wire
  "An event from a peer: its fields back, its source kept as :via."
  [obj peer]
  (let [kw (fn [v] (if (and (string? v) (> (count v) 1) (= ":" (subs v 0 1))) (keyword (subs v 1)) v))
        e (into {} (map (fn [[k v]] [(keyword k) (if (vector? v) (mapv kw v) (kw v))]) (js->clj obj)))]
    (-> e (assoc :via (:src e) :src :net :peer peer))))

;; ───────── a clock to agree on ─────────
;; Every page asks the relay for its time (ping → pong): sent at t0, the relay's time ts, back at t1, all
;; in ms. If the way there and the way back take as long, the relay's clock is ahead of the page's by
;; ts − (t0 + t1)/2, give or take half the round trip. Of the last samples the third with the shortest
;; trips is kept, and its median is the offset: a page that adds it to its own time reads the relay's
;; time, and so do the others — that is the shared time, whatever each machine's clock says.
;;
;; A tempo is {:t0 shared-ms :bpm b}: beat 0 at t0. Every page computes beats from the shared time, so a
;; tempo started on one page is the same beat on all of them.

(def clock-keep 24)

(defn new-clock [] {:samples []})

(defn clock-sample
  "The clock with one more sample (t0 sent, ts the relay's time, t1 back, ms)."
  [c t0 ts t1]
  (let [rtt (- t1 t0)]
    (if (neg? rtt)
      c
      (update c :samples (fn [ss] (vec (take-last clock-keep (conj ss {:rtt rtt :offset (- ts (/ (+ t0 t1) 2))}))))))))

(defn- median [xs] (let [v (vec (sort xs)) n (count v)]
                     (when (pos? n) (if (odd? n) (v (quot n 2)) (/ (+ (v (dec (quot n 2))) (v (quot n 2))) 2)))))

(defn clock-offset
  "The relay's time minus this page's, in ms (nil before any sample)."
  [c]
  (let [ss (sort-by :rtt (:samples c))]
    (median (map :offset (take (max 1 (js/Math.ceil (/ (count ss) 3))) ss)))))

(defn clock-error "Half the shortest round trip: how far off the offset can be, in ms." [c]
  (when (seq (:samples c)) (/ (apply min (map :rtt (:samples c))) 2)))

(defn shared-time "This page's time (ms) as shared time." [c local] (when-let [o (clock-offset c)] (+ local o)))

(defn beat-at "The beat at shared time t (ms)." [{:keys [t0 bpm]} t] (/ (* (- t t0) bpm) 60000))
(defn time-of-beat "The shared time (ms) of beat b." [{:keys [t0 bpm]} b] (+ t0 (/ (* b 60000) bpm)))

(defn beats-between
  "The whole beats from shared time a (included) to b (excluded), as [beat time]."
  [tempo a b]
  (let [first-b (js/Math.ceil (beat-at tempo a))]
    (vec (take-while (fn [[_ t]] (< t b))
                     (map (fn [k] [k (time-of-beat tempo k)]) (iterate inc first-b))))))

;; ───────── printing ─────────

(defn edn
  "An event as one line of EDN, its keys in a readable order."
  [e]
  (let [order [:src :via :peer :type :address :args :pad :id :ch :note :button :axis :name :cc :freq :amp :x :y :value :gate :from]
        ks (concat (filter #(contains? e %) order) (sort (remove (set order) (keys e))))]
    (str "{" (apply str (interpose " " (map (fn [k] (str k " " (pr-str (get e k)))) ks))) "}")))
