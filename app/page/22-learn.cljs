(in-ns 'user)
;; ───────────────────────── learn: move a controller, and it moves a box (discussion #135) ─────────────────────────
;; (learn :b5), or Learn with a box selected: the next controller that moves — a MIDI controller or key, a
;; gamepad's stick or button, a phone's tilt, an OSC address — is wired to that box, as gestures of the
;; work anyone can read and change: the source (midiin, gamepad, motion or oscin; one already in the patch
;; if there is one) → control (that one control) → scale (from the controller's range to the box's: a
;; knob's min and max, logarithmic if it is) → the box. While it waits, this page listens to the page's MIDI,
;; the gamepads, the motion of the device and the OSC bridge if one is open; ▶ is not needed.

(defonce learn-state (atom nil))   ; {:target :bN :off [fns] :base {...}} while it waits

(defn learn-banner! [html]
  (let [el (floating "learn-pop" "perform-pop")]
    (if html
      (do (set! (.-innerHTML el) html) (set! (.-hidden el) false))
      (set! (.-hidden el) true))))

(defn learn-stop! []
  (when-let [s @learn-state] (doseq [f (:off s)] (try (f) (catch :default _ nil))))
  (reset! learn-state nil)
  (when-let [b ($ "learn-toggle")] (.remove (.-classList b) "on"))
  (learn-banner! nil))

;; ── what a source is, and how to reach its events ──
;; kind → [the source class, its event outlet, the controller's range]
(def learn-sources
  {"cc" ["midiin" 2 [0 1]] "note" ["midiin" 2 [0 1]] "pad" ["gamepad" 0 [-1 1]]
   "tilt" ["motion" 2 [0 1]] "osc" ["oscin" 0 [0 1]]})

(defn learn-range
  "The range of a box's input: a knob's (or any class with :min and :max) [min max log?], else [0 1 false]."
  [b]
  (let [d (comp/lookup (comp/klass (:text b))) a (when d (comp/args-for d (:text b)))]
    (if (and (map? a) (number? (:min a)) (number? (:max a)))
      [(:min a) (:max a) (boolean (:log a))]
      [0 1 false])))

(defn learn-wire!
  "Wires the control found (spec: [kind which & more], as the words of a control box) to the box learning."
  [target spec]
  (let [p (current) tb (get-in p [:boxes target])
        [cls outlet [in-lo in-hi]] (get learn-sources (first spec))
        ;; a gamepad's buttons go 0…1, its sticks −1…1
        [in-lo in-hi] (if (and (= "pad" (first spec)) (not (re-matches #"lx|ly|rx|ry|a\d+" (second spec)))) [0 1] [in-lo in-hi])
        [lo hi lg] (learn-range tb)
        existing (some (fn [[id b]] (when (= cls (comp/klass (:text b))) id)) (sort-by key (:boxes p)))
        x (:x tb) y (:y tb)
        src (or existing (next-id))]
    (when-not existing (gesture! (str "(box " src " " (pr-str cls) " " (- x 0) " " (max 0 (- y 150)) ")")))
    (let [ctl (next-id)]
      (gesture! (str "(box " ctl " " (pr-str (str "control " (str/join " " spec))) " " x " " (max 0 (- y 105)) ")"))
      (let [sc (next-id)]
        (gesture! (str "(box " sc " " (pr-str (str "scale " (api/nice in-lo) " " (api/nice in-hi) " " (api/nice lo) " " (api/nice hi) (when lg " log"))) " " x " " (max 0 (- y 60)) ")"))
        (gesture! (str "(connect " src " " outlet " " ctl " 0)"))
        (gesture! (str "(connect " ctl " 0 " sc " 0)"))
        (gesture! (str "(connect " sc " 0 " target " 0)"))
        ;; an OSC value's range is unknown: the scale learns it from the next values
        (when (= "osc" (first spec)) (send! sc :learn))
        [src ctl sc]))))

(defn learn-found! [spec]
  (when-let [{:keys [target]} @learn-state]
    (learn-stop!)
    (let [made (learn-wire! target spec)]
      (repl-print! "out" (esc (str "; learnt: " (str/join " " spec) " → " target (when (= "osc" (first spec)) " (move it end to end: the scale learns its range)"))))
      made)))

;; ── listening, while it waits ──

(defn learn-listen-midi! []
  (let [on (fn [e] (let [[s a b] (js/Array.from (.-data e)) hi (bit-and s 0xF0) ch (inc (bit-and s 0x0F))]
                     (cond (and (= hi 0xB0) (not (#{0 6 32 38 98 99 100 101} a))) (learn-found! ["cc" (str a) (str ch)])
                           (and (= hi 0x90) (pos? b)) (learn-found! ["note" (str a)]))))
        ins (atom [])]
    (when-let [p (or (.-kairoticMidi js/window) (when (.-requestMIDIAccess js/navigator)
                                                   (let [p (.requestMIDIAccess js/navigator #js {:sysex false})]
                                                     (set! (.-kairoticMidi js/window) p) p)))]
      (.then p (fn [m] (when @learn-state
                         (reset! ins (vec (js/Array.from (.values (.-inputs m)))))
                         (doseq [i @ins] (.addEventListener i "midimessage" on)))))
      (.catch p (fn [_] nil)))
    (fn [] (doseq [i @ins] (.removeEventListener i "midimessage" on)))))

(defn learn-pads []
  (let [raw (or (.-kairoticFakePads js/window) (when (.-getGamepads js/navigator) (.getGamepads js/navigator)) #js [])]
    (vec (for [p (js/Array.from raw) :when p]
           {:index (.-index p) :std (= "standard" (.-mapping p)) :axes (vec (js/Array.from (.-axes p)))
            :buttons (mapv (fn [b] (.-pressed b)) (js/Array.from (.-buttons p)))}))))

(def learn-pad-buttons ["a" "b" "x" "y" "lb" "rb" "lt" "rt" "back" "start" "ls" "rs" "up" "down" "left" "right" "home"])

(defn learn-listen-pads! []
  (let [base (atom (learn-pads)) alive (atom true)]
    (letfn [(poll [& _]
              (when (and @alive @learn-state)
                (let [now (learn-pads)
                      found (first (for [p now :let [b (first (filter #(= (:index %) (:index p)) @base))]
                                         x (concat
                                            (for [[k v] (map-indexed vector (:axes p))
                                                  :when (> (js/Math.abs (- v (get-in b [:axes k] 0))) 0.5)]
                                              (if (and (:std p) (< k 4)) (nth ["lx" "ly" "rx" "ry"] k) (str "a" k)))
                                            (for [[k on] (map-indexed vector (:buttons p))
                                                  :when (and on (not (get-in b [:buttons k])))]
                                              (if (and (:std p) (< k 17)) (nth learn-pad-buttons k) (str "b" k))))]
                                     x))]
                  (if found (learn-found! ["pad" found]) (js/requestAnimationFrame poll)))))]
      (poll))
    (fn [] (reset! alive false))))

(defn learn-listen-motion! []
  (let [base (atom nil)
        on (fn [e] (when (number? (.-gamma e))
                     (if-let [[g b] @base]
                       (cond (> (js/Math.abs (- (.-gamma e) g)) 20) (learn-found! ["tilt" "x"])
                             (> (js/Math.abs (- (.-beta e) b)) 20) (learn-found! ["tilt" "y"]))
                       (reset! base [(.-gamma e) (.-beta e)]))))]
    (.addEventListener js/window "deviceorientation" on)
    (fn [] (.removeEventListener js/window "deviceorientation" on))))

(defn learn-listen-osc! []
  ;; only through a bridge an oscin or oscout of this page has already opened
  (let [socks (when-let [all (.-kairoticOsc js/window)] (vec (js/Object.values all)))
        on (fn [f] (when (and (.-address f) (number? (aget (or (.-args f) #js []) 0))) (learn-found! ["osc" (.-address f)])))]
    (doseq [s socks] (.push (.-listeners s) on))
    (fn [] (doseq [s socks] (set! (.-listeners s) (.filter (.-listeners s) (fn [x & _] (not= x on))))))))

(defn learn
  "Wires the next controller that moves to a box: (learn :b5). (learn false) stops waiting."
  ([] (learn false))
  ([id]
   (learn-stop!)
   (if (and id (not= id false))
     (let [b (or (get-in (current) [:boxes id]) (fail (str "There is no box " id)))]
       (reset! learn-state {:target id})
       (swap! learn-state assoc :off [(learn-listen-midi!) (learn-listen-pads!) (learn-listen-motion!) (learn-listen-osc!)])
       (when-let [t ($ "learn-toggle")] (.add (.-classList t) "on"))
       (learn-banner! (str "<p><b>Learn</b> · move a controller for <code>" (esc (name id)) " " (esc (:text b)) "</code>: a MIDI controller or key, a gamepad's stick or button, the phone's tilt, an OSC address.</p>"
                           "<div class=\"ask-bar\"><span class=\"spacer\"></span><button class=\"act\" data-learn-cancel=\"1\">Cancel · Esc</button></div>"))
       id)
     nil)))

(when ($ "learn-toggle")
  (.addEventListener ($ "learn-toggle") "click"
    (fn [_] (if @learn-state
              (learn false)
              (let [[kind v] (:sel @ui)]
                (if (= kind :box)
                  (learn v)
                  (repl-print! "err" "Learn: select the box a controller should move (a knob, a number, any box), then Learn."))))))
  (.addEventListener js/document "click" (fn [e] (when (.. e -target (getAttribute "data-learn-cancel")) (learn false))))
  (.addEventListener js/document "keydown" (fn [e] (when (and @learn-state (= "Escape" (.-key e))) (learn false)))))
