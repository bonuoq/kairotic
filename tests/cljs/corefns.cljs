;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · functions of clojure.core as boxes (discussion #12)
(ns kairotic.test.corefns
  (:require [kairotic.components :as comp]
            [kairotic.corefns :as cf]
            [kairotic.test :as t]))

(defn run
  "Sends the messages [inlet value] to a box with this text, one after the other: the last outputs."
  [text & msgs]
  (let [d (comp/lookup (comp/klass text))]
    (loop [ms msgs state nil out nil]
      (if-let [[inlet value] (first ms)]
        (let [r ((:receive d) {:state state :args (comp/args-for d text) :inlet inlet :value value})]
          (recur (rest ms) (:state r) (if (contains? r :out) (:out r) out)))
        out))))

(t/run! "corefns"
  (fn []
    (t/is "a function of clojure.core is a class" (some? (comp/lookup "into")))
    (t/is "a registered class comes first" (not (:corefn (comp/lookup "+"))))
    (t/is "an unknown word is not a class" (nil? (comp/lookup "into-the-void")))
    (t/eq "the message goes last" (run "into [440]" [0 [1 2]]) [[0 [440 1 2]]])
    (t/eq "% puts it elsewhere" (run "conj % 440" [0 [1 2]]) [[0 [1 2 440]]])
    (t/eq "a word naming a function is that function" (run "map inc" [0 [1 2]]) [[0 [2 3]]])
    (t/eq "keywords work as arguments" (run "get :freq" [0 {:freq 440}]) [[0 440]])
    (t/eq "clojure.string too" (run "str/upper-case" [0 "do"]) [[0 "DO"]])
    (t/eq "a sequence goes on as a vector" (run "take 2" [0 [1 2 3]]) [[0 [1 2]]])
    (t/eq "the other inlets replace the arguments, without sending" (run "take 2" [1 1]) nil)
    (t/eq "... and count next time" (run "take 2" [1 1] [0 [5 6 7]]) [[0 [5]]])
    (t/eq "a bang sends again, with the arguments as they are now" (run "take 2" [0 [5 6 7]] [1 3] [0 :bang]) [[0 [5 6 7]]])
    (t/eq "a bang before any message sends nothing" (run "take 2" [0 :bang]) nil)
    (t/eq "one inlet per argument, and the left one" (comp/io {:text "assoc % :freq 440"}) [4 1])
    (t/is "nothing infinite gets out" (map? (try (cf/call repeat [] 1) (catch :default e {:error (.-message e)}))))
    (t/is "an argument that cannot be read is an error, not a crash"
          (some? (get-in (vec (:effects ((:receive (comp/lookup "into")) {:args (comp/args-for (comp/lookup "into") "into [1") :inlet 0 :value 1}))) [0 1])))))
