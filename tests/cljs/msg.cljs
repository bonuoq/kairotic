;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · msg: numbers, words, and text between quotes as strings
(ns kairotic.test.msg
  (:require [kairotic.components :as comp]
            [kairotic.test :as t]))

(defn sends [text]
  (let [d (comp/lookup "msg")]
    (ffirst (map second (:out ((:receive d) {:args (comp/args-for d text) :value :bang}))))))

(t/run! "msg"
  (fn []
    (t/eq "numbers and words, as before" [(sends "msg 60") (sends "msg stop") (sends "msg 0 8 4") (sends "msg")] [60 :stop [0 8 4] :bang])
    (t/eq "text between quotes is a string" (sends "msg \"https://a.org/v.ogg\"") "https://a.org/v.ogg")
    (t/eq "... with its spaces" (sends "msg \"two words\"") "two words")
    (t/eq "... in a list" (sends "msg url \"github:a/b/c.wav\" 3") [:url "github:a/b/c.wav" 3])
    (t/eq "... with \\\" and \\\\ inside" (sends "msg \"say \\\"hi\\\" \\\\ bye\"") "say \"hi\" \\ bye")
    (t/eq "an empty string" (sends "msg \"\"") "")
    (t/eq "an unclosed quote takes the rest" (sends "msg \"open end") "open end")
    (t/eq "a quote inside a word is part of it" (sends "msg it\"s") (keyword "it\"s"))
    (t/eq "a number between quotes is text" (sends "msg \"60\"") "60")))
