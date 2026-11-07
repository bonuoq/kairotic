;; share · a value to everyone in the room, on a channel
;; Part of @kairotic/net. Written against the Kairotic API (api/…). Discussion #135.
(let [room (fn [] (.-kairoticRoom js/window))]
  {;; ── about ──
   :class "share"
   :license "MPL-2.0"
   :doc "Shares what arrives with everyone in the room, on a channel (main if none): every shared box of the room listening to that channel sends it out — on every page, this one too. Any value: a number, a list, an event from midiin or motion, a map. It goes on the room's reliable channel, in order, with or without ▶. Outside a shared room it reaches the shared boxes of this page only. It is a message of the moment, not a gesture: the history does not keep it."
   :usage "share [channel]"
   :io [1 0]
   :size [96 30]
   :args [[:channel nil]]
   :help {:inlets ["any value: it goes to everyone in the room"]
          :outlets []
          :example "(box :b1 \"msg 60 64 67\" 40 30)\n(box :b2 \"share chords\" 40 80)\n(box :b3 \"shared chords\" 200 30)\n(box :b4 \"print\" 200 80)\n(connect :b1 0 :b2 0)\n(connect :b3 0 :b4 0)"
          :try "Press ▶ and click the message: print shows it, and so does every page of the room with a shared chords box."
          :see ["shared" "pulse" "oscout"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value args]}]
              (if (= inlet :task)
                {}
                {:effects [[:share [(if (:channel args) (name (:channel args)) "main") value]]]
                 :show {:label (let [s (pr-str value)] (if (> (count s) 14) (str (subs s 0 13) "…") s))}}))
   :tasks {:share (fn [[ch v] _]
                    (if-let [r (room)]
                      (do ((.-share r) ch v) (js/Promise.resolve true))
                      (js/Promise.reject (js/Error. "share: this page has no room layer"))))}

   ;; ── view ──
   :derive (fn [{:keys [shown args]}] {:label (or (:label shown) (str "share " (if (:channel args) (name (:channel args)) "main")))})
   :view [[:rect {:x 1 :y 1 :w 94 :h 28 :r 3 :stroke :kairos :fill :bg}]
          [:text {:x 8 :y 19 :size 11} :$label]]})
