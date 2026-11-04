;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · page · html boxes (issue #146)
;; Loaded right after 05-gestures (app/index.html), not last: the startup (11) already draws the patch,
;; and the scene calls these.
;; An html box draws a small HTML document (kairotic.hiccup) inside the patch: a foreignObject in the
;; box, holding an element of its own with a shadow root, so its styles stay inside and the page's stay
;; out. The scene is written again with innerHTML on every change, so each html box keeps its element
;; here (by engine id) and it is put back into its slot after the scene is written, like the notation of
;; a score: what is typed or dragged in it is not lost. It is only built again when its view changes.
;;
;; Using an element sends the box [:ui outlet value name], a message (messages are not events of the
;; history): while a slider moves quietly (here and to a jam), as a control does while it is dragged;
;; when it is let go, a menu is chosen, a text is entered or a button is clicked, as a gesture written in
;; the REPL, (send! :bN [:ui …]), as a control does when it is let go.

(defonce html-nodes (atom {}))   ; engine id → {:id :view :host :root :built}
(defonce html-focus (atom nil))  ; {:f :i :start :end}: the element that had the focus before the scene was written

(defn html-slot-svg
  "The slot of an html box, under its header: its element is put in it after the scene is written."
  [id b w h]
  (str "<foreignObject class=\"html-slot\" data-box=\"" (esc (name id)) "\" x=\"2\" y=\"" hdr
       "\" width=\"" (max 0 (- w 4)) "\" height=\"" (max 0 (- h hdr 3)) "\"></foreignObject>"))

(defn html-values
  "The values an html box shows: the ones its elements start with, what it last showed, what it keeps."
  [f e]
  (let [shown (second (shown-flat f)) st (get-in @eng/rt [:states f :values])]
    (merge (get-in e [:built :defaults]) (when (map? shown) shown) (when (map? st) st))))

(defn html-update!
  "Shows the current values in the html box with engine id f (not in the element being used)."
  [f]
  (when-let [e (get @html-nodes f)]
    (try (hic/refresh! (:built e) (html-values f e) (.-activeElement (:root e)))
         (catch :default ex (js/console.error "html box" ex)))))

(defn refresh-html-boxes! [] (doseq [f (keys @html-nodes)] (html-update! f)))

(defn html-event!
  "An element of an html box was used: what it gives goes to the box."
  [f ev]
  (when-let [e (get @html-nodes f)]
    (let [el (some-> (.-target ev) (.closest "[data-k]"))
          k (some-> el .-dataset .-k js/parseInt)
          bind (when (and k (js/isFinite k)) (get-in e [:built :binds k]))]
      (when bind
        (when-let [[v commit?] (hic/element-value el bind (.-type ev))]
          (let [msg [:ui (:out bind) v (:name bind)]]
            (if commit?
              (gesture! (str "(send! " (:id e) " " (pr-str msg) ")"))
              (send-flat-quiet! f msg))))))))

(defn html-make!
  "Builds the element of an html box (engine id f, id in the view) for its view."
  [f id view]
  (let [host (js/document.createElement "div")
        root (.attachShadow host #js {:mode "open"})
        style (js/document.createElement "style")
        built (hic/build view {})]
    (set! (.-className host) "html-host")
    (set! (.-textContent style) hic/base-css)
    (.appendChild root style)
    (when (:node built) (.appendChild root (:node built)))
    ;; what is pressed or typed in it is its own: the patch does not move the box, select it or play
    (doseq [t ["pointerdown" "mousedown" "touchstart" "dblclick" "contextmenu" "keydown" "keyup"]]
      (.addEventListener host t (fn [ev] (.stopPropagation ev))))
    (doseq [t ["input" "change" "click"]]
      (.addEventListener root t (fn [ev] (html-event! f ev))))
    (let [e {:id id :view view :host host :root root :built built}]
      (swap! html-nodes assoc f e)
      e)))

(defn html-save-focus!
  "Before the scene is written: which element of an html box has the focus (and where its text cursor is)."
  []
  (reset! html-focus
          (some (fn [[f e]]
                  (when-let [a (.-activeElement (:root e))]
                    (let [all (vec (array-seq (.querySelectorAll (:root e) "*")))
                          i (first (keep-indexed (fn [i x] (when (identical? x a) i)) all))]
                      (when i {:f f :i i
                               :start (try (.-selectionStart a) (catch :default _ nil))
                               :end (try (.-selectionEnd a) (catch :default _ nil))}))))
                @html-nodes)))

(defn mount-html-slots!
  "After the scene is written: each html box gets its element back (built again only if its view changed)."
  []
  (let [seen (atom #{})]
    (doseq [slot (array-seq (.querySelectorAll ($ "scene") ".html-slot"))]
      (let [id (keyword (.. slot -dataset -box)) b (get-in (current) [:boxes id])]
        (when b
          (let [f (fid id) view (hic/view-of (:data b)) old (get @html-nodes f)
                e (if (and old (= view (:view old)))
                    (do (swap! html-nodes assoc-in [f :id] id) old)
                    (html-make! f id view))]
            (swap! seen conj f)
            (.appendChild slot (:host e))))))
    ;; the element that had the focus gets it back
    (when-let [{:keys [f i start end]} @html-focus]
      (when-let [e (get @html-nodes f)]
        (when-let [el (nth (vec (array-seq (.querySelectorAll (:root e) "*"))) i nil)]
          (try (.focus el #js {:preventScroll true})
               (when (and (number? start) (number? end)) (.setSelectionRange el start end))
               (catch :default _ nil)))))
    (reset! html-focus nil)
    ;; the elements of boxes no longer drawn are forgotten (they are built again if they come back)
    (swap! html-nodes select-keys @seen)))

;; A message can reach an html box while nothing draws the overlay (the engine stopped, a msg clicked
;; elsewhere): when the state the engine keeps for one of them changes, they are refreshed, once a frame.
(defonce html-frame (atom false))
(defonce html-watch
  (add-watch eng/rt ::html
             (fn [_ _ old new]
               (when (and (not @html-frame) (seq @html-nodes)
                          (some (fn [f] (not (identical? (get-in old [:states f]) (get-in new [:states f])))) (keys @html-nodes)))
                 (reset! html-frame true)
                 (js/requestAnimationFrame (fn [_] (reset! html-frame false) (refresh-html-boxes!)))))))
