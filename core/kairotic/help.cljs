;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · help
;; What each box class is for, port by port, with a small patch that shows it working (like the help
;; patches of Pd and Max). A component can carry its own help in its definition (:help, same shape);
;; this file is the help of the core classes, and of the official packages until they ship their own.
;;
;; {:inlets   ["what the left inlet takes" …]     one line per inlet, left to right
;;  :outlets  ["what the left outlet gives" …]
;;  :messages [["bang" "what it does"] …]          words and values it understands (optional)
;;  :example  "(box :b1 …)\n(connect …)"          a help patch, as patch code (optional)
;;  :try      "something to do with the example"    (optional)
;;  :steps    [{:title "…" :note "…" :try "…" :example "…"} …]
;;            more uses, after the :example: the help patch opens as a lesson, one step each, every
;;            step adding its lines to the patch of the step before (◀ ▶ travel between them) (optional)
;;  :see      ["other" "classes"]                   (optional)
;;  :ref      [["label" "https://…"] …]             outer documentation, opened in a new tab (optional;
;;                                                  the boxes of clojure.core carry theirs: clojuredocs.org)
;;  :package  "@kairotic/synth"                     when the class comes from a package
;;  :doc :usage                                     only for classes the page may not have loaded yet}

(ns kairotic.help
  (:require [clojure.string :as str]
            [kairotic.components :as comp]
            [kairotic.library :as lib]
            [kairotic.corefns :as cf]))

(def lines (fn [& ls] (str/join "\n" ls)))

(def core
  {"loadbang"
   {:outlets ["a bang when the engine starts (▶)"]
    :example (lines "(box :b1 \"loadbang\" 40 30)" "(box :b2 \"print\" 40 90)" "(connect :b1 0 :b2 0)")
    :try "Press ▶: the bang arrives at print, which writes it in the REPL."
    :see ["bang" "metro"]}

   "bang"
   {:inlets ["anything: it flashes and sends a bang"]
    :outlets ["bang"]
    :messages [["click" "sends a bang"]]
    :example (lines "(box :b1 \"bang\" 40 30)" "(box :b2 \"counter 1\" 40 90)" "(box :b3 \"print\" 40 150)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)")
    :try "Start the engine and click the bang: each click counts one more."
    :see ["msg" "loadbang" "metro"]}

   "msg"
   {:inlets ["anything (or a click): sends its content"]
    :outlets ["its content, read as in Clojure: a number, a keyword with its colon (:stop), a name (inc, e4, https://…), true false nil, a string between quotes (\"two words\"), an EDN form ([0 4 7], {:freq 440}), or a list of them; empty, a bang"]
    :example (lines "(box :b1 \"msg 60\" 40 30)" "(box :b2 \"msg 67\" 110 30)" "(box :b3 \"mtof\" 40 90)"
                    "(box :b4 \"osc~ 261.63\" 40 140)" "(box :b5 \"gain~ 0.3\" 40 190)" "(box :b6 \"dac~\" 40 240)"
                    "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)"
                    "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)")
    :try "Start the engine and click the two messages: two MIDI pitches become two frequencies."
    :messages [["msg :stop" "a keyword: what boxes understand as an order (:stop, :rec 4, :clear)"]
               ["msg inc" "a name: a function where a box takes one (map inc), or free text (e4, 6/5, a URL)"]
               ["msg [0 4 7] {:freq 440}" "EDN forms, read whole"]]
    :ref [["EDN" "https://github.com/edn-format/edn"] ["Keywords and symbols" "https://clojure.org/reference/data_structures#Keywords"]]
    :see ["number" "bang"]}

   "number"
   {:inlets ["a number sets it and sends it on; a bang sends it again"]
    :outlets ["the number"]
    :messages [["drag" "up and down changes it (and sends it); let go, the number stays in its text, as a knob's does"]
               ["double-click" "type a number (Enter sends it, Esc closes); so too knobs and the sliders of faust~"]]
    :example (lines "(box :b1 \"number 440\" 40 30)" "(box :b2 \"osc~ 440\" 40 90)" "(box :b3 \"gain~ 0.3\" 40 140)"
                    "(box :b4 \"dac~\" 40 190)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)"
                    "(connect :b3 0 :b4 0)" "(connect :b3 0 :b4 1)")
    :try "Start the engine and drag the number: the oscillator follows. Let it go: its text keeps the new number (back in the history, it goes back)."
    :see ["msg" "knob"]}

   "print"
   {:inlets ["anything: it is written in the REPL, after the label (print out0 → out0: 60)"]
    :example (lines "(box :b1 \"msg 440.1234\" 40 30)" "(box :b2 \"print freq\" 40 90)"
                    "(box :b3 \"format \\\"%.1f Hz\\\"\" 180 90)" "(box :b4 \"print\" 180 150)"
                    "(connect :b1 0 :b2 0)" "(connect :b1 0 :b3 0)" "(connect :b3 0 :b4 0)")
    :try "Click the msg: the REPL writes freq: 440.1234 and print: 440.1 Hz."
    :see ["msg" "format" "str"]}

   "draw"
   {:inlets ["a shape ([:circle {:cx 40 :cy 40 :r 10 :fill :accent}]) is added; a list of shapes replaces them all; [:set k shape] adds or replaces the one called k; [:unset k] removes it; clear"]
    :outlets ["the :hit of a shape pressed (a shape with :hit k sends k)"]
    :messages [["[:circle {:cx :cy :r}]" "a circle (also :rect :line :arc :needle :path :curve :text and :group)"]
               ["[[:line …] [:text …]]" "a list: replaces everything"]
               ["[:set :cursor [:line …]]" "the shape called :cursor, added or moved"]
               ["[:unset :cursor]" "removes it"] [":clear" "empties the view"]]
    :example (lines "(box :b1 \"msg :circle 60 55 22 :accent :hit :sun\" 40 30)"
                    "(box :b2 \"msg :circle 160 55 14 :kairos :hit :moon\" 360 30)"
                    "(box :b3 \"msg :set :label :text 20 100 \\\"press one of them\\\"\" 40 70)"
                    "(box :b4 \"draw 240 120\" 40 120)" "(box :b5 \"print\" 40 270)"
                    "(connect :b1 0 :b4 0)" "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)")
    :try "Click the three messages, then press the circles: print writes :sun or :moon. From code, any shape of kairotic.shapes: (send! :b4 [:curve {:points [[10 90] [80 20] [150 80] [230 30]] :stroke :accent}]). Shapes take the theme's colours (:ink :soft :accent :kairos :bg :grid) and :opacity."
    :see ["monitor" "pcclock" "msg"]}

   "mtof"
   {:inlets ["a MIDI pitch (60 = middle C) or a list of them"]
    :outlets ["the frequency in Hz (or the list)"]
    :example (lines "(box :b1 \"number 69\" 40 30)" "(box :b2 \"mtof\" 40 90)" "(box :b3 \"print\" 40 150)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)")
    :try "Drag the number: 69 is A4, 440 Hz; every 12 steps the frequency doubles."
    :see ["ftom" "osc~"]}

   "ftom"
   {:inlets ["a frequency in Hz or a list of them"]
    :outlets ["the MIDI pitch, with decimals for what falls between keys"]
    :see ["mtof"]}

   "+" {:inlets ["a number or a list: it adds the right one and sends the result" "the number to add (stored, nothing is sent)"]
        :outlets ["the sum"]
        :example (lines "(box :b1 \"number 60\" 40 30)" "(box :b2 \"number 7\" 130 30)" "(box :b3 \"+ 7\" 40 90)" "(box :b4 \"print\" 40 150)"
                        "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 1)" "(connect :b3 0 :b4 0)")
        :try "The right inlet only stores: change it, then drag the left number to hear (read) the result. A fifth above is + 7."
        :see ["-" "*" "/"]}
   "-" {:inlets ["a number or a list: minus the right one" "the number to subtract (stored)"] :outlets ["the difference"] :see ["+"]}
   "*" {:inlets ["a number or a list: times the right one" "the factor (stored)"] :outlets ["the product"] :see ["+" "/"]}
   "/" {:inlets ["a number or a list: divided by the right one (0 if it is 0)" "the divisor (stored)"] :outlets ["the quotient"] :see ["*" "!/"]}
   "!/" {:inlets ["a number or a list: what divides the right one (0 if it is 0)" "the dividend (stored)"] :outlets ["the quotient: !/ 1 gives 1 / the number"] :see ["/" "sample"]}
   "!-" {:inlets ["a number or a list: subtracted from the right one" "the minuend (stored)"] :outlets ["the difference"] :see ["-"]}

   "metro"
   {:inlets ["bang, 1 or :start: starts · 0 or :stop: stops" "the interval in ms"]
    :outlets ["a bang every interval"]
    :example (lines "(box :b1 \"msg 1\" 40 30)" "(box :b2 \"msg 0\" 100 30)" "(box :b3 \"metro 250\" 40 90)"
                    "(box :b4 \"counter 1 8\" 40 150)" "(box :b5 \"print\" 40 210)"
                    "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)")
    :try "Start the engine, then 1 and 0: a pulse that counts from 0 to 7."
    :see ["counter" "ramp" "loadbang"]}

   "counter"
   {:inlets ["bang (or a number): sends the value and advances one step · :reset: back to the minimum" "a number sets the next value"]
    :outlets ["the value"]
    :see ["metro"]}

   "dispatch"
   {:inlets ["a message: goes out by the outlet the selector chooses (or by none)"
             "the selector: k (outlet k, from 0) · nil or false (closed) · true (outlet 0) · a function, keyword or map that chooses for each message · a set (its members by outlet 0)"]
    :outlets ["outlet 0" "outlet 1 … (dispatch n has n)"]
    :messages [["msg 1" "every message by outlet 1"] ["msg nil" "nothing goes out"]
               ["msg {60 0 64 1}" "60 by outlet 0, 64 by outlet 1, anything else by none"]
               ["msg :to" "each message by the outlet its :to says ({:freq 440 :to 1})"]]
    :example (lines "(box :b1 \"msg 60\" 40 30)" "(box :b2 \"msg 64\" 100 30)" "(box :b3 \"msg 67\" 160 30)"
                    "(box :b4 \"msg 0\" 260 30)" "(box :b5 \"msg 1\" 320 30)" "(box :b6 \"msg nil\" 380 30)" "(box :b7 \"msg {60 0 64 1}\" 470 30)"
                    "(box :b8 \"dispatch 2\" 40 100)" "(box :b9 \"print out0\" 40 170)" "(box :b10 \"print out1\" 200 170)"
                    "(connect :b1 0 :b8 0)" "(connect :b2 0 :b8 0)" "(connect :b3 0 :b8 0)"
                    "(connect :b4 0 :b8 1)" "(connect :b5 0 :b8 1)" "(connect :b6 0 :b8 1)" "(connect :b7 0 :b8 1)"
                    "(connect :b8 0 :b9 0)" "(connect :b8 1 :b10 0)")
    :try "Click a selector on the right (0, 1, nil or the map) and then the notes on the left: each note goes out by the way chosen — the REPL says which, out0 or out1 — or by none. With the map, 60 and 64 choose their own way and 67 is held back."
    :see ["msg" "get"]}

   "ramp"
   {:inlets ["bang: goes from a to b in s seconds · [a b s]: that motion · a number: jumps there · :stop" "1 / 0: loop on or off"]
    :outlets ["the moving value"]
    :example (lines "(box :b1 \"loadbang\" 40 30)" "(box :b2 \"ramp 220 880 4 loop\" 40 90)" "(box :b3 \"osc~ 220\" 40 150)"
                    "(box :b4 \"gain~ 0.3\" 40 200)" "(box :b5 \"dac~\" 40 250)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)" "(connect :b4 0 :b5 1)")
    :try "Press ▶: a glissando of two octaves in four seconds, again and again."
    :see ["metro" "reader" "phasor~"]}

   "presets"
   {:inlets ["a keyframe to recall: its number (1 = the first) or its label · bang: a new preset · [:generate seed] · [:morph a b t] · keep"
             "a position between keyframes: 1.5 morphs halfway from the first to the second"]
    :outlets ["the values of the controls it set: {:b3 0.5 :b5 880}"]
    :messages [["2 · intro" "recalls that keyframe: every box takes its text of then, as one event of the history"]
               ["1.5 (right)" "moves the controls (knobs, envelopes…) between two keyframes, as messages, as a drag does"]
               [":keep" "writes the last morph into the texts of the controls, as one event"]
               ["bang · [:generate 42]" "a new preset: what is the same in every keyframe stays, what changes takes a value within its range"]
               ["(keyframes) · (recall 2) · (morph 1 2 0.5) · (morph :keep) · (generate 42)" "the same from the REPL, with every keyframe of the work"]
               ["(store-presets! :bN) · (presets! :bN […])" "keeps its keyframes in the box (only what changes): then it uses them, and they travel with the patch in its code, links and embeds"]]
    :example (lines "(box :b1 \"msg 1\" 40 30)" "(box :b2 \"msg 2\" 100 30)" "(box :b3 \"bang\" 160 30)"
                    "(box :b4 \"knob 1 2 1\" 230 20)" "(box :b5 \"presets\" 40 120)"
                    "(box :b6 \"knob 100 1000 220 log\" 40 180)" "(box :b7 \"osc~ 220\" 40 280)"
                    "(box :b8 \"gain~ 0.2\" 40 330)" "(box :b9 \"dac~\" 40 380)"
                    "(connect :b1 0 :b5 0)" "(connect :b2 0 :b5 0)" "(connect :b3 0 :b5 0)" "(connect :b4 0 :b5 1)"
                    "(connect :b6 0 :b7 0)" "(connect :b7 0 :b8 0)" "(connect :b8 0 :b9 0)" "(connect :b8 0 :b9 1)")
    :try "Press ◆ Snapshot, turn the lower knob and press ◆ again: two keyframes. Start the engine: 1 and 2 recall them, the knob on the right morphs between them, and the bang makes a new preset in between."
    :see ["knob" "patch"]}

   "canvas"
   {:inlets ["a position (or a click): it comes out on the left · an edit ([:stroke [[x y] …]], [:erase :t1], [:clear], [:axis :y 0 1]… or [:batch [edits]]): it changes the buffer, as one event · a question ([:read x], [:strokes], [:get :t1], [:count], [:end], [:range], [:data]): the answer comes out on the left · a musical tree: shown over it"]
    :outlets ["the position, or the answer to a question" "the buffer, for a reader or reader~ (on their right inlet)"]
    :messages [["(axis :bN :x -1 1)" "range of an axis, :log for logarithmic"] ["(stroke :bN [[x y] …])" "draws"]
               ["the corner · (resize :bN 640 300)" "drag its bottom-right corner to resize it; a double-click there brings back its size"]
               ["[:stroke [[0 0] [1 1]]] · [:stroke :t3 pts]" "a stroke by message (a new id, or that one)"]
               ["[:move :t1 dx dy] · [:stretch :t1 k] · [:erase :t1] · [:clear]" "edit strokes by message"]
               ["[:axis :x lo hi] · [:axis :y lo hi :log] · [:grid-y step]" "axes and grid by message"]
               ["[:batch [[:clear] [:stroke pts] …]]" "several edits, one event of the history"]
               ["[:read 0.5] · [:read :y 0.2] · [:strokes] · [:get :t1] · [:count] · [:range] · [:data]" "questions: the answer comes out on the left"]
               ["{ } in the header (or a double-click on its right) · (source :bN)" "the buffer as EDN text, in the code window: edit it and apply (Ctrl+Enter); what changed is one event"]]
    :example (lines "(box :b1 \"canvas\" 40 60)" "(box :b2 \"loadbang\" 40 15)" "(box :b3 \"ramp 0 1 4 loop\" 120 15)"
                    "(box :b4 \"reader\" 40 290)" "(box :b5 \"print\" 40 340)"
                    "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)" "(connect :b1 1 :b4 1)" "(connect :b4 0 :b5 0)"
                    "(axis :b1 :x 0 1)" "(axis :b1 :y 0 1)" "(stroke :b1 [[0 0.2] [0.5 0.9] [1 0.4]])")
    :try "Press ▶: the reader goes along X and prints the height of the stroke. Draw another stroke and listen to the list grow."
    :steps [{:title "An automation"
             :note "A reader~ goes along the canvas at audio rate: its value is a signal that can move a parameter, here the factor of a gain~ (a tremolo drawn by hand)."
             :example (lines "(box :b6 \"phasor~ 0.5\" 300 15)" "(box :b7 \"reader~ norm\" 300 290)" "(box :b8 \"osc~ 330\" 420 290)"
                             "(box :b9 \"gain~ 0\" 420 340)" "(box :b10 \"dac~\" 420 390)"
                             "(connect :b6 0 :b7 0)" "(connect :b1 1 :b7 1)" "(connect :b8 0 :b9 0)" "(connect :b7 0 :b9 1)"
                             "(connect :b9 0 :b10 0)" "(connect :b9 0 :b10 1)")
             :try "Press ▶: the stroke becomes the volume of the oscillator every two seconds. Draw a zigzag and listen to it."}
            {:title "A path in two dimensions"
             :note "With reader path, the position (0…1) goes along a stroke, and both its X and Y come out: a trajectory, for space~ or for two parameters at once."
             :example (lines "(clear :b1)" "(axis :b1 :x -1 1)" "(axis :b1 :y -1 1)"
                             "(stroke :b1 [[0 0.8] [0.7 0.4] [0.5 -0.6] [-0.6 -0.5] [-0.7 0.5] [0 0.8]])"
                             "(text! :b4 \"reader path\")")
             :try "Press ▶: print writes [x y] as the reader goes around the shape. Connect its outlet to a space~ (see its help) to move a sound along it."}]
    :see ["reader" "reader~" "freqt"]}

   "freqt"
   {:inlets ["a time (or a click): it comes out on the left · an edit ([:note t \"c4\" dur], [:stroke [[t hz] …]], [:erase :t1], [:clear], [:tuning \"19-tet\"], [:grid-x 0.25 [4]]… or [:batch [edits]]): it changes the buffer, as one event · a question ([:read t], [:strokes], [:get :t1], [:count], [:end], [:data]): the answer comes out on the left · a musical tree: shown over it"]
    :outlets ["the time, or the answer to a question" "the buffer, for a reader or reader~"
              "shown as a score: the edits made on the notes of the tree it shows ([:edit …]), for the tree box"]
    :messages [["(note :bN t \"c4\" dur)" "a note"] ["(tuning :bN \"31-tet\" 261.63)" "a tuning"] ["(grid-x :bN 0.25 \"3+3+2\")" "a bar grid"]
               ["the corner · (resize :bN 640 300)" "drag its bottom-right corner to resize it (as a score, its width reflows the notation); a double-click there brings back its size"]
               ["[:note 0 \"c4\" 1] · [:note 1 64 0.5]" "a note by message (pitch as a name or MIDI)"]
               ["[:move :t1 dt cents] · [:stretch :t1 k] · [:erase :t1] · [:clear]" "edit notes by message"]
               ["[:tuning \"19-tet\" 261.63] · [:grid-x 0.25 [4]]" "tuning and grid by message"]
               ["[:batch [[:clear] [:note 0 \"c4\" 1] …]]" "several edits, one event of the history"]
               ["[:read 2] · [:strokes] · [:get :t1] · [:count] · [:end] · [:data]" "questions: the answer comes out on the left"]
               ["⇄ score in the header · (view :bN :score)" "the same buffer, quantized and drawn as a score: measures in the meter of its bar grid, tuplets, ties (⇄ canvas brings it back)"]
               ["(quantize :bN {:meter \"6/8\"})" "the tree that score shows, to keep or edit (options: :meter :divs :merge :nest :voices :grace :legato)"]
               ["shown as a score, alt-click a note · (division! :bN t)" "its beat divided the next way (another division, in halves, with the next beat), kept in the buffer"]
               ["(to-tree! :bN)" "a tree box beside it, with its strokes as notes: the drawing, now a tree"]
               ["(quant :bN {:meter \"6/8\" :key \"eb\"}) · [:quantize {…}]" "how its score is quantized and in which key, kept in its buffer (one event); (quant :bN nil): the defaults. {:meters [\"3/4\" \"5/8[2+3]\"]}: a meter for each bar, the last going on"]
               ["(track! :bN) · (quant :bN {:time :track})" "what was played freely (transcribe, at any tempo, with rubato) written on its beats: the tempo and the beats are found, and track! keeps them (the time map) so that the score stays as it is; if the bar starts in the wrong place, (track! :bN {:downbeat t}) with the time of a note that starts a bar; (track! :bN nil) forgets them"]
               ["shown as a score, shift-alt-click a note · (enharmonic! :bN t midi)" "another name for that note (c#4 → db4), kept in the buffer"]
               ["shown as a score, click a note of a tree" "↑ ↓ pitch (⇧ octave) · a…g the nearest note of that name · + − duration · ← → next · Delete → rest"]
               ["click a rest" "Enter → a note (the pitch of the one before) · ↑ ↓ a step above or below it · a…g that note"]
               ["(keep! :bN)" "writes the tree it shows into its buffer, with its recipe beside it (the tree and the boxes that made it)"]
               ["(recipe :bN) · (remake! :bN)" "the recipe of a kept buffer · the tree written back, without the changes made since"]
               ["{ } in the header (or a double-click on its right) · (source :bN)" "the buffer as EDN text, in the code window: edit it and apply (Ctrl+Enter); what changed is one event"]]
    :example (lines "(box :b1 \"freqt\" 40 60)" "(box :b2 \"phasor~ 0.25\" 40 15)" "(box :b3 \"reader~ norm 1 gate\" 40 290)"
                    "(box :b4 \"osc~\" 40 340)" "(box :b5 \"gain~\" 40 390)" "(box :b6 \"dac~\" 40 440)"
                    "(connect :b2 0 :b3 0)" "(connect :b1 1 :b3 1)" "(connect :b3 0 :b4 0)" "(connect :b3 1 :b5 1)"
                    "(connect :b4 0 :b5 0)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)"
                    "(melody :b1 \"c4/1 e4/.5 d4/.5 g4/2\" 0)")
    :try "Press ▶: the reader~ plays the four beats again and again. Draw a stroke of your own, straight or curved: it sounds at the frequency it passes through."
    :steps [{:title "A tuning and a grid"
             :note "A freqt can have a tuning (the lines of its Y axis: any equal division, just intonation, a Scala .scl) and a grid of time with its bars. Drawing snaps to both."
             :example (lines "(tuning :b1 \"19-tet\")" "(grid-x :b1 0.5 [4])")
             :try "Draw a few notes: they fall on the 19 degrees of the octave and on the half beats. Try (tuning :b1 \"just-5\") or (tuning :b1 nil) to draw freely again."}
            {:title "As a score"
             :note "The same buffer can be shown as a score, quantized into measures (in the meter of its bar grid, with tuplets and ties): ⇄ score in its header, or (view :b1 :score). Nothing changes in the data; ⇄ canvas brings the drawing back, and (quantize :b1) gives the tree the score shows."
             :example (lines "(tuning :b1 nil)" "(view :b1 :score)")
             :try "Press ▶: the score sounds the same as the drawing did. To edit notes one by one in a score, show a tree: see the help of tree."}
            {:title "The viewer of a tree"
             :note "A freqt shown as a score is the viewer of a tree that comes transformed (tree → mt transpose 7 → freqt). Its third outlet sends the edits made on the notes back to the tree box. (A box written \"score\", from older works, is a freqt shown as a score.)"
             :example (lines "(box :b7 \"bang\" 500 15)" "(box :b8 \"tree\" 500 60)" "(code :b8 \"\\\"c5/1 b4/.5 a4 g4/2\\\"\")"
                             "(box :b9 \"freqt\" 500 160)" "(view :b9 :score)"
                             "(connect :b7 0 :b8 0)" "(connect :b8 0 :b9 0)" "(connect :b9 2 :b8 0)")
             :try "Click a note of the new score and press ↑ or ↓, + or −, Delete (a rest) and then Enter (a note again): the change goes back to the tree by the dashed line."}]
    :see ["canvas" "reader" "tree" "quantize" "transcribe"]}

   "reader"
   {:inlets ["a position in the units of the buffer (along X, or Y with reader y; 0…1 with reader norm, or with reader path) · on a ring: in seconds (0…1 with norm), or :d, :speed, :stop"
             "the buffer of a canvas, freqt or ring (a ring's right outlet)"]
    :outlets ["the values where the position crosses something (a list) · from a ring, each value as it was written" "their ids (sent first), for voices"]
    :messages [["reader d 1 · msg :d 1" "on a ring: it follows the ring's head 1 s behind, on its own — a canon, a delay; it starts when the ring's time does"]
               ["reader d 1 speed 0.5 · msg :speed 0.5" "first the distance, then the speed: at 0.5 it falls behind (an augmentation), at −1 it goes back over what was written"]
               ["a number (a ramp, a counter)" "on a ring: moves it there; it sends what it crosses, either way, and a move larger than its jump (0.5 s; jump 1, msg :jump 1) is a seek"]
               [":stop" "it stops following"]]
    :example (lines "(box :b1 \"msg 60\" 40 30)" "(box :b2 \"msg 64\" 100 30)" "(box :b3 \"msg 67\" 160 30)"
                    "(box :b4 \"ring 8\" 40 90)" "(box :b5 \"reader d 1\" 40 150)" "(box :b6 \"reader d 2 speed 0.5\" 180 150)"
                    "(box :b7 \"print canon\" 40 210)" "(box :b8 \"print slower\" 180 210)"
                    "(connect :b1 0 :b4 0)" "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)"
                    "(connect :b4 1 :b5 1)" "(connect :b4 1 :b6 1)" "(connect :b5 0 :b7 0)" "(connect :b6 0 :b8 0)")
    :try "Press ▶ and click the three messages: each comes back a second later, and from the second reader two seconds later, twice as slow. A ramp into a reader on the ring moves it by hand."
    :see ["ring" "writer" "canvas" "reader~"]}

   "osc~"
   {:inlets ["a number: the frequency in Hz · a signal: the frequency itself" "—"]
    :outlets ["a sine signal (quiet: 0.15)"]
    :example (lines "(box :b1 \"number 440\" 40 30)" "(box :b2 \"osc~ 440\" 40 90)" "(box :b3 \"gain~ 0.3\" 40 140)"
                    "(box :b4 \"dac~\" 40 190)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)"
                    "(connect :b3 0 :b4 0)" "(connect :b3 0 :b4 1)")
    :try "Start the engine and drag the number. Then put a phasor~ through a * into the left inlet: a signal instead of numbers."
    :see ["gain~" "dac~" "phasor~" "mtof"]}

   "gain~"
   {:inlets ["the signal" "the factor: a number, or a signal (an envelope) that then is the factor"]
    :outlets ["the signal times the factor"]
    :see ["osc~" "adsr~" "dac~"]}

   "dac~"
   {:inlets ["one inlet per output channel: those written after it (1 2 by default)"]
    :example (lines "(box :b1 \"osc~ 330\" 40 30)" "(box :b2 \"gain~ 0.2\" 40 80)" "(box :b3 \"dac~ 1 2\" 40 130)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)")
    :try "Only the left channel sounds: connect the gain~ to the right inlet too."
    :see ["gain~" "pan~" "space~" "adc~"]}

   "adc~"
   {:outlets ["one signal per input channel: those written after it (1 by default)"]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"scope~ 20\" 40 80)" "(box :b3 \"snapshot~ 50 db\" 240 80)"
                    "(box :b4 \"print\" 240 140)"
                    "(connect :b1 0 :b2 0)" "(connect :b1 0 :b3 0)" "(connect :b3 0 :b4 0)")
    :try "Press ▶ and allow the microphone: sing or clap and watch the scope and the level. It does not go to dac~, so it cannot feed back; send it through a gain~ to hear it (with headphones)."
    :see ["dac~" "snapshot~" "scope~"]}

   "snapshot~"
   {:inlets ["the signal; a number changes ms, a bang sends the last value again"]
    :outlets ["its value (or its level with rms, peak or db) every ms, only when it changed"]
    :messages [["rms · peak · db" "written in the box: its level over each ms instead of its value"]]
    :example (lines "(box :b1 \"phasor~ 0.5\" 40 30)" "(box :b2 \"snapshot~ 100\" 40 80)" "(box :b3 \"print\" 40 130)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)")
    :try "Press ▶: the ramp of the phasor~ arrives as numbers ten times a second. Write snapshot~ 100 peak and connect an adc~ instead."
    :see ["adc~" "scope~" "phasor~"]}

   "scope~"
   {:inlets ["the signal; a number changes the time shown (ms)"]
    :messages [["drag up/down" "zoom (⇧ finer)"] ["drag sideways" "the time shown"]]
    :example (lines "(box :b1 \"osc~ 220\" 40 30)" "(box :b2 \"scope~ 20\" 40 80)" "(connect :b1 0 :b2 0)")
    :try "Press ▶: a sine wave stands still. Drag over it to zoom; connect an adc~ instead of the osc~."
    :see ["adc~" "snapshot~"]}

   "record"
   {:inlets ["numbers (a knob, snapshot~, features~…); :rec starts a take from 0, :stop ends it" "a bang: the stroke being drawn ends, the next number begins another"]
    :outlets ["edits for a canvas or freqt (its inlet): [:batch …], at most every 2 seconds"]
    :messages [[":rec" "starts from 0; its first write clears the buffer"] [":rec t (msg :rec 4)" "from t seconds: what is before t stays, what is after is replaced"] [":ovr t (msg :ovr 4)" "from t seconds, over only what the take covers: what comes after it stays"] [":stop" "writes what is left and stops"]]
    :example (lines "(box :b1 \"knob 0 1 0.5\" 40 30)" "(box :b2 \"msg :rec\" 140 30)" "(box :b3 \"msg :stop\" 200 30)"
                    "(box :b4 \"record 0 1\" 40 120)" "(box :b5 \"canvas\" 40 170)"
                    "(connect :b1 0 :b4 0)" "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)")
    :try "Press ▶, click rec, move the knob for a few seconds, click stop: the canvas holds the gesture. A phasor~ into a reader~ with the canvas on its right plays it back as an automation."
    :see ["canvas" "snapshot~" "reader~" "transcribe"]}

   "ring"
   {:inlets ["any value: written where the ring's time is (from its first message) · a writer's edits · :clear"]
    :outlets ["what it is asked ([:data])" "the buffer, for a reader or a writer (on their right or middle inlet); :start when its time starts"]
    :messages [["ring 8" "keeps the last 8 seconds: its write head goes round as a tape head, so what is older than one turn is gone"]
               [":clear" "empties it; its time starts again at the next message"]
               ["[:data]" "what it keeps, as {:dur :events [[position value] …]}"]]
    :example (lines "(box :b1 \"msg 60\" 40 30)" "(box :b2 \"msg 67\" 100 30)" "(box :b3 \"ring 4\" 40 90)"
                    "(box :b4 \"reader d 0.5\" 40 150)" "(box :b5 \"reader d 1.5\" 160 150)" "(box :b6 \"print\" 40 210)"
                    "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)" "(connect :b3 1 :b4 1)" "(connect :b3 1 :b5 1)"
                    "(connect :b4 0 :b6 0)" "(connect :b5 0 :b6 0)")
    :try "Press ▶ and click the messages: a canon in three voices, 0.5 s and 1.5 s behind. After 4 seconds what you played is gone."
    :see ["reader" "writer" "record"]}

   "writer"
   {:inlets ["what is written where the writer is · :rec t / :ovr t · :stop" "the buffer (a ring's right outlet)" "a position in seconds of the span (0…1 with norm), from any source"]
    :outlets ["edits for the ring (its left inlet)"]
    :messages [["writer · writer mix" "ovr (the default) replaces what it passes, silence too, as a tape head; mix leaves it (an overdub)"]
               ["a position on the right" "it goes there: moving, with ovr it erases what it passes; a move larger than its jump (0.5 s; writer jump 1) is a seek"]
               [":ovr t (msg :ovr 2)" "to t, then on at speed 1, replacing what it passes"]
               [":rec t (msg :rec 2)" "the same, and on a ring everything else is erased first"]
               [":stop" "it stays where it is"]]
    :example (lines "(box :b1 \"msg 60\" 40 30)" "(box :b2 \"msg 67\" 100 30)" "(box :b3 \"msg :ovr 0\" 160 30)"
                    "(box :b4 \"writer\" 40 90)" "(box :b5 \"ring 4\" 40 150)" "(box :b6 \"reader d 1\" 40 210)" "(box :b7 \"print\" 40 270)"
                    "(connect :b1 0 :b4 0)" "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)"
                    "(connect :b5 1 :b4 1)" "(connect :b5 1 :b6 1)" "(connect :b6 0 :b7 0)")
    :try "Press ▶ and click the notes: without a position the writer writes where the ring's head is, and the reader plays them a second later. Click :ovr 0: now the writer goes round from the ring's position 0 at speed 1, wherever the ring's head is, replacing what it passes, and the reader meets the notes when it gets there. A ramp on its right inlet moves it by hand."
    :see ["ring" "reader" "record"]}

   "phasor~"
   {:inlets ["a number: the frequency in Hz (0.25 = once every 4 seconds)"]
    :outlets ["a ramp signal from 0 to 1"]
    :see ["reader~" "sig~"]}

   "sig~"
   {:inlets ["a number: the new constant value"] :outlets ["a constant signal"] :see ["phasor~" "osc~"]}

   "reader~"
   {:inlets ["the position signal, in the buffer's units (the X axis of a canvas, the time of a freqt, the seconds of a sample) or 0…1 with reader~ norm (a phasor~ straight in); along a stroke (path) always 0…1 · on a ring~: a position in seconds (0…1 with norm), or nothing (then it follows the ring's head); :d, :speed, :jump, :gain"
             "the buffer of a canvas or freqt, the sound of a sample (then it plays it, 0 its start and 1 its end), or a ring~ (its right outlet)"]
    :outlets ["one signal per voice (the values it crosses) · from a ring~, the sound it reads" "with gate: one more per voice, 1 where it sounds and 0 where not"]
    :messages [["reader~ d 1 · msg :d 1" "on a ring~, without a position: 1 s behind the ring's head — a canon, a delay; a new d glides (the pitch bends) or, larger than its jump (0.25 s), seeks with a crossfade"]
               ["reader~ d 1 speed 0.5 · msg :speed -1" "first the distance, then the speed: at 0.5 an octave down and falling behind, at −1 backwards"]
               ["a position signal on a ring~" "it reads there (seconds; norm: 0…1, a phasor~), at any speed, either way"]]
    :example (lines "(box :b1 \"freqt\" 40 60)" "(box :b2 \"phasor~ 0.25\" 40 15)" "(box :b3 \"reader~ norm 1 gate\" 40 290)"
                    "(box :b4 \"osc~\" 40 340)" "(box :b5 \"gain~\" 40 390)" "(box :b6 \"dac~\" 40 440)"
                    "(connect :b2 0 :b3 0)" "(connect :b1 1 :b3 1)" "(connect :b3 0 :b4 0)" "(connect :b3 1 :b5 1)"
                    "(connect :b4 0 :b5 0)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)"
                    "(stroke :b1 [[0 220] [1 330] [1.5 293.66]])" "(stroke :b1 [[2.5 440] [4 220]])")
    :try "Press ▶: the drawing plays every four seconds, and is silent where nothing is drawn (the gate)."
    :see ["phasor~" "adsr~" "freqt" "reader" "sample"]}

   "ring~"
   {:inlets ["the sound, written where the ring's time is (its write head goes round as a tape head) · :clear silences it"]
    :outlets ["—" "the buffer, for reader~ and writer~ (on their right / middle inlet)"]
    :messages [["ring~ 8" "keeps the last 8 seconds (up to 60)"] [":clear" "silence, the heads where they are"]
               ["up to 8 heads" "the reader~ and writer~ on it share one node: a feedback inside the ring is exact, through other boxes it costs a block (128 samples)"]
               ["reader~ → faust~ → writer~" "a faust~ in a loop of the ring runs inside the ring's node, one sample at a time: exact at any d (a string whose d is its period, a comb, a tape echo that darkens); its parameters follow it there (not a polyphonic one)"]]
    :example (lines "(box :b1 \"adc~\" 40 30)" "(box :b2 \"ring~ 8\" 40 90)" "(box :b3 \"reader~ d 1\" 40 150)"
                    "(box :b4 \"reader~ d 1 speed 0.5\" 200 150)" "(box :b5 \"gain~ 0.4\" 40 210)" "(box :b6 \"dac~\" 40 270)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 1 :b3 1)" "(connect :b2 1 :b4 1)" "(connect :b3 0 :b5 0)" "(connect :b4 0 :b5 0)"
                    "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)")
    :try "With headphones, press ▶ and sing: you come back a second later, and from the second reader~ an octave down, ever later. msg :d 0.25 into a reader~ glides it nearer."
    :see ["reader~" "writer~" "ring" "sample"]}

   "writer~"
   {:inlets ["the sound it writes · :rec t / :ovr t · :stop · :keep x" "the ring~'s buffer (its right outlet)" "a position signal (seconds, or 0…1 with norm: a phasor~); without one, where the ring's head is"]
    :messages [["writer~ · writer~ mix · writer~ mix 0.8" "ovr (the default) replaces what is there, silence too, as a tape head; mix adds to it, keeping what was there times 0.8"]
               ["a position signal" "it writes there as it goes, at any speed, either way; a jump larger than its jump (0.25 s) is a seek"]
               [":ovr t (msg :ovr 2) · :rec t" "to t, then on at speed 1, replacing; rec erases the ring first"] [":stop" "it stays where it is"]]
    :example (lines "(box :b1 \"adc~\" 40 30)" "(box :b2 \"phasor~ -0.25\" 200 30)" "(box :b3 \"writer~ norm\" 40 90)"
                    "(box :b4 \"ring~ 4\" 200 90)" "(box :b5 \"reader~ d 0.5\" 200 150)" "(box :b6 \"gain~ 0.4\" 200 210)" "(box :b7 \"dac~\" 200 270)"
                    "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 2)" "(connect :b4 1 :b3 1)" "(connect :b4 1 :b5 1)"
                    "(connect :b5 0 :b6 0)" "(connect :b6 0 :b7 0)" "(connect :b6 0 :b7 1)")
    :try "With headphones, press ▶ and sing: the writer~ goes round the ring backwards (a phasor~ at −0.25 Hz), so the reader~, which goes forwards, plays you reversed, in chunks."
    :see ["ring~" "reader~" "phasor~"]}

   "sample"
   {:inlets ["the signal to record; :rec starts, :stop ends (or its length in seconds), :clear empties it, a bang asks its length"]
    :outlets ["its length in seconds (after each recording, and on a bang)" "the sound, for a reader~ (on its right inlet)"]
    :messages [[":rec" "records what reaches it, from the beginning"] [":rec t (msg :rec 2.5)" "keeps its first t seconds and records from there"] [":ovr t (msg :ovr 2.5)" "replaces only what the take covers, keeping what comes after (:ovr: from 0)"] [":stop" "keeps what was heard"]
               [":clear" "empties it"] ["a URL (msg https://… · msg :url github:… · a string)" "loads the sound there; every browser that opens the work fetches it"]
               ["(load-sound! :bN)" "brings in a sound file"] ["(load-sound! :bN \"https://…\")" "loads it from a URL"]
               ["(sample! :bN {:url \"…\"})" "a sample that is only a URL, as a link or a shared session writes it"]
               ["github:owner/repo@ref/path.wav" "a file of a public GitHub repository (through jsDelivr: no CORS problem)"]
               ["freesound:12345" "a sound of Freesound, with your API key: (freesound-key! \"…\"); (sounds \"kick\") searches; (credits) lists who made them"]
               ["(save-sound :bN)" "saves it as WAV"]]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"msg :rec\" 140 30)" "(box :b3 \"msg :stop\" 200 30)"
                    "(box :b4 \"sample 10\" 40 90)" "(box :b5 \"!/ 1\" 40 190)" "(box :b6 \"phasor~\" 40 240)"
                    "(box :b7 \"reader~ norm\" 40 290)" "(box :b8 \"gain~ 0.5\" 40 340)" "(box :b9 \"dac~\" 40 390)"
                    "(connect :b1 0 :b4 0)" "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)"
                    "(connect :b5 0 :b6 0)" "(connect :b6 0 :b7 0)" "(connect :b4 1 :b7 1)" "(connect :b7 0 :b8 0)"
                    "(connect :b8 0 :b9 0)" "(connect :b8 0 :b9 1)")
    :try "Press ▶, click rec, sing a phrase, click stop: its length becomes the speed of the phasor~ (!/ 1: one over the seconds), and the reader~ plays it in a loop. Use headphones. Change the phasor~ to play it faster, slower or backwards."
    :see ["reader~" "adc~" "phasor~"]}

   "faust~"
   {:inlets ["audio inputs of process (if any); the left one also takes parameters: [:freq 440]"]
    :outlets ["audio outputs of process"]
    :messages [["(code :bN \"process = …;\")" "writes its source"] ["double-click" "edit the code, beside its patch of Faust's own elements (Patch in the bar hides it); Ctrl+Enter applies"]
               ["Recipe (in the window's bar)" "the values of its sliders that sound closest to a sample box or a sound file, written in the code; Ctrl+Enter applies them"]
               ["declare options \"[nvoices:8]\"" "polyphonic: Hz on the left, voice ids on the right (a second inlet), as synth~; each id a voice"]
               ["[:gain 0.6] · :stop" "polyphonic: the velocity of the next notes · releases every voice"]
               ["effect = …;" "polyphonic: applied once to the sum of the voices"]]
    :example (lines "(box :b1 \"faust~\" 40 30)" "(box :b2 \"dac~\" 40 200)" "(connect :b1 0 :b2 0)" "(connect :b1 0 :b2 1)"
                    "(code :b1 \"import(\\\"stdfaust.lib\\\");\\nf = hslider(\\\"freq\\\", 220, 50, 2000, 1);\\nprocess = os.sawtooth(f) * 0.1 : fi.lowpass(2, 1200);\")")
    :try "Press ▶. Then change 1200 in the code and apply with Ctrl+Enter: the filter opens."
    :steps [{:title "Polyphonic: a keyboard"
             :note "With declare options \"[nvoices:8]\" the source is a voice: its freq, gain and gate are set note by note by Faust's own allocator, for up to 8 notes at once (the oldest is taken when they run out). Hz on the left and voice ids on the right, as synth~; [:gain v] is the velocity of the next notes."
             :example (lines "(box :b3 \"faust~\" 300 30)" "(code :b3 \"import(\\\"stdfaust.lib\\\");\\ndeclare options \\\"[nvoices:8]\\\";\\nfreq = hslider(\\\"freq\\\", 440, 40, 4000, 0.01);\\ngain = hslider(\\\"gain\\\", 0.8, 0, 1, 0.01);\\ngate = button(\\\"gate\\\");\\ncutoff = hslider(\\\"cutoff\\\", 2400, 200, 8000, 1);\\nprocess = os.sawtooth(freq) * gain * en.adsr(0.01, 0.2, 0.6, 0.6, gate) * 0.12 : fi.lowpass(2, cutoff);\")" "(box :b4 \"keyboard\" 300 210)" "(connect :b4 0 :b3 0)" "(connect :b4 1 :b3 1)" "(connect :b4 3 :b3 0)" "(connect :b3 0 :b2 0)" "(connect :b3 0 :b2 1)")
             :try "Press ▶ and play a chord (⇧-click several keys): every key a voice. Touch lower on the keys to play louder. Its other controls (cutoff) are for every voice."}
            {:title "A score in several voices"
             :note "mt play sends the Hz of the notes sounding and their voice ids: each note of a chord, a voice of the faust~."
             :example (lines "(box :b5 \"tree\" 560 30)" "(code :b5 \"\\\"c4+e4+g4/2 d4+f4+a4/2 b3+d4+g4/2 c4+e4+g4+c5/2\\\"\")" "(box :b6 \"msg :bang\" 560 150)" "(box :b7 \"msg :stop\" 640 150)" "(box :b8 \"mt play loop\" 560 190)" "(connect :b5 0 :b8 0)" "(connect :b6 0 :b8 0)" "(connect :b7 0 :b8 0)" "(connect :b8 0 :b3 0)" "(connect :b8 1 :b3 1)")
             :try "Press ▶ and click msg :bang: the four chords in a loop; msg :stop ends it."}
            {:title "Any tuning"
             :note "The notes reach the voices as MIDI pitches with decimals, so any frequency sounds as written: here a just major triad (4:5:6), then the equal-tempered one."
             :example (lines "(box :b9 \"msg 220 275 330\" 560 260)" "(box :b10 \"msg 220 277.18 329.63\" 700 260)" "(box :b11 \"msg :stop\" 870 260)" "(connect :b9 0 :b3 0)" "(connect :b10 0 :b3 0)" "(connect :b11 0 :b3 0)")
             :try "Press ▶ and click the first two messages in turn: the just third is 14 cents lower, and it does not beat."}
            {:title "An effect for all the voices"
             :note "effect = …; in the same source is applied once, to the sum of the voices (here an echo); its controls are parameters of the box too."
             :example (lines "(code :b3 \"import(\\\"stdfaust.lib\\\");\\ndeclare options \\\"[nvoices:8]\\\";\\nfreq = hslider(\\\"freq\\\", 440, 40, 4000, 0.01);\\ngain = hslider(\\\"gain\\\", 0.8, 0, 1, 0.01);\\ngate = button(\\\"gate\\\");\\ncutoff = hslider(\\\"cutoff\\\", 2400, 200, 8000, 1);\\nprocess = os.sawtooth(freq) * gain * en.adsr(0.01, 0.2, 0.6, 0.6, gate) * 0.12 : fi.lowpass(2, cutoff);\\neffect = ef.echo(1, 0.33, 0.45);\")")
             :try "Press ▶ and play the keyboard again: every note echoes. Change ef.echo(1, 0.33, 0.45) and apply it (Ctrl+Enter)."}]
    :see ["knob" "component" "script"]}

   "script"
   {:inlets ["what its function receives, by inlet (as many as the first number)"]
    :outlets ["what its function returns in :out (as many as the second number)"]
    :messages [["source" "(fn [m] {:out [[0 (* 2 (:value m))]]})"]]
    :see ["component"]}

   "component"
   {:doc "Defines a box class inside the work. It has no inlets nor outlets, so it is not drawn in the patch: the Components tab lists the work's definitions and opens them."
    :messages [["source" "a map {:class \"x\" :doc … :io [1 1] :receive (fn [m] …)}: defines the class x in the work"]
               ["New component (Components tab) · (new-component!)" "a new definition, from a template, open in the code window"]
               ["Edit · × (Components tab)" "its code in the code window · removes it (one event of the history)"]
               ["a click on its row" "chooses it: the Claude tab can then change it"]]
    :see ["script" "faust~"]}

   "patch"
   {:inlets ["one per inlet / inlet~ box inside, left to right"] :outlets ["one per outlet / outlet~ box inside"]
    :messages [["double-click" "opens it (patch @name: opens its line, in its tab)"]
               ["patch @name" "uses the line called name (spaces as -): its newest point, so it changes as the line advances; inside it, adc~ and dac~ are quiet (they play when the line plays alone): sound goes in and out through inlet~ / outlet~"]
               ["(pin-ref :bN)" "pins a patch @name to the point of its line it reads now · (follow-ref :bN) follows the line again"]
               ["(abstract :bN \"name\")" "turns it into a class (an abstraction)"]]
    :see ["inlet" "outlet"]}

   "agent"
   {:about "Claude builds what you ask inside it (issue #269): write the request as its text, agent \"harmonize this melody in four parts\", and its content is made with the classes the work knows — the official packages carry the rules of counterpoint, rhythm and harmony — and checked before it arrives. The content is a patch you can open, read, edit and play without Claude: once built it makes no call, in releases, rooms and on phones. It lives in a line of its own (agent b3), so each build is one more point of that line and going back to ask for something else branches. Whoever asks pays, on their own Claude: who writes the text, or whose patch sends the message to its last inlet."
    :inlets ["one per inlet / inlet~ box of its content, left to right" "last: a request, a string or [:ask \"…\"] — the text changes to it and Claude builds again (one build at a time; a request equal to the one that built it is not sent again)"]
    :outlets ["one per outlet / outlet~ box of its content" "last: what it is doing — :building, :built, [:error \"…\"]"]
    :messages [["its panel" "the controls of its content that are presented ((present :bN x y), or in presentation mode) show on the agent box itself, as on a patch box, played from outside; Claude presents the controls it builds"]
               ["?" "on an agent box: what this one does and what each of its ports takes and sends, as Claude described it when it built it, before this page"]
               ["double-click" "opens its content, in its line's tab"]
               ["(ask-agent :bN) · (ask-agent :bN \"…\")" "builds it again from its text · with a new request"]
               ["(agent-info :bN)" "what it was built from, its line, who asked, and whether its content was changed after"]
               ["agent 3 \"…\"" "offers: three contents for each request (up to five), three branches of its line from the same point; it plays the first, the Agents section of the Claude panel shows them to choose (discussion #351)"]
               ["(choose-offer :bN 2)" "plays its second offer; the next request goes on from the one chosen"]
               ["the patch around it" "Claude is told the boxes beside the agent and what reaches its inlets, reads them (describe_box: a tree's voices as lines of notes, its key, meter and analysis) and applies the work's classes to them (apply_class: cac judge, cac partimento, comes…) while it writes"]]
    :see ["patch" "comes" "euclid"]}

   "inlet"  {:outlets ["what arrives at this inlet of the sub-patch"] :see ["patch" "outlet" "inlet~"]}
   "outlet" {:inlets ["what leaves the sub-patch by this outlet"] :see ["patch" "inlet" "outlet~"]}
   "inlet~" {:outlets ["the signal that arrives at this inlet of the sub-patch"] :see ["patch" "outlet~"]}
   "outlet~" {:inlets ["the signal that leaves the sub-patch by this outlet"] :see ["patch" "inlet~"]}

   "tree"
   {:inlets ["a bang: sends the tree again · [:edit …] (from the edits outlet of a freqt shown as a score): changes it · a tree: replaces it"]
    :outlets ["the tree, expanded (melody strings become notes, [:use …] the fragments it names), whenever it changes"
              "its notes as a buffer (strokes of frequency over time), for the right inlet of a reader~"]
    :messages [["{ } in the header (or a double-click on its right) · (source :bN)" "its text, in the code window (Ctrl+Enter applies): only the nodes that changed go into the history"]
               ["(tree! :bN [:voice …])" "writes a tree into it, as edits of the nodes that change"]
               ["(tree-edit! :bN [:attrs [0 1 2] {…}])" "edits nodes by their path: [:set p x] [:attrs p {…}] [:insert p x] [:remove p]"]
               ["(node-at :bN [0 1])" "the node at a path"]
               ["score: how it is shown at first · (view :bN :score)" "the tree drawn as a score, in this box (⇄ roll shows its roll)"]
               ["in a score: click a note" "↑ ↓ pitch (⇧ octave) · a…g the nearest note of that name · # another name (c#4 → db4) · + − duration · ← → next · Delete → rest"]
               ["{:key \"eb\"} on the tree, a voice or a measure" "the score's key: its signature, accidentals that last the bar; :none writes every accidental"]
               ["in a score: click a rest" "Enter → a note (the pitch of the one before) · ↑ ↓ a step above or below it · a…g that note"]
               ["(as-tree :bN)" "reads it back as data"]
               ["⇄ roll · (view :bN :roll)" "a piano roll: its notes as strokes of frequency over time: drawing, dragging, stretching or erasing there edits the tree (free time; with measures, the bars it touches are quantized again; ⌥ to a free voice)"]
               ["(quantize! :bN) · (unquantize! :bN)" "its free time written in measures, and back (one event each); quantized, a note keeps where it really sounded (:tstamp.real, :dur.real, seconds), and made free again it goes back there"]
               ["(export-mei! :bN) · (mei :bN) · (mei :bN :written)" "its MEI (downloaded, or as text): the notation, where its notes really sounded (@tstamp.real, @dur.real, @vel) and the rest in an <extMeta type=\"kairotic\">; read back it is the same tree"]
               ["{ } · All · (code :bN text)" "a tree box's code window shows its tree as written: real times, velocities, wires, takes and its continuum are left out (All shows them); what is applied keeps what each node had of them"]
               ["(import-mei!) · (import-mei! :bN) · drop a file on the patch" "a .mei or MusicXML file as a tree box (a new one, or into bN)"]
               ["⇄ continuum · (continuum! :bN :dissolve)" "between a roll and a score: each axis — time (as it sounded → as written), pitch (Hz → keys → staff), glyph (stroke → head → value) — at its own resolution, changing over the piece (:written :proportional :tempered :graphic :mixed :dissolve :crystallize, or {:res …}); kept in the tree"]
               ["(wire! :bN 2 :swell) · (wire! :bN 2 :swell {:kind :elastic :tol 0.5}) · (unwire! :bN 2) · (wires :bN)" "a wire from a note to the electronics, written on the note (:wire) — or on a rest, [:rest {:dur 4 :wire {:send :drone}}], an event of the electronics alone, silent, led at its time — and drawn on the continuum: what a follow box sends when the performer gets there — rigid (on the note, or caught up once at the next), elastic (on its own at the expected time plus a tolerance if the note does not come), or led by the electronics ({:leader :electronics})"]
               ["(confidence :bN)" "how sure a follower can be at each note, weakest first: where to rehearse more; once learned, a mark under each note of its continuum, red to green"]
               ["(learn! :bN) · (unlearn! :bN)" "learns from its takes that kept what each note sounded like (a follow box with descriptors) how each note sounds — each descriptor's mean, spread and weight —: a follow box then matches notes by them too, and finds sounds without a pitch (a multiphonic, a noise) by them alone"]
               ["(keep-take! :bN take) · (continuum! :bN {:take \"t1\"})" "a performance of the tree (where each note was played), only for you by default (:work keeps it in the tree); the continuum can show it"]
               ["(track! :bN)" "its free time played (in seconds, at any tempo): the beats are found and kept in its :quant, so that its score and quantize! write it on them"]]
    :example (lines "(box :b1 \"bang\" 40 20)" "(box :b2 \"tree\" 40 60)"
                    "(code :b2 \"[:voice\\n [:measure {:meter [3 4]} \\\"e5/1\\\" [:tuplet {:ratio [3 2]} \\\"d5/.5 c5 b4\\\"] [:note {:pitch \\\"a4\\\" :dur 1 :dyn \\\"p\\\"}]]\\n [:measure \\\"g4/3\\\"]]\")"
                    "(box :b3 \"mt transpose 7\" 40 190)" "(box :b4 \"tree\" 40 230)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)")
    :try "The tree box is its own score: click a note and press ↑ (or a…g, + −, Delete), or press { } in its header, change a note in its text and apply it (Ctrl+Enter). It sends its tree whenever it changes: through mt transpose 7 it reaches the second tree box, a fifth higher, which follows. Press ⇄ roll on the tree box to draw notes into it. (A tree that comes into a tree box is written into it, as one event of the history.)"
    :see ["mt" "quantize" "freqt"]}

   "mt"
   {:inlets ["a tree: it comes out transformed (for play: a tree to play, then bang, :stop)"
             "for transpose, invert, augment, rotate, canon, thin: the amount · for seq, par: the tree to join"]
    :outlets ["the result (for play: the Hz of the notes sounding, a list)"]
    :messages [["mt transpose 7" "seven semitones up"] ["mt invert c4" "mirrored around c4"] ["mt retrograde" "backwards"]
               ["mt augment 2" "twice as long"] ["mt rotate 1" "the first element goes to the end"] ["mt canon 2 7" "against itself, 2 beats later, a fifth up"]
               ["mt canon d 2 k P5 speed 0.5" "the same with the words of a reader on a ring: d beats later, k away (semitones or an interval), the comes at a speed — 0.5 twice as slow (an augmentation canon), −1 backwards (a crab) —, and inversion upside down"]
               ["mt thin 0.5" "keeps half the notes of each measure, the ones on its strongest positions (metric weight)"]
               ["mt seq · mt par" "the left tree followed by (or with) the right one"] ["mt events · mt pitches · mt duration" "the tree as data"]
               ["mt play [loop]" "plays it: Hz (0) and voice ids (1) for synth~, parameters (2), dynamics and texts (3), and what the wires of its notes and rests send (4), at their written time — the same patch of electronics a follow box drives live, in fixed time"]
               ["mt play speed 0.5 · msg :speed -1" "at a speed: twice as slow, or the tree backwards — the reader of a tree on its own clock (a reader moved by positions reads the tree box instead: what sounds where it is)"]]
    :example (lines "(box :b1 \"bang\" 40 20)" "(box :b2 \"tree\" 40 60)" "(code :b2 \"\\\"c4/1 d4/.5 e4 g4/1 e4 f4/.5 e4 d4/2\\\"\")"
                    "(box :b4 \"number 7\" 220 170)" "(box :b3 \"mt transpose 7\" 40 170)" "(box :b5 \"tree\" 40 220)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b4 0 :b3 1)" "(connect :b3 0 :b5 0)")
    :try "Change the box text to mt retrograde, mt invert c4 or mt augment 2: the score follows. (The number on the right inlet takes effect with the next tree: click the bang.)"
    :steps [{:title "Two voices: a canon"
             :note "mt canon d i puts the tree against itself, d beats later and i semitones away: two voices that the score shows as two staves."
             :example (lines "(text! :b3 \"mt canon 2 7\")" "(delete :b4)")
             :try "Click the bang. Change it to mt canon 1 -12 (an octave below, one beat later) or mt canon 4 0."}
            {:title "Playing it"
             :note "mt play reads a tree in time: the Hz of the notes that sound (left) and their voice ids (second) go to a synth~, which gives each voice its own note."
             :example (lines "(box :b6 \"msg :bang\" 500 170)" "(box :b7 \"msg :stop\" 570 170)" "(box :b8 \"mt play loop\" 500 220)"
                             "(box :b9 \"synth~\" 500 270)" "(box :b10 \"gain~ 0.3\" 500 320)" "(box :b11 \"dac~\" 500 370)"
                             "(connect :b3 0 :b8 0)" "(connect :b6 0 :b8 0)" "(connect :b7 0 :b8 0)" "(connect :b8 0 :b9 0)" "(connect :b8 1 :b9 1)"
                             "(connect :b9 0 :b10 0)" "(connect :b10 0 :b11 0)" "(connect :b10 0 :b11 1)")
             :try "Press ▶, click the first bang (the tree goes to mt play) and then msg :bang: the canon sounds in a loop; :stop ends it."}]
    :see ["tree" "freqt" "synth~"]}

   ;; ───── official packages (until they carry their own :help) ─────
   "features~"
   {:package "@kairotic/analysis" :usage "features~ [ms] [descriptor …]"
    :doc "Descriptors of a signal every ms, one outlet per word: rms, energy, zcr, loudness, centroid, spread, flatness, rolloff, kurtosis, skewness, slope, crest, sharpness, perceptualSpread, mfcc, chroma (Meyda)."
    :inlets ["the signal"]
    :outlets ["one outlet per descriptor written, in order (rms centroid flatness without words); centroid, spread and rolloff in Hz"]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"features~ 50 rms centroid\" 40 90)"
                    "(box :b3 \"number\" 40 150)" "(box :b4 \"number\" 200 150)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b2 1 :b4 0)")
    :try "Press ▶ and allow the microphone: whisper and then hum — the centroid (brightness) falls."
    :see ["pitch~" "chroma~" "snapshot~"]}

   "pitch~"
   {:package "@kairotic/analysis" :usage "pitch~ [lo hi] [threshold]"
    :doc "The pitch of a signal by YIN: Hz on the left (0 once when it stops hearing one), how clearly periodic on the right."
    :inlets ["the signal"]
    :outlets ["the frequency in Hz, only when it changes; 0 once when it no longer finds one" "the clarity, 0…1"]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"pitch~ 80 1000\" 40 90)" "(box :b3 \"ftom\" 40 150)"
                    "(box :b4 \"number\" 40 200)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)")
    :try "Press ▶ and sing: the box shows the note and its cents, the number the MIDI pitch."
    :see ["onset~" "ftom" "freqt"]}

   "onset~"
   {:package "@kairotic/analysis" :usage "onset~ [threshold] [ms]"
    :doc "A bang at the beginning of each sound (a note, a stroke, a syllable), and its strength."
    :inlets ["the signal; [:threshold x] and [:ms y] change them while it listens; a [:segment …] from form~ forgets the usual change of the section before"]
    :outlets ["a bang for each onset" "its strength (the growth of the spectrum, 0…1)" "the growth of every frame (the onset strength envelope)"]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"onset~\" 40 90)" "(box :b3 \"counter 1\" 40 150)"
                    "(box :b4 \"number\" 40 200)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)")
    :try "Press ▶ and clap: the counter counts the claps. Raise the threshold if it counts too much."
    :see ["pitch~" "sample" "counter" "form~"]}

   "chroma~"
   {:package "@kairotic/analysis" :usage "chroma~ [ms]"
    :doc "How much of each pitch class a signal has: 12 values from C to B, and the strongest class as a word."
    :inlets ["the signal"]
    :outlets ["12 values, C to B, 0…1 (the strongest 1)" "the strongest pitch class (:c … :b), when it changes"]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"chroma~\" 40 90)" "(box :b3 \"print\" 40 170)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 1 :b3 0)")
    :try "Press ▶ and play a chord or a drone: the bars show its pitch classes; print writes the strongest."
    :see ["pitch~" "mt" "features~"]}

   "quantize"
   {:about "**Free time written in measures, when you ask.** What `transcribe` or a drawing left in a `freqt` — notes placed anywhere in time — becomes a measured tree: measures, tuplets, ties, grace notes, voices, ready for a `tree` box, `mt` and the rest.

**Only a bang sends.** The options can be tried first, one message at a time, and nothing goes out until you bang it: a tree written into a tree box is an event of the work's history.

**Two ways in.** A `freqt` on the right inlet (its second outlet: the buffer), or a tree on the left — in free time, or measured (it is made free first, to be written again another way). Two `quantize` boxes can write the same take two ways."
    :inlets ["a bang: quantize and send · a tree (free or measured): the material, until the next one · [:meter \"6/8\"] and the other options, or a map of them · [:meter nil] forgets one · :reset forgets all · :clear forgets the tree"
             "a freqt (from its second outlet): the material, read at the bang"]
    :outlets ["the measured tree, for a tree box" "what it found: {:bars :meter :tempo :notes :voices}"]
    :messages [[":bang" "quantize the material and send the tree"]
               ["[:meter \"3/4\"]" "the meter (\"6/8\", \"7/8[2+2+3]\" for its groups); without one, the freqt's bar grid, or 4/4"]
               ["[:meters [\"3/4\" \"5/8\"]]" "a meter for each bar, the last one going on"]
               ["[:divs [1 2 3 4]]" "the divisions a beat may take (1 to 8 by default: 3, 5, 7 are tuplets)"]
               ["[:merge []]" "no two beats joined into one tuplet ([3 5 6] by default)"]
               ["[:legato 0.25]" "the largest gap before the next note that is not a rest, in beats (0: every gap is a rest)"]
               ["[:chord 0.04]" "starts this close (beats) are one chord"]
               ["[:voices 1]" "how many voices overlapping notes may take (2 by default)"]
               ["[:grace false]" "no grace notes: a note too short for any point is dropped"]
               ["[:key \"eb\"]" "the key it is written in: its signature and its spelling"]
               ["[:tempo 72]" "the tempo written in the tree"]
               ["[:time :track]" "what was played freely (with rubato, at any tempo): its beats are found first (also: quantize track)"]
               ["{:meter \"6/8\" :divs [1 2 3]}" "several options at once"]
               [":reset" "the options forgotten (the defaults again)"]]
    :example (lines "(box :b1 \"freqt\" 40 60)" "(resize :b1 420 200)"
                    "(melody :b1 \"c4/1.06 e4/.47 d4/.55 g4/.94 e4/1.03 f4/.32 e4/.36 d4/.3 c4/2.1\" 0)"
                    "(box :b2 \"msg :bang\" 520 30)" "(box :b6 \"msg :meter \\\"3/4\\\"\" 600 30)" "(box :b7 \"msg :meter nil\" 740 30)"
                    "(box :b3 \"quantize\" 520 90)" "(box :b4 \"tree\" 520 160)" "(resize :b4 460 160)" "(box :b5 \"print\" 760 90)"
                    "(connect :b1 1 :b3 1)" "(connect :b2 0 :b3 0)" "(connect :b6 0 :b3 0)" "(connect :b7 0 :b3 0)"
                    "(connect :b3 0 :b4 0)" "(connect :b3 1 :b5 0)")
    :try "The freqt holds a phrase played freely — the durations are not quite 1, ½ or ⅓. Click :bang: quantize writes it in measures of 4/4 and the tree box shows the score. Click :meter \"3/4\" and :bang again: the same notes, in 3/4. Change a stroke in the freqt (drag it) and bang: the score follows only when you ask."
    :steps [{:title "From your voice"
             :note "transcribe writes what pitch~ hears into the freqt, as strokes in free time; quantize writes them in measures. With :time :track (or quantize track) it first finds the beats of what you sang freely."
             :example (lines "(box :b8 \"adc~ 1\" 40 330)" "(box :b9 \"pitch~ 80 1000\" 40 390)" "(box :b10 \"onset~\" 200 390)"
                             "(box :b11 \"msg :rec\" 300 330)" "(box :b12 \"msg :stop\" 380 330)" "(box :b13 \"transcribe 60\" 40 450)"
                             "(box :b14 \"msg :time :track\" 880 30)"
                             "(connect :b8 0 :b9 0)" "(connect :b8 0 :b10 0)" "(connect :b9 0 :b13 0)" "(connect :b10 0 :b13 1)"
                             "(connect :b11 0 :b13 0)" "(connect :b12 0 :b13 0)" "(connect :b13 0 :b1 0)" "(connect :b14 0 :b3 0)")
             :try "Press ▶, click :rec, sing a phrase, click :stop: the freqt holds it. Click :time :track, then :bang: your phrase, in measures."}]
    :see ["transcribe" "freqt" "tree" "mt"]}

   "transcribe"
   {:package "@kairotic/analysis" :usage "transcribe [bpm] [notes|glide] [ms]"
    :doc "Writes what pitch~ hears into a freqt, as strokes: notes where the contour settles on another pitch (slides, vibrato and ornaments do not start notes), or contours (glide)."
    :inlets ["Hz from pitch~ (0: silence); :rec starts from 0, :stop ends" "a bang (from onset~): a new note, even on the same pitch"]
    :outlets ["edits for a freqt: [:batch [[:stroke …] …]], at most every 2 seconds (one event of the history each)"]
    :messages [[":rec" "starts a take from 0 (its first write clears the freqt)"] [":rec t (msg :rec 8)" "from beat t: what is before t stays, what is after is replaced"] [":ovr t (msg :ovr 8)" "from beat t, over only what the take covers: what comes after it stays"] [":stop" "writes what is left and stops"]]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"pitch~ 80 1000\" 40 90)" "(box :b3 \"onset~\" 200 90)"
                    "(box :b4 \"msg :rec\" 330 90)" "(box :b5 \"msg :stop\" 400 90)" "(box :b6 \"transcribe 60\" 40 160)"
                    "(box :b7 \"freqt\" 40 220)"
                    "(connect :b1 0 :b2 0)" "(connect :b1 0 :b3 0)" "(connect :b2 0 :b6 0)" "(connect :b3 0 :b6 1)"
                    "(connect :b4 0 :b6 0)" "(connect :b5 0 :b6 0)" "(connect :b6 0 :b7 0)")
    :try "Press ▶, click :rec, sing a phrase, click :stop: the freqt holds it (⇄ previews it as a score). To write it in measures, as a tree, connect the freqt's second outlet to a quantize box and bang it. Write transcribe 60 glide to keep the slides."
    :see ["pitch~" "onset~" "freqt" "quantize"]}

   "follow"
   {:package "@kairotic/analysis" :usage "follow [ahead] [band] [descriptor …]"
    :doc "Follows a performer through a tree (discussion #204): each note heard is matched with a note a little ahead of where the performer was, by pitch and by when it was expected at the performer's tempo; wrong notes pass, skipped notes are skipped. Wires written on the notes ([:note {… :wire {:send :swell}}], or (wire! :bN note :swell)) send what they send: rigid when the note is reached (or caught up once, if it was passed over), elastic on their own at the expected time plus a tolerance if the note does not come, or led by the electronics at that time. At :stop, the take — where each note was played — for the tree box."
    :inlets ["Hz from pitch~ (0: silence); :start, :stop" "onsets (from onset~): a new note even on the same pitch" "the tree to follow (from a tree box)" "with words after its numbers (follow rms centroid chroma), one inlet each: a descriptor (features~, chroma~), whose mean while each note sounds goes into the take as what it sounded like (:profile); notes are matched by them too (by the notation's chroma, or by what (learn! :bN) learned), and a sound without a pitch is found by them alone"]
    :outlets ["the written beat where the performer is" "[:note id]: the note found" "what a wire sends when it goes on" "at :stop, [:take {…}]: into the tree box, kept only for you"]
    :messages [[":start" "from the top of the tree"] [":stop" "ends, and sends the take"]
               ["[:here \"n3\"] · (here! :bN 3) · a click on a note of the continuum" "the performer is there: ahead, as if heard; back, from there again (its wires go on again)"]]
    :example (lines "(box :b1 \"tree\" 420 30)" "(tree! :b1 [:voice {:tempo 72} [:measure {:meter [4 4]} \"c4/1 e4 g4 c5\"] [:measure [:note {:pitch \"g4\" :dur 2 :wire {:send :swell}}] [:note {:pitch \"e4\" :dur 1 :wire {:send :fade :kind :elastic :tol 0.5}}] \"c4/1\"]])"
                    "(box :b2 \"adc~ 1\" 40 30)" "(box :b3 \"pitch~ 80 1000\" 40 90)" "(box :b4 \"onset~\" 240 90)"
                    "(box :b5 \"msg :start\" 40 150)" "(box :b6 \"msg :stop\" 140 150)" "(box :b7 \"follow\" 40 210)" "(box :b8 \"print\" 200 270)"
                    "(connect :b2 0 :b3 0)" "(connect :b2 0 :b4 0)" "(connect :b3 0 :b7 0)" "(connect :b4 0 :b7 1)" "(connect :b1 0 :b7 2)"
                    "(connect :b5 0 :b7 0)" "(connect :b6 0 :b7 0)" "(connect :b7 2 :b8 0)" "(connect :b7 3 :b1 0)")
    :try "Press ▶, (view :b1 :continuum), click :start and play or sing the tree: the continuum shows the notes found, the ones skipped and where you are, the wires that went on — click a note to tell it where you are —; its label shows the beat you are at, the print :swell when you reach the long G — even if you skip it, at the next note — and :fade at the E, or half a second after it was due if you stop before it. The wires are drawn rigid solid and elastic dashed. Click :stop: the take goes into the tree box, only for you; (continuum! :b1 {:take …}) — (takes :b1) gives its id — shows where you played each note."
    :see ["pitch~" "onset~" "tree" "transcribe"]}

   "spectrum~"
   {:package "@kairotic/analysis" :usage "spectrum~ [lo hi]"
    :doc "The spectrum of a signal drawn in the patch, on a log scale of frequency (dB from -90 to 0)."
    :inlets ["the signal"]
    :example (lines "(box :b1 \"osc~ 220\" 40 30)" "(box :b2 \"spectrum~\" 40 90)" "(connect :b1 0 :b2 0)")
    :try "Press ▶: one peak at 220 Hz. Connect an adc~ instead and sing a vowel: its partials and formants."
    :see ["scope~" "features~"]}

   "monitor"
   {:package "@kairotic/analysis" :usage "monitor [seconds] [name …]"
    :doc "Draws the messages that arrive over the last seconds, one lane per inlet: a number as a line, a list as a strip of cells, a bang or a word as a mark."
    :inlets ["anything, drawn in the first lane; with names (monitor 6 rms centroid chroma) one inlet per name, left to right"]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"features~ 20 rms centroid\" 40 90)" "(box :b3 \"chroma~\" 260 90)"
                    "(box :b4 \"onset~\" 460 90)" "(box :b5 \"monitor 6 rms centroid chroma onset\" 40 180)"
                    "(connect :b1 0 :b2 0)" "(connect :b1 0 :b3 0)" "(connect :b1 0 :b4 0)"
                    "(connect :b2 0 :b5 0)" "(connect :b2 1 :b5 1)" "(connect :b3 0 :b5 2)" "(connect :b4 0 :b5 3)")
    :try "Press ▶ and allow the microphone: speak, then sing a long note — the centroid falls, the chroma strip settles on one row, each syllable leaves a mark."
    :see ["features~" "chroma~" "onset~" "print"]}

   "realize~"
   {:package "@kairotic/analysis" :usage "realize~ [settings] [midi]"
    :doc "Plays a faust~ from descriptors written as a score — loudness, brightness, noisiness, pitch — or from what features~ and pitch~ hear in another sound: its pitch (or freq) and gain sliders follow them, and its other sliders take the settings of that faust~ that sound nearest (Study 37)."
    :inlets ["loudness: dB, or a level 0…1 (features~ rms)" "brightness: Hz (features~ centroid)" "noisiness: 0…1 (features~ flatness)" "pitch: Hz (pitch~; 0 for none), MIDI with realize~ midi" "loudness heard in what it plays (features~ of the faust~: rms)" "brightness heard (centroid)" "noisiness heard (flatness): with these three it corrects itself"]
    :outlets ["[:slider value] for the faust~ it plays: connect it to the faust~'s left inlet" "how far the nearest setting is from what is written (above 1: the faust~ cannot sound like that)"]
    :messages [[":learn" "plays steady settings of the faust~ offline and listens to them (300, or the number written): after changing its code"]]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"features~ 20\" 40 90)" "(box :b3 \"pitch~\" 260 90)"
                    "(box :b4 \"realize~\" 40 160)" "(box :b5 \"faust~\" 40 240)" "(box :b6 \"dac~\" 40 430)" "(box :b7 \"msg :learn\" 300 160)"
                    "(connect :b1 0 :b2 0)" "(connect :b1 0 :b3 0)" "(connect :b2 0 :b4 0)" "(connect :b2 1 :b4 1)" "(connect :b2 2 :b4 2)"
                    "(connect :b3 0 :b4 3)" "(connect :b7 0 :b4 0)" "(connect :b4 0 :b5 0)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)"
                    "(code :b5 \"import(\\\"stdfaust.lib\\\");\\npitch = hslider(\\\"pitch\\\", 60, 36, 84, 0.01) : si.smoo;\\ngain = hslider(\\\"gain [unit:dB]\\\", -12, -80, 6, 0.1) : ba.db2linear : si.smoo;\\nwave = hslider(\\\"wave\\\", 0.5, 0, 1, 0.001) : si.smoo;\\nnoise = hslider(\\\"noise\\\", 0.1, 0, 1, 0.001) : si.smoo;\\ncutoff = hslider(\\\"cutoff [scale:log]\\\", 1000, 60, 14000, 1) : si.smoo;\\nresonance = hslider(\\\"resonance [scale:log]\\\", 1, 0.5, 8, 0.01) : si.smoo;\\nf0 = ba.midikey2hz(pitch);\\nosc = os.sawtooth(f0) * (1 - wave) + os.square(f0) * wave;\\nprocess = osc * (1 - noise) + no.noise * noise : fi.svf.lp(min(cutoff, 0.45 * ma.SR), resonance) * gain;\")")
    :try "Press ▶ and allow the microphone (headphones): sing, whisper, hum — the synth follows your loudness, brightness, noisiness and pitch with its own sound. Then let it listen: a features~ 20 on the faust~, its three outlets into the last three inlets of realize~ — it corrects what it asks where it falls short. Draw instead: four canvases read by reader~ and snapshot~ are a score for it."
    :see ["features~" "pitch~" "faust~" "monitor"]}

   "form~"
   {:package "@kairotic/analysis" :usage "form~ [seconds] [step] [kernel]"
    :doc "How alike the moments of what arrives are over the last seconds (20): a self-similarity matrix of one frame every step seconds (0.25), drawn; where a segment begins, and the period that repeats."
    :inlets ["lists of numbers (a chroma~, an mfcc), or numbers (onset~'s envelope, an rms); [:seconds x] [:step x] [:kernel x] change them; :clear forgets"]
    :outlets ["the novelty of each frame, 0…1 (how much the music changes there; kernel seconds (2) late)" "a bang where a segment begins" "the period that repeats most, in seconds, when it changes" "[:segment {:t :at :length :period}] for the segment that ends"]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"chroma~\" 40 90)" "(box :b3 \"onset~\" 240 90)"
                    "(box :b4 \"form~\" 40 170)" "(box :b5 \"print\" 280 300)"
                    "(connect :b1 0 :b2 0)" "(connect :b1 0 :b3 0)" "(connect :b2 0 :b4 0)" "(connect :b4 3 :b3 0)" "(connect :b4 3 :b5 0)")
    :try "Press ▶ and play a section, then another (other chords, another register): the squares along the diagonal are the sections, a line marks where the second begins, print writes the segment, and onset~ starts the new section afresh."
    :see ["chroma~" "onset~" "monitor"]}

   "fetch"
   {:package "@kairotic/data" :usage "fetch [json|text|edn] [live]"
    :doc "Brings in what is at a URL (JSON read as EDN, text or EDN) as a task: it goes out on the left and is kept as the data of the box, in the history, the same for everyone; with live, only in this tab."
    :inlets ["a URL (msg https://… · github:owner/repo@ref/path · [:fetch url]); refresh; bang; [:get key …]; clear"]
    :outlets ["what it found (or the part a [:get …] asks for)" ":loading, :ready or [:error \"…\"]"]
    :messages [["a URL" "brings it in; a URL it already keeps is sent again, not fetched"]
               [":refresh" "fetches its URL again"] ["bang" "sends what it holds"]
               [":get :items 0 :name · [:get [:items 0 :name]]" "sends one part of it"] [":clear" "forgets it"]
               ["(keep! :bN {:url \"…\" :value …})" "what it keeps, as the code of the work writes it"]]
    :example (lines "(box :b1 \"msg github:bonuoq/kairotic@main/packages/data/package.json\" 40 30)" "(box :b2 \"fetch\" 40 80)"
                    "(box :b3 \"edn 340 260\" 40 150)" "(box :b4 \"print\" 400 150)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)")
    :try "Click the message: the answer arrives in the edn box, and stays in the work (go back and forward in the history: it is not fetched again). Pick a line: its value goes to print."
    :see ["edn" "sample" "print"]}

   "edn"
   {:package "@kairotic/data" :usage "edn [width height]"
    :doc "Any value as a tree, like Portal: collections open and close, values coloured by kind; picking a line sends that part (left) and its path (right)."
    :inlets ["any value; :depth n opens it n levels down; bang sends the part picked again; :clear"]
    :outlets ["the part picked" "its path, for [:get …] of a fetch box"]
    :messages [[":depth 2" "opens it two levels down"] ["bang" "the part picked again (the whole value if none)"] [":clear" "empties it"]
               ["▸ ▾ · a line · a drag" "opens or closes · picks it · scrolls (also the bar on the right)"]]
    :example (lines "(box :b1 \"tree\" 40 30)" "(tree! :b1 [:voice [:measure {:meter [4 4]} \"c4/1 e4 g4 c5\"]])"
                    "(box :b2 \"edn 320 220\" 40 130)" "(box :b3 \"print\" 400 130)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b2 1 :b3 0)")
    :try "The tree arrives: open the measure and pick a note: the note and its path go to print."
    :see ["fetch" "print" "tree"]}

   "pbind"
   {:package "@kairotic/patterns" :usage "pbind [seed] [repeat] [loop]"
    :doc "A pattern as EDN data: a map of constants, sequences and #pat/… generators, with its randomness seeded. It sends its pattern whenever it changes, for a player."
    :inlets ["bang: sends its pattern again · a map: replaces it (one event of the history) · [:set :dur [1 0.5]]: one key · [:unset :amp]"]
    :outlets ["its pattern (a factory of streams), for a player"]
    :messages [["{:degree [0 2 4] :dur 0.5}" "a key with a vector is a sequence; the shorter ones start again until the longest ends"]
               ["#pat/choose [0.25 0.5] · #pat/white [0 7] · #pat/walk [0 2 -7 7]" "endless random values (the same for everyone: the seed)"]
               ["#pat/shuffle [0 2 4] · #pat/series [0 2 8]" "every pass in a new order · an arithmetic series"]
               ["#pat/hold [4 [:c :g :d]]" "one value every 4 beats (following time, not events)"]
               ["#pat/chord [0 4 7]" "a vector as one value: a chord"]
               ["{:dur #pat/euclid [5 8] :degree [0 2 4]}" "a rhythm in :dur: the lengths between its onsets (an eighth a pulse for 8), the other keys note by note — talea and color (also #pat/pulses [1 0 0 1 …], #pat/necklace \"x..x..x.\", #pat/chance [5 16])"]
               ["{:pulse #pat/euclid [3 8] :dur 0.5}" "a rhythm in another key: one event a pulse, :pulse 0 a silence (a step sequencer)"]
               ["{:degree [0 2 :rest 4]} · [0 nil 4]" "a silence: :rest (:_ :- :r) or nil as the degree, note or freq"]
               [":amp #pat/white [0.2 0.6]" "the loudness of each note (0…1), for synth~ and a polyphonic faust~"]
               ["pbind 7 · pbind 7 4 · pbind 7 loop" "the seed · four passes · for ever"]]
    :example (lines "(box :b1 \"pbind 7 loop\" 40 30)"
                    "(code :b1 \"{:degree #pat/shuffle [0 2 4 7]\\n :dur    [0.5 0.5 1]\\n :amp    #pat/white [0.1 0.3]}\")"
                    "(box :b2 \"msg :start\" 40 130)" "(box :b3 \"msg :stop\" 110 130)" "(box :b4 \"player 110\" 40 180)"
                    "(box :b5 \"synth~\" 40 240)" "(box :b6 \"dac~\" 40 290)"
                    "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b1 0 :b4 1)"
                    "(connect :b4 0 :b5 0)" "(connect :b4 1 :b5 1)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)")
    :try "Press ▶ and start: four notes in a new order every pass. Change :dur in the pbind (double-click it) and apply: the player goes on with it from the same beat. Change the seed (pbind 8 loop): other orders, but the same for everyone in a room."
    :steps [{:title "One value per bar"
             :note "#pat/hold follows time: the root changes every 4 beats whatever the rhythm, as Overtone's ^{:dur 4} does."
             :example (lines "(code :b1 \"{:degree #pat/shuffle [0 2 4 7]\\n :dur    [0.5 0.5 1]\\n :root   #pat/hold [4 [:c :f :g :c]]}\")")
             :try "Press start: the same figure, moving through four harmonies."}
            {:title "Rhythms: talea and color"
             :note "A rhythm of @kairotic/rhythm in :dur gives the lengths between its onsets: every event is an onset, and the other keys go on note by note. Three degrees over the five onsets of the cinquillo (#pat/euclid [5 8]) meet it again after three bars — talea and color, as a necklace writes them. In another key, :pulse by custom, a rhythm gives one event a pulse, and :pulse 0 is a silence."
             :example (lines "(code :b1 \"{:dur    #pat/euclid [5 8]\\n :degree [0 2 4]\\n :octave #pat/hold [4 [5 4]]}\")")
             :try "Press start: the cinquillo, its pitches turning against it. Try #pat/necklace \"x..x..x...x.x...\" (the son clave) or #pat/chance [5 16] (another rhythm each pass)."}
            {:title "Random, but the same"
             :note "Every key has a seed of its own (the box's seed and its name): changing one key leaves the randomness of the others as it was."
             :example (lines "(code :b1 \"{:degree #pat/walk [0 1 -4 9]\\n :dur    #pat/choose [0.25 0.25 0.5]\\n :scale  :dorian}\")")
             :try "Start, stop and start again: the same walk. Change :scale to :lydian: the same rhythm and contour, other notes."}]
    :see ["pattern" "player" "tree"]}

   "pattern"
   {:package "@kairotic/patterns" :usage "pattern [seed] [repeat] [loop]"
    :doc "A pattern as Clojure code: an expression that returns event maps (or one map, read as a pbind), with seeded randomness and pbind, pseq, pwhite, pchoose, pshuffle, pseries, pwalk at hand. In a shared room it runs only after (trust-scripts true)."
    :inlets ["bang: sends its pattern again"]
    :outlets ["its pattern (a factory of streams), for a player"]
    :messages [["(pbind {:degree (pwhite 0 7) :dur 0.25} :inf)" "a pbind whose values are lazy sequences"]
               ["(concat (pbind m1) (pbind m2))" "phrases one after another"]
               ["(for [d (range 8)] {:degree d :dur (if (even? d) 0.5 0.25)})" "any Clojure that gives event maps"]
               ["rand · rand-int · rand-nth · shuffle" "seeded by the box: the same for everyone"]]
    :example (lines "(box :b1 \"pattern 3\" 40 30)"
                    "(code :b1 \"(pbind {:degree (pwhite 0 7)\\n        :dur    (pchoose [0.25 0.25 0.5])\\n        :octave [5 5 6]}\\n       :inf)\")"
                    "(box :b2 \"msg :start\" 40 130)" "(box :b3 \"msg :stop\" 110 130)" "(box :b4 \"player 120\" 40 180)"
                    "(box :b5 \"synth~\" 40 240)" "(box :b6 \"dac~\" 40 290)"
                    "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b1 0 :b4 1)"
                    "(connect :b4 0 :b5 0)" "(connect :b4 1 :b5 1)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)")
    :try "Press ▶ and start. Edit the code (double-click the box) and apply: the player follows the new pattern from the beat it is on."
    :see ["pbind" "player" "script"]}

   "player"
   {:package "@kairotic/patterns" :usage "player [bpm] [quant] [jump] [limit] [edges] [spread]"
    :doc "Plays a pattern by its own clock (start/stop), one step at a time (bang) or at a position in beats (a number): the Hz and voice ids of the notes sounding, the whole event and the beat."
    :inlets [":start · :stop: its own clock · bang: one step, now · a number: a position in beats · :seek p · :reset · [:bpm 90]"
             "a pattern (from a pbind or a pattern box): a new one goes on from the same beat"]
    :outlets ["the Hz of the notes sounding (a list), after [:gain amp] when the event has :amp" "their voice ids, sent first (for synth~ or a polyphonic faust~)"
              "the whole event, with :beat, :hz and :ids (and :dir :back when entered from its end)" "the beat"]
    :messages [[":start · :stop" "its own clock: every event lasts its :dur in beats at its bpm"]
               ["player 120 4" "start on a multiple of 4 beats: players with the same tempo meet"]
               ["[:bpm 90]" "another tempo, without a jump"]
               ["bang" "the next event now (and the ones of :dur 0 right after it)"]
               ["a number" "a position in beats: every event is a span, from its onset to its end, that sounds while the position is inside it — entered at its onset going forwards, at its end going backwards (:dir :back); what a step passes over sounds within it"]
               [":seek 8 · [:seek 8]" "there at once, nothing in between: what still sounds there goes on, what starts to contain that position starts"]
               ["player 120 0 8 8" "a step more than 8 (jump) times the one before it, or longer than 8 (limit) beats, is a seek: the wrap of a ramp"]
               ["player 120 0 8 8 edges" "a seek sounds only what starts exactly there"]
               ["player 120 0 8 8 spread" "what a step passes keeps its rhythm, one step later (with ▶)"]
               [":reset" "back to the beginning, silently"]]
    :example (lines "(box :b1 \"pbind 1 loop\" 40 30)"
                    "(code :b1 \"{:note [:c4 :e4 :g4 :b4 :a4 :f4]\\n :dur  [0.5 0.5 1]}\")"
                    "(box :b2 \"msg :start\" 40 130)" "(box :b3 \"msg :stop\" 110 130)" "(box :b4 \"player 100\" 40 180)"
                    "(box :b5 \"synth~\" 40 240)" "(box :b6 \"dac~\" 40 290)" "(box :b7 \"get % :beat\" 260 240)" "(box :b8 \"print\" 260 290)"
                    "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b1 0 :b4 1)"
                    "(connect :b4 0 :b5 0)" "(connect :b4 1 :b5 1)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)"
                    "(connect :b4 2 :b7 0)" "(connect :b7 0 :b8 0)")
    :try "Press ▶ and start: the six notes, three durations cycling. The third outlet is the whole event: print writes the beat of each."
    :steps [{:title "Step by step"
             :note "A bang plays the next event now: the pattern follows whatever moves it — a metro, an onset~ of what someone plays, a key."
             :example (lines "(box :b9 \"metro 300\" 180 130)" "(box :b10 \"msg 1\" 180 100)" "(box :b11 \"msg 0\" 230 100)"
                             "(connect :b10 0 :b9 0)" "(connect :b11 0 :b9 0)" "(connect :b9 0 :b4 0)")
             :try "Stop the clock and click 1: one note every 300 ms, whatever its :dur. Connect an onset~ from an adc~ instead: one note each time you play."}
            {:title "At a position"
             :note "A number is a position in beats, as a reader reads a buffer: every event is a span that sounds while the position is inside it. Forwards it starts at its onset; backwards at its end. The wrap of a ramp (a step far larger than the ones before) is a seek: there at once."
             :example (lines "(box :b12 \"ramp 0 6 3 loop\" 330 130)" "(box :b13 \"msg :bang\" 330 100)"
                             "(connect :b13 0 :b12 0)" "(connect :b12 0 :b4 0)")
             :try "Stop the clock and click bang: six beats in three seconds, again and again. Change the ramp to ramp 6 0 3 loop: the phrase backwards, each note from its end. Drag a number box into it instead: you are the clock, either way."}]
    :see ["pbind" "pattern" "metro" "ramp" "reader" "synth~"]}

   "pcclock"
   {:package "@kairotic/theory" :usage "pcclock [notes]"
    :doc "A pitch-class set on the clock face: its polygon, the sets before it, its axes of symmetry; its prime form and interval vector go out."
    :inlets ["a list of pitches (Hz, as a keyboard or midiin sends them; MIDI or 0…11 with midi), a list of 12 weights (a chroma), or a number: a note, the last n notes (4) being the set; :clear"]
    :outlets ["the prime form, when the set changes" "the interval vector" "the pitch class pressed"]
    :example (lines "(box :b1 \"msg 60 64 67\" 40 30)" "(box :b2 \"msg 60 63 66 69\" 140 30)" "(box :b3 \"pcclock midi\" 40 80)"
                    "(box :b4 \"print\" 40 330)" "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)")
    :try "Click the major triad, then the diminished seventh: (0 3 7) has no axis, (0 3 6 9) has four. (The messages are MIDI notes, hence midi; a keyboard sends Hz, as pitches go between boxes, so a pcclock written without midi takes it directly.) Press a pitch class on the clock: it comes out on the right."
    :see ["fourier" "tonnetz" "chroma~"]}

   "fourier"
   {:package "@kairotic/theory" :usage "fourier [notes]"
    :doc "The six Fourier coefficients of a pitch-class distribution (chromatic, dyadic, triadic, octatonic, diatonic, whole-tone), each a point in its circle with its trail."
    :inlets ["a list of pitches (Hz, as a keyboard or midiin sends them; MIDI or 0…11 with midi), a list of 12 weights (a chroma, from chroma~), or a number: a note (the last n count: 4); :clear"]
    :outlets ["the six magnitudes, 0…1" "the six phases, in degrees"]
    :example (lines "(box :b1 \"msg 60 62 64 65 67 69 71\" 40 30)" "(box :b2 \"msg 60 64 68\" 240 30)" "(box :b3 \"fourier midi\" 40 80)"
                    "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)")
    :try "The diatonic scale fills f5; the augmented triad, f3 and f6 at 1. With adc~ → chroma~ → fourier, sing or play and watch the trails."
    :see ["pcclock" "tonnetz" "chroma~"]}

   "tonnetz"
   {:package "@kairotic/theory" :usage "tonnetz [notes]"
    :doc "Triads on the Tonnetz (fifths across, thirds up) and the path of the harmony: each triad found joined to the ones before."
    :inlets ["a list of pitches (Hz, as a keyboard or midiin sends them; MIDI or 0…11 with midi), a list of 12 weights (a chroma, above 0.5), or a number: a note (the last n count: 3); :clear forgets the path"]
    :outlets ["the triad, when it changes (:C, :am, :Ebm…)" "the pitch class pressed"]
    :example (lines "(box :b1 \"msg 60 64 67\" 40 30)" "(box :b2 \"msg 60 63 67\" 130 30)" "(box :b3 \"msg 60 63 68\" 220 30)"
                    "(box :b4 \"msg 59 63 68\" 310 30)" "(box :b5 \"tonnetz midi\" 40 80)" "(box :b6 \"print\" 40 340)"
                    "(connect :b1 0 :b5 0)" "(connect :b2 0 :b5 0)" "(connect :b3 0 :b5 0)" "(connect :b4 0 :b5 0)" "(connect :b5 0 :b6 0)")
    :try "Click the four messages in order: C, c, A♭, g♯ — P, L, P: each step crosses one edge of the lattice. Press a node to hear which class it is (its number comes out on the right)."
    :see ["pcclock" "fourier" "mt"]}

   "euclid"
   {:package "@kairotic/rhythm" :usage "euclid [k 3] [n 8] [rotation 0]"
    :about "**A Euclidean rhythm: k onsets spread as evenly as they can be over n pulses**, by Bjorklund's algorithm — Euclid's, for the greatest common divisor, on ones and zeros. Toussaint showed that it writes rhythms of the whole world: `euclid 3 8` is the tresillo (3-3-2), `euclid 5 8` the cinquillo, `euclid 5 16` a rotation of the bossa nova (`euclid 5 16 6` the bossa nova itself), `euclid 7 12` the bembé.

**A generator, almost a function**: it sends **pulses**, ones and zeros (`[1 0 0 1 0 0 1 0]`) — what every rhythm box takes, as Hz are what pitch boxes take. It has no view: a `necklace` after it shows the rhythm, lets you edit it, measures it and writes it as a musical tree with pitches (`euclid → necklace → tree`)."
    :args [[:k "how many onsets"]
           [:n "how many pulses"]
           [:rotation "the pulse it starts on (a rotation of the necklace)"]]
    :doc "A Euclidean rhythm (Bjorklund, after Toussaint), as pulses: k onsets as evenly as they can be over n pulses, from pulse rotation on. A generator: a necklace after it shows, edits, measures it and writes it as a tree."
    :inlets ["a bang: send the pulses · a number: k · [:k 5], [:n 16], [:rotation 2] (or a map of them): change them, and send them when they are new"]
    :outlets ["the pulses, ones and zeros ([1 0 0 1 0 0 1 0]), for a necklace (or any box that takes a list)"]
    :messages [[":bang" "sends the pulses"]
               ["[:k 5]" "five onsets (a number alone is k too)"]
               ["[:n 16]" "sixteen pulses"]
               ["[:rotation 6]" "starts on the seventh pulse"]]
    :example (lines "(box :b1 \"msg :bang\" 40 20)" "(box :b2 \"msg [:k 5]\" 120 20)" "(box :b3 \"msg [:n 16]\" 210 20)" "(box :b4 \"msg [:rotation 6]\" 310 20)"
                    "(box :b5 \"euclid 3 8\" 40 70)" "(box :b6 \"necklace\" 40 120)" "(box :b7 \"tree\" 280 120)" "(resize :b7 420 160)" "(box :b8 \"print\" 40 390)"
                    "(connect :b1 0 :b5 0)" "(connect :b2 0 :b5 0)" "(connect :b3 0 :b5 0)" "(connect :b4 0 :b5 0)" "(connect :b5 0 :b6 0)" "(connect :b6 0 :b7 0)" "(connect :b6 3 :b8 0)")
    :try "Click bang: the tresillo, 3-3-2 — the necklace draws it, the tree box writes it as eighths in 4/4, and its measures go to the REPL. Click [:k 5]: the cinquillo; [:n 16]: five in sixteen; [:rotation 6]: the bossa nova, which the necklace names E(5,16) ↻6. Press pulses on the necklace to make it your own."
    :see ["necklace" "tree" "mt"]}

   "necklace"
   {:package "@kairotic/rhythm" :usage "necklace [n 16] [bars 1] [midi] [fourier]"
    :about "**A rhythm that repeats is a necklace**: k onsets among n pulses around a circle, time clockwise from the top. Seen so it is the same object as a pitch-class set on `pcclock`, and Toussaint measures it with the same geometry. It is **the rhythm box**: generators (`euclid`) make pulses; the necklace holds them, draws them, is their editor — pressing a pulse adds or takes away an onset —, measures them and writes them as music.

**Its measures** go out on the right: the **interval vector** — how often each distance between onsets occurs (the son clave: `[0 1 2 2 0 3 2 0]`) —, its **evenness** — the sum of the chords between all pairs of onsets (Block and Douthett: arcs would score the six 4/4 claves the same) — and `:even`, that sum against the Euclidean rhythm's; **deep** when each distance occurs a different number of times (the bembé, as the diatonic scale), **flat** when each occurs once; its **axes** of mirror symmetry, drawn across the circle; its longest **gap**; rhythmic **oddity** (no two onsets halve the cycle); `:euclid`, the rotation of E(k,n) it is; and its **Fourier coefficients** (after Amiot and Milne): |f1| near 0 is a balanced rhythm, |f_k| is largest when k onsets are maximally even, and the others are its periodicities — with the word `fourier` they are drawn as bars.

**As music**: a musical tree for a `tree` box (a bar of n pulses with an `:rtm` whose shares are the intervals between onsets), its `:rtm` map alone, and its pulses. Its right inlet gives the notes their pitches in turn, starting again when they run out — *talea* and *color*: a keyboard's chord, a melody string, a map `{:pitches …}`, the pattern of `comes`; with `bars` the color goes on from bar to bar."
    :args [[:n "how many pulses before a rhythm arrives (a rhythm brings its own)"]
           [:bars "how many bars the tree repeats it, the pitches going on"]
           [:midi "numbers on the right inlet are MIDI notes (62), not Hz"]
           [:fourier "its Fourier magnitudes drawn too, a bar each"]]
    :doc "A cyclic rhythm on the circle and its geometry (Toussaint): drawn as a polygon with its axes of symmetry; pressing a pulse adds or takes away an onset. Out as euclid (a tree, the :rtm map, the pulses) and its measures: interval vector, evenness, deep, flat, axes, longest gap, oddity, the rotation of E(k,n) it is."
    :inlets ["a rhythm: pulses ([1 0 0 1 0 0 1 0], euclid's right outlet), intervals ([3 3 2]), box notation (\"x..x..x.\"), an :rtm map ({:shares [3 3 2]}), a tree with an :rtm, or {:onsets [0 3 6] :n 8} · a number: that pulse added or taken away · :complement · [:rotate 1] · [:n 12] · [:bars 2] · [:meter \"3/4\"] · :clear · a bang sends it again"
             "the pitches (cold), as euclid's: a list of Hz (MIDI with midi), a melody string, a map with :pitches or :pitch, a pattern {:note [...]} · :clear"
             "the clock (as a step sequencer): a bang moves the hand to the next pulse and plays it — a bang out of outlet 4 on an onset · a number: the hand to that pulse · :reset: the next bang plays the first pulse"]
    :outlets ["the rhythm as a musical tree, for a tree box (as euclid's)" "the :rtm map alone, to merge with pitches" "the pulses, ones and zeros"
              "its measures: {:n :k :onsets :intervals :ivec :evenness :even :deep :flat :axes :gap :oddity :euclid :fourier :phases}"
              "played step by step: a bang on each onset the hand reaches (for a player's left inlet: one event a step; a sample…)"]
    :messages [["\"x..x..x...x.x...\"" "the son clave, in box notation"]
               ["[3 3 2]" "the tresillo, as intervals"]
               [":complement" "onsets and silences swapped"]
               ["[:rotate 1]" "it starts a pulse later"]
               ["[:n 12]" "a circle of twelve pulses (onsets past it are lost)"]]
    :example (lines "(box :b1 \"msg \\\"x..x..x...x.x...\\\"\" 40 20)" "(box :b2 \"msg \\\"x..x...x..x.x...\\\"\" 220 20)" "(box :b3 \"msg \\\"x..x..x...x..x..\\\"\" 400 20)"
                    "(box :b4 \"necklace\" 40 70)" "(box :b5 \"print\" 40 340)" "(box :b6 \"tree\" 280 70)" "(resize :b6 420 160)"
                    "(connect :b1 0 :b4 0)" "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b4 3 :b5 0)" "(connect :b4 0 :b6 0)")
    :try "Click the son, the rumba and the bossa nova (three of Toussaint's six 4/4 claves): each necklace, its axes, and its measures in the REPL — the son's interval vector [0 1 2 2 0 3 2 0], the rumba less even than the bossa nova, the bossa nova E(5,16) from pulse 6. Press pulses to make one of your own: the tree box follows."
    :steps [{:title "Played step by step"
             :note "A necklace is also a step sequencer, the clock of Toussaint's article: each bang on its right inlet moves the hand to the next pulse, and on an onset a bang goes out of outlet 4. Into a player's left inlet, it plays one event of its pattern a step — the rhythm the necklace's, the pitches the pattern's. Press pulses while it plays: the hand finds what you changed at once."
             :example (lines "(box :b21 \"loadbang\" 400 290)" "(box :b15 \"metro 150\" 520 290)" "(box :b22 \"counter 0 15\" 400 440)" "(box :b23 \"click~ 500 0 0.06 downbeat\" 400 490)" "(box :b16 \"player 120\" 520 340)" "(box :b17 \"pbind 7 loop\" 640 290)"
                             "(code :b17 \"{:degree #pat/shuffle [0 2 4 7 9]}\")" "(box :b18 \"synth~\" 520 390)" "(box :b19 \"dac~\" 520 440)" "(box :b20 \"click~ 1200 4\" 400 390)"
                             "(connect :b15 0 :b4 2)" "(connect :b4 4 :b16 0)" "(connect :b17 0 :b16 1)" "(connect :b16 0 :b18 0)" "(connect :b16 1 :b18 1)"
                             "(connect :b18 0 :b19 0)" "(connect :b18 0 :b19 1)" "(connect :b21 0 :b15 0)" "(connect :b15 0 :b22 0)" "(connect :b22 0 :b23 0)" "(connect :b23 0 :b19 0)" "(connect :b23 0 :b19 1)" "(connect :b15 0 :b20 0)" "(connect :b20 0 :b19 0)" "(connect :b20 0 :b19 1)")
             :try "Click the son clave above, press ▶ (the loadbang starts the metro): the hand turns, and every onset it reaches plays the next note of the pbind. Press pulses on the necklace while it plays. The lower click is the counter's 0, where each turn of the hand begins."}
            {:title "Pitches: talea and color"
             :note "The right inlet gives the notes their pitches, in turn, starting again when they run out: four pitches over the five onsets of the son take four bars to meet the rhythm again, as the color and the talea of an isorhythmic motet. It is cold: what arrives there sounds the next time the box sends. A keyboard sends the keys held, in Hz; a melody string or a map {:pitches …} is kept as it is."
             :example (lines "(box :b9 \"msg {:pitches \\\"c4 e4 g4 b4\\\"}\" 720 20)" "(box :b10 \"msg [:bars 4]\" 580 20)"
                             "(box :b11 \"mt play loop\" 280 260)" "(box :b12 \"msg :bang\" 400 262)" "(box :b13 \"synth~\" 280 310)" "(box :b14 \"dac~\" 280 360)"
                             "(connect :b9 0 :b4 1)" "(connect :b10 0 :b4 0)" "(connect :b6 0 :b11 0)" "(connect :b12 0 :b11 0)"
                             "(connect :b11 0 :b13 0)" "(connect :b11 1 :b13 1)" "(connect :b13 0 :b14 0)" "(connect :b13 0 :b14 1)")
             :try "Click {:pitches \"c4 e4 g4 b4\"}, then the son clave above, then [:bars 4]: C E G B over the onsets, the color going on from bar to bar. Press ▶ and click the bang of mt play to hear it."}]
    :see ["euclid" "pcclock" "fourier" "tree"]}

   "chance"
   {:package "@kairotic/rhythm" :usage "chance [k 3] [n 8] [seed 1]"
    :about "**A generator of pulses, as `euclid`, with chance instead of evenness**: each bang draws another rhythm of k onsets among n pulses. The draws are the seed's: the same seed gives the same rhythms in the same order — for everyone in a room, and again from the history —, and `:reset` starts them again. Into a `necklace`, its measures say how even or uneven chance came out."
    :args [[:k "how many onsets"] [:n "how many pulses"] [:seed "the seed of its chance: the same seed, the same rhythms"]]
    :doc "A generator of pulses with chance: each bang draws another rhythm of k onsets among n pulses, the seed's draws (the same seed, the same rhythms in the same order)."
    :inlets ["a bang: the next draw · :reset: its draws again from the first · a number: k · [:k 5], [:n 16], [:seed 7] (or a map of them): change it and start again"]
    :outlets ["the pulses, ones and zeros, for a necklace"]
    :messages [[":bang" "the next rhythm"] [":reset" "the draws again from the first"] ["[:seed 7]" "another seed (and start again)"]]
    :example (lines "(box :b1 \"msg :bang\" 40 20)" "(box :b2 \"msg :reset\" 120 20)" "(box :b3 \"chance 5 16 7\" 40 70)"
                    "(box :b4 \"necklace\" 40 120)" "(box :b5 \"print\" 40 390)"
                    "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)" "(connect :b4 3 :b5 0)")
    :try "Click bang several times: five onsets in sixteen, a different rhythm each time — the necklace draws it and its measures say how even it is (:even, against E(5,16)). Click :reset and bang again: the same rhythms come back, in the same order."
    :see ["euclid" "necklace" "homometric"]}

   "homometric"
   {:package "@kairotic/rhythm" :usage "homometric"
    :about "**Homometric rhythms hold the same distances between onsets, as many times each** — the same interval vector — without being the same necklace turned or seen in a mirror. Toussaint takes the word from crystallography, where two different crystals can give the same pattern of distances. The two flat rhythms of four onsets in twelve (each distance once) are homometric; so is any half of the pulses of an even cycle with its complement: two drums, high and low congas, with the same intervals.

Given a rhythm as pulses, it searches every rhythm of as many onsets among as many pulses — any rhythm of 16 pulses, a moment for the largest — and sends the others it finds."
    :doc "The other rhythms with the same interval vector: given pulses, it sends the rhythms homometric with them (each from its first onset), and how many there are."
    :inlets ["pulses: the rhythm whose homometric partners are searched · a bang: search again"]
    :outlets ["the homometric rhythms, a list of pulses (empty when there are none): one by one with nth, to a necklace" "how many there are"]
    :example (lines "(box :b1 \"msg [1 1 0 0 1 0 1 0 0 0 0 0]\" 40 20)" "(box :b2 \"homometric\" 40 70)" "(box :b3 \"nth % 0\" 40 120)"
                    "(box :b4 \"necklace\" 40 170)" "(box :b5 \"necklace\" 280 170)" "(box :b6 \"print how-many\" 180 120)"
                    "(connect :b1 0 :b2 0)" "(connect :b1 0 :b5 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)" "(connect :b2 1 :b6 0)")
    :try "Click the rhythm: x x . . x . x . . . . . has each distance once (a flat interval vector, <1 1 1 1 1 1>). homometric finds the only other necklace of four onsets in twelve that does too: x x . x . . . x . . . . — compare both necklaces' measures."
    :see ["necklace" "swap" "chance"]}

   "swap"
   {:package "@kairotic/rhythm" :usage "swap"
    :about "**How far apart two rhythms are**: Toussaint's swap distance. A swap exchanges an onset and the silence beside it, and the distance is how many turn one rhythm into the other — an onset moved far counts more than one moved near, which the Hamming distance (how many pulses differ) cannot tell. With different numbers of onsets it is the *directed* swap distance: each onset of the shorter rhythm goes to its own onset of the other (the tresillo is 0 from the cinquillo: it is inside it).

**Three readings**: in the bar (`:swap`); around the circle, a swap crossing the end of the bar (`:circular`); and as necklaces, the reference turned to where it comes nearest (`:necklace`, and `:rotation`). For the futuribles and the agents: is a variation still the same timeline?"
    :doc "How far apart two rhythms of n pulses are (Toussaint's swap distance): the left inlet compared with the right one (the reference, cold); a map {:swap :circular :necklace :rotation :hamming :necklace-hamming :n :k}."
    :inlets ["pulses: the rhythm compared (a bang compares again)" "pulses: the reference (cold)"]
    :outlets ["{:swap — in the bar —, :circular — around the circle —, :necklace — at the best rotation of the reference — and :rotation, :hamming, :necklace-hamming, :n, :k [onsets of each]}"]
    :example (lines "(box :b1 \"msg [1 0 0 1 0 0 1 0 0 0 1 0 1 0 0 0]\" 40 20)" "(box :b2 \"msg [1 0 0 1 0 0 0 1 0 0 1 0 1 0 0 0]\" 40 50)" "(box :b3 \"msg [1 0 0 1 0 0 1 0 0 0 1 0 0 1 0 0]\" 40 80)"
                    "(box :b4 \"msg [1 0 0 1 0 0 1 0 0 0 1 0 1 0 0 0]\" 400 20)" "(box :b5 \"swap\" 40 130)" "(box :b6 \"print\" 40 180)"
                    "(connect :b4 0 :b5 1)" "(connect :b1 0 :b5 0)" "(connect :b2 0 :b5 0)" "(connect :b3 0 :b5 0)" "(connect :b5 0 :b6 0)")
    :try "Click the son clave on the right first (the reference), then the three on the left: the son itself (0), the rumba (1: one onset a pulse later) and the bossa nova (1). The Hamming distance says 2 for both: it cannot tell how far an onset moved."
    :see ["necklace" "homometric" "euclid"]}

   "morph"
   {:package "@kairotic/rhythm" :usage "morph [ratio 0]"
    :about "**From one rhythm to another, swap by swap.** Toussaint's swap distance does not only say how far two rhythms are: it gives the way — the swaps, an onset exchanged with the silence beside it, that turn one into the other with the fewest moves. A ratio between 0 and 1 is a point on that way: the rhythm after that share of its swaps, always a real rhythm, never a blurred average. Move the ratio with a knob, a ramp or a line, and one rhythm becomes the other (discussion #206: merging two branches as a musical operation).

**The way is data too**: a list of steps, `[:swap from to]`, `[:remove i]`, `[:add j]` — the same operations a distance counts are the ones a morph makes (discussion #321: one grammar read both ways). The onsets are paired in order; with different numbers of onsets, as the directed swap distance pairs them: the ones of the first rhythm left over go first, those of the target appear last. The swaps take turns, one pulse each, so the rhythm changes evenly along the way."
    :args [[:ratio "where on the way it starts (0 the first rhythm, 1 the target)"]]
    :doc "From one rhythm to another, swap by swap: the rhythm after a share 0…1 of the swaps that turn the left one into the target, and the way as data."
    :inlets ["pulses: the rhythm the way starts from · a number: the ratio · a bang: send it again" "pulses: the target (cold)" "the ratio, 0…1"]
    :outlets ["the pulses at the ratio" "the way: {:steps [[:swap from to] [:remove i] [:add j] …] :swaps :at :of}"]
    :example (lines "(box :b1 \"msg [1 0 0 1 0 0 1 0 0 0 1 0 1 0 0 0]\" 40 20)" "(box :b2 \"msg [1 0 0 0 1 0 0 0 1 0 0 0 1 0 0 0]\" 360 20)"
                    "(box :b3 \"knob 0 1\" 640 20)" "(box :b4 \"morph\" 40 110)" "(box :b5 \"necklace\" 40 160)" "(box :b6 \"print way\" 280 160)"
                    "(connect :b2 0 :b4 1)" "(connect :b1 0 :b4 0)" "(connect :b3 0 :b4 2)" "(connect :b4 0 :b5 0)" "(connect :b4 1 :b6 0)")
    :try "Click the four quarter notes (the target, on the right), then the son clave: the knob turns the son into the quarter notes, swap by swap — the necklace shows every rhythm on the way, and its measures say how the evenness grows."
    :see ["vary" "swap" "necklace"]}

   "vary"
   {:package "@kairotic/rhythm" :usage "vary [d 1] [seed 1] [depth] [downbeat]"
    :about "**Again, but different** (discussion #207), with a measured likeness, drawn with a seed — the same seed, the same variations in the same order; each bang the next one.

**By swaps** (the default): exactly d swaps away, Toussaint's distance. Each swap takes an onset one pulse further from where it was, never past a neighbour: `vary 1` is the same timeline with one onset displaced, larger d drifts further.

**From a depth** (`depth`): the onsets on the strong pulses are kept, down to metrical level d — 0 the downbeat, 1 the half bar, 2 the quarters of 16… (the bar's levels are its factors, twos first: 16 is 2·2·2·2, 12 is 2·2·3) —, and the others are drawn again among the weaker pulses: the same skeleton, a new surface. It is discussion #321's *vary from depth k*, with metre as its grammar. With `downbeat`, the first pulse always keeps what it has."
    :args [[:d "how far: swaps, or with depth the deepest level kept"] [:seed "the seed: the same seed, the same variations"]
           [:depth "keep the strong pulses down to level d, draw the rest again"] [:downbeat "the first pulse keeps what it has"]]
    :doc "Again, but different: a variation of a rhythm, d swaps away or redrawn below metrical depth d, drawn with a seed; out the pulses and how they were made."
    :inlets ["pulses: the rhythm to vary (a new one: its first variation) · a bang: the next variation · :reset · [:d 2], [:seed 7] (or a map)"]
    :outlets ["the variation, pulses" "how it was made: {:steps [[:swap from to] or [:remove i] [:add j] …] :mode :d :seed :draw, and :swaps, or :changed and :kept}"]
    :example (lines "(box :b1 \"msg [1 0 0 1 0 0 1 0 0 0 1 0 1 0 0 0]\" 40 20)" "(box :b2 \"msg :bang\" 360 20)"
                    "(box :b3 \"vary 2 7\" 40 70)" "(box :b4 \"necklace\" 40 120)" "(box :b5 \"vary 1 7 depth\" 280 70)" "(box :b6 \"necklace\" 280 120)"
                    "(box :b7 \"swap\" 520 120)" "(box :b8 \"print\" 520 170)"
                    "(connect :b1 0 :b3 0)" "(connect :b1 0 :b5 0)" "(connect :b2 0 :b3 0)" "(connect :b2 0 :b5 0)"
                    "(connect :b3 0 :b4 0)" "(connect :b5 0 :b6 0)" "(connect :b1 0 :b7 1)" "(connect :b3 0 :b7 0)" "(connect :b7 0 :b8 0)")
    :try "Click the son clave, then bang several times: on the left, variations two swaps away (swap prints 2 each time); on the right, the downbeat kept (level 0 and 1), the other onsets drawn again — the same skeleton, a new surface."
    :see ["morph" "swap" "chance" "necklace"]}

   "phase"
   {:package "@kairotic/rhythm" :usage "phase [min 0]"
    :about "**Where a performer is in a cycle, from the onsets heard** (discussion #204). Before following a score, follow a timeline: a clave, a bell pattern, any rhythm that repeats. Musicians keep their place in a cycle this way, and it needs no pitch.

**A pulse clock gives the grid** — a `metro` at the pulse, or the room's `pulse` — and the onsets (`onset~`'s bangs, or taps) fall on its nearest pulse. At each pulse the last pulses heard are compared with every rotation of the reference, by Toussaint's swap distance: the nearest says which pulse of the reference this one is — the **phase**. The pulse that has just begun is not judged, since its onset may come a moment late: the last whole pulse is found and this one is the next. Ties and near ties go to the phase the walk expects, so a few missing or extra onsets do not throw it.

**Without a clock** — nothing on the right — it finds the pulse from the onsets themselves: the longest pulse that the intervals between them fill as whole numbers of it (the simplest grid that fits, after Sethares), each interval rounded on its own so that it follows a tempo that moves. It then says the phase at each onset, of the pulse that onset is on (the first one from five onsets), and the pulse it found in seconds on the right.

Into a `necklace`'s clock inlet the phase moves its hand there and plays it: the electronics stay in the performer's cycle. Times a pulse's beats, it is a `player`'s position."
    :args [[:min "how many pulses must be heard before it says a phase (half the cycle by default)"]]
    :doc "Where a performer is in a cycle (a timeline follower, onsets only): onsets on the left, the reference as pulses in the middle (cold), the pulse clock on the right; at each pulse, the phase — which pulse of the reference this one is. Without a clock it finds the pulse from the onsets and says the phase at each onset."
    :inlets ["onsets: a bang each (onset~, or taps) · :reset forgets what was heard" "the reference, as pulses (cold): a clave, a bell pattern, euclid's or a necklace's" "the pulse clock: a bang each pulse (a metro, the room's pulse) — without one, the pulse is found from the onsets"]
    :outlets ["the phase: the pulse of the reference this one is (for a necklace's clock inlet)" "{:phase :distance — 0: exactly the reference — :margin — how much nearer than the next guess; 0 ambiguous — :heard :window :n :pulse — in seconds}"]
    :example (lines "(box :b1 \"msg [1 0 0 1 0 0 1 0 0 0 1 0 1 0 0 0]\" 40 20)" "(box :b11 \"loadbang\" 360 0)" "(box :b2 \"metro 125\" 360 40)" "(box :b3 \"adc~ 1\" 520 20)"
                    "(box :b4 \"onset~\" 520 70)" "(box :b5 \"bang\" 640 70)" "(box :b6 \"phase\" 360 130)"
                    "(box :b7 \"necklace\" 40 180)" "(box :b8 \"print phase\" 360 180)"
                    "(box :b9 \"click~ 1200 4\" 240 70)" "(box :b12 \"click~ 500 0 0.06 downbeat\" 500 230)" "(box :b10 \"dac~\" 360 280)"
                    "(connect :b1 0 :b6 1)" "(connect :b1 0 :b7 0)" "(connect :b11 0 :b2 0)" "(connect :b2 0 :b6 2)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b6 0)" "(connect :b5 0 :b6 0)"
                    "(connect :b6 0 :b7 2)" "(connect :b6 1 :b8 0)" "(connect :b6 0 :b12 0)"
                    "(connect :b2 0 :b9 0)" "(connect :b9 0 :b10 0)" "(connect :b9 0 :b10 1)" "(connect :b12 0 :b10 0)" "(connect :b12 0 :b10 1)")
    :try "Click the son clave (the reference), press ▶ — the loadbang starts the metro, the pulse, a sixteenth at 120, and click~ lets you hear it, the beats accented —, and clap (with headphones, so the microphone hears you and not the click) the son into the microphone (or tap the bang), starting anywhere in it: after half a cycle the necklace's hand finds where you are and follows you, playing the onsets it expects; a lower click sounds where the follower believes the clave begins (its phase 0, through click~ downbeat): if it falls on your first clap of the clave, you and it agree. Stop for a moment and go on: it keeps walking."
    :see ["necklace" "swap" "onset~" "follow"]}

   "cac"
   {:package "@kairotic/cac" :usage "cac partimento|judge [voices 4] [key] [temp 0.5] [seed 1] [unit 0]"
    :about "**mt changes a tree and does not question it; cac adds to it, or questions it, by the rules of a style.** Its operations take a tree as what is given and look ahead — the kernel of Studies 51–62 (IJzerman's *Harmony, Counterpoint, Partimento*).

**cac partimento** — a bass in, the voices above it out. Send it a tree: its lowest voice is the bass (its notes may carry figures, `:fig \"6/5\"`, and a key of their own, `:local \"G major\"`). Out comes a tree for a `tree` box: soprano, alto and tenor over the bass (`[:voices 3]` or `2` for fewer), written by the engine — its soft rules prefer steps, the leading tone up, the bass doubled — among the realizations it counts exactly. A bang writes another one, `:any` any valid one, each as likely.

**cac judge** — a tree of voices in, the lowest the bass: whether they keep the rules, and where and why they do not (parallel 5ths between the alto and the tenor, the 7th not going down…), and the chords they make.

**The analysis layer.** The bass comes back with what the analysis found on its notes: the chord made over each (`:fig`), its degree (`:deg`), its key where it is read in another (`:local`). A tree box's code window hides it, as it hides the performance; **Analysis** in its bar shows it, and an edit of the written notes keeps it."
    :args [[:op "partimento (a bass in, the upper voices out) or judge (voices in, the rules kept or not)"]
           [:voices "how many parts: 4 (soprano, alto, tenor, bass), 3 or 2"]
           [:key "the key: C, G, Eb… major, a lower-case letter minor (e, f#); else the tree's :key, else guessed from the bass"]
           [:temp "the engine's chance: 0 always its cheapest, higher more free"]
           [:seed "the seed of its chance"]
           [:unit "the beats a chord lasts: 0, the shortest note of the bass"]]
    :doc "Composition assisted by computer on a tree, beside mt (discussion #323): cac partimento writes the voices above a bass (2–4 parts, by the rules of Studies 51–62, its figures if it has them), counting the realizations; cac judge says whether voices keep the rules, where and why not. What it finds is written as the tree's analysis layer (:fig, :deg, :local), shown in the code window with Analysis."
    :inlets ["a tree (the given: a bass, or voices to judge) · a bang: another realization · :any: any valid one · [:voices 3], [:key \"a minor\"], [:temp 1], [:seed 7], [:unit 2]: done again"]
    :outlets ["the tree: the upper voices, then the bass with its analysis (:fig :deg :local)" "what it counted, or why not: {:count :key …}; judging, {:ok :why :chords}"]
    :messages [["bang" "another realization by the engine"] [":any" "any valid one, each as likely"]
               ["[:voices 3]" "three parts (or 2, 4)"] ["[:key \"e\"]" "another key (lower case: minor)"]
               ["[:temp 1]" "more chance in the engine"] ["[:seed 7]" "its chance: the same seed, the same realization"]]
    :example (lines "(box :b1 \"tree\" 40 30)" "(resize :b1 420 120)"
                    "(code :b1 \"[:voice {:key \\\"C major\\\"} [:note {:pitch \\\"c3\\\" :dur 2}] [:note {:pitch \\\"d3\\\" :dur 2 :fig \\\"6/4/3\\\"}] [:note {:pitch \\\"e3\\\" :dur 2 :fig \\\"6/3\\\"}] [:note {:pitch \\\"f3\\\" :dur 2 :fig \\\"6/5\\\"}] [:note {:pitch \\\"g3\\\" :dur 2}] [:note {:pitch \\\"a3\\\" :dur 2 :fig \\\"6/3\\\"}] [:note {:pitch \\\"b3\\\" :dur 2 :fig \\\"6/5\\\"}] [:note {:pitch \\\"c4\\\" :dur 2}]]\")"
                    "(box :b2 \"cac partimento\" 40 170)" "(box :b3 \"tree\" 40 230)" "(resize :b3 420 200)" "(box :b4 \"print\" 260 170)"
                    "(box :b5 \"bang\" 480 30)" "(box :b6 \"bang\" 260 120)"
                    "(connect :b5 0 :b1 0)" "(connect :b1 0 :b2 0)" "(connect :b6 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b2 1 :b4 0)")
    :try "Click the bang beside the tree: its bass — the Rule of the Octave going up, its figures 6/4/3 on ②, 6/5 on ④ and ⑦ — goes into cac partimento, and the four parts come out as a score; print says how many there are. Click the bang over cac for another; open its code (double-click) and press Analysis to see the chords it made over the bass."
    :see ["tree" "mt" "comes"]}

   "comes"
   {:package "@kairotic/cac" :usage "comes [system] [mode] [speed 1] [k -7] [d 3] [beats 2] [imitation 1] [bars 0] [upbeat 0] [temp 0] [seed 1] [inverted] [fourth] [live] [nocues] [midi]"
    :about "**You play a line, the dux, and comes answers with a second voice, the comes, that reads it** — by the rules of 16th-century counterpoint. A note that breaks a rule, or from which the work could not be finished, is corrected to the nearest one that can be played, and the box says why.

**The comes is a reader of the dux at a speed.** `1` (the default) is a canon: the dux again, `d` beats later. `0.5` reads it twice as slow, an augmentation. `-1` reads it backwards: a **crab**, the two voices sounding at once so that the work reads the same from either end. `inverted` turns the comes upside down: an inversion, or with `-1` a **table canon**, one score read by two players from opposite sides of a table. `k` is how far away it reads: −7 an octave below.

**The speed decides how it is played.** Forwards (1, 0.5) you play the dux and the comes answers. By turns (the default) each note you send is a beat, and the same note again, or `:hold`, holds it over the beat. With **live** a pulse on the right inlet (a `metro`) gives the beats: a note lasts until you play the next, held three beats in 2/2 the canon turns to 3/2, longer than a bar the section ends. Backwards (−1) the work cannot start at the beginning — the comes's first note is the dux's last — so it is written **from both ends to the middle**: by turns a note at the start, then one at the end; **live**, you play and the box answers at the same beat with the end of your own line, and at the middle the rest of your line comes out as a score to read while the box plays your first half backwards.

**Where it plays: a system and one of its modes.** The **system** is the scale, its tuning and its rules: `diatonic` (the default), `meantone`, `septimal31`, `pentatonic`, or your own as EDN. The **mode** — `dorian` (the default), `hypodorian`, `ionian`, `aeolian`…; `penta-C`, `penta-A`, `penta-D` in the pentatonic — sets the final, the range and the notes to begin on. Write them in the box in any order: `comes hypodorian`, `comes pentatonic penta-A -1 inverted`.

**What comes out.** Both voices sounding as Hz with their voice ids — one `synth~`, connected 0→0 and 1→1, plays both —; the **futuribles**, the notes you can play next, each with the ways it leaves to finish the work, counted exactly; where the work is; and, when it is finished, the whole work as a musical tree for a `tree` box (and `mt play` to hear it again)."
    :args [[:system "the scale, its tuning and its rules: diatonic (by default), meantone, septimal31 or pentatonic"]
           [:mode "one of the system's modes: dorian (by default), hypodorian, ionian, mixolydian, aeolian and their plagals; penta-C, penta-A, penta-D in the pentatonic"]
           [:speed "how the comes reads the dux: 1 a canon · 0.5 twice as slow (an augmentation) · −1 backwards (a crab)"]
           [:k "how far away the comes reads it, in steps of the scale: −7 an octave below, −4 a 5th below, 0 at the unison"]
           [:d "forwards: how many beats after the dux the comes comes in"]
           [:beats "beats in a bar: 2 (2/2) or 3 (3/2)"]
           [:imitation "forwards: 1 a strict canon · 0.5–0.9 the comes near the dux's notes · 0.2–0.4 only following its motion · below, free"]
           [:bars "how long the work is, in bars: 0, the relation's own — 8 forwards, 6 backwards (a crab of more bars takes longer to count)"]
           [:upbeat "forwards: beats of rest before the first note (an anacrusis)"]
           [:temp "chance: at 0 always the most plausible; higher, the box draws among the candidates"]
           [:seed "the seed of its chance: the same seed, the same game"]
           [:inverted "the comes upside down, about the final (or [:axis 62]): an inversion, or with −1 a table canon"]
           [:fourth "forwards: fourth species, your line a cantus firmus (a note a bar) and the comes syncopated"]
           [:live "played on a pulse (the right inlet), or without one a note a beat, instead of by turns"]
           [:nocues "live, forwards: it does not turn to 3/2 or end the section by itself; other boxes decide, with [:beats 3] and :end"]
           [:midi "numbers in are MIDI notes (62), not Hz"]]
    :doc "Counterpoint live (Studies 41–46, 50): the comes reads the dux at a speed — 1 a canon, 0.5 an augmentation, −1 a crab, written from both ends to the middle —, upside down with inverted (an inversion, or a table canon). Each note is checked against the rules of the style and against the future, and corrected to the nearest one that can be played. Forwards you play the dux and the comes answers, by turns or live on a pulse; backwards, a note at the start and then one at the end, or live, the box answering at the end of your own line. The system (Study 42) is diatonic by default, or meantone, septimal31, pentatonic, or an EDN map; the finished work comes out as a musical tree."
    :inlets ["the dux's next note (backwards: at the start, then at the end): Hz (a number, or the list of notes held, as a keyboard or midiin sends them), [:midi 62], or an event (:freq from midiin, or a player's :hz) · :hold (forwards, by turns) · :engine · :back · :reset · :end (forwards: the section ends) · [:speed -1], [:inverted true], [:k -4], [:d 2], [:imitation 0.5], [:mode :hypodorian], [:system :pentatonic], [:bars 5], [:beats 3], [:species 4], [:axis 62]: the work changed"
             "live: the pulse (a bang from a metro or a pulse): a beat"]
    :outlets ["the Hz of both voices sounding, as a keyboard or a player sends them — the dux as played (or corrected) and the comes" "their voice ids, sent first (for a synth~'s right inlet): a note held keeps its id and goes on sounding" "the futuribles: the notes that can come next, with their futures ({:midi :name :futures …}; backwards live, with :end, what the box will answer at the end of your line)" "where the work is: forwards {:t :n :bar :beat :held :asked :played :corrected :reason :futures :obligations :section :meter …} or a cue {:cue :ternary|:end}; backwards {:step :steps :writing :beat :futures :dux :comes :closed …} or live {:t :phase :you :engine :ways …}, with the cue {:cue :middle :in 2}" "the work as a musical tree, both voices (for a tree box, its score): when it is finished; backwards live also at the middle, what is left of your line to read"]
    :messages [["[:midi 62]" "a MIDI note as the next note (Hz, a keyboard's list or an event also)"]
               [":engine" "the box plays the next note itself (backwards live: a beat, with the box playing yours)"]
               [":hold" "forwards, by turns: the note held over the next beat (a tie)"]
               [":back" "the last note taken back"]
               [":reset" "a new work"]
               [":end" "forwards: the section ends, the next note begins a new canon"]
               ["[:speed -1]" "another relation: −1 a crab, 0.5 an augmentation, 1 a canon (a new work)"]
               ["[:inverted true]" "the comes upside down: an inversion, or backwards a table canon (a new work)"]
               ["[:system :pentatonic]" "another system (or an EDN map {:tuning … :modes …})"]
               ["[:mode :hypodorian]" "another mode of the system"]
               ["[:k -4]" "the comes a 5th below"]
               ["[:d 2]" "forwards: the comes two beats after the dux"]
               ["[:imitation 0.5]" "forwards: less imitation, the comes near the dux's notes"]
               ["[:bars 5]" "another length"]
               ["[:beats 3]" "3/2"]
               ["[:species 4]" "fourth species (with [:beats 2])"]
               ["[:axis 62]" "the axis of inverted, a MIDI note (the final by default)"]
               ["[:temp 1.5]" "chance in the box's choices (0: the futuribles' choice)"]
               ["[:seed 7]" "its chance: the same seed, the same game (:reset plays it again)"]]
    :example (lines "(box :b1 \"keyboard 60 24\" 40 30)" "(box :b2 \"comes\" 40 130)" "(box :b3 \"synth~\" 40 200)"
                    "(box :b5 \"dac~\" 40 260)" "(box :b6 \"print\" 280 200)" "(box :b7 \"msg :engine\" 220 100)"
                    "(box :b4 \"tree\" 40 320)" "(resize :b4 460 180)"
                    "(connect :b1 0 :b2 0)" "(connect :b7 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b2 1 :b3 1)"
                    "(connect :b3 0 :b5 0)" "(connect :b3 0 :b5 1)" "(connect :b2 3 :b6 0)" "(connect :b2 4 :b4 0)")
    :try "Press ▶ and play D, E, F on the keyboard: the dux. From the fourth note on the comes answers an octave below, three beats later. Play a black key, or a note against the rules: the box takes the nearest one that can be played and prints why. Click :engine to let it go on alone: when the canon is finished the tree box shows it as a score."
    :steps [{:title "Live, on a pulse"
             :note "With live, a metro gives the beats: hold a key and the note is held over them (a tie); hold it three beats in 2/2 and the canon turns to 3/2; longer than a bar, and the section ends: the next note begins a new canon. That is all comes reads of time: with nocues it leaves the meter and the sections to other boxes, which send [:beats 3] and :end."
             :example (lines "(box :b8 \"metro 600\" 380 100)" "(box :b9 \"msg 1\" 380 70)" "(box :b10 \"comes live\" 380 160)"
                             "(connect :b9 0 :b8 0)" "(connect :b8 0 :b10 1)" "(connect :b1 0 :b10 0)" "(connect :b10 0 :b3 0)" "(connect :b10 1 :b3 1)" "(connect :b10 3 :b6 0)")
             :try "Press ▶, click 1 to start the pulse and play slowly: the comes answers on the beats. Hold a note three beats: the cue :ternary is printed."}
            {:title "Backwards: a crab, from both ends to the middle"
             :note "With speed −1 the comes is the dux backwards, so the work is written from both ends: each step a note at the start, then one at the end, and the futuribles count the ways to close it in the middle. With inverted it is also upside down: a table canon. When it closes, the tree box shows it as a score — read the comes from the end and it is the dux — and mt play plays it, both voices on one synth~."
             :example (lines "(box :b20 \"msg :engine\" 720 30)" "(box :b21 \"comes -1\" 720 80)" "(box :b22 \"tree\" 720 140)" "(resize :b22 460 180)"
                             "(box :b23 \"mt play\" 720 345)" "(box :b24 \"msg :bang\" 830 345)" "(box :b25 \"synth~\" 720 400)" "(box :b26 \"msg [:inverted true]\" 840 30)"
                             "(connect :b20 0 :b21 0)" "(connect :b26 0 :b21 0)" "(connect :b21 4 :b22 0)" "(connect :b22 0 :b23 0)" "(connect :b24 0 :b23 0)"
                             "(connect :b23 0 :b25 0)" "(connect :b23 1 :b25 1)" "(connect :b25 0 :b5 0)" "(connect :b25 0 :b5 1)")
             :try "Click :engine until the crab closes: the box writes it from both ends, and the tree box shows it. Press ▶ and click the bang of mt play: both voices on one synth~. Click [:inverted true] and :engine again: a table canon. Play notes on the keyboard into it instead (the note at the start, then the one at the end)."}
            {:title "Backwards, live"
             :note "With −1 live the crab is played beat by beat (Study 46): your note, and at the same beat the box's answer — the end of your own line, written ahead. Two beats before the middle a cue; at the middle the rest of your line comes out as the score to read (outlet 4, for a tree box), and the box plays your first half backwards while you read it. Both voices sound from it, on one synth~."
             :example (lines "(box :b11 \"keyboard 60 24\" 520 470)" "(box :b12 \"comes -1 live\" 520 590)" "(box :b13 \"synth~\" 520 660)" "(box :b15 \"loadbang\" 720 550)"
                             "(box :b16 \"html\" 860 470)" "(resize :b16 300 230)"
                             "(code :b16 \"[:div.col [:h4 \\\"beat \\\" :$t \\\" of \\\" :$n \\\" · \\\" :$phase] [:p.soft :$ways \\\" ways to close it\\\"] :$in]\")"
                             "(box :b14 \"tree\" 860 730)" "(resize :b14 460 180)"
                             "(connect :b15 0 :b12 0)" "(connect :b12 2 :b16 0)" "(connect :b12 3 :b16 0)" "(connect :b12 4 :b14 0)"
                             "(connect :b11 0 :b12 0)" "(connect :b12 0 :b13 0)" "(connect :b12 1 :b13 1)" "(connect :b13 0 :b5 0)" "(connect :b13 0 :b5 1)")
             :try "Press ▶: the loadbang counts the futures. The html box shows where the crab is and its futuribles as a table — each note you can play, the ways it leaves to close the crab, and :end, what the box will answer at the end of your line. Play D on the keyboard: the box answers with D an octave below. Play on: at the middle the tree box shows what is left of your line to read; at the end, the whole crab."}]
    :see ["keyboard" "midiin" "metro" "tree" "mt" "tonnetz"]}

   "click~"
   {:package "@kairotic/synth" :usage "click~ [freq 1200] [accent 0] [decay 0.03] [downbeat]"
    :doc "A metronome's click: each bang a short tick; every accent bangs one accented (a fifth higher, louder). A number is a tick, accented when it is 0 (a counter's cycle); with downbeat only the 0 ticks, to mark where a cycle begins."
    :args [[:freq "the tick's pitch, in Hz"] [:accent "every how many bangs one is accented (0: none)"] [:decay "how long a tick lasts, in seconds"] [:downbeat "a number ticks only when it is 0: where a cycle begins"]]
    :inlets ["a bang: a tick · a number: a tick, accented when 0 · [:gain v]: its level (0…1) · :reset: count the accents from the next bang"]
    :outlets ["the sound"]
    :example (lines "(box :b4 \"loadbang\" 40 0)" "(box :b1 \"metro 125\" 40 40)" "(box :b2 \"click~ 1200 4\" 40 90)" "(box :b3 \"dac~\" 40 190)"
                    "(box :b5 \"counter 0 15\" 180 90)" "(box :b6 \"click~ 500 0 0.06 downbeat\" 180 140)"
                    "(connect :b4 0 :b1 0)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b2 0 :b3 1)"
                    "(connect :b1 0 :b5 0)" "(connect :b5 0 :b6 0)" "(connect :b6 0 :b3 0)" "(connect :b6 0 :b3 1)")
    :try "Press ▶ (the loadbang starts the metro): sixteenths at 120, the beats accented, and a lower click where each bar of sixteen begins (the counter's 0, through click~ downbeat). Put it beside any clock you play along with — a metro, the room's pulse, a necklace's onsets."
    :see ["metro" "pulse" "phase" "necklace"]}

   "adsr~"
   {:package "@kairotic/synth" :usage "adsr~ [a d s r]"
    :doc "An envelope that follows a gate, for the factor of a gain~. Drag over it to change its shape."
    :inlets ["a gate (signal or numbers: above 0 attacks, 0 releases), a bang, or [a d s r]"]
    :outlets ["the envelope signal, 0…peak"]
    :example (lines "(box :b1 \"bang\" 40 30)" "(box :b2 \"adsr~ 10 300 0 400\" 40 80)" "(box :b3 \"osc~ 440\" 220 80)"
                    "(box :b4 \"gain~ 0\" 220 220)" "(box :b5 \"dac~\" 220 270)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b4 1)" "(connect :b3 0 :b4 0)"
                    "(connect :b4 0 :b5 0)" "(connect :b4 0 :b5 1)")
    :try "Start the engine and click the bang: a plucked note. Drag over the envelope to make it longer."
    :see ["gain~" "reader~" "synth~"]}

   "gendy~"
   {:package "@kairotic/synth" :usage "gendy~ [freq x-step y-min y-max y-step breakpoints]"
    :doc "A dynamic stochastic oscillator, after Xenakis's GENDY: a wave of breakpoints whose amplitudes and durations each take a random walk between mirror barriers, cycle after cycle — a pitch that drifts, a timbre that changes."
    :inlets ["a number: the frequency in Hz · [:x-step 30], [:y-step 0.2]…: one parameter · a list of six: all of them · a signal: added to the frequency, in Hz (FM)"]
    :outlets ["the sound (about ±0.15 by default: y-min and y-max are its barriers)"]
    :messages [["220" "the frequency"] ["[:x-step 40]" "how far the durations wander (0–100 %): the pitch drifts"]
               ["[:y-step 0.2]" "how far the amplitudes move each cycle: the timbre changes faster"]
               ["[:breakpoints 6]" "fewer breakpoints, a simpler wave (more of them, a richer one); changing it keeps the wave"]
               ["[220 10 -0.15 0.15 0.05 16]" "freq x-step y-min y-max y-step breakpoints"]]
    :example "(box :b1 \"gendy~ 110\" 40 30)\n(box :b2 \"dac~\" 40 90)\n(box :b3 \"scope~ 30\" 160 90)\n(connect :b1 0 :b2 0)\n(connect :b1 0 :b2 1)\n(connect :b1 0 :b3 0)"
    :try "Press ▶: a buzz whose pitch and colour never settle. Write gendy~ 110 0 in the box: with no wander of the durations, the pitch holds and only the timbre moves."
    :steps [{:title "The two walks"
             :note "x-step lets the durations wander (the pitch), y-step the amplitudes (the timbre). Two knobs send them by name."
             :example "(box :b4 \"knob 0 100 10 x-step\" 360 20)\n(box :b5 \"knob 0 0.3 0.05 y-step\" 450 20)\n(connect :b4 0 :b1 0)\n(connect :b5 0 :b1 0)"
             :try "Press ▶ and turn x-step up: the pitch scatters into noise. Turn it down and y-step up: one pitch, a restless colour."}
            {:title "Breakpoints"
             :note "Few breakpoints make a simple wave, close to a triangle or a square; many, a richer and noisier one. Changing their number keeps the wave, with no click."
             :example "(box :b6 \"msg :breakpoints 4\" 360 120)\n(box :b7 \"msg :breakpoints 48\" 500 120)\n(connect :b6 0 :b1 0)\n(connect :b7 0 :b1 0)"
             :try "Press ▶ and click both messages in turn, watching the scope."}
            {:title "A signal on the inlet: FM"
             :note "A signal connected to the inlet is added to the frequency, in Hz: a slow one makes a vibrato, a fast one frequency modulation."
             :example "(box :b8 \"osc~ 5\" 360 200)\n(box :b9 \"gain~ 300\" 360 250)\n(connect :b8 0 :b9 0)\n(connect :b9 0 :b1 0)"
             :try "Press ▶: 5 Hz around 110 Hz. Change osc~ 5 to osc~ 80 for a rougher sound."}]
    :see ["osc~" "synth~" "faust~"]}

   "synth~"
   {:package "@kairotic/synth" :usage "synth~"
    :doc "Polyphonic triangle-wave synthesizer, one voice per id."
    :inlets ["frequencies (a number or a list) · :stop" "voice ids (from a reader)"]
    :outlets ["the sound"]
    :see ["reader" "adsr~"]}

   "pan~"
   {:package "@kairotic/spatial" :usage "pan~ [position]"
    :doc "Stereo panning with equal power."
    :inlets ["the signal" "the position: −1 left … 1 right"]
    :outlets ["left" "right"]
    :see ["space~" "dac~"]}

   "space~"
   {:package "@kairotic/spatial" :usage "space~ [x y]"
    :doc "A sound placed around the listener (binaural): drag the dot, or send [x y]. For headphones."
    :inlets ["the signal; [x y] moves it (−1…1, y = 1 in front)"]
    :outlets ["left" "right"]
    :see ["pan~" "reader"]}})

(defn of
  "The help of a class: its own :help, or the core one."
  [cls]
  (let [d (comp/lookup cls)]
    (merge (get core cls) (:help d))))

(defn patch-steps
  "The steps of the help patch of a class: its :example (with :try) first, then its :steps.
   [{:title :note :try :code [\"(box …)\" …]} …], empty when it has no help patch."
  [cls]
  (let [h (of cls)
        code (fn [e] (->> (str/split-lines (str e)) (map str/trim) (remove str/blank?) vec))]
    (vec (concat (when (:example h)
                   [{:title cls :note (or (:doc (comp/lookup cls)) (:doc h) "") :try (or (:try h) "") :code (code (:example h))}])
                 (for [st (:steps h)]
                   {:title (or (:title st) cls) :note (or (:note st) "") :try (or (:try st) "") :code (code (:example st))})))))

(defn known
  "Every class with a help page (registered or listed here)."
  []
  (sort (distinct (concat (keys core) (map first (comp/listing))))))

;; ───────── suggestions while a box is written ─────────
;; The field where a box is written offers the classes that match what is typed: the registered ones (the core,
;; the work's own components, the packages already in it), the classes of the official packages not brought in
;; yet (writing one brings its package), and the functions of clojure.core. Each with where it comes from and the
;; first sentence of its doc.

(defn- first-sentence [s]
  (let [s (str/trim (str (first (str/split-lines (str s)))))
        i (str/index-of s ". ")]
    (if i (subs s 0 (inc i)) s)))

(defn- candidates
  "Every class that can be written in a box: {name {:source :registered | :package | :fn}}."
  []
  (merge (into {} (for [f (cf/names)] [f {:source :fn}]))
         (into {} (for [[_ p] lib/packages c (:classes p)] [c {:source :package}]))
         (into {} (for [[c h] core :when (:package h)] [c {:source :package}]))
         (into {} (for [[c] (comp/listing)] [c {:source :registered}]))))

(defn- rank
  "How well name n matches what is typed, t (lower is better), or nil if it does not."
  [n t]
  (let [n' (str/lower-case n) t' (str/lower-case t) i (str/index-of n' t')]
    (cond (= n' t') 0
          (= i 0) 1
          (nil? i) nil
          (< (count t) 2) nil
          (re-find #"[-/~.]" (subs n' (dec i) i)) 2
          :else 3)))

(defn about
  "What the field shows of class n: {:cls :usage :doc :from}, :from being where it comes from (\"core\", a
   package's name, \"this work\" or \"clojure.core\"), or nil if n is not a class."
  [n]
  (let [d (comp/lookup n) h (get core n) pkg (lib/package-of n)]
    (when (or d h pkg)
      {:cls n
       :usage (or (:usage d) (:usage h))
       :doc (first-sentence (or (:doc d) (:doc h) ""))
       :from (cond pkg (first pkg)
                   (:package h) (:package h)
                   (:corefn d) (if (str/starts-with? (str (:doc d)) "clojure.string") "clojure.string" "clojure.core")
                   (= :work (:origin d)) "this work"
                   :else "core")})))

(defn suggest
  "The classes that match what is typed (its first word), best first, at most n: [{:cls :usage :doc :from} …].
   An exact match first, then those that begin with it, those where a word inside begins with it (after - / ~ .),
   the rest that contain it; Kairotic's classes before the functions of clojure.core, the shorter first."
  ([typed] (suggest typed 8))
  ([typed n]
   (let [t (first (str/split (str/triml (str typed)) #"\s+"))]
     (when (seq t)
       (->> (candidates)
            (keep (fn [[c {:keys [source]}]]
                    (when-let [r (rank c t)] [[r (if (= source :fn) 1 0) (count c) c] c])))
            (sort-by first)
            (take n)
            (keep (fn [[_ c]] (about c)))
            vec)))))
