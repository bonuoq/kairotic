;; render · a stretch of a pattern drawn into a freqt, through a time map
;; Part of @kairotic/patterns. Written against the Kairotic API (api/…).
;; What a player at a position would play, worked out at once (discussion #93): it sends a musical tree, so
;; a freqt shows it live, (keep! :bN) writes it with its recipe, and shown as a score it is quantized.
;; Without a canvas on its right inlet it renders [from, to) as it is; with one, each stroke of the canvas
;; is a time map — x the beats of the result, y the beats of the pattern — and the notes are where the map
;; is inside their spans: steeper is faster, down is backwards (each note from its end), flat holds, a
;; vertical step cuts, several strokes are several layers.
(let [opts-of (fn [args buffer]
                (cond-> {:from (or (:from args) 0) :to (or (:to args) 16)
                         :tex (:tex args) :tone (:tone args)}
                  (and buffer (seq (:strokes buffer))) (assoc :maps (api/canvas-maps buffer))))
      word (fn [v] (cond (keyword? v) v (string? v) (keyword v) :else nil))]
  {;; ── about ──
   :class "render"
   :license "MPL-2.0"
   :doc "Draws a stretch of a pattern (from a pbind or a pattern box) into a freqt: it sends a musical tree, shown live by the freqt (keep! writes it with its recipe; as a score it is quantized). Without a canvas on its right inlet it renders the beats from–to as they are; with one, each stroke of the canvas is a time map (x: beats of the result, y: beats of the pattern) — steeper is faster, going down plays backwards with each note entered from its end, flat holds the note it is in, a vertical step cuts, several strokes are several layers. Each note is drawn with the event's :amp as its weight and :pan as a vertical gradient; tex k and tone k draw key k as a texture or a colour. A bang renders again (after changing the canvas)."
   :usage "render [from] [to] [tex key] [tone key]"
   :io [2 1]
   :reads-buffer true

   ;; ── arguments ──
   :parse (fn [text]
            (let [ws (rest (remove #(= "" %) (.split (.trim (str text)) #"\s+")))
                  nums (keep (fn [w] (let [n (js/parseFloat w)] (when (js/isFinite n) n))) ws)
                  after (fn [k] (some (fn [[a b]] (when (= a k) (keyword (.replace b #"^:" "")))) (partition 2 1 ws)))]
              {:from (first nums) :to (second nums) :tex (after "tex") :tone (after "tone")}))

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args buffer]}]
              (let [st (or state {})
                    go (fn [p]
                         (let [t (api/render-tree p (opts-of args buffer))
                               st (assoc st :pattern p :last t)]
                           (if (= t (:last state)) {:state st} {:state st :out [[0 t]] :show (str (dec (count t)) " notes")})))]
                (cond
                  (= inlet 1) {:state st}
                  (api/pattern? value) (go value)
                  (= (word value) :bang) (if-let [p (:pattern st)] (go p) {})
                  :else {})))

   :help {:inlets ["a pattern (from a pbind or a pattern box) · bang: renders again" "a canvas: its strokes are time maps (x: result, y: pattern)"]
          :outlets ["a musical tree, for a freqt (shown live; keep! writes it with its recipe)"]
          :messages [["render 0 8" "the beats 0 to 8 of the pattern, as they are"]
                     ["a canvas on the right" "each stroke is a time map: steeper is faster, down is backwards, flat holds, a vertical step cuts, several strokes are layers"]
                     ["render 0 16 tex art tone inst" "the values of :art drawn as textures, those of :inst as colours"]
                     [":amp · :pan" "the weight of a note · a vertical gradient across it"]]
          :example "(box :b1 \"pbind 3 loop\" 40 30)\n(code :b1 \"{:degree [0 2 4 7 4 2 :rest 9]\\n :dur    0.5\\n :amp    #pat/white [0.1 1]\\n :pan    [-1 1]}\")\n(box :b2 \"render 0 8\" 40 130)\n(box :b3 \"freqt\" 40 180)\n(connect :b1 0 :b2 0)\n(connect :b2 0 :b3 0)"
          :try "The pattern appears in the freqt, each note as thick as its :amp and shaded by its :pan. Change the pbind: the drawing follows. (keep! :b3) writes it into the freqt with its recipe."
          :steps [{:title "A time map"
                   :note "A canvas on the right inlet: each stroke says which beat of the pattern (y) is at each beat of the drawing (x). Down plays backwards, each note from its end; flat holds; two strokes make a canon."
                   :example "(box :b4 \"canvas\" 300 130)\n(axis :b4 :x 0 16)\n(axis :b4 :y 0 8)\n(stroke :b4 [[0 0] [8 8] [12 4] [16 4]])\n(stroke :b4 [[2 0] [16 7]])\n(connect :b4 1 :b2 1)\n(box :b5 \"msg bang\" 120 90)\n(connect :b5 0 :b2 0)"
                   :try "Click bang: forwards, backwards, held, and a slower second layer under it. Redraw the canvas and click bang again."}]
          :see ["player" "pbind" "freqt" "canvas" "reader"]}})
