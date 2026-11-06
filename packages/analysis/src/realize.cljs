;; realize~ · descriptors written → the sliders of a faust~ that sound like them (discussion #114, Study 37)
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…).
;; What arrives is a frame of a score: a loudness, a brightness (the spectral centroid, Hz), a noisiness (the
;; spectral flatness) and a pitch — what features~ and pitch~ hear, so another sound can drive it, or curves
;; drawn on canvases read back (reader~ → snapshot~). What leaves is [:slider value] for the faust~ on its
;; left outlet: its `pitch` (MIDI) or `freq` (Hz) slider takes the pitch, its `gain` (dB or a level) the
;; loudness, and its other sliders, the timbre, are set to the blend of the settings of that faust~ that come
;; nearest to the brightness and noisiness written (where a pitch is written, among the settings in which YIN
;; would hear it). To know them, it learns the faust~ first (the task :learn: steady settings played offline
;; and heard, @kairotic/faust-units' notation.mjs), when the first frame arrives or on `learn`.
;; It can also listen to what it plays: features~ of the faust~'s sound on its last three inlets (loudness,
;; brightness, noisiness heard). Then it asks for more where what is heard falls short of what is written,
;; little by little (a correction that grows while the difference lasts, within limits), as the study's
;; passes did offline.
(let [meyda-url "npm:meyda@5.6.3/dist/web/meyda.min.js"
      origins ["npm:@kairotic/faust-units@0.1.4/dist/notation.mjs" "kairotic/packages/faust-units/notation.mjs"]
      silent -50
      every 0.04                                   ; seconds: at most one new setting this often
      ;; listening: how much of each difference heard goes into the correction, and how far it may go
      rate 0.08
      limits {:loud 18 :lb 2 :nz 0.4}
      bank-size (fn [args] (js/Math.round (api/clamp (or (first (filter number? args)) 300) 40 2000)))
      midi-in? (fn [args] (some #{:midi} args))
      sq (fn [x] (* x x))
      log2 (fn [x] (/ (js/Math.log x) js/Math.LN2))
      ;; a loudness as dB: a level (0 < v ≤ 1, as features~ rms) or dB already (≤ 0); 0 is silence
      db-of (fn [v] (cond (not (number? v)) nil (zero? v) -100 (and (pos? v) (<= v 1)) (api/db v) :else v))
      ;; the nearest settings of the bank to what is written, blended: {:u [...] :loud0 dB :d distance}
      nearest (fn [bank {:keys [pitch lb nz voiced]}]
                (let [[sl sn] (:sd bank)
                      top (reduce (fn [top e]
                                    (let [d (js/Math.sqrt (+ (if pitch (sq (/ (- pitch (nth e 0)) 6)) 0)
                                                             (sq (/ (- lb (nth e 1)) sl))
                                                             (sq (/ (- nz (nth e 2)) sn))
                                                             (if voiced (sq (* 2 (- 1 (nth e 3)))) 0)))]
                                      (if (or (< (count top) 6) (< d (first (peek top))))
                                        (let [t (vec (sort-by first (conj top [d e])))] (if (> (count t) 6) (pop t) t))
                                        top)))
                                  [] (:entries bank))
                      ws (mapv (fn [[d _]] (/ 1 (+ d 0.05))) top)
                      W (reduce + ws)
                      nu (count (:timbre bank))
                      avg (fn [j] (/ (reduce + (map (fn [w [_ e]] (* w (nth e j))) ws top)) W))]
                  {:u (mapv (fn [k] (avg (+ 5 k))) (range nu)) :loud0 (avg 4) :d (first (first top))}))
      ;; the values for the faust~, and only those that changed: [[0 [:cutoff 1800]] …]
      settle (fn [st at]
               (let [{:keys [bank]} st
                     ;; a lane that never arrived keeps the middle of what the faust~ can do
                     want (merge {:lb (first (:mid bank)) :nz (second (:mid bank))} (:want st))
                     ;; what is asked of the bank: what is written, corrected by what was heard
                     {cl :loud clb :lb cnz :nz} (:corr st)
                     [lb-lo lb-hi] (or (:lbr bank) [0 20])
                     ask (cond-> want
                           (and cl (:loud want)) (update :loud + cl)
                           clb (assoc :lb (api/clamp (+ (:lb want) clb) lb-lo lb-hi))
                           cnz (assoc :nz (api/clamp (+ (:nz want) cnz) 0 1)))
                     loud (:loud want)]
                 (if (and (nil? loud) (nil? (:pitch want)) (nil? (get-in st [:want :lb])) (nil? (get-in st [:want :nz])))
                   {:state (assoc st :t at)}
                   (let [quiet? (and loud (< loud silent))
                         {:keys [u loud0 d]} (if quiet? {:u (:u st) :loud0 0 :d (:reach st)} (nearest bank ask))
                         ;; the timbre glides to where it goes (half the way every 40 ms), and keeps
                         ;; gliding when nothing more arrives (a value written once, a canvas held)
                         goal u
                         u (if (and (:u st) (not quiet?)) (mapv (fn [a b] (+ a (* 0.5 (- b a)))) (:u st) u) u)
                         moving? (and goal u (not quiet?) (some (fn [[a b]] (> (js/Math.abs (- a b)) 0.004)) (map vector u goal)))
                         g (:gain bank) p (:pitch bank)
                         gain-v (when (and g loud) (let [dB (if quiet? -100 (- (:loud ask) loud0))]
                                          (if (:db g) (api/clamp dB (:min g) (:max g))
                                              (api/clamp (js/Math.pow 10 (/ dB 20)) (:min g) (:max g)))))
                         pitch-v (when (and p (:pitch want))
                                   (api/clamp (if (= "hz" (:kind p)) (api/midi->hz (:pitch want)) (:pitch want)) (:min p) (:max p)))
                         vals (cond-> (if (and u (not quiet?))
                                        (into {} (map (fn [s x] [(:label s) (api/from-unit x (:min s) (:max s) (:log s))]) (:timbre bank) u))
                                        {})
                                gain-v (assoc (:label g) gain-v)
                                (and pitch-v (not quiet?)) (assoc (:label p) pitch-v))
                         span (fn [label] (let [s (or (first (filter #(= label (:label %)) (:timbre bank))) (when (= label (:label g)) g) p)]
                                            (js/Math.abs (- (:max s) (:min s)))))
                         changed (filter (fn [[k v]] (let [old (get (:sent st) k)]
                                                       (or (nil? old) (> (js/Math.abs (- v old)) (* 0.002 (span k))))))
                                         vals)
                         reach (when d (/ (js/Math.round (* 100 d)) 100))]
                     {:state (-> st (assoc :t at :u (or u (:u st)) :reach reach :dirty (boolean moving?)
                                            :tick (or (:tick st) (boolean moving?)))
                                 (update :sent merge (into {} changed)))
                      :later (when (and moving? (not (:tick st))) [[(+ at every) 0 :realize-tick]])
                      :out (cond-> (mapv (fn [[k v]] [0 [(keyword k) (api/nice v)]]) changed)
                             (and reach (not= reach (:reach st))) (conj [1 reach]))
                      :show {:status :ready :faust (:faust bank) :n (count (:entries bank)) :want want :reach reach
                             :listening (some? (:corr st))}}))))
      ;; each request is numbered, so the answer to an older one is dropped
      learn (fn [st args]
              (let [k (inc (:k st 0))]
                {:state (assoc st :learning true :error nil :k k :corr nil)
                 :show {:status :learning}
                 :effects [[:learn {:n (bank-size args) :k k}]]}))]
  {;; ── about ──
   :class "realize~"
   :license "MPL-2.0"
   :doc "Plays a faust~ from descriptors, as a score of them: loudness (dB, or a level 0…1 as features~ rms), brightness (Hz, the spectral centroid), noisiness (0…1, the spectral flatness) and pitch (Hz as pitch~ sends it, 0 for none; MIDI with `midi`). Its left outlet goes to the faust~: the faust~'s pitch or freq slider takes the pitch, its gain slider the loudness, and its other sliders are set to the settings of that faust~ that sound nearest to the brightness and noisiness written. It learns them first by playing steady settings of the faust~ offline and listening (300 by default), when the first values arrive or on learn; learn again after changing the faust~'s code. With features~ of the faust~'s sound on its last three inlets (rms, centroid, flatness) it listens to what it plays and asks for more where it falls short. On the right, how far the nearest setting is from what is written (above 1: the faust~ cannot sound like that)."
   :usage "realize~ [settings] [midi]"
   :io [7 2]
   :size [236 46]

   ;; ── tasks: learning the faust~ it drives, outside its pure logic ──
   :tasks {:learn (fn [{:keys [n]} box]
                    (let [f (first (filter (fn [w] (and (= "faust~" (:class w)) (zero? (:outlet w)))) (:wired box)))
                          src (str (get-in f [:data :source]))
                          ;; the compilation of its code, waited for (a faust~ just written is still compiling)
                          compiled (fn compiled [tries]
                                     (let [r (api/compiled "faust" src)]
                                       (cond (= :ok (:status r)) (js/Promise.resolve r)
                                             (and (#{:compiling :empty} (:status r)) (pos? tries))
                                             (js/Promise. (fn [ok] (js/setTimeout (fn [] (ok nil)) 250)))
                                             :else (js/Promise.reject (js/Error. (str "the faust~ does not compile: " (or (:error r) "no code")))))))
                          wait (fn wait [tries]
                                 (.then (compiled tries) (fn [r] (if r r (wait (dec tries))))))]
                      (if-not f
                        (js/Promise.reject (js/Error. "connect its left outlet to a faust~: it learns the one it plays"))
                        (-> (wait 120)
                            (.then (fn [r]
                                     (when (get-in r [:info :poly])
                                       (throw (js/Error. "it plays a faust~ of one voice (this one declares nvoices)")))
                                     (let [fac (.-factory (:value r))]
                                       (-> (js/Promise.all #js [(api/load-script meyda-url) (api/import-module origins)])
                                           (.then (fn [[_ m]]
                                                    (.learn m #js {:module (or (.-module fac) (.-code fac))
                                                                   :json (js/JSON.parse (.-json fac))
                                                                   :Meyda (.-Meyda js/window) :n n})))))))
                            (.then (fn [b]
                                     (let [b (js->clj b :keywordize-keys true)
                                           es (:entries b)
                                           avg (fn [j] (/ (reduce + (map (fn [e] (nth e j)) es)) (count es)))]
                                       (assoc b :faust (name (:id f)) :mid [(avg 1) (avg 2)]
                                              :lbr [(reduce min (map (fn [e] (nth e 1)) es)) (reduce max (map (fn [e] (nth e 1)) es))]))))))))}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [st (or state {})]
                (cond
                  ;; what learning found
                  (= inlet :task)
                  (cond
                    (not= (:k (:arg value)) (:k st)) {}
                    (:error value) {:state (assoc st :learning false :error (:error value))
                                    :show {:status :error :error (:error value)}}
                    :else (let [st (assoc st :learning false :bank (:value value) :sent {} :u nil)]
                            (settle st (or at (:t st) 0))))

                  (#{:learn "learn" :bang} value) (learn st args)

                  ;; a moment later: the last frame that arrived while it waited
                  (= value :realize-tick) (if (and (:bank st) (:dirty st)) (settle (assoc st :tick false) at) {:state (assoc st :tick false)})

                  ;; what is heard in what it plays (features~ of the faust~): the correction grows by a part of
                  ;; the difference, while something is written and sounds
                  (and (#{4 5 6} inlet) (number? value))
                  (let [heard (case inlet 4 (db-of value) 5 (when (pos? value) (log2 value)) 6 value)
                        k ({4 :loud 5 :lb 6 :nz} inlet)
                        want (:want st)
                        st (cond-> st (= k :loud) (assoc :heard-loud heard))
                        sounding? (and (:bank st) (number? (:loud want)) (> (:loud want) silent)
                                       (> (or (:heard-loud st) -100) silent))]
                    (if (and sounding? (number? heard) (number? (get want k)))
                      (let [c (api/clamp (+ (get-in st [:corr k] 0) (* rate (- (get want k) heard))) (- (limits k)) (limits k))
                            st (-> st (assoc-in [:corr k] c) (assoc :dirty true))]
                        (if (or (nil? (:t st)) (>= (- at (:t st)) every))
                          (settle st at)
                          (if (:tick st) {:state st} {:state (assoc st :tick true) :later [[(+ (:t st) every) 0 :realize-tick]]})))
                      {:state st}))

                  (and (integer? inlet) (number? value))
                  (let [midi (when (and (= inlet 3) (pos? value)) (if (midi-in? args) value (api/hz->midi value)))
                        want (case inlet
                               0 (assoc (:want st) :loud (db-of value))
                               1 (if (pos? value) (assoc (:want st) :lb (log2 value)) (:want st))
                               2 (assoc (:want st) :nz (api/clamp value 0 1))
                               3 (if midi (assoc (:want st) :pitch midi :voiced true) (assoc (:want st) :voiced false))
                               (:want st))
                        st (assoc st :want want :dirty true)]
                    (cond
                      (:bank st) (if (or (nil? (:t st)) (>= (- at (:t st)) every))
                                   (settle st at)
                                   (if (:tick st)
                                     {:state st}
                                     {:state (assoc st :tick true) :later [[(+ (:t st) every) 0 :realize-tick]]}))
                      (or (:learning st) (:error st)) {:state st}
                      :else (learn st args)))

                  :else {})))

   ;; ── view: what it learnt, what is written now, and how far the faust~ is from it ──
   :draw (fn [{:keys [shown w h]}]
           (let [{:keys [status faust n want reach error]} shown
                 line1 (case status
                         :learning "learning the faust~ it plays…"
                         :ready (str "plays " faust " · " n " settings heard" (when (:listening shown) " · listening"))
                         :error (str "✗ " error)
                         "waits for a faust~ and a score")
                 fmt (fn [x d] (if (number? x) (.toFixed x d) "–"))
                 line2 (when (= status :ready)
                         (str (fmt (:loud want) 0) " dB · "
                              (if (:lb want) (str (js/Math.round (js/Math.pow 2 (:lb want))) " Hz") "–") " · "
                              (fmt (:nz want) 2)
                              (when (and (:voiced want) (:pitch want)) (str " · " (api/midi-name (js/Math.round (:pitch want)))))))
                 bw (- w 16) far (when (number? reach) (api/clamp (/ reach 2) 0 1))]
             (cond-> [[:rect {:x 2 :y 2 :w (- w 4) :h (- h 4) :r 4 :stroke :grid :fill :bg}]
                      [:text {:x 8 :y 15 :size 9 :fill (if (= status :error) :kairos :ink)} line1]]
               line2 (conj [:text {:x 8 :y 28 :size 9 :fill :soft} line2])
               far (conj [:rect {:x 8 :y 35 :w bw :h 4 :r 2 :fill :grid :stroke nil}]
                         [:rect {:x 8 :y 35 :w (max 2 (* bw far)) :h 4 :r 2 :fill (if (> reach 1) :kairos :accent) :stroke nil}]))))})
