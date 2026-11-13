;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · page · probes on wires (discussion #183)
;; To see what travels along a wire, without wiring a print in: ⌥/Alt+click a wire puts a probe on it (again,
;; takes it away), or (probe :b1 0 :b2 0). A probed wire is drawn dashed, and a label at its middle shows the last
;; value that went along it, flashing when one passes, with how many a second when they come often (12/s).
;; Probes are this tab's, as the selection is: they are not part of the work, its history or its code, and two
;; people in a room watch their own. What is watched is the outlet a wire leaves from (every wire from it carries
;; the same), so the engine keeps only what leaves the outlets watched (kairotic.engine/probe!).
;; A wire out of a sub-patch box shows nothing yet (its messages leave from a box inside it); signal wires carry
;; no messages.

(defonce wire-probes (atom {}))   ; [view-path [a o b i]] → [flat-id o], the wires probed here

(defn probe-key [[a o _ _]] [(fid a) o])

(defn probed? "Is this wire of the patch on screen probed?" [l]
  (contains? @wire-probes [(engine-path) l]))

(defn sync-probes!
  "The engine watches the outlets of the probed wires (and forgets what it saw of the others)."
  []
  (let [ks (set (vals @wire-probes))]
    (reset! eng/probes ks)
    (swap! eng/probe-seen select-keys ks)))

(defn probe
  "Puts a probe on a wire, or takes it away: (probe :b1 0 :b2 0). The wire shows the last value that went along it,
   and how many a second. Only for this tab: nothing goes into the work. Returns :on or :off."
  [a o b i]
  (let [l [a o b i]]
    (when-not (some #{l} (:lines (current))) (fail (str "There is no line " (pr-str l) " in the patch on screen")))
    (let [k [(engine-path) l]
          on (not (contains? @wire-probes k))]
      (swap! wire-probes (fn [m] (if on (assoc m k (probe-key l)) (dissoc m k))))
      (sync-probes!)
      (render-scene (current))
      (if on :on :off))))

(defn unprobe-all!
  "Takes away every probe."
  []
  (reset! wire-probes {})
  (sync-probes!)
  (render-scene (current))
  :ok)

(defn probe-summary
  "A value as a probe shows it: short."
  [v]
  (let [cut (fn [s n] (if (> (count s) n) (str (subs s 0 (dec n)) "…") s))]
    (cond
      (nil? v) "nil"
      (number? v) (cv/fmt v)
      (keyword? v) (str v)
      (string? v) (pr-str (cut v 22))
      (mt/node? v) (str "tree · " (count (try (mt/pitches v) (catch :default _ []))) " notes")
      :else (cut (pr-str v) 30))))

(defn probe-rate
  "How many messages a second went out of a probed outlet, over the last second."
  [seen]
  (let [now (.now js/performance)]
    (count (filter (fn [t] (< (- now t) 1000)) (:times seen)))))

(defn probes-svg
  "The labels of the probes of the patch on screen p, at the middle of their wires."
  [p]
  (let [path (engine-path) lines (set (:lines p))
        mine (filter (fn [[[vp l] _]] (= vp path)) @wire-probes)]
    ;; the wires that are gone (deleted, or back in the history) lose their probe
    (let [gone (keep (fn [[[_ l :as k] _]] (when-not (contains? lines l) k)) mine)]
      (when (seq gone) (js/setTimeout (fn [] (swap! wire-probes (fn [m] (apply dissoc m gone))) (sync-probes!)) 0)))
    (apply str
           (for [[[_ [a o b i :as l]] k] mine :when (contains? lines l)
                 :when (and (get-in p [:boxes a]) (get-in p [:boxes b]))]
             (let [[x1 y1] (out-xy p a o) [x2 y2] (in-xy p b i)
                   mx (/ (+ x1 x2) 2) my (/ (+ y1 y2) 2)
                   seen (get @eng/probe-seen k)
                   rate (when seen (probe-rate seen))
                   label (cond (nil? seen) "—"
                               (and rate (> rate 1)) (str (probe-summary (:v seen)) " · " rate "/s")
                               :else (probe-summary (:v seen)))
                   hot (and seen (< (- (.now js/performance) (last (:times seen))) 180))
                   w (+ 12 (* 6.4 (count label)))]
               (str "<g class=\"probe" (when hot " hot") "\" transform=\"translate(" (js/Math.round mx) "," (js/Math.round my) ")\">"
                    "<rect x=\"" (js/Math.round (- (/ w 2))) "\" y=\"-9\" width=\"" (js/Math.round w) "\" height=\"18\" rx=\"4\"></rect>"
                    "<text x=\"0\" y=\"4\" text-anchor=\"middle\">" (esc label) "</text></g>"))))))

;; a value seen by a probe is drawn on the next frame (also with the engine stopped)
(defonce probe-frame (atom false))
(defonce probe-watch
  (add-watch eng/probe-seen ::draw
             (fn [_ _ _ _]
               (when-not @probe-frame
                 (reset! probe-frame true)
                 (js/requestAnimationFrame (fn [_] (reset! probe-frame false) (render-overlay!)))))))

;; ⌥/Alt+click on a wire: a probe on it, or away
(.addEventListener svg "pointerdown"
  (fn [e]
    (when (and (.-altKey e) (not (locked?)) (not (:annot @ui)))
      (when-let [el (closest e ".wire-hit")]
        (let [idx (js/parseInt (.. el -dataset -line) 10)
              l (nth (:lines (scene-of (current))) idx nil)]
          (when l
            (.preventDefault e)
            (.stopImmediatePropagation e)
            (gesture! (str "(probe " (str/join " " l) ")")))))))
  true)

(reset! probe-hooks {:probed? probed? :labels probes-svg})
