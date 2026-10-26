/* The Simulator panel (src/sim/simPanel.ts): the simulated board's world, drawn, and the robot's configurator.
 *
 * The board itself runs in a Web Worker started here (dist/sim/worker.js: the physics and MicroPython). This page
 *   - relays between the extension (which talks to the board as it would over a serial port) and the worker,
 *   - draws what the worker's snapshots say (the course, the robot, its sensors, the trail),
 *   - lets the robot be picked up and put down, the course chosen, and the hardware configured;
 *   - holds the map builder: tiles of the Rescue Line tile library (cfg.tiles, src/sim/engine/rescueTiles.json) placed
 *     and turned on a 300 mm grid, the line from the start checked by the extension (src/sim/engine/tiles.ts), the
 *     maps saved per user and driven as courses.
 * A program blocks the worker while it runs, so Ctrl-C goes through shared memory when the page has it, else the
 * worker is ended and a new one started from the last snapshot (the program is over either way).
 */
(function () {
    'use strict';
    const vscode = acquireVsCodeApi();
    const cfg = JSON.parse(document.getElementById('cfg').textContent);
    const $ = (s, el = document) => el.querySelector(s);
    const el = (tag, attrs = {}, ...kids) => {
        const e = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'class') { e.className = v; } else if (k.startsWith('on')) { e.addEventListener(k.slice(2), v); } else if (v !== undefined && v !== null) { e.setAttribute(k, v); }
        }
        for (const k of kids) { if (k !== null && k !== undefined) { e.append(k.nodeType ? k : String(k)); } }
        return e;
    };

    /* ---- state ------------------------------------------------------------------------------------ */
    let hw = cfg.hw;
    let courseId = cfg.course;
    let speed = cfg.speed || 1;
    let worker;
    let ctl;                    // Int32Array over a SharedArrayBuffer (src/sim/engine/runtime.ts CTL_BYTES): [0] Ctrl-C,
                                // [1] Python's interrupt buffer, [2] the Button, [3] the Speed's change count; the
                                // Float64 at byte 16 the Speed
    let live = false;           // the worker hands its event loop turns mid-run (JS Promise Integration): the Button,
                                // the Speed, the Course and Ctrl-C reach a running program as messages
    let stopWatch;              // Ctrl-C by message: the worker is ended if the program does not take it in
    const STOP_WAIT_MS = 3000;
    let ready = false;
    let running;                // the id of the exec the worker is running
    const pending = new Map();  // every exec sent and not yet answered: id -> source (a restart sends them again)
    let snap;
    let geom;
    let led = false;
    let files = {};             // the Board view's uploads (the extension's 'files' message: never a program's file)
    let written = {};           // what programs wrote (bytes) or removed (null) at the top of the flash, as the worker
                                // posted it: a worker started again gets it back with the uploads (vm.seed)
    let restarted = false;      // a worker of this panel was ended and started again (Stop)
    let assets;
    const trail = [];
    let follow = false;
    let starting;
    // the map builder
    const LIB = new Map((cfg.tiles || []).map((t) => [t.id, t]));
    let maps = cfg.maps || [];
    let draft = { version: 1, name: '', tiles: [] };
    let dirty = false;
    let pick;               // the library tile being placed (its id), or undefined
    let pickRot = 0;
    let sel;                // the selected tile of the draft (its index)
    let hover;              // the grid cell under the mouse { col, row }
    let startMode = false;  // the next click sets the start
    let greenMode = false;  // clicks put green markers down (and take them up)
    let pickObj;            // the kind of object being placed: 'obstacle', 'bump', 'debris', or undefined
    let selObj;             // the selected object of the draft (its index)
    let hoverPt;            // the point under the mouse (mm), in the map builder
    let mapInfo;            // what the extension says the draft makes { ok, report, line, start, error }
    let mapSeq = 0;
    let checkTimer;

    /* ---- the worker -------------------------------------------------------------------------------- */
    async function loadAssets() {
        if (assets) { return assets; }
        const get = (url, how) => fetch(url).then((r) => { if (!r.ok) { throw new Error(`${url.split('/').pop()}: ${r.status}`); } return r[how](); });
        const py = cfg.pyodideUrl;
        const [w, evn, boot, asm, wasm, stdlib, lock] = await Promise.all([
            get(cfg.workerUrl, 'text'), get(cfg.evnUrl, 'text'), get(cfg.bootUrl, 'text'),
            get(py + 'pyodide.asm.js', 'text'), get(py + 'pyodide.asm.wasm', 'arrayBuffer'),
            get(py + 'python_stdlib.zip', 'arrayBuffer'), get(py + 'pyodide-lock.json', 'text'),
        ]);
        assets = { worker: URL.createObjectURL(new Blob([w], { type: 'text/javascript' })), evn, boot, pyodide: { asm, wasm, stdlib, lock } };
        return assets;
    }

    function start(state) {
        ready = false;
        starting = (async () => {
            const a = await loadAssets();
            const shared = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated;
            ctl = shared ? new Int32Array(new SharedArrayBuffer(32)) : undefined;
            if (ctl) { new Float64Array(ctl.buffer, 16, 1)[0] = speed; }
            worker = new Worker(a.worker, { type: 'module', name: 'EVN simulator' });
            worker.onmessage = (ev) => onWorker(ev.data);
            worker.onerror = (ev) => { showNote(`The simulator stopped: ${ev.message || 'an error in the worker'}`, true); setStatus('err', 'stopped'); };
            const p = a.pyodide;
            worker.postMessage({ type: 'init', pyodide: { asm: p.asm, wasm: p.wasm.slice(0), stdlib: p.stdlib.slice(0), lock: p.lock }, evn: a.evn, boot: a.boot,
                version: cfg.version, hw, course: courseId, map: mapOf(courseId), ctl: ctl ? ctl.buffer : undefined, state, files, written, speed });
            while (outbox.length) { worker.postMessage(outbox.shift()); }
        })().catch((e) => { showNote(`The simulator could not start: ${e && e.message || e}`, true); setStatus('err', 'not started'); });
    }

    /** what comes for the board while its worker is (re)starting waits here, in order: the worker queues it behind
     *  its own start (the coast after a stopped run, the next Run) */
    const outbox = [];
    function toWorker(m) { if (worker) { worker.postMessage(m); } else { outbox.push(m); } }

    function onWorker(m) {
        switch (m.type) {
            case 'ready':
                ready = true;
                live = !!m.live;
                $('#loading').hidden = true;
                setStatus('', 'idle');
                if (m.snap) { onSnap(m.snap); }
                vscode.postMessage({ type: 'ready', shared: !!m.sab, live });
                return;
            case 'geom': geom = m.geom; trail.length = 0; if (!userView) { fit(); } if (v3) { v3.setGeom(geom); } draw(); return;
            case 'busy': running = m.id; setStatus('run', 'running a program'); return;
            case 'out': vscode.postMessage({ type: 'out', id: m.id, text: m.text }); return;
            case 'interrupting': clearTimeout(stopWatch); return;
            case 'written':
                // a program's files: kept for a worker started again, and to the Board view (SimWorld.programFiles)
                for (const [n, b] of Object.entries(m.files || {})) { written[n] = b; }
                vscode.postMessage({ type: 'written', files: m.files || {} });
                return;
            case 'done':
                if (running === m.id) { running = undefined; clearTimeout(stopWatch); }
                pending.delete(m.id);
                if (!pending.size) { setStatus('', 'idle'); }
                if (m.snap) { onSnap(m.snap); }
                vscode.postMessage({ type: 'done', id: m.id, err: m.err || '' });
                return;
            case 'snap': onSnap(m.snap); return;
            case 'led': led = !!m.on; draw(); return;
            case 'error':
                showNote(`Simulator: ${m.message}`, true);
                vscode.postMessage({ type: 'error', id: m.id, message: m.message });
                return;
        }
    }

    /** Ctrl-C: through shared memory, else as a message the running program takes in at its next turn (live), else -
     *  or when it takes no turn within STOP_WAIT_MS - end the worker (the program with it) and start again from here */
    function interrupt() {
        if (running === undefined) { toWorker({ type: 'coast' }); return; }
        if (ctl) {
            // [0]: the runtime's flag (a wait() wakes on it), set first; [1]: Python's interrupt buffer (2 = SIGINT),
            // which stops pure Python too, a loop that never calls the board. One press is one KeyboardInterrupt:
            // whichever takes it clears [0]
            Atomics.store(ctl, 0, 1); Atomics.store(ctl, 1, 2); Atomics.notify(ctl, 0);
            return;
        }
        if (live) {
            const id = running;
            toWorker({ type: 'interrupt' });
            // the worker answers `interrupting` once it has the press; a program that never hands it a turn (pure
            // Python) is ended with the worker
            clearTimeout(stopWatch);
            stopWatch = setTimeout(() => { if (running === id) { restart(); } }, STOP_WAIT_MS);
            return;
        }
        restart();
    }

    /** the last resort: end the worker and the program with it, and start a new one from the last snapshot */
    function restart() {
        const id = running;
        running = undefined;
        pending.delete(id);
        try { worker.terminate(); } catch { /* gone */ }
        worker = undefined;
        vscode.postMessage({ type: 'done', id, err: 'Traceback (most recent call last):\n  File "<stdin>", in <module>\nKeyboardInterrupt: \n' });
        setStatus('', 'restarting');
        restarted = true;
        // what was queued behind it went down with the worker: the new one runs it
        for (const [pid, source] of pending) { outbox.push({ type: 'exec', id: pid, source }); }
        start(snap ? { pose: snap.pose, angles: snap.motors.map((x) => x.angle) } : undefined);
    }

    /* ---- the extension ------------------------------------------------------------------------------ */
    window.addEventListener('message', (ev) => {
        const m = ev.data;
        switch (m.type) {
            case 'exec':
                pending.set(m.id, m.source);
                setStatus('run', 'running a program');
                toWorker({ type: 'exec', id: m.id, source: m.source });
                return;
            case 'reset': toWorker({ type: 'reset', id: m.id }); return;
            case 'interrupt': interrupt(); return;
            case 'motor': toWorker(m); return;
            case 'coast': toWorker({ type: 'coast' }); return;
            case 'files':
                files = m.files || {};
                // `written` comes with the board's files when the panel opens again (ports.ts): this panel's first
                // worker takes them as its flash. A worker started again has them from here already, and the execs
                // queued for it may have written since: the extension's copy is not sent over them
                if (m.written && !restarted) { written = m.written; toWorker({ type: 'files', files, changed: [], written }); return; }
                for (const n of m.changed || []) { delete written[n]; }
                toWorker({ type: 'files', files, changed: m.changed || [] });
                return;
            case 'hw': hw = m.hw; buildConfig(); clearErr(); toWorker({ type: 'hardware', hw }); trail.length = 0; if (v3) { v3.setHw(hw, body3()); } return;
            case 'hw-error': $('#cfgErr').textContent = m.message; return;
            case 'course': setCourse(m.course, false); return;
            case 'place': place(undefined); return;
            case 'configure': setPane('config'); return;
            case 'connected': setConn(m.text); return;
            case 'licence': setLicence(m); return;
            case 'maps': onMaps(m); return;
            case 'map-info': if (m.seq === mapSeq) { mapInfo = m; mapReport(); draw(); } return;
            case 'map-error': $('#mapErr').textContent = m.message; return;
            case 'map-imported': loadDraft(m.map, true); return;
        }
    });

    /* ---- the header ---------------------------------------------------------------------------------- */
    function setStatus(kind, text) {
        const c = $('#status');
        c.className = 'chip' + (kind ? ' ' + kind : '');
        $('#statusText').textContent = text;
        $('#stopBtn').disabled = !pending.size;
    }
    function setConn(text) { $('#conn').textContent = text || ''; }
    /** the licence chip (src/sim/simPanel.ts licenceChip): the trial's days left; empty with a licence */
    function setLicence(l) {
        const c = $('#licence');
        c.textContent = (l && l.text) || '';
        c.title = (l && l.title) || '';
    }
    let noteTimer;
    function showNote(text, sticky) {
        const n = $('#note');
        n.textContent = text;
        n.hidden = !text;
        clearTimeout(noteTimer);
        if (!sticky) { noteTimer = setTimeout(() => { n.hidden = true; }, 3500); }
    }

    /** the map a `map:<name>` course is */
    function mapOf(id) { return id && id.startsWith('map:') ? maps.find((m) => m.name === id.slice(4)) : undefined; }

    /** the Speed list: shared memory reaches a running program at its next call, a message at its next turn (live) */
    function setSpeed(v) {
        speed = v;
        if (ctl) { new Float64Array(ctl.buffer, 16, 1)[0] = v; Atomics.add(ctl, 3, 1); }
        toWorker({ type: 'speed', speed });
        vscode.postMessage({ type: 'speed', speed });
    }

    /** the board's user button: to a running program through shared memory or as a message; with none running, a
     *  press and its release start main.py, as the board's do (the extension runs it when the board has one): a hand
     *  that stays on the button starts nothing, and main.py does not start with the button still down */
    let buttonDown = false;
    let pressIdle = false;
    function pressButton(down) {
        if (down === buttonDown) { return; }
        buttonDown = down;
        if (ctl) { Atomics.store(ctl, 2, down ? 1 : 0); }
        toWorker({ type: 'button', down });
        if (down) { pressIdle = !pending.size; return; }
        if (pressIdle && !pending.size) { vscode.postMessage({ type: 'button' }); }
        pressIdle = false;
    }

    /** the Course list: while a program runs, only where the worker takes it in mid-run (live); else the program has
     *  the worker until it ends, and the list would show a course the robot is not on */
    function pickCourse(id) {
        if (pending.size && !live) {
            showNote('The course can be changed when no program is running.');
            courseOptions();
            return;
        }
        setCourse(id, true);
    }

    function setCourse(id, tell) {
        courseId = id;
        courseOptions();
        userView = false;
        toWorker({ type: 'course', course: id, map: mapOf(id) });
        if (tell) { vscode.postMessage({ type: 'course', course: id }); }
    }

    /** the Course list: the named courses, then the maps built here */
    function courseOptions() {
        const s = $('#course');
        if (!s) { return; }
        s.textContent = '';
        const opt = (id, label, title) => { const o = el('option', { value: id, title }, label); if (id === courseId) { o.selected = true; } return o; };
        for (const c of cfg.courses) { s.append(opt(c.id, c.label, c.detail)); }
        if (maps.length) {
            s.append(el('optgroup', { label: 'Your maps' }, ...maps.map((m) => opt('map:' + m.name, m.name, `${m.tiles.length} tiles (the map builder)`))));
        }
    }

    function place(pose) {
        if (pending.size) { showNote('The robot can be moved when no program is running.'); return; }
        trail.length = 0;
        said.tipped = false; said.falls = 0;
        // put down where it is dropped, at the level it was picked up at where there is one (under a bridge, on the
        // floor), else on the highest thing there (the world decides)
        toWorker({ type: 'place', pose: pose && { x: pose.x, y: pose.y, heading: pose.heading, z: pose.z } });
    }
    const said = { tipped: false, falls: 0 };

    /* ---- snapshots --------------------------------------------------------------------------------------- */
    let lastTele = 0;
    function onSnap(s) {
        snap = s;
        const last = trail[trail.length - 1];
        const p = s.pose;
        if (!last || Math.hypot(p.x - last[0], p.y - last[1]) > 3) { trail.push([p.x, p.y]); if (trail.length > 4000) { trail.shift(); } }
        if (follow) { view.cx = s.pose.x; view.cy = s.pose.y; }
        hud();
        draw();
        const now = performance.now();
        if (now - lastTele > 100) { lastTele = now; vscode.postMessage({ type: 'tele', snap: s, led }); }
    }

    function fmt(v, d = 0) { return Number.isFinite(v) ? v.toFixed(d) : '-'; }

    function hud() {
        if (!snap) { return; }
        const pr = snap.progress;
        const pct = pr.total ? Math.max(0, Math.min(100, pr.s / pr.total * 100)) : 0;
        setText($('#hT'), fmt(pr.clock, 1) + ' s');
        setText($('#hBat'), (snap.packMv / 1000).toFixed(2) + ' V');
        setText($('#hLine'), pr.total ? fmt(pr.d, 0) + ' mm' : '-');
        setText($('#hProg'), pr.total ? (geom && geom.loop ? `lap ${pr.lap + 1}, ${fmt(pct, 0)} %` : `${fmt(pct, 0)} %`) : '-');
        setText($('#hFin'), pr.finished !== null && pr.finished !== undefined ? `finished in ${fmt(pr.finished, 2)} s` : '');
        const p = snap.pose;
        document.body.classList.toggle('has3d', !!(geom && geom.world3d));
        setText($('#hZ'), `${fmt(p.z || 0, 0)} mm, ${fmt(p.pitch || 0, 1)}° / ${fmt(p.roll || 0, 1)}°`);
        const hz = snap.hazards;
        if (hz) {
            // what happened to the robot, said once
            if (hz.tipped && !said.tipped) { said.tipped = true; showNote('The robot tipped over (Back to start puts it back).', true); }
            else if (hz.falls > said.falls) { said.falls = hz.falls; showNote('The robot went over an edge and dropped.'); }
        }
        // the bars: a row per sensor, range, IMU and moving motor - [label, bar width (or null: the IMU's heading), value]
        const rows = [];
        for (const sn of snap.sensors) {
            const v = sn.value[0];
            rows.push([`I2C ${sn.port}`, `width:${Math.max(0, Math.min(100, v))}%`, fmt(v, 0)]);
        }
        for (const d of snap.distance || []) {
            rows.push([`I2C ${d.port}`, `width:${d.range === null ? 0 : Math.min(100, d.range / 12)}%`, d.range === null ? '-' : `${d.range} mm`]);
        }
        if (snap.imu) { rows.push([`I2C ${snap.imu.port}`, null, `${fmt(snap.imu.heading, 0)}°`]); }
        for (const m of snap.motors) {
            if (m.mode === 'coast' && Math.abs(m.speed) < 1 && !isWheel(m.port)) { continue; }
            rows.push([`M${m.port}`, `width:${Math.min(100, Math.abs(m.speed) / 15)}%`, fmt(m.speed, 0) + '°/s']);
        }
        barsTo($('#bars'), rows);
    }

    /* The HUD is updated in place (performance ledger HT-62): a text is written only when it changes, and the bars'
     * rows are made again only when which rows there are changes (a sensor added, a motor starting or stopping) - else
     * each row's width and value are set where they differ. The same elements and attributes as making them anew. */
    function setText(e, text) { if (e && e.textContent !== text) { e.textContent = text; } }
    const barRows = new WeakMap();      // the bars element -> { sig: its rows' labels and kinds, cells: [bar <i>, value] per row }
    function barsTo(bars, rows) {
        if (!bars) { return; }
        const sig = rows.map((r) => (r[1] === null ? 'h:' : 'b:') + r[0]).join('|');
        const had = barRows.get(bars);
        if (had && had.sig === sig) {
            rows.forEach((r, i) => {
                const [bar, val] = had.cells[i];
                if (bar && bar.getAttribute('style') !== r[1]) { bar.setAttribute('style', r[1]); }
                setText(val, r[2]);
            });
            return;
        }
        bars.textContent = '';
        const cells = [];
        for (const [k, style, v] of rows) {
            const val = el('span', { class: 'v' }, v);
            if (style === null) {
                bars.append(el('span', { class: 'k' }, k), el('span', { class: 'v' }, 'heading'), val);
                cells.push([null, val]);
            } else {
                const bar = el('i', { style });
                bars.append(el('span', { class: 'k' }, k), el('div', { class: 'bar' }, bar), val);
                cells.push([bar, val]);
            }
        }
        barRows.set(bars, { sig, cells });
    }
    const isWheel = (p) => p === hw.driveBase.leftPort || p === hw.driveBase.rightPort;

    /* ---- drawing ----------------------------------------------------------------------------------------- */
    const canvas = el('canvas', { id: 'c', 'aria-label': 'The simulated robot on its course' });
    const ctx = canvas.getContext('2d');
    const view = { cx: 0, cy: 0, k: 0.5 };
    let userView = false;
    let dpr = 1;

    function resize() {
        if (mode3d) { draw(); }
        dpr = window.devicePixelRatio || 1;
        const r = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(r.width * dpr));
        canvas.height = Math.max(1, Math.round(r.height * dpr));
        if (!userView) { fit(); }
        draw();
    }

    function fit() {
        const b = builder() ? draftBounds() : geom && geom.bounds;
        if (!b) { return; }
        const [x0, y0, x1, y1] = b;
        const r = canvas.getBoundingClientRect();
        view.cx = (x0 + x1) / 2;
        view.cy = (y0 + y1) / 2;
        view.k = Math.max(0.02, Math.min(r.width / (x1 - x0), r.height / (y1 - y0)) * 0.95);
    }

    /** world mm -> canvas px (y up in the world, down on the screen) */
    function sx(x) { return (canvas.width / 2 + (x - view.cx) * view.k * dpr); }
    function sy(y) { return (canvas.height / 2 - (y - view.cy) * view.k * dpr); }
    function wx(px) { return (px * dpr - canvas.width / 2) / (view.k * dpr) + view.cx; }
    function wy(py) { return view.cy - (py * dpr - canvas.height / 2) / (view.k * dpr); }

    let raf = 0;
    function draw() { if (!raf) { raf = requestAnimationFrame(() => { raf = 0; if (mode3d && !builder()) { v3.setSnap(snap); v3.render(); } else { paint(); } }); } }

    /* ---- the 3D view (media/sim/view3d.js) ---- */
    const canvas3d = el('canvas', { id: 'c3', 'aria-label': 'The simulated robot on its course, in 3D', hidden: '' });
    const v3 = window.EVN3D ? window.EVN3D.create(canvas3d) : undefined;
    let mode3d = false;
    if (v3 && v3.ok) { v3.seesawDeg = (cfg.seesaw || {}).deg; v3.seesawT = (cfg.seesaw || {}).t; v3.onChange = draw; }
    /** the body as the 3D view draws it (hardware.ts bodyOf) */
    function body3() {
        const sh = robotShape(), c = hw.chassis || {};
        return { front: sh.front, rear: -sh.rear, width: 2 * sh.half, height: c.height ?? 100, clearance: c.clearance ?? 10, caster: sh.caster, tyre: 18 };
    }
    function set3d(on) {
        if (on && !(v3 && v3.ok)) { showNote('The 3D view needs WebGL, which this window does not have.'); }
        mode3d = !!on && !!v3 && v3.ok;
        canvas.hidden = mode3d; canvas3d.hidden = !mode3d;
        $('#view3dBtn').classList.toggle('on', mode3d);
        if (mode3d) { v3.setHw(hw, body3()); if (geom) { v3.setGeom(geom); } v3.follow = follow; }
        document.body.classList.toggle('in3d', mode3d);
        draw();
    }

    /* The floor that does not move, drawn once and its pixels copied in each frame after (performance ledger HT-61):
     * the white floor, the grid, the tiles under the robot with their paint and marks, the paint off the tiles, the
     * speed bumps - what the frame drew first, with the same calls, on the panel's canvas, then its pixels kept. It is
     * drawn again when the canvas, the view, the course, the tiles over the robot or a seesaw's tilt change (its key),
     * and kept again only once the new key has held for a second frame: while the view moves (Follow, a drag, a zoom)
     * or a seesaw tilts, each frame draws the floor as before and keeps nothing (review r1 B1); the rest (the debris, the start,
     * the trail, the beams, the robot, the obstacles, the tiles over the robot) is drawn over it each frame as before. */
    const floor = { canvas: null, key: null, last: null, geom: null, order: [], byTile: new Map(), loose: [] };
    /** two floor keys the same (compared as numbers: a key turned into a string each frame cost Follow its frames) */
    const sameKey = (a, b) => !!a && a.length === b.length && a.every((v, i) => v === b[i]);
    function paintIndex() {
        if (floor.geom === geom) { return; }
        const tiles = geom.tiles || [];
        floor.geom = geom; floor.key = null; floor.last = null;
        floor.order = tiles.map((t, i) => i).sort((a, b) => (tiles[a].span ? tiles[a].span[1] : 0) - (tiles[b].span ? tiles[b].span[1] : 0));
        floor.byTile = new Map();
        floor.loose = [];
        for (const p of geom.paint) {
            if (p.tile === undefined || p.tile === null) { floor.loose.push(p); continue; }
            if (!floor.byTile.has(p.tile)) { floor.byTile.set(p.tile, []); }
            floor.byTile.get(p.tile).push(p);
        }
    }

    function paint() {
        const W = canvas.width, H = canvas.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (builder()) { paintBuilder(); return; }
        if (!geom) { return; }
        paintIndex();
        // the world transform: mm, y up
        const world = [view.k * dpr, 0, 0, -view.k * dpr, W / 2 - view.cx * view.k * dpr, H / 2 + view.cy * view.k * dpr];
        // a map's tiles, lowest first: what is over the robot (a bridge it is under) is drawn after it, see-through
        const tiles = geom.tiles || [];
        const top = snap ? (snap.pose.z || 0) + chassisHeight() : Infinity;
        const reach = snap ? Math.max(robotShape().front, -robotShape().rear, robotShape().half) + 20 : 0;
        const over = (i) => {
            const t = tiles[i];
            if (!t || !t.span || !(t.span[0] - 10 > top)) { return false; }
            const r = t.rect, p = snap.pose;
            return p.x > r[0] - reach && p.x < r[2] + reach && p.y > r[1] - reach && p.y < r[3] + reach;
        };
        const overs = floor.order.filter((i) => over(i));
        const layer = (upper) => {
            for (const i of floor.order) {
                if (over(i) !== upper) { continue; }
                tileBase(tiles[i], i);
                for (const p of floor.byTile.get(i) || []) { paintOne(p); }
                tileMarks(tiles[i], seesawTilt(i) * 15);
            }
        };
        const w3 = W3();
        const key = [W, H, ...world, overs.join(' '), w3 ? w3.seesaws.map((q) => seesawTilt(q.tile)).join(' ') : ''];
        if (sameKey(floor.key, key)) {
            ctx.drawImage(floor.canvas, 0, 0);
            ctx.setTransform(...world);
        } else {
            // drawn on the panel's own canvas, as the frame always drew it, then its pixels kept (drawn on a canvas of its
            // own, the edges came out differently)
            {
                ctx.setTransform(...world);
                const [x0, y0, x1, y1] = geom.bounds;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
                // the tile grid, faint (a map's tiles sit on it; the named courses' line runs through the middle of its squares)
                const g = geom.grid || { pitch: 300, offset: 150 };
                ctx.strokeStyle = 'rgba(0,0,0,0.06)';
                ctx.lineWidth = 1 / view.k / dpr;
                ctx.beginPath();
                for (let x = Math.ceil((x0 - g.offset) / g.pitch) * g.pitch + g.offset; x < x1; x += g.pitch) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
                for (let y = Math.ceil((y0 - g.offset) / g.pitch) * g.pitch + g.offset; y < y1; y += g.pitch) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
                ctx.stroke();
                layer(false);
                for (const p of floor.loose) { paintOne(p); }
                bumps3d();
            }
            // kept only once its key has held for a frame (B1 above), in a canvas read back from (willReadFrequently): one
            // the GPU draws (Edge 155) changed how the panel's canvas drew the robot and the trail over it afterwards
            // never while Follow moves the view: a frame between two snapshots (an LED message) would keep a floor the
            // next snapshot's view throws away (review r2 S3: 26 copies a second, the GPU process +7 %)
            if (!follow && sameKey(floor.last, key)) {
                if (!floor.canvas) { floor.canvas = document.createElement('canvas'); }
                const fc = floor.canvas;
                if (fc.width !== W || fc.height !== H) { fc.width = W; fc.height = H; }
                const fx = fc.getContext('2d', { willReadFrequently: true });
                fx.setTransform(1, 0, 0, 1, 0, 0);
                fx.globalCompositeOperation = 'copy';
                fx.drawImage(canvas, 0, 0);
                fx.globalCompositeOperation = 'source-over';
                floor.key = key;
            }
        }
        floor.last = key;
        // (a frame that drew the floor is in the world transform still: the same calls as before the cache)
        debris3d();
        if (geom.start) { startMark(geom.start); }
        // the trail
        if (trail.length > 1) {
            ctx.strokeStyle = 'rgba(42,120,214,0.75)';
            ctx.lineWidth = Math.max(1.5, 2 / view.k / dpr);
            ctx.beginPath();
            trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
        }
        if (snap) { beams(snap); robot(snap.pose, snap); }
        hazards3d(true);
        if (overs.length) { ctx.globalAlpha = 0.45; layer(true); ctx.globalAlpha = 1; }
    }

    /* ---- the 3D elements, seen from above ------------------------------------------------------------------ */
    // A tile's height shows as its shading and a shadow on the floor (raised tiles), a ramp's as a gradient and chevrons
    // up it, a seesaw's tilt as its gradient (its low end darker) and its hinge; obstacles, pillars, speed bumps and
    // debris as what they are, each obstacle with its height. The snapshots say where the moving ones are now.
    function chassisHeight() { return (hw.chassis && hw.chassis.height) || 100; }
    const W3 = () => geom && geom.world3d;
    const ALONG = [[0, 1], [-1, 0], [0, -1], [1, 0]];

    function tileBase(t, i) {
        const [x0, y0, x1, y1] = t.rect;
        const z = t.span ? t.span[1] : 0;
        if (z > 0.5 && !t.ramp && !t.seesaw) {
            // a raised tile's shadow on the floor, down and to the right, longer the higher it is
            const d = Math.min(60, 4 + z * 0.12);
            ctx.fillStyle = 'rgba(0,0,0,0.13)';
            ctx.fillRect(x0 + d, y0 - d, x1 - x0, y1 - y0);
        }
        let fill = '#ffffff';
        if (t.ramp || t.seesaw) {
            const a = ALONG[t.rot % 4];
            const k = t.seesaw ? seesawTilt(i) : 1;
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2 * a[0], hy = (y1 - y0) / 2 * a[1];
            const g = ctx.createLinearGradient(cx - hx * k, cy - hy * k, cx + hx * k, cy + hy * k);
            g.addColorStop(0, '#d9dadc'); g.addColorStop(1, '#ffffff');
            fill = g;
        } else if (z > 0.5) {
            fill = '#fbfbf7';
        }
        ctx.fillStyle = fill;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.strokeStyle = z > 0.5 || t.ramp || t.seesaw ? 'rgba(80,70,50,0.55)' : 'rgba(0,0,0,0.16)';
        ctx.lineWidth = z > 0.5 || t.ramp ? Math.max(1.5, 1.5 / view.k / dpr) : 1 / view.k / dpr;
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }

    /** a seesaw's tilt now, as -1..1 of its whole (1: its drawn bottom end down, as it starts) */
    function seesawTilt(i) {
        const w = W3();
        if (!w) { return 1; }
        const k = w.seesaws.findIndex((q) => q.tile === i);
        const th = snap && snap.hazards && k >= 0 ? (snap.hazards.seesaws[k] ?? 15) : 15;
        return Math.max(-1, Math.min(1, th / 15));
    }

    function label(text, x, y, color, px = 11) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 / view.k / dpr, -1 / view.k / dpr);
        ctx.font = `${px * dpr}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    /** a tile's 3D marks: a ramp's chevrons up it and its heights, a seesaw's hinge and tilt (th degrees), a raised
     *  tile's height */
    function tileMarks(t, th) {
        const [x0, y0, x1, y1] = t.rect;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        if (t.ramp) {
            // chevrons up the slope, and the heights at its ends
            const a = ALONG[t.rot % 4], len = a[0] ? x1 - x0 : y1 - y0;
            ctx.strokeStyle = 'rgba(120,110,90,0.55)';
            ctx.lineWidth = 4;
            for (let f = -0.3; f <= 0.31; f += 0.3) {
                const px = cx + a[0] * len * f, py = cy + a[1] * len * f;
                for (const side of [-1, 1]) {
                    const qx = px - a[0] * 22 + side * a[1] * 40, qy = py - a[1] * 22 - side * a[0] * 40;
                    if (side < 0) { ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); } else { ctx.lineTo(qx, qy); ctx.stroke(); }
                }
            }
            label(`${Math.round(t.span[0])} → ${Math.round(t.span[1])} mm`, cx + a[1] * 95, cy - a[0] * 95, '#7f715c');
        } else if (t.seesaw) {
            const a = ALONG[t.rot % 4];
            ctx.strokeStyle = 'rgba(80,70,50,0.8)';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 8]);
            ctx.beginPath(); ctx.moveTo(cx - a[1] * 150, cy + a[0] * 150); ctx.lineTo(cx + a[1] * 150, cy - a[0] * 150); ctx.stroke();
            ctx.setLineDash([]);
            label(`seesaw ${th >= 0 ? '' : '-'}${Math.abs(th).toFixed(0)}°`, cx + a[1] * 95, cy - a[0] * 95, '#7f715c');
        } else if (t.span && t.span[1] > 0.5) {
            label(`${Math.round(t.span[1])} mm`, (x0 + x1) / 2 + 70, y1 - 40, '#7f715c');
        }
    }

    /** bumps and debris (under the robot), obstacles and pillars (`tall`: drawn over it, they stand above it) */
    function hazards3d(tall) {
        if (!tall) { bumps3d(); debris3d(); return; }
        const w = W3();
        if (!w) { return; }
        const hz = snap && snap.hazards;
        w.blocks.forEach((b, i) => {
            // where it is now (a snapshot of another course can come in between: then where the map put it)
            const at = (hz && hz.blocks.length === w.blocks.length && hz.blocks[i]) || b.at || [0, 0, 0, 0];
            const x = at[0], y = at[1], a = at[2];
            const pts = b.local.map(([u, v]) => { const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180); return [x + u * c - v * sn, y + u * sn + v * c]; });
            const d = Math.min(50, 3 + b.h * 0.1);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            poly(pts.map(([px, py]) => [px + d, py - d])); ctx.fill();
            ctx.fillStyle = b.kind === 'pillar' ? '#8d9196' : b.fixed ? '#7d3b30' : '#b5523b';
            ctx.strokeStyle = '#2b1b17';
            ctx.lineWidth = Math.max(1, 1.2 / view.k / dpr);
            poly(pts); ctx.fill(); ctx.stroke();
            if (b.kind === 'obstacle') { label(`${Math.round(b.h)}`, x, y, '#ffffff', 10); }
        });
    }

    /** the speed bumps (they do not move: drawn with the floor) */
    function bumps3d() {
        const w = W3();
        if (!w) { return; }
        for (const s of w.surfaces) {
            if (s.kind === 'bump') {
                ctx.fillStyle = 'rgba(160,160,160,0.28)';
                ctx.strokeStyle = 'rgba(90,90,90,0.8)';
                ctx.lineWidth = Math.max(1, 1.2 / view.k / dpr);
                poly(s.poly); ctx.fill(); ctx.stroke();
                // its crest
                ctx.setLineDash([6, 5]);
                ctx.beginPath(); ctx.moveTo((s.poly[0][0] + s.poly[3][0]) / 2, (s.poly[0][1] + s.poly[3][1]) / 2); ctx.lineTo((s.poly[1][0] + s.poly[2][0]) / 2, (s.poly[1][1] + s.poly[2][1]) / 2); ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    /** the debris, where the snapshot says it is now (a wheel kicks it) */
    function debris3d() {
        const w = W3();
        if (!w) { return; }
        const hz = snap && snap.hazards;
        const debS = w.surfaces.filter((s) => s.kind === 'debris');
        const deb = hz && hz.debris.length === debS.length ? hz.debris : debS.map((s) => s.poly);
        ctx.fillStyle = '#b8935a';
        ctx.strokeStyle = '#7a5a2e';
        ctx.lineWidth = Math.max(0.6, 0.8 / view.k / dpr);
        for (const p of deb) { poly(p); ctx.fill(); ctx.stroke(); }
    }

    function poly(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }

    /** the distance sensors' beams: to where the range was measured, or as far as they reach */
    function beams(s) {
        for (const d of s.distance || []) {
            if (!d.from || !d.to) { continue; }
            ctx.strokeStyle = d.range === null ? 'rgba(235,104,52,0.25)' : 'rgba(235,104,52,0.85)';
            ctx.lineWidth = Math.max(1.5, 2 / view.k / dpr);
            ctx.setLineDash([8, 6]);
            ctx.beginPath(); ctx.moveTo(d.from[0], d.from[1]); ctx.lineTo(d.to[0], d.to[1]); ctx.stroke();
            ctx.setLineDash([]);
            if (d.range !== null) {
                ctx.fillStyle = '#eb6834';
                ctx.beginPath(); ctx.arc(d.to[0], d.to[1], Math.max(3, 4 / view.k / dpr), 0, 2 * Math.PI); ctx.fill();
            }
        }
    }

    /** one piece of the course's paint: a stroke (round or mitred corners), a filled polygon or an arc, clipped to its tile */
    function paintOne(p) {
        ctx.save();
        if (p.clip) { ctx.beginPath(); ctx.rect(p.clip[0], p.clip[1], p.clip[2] - p.clip[0], p.clip[3] - p.clip[1]); ctx.clip(); }
        ctx.strokeStyle = p.css;
        ctx.fillStyle = p.css;
        ctx.lineWidth = p.w;
        ctx.lineCap = 'butt';
        ctx.lineJoin = p.join || 'round';
        ctx.beginPath();
        if (p.kind === 'arc') { ctx.arc(p.c[0], p.c[1], p.r, p.a0, p.a1, p.a1 < p.a0); }
        else { p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); }
        if (p.kind === 'fill') { ctx.fill(); } else { ctx.stroke(); }
        ctx.restore();
    }

    function startMark(s) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.heading * Math.PI / 180);
        ctx.strokeStyle = 'rgba(95,158,136,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, 60); ctx.stroke();
        ctx.restore();
    }

    /** the body as the configurator sets it (hardware.ts bodyOf: null members worked out from the drive base and the
     *  sensors); rear is negative here */
    function robotShape() {
        const db = hw.driveBase, c = hw.chassis || {};
        const front = c.front ?? Math.max(40, ...hw.colorSensors.map((s) => s.forward + 12), ...(hw.distanceSensors || []).map((s) => s.forward + 10));
        const rear = -(c.rear ?? Math.max(50, db.wheelDiameter / 2 + 30));
        const half = Math.max(20, (c.width ?? Math.max(40, db.axleTrack - 28)) / 2);
        const caster = c.caster ?? Math.min(-30, rear + 18);
        return { front, rear, half, db, caster };
    }

    function robot(pose, s) {
        const { front, rear, half, db } = robotShape();
        ctx.save();
        ctx.translate(pose.x, pose.y);
        ctx.rotate(pose.heading * Math.PI / 180);
        // body (x forward, y left)
        ctx.fillStyle = 'rgba(17,21,24,0.18)';
        ctx.strokeStyle = 'rgba(17,21,24,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(rear, -half, front - rear, 2 * half);
        ctx.fill(); ctx.stroke();
        // wheels
        ctx.fillStyle = 'rgba(17,21,24,0.85)';
        for (const side of [1, -1]) { ctx.fillRect(-db.wheelDiameter / 2, side * db.axleTrack / 2 - 9, db.wheelDiameter, 18); }
        // caster
        ctx.beginPath(); ctx.arc(robotShape().caster, 0, 8, 0, 2 * Math.PI); ctx.stroke();
        // distance sensors: a box looking its way
        for (const d of hw.distanceSensors || []) {
            ctx.save();
            ctx.translate(d.forward, d.left);
            ctx.rotate(d.angle * Math.PI / 180);
            ctx.fillStyle = '#eb6834';
            ctx.fillRect(-6, -9, 10, 18);
            ctx.restore();
        }
        if (hw.imu) {
            ctx.strokeStyle = '#5f9e88';
            ctx.lineWidth = 2;
            ctx.strokeRect(-12, -12, 24, 24);
        }
        // heading
        ctx.strokeStyle = '#a8977b';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(front - 6, 0); ctx.stroke();
        // the board's LED
        ctx.fillStyle = led ? '#5fd06b' : 'rgba(17,21,24,0.35)';
        ctx.beginPath(); ctx.arc(rear + 40, half - 12, 5, 0, 2 * Math.PI); ctx.fill();
        // sensors: their patch, coloured by what they read
        for (const c of hw.colorSensors) {
            const r = s && s.sensors.find((x) => x.port === c.port);
            const v = r ? Math.max(0, Math.min(100, r.value[0])) : 100;
            const g = Math.round(40 + v * 2.1);
            ctx.fillStyle = `rgb(${g},${g},${g})`;
            ctx.strokeStyle = '#eb6834';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.rect(c.forward - 6, c.left - 6, 12, 12); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(235,104,52,0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(c.forward, c.left, c.height, 0, 2 * Math.PI); ctx.stroke();
            ctx.save();
            ctx.translate(c.forward, c.left);
            ctx.scale(1, -1);
            ctx.fillStyle = '#eb6834';
            ctx.font = '11px sans-serif';
            ctx.fillText(String(c.port), 8, -8);
            ctx.restore();
        }
        // the rotate handle
        if (!pending.size) {
            ctx.fillStyle = 'rgba(168,151,123,0.9)';
            ctx.beginPath(); ctx.arc(front + 22, 0, 7, 0, 2 * Math.PI); ctx.fill();
        }
        ctx.restore();
    }

    /* ---- the mouse: pan, zoom, pick up the robot --------------------------------------------------------- */
    let drag;
    canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);
        const x = wx(e.offsetX), y = wy(e.offsetY);
        if (builder()) {
            if (e.button === 2) { return; }
            const col = Math.floor(x / 300), row = Math.floor(y / 300);
            if (startMode) { setStart(x, y); return; }
            if (greenMode) { toggleMarker(x, y); return; }
            // with a tile (or an object) picked, a click places it and a drag still pans
            if (pick || pickObj) { drag = { mode: 'pan', x: e.offsetX, y: e.offsetY, cx: view.cx, cy: view.cy, place: { col, row, x, y, low: e.shiftKey } }; return; }
            // an object over the tiles first, then the tile under the mouse (Shift: the lower one of a bridge)
            const o = objectAt(x, y);
            if (o >= 0) {
                selObj = o; sel = undefined;
                const ob = draft.objects[o];
                drag = { mode: 'obj', i: o, dx: x - ob.x, dy: y - ob.y, from: { x: ob.x, y: ob.y } };
                mapPane(); draw();
                return;
            }
            const i = tileAt(col, row, e.shiftKey);
            if (i >= 0) {
                sel = i; selObj = undefined;
                const t = draft.tiles[i];
                drag = { mode: 'tile', i, dc: col - t.col, dr: row - t.row, from: { col: t.col, row: t.row } };
                mapPane();
                draw();
                return;
            }
            if (sel !== undefined || selObj !== undefined) { sel = undefined; selObj = undefined; mapPane(); draw(); }
            drag = { mode: 'pan', x: e.offsetX, y: e.offsetY, cx: view.cx, cy: view.cy };
            return;
        }
        if (snap && !pending.size) {
            const p = snap.pose, h = p.heading * Math.PI / 180;
            const lx = (x - p.x) * Math.cos(h) + (y - p.y) * Math.sin(h);
            const ly = -(x - p.x) * Math.sin(h) + (y - p.y) * Math.cos(h);
            const { front, rear, half } = robotShape();
            if (Math.hypot(lx - (front + 22), ly) < 14 / Math.min(1, view.k)) { drag = { mode: 'rotate', pose: { ...p } }; return; }
            if (lx >= rear && lx <= front && Math.abs(ly) <= half + 12) { drag = { mode: 'move', dx: x - p.x, dy: y - p.y, pose: { ...p } }; return; }
        }
        drag = { mode: 'pan', x: e.offsetX, y: e.offsetY, cx: view.cx, cy: view.cy };
    });
    canvas.addEventListener('pointermove', (e) => {
        const x = wx(e.offsetX), y = wy(e.offsetY);
        if (builder()) {
            const h = { col: Math.floor(x / 300), row: Math.floor(y / 300) };
            if (!hover || hover.col !== h.col || hover.row !== h.row) { hover = h; if (pick || startMode) { draw(); } }
            hoverPt = [x, y];
            if (pickObj) { draw(); }
            if (drag && drag.mode === 'tile') {
                const t = draft.tiles[drag.i];
                const col = h.col - drag.dc, row = h.row - drag.dr;
                if (t.col !== col || t.row !== row) { t.col = col; t.row = row; draw(); }
                return;
            }
            if (drag && drag.mode === 'obj') {
                const o = draft.objects[drag.i];
                o.x = snap5(x - drag.dx); o.y = snap5(y - drag.dy);
                draw();
                return;
            }
        }
        if (!drag) { return; }
        if (drag.mode === 'pan') {
            view.cx = drag.cx - (e.offsetX - drag.x) / view.k;
            view.cy = drag.cy + (e.offsetY - drag.y) / view.k;
            userView = true;
            follow = false; $('#followBtn').classList.remove('on');
            draw();
        } else if (drag.mode === 'move') {
            drag.pose.x = x - drag.dx; drag.pose.y = y - drag.dy;
            snap.pose = { ...drag.pose }; draw();
        } else {
            drag.pose.heading = Math.atan2(y - drag.pose.y, x - drag.pose.x) * 180 / Math.PI;
            if (e.shiftKey) { drag.pose.heading = Math.round(drag.pose.heading / 15) * 15; }
            snap.pose = { ...drag.pose }; draw();
        }
    });
    canvas.addEventListener('pointerup', (e) => {
        if (drag && drag.mode === 'tile') {
            const t = draft.tiles[drag.i];
            if (t.col !== drag.from.col || t.row !== drag.from.row) {
                // what lies on it goes with it
                const r = rectOf({ ...t, col: drag.from.col, row: drag.from.row });
                const dx = (t.col - drag.from.col) * 300, dy = (t.row - drag.from.row) * 300;
                for (const o of draft.objects || []) {
                    if (o.x >= r[0] * 300 && o.x < r[2] * 300 && o.y >= r[1] * 300 && o.y < r[3] * 300 && Math.abs((o.z || 0) - supportZAt(t, o.x, o.y, drag.from)) < 21) { o.x += dx; o.y += dy; }
                }
                // a tile dropped on others takes their place
                const keep = draft.tiles.filter((o, j) => j === drag.i || !overlaps(o, t));
                sel = keep.indexOf(t);
                draft.tiles = keep;
                edited();
            }
        } else if (drag && drag.mode === 'obj') {
            const o = draft.objects[drag.i];
            // it lies on what is under it, at the level it was at where there is one (under a bridge: the floor tile)
            if (o.x !== drag.from.x || o.y !== drag.from.y) { o.z = Math.abs(supportZ(o.x, o.y, true) - (o.z || 0)) < 21 ? supportZ(o.x, o.y, true) : supportZ(o.x, o.y); edited(); }
        } else if (drag && drag.mode === 'pan' && drag.place && Math.hypot(e.offsetX - drag.x, e.offsetY - drag.y) < 5 && (pick || pickObj)) {
            if (pick) { placeTile(pick, drag.place.col, drag.place.row, pickRot); } else { placeObject(pickObj, drag.place.x, drag.place.y, drag.place.low); }
        } else if (drag && drag.mode !== 'pan') { place(drag.pose); }
        drag = undefined;
    });
    canvas.addEventListener('pointerleave', () => { if (builder() && hover) { hover = undefined; draw(); } });
    // in the map builder a right click turns the tile under the mouse (or the one being placed)
    canvas.addEventListener('contextmenu', (e) => {
        if (!builder()) { return; }
        e.preventDefault();
        if (pick) { pickRot = (pickRot + 1) % 4; draw(); return; }
        const o = objectAt(wx(e.offsetX), wy(e.offsetY));
        if (o >= 0) { selObj = o; sel = undefined; rotateObject(o, 1); return; }
        const i = tileAt(Math.floor(wx(e.offsetX) / 300), Math.floor(wy(e.offsetY) / 300), e.shiftKey);
        if (i >= 0) { sel = i; selObj = undefined; rotateTile(i, 1); }
    });
    window.addEventListener('keydown', (e) => {
        if (!builder() || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { return; }
        if (e.key === 'r' || e.key === 'R') {
            const d = e.shiftKey ? 3 : 1;
            if (pick) { pickRot = (pickRot + d) % 4; draw(); } else if (selObj !== undefined) { rotateObject(selObj, e.shiftKey ? -1 : 1); } else if (sel !== undefined) { rotateTile(sel, d); }
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && selObj !== undefined) {
            removeObject(selObj);
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel !== undefined) {
            removeTile(sel);
        } else if (e.key === 'Escape') {
            // first the tile being placed (or the start being set), then the selection
            if (pick || pickObj || startMode || greenMode) { pick = undefined; pickObj = undefined; startMode = false; greenMode = false; } else { sel = undefined; selObj = undefined; }
            palette(); mapPane(); draw();
        } else { return; }
        e.preventDefault();
    });
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const x = wx(e.offsetX), y = wy(e.offsetY);
        const f = Math.exp(-e.deltaY * 0.0015);
        view.k = Math.max(0.02, Math.min(20, view.k * f));
        // keep the point under the mouse where it is
        view.cx = x - (e.offsetX * dpr - canvas.width / 2) / (view.k * dpr);
        view.cy = y + (e.offsetY * dpr - canvas.height / 2) / (view.k * dpr);
        userView = true;
        draw();
    }, { passive: false });
    new ResizeObserver(resize).observe(canvas);

    /* ---- the configurator ---------------------------------------------------------------------------------- */
    function numIn(value, attrs) { return el('input', { type: 'number', value: String(value), step: 'any', ...attrs }); }

    function buildConfig() {
        const f = $('#cfgForm');
        f.textContent = '';
        const db = hw.driveBase;
        const model = el('select', { id: 'fMotor' }, ...cfg.models.map((m) => { const o = el('option', { value: m }, m); if (m === db.motor) { o.selected = true; } return o; }));
        const port = (id, v) => el('select', { id }, ...[1, 2, 3, 4].map((p) => { const o = el('option', { value: String(p) }, `M${p}`); if (p === v) { o.selected = true; } return o; }));
        const check = (id, v) => { const c = el('input', { type: 'checkbox', id }); c.checked = !!v; return c; };
        f.append(
            el('h2', {}, 'Drive base'),
            el('p', { class: 'sub' }, 'Two motors of one model drive the wheels. A mirrored motor turns its wheel backwards for a positive (clockwise) turn: the program needs Direction.COUNTERCLOCKWISE on it.'),
            el('div', { class: 'grid' },
                el('label', { for: 'fMotor' }, 'Motor'), model,
                el('label', { for: 'fLeft' }, 'Left wheel'), el('div', {}, port('fLeft', db.leftPort), ' ', el('label', { class: 'inline' }, check('fLeftM', db.leftMirrored), 'mirrored')),
                el('label', { for: 'fRight' }, 'Right wheel'), el('div', {}, port('fRight', db.rightPort), ' ', el('label', { class: 'inline' }, check('fRightM', db.rightMirrored), 'mirrored')),
                el('label', { for: 'fWheel' }, 'Wheel diameter'), el('div', {}, numIn(db.wheelDiameter, { id: 'fWheel', min: 10, max: 300 }), ' mm'),
                el('label', { for: 'fTrack' }, 'Axle track'), el('div', {}, numIn(db.axleTrack, { id: 'fTrack', min: 30, max: 600 }), ' mm'),
            ),
        );
        // the body: what ramps, bumps and obstacles act on (empty: worked out from the drive base and the sensors)
        const ch = hw.chassis || {};
        const auto = (id, v, attrs) => numIn(v ?? '', { id, placeholder: 'auto', ...attrs });
        f.append(
            el('h2', {}, 'Chassis'),
            el('p', { class: 'sub' }, 'What the robot weighs and how big it is, from the middle of the axle: what a ramp pulls on, what scrapes over a speed bump, what an obstacle stops. Empty: worked out from the wheels and the sensors.'),
            el('div', { class: 'grid' },
                el('label', { for: 'fMass' }, 'Mass'), el('div', {}, numIn(ch.mass ?? 600, { id: 'fMass', min: 50, max: 10000 }), ' g'),
                el('label', { for: 'fFront' }, 'Front'), el('div', {}, auto('fFront', ch.front, { min: 0, max: 600 }), ' mm ahead of the axle'),
                el('label', { for: 'fRear' }, 'Rear'), el('div', {}, auto('fRear', ch.rear, { min: 0, max: 600 }), ' mm behind it'),
                el('label', { for: 'fWidth' }, 'Width'), el('div', {}, auto('fWidth', ch.width, { min: 20, max: 800 }), ' mm'),
                el('label', { for: 'fHeight' }, 'Height'), el('div', {}, numIn(ch.height ?? 100, { id: 'fHeight', min: 20, max: 600 }), ' mm (under a bridge: 250)'),
                el('label', { for: 'fClear' }, 'Clearance'), el('div', {}, numIn(ch.clearance ?? 10, { id: 'fClear', min: 1, max: 100 }), ' mm under the body'),
                el('label', { for: 'fCaster' }, 'Caster'), el('div', {}, auto('fCaster', ch.caster, { min: -600, max: 600 }), ' mm ahead (negative: behind)'),
            ),
            el('h2', {}, `Colour sensors (up to ${cfg.maxSensors})`),
            el('p', { class: 'sub' }, 'TCS34725 sensors looking down, placed from the middle of the axle: forward and to the left (negative: to the right). The height sets how big a patch of floor each one sees.'),
        );
        const list = el('div', { id: 'sensors', style: 'display:flex;flex-direction:column;gap:8px' });
        hw.colorSensors.forEach((s, i) => list.append(sensorCard(s, i)));
        f.append(list);
        const add = el('button', { class: 'btn', type: 'button', onclick: () => { readForm(); hw.colorSensors.push(nextSensor()); buildConfig(); } }, '+ Add a colour sensor');
        add.disabled = hw.colorSensors.length >= cfg.maxSensors;
        f.append(el('div', { class: 'actions' }, add));
        // distance sensors and the IMU
        f.append(
            el('h2', {}, `Distance sensors (up to ${cfg.maxDistance || 4})`),
            el('p', { class: 'sub' }, 'VL53L0X time-of-flight sensors: where each sits (forward, left, its height over the floor) and the way it looks (degrees from straight ahead, to the left). They see obstacles, pillars, the sides of ramps and raised tiles.'),
        );
        const dl = el('div', { id: 'dists', style: 'display:flex;flex-direction:column;gap:8px' });
        (hw.distanceSensors || []).forEach((s, i) => dl.append(distCard(s, i)));
        f.append(dl);
        const addD = el('button', { class: 'btn', type: 'button', onclick: () => { readForm(); hw.distanceSensors.push({ port: freePort(), forward: 60, left: 0, height: 40, angle: 0 }); buildConfig(); } }, '+ Add a distance sensor');
        addD.disabled = (hw.distanceSensors || []).length >= (cfg.maxDistance || 4);
        f.append(el('div', { class: 'actions' }, addD));
        const imuOn = el('input', { type: 'checkbox', id: 'fImu' });
        imuOn.checked = !!hw.imu;
        f.append(
            el('h2', {}, 'IMU'),
            el('p', { class: 'sub' }, 'An MPU-6500 lying flat on the robot: its heading, and its pitch and roll on a ramp or a seesaw.'),
            el('div', { class: 'grid' },
                el('label', { for: 'fImu' }, 'IMU'), el('label', { class: 'inline' }, imuOn, 'on I2C port ', numIn(hw.imu ? hw.imu.port : freePort(), { id: 'fImuPort', min: 1, max: 16, step: 1 })),
            ),
        );
        $('#setup').textContent = setupCode(hw);
    }

    /** the lowest I2C port no device of the robot has */
    function freePort() {
        const used = new Set([...hw.colorSensors.map((s) => s.port), ...(hw.distanceSensors || []).map((s) => s.port), ...(hw.imu ? [hw.imu.port] : [])]);
        let p = 1; while (used.has(p)) { p++; }
        return p;
    }

    function nextSensor() {
        return { port: freePort(), forward: 24, left: 0, height: 8 };
    }

    function distCard(s, i) {
        return el('div', { class: 'sensor dist', 'data-i': String(i) },
            el('div', { class: 't' }, `Distance sensor ${i + 1}`, el('button', { class: 'x', type: 'button', title: 'Remove this sensor', onclick: () => { readForm(); hw.distanceSensors.splice(i, 1); buildConfig(); } }, '×')),
            el('label', {}, 'I2C port', numIn(s.port, { class: 'dPort', min: 1, max: 16, step: 1 })),
            el('label', {}, 'forward', numIn(s.forward, { class: 'dFwd', min: -300, max: 300 })),
            el('label', {}, 'left', numIn(s.left, { class: 'dLeft', min: -300, max: 300 })),
            el('label', {}, 'height', numIn(s.height, { class: 'dH', min: 5, max: 400 })),
            el('label', {}, 'angle', numIn(s.angle, { class: 'dA', min: -180, max: 180 })),
        );
    }

    function sensorCard(s, i) {
        return el('div', { class: 'sensor', 'data-i': String(i) },
            el('div', { class: 't' }, `Sensor ${i + 1}`, el('button', { class: 'x', type: 'button', title: 'Remove this sensor', onclick: () => { readForm(); hw.colorSensors.splice(i, 1); buildConfig(); } }, '×')),
            el('label', {}, 'I2C port', numIn(s.port, { class: 'sPort', min: 1, max: 16, step: 1 })),
            el('label', {}, 'forward', numIn(s.forward, { class: 'sFwd', min: -300, max: 300 })),
            el('label', {}, 'left', numIn(s.left, { class: 'sLeft', min: -300, max: 300 })),
            el('label', {}, 'height', numIn(s.height, { class: 'sH', min: 2, max: 40 })),
        );
    }

    function readForm() {
        const n = (sel, root = document) => Number($(sel, root).value);
        const opt = (sel) => { const v = $(sel).value.trim(); return v === '' ? null : Number(v); };
        const next = {
            version: 1, name: hw.name,
            driveBase: {
                motor: $('#fMotor').value, leftPort: n('#fLeft'), rightPort: n('#fRight'),
                leftMirrored: $('#fLeftM').checked, rightMirrored: $('#fRightM').checked,
                wheelDiameter: n('#fWheel'), axleTrack: n('#fTrack'),
            },
            chassis: { mass: n('#fMass'), front: opt('#fFront'), rear: opt('#fRear'), width: opt('#fWidth'), height: n('#fHeight'), clearance: n('#fClear'), caster: opt('#fCaster') },
            colorSensors: [...document.querySelectorAll('.sensor:not(.dist)')].map((c) => ({ port: n('.sPort', c), forward: n('.sFwd', c), left: n('.sLeft', c), height: n('.sH', c) })),
            distanceSensors: [...document.querySelectorAll('.sensor.dist')].map((c) => ({ port: n('.dPort', c), forward: n('.dFwd', c), left: n('.dLeft', c), height: n('.dH', c), angle: n('.dA', c) })),
            imu: $('#fImu').checked ? { port: n('#fImuPort') } : null,
        };
        hw = next;
        return next;
    }

    function clearErr() { $('#cfgErr').textContent = ''; }

    /** the program lines this robot needs (hardware.ts setupCode, without its comments) */
    function setupCode(h) {
        const db = h.driveBase;
        const dir = (m) => (m ? ', Direction.COUNTERCLOCKWISE' : '');
        const ds = h.distanceSensors || [];
        const names = ['Motor', 'Direction', 'DriveBase', 'ColorSensor', ...(ds.length ? ['DistanceSensor'] : []), ...(h.imu ? ['IMU'] : []), 'wait'];
        const lines = [`from evn import ${names.join(', ')}`, '',
            `left = Motor(${db.leftPort}${dir(db.leftMirrored)})`,
            `right = Motor(${db.rightPort}${dir(db.rightMirrored)})`,
            `robot = DriveBase(left, right, wheel_diameter=${db.wheelDiameter}, axle_track=${db.axleTrack})`];
        for (const s of h.colorSensors) { lines.push(`sensor${s.port} = ColorSensor(${s.port})`); }
        for (const s of ds) { lines.push(`distance${s.port} = DistanceSensor(${s.port})`); }
        if (h.imu) { lines.push(`imu = IMU(${h.imu.port})`); }
        return lines.join('\n') + '\n';
    }

    /* ---- the map builder ------------------------------------------------------------------------------------ */
    // A map is tiles of the library on a 300 mm grid: { version: 1, name, tiles: [{ id, col, row, rot }], start }.
    // rot turns a tile by quarter turns counter-clockwise; a tile bigger than a cell (the long ramps) covers the cells
    // up and to the right of (col, row). The extension checks each edit (src/sim/engine/tiles.ts layoutMap) and says
    // where the line from the start goes.

    function builder() { return document.body.classList.contains('builder'); }

    /** cells a library tile covers, turned [cols, rows] */
    function cellsOf(def, rot) {
        const [pw, ph] = def.plan || def.size;
        const c = Math.round(pw / 300), r = Math.round(ph / 300);
        return rot % 2 ? [r, c] : [c, r];
    }

    function rectOf(t) { const [c, r] = cellsOf(LIB.get(t.id), t.rot); return [t.col, t.row, t.col + c, t.row + r]; }

    /* heights (tiles.ts: rampRise, tileSpan; a bridge is a flat tile at least cfg.bridge mm over the one under it) */
    const S3 = cfg.seesaw || { deg: 15, t: 3 };
    function riseOf(def) { return def.plan ? Math.sqrt(Math.max(0, def.size[1] ** 2 - def.plan[1] ** 2)) : 0; }
    function spanOf(t) {
        const def = LIB.get(t.id), z = t.z || 0;
        if (def.plan) { return [z, z + riseOf(def)]; }
        if (t.seesaw) { return [z, z + S3.t + 300 * Math.tan(S3.deg * Math.PI / 180)]; }
        return [z, z];
    }
    const flatOf = (t) => !LIB.get(t.id).plan && !t.seesaw;
    function stacked(a, b) {
        const sa = spanOf(a), sb = spanOf(b), br = cfg.bridge || 260;
        return (flatOf(a) && sa[0] >= sb[1] + br) || (flatOf(b) && sb[0] >= sa[1] + br);
    }

    function overlaps(a, b) {
        const p = rectOf(a), q = rectOf(b);
        return p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3] && !stacked(a, b);
    }

    /** the draft's tile on this cell (its index), or -1: the highest one there (`low`: the lowest, under a bridge) */
    function tileAt(col, row, low) {
        let best = -1;
        draft.tiles.forEach((t, i) => {
            const r = rectOf(t);
            if (!(col >= r[0] && col < r[2] && row >= r[1] && row < r[3])) { return; }
            if (best < 0 || (low ? spanOf(t)[1] < spanOf(draft.tiles[best])[1] : spanOf(t)[1] > spanOf(draft.tiles[best])[1])) { best = i; }
        });
        return best;
    }

    /** a tile's height along one side of its footprint (S, E, N, W): a ramp's at its low and high ends, undefined
     *  along its sides; a seesaw's at its base (where the robot crosses onto it and off it) */
    function edgeZ(t, side) {
        const def = LIB.get(t.id), z = t.z || 0;
        if (!def.plan) { return z; }
        const a = ALONG[t.rot % 4];
        const high = a[1] > 0 ? 'N' : a[1] < 0 ? 'S' : a[0] > 0 ? 'E' : 'W';
        const low = { N: 'S', S: 'N', E: 'W', W: 'E' }[high];
        return side === high ? z + riseOf(def) : side === low ? z : undefined;
    }

    /** the height a new tile takes where it is placed: the height of the tile next to it where they meet (the selected
     *  tile's first - the one just placed - then the lowest: a bridge over a neighbour does not lift it), so a raised
     *  course or a ramp carries on at its level */
    function autoZ(id, col, row, rot) {
        const t = { id, col, row, rot, z: 0 };
        const r = rectOf(t);
        const opp = { N: 'S', S: 'N', E: 'W', W: 'E' };
        const cands = [];
        const look = (c, w, side) => {
            draft.tiles.forEach((o, i) => {
                const q = rectOf(o);
                if (!(c >= q[0] && c < q[2] && w >= q[1] && w < q[3])) { return; }
                const h = edgeZ(o, opp[side]);
                if (h === undefined) { return; }
                // the new tile's own side there: a ramp's low end starts at h, its high end ends at it
                const mine = edgeZ(t, side);
                if (mine === undefined) { return; }
                cands.push({ i, z: h - mine });
            });
        };
        for (let c = r[0]; c < r[2]; c++) { look(c, r[3], 'N'); look(c, r[1] - 1, 'S'); }
        for (let w = r[1]; w < r[3]; w++) { look(r[2], w, 'E'); look(r[0] - 1, w, 'W'); }
        const pref = cands.find((c) => c.i === sel) || cands.sort((a, b) => a.z - b.z)[0];
        return pref ? Math.max(0, Math.round(pref.z * 100) / 100) : 0;
    }

    /** the top of the highest tile under a point (`low`: the lowest, under a bridge): what an object put there lies on */
    function supportZ(x, y, low) {
        let best = low ? Infinity : 0;
        for (const t of draft.tiles) {
            const r = rectOf(t);
            if (x < r[0] * 300 || x > r[2] * 300 || y < r[1] * 300 || y > r[3] * 300 || t.seesaw) { continue; }
            const def = LIB.get(t.id), z = t.z || 0;
            let h = z;
            if (def.plan) {
                const a = ALONG[t.rot % 4], len = a[0] ? (r[2] - r[0]) * 300 : (r[3] - r[1]) * 300;
                const from = a[0] > 0 ? x - r[0] * 300 : a[0] < 0 ? r[2] * 300 - x : a[1] > 0 ? y - r[1] * 300 : r[3] * 300 - y;
                h = z + riseOf(def) * from / len;
            }
            best = low ? Math.min(best, h) : Math.max(best, h);
        }
        return isFinite(best) ? Math.round(best * 10) / 10 : 0;
    }

    /** a tile's top at a point, the tile at another place (where it was before a drag) */
    function supportZAt(t, x, y, at) {
        const def = LIB.get(t.id), z = t.z || 0;
        if (!def.plan) { return z; }
        const r = rectOf({ ...t, ...at });
        const a = ALONG[t.rot % 4], len = a[0] ? (r[2] - r[0]) * 300 : (r[3] - r[1]) * 300;
        const from = a[0] > 0 ? x - r[0] * 300 : a[0] < 0 ? r[2] * 300 - x : a[1] > 0 ? y - r[1] * 300 : r[3] * 300 - y;
        return z + riseOf(def) * from / len;
    }

    /* ---- the objects: obstacles, speed bumps, debris (tiles.ts MapObject) ---- */
    const snap5 = (v) => Math.round(v / 5) * 5;
    const OBJ_DEFAULTS = {
        obstacle: { shape: 'box', w: 100, d: 60, h: 150, mass: 2000, rot: 0 },
        bump: { length: 250, width: 30, height: 10, rot: 0 },
        debris: { length: 60, diameter: 3, rot: 30 },
    };

    function placeObject(type, x, y, low) {
        draft.objects = draft.objects || [];
        const o = { type, x: snap5(x), y: snap5(y), ...OBJ_DEFAULTS[type], z: supportZ(x, y, low) };
        draft.objects.push(o);
        selObj = draft.objects.length - 1; sel = undefined;
        edited();
    }

    function rotateObject(i, d) {
        const o = draft.objects[i];
        o.rot = (((o.rot || 0) + 15 * d) % 360 + 360) % 360;
        if (o.rot > 180) { o.rot -= 360; }
        edited();
    }

    function removeObject(i) {
        draft.objects.splice(i, 1);
        if (!draft.objects.length) { delete draft.objects; }
        selObj = undefined;
        edited();
    }

    /** an object's outline seen from above (a cylinder: a 20-gon) */
    function objOutline(o) {
        const a = (o.rot || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
        let local;
        if (o.type === 'obstacle' && o.shape === 'cylinder') { local = Array.from({ length: 20 }, (_, k) => [o.w / 2 * Math.cos(k * Math.PI / 10), o.w / 2 * Math.sin(k * Math.PI / 10)]); }
        else {
            const hl = o.type === 'obstacle' ? o.w / 2 : o.length / 2;
            const hw = o.type === 'obstacle' ? o.d / 2 : (o.type === 'bump' ? o.width : o.diameter) / 2;
            local = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]];
        }
        return local.map(([u, v]) => [o.x + u * c - v * sn, o.y + u * sn + v * c]);
    }

    /** the object under a point (the last one drawn first; a thin one is grabbed within 8 mm) */
    function objectAt(x, y) {
        const list = draft.objects || [];
        for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            const a = -(o.rot || 0) * Math.PI / 180;
            const u = (x - o.x) * Math.cos(a) - (y - o.y) * Math.sin(a), v = (x - o.x) * Math.sin(a) + (y - o.y) * Math.cos(a);
            if (o.type === 'obstacle') {
                if (o.shape === 'cylinder' ? Math.hypot(u, v) <= o.w / 2 : Math.abs(u) <= o.w / 2 && Math.abs(v) <= o.d / 2) { return i; }
            } else {
                const hw = Math.max(8, (o.type === 'bump' ? o.width : o.diameter) / 2);
                if (Math.abs(u) <= o.length / 2 && Math.abs(v) <= hw) { return i; }
            }
        }
        return -1;
    }

    function draftBounds() {
        if (!draft.tiles.length) { return [-150, -150, 1650, 1650]; }
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const t of draft.tiles) { const r = rectOf(t); x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
        return [x0 * 300 - 450, y0 * 300 - 450, x1 * 300 + 450, y1 * 300 + 450];
    }

    function placeTile(id, col, row, rot) {
        const t = { id, col, row, rot };
        const z = autoZ(id, col, row, rot);
        if (z > 0) { t.z = z; }
        // what was on those cells goes
        draft.tiles = draft.tiles.filter((o) => !overlaps(o, t));
        draft.tiles.push(t);
        sel = draft.tiles.length - 1;
        edited();
    }

    function rotateTile(i, d) {
        const t = draft.tiles[i];
        t.rot = (t.rot + d) % 4;
        const keep = draft.tiles.filter((o, j) => j === i || !overlaps(o, t));
        sel = keep.indexOf(t);
        draft.tiles = keep;
        edited();
    }

    function removeTile(i) {
        draft.tiles.splice(i, 1);
        sel = undefined;
        edited();
    }

    /** the selected tile's height, or a seesaw or not */
    function setTileZ(i, z) {
        const t = draft.tiles[i];
        if (!(z >= 0)) { return; }
        if (z > 0) { t.z = Math.round(z * 100) / 100; } else { delete t.z; }
        const keep = draft.tiles.filter((o, j) => j === i || !overlaps(o, t));
        sel = keep.indexOf(t);
        draft.tiles = keep;
        edited();
    }

    /** the start: the side of the cell nearest the click (or a start tile's own start, near its middle) */
    function setStart(x, y) {
        const col = Math.floor(x / 300), row = Math.floor(y / 300);
        const i = tileAt(col, row);
        startMode = false;
        if (i < 0) { $('#mapErr').textContent = 'The start goes on a tile.'; mapPane(); return; }
        const u = x - col * 300, v = y - row * 300;
        const def = LIB.get(draft.tiles[i].id);
        let side;
        if (def.role === 'start' && Math.abs(u - 150) < 90 && Math.abs(v - 150) < 90) { side = 'C'; }
        else { side = [['S', v], ['N', 300 - v], ['W', u], ['E', 300 - u]].sort((a, b) => a[1] - b[1])[0][0]; }
        draft.start = { col, row, side };
        edited();
    }

    /** the marker place nearest the click (within 20 mm) on the tile there: put a marker down, or take it up */
    function toggleMarker(x, y) {
        const i = tileAt(Math.floor(x / 300), Math.floor(y / 300));
        if (i < 0) { return; }
        const t = draft.tiles[i], def = LIB.get(t.id);
        // the click in the tile's frame: undo its placement (turn, then a ramp's scale)
        const [w, h] = def.size, [pw, ph] = def.plan || def.size;
        let u = x - t.col * 300, v = y - t.row * 300;
        [u, v] = t.rot === 1 ? [v, ph - u] : t.rot === 2 ? [pw - u, ph - v] : t.rot === 3 ? [pw - v, u] : [u, v];
        u *= w / pw; v *= h / ph;
        let best = -1, bd = 20;
        (def.markers || []).forEach((m, k) => { const d = Math.hypot(m.at[0] - u, m.at[1] - v); if (d < bd) { bd = d; best = k; } });
        if (best < 0) { $('#mapErr').textContent = def.markers ? 'Click one of the dashed squares: a green marker goes in the corner of a junction.' : `#${def.id} has no junction for a green marker.`; return; }
        const g = new Set(t.green || []);
        if (g.has(best)) { g.delete(best); } else { g.add(best); }
        t.green = [...g].sort((a, b) => a - b);
        if (!t.green.length) { delete t.green; }
        sel = i;
        edited();
    }

    /** after every edit: ask the extension what the map makes, mark it unsaved, redraw */
    function edited() {
        dirty = true;
        $('#mapErr').textContent = '';
        checkSoon();
        palette();
        mapPane();
        draw();
    }

    function checkSoon() {
        clearTimeout(checkTimer);
        checkTimer = setTimeout(() => { mapSeq++; vscode.postMessage({ type: 'map-check', seq: mapSeq, map: draft }); }, 120);
    }

    function loadDraft(m, unsaved) {
        draft = JSON.parse(JSON.stringify(m));
        draft.version = 1;
        if (!Array.isArray(draft.tiles)) { draft.tiles = []; }
        dirty = !!unsaved;
        sel = undefined; pick = undefined; startMode = false; greenMode = false; mapInfo = undefined; pickObj = undefined; selObj = undefined;
        $('#mapName').value = draft.name || '';
        $('#mapErr').textContent = '';
        checkSoon();
        palette();
        mapPane();
        userView = false; fit(); draw();
    }

    function onMaps(m) {
        maps = m.maps || [];
        // the map being driven was deleted: back to the Rescue Line course
        if (courseId.startsWith('map:') && !mapOf(courseId)) { setCourse('rcj', true); } else { courseOptions(); }
        mapList();
        mapPane();
        if (m.saved) {
            dirty = false;
            mapPane();
            // the course being driven is this map: it is laid out again
            if (m.drive || courseId === 'map:' + m.saved) { setCourse('map:' + m.saved, true); }
            if (m.drive) { setPane(''); }
            showNote(m.drive ? `Driving "${m.saved}": put a program on the robot and Run it.` : `Saved "${m.saved}".`);
        }
    }

    function saveDraft(drive) {
        const name = $('#mapName').value.trim();
        if (!name) { $('#mapErr').textContent = 'Give the map a name first.'; $('#mapName').focus(); return; }
        draft.name = name;
        vscode.postMessage({ type: 'map-save', map: draft, drive });
    }

    /** a green marker's corners in a tile's frame: a 25 mm square in the corner of its junction, sides along the arms */
    function markerCorners(m) {
        const l = Math.hypot(m.at[0] - m.j[0], m.at[1] - m.j[1]);
        const d = [(m.at[0] - m.j[0]) / l, (m.at[1] - m.j[1]) / l];
        const u = [(d[0] - d[1]) * Math.SQRT1_2, (d[1] + d[0]) * Math.SQRT1_2], v = [-u[1], u[0]];
        return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [m.at[0] + 12.5 * (a * u[0] + b * v[0]), m.at[1] + 12.5 * (a * u[1] + b * v[1])]);
    }

    /** a tile of the library drawn in its own frame, as printed (y up): its lines and arcs, clipped to it, the green
     *  markers it carries, and (`slots`) where the others could go */
    function tileInk(c, def, green, slots) {
        const [w, h] = def.size;
        c.save();
        c.beginPath(); c.rect(0, 0, w, h); c.clip();
        c.lineCap = 'butt'; c.lineJoin = 'miter';
        for (const e of def.elements) {
            c.strokeStyle = e.color === 'red' ? '#e8231e' : '#111';
            c.lineWidth = e.w;
            c.beginPath();
            if (e.type === 'arc') { const a0 = e.from * Math.PI / 180, a1 = e.to * Math.PI / 180; c.arc(e.c[0], e.c[1], e.r, a0, a1, a1 < a0); }
            else { e.pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); }
            c.stroke();
        }
        (def.markers || []).forEach((m, k) => {
            const on = green && green.includes(k);
            if (!on && !slots) { return; }
            c.beginPath();
            markerCorners(m).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
            c.closePath();
            if (on) { c.fillStyle = '#2e9e4a'; c.fill(); } else { c.setLineDash([5, 4]); c.strokeStyle = '#2e9e4a'; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
        });
        c.restore();
    }

    /** the transform from a placed tile's frame to the world (mm, y up): turned, a ramp's slope seen from above */
    function tileTransform(c, t) {
        const def = LIB.get(t.id);
        const [w, h] = def.size, [pw, ph] = def.plan || def.size;
        c.translate(t.col * 300, t.row * 300);
        if (t.rot === 1) { c.translate(ph, 0); } else if (t.rot === 2) { c.translate(pw, ph); } else if (t.rot === 3) { c.translate(0, pw); }
        c.rotate(t.rot * Math.PI / 2);
        c.scale(pw / w, ph / h);
    }

    function paintBuilder() {
        const W = canvas.width, H = canvas.height;
        ctx.setTransform(view.k * dpr, 0, 0, -view.k * dpr, W / 2 - view.cx * view.k * dpr, H / 2 + view.cy * view.k * dpr);
        const x0 = wx(0), x1 = wx(W / dpr), y0 = wy(H / dpr), y1 = wy(0);
        const px = 1 / view.k / dpr;
        // the grid
        ctx.strokeStyle = 'rgba(127,127,127,0.35)';
        ctx.lineWidth = px;
        ctx.beginPath();
        for (let x = Math.floor(x0 / 300) * 300; x < x1; x += 300) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
        for (let y = Math.floor(y0 / 300) * 300; y < y1; y += 300) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
        ctx.stroke();
        // the tiles, lowest first (a bridge over the tile under it, see-through)
        const order = draft.tiles.map((t, i) => i).sort((a, b) => spanOf(draft.tiles[a])[1] - spanOf(draft.tiles[b])[1]);
        for (const i of order) {
            const t = draft.tiles[i], def = LIB.get(t.id);
            const r = rectOf(t);
            const view3 = { rect: [r[0] * 300, r[1] * 300, r[2] * 300, r[3] * 300], span: spanOf(t), rot: t.rot, ramp: !!def.plan, seesaw: !!t.seesaw };
            const bridge = draft.tiles.some((o) => o !== t && stacked(o, t) && spanOf(o)[1] < spanOf(t)[0] && overlapsCells(o, t));
            ctx.globalAlpha = bridge ? 0.8 : 1;
            tileBase(view3, -1);
            ctx.save(); tileTransform(ctx, t); tileInk(ctx, def, t.green, greenMode); ctx.restore();
            tileMarks(view3, 15);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = i === sel ? '#a8977b' : 'rgba(0,0,0,0.25)';
            ctx.lineWidth = i === sel ? 6 * px : px;
            if (bridge) { ctx.setLineDash([16 * px, 10 * px]); }
            ctx.strokeRect(r[0] * 300, r[1] * 300, (r[2] - r[0]) * 300, (r[3] - r[1]) * 300);
            ctx.setLineDash([]);
        }
        // the objects on them
        (draft.objects || []).forEach((o, i) => drawObject(o, i === selObj, false));
        // the line the robot follows, and its start
        if (mapInfo && mapInfo.ok && mapInfo.line.length > 1) {
            ctx.strokeStyle = 'rgba(42,120,214,0.8)';
            ctx.lineWidth = Math.max(3, 3 * px);
            ctx.lineJoin = 'round';
            ctx.setLineDash([12, 10]);
            ctx.beginPath();
            mapInfo.line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
            ctx.setLineDash([]);
            startArrow(mapInfo.start);
        }
        // the tile about to be placed, or the start about to be set
        if (hover && pick) {
            const t = { id: pick, col: hover.col, row: hover.row, rot: pickRot };
            const r = rectOf(t);
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(r[0] * 300, r[1] * 300, (r[2] - r[0]) * 300, (r[3] - r[1]) * 300);
            ctx.save(); tileTransform(ctx, t); tileInk(ctx, LIB.get(pick)); ctx.restore();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#5f9e88';
            ctx.lineWidth = 4 * px;
            ctx.strokeRect(r[0] * 300, r[1] * 300, (r[2] - r[0]) * 300, (r[3] - r[1]) * 300);
        } else if (hover && startMode) {
            ctx.strokeStyle = '#5f9e88';
            ctx.lineWidth = 4 * px;
            ctx.strokeRect(hover.col * 300, hover.row * 300, 300, 300);
        } else if (hoverPt && pickObj) {
            drawObject({ type: pickObj, x: snap5(hoverPt[0]), y: snap5(hoverPt[1]), ...OBJ_DEFAULTS[pickObj] }, false, true);
        }
    }

    function overlapsCells(a, b) {
        const p = rectOf(a), q = rectOf(b);
        return p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
    }

    /** an object of the map as the builder shows it: an obstacle with its height (fixed ones darker), a speed bump's
     *  band and crest, a piece of debris */
    function drawObject(o, selected, ghost) {
        const pts = objOutline(o);
        const px = 1 / view.k / dpr;
        ctx.globalAlpha = ghost ? 0.55 : 1;
        if (o.type === 'obstacle') {
            ctx.fillStyle = o.mass > 0 ? '#b5523b' : '#7d3b30';
            ctx.strokeStyle = '#2b1b17';
        } else if (o.type === 'bump') {
            ctx.fillStyle = 'rgba(160,160,160,0.35)';
            ctx.strokeStyle = 'rgba(90,90,90,0.9)';
        } else {
            ctx.fillStyle = '#b8935a';
            ctx.strokeStyle = '#7a5a2e';
        }
        ctx.lineWidth = Math.max(1, 1.2 * px);
        poly(pts); ctx.fill(); ctx.stroke();
        if (o.type === 'obstacle') { label(`${Math.round(o.h)}${o.mass > 0 ? '' : ' fixed'}`, o.x, o.y, '#ffffff', 10); }
        if (selected) {
            ctx.strokeStyle = '#a8977b';
            ctx.lineWidth = 4 * px;
            const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), m = 8;
            ctx.strokeRect(Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) - Math.min(...xs) + 2 * m, Math.max(...ys) - Math.min(...ys) + 2 * m);
        }
        ctx.globalAlpha = 1;
    }

    function startArrow(s) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.heading * Math.PI / 180);
        ctx.fillStyle = 'rgba(95,158,136,0.95)';
        ctx.beginPath(); ctx.moveTo(45, 0); ctx.lineTo(-25, 32); ctx.lineTo(-10, 0); ctx.lineTo(-25, -32); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    /** the library, as buttons with a picture of each tile; how many of each the draft uses against the set's count */
    function palette() {
        const box = $('#palette');
        if (!box) { return; }
        const used = new Map();
        for (const t of draft.tiles) { used.set(t.id, (used.get(t.id) || 0) + 1); }
        box.textContent = '';
        for (const def of LIB.values()) {
            const n = used.get(def.id) || 0;
            const d = window.devicePixelRatio || 1;
            const cv = el('canvas', { width: String(Math.round(64 * d)), height: String(Math.round(64 * d)), 'aria-hidden': 'true' });
            const c = cv.getContext('2d');
            const [pw, ph] = def.plan || def.size;
            const k = 60 / Math.max(pw, ph);
            c.setTransform(k * d, 0, 0, -k * d, (32 - pw * k / 2) * d, (32 + ph * k / 2) * d);
            c.fillStyle = '#ffffff'; c.fillRect(0, 0, pw, ph);
            c.strokeStyle = '#bbb'; c.lineWidth = 1 / k; c.strokeRect(0, 0, pw, ph);
            c.scale(pw / def.size[0], ph / def.size[1]);
            tileInk(c, def);
            const b = el('button', {
                type: 'button', class: 'tile' + (pick === def.id ? ' on' : ''),
                title: `#${def.id} ${def.name}${def.elevated ? ' (on a raised platform)' : ''}${def.plan ? ` (a ramp: ${def.size[1]} mm of slope, ${def.plan[1]} mm seen from above)` : ''}: the set has ${def.count}. Click, then click the grid to place it; R or a right click turns it.`,
                onclick: () => { pick = pick === def.id ? undefined : def.id; pickObj = undefined; startMode = false; greenMode = false; sel = undefined; selObj = undefined; palette(); mapPane(); draw(); },
            }, cv, el('span', { class: 'id' }, '#' + def.id), el('span', { class: 'nm' }, def.name), el('span', { class: 'ct' + (n > def.count ? ' over' : '') }, `${n} / ${def.count}`));
            box.append(b);
        }
    }

    function mapList() {
        const s = $('#mapLoad');
        if (!s) { return; }
        s.textContent = '';
        s.append(el('option', { value: '' }, 'Open…'), el('option', { value: '#sample' }, 'Tile set sample (a copy)'), el('option', { value: '#hazards' }, 'Hazards sample (a copy)'));
        for (const m of maps) { s.append(el('option', { value: 'map:' + m.name }, m.name)); }
        s.value = '';
    }

    /** the pane's state: the selected tile, the save button, the report of the line */
    function mapPane() {
        if (!$('#mapPane')) { return; }
        $('#mapSave').textContent = dirty ? 'Save *' : 'Save';
        $('#mapDelete').disabled = !maps.some((m) => m.name === $('#mapName').value.trim());
        $('#mapStart').classList.toggle('on', startMode);
        $('#mapGreen').classList.toggle('on', greenMode);
        for (const [id, type] of [['#mapObs', 'obstacle'], ['#mapBump', 'bump'], ['#mapDebris', 'debris']]) { $(id).classList.toggle('on', pickObj === type); }
        const t = sel !== undefined ? draft.tiles[sel] : undefined;
        const def = t && LIB.get(t.id);
        const ob = selObj !== undefined && draft.objects ? draft.objects[selObj] : undefined;
        const OBJ_NAME = { obstacle: 'an obstacle', bump: 'a speed bump', debris: 'a piece of debris' };
        $('#mapSel').textContent = pick ? `Placing #${pick} ${LIB.get(pick).name}, turned ${pickRot * 90}°: click the grid (R turns it, Esc stops). It takes the height of the tile it joins.`
            : pickObj ? `Placing ${OBJ_NAME[pickObj]}: click where it goes (Shift+click: on the tile under a bridge; Esc stops). Select it to set its size; R turns it 15°.`
                : startMode ? 'Click a tile near the side the robot comes in by (a Start tile: near its middle).'
                    : greenMode ? 'Click a dashed square to put a green marker down, a marker to take it up. Before a junction, a marker on the robot\'s left turns it left, on its right turns it right, one on each side turns it round; none sends it straight on.'
                        : ob ? `${OBJ_NAME[ob.type][0].toUpperCase()}${OBJ_NAME[ob.type].slice(1)} at (${ob.x}, ${ob.y}) mm, turned ${ob.rot || 0}°: drag it to move it, R turns it, Delete removes it.`
                            : def ? `#${def.id} ${def.name} at (${t.col}, ${t.row}), turned ${t.rot * 90}°.` : 'Pick a tile below, then click the grid to place it.';
        $('#mapRot').disabled = !t && !pick && !ob;
        $('#mapDel').disabled = !t && !ob;
        mapProps(t, def, ob);
        mapReport();
    }

    /** the selected tile's height and seesaw, or the selected object's sizes */
    function mapProps(t, def, ob) {
        const box = $('#mapProps');
        box.textContent = '';
        const field = (label, value, attrs, set, unit) => {
            const inp = numIn(value, { ...attrs });
            inp.addEventListener('change', () => { const v = Number(inp.value); if (Number.isFinite(v)) { set(v); } });
            return [el('label', {}, label), el('div', {}, inp, unit ? ` ${unit}` : '')];
        };
        if (t) {
            const items = [...field('Height', t.z || 0, { min: 0, max: 1000, step: 0.5 }, (v) => setTileZ(sel, v), def.plan ? 'mm at its low end' : 'mm')];
            if (def.plan) { items.push(el('span', {}), el('span', { class: 'sub' }, `climbs ${riseOf(def).toFixed(1)} mm to its drawn top`)); }
            if (def.id === '10' || def.id === '10E') {
                const c = el('input', { type: 'checkbox' });
                c.checked = !!t.seesaw;
                c.addEventListener('change', () => { if (c.checked) { t.seesaw = true; } else { delete t.seesaw; } edited(); });
                items.push(el('label', {}, 'Seesaw'), el('label', { class: 'inline' }, c, `tilts ${S3.deg}° about its middle, its drawn bottom down`));
            }
            box.append(el('div', { class: 'grid' }, ...items));
        } else if (ob) {
            const set = (k) => (v) => { ob[k] = v; edited(); };
            const items = [];
            if (ob.type === 'obstacle') {
                const shape = el('select', {}, ...['box', 'cylinder'].map((v) => { const o = el('option', { value: v }, v); if (v === ob.shape) { o.selected = true; } return o; }));
                shape.addEventListener('change', () => { ob.shape = shape.value; if (ob.shape === 'cylinder') { ob.d = ob.w; } edited(); });
                items.push(el('label', {}, 'Shape'), shape);
                items.push(...field(ob.shape === 'cylinder' ? 'Diameter' : 'Width', ob.w, { min: 10, max: 600 }, (v) => { ob.w = v; if (ob.shape === 'cylinder') { ob.d = v; } edited(); }, 'mm'));
                if (ob.shape !== 'cylinder') { items.push(...field('Depth', ob.d, { min: 10, max: 600 }, set('d'), 'mm')); }
                items.push(...field('Height', ob.h, { min: 10, max: 600 }, set('h'), 'mm (rules: 150 or more)'));
                items.push(...field('Mass', ob.mass, { min: 0, max: 20000, step: 10 }, set('mass'), 'g (0: fixed to the floor)'));
            } else if (ob.type === 'bump') {
                items.push(...field('Length', ob.length, { min: 20, max: 900 }, set('length'), 'mm'));
                items.push(...field('Width', ob.width, { min: 5, max: 150 }, set('width'), 'mm'));
                items.push(...field('Height', ob.height, { min: 1, max: 10 }, set('height'), 'mm (at most 10)'));
            } else {
                items.push(...field('Length', ob.length, { min: 5, max: 300 }, set('length'), 'mm'));
                items.push(...field('Diameter', ob.diameter, { min: 0.5, max: 3, step: 0.5 }, set('diameter'), 'mm (at most 3)'));
            }
            items.push(...field('Turned', ob.rot || 0, { min: -360, max: 360, step: 15 }, set('rot'), '°'));
            box.append(el('div', { class: 'grid' }, ...items));
        }
    }

    function mapReport() {
        const box = $('#mapReport');
        if (!box) { return; }
        box.textContent = '';
        if (!draft.tiles.length) { box.append(el('p', { class: 'sub' }, 'An empty map: place a Start tile (#1), the tiles of the course and a Goal (#99).')); return; }
        if (!mapInfo) { return; }
        if (!mapInfo.ok) { box.append(el('p', { class: 'err' }, mapInfo.error)); return; }
        const r = mapInfo.report;
        box.append(el('p', {}, `${r.tiles} tile${r.tiles === 1 ? '' : 's'}${r.markers ? `, ${r.markers} green marker${r.markers === 1 ? '' : 's'}` : ''}; the line from the start crosses ${r.onRoute}: ${(r.length / 1000).toFixed(2)} m${r.loop ? ', a loop' : r.endsAtGoal ? ', to the Goal' : ''}.`));
        const hz = r.hazards || {};
        const parts = [['ramps', 'ramp tile'], ['raised', 'raised tile'], ['bridges', 'bridge'], ['seesaws', 'seesaw'], ['bumps', 'speed bump'], ['debris', 'piece of debris'], ['obstacles', 'obstacle']]
            .filter(([k]) => hz[k]).map(([k, n]) => `${hz[k]} ${hz[k] === 1 ? n : n === 'piece of debris' ? 'pieces of debris' : n + 's'}`);
        if (parts.length) { box.append(el('p', { class: 'sub' }, `3D: ${parts.join(', ')}.`)); }
        if (r.warnings.length) { box.append(el('ul', { class: 'warn' }, ...r.warnings.map((w) => el('li', {}, w)))); }
    }

    function setPane(name) {
        document.body.classList.toggle('config', name === 'config');
        document.body.classList.toggle('builder', name === 'builder');
        $('#cfgBtn').classList.toggle('on', name === 'config');
        $('#mapBtn').classList.toggle('on', name === 'builder');
        if (name === 'builder') {
            // the builder opens on the map being driven, or on what it held
            const m = mapOf(courseId);
            if (m && !dirty && draft.name !== m.name) { loadDraft(m, false); } else { checkSoon(); palette(); mapPane(); }
        } else {
            pick = undefined; pickObj = undefined; startMode = false; greenMode = false; hover = undefined;
        }
        userView = false;
        if (name === 'builder' && mode3d) { canvas.hidden = false; canvas3d.hidden = true; } else if (mode3d) { canvas.hidden = true; canvas3d.hidden = false; }
        resize();
    }

    function mapPaneDom() {
        return el('div', { id: 'mapPane', class: 'pane' },
            el('h2', {}, 'Map builder'),
            el('p', { class: 'sub' }, 'Tiles of a RoboCup Junior Rescue Line set (300 mm). Place them on the grid, turn them (R, or a right click), drag them to move them, Delete to remove one; green markers tell the robot where to turn at a junction. Give a tile a height to raise it (260 mm or more: a bridge, another tile may go under it; Shift+click picks the lower one), make a straight a seesaw, and put obstacles, speed bumps and debris on the course. The dashed line is the line the robot follows from the start, the arrow where it starts.'),
            el('div', { class: 'grid' },
                el('label', { for: 'mapName' }, 'Name'), el('input', { type: 'text', id: 'mapName', maxlength: '60', placeholder: 'My map', oninput: () => { dirty = true; mapPane(); } }),
            ),
            el('div', { class: 'actions' },
                el('button', { class: 'btn primary', type: 'button', title: 'Save the map and make it the course', onclick: () => saveDraft(true) }, 'Drive this map'),
                el('button', { class: 'btn', type: 'button', id: 'mapSave', title: 'Keep the map (it is listed under Course)', onclick: () => saveDraft(false) }, 'Save'),
                el('select', { id: 'mapLoad', title: 'Open a map you saved, or a copy of the sample', onchange: (e) => {
                    const v = e.target.value;
                    if (v === '#sample') { loadDraft({ ...cfg.sample, name: 'My map' }, true); }
                    else if (v === '#hazards') { loadDraft({ ...cfg.hazards, name: 'My hazards map' }, true); }
                    else if (mapOf(v)) { loadDraft(mapOf(v), false); }
                    e.target.value = '';
                } }),
                el('button', { class: 'btn', type: 'button', title: 'Start again with an empty map', onclick: () => loadDraft({ version: 1, name: '', tiles: [] }, false) }, 'New'),
            ),
            el('div', { class: 'actions' },
                el('button', { class: 'btn', type: 'button', id: 'mapDelete', title: 'Delete the saved map of this name', onclick: () => vscode.postMessage({ type: 'map-delete', name: $('#mapName').value.trim() }) }, 'Delete'),
                el('button', { class: 'btn', type: 'button', title: 'Write the map to a file (to share it)', onclick: () => { draft.name = $('#mapName').value.trim() || 'untitled'; vscode.postMessage({ type: 'map-export', map: draft }); } }, 'Export…'),
                el('button', { class: 'btn', type: 'button', title: 'Open a map from a file', onclick: () => vscode.postMessage({ type: 'map-import' }) }, 'Import…'),
            ),
            el('div', { class: 'err', id: 'mapErr' }),
            el('div', { class: 'card selbox' },
                el('div', { id: 'mapSel' }),
                el('div', { class: 'actions' },
                    el('button', { class: 'btn', type: 'button', id: 'mapRot', title: 'Turn it a quarter turn, an object 15° (R)', onclick: () => { if (pick) { pickRot = (pickRot + 1) % 4; mapPane(); draw(); } else if (selObj !== undefined) { rotateObject(selObj, 1); } else if (sel !== undefined) { rotateTile(sel, 1); } } }, 'Turn'),
                    el('button', { class: 'btn', type: 'button', id: 'mapDel', title: 'Remove it (Delete)', onclick: () => { if (selObj !== undefined) { removeObject(selObj); } else if (sel !== undefined) { removeTile(sel); } } }, 'Remove'),
                    el('button', { class: 'btn', type: 'button', id: 'mapStart', title: 'Set where the robot starts: click a tile near the side it comes in by', onclick: () => { startMode = !startMode; greenMode = false; pick = undefined; palette(); mapPane(); draw(); } }, 'Set start'),
                    el('button', { class: 'btn', type: 'button', id: 'mapGreen', title: 'Put green intersection markers down: click a dashed square at a junction (click again to take it up)', onclick: () => { greenMode = !greenMode; startMode = false; pick = undefined; pickObj = undefined; palette(); mapPane(); draw(); } }, 'Green markers'),
                ),
                el('div', { class: 'actions' },
                    ...[['mapObs', 'obstacle', 'Obstacle', 'A brick, a block or a weight on the course (rules 3.5: 150 mm or more high; heavy, fixed, or light enough to push)'],
                        ['mapBump', 'bump', 'Speed bump', 'A speed bump across the line (rules 3.5: at most 10 mm high, fixed to the floor)'],
                        ['mapDebris', 'debris', 'Debris', 'A toothpick or a dowel lying loose (rules 3.5: at most 3 mm thick)']].map(([id, type, text, title]) =>
                        el('button', { class: 'btn', type: 'button', id, title, onclick: () => { pickObj = pickObj === type ? undefined : type; pick = undefined; startMode = false; greenMode = false; sel = undefined; selObj = undefined; palette(); mapPane(); draw(); } }, text)),
                ),
                el('div', { id: 'mapProps' }),
            ),
            el('div', { id: 'mapReport' }),
            el('h2', {}, 'Tiles'),
            el('p', { class: 'sub' }, 'Under each tile: how many this map uses, of how many the set has. A ramp climbs from the height it is given at its drawn bottom; a tile placed next to another takes its height there.'),
            el('div', { id: 'palette' }),
        );
    }

    /* ---- the page ------------------------------------------------------------------------------------------- */
    function build() {
        const courseSel = el('select', { id: 'course', title: 'The course on the floor', onchange: (e) => pickCourse(e.target.value) });
        const speedSel = el('select', { id: 'speed', title: 'How fast simulated time runs against the clock', onchange: (e) => { setSpeed(Number(e.target.value)); } },
            ...[0.25, 0.5, 1, 2, 4].map((v) => { const o = el('option', { value: String(v) }, `${v}×`); if (v === speed) { o.selected = true; } return o; }));
        const app = $('#app');
        app.append(
            el('header', {},
                el('h1', {}, 'EVN Simulator'),
                el('span', { id: 'status', class: 'chip' }, el('span', { class: 'dot' }), el('span', { id: 'statusText' }, 'starting')),
                el('span', { id: 'conn', class: 'chip', title: 'What the extension is doing with the simulated board' }),
                el('button', { id: 'licence', class: 'chip', type: 'button', onclick: () => vscode.postMessage({ type: 'licence' }) }),
                el('span', { class: 'spacer' }),
                el('label', { class: 'inline' }, 'Course', courseSel),
                el('label', { class: 'inline' }, 'Speed', speedSel),
                el('button', { class: 'btn', id: 'resetBtn', title: 'Put the robot back at the start (when no program runs)', onclick: () => { place(undefined); } }, 'Back to start'),
                el('button', { class: 'btn', id: 'followBtn', title: 'Keep the robot in the middle of the view (in 3D: follow it from behind)', onclick: (e) => { follow = !follow; e.currentTarget.classList.toggle('on', follow); if (v3) { v3.follow = follow; } if (!follow) { userView = false; fit(); draw(); } } }, 'Follow'),
                el('button', { class: 'btn', id: 'view3dBtn', title: 'See the course and the robot in 3D (drag to turn the view, Shift+drag to move it, scroll to zoom)', onclick: () => set3d(!mode3d) }, '3D'),
                el('button', { class: 'btn', id: 'btnBtn', title: 'The board\'s user button (hold to press): evn.button.pressed()', onpointerdown: () => pressButton(true), onpointerup: () => pressButton(false), onpointerleave: () => pressButton(false) }, 'Button'),
                el('button', { class: 'btn', id: 'newBtn', title: 'A first line follower for this robot, in your projects folder: run it with Ctrl+F5', onclick: () => vscode.postMessage({ type: 'new-program' }) }, 'New program'),
                el('button', { class: 'btn stop', id: 'stopBtn', title: 'Stop the program (Ctrl-C): every motor coasts', disabled: '', onclick: () => vscode.postMessage({ type: 'stop' }) }, 'Stop'),
                el('button', { class: 'btn', id: 'mapBtn', title: 'Build a course of Rescue Line tiles', onclick: () => setPane(builder() ? '' : 'builder') }, 'Map builder'),
                el('button', { class: 'btn', id: 'cfgBtn', title: 'The simulated robot\'s hardware', onclick: () => setPane(document.body.classList.contains('config') ? '' : 'config') }, 'Configure robot'),
            ),
            el('div', { class: 'main' },
                el('div', { class: 'stage' },
                    canvas, canvas3d,
                    el('div', { class: 'hud' },
                        el('div', { class: 'card' }, el('div', { class: 'row' },
                            el('span', { title: 'The run\'s stopwatch: from the moment the robot first moved after it was put down' }, el('span', { class: 'k' }, 'time '), el('span', { class: 'v', id: 'hT' }, '-')),
                            el('span', {}, el('span', { class: 'k' }, 'off the line '), el('span', { class: 'v', id: 'hLine' }, '-')),
                            el('span', {}, el('span', { class: 'k' }, 'course '), el('span', { class: 'v', id: 'hProg' }, '-')),
                            el('span', {}, el('span', { class: 'k' }, 'battery '), el('span', { class: 'v', id: 'hBat' }, '-')),
                            el('span', { class: 'only3d', title: 'How high the robot\'s wheels stand (mm), and its pitch (nose up +) and roll (left side up +)' }, el('span', { class: 'k' }, 'height '), el('span', { class: 'v', id: 'hZ' }, '-')),
                            el('span', { class: 'finish', id: 'hFin' }),
                        )),
                        el('div', { class: 'card bars', id: 'bars' }),
                    ),
                    el('div', { class: 'hint run-only only2d' }, 'Drag the robot to move it, its handle to turn it (Shift: 15° steps). Drag the floor to pan, scroll to zoom.'),
                    el('div', { class: 'hint run-only only3d-view' }, 'Drag to turn the view, Shift+drag (or a right drag) to move it, scroll to zoom. Follow follows the robot. The robot is moved in the 2D view.'),
                    el('div', { class: 'hint build-only' }, 'Click to place the picked tile, drag a tile to move it, R or a right click turns it, Delete removes it. Drag the floor to pan, scroll to zoom.'),
                    el('div', { class: 'note card', id: 'note', hidden: '' }),
                    el('div', { class: 'loading', id: 'loading' }, 'Starting the simulated board (Python)…'),
                ),
                el('aside', {},
                    el('div', { id: 'cfgPane', class: 'pane' },
                        el('div', { id: 'cfgForm', style: 'display:flex;flex-direction:column;gap:10px' }),
                        el('div', { class: 'err', id: 'cfgErr' }),
                        el('div', { class: 'actions' },
                            el('button', { class: 'btn primary', type: 'button', onclick: () => { clearErr(); vscode.postMessage({ type: 'apply-hw', hw: readForm() }); } }, 'Apply'),
                            el('button', { class: 'btn', type: 'button', onclick: () => { clearErr(); vscode.postMessage({ type: 'default-hw' }); } }, 'Defaults'),
                            el('button', { class: 'btn', type: 'button', title: 'Copy the program lines this robot needs', onclick: () => vscode.postMessage({ type: 'copy', text: setupCode(readForm()) }) }, 'Copy setup code'),
                        ),
                        el('h2', {}, 'This robot in a program'),
                        el('pre', { class: 'code', id: 'setup' }),
                        el('p', { class: 'sub' }, 'Applying a change restarts the simulated board: a running program stops and the robot goes back to where it is, with its motors coasting.'),
                    ),
                    mapPaneDom(),
                ),
            ),
        );
        courseOptions();
        mapList();
        buildConfig();
        setLicence(cfg.licence);
        if (cfg.configure) { setPane('config'); }
    }

    build();
    resize();
    start(undefined);
    void starting;
})();
