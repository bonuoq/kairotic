# Class reference

*Made from the help of Kairotic 0.1.0-alpha (the Help tab shows the same, and the help of classes a work defines). Generated: do not edit by hand — `(reference-md)` in the REPL writes it.*

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

An envelope that follows a gate, for the factor of a gain~. Drag over it to change its shape.

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

### faust~

`faust~`

Faust code box: compiled in the page and played as an AudioWorklet. Its audio ports are those of process; the left inlet also accepts parameters ([:freq 440], a list of Hz with gate).

**Inlets** 

0. audio inputs of process (if any); the left one also takes parameters: [:freq 440]

**Outlets** 

0. audio outputs of process

**Messages and gestures**

- `(code :bN "process = …;")`: writes its source
- `double-click`: edit the code; Ctrl+Enter applies

**Try:** Press ▶. Then change 1200 in the code and apply with Ctrl+Enter: the filter opens.

```clojure
(box :b1 "faust~" 40 30)
(box :b2 "dac~" 40 200)
(connect :b1 0 :b2 0)
(connect :b1 0 :b2 1)
(code :b1 "import(\"stdfaust.lib\");\nf = hslider(\"freq\", 220, 50, 2000, 1);\nprocess = os.sawtooth(f) * 0.1 : fi.lowpass(2, 1200);")
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
- `⇄ score in the header · (view :bN :score)`: the same buffer, drawn as an approximate score (⇄ canvas brings it back)
- `shown as a score, click a note of a tree`: ↑ ↓ pitch (⇧ octave) · + − duration · ← → next · Delete → rest
- `(keep! :bN)`: writes the tree it shows into its buffer, with its recipe beside it (the tree and the boxes that made it)
- `(recipe :bN) · (remake! :bN)`: the recipe of a kept buffer · the tree written back, without the changes made since
- `{ } in the header (or a double-click on its right) · (source :bN)`: the buffer as EDN text, in the code window: edit it and apply (Ctrl+Enter); what changed is one event

**Try:** A freqt shown as a score is the viewer of a tree that comes transformed (tree → mt transpose 7 → freqt). To see and edit a tree box itself as a score, use ⇄ score in its header: no wire needed. (A box written "score", from older works, is a freqt shown as a score.)

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

### msg

`msg 0 8 4`

Message: when pressed it sends its content (a value, a list or a word such as stop).

**Inlets** 

0. anything (or a click): sends its content

**Outlets** 

0. its content: a number, a list, or a word such as stop

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

Operations on musical trees: a tree on the left comes out transformed. transpose n · invert [pivot] · retrograde · augment f · rotate k · canon delay [interval] · thin amount (keeps the notes on the strongest positions of each measure: a share, 0.5, or how many, 3) · seq / par (joins the left tree with the one on the right) · events · pitches · duration · play [loop] (a bang plays the last tree: Hz and voice ids for synth~, parameters and marks).

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

0. the signal

**Outlets** 

0. a bang for each onset
1. its strength (the growth of the spectrum, 0…1)

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

See also: `pitch~`, `sample`, `counter`

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

### sample

`sample [seconds]`

A buffer of sound. What reaches its left inlet is recorded on `rec` until `stop` (or until it has seconds, 60 by default), replacing what it had; `clear` empties it. Its right outlet is the buffer for a reader~, which plays it at the position of a phasor~ (0 the start, 1 the end); a bang sends its length in seconds on the left, and so does every new recording. The sound stays in this browser; the work keeps its picture. A URL (a string on the left, or (load-sound! :bN "https://…")) loads a sound that every browser opening the work fetches by itself. (load-sound! :bN) brings in a file, (save-sound :bN) saves it as WAV.

**Inlets** 

0. the signal to record; rec starts, stop ends (or its length in seconds), clear empties it, a bang asks its length

**Outlets** 

0. its length in seconds (after each recording, and on a bang)
1. the sound, for a reader~ (on its right inlet)

**Messages and gestures**

- `rec`: records what reaches it, from the beginning
- `stop`: keeps what was heard
- `clear`: empties it
- `a URL (a string)`: loads the sound there; every browser that opens the work fetches it
- `(load-sound! :bN)`: brings in a sound file
- `(load-sound! :bN "https://…")`: loads it from a URL
- `(sample! :bN {:url "…"})`: a sample that is only a URL, as a link or a shared session writes it
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

Polyphonic triangle-wave synthesizer, one voice per id.

**Inlets** 

0. frequencies (a number or a list) · stop
1. voice ids (from a reader)

**Outlets** 

0. the sound

See also: `reader`, `adsr~`

### tree

`tree`

A musical tree written in EDN (hiccup style: [:voice [:measure {:meter [4 4]} "c4/1 e4 g4/2"]]). It sends its tree, expanded, whenever it changes (and again on a bang); `tree manual` only on a bang. On its inlet it takes edits [:edit [[:attrs path {…}] …]] (from a score's edits outlet) and whole trees, which change it.

**Inlets** 

0. a bang: sends the tree again · [:edit …] (from the edits outlet of a freqt shown as a score): changes it · a tree: replaces it

**Outlets** 

0. the tree, expanded (melody strings become notes, [:use …] the fragments it names), whenever it changes

**Messages and gestures**

- `double-click`: edit its text (Ctrl+Enter applies): only the nodes that changed go into the history
- `(tree! :bN [:voice …])`: writes a tree into it, as edits of the nodes that change
- `(tree-edit! :bN [:attrs [0 1 2] {…}])`: edits nodes by their path: [:set p x] [:attrs p {…}] [:insert p x] [:remove p]
- `(node-at :bN [0 1])`: the node at a path
- `⇄ score in the header · (view :bN :score)`: the same tree drawn as a score, in this box (⇄ code brings the code back; { } opens it)
- `in a score: click a note`: ↑ ↓ pitch (⇧ octave) · + − duration · ← → next · Delete → rest
- `(as-tree :bN)`: reads it back as data

**Try:** The score already shows the tree, measure by measure. Double-click the code, change a note and apply it (Ctrl+Enter): the score follows. Click a note of the score and press ↑: the change comes back to the tree by the dashed line. Or press ⇄ score in the header of the tree box: the same tree as a score, in one box.

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

