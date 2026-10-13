;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · code boxes
;; The base of any programmable component: a box whose data is a source text in some
;; language. The text is part of the work (it travels through the history and the rooms); each tab
;; compiles it locally with the compiler registered for its language, and keeps the result in
;; a cache keyed by source. Faust and ClojureScript are the first two languages; others (JavaScript,
;; GLSL, a rule language…) only have to register their compiler and their component.

(ns kairotic.code
  (:refer-clojure :exclude [empty])
  (:require [clojure.string :as str]
            [kairotic.components :as comp]))

;; ───────── data (with history) ─────────

(def empty {:source ""})
(def max-source 20000)

(defn step [d [op & args]]
  (let [d (or d empty)]
    (case op
      :source (let [[s] args] (if (string? s) (assoc d :source (subs s 0 (min (count s) max-source))) d))
      :load (let [[x] args] (if (and (map? x) (string? (:source x))) {:source (subs (:source x) 0 (min (count (:source x)) max-source))} d))
      d)))

(defn ->code [id d]
  (when (seq (str/trim (str (:source d))))
    [(str "(code " id " " (pr-str (:source d)) ")")]))

(def model {:empty empty :step step :load (fn [x] (step empty [:load x])) :code ->code})

;; ───────── compilation ─────────
;; compilers: language → (fn [source] promise of {:value x :info {…}})

(defonce compilers (atom {}))
(defonce cache (atom {}))          ; [language source] → {:status :compiling|:ok|:error :error :value :info :n}
(defonce listeners (atom {}))      ; key → (fn []) to notify when a compilation finishes
(defonce counter (atom 0))

(defn notify! [] (doseq [[_ f] @listeners] (try (f) (catch :default e (js/console.error e)))))

(defn register-language! [language f] (swap! compilers assoc language f) language)

(defn prune! []
  (when (> (count @cache) 60)
    (swap! cache (fn [c] (into {} (take-last 40 (sort-by (fn [[_ v]] (:n v)) c)))))))

(defn compiled
  "Compilation status of a source; if it has not been requested yet, requests it (and notifies when done)."
  [language source]
  (let [source (str source) k [language source]]
    (cond
      (str/blank? source) {:status :empty}
      (get @cache k) (get @cache k)
      :else
      (if-let [f (get @compilers language)]
        (let [n (swap! counter inc)]
          (swap! cache assoc k {:status :compiling :n n})
          (prune!)
          (-> (js/Promise.resolve nil)
              (.then (fn [_] (f source)))
              (.then (fn [r] (swap! cache assoc k (assoc r :status :ok :n n)) (notify!)))
              (.catch (fn [e] (swap! cache assoc k {:status :error :n n :error (or (.-message e) (str e))}) (notify!))))
          (get @cache k))
        {:status :error :error (str "No compiler for " language)}))))

(defn forget-language! [language]
  (swap! cache (fn [c] (into {} (remove (fn [[[l _] _]] (= l language)) c)))))

;; ───────── script: ClojureScript inside the patch ─────────
;; The source is a function (fn [m] …) with the same contract as any component: it receives
;; {:inlet :value :state :args :at} and returns {:state :out [[o v]] :later … :effects …}.
;; A script runs its writer's code inside this page, so in a shared room
;; it is not evaluated until this tab allows it: (trust-scripts true).

(defonce trust (atom false))
;; sources this page brought itself from the official library (Study 22): they run without asking
(defonce trusted (atom #{}))
(defn allowed? [source] (or @trust (contains? @trusted source)))

(register-language! "clojurescript"
  (fn [source]
    (js/Promise.
     (fn [res rej]
       (if-not (allowed? source)
         (rej (js/Error. "not run: this work is shared; (trust-scripts true) to evaluate its scripts"))
         (try
           (let [f (js/scittle.core.eval_string (str "(do " source "\n)"))]
             (if (fn? f) (res {:value f :info {:summary "ready"}}) (rej (js/Error. "a script is a function (fn [m] …)"))))
           (catch :default e (rej e))))))))

(defn whole [x d] (if (number? x) (max 0 (js/Math.round x)) d))

(comp/define! "script"
  {:doc "ClojureScript code box: its source is a function (fn [m] …) that receives and returns messages like any component."
   :usage "script [inlets] [outlets]"
   :display :code :language "clojurescript" :model model
   :io (fn [c] (let [[i o] (:args c)] [(max 1 (whole i 1)) (whole o 1)]))
   :template "(fn [{:keys [inlet value state]}]\n  ;; return {:out [[outlet value]] :state …}\n  {:out [[0 value]]})"
   :receive (fn [m]
              (let [r (compiled "clojurescript" (get-in m [:data :source]))]
                (if (= :ok (:status r))
                  (try
                    (let [x ((:value r) m)] (if (map? x) x {}))
                    (catch :default e {:effects [[:print (str "script: " (or (.-message e) e))]]}))
                  {})))})
