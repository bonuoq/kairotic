;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · corefns
;; The functions of clojure.core (and clojure.string) as boxes, without writing a component for each
;; (discussion #12): a box whose first word is one of them is that function. Its other words are its
;; arguments, read as EDN; the message that arrives at the left inlet goes last, as with ->>:
;;
;;   into [440]        [1 2] → [440 1 2]          take 3          [1 2 3 4] → [1 2 3]
;;   map inc           [1 2] → [2 3]              get % :freq     {:freq 440} → 440
;;   conj % 440        [1 2] → [1 2 440]          str/upper-case  "do" → "DO"
;;
;; The text reads as Clojure, the inlets as Max: % puts the message somewhere else in the call
;; (conj % 440, assoc % :freq 440, vector % 0 0), and whatever its place it is always the left inlet,
;; the only hot one. The other arguments have an inlet each on the right, in the order they are written,
;; which replaces them without sending; a bang on the left sends the last result again. A word that names
;; one of these functions is that function (map inc, sort-by -).
;;
;; As in Clojure, data are functions too: a keyword (:freq, :freq 440 with a default), a set
;; (#{60 64 67}: lets through only those) or a map ({60 :c 64 :e}: a table) written first is a box,
;; and the message goes first: (:freq msg 440). A result that is nil sends nothing.
;;
;; ^:hot before the class (^:hot vector % 0 0) makes every inlet hot, like pak in Max: a new argument
;; sends at once, with the last message (nil before the first one).
;;
;; Functions travel through the wires as their form, EDN data (issue #177): comp, partial, juxt,
;; complement, fnil, constantly, every-pred and some-fn are boxes that send one, (comp inc (partial * 2)),
;; and wherever a box takes an argument a name or such a form is that function: into the inlet of inc in
;; map inc it changes the function live — msg dec too, since a msg sends a word without colon as a name.
;; Nothing but these pure functions is ever made from a form.
;;
;; xf/ makes the transducer of a function into a box with memory, which goes through a stream of
;; messages instead of a collection (clojure.org/reference/transducers):
;;
;;   xf/partition-all 4   collects 4 messages and sends them as a vector (flush sends what is left)
;;   xf/partition 4 1     the last 4, at every message (a sliding window)
;;   xf/dedupe            only when it changes · xf/take 1   the first one only (clear lets one more through)
;;
;; flush completes it (partition-all sends what it holds) and starts again; clear starts again without
;; sending; a new argument on the right starts again too.
;;
;; Only pure functions are here (no evaluation of code, no time, no state of the page, nothing infinite),
;; so these boxes are safe in a shared room: an xf/ box remembers only the messages that went through
;; it. A result that is a sequence goes on as a vector, of at most 4096 elements. A class registered
;; with the same name (+, -, print, mtof…) comes first.

(ns kairotic.corefns
  (:require [clojure.string :as str]
            [clojure.edn :as edn]
            [kairotic.components :as comp]))

(def fns
  {;; collections
   "into" into "conj" conj "cons" cons "concat" concat "vec" vec "set" set "seq" seq "list" list "vector" vector
   "hash-map" hash-map "first" first "second" second "last" last "rest" rest "next" next "butlast" butlast
   "nth" nth "count" count "empty?" empty? "not-empty" not-empty "reverse" reverse "sort" sort "sort-by" sort-by
   "distinct" distinct "dedupe" dedupe "flatten" flatten "frequencies" frequencies "group-by" group-by
   "take" take "drop" drop "take-last" take-last "drop-last" drop-last "take-nth" take-nth
   "take-while" take-while "drop-while" drop-while "interleave" interleave "interpose" interpose
   "partition" partition "partition-all" partition-all "partition-by" partition-by "split-at" split-at
   "map" map "mapv" mapv "mapcat" mapcat "map-indexed" map-indexed "filter" filter "filterv" filterv
   "remove" remove "keep" keep "reduce" reduce "reductions" reductions "apply" apply "some" some
   "every?" every? "range" range "repeat" repeat "zipmap" zipmap "identity" identity
   ;; maps
   "get" get "get-in" get-in "assoc" assoc "assoc-in" assoc-in "dissoc" dissoc "update" update
   "update-in" update-in "select-keys" select-keys "keys" keys "vals" vals "merge" merge "find" find
   "contains?" contains?
   ;; numbers and comparison (+ - * / are boxes of their own)
   "inc" inc "dec" dec "max" max "min" min "abs" (fn [x] (js/Math.abs x)) "quot" quot "rem" rem "mod" mod "max-key" max-key
   "min-key" min-key "=" = "not=" not= "<" < ">" > "<=" <= ">=" >= "zero?" zero? "pos?" pos? "neg?" neg?
   "even?" even? "odd?" odd? "number?" number? "not" not "nil?" nil? "some?" some?
   ;; text and names
   "str" str "subs" subs "keyword" keyword "name" name
   "str/upper-case" str/upper-case "str/lower-case" str/lower-case "str/capitalize" str/capitalize
   "str/trim" str/trim "str/split" str/split "str/join" str/join "str/replace" str/replace
   "str/includes?" str/includes? "str/starts-with?" str/starts-with? "str/ends-with?" str/ends-with?
   "str/reverse" str/reverse "str/blank?" str/blank?})

(defn partition-xf
  "The transducer clojure.core's partition does not have: (partition-xf n) or (partition-xf n step) sends
   every n messages as a vector, the next one starting step after the start of the last (step 1: a
   sliding window); like partition, an incomplete group at the end is not sent."
  ([n] (partition-xf n n))
  ([n step]
   (fn [rf]
     (let [buf (volatile! []) skip (volatile! 0)]
       (fn
         ([acc] (rf acc))
         ([acc x]
          (if (pos? @skip)
            (do (vswap! skip dec) acc)
            (let [b (vswap! buf conj x)]
              (if (< (count b) n)
                acc
                (do (vreset! buf (if (< step n) (subvec b step) []))
                    (when (> step n) (vreset! skip (- step n)))
                    (rf acc b)))))))))))

;; the functions whose transducer can be an xf/ box (each one called with the box's arguments)
(def xfs
  {"map" map "map-indexed" map-indexed "keep" keep "keep-indexed" keep-indexed "mapcat" mapcat
   "filter" filter "remove" remove "take" take "drop" drop "take-while" take-while "drop-while" drop-while
   "take-nth" take-nth "partition-all" partition-all "partition-by" partition-by "partition" partition-xf
   "dedupe" dedupe "distinct" distinct "interpose" interpose "cat" (fn [] cat)})

(def max-items 4096)

;; ───────── functions as values (issue #177) ─────────
;; A function travels through the wires as its form, EDN data: (comp inc (partial * 2)). Where a box takes
;; an argument, a name or such a form is the function, rebuilt in each browser from these same pure
;; functions — nothing else is evaluated, so it is as safe in a shared room as any argument.

(def builders
  "The functions that make functions: as boxes they send a form; inside a form, they build it."
  {"comp" comp "partial" partial "juxt" juxt "complement" complement "fnil" fnil "constantly" constantly
   "every-pred" every-pred "some-fn" some-fn})

;; names a form can use: the function boxes, the arithmetic that has boxes of its own, and the builders
(def ^:private symbols
  (merge fns builders {"+" + "-" - "*" * "/" / "identity" identity}))

(defn fn-form?
  "A form that makes a function: a list whose first element names one of the builders."
  [x]
  (and (seq? x) (symbol? (first x)) (contains? builders (str (first x)))))

(declare as-fn)

(def ^:private build
  (memoize (fn [form] (apply (get builders (str (first form))) (map as-fn (rest form))))))

(defn as-fn
  "An argument as a box uses it: a name of one of these functions is that function, a form that makes one
   (comp …, partial …) is the function it makes; anything else stays as it is (a keyword is a function by
   itself, and a key)."
  [x]
  (cond (symbol? x) (get symbols (str x) x)
        (fn-form? x) (build x)
        :else x))

(defn unknown-names
  "What, inside a form (or a word), is not one of these functions — a name it does not know, or a list
   that does not make a function ((inc 1) is a call, not a function): a form that has any cannot be made."
  [x]
  (cond (= x '%) []
        (symbol? x) (if (contains? symbols (str x)) [] [x])
        (fn-form? x) (vec (mapcat unknown-names (rest x)))
        (seq? x) [x]
        (coll? x) (vec (mapcat unknown-names x))
        :else []))

(defn parse
  "The arguments written after the class, as EDN data (a name or a form that makes a function stays
   as written, and becomes the function when it is called: as-fn), or {:error message}. Its metadata says
   whether the box is ^:hot."
  [text]
  (let [t (comp/strip-meta text)
        rest-text (str/trim (subs t (count (comp/klass t))))]
    (try (with-meta (vec (edn/read-string (str "[" rest-text "]")))
           {:hot (contains? (comp/meta-flags text) :hot)})
         (catch :default e {:error (str "cannot read its arguments: " (.-message e))}))))

(defn slots
  "The places of the arguments that have an inlet of their own (all but %), in the order they are written:
   inlet 1 replaces the first of them, inlet 2 the second…"
  [args]
  (vec (keep-indexed (fn [i a] (when-not (= a '%) i)) args)))

(defn- finite
  "A result that can travel: a sequence becomes a vector (or an error, if it is too long)."
  [r]
  (if (and (seq? r) (not (counted? r)))
    (let [v (vec (take (inc max-items) r))]
      (if (> (count v) max-items) (throw (js/Error. (str "more than " max-items " elements"))) v))
    (if (seq? r) (vec r) r)))

(defn call
  "f with its arguments and the message: at the place of % if there is one, else last (first when
   lead is true, as a keyword, a set or a map takes it)."
  ([f args v] (call f args v false))
  ([f args v lead]
   (let [has% (some #{'%} args)
         args (map (fn [a] (if (= a '%) a (as-fn a))) args)]
     (finite (cond has% (apply f (map (fn [a] (if (= a '%) v a)) args))
                   lead (apply f v args)
                   :else (apply f (concat args [v])))))))

(defn- fresh
  "The state of a box for this text: the one it has if it was made for the same class and arguments, else
   a new one (the box was rewritten)."
  [state n args]
  (if (= (:sig state) [n args]) state {:sig [n args]}))

(defn- send-result [state v r]
  {:state (assoc state :last v) :out (if (nil? r) [] [[0 r]])})

(defn receive
  "A function box. Left inlet: calls the function with the message (a bang: with the last message, and
   the arguments as they are now). Other inlets: replace an argument, sending nothing — or, ^:hot,
   sending at once with the last message."
  [{:keys [f n lead]} {:keys [args state inlet value]}]
  (if (map? args)
    {:effects [[:print (:error args)]]}
    (let [state (fresh state n args)
          as (or (:args state) args)]
      (cond
        (pos? inlet)
        (if-let [i (get (slots args) (dec inlet))]
          (let [st (assoc state :args (assoc as i value))]
            (if (:hot (meta args))
              (send-result st (:last st) (call f (:args st) (:last st) lead))
              {:state st}))
          {:state state})
        (and (= value :bang) (not (contains? state :last))) {:state state}
        :else (let [v (if (= value :bang) (:last state) value)]
                (send-result state v (call f as v lead)))))))

(defn- xf-instance
  "A transducer of make with these arguments, ready to take messages: what it lets through gathers in :buf."
  [make args]
  (let [buf (volatile! [])
        rf ((apply make (map as-fn args)) (fn ([acc] acc) ([acc x] (vswap! buf conj x) acc)))]
    {:rf rf :buf buf :done false}))

(defn- drain
  "What an xf/ box let through since last time, as messages from its outlet (nil sends nothing)."
  [st]
  (let [xs @(:buf st)]
    (vreset! (:buf st) [])
    (vec (keep (fn [x] (let [x (finite x)] (when (some? x) [0 x]))) xs))))

(defn xf-receive
  "An xf/ box: each message on the left goes through the transducer (a bang too: it is a message like any
   other); flush completes it and starts again, clear starts again; the inlets on the right replace an
   argument and start again."
  [{:keys [make n]} {:keys [args state inlet value]}]
  (if (map? args)
    {:effects [[:print (:error args)]]}
    (let [state (fresh state n args)
          as (or (:args state) args)
          st (if (:rf state) state (merge state (xf-instance make as)))]
      (cond
        (pos? inlet)
        (if-let [i (get (slots args) (dec inlet))]
          (let [as (assoc as i value)]
            {:state (merge (assoc st :args as) (xf-instance make as))})
          {:state st})
        (#{:clear "clear"} value) {:state (merge st (xf-instance make as))}
        (#{:flush "flush"} value) (do ((:rf st) nil)
                                      {:state (merge st (xf-instance make as)) :out (drain st)})
        (:done st) {:state st :out []}
        :else (let [r ((:rf st) nil value)]
                (if (reduced? r)
                  (do ((:rf st) nil) {:state (assoc st :done true) :out (drain st)})
                  {:state st :out (drain st)}))))))

;; ───────── boxes that make functions ─────────

(defn builder-receive
  "A box that makes a function (comp inc (partial * 2)): it sends its form, which the boxes that take a
   function as an argument use as that function. Without %, any message on the left (a bang) sends it; with %,
   the message goes there (comp % inc composes the function that arrives) and a bang sends it again. The
   inlets on the right replace the other arguments, sending nothing (^:hot: sending). A form with a name that
   is not one of these functions is not sent: it is written in the REPL."
  [{:keys [n]} {:keys [args state inlet value]}]
  (if (map? args)
    {:effects [[:print (:error args)]]}
    (let [state (fresh state n args)
          as (or (:args state) args)
          has% (some #{'%} args)
          form (fn [as v] (apply list (symbol n) (if has% (map (fn [a] (if (= a '%) v a)) as) as)))
          send (fn [st v]
                 (let [f (form (:args st as) v)
                       bad (unknown-names f)]
                   (if (seq bad)
                     {:state st :effects [[:print (str n ": " (str/join ", " (distinct bad)) " is not a function it knows")]]}
                     {:state (assoc st :last v) :out [[0 f]]})))]
      (cond
        (pos? inlet)
        (if-let [i (get (slots args) (dec inlet))]
          (let [st (assoc state :args (assoc as i value))]
            (if (and (:hot (meta args)) (or (not has%) (contains? st :last))) (send st (:last st)) {:state st}))
          {:state state})
        (not has%) (send state nil)
        (and (= value :bang) (not (contains? state :last))) {:state state}
        :else (send state (if (= value :bang) (:last state) value))))))

;; ───────── what each kind of box is ─────────

(defn data-fn
  "A keyword, a set or a map written as the class, as the function it is in Clojure; nil for anything else."
  [n]
  (cond
    (re-matches #":[^\s\[\]{}()\"#,;]+" n) (keyword (subs n 1))
    (re-find #"^#?\{" n) (let [x (try (edn/read-string n) (catch :default _ nil))]
                           (when (or (map? x) (set? x)) x))
    :else nil))

(defn docs-url
  "The page of a function at clojuredocs.org (clojure.core or clojure.string)."
  [n]
  (let [[ns-name fname] (if (str/starts-with? n "str/") ["clojure.string" (subs n 4)] ["clojure.core" n])]
    (str "https://clojuredocs.org/" ns-name "/" (js/encodeURIComponent (str/replace fname "?" "_q")))))

(def ^:private transducers-ref ["Transducers" "https://clojure.org/reference/transducers"])
(def ^:private hot-ref ["Metadata (^:hot)" "https://clojure.org/reference/metadata"])

(defn- clj-doc [n]
  (try (:doc (meta (get (ns-publics (if (str/starts-with? n "str/") 'clojure.string 'clojure.core))
                        (symbol (str/replace n #"^str/" "")))))
       (catch :default _ nil)))

(def ^:private how-fn
  (str " as a box: the message at the left goes last among its arguments, or where % is, and is always the left"
       " inlet, the only hot one; the other inlets replace the other arguments, in the order they are written,"
       " without sending (^:hot before the class: sending); a bang sends the last result again; nil sends nothing."
       " An argument that is a function (map inc) takes in its inlet another one: a form sent by comp, partial…"))

(defn- kind
  "What a class name is: {:kind :fn|:builder|:data|:xf …}, or nil."
  [n]
  (cond
    (contains? fns n) {:kind :fn :f (get fns n) :n n}
    (contains? builders n) {:kind :builder :n n}
    (and (str/starts-with? n "xf/") (contains? xfs (subs n 3))) {:kind :xf :make (get xfs (subs n 3)) :n n}
    :else (when-let [f (data-fn n)] {:kind :data :f f :n n :lead true})))

(defn- describe
  "The :doc, :usage and :ref of a kind of box."
  [{:keys [kind n f]}]
  (case kind
    :builder {:doc (str "clojure.core/" n " as a box that makes a function: it sends its form — (" n " …) as written —"
                        " and a box that takes a function as an argument (map inc, xf/filter odd?, sort-by :freq…)"
                        " uses it in that argument's inlet, changing it live. A bang sends it; with %, the message"
                        " goes there (comp % inc composes the function that arrives). Inside, any function box"
                        " names a function, + - * / too, and the forms nest: comp inc (partial * 2). Only the form"
                        " travels, rebuilt in each browser from the same pure functions."
                        (when-let [clj (clj-doc n)] (when (seq clj) (str "\n\n" clj))))
              :usage (str n " [functions and arguments…]  ·  bang sends it  ·  % takes the message")
              :ref [[(str "clojure.core/" n) (docs-url n)]
                    ["Higher-order functions" "https://clojure.org/guides/higher_order_functions"]]}
    :fn (let [qual (str (if (str/starts-with? n "str/") "clojure.string/" "clojure.core/") (str/replace n #"^str/" ""))
              clj (clj-doc n)]
          {:doc (str qual how-fn (when (seq clj) (str "\n\n" clj)))
           :usage (str n " [arguments…]  ·  % marks where the message goes  ·  ^:hot " n " …: every inlet hot")
           :ref [[qual (docs-url n)] hot-ref]})
    :xf (let [base (subs n 3) clj (clj-doc base)]
          {:doc (str "The transducer of clojure.core/" base " as a box with memory: it goes through the stream of messages"
                     " that arrive at the left (a bang is one more message), not through a collection; what it lets"
                     " through goes out one message at a time. flush completes it (partition-all sends what it holds)"
                     " and starts again; clear starts again without sending; a new argument on the right starts again."
                     (when (= base "partition") " (partition n step: every n messages, each group starting step after the last; step 1 is a sliding window.)")
                     (when (seq clj) (str "\n\n" clj)))
           :usage (str n " [arguments…]  ·  flush · clear")
           :ref [[(str "clojure.core/" base) (docs-url base)] transducers-ref]})
    :data (let [[what anchor] (cond (keyword? f) ["A keyword" "Keywords"] (set? f) ["A set" "Sets"] :else ["A map" "Maps"])]
            {:doc (str what " as a function, as in Clojure: the message goes first, (" n " msg)"
                       (cond (keyword? f) " — its value under that key, or the argument written after it if there is none"
                             (set? f) " — the message if it is in the set, nothing if not: a filter"
                             :else " — what the map has under the message, or the argument after it: a table")
                       "; nil sends nothing. The other inlets replace the arguments, without sending (^:hot: sending).")
             :usage (str n (when (keyword? f) " [default]"))
             :ref [[(str what " as a function") (str "https://clojure.org/reference/data_structures#" anchor)] hot-ref]})))

(def ^:private defs (atom {}))

(defn definition
  "The class of a box named after one of these functions, an xf/ transducer, or a keyword, set or map (made
   once, then kept), or nil."
  [n]
  (when-let [k (and (string? n) (seq n) (kind n))]
    (or (get @defs n)
        (let [d (merge {:class n :origin :core :display :text :corefn true
                        :parse parse
                        :io (fn [{:keys [text]}] (let [a (parse text)] [(inc (if (map? a) 0 (count (slots a)))) 1]))
                        :dynamic-io true
                        :receive (case (:kind k)
                                   :xf (fn [m] (xf-receive k m))
                                   :builder (fn [m] (builder-receive k m))
                                   (fn [m] (receive k m)))}
                       (describe k))]
          (swap! defs assoc n d)
          d))))

(defn names "The functions that can be boxes, the ones that make functions, and the xf/ transducers." []
  (vec (concat (sort (keys fns)) (sort (keys builders)) (sort (map #(str "xf/" %) (keys xfs))))))

(swap! comp/fallbacks (fn [fs] (if (some #{definition} fs) fs (conj fs definition))))
