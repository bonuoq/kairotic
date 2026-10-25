;; fetch · what is at a URL (JSON, text or EDN), brought in as a task
;; Part of @kairotic/data. Written against the Kairotic API (api/…).
;; Its logic never touches the network: a URL asks for the task :get, the engine runs it (api/http-get)
;; and what it finds comes back to this box on inlet :task. By default the box keeps it as its data
;; ([:keep …]): one gesture of the history, the same for everyone in a room, and going back in the
;; history does not fetch it again. With `live` it is only held in this tab, for answers that change.
(let [formats #{:json :text :edn}
      fmt-of (fn [args] (if (formats (:as args)) (:as args) :json))
      ;; what the box holds: kept in the work, or (live) only here
      sane (fn [d] (if (and (map? d) (string? (:url d))) (select-keys d [:url :value :date]) {}))
      ;; kept in the work (its data) or, live or before it could be kept (inside a sub-patch, too long, played
      ;; by someone else in a jam), only here (its state)
      held-of (fn [args data state] (if (and (not (:live args)) (contains? data :value)) data (:got state)))
      kept? (fn [args data] (and (not (:live args)) (contains? data :value)))
      summary (fn [v] (cond (map? v) (str "{} " (count v) (if (= 1 (count v)) " key" " keys"))
                            (sequential? v) (str "[] " (count v) (if (= 1 (count v)) " item" " items"))
                            (string? v) (str "\"\" " (count v) " characters")
                            (nil? v) "nil"
                            :else (pr-str v)))
      url-in (fn [value]
               (cond (api/url-of value) (api/url-of value)
                     (and (sequential? value) (#{:fetch :url "fetch" "url"} (first value))) (api/url-of (second value))
                     :else nil))
      path-in (fn [value] (let [p (rest value)] (if (and (= 1 (count p)) (sequential? (first p))) (vec (first p)) (vec p))))]
  {;; ── about ──
   :class "fetch"
   :license "MPL-2.0"
   :doc "Brings in what is at a URL: JSON (read as EDN: keys that can be keywords become keywords), text or EDN. A URL (https://…, or github:owner/repo@ref/path through jsDelivr) asks for it; what arrives goes out on the left and is kept as the data of the box, in the history, so everyone in a room has the same and going back does not fetch again (a URL it already holds is sent again, not fetched: refresh fetches it again). With live it is only held in this tab, for answers that change. On the right: :loading, :ready or [:error \"…\"]."
   :usage "fetch [json|text|edn] [live]"
   :io [1 2]
   :size [230 42]

   ;; ── arguments ──
   :args [[:as nil] [:live false]]

   ;; ── data: what it keeps, in the history ──
   :model {:empty {}
           :step (fn [d [op x]] (case op :set (sane x) :clear {} d))
           :load sane
           :code (fn [id d] (when (contains? d :value) [(str "(keep! " id " " (pr-str d) ")")]))}

   ;; ── tasks: outside its pure logic ──
   :tasks {:get (fn [{:keys [url as]} _]
                  (.then (api/http-get url {:as as})
                         (fn [v] {:body v :date (.toISOString (js/Date.))})))}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state data args]}]
              (let [st (or state {})
                    held (held-of args data st)
                    ask (fn [u] (let [req {:url u :as (fmt-of args) :n (inc (:n st 0))}]
                                  {:state (assoc st :waiting req :n (:n req))
                                   :show {:status :loading :url u}
                                   :out [[1 :loading]]
                                   :effects [[:get req]]}))]
                (cond
                  ;; what the task found
                  (= inlet :task)
                  (cond
                    (not= (:arg value) (:waiting st)) {}          ; the answer to an older request: dropped
                    (:error value)
                    {:state (dissoc st :waiting)
                     :show {:status :error :url (:url (:arg value)) :error (:error value)}
                     :out [[1 [:error (:error value)]]]}
                    :else
                    (let [got {:url (:url (:arg value)) :value (:body (:value value)) :date (:date (:value value))}
                          same? (and (kept? args data) (= (:url data) (:url got)) (= (:value data) (:value got)))]
                      {:state (-> st (dissoc :waiting) (assoc :got got))
                       :show {:status :ready :url (:url got) :summary (summary (:value got))}
                       :out [[1 :ready] [0 (:value got)]]
                       :effects (if (or (:live args) same?) [] [[:keep got]])}))

                  ;; a URL: fetched, unless it is the one it already keeps (sent again, then)
                  (url-in value)
                  (let [u (url-in value)]
                    (cond (= u (:url (:waiting st))) {}
                          (and (kept? args data) (= u (:url held))) {:out [[1 :ready] [0 (:value held)]]}
                          :else (ask u)))
                  (#{:refresh "refresh"} value)
                  (if-let [u (or (:url held) (:url (:waiting st)))] (ask u) {})

                  (#{:bang "bang"} value) (if held {:out [[1 :ready] [0 (:value held)]]} {})
                  (and (sequential? value) (#{:get "get"} (first value)))
                  (if held
                    (let [p (path-in value) x (get-in (:value held) p ::none)]
                      (if (= x ::none)
                        {:out [[1 [:error (str "nothing at " (pr-str p))]]]}
                        {:out [[0 x]]}))
                    {})
                  (#{:clear "clear"} value)
                  {:state {:n (:n st 0)} :show {:status :idle}
                   :effects (if (kept? args data) [[:keep nil]] [])}
                  :else {})))

   :derive (fn [{:keys [shown data state args]}]
             (let [held (held-of args data state)
                   status (or (:status shown) (if held :held :idle))
                   short (fn [s n] (if (> (count s) n) (str (subs s 0 (dec n)) "…") s))]
               {:color (case status (:ready :held) :accent :loading :soft :error :kairos :grid)
                :label (short (case status
                                :loading "loading…"
                                :error (str "✕ " (:error shown))
                                (:ready :held) (str (cond (kept? args data) "kept · " (:live args) "live · " :else "here · ")
                                                    (summary (:value held)))
                                (str "send a URL" (when (:live args) " · live")))
                              38)
                :url (short (str (or (:url shown) (:url held) "")) 46)}))

   ;; ── view ──
   :view [[:rect {:x 1 :y 1 :w 228 :h 40 :r 4 :stroke :grid :fill :bg}]
          [:circle {:cx 12 :cy 14 :r 4 :fill :$color}]
          [:text {:x 22 :y 17 :size 10 :fill :ink} :$label]
          [:text {:x 8 :y 33 :size 8 :fill :soft} :$url]]

   ;; ── help ──
   :help {:inlets ["a URL (msg https://… · a string · [:fetch url]); refresh; bang; [:get key …]; clear"]
          :outlets ["what it found (or the part a [:get …] asks for)" ":loading, :ready or [:error \"…\"]"]
          :messages [["a URL" "brings it in (if it already keeps that URL, sends it again)"]
                     ["refresh" "fetches its URL again"]
                     ["bang" "sends what it holds"]
                     ["get items 0 name · [:get [:items 0 :name]]" "sends one part of it"]
                     ["clear" "forgets it"]]
          :try "Click the message with the URL: the answer comes out on the left, into an edn box. Go back in the history: it is still there, without fetching."}})
