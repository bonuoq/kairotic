# Kairotic outside claude.ai (GitHub Pages)

*[Versión en español](pages.es.md)*

Kairotic is a static page: HTML, ClojureScript evaluated by Scittle, and a few modules. Inside
claude.ai the viewer gives it four things: a **database** (works and their history), **rooms**
(presence of the people in a shared work), the **user** and **Claude**. From Study 17 the page asks
for them through one small layer, so the same page also runs elsewhere with another backend:

| | inside claude.ai | Kairotic Pages (GitHub Pages) |
|---|---|---|
| database | the artifact's database | [GUN](https://gun.eco), a graph synced between browsers through relays |
| solo works | only you see them | encrypted with a key pair that never leaves your browser |
| rooms | anyone with access to the artifact | anyone with the site and the same relay |
| user | your claude.ai account | a key pair made in this browser (no account) |
| Claude | your claude.ai account (you allow it the first time) | **your own Anthropic API key**, pasted in the Claude tab |

The page chooses: if `window.claude` is there (claude.ai) it uses it; otherwise it uses
`window.kairoticBackend`, which the Pages edition installs (`core/backends/gun-backend.js`).

## Claude with your own key (BYOK)

Since early 2026 a claude.ai subscription cannot be used to sign in from third-party apps, so on
Pages Claude works with an **API key** from [console.anthropic.com](https://console.anthropic.com)
(billed per use to whoever owns the key). In the Claude tab, paste the key and press *Save*:

- it is kept **only in this browser** (localStorage `kairotic.anthropicKey`), never in the work, the
  room or the relay;
- it is sent **only to api.anthropic.com**, directly from the browser (header
  `anthropic-dangerous-direct-browser-access`), with no server in between;
- *Forget* deletes it. Each person who uses the site uses their own key: nobody spends anyone
  else's usage.

Models: quick → `claude-haiku-5-5`, balanced → `claude-sonnet-5-5`, complex → `claude-opus-5-5`.

## Relays

GUN syncs through **relays**: small Node servers that pass the graph between browsers and keep a
copy so a room is still there when people come back. GitHub Pages only serves files, so a relay
runs somewhere else ([relay/](../relay/README.md)). Without a relay each browser works alone.

The site's relays are listed in `site/config.js`. A visitor can choose others for their browser
with `?peer=wss://host/gun` (several separated by commas; `?peer=none` goes back to the site's).

What a relay sees: rooms in clear (as anyone in the room would), solo works encrypted.

## Building and publishing

```sh
node site/build.mjs            # → _site/ (the app + GUN + adapter + config + boot)
cd _site && python3 -m http.server 8000
```

`.github/workflows/pages.yml` builds and deploys it on every push to `main` that changes the page,
the adapter or the site. Once: *Settings → Pages → Source: GitHub Actions*. GitHub Pages serves
public repositories on every plan; a private one needs a paid plan.

## Known limits

- GUN has no access control by itself: anyone with the relay can write to a room. Solo works are
  safe because they are encrypted and signed by key, not because the relay protects them.
- A key pair lives in one browser: moving to another browser means a new identity (export/import
  of the pair is future work).
- `script` boxes in rooms still need `(trust-scripts true)`, as in claude.ai.
