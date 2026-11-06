(in-ns 'user)
;; ───────────────────────── talking in a room (discussion #135, Studies 34 and 36) ─────────────────────────
;; In a shared room, the pages of the people in it find each other through the relay's rooms (/signal,
;; beside GUN's /gun: relay 0.3) and open a WebRTC connection to each other: a reliable data channel for
;; what is said, and an audio and a video track that stay empty until someone turns the microphone or the
;; camera on (so turning them on never renegotiates). The same socket gives the relay's time: the clock
;; every page of the room agrees on (talk-now).
;;
;; What is said is ephemeral: it lives in these pages. Keeping it makes it a gesture of the work — a
;; message a text annotation (layer :talk, on the box it names: @b3), a voice note a sample box (its sound
;; kept by hash, and handed to every page of the room), a frame of someone's camera an image annotation.
;; What is yours is kept at once; what is someone else's asks them first, and cannot be kept once they
;; have left. The model is kairotic.talk (tk/…).

(defonce talk-room (atom {:ws nil :key nil :id nil :peers {} :n 0 :clock (tk/new-clock) :timer nil}))
(defonce talk-state (atom {:items {} :order [] :asks [] :mine-asks {} :pieces {} :talking false}))
(defonce talk-media (atom {:mic nil :cam nil :rec nil}))

(defn talk-name [] (let [n (str/trim (str (some-> ($ "talk-name") .-value)))] (if (seq n) n "someone")))
(defn talk-me [] {:id (:id @talk-room) :who (my-author) :name (talk-name)})
(defn talk-ms [] (+ (.-timeOrigin js/performance) (js/performance.now)))

(defn talk-now
  "The room's shared time in ms (the relay's clock as this page reads it), or this page's time outside a room."
  [] (or (tk/shared-time (:clock @talk-room) (talk-ms)) (talk-ms)))

(defn talk-signal-url
  "Where the rooms are: ?signal=… if given, else the /signal of the page's relay (nil without a relay)."
  []
  (or (not-empty (.get (js/URLSearchParams. (.. js/window -location -search)) "signal"))
      (tk/signal-url (first (current-relays)))))

;; ───────── bytes ─────────

(defn talk-b64 [buf]
  (let [b (js/Uint8Array. buf) parts #js []]
    (loop [i 0] (when (< i (.-length b))
                  (.push parts (.apply (.-fromCharCode js/String) nil (.subarray b i (min (.-length b) (+ i 8192)))))
                  (recur (+ i 8192))))
    (js/btoa (.join parts ""))))

(defn talk-bytes [s] (let [bin (js/atob s) out (js/Uint8Array. (.-length bin))]
                       (dotimes [i (.-length bin)] (aset out i (.charCodeAt bin i))) out))

(defn talk-sha [bytes]
  (.then (.digest js/crypto.subtle "SHA-256" bytes)
         (fn [d] (apply str (map (fn [x] (.padStart (.toString x 16) 2 "0")) (js/Array.from (.subarray (js/Uint8Array. d) 0 16)))))))

;; ───────── sending ─────────

(defn talk-signal! [m]
  (when-let [ws (:ws @talk-room)] (when (= 1 (.-readyState ws)) (.send ws (js/JSON.stringify (clj->js m))))))

(defn talk-to! [id m]
  (let [dc (get-in @talk-room [:peers id :dc])]
    (if (and dc (= "open" (.-readyState dc)))
      (.send dc (js/JSON.stringify (clj->js m)))
      (talk-signal! {:to id :data {:talk m}}))))

(defn talk-to-all! [m] (doseq [id (keys (:peers @talk-room))] (talk-to! id m)))

(defn talk-item [o] (let [m (js->clj o :keywordize-keys true)] (cond-> m (:kind m) (update :kind keyword))))

;; ───────── drawing ─────────

(defn talk-msg! [text kind] (when-let [el ($ "talk-state")] (set! (.-innerHTML el) text) (set! (.-className el) (str "talk-state " kind))))

(defn render-talk-peers! []
  (when-let [el ($ "talk-peers")]
    (let [ps (:peers @talk-room)]
      (set! (.-innerHTML el)
            (if (:id @talk-room)
              (str "<span class=\"tpeer" (when (:talking @talk-state) " talk") "\">" (esc (talk-name)) " <i>you</i></span>"
                   (apply str (for [[id p] (sort-by (comp :n val) ps)]
                                (str "<span class=\"tpeer" (when (= "p2p" (:state p)) " p2p") (when (:talk p) " talk") "\" data-peer=\"" (esc id) "\">"
                                     (esc (or (not-empty (:name p)) "someone")) " <i>" (:state p) (when (:talk p) " · talking") (when (:camera p) " · camera") "</i></span>"))))
              "")))
    (doseq [[id p] (:peers @talk-room)]
      (when-let [t (.querySelector js/document (str ".ttile[data-peer='" id "']"))]
        (if (:talk p) (.add (.-classList t) "talk") (.remove (.-classList t) "talk"))))))

(defn talk-anchor-chips [as]
  (apply str (for [a as] (str "<span class=\"tchip\">" (esc (cond (:box a) (str "@" (:box a)) (:point a) (str "#" (:point a)) :else (str "^" (:beat a)))) "</span>"))))

(defn talk-item-state [it]
  (let [a (get-in @talk-state [:mine-asks (:id it)])]
    (cond (:kept it) "<span class=\"tst ok\">kept</span>"
          (= a :asked) (str "<span class=\"tst\">asked " (esc (:name it)) "…</span>")
          (= a :declined) (str "<span class=\"tst bad\">" (esc (:name it)) " declined</span>")
          (= a :gone) (str "<span class=\"tst bad\">" (esc (:name it)) " has left: it can't be kept</span>")
          :else "")))

(defn render-talk-chat! []
  (when-let [el ($ "talk-chat")]
    (let [{:keys [items order]} @talk-state
          at-end (< (- (.-scrollHeight el) (.-scrollTop el) (.-clientHeight el)) 30)]
      (set! (.-innerHTML el)
            (if (seq order)
              (apply str
                     (for [id order :let [it (get items id)] :when it]
                       (str "<div class=\"titem" (when (= (my-author) (:author it)) " mine") "\" data-item=\"" (esc id) "\">"
                            "<div class=\"twho\">" (esc (:name it)) "<time>" (.slice (.toISOString (js/Date. (:t it))) 11 19) "</time></div>"
                            "<div class=\"tside\">"
                            (when-not (:kept it) (str "<button class=\"act small\" data-talk-keep=\"" (esc id) "\" title=\"Keep it in the work\">Keep</button>"))
                            (talk-item-state it) "</div>"
                            "<div class=\"twhat\">"
                            (case (:kind it)
                              :message (str (esc (:text it)) (when (seq (:anchors it)) (str "<div>" (talk-anchor-chips (:anchors it)) "</div>")))
                              :note (if (:url it)
                                      (str "voice note · " (.toFixed (or (:dur it) 0) 1) " s <audio controls preload=\"none\" src=\"" (:url it) "\"></audio>")
                                      "voice note · arriving…")
                              :frame (str "<img alt=\"a frame of " (esc (:name it)) "\" src=\"" (:image it) "\">")
                              "")
                            "</div></div>")))
              (if (:id @talk-room)
                "<p class=\"ask-note\">What you say here is for the people in the room now; <b>Keep</b> makes it part of the work.</p>"
                "")))
      (when at-end (set! (.-scrollTop el) (.-scrollHeight el))))))

(defn render-talk-asks! []
  (when-let [el ($ "talk-asks")]
    (let [as (:asks @talk-state)]
      (set! (.-hidden el) (empty? as))
      (set! (.-innerHTML el)
            (apply str (for [{:keys [item-id by-name kind]} as :let [it (get-in @talk-state [:items item-id])]]
                         (str "<div class=\"task\"><div><b>" (esc by-name) "</b> wants to keep your "
                              (case kind "note" "voice note" "frame" "video frame" "message")
                              (when (= :message (:kind it)) (str " “" (esc (subs (:text it) 0 (min 80 (count (:text it))))) "”"))
                              " in the work.</div><div class=\"ask-bar\"><button class=\"act primary small\" data-talk-answer=\"yes\" data-id=\"" (esc item-id) "\">Allow</button>"
                              "<button class=\"act small\" data-talk-answer=\"no\" data-id=\"" (esc item-id) "\">Decline</button></div></div>")))))))

(defn render-talk! []
  (let [in-room (and (= :room (:kind @work)) (talk-signal-url))]
    (when-let [el ($ "talk-off")]
      (set! (.-hidden el) (boolean in-room))
      (set! (.-innerHTML el)
            (cond (not= :room (:kind @work)) "Talking happens in a <b>shared room</b>: open or create one in <b>Sessions</b>, and everyone in it can write, talk, send voice notes and see each other."
                  :else "This page has no relay (<code>?peer=off</code>, or claude.ai): rooms to talk need a relay 0.3 (<code>npx @kairotic/relay</code>).")))
    (when-let [el ($ "talk-on")] (set! (.-hidden el) (not in-room))))
  (render-talk-peers!) (render-talk-chat!) (render-talk-asks!))

;; ───────── items: said here, and arriving ─────────

(defn talk-add! [it]
  (when-not (get-in @talk-state [:items (:id it)])
    (swap! talk-state (fn [t] (-> t (assoc-in [:items (:id it)] it) (update :order conj (:id it))))))
  (render-talk-chat!))

(defn talk-say!
  "Says something to the people in the room: (talk-say! \"from #12, @b3 enters\")."
  [text]
  (when-let [m (tk/message (talk-me) text (talk-now))]
    (talk-add! m)
    (talk-to-all! {:item m})
    (:id m)))

;; ───────── keeping: a gesture of the work ─────────

(defn talk-free-y
  "Where on the paper the next kept thing goes: under the last one of layer :talk."
  []
  (let [ms (filter (fn [[_ m]] (and (= :talk (:layer m)) (= :patch (first (:at m))))) (:marks (current)))]
    (+ 30 (reduce max 0 (map (fn [[_ m]] (+ (nth (:at m) 2) (if (= :image (:kind m)) (:h m) 0))) ms)))))

(defn talk-mark! [m] (gesture! (str "(mark :talk " (next-mark-id) " " (pr-str m) ")")))

(defn talk-keep-message! [it]
  (let [box (some (fn [a] (when-let [b (:box a)] (let [k (keyword b)] (when (get-in (current) [:boxes k]) k)))) (:anchors it))
        txt (str (:name it) ": " (:text it))]
    (talk-mark! {:kind :text :at (if box [box 0 -12] [:patch 30 (+ 20 (talk-free-y))]) :txt txt})
    (js/Promise.resolve {})))

(defn talk-keep-note! [it]
  (-> (snd/decode (.-buffer (.slice (talk-bytes (:b64 it)))))
      (.then (fn [{:keys [sr chans]}] (snd/keep! sr chans)))
      (.then (fn [d]
               (let [id (next-id) [x y] (auto-pos)]
                 (gesture! (str "(box " id " \"sample\" " x " " y ")"))
                 (gesture! (str "(sample! " id " " (pr-str d) ")"))
                 (talk-mark! {:kind :text :at [id 0 -10] :txt (str "voice note · " (:name it))})
                 {:sound (:audio d)})))))

(defn talk-keep-frame! [it]
  (let [y (+ 20 (talk-free-y))]
    (talk-mark! {:kind :image :at [:patch 30 y] :src (:image it) :w 160 :h 120})
    (talk-mark! {:kind :text :at [:patch 30 (+ y 134)] :txt (str "frame · " (:name it))})
    (js/Promise.resolve {})))

(defn talk-kept! [k]
  (when (get-in @talk-state [:items (:item k)]) (swap! talk-state assoc-in [:items (:item k) :kept] true))
  (render-talk-chat!))

(defn talk-keep-now!
  "Keeps an item (mine, or allowed): a gesture of the work here; every page of the room hears that it was
   kept, and a sound is handed to them under its hash."
  [it]
  (-> (case (:kind it) :message (talk-keep-message! it) :note (talk-keep-note! it) :frame (talk-keep-frame! it) (js/Promise.resolve {}))
      (.then (fn [extra]
               (let [k (merge {:item (:id it) :kind (name (:kind it)) :by (talk-name)} extra)]
                 (talk-kept! k) (talk-to-all! {:kept k}))))
      (.catch (fn [e] (talk-msg! (str "could not keep it: " (esc (or (.-message e) e))) "bad")))))

(defn talk-keep!
  "Keeps something said in the room, by its id: at once if it is yours, else asking whoever said it."
  [id]
  (when-let [it (get-in @talk-state [:items id])]
    (let [[what peer] (tk/keep-step (talk-me) it (keys (:peers @talk-room)))]
      (case what
        :keep (talk-keep-now! it)
        :ask (do (swap! talk-state assoc-in [:mine-asks id] :asked)
                 (talk-to! peer {:ask {:item-id id :by-name (talk-name) :kind (name (:kind it))}}))
        :gone (swap! talk-state assoc-in [:mine-asks id] :gone))
      (render-talk-chat!))))

(defn talk-answer! [id yes?]
  (let [ask (first (filter #(= id (:item-id %)) (:asks @talk-state)))]
    (swap! talk-state update :asks (fn [as] (vec (remove #(= id (:item-id %)) as))))
    (render-talk-asks!)
    (when ask (talk-to! (:from ask) {:answer {:item-id id :ok yes?}}))))

;; a sound kept by someone else: this page keeps its copy under the same hash, so the work sounds here too
(defn talk-on-kept! [o]
  (let [k (js->clj o :keywordize-keys true)]
    (talk-kept! k)
    (when-let [h (:sound k)]
      (when-let [it (get-in @talk-state [:items (:item k)])]
        (when (:b64 it)
          (-> (snd/decode (.-buffer (.slice (talk-bytes (:b64 it)))))
              (.then (fn [{:keys [sr chans]}] (snd/store! h sr chans)))
              (.catch (fn [e] (js/console.error "talk: a kept sound" e)))))))))

;; ───────── what arrives from a peer ─────────

(defn talk-on! [peer o]
  (cond
    (.-item o) (talk-add! (assoc (talk-item (.-item o)) :peer peer))
    (.-piece o) (let [p (js->clj (.-piece o) :keywordize-keys true)
                      [st whole] (tk/gather (:pieces @talk-state) p)]
                  (swap! talk-state assoc :pieces st)
                  (when whole
                    (let [bytes (talk-bytes whole)]
                      (.then (talk-sha bytes)
                             (fn [h] (when-let [[id it] (first (filter (fn [[_ it]] (= h (:hash it))) (:items @talk-state)))]
                                       (swap! talk-state update-in [:items id] assoc :b64 whole
                                              :url (js/URL.createObjectURL (js/Blob. #js [bytes] #js {:type (:mime it)})))
                                       (render-talk-chat!)))))))
    (.-state o) (let [s (.-state o)]
                  (swap! talk-room update-in [:peers peer] merge {:talk (.-talk s) :camera (.-camera s) :name (.-name s) :who (.-who s)})
                  (when-let [t (.querySelector js/document (str ".ttile[data-peer='" peer "']"))]
                    (set! (.-hidden t) (not (.-camera s)))
                    (set! (.-textContent (.querySelector t ".tlabel")) (.-name s)))
                  (render-talk-peers!))
    (.-ask o) (do (swap! talk-state update :asks conj (assoc (js->clj (.-ask o) :keywordize-keys true) :from peer))
                  (render-talk-asks!)
                  ;; asked: the Room tab says so
                  (when-let [t ($ "tab-talk")] (.add (.-classList t) "attn")))
    (.-answer o) (let [{:keys [item-id ok]} (js->clj (.-answer o) :keywordize-keys true)]
                   (swap! talk-state assoc-in [:mine-asks item-id] (if ok :allowed :declined))
                   (if ok (talk-keep-now! (get-in @talk-state [:items item-id])) (render-talk-chat!)))
    (.-kept o) (talk-on-kept! (.-kept o))))

;; ───────── voice notes ─────────

(defn talk-note-start! []
  (when-let [mic (:mic @talk-media)]
    (let [mime (or (first (filter #(.isTypeSupported js/MediaRecorder %) ["audio/webm;codecs=opus" "audio/ogg;codecs=opus" "audio/mp4"])) "")
          stream (js/MediaStream. #js [(.clone (first (.getAudioTracks mic)))])
          rec (js/MediaRecorder. stream (if (seq mime) #js {:mimeType mime} #js {}))
          chunks #js []]
      (set! (.-enabled (first (.getAudioTracks stream))) true)
      (set! (.-ondataavailable rec) (fn [e] (.push chunks (.-data e))))
      (set! (.-onstop rec)
            (fn [_]
              (doseq [t (.getTracks stream)] (.stop t))
              (let [blob (js/Blob. chunks #js {:type (.-mimeType rec)})]
                (-> (.arrayBuffer blob)
                    (.then (fn [buf]
                             (-> (.decodeAudioData (eng/ctx) (.slice buf 0))
                                 (.then (fn [ab]
                                          (.then (talk-sha (js/Uint8Array. buf))
                                                 (fn [h]
                                                   (let [b64 (talk-b64 buf)
                                                         it {:kind :note :id (str (my-author) "-" (js/Math.round (talk-ms))) :author (my-author)
                                                             :peer (:id @talk-room) :name (talk-name) :t (talk-now) :hash h :mime (.-mimeType rec) :dur (.-duration ab)}]
                                                     (talk-add! (assoc it :b64 b64 :url (js/URL.createObjectURL blob)))
                                                     (talk-to-all! {:item it})
                                                     (doseq [p (tk/pieces h b64)] (talk-to-all! {:piece p}))))))))))
                    (.catch (fn [e] (talk-msg! (str "the note: " (esc (.-message e))) "bad")))))))
      (.start rec)
      (swap! talk-media assoc :rec rec)
      (js/setTimeout (fn [] (when (= rec (:rec @talk-media)) (.stop rec) (swap! talk-media assoc :rec nil))) 60000))))

(defn talk-note-stop! []
  (when-let [rec (:rec @talk-media)] (swap! talk-media assoc :rec nil) (when (= "recording" (.-state rec)) (.stop rec))))

;; ───────── microphone, push to talk, camera ─────────

(defn talk-senders! []
  (doseq [[_ p] (:peers @talk-room) :let [pc (:pc p)] :when pc
          tr (.getTransceivers pc) :let [kind (.. tr -receiver -track -kind)]]
    (.catch (.replaceTrack (.-sender tr) (case kind
                                           "audio" (some-> (:mic @talk-media) .getAudioTracks first)
                                           "video" (some-> (:cam @talk-media) .getVideoTracks first)
                                           nil))
            (fn [_] nil))))

(defn talk-send-state! []
  (talk-to-all! {:state {:talk (:talking @talk-state) :camera (some? (:cam @talk-media)) :name (talk-name) :who (my-author)}}))

(defn talk-push! [on?]
  (when-let [mic (:mic @talk-media)]
    (when (not= on? (:talking @talk-state))
      (doseq [t (.getAudioTracks mic)] (set! (.-enabled t) on?))
      (swap! talk-state assoc :talking on?)
      (when-let [b ($ "talk-ptt")] (.setAttribute b "aria-pressed" (str on?)) (set! (.-textContent b) (if on? "Talking…" "Hold to talk")))
      (talk-send-state!) (render-talk-peers!))))

(defn talk-mic! []
  (-> (.getUserMedia js/navigator.mediaDevices #js {:audio #js {:echoCancellation true :noiseSuppression true :autoGainControl true}})
      (.then (fn [s]
               (doseq [t (.getAudioTracks s)] (set! (.-enabled t) false))
               (swap! talk-media assoc :mic s)
               (doseq [id ["talk-ptt" "talk-note"]] (set! (.-disabled ($ id)) false))
               (set! (.-disabled ($ "talk-mic")) true)
               (talk-senders!)))
      (.catch (fn [e] (talk-msg! (str "microphone: " (esc (.-message e))) "bad")))))

(defn talk-own-tile! []
  (let [t (or (.querySelector js/document ".ttile[data-peer='me']")
              (let [d (js/document.createElement "div")]
                (set! (.-className d) "ttile") (.setAttribute d "data-peer" "me")
                (set! (.-innerHTML d) "<video autoplay playsinline muted></video><span class=\"tlabel\"></span><button class=\"act small\" data-talk-frame=\"me\">Keep a frame</button>")
                (.prepend ($ "talk-tiles") d) d))]
    (set! (.-textContent (.querySelector t ".tlabel")) (str (talk-name) " (you)"))
    (set! (.-srcObject (.querySelector t "video")) (:cam @talk-media))
    (set! (.-hidden t) (nil? (:cam @talk-media)))))

(defn talk-cam! []
  (if-let [c (:cam @talk-media)]
    (do (doseq [t (.getTracks c)] (.stop t))
        (swap! talk-media assoc :cam nil) (talk-senders!) (talk-own-tile!) (talk-send-state!)
        (.setAttribute ($ "talk-cam") "aria-pressed" "false"))
    (-> (.getUserMedia js/navigator.mediaDevices #js {:video #js {:width 320 :height 240 :frameRate 15}})
        (.then (fn [s] (swap! talk-media assoc :cam s) (talk-senders!) (talk-own-tile!) (talk-send-state!)
                 (.setAttribute ($ "talk-cam") "aria-pressed" "true")))
        (.catch (fn [e] (talk-msg! (str "camera: " (esc (.-message e))) "bad"))))))

(defn talk-frame!
  "A frame of a camera tile (\"me\" or a peer's id), small, as something said in the room (and so kept like the rest)."
  [peer-id]
  (when-let [v (.querySelector js/document (str ".ttile[data-peer='" peer-id "'] video"))]
    (when (pos? (.-videoWidth v))
      (let [c (js/document.createElement "canvas")]
        (set! (.-width c) 160) (set! (.-height c) 120)
        (.drawImage (.getContext c "2d") v 0 0 160 120)
        (let [mine? (= peer-id "me") p (get-in @talk-room [:peers peer-id])
              it {:kind :frame :id (str "f-" (js/Math.round (talk-ms)) "-" (rand-int 1e6))
                  :author (if mine? (my-author) (:who p)) :peer (if mine? (:id @talk-room) peer-id)
                  :name (if mine? (talk-name) (:name p)) :t (talk-now) :image (.toDataURL c "image/jpeg" 0.6)}]
          (talk-add! it) (talk-to-all! {:item it})
          (:id it))))))

;; ───────── the room: its peers and their connections ─────────

(defn talk-tile! [id]
  (or (.querySelector js/document (str ".ttile[data-peer='" id "']"))
      (let [d (js/document.createElement "div")]
        (set! (.-className d) "ttile") (.setAttribute d "data-peer" id) (set! (.-hidden d) true)
        (set! (.-innerHTML d) (str "<video autoplay playsinline muted></video><span class=\"tlabel\"></span>"
                                   "<button class=\"act small\" data-talk-frame=\"" (esc id) "\">Keep a frame</button>"))
        (.append ($ "talk-tiles") d) d)))

(defn talk-add-peer! [id nm]
  (swap! talk-room (fn [r] (-> r (assoc-in [:peers id] {:name nm :n (:n r) :state "relay" :pending []}) (update :n inc))))
  (render-talk-peers!))

(defn talk-drop-peer! [id]
  (when-let [pc (get-in @talk-room [:peers id :pc])] (.close pc))
  (some-> (.querySelector js/document (str ".ttile[data-peer='" id "']")) .remove)
  (some-> (.querySelector js/document (str "audio.taudio[data-peer='" id "']")) .remove)
  (swap! talk-room update :peers dissoc id)
  (swap! talk-state update :asks (fn [as] (vec (remove #(= id (:from %)) as))))
  (render-talk-asks!) (render-talk-peers!))

(defn talk-pc! [id initiator?]
  (let [pc (js/RTCPeerConnection. #js {:iceServers #js [#js {:urls "stun:stun.l.google.com:19302"}]})
        dc (.createDataChannel pc "talk" #js {:negotiated true :id 1 :ordered true})
        state! (fn [s] (when (get-in @talk-room [:peers id]) (swap! talk-room assoc-in [:peers id :state] s) (render-talk-peers!)))]
    (set! (.-onicecandidate pc) (fn [ev] (when-let [c (.-candidate ev)] (talk-signal! {:to id :data {:candidate (.toJSON c)}}))))
    (set! (.-onopen dc) (fn [_] (state! "p2p") (talk-send-state!)))
    (set! (.-onclose dc) (fn [_] (state! "relay")))
    (set! (.-onmessage dc) (fn [ev] (talk-on! id (js/JSON.parse (.-data ev)))))
    (set! (.-ontrack pc)
          (fn [ev]
            (let [tr (.-track ev) s (js/MediaStream. #js [tr])]
              (if (= "audio" (.-kind tr))
                (let [a (or (.querySelector js/document (str "audio.taudio[data-peer='" id "']"))
                            (let [a (js/document.createElement "audio")]
                              (set! (.-className a) "taudio") (.setAttribute a "data-peer" id) (set! (.-autoplay a) true)
                              (.append js/document.body a) a))]
                  (set! (.-srcObject a) s) (.catch (.play a) (fn [_] nil)))
                (let [t (talk-tile! id)]
                  (set! (.-srcObject (.querySelector t "video")) s)
                  (set! (.-textContent (.querySelector t ".tlabel")) (or (get-in @talk-room [:peers id :name]) "")))))))
    (when initiator?
      (.addTransceiver pc "audio" #js {:direction "sendrecv"})
      (.addTransceiver pc "video" #js {:direction "sendrecv"}))
    (swap! talk-room update-in [:peers id] merge {:pc pc :dc dc})
    (when initiator?
      (talk-senders!)
      (-> (.createOffer pc) (.then #(.setLocalDescription pc %))
          (.then #(talk-signal! {:to id :data {:sdp (.toJSON (.-localDescription pc))}}))))
    pc))

(defn talk-from! [id data]
  (when (get-in @talk-room [:peers id])
    (cond
      (.-sdp data)
      (let [d (.-sdp data) pc (or (get-in @talk-room [:peers id :pc]) (talk-pc! id false))]
        (-> (.setRemoteDescription pc d)
            (.then (fn [_]
                     (doseq [c (get-in @talk-room [:peers id :pending])] (.catch (.addIceCandidate pc c) (fn [_] nil)))
                     (swap! talk-room assoc-in [:peers id :pending] [])
                     (when (= "offer" (.-type d))
                       (doseq [tr (.getTransceivers pc)] (set! (.-direction tr) "sendrecv"))
                       (talk-senders!)
                       (-> (.createAnswer pc) (.then #(.setLocalDescription pc %))
                           (.then #(talk-signal! {:to id :data {:sdp (.toJSON (.-localDescription pc))}}))))))
            (.catch (fn [e] (js/console.error "talk: WebRTC" e)))))
      (.-candidate data)
      (let [pc (get-in @talk-room [:peers id :pc])]
        (if (and pc (.-remoteDescription pc))
          (.catch (.addIceCandidate pc (.-candidate data)) (fn [_] nil))
          (swap! talk-room update-in [:peers id :pending] conj (.-candidate data))))
      (.-talk data) (talk-on! id (.-talk data)))))

(defn talk-on-signal! [f]
  (cond
    (.-pong f) (swap! talk-room update :clock tk/clock-sample (.-pong f) (.-t f) (talk-ms))
    (.-welcome f) (let [w (.-welcome f)]
                    (swap! talk-room assoc :id (.-id w))
                    (talk-msg! "in the room" "ok")
                    (doseq [p (.-peers w)] (talk-add-peer! (.-id p) (.-name p)) (talk-pc! (.-id p) true))
                    (render-talk!))
    (.-joined f) (let [j (.-joined f)] (talk-add-peer! (.-id j) (.-name j)))
    (.-left f) (talk-drop-peer! (.-left f))
    (.-from f) (talk-from! (.-from f) (.-data f))
    (.-error f) (talk-msg! (esc (.-error f)) "bad")))

(defn talk-ping! [] (talk-signal! {:ping (talk-ms)}))

(defn talk-leave! []
  (when-let [t (:timer @talk-room)] (js/clearInterval t))
  (doseq [id (keys (:peers @talk-room))] (talk-drop-peer! id))
  (when-let [ws (:ws @talk-room)] (set! (.-onclose ws) nil) (.close ws))
  (swap! talk-room assoc :ws nil :key nil :id nil :peers {} :clock (tk/new-clock) :timer nil)
  ;; what was said goes with the room
  (reset! talk-state {:items {} :order [] :asks [] :mine-asks {} :pieces {} :talking false})
  (render-talk!))

(defn talk-join! [k url]
  (talk-leave!)
  (let [ws (try (js/WebSocket. url) (catch :default e (talk-msg! (esc (.-message e)) "bad") nil))]
    (when ws
      (swap! talk-room assoc :ws ws :key k)
      (talk-msg! "connecting…" "")
      (set! (.-onopen ws)
            (fn [_]
              (talk-signal! {:join k :name (talk-name)})
              (doseq [i (range 8)] (js/setTimeout talk-ping! (* 60 i)))
              (swap! talk-room assoc :timer (js/setInterval talk-ping! 2000))))
      (set! (.-onmessage ws) (fn [ev] (talk-on-signal! (js/JSON.parse (.-data ev)))))
      (set! (.-onerror ws) (fn [_] (talk-msg! "the relay has no rooms (relay 0.3 or later)" "bad")))
      (set! (.-onclose ws) (fn [_] (when (= ws (:ws @talk-room)) (talk-msg! "out of the room" "") (swap! talk-room assoc :ws nil :id nil) (render-talk!)))))))

(defn talk-sync!
  "In the room the open work is (a shared room, with a relay), or in none."
  []
  (let [url (talk-signal-url)
        k (when (and url (= :room (:kind @work)) (:id @work)) (str "kairotic-" (:id @work)))]
    (cond (and k (not= k (:key @talk-room))) (talk-join! k url)
          (and (nil? k) (:key @talk-room)) (talk-leave!)
          :else (render-talk!))))

(defn talk-audio-in
  "Promise of the bytes of voice received from the room so far (all its connections): to see that it flows."
  []
  (js/Promise.all (clj->js (for [[_ p] (:peers @talk-room) :when (:pc p)]
                             (.then (.getStats (:pc p))
                                    (fn [r] (let [n (atom 0)]
                                              (.forEach r (fn [s & _] (when (and (= "inbound-rtp" (.-type s)) (= "audio" (.-kind s)))
                                                                        (swap! n + (or (.-bytesReceived s) 0)))))
                                              @n)))))))

;; ───────── wiring ─────────

(defn talk-hold! [el down up]
  (.addEventListener el "pointerdown" (fn [e] (when-not (.-disabled el) (.preventDefault e) (down))))
  (doseq [t ["pointerup" "pointercancel" "pointerleave"]] (.addEventListener el t (fn [_] (up)))))

(when ($ "panel-talk")
  (set! (.-value ($ "talk-name")) (or (try (.getItem js/localStorage "kairotic-name") (catch :default _ nil))
                                       (str "player " (.toUpperCase (.slice (.toString (js/Math.random) 36) 2 5)))))
  (.addEventListener ($ "talk-name") "change"
    (fn [_] (try (.setItem js/localStorage "kairotic-name" (talk-name)) (catch :default _ nil)) (talk-send-state!) (render-talk-peers!)))
  (.addEventListener ($ "talk-send") "click" (fn [_] (talk-say! (.-value ($ "talk-say"))) (set! (.-value ($ "talk-say")) "")))
  (.addEventListener ($ "talk-say") "keydown"
    (fn [e] (when (= "Enter" (.-key e)) (.stopPropagation e) (talk-say! (.-value ($ "talk-say"))) (set! (.-value ($ "talk-say")) ""))))
  (.addEventListener ($ "talk-mic") "click" (fn [_] (talk-mic!)))
  (.addEventListener ($ "talk-cam") "click" (fn [_] (talk-cam!)))
  (talk-hold! ($ "talk-ptt") #(talk-push! true) #(talk-push! false))
  (talk-hold! ($ "talk-note") (fn [] (.setAttribute ($ "talk-note") "aria-pressed" "true") (talk-note-start!))
              (fn [] (.setAttribute ($ "talk-note") "aria-pressed" "false") (talk-note-stop!)))
  (.addEventListener ($ "panel-talk") "click"
    (fn [e] (let [t (.-target e)]
              (when-let [id (.getAttribute t "data-talk-keep")] (talk-keep! id))
              (when-let [a (.getAttribute t "data-talk-answer")] (talk-answer! (.getAttribute t "data-id") (= a "yes")))
              (when-let [p (.getAttribute t "data-talk-frame")] (talk-frame! p)))))
  (.addEventListener ($ "tab-talk") "click" (fn [_] (.remove (.-classList ($ "tab-talk")) "attn") (render-talk!)))
  (add-watch work :talk (fn [_ _ o n] (when (not= [(:kind o) (:id o)] [(:kind n) (:id n)]) (talk-sync!))))
  (talk-sync!))
