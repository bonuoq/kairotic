// SPDX-License-Identifier: MPL-2.0
// Study 70 · open form: an example work, "Eleven cells" — in Klavierstück XI's manner (not its notes): ten fragments
// on one page, any of them first, each leaving how the next is played (tempo, dynamics, touch), the performance over
// when a fragment comes a third time. Each fragment is a rhythm cell of one bar (16 pulses — discussion #212: the
// fragments as necklaces, from @kairotic/rhythm) over pitches of one twelve-tone row, four notes each.

const ROW = [0, 11, 3, 4, 8, 7, 9, 5, 6, 1, 2, 10];

// (onsets of the cell; each note lasts until the next onset; its pitches the row's four from `from`, in `reg`isters)
function cell(id, pulses, from, reg, extra = {}) {
  const ps = [0, 1, 2, 3].map((k) => ROW[(from + k) % 12]);
  const notes = pulses.map((on, i) => {
    const next = i + 1 < pulses.length ? pulses[i + 1] : 16;
    return [on, next - on, 12 * reg[i % reg.length] + ps[i % 4]];
  });
  return { id, notes, ...extra };
}

export const ELEVEN = {
  name: "Eleven cells",
  start: "any",
  end: { repeat: 3 },
  first: { tempo: 1, dyn: "mf", touch: "normal" },
  frags: [
    cell("A", [0, 3, 6, 8, 11, 14], 0, [5, 6, 5, 6], { then: { tempo: 1.5, dyn: "pp" } }),
    cell("B", [0, 2, 5, 8, 10, 13], 0, [4, 5, 6, 5], { then: { tempo: 1, dyn: "f", touch: "staccato" } }),
    cell("C", [0, 3, 6, 9, 12], 4, [5, 4, 6, 5], { near: 6, then: { tempo: 0.75, dyn: "p", touch: "legato" } }),
    cell("D", [0, 3, 6, 10, 12], 4, [6, 5, 4, 6], { then: { tempo: 1.25, dyn: "mf" } }),
    cell("E", [0, 3, 7, 10, 12], 8, [3, 4, 5, 6], { then: { dyn: "ff", touch: "staccato" } }),
    cell("F", [0, 4, 8, 12], 8, [6, 6, 5, 4], { not: ["F", "G"], then: { tempo: 0.75, dyn: "pp", touch: "legato" } }),
    cell("G", [0, 4, 6, 10], 2, [5, 6, 6, 5], { then: { tempo: 1.5, dyn: "mp" } }),
    cell("H", [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14], 6, [4, 5, 6], { not: ["H"], then: { tempo: 1, dyn: "fff", touch: "normal" } }),
    cell("I", [0, 10], 10, [3, 7], { then: { tempo: 0.75, dyn: "ppp", touch: "legato" } }),
    cell("J", [0, 2, 4, 6, 8, 10, 12, 14], 6, [5, 5, 6, 6], { then: { tempo: 1.25, dyn: "p", touch: "staccato" } }),
  ],
};

export const WORKS = { eleven: ELEVEN };
