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

(defn download-bytes!
  "Saves the bytes of a .kairotic (on claude.ai through its downloads capability, as .kairotic.zip). Promise
   of the name it was saved with, or nil."
  [bytes nm]
  (save-file! (js/Blob. #js [bytes] #js {:type "application/zip"}) nm))

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
                  (.then (download-bytes! b nm)
                         (fn [saved] (when saved (repl-print! "out" (esc (str "; " saved " · " (js/Math.round (/ (.-length b) 1024)) " KB"))))))))
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
          (.then (fn [ab] (open-work-bytes! (js/Uint8Array. ab) (str/replace (.-name f) #"\.kairotic(\.zip)?$|\.zip$" ""))))
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

;; ───────────────────────── a tree box as MEI, and MEI or MusicXML as a tree box (discussion #217) ─────────────────────────
;; kairotic.mei (Study 55): the written music in MEI's notation, where the notes really sounded in its gestural
;; attributes (@tstamp.real, @dur.real, @vel), everything else MEI has no place for in one <extMeta type="kairotic">.
;; A tree read from a MEI written here is the tree; one written elsewhere reads as its notation. MusicXML goes
;; through Verovio (it reads MusicXML and writes MEI).

(defn mei
  "The MEI of a tree box, as text: (mei :b3). Its tree as it is when it is written in measures, quantized first when
   it is in free time. (mei :b3 :written): only what is written — no real times, velocities, wires, takes,
   continuum — for notation programs and exchange (discussion #308)."
  ([id] (mei id :all))
  ([id which]
   (let [t (tree-data id)]
     (when (nil? t) (fail (str id " holds no tree")))
     (when-not (#{:all :written} which) (fail "(mei :bN) or (mei :bN :written)"))
     (let [m (if (mt/measured? t) (qz/measure-free-voices t) (qz/quantize-tree t))]
       (mei/->mei (if (= which :written) (mt/descriptive m) m))))))

(defn export-mei!
  "Downloads the MEI of a tree box: (export-mei! :b3), or only what is written: (export-mei! :b3 :written)."
  ([id] (export-mei! id :all))
  ([id which]
   (let [m (mei id which)
         nm (file-name (str (or (:name (mt/attrs (tree-data id))) (name id)) (when (= which :written) "-written")) ".mei")]
     (download-bytes! (.encode (js/TextEncoder.) m) nm)
     nm)))

(defn music->tree
  "Promise of the tree of a MEI or MusicXML text (MusicXML through Verovio)."
  [text]
  (js/Promise.
   (fn [res rej]
     (try
       (if (mei/musicxml? text)
         (-> (.-kairoticVerovio js/window)
             (.then (fn [tk] (res (mei/<-mei (mei/musicxml->mei tk text)))))
             (.catch rej))
         (res (mei/<-mei text)))
       (catch :default e (rej e))))))

(defn place-tree!
  "A tree into tree box id, or into a new tree box at x y (as (box \"tree\" x y) and (tree! id t) would)."
  [t id x y]
  (let [id (if (and id (get-in (current) [:boxes id])) id (box "tree" x y))]
    (tree! id t)
    id))

(defn import-music-file!
  "A .mei or MusicXML file (or a .mei.txt, as claude.ai saves one) into tree box id (or a new one at x y)."
  [f id x y]
  (-> (.text f)
      (.then music->tree)
      (.then (fn [t] (let [b (place-tree! t id x y)] (repl-print! "out" (esc (str "; " (.-name f) " → " b " · " (mt/summary t)))))))
      (.catch (fn [e] (repl-print! "err" (esc (str "Could not read " (.-name f) ": " (or (.-message e) e))))))))

;; (a .mei.txt is a MEI saved on claude.ai, which offers .txt but not .mei — as the studies' exports are)
(defn music-file? [f] (boolean (re-find #"(?i)\.(mei|musicxml|xml)(\.txt)?$" (.-name f))))

(defn import-mei!
  "Opens a .mei or MusicXML file into a tree box: (import-mei!) makes a new one, (import-mei! :b3) writes into b3."
  ([] (import-mei! nil))
  ([id]
   (when id (when-not (tree-box? (need-box id)) (fail (str id " is not a tree box"))))
   (let [inp (js/document.createElement "input") [x y] (auto-pos)]
     (set! (.-type inp) "file")
     (set! (.-accept inp) ".mei,.musicxml,.xml,.txt,application/mei+xml,application/vnd.recordare.musicxml+xml")
     (.addEventListener inp "change" (fn [_] (when-let [f (aget (.-files inp) 0)] (import-music-file! f id x y))))
     (.click inp)
     :choose-a-file)))

;; a .mei or MusicXML file dropped on the patch becomes a tree box where it falls
(.addEventListener ($ "canvas") "dragover"
  (fn [e] (when (some #{"Files"} (array-seq (.. e -dataTransfer -types))) (.preventDefault e))))
(.addEventListener ($ "canvas") "drop"
  (fn [e]
    (let [fs (filter music-file? (array-seq (.. e -dataTransfer -files)))]
      (when (seq fs)
        (.preventDefault e)
        (let [[x y] (pt e)]
          (doseq [[i f] (map-indexed vector fs)] (import-music-file! f nil (+ x (* 30 i)) (+ y (* 30 i)))))))))

;; ───────────────────────── a tree box as a continuum, and its takes (discussions #217, #289) ─────────────────────────

(defn continuum!
  "A tree box seen as a continuum, at a resolution: (continuum! :b3 :dissolve) — a preset: :written :proportional
   :tempered :graphic :mixed :dissolve :crystallize —, (continuum! :b3 {:res {:time [r …] :pitch [r …] :glyph [r …]}})
   (samples evenly over the piece, 0…1), or the take shown: (continuum! :b3 {:take \"t1\"}), {:take nil} for the
   notes' own time. Kept in the tree (:continuum on its root): one event of the history, part of its MEI."
  [id x]
  (need-tree-box id)
  (let [t (or (tree-data id) (fail (str id " holds no tree")))
        c (or (:continuum (mt/attrs t)) {})
        c2 (cond
             (keyword? x) (assoc c :res (or (ct/preset-res x) (fail (str "No such resolution: " x " (" (str/join " " (map str (keys ct/presets))) ")"))))
             (map? x) (cond-> c
                        (contains? x :res) (assoc :res (:res x))
                        (and (contains? x :take) (:take x)) (assoc :take (:take x))
                        (and (contains? x :take) (nil? (:take x))) (dissoc :take))
             :else (fail "(continuum! :bN :dissolve), {:res …} or {:take \"t1\"}"))]
    (tree! id (mt/update-attrs t assoc :continuum c2))
    (when-not (= :continuum (view-of (need-box id))) (view id :continuum))
    (str id " · continuum" (when (keyword? x) (str " " (name x))) (when (:take c2) (str " · take " (:take c2))))))

(defn takes-key [] (str "kairotic-takes:" (name (or (:kind @work) :local)) ":" (or (:id @work) "local")))

(defn my-takes-load! []
  (reset! my-takes (or (try (some-> (.getItem js/localStorage (takes-key)) clojure.edn/read-string) (catch :default _ nil)) {})))

(add-watch work :my-takes (fn [_ _ o n] (when (not= [(:kind o) (:id o)] [(:kind n) (:id n)]) (my-takes-load!))))
(my-takes-load!)

(defn keep-take!
  "Keeps a take of a tree box ({:id \"t1\" :name … :audio … :when {note-id [onset dur]}}, seconds): only for you by
   default — in this browser, beside the work, as Learn keeps a mapping only for you —, or with :work in the tree (an
   event of its history, shared in a room): (keep-take! :b3 take), (keep-take! :b3 take :work)."
  ([id tk] (keep-take! id tk :me))
  ([id tk scope]
   (need-tree-box id)
   (when-not (and (map? tk) (some? (:id tk)) (map? (:when tk))) (fail "A take is {:id \"t1\" :when {note-id [onset dur]} …}"))
   (case scope
     ;; a take points at notes by :id: a tree whose notes have none is written out with them first (the names a
     ;; follow box gave them, mei/with-note-ids)
     :work (let [t (tree-data id)
                 ids (set (keep (fn [x] (when (and (vector? x) (= :note (first x)) (map? (second x))) (:id (second x)))) (tree-seq vector? seq t)))
                 t (if (every? ids (keys (:when tk))) t (mei/with-note-ids t))]
             (tree! id (mei/add-take t tk)) :work)
     :me (do (swap! my-takes update id (fn [ts] (conj (vec (remove #(= (:id tk) (:id %)) ts)) tk)))
             (try (.setItem js/localStorage (takes-key) (pr-str @my-takes)) (catch :default _ nil))
             (render-all!)
             :me)
     (fail "A take is kept :me (only for you) or :work"))))

(defn forget-take!
  "Forgets a take kept only for you (a take in the work is an edit of the tree: (tree! …) without it)."
  [id take-id]
  (swap! my-takes update id (fn [ts] (vec (remove #(= take-id (:id %)) ts))))
  (try (.setItem js/localStorage (takes-key) (pr-str @my-takes)) (catch :default _ nil))
  (render-all!)
  :forgotten)

(defn takes
  "The takes of a tree box: those of the work and those kept only for you ([{:id :name :scope} …])."
  [id]
  (vec (concat (map (fn [t] (assoc (select-keys t [:id :name]) :scope :work)) (mei/takes (or (tree-data id) [:voice])))
               (map (fn [t] (assoc (select-keys t [:id :name]) :scope :me)) (get @my-takes id)))))

;; ───────── wires: a note and the electronics, written on the note (discussions #217, #204) ─────────

(defn- sounds-at
  "Where the notes that begin a sound in the first voice of a tree are written, in order (as the continuum and a
   follow box count them): the metadata of each (where it is written, kairotic.mt/expand-source)."
  [t]
  (let [x (mt/expand-source t :w)
        v (if (= :voice (mt/tag x)) x (or (first (filter #(= :voice (mt/tag %)) (tree-seq mt/node? mt/kids x))) x))
        out (atom []) open (atom false)]
    (letfn [(walk [n]
              (cond (not (mt/node? n)) nil
                    (= :chord (mt/tag n)) (reset! open false)
                    (= :rest (mt/tag n)) (reset! open false)
                    (= :note (mt/tag n)) (let [a (mt/attrs n)]
                                           (when-not (:grace a)
                                             (when-not @open (swap! out conj (meta n)))
                                             (reset! open (boolean (:tie a)))))
                    :else (doseq [k (mt/kids n)] (walk k))))]
      (walk v))
    @out))

(defn- note-index [id t note]
  (let [evs (vec (filter :midi (ct/events t)))]
    (cond (number? note) (if (< -1 note (count evs)) note (fail (str "The tree has " (count evs) " notes (0 … " (dec (count evs)) ")")))
          :else (or (first (keep-indexed (fn [i e] (when (= (str note) (:id e)) i)) evs))
                    (fail (str "No note " note " in " id " (its notes: " (str/join " " (map :id evs)) ")"))))))

(defn- update-wire!
  "The tree box with f applied to the :wire of its i-th note (a melody string that holds it written out as notes)."
  [id i f]
  (let [t (tree-data id)
        m (get (sounds-at t) i)
        [ops path] (or (tc/writable t m) (fail "That note comes from a fragment (:defs) or a proportional rhythm (:rtm): write it out to wire it"))
        t2 (reduce mt/apply-op t ops)
        a (mt/attrs (mt/node-at t2 path))
        w (f (ct/note-wires (:wire a)))
        a2 (cond (empty? w) (dissoc a :wire) (= 1 (count w)) (assoc a :wire (first w)) :else (assoc a :wire w))]
    (tree! id (mt/apply-op t2 [:attrs path a2]))))

(defn wires
  "The wires of a tree box, each on its note: [{:note id :send … :kind … :leader … :tol …} …]."
  [id]
  (let [t (or (tree-data id) (fail (str id " holds no tree")))]
    (vec (mapcat (fn [e] (map #(assoc % :note (:id e)) (ct/note-wires (:wire e)))) (ct/events t)))))

(defn wire!
  "A wire from a note of a tree box to the electronics, written on the note ([:note {… :wire {:send :swell}}]): what a
   follow box sends when the performer gets there. (wire! :b3 2 :swell) — the third note, or its id \"n2\" —, rigid:
   on its note, or caught up at the next one found if it was passed over; (wire! :b3 2 :swell {:kind :elastic :tol
   0.5}): on its note if the performer gets there in time, else on its own half a second after the note was
   expected; {:leader :electronics}: at the time the note was expected, whatever the performer does. A wire that
   sends the same replaces it. Drawn on the continuum."
  ([id note send] (wire! id note send {}))
  ([id note send opts]
   (need-tree-box id)
   (let [t (or (tree-data id) (fail (str id " holds no tree")))
         i (note-index id t note)
         kind (keyword (name (or (:kind opts) :rigid)))
         leader (keyword (name (or (:leader opts) :performer)))
         _ (when-not (#{:rigid :elastic} kind) (fail ":kind is :rigid or :elastic"))
         _ (when-not (#{:performer :electronics} leader) (fail ":leader is :performer or :electronics"))
         w (cond-> {:send send}
             (= kind :elastic) (assoc :kind kind)
             (= leader :electronics) (assoc :leader leader)
             (and (= kind :elastic) (number? (:tol opts))) (assoc :tol (:tol opts)))]
     (update-wire! id i (fn [ws] (conj (vec (remove #(= send (:send %)) ws)) w)))
     (str id " · note " i " → " (pr-str send)))))

(defn unwire!
  "Takes the wires away from a note: (unwire! :b3 2), or only the one that sends x: (unwire! :b3 2 :swell)."
  ([id note] (unwire! id note ::all))
  ([id note send]
   (need-tree-box id)
   (let [t (tree-data id) i (note-index id t note)]
     (update-wire! id i (fn [ws] (if (= send ::all) [] (vec (remove #(= send (:send %)) ws)))))
     :unwired)))

;; ───────── "I am here": a click on a note of a continuum tells the follow boxes that follow it (discussion #308) ─────────

(defn followers-of
  "The follow boxes of the patch on screen that follow tree box id (and are following now)."
  [id]
  (vec (for [[fid b] (:boxes (current))
             :when (= "follow" (klass (:text b)))
             :let [[_ sh] (last-shown fid)]
             :when (and (:on sh) (= id (some-> (:from sh) local-id)))]
         fid)))

(defn here!
  "Tells the follow boxes following tree box id that the performer is at a note (its id, \"n3\", or its index): a
   correction while rehearsing, as a click on that note of the continuum does. Ahead, as if it was heard there; back,
   from there again (its wires go on again)."
  [id note]
  (need-tree-box id)
  (let [t (tree-data id)
        evs (vec (remove :rest (ct/events t)))
        nid (if (number? note) (or (:id (get evs note)) (fail (str "The tree has " (count evs) " notes"))) (str note))
        fs (followers-of id)]
    (when (empty? fs) (fail (str "No follow box is following " id " (start one: its :start)")))
    (doseq [f fs] (send! f 0 [:here nid]))
    (str "here: " nid)))

(defonce here-listener
  (do (.addEventListener js/document "click"
        (fn [e]
          (when-let [h (some-> (.-target e) (.closest "g.ct-root .ct-head[data-id]"))]
            (when-let [root (.closest h "g.ct-root")]
              (let [id (keyword (.getAttribute root "data-box"))]
                (when (seq (followers-of id))
                  (gesture! (str "(here! " id " " (pr-str (.getAttribute h "data-id")) ")")))))))
        true)
      true))

;; ───────── rehearsal: what the takes heard of each note, learned (discussion #308) ─────────

(defn learn!
  "Learns how each note of a tree box sounds from its takes that kept it (a follow box with descriptors: follow rms
   centroid chroma): for each descriptor its mean, how much it varies, and how well it tells the note from its
   neighbours. Kept on the tree's root (:profiles, with what belongs to performing it: hidden in the code window);
   a follow box then matches notes by them too, and finds sounds without a pitch by them alone. The takes kept only
   for you count too. (learn! :b3) → how many notes, from how many takes."
  [id]
  (need-tree-box id)
  (let [t (tree-data id)
        tks (filter :profile (concat (mei/takes t) (get @my-takes id)))
        _ (when (empty? tks) (fail (str id " has no take that kept what its notes sounded like (follow with descriptors: follow rms chroma …)")))
        ps (fl/learn (ct/events t) tks)]
    (tree! id (mt/update-attrs t assoc :profiles ps))
    (str (count ps) " notes learned from " (count tks) (if (= 1 (count tks)) " take" " takes"))))

(defn unlearn!
  "Forgets what rehearsals learned of a tree box: its notes are matched by their notation again."
  [id]
  (need-tree-box id)
  (tree! id (mt/update-attrs (tree-data id) dissoc :profiles))
  :unlearned)

(defn confidence
  "How sure a follower can be at each note of a tree box, weakest first: [[note-id 0…1] …] — where to rehearse more
   (discussion #308). Shown under each note of its continuum once it has been learned ((learn! :bN))."
  [id]
  (let [t (or (tree-data id) (fail (str id " holds no tree")))
        a (mt/attrs t)]
    (vec (sort-by second (fl/confidence (ct/events t) (:profiles a) (concat (:takes a) (get @my-takes id)))))))
