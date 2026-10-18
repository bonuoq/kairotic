;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · what a canvas or freqt takes on its left inlet (issue #26)
(ns kairotic.test.canvasmsg
  (:require [kairotic.components :as comp]
            [kairotic.canvas :as cv]
            [kairotic.test :as t]))

(defn recv [klass data value]
  ((:receive (comp/lookup klass)) {:inlet 0 :value value :state nil :data data}))

(def d (-> cv/generic-empty (cv/step [:stroke :t1 [[0 0] [1 1]]]) (cv/step [:stroke :t2 [[0.5 0.2] [0.8 0.9]]])))

(t/run! "canvas messages"
  (fn []
    (t/eq "a number still goes through" (:out (recv "canvas" d 0.5)) [[0 0.5]])
    (t/is "a tree is still shown" (= [:voice "c4"] (get-in (recv "canvas" d [:voice "c4"]) [:state :tree])))
    (t/eq "a stroke by message gets a new id" (get-in (recv "canvas" d [:stroke [[0 1] [1 0]]]) [:effects 0])
          [:canvas-edit [[:stroke :t3 [[0 1] [1 0]]]]])
    (t/eq "a batch: new ids one after the other, what changes nothing left out"
          (get-in (recv "canvas" d [:batch [[:stroke [[0 0] [1 0]]] [:erase :t9] [:stroke [[0 1] [1 1]]] [:erase :t1]]]) [:effects 0 1])
          [[:stroke :t3 [[0 0] [1 0]]] [:stroke :t4 [[0 1] [1 1]]] [:erase :t1]])
    (t/is "an edit that changes nothing says so" (= :print (get-in (recv "canvas" d [:erase :t9]) [:effects 0 0])))
    (t/eq "the axis by message" (get-in (recv "canvas" d [:axis :y -1 1]) [:effects 0 1 0 1 :y]) {:lo -1 :hi 1 :log false})
    (t/eq "a note on a freqt, by name" (get-in (recv "freqt" nil [:note 0 "a4" 1]) [:effects 0 1 0]) [:stroke :t1 [[0 440] [1 440]]])
    (t/is "a note node of a tree is not an edit" (nil? (:effects (recv "freqt" nil [:note {:pitch "a4"}]))))
    (t/eq "[:strokes] answers on the left" (:out (recv "canvas" d [:strokes])) [[0 [:t1 :t2]]])
    (t/eq "[:read x]" (:out (recv "canvas" d [:read 0.5])) [[0 [[:t1 0.5] [:t2 0.2]]]])
    (t/eq "[:get id]" (:out (recv "canvas" d [:get :t2])) [[0 [[0.5 0.2] [0.8 0.9]]]])
    (t/eq "[:count]" (:out (recv "canvas" d [:count])) [[0 2]])
    (t/eq "a batch is one event of the buffer" (count (:strokes (cv/step d [:batch [[:clear] [:stroke :t1 [[0 0] [1 1]]]]]))) 1)))
