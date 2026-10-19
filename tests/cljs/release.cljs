;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · release (issue #45): the changes from one patch to another, and presets kept in a box
(ns kairotic.test.release
  (:require [kairotic.release :as rel]
            [kairotic.test :as t]))

(def p {:boxes (sorted-map :b1 {:text "knob 0 1 0.25" :x 10 :y 10}
                           :b2 {:text "metro 250" :x 100 :y 10 :present [0 0]}
                           :b3 {:text "freqt" :x 10 :y 100 :data {:strokes {:t1 {:pts [[0 220] [1 440]]}}}})
        :lines [[:b1 0 :b2 0] [:b2 0 :b3 0]]})

(t/run! "release"
  (fn []
    (t/eq "the same patch: no changes" (rel/patch-diff p p) [])
    (t/eq "from nothing: every box, with what it keeps, then its lines"
          (rel/patch-diff {:boxes {} :lines []} p)
          [[:box :b1 "knob 0 1 0.25" 10 10]
           [:box :b2 "metro 250" 100 10] [:present :b2 0 0]
           [:box :b3 "freqt" 10 100] [:data :b3 {:strokes {:t1 {:pts [[0 220] [1 440]]}}}]
           [:connect :b1 0 :b2 0] [:connect :b2 0 :b3 0]])
    (let [q (-> p (assoc-in [:boxes :b1 :text] "knob 0 1 0.75")
                (assoc-in [:boxes :b2 :x] 140)
                (update-in [:boxes :b2] dissoc :present)
                (assoc-in [:boxes :b3 :size] [600 300])
                (update :boxes dissoc :b3)
                (assoc-in [:boxes :b4] {:text "print" :x 0 :y 0})
                (assoc :lines [[:b1 0 :b2 0] [:b2 0 :b4 0]]))]
      (t/eq "a text, a place, a presentation removed, a box gone and one new, a line moved"
            (rel/patch-diff p q)
            [[:delete :b3]
             [:text :b1 "knob 0 1 0.75"]
             [:move :b2 140 10] [:present :b2 nil]
             [:box :b4 "print" 0 0]
             [:connect :b2 0 :b4 0]]))
    (t/eq "a buffer that changed is written whole"
          (rel/patch-diff p (assoc-in p [:boxes :b3 :data :strokes :t2] {:pts [[1 1] [2 2]]}))
          [[:data :b3 {:strokes {:t1 {:pts [[0 220] [1 440]]} :t2 {:pts [[1 1] [2 2]]}}}]])
    (t/eq "lines in another order are written again in that order (messages fan out in it)"
          (rel/patch-diff p (assoc p :lines [[:b2 0 :b3 0] [:b1 0 :b2 0]]))
          [[:disconnect :b1 0 :b2 0] [:disconnect :b2 0 :b3 0] [:connect :b2 0 :b3 0] [:connect :b1 0 :b2 0]])
    (t/eq "a size of its own" (rel/patch-diff p (assoc-in p [:boxes :b3 :size] [600 300])) [[:size :b3 600 300]])
    (t/eq "as one event: nothing" (rel/as-event []) nil)
    (t/eq "... one" (rel/as-event [[:move :b1 1 2]]) [:move :b1 1 2])
    (t/eq "... several, a batch" (rel/as-event [[:move :b1 1 2] [:delete :b2]]) [:batch [[:move :b1 1 2] [:delete :b2]]])

    ;; presets kept in a box: only what changes between the keyframes
    (let [kfs [{:label "calm" :kind :snapshot :config {:b1 "knob 0 1 0.25" :b2 "metro 250" :b3 "osc~ 440"}}
               {:label "storm" :kind :snapshot :config {:b1 "knob 0 1 0.75" :b2 "metro 250" :b3 "osc~ 440"}}]]
      (t/eq "presets kept in a box keep only what changes"
            (rel/stored-presets kfs)
            [{:kind :snapshot :label "calm" :texts {:b1 "knob 0 1 0.25"}}
             {:kind :snapshot :label "storm" :texts {:b1 "knob 0 1 0.75"}}])
      (t/eq "... with a single keyframe, every box" (:texts (first (rel/stored-presets (take 1 kfs))))
            {:b1 "knob 0 1 0.25" :b2 "metro 250" :b3 "osc~ 440"}))
    (t/eq "presets that arrive from anyone keep only labels, kinds and texts"
          (rel/sane-presets [{:label "a" :texts {:b1 "knob" :b2 3 "x" "y"} :evil (fn [] 1)} {:texts "no"} 7])
          [{:kind :snapshot :label "a" :texts {:b1 "knob"}}])))
