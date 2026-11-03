;; SPDX-License-Identifier: MPL-2.0
;; Study 34 · io: the model's tests. Open tests/io.html (served, as the study) to run them.

(ns io-tests
  (:require [kairotic.io :as io]))

(def results (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))
(defn near? [a b eps] (< (js/Math.abs (- a b)) eps))
(defn run-in [st bytes-list] (reduce (fn [[st es] b] (let [[st e] (io/in-bytes st b)] [st (into es e)])) [st []] bytes-list))
(defn cents [a b] (* 1200 (/ (js/Math.log (/ a b)) (js/Math.log 2))))

;; bytes ⇄ messages
(doseq [m [{:type :note-on :ch 3 :note 61 :vel 99} {:type :note-off :ch 16 :note 0 :vel 0}
           {:type :cc :ch 1 :cc 74 :value 127} {:type :bend :ch 2 :value -8192} {:type :bend :ch 2 :value 8191}
           {:type :bend :ch 5 :value 0} {:type :pressure :ch 9 :value 40} {:type :poly :ch 1 :note 60 :value 3}
           {:type :program :ch 10 :value 5} {:type :clock} {:type :start} {:type :stop}]]
  (is (str "round trip " (pr-str m)) (= m (io/decode (io/encode m)))))
(is "note-on with velocity 0 is a note-off" (= :note-off (:type (io/decode [0x90 60 0]))))
(is "sysex is not read" (nil? (io/decode [0xF0 1 2 0xF7])))

;; in: notes, ids, sounding
(let [[st es] (run-in (io/new-in) [[0x90 69 127] [0x91 60 64]])]
  (is "a note-on is an event with Hz" (= 440 (:freq (first es))))
  (is "amp from velocity" (= 1 (:amp (first es))))
  (is "voice id: note + 128 per channel" (= 188 (:id (second es))))
  (is "sounding, most recent first" (= [188 69] (:ids (io/sounding st))))
  (let [[st2 es2] (io/in-bytes st [0x80 69 0])]
    (is "note-off ends that voice" (and (false? (:gate (first es2))) (= 69 (:id (first es2)))))
    (is "and it no longer sounds" (= [188] (:ids (io/sounding st2))))))
(is "a note-off with nothing held says nothing" (empty? (second (io/in-bytes (io/new-in) [0x80 60 0]))))

;; in: bend moves the notes of its channel; RPN 0 sets the range
(let [[st es] (run-in (io/new-in) [[0x90 69 100] [0x91 69 100] [0xE0 0x7F 0x7F]])
      g (filter #(= :glide (:type %)) es)]
  (is "bend glides only the notes on its channel" (= [69] (map :id g)))
  (is "full bend up = +2 semitones by default" (near? (cents (:freq (first g)) 440) 200 0.5))
  (is "the other channel keeps its pitch" (= 440 (get-in st [:held 197 :freq]))))
(let [rpn [[0xB1 101 0] [0xB1 100 0] [0xB1 6 48] [0xB1 38 0]]
      [st es] (run-in (io/new-in) (concat rpn [[0x91 60 100] [0xE1 0 0]]))]
  (is "RPN 0 is read, not passed on as CCs" (not-any? #(= :cc (:type %)) es))
  (is "and sets the range: full bend down = −48" (near? (cents (:freq (last es)) (io/midi->hz 60)) -4800 0.5)))
(let [[_ es] (run-in (io/new-in) [[0xB0 74 127]])]
  (is "cc as 0…1" (= {:src :midi :type :cc :ch 1 :cc 74 :value 1} (first es))))
(let [[_ es] (run-in (io/new-in) [[0x92 60 100] [0xD2 64 0]])]
  (is "channel pressure names the note on that channel" (= (io/voice-id 3 60) (:id (last es)))))

;; out :plain
(let [[st ms] (io/out-step (io/new-out) {:type :note :id 1 :freq 450 :amp 0.5 :gate true})]
  (is "plain: nearest key, velocity from amp" (= [{:type :note-on :ch 1 :note 69 :vel 64}] ms))
  (is "plain: a glide sends nothing" (empty? (second (io/out-step st {:type :glide :id 1 :freq 460}))))
  (is "plain: note-off of that key" (= [{:type :note-off :ch 1 :note 69 :vel 0}] (second (io/out-step st {:type :note :id 1 :gate false})))))

;; out :mpe — microtones survive the round trip through bytes
(let [o (io/new-out {:mode :mpe :range 48})
      notes [{:id 1 :freq 261.6256} {:id 2 :freq 311.127} {:id 3 :freq (* 261.6256 (/ 7 4))} {:id 4 :freq 1000}]
      [o ms] (io/out-events o (map #(assoc % :type :note :gate true :amp 0.7) notes))
      chs (set (map :ch (filter #(= :note-on (:type %)) ms)))
      ;; back in, with an input that knows the range (as after mpe-setup)
      [st es] (run-in (io/new-in {:range 48}) (map io/encode ms))
      hz (into {} (map (fn [e] [(:id e) (:freq e)]) (filter :gate es)))]
  (is "mpe: one channel per note, from 2" (= #{2 3 4 5} chs))
  (is "mpe: a bend before each note-on" (= [:bend :note-on] (map :type (take 2 ms))))
  (is "mpe: 7/4 (−31 cents from A#) comes back within 1 cent"
      (near? (cents (get hz (io/voice-id 4 (:key (get-in o [:voices 3])))) (* 261.6256 (/ 7 4))) 0 1))
  (is "mpe: 1000 Hz comes back within 1 cent" (near? (cents (get hz (io/voice-id 5 (:key (get-in o [:voices 4])))) 1000) 0 1))
  (let [[o2 ms2] (io/out-step o {:type :glide :id 1 :freq 277.18})
        [_ es2] (run-in st (map io/encode ms2))]
    (is "mpe: a glide is a bend on that note's channel only" (= [2] (map :ch ms2)))
    (is "mpe: and comes back as a glide of that voice" (near? (cents (:freq (first es2)) 277.18) 0 1)))
  (let [[o3 ms3] (io/out-step o {:type :note :id 2 :gate false})
        [o4 ms4] (io/out-step o3 {:type :note :id 9 :freq 500 :gate true})]
    (is "mpe: a note-off frees its channel" (= [{:type :note-off :ch 3 :note 63 :vel 0}] ms3))
    (is "mpe: the next note takes a free channel" (= 6 (:ch (last ms4))))))
(let [o (io/new-out {:mode :mpe :zone 2})
      [o ms] (io/out-events o (for [i [1 2 3]] {:type :note :id i :freq (* 200 i) :gate true}))]
  (is "mpe: with every channel busy the oldest voice is stolen"
      (and (= {:type :note-off :ch 2 :note (:key {:key (first (io/note-and-bend 200 48))}) :vel 0}
              (first (filter #(= :note-off (:type %)) ms)))
           (nil? (get-in o [:voices 1])) (= 2 (get-in o [:voices 3 :ch])))))
(is "note-and-bend: far beyond the range, the key moves"
    (let [[k b] (io/note-and-bend 440 2)] (and (= 69 k) (= 0 b))))
(let [ms (io/mpe-setup (io/new-out {:mode :mpe :zone 15 :range 48}))]
  (is "mpe setup: MCM on channel 1 with 15 members" (= [101 100 6] (map :cc (take 3 ms))))
  (is "mpe setup: range on every member channel" (= (set (range 2 17)) (set (map :ch (filter #(= 6 (:cc %)) (drop 5 ms)))))))
(let [[o _] (io/out-events (io/new-out {:mode :mpe}) [{:type :note :id 1 :freq 300 :gate true} {:type :note :id 2 :freq 400 :gate true}])
      [o2 ms] (io/all-off o)]
  (is "all-off ends every voice" (and (= 2 (count ms)) (empty? (:voices o2)) (= 15 (count (:free o2))))))

;; snapshots → events
(let [es (io/diff {:hz [] :ids []} {:hz [440 330] :ids [69 64]} 0.5)]
  (is "diff: new voices start, oldest first" (= [64 69] (map :id es)))
  (is "diff: with the amp" (every? #(= 0.5 (:amp %)) es)))
(let [es (io/diff {:hz [440 330] :ids [69 64]} {:hz [445] :ids [69]})]
  (is "diff: one ends, one glides" (= #{[64 false] [69 :glide]} (set (map (fn [e] [(:id e) (if (= :glide (:type e)) :glide (:gate e))]) es)))))

;; recording into a freqt
(let [r (-> (io/rec-start 10)
            (io/rec-step 10.5 {:type :note :id 1 :freq 440 :amp 0.5 :gate true})
            (io/rec-step 11 {:type :glide :id 1 :freq 466.164})
            (io/rec-step 11.5 {:type :note :id 1 :gate false})
            (io/rec-step 12 {:type :note :id 2 :freq 220 :gate true}))
      d (io/rec-data r 13)]
  (is "rec: a staircase stroke for a glided note" (= [[0.5 440] [1 440] [1 466.164] [1.5 466.164]] (get-in d [:strokes :m1 :pts])))
  (is "rec: amp as weight" (= {:w 1.5} (get-in d [:strokes :m1 :look])))
  (is "rec: a held note reaches now" (= [[2 220] [3 220]] (get-in d [:strokes :m2 :pts]))))

(is "edn: keys in a readable order" (= "{:src :midi :type :note :id 60 :freq 440 :gate true}"
                                        (io/edn {:gate true :freq 440 :id 60 :type :note :src :midi})))

;; motion
(is "tilt: flat is the middle" (= [0.5 0.5] (io/tilt-xy 0 0)))
(is "tilt: right and away are 1" (= [1 1] (io/tilt-xy 120 90)))
(let [m (io/new-motion {:smooth 0})
      [m e1] (io/motion-step m 0 {:alpha 10 :beta 0 :gamma 45})
      [m e2] (io/motion-step m 0.01 {:alpha 10 :beta 0 :gamma 45.1})
      [m e3] (io/motion-step m 0.02 {:alpha 10 :beta 18 :gamma 45})]
  (is "motion: the first reading is sent" (= {:src :motion :type :tilt :x 0.75 :y 0.5 :beta 0 :gamma 45 :alpha 10} (first e1)))
  (is "motion: a change below eps is not" (empty? e2))
  (is "motion: a real change is" (= 0.6 (:y (first e3)))))
(let [[m _] (io/motion-step (io/new-motion {:smooth 0.5}) 0 {:beta 0 :gamma 0})
      [_ e] (io/motion-step m 0.01 {:beta 0 :gamma 90})]
  (is "motion: smoothing goes half way" (= 0.75 (:x (first e)))))
(let [m (io/new-motion)
      [m e1] (io/motion-step m 0 {:acc [3 2 1]})
      [m e2] (io/motion-step m 0.1 {:acc [20 0 0]})
      [m e3] (io/motion-step m 0.2 {:acc [25 0 0]})
      [m e4] (io/motion-step m 0.5 {:acc [0 18 0]})
      [_ e5] (io/motion-step (io/new-motion) 0 {:accg [0 0 30]})]
  (is "shake: a small move is not a shake" (empty? e1))
  (is "shake: a strong one is" (= [{:src :motion :type :shake :value 20}] e2))
  (is "shake: one shake is one event (the pause after it)" (empty? e3))
  (is "shake: after the pause, another" (= 18 (:value (first e4))))
  (is "shake: with gravity, gravity is taken out" (near? (:value (first e5)) 20.2 0.1)))

;; gamepads
(defn pad [axes buttons] {:index 0 :id "Test pad" :mapping "standard" :axes axes :buttons buttons})
(def rest-buttons (vec (repeat 17 [false 0])))
(let [g (io/new-pads)
      [g e1] (io/pads-step g [(pad [0.05 -0.03 0 0] rest-buttons)])
      [g e2] (io/pads-step g [(pad [0.05 -0.03 0 0] (assoc rest-buttons 0 [true 1]))])
      [g e3] (io/pads-step g [(pad [0.56 0 0 0] (assoc rest-buttons 0 [true 1] 7 [false 0.4]))])
      [g e4] (io/pads-step g [(pad [0.08 0 0 0] (assoc rest-buttons 7 [true 0.9]))])
      [g e5] (io/pads-step g [nil])]
  (is "pad: connecting is an event, and a stick at rest says nothing" (= [{:src :gamepad :type :connect :pad 0 :name "Test pad"}] e1))
  (is "pad: a press, with the standard name" (= [{:src :gamepad :pad 0 :type :button :button 0 :name :a :value 1 :gate true}] e2))
  (is "pad: an analogue button moves, without a gate" (some #(= {:src :gamepad :pad 0 :type :button :button 7 :name :rt :value 0.4} %) e3))
  (is "pad: the dead zone is taken out of a stick" (some #(and (= :lx (:name %)) (= 0.5 (:value %))) e3))
  (is "pad: a release, a trigger pressed past its threshold, the stick back to 0"
      (= #{[:a false] [:rt true] [:lx 0]} (set (map (fn [e] [(:name e) (if (= :axis (:type e)) (:value e) (:gate e))]) e4))))
  (is "pad: unplugging is an event" (= [{:src :gamepad :type :disconnect :pad 0}] e5)))
(is "pad: without the standard mapping, no names"
    (let [es (second (io/pads-step (io/new-pads) [(assoc (pad [0.9] []) :mapping "")]))
          ax (filter #(= :axis (:type %)) es)]
      (and (= 1 (count ax)) (nil? (:name (first ax))))))

;; OSC
(is "osc: a note out" (= {:address "/kairotic/note" :types "iffi" :args [60 261.626 0.5 1]}
                         (io/event->osc {:src :keyboard :type :note :id 60 :freq 261.626 :amp 0.5 :gate true})))
(is "osc: a note-off out keeps four values" (= [60 0 0 0] (:args (io/event->osc {:type :note :id 60 :gate false}))))
(is "osc: a pad button by name, with its gate" (= {:address "/kairotic/pad/rt" :types "fi" :args [0.9 1]}
                                                   (io/event->osc {:src :gamepad :type :button :button 7 :name :rt :value 0.9 :gate true})))
(is "osc: a pad axis without a name" (= "/kairotic/pad/a5" (:address (io/event->osc {:type :axis :axis 5 :value 0.2}))))
(is "osc: what came from OSC is not sent back" (nil? (io/event->osc {:src :osc :type :osc :address "/x" :args []})))
(doseq [e [{:type :note :id 60 :freq 261.626 :amp 0.5 :gate true} {:type :note :id 60 :gate false}
           {:type :glide :id 3 :freq 300.5} {:type :cc :ch 2 :cc 74 :value 0.25}
           {:type :tilt :x 0.25 :y 0.75} {:type :shake :value 21.5} {:type :start}]]
  (is (str "osc: round trip " (pr-str e))
      (let [back (dissoc (io/osc->event (io/event->osc e)) :src)]
        (= (if (false? (:gate e)) (assoc e :freq 0) e) back))))
(is "osc: any other address as it is" (= {:src :osc :type :osc :address "/synth/1/cut" :args [0.5 "lp"] :from "127.0.0.1:57120"}
                                          (io/osc->event {:address "/synth/1/cut" :args [0.5 "lp"] :from "127.0.0.1:57120"})))
(doseq [[p a ok] [["" "/any/thing" true] ["/kairotic/*" "/kairotic/note" true] ["/kairotic/*" "/kairotic/pad/a" false]
                  ["/kairotic/*/*" "/kairotic/pad/a" true] ["/synth/?/cut" "/synth/3/cut" true] ["/synth/?/cut" "/synth/12/cut" false]
                  ["/synth/[1-3]/cut" "/synth/2/cut" true] ["/synth/[!1-3]/cut" "/synth/2/cut" false]
                  ["/{note,glide}" "/glide" true] ["/{note,glide}" "/cc" false] ["/a.b" "/axb" false] ["/a.b" "/a.b" true]]]
  (is (str "osc pattern " p " ~ " a " = " ok) (= ok (io/osc-match? p a))))

;; the stream between pages
(let [e {:src :gamepad :type :button :pad 0 :button 0 :name :a :value 1 :gate true :ids [:x 2]}
      back (io/<-wire (js/JSON.parse (js/JSON.stringify (io/->wire e))) "p3")]
  (is "wire: keywords survive JSON" (= (assoc (dissoc e :src) :via :gamepad :src :net :peer "p3") back)))
(is "wire: a plain string stays a string" (= "Fake pad" (:name (io/<-wire (io/->wire {:src :gamepad :type :connect :name "Fake pad"}) "p1"))))

;; the clock
(let [;; the relay 500 ms ahead; trips of 10…80 ms, some of them lopsided (there slower than back)
      samples [[0 510 20] [100 700 180] [200 706 212] [300 830 360] [400 905 410] [500 1000 620]]
      c (reduce (fn [c [t0 ts t1]] (io/clock-sample c t0 ts t1)) (io/new-clock) samples)]
  (is "clock: offset from the shortest trips" (near? (io/clock-offset c) 500 1.5))
  (is "clock: error is half the shortest trip" (= 5 (io/clock-error c)))
  (is "clock: shared time" (near? (io/shared-time c 1000) 1500 1.5))
  (is "clock: a sample that goes back in time is dropped" (= 6 (count (:samples (io/clock-sample c 50 0 40))))))
(is "clock: nothing before any sample" (and (nil? (io/clock-offset (io/new-clock))) (nil? (io/shared-time (io/new-clock) 5))))
(is "clock: keeps the last samples only"
    (= io/clock-keep (count (:samples (reduce (fn [c i] (io/clock-sample c i i (inc i))) (io/new-clock) (range 50))))))
(let [tempo {:t0 10000 :bpm 120}]
  (is "tempo: beat at a time" (= 2 (io/beat-at tempo 11000)))
  (is "tempo: time of a beat" (= 11500 (io/time-of-beat tempo 3)))
  (is "tempo: the beats in a window" (= [[2 11000] [3 11500]] (io/beats-between tempo 10800 11600)))
  (is "tempo: before t0, negative beats" (= [[-1 9500]] (io/beats-between tempo 9400 9900))))

;; serial
(is "serial: numbers by spaces" (= [{:src :serial :type :serial :values [512 300 1]}] (io/serial-line "512 300 1")))
(is "serial: by commas, negative and decimal" (= [-1.5 0 0.25] (:values (first (io/serial-line "-1.5,0,.25\r")))))
(is "serial: key:value and key=value, one event each"
    (= [{:src :serial :type :serial :key "pot" :value 512} {:src :serial :type :serial :key "light" :value 300}]
       (io/serial-line "pot:512 light=300")))
(is "serial: a key with a word" (= {:src :serial :type :serial :key "state" :text "on"} (first (io/serial-line "state:on"))))
(is "serial: anything else as text" (= [{:src :serial :type :serial :text "hello from the board"}] (io/serial-line "hello from the board")))
(is "serial: an empty line says nothing" (empty? (io/serial-line "  ")))
(let [[s1 e1] (io/serial-chunk (io/new-serial) "pot:5")
      [s2 e2] (io/serial-chunk s1 "12\r\n1 2")
      [s3 e3] (io/serial-chunk s2 " 3\n\n")]
  (is "serial: a line cut in two waits" (and (empty? e1) (= "pot:5" (:buf s1))))
  (is "serial: and is read when it ends" (= [{:src :serial :type :serial :key "pot" :value 512}] e2))
  (is "serial: the next one too" (and (= [1 2 3] (:values (first e3))) (= "" (:buf s3)))))
(is "serial: a line that never ends is dropped" (= "" (:buf (first (io/serial-chunk (io/new-serial) (apply str (repeat 600 "x")))))))
(is "serial → osc: values" (= {:address "/kairotic/serial" :args [1 2]} (io/event->osc {:src :serial :type :serial :values [1 2]})))
(is "serial → osc: a key" (= {:address "/kairotic/serial/pot" :types "f" :args [512]} (io/event->osc {:src :serial :type :serial :key "pot" :value 512})))

;; report
(let [rs @results failed (remove second rs)
      text (str (- (count rs) (count failed)) " / " (count rs) " pass"
                (apply str (map (fn [[w]] (str "\n✗ " w)) failed)))]
  (set! (.-textContent (js/document.getElementById "out")) text)
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first failed)})))
