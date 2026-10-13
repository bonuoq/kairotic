// SPDX-License-Identifier: MPL-2.0
// Kairotic · a backend outside claude.ai (Study 17)
//
// Inside claude.ai a Kairotic page gets its database, rooms, user and Claude from the viewer
// (`window.claude.use("db" | "room" | "user" | "sample")`). Anywhere else — GitHub Pages, a local
// server — this file gives the page the same four things, with the same shape, so the page does not
// change:
//
//   db      collection(path) / doc(path) → set · update · delete · get · onSnapshot     (GUN)
//   room    presence(obj) · onPeers(fn) · join(name) → room · leave()                  (GUN)
//   user    id() · can(what) · profiles(ids)                                          (a local key pair)
//   sample  sample(input, {tools, onText, signal, modelTier}) · limits()              (Claude API, your own key)
//
// Data lives in GUN, a graph that syncs between browsers through relay peers. Everything under
// data/users/<you>/ (your solo works) is encrypted with a key pair that never leaves this browser;
// rooms are readable by whoever has their link, as in claude.ai. Each document is stored as JSON in
// one field (GUN has no arrays). Deleting leaves a tombstone. Claude is called with the Anthropic API
// key you paste into the page, kept only in this browser's storage and sent only to api.anthropic.com.
(function () {
  "use strict";

  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
    del(k) { try { window.localStorage.removeItem(k); } catch (_) { /* private mode */ } },
  };

  const rid = (n) => {
    const a = new Uint8Array(n || 12);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  };

  function create(opts) {
    opts = opts || {};
    const Gun = window.Gun, SEA = Gun && Gun.SEA;
    if (!Gun || !SEA) throw new Error("Kairotic: gun.js and sea.js must be loaded before gun-backend.js");
    const gun = Gun({ peers: opts.peers || [], localStorage: opts.localStorage !== false });
    const root = gun.get(opts.app || "kairotic-v1");
    const nodeAt = (path) => String(path).split("/").filter(Boolean).reduce((n, s) => n.get(s), root);

    // ───────── identity: a key pair kept in this browser ─────────
    let pairP = null;
    const pair = () => pairP || (pairP = (async () => {
      const saved = store.get("kairotic.pair");
      if (saved) { try { return JSON.parse(saved); } catch (_) { /* make a new one */ } }
      const p = await SEA.pair();
      store.set("kairotic.pair", JSON.stringify(p));
      return p;
    })());
    // ids with no "/" or "." so they can be path segments
    const uidOf = (p) => p.pub.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);

    // ───────── encoding: JSON, encrypted under data/users/ ─────────
    const privatePath = (path) => /^data\/users\//.test(String(path));
    async function encode(path, obj) {
      const json = JSON.stringify(obj);
      return privatePath(path) ? await SEA.encrypt(json, await pair()) : json;
    }
    async function decode(path, raw) {
      if (raw == null) return null;
      try {
        if (privatePath(path)) {
          const json = await SEA.decrypt(raw, await pair());
          return json == null ? null : (typeof json === "string" ? JSON.parse(json) : json);
        }
        return JSON.parse(raw);
      } catch (_) { return null; }
    }

    // a put resolves when a peer (or local storage) acknowledges it, or after a moment anyway
    const put = (node, value) => new Promise((resolve, reject) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; resolve(); } }, 1500);
      node.put(value, (ack) => {
        if (done) return;
        done = true; clearTimeout(t);
        if (ack && ack.err) reject(new Error(String(ack.err))); else resolve();
      });
    });

    function docSnap(id, path, data) {
      return decode(path, data && !data.del ? data.json : null).then((obj) => ({
        id, exists: obj != null, data: () => obj,
      }));
    }

    class DocRef {
      constructor(path) { this.path = String(path); this.id = this.path.split("/").filter(Boolean).pop(); }
      async set(obj) { await put(nodeAt(this.path), { json: await encode(this.path, obj), del: false, t: Date.now() }); }
      async update(obj) {
        const cur = await this.get();
        await this.set(Object.assign({}, cur.exists ? cur.data() : {}, obj));
      }
      async delete() { await put(nodeAt(this.path), { json: null, del: true, t: Date.now() }); }
      // one read: the first value that arrives (GUN's once is unreliable without local storage), or
      // "does not exist" after a moment
      get() {
        return new Promise((resolve) => {
          let done = false;
          const chain = nodeAt(this.path);
          const finish = (data) => {
            if (done) return;
            done = true;
            try { chain.off(); } catch (_) { /* already off */ }
            resolve(docSnap(this.id, this.path, data));
          };
          chain.on((data) => finish(data));
          setTimeout(() => finish(null), 1200);
        });
      }
      onSnapshot(cb, err) {
        const chain = nodeAt(this.path);
        let alive = true;
        chain.on((data) => {
          docSnap(this.id, this.path, data).then((s) => { if (alive) cb(s); }).catch((e) => err && err(e));
        });
        return () => { alive = false; chain.off(); };
      }
    }

    class CollRef {
      constructor(path) { this.path = String(path); }
      doc(id) { return new DocRef(this.path + "/" + (id || rid(16))); }
      // every document of the collection, read as they arrive (GUN has no "end"): settles after a quiet moment
      get() {
        return new Promise((resolve) => {
          const seen = {};
          let timer = null;
          const settle = () => {
            Promise.all(Object.keys(seen).map((k) => docSnap(k, this.path + "/" + k, seen[k])))
              .then((docs) => resolve({ docs: docs.filter((d) => d.exists) }));
          };
          const poke = () => { clearTimeout(timer); timer = setTimeout(settle, 700); };
          const chain = nodeAt(this.path).map();
          chain.on((data, key) => { seen[key] = data; poke(); });
          poke();
          setTimeout(() => { try { chain.off(); } catch (_) { /* already off */ } }, 5000);
        });
      }
      onSnapshot(cb, err) {
        const docs = {};
        let alive = true, timer = null;
        const emit = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            Promise.all(Object.keys(docs).map((k) => docSnap(k, this.path + "/" + k, docs[k])))
              .then((snaps) => { if (alive) cb({ docs: snaps }); })
              .catch((e) => err && err(e));
          }, 40);
        };
        const chain = nodeAt(this.path).map();
        chain.on((data, key) => { docs[key] = data; emit(); });
        emit();
        return () => { alive = false; chain.off(); };
      }
    }

    const db = {
      collection: (path) => new CollRef(path),
      doc: (path) => new DocRef(path),
    };

    // ───────── rooms: presence in GUN, renewed while the page is open ─────────
    const tab = rid(10);
    const LIVE_MS = 15000, BEAT_MS = 5000;

    function makeRoom(name) {
      const where = root.get("presence").get(name);
      let mine = null, beat = null, watching = null, peersTimer = null;
      const entries = {};
      const room = {
        name,
        presence(obj) {
          mine = obj || {};
          const send = async () => put(where.get(tab), { json: JSON.stringify(mine), by: uidOf(await pair()), t: Date.now() });
          clearInterval(beat);
          beat = setInterval(send, BEAT_MS);
          return send();
        },
        onPeers(cb) {
          let last = "";
          const report = () => {
            const now = Date.now();
            const peers = Object.keys(entries)
              .filter((k) => entries[k] && entries[k].t > now - LIVE_MS)
              .map((k) => {
                let p = {};
                try { p = JSON.parse(entries[k].json || "{}"); } catch (_) { /* ignore */ }
                return { peer: k, by: entries[k].by, isMe: k === tab, sameTab: k === tab, kind: "human", presence: p };
              });
            const sig = JSON.stringify(peers);
            if (sig !== last) { last = sig; cb({ peers }); }
          };
          watching = where.map();
          watching.on((data, key) => { entries[key] = data; report(); });
          peersTimer = setInterval(report, 2000);
          report();
        },
        join(sub) { return Promise.resolve(makeRoom(sub)); },
        leave() {
          clearInterval(beat); clearInterval(peersTimer);
          if (watching) watching.off();
          return put(where.get(tab), { json: "{}", t: 0 });
        },
      };
      return room;
    }

    const room = makeRoom("lobby");
    window.addEventListener("beforeunload", () => { room.leave(); });

    // ───────── user ─────────
    const user = {
      id: () => pair().then(uidOf),
      can: () => Promise.resolve(true),
      profiles: () => Promise.resolve({}),
    };

    return { kind: "gun", gun, db, room, user, sample: makeSample(opts) };
  }

  // ───────── Claude with your own API key ─────────
  // Same call as claude.ai's sample capability: sample(input, {tools, onText, signal, modelTier}).
  // The tool loop runs here: Claude asks for a tool, the page's execute runs, the result goes back.
  const KEY = "kairotic.anthropicKey";
  const MODELS = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" };

  function makeSample(opts) {
    const api = (opts && opts.api) || "https://api.anthropic.com/v1/messages";
    const fail = (code, message, text) => Object.assign({ code, message }, text ? { text } : {});

    async function sample(input, o) {
      o = o || {};
      const key = store.get(KEY);
      if (!key) throw fail("not_granted", "No Anthropic API key: paste yours in the Claude tab (it stays in this browser).");
      const tier = MODELS[o.modelTier] ? o.modelTier : "default";
      const model = store.get("kairotic.model") || MODELS[tier];
      const messages = typeof input === "string" ? [{ role: "user", content: input }]
        : input.map((m) => ({ role: m.role, content: m.content }));
      const tools = (o.tools || []).map((t) => ({
        name: t.name, description: t.description,
        input_schema: t.inputSchema || { type: "object", properties: {} },
      }));
      let text = "", truncated = false;
      for (let round = 0; round < 10; round++) {
        let res;
        try {
          res = await fetch(api, {
            method: "POST", signal: o.signal,
            headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01",
                       "anthropic-dangerous-direct-browser-access": "true" },
            body: JSON.stringify(Object.assign({ model, max_tokens: 16000, messages }, tools.length ? { tools } : {})),
          });
        } catch (e) {
          if (o.signal && o.signal.aborted) throw fail("cancelled", "stopped", text || undefined);
          throw fail("upstream_error", String(e && e.message || e), text || undefined);
        }
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          if (res.status === 401 || res.status === 403) throw fail("not_granted", "The API key was refused: " + body.slice(0, 200));
          if (res.status === 429) throw fail("rate_limited", "Too many requests or out of credit: " + body.slice(0, 200), text || undefined);
          if (res.status === 400 && /prompt is too long/i.test(body)) throw fail("prompt_too_large", body.slice(0, 200));
          throw fail("upstream_error", res.status + " " + body.slice(0, 300), text || undefined);
        }
        const msg = await res.json();
        const said = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
        if (said) {
          const delta = (text ? "\n\n" : "") + said;
          text += delta;
          if (o.onText) try { o.onText({ text, delta }); } catch (_) { /* the page's problem */ }
        }
        const calls = (msg.content || []).filter((b) => b.type === "tool_use");
        if (msg.stop_reason !== "tool_use" || !calls.length) {
          truncated = msg.stop_reason === "max_tokens";
          break;
        }
        messages.push({ role: "assistant", content: msg.content });
        const results = await Promise.all(calls.map(async (c) => {
          const tool = (o.tools || []).find((t) => t.name === c.name);
          try {
            if (!tool) throw new Error("no tool " + c.name);
            const out = await tool.execute(c.input || {}, { signal: o.signal });
            const s = typeof out === "string" ? out : JSON.stringify(out);
            return { type: "tool_result", tool_use_id: c.id, content: s.slice(0, 32768) };
          } catch (e) {
            return { type: "tool_result", tool_use_id: c.id, content: "Error: " + (e && e.message || e), is_error: true };
          }
        }));
        messages.push({ role: "user", content: results });
        if (o.signal && o.signal.aborted) throw fail("cancelled", "stopped", text || undefined);
      }
      if (!text.trim()) throw fail("empty_completion", "Claude wrote nothing");
      return { text, truncated, modelTierApplied: tier };
    }
    sample.limits = () => Promise.resolve({ maxPromptBytes: 262144, tools: { maxCount: 16 } });
    sample.byok = true;
    sample.hasKey = () => !!store.get(KEY);
    sample.setKey = (k) => { if (k) store.set(KEY, String(k).trim()); else store.del(KEY); };
    return sample;
  }

  // an embed has no database nor rooms, but Claude (with the viewer's key) can still make its patch
  window.KairoticGun = { create, sample: makeSample };
})();
