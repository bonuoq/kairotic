;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · api
;; What a component that does not live in the core may use. Packages (@kairotic/synth, …) and
;; components written in a work use these functions instead of the core's own modules, so the core
;; can change inside without breaking them. Inside a component source this namespace is `api`.
;;
;; The API has a version: a package declares the one it was written for ({:api 1}). A change that
;; breaks a function here raises the major version; adding functions does not.

(ns kairotic.api
  (:require [kairotic.components :as comp]))

(def version 1)

;; ───────── numbers ─────────

(defn clamp "x between a and b (in either order)." [x a b] (comp/clamp x a b))
(defn nice "A value rounded to a sensible precision for display and sending." [v] (comp/nice v))
(defn num-of "A number from a message: the number itself, or the first of a list (else nil)." [v] (comp/num-of v))
(defn to-unit "v between lo and hi as 0…1 (logarithmic with log?)." [v lo hi log?] (comp/to-unit v lo hi log?))
(defn from-unit "0…1 back to lo…hi (logarithmic with log?)." [u lo hi log?] (comp/from-unit u lo hi log?))

(defn padded
  "The numbers written in a box text, the missing ones taken from defaults: (padded [20] [10 100]) → [20 100]."
  [args defaults]
  (let [ns (filterv number? args)] (vec (take (count defaults) (concat ns (drop (count ns) defaults))))))

;; ───────── audio ─────────

(defn stereo-outlets
  "Two outlets (left, right) from a stereo AudioNode: [[splitter 0] [splitter 1]]."
  [ac node]
  (let [sp (.createChannelSplitter ac 2)] (.connect node sp) [[sp 0] [sp 1]]))

(defonce worklet-modules (atom {}))   ; [AudioContext name] → Promise

(defn worklet-ready
  "Promise that resolves when the AudioWorklet code `source` is loaded in `ac` under `name` (once per
   context, whoever asks first). `source` is JavaScript that calls registerProcessor(name, …)."
  [ac name source]
  (let [k [ac name]]
    (or (get @worklet-modules k)
        (let [url (js/URL.createObjectURL (js/Blob. #js [source] #js {:type "application/javascript"}))
              p (.addModule (.-audioWorklet ac) url)]
          (swap! worklet-modules assoc k p)
          p))))

(defn worklet-node
  "Promise of an AudioWorkletNode of processor `name` (defined in `source`) with these options."
  [ac name source opts]
  (.then (worklet-ready ac name source)
         (fn [_] (js/AudioWorkletNode. ac name (clj->js opts)))))

(defn param "The AudioParam `k` of an AudioWorkletNode." [w k] (.get (.-parameters w) k))
