;; euclid · a Euclidean rhythm: k onsets spread as evenly as they can be over n pulses
;; Part of @kairotic/theory. Written against the Kairotic API (api/…).
;; Bjorklund's algorithm (Toussaint, "The Euclidean algorithm generates traditional musical rhythms", 2005):
;; E(3,8) is the tresillo, E(5,8) the cinquillo, E(5,16) a rotation of the bossa nova, E(7,12) the bembé.
;; The rhythm is drawn as a necklace — the n pulses around a circle, time running clockwise from the top,
;; the onsets joined into a polygon — and pressing a pulse makes the rhythm start there (a rotation).
;; What it sends is rhythm apart from pitch, as an :rtm of kairotic.mt (shares: the intervals between
;; onsets, a negative share a silence), so that it can be merged with a map of pitches ({:pitches …}, the
;; talea and color of an isorhythm) into a musical tree: the box does it with what reaches its right inlet,
;; and its outlet 1 gives the bare :rtm map to merge elsewhere (merge, then vector :rtm %).
(let [;; Bjorklund: k ones and n − k zeros, the remainder paired again and again (Euclid's algorithm)
      bjorklund (fn [k n]
                  (cond (<= n 0) []
                        (<= k 0) (vec (repeat n 0))
                        (>= k n) (vec (repeat n 1))
                        :else (loop [a (vec (repeat k [1])) b (vec (repeat (- n k) [0]))]
                                (if (<= (count b) 1)
                                  (vec (apply concat (concat a b)))
                                  (let [m (min (count a) (count b))]
                                    (recur (mapv into (subvec a 0 m) (subvec b 0 m))
                                           (if (> (count a) m) (subvec a m) (subvec b m))))))))
      ;; a necklace read from pulse r on: the rhythm in a fixed position against the beat
      rotate (fn [xs r] (let [n (count xs)] (if (zero? n) xs (let [r (mod r n)] (vec (concat (subvec xs r) (subvec xs 0 r)))))))
      onsets-of (fn [ps] (vec (keep-indexed (fn [i x] (when (= 1 x) i)) ps)))
      ;; the intervals between onsets, around the circle (3 3 2): the rhythm as a necklace
      intervals-of (fn [ps] (let [os (onsets-of ps) n (count ps)]
                              (if (empty? os) [] (mapv (fn [a b] (- b a)) os (conj (subvec os 1) (+ n (first os)))))))
      ;; the shares of an :rtm: from each onset to the next one (or the end of the bar); the pulses before the
      ;; first onset a silence (a negative share): 01001001 → [-1 3 3 1]
      shares-of (fn [ps] (let [os (onsets-of ps) n (count ps)]
                           (cond (zero? n) []
                                 (empty? os) [(- n)]
                                 :else (vec (concat (when (pos? (first os)) [(- (first os))])
                                                    (map (fn [a b] (- b a)) os (conj (subvec os 1) n)))))))
      ;; the meter of a bar of n pulses, when none is asked: the pulse a written value
      pow2? (fn [x] (and (pos? x) (== x (js/Math.pow 2 (js/Math.round (js/Math.log2 x))))))
      meter-of (fn [n] (cond (and (>= n 4) (pow2? n)) [4 4]
                             (and (>= n 12) (zero? (mod n 3)) (pow2? (/ n 3))) [12 8]
                             (< n 4) [n 4]
                             (<= n 12) [n 8]
                             :else [n 16]))
      ;; a meter asked for: [3 4], "3/4", "7/8[2+2+3]", or nil (as the pulses say)
      meter-arg (fn [v] (cond (and (sequential? v) (= 2 (count v)) (every? number? v)) (vec v)
                              (string? v) v
                              (keyword? v) (name v)
                              :else nil))
      ;; pitches, as theory boxes take them: Hz by default, MIDI with midi; the MIDI notes kept to 3 decimals
      hz->m (fn [x] (when (and (number? x) (pos? x)) (/ (js/Math.round (* 1000 (+ 69 (* 12 (js/Math.log2 (/ x 440)))))) 1000)))
      ;; what reaches the right inlet, as the pitches of the :rtm (or nil, to forget them): a map of pitches
      ;; ({:pitches …} or {:pitch …}, kept as they are), a pattern ({:note [...]} of comes or cancrizans, MIDI;
      ;; nil a rest), a melody string ("c4 e4 g4"), a list of pitches (Hz, as a keyboard sends the keys held;
      ;; MIDI with midi), a list of notes or chords of a tree, or one pitch
      pitches-of (fn [midi? v]
                   (let [p (fn [x] (if midi? x (hz->m x)))]
                     (cond (#{:clear} v) nil
                           (map? v) (cond (or (contains? v :pitches) (contains? v :pitch)) (select-keys v [:pitches :pitch])
                                          (sequential? (:note v)) {:pitches (mapv (fn [x] (if (number? x) x "r")) (:note v))}
                                          :else :ignore)
                           (string? v) {:pitches v}
                           (number? v) (if-let [m (p v)] {:pitch m} :ignore)
                           (and (sequential? v) (keyword? (first v))) {:pitches [v]}
                           (and (sequential? v) (seq v) (every? number? v)) (let [ms (vec (keep p v))] (if (seq ms) {:pitches ms} :ignore))
                           (and (sequential? v) (seq v)) {:pitches (vec v)}
                           :else :ignore)))
      ;; the color goes on over the bars: bar i begins where the notes of the bar before left it
      tokens (fn [ps] (cond (string? ps) (vec (remove #{""} (.split (.trim ps) (js/RegExp. "\\s+"))))
                            (sequential? ps) (vec ps)
                            :else nil))
      color-at (fn [pm skip]
                 (let [ts (tokens (:pitches pm))]
                   (if (or (empty? ts) (zero? (mod skip (count ts))))
                     pm
                     (let [r (mod skip (count ts)) ts2 (vec (concat (subvec ts r) (subvec ts 0 r)))]
                       (assoc pm :pitches (if (string? (:pitches pm)) (apply str (interpose " " ts2)) ts2))))))
      ;; everything the box knows: its words, changed by messages
      params (fn [args st]
               (let [o (merge args (:over st))
                     n (max 1 (js/Math.round (or (:n o) 8)))]
                 {:n n :k (api/clamp (js/Math.round (or (:k o) 3)) 0 n) :rotation (mod (js/Math.round (or (:rotation o) 0)) n)
                  :bars (api/clamp (js/Math.round (or (:bars o) 1)) 1 64) :meter (or (:meter o) (meter-of n))}))
      ;; the rhythm as data: the pulses, its necklace, and the :rtm with the pitches merged
      rhythm (fn [{:keys [k n rotation bars meter]} pm]
               (let [ps (rotate (bjorklund k n) rotation)
                     rtm (merge {:shares (shares-of ps)} (or pm {}))
                     bar (fn [i] (let [a (color-at rtm (* i k))]
                                   (if (zero? i) [:measure {:meter meter} [:rtm a]] [:measure [:rtm a]])))]
                 {:pulses ps :onsets (onsets-of ps) :intervals (intervals-of ps) :rtm rtm
                  :tree (into [:voice] (map bar (range bars)))}))
      shown-of (fn [p r] (merge (select-keys p [:k :n :rotation :bars]) (select-keys r [:pulses :onsets :intervals])))
      ;; what goes out: the tree (0), the :rtm map (1), the pulses (2), the last first (as Max does)
      outs (fn [r] [[2 (:pulses r)] [1 (:rtm r)] [0 (:tree r)]])
      ;; a change: sent when what it makes is new (the same again changes nothing); a bang sends it anyway
      changed (fn [args st over always?]
                (let [st2 (assoc st :over over) p (params args st2) r (rhythm p (:pm st2))]
                  (if (and (not always?) (= (:tree r) (:sent st)))
                    {:state st2 :show (shown-of p r)}
                    {:state (assoc st2 :sent (:tree r)) :show (shown-of p r) :out (outs r)})))
      polar (fn [cx cy R i n] (let [a (* 2 js/Math.PI (/ i n))] [(+ cx (* R (js/Math.sin a))) (- cy (* R (js/Math.cos a)))]))]
  {;; ── about ──
   :class "euclid"
   :license "MPL-2.0"
   :doc "A Euclidean rhythm (Bjorklund's algorithm, after Toussaint): k onsets spread as evenly as they can be over n pulses — euclid 3 8 is the tresillo (3-3-2), euclid 5 8 the cinquillo, euclid 5 16 a rotation of the bossa nova, euclid 7 12 the bembé. Drawn as a necklace: the pulses around a circle, time clockwise from the top, the onsets joined into a polygon; pressing a pulse makes the rhythm start there (a rotation). A bang sends it; [:k 5], [:n 16], [:rotation 2], [:bars 4], [:meter \"3/4\"] (or a map of them) change it and send it when it is new, a number is k. Rhythm apart from pitch: out of the left outlet a musical tree, a bar of n pulses (4/4 for 8 or 16, 12/8 for 12, n/8 up to 12, else n/16; [:meter …] for another) with an :rtm whose shares are the intervals between onsets (a negative share a silence); bars repeat it, the pitches going on. Its right inlet (cold) takes the pitches the notes take in turn, starting again when they run out (talea and color): a map with :pitches or :pitch (kept as it is), a pattern of comes or cancrizans ({:note [...]}), a melody string (\"c4 e4 g4\"), a list of Hz (the keys held on a keyboard; MIDI with midi), notes or chords of a tree; :clear forgets them (every note c4). Outlet 1 is the :rtm map alone ({:shares [3 3 2] :pitches …}), to merge with other pitches (merge) and write as a node (vector :rtm %); outlet 2 the pulses, ones and zeros ([1 0 0 1 0 0 1 0])."
   :usage "euclid [k 3] [n 8] [rotation 0] [bars 1] [midi]"
   :io [2 3]
   :size [180 200]

   ;; ── arguments ──
   :args [[:k 3] [:n 8] [:rotation 0] [:bars 1] [:midi false]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (let [st (or state {:over {} :pm nil})
                    over (:over st)
                    set-over (fn [m] (changed args st (merge over m) false))]
                (if (= inlet 1)
                  (let [pm (pitches-of (:midi args) value)]
                    (if (= pm :ignore) {} {:state (assoc st :pm pm)}))
                  (cond
                    (#{:bang} value) (changed args st over true)
                    (number? value) (set-over {:k value})
                    (and (vector? value) (= :pressed (first value)) (number? (second value)))
                    (let [p (params args st)] (set-over {:rotation (+ (:rotation p) (second value))}))
                    (and (vector? value) (= 2 (count value)) (#{:k :n :rotation :bars} (first value)) (number? (second value)))
                    (set-over {(first value) (second value)})
                    (and (vector? value) (= :meter (first value))) (set-over {:meter (meter-arg (second value))})
                    (map? value) (set-over (cond-> (select-keys value [:k :n :rotation :bars])
                                             (contains? value :meter) (assoc :meter (meter-arg (:meter value)))))
                    :else {}))))
   ;; pressing a pulse: the rhythm starts there (sent once, on release)
   :gesture (fn [{:keys [up hit]}] (when (and up (number? hit)) [:pressed hit]))

   ;; ── view ──
   :draw (fn [{:keys [shown w h args]}]
           (let [p (or shown (let [n (max 1 (js/Math.round (or (:n args) 8)))
                                   k (api/clamp (js/Math.round (or (:k args) 3)) 0 n)
                                   ps (rotate (bjorklund k n) (or (:rotation args) 0))]
                               {:k k :n n :pulses ps :onsets (onsets-of ps) :intervals (intervals-of ps)}))
                 n (:n p) ps (:pulses p) os (:onsets p)
                 cx (/ w 2) cy (/ (- h 30) 2) R (- (min cx cy) 16)
                 r (cond (> n 32) 2.2 (> n 16) 3 :else 4.5)]
             (concat
              [[:circle {:cx cx :cy cy :r R :stroke :grid}]]
              ;; the start of the bar, at the top
              (let [[x1 y1] (polar cx cy (- R 9) 0 n) [x2 y2] (polar cx cy (+ R 9) 0 n)]
                [[:line {:x1 x1 :y1 y1 :x2 x2 :y2 y2 :stroke :kairos :weight 1.5 :opacity 0.8}]])
              (when (> (count os) 1) [[:path {:points (mapv (fn [i] (polar cx cy R i n)) os) :closed true :stroke :accent :weight 2}]])
              (for [i (range n)]
                (let [[x y] (polar cx cy R i n) on (= 1 (nth ps i 0))]
                  [:group {:hit i}
                   [[:circle {:cx x :cy y :r (if on (+ r 1.5) r) :fill (if on :accent :bg) :stroke (if on :accent :soft)}]]]))
              [[:text {:x cx :y (- h 15) :anchor :middle :size 10 :fill :ink}
                (str "E(" (:k p) "," n ")" (when (pos? (or (:rotation p) 0)) (str " ↻" (:rotation p))))]
               [:text {:x cx :y (- h 3) :anchor :middle :size 9 :fill :soft}
                (if (seq (:intervals p)) (apply str (interpose "-" (:intervals p))) "silence")]])))})
