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
    :outlets ["its content: a number, a list, or a word such as stop"]
    :example (lines "(box :b1 \"msg 60\" 40 30)" "(box :b2 \"msg 67\" 110 30)" "(box :b3 \"mtof\" 40 90)"
                    "(box :b4 \"osc~ 261.63\" 40 140)" "(box :b5 \"gain~ 0.3\" 40 190)" "(box :b6 \"dac~\" 40 240)"
                    "(connect :b1 0 :b3 0)" "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)" "(connect :b4 0 :b5 0)"
                    "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)")
    :try "Start the engine and click the two messages: two MIDI pitches become two frequencies."
    :see ["number" "bang"]}

   "number"
   {:inlets ["a number sets it and sends it on; a bang sends it again"]
    :outlets ["the number"]
    :messages [["drag" "up and down changes it (and sends it)"]]
    :example (lines "(box :b1 \"number 440\" 40 30)" "(box :b2 \"osc~ 440\" 40 90)" "(box :b3 \"gain~ 0.3\" 40 140)"
                    "(box :b4 \"dac~\" 40 190)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)"
                    "(connect :b3 0 :b4 0)" "(connect :b3 0 :b4 1)")
    :try "Start the engine and drag the number: the oscillator follows."
    :see ["msg" "knob"]}

   "print"
   {:inlets ["anything: it is written in the REPL"]
    :see ["msg"]}

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
   "/" {:inlets ["a number or a list: divided by the right one (0 if it is 0)" "the divisor (stored)"] :outlets ["the quotient"] :see ["*"]}

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

   "canvas"
   {:inlets ["a position (or a click): it comes out on the left"]
    :outlets ["the position" "the buffer, for a reader or reader~ (on their right inlet)"]
    :messages [["(axis :bN :x -1 1)" "range of an axis, :log for logarithmic"] ["(stroke :bN [[x y] …])" "draws"]]
    :example (lines "(box :b1 \"canvas\" 40 60)" "(box :b2 \"loadbang\" 40 15)" "(box :b3 \"ramp 0 1 4 loop\" 120 15)"
                    "(box :b4 \"reader\" 40 290)" "(box :b5 \"print\" 40 340)"
                    "(connect :b2 0 :b3 0)" "(connect :b3 0 :b4 0)" "(connect :b1 1 :b4 1)" "(connect :b4 0 :b5 0)"
                    "(axis :b1 :x 0 1)" "(axis :b1 :y 0 1)" "(stroke :b1 [[0 0.2] [0.5 0.9] [1 0.4]])")
    :try "Press ▶: the reader goes along X and prints the height of the stroke. Draw another stroke and listen to the list grow."
    :see ["reader" "reader~" "freqt"]}

   "freqt"
   {:inlets ["a time (or a click): it comes out on the left"]
    :outlets ["the time" "the buffer, for a reader or reader~"]
    :messages [["(note :bN t \"c4\" dur)" "a note"] ["(tuning :bN \"31-tet\" 261.63)" "a tuning"] ["(grid-x :bN 0.25 \"3+3+2\")" "a bar grid"]]
    :see ["score" "canvas" "reader"]}

   "score"
   {:inlets ["a time (or a click)"] :outlets ["the time" "the buffer"] :see ["freqt"]}

   "reader"
   {:inlets ["a position (along X, or Y with reader y; 0…1 with reader path)" "the buffer of a canvas, freqt or score"]
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
    :see ["gain~" "pan~" "space~"]}

   "phasor~"
   {:inlets ["a number: the frequency in Hz (0.25 = once every 4 seconds)"]
    :outlets ["a ramp signal from 0 to 1"]
    :see ["reader~" "sig~"]}

   "sig~"
   {:inlets ["a number: the new constant value"] :outlets ["a constant signal"] :see ["phasor~" "osc~"]}

   "reader~"
   {:inlets ["the position signal (0…1), usually a phasor~" "the buffer of a canvas or freqt"]
    :outlets ["one signal per voice (the values it crosses)" "with gate: one more per voice, 1 where it sounds and 0 where not"]
    :example (lines "(box :b1 \"freqt\" 40 60)" "(box :b2 \"phasor~ 0.25\" 40 15)" "(box :b3 \"reader~ 1 gate\" 40 290)"
                    "(box :b4 \"osc~\" 40 340)" "(box :b5 \"gain~\" 40 390)" "(box :b6 \"dac~\" 40 440)"
                    "(connect :b2 0 :b3 0)" "(connect :b1 1 :b3 1)" "(connect :b3 0 :b4 0)" "(connect :b3 1 :b5 1)"
                    "(connect :b4 0 :b5 0)" "(connect :b5 0 :b6 0)" "(connect :b5 0 :b6 1)"
                    "(stroke :b1 [[0 220] [1 330] [1.5 293.66]])" "(stroke :b1 [[2.5 440] [4 220]])")
    :try "Press ▶: the drawing plays every four seconds, and is silent where nothing is drawn (the gate)."
    :see ["phasor~" "adsr~" "freqt" "reader"]}

   "faust~"
   {:inlets ["audio inputs of process (if any); the left one also takes parameters: [:freq 440]"]
    :outlets ["audio outputs of process"]
    :messages [["(code :bN \"process = …;\")" "writes its source"] ["double-click" "edit the code; Ctrl+Enter applies"]]
    :example (lines "(box :b1 \"faust~\" 40 30)" "(box :b2 \"dac~\" 40 200)" "(connect :b1 0 :b2 0)" "(connect :b1 0 :b2 1)"
                    "(code :b1 \"import(\\\"stdfaust.lib\\\");\\nf = hslider(\\\"freq\\\", 220, 50, 2000, 1);\\nprocess = os.sawtooth(f) * 0.1 : fi.lowpass(2, 1200);\")")
    :try "Press ▶. Then change 1200 in the code and apply with Ctrl+Enter: the filter opens."
    :see ["knob" "component" "script"]}

   "script"
   {:inlets ["what its function receives, by inlet (as many as the first number)"]
    :outlets ["what its function returns in :out (as many as the second number)"]
    :messages [["source" "(fn [m] {:out [[0 (* 2 (:value m))]]})"]]
    :see ["component"]}

   "component"
   {:messages [["source" "a map {:class \"x\" :doc … :io [1 1] :receive (fn [m] …)}: defines the class x in the work"]]
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
   {:inlets ["a bang (or anything): sends the tree"]
    :outlets ["the tree, expanded (melody strings become notes, [:use …] the fragments it names)"]
    :messages [["double-click" "edit it (Ctrl+Enter applies)"] ["(tree! :bN [:voice …])" "writes a tree into it"] ["(as-tree :bN)" "reads it back as data"]]
    :example (lines "(box :b1 \"bang\" 40 20)" "(box :b2 \"tree\" 40 60)"
                    "(code :b2 \"[:voice\\n [:measure {:meter [3 4]} \\\"e5/1\\\" [:tuplet {:ratio [3 2]} \\\"d5/.5 c5 b4\\\"] [:note {:pitch \\\"a4\\\" :dur 1 :dyn \\\"p\\\"}]]\\n [:measure \\\"g4/3\\\"]]\")"
                    "(box :b3 \"score\" 40 190)" "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)")
    :try "Start the engine (▶) and click the bang: the score shows the tree, measure by measure. Double-click the code, change a note and click the bang again."
    :see ["mt" "score" "freqt"]}

   "mt"
   {:inlets ["a tree: it comes out transformed (for play: a tree to play, then bang, stop)"
             "for transpose, invert, augment, rotate, canon: the amount · for seq, par: the tree to join"]
    :outlets ["the result (for play: the Hz of the notes sounding, a list)"]
    :messages [["mt transpose 7" "seven semitones up"] ["mt invert c4" "mirrored around c4"] ["mt retrograde" "backwards"]
               ["mt augment 2" "twice as long"] ["mt rotate 1" "the first element goes to the end"] ["mt canon 2 7" "against itself, 2 beats later, a fifth up"]
               ["mt seq · mt par" "the left tree followed by (or with) the right one"] ["mt events · mt pitches · mt duration" "the tree as data"]
               ["mt play [loop]" "plays it: Hz (0) and voice ids (1) for synth~, parameters (2), dynamics and texts (3)"]]
    :example (lines "(box :b1 \"bang\" 40 20)" "(box :b2 \"tree\" 40 60)" "(code :b2 \"\\\"c4/1 d4/.5 e4 g4/1 e4 f4/.5 e4 d4/2\\\"\")"
                    "(box :b4 \"number 7\" 220 140)" "(box :b3 \"mt transpose 7\" 40 170)" "(box :b5 \"score\" 40 220)"
                    "(connect :b1 0 :b2 0)" "(connect :b2 0 :b3 0)" "(connect :b4 0 :b3 1)" "(connect :b3 0 :b5 0)")
    :try "Start the engine and click the bang. Drag the number and click the bang again. Then change the box text to mt retrograde, mt invert c4 or mt augment 2."
    :see ["tree" "score" "synth~"]}

   ;; ───── official packages (until they carry their own :help) ─────
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

(defn known
  "Every class with a help page (registered or listed here)."
  []
  (sort (distinct (concat (keys core) (map first (comp/listing))))))
