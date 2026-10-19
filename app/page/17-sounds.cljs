;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 18 of 18: sounds
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── sounds: the data of sample boxes ─────────────────────────
;; A sample box keeps a description of its sound in the work ({:audio hash :sr :frames :channels :peaks});
;; the samples stay in this browser (kairotic.sounds). A recording reaches the history as a gesture,
;; (sample! :bN {…}), which is also how the work's code writes it.

(defn need-sample [id]
  (let [b (need-box id)]
    (when-not (= "sample" (klass (:text b))) (fail (str id " is not a sample box")))
    b))

(defn sample!
  "The sound of a sample box, as a description: (sample! :b4 {:audio \"5a2c…\" :sr 48000 :frames 96000
   :channels 1 :peaks […]}) — what a recording or (load-sound! :b4) writes. (sample! :b4 nil) empties it."
  [id d]
  (need-sample id)
  (if (snd/sample? (snd/sane d))
    (do (dispatch! [:in id [:set d]]) (snd/seconds (snd/sane d)))
    (do (dispatch! [:in id [:clear]]) 0)))

(defn sound-of "The description of the sound of a sample box ({} if it is empty)." [id]
  (or (:data (need-sample id)) {}))

(defn sound-file-name [d] (str "kairotic-" (subs (str (:audio d)) 0 8) ".wav"))

(defn save-sound
  "Saves the sound of a sample box as a WAV file (16 bits), if this browser has it: (save-sound :b4)."
  [id]
  (let [d (sound-of id)]
    (when-not (snd/sample? d) (fail (str id " has no sound")))
    (-> (js/Promise.all #js [(snd/sound (:audio d)) (snd/lib)])
        (.then (fn [[s L]]
                 (if-not s
                   (repl-print! "err" (esc (str "; " id ": its sound is not in this browser (it was recorded elsewhere)")))
                   (let [a (.createElement js/document "a")]
                     (set! (.-href a) (js/URL.createObjectURL (.wav L (:chans s) (:sr s))))
                     (set! (.-download a) (sound-file-name d))
                     (.click a))))))
    (sound-file-name d)))

(defn decode-sound!
  "A sound file (a File or Blob) into the sample box id: decoded at the sample rate of the engine, kept
   in this browser, written as a gesture. Promise of its length in seconds."
  [id file]
  (-> (.arrayBuffer file)
      (.then (fn [buf] (.decodeAudioData (eng/ctx) buf)))
      (.then (fn [ab]
               (let [n (min 8 (.-numberOfChannels ab))
                     chans (into-array (for [c (range n)] (js/Float32Array. (.getChannelData ab c))))]
                 (snd/keep! (.-sampleRate ab) chans))))
      (.then (fn [d] (gesture! (str "(sample! " id " " (pr-str d) ")")) (snd/seconds d)))
      (.catch (fn [e] (repl-print! "err" (esc (str "; " id ": could not read that sound (" (or (.-message e) e) ")")))))))

(defn load-sound!
  "Brings a sound file (wav, mp3, ogg, flac… whatever this browser can decode) into a sample box:
   (load-sound! :b4) opens the file chooser."
  [id]
  (need-sample id)
  (let [input (.createElement js/document "input")]
    (set! (.-type input) "file")
    (set! (.-accept input) "audio/*")
    (.addEventListener input "change" (fn [_] (when-let [f (aget (.-files input) 0)] (decode-sound! id f))))
    (.click input)
    :choose-a-file))

;; a sample box asked (a recording finished, or `clear`): done as a gesture, so it is an event of the history
(let [before (:effect-hook @eng/rt)]
  (swap! eng/rt assoc :effect-hook
         (fn [f [k x :as e] at]
           (if (= k :sample)
             (js/setTimeout
              (fn []
                (cond
                  (not (get-in (current) [:boxes f]))
                  (repl-print! "err" (esc (str "; " (name f) " is inside a sub-patch: a recording is kept only by the sample boxes of the patch on screen")))
                  (= :set (first x)) (gesture! (str "(sample! " f " " (pr-str (second x)) ")"))
                  :else (gesture! (str "(sample! " f " nil)"))))
              0)
             (when before (before f e at))))))
