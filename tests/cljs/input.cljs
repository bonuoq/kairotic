;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · sound from outside and back into messages: adc~, snapshot~, scope~, api/report!
(ns kairotic.test.input
  (:require [kairotic.components :as comp]
            [kairotic.api :as api]
            [kairotic.engine :as eng]
            [kairotic.input :as in]
            [kairotic.test :as t]))

(defn recv [klass m]
  (let [d (comp/lookup klass)]
    ((:receive d) (merge {:args (comp/args-for d (str klass " " (:text m "")))} (dissoc m :text)))))

(t/run! "input"
  (fn []
    (t/is "adc~, snapshot~ and scope~ are core classes"
          (every? comp/lookup ["adc~" "snapshot~" "scope~"]))
    (t/eq "adc~ listens to channel 1 by default" (in/adc-channels {:args []}) [1])
    (t/eq "adc~ 1 2: two channels" (in/adc-channels {:args [1 2]}) [1 2])
    (t/eq "... one outlet per channel and no inlet" (comp/io {:text "adc~ 1 2"}) [0 2])
    (t/is "an error found by adc~ is printed"
          (= [[:print "adc~: denied"]] (:effects (recv "adc~" {:inlet :audio :value {:error "adc~: denied"}}))))

    ;; snapshot~: [last rms peak] blocks from the tap
    (let [block (fn [l r p] [#js [l r p]])]
      (let [r (recv "snapshot~" {:inlet :audio :value (block 0.25 0.5 0.9)})]
        (t/eq "snapshot~ sends the last value" (:out r) [[0 0.25]])
        (t/eq "... and keeps it" (:state r) 0.25)
        (t/eq "the same value again sends nothing" (recv "snapshot~" {:inlet :audio :value (block 0.25 0.5 0.9) :state 0.25}) {}))
      (t/eq "snapshot~ 50 rms sends the level" (:out (recv "snapshot~" {:text "50 rms" :inlet :audio :value (block 0 0.5 0.9)})) [[0 0.5]])
      (t/eq "snapshot~ peak sends the peak" (:out (recv "snapshot~" {:text "peak" :inlet :audio :value (block 0 0.5 0.9)})) [[0 0.9]])
      (t/eq "snapshot~ db: the rms in decibels" (:out (recv "snapshot~" {:text "db" :inlet :audio :value (block 0 0.1 0.9)})) [[0 -20]])
      (t/eq "a bang sends the last value again" (:out (recv "snapshot~" {:value :bang :state 0.3})) [[0 0.3]])
      (t/eq "a number changes the interval (within 5 ms … 10 s)" (:effects (recv "snapshot~" {:value 2})) [[:ms 5]]))
    (t/eq "levels on the bar: dB from -60 to 0" [(in/level-unit :db -30) (in/level-unit :rms 2) (in/level-unit nil 0.5)] [0.5 1 nil])
    (t/eq "api/db" [(api/db 1) (api/db 0)] [0 -100])

    ;; scope~
    (let [col (js/Float32Array. (clj->js (mapcat (fn [i] [(- (/ i 10)) (/ i 10)]) (range 10))))
          pts (in/trace-points col 1)]
      (t/eq "a trace: a min and a max point per column" (count pts) 20)
      (t/eq "... from x 4 to 164" [(ffirst pts) (first (last pts))] [4 164])
      (t/is "... inside the box, however big the zoom" (every? (fn [[_ y]] (<= 4 y 80)) (in/trace-points col 64))))
    (let [r (recv "scope~" {:text "20 2" :inlet :audio :value [(js/Float32Array. #js [-0.5 0.5 -0.5 0.5])]})]
      (t/eq "scope~ shows the picture with its time and zoom" (select-keys (:show r) [:ms :zoom]) {:ms 20 :zoom 2})
      (t/eq "... and sends nothing" (:out r) nil))
    (t/eq "dragging up zooms in, from what it showed on press"
          (:zoom ((:gesture (comp/lookup "scope~")) {:start {:ms 20 :zoom 1} :dx 0 :dy -40 :args {:ms 20 :zoom 1}}))
          2)
    (t/eq "a drag value sets the view and the time it listens to"
          (recv "scope~" {:value {:ms 40 :zoom 2}}) {:state {:ms 40 :zoom 2} :effects [[:ms 40]]})

    ;; the bridge: only a box that sounds, only while the engine runs
    (t/is "api/report! reaches the engine" (fn? @comp/audio-report))
    (let [before (count (:queue @eng/rt))]
      (when-not (eng/running?) (api/report! :nobody 1 0))
      (t/eq "a report with the engine stopped is dropped" (count (:queue @eng/rt)) before))))
