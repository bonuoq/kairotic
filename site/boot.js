// Kairotic Pages · boot
// Runs after gun.js, sea.js and the adapter, and before the ClojureScript: it chooses the relays and
// installs the GUN backend as window.kairoticBackend, which the page uses wherever claude.ai is not
// there (db, room, user and sample with the visitor's own Anthropic key).
(function () {
  var KEY = "kairotic.peers";
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} }
  function stored(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }

  var q = new URLSearchParams(location.search).get("peer");
  if (q !== null) store(KEY, q === "none" || q === "" ? null : q);
  var chosen = (stored(KEY) || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  // ?peer=off: no relay at all, remembered like any other choice (as the tests run)
  var peers = chosen.join(",") === "off" ? [] : chosen.length ? chosen : (window.KAIROTIC_PEERS || []);

  // an embed (?embed, ?present) works on its own: no relay, nothing saved (Study 22)
  var params = new URLSearchParams(location.search);
  new URLSearchParams(location.hash.slice(1)).forEach(function (v, k) { params.set(k, v); });   // #embed, #present (issue #55)
  if (params.has("embed") || params.has("present")) {
    window.kairoticPeers = [];
    window.kairoticBackend = { kind: "embed", sample: window.KairoticGun.sample({}) };   // Claude only, with the viewer's key
    return;
  }

  window.kairoticPeers = peers;
  window.kairoticBackend = window.KairoticGun.create({ peers: peers });
})();
