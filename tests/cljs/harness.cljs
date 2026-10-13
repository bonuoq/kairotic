;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · a small harness: (t/is "label" ok?) (t/eq "label" got expected) (t/throws "label" f)
(ns kairotic.test
  (:refer-clojure :exclude [run!]))

(defonce results (atom []))   ; [{:suite :label :ok :detail}]
(defonce suite (atom ""))

(defn begin! [name] (reset! suite name))

(defn record! [label ok detail]
  (swap! results conj {:suite @suite :label label :ok (boolean ok) :detail detail})
  ok)

(defn is [label ok] (record! label ok nil))

(defn eq [label got expected]
  (record! label (= got expected) (when (not= got expected) (str "got " (pr-str got) ", expected " (pr-str expected)))))

(defn throws [label f]
  (let [r (try (f) ::no-throw (catch :default e e))]
    (record! label (not= r ::no-throw) (when (= r ::no-throw) "it did not throw"))))

(defn run!
  "Runs a suite: its body is a function, so an error in it is a failure, not a broken page."
  [name f]
  (begin! name)
  (try (f) (catch :default e (record! "the suite ran" false (str (or (.-message e) e))))))
