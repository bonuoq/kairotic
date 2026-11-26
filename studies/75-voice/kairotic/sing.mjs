// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 75 · the two faust~ compiled in the page (faustwasm, as the app's faust~ does) and played along
// the curves: notes with syllables → curves (tract.mjs) → voice.dsp and noise.dsp → one sound.

import { curves } from "./tract.mjs";
import { player, mix } from "./render.mjs";

const FAUSTWASM = "https://cdn.jsdelivr.net/npm/@grame/faustwasm@0.18.5/dist/esm-bundle/index.js";
export const SR = 44100;

let fx = null;
const faust = () => fx || (fx = import(FAUSTWASM).then((F) => F.instantiateFaustModule().then((mod) => ({ F, compiler: new F.FaustCompiler(new F.LibFaust(mod)) }))));

/** Faust code → a player (render.mjs), or an error with the compiler's message. */
export async function compile(name, code) {
  const { F, compiler } = await faust();
  const gen = new F.FaustMonoDspGenerator();
  const ok = await gen.compile(compiler, name, code, "-ftz 2").catch(() => null);
  if (!ok) throw new Error(`${name}: ${(compiler.getErrorMessage && compiler.getErrorMessage()) || "Faust could not compile this code"}`);
  const fac = gen.factory, json = JSON.parse(fac.json);
  return { json, play: player(fac.module || fac.code, json, { sr: SR }) };
}

/** The two faust~ from their codes. */
export async function voices(voiceCode, noiseCode) {
  const [voice, noise] = await Promise.all([compile("voice", voiceCode), compile("noise", noiseCode)]);
  return { voice, noise };
}

/** notes → {curves, voice, noise, sound} (Float32Arrays at SR). opts: those of curves (table, pron, size) and
 *  fixed (the sliders the curves do not move: vibrato, open, tilt), noise (its level in the mix). */
export function sing(V, notes, opts = {}) {
  const C = curves(notes, opts);
  const voice = V.voice.play(C, { fixed: opts.fixed || {} });
  const noise = V.noise.play(C, { fixed: opts.fixed || {} });
  return { curves: C, voice, noise, sound: mix(voice, noise, { noise: opts.noise ?? 1 }) };
}
