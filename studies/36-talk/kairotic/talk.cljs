;; SPDX-License-Identifier: MPL-2.0
;; Study 36 · talk: talking in a room — text, push-to-talk, voice notes and video (discussion #135).
;;
;; Everything said in a room is ephemeral: it lives in the pages that are there and goes when they go.
;; Something stays only when someone keeps it, and then it becomes part of the work:
;;   a message      → an annotation, anchored where it points (a box, a point of the history, a beat)
;;   a voice note   → a sound (a buffer, by hash, as recorded audio is kept), usable as a sample
;;   a video frame  → an image annotation
;; Anyone keeps what is theirs at once; keeping what is someone else's asks them first. A kept thing says
;; who made it.

(ns kairotic.talk
  (:require [clojure.string :as str]))

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

;; ───────── who is talking ─────────

(defn talkers
  "The names of those talking now, from {peer {:talk bool :name}}, and me."
  [peers me-talking? me-name]
  (vec (concat (when me-talking? [me-name]) (for [[_ p] (sort-by key peers) :when (:talk p)] (:name p)))))

;; ───────── printing ─────────

(defn when-str "hh:mm:ss of shared ms." [t] (.slice (.toISOString (js/Date. t)) 11 19))

(defn anchor-str [a]
  (cond (:box a) (str "@" (:box a)) (:point a) (str "#" (:point a)) (:beat a) (str "^" (:beat a))))
