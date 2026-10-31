;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · the form of what is heard or played (kairotic.structure, issue #120)
(ns kairotic.test.structure
  (:require [kairotic.structure :as st]
            [kairotic.test :as t]))

(defn- r2 [x] (/ (js/Math.round (* 100 x)) 100))

(t/run! "self-similarity (kairotic.structure)"
  (fn []
    (let [a [1 0 0] b [0 1 0]
          S (st/ssm [a a b b])]
      (t/eq "the SSM: the cosine of every two frames" (mapv (fn [[i j]] (r2 (st/at S i j))) [[0 1] [0 2] [2 3] [1 0]]) [1 0 1 1])
      (t/eq "... of size n × n" (:n S) 4))
    ;; two sections: A for 12 frames, then B for 12
    (let [S (st/ssm (concat (repeat 12 [1 0.1 0]) (repeat 12 [0 0.1 1])))
          nov (st/novelty S 4)]
      (t/eq "novelty peaks where the music changes" (apply max-key nov (range (count nov))) 12)
      (t/eq "the boundaries of the segments" (st/boundaries nov {:shortest 4 :longest 40}) [0 12])
      (t/eq "the novelty of one frame, for a stream: 0 where nothing changes, high at the change, nil at the edge"
            [(r2 (st/novelty-at S 4 6)) (> (st/novelty-at S 4 12) 0.3) (st/novelty-at S 4 2) (st/novelty-at S 4 21)] [0 true nil nil]))
    ;; a pattern of 3 frames that repeats: its period
    (let [S (st/ssm (take 30 (cycle [[1 0 0] [0 1 0] [0 0.3 1]])))
          bs (st/beat-spectrum S 8)]
      (t/eq "the beat spectrum: the lag 0 is 1" (r2 (first bs)) 1)
      (t/eq "... and its strongest period is the pattern's" (ffirst (st/periods bs)) 3))
    (t/eq "a segment longer than the longest is cut" (count (st/boundaries (vec (repeat 100 0)) {:shortest 8 :longest 30})) 4)
    (let [fs (st/note-frames [{:on 0 :off 1 :attrs {:pitch 60 :vel 1}} {:on 1 :off 2 :attrs {:pitch 67}}] [0 1 2])]
      (t/eq "notes as frames: pitch classes, then onset strength and count" (count (first fs)) 14)
      (t/eq "... C in the first frame, G in the second" [(pos? ((first fs) 0)) (pos? ((second fs) 7)) (zero? ((first fs) 7))] [true true true]))))
