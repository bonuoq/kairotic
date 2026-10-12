;; about: turns frequencies (Hz) or MIDI notes into note names with cents ("A4", "C#5 +14c"); for labels and scores
;; note-name · a frequency or MIDI note as a note name
{;; ── about ──
 :class "note-name"
 :license "MPL-2.0"
 :doc "Turns a frequency in Hz (or a MIDI note with `midi`) into its note name, with the deviation in cents when it is not tempered: 440 → \"A4\", 450 → \"A4 +39c\". A list gives a list of names. Optional reference for A4 (440)."
 :usage "note-name [a4] [midi]"
 :io [1 1]

 ;; ── arguments ──
 :args [[:a4 440] [:midi false]]

 ;; ── logic ──
 :receive (fn [{:keys [value args]}]
            (let [names ["C" "C#" "D" "D#" "E" "F" "F#" "G" "G#" "A" "A#" "B"]
                  as-midi (fn [x] (if (:midi args) x (+ 69 (* 12 (/ (js/Math.log (/ x (:a4 args))) (js/Math.log 2))))))
                  name-of (fn [x]
                            (when (and (number? x) (pos? x))
                              (let [m (as-midi x) n (js/Math.round m)
                                    cents (js/Math.round (* 100 (- m n)))]
                                (str (nth names (mod n 12)) (dec (js/Math.floor (/ n 12)))
                                     (when-not (zero? cents) (str " " (when (pos? cents) "+") cents "c"))))))]
              (cond
                (number? value) (let [s (name-of value)] (if s {:out [[0 s]] :show s} {}))
                (sequential? value) (let [ss (vec (keep name-of value))] {:out [[0 ss]] :show (str/join " " ss)})
                :else {})))}
