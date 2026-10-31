# Kairotic · brand

*[Leer en castellano](README.es.md)*

<img src="kairotic-logo.svg" alt="Kairotic logotype" height="64">

**The icon (k)**: a pair of parentheses around a K whose stem is a timeline that branches at a point, the kairos.
**The logotype**: `(kairotic` + a branch + `)` in IBM Plex Mono, its first k drawn as that same K. The parentheses are
the Lisp of the code; the branch, the timelines that diverge.

## Files

| File | Use |
| --- | --- |
| `kairotic-logo.svg` | logotype on light grounds |
| `kairotic-logo-dark.svg` | logotype on dark grounds |
| `kairotic-logo-adaptive.svg` | logotype that follows the system's light or dark scheme |
| `kairotic-logo-closed.svg` | `(kairotic)`, without the closing branch |
| `kairotic-wordmark.svg` | `kairotic` without parentheses, for headings next to the icon |
| `kairotic-icon.svg` | icon (k), 48 px and up, light or dark by the system's scheme |
| `kairotic-icon-light.svg`, `kairotic-icon-dark.svg` | icon (k) fixed for light or dark grounds |
| `kairotic-icon-small.svg` | icon (k) simplified for 32 and 16 px (no nodes on the arms): the favicon |
| `kairotic-app-icon.svg` | icon on a rounded ink tile |

The letters are outlined (IBM Plex Mono Medium), so the files need no font; `generate.py` makes them again. The app draws the logotype inline in its
header with the theme's `--ink` and `--kairos`.

## Use

- Clear space around the icon: 12 % of its size, about the width of a parenthesis.
- The kairos point is the only colour: #b4472e on light grounds, #e58a6f on ink. In one colour, the point takes the ink.
- Below 48 px use the small icon.
- Do not redraw the letters in another font, stretch the logo or recolour its parts.

## Colours

| Name | Hex | Use |
| --- | --- | --- |
| Ink | `#1b2430` | text, strokes, dark grounds |
| Paper | `#f8f9fb` | light grounds |
| Rule | `#c3ccd6` | lines and borders |
| Kairos | `#b4472e` | the point; light grounds |
| Kairos light | `#e58a6f` | the point on ink |
| Grid | `#2f55d4` | links, construction grid |

## Type

IBM Plex Mono 500 for the logotype and code · IBM Plex Sans Condensed 600 for titles · IBM Plex Sans 400 for text.
