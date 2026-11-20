;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · continuum: a tree drawn at a resolution per axis (Study 52, discussion #217)
;;
;; A tree knows both domains of each note: where it is written (its beat, its value, its spelled name) and where it
;; really sounded (:tstamp.real, :dur.real, its exact Hz). The continuum draws it at a resolution per axis, each a
;; curve over the piece's time:
;;   time    0 where it sounded (proportional)            → 1 where it is written (its beat, with bar lines)
;;   pitch   0 its exact frequency → ½ the nearest key    → 1 its step on the staff, by its written name
;;   glyph   0 a stroke as thick as it is loud            → ½ a head with a line as long as it lasts → 1 its value
;; The curves are kept in the tree, on its root: {:continuum {:res {:time [r …] :pitch [r …] :glyph [r …]}}} (samples
;; evenly over the piece, 0…1), so they are part of the work and of its MEI. A take (kairotic.mei) can be shown in
;; place of the notes' own real time.
;;
;;   events   the sounds of a tree (a tied note is one), with both domains
;;   project  where each part of each sound is drawn, and how much of it, at a resolution
;;   svg      the drawing, as SVG text, for a box of w × h (the clef and key signature are the page's: Verovio)

(ns kairotic.continuum
  (:require [clojure.string :as str]
            [kairotic.canvas :as cv]
            [kairotic.spell :as sp]
            [kairotic.mei :as mei]
            [kairotic.mt :as mt]))

(def N 41)

(defn clamp [x] (max 0 (min 1 x)))
(defn lerp [a b r] (+ a (* (- b a) r)))
(defn- r3 [x] (/ (js/Math.round (* 1000 x)) 1000))

(def presets
  "Resolution curves by name, as functions of the piece's time u (0…1): [time pitch glyph]."
  {:written      [(constantly 1) (constantly 1) (constantly 1)]
   :proportional [(constantly 0) (constantly 1) (constantly 0.5)]
   :tempered     [(constantly 0) (constantly 0.5) (constantly 0.5)]
   :graphic      [(constantly 0) (constantly 0) (constantly 0)]
   :mixed        [(constantly 0) (constantly 1) (constantly 0.6)]
   :dissolve     [(fn [u] (clamp (- 1 (* 2.2 (- u 0.18))))) (fn [u] (clamp (- 1 (* 1.6 (- u 0.35))))) (fn [u] (clamp (- 1 (* 1.5 (- u 0.25)))))]
   :crystallize  [(fn [u] (clamp (* 2.2 (- u 0.45)))) (fn [u] (clamp (* 1.6 (- u 0.2)))) (fn [u] (clamp (* 1.5 (- u 0.3))))]})

(defn preset-res
  "The resolution curves of a preset, as samples: {:time [r …] :pitch [r …] :glyph [r …]}."
  [k]
  (when-let [[ft fp fg] (get presets (keyword k))]
    (let [s (fn [f] (mapv (fn [i] (/ (js/Math.round (* 100 (f (/ i (dec N))))) 100)) (range N)))]
      {:time (s ft) :pitch (s fp) :glyph (s fg)})))

(defn at
  "A curve (samples evenly over 0…1, or one number) at u."
  [xs u]
  (cond (number? xs) (clamp xs)
        (empty? xs) 1
        (= 1 (count xs)) (clamp (first xs))
        :else (let [x (* (clamp u) (dec (count xs))) i (min (- (count xs) 2) (js/Math.floor x))]
                (clamp (lerp (nth xs i) (nth xs (inc i)) (- x i))))))

;; ───────── the sounds of a tree ─────────

(defn note-wires
  "A note's :wire as a vector of wires ({:send … :kind :rigid|:elastic :tol s :leader :performer|:electronics}): one
   map, or several in a vector."
  [w]
  (cond (map? w) [w] (sequential? w) (vec (filter map? w)) :else []))

(def ^:private bases [4 2 1 0.5 0.25 0.125])

(defn note-value
  "A written length in beats → {:base :dots :filled :flags :stem :exact}."
  [beats]
  (let [flags (fn [b] (if (>= b 1) 0 (js/Math.round (/ (js/Math.log (/ 1 b)) (js/Math.log 2)))))
        v (fn [b dots exact] {:base b :dots dots :filled (< b 2) :flags (flags b) :stem (< b 4) :exact exact})]
    (or (some (fn [b] (cond (< (js/Math.abs (- beats (* 1.5 b))) 1e-9) (v b 1 true)
                            (< (js/Math.abs (- beats b)) 1e-9) (v b 0 true)))
              bases)
        (v (or (first (filter #(<= % beats) bases)) 0.125) 0 false))))

(defn- first-voice
  "The first voice of a tree, written out (melody strings as notes, fragments expanded, every measure its meter)."
  [tree]
  (let [x (mt/with-meters (mt/explicit (mt/expand tree)))]
    (if (= :voice (mt/tag x)) x (or (first (filter #(= :voice (mt/tag %)) (tree-seq mt/node? mt/kids x))) x))))

(defn events
  "The sounds of a tree's first voice, in order: {:id :beat :wbeats (written, a tied note's whole length) :wire :ws :wd
   (written, in seconds at its tempo) :t :dur (where it really sounded, or as written) :midi (exact) :midi2 (the end
   of its glissando) :name (written) :amp}. With a take, where that take played each note (notes it did not play are
   left out)."
  ([tree] (events tree nil))
  ([tree take]
   (let [tree (mei/with-note-ids tree)
         v (first-voice tree)
         a0 (mt/attrs v)
         tempo (or (:tempo a0) (:tempo (mt/attrs tree)) 60) spb (/ 60 tempo)
         sig (or (:sig (sp/parse-key (or (:key a0) (:key (mt/attrs tree))))) 0)
         tw (when take (:when (first (filter #(= take (:id %)) (:takes (mt/attrs tree))))))
         name-of (fn [a m]
                   (or (when (or (string? (:pitch a)) (keyword? (:pitch a))) (name (:pitch a)))
                       (let [bm (js/Math.round m)]
                         (sp/->name (first (sort-by (fn [x] (js/Math.abs (- (sp/fifths x) (sp/key-center sig)))) (sp/spellings bm)))))))
         out (atom []) open (atom nil) beat (atom 0)
         close! (fn [] (when-let [o @open] (swap! out conj o) (reset! open nil)))]
     (letfn [(walk [n]
               (cond
                 (not (mt/node? n)) nil
                 ;; a rest with a :wire: an event for the electronics, silent (no pitch), at its written time
                 (= :rest (mt/tag n)) (let [a (mt/attrs n)]
                                        (close!)
                                        (when (some? (:wire a))
                                          (swap! out conj {:id (str "r" (r3 @beat)) :rest true :beat @beat :wbeats (or (:dur a) 0)
                                                           :wire (:wire a) :amp 0}))
                                        (swap! beat + (or (:dur a) 0)))
                 (= :note (mt/tag n))
                 (let [a (mt/attrs n) d (or (:dur a) 0)]
                   (if (:grace a)
                     nil
                     (do
                       (if-let [o @open]
                         (reset! open (update o :wbeats + d))
                         (let [m (if (number? (:hz a)) (cv/hz->midi (:hz a)) (mt/midi-of a))]
                           (when m
                             (reset! open (cond-> {:id (:id a) :beat @beat :wbeats d :midi m :name (name-of a m)
                                                   :amp (or (:vel a) 0.6) :t (:tstamp.real a) :dur (:dur.real a)}
                                            (some? (:wire a)) (assoc :wire (:wire a))
                                            (seq (:gliss a)) (assoc :midi2 (+ m (/ (second (last (:gliss a))) 100))))))))
                       (when-not (:tie a) (close!))
                       (swap! beat + d))))
                 (= :chord (mt/tag n)) (do (close!) (swap! beat + (or (:dur (mt/attrs n)) 0)))
                 :else (doseq [k (mt/kids n)] (walk k))))]
       (walk v)
       (close!))
     (->> @out
          (map (fn [e]
                 (let [ws (* (:beat e) spb) wd (* (:wbeats e) spb)
                       [pt pd] (when take (get tw (:id e)))]
                   (cond-> (assoc e :ws ws :wd wd
                                  :t (if take (or pt ws) (or (:t e) ws))
                                  :dur (if take (or pd wd) (or (:dur e) wd)))
                     (and take (nil? pt) (not (:rest e))) (assoc :skip true)))))
          (remove :skip)
          vec))))

(defn bar-starts
  "Where the measures of a tree's first voice start, in written seconds."
  [tree]
  (let [v (first-voice tree)
        spb (/ 60 (or (:tempo (mt/attrs v)) (:tempo (mt/attrs tree)) 60))
        ms (filter #(= :measure (mt/tag %)) (tree-seq mt/node? mt/kids v))]
    (vec (butlast (reductions + 0 (map (fn [m] (* spb (or (some-> (:meter (mt/attrs m)) ((fn [[p q]] (* p (/ 4 q))))) (mt/duration m)))) ms))))))

;; ───────── where things are drawn ─────────

(def ^:private e4-step (+ (* 4 7) 2))

(defn- step-of [nm] (when-let [s (sp/parse nm)] (+ (* 7 (:oct s)) (:step s))))

(defn- heights [m nm]
  {:free (* (- m 64) (/ 7 12)) :grid (* (- (js/Math.round m) 64) (/ 7 12))
   :staff (- (or (step-of nm) (+ e4-step (* (- (js/Math.round m) 64) (/ 7 12)))) e4-step)})

(defn height-at [h r] (let [r (clamp r)] (if (<= r 0.5) (lerp (:free h) (:grid h) (* 2 r)) (lerp (:grid h) (:staff h) (* 2 (- r 0.5))))))

(defn project
  "Where each part of each sound is drawn (x in seconds, y in diatonic steps above E4) and how much of it (0…1), at
   the resolution res: {:notes [...] :bars [{:x :alpha}] :span [t0 t1]} — see the top of this file."
  [evs res {:keys [key bars]}]
  (let [sig (or key 0)
        t1 (reduce max 0.001 (mapcat (fn [e] [(+ (:t e) (:dur e)) (+ (:ws e) (:wd e))]) evs))
        u (fn [t] (/ t t1))
        r (fn [ax t] (at (get res ax 1) (u t)))]
    {:span [0 t1]
     :staff-alpha (fn [t] (clamp (* 2 (- (r :pitch t) 0.5))))
     :grid-alpha (fn [t] (- 1 (* 2 (js/Math.abs (- (r :pitch t) 0.5)))))
     :bars (mapv (fn [x] {:x x :alpha (r :time x)}) (rest bars))
     :notes (mapv (fn [e]
                    (if (:rest e)
                      ;; an event for the electronics: nothing drawn but its wires, from the top of the staff
                      (let [rt (r :time (:t e))]
                        {:id (:id e) :rest true :wires (note-wires (:wire e)) :r {:time rt :pitch 1 :glyph 1}
                         :x (lerp (:t e) (:ws e) rt) :x1 (lerp (+ (:t e) (:dur e)) (+ (:ws e) (:wd e)) rt) :y 9 :y1 9})
                    (let [rt (r :time (:t e)) rp (r :pitch (:t e)) rg (r :glyph (:t e))
                          h0 (heights (:midi e) (:name e))
                          h1 (if (:midi2 e) (heights (:midi2 e) nil) h0)
                          v (note-value (:wbeats e))
                          w (sp/parse (:name e))
                          staffness (clamp (* 2 (- rp 0.5)))
                          acc (when w (when (not= (:alter w) (sp/key-alter sig (:step w))) ({-2 "𝄫" -1 "♭" 0 "♮" 1 "♯" 2 "𝄪"} (:alter w))))]
                      {:id (:id e) :name (:name e) :wires (note-wires (:wire e)) :r {:time rt :pitch rp :glyph rg}
                       :x (lerp (:t e) (:ws e) rt) :x1 (lerp (+ (:t e) (:dur e)) (+ (:ws e) (:wd e)) rt)
                       :y (height-at h0 rp) :y1 (height-at h1 rp) :gliss (some? (:midi2 e))
                       :stroke (- 1 rg) :thick (clamp (:amp e)) :head rg
                       :dur-line (* rg (- 1 rt))
                       :stem (if (:stem v) (* rg rt) 0) :filled (:filled v) :flags (:flags v) :dots (:dots v)
                       :acc acc :acc-alpha (if acc (* rg staffness) 0)
                       :cents (js/Math.round (* 100 (- (:midi e) (js/Math.round (:midi e)))))})))
                  evs)}))

;; ───────── the drawing ─────────

(defn- f1 [x] (str (r3 x)))
(defn- op [a] (f1 (clamp a)))
(defn- esc [s] (-> (str s) (str/replace "&" "&amp;") (str/replace "<" "&lt;") (str/replace ">" "&gt;")))

(defn layout
  "The geometry of a drawing of w × h: {:x0 :x1 :step :base} (x0 leaves room for the clef and key signature)."
  [w h]
  {:x0 92 :x1 (- w 14) :step (max 3.2 (min 6 (/ h 34))) :base (* h 0.66)})

(defn svg
  "A tree drawn as a continuum in a box of w × h, as SVG text (its parts have classes ct-…). opts: {:res … :take id}
   (by default the tree's own :continuum, else written)."
  [tree w h & [opts]]
  (let [c (:continuum (mt/attrs tree))
        res (or (:res opts) (:res c) (preset-res :written))
        take (if (contains? opts :take) (:take opts) (:take c))
        evs (events tree take)
        a (mt/attrs (first-voice tree))
        key (or (:sig (sp/parse-key (or (:key a) (:key (mt/attrs tree))))) 0)
        p (project evs res {:key key :bars (bar-starts tree)})
        {:keys [x0 x1 step base]} (layout w h)
        [_ t1] (:span p)
        sx (fn [t] (+ x0 (* (- x1 x0) (/ t t1))))
        sy (fn [s] (- base (* step s)))
        slices 60 dt (/ t1 slices)
        staff (fn [t] ((:staff-alpha p) t)) grid (fn [t] ((:grid-alpha p) t))
        lane 12]
    (str
     ;; the wires (discussion #217), written on their notes (:wire): from the note up to the electronics' lane —
     ;; rigid solid, elastic dashed with its tolerance along the lane, led by the electronics with a diamond
     (apply str
            (for [n (:notes p) [i w] (map-indexed vector (:wires n))
                  ;; a rest's wires (the electronics' own events) are led, at their time
                  :let [kind (if (:rest n) :elastic (keyword (name (or (:kind w) :rigid))))
                        lead (if (:rest n) :electronics (keyword (name (or (:leader w) :performer))))
                        x (sx (:x n)) y (- (sy (:y n)) (* 1.4 step))
                        wid (str (:id n) (when (> (count (:wires n)) 1) (str "/" i)))
                        label (pr-str (:send w))]]
              (str "<g class=\"ct-wire ct-" (name kind) (when (= lead :electronics) " ct-led") "\" data-wire=\"" (esc wid) "\">"
                   "<line x1=\"" (f1 x) "\" x2=\"" (f1 x) "\" y1=\"" (f1 y) "\" y2=\"" (f1 lane) "\"/>"
                   (when (and (= kind :elastic) (pos? (or (:tol w) 0)))
                     (str "<line class=\"ct-tol\" x1=\"" (f1 x) "\" x2=\"" (f1 (sx (+ (:x n) (:tol w)))) "\" y1=\"" (f1 lane) "\" y2=\"" (f1 lane) "\"/>"))
                   (if (= lead :electronics)
                     (str "<path d=\"M" (f1 x) " " (f1 (- lane 4)) " l4 4 l-4 4 l-4 -4 z\"/>")
                     (str "<circle cx=\"" (f1 x) "\" cy=\"" (f1 lane) "\" r=\"2.5\"/>"))
                   "<text x=\"" (f1 (+ x 5)) "\" y=\"" (f1 (- lane 3)) "\">" (esc label) "</text></g>")))
     ;; the staff before time 0 (the clef and key signature sit there) and slice by slice after it
     (let [a (staff 0)]
       (when (> a 0.01)
         (apply str (for [k [0 2 4 6 8]] (str "<line class=\"ct-staff\" x1=\"6\" x2=\"" (f1 x0) "\" y1=\"" (f1 (sy k)) "\" y2=\"" (f1 (sy k)) "\" opacity=\"" (op a) "\"/>")))))
     (apply str
            (for [s (range slices)]
              (let [t (* (+ s 0.5) dt) a (staff t) g (grid t) xa (sx (* s dt)) xb (sx (* (inc s) dt))]
                (str (when (> a 0.01)
                       (apply str (for [k [0 2 4 6 8]] (str "<line class=\"ct-staff\" x1=\"" (f1 xa) "\" x2=\"" (f1 xb) "\" y1=\"" (f1 (sy k)) "\" y2=\"" (f1 (sy k)) "\" opacity=\"" (op a) "\"/>"))))
                     (when (> g 0.01)
                       (apply str (for [m (range -8 22)]
                                    (str "<line class=\"ct-semi\" x1=\"" (f1 xa) "\" x2=\"" (f1 xb) "\" y1=\"" (f1 (sy (* m (/ 7 12)))) "\" y2=\"" (f1 (sy (* m (/ 7 12)))) "\" opacity=\"" (op (* 0.5 g (if (zero? (mod m 12)) 1.6 1))) "\"/>"))))))))
     (apply str (for [{:keys [x alpha]} (:bars p) :let [al (* alpha (max (staff x) 0.35))] :when (> al 0.02)]
                  (str "<line class=\"ct-bar\" x1=\"" (f1 (sx x)) "\" x2=\"" (f1 (sx x)) "\" y1=\"" (f1 (sy 8)) "\" y2=\"" (f1 (sy 0)) "\" opacity=\"" (op al) "\"/>")))
     (apply str
            (for [n (remove :rest (:notes p))]
              (let [x (sx (:x n)) xe (sx (:x1 n)) y (sy (:y n)) y1 (sy (:y1 n))
                    head (:head n) st (staff (:x n)) up (< (:y n) 4) sd (if up -1 1)]
                (str
                 (when (> (:stroke n) 0.01)
                   (str "<path class=\"ct-stroke\" d=\"M" (f1 x) " " (f1 y) " L" (f1 xe) " " (f1 y1) "\" stroke-width=\"" (f1 (+ 1.5 (* 8 (:thick n)))) "\" opacity=\"" (op (* 0.85 (:stroke n))) "\"/>"))
                 (when (> head 0.01)
                   (str
                    (when (> st 0.01)
                      (let [s (js/Math.round (:y n))
                            ls (concat (when (< s 0) (range -2 (dec s) -2)) (when (> s 8) (range 10 (inc s) 2)))]
                        (apply str (for [l ls] (str "<line class=\"ct-ledger\" x1=\"" (f1 (- x 8)) "\" x2=\"" (f1 (+ x 8)) "\" y1=\"" (f1 (sy l)) "\" y2=\"" (f1 (sy l)) "\" opacity=\"" (op (* head st)) "\"/>")))))
                    (when (> (:dur-line n) 0.01)
                      (str "<path class=\"ct-line\" d=\"M" (f1 (+ x 5)) " " (f1 y) " L" (f1 xe) " " (f1 y1) "\" opacity=\"" (op (:dur-line n)) "\"/>"))
                    (when (and (:gliss n) (> (:stem n) 0.01))
                      (str "<path class=\"ct-line\" d=\"M" (f1 (+ x 6)) " " (f1 y) " L" (f1 (- xe 3)) " " (f1 y1) "\" opacity=\"" (op (:stem n)) "\"/>"))
                    (str "<ellipse class=\"ct-head\" data-id=\"" (esc (or (:id n) "")) "\" cx=\"" (f1 x) "\" cy=\"" (f1 y) "\" rx=\"" (f1 (* 1.1 step)) "\" ry=\"" (f1 (* 0.78 step))
                         "\" transform=\"rotate(-20 " (f1 x) " " (f1 y) ")\" fill-opacity=\"" (op (if (:filled n) 1 (- 1 (get-in n [:r :time])))) "\" opacity=\"" (op head) "\"><title>"
                         (esc (str (:name n) (when-not (zero? (:cents n)) (str " " (when (pos? (:cents n)) "+") (:cents n) "¢")) (when (:id n) (str " · " (:id n))))) "</title></ellipse>")
                    (when (> (:stem n) 0.01)
                      (let [sxp (if up (+ x (* 1.0 step)) (- x (* 1.0 step))) y2 (+ y (* sd 7 step))]
                        (str "<line class=\"ct-stem\" x1=\"" (f1 sxp) "\" x2=\"" (f1 sxp) "\" y1=\"" (f1 y) "\" y2=\"" (f1 y2) "\" opacity=\"" (op (:stem n)) "\"/>"
                             (apply str (for [k (range (:flags n))]
                                          (let [fy (- y2 (* sd k 1.4 step))]
                                            (str "<path class=\"ct-flag\" d=\"M" (f1 sxp) " " (f1 fy) " q" (f1 (* 1.5 step)) " " (f1 (* -1 sd 1.3 step)) " " (f1 (* 1.3 step)) " " (f1 (* -1 sd 3 step)) "\" opacity=\"" (op (:stem n)) "\"/>")))))))
                    (when (and (pos? (:dots n)) (> (:stem n) 0.01))
                      (str "<circle class=\"ct-head\" cx=\"" (f1 (+ x (* 1.9 step))) "\" cy=\"" (f1 (- y (* 0.4 step))) "\" r=\"" (f1 (* 0.3 step)) "\" opacity=\"" (op (:stem n)) "\"/>"))
                    (when (> (:acc-alpha n) 0.01)
                      (str "<text class=\"ct-acc\" x=\"" (f1 (- x (* 3.2 step))) "\" y=\"" (f1 (+ y step)) "\" opacity=\"" (op (:acc-alpha n)) "\">" (:acc n) "</text>"))))
                 (when (and (< (get-in n [:r :pitch]) 0.25) (not (zero? (:cents n))))
                   (str "<text class=\"ct-cents\" x=\"" (f1 (+ x 3)) "\" y=\"" (f1 (- y (* 1.6 step))) "\" opacity=\"" (op (- 1 (* 4 (get-in n [:r :pitch])))) "\">"
                        (when (pos? (:cents n)) "+") (:cents n) "¢</text>")))))))))
