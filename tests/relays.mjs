// SPDX-License-Identifier: MPL-2.0
// Choosing the relay (Pages): what ?peer= says, how a relay written by hand is read, the links that carry
// it and its section in the session manager. The app is open with ?peer=off (tests/browser.mjs), so its
// relays are not the site's: the address and the room links must carry peer=off.
// In the app already loaded by tests/browser.mjs. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

export async function relays(page, check) {
  check("the page knows it works without a relay", (await cljs(page, "(relay-param)")) === '"off"', await cljs(page, "(relay-param)"));
  const search = await page.evaluate(() => location.search);
  check("... and its address says so (?peer=off)", /[?&]peer=off\b/.test(search), search);

  const norm = await cljs(page, `(mapv normalize-relay ["https://relay.example" "relay.example:9000" "ws://localhost:8765"
                                                          "wss://r.example/gun" "wss://r.example/x/gun" "two words" ""])`);
  check("a relay written by hand is read as GUN wants it", norm ===
        '["wss://relay.example/gun" "wss://relay.example:9000/gun" "ws://localhost:8765/gun" "wss://r.example/gun" "wss://r.example/x/gun" nil nil]', norm);
  check("... and one it cannot be says why", (await cljs(page, "(boolean (relay-problem nil))")) === "true");

  const link = await cljs(page, '(room-link "abc")');
  check("a room link carries the relay of the page", /\?peer=off#room-abc"$/.test(link), link);
  const other = await cljs(page, '(with-relay "https://example.org/kairotic/?lang=es#room-x")');
  check("... and keeps what the address already had", other === '"https://example.org/kairotic/?lang=es&peer=off#room-x"', other);

  // the section in the session manager
  const wasOpen = (await cljs(page, "(:open @mgr)")) === "true";
  await cljs(page, "(show-manager!) (swap! mgr assoc :relays true)");
  await page.waitForTimeout(100);
  const sec = await page.evaluate(() => {
    const d = document.getElementById("relays");
    return d ? { open: d.open, text: d.querySelector("summary").textContent, form: !!d.querySelector('form[data-kind="relay"]'),
                 own: !!d.querySelector(".rown pre") } : null;
  });
  check("the session manager has a Relay section", !!sec && sec.form && sec.own, JSON.stringify(sec));
  check("... that says the page works without a relay", !!sec && /No relay/.test(sec.text), JSON.stringify(sec));
  // a relay that cannot be reached from an https page is refused before trying
  await page.fill("#relay-url", "two words");
  await page.click('#relays [data-act="relay-test"]');
  const t = await cljs(page, "(:state @relay-test)");
  check("... and refuses an address that is not a relay", t === ":fail", t);
  await cljs(page, `(reset! relay-test nil) (swap! mgr assoc :relays false) ${wasOpen ? "" : "(hide-manager!)"}`);
}
