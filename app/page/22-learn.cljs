(in-ns 'user)
;; ───────────────────────── learn: move a controller, and it moves a box (discussion #135) ─────────────────────────
;; (learn :b5), or Learn with a box selected: the next controller that moves — a MIDI controller or key, a
;; gamepad's stick or button, a phone's tilt, an OSC address — is wired to that box, as gestures of the
;; work anyone can read and change: the source (midiin, gamepad, motion or oscin; one already in the patch
;; if there is one) → control (that one control) → scale (from the controller's range to the box's: a
;; knob's min and max, logarithmic if it is) → the box. While it waits, this page listens to the page's MIDI,
;; the gamepads, the motion of the device and the OSC bridge if one is open; ▶ is not needed.
;;
;; Two scopes, asked each time (the last one is remembered):
;;   for the work  the chain above, in the patch: the same for everyone in a room (each page reads its own
;;                 devices), part of the piece
;;   only for me   nothing in the work: the mapping is kept in this browser, for this work, and the page
;;                 applies it as your own gesture — so in a jam the others hear it too (13-perform.cljs).
;;                 Each player brings their own instrument without touching the work of the others.

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

(defn learn-ranges
  "[in-lo in-hi lo hi log?]: the controller's range and the box's, for spec (see learn-wire!)."
  [target spec]
  (let [[_ _ [in-lo in-hi]] (get learn-sources (first spec))
        ;; a gamepad's buttons go 0…1, its sticks −1…1
        [in-lo in-hi] (if (and (= "pad" (first spec)) (not (re-matches #"lx|ly|rx|ry|a\d+" (second spec)))) [0 1] [in-lo in-hi])
        [lo hi lg] (learn-range (get-in (current) [:boxes target]))]
    [in-lo in-hi lo hi lg]))

(defn learn-wire!
  "Wires the control found (spec: [kind which & more], as the words of a control box) to the box learning."
  [target spec]
  (let [p (current) tb (get-in p [:boxes target])
        [cls outlet] (get learn-sources (first spec))
        [in-lo in-hi lo hi lg] (learn-ranges target spec)
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

(declare mine-add!)

(defn learn-found! [spec]
  (when-let [{:keys [target scope]} @learn-state]
    (learn-stop!)
    (if (= scope :me)
      (do (mine-add! {:spec spec :box target :range (learn-ranges target spec)})
          (repl-print! "out" (esc (str "; learnt for you only: " (str/join " " spec) " → " target " (in this browser, not in the work: (my-controls))")))
          spec)
      (let [made (learn-wire! target spec)]
        (repl-print! "out" (esc (str "; learnt for the work: " (str/join " " spec) " → " target (when (= "osc" (first spec)) " (move it end to end: the scale learns its range)"))))
        made))))

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

;; ── only for me: mappings kept in this browser, for this work, applied as your own gestures ──

(defonce learn-scope (atom (if (= "me" (try (.getItem js/localStorage "kairotic-learn-scope") (catch :default _ nil))) :me :work)))
(defonce mine (atom []))           ; [{:spec [...] :box :bN :range [in-lo in-hi lo hi log?]} …] of the open work
(defonce mine-off (atom []))       ; what stops the listeners
(defonce mine-last (atom {}))      ; [spec box] → last value sent (a moving stick or tilt sends only changes)
(defonce mine-raw (atom {}))       ; spec → last reading of a polled controller (only a move plays)

(declare mine-apply!)

(defn mine-moved!
  "A reading of a controller that is read all the time (a stick, a tilt): it plays only when it moves, not
   the first time it is read (the box keeps its value until the controller is touched)."
  [spec v]
  (let [old (get @mine-raw spec)]
    (swap! mine-raw assoc spec v)
    (when (and (some? old) (> (js/Math.abs (- v old)) 0.003)) (mine-apply! spec v))))

(defn mine-key [] (str "kairotic-controls:" (name (or (:kind @work) :local)) ":" (or (:id @work) "local")))

(defn mine-save! []
  (try (.setItem js/localStorage (mine-key) (pr-str @mine)) (catch :default _ nil)))

(defn mine-load! []
  (reset! mine (or (try (some-> (.getItem js/localStorage (mine-key)) clojure.edn/read-string vec) (catch :default _ nil)) [])))

(defn mine-value
  "A controller's value through a mapping's ranges: what goes to the box."
  [[in-lo in-hi lo hi lg] v]
  (let [u (api/clamp (if (== in-lo in-hi) 0 (/ (- v in-lo) (- in-hi in-lo))) 0 1)]
    (api/nice (if (and lg (pos? lo) (pos? hi)) (* lo (js/Math.pow (/ hi lo) u)) (+ lo (* u (- hi lo)))))))

(defn mine-apply!
  "A controller (spec as Learn writes it) moved to v: every mapping of it plays its box, as a gesture of yours."
  [spec v]
  (doseq [{s :spec box :box r :range} @mine
          :when (and (= s spec) (get-in (current) [:boxes box]))]
    (let [out (mine-value r v)]
      (when (not= out (get @mine-last [spec box]))
        (swap! mine-last assoc [spec box] out)
        (inject-local! box 0 out)))))

(defn mine-listen! []
  (doseq [f @mine-off] (try (f) (catch :default _ nil)))
  (reset! mine-off [])
  (let [kinds (set (map (comp first :spec) @mine))]
    (when (or (kinds "cc") (kinds "note"))
      (let [on (fn [e] (let [[s a b] (js/Array.from (.-data e)) hi (bit-and s 0xF0) ch (inc (bit-and s 0x0F))]
                         (cond (= hi 0xB0) (do (mine-apply! ["cc" (str a) (str ch)] (/ b 127)) (mine-apply! ["cc" (str a)] (/ b 127)))
                               (= hi 0x90) (mine-apply! ["note" (str a)] (/ b 127))
                               (= hi 0x80) (mine-apply! ["note" (str a)] 0))))
            ins (atom [])]
        (when-let [p (or (.-kairoticMidi js/window) (when (.-requestMIDIAccess js/navigator)
                                                       (let [p (.requestMIDIAccess js/navigator #js {:sysex false})]
                                                         (set! (.-kairoticMidi js/window) p) p)))]
          (.catch (.then p (fn [m] (reset! ins (vec (js/Array.from (.values (.-inputs m)))))
                             (doseq [i @ins] (.addEventListener i "midimessage" on))))
                  (fn [_] nil)))
        (swap! mine-off conj (fn [] (doseq [i @ins] (.removeEventListener i "midimessage" on))))))
    (when (kinds "pad")
      (let [alive (atom true)]
        (letfn [(poll [& _]
                  (when @alive
                    (doseq [p (learn-pads)
                            [k v] (map-indexed vector (:axes p))]
                      (mine-moved! ["pad" (if (and (:std p) (< k 4)) (nth ["lx" "ly" "rx" "ry"] k) (str "a" k))] v))
                    (doseq [p (learn-pads)
                            [k on] (map-indexed vector (:buttons p))]
                      (mine-moved! ["pad" (if (and (:std p) (< k 17)) (nth learn-pad-buttons k) (str "b" k))] (if on 1 0)))
                    (js/requestAnimationFrame poll)))]
          (poll))
        (swap! mine-off conj (fn [] (reset! alive false)))))
    (when (kinds "tilt")
      (let [on (fn [e] (when (number? (.-gamma e))
                         (mine-moved! ["tilt" "x"] (api/clamp (/ (+ (.-gamma e) 90) 180) 0 1))
                         (mine-moved! ["tilt" "y"] (api/clamp (/ (+ (api/clamp (.-beta e) -90 90) 90) 180) 0 1))))]
        (.addEventListener js/window "deviceorientation" on)
        (swap! mine-off conj (fn [] (.removeEventListener js/window "deviceorientation" on)))))
    (when (kinds "osc")
      (let [socks (when-let [all (.-kairoticOsc js/window)] (vec (js/Object.values all)))
            on (fn [f] (let [v (aget (or (.-args f) #js []) 0)] (when (and (.-address f) (number? v)) (mine-apply! ["osc" (.-address f)] v))))]
        (doseq [s socks] (.push (.-listeners s) on))
        (swap! mine-off conj (fn [] (doseq [s socks] (set! (.-listeners s) (.filter (.-listeners s) (fn [x & _] (not= x on)))))))))))

(defn mine-add! [m]
  (swap! mine (fn [ms] (conj (vec (remove #(and (= (:spec %) (:spec m)) (= (:box %) (:box m))) ms)) m)))
  (mine-save!) (mine-listen!))

(defn my-controls
  "Your own controller mappings for this work (Learn · only for me), kept in this browser: [[n spec box] …]."
  [] (vec (map-indexed (fn [i {:keys [spec box]}] [i (str/join " " spec) box]) @mine)))

(defn forget-control
  "Forgets one of your own controller mappings, by its number in (my-controls); (forget-control :all) all of them."
  [n]
  (swap! mine (fn [ms] (if (= n :all) [] (vec (keep-indexed (fn [i m] (when (not= i n) m)) ms)))))
  (mine-save!) (mine-listen!)
  (my-controls))

;; another work has its own mappings
(add-watch work :mine (fn [_ _ o n] (when (not= [(:kind o) (:id o)] [(:kind n) (:id n)]) (mine-load!) (mine-listen!))))

;; ── the banner: the box, the scope, your mappings ──

(defn learn-banner-html [id b]
  (let [me? (= :me (:scope @learn-state))]
    (str "<p><b>Learn</b> · move a controller for <code>" (esc (name id)) " " (esc (:text b)) "</code>: a MIDI controller or key, a gamepad's stick or button, the phone's tilt, an OSC address.</p>"
         "<div class=\"learn-scope\" role=\"radiogroup\" aria-label=\"For whom\">"
         "<label><input type=\"radio\" name=\"learn-scope\" value=\"work\"" (when-not me? " checked") "> <b>for the work</b> — boxes in the patch, the same for everyone</label>"
         "<label><input type=\"radio\" name=\"learn-scope\" value=\"me\"" (when me? " checked") "> <b>only for me</b> — in this browser, played as my gesture</label>"
         "</div>"
         (when (seq @mine)
           (str "<p class=\"learn-mine\">Yours here: "
                (str/join " · " (map-indexed (fn [i {:keys [spec box]}] (str (esc (str/join " " spec)) " → " (esc (name box)) " <button class=\"act small\" data-mine-forget=\"" i "\" title=\"Forget it\">✕</button>")) @mine))
                "</p>"))
         "<div class=\"ask-bar\"><span class=\"spacer\"></span><button class=\"act\" data-learn-cancel=\"1\">Cancel · Esc</button></div>")))

(defn learn
  "Wires the next controller that moves to a box: (learn :b5) for the work (boxes in the patch), (learn :b5 :me)
   only for you (kept in this browser, played as your gesture). (learn false) stops waiting."
  ([] (learn false))
  ([id] (learn id @learn-scope))
  ([id scope]
   (learn-stop!)
   (if (and id (not= id false))
     (let [b (or (get-in (current) [:boxes id]) (fail (str "There is no box " id)))
           scope (if (= scope :me) :me :work)]
       (reset! learn-state {:target id :scope scope})
       (swap! learn-state assoc :off [(learn-listen-midi!) (learn-listen-pads!) (learn-listen-motion!) (learn-listen-osc!)])
       (when-let [t ($ "learn-toggle")] (.add (.-classList t) "on"))
       (learn-banner! (learn-banner-html id b))
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
  (.addEventListener js/document "click"
    (fn [e] (let [t (.-target e)]
              (when (.getAttribute t "data-learn-cancel") (learn false))
              (when-let [n (.getAttribute t "data-mine-forget")]
                (forget-control (js/parseInt n))
                (when-let [{:keys [target]} @learn-state] (learn-banner! (learn-banner-html target (get-in (current) [:boxes target]))))))))
  (.addEventListener js/document "change"
    (fn [e] (let [t (.-target e)]
              (when (and (= "learn-scope" (.-name t)) @learn-state)
                (let [sc (if (= "me" (.-value t)) :me :work)]
                  (swap! learn-state assoc :scope sc)
                  (reset! learn-scope sc)
                  (try (.setItem js/localStorage "kairotic-learn-scope" (name sc)) (catch :default _ nil)))))))
  (mine-load!) (mine-listen!)
  (.addEventListener js/document "keydown" (fn [e] (when (and @learn-state (= "Escape" (.-key e))) (learn false)))))
