;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · hiccup: the html box keeps only what its allowlist allows (issue #146)
(ns kairotic.test.hiccup
  (:require [clojure.string :as str]
            [kairotic.components :as comp]
            [kairotic.hiccup :as h]
            [kairotic.test :as t]))

(t/run! "hiccup"
  (fn []
    ;; what is allowed stays as it was written
    (t/eq "an allowed view is kept"
          (h/clean [:div {:class "row"} [:input {:type "range" :min 0 :max 1 :step 0.01 :name :freq :out 0}] [:span :$freq " Hz"]])
          [:div {:class "row"} [:input {:max 1 :min 0 :name :freq :out 0 :step 0.01 :type "range"}] [:span :$freq " Hz"]])
    (t/eq "classes after dots" (h/clean [:div.row.big "x"]) [:div {:class "row big"} "x"])
    (t/eq "numbers become text" (h/clean [:p 1 2]) [:p "1" "2"])
    (t/eq "lists inside an element are spliced" (h/clean [:ul (list [:li "a"] [:li "b"])]) [:ul [:li "a"] [:li "b"]])

    ;; what is not allowed is dropped
    (t/eq "a script is dropped, with what it holds" (h/clean [:div [:script "alert(1)"] "ok"]) [:div "ok"])
    (t/eq "so are img, a, iframe, style and svg" (h/clean [:div [:img {:src "x"}] [:a {:href "javascript:x"} "l"] [:iframe] [:style "*{}"] [:svg]]) [:div])
    (t/eq "event attributes are dropped" (h/clean [:button {:onclick "alert(1)" :onmouseover "x"} "go"]) [:button "go"])
    (t/eq "href, src, id and action are dropped" (h/clean [:div {:href "x" :src "y" :id "z" :action "w"}]) [:div])
    (t/eq "an input type that is not allowed is dropped" (h/clean [:input {:type "file"}]) [:input])
    (t/eq "... and so is hidden or submit" [(h/clean [:input {:type "hidden"}]) (h/clean [:input {:type "submit"}])] [[:input] [:input]])
    (t/eq "a style keeps only its allowed properties"
          (h/clean [:div {:style {:color :accent :gap 8 :position "fixed" :background-image "url(x)" :z-index 9}}])
          [:div {:style {:color :accent :gap 8}}])
    (t/eq "a style value that loads something is dropped"
          (h/clean [:div {:style {:color "url(http://x)" :width "expression(1)" :border "1px solid red"}}])
          [:div {:style {:border "1px solid red"}}])
    (t/eq "a style value with ; or quotes is dropped" (h/clean [:div {:style {:color "red;position:fixed" :font-family "\"x\""}}]) [:div])
    (t/eq "bad class words are dropped" (h/clean [:div {:class "ok 1bad x\"y"}]) [:div {:class "ok"}])
    (t/eq "an outlet past 15 is dropped" (h/clean [:button {:out 99} "x"]) [:button "x"])
    (t/eq "a name must be a word" (h/clean [:input {:name "a b"}]) [:input])
    (t/eq "a void element keeps no children" (h/clean [:input {:type "text"} "x"]) [:input {:type "text"}])
    (t/is "deep nesting is cut"
          (let [deep (reduce (fn [acc _] [:div acc]) [:span "x"] (range 20))]
            (not (str/includes? (pr-str (h/clean deep)) "\"x\""))))
    (t/is "more than 400 elements are cut" (< (count (h/clean (into [:div] (repeat 600 [:span "x"])))) 402))
    (t/eq "what was dropped is told" (:dropped (h/sanitize [:div [:script] [:p {:onclick "x"}]])) ["<script>" "p onclick"])
    (t/eq "not an element: nothing" (h/clean "just text") nil)

    ;; reading text: EDN or HTML
    (t/eq "EDN is read and made safe" (h/read-view "[:div [:b \"hi\"] [:script \"x\"]]") [:div [:b "hi"]])
    (t/throws "EDN that is not an element" (fn [] (h/read-view "{:a 1}")))
    (t/throws "an empty view" (fn [] (h/read-view "  ")))
    (t/eq "HTML is read as hiccup, made safe"
          (h/read-view "<div class=\"row\"><input type=\"range\" min=\"0\" max=\"10\" data-out=\"0\" name=\"vol\" onchange=\"evil()\"><span>vol $vol</span><img src=x onerror=alert(1)></div>")
          [:div {:class "row"} [:input {:max 10 :min 0 :name :vol :out 0 :type "range"}] [:span "vol " :$vol]])
    (t/eq "several HTML elements are wrapped in a div" (h/read-view "<b>a</b><i>b</i>") [:div [:b "a"] [:i "b"]])
    (t/eq "HTML styles and data-send" (h/read-view "<button data-out=\"1\" data-send=\":go\" style=\"color: red; position: absolute\">x</button>")
          [:button {:out 1 :send :go :style {:color "red"}} "x"])

    ;; the text it is written as reads back as the same view
    (let [v [:div {:class "col"} [:label "a " [:input {:type "range" :name :a :out 0}]] [:p "x " :$a]]]
      (t/eq "pp reads back" (h/read-view (h/pp v)) v))
    (t/eq "outlets: one more than the highest :out" [(h/outlets [:div]) (h/outlets [:div [:button {:out 2}]])] [1 3])

    ;; the box
    (let [d (comp/lookup "html")]
      (t/eq "the html box is drawn as html" (:display d) :html)
      (t/eq "its outlets follow its view" ((:io d) {:data {:view [:div [:button {:out 3} "x"]]}}) [1 4])
      (t/eq "a kept view that is not safe is made safe again" (h/view-of {:view [:div [:script "x"] "ok"]}) [:div "ok"])
      (t/eq "a ui message goes out of its outlet and is kept by name"
            (select-keys ((:receive d) {:value [:ui 0 0.5 :vol] :state {}}) [:out :show])
            {:out [[0 0.5]] :show {:vol 0.5}})
      (t/eq "a ui message without outlet only sets its value"
            (select-keys ((:receive d) {:value [:ui nil "hi" :msg] :state {:values {:a 1}}}) [:out :show])
            {:out [] :show {:a 1 :msg "hi"}})
      (t/eq "a map sets values" (:show ((:receive d) {:value {:freq 220 "x y" 1} :state {}})) {:freq 220})
      (t/eq "[:k v] sets one" (:show ((:receive d) {:value [:freq 330] :state {:values {:a 1}}})) {:a 1 :freq 330})
      ;; values kept in the work, as a knob keeps its value
      (let [m (:model d)]
        (t/eq "values are kept in its data" ((:step m) {:view [:p]} [:values {:freq 440 :t "a"}]) {:view [:p] :values {:freq 440 :t "a"}})
        (t/eq "... merged, nil forgets one" ((:step m) {:view [:p] :values {:freq 440 :t "a"}} [:values {:t nil :g 2}]) {:view [:p] :values {:freq 440 :g 2}})
        (t/eq "... only words naming scalars" ((:step m) {:view [:p]} [:values {"a b" 1 :m {:x 1} :ok true}]) {:view [:p] :values {:ok true}})
        (t/eq "a new view keeps the values" ((:step m) {:view [:p] :values {:a 1}} [:set [:b]]) {:view [:b] :values {:a 1}})
        (t/eq "loading keeps safe values only" ((:load m) {:view [:p] :values {:a 1 :b [1 2] :c (apply str (repeat 3000 "x"))}}) {:view [:p] :values {:a 1}})
        (t/eq "its code writes them" ((:code m) :b3 {:view [:p] :values {:a 1}}) ["(code :b3 \"[:p]\")" "(values! :b3 {:a 1})"])
        (t/eq "... and none when it keeps none" ((:code m) :b3 {:view [:p]}) ["(code :b3 \"[:p]\")"]))
      (t/eq "it shows what its data keeps" (h/current-values {:values {:a 1}} nil) {:a 1})
      (t/eq "... with what its elements did since over it" (h/current-values {:values {:a 1 :b 2}} {:values {:a 5}}) {:a 5 :b 2})
      (t/eq "a value from an element starts from what is kept"
            (:show ((:receive d) {:value [:ui 0 3 :b] :state nil :data {:values {:a 1}}})) {:a 1 :b 3})
      (t/eq "the model reads its text" ((:read (:model d)) nil "[:p \"x\"]") {:view [:p "x"]})
      (t/eq "the model's step reads a batch, as (code …) writes it" ((:step (:model d)) {:view [:p]} [:batch [[:set [:b "z"]]]]) {:view [:b "z"]})
      (t/eq "the model's step makes a view safe" ((:step (:model d)) {:view [:p]} [:set [:p [:script] "y"]]) {:view [:p "y"]}))

    ;; the DOM it builds
    (let [{:keys [node binds live]} (h/build [:div [:input {:type "range" :name :f :min 0 :max 10 :value 3 :out 0}] [:span :$f]] {})]
      (t/eq "built with the DOM" (.-tagName node) "DIV")
      (t/eq "a bound element" (first binds) {:out 0 :send nil :name :f :tag :input :type "range"})
      (h/refresh! {:live live} {:f 7} nil)
      (t/eq "values reach the holes" (.-textContent (.querySelector node "span")) "7")
      (t/eq "... and the named element" (.-value (.querySelector node "input")) "7"))
    (let [{:keys [node]} (h/build [:div {:style {:color :accent :gap 4}} "x"] {})]
      (t/eq "a palette colour is a theme variable" (.. node -style -color) "var(--accent)")
      (t/eq "a number is pixels" (.. node -style -gap) "4px"))))
