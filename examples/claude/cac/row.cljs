;; about: a twelve-tone row and its forms (P, R, I, RI and transpositions); a bang plays its next note
;; row · a twelve-tone row and its forms
{;; ── about ──
 :class "row"
 :license "MPL-2.0"
 :doc "A twelve-tone row and its forms. A bang sends the next note of the current form as MIDI (from base) on the left, and its position on the right. [:p n] [:r n] [:i n] [:ri n] choose the form and its transposition (and start it again); a list of twelve pitch classes sets the row."
 :usage "row [base]"
 :io [1 2]

 ;; ── arguments ──
 :args [[:base 60]]

 ;; ── logic ──
 :receive (fn [{:keys [state value args]}]
            (let [st (or state {:row [0 11 7 8 3 1 2 10 6 5 4 9] :form :p :t 0 :pos 0})
                  {:keys [row form t pos]} st
                  r0 (first row)
                  prime (mapv (fn [x] (mod (+ x t) 12)) row)
                  inv (mapv (fn [x] (mod (+ t r0 (- r0 x)) 12)) row)
                  series (case form :p prime :r (vec (rseq prime)) :i inv :ri (vec (rseq inv)) prime)]
              (cond
                (= value :bang)
                {:state (assoc st :pos (mod (inc pos) 12))
                 :out [[1 pos] [0 (+ (:base args) (nth series pos))]]
                 :show (str (name form) t " " (inc pos) "/12")}

                (and (vector? value) (#{:p :r :i :ri} (first value)))
                (let [st (assoc st :form (first value) :t (mod (or (second value) 0) 12) :pos 0)]
                  {:state st :show (str (name (:form st)) (:t st))})

                (and (sequential? value) (= 12 (count value)) (every? number? value)
                     (= 12 (count (set (map #(mod % 12) value)))))
                {:state (assoc st :row (mapv #(mod % 12) value) :pos 0) :show "new row"}

                :else {:state st})))}
