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
               ["shown as a score, click a note of a tree" "↑ ↓ pitch (⇧ octave) · + − duration · ← → next · Delete → rest"]
               ["(keep! :bN)" "writes the tree it shows into its buffer, with its recipe beside it (the tree and the boxes that made it)"]
               ["(recipe :bN) · (remake! :bN)" "the recipe of a kept buffer · the tree written back, without the changes made since"]
               ["{ } in the header (or a double-click on its right) · (source :bN)" "the buffer as EDN text, in the code window: edit it and apply (Ctrl+Enter); what changed is one event"]]
    :try "A freqt shown as a score is the viewer of a tree that comes transformed (tree → mt transpose 7 → freqt). To see and edit a tree box itself as a score, use ⇄ score in its header: no wire needed. (A box written \"score\", from older works, is a freqt shown as a score.)"
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
    :messages [["rec" "records what reaches it, from the beginning"] ["stop" "keeps what was heard"]
               ["clear" "empties it"] ["a URL (a string)" "loads the sound there; every browser that opens the work fetches it"]
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
   {:inlets ["a bang: sends the tree again · [:edit …] (from the edits outlet of a freqt shown as a score): changes it · a tree: replaces it"]
    :outlets ["the tree, expanded (melody strings become notes, [:use …] the fragments it names), whenever it changes"]
    :messages [["double-click" "edit its text (Ctrl+Enter applies): only the nodes that changed go into the history"]
               ["(tree! :bN [:voice …])" "writes a tree into it, as edits of the nodes that change"]
               ["(tree-edit! :bN [:attrs [0 1 2] {…}])" "edits nodes by their path: [:set p x] [:attrs p {…}] [:insert p x] [:remove p]"]
               ["(node-at :bN [0 1])" "the node at a path"]
               ["⇄ score in the header · (view :bN :score)" "the same tree drawn as a score, in this box (⇄ code brings the code back; { } opens it)"]
               ["in a score: click a note" "↑ ↓ pitch (⇧ octave) · + − duration · ← → next · Delete → rest"]
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

   "spectrum~"
   {:package "@kairotic/analysis" :usage "spectrum~ [lo hi]"
    :doc "The spectrum of a signal drawn in the patch, on a log scale of frequency (dB from -90 to 0)."
    :inlets ["the signal"]
    :example (lines "(box :b1 \"osc~ 220\" 40 30)" "(box :b2 \"spectrum~\" 40 90)" "(connect :b1 0 :b2 0)")
    :try "Press ▶: one peak at 220 Hz. Connect an adc~ instead and sing a vowel: its partials and formants."
    :see ["scope~" "features~"]}

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
