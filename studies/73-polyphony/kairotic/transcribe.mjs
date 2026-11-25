// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 73 · a sound → Basic Pitch's posteriorgrams, in the browser: resampled to 22050 Hz mono, cut into the
// model's windows, each run through the model (onnx.mjs, in a worker), sewn back. The notes are read from the
// posteriorgrams on the page (basicpitch.mjs), so their thresholds can change without running the model again.
import * as BP from "./basicpitch.mjs";
import * as O from "./onnx.mjs";

// Spotify's Basic Pitch (ICASSP 2022), saved as ONNX in its own repository: Apache-2.0, code and weights.
// The hash is the one the upstream file has (basic_pitch/saved_models/icassp_2022/nmp.onnx).
export const MODEL = {
  name: "Basic Pitch (Spotify, ICASSP 2022)",
  licence: "Apache-2.0 (code and weights) · © Spotify AB",
  sha256: "2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec",
  urls: ["https://cdn.jsdelivr.net/gh/spotify/basic-pitch@v0.4.0/basic_pitch/saved_models/icassp_2022/nmp.onnx",
         "https://cdn.jsdelivr.net/gh/spotify/basic-pitch@main/basic_pitch/saved_models/icassp_2022/nmp.onnx"],
};

let loading = null;
/** The model's session, loaded once. A file the person drops in (an ArrayBuffer's object URL) can stand for the URLs. */
export function model({ urls = MODEL.urls, sha256 = MODEL.sha256, ep = "wasm" } = {}) {
  if (!loading) loading = O.session(urls, { sha256, ep }).catch((e) => { loading = null; throw e; });
  return loading;
}

/** Another model file instead (one the person dropped in, as an object URL), or back to the default with no options. */
export function useModel(opts = {}) {
  loading = null;
  return model(opts);
}

/** Any AudioBuffer → Float32Array at 22050 Hz, mono (the browser's own resampler, channels mixed down). */
export async function toModelRate(buffer) {
  if (buffer.sampleRate === BP.SR && buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
  const ctx = new OfflineAudioContext(1, Math.ceil(buffer.duration * BP.SR), BP.SR);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

// which output is which: the contours have 264 bins, the notes and the onsets 88 each; of those two the model names
// the notes first (StatefulPartitionedCall:1 before :2); the onsets are the sparser — checked after the run
function which(outs) {
  const names = Object.keys(outs);
  const last = (n) => outs[n].dims[outs[n].dims.length - 1];
  const contour = names.find((n) => last(n) === BP.CONTOURS);
  const keys = names.filter((n) => last(n) === BP.NOTES).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  if (!contour || keys.length !== 2) throw new Error("not Basic Pitch's outputs: " + names.map((n) => `${n} ${outs[n].dims}`).join(", "));
  return { note: keys[0], onset: keys[1], contour };
}
const mean = (a) => { let s = 0; for (const x of a) s += x; return a.length ? s / a.length : 0; };

/** audio: Float32Array at 22050 Hz, mono. Returns {frames, onsets, contours, n, seconds, ms, windows, session, swapped}
 *  (frames, onsets: n × 88; contours: n × 264, flat). onProgress(done, of) after each window; a signal can stop it. */
export async function transcribe(audio, { onProgress, signal, ep } = {}) {
  const s = await model({ ep });
  const { windows, frames: n } = BP.windows(audio);
  const outs = { note: [], onset: [], contour: [] };
  const t0 = performance.now();
  let names = null;
  for (let i = 0; i < windows.length; i++) {
    if (signal && signal.aborted) throw new DOMException("stopped", "AbortError");
    const r = await O.run(s, { [s.inputs[0]]: { data: windows[i], dims: [1, BP.WINDOW, 1] } });
    names = names || which(r);
    for (const k of ["note", "onset", "contour"]) outs[k].push(r[names[k]].data);
    if (onProgress) onProgress(i + 1, windows.length);
  }
  let frames = BP.unwrap(outs.note, BP.NOTES, n), onsets = BP.unwrap(outs.onset, BP.NOTES, n);
  const swapped = mean(onsets) > mean(frames);
  if (swapped) [frames, onsets] = [onsets, frames];
  return { frames, onsets, contours: BP.unwrap(outs.contour, BP.CONTOURS, n), n, seconds: audio.length / BP.SR,
           ms: performance.now() - t0, windows: windows.length, session: s, names, swapped };
}
