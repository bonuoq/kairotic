;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · sounds
;; Recorded and loaded sound. Its samples are too big for the history of a work: they are kept in this
;; browser (IndexedDB) under the hash of the samples, and the history keeps only a description,
;;   {:audio "5a2c…" :sr 48000 :frames 96000 :channels 1 :peaks [[-0.4 0.38] …]}
;; whose peaks are enough to draw it anywhere. A work opened in another browser shows the sound and
;; says it is not there; (load-sound! :bN) brings a file in. A sound can also come from a URL,
;;   {:url "https://…/voice.ogg" …}   or only   {:url "…"}
;; and then every browser that opens the work fetches it by itself (once: then it is kept like the rest,
;; under a key made from the URL), which is how a shared session or a test has the same sounds
;; everywhere. Two sources need no CORS of their own:
;;   github:owner/repo[@ref]/path.wav   a file of a public GitHub repository, served by jsDelivr
;;   freesound:12345                    a sound of Freesound (its preview), with the API key of whoever
;;                                      opens the work, kept only in their browser: (freesound-key! "…")
;; A Freesound sound brings its credit ({:name :author :license :page}), kept beside the description.
;; The loops over samples are JavaScript (kairotic/sounds.mjs).
;;
;;   sample [seconds]   a buffer of sound: what reaches its left inlet is recorded on `rec` until `stop`
;;                      (or until it has `seconds`, 60 by default). Its right outlet is the buffer for a
;;                      reader~, which plays it at the position of a phasor~; a bang sends its length in
;;                      seconds on the left, and so does every new recording.

(ns kairotic.sounds
  (:require [clojure.string :as str]
            [kairotic.components :as comp]
            [kairotic.api :as api]
            [kairotic.engine :as eng]))

;; ───────── the store ─────────

(defonce lib* (atom nil))
(defn lib
  "Promise of the native part (kairotic/sounds.mjs), loaded the first time a sound is needed."
  []
  (or @lib* (reset! lib* ((.-kairoticImport js/window) "kairotic/sounds.mjs"))))

(defonce cache (atom {}))    ; key → {:sr n :chans #js [Float32Array …]}
(defonce status (atom {}))   ; key → :here | :missing | :checking | :loading | :failed
(defonce local (atom {}))    ; key → {:sr :frames :channels :peaks} of a sound this browser has
(defonce failures (atom {})) ; key → why its URL could not be loaded

(def peak-columns 120)

;; ───────── sources: where a URL of a sound points ─────────

(defn github-spec
  "github:owner/repo[@ref]/path → {:owner :repo :ref :path}, or nil. ref is a tag, a commit or a branch
   without slashes (without it, jsDelivr serves the default branch, which can change: pin it)."
  [u]
  (when-let [[_ owner repo ref path] (and (string? u)
                                          (re-matches #"github:([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)(?:@([A-Za-z0-9_.-]+))?/(.+)" u))]
    (when-not (re-find #"\.\." path)
      {:owner owner :repo repo :ref ref :path path})))

(defn github-url
  "The jsDelivr URL of a github: sound (it serves public repositories with CORS open)."
  [{:keys [owner repo ref path]}]
  (str "https://cdn.jsdelivr.net/gh/" owner "/" repo (when ref (str "@" ref)) "/"
       (str/join "/" (map js/encodeURIComponent (str/split path #"/")))))

(defn freesound-id "freesound:12345 → 12345, or nil." [u]
  (when-let [[_ n] (and (string? u) (re-matches #"freesound:(\d{1,10})" u))] (js/parseInt n 10)))

(defn url?
  "A place a sound can be fetched from: an http(s) URL, a path of this page, a data: or blob: URL, a
   github:owner/repo/path or a freesound:id. Never javascript:, no spaces, at most 2048 characters."
  [u]
  (boolean
   (and (string? u) (<= 1 (count u) 2048) (not (re-find #"\s" u))
       (not (re-find #"(?i)^javascript:" u))
       (or (re-find #"(?i)^(https?|data|blob):" u)
           (github-spec u)
           (freesound-id u)
           ;; a path of this page: no scheme, and a dot or a slash (sounds/voice.ogg, ./a.wav)
           (and (not (re-find #"^[A-Za-z][A-Za-z0-9+.-]*:" u)) (re-find #"[./]" u))))))

;; Freesound: every person uses their own API key (freesound.org/apiv2/apply), kept in their browser and
;; never in a work, a link or a room
(def freesound-api "https://freesound.org/apiv2/")
(def key-storage "kairotic.freesound-key")

(defn freesound-key []
  (try (let [k (.getItem js/localStorage key-storage)] (when (seq k) k)) (catch :default _ nil)))

(defn set-freesound-key! [k]
  (try (if (seq k) (.setItem js/localStorage key-storage k) (.removeItem js/localStorage key-storage)) (catch :default _ nil))
  (boolean (seq k)))

(defn license-label
  "A short name for a license URL: CC0, CC BY, CC BY-NC, Sampling+…"
  [u]
  (let [u (str/lower-case (str u))]
    (cond (re-find #"publicdomain/zero|cc0" u) "CC0"
          (re-find #"by-nc" u) "CC BY-NC"
          (re-find #"/by/|attribution" u) "CC BY"
          (re-find #"sampling" u) "Sampling+"
          (seq u) "see license"
          :else "")))

(defn freesound-get
  "Promise of the JSON (as a map) of a Freesound API path, with the key of this browser."
  [path params]
  (if-let [k (freesound-key)]
    (-> (js/fetch (str freesound-api path "?"
                       (str/join "&" (for [[a b] (assoc params :token k)] (str (name a) "=" (js/encodeURIComponent (str b)))))))
        (.then (fn [r] (if (.-ok r) (.json r) (throw (js/Error. (str "Freesound answered " (.-status r)
                                                                     (when (= 401 (.-status r)) ": the API key is not valid")))))))
        (.then (fn [j] (js->clj j :keywordize-keys true))))
    (js/Promise.reject (js/Error. "Freesound needs an API key, kept only in this browser: (freesound-key! \"…\") — get one at freesound.org/apiv2/apply"))))

(defn freesound-credit [j]
  {:name (str (:name j)) :author (str (:username j)) :license (license-label (:license j))
   :page (str (or (:url j) (str "https://freesound.org/s/" (:id j) "/")))})

(defn github-hrefs
  "Where to look for a github: sound, in order. Without @ref: @main, @master, then what jsDelivr serves
   without a version — the latest semver tag of the repository, not its default branch, which may not
   have the file."
  [spec]
  (if (:ref spec)
    [(github-url spec)]
    (mapv (fn [ref] (github-url (assoc spec :ref ref))) ["main" "master" nil])))

(defn resolve-url
  "Promise of {:hrefs [url-to-fetch …] :credit {…}?} for a URL of a sound: the hrefs are tried in order
   while they answer 404."
  [u]
  (cond
    (github-spec u) (js/Promise.resolve {:hrefs (github-hrefs (github-spec u))})
    (freesound-id u)
    (.then (freesound-get (str "sounds/" (freesound-id u) "/") {:fields "id,name,username,license,url,previews"})
           (fn [j]
             (let [pv (:previews j)
                   href (or (get pv :preview-hq-mp3) (get pv :preview-hq-ogg) (get pv :preview-lq-mp3))]
               (when-not href (throw (js/Error. "Freesound gave no preview for that sound")))
               {:hrefs [href] :credit (freesound-credit j)})))
    :else (js/Promise.resolve {:hrefs [u]})))

(defn fetch-first
  "Promise of the bytes of the first of hrefs that answers; if one fails the next is tried (jsDelivr
   answers a file it does not have without the CORS header, so a missing file fails like a refused one).
   The error says why, in words: not found (and for github: where it looked), refused by the site (CORS)
   or unreachable."
  [u hrefs]
  (let [github? (github-spec u)
        not-found (fn [] (js/Error. (if github?
                                      (str "not found: it is not in "
                                           (if (:ref github?) (str "@" (:ref github?)) "@main, @master or the latest tag")
                                           " of " (:owner github?) "/" (:repo github?) " — check the path, or add @branch or @commit")
                                      "not found (404)")))]
    (letfn [(go [[href & more]]
              (-> (js/fetch href)
                  (.then (fn [r]
                           (if (.-ok r)
                             (.arrayBuffer r)
                             (throw (if (= 404 (.-status r)) (not-found) (js/Error. (str "the site answered " (.-status r))))))))
                  (.catch (fn [e]
                            (cond
                              (seq more) (go more)
                              ;; fetch itself fails (a TypeError) when the site refuses the page or cannot be reached
                              (instance? js/TypeError e)
                              (throw (if github? (not-found)
                                         (js/Error. "the site does not let this page load it (CORS), or cannot be reached")))
                              :else (throw e))))))]
      (go hrefs))))

(defn as-url
  "A URL from what reaches a sample: a string, or a word as a msg box sends it (msg https://… or
   msg \"https://…\": a keyword, maybe with its quotes). nil if it is not one."
  [v]
  (let [t (cond (string? v) v
                ;; the whole text of the keyword: name and namespace split it at its first slash
                (keyword? v) (subs (str v) 1)
                (symbol? v) (str v)
                :else nil)
        t (when t (str/trim t))
        t (if (and t (re-matches #"\".*\"|'.*'" t)) (subs t 1 (dec (count t))) t)]
    (when (url? t) t)))

(defn url-key
  "The key a sound from a URL is kept under: 16 hex characters from the URL (two FNV-1a hashes)."
  [u]
  (let [h (fn [seed] (reduce (fn [h c] (unsigned-bit-shift-right (js/Math.imul (bit-xor h (.charCodeAt c 0)) 16777619) 0))
                             seed (seq u)))
        hex (fn [x] (.padStart (.toString x 16) 8 "0"))]
    (str (hex (h 2166136261)) (hex (h 3735928559)))))

(defn sample?
  "A description of a sound (the data of a sample box), not an empty one."
  [d] (and (map? d) (string? (:audio d)) (or (pos? (or (:frames d) 0)) (url? (:url d)))))

(defn about
  "What is known of the sound of d: its description, completed with what this browser learnt when it
   loaded it (a description that is only a URL learns its length and peaks so)."
  [d] (merge (get @local (:audio d)) (select-keys d [:sr :frames :channels :peaks :credit])))

(defn seconds [d]
  (let [{:keys [frames sr]} (when (sample? d) (about d))]
    (if (and (number? frames) (number? sr) (pos? sr)) (/ frames sr) 0)))

(defn sane
  "The description of a sound as it may be kept in the history, or {} if it is not one. A URL alone is
   enough: its key is made from it."
  [d]
  (let [n (fn [x] (and (number? x) (js/isFinite x) (pos? x)))
        url (when (and (map? d) (url? (:url d))) (:url d))
        credit (when (map? (:credit d))
                 (let [c (into {} (for [k [:name :author :license :page] :let [v (get-in d [:credit k])]
                                        :when (and (string? v) (seq v))]
                                    [k (subs v 0 (min 300 (count v)))]))]
                   (when (seq c) c)))]
    (cond
      (and (map? d) (string? (:audio d)) (re-matches #"[0-9a-f]{8,64}" (:audio d)) (n (:sr d)) (n (:frames d)))
      (cond-> {:audio (:audio d) :sr (:sr d) :frames (js/Math.floor (:frames d))
               :channels (max 1 (min 32 (js/Math.floor (or (:channels d) 1))))
               :peaks (vec (for [p (take 2000 (:peaks d)) :when (and (sequential? p) (= 2 (count p)) (every? number? p))]
                             (mapv (fn [x] (comp/clamp x -1 1)) p)))}
        url (assoc :url url)
        credit (assoc :credit credit))
      url (cond-> {:audio (url-key url) :url url} credit (assoc :credit credit))
      :else {})))

(defn sound
  "Promise of the sound kept under hash h ({:sr :chans}), or nil if this browser does not have it."
  [h]
  (if-let [s (get @cache h)]
    (js/Promise.resolve s)
    (-> (lib)
        (.then (fn [L] (.then (.get L h) (fn [r] [L r]))))
        (.then (fn [[L r]]
                 (if r
                   (let [chans (.-chans r)
                         s {:sr (.-sr r) :chans chans}]
                     (swap! cache assoc h s)
                     ;; what it is (length, picture), as when it was stored: a sound kept in an earlier
                     ;; session is described again, so a description that is only a URL learns it too
                     (when-not (:peaks (get @local h))
                       (swap! local update h merge
                              {:sr (.-sr r) :frames (.-length (aget chans 0)) :channels (.-length chans)
                               :peaks (js->clj (.peaks L chans peak-columns))}))
                     (swap! status assoc h :here)
                     s)
                   (do (swap! status assoc h :missing) nil)))))))

(defn store!
  "Keeps a sound under key h in this browser (memory and IndexedDB). Promise of its description."
  [h sr chans]
  (.then (lib)
         (fn [L]
           (.then (.put L h sr chans)
                  (fn [_]
                    (let [d {:audio h :sr sr :frames (.-length (aget chans 0)) :channels (.-length chans)
                             :peaks (js->clj (.peaks L chans peak-columns))}]
                      (swap! cache assoc h {:sr sr :chans chans})
                      (swap! local assoc h (dissoc d :audio))
                      (swap! status assoc h :here)
                      d))))))

(defn keep!
  "Keeps a sound (sample rate, a JS array of Float32Array, one per channel) in this browser, under the
   hash of its samples. Promise of its description, the data of a sample box."
  [sr chans]
  (.then (lib) (fn [L] (.then (.hash L chans sr) (fn [h] (store! h sr chans))))))

(defn decode
  "Promise of a sound ({:sr :chans}, up to 8 channels) from the bytes of a file, decoded at the sample
   rate of the engine."
  [buf]
  (.then (.decodeAudioData (eng/ctx) buf)
         (fn [ab] {:sr (.-sampleRate ab)
                   :chans (into-array (for [c (range (min 8 (.-numberOfChannels ab)))]
                                        (js/Float32Array. (.getChannelData ab c))))})))

(defonce fetching (atom {}))   ; key → Promise

(defn fetch!
  "Promise of the sound at url, fetched, decoded and kept under key h (once, whoever asks first)."
  [h url]
  (or (get @fetching h)
      (let [credit (atom nil)
            p (-> (resolve-url url)
                  (.then (fn [{:keys [hrefs] c :credit}]
                           (reset! credit c)
                           (fetch-first url hrefs)))
                  (.then (fn [buf] (.catch (decode buf)
                                           (fn [e] (throw (js/Error. (str "it is not a sound this browser can decode (" (or (.-message e) e) ")")))))))
                  (.then (fn [{:keys [sr chans]}] (store! h sr chans)))
                  (.then (fn [_]
                           (when-let [c @credit] (swap! local assoc-in [h :credit] c))
                           (get @cache h)))
                  (.catch (fn [e]
                            (swap! status assoc h :failed)
                            (swap! failures assoc h (str (or (.-message e) e)))
                            (swap! fetching dissoc h)
                            (throw (js/Error. (str "could not load " url ": " (or (.-message e) e)))))))]
        (swap! status assoc h :loading)
        (swap! fetching assoc h p)
        p)))

(defn sound-for
  "Promise of the sound of a description ({:sr :chans}): from this browser, or fetched from its URL if
   it has one; nil if neither."
  [d]
  (let [h (:audio d)]
    (.then (sound h) (fn [s] (if (or s (not (url? (:url d)))) s (fetch! h (:url d)))))))

(defn check!
  "Finds out (once) whether this browser has the sound of d, fetching it if it comes from a URL:
   (get @status (:audio d)) then says it."
  [d]
  (let [h (:audio d)]
    (when (and (string? h) (nil? (get @status h)))
      (swap! status assoc h :checking)
      ;; why it could not be loaded is said once, in the REPL
      (.catch (sound-for d) (fn [e] (eng/print! (eng/now) (str "sample: " (or (.-message e) e))))))))

;; ───────── playing: the worklet a reader~ uses for a sound ─────────

(def player-source
  "class KairoticPlayer extends AudioWorkletProcessor {
  // Plays a sound at the position of its input (0…1 from the start to the end), interpolating between
  // samples: output channel c plays channel c of the sound (or its last one); after V value channels come
  // G gate channels, 1 while it has a sound. A message {chans} gives it the sound.
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.V = p.V || 1; this.G = p.G || 0; this.chans = null;
    this.port.onmessage = (e) => { this.chans = e.data.chans && e.data.chans.length ? e.data.chans : null; };
  }
  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0], out = outputs[0], ch = this.chans;
    const L = out[0].length, n = ch ? ch[0].length : 0;
    for (let i = 0; i < L; i++) {
      let p = inp ? inp[i] : 0;
      p = p < 0 ? 0 : (p > 1 ? 1 : p);
      const f = p * (n - 1), k = Math.floor(f), r = f - k;
      for (let c = 0; c < out.length; c++) {
        if (c < this.V) {
          if (n < 2) { out[c][i] = 0; continue; }
          const s = ch[Math.min(c, ch.length - 1)];
          out[c][i] = k + 1 < n ? s[k] + (s[k + 1] - s[k]) * r : s[n - 1];
        } else out[c][i] = n ? 1 : 0;
      }
    }
    return true;
  }
}
registerProcessor('kairotic-player', KairoticPlayer);
")

(defn player
  "Promise of a player worklet with V value channels and G gate channels (the outlets of a reader~)."
  [ac V G]
  (api/worklet-node ac "kairotic-player" player-source
                    {:numberOfInputs 1 :numberOfOutputs 1 :outputChannelCount [(+ V G)]
                     :channelCount 1 :channelCountMode "explicit" :processorOptions {:V V :G G}}))

(defn give!
  "Gives a player the sound s ({:chans}), or none (nil)."
  [pl s]
  (.postMessage (.-port pl) #js {:chans (if s (:chans s) #js [])}))

;; ───────── the sample box ─────────

(def block 4096)

(defn sample-seconds [x] (comp/clamp (or (comp/num-of x) 60) 0.1 600))

(defn splice
  "The channels of an old sound (a JS array of Float32Array, or nil) until frame n0 — silence where it is
   shorter —, then the new samples s, in every channel; with after, what the old sound had after the new
   samples end follows them (punch-in/out)."
  ([old n0 s] (splice old n0 s false))
  ([old n0 s after]
   (let [C (if old (max 1 (.-length old)) 1)
         n1 (+ n0 (.-length s))
         len (if (and after old) (max n1 (.-length (aget old 0))) n1)]
     (into-array
      (for [c (range C)]
        (let [out (js/Float32Array. len)
              o (when old (aget old c))]
          (when o (.set out (.subarray o 0 (min n0 (.-length o)))))
          (.set out s n0)
          (when (and after o (> (.-length o) n1)) (.set out (.subarray o n1) n1))
          out))))))

(defonce takes (atom []))   ; what the last takes did, step by step (for debugging and tests)
(defn step! [x] (swap! takes (fn [t] (vec (take-last 30 (conj t x))))))

(defn finish!
  "The end of a recording: its blocks become one sound, kept in this browser and written as the data
   of the box (through the page, an event of the history); the box hears it on inlet :audio."
  [node id]
  (when-let [{:keys [blocks sr max from base ovr]} @(:rec node)]
    (reset! (:rec node) nil)
    (step! [:finish id (count blocks) from])
    (-> (lib)
        (.then (fn [L]
                 (let [s (.concat L (clj->js blocks) max)]
                   (step! [:joined id (.-length s)])
                   (cond
                     (zero? (.-length s)) (js/Promise.reject (js/Error. "nothing was recorded"))
                     ;; rec t: the sound it had until t, then the take (punch-in)
                     (some? from)
                     (.then (if (sample? base) (sound-for base) (js/Promise.resolve nil))
                            (fn [old]
                              (step! [:old id (some? old) (:sr old)])
                              (cond
                                (and (sample? base) (nil? old))
                                (throw (js/Error. "the sound to record over is not in this browser"))
                                (and old (not= (:sr old) sr))
                                (throw (js/Error. (str "the sound to record over is at " (:sr old) " Hz, the engine at " sr " Hz")))
                                :else (keep! sr (splice (:chans old) (js/Math.floor (* from sr)) s ovr)))))
                     :else (keep! sr #js [s])))))
        (.then (fn [d]
                 (step! [:kept id (:frames d)])
                 (api/effect! id [:sample [:set d]])
                 (api/report! id {:done d} nil)))
        (.catch (fn [e]
                  (step! [:failed id (str (or (.-message e) e))])
                  (js/console.warn "sample:" e)
                  (api/report! id {:error (str "sample: " (or (.-message e) e))} nil))))))

(defn start!
  "rec: a new take (unless one is going on); the box hears that it started. With {:from t :base d} the
   take goes after the first t seconds of the sound d (punch-in)."
  [node at opts]
  (when-not @(:rec node)
    (let [sr (.-sampleRate (:ac node))]
      (reset! (:rec node) (merge {:blocks [] :n 0 :sr sr :max (js/Math.floor (* sr @(:seconds node)))}
                                 (when (map? opts) (select-keys opts [:from :base :ovr]))))
      (when-let [w @(:tap node)] (api/retap w {:active true}))
      (api/report! (:id node) {:started true} at))))

(defn stop!
  "stop: what was heard until now (the worklet hands its last samples at once) becomes the take."
  [node]
  (step! [:stop (:id node) (some? @(:rec node)) (some? @(:tap node))])
  (when @(:rec node)
    (if-let [w @(:tap node)]
      (api/retap w {:flush true :active false})
      (finish! node (:id node)))))

(defn on-block!
  "A block heard while recording: kept; at the end (stop, or the length of the box) the take is finished."
  [node data {:keys [last]}]
  (when-let [r @(:rec node)]
    (let [b (first data)
          r (swap! (:rec node) (fn [r] (-> r (update :blocks conj b) (update :n + (.-length b)))))
          full (>= (:n r) (:max r))]
      (when full (when-let [w @(:tap node)] (api/retap w {:active false})))
      (if (or last full)
        (finish! node (:id node))
        (api/report! (:id node) {:progress (+ (or (:from r) 0) (/ (:n r) (:sr r))) :level (when-let [L @(:L node)] (.peak L b))} nil)))))

(defn wave-points
  "The waveform of a description: its peaks as a zigzag from x0 to x1 around the line at y mid."
  [peaks x0 x1 mid half]
  (let [k (count peaks)]
    (vec (for [i (range k) :let [[lo hi] (nth peaks i)
                                 x (+ x0 (* (- x1 x0) (/ i (max 1 (dec k)))))]
               y [(- mid (* hi half)) (- mid (* lo half))]]
           [x y]))))

(defn fmt-s [s] (str (comp/nice s) " s"))

(comp/define! "sample"
  {:doc "A buffer of sound. What reaches its left inlet is recorded on `rec` until `stop` (or until it has seconds, 60 by default), replacing what it had; rec t (msg rec 2.5) keeps its first t seconds and records from there (punch-in); ovr t (msg ovr 2.5) replaces only what the take covers and keeps what comes after (punch-in/out); `clear` empties it. Its right outlet is the buffer for a reader~, which plays it at the position of a phasor~ (0 the start, 1 the end); a bang sends its length in seconds on the left, and so does every new recording. The sound stays in this browser; the work keeps its picture. A URL (a string on the left, or (load-sound! :bN \"https://…\")) loads a sound that every browser opening the work fetches by itself. (load-sound! :bN) brings in a file, (save-sound :bN) saves it as WAV."
   :usage "sample [seconds]"
   :license "MPL-2.0"
   :io [1 2]
   :size [240 72]
   :args [[:seconds 60]]
   :model {:empty {}
           :step (fn [d [op x]] (case op :set (sane x) :clear {} d))
           :load sane
           :code (fn [id d] (when (sample? d) [(str "(sample! " id " " (pr-str d) ")")]))}
   :receive (fn [{:keys [inlet value state data]}]
              (let [rec? (:rec state)]
                (cond
                  (= inlet :audio)
                  (cond
                    (:started value) {:state (assoc state :rec true) :show {:rec 0}}
                    (:progress value) (if rec? {:show {:rec (:progress value) :level (:level value)}} {})
                    (:done value) {:state (dissoc state :rec) :show nil :out [[0 (seconds (:done value))]]}
                    (:error value) {:state (dissoc state :rec) :show nil :effects [[:print (:error value)]]}
                    :else {})
                  ;; the node says when it starts (only while ▶ is on: without it there is no sound to record)
                  (= value :rec) {:effects [[:rec true]]}
                  ;; rec t (msg rec 2.5): the sound until t stays, the take replaces what comes after (punch-in)
                  (and (vector? value) (= :rec (first value)) (number? (second value)) (>= (second value) 0))
                  {:effects [[:rec {:from (second value) :base (when (sample? data) data)}]]}
                  ;; ovr t (msg ovr 2.5): only what the take covers is replaced, what comes after it stays (punch-in/out)
                  (or (= value :ovr) (and (vector? value) (= :ovr (first value)) (number? (second value)) (>= (second value) 0)))
                  {:effects [[:rec {:from (if (vector? value) (second value) 0) :base (when (sample? data) data) :ovr true}]]}
                  (= value :stop) {:effects [[:rec false]]}
                  (= value :bang) (if (sample? data) {:out [[0 (seconds data)]]} {})
                  (= value :clear) {:effects [[:sample [:clear]]]}
                  ;; a URL (a string, or [:url "…"]): the page loads it and writes it as the data of the box
                  ;; msg https://… (or msg "https://…", or msg url "…") arrives as a word: as-url reads it
                  (as-url value) {:effects [[:sample [:url (as-url value)]]]}
                  (and (sequential? value) (= :url (first value)) (as-url (second value)))
                  {:effects [[:sample [:url (as-url (second value))]]]}
                  (and (sequential? value) (= :url (first value)))
                  {:effects [[:print (str "sample: " (pr-str (second value)) " is not a URL a sound can be loaded from")]]}
                  (or (string? value) (keyword? value))
                  {:effects [[:print (str "sample: " (pr-str value) " is neither rec, stop, clear nor a URL (https://…, github:…, freesound:…)")]]}
                  :else {})))
   ;; drawing it is also when this browser looks for its sound (and fetches it, if it comes from a URL)
   :draw (fn [{:keys [data shown w h]}]
           (let [w (or w 240) h (or h 72) mid (/ (- h 12) 2) d (when (sample? data) (merge data (about data)))
                 here (when d (get @status (:audio d)))]
             (when d (check! data))
             [[:rect {:x 2 :y 2 :w (- w 4) :h (- h 4) :r 4 :stroke :grid :fill :bg}]
              [:line {:x1 6 :y1 (+ 2 mid) :x2 (- w 6) :y2 (+ 2 mid) :stroke :grid}]
              (when (seq (:peaks d)) [:path {:points (wave-points (:peaks d) 6 (- w 6) (+ 2 mid) (- mid 4))
                                             :stroke (if (#{:missing :failed} here) :soft :accent) :weight 1}])
              (if (:rec shown)
                [:text {:x 8 :y (- h 7) :size 10 :fill :kairos} (str "● rec " (fmt-s (:rec shown)))]
                [:text {:x 8 :y (- h 7) :size 9 :fill :soft}
                 (cond
                   (and d (= here :loading)) "loading…"
                   (and d (= here :failed))
                   (if (re-find #"API key" (str (get @failures (:audio d)))) "needs a Freesound API key" "could not load its URL")
                   (and d (number? (:sr d)))
                   (str (fmt-s (seconds d)) " · " (comp/nice (/ (:sr d) 1000)) " kHz"
                        (when (> (or (:channels d) 1) 1) (str " · " (:channels d) " ch"))
                        (if-let [c (:credit d)]
                          (str " · " (:author c) (when (seq (:license c)) (str " · " (:license c))))
                          (when (:url d) " · URL"))
                        (when (= here :missing) " · not in this browser"))
                   d "…"
                   :else "empty · rec records what reaches it")])
              (when (and (:rec shown) (number? (:level shown)))
                [:rect {:x (- w 70) :y (- h 13) :w (* 60 (comp/clamp (:level shown) 0 1)) :h 4 :r 1 :stroke nil :fill :kairos}])]))
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac)
                           secs (sample-seconds (:seconds (comp/args-for (comp/lookup "sample") (:text b))))
                           node {:ac ac :id (:id b) :in in :seconds (atom secs) :tap (atom nil) :L (atom nil) :rec (atom nil)
                                 :alive (atom true) :inlets [[in 0]] :outlets []}]
                       (.then (lib) (fn [L] (reset! (:L node) L)))
                       (-> (api/tap ac {:mode :frames :size block :hop block :active false}
                                    (fn [data _ _ flags] (on-block! node data flags)))
                           (.then (fn [w]
                                    (if @(:alive node)
                                      (do (.connect in w) (reset! (:tap node) w)
                                          (when @(:rec node) (api/retap w {:active true})))
                                      (try (.disconnect w) (catch :default _ nil)))))
                           (.catch (fn [e] (js/console.error "sample" e))))
                       node))
           :update (fn [node b _]
                     (reset! (:seconds node) (sample-seconds (:seconds (comp/args-for (comp/lookup "sample") (:text b))))))
           :effects {:rec (fn [node on at] (if on (start! node at on) (stop! node)))}
           ;; ■ while recording keeps what was heard until then
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (when @(:rec node) (finish! node (:id node)))
                      (try (.disconnect (:in node)) (catch :default _ nil)))}})
