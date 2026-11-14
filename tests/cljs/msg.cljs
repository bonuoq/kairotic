;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · msg: what is written in it, read as in Clojure (numbers, :keywords, names, strings, EDN)
(ns kairotic.test.msg
  (:require [kairotic.components :as comp]
            [kairotic.test :as t]))

(defn sends [text]
  (let [d (comp/lookup "msg")]
    (second (first (:out ((:receive d) {:args (comp/args-for d text) :value :bang}))))))

(t/run! "msg"
  (fn []
    (t/eq "numbers, keywords with their colon, nothing is a bang" [(sends "msg 60") (sends "msg :stop") (sends "msg 0 8 4") (sends "msg")] [60 :stop [0 8 4] :bang])
    (t/eq "a word without its colon is a name, not a keyword" (sends "msg stop") 'stop)
    (t/eq "... a function's name" (sends "msg inc") 'inc)
    (t/eq "... free text keeps its whole text" (mapv str (sends "msg e4 6/5 +7 https://a.org/v.ogg /k/hello")) ["e4" "6/5" "+7" "https://a.org/v.ogg" "/k/hello"])
    (t/eq "true false nil" (sends "msg true false nil") [true false nil])
    (t/eq "a keyword with a slash" (sends "msg :a/b") :a/b)
    (t/eq "a vector is read whole" (sends "msg [0 4 7]") [0 4 7])
    (t/eq "... a map too, with what follows" (sends "msg {:freq 440 :amp 0.5} 3") [{:freq 440 :amp 0.5} 3])
    (t/eq "... a set" (sends "msg #{60 64}") #{60 64})
    (t/eq "... nested, with strings inside" (sends "msg [:set :label [:text {:x 1} \"a ] b\"]]") [:set :label [:text {:x 1} "a ] b"]])
    (t/eq "... a form that makes a function" (sends "msg (comp inc (partial * 2))") '(comp inc (partial * 2)))
    (t/eq "text between quotes is a string" (sends "msg \"https://a.org/v.ogg\"") "https://a.org/v.ogg")
    (t/eq "... with its spaces" (sends "msg \"two words\"") "two words")
    (t/eq "... in a list" (sends "msg :url \"github:a/b/c.wav\" 3") [:url "github:a/b/c.wav" 3])
    (t/eq "... with \\\" and \\\\ inside" (sends "msg \"say \\\"hi\\\" \\\\ bye\"") "say \"hi\" \\ bye")
    (t/eq "an empty string" (sends "msg \"\"") "")
    (t/eq "an unclosed quote takes the rest" (sends "msg \"open end") "open end")
    (t/eq "a quote inside a word is part of it" (sends "msg it\"s") (symbol "it\"s"))
    (t/eq "a number between quotes is text" (sends "msg \"60\"") "60")))
