;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · sounds: the sample box, its description in the history, reading it with reader~
(ns kairotic.test.sounds
  (:require [kairotic.components :as comp]
            [kairotic.sounds :as snd]
            [kairotic.links :as links]
            [kairotic.code :as code]
            [kairotic.test :as t]))

(def d {:audio "5a2c440a1aebc1a02229ceaa5e49df44" :sr 48000 :frames 96000 :channels 1 :peaks [[-0.5 0.4] [-0.1 0.2]]})

(defn recv [m]
  (let [def* (comp/lookup "sample")]
    ((:receive def*) (merge {:args (comp/args-for def* "sample")} m))))

(t/run! "sounds"
  (fn []
    (t/is "sample is a core class with two outlets" (= [1 2] (comp/io {:text "sample 10"})))
    (t/eq "a description is kept as it is" (snd/sane d) d)
    (t/eq "... and anything else is an empty sample" [(snd/sane {:audio "x"}) (snd/sane nil) (snd/sane (assoc d :sr -1))] [{} {} {}])
    (t/eq "peaks out of range are clipped" (:peaks (snd/sane (assoc d :peaks [[-3 2] [0 "a"]]))) [[-1 1]])
    (t/eq "its length in seconds" (snd/seconds d) 2)
    (let [m (:model (comp/lookup "sample"))]
      (t/eq "[:set d] sets it, [:clear] empties it" [((:step m) {} [:set d]) ((:step m) d [:clear])] [d {}])
      (t/eq "the work's code writes it as (sample! …)" ((:code m) :b4 d) [(str "(sample! :b4 " (pr-str d) ")")])
      (t/eq "... and nothing for an empty one" ((:code m) :b4 {}) nil))
    (t/is "a link can carry (sample! …)" (links/call? (list 'sample! :b4 d)))

    (t/eq "rec asks the node to record" (recv {:value :rec}) {:effects [[:rec true]]})
    (t/eq "the node says it started: the box shows it" (recv {:inlet :audio :value {:started true}}) {:state {:rec true} :show {:rec 0}})
    (t/eq "progress while it records" (:show (recv {:inlet :audio :value {:progress 1.5 :level 0.3} :state {:rec true}})) {:rec 1.5 :level 0.3})
    (t/eq "... not after" (recv {:inlet :audio :value {:progress 1.5}}) {})
    (t/eq "a take finished: its length on the left" (:out (recv {:inlet :audio :value {:done d} :state {:rec true}})) [[0 2]])
    (t/eq "a bang asks its length" (:out (recv {:value :bang :data d})) [[0 2]])
    (t/eq "clear empties it, through the page" (:effects (recv {:value :clear})) [[:sample [:clear]]])
    (t/eq "an error is printed" (:effects (recv {:inlet :audio :value {:error "sample: nothing was recorded"}})) [[:print "sample: nothing was recorded"]])

    (let [pts (snd/wave-points [[-0.5 0.5] [0 1]] 6 234 30 26)]
      (t/eq "its picture: two points a column" (count pts) 4)
      (t/eq "... from the first x to the last" [(ffirst pts) (first (last pts))] [6 234]))
    (t/eq "!/ 1 turns seconds into Hz" (:out ((:receive (comp/lookup "!/")) {:args [1] :value 4})) [[0 0.25]])
    (t/eq "a code box keeps a source as long as a whole package"
          (count (:source ((:step code/model) nil [:source (apply str (repeat 60000 "x"))]))) 60000)
    ;; sounds from URLs
    (t/eq "what a sound can be loaded from"
          (mapv snd/url? ["https://a.org/v.ogg" "tests/assets/a440.wav" "./a.wav" "data:audio/wav;base64,AA" "blob:https://x/1"
                          "javascript:alert(1)" "ftp://a/b.wav" "hello" "a b.wav" ""])
          [true true true true true false false false false false])
    (let [k (snd/url-key "tests/assets/a440.wav")]
      (t/is "a URL has a key of 16 hex characters" (re-matches #"[0-9a-f]{16}" k))
      (t/eq "... always the same" k (snd/url-key "tests/assets/a440.wav"))
      (t/is "... another for another URL" (not= k (snd/url-key "tests/assets/a441.wav")))
      (t/eq "a URL alone is a description" (snd/sane {:url "tests/assets/a440.wav"}) {:audio k :url "tests/assets/a440.wav"})
      (t/is "... of a sample" (snd/sample? (snd/sane {:url "tests/assets/a440.wav"}))))
    (t/eq "a full description keeps its URL" (:url (snd/sane (assoc d :url "https://a.org/v.ogg"))) "https://a.org/v.ogg")
    (t/eq "a javascript: URL is not kept" (snd/sane {:url "javascript:alert(1)"}) {})
    (t/eq "a URL on the left asks the page to load it" (:effects (recv {:value "https://a.org/v.ogg"})) [[:sample [:url "https://a.org/v.ogg"]]])
    (t/eq "... and so does [:url …]" (:effects (recv {:value [:url "sounds/v.wav"]})) [[:sample [:url "sounds/v.wav"]]])
    ;; what a msg box sends: its words as keywords (msg https://…, msg "https://…", msg url …)
    (t/eq "a URL as a msg sends it"
          (mapv snd/as-url [(keyword "https://a.org/v.ogg") (keyword "\"https://a.org/v.ogg\"") "'sounds/v.wav'"
                            (keyword "github:a/b/c.wav") :freesound:12 :stop 440])
          ["https://a.org/v.ogg" "https://a.org/v.ogg" "sounds/v.wav" "github:a/b/c.wav" "freesound:12" nil nil])
    (t/eq "msg \"https://…\" loads it" (:effects (recv {:value (keyword "\"https://a.org/v.ogg\"")})) [[:sample [:url "https://a.org/v.ogg"]]])
    (t/eq "msg url https://… loads it" (:effects (recv {:value [:url (keyword "https://a.org/v.ogg")]})) [[:sample [:url "https://a.org/v.ogg"]]])
    (t/is "a word that is not understood is said so" (re-find #"neither" (str (:effects (recv {:value :play})))))
    ;; sources: github: (through jsDelivr) and freesound:
    (t/eq "github:owner/repo@ref/path"
          (snd/github-spec "github:tidalcycles/Dirt-Samples@master/bd/BT0A0A7.wav")
          {:owner "tidalcycles" :repo "Dirt-Samples" :ref "master" :path "bd/BT0A0A7.wav"})
    (t/eq "... without a ref" (:ref (snd/github-spec "github:a/b/c.wav")) nil)
    (t/eq "... served by jsDelivr"
          (snd/github-url (snd/github-spec "github:a/b@v1/dir/my sound.wav"))
          "https://cdn.jsdelivr.net/gh/a/b@v1/dir/my%20sound.wav")
    (t/eq "without @ref: main, master, then the latest tag"
          (snd/github-hrefs (snd/github-spec "github:a/b/c.wav"))
          ["https://cdn.jsdelivr.net/gh/a/b@main/c.wav" "https://cdn.jsdelivr.net/gh/a/b@master/c.wav" "https://cdn.jsdelivr.net/gh/a/b/c.wav"])
    (t/eq "with @ref: only there" (snd/github-hrefs (snd/github-spec "github:a/b@v2/c.wav")) ["https://cdn.jsdelivr.net/gh/a/b@v2/c.wav"])
    (t/eq "... never above the repository" (snd/github-spec "github:a/b/../x.wav") nil)
    (t/eq "freesound:id" [(snd/freesound-id "freesound:12345") (snd/freesound-id "freesound:abc")] [12345 nil])
    (t/eq "both are places a sound can come from"
          (mapv snd/url? ["github:a/b/c.wav" "freesound:1" "github:a" "freesound:"]) [true true false false])
    (t/eq "licenses, in short"
          (mapv snd/license-label ["http://creativecommons.org/publicdomain/zero/1.0/" "https://creativecommons.org/licenses/by/4.0/"
                                   "http://creativecommons.org/licenses/by-nc/3.0/" "http://creativecommons.org/licenses/sampling+/1.0/"])
          ["CC0" "CC BY" "CC BY-NC" "Sampling+"])
    (let [c {:name "kick" :author "someone" :license "CC BY" :page "https://freesound.org/s/1/"}]
      (t/eq "a description keeps the credit of its sound" (:credit (snd/sane {:url "freesound:1" :credit c})) c)
      (t/eq "... only its four texts" (:credit (snd/sane {:url "freesound:1" :credit (assoc c :x 1 :name 3)}))
            (dissoc c :name)))
    (t/eq "splice: the old sound until a frame, then the new one"
          (mapv (fn [c] (vec (array-seq c))) (snd/splice #js [(js/Float32Array. #js [1 2 3])] 2 (js/Float32Array. #js [9 9])))
          [[1 2 9 9]])
    (t/eq "... silence where the old one is shorter, in every channel"
          (mapv (fn [c] (vec (array-seq c))) (snd/splice #js [(js/Float32Array. #js [1]) (js/Float32Array. #js [2])] 3 (js/Float32Array. #js [9])))
          [[1 0 0 9] [2 0 0 9]])
    (t/eq "... or only the new one after silence" (mapv (fn [c] (vec (array-seq c))) (snd/splice nil 1 (js/Float32Array. #js [9]))) [[0 9]])
    (t/eq "splice with after: what the old sound had after the take follows it (punch-in/out)"
          (mapv (fn [c] (vec (array-seq c))) (snd/splice #js [(js/Float32Array. #js [1 2 3 4 5])] 1 (js/Float32Array. #js [9 9]) true))
          [[1 9 9 4 5]])
    (t/eq "... longer than the old one: the take" (mapv (fn [c] (vec (array-seq c))) (snd/splice #js [(js/Float32Array. #js [1 2])] 1 (js/Float32Array. #js [9 9 9]) true))
          [[1 9 9 9]])
    (t/eq "ovr asks for a take over, keeping what comes after" (first (:effects (recv {:value [:ovr 0.5] :data d})))
          [:rec {:from 0.5 :base d :ovr true}])
    (t/eq "!- the other way round" (:out ((:receive (comp/lookup "!-")) {:args [10] :value 4})) [[0 6]])))
