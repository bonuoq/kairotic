(in-ns 'user)
;; ───────────────────────── the room's channels and tempo (@kairotic/net, discussion #135) ─────────────────────────
;; Boxes of @kairotic/net (share, shared, pulse) reach the room through window.kairoticRoom, so a package
;; never touches the page: a value shared on a channel goes to every page of the room (this one too, as
;; a bus), and the tempo is one for the whole room — started on any page, the same beat on all, from the
;; room's clock (talk-now). Outside a room they work for this page alone.

(defonce net-listeners (atom {}))      ; channel → {key fn}
(defonce net-tempo (atom nil))         ; {:t0 shared-ms :bpm b} or nil
(defonce net-tempo-watchers (atom {})) ; key → fn

(defn net-deliver! [ch v from]
  (doseq [[_ f] (get @net-listeners ch)] (try (f v from) (catch :default e (js/console.error "share" e)))))

(defn net-share!
  "Shares a value on a channel of the room: (net-share! \"notes\" [60 64 67])."
  [ch v]
  (let [edn (pr-str v)]
    (when (< (count edn) 60000)
      (talk-to-all! {:share {:ch (str ch) :v edn :from (talk-name)}})
      (net-deliver! (str ch) v (talk-name)))
    v))

(defn net-on-share! [o]
  (let [v (try (clojure.edn/read-string {:default (fn [_ x] x)} (.-v o)) (catch :default _ ::bad))]
    (when-not (= v ::bad) (net-deliver! (str (.-ch o)) v (.-from o)))))

(defn net-set-tempo!
  "The tempo of the room: {:t0 shared-ms :bpm b} (beat 0 at t0), or nil to stop. Every page of the room hears it."
  [t]
  (reset! net-tempo t)
  (talk-to-all! {:tempo t})
  t)

(defn net-on-tempo! [t]
  (reset! net-tempo (when t {:t0 (.-t0 t) :bpm (.-bpm t)})))

(defn net-joined! [id] (talk-to! id {:tempo @net-tempo}))

(defn net-beat "The beat of the room now (fractional), or nil without a tempo." []
  (when-let [{:keys [t0 bpm]} @net-tempo] (/ (* (- (talk-now) t0) bpm) 60000)))

(defn net-start!
  "Starts the room's tempo at bpm: beat 0 on the next whole second plus one, the same for every page."
  [bpm]
  (let [n (talk-now)]
    (net-set-tempo! {:t0 (+ 1000 (* 1000 (js/Math.ceil (/ n 1000)))) :bpm (api/clamp bpm 20 400)})))

(defn net-bpm!
  "Changes the tempo of the room keeping the beat where it is (no jump)."
  [bpm]
  (if-let [b (net-beat)]
    (let [bpm (api/clamp bpm 20 400) n (talk-now)]
      (net-set-tempo! {:t0 (- n (/ (* b 60000) bpm)) :bpm bpm}))
    (net-start! bpm)))

(add-watch net-tempo :watchers (fn [_ _ _ t] (doseq [[_ f] @net-tempo-watchers] (try (f t) (catch :default _ nil)))))

;; what the boxes of @kairotic/net see
(set! (.-kairoticRoom js/window)
      #js {:now (fn [] (talk-now))
           :inRoom (fn [] (boolean (:id @talk-room)))
           :share (fn [ch v] (net-share! ch v))
           :onShare (fn [ch f] (let [k (gensym "l")] (swap! net-listeners assoc-in [(str ch) k] f)
                                 (fn [] (swap! net-listeners update (str ch) dissoc k))))
           :tempo (fn [] @net-tempo)
           :start (fn [bpm] (net-start! bpm))
           :bpm (fn [bpm] (net-bpm! bpm))
           :stop (fn [] (net-set-tempo! nil))})

;; ───────── the tempo in the Room tab, with a metronome ─────────

(defonce net-metro (atom {:on false :until nil}))

(defn net-click! [at-ms down?]
  (let [c (eng/ctx) t (+ (.-currentTime c) (max 0 (/ (- at-ms (talk-now)) 1000)))
        o (.createOscillator c) g (.createGain c)]
    (set! (.. o -frequency -value) (if down? 1760 1320))
    (.setValueAtTime (.-gain g) 0.3 t) (.exponentialRampToValueAtTime (.-gain g) 0.001 (+ t 0.05))
    (.connect o g) (.connect g (.-destination c)) (.start o t) (.stop o (+ t 0.06))))

(defn net-text! [el v] (when (and el (not= v (.-textContent el))) (set! (.-textContent el) v)))

(defn net-frame! [& _]
  (let [t @net-tempo
        shown (some-> ($ "panel-talk") .-hidden not)]
    ;; nothing to draw unless the Room tab is open, and nothing to do without a tempo or a room
    (when (and shown (or t (:id @talk-room)))
      (let [n (talk-now) el ($ "net-beat") b (net-beat)]
        (net-text! el (cond (nil? b) "·" (neg? b) (str "in " (.toFixed (/ (- (:t0 t) n) 1000) 1) " s") :else (str (inc (js/Math.floor b)))))
        (when el (.toggle (.-classList el) "on" (boolean (and b (>= b 0) (< (mod b 1) 0.15)))))
        (net-text! ($ "net-clock") (if (tk/clock-offset (:clock @talk-room)) (str "clock ±" (.toFixed (tk/clock-error (:clock @talk-room)) 1) " ms") ""))))
    ;; the metronome: clicks 150 ms ahead on the audio clock
    (when (and t (:on @net-metro))
      (let [n (talk-now) from (max n (or (:until @net-metro) n)) to (+ n 150)
            per (/ 60000 (:bpm t))]
        (doseq [k (range (js/Math.ceil (/ (* (- from (:t0 t)) (:bpm t)) 60000)) (inc (js/Math.floor (/ (* (- to (:t0 t)) (:bpm t)) 60000))))
                :let [at (+ (:t0 t) (* k per))] :when (and (>= k 0) (>= at from) (< at to))]
          (net-click! at (zero? (mod k 4))))
        (swap! net-metro assoc :until to))))
  (js/requestAnimationFrame net-frame!))

(when ($ "net-start")
  (.addEventListener ($ "net-start") "click" (fn [_] (.resume (eng/ctx)) (net-start! (js/parseFloat (.-value ($ "net-bpm")))) nil))
  (.addEventListener ($ "net-stop") "click" (fn [_] (net-set-tempo! nil) nil))
  (.addEventListener ($ "net-bpm") "change" (fn [_] (when @net-tempo (net-bpm! (js/parseFloat (.-value ($ "net-bpm"))))) nil))
  (.addEventListener ($ "net-metro") "change"
    (fn [_] (.resume (eng/ctx)) (swap! net-metro assoc :on (.-checked ($ "net-metro")) :until nil) nil))
  (add-watch net-tempo :tab (fn [_ _ _ t] (when (and t ($ "net-bpm")) (set! (.-value ($ "net-bpm")) (str (js/Math.round (:bpm t)))))))
  (net-frame!))
