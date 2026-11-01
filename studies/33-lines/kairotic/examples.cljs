;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · Study 33 · lines: the example projects, made gesture by gesture (so each has a history).

(ns kairotic.lines-examples
  (:require [kairotic.lines :as ln]))

(defn chain
  "Boxes one under the other, each wired to the next: [[:box …] … [:connect …] …]."
  [x y & texts]
  (let [ids (map (fn [i] (keyword (str "b" (inc i)))) (range (count texts)))]
    (vec (concat (map-indexed (fn [i [id t]] [:box id t x (+ y (* i 64))]) (map vector ids texts))
                 (map (fn [[a b]] [:connect a 0 b 0]) (partition 2 1 ids))))))

(defn help-patch []
  (let [p (-> (ln/new-project "Help · patch" "basic"
                              :note "patch double: the line double, as a box. Click the message. Double-click the box to open its line.")
              (ln/add-line "double" :note "A line used as a sub-patch: its inlet and outlet boxes are the box's ports."
                           :events (chain 40 30 "inlet" "* 2" "outlet"))
              (ln/append-all :basic (chain 40 30 "msg 3" "patch double" "number"))
              (ln/add-line "scale" :note "A line with a history: it multiplied by 2, now by 10. Go back with ◀ to see it."
                           :events (conj (chain 40 30 "inlet" "* 2" "outlet") [:text :b2 "* 10"])))
        scale (ln/line p :scale)
        first-version [(first (ln/front scale)) 5]
        p (-> p
              (ln/add-line "follow-pin" :note "Two boxes of the same line: the left one follows it (its newest point), the right one is pinned where it multiplied by 2."
                           :events [[:box :b1 "msg 5" 40 30]
                                    [:box :b2 "patch scale" 40 110] [:box :b3 "patch scale" 220 110]
                                    [:pin :b3 first-version]
                                    [:box :b4 "number" 40 190] [:box :b5 "number" 220 190]
                                    [:connect :b1 0 :b2 0] [:connect :b1 0 :b3 0]
                                    [:connect :b2 0 :b4 0] [:connect :b3 0 :b5 0]])
              (ln/add-line "add-double" :note "A line that uses another line: lines nest (a cycle is refused)."
                           :events (chain 40 30 "inlet" "+ 1" "patch double" "outlet"))
              (ln/add-line "nesting" :note "patch add-double uses patch double inside: (4 + 1) × 2."
                           :events (chain 40 30 "msg 4" "patch add-double" "number"))
              (ln/add-line "embedded" :note "An embedded patch keeps its inside in the box (double-click to go in). Select it and Extract to line: it becomes a tab, with the history it had inside."
                           :events (into (chain 40 30 "msg 2" "patch" "number")
                                         (map (fn [e] [:in :b2 e]) (conj (chain 40 30 "inlet" "- 1" "outlet") [:text :b2 "- 5"])))))]
    (-> p
        (assoc :order [:basic :follow-pin :nesting :embedded :double :scale :add-double])
        (ln/to-front :basic))))

(defn piece []
  (-> (ln/new-project "A piece" "main" :note "The piece: two voices, each the line voice, which uses the line gain.")
      (ln/add-line "gain" :note "Halves what arrives." :events (chain 40 30 "inlet" "* 0.5" "outlet"))
      (ln/add-line "voice" :note "One voice: through gain, then + 3." :events (chain 40 30 "inlet" "patch gain" "+ 3" "outlet"))
      (ln/append-all :main [[:box :b1 "msg 220" 40 30] [:box :b2 "msg 330" 200 30]
                            [:box :b3 "patch voice" 40 110] [:box :b4 "patch voice" 200 110]
                            [:box :b5 "number" 40 190] [:box :b6 "number" 200 190]
                            [:connect :b1 0 :b3 0] [:connect :b2 0 :b4 0] [:connect :b3 0 :b5 0] [:connect :b4 0 :b6 0]])
      (ln/add-line "sketch" :note "A study beside the piece: a line nobody uses yet." :events (chain 40 30 "msg 1" "+ 1" "number"))))

(defn empty-one [] (ln/new-project "Untitled" "main"))

(def all [["Help · patch (tutorial tabs)" help-patch] ["A piece" piece] ["Empty project" empty-one]])
