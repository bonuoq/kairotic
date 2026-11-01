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

;; report
(let [rs @results failed (remove second rs)
      text (str (- (count rs) (count failed)) " / " (count rs) " pass"
                (apply str (map (fn [[w]] (str "\n✗ " w)) failed)))]
  (set! (.-textContent (js/document.getElementById "out")) text)
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first failed)})))
