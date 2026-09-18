/* The Console view's page: a transcript and a prompt. Plain JavaScript on purpose (tsconfig
 * compiles src/ only), and it never builds HTML from board text: every line is a text node.
 *
 * The extension host owns the transcript; this file only draws what it is sent and posts back
 * what the user types. */
(function () {
    'use strict';

    var vscode = acquireVsCodeApi();
    var transcript = document.getElementById('transcript');
    var entry = document.getElementById('entry');
    var input = document.getElementById('input');
    var hint = document.getElementById('hint');
    var chartsEl = document.getElementById('charts');

    var MAX_LINES = 400;          // the same bound the extension keeps
    var MAX_ROWS = 6;             // how far the input grows before it scrolls
    var MAX_SAMPLES = 240;        // the same ring the extension keeps: a minute at 4 Hz
    var MAX_SERIES = 4;           // one colour each
    var GUTTER = 38;              // room on the right for the two scale numbers
    var SERIES_VARS = [
        '--vscode-charts-blue', '--vscode-charts-green',
        '--vscode-charts-orange', '--vscode-charts-purple',
    ];
    // used only if the theme defines none of the chart colours (they are standard, but a canvas
    // with no stroke colour would draw nothing at all, which looks like a bug)
    var SERIES_FALLBACK = ['#3794ff', '#89d185', '#d18616', '#b180d7'];

    var live = false;
    var running = false;
    var placeholder = '';
    var history = [];             // most recent first
    var histIndex = -1;           // -1 = the line being typed
    var draft = '';               // what was typed before the arrows walked away from it
    var stuck = true;             // auto-scroll, unless the user scrolled up
    var charts = {};              // port -> the chart of that watched device
    var order = [];               // the ports in the order their charts are stacked
    var dirty = {};               // the ports whose chart has to be redrawn on the next frame
    var frame = 0;                // the pending animation frame, 0 = none

    /* ---- the transcript ------------------------------------------------------------------ */

    function atBottom() {
        return transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 24;
    }

    function scrollIfStuck() {
        if (stuck) { transcript.scrollTop = transcript.scrollHeight; }
    }

    function addLine(kind, text) {
        var div = document.createElement('div');
        div.className = 'line ' + (kind || 'out');
        // a blank line still needs a box, otherwise the spacing of a traceback collapses
        div.textContent = text === '' ? ' ' : text;
        transcript.appendChild(div);
        while (transcript.childElementCount > MAX_LINES) {
            transcript.removeChild(transcript.firstElementChild);
        }
        scrollIfStuck();
    }

    function reset(lines) {
        transcript.textContent = '';
        for (var i = 0; i < lines.length; i++) { addLine(lines[i].kind, lines[i].text); }
        stuck = true;
        transcript.scrollTop = transcript.scrollHeight;
    }

    transcript.addEventListener('scroll', function () { stuck = atBottom(); });

    /* ---- the prompt ---------------------------------------------------------------------- */

    /** Grow the input with its content, up to MAX_ROWS rows; after that it scrolls. */
    function autosize() {
        var lineHeight = parseFloat(window.getComputedStyle(input).lineHeight) || 16;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, Math.round(lineHeight * MAX_ROWS)) + 'px';
    }

    function applyEnabled() {
        var on = live && !running;
        input.disabled = !on;
        input.placeholder = running ? 'running...' : placeholder;
        entry.classList.toggle('disabled', !on);
    }

    function send() {
        if (!live || running) { return; }
        var code = input.value.replace(/\s+$/, '');
        if (!code.trim()) { return; }
        vscode.postMessage({ type: 'run', code: code });
        input.value = '';
        histIndex = -1;
        draft = '';
        autosize();
        stuck = true;
    }

    /** Walk the history. `step` is +1 for older (Up) and -1 for newer (Down). */
    function walk(step) {
        if (!history.length) { return; }
        if (histIndex === -1 && step > 0) { draft = input.value; }
        var next = histIndex + step;
        if (next < -1) { next = -1; }
        if (next >= history.length) { next = history.length - 1; }
        histIndex = next;
        input.value = histIndex === -1 ? draft : history[histIndex];
        autosize();
        var end = input.value.length;
        input.setSelectionRange(end, end);
    }

    /** The arrows only walk the history when they would not move inside a block being typed. */
    function atFirstLine() {
        return input.value.lastIndexOf('\n', Math.max(0, input.selectionStart - 1)) < 0;
    }

    function atLastLine() {
        return input.value.indexOf('\n', input.selectionStart) < 0;
    }

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
            return;
        }
        if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            vscode.postMessage({ type: 'clear' });
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            input.value = '';
            histIndex = -1;
            draft = '';
            autosize();
            return;
        }
        if (e.key === 'ArrowUp' && atFirstLine()) {
            e.preventDefault();
            walk(1);
            return;
        }
        if (e.key === 'ArrowDown' && atLastLine()) {
            e.preventDefault();
            walk(-1);
        }
    });

    input.addEventListener('input', function () {
        histIndex = -1;
        autosize();
    });
    input.addEventListener('focus', function () { entry.classList.add('focused'); });
    input.addEventListener('blur', function () { entry.classList.remove('focused'); });

    /* ---- the strip charts ----------------------------------------------------------------
     * One canvas per device that is being read live. The extension host owns the rings and
     * sends them whole ('charts', and in every 'reset') or one point at a time ('sample'); this
     * file only scales and draws, and never puts board text anywhere but in a text node. */

    /** A value in as few characters as it can be read in: 123, 12.5, 0.08. */
    function numText(n) {
        if (typeof n !== 'number' || !isFinite(n)) { return '?'; }
        var a = Math.abs(n);
        var s = a >= 100 ? n.toFixed(0) : (a >= 10 ? n.toFixed(1) : n.toFixed(2));
        if (s.indexOf('.') >= 0) { s = s.replace(/0+$/, '').replace(/\.$/, ''); }
        return s;
    }

    /** The last meaningful line of a board exception, which is the one that says what happened. */
    function lastLine(text) {
        var parts = String(text).split(/\r?\n/);
        for (var i = parts.length - 1; i >= 0; i--) {
            if (parts[i].trim()) { return parts[i].trim(); }
        }
        return String(text);
    }

    /** The four series colours of the current theme, read once per frame. */
    function palette() {
        var style = window.getComputedStyle(document.documentElement);
        var out = [];
        for (var i = 0; i < SERIES_VARS.length; i++) {
            var c = (style.getPropertyValue(SERIES_VARS[i]) || '').trim();
            out.push(c || SERIES_FALLBACK[i]);
        }
        return out;
    }

    function axisColor() {
        var style = window.getComputedStyle(document.documentElement);
        return (style.getPropertyValue('--vscode-descriptionForeground') || '').trim() || '#888';
    }

    function ensureChart(port) {
        if (charts[port]) { return charts[port]; }
        var root = document.createElement('div');
        root.className = 'chart';
        var head = document.createElement('div');
        head.className = 'chart-head';
        var canvas = document.createElement('canvas');
        canvas.className = 'chart-canvas';
        root.appendChild(head);
        root.appendChild(canvas);
        chartsEl.appendChild(root);
        charts[port] = { port: port, m: '', e: '', samples: [], head: head, canvas: canvas, root: root };
        order.push(port);
        return charts[port];
    }

    function removeChart(port) {
        var c = charts[port];
        if (!c) { return; }
        if (c.root.parentNode) { c.root.parentNode.removeChild(c.root); }
        delete charts[port];
        var i = order.indexOf(port);
        if (i >= 0) { order.splice(i, 1); }
    }

    /** The whole strip, as the extension holds it: ports that are gone lose their canvas. */
    function setCharts(list) {
        var seen = {};
        for (var i = 0; i < list.length; i++) {
            var item = list[i] || {};
            var port = String(item.port);
            seen[port] = true;
            var c = ensureChart(port);
            c.m = String(item.m || '');
            c.e = item.e ? String(item.e) : '';
            c.samples = Array.isArray(item.samples) ? item.samples.slice(-MAX_SAMPLES) : [];
            markDirty(port);
        }
        var known = order.slice();
        for (var j = 0; j < known.length; j++) {
            if (!seen[known[j]]) { removeChart(known[j]); }
        }
    }

    /** One telemetry point. A read that raised adds no point: the curve stands still and the
     *  header turns red, which is what a sensor that stopped answering looks like. */
    function addSample(port, m, t, values, e) {
        var c = ensureChart(port);
        if (m) { c.m = String(m); }
        c.e = e ? String(e) : '';
        if (!c.e && values.length) {
            c.samples.push({ t: t, values: values });
            if (c.samples.length > MAX_SAMPLES) {
                c.samples.splice(0, c.samples.length - MAX_SAMPLES);
            }
        }
        markDirty(port);
    }

    /** At most one redraw per animation frame, however fast the telemetry arrives. */
    function markDirty(port) {
        dirty[port] = true;
        if (frame) { return; }
        frame = window.requestAnimationFrame(function () {
            frame = 0;
            var ports = Object.keys(dirty);
            dirty = {};
            if (!ports.length) { return; }
            var colors = palette();
            var axis = axisColor();
            for (var i = 0; i < ports.length; i++) { draw(charts[ports[i]], colors, axis); }
        });
    }

    /** The header: `port 5 \u00b7 lux \u00b7 123.4`, or the exception in the error colour. */
    function drawHead(c) {
        c.head.textContent = '';
        var title = document.createElement('span');
        title.className = 'chart-title';
        title.textContent = 'port ' + c.port + (c.m ? ' \u00b7 ' + c.m : '');
        c.head.appendChild(title);
        var text = '';
        if (c.e) {
            text = lastLine(c.e);
        } else if (c.samples.length) {
            var last = c.samples[c.samples.length - 1].values || [];
            var parts = [];
            for (var i = 0; i < last.length && i < MAX_SERIES; i++) { parts.push(numText(last[i])); }
            text = parts.join(', ');
        }
        if (!text) { return; }
        var sep = document.createElement('span');
        sep.className = 'chart-sep';
        sep.textContent = '\u00b7';
        c.head.appendChild(sep);
        var value = document.createElement('span');
        value.className = c.e ? 'chart-value err' : 'chart-value';
        value.textContent = text;
        c.head.appendChild(value);
    }

    function draw(c, colors, axis) {
        if (!c) { return; }
        drawHead(c);
        var canvas = c.canvas;
        var w = canvas.clientWidth;
        var h = canvas.clientHeight;
        // a collapsed or hidden strip has no size to draw on; the header is already right
        if (!w || !h) { return; }
        var dpr = window.devicePixelRatio || 1;
        var pw = Math.max(1, Math.round(w * dpr));
        var ph = Math.max(1, Math.round(h * dpr));
        if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
        var ctx = canvas.getContext('2d');
        if (!ctx) { return; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        var samples = c.samples;
        if (!samples.length) { return; }
        var i, s, v;
        var series = 0;
        var min = Infinity;
        var max = -Infinity;
        for (i = 0; i < samples.length; i++) {
            var vals = samples[i].values || [];
            if (vals.length > series) { series = Math.min(vals.length, MAX_SERIES); }
            for (s = 0; s < vals.length && s < MAX_SERIES; s++) {
                v = vals[s];
                if (typeof v !== 'number' || !isFinite(v)) { continue; }
                if (v < min) { min = v; }
                if (v > max) { max = v; }
            }
        }
        // every point was a NaN or the ring holds only empty points: nothing to scale to
        if (!series || !isFinite(min) || !isFinite(max)) { return; }
        if (max - min < 1e-9) {
            // a flat line still needs a window, or every point would land on one row
            var flat = Math.abs(max) > 1 ? Math.abs(max) * 0.05 : 0.5;
            min -= flat;
            max += flat;
        } else {
            var margin = (max - min) * 0.08;
            min -= margin;
            max += margin;
        }

        var pad = 3;
        var plot = Math.max(8, w - GUTTER);
        var span = samples.length - 1;
        var xOf = function (k) { return span > 0 ? (k / span) * (plot - 1) + 0.5 : plot / 2; };
        var yOf = function (n) { return h - pad - ((n - min) / (max - min)) * (h - 2 * pad); };

        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        for (s = 0; s < series; s++) {
            ctx.strokeStyle = colors[s] || SERIES_FALLBACK[s];
            ctx.beginPath();
            var started = false;
            var points = 0;
            var lastX = 0;
            var lastY = 0;
            for (i = 0; i < samples.length; i++) {
                v = (samples[i].values || [])[s];
                if (typeof v !== 'number' || !isFinite(v)) { started = false; continue; }
                lastX = xOf(i);
                lastY = yOf(v);
                points++;
                if (started) { ctx.lineTo(lastX, lastY); } else { ctx.moveTo(lastX, lastY); started = true; }
            }
            ctx.stroke();
            // one point is a dot: a path of a single moveTo strokes nothing
            if (points === 1) {
                ctx.fillStyle = colors[s] || SERIES_FALLBACK[s];
                ctx.fillRect(lastX - 1, lastY - 1, 2, 2);
            }
        }

        // the scale, so a curve without numbers is not a decoration
        ctx.fillStyle = axis;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(numText(max), plot + 4, 0);
        ctx.textBaseline = 'bottom';
        ctx.fillText(numText(min), plot + 4, h);
    }

    /* ---- the wire ------------------------------------------------------------------------ */

    window.addEventListener('message', function (event) {
        var msg = event.data;
        if (!msg) { return; }
        switch (msg.type) {
            case 'reset':
                reset(Array.isArray(msg.lines) ? msg.lines : []);
                if (Array.isArray(msg.charts)) { setCharts(msg.charts); }
                break;
            case 'charts':
                setCharts(Array.isArray(msg.charts) ? msg.charts : []);
                break;
            case 'sample':
                addSample(String(msg.port), msg.m, msg.t,
                    Array.isArray(msg.values) ? msg.values : [], msg.e);
                break;
            case 'line':
                addLine(msg.kind, String(msg.text));
                break;
            case 'state':
                live = !!msg.live;
                placeholder = String(msg.placeholder || '');
                hint.textContent = String(msg.hint || '');
                applyEnabled();
                break;
            case 'history':
                history = Array.isArray(msg.items) ? msg.items : [];
                histIndex = -1;
                break;
            case 'busy':
                running = !!msg.running;
                applyEnabled();
                // the line finished: give the prompt the caret back, but only if the user is here
                if (!running && document.hasFocus()) { input.focus(); }
                break;
        }
    });

    autosize();
    applyEnabled();
    vscode.postMessage({ type: 'ready' });
}());
