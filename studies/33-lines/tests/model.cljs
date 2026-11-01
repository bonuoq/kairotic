;; SPDX-License-Identifier: MPL-2.0
;; Study 33 · lines: the model's tests. Open tests/model.html (served, as the study) to run them.

(ns lines-tests
  (:require [kairotic.lines :as ln]
            [kairotic.lines-examples :as ex]))

(def results (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))
(defn throws? [f] (try (f) false (catch :default _ true)))

(defn out
  "What reaches number box `num` (a path) when msg box `msg` is clicked, in line lid where it stands."
  [p lid msg num]
  (let [g (ln/graph p (ln/line-patch (ln/line p lid)))]
    (get-in (ln/click g {} msg) [:vals num])))

;; history: continue at the tip, branch anywhere else
(let [p (-> (ln/new-project "t") (ln/append-all :main [[:box :b1 "msg 1" 0 0] [:box :b2 "number" 0 60] [:connect :b1 0 :b2 0]]))
      l (ln/line p :main)
      p2 (-> p (ln/back :main) (ln/back :main) (ln/append :main [:box :b3 "+ 1" 0 30]))
      l2 (ln/line p2 :main)]
  (is "one node while at the tip" (= 1 (count (:nodes l))))
  (is "going back and editing branches" (= 2 (count (:nodes l2))))
  (is "the branch is the front" (= (ln/front l2) (:pos l2)))
  (is "the old point keeps its patch" (= #{:b1 :b2} (set (keys (:boxes (ln/patch-at l2 (ln/tip-of l2 (first (:pos l)))))))))
  (is "the branch has b1 and b3" (= #{:b1 :b3} (set (keys (:boxes (ln/line-patch l2))))))
  (is "forward after back" (= (:pos l) (:pos (ln/line (-> p (ln/back :main) (ln/forward :main)) :main)))))

;; references: follow, pin, nesting
(let [h (ex/help-patch) pc (ex/piece)]
  (is "basic: 3 × 2" (= 6 (out h :basic [:b1] [:b3])))
  (is "follow: 5 × 10" (= 50 (out h :follow-pin [:b1] [:b4])))
  (is "pin: 5 × 2" (= 10 (out h :follow-pin [:b1] [:b5])))
  (is "nesting: (4 + 1) × 2" (= 10 (out h :nesting [:b1] [:b3])))
  (is "embedded: 2 - 5" (= -3 (out h :embedded [:b1] [:b3])))
  (is "piece: 220 × 0.5 + 3" (= 113 (out pc :main [:b1] [:b5])))
  (is "piece: 330 × 0.5 + 3" (= 168 (out pc :main [:b2] [:b6])))
  ;; a followed line that changes changes its users; a pinned one does not
  (let [h2 (ln/append h :scale [:text :b2 "* 100"])]
    (is "follow sees the change" (= 500 (out h2 :follow-pin [:b1] [:b4])))
    (is "pin does not" (= 10 (out h2 :follow-pin [:b1] [:b5]))))
  ;; a branch of the line (its tab went back) is its newest point: followers follow it
  (let [h3 (-> h (ln/back :scale) (ln/append :scale [:text :b2 "* 3"]))]
    (is "follow follows the newest branch" (= 15 (out h3 :follow-pin [:b1] [:b4]))))
  ;; ports come from the inlet and outlet boxes, by x
  (is "patch @name refers to a line" (= :double (ln/ref-name {:text "patch @double"})))
  (is "a plain word after patch stays a label" (and (nil? (ln/ref-name {:text "patch double"})) (ln/embedded? {:text "patch double"})))
  (is "ports of patch @double" (= [1 1] (:io (ln/io h {:text "patch @double"}))))
  (is "used by" (= #{:basic :add-double} (set (map :line (ln/used-by h :double))))))

;; cycles are refused
(let [h (ex/help-patch)]
  (is "a line cannot contain itself" (some? (ln/cycle-error h :double "patch @double")))
  (is "nor what uses it" (some? (ln/cycle-error h :double "patch @add-double")))
  (is "a missing line" (some? (ln/cycle-error h :basic "patch @nowhere")))
  (is "fine otherwise" (nil? (ln/cycle-error h :basic "patch @add-double"))))

;; extract and inline
(let [h (ex/help-patch)
      h2 (ln/extract h :embedded [] :b2 "minus")
      m (ln/line h2 :minus)]
  (is "extract makes a line" (some? m))
  (is "with the history it had inside (6 events)" (= 6 (ln/depth-of m (ln/front m))))
  (is "its first versions too" (= "- 1" (get-in (ln/patch-at m [(first (ln/front m)) 5]) [:boxes :b2 :text])))
  (is "the box refers to it" (= "patch @minus" (get-in (ln/line-patch (ln/line h2 :embedded)) [:boxes :b2 :text])))
  (is "and keeps no data" (nil? (get-in (ln/line-patch (ln/line h2 :embedded)) [:boxes :b2 :data])))
  (is "same result" (= -3 (out h2 :embedded [:b1] [:b3])))
  (let [h3 (ln/inline h :follow-pin [] :b2)
        h4 (ln/append h3 :scale [:text :b2 "* 100"])]
    (is "inline copies the line in" (= "patch" (get-in (ln/line-patch (ln/line h3 :follow-pin)) [:boxes :b2 :text])))
    (is "same result inlined" (= 50 (out h3 :follow-pin [:b1] [:b4])))
    (is "and it no longer follows" (= 50 (out h4 :follow-pin [:b1] [:b4]))))
  (let [h5 (ln/pin h :follow-pin [] :b2 (ln/front (ln/line h :scale)))
        h6 (ln/append h5 :scale [:text :b2 "* 100"])]
    (is "pin here freezes it" (= 50 (out h6 :follow-pin [:b1] [:b4])))))

;; rename: the users get the new name, older points find the old one
(let [h (ex/help-patch)
      before (:pos (ln/line h :basic))
      h2 (ln/rename-line h :double "twice")]
  (is "renamed" (and (ln/line h2 :twice) (nil? (get-in h2 [:lines :double]))))
  (is "users rewritten" (= "patch @twice" (get-in (ln/line-patch (ln/line h2 :basic)) [:boxes :b2 :text])))
  (is "nested users too" (= "patch @twice" (get-in (ln/line-patch (ln/line h2 :add-double)) [:boxes :b3 :text])))
  (is "still works" (= 10 (out h2 :nesting [:b1] [:b3])))
  (is "an older point still finds it by its old name" (= 6 (out (ln/goto h2 :basic before) :basic [:b1] [:b3])))
  (is "a taken name is refused" (throws? (fn [] (ln/rename-line h :double "scale"))))
  (is "a bad name is refused" (throws? (fn [] (ln/add-line h "Bad Name")))))

;; release: every line reached, at the point it uses, pinned
(let [pc (ex/piece) r (ln/release pc)]
  (is "release has main, voice and gain" (= #{:main :voice :gain} (set (keys (:lines r)))))
  (is "every reference is pinned" (every? (fn [[_ l]] (every? (fn [[_ _ b]] (:pin b)) (ln/refs-in (ln/line-patch l)))) (:lines r)))
  (is "and sounds the same" (= 113 (out r :main [:b1] [:b5]))))
(let [h (ex/help-patch) r (ln/release (assoc h :main :follow-pin))]
  (is "a line used at two points becomes two" (= #{:follow-pin :scale :scale-v2} (set (keys (:lines r)))))
  (is "follow and pin, released" (and (= 50 (out r :follow-pin [:b1] [:b4])) (= 10 (out r :follow-pin [:b1] [:b5])))))

;; export, import, duplicate
(let [h (ex/help-patch) pc (ex/piece)
      [pc2 k] (ln/import-line pc (ln/export-line h :scale))
      [pc3 k2] (ln/import-line pc2 (ln/export-line h :scale))]
  (is "imported" (= :scale k))
  (is "with its history" (= (ln/depth-of (ln/line h :scale) (ln/front (ln/line h :scale))) (ln/depth-of (ln/line pc2 k) (ln/front (ln/line pc2 k)))))
  (is "renamed when taken" (= :scale-2 k2))
  (is "not an exported line" (throws? (fn [] (ln/import-line pc "{:x 1}"))))
  (let [d (ln/duplicate-line h :scale (:pos (ln/line h :scale)) "scale-copy")]
    (is "duplicate from a point" (= "* 10" (get-in (ln/line-patch (ln/line d :scale-copy)) [:boxes :b2 :text])))))

(let [rs @results bad (remove second rs)]
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first bad)}))
  (let [el (js/document.getElementById "out")]
    (set! (.-textContent el)
          (str (- (count rs) (count bad)) " / " (count rs) " passed\n\n"
               (apply str (for [[w ok] rs] (str (if ok "  ok   " "  FAIL ") w "\n")))))))
