;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · assistant
;; Writing components with Claude, inside the work. The page asks Claude (claude.ai's `sample`
;; capability, on the viewer's own Claude account) with a prompt built here: the component contract,
;; the Kairotic API, real components as examples and the classes the work already has. While it
;; writes, Claude can call the page's tools defined here to check what it wrote — evaluate and
;; validate it, send it messages, draw its view — so what arrives in the work has been tried.
;; The result is an ordinary component box, created as gestures, in the history like any other.

(ns kairotic.assistant
  (:require [clojure.string :as str]
            [clojure.walk :as walk]
            [kairotic.components :as comp]
            [kairotic.shapes :as shp]
            [kairotic.library :as lib]))

;; ───────── evaluating a source ─────────

(defn evaluate
  "{:ok definition} or {:error reason} for a component source (one expression)."
  [source]
  (try
    (let [m (js/scittle.core.eval_string (str "(do " source "\n)"))]
      (cond
        (lib/package? m) {:error "write one component, not a package"}
        :else (if-let [reason (lib/validate m)] {:error reason} {:ok m})))
    (catch :default e {:error (str "does not evaluate: " (or (.-message e) e))})))

(defn read-edn
  "A value written as EDN by Claude (messages, a shown value)."
  [s]
  (when (and (string? s) (seq (str/trim s)))
    (js/scittle.core.eval_string (str "(quote " s ")"))))

(defn cut [s n] (let [s (str s)] (if (> (count s) n) (str (subs s 0 n) " …") s)))

(defn box-text [m args-text]
  (str (:class m) (when (seq (str/trim (str args-text))) (str " " (str/trim args-text)))))

;; ───────── the tools ─────────

(defn check
  "What a source defines, or why it does not work."
  [source]
  (let [{:keys [ok error]} (evaluate source)]
    (if error
      {:ok false :error error}
      (let [m ok io (:io m)]
        {:ok true :class (:class m)
         :io (if (fn? io) "computed" io)
         :args (when (sequential? (:args m)) (pr-str (:args m)))
         :view (cond (:view m) "view template" (:draw m) "draw function" :else "text box")
         :gesture (boolean (:gesture m)) :persist (boolean (:persist m))
         :audio (when (map? (:audio m)) (vec (map name (keys (:audio m)))))
         :core-class-clash (= :core (:origin (comp/lookup (:class m))))}))))

(defn try-receive
  "Sends messages ([[inlet value] …], as EDN) to the component, one after another, threading its
   state as the engine does. args-text: the words after the class in the box text."
  [source args-text messages]
  (let [{:keys [ok error]} (evaluate source)]
    (cond
      error {:ok false :error error}
      (not (fn? (:receive ok))) {:ok false :error "it has no :receive"}
      :else
      (let [m ok text (box-text m args-text) args (comp/args-for m text)
            msgs (try (read-edn messages) (catch :default e (throw (js/Error. (str "messages are not EDN: " (.-message e))))))]
        (when-not (sequential? msgs) (throw (js/Error. "messages: a vector of [inlet value], e.g. [[0 440] [0 :bang]]")))
        (loop [state nil [[inlet value] & more] (seq msgs) acc [] t 0]
          (if (nil? inlet)
            {:ok true :box-text text :args (pr-str args) :results acc}
            (let [r (try ((:receive m) {:id :b1 :state state :args args :inlet inlet :value value :at t :data nil})
                         (catch :default e {::error (or (.-message e) (str e))}))]
              (if-let [err (::error r)]
                {:ok false :box-text text :results (conj acc {:in (pr-str [inlet value]) :error err})}
                (recur (if (and (map? r) (contains? r :state)) (:state r) state) more
                       (conj acc {:in (pr-str [inlet value])
                                  :result (cut (pr-str (select-keys r [:out :show :effects :later :state])) 600)})
                       (+ t 0.1))))))))))

(def shape-kinds #{:rect :circle :line :arc :needle :path :text})

(defn holes [template]
  (let [acc (atom #{})]
    (walk/postwalk (fn [x] (when-let [k (shp/hole x)] (swap! acc conj k)) x) template)
    @acc))

(defn try-view
  "Draws the component's view for a shown value (EDN) and the box text, and checks it: shape kinds,
   holes without a value, numbers. With a gesture, also tries one drag and what it would persist."
  [source args-text shown]
  (let [{:keys [ok error]} (evaluate source)]
    (cond
      error {:ok false :error error}
      (not (or (:view ok) (:draw ok))) {:ok true :note "no :view nor :draw: the box is shown as text"}
      :else
      (let [m ok text (box-text m args-text) args (comp/args-for m text)
            [w h] (let [s (:size m)] (if (vector? s) s [80 40]))
            shown (read-edn shown)
            ctx {:shown shown :state nil :args args :text text :data nil :w w :h h}
            derived (when (:derive m) ((:derive m) ctx))
            vals (merge (when (map? args) args) {:shown shown :w w :h h} derived)
            missing (when (:view m) (vec (remove #(contains? vals %) (holes (:view m)))))
            shapes (vec (remove nil? (if (:view m) (shp/fill (:view m) vals) ((:draw m) ctx))))
            bad (vec (keep (fn [s] (when-not (and (vector? s) (shape-kinds (first s)) (map? (second s)))
                                     (cut (pr-str s) 120)))
                           shapes))
            nan (vec (keep (fn [s] (when (some (fn [[_ v]] (and (number? v) (not (js/isFinite v)))) (second s))
                                     (cut (pr-str s) 120)))
                           (filter #(map? (second %)) shapes)))
            gesture (when (:gesture m)
                      (try (let [v ((:gesture m) (assoc ctx :start shown :x (/ w 2) :y (/ h 2) :dx 10 :dy -10 :fine false))]
                             {:value (pr-str v)
                              :persist (when (:persist m) (comp/args-text m (:class m) (merge (comp/args-for m text) ((:persist m) v))))})
                           (catch :default e {:error (or (.-message e) (str e))})))]
        {:ok (and (empty? missing) (empty? bad) (empty? nan) (not (:error gesture)))
         :size [w h] :shapes (count shapes)
         :holes-without-value missing :not-shapes bad :non-finite-numbers nan
         :drawn (cut (pr-str shapes) 1500)
         :gesture gesture}))))

(defn classes
  "The classes the work knows now: \"class [in out] — first sentence of its doc\"."
  []
  (vec (for [[k d] (sort-by key @comp/registry)
             :let [io (:io d) doc (first (str/split (str (:doc d)) #"(?<=\.)\s"))]]
         (str k " " (if (vector? io) (pr-str io) "") " — " (cut doc 110) " (" (name (or (:origin d) :core)) ")"))))

;; ───────── the prompt ─────────

(def rules
  "You write one Kairotic component: a box class for a visual patcher of music (like Max/Pd), whose
patch and code are the same work, written in ClojureScript and run with Scittle (SCI, interpreted, no
compiler) in the browser.

What to write: ONE ClojureScript expression that evaluates to the component's definition map. It may
be `(let [helpers …] {…})` to share functions and constants. No `ns`, no `def`/`defn` at top level,
no requires. Available: clojure.core, clojure.string as `str/`, the Kairotic API as `api/` (below),
and JavaScript interop (`js/Math`, Web Audio objects you are given). Do NOT use any other kairotic
namespace (`comp/`, `cv/`, `eng/`…). Never touch the DOM, the network or storage.

Write in English (names, :doc, comments). Keep it small and readable, in sections like the examples:
about (:class :license \"MPL-2.0\" :doc :usage :io), arguments (:args, :persist), logic (:receive,
:gesture), view (:derive, :view as data, :size), audio (:audio). Prefer :view (a data template with
$holes) over :draw. A class name is one word; audio classes end in ~. Do not reuse a core class name.
:receive is pure: it returns data ({:out … :state … :show … :effects … :later …}); side effects on
sound happen only through :audio :effects. Messages are numbers, keywords (:bang), or vectors.

Work method: write the source, then CHECK it with the tools before answering — `check_component`,
then `try_messages` with representative messages, and `try_view` if it has a view. Fix what fails and
check again. Use `list_classes` if you need to know what exists. Keep tool calls few.

Your final answer: one or two sentences saying what the component does and how to use it (inlets,
outlets, arguments), then the complete source in ONE ```clojure fenced block. Nothing after it.")

(defn prompt
  "The whole input for Claude. `change` is the source of an existing component to modify (or nil)."
  [{:keys [request change contract api examples]}]
  (str rules
       "\n\n━━━ The component contract (from kairotic/components.cljs) ━━━\n" contract
       "\n\n━━━ The Kairotic API (kairotic/api.cljs), usable as api/… ━━━\n" api
       "\n\n━━━ Examples of real components ━━━\n"
       (str/join "\n\n" (map (fn [[label src]] (str ";; ── example: " label " ──\n" src)) examples))
       (when change (str "\n\n━━━ The component to change (keep what is not asked to change) ━━━\n" change))
       "\n\n━━━ The request ━━━\n" request "\n"))

(defn header-of
  "The leading comment block of a source file, without the ;; marks (what documents it)."
  [text]
  (->> (str/split-lines (str text))
       (take-while #(str/starts-with? (str/triml %) ";;"))
       (map #(str/replace % #"^\s*;; ?" ""))
       (str/join "\n")))

(defn source-of
  "The last ```clojure (or plain ```) fenced block of an answer."
  [text]
  (let [blocks (re-seq #"```(?:clojure|clj|cljs|edn)?\s*\n([\s\S]*?)```" (str text))]
    (some-> (last blocks) second str/trim)))
