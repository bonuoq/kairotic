;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · assistant
;; Writing components with Claude, inside the work. The page asks Claude (claude.ai's `sample`
;; capability, on the viewer's own Claude account) with a prompt built here: the component contract,
;; the Kairotic API, real components as examples and the classes the work already has. While it
;; writes, Claude can call the page's tools defined here to check what it wrote — evaluate and
;; validate it, send it messages, draw its view — so what arrives in the work has been tried.
;; The result is an ordinary component box, created as gestures, in the history like any other.
;;
;; Study 16: Claude can also write Faust (checked by compiling it), abstractions — components that are
;; a patch, with faust~ boxes, controls and a panel of presented boxes (a bpatcher) — and packages of
;; several components. Real examples come from a catalog (examples/catalog.mjs) that Claude sees as a
;; list and reads one by one with a tool, so it can grow without the prompt growing.

(ns kairotic.assistant
  (:require [clojure.string :as str]
            [clojure.walk :as walk]
            [kairotic.components :as comp]
            [kairotic.shapes :as shp]
            [kairotic.code :as code]
            [kairotic.library :as lib]))

;; ───────── evaluating a source ─────────

(defn evaluate
  "{:ok definition-or-package} or {:error reason} for a component source (one expression)."
  [source]
  (try
    (let [m (js/scittle.core.eval_string (str "(do " source "\n)"))]
      (if-let [reason (lib/validate m)] {:error reason} {:ok m}))
    (catch :default e {:error (str "does not evaluate: " (or (.-message e) e))})))

(defn definition
  "{:ok definition} for class `cls` of a source (a component, or one of a package's), or {:error}."
  [source cls]
  (let [{:keys [ok error]} (evaluate source)]
    (if error
      {:error error}
      (let [defs (lib/definitions ok)
            d (if (seq (str cls)) (first (filter #(= (str cls) (:class %)) defs)) (first defs))]
        (if d {:ok d} {:error (str "no class " cls " in this source (" (str/join ", " (map :class defs)) ")")})))))

(defn read-edn
  "A value written as EDN by Claude (messages, a shown value)."
  [s]
  (when (and (string? s) (seq (str/trim s)))
    (js/scittle.core.eval_string (str "(quote " s ")"))))

(defn cut [s n] (let [s (str s)] (if (> (count s) n) (str (subs s 0 n) " …") s)))

(defn box-text [m args-text]
  (str (:class m) (when (seq (str/trim (str args-text))) (str " " (str/trim args-text)))))

;; ───────── the tools ─────────

(defn describe
  "What one definition is, for Claude."
  [m]
  (let [io (:io m)]
    (cond-> {:class (:class m)
             :kind (if (:patch m) "abstraction" "component")
             :io (if (fn? io) "computed" io)
             :core-class-clash (= :core (:origin (comp/lookup (:class m))))}
      (sequential? (:args m)) (assoc :args (pr-str (:args m)))
      (not (:patch m)) (assoc :view (cond (:view m) "view template" (:draw m) "draw function" :else "text box")
                              :gesture (boolean (:gesture m)) :persist (boolean (:persist m))
                              :audio (when (map? (:audio m)) (vec (map name (keys (:audio m)))))))))

(defn check
  "What a source defines, or why it does not work (synchronous: no Faust inside is compiled)."
  [source]
  (let [{:keys [ok error]} (evaluate source)]
    (if error
      {:ok false :error error}
      (let [defs (lib/definitions ok)]
        (assoc (describe (first defs)) :ok true
               :classes (mapv :class defs)
               :package (:package ok))))))

;; ───────── Faust ─────────

(defn compile-faust
  "Promise of {:ok true :ins :outs :params} or {:ok false :error} for a Faust source, compiled with the
   page's own compiler (the result stays in the cache, so the box that uses it starts at once)."
  [source]
  (if-let [f (get @code/compilers "faust")]
    (-> (js/Promise.resolve nil)
        (.then (fn [_] (f (str source))))
        (.then (fn [r]
                 (swap! code/cache assoc ["faust" (str source)] (assoc r :status :ok :n (swap! code/counter inc)))
                 (let [i (:info r)]
                   {:ok true :ins (:ins i) :outs (:outs i)
                    :params (mapv (fn [p] (select-keys p [:label :type :min :max :init])) (:params i))})))
        (.catch (fn [e] {:ok false :error (cut (or (.-message e) (str e)) 1500)})))
    (js/Promise.resolve {:ok false :error "no Faust compiler in this page"})))

;; ───────── abstractions ─────────

(defn available?
  "Whether class k can be used in a patch: known now, defined next to it, or brought from an official
   package or single component when it is used."
  [k siblings]
  (boolean (or (comp/lookup k) (contains? siblings k) (lib/package-of k) (lib/single-of k))))

(defn check-patch
  "Errors of the :patch of an abstraction (boxes, classes, ports), and what it offers."
  [m siblings]
  (let [p (:patch m) bs (:boxes p) lines (:lines p)
        k-of (fn [b] (comp/klass (str/replace (str (:text b)) #"\$\d" "0")))
        box-errs (for [[id b] bs
                       :let [k (k-of b)]
                       err [(when-not (keyword? id) (str id ": box ids are keywords like :b1"))
                            (when-not (string? (:text b)) (str id ": a box has :text"))
                            (when-not (and (number? (:x b)) (number? (:y b))) (str id ": a box has :x and :y"))
                            (when (and (string? (:text b)) (not (available? k siblings))) (str id ": no class «" k "»"))
                            (when (and (= k "faust~") (str/blank? (str (get-in b [:data :source])))) (str id ": a faust~ needs :data {:source \"…\"}"))]
                       :when err] err)
        io-of (fn [id] (let [b (get bs id)] (when (and b (comp/lookup (k-of b)) (not (comp/dynamic? b)))
                                             (comp/io (update b :text #(str/replace (str %) #"\$\d" "0"))))))
        line-errs (for [l lines
                        :let [[a o b i] (when (and (vector? l) (= 4 (count l))) l)
                              [_ outs] (io-of a) [ins _] (io-of b)]
                        err [(when-not a (str (pr-str l) ": a line is [from outlet to inlet]"))
                             (when (and a (not (get bs a))) (str (pr-str l) ": no box " a))
                             (when (and b (not (get bs b))) (str (pr-str l) ": no box " b))
                             (when (and outs (>= o outs)) (str (pr-str l) ": " a " has " outs " outlets"))
                             (when (and ins (>= i ins)) (str (pr-str l) ": " b " has " ins " inlets"))]
                        :when err] err)
        ports (fn [ks] (count (filter (fn [[_ b]] (ks (k-of b))) bs)))]
    {:errors (vec (concat box-errs line-errs))
     :inlets (ports #{"inlet" "inlet~"}) :outlets (ports #{"outlet" "outlet~"})
     :presented (vec (for [[id b] bs :when (:present b)] (str (name id) " " (:text b))))
     :faust (vec (for [[id b] bs :when (= "faust~" (k-of b))] [id (get-in b [:data :source])]))}))

(defn check-full
  "Promise of the whole check of a source, for Claude and before a result enters the work: it
   evaluates and validates every definition, checks the patch of abstractions and compiles every
   Faust source inside them."
  [source]
  (let [{:keys [ok error]} (evaluate source)]
    (if error
      (js/Promise.resolve {:ok false :error error})
      (let [defs (vec (lib/definitions ok))
            siblings (set (map :class defs))
            patches (into {} (for [d defs :when (map? (:patch d))] [(:class d) (check-patch d siblings)]))
            fausts (for [[cls r] patches [id src] (:faust r)] [cls id src])]
        (-> (js/Promise.all (clj->js (for [[_ _ src] fausts] (compile-faust src))))
            (.then (fn [results]
                     (let [faust-errs (vec (keep (fn [[[cls id _] r]] (when-not (:ok r) (str cls " " (name id) ": Faust: " (:error r))))
                                                 (map vector fausts (js->clj results :keywordize-keys true))))
                           errs (vec (concat (mapcat (fn [[cls r]] (map #(str cls " " %) (:errors r))) patches) faust-errs))]
                       {:ok (empty? errs)
                        :package (:package ok)
                        :definitions (mapv (fn [d] (merge (describe d)
                                                          (when-let [r (get patches (:class d))]
                                                            (select-keys r [:inlets :outlets :presented]))))
                                           defs)
                        :errors errs}))))))))

(defn used-classes
  "The classes that the abstractions of a source use (to bring the official ones into the work)."
  [source]
  (let [{:keys [ok]} (evaluate source)]
    (when ok
      (distinct (for [d (lib/definitions ok) :when (map? (:patch d)) [_ b] (:boxes (:patch d))]
                  (comp/klass (str/replace (str (:text b)) #"\$\d" "0")))))))

(defn try-receive
  "Sends messages ([[inlet value] …], as EDN) to the component, one after another, threading its
   state as the engine does. args-text: the words after the class in the box text."
  [source cls args-text messages]
  (let [{:keys [ok error]} (definition source cls)]
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
  [source cls args-text shown]
  (let [{:keys [ok error]} (definition source cls)]
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
  "You write box classes for Kairotic, a visual patcher of music (like Max/Pd) whose patch and code are
the same work, written in ClojureScript and run with Scittle (SCI, interpreted, no compiler) in the
browser. You may write:

1. A component: ONE ClojureScript expression that evaluates to the definition map. It may be
   `(let [helpers …] {…})`. No `ns`, no top-level `def`/`defn`, no requires. Available: clojure.core,
   clojure.string as `str/`, the Kairotic API as `api/` (below), and JavaScript interop (`js/Math`,
   the Web Audio objects you are given). Do NOT use other kairotic namespaces (`comp/`, `cv/`, `eng/`…).
   Never touch the DOM, the network or storage.
2. An abstraction: a component whose class IS a patch — {:class :doc :usage :patch {:boxes {…} :lines […]}}.
   Boxes: `:b1 {:text \"faust~\" :x 20 :y 140 :data {:source \"…Faust…\"}}`; lines: `[:b1 0 :b4 0]`
   (from-box outlet to-box inlet). Its ports are its `inlet`/`outlet` (messages) and `inlet~`/`outlet~`
   (audio) boxes, numbered left to right by :x. `$1 $2` in box texts take the words of each instance.
   `:present [x y]` on a box puts it on the panel every instance shows (a bpatcher); only boxes with
   their own view act there (knob, adsr~, space~, or components with a :view). Inside, use classes that
   exist (`list_classes`); the official ones adsr~ synth~ pan~ space~ knob fifth drift are brought into
   the work automatically. For audio DSP prefer a `faust~` box with Faust code: its audio ports are
   those of `process`, and its left inlet takes parameters as messages `[:cutoff 800]` — exactly what
   a named knob sends (`knob 40 12000 1200 log cutoff`); a list of Hz sets freq and gate = 1.
3. A package, when you need several definitions together (a control of your own and the abstraction
   that uses it): {:package \"work/<name>\" :version \"0.1.0\" :components [definition …]}.

Write in English (names, :doc, comments). Keep it small and readable, in sections like the examples:
about (:class :license \"MPL-2.0\" :doc :usage :io), arguments (:args, :persist), logic (:receive,
:gesture), view (:derive, :view as data, :size), audio (:audio), help (:help {:inlets [\"one line per inlet\" …]
:outlets […] :try \"something to do with it\"}, shown in the Help tab). Prefer :view (a data template with
$holes) over :draw. A class name is one word; audio classes end in ~. Do not reuse a core class name.
:receive is pure: it returns data ({:out … :state … :show … :effects … :later …}); side effects on
sound happen only through :audio :effects. The same value arriving again must change nothing that is
going on (data boxes send what they hold again after ■ or when the patch before them changes): a player
does not start over, an accumulator does not count it twice — compare with what :state keeps. Messages are numbers, keywords (:bang), strings or vectors.
Faust: `import(\"stdfaust.lib\");`, the standard libraries (os. fi. en. re. ef. si. ba. no. de.),
hslider/button for parameters, `process = …;`. In ClojureScript source the Faust code is a string:
escape its double quotes.
Musical data (notation, composition, CAC) travels as musical trees (kairotic.mt, alias mt/ in sources):
hiccup vectors such as [:voice [:measure {:meter [4 4]} [:note {:pitch \"c4\" :dur 1}] \"d4/.5 e4\"]]
(tags :piece :voice :section :seq :par :measure :tuplet {:ratio [3 2]} :chord :note :rest :param :dyn
:text; any extra key is allowed). A component that makes or changes music sends a tree from :receive;
use mt/events, mt/transpose, mt/pitch-name … rather than your own parsing. See the example notation/walk.

Work method: the catalog below lists real examples; read the ones close to the request with
`read_example` before writing. Write, then CHECK before answering: `check_faust` for Faust code,
`check_component` for the whole source (it also compiles the Faust inside abstractions), then
`try_messages` with representative messages and `try_view` if it has a view. Fix what fails and check
again. Keep tool calls few.

Your final answer: one or two sentences saying what it does and how to use it (inlets, outlets,
arguments), then the complete source in ONE ```clojure fenced block. Nothing after it.")

(defn catalog-text
  "The catalog as Claude sees it: one line per example."
  [examples]
  (str/join "\n" (for [e examples] (str "- " (:name e) " (" (:category e) ", " (:kind e) "): " (:about e)))))

(defn prompt
  "The whole input for Claude. `change` is the source of an existing component to modify (or nil);
   `always` are examples given whole; `examples` the catalog (read with read_example)."
  [{:keys [request change contract api always examples]}]
  (str rules
       "\n\n━━━ The component contract (from kairotic/components.cljs) ━━━\n" contract
       "\n\n━━━ The Kairotic API (kairotic/api.cljs), usable as api/… ━━━\n" api
       "\n\n━━━ Two examples, whole ━━━\n"
       (str/join "\n\n" (map (fn [e] (str ";; ── example: " (:name e) " — " (:about e) " ──\n" (:source e))) always))
       "\n\n━━━ The catalog of examples (read any with read_example) ━━━\n" (catalog-text examples)
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

;; ───────── patches (Study 23) ─────────
;; Claude can also make a whole patch from a description, or change the one that is open. It answers
;; with the patch's code — only the calls a patch is made of, as a link carries it — which the page
;; checks (classes, ports, Faust compiled, components evaluated) and loads as one event of the history.

(def patch-rules
  "You make patches for Kairotic, a visual patcher of music (like Max/Pd) whose patch and code are the
same work. A patch is written as a list of calls, one per line, with LITERAL arguments only (numbers,
strings, keywords, vectors, maps) — no let, def, fn, str, arithmetic or any other form:

  (box :b1 \"osc~ 440\" 40 60)        ; a box: id, text (class and arguments), x, y
  (connect :b1 0 :b2 0)              ; from :b1 outlet 0 to :b2 inlet 0 (numbered from 0, left to right)
  (code :b3 \"…source…\")             ; the source of a code box (faust~, script, component, tree)
  (present :b4 20 20)                ; puts a box on the presentation (the performer's panel), at x y
  (tree! :b5 [:voice \"c4/1 e4 g4/2\"]) ; the musical tree of a tree box
  (stroke :b6 [[0 220] [1 440]]) (axis :b6 :x 0 4)  ; drawings of canvas/freqt boxes

Rules:
- Use only classes that exist (`list_classes`; `class_help` gives the inlets and outlets of one).
  Official classes such as knob, synth~, adsr~, pan~, space~, fifth, drift come into the work by
  themselves when a box uses them.
- Messages flow without ▶; ▶ starts sound and time (metro, ramp, loadbang). Audio classes end in ~.
  Send sound to `dac~ 1 2` (both channels: connect to inlets 0 and 1) through a `gain~` of 0.1–0.3:
  never louder.
- For sound that core classes do not make (FM, filters, effects, physical models…), use a `faust~` box
  with Faust code: `(box :b3 \"faust~\" x y)` and `(code :b3 \"import(\\\"stdfaust.lib\\\"); …process = …;\")`.
  Its audio ports are those of process; its LEFT inlet takes parameters as messages [:name value],
  which is exactly what a named knob sends: `knob 50 2000 300 log carrier` sends [:carrier v] to an
  hslider(\"carrier\", …). Write every parameter as hslider with sensible ranges and a smoothing
  (si.smoo). Call `check_faust` on the Faust code before using it.
- Musical trees (tree boxes, notation): to PLAY one, prefer `tree` → `mt play` → `synth~` (mt play
  sends Hz and voice ids at the tree's tempo once ▶ is on; see class_help). A score or freqt that
  shows a tree is also a buffer: `phasor~` → `reader~` (left) with the score's outlet 1 on its right
  inlet gives the pitch as a signal (Hz), e.g. into a faust~ whose process takes a frequency input.
  A tree box sends its tree by itself: it needs no loadbang.
- `gain~ 0.2` sets its factor as an argument; a message into its right inlet changes it, a signal
  there replaces it. Do not leave a gain waiting for a message nobody sends.
- Lay it out top to bottom, following the signal: x from 20 to 900, about 60 px between rows,
  controls on top. Code boxes are about 330 wide and 200 tall: leave them room.
- Present the controls and displays a performer needs (`present`), in a compact panel.
- When a patch is given to change, keep its boxes, ids and positions unless the request changes them;
  new boxes take new ids (the next numbers).

Work method: `list_classes` first if unsure; `check_faust` for each Faust source; then `check_patch`
with the WHOLE code, fix what it reports and check again. Keep tool calls few.

Your final answer: one or two sentences saying what the patch does and how to play it, then the
WHOLE patch code in ONE ```clojure fenced block (only the calls above). Nothing after it.")

(defn patch-prompt
  "The whole input for Claude when it makes or changes a patch."
  [{:keys [request current classes]}]
  (str patch-rules
       "\n\n━━━ The classes this work knows now (more official ones come when used) ━━━\n"
       (str/join "\n" classes)
       (when (seq (str/trim (str current)))
         (str "\n\n━━━ The patch to change (keep what is not asked to change) ━━━\n" current))
       "\n\n━━━ The request ━━━\n" request "\n"))
