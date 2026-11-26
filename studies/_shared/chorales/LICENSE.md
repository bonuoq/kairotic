# The chorales' phrases: their license

`phrases.json` is cut from **Craig Stuart Sapp's digital edition of the 370 J.S. Bach chorales**
(<https://github.com/craigsapp/bach-370-chorales>, <https://chorales.sapp.org>), © 2009 Craig Stuart Sapp, after the
fourth Breitkopf & Härtel edition of the *371 vierstimmige Choralgesänge* (Alfred Dörffel, Leipzig, c. 1875).

Sapp's edition is licensed under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International**
(CC BY-NC-SA 4.0, <https://creativecommons.org/licenses/by-nc-sa/4.0/>), and so is `phrases.json`, a work adapted from
it (the phrases cut at the fermatas, sampled a quarter at a time; the changes are the extractor's, `tools/kern.mjs`).
It is **not** under the MPL-2.0 that covers the rest of Kairotic: it may not be used commercially, and what is made
from it is shared under the same license.

The extractor, `tools/kern.mjs`, is Kairotic's code, under the MPL-2.0.

## `figures.json`

`figures.json` holds the figures of the **Bach Chorales Figured Bass dataset** (BCFB: Yaolong Ju, Sylvain Margot,
Cory McKay, Luke Dahn and Ichiro Fujinaga, <https://github.com/juyaolongpaul/Bach_chorale_FB>,
<https://zenodo.org/records/5084914>; *Automatic Figured Bass Annotation Using the New Bach Chorales Figured Bass
Dataset*, ISMIR 2020), Bach's figures in the continuo parts of his cantatas' chorales after the Neue Bach-Ausgabe,
licensed under **Creative Commons Attribution 4.0 International** (CC BY 4.0,
<https://creativecommons.org/licenses/by/4.0/>). The changes: each figure placed on the quarter of a phrase of
`phrases.json` it falls on (`tools/bcfb.mjs`, Kairotic's code, under the MPL-2.0).
