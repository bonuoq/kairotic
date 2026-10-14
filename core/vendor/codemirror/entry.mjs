// SPDX-License-Identifier: MPL-2.0
// Kairotic · the code editor: CodeMirror 6 set up for the languages of the code boxes. build.mjs bundles this
// file into core/vendor/codemirror.mjs; the page imports it once, when an editor first opens (05-gestures.cljs).
//
//   createEditor({ parent, doc, language, words, onApply, onCancel, onChange, gutter, keys, placeholder }) → editor
//     language  "clojurescript" · "component" · "edn" (Clojure, with structural editing) · "faust" · other: plain
//     words     names offered while typing, besides the words already in the text
//     onApply   Ctrl/⌘+Enter          onCancel  Esc          onChange(text) after every edit by the person
//     gutter    false: no line numbers nor folding (a REPL line)        placeholder  text shown while empty
//     keys      [{key: "Enter", run: () => true|false}, …] before every other key (true: handled)
//   editor: getValue() · setValue(text) (not an edit: no onChange, no undo step) · focus() · destroy()
//           cursorLine() · lineCount() · completing() · newline() · cursorToEnd()
//           view (the CodeMirror EditorView, to grow on)
//
// Line numbers, automatic indentation, matching and closing brackets, undo history, search (Ctrl/⌘+F) and
// completion come for every language. Formatting, linting or a language server can be added here later as
// more CodeMirror extensions, without touching the page.

import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection,
         dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars, placeholder as placeholderText } from "@codemirror/view";
import { EditorState, Prec, Compartment, Transaction } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, insertNewlineAndIndent } from "@codemirror/commands";
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle, StreamLanguage, foldGutter,
         foldKeymap, indentUnit } from "@codemirror/language";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, completionStatus, currentCompletions } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { tags as t } from "@lezer/highlight";
import { default_extensions as clojureExtensions, complete_keymap as clojureKeymap } from "@nextjournal/clojure-mode";

// ───────── Faust: a small stream language (comments, strings, numbers, keywords, primitives, libraries) ─────────

const faustKeywords = new Set(["process", "import", "declare", "with", "letrec", "where", "environment", "library",
  "component", "case", "seq", "par", "sum", "prod", "inputs", "outputs", "route", "waveform", "soundfile", "ffunction",
  "fconstant", "fvariable"]);
const faustPrimitives = new Set(["hslider", "vslider", "nentry", "button", "checkbox", "hgroup", "vgroup", "tgroup",
  "hbargraph", "vbargraph", "attach", "mem", "prefix", "int", "float", "rdtable", "rwtable", "select2", "select3",
  "min", "max", "abs", "sin", "cos", "tan", "exp", "log", "pow", "sqrt", "floor", "ceil", "fmod", "remainder", "_", "!"]);
const openers = "([{", closers = ")]}";

const faust = StreamLanguage.define({
  name: "faust",
  startState: () => ({ depth: 0, comment: false }),
  copyState: (s) => ({ depth: s.depth, comment: s.comment }),
  token(stream, state) {
    if (state.comment) {
      if (stream.skipTo("*/")) { stream.match("*/"); state.comment = false; } else stream.skipToEnd();
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) { stream.skipToEnd(); return "comment"; }
    if (stream.match("/*")) { state.comment = true; return "comment"; }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
    if (stream.match(/^\d+(\.\d*)?([eE][-+]?\d+)?|^\.\d+/)) return "number";
    const ch = stream.peek();
    if (openers.includes(ch)) { stream.next(); state.depth++; return "bracket"; }
    if (closers.includes(ch)) { stream.next(); state.depth = Math.max(0, state.depth - 1); return "bracket"; }
    if (stream.match(/^[a-zA-Z_][\w]*(\.[a-zA-Z_][\w]*)+/)) return "variableName.special";   // os.osc, fi.lowpass
    if (stream.match(/^[a-zA-Z_][\w]*/)) {
      const w = stream.current();
      if (faustKeywords.has(w)) return "keyword";
      if (faustPrimitives.has(w)) return "variableName.standard";
      return "variableName";
    }
    if (stream.match(/^(<:|:>|:|,|~|\+|-|\*|\/|%|\^|'|@|<=|>=|==|!=|<|>|&|\||=|;)/)) return "operator";
    stream.next();
    return null;
  },
  indent(state, textAfter, cx) {
    const back = textAfter && closers.includes(textAfter[0]) ? 1 : 0;
    return Math.max(0, state.depth - back) * cx.unit;
  },
  languageData: { commentTokens: { line: "//", block: { open: "/*", close: "*/" } }, closeBrackets: { brackets: ["(", "[", "{", '"'] } },
});

// ───────── the look: the colours of the page (its CSS variables), light and dark alike ─────────

const look = EditorView.theme({
  "&": { color: "var(--ink)", backgroundColor: "var(--box)", fontSize: "12.5px", height: "100%" },
  ".cm-scroller": { fontFamily: "var(--f-code)", lineHeight: "1.5" },
  ".cm-content": { caretColor: "var(--accent)", padding: "6px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--accent-soft) !important" },
  ".cm-gutters": { backgroundColor: "var(--sheet)", color: "var(--ink-soft)", border: "none", borderRight: "1px solid var(--rule)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--accent-soft)", color: "var(--ink)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--accent-soft) 45%, transparent)" },
  "&.cm-focused .cm-matchingBracket": { backgroundColor: "var(--accent-soft)", outline: "1px solid var(--accent)" },
  "&.cm-focused .cm-nonmatchingBracket": { backgroundColor: "transparent", outline: "1px solid var(--error)" },
  ".cm-tooltip": { backgroundColor: "var(--sheet)", color: "var(--ink)", border: "1px solid var(--rule)", borderRadius: "4px" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent)", color: "#fff" },
  ".cm-panels": { backgroundColor: "var(--sheet)", color: "var(--ink)" },
  ".cm-searchMatch": { backgroundColor: "var(--accent-soft)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--accent-soft)", border: "none", color: "var(--ink)" },
});

const colours = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--ink-soft)", fontStyle: "italic" },
  { tag: [t.keyword, t.definitionKeyword, t.controlKeyword, t.modifier], color: "var(--kairos)", fontWeight: "500" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--ok)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--accent)" },
  { tag: [t.special(t.variableName), t.standard(t.variableName), t.function(t.variableName)], color: "var(--accent)" },
  { tag: [t.definition(t.variableName)], color: "var(--ink)", fontWeight: "600" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--ink-soft)" },
  { tag: t.meta, color: "var(--ink-soft)" },
  { tag: t.invalid, color: "var(--error)" },
]);

// ───────── completion: the words given (classes, functions, Faust libraries) and those in the text ─────────

const wordAt = /[\w.\-~!?*+<>=/$:]+$/;

function wordsSource(words) {
  const given = Array.from(new Set(words || [])).map((w) => (typeof w === "string" ? { label: w } : w));
  return (cx) => {
    const m = cx.matchBefore(wordAt);
    if (!m || (m.from === m.to && !cx.explicit)) return null;
    const typed = cx.state.sliceDoc(m.from, m.to);
    if (/^[\d.+-]/.test(typed) && !cx.explicit) return null;   // a number being written: nothing to offer
    const inText = new Set();
    const re = /[A-Za-z_][\w.\-~!?*+<>=/$]*/g;
    const text = cx.state.doc.toString();
    let x;
    while ((x = re.exec(text))) if (x[0] !== typed && x[0].length > 2) inText.add(x[0]);
    const options = given.concat(Array.from(inText).filter((w) => !given.some((g) => g.label === w)).map((w) => ({ label: w, type: "text" })));
    return { from: m.from, options, validFor: /^[\w.\-~!?*+<>=/$:]*$/ };
  };
}

// ───────── languages ─────────

const clojureLike = new Set(["clojurescript", "clojure", "component", "edn", "cljs"]);

function languageExtensions(language) {
  if (clojureLike.has(language)) return [clojureExtensions, keymap.of(clojureKeymap)];
  if (language === "faust") return [faust, indentUnit.of("    ")];
  return [];
}

// ───────── the editor ─────────

export function createEditor({ parent, doc = "", language = "", words = [], onApply, onCancel, onChange,
                               gutter = true, keys = [], placeholder = "" } = {}) {
  const lang = new Compartment(), completion = new Compartment();
  let quiet = false;
  const own = Prec.highest(keymap.of([
    ...Array.from(keys || []).map((k) => ({ key: k.key, run: () => !!k.run(), preventDefault: !!k.preventDefault })),
    { key: "Mod-Enter", run: () => { if (onApply) onApply(view.state.doc.toString()); return true; } },
    { key: "Mod-s", run: () => { if (onApply) onApply(view.state.doc.toString()); return true; }, preventDefault: true },
  ]));
  const escape = keymap.of([{ key: "Escape", run: () => { if (onCancel) onCancel(); return !!onCancel; } }]);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        own,
        gutter ? [lineNumbers(), highlightActiveLineGutter(), foldGutter(), highlightActiveLine()] : [],
        placeholder ? placeholderText(placeholder) : [],
        highlightSpecialChars(), history(),
        drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
        bracketMatching(), closeBrackets(), rectangularSelection(), crosshairCursor(),
        highlightSelectionMatches(), syntaxHighlighting(colours), look, EditorView.lineWrapping,
        completion.of(autocompletion({ override: [wordsSource(words)], activateOnTyping: true })),
        lang.of(languageExtensions(language)),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap,
                   ...completionKeymap, indentWithTab]),
        escape,
        EditorView.updateListener.of((u) => { if (u.docChanged && onChange && !quiet) onChange(u.state.doc.toString()); }),
      ],
    }),
  });
  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue: (text) => {
      quiet = true;
      try {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: String(text) },
                        annotations: Transaction.addToHistory.of(false) });
      } finally { quiet = false; }
    },
    cursorLine: () => view.state.doc.lineAt(view.state.selection.main.head).number,
    lineCount: () => view.state.doc.lines,
    // a list of completions is showing (one that is still being computed, or empty, does not count)
    completing: () => completionStatus(view.state) === "active" && currentCompletions(view.state).length > 0,
    newline: () => insertNewlineAndIndent(view),
    cursorToEnd: () => view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true }),
    setWords: (ws) => view.dispatch({ effects: completion.reconfigure(autocompletion({ override: [wordsSource(ws)] })) }),
    setLanguage: (l) => view.dispatch({ effects: lang.reconfigure(languageExtensions(l)) }),
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}

export default { createEditor };
