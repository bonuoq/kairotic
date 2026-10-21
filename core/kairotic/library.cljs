;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · library
;; Components that do not come from the core. Three levels, with the same format:
;;   1. in the work:  a `component` box whose source is the definition; it travels with the work and its history
;;   2. shared:       this space's library (the artifact's database), to use in other works
;;   3. published:    an npm package served by jsDelivr, pinned by version
;; Whatever is used from 2 and 3 is copied into a `component` box of the work: so every work is complete,
;; works offline and sounds the same even if the library changes later.
;;
;; Format of a published component (an .mjs module):
;;   export default { class: "drift", version: "1.0.0", author: "…", license: "MPL-2.0", doc: "…",
;;                    source: `{:class "drift" :io [1 1] :receive (fn [m] …)}` };
;;
;; A package (Study 14) is several components published together, and travels as ONE component box:
;;   export default { package: "@kairotic/synth", version: "0.1.0", api: 1, license: "MPL-2.0",
;;                    components: [{class: "adsr~", doc: "…", source: "…"}, …] };
;; and its box holds {:package "@kairotic/synth" :version "0.1.0" :api 1 :components [<source> …]}.
;; Writing a class that a known package defines (see `packages`) brings that package into the work.

(ns kairotic.library
  (:require [clojure.string :as str]
            [kairotic.api :as api]
            [kairotic.components :as comp]
            [kairotic.code :as code]))

(def template
  "{:class \"echo-msg\"
 :doc \"Returns what it receives (change it to anything).\"
 :io [1 1]
 :receive (fn [{:keys [inlet value state args at]}]
           ;; return {:out [[outlet value]] :state … :later [[at inlet value]]}
           {:out [[0 value]]})}")

(declare validate)

(defn validate-package
  "nil if a package map is valid; otherwise, the reason."
  [m]
  (cond
    (not (string? (:package m))) "a package has :package \"@scope/name\""
    (not (sequential? (:components m))) "a package has :components [definition …]"
    (and (:api m) (> (:api m) api/version)) (str (:package m) " needs the Kairotic API " (:api m) " (this one is " api/version ")")
    :else (some (fn [c] (when-let [r (validate c)] (str (or (:class c) "a component") ": " r))) (:components m))))

(defn package? [m] (and (map? m) (contains? m :package)))

(defn definitions
  "The component definitions in what a component box evaluates to: one, or those of a package
   (each marked with :package and :version)."
  [m]
  (if (package? m)
    (for [c (:components m)] (assoc c :package (:package m) :version (:version m)))
    [m]))

(defn validate
  "nil if the definition is valid; otherwise, the reason."
  [m]
  (cond
    (package? m) (validate-package m)
    (not (map? m)) "a component's source is a map {:class … :receive …}"
    (not (and (string? (:class m)) (re-matches #"[^\s()\[\]{}\"]+" (:class m)))) "missing :class (one word, e.g. \"fifth\")"
    (= :core (:origin (comp/lookup (:class m)))) (str "«" (:class m) "» is a core class; use another name")
    (not (or (fn? (:receive m)) (map? (:audio m)) (map? (:patch m)))) "missing :receive (fn [m] …), :audio or :patch"
    (and (contains? m :patch) (not (and (map? (:patch m)) (map? (:boxes (:patch m))))))
    ":patch is a patch {:boxes {…} :lines […]}"
    (and (contains? m :io) (not (or (fn? (:io m)) (and (vector? (:io m)) (= 2 (count (:io m))) (every? number? (:io m))))))
    ":io is [inlets outlets] or a function"
    :else nil))

;; the language of component boxes: ClojureScript that evaluates to a definition map
(code/register-language! "component"
  (fn [source]
    (js/Promise.
     (fn [res rej]
       (if-not (code/allowed? source)
         (rej (js/Error. "not run: this work is shared; (trust-scripts true) to evaluate its components"))
         (try
           (let [m (js/scittle.core.eval_string (str "(do " source "\n)"))]
             (if-let [reason (validate m)]
               (rej (js/Error. reason))
               (if (package? m)
                 (res {:value m
                       :info {:class (:package m)
                              :summary (str (:package m) " " (:version m) " · "
                                            (str/join ", " (map :class (:components m))))}})
                 (let [io (:io m)]
                   (res {:value m
                         :info {:class (:class m)
                                :summary (str "defines «" (:class m) "»"
                                              (when (vector? io) (str " · " (first io) " in · " (second io) " out")))}})))))
           (catch :default e (rej e))))))))

(comp/define! "component"
  {:doc "Defines a box class inside the work: its source is a map {:class :doc :io :receive …} with the same contract as any component."
   :usage "component"
   :display :code :language "component" :model code/model :template template
   :io [0 0]})

;; ───────── the registry follows the work's definitions ─────────

(defonce work-classes (atom {}))   ; class → [box-id definition]

(defn box-num [k] (let [m (re-matches #"b(\d+)" (name k))] (if m (js/parseInt (second m) 10) 1e9)))

(defn sync!
  "Registers the classes defined by the patch's component boxes (the lowest-numbered one wins if two
   define the same) and removes those no longer there. Returns true if the registry changed."
  [patch]
  (let [defs (for [[id b] (sort-by (fn [[k _]] (box-num k)) (:boxes patch))
                   :when (= "component" (comp/klass (:text b)))
                   :let [r (code/compiled "component" (get-in b [:data :source]))]
                   :when (= :ok (:status r))
                   m (definitions (:value r))]
               [(:class m) [id m]])
        fresh (reduce (fn [acc [c v]] (if (contains? acc c) acc (assoc acc c v))) {} defs)
        before @work-classes]
    (when (not= fresh before)
      (doseq [[c _] before :when (not (contains? fresh c))]
        (when (= :work (:origin (comp/lookup c))) (swap! comp/registry dissoc c)))
      (doseq [[c [id m]] fresh :when (not= (get before c) [id m])]
        (when-not (= :core (:origin (comp/lookup c)))
          (comp/define! c (merge (dissoc m :class) {:origin :work :from id}))))
      (reset! work-classes fresh)
      true)))

;; ───────── import ─────────

(defn url-of
  "npm:package@version/path → jsDelivr; a relative path is a file of this page."
  [s]
  (let [s (str/trim (str s))]
    (cond
      (str/starts-with? s "npm:") (str "https://cdn.jsdelivr.net/npm/" (subs s 4))
      :else s)))

(defn header [{cls :class :keys [version author license]} origin]
  (str ";; " cls (when version (str " " version)) (when author (str " · " author))
       (when (seq license) (str " · license " license)) "\n;; imported from " origin "\n"))

(defn import-module
  "Promise of the component published at `origin`: {:class :version :author :doc :source}, or of the
   package: {:package :version :api :components [{:class :source …}]}."
  [origin]
  (-> ((.-kairoticImport js/window) (url-of origin))
      (.then (fn [obj]
               (let [m (js->clj obj :keywordize-keys true)]
                 (when-not (and (map? m) (or (string? (:source m))
                                             (and (string? (:package m)) (sequential? (:components m)))))
                   (throw (js/Error. "that module does not export a component {class, source, …} nor a package {package, components, …}")))
                 m)))))

(defn package-source
  "The source of the component box that carries a package: one map with every component's source."
  [{:keys [package version api license components]} origin]
  (str ";; " package " " version (when (seq license) (str " · license " license)) "\n"
       ";; imported from " origin "\n"
       "{:package " (pr-str package) " :version " (pr-str version) (when api (str " :api " api)) "\n"
       " :components\n ["
       (str/join "\n\n  " (map (fn [c] (str/trim (:source c))) components))
       "]}\n"))

;; ───────── official packages ─────────
;; Where each official package is, and which classes it defines: writing one of these classes in a
;; work that does not have it brings the package into the work (pinned to this version). Until a
;; version is on npm, the page serves its own copy (:local).

(def packages
  {"@kairotic/synth"    {:version "0.1.1" :classes #{"adsr~" "synth~"}  :local "kairotic/packages/synth.mjs"}
   "@kairotic/spatial"  {:version "0.1.1" :classes #{"pan~" "space~"}   :local "kairotic/packages/spatial.mjs"}
   "@kairotic/controls" {:version "0.1.1" :classes #{"knob" "keyboard"} :local "kairotic/packages/controls.mjs"}
   "@kairotic/analysis" {:version "0.2.0" :classes #{"features~" "pitch~" "onset~" "chroma~" "spectrum~" "transcribe"}
                         :local "kairotic/packages/analysis.mjs"}})

(defn package-of
  "The official package that defines class k: [name info], or nil."
  [k]
  (first (filter (fn [[_ p]] (contains? (:classes p) k)) packages)))

(defn package-origins
  "Where to look for a package, in order: npm (pinned version), then the page's own copy."
  [pkg-name]
  (let [{:keys [version local]} (get packages pkg-name)]
    (cond-> [(str "npm:" pkg-name "@" version "/dist/index.mjs")] local (conj local))))

(defn import-package
  "Promise of [package origin]: the first of its origins that answers."
  [pkg-name]
  (reduce (fn [p origin]
            (.catch p (fn [_] (.then (import-module origin) (fn [m] [m origin])))))
          (js/Promise.reject (js/Error. "no origin"))
          (package-origins pkg-name)))
