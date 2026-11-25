// SPDX-License-Identifier: Apache-2.0
// Kairotic · Study 73 · Basic Pitch around its model: the audio cut into the windows the model takes, its output
// sewn back into one posteriorgram, the frames' times, and the notes read from the posteriorgrams.
//
// A port to plain JavaScript of parts of Spotify's Basic Pitch (https://github.com/spotify/basic-pitch,
// basic_pitch/constants.py, inference.py and note_creation.py; and basic-pitch-ts, src/inference.ts):
//   Copyright 2022 Spotify AB. Licensed under the Apache License, Version 2.0
//   (http://www.apache.org/licenses/LICENSE-2.0). Modified for Kairotic: no tensors, flat Float32Arrays of frames ×
//   bins; pitch bends from the contours not read yet. The rest of Kairotic is MPL-2.0; this file keeps Basic Pitch's
//   licence.

export const SR = 22050;                    // the model hears 22050 Hz, mono
export const HOP = 256;                     // a frame every 256 samples
export const FPS = Math.floor(SR / HOP);    // 86 frames a second, as Basic Pitch counts them
export const WINDOW = SR * 2 - HOP;         // 43844 samples a window
export const OVERLAP_FRAMES = 30;           // windows overlap by 30 frames; 15 dropped from each side of each
export const OVERLAP = OVERLAP_FRAMES * HOP;
export const STEP = WINDOW - OVERLAP;       // 36164 samples from one window to the next
export const WINDOW_FRAMES = 172;           // what the model gives for one window (ANNOT_N_FRAMES = FPS × 2)
export const NOTES = 88, CONTOURS = 264;    // bins: piano keys from A0 (MIDI 21); 3 a semitone for the contours
export const MIDI_OFFSET = 21;

// defaults of basic_pitch.inference.predict
export const DEFAULTS = { onset: 0.5, frame: 0.3, minMs: 127.7, energyTol: 11, inferOnsets: true, melodia: true };

/** The windows the model takes: 15 frames of silence first, then the audio, each window WINDOW samples, STEP apart,
 *  the last padded with silence. Returns { windows: [Float32Array …], frames } where frames is how many frames the
 *  whole audio has (the posteriorgram is cut to that). */
export function windows(audio) {
  const pad = OVERLAP / 2;
  const n = audio.length + pad;
  const count = Math.max(1, Math.ceil(n / STEP));
  const out = [];
  for (let w = 0; w < count; w++) {
    const x = new Float32Array(WINDOW);
    const start = w * STEP - pad;               // where the window starts in the audio
    const a = Math.max(0, start), b = Math.min(audio.length, start + WINDOW);
    if (b > a) x.set(audio.subarray(a, b), a - start);
    out.push(x);
  }
  return { windows: out, frames: Math.floor(audio.length * FPS / SR) };
}

/** Sews the windows' outputs (each WINDOW_FRAMES × bins, flat) into one posteriorgram of `frames` × bins: 15 frames
 *  dropped from each end of each window, the rest in order, cut to `frames`. */
export function unwrap(outs, bins, frames) {
  const half = OVERLAP_FRAMES / 2, keep = WINDOW_FRAMES - OVERLAP_FRAMES;
  const r = new Float32Array(frames * bins);
  let f = 0;
  for (const o of outs) {
    const per = Math.round(o.length / bins);   // the model's frames in this window (172)
    const k = Math.min(per - 2 * half, keep);
    for (let i = 0; i < k && f < frames; i++, f++) r.set(o.subarray((half + i) * bins, (half + i + 1) * bins), f * bins);
  }
  return r;
}

/** The time in seconds of each frame, as basic_pitch.note_creation.model_frames_to_time: the frames of each window are
 *  a little earlier than frame / FPS, a little more for every window passed. */
export function frameTime(i) {
  const original = i * HOP / SR;
  const win = Math.floor(i / WINDOW_FRAMES);
  const offset = (HOP / SR) * (WINDOW_FRAMES - WINDOW / HOP) + 0.0018;
  return original - offset * win;
}

/** The onsets where the frames rise, after get_infered_onsets: the smallest of the rises over 1 and 2 frames, scaled
 *  to the onsets' maximum, and the larger of that and the onsets the model gave. */
export function inferOnsets(onsets, frames, n, bins, nDiff = 2) {
  const diff = new Float32Array(n * bins);
  let maxDiff = 0, maxOn = 0;
  for (let i = 0; i < n * bins; i++) if (onsets[i] > maxOn) maxOn = onsets[i];
  for (let t = 0; t < n; t++) for (let f = 0; f < bins; f++) {
    let m = Infinity;
    for (let d = 1; d <= nDiff; d++) {
      const prev = t - d >= 0 ? frames[(t - d) * bins + f] : 0;
      m = Math.min(m, frames[t * bins + f] - prev);
    }
    const v = t < nDiff || m < 0 ? 0 : m;
    diff[t * bins + f] = v;
    if (v > maxDiff) maxDiff = v;
  }
  const r = new Float32Array(n * bins);
  for (let i = 0; i < n * bins; i++) r[i] = Math.max(onsets[i], maxDiff > 0 ? maxOn * diff[i] / maxDiff : 0);
  return r;
}

/** The notes in a posteriorgram, after output_to_notes_polyphonic: onsets are the peaks in time of the onset
 *  posteriorgram above `onset`; from the latest, each note lasts while its frame posterior stays above `frame` (letting
 *  `energyTol` frames under it pass), longer than minMs; what they leave above `frame` is read as more notes from its
 *  loudest point both ways (the melodia trick). frames and onsets are flat Float32Arrays of n × 88.
 *  Returns [{start, end, midi, amp}] in frames (end exclusive), sorted by start then pitch. */
export function notes(frames, onsets, n, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const B = NOTES, MAXF = B - 1;
  const minLen = Math.round(o.minMs / 1000 * (SR / HOP));
  const on = o.inferOnsets ? inferOnsets(onsets, frames, n, B) : onsets;
  // peaks in time (scipy.signal.argrelmax along axis 0: strictly above both neighbours, never at the ends)
  const starts = [];
  for (let t = 1; t < n - 1; t++) for (let f = 0; f < B; f++) {
    const v = on[t * B + f];
    if (v >= o.onset && v > on[(t - 1) * B + f] && v > on[(t + 1) * B + f]) starts.push([t, f]);
  }
  starts.reverse();                         // the latest first (np.where's order, reversed)
  const rest = Float32Array.from(frames);
  const zero = (t, f) => { rest[t * B + f] = 0; if (f < MAXF) rest[t * B + f + 1] = 0; if (f > 0) rest[t * B + f - 1] = 0; };
  const mean = (a, b, f) => { let s = 0; for (let t = a; t < b; t++) s += frames[t * B + f]; return b > a ? s / (b - a) : 0; };
  const found = [];
  for (const [t0, f] of starts) {
    if (t0 >= n - 1) continue;
    let i = t0 + 1, k = 0;
    while (i < n - 1 && k < o.energyTol) { if (rest[i * B + f] < o.frame) k++; else k = 0; i++; }
    i -= k;
    if (i - t0 <= minLen) continue;
    for (let t = t0; t < i; t++) zero(t, f);
    found.push({ start: t0, end: i, midi: f + MIDI_OFFSET, amp: mean(t0, i, f) });
  }
  if (o.melodia) {
    for (;;) {
      let best = -1, bi = -1;
      for (let j = 0; j < n * B; j++) if (rest[j] > best) { best = rest[j]; bi = j; }
      if (!(best > o.frame)) break;
      const mid = Math.floor(bi / B), f = bi % B;
      rest[bi] = 0;
      let i = mid + 1, k = 0;
      while (i < n - 1 && k < o.energyTol) { if (rest[i * B + f] < o.frame) k++; else k = 0; zero(i, f); i++; }
      const end = i - 1 - k;
      i = mid - 1; k = 0;
      while (i > 0 && k < o.energyTol) { if (rest[i * B + f] < o.frame) k++; else k = 0; zero(i, f); i--; }
      const start = i + 1 + k;
      if (end - start <= minLen) continue;
      found.push({ start, end, midi: f + MIDI_OFFSET, amp: mean(start, end, f) });
    }
  }
  return found.sort((a, b) => a.start - b.start || a.midi - b.midi);
}
