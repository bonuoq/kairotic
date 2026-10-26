;; pattern · a pattern as code: a Clojure expression that returns events, its randomness seeded
;; Part of @kairotic/patterns. Written against the Kairotic API (api/…).
;; Its source is evaluated (like a script), so in a shared room it does not run until this tab allows it:
;; (trust-scripts true). Inside it, rand, rand-int, rand-nth and shuffle are seeded by the box (pattern 7),
;; and pbind, pseq, pwhite, pchoose, pshuffle, pseries, pwalk and rest are at hand.
(let [opts-of (fn [args source]
                {:seed (or (:seed args) 0) :source source
                 :repeat (if (:loop args) :inf (max 1 (js/Math.round (or (:repeat args) 1))))})
      pattern-of (fn [data args]
                   (let [r (api/compiled "pattern" (:source data))]
                     (when (= :ok (:status r)) (api/code-pattern (:value r) (opts-of args (:source data))))))]
  {;; ── about ──
   :class "pattern"
   :license "MPL-2.0"
   :doc "A pattern as code: a Clojure expression that returns a sequence of event maps (phrases inside are flattened) or one map, read as a pbind. Its randomness is seeded by the box (pattern 7: the same for everyone), and pbind, pseq, pwhite, pchoose, pshuffle, pseries and pwalk give lazy sequences, as in Overtone. It sends its pattern whenever it changes, for a player. In a shared room it runs only after (trust-scripts true); a pbind needs no trust."
   :usage "pattern [seed] [repeat] [loop]"
   :io [1 1]

   ;; ── arguments ──
   :args [[:seed 0] [:repeat 1] [:loop false]]

   ;; ── data: its source, with its own history ──
   :display :code
   :language "pattern"
   :model api/code-model
   :template "(pbind {:degree (pwhite 0 7)\n        :dur    (pchoose [0.25 0.25 0.5])\n        :octave [5 5 6]}\n       :inf)"

   ;; ── what it sends when it changes ──
   :sends (fn [{:keys [data args]}] (pattern-of data args))

   ;; ── logic ──
   :receive (fn [{:keys [data args]}]
              (let [r (api/compiled "pattern" (:source data))]
                (cond (= :ok (:status r)) {:out [[0 (pattern-of data args)]] :show :bang}
                      (= :compiling (:status r)) {}
                      :else {:effects [[:print (str "pattern: " (or (:error r) "empty"))]]})))})
