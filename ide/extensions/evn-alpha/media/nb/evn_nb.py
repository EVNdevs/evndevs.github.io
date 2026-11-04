"""evn_nb: the EVN notebook's helper (vscode-evn-alpha/docs/NOTEBOOK_DESIGN.md §3.6).

Imported into every notebook kernel. It only reads plain files, works without NumPy (it returns lists) and returns NumPy
arrays when NumPy is loaded.

    log = evn_nb.read_log(evn_nb.data('run1.csv'))
    t, v = log.series('Motor', 1, 'angle')

read_log(path) reads every CSV the EVN tools write: the "long" log (time_s,device,port,quantity,value,unit,note with
`# key: value` header lines; src/dataLogCsv.ts) from the board's evn.DataLog.save() and from the extension's recorder,
their sample counts and halvings, and "points" files (Capture point); a plain CSV with a header row (what a program
writes with file.write) is read as named columns. A cell is a number where it parses as one and text otherwise (colour
names stay text); an empty cell is None (lists) or nan (arrays). A row whose time is not a number is reported with its
line number and skipped.

It reads a log as the extension's viewer does (src/dataLogCsv.ts parseLog: scripts/test_notebook.js checks the two on
the same files, value by value), with two differences on purpose: a file saved with append=True gains rows whose time
restarts at 0, so `.runs` splits it into runs at each backward time step of a channel, in file order (the viewer
re-sorts and merges them; `.channels` and `.series()` do the same); and a bad row is reported, not skipped silently.

copy_in(path) (await it) brings in a file the notebook left out (over 32 MB, or past the 64 MB all files may take);
data(name) gives the path of a file in the projects folder's Data/ from wherever the notebook is.

Figures (NOTEBOOK_DESIGN.md §3.7): after each cell the notebook turns every open Matplotlib figure into a picture with
alt text and a data table. table(fig=None) prints a figure's table (the last figure shown, when none is given);
figure_format('svg') switches the pictures to SVG ('png', at 150 dpi, is the default).
"""

import csv as _csv
import json as _json
import math as _math
import os as _os
import re as _re
import sys as _sys

__all__ = ['read_log', 'Log', 'Channel', 'data', 'copy_in', 'DATA', 'table', 'figure_format']

PROJECTS = '/evn'
# the kernel's figure state (src/nb/kernelPy.ts _render_figures reads and writes it): the picture format, and the data
# table of the last figure shown
_STATE = {'format': 'png', 'last': None}
DATA = '/evn/Data'

_NUM = _re.compile(r'^\s*[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\s*$')
_INT = _re.compile(r'^\s*[+-]?[0-9]+\s*$')
_KEYVAL = _re.compile(r'^([^:]{1,40}):\s?(.*)$')
_COUNT = "[0-9][0-9\\s.,'  ]*"


def _cell(s):
    """a cell's value: a number where it parses as one, None when empty, text otherwise"""
    if s is None or s.strip() == '':
        return None
    if _NUM.match(s):
        return int(s) if _INT.match(s) else float(s)
    return s


def _is_num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and _math.isfinite(x)


def _np():
    return _sys.modules.get('numpy')


def _split(line):
    """one CSV line into cells (RFC 4180 quoting; a log never has a line break inside a cell)"""
    return next(_csv.reader([line]), [''])


def data(name=None):
    """The path of `name` in the projects folder's Data/ (relative to the notebook's folder when it is in the projects
    folder). Without a name: the newest CSV in Data/ and its subfolders."""
    if name is None:
        best = None
        for d, dirs, files in _os.walk(DATA):
            dirs[:] = [x for x in dirs if not x.startswith('.')]
            for f in files:
                if f.lower().endswith('.csv'):
                    p = _os.path.join(d, f)
                    k = (_os.path.getmtime(p), p)
                    if best is None or k > best:
                        best = k
        if best is None:
            raise FileNotFoundError('Data/ has no CSV yet: download a log from the Board view, or save one into Data/')
        p = best[1]
    else:
        p = _os.path.join(DATA, str(name))
    cwd = _os.getcwd()
    return _os.path.relpath(p, cwd) if (cwd + '/').startswith(PROJECTS + '/') else p


async def copy_in(path):
    """Bring a file (up to 256 MB) or a folder the notebook left out into it; then open() works on it as on any file.
    A path is relative to the notebook's folder, else to the projects folder (`Data/long_run.csv`)."""
    try:
        import _evn_nb_host
    except ImportError:
        raise RuntimeError('copy_in works in the EVN notebook only') from None
    r = _json.loads(await _evn_nb_host.copy_in(str(path), _os.getcwd()))
    if r.get('error'):
        raise FileNotFoundError(r['error'])
    cwd = _os.getcwd()
    return [_os.path.relpath(p, cwd) for p in r.get('copied', [])]


class Channel:
    """One series of a log: its device, port and quantity, unit, times t and values v (in time order), whether any
    value is text, and the samples the file says were taken (`taken`) and the board's halvings, when it says."""

    __slots__ = ('device', 'port', 'quantity', 'unit', 't', 'v', 'text', 'taken', 'halvings')

    def __init__(self, device, port, quantity, unit):
        self.device, self.port, self.quantity, self.unit = device, port, quantity, unit
        self.t, self.v = [], []
        self.text = False
        self.taken = None
        self.halvings = None

    @property
    def key(self):
        return (self.device, self.port, self.quantity)

    def __repr__(self):
        return 'Channel(%r, %r, %r, %d rows%s)' % (self.device, self.port, self.quantity, len(self.t),
                                                  ', unit %r' % self.unit if self.unit else '')


class Log:
    """A data log read by read_log(): .title, .meta (the header's (key, value) lines), .trailer (the `# key: value`
    lines after the column row), .channels, .series(device, port, quantity), .columns (the log() columns, or a plain
    CSV's columns, by name), .notes ((time, note) of points), .runs, .rows and .bad ((line number, line) skipped)."""

    def __init__(self, path=''):
        self.path = path
        self.title = ''
        self.meta = []
        self.trailer = []
        self.channels = []
        self.notes = []
        self.columns = {}
        self.runs = [self]
        self.rows = 0
        self.bad = []

    def series(self, device, port=None, quantity=None):
        """(t, v) of the one channel matching device (and port and quantity when given)"""
        ps = None if port is None else str(port)
        hits = [c for c in self.channels if c.device == device and (ps is None or c.port == ps)
                and (quantity is None or c.quantity == quantity)]
        if len(hits) == 1:
            return hits[0].t, hits[0].v
        names = ', '.join('%s %s %s' % (c.device, c.port, c.quantity) for c in self.channels) or 'none'
        if not hits:
            raise KeyError('no channel %s %s %s in this log; it has: %s' % (device, '' if port is None else port,
                                                                           quantity or '', names))
        raise ValueError('%d channels match: name the port and quantity (%s)' % (len(hits), names))

    def __repr__(self):
        return 'Log(%r: %d channels, %d rows, %d runs)' % (self.path, len(self.channels), self.rows, len(self.runs))


def _arrays(log):
    """lists -> NumPy arrays (None -> nan) when NumPy is loaded; text channels and text columns stay lists"""
    np = _np()
    if np is None:
        return
    for c in log.channels:
        c.t = np.array(c.t, dtype=float)
        if not c.text:
            c.v = np.array([np.nan if x is None else x for x in c.v], dtype=float)
    for k, col in list(log.columns.items()):
        if all(x is None or _is_num(x) for x in col):
            log.columns[k] = np.array([np.nan if x is None else x for x in col], dtype=float)


def _build(path, rows, title, meta, trailer):
    """A Log from parsed rows (line, t, device, port, quantity, value, unit, note), each channel put in time order"""
    log = Log(path)
    log.title, log.meta, log.trailer = title, meta, trailer
    by = {}
    log_rows = []
    for (line, t, device, port, quantity, value, unit, note) in rows:
        k = (device, port, quantity)
        c = by.get(k)
        if c is None:
            c = by[k] = Channel(device, port, quantity, unit)
            log.channels.append(c)
        if isinstance(value, str):
            c.text = True
        c.t.append(t)
        c.v.append(value)
        log.rows += 1
        if note and not (log.notes and log.notes[-1] == (t, note)):
            log.notes.append((t, note))
        if device == 'log' and port == '':
            log_rows.append((t, quantity, value))
    for c in log.channels:
        if any(c.t[i] < c.t[i - 1] for i in range(1, len(c.t))):
            order = sorted(range(len(c.t)), key=lambda i: c.t[i])
            c.t = [c.t[i] for i in order]
            c.v = [c.v[i] for i in order]
    log.notes.sort(key=lambda n: n[0])
    # the log() columns: one row per call (the same time, each column once), in file order
    if log_rows:
        names, groups = [], []
        for t, q, v in log_rows:
            if q not in names:
                names.append(q)
            if not groups or groups[-1]['time_s'] != t or q in groups[-1]:
                groups.append({'time_s': t})
            groups[-1][q] = v
        log.columns = {'time_s': [g['time_s'] for g in groups]}
        for n in names:
            log.columns[n] = [g.get(n) for g in groups]
    return log


def _count_of(s):
    d = _re.sub(r'[^0-9]', '', s)
    return int(d) if d else None


def _of_quantity(c, q):
    return c.quantity == q or c.quantity.startswith(q + '.')


def _series_of(label, method, sub):
    pm = _re.match(r'^(Motor|Port)\s+([0-9]+)$', label)
    if pm:
        device = 'Motor' if pm.group(1) == 'Motor' else sub
        return lambda c: c.port == pm.group(2) and (device is None or c.device == device) and _of_quantity(c, method)
    low = label.lower()
    return lambda c: (c.port == '' and bool(c.device) and (low == c.device.lower() or low.endswith(' ' + c.device.lower()))
                      and _of_quantity(c, method))


def _samples_taken(log):
    """`taken` and `halvings` from the board's `# channel: ... | N rows of M samples` lines and the extension's
    `# samples taken:` and `# rate halved:` lines (src/dataLogCsv.ts samplesTaken, the same rules)"""
    channels = [[x.strip() for x in v.split('|')] for k, v in log.meta if k.lower() == 'channel']
    rows_of = _re.compile(r'^(' + _COUNT + r')\s+rows\s+of\s+(' + _COUNT + r')\s+samples$', _re.I)
    for f in channels:
        m = rows_of.match(f[-1] if f else '')
        if not m or len(f) < 3:
            continue
        dp = _re.match(r'^(.*?)(?:\s+([0-9]+))?$', f[0])
        device = dp.group(1) if dp else f[0]
        port = (dp.group(2) if dp else None) or ''
        taken = _count_of(m.group(2))
        if taken is None:
            continue
        hv = _re.search(r'\(halved\s+([0-9]+)\s+times?\b', ' | '.join(f[3:-1]), _re.I)
        for c in log.channels:
            if c.device == device and c.port == port and _of_quantity(c, f[1]):
                c.taken = taken
                if hv:
                    c.halvings = int(hv.group(1))
    heads = []
    for f in channels:
        m = _re.match(r'^(.*?)\s*\(([^()]*)\)$', f[0] if f else '')
        heads.append({'label': m.group(1).strip(), 'sub': m.group(2).strip(), 'method': f[1] if len(f) > 1 else ''} if m else None)
    for k, v in log.trailer:
        if k.lower() != 'rate halved':
            continue
        m = _re.match(r'^(.*\S)\s+(\S+)\s+is thinned\b.*?([0-9]+)\s+halvings?\)\s*$', v)
        if not m:
            continue
        label = m.group(1).strip()
        sub = next((h['sub'] for h in heads if h and h['label'] == label and h['method'] == m.group(2)), None)
        pick = _series_of(label, m.group(2), sub)
        for c in log.channels:
            if pick(c):
                c.halvings = max(c.halvings or 0, int(m.group(3)))
    line = next((v for k, v in reversed(log.trailer) if k.lower() == 'samples taken'), None)
    if not line:
        return
    entry_re = _re.compile(r"^(.*?[^0-9\s.,'  ])\s+(" + _COUNT + r')$')
    entries = []
    for e in _re.sub(r'\s*\([^()]*\)\s*$', '', line, count=1).split(';'):
        m = entry_re.match(e.strip())
        lm = _re.match(r'^(.*)\s+(\S+)$', m.group(1).strip()) if m else None
        entries.append({'label': lm.group(1).strip(), 'method': lm.group(2), 'taken': _count_of(m.group(2))} if m and lm else None)
    zipped = len(heads) == len(entries) and all(
        e and heads[k] and heads[k]['label'] == e['label'] and heads[k]['method'] == e['method'] for k, e in enumerate(entries))
    for k, e in enumerate(entries):
        if not e or e['taken'] is None:
            continue
        pick = _series_of(e['label'], e['method'], heads[k]['sub'] if zipped else None)
        for c in log.channels:
            if pick(c):
                c.taken = e['taken']


def _plain(path, lines, start, title, meta):
    """a plain CSV with a header row: its columns by name, each cell typed"""
    log = Log(path)
    log.title, log.meta = title, meta
    rows = list(_csv.reader(lines[start:]))
    while rows and not any(x.strip() for x in rows[-1]):
        rows.pop()
    if not rows:
        return log
    # a repeated header name keeps its own column: a, a.1, a.2 (as pandas names them); an empty one is 'column N'
    head, seen = [], set()
    for i, h in enumerate(rows[0]):
        base = h if h.strip() else 'column %d' % (i + 1)
        name, n = base, 0
        while name in seen:
            n += 1
            name = '%s.%d' % (base, n)
        seen.add(name)
        head.append(name)
    cols = {h: [] for h in head}
    for r in rows[1:]:
        if not any(x.strip() for x in r):
            continue
        for i, h in enumerate(head):
            cols[h].append(_cell(r[i]) if i < len(r) else None)
        log.rows += 1
    log.columns = cols
    return log


def read_log(path):
    """Read a data log or a plain CSV (see the module's help). A name not found beside the notebook is looked for in
    Data/."""
    p = str(path)
    if not _os.path.exists(p) and not _os.path.isabs(p) and _os.path.exists(_os.path.join(DATA, p)):
        p = _os.path.join(DATA, p)
    with open(p, encoding='utf-8-sig', newline='') as f:
        text = f.read()
    lines = _re.split(r'\r?\n', text)
    meta, title, i = [], '', 0
    while i < len(lines) and lines[i].startswith('#'):
        body = _re.sub(r'^#\s?', '', lines[i], count=1)
        m = _KEYVAL.match(body)
        if m:
            meta.append((m.group(1).strip(), m.group(2)))
        elif not title:
            title = body.strip()
        i += 1
    while i < len(lines) and not lines[i].strip():
        i += 1
    head = [h.strip().lower() for h in _split(lines[i].lstrip('﻿') if i < len(lines) else '')]
    col = {n: (head.index(n) if n in head else -1) for n in ('time_s', 'device', 'port', 'quantity', 'value', 'unit', 'note')}
    if col['time_s'] < 0 or col['value'] < 0:
        log = _plain(str(path), lines, i, title, meta)
        _arrays(log)
        return log
    get = lambda f, n, default='': (f[col[n]] if col[n] < len(f) else default) if col[n] >= 0 else default
    trailer, rows, bad = [], [], []
    for j in range(i + 1, len(lines)):
        line = lines[j]
        if line.startswith('#'):
            m = _KEYVAL.match(_re.sub(r'^#\s?', '', line, count=1))
            if m:
                trailer.append((m.group(1).strip(), m.group(2).strip()))
            continue
        if not line.strip():
            continue
        f = _split(line)
        t = _cell(get(f, 'time_s', None))
        if not _is_num(t):
            bad.append((j + 1, line))
            continue
        quantity = get(f, 'quantity', 'value') if col['quantity'] >= 0 else 'value'
        rows.append((j + 1, float(t), get(f, 'device'), get(f, 'port'), quantity, _cell(get(f, 'value')),
                     get(f, 'unit'), get(f, 'note')))
    log = _build(str(path), rows, title, meta, trailer)
    log.bad = bad
    _samples_taken(log)
    # runs: each channel's rows in file order, a new run at each backward time step (append=True restarts at 0)
    run_of, last, counts = [], {}, {}
    for r in rows:
        k = (r[2], r[3], r[4])
        if k in last and r[1] < last[k]:
            counts[k] = counts.get(k, 0) + 1
        last[k] = r[1]
        run_of.append(counts.get(k, 0))
    n_runs = max(run_of) + 1 if run_of else 1
    if n_runs > 1:
        log.runs = [_build(str(path), [r for r, k in zip(rows, run_of) if k == n], title, meta, trailer) for n in range(n_runs)]
        for r in log.runs:
            r.runs = [r]
            _arrays(r)
    _arrays(log)
    if bad:
        shown = ', '.join(str(n) for n, _ in bad[:5]) + (' and %d more' % (len(bad) - 5) if len(bad) > 5 else '')
        print('%s: %d row%s skipped (the time is not a number): line%s %s' % (
            _os.path.basename(str(path)), len(bad), '' if len(bad) == 1 else 's', '' if len(bad) == 1 else 's', shown),
            file=_sys.stderr)
    return log


def figure_format(fmt):
    """The format of the figures from the next cell on: 'png' (150 dpi, the default) or 'svg'."""
    f = str(fmt).lower()
    if f not in ('png', 'svg'):
        raise ValueError("figure_format takes 'png' or 'svg', not " + repr(fmt))
    _STATE['format'] = f


def table(fig=None):
    """Print the data table of a figure the notebook has shown (the last one, when no figure is given): CSV text, a
    block per line, bar set, scatter or image, up to 2,000 rows each."""
    if fig is None:
        t = _STATE['last']
        if t is None:
            print('No figure has been shown yet: a figure gets its table when the cell that draws it ends.')
            return
    else:
        t = getattr(fig, '_evn_table', None)
        if t is None:
            print('That figure has not been shown yet: it gets its table when the cell that draws it ends.')
            return
    print(t, end='' if t.endswith(chr(10)) else chr(10))
