# SPDX-License-Identifier: MPL-2.0
# A small reader of the LilyPond Mutopia typesets of a few Bach preludes: notes as {t, d, p} (16ths, MIDI).
import re, json, sys
STEP = {'c':0,'d':2,'e':4,'f':5,'g':7,'a':9,'b':11}
ACC = {'isis':2,'is':1,'eses':-2,'es':-1,'s':-1,'':0}
NOTE = re.compile(r"^([a-h])(isis|eses|is|es|s)?([',]*)([!?]?)(\d+)?(\.*)[\^_-]*$")
DEUTSCH = False
def strip(src):
    src = re.sub(r'%\{.*?%\}', ' ', src, flags=re.S)
    src = re.sub(r'%[^\n]*', ' ', src)
    return src
def tokens(src):
    for rx in [r'\\key\s+\S+\s+\\\w+', r'\\transpose\s+\S+\s+\S+', r'\\time\s+\S+', r'\\clef\s+"?[\w^_]+"?',
               r'\\tempo\s+\S+', r'\\set\s+\S+\s*=\s*\S+', r'\\bar\s+"[^"]*"', r'\\context\s+\w+(\s*=\s*"[^"]*")?',
               r'\\relative\s+\S+', r'\\markup\s*\{[^}]*\}', r'_\\markup\{[^}]*\}']:
        src = re.sub(rx, ' ', src)
    src = src.replace('<<', ' \x01 ').replace('>>', ' \x02 ').replace('\\\\', ' \\\\ ')
    src = re.sub(r'([{}|~\[\]()])', r' \1 ', src)
    src = re.sub(r'<([^<>\x01\x02]*)>', lambda m: ' <' + '_'.join(m.group(1).split()) + '>', src)
    return [{'\x01': '<<', '\x02': '>>'}.get(x, x) for x in src.split()]
class Reader:
    def __init__(self, relative=None, shift=0):
        self.rel = relative; self.dur = 4; self.shift = shift
    def pitch(self, name, acc, marks):
        # German names (BWV 999's typeset): h is B, b is B flat
        if name == 'h': name = 'b'
        elif name == 'b' and DEUTSCH and not acc: acc = 'es'
        s = STEP[name]; a = ACC[acc or '']
        if self.rel is None:
            octv = 3 + marks.count("'") - marks.count(',')
            return 12 * (octv + 1) + s + a + self.shift
        # relative: the nearest octave to the last pitch (by step, as LilyPond does)
        last = self.rel
        lstep = (last['oct'] * 7 + last['step'])
        idx = 'cdefgab'.index(name)
        cand = [o for o in range(-2, 10)]
        best = min(cand, key=lambda o: abs((o * 7 + idx) - lstep))
        o = best + marks.count("'") - marks.count(',')
        self.rel = {'oct': o, 'step': idx}
        return 12 * (o + 1) + s + a + self.shift
    def dur16(self, d, dots):
        if d: self.dur = int(d)
        base = 16 / self.dur; x = base; add = base
        for _ in dots: add /= 2; x += add
        return x
def read(seq, reader, t=0):
    out = []; i = 0; tie = False
    while i < len(seq):
        tok = seq[i]; i += 1
        if tok in ('{', '}', '|', '[', ']', '(', ')'): continue
        if tok == '~': tie = True; continue
        if tok.startswith('\\'): continue
        tok = re.sub(r'[\^_-]+(\\\w+|"[^"]*"|\d)*$', '', tok) if not tok.startswith('<') else tok
        if tok == '<<':
            # voices: << { … } \\ { … } >>
            depth = 0; voices = [[]]; j = i
            while True:
                x = seq[j]; j += 1
                if x == '<<': depth += 1
                if x == '>>':
                    if depth == 0: break
                    depth -= 1
                if x == '\\\\' and depth == 0: voices.append([]); continue
                voices[-1].append(x)
            i = j; ref = reader.rel; ends = []
            for v in voices:
                reader.rel = ref
                notes, t2 = read(v, reader, t)
                out += notes; ends.append(t2)
            t = max(ends); continue
        if tok.startswith('<'):
            m = re.match(r'^<(.*)>(\d+)?(\.*)', tok)
            names = m.group(1).split('_'); d = reader.dur16(m.group(2), m.group(3))
            ref = reader.rel; first = None
            for nm in names:
                mm = NOTE.match(nm)
                if not mm: continue
                p = reader.pitch(mm.group(1), mm.group(2), mm.group(3))
                if first is None: first = reader.rel
                out.append({'t': t, 'd': d, 'p': p})
            if reader.rel is not None and first is not None: reader.rel = first
            t += d; continue
        m = re.match(r'^([rs])(\d+)?(\.*)$', tok)
        if m:
            t += reader.dur16(m.group(2), m.group(3)); tie = False; continue
        m = NOTE.match(tok)
        if m:
            p = reader.pitch(m.group(1), m.group(2), m.group(3)); d = reader.dur16(m.group(5), m.group(6))
            if tie and out and out[-1]['p'] == p and abs(out[-1]['t'] + out[-1]['d'] - t) < 1e-9:
                out[-1]['d'] += d
            else:
                out.append({'t': t, 'd': d, 'p': p})
            t += d; tie = False; continue
    return out, t
def block(src, name):
    i = src.index(name); j = src.index('{', i); depth = 0
    for k in range(j, len(src)):
        if src[k] == '{': depth += 1
        elif src[k] == '}':
            depth -= 1
            if depth == 0: return src[j:k+1]
if __name__ == '__main__':
    which = sys.argv[1]
    if which == '846':
        src = strip(open(sys.argv[2]).read())
        right = block(src, '\nright =')
        r, _ = read(tokens(right), Reader(None, 12))
        left = block(src, '\nleft =')
        l, _ = read(tokens(left), Reader(None, 0))
        notes = sorted(r + l, key=lambda n: (n['t'], n['p']))
    elif which == '1009':
        src = strip(open(sys.argv[2]).read())
        notes, _ = read(tokens(block(src, '\nprelude =')), Reader(None, 0))
        notes = sorted(notes, key=lambda n: (n['t'], n['p']))
    elif which == '999':
        DEUTSCH = True
        src = strip(open(sys.argv[2]).read())
        m, _ = read(tokens(block(src, '\nmelody =')), Reader({'oct': 4, 'step': 0}))
        b, _ = read(tokens(block(src, '\nbass =')), Reader({'oct': 3, 'step': 0}))
        notes = sorted(m + b, key=lambda n: (n['t'], n['p']))
    else:
        src = strip(open(sys.argv[2]).read())
        body = block(src, 'prelude =')
        rd = Reader({'oct': 4, 'step': 0})   # \relative c'
        notes, _ = read(tokens(body), rd)
        notes = sorted(notes, key=lambda n: (n['t'], n['p']))
    print(json.dumps([[n['t'], n['d'], n['p']] for n in notes]))
