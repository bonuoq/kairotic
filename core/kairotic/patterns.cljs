;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · patterns
;; Patterns after SuperCollider's (Pbind, Pseq, Pwhite…), on Clojure's lazy sequences as Overtone does
;; (discussion #84). A pattern is a (possibly infinite) lazy sequence of event maps:
;;   {:degree 2 :dur 1/2 :amp 0.3}  →  played by a `player` box (@kairotic/patterns)
;;
;; Two layers, because the history, rooms and links of a work travel as data and a lazy seq does not:
;;   · the source travels: the text of a `pbind` (EDN) or a `pattern` (code) box, and a seed;
;;   · the stream is local: each tab makes the sequence from the source. The same seed gives the same
;;     music everywhere, and going back in the history plays the same again.
;; What goes along a line is a pattern value, a factory of streams ({:kairotic/pattern true :make (fn [] …)}),
;; never the sequence itself, so nothing infinite is printed or kept.
;;
;; A pbind is a map: a plain value is a constant, a vector a sequence (the shorter ones start again until
;; the longest ends; all of them, `repeat` times), and an EDN tagged literal #pat/… a generator:
;;   #pat/seq [a b c]        the same as a vector       #pat/choose [a b c]   one at random, each time
;;   #pat/shuffle [a b c]    every pass in a new order  #pat/white [lo hi]    random between lo and hi
;;   #pat/walk [x step lo hi]  a random walk            #pat/series [x step] or [x step n]
;;   #pat/hold [beats [a b]]   one value per `beats`    #pat/chord [0 4 7]    a vector as one value
;; A generator can be an element of a vector: [1 #pat/choose [2 3]]. Each key has its own seed, made of
;; the box's seed and its name, so changing :dur does not change the randomness of :amp.

(ns kairotic.patterns
  (:require [clojure.string :as str]
            [clojure.edn :as edn]
            [kairotic.score :as sc]
            [kairotic.canvas :as cv]
            [kairotic.code :as code]))

(def max-period
  "The longest finite sequence a pattern treats as one (a lazy seq longer than this is a stream)."
  4096)

;; ───────── seeded randomness ─────────

(defn rng
  "A generator of numbers in [0, 1) from a seed (any value): the same seed gives the same numbers in
   every tab (mulberry32 over the hash of the seed)."
  [seed]
  (let [s (volatile! (bit-or (hash seed) 0))]
    (fn []
      (let [a (vswap! s (fn [a] (bit-or (+ a 0x6D2B79F5) 0)))
            t (js/Math.imul (bit-xor a (unsigned-bit-shift-right a 15)) (bit-or a 1))
            t (bit-xor (+ t (js/Math.imul (bit-xor t (unsigned-bit-shift-right t 7)) (bit-or t 61))) t)]
        (/ (unsigned-bit-shift-right (bit-xor t (unsigned-bit-shift-right t 14)) 0) 4294967296)))))

(defn whole? [x] (and (number? x) (== x (js/Math.floor x))))

(defn rand-in
  "A random number between lo and hi from r: a whole one (both ends included) when both are whole."
  [r lo hi]
  (if (and (whole? lo) (whole? hi))
    (+ (min lo hi) (js/Math.floor (* (r) (inc (js/Math.abs (- hi lo))))))
    (+ lo (* (r) (- hi lo)))))

(defn pick "One element of the vector xs, at random." [r xs] (nth xs (js/Math.floor (* (r) (count xs)))))

(defn shuffled "The vector xs in a random order (Fisher–Yates)." [r xs]
  (loop [v (vec xs) i (dec (count xs))]
    (if (pos? i)
      (let [j (js/Math.floor (* (r) (inc i)))]
        (recur (assoc v i (nth v j) j (nth v i)) (dec i)))
      v)))

;; ───────── generators: #pat/… in EDN ─────────

(def gen-names #{:seq :choose :shuffle :white :walk :series :hold :chord})

(defn gen "A generator as data." [g args] {:pat/gen g :pat/args args})
(defn gen? [x] (and (map? x) (contains? x :pat/gen)))

(def readers (into {} (for [g gen-names] [(symbol "pat" (name g)) (fn [x] (gen g x))])))

(defn read-spec
  "The text of a pbind as data: #pat/… become generators. Throws on bad EDN or an unknown tag."
  [source]
  (edn/read-string {:readers readers
                    :default (fn [tag _]
                               (throw (js/Error. (str "unknown tag #" tag " (the generators are "
                                                      (str/join " " (map (fn [g] (str "#pat/" (name g))) (sort gen-names))) ")"))))}
                   (str source)))

(defn- nums? [xs n] (and (sequential? xs) (= n (count xs)) (every? number? xs)))

(defn gen-problem
  "What is wrong with a generator's arguments, or nil."
  [{g :pat/gen a :pat/args}]
  (let [tag (str "#pat/" (name g))]
    (case g
      (:seq :choose :shuffle :chord) (when-not (and (sequential? a) (seq a)) (str tag " takes a vector of values: " tag " [0 2 4]"))
      :white (when-not (nums? a 2) (str tag " takes [lo hi]: " tag " [0 7]"))
      :walk (when-not (nums? a 4) (str tag " takes [start step lo hi]: " tag " [0 2 -7 7]"))
      :series (when-not (or (nums? a 2) (nums? a 3)) (str tag " takes [start step] or [start step n]: " tag " [0 2 8]"))
      :hold (when-not (and (sequential? a) (= 2 (count a)) (number? (first a)) (pos? (first a))
                           (sequential? (second a)) (seq (second a)))
              (str tag " takes [beats [values]]: " tag " [4 [:c :g :d]]"))
      (str "unknown generator " tag))))

(defn problems
  "What is wrong with a pbind map (a list of reasons, empty if nothing)."
  [m]
  (if-not (map? m)
    ["a pbind is a map {:key values …}: {:degree [0 2 4] :dur 1/2}"]
    (concat
     (for [k (keys m) :when (not (keyword? k))] (str "the keys of a pbind are keywords (" (pr-str k) " is not)"))
     (->> (tree-seq (fn [x] (or (map? x) (sequential? x))) (fn [x] (if (map? x) (if (gen? x) [(:pat/args x)] (vals x)) x)) m)
          (filter gen?)
          (keep gen-problem)))))

;; ───────── streams: one per key ─────────
;; stream-of gives {:stream (lazy, infinite) :period n-or-nil}: a finite sequence of n values cycles (so a
;; shorter one starts again), an endless one has no period; a constant is :const and a hold is :held.

(declare stream-of)

(defn rng-for [ctx] (rng [(:seed ctx) (:key ctx) (:pass ctx) (:path ctx)]))

(defn- elements
  "The values of a vector, nested vectors flattened (as Overtone's pbind does); generators and lazy
   sequences stay one element each."
  [xs]
  (mapcat (fn [x] (if (vector? x) (elements x) [x])) xs))

(defn- cycle-or-stream
  "A lazy seq as a stream: a finite one round and round, an endless one as it is."
  [s]
  (if (<= (bounded-count (inc max-period) s) max-period) (if (seq s) (cycle s) (repeat nil)) s))

(defn- taker
  "A function that gives the next value of an element each time it is called: a generator or a lazy seq
   gives one of its values, anything else itself."
  [x ctx]
  (cond (gen? x) (let [s (volatile! (:stream (stream-of x ctx)))] (fn [] (let [v (first @s)] (vswap! s rest) v)))
        (seq? x) (let [s (volatile! (cycle-or-stream x))] (fn [] (let [v (first @s)] (vswap! s rest) v)))
        :else (constantly x)))

(defn- takers [xs ctx] (vec (map-indexed (fn [i x] (taker x (update ctx :path conj i))) xs)))

(defn- cycling
  "The elements of a vector, round and round (a generator in it gives a new value each time it comes round)."
  [xs ctx]
  (let [ts (takers xs ctx) n (count ts)]
    {:stream (map (fn [i] ((nth ts (mod i n)))) (range)) :period n}))

(defn stream-of
  "The values of one key of a pbind, given ctx {:seed :key :pass :path}."
  [x ctx]
  (let [ctx (update ctx :path (fnil identity []))]
    (cond
      (gen? x)
      (let [a (:pat/args x)]
        (case (:pat/gen x)
          :seq (stream-of (vec a) ctx)
          :chord {:stream (repeat (vec a)) :const true}
          :choose (let [r (rng-for ctx) ts (takers (vec (elements a)) ctx)]
                    {:stream (repeatedly (fn [] ((pick r ts))))})
          :shuffle (let [r (rng-for ctx) ts (takers (vec (elements a)) ctx)
                         pass (fn pass [] (lazy-seq (concat (map (fn [t] (t)) (shuffled r ts)) (pass))))]
                     {:stream (pass) :period (count ts)})
          :white (let [r (rng-for ctx) [lo hi] a] {:stream (repeatedly (fn [] (rand-in r lo hi)))})
          :walk (let [r (rng-for ctx) [x0 step lo hi] a
                      lo' (min lo hi) hi' (max lo hi)
                      reflect (fn [x] (cond (> x hi') (max lo' (- hi' (- x hi'))) (< x lo') (min hi' (+ lo' (- lo' x))) :else x))]
                  {:stream (iterate (fn [x] (reflect (+ x (rand-in r (- step) step)))) x0)})
          :series (let [[x0 step n] a s (iterate (fn [x] (+ x step)) x0)]
                    (if (and (number? n) (pos? n))
                      {:stream (cycle (take (js/Math.round n) s)) :period (js/Math.round n)}
                      {:stream s}))
          :hold (let [[beats xs] a] {:held {:beats beats :values (vec (elements xs))}})
          (throw (js/Error. (str "unknown generator #pat/" (name (:pat/gen x)))))))
      (vector? x) (let [xs (vec (elements x))] (if (seq xs) (cycling xs ctx) {:stream (repeat nil) :const true}))
      ;; a lazy seq (from code): finite ones cycle like a vector, endless ones are a stream as they are
      (seq? x) (if (<= (bounded-count (inc max-period) x) max-period)
                 (if (seq x) (cycling (vec x) ctx) {:stream (repeat nil) :const true})
                 {:stream x})
      :else {:stream (repeat x) :const true})))

(defn static-period
  "How many events one key gives in a pass, without making it: a number, nil (endless), :const or :held."
  [x]
  (cond
    (gen? x) (case (:pat/gen x)
               (:seq) (static-period (vec (:pat/args x)))
               (:shuffle) (count (elements (:pat/args x)))
               (:series) (let [n (nth (:pat/args x) 2 nil)] (if (and (number? n) (pos? n)) (js/Math.round n) nil))
               (:chord) :const
               (:hold) :held
               nil)
    (vector? x) (if (seq x) (count (elements x)) :const)
    (seq? x) (let [n (bounded-count (inc max-period) x)] (if (<= n max-period) (if (pos? n) n :const) nil))
    :else :const))

;; ───────── events ─────────

(defn dur-of "The length of an event in beats (:dur, 1 if it has none)." [e]
  (let [d (:dur e)] (if (and (number? d) (>= d 0) (js/isFinite d)) d 1)))

(defn sustain
  "How long the notes of an event sound, in beats: :sustain, or :dur × :legato (0.8)."
  [e]
  (let [s (:sustain e) l (:legato e)]
    (if (and (number? s) (pos? s)) s (* (dur-of e) (if (number? l) l 0.8)))))

(defn- timed
  "The events, each map with its #pat/hold keys filled in for the beat it starts on."
  [rows holds]
  (if (empty? holds)
    rows
    (letfn [(step [rows beat]
              (lazy-seq
               (when-let [e (first rows)]
                 (let [e (reduce (fn [e [k {:keys [beats values]}]]
                                   (assoc e k (nth values (mod (js/Math.floor (/ (+ beat 1e-9) beats)) (count values)))))
                                 e holds)]
                   (cons e (step (rest rows) (+ beat (dur-of e))))))))]
      (step rows 0))))

(defn pbind-events
  "The events of the pbind map m: a lazy seq of maps. opts {:seed :repeat} (repeat a number or :inf). As
   in Overtone, a pattern with an endless key is endless; otherwise one pass lasts as long as its longest
   sequence, and there are `repeat` passes."
  [m {:keys [seed repeat]}]
  (let [ks (sort-by str (keys m))
        holds (keep (fn [k] (let [v (get m k)] (when (and (gen? v) (= :hold (:pat/gen v))) [k (:held (stream-of v {:key k}))]))) ks)
        streamed (remove (set (map first holds)) ks)
        periods (map (fn [k] (static-period (get m k))) streamed)
        seqs (remove #{:const} periods)
        endless? (some nil? seqs)
        n (if (seq seqs) (apply max seqs) 1)
        one-pass (fn [p]
                   (let [ss (map (fn [k] (:stream (stream-of (get m k) {:seed seed :key k :pass p}))) streamed)]
                     (if (seq ss)
                       (apply map (fn [& vs] (zipmap streamed vs)) ss)
                       (repeat {}))))
        rows (cond endless? (one-pass 0)
                   (= repeat :inf) (letfn [(passes [p] (lazy-seq (concat (take n (one-pass p)) (passes (inc p)))))] (passes 0))
                   :else (mapcat (fn [p] (take n (one-pass p))) (range (max 1 (or repeat 1)))))]
    (timed rows holds)))

(defn summary
  "A few words about a pbind map: its keys and how many events a pass has."
  [m]
  (let [periods (keep (fn [[_ v]] (let [p (static-period v)] (when-not (#{:const :held} p) p))) m)
        pass (cond (some nil? periods) "endless"
                   (seq periods) (str (apply max periods) " events a pass")
                   :else "1 event")]
    (str (count m) (if (= 1 (count m)) " key · " " keys · ") pass)))

;; ───────── pattern values: what travels along a line ─────────

(defn pattern
  "A pattern value: make gives a new stream (a lazy seq of event maps) each time; key tells whether two
   patterns are the same (the same source and seed)."
  [make key info]
  {:kairotic/pattern true :key key :make make :summary info})

(defn pattern? [x] (and (map? x) (true? (:kairotic/pattern x))))

(defn events "A new stream of the pattern p." [p] ((:make p)))

(defn pbind-pattern
  "The pattern of a pbind map. opts {:seed n :repeat n|:inf}."
  [m opts]
  (let [opts {:seed (or (:seed opts) 0) :repeat (or (:repeat opts) 1)}]
    (pattern (fn [] (pbind-events m opts)) [:pbind m (:seed opts) (:repeat opts)] (summary m))))

;; ───────── patterns as code ─────────
;; The source of a `pattern` box is a Clojure expression evaluated inside
;;   (fn [{:keys [rand rand-int rand-nth shuffle pbind pseq pwhite …]}] …)
;; so its randomness is seeded, and the pattern functions are at hand (no other name of clojure.core is
;; replaced: macros such as `for` expand into them). It returns a sequence of event
;; maps (nested sequences are flattened, as phrases) or one map, which is read as a pbind.

(defn code-env
  "The names a pattern's code sees, with their randomness from r."
  [r seed rep]
  (let [pb (fn ([m] (pbind-events m {:seed seed :repeat rep})) ([m n] (pbind-events m {:seed seed :repeat (if (or (= n :inf) (= n js/Infinity)) :inf n)})))]
    {:rand (fn ([] (r)) ([n] (* n (r))))
     :rand-int (fn [n] (js/Math.floor (* n (r))))
     :rand-nth (fn [xs] (pick r (vec xs)))
     :shuffle (fn [xs] (shuffled r (vec xs)))
     :pbind pb
     :pseq (fn ([xs] (seq xs)) ([xs n] (if (or (= n :inf) (= n js/Infinity)) (cycle xs) (take (* n (count xs)) (cycle xs)))))
     :pwhite (fn ([lo hi] (repeatedly (fn [] (rand-in r lo hi)))) ([lo hi n] (take n (repeatedly (fn [] (rand-in r lo hi))))))
     :pchoose (fn [xs] (let [v (vec xs)] (repeatedly (fn [] (pick r v)))))
     :pshuffle (fn [xs] (let [v (vec xs)] ((fn pass [] (lazy-seq (concat (shuffled r v) (pass)))))))
     :pseries (fn ([x step] (iterate (fn [x] (+ x step)) x)) ([x step n] (take n (iterate (fn [x] (+ x step)) x))))
     :pwalk (fn [x0 step lo hi] (:stream (stream-of (gen :walk [x0 step lo hi]) {:seed [seed (r)]})))}))

(def code-names (sort (map name (keys (code-env (constantly 0) 0 1)))))

(defn flat-events
  "The event maps of what a pattern's code returned: a map is one pbind, a sequence is flattened."
  [x seed rep]
  (letfn [(fl [x] (cond (map? x) [x] (sequential? x) (mapcat fl x) :else []))]
    (if (map? x)
      (pbind-events x {:seed seed :repeat rep})
      (fl x))))

(defn code-pattern
  "The pattern of a compiled `pattern` source f. opts {:seed :repeat :source}."
  [f opts]
  (let [seed (or (:seed opts) 0) rep (or (:repeat opts) 1)]
    (pattern (fn [] (flat-events (f (code-env (rng [seed :code]) seed rep)) seed rep))
             [:code (:source opts) seed rep]
             "code")))

;; ───────── pitch: what an event plays ─────────

(def scales
  {:major [0 2 4 5 7 9 11] :ionian [0 2 4 5 7 9 11] :minor [0 2 3 5 7 8 10] :aeolian [0 2 3 5 7 8 10]
   :dorian [0 2 3 5 7 9 10] :phrygian [0 1 3 5 7 8 10] :lydian [0 2 4 6 7 9 11] :mixolydian [0 2 4 5 7 9 10]
   :locrian [0 1 3 5 6 8 10] :harmonic-minor [0 2 3 5 7 8 11] :melodic-minor [0 2 3 5 7 9 11]
   :pentatonic [0 2 4 7 9] :major-pentatonic [0 2 4 7 9] :minor-pentatonic [0 3 5 7 10] :blues [0 3 5 6 7 10]
   :whole-tone [0 2 4 6 8 10] :chromatic (vec (range 12)) :octatonic [0 2 3 5 6 8 9 11]})

(def rest-words #{:rest :_ :- :r "rest" "_" "-" "r"})

(defn rest?
  "Is the event a silence? {:type :rest}, :rest true, or :rest (:_ :-) as its note, degree or freq."
  [e]
  (boolean (or (= :rest (:type e)) (true? (:rest e))
               (some (fn [k] (contains? rest-words (get e k))) [:note :midinote :degree :freq]))))

(defn pitch-class
  "A pitch class: a number, or a name (:c :eb :f# \"Bb\") → 0…11 (nil if it is not one)."
  [x]
  (cond (number? x) x
        (or (keyword? x) (string? x))
        (let [m (re-matches #"(?i)([a-g])(#|s|b)?" (name x))]
          (when m (+ (get sc/pcs (str/lower-case (nth m 1))) (case (nth m 2) "#" 1 "s" 1 "S" 1 "b" -1 "B" -1 0))))
        :else nil))

(defn scale-of [x]
  (cond (and (sequential? x) (seq x) (every? number? x)) (vec x)
        (or (keyword? x) (string? x)) (get scales (keyword x) (:major scales))
        :else (:major scales)))

(defn degree->midi
  "A scale degree (0 = the root; fractional degrees glide between steps) as a MIDI pitch, as in
   SuperCollider's default event: :scale (a name or semitones), :root (a pitch class), :octave (5 → c4)."
  [d {:keys [scale root octave]}]
  (let [sc (scale-of scale) n (count sc)
        f (js/Math.floor d) frac (- d f)
        o (js/Math.floor (/ f n)) i (mod f n)
        s (+ (nth sc i) (* 12 o))
        s2 (if (pos? frac) (+ (if (< (inc i) n) (nth sc (inc i)) (+ 12 (first sc))) (* 12 o)) s)]
    (+ (* 12 (if (number? octave) octave 5)) (or (pitch-class root) 0) s (* frac (- s2 s)))))

(defn- as-vec [x] (if (sequential? x) (vec x) [x]))

(defn note->midi
  "A note as a MIDI pitch: a number, \"c4\" or :c4, or a name without octave (:c) in :octave."
  [x octave]
  (or (sc/pitch x)
      (when-let [pc (and (not (number? x)) (pitch-class x))] (+ (* 12 (if (number? octave) octave 5)) pc))))

(defn midis
  "The MIDI pitches an event plays (a vector, fractional for microtones), [] for a rest, nil when it says
   nothing about pitch. :freq is in Hz, so it gives nil here (see hz)."
  [e]
  (let [tr (if (number? (:transpose e)) (:transpose e) 0)]
    (cond (rest? e) []
          (some? (:freq e)) nil
          (some? (or (:midinote e) (:note e)))
          (vec (keep (fn [x] (some-> (note->midi x (:octave e)) (+ tr))) (as-vec (or (:midinote e) (:note e)))))
          (some? (:degree e))
          (mapv (fn [d] (+ tr (degree->midi d e))) (filter number? (as-vec (:degree e))))
          :else nil)))

(defn hz
  "The frequencies an event plays, in Hz: [] for a rest, nil when it has no pitch."
  [e]
  (cond (rest? e) []
        (some? (:freq e)) (vec (filter number? (as-vec (:freq e))))
        :else (some->> (midis e) (mapv (fn [m] (cv/round-to (cv/midi->hz m) 3))))))

;; ───────── writing a pbind back as text ─────────

(defn write
  "A value of a pbind as EDN text, generators as #pat/…."
  [x]
  (cond (gen? x) (str "#pat/" (name (:pat/gen x)) " " (write (:pat/args x)))
        (map? x) (str "{" (str/join ", " (map (fn [[k v]] (str (write k) " " (write v))) x)) "}")
        (vector? x) (str "[" (str/join " " (map write x)) "]")
        (seq? x) (str "[" (str/join " " (map write (take max-period x))) "]")
        :else (pr-str x)))

(defn spec->source
  "A pbind map as the text of its box, one key per line."
  [m]
  (str "{" (str/join "\n " (map (fn [[k v]] (str (write k) " " (write v))) m)) "}"))

;; ───────── the languages of the two code boxes ─────────

(code/register-language! "pbind"
  (fn [source]
    (js/Promise.
     (fn [res rej]
       (try
         (let [m (read-spec source) ps (problems m)]
           (if (seq ps)
             (rej (js/Error. (first ps)))
             (res {:value m :info {:summary (summary m)}})))
         (catch :default e (rej e)))))))

(code/register-language! "pattern"
  (fn [source]
    (js/Promise.
     (fn [res rej]
       (if-not (code/allowed? source)
         (rej (js/Error. "not run: this work is shared; (trust-scripts true) to evaluate its patterns"))
         (try
           (let [f (js/scittle.core.eval_string (str "(fn [{:keys [" (str/join " " code-names) "]}]\n(do " source "\n))"))
                 ;; tried once, so a mistake is told now and not when it plays
                 first-events (take 2 (flat-events (f (code-env (rng 0) 0 1)) 0 1))]
             (cond (not (fn? f)) (rej (js/Error. "a pattern is an expression"))
                   (empty? first-events) (rej (js/Error. "it gives no events: return event maps ({:degree 0 :dur 1}), a sequence of them, or a map to read as a pbind"))
                   :else (res {:value f :info {:summary (str "pattern · " (str/join " " (map name (sort (keys (first first-events))))))}})))
           (catch :default e (rej e))))))))
