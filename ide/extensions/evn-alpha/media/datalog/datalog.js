/* The data logger's page: the sources to record (live mode), the chart and the statistics (both modes).
 * The extension (src/dataLogger.ts) sends: init, sources, state, series, data, reset, note, point, empty.
 * It is sent: ready, toggle, rate, name, start, stop, capture, openFile, revealData.
 *
 * The chart is lanes on one time axis: one lane per unit (a unitless reading gets a lane of its own
 * method), each with its own y-axis, so two quantities never share a scale (no dual axes). Drag across
 * the lanes to zoom into a span, wheel to zoom around the pointer, double-click for everything; the strip
 * under the lanes shows the whole log and the span in view (drag it to pan). The table under the chart is
 * the statistics of the span in view, one row per series. Long runs are drawn at one min/max pair per
 * pixel column, so a million samples draw as fast as a thousand.
 */
(function () {
  'use strict';
  const vscode = acquireVsCodeApi();
  const SERIES_VARS = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];
  const WINDOWS = [[10, '10 s'], [30, '30 s'], [120, '2 min'], [0, 'All']];
  const MAX_POINTS = 6e6;             // the page keeps this many samples; the file keeps everything

  const st = {
    mode: 'live', title: '', meta: [], heading: '',
    live: false, bluetooth: false, why: '', rates: [], sources: [], openSrc: {},
    rec: 'idle', name: 'log', file: '', started: 0, samples: 0, errors: [], recMode: '', holdS: 0, fill: 0, held: 0, plan: null,
    series: new Map(), order: [], tMin: Infinity, tMax: -Infinity, total: 0,
    follow: true, win: 10, x0: 0, x1: 10, notes: [], points: [], empty: '',
  };

  /* ---- little DOM helpers ---- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return e;
  }
  const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
  const colorOf = (s) => css(SERIES_VARS[s.idx % SERIES_VARS.length]);
  const dashOf = (s) => (s.idx >= SERIES_VARS.length ? [6, 4] : []);   // a 9th series: the hues again, dashed

  function fmt(v, unit) {
    if (v === null || v === undefined || Number.isNaN(v)) return '-';
    const a = Math.abs(v);
    let s;
    if (a !== 0 && (a >= 1e6 || a < 1e-3)) s = v.toExponential(3);
    else s = String(+v.toPrecision(a >= 1000 ? 7 : 5));
    return unit ? s + ' ' + unit : s;
  }
  function fmtTime(t) {
    if (!Number.isFinite(t)) return '-';
    if (Math.abs(t) < 60) return (+t.toFixed(3)) + ' s';
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  /* ---- the layout ---- */
  const app = document.getElementById('app');
  const ui = {};
  function build() {
    ui.h1 = h('h1');
    ui.sub = h('span', { class: 'sub' });
    ui.name = h('input', { type: 'text', placeholder: 'name', title: 'Part of the file name: Data/<date> <time> <name>.csv', size: 12,
      onchange: () => vscode.postMessage({ type: 'name', name: ui.name.value }) });
    ui.recBtn = h('button', { class: 'btn primary', onclick: () => vscode.postMessage({ type: st.rec === 'recording' || st.rec === 'waiting' ? 'stop' : 'start' }) });
    ui.open = h('button', { class: 'btn', text: 'Open log...', title: 'Open a CSV from EVN Projects/Data', onclick: () => vscode.postMessage({ type: 'openFile' }) });
    ui.folder = h('button', { class: 'btn', text: 'Data folder', title: 'Show EVN Projects/Data', onclick: () => vscode.postMessage({ type: 'revealData' }) });
    const header = h('header', null, ui.h1, ui.sub, st.mode === 'live' ? [ui.name, ui.recBtn] : null, ui.open, ui.folder);

    ui.aside = h('aside');
    ui.srcNote = h('div', { class: 'note' });
    ui.srcList = h('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    ui.note = h('input', { type: 'text', placeholder: 'note, e.g. 10 cm', title: 'Written in the note column of the point' });
    ui.capBtn = h('button', { class: 'btn', text: 'Capture point', title: 'One reading of every ticked reading now, added to Data/<name> points <date>.csv',
      onclick: () => vscode.postMessage({ type: 'capture', note: ui.note.value }) });
    ui.note.addEventListener('keydown', (e) => { if (e.key === 'Enter') ui.capBtn.click(); });
    ui.points = h('div', { class: 'points' });
    ui.aside.append(ui.srcNote, ui.srcList,
      h('div', { class: 'capture' }, h('b', { text: 'One point at a time' }),
        h('div', { class: 'note', text: 'For an experiment by hand: set it up, type what it is, capture. Each point is a row per reading.' }),
        h('div', { class: 'row' }, ui.note, ui.capBtn), ui.points));

    ui.winSeg = h('span', { class: 'seg' }, WINDOWS.map(([s, label]) => h('button', { 'data-w': s, text: label, onclick: () => { st.win = s; st.follow = true; syncView(); draw(); tb(); } })));
    ui.followBtn = h('button', { class: 'btn', text: 'Follow', title: 'Keep the newest samples in view', onclick: () => { st.follow = !st.follow; syncView(); draw(); tb(); } });
    ui.hint = h('span', { class: 'hint', text: 'Drag to zoom · wheel to zoom · double-click for all' });
    ui.toolbar = h('div', { class: 'toolbar' }, ui.winSeg, ui.followBtn, ui.hint);
    ui.legend = h('div', { class: 'legend' });
    ui.canvas = h('canvas', { role: 'img', 'aria-label': 'the logged readings over time' });
    ui.tip = h('div', { class: 'tip' });
    ui.emptyBox = h('div', { class: 'empty' });
    ui.plot = h('div', { class: 'plot' }, ui.canvas, ui.tip, ui.emptyBox);
    ui.ov = h('canvas', { 'aria-label': 'the whole log, with the span in view' });
    ui.overview = h('div', { class: 'overview' }, ui.ov);
    ui.errors = h('div', { class: 'errors' });
    ui.statsTitle = h('h2');
    ui.table = h('table');
    ui.stats = h('div', { class: 'stats' }, ui.statsTitle, ui.table);
    const chart = h('section', { class: 'chart' }, ui.toolbar, ui.legend, ui.plot, ui.overview, ui.errors, ui.stats);
    app.append(header, h('div', { class: 'main' }, ui.aside, chart));
    wirePlot();
    wireOverview();
    new ResizeObserver(() => draw()).observe(ui.plot);
  }

  /* ---- header and sources ---- */
  function renderHeader() {
    if (st.mode === 'file') {
      ui.h1.textContent = st.title;
      const m = new Map(st.meta);
      ui.sub.textContent = [m.get('started') ? 'started ' + m.get('started').replace('T', ' ').replace(/\.\d+/, '') : '', m.get('board') || '', st.total ? st.total.toLocaleString() + ' values' : ''].filter(Boolean).join(' · ');
      ui.sub.title = st.meta.map(([k, v]) => k + ': ' + v).join('\n');
      return;
    }
    ui.h1.textContent = 'Data logger';
    const rec = st.rec === 'recording';
    const busy = ['starting', 'stopping', 'fetching'].includes(st.rec);
    document.body.classList.toggle('recording', rec);
    if (document.activeElement !== ui.name) ui.name.value = st.name;
    ui.name.disabled = rec || busy || st.rec === 'waiting';
    ui.recBtn.textContent = '';
    ui.recBtn.className = 'btn ' + (rec ? 'rec' : 'primary');
    ui.recBtn.append(h('span', { class: 'dot' }), rec ? 'Stop' : ({ starting: 'Starting...', stopping: 'Stopping...', waiting: 'Discard...', fetching: 'Fetching...' })[st.rec] || 'Record');
    ui.recBtn.disabled = (!st.live && !rec && st.rec !== 'waiting') || busy;
    ui.recBtn.title = st.rec === 'waiting' ? 'Give up the samples held on the board' : '';
    ui.capBtn.disabled = !st.live || busy || st.rec === 'waiting';
    const s = Math.floor((Date.now() - st.started) / 1000);
    const clock = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    if (rec && st.recMode === 'hold') {
      ui.sub.textContent = 'Recording on the board ' + clock + ' · ' + Math.round(st.fill * 100) + ' % of its memory (' + st.holdS.toFixed(0) + ' s, then every second sample) · the chart is a preview; the samples come after Stop → ' + st.file;
    } else if (rec) {
      ui.sub.textContent = 'Recording ' + clock + ' · ' + st.samples.toLocaleString() + ' samples → ' + st.file;
    } else if (st.rec === 'waiting') {
      ui.sub.textContent = 'Stopped. ' + (st.held > 0 ? st.held.toLocaleString() + ' samples wait' : 'The samples wait') + ' on the board until every motor has stopped: the USB link carries no bulk data while a motor drives.';
    } else if (st.rec === 'fetching') {
      ui.sub.textContent = 'Fetching ' + st.held.toLocaleString() + ' samples from the board... ' + st.samples.toLocaleString();
    } else if (st.live) {
      const n = ticked();
      ui.sub.textContent = 'Board connected' + (st.bluetooth ? ' over Bluetooth' : '') + ' · ' + (n ? n + ' reading' + (n === 1 ? '' : 's') + ' ticked' : 'tick what to record on the left');
    } else {
      ui.sub.textContent = 'Not connected: ' + (st.why || 'the live console is off') + '. The logger reads the board through the live console.';
    }
    ui.errors.textContent = st.errors.length ? 'Readings that raised (logged as empty values): ' + st.errors.join(' · ') : '';
  }
  const ticked = () => st.sources.reduce((n, s) => n + s.readings.filter((r) => r.on).length, 0);

  function renderSources() {
    if (st.mode !== 'live') return;
    const rec = st.rec === 'recording';
    ui.srcNote.textContent = '';
    ui.srcNote.className = 'note';
    if (!st.live) { ui.srcNote.className = 'warn'; ui.srcNote.textContent = 'Connect the live console (the plug button on the Board view) to record: it needs the board idle, not running a program.'; }
    else if (rec) ui.srcNote.textContent = 'Changes apply to the next recording.';
    else {
      const p = st.plan;
      let how = '';
      if (p && p.load) {
        how = p.load <= p.budget
          ? ' These ' + p.load + ' values a second stream live, straight into the file.'
          : ' ' + p.load.toLocaleString() + ' values a second is more than the USB link carries live (' + p.budget + '): the board keeps them in its memory - about ' + Math.floor(p.holdS) + ' s at these rates, then every second sample (the rate halves, the recording goes on) - and they are fetched after Stop, once the motors are still. The chart shows a preview meanwhile.';
      }
      ui.srcNote.textContent = 'Tick what to record. "max" reads every millisecond or as fast as a sensor answers.' + (st.bluetooth ? ' Over Bluetooth each reading is held to 50 Hz.' : '') + how;
    }
    ui.srcList.textContent = '';
    for (const s of st.sources) {
      const on = s.readings.filter((r) => r.on).length;
      if (st.openSrc[s.id] === undefined) st.openSrc[s.id] = on > 0;
      const box = h('div', { class: 'src' + (st.openSrc[s.id] ? ' open' : '') + (on ? ' on' : '') });
      const head = h('div', { class: 'head', role: 'button', tabindex: 0, onclick: () => { st.openSrc[s.id] = !st.openSrc[s.id]; box.classList.toggle('open'); } },
        h('span', { class: 'chev', text: '›' }), h('span', { class: 'name', text: s.label }), h('span', { class: 'what', text: s.sub }), on ? h('span', { class: 'count', text: String(on) }) : null);
      head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); head.click(); } });
      const body = h('div', { class: 'body' });
      for (const r of s.readings) {
        const cb = h('input', { type: 'checkbox', checked: r.on, onchange: () => vscode.postMessage({ type: 'toggle', source: s.id, method: r.method, on: cb.checked }) });
        body.append(h('label', { class: 'rd', title: r.detail + (r.parts ? ' (' + r.parts.join(', ') + ')' : '') + (r.text ? ' - text: logged, not plotted' : '') },
          cb, h('span', { text: r.method + (r.parts ? ' (' + r.parts.join(', ') + ')' : '') }), h('span', { class: 'u', text: r.unit })));
      }
      const sel = h('select', { title: 'How often this source is read', onchange: () => vscode.postMessage({ type: 'rate', source: s.id, hz: Number(sel.value) }) },
        st.rates.map((hz) => h('option', { value: hz, selected: hz === s.hz, text: hz ? hz + ' Hz' : 'max' })));
      body.append(h('div', { class: 'rate' }, 'Rate', sel));
      box.append(head, body);
      ui.srcList.append(box);
    }
  }

  function renderPoints() {
    ui.points.textContent = '';
    for (const p of st.points.slice(-20).reverse()) {
      ui.points.append(h('div', { class: 'pt', title: p.file },
        h('b', { text: 'Point ' + p.n + (p.note ? ' - ' + p.note : '') }),
        h('div', { class: 'v', text: p.values.map((v) => v.label + ' ' + v.value + (v.unit && v.value !== '-' ? ' ' + v.unit : '')).join(' · ') })));
    }
  }

  /* ---- the data ---- */
  function addSeries(d) {
    if (st.series.has(d.key)) return;
    const s = { key: d.key, label: d.label, unit: d.unit || '', quantity: d.quantity || '', text: !!d.text, idx: st.order.length,
      on: !d.text, t: new Float64Array(1024), v: new Float64Array(1024), n: 0 };
    st.series.set(d.key, s);
    st.order.push(s);
  }
  function append(s, ts, vs) {
    const need = s.n + ts.length;
    if (need > s.t.length) {
      let cap = s.t.length;
      while (cap < need) cap *= 2;
      const t = new Float64Array(cap); t.set(s.t.subarray(0, s.n)); s.t = t;
      const v = new Float64Array(cap); v.set(s.v.subarray(0, s.n)); s.v = v;
    }
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      s.t[s.n] = t;
      s.v[s.n] = vs[i] === null ? NaN : vs[i];
      s.n++;
      if (t < st.tMin) st.tMin = t;
      if (t > st.tMax) st.tMax = t;
    }
    st.total += ts.length;
  }
  /** keep the page's memory bounded: drop the older half of every series (the file has them) */
  function trim() {
    if (st.total <= MAX_POINTS) return;
    let total = 0, tMin = Infinity;
    for (const s of st.order) {
      const k = Math.floor(s.n / 2);
      s.t.copyWithin(0, k, s.n); s.v.copyWithin(0, k, s.n); s.n -= k;
      total += s.n;
      if (s.n) tMin = Math.min(tMin, s.t[0]);
    }
    st.total = total; st.tMin = tMin;
  }
  function reset() {
    st.series.clear(); st.order = []; st.tMin = Infinity; st.tMax = -Infinity; st.total = 0; st.notes = []; st.empty = '';
    st.follow = true;
    renderLegend();
  }

  /** index of the first sample at or after t */
  function lower(s, t) {
    let lo = 0, hi = s.n;
    while (lo < hi) { const m = (lo + hi) >> 1; if (s.t[m] < t) lo = m + 1; else hi = m; }
    return lo;
  }

  function syncView() {
    if (!Number.isFinite(st.tMin)) { st.x0 = 0; st.x1 = st.win || 10; return; }
    if (st.follow) {
      if (st.win && (st.mode === 'live' || st.tMax - st.tMin > st.win)) {
        st.x1 = Math.max(st.tMax, st.tMin + st.win);
        st.x0 = st.x1 - st.win;
        if (st.mode === 'file') { st.x0 = st.tMin; st.x1 = st.tMin + st.win; }
      } else { st.x0 = st.tMin; st.x1 = st.tMax > st.tMin ? st.tMax : st.tMin + 1; }
    }
    if (st.x1 <= st.x0) st.x1 = st.x0 + 1e-3;
  }

  /* ---- the lanes ---- */
  function lanes() {
    const map = new Map();
    for (const s of st.order) {
      if (!s.on || s.text || !s.n) continue;
      const key = s.unit ? 'u:' + s.unit : 'q:' + s.quantity.split('.')[0];
      if (!map.has(key)) map.set(key, { title: s.unit || s.quantity.split('.')[0], series: [] });
      map.get(key).series.push(s);
    }
    return [...map.values()];
  }

  const M = { l: 62, r: 14, t: 6, b: 22, gap: 12 };
  let geo = null;                           // what the last draw laid out: for the pointer

  function niceStep(span, n) {
    const raw = span / Math.max(1, n);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }

  let pending = false;
  function draw() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; drawNow(); drawOverview(); scheduleStats(); });
  }

  function drawNow() {
    syncView();
    const c = ui.canvas, dpr = window.devicePixelRatio || 1;
    const W = ui.plot.clientWidth, H = ui.plot.clientHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const L = lanes();
    ui.emptyBox.textContent = L.length ? '' : (st.empty || (st.mode === 'live'
      ? (st.rec === 'recording' ? 'Waiting for the first samples...' : 'Tick readings on the left and press Record. The chart follows the recording; the file keeps every sample.')
      : 'Nothing to plot.'));
    ui.emptyBox.style.display = L.length ? 'none' : 'flex';
    geo = null;
    if (!L.length) return;
    const pw = W - M.l - M.r;
    const laneH = Math.max(60, (H - M.t - M.b - M.gap * (L.length - 1)) / L.length);
    const x0 = st.x0, x1 = st.x1;
    const X = (t) => M.l + (t - x0) / (x1 - x0) * pw;
    const ink = css('--text'), muted = css('--muted'), grid = css('--grid'), border = css('--border-strong'), bg = css('--bg');
    g.font = '11px ' + css('--font-ui');
    geo = { L, pw, laneH, X, x0, x1, H, W, lanes: [] };
    // time grid, shared
    const ts = niceStep(x1 - x0, Math.max(2, pw / 110));
    L.forEach((lane, li) => {
      const top = M.t + li * (laneH + M.gap), bot = top + laneH;
      let lo = Infinity, hi = -Infinity;
      for (const s of lane.series) {
        const i0 = Math.max(0, lower(s, x0) - 1), i1 = Math.min(s.n, lower(s, x1) + 1);
        for (let i = i0; i < i1; i++) { const v = s.v[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      }
      if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
      if (hi === lo) { const d = Math.abs(hi) * 0.05 || 1; lo -= d; hi += d; }
      const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
      const Y = (v) => bot - (v - lo) / (hi - lo) * laneH;
      geo.lanes.push({ top, bot, lo, hi, Y, lane });
      // frame and grid
      g.strokeStyle = grid; g.lineWidth = 1;
      const ys = niceStep(hi - lo, Math.max(3, laneH / 30));
      g.fillStyle = muted; g.textAlign = 'right'; g.textBaseline = 'middle';
      for (let v = Math.ceil(lo / ys) * ys; v <= hi; v += ys) {
        const y = Math.round(Y(v)) + 0.5;
        g.beginPath(); g.moveTo(M.l, y); g.lineTo(M.l + pw, y); g.stroke();
        g.fillText(fmt(Math.abs(v) < ys * 1e-6 ? 0 : v), M.l - 6, y);
      }
      for (let t = Math.ceil(x0 / ts) * ts; t <= x1; t += ts) {
        const x = Math.round(X(t)) + 0.5;
        g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke();
      }
      g.strokeStyle = border; g.strokeRect(M.l + 0.5, top + 0.5, pw - 1, laneH - 1);
      // notes (Capture point, a points file)
      g.save(); g.setLineDash([3, 3]); g.strokeStyle = muted;
      for (const n of st.notes) { if (n.t < x0 || n.t > x1) continue; const x = Math.round(X(n.t)) + 0.5; g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke(); }
      g.restore();
      // the series
      g.save();
      g.beginPath(); g.rect(M.l, top, pw, laneH); g.clip();
      for (const s of lane.series) drawSeries(g, s, X, Y, x0, x1, pw, bg);
      g.restore();
      // lane title: the unit (or the method), and the series in it
      g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = ink;
      g.font = '600 11px ' + css('--font-ui');
      const title = lane.title;
      const tw = g.measureText(title).width;
      g.fillStyle = bg; g.globalAlpha = 0.85; g.fillRect(M.l + 4, top + 3, tw + 8, 15); g.globalAlpha = 1;
      g.fillStyle = ink; g.fillText(title, M.l + 8, top + 4);
      g.font = '11px ' + css('--font-ui');
    });
    // time labels under the last lane
    const last = geo.lanes[geo.lanes.length - 1];
    g.fillStyle = muted; g.textAlign = 'center'; g.textBaseline = 'top';
    for (let t = Math.ceil(x0 / ts) * ts; t <= x1; t += ts) g.fillText(fmtTime(+t.toPrecision(12)), X(t), last.bot + 5);
    // selection being dragged
    if (drag && drag.kind === 'zoom') {
      g.fillStyle = css('--accent'); g.globalAlpha = 0.18;
      const a = Math.min(drag.x, drag.cx), b = Math.max(drag.x, drag.cx);
      g.fillRect(a, M.t, b - a, last.bot - M.t); g.globalAlpha = 1;
    }
    if (hover) drawHover(g);
  }

  function drawSeries(g, s, X, Y, x0, x1, pw, bg) {
    const i0 = Math.max(0, lower(s, x0) - 1), i1 = Math.min(s.n, lower(s, x1) + 1);
    const count = i1 - i0;
    if (count <= 0) return;
    const col = colorOf(s);
    g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = 'round'; g.lineCap = 'round'; g.setLineDash(dashOf(s));
    g.beginPath();
    let pen = false;
    if (count > pw * 2) {
      // one min/max pair per pixel column
      let col0 = -1, mn = 0, mx = 0, first = 0, lastV = 0;
      const flush = () => {
        if (col0 < 0) return;
        const x = M.l + col0 + 0.5;
        if (pen) g.lineTo(x, Y(first)); else { g.moveTo(x, Y(first)); pen = true; }
        g.lineTo(x, Y(mn)); g.lineTo(x, Y(mx)); g.lineTo(x, Y(lastV));
      };
      for (let i = i0; i < i1; i++) {
        const v = s.v[i];
        if (Number.isNaN(v)) { flush(); col0 = -1; pen = false; continue; }
        const c = Math.floor(X(s.t[i]) - M.l);
        if (c !== col0) { flush(); col0 = c; mn = mx = first = v; }
        if (v < mn) mn = v; if (v > mx) mx = v; lastV = v;
      }
      flush();
      g.lineWidth = 1.5;
      g.stroke();
    } else {
      for (let i = i0; i < i1; i++) {
        const v = s.v[i];
        if (Number.isNaN(v)) { pen = false; continue; }
        const x = X(s.t[i]), y = Y(v);
        if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; }
      }
      g.stroke();
      if (count <= 2 || (X(s.t[i1 - 1]) - X(s.t[i0])) / (count - 1) >= 14) {   // samples far apart (points): mark each one
        g.setLineDash([]);
        for (let i = i0; i < i1; i++) {
          const v = s.v[i];
          if (Number.isNaN(v)) continue;
          g.beginPath(); g.arc(X(s.t[i]), Y(v), 4, 0, Math.PI * 2);
          g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = bg; g.stroke();
        }
      }
    }
    g.setLineDash([]);
  }

  /* ---- hover: crosshair and the values under it ---- */
  let hover = null;                         // { x, y }
  function drawHover(g) {
    if (!geo) return;
    const t = geo.x0 + (hover.x - M.l) / geo.pw * (geo.x1 - geo.x0);
    if (hover.x < M.l || hover.x > M.l + geo.pw) { ui.tip.style.display = 'none'; return; }
    const top = geo.lanes[0].top, bot = geo.lanes[geo.lanes.length - 1].bot;
    g.strokeStyle = css('--muted'); g.lineWidth = 1;
    g.beginPath(); g.moveTo(Math.round(hover.x) + 0.5, top); g.lineTo(Math.round(hover.x) + 0.5, bot); g.stroke();
    ui.tip.textContent = '';
    ui.tip.append(h('div', { class: 't', text: fmtTime(t) }));
    const bg = css('--bg');
    for (const ln of geo.lanes) {
      for (const s of ln.lane.series) {
        let i = lower(s, t);
        if (i >= s.n || (i > 0 && Math.abs(s.t[i - 1] - t) < Math.abs(s.t[i] - t))) i--;
        if (i < 0) continue;
        const v = s.v[i];
        ui.tip.append(h('div', { class: 'r' }, h('span', { class: 'sw', style: 'background:' + colorOf(s) }), h('span', { text: s.label }), h('span', { class: 'val', text: fmt(v, s.unit) })));
        if (!Number.isNaN(v)) {
          g.beginPath(); g.arc(geo.X(s.t[i]), ln.Y(v), 4, 0, Math.PI * 2);
          g.fillStyle = colorOf(s); g.fill(); g.lineWidth = 2; g.strokeStyle = bg; g.stroke();
        }
      }
    }
    ui.tip.style.display = 'block';
    const tw = ui.tip.offsetWidth, th = ui.tip.offsetHeight;
    let x = hover.x + 14; if (x + tw > geo.W - 4) x = hover.x - tw - 14;
    let y = hover.y + 12; if (y + th > geo.H - 4) y = Math.max(4, geo.H - th - 4);
    ui.tip.style.left = x + 'px'; ui.tip.style.top = y + 'px';
  }

  /* ---- zoom and pan ---- */
  let drag = null;
  function tAt(x) { return st.x0 + (x - M.l) / Math.max(1, ui.plot.clientWidth - M.l - M.r) * (st.x1 - st.x0); }
  function setView(a, b) {
    const span = b - a;
    const all = Number.isFinite(st.tMin) ? Math.max(1, st.tMax - st.tMin) : 10;
    if (!(span > 1e-6) || span > all * 10) return;          // no zooming into nothing, or out to infinity
    st.follow = false; st.x0 = a; st.x1 = b; tb(); draw();
  }
  function wirePlot() {
    const c = ui.canvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('mousemove', (e) => {
      const p = pos(e);
      if (drag) { drag.cx = p.x; }
      hover = drag ? null : p;
      if (drag) ui.tip.style.display = 'none';
      draw();
    });
    c.addEventListener('mouseleave', () => { hover = null; ui.tip.style.display = 'none'; draw(); });
    c.addEventListener('mousedown', (e) => { if (e.button !== 0) return; const p = pos(e); drag = { kind: 'zoom', x: p.x, cx: p.x }; });
    window.addEventListener('mouseup', () => {
      if (!drag || drag.kind !== 'zoom') return;
      const a = Math.min(drag.x, drag.cx), b = Math.max(drag.x, drag.cx);
      drag = null;
      if (b - a > 5) setView(tAt(a), tAt(b)); else draw();
    });
    c.addEventListener('dblclick', () => { st.follow = true; st.win = st.mode === 'live' && st.rec === 'recording' ? (st.win || 0) : 0; syncView(); tb(); draw(); });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!Number.isFinite(st.tMin)) return;
      const p = pos(e);
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {        // pan
        const d = (e.shiftKey ? e.deltaY : e.deltaX) / Math.max(1, ui.plot.clientWidth) * (st.x1 - st.x0);
        setView(st.x0 + d, st.x1 + d);
        return;
      }
      const t = tAt(p.x), k = Math.exp(e.deltaY * 0.0015);
      setView(t - (t - st.x0) * k, t + (st.x1 - t) * k);
    }, { passive: false });
  }

  /* ---- the overview strip ---- */
  function drawOverview() {
    const c = ui.ov, dpr = window.devicePixelRatio || 1;
    const W = ui.overview.clientWidth, H = ui.overview.clientHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!Number.isFinite(st.tMin) || st.tMax <= st.tMin) return;
    const pw = W - M.l - M.r, a = st.tMin, b = st.tMax;
    const X = (t) => M.l + (t - a) / (b - a) * pw;
    g.globalAlpha = 0.4; g.lineWidth = 1;
    for (const s of st.order) {
      if (!s.on || s.text || !s.n) continue;
      let lo = Infinity, hi = -Infinity;
      const step = Math.max(1, Math.floor(s.n / (pw * 2)));
      for (let i = 0; i < s.n; i += step) { const v = s.v[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (!Number.isFinite(lo)) continue;
      if (hi === lo) { hi += 1; lo -= 1; }
      g.strokeStyle = colorOf(s); g.beginPath();
      let pen = false;
      for (let i = 0; i < s.n; i += step) {
        const v = s.v[i];
        if (Number.isNaN(v)) { pen = false; continue; }
        const x = X(s.t[i]), y = H - 5 - (v - lo) / (hi - lo) * (H - 10);
        if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; }
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    const va = Math.max(M.l, X(st.x0)), vb = Math.min(M.l + pw, X(st.x1));
    g.fillStyle = css('--bg'); g.globalAlpha = 0.6;
    g.fillRect(M.l, 0, va - M.l, H); g.fillRect(vb, 0, M.l + pw - vb, H); g.globalAlpha = 1;
    g.strokeStyle = css('--accent'); g.lineWidth = 2; g.strokeRect(va, 1, Math.max(2, vb - va), H - 2);
    g.fillStyle = css('--muted'); g.font = '11px ' + css('--font-ui'); g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillText(fmtTime(b - a), M.l - 6, H / 2);
  }
  function wireOverview() {
    const c = ui.ov;
    const tOf = (e) => {
      const r = c.getBoundingClientRect();
      const pw = r.width - M.l - M.r;
      return st.tMin + (e.clientX - r.left - M.l) / Math.max(1, pw) * (st.tMax - st.tMin);
    };
    let pan = null;
    c.addEventListener('mousedown', (e) => {
      if (!Number.isFinite(st.tMin)) return;
      const t = tOf(e), span = st.x1 - st.x0;
      if (t < st.x0 || t > st.x1) setView(t - span / 2, t + span / 2);
      pan = { t, x0: st.x0, x1: st.x1 };
      c.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => { if (!pan) return; const d = tOf(e) - pan.t; setView(pan.x0 + d, pan.x1 + d); });
    window.addEventListener('mouseup', () => { pan = null; c.style.cursor = ''; });
  }

  /* ---- legend and statistics ---- */
  function renderLegend() {
    ui.legend.textContent = '';
    for (const s of st.order) {
      const chip = h('span', { class: 'chip' + (s.text ? ' text' : s.on ? '' : ' off'), role: 'button', tabindex: 0, title: s.text ? 'text: logged in the file, not plotted' : 'show / hide',
        onclick: () => { if (s.text) return; s.on = !s.on; renderLegend(); draw(); } },
        h('span', { class: 'sw', style: 'background:' + colorOf(s) + (s.idx >= SERIES_VARS.length ? ';background-image:repeating-linear-gradient(90deg,transparent 0 4px,var(--bg) 4px 6px)' : '') }),
        s.label + (s.unit ? ' (' + s.unit + ')' : '') + (s.text ? ' - text' : ''));
      chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chip.click(); } });
      ui.legend.append(chip);
    }
  }

  let statsTimer = null;
  function scheduleStats() {
    if (statsTimer) return;
    statsTimer = setTimeout(() => { statsTimer = null; renderStats(); }, st.rec === 'recording' ? 400 : 60);
  }
  function renderStats() {
    const a = st.x0, b = st.x1;
    ui.statsTitle.textContent = '';
    ui.statsTitle.append('Statistics ', h('span', { text: Number.isFinite(st.tMin) ? 'of ' + fmtTime(a) + ' to ' + fmtTime(b) + ' (the span in view)' : '' }));
    ui.table.textContent = '';
    if (!st.order.length) return;
    ui.table.append(h('tr', null, ['reading', 'n', 'rate', 'min', 'max', 'mean', 'std dev', 'change', 'slope', 'last'].map((x) => h('th', { text: x }))));
    for (const s of st.order) {
      const i0 = lower(s, a), i1 = lower(s, b + 1e-9);
      let n = 0, sum = 0, sq = 0, mn = Infinity, mx = -Infinity, st_ = 0, stt = 0, sv = 0, stv = 0, first = NaN, lastV = NaN, t0 = NaN, t1 = NaN;
      const tm = (a + b) / 2;
      for (let i = i0; i < i1; i++) {
        const v = s.v[i];
        if (Number.isNaN(v)) continue;
        const t = s.t[i] - tm;
        n++; sum += v; sq += v * v; if (v < mn) mn = v; if (v > mx) mx = v;
        st_ += t; stt += t * t; sv += v; stv += t * v;
        if (Number.isNaN(first)) { first = v; t0 = s.t[i]; }
        lastV = v; t1 = s.t[i];
      }
      const count = i1 - i0;
      const mean = n ? sum / n : NaN;
      const sd = n > 1 ? Math.sqrt(Math.max(0, (sq - n * mean * mean) / (n - 1))) : NaN;
      const den = n * stt - st_ * st_;
      const slope = n > 1 && den > 0 ? (n * stv - st_ * sv) / den : NaN;
      const rate = count > 1 && t1 > t0 ? (count - 1) / (s.t[i1 - 1] - s.t[i0]) : NaN;
      const u = s.unit;
      ui.table.append(h('tr', s.on ? null : { style: 'opacity:0.55' },
        h('td', null, h('span', { class: 'sw', style: 'background:' + colorOf(s) }), s.label + (u ? ' (' + u + ')' : '')),
        h('td', { text: count.toLocaleString() }),
        h('td', { text: Number.isFinite(rate) ? fmt(rate, 'Hz') : '-' }),
        s.text ? h('td', { colspan: 7, text: 'text - in the file' }) : [
          h('td', { text: fmt(n ? mn : NaN) }), h('td', { text: fmt(n ? mx : NaN) }), h('td', { text: fmt(mean) }), h('td', { text: fmt(sd) }),
          h('td', { text: fmt(lastV - first) }), h('td', { text: Number.isFinite(slope) ? fmt(slope, u ? u + '/s' : '/s') : '-' }), h('td', { text: fmt(lastV) }),
        ]));
    }
  }

  function tb() {
    for (const btn of ui.winSeg.children) btn.classList.toggle('on', st.follow && Number(btn.dataset.w) === st.win);
    ui.followBtn.style.display = st.mode === 'live' ? '' : 'none';
    ui.followBtn.classList.toggle('primary', st.follow && st.mode === 'live');
  }

  /* ---- messages ---- */
  window.addEventListener('message', (ev) => {
    const m = ev.data || {};
    if (m.type !== 'init' && !ui.h1) return;          // nothing is drawn before init
    switch (m.type) {
      case 'init':
        st.mode = m.mode; st.title = m.title || ''; st.meta = m.meta || []; st.heading = m.heading || '';
        if (st.mode === 'file') { st.win = 0; }
        if (!ui.h1) build();
        renderHeader(); tb(); draw();
        break;
      case 'sources':
        st.live = !!m.live; st.bluetooth = !!m.bluetooth; st.why = m.why || ''; st.rates = m.rates || []; st.sources = m.sources || []; st.plan = m.plan || null;
        renderSources(); renderHeader();
        break;
      case 'state':
        st.rec = m.state; st.name = m.name || st.name; st.file = m.file || ''; st.started = m.started || 0; st.samples = m.samples || 0; st.errors = m.errors || [];
        st.recMode = m.mode || ''; st.holdS = m.holdS || 0; st.fill = m.fill || 0; st.held = m.held || 0;
        renderHeader(); renderSources();
        break;
      case 'series':
        for (const d of m.defs || []) addSeries(d);
        renderLegend(); draw();
        break;
      case 'data':
        for (const k in m.d || {}) { const s = st.series.get(k); if (s) append(s, m.d[k][0], m.d[k][1]); }
        if (typeof m.samples === 'number') st.samples = m.samples;
        trim();
        if (st.mode === 'file') renderHeader();
        draw();
        break;
      case 'reset': reset(); draw(); break;
      case 'note': st.notes.push({ t: m.t, note: m.note }); draw(); break;
      case 'point': st.points.push(m); renderPoints(); break;
      case 'empty': st.empty = m.why || ''; draw(); break;
    }
  });
  setInterval(() => { if (st.rec === 'recording' || st.rec === 'fetching') renderHeader(); }, 1000);
  vscode.postMessage({ type: 'ready' });
})();
