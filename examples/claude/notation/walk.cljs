;; about: a melody as a musical tree (kairotic.mt): a random walk on a scale, written in measures, for score, mt boxes and mt play
;; walk · a random walk on a scale, as a tree
{;; ── about ──
 :class "walk"
 :license "MPL-2.0"
 :doc "On a bang, a random walk of n notes on a major scale from start, written as a musical tree: a voice in 4/4 measures of eighth notes (the last one completed with a rest). Send it to a freqt shown as a score, to mt boxes or to mt play."
 :usage "walk [notes] [start]"
 :io [1 1]

 ;; ── arguments ──
 :args [[:notes 16] [:start 60]]

 ;; ── help ──
 :help {:inlets ["bang: a new melody"]
        :outlets ["a musical tree [:voice [:measure …] …]"]
        :try "Connect it to a freqt shown as a score ((view :bN :score)) and click a bang: each click, another walk. Then put an mt retrograde between them."}

 ;; ── logic ──
 ;; A tree is plain data: notes are [:note {:pitch "e4" :dur 0.5}] and the functions of kairotic.mt
 ;; (mt/pitch-name, mt/transpose, mt/events …) work on it, so the component only builds the vector.
 :receive (fn [{:keys [args value]}]
            (if (= value :bang)
              (let [scale [0 2 4 5 7 9 11]
                    n (max 1 (js/Math.round (:notes args)))
                    degrees (reductions + 0 (repeatedly (dec n) (fn [] (rand-nth [-2 -1 1 1 2]))))
                    midi (fn [d] (+ (:start args) (* 12 (js/Math.floor (/ d 7))) (nth scale (mod d 7))))
                    notes (mapv (fn [d] [:note {:pitch (mt/pitch-name (midi d)) :dur 0.5}]) degrees)
                    bars (for [bar (partition-all 8 notes)]
                           (into [:measure {:meter [4 4]}]
                                 (concat bar (when (< (count bar) 8) [[:rest {:dur (* 0.5 (- 8 (count bar)))}]]))))]
                {:out [[0 (into [:voice {:name "walk"}] bars)]]})
              {}))}
