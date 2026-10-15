;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · corefns
;; The functions of clojure.core (and clojure.string) as boxes, without writing a component for each
;; (discussion #12): a box whose first word is one of them is that function. Its other words are its
;; arguments, read as EDN; the message that arrives at the left inlet goes last, as with ->>:
;;
;;   into [440]        [1 2] → [440 1 2]          take 3          [1 2 3 4] → (1 2 3)
;;   map inc           [1 2] → [2 3]              get :freq       {:freq 440} → 440
;;   conj % 440        [1 2] → [1 2 440]          str/upper-case  "do" → "DO"
;;
;; % puts the message somewhere else: conj % 440, assoc % :freq 440. A word that names one of these
;; functions is that function (map inc, sort-by -). Each argument has an inlet of its own on the right,
;; which replaces it without sending anything; a bang on the left sends the last result again.
;;
;; Only pure functions are here (no evaluation of code, no time, no state of the page, nothing infinite),
;; so these boxes are safe in a shared room. A result that is a sequence goes on as a vector, of at most
;; 4096 elements. A class registered with the same name (+, -, print, mtof…) comes first.

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

(def max-items 4096)

(defn- fn-of [x] (if (symbol? x) (get fns (str x) x) x))

(defn parse
  "The arguments written after the class, as EDN (symbols naming one of these functions become it), or
   {:error message}."
  [text]
  (let [t (str/trim (str text))
        rest-text (str/trim (subs t (count (comp/klass t))))]
    (try (mapv fn-of (edn/read-string (str "[" rest-text "]")))
         (catch :default e {:error (str "cannot read its arguments: " (.-message e))}))))

(defn- finite
  "A result that can travel: a sequence becomes a vector (or an error, if it is too long)."
  [r]
  (if (and (seq? r) (not (counted? r)))
    (let [v (vec (take (inc max-items) r))]
      (if (> (count v) max-items) (throw (js/Error. (str "more than " max-items " elements"))) v))
    (if (seq? r) (vec r) r)))

(defn call
  "f with its arguments and the message: at the place of % if there is one, else last."
  [f args v]
  (finite (if (some #{'%} args)
            (apply f (map (fn [a] (if (= a '%) v a)) args))
            (apply f (concat args [v])))))

(defn- doc-of [n]
  (let [clj (try (:doc (meta (get (ns-publics (if (str/starts-with? n "str/") 'clojure.string 'clojure.core))
                                  (symbol (str/replace n #"^str/" "")))))
                 (catch :default _ nil))]
    (str (if (str/starts-with? n "str/") "clojure.string/" "clojure.core/") (str/replace n #"^str/" "")
         " as a box: the message at the left goes last among its arguments (or where % is); the other inlets"
         " replace the arguments; a bang sends the last result again."
         (when (seq clj) (str "\n\n" clj)))))

(defn receive
  "Left inlet: calls the function with the message (a bang: with the last message, and the arguments as
   they are now). Other inlets: replace an argument, sending nothing."
  [{:keys [args state inlet value]}]
  (let [f (get fns (:class state))
        as (or (:args state) args)]
    (cond
      (map? args) {:effects [[:print (:error args)]]}
      (pos? inlet) (if (< (dec inlet) (count as))
                     {:state (assoc state :args (assoc as (dec inlet) (fn-of value)))}
                     {:state state})
      (and (= value :bang) (not (contains? state :last))) {:state state}
      :else (let [v (if (= value :bang) (:last state) value)
                  r (call f as v)]
              {:state (assoc state :last v) :out (if (nil? r) [] [[0 r]])}))))

(def ^:private defs (atom {}))

(defn definition
  "The class of a box named after one of these functions (made once, then kept), or nil."
  [n]
  (when (contains? fns n)
    (or (get @defs n)
        (let [d {:class n :origin :core :display :text :corefn true
                 :doc (doc-of n)
                 :usage (str n " [arguments…]  ·  % marks where the message goes")
                 :parse parse
                 :io (fn [{:keys [text]}] (let [a (parse text)] [(inc (if (map? a) 0 (count a))) 1]))
                 :dynamic-io true
                 ;; the engine keeps :state per box: the class rides in it so receive knows its function
                 :receive (fn [m] (receive (update m :state (fn [s] (assoc (or s {}) :class n)))))}]
          (swap! defs assoc n d)
          d))))

(defn names "The functions that can be boxes." [] (vec (sort (keys fns))))

(swap! comp/fallbacks (fn [fs] (if (some #{definition} fs) fs (conj fs definition))))
