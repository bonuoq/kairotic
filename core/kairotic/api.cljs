;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · api
;; What a component that does not live in the core may use. Packages (@kairotic/synth, …) and
;; components written in a work use these functions instead of the core's own modules, so the core
;; can change inside without breaking them. Inside a component source this namespace is `api`.
;;
;; The API has a version: a package declares the one it was written for ({:api 1}). A change that
;; breaks a function here raises the major version; adding functions does not.

(ns kairotic.api
  (:require [clojure.string :as str]
            [clojure.edn :as edn]
            [kairotic.components :as comp]
            [kairotic.canvas :as cv]))

(def version 1)

;; ───────── numbers ─────────

(defn clamp "x between a and b (in either order)." [x a b] (comp/clamp x a b))
(defn nice "A value rounded to a sensible precision for display and sending." [v] (comp/nice v))
(defn num-of "A number from a message: the number itself, or the first of a list (else nil)." [v] (comp/num-of v))
(defn to-unit "v between lo and hi as 0…1 (logarithmic with log?)." [v lo hi log?] (comp/to-unit v lo hi log?))
(defn from-unit "0…1 back to lo…hi (logarithmic with log?)." [u lo hi log?] (comp/from-unit u lo hi log?))

(defn padded
  "The numbers written in a box text, the missing ones taken from defaults: (padded [20] [10 100]) → [20 100]."
  [args defaults]
  (let [ns (filterv number? args)] (vec (take (count defaults) (concat ns (drop (count ns) defaults))))))

;; ───────── audio ─────────

(defn stereo-outlets
  "Two outlets (left, right) from a stereo AudioNode: [[splitter 0] [splitter 1]]."
  [ac node]
  (let [sp (.createChannelSplitter ac 2)] (.connect node sp) [[sp 0] [sp 1]]))

(defonce worklet-modules (atom {}))   ; [AudioContext name] → Promise

(defn worklet-ready
  "Promise that resolves when the AudioWorklet code `source` is loaded in `ac` under `name` (once per
   context, whoever asks first). `source` is JavaScript that calls registerProcessor(name, …)."
  [ac name source]
  (let [k [ac name]]
    (or (get @worklet-modules k)
        (let [url (js/URL.createObjectURL (js/Blob. #js [source] #js {:type "application/javascript"}))
              p (.addModule (.-audioWorklet ac) url)]
          (swap! worklet-modules assoc k p)
          p))))

(defn worklet-node
  "Promise of an AudioWorkletNode of processor `name` (defined in `source`) with these options."
  [ac name source opts]
  (.then (worklet-ready ac name source)
         (fn [_] (js/AudioWorkletNode. ac name (clj->js opts)))))

(defn param "The AudioParam `k` of an AudioWorkletNode." [w k] (.get (.-parameters w) k))

;; ───────── from the sound back to the messages ─────────
;; An audio node cannot send messages itself: it reports what it finds to its own box, whose :receive
;; gets it on inlet :audio and decides what to send (:out), show (:show) or keep (:state).

(defn report!
  "From an audio node: gives box `id` (the :id of the box its :create got) a value found in the sound.
   It arrives at the box's :receive as {:inlet :audio :value value :at at}, at instant `at` (an
   AudioContext time; now if nil). Only while the engine runs."
  [id value at]
  (when-let [f @comp/audio-report] (f id value at)))

(defn effect!
  "From an audio node: an effect of box `id` for the page, such as [:sample [:set d]] (keep a recording
   as the data of the box). Unlike report!, it also works when the engine has just stopped."
  [id e]
  (when-let [f @comp/audio-effect] (f id e)))

(def tap-source
  "class KairoticTap extends AudioWorkletProcessor {
  // Listens to its input and hands it to the page every `hop` samples, in one of three forms:
  //  frames  — the last `size` samples of each channel, oldest first
  //  summary — for each channel its last sample, its level (rms) and its peak over the last `size`
  //  trace   — for each channel `columns` pairs [min, max] over `size` samples, starting at the first
  //            rising zero crossing of the older half of a ring of 2 × size (a steady picture of a
  //            periodic wave; where there is none, the newest `size` samples)
  // with the AudioContext time of the last sample. No output: the input connected to it keeps it
  // running. A message {size, hop, columns} changes them; {active: false} stops handing (true starts again,
  // from the next hop: frames with size = hop then hold only samples heard since); {flush: true} hands at
  // once the samples heard since the last hand-over (frames only), marked last.
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.C = Math.max(1, p.channels | 0 || 1);
    this.mode = p.mode || 'frames';
    this.active = p.active !== false;
    this.columns = Math.max(2, p.columns | 0 || 128);
    this.resize(p.size | 0 || 2048, p.hop | 0 || 1024);
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.columns) this.columns = Math.max(2, Math.min(2000, d.columns | 0));
      if (d.size || d.hop) this.resize(d.size | 0 || this.size, d.hop | 0 || this.hop);
      if (d.flush) {
        const data = [];
        for (let c = 0; c < this.C; c++) data.push(this.ordered(c).slice(this.R - Math.min(this.count, this.R)));
        this.port.postMessage({ data, at: currentTime, sr: sampleRate, last: true }, data.map((x) => x.buffer));
        this.count = 0;
      }
      if (d.active !== undefined) { if (d.active && !this.active) this.count = 0; this.active = !!d.active; }
    };
  }
  resize(size, hop) {
    this.size = Math.max(16, Math.min(1 << 17, size)); this.hop = Math.max(16, Math.min(1 << 17, hop));
    this.R = this.mode === 'trace' ? 2 * this.size : this.size;
    this.rings = []; for (let c = 0; c < this.C; c++) this.rings.push(new Float32Array(this.R));
    this.w = 0; this.count = 0;
  }
  ordered(c) {
    const r = this.rings[c], f = new Float32Array(this.R);
    f.set(r.subarray(this.w)); f.set(r.subarray(0, this.w), this.R - this.w);
    return f;
  }
  block() {
    const out = [];
    for (let c = 0; c < this.C; c++) {
      if (this.mode === 'summary') {
        const r = this.rings[c], N = this.R; let s = 0, pk = 0;
        for (let i = 0; i < N; i++) { const x = r[i]; s += x * x; const a = x < 0 ? -x : x; if (a > pk) pk = a; }
        out.push([r[(this.w + N - 1) % N], Math.sqrt(s / N), pk]);
      } else if (this.mode === 'trace') {
        const f = this.ordered(c), S = this.size, K = this.columns;
        let t = S;
        for (let i = 1; i < S; i++) if (f[i - 1] <= 0 && f[i] > 0) { t = i; break; }
        const col = new Float32Array(2 * K);
        for (let k = 0; k < K; k++) {
          const a = t + Math.floor(k * S / K), b = Math.max(a + 1, t + Math.floor((k + 1) * S / K));
          let lo = Infinity, hi = -Infinity;
          for (let i = a; i < b && i < f.length; i++) { const x = f[i]; if (x < lo) lo = x; if (x > hi) hi = x; }
          col[2 * k] = lo === Infinity ? 0 : lo; col[2 * k + 1] = hi === -Infinity ? 0 : hi;
        }
        out.push(col);
      } else out.push(this.ordered(c));
    }
    return out;
  }
  process(inputs) {
    const inp = inputs[0] || [];
    const n = inp[0] ? inp[0].length : 128;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < this.C; c++) { const ch = inp[c] || inp[0]; this.rings[c][this.w] = ch ? ch[i] : 0; }
      this.w = (this.w + 1) % this.R;
      if (++this.count >= this.hop) {
        this.count = 0;
        if (!this.active) continue;
        const data = this.block();
        this.port.postMessage({ data, at: currentTime + (i + 1) / sampleRate, sr: sampleRate, last: false },
                              data.filter((d) => d instanceof Float32Array).map((d) => d.buffer));
      }
    }
    return true;
  }
}
registerProcessor('kairotic-tap', KairoticTap);
")

(defn tap
  "Promise of an AudioWorkletNode that listens to a signal and gives it to the page in blocks; connect
   the signal to it. Every `hop` samples, (on-block data at sr) gets the AudioContext time of the last
   sample, the sample rate and, one entry per channel, according to :mode
     :frames  (default) a Float32Array of the last `size` samples, oldest first
     :summary [last rms peak] over the last `size` samples
     :trace   a Float32Array of `columns` pairs min, max over `size` samples, from a rising zero
              crossing (a steady oscilloscope picture)
   The loops over samples run in the worklet, so the page only handles small arrays (except :frames).
   (retap w {:size n :hop n :columns n}) changes the sizes while it runs; {:active false} stops handing
   blocks (:active true in the options starts it so) and {:flush true} hands at once, as :frames, what
   was heard since the last block. on-block also gets a fourth argument, {:last true} for that block."
  [ac {:keys [channels size hop mode columns active]} on-block]
  (.then (worklet-node ac "kairotic-tap" tap-source
                       {:numberOfInputs 1 :numberOfOutputs 0
                        :channelCount (or channels 1) :channelCountMode "explicit" :channelInterpretation "discrete"
                        :processorOptions {:channels (or channels 1) :size (or size 2048) :hop (or hop 1024)
                                           :mode (name (or mode :frames)) :columns (or columns 128)
                                           :active (not (false? active))}})
         (fn [w]
           (set! (.. w -port -onmessage)
                 (fn [e] (let [d (.-data e)]
                           (try (on-block (vec (array-seq (.-data d))) (.-at d) (.-sr d) {:last (true? (.-last d))})
                                (catch :default ex (js/console.error ex))))))
           w)))

(defn retap "A tap while it runs: new sizes {:size n :hop n :columns n}, {:active bool}, {:flush true}." [w sizes]
  (.postMessage (.-port w) (clj->js sizes)))

(defn db "A level (0…1) in decibels, -100 for silence." [x]
  (if (> x 1e-5) (* 20 (/ (js/Math.log x) js/Math.LN10)) -100))

;; ───────── pitch ─────────

(defn hz->midi "A frequency as a MIDI pitch (fractional: 440 → 69)." [hz] (cv/hz->midi hz))
(defn midi->hz "A MIDI pitch as a frequency (69 → 440)." [m] (cv/midi->hz m))
(defn midi-name "The name of a whole MIDI pitch: 60 → \"C4\", 61 → \"C#4\"." [m] (cv/midi-name m))
(defn pitch-class "The pitch class of a MIDI pitch as a keyword: 61 → :c#." [m]
  (keyword (str/lower-case (nth cv/note-names (mod (js/Math.round m) 12)))))

;; ───────── libraries ─────────

(defonce scripts (atom {}))   ; url → Promise

(defn load-script
  "Promise that resolves when the classic script at `url` has run, once per page whoever asks first.
   npm:package@version/path is served by jsDelivr (the only place a page inside claude.ai can load
   code from). For libraries that put a global on window, such as Meyda: (.-Meyda js/window)."
  [url]
  (let [u (if (str/starts-with? url "npm:") (str "https://cdn.jsdelivr.net/npm/" (subs url 4)) url)]
    (or (get @scripts u)
        (let [p (js/Promise.
                 (fn [ok fail]
                   (let [s (.createElement js/document "script")]
                     (set! (.-src s) u)
                     (set! (.-async s) true)
                     (set! (.-onload s) (fn [_] (ok true)))
                     (set! (.-onerror s) (fn [_] (swap! scripts dissoc u) (fail (js/Error. (str "could not load " u)))))
                     (.appendChild (.-head js/document) s))))]
          (swap! scripts assoc u p)
          p))))

;; ───────── the network (for :tasks) ─────────
;; A component never fetches from its :receive: it asks for a task (:tasks), and these help the task.

(defn url-of
  "A URL from a message: a string, or a word as a msg box sends it (msg https://… arrives as a keyword).
   github:owner/repo@ref/path is served by jsDelivr (@main without @ref), the one site a page inside
   claude.ai can read. nil if it is not a URL."
  [v]
  (let [s (cond (string? v) v (keyword? v) (subs (str v) 1) :else nil)
        s (some-> s str/trim (str/replace #"^\"|\"$" ""))
        gh (when s (re-matches #"github:([^/\s]+)/([^/@\s]+)(@[^/\s]+)?/(\S+)" s))]
    (cond (nil? s) nil
          (re-matches #"https?://\S+" s) s
          gh (let [[_ owner repo ref path] gh]
               (str "https://cdn.jsdelivr.net/gh/" owner "/" repo (or ref "@main") "/" path))
          :else nil)))

(defn- readable-key
  "A key of a JSON object as EDN: a keyword when it can be written and read back as one, else the string."
  [k]
  (if (and (string? k) (re-matches #"[A-Za-z*+!_?<>=][A-Za-z0-9*+!_?<>=.\-]*" k)) (keyword k) k))

(defn json->edn
  "Parsed JSON (js->clj) as EDN that can be written and read back: the keys of objects become keywords
   where they can (\"name\" → :name; \"2024\" and \"a b\" stay strings)."
  [x]
  (cond (map? x) (into {} (map (fn [[k v]] [(readable-key k) (json->edn v)])) x)
        (vector? x) (mapv json->edn x)
        :else x))

(defn http-get
  "Promise of what is at `url` (https://…, or github:owner/repo@ref/path): with {:as :json} (the default)
   parsed into EDN (json->edn), :text as a string, :edn read as EDN. It fails with a reason in words when
   the site refuses this page (CORS) or cannot be reached, answers an error, takes longer than :timeout
   seconds (20) or sends more than :max characters (1000000)."
  ([url] (http-get url {}))
  ([url {:keys [as timeout max] :or {as :json timeout 20 max 1000000}}]
   (if-let [u (url-of url)]
     (let [ctl (js/AbortController.)
           timer (js/setTimeout (fn [] (.abort ctl)) (* 1000 timeout))]
       (-> (js/fetch u #js {:signal (.-signal ctl)})
           (.then (fn [r]
                    (if (.-ok r)
                      (.text r)
                      (throw (js/Error. (str "the site answered " (.-status r) (when (= 404 (.-status r)) " (not found)")))))))
           (.then (fn [text]
                    (when (> (count text) max)
                      (throw (js/Error. (str "too long: " (count text) " characters (" max " at most)"))))
                    (case as
                      :text text
                      :edn (edn/read-string text)
                      (json->edn (js->clj (js/JSON.parse text))))))
           (.catch (fn [e]
                     (throw (cond (= "AbortError" (.-name e)) (js/Error. (str "no answer in " timeout " s"))
                                  ;; fetch itself fails (a TypeError) when the site refuses the page or cannot be reached
                                  (instance? js/TypeError e) (js/Error. "the site does not let this page read it (CORS), or cannot be reached")
                                  (instance? js/SyntaxError e) (js/Error. (str "not " (name as) ": " (.-message e)))
                                  :else e))))
           (.finally (fn [] (js/clearTimeout timer)))))
     (js/Promise.reject (js/Error. (str (pr-str url) " is not a URL (https://… or github:owner/repo/path)"))))))
