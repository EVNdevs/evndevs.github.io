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
    // the page's script nonce: pdf.js (the WRO mat, media/sim/wroMat.js) is loaded with it when a mat is
    const nonce = (document.currentScript && document.currentScript.nonce) || '';
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
    /** the cameras' last run id (camera.ts CameraRig): the host's at the panel's start (cfg.camRun), then each `run` the
     *  simulation worker posts; a new worker (a restart) counts on from it, so the host's stream never sees a run id go
     *  back (review rcjcam r1 B2) */
    let camRun = cfg.camRun || 0;
    let ready = false;
    let running;                // the id of the exec the worker is running
    const pending = new Map();  // every exec sent and not yet answered: id -> { source, run } (a restart sends them again,
                                // each with its Run mark: docs/SIMULATOR_WRO_DESIGN.md §6)
    let snap;
    /** the last snapshot the worker posted, never written here (a drag writes `snap`'s pose): what a restart starts from
     *  (design §6 the restart path, W3b) */
    let posted;
    /** the last snapshot that carried a rigid course's state bytes (hazards.engine: every bytesEvery(n)-th frame, runtime.ts - every 4th up to 40 objects, every 12th on Senior's 75 bodies;
     *  §1.7 2's cost rule, J3c-2): a restart starts from it when the last posted has none; dropped at a course switch */
    let postedBytes;
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
    // the line tiles that may be laid as a ramp, as one (tiles.ts slopedDef; rules 3.7.5)
    const SLOPED = new Map((cfg.slopedTiles || []).map((t) => [`${t.id}^${t.uphill || 0}`, t]));
    /** a draft tile's ramp way (tiles.ts rampTurn): quarter turns of its uphill from its drawn +y, -1 not a ramp */
    const turnOf = (t) => (t.ramp === true ? 0 : typeof t.ramp === 'number' ? t.ramp : -1);
    /** a placed tile's definition (tiles.ts placedDef): the map's own tile (custOf, the tile editor), its library tile,
     *  or that tile laid as a ramp */
    const defOf = (t) => custOf(t) || (turnOf(t) >= 0 && SLOPED.get(`${t.id}^${turnOf(t)}`)) || LIB.get(t.id);
    /** a draft tile's uphill (a ramp) or drawn +y in the world: an index into ALONG */
    const upOf = (t) => (t.rot + Math.max(0, turnOf(t))) % 4;
    /** is it a ramp (tiles.ts isRamp): one of the set's, or a line tile laid as one - every ramp rule here keys on it */
    const isRamp = (def) => !!def.plan;
    let maps = cfg.maps || [];
    let draft = { version: 1, name: '', tiles: [] };
    let dirty = false;
    let pick;               // the library tile being placed (its id), or undefined
    let pickRot = 0;
    let sel;                // the selected tile of the draft (its index)
    let hover;              // the grid cell under the mouse { col, row }
    let startMode = false;  // the next click sets the start
    let greenMode = false;  // clicks put green markers down (and take them up)
    let vicSeed = 1, vicFakes = 0;   // the builder's "Randomise victims" seed (the next one after each use) and fakes
    let pickObj;            // the kind of object being placed: 'obstacle', 'bump', 'debris', or undefined
    let selObj;             // the selected object of the draft (its index)
    let zoneMode = false;   // the next click puts the evacuation zone down (moves it, when the draft has one)
    let selZone = false;    // the evacuation zone is selected
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

    /* ---- the physics engine (J4; SIMULATOR_ENGINE_DESIGN.md §1.3 "Loading"): the Jolt build's two files, fetched lazily
     * when the first rigid course is picked (cfg.rigidCourses: the WRO Junior table) and posted with that course's `init`
     * / `course` only - an RCJ worker is never sent them. The worker hashes both against the pin and refuses a mismatch. */
    let joltBytes;
    const needsEngine = (id) => (cfg.rigidCourses || []).includes(id);
    function loadJoltBytes() {
        if (!joltBytes) {
            const get = (url, how) => fetch(url).then((r) => { if (!r.ok) { throw new Error(`${url.split('/').pop()}: ${r.status}`); } return r[how](); });
            joltBytes = Promise.all([get(cfg.joltUrl + 'jolt.glue.js', 'text'), get(cfg.joltUrl + 'jolt.wasm', 'arrayBuffer')]).then(([glue, wasm]) => ({ glue, wasm }));
            joltBytes.catch(() => { joltBytes = undefined; });
        }
        return joltBytes;
    }
    /** a copy of the bytes for one message (a worker restarted later needs them again) */
    const joltFor = (j) => ({ jolt: { glue: j.glue, wasm: j.wasm.slice(0) } });

    /* ---- a WRO course's package (D230, owner 2026-11-05 "Load on first use"): its files (cfg.wroPackages: game.json,
     * the mat, the models...) fetched from cfg.wroUrl the first time the course is picked, kept, and posted with that
     * course's `init` / `course` only - no worker is sent a course's files before the course is picked. The worker
     * sha256-checks each file against its pin (wroStore.ts) and refuses a mismatch by name. Each URL carries the file's
     * pin (cfg.wroPins: ?<sha256 16>), so no cache serves another release's copy (review lazy r1 A S1); a text the
     * worker refused is dropped (wroRefused), so the next pick fetches it again. */
    const wroTexts = new Map();
    function wroFor(id) {
        const rels = (cfg.wroPackages || {})[id];
        if (!rels) { return Promise.resolve({}); }
        const get = (rel) => {
            if (!wroTexts.has(rel)) {
                const pin = String((cfg.wroPins || {})[rel] || '').slice(0, 16);
                const p = fetch(cfg.wroUrl + rel + (pin ? `?${pin}` : '')).then((r) => { if (!r.ok) { throw new Error(`${rel}: ${r.status}`); } return r.text(); });
                p.catch(() => { wroTexts.delete(rel); });
                wroTexts.set(rel, p);
            }
            return wroTexts.get(rel);
        };
        return Promise.all(rels.map(get)).then((texts) => ({ wroPkg: { files: Object.fromEntries(rels.map((r, i) => [r, texts[i]])) } }));
    }
    /** a worker's error naming a package file it refused (wroStore.ts WroPackageError): that text is not kept */
    function wroRefused(message) {
        const m = /package file (\S+): /.exec(String(message || ''));
        if (m) { wroTexts.delete(m[1]); }
    }

    function start(state) {
        ready = false;
        // the course this start is for, read once (review lazy r1 A B2): a course picked while its files load goes as a
        // `course` message after this init, never as this init's id with another course's files
        const id = courseId;
        starting = (async () => {
            const a = await loadAssets();
            const jolt = needsEngine(id) ? joltFor(await loadJoltBytes()) : {};
            const wro = await wroFor(id);
            const shared = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated;
            ctl = shared ? new Int32Array(new SharedArrayBuffer(32)) : undefined;
            if (ctl) { new Float64Array(ctl.buffer, 16, 1)[0] = speed; }
            worker = new Worker(a.worker, { type: 'module', name: 'EVN simulator' });
            worker.onmessage = (ev) => onWorker(ev.data);
            worker.onerror = (ev) => { showNote(`The simulator stopped: ${ev.message || 'an error in the worker'}`, true); setStatus('err', 'stopped'); };
            const p = a.pyodide;
            // ...wroFields: a loaded WRO mat's raster (a copy), so a restarted worker has the mat too (§3.2)
            // a restart state with a field (a WRO table): the referee settings too, applied before the restore, so the
            // settings sent at `ready` lay nothing again (W3b, §6); without one (RCJ) the init is as before
            worker.postMessage({ type: 'init', pyodide: { asm: p.asm, wasm: p.wasm.slice(0), stdlib: p.stdlib.slice(0), lock: p.lock }, evn: a.evn, boot: a.boot,
                version: cfg.version, hw, course: id, map: mapOf(id), ctl: ctl ? ctl.buffer : undefined, state, files, written, speed, camRun, ...wroFields().fields, ...(state && state.field ? { referee: refSet } : {}), ...jolt, ...wro });
            while (outbox.length) { worker.postMessage(outbox.shift()); }
        })().catch((e) => { showNote(`The simulator could not start: ${e && e.message || e}`, true); setStatus('err', 'not started'); });
    }

    /** what comes for the board while its worker is (re)starting waits here, in order: the worker queues it behind
     *  its own start (the coast after a stopped run, the next Run) */
    const outbox = [];
    /** while a rigid course's engine files are on their way, its `course` (a slot filled when they come) and everything
     *  after it wait here, in order */
    const held = [];
    function post0(m, transfer) { if (worker) { worker.postMessage(m, transfer || []); } else { outbox.push(m); } }
    function toWorker(m, transfer) { if (held.length) { held.push({ m, transfer, ready: true }); } else { post0(m, transfer); } }
    function flushHeld() { while (held.length && held[0].ready) { const e = held.shift(); post0(e.m, e.transfer); } }

    function onWorker(m) {
        switch (m.type) {
            case 'ready':
                ready = true;
                live = !!m.live;
                $('#loading').hidden = true;
                setStatus('', 'idle');
                if (m.snap) {
                    // a Run waiting on this start reads from what the board restored, which may be older than `snap` (restartFrame)
                    if ([...pending.values()].some((p) => p.run)) { plotZero(m.snap); } else { plotCarry(m.snap); }
                    onSnap(m.snap);
                }
                toWorker({ type: 'referee', op: 'settings', settings: refSet });
                trailResync();
                vscode.postMessage({ type: 'ready', shared: !!m.sab, live });
                camHw();
                return;
            case 'geom': geom = m.geom; trail.length = 0; toolsNewCourse(geom.id); if (!userView) { fit(); } if (v3) { v3.setGeom(geom); } camGeom(); draw(); return;
            case 'wro-schematic': if (wros) { wros.schematic(m.mat, m.rgb, canvas2d); } return;
            case 'cam': onCam(m); return;
            case 'busy': running = m.id; if (pending.get(m.id)?.behind) { plotRun(); } setStatus('run', 'running a program'); return;
            case 'out': if (plot.on) { plotOut(m.text); } vscode.postMessage({ type: 'out', id: m.id, text: m.text }); return;
            case 'interrupting': clearTimeout(stopWatch); return;
            case 'written':
                // a program's files: kept for a worker started again, and to the Board view (SimWorld.programFiles)
                for (const [n, b] of Object.entries(m.files || {})) { written[n] = b; }
                vscode.postMessage({ type: 'written', files: m.files || {} });
                return;
            case 'trail': onTrail(m); return;
            case 'done':
                if (running === m.id) { running = undefined; clearTimeout(stopWatch); }
                if (pending.get(m.id)?.run) { trailRunEnd(m.id); }
                pending.delete(m.id);
                if (!pending.size) { setStatus('', 'idle'); }
                if (m.snap) { onSnap(m.snap); }
                vscode.postMessage({ type: 'done', id: m.id, err: m.err || '' });
                return;
            case 'snap': onSnap(m.snap); return;
            case 'led': led = !!m.on; draw(); return;
            // the referee's 4.2.8 restart at a lack of progress: the extension restarts the board, main.py with it
            case 'referee-restart': vscode.postMessage({ type: 'referee-restart' }); return;
            case 'error':
                wroRefused(m.message);
                showNote(`Simulator: ${m.message}`, true);
                vscode.postMessage({ type: 'error', id: m.id, message: m.message });
                return;
        }
    }

    /** Ctrl-C: through shared memory, else as a message the running program takes in at its next turn (live), else -
     *  or when it takes no turn within STOP_WAIT_MS - end the worker (the program with it) and start again from here */
    function interrupt() {
        // on a course with game blocks the panel's Stop is the team's STOP (WRO 10.7.5): the referee told first, so the
        // run ends with Stop's reason once the robot stands still (W3a review r1 S2)
        if (gameCourse()) { toWorker({ type: 'referee', op: 'end', by: 'stop' }); }
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
        for (const [pid, p] of pending) { outbox.push({ type: 'exec', id: pid, source: p.source, ...(p.run ? { run: p.run } : {}) }); }
        start(posted ? restartState(posted) : undefined);
    }

    /** the frame a restart starts from (SIMULATOR_ENGINE_DESIGN.md §1.7 2's cost rule; J3c-2): the last one posted, or -
     *  when it has no state bytes and an earlier one of this course had (a rigid course's bytes ride every bytesEvery(n)-th frame, runtime.ts) - that
     *  earlier one, whole (its pose, angles and field with its bytes: at most bytesEvery(n) - 1 frames older - three, ~0.1 s,
     *  up to 40 objects; eleven, ~0.37 s, on Senior's 75 bodies) */
    function restartFrame(last, withBytes) {
        if (!last || (last.hazards && last.hazards.engine) || !withBytes) { return last; }
        return withBytes;
    }

    /** a restarted worker's state from the last snapshot the worker posted (`last`): the pose, the motors' angles, the UARTs; on a
     *  course with game blocks (W3b, design §6 the restart path) also the servos' shafts, the field - the seed it was laid
     *  from (the geometry's, posted before any snap that shows a field laid from another seed) and every game block's pose,
     *  support and hold - and the WRO referee's state. A state "carries a field" only there: RCJ's is as before.
     *  On a rigid course the pose, the angles and the field come from restartFrame's frame (the one with the state bytes,
     *  whole: J3c-2), the UARTs always from `last` - the ports' state is no engine state, and bytes an SBC sent in the
     *  frames since the bytes' would be lost (J3c-2 fix: the uart group's READY-survives-a-restart row) */
    function restartState(last) {
        const p = restartFrame(last, postedBytes);
        const s = { pose: p.pose, angles: p.motors.map((x) => x.angle), uart: last.uart };
        const games = p.hazards && p.hazards.games;
        // only for the course the panel has now (review r1 N2: a course switch the stopped worker never took gives a
        // state without a field: the new course starts as before); the seed the frame's own referee names first (N1: a
        // geometry of a new seed can come before its snap), else the geometry's
        if (games && games.length && geom && geom.id === courseId) {
            const laid = p.referee && p.referee.kind === 'wro' && typeof p.referee.laidSeed === 'number' ? p.referee.laidSeed : undefined;
            s.servos = (p.servos || []).map((v) => ({ port: v.port, angle: v.angle }));
            s.field = { seed: laid !== undefined ? laid : typeof geom.seed === 'number' ? geom.seed : undefined, games };
            // a rigid course's engine bytes (§1.7 2; J3c-2): the new worker restores them when their header matches
            if (p.hazards.engine) { s.field.engine = p.hazards.engine; }
            if (p.referee && p.referee.kind === 'wro') { s.referee = p.referee; }
        }
        return s;
    }

    /* ---- the extension ------------------------------------------------------------------------------ */
    window.addEventListener('message', (ev) => {
        const m = ev.data;
        switch (m.type) {
            case 'exec':
                // a Run behind a course that has not landed starts in the plot at its `busy`, when the frames are the new course's
                pending.set(m.id, { source: m.source, run: m.run, behind: !!m.run && courseLanding() });
                if (m.run && !pending.get(m.id).behind) { plotRun(); }
                setStatus('run', 'running a program');
                // the Run mark (§6: simPanel.ts marks the program's Run) goes to the worker as the extension gave it
                toWorker({ type: 'exec', id: m.id, source: m.source, ...(m.run ? { run: m.run } : {}) });
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
            case 'hw': hw = m.hw; plotHw(); buildConfig(); clearErr(); toWorker({ type: 'hardware', hw }); trail.length = 0; if (v3) { v3.setHw(hw, body3()); } camHw(); return;
            case 'cam-server': onCamServer(m); return;
            case 'hw-error': $('#cfgErr').textContent = m.message; return;
            case 'course': setCourse(m.course, false); return;
            case 'challenge-job': void chRunJob(m); return;
            case 'challenge-cancelled': chBusy(false); return;
            case 'challenge-summary': chSummary(m); return;
            case 'place': place(undefined); return;
            case 'configure': setPane('config'); return;
            case 'connected': setConn(m.text); return;
            case 'licence': setLicence(m); return;
            case 'maps': onMaps(m); return;
            case 'map-info': if (m.seq === mapSeq) { mapInfo = m; mapReport(); if (draft.customTiles) { palette(); } draw(); } return;
            case 'tile-info': teInfo(m); return;
            case 'map-error': $('#mapErr').textContent = m.message; return;
            case 'map-imported': loadDraft(m.map, true); return;
            case 'map-victims': draft.objects = m.objects; if (!draft.objects.length) { delete draft.objects; } selObj = undefined; edited(); return;
            // the WRO mat (§3.2): a file picked (or the stored one) to render and identify; a pick cancelled or failed
            case 'wro-mat-bytes': void wroLoad(m.bytes, !!m.stored, typeof m.sha256 === 'string' ? m.sha256 : undefined, m.mat); return;
            case 'wro-mat-error': if (m.message) { showNote(`WRO mat${wroOther(m.mat)}: ${m.message}`, true); } wroHeader(); return;
        }
    });

    /* ---- the challenges (docs/SIMULATOR.md "Challenges"; src/sim/challengeHost.ts, challengeWorker.ts) ------------------------- */
    // every run of a job runs in a worker of its own (the board's is untouched; review r3 B1), readied while the run before
    // it runs. A run's worker reports each simulated second it passes (a 'beat') and its result; a program in a loop that
    // never calls the board does not advance simulated time, so the worker is ended after CH_BUDGET_MS of wall time with no
    // beat (review r1 D2: a short fixed budget per run would cut off a slow computer's legitimate run; CH_RUN_MS is only a
    // last bound)
    const CH_BUDGET_MS = 60000;
    // no run gets more than this of the computer's time (a legitimate Level 3 run polling the board took 37 s here)
    const CH_RUN_MS = 5 * 60000;
    const CH_ABORT = new Error('the challenge was stopped');
    // the levels and the runs (simPanel.ts challengeCfg); a host without challenges (an older one, a test's cfg) has none
    const chCfg = cfg.challenge || { runs: 5, min: 1, max: 20, levels: [] };
    // busy from the job's arrival (its assets may still be loading) to its end: one job at a time (review r1 D10)
    const chal = { busy: false, worker: undefined, next: undefined, cancel: undefined, timer: undefined, deadline: undefined, id: 0, purpose: '', starts: [] };
    const chLevel = () => (courseId.startsWith('challenge:') ? chCfg.levels.find((l) => `challenge:${l.id}` === courseId) : undefined);
    function challengeHeader() {
        const l = chLevel();
        const box = $('#chBox');
        if (!box) { return; }
        box.hidden = !l;
        box.title = l ? l.brief : '';
    }
    function chRuns() {
        const n = Math.round(Number($('#chRuns').value));
        return Math.min(chCfg.max, Math.max(chCfg.min, Number.isFinite(n) ? n : chCfg.runs));
    }
    function chRunsChanged() { const n = chRuns(); $('#chRuns').value = String(n); vscode.postMessage({ type: 'challenge-runs', runs: n }); }
    function chBusy(on) { const b = $('#chRun'); if (b) { b.disabled = on; b.textContent = on ? 'Running…' : 'Run challenge'; } }
    function chStart() {
        const l = chLevel();
        if (!l || chal.busy) { return; }
        chBusy(true);
        vscode.postMessage({ type: 'challenge-run', level: l.id, runs: chRuns() });
    }
    function chEnd() {
        if (chal.timer) { clearTimeout(chal.timer); chal.timer = undefined; }
        if (chal.deadline) { clearTimeout(chal.deadline); chal.deadline = undefined; }
        if (chal.worker) { chal.worker.terminate(); chal.worker = undefined; }
        if (chal.next) { chal.next.terminate(); chal.next = undefined; }
        chal.busy = false;
        chBusy(false);
    }
    /** the job ends here, its worker terminated: `msg` says why (the panel's note, and the host's waiter) */
    function chFail(msg) {
        const id = chal.id;
        const cancel = chal.cancel;
        chal.cancel = undefined;
        chEnd();
        cancel?.();
        $('#chProg').textContent = 'stopped';
        showNote(`Challenge: ${msg}.`, true);
        vscode.postMessage({ type: 'challenge-error', id, message: msg });
    }
    function chArm(run) {
        if (chal.timer) { clearTimeout(chal.timer); }
        chal.timer = setTimeout(() => chFail(`run ${run}'s simulated clock stood still for ${CH_BUDGET_MS / 1000} s of this computer's time: a loop that never waits (no wait(), no board call) stops it`), CH_BUDGET_MS);
    }
    const chEnds = { goal: 'goal', time: 'out of time', ended: 'stopped short', error: 'error', still: 'stood still', touch: 'touched', visits: 'every target visited' };
    function chRow(r) {
        const tr = el('tr', { class: r.reached ? 'ok' : 'miss' },
            el('td', {}, String(r.run)),
            el('td', { title: `x ${r.start.x} mm, y ${r.start.y} mm, heading ${r.start.heading}°` }, r.run === 1 ? 'nominal' : `${r.start.x}, ${r.start.y}, ${r.start.heading}°`),
            el('td', { title: r.error || '' }, chEnds[r.end] || r.end),
            el('td', {}, `${r.time} s`),
            el('td', {}, String(r.touches)),
            el('td', {}, String(r.points)),
            el('td', {}, chal.purpose === 'student' ? el('button', { class: 'btn', type: 'button', title: 'Put the robot at this run\'s start, to run your program from there and watch', onclick: () => { if (pending.size) { showNote('The robot can be moved when no program is running.'); return; } place(r.start); } }, 'Try') : ''));
        $('#chRows').append(tr);
        // why a run ended in an error, as text under its own row: the tooltip alone reaches neither a keyboard nor a
        // screen reader (A11Y_DESIGN W6); the row spans the table, as the words do not fit the Result column
        const why = r.error && r.error.trim().split('\n').pop();
        if (why) { $('#chRows').append(el('tr', { class: 'why' }, el('td', { colspan: '7' }, why))); }
    }
    async function chRunJob(m) {
        if (chal.busy) { vscode.postMessage({ type: 'challenge-error', id: m.id, message: 'a challenge is already running in the Simulator panel' }); return; }
        chal.busy = true;
        chal.id = m.id; chal.purpose = m.purpose;
        const lv = chCfg.levels.find((l) => l.id === m.job.level);
        // the job's own version's limit (the host sends it: an older submission's level may differ from the list's)
        const chLimit = Number.isFinite(m.limit) ? m.limit : lv ? lv.limit : 90;
        chBusy(true);
        $('#chCard').hidden = false;
        $('#chTitle').textContent = m.title;
        $('#chProg').textContent = `starting (${m.job.runs} run${m.job.runs === 1 ? '' : 's'})…`;
        $('#chRows').textContent = '';
        $('#chSum').textContent = m.purpose === 'student' ? '' : 'The report is in the editor.';
        $('#chSave').disabled = true;
        $('#chSave').hidden = m.purpose !== 'student';
        try {
            const a = await loadAssets();
            if (!a.challengeWorker) {
                const t = await fetch(cfg.challengeWorkerUrl).then((r) => { if (!r.ok) { throw new Error(`challengeworker.js: ${r.status}`); } return r.text(); });
                a.challengeWorker = URL.createObjectURL(new Blob([t], { type: 'text/javascript' }));
            }
            // every run in a worker of its own (review r3 B1: nothing a program leaves behind reaches the next run); the
            // runs' results go to the extension host, which sums them up (challenge-summary)
            // the next run's worker is readied (its interpreter loads, no program runs) while a run runs (review r4 B1)
            const results = [], output = [];
            // - where there are the cores for two interpreters at once: on one or two, two compete and it is slower
            // (review r5 S-1), so there a run's worker is readied when its turn comes
            const ahead = (navigator.hardwareConcurrency || 1) >= 4;
            let next = chReady(a, m.job, 0);
            for (let i = 0; i < m.job.runs; i++) {
                $('#chProg').textContent = `run ${i + 1} of ${m.job.runs}…`;
                const cur = next || chReady(a, m.job, i);
                next = ahead && i + 1 < m.job.runs ? chReady(a, m.job, i + 1) : undefined;
                chal.next = next && next.w;
                const d = await chRunOne(cur, i, chLimit);
                results.push(d.result);
                output.push(d.output);
                chRow(d.result);
                vscode.postMessage({ type: 'challenge-progress', id: m.id, done: i + 1, of: m.job.runs });
            }
            chEnd();
            $('#chProg').textContent = 'scoring…';
            vscode.postMessage({ type: 'challenge-done', id: m.id, results, output, engine: navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/)?.[0] || '' });
        } catch (e) {
            if (e === CH_ABORT) { return; }
            chEnd();
            $('#chProg').textContent = 'did not run';
            showNote(`Challenge: ${e && e.message || e}`, true);
            vscode.postMessage({ type: 'challenge-error', id: m.id, message: String(e && e.message || e) });
        }
    }

    /** A fresh worker for run `i` of `job`, readied: it loads its interpreter and waits for chRunOne's go */
    function chReady(a, job, i) {
        const w = new Worker(a.challengeWorker, { type: 'module', name: `EVN challenge run ${i + 1}` });
        // the run's token: the program under test runs in that worker and can post messages of its own there; only
        // the worker's (they carry this) count (challengeWorker.ts; review r1 C2)
        const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
        const p = a.pyodide;
        const rec = { w, token, failed: undefined };
        // a worker that fails while it is readied fails its run when it comes, with its own reason (review r5 N-1)
        w.onerror = (ev) => { rec.failed = ev.message || 'the challenge worker did not start'; };
        w.postMessage({ type: 'run', token, job, index: i, pyodide: { asm: p.asm, wasm: p.wasm.slice(0), stdlib: p.stdlib.slice(0), lock: p.lock }, evn: a.evn, boot: a.boot, version: cfg.version });
        return rec;
    }
    /** Run `i` in its readied worker: { result, output }, or it rejects - with CH_ABORT when the panel ended the job
     *  (chFail has said why) */
    function chRunOne({ w, token, failed }, i, limit) {
        return new Promise((resolve, reject) => {
            if (failed) { w.terminate(); reject(new Error(failed)); return; }
            chal.worker = w;
            chal.cancel = () => reject(CH_ABORT);
            const began = Date.now();
            chArm(i + 1);
            // no run gets more than CH_RUN_MS of this computer's time, beats or not (review r4 N12)
            chal.deadline = setTimeout(() => chFail(`run ${i + 1} took more than ${CH_RUN_MS / 60000} minutes of this computer's time`), CH_RUN_MS);
            w.onmessage = (ev) => {
                const d = ev.data;
                if (!d || d.token !== token || chal.worker !== w) { return; }
                if (d.type === 'beat') {
                    // a run is over at its time limit, and its program ended GRACE_S (2 s) later (challengeRun.ts): one
                    // still beating past that has escaped the stop (review r2 N1); and no run gets more than
                    // CH_RUN_MS of this computer's time, however slowly its simulated clock moves (review r3 N12)
                    if (!(Number(d.t) <= limit + 3)) { chFail(`run ${i + 1} went on past its time limit (${limit} s): the program would not stop`); return; }
                    if (Date.now() - began > CH_RUN_MS) { chFail(`run ${i + 1} took more than ${CH_RUN_MS / 60000} minutes of this computer's time`); return; }
                    chArm(i + 1);
                } else if (d.type === 'done' || d.type === 'error') {
                    w.terminate();
                    clearTimeout(chal.deadline);
                    chal.worker = undefined;
                    chal.cancel = undefined;
                    if (d.type === 'done') { resolve({ result: d.result, output: typeof d.output === 'string' ? d.output : '' }); } else { reject(new Error(String(d.message))); }
                }
            };
            w.onerror = (ev) => { if (chal.worker !== w) { return; } chal.cancel = undefined; reject(new Error(ev.message || 'the challenge worker stopped')); };
            w.postMessage({ type: 'go', token });
        });
    }
    /** the extension host's summary of the runs (challenge-done): shown, and Save submission ready */
    function chSummary(m) {
        if (m.id !== chal.id) { return; }
        if (m.error) { $('#chProg').textContent = 'not scored'; showNote(`Challenge: ${m.error}`, true); return; }
        const s = m.summary;
        $('#chProg').textContent = 'done';
        // a level's named values (COURSE_FORMAT_DESIGN.md §12.3) after the summary, an undefined one as -
        const u = m.units || {};
        const vals = s.values ? Object.entries(s.values).map(([k, v]) => ` · ${k} ${v ?? '-'}${v !== null && u[k] ? ' ' + u[k] : ''}`).join('') : '';
        $('#chSum').textContent = `score ${s.score} · at the goal ${s.reached} of ${s.runs} · clean ${s.clean} · best ${s.best ?? '-'} s · median ${s.median ?? '-'} s${vals}`;
        if (chal.purpose === 'student') { $('#chSave').disabled = false; }
    }

    /* ---- the header ---------------------------------------------------------------------------------- */
    function setStatus(kind, text) {
        const c = $('#status');
        c.className = 'chip' + (kind ? ' ' + kind : '');
        $('#statusText').textContent = text;
        $('#stopBtn').disabled = !pending.size;
        wroHeader();
        // no program runs: a stored mat held for the run goes on the floor now (wroMat.js idle)
        wroWaiting();
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

    /** a course picked that the worker has not answered yet: its files on their way (`held`) or the worker still taking it.
     *  True for too long only moves a Run's start in the plot to its `busy`, which is right all the same */
    const courseLanding = () => held.length > 0 || (!!geom && geom.id !== courseId);

    function setCourse(id, tell) {
        const before = courseId;
        courseId = id;
        postedBytes = undefined;
        courseOptions();
        userView = false;
        const wf = wroFields();
        const msg = { type: 'course', course: id, map: mapOf(id), ...wf.fields };
        if (needsEngine(id)) {
            // the engine's files first (once; J4): the course goes with them, and every later message after it
            const slot = { m: msg, transfer: wf.transfer, ready: false };
            held.push(slot);
            // a course whose files cannot be had is not sent: the page and the host go back to the course before it (the
            // worker never left it), the note naming the file (review lazy r1 A N1)
            const wro = wroFor(id).catch((e) => { showNote(`The WRO course's files could not load (${e && e.message || e}): back on the course before`, true); return null; });
            loadJoltBytes().then(joltFor, (e) => { showNote(`The physics engine could not load: ${e && e.message || e}`, true); return {}; }).then(async (jolt) => {
                const w = await wro;
                if (w === null) {
                    held.splice(held.indexOf(slot), 1);
                    flushHeld();
                    // back on the course the worker never left: no message to it; the host told whoever started the switch
                    // (its stored id too: review lazy r1 verify N-a)
                    if (courseId === id && before !== id) {
                        courseId = before;
                        courseOptions();
                        vscode.postMessage({ type: 'course', course: before });
                        if (wros) { wros.select(before); }
                        wroHeader();
                        challengeHeader();
                    }
                    return;
                }
                slot.m = { ...msg, ...jolt, ...w }; slot.ready = true;
                flushHeld();
            });
        } else {
            toWorker(msg, wf.transfer);
        }
        if (tell) { vscode.postMessage({ type: 'course', course: id }); }
        if (wros) { wros.select(id); }
        wroHeader();
        challengeHeader();
    }

    /** the Course list: the named courses, then the maps built here */
    function courseOptions() {
        const s = $('#course');
        if (!s) { return; }
        s.textContent = '';
        const opt = (id, label, title) => { const o = el('option', { value: id, title }, label); if (id === courseId) { o.selected = true; } return o; };
        for (const c of cfg.courses) { s.append(opt(c.id, c.label, c.detail)); }
        // a course no list shows, reached by its id (evn.simulator.setCourse: a `tiles:<codes>` chain), while it is on
        if (!courseId.startsWith('map:') && !cfg.courses.some((c) => c.id === courseId)) { s.append(opt(courseId, courseId, 'A course reached by its id (not in the list)')); }
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
        posted = s;
        if (s.hazards && s.hazards.engine) { postedBytes = s; }
        snap = s;
        const last = trail[trail.length - 1];
        const p = s.pose;
        // a point's third value: the pen came up before it, nothing joins it to the point before
        if (tools.penNow && (!last || Math.hypot(p.x - last[0], p.y - last[1]) > 3)) { trail.push(tools.gap ? [p.x, p.y, true] : [p.x, p.y]); tools.gap = false; if (trail.length > 4000) { trail.shift(); } }
        if (follow) { view.cx = s.pose.x; view.cy = s.pose.y; }
        hud();
        toolsShow();
        if (plot.on) { plotSnap(s); }
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
        // each fitted servo: its shaft over its travel (continuous: its speed), 'stall' while a load holds it
        for (const sv of snap.servos || []) {
            rows.push([`S${sv.port}`, `width:${sv.range ? Math.max(0, Math.min(100, sv.angle / sv.range * 100)) : 0}%`, (sv.range ? fmt(sv.angle, 0) + '°' : fmt(sv.speed, 0) + '°/s') + (sv.stalled ? ' stall' : '')]);
        }
        barsTo($('#bars'), rows);
        const rf = snap.referee;
        refHud(rf && rf.kind !== 'wro' ? rf : undefined);
        wroCard(rf && rf.kind === 'wro' ? rf : undefined);
    }

    /* the RCJ Rescue Line referee (referee.ts): the score, the game clock, the lacks of progress, its last events */
    let refSet = { on: true }, refKey = '';
    function refSettings() {
        // merged, not replaced: the seed Randomise drew (refSet.wroSeed) goes with every settings message (§6)
        refSet = { ...refSet, on: $('#rOn').checked, ramp: $('#rRamp').value, afterThree: $('#rSkip').value, press: $('#rPress').checked, lopStart: $('#rLopStart').value, calibration: Number($('#rCal').value) || 0 };
        toWorker({ type: 'referee', op: 'settings', settings: refSet });
    }
    function refHud(rf) {
        const card = $('#refCard');
        if (!card || (card.hidden = !rf)) { return; }
        const left = Math.max(0, rf.limit - rf.clock);
        setText($('#rScore'), `${rf.practice ? 'practice ' : ''}${fmt(rf.score, 2)} = (${rf.line} + ${rf.exit}) x ${fmt(rf.mult, 3)}`);
        const pr = $('#rPrac');
        if (pr) { pr.hidden = !rf.practice; setText(pr, rf.practice ? `practice: ${rf.practice}` : ''); }
        card.classList.toggle('off', !rf.on);
        setText($('#rClock'), !rf.on ? 'referee off' : rf.ended ? `ended (${rf.ended})` : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}${rf.started ? '' : ' (from the first move)'}`);
        setText($('#rLop'), `${rf.lops}${rf.zoneLops ? ` (${rf.zoneLops} by the zone)` : ''}, attempt ${rf.attempt}, tile ${rf.step + 1} of ${rf.steps}`);
        setText($('#rVic'), `live ${rf.rescued.live}/2, dead ${rf.rescued.dead}/1`);
        const key = `${rf.game}|${rf.seq}|${rf.started}|${rf.log.length}`;
        if (key === refKey) { return; }
        refKey = key;
        $('#rLog').replaceChildren(...rf.log.slice(-6).map((e) => el('div', {}, `${fmt(e.t, 1)} s  ${e.text}${e.points !== undefined ? `  +${e.points}` : ''}`)));
    }

    /* the WRO RoboMission referee (wroReferee.ts; docs/SIMULATOR_WRO_DESIGN.md §6, §7): its card and its controls */
    /** a course with game blocks (the WRO table) */
    const gameCourse = () => !!(geom && geom.world3d && geom.world3d.games);
    /** the WRO referee checkbox: turning it on is refused while a program runs on a course with game blocks (§6, review
     *  r3 S6: it lays the field and puts the robot at the start); RCJ keeps today's toggle */
    function wroRefToggle() {
        const want = $('#wOn').checked;
        if (want && !refSet.on && pending.size && gameCourse()) {
            $('#wOn').checked = false;
            showNote('The referee can be turned on when no program is running.');
            return;
        }
        $('#rOn').checked = want;
        refSettings();
    }
    /** Randomise: the next seed (as the RCJ victims' builder), laid at the next Back to start, never under a run (§5) */
    function wroRandomise() {
        const rf = snap && snap.referee && snap.referee.kind === 'wro' ? snap.referee : undefined;
        // its own key: RCJ's `seed` (the victims' put-back) is never touched by a WRO Randomise (review r1 int S1)
        const base = typeof refSet.wroSeed === 'number' ? refSet.wroSeed : rf ? rf.laidSeed : 1;
        refSet = { ...refSet, wroSeed: base >= 0xfffffffe ? 0 : base + 1 };
        toWorker({ type: 'referee', op: 'settings', settings: refSet });
        wroSeedChip(rf);
    }
    /** End run (10.7.5, the team's STOP): the run ends once the robot stands still */
    function wroEndRun() { toWorker({ type: 'referee', op: 'end' }); }
    function wroSeedChip(rf) {
        const c = $('#wroSeed');
        if (!c) { return; }
        const laid = rf ? rf.laidSeed : undefined;
        const next = rf && typeof rf.nextSeed === 'number' ? rf.nextSeed : typeof refSet.wroSeed === 'number' ? refSet.wroSeed : laid;
        setText(c, laid === undefined ? `seed ${next === undefined ? 1 : next}` : `seed ${laid}${next !== undefined && next !== laid ? ` (next seed ${next})` : ''}`);
    }
    /** the card's hover notes for the course's mat (cfg.wroMats' `card`: course.ts WRO_MATS; SIMULATOR_WRO_ES_DESIGN.md
     *  §8.2 EL): its score, its missions, what the physics engine does not model there and the referee toggle's rules
     *  (review el r1 S2). Junior's equal the texts
     *  the card is built with below, so its card is unchanged */
    function wroCardNotes() {
        const m = (cfg.wroMats || []).find((w) => w.courses.includes(courseId));
        if (!m || !m.card) { return; }
        const set = (e, t) => { if (e && e.title !== t) { e.title = t; } };
        set($('#wScore') && $('#wScore').parentElement, m.card.score);
        set($('#wLines'), m.card.lines);
        set($('#wroCard .log'), m.card.engine);
        set($('#wOn') && $('#wOn').parentElement, m.card.toggle);
    }
    function wroCard(rf) {
        const card = $('#wroCard');
        const on = gameCourse();
        for (const id of ['wroRand', 'wroEnd', 'wroSeed']) { const b = $('#' + id); if (b) { b.hidden = !on; } }
        if (!card || (card.hidden = !on)) { return; }
        wroCardNotes();
        wroSeedChip(rf);
        $('#wOn').checked = !!refSet.on;
        card.classList.toggle('off', !rf);
        $('#wroEnd').disabled = !rf || rf.run !== 'on';
        if (!rf) { setText($('#wScore'), 'referee off'); setText($('#wClock'), '-'); setText($('#wLines'), ''); setText($('#wMarks'), ''); return; }
        const sc = rf.score;
        setText($('#wScore'), `${sc.total} / ${sc.max}${rf.run === 'on' ? ' (live)' : rf.run === 'ended' ? '' : ' (the field now)'}`);
        const left = Math.max(0, rf.limit - rf.clock);
        setText($('#wClock'), rf.run === 'on' ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} left${rf.programEnded || rf.endAsked ? ', ending when the robot stands still' : ''}`
            : rf.run === 'ended' ? `ended: ${rf.end}; time ${rf.time} s` : 'Run starts the 2 minutes');
        setText($('#wLines'), sc.missions.map((m) => `${m.mission} ${m.points}`).join(' · '));
        const marks = [...rf.illegal.map((x) => `illegal start: ${x}`)];
        if (rf.notFresh) { marks.push('not from the start field'); }
        if (rf.outside) { marks.push(rf.outside); }
        if (rf.lastFrame) { marks.push('scored from the last frame before the board was stopped'); }
        if (!rf.verifiable && rf.run === 'ended') { marks.push('not yet verifiable (no run record)'); }
        if (rf.previous) { marks.push(`the run before: ${rf.previous.total} points, ${rf.previous.time} s (${rf.previous.end})`); }
        setText($('#wMarks'), marks.join('; '));
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

    /* ---- the virtual cameras (docs/SIMULATOR_SBC_DESIGN.md §2-§3) ----
     * Their worker (dist/sim/camworker.js: the 3D view's scene, media/sim/render3d.js, drawn from each camera and JPEG /
     * PNG encoded there) renders each frame the simulation worker captured at its simulated time; the bytes go on to the
     * extension, whose HTTP stream (src/sim/camServer.ts) publishes a frame once the simulation has released it (its
     * t_avail passed). The preview shows the first camera's newest frame, the stream's address is in the configurator. */
    const cams = { worker: null, starting: null, kind: undefined, reason: '', server: null, stats: new Map(), preview: false, pvBusy: false, pv: [], pvRel: null };
    /** the previewed camera's frames rendered and not yet released: the preview shows a frame at its release (its
     *  simulated t_avail), as the stream publishes it, never earlier (review rcjcam r1 should-fix 5); at most PV_MAX */
    const PV_MAX = 64;
    /** WebGL in an OffscreenCanvas as this page has it (the camera worker's own probe replaces it once it has run).
     *  Probed once per page and its context released at once (WEBGL_lose_context): Chromium keeps 16 live WebGL
     *  contexts and drops the oldest - the 3D view's - past that, and Configure's every rebuild asks (review rcjcam r1 B1) */
    let camGl;
    function camGlHere() {
        if (camGl !== undefined) { return camGl; }
        camGl = null;
        try {
            if (typeof OffscreenCanvas === 'undefined') { return camGl; }
            for (const kind of ['webgl2', 'webgl']) {
                const gl = new OffscreenCanvas(4, 4).getContext(kind);
                if (!gl) { continue; }
                const lose = gl.getExtension('WEBGL_lose_context');
                if (lose) { lose.loseContext(); }
                camGl = kind;
                break;
            }
        } catch (e) { /* no WebGL here */ }
        return camGl;
    }
    /** why a robot's cameras cannot be applied in this window, or '' (design §2.4: no WebGL, no cameras) */
    function camRefusal(h) {
        if (!(h.cameras || []).length) { return ''; }
        const kind = cams.kind !== undefined ? cams.kind : camGlHere();
        return kind ? '' : `Cameras need WebGL in a Web Worker, which this window does not have${cams.reason ? ` (${cams.reason})` : ' (a blocklisted GPU or a remote desktop)'}: remove the cameras to apply.`;
    }
    /** the robot's cameras changed (or the board started): the camera worker started, told, or ended */
    function camHw() {
        const on = (hw.cameras || []).length > 0;
        const b = $('#camBtn');
        if (b) { b.hidden = !on; }
        if (!on) { camStop(); return; }
        if (!cams.worker) {
            if (cams.starting) { return; }
            cams.starting = fetch(cfg.camWorkerUrl).then((r) => { if (!r.ok) { throw new Error(`camworker.js: ${r.status}`); } return r.text(); }).then((text) => {
                cams.starting = null;
                if (!(hw.cameras || []).length) { return; }
                cams.worker = new Worker(URL.createObjectURL(new Blob([text], { type: 'text/javascript' })), { name: 'EVN cameras' });
                cams.worker.onmessage = (ev) => onCamWorker(ev.data);
                cams.worker.postMessage({ op: 'init' });
                camHw();
            }).catch((e) => { cams.starting = null; showNote(`The cameras could not start: ${e && e.message || e}`, true); });
            return;
        }
        cams.worker.postMessage({ op: 'hw', hw, body: body3(), seesaw: cfg.seesaw });
        camGeom();
    }
    function camStop() {
        if (cams.worker) { cams.worker.terminate(); cams.worker = null; }
        cams.stats.clear();
        cams.preview = false;
        const pv = $('#camPv');
        if (pv) { pv.hidden = true; }
        const b = $('#camBtn');
        if (b) { b.classList.remove('on'); }
    }
    function camGeom() {
        if (!cams.worker) { return; }
        // the WRO floor's texture first (render3d.js Scene3D.setFloor), then the course
        const wro = wroCur();
        if (wro) { const f = wro.link.current(); cams.worker.postMessage({ op: 'floor', floor: f ? f.texture : null }); }
        if (geom) { cams.worker.postMessage({ op: 'geom', geom }); }
    }

    /* ---- the WRO mat (docs/SIMULATOR_WRO_DESIGN.md §3.2; media/sim/wroMat.js) ----
     * Load WRO mat... (the extension's file picker) and Forget, on a WRO course only, refused while a program runs;
     * the stored mat rendered again when the panel first shows that course. One loader and FloorLink per mat
     * (cfg.wroMats; SIMULATOR_WRO_ES_DESIGN.md §2.1, EN4 part 2: Junior's two ids share Junior's): the floor's copies - the
     * simulation worker's raster, the 3D view's and the cameras' texture, the 2D image - follow the current course's.
     * Every message to and from the host and the simulation worker names its mat (`mat`, `wroMat`). */
    function canvas2d(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    const wros = window.EVNWroMat && cfg.wroMats ? new window.EVNWroMat.WroCourses(cfg.wroMats, (w, others, active, othersBusy) => {
        const mat = new window.EVNWroMat.WroMat({
            wro: w, others, othersBusy, urls: { pdf: cfg.pdfUrl, worker: cfg.pdfWorkerUrl, nonce }, canvas2d,
            // the engine's own scale check (dist/sim/wroscale.js) on the raster, before any copy of the floor changes
            checkRaster: window.EVNWroScale ? (r) => window.EVNWroScale.scaleEnds(r, w.size[0], w.size[1], w.scaleBoxes) : undefined,
            running: () => pending.size > 0,
            host: {
                keep: (sha256) => vscode.postMessage({ type: 'wro-mat-keep', mat: w.key, sha256 }),
                refused: (sha256) => vscode.postMessage({ type: 'wro-mat-refused', mat: w.key, sha256 }),
                forget: () => vscode.postMessage({ type: 'wro-mat-forget', mat: w.key }),
            },
            onChange: () => link.changed(),
        });
        const link = new window.EVNWroMat.FloorLink(mat, {
            post: (m, transfer) => toWorker({ ...m, mat: w.key }, transfer), view3d: () => (v3 && v3.ok !== false ? v3 : null), camWorker: () => cams.worker,
            redraw: () => draw(), active,
        });
        return { mat, link };
    }) : undefined;
    // the starting course's mat, without touching the 3D view or the cameras (not made yet): their floor comes with the schematic
    if (wros) { wros.cur = wros.of(courseId); }
    /** the current course's mat entry ({ cfg, mat, link, hello }) or undefined */
    function wroCur() { return wros ? wros.of(courseId) : undefined; }
    function wroFields() { return wros ? wros.fields(courseId) : { fields: {}, transfer: [] }; }
    /** a note's prefix for a mat not the current course's (review en4_p2 r1 N1 / N2): " (WRO Junior 2026)"; '' for the current */
    function wroOther(key) {
        const e = wros && wros.entries.get(key || 'junior-2026'), cur = wroCur();
        return e && e !== cur ? ` (${e.cfg.short})` : '';
    }
    /** every mat whose stored render waits (a program ran, or another mat rendered) once nothing renders or runs */
    function wroWaiting() { if (!pending.size && wros && !wros.busy) { for (const e of wros.entries.values()) { if (e.mat.waiting) { void wroIdle(e); return; } } } }
    /** a load's outcome in the note and the header. The loader forgets a stored mat only when the file is not the mat
     *  (identity, size, pages); any other refusal keeps it and says so; one held for a run waits for wroIdle */
    function wroShow(r, e) {
        const pre = e ? wroOther(e.cfg.key) : '';
        if (r) { showNote(r.ok ? `${r.message}${pre}` : `WRO mat${pre}: ${r.message}`, !r.ok && !r.held); }
        wroHeader();
        wroWaiting();
    }
    async function wroLoad(bytes, stored, sha256, key) {
        const wro = wros && wros.entries.get(key || 'junior-2026');
        if (!wro) { return; }
        const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        showNote(stored ? 'Rendering the mat (the one you loaded before)...' : 'Rendering the mat...', true);
        // the load first (it is busy from its first line), then the header: Load and Forget disabled while it renders
        const p = wro.mat.load(b, { stored, picked: sha256 });
        wroHeader();
        wroShow(await p, wro);
    }
    /** the stored mat held for a run (or not started for one) once no program runs */
    async function wroIdle(wro) {
        const p = wro.mat.idle();
        wroHeader();
        wroShow(await p, wro);
    }
    /** the header's mat controls: on the WRO course only; disabled while a program runs or a mat renders */
    function wroHeader() {
        const wro = wroCur(), on = !!wro;
        const load = $('#wroLoad'), chip = $('#wroChip'), forget = $('#wroForget');
        if (!load) { return; }
        const st = on ? wro.mat.state : null;
        load.hidden = !on || !!st; chip.hidden = !st; forget.hidden = !st;
        const busy = pending.size > 0 || (on && wros.busy);
        load.disabled = busy; forget.disabled = busy;
        if (st) {
            chip.textContent = st.note ? `Mat: ${wro.cfg.short} (not the traced file)` : `Mat: ${wro.cfg.short}`;
            chip.title = st.note || 'The WRO mat you loaded is on the floor: the sensors read its print.';
        }
        // the stored mat, rendered again the first time the panel shows this course (§3.2)
        if (on) { load.title = `Load WRO's printing file of the ${wro.cfg.name.replace(/^WRO /, '')} mat (the PDF you downloaded from wro-association.org): the sensors then read its print. It stays on this computer, kept for the next time.`; }
        if (on && !wro.hello) { wro.hello = true; vscode.postMessage({ type: 'wro-mat-hello', mat: wro.cfg.key }); }
    }
    function wroPick() {
        if (pending.size) { showNote('A mat can be loaded when no program is running.'); return; }
        const wro = wroCur();
        if (!wro) { return; }
        if (wros.busy) { showNote('A mat is being rendered: load another when it is done.'); return; }
        vscode.postMessage({ type: 'wro-mat-pick', mat: wro.cfg.key });
    }
    function wroForget() {
        const wro = wroCur();
        if (!wro) { return; }
        const r = wro.mat.forget();
        showNote(r.message);
        wroHeader();
    }
    /** the 2D view's WRO floor: the mat's (or the schematic's) image over the mat's rect, through the smallest level of
     *  its mipmaps at least as wide as it is drawn */
    function wroFloor2d() {
        const wro = wroCur();
        const f = geom && geom.floor && wro ? wro.link.current() : null;
        if (!f) { return; }
        const [x0, y0, x1, y1] = geom.floor;
        const want = (x1 - x0) * view.k * dpr;
        let img = f.mips[0];
        for (const l of f.mips) { if (l.width >= want) { img = l; } }
        ctx.save();
        ctx.transform(1, 0, 0, -1, 0, y0 + y1);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0);
        ctx.restore();
    }
    /** the simulation worker's camera events (camera.ts CameraRig): a capture to render, a release and a new run to the
     *  extension */
    function onCam(m) {
        if (m.ev === 'capture') { if (cams.worker) { cams.worker.postMessage({ ...m, op: 'frame' }); } return; }
        if (m.ev === 'release') { vscode.postMessage({ type: 'cam-release', cam: m.cam, run: m.run, k: m.k }); camPvRelease(m); return; }
        if (m.ev === 'run') { cams.pv.length = 0; cams.pvRel = null; camRun = Math.max(camRun, m.run); vscode.postMessage({ type: 'cam-run', run: m.run }); }
    }
    function onCamWorker(m) {
        if (m.op === 'ready') {
            cams.kind = m.kind; cams.reason = m.reason || '';
            if (!m.kind) { showNote(`The cameras are off: ${m.reason}. Remove them in Configure.`, true); }
            return;
        }
        if (m.op === 'error') { showNote(`Camera ${m.cam}: ${m.message}`, true); return; }
        if (m.op !== 'frame') { return; }
        const bytes = new Uint8Array(m.bytes);
        vscode.postMessage({ type: 'cam-frame', cam: m.cam, run: m.run, k: m.k, tExpUs: m.tExpUs, eLenUs: m.eLenUs, tAvailUs: m.tAvailUs, mime: m.mime, bytes });
        // per camera: frames in the last second of wall time, the drops, the render + encode time (smoothed)
        let st = cams.stats.get(m.cam);
        if (!st) { st = { times: [], ms: 0, dropped: 0 }; cams.stats.set(m.cam, st); }
        const now = performance.now();
        st.times.push(now);
        while (st.times.length && now - st.times[0] > 1000) { st.times.shift(); }
        st.ms = st.ms ? 0.9 * st.ms + 0.1 * m.ms : m.ms;
        st.dropped = m.dropped;
        if (cams.preview && m.cam === ((hw.cameras || [])[0] || {}).id) {
            $('#camSt').textContent = `Camera ${m.cam}: ${st.times.length} fps, ${st.dropped} dropped, ${st.ms.toFixed(1)} ms a frame`;
            // released already (a render slower than readout + latency): shown now; else it waits for its release
            const r = cams.pvRel;
            if (r && r.run === m.run && r.k >= m.k) { camPreview(m, bytes); } else { cams.pv.push({ run: m.run, k: m.k, mime: m.mime, bytes }); if (cams.pv.length > PV_MAX) { cams.pv.shift(); } }
        }
    }
    /** a release of the previewed camera: the newest of its run's frames it covers is shown, the older ones go */
    function camPvRelease(m) {
        if (!cams.preview || m.cam !== ((hw.cameras || [])[0] || {}).id) { return; }
        cams.pvRel = { run: m.run, k: m.k };
        let pick, n = 0;
        for (let i = 0; i < cams.pv.length; i++) { const f = cams.pv[i]; if (f.run !== m.run || f.k <= m.k) { n = i + 1; if (f.run === m.run) { pick = f; } } }
        cams.pv.splice(0, n);
        if (pick) { camPreview(pick, pick.bytes); }
    }
    function camPreview(m, bytes) {
        if (cams.pvBusy || typeof createImageBitmap !== 'function') { return; }
        cams.pvBusy = true;
        createImageBitmap(new Blob([bytes], { type: m.mime })).then((bm) => {
            const c = $('#camPvC');
            if (c.width !== bm.width || c.height !== bm.height) { c.width = bm.width; c.height = bm.height; }
            c.getContext('2d').drawImage(bm, 0, 0);
            bm.close();
        }).catch(() => { /* a frame the page could not decode: the next one */ }).finally(() => { cams.pvBusy = false; });
    }
    function camPreviewToggle() {
        cams.preview = !cams.preview && (hw.cameras || []).length > 0;
        cams.pv.length = 0; cams.pvRel = null;
        $('#camPv').hidden = !cams.preview;
        $('#camBtn').classList.toggle('on', cams.preview);
    }
    function onCamServer(m) { cams.server = m; const s = $('#camAddr'); if (s) { s.textContent = camAddrText(); } }
    function camAddrText() {
        const s = cams.server;
        if (!s) { return 'The stream starts when a camera is applied.'; }
        if (s.error) { return s.error; }
        return `Stream: http://127.0.0.1:${s.port}/cam/<id>/stream.mjpg (or frame.jpg), with your token (?token=...) from ${s.endpoints || 'the panel'}.`;
    }
    /** OpenCV lines that open camera `id`'s stream (the port and token from the endpoints file) */
    function camCode(id) {
        const s = cams.server && !cams.server.error ? cams.server : undefined;
        const file = s && s.endpoints ? s.endpoints.replace(/\\/g, '/') : '~/.evn/sim-endpoints.json';
        return ['import json, os', 'import cv2', '',
            // the path as a JSON string, which is a Python string literal too (a profile path with a quote in it: review r1)
            `with open(os.path.expanduser(${JSON.stringify(file)})) as f:`, '    ep = json.load(f)',
            `cap = cv2.VideoCapture(f"http://127.0.0.1:{ep['http']}/cam/${id}/stream.mjpg?token={ep['token']}", cv2.CAP_FFMPEG)`,
            'while True:', '    ok, frame = cap.read()', '    if not ok:', '        break',
            `    cv2.imshow('EVN camera ${id}', frame)`, '    if cv2.waitKey(1) == 27:   # Esc', '        break', ''].join('\n');
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
                tileMarks(tiles[i], seesawTilt(i) * seesawMax(i));
            }
        };
        const w3 = W3();
        const wroC = wroCur();
        const key = [W, H, ...world, overs.join(' '), w3 ? w3.seesaws.map((q) => seesawTilt(q.tile)).join(' ') : '', wroC ? `${wroC.cfg.key} ${wroC.link.ver}` : 0];
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
                wroFloor2d();
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
        // EN2: the decals over the floor (kept out of the floor's cache: they change with the seed), under every body
        decals2d();
        debris3d();
        if (geom.start) { startMark(geom.start); }
        gridDraw();
        // the trail
        if (trail.length > 1) {
            ctx.strokeStyle = 'rgba(42,120,214,0.75)';
            ctx.lineWidth = Math.max(1.5, 2 / view.k / dpr);
            ctx.beginPath();
            trail.forEach(([x, y, gap], i) => (i && !gap ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
        }
        if (snap) { beams(snap); robot(snap.pose, snap); }
        hazards3d(true);
        if (overs.length) { ctx.globalAlpha = 0.45; layer(true); ctx.globalAlpha = 1; }
        toolsDraw();
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
            const a = ALONG[(t.up ?? t.rot) % 4];
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

    /** a seesaw's whole tilt either way (degrees: tiles.ts Seesaw.deg, absent cfg.seesaw.deg) */
    function seesawMax(i) {
        const w = W3(), q = w && w.seesaws.find((s) => s.tile === i);
        return (q && q.deg) || S3.deg;
    }

    /** a seesaw's tilt now, as -1..1 of its whole (1: its drawn bottom end down, as it starts) */
    function seesawTilt(i) {
        const w = W3();
        if (!w) { return 1; }
        const k = w.seesaws.findIndex((q) => q.tile === i), max = seesawMax(i);
        const th = snap && snap.hazards && k >= 0 ? (snap.hazards.seesaws[k] ?? max) : max;
        return Math.max(-1, Math.min(1, th / max));
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
        if (t.zone) {
            label('Evacuation zone', cx, cy, 'rgba(127,113,92,0.6)', 13);
            if (t.span[1] > 0.5) { label(`${Math.round(t.span[1])} mm`, cx, cy - 60, '#7f715c'); }
        } else if (t.ramp) {
            // chevrons up the slope, and the heights at its ends
            const a = ALONG[(t.up ?? t.rot) % 4], len = a[0] ? x1 - x0 : y1 - y0;
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
        // a checkpoint's marker (rules 3.4.4: a disc up to 70 mm across), in a corner off the line
        if (t.checkpoint) {
            ctx.fillStyle = 'rgba(50,100,190,0.35)';
            ctx.beginPath(); ctx.arc(x0 + 55, y0 + 55, 35, 0, 2 * Math.PI); ctx.fill();
            label('CP', x0 + 55, y0 + 55, '#24467f');
        }
    }

    /** EN2 (ES §4.4, D176): a WRO package's decals (the Senior pattern paper), flat on the floor under every body - the
     *  geometry's, which carries them with its seed (a new seed's paper comes with its field's geometry) */
    function decals2d() {
        for (const d of (geom && geom.decals) || []) { ctx.fillStyle = `rgb(${d.rgb[0]},${d.rgb[1]},${d.rgb[2]})`; poly(d.poly); ctx.fill(); }
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
            ctx.fillStyle = b.color || (b.kind === 'pillar' ? '#8d9196' : b.fixed ? '#7d3b30' : '#b5523b');
            ctx.strokeStyle = '#2b1b17';
            ctx.lineWidth = Math.max(1, 1.2 / view.k / dpr);
            poly(pts); ctx.fill(); ctx.stroke();
            if (b.kind === 'obstacle') { label(`${Math.round(b.h)}`, x, y, '#ffffff', 10); }
        });
        // EN1 (G§2.7): the fixtures (a WRO package's, the Senior frame), static: each piece's base and top outlines filled in its
        // colour, lowest pieces first, no stroke (the pieces abut: their seams are no edge of the frame)
        (w.fixtures || []).forEach((fx) => {
            const a = fx.at[2] * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
            const place = (P) => P.map(([u, v]) => [fx.at[0] + u * c - v * sn, fx.at[1] + u * sn + v * c]);
            ctx.fillStyle = `rgb(${fx.colour[0]},${fx.colour[1]},${fx.colour[2]})`;
            fx.pieces.slice().sort((p1, p2) => p1.z[1] - p2.z[1]).forEach((p) => { poly(place(p.base)); ctx.fill(); poly(place(p.top)); ctx.fill(); });
        });
        // the WRO game objects (W2a, games.ts): each part's outline filled in its top colour, lowest parts first, where the
        // snapshot says the object is (docs/SIMULATOR_WRO_DESIGN.md §4.4; the 3D view's boxes and meshes come later)
        if (w.games) { gamesPlan2d(w.games, hz); }
        // the loose balls (bodies.ts): a shaded disc each, where the snapshot says it is
        (w.balls || []).forEach((bl, k) => {
            const at = (hz && hz.balls && hz.balls.length === w.balls.length && hz.balls[k]) || [bl.x, bl.y, bl.z];
            const g = ctx.createRadialGradient(at[0] - bl.r / 3, at[1] + bl.r / 3, bl.r / 8, at[0], at[1], bl.r);
            g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, bl.color); g.addColorStop(1, '#202020');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(at[0], at[1], bl.r, 0, 2 * Math.PI); ctx.fill();
        });
    }

    /** the WRO game objects in the 2D view (hazards3d; SP-c review spc r1 S1: a named function, so a row drives it on a
     *  recording canvas): each block where the snapshot hz says it is - a frame with q drawn by gamePlan, else each
     *  part placed at x, y, a by gameFlat, lowest parts first, filled in its top colour */
    function gamesPlan2d(games, hz) {
        const gz = hz && hz.games && hz.games.length === games.length ? hz.games : null;
        games.forEach((g, i) => {
            const q = gz ? gz[i] : null, x = q ? q.x : g.at[0], y = q ? q.y : g.at[1], a = (q ? q.a : g.at[2]) * Math.PI / 180;
            const c = Math.cos(a), sn = Math.sin(a), place = (P) => P.map(([u, v]) => [x + u * c - v * sn, y + u * sn + v * c]);
            ctx.lineWidth = Math.max(1, 1 / view.k / dpr);
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            // an engine body's frame (a rigid course, §2.7: x, y, z, q): each part's world vertices to the plan, hulled
            const tilted = q ? gamePlan(g.parts, q) : null;
            if (tilted) {
                tilted.forEach((t) => { ctx.fillStyle = `rgb(${t.fill[0]},${t.fill[1]},${t.fill[2]})`; planShape(t); ctx.fill(); ctx.stroke(); });
                return;
            }
            g.parts.slice().sort((p1, p2) => p1.z[1] - p2.z[1]).forEach((pt) => {
                ctx.fillStyle = `rgb(${pt.top[0]},${pt.top[1]},${pt.top[2]})`;
                planShape(gameFlat(pt, place)); ctx.fill(); ctx.stroke();
            });
        });
    }
    /** a game part's plan shape where its block lies (`place`: model-frame points to the plan, from x, y, a) - SP-c (S-C8,
     *  ES D207): a sphere part (gameMesh.ts gamesGeom3d's `sphere` [cx, cy, cz, r]) its disc, radius r round its placed
     *  centre, not its envelope's 16-gon; every other part its outline placed, as before */
    function gameFlat(pt, place) {
        if (pt.sphere) { const c = place([[pt.sphere[0], pt.sphere[1]]])[0]; return { disc: [c[0], c[1], pt.sphere[3]] }; }
        return { pts: place(pt.outline) };
    }
    /** a plan shape's path (gameFlat's / gamePlan's): a disc's circle, else its polygon (poly) */
    function planShape(t) {
        if (t.disc) { ctx.beginPath(); ctx.arc(t.disc[0], t.disc[1], t.disc[2], 0, 2 * Math.PI); ctx.closePath(); return; }
        poly(t.pts);
    }

    /** the 2D plan of a game object whose snapshot frame carries `q` (SIMULATOR_ENGINE_DESIGN.md §2.7; J3c-2): each part's
     *  prism vertices (its outline at its z band, in the model frame) turned by q about the frame's origin (x, y, z) and
     *  projected to the plan, the convex hull filled in the part's top colour, the parts sorted by their highest world z
     *  (lowest first). null for a frame without a usable q (four finite numbers, not all zero) or without a finite x, y,
     *  z: today's drawing from x, y, a then runs, unchanged. A sphere part (SP-c, ES D207) is its disc: its centre turned
     *  by q to the plan, radius r (a ball's plan is a disc at any attitude), its top the centre's world z + r */
    function gamePlan(parts, f) {
        const t = f && f.q;
        if (!t || t.length !== 4 || !Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(f.z)) { return null; }
        const n = t[0] * t[0] + t[1] * t[1] + t[2] * t[2] + t[3] * t[3];
        if (!(n > 0 && Number.isFinite(n))) { return null; }
        const s = 2 / n, w = t[0], qx = t[1], qy = t[2], qz = t[3];
        const R = [1 - s * (qy * qy + qz * qz), s * (qx * qy - w * qz), s * (qx * qz + w * qy),
            s * (qx * qy + w * qz), 1 - s * (qx * qx + qz * qz), s * (qy * qz - w * qx),
            s * (qx * qz - w * qy), s * (qy * qz + w * qx), 1 - s * (qx * qx + qy * qy)];
        const out = parts.map((pt) => {
            if (pt.sphere) {
                const [u, v, h, r] = pt.sphere;
                return { fill: pt.top, disc: [f.x + R[0] * u + R[1] * v + R[2] * h, f.y + R[3] * u + R[4] * v + R[5] * h, r], top: f.z + R[6] * u + R[7] * v + R[8] * h + r };
            }
            const P = [];
            let top = -Infinity;
            for (const [u, v] of pt.outline) {
                for (const h of pt.z) {
                    P.push([f.x + R[0] * u + R[1] * v + R[2] * h, f.y + R[3] * u + R[4] * v + R[5] * h]);
                    top = Math.max(top, f.z + R[6] * u + R[7] * v + R[8] * h);
                }
            }
            // the hull (monotone chain), counter-clockwise
            P.sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]);
            const cr = (o, p1, p2) => (p1[0] - o[0]) * (p2[1] - o[1]) - (p1[1] - o[1]) * (p2[0] - o[0]);
            const lo = [], hi = [];
            for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) { lo.pop(); } lo.push(p); }
            for (let k = P.length - 1; k >= 0; k--) { const p = P[k]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) { hi.pop(); } hi.push(p); }
            return { fill: pt.top, pts: lo.slice(0, -1).concat(hi.slice(0, -1)), top };
        });
        return out.sort((p1, p2) => p1.top - p2.top);
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

    /** every switch's feeler on the robot (peripherals.ts switchContacts) */
    function swContacts() {
        const out = [];
        for (const t of hw.touchArrays || []) { for (const e of t.electrodes || []) { if (e.contact) { out.push(e.contact); } } }
        for (const a of hw.adcs || []) { for (const i of a.inputs || []) { if (i.contact) { out.push(i.contact); } } }
        return out;
    }

    /** the body as the configurator sets it (hardware.ts bodyOf: null members worked out from the drive base and the
     *  sensors); rear is negative here */
    function robotShape() {
        const db = hw.driveBase, c = hw.chassis || {};
        // a switch's feeler origin is on the body's outline, a set front / rear / width included (bodyOf, review r1 B1,
        // r2 S7)
        const sw = swContacts();
        const front = Math.max(c.front ?? Math.max(40, ...hw.colorSensors.map((s) => s.forward + 12), ...(hw.distanceSensors || []).map((s) => s.forward + 10)), ...sw.map((s) => s.forward));
        const rear = -Math.max(c.rear ?? Math.max(50, db.wheelDiameter / 2 + 30), ...sw.map((s) => -s.forward));
        const half = Math.max(20, Math.max(c.width ?? Math.max(40, db.axleTrack - 28), ...sw.map((s) => 2 * Math.abs(s.left))) / 2);
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
        // the mechanisms (src/sim/engine/mechanisms.ts): each part's outline seen from above
        for (const [f, l, , yaw, pitch, sx, sy, sz] of (s && s.mech && s.mech.boxes) || []) {
            const len = Math.abs(sx * Math.cos(pitch * Math.PI / 180)) + Math.abs(sz * Math.sin(pitch * Math.PI / 180));
            ctx.save(); ctx.translate(f, l); ctx.rotate(yaw * Math.PI / 180);
            ctx.strokeStyle = '#4a6fa5'; ctx.lineWidth = 1.5; ctx.strokeRect(-len / 2, -sy / 2, len, sy);
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
            // a downward sensor's patch; a forward-facing one's look ahead (an arrow to its 30 mm range)
            if (c.facing === 'forward') {
                ctx.beginPath(); ctx.moveTo(c.forward + 6, c.left); ctx.lineTo(c.forward + 30, c.left);
                ctx.moveTo(c.forward + 24, c.left - 5); ctx.lineTo(c.forward + 30, c.left); ctx.lineTo(c.forward + 24, c.left + 5); ctx.stroke();
            } else { ctx.beginPath(); ctx.arc(c.forward, c.left, c.height, 0, 2 * Math.PI); ctx.stroke(); }
            ctx.save();
            ctx.translate(c.forward, c.left);
            ctx.scale(1, -1);
            ctx.fillStyle = '#eb6834';
            ctx.font = '11px sans-serif';
            ctx.fillText(String(c.port), 8, -8);
            ctx.restore();
        }
        // selected: the arrow keys move it (the tools pane's Select robot, or a click on it)
        if (tools.selected) {
            ctx.strokeStyle = '#2a78d6';
            ctx.lineWidth = Math.max(1.5, 2 / view.k / dpr);
            ctx.setLineDash([12, 8]);
            ctx.strokeRect(rear - 8, -half - 8, front - rear + 16, 2 * half + 16);
            ctx.setLineDash([]);
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
            if (zoneMode) { placeZone(col, row); return; }
            // with a tile (or an object) picked, a click places it and a drag still pans
            if (pick || pickObj) { drag = { mode: 'pan', x: e.offsetX, y: e.offsetY, cx: view.cx, cy: view.cy, place: { col, row, x, y, low: e.shiftKey } }; return; }
            // an object over the tiles first, then the tile under the mouse (Shift: the lower one of a bridge)
            const o = objectAt(x, y);
            if (o >= 0) {
                selObj = o; sel = undefined; selZone = false;
                const ob = draft.objects[o];
                drag = { mode: 'obj', i: o, dx: x - ob.x, dy: y - ob.y, from: { x: ob.x, y: ob.y } };
                mapPane(); draw();
                return;
            }
            // the evacuation zone (no tile lies on its cells)
            if (zoneHas(col, row)) {
                const z = draft.zone;
                selZone = true; sel = undefined; selObj = undefined;
                drag = { mode: 'zone', dc: col - z.col, dr: row - z.row, from: { col: z.col, row: z.row } };
                mapPane(); draw();
                return;
            }
            const i = tileAt(col, row, e.shiftKey);
            if (i >= 0) {
                sel = i; selObj = undefined; selZone = false;
                const t = draft.tiles[i];
                drag = { mode: 'tile', i, dc: col - t.col, dr: row - t.row, from: { col: t.col, row: t.row } };
                mapPane();
                draw();
                return;
            }
            if (sel !== undefined || selObj !== undefined || selZone) { sel = undefined; selObj = undefined; selZone = false; mapPane(); draw(); }
            drag = { mode: 'pan', x: e.offsetX, y: e.offsetY, cx: view.cx, cy: view.cy };
            return;
        }
        if (tools.pick) { pickPoint(x, y); return; }
        if (snap && !pending.size) {
            const p = snap.pose, h = p.heading * Math.PI / 180;
            const lx = (x - p.x) * Math.cos(h) + (y - p.y) * Math.sin(h);
            const ly = -(x - p.x) * Math.sin(h) + (y - p.y) * Math.cos(h);
            const { front, rear, half } = robotShape();
            if (Math.hypot(lx - (front + 22), ly) < 14 / Math.min(1, view.k)) { drag = { mode: 'rotate', pose: { ...p }, clicked: true, px: e.offsetX, py: e.offsetY }; return; }
            if (lx >= rear && lx <= front && Math.abs(ly) <= half + 12) { drag = { mode: 'move', dx: x - p.x, dy: y - p.y, pose: { ...p }, clicked: true, px: e.offsetX, py: e.offsetY }; return; }
        }
        drag = { mode: 'pan', x: e.offsetX, y: e.offsetY, cx: view.cx, cy: view.cy };
    });
    /** is the press on the robot still a click? A hand's wobble under CLICK_PX stays one, and past it the press is a
     *  drag for good, even when it comes back: only a drag puts the robot down */
    function stillClick(e) {
        if (drag.clicked) { drag.clicked = Math.hypot(e.offsetX - drag.px, e.offsetY - drag.py) < clickPx(e); }
        return drag.clicked;
    }
    canvas.addEventListener('pointermove', (e) => {
        const x = wx(e.offsetX), y = wy(e.offsetY);
        if (builder()) {
            const h = { col: Math.floor(x / 300), row: Math.floor(y / 300) };
            if (!hover || hover.col !== h.col || hover.row !== h.row) { hover = h; if (pick || startMode || zoneMode) { draw(); } }
            if (drag && drag.mode === 'zone') {
                const z = draft.zone, col = h.col - drag.dc, row = h.row - drag.dr;
                if (z.col !== col || z.row !== row) { z.col = col; z.row = row; draw(); }
                return;
            }
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
        } else if (pending.size) {
            // a program started mid-drag: the robot is not moved, and the last snapshot is not written over (§6)
            drag = undefined; draw();
            showNote('The robot can be moved when no program is running.');
        } else if (stillClick(e)) {
            // not a drag yet: the robot stays where it stands
        } else if (drag.mode === 'move') {
            drag.pose.x = x - drag.dx; drag.pose.y = y - drag.dy;
            // a new object: the worker's snapshot (`posted`, a restart's state) is never written
            snap = { ...snap, pose: { ...drag.pose } }; draw();
        } else {
            drag.pose.heading = Math.atan2(y - drag.pose.y, x - drag.pose.x) * 180 / Math.PI;
            if (e.shiftKey) { drag.pose.heading = Math.round(drag.pose.heading / 15) * 15; }
            snap = { ...snap, pose: { ...drag.pose } }; draw();
        }
    });
    canvas.addEventListener('pointerup', (e) => {
        const dragT = drag && drag.mode === 'tile' && draft.tiles[drag.i];
        const dragHit = dragT && (dragT.col !== drag.from.col || dragT.row !== drag.from.row) && tileHit(drag.i);
        if (dragHit) {
            // review rcjnotes r1 N4: a tile dragged onto another is put back, never replacing it (no undo here)
            const t = draft.tiles[drag.i];
            t.col = drag.from.col; t.row = drag.from.row;
            $('#mapErr').textContent = `#${defOf(dragHit).id} is on that cell: a tile dragged there does not replace it. ${REPLACE_HOW}`;
            mapPane(); draw();
        } else if (drag && drag.mode === 'tile' && draft.zone && zoneOver(draft.zone, draft.tiles[drag.i])) {
            // not onto the evacuation zone: back where it was
            const t = draft.tiles[drag.i];
            t.col = drag.from.col; t.row = drag.from.row;
            $('#mapErr').textContent = 'The evacuation zone is there: a tile goes beside it.';
            draw();
        } else if (drag && drag.mode === 'tile') {
            const t = draft.tiles[drag.i];
            if (t.col !== drag.from.col || t.row !== drag.from.row) {
                // what lies on it goes with it
                const r = rectOf({ ...t, col: drag.from.col, row: drag.from.row });
                const dx = (t.col - drag.from.col) * 300, dy = (t.row - drag.from.row) * 300;
                for (const o of draft.objects || []) {
                    if (o.x >= r[0] * 300 && o.x < r[2] * 300 && o.y >= r[1] * 300 && o.y < r[3] * 300 && Math.abs((o.z || 0) - supportZAt(t, o.x, o.y, drag.from)) < 21) { o.x += dx; o.y += dy; }
                }
                sel = drag.i;
                edited();
            }
        } else if (drag && drag.mode === 'zone' && zoneBlocked(draft.zone)) {
            draft.zone.col = drag.from.col; draft.zone.row = drag.from.row;
            $('#mapErr').textContent = ZONE_FULL;
            draw();
        } else if (drag && drag.mode === 'zone') {
            const z = draft.zone;
            if (z.col !== drag.from.col || z.row !== drag.from.row) {
                // what lies in it goes with it
                const dx = (z.col - drag.from.col) * 300, dy = (z.row - drag.from.row) * 300;
                const r = zoneRect({ ...z, col: drag.from.col, row: drag.from.row });
                for (const o of draft.objects || []) { if (o.x > r[0] && o.x < r[2] && o.y > r[1] && o.y < r[3]) { o.x += dx; o.y += dy; } }
                edited();
            }
        } else if (drag && drag.mode === 'obj') {
            const o = draft.objects[drag.i];
            // it lies on what is under it, at the level it was at where there is one (under a bridge: the floor tile)
            if (o.x !== drag.from.x || o.y !== drag.from.y) { o.z = Math.abs(supportZ(o.x, o.y, true) - (o.z || 0)) < 21 ? supportZ(o.x, o.y, true) : supportZ(o.x, o.y); edited(); }
        } else if (drag && drag.mode === 'pan' && drag.place && Math.hypot(e.offsetX - drag.x, e.offsetY - drag.y) < clickPx(e) && (pick || pickObj)) {
            if (pick) { placeTile(pick, drag.place.col, drag.place.row, pickRot); } else { placeObject(pickObj, drag.place.x, drag.place.y, drag.place.low); }
        } else if (drag && drag.clicked) { selectRobot(true);   // a click, no move: the arrow keys take it from here
        } else if (drag && drag.mode === 'pan' && tools.selected && !builder() && Math.hypot(e.offsetX - drag.x, e.offsetY - drag.y) < clickPx(e)) { selectRobot(false);   // a click on the floor lets go
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
        if (o >= 0) { selObj = o; sel = undefined; selZone = false; rotateObject(o, 1); return; }
        if (zoneHas(Math.floor(wx(e.offsetX) / 300), Math.floor(wy(e.offsetY) / 300))) { selZone = true; sel = undefined; selObj = undefined; rotateZone(); return; }
        const i = tileAt(Math.floor(wx(e.offsetX) / 300), Math.floor(wy(e.offsetY) / 300), e.shiftKey);
        if (i >= 0) { sel = i; selObj = undefined; selZone = false; rotateTile(i, 1); }
    });
    window.addEventListener('keydown', (e) => {
        if (robotKey(e)) { e.preventDefault(); return; }
        if (!builder() || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { return; }
        // review r2 S3: with the tile editor open the keys are the editor's (Delete / Backspace take off its selected
        // piece), never the placed map tile behind it (`sel` stays set while "Edit tile" is open)
        if (TE.on) {
            if ((e.key === 'Delete' || e.key === 'Backspace') && TE.tile.elements[TE.sel]) { const k = TE.sel; TE.sel = -1; teChange(() => TE.tile.elements.splice(k, 1)); e.preventDefault(); }
            return;
        }
        if (e.key === 'r' || e.key === 'R') {
            const d = e.shiftKey ? 3 : 1;
            if (pick) { pickRot = (pickRot + d) % 4; draw(); } else if (selObj !== undefined) { rotateObject(selObj, e.shiftKey ? -1 : 1); } else if (selZone) { rotateZone(); } else if (sel !== undefined) { rotateTile(sel, d); }
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && selObj !== undefined) {
            removeObject(selObj);
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && selZone) {
            removeZone();
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel !== undefined) {
            removeTile(sel);
        } else if (e.key === 'Escape') {
            // first the tile being placed (or the start being set), then the selection
            if (pick || pickObj || startMode || greenMode || zoneMode) { pick = undefined; pickObj = undefined; startMode = false; greenMode = false; zoneMode = false; } else { sel = undefined; selObj = undefined; selZone = false; }
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

    /* ---- the trail and measuring tools (docs/curriculum/README.md §9 TRAIL; docs/SIMULATOR.md "The tools pane") ----
     * The route that needs no mouse: every tool here works from the keyboard and states its values as text. What is said
     * goes to #trSay (role=status), outside the pane, so an arrow key's move is announced with the pane shut. */
    const tools = { selected: false, typed: false, pen: true, penNow: true, gap: false, reading: undefined, text: '', print: false, target: undefined,
        grid: 0,            // the grid overlay's spacing in mm, 0 off
        ruler: undefined,   // [a, b], each [x, y]
        prot: undefined,    // [vertex, arm 1, arm 2]
        marks: [],          // the markers dropped: [x, y] each, in order
        pick: undefined };  // the tool taking clicks on the floor: { tool, i }, the point `i` of it next
    /** the measuring tools: their points' labels and ids, and each tool's line of text */
    const TOOLS = {
        ruler: { id: 'trR', points: ['A', 'B'], text: ([a, b]) => {
            const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
            return `Ruler: ${fmt(d, 1)} mm from (${fmt(a[0], 0)}, ${fmt(a[1], 0)}) to (${fmt(b[0], 0)}, ${fmt(b[1], 0)}), bearing ${fmt(wrap180(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI), 1)}°.`;
        } },
        prot: { id: 'trP', points: ['Vertex', 'Arm 1', 'Arm 2'], text: ([v, a, b]) => {
            const d = wrap180((Math.atan2(b[1] - v[1], b[0] - v[0]) - Math.atan2(a[1] - v[1], a[0] - v[0])) * 180 / Math.PI);
            return `Protractor: ${fmt(Math.abs(d), 1)}° at (${fmt(v[0], 0)}, ${fmt(v[1], 0)}), from arm 1 (${fmt(a[0], 0)}, ${fmt(a[1], 0)}) ${d >= 0 ? 'to the left' : 'to the right'} to arm 2 (${fmt(b[0], 0)}, ${fmt(b[1], 0)}).`;
        } },
    };
    const POSE_FIELDS = ['trX', 'trY', 'trH'];
    /** a press that moves less than this (CSS px) is a click; a finger rolls further than a mouse in a tap, and on RCJ or WRO
     *  a tap taken for a put-down costs the game. TAP_PX is a choice, not measured: no touch device has run this */
    const CLICK_PX = 5, TAP_PX = 12;
    const clickPx = (e) => (e.pointerType === 'touch' ? TAP_PX : CLICK_PX);
    /** enough for a class's stops; a list a screen reader can still walk */
    const MAX_MARKS = 50;
    const toolsOpen = () => document.body.classList.contains('tools');
    /** a heading as the panel states it: above -180, up to 180 */
    function wrap180(d) { const a = ((d % 360) + 360) % 360; return a > 180 ? a - 360 : a; }
    /** a pose as the panel says it (A11Y_DESIGN §5 W3's words) */
    const whole = (v) => fmt(Math.round(v) + 0, 0);     // + 0: never "-0"
    const poseText = (p) => `x ${whole(p.x)} mm, y ${whole(p.y)} mm, heading ${whole(wrap180(p.heading))}°`;
    /** into the live region: the same words twice are said twice */
    function say(text) { const e = $('#trSay'); if (e) { e.textContent = ''; e.textContent = text; } }
    /** why the robot cannot stand at (x, y), or '': the course's bounds */
    function offCourse(x, y) {
        if (!geom || !geom.bounds) { return 'The course is still loading.'; }
        const [x0, y0, x1, y1] = geom.bounds;
        return x < x0 || x > x1 || y < y0 || y > y1 ? `That is off the course: x runs ${fmt(x0, 0)} to ${fmt(x1, 0)} mm, y ${fmt(y0, 0)} to ${fmt(y1, 0)} mm.` : '';
    }
    /** the robot put down at `pose` by the typed fields, a nudge or an arrow key: place()'s path, as a drag's (so a run on
     *  a WRO table ends the same way), the refusals said. True when it moved */
    function putRobot(pose) {
        const refuse = (why) => { say(why); return false; };
        if (!snap) { return refuse('The simulator is still starting.'); }
        if (pending.size) { const why = 'The robot can be moved when no program is running.'; showNote(why); return refuse(why); }
        if (!Number.isFinite(pose.x) || !Number.isFinite(pose.y) || !Number.isFinite(pose.heading)) { return refuse('Type a number in each of x, y and heading.'); }
        const off = offCourse(pose.x, pose.y);
        if (off) { return refuse(off); }
        // a new object: the worker's snapshot (`posted`, a restart's state) is never written
        const p = { ...snap.pose, x: pose.x, y: pose.y, heading: wrap180(pose.heading) };
        snap = { ...snap, pose: p };
        place(p);
        tools.typed = false;
        say(`Robot at ${poseText(p)}.`);
        toolsShow();
        draw();
        return true;
    }
    /** a nudge: mm along the floor's x and y, degrees of heading (+ is to the left), from where the robot is */
    function nudge(dx, dy, dh) {
        if (!snap) { say('The simulator is still starting.'); return; }
        const p = snap.pose;
        putRobot({ x: p.x + dx, y: p.y + dy, heading: p.heading + dh });
    }
    /** the typed start pose: an empty field is no number, never a 0 */
    function placeTyped() {
        const v = POSE_FIELDS.map((id) => { const t = $('#' + id).value.trim(); return t === '' ? NaN : Number(t); });
        putRobot({ x: v[0], y: v[1], heading: v[2] });
    }
    function selectRobot(on) {
        tools.selected = on;
        const b = $('#trSel');
        if (b) { b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); }
        $('#trCue').hidden = !on;
        say(on ? 'Robot selected: arrow keys move it 10 mm, Shift with left or right turns it 5°, Escape or a click on the floor lets go.' : 'Robot not selected.');
        draw();
    }
    /** what an arrow key would throw away, in words, or '': a put-down starts a new RCJ game (`Referee.placed`) and ends a
     *  WRO run that is on (`beforePlace`). A key can be a slip, so it never does that; a drag, a typed pose and the
     *  buttons are meant, and still do. A game not yet started has nothing to lose: the keys set its start */
    function atStake() {
        const rf = snap && snap.referee;
        if (!rf) { return ''; }
        if (rf.kind === 'wro') { return rf.run === 'on' ? 'A WRO run is on, and an arrow key would end it. To end it, drag the robot or type its pose.' : ''; }
        return rf.on && (rf.started || rf.ended) ? 'An RCJ game is on the card, and an arrow key would wipe it. For a new game, use Back to start, drag the robot or type its pose.' : '';
    }
    /** the arrow keys while the robot is selected: true when the key was taken */
    function robotKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) { return false; }
        if (tools.pick && e.key === 'Escape' && !builder()) { tools.pick = undefined; say('Stopped picking points.'); return true; }
        if (tools.selected && e.key === 'Escape' && !builder()) { selectRobot(false); return true; }   // from a field too: the cue promises it
        if (!tools.selected || builder() || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { return false; }
        if (e.key === 'm' || e.key === 'M') { dropAtRobot(); return true; }
        const k = { ArrowLeft: [-10, 0, 5], ArrowRight: [10, 0, -5], ArrowUp: [0, 10, 0], ArrowDown: [0, -10, 0] }[e.key];
        if (!k) { return false; }
        const stake = atStake();
        if (stake) { say(stake); showNote(stake); return true; }
        if (e.shiftKey) { if (k[2]) { nudge(0, 0, k[2]); } } else { nudge(k[0], k[1], 0); }
        return true;
    }
    /** the worker's `trail`: the pen (a program's too) and the errors, at each change and before a run's done */
    function onTrail(m) {
        // a pen that went down starts a new piece of the trail: nothing joins it to where the pen came up
        if (m.reading.pen && !tools.penNow) { tools.gap = true; }
        tools.penNow = m.reading.pen; tools.reading = m.reading; tools.text = m.text;
        const b = $('#trPen');
        if (b) { b.setAttribute('aria-pressed', String(tools.penNow)); b.textContent = tools.penNow ? 'Pen is down' : 'Pen is up'; }
        setText($('#trErr'), m.text);
    }
    function togglePen() {
        tools.pen = !tools.penNow;
        toWorker({ type: 'trail', op: 'pen', down: tools.pen });
        say(tools.pen ? 'Pen down.' : 'Pen up.');
    }
    /** the typed target; all empty clears it, a heading may be left out */
    function setTarget() {
        const v = ['trTx', 'trTy', 'trTh'].map((id) => $('#' + id).value.trim());
        if (!v[0] && !v[1] && !v[2]) { tools.target = undefined; toWorker({ type: 'trail', op: 'target' }); say('No target: errors are from the start.'); return; }
        const [x, y, heading] = v.map((t) => (t === '' ? NaN : Number(t)));
        if (!Number.isFinite(x) || !Number.isFinite(y) || (v[2] && !Number.isFinite(heading))) { say('Type a number in target x and y (the heading may be left empty).'); return; }
        tools.target = { x, y, ...(v[2] ? { heading } : {}) };
        toWorker({ type: 'trail', op: 'target', target: tools.target });
        say(`Target x ${fmt(x, 0)} mm, y ${fmt(y, 0)} mm${v[2] ? `, heading ${fmt(heading, 0)}°` : ''}.`);
    }
    /** the path as text (A11Y_DESIGN §5 W2): x_mm,y_mm, a blank line where the pen came up */
    function trailCsv() {
        return 'x_mm,y_mm\n' + trail.map(([x, y, gap]) => `${gap ? '\n' : ''}${x.toFixed(1)},${y.toFixed(1)}`).join('\n') + '\n';
    }
    /** a Run's end: the line said, and printed when asked for (off by default: a program's output stays the board's) */
    function trailRunEnd(id) {
        if (!tools.text) { return; }
        say(tools.text);
        if (tools.print) { vscode.postMessage({ type: 'out', id, text: `${tools.text}\n` }); }
    }
    /** a worker started again (no shared memory, Stop) has the panel's settings back; none changed, nothing is sent */
    function trailResync() {
        if (!tools.pen) { toWorker({ type: 'trail', op: 'pen', down: false }); }
        if (tools.target) { toWorker({ type: 'trail', op: 'target', target: tools.target }); }
    }
    function setGrid() {
        tools.grid = $('#trGrid').checked ? Number($('#trGridMm').value) : 0;
        say(tools.grid ? `Grid on: a line every ${tools.grid} mm, labelled in mm.` : 'Grid off.');
        draw();
    }
    /** a tool's typed points, or the reason they cannot be used */
    function toolPoints(name) {
        const t = TOOLS[name];
        const pts = t.points.map((_, i) => ['x', 'y'].map((c) => { const v = $(`#${t.id}${i}${c}`).value.trim(); return v === '' ? NaN : Number(v); }));
        return pts.every((p) => p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e6)) ? pts : undefined;
    }
    /** what the typed points measure: drawn, shown and said */
    function measure(name) {
        const t = TOOLS[name], pts = toolPoints(name);
        if (!pts) { say(`Type a number, at most a million mm, in every field of the ${name === 'prot' ? 'protractor' : 'ruler'}.`); return; }
        tools[name] = pts;
        const text = t.text(pts);
        setText($(`#${t.id}Out`), text);
        say(text);
        draw();
    }
    function clearTool(name) {
        const t = TOOLS[name];
        tools[name] = undefined;
        if (tools.pick && tools.pick.tool === name) { tools.pick = undefined; }
        t.points.forEach((_, i) => { $(`#${t.id}${i}x`).value = ''; $(`#${t.id}${i}y`).value = ''; });
        setText($(`#${t.id}Out`), '');
        say(`${name === 'prot' ? 'Protractor' : 'Ruler'} cleared.`);
        draw();
    }
    /** the first point of a tool at the robot (a protractor's first arm along its heading, 200 mm out) */
    function toolAtRobot(name) {
        if (!snap) { return; }
        const t = TOOLS[name], p = snap.pose, h = p.heading * Math.PI / 180, r1 = (v) => String(Math.round(v * 10) / 10);
        const set = (i, x, y) => { $(`#${t.id}${i}x`).value = r1(x); $(`#${t.id}${i}y`).value = r1(y); };
        set(0, p.x, p.y);
        if (name === 'prot') { set(1, p.x + 200 * Math.cos(h), p.y + 200 * Math.sin(h)); }
        say(`${t.points[0]} at the robot: x ${fmt(p.x, 0)} mm, y ${fmt(p.y, 0)} mm.`);
    }
    /** a marker as text: where it is, how far from the one before it, and from the robot */
    function markText(i) {
        const [x, y] = tools.marks[i], before = tools.marks[i - 1], p = snap && snap.pose;
        return `x ${fmt(x, 0)} mm, y ${fmt(y, 0)} mm` + (before ? `; ${fmt(Math.hypot(x - before[0], y - before[1]), 1)} mm from marker ${i}` : '') + (p ? `; ${fmt(Math.hypot(x - p.x, y - p.y), 1)} mm from the robot` : '');
    }
    /** the list, built at a change; marksText keeps its words up as the robot moves, its buttons untouched: a snapshot
     *  must not take the focus off a Remove */
    function marksShow() {
        const list = $('#trMarks');
        if (!list) { return; }
        const gone = (i) => {
            tools.marks.splice(i, 1);
            marksShow();
            // the keyboard stays in the list: on the marker now at this number, or the last, or Drop at robot
            const left = list.querySelectorAll('button');
            (left[Math.min(i, left.length - 1)] || $('#trMRobot')).focus();
            say(`Marker ${i + 1} removed: ${tools.marks.length} left.`);
            draw();
        };
        list.textContent = '';
        tools.marks.forEach((_, i) => {
            list.append(el('li', {}, el('span', {}, markText(i)), ' ',
                el('button', { class: 'btn', type: 'button', 'aria-label': `Remove marker ${i + 1}`, title: `Remove marker ${i + 1}`, onclick: () => gone(i) }, '×')));
        });
    }
    function marksText() { [...$('#trMarks').querySelectorAll('li > span')].forEach((e, i) => setText(e, markText(i))); }
    /** a marker at (x, y): numbered, drawn and listed; nothing on the course senses it */
    function dropMark(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) { say('Type a number in marker x and y.'); return; }
        if (tools.marks.length >= MAX_MARKS) { say(`There are ${MAX_MARKS} markers: remove one first.`); return; }
        tools.marks.push([x, y]);
        marksShow();
        say(`Marker ${tools.marks.length} at x ${fmt(x, 0)} mm, y ${fmt(y, 0)} mm.`);
        draw();
    }
    function dropTyped() {
        const v = ['trMx', 'trMy'].map((id) => { const t = $('#' + id).value.trim(); return t === '' ? NaN : Number(t); });
        dropMark(v[0], v[1]);
    }
    function dropAtRobot() { if (snap) { dropMark(snap.pose.x, snap.pose.y); } else { say('The simulator is still starting.'); } }
    function clearMarks() { tools.marks.length = 0; marksShow(); say('Markers cleared.'); draw(); }
    /** a new course: its markers go with the old one (a WRO field laid again keeps them: the same floor) */
    function toolsNewCourse(id) { if (id !== tools.course) { tools.course = id; if (tools.marks.length) { clearMarks(); } } }
    /** clicks on the floor fill a tool's points, in order, then it measures (the fields stay the route without a mouse) */
    function startPick(name) {
        tools.pick = { tool: name, i: 0 };
        say(name === 'marks' ? 'Click the floor for each marker. Escape stops.' : `Click the floor for ${TOOLS[name].points[0]}. Escape stops.`);
    }
    function pickPoint(x, y) {
        if (tools.pick.tool === 'marks') { dropMark(Math.round(x), Math.round(y)); return; }
        const k = tools.pick, t = TOOLS[k.tool], r1 = (v) => String(Math.round(v));
        $(`#${t.id}${k.i}x`).value = r1(x); $(`#${t.id}${k.i}y`).value = r1(y);
        k.i++;
        if (k.i < t.points.length) { say(`Click the floor for ${t.points[k.i]}.`); return; }
        tools.pick = undefined;
        measure(k.tool);
    }
    const worldText = (text, x, y) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, -1);
        ctx.font = `${12 / view.k}px sans-serif`;
        ctx.fillText(text, 0, 0);
        ctx.restore();
    };
    /** the grid overlay, under the trail: a line every tools.grid mm on the course's bounds, labelled on the x and y axes */
    function gridDraw() {
        if (!tools.grid || !geom || !geom.bounds) { return; }
        const [x0, y0, x1, y1] = geom.bounds, g = tools.grid;
        ctx.strokeStyle = 'rgba(42,120,214,0.3)';
        ctx.lineWidth = 1 / view.k / dpr;
        ctx.beginPath();
        for (let x = Math.ceil(x0 / g) * g; x <= x1; x += g) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
        for (let y = Math.ceil(y0 / g) * g; y <= y1; y += g) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
        ctx.stroke();
        ctx.fillStyle = '#2a78d6';
        const label = Math.max(g, Math.ceil(60 / view.k / g) * g);    // never closer than 60 px
        for (let x = Math.ceil(x0 / label) * label; x <= x1; x += label) { worldText(String(x), x, y0); }
        for (let y = Math.ceil(y0 / label) * label; y <= y1; y += label) { worldText(String(y), x0, y); }
    }
    /** a tool's lines, over the course */
    function toolsDraw() {
        ctx.strokeStyle = ctx.fillStyle = '#c2410c';
        ctx.lineWidth = Math.max(1.5, 2 / view.k / dpr);
        const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
        const r = tools.ruler, q = tools.prot, w = 10 / view.k / dpr;
        tools.marks.forEach(([x, y], i) => { line([x - w, y - w], [x + w, y + w]); line([x - w, y + w], [x + w, y - w]); worldText(String(i + 1), x + w, y + w); });
        if (r) {
            const len = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]);
            line(r[0], r[1]);
            // a tick every 100 mm, across the line (at most 200 of them)
            if (len > 0) {
                const ux = (r[1][0] - r[0][0]) / len, uy = (r[1][1] - r[0][1]) / len, step = Math.max(100, len / 200);
                for (let d = 0; d <= len; d += step) { const x = r[0][0] + ux * d, y = r[0][1] + uy * d; line([x - uy * w, y + ux * w], [x + uy * w, y - ux * w]); }
            }
            worldText(`${fmt(len, 1)} mm`, (r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2);
        }
        if (q) {
            line(q[0], q[1]); line(q[0], q[2]);
            const a0 = Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]), a1 = Math.atan2(q[2][1] - q[0][1], q[2][0] - q[0][0]);
            const d = wrap180((a1 - a0) * 180 / Math.PI), rr = 40 / view.k / dpr;
            ctx.beginPath(); ctx.arc(q[0][0], q[0][1], rr, a0, a0 + d * Math.PI / 180, d < 0); ctx.stroke();
            worldText(`${fmt(Math.abs(d), 1)}°`, q[0][0] + rr * 1.2 * Math.cos(a0 + d * Math.PI / 360), q[0][1] + rr * 1.2 * Math.sin(a0 + d * Math.PI / 360));
        }
    }
    /** the pane's text: the robot's pose, and the fields unless they are being typed in */
    function toolsShow() {
        if (!toolsOpen() || !snap) { return; }
        const p = snap.pose;
        setText($('#trPose'), poseText(p));
        if (tools.marks.length) { marksText(); }
        // typed values wait to be used, focus or not: Tab to Put robot here must not find them overwritten
        if (!tools.typed) {
            [p.x, p.y, wrap180(p.heading)].forEach((v, i) => { const f = $('#' + POSE_FIELDS[i]); const t = String(Math.round(v * 10) / 10); if (f.value !== t) { f.value = t; } });
        }
    }
    function toolsPaneDom() {
        const field = (id, label, unit) => [el('label', { for: id }, label), el('div', {}, el('input', { type: 'number', id, step: 'any', oninput: () => { tools.typed = true; }, onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); placeTyped(); } } }), ` ${unit}`)];
        const nb = (id, text, label, ...d) => el('button', { class: 'btn', type: 'button', id, 'aria-label': label, title: label, onclick: () => nudge(...d) }, text);
        return el('div', { id: 'toolsPane', class: 'pane' },
            el('h2', {}, 'Robot'),
            el('p', { class: 'sub' }, 'Now: ', el('span', { id: 'trPose' }, '-')),
            el('div', { class: 'grid' }, ...field('trX', 'Start x', 'mm'), ...field('trY', 'Start y', 'mm'), ...field('trH', 'Start heading', '° (0 faces +x, + is to the left)')),
            el('div', { class: 'actions' },
                el('button', { class: 'btn primary', type: 'button', id: 'trPlace', title: 'Put the robot down at the typed pose (Enter in a field does the same)', onclick: placeTyped }, 'Put robot here'),
                el('button', { class: 'btn', type: 'button', id: 'trSel', 'aria-pressed': 'false', title: 'Select the robot: the arrow keys move it 10 mm, Shift with left or right turns it 5°, Escape or a click on the floor lets go. A click on the robot selects it too.', onclick: () => selectRobot(!tools.selected) }, 'Select robot')),
            el('div', { class: 'actions', role: 'group', 'aria-label': 'Nudge the robot' },
                nb('trXm', 'x −10', 'Move the robot 10 mm to the left (x minus 10)', -10, 0, 0), nb('trXp', 'x +10', 'Move the robot 10 mm to the right (x plus 10)', 10, 0, 0),
                nb('trYm', 'y −10', 'Move the robot 10 mm down the view (y minus 10)', 0, -10, 0), nb('trYp', 'y +10', 'Move the robot 10 mm up the view (y plus 10)', 0, 10, 0),
                nb('trHp', 'left 5°', 'Turn the robot 5° to the left (heading plus 5)', 0, 0, 5), nb('trHm', 'right 5°', 'Turn the robot 5° to the right (heading minus 5)', 0, 0, -5)),
            el('h2', {}, 'Pen and errors'),
            el('div', { class: 'actions' },
                el('button', { class: 'btn', type: 'button', id: 'trPen', 'aria-pressed': 'true', title: 'Put the pen at the middle of the axle up or down: a program can too (simtrail.pen_up(), simtrail.pen_down())', onclick: togglePen }, 'Pen is down'),
                el('button', { class: 'btn', type: 'button', id: 'trCsv', title: 'Copy the path drawn as x_mm,y_mm lines', onclick: () => { vscode.postMessage({ type: 'copy', text: trailCsv(), what: 'the path as CSV' }); say(`${trail.length} points copied.`); } }, 'Copy path as CSV')),
            el('div', { class: 'grid' }, ...['trTx:Target x:mm', 'trTy:Target y:mm', 'trTh:Target heading:°'].map((t) => t.split(':')).flatMap(([id, label, unit]) => [el('label', { for: id }, label), el('div', {}, el('input', { type: 'number', id, step: 'any', onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); setTarget(); } } }), ` ${unit}`)])),
            el('div', { class: 'actions' }, el('button', { class: 'btn', type: 'button', id: 'trTarget', title: 'The end-point and heading errors measure from this target: all empty, from the run\'s start', onclick: setTarget }, 'Set target')),
            el('p', { class: 'sub', id: 'trErr' }, 'Run a program: the errors show here.'),
            el('label', { class: 'inline' }, el('input', { type: 'checkbox', id: 'trPrint', onchange: (e) => { tools.print = e.target.checked; } }), 'Print these to the output when a run ends'),
            el('h2', {}, 'Measure'),
            el('p', { class: 'sub' }, 'Drawn on the 2D view; the numbers here hold in 3D too.'),
            el('div', { class: 'actions' },
                el('label', { class: 'inline' }, el('input', { type: 'checkbox', id: 'trGrid', onchange: setGrid }), 'Grid every'),
                el('select', { id: 'trGridMm', 'aria-label': 'Grid spacing', onchange: setGrid }, ...[50, 100, 300, 500].map((v) => { const o = el('option', { value: String(v) }, `${v} mm`); if (v === 100) { o.selected = true; } return o; }))),
            ...['ruler', 'prot'].map((name) => {
                const t = TOOLS[name], word = name === 'prot' ? 'Protractor' : 'Ruler';
                const enter = (e) => { if (e.key === 'Enter') { e.preventDefault(); measure(name); } };
                return el('div', { role: 'group', 'aria-label': word, style: 'display:flex;flex-direction:column;gap:6px' },
                    el('b', {}, word),
                    el('div', { class: 'grid' }, ...t.points.flatMap((label, i) => [el('span', {}, label),
                        el('div', {}, ...['x', 'y'].flatMap((c) => [el('input', { type: 'number', id: `${t.id}${i}${c}`, step: 'any', style: 'width:5.5em', 'aria-label': `${word} ${label} ${c} in mm`, onkeydown: enter }), ' '])), ])),
                    el('div', { class: 'actions' },
                        el('button', { class: 'btn', type: 'button', id: `${t.id}Go`, title: 'Measure between the typed points (Enter in a field does the same)', onclick: () => measure(name) }, 'Measure'),
                        el('button', { class: 'btn', type: 'button', id: `${t.id}Robot`, title: name === 'prot' ? 'The vertex at the robot, arm 1 along its heading' : 'Point A at the robot', onclick: () => toolAtRobot(name) }, 'From robot'),
                        el('button', { class: 'btn', type: 'button', id: `${t.id}Pick`, title: `Click the floor for each point in turn (Escape stops)`, onclick: () => startPick(name) }, 'Pick on floor'),
                        el('button', { class: 'btn', type: 'button', id: `${t.id}Clear`, onclick: () => clearTool(name) }, 'Clear')),
                    el('p', { class: 'sub', id: `${t.id}Out` }));
            }),
            el('div', { role: 'group', 'aria-label': 'Markers', style: 'display:flex;flex-direction:column;gap:6px' },
                el('b', {}, 'Markers'),
                el('div', { class: 'grid' }, ...['x', 'y'].flatMap((c) => [el('label', { for: `trM${c}` }, `Marker ${c}`), el('div', {}, el('input', { type: 'number', id: `trM${c}`, step: 'any', onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); dropTyped(); } } }), ' mm')])),
                el('div', { class: 'actions' },
                    el('button', { class: 'btn', type: 'button', id: 'trMRobot', title: 'Drop a marker at the middle of the axle (M, while the robot is selected)', onclick: dropAtRobot }, 'Drop at robot'),
                    el('button', { class: 'btn', type: 'button', id: 'trMGo', title: 'Drop a marker at the typed x and y (Enter in a field does the same)', onclick: () => dropTyped() }, 'Drop here'),
                    el('button', { class: 'btn', type: 'button', id: 'trMPick', title: 'Each click on the floor drops a marker (Escape stops)', onclick: () => startPick('marks') }, 'Pick on floor'),
                    el('button', { class: 'btn', type: 'button', id: 'trMClear', onclick: clearMarks }, 'Clear')),
                el('ol', { id: 'trMarks', style: 'margin:0;padding-left:1.6em' })),
        );
    }

    /* ---- the live plot (docs/curriculum/README.md §9 PLOT; docs/SIMULATOR.md "The plot") -------------------------------
     * Plots what a program could print, and nothing else: a channel is either a printed `name=value` or a getter of the
     * robot's own objects, named as Copy setup code names them, its value worked out as that getter's (the sign of a
     * mirrored motor, whole degrees). The snapshot's truth is never read here: not the pose, the course's progress, the
     * hazards, the referee, a motor's volts or a servo's shaft (Servo.angle() is the tracked position, not the shaft). So
     * no run needs a special case to keep the true state out (README §9 GT), and nothing goes to the worker. A scored
     * run (Run challenge) runs in workers of its own, which post nothing here: while one is on, the panel's own world is
     * not that run, so nothing is taken at all.
     * Cost: shut, one test of plot.on per snapshot and per output, no store, nothing kept (the worker is untouched, so a
     * tick pays nothing, open or shut). Open: every channel is a ring of PLOT_MAX samples, at most PLOT_PRINTED printed
     * names. A Run is not a tick: it takes each motor's angle and the IMU's heading as the program's zeros, and clears, shut
     * or open, so the pane never shows an older Run as current. */
    const PLOT_MAX = 6000;          // samples kept per channel: 200 s of snapshots at 30 a second
    const PLOT_PRINTED = 32;        // printed names kept
    const PLOT_TRACES = 6;          // traces at once: one line style and marker each, no two alike
    const PLOT_LINE = 512;          // the longest printed line read
    const PLOT_EVERY_MS = 100;      // the drawing's rate, whatever the snapshots' rate
    const PLOT_PAGE = 50;           // a table's rows at a time: a list a screen reader can walk
    const PLOT_TICKS = 12;          // the most ticks an axis rules: a count, so no pair of numbers can keep its loop going
    const PLOT_SAME = 1e-12;        // values closer than this share of their size are ruled as one value (a filter's 23 and 22.999999999999996)
    /** a trace's look: told apart by its line and its marker (and its direct label), the colour only as well (README §9 PLOT);
     *  every ink at least 3:1 on --surface in both themes (a row measures it) */
    const PLOT_STYLES = [
        { words: 'solid line, circles', dash: [], mark: 'circle', ink: '#0072b2' },
        { words: 'dashed line, squares', dash: [9, 4], mark: 'square', ink: '#d55e00' },
        { words: 'dotted line, triangles', dash: [2, 3], mark: 'triangle', ink: '#009e73' },
        { words: 'dash-dot line, crosses', dash: [10, 3, 2, 3], mark: 'cross', ink: '#c0689a' },
        { words: 'long-dashed line, diamonds', dash: [16, 5], mark: 'diamond', ink: '#a87f00' },
        { words: 'sparse-dotted line, plus signs', dash: [2, 8], mark: 'plus', ink: '#6c71c4' },
    ];
    /** a printed name and its value, anywhere in a line, Python's words for no number and for a bool included. A pair
     *  stands alone: `a=b`, `x==3` and `?id=7&y=2` are no pairs. */
    const PLOT_PAIR = /(?:^|[\s,;])([A-Za-z_][A-Za-z0-9_]{0,31})\s*=\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|None|nan|-?inf|True|False)(?=$|[\s,;])/g;
    const plot = {
        on: false,          // the pane is open: only then is anything taken
        paused: false,
        scored: false,      // a Run challenge was on at the last look
        chans: new Map(),   // label -> channel, live first, then printed in the order they came
        key: '',            // the snapshot's shape the live channels were built from
        t0: undefined,      // the world's clock at the plot's zero
        tLast: undefined,   // the last frame taken: a `done` repeats a frame
        x: 0,               // seconds since t0 of the last frame
        a0: [],             // each motor's angle at the Run's start: Motor() reads 0 there, as reset_angle(0) (evn.py Motor.__init__)
        h0: 0,              // the IMU's heading at the Run's start: imu.heading() reads from where IMU() opened
        lines: 0,           // printed lines with a pair, since the last clear
        carry: '',          // the start of a printed line whose end has not come
        skip: false,        // the rest of a line past PLOT_LINE is being passed over
        axis: '@auto',      // what the x axis is: @auto, @time, @line, or a printed channel's label (no name holds an @)
        own: false,         // each trace on its own scale
        dropped: 0,         // samples pushed out of a full ring
        refused: 0,         // printed values under names past PLOT_PRINTED
        drawn: 0,           // when it was last drawn
        cur: [undefined, undefined],    // cursors A and B: the { t, ln } of the row each is on
        view: undefined,    // what was last shown: the cursors' rows
        geo: undefined,     // where it was drawn: { L, pw, x0, x1 }
        table: false,       // the table is showing
        page: undefined,    // the table's first row; undefined: it follows the latest rows
        tab: undefined,     // what the table's page was built for: its rows stay while that holds
        missed: false,      // the last Run came with the pane shut: nothing before the pane opened is here
        held: [],           // the x of each Run that came while paused with samples here: those up to it are an earlier Run's
        late: false,        // the last Run came while paused: its start was not taken
    };
    const plotOpen = () => document.body.classList.contains('plot');
    /** a number as words read it: three decimals, under 1 three figures (0.00012 stays 0.00012), never "-0" */
    const plotNum = (v) => (Number.isFinite(v) ? String(Number(Math.abs(v) < 1 ? v.toPrecision(3) : v.toFixed(3)) + 0) : '');
    /** a number in the CSV: in full, what the program printed */
    const plotFull = (v) => (Number.isFinite(v) ? String(v + 0) : '');
    const plotTicked = () => [...plot.chans.values()].filter((c) => c.style !== undefined);
    /** a channel and its ring: x seconds since the plot's zero, ln its printed line (0: a frame's, -1: the line breaks here) */
    function plotChannel(label, unit, read) {
        return { label, unit, read, x: new Float64Array(PLOT_MAX), y: new Float64Array(PLOT_MAX), ln: new Int32Array(PLOT_MAX), head: 0, n: 0, cut: false, style: undefined };
    }
    function plotRing(c, x, y, ln) {
        let i;
        if (c.n < PLOT_MAX) { i = (c.head + c.n) % PLOT_MAX; c.n++; } else { i = c.head; c.head = (c.head + 1) % PLOT_MAX; plot.dropped++; }
        c.x[i] = x; c.y[i] = y; c.ln[i] = ln;
    }
    function plotPush(c, x, y, ln) {
        if (c.cut) { c.cut = false; plotRing(c, x, NaN, -1); }
        plotRing(c, x, y, ln);
    }
    /** what was not taken leaves a gap: nothing joins the samples on either side of it */
    function plotBreak() { for (const c of plot.chans.values()) { if (c.n) { c.cut = true; } } }
    /** the robot's getters, as the program of Copy setup code reads them (evn.py Motor.angle(), speed(); colorChip.ts
     *  normalized(), to within a count; DistanceSensor.distance(); IMU.heading(); battery.voltage()). Two keep a zero of
     *  the program's, which the world does not: the angle and the heading, from the Run. The rest are the frame's own. */
    function plotDefs(s) {
        const db = hw.driveBase, defs = [];
        const mech = new Map((hw.mechanisms || []).filter((m) => m.motor).map((m) => [m.motor, `${m.type}${m.motor}`]));
        s.motors.forEach((m, i) => {
            const left = m.port === db.leftPort, right = m.port === db.rightPort;
            const name = left ? 'left' : right ? 'right' : mech.get(m.port) || `motor${m.port}`;     // G7's motor4 = Motor(4)
            const sign = (left && db.leftMirrored) || (right && db.rightMirrored) ? -1 : 1;
            defs.push([`${name}.angle()`, 'deg', (f) => Math.round((f.motors[i].angle - (plot.a0[i] || 0)) * sign)], [`${name}.speed()`, 'deg/s', (f) => Math.round(f.motors[i].speed * sign)]);
        });
        s.sensors.forEach((c, i) => { for (let k = 0; k < 4; k++) { defs.push([`sensor${c.port}.normalized()[${k}]`, '%', (f) => f.sensors[i].value[k]]); } });
        s.distance.forEach((d, i) => { defs.push([`distance${d.port}.distance()`, 'mm', (f) => { const r = f.distance[i].range; return r === null || r === undefined ? NaN : Math.trunc(r); }]); });
        if (s.imu) { defs.push(['imu.heading()', 'deg', (f) => f.imu.heading - plot.h0]); }
        defs.push(['battery.voltage()', 'mV', (f) => f.packMv]);
        return defs;
    }
    /** the live channels for this robot: a new robot starts them empty, a tick staying on a name that stays */
    function plotBuild(s, key) {
        plot.key = key;
        const old = plot.chans;
        plot.chans = new Map();
        for (const [label, unit, read] of plotDefs(s)) {
            const c = plotChannel(label, unit, read);
            if (old.has(label)) { c.style = old.get(label).style; }
            plot.chans.set(label, c);
        }
        for (const [label, c] of old) { if (!c.read) { plot.chans.set(label, c); } }
        plotList();
    }
    const plotKey = (s) => [s.motors, s.sensors, s.distance].map((l) => l.map((d) => d.port).join()).join('/') + (s.imu ? '/imu' : '');
    /** whether anything is taken now: never in a Run challenge, whose robot is not the panel's */
    function plotTakes() {
        const scored = chal.busy;
        if (scored !== plot.scored) { plot.scored = scored; plotBreak(); plotShow(); }
        return !scored && !plot.paused;
    }
    function plotDue() {
        const now = performance.now();
        if (now - plot.drawn >= PLOT_EVERY_MS) { plot.drawn = now; plotShow(); }
    }
    function plotSnap(s) {
        if (!plotTakes()) { return; }
        const key = plotKey(s);
        if (key !== plot.key) { plotBuild(s, key); }
        if (s.t === plot.tLast) { return; }
        if (plot.t0 === undefined) { plot.t0 = s.t; }
        // the world's clock went back (a new board): the plot's runs on from where it was
        if (s.t < plot.tLast) { plot.t0 = s.t - plot.x; plotBreak(); }
        plot.tLast = s.t;
        plot.x = s.t - plot.t0;
        for (const c of plot.chans.values()) { if (c.read) { plotPush(c, plot.x, c.read(s), 0); } }
        plotDue();
    }
    /** one printed line: its `name=value` pairs are one sample each, stamped with the last frame's time (`print` has no
     *  clock of its own, so a line is placed to a frame, 33 ms of the wall), numbered with the line */
    function plotLine(line) {
        if (line.length > PLOT_LINE || line.indexOf('=') < 0) { return; }
        let ln = 0;
        for (const [, name, text] of line.matchAll(PLOT_PAIR)) {
            let c = plot.chans.get(name);
            if (!c) {
                if ([...plot.chans.values()].filter((k) => !k.read).length >= PLOT_PRINTED) { plot.refused++; continue; }
                c = plotChannel(name, '', undefined);
                plot.chans.set(name, c);
                // the quick look: what is printed is plotted, the time column excepted
                if (name !== 't') { plotTick(c, true, true); }
                plotList();
            }
            if (!ln) { ln = ++plot.lines; }
            plotPush(c, plot.x, text === 'True' ? 1 : text === 'False' ? 0 : Number(text), ln);
        }
    }
    function plotOut(text) {
        if (!plotTakes()) { return; }
        const s = plot.carry + text;
        let at = 0, nl;
        while ((nl = s.indexOf('\n', at)) >= 0) {
            if (plot.skip) { plot.skip = false; } else { plotLine(s.slice(at, nl)); }
            at = nl + 1;
        }
        plot.carry = s.slice(at);
        if (plot.carry.length > PLOT_LINE) { plot.carry = ''; plot.skip = true; }
        plotDue();
    }
    /** everything taken goes; the printed names with no tick go with it, so one run's names do not fill the list for the next */
    function plotClear() {
        for (const [label, c] of plot.chans) {
            if (!c.read && c.style === undefined) { plot.chans.delete(label); continue; }
            c.head = 0; c.n = 0; c.cut = false;
        }
        plot.t0 = undefined; plot.tLast = undefined; plot.x = 0;
        plot.lines = 0; plot.carry = ''; plot.skip = false; plot.dropped = 0; plot.refused = 0;
        plot.cur = [undefined, undefined]; plot.page = undefined;
        plot.missed = false; plot.held = []; plot.late = false;
        plotList();
        plotShow();
    }
    /** the zeros of the program's getters, from frame s; no frame: none. They stand until the next Run: a restart carries
     *  the shafts over (workerCore.ts restore) and Apply leaves them (World.configure), so neither moves a motor's zero */
    function plotZero(s) {
        plot.a0 = s ? s.motors.map((m) => m.angle) : [];
        plot.h0 = s && s.imu ? s.imu.heading : 0;
    }
    /** a restart with no Run: the new board's IMU starts again at 0 (restore carries no heading), so the zero moves with it
     *  and imu.heading() carries on from the last frame, as the shafts do; s: the new board's first frame */
    function plotCarry(s) {
        if (snap && snap.imu && s.imu) { plot.h0 += s.imu.heading - snap.imu.heading; }
    }
    /** a Run: the plot starts from it, shut or open, unless paused (what is on screen is being read, and the pane says
     *  whose it is). Per Run, not per tick: shut, this still keeps nothing. */
    function plotRun() {
        plotZero(snap);
        if (!plot.paused) { plotClear(); plot.missed = !plot.on; return; }
        plot.late = true;
        if (!plot.held.includes(plot.x) && [...plot.chans.values()].some((c) => c.n > 0)) { plot.held.push(plot.x); }
        plotShow();
    }
    /** the pane opened, or the robot changed with it open */
    function plotOpened() {
        if (snap) { const key = plotKey(snap); if (key !== plot.key) { plotBuild(snap, key); } }
        plotBreak();
        plotList();
        plotShow();
    }
    /** a new robot (Apply, the host's): its channels are built again */
    function plotHw() { plot.key = ''; if (plot.on) { plotOpened(); } }
    /** a tick on or off: a free style on, at most PLOT_TRACES; false when refused */
    function plotTick(c, on, quiet) {
        if (!on) { c.style = undefined; return true; }
        const used = new Set(plotTicked().map((k) => k.style));
        const free = PLOT_STYLES.findIndex((_, i) => !used.has(i));
        if (free < 0) { if (!quiet) { say(`${PLOT_TRACES} traces at most: untick one first.`); } return false; }
        c.style = free;
        return true;
    }
    /** the channel lists, in two groups: built again only when a channel comes or goes */
    function plotList() {
        const box = $('#plChans');
        if (!box) { return; }
        // a Run and a new name build the list again: the keyboard stays on its box
        const had = [...plot.chans.values()].find((c) => c.box && c.box === document.activeElement);
        const row = (c) => {
            const b = el('input', { type: 'checkbox', onchange: (e) => {
                const on = e.target.checked, ok = plotTick(c, on);
                e.target.checked = on && ok;
                if (ok) { say(on ? `${c.label}: ${PLOT_STYLES[c.style].words}.` : `${c.label} off the plot.`); }
                plotShow();
            } });
            b.checked = c.style !== undefined;
            c.box = b;
            return el('label', { class: 'inline' }, b, c.label, c.unit ? ` (${c.unit})` : '');
        };
        const all = [...plot.chans.values()], live = all.filter((c) => c.read), said = all.filter((c) => !c.read);
        box.replaceChildren(
            el('fieldset', { class: 'plGroup' }, el('legend', {}, 'The robot, as the setup code reads it'), ...(live.length ? live.map(row) : ['No frame from the simulator yet.'])),
            el('fieldset', { class: 'plGroup' }, el('legend', {}, 'Printed name=value lines'), ...(said.length ? said.map(row) : ['None yet: print("error=%d" % e) makes a channel called error.'])));
        if (had) { had.box.focus(); }
        plotAxes();
    }
    /** the x axis's choices: a printed channel can be one (a log's t, or speed against distance) */
    function plotAxes() {
        const s = $('#plAxis');
        const names = [...plot.chans.values()].filter((c) => !c.read).map((c) => c.label);
        const want = [['@auto', 'Automatic'], ['@time', 'Time (s)'], ['@line', 'Printed line number'], ...names.map((n) => [n, `Printed ${n}`])];
        if (s.options.length !== want.length || want.some(([v], i) => s.options[i].value !== v)) {
            s.replaceChildren(...want.map(([v, t]) => el('option', { value: v }, t)));
        }
        if (!want.some(([v]) => v === plot.axis)) { plot.axis = '@auto'; }
        s.value = plot.axis;
    }
    /** the rows of `cols`, one for each frame and each printed line, oldest first: { t, ln, cut, v, x }; v[i] is undefined
     *  where col i has no sample here, NaN where its sample is no number (None); cut: nothing joins this row to the one before */
    function plotRows(cols) {
        const at = cols.map(() => 0), rows = [];
        let cut = false;
        for (;;) {
            let t = Infinity, ln = Infinity;
            cols.forEach((c, i) => {
                while (at[i] < c.n && c.ln[(c.head + at[i]) % PLOT_MAX] < 0) { at[i]++; cut = true; }
                if (at[i] >= c.n) { return; }
                const k = (c.head + at[i]) % PLOT_MAX;
                if (c.x[k] < t || (c.x[k] === t && c.ln[k] < ln)) { t = c.x[k]; ln = c.ln[k]; }
            });
            if (t === Infinity) { return rows; }
            const v = cols.map((c, i) => {
                if (at[i] >= c.n) { return undefined; }
                const k = (c.head + at[i]) % PLOT_MAX;
                if (c.x[k] !== t || c.ln[k] !== ln) { return undefined; }
                at[i]++;
                return c.y[k];
            });
            rows.push({ t, ln, cut, v, x: t });
            cut = false;
        }
    }
    /** what the plot shows now. Automatic is time, except for printed lines that came in one burst (a log printed after its
     *  run has no time of its own): those go against their `t` if they print one, else against their line number */
    function plotView() {
        const cols = plotTicked();
        const rows = plotRows(cols);
        let axis = plot.axis;
        if (axis === '@auto') {
            const burst = rows.length > 1 && rows[rows.length - 1].t - rows[0].t < rows.length * 0.001;
            axis = cols.length && cols.every((c) => !c.read) && burst ? (plot.chans.has('t') ? 't' : '@line') : '@time';
        }
        if (axis === '@time') { return { name: 'Time (s)', at: (x) => `${plotNum(x)} s`, cols, rows, left: [] }; }
        // against a printed value only a printed line has an x
        const drawn = cols.filter((c) => !c.read), left = cols.filter((c) => c.read);
        const by = axis === '@line' ? undefined : plot.chans.get(axis);
        const bi = by ? (drawn.includes(by) ? drawn.indexOf(by) : drawn.length) : -1;
        const kept = [];
        for (const r of plotRows(by && bi === drawn.length ? [...drawn, by] : drawn)) {
            const x = by ? r.v[bi] : r.ln;
            if (Number.isFinite(x)) { r.x = x; r.v = r.v.slice(0, drawn.length); kept.push(r); }
        }
        return { name: by ? `Printed ${axis}` : 'Printed line number', at: (x) => `${by ? axis : 'line'} ${plotNum(x)}`, cols: drawn, rows: kept, left, by };
    }
    /** the step a ruled axis takes: 1, 2 or 5 of a power of ten, about `n` steps across */
    function plotStep(span, n) {
        const raw = span / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
        return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
    }
    /** the room one value needs either side: 0 where a and b are two values on a ruled axis. Values closer than PLOT_SAME
     *  are one value here (the words and the CSV still give them), so a step is always many times a double's own step */
    function plotFlat(a, b) {
        const m = Math.max(Math.abs(a), Math.abs(b));
        return b - a > m * PLOT_SAME ? 0 : Math.max(1, m / 1000);
    }
    /** a tick's words: the step's own decimals, so 1000.0002 stays apart from 1000.0004; as a power from 1e7, and where
     *  the step is past the 100 decimals toFixed holds */
    function plotWord(v, step) {
        const places = Math.min(100, Math.max(0, -Math.floor(Math.log10(step))));
        return Math.abs(v) >= 1e7 || (v !== 0 && step < 1e-100) ? v.toExponential(Math.min(20, Math.ceil(Math.log10(Math.abs(v) / step)))).replace('+', '') : String(Number(v.toFixed(places)) + 0);
    }
    /** an axis's ticks from lo to hi: { ticks: [value, words][], base }: counted, never stepped by adding, and PLOT_TICKS at
     *  most whatever the numbers are; none where the span is past what a number holds (the words still state the values).
     *  Where any word is too wide (`fits`, measured), the first tick is the base, said once, and the ticks count from it */
    function plotTicks(lo, hi, fits) {
        const step = plotStep(hi - lo, 5), first = Math.ceil(lo / step), ticks = [];
        if (!(step > 0) || !Number.isFinite(step) || !Number.isFinite(first)) { return { ticks }; }
        for (let k = 0; k < PLOT_TICKS; k++) {
            const v = (first + k) * step;
            if (v > hi) { break; }
            ticks.push([v, plotWord(v, step)]);
        }
        if (ticks.every(([, w]) => fits(w))) { return { ticks }; }
        return { base: ticks[0][1], ticks: ticks.map(([v], k) => [v, plotWord(k * step, step)]) };
    }
    function plotMark(g, kind, x, y) {
        const r = 3.5;
        g.setLineDash([]);
        g.beginPath();
        if (kind === 'circle') { g.arc(x, y, r, 0, 2 * Math.PI); } else if (kind === 'square') { g.rect(x - r, y - r, 2 * r, 2 * r); } else if (kind === 'triangle') {
            g.moveTo(x, y - r - 1); g.lineTo(x + r + 1, y + r); g.lineTo(x - r - 1, y + r); g.closePath();
        } else if (kind === 'cross') { g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); } else if (kind === 'diamond') {
            g.moveTo(x, y - r - 1); g.lineTo(x + r + 1, y); g.lineTo(x, y + r + 1); g.lineTo(x - r - 1, y); g.closePath();
        } else { g.moveTo(x - r - 1, y); g.lineTo(x + r + 1, y); g.moveTo(x, y - r - 1); g.lineTo(x, y + r + 1); }
        g.stroke();
    }
    /** each trace's lowest and highest value, and the lot's */
    function plotRanges(view) {
        const each = view.cols.map(() => [Infinity, -Infinity]);
        for (const r of view.rows) { r.v.forEach((v, i) => { if (Number.isFinite(v)) { if (v < each[i][0]) { each[i][0] = v; } if (v > each[i][1]) { each[i][1] = v; } } }); }
        return { each, lo: Math.min(...each.map((e) => e[0])), hi: Math.max(...each.map((e) => e[1])) };
    }
    function plotDraw(view, rng) {
        const cv = $('#plCanvas');
        const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 430, H = cv.clientHeight || 250;
        if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        const g = cv.getContext('2d'), css = getComputedStyle(document.body);
        const ink = css.getPropertyValue('--text').trim() || '#808080', rule = css.getPropertyValue('--border-strong').trim() || '#808080';
        const words = css.getPropertyValue('--ink').trim() || ink;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        g.font = '11px sans-serif';
        g.lineWidth = 1;
        g.fillStyle = ink; g.strokeStyle = rule;
        const L = 52, R = 10, T = 10, B = 34, pw = W - L - R, ph = H - T - B;
        plot.geo = undefined;
        if (!view.rows.length) { g.textAlign = 'center'; g.fillText(!view.cols.length ? 'Tick a channel to plot it' : plot.missed ? 'The last Run went with this pane shut' : 'Waiting for samples', L + pw / 2, T + ph / 2); return; }
        let x0 = Infinity, x1 = -Infinity;
        for (const r of view.rows) { if (r.x < x0) { x0 = r.x; } if (r.x > x1) { x1 = r.x; } }
        x1 += plotFlat(x0, x1);
        const pad = (a, b) => { const w = plotFlat(a, b); return w ? [a - w, b + w] : [a - (b - a) * 0.05, b + (b - a) * 0.05]; };
        const [y0, y1] = Number.isFinite(rng.lo) ? pad(rng.lo, rng.hi) : [0, 1];
        const px = (x) => L + (x - x0) / (x1 - x0) * pw;
        const yFor = (i) => {
            const [a, b] = plot.own && Number.isFinite(rng.each[i][0]) ? pad(rng.each[i][0], rng.each[i][1]) : [y0, y1];
            return (y) => T + ph - (y - a) / (b - a) * ph;
        };
        // the axes: on their own scales the y axis is each trace's lowest to highest, which the key states
        g.setLineDash([]);
        g.beginPath(); g.rect(L, T, pw, ph); g.stroke();
        g.textAlign = 'center';
        // ticks are at least pw / 5 apart, and the y axis's end at L - 4: each word measured against its room
        const wide = (w) => g.measureText(w).width;
        const xs = plotTicks(x0, x1, (w) => wide(w) <= pw / 5 - 4);
        for (const [x, tick] of xs.ticks) { g.fillText(tick, Math.min(px(x), W - wide(tick) / 2), T + ph + 13); g.beginPath(); g.moveTo(px(x), T + ph); g.lineTo(px(x), T + ph + 3); g.stroke(); }
        g.fillText(view.name, L + pw / 2, H - 6);
        g.textAlign = 'right';
        if (xs.base) { g.fillText(`x: ${xs.base} + tick`, L + pw, H - 6); }
        if (plot.own) {
            g.fillText('highest', L - 4, T + 10); g.fillText('lowest', L - 4, T + ph);
        } else {
            const yp = yFor(0);
            const ys = plotTicks(y0, y1, (w) => wide(w) <= L - 4);
            for (const [y, tick] of ys.ticks) { g.fillText(tick, L - 4, yp(y) + 4); g.beginPath(); g.moveTo(L, yp(y)); g.lineTo(L + pw, yp(y)); g.stroke(); }
            if (ys.base) { g.textAlign = 'left'; g.fillText(`y: ${ys.base} + tick`, L, T - 1); g.textAlign = 'right'; }
        }
        const ends = [];
        view.cols.forEach((c, i) => {
            const st = PLOT_STYLES[c.style], yp = yFor(i);
            g.strokeStyle = st.ink; g.fillStyle = st.ink; g.lineWidth = 1.5;
            g.setLineDash(st.dash);
            g.beginPath();
            // at most two points to a pixel column, its lowest and highest: a spike stays, however many samples there are
            let col, lo, hi, pen = false, end;
            const flush = () => {
                if (col === undefined) { return; }
                if (pen) { g.lineTo(col, lo); } else { g.moveTo(col, lo); pen = true; }
                if (hi !== lo) { g.lineTo(col, hi); }
                col = undefined;
            };
            for (const r of view.rows) {
                const v = r.v[i];
                if (r.cut) { flush(); pen = false; }
                if (v === undefined) { continue; }
                if (!Number.isFinite(v)) { flush(); pen = false; continue; }    // None: a gap in the line
                const X = Math.round(px(r.x)), Y = yp(v);
                if (X !== col) { flush(); col = X; lo = Y; hi = Y; } else { if (Y < lo) { lo = Y; } if (Y > hi) { hi = Y; } }
                end = [px(r.x), Y];
            }
            flush();
            g.stroke();
            // a marker every so often, from the trace's own samples, staggered so that two lying together both show
            let next = L + i * 9;
            for (const r of view.rows) {
                const v = r.v[i];
                if (!Number.isFinite(v)) { continue; }
                const X = px(r.x);
                if (X >= next) { plotMark(g, st.mark, X, yp(v)); next = X + 54; }
            }
            if (end) { plotMark(g, st.mark, end[0], end[1]); ends.push({ label: c.label, y: end[1], ink: st.ink, mark: st.mark }); }
        });
        // the cursors: a line each, named, A solid and B dashed
        plot.geo = { L, pw, x0, x1 };
        g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 1; g.textAlign = 'center';
        plot.cur.forEach((c, i) => {
            if (!c) { return; }
            const X = px(view.rows[plotFind(view.rows, c)].x);
            g.setLineDash(i ? [5, 3] : []);
            g.beginPath(); g.moveTo(X, T); g.lineTo(X, T + ph); g.stroke();
            g.fillText('AB'[i], X, T + 9);
        });
        // the direct labels: at each trace's end, moved apart so that none lies on another, from the top and then from the
        // bottom, so that none runs past the plot
        g.textAlign = 'right';
        ends.sort((a, b) => a.y - b.y);
        let low = T + 10, high = T + ph - 2;
        for (const e of ends) { e.at = Math.max(low, Math.min(e.y - 5, high)); low = e.at + 12; }
        for (const e of ends.slice().reverse()) { e.at = Math.min(e.at, high); high = e.at - 12; }
        // each beside its trace's marker, for the ink alone is under 4.5:1 (1.4.3): the words in --ink, on a halo of the
        // plot's own ground, so that a label stays readable where a trace runs under it
        const ground = css.getPropertyValue('--surface').trim() || '#ffffff';
        for (const e of ends) {
            g.lineWidth = 1.5; g.strokeStyle = e.ink;
            plotMark(g, e.mark, L + pw - 8, e.at - 4);
            g.lineWidth = 3; g.strokeStyle = ground;
            g.strokeText(e.label, L + pw - 16, e.at);
            g.fillStyle = words; g.fillText(e.label, L + pw - 16, e.at);
        }
    }
    /** the row at or after `at`, the last if there is none: rows run in order of { t, ln }, whatever the x axis */
    function plotFind(rows, at) {
        let lo = 0, hi = rows.length - 1;
        while (lo < hi) {
            const m = (lo + hi) >> 1, r = rows[m];
            if (r.t < at.t || (r.t === at.t && r.ln < at.ln)) { lo = m + 1; } else { hi = m; }
        }
        return lo;
    }
    /** a value of column i with its unit, as a cursor states it */
    function plotValue(c, v) {
        if (v === undefined) { return 'no sample here'; }
        return Number.isFinite(v) ? `${plotNum(v)}${c.unit ? ` ${c.unit}` : ''}` : 'no reading';
    }
    /** a cursor's words: where it is and every trace's value there */
    function plotAt(view, name, r) { return `${name} at ${view.at(r.x)}: ${view.cols.map((c, i) => `${c.label} ${plotValue(c, r.v[i])}`).join(', ')}.`; }
    /** the cursors' lines of text and their sliders, for what is shown */
    function plotCursors(view) {
        const rows = view.rows, on = plot.cur.map((c) => (c && rows.length ? rows[plotFind(rows, c)] : undefined));
        const lines = on.map((r, i) => (r ? plotAt(view, 'AB'[i], r) : '')).filter(Boolean);
        if (on[0] && on[1]) {
            const [a, b] = on;
            const dv = view.cols.map((c, i) => (Number.isFinite(a.v[i]) && Number.isFinite(b.v[i]) ? `${c.label} ${plotNum(b.v[i] - a.v[i])}${c.unit ? ` ${c.unit}` : ''}` : `${c.label} no difference`));
            lines.push(`B less A: ${view.at(b.x - a.x)}, ${dv.join(', ')}.`);
        }
        setText($('#plRead'), lines.join('\n'));
        ['#plA', '#plB'].forEach((id, i) => {
            const s = $(id);
            plotOff(s, !rows.length);
            s.max = String(Math.max(0, rows.length - 1));
            if (on[i]) { s.value = String(plotFind(rows, plot.cur[i])); s.setAttribute('aria-valuetext', plotAt(view, 'AB'[i], on[i])); } else { s.value = '0'; s.setAttribute('aria-valuetext', 'not placed'); }
        });
    }
    /** cursor i on row k of what is shown: drawn, stated and said */
    function plotPlace(i, k) {
        const view = plot.view, r = view && view.rows[k];
        if (!r) { say('There is nothing to read yet.'); return; }
        plot.cur[i] = { t: r.t, ln: r.ln };
        plotShow();
        say(plotAt(view, 'AB'[i], r));
    }
    /** the row nearest x on the axis shown */
    function plotNear(x) {
        let best = -1, gap = Infinity;
        plot.view.rows.forEach((r, k) => { const d = Math.abs(r.x - x); if (d < gap) { gap = d; best = k; } });
        return best;
    }
    function plotGo(i) {
        const t = $(i ? '#plBt' : '#plAt').value.trim(), x = t === '' ? NaN : Number(t);
        if (!Number.isFinite(x)) { say('Type a number on the x axis.'); return; }
        plotPlace(i, plotNear(x));
    }
    /** a click on the plot puts A there, with Shift B */
    function plotClick(e) {
        const q = plot.geo;
        if (!q || !plot.view.rows.length) { return; }
        plotPlace(e.shiftKey ? 1 : 0, plotNear(q.x0 + (e.offsetX - q.L) / q.pw * (q.x1 - q.x0)));
    }
    function plotCursorsOff() { plot.cur = [undefined, undefined]; plotShow(); say('Cursors off.'); }
    /** the table: what the plot shows, PLOT_PAGE rows at a time; a cell's '-' is no sample in that row, 'none' a reading of no number */
    function plotTable(view) {
        const n = view.rows.length, last = Math.max(0, Math.ceil(n / PLOT_PAGE) - 1) * PLOT_PAGE;
        const from = plot.page === undefined || plot.page >= last ? last : plot.page;
        const shown = view.rows.slice(from, from + PLOT_PAGE), body = $('#plTable').tBodies[0];
        // a page stands while it is the same page, a row that comes is added: a screen reader's place stays under a run's redraws
        const page = [view.name, ...view.cols.map((c) => c.label), from, shown.length ? `${shown[0].t},${shown[0].ln}` : ''].join('|');
        if (page !== plot.tab) {
            plot.tab = page;
            const head = el('tr', {}, el('th', { scope: 'col' }, view.name), ...view.cols.map((c) => el('th', { scope: 'col' }, c.unit ? `${c.label} (${c.unit})` : c.label)));
            $('#plTable').tHead.replaceChildren(head);
            body.replaceChildren();
        }
        for (const r of shown.slice(body.rows.length)) {
            body.append(el('tr', {}, el('th', { scope: 'row' }, plotNum(r.x)), ...r.v.map((v) => el('td', {}, v === undefined ? '-' : Number.isFinite(v) ? plotNum(v) : 'none'))));
        }
        setText($('#plPage'), n ? `Rows ${from + 1} to ${Math.min(n, from + PLOT_PAGE)} of ${n}.` : 'No rows yet.');
        plotOff($('#plPrev'), from === 0);
        plotOff($('#plNext'), from >= last);
        return from;
    }
    /** off, and still where the keyboard is: `disabled` under the focus would drop a keyboard's place in the pane */
    function plotOff(e, off) { e.setAttribute('aria-disabled', String(off)); }
    /** a page back or on; on past the last, the table follows the latest rows again */
    function plotTurn(by) {
        const view = plot.view, last = Math.max(0, Math.ceil(view.rows.length / PLOT_PAGE) - 1) * PLOT_PAGE;
        const from = (plot.page === undefined ? last : Math.min(plot.page, last)) + by * PLOT_PAGE;
        plot.page = from >= last ? undefined : Math.max(0, from);
        plotTable(view);
        say($('#plPage').textContent);
    }
    function plotTableToggle() {
        plot.table = !plot.table;
        const b = $('#plTableBtn');
        b.setAttribute('aria-expanded', String(plot.table));
        b.classList.toggle('on', plot.table);
        $('#plTableBox').hidden = !plot.table;
        plot.tab = undefined;
        if (plot.table) { plotShow(); } else { $('#plTable').tBodies[0].replaceChildren(); }
        say(plot.table ? $('#plPage').textContent : 'Table shut.');
    }
    /** the samples as CSV: the ticked channels, and what they are plotted against, whatever the page; time_s as the data
     *  logger's, the printed line when there is one, values in full, no sample or no number an empty cell; a printed
     *  `time_s`, `line` or `run` is headed as printed, so that no two columns share a name; samples that cross a Run (one came
     *  while paused) carry a `run` column, 1 the oldest, for each Run reads from its own zeros */
    function plotCsv() {
        const view = plotView(), cols = plotTicked();
        if (view.by && !cols.includes(view.by)) { cols.push(view.by); }
        const lines = cols.some((c) => !c.read);
        const runs = plot.held.length ? (r) => [String(1 + plot.held.filter((x) => r.t > x).length)] : () => [];
        const body = plotRows(cols).map((r) => [plotNum(r.t), ...runs(r), ...(lines ? [r.ln > 0 ? String(r.ln) : ''] : []), ...r.v.map((v) => (v === undefined ? '' : plotFull(v)))].join(','));
        const head = (c) => (c.unit ? `${c.label} (${c.unit})` : c.label === 'time_s' || c.label === 'line' || c.label === 'run' ? `printed ${c.label}` : c.label);
        return body.length ? [['time_s', ...(plot.held.length ? ['run'] : []), ...(lines ? ['line'] : []), ...cols.map(head)].join(','), ...body, ''].join('\n') : '';
    }
    function plotExport(type, words) {
        const text = plotCsv();
        if (!text) { say('Nothing to export: tick a channel, and take some samples.'); return; }
        vscode.postMessage({ type, text, what: 'the plot as CSV' });
        say(plot.held.length ? `${words} These samples cross a Run: the run column marks whose each row is, each Run from its own zeros.` : words);
    }
    /** the plot's drawing and its words: the words say all that the picture does */
    function plotShow() {
        if (!plot.on) { return; }
        const view = plotView(), rng = plotRanges(view);
        plot.view = view;
        plotDraw(view, rng);
        plotCursors(view);
        if (plot.table) { plotTable(view); }
        // its items stay, and only the words that changed are written: a screen reader's place stays under a run's redraws
        const key = $('#plKey');
        while (key.children.length > view.cols.length) { key.lastChild.remove(); }
        view.cols.forEach((c, i) => {
            const [lo, hi] = rng.each[i], u = c.unit ? ` ${c.unit}` : '';
            let now = '';
            for (let k = view.rows.length - 1; k >= 0 && !now; k--) { const v = view.rows[k].v[i]; if (Number.isFinite(v)) { now = plotNum(v); } }
            setText(key.children[i] || key.appendChild(el('li')), `${c.label}: ${PLOT_STYLES[c.style].words}${Number.isFinite(lo) ? `, from ${plotNum(lo)} to ${plotNum(hi)}${u}, now ${now}${u}` : ', no samples'}`);
        });
        const chans = [...plot.chans.values()], samples = chans.reduce((a, c) => a + c.n, 0), bytes = chans.reduce((a, c) => a + c.x.byteLength + c.y.byteLength + c.ln.byteLength, 0);
        const parts = [plot.scored ? 'A scored run is on: it runs apart from this panel, and nothing is taken until it ends.' : plot.paused ? 'Paused: nothing is taken, the run goes on.' : 'Taking samples.',
            ...(plot.missed ? [`The last Run went with this pane shut, and nothing is kept while it is shut: ${view.rows.length ? 'these samples start from when it opened' : 'press Run with it open'}.`] : []),
            ...(plot.held.length ? ['Some or all of these samples are from before the last Run, which came while paused.'] : []),
            ...(plot.late && !plot.paused ? ['The last Run\'s start is missing: it came while paused, and nothing was taken until the resume.'] : []),
            `${view.rows.length} ${view.rows.length === 1 ? 'row' : 'rows'} against ${view.name.toLowerCase()}.`,
            ...(view.left.length ? [`Not on this axis, having no printed line: ${view.left.map((c) => c.label).join(', ')}.`] : []),
            ...(plot.dropped ? [`Each channel keeps its last ${PLOT_MAX} samples: ${plot.dropped} older ones have gone.`] : []),
            ...(plot.refused ? [`${PLOT_PRINTED} printed names at most: ${plot.refused} values under other names were left out.`] : []),
            `Kept: ${samples} samples of ${chans.length} channels in ${Math.round(bytes / 1024)} kB.`];
        setText($('#plInfo'), parts.join(' '));
        $('#plCanvas').setAttribute('aria-label', view.cols.length ? `Plot against ${view.name.toLowerCase()} of ${view.cols.map((c) => c.label).join(', ')}: the list below it gives each trace in words.` : 'Plot: no channel ticked.');
    }
    function plotPause() {
        plot.paused = !plot.paused;
        const b = $('#plPause');
        b.textContent = plot.paused ? 'Resume' : 'Pause';
        b.setAttribute('aria-pressed', String(plot.paused));
        if (!plot.paused) { plotBreak(); }
        say(plot.paused ? 'Plot paused: nothing is taken until you resume, and the run goes on.' : 'Plot running.');
        plotShow();
    }
    function plotPaneDom() {
        return el('div', { id: 'plotPane', class: 'pane' },
            el('h2', {}, 'Plot'),
            el('p', { class: 'sub' }, 'What a program could print, against time. Open this before you press Run: nothing is kept while it is shut, and a Run starts it again, shut or open. To compare two Runs, print both from one program, or Copy CSV after each.'),
            el('p', { class: 'sub', id: 'plLimits' }, 'The robot\'s channels are the setup code\'s objects, unchanged, from the Run. After reset_angle(), a calibration, a Motor made later or a second one on its port, or another gear, unit or axis they differ: for an exact value, print it.'),
            el('canvas', { id: 'plCanvas', role: 'img', 'aria-label': 'Plot: no channel ticked.', onclick: plotClick }),
            el('ul', { id: 'plKey', class: 'plKey' }),
            ...['A', 'B'].map((n, i) => el('div', { class: 'plCursor' },
                el('label', { class: 'inline' }, `Cursor ${n} `, el('input', { type: 'range', id: `pl${n}`, min: '0', max: '0', step: '1', value: '0', 'aria-disabled': 'true', 'aria-valuetext': 'not placed', oninput: (e) => plotPlace(i, Number(e.target.value)),
                    // at 0 already, these move nothing and so send no input: an unplaced cursor goes on row 0 by them all the same
                    onkeydown: (e) => { if (!plot.cur[i] && ['Home', 'ArrowLeft', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); plotPlace(i, 0); } } })),
                el('label', { class: 'inline' }, 'at ', el('input', { type: 'number', step: 'any', id: `pl${n}t`, 'aria-label': `Cursor ${n} at this x`, onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); plotGo(i); } } })),
                el('button', { class: 'btn', type: 'button', id: `pl${n}Go`, title: `Put cursor ${n} on the sample nearest this x (Enter in the field does the same)`, onclick: () => plotGo(i) }, 'Go'))),
            el('p', { class: 'sub', id: 'plRead' }),
            el('div', { class: 'actions' },
                el('button', { class: 'btn', type: 'button', id: 'plPause', 'aria-pressed': 'false', title: 'Stop taking samples, to read what is there; the run goes on', onclick: plotPause }, 'Pause'),
                el('button', { class: 'btn', type: 'button', id: 'plClear', title: 'Throw away the samples taken so far', onclick: () => { plotClear(); say('Plot cleared.'); } }, 'Clear'),
                el('button', { class: 'btn', type: 'button', id: 'plCurOff', title: 'Take both cursors off the plot', onclick: plotCursorsOff }, 'Cursors off')),
            el('label', { class: 'inline' }, 'Against ', el('select', { id: 'plAxis', onchange: (e) => { plot.axis = e.target.value; plotShow(); } })),
            el('label', { class: 'inline' }, el('input', { type: 'checkbox', id: 'plOwn', onchange: (e) => { plot.own = e.target.checked; plotShow(); } }), 'Each trace on its own scale'),
            el('p', { class: 'sub', id: 'plInfo' }, '-'),
            el('div', { class: 'actions' },
                el('button', { class: 'btn', type: 'button', id: 'plTableBtn', 'aria-expanded': 'false', 'aria-controls': 'plTableBox', title: 'The samples as a table: what the plot shows, as text', onclick: plotTableToggle }, 'Table'),
                el('button', { class: 'btn', type: 'button', id: 'plCopy', title: 'Copy the ticked channels as CSV', onclick: () => plotExport('copy', 'The plot is on the clipboard as CSV.') }, 'Copy CSV'),
                el('button', { class: 'btn', type: 'button', id: 'plSave', title: 'Save the ticked channels to a CSV file', onclick: () => plotExport('plot-save', 'Save CSV: pick a file in the dialog.') }, 'Save CSV')),
            el('div', { id: 'plTableBox', hidden: '' },
                el('table', { id: 'plTable', class: 'plTable' }, el('caption', {}, 'The plot\'s samples, oldest first, to three decimals, or three figures under 1: the CSV has them in full. A dash: no sample in this row. None: no reading.'), el('thead'), el('tbody')),
                el('p', { class: 'sub', id: 'plPage' }, 'No rows yet.'),
                el('div', { class: 'actions' },
                    el('button', { class: 'btn', type: 'button', id: 'plPrev', onclick: () => plotTurn(-1) }, 'Earlier rows'),
                    el('button', { class: 'btn', type: 'button', id: 'plNext', onclick: () => plotTurn(1) }, 'Later rows'))),
            el('div', { id: 'plChans' }));
    }

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
            // the drive base presets (src/sim/engine/drivePresets.ts applyDrivePreset: a test compares them): the drive
            // base, the chassis and the name written into the form, the rest kept; Apply checks and applies it
            el('div', { class: 'actions' }, ...(cfg.drivePresets || []).map((p) => el('button', {
                class: 'btn', type: 'button', 'data-preset': p.id,
                title: `${p.name}: ${p.driveBase.motor} on M${p.driveBase.leftPort} (left${p.driveBase.leftMirrored ? ', mirrored' : ''}) and M${p.driveBase.rightPort} (right${p.driveBase.rightMirrored ? ', mirrored' : ''}), ${p.driveBase.wheelDiameter} mm wheels ${p.driveBase.axleTrack} mm apart, and its chassis. Your sensors and other hardware stay; Apply to use it.`,
                onclick: () => { readForm(); hw.name = p.name; hw.driveBase = { ...p.driveBase }; hw.chassis = { ...p.chassis }; buildConfig(); },
            }, `Preset: ${p.name}`))),
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
        camConfig(f);
        const imuOn = el('input', { type: 'checkbox', id: 'fImu' });
        imuOn.checked = !!hw.imu;
        f.append(
            el('h2', {}, 'IMU'),
            el('p', { class: 'sub' }, 'An MPU-6500 lying flat on the robot: its heading, and its pitch and roll on a ramp or a seesaw.'),
            el('div', { class: 'grid' },
                el('label', { for: 'fImu' }, 'IMU'), el('label', { class: 'inline' }, imuOn, 'on I2C port ', numIn(hw.imu ? hw.imu.port : freePort(), { id: 'fImuPort', min: 1, max: 16, step: 1 })),
            ),
        );
        periphConfig(f);
        mechConfig(f);
        $('#setup').textContent = setupCode(hw);
    }

    /* servos, touch arrays and ADCs with their switches (src/sim/engine/peripherals.ts): a card per device, a row per
     * switch - where its feeler sits (forward, left, height), the way it points (angle) and its reach */
    const SERVO_TYPES = ['geekservo_270', 'geekservo_360', 'geekservo_cr', 'generic'];
    const SW_KEYS = ['forward', 'left', 'height', 'angle', 'reach'];
    // a new switch sits on the body's front, its lever 10 mm out of it (review r1 S1: one at forward 40 never reached
    // past the default robot's 70 mm front)
    const swDefault = () => ({ forward: Math.round(robotShape().front), left: 0, height: 30, angle: 0, reach: 10 });
    /** a feeler whose tip stays inside the body's outline never touches anything: the configurator says so */
    function swShort(c) {
        const sh = robotShape(), a = c.angle * Math.PI / 180;
        const x = c.forward + c.reach * Math.cos(a), y = c.left + c.reach * Math.sin(a);
        return !(x > sh.front || x < sh.rear || Math.abs(y) > sh.half);
    }
    /** the stall torque the servo card shows: blank (auto, the type's) when it is the type's own, so a new type brings
     *  its own (review r1 N6) */
    const SERVO_TORQUE = { geekservo_270: 0.196, geekservo_360: 0.196, geekservo_cr: 0.196, generic: 0.177 };
    function torqueShown(s) { return s.torque === undefined || s.torque === null || s.torque === SERVO_TORQUE[s.type] ? '' : s.torque; }
    function periphConfig(f) {
        hw.servos = hw.servos || []; hw.touchArrays = hw.touchArrays || []; hw.adcs = hw.adcs || [];
        const box = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
        hw.servos.forEach((s, i) => box.append(servoCard(s, i)));
        hw.touchArrays.forEach((t, i) => box.append(touchCard(t, i)));
        hw.adcs.forEach((a, i) => box.append(adcCard(a, i)));
        const free = (list) => { const used = new Set(list.map((x) => x.port)); let p = 1; while (used.has(p)) { p++; } return p; };
        const add = (label, on, full) => { const b = el('button', { class: 'btn', type: 'button', onclick: () => { readForm(); on(); buildConfig(); } }, label); b.disabled = full; return b; };
        f.append(
            el('h2', {}, 'Servos, touch arrays and ADCs'),
            el('p', { class: 'sub' }, 'Servos on servo ports S1-S4 (Servo(n)); an MPR121 touch array (TouchArray(n)) or an ADS1115 ADC (ADC(n)) on an I2C port. A limit switch or bumper is a touch-array electrode or an ADC input: its feeler (where it sits, the way it points, its reach in mm) closes on a wall, a block or a ramp.'),
            box,
            el('div', { class: 'actions' },
                add('+ Add a servo', () => hw.servos.push({ port: free(hw.servos), type: 'geekservo_270' }), hw.servos.length >= 4),
                add('+ Add a touch array', () => hw.touchArrays.push({ port: freePort(), electrodes: [{ channel: 0, contact: swDefault() }] }), hw.touchArrays.length >= 2),
                add('+ Add an ADC', () => hw.adcs.push({ port: freePort(), inputs: [{ input: 0, volts: 0, pressed: 3.3, contact: swDefault() }] }), hw.adcs.length >= 2)),
        );
    }
    /* mechanisms (src/sim/engine/mechanisms.ts): a card each - its type, its servo or motor port, what it rides on, its
     * mount, its joint (joint = ratio x (shaft - zero), the limits), its sizes; a claw's gripper contacts and a
     * claw / scoop / bin's "ball held" switch wired to a touch-array electrode or an ADC input (I2C port / channel) */
    // the same as mechanisms.ts MECH_PRESETS (a test compares them); I2C port 0: the lowest free one
    const MECH_PRESETS = [{"name":"Arm + claw on servos 1 / 2","servos":[{"port":1,"type":"geekservo_270"},{"port":2,"type":"geekservo_270"}],"touchArrays":[{"port":0,"electrodes":[]}],"mechanisms":[{"type":"arm","servo":1,"forward":30,"up":70,"level":true},{"type":"claw","servo":2,"on":0,"contacts":{"port":0,"channel":0},"held":{"port":0,"channel":1}}]},{"name":"Scoop on motor 3 + door on servo 1","servos":[{"port":1,"type":"geekservo_270"}],"touchArrays":[{"port":0,"electrodes":[]}],"mechanisms":[{"type":"scoop","motor":3,"forward":45,"up":0,"held":{"port":0,"channel":0}},{"type":"door","servo":1,"on":0}]}];
    const MECH_KEYS = ['servo', 'motor', 'on', 'forward', 'left', 'up', 'yaw', 'zero', 'ratio', 'min', 'max', 'length', 'width', 'height', 'thick', 'mass'];
    function mechConfig(f) {
        hw.mechanisms = hw.mechanisms || [];
        const box = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
        hw.mechanisms.forEach((m, i) => box.append(mechCard(m, i)));
        const preset = (p) => () => {
            // a touch array already fitted whose electrodes the preset's wires leave free is reused (a second click does
            // not add another: review r1)
            const chs = p.mechanisms.flatMap((m) => [m.contacts, m.held]).filter(Boolean).map((w) => w.channel);
            const reuse = hw.touchArrays.find((t) => !t.electrodes.some((e) => chs.includes(e.channel)));
            const port = reuse ? reuse.port : freePort(), fill = (o) => JSON.parse(JSON.stringify(o).replace(/"port":0/g, `"port":${port}`));
            hw.servos = [...hw.servos.filter((s) => !p.servos.some((q) => q.port === s.port)), ...p.servos];
            if (!reuse) { hw.touchArrays = [...hw.touchArrays, ...fill(p.touchArrays)]; }
            hw.mechanisms = fill(p.mechanisms);
        };
        const go = (label, on) => el('button', { class: 'btn', type: 'button', onclick: () => { readForm(); on(); buildConfig(); } }, label);
        f.append(el('h2', {}, 'Mechanisms'),
            el('p', { class: 'sub' }, 'A claw, a lift arm, a scoop, a storage bin or a release door, on a servo port or a motor port the wheels do not use. Its joint follows the shaft: joint = ratio x (shaft angle - zero), held at min / max (a claw\'s joint is its jaw gap in mm; an arm\'s its pitch, a scoop\'s or bin\'s its tilt, a door\'s its opening, in degrees). "on" puts it on an earlier arm / scoop / bin\'s tip. A claw\'s contacts close on a conductive (live) victim; a ball-held switch closes while a ball is in it.'),
            box, el('div', { class: 'actions' }, go('+ Add a mechanism', () => hw.mechanisms.push({ type: 'claw' })), ...MECH_PRESETS.map((p) => go(p.name, preset(p)))));
    }
    function mechCard(m, i) {
        const type = el('select', { class: 'mType' }, ...['arm', 'claw', 'scoop', 'bin', 'door'].map((t) => { const o = el('option', { value: t }, t); if (t === m.type) { o.selected = true; } return o; }));
        const lvl = el('input', { type: 'checkbox', class: 'mLevel' }); lvl.checked = m.level !== false;
        const wire = (k) => el('label', {}, k + ' port / ch', numIn(m[k] ? m[k].port : '', { class: `m_${k}P` }), numIn(m[k] ? m[k].channel : '', { class: `m_${k}C` }));
        return el('div', { class: 'sensor pdev', 'data-kind': 'mech' }, pdevHead(`Mechanism ${i + 1}`, 'mechanisms', i, (gone) => {
            // what rode on it rides on what it rode on (or the chassis); later indices move down one (review r1)
            const was = gone.on ?? null;
            for (const q of hw.mechanisms) { if (q.on === undefined || q.on === null) { continue; } if (q.on === i) { q.on = was; } else if (q.on > i) { q.on--; } }
        }),
            el('label', {}, 'type', type), ...MECH_KEYS.map((k) => el('label', {}, k, numIn(m[k] ?? '', { class: 'm_' + k, placeholder: k === 'on' ? 'chassis' : 'auto' }))),
            el('label', {}, 'level (arm)', lvl), wire('contacts'), wire('held'));
    }
    function readMech() {
        return [...document.querySelectorAll('.sensor.pdev[data-kind="mech"]')].map((c) => {
            const m = { type: $('.mType', c).value, level: $('.mLevel', c).checked };
            for (const k of MECH_KEYS) { const v = $('.m_' + k, c).value.trim(); if (v !== '') { m[k] = Number(v); } }
            for (const k of ['contacts', 'held']) { const v = $(`.m_${k}P`, c).value.trim(); if (v !== '') { m[k] = { port: Number(v), channel: Number($(`.m_${k}C`, c).value || 0) }; } }
            return m;
        });
    }
    /** a card's title and its remove button: `key` names the list in hw - readForm() makes a new hw, so the list is looked up
     *  after it (review r1: the list captured at build time was the old one); `after(removed)` fixes what pointed at it */
    function pdevHead(title, key, i, after) {
        return el('div', { class: 't' }, title, el('button', { class: 'x', type: 'button', title: 'Remove it', onclick: () => { readForm(); const [gone] = hw[key].splice(i, 1); if (after) { after(gone); } buildConfig(); } }, '×'));
    }
    function servoCard(s, i) {
        const type = el('select', { class: 'pType' }, ...SERVO_TYPES.map((t) => { const o = el('option', { value: t }, t); if (t === s.type) { o.selected = true; } return o; }));
        return el('div', { class: 'sensor pdev', 'data-kind': 'servo' }, pdevHead(`Servo ${i + 1}`, 'servos', i),
            el('label', {}, 'servo port', numIn(s.port, { class: 'pPort', min: 1, max: 4, step: 1 })),
            el('label', {}, 'type', type),
            el('label', {}, 'stall torque (N m)', numIn(torqueShown(s), { class: 'pTorque', min: 0.01, max: 5, placeholder: 'auto' })));
    }
    /** a switch row: the channel / input, its feeler; on an ADC also its volts released / pressed (no feeler: a constant) */
    function swRow(chKey, max, e, adc) {
        const c = e.contact || swDefault();
        const on = el('input', { type: 'checkbox', class: 'wOn' }); on.checked = !adc || !!e.contact;
        return el('div', { class: 'sw', style: 'grid-column:1/-1;display:grid;grid-template-columns:repeat(' + (adc ? 9 : 6) + ',1fr);gap:4px' },
            el('label', {}, chKey, numIn(e[chKey], { class: 'wCh', min: 0, max, step: 1 })),
            ...(adc ? [el('label', {}, 'volts', numIn(e.volts, { class: 'wV', min: -0.3, max: 3.6 })), el('label', {}, 'pressed', numIn(e.pressed ?? 3.3, { class: 'wP', min: -0.3, max: 3.6 })), el('label', {}, 'switch', on)] : []),
            ...SW_KEYS.map((k) => el('label', {}, k, numIn(c[k], { class: 'w_' + k }))),
            ...((!adc || e.contact) && swShort(c) ? [el('p', { class: 'warn', style: 'grid-column:1/-1;margin:0' }, 'Its tip does not reach past the body: it never closes on a wall (move it out or lengthen its reach).')] : []));
    }
    function readSw(row, chKey, adc) {
        const n = (sel) => Number($(sel, row).value);
        const contact = Object.fromEntries(SW_KEYS.map((k) => [k, n('.w_' + k)]));
        return adc ? { input: n('.wCh'), volts: n('.wV'), pressed: n('.wP'), contact: $('.wOn', row).checked ? contact : null } : { channel: n('.wCh'), contact };
    }
    function touchCard(t, i) {
        return el('div', { class: 'sensor pdev', 'data-kind': 'touch' }, pdevHead(`Touch array ${i + 1}`, 'touchArrays', i),
            el('label', {}, 'I2C port', numIn(t.port, { class: 'pPort', min: 1, max: 16, step: 1 })),
            el('button', { class: 'btn', type: 'button', onclick: () => { readForm(); const e = hw.touchArrays[i].electrodes; e.push({ channel: Math.min(11, e.length), contact: swDefault() }); buildConfig(); } }, '+ switch'),
            ...t.electrodes.map((e) => swRow('channel', 11, e, false)));
    }
    function adcCard(a, i) {
        return el('div', { class: 'sensor pdev', 'data-kind': 'adc' }, pdevHead(`ADC ${i + 1}`, 'adcs', i),
            el('label', {}, 'I2C port', numIn(a.port, { class: 'pPort', min: 1, max: 16, step: 1 })),
            el('button', { class: 'btn', type: 'button', onclick: () => { readForm(); const n = hw.adcs[i].inputs; n.push({ input: Math.min(3, n.length), volts: 0, pressed: 3.3, contact: swDefault() }); buildConfig(); } }, '+ input'),
            ...a.inputs.map((e) => swRow('input', 3, e, true)));
    }
    function readPeriph() {
        const out = { servos: [], touchArrays: [], adcs: [] };
        for (const c of document.querySelectorAll('.sensor.pdev')) {
            if (c.dataset.kind === 'mech') { continue; }   // readMech's (no .pPort: it threw)
            const port = Number($('.pPort', c).value), rows = [...c.querySelectorAll('.sw')];
            if (c.dataset.kind === 'servo') {
                const tq = $('.pTorque', c).value.trim();
                out.servos.push({ port, type: $('.pType', c).value, ...(tq === '' ? {} : { torque: Number(tq) }) });
            } else if (c.dataset.kind === 'touch') { out.touchArrays.push({ port, electrodes: rows.map((r) => readSw(r, 'channel', false)) }); }
            else if (c.dataset.kind === 'adc') { out.adcs.push({ port, inputs: rows.map((r) => readSw(r, 'input', true)) }); }
        }
        return out;
    }

    /** the lowest I2C port no device of the robot has */
    function freePort() {
        const used = new Set([...hw.colorSensors.map((s) => s.port), ...(hw.distanceSensors || []).map((s) => s.port), ...(hw.imu ? [hw.imu.port] : []),
            ...(hw.touchArrays || []).map((s) => s.port), ...(hw.adcs || []).map((s) => s.port)]);
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
            el('label', {}, 'height', numIn(s.height, { class: 'sH', min: 2, max: 80 })),
            // where it looks (SIMULATOR_WRO_DESIGN.md §4.3 8): the floor (today's), or ahead, calibrated at `cal` mm
            el('label', { title: 'down: the floor under it; forward: walls, obstacles and game objects within 30 mm ahead' }, 'facing',
                // a new facing clears cal (review W2c r2 N-2: forward's 8 mm must not stay on a sensor switched to down)
                el('select', { class: 'sFace', onchange: (ev) => { ev.target.closest('.sensor').querySelector('.sCal').value = ''; } }, ...['down', 'forward'].map((f) => { const o = el('option', { value: f }, f); if (f === (s.facing || 'down')) { o.selected = true; } return o; }))),
            // the calibration distance: white this far off reads white (forward: default 8; down: empty = the height)
            el('label', { title: 'the distance at which white reads white (mm): forward 2-25, default 8; down: empty for its height, or near an object\'s distance to read its top' }, 'cal',
                numIn(s.cal ?? '', { class: 'sCal', min: 2, max: 80, placeholder: 'auto' })),
        );
    }

    /** the configurator's cameras (camera.ts CameraConfig; design §2.1-§2.3): up to cfg.maxCameras */
    const CAM_RES = [[160, 120], [320, 240], [640, 480], [800, 600], [1280, 720]];
    function camConfig(f) {
        const max = cfg.maxCameras || 2;
        f.append(
            el('h2', {}, `Cameras (up to ${max})`),
            el('p', { class: 'sub' }, 'A camera on the robot whose picture your own program on this computer reads (OpenCV: cv2.VideoCapture). Where it sits (forward, left, height in mm from the middle of the axle), where it looks (yaw to the left, tilt down, roll, in degrees), its resolution, horizontal field of view and frame rate. Frames are timed by the simulation\'s clock, so they keep their numbers and times at every Speed.'),
        );
        const list = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
        (hw.cameras || []).forEach((c, i) => list.append(camCard(c, i)));
        f.append(list);
        const add = el('button', { class: 'btn', type: 'button', onclick: () => {
            readForm();
            const used = new Set((hw.cameras || []).map((c) => c.id));
            hw.cameras = [...(hw.cameras || []), { ...cfg.camDefault, id: used.has(1) ? 2 : 1 }];
            buildConfig();
        } }, '+ Add a camera');
        add.disabled = (hw.cameras || []).length >= max;
        const why = camRefusal({ cameras: [{}] });
        const copy = el('button', { class: 'btn', type: 'button', title: 'Copy Python lines that show the first camera\'s stream with OpenCV', onclick: () => vscode.postMessage({ type: 'copy', text: camCode(((hw.cameras || [])[0] || { id: 1 }).id), what: 'the OpenCV code for the camera stream' }) }, 'Copy OpenCV code');
        copy.disabled = !(hw.cameras || []).length;
        f.append(el('div', { class: 'actions' }, add, copy), el('p', { class: 'sub', id: 'camAddr' }, why || camAddrText()));
    }

    function camCard(c, i) {
        const P = cfg.camPresets || {};
        const sel = el('select', { class: 'cPreset' }, ...Object.entries(P).map(([id, p]) => el('option', { value: id }, p.label)), el('option', { value: 'custom' }, 'Custom'));
        sel.value = c.preset in P ? c.preset : 'custom';
        const res = el('select', { class: 'cRes' }, ...CAM_RES.map(([w, h]) => el('option', { value: `${w}x${h}` }, `${w} x ${h}`)));
        if (!CAM_RES.some(([w, h]) => w === c.width && h === c.height_px)) { res.append(el('option', { value: `${c.width}x${c.height_px}` }, `${c.width} x ${c.height_px}`)); }
        res.value = `${c.width}x${c.height_px}`;
        const fmt = el('select', { class: 'cFmt' }, el('option', { value: 'jpeg' }, 'JPEG'), el('option', { value: 'png' }, 'PNG'));
        fmt.value = c.format || 'jpeg';
        const card = el('div', { class: 'sensor cam', 'data-i': String(i), 'data-id': String(c.id), 'data-shutter': c.shutter || 'rolling' },
            el('div', { class: 't' }, `Camera ${c.id}`, el('button', { class: 'x', type: 'button', title: 'Remove this camera', onclick: () => { readForm(); hw.cameras.splice(i, 1); buildConfig(); } }, '×')),
            el('label', {}, 'model', sel),
            el('label', {}, 'forward', numIn(c.forward, { class: 'cFwd', min: -300, max: 300 })),
            el('label', {}, 'left', numIn(c.left, { class: 'cLeft', min: -300, max: 300 })),
            el('label', {}, 'height', numIn(c.height, { class: 'cH', min: 5, max: 400 })),
            el('label', {}, 'yaw', numIn(c.yaw, { class: 'cYaw', min: -180, max: 180 })),
            el('label', {}, 'tilt down', numIn(c.tilt, { class: 'cTilt', min: -90, max: 90 })),
            el('label', {}, 'roll', numIn(c.roll, { class: 'cRoll', min: -180, max: 180 })),
            el('label', {}, 'resolution', res),
            el('label', {}, 'field of view', numIn(c.hfov, { class: 'cFov', min: 10, max: 170 })),
            el('label', {}, 'fps', numIn(c.fps, { class: 'cFps', min: 1, max: 60 })),
            el('label', {}, 'latency ms', numIn(c.latencyMs, { class: 'cLat', min: 0, max: 1000 })),
            el('label', {}, 'format', fmt),
            el('label', {}, 'JPEG quality', numIn(c.quality, { class: 'cQ', min: 1, max: 100 })),
        );
        // a model fills its resolution, field of view, frame rate and shutter (editing one of them makes it Custom)
        sel.addEventListener('change', () => {
            const p = P[sel.value];
            if (!p) { return; }
            const v = `${p.width}x${p.height_px}`;
            if (![...res.options].some((o) => o.value === v)) { res.append(el('option', { value: v }, `${p.width} x ${p.height_px}`)); }
            res.value = v;
            $('.cFov', card).value = String(p.hfov); $('.cFps', card).value = String(p.fps); card.dataset.shutter = p.shutter;
        });
        return card;
    }

    function readCams() {
        return [...document.querySelectorAll('.sensor.cam')].map((c) => {
            const n = (s) => Number($(s, c).value);
            const [w, h] = $('.cRes', c).value.split('x').map(Number);
            return { id: Number(c.dataset.id), preset: $('.cPreset', c).value, forward: n('.cFwd'), left: n('.cLeft'), height: n('.cH'), yaw: n('.cYaw'), tilt: n('.cTilt'), roll: n('.cRoll'),
                width: w, height_px: h, hfov: n('.cFov'), fps: n('.cFps'), shutter: c.dataset.shutter, latencyMs: n('.cLat'), format: $('.cFmt', c).value, quality: n('.cQ') };
        });
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
            colorSensors: [...document.querySelectorAll('.sensor:not(.dist):not(.pdev):not(.cam)')].map((c) => ({ port: n('.sPort', c), forward: n('.sFwd', c), left: n('.sLeft', c), height: n('.sH', c),
                // a downward sensor carries no facing / cal keys (today's robots stay as they were)
                ...(c.querySelector('.sFace')?.value === 'forward' ? { facing: 'forward' } : {}),
                ...($('.sCal', c).value.trim() !== '' ? { cal: n('.sCal', c) } : {}) })),
            distanceSensors: [...document.querySelectorAll('.sensor.dist')].map((c) => ({ port: n('.dPort', c), forward: n('.dFwd', c), left: n('.dLeft', c), height: n('.dH', c), angle: n('.dA', c) })),
            imu: $('#fImu').checked ? { port: n('#fImuPort') } : null,
            ...readPeriph(),
            mechanisms: readMech(),
            cameras: readCams(),
        };
        hw = next;
        plotHw();
        return next;
    }

    function clearErr() { $('#cfgErr').textContent = ''; }
    /** a downward colour sensor's cal over its height (hardware.ts refuses it too: review W2c r2 N-3) */
    function calRefusal(h) {
        const i = h.colorSensors.findIndex((s) => s.facing !== 'forward' && s.cal !== undefined && s.cal > s.height);
        return i < 0 ? '' : `Colour sensor ${i + 1}: its cal (${h.colorSensors[i].cal} mm) must be at most its height (${h.colorSensors[i].height} mm) when it looks down.`;
    }

    /** the program lines this robot needs (hardware.ts setupCode, without its comments) */
    function setupCode(h) {
        const db = h.driveBase;
        const dir = (m) => (m ? ', Direction.COUNTERCLOCKWISE' : '');
        const ds = h.distanceSensors || [];
        const sv = h.servos || [], ta = h.touchArrays || [], ad = h.adcs || [];
        const names = ['Motor', 'Direction', 'DriveBase', 'ColorSensor', ...(ds.length ? ['DistanceSensor'] : []), ...(h.imu ? ['IMU'] : []),
            ...(sv.length ? ['Servo'] : []), ...(ta.length ? ['TouchArray'] : []), ...(ad.length ? ['ADC'] : []), 'wait'];
        const lines = [`from evn import ${names.join(', ')}`, '',
            `left = Motor(${db.leftPort}${dir(db.leftMirrored)})`,
            `right = Motor(${db.rightPort}${dir(db.rightMirrored)})`,
            `robot = DriveBase(left, right, wheel_diameter=${db.wheelDiameter}, axle_track=${db.axleTrack})`];
        for (const s of h.colorSensors) { lines.push(`sensor${s.port} = ColorSensor(${s.port})`); }
        for (const s of ds) { lines.push(`distance${s.port} = DistanceSensor(${s.port})`); }
        if (h.imu) { lines.push(`imu = IMU(${h.imu.port})`); }
        for (const s of sv) { lines.push(`servo${s.port} = Servo(${s.port}, "${s.type}")`); }
        for (const t of ta) { lines.push(`touch${t.port} = TouchArray(${t.port})`); }
        for (const a of ad) {
            lines.push(`adc${a.port} = ADC(${a.port})`);
            if (a.inputs.length > 1 || (a.inputs.length && a.inputs[0].input !== 0)) { lines.push(`adc${a.port}.inputs([${a.inputs.map((i) => i.input).join(', ')}])`); }
        }
        for (const m of h.mechanisms || []) { if (m.motor) { lines.push(`${m.type}${m.motor} = Motor(${m.motor})`); } }
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

    function rectOf(t) { const [c, r] = cellsOf(defOf(t), t.rot); return [t.col, t.row, t.col + c, t.row + r]; }

    /* heights (tiles.ts: rampRise, rampDeg, seesawDeg, tileSpan; a bridge is a flat tile at least cfg.bridgeMin (225) mm
       clear under its cfg.slab mm slab over the top of the one under it - rules 3.2.3's 250 less 3.11.5's -10 %, 225 to
       250 warned; validateMap refuses less, so a tile put on a cell at any other height replaces what is there) */
    const S3 = cfg.seesaw || { deg: 15, t: 3 };
    const INC = cfg.incline || { ramp: 25, rampTol: 27.5, seesaw: 20, seesawTol: 22, maxDeg: 45 };
    /** a ramp's rise: its plan along the slope x tan(t.incline), else (no incline) its slope over its plan (tiles.ts rampRise) */
    function riseOf(def, t) {
        const k = (def.uphill || 0) % 2 ? 0 : 1;
        if (!isRamp(def)) { return 0; }
        if (t && t.incline !== undefined) { return def.plan[k] * Math.tan(t.incline * Math.PI / 180); }
        return Math.sqrt(Math.max(0, def.size[k] ** 2 - def.plan[k] ** 2));
    }
    /** a ramp's incline (degrees, tiles.ts rampDeg) */
    function degOf(def, t) { const k = (def.uphill || 0) % 2 ? 0 : 1; return t && t.incline !== undefined ? t.incline : Math.atan2(riseOf(def), def.plan[k]) * 180 / Math.PI; }
    function spanOf(t) {
        const def = defOf(t), z = t.z || 0;
        if (isRamp(def)) { return [z, z + riseOf(def, t)]; }
        if (t.seesaw) { return [z, z + S3.t + 300 * Math.tan((t.incline !== undefined ? t.incline : S3.deg) * Math.PI / 180)]; }
        return [z, z];
    }
    const flatOf = (t) => !isRamp(defOf(t)) && !t.seesaw;
    function stacked(a, b) {
        const sa = spanOf(a), sb = spanOf(b), slab = cfg.slab || 10, min = (cfg.bridgeMin || 225) - 1e-9;
        return (flatOf(a) && sa[0] - slab - sb[1] >= min) || (flatOf(b) && sb[0] - slab - sa[1] >= min);
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
        const def = defOf(t), z = t.z || 0;
        if (!isRamp(def)) { return z; }
        const a = ALONG[upOf(t)];
        const high = a[1] > 0 ? 'N' : a[1] < 0 ? 'S' : a[0] > 0 ? 'E' : 'W';
        const low = { N: 'S', S: 'N', E: 'W', W: 'E' }[high];
        return side === high ? z + riseOf(def, t) : side === low ? z : undefined;
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
            const def = defOf(t), z = t.z || 0;
            let h = z;
            if (isRamp(def)) {
                const a = ALONG[upOf(t)], len = a[0] ? (r[2] - r[0]) * 300 : (r[3] - r[1]) * 300;
                const from = a[0] > 0 ? x - r[0] * 300 : a[0] < 0 ? r[2] * 300 - x : a[1] > 0 ? y - r[1] * 300 : r[3] * 300 - y;
                h = z + riseOf(def, t) * from / len;
            }
            best = low ? Math.min(best, h) : Math.max(best, h);
        }
        const z = draft.zone;
        if (z && zoneHas(Math.floor(x / 300), Math.floor(y / 300))) { best = low ? Math.min(best, z.z || 0) : Math.max(best, z.z || 0); }
        return isFinite(best) ? Math.round(best * 10) / 10 : 0;
    }

    /** a tile's top at a point, the tile at another place (where it was before a drag) */
    function supportZAt(t, x, y, at) {
        const def = defOf(t), z = t.z || 0;
        if (!isRamp(def)) { return z; }
        const r = rectOf({ ...t, ...at });
        const a = ALONG[upOf(t)], len = a[0] ? (r[2] - r[0]) * 300 : (r[3] - r[1]) * 300;
        const from = a[0] > 0 ? x - r[0] * 300 : a[0] < 0 ? r[2] * 300 - x : a[1] > 0 ? y - r[1] * 300 : r[3] * 300 - y;
        return z + riseOf(def, t) * from / len;
    }

    /** lay a tile flat or as a ramp, or turn its slope (`change` edits t.ramp), its objects re-seated on its new top as
     *  placing them seats them (review rcjslope r1 S2: a bump placed before Ramp was ticked stayed at the flat height,
     *  buried in the slope): an object on it is one within its footprint lying on its old top (within 21 mm, as a drag) */
    function reslope(t, change) {
        const r = rectOf(t);
        const on = (draft.objects || []).filter((o) => o.x >= r[0] * 300 && o.x < r[2] * 300 && o.y >= r[1] * 300 && o.y < r[3] * 300 && Math.abs((o.z || 0) - supportZAt(t, o.x, o.y, {})) < 21);
        change();
        for (const o of on) { o.z = Math.round(supportZAt(t, o.x, o.y, {}) * 10) / 10; }
    }

    /* ---- the objects: obstacles, speed bumps, debris (tiles.ts MapObject) ---- */
    const snap5 = (v) => Math.round(v / 5) * 5;
    const OBJ_DEFAULTS = {
        obstacle: { shape: 'box', w: 100, d: 60, h: 150, mass: 2000, rot: 0 },
        bump: { length: 250, width: 30, height: 10, rot: 0 },
        debris: { length: 60, diameter: 3, rot: 30 },
        // victims (rules 3.10, victims.ts): the key is the button's, the type the map's
        live: { type: 'victim', kind: 'live', rot: 0 }, dead: { type: 'victim', kind: 'dead', rot: 0 },
        fake: { type: 'fakeVictim', form: 'ball', look: 'live', rot: 0 }, image: { type: 'fakeVictim', form: 'image', look: 'live', rot: 0 },
    };
    /** a victim's or a fake's radius (victims.ts victimRadius) and colour in the builder */
    const VIC = { r: (o) => o.radius || (o.type === 'victim' ? 22.5 : o.form === 'image' ? 22.5 : 15), css: (o) => (o.type === 'victim' ? (o.kind === 'live' ? '#c8ccd2' : '#141414') : o.form === 'image' ? (o.look === 'live' ? '#9a9fa5' : '#111') : (o.look === 'live' ? '#a3a7ab' : '#262626')) };
    const isVic = (o) => o.type === 'victim' || o.type === 'fakeVictim';

    function placeObject(type, x, y, low) {
        draft.objects = draft.objects || [];
        // seated where it is put (the snapped point: on a slope the click's own point is up to 1 mm off)
        const o = { type, x: snap5(x), y: snap5(y), ...OBJ_DEFAULTS[type] };
        o.z = supportZ(o.x, o.y, low);
        draft.objects.push(o);
        selObj = draft.objects.length - 1; sel = undefined; selZone = false;
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
        if ((o.type === 'obstacle' && o.shape === 'cylinder') || o.type === 'ball' || isVic(o)) { const r = o.type === 'ball' ? o.radius : isVic(o) ? VIC.r(o) : o.w / 2; local = Array.from({ length: 20 }, (_, k) => [r * Math.cos(k * Math.PI / 10), r * Math.sin(k * Math.PI / 10)]); }
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
            if (o.type === 'ball' || isVic(o)) {
                if (Math.hypot(u, v) <= (isVic(o) ? VIC.r(o) : o.radius)) { return i; }
            } else if (o.type === 'obstacle') {
                if (o.shape === 'cylinder' ? Math.hypot(u, v) <= o.w / 2 : Math.abs(u) <= o.w / 2 && Math.abs(v) <= o.d / 2) { return i; }
            } else {
                const hw = Math.max(8, (o.type === 'bump' ? o.width : o.diameter) / 2);
                if (Math.abs(u) <= o.length / 2 && Math.abs(v) <= hw) { return i; }
            }
        }
        return -1;
    }

    /* ---- the evacuation zone (tiles.ts EvacZone; zoneGeometry lays it out, drawn here the same way) ---- */
    // { col, row, cols, rows, z, entrance: { side, k }, exit: { side, k }, red, green, wallH, wall }: 4 x 3 cells (or
    // 3 x 4) of the grid, 1200 x 900 with its walls (inside them: nothing reaches the cells round it)
    const ZN = cfg.zone || { wallT: 20, wallH: 100, maxWallH: 300, point: 300, pointT: 10, stripL: 250, stripW: 25, colors: { white: '#f2f2ee' } };
    const SIDE_NAME = { S: 'bottom', E: 'right', N: 'top', W: 'left' };
    const CORNER_NAME = { SW: 'bottom left', SE: 'bottom right', NE: 'top right', NW: 'top left' };
    const ZONE_NEW = { cols: 4, rows: 3, entrance: { side: 'S', k: 1 }, exit: { side: 'N', k: 2 }, red: 'NW', green: 'SE' };

    function zoneRect(z) { return [z.col * 300, z.row * 300, (z.col + z.cols) * 300, (z.row + z.rows) * 300]; }
    function zoneHas(col, row) { const z = draft.zone; return !!z && col >= z.col && col < z.col + z.cols && row >= z.row && row < z.row + z.rows; }
    /** a tile on the zone's cells (nothing goes there) */
    function zoneOver(z, t) { const r = rectOf(t); return r[0] < z.col + z.cols && z.col < r[2] && r[1] < z.row + z.rows && z.row < r[3]; }
    function zoneBlocked(z) { return draft.tiles.some((t) => zoneOver(z, t)); }
    const ZONE_FULL = 'The evacuation zone goes on empty cells: move or remove the tiles there first.';

    /** put the zone down with its bottom-left cell here (the draft's moved, what lies in it with it) */
    function placeZone(col, row) {
        zoneMode = false;
        const z = draft.zone ? { ...draft.zone, col, row } : { col, row, ...JSON.parse(JSON.stringify(ZONE_NEW)) };
        if (zoneBlocked(z)) { $('#mapErr').textContent = ZONE_FULL; mapPane(); draw(); return; }
        if (draft.zone) {
            const r = zoneRect(draft.zone), dx = (col - draft.zone.col) * 300, dy = (row - draft.zone.row) * 300;
            for (const o of draft.objects || []) { if (o.x > r[0] && o.x < r[2] && o.y > r[1] && o.y < r[3]) { o.x += dx; o.y += dy; } }
        }
        draft.zone = z;
        selZone = true; sel = undefined; selObj = undefined;
        edited();
    }

    /** the zone turned a quarter turn counter-clockwise about its bottom-left cell: its doorways and evacuation points
     *  and what lies in it with it (a 4 x 3 zone becomes 3 x 4): a point (u, v) from its bottom-left corner goes to
     *  (300 rows - v, u) */
    function rotateZone() {
        const z = draft.zone, R = z.rows;
        const door = (d) => ({ S: { side: 'E', k: d.k }, E: { side: 'N', k: R - 1 - d.k }, N: { side: 'W', k: d.k }, W: { side: 'S', k: R - 1 - d.k } })[d.side];
        const corner = { SW: 'SE', SE: 'NE', NE: 'NW', NW: 'SW' };
        const t = { ...z, cols: z.rows, rows: z.cols, entrance: door(z.entrance), exit: door(z.exit), red: corner[z.red], green: corner[z.green] };
        if (zoneBlocked(t)) { $('#mapErr').textContent = ZONE_FULL; mapPane(); return; }
        const r = zoneRect(z);
        for (const o of draft.objects || []) {
            if (!(o.x > r[0] && o.x < r[2] && o.y > r[1] && o.y < r[3])) { continue; }
            const u = o.x - r[0], v = o.y - r[1];
            o.x = r[0] + R * 300 - v; o.y = r[1] + u;
            o.rot = ((((o.rot || 0) + 90) % 360) + 360) % 360;
            if (o.rot > 180) { o.rot -= 360; }
        }
        draft.zone = t;
        edited();
    }

    function removeZone() { delete draft.zone; selZone = false; edited(); }

    /** what the zone is made of seen from above (tiles.ts zoneGeometry): its walls inside its outline (polygons) and
     *  their colour, its strips, its evacuation points, its doorways */
    function zoneParts(z) {
        const [x0, y0, x1, y1] = zoneRect(z), T = ZN.wallT;
        const sides = {
            S: { from: [x0, y0], along: [1, 0], inward: [0, 1], n: z.cols }, N: { from: [x0, y1], along: [1, 0], inward: [0, -1], n: z.cols },
            W: { from: [x0, y0], along: [0, 1], inward: [1, 0], n: z.rows }, E: { from: [x1, y0], along: [0, 1], inward: [-1, 0], n: z.rows },
        };
        const at = (s, u, w) => [s.from[0] + s.along[0] * u + s.inward[0] * w, s.from[1] + s.along[1] * u + s.inward[1] * w];
        const walls = [];
        for (const side of ['S', 'E', 'N', 'W']) {
            const s = sides[side];
            const open = new Set([z.entrance, z.exit].filter((d) => d && d.side === side).map((d) => d.k));
            for (let k = 0; k < s.n; k++) {
                if (open.has(k)) { continue; }
                let e = k;
                while (e + 1 < s.n && !open.has(e + 1)) { e++; }
                const u0 = k * 300, u1 = (e + 1) * 300;
                walls.push([at(s, u0, 0), at(s, u1, 0), at(s, u1, T), at(s, u0, T)]);
                k = e;
            }
        }
        const door = (d, which) => { const s = sides[d.side], m = (d.k + 0.5) * 300, h = ZN.stripL / 2; return { which, mid: at(s, m, 0), inward: s.inward, strip: [at(s, m - h, 0), at(s, m + h, 0), at(s, m + h, ZN.stripW), at(s, m - h, ZN.stripW)] }; };
        const corner = { SW: [x0 + T, y0 + T], SE: [x1 - T, y0 + T], NE: [x1 - T, y1 - T], NW: [x0 + T, y1 - T] };
        const into = { SW: [[1, 0], [0, 1]], SE: [[-1, 0], [0, 1]], NE: [[-1, 0], [0, -1]], NW: [[1, 0], [0, -1]] };
        const points = [[z.red, '#e8231e'], [z.green, '#2e9e4a']].filter(([c]) => corner[c]).map(([c, css]) => {
            const p = corner[c], [u, v] = into[c];
            return { css, pts: [p, [p[0] + u[0] * ZN.point, p[1] + u[1] * ZN.point], [p[0] + v[0] * ZN.point, p[1] + v[1] * ZN.point]] };
        });
        return { rect: [x0, y0, x1, y1], walls, color: (ZN.colors || {})[z.wall || 'white'] || '#f2f2ee', doors: [door(z.entrance, 'entrance'), door(z.exit, 'exit')], points };
    }

    /** the zone as the builder shows it: its floor, its strips, its evacuation points, its walls, its doorways named */
    function drawZone(z, selected, ghost) {
        const q = zoneParts(z), [x0, y0, x1, y1] = q.rect, px = 1 / view.k / dpr;
        ctx.globalAlpha = ghost ? 0.55 : 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        for (const d of q.doors) { ctx.fillStyle = d.which === 'entrance' ? '#b9c0c8' : '#111'; poly(d.strip); ctx.fill(); }
        for (const p of q.points) {
            // its walls: a band inside its outline (each the evacuation point's colour, the floor inside them hollow)
            ctx.save(); poly(p.pts); ctx.clip();
            ctx.fillStyle = p.css; ctx.globalAlpha = (ghost ? 0.55 : 1) * 0.12; ctx.fill();
            ctx.globalAlpha = ghost ? 0.55 : 1; ctx.strokeStyle = p.css; ctx.lineWidth = 2 * ZN.pointT; poly(p.pts); ctx.stroke();
            ctx.restore();
        }
        ctx.fillStyle = q.color; ctx.strokeStyle = 'rgba(40,40,40,0.8)'; ctx.lineWidth = Math.max(1, 1.2 * px);
        for (const w of q.walls) { poly(w); ctx.fill(); ctx.stroke(); }
        for (const d of q.doors) { label(d.which, d.mid[0] + d.inward[0] * 60, d.mid[1] + d.inward[1] * 60, '#7f715c'); }
        label('Evacuation zone', (x0 + x1) / 2, (y0 + y1) / 2, '#7f715c', 13);
        if (z.z) { label(`${Math.round(z.z)} mm`, (x0 + x1) / 2, (y0 + y1) / 2 - 60, '#7f715c'); }
        if (selected) { ctx.strokeStyle = '#a8977b'; ctx.lineWidth = 6 * px; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); }
        ctx.globalAlpha = 1;
    }

    function draftBounds() {
        const rs = draft.tiles.map((t) => rectOf(t));
        if (draft.zone) { const z = draft.zone; rs.push([z.col, z.row, z.col + z.cols, z.row + z.rows]); }
        if (!rs.length) { return [-150, -150, 1650, 1650]; }
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const r of rs) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
        return [x0 * 300 - 450, y0 * 300 - 450, x1 * 300 + 450, y1 * 300 + 450];
    }

    function placeTile(id, col, row, rot) {
        const t = { id, col, row, rot };
        if (draft.zone && zoneOver(draft.zone, t)) { $('#mapErr').textContent = 'The evacuation zone is there: a tile goes beside it (its doorways are where the line comes in and goes out).'; mapPane(); return; }
        const z = autoZ(id, col, row, rot);
        if (z > 0) { t.z = z; }
        // what was on those cells goes
        draft.tiles = draft.tiles.filter((o) => !overlaps(o, t));
        draft.tiles.push(t);
        sel = draft.tiles.length - 1; selZone = false;
        edited();
    }

    function rotateTile(i, d) {
        const t = draft.tiles[i];
        t.rot = (t.rot + d) % 4;
        // not onto the evacuation zone (a long ramp turned beside it: review evaczone r1 S3)
        if (draft.zone && zoneOver(draft.zone, t)) { t.rot = (t.rot + 4 - d) % 4; $('#mapErr').textContent = 'The evacuation zone is there: turned, the tile would lie on it.'; mapPane(); return; }
        // review rcjnotes r1 N4: a turn that would lie on another tile is refused, never replacing it (no undo here)
        const hit = tileHit(i);
        if (hit) { t.rot = (t.rot + 4 - d) % 4; $('#mapErr').textContent = `Turned, #${defOf(t).id} would lie on #${defOf(hit).id}: a turn does not replace a tile. ${REPLACE_HOW}`; mapPane(); draw(); return; }
        sel = i;
        edited();
    }

    /** review rcjnotes r1 N4 (the class of rcjangle r2 S1): a move, turn or Height edit never deletes a tile (the map
     *  builder has no undo); only placement replaces (r1 B1). The tile tile i would lie on, or undefined */
    function tileHit(i) { const t = draft.tiles[i]; return draft.tiles.find((o, j) => j !== i && overlaps(o, t)); }
    const REPLACE_HOW = 'To replace that tile, pick this one in the list and put it on the cell.';

    function removeTile(i) {
        draft.tiles.splice(i, 1);
        sel = undefined;
        edited();
    }

    /** the selected tile's height, or a seesaw or not */
    function setTileZ(i, z) {
        const t = draft.tiles[i];
        if (!(z >= 0)) { return; }
        const z0 = t.z;
        if (z > 0) { t.z = Math.round(z * 100) / 100; } else { delete t.z; }
        // review rcjangle r2 S1: a Height edit never deletes the tile it would leave less than a bridge's clearance from
        // (the map builder has no undo); refused, the tile kept at its old height, why said. Placement replaces (r1 B1)
        const hit = draft.tiles.find((o, j) => j !== i && overlaps(o, t));
        if (hit) {
            if (z0 === undefined) { delete t.z; } else { t.z = z0; }
            const slab = cfg.slab || 10, min = cfg.bridgeMin || 225, so = spanOf(hit), st = spanOf(t);
            const mm = (v) => `${Math.round(v * 100) / 100} mm`;
            const need = so[0] >= st[0] ? `this tile's top at most ${mm(so[0] - slab - min)} up` : `this tile at least ${mm(so[1] + slab + min)} up`;
            $('#mapErr').textContent = `#${defOf(hit).id} is on that cell at ${mm(so[0])}: ${min} mm clear under a ${slab} mm slab is the least for a bridge (${need}). To replace that tile, put this one on the cell.`;
            mapPane(); draw();
            return;
        }
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
        const def = defOf(draft.tiles[i]);
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
        const t = draft.tiles[i], def = defOf(t);
        if (def.custom) { $('#mapErr').textContent = `${def.id}'s markers are printed on it: select it and Edit tile.`; return; }
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
        // one selection at a time (review evaczone r1 B1: a zone left selected took a Delete meant for this tile)
        sel = i; selObj = undefined; selZone = false;
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
        if (TE.on) { teClose(); }
        sel = undefined; pick = undefined; startMode = false; greenMode = false; mapInfo = undefined; pickObj = undefined; selObj = undefined; zoneMode = false; selZone = false;
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
        const d = m.corner || [(m.at[0] - m.j[0]) / l, (m.at[1] - m.j[1]) / l];   // a custom tile's: its corner (customTiles.ts)
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
            const on = def.custom || (green && green.includes(k));
            if (!on && !slots) { return; }
            c.beginPath();
            markerCorners(m).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
            c.closePath();
            if (on) { c.fillStyle = '#2e9e4a'; c.fill(); } else { c.setLineDash([5, 4]); c.strokeStyle = '#2e9e4a'; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
        });
        // a custom tile's markers in no junction's corner (customTiles.ts `prints`), axis-aligned as the layout paints them
        c.fillStyle = '#2e9e4a';
        for (const q of def.prints || []) { c.fillRect(q[0] - 12.5, q[1] - 12.5, 25, 25); }
        c.restore();
    }

    /** the transform from a placed tile's frame to the world (mm, y up): turned, a ramp's slope seen from above */
    function tileTransform(c, t) {
        const def = defOf(t);
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
            const t = draft.tiles[i], def = defOf(t);
            const r = rectOf(t);
            const view3 = { rect: [r[0] * 300, r[1] * 300, r[2] * 300, r[3] * 300], span: spanOf(t), rot: t.rot, ...(def.uphill ? { up: upOf(t) } : {}), ramp: isRamp(def), seesaw: !!t.seesaw, checkpoint: !!t.checkpoint };
            const bridge = draft.tiles.some((o) => o !== t && stacked(o, t) && spanOf(o)[1] < spanOf(t)[0] && overlapsCells(o, t));
            ctx.globalAlpha = bridge ? 0.8 : 1;
            tileBase(view3, -1);
            ctx.save(); tileTransform(ctx, t); tileInk(ctx, def, t.green, greenMode); ctx.restore();
            tileMarks(view3, t.seesaw && t.incline !== undefined ? t.incline : S3.deg);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = i === sel ? '#a8977b' : 'rgba(0,0,0,0.25)';
            ctx.lineWidth = i === sel ? 6 * px : px;
            if (bridge) { ctx.setLineDash([16 * px, 10 * px]); }
            ctx.strokeRect(r[0] * 300, r[1] * 300, (r[2] - r[0]) * 300, (r[3] - r[1]) * 300);
            ctx.setLineDash([]);
        }
        if (draft.zone) { drawZone(draft.zone, selZone, false); }
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
            ctx.save(); tileTransform(ctx, t); tileInk(ctx, tdef(pick)); ctx.restore();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#5f9e88';
            ctx.lineWidth = 4 * px;
            ctx.strokeRect(r[0] * 300, r[1] * 300, (r[2] - r[0]) * 300, (r[3] - r[1]) * 300);
        } else if (hover && zoneMode) {
            drawZone({ ...(draft.zone || ZONE_NEW), col: hover.col, row: hover.row }, false, true);
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
        } else if (o.type === 'ball') {
            ctx.fillStyle = o.color || '#d8d8d8';
            ctx.strokeStyle = '#202020';
        } else if (isVic(o)) {
            // a fake one outlined orange (dashed: an image)
            ctx.fillStyle = VIC.css(o);
            ctx.strokeStyle = o.type === 'victim' ? '#202020' : '#d07a00';
            if (o.form === 'image') { ctx.setLineDash([6 * px, 4 * px]); }
        } else if (o.type === 'bump') {
            ctx.fillStyle = 'rgba(160,160,160,0.35)';
            ctx.strokeStyle = 'rgba(90,90,90,0.9)';
        } else {
            ctx.fillStyle = '#b8935a';
            ctx.strokeStyle = '#7a5a2e';
        }
        ctx.lineWidth = Math.max(1, 1.2 * px);
        poly(pts); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
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
        for (const c of draft.customTiles || []) { box.append(teTileBtn(custFlat(c.id), used.get(c.id) || 0)); }
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
                title: `#${def.id} ${def.name}${def.elevated ? ' (on a raised platform)' : ''}${isRamp(def) ? ` (a ramp: ${def.size[1]} mm of slope, ${def.plan[1]} mm seen from above)` : ''}: one competition set has ${def.count} (an example: a map may use any number, rules 3.1.4). Click, then click the grid to place it; R or a right click turns it.`,
                onclick: () => { pick = pick === def.id ? undefined : def.id; pickObj = undefined; startMode = false; greenMode = false; zoneMode = false; sel = undefined; selObj = undefined; selZone = false; palette(); mapPane(); draw(); },
            }, cv, el('span', { class: 'id' }, '#' + def.id), el('span', { class: 'nm' }, def.name), el('span', { class: 'ct' }, `${n} / ${def.count}`));
            box.append(b);
        }
    }

    function mapList() {
        const s = $('#mapLoad');
        if (!s) { return; }
        s.textContent = '';
        s.append(el('option', { value: '' }, 'Open…'), el('option', { value: '#sample' }, 'Tile set sample (a copy)'), el('option', { value: '#hazards' }, 'Hazards sample (a copy)'), el('option', { value: '#game' }, 'RCJ game sample (a copy)'));
        for (const m of maps) { s.append(el('option', { value: 'map:' + m.name }, m.name)); }
        // the 2026 official fields (the RCJ Rescue Committee's), imported by the panel (rcjImport.ts)
        if ((cfg.rcjFields || []).length) {
            s.append(el('optgroup', { label: '2026 official fields' }, ...cfg.rcjFields.map((f) => el('option', { value: 'rcj:' + f.file, title: `The RCJ Rescue Line 2026 official field ${f.file} (a copy)` }, f.label))));
        }
        s.value = '';
    }

    /** the pane's state: the selected tile, the save button, the report of the line */
    function mapPane() {
        if (!$('#mapPane')) { return; }
        $('#mapSave').textContent = dirty ? 'Save *' : 'Save';
        $('#mapDelete').disabled = !maps.some((m) => m.name === $('#mapName').value.trim());
        $('#mapStart').classList.toggle('on', startMode);
        $('#mapGreen').classList.toggle('on', greenMode);
        for (const [id, type] of [['#mapObs', 'obstacle'], ['#mapBump', 'bump'], ['#mapDebris', 'debris'], ['#mapLive', 'live'], ['#mapDead', 'dead'], ['#mapFake', 'fake'], ['#mapImage', 'image']]) { $(id).classList.toggle('on', pickObj === type); }
        $('#mapZone').classList.toggle('on', zoneMode);
        if (selZone && !draft.zone) { selZone = false; }
        const t = sel !== undefined ? draft.tiles[sel] : undefined;
        const def = t && defOf(t);
        const ob = selObj !== undefined && draft.objects ? draft.objects[selObj] : undefined;
        const zn = selZone ? draft.zone : undefined;
        const OBJ_NAME = { obstacle: 'an obstacle', bump: 'a speed bump', debris: 'a piece of debris', live: 'a live victim', dead: 'a dead victim', fake: 'a fake victim', image: 'a fake victim\'s image', victim: 'a victim', fakeVictim: 'a fake victim' };
        $('#mapSel').textContent = pick ? `Placing #${pick} ${tdef(pick).name}, turned ${pickRot * 90}°: click the grid (R turns it, Esc stops). It takes the height of the tile it joins.`
            : pickObj ? `Placing ${OBJ_NAME[pickObj]}: click where it goes (Shift+click: on the tile under a bridge; Esc stops). Select it to set its size; R turns it 15°.`
                : zoneMode ? `Click the cell for the evacuation zone's bottom-left corner (${draft.zone ? 'it moves there' : '4 x 3 cells, 120 x 90 cm with its walls'}; Esc stops). The line ends at its entrance and begins again at its exit: put a tile's line up to each doorway.`
                : zn ? `The evacuation zone at (${zn.col}, ${zn.row}), ${zn.cols} x ${zn.rows} cells: drag it to move it, R turns it, Delete removes it. Set its doorways and evacuation points below.`
                : startMode ? 'Click a tile near the side the robot comes in by (a Start tile: near its middle).'
                    : greenMode ? 'Click a dashed square to put a green marker down, a marker to take it up. Before a junction, a marker on the robot\'s left turns it left, on its right turns it right, one on each side turns it round; none sends it straight on.'
                        : ob ? `${OBJ_NAME[ob.type][0].toUpperCase()}${OBJ_NAME[ob.type].slice(1)} at (${ob.x}, ${ob.y}) mm, turned ${ob.rot || 0}°: drag it to move it, R turns it, Delete removes it.`
                            : def ? `#${def.id} ${def.name} at (${t.col}, ${t.row}), turned ${t.rot * 90}°.` : 'Pick a tile below, then click the grid to place it.';
        $('#mapRot').disabled = !t && !pick && !ob && !zn;
        $('#mapDel').disabled = !t && !ob && !zn;
        mapProps(t, def, ob, zn);
        mapReport();
    }

    /** the selected tile's height and seesaw, or the selected object's sizes, or the evacuation zone's doorways,
     *  evacuation points, height and walls */
    function mapProps(t, def, ob, zn) {
        const box = $('#mapProps');
        box.textContent = '';
        const field = (label, value, attrs, set, unit) => {
            const inp = numIn(value, { ...attrs });
            inp.addEventListener('change', () => { const v = Number(inp.value); if (Number.isFinite(v)) { set(v); } });
            return [el('label', {}, label), el('div', {}, inp, unit ? ` ${unit}` : '')];
        };
        const choice = (label, value, options, set, title) => {
            const s = el('select', { title: title || '' }, ...options.map(([v, text]) => { const o = el('option', { value: v }, text); if (v === value) { o.selected = true; } return o; }));
            s.addEventListener('change', () => set(s.value));
            return [el('label', {}, label), s];
        };
        if (zn) {
            const doors = [];
            for (const side of ['S', 'E', 'N', 'W']) {
                const n = side === 'S' || side === 'N' ? zn.cols : zn.rows;
                for (let k = 0; k < n; k++) { doors.push([`${side}${k}`, `${SIDE_NAME[side]} side, cell ${k + 1} of ${n} (from the ${side === 'S' || side === 'N' ? 'left' : 'bottom'})`]); }
            }
            const setDoor = (which) => (v) => { zn[which] = { side: v[0], k: Number(v.slice(1)) }; edited(); };
            const corners = Object.entries(CORNER_NAME).map(([c, name]) => [c, name]);
            const items = [
                ...choice('Entrance', `${zn.entrance.side}${zn.entrance.k}`, doors, setDoor('entrance'), 'Where the line ends: a silver strip inside it (rules 3.9.4)'),
                ...choice('Exit', `${zn.exit.side}${zn.exit.k}`, doors, setDoor('exit'), 'Where the line begins again: a black strip inside it (rules 3.9.5)'),
                ...choice('Red point', zn.red, corners, (v) => { zn.red = v; edited(); }, 'The dead victim\'s evacuation point: a corner no doorway touches (rules 3.9.9)'),
                ...choice('Green point', zn.green, corners, (v) => { zn.green = v; edited(); }, 'The live victims\' evacuation point: a corner no doorway touches (rules 3.9.9)'),
                ...field('Height', zn.z || 0, { min: 0, max: 1000, step: 0.5 }, (v) => { if (v > 0) { zn.z = v; } else { delete zn.z; } edited(); }, 'mm (its floor)'),
                ...field('Walls', zn.wallH || ZN.wallH, { min: ZN.wallMin || 90, max: ZN.maxWallH, step: 1 }, (v) => { if (!(v >= (ZN.wallMin || 90))) { mapPane(); return; } if (v !== ZN.wallH) { zn.wallH = v; } else { delete zn.wallH; } edited(); }, `mm high, ${ZN.wallT} mm thick (rules 3.9.3: 100 or more; down to ${ZN.wallMin || 90} warned, 3.11.5's -10 %)`),
                ...choice('Wall colour', zn.wall || 'white', Object.keys(ZN.colors || { white: '' }).map((c) => [c, c]), (v) => { if (v !== 'white') { zn.wall = v; } else { delete zn.wall; } edited(); }, 'Any colour but red, green and black (rules 3.9.3)'),
            ];
            box.append(el('div', { class: 'grid' }, ...items));
            // victims at random from a seed (rules 3.10.4: two live, one dead; victims.ts placeVictims())
            const seed = numIn(vicSeed, { min: 0, max: 999999, step: 1, id: 'mapSeed' }), fakes = numIn(vicFakes, { min: 0, max: 6, step: 1, id: 'mapFakes' });
            box.append(el('div', { class: 'actions' }, 'Seed ', seed, ' fakes ', fakes,
                el('button', { class: 'btn', type: 'button', id: 'mapRandom', title: 'Put 2 live and 1 dead victim (and the fakes) at random on the zone\'s floor, the same for the same seed (rules 3.10.4); the victims there go',
                    onclick: () => { vicSeed = Number(seed.value) || 0; vicFakes = Number(fakes.value) || 0; vscode.postMessage({ type: 'map-victims', map: draft, seed: vicSeed, fakes: vicFakes }); vicSeed++; } }, 'Randomise victims')));
        } else if (t) {
            const items = [...field('Height', t.z || 0, { min: 0, max: 1000, step: 0.5 }, (v) => setTileZ(sel, v), isRamp(def) ? 'mm at its low end' : 'mm')];
            const SIDES = ['top', 'left', 'bottom', 'right'];
            if (isRamp(def)) { const k = (def.uphill || 0) % 2 ? 0 : 1; items.push(el('span', {}), el('span', { class: 'sub' }, `climbs ${riseOf(def, t).toFixed(1)} mm to its drawn ${SIDES[def.uphill || 0]} (${Math.hypot(riseOf(def, t), def.plan[k]).toFixed(1)} mm of slope)`)); }
            const ce = custEntry(t.id), s0 = custRaw(t.id) ? ce && ce.sloped && ce.sloped[0] : SLOPED.get(`${t.id}^0`);
            if (s0) {
                // any line tile may be laid as a ramp (rules 3.7.5), climbing from its height to the drawn side picked
                // (tiles.ts PlacedTile.ramp: true = its top, 1-3 = left, bottom, right), whatever way its line runs
                const c = el('input', { type: 'checkbox', id: 'mapRamp' });
                c.checked = turnOf(t) >= 0;
                c.addEventListener('change', () => { reslope(t, () => { if (c.checked) { t.ramp = true; delete t.seesaw; delete t.checkpoint; } else { delete t.ramp; } delete t.incline; }); edited(); });
                const way = el('select', { id: 'mapRampUp', title: 'The drawn side the ramp climbs to (its line may run along the slope or across it)' }, ...SIDES.map((n, k) => el('option', { value: String(k) }, `up to its ${n}`)));
                way.value = String(Math.max(0, turnOf(t)));
                way.disabled = !c.checked;
                way.addEventListener('change', () => { const k = Number(way.value); reslope(t, () => { t.ramp = k ? k : true; delete t.seesaw; delete t.checkpoint; }); edited(); });
                // its incline (tiles.ts PlacedTile.incline): any angle more than 0 up to cfg.incline.maxDeg; the set's
                // 24.6 when it is that (no incline written); past rules 3.7.2's 25 degrees the map warns
                const dflt = Math.round(degOf(s0) * 10) / 10;
                const ang = numIn(t.incline !== undefined ? t.incline : dflt, { id: 'mapRampDeg', min: 0.1, max: INC.maxDeg, step: 0.1, title: `The ramp's incline, degrees (rules 3.7.2: at most ${INC.ramp}; ${dflt} the set's ramps)` });
                ang.disabled = !c.checked;
                ang.addEventListener('change', () => {
                    const v = Number(ang.value);
                    if (!(v > 0 && v <= INC.maxDeg)) { ang.value = String(t.incline !== undefined ? t.incline : dflt); return; }
                    reslope(t, () => { if (v === dflt) { delete t.incline; } else { t.incline = v; } });
                    edited();
                });
                items.push(el('label', {}, 'Ramp'), el('label', { class: 'inline', title: '"The line along the ramps can contain gaps, speed bumps, intersections, obstacles, and debris." (rules 3.7.5)' }, c, ang, '° ', way));
            } else if (isRamp(def)) {
                // one of the set's ramps (#91-#94): its incline the same way (blank: its own, 330 mm over 300)
                const dflt = Math.round(degOf(def) * 10) / 10;
                const ang = numIn(t.incline !== undefined ? t.incline : dflt, { id: 'mapRampDeg', min: 0.1, max: INC.maxDeg, step: 0.1, title: `The ramp's incline, degrees (rules 3.7.2: at most ${INC.ramp})` });
                ang.addEventListener('change', () => {
                    const v = Number(ang.value);
                    if (!(v > 0 && v <= INC.maxDeg)) { ang.value = String(t.incline !== undefined ? t.incline : dflt); return; }
                    reslope(t, () => { if (v === dflt) { delete t.incline; } else { t.incline = v; } });
                    edited();
                });
                items.push(el('label', {}, 'Incline'), el('label', { class: 'inline' }, ang, '°'));
            }
            if ((def.id === '10' || def.id === '10E' || (custRaw(t.id) && (custEntry(t.id) || {}).seesaw)) && !t.ramp) {
                const c = el('input', { type: 'checkbox', id: 'mapSeesaw' });
                c.checked = !!t.seesaw;
                c.addEventListener('change', () => { if (c.checked) { t.seesaw = true; } else { delete t.seesaw; } delete t.incline; edited(); });
                // its tilt (tiles.ts PlacedTile.incline): 15 = SEESAW_DEG (no incline written); rules 3.8.2 "less than 20"
                const ang = numIn(t.incline !== undefined ? t.incline : S3.deg, { id: 'mapSeesawDeg', min: 0.1, max: INC.maxDeg, step: 0.5, title: `The seesaw's tilt either way, degrees (rules 3.8.2: less than ${INC.seesaw})` });
                ang.disabled = !c.checked;
                ang.addEventListener('change', () => {
                    const v = Number(ang.value);
                    if (!(v > 0 && v <= INC.maxDeg)) { ang.value = String(t.incline !== undefined ? t.incline : S3.deg); return; }
                    if (v === S3.deg) { delete t.incline; } else { t.incline = v; }
                    edited();
                });
                items.push(el('label', {}, 'Seesaw'), el('label', { class: 'inline' }, c, 'tilts ', ang, '° about its middle, its drawn bottom down'));
            }
            const cp = el('input', { type: 'checkbox' });
            cp.checked = !!t.checkpoint;
            cp.addEventListener('change', () => { if (cp.checked) { t.checkpoint = true; } else { delete t.checkpoint; } edited(); });
            items.push(el('label', {}, 'Checkpoint'), el('label', { class: 'inline', title: 'Never a tile with a gap, a junction, a ramp, a seesaw, a speed bump or an obstacle (rules 3.4.2)' }, cp, 'the robot is put back here after a lack of progress'));
            box.append(el('div', { class: 'grid' }, ...items));
            teButtons(box, t);
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
            } else if (isVic(ob)) {
                const opt = (k, def) => (v) => { if (v === def) { delete ob[k]; } else { ob[k] = v; } edited(); };
                if (ob.type === 'victim') {
                    items.push(...choice('Kind', ob.kind, [['live', 'live (silver, conductive)'], ['dead', 'dead (black)']], set('kind')));
                    items.push(...field('Radius', VIC.r(ob), { min: 18, max: 27.5, step: 0.5 }, opt('radius', 22.5), 'mm (rules: 40-50 mm across)'));
                    items.push(...field('Mass', ob.mass || 70, { min: 1, max: 88 }, opt('mass', 70), 'g (rules: at most 80)'));
                    items.push(...field('Off-centre', ob.com || 5, { min: 0.5, max: Math.floor(0.8 * VIC.r(ob) * 2) / 2, step: 0.5 }, opt('com', 5), 'mm (at most 0.8 x the radius), its centre of mass toward its turn'));
                } else {
                    items.push(...choice('Form', ob.form, [['ball', 'a ball'], ['image', 'a printed image']], (v) => { ob.form = v; delete ob.mass; edited(); }));
                    items.push(...choice('Looks', ob.look, [['live', 'live (grey)'], ['dead', 'dead (black)']], set('look')));
                    items.push(...field('Radius', VIC.r(ob), { min: 5, max: 60, step: 0.5 }, opt('radius', ob.form === 'image' ? 22.5 : 15), 'mm'));
                }
            } else if (ob.type === 'ball') {
                // a smaller ball keeps its centre of mass inside the 0.8 r the map allows (tiles.ts; review r1 N6)
                items.push(...field('Radius', ob.radius, { min: 5, max: 100 }, (v) => { ob.radius = v; if (ob.com !== undefined && ob.com > 0.8 * v) { ob.com = 0.8 * v; } edited(); }, 'mm'));
                items.push(...field('Mass', ob.mass, { min: 1, max: 2000 }, set('mass'), 'g'));
            } else if (ob.type === 'bump') {
                // tiles.ts RULE_SIZES: the rules' figure, accepted to its 3.11.5 +10 % with a warning (the length to 0.2.71's 900)
                items.push(...field('Length', ob.length, { min: 5, max: 900 }, set('length'), 'mm (at most 300)'));
                items.push(...field('Width', ob.width, { min: 5, max: 330 }, set('width'), 'mm (at most 300)'));
                items.push(...field('Height', ob.height, { min: 1, max: 11, step: 0.5 }, set('height'), 'mm (at most 10)'));
            } else {
                items.push(...field('Length', ob.length, { min: 5, max: 300 }, set('length'), 'mm'));
                items.push(...field('Diameter', ob.diameter, { min: 0.5, max: 3.3, step: 0.1 }, set('diameter'), 'mm (at most 3)'));
            }
            items.push(...field('Turned', ob.rot || 0, { min: -360, max: 360, step: 15 }, set('rot'), '°'));
            box.append(el('div', { class: 'grid' }, ...items));
        }
    }

    function mapReport() {
        const box = $('#mapReport');
        if (!box) { return; }
        box.textContent = '';
        if (!draft.tiles.length && !draft.zone) { box.append(el('p', { class: 'sub' }, 'An empty map: place a Start tile (#1), the tiles of the course and a Goal (#99).')); return; }
        if (!mapInfo) { return; }
        if (!mapInfo.ok) { box.append(el('p', { class: 'err' }, mapInfo.error)); return; }
        const r = mapInfo.report;
        box.append(el('p', {}, `${r.tiles} tile${r.tiles === 1 ? '' : 's'}${r.markers ? `, ${r.markers} green marker${r.markers === 1 ? '' : 's'}` : ''}; the line from the start crosses ${r.onRoute}: ${(r.length / 1000).toFixed(2)} m${r.loop ? ', a loop' : r.endsAtGoal ? ', to the Goal' : ''}.`));
        const hz = r.hazards || {};
        const parts = [['zones', 'evacuation zone'], ['ramps', 'ramp tile'], ['raised', 'raised tile'], ['bridges', 'bridge'], ['seesaws', 'seesaw'], ['bumps', 'speed bump'], ['debris', 'piece of debris'], ['obstacles', 'obstacle']]
            .filter(([k]) => hz[k]).map(([k, n]) => `${hz[k]} ${hz[k] === 1 ? n : n === 'piece of debris' ? 'pieces of debris' : n + 's'}`);
        if (parts.length) { box.append(el('p', { class: 'sub' }, `3D: ${parts.join(', ')}.`)); }
        if (r.warnings.length) { box.append(el('ul', { class: 'warn' }, ...r.warnings.map((w) => el('li', {}, w)))); }
    }

    function setPane(name) {
        document.body.classList.toggle('config', name === 'config');
        document.body.classList.toggle('builder', name === 'builder');
        document.body.classList.toggle('tools', name === 'tools');
        document.body.classList.toggle('plot', name === 'plot');
        $('#plotBtn').classList.toggle('on', name === 'plot');
        $('#plotBtn').setAttribute('aria-expanded', String(name === 'plot'));
        if (name === 'plot' && !plot.on) { plot.on = true; plotOpened(); } else if (name !== 'plot' && plot.on) { plot.on = false; plotBreak(); }
        $('#toolsBtn').classList.toggle('on', name === 'tools');
        $('#toolsBtn').setAttribute('aria-expanded', String(name === 'tools'));
        if (name === 'tools') { toolsShow(); } else { tools.pick = undefined; }
        $('#cfgBtn').classList.toggle('on', name === 'config');
        $('#mapBtn').classList.toggle('on', name === 'builder');
        if (name === 'builder') {
            // the builder opens on the map being driven, or on what it held
            const m = mapOf(courseId);
            if (m && !dirty && draft.name !== m.name) { loadDraft(m, false); } else { checkSoon(); palette(); mapPane(); }
        } else {
            pick = undefined; pickObj = undefined; startMode = false; greenMode = false; zoneMode = false; hover = undefined;
        }
        userView = false;
        if (name === 'builder' && mode3d) { canvas.hidden = false; canvas3d.hidden = true; } else if (mode3d) { canvas.hidden = true; canvas3d.hidden = false; }
        resize();
    }

    function mapPaneDom() {
        return el('div', { id: 'mapPane', class: 'pane' },
            el('h2', {}, 'Map builder'),
            el('p', { class: 'sub' }, 'Tiles of a RoboCup Junior Rescue Line set (300 mm). Place them on the grid, turn them (R, or a right click), drag them to move them, Delete to remove one; green markers tell the robot where to turn at a junction. Give a tile a height to raise it (250 mm clear under its 10 mm slab, 260 mm over the floor: a bridge, another tile may go under it; down to 225 mm clear warned, the -10 % of rules 3.11.5; Shift+click picks the lower one), make a straight a seesaw, lay a line tile as a ramp (select it, tick Ramp and pick the side it climbs to: a junction, a gap or a marker on a slope, rules 3.7.5), put obstacles, speed bumps and debris on the course, and an evacuation zone on it. The dashed line is the line the robot follows from the start, the arrow where it starts.'),
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
                    else if (v === '#game' && cfg.game) { loadDraft({ ...cfg.game, name: 'My RCJ game' }, true); }
                    else if (v.startsWith('rcj:')) { vscode.postMessage({ type: 'map-rcj-official', file: v.slice(4) }); }
                    else if (mapOf(v)) { loadDraft(mapOf(v), false); }
                    e.target.value = '';
                } }),
                el('button', { class: 'btn', type: 'button', title: 'Start again with an empty map', onclick: () => loadDraft({ version: 1, name: '', tiles: [] }, false) }, 'New'),
            ),
            el('div', { class: 'actions' },
                el('button', { class: 'btn', type: 'button', id: 'mapDelete', title: 'Delete the saved map of this name', onclick: () => vscode.postMessage({ type: 'map-delete', name: $('#mapName').value.trim() }) }, 'Delete'),
                el('button', { class: 'btn', type: 'button', title: 'Write the map to a file (to share it)', onclick: () => { draft.name = $('#mapName').value.trim() || 'untitled'; vscode.postMessage({ type: 'map-export', map: draft }); } }, 'Export…'),
                el('button', { class: 'btn', type: 'button', title: 'Open a map from a file', onclick: () => vscode.postMessage({ type: 'map-import' }) }, 'Import…'),
                el('button', { class: 'btn', type: 'button', title: 'Open a field saved by the RCJ Map Editor (its JSON, as the rescue CMS saves it)', onclick: () => vscode.postMessage({ type: 'map-import-rcj' }) }, 'Import RCJ field…'),
            ),
            el('div', { class: 'err', id: 'mapErr' }),
            el('div', { class: 'card selbox' },
                el('div', { id: 'mapSel' }),
                el('div', { class: 'actions' },
                    el('button', { class: 'btn', type: 'button', id: 'mapRot', title: 'Turn it a quarter turn, an object 15° (R)', onclick: () => { if (pick) { pickRot = (pickRot + 1) % 4; mapPane(); draw(); } else if (selObj !== undefined) { rotateObject(selObj, 1); } else if (selZone) { rotateZone(); } else if (sel !== undefined) { rotateTile(sel, 1); } } }, 'Turn'),
                    el('button', { class: 'btn', type: 'button', id: 'mapDel', title: 'Remove it (Delete)', onclick: () => { if (selObj !== undefined) { removeObject(selObj); } else if (selZone) { removeZone(); } else if (sel !== undefined) { removeTile(sel); } } }, 'Remove'),
                    el('button', { class: 'btn', type: 'button', id: 'mapStart', title: 'Set where the robot starts: click a tile near the side it comes in by', onclick: () => { startMode = !startMode; greenMode = false; zoneMode = false; pick = undefined; palette(); mapPane(); draw(); } }, 'Set start'),
                    el('button', { class: 'btn', type: 'button', id: 'mapGreen', title: 'Put green intersection markers down: click a dashed square at a junction (click again to take it up)', onclick: () => { greenMode = !greenMode; startMode = false; zoneMode = false; pick = undefined; pickObj = undefined; palette(); mapPane(); draw(); } }, 'Green markers'),
                ),
                el('div', { class: 'actions' },
                    ...[['mapObs', 'obstacle', 'Obstacle', 'A brick, a block or a weight on the course (rules 3.5: 150 mm or more high; heavy, fixed, or light enough to push)'],
                        ['mapBump', 'bump', 'Speed bump', 'A speed bump across the line (rules 3.5: at most 10 mm high, fixed to the floor)'],
                        ['mapDebris', 'debris', 'Debris', 'A toothpick or a dowel lying loose (rules 3.5: at most 3 mm thick)'],
                        ['mapLive', 'live', 'Live victim', 'A live victim in the evacuation zone (rules 3.10): a silver ball 45 mm across, 70 g, conductive'],
                        ['mapDead', 'dead', 'Dead victim', 'A dead victim in the evacuation zone (rules 3.10): a black ball 45 mm across, 70 g'],
                        ['mapFake', 'fake', 'Fake victim', 'A fake victim to ignore (rules 3.10.5): a grey or black ball, 30 mm across, not conductive'],
                        ['mapImage', 'image', 'Fake image', 'A fake victim to ignore (rules 3.10.5): a printed picture of one on the floor']].map(([id, type, text, title]) =>
                        el('button', { class: 'btn', type: 'button', id, title, onclick: () => { pickObj = pickObj === type ? undefined : type; pick = undefined; startMode = false; greenMode = false; zoneMode = false; sel = undefined; selObj = undefined; selZone = false; palette(); mapPane(); draw(); } }, text)),
                    el('button', { class: 'btn', type: 'button', id: 'mapZone', title: 'The evacuation zone (rules 3.9): 4 x 3 cells, 120 x 90 cm with its walls, a silver strip at its entrance and a black one at its exit, the red and green evacuation points in two corners. Click, then click the cell for its bottom-left corner',
                        onclick: () => { zoneMode = !zoneMode; pick = undefined; pickObj = undefined; startMode = false; greenMode = false; sel = undefined; selObj = undefined; palette(); mapPane(); draw(); } }, 'Evacuation zone'),
                ),
                el('div', { id: 'mapProps' }),
            ),
            el('div', { id: 'mapReport' }),
            el('h2', {}, 'Tiles'),
            el('p', { class: 'sub' }, 'Under each tile: how many this map uses, of how many one competition set has (the library is examples, rules 3.1.4: a map may use any number). A ramp climbs from the height it is given at its drawn bottom; a tile placed next to another takes its height there.'),
            el('div', { class: 'actions' }, el('button', { class: 'btn', type: 'button', id: 'tileNew', title: 'Draw a tile of your own: any design within the rules (3.1.4: the library is examples); a placed tile\'s Edit a copy starts from its print', onclick: () => teOpen({ name: '', elements: [] }) }, 'New tile…')),
            el('div', { id: 'tileEd', class: 'card', hidden: '' }),
            el('div', { id: 'palette' }),
        );
    }

    /* ---- the tile editor (rcjtiles-1027): the map's own tiles (draft.customTiles, src/sim/engine/customTiles.ts; rules
     * 3.1.4: the library is examples). A 300 mm tile at 1 mm a pixel, y up. The grid: every point on 5 mm (a marker's
     * centre on 2.5 mm, so its side can touch a 10-20 mm line), an arc's radius in 5 mm and its ends in 15-degree steps.
     * Each change is checked by the extension with the map's own compileCustom ('tile-check' -> 'tile-info', the same
     * function validateMap runs); Save keeps it in the draft, and the palette places it like a library tile. ---- */
    const TE = { on: false, id: '', tile: undefined, undo: [], tool: 'line', w: 20, sel: -1, pts: [], hover: undefined, info: undefined, seq: 0, cv: undefined };
    const tSnap = (v, g, lo = 0, hi = 300) => Math.max(lo, Math.min(hi, Math.round(v / g) * g));
    /** the editor canvas shows TE_M mm round the tile (review r2 S4: an arc's centre may lie off the tile - a gentle
     *  curve - as the engine allows, B2; every other click, and all ink, stays on the tile) */
    const TE_M = 100, TE_S = 300 + 2 * TE_M;
    const r15 = (a) => Math.round(a / 15) * 15;
    function custRaw(id) { return (draft.customTiles || []).find((c) => c.id === id); }
    function custEntry(id) { return mapInfo && mapInfo.custom ? mapInfo.custom.find((c) => c.def.id === id) : undefined; }
    /** a custom tile's definition: the extension's compiled one (map-info `custom`), else drawn from the draft (its
     *  markers as plain squares until the check comes back) */
    function custFlat(id) {
        const c = custRaw(id), e = custEntry(id);
        if (!c) { return undefined; }
        return e ? e.def : { id, name: c.name, count: 0, size: [300, 300], custom: true, elements: c.elements, routes: [], prints: (c.markers || []).map((m) => m.at) };
    }
    /** a placed custom tile's definition (defOf): flat, or laid as a ramp the way it climbs */
    function custOf(t) {
        if (!custRaw(t.id)) { return undefined; }
        const e = custEntry(t.id);
        return (e && e.sloped && turnOf(t) >= 0 && e.sloped[turnOf(t)]) || custFlat(t.id);
    }
    function tdef(id) { return custFlat(id) || LIB.get(id); }
    function teNewId() { for (let n = 1; ; n++) { if (!custRaw('c' + n) && !LIB.has('c' + n)) { return 'c' + n; } } }

    function teOpen(src, id) {
        TE.on = true; TE.id = id || teNewId(); TE.undo = []; TE.pts = []; TE.info = undefined; TE.tool = 'line'; TE.hover = undefined; TE.sel = -1;
        TE.tile = { elements: JSON.parse(JSON.stringify(src.elements || [])), markers: JSON.parse(JSON.stringify(src.markers || [])) };
        const ink = TE.tile.elements.find((e) => e.color === 'black');
        if (ink) { TE.w = ink.w; }
        const box = $('#tileEd');
        box.textContent = ''; box.hidden = false;
        const d = window.devicePixelRatio || 1;
        TE.cv = el('canvas', { id: 'teCv', width: String(TE_S * d), height: String(TE_S * d), style: `width:${TE_S}px;height:${TE_S}px;touch-action:none;cursor:crosshair` });
        TE.cv.addEventListener('pointerdown', teClick);
        TE.cv.addEventListener('pointermove', (e) => { TE.hover = tePt(e); teDraw(); });
        TE.cv.addEventListener('contextmenu', (e) => { e.preventDefault(); TE.pts = []; teHint(); teDraw(); });
        const tool = (k, text, title) => el('button', { class: 'btn', type: 'button', id: 'te-' + k, title, onclick: () => { TE.tool = k; TE.pts = []; if (k !== 'pick') { TE.sel = -1; } teHint(); teDraw(); } }, text);
        const btn = (id, text, title, onclick) => el('button', { class: 'btn', type: 'button', id, title, onclick }, text);
        box.append(
            el('h2', {}, custRaw(TE.id) ? `Tile ${TE.id}` : 'New tile'),
            el('div', { class: 'grid' },
                el('label', { for: 'teName' }, 'Name'), el('input', { type: 'text', id: 'teName', maxlength: '60', value: src.name || '', placeholder: 'My tile', oninput: teCheck }),
                el('label', { for: 'teW' }, 'Line width'), el('div', {}, numIn(TE.w, { id: 'teW', min: 10, max: 20, step: 1, onchange: (e) => teWidth(Number(e.target.value)) }), ' mm (rules 3.3.1: 10-20): the selected piece and the next ones ',
                    btn('teWAll', 'All pieces', 'Set every black piece of the tile to this width', teWidthAll))),
            el('div', { class: 'actions' },
                tool('pick', 'Select', 'Click a piece: the line width then sets it (and the pieces drawn next)'), tool('line', 'Straight', 'Two clicks: its ends'), tool('arc', 'Arc', 'Three clicks: its centre, its start (the radius), its end (Shift: the long way round)'),
                tool('gap', 'Gap', 'Two clicks on a straight: the ink between them is cut (rules 3.3.2)'), tool('mark', 'Marker', 'A 25 mm green marker printed in a junction\'s corner (rules 3.6.6); click one to take it off'),
                btn('teRed', 'Red strip', 'The Goal\'s 25 x 300 mm red strip across the middle (rules 3.3.5), on or off', teRed), btn('teUndo', 'Undo', 'Take back the last change', teUndo)),
            TE.cv,
            el('p', { class: 'sub', id: 'teHint' }),
            el('div', { class: 'err', id: 'teErr' }),
            el('div', { id: 'teMsg' }),
            el('div', { class: 'actions' },
                btn('teSave', 'Save tile', 'Keep it in this map: it is in the palette, to place and turn like a library tile', teSave),
                btn('teCancel', 'Close', 'Close the editor, keeping nothing of this edit', teClose),
                custRaw(TE.id) ? btn('teDel', 'Delete tile', 'Take it out of the map, with every placement of it', teDelete) : null));
        teHint(); teCheck(); teDraw();
    }
    function teClose() { TE.on = false; TE.pts = []; TE.cv = undefined; const b = $('#tileEd'); if (b) { b.hidden = true; b.textContent = ''; } }
    function tePt(e) {
        const k = TE_S / (TE.cv.clientWidth || TE_S), g = TE.tool === 'mark' ? 2.5 : 5, off = TE.tool === 'arc' && !TE.pts.length ? TE_M : 0;
        return [tSnap(e.offsetX * k - TE_M, g, -off, 300 + off), tSnap(TE_S - TE_M - e.offsetY * k, g, -off, 300 + off)];
    }
    function teChange(f) { TE.undo.push(JSON.stringify(TE.tile)); f(); $('#teErr').textContent = ''; teCheck(); teDraw(); }
    function teUndo() { if (TE.undo.length) { TE.tile = JSON.parse(TE.undo.pop()); TE.pts = []; TE.sel = -1; teHint(); teCheck(); teDraw(); } }
    /** the line width (rules 3.3.1 bound each part of the line to 1-2 cm, not one width: review r1 B5): the selected
     *  piece's, and the pieces drawn next; "All pieces" (teWidthAll) every black piece */
    function teWidth(v) {
        if (!Number.isFinite(v)) { return; }
        TE.w = Math.max(10, Math.min(20, v));
        const e = TE.tile.elements[TE.sel];
        if (e && e.color === 'black') { teChange(() => { e.w = TE.w; }); }
    }
    function teWidthAll() { teChange(() => { for (const e of TE.tile.elements) { if (e.color === 'black') { e.w = TE.w; } } }); }
    /** the black piece under a point (within its half width and 3 mm), or -1 */
    function tePick(p) {
        let best = -1, bd = Infinity;
        TE.tile.elements.forEach((e, i) => {
            if (e.color !== 'black') { return; }
            let d = Infinity;
            if (e.type === 'arc') {
                const lo = Math.min(e.from, e.to), hi = Math.max(e.from, e.to);
                let a = Math.atan2(p[1] - e.c[1], p[0] - e.c[0]) * 180 / Math.PI;
                while (a < lo) { a += 360; }
                if (a <= hi) { d = Math.abs(Math.hypot(p[0] - e.c[0], p[1] - e.c[1]) - e.r); }
            } else {
                for (let j = 0; j + 1 < e.pts.length; j++) {
                    const A = e.pts[j], B = e.pts[j + 1], dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy;
                    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / l2)) : 0;
                    d = Math.min(d, Math.hypot(p[0] - A[0] - t * dx, p[1] - A[1] - t * dy));
                }
            }
            if (d <= e.w / 2 + 3 && d < bd) { bd = d; best = i; }
        });
        return best;
    }
    function teRed() {
        const T = TE.tile, had = T.elements.some((e) => e.color === 'red');
        // review r2 S4: the filter shifts the indices after the red strip: the selection is reset (as teCut does)
        TE.sel = -1;
        teChange(() => { T.elements = had ? T.elements.filter((e) => e.color !== 'red') : [...T.elements, { type: 'line', pts: [[0, 150], [300, 150]], w: 25, color: 'red' }]; });
    }
    function teHint() {
        const n = TE.pts.length;
        const say = { line: ['Click where the straight starts.', 'Click where it ends.'],
            arc: ['Click the arc\'s centre (it may lie off the tile, in the grey: a gentle curve).','Click where it starts (the radius, in 5 mm steps).', 'Click where it ends (the shorter way round; Shift+click: the longer).'],
            gap: ['Click on a straight where the gap starts.', 'Click where it ends (rules 3.3.2: at most 200 mm long, 50 mm of straight before it).'],
            pick: ['Click a piece to select it: the line width then sets that piece.'],
            mark: ['Click to print a 25 mm green marker in a junction\'s corner, just before it (rules 3.6.6); click a marker to take it off.'] }[TE.tool];
        $('#teHint').textContent = `${say[Math.min(n, say.length - 1)]} Grid: 5 mm (markers 2.5 mm), arcs in 15° steps. A right click starts the piece again.`;
    }
    function teClick(e) {
        if (e.button === 2) { return; }
        const p = tePt(e), T = TE.tile;
        if (TE.tool === 'pick') {
            TE.sel = tePick(p);
            if (TE.sel >= 0) { TE.w = T.elements[TE.sel].w; const w = $('#teW'); if (w) { w.value = String(TE.w); } }
            teDraw();
            return;
        }
        if (TE.tool === 'mark') {
            const k = T.markers.findIndex((m) => Math.abs(m.at[0] - p[0]) < 12.5 && Math.abs(m.at[1] - p[1]) < 12.5);
            teChange(() => { if (k >= 0) { T.markers.splice(k, 1); } else { T.markers.push({ at: p }); } });
            return;
        }
        TE.pts.push(p);
        const [a, b, c] = TE.pts;
        if (TE.tool === 'line' && b) {
            if (b[0] !== a[0] || b[1] !== a[1]) { teChange(() => T.elements.push({ type: 'line', pts: [a, b], w: TE.w, color: 'black' })); }
            TE.pts = [];
        } else if (TE.tool === 'arc' && c) {
            const r = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5) * 5, ang = (q) => r15(Math.atan2(q[1] - a[1], q[0] - a[0]) * 180 / Math.PI);
            const from = ang(b);
            let sw = -((((from - ang(c)) % 360) + 540) % 360 - 180);   // (-180, 180]: the shorter way, a half turn counter-clockwise
            if (e.shiftKey && sw) { sw -= 360 * Math.sign(sw); }
            if (r > TE.w / 2 && sw) { teChange(() => T.elements.push({ type: 'arc', c: a, r, from, to: from + sw, w: TE.w, color: 'black' })); }
            TE.pts = [];
        } else if (TE.tool === 'gap' && b) {
            teCut(a, b);
            TE.pts = [];
        }
        teHint(); teDraw();
    }
    /** a gap: the ink of one straight between the two points' feet on it cut out (the piece split in two) */
    function teCut(p, q) {
        const els = TE.tile.elements;
        for (let i = 0; i < els.length; i++) {
            const e = els[i];
            if (e.type !== 'line' || e.color !== 'black') { continue; }
            for (let j = 0; j + 1 < e.pts.length; j++) {
                const A = e.pts[j], B = e.pts[j + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
                if (!L) { continue; }
                const u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
                const s = (P) => (P[0] - A[0]) * u[0] + (P[1] - A[1]) * u[1], off = (P) => Math.abs((P[0] - A[0]) * u[1] - (P[1] - A[1]) * u[0]);
                if (off(p) > e.w / 2 || off(q) > e.w / 2) { continue; }
                const s0 = Math.max(0, Math.min(s(p), s(q))), s1 = Math.min(L, Math.max(s(p), s(q)));
                if (s1 - s0 < 1) { continue; }
                const at = (v) => [+(A[0] + u[0] * v).toFixed(3), +(A[1] + u[1] * v).toFixed(3)];
                const parts = [];
                if (j > 0 || s0 > 1e-3) { parts.push({ ...e, pts: [...e.pts.slice(0, j + 1), at(s0)] }); }
                if (j + 2 < e.pts.length || s1 < L - 1e-3) { parts.push({ ...e, pts: [at(s1), ...e.pts.slice(j + 1)] }); }
                TE.sel = -1;
                teChange(() => els.splice(i, 1, ...parts));
                return;
            }
        }
        $('#teErr').textContent = 'A gap is cut in a straight: click two points on one.';
    }
    function teTile() {
        const T = TE.tile, nm = $('#teName');
        return { id: TE.id, name: (nm && nm.value.trim()) || 'Untitled tile', elements: T.elements, ...(T.markers.length ? { markers: T.markers } : {}) };
    }
    function teCheck() {
        TE.seq++; TE.info = undefined;
        vscode.postMessage({ type: 'tile-check', seq: TE.seq, tile: teTile(), ids: (draft.customTiles || []).filter((c) => c.id !== TE.id).map((c) => c.id) });
        teMsg();
    }
    function teInfo(m) { if (TE.on && m.seq === TE.seq) { TE.info = m; teMsg(); teDraw(); } }
    /** what the check says: refused and why, or the routes it carries and each warning (customTiles.ts's own words) */
    function teMsg() {
        const box = $('#teMsg'), m = TE.info;
        if (!box) { return; }
        box.textContent = '';
        if (!m) { box.append(el('p', { class: 'sub' }, 'Checking…')); return; }
        if (!m.ok) { box.append(el('p', { class: 'err' }, `Refused: ${m.error}`)); return; }
        const d = m.def, pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
        box.append(el('p', {}, `${d.routes.length ? pl(d.routes.length, 'route') : 'No line'}${d.gaps ? `, ${pl(d.gaps.length, 'gap')}` : ''}${d.markers ? `, ${pl(d.markers.length, 'marker')} counted` : ''}${d.role === 'goal' ? ', a Goal' : ''}${m.warnings.length ? '' : ': within the rules'}.`));
        if (m.warnings.length) { box.append(el('ul', { class: 'warn' }, ...m.warnings.map((w) => el('li', {}, w)))); }
    }
    function teSave() {
        if (!$('#teName').value.trim()) { $('#teErr').textContent = 'Give the tile a name first.'; return; }
        if (!TE.info || !TE.info.ok) { $('#teErr').textContent = TE.info ? 'It is refused: change what the message names first.' : 'It is being checked: save again in a moment.'; return; }
        const t = teTile(), list = draft.customTiles || [], k = list.findIndex((c) => c.id === t.id);
        if (k >= 0) { list[k] = t; } else { list.push(t); }
        draft.customTiles = list;
        if (mapInfo) { mapInfo.custom = undefined; }
        teClose();
        pick = t.id; pickRot = 0; pickObj = undefined; startMode = false; greenMode = false; zoneMode = false; sel = undefined; selObj = undefined; selZone = false;
        edited();
    }
    function teDelete() {
        const id = TE.id;
        draft.customTiles = (draft.customTiles || []).filter((c) => c.id !== id);
        if (!draft.customTiles.length) { delete draft.customTiles; }
        draft.tiles = draft.tiles.filter((t) => t.id !== id);
        if (pick === id) { pick = undefined; }
        sel = undefined;
        teClose();
        edited();
    }
    /** "Edit a copy" (a new tile of the map from a placed one's print: a library tile's chosen markers printed on it),
     *  or "Edit tile" (a custom tile itself) */
    function teCopy(t, same) {
        const raw = custRaw(t.id);
        if (raw) { teOpen({ name: same ? raw.name : `${raw.name} (copy)`.slice(0, 60), elements: raw.elements, markers: raw.markers }, same ? raw.id : undefined); return; }
        const def = LIB.get(t.id);
        teOpen({ name: `#${def.id} ${def.name} (copy)`.slice(0, 60),
            elements: def.elements.map((e) => (e.type === 'arc' ? { type: 'arc', c: e.c, r: e.r, from: e.from, to: e.to, w: e.w, color: e.color } : { type: 'line', pts: e.pts, w: e.w, color: e.color })),
            markers: (t.green || []).map((k) => ({ at: def.markers[k].at })) });
    }
    function teButtons(box, t) {
        const lib = LIB.get(t.id);
        if (!custRaw(t.id) && !(lib && lib.size[0] === 300 && lib.size[1] === 300 && !lib.plan)) { return; }
        box.append(el('div', { class: 'actions' },
            custRaw(t.id) ? el('button', { class: 'btn', type: 'button', id: 'teEdit', title: 'Change this tile in the tile editor (every placement of it changes)', onclick: () => teCopy(t, true) }, 'Edit tile') : null,
            el('button', { class: 'btn', type: 'button', id: 'teCopy', title: 'Open a copy of this tile in the tile editor: a new tile of this map', onclick: () => teCopy(t, false) }, 'Edit a copy')));
    }
    /** a custom tile's palette button (as a library tile's: click, then click the grid; R turns it) */
    function teTileBtn(def, n) {
        const d = window.devicePixelRatio || 1;
        const cv = el('canvas', { width: String(Math.round(64 * d)), height: String(Math.round(64 * d)), 'aria-hidden': 'true' });
        const c = cv.getContext('2d'), k = 0.2;
        c.setTransform(k * d, 0, 0, -k * d, 2 * d, 62 * d);
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, 300, 300);
        c.strokeStyle = '#bbb'; c.lineWidth = 1 / k; c.strokeRect(0, 0, 300, 300);
        tileInk(c, def);
        return el('button', {
            type: 'button', class: 'tile' + (pick === def.id ? ' on' : ''),
            title: `${def.name} (this map's own tile ${def.id}): click, then click the grid to place it; R or a right click turns it. Select a placed one to edit it.`,
            onclick: () => { pick = pick === def.id ? undefined : def.id; pickObj = undefined; startMode = false; greenMode = false; zoneMode = false; sel = undefined; selObj = undefined; selZone = false; palette(); mapPane(); draw(); },
        }, cv, el('span', { class: 'id' }, def.id), el('span', { class: 'nm' }, def.name), el('span', { class: 'ct' }, `${n} placed`));
    }
    function teDraw() {
        const cv = TE.cv;
        if (!cv) { return; }
        const c = cv.getContext('2d'), d = cv.width / TE_S, m = TE.info && TE.info.ok ? TE.info.def : undefined, h = TE.hover;
        c.setTransform(d, 0, 0, -d, TE_M * d, (300 + TE_M) * d);
        c.fillStyle = '#d8d8d8'; c.fillRect(-TE_M, -TE_M, TE_S, TE_S);
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, 300, 300);
        for (const [step, css] of [[5, 'rgba(0,0,0,0.07)'], [50, 'rgba(0,0,0,0.22)']]) {
            c.strokeStyle = css; c.lineWidth = 0.5; c.beginPath();
            for (let v = step; v < 300; v += step) { c.moveTo(v, 0); c.lineTo(v, 300); c.moveTo(0, v); c.lineTo(300, v); }
            c.stroke();
        }
        tileInk(c, m || { size: [300, 300], custom: true, elements: TE.tile.elements, prints: TE.tile.markers.map((q) => q.at) });
        // the routes the check derived from the ink (dashed), the piece being drawn, the grid point under the mouse
        c.strokeStyle = 'rgba(42,120,214,0.9)'; c.lineWidth = 2; c.setLineDash([6, 5]);
        for (const r of m ? m.routes : []) {
            c.beginPath();
            r.forEach((it, i) => { if (!Array.isArray(it)) { const [x, y, rr, f, t] = it.arc; c.arc(x, y, rr, f * Math.PI / 180, t * Math.PI / 180, t < f); } else if (i) { c.lineTo(it[0], it[1]); } else { c.moveTo(it[0], it[1]); } });
            c.stroke();
        }
        c.setLineDash([]);
        // the selected piece: outlined
        const se = TE.tile.elements[TE.sel];
        if (se) {
            c.strokeStyle = 'rgba(230,140,20,0.9)'; c.lineWidth = 2; c.beginPath();
            if (se.type === 'arc') { c.arc(se.c[0], se.c[1], se.r, se.from * Math.PI / 180, se.to * Math.PI / 180, se.to < se.from); } else { se.pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); }
            c.stroke();
        }
        c.fillStyle = c.strokeStyle = '#5f9e88'; c.lineWidth = 1.5;
        for (const p of TE.pts) { c.beginPath(); c.arc(p[0], p[1], 3, 0, 2 * Math.PI); c.fill(); }
        if (h && TE.pts.length) { const q = TE.pts[TE.pts.length - 1]; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(h[0], h[1]); c.stroke(); }
        if (h) { c.strokeRect(h[0] - 2, h[1] - 2, 4, 4); }
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
                el('span', { class: 'inline', id: 'chBox', hidden: '' },
                    el('label', { class: 'inline', title: 'How many times the challenge runs your program, each from a slightly different start (1 to 20): the runs are part of a submission' },
                        'Runs', el('input', { type: 'number', id: 'chRuns', min: String(chCfg.min), max: String(chCfg.max), value: String(chCfg.runs), style: 'width:3.5em', onchange: chRunsChanged })),
                    el('button', { class: 'btn primary', id: 'chRun', title: 'Run the program in the editor on this challenge, every run from its own start, and score it', onclick: () => chStart() }, 'Run challenge')),
                el('button', { class: 'btn', id: 'wroLoad', hidden: '', title: 'Load WRO\'s printing file of the RoboMission Junior 2026 mat (the PDF you downloaded from wro-association.org): the sensors then read its print. It stays on this computer, kept for the next time.', onclick: () => wroPick() }, 'Load WRO mat…'),
                el('span', { class: 'chip', id: 'wroChip', hidden: '' }),
                el('button', { class: 'btn', id: 'wroForget', hidden: '', title: 'Forget the WRO mat: its file is deleted and the schematic is on the floor again', onclick: () => wroForget() }, 'Forget'),
                el('button', { class: 'btn', id: 'wroRand', hidden: '', title: 'Draw the next seed: the artefacts\' colours and the dirt are laid from it at the next Back to start (never under a run)', onclick: () => wroRandomise() }, 'Randomise'),
                el('span', { class: 'chip', id: 'wroSeed', hidden: '', title: 'The seed the field was laid from (and the next one, after Randomise)' }),
                el('button', { class: 'btn', id: 'wroEnd', hidden: '', disabled: '', title: 'End the run (the team\'s STOP, General Rules 10.7.5): it is scored once the robot stands still', onclick: () => wroEndRun() }, 'End run'),
                el('label', { class: 'inline' }, 'Speed', speedSel),
                el('button', { class: 'btn', id: 'resetBtn', title: 'Put the robot back at the start (when no program runs)', onclick: () => { place(undefined); } }, 'Back to start'),
                el('button', { class: 'btn', id: 'followBtn', title: 'Keep the robot in the middle of the view (in 3D: follow it from behind)', onclick: (e) => { follow = !follow; e.currentTarget.classList.toggle('on', follow); if (v3) { v3.follow = follow; } if (!follow) { userView = false; fit(); draw(); } } }, 'Follow'),
                el('button', { class: 'btn', id: 'camBtn', hidden: '', title: 'Show the first camera\'s picture (its newest frame at its release, as your program gets it)', onclick: () => camPreviewToggle() }, 'Camera'),
                el('button', { class: 'btn', id: 'view3dBtn', title: 'See the course and the robot in 3D (drag to turn the view, Shift+drag to move it, scroll to zoom)', onclick: () => set3d(!mode3d) }, '3D'),
                el('button', { class: 'btn', id: 'btnBtn', title: 'The board\'s user button (hold to press): evn.button.pressed()', onpointerdown: () => pressButton(true), onpointerup: () => pressButton(false), onpointerleave: () => pressButton(false) }, 'Button'),
                el('button', { class: 'btn', id: 'newBtn', title: 'A first line follower for this robot, in your projects folder: run it with Ctrl+F5', onclick: () => vscode.postMessage({ type: 'new-program' }) }, 'New program'),
                el('button', { class: 'btn stop', id: 'stopBtn', title: 'Stop the program (Ctrl-C): every motor coasts', disabled: '', onclick: () => vscode.postMessage({ type: 'stop' }) }, 'Stop'),
                el('button', { class: 'btn', id: 'toolsBtn', 'aria-expanded': 'false', 'aria-controls': 'toolsPane', title: 'Type the robot\'s start pose, nudge it, the pen and the errors, the grid, ruler, protractor and markers, by keyboard: the values as text', onclick: () => setPane(toolsOpen() ? '' : 'tools') }, 'Tools'),
                el('button', { class: 'btn', id: 'plotBtn', 'aria-expanded': 'false', 'aria-controls': 'plotPane', title: 'Plot any motor, sensor or printed name=value channel against time', onclick: () => setPane(plotOpen() ? '' : 'plot') }, 'Plot'),
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
                        el('div', { class: 'card ref', id: 'refCard', hidden: '' },
                            el('div', { class: 'row' },
                                el('span', { title: 'The field score: (line tracing + exit bonus) x the evacuation zone multiplier (rules 5.6.12)' }, el('span', { class: 'k' }, 'score '), el('span', { class: 'v', id: 'rScore' }, '-')),
                                el('span', { title: 'What is left of the game\'s 8 minutes, calibration included (rules 5.3.1)' }, el('span', { class: 'k' }, 'left '), el('span', { class: 'v', id: 'rClock' }, '-')),
                                el('span', { title: 'Lacks of progress (rules 5.5)' }, el('span', { class: 'k' }, 'LoP '), el('span', { class: 'v', id: 'rLop' }, '-')),
                                el('span', { title: 'Victims rescued: entirely in their evacuation point, the robot not touching them, at rest 0.2 s (rules 5.6.6); the referee takes each one out' }, el('span', { class: 'k' }, 'rescued '), el('span', { class: 'v', id: 'rVic' }, '-')),
                                el('span', { class: 'v', id: 'rPrac', hidden: '', title: 'Not a rules run (rules 5.3.7, 4.1.1): the score is kept, marked practice' })),
                            el('div', { class: 'row' },
                                el('label', { title: 'The referee judges the run (rules 5.3-5.7): off, nothing is scored and the robot is never put back' }, el('input', { type: 'checkbox', id: 'rOn', checked: '', onchange: refSettings }), ' referee'),
                                el('button', { class: 'btn', type: 'button', title: 'Call a lack of progress (rules 5.5.1a): the robot is put back on the last checkpoint', onclick: () => toWorker({ type: 'referee', op: 'lop' }) }, 'Lack of progress'),
                                el('button', { class: 'btn', type: 'button', title: 'End the game now (rules 5.7.1)', onclick: () => toWorker({ type: 'referee', op: 'end' }) }, 'End game'),
                                el('select', { id: 'rRamp', title: 'A ramp\'s 10 points: once each inclined tile (rules 3.7.4, the default) or once a ramp (the once-a-ramp sentence 2025\'s 5.6.1 kept, gone from the 2026 rules)', onchange: refSettings }, el('option', { value: 'tile' }, 'ramp: per tile'), el('option', { value: 'ramp' }, 'ramp: per ramp')),
                                el('select', { id: 'rSkip', title: 'After three failed attempts at a checkpoint (rules 5.5.5)', onchange: refSettings }, el('option', { value: 'skip' }, 'skip after 3'), el('option', { value: 'retry' }, 'retry after 3')),
                                el('label', { title: 'After a lack of progress the start button is pressed for the robot (rules 4.2.8)' }, el('input', { type: 'checkbox', id: 'rPress', checked: '', onchange: refSettings }), ' press'),
                                el('select', { id: 'rLopStart', title: 'At a lack of progress, the declared procedure (rules 4.2.8): the start button only (the program runs on), or the program restarted as at a power cycle (main.py from the start; press then holds the button as it starts)', onchange: refSettings }, el('option', { value: 'press' }, 'LoP: button'), el('option', { value: 'restart' }, 'LoP: restart')),
                                el('label', { title: 'Seconds of calibration counted before the run (rules 5.3.1)' }, 'calib ', el('input', { type: 'number', id: 'rCal', min: '0', max: '480', value: '0', style: 'width:4em', onchange: refSettings }), ' s')),
                            el('div', { class: 'log', id: 'rLog' })),
                        el('div', { class: 'card ref chal', id: 'chCard', hidden: '' },
                            el('div', { class: 'row' }, el('b', { id: 'chTitle' }), el('span', { class: 'v', id: 'chProg' })),
                            el('table', { class: 'chtab' }, el('thead', {}, el('tr', {}, ...['Run', 'Start', 'Result', 'Time', 'Touches', 'Points', ''].map((h) => el('th', {}, h)))), el('tbody', { id: 'chRows' })),
                            el('div', { class: 'row', id: 'chSum' }),
                            el('div', { class: 'row' },
                                el('button', { class: 'btn primary', id: 'chSave', type: 'button', disabled: '', title: 'Seal these runs, your program and your robot for your teacher (and EVN), as a .evnsub file to hand in', onclick: () => vscode.postMessage({ type: 'challenge-save' }) }, 'Save submission…'),
                                el('button', { class: 'btn', type: 'button', onclick: () => { $('#chCard').hidden = true; } }, 'Close'))),
                        el('div', { class: 'card ref wro', id: 'wroCard', hidden: '' },
                            el('div', { class: 'row' },
                                el('span', { title: 'The Junior 2026 score of the field (scoring sheet; max 230): live while the run is on, the result once it ended, kept until the next Run' }, el('span', { class: 'k' }, 'score '), el('span', { class: 'v', id: 'wScore' }, '-')),
                                el('span', { title: 'The run\'s 2 minutes from the program\'s Run (General Rules 10.1); a program that waits for its start button has that wait inside its time' }, el('span', { class: 'k' }, 'run '), el('span', { class: 'v', id: 'wClock' }, '-'))),
                            el('div', { class: 'row' }, el('span', { class: 'v', id: 'wLines', title: 'Points by mission: 3.1 visitors, 3.2 towers, 3.3 artefacts, 3.4 dirt, 3.5 bonus' })),
                            el('div', { class: 'row' }, el('span', { class: 'v', id: 'wMarks' })),
                            el('div', { class: 'row' },
                                el('label', { title: 'The WRO referee scores the run (General Rules 10; Junior rules 3): turned on, the field is laid from the seed and the robot put at the start' }, el('input', { type: 'checkbox', id: 'wOn', checked: '', onchange: wroRefToggle }), ' referee'),
                                el('span', { class: 'log', title: 'The game objects are bodies of the physics engine (Jolt Physics; docs/SIMULATOR.md "WRO RoboMission"): they are pushed, gripped, stacked and tipped over, and the sensors read them where they lie; a real table may differ' }, 'physics engine'))),
                    ),
                    el('div', { class: 'hint run-only only2d' }, 'Drag the robot to move it, its handle to turn it (Shift: 15° steps), or use Tools by keyboard. Drag the floor to pan, scroll to zoom.'),
                    el('div', { class: 'hint run-only only3d-view' }, 'Drag to turn the view, Shift+drag (or a right drag) to move it, scroll to zoom. Follow follows the robot. The robot is moved in the 2D view.'),
                    el('div', { class: 'hint build-only' }, 'Click to place the picked tile, drag a tile to move it, R or a right click turns it, Delete removes it. Drag the floor to pan, scroll to zoom.'),
                    el('div', { class: 'note card', id: 'note', hidden: '' }),
                    el('div', { class: 'cue card run-only', id: 'trCue', hidden: '' }, 'Robot selected: the arrow keys move it. Escape lets go', el('span', { class: 'only2d' }, ', or click the floor'), '.'),
                    el('div', { class: 'sr', id: 'trSay', role: 'status', 'aria-live': 'polite' }),
                    el('div', { class: 'campv card', id: 'camPv', hidden: '' }, el('canvas', { id: 'camPvC', width: '320', height: '240', 'aria-label': 'The first camera\'s newest frame' }), el('div', { class: 'camst', id: 'camSt' })),
                    el('div', { class: 'loading', id: 'loading' }, 'Starting the simulated board (Python)…'),
                ),
                el('aside', {},
                    el('div', { id: 'cfgPane', class: 'pane' },
                        el('div', { id: 'cfgForm', style: 'display:flex;flex-direction:column;gap:10px' }),
                        el('div', { class: 'err', id: 'cfgErr' }),
                        el('div', { class: 'actions' },
                            el('button', { class: 'btn primary', type: 'button', onclick: () => { clearErr(); const h = readForm(); const why = camRefusal(h) || calRefusal(h); if (why) { $('#cfgErr').textContent = why; return; } vscode.postMessage({ type: 'apply-hw', hw: h }); } }, 'Apply'),
                            el('button', { class: 'btn', type: 'button', onclick: () => { clearErr(); vscode.postMessage({ type: 'default-hw' }); } }, 'Defaults'),
                            el('button', { class: 'btn', type: 'button', title: 'Copy the program lines this robot needs', onclick: () => vscode.postMessage({ type: 'copy', text: setupCode(readForm()) }) }, 'Copy setup code'),
                        ),
                        el('h2', {}, 'This robot in a program'),
                        el('pre', { class: 'code', id: 'setup' }),
                        el('p', { class: 'sub' }, 'Applying a change restarts the simulated board: a running program stops and the robot goes back to where it is, with its motors coasting.'),
                    ),
                    mapPaneDom(),
                    toolsPaneDom(),
                    plotPaneDom(),
                ),
            ),
        );
        courseOptions();
        wroHeader();
        challengeHeader();
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
