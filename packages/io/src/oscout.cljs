;; oscout · Kairotic events and messages as OSC, through a relay's bridge (SuperCollider, Max, Pd, TouchOSC…)
;; Part of @kairotic/io. Written against the Kairotic API (api/…). Discussion #135, Study 34 · io.
(let [;; ── the bridge: one socket per address, shared by every osc box of the page ──
      ;; A page cannot send UDP: the relay started with --osc does it (npx @kairotic/relay --osc).
      default-url "ws://localhost:8765/osc"
      relay-url (fn [] (or (try (.getItem js/localStorage "kairotic-osc-relay") (catch :default _ nil)) default-url))
      socket (fn [url]
               (let [all (or (.-kairoticOsc js/window) (set! (.-kairoticOsc js/window) #js {}))
                     s (aget all url)]
                 (if (and s (< (.. s -ws -readyState) 2))
                   s
                   (let [ws (js/WebSocket. url)
                         s #js {:ws ws :listeners #js [] :queue #js []}]
                     (set! (.-onopen ws) (fn [_] (doseq [m (js/Array.from (.-queue s))] (.send ws m)) (set! (.-queue s) #js [])))
                     (set! (.-onmessage ws) (fn [e] (let [f (try (js/JSON.parse (.-data e)) (catch :default _ nil))]
                                                      (when f (doseq [l (js/Array.from (.-listeners s))] (l f))))))
                     (aset all url s)
                     s))))
      send! (fn [url m] (let [s (socket url) ws (.-ws s) j (js/JSON.stringify (clj->js m))]
                          (if (= 1 (.-readyState ws)) (.send ws j) (.push (.-queue s) j))))
      num (fn [x] (if (number? x) x 0))
      ;; ── an event as OSC: /kairotic/<type> with its values in a fixed order, for a SynthDef or a Max patch ──
      event->osc (fn [e]
                   (case (:type e)
                     :note {:address "/kairotic/note" :types "iffi" :args [(num (:id e)) (num (:freq e)) (num (or (:amp e) (when (:gate e) 0.8))) (if (:gate e) 1 0)]}
                     :glide {:address "/kairotic/glide" :types "if" :args [(num (:id e)) (num (:freq e))]}
                     :cc {:address "/kairotic/cc" :types "iif" :args [(num (:ch e)) (num (:cc e)) (num (:value e))]}
                     :pressure {:address "/kairotic/pressure" :types "if" :args [(num (:id e)) (num (:value e))]}
                     :tilt {:address "/kairotic/tilt" :types "ff" :args [(:x e) (:y e)]}
                     :shake {:address "/kairotic/shake" :types "f" :args [(:value e)]}
                     (:button :axis) {:address (str "/kairotic/pad/" (if (:name e) (name (:name e)) (str (if (= :axis (:type e)) "a" "b") (or (:axis e) (:button e)))))
                                      :args (if (some? (:gate e)) [(:value e) (if (:gate e) 1 0)] [(:value e)])}
                     :serial (cond (:values e) {:address "/kairotic/serial" :args (vec (:values e))}
                                   (number? (:value e)) {:address (str "/kairotic/serial/" (:key e)) :args [(:value e)]}
                                   :else {:address "/kairotic/serial" :types "s" :args [(str (:text e))]})
                     (:clock :start :stop :continue) {:address (str "/kairotic/" (name (:type e))) :args []}
                     nil))
      ;; a list that starts with an address: (/synth/freq 440) → /synth/freq 440
      address? (fn [x] (let [s (cond (string? x) x (keyword? x) (str (when (namespace x) (str (namespace x) "/")) (name x)) (symbol? x) (str x))]
                         (when (and s (= "/" (subs s 0 1))) s)))
      clean (fn [x] (cond (keyword? x) (name x) (or (number? x) (string? x) (boolean? x)) x :else (str x)))]
  {;; ── about ──
   :class "oscout"
   :license "MPL-2.0"
   :doc "OSC out, through a relay's OSC bridge (npx @kairotic/relay --osc, on this machine): an event (from midiin, motion, gamepad, a room…) goes as /kairotic/note id freq amp gate, /kairotic/glide id freq, /kairotic/cc ch cc value, /kairotic/tilt x y, /kairotic/pad/<name> value [gate]…; a list that starts with an address goes as it is (/synth/freq 440, a message box). target is the name the relay was given for a destination (--osc-out sc=127.0.0.1:57120: sc), its first one if none. [:relay \"ws://…\"] changes the bridge for the whole page (ws://localhost:8765/osc). It sends with or without ▶."
   :usage "oscout [target]"
   :io [1 0]
   :size [96 30]
   :args [[:target nil]]
   :help {:inlets ["an event map, a list (address args…), or [:relay \"ws://…/osc\"]"]
          :outlets []
          :example "(box :b1 \"msg /kairotic/hello 1 2.5\" 40 30)\n(box :b2 \"oscout\" 40 80)\n(connect :b1 0 :b2 0)"
          :try "Run npx @kairotic/relay --osc on this machine and click the message: SuperCollider (sclang, port 57120) receives /kairotic/hello 1 2.5."
          :see ["oscin" "midiout"]}

   ;; ── logic ──
   :receive (fn [{:keys [value args]}]
              (cond
                (and (vector? value) (= :relay (first value)) (string? (second value)))
                {:effects [[:relay (second value)]] :show {:label "relay set"}}
                (and (map? value) (not= :osc (:src value)))
                (if-let [m (event->osc value)]
                  {:effects [[:osc (cond-> m (:target args) (assoc :to (name (:target args))))]] :show {:label (:address m)}}
                  {})
                (and (sequential? value) (address? (first value)))
                (let [m {:address (address? (first value)) :args (mapv clean (rest value))}]
                  {:effects [[:osc (cond-> m (:target args) (assoc :to (name (:target args))))]] :show {:label (:address m)}})
                :else {}))
   ;; with or without ▶: OSC is a message, not a sound
   :tasks {:osc (fn [m _] (send! (relay-url) m) (js/Promise.resolve true))
           :relay (fn [url _] (try (.setItem js/localStorage "kairotic-osc-relay" url) (catch :default _ nil)) (js/Promise.resolve url))}

   ;; ── view ──
   :derive (fn [{:keys [shown args]}] {:label (or (:label shown) (str "oscout" (when (:target args) (str " " (name (:target args))))))})
   :view [[:rect {:x 1 :y 1 :w 94 :h 28 :r 3 :stroke :accent :fill :bg}]
          [:text {:x 8 :y 19 :size 11} :$label]]})
