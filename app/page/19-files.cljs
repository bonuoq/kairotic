;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page: a work as a file (discussion #149)
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).
;;
;; A .kairotic is a zip (kairotic/kfile.mjs) holding a whole work, in EDN:
;;   manifest.edn   {:format 1 :kairotic "0.2.0-alpha" :made <ms> :kind :history | :release :anonymous bool}
;;   work.edn       {:name … :simultaneity-ms … :origin …}
;;   lines.edn      {"main" {:name "main"} "<id>" {:name "sketch" :created … :archived false :aliases […]}}
;;   history.edn    every segment of every line, as the history keeps them
;;   people.edn     {author {:name :color}} (not when anonymous)
;;   sounds/<hash>.wav   the sounds recorded, 32-bit float (samples from URLs stay references)
;; Opening one makes a new work (solo, or local without a database); the file and any other work are not
;; touched. Exported as a release, it holds one line with a compact history (as a link or a release has).

(in-ns 'user)

(def kfile-format 1)

(defn kfile-lib "Promise of kairotic/kfile.mjs." [] (.kairoticImport js/window "kairotic/kfile.mjs"))

;; ───────────────────────── what a work is, as data ─────────────────────────

(defn all-segments
  "Every segment of the work: those of the line on screen and of every other line."
  [] (vec (concat (vals (:nodes @hist)) (mapcat vals (vals (:other @hist))))))

(defn recorded-sounds
  "The keys of the sounds recorded that the events use (those from a URL stay references)."
  [segs]
  (set (for [x (tree-seq coll? seq (mapv :events segs))
             :when (and (map? x) (string? (:audio x)) (not (snd/url? (:url x))))]
         (:audio x))))

(defn anonymize
  "The segments with every author and session made a plain name of its own (p1, p2… s1, s2…)."
  [segs]
  (let [ids (fn [k pre] (into {} (map-indexed (fn [i a] [a (str pre (inc i))]) (distinct (keep k segs)))))
        as (ids :author "p") ss (ids :session "s")]
    (mapv (fn [n] (cond-> (assoc n :author (get as (:author n) "p0"))
                    (:session n) (assoc :session (get ss (:session n)))))
          segs)))

(defn work-data
  "The work as the file keeps it: {:manifest :work :lines :history :people}."
  [{:keys [release anonymous]}]
  (let [now (js/Date.now)
        segs (if release
               [{:id "release" :parent nil :at 0 :author (my-author) :session session-id :t now :merge nil
                 :events (release-events)}]
               (all-segments))
        segs (mapv (fn [n] (select-keys n [:id :parent :at :author :session :t :merge :events :line])) segs)
        segs (if anonymous (anonymize segs) segs)
        idx (:index @line-state)]
    {:manifest {:format kfile-format :kairotic version :made now :kind (if release :release :history) :anonymous (boolean anonymous)}
     :work (cond-> {:name (or (:name @work) "Untitled") :simultaneity-ms (:simul-ms @settings)}
             (and (not anonymous) (:kind @work)) (assoc :origin (str (name (:kind @work)) ":" (:id @work))))
     :lines (if release
              {main-line {:name (line-name (active-line))}}
              (into {main-line (select-keys (get idx main-line {:name "main"}) [:name :created :archived :aliases])}
                    (for [l (known-lines) :when (not= l main-line)]
                      [l (select-keys (merge {:name (line-name l)} (get idx l)) [:name :created :archived :aliases])])))
     :history segs
     :people (when-not anonymous (into {} (for [a (distinct (map :author segs)) :let [p (get @profiles a)] :when p] [a p])))}))

(defn export-bytes
  "Promise of the bytes of a .kairotic of the work: {:release true} for a release, {:anonymous true} without
   who made it."
  [opts]
  (let [d (work-data opts)
        hashes (recorded-sounds (:history d))]
    (-> (js/Promise.all (clj->js (for [h hashes] (.then (snd/sound h) (fn [s] [h s])))))
        (.then (fn [found]
                 (let [found (array-seq found)]
                   (.then (kfile-lib)
                          (fn [K]
                            (let [have (filter (fn [[_ s]] (some? s)) found)
                                  missing (vec (for [[h s] found :when (nil? s)] h))
                                  edn (fn [nm x] #js {:name nm :data (pr-str x)})]
                              (.zip K (clj->js
                                       (concat
                                        [(edn "manifest.edn" (cond-> (:manifest d) (seq missing) (assoc :missing-sounds missing)))
                                         (edn "work.edn" (:work d))
                                         (edn "lines.edn" (:lines d))
                                         (edn "history.edn" (:history d))]
                                        (when (seq (:people d)) [(edn "people.edn" (:people d))])
                                        (for [[h s] have]
                                          #js {:name (str "sounds/" h ".wav") :deflate false
                                               :data (.wav K (:sr s) (:chans s))})))))))))))))

(defn file-name [nm ext]
  (str (or (not-empty (-> (str nm) str/lower-case (str/replace #"[^a-z0-9\u00e0-\u024f]+" "-") (str/replace #"^-|-$" ""))) "work") ext))

(defn download-bytes! [bytes nm]
  (let [a (js/document.createElement "a")
        url (js/URL.createObjectURL (js/Blob. #js [bytes] #js {:type "application/zip"}))]
    (set! (.-href a) url)
    (set! (.-download a) nm)
    (.appendChild js/document.body a)
    (.click a)
    (.remove a)
    (js/setTimeout (fn [] (js/URL.revokeObjectURL url)) 4000)))

(defn export-work
  "(export-work): downloads the work as a file (.kairotic), with its whole history, every line and the sounds
   recorded. (export-work :release) a release of it (one line, one point per keyframe);
   (export-work {:anonymous true}) without who made it (also {:release true :anonymous true})."
  ([] (export-work {}))
  ([opts]
   (when-not (:kind @work) (fail "Open a work first."))
   (when @perf (fail "You are in Perform: (compose) first."))
   (let [opts (cond (map? opts) opts (= :release opts) {:release true} (= :anonymous opts) {:anonymous true} :else {})
         nm (file-name (str (or (:name @work) "work") (when (:release opts) " release")) ".kairotic")]
     (-> (export-bytes opts)
         (.then (fn [b]
                  (download-bytes! b nm)
                  (repl-print! "out" (esc (str "; " nm " · " (js/Math.round (/ (.-length b) 1024)) " KB")))))
         (.catch (fn [e] (repl-print! "err" (esc (str "Could not export the work: " (or (.-message e) e)))))))
     nm)))

;; ───────────────────────── opening one ─────────────────────────

(defn sane-segment [n]
  (when (and (map? n) (string? (:id n)) (seq (:id n)))
    {:id (:id n)
     :parent (when (string? (:parent n)) (:parent n))
     :at (if (number? (:at n)) (:at n) 0)
     :author (str (or (:author n) "unknown"))
     :session (when (string? (:session n)) (:session n))
     :t (if (number? (:t n)) (:t n) 0)
     :merge (when (valid-pos? (:merge n)) (:merge n))
     :line (when (and (string? (:line n)) (seq (:line n)) (not= main-line (:line n))) (:line n))
     :events (if (sequential? (:events n)) (vec (filter (fn [e] (and (vector? e) (keyword? (first e)))) (:events n))) [])}))

(defn read-work-bytes
  "Promise of what a .kairotic holds: {:manifest :work :lines :history :people :sounds {hash {:sr :chans}}}."
  [bytes]
  (.then (kfile-lib)
         (fn [K]
           (.then (.unzip K bytes)
                  (fn [files]
                    (let [by (into {} (for [f (array-seq files)] [(.-name f) (.-data f)]))
                          edn (fn [nm] (when-let [b (get by nm)]
                                         (try (clojure.edn/read-string (.text K b))
                                              (catch :default e (throw (js/Error. (str nm ": " (.-message e))))))))
                          manifest (edn "manifest.edn")]
                      (when-not (map? manifest) (throw (js/Error. "This is not a Kairotic work (it has no manifest.edn).")))
                      (when (> (or (:format manifest) 0) kfile-format)
                        (throw (js/Error. (str "This work was saved by a newer Kairotic (format " (:format manifest) "): update this page."))))
                      {:manifest manifest
                       :work (or (edn "work.edn") {})
                       :lines (let [l (edn "lines.edn")] (if (map? l) l {}))
                       :history (vec (keep sane-segment (edn "history.edn")))
                       :people (or (edn "people.edn") {})
                       :sounds (into {} (for [[nm b] by :let [[_ h] (re-matches #"sounds/([0-9a-z]+)\.wav" nm)] :when h]
                                          (let [s (.unwav K b)] [h {:sr (.-sr s) :chans (.-chans s)}])))}))))))

(defn sane-lines [ls]
  (into {} (for [[k v] ls :when (and (string? k) (map? v))]
             [k (cond-> {:name (str (or (:name v) (if (= k main-line) "main" "a line")))
                         :created (if (number? (:created v)) (:created v) 0)
                         :archived (true? (:archived v))}
                  (sequential? (:aliases v)) (assoc :aliases (vec (filter string? (:aliases v)))))])))

(defn fresh-ids
  "The segments with the ids made in a local work (local-…, never saved, so never extended there either) made
   ids of their own, and every reference to them (a parent, a merge, a [:merge-from …] event) with them."
  [segs]
  (let [m (into {} (for [n segs :when (str/starts-with? (:id n) "local-")]
                     [(:id n) (str "f" (.toString (js/Math.floor (* (js/Math.random) 2176782336)) 36) (.toString (js/Date.now) 36)
                                   (.toString (js/Math.floor (* (js/Math.random) 1296)) 36))]))
        f (fn [x] (get m x x))]
    (if (empty? m)
      segs
      (mapv (fn [n] (cond-> (-> n (update :id f) (update :parent (fn [p] (when p (f p)))))
                      (:merge n) (update :merge (fn [[a i]] [(f a) i]))
                      true (update :events (fn [evs] (mapv (fn [e] (if (= :merge-from (first e)) (assoc e 1 (f (second e))) e)) evs)))))
            segs))))

(defn open-work-data!
  "Makes a new work of what a file holds: solo when there is a database to write it to, else local.
   Promise of its name."
  [{:keys [work lines people sounds] :as d} fallback-name]
  (let [history (fresh-ids (:history d))
        nm (str (or (not-empty (str (:name work))) fallback-name "Opened work"))
        simul (let [v (:simultaneity-ms work)] (if (and (number? v) (<= 0 v 10000)) v 1500))
        lines (sane-lines lines)
        main (into {} (for [n history :when (nil? (:line n))] [(:id n) n]))
        other (reduce (fn [m n] (assoc-in m [(:line n) (:id n)] n)) {} (filter :line history))]
    (-> (js/Promise.all (clj->js (for [[h s] sounds] (snd/store! h (:sr s) (:chans s)))))
        (.then
         (fn [_]
           (when (seq people) (swap! profiles merge people))
           (if (and @dbref (uid) (:writable @hist))
             (let [db @dbref
                   ref (.doc (.collection db (coll-for :solo)))
                   id (.-id ref)
                   base (str (coll-for :solo) "/" id)]
               (busy! "Opening the file…")
               (-> (.set ref (clj->js {:name nm :created (js/Date.now) :author (uid) :simultaneity_ms simul :origin "file"}))
                   (.then (fn [_] (reduce (fn [p n] (.then p (fn [_] (.set (.doc db (str base "/history/" (:id n))) (node->js n)))))
                                          (js/Promise.resolve nil) history)))
                   (.then (fn [_] (reduce (fn [p [l e]] (.then p (fn [_] (.set (.doc db (str base "/lines/" l)) (clj->js e)))))
                                          (js/Promise.resolve nil) lines)))
                   (.then (fn [_] (busy! nil) (open-work! :solo id nm) nm))))
             (do (open-work! :local "file" nm)
                 (reset! cache {})
                 (swap! hist assoc :nodes main :other other :loaded true)
                 (swap! settings assoc :simul-ms simul)
                 (swap! line-state assoc :index lines)
                 (swap! world assoc :pos (newest-tip) :auto true :prev-pos nil)
                 (render-all!)
                 (render-lines!)
                 nm)))))))

(defn open-work-bytes!
  "Promise: the work a .kairotic holds (its bytes), opened as a new work."
  ([bytes] (open-work-bytes! bytes nil))
  ([bytes fallback]
   (-> (read-work-bytes bytes)
       (.then (fn [d] (open-work-data! d fallback)))
       (.then (fn [nm] (repl-print! "out" (esc (str "; opened from a file: «" nm "»"))) nm)))))

(defn open-work-file!
  "Asks for a .kairotic file and opens the work it holds, as a new one."
  []
  (let [in ($ "kfile-in")]
    (set! (.-value in) "")
    (.click in)
    :choosing))

(.addEventListener ($ "kfile-in") "change"
  (fn [e]
    (when-let [f (aget (.. e -target -files) 0)]
      (-> (.arrayBuffer f)
          (.then (fn [ab] (open-work-bytes! (js/Uint8Array. ab) (str/replace (.-name f) #"\.kairotic$" ""))))
          (.catch (fn [err]
                    (busy! nil)
                    (repl-print! "err" (esc (str "Could not open " (.-name f) ": " (or (.-message err) err))))))))))

;; ───────────────────────── the Share/Export panel: first, the work as a file ─────────────────────────

(.addEventListener ($ "ep-file") "click"
  (fn [e]
    (when-let [b (.closest (.-target e) "[data-kfile]")]
      (let [anon (.-checked ($ "ep-anon"))
            release (= "release" (.getAttribute b "data-kfile"))]
        (gesture! (str "(export-work " (pr-str (cond-> {} release (assoc :release true) anon (assoc :anonymous true))) ")"))))))
