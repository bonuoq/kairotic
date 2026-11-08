;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · page · copy, cut, paste and duplicate boxes (issue #164)
;; ⌘/Ctrl+C copies the selected boxes, ⌘/Ctrl+X cuts them, ⌘/Ctrl+V pastes them where the pointer is (keeping
;; their layout), ⌘/Ctrl+D duplicates them a little below and to the right; (duplicate :b3 :b4) from code.
;;
;; What goes on the clipboard is the code of those boxes, as the Code tab writes it — (box …), (connect …), their
;; data — so it can be read, pasted in a message, an issue or a document. Its last line holds the same boxes as
;; data (;; kairotic-paste {…}): pasting reads that line as EDN, which evaluates nothing, so text copied from
;; anywhere cannot run code here. What it holds goes through the same checks as anything that comes from a room.
;;
;; Pasted boxes get new ids, the next free numbers, and keep their lines among themselves; a line to a box that
;; was not copied is kept when that box is in the patch where they are pasted (the same patch, usually). A paste
;; is one event of the history.

(def clip-mark ";; kairotic-paste ")

(defn clip-of
  "The boxes ids of patch p as a clipboard holds them: {:boxes {id box} :lines [lines that touch them]}."
  [p ids]
  (let [ids (set ids)]
    {:boxes (into (sorted-map) (select-keys (:boxes p) ids))
     :lines (vec (filter (fn [[a _ b _]] (or (ids a) (ids b))) (:lines p)))}))

(defn clip-text
  "The text a copy of boxes ids of patch p puts on the clipboard: their code, then the same as data."
  [p ids]
  (let [c (clip-of p ids) n (count (:boxes c))]
    (str ";; Kairotic · " n (if (= 1 n) " box" " boxes") " (" (str/join " " (keys (:boxes c)))
         ") · paste on a patch with ⌘/Ctrl+V\n"
         (patch->code c) "\n"
         clip-mark (pr-str c))))

(defn read-clip
  "The boxes and lines a clipboard text holds (made safe, as what comes from a room is), or nil if it holds none."
  [text]
  (when-let [line (some (fn [l] (when (str/starts-with? l clip-mark) l)) (str/split-lines (str text)))]
    (let [x (try (clojure.edn/read-string (subs line (count clip-mark))) (catch :default _ nil))]
      (when (and (map? x) (map? (:boxes x)))
        (let [p (sane-patch {:boxes (:boxes x) :lines (if (sequential? (:lines x)) (vec (:lines x)) [])})]
          (when (seq (:boxes p)) (select-keys p [:boxes :lines])))))))

(defn clip-corner
  "The top left corner of the boxes of a clipboard."
  [c]
  [(reduce min (map :x (vals (:boxes c)))) (reduce min (map :y (vals (:boxes c))))])

(defn paste-patch!
  "Adds the boxes and lines of clipboard c to the patch on screen, moved by dx dy, as one event of the history.
   They get the next free ids; a line to a box that was not copied is kept when that box is here. Selects them
   and returns their ids."
  [c [dx dy]]
  (let [p (current)
        start (inc (reduce max 0 (map id-z (keys (:boxes p)))))
        order (sort-by id-z (keys (:boxes c)))
        m (zipmap order (map (fn [i] (keyword (str "b" (+ start i)))) (range)))
        nb (into {} (for [[id b] (:boxes c)]
                      [(m id) (-> b (update :x (fn [x] (max 0 (js/Math.round (+ x dx)))))
                                    (update :y (fn [y] (max 0 (js/Math.round (+ y dy)))))
                                    ;; placed in the patch, not in the presentation
                                    (dissoc :present))]))
        end-of (fn [x] (or (m x) (when (contains? (:boxes p) x) x)))
        nl (vec (distinct (for [[a o b i] (:lines c)
                                :let [a2 (end-of a) b2 (end-of b) l [a2 o b2 i]]
                                :when (and a2 b2 (not (some #{l} (:lines p))))]
                            l)))
        q (-> p (update :boxes into nb) (update :lines into nl))
        ids (vec (sort-by id-z (vals m)))]
    (doseq [id ids] (forget-box! id))
    (dispatch-all! (rel/patch-diff p q))
    (doseq [[_ b] nb] (ensure-class! (:text b)))
    (swap! ui assoc :sel (sel-of ids) :insp nil :nsel nil :tsel nil)
    ids))

(defn duplicate
  "Duplicates boxes a little below and to the right, with their lines among themselves (and their lines to the
   others): (duplicate :b3 :b4). One event of the history; returns the new ids."
  [& ids]
  (when (empty? ids) (fail "Which boxes? (duplicate :b3 :b4)"))
  (doseq [id ids] (need-box id))
  (paste-patch! (clip-of (current) ids) [20 20]))

;; ───── the keys: the clipboard's own events, and ⌘/Ctrl+D ─────

(defn typing-somewhere?
  "Is something being written or selected on the page: a field, an editor, text selected, a field of an html box?"
  []
  (let [a (.-activeElement js/document)]
    (or (#{"INPUT" "TEXTAREA" "SELECT"} (some-> a .-tagName))
        (some-> a .-isContentEditable)
        (some? (some-> a .-shadowRoot .-activeElement))
        (not (str/blank? (str (.getSelection js/window)))))))

(defn clip-ready?
  "Do the clipboard's keys act on boxes now?"
  []
  (and (not (typing-somewhere?)) (not (locked?)) (not embed-mode) (.-hidden ($ "manager"))))

(defn copied! [ids verb]
  (repl-print! "out" (esc (str ";; " verb " " (count ids) (if (= 1 (count ids)) " box: " " boxes: ") (str/join " " ids)))))

(.addEventListener js/document "copy"
  (fn [e]
    (let [ids (vec (sort-by id-z (sel-ids)))]
      (when (and (seq ids) (clip-ready?))
        (.preventDefault e)
        (.setData (.-clipboardData e) "text/plain" (clip-text (current) ids))
        (copied! ids "copied")))))

(.addEventListener js/document "cut"
  (fn [e]
    (let [ids (vec (sort-by id-z (sel-ids)))]
      (when (and (seq ids) (clip-ready?))
        (.preventDefault e)
        (.setData (.-clipboardData e) "text/plain" (clip-text (current) ids))
        (swap! ui assoc :sel nil :insp nil)
        (gesture! (str "(delete " (str/join " " ids) ")"))))))

(.addEventListener js/document "paste"
  (fn [e]
    (when (clip-ready?)
      (when-let [c (read-clip (.getData (.-clipboardData e) "text/plain"))]
        (.preventDefault e)
        (let [[x0 y0] (clip-corner c)
              ;; where the pointer is over the patch, or a little below and to the right of where they were
              [tx ty] (or @last-patch-pt [(+ x0 20) (+ y0 20)])
              ids (paste-patch! c [(- tx x0) (- ty y0)])]
          (copied! ids "pasted"))))))

(.addEventListener js/document "keydown"
  (fn [e]
    (when (and (or (.-ctrlKey e) (.-metaKey e)) (not (.-shiftKey e)) (not (.-altKey e))
               (= "d" (str/lower-case (.-key e))) (clip-ready?))
      (let [ids (vec (sort-by id-z (sel-ids)))]
        (when (seq ids)
          (.preventDefault e)
          (gesture! (str "(duplicate " (str/join " " ids) ")")))))))
