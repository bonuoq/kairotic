;; oscin · OSC in, through a relay's bridge: from SuperCollider, Max, Pd, TouchOSC… as Kairotic events
;; Part of @kairotic/io. Written against the Kairotic API (api/…). Discussion #135, Study 34 · io.
(let [default-url "ws://localhost:8765/osc"
      relay-url (fn [] (or (try (.getItem js/localStorage "kairotic-osc-relay") (catch :default _ nil)) default-url))
      ;; the same shared sockets as oscout (one per address, for every osc box of the page)
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
      r4 (fn [x] (if (number? x) (/ (js/Math.round (* x 10000)) 10000) x))
      ;; ── the /kairotic/… addresses are events again; any other address arrives as it is ──
      osc->event (fn [{:keys [address args from]}]
                   (let [a (vec args)]
                     (merge (cond-> {:src :osc} from (assoc :from from))
                            (case address
                              "/kairotic/note" (cond-> {:type :note :id (nth a 0 0) :gate (not= 0 (nth a 3 1))}
                                                 (number? (get a 1)) (assoc :freq (r4 (get a 1)))
                                                 (and (number? (get a 2)) (not= 0 (nth a 3 1))) (assoc :amp (r4 (get a 2))))
                              "/kairotic/glide" {:type :glide :id (nth a 0 0) :freq (r4 (nth a 1 0))}
                              "/kairotic/cc" {:type :cc :ch (nth a 0 1) :cc (nth a 1 0) :value (r4 (nth a 2 0))}
                              "/kairotic/pressure" {:type :pressure :id (nth a 0 0) :value (r4 (nth a 1 0))}
                              "/kairotic/tilt" {:type :tilt :x (r4 (nth a 0 0.5)) :y (r4 (nth a 1 0.5))}
                              "/kairotic/shake" {:type :shake :value (r4 (nth a 0 0))}
                              ("/kairotic/clock" "/kairotic/start" "/kairotic/stop" "/kairotic/continue") {:type (keyword (subs address 10))}
                              {:type :osc :address address :args (mapv r4 a)}))))
      ;; ── OSC address patterns (OSC 1.0): ? * [a-z] [!a] {foo,bar}, none of them across a / ──
      re-esc (fn [s] (.replace s (js/RegExp. "[.*+?^${}()|[\\]\\\\]" "g") "\\$&"))
      pattern-re (fn [p]
                   (loop [cs (seq p) out "^"]
                     (if-not cs
                       (js/RegExp. (str out "$"))
                       (let [c (first cs)]
                         (case c
                           "?" (recur (next cs) (str out "[^/]"))
                           "*" (recur (next cs) (str out "[^/]*"))
                           "[" (let [body (take-while #(not= "]" %) (next cs)) neg (= "!" (first body))
                                     body (apply str (if neg (rest body) body))]
                                 (recur (next (drop-while #(not= "]" %) (next cs)))
                                        (str out "[" (when neg "^") (.replace body (js/RegExp. "[\\\\^]" "g") "\\$&") "]")))
                           "{" (let [body (apply str (take-while #(not= "}" %) (next cs)))]
                                 (recur (next (drop-while #(not= "}" %) (next cs)))
                                        (str out "(?:" (apply str (interpose "|" (map re-esc (.split body ",")))) ")")))
                           (recur (next cs) (str out (re-esc c))))))))
      matches? (fn [p address] (or (empty? p) (boolean (.test (pattern-re p) address))))]
  {;; ── about ──
   :class "oscin"
   :license "MPL-2.0"
   :doc "OSC in, through a relay's OSC bridge (npx @kairotic/relay --osc, on this machine), while ▶ runs: what SuperCollider, Max, Pd or TouchOSC send to the relay's port (57121) arrives here. The addresses oscout writes are events again (/kairotic/note id freq amp gate is {:type :note …}, /kairotic/glide, /kairotic/cc, /kairotic/tilt…); any other one is {:type :osc :address \"/x\" :args […] :from \"host:port\"}. pattern takes only the addresses that match it (OSC patterns: ? * [a-z] [!a] {note,glide}): oscin /synth/*/cutoff. Out: the event, and its values alone (the args of an OSC message; the Hz of a note) for a number box. [:relay \"ws://…\"] changes the bridge for the whole page."
   :usage "oscin [pattern]"
   :io [1 2]
   :size [110 30]
   :help {:inlets ["[:relay \"ws://…/osc\"]"]
          :outlets ["every message that matches, as an event" "its values: the args of an OSC message, or the Hz of a note"]
          :example "(box :b1 \"oscin /kairotic/*\" 40 30)\n(box :b2 \"print\" 40 80)\n(connect :b1 0 :b2 0)"
          :try "Run npx @kairotic/relay --osc, press ▶, and from SuperCollider: NetAddr(\"127.0.0.1\", 57121).sendMsg(\"/kairotic/note\", 1, 440, 0.5, 1)."
          :see ["oscout" "midiin"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value]}]
              (cond
                (and (= inlet :audio) (:event value))
                (let [e (:event value)]
                  {:out [[1 (if (= :osc (:type e)) (:args e) (or (:freq e) (:value e) (:x e)))] [0 e]]
                   :show {:label (or (:address e) (str "/kairotic/" (name (:type e))))}})
                (and (= inlet :audio) (:status value)) {:show {:label (:status value)}}
                (and (vector? value) (= :relay (first value)) (string? (second value)))
                {:effects [[:relay (second value)]] :show {:label "relay set: ▶ again"}}
                :else {}))
   :tasks {:relay (fn [url _] (try (.setItem js/localStorage "kairotic-osc-relay" url) (catch :default _ nil)) (js/Promise.resolve url))}

   ;; ── view ──
   :derive (fn [{:keys [shown]}] {:label (or (:label shown) "oscin")})
   :view [[:rect {:x 1 :y 1 :w 108 :h 28 :r 3 :stroke :accent :fill :bg}]
          [:text {:x 8 :y 19 :size 11} :$label]]

   ;; ── outside: the bridge, while ▶ runs ──
   :audio {:create (fn [_ b _]
                     (let [pattern (or (second (.split (.trim (str (:text b))) #"\s+")) "")
                           node {:alive (atom true) :inlets [] :outlets []}
                           s (socket (relay-url))
                           l (fn [f] (when (and @(:alive node) (.-address f) (matches? pattern (.-address f)))
                                       (api/report! (:id b) {:event (osc->event (js->clj f :keywordize-keys true))} nil)))]
                       (.push (.-listeners s) l)
                       (set! (.. s -ws -onerror)
                             (fn [_] (api/report! (:id b) {:status "no relay: npx @kairotic/relay --osc"} nil)))
                       (assoc node :off (fn [] (set! (.-listeners s) (.filter (.-listeners s) (fn [x & _] (not= x l))))))))
           :dispose (fn [node] (reset! (:alive node) false) ((:off node)))}})
