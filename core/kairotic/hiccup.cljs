;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · hiccup: a box whose view is a small HTML document, written as data (issue #146)
;; Sliders, fields, menus, buttons and text, laid out like a web page, for interfaces that would be slow
;; to draw with shapes (kairotic.shapes). The view is hiccup in EDN, never HTML text: before it is kept,
;; and again before it is drawn, it goes through an allowlist of tags, attributes and style properties,
;; and it is built with the DOM (createElement, textContent), never with innerHTML. It carries no code,
;; so it is safe in a shared room without (trust-scripts true), like a tree box.
;;
;;   [:div.row                                       a tag, with classes after dots
;;    [:label "freq " [:input {:type "range" :name "freq" :min 100 :max 1000 :value 440 :out 0}]]
;;    [:span :$freq " Hz"]                           a hole: the value of freq, kept up to date
;;    [:button {:out 1 :send :bang} "go"]]           a click sends :bang out of outlet 1
;;
;; :out o   what the element gives goes out of outlet o (a slider or a number field a number, a checkbox
;;          1 or 0, a menu or a radio its value, a text field its text, a button its :send or a bang)
;; :name n  the element shows the value called n, and what it gives becomes that value: a hole :$n
;;          anywhere in the view shows it too. A map {:freq 220} on the inlet sets values, [:freq 220] one,
;;          as a number sets a knob: shown (a slider within its range) and sent on by the elements named so
;;          that have :out; a bang sends again what they hold.
;;          Let go (a slider) or chosen (a menu, a text entered), the value is kept in the box's data,
;;          (values! :bN {:freq 440}), one event of the history, as a knob keeps its value in its text.
;; :style   a map of the allowed properties: {:gap 8 :color :accent} (numbers are pixels, a palette
;;          colour :ink :soft :accent :kairos :bg :grid follows the light or dark theme)
;;
;; HTML can be pasted too (in the code window or with (code :bN "<div>…</div>")): it is read with the
;; browser's DOMParser, turned into hiccup (data-out and data-send become :out and :send, "$freq" in a
;; text becomes a hole) and goes through the same allowlist. Only the hiccup is kept.

(ns kairotic.hiccup
  (:require [clojure.string :as str]
            [clojure.edn :as edn]
            [kairotic.components :as comp]))

;; ───────── the allowlist ─────────

(def tags #{:div :span :p :label :input :select :option :button :textarea :output
            :h1 :h2 :h3 :h4 :ul :ol :li :br :hr :b :i :em :strong :small :code :pre :sub :sup
            :table :thead :tbody :tr :td :th :fieldset :legend :meter :progress :details :summary})

(def void-tags #{:input :br :hr})

;; every allowed element: :class :title :name :out :send :style :hidden; and these, by tag
(def common-attrs #{:class :title :name :out :send :style :hidden})
(def tag-attrs
  {:input    #{:type :min :max :step :value :placeholder :checked :disabled :size :maxlength}
   :select   #{:value :disabled}
   :option   #{:value :selected :disabled}
   :button   #{:disabled}
   :textarea #{:placeholder :rows :cols :value :disabled :maxlength}
   :meter    #{:min :max :value :low :high :optimum}
   :progress #{:max :value}
   :td       #{:colspan :rowspan}
   :th       #{:colspan :rowspan}
   :ol       #{:start}
   :details  #{:open}})

(def flag-attrs #{:checked :disabled :selected :hidden :open})
(def input-types #{"range" "number" "text" "checkbox" "radio" "color"})

;; style properties: no position, no background images, nothing that loads anything or leaves the box
(def style-props
  #{:color :background-color :border :border-color :border-width :border-style :border-radius
    :font-size :font-weight :font-style :font-family :text-align :text-decoration :line-height :letter-spacing
    :white-space :vertical-align
    :padding :padding-top :padding-right :padding-bottom :padding-left
    :margin :margin-top :margin-right :margin-bottom :margin-left
    :width :height :min-width :max-width :min-height :max-height
    :display :flex :flex-direction :flex-wrap :flex-grow :flex-shrink :flex-basis
    :align-items :align-self :justify-content :gap :row-gap :column-gap
    :grid-template-columns :grid-template-rows :grid-column :grid-row
    :opacity :overflow :accent-color})
(def unitless #{:opacity :flex :flex-grow :flex-shrink :font-weight :line-height})
(def palette {:ink "var(--ink)" :soft "var(--ink-soft)" :accent "var(--accent)" :kairos "var(--kairos)"
              :bg "var(--box)" :grid "var(--grid)"})

(def max-nodes 400)
(def max-depth 12)
(def max-text 2000)
(def max-attr 200)
(def max-outlets 16)

;; ───────── reading it safely ─────────

(defn hole? [x] (and (keyword? x) (str/starts-with? (name x) "$") (> (count (name x)) 1)))
(defn hole-key [x] (keyword (subs (name x) 1)))

(defn value-name
  "A name for a value (:freq, \"freq\"), as a keyword, or nil if it is not one."
  [x]
  (let [s (cond (keyword? x) (name x) (string? x) x :else nil)]
    (when (and s (re-matches #"[A-Za-z][A-Za-z0-9_-]{0,40}" s)) (keyword s))))

(defn- css-value
  "A style value written safely, or nil: palette colours, numbers, and short plain words."
  [k v]
  (cond
    (contains? palette v) (palette v)
    (and (number? v) (js/isFinite v)) (if (unitless k) (str v) (str v "px"))
    (string? v) (let [s (str/trim v)]
                  (when (and (<= (count s) 80)
                             (re-matches #"[-#%.,()a-zA-Z0-9 ]*" s)
                             (not (re-find #"(?i)url|expression|image|attr|src|import" s)))
                    s))
    (keyword? v) (css-value k (name v))
    :else nil))

(defn- clean-style [m]
  (when (map? m)
    (not-empty (into (sorted-map) (for [[k v] m :let [k (keyword k)] :when (style-props k)
                                        :let [s (css-value k v)] :when (some? s)]
                                    [k (if (or (contains? palette v) (number? v)) v s)])))))

(defn- clean-classes [x]
  (let [words (cond (string? x) (str/split (str/trim x) #"\s+")
                    (keyword? x) [(name x)]
                    (sequential? x) (map (fn [w] (if (keyword? w) (name w) (str w))) x)
                    :else [])]
    (not-empty (str/join " " (filter (fn [w] (re-matches #"[A-Za-z][A-Za-z0-9_-]{0,30}" w)) words)))))

(defn- scalar? [v] (or (string? v) (number? v) (boolean? v) (keyword? v)))

(defn- clean-send [v]
  (cond (and (string? v) (<= (count v) max-attr)) v
        (and (number? v) (js/isFinite v)) v
        (or (keyword? v) (boolean? v)) v
        (and (vector? v) (<= (count v) 16) (every? (fn [x] (and (scalar? x) (not (and (string? x) (> (count x) max-attr))))) v)) v
        :else nil))

(defn- clean-attr [tag k v]
  (case k
    :class (clean-classes v)
    :style (clean-style v)
    :name (value-name v)
    :out (when (and (integer? v) (<= 0 v) (< v max-outlets)) v)
    :send (clean-send v)
    :type (when (contains? input-types (str (if (keyword? v) (name v) v))) (str (if (keyword? v) (name v) v)))
    (cond
      (flag-attrs k) (when (or (true? v) (hole? v) (= v "") (= v (name k))) (if (hole? v) v true))
      (hole? v) v
      (and (number? v) (js/isFinite v)) v
      (and (string? v) (<= (count v) max-attr)) v
      (keyword? v) (name v)
      :else nil)))

(defn- clean-attrs [tag m classes]
  (let [allowed (into common-attrs (get tag-attrs tag))
        m (if (map? m) m {})
        m (if (seq classes) (update m :class (fn [c] (str/join " " (remove str/blank? (concat classes [(clean-classes c)]))))) m)]
    (into (sorted-map)
          (for [[k v] m :let [k (keyword k)
                              ;; pasted HTML spells them data-out and data-send
                              k (get {:data-out :out :data-send :send :data-name :name} k k)]
                :when (allowed k)
                :let [c (clean-attr tag k v)] :when (some? c)]
            [k c]))))

(defn- split-tag
  "A tag keyword with classes after dots (:div.row.big) → [:div [\"row\" \"big\"]]."
  [kw]
  (let [[t & cs] (str/split (name kw) #"\.")]
    [(keyword (str/lower-case t)) (vec (remove str/blank? cs))]))

(defn sanitize
  "Hiccup made safe: what is not allowed is dropped (a tag with everything inside it, an attribute, a
   style property). Returns {:view hiccup-or-nil :dropped [\"…\" …]}."
  [x]
  (let [budget (atom max-nodes) dropped (atom [])
        drop! (fn [what] (when (< (count @dropped) 12) (swap! dropped conj what)) nil)
        node (fn node [x depth]
               (cond
                 (<= @budget 0) (drop! "more than 400 elements")
                 (> depth max-depth) (drop! "more than 12 levels deep")
                 (string? x) (subs x 0 (min (count x) max-text))
                 (and (number? x) (js/isFinite x)) (str x)
                 (hole? x) x
                 (and (vector? x) (keyword? (first x)))
                 (let [[tag classes] (split-tag (first x))
                       [attrs kids] (if (map? (second x)) [(second x) (drop 2 x)] [{} (rest x)])]
                   (if-not (tags tag)
                     (drop! (str "<" (name tag) ">"))
                     (do (swap! budget dec)
                         (doseq [k (keys attrs) :let [k (keyword k) k (get {:data-out :out :data-send :send :data-name :name} k k)]
                                 :when (not (contains? (into common-attrs (get tag-attrs tag)) k))]
                           (drop! (str (name tag) " " (name k))))
                         (let [a (clean-attrs tag attrs classes)
                               cs (if (void-tags tag) [] (vec (keep (fn [c] (node c (inc depth))) (mapcat (fn [c] (if (and (sequential? c) (not (and (vector? c) (keyword? (first c))))) c [c])) kids))))]
                           (into (if (seq a) [tag a] [tag]) cs)))))
                 (nil? x) nil
                 :else (drop! (str "a " (cond (map? x) "map" (sequential? x) "list" :else (str (type x))) " outside an element"))))]
    {:view (let [v (node x 0)] (when (vector? v) v)) :dropped @dropped}))

(defn clean
  "The safe form of a view, or nil."
  [x]
  (:view (sanitize x)))

;; ───────── HTML → hiccup (in the browser) ─────────

(defn- text-parts [s]
  (vec (remove nil? (let [ps (str/split s #"\$[A-Za-z][A-Za-z0-9_-]*" -1)
                          hs (mapv (fn [m] (keyword m)) (re-seq #"\$[A-Za-z][A-Za-z0-9_-]*" s))]
                      (concat (mapcat (fn [i p] (cond-> (if (= p "") [] [p]) (< i (count hs)) (conj (nth hs i))))
                                      (range) ps))))))

(defn- read-scalar
  "An attribute of pasted HTML: a number, a :keyword, a $hole, or the text."
  [s]
  (cond (re-matches #"-?\d+(\.\d+)?" s) (js/parseFloat s)
        (re-matches #":[A-Za-z][A-Za-z0-9_-]*" s) (keyword (subs s 1))
        (re-matches #"\$[A-Za-z][A-Za-z0-9_-]*" s) (keyword s)
        :else s))

(defn- parse-style [s]
  (into {} (for [decl (str/split (str s) #";")
                 :let [[k v] (map str/trim (str/split decl #":" 2))]
                 :when (and (seq k) (seq v))]
             [(keyword (str/lower-case k)) (if (re-matches #"-?\d+(\.\d+)?px" v) (js/parseFloat v) v)])))

(defn- dom->hiccup [n]
  (case (.-nodeType n)
    3 (let [t (.-textContent n)] (when-not (str/blank? t) (text-parts (str/replace t #"\s+" " "))))
    1 (let [tag (keyword (str/lower-case (.-tagName n)))
            attrs (into {} (for [a (array-seq (.-attributes n))
                                 :let [k (keyword (str/lower-case (.-name a))) v (.-value a)]]
                             [k (case k
                                  :style (parse-style v)
                                  (:checked :disabled :selected :hidden :open) true
                                  (:class :title :placeholder :type) v
                                  (read-scalar v))]))
            kids (vec (mapcat (fn [c] (let [h (dom->hiccup c)]
                                        (cond (nil? h) [] (and (vector? h) (keyword? (first h))) [h] :else h)))
                              (array-seq (.-childNodes n))))]
        (into (if (seq attrs) [tag attrs] [tag]) kids))
    nil))

(defn html->hiccup
  "HTML text → hiccup (not yet made safe: `sanitize` does that). Several elements are wrapped in a div."
  [text]
  (let [doc (.parseFromString (js/DOMParser.) (str text) "text/html")
        kids (vec (mapcat (fn [c] (let [h (dom->hiccup c)]
                                    (cond (nil? h) [] (and (vector? h) (keyword? (first h))) [h] :else h)))
                          (array-seq (.. doc -body -childNodes))))]
    (if (and (= 1 (count kids)) (vector? (first kids))) (first kids) (into [:div] kids))))

(defn read-view
  "The text of a view (EDN hiccup, or HTML when it starts with <) → safe hiccup. Throws with a reason."
  [text]
  (let [s (str/trim (str text))
        raw (cond (str/blank? s) (throw (js/Error. "the view is empty: [:div …]"))
                  (str/starts-with? s "<") (if (some? (.-DOMParser js/globalThis))
                                             (html->hiccup s)
                                             (throw (js/Error. "HTML can only be read in a browser")))
                  :else (try (edn/read-string s)
                             (catch :default e (throw (js/Error. (str "That is not EDN: " (.-message e)))))))
        {:keys [view]} (when (and (vector? raw) (keyword? (first raw))) (sanitize raw))]
    (if view view (throw (js/Error. "a view is an element of hiccup: [:div …] (or HTML)")))))

;; ───────── writing it ─────────

(defn- element? [x] (and (vector? x) (keyword? (first x))))

(defn pp
  "The view as text, one element per line where it holds other elements."
  ([h] (pp h 0))
  ([h indent]
   (let [[tag & more] h
         [attrs kids] (if (map? (first more)) [(first more) (rest more)] [nil more])
         head (str "[" (pr-str tag) (when (seq attrs) (str " " (pr-str attrs))))]
     (if (some element? kids)
       (let [pad (apply str (repeat (inc indent) " "))]
         (str head (apply str (map (fn [k] (str "\n" pad (if (element? k) (pp k (inc indent)) (pr-str k)))) kids)) "]"))
       (str head (apply str (map (fn [k] (str " " (pr-str k))) kids)) "]")))))

(defn outlets
  "How many outlets a view asks for: one more than its highest :out (at least one)."
  [h]
  (let [os (keep (fn [x] (when (map? x) (:out x))) (tree-seq sequential? seq h))]
    (if (seq os) (inc (apply max os)) 1)))

;; ───────── the box ─────────

(def default-view
  [:div {:class "col"}
   [:label "freq " [:input {:type "range" :name "freq" :min 100 :max 1000 :step 1 :value 440 :out 0}]]
   [:div {:class "row"} [:output :$freq " Hz"] [:button {:out 1 :send :bang} "go"]]])

(defn view-of
  "The (safe) view a box shows: what it keeps, made safe again (it may come from a room or a link)."
  [data]
  (or (clean (:view data)) default-view))

;; The values its named elements hold are kept in its data, as a knob keeps its value in its text: when a
;; slider is let go, a menu chosen, a text entered, (values! :bN {:freq 440}) writes them as one event of the
;; history, so they travel with the work and going back in the history brings back the ones it had.

(def max-values 64)

(defn- value-ok? [v]
  (or (nil? v) (boolean? v) (keyword? v)
      (and (number? v) (js/isFinite v))
      (and (string? v) (<= (count v) max-text))))

(defn clean-values
  "The values of a map that can be kept: named by a word, scalars (a text up to 2000 characters), 64 at most."
  [m]
  (if (map? m)
    (into (sorted-map) (take max-values (for [[k v] m :let [k (value-name k)] :when (and k (value-ok? v))] [k v])))
    (sorted-map)))

(defn- with-values [d vs] (if (seq vs) (assoc d :values vs) (dissoc d :values)))

(def model
  {:empty {:view default-view}
   :step (fn step [d [op x]]
           (case op
             :set (if-let [v (clean x)] (assoc d :view v) d)
             ;; the values its elements hold, merged into the ones it keeps (nil forgets one)
             :values (let [vs (clean-values x)
                           kept (reduce (fn [acc [k v]] (if (nil? v) (dissoc acc k) (assoc acc k v)))
                                        (clean-values (:values d)) vs)]
                       (with-values d kept))
             ;; what :diff returns arrives as one [:batch [ev …]]
             :batch (if (sequential? x) (reduce step d (filter vector? x)) d)
             d))
   :load (fn [x] (with-values {:view (or (and (map? x) (clean (:view x))) default-view)}
                   (when (map? x) (into (sorted-map) (remove (fn [[_ v]] (nil? v)) (clean-values (:values x)))))))
   :code (fn [id d] (cond-> [(str "(code " id " " (pr-str (pp (view-of d))) ")")]
                      (seq (:values d)) (conj (str "(values! " id " " (pr-str (clean-values (:values d))) ")"))))
   :source (fn [d] (pp (view-of d)))
   :read (fn [_ text] {:view (read-view text)})
   :diff (fn [d d2] (if (= (view-of d) (:view d2)) [] [[:set (:view d2)]]))})

(defn current-values
  "The values a box shows: what its elements did since its data last changed, or else what its data keeps
   (the page forgets what they did when the data changes: going back in the history, someone else's change)."
  [data state]
  (let [kept (clean-values (:values data))]
    (if (map? (:values state)) (merge kept (:values state)) kept)))

(defn defaults-of
  "The value each named element of a view starts with (its own :value)."
  [h]
  (reduce (fn [acc x]
            (let [a (when (element? x) (second x))]
              (if (and (map? a) (:name a) (some? (:value a)) (not (hole? (:value a))) (not (contains? acc (:name a))))
                (assoc acc (:name a) (:value a))
                acc)))
          {} (tree-seq sequential? seq h)))

(defn- set-values [vals m]
  (reduce (fn [acc [k v]] (if-let [k (value-name k)] (if (value-ok? v) (assoc acc k v) acc) acc)) vals m))

(defn ui-message?
  "What an element of the view sends its own box: [:ui outlet value name] (outlet or name may be nil)."
  [v]
  (and (vector? v) (= 4 (count v)) (= :ui (first v))))

(defn named-outlets
  "The named elements of a view that send out of an outlet: name → [{:out o :min lo :max hi} …] (a slider's or a
   number field's own range, to keep a value within it)."
  [h]
  (reduce (fn [acc x]
            (if (and (element? x) (map? (second x)) (:name (second x)) (some? (:out (second x))))
              (let [a (second x) num? (and (= :input (first x)) (#{"range" "number"} (:type a)))]
                (update acc (:name a) (fnil conj [])
                        {:out (:out a) :min (when (and num? (number? (:min a))) (:min a))
                         :max (when (and num? (number? (:max a))) (:max a))}))
              acc))
          {} (tree-seq sequential? seq h)))

(defn- within [v {:keys [min max]}]
  (if (number? v) (cond-> v (number? min) (js/Math.max min) (number? max) (js/Math.min max)) v))

(defn- sends-of
  "What values that arrive on the inlet send on, as a knob does: each one out of the outlets of the elements
   named so (within their range), outlets in order."
  [view vals ks]
  (let [no (named-outlets view)]
    (vec (sort-by first (for [k ks :let [v (get vals k)] :when (some? v) t (get no k)] [(:out t) (within v t)])))))

(defn receive [{:keys [value state data]}]
  (let [vals (current-values data state)
        view (view-of data)
        st (fn [vs] (assoc (or state {}) :values vs))
        ;; values from the inlet: set (a slider within its range), shown, and sent on (a knob does the same)
        arrive (fn [m]
                 (let [no (named-outlets view)
                       m (into {} (for [[k v] (set-values {} m)] [k (if-let [t (first (get no k))] (within v t) v)]))
                       vals (merge vals m)]
                   {:state (st vals) :show vals :out (sends-of view vals (keys m))}))]
    (cond
      (ui-message? value)
      (let [[_ o v nm] value
            vals (if-let [k (value-name nm)] (if (value-ok? v) (assoc vals k v) vals) vals)]
        {:state (st vals) :show vals
         :out (if (and (integer? o) (<= 0 o) (< o max-outlets)) [[o v]] [])})
      (map? value) (arrive value)
      (and (vector? value) (= 2 (count value)) (value-name (first value))) (arrive [value])
      ;; a bang sends again what every named element holds
      (= value :bang) {:show vals :out (sends-of view (merge (defaults-of view) vals) (keys (named-outlets view)))}
      :else {:show vals})))

(comp/define! "html"
  {:doc "A small interface written as hiccup (HTML as EDN data): sliders, fields, menus, buttons and text, laid out like a page. An element with :out sends what it gives out of that outlet; one with :name keeps it as a value, shown by every hole :$name in the view, and when it is let go (a slider) or chosen (a menu, a text entered) the box keeps it in the work, as a knob keeps its value: (values! :bN {:freq 440}). A map on the inlet ({:freq 220}) sets values, as a number sets a knob: the elements named so show it (a slider within its range) and those with :out send it on; a bang sends again what they hold. What is not allowed (scripts, links, images, positions, unknown tags or attributes) is dropped, so it is safe in a shared room. Its view opens as text from { } (HTML can be pasted there too)."
   :usage "html"
   :license "MPL-2.0"
   :display :html
   :model model
   :dynamic-io true
   :io (fn [box] [1 (outlets (view-of (:data box)))])
   :receive receive
   :help {:inlets ["a map of values {:freq 220}, or one [:freq 220]: the elements named so and the holes :$freq show them, and the named elements with :out send them on (a slider within its range); a bang sends again what they hold"]
          :outlets ["what each element with :out 0 gives" "… :out 1, and so on: as many outlets as the view asks for"]
          :messages [["{:freq 220}" "sets values: the elements named so show them and send them on"] ["[:freq 220]" "sets one value"] ["bang" "sends again what every named element with :out holds"]]
          :example "(box :b1 \"html\" 40 30)\n(box :b2 \"print\" 40 230)\n(box :b3 \"print\" 200 230)\n(connect :b1 0 :b2 0)\n(connect :b1 1 :b3 0)"
          :try "Move the slider: its value goes out of the left outlet and shows beside it; let it go and the box keeps it, as a knob does (back in the history, it moves back). { } in the header opens the view as text: change it and apply."
          :see ["number" "knob" "msg"]}})

;; ───────── drawing it (in the browser) ─────────
;; build returns {:node el :live [[el kind key default] …] :binds [{:out :send :name :type} …] :defaults {name value}}:
;; the holes and the named elements to update when the values change, what each element with :out or :name
;; sends, and the value each named element starts with (its own :value).

(def base-css
  (str ":host{display:block;width:100%;height:100%;overflow:auto;box-sizing:border-box;padding:6px 8px;"
       "font:12px/1.4 var(--f-ui, sans-serif);color:var(--ink);user-select:text;-webkit-user-select:text;touch-action:manipulation;}"
       "*{box-sizing:border-box;}"
       ".row{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px;}"
       ".col{display:flex;flex-direction:column;gap:6px;}"
       ".grid{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;}"
       ".soft{color:var(--ink-soft);}.accent{color:var(--accent);}.kairos{color:var(--kairos);}"
       "h1,h2,h3,h4{font-family:var(--f-head, sans-serif);margin:0 0 4px;font-weight:600;}"
       "h1{font-size:18px;}h2{font-size:15px;}h3{font-size:13px;}h4{font-size:12px;}"
       "p{margin:0 0 4px;}ul,ol{margin:0;padding-left:18px;}code,pre{font-family:var(--f-code, monospace);font-size:11px;}"
       "input,select,textarea,button{font:inherit;color:var(--ink);accent-color:var(--accent);}"
       "input[type=text],input[type=number],select,textarea{background:var(--box);border:1px solid var(--rule);border-radius:3px;padding:2px 4px;}"
       "input[type=range]{vertical-align:middle;}"
       "button{background:color-mix(in srgb, var(--accent) 12%, var(--box));border:1px solid var(--rule);border-radius:3px;padding:2px 10px;cursor:pointer;}"
       "button:active{background:var(--accent-soft);}"
       "table{border-collapse:collapse;}td,th{padding:2px 6px;border-bottom:1px solid var(--grid);text-align:left;}"
       "output{font-family:var(--f-code, monospace);}"))

(defn shown-str [v]
  (cond (nil? v) "" (string? v) v (keyword? v) (name v)
        (number? v) (str (if (integer? v) v (/ (js/Math.round (* v 1000)) 1000))) :else (pr-str v)))

(defn- set-prop!
  "An attribute (or the property that shows it) on el."
  [el tag k v]
  (cond
    (flag-attrs k) (let [on (boolean (if (number? v) (pos? v) v))]
                     (case k
                       :checked (set! (.-checked el) on)
                       :selected (set! (.-selected el) on)
                       (if on (.setAttribute el (name k) "") (.removeAttribute el (name k)))))
    (and (= k :value) (#{:input :textarea :select :meter :progress} tag)) (set! (.-value el) (shown-str v))
    :else (.setAttribute el (name k) (shown-str v))))

(defn build
  "The DOM of a safe view, with the values in `vals` (a map keyword → value)."
  [h vals]
  (let [live (atom []) binds (atom []) defaults (atom {})
        mk (fn mk [x]
             (cond
               (string? x) (js/document.createTextNode x)
               (hole? x) (let [t (js/document.createTextNode (shown-str (get vals (hole-key x))))]
                           (swap! live conj [t :text (hole-key x) nil]) t)
               (element? x)
               (let [[tag & more] x
                     [attrs kids] (if (map? (first more)) [(first more) (rest more)] [{} more])
                     el (js/document.createElement (name tag))
                     nm (:name attrs)]
                 ;; its type first and its value last (a slider's value is kept within its min and max)
                 (doseq [[k v] (sort-by (fn [[k]] (case k :type 0 :value 2 1)) attrs)
                         :when (not (#{:out :send :name :style} k))]
                   (if (hole? v)
                     (do (set-prop! el tag k (get vals (hole-key v))) (swap! live conj [el [:attr tag k] (hole-key v) nil]))
                     (set-prop! el tag k v)))
                 (when-let [st (:style attrs)]
                   (doseq [[k v] st :let [s (css-value k v)] :when s] (.setProperty (.-style el) (name k) s)))
                 (when nm (.setAttribute el "name" (name nm)))
                 (when (or (some? (:out attrs)) nm)
                   (set! (.. el -dataset -k) (str (count @binds)))
                   (swap! binds conj {:out (:out attrs) :send (:send attrs) :name nm :tag tag :type (:type attrs)}))
                 ;; a named element shows the value of its name (its own :value until it has one)
                 (when (and nm (#{:input :select :textarea :meter :progress :output} tag))
                   (when (and (some? (:value attrs)) (not (hole? (:value attrs))) (not (contains? @defaults nm)))
                     (swap! defaults assoc nm (:value attrs)))
                   (swap! live conj [el [:control tag (:type attrs)] nm (:value attrs)]))
                 (doseq [k kids :let [c (mk k)] :when c] (.appendChild el c))
                 ;; a menu chooses its value once its options are in it
                 (when (and (= tag :select) (some? (:value attrs)) (not (hole? (:value attrs))))
                   (set! (.-value el) (shown-str (:value attrs))))
                 el)
               :else nil))
        node (mk h)]
    {:node node :live @live :binds @binds :defaults @defaults}))

(defn- number-or [s]
  (let [n (js/parseFloat s)] (if (and (js/isFinite n) (re-matches #"\s*-?\d*\.?\d+(e-?\d+)?\s*" (str s))) n s)))

(defn refresh!
  "Shows the values `vals` in a built view; `skip` is an element being used (its value is not touched)."
  [{:keys [live]} vals skip]
  (doseq [[el kind k dflt] live :let [has? (contains? vals k) v (get vals k)]]
    (cond
      (= kind :text) (let [s (shown-str v)] (when (not= s (.-textContent el)) (set! (.-textContent el) s)))
      (= (first kind) :attr) (let [[_ tag a] kind] (set-prop! el tag a v))
      (= (first kind) :control)
      (when (and has? (not (identical? el skip)))
        (let [[_ tag typ] kind]
          (cond
            (= typ "checkbox") (set! (.-checked el) (boolean (if (number? v) (pos? v) v)))
            (= typ "radio") (set! (.-checked el) (= (shown-str v) (.-value el)))
            (= tag :output) (set! (.-textContent el) (shown-str v))
            :else (let [s (shown-str v)] (when (not= s (.-value el)) (set! (.-value el) s)))))))))

(defn element-value
  "What an element with :out or :name gives when it is used: [value commit?] for this event, or nil."
  [el bind ev-type]
  (let [{:keys [tag type send]} bind]
    (case tag
      :button (when (= ev-type "click") [(if (some? send) send :bang) true])
      :input (case type
               "checkbox" (when (= ev-type "change") [(if (some? send) (if (.-checked el) send 0) (if (.-checked el) 1 0)) true])
               "radio" (when (and (= ev-type "change") (.-checked el)) [(number-or (.-value el)) true])
               ("range" "number") (let [n (js/parseFloat (.-value el))]
                                    (when (js/isFinite n) (case ev-type "input" [n false] "change" [n true] nil)))
               "color" (case ev-type "input" [(.-value el) false] "change" [(.-value el) true] nil)
               ;; text: on Enter or when it is left
               (when (= ev-type "change") [(.-value el) true]))
      :select (when (= ev-type "change") [(number-or (.-value el)) true])
      :textarea (when (= ev-type "change") [(.-value el) true])
      nil)))
