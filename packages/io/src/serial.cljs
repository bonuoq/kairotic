;; serial · a board on a serial port (an Arduino, an ESP32…): its lines of text as values and events
;; Part of @kairotic/io. Written against the Kairotic API (api/…). Discussion #135, Study 34 · io.
(let [number-of (fn [s] (when (re-matches #"[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?" s) (js/parseFloat s)))
      ;; a line: "512 300 1" (or with commas) → values; "pot:512 light=300" → one event per key; else text
      line-events (fn [line]
                    (let [line (.trim line) ev (fn [m] (merge {:src :serial :type :serial} m))
                          words (remove empty? (.split line (js/RegExp. "[\\s,;]+")))]
                      (cond
                        (empty? line) []
                        (every? number-of words) [(ev {:values (mapv number-of words)})]
                        (every? #(re-matches #"[^:=]+[:=][^:=]+" %) words)
                        (vec (for [w words :let [[k v] (.split w (js/RegExp. "[:=]"))]]
                               (ev (if-let [n (number-of v)] {:key k :value n} {:key k :text v}))))
                        :else [(ev {:text line})])))
      ;; text comes in pieces that do not respect lines: what follows the last newline waits for the next
      chunk (fn [buf text]
              (let [lines (.split (str buf text) (js/RegExp. "\\r?\\n"))
                    rest-buf (last lines)]
                [(if (> (count rest-buf) 512) "" rest-buf) (vec (mapcat line-events (butlast lines)))]))]
  {;; ── about ──
   :class "serial"
   :license "MPL-2.0"
   :doc "A board on a serial port — an Arduino's Serial.println, an ESP32… — while ▶ runs. open (a click: the browser asks which port) at baud (115200); close lets it go. Each line it sends: numbers (\"512 300 1\", or with commas) go out as a list on the left; key:value pairs (\"pot:512 light=300\") as [key value] each; anything else as text; and every line as events on the right ({:type :serial :values […]}, {:type :serial :key \"pot\" :value 512}, {:type :serial :text …}). A text or a list on the left (other than open/close) goes to the board as a line. Web Serial: Chrome, Edge and Firefox 151+; not Safari."
   :usage "serial [baud]"
   :io [1 2]
   :size [96 30]
   :args [[:baud 115200]]
   :help {:inlets ["open (asks for the port), close, or a line to send to the board"]
          :outlets ["the numbers of a line (a list), or [key value] for each key:value" "every line, as events"]
          :example "(box :b1 \"msg :open\" 40 30)\n(box :b2 \"serial 9600\" 40 70)\n(box :b3 \"print\" 40 120)\n(connect :b1 0 :b2 0)\n(connect :b2 0 :b3 0)"
          :try "Press ▶, click open and choose the board's port: what it prints arrives as numbers."
          :see ["motion" "gamepad" "oscout"]}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (let [buf (or (:buf state) "")]
                (cond
                  (and (= inlet :audio) (:error value)) {:state state :effects [[:print (:error value)]] :show {:label "no port"}}
                  (and (= inlet :audio) (:status value)) {:state state :show {:label (:status value)}}
                  (and (= inlet :audio) (string? (:text value)))
                  (let [[b2 es] (chunk buf (:text value))]
                    (cond-> {:state (assoc state :buf b2)
                     :out (vec (mapcat (fn [e] [(cond (:values e) [0 (:values e)]
                                                      (contains? e :value) [0 [(:key e) (:value e)]]
                                                      :else [0 (or (:text e) "")])
                                                [1 e]])
                                       es))
                     }
                      (seq es) (assoc :show {:label (let [e (last es)] (cond (:values e) (str (:values e)) (:key e) (str (:key e) " " (or (:value e) (:text e))) :else (:text e)))})))
                  (#{:open "open"} value) {:effects [[:open (api/clamp (:baud args) 300 4000000)]]}
                  (#{:close "close"} value) {:effects [[:close true]]}
                  (string? value) {:effects [[:write value]]}
                  (sequential? value) {:effects [[:write (apply str (interpose " " (map #(if (keyword? %) (name %) (str %)) value)))]]}
                  :else {})))

   ;; ── view ──
   :derive (fn [{:keys [shown]}] {:label (or (:label shown) "serial")})
   :view [[:rect {:x 1 :y 1 :w 94 :h 28 :r 3 :stroke :accent :fill :bg}]
          [:text {:x 8 :y 19 :size 11} :$label]]

   ;; ── outside: the port, while ▶ runs ──
   :audio {:create (fn [_ b _] {:id (:id b) :port (atom nil) :writer (atom nil) :reader (atom nil) :alive (atom true) :inlets [] :outlets []})
           :effects {:open (fn [node baud _]
                             (let [report (fn [v] (when @(:alive node) (api/report! (:id node) v nil)))]
                               (if-not (.-serial js/navigator)
                                 (report {:error "serial: this browser has no Web Serial (Chrome, Edge or Firefox 151+)"})
                                 (-> (.requestPort (.-serial js/navigator))
                                     (.then (fn [port] (.then (.open port #js {:baudRate baud}) (fn [_] port))))
                                     (.then (fn [port]
                                              (reset! (:port node) port)
                                              (reset! (:writer node) (.getWriter (.-writable port)))
                                              (report {:status (str "open · " baud)})
                                              (let [dec (js/TextDecoderStream.)
                                                    _ (.catch (.pipeTo (.-readable port) (.-writable dec)) (fn [_] nil))
                                                    reader (.getReader (.-readable dec))]
                                                (reset! (:reader node) reader)
                                                ((fn step []
                                                   (-> (.read reader)
                                                       (.then (fn [r] (if (.-done r)
                                                                        (report {:status "closed"})
                                                                        (do (report {:text (.-value r)}) (step)))))
                                                       (.catch (fn [_] (report {:status "closed"})))))))))
                                     (.catch (fn [e] (report {:error (str "serial: " (.-message e))})))))))
                     :write (fn [node line _]
                              (when-let [w @(:writer node)] (.write w (.encode (js/TextEncoder.) (str line "\n")))))
                     :close (fn [node _ _]
                              (when-let [r @(:reader node)] (.catch (.cancel r) (fn [_] nil)))
                              (when-let [w @(:writer node)] (.releaseLock w))
                              (when-let [p @(:port node)] (js/setTimeout (fn [] (.catch (.close p) (fn [_] nil))) 50))
                              (reset! (:port node) nil) (reset! (:writer node) nil))}
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (when-let [r @(:reader node)] (.catch (.cancel r) (fn [_] nil)))
                      (when-let [w @(:writer node)] (try (.releaseLock w) (catch :default _ nil)))
                      (when-let [p @(:port node)] (js/setTimeout (fn [] (.catch (.close p) (fn [_] nil))) 50)))}})
