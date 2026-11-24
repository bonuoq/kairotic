# The preludes of Study 66

Notes as `[[onset duration midi] …]`, in 16ths, read from the **Mutopia Project**'s typesets of public-domain scores
(each placed in the public domain by its typesetter) with `../tools/ly2notes.py`, a small reader of the LilyPond they
use (notes, durations, ties, rests, `\relative`, `<<` voices `>>`, German names):

| file | piece | typeset (mutopiaproject.org) |
|---|---|---|
| `bwv846-prelude.json` | J. S. Bach, *Das Wohltemperierte Clavier I*, Prelude 1 in C, BWV 846 | `ftp/BachJS/BWV846/wtk1-prelude1` (Shay Rojansky, Han-Wen Nienhuys, Tobias Erbsland) |
| `bwv999-prelude.json` | J. S. Bach, Prelude BWV 999 — in its guitar edition in D minor | `ftp/BachJS/BWV999/Bach_Prelude_BWV999` |
| `bwv1007-prelude.json` | J. S. Bach, Cello Suite 1 in G, BWV 1007, Prelude | `ftp/BachJS/BWV1007/bwv1007` |
| `bwv1009-prelude.json` | J. S. Bach, Cello Suite 3 in C, BWV 1009, Prelude | `ftp/BachJS/BWV1009/cellosuite3` |

To read them again: `python3 tools/ly2notes.py 846 wtk1-prelude1.ly > data/bwv846-prelude.json` (and `999`, `1007`, `1009`).
