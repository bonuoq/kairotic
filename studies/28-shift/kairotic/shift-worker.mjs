// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 28 · the shift off the main thread
// A minute of sound takes a few seconds to shift: here it does not stop the page. Messages:
//   {id, sr, chans: [Float32Array …], opts}  →  {id, chans, ms}  or  {id, error}
import S from "./shift.mjs";

self.onmessage = async (e) => {
  const { id, sr, chans, opts } = e.data;
  try {
    await S.ready();
    const r = S.shift(chans, sr, opts);
    self.postMessage({ id, chans: r.chans, ms: r.ms, version: S.version() }, r.chans.map((c) => c.buffer));
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
