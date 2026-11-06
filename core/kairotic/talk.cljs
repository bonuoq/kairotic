;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · talk: what is said in a room, and a clock the pages of a room agree on (discussion #135,
;; Studies 34 · io and 36 · talk). Pure: the page (app/page/20-talk.cljs) does the WebRTC and the sound.
;;
;; Everything said in a room is ephemeral: it lives in the pages that are there and goes when they go.
;; Something stays only when someone keeps it, and then it is a gesture of the work:
;;   a message      → a text annotation (layer :talk), on the box it names if it names one (@b3)
;;   a voice note   → a sound in a sample box (kept by hash, as recorded audio is)
;;   a video frame  → an image annotation
;; Anyone keeps what is theirs at once; keeping what is someone else's asks them first.

(ns kairotic.talk
  (:require [clojure.string :as str]))

(defn signal-url
  "The relay's rooms for a GUN relay address: wss://host/gun → wss://host/signal (nil if it is not one)."
  [gun-url]
  (when-let [[_ scheme host] (re-matches #"(wss?)://([^/\s,]+)(/[^\s,]*)?" (str gun-url))]
    (str scheme "://" host "/signal")))

;; ───────── messages and their anchors ─────────
;; In the text: @b3 a box, #12 a point of the history, ^33 a beat (of the room's tempo).

(defn anchors
  "The anchors written in a text, in order, without repeating."
  [text]
  (->> (re-seq #"(?:^|\s)(@[A-Za-z][\w~-]*|#\d+|\^\d+(?:\.\d+)?)" (or text ""))
       (map second)
       (map (fn [w] (case (first w)
                      "@" {:box (subs w 1)}
                      "#" {:point (js/parseInt (subs w 1))}
                      "^" {:beat (js/parseFloat (subs w 1))})))
       distinct vec))

(defn message
  "A message: who says it (id: this session; who: this browser, which lasts), what, and when (shared ms)."
  [{:keys [id who name]} text t]
  (let [text (str/trim (str text))]
    (when (seq text)
      {:kind :message :id (str who "-" (js/Math.round t) "-" (rand-int 1e6)) :author who :peer id :name name
       :text (subs text 0 (min 2000 (count text))) :t t :anchors (anchors text)})))

;; ───────── keeping, and asking ─────────
;; keep: what this page does when someone here wants to keep `item`:
;;   [:keep]          it is theirs: kept now
;;   [:ask peer]      someone else's, and they are in the room: ask them
;;   [:gone]          someone else's, and they have left: it cannot be kept (their consent can't be asked)

(defn keep-step
  [me item peers-in-room]
  (cond
    (= (:who me) (:author item)) [:keep]
    (contains? (set peers-in-room) (:peer item)) [:ask (:peer item)]
    :else [:gone]))

(defn kept
  "A kept item as the work keeps it: what it is, who made it, who kept it, and only what lasts."
  [item keeper t]
  (cond-> {:kind (:kind item) :author (:author item) :name (:name item) :kept-by (:who keeper) :at t}
    (= :message (:kind item)) (assoc :text (:text item) :anchors (:anchors item))
    (= :note (:kind item)) (assoc :sound (:sound item) :dur (:dur item))
    (= :frame (:kind item)) (assoc :image (:image item))))

;; ───────── pieces: a voice note, a frame, over a data channel ─────────
;; A note travels as base64 pieces small enough for any data channel (and for the relay when there is no
;; channel), each with the hash of the whole, so the receiver knows when it has it all and that it is
;; the same.

(def piece-size 12000)

(defn pieces
  "A base64 string in pieces: [{:hash h :i 0 :n k :data …} …]."
  [h b64]
  (let [n (max 1 (js/Math.ceil (/ (count b64) piece-size)))]
    (vec (for [i (range n)] {:hash h :i i :n n :data (subs b64 (* i piece-size) (min (count b64) (* (inc i) piece-size)))}))))

(defn gather
  "Pieces received so far ({hash → {i data}}) with one more: [new state, the whole base64 when complete]."
  [st {:keys [hash i n data]}]
  (let [got (assoc (get st hash {}) i data)]
    (if (= n (count got))
      [(dissoc st hash) (apply str (map got (range n)))]
      [(assoc st hash got) nil])))

;; ───────── the clock ─────────
;; Every page asks the relay for its time (ping → pong): sent at t0, the relay's time ts, back at t1 (ms).
;; The relay is ahead of the page by ts − (t0 + t1)/2, give or take half the round trip; of the last
;; samples, the median of the third with the shortest trips. Adding it to this page's time gives the
;; shared time, whatever each machine's clock says.

(def clock-keep 24)

(defn new-clock [] {:samples []})

(defn clock-sample
  "The clock with one more sample (t0 sent, ts the relay's time, t1 back, ms)."
  [c t0 ts t1]
  (let [rtt (- t1 t0)]
    (if (neg? rtt)
      c
      (update c :samples (fn [ss] (vec (take-last clock-keep (conj ss {:rtt rtt :offset (- ts (/ (+ t0 t1) 2))}))))))))

(defn- median [xs] (let [v (vec (sort xs)) n (count v)]
                     (when (pos? n) (if (odd? n) (v (quot n 2)) (/ (+ (v (dec (quot n 2))) (v (quot n 2))) 2)))))

(defn clock-offset
  "The relay's time minus this page's, in ms (nil before any sample)."
  [c]
  (let [ss (sort-by :rtt (:samples c))]
    (median (map :offset (take (max 1 (js/Math.ceil (/ (count ss) 3))) ss)))))

(defn clock-error "Half the shortest round trip: how far off the offset can be, in ms." [c]
  (when (seq (:samples c)) (/ (apply min (map :rtt (:samples c))) 2)))

(defn shared-time "This page's time (ms) as shared time, or nil before any sample." [c local] (when-let [o (clock-offset c)] (+ local o)))
