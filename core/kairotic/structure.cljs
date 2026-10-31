;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · structure
;; The form of what is heard or played, from how alike its moments are (issue #120):
;;  · a self-similarity matrix (SSM): the cosine of every two frames' vectors (Foote 1999). Frames can be of
;;    audio (a chroma, descriptors, an onset envelope: what form~ gets) or of notes (one per beat: the pitch
;;    classes sounding in it, its onsets, how strong they were);
;;  · novelty: how much the music changes at each frame, by a checkerboard kernel slid along the diagonal of the
;;    SSM (Foote 2000) — its peaks are the boundaries of segments;
;;  · the beat spectrum: how alike frames are at each lag, the mean of each diagonal (Foote & Uchihashi 2001) —
;;    its peaks are the periods that repeat (the bar, the phrase);
;;  · segments: the novelty peaks, with a shortest and a longest segment.
;; Pure functions on numbers. Matrices are flat Float64Arrays, n × n ({:n :data}); a few hundred frames are cheap,
;; thousands are not (the matrix grows with their square): use frames per beat, per onset, or ~100 ms apart.

(ns kairotic.structure)

(defn- sq [x] (* x x))

(defn unit
  "A vector scaled to length 1 (a vector of zeros stays zeros)."
  [v]
  (let [l (js/Math.sqrt (reduce + (map sq v)))]
    (if (pos? l) (mapv (fn [x] (/ x l)) v) (vec v))))

(defn ssm
  "The self-similarity matrix of vectors (frames, all of one length): {:n :data}, data[i n + j] the cosine of
   frames i and j (1 alike … 0 unrelated, for vectors of non-negative values)."
  [vs]
  (let [us (mapv unit vs) n (count us) d (js/Float64Array. (* n n))]
    (dotimes [i n]
      (let [a (us i)]
        (loop [j i]
          (when (< j n)
            (let [b (us j) s (reduce + (map * a b))]
              (aset d (+ (* i n) j) s) (aset d (+ (* j n) i) s)
              (recur (inc j)))))))
    {:n n :data d}))

(defn at "The similarity of frames i and j." [{:keys [n data]} i j] (aget data (+ (* i n) j)))

(defn novelty
  "How much the music changes at each frame: a checkerboard kernel of half-width L (frames), tapered by a
   Gaussian, slid along the diagonal (Foote 2000): high where the frames before are alike among themselves and
   unlike the ones after. Scaled to 0 … 1. A vector of n values."
  [{:keys [n] :as S} L]
  (let [L (max 1 (js/Math.round L))
        g (fn [a b] (js/Math.exp (- (/ (+ (sq (+ a 0.5)) (sq (+ b 0.5))) (* 2 (sq (* 0.5 L)))))))
        raw (mapv (fn [i]
                    (loop [a (- L) acc 0]
                      (if (>= a L)
                        acc
                        (recur (inc a)
                               (loop [b (- L) acc acc]
                                 (if (>= b L)
                                   acc
                                   (let [x (+ i a) y (+ i b)]
                                     (recur (inc b)
                                            (if (and (< -1 x n) (< -1 y n))
                                              (+ acc (* (if (= (neg? a) (neg? b)) 1 -1) (g a b) (at S x y)))
                                              acc)))))))))
                  (range n))
        top (reduce max 1e-12 raw)]
    (mapv (fn [x] (max 0 (/ x top))) raw)))

(defn novelty-at
  "The novelty of frame i alone (see novelty), not scaled by the others: the checkerboard's sum divided by the
   sum of its weights, so -1 … 1 (0 where it does not change). For a stream, where frames keep arriving: frame i
   needs L frames after it. nil when it has fewer than L frames on either side."
  [{:keys [n] :as S} L i]
  (let [L (max 1 (js/Math.round L))]
    (when (and (>= i L) (<= (+ i L) n))
      (let [g (fn [a b] (js/Math.exp (- (/ (+ (sq (+ a 0.5)) (sq (+ b 0.5))) (* 2 (sq (* 0.5 L)))))))]
        (loop [a (- L) acc 0 wsum 0]
          (if (>= a L)
            (/ acc (max 1e-12 wsum))
            (let [[acc wsum] (loop [b (- L) acc acc wsum wsum]
                               (if (>= b L)
                                 [acc wsum]
                                 (let [w (g a b)]
                                   (recur (inc b) (+ acc (* (if (= (neg? a) (neg? b)) 1 -1) w (at S (+ i a) (+ i b)))) (+ wsum w)))))]
              (recur (inc a) acc wsum))))))))

(defn beat-spectrum
  "How alike frames are at each lag 0 … max-lag: the mean of each diagonal of the SSM (Foote & Uchihashi 2001).
   Its peaks are the periods that repeat."
  [{:keys [n] :as S} max-lag]
  (mapv (fn [l] (if (>= l n) 0 (/ (reduce + (map (fn [i] (at S i (+ i l))) (range (- n l)))) (- n l))))
        (range (inc (min max-lag (dec n))))))

(defn periods
  "The lags at which the beat spectrum peaks (higher than both neighbours), strongest first: [[lag value] …]."
  [bs]
  (let [v (vec bs)]
    (->> (range 1 (dec (count v)))
         (filter (fn [l] (and (> (v l) (v (dec l))) (>= (v l) (v (inc l))))))
         (map (fn [l] [l (v l)]))
         (sort-by (fn [[_ x]] (- x)))
         vec)))

(defn boundaries
  "The frames where segments begin: novelty peaks above mean + k × deviation, at least shortest frames apart
   (the higher peak wins), and, in a segment longer than longest, its highest novelty point too (its middle,
   if it is flat). Always
   starts with 0."
  [nov {:keys [shortest longest k] :or {shortest 8 longest 64 k 0.5}}]
  (let [v (vec nov) n (count v)
        mean (/ (reduce + v) (max 1 n))
        sd (js/Math.sqrt (/ (reduce + (map (fn [x] (sq (- x mean))) v)) (max 1 n)))
        peaks (filter (fn [i] (and (> (v i) (+ mean (* k sd)))
                                   (>= (v i) (get v (dec i) 0)) (>= (v i) (get v (inc i) 0))))
                      (range 1 n))
        ;; the highest first, each keeping the others shortest frames away
        chosen (reduce (fn [acc i] (if (every? (fn [j] (>= (js/Math.abs (- i j)) shortest)) acc) (conj acc i) acc))
                       [0] (sort-by (fn [i] (- (v i))) peaks))
        chosen (sort chosen)
        ;; a segment longer than longest is cut at its highest point
        split (fn split [a b]
                (if (or (<= (- b a) longest) (< (- b a) (* 2 shortest)))
                  [a]
                  (let [mid (/ (+ a b) 2)
                        c (apply max-key (fn [i] (- (v i) (* 1e-9 (js/Math.abs (- i mid))))) (range (+ a shortest) (- b shortest)))]
                    (concat (split a c) (split c b)))))]
    (vec (distinct (mapcat (fn [[a b]] (split a b)) (partition 2 1 (concat chosen [n])))))))

;; ───────── frames of notes ─────────

(defn note-frames
  "Notes ({:on :off :attrs {:pitch :vel}}) as one vector per frame between the times given (beats found,
   or a grid): 12 pitch classes (each weighed by how long it sounds in the frame and how strong it was), then
   the strength of the onsets in the frame and how many there are (scaled). For the SSM of what was played."
  [notes times]
  (let [ts (vec times) nf (dec (count ts))
        midi (fn [n] (let [p (get-in n [:attrs :pitch])] (when (number? p) p)))
        vel (fn [n] (let [v (get-in n [:attrs :vel])] (if (number? v) (if (> v 1) (/ v 127) v) 0.7)))]
    (mapv (fn [f]
            (let [a (ts f) b (ts (inc f)) len (max 1e-9 (- b a))
                  pcs (reduce (fn [pc n]
                                (if-let [m (midi n)]
                                  (let [o (- (min b (:off n)) (max a (:on n)))]
                                    (if (pos? o) (update pc (mod (js/Math.round m) 12) + (* (/ o len) (+ 0.3 (vel n)))) pc))
                                  pc))
                              (vec (repeat 12 0)) notes)
                  starts (filter (fn [n] (and (>= (:on n) a) (< (:on n) b))) notes)]
              (conj pcs (reduce + (map vel starts)) (* 0.25 (count starts)))))
          (range (max 0 nf)))))
