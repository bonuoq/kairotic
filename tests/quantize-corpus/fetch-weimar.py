#!/usr/bin/env python3
# SPDX-License-Identifier: MPL-2.0
# Kairotic · the Weimar Jazz Database for the benchmark (issues #105, #106, #120)
#
#   python3 tests/quantize-corpus/fetch-weimar.py                 (downloads wjazzd.db, ~ 50 MB, once)
#   python3 tests/quantize-corpus/fetch-weimar.py --db wjazzd.db  (a copy already downloaded)
#
# The Weimar Jazz Database (Jazzomat Research Project, HfM Weimar; v2.1, 456 solos, ODbL 1.0):
# https://jazzomat.hfm-weimar.de/download/download.html. Each solo is transcribed by hand from the
# recording: every note with its onset and duration in seconds as played, its pitch and loudness, and its
# place in the bar (bar, beat, tatum, division); the beats of the recording with the time signature, the
# chord, the form part and the chorus; and phrases. Played time and written time of the same notes: what
# the quantizer and the beat tracker are measured against.
#
# Only the standard library. Writes tests/quantize-corpus/.cache/weimar.json.gz (a few MB):
#   [{"id", "performer", "title", "instrument", "style", "feel", "tempo", "key", "signature",
#     "notes":  [[onset, dur, pitch, loud_med, bar, beat, tatum, division, period], ...],
#     "beats":  [[onset, bar, beat, signature, chord, form, chorus], ...],
#     "phrases": [[first note, last note], ...]}, ...]
import argparse, gzip, json, os, sqlite3, sys, urllib.request

URL = "https://jazzomat.hfm-weimar.de/download/downloads/wjazzd.db"
here = os.path.dirname(os.path.abspath(__file__))
cache = os.path.join(here, ".cache")

ap = argparse.ArgumentParser(description="Weimar Jazz Database → .cache/weimar.json.gz")
ap.add_argument("--db", help="a wjazzd.db already downloaded (else it is downloaded into .cache/)")
ap.add_argument("--out", default=os.path.join(cache, "weimar.json.gz"))
a = ap.parse_args()

os.makedirs(cache, exist_ok=True)
db = a.db or os.path.join(cache, "wjazzd.db")
if not os.path.exists(db):
    print("downloading", URL)
    def hook(n, size, total):
        if total > 0 and n % 200 == 0:
            sys.stdout.write("\r  %.0f %%" % min(100, 100 * n * size / total)); sys.stdout.flush()
    urllib.request.urlretrieve(URL, db + ".part", hook)
    os.replace(db + ".part", db)
    print()

con = sqlite3.connect(db)
r6 = lambda x: None if x is None else round(x, 6)
r3 = lambda x: None if x is None else round(x, 3)
solos = []
for (melid, performer, title, instrument, style, feel, tempo, key, signature) in con.execute(
        "SELECT melid, performer, title, instrument, style, rhythmfeel, avgtempo, key, signature FROM solo_info ORDER BY melid"):
    notes = [[r6(o), r6(d), r3(p), r3(l), bar, beat, tatum, div, per] for (o, d, p, l, bar, beat, tatum, div, per) in con.execute(
        "SELECT onset, duration, pitch, loud_med, bar, beat, tatum, division, period FROM melody WHERE melid = ? ORDER BY onset, eventid", (melid,))]
    beats = [[r6(o), bar, beat, sig, chord, form, chorus] for (o, bar, beat, sig, chord, form, chorus) in con.execute(
        "SELECT onset, bar, beat, signature, chord, form, chorus_id FROM beats WHERE melid = ? ORDER BY onset, beatid", (melid,))]
    phrases = [[s, e] for (s, e) in con.execute(
        "SELECT start, end FROM sections WHERE melid = ? AND type = 'PHRASE' ORDER BY start", (melid,))]
    solos.append({"id": melid, "performer": performer, "title": title, "instrument": instrument, "style": style,
                  "feel": feel, "tempo": r3(tempo), "key": key, "signature": signature,
                  "notes": notes, "beats": beats, "phrases": phrases})

with gzip.open(a.out, "wt", encoding="utf-8") as f:
    json.dump(solos, f, separators=(",", ":"))
print("%d solos, %d notes, %d beats → %s (%.1f MB)" % (len(solos), sum(len(s["notes"]) for s in solos),
      sum(len(s["beats"]) for s in solos), a.out, os.path.getsize(a.out) / 1e6))
