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
   :channels 1 :peaks […]}) — what a recording or (load-sound! :b4) writes — or only a URL,
   (sample! :b4 {:url \"https://…/voice.ogg\"}), fetched by every browser that opens the work.
   (sample! :b4 nil) empties it."
  [id d]
  (need-sample id)
  (if (snd/sample? (snd/sane d))
    (do (dispatch! [:in id [:set d]]) (snd/seconds (snd/sane d)))
    (do (dispatch! [:in id [:clear]]) 0)))

(defn sound-of "The description of the sound of a sample box ({} if it is empty)." [id]
  (or (:data (need-sample id)) {}))

(defn sound-file-name [d] (str "kairotic-" (.slice (str (:audio d)) 0 8) ".wav"))

(defn save-sound
  "Saves the sound of a sample box as a WAV file (16 bits), if this browser has it: (save-sound :b4)."
  [id]
  (let [d (sound-of id)]
    (when-not (snd/sample? d) (fail (str id " has no sound")))
    (-> (js/Promise.all #js [(snd/sound-for d) (snd/lib)])
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
      (.then snd/decode)
      (.then (fn [{:keys [sr chans]}] (snd/keep! sr chans)))
      (.then (fn [d] (gesture! (str "(sample! " id " " (pr-str d) ")")) (snd/seconds d)))
      (.catch (fn [e] (repl-print! "err" (esc (str "; " id ": could not read that sound (" (or (.-message e) e) ")")))))))

(defn url-sound!
  "Loads the sound at url into the sample box id: fetched, decoded, kept in this browser and written as a
   gesture, its URL included, so every browser that opens the work fetches it too. Promise of its length."
  [id url]
  (let [d (snd/sane {:url url})]
    (-> (snd/sound-for d)
        (.then (fn [_] (let [full (merge (snd/about d) d)]
                         (gesture! (str "(sample! " id " " (pr-str full) ")"))
                         (snd/seconds full))))
        (.catch (fn [e] (repl-print! "err" (esc (str "; " id ": " (or (.-message e) e)
                                                      " (a URL of another site must allow it: CORS)"))))))))

(defn load-sound!
  "Brings a sound into a sample box (wav, mp3, ogg, flac… whatever this browser can decode):
   (load-sound! :b4) opens the file chooser; (load-sound! :b4 \"https://…/voice.ogg\") loads it from a URL,
   which every browser that opens the work fetches by itself (a shared session, a link, a test)."
  ([id]
   (need-sample id)
   (let [input (.createElement js/document "input")]
     (set! (.-type input) "file")
     (set! (.-accept input) "audio/*")
     (.addEventListener input "change" (fn [_] (when-let [f (aget (.-files input) 0)] (decode-sound! id f))))
     (.click input)
     :choose-a-file))
  ([id url]
   (need-sample id)
   (when-not (snd/url? url) (fail (str (pr-str url) " is not a URL a sound can be loaded from")))
   (url-sound! id url)
   :loading))

;; ───── sources of sounds: Freesound ─────
;; github:owner/repo@ref/path needs nothing; freesound:id needs an API key of whoever opens the work (each
;; person their own, from freesound.org/apiv2/apply), kept only in this browser.

(defn freesound-key!
  "Keeps your Freesound API key in this browser (never in a work, a link or a room): (freesound-key! \"…\").
   (freesound-key! nil) forgets it. Get one at https://freesound.org/apiv2/apply"
  [k]
  (if (snd/set-freesound-key! (when (string? k) (str/trim k)))
    (do (reset! snd/status {}) :kept-in-this-browser)
    :forgotten))

(defn sounds
  "Searches Freesound: (sounds \"kick\") · (sounds \"rain\" {:max 30}) seconds at most · {:license \"cc0\"}
   only CC0. Prints the first results, each with the line that loads it: (load-sound! :bN \"freesound:123\")."
  ([q] (sounds q {}))
  ([q {:keys [max license]}]
   (let [filters (cond-> []
                   (number? max) (conj (str "duration:[0 TO " max "]"))
                   (= "cc0" (some-> license str str/lower-case)) (conj "license:\"Creative Commons 0\""))]
     (-> (snd/freesound-get "search/text/"
                            (cond-> {:query (str q) :fields "id,name,username,license,duration" :page_size 12}
                              (seq filters) (assoc :filter (str/join " " filters))))
         (.then (fn [j]
                  (let [rs (:results j)]
                    (repl-print! "out" (esc (str "; Freesound: " (:count j) " sounds for " (pr-str q)
                                                 (when (seq rs) " — the first ones:"))))
                    (doseq [x rs]
                      (repl-print! "out" (esc (str "(load-sound! :bN \"freesound:" (:id x) "\")  ; "
                                                   (:name x) " · " (:username x) " · " (snd/license-label (:license x))
                                                   " · " (comp/nice (or (:duration x) 0)) " s")))))))
         (.catch (fn [e] (repl-print! "err" (esc (str "; " (or (.-message e) e)))))))
     :searching)))

(defn credits
  "The credits of the sounds of the work (those that brought theirs, from Freesound): one line each."
  []
  (let [walk (fn walk [p]
               (mapcat (fn [[_ b]]
                         (cond (= "patch" (klass (:text b))) (walk (:data b))
                               (= "sample" (klass (:text b)))
                               (when-let [c (:credit (merge (:data b) (snd/about (:data b))))] [c])))
                       (:boxes p)))
        cs (distinct (walk (work-patch)))]
    (mapv (fn [{:keys [name author license page]}] (str "\"" name "\" by " author (when license (str " (" license ")")) " — " page)) cs)))

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
                  (= :url (first x)) (url-sound! f (second x))
                  :else (gesture! (str "(sample! " f " nil)"))))
              0)
             (when before (before f e at))))))
