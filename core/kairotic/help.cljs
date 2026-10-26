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
;;  :package  "@kairotic/synth"                     when the class comes from a package
;;  :doc :usage                                     only for classes the page may not have loaded yet}

(ns kairotic.help
  (:require [clojure.string :as str]
            [kairotic.components :as comp]))

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
    :outlets ["its content: a number, a word such as stop, a string between quotes (\"https://…\"), or a list of them"]
    :example (lines "(box :b1 \"msg 60\" 40 30)" "(box :b2 \"msg 67\" 110 30)" "(box :b3 \"mtof\" 40 90)"
                    "(box :b4 \"osc~ 261.63\" 40 140)" "(box :b5 \"gain~ 0.3\" 40 190)" "(box :b6 \"dac~\" 40 240)"
                    "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)"
                    "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)")
    :try "Start the engine and click the two messages: two MIDI pitches become two frequencies."
    :see ["number" "bang"]}

   "number"
   {:inlets ["a number sets it and sends it on; a bang sends it again"]
    :outlets ["the number"]
    :messages [["drag" "up and down changes it (and sends it)"]
               ["double-click" "type a number (Enter sends it, Esc closes); so too knobs and the sliders of faust~"]]
    :example (lines "(box :b1 \"number 440\" 40 30)" "(box :b2 \"osc~ 440\" 40 90)" "(box :b3 \"gain~ 0.3\" 40 140)"
                    "(box :b4 \"dac~\" 40 190)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)"
                    "(connect :b3 0 :b4 0)" "(connect :b3 0 :b4 1)")
    :try "Start the engine and drag the number: the oscillator follows."
    :see ["msg" "knob"]}

   "print"
   {:inlets ["anything: it is written in the REPL"]
    :see ["msg"]}

   "draw"
   {:inlets ["a shape ([:circle {:cx 40 :cy 40 :r 10 :fill :accent}]) is added; a list of shapes replaces them all; [:set k shape] adds or replaces the one called k; [:unset k] removes it; clear"]
    :outlets ["the :hit of a shape pressed (a shape with :hit k sends k)"]
    :messages [["[:circle {:cx :cy :r}]" "a circle (also :rect :line :arc :needle :path :curve :text and :group)"]
               ["[[:line …] [:text …]]" "a list: replaces everything"]
               ["[:set :cursor [:line …]]" "the shape called :cursor, added or moved"]
               ["[:unset :cursor]" "removes it"] ["clear" "empties the view"]]
    :example (lines "(box :b1 \"msg circle 60 55 22 accent hit sun\" 40 30)"
                    "(box :b2 \"msg circle 160 55 14 kairos hit moon\" 250 30)"
                    "(box :b3 \"msg set label text 20 100 \\\"press one of them\\\"\" 40 70)"
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
   {:inlets ["bang, 1 or start: starts · 0 or stop: stops" "the interval in ms"]
    :outlets ["a bang every interval"]
    :example (lines "(box :b1 \"msg 1\" 40 30)" "(box :b2 \"msg 0\" 100 30)" "(box :b3 \"metro 250\" 40 90)"
                    "(box :b4 \"counter 1 8\" 40 150)" "(box :b5 \"print\" 40 210)"
                    "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)")
    :try "Start the engine, then 1 and 0: a pulse that counts from 0 to 7."
    :see ["counter" "ramp" "loadbang"]}

   "counter"
   {:inlets ["bang (or a number): sends the value and advances one step · reset: back to the minimum" "a number sets the next value"]
    :outlets ["the value"]
    :see ["metro"]}

   "ramp"
   {:inlets ["bang: goes from a to b in s seconds · [a b s]: that motion · a number: jumps there · stop" "1 / 0: loop on or off"]
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
               ["keep" "writes the last morph into the texts of the controls, as one event"]
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
             :example (lines "(box :b6 \"phasor~ 0.5\" 300 15)" "(box :b7 \"reader~\" 300 290)" "(box :b8 \"osc~ 330\" 420 290)"
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
               ["⇄ score in the header · (view :bN :score)" "the same buffer, drawn as an approximate score (⇄ canvas brings it back)"]
               ["shown as a score, click a note of a tree" "↑ ↓ pitch (⇧ octave) · a…g the nearest note of that name · + − duration · ← → next · Delete → rest"]
               ["click a rest" "Enter → a note (the pitch of the one before) · ↑ ↓ a step above or below it · a…g that note"]
               ["(keep! :bN)" "writes the tree it shows into its buffer, with its recipe beside it (the tree and the boxes that made it)"]
               ["(recipe :bN) · (remake! :bN)" "the recipe of a kept buffer · the tree written back, without the changes made since"]
               ["{ } in the header (or a double-click on its right) · (source :bN)" "the buffer as EDN text, in the code window: edit it and apply (Ctrl+Enter); what changed is one event"]]
    :example (lines "(box :b1 \"freqt\" 40 60)" "(box :b2 \"phasor~ 0.25\" 40 15)" "(box :b3 \"reader~ 1 gate\" 40 290)"
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
             :note "The same buffer can be shown as an approximate score: ⇄ score in its header, or (view :b1 :score). Nothing changes in the data; ⇄ canvas brings the drawing back."
             :example (lines "(tuning :b1 nil)" "(view :b1 :score)")
             :try "Press ▶: the score sounds the same as the drawing did. To edit notes one by one in a score, show a tree: see the help of tree."}
            {:title "The viewer of a tree"
             :note "A freqt shown as a score is the viewer of a tree that comes transformed (tree → mt transpose 7 → freqt). Its third outlet sends the edits made on the notes back to the tree box. (A box written \"score\", from older works, is a freqt shown as a score.)"
             :example (lines "(box :b7 \"bang\" 300 15)" "(box :b8 \"tree\" 300 60)" "(code :b8 \"\\\"c5/1 b4/.5 a4 g4/2\\\"\")"
                             "(box :b9 \"freqt\" 300 160)" "(view :b9 :score)"
                             "(connect :b7 0 :b8 0)" "(connect :b8 0 :b9 0)" "(connect :b9 2 :b8 0)")
             :try "Click a note of the new score and press ↑ or ↓, + or −, Delete (a rest) and then Enter (a note again): the change goes back to the tree by the dashed line."}]
    :see ["canvas" "reader" "tree"]}

   "reader"
   {:inlets ["a position (along X, or Y with reader y; 0…1 with reader path)" "the buffer of a canvas or freqt"]
    :outlets ["the values where the position crosses something (a list)" "their ids (sent first), for voices"]
    :see ["canvas" "reader~"]}

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
   {:inlets ["numbers (a knob, snapshot~, features~…); rec starts a take from 0, stop ends it" "a bang: the stroke being drawn ends, the next number begins another"]
    :outlets ["edits for a canvas or freqt (its inlet): [:batch …], at most every 2 seconds"]
    :messages [["rec" "starts from 0; its first write clears the buffer"] ["rec t (msg rec 4)" "from t seconds: what is before t stays, what is after is replaced"] ["ovr t (msg ovr 4)" "from t seconds, over only what the take covers: what comes after it stays"] ["stop" "writes what is left and stops"]]
    :example (lines "(box :b1 \"knob 0 1 0.5\" 40 30)" "(box :b2 \"msg rec\" 140 30)" "(box :b3 \"msg stop\" 200 30)"
                    "(box :b4 \"record 0 1\" 40 120)" "(box :b5 \"canvas\" 40 170)"
                    "(connect :b1 0 :b4 0)" "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)")
    :try "Press ▶, click rec, move the knob for a few seconds, click stop: the canvas holds the gesture. A phasor~ into a reader~ with the canvas on its right plays it back as an automation."
    :see ["canvas" "snapshot~" "reader~" "transcribe"]}

   "phasor~"
   {:inlets ["a number: the frequency in Hz (0.25 = once every 4 seconds)"]
    :outlets ["a ramp signal from 0 to 1"]
    :see ["reader~" "sig~"]}

   "sig~"
   {:inlets ["a number: the new constant value"] :outlets ["a constant signal"] :see ["phasor~" "osc~"]}

   "reader~"
   {:inlets ["the position signal (0…1), usually a phasor~" "the buffer of a canvas or freqt, or the sound of a sample (then it plays it, 0 its start and 1 its end)"]
    :outlets ["one signal per voice (the values it crosses)" "with gate: one more per voice, 1 where it sounds and 0 where not"]
    :example (lines "(box :b1 \"freqt\" 40 60)" "(box :b2 \"phasor~ 0.25\" 40 15)" "(box :b3 \"reader~ 1 gate\" 40 290)"
                    "(box :b4 \"osc~\" 40 340)" "(box :b5 \"gain~\" 40 390)" "(box :b6 \"dac~\" 40 440)"
                    "(connect :b2 0 :b3 0)" "(connect :b1 1 :b3 1)" "(connect :b3 0 :b4 0)" "(connect :b3 1 :b5 1)"
                    "(connect :b4 0 :b5 0)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)"
                    "(stroke :b1 [[0 220] [1 330] [1.5 293.66]])" "(stroke :b1 [[2.5 440] [4 220]])")
    :try "Press ▶: the drawing plays every four seconds, and is silent where nothing is drawn (the gate)."
    :see ["phasor~" "adsr~" "freqt" "reader" "sample"]}

   "sample"
   {:inlets ["the signal to record; rec starts, stop ends (or its length in seconds), clear empties it, a bang asks its length"]
    :outlets ["its length in seconds (after each recording, and on a bang)" "the sound, for a reader~ (on its right inlet)"]
    :messages [["rec" "records what reaches it, from the beginning"] ["rec t (msg rec 2.5)" "keeps its first t seconds and records from there"] ["ovr t (msg ovr 2.5)" "replaces only what the take covers, keeping what comes after (ovr: from 0)"] ["stop" "keeps what was heard"]
               ["clear" "empties it"] ["a URL (msg https://… · msg url github:… · a string)" "loads the sound there; every browser that opens the work fetches it"]
               ["(load-sound! :bN)" "brings in a sound file"] ["(load-sound! :bN \"https://…\")" "loads it from a URL"]
               ["(sample! :bN {:url \"…\"})" "a sample that is only a URL, as a link or a shared session writes it"]
               ["github:owner/repo@ref/path.wav" "a file of a public GitHub repository (through jsDelivr: no CORS problem)"]
               ["freesound:12345" "a sound of Freesound, with your API key: (freesound-key! \"…\"); (sounds \"kick\") searches; (credits) lists who made them"]
               ["(save-sound :bN)" "saves it as WAV"]]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"msg rec\" 140 30)" "(box :b3 \"msg stop\" 200 30)"
                    "(box :b4 \"sample 10\" 40 90)" "(box :b5 \"!/ 1\" 40 190)" "(box :b6 \"phasor~\" 40 240)"
                    "(box :b7 \"reader~\" 40 290)" "(box :b8 \"gain~ 0.5\" 40 340)" "(box :b9 \"dac~\" 40 390)"
                    "(connect :b1 0 :b4 0)" "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)"
                    "(connect :b5 0 :b6 0)" "(connect :b6 0 :b7 0)" "(connect :b4 1 :b7 1)" "(connect :b7 0 :b8 0)"
                    "(connect :b8 0 :b9 0)" "(connect :b8 0 :b9 1)")
    :try "Press ▶, click rec, sing a phrase, click stop: its length becomes the speed of the phasor~ (!/ 1: one over the seconds), and the reader~ plays it in a loop. Use headphones. Change the phasor~ to play it faster, slower or backwards."
    :see ["reader~" "adc~" "phasor~"]}

   "faust~"
   {:inlets ["audio inputs of process (if any); the left one also takes parameters: [:freq 440]"]
    :outlets ["audio outputs of process"]
    :messages [["(code :bN \"process = …;\")" "writes its source"] ["double-click" "edit the code; Ctrl+Enter applies"]
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
             :example (lines "(box :b5 \"tree\" 560 30)" "(code :b5 \"\\\"c4+e4+g4/2 d4+f4+a4/2 b3+d4+g4/2 c4+e4+g4+c5/2\\\"\")" "(box :b6 \"msg bang\" 560 150)" "(box :b7 \"msg stop\" 640 150)" "(box :b8 \"mt play loop\" 560 190)" "(connect :b5 0 :b8 0)" "(connect :b6 0 :b8 0)" "(connect :b7 0 :b8 0)" "(connect :b8 0 :b3 0)" "(connect :b8 1 :b3 1)")
             :try "Press ▶ and click msg bang: the four chords in a loop; msg stop ends it."}
            {:title "Any tuning"
             :note "The notes reach the voices as MIDI pitches with decimals, so any frequency sounds as written: here a just major triad (4:5:6), then the equal-tempered one."
             :example (lines "(box :b9 \"msg 220 275 330\" 560 260)" "(box :b10 \"msg 220 277.18 329.63\" 700 260)" "(box :b11 \"msg stop\" 870 260)" "(connect :b9 0 :b3 0)" "(connect :b10 0 :b3 0)" "(connect :b11 0 :b3 0)")
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
    :messages [["double-click" "opens it"] ["(abstract :bN \"name\")" "turns it into a class (an abstraction)"]]
    :see ["inlet" "outlet"]}

   "inlet"  {:outlets ["what arrives at this inlet of the sub-patch"] :see ["patch" "outlet" "inlet~"]}
   "outlet" {:inlets ["what leaves the sub-patch by this outlet"] :see ["patch" "inlet" "outlet~"]}
   "inlet~" {:outlets ["the signal that arrives at this inlet of the sub-patch"] :see ["patch" "outlet~"]}
   "outlet~" {:inlets ["the signal that leaves the sub-patch by this outlet"] :see ["patch" "inlet~"]}

   "tree"
   {:inlets ["a bang: sends the tree again · [:edit …] (from the edits outlet of a freqt shown as a score): changes it · a tree: replaces it"]
    :outlets ["the tree, expanded (melody strings become notes, [:use …] the fragments it names), whenever it changes"]
    :messages [["double-click" "edit its text (Ctrl+Enter applies): only the nodes that changed go into the history"]
               ["(tree! :bN [:voice …])" "writes a tree into it, as edits of the nodes that change"]
               ["(tree-edit! :bN [:attrs [0 1 2] {…}])" "edits nodes by their path: [:set p x] [:attrs p {…}] [:insert p x] [:remove p]"]
               ["(node-at :bN [0 1])" "the node at a path"]
               ["⇄ score in the header · (view :bN :score)" "the same tree drawn as a score, in this box (⇄ code brings the code back; { } opens it)"]
               ["in a score: click a note" "↑ ↓ pitch (⇧ octave) · a…g the nearest note of that name · + − duration · ← → next · Delete → rest"]
               ["in a score: click a rest" "Enter → a note (the pitch of the one before) · ↑ ↓ a step above or below it · a…g that note"]
               ["(as-tree :bN)" "reads it back as data"]]
    :example (lines "(box :b1 \"bang\" 40 20)" "(box :b2 \"tree\" 40 60)"
                    "(code :b2 \"[:voice\\n [:measure {:meter [3 4]} \\\"e5/1\\\" [:tuplet {:ratio [3 2]} \\\"d5/.5 c5 b4\\\"] [:note {:pitch \\\"a4\\\" :dur 1 :dyn \\\"p\\\"}]]\\n [:measure \\\"g4/3\\\"]]\")"
                    "(box :b3 \"freqt\" 40 190)" "(view :b3 :score)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b3 2 :b2 0)")
    :try "The score already shows the tree, measure by measure. Double-click the code, change a note and apply it (Ctrl+Enter): the score follows. Click a note of the score and press ↑: the change comes back to the tree by the dashed line. Or press ⇄ score in the header of the tree box: the same tree as a score, in one box."
    :see ["mt" "freqt"]}

   "mt"
   {:inlets ["a tree: it comes out transformed (for play: a tree to play, then bang, stop)"
             "for transpose, invert, augment, rotate, canon, thin: the amount · for seq, par: the tree to join"]
    :outlets ["the result (for play: the Hz of the notes sounding, a list)"]
    :messages [["mt transpose 7" "seven semitones up"] ["mt invert c4" "mirrored around c4"] ["mt retrograde" "backwards"]
               ["mt augment 2" "twice as long"] ["mt rotate 1" "the first element goes to the end"] ["mt canon 2 7" "against itself, 2 beats later, a fifth up"]
               ["mt thin 0.5" "keeps half the notes of each measure, the ones on its strongest positions (metric weight)"]
               ["mt seq · mt par" "the left tree followed by (or with) the right one"] ["mt events · mt pitches · mt duration" "the tree as data"]
               ["mt play [loop]" "plays it: Hz (0) and voice ids (1) for synth~, parameters (2), dynamics and texts (3)"]]
    :example (lines "(box :b1 \"bang\" 40 20)" "(box :b2 \"tree\" 40 60)" "(code :b2 \"\\\"c4/1 d4/.5 e4 g4/1 e4 f4/.5 e4 d4/2\\\"\")"
                    "(box :b4 \"number 7\" 220 140)" "(box :b3 \"mt transpose 7\" 40 170)" "(box :b5 \"freqt\" 40 220)" "(view :b5 :score)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b4 0 :b3 1)" "(connect :b3 0 :b5 0)")
    :try "Change the box text to mt retrograde, mt invert c4 or mt augment 2: the score follows. (The number on the right inlet takes effect with the next tree: click the bang.)"
    :steps [{:title "Two voices: a canon"
             :note "mt canon d i puts the tree against itself, d beats later and i semitones away: two voices that the score shows as two staves."
             :example (lines "(text! :b3 \"mt canon 2 7\")" "(delete :b4)")
             :try "Click the bang. Change it to mt canon 1 -12 (an octave below, one beat later) or mt canon 4 0."}
            {:title "Playing it"
             :note "mt play reads a tree in time: the Hz of the notes that sound (left) and their voice ids (second) go to a synth~, which gives each voice its own note."
             :example (lines "(box :b6 \"msg bang\" 300 170)" "(box :b7 \"msg stop\" 370 170)" "(box :b8 \"mt play loop\" 300 220)"
                             "(box :b9 \"synth~\" 300 270)" "(box :b10 \"gain~ 0.3\" 300 320)" "(box :b11 \"dac~\" 300 370)"
                             "(connect :b3 0 :b8 0)" "(connect :b6 0 :b8 0)" "(connect :b7 0 :b8 0)" "(connect :b8 0 :b9 0)" "(connect :b8 1 :b9 1)"
                             "(connect :b9 0 :b10 0)" "(connect :b10 0 :b11 0)" "(connect :b10 0 :b11 1)")
             :try "Press ▶, click the first bang (the tree goes to mt play) and then msg bang: the canon sounds in a loop; stop ends it."}]
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
    :inlets ["the signal"]
    :outlets ["a bang for each onset" "its strength (the growth of the spectrum, 0…1)"]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"onset~\" 40 90)" "(box :b3 \"counter 1\" 40 150)"
                    "(box :b4 \"number\" 40 200)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)")
    :try "Press ▶ and clap: the counter counts the claps. Raise the threshold if it counts too much."
    :see ["pitch~" "sample" "counter"]}

   "chroma~"
   {:package "@kairotic/analysis" :usage "chroma~ [ms]"
    :doc "How much of each pitch class a signal has: 12 values from C to B, and the strongest class as a word."
    :inlets ["the signal"]
    :outlets ["12 values, C to B, 0…1 (the strongest 1)" "the strongest pitch class (:c … :b), when it changes"]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"chroma~\" 40 90)" "(box :b3 \"print\" 40 170)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 1 :b3 0)")
    :try "Press ▶ and play a chord or a drone: the bars show its pitch classes; print writes the strongest."
    :see ["pitch~" "mt" "features~"]}

   "transcribe"
   {:package "@kairotic/analysis" :usage "transcribe [bpm] [notes|glide] [ms]"
    :doc "Writes what pitch~ hears into a freqt, as strokes: notes at the pitch they hold longest, or contours (glide)."
    :inlets ["Hz from pitch~ (0: silence); rec starts from 0, stop ends" "a bang (from onset~): a new note, even on the same pitch"]
    :outlets ["edits for a freqt: [:batch [[:stroke …] …]], at most every 2 seconds (one event of the history each)"]
    :messages [["rec" "starts a take from 0 (its first write clears the freqt)"] ["rec t (msg rec 8)" "from beat t: what is before t stays, what is after is replaced"] ["ovr t (msg ovr 8)" "from beat t, over only what the take covers: what comes after it stays"] ["stop" "writes what is left and stops"]]
    :example (lines "(box :b1 \"adc~ 1\" 40 30)" "(box :b2 \"pitch~ 80 1000\" 40 90)" "(box :b3 \"onset~\" 200 90)"
                    "(box :b4 \"msg rec\" 330 90)" "(box :b5 \"msg stop\" 400 90)" "(box :b6 \"transcribe 60\" 40 160)"
                    "(box :b7 \"freqt\" 40 220)"
                    "(connect :b1 0 :b2 0)" "(connect :b1 0 :b3 0)" "(connect :b2 0 :b6 0)" "(connect :b3 0 :b6 1)"
                    "(connect :b4 0 :b6 0)" "(connect :b5 0 :b6 0)" "(connect :b6 0 :b7 0)")
    :try "Press ▶, click rec, sing a phrase, click stop: the freqt holds it. ⇄ shows it as a score. Write transcribe 60 glide to keep the slides."
    :see ["pitch~" "onset~" "freqt"]}

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

   "fetch"
   {:package "@kairotic/data" :usage "fetch [json|text|edn] [live]"
    :doc "Brings in what is at a URL (JSON read as EDN, text or EDN) as a task: it goes out on the left and is kept as the data of the box, in the history, the same for everyone; with live, only in this tab."
    :inlets ["a URL (msg https://… · github:owner/repo@ref/path · [:fetch url]); refresh; bang; [:get key …]; clear"]
    :outlets ["what it found (or the part a [:get …] asks for)" ":loading, :ready or [:error \"…\"]"]
    :messages [["a URL" "brings it in; a URL it already keeps is sent again, not fetched"]
               ["refresh" "fetches its URL again"] ["bang" "sends what it holds"]
               ["get items 0 name · [:get [:items 0 :name]]" "sends one part of it"] ["clear" "forgets it"]
               ["(keep! :bN {:url \"…\" :value …})" "what it keeps, as the code of the work writes it"]]
    :example (lines "(box :b1 \"msg github:bonuoq/kairotic@main/packages/data/package.json\" 40 30)" "(box :b2 \"fetch\" 40 80)"
                    "(box :b3 \"edn 340 260\" 40 150)" "(box :b4 \"print\" 400 150)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)")
    :try "Click the message: the answer arrives in the edn box, and stays in the work (go back and forward in the history: it is not fetched again). Pick a line: its value goes to print."
    :see ["edn" "sample" "print"]}

   "edn"
   {:package "@kairotic/data" :usage "edn [width height]"
    :doc "Any value as a tree, like Portal: collections open and close, values coloured by kind; picking a line sends that part (left) and its path (right)."
    :inlets ["any value; depth n opens it n levels down; bang sends the part picked again; clear"]
    :outlets ["the part picked" "its path, for [:get …] of a fetch box"]
    :messages [["depth 2" "opens it two levels down"] ["bang" "the part picked again (the whole value if none)"] ["clear" "empties it"]
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
               ["{:degree [0 2 :rest 4]} · [0 nil 4]" "a silence: :rest (:_ :- :r) or nil as the degree, note or freq"]
               [":amp #pat/white [0.2 0.6]" "the loudness of each note (0…1), for synth~ and a polyphonic faust~"]
               ["pbind 7 · pbind 7 4 · pbind 7 loop" "the seed · four passes · for ever"]]
    :example (lines "(box :b1 \"pbind 7 loop\" 40 30)"
                    "(code :b1 \"{:degree #pat/shuffle [0 2 4 7]\\n :dur    [0.5 0.5 1]\\n :amp    #pat/white [0.1 0.3]}\")"
                    "(box :b2 \"msg start\" 40 130)" "(box :b3 \"msg stop\" 110 130)" "(box :b4 \"player 110\" 40 180)"
                    "(box :b5 \"synth~\" 40 240)" "(box :b6 \"dac~\" 40 290)"
                    "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b1 0 :b4 1)"
                    "(connect :b4 0 :b5 0)" "(connect :b4 1 :b5 1)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)")
    :try "Press ▶ and start: four notes in a new order every pass. Change :dur in the pbind (double-click it) and apply: the player goes on with it from the same beat. Change the seed (pbind 8 loop): other orders, but the same for everyone in a room."
    :steps [{:title "One value per bar"
             :note "#pat/hold follows time: the root changes every 4 beats whatever the rhythm, as Overtone's ^{:dur 4} does."
             :example (lines "(code :b1 \"{:degree #pat/shuffle [0 2 4 7]\\n :dur    [0.5 0.5 1]\\n :root   #pat/hold [4 [:c :f :g :c]]}\")")
             :try "Press start: the same figure, moving through four harmonies."}
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
                    "(box :b2 \"msg start\" 40 130)" "(box :b3 \"msg stop\" 110 130)" "(box :b4 \"player 120\" 40 180)"
                    "(box :b5 \"synth~\" 40 240)" "(box :b6 \"dac~\" 40 290)"
                    "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b1 0 :b4 1)"
                    "(connect :b4 0 :b5 0)" "(connect :b4 1 :b5 1)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)")
    :try "Press ▶ and start. Edit the code (double-click the box) and apply: the player follows the new pattern from the beat it is on."
    :see ["pbind" "player" "script"]}

   "player"
   {:package "@kairotic/patterns" :usage "player [bpm] [quant] [jump] [limit] [edges] [spread]"
    :doc "Plays a pattern by its own clock (start/stop), one step at a time (bang) or at a position in beats (a number): the Hz and voice ids of the notes sounding, the whole event and the beat."
    :inlets ["start · stop: its own clock · bang: one step, now · a number: a position in beats · seek p · reset · [:bpm 90]"
             "a pattern (from a pbind or a pattern box): a new one goes on from the same beat"]
    :outlets ["the Hz of the notes sounding (a list), after [:gain amp] when the event has :amp" "their voice ids, sent first (for synth~ or a polyphonic faust~)"
              "the whole event, with :beat, :hz and :ids (and :dir :back when entered from its end)" "the beat"]
    :messages [["start · stop" "its own clock: every event lasts its :dur in beats at its bpm"]
               ["player 120 4" "start on a multiple of 4 beats: players with the same tempo meet"]
               ["[:bpm 90]" "another tempo, without a jump"]
               ["bang" "the next event now (and the ones of :dur 0 right after it)"]
               ["a number" "a position in beats: every event is a span, from its onset to its end, that sounds while the position is inside it — entered at its onset going forwards, at its end going backwards (:dir :back); what a step passes over sounds within it"]
               ["seek 8 · [:seek 8]" "there at once, nothing in between: what still sounds there goes on, what starts to contain that position starts"]
               ["player 120 0 8 8" "a step more than 8 (jump) times the one before it, or longer than 8 (limit) beats, is a seek: the wrap of a ramp"]
               ["player 120 0 8 8 edges" "a seek sounds only what starts exactly there"]
               ["player 120 0 8 8 spread" "what a step passes keeps its rhythm, one step later (with ▶)"]
               ["reset" "back to the beginning, silently"]]
    :example (lines "(box :b1 \"pbind 1 loop\" 40 30)"
                    "(code :b1 \"{:note [:c4 :e4 :g4 :b4 :a4 :f4]\\n :dur  [0.5 0.5 1]}\")"
                    "(box :b2 \"msg start\" 40 130)" "(box :b3 \"msg stop\" 110 130)" "(box :b4 \"player 100\" 40 180)"
                    "(box :b5 \"synth~\" 40 240)" "(box :b6 \"dac~\" 40 290)" "(box :b7 \"get % :beat\" 260 240)" "(box :b8 \"print\" 260 290)"
                    "(connect :b2 0 :b4 0)" "(connect :b3 0 :b4 0)" "(connect :b1 0 :b4 1)"
                    "(connect :b4 0 :b5 0)" "(connect :b4 1 :b5 1)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)"
                    "(connect :b4 2 :b7 0)" "(connect :b7 0 :b8 0)")
    :try "Press ▶ and start: the six notes, three durations cycling. The third outlet is the whole event: print writes the beat of each."
    :steps [{:title "Step by step"
             :note "A bang plays the next event now: the pattern follows whatever moves it — a metro, an onset~ of what someone plays, a key."
             :example (lines "(box :b9 \"metro 300\" 180 130)" "(box :b10 \"msg 1\" 180 90)" "(box :b11 \"msg 0\" 230 90)"
                             "(connect :b10 0 :b9 0)" "(connect :b11 0 :b9 0)" "(connect :b9 0 :b4 0)")
             :try "Stop the clock and click 1: one note every 300 ms, whatever its :dur. Connect an onset~ from an adc~ instead: one note each time you play."}
            {:title "At a position"
             :note "A number is a position in beats, as a reader reads a buffer: every event is a span that sounds while the position is inside it. Forwards it starts at its onset; backwards at its end. The wrap of a ramp (a step far larger than the ones before) is a seek: there at once."
             :example (lines "(box :b12 \"ramp 0 6 3 loop\" 330 130)" "(box :b13 \"msg bang\" 330 90)"
                             "(connect :b13 0 :b12 0)" "(connect :b12 0 :b4 0)")
             :try "Stop the clock and click bang: six beats in three seconds, again and again. Change the ramp to ramp 6 0 3 loop: the phrase backwards, each note from its end. Drag a number box into it instead: you are the clock, either way."}]
    :see ["pbind" "pattern" "metro" "ramp" "reader" "synth~"]}

   "pcclock"
   {:package "@kairotic/theory" :usage "pcclock [notes]"
    :doc "A pitch-class set on the clock face: its polygon, the sets before it, its axes of symmetry; its prime form and interval vector go out."
    :inlets ["a list of pitches (MIDI or 0…11), a list of 12 weights (a chroma), or a number: a note, the last n notes (4) being the set; clear"]
    :outlets ["the prime form, when the set changes" "the interval vector" "the pitch class pressed"]
    :example (lines "(box :b1 \"msg 60 64 67\" 40 30)" "(box :b2 \"msg 60 63 66 69\" 140 30)" "(box :b3 \"pcclock\" 40 80)"
                    "(box :b4 \"print\" 40 330)" "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)")
    :try "Click the major triad, then the diminished seventh: (0 3 7) has no axis, (0 3 6 9) has four. Press a pitch class on the clock: it comes out on the right."
    :see ["fourier" "tonnetz" "chroma~"]}

   "fourier"
   {:package "@kairotic/theory" :usage "fourier [notes]"
    :doc "The six Fourier coefficients of a pitch-class distribution (chromatic, dyadic, triadic, octatonic, diatonic, whole-tone), each a point in its circle with its trail."
    :inlets ["a list of pitches (MIDI or 0…11), a list of 12 weights (a chroma, from chroma~), or a number: a note (the last n count: 4); clear"]
    :outlets ["the six magnitudes, 0…1" "the six phases, in degrees"]
    :example (lines "(box :b1 \"msg 60 62 64 65 67 69 71\" 40 30)" "(box :b2 \"msg 60 64 68\" 240 30)" "(box :b3 \"fourier\" 40 80)"
                    "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)")
    :try "The diatonic scale fills f5; the augmented triad, f3 and f6 at 1. With adc~ → chroma~ → fourier, sing or play and watch the trails."
    :see ["pcclock" "tonnetz" "chroma~"]}

   "tonnetz"
   {:package "@kairotic/theory" :usage "tonnetz [notes]"
    :doc "Triads on the Tonnetz (fifths across, thirds up) and the path of the harmony: each triad found joined to the ones before."
    :inlets ["a list of pitches (MIDI or 0…11), a list of 12 weights (a chroma, above 0.5), or a number: a note (the last n count: 3); clear forgets the path"]
    :outlets ["the triad, when it changes (:C, :am, :Ebm…)" "the pitch class pressed"]
    :example (lines "(box :b1 \"msg 60 64 67\" 40 30)" "(box :b2 \"msg 60 63 67\" 130 30)" "(box :b3 \"msg 60 63 68\" 220 30)"
                    "(box :b4 \"msg 59 63 68\" 310 30)" "(box :b5 \"tonnetz\" 40 80)" "(box :b6 \"print\" 40 340)"
                    "(connect :b1 0 :b5 0)" "(connect :b2 0 :b5 0)" "(connect :b3 0 :b5 0)" "(connect :b4 0 :b5 0)" "(connect :b5 0 :b6 0)")
    :try "Click the four messages in order: C, c, A♭, g♯ — P, L, P: each step crosses one edge of the lattice. Press a node to hear which class it is (its number comes out on the right)."
    :see ["pcclock" "fourier" "mt"]}

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
             :example "(box :b4 \"knob 0 100 10 x-step\" 300 20)\n(box :b5 \"knob 0 0.3 0.05 y-step\" 390 20)\n(connect :b4 0 :b1 0)\n(connect :b5 0 :b1 0)"
             :try "Press ▶ and turn x-step up: the pitch scatters into noise. Turn it down and y-step up: one pitch, a restless colour."}
            {:title "Breakpoints"
             :note "Few breakpoints make a simple wave, close to a triangle or a square; many, a richer and noisier one. Changing their number keeps the wave, with no click."
             :example "(box :b6 \"msg breakpoints 4\" 300 120)\n(box :b7 \"msg breakpoints 48\" 440 120)\n(connect :b6 0 :b1 0)\n(connect :b7 0 :b1 0)"
             :try "Press ▶ and click both messages in turn, watching the scope."}
            {:title "A signal on the inlet: FM"
             :note "A signal connected to the inlet is added to the frequency, in Hz: a slow one makes a vibrato, a fast one frequency modulation."
             :example "(box :b8 \"osc~ 5\" 300 200)\n(box :b9 \"gain~ 300\" 300 250)\n(connect :b8 0 :b9 0)\n(connect :b9 0 :b1 0)"
             :try "Press ▶: 5 Hz around 110 Hz. Change osc~ 5 to osc~ 80 for a rougher sound."}]
    :see ["osc~" "synth~" "faust~"]}

   "synth~"
   {:package "@kairotic/synth" :usage "synth~"
    :doc "Polyphonic triangle-wave synthesizer, one voice per id."
    :inlets ["frequencies (a number or a list) · stop" "voice ids (from a reader)"]
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
