// Kairotic Pages · configuration
// The GUN relays this site connects to. A relay is a small Node server (see relay/) that passes the
// graph between browsers and keeps a copy; without any, each browser works alone (its own
// localStorage) and rooms only reach other tabs of the same browser.
//
// A visitor can also choose relays for one visit with ?peer=wss://host/gun (several separated by
// commas); they are remembered in this browser until ?peer= is given again (?peer=none clears them).
window.KAIROTIC_PEERS = [
  // "wss://your-relay.example.org/gun",
];
