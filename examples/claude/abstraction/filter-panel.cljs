;; about: an abstraction (bpatcher): a Faust resonant filter with two knobs; its instances show the knobs as a panel
{:class "filter-panel"
 :license "MPL-2.0"
 :doc "A resonant low-pass filter with its two knobs: a signal in on the left, the filtered signal out. An instance shows the cutoff and q knobs as its panel."
 :usage "filter-panel"
 ;; a patch inside: inlet~ → faust~ → outlet~, and two knobs that send [:cutoff v] and [:q v] to the faust~.
 ;; :present [x y] puts a box on the panel of every instance (only boxes with their own view act there).
 :patch {:boxes {:b1 {:text "inlet~" :x 20 :y 20}
                 :b2 {:text "knob 40 12000 1200 log cutoff" :x 120 :y 20 :present [0 0]}
                 :b3 {:text "knob 0.5 20 2 q" :x 220 :y 20 :present [84 0]}
                 :b4 {:text "faust~" :x 20 :y 140
                      :data {:source "import(\"stdfaust.lib\");\ncutoff = hslider(\"cutoff\", 1200, 40, 12000, 1) : si.smoo;\nq = hslider(\"q\", 2, 0.5, 20, 0.01) : si.smoo;\nprocess = fi.resonlp(cutoff, q, 1);"}}
                 :b5 {:text "outlet~" :x 20 :y 330}}
         :lines [[:b1 0 :b4 0] [:b2 0 :b4 0] [:b3 0 :b4 0] [:b4 0 :b5 0]]}}
