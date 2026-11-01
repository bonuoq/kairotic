# Class reference

*Made from the help of Kairotic 0.2.0-alpha (the Help tab shows the same, and the help of classes a work defines). Generated: do not edit by hand — `(reference-md)` in the REPL writes it.*

### !-

`!- n`

Arithmetic the other way round: argument - left inlet (!- 1 turns seconds into Hz); lists too.

**Inlets** 

0. a number or a list: subtracted from the right one
1. the minuend (stored)

**Outlets** 

0. the difference

See also: `-`

### !/

`!/ n`

Arithmetic the other way round: argument / left inlet (!/ 1 turns seconds into Hz); lists too.

**Inlets** 

0. a number or a list: what divides the right one (0 if it is 0)
1. the dividend (stored)

**Outlets** 

0. the quotient: !/ 1 gives 1 / the number

See also: `/`, `sample`

### *

`* n`

Arithmetic: left inlet * argument (or the last thing that came in on the right); lists too.

**Inlets** 

0. a number or a list: times the right one
1. the factor (stored)

**Outlets** 

0. the product

See also: `+`, `/`

### +

`+ n`

Arithmetic: left inlet + argument (or the last thing that came in on the right); lists too.

**Inlets** 

0. a number or a list: it adds the right one and sends the result
1. the number to add (stored, nothing is sent)

**Outlets** 

0. the sum

**Try:** The right inlet only stores: change it, then drag the left number to hear (read) the result. A fifth above is + 7.

```clojure
(box :b1 "number 60" 40 30)
(box :b2 "number 7" 130 30)
(box :b3 "+ 7" 40 90)
(box :b4 "print" 40 150)
(connect :b1 0 :b3 0)
(connect :b2 0 :b3 1)
(connect :b3 0 :b4 0)
```

See also: `-`, `*`, `/`

### -

`- n`

Arithmetic: left inlet - argument (or the last thing that came in on the right); lists too.

**Inlets** 

0. a number or a list: minus the right one
1. the number to subtract (stored)

**Outlets** 

0. the difference

See also: `+`

### /

`/ n`

Arithmetic: left inlet / argument (or the last thing that came in on the right); lists too.

**Inlets** 

0. a number or a list: divided by the right one (0 if it is 0)
1. the divisor (stored)

**Outlets** 

0. the quotient

See also: `*`, `!/`

### adc~

`adc~ [channel …]`

Audio input (the microphone or the sound card): one outlet per input channel, the ones written after it (adc~ 1 by default; adc~ 1 2 for stereo). At ▶ it asks for the microphone, and takes its sound as it is, without the echo cancellation, noise suppression and automatic gain made for speech. Every adc~ shares one stream.

**Outlets** 

0. one signal per input channel: those written after it (1 by default)

**Try:** Press ▶ and allow the microphone: sing or clap and watch the scope and the level. It does not go to dac~, so it cannot feed back; send it through a gain~ to hear it (with headphones).

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "scope~ 20" 40 80)
(box :b3 "snapshot~ 50 db" 240 80)
(box :b4 "print" 240 140)
(connect :b1 0 :b2 0)
(connect :b1 0 :b3 0)
(connect :b3 0 :b4 0)
```

See also: `dac~`, `snapshot~`, `scope~`

### adsr~ · `@kairotic/synth`

`adsr~ [a d s r]`

An envelope that follows a gate, for the factor of a gain~. On the left a gate: a signal (reader~ … gate) or numbers (above 0 it attacks to that level, 0 releases); a bang plays attack and decay and then releases. A list [a d s r] changes its shape (a, d, r in ms; s, the sustain, from 0 to 1), and so does dragging over it: attack, decay and release sideways, sustain up and down (⇧ finer); on release the new shape is written in the box.

**Inlets** 

0. a gate (signal or numbers: above 0 attacks, 0 releases), a bang, or [a d s r]

**Outlets** 

0. the envelope signal, 0…peak

**Try:** Start the engine and click the bang: a plucked note. Drag over the envelope to make it longer.

```clojure
(box :b1 "bang" 40 30)
(box :b2 "adsr~ 10 300 0 400" 40 80)
(box :b3 "osc~ 440" 220 80)
(box :b4 "gain~ 0" 220 220)
(box :b5 "dac~" 220 270)
(connect :b1 0 :b2 0)
(connect :b2 0 :b4 1)
(connect :b3 0 :b4 0)
(connect :b4 0 :b5 0)
(connect :b4 0 :b5 1)
```

See also: `gain~`, `reader~`, `synth~`

### bang

A button: when pressed (or on receiving anything) it sends a bang.

**Inlets** 

0. anything: it flashes and sends a bang

**Outlets** 

0. bang

**Messages and gestures**

- `click`: sends a bang

**Try:** Start the engine and click the bang: each click counts one more.

```clojure
(box :b1 "bang" 40 30)
(box :b2 "counter 1" 40 90)
(box :b3 "print" 40 150)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
```

See also: `msg`, `loadbang`, `metro`

### canvas

Graphic buffer for any numeric data: strokes in a plane with axes of any range, linear or log ((axis :b1 :y -1 1)). A number on the inlet (or a click) comes out on the left; edits on the inlet ([:stroke pts], [:erase :t1], [:clear], [:batch [...]]) change it, and questions ([:read x], [:strokes], [:get :t1], [:data]) are answered on the left. The right outlet is the buffer for a reader, which can read it along X or Y.

**Inlets** 

0. a position (or a click): it comes out on the left · an edit ([:stroke [[x y] …]], [:erase :t1], [:clear], [:axis :y 0 1]… or [:batch [edits]]): it changes the buffer, as one event · a question ([:read x], [:strokes], [:get :t1], [:count], [:end], [:range], [:data]): the answer comes out on the left · a musical tree: shown over it

**Outlets** 

0. the position, or the answer to a question
1. the buffer, for a reader or reader~ (on their right inlet)

**Messages and gestures**

- `(axis :bN :x -1 1)`: range of an axis, :log for logarithmic
- `(stroke :bN [[x y] …])`: draws
- `the corner · (resize :bN 640 300)`: drag its bottom-right corner to resize it; a double-click there brings back its size
- `[:stroke [[0 0] [1 1]]] · [:stroke :t3 pts]`: a stroke by message (a new id, or that one)
- `[:move :t1 dx dy] · [:stretch :t1 k] · [:erase :t1] · [:clear]`: edit strokes by message
- `[:axis :x lo hi] · [:axis :y lo hi :log] · [:grid-y step]`: axes and grid by message
- `[:batch [[:clear] [:stroke pts] …]]`: several edits, one event of the history
- `[:read 0.5] · [:read :y 0.2] · [:strokes] · [:get :t1] · [:count] · [:range] · [:data]`: questions: the answer comes out on the left
- `{ } in the header (or a double-click on its right) · (source :bN)`: the buffer as EDN text, in the code window: edit it and apply (Ctrl+Enter); what changed is one event

**Try:** Press ▶: the reader goes along X and prints the height of the stroke. Draw another stroke and listen to the list grow.

```clojure
(box :b1 "canvas" 40 60)
(box :b2 "loadbang" 40 15)
(box :b3 "ramp 0 1 4 loop" 120 15)
(box :b4 "reader" 40 290)
(box :b5 "print" 40 340)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
(connect :b1 1 :b4 1)
(connect :b4 0 :b5 0)
(axis :b1 :x 0 1)
(axis :b1 :y 0 1)
(stroke :b1 [[0 0.2] [0.5 0.9] [1 0.4]])
```

**An automation** — A reader~ goes along the canvas at audio rate: its value is a signal that can move a parameter, here the factor of a gain~ (a tremolo drawn by hand).

*Try:* Press ▶: the stroke becomes the volume of the oscillator every two seconds. Draw a zigzag and listen to it.

```clojure
(box :b6 "phasor~ 0.5" 300 15)
(box :b7 "reader~" 300 290)
(box :b8 "osc~ 330" 420 290)
(box :b9 "gain~ 0" 420 340)
(box :b10 "dac~" 420 390)
(connect :b6 0 :b7 0)
(connect :b1 1 :b7 1)
(connect :b8 0 :b9 0)
(connect :b7 0 :b9 1)
(connect :b9 0 :b10 0)
(connect :b9 0 :b10 1)
```

**A path in two dimensions** — With reader path, the position (0…1) goes along a stroke, and both its X and Y come out: a trajectory, for space~ or for two parameters at once.

*Try:* Press ▶: print writes [x y] as the reader goes around the shape. Connect its outlet to a space~ (see its help) to move a sound along it.

```clojure
(clear :b1)
(axis :b1 :x -1 1)
(axis :b1 :y -1 1)
(stroke :b1 [[0 0.8] [0.7 0.4] [0.5 -0.6] [-0.6 -0.5] [-0.7 0.5] [0 0.8]])
(text! :b4 "reader path")
```

See also: `reader`, `reader~`, `freqt`

### chroma~ · `@kairotic/analysis`

`chroma~ [ms]`

How much of each pitch class a signal has: 12 values from C to B, and the strongest class as a word.

**Inlets** 

0. the signal

**Outlets** 

0. 12 values, C to B, 0…1 (the strongest 1)
1. the strongest pitch class (:c … :b), when it changes

**Try:** Press ▶ and play a chord or a drone: the bars show its pitch classes; print writes the strongest.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "chroma~" 40 90)
(box :b3 "print" 40 170)
(connect :b1 0 :b2 0)
(connect :b2 1 :b3 0)
```

See also: `pitch~`, `mt`, `features~`

### component

`component`

Defines a box class inside the work: its source is a map {:class :doc :io :receive …} with the same contract as any component.

**Messages and gestures**

- `source`: a map {:class "x" :doc … :io [1 1] :receive (fn [m] …)}: defines the class x in the work
- `New component (Components tab) · (new-component!)`: a new definition, from a template, open in the code window
- `Edit · × (Components tab)`: its code in the code window · removes it (one event of the history)
- `a click on its row`: chooses it: the Claude tab can then change it

See also: `script`, `faust~`

### counter

`counter step [max] [min]`

Each bang sends the value and advances one step; goes back to the minimum on reaching the maximum.

**Inlets** 

0. bang (or a number): sends the value and advances one step · reset: back to the minimum
1. a number sets the next value

**Outlets** 

0. the value

See also: `metro`

### dac~

`dac~ [channel …]`

Audio output: each inlet is an output channel, the ones written after it (dac~ 1 2 by default; dac~ 1 2 3 4 … if the sound card has them).

**Inlets** 2: one inlet per output channel: those written after it (1 2 by default)

**Try:** Only the left channel sounds: connect the gain~ to the right inlet too.

```clojure
(box :b1 "osc~ 330" 40 30)
(box :b2 "gain~ 0.2" 40 80)
(box :b3 "dac~ 1 2" 40 130)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
```

See also: `gain~`, `pan~`, `space~`, `adc~`

### draw

`draw [width height]`

A view drawn from the messages that arrive: each shape of kairotic.shapes ([:circle {:cx 40 :cy 40 :r 10 :fill :accent}], [:line …], [:path {:points [[x y] …]}], [:text {:x :y} "…"], [:curve …], [:group {:x :y :rotate} [shapes]]) is added — or as a msg writes it: circle 40 40 10 accent, rect x y w h, line x1 y1 x2 y2, arc cx cy r from to, text x y "words", with a colour and hit name; a list of shapes replaces them all; [:set k shape] (set k circle …) adds or replaces the shape called k (to move a cursor), [:unset k] removes it, clear empties it. A shape with :hit k, pressed, sends k out.

**Inlets** 

0. a shape ([:circle {:cx 40 :cy 40 :r 10 :fill :accent}]) is added; a list of shapes replaces them all; [:set k shape] adds or replaces the one called k; [:unset k] removes it; clear

**Outlets** 

0. the :hit of a shape pressed (a shape with :hit k sends k)

**Messages and gestures**

- `[:circle {:cx :cy :r}]`: a circle (also :rect :line :arc :needle :path :curve :text and :group)
- `[[:line …] [:text …]]`: a list: replaces everything
- `[:set :cursor [:line …]]`: the shape called :cursor, added or moved
- `[:unset :cursor]`: removes it
- `clear`: empties the view

**Try:** Click the three messages, then press the circles: print writes :sun or :moon. From code, any shape of kairotic.shapes: (send! :b4 [:curve {:points [[10 90] [80 20] [150 80] [230 30]] :stroke :accent}]). Shapes take the theme's colours (:ink :soft :accent :kairos :bg :grid) and :opacity.

```clojure
(box :b1 "msg circle 60 55 22 accent hit sun" 40 30)
(box :b2 "msg circle 160 55 14 kairos hit moon" 250 30)
(box :b3 "msg set label text 20 100 \"press one of them\"" 40 70)
(box :b4 "draw 240 120" 40 120)
(box :b5 "print" 40 270)
(connect :b1 0 :b4 0)
(connect :b2 0 :b4 0)
(connect :b3 0 :b4 0)
(connect :b4 0 :b5 0)
```

See also: `monitor`, `pcclock`, `msg`

### edn · `@kairotic/data`

`edn [width height]`

Any value as a tree, like Portal: collections open and close, values coloured by kind; picking a line sends that part (left) and its path (right).

**Inlets** 

0. any value; depth n opens it n levels down; bang sends the part picked again; clear

**Outlets** 

0. the part picked
1. its path, for [:get …] of a fetch box

**Messages and gestures**

- `depth 2`: opens it two levels down
- `bang`: the part picked again (the whole value if none)
- `clear`: empties it
- `▸ ▾ · a line · a drag`: opens or closes · picks it · scrolls (also the bar on the right)

**Try:** The tree arrives: open the measure and pick a note: the note and its path go to print.

```clojure
(box :b1 "tree" 40 30)
(tree! :b1 [:voice [:measure {:meter [4 4]} "c4/1 e4 g4 c5"]])
(box :b2 "edn 320 220" 40 130)
(box :b3 "print" 400 130)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b2 1 :b3 0)
```

See also: `fetch`, `print`, `tree`

### faust~

`faust~`

Faust code box: compiled in the page and played as an AudioWorklet. Its audio ports are those of process; the left inlet also accepts parameters ([:freq 440], a list of Hz with gate). With declare options "[nvoices:8]" it is polyphonic: Hz on the left and voice ids on the right, as synth~ (a keyboard, a reader, mt play), and an effect = …; for all of them.

**Inlets** 

0. audio inputs of process (if any); the left one also takes parameters: [:freq 440]

**Outlets** 

0. audio outputs of process

**Messages and gestures**

- `(code :bN "process = …;")`: writes its source
- `double-click`: edit the code, beside its patch of Faust's own elements (Patch in the bar hides it); Ctrl+Enter applies
- `declare options "[nvoices:8]"`: polyphonic: Hz on the left, voice ids on the right (a second inlet), as synth~; each id a voice
- `[:gain 0.6] · :stop`: polyphonic: the velocity of the next notes · releases every voice
- `effect = …;`: polyphonic: applied once to the sum of the voices

**Try:** Press ▶. Then change 1200 in the code and apply with Ctrl+Enter: the filter opens.

```clojure
(box :b1 "faust~" 40 30)
(box :b2 "dac~" 40 200)
(connect :b1 0 :b2 0)
(connect :b1 0 :b2 1)
(code :b1 "import(\"stdfaust.lib\");\nf = hslider(\"freq\", 220, 50, 2000, 1);\nprocess = os.sawtooth(f) * 0.1 : fi.lowpass(2, 1200);")
```

**Polyphonic: a keyboard** — With declare options "[nvoices:8]" the source is a voice: its freq, gain and gate are set note by note by Faust's own allocator, for up to 8 notes at once (the oldest is taken when they run out). Hz on the left and voice ids on the right, as synth~; [:gain v] is the velocity of the next notes.

*Try:* Press ▶ and play a chord (⇧-click several keys): every key a voice. Touch lower on the keys to play louder. Its other controls (cutoff) are for every voice.

```clojure
(box :b3 "faust~" 300 30)
(code :b3 "import(\"stdfaust.lib\");\ndeclare options \"[nvoices:8]\";\nfreq = hslider(\"freq\", 440, 40, 4000, 0.01);\ngain = hslider(\"gain\", 0.8, 0, 1, 0.01);\ngate = button(\"gate\");\ncutoff = hslider(\"cutoff\", 2400, 200, 8000, 1);\nprocess = os.sawtooth(freq) * gain * en.adsr(0.01, 0.2, 0.6, 0.6, gate) * 0.12 : fi.lowpass(2, cutoff);")
(box :b4 "keyboard" 300 210)
(connect :b4 0 :b3 0)
(connect :b4 1 :b3 1)
(connect :b4 3 :b3 0)
(connect :b3 0 :b2 0)
(connect :b3 0 :b2 1)
```

**A score in several voices** — mt play sends the Hz of the notes sounding and their voice ids: each note of a chord, a voice of the faust~.

*Try:* Press ▶ and click msg bang: the four chords in a loop; msg stop ends it.

```clojure
(box :b5 "tree" 560 30)
(code :b5 "\"c4+e4+g4/2 d4+f4+a4/2 b3+d4+g4/2 c4+e4+g4+c5/2\"")
(box :b6 "msg bang" 560 150)
(box :b7 "msg stop" 640 150)
(box :b8 "mt play loop" 560 190)
(connect :b5 0 :b8 0)
(connect :b6 0 :b8 0)
(connect :b7 0 :b8 0)
(connect :b8 0 :b3 0)
(connect :b8 1 :b3 1)
```

**Any tuning** — The notes reach the voices as MIDI pitches with decimals, so any frequency sounds as written: here a just major triad (4:5:6), then the equal-tempered one.

*Try:* Press ▶ and click the first two messages in turn: the just third is 14 cents lower, and it does not beat.

```clojure
(box :b9 "msg 220 275 330" 560 260)
(box :b10 "msg 220 277.18 329.63" 700 260)
(box :b11 "msg stop" 870 260)
(connect :b9 0 :b3 0)
(connect :b10 0 :b3 0)
(connect :b11 0 :b3 0)
```

**An effect for all the voices** — effect = …; in the same source is applied once, to the sum of the voices (here an echo); its controls are parameters of the box too.

*Try:* Press ▶ and play the keyboard again: every note echoes. Change ef.echo(1, 0.33, 0.45) and apply it (Ctrl+Enter).

```clojure
(code :b3 "import(\"stdfaust.lib\");\ndeclare options \"[nvoices:8]\";\nfreq = hslider(\"freq\", 440, 40, 4000, 0.01);\ngain = hslider(\"gain\", 0.8, 0, 1, 0.01);\ngate = button(\"gate\");\ncutoff = hslider(\"cutoff\", 2400, 200, 8000, 1);\nprocess = os.sawtooth(freq) * gain * en.adsr(0.01, 0.2, 0.6, 0.6, gate) * 0.12 : fi.lowpass(2, cutoff);\neffect = ef.echo(1, 0.33, 0.45);")
```

See also: `knob`, `component`, `script`

### features~ · `@kairotic/analysis`

`features~ [ms] [descriptor …]`

Descriptors of a signal every ms, one outlet per word: rms, energy, zcr, loudness, centroid, spread, flatness, rolloff, kurtosis, skewness, slope, crest, sharpness, perceptualSpread, mfcc, chroma (Meyda).

**Inlets** 

0. the signal

**Outlets** 

0. one outlet per descriptor written, in order (rms centroid flatness without words); centroid, spread and rolloff in Hz

**Try:** Press ▶ and allow the microphone: whisper and then hum — the centroid (brightness) falls.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "features~ 50 rms centroid" 40 90)
(box :b3 "number" 40 150)
(box :b4 "number" 200 150)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b2 1 :b4 0)
```

See also: `pitch~`, `chroma~`, `snapshot~`

### fetch · `@kairotic/data`

`fetch [json|text|edn] [live]`

Brings in what is at a URL (JSON read as EDN, text or EDN) as a task: it goes out on the left and is kept as the data of the box, in the history, the same for everyone; with live, only in this tab.

**Inlets** 

0. a URL (msg https://… · github:owner/repo@ref/path · [:fetch url]); refresh; bang; [:get key …]; clear

**Outlets** 

0. what it found (or the part a [:get …] asks for)
1. :loading, :ready or [:error "…"]

**Messages and gestures**

- `a URL`: brings it in; a URL it already keeps is sent again, not fetched
- `refresh`: fetches its URL again
- `bang`: sends what it holds
- `get items 0 name · [:get [:items 0 :name]]`: sends one part of it
- `clear`: forgets it
- `(keep! :bN {:url "…" :value …})`: what it keeps, as the code of the work writes it

**Try:** Click the message: the answer arrives in the edn box, and stays in the work (go back and forward in the history: it is not fetched again). Pick a line: its value goes to print.

```clojure
(box :b1 "msg github:bonuoq/kairotic@main/packages/data/package.json" 40 30)
(box :b2 "fetch" 40 80)
(box :b3 "edn 340 260" 40 150)
(box :b4 "print" 400 150)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
```

See also: `edn`, `sample`, `print`

### form~ · `@kairotic/analysis`

`form~ [seconds] [step] [kernel]`

How alike the moments of what arrives are over the last seconds (20): a self-similarity matrix of one frame every step seconds (0.25), drawn; where a segment begins, and the period that repeats.

**Inlets** 

0. lists of numbers (a chroma~, an mfcc), or numbers (onset~'s envelope, an rms); [:seconds x] [:step x] [:kernel x] change them; clear forgets

**Outlets** 

0. the novelty of each frame, 0…1 (how much the music changes there; kernel seconds (2) late)
1. a bang where a segment begins
2. the period that repeats most, in seconds, when it changes
3. [:segment {:t :at :length :period}] for the segment that ends

**Try:** Press ▶ and play a section, then another (other chords, another register): the squares along the diagonal are the sections, a line marks where the second begins, print writes the segment, and onset~ starts the new section afresh.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "chroma~" 40 90)
(box :b3 "onset~" 200 90)
(box :b4 "form~" 40 150)
(box :b5 "print" 280 300)
(connect :b1 0 :b2 0)
(connect :b1 0 :b3 0)
(connect :b2 0 :b4 0)
(connect :b4 3 :b3 0)
(connect :b4 3 :b5 0)
```

See also: `chroma~`, `onset~`, `monitor`

### fourier · `@kairotic/theory`

`fourier [notes]`

The six Fourier coefficients of a pitch-class distribution (chromatic, dyadic, triadic, octatonic, diatonic, whole-tone), each a point in its circle with its trail.

**Inlets** 

0. a list of pitches (MIDI or 0…11), a list of 12 weights (a chroma, from chroma~), or a number: a note (the last n count: 4); clear

**Outlets** 

0. the six magnitudes, 0…1
1. the six phases, in degrees

**Try:** The diatonic scale fills f5; the augmented triad, f3 and f6 at 1. With adc~ → chroma~ → fourier, sing or play and watch the trails.

```clojure
(box :b1 "msg 60 62 64 65 67 69 71" 40 30)
(box :b2 "msg 60 64 68" 240 30)
(box :b3 "fourier" 40 80)
(connect :b1 0 :b3 0)
(connect :b2 0 :b3 0)
```

See also: `pcclock`, `tonnetz`, `chroma~`

### freqt

Graphic buffer of frequency over time: Hz on a log scale, time from 0, tunings (Scala) and bar grids, drawn as a canvas or as a score ((view :b1 :score), ⇄ in its header). A number on the inlet (or a click) comes out on the left; edits on the inlet ([:note t "c4" dur], [:stroke pts], [:erase :t1], [:clear], [:batch [...]]) change it, and questions ([:read t], [:strokes], [:end], [:data]) are answered on the left. The second outlet is the buffer for a reader. A musical tree on the inlet is shown over it, measured; shown as a score, the edits you make on that tree's notes leave by the third outlet ([:edit …]): connect it back to the tree box.

**Inlets** 

0. a time (or a click): it comes out on the left · an edit ([:note t "c4" dur], [:stroke [[t hz] …]], [:erase :t1], [:clear], [:tuning "19-tet"], [:grid-x 0.25 [4]]… or [:batch [edits]]): it changes the buffer, as one event · a question ([:read t], [:strokes], [:get :t1], [:count], [:end], [:data]): the answer comes out on the left · a musical tree: shown over it

**Outlets** 

0. the time, or the answer to a question
1. the buffer, for a reader or reader~
2. shown as a score: the edits made on the notes of the tree it shows ([:edit …]), for the tree box

**Messages and gestures**

- `(note :bN t "c4" dur)`: a note
- `(tuning :bN "31-tet" 261.63)`: a tuning
- `(grid-x :bN 0.25 "3+3+2")`: a bar grid
- `the corner · (resize :bN 640 300)`: drag its bottom-right corner to resize it (as a score, its width reflows the notation); a double-click there brings back its size
- `[:note 0 "c4" 1] · [:note 1 64 0.5]`: a note by message (pitch as a name or MIDI)
- `[:move :t1 dt cents] · [:stretch :t1 k] · [:erase :t1] · [:clear]`: edit notes by message
- `[:tuning "19-tet" 261.63] · [:grid-x 0.25 [4]]`: tuning and grid by message
- `[:batch [[:clear] [:note 0 "c4" 1] …]]`: several edits, one event of the history
- `[:read 2] · [:strokes] · [:get :t1] · [:count] · [:end] · [:data]`: questions: the answer comes out on the left
- `⇄ score in the header · (view :bN :score)`: the same buffer, quantized and drawn as a score: measures in the meter of its bar grid, tuplets, ties (⇄ canvas brings it back)
- `(quantize :bN {:meter "6/8"})`: the tree that score shows, to keep or edit (options: :meter :divs :merge :nest :voices :grace :legato)
- `shown as a score, alt-click a note · (division! :bN t)`: its beat divided the next way (another division, in halves, with the next beat), kept in the buffer
- `(to-tree! :bN)`: a tree box beside it, with its strokes as notes: the drawing, now a tree
- `(quant :bN {:meter "6/8" :key "eb"}) · [:quantize {…}]`: how its score is quantized and in which key, kept in its buffer (one event); (quant :bN nil): the defaults. {:meters ["3/4" "5/8[2+3]"]}: a meter for each bar, the last going on
- `(track! :bN) · (quant :bN {:time :track})`: what was played freely (transcribe, at any tempo, with rubato) written on its beats: the tempo and the beats are found, and track! keeps them (the time map) so that the score stays as it is; if the bar starts in the wrong place, (track! :bN {:downbeat t}) with the time of a note that starts a bar; (track! :bN nil) forgets them
- `shown as a score, shift-alt-click a note · (enharmonic! :bN t midi)`: another name for that note (c#4 → db4), kept in the buffer
- `shown as a score, click a note of a tree`: ↑ ↓ pitch (⇧ octave) · a…g the nearest note of that name · + − duration · ← → next · Delete → rest
- `click a rest`: Enter → a note (the pitch of the one before) · ↑ ↓ a step above or below it · a…g that note
- `(keep! :bN)`: writes the tree it shows into its buffer, with its recipe beside it (the tree and the boxes that made it)
- `(recipe :bN) · (remake! :bN)`: the recipe of a kept buffer · the tree written back, without the changes made since
- `{ } in the header (or a double-click on its right) · (source :bN)`: the buffer as EDN text, in the code window: edit it and apply (Ctrl+Enter); what changed is one event

**Try:** Press ▶: the reader~ plays the four beats again and again. Draw a stroke of your own, straight or curved: it sounds at the frequency it passes through.

```clojure
(box :b1 "freqt" 40 60)
(box :b2 "phasor~ 0.25" 40 15)
(box :b3 "reader~ 1 gate" 40 290)
(box :b4 "osc~" 40 340)
(box :b5 "gain~" 40 390)
(box :b6 "dac~" 40 440)
(connect :b2 0 :b3 0)
(connect :b1 1 :b3 1)
(connect :b3 0 :b4 0)
(connect :b3 1 :b5 1)
(connect :b4 0 :b5 0)
(connect :b5 0 :b6 0)
(connect :b5 0 :b6 1)
(melody :b1 "c4/1 e4/.5 d4/.5 g4/2" 0)
```

**A tuning and a grid** — A freqt can have a tuning (the lines of its Y axis: any equal division, just intonation, a Scala .scl) and a grid of time with its bars. Drawing snaps to both.

*Try:* Draw a few notes: they fall on the 19 degrees of the octave and on the half beats. Try (tuning :b1 "just-5") or (tuning :b1 nil) to draw freely again.

```clojure
(tuning :b1 "19-tet")
(grid-x :b1 0.5 [4])
```

**As a score** — The same buffer can be shown as a score, quantized into measures (in the meter of its bar grid, with tuplets and ties): ⇄ score in its header, or (view :b1 :score). Nothing changes in the data; ⇄ canvas brings the drawing back, and (quantize :b1) gives the tree the score shows.

*Try:* Press ▶: the score sounds the same as the drawing did. To edit notes one by one in a score, show a tree: see the help of tree.

```clojure
(tuning :b1 nil)
(view :b1 :score)
```

**The viewer of a tree** — A freqt shown as a score is the viewer of a tree that comes transformed (tree → mt transpose 7 → freqt). Its third outlet sends the edits made on the notes back to the tree box. (A box written "score", from older works, is a freqt shown as a score.)

*Try:* Click a note of the new score and press ↑ or ↓, + or −, Delete (a rest) and then Enter (a note again): the change goes back to the tree by the dashed line.

```clojure
(box :b7 "bang" 300 15)
(box :b8 "tree" 300 60)
(code :b8 "\"c5/1 b4/.5 a4 g4/2\"")
(box :b9 "freqt" 300 160)
(view :b9 :score)
(connect :b7 0 :b8 0)
(connect :b8 0 :b9 0)
(connect :b9 2 :b8 0)
```

See also: `canvas`, `reader`, `tree`

### ftom

Hz → MIDI pitch (lists too).

**Inlets** 

0. a frequency in Hz or a list of them

**Outlets** 

0. the MIDI pitch, with decimals for what falls between keys

See also: `mtof`

### gain~

`gain~ [factor]`

Gain: signal on the left, factor on the right — a number, or a signal (an envelope, a reader~) that then is the factor.

**Inlets** 

0. the signal
1. the factor: a number, or a signal (an envelope) that then is the factor

**Outlets** 

0. the signal times the factor

See also: `osc~`, `adsr~`, `dac~`

### gendy~ · `@kairotic/synth`

`gendy~ [freq x-step y-min y-max y-step breakpoints]`

A dynamic stochastic oscillator, after Xenakis's GENDY (and GendyJS by Andrew Bernstein, MIT): a wave of breakpoints whose amplitudes and durations each take a random walk between mirror barriers, cycle after cycle, heard as a pitch that drifts and a timbre that changes. freq in Hz (a signal on the inlet adds to it: FM); x-step (0–100 %) how far each segment's duration may wander; y-min and y-max (−1…1) the barriers of the amplitudes, y-step how far they move each cycle; breakpoints (2–128) how many. A number sets freq; [:y-step 0.2] one of them; a list of six all of them.

**Inlets** 

0. a number: the frequency in Hz · [:x-step 30], [:y-step 0.2]…: one parameter · a list of six: all of them · a signal: added to the frequency, in Hz (FM)

**Outlets** 

0. the sound (about ±0.15 by default: y-min and y-max are its barriers)

**Messages and gestures**

- `220`: the frequency
- `[:x-step 40]`: how far the durations wander (0–100 %): the pitch drifts
- `[:y-step 0.2]`: how far the amplitudes move each cycle: the timbre changes faster
- `[:breakpoints 6]`: fewer breakpoints, a simpler wave (more of them, a richer one); changing it keeps the wave
- `[220 10 -0.15 0.15 0.05 16]`: freq x-step y-min y-max y-step breakpoints

**Try:** Press ▶: a buzz whose pitch and colour never settle. Write gendy~ 110 0 in the box: with no wander of the durations, the pitch holds and only the timbre moves.

```clojure
(box :b1 "gendy~ 110" 40 30)
(box :b2 "dac~" 40 90)
(box :b3 "scope~ 30" 160 90)
(connect :b1 0 :b2 0)
(connect :b1 0 :b2 1)
(connect :b1 0 :b3 0)
```

**The two walks** — x-step lets the durations wander (the pitch), y-step the amplitudes (the timbre). Two knobs send them by name.

*Try:* Press ▶ and turn x-step up: the pitch scatters into noise. Turn it down and y-step up: one pitch, a restless colour.

```clojure
(box :b4 "knob 0 100 10 x-step" 300 20)
(box :b5 "knob 0 0.3 0.05 y-step" 390 20)
(connect :b4 0 :b1 0)
(connect :b5 0 :b1 0)
```

**Breakpoints** — Few breakpoints make a simple wave, close to a triangle or a square; many, a richer and noisier one. Changing their number keeps the wave, with no click.

*Try:* Press ▶ and click both messages in turn, watching the scope.

```clojure
(box :b6 "msg breakpoints 4" 300 120)
(box :b7 "msg breakpoints 48" 440 120)
(connect :b6 0 :b1 0)
(connect :b7 0 :b1 0)
```

**A signal on the inlet: FM** — A signal connected to the inlet is added to the frequency, in Hz: a slow one makes a vibrato, a fast one frequency modulation.

*Try:* Press ▶: 5 Hz around 110 Hz. Change osc~ 5 to osc~ 80 for a rougher sound.

```clojure
(box :b8 "osc~ 5" 300 200)
(box :b9 "gain~ 300" 300 250)
(connect :b8 0 :b9 0)
(connect :b9 0 :b1 0)
```

See also: `osc~`, `synth~`, `faust~`

### inlet

An inlet of the sub-patch it is in (inlets are numbered left to right). Passes on the messages that arrive at it.

**Outlets** 

0. what arrives at this inlet of the sub-patch

See also: `patch`, `outlet`, `inlet~`

### inlet~

An audio inlet of the sub-patch it is in (numbered left to right, together with the message inlets).

**Outlets** 

0. the signal that arrives at this inlet of the sub-patch

See also: `patch`, `outlet~`

### loadbang

Sends a bang when the engine starts (▶).

**Outlets** 

0. a bang when the engine starts (▶)

**Try:** Press ▶: the bang arrives at print, which writes it in the REPL.

```clojure
(box :b1 "loadbang" 40 30)
(box :b2 "print" 40 90)
(connect :b1 0 :b2 0)
```

See also: `bang`, `metro`

### metro

`metro ms`

Sends periodic bangs: 1 or bang starts it, 0 or stop stops it.

**Inlets** 

0. bang, 1 or start: starts · 0 or stop: stops
1. the interval in ms

**Outlets** 

0. a bang every interval

**Try:** Start the engine, then 1 and 0: a pulse that counts from 0 to 7.

```clojure
(box :b1 "msg 1" 40 30)
(box :b2 "msg 0" 100 30)
(box :b3 "metro 250" 40 90)
(box :b4 "counter 1 8" 40 150)
(box :b5 "print" 40 210)
(connect :b1 0 :b3 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
(connect :b4 0 :b5 0)
```

See also: `counter`, `ramp`, `loadbang`

### monitor · `@kairotic/analysis`

`monitor [seconds] [name …]`

Draws the messages that arrive over the last seconds, one lane per inlet: a number as a line, a list as a strip of cells, a bang or a word as a mark.

**Inlets** 

0. anything, drawn in the first lane; with names (monitor 6 rms centroid chroma) one inlet per name, left to right

**Try:** Press ▶ and allow the microphone: speak, then sing a long note — the centroid falls, the chroma strip settles on one row, each syllable leaves a mark.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "features~ 20 rms centroid" 40 90)
(box :b3 "chroma~" 260 90)
(box :b4 "onset~" 460 90)
(box :b5 "monitor 6 rms centroid chroma onset" 40 180)
(connect :b1 0 :b2 0)
(connect :b1 0 :b3 0)
(connect :b1 0 :b4 0)
(connect :b2 0 :b5 0)
(connect :b2 1 :b5 1)
(connect :b3 0 :b5 2)
(connect :b4 0 :b5 3)
```

See also: `features~`, `chroma~`, `onset~`, `print`

### msg

`msg 0 8 4`

Message: when pressed it sends its content: a number, a word such as stop, text between quotes ("https://…", "two words") as a string, or a list of them.

**Inlets** 

0. anything (or a click): sends its content

**Outlets** 

0. its content: a number, a word such as stop, a string between quotes ("https://…"), or a list of them

**Try:** Start the engine and click the two messages: two MIDI pitches become two frequencies.

```clojure
(box :b1 "msg 60" 40 30)
(box :b2 "msg 67" 110 30)
(box :b3 "mtof" 40 90)
(box :b4 "osc~ 261.63" 40 140)
(box :b5 "gain~ 0.3" 40 190)
(box :b6 "dac~" 40 240)
(connect :b1 0 :b3 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
(connect :b4 0 :b5 0)
(connect :b5 0 :b6 0)
(connect :b5 0 :b6 1)
```

See also: `number`, `bang`

### mt

`mt <operation> [arguments]`

Operations on musical trees: a tree on the left comes out transformed. transpose n (semitones, or an interval: M3, -P5, A4) · invert [pivot] · retrograde · augment f · rotate k · canon delay [interval] · thin amount (keeps the notes on the strongest positions of each measure: a share, 0.5, or how many, 3) · seq / par (joins the left tree with the one on the right) · events · pitches · duration · play [loop] (a bang plays the last tree: Hz and voice ids for synth~, parameters and marks).

**Inlets** 1: a tree: it comes out transformed (for play: a tree to play, then bang, stop) · for transpose, invert, augment, rotate, canon, thin: the amount · for seq, par: the tree to join

**Outlets** 

0. the result (for play: the Hz of the notes sounding, a list)

**Messages and gestures**

- `mt transpose 7`: seven semitones up
- `mt invert c4`: mirrored around c4
- `mt retrograde`: backwards
- `mt augment 2`: twice as long
- `mt rotate 1`: the first element goes to the end
- `mt canon 2 7`: against itself, 2 beats later, a fifth up
- `mt thin 0.5`: keeps half the notes of each measure, the ones on its strongest positions (metric weight)
- `mt seq · mt par`: the left tree followed by (or with) the right one
- `mt events · mt pitches · mt duration`: the tree as data
- `mt play [loop]`: plays it: Hz (0) and voice ids (1) for synth~, parameters (2), dynamics and texts (3)

**Try:** Change the box text to mt retrograde, mt invert c4 or mt augment 2: the score follows. (The number on the right inlet takes effect with the next tree: click the bang.)

```clojure
(box :b1 "bang" 40 20)
(box :b2 "tree" 40 60)
(code :b2 "\"c4/1 d4/.5 e4 g4/1 e4 f4/.5 e4 d4/2\"")
(box :b4 "number 7" 220 140)
(box :b3 "mt transpose 7" 40 170)
(box :b5 "freqt" 40 220)
(view :b5 :score)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b4 0 :b3 1)
(connect :b3 0 :b5 0)
```

**Two voices: a canon** — mt canon d i puts the tree against itself, d beats later and i semitones away: two voices that the score shows as two staves.

*Try:* Click the bang. Change it to mt canon 1 -12 (an octave below, one beat later) or mt canon 4 0.

```clojure
(text! :b3 "mt canon 2 7")
(delete :b4)
```

**Playing it** — mt play reads a tree in time: the Hz of the notes that sound (left) and their voice ids (second) go to a synth~, which gives each voice its own note.

*Try:* Press ▶, click the first bang (the tree goes to mt play) and then msg bang: the canon sounds in a loop; stop ends it.

```clojure
(box :b6 "msg bang" 300 170)
(box :b7 "msg stop" 370 170)
(box :b8 "mt play loop" 300 220)
(box :b9 "synth~" 300 270)
(box :b10 "gain~ 0.3" 300 320)
(box :b11 "dac~" 300 370)
(connect :b3 0 :b8 0)
(connect :b6 0 :b8 0)
(connect :b7 0 :b8 0)
(connect :b8 0 :b9 0)
(connect :b8 1 :b9 1)
(connect :b9 0 :b10 0)
(connect :b10 0 :b11 0)
(connect :b10 0 :b11 1)
```

See also: `tree`, `freqt`, `synth~`

### mtof

MIDI pitch → Hz (lists too).

**Inlets** 

0. a MIDI pitch (60 = middle C) or a list of them

**Outlets** 

0. the frequency in Hz (or the list)

**Try:** Drag the number: 69 is A4, 440 Hz; every 12 steps the frequency doubles.

```clojure
(box :b1 "number 69" 40 30)
(box :b2 "mtof" 40 90)
(box :b3 "print" 40 150)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
```

See also: `ftom`, `osc~`

### number

`number [initial]`

A draggable number; sends it when it changes or on receiving a bang.

**Inlets** 

0. a number sets it and sends it on; a bang sends it again

**Outlets** 

0. the number

**Messages and gestures**

- `drag`: up and down changes it (and sends it)
- `double-click`: type a number (Enter sends it, Esc closes); so too knobs and the sliders of faust~

**Try:** Start the engine and drag the number: the oscillator follows.

```clojure
(box :b1 "number 440" 40 30)
(box :b2 "osc~ 440" 40 90)
(box :b3 "gain~ 0.3" 40 140)
(box :b4 "dac~" 40 190)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
(connect :b3 0 :b4 1)
```

See also: `msg`, `knob`

### onset~ · `@kairotic/analysis`

`onset~ [threshold] [ms]`

A bang at the beginning of each sound (a note, a stroke, a syllable), and its strength.

**Inlets** 

0. the signal; [:threshold x] and [:ms y] change them while it listens; a [:segment …] from form~ forgets the usual change of the section before

**Outlets** 

0. a bang for each onset
1. its strength (the growth of the spectrum, 0…1)
2. the growth of every frame (the onset strength envelope)

**Try:** Press ▶ and clap: the counter counts the claps. Raise the threshold if it counts too much.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "onset~" 40 90)
(box :b3 "counter 1" 40 150)
(box :b4 "number" 40 200)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
```

See also: `pitch~`, `sample`, `counter`, `form~`

### osc~

`osc~ [hz]`

Sine oscillator. A number on the left changes its frequency; a signal on the left (from reader~, sig~…) is its frequency in Hz.

**Inlets** 

0. a number: the frequency in Hz · a signal: the frequency itself
1. —

**Outlets** 

0. a sine signal (quiet: 0.15)

**Try:** Start the engine and drag the number. Then put a phasor~ through a * into the left inlet: a signal instead of numbers.

```clojure
(box :b1 "number 440" 40 30)
(box :b2 "osc~ 440" 40 90)
(box :b3 "gain~ 0.3" 40 140)
(box :b4 "dac~" 40 190)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
(connect :b3 0 :b4 1)
```

See also: `gain~`, `dac~`, `phasor~`, `mtof`

### outlet

An outlet of the sub-patch it is in (numbered left to right). Sends out of the sub-patch what arrives at it.

**Inlets** 

0. what leaves the sub-patch by this outlet

See also: `patch`, `inlet`, `outlet~`

### outlet~

An audio outlet of the sub-patch it is in (numbered left to right, together with the message outlets).

**Inlets** 

0. the signal that leaves the sub-patch by this outlet

See also: `patch`, `inlet~`

### pan~ · `@kairotic/spatial`

`pan~ [position]`

Stereo panning with equal power: signal on the left inlet, position on the right (−1 left … 1 right). Two outlets: left and right.

**Inlets** 

0. the signal
1. the position: −1 left … 1 right

**Outlets** 

0. left
1. right

See also: `space~`, `dac~`

### patch

`patch [name]`

An embedded sub-patch: double-click to open it. Its inlet / outlet boxes (numbered left to right) are its ports.

**Messages and gestures**

- `double-click`: opens it
- `(abstract :bN "name")`: turns it into a class (an abstraction)

See also: `inlet`, `outlet`

### pattern · `@kairotic/patterns`

`pattern [seed] [repeat] [loop]`

A pattern as Clojure code: an expression that returns event maps (or one map, read as a pbind), with seeded randomness and pbind, pseq, pwhite, pchoose, pshuffle, pseries, pwalk at hand. In a shared room it runs only after (trust-scripts true).

**Inlets** 

0. bang: sends its pattern again

**Outlets** 

0. its pattern (a factory of streams), for a player

**Messages and gestures**

- `(pbind {:degree (pwhite 0 7) :dur 0.25} :inf)`: a pbind whose values are lazy sequences
- `(concat (pbind m1) (pbind m2))`: phrases one after another
- `(for [d (range 8)] {:degree d :dur (if (even? d) 0.5 0.25)})`: any Clojure that gives event maps
- `rand · rand-int · rand-nth · shuffle`: seeded by the box: the same for everyone

**Try:** Press ▶ and start. Edit the code (double-click the box) and apply: the player follows the new pattern from the beat it is on.

```clojure
(box :b1 "pattern 3" 40 30)
(code :b1 "(pbind {:degree (pwhite 0 7)\n        :dur    (pchoose [0.25 0.25 0.5])\n        :octave [5 5 6]}\n       :inf)")
(box :b2 "msg start" 40 130)
(box :b3 "msg stop" 110 130)
(box :b4 "player 120" 40 180)
(box :b5 "synth~" 40 240)
(box :b6 "dac~" 40 290)
(connect :b2 0 :b4 0)
(connect :b3 0 :b4 0)
(connect :b1 0 :b4 1)
(connect :b4 0 :b5 0)
(connect :b4 1 :b5 1)
(connect :b5 0 :b6 0)
(connect :b5 0 :b6 1)
```

See also: `pbind`, `player`, `script`

### pbind · `@kairotic/patterns`

`pbind [seed] [repeat] [loop]`

A pattern as EDN data: a map of constants, sequences and #pat/… generators, with its randomness seeded. It sends its pattern whenever it changes, for a player.

**Inlets** 

0. bang: sends its pattern again · a map: replaces it (one event of the history) · [:set :dur [1 0.5]]: one key · [:unset :amp]

**Outlets** 

0. its pattern (a factory of streams), for a player

**Messages and gestures**

- `{:degree [0 2 4] :dur 0.5}`: a key with a vector is a sequence; the shorter ones start again until the longest ends
- `#pat/choose [0.25 0.5] · #pat/white [0 7] · #pat/walk [0 2 -7 7]`: endless random values (the same for everyone: the seed)
- `#pat/shuffle [0 2 4] · #pat/series [0 2 8]`: every pass in a new order · an arithmetic series
- `#pat/hold [4 [:c :g :d]]`: one value every 4 beats (following time, not events)
- `#pat/chord [0 4 7]`: a vector as one value: a chord
- `{:degree [0 2 :rest 4]} · [0 nil 4]`: a silence: :rest (:_ :- :r) or nil as the degree, note or freq
- `:amp #pat/white [0.2 0.6]`: the loudness of each note (0…1), for synth~ and a polyphonic faust~
- `pbind 7 · pbind 7 4 · pbind 7 loop`: the seed · four passes · for ever

**Try:** Press ▶ and start: four notes in a new order every pass. Change :dur in the pbind (double-click it) and apply: the player goes on with it from the same beat. Change the seed (pbind 8 loop): other orders, but the same for everyone in a room.

```clojure
(box :b1 "pbind 7 loop" 40 30)
(code :b1 "{:degree #pat/shuffle [0 2 4 7]\n :dur    [0.5 0.5 1]\n :amp    #pat/white [0.1 0.3]}")
(box :b2 "msg start" 40 130)
(box :b3 "msg stop" 110 130)
(box :b4 "player 110" 40 180)
(box :b5 "synth~" 40 240)
(box :b6 "dac~" 40 290)
(connect :b2 0 :b4 0)
(connect :b3 0 :b4 0)
(connect :b1 0 :b4 1)
(connect :b4 0 :b5 0)
(connect :b4 1 :b5 1)
(connect :b5 0 :b6 0)
(connect :b5 0 :b6 1)
```

**One value per bar** — #pat/hold follows time: the root changes every 4 beats whatever the rhythm, as Overtone's ^{:dur 4} does.

*Try:* Press start: the same figure, moving through four harmonies.

```clojure
(code :b1 "{:degree #pat/shuffle [0 2 4 7]\n :dur    [0.5 0.5 1]\n :root   #pat/hold [4 [:c :f :g :c]]}")
```

**Random, but the same** — Every key has a seed of its own (the box's seed and its name): changing one key leaves the randomness of the others as it was.

*Try:* Start, stop and start again: the same walk. Change :scale to :lydian: the same rhythm and contour, other notes.

```clojure
(code :b1 "{:degree #pat/walk [0 1 -4 9]\n :dur    #pat/choose [0.25 0.25 0.5]\n :scale  :dorian}")
```

See also: `pattern`, `player`, `tree`

### pcclock · `@kairotic/theory`

`pcclock [notes]`

A pitch-class set on the clock face: its polygon, the sets before it, its axes of symmetry; its prime form and interval vector go out.

**Inlets** 

0. a list of pitches (MIDI or 0…11), a list of 12 weights (a chroma), or a number: a note, the last n notes (4) being the set; clear

**Outlets** 

0. the prime form, when the set changes
1. the interval vector
2. the pitch class pressed

**Try:** Click the major triad, then the diminished seventh: (0 3 7) has no axis, (0 3 6 9) has four. Press a pitch class on the clock: it comes out on the right.

```clojure
(box :b1 "msg 60 64 67" 40 30)
(box :b2 "msg 60 63 66 69" 140 30)
(box :b3 "pcclock" 40 80)
(box :b4 "print" 40 330)
(connect :b1 0 :b3 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
```

See also: `fourier`, `tonnetz`, `chroma~`

### phasor~

`phasor~ [hz]`

A ramp signal from 0 to 1, repeated hz times per second (0.25 = once every 4 seconds). A number on the left changes hz.

**Inlets** 

0. a number: the frequency in Hz (0.25 = once every 4 seconds)

**Outlets** 

0. a ramp signal from 0 to 1

See also: `reader~`, `sig~`

### pitch~ · `@kairotic/analysis`

`pitch~ [lo hi] [threshold]`

The pitch of a signal by YIN: Hz on the left (0 once when it stops hearing one), how clearly periodic on the right.

**Inlets** 

0. the signal

**Outlets** 

0. the frequency in Hz, only when it changes; 0 once when it no longer finds one
1. the clarity, 0…1

**Try:** Press ▶ and sing: the box shows the note and its cents, the number the MIDI pitch.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "pitch~ 80 1000" 40 90)
(box :b3 "ftom" 40 150)
(box :b4 "number" 40 200)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
```

See also: `onset~`, `ftom`, `freqt`

### player · `@kairotic/patterns`

`player [bpm] [quant] [jump] [limit] [edges] [spread]`

Plays a pattern by its own clock (start/stop), one step at a time (bang) or at a position in beats (a number): the Hz and voice ids of the notes sounding, the whole event and the beat.

**Inlets** 

0. start · stop: its own clock · bang: one step, now · a number: a position in beats · seek p · reset · [:bpm 90]
1. a pattern (from a pbind or a pattern box): a new one goes on from the same beat

**Outlets** 

0. the Hz of the notes sounding (a list), after [:gain amp] when the event has :amp
1. their voice ids, sent first (for synth~ or a polyphonic faust~)
2. the whole event, with :beat, :hz and :ids (and :dir :back when entered from its end)
3. the beat

**Messages and gestures**

- `start · stop`: its own clock: every event lasts its :dur in beats at its bpm
- `player 120 4`: start on a multiple of 4 beats: players with the same tempo meet
- `[:bpm 90]`: another tempo, without a jump
- `bang`: the next event now (and the ones of :dur 0 right after it)
- `a number`: a position in beats: every event is a span, from its onset to its end, that sounds while the position is inside it — entered at its onset going forwards, at its end going backwards (:dir :back); what a step passes over sounds within it
- `seek 8 · [:seek 8]`: there at once, nothing in between: what still sounds there goes on, what starts to contain that position starts
- `player 120 0 8 8`: a step more than 8 (jump) times the one before it, or longer than 8 (limit) beats, is a seek: the wrap of a ramp
- `player 120 0 8 8 edges`: a seek sounds only what starts exactly there
- `player 120 0 8 8 spread`: what a step passes keeps its rhythm, one step later (with ▶)
- `reset`: back to the beginning, silently

**Try:** Press ▶ and start: the six notes, three durations cycling. The third outlet is the whole event: print writes the beat of each.

```clojure
(box :b1 "pbind 1 loop" 40 30)
(code :b1 "{:note [:c4 :e4 :g4 :b4 :a4 :f4]\n :dur  [0.5 0.5 1]}")
(box :b2 "msg start" 40 130)
(box :b3 "msg stop" 110 130)
(box :b4 "player 100" 40 180)
(box :b5 "synth~" 40 240)
(box :b6 "dac~" 40 290)
(box :b7 "get % :beat" 260 240)
(box :b8 "print" 260 290)
(connect :b2 0 :b4 0)
(connect :b3 0 :b4 0)
(connect :b1 0 :b4 1)
(connect :b4 0 :b5 0)
(connect :b4 1 :b5 1)
(connect :b5 0 :b6 0)
(connect :b5 0 :b6 1)
(connect :b4 2 :b7 0)
(connect :b7 0 :b8 0)
```

**Step by step** — A bang plays the next event now: the pattern follows whatever moves it — a metro, an onset~ of what someone plays, a key.

*Try:* Stop the clock and click 1: one note every 300 ms, whatever its :dur. Connect an onset~ from an adc~ instead: one note each time you play.

```clojure
(box :b9 "metro 300" 180 130)
(box :b10 "msg 1" 180 90)
(box :b11 "msg 0" 230 90)
(connect :b10 0 :b9 0)
(connect :b11 0 :b9 0)
(connect :b9 0 :b4 0)
```

**At a position** — A number is a position in beats, as a reader reads a buffer: every event is a span that sounds while the position is inside it. Forwards it starts at its onset; backwards at its end. The wrap of a ramp (a step far larger than the ones before) is a seek: there at once.

*Try:* Stop the clock and click bang: six beats in three seconds, again and again. Change the ramp to ramp 6 0 3 loop: the phrase backwards, each note from its end. Drag a number box into it instead: you are the clock, either way.

```clojure
(box :b12 "ramp 0 6 3 loop" 330 130)
(box :b13 "msg bang" 330 90)
(connect :b13 0 :b12 0)
(connect :b12 0 :b4 0)
```

See also: `pbind`, `pattern`, `metro`, `ramp`, `reader`, `synth~`

### presets

`presets [label or number …]`

Presets from the keyframes of the history (◆ snapshots, takes kept): a number or a label recalls one, a position on the right morphs between two, a bang makes a new one from what changes and what remains.

**Inlets** 

0. a keyframe to recall: its number (1 = the first) or its label · bang: a new preset · [:generate seed] · [:morph a b t] · keep
1. a position between keyframes: 1.5 morphs halfway from the first to the second

**Outlets** 

0. the values of the controls it set: {:b3 0.5 :b5 880}

**Messages and gestures**

- `2 · intro`: recalls that keyframe: every box takes its text of then, as one event of the history
- `1.5 (right)`: moves the controls (knobs, envelopes…) between two keyframes, as messages, as a drag does
- `keep`: writes the last morph into the texts of the controls, as one event
- `bang · [:generate 42]`: a new preset: what is the same in every keyframe stays, what changes takes a value within its range
- `(keyframes) · (recall 2) · (morph 1 2 0.5) · (morph :keep) · (generate 42)`: the same from the REPL, with every keyframe of the work
- `(store-presets! :bN) · (presets! :bN […])`: keeps its keyframes in the box (only what changes): then it uses them, and they travel with the patch in its code, links and embeds

**Try:** Press ◆ Snapshot, turn the lower knob and press ◆ again: two keyframes. Start the engine: 1 and 2 recall them, the knob on the right morphs between them, and the bang makes a new preset in between.

```clojure
(box :b1 "msg 1" 40 30)
(box :b2 "msg 2" 100 30)
(box :b3 "bang" 160 30)
(box :b4 "knob 1 2 1" 230 20)
(box :b5 "presets" 40 120)
(box :b6 "knob 100 1000 220 log" 40 180)
(box :b7 "osc~ 220" 40 280)
(box :b8 "gain~ 0.2" 40 330)
(box :b9 "dac~" 40 380)
(connect :b1 0 :b5 0)
(connect :b2 0 :b5 0)
(connect :b3 0 :b5 0)
(connect :b4 0 :b5 1)
(connect :b6 0 :b7 0)
(connect :b7 0 :b8 0)
(connect :b8 0 :b9 0)
(connect :b8 0 :b9 1)
```

See also: `knob`, `patch`

### print

Writes to the REPL whatever it receives.

**Inlets** 

0. anything: it is written in the REPL

See also: `msg`

### ramp

`ramp a b s [loop]`

Linear motion: a bang (or [a b s]) goes from a to b in s seconds; a number jumps there.

**Inlets** 

0. bang: goes from a to b in s seconds · [a b s]: that motion · a number: jumps there · stop
1. 1 / 0: loop on or off

**Outlets** 

0. the moving value

**Try:** Press ▶: a glissando of two octaves in four seconds, again and again.

```clojure
(box :b1 "loadbang" 40 30)
(box :b2 "ramp 220 880 4 loop" 40 90)
(box :b3 "osc~ 220" 40 150)
(box :b4 "gain~ 0.3" 40 200)
(box :b5 "dac~" 40 250)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b3 0 :b4 0)
(connect :b4 0 :b5 0)
(connect :b4 0 :b5 1)
```

See also: `metro`, `reader`, `phasor~`

### reader

`reader [x|y|path [stroke]]`

Reads the buffer (canvas, freqt) connected to its right inlet at the position that comes in on the left — along X, or along Y with `reader y`: ids on the right and the values on the left (every crossing). With `reader path [stroke]` a position from 0 to 1 travels along a stroke in the order it was drawn and gives [x y].

**Inlets** 

0. a position (along X, or Y with reader y; 0…1 with reader path)
1. the buffer of a canvas or freqt

**Outlets** 

0. the values where the position crosses something (a list)
1. their ids (sent first), for voices

See also: `canvas`, `reader~`

### reader~

`reader~ [x|y|path [stroke]] [voices] [gate]`

Reads a canvas at audio rate: a position signal from 0 to 1 on the left (a phasor~), the buffer on the right. One signal outlet per voice (along X, or Y with `reader~ y`), or x and y with `reader~ path`; where nothing passes a voice keeps its last value. With `gate`, one more outlet per voice: 1 where it has something, 0 where not (into an adsr~, or a gain~).

**Inlets** 

0. the position signal (0…1), usually a phasor~
1. the buffer of a canvas or freqt, or the sound of a sample (then it plays it, 0 its start and 1 its end)

**Outlets** 1: one signal per voice (the values it crosses) · with gate: one more per voice, 1 where it sounds and 0 where not

**Try:** Press ▶: the drawing plays every four seconds, and is silent where nothing is drawn (the gate).

```clojure
(box :b1 "freqt" 40 60)
(box :b2 "phasor~ 0.25" 40 15)
(box :b3 "reader~ 1 gate" 40 290)
(box :b4 "osc~" 40 340)
(box :b5 "gain~" 40 390)
(box :b6 "dac~" 40 440)
(connect :b2 0 :b3 0)
(connect :b1 1 :b3 1)
(connect :b3 0 :b4 0)
(connect :b3 1 :b5 1)
(connect :b4 0 :b5 0)
(connect :b5 0 :b6 0)
(connect :b5 0 :b6 1)
(stroke :b1 [[0 220] [1 330] [1.5 293.66]])
(stroke :b1 [[2.5 440] [4 220]])
```

See also: `phasor~`, `adsr~`, `freqt`, `reader`, `sample`

### record

`record [lo hi] [log] [tolerance]`

Writes any stream of numbers into a canvas (or a freqt) as strokes over time: an envelope (snapshot~ 50 rms), a descriptor (features~), a knob, a position. rec starts a take from 0 (its first write clears the buffer); rec t (msg rec 4) records from t seconds on, keeping what is before t and replacing what is after (punch-in); ovr t (msg ovr 4) overwrites only what the take covers, from t to where it stops, keeping what comes after (punch-in/out); stop ends it; a bang on the right ends a stroke, and the next number begins another. A value holds until the next one (snapshot~ sends only what changed), simplified within tolerance (1% of the range without it). Time in seconds from rec. With lo hi the Y axis of a canvas is set to them (log with log); without them it follows the values. It writes at most every 2 seconds, each write one event of the history; then reader~ reads it back as an automation.

**Inlets** 

0. numbers (a knob, snapshot~, features~…); rec starts a take from 0, stop ends it
1. a bang: the stroke being drawn ends, the next number begins another

**Outlets** 

0. edits for a canvas or freqt (its inlet): [:batch …], at most every 2 seconds

**Messages and gestures**

- `rec`: starts from 0; its first write clears the buffer
- `rec t (msg rec 4)`: from t seconds: what is before t stays, what is after is replaced
- `ovr t (msg ovr 4)`: from t seconds, over only what the take covers: what comes after it stays
- `stop`: writes what is left and stops

**Try:** Press ▶, click rec, move the knob for a few seconds, click stop: the canvas holds the gesture. A phasor~ into a reader~ with the canvas on its right plays it back as an automation.

```clojure
(box :b1 "knob 0 1 0.5" 40 30)
(box :b2 "msg rec" 140 30)
(box :b3 "msg stop" 200 30)
(box :b4 "record 0 1" 40 120)
(box :b5 "canvas" 40 170)
(connect :b1 0 :b4 0)
(connect :b2 0 :b4 0)
(connect :b3 0 :b4 0)
(connect :b4 0 :b5 0)
```

See also: `canvas`, `snapshot~`, `reader~`, `transcribe`

### sample

`sample [seconds]`

A buffer of sound. What reaches its left inlet is recorded on `rec` until `stop` (or until it has seconds, 60 by default), replacing what it had; rec t (msg rec 2.5) keeps its first t seconds and records from there (punch-in); ovr t (msg ovr 2.5) replaces only what the take covers and keeps what comes after (punch-in/out); `clear` empties it. Its right outlet is the buffer for a reader~, which plays it at the position of a phasor~ (0 the start, 1 the end); a bang sends its length in seconds on the left, and so does every new recording. The sound stays in this browser; the work keeps its picture. A URL (a string on the left, or (load-sound! :bN "https://…")) loads a sound that every browser opening the work fetches by itself. (load-sound! :bN) brings in a file, (save-sound :bN) saves it as WAV.

**Inlets** 

0. the signal to record; rec starts, stop ends (or its length in seconds), clear empties it, a bang asks its length

**Outlets** 

0. its length in seconds (after each recording, and on a bang)
1. the sound, for a reader~ (on its right inlet)

**Messages and gestures**

- `rec`: records what reaches it, from the beginning
- `rec t (msg rec 2.5)`: keeps its first t seconds and records from there
- `ovr t (msg ovr 2.5)`: replaces only what the take covers, keeping what comes after (ovr: from 0)
- `stop`: keeps what was heard
- `clear`: empties it
- `a URL (msg https://… · msg url github:… · a string)`: loads the sound there; every browser that opens the work fetches it
- `(load-sound! :bN)`: brings in a sound file
- `(load-sound! :bN "https://…")`: loads it from a URL
- `(sample! :bN {:url "…"})`: a sample that is only a URL, as a link or a shared session writes it
- `github:owner/repo@ref/path.wav`: a file of a public GitHub repository (through jsDelivr: no CORS problem)
- `freesound:12345`: a sound of Freesound, with your API key: (freesound-key! "…"); (sounds "kick") searches; (credits) lists who made them
- `(save-sound :bN)`: saves it as WAV

**Try:** Press ▶, click rec, sing a phrase, click stop: its length becomes the speed of the phasor~ (!/ 1: one over the seconds), and the reader~ plays it in a loop. Use headphones. Change the phasor~ to play it faster, slower or backwards.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "msg rec" 140 30)
(box :b3 "msg stop" 200 30)
(box :b4 "sample 10" 40 90)
(box :b5 "!/ 1" 40 190)
(box :b6 "phasor~" 40 240)
(box :b7 "reader~" 40 290)
(box :b8 "gain~ 0.5" 40 340)
(box :b9 "dac~" 40 390)
(connect :b1 0 :b4 0)
(connect :b2 0 :b4 0)
(connect :b3 0 :b4 0)
(connect :b4 0 :b5 0)
(connect :b5 0 :b6 0)
(connect :b6 0 :b7 0)
(connect :b4 1 :b7 1)
(connect :b7 0 :b8 0)
(connect :b8 0 :b9 0)
(connect :b8 0 :b9 1)
```

See also: `reader~`, `adc~`, `phasor~`

### scope~

`scope~ [ms] [zoom]`

An oscilloscope in the patch: the last ms (20 by default) of the signal on its left, drawn from a rising zero crossing so a periodic wave stands still. zoom makes it taller. Drag up or down over it to zoom (⇧ finer) and sideways to change the time; on release both stay in the box text. A number on the left changes ms.

**Inlets** 

0. the signal; a number changes the time shown (ms)

**Messages and gestures**

- `drag up/down`: zoom (⇧ finer)
- `drag sideways`: the time shown

**Try:** Press ▶: a sine wave stands still. Drag over it to zoom; connect an adc~ instead of the osc~.

```clojure
(box :b1 "osc~ 220" 40 30)
(box :b2 "scope~ 20" 40 80)
(connect :b1 0 :b2 0)
```

See also: `adc~`, `snapshot~`

### script

`script [inlets] [outlets]`

ClojureScript code box: its source is a function (fn [m] …) that receives and returns messages like any component.

**Inlets** 

0. what its function receives, by inlet (as many as the first number)

**Outlets** 

0. what its function returns in :out (as many as the second number)

**Messages and gestures**

- `source`: (fn [m] {:out [[0 (* 2 (:value m))]]})

See also: `component`

### sig~

`sig~ [value]`

A constant signal (a frequency for osc~, a factor for gain~, a position for reader~). A number on the left changes it.

**Inlets** 

0. a number: the new constant value

**Outlets** 

0. a constant signal

See also: `phasor~`, `osc~`

### snapshot~

`snapshot~ [ms] [rms|peak|db]`

A signal as numbers: every ms (50 by default) its last value, or with a word its level over that time — rms, peak, or db (the rms in decibels). It sends only what changed, so a constant signal sends once. A number on the left changes ms; a bang sends the last value again. With adc~ it is a level meter; with phasor~, an envelope or faust~ it brings a signal back into the messages.

**Inlets** 

0. the signal; a number changes ms, a bang sends the last value again

**Outlets** 

0. its value (or its level with rms, peak or db) every ms, only when it changed

**Messages and gestures**

- `rms · peak · db`: written in the box: its level over each ms instead of its value

**Try:** Press ▶: the ramp of the phasor~ arrives as numbers ten times a second. Write snapshot~ 100 peak and connect an adc~ instead.

```clojure
(box :b1 "phasor~ 0.5" 40 30)
(box :b2 "snapshot~ 100" 40 80)
(box :b3 "print" 40 130)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
```

See also: `adc~`, `scope~`, `phasor~`

### space~ · `@kairotic/spatial`

`space~ [x y]`

A sound placed around the listener (binaural, HRTF): drag the dot, or send [x y] (−1…1; y = 1 is in front). Two outlets: left and right, for headphones. Dragging rewrites the box.

**Inlets** 

0. the signal; [x y] moves it (−1…1, y = 1 in front)

**Outlets** 

0. left
1. right

See also: `pan~`, `reader`

### spectrum~ · `@kairotic/analysis`

`spectrum~ [lo hi]`

The spectrum of a signal drawn in the patch, on a log scale of frequency (dB from -90 to 0).

**Inlets** 

0. the signal

**Try:** Press ▶: one peak at 220 Hz. Connect an adc~ instead and sing a vowel: its partials and formants.

```clojure
(box :b1 "osc~ 220" 40 30)
(box :b2 "spectrum~" 40 90)
(connect :b1 0 :b2 0)
```

See also: `scope~`, `features~`

### synth~ · `@kairotic/synth`

`synth~`

Polyphonic triangle-wave synthesizer: frequencies on the left (a number or a list), voice ids on the right (from a reader). [:gain v] (0…1, 0.5 by default) sets the level of the notes that start after it, as a player sends an event's :amp. :stop silences it.

**Inlets** 

0. frequencies (a number or a list) · stop
1. voice ids (from a reader)

**Outlets** 

0. the sound

See also: `reader`, `adsr~`

### tonnetz · `@kairotic/theory`

`tonnetz [notes]`

Triads on the Tonnetz (fifths across, thirds up) and the path of the harmony: each triad found joined to the ones before.

**Inlets** 

0. a list of pitches (MIDI or 0…11), a list of 12 weights (a chroma, above 0.5), or a number: a note (the last n count: 3); clear forgets the path

**Outlets** 

0. the triad, when it changes (:C, :am, :Ebm…)
1. the pitch class pressed

**Try:** Click the four messages in order: C, c, A♭, g♯ — P, L, P: each step crosses one edge of the lattice. Press a node to hear which class it is (its number comes out on the right).

```clojure
(box :b1 "msg 60 64 67" 40 30)
(box :b2 "msg 60 63 67" 130 30)
(box :b3 "msg 60 63 68" 220 30)
(box :b4 "msg 59 63 68" 310 30)
(box :b5 "tonnetz" 40 80)
(box :b6 "print" 40 340)
(connect :b1 0 :b5 0)
(connect :b2 0 :b5 0)
(connect :b3 0 :b5 0)
(connect :b4 0 :b5 0)
(connect :b5 0 :b6 0)
```

See also: `pcclock`, `fourier`, `mt`

### transcribe · `@kairotic/analysis`

`transcribe [bpm] [notes|glide] [ms]`

Writes what pitch~ hears into a freqt, as strokes: notes where the contour settles on another pitch (slides, vibrato and ornaments do not start notes), or contours (glide).

**Inlets** 

0. Hz from pitch~ (0: silence); rec starts from 0, stop ends
1. a bang (from onset~): a new note, even on the same pitch

**Outlets** 

0. edits for a freqt: [:batch [[:stroke …] …]], at most every 2 seconds (one event of the history each)

**Messages and gestures**

- `rec`: starts a take from 0 (its first write clears the freqt)
- `rec t (msg rec 8)`: from beat t: what is before t stays, what is after is replaced
- `ovr t (msg ovr 8)`: from beat t, over only what the take covers: what comes after it stays
- `stop`: writes what is left and stops

**Try:** Press ▶, click rec, sing a phrase, click stop: the freqt holds it. ⇄ shows it as a score. Write transcribe 60 glide to keep the slides.

```clojure
(box :b1 "adc~ 1" 40 30)
(box :b2 "pitch~ 80 1000" 40 90)
(box :b3 "onset~" 200 90)
(box :b4 "msg rec" 330 90)
(box :b5 "msg stop" 400 90)
(box :b6 "transcribe 60" 40 160)
(box :b7 "freqt" 40 220)
(connect :b1 0 :b2 0)
(connect :b1 0 :b3 0)
(connect :b2 0 :b6 0)
(connect :b3 0 :b6 1)
(connect :b4 0 :b6 0)
(connect :b5 0 :b6 0)
(connect :b6 0 :b7 0)
```

See also: `pitch~`, `onset~`, `freqt`

### tree

`tree`

A musical tree written in EDN (hiccup style: [:voice [:measure {:meter [4 4]} "c4/1 e4 g4/2"]]), seen as a score or as a roll of frequency over time (⇄ in its header), its text in the code window ({ } in its header) — one tree, two views (discussion #92): drawing on its roll writes notes into the tree (free time without measures, quantized bars with them). It sends its tree, expanded, whenever it changes (and again on a bang); `tree manual` only on a bang. Its second outlet is its notes as a buffer, for a reader~. On its inlet it takes edits [:edit [[:attrs path {…}] …]] (from a score's edits outlet) and whole trees, which change it.

**Inlets** 

0. a bang: sends the tree again · [:edit …] (from the edits outlet of a freqt shown as a score): changes it · a tree: replaces it

**Outlets** 

0. the tree, expanded (melody strings become notes, [:use …] the fragments it names), whenever it changes
1. its notes as a buffer (strokes of frequency over time), for the right inlet of a reader~

**Messages and gestures**

- `{ } in the header (or a double-click on its right) · (source :bN)`: its text, in the code window (Ctrl+Enter applies): only the nodes that changed go into the history
- `(tree! :bN [:voice …])`: writes a tree into it, as edits of the nodes that change
- `(tree-edit! :bN [:attrs [0 1 2] {…}])`: edits nodes by their path: [:set p x] [:attrs p {…}] [:insert p x] [:remove p]
- `(node-at :bN [0 1])`: the node at a path
- `score: how it is shown at first · (view :bN :score)`: the tree drawn as a score, in this box (⇄ roll shows its roll)
- `in a score: click a note`: ↑ ↓ pitch (⇧ octave) · a…g the nearest note of that name · # another name (c#4 → db4) · + − duration · ← → next · Delete → rest
- `{:key "eb"} on the tree, a voice or a measure`: the score's key: its signature, accidentals that last the bar; :none writes every accidental
- `in a score: click a rest`: Enter → a note (the pitch of the one before) · ↑ ↓ a step above or below it · a…g that note
- `(as-tree :bN)`: reads it back as data
- `⇄ roll · (view :bN :roll)`: a piano roll: its notes as strokes of frequency over time: drawing, dragging, stretching or erasing there edits the tree (free time; with measures, the bars it touches are quantized again; ⌥ to a free voice)
- `(quantize! :bN) · (unquantize! :bN)`: its free time written in measures, and back (one event each)
- `(track! :bN)`: its free time played (in seconds, at any tempo): the beats are found and kept in its :quant, so that its score and quantize! write it on them

**Try:** The tree box is its own score, and the freqt shows the same tree. Press { } in the header of the tree box, change a note in its text and apply it (Ctrl+Enter): both scores follow. Click a note of the freqt's score and press ↑: the change comes back to the tree by the dashed line. Press ⇄ roll on the tree box to draw notes into it.

```clojure
(box :b1 "bang" 40 20)
(box :b2 "tree" 40 60)
(code :b2 "[:voice\n [:measure {:meter [3 4]} \"e5/1\" [:tuplet {:ratio [3 2]} \"d5/.5 c5 b4\"] [:note {:pitch \"a4\" :dur 1 :dyn \"p\"}]]\n [:measure \"g4/3\"]]")
(box :b3 "freqt" 40 190)
(view :b3 :score)
(connect :b1 0 :b2 0)
(connect :b2 0 :b3 0)
(connect :b3 2 :b2 0)
```

See also: `mt`, `freqt`

