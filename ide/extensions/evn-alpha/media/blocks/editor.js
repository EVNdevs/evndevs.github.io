/* Block editor webview: a Blockly workspace bound to one .evnblocks document.
 *
 * Messages from the extension:  {type:'load', text, junior?}    document text (JSON) to show; `junior`: for a Junior file
 *                                                              (or a word-blocks file made from one) the robot the
 *                                                              extension resolved, {robot, robotId, why, speed, toolbox}
 *                               {type:'getCode', id}           reply with the current Python
 *                               {type:'status', message, error, ok}
 *                               {type:'theme', value}          'auto' | 'light' | 'dark' (setting changed)
 *                               {type:'board', connected}      a board is on the port in use (the play icon's look)
 * Messages to the extension:    {type:'ready'}                 scripts loaded, send the document
 *                               {type:'edit', text, python}    the workspace changed (text = new document contents)
 *                               {type:'state', broken}         after each load: true = not the whole file (never run it)
 *                               {type:'code', id, python, broken}  reply to getCode
 *                               {type:'run'|'stop'|'upload'|'export'}   toolbar buttons
 *                               {type:'saveCopy', kind, text}  "Open in word blocks" ('words') / "in picture blocks"
 *                                                              ('junior'): the transformed file, for the extension to save
 *                               {type:'showCode', value}       Python pane shown or minimised
 *                               {type:'codeWidth', value}      Python pane resized (px, null = default)
 *                               {type:'theme', value}          theme button pressed
 */
(function () {
    'use strict';
    const vscode = acquireVsCodeApi();
    const cfg = window.evnBlocksConfig || {};

    const FILE_FORMAT = 'evn-blocks';
    const FILE_VERSION = 3;   // 2: the "set up" / "program" sections (a version-1 file is upgraded on load); 3: a program
                              // without "set up robot" drives the standard robot (an older one gets its old robot's block on load,
                              // evn_blocks.js keepSavedRobot); = evnBlocks.STANDARD_ROBOT_VERSION (test_blocks.js checks it)

    /* ---- colour schemes -------------------------------------------------------------------
     * The page colours live in editor.css (html[data-theme]); Blockly's own chrome takes the
     * same tokens through a theme per scheme. Block colours come from evnBlocks.PALETTE. Every value
     * is media/theme/evn-palette.json's (scripts/test_theme.js checks them). */

    const SCHEMES = {
        light: {
            workspaceBackgroundColour: '#ffffff',
            toolboxBackgroundColour: '#f4f4f5',
            toolboxForegroundColour: '#111518',
            flyoutBackgroundColour: '#ffffff',
            flyoutForegroundColour: '#3f4245',
            flyoutOpacity: 1,
            scrollbarColour: '#111518',
            scrollbarOpacity: 0.18,
            insertionMarkerColour: '#111518',
            insertionMarkerOpacity: 0.25,
            markerColour: '#a8977b',
            cursorColour: '#a8977b',
            selectedGlowColour: '#a8977b',
            selectedGlowOpacity: 0.6,
            replacementGlowColour: '#a8977b',
            replacementGlowOpacity: 0.6,
        },
        dark: {
            workspaceBackgroundColour: '#111518',
            toolboxBackgroundColour: '#1a1f24',
            toolboxForegroundColour: '#f4f5f6',
            flyoutBackgroundColour: '#1a1f24',
            flyoutForegroundColour: '#d7dade',
            flyoutOpacity: 1,
            scrollbarColour: '#f4f5f6',
            scrollbarOpacity: 0.2,
            insertionMarkerColour: '#f4f5f6',
            insertionMarkerOpacity: 0.3,
            markerColour: '#c9b99c',
            cursorColour: '#c9b99c',
            selectedGlowColour: '#c9b99c',
            selectedGlowOpacity: 0.6,
            replacementGlowColour: '#c9b99c',
            replacementGlowOpacity: 0.6,
        },
    };

    const themes = {};
    for (const scheme of Object.keys(SCHEMES)) {
        themes[scheme] = Blockly.Theme.defineTheme('evn_' + scheme, {
            name: 'evn_' + scheme,
            base: Blockly.Themes.Classic,
            blockStyles: evnBlocks.BLOCK_STYLES,
            categoryStyles: evnBlocks.CATEGORY_STYLES,
            componentStyles: SCHEMES[scheme],
            fontStyle: { family: "'Jost', 'Segoe UI', system-ui, sans-serif", weight: '500', size: 12 },
            startHats: false,
        });
    }

    /* mode: 'auto' follows VS Code's colour theme (body class, kept current by VS Code) */
    let mode = ['auto', 'light', 'dark'].indexOf(cfg.theme) >= 0 ? cfg.theme : 'auto';
    function vscodeScheme() {
        const c = document.body.classList;
        return c.contains('vscode-dark') || c.contains('vscode-high-contrast') && !c.contains('vscode-high-contrast-light') ? 'dark' : 'light';
    }
    function currentScheme() { return mode === 'auto' ? vscodeScheme() : mode; }

    let workspace = null;
    function applyScheme() {
        const scheme = currentScheme();
        document.documentElement.dataset.theme = scheme;
        if (workspace) { workspace.setTheme(themes[scheme]); }
        const btn = document.getElementById('btnTheme');
        btn.title = 'Colour scheme: ' + (mode === 'auto' ? 'follows VS Code (' + scheme + ')' : mode) + '. Click to change.';
        btn.setAttribute('aria-label', btn.title);
        btn.querySelector('.ico-auto').style.display = mode === 'auto' ? '' : 'none';
        btn.querySelector('.ico-light').style.display = mode === 'light' ? '' : 'none';
        btn.querySelector('.ico-dark').style.display = mode === 'dark' ? '' : 'none';
    }
    applyScheme();
    new MutationObserver(function () { if (mode === 'auto') { applyScheme(); } })
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });

    /* ---- workspace ----------------------------------------------------------------------- */

    let loading = false;          // true while applying a document sent by the extension
    let broken = false;           // the last load failed part-way (or the file is newer): the workspace is not the file, so it
                                  // is never saved, run, uploaded or exported
    let lastText = '';            // document text last received or sent (feedback filter)
    let python = '';
    let seq = 0;                  // the extension's number of the last load: every message with Python carries it
                                  // (src/blocksEditor.ts, "who holds the blocks text"), so it never runs an older program
    let pendingText = null;       // a document that arrived before the workspace existed
    let pendingJunior = null;

    /* ---- Junior mode (docs/design/JR_JUNIOR_MODE.md §4.2, J2) --------------------------------------------------------
     * A file whose `kind` is "junior" (src/junior/junior.js isJunior: the kind decides, never the version number, review
     * r2 S-b) opens in Junior mode: the Junior blocks (media/blocks/junior_blocks.js) with the toolbox of the lesson's list
     * (or its grade's blocks), greyed where they never run. Its Python pane is the transform's: junior.js toStandard with
     * the robot the extension resolved, then the one generator. A file of another kind, or of a later Junior version,
     * opens read-only and is never saved. The file is saved as the Junior document it is, with no speed in it (S-d: the
     * speed is the lesson manifest's, filled in at transform time). */
    const JR = window.evnJunior || null;
    const JRB = window.evnJuniorBlocks || null;
    if (JRB) { JRB.register(); }
    let junior = null;            // in Junior mode: the extension's context ({robot, why, speed, toolbox}); null otherwise
    let fromJunior = null;        // a word-blocks file made from a Junior one: the context for "Open in picture blocks"
    let why = '';                 // in Junior mode, why there is no program (no robot): Run / Upload / Export refuse
    function deps() { return { Blockly: Blockly, generator: window.python.pythonGenerator, evn: evnBlocks }; }   // window.: `python` here is the program text
    function juniorDoc() {
        const doc = Object.assign({}, lastDoc, { format: JR.FILE_FORMAT, version: JR.JUNIOR_VERSION, kind: JR.KIND,
            workspace: Blockly.serialization.workspaces.save(workspace) });
        delete doc.speed;
        return doc;
    }
    function juniorStandard() {
        return JR.toStandard(juniorDoc(), { robot: junior.robot, speed: junior.speed || undefined });
    }
    let toolboxKey = 'standard';   // the toolbox shown: changed only when the mode or the Junior toolbox changes (r1 N2)
    function setMode(isJunior, doc) {
        document.body.classList.toggle('junior', isJunior);
        document.getElementById('btnWords').hidden = !isJunior;
        document.getElementById('btnPictures').hidden = isJunior || !fromJunior;
        const tb = isJunior ? JRB.toolboxFor({ grade: JR.gradeOf(doc && doc.lesson), list: junior && junior.toolbox }) : evnBlocks.TOOLBOX;
        const key = isJunior ? JSON.stringify(tb) : 'standard';
        if (key !== toolboxKey) { workspace.updateToolbox(tb); toolboxKey = key; }
    }
    /** the numbers Blockly put right on load (a pad field's range: a hand-edited file's forward 150 is shown as 99), named
     * like the standard editor's "Opened with changes" (r1 S3) */
    function juniorChanges(doc) {
        const out = [];
        const visit = (b) => {
            if (!b || typeof b !== 'object') { return; }
            const live = b.id && workspace.getBlockById(b.id);
            if (live && b.fields) {
                for (const k of Object.keys(b.fields)) {
                    const f = live.getField(k);
                    if (f && typeof b.fields[k] !== 'object' && String(f.getValue()) !== String(b.fields[k])) { out.push(b.type + ' ' + k + ' ' + b.fields[k] + ' -> ' + f.getValue()); }
                }
            }
            for (const i of Object.values(b.inputs || {})) { visit(i.block); }
            if (b.next) { visit(b.next.block); }
        };
        for (const t of (doc.workspace && doc.workspace.blocks && doc.workspace.blocks.blocks) || []) { visit(t); }
        return out;
    }

    /* Blockly 13's keyboard route is on by default (its ShortcutRegistry; A11Y_DESIGN §4.7). One of its keys is VS Code's
     * too: "show tooltip" is Ctrl+J (Cmd+J on a Mac), the workbench's Toggle Panel, and the webview hands its key presses
     * to the workbench (VSC-32), so one press did both. It moves to Alt+J, which VS Code does not take
     * (test_blocks_a11y.js lists both sets and fails on a clash). */
    function keepVsCodeKeys() {
        const R = Blockly.ShortcutRegistry.registry;
        const name = Blockly.ShortcutItems.names.SHOW_TOOLTIP;
        const J = Blockly.utils.KeyCodes.J;
        for (const k of R.getKeyCodesByShortcutName(name)) {
            if (/(^|\+)(Control|Meta)\+/.test(k) && k.endsWith('+' + J)) { R.removeKeyMapping(k, name, true); }
        }
        const altJ = R.createSerializedKey(J, [Blockly.utils.KeyCodes.ALT]);
        if (R.getKeyCodesByShortcutName(name).indexOf(altJ) < 0) { R.addKeyMapping(altJ, name, true); }
    }

    function inject() {
        Blockly.Scrollbar.scrollbarThickness = 9;
        keepVsCodeKeys();
        workspace = Blockly.inject('blocklyDiv', {
            toolbox: evnBlocks.TOOLBOX,
            media: cfg.mediaUri,
            renderer: cfg.renderer || 'zelos',
            theme: themes[currentScheme()],
            grid: { spacing: 24, length: 3, colour: '#eaeaec', snap: true },     // colour is restyled in editor.css
            zoom: { controls: true, wheel: true, startScale: cfg.renderer === 'zelos' || !cfg.renderer ? 0.75 : 0.9, minScale: 0.3, maxScale: 2, pinch: true },
            move: { scrollbars: true, drag: true, wheel: false },
            trashcan: true,
            sounds: false,
            plugins: { connectionChecker: evnBlocks.CONNECTION_CHECKER },   // set-up blocks only under "set up", the rest never there
            maxInstances: Object.assign({ [evnBlocks.SETUP_HAT]: 1, [evnBlocks.PROGRAM_HAT]: 1 }, JRB ? { [JRB.JR_START]: 1 } : {}),
            oneBasedIndex: evnBlocks.ZERO_BASED.oneBasedIndex,   // lists count from 0, as Python (evn_blocks.js ZERO_BASED; the flyout copies it here)
        });
        evnBlocks.setBoardConnected(workspace, boardConnected);
        // a stack attached to neither hat is greyed out and not run (evn_blocks.js applySections), kept in
        // the event group of the move that caused it, so one undo puts both back
        workspace.addChangeListener(function (e) {
            // not while a block is still being dragged (it would show greyed until dropped); the drop's own move event follows
            if (loading || e.isUiEvent || workspace.isDragging()) { return; }
            const group = Blockly.Events.getGroup();
            Blockly.Events.setGroup(e.group);
            try { (junior ? JRB.applySections : evnBlocks.applySections)(workspace); } finally { Blockly.Events.setGroup(group); }
        });
        workspace.addChangeListener(function (e) {
            if (loading || broken || e.isUiEvent || e.type === Blockly.Events.FINISHED_LOADING) { return; }
            const text = serialize();
            const code = generate();
            if (text !== lastText) {
                lastText = text;
                vscode.postMessage({ type: 'edit', text: text, python: code, seq: seq, why: why || undefined });   // why: set by generate() (r1 S1)
            }
        });
        applyCodePane();
        if (pendingText !== null) { const t = pendingText; pendingText = null; load(t, pendingJunior); }
    }

    /* ---- generated code pane ------------------------------------------------------------- */

    const KEYWORDS = /\b(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/;
    function highlight(src) {
        const esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        const out = [];
        const re = /(#[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)(?=\()|(\b[A-Za-z_]\w*\b)/g;
        let last = 0, m;
        while ((m = re.exec(src)) !== null) {
            out.push(esc(src.slice(last, m.index)));
            last = re.lastIndex;
            if (m[1]) { out.push('<span class="cmt">' + esc(m[1]) + '</span>'); }
            else if (m[2]) { out.push('<span class="str">' + esc(m[2]) + '</span>'); }
            else if (m[3]) { out.push('<span class="num">' + esc(m[3]) + '</span>'); }
            else if (m[4]) { out.push(KEYWORDS.test(m[4]) ? '<span class="kw">' + esc(m[4]) + '</span>' : '<span class="fn">' + esc(m[4]) + '</span>'); }
            else { out.push(KEYWORDS.test(m[5]) ? '<span class="kw">' + esc(m[5]) + '</span>' : esc(m[5])); }
        }
        out.push(esc(src.slice(last)));
        return out.join('');
    }

    function generate() {
        if (!workspace) { return python; }
        let shown = null;
        if (junior) {
            // the Junior program's Python: the transform, then the one generator; with no robot, no program and the reason
            why = '';
            try {
                if (!junior.robot) { throw new Error(junior.why || 'no robot'); }
                python = JR.plainPython(deps(), juniorStandard());
            } catch (e) {
                why = e && e.message ? e.message : String(e);
                python = '';
                shown = '# This Junior program has no Python yet: ' + why;
            }
        } else {
            try {
                python = evnBlocks.workspaceToPython(workspace);
            } catch (e) {
                python = '# could not generate code: ' + (e && e.message ? e.message : e);
            }
        }
        const pre = document.getElementById('code');
        if (shown) {
            pre.classList.remove('empty');
            pre.textContent = shown;
        } else if (python) {
            pre.classList.remove('empty');
            pre.innerHTML = highlight(python);
        } else {
            pre.classList.add('empty');
            pre.textContent = 'Drag blocks from the toolbox on the left.\nThe MicroPython for them appears here as you build.';
        }
        return python;
    }

    /* Everything the file carried that is not the workspace - `needs`, which the Examples tree
     * shows (src/examples.ts), and anything a later format adds. serialize() used to build the
     * document from scratch, and applyEdit replaces the whole file, so one nudge of one block
     * deleted the example's "Needs:" line for good. */
    let lastDoc = {};

    function serialize() {
        if (junior) { return JSON.stringify(juniorDoc(), null, 2) + '\n'; }
        // the workspace's own standard robot is written beside the version (evn_blocks.js documentOf, ROBOT176 R1)
        const doc = evnBlocks.documentOf(workspace, lastDoc, FILE_FORMAT, FILE_VERSION);
        return JSON.stringify(doc, null, 2) + '\n';
    }

    /* line endings never count: VS Code keeps a CRLF document CRLF, and serialize() writes LF */
    function lf(t) { return String(t).replace(/\r\n/g, '\n'); }

    function load(text, ctx) {
        if (!workspace) { pendingText = text; pendingJunior = ctx || null; return; }
        loading = true;
        try {
            Blockly.Events.disable();
            workspace.clear();
            lastDoc = {};
            junior = null;
            fromJunior = null;
            why = '';
            let warning = '';
            const trimmed = (text || '').trim();
            const doc = trimmed ? JSON.parse(trimmed) : null;
            const kind = doc && doc.format === FILE_FORMAT ? doc.kind : undefined;
            if (kind === 'junior' && JR && JRB && JR.isJunior(doc) && Number(doc.version) === JR.JUNIOR_VERSION) {
                // the kind decides (S-b): a Junior file opens in Junior mode
                junior = Object.assign({ robot: null, why: 'the extension resolved no robot', speed: null, toolbox: null }, ctx || {});
                lastDoc = Object.assign({}, doc);
                delete lastDoc.workspace;
                delete lastDoc.speed;                      // S-d: never kept in the file
                setMode(true, doc);
                Blockly.serialization.workspaces.load(JRB.workspaceState(doc), workspace);
                JRB.applySections(workspace);
                const changed = juniorChanges(doc);
                if (changed.length) { warning = 'Opened with changes: ' + changed.join('; ') + '.'; }
                if (!junior.robot) { warning = 'Junior mode: ' + junior.why + '. The blocks can be edited; the program cannot run until the robot is found.' + (warning ? ' ' + warning : ''); }
            } else if (kind !== undefined) {
                // another kind, or a Junior file of a later version: read-only (see catch), never saved
                setMode(false, null);
                throw new Error(kind === 'junior'
                    ? 'it is a Junior program of a version this editor does not know (format ' + doc.version + '); it is shown read-only'
                    : 'its kind "' + kind + '" is not one this editor knows; it is shown read-only');
            } else {
                if (doc && doc.format === FILE_FORMAT && doc.fromJunior && ctx && ctx.robot) { fromJunior = ctx; }
                setMode(false, null);
                if (doc) {
                    const ours = doc && doc.format === FILE_FORMAT;
                    const newer = ours && Number(doc.version) > FILE_VERSION;
                    const state = ours ? doc.workspace : doc;   // tolerate a bare Blockly state
                    if (ours) {
                        lastDoc = Object.assign({}, doc);
                        delete lastDoc.workspace;              // the workspace is regenerated on save
                    }
                    // read as written and put right (evn_blocks.js loadWorkspace): a rule-breaking block comes loose instead
                    // of the load stopping there; a version-1 file is upgraded, a new one gets its two hats
                    // the file's own standard robot (ROBOT176 R1): a bare Blockly state has none
                    const notes = evnBlocks.loadWorkspace(state, workspace, ours ? doc.version : 1, ours ? doc.standardRobot : undefined);
                    if (notes.length && !warning) { warning = 'Opened with changes: ' + notes.join('; ') + '.'; }
                    if (newer) {
                        // a newer format: shown as far as this editor knows it, read-only (see catch), never saved
                        throw new Error('it was made by a newer version of the extension (format ' + doc.version + '; this one knows '
                            + FILE_VERSION + '); it is shown read-only');
                    }
                } else {
                    evnBlocks.loadWorkspace(null, workspace, FILE_VERSION);
                }
            }
            evnBlocks.setBoardConnected(workspace, boardConnected);
            broken = false;
            workspace.setIsReadOnly(false);
            lastText = lf(text || '');      // compared with serialize()'s LF: a CRLF file is not an edit by itself
            setStatus(warning, !!warning);
        } catch (e) {
            // what loaded is only part of the file: never save it over the file (broken stops the edit messages)
            broken = true;
            workspace.setIsReadOnly(true);
            setStatus('This file could not be opened (' + (e && e.message ? e.message : e) + '). Nothing will be saved from this editor; update the EVN ALPHA extension, or fix the file as text.', true);
        } finally {
            Blockly.Events.enable();
            loading = false;
        }
        report();
    }

    /* after every load: the program of what is shown now, so Run / Upload / Export from the title bar have it at once */
    function report() {
        vscode.postMessage({ type: 'state', broken: broken, seq: seq, python: generate(), why: why || undefined });   // why: set by generate()
    }

    /* ---- toolbar ------------------------------------------------------------------------- */

    function setStatus(msg, isError, isOk) {
        const el = document.getElementById('status');
        el.textContent = msg || '';
        el.className = isError ? 'error' : isOk ? 'ok' : '';
    }

    /* a broken file's workspace is only part of it: running that part could leave a motor running with the
     * block that stops it missing, so run, upload and export refuse (the extension refuses its own commands too) */
    function send(type) {
        if (broken && ['run', 'upload', 'export'].indexOf(type) >= 0) {
            setStatus('This file did not open completely, so it is not run, uploaded or exported. Update the EVN ALPHA extension, or fix the file as text.', true);
            return;
        }
        if (junior && ['run', 'upload', 'export'].indexOf(type) >= 0) {
            generate();
            if (why) { setStatus('This Junior program cannot be run, uploaded or exported: ' + why + '.', true); return; }
        }
        vscode.postMessage({ type: type, python: generate(), seq: seq, why: why || undefined });
    }
    function button(id, type) {
        document.getElementById(id).addEventListener('click', function () { send(type); });
    }
    button('btnRun', 'run');

    /* the play button on the "program" block: runs the program, as Run on board does, when a board is connected */
    let boardConnected = false;
    /* the icon only shows the state: the run goes to the extension either way, as Run on board does, which picks or
     * asks for the port (a board plugged in within the last 4 s, or the browser IDE's port chooser) */
    evnBlocks.onRunClicked = function () { send('run'); };
    button('btnStop', 'stop');
    button('btnUpload', 'upload');
    button('btnExport', 'export');

    /* "Open in word blocks" (G2 -> G3, design D1): the transform, saved by the extension as a new version-3 file. "Open in
     * picture blocks": the reverse (junior.js fromStandard), for a word-blocks file made from a Junior one whose every
     * block has a picture block; it refuses, saying why, when a block or the set-up has none. */
    function saveCopy(kind) {
        if (broken) { setStatus('This file did not open completely, so no copy is made.', true); return; }
        let doc;
        try {
            if (kind === 'words') {
                if (!junior || !junior.robot) { throw new Error(junior ? junior.why : 'not a Junior program'); }
                doc = juniorStandard();
                // greyed blocks that have no word block on this robot (a sensor it lacks) would be lost: say which (r1 B2)
                if (doc.fromJunior && doc.fromJunior.notCarried) { throw new Error('these greyed blocks cannot be written as word blocks on this robot: ' + doc.fromJunior.notCarried.join('; ')); }
            } else {
                if (!fromJunior) { throw new Error('this file was not made from a Junior program'); }
                const std = evnBlocks.documentOf(workspace, lastDoc, FILE_FORMAT, FILE_VERSION);
                doc = JR.fromStandard(std, { robot: fromJunior.robot, robotId: fromJunior.robotId || undefined, speed: fromJunior.speed || undefined }, deps());
            }
        } catch (e) {
            setStatus('No copy made: ' + (e && e.message ? e.message : e) + '.', true);
            return;
        }
        vscode.postMessage({ type: 'saveCopy', kind: kind, text: JSON.stringify(doc), seq: seq });
    }
    document.getElementById('btnWords').addEventListener('click', function () { saveCopy('words'); });
    document.getElementById('btnPictures').addEventListener('click', function () { saveCopy('junior'); });

    /* The Python pane sits to the right of the canvas behind a draggable splitter, and minimises
     * to a pill in the top-right corner of the canvas. Shown/minimised is the evn.blocks.showCode
     * setting; the width is remembered by the extension (globalState) and per webview. */
    const main = document.getElementById('main');
    const codePane = document.getElementById('codePane');
    const splitter = document.getElementById('splitter');
    const codePill = document.getElementById('codePill');
    const CODE_MIN = 240, CODE_MAX_FRACTION = 0.7;
    let codeShown = cfg.showCode !== false;
    let codeWidth = typeof cfg.codeWidth === 'number' ? cfg.codeWidth : null;   // null = default (34%)
    const saved = vscode.getState && vscode.getState();
    if (saved && typeof saved.codeWidth === 'number') { codeWidth = saved.codeWidth; }

    function clampWidth(w) {
        return Math.round(Math.max(CODE_MIN, Math.min(w, main.clientWidth * CODE_MAX_FRACTION)));
    }
    function applyCodePane() {
        codePane.style.display = codeShown ? '' : 'none';
        splitter.style.display = codeShown ? '' : 'none';
        codePill.style.display = codeShown ? 'none' : '';
        codePane.style.width = codeWidth === null ? '' : clampWidth(codeWidth) + 'px';
        if (workspace) { Blockly.svgResize(workspace); }
        if (codeShown) {
            // the separator's value is the pane's width in px (A11Y_DESIGN §4.7), so a screen reader says what an arrow did
            const now = Math.round(codePane.getBoundingClientRect().width);
            splitter.setAttribute('aria-valuemin', String(CODE_MIN));
            splitter.setAttribute('aria-valuemax', String(Math.max(CODE_MIN, Math.round(main.clientWidth * CODE_MAX_FRACTION))));
            splitter.setAttribute('aria-valuenow', String(now));
            splitter.setAttribute('aria-valuetext', 'Python pane ' + now + ' pixels wide');
        }
    }
    function rememberWidth() {
        if (vscode.setState) { vscode.setState(Object.assign({}, vscode.getState() || {}, { codeWidth: codeWidth })); }
        vscode.postMessage({ type: 'codeWidth', value: codeWidth });
    }
    function showCode(shown) {
        codeShown = shown;
        applyCodePane();
        vscode.postMessage({ type: 'showCode', value: codeShown });
    }
    document.getElementById('btnCollapse').addEventListener('click', function () { showCode(false); });
    codePill.addEventListener('click', function () { showCode(true); });

    /* drag the splitter: the pane width follows the pointer, the canvas takes the rest */
    let dragging = false, raf = 0;
    splitter.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0) { return; }
        dragging = true;
        splitter.setPointerCapture(ev.pointerId);
        splitter.classList.add('dragging');
        document.body.classList.add('resizing');
        ev.preventDefault();
    });
    splitter.addEventListener('pointermove', function (ev) {
        if (!dragging) { return; }
        codeWidth = clampWidth(main.getBoundingClientRect().right - ev.clientX);
        if (!raf) { raf = requestAnimationFrame(function () { raf = 0; applyCodePane(); }); }
    });
    function endDrag(ev) {
        if (!dragging) { return; }
        dragging = false;
        splitter.classList.remove('dragging');
        document.body.classList.remove('resizing');
        if (splitter.hasPointerCapture && splitter.hasPointerCapture(ev.pointerId)) { splitter.releasePointerCapture(ev.pointerId); }
        applyCodePane();
        rememberWidth();
    }
    splitter.addEventListener('pointerup', endDrag);
    splitter.addEventListener('pointercancel', endDrag);
    splitter.addEventListener('dblclick', function () { codeWidth = null; applyCodePane(); rememberWidth(); });
    /* the keyboard route (WCAG 2.5.7, A11Y_DESIGN §4.7): with focus on the separator, Left / Right move it 16 px (the pane
     * grows / shrinks), Home / End give the pane its narrowest / widest. Only these four keys, and only unmodified: every
     * other key - F5, Ctrl+F5 above all, VS Code's (VSC-32) - is left alone, so the workbench still gets it. This is the
     * page's only keydown listener (test_blocks_editor.js VSC-32, test_blocks_a11y.js). */
    const SPLIT_STEP = 16;
    splitter.addEventListener('keydown', function (ev) {
        if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) { return; }
        const now = codePane.getBoundingClientRect().width;
        const max = main.clientWidth * CODE_MAX_FRACTION;
        let w;
        switch (ev.key) {
            case 'ArrowLeft': w = now + SPLIT_STEP; break;
            case 'ArrowRight': w = now - SPLIT_STEP; break;
            case 'Home': w = CODE_MIN; break;
            case 'End': w = max; break;
            default: return;
        }
        ev.preventDefault();
        codeWidth = clampWidth(w);
        applyCodePane();
        rememberWidth();
    });
    applyCodePane();

    document.getElementById('btnTheme').addEventListener('click', function () {
        mode = mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';
        applyScheme();
        vscode.postMessage({ type: 'theme', value: mode });
    });

    document.getElementById('btnCopy').addEventListener('click', function () {
        navigator.clipboard.writeText(generate()).then(function () { setStatus('Python copied to the clipboard', false, true); },
            function () { setStatus('could not copy', true); });
    });

    window.addEventListener('resize', function () { applyCodePane(); });
    /* Ctrl+F5 / Ctrl+Shift+F5 (Cmd on a Mac) are VS Code's keybindings evn.runBlocks / evn.stopMotors (package.json): the
     * webview forwards its key presses to them, so a handler of the page's own ran the program a second time (VSC-32). */

    /* ---- extension messages -------------------------------------------------------------- */

    window.addEventListener('message', function (ev) {
        const msg = ev.data || {};
        switch (msg.type) {
            case 'load':
                seq = msg.seq;
                if (lf(msg.text || '') !== lastText) { load(msg.text, msg.junior); } else { report(); }
                break;
            case 'getCode':
                vscode.postMessage({ type: 'code', id: msg.id, python: generate(), broken: broken, seq: seq, why: why || undefined });
                break;
            case 'status':
                setStatus(msg.message || '', !!msg.error, !!msg.ok);
                break;
            case 'board':
                boardConnected = !!msg.connected;
                if (workspace) { evnBlocks.setBoardConnected(workspace, boardConnected); }
                break;
            case 'theme':
                if (['auto', 'light', 'dark'].indexOf(msg.value) >= 0 && msg.value !== mode) { mode = msg.value; applyScheme(); }
                break;
        }
    });

    /* Blockly measures block text once, so the font has to be in before the workspace exists. */
    const fontReady = document.fonts && document.fonts.load ? document.fonts.load("500 12px 'Jost'") : Promise.resolve();
    Promise.resolve(fontReady).catch(function () { }).then(function () {
        inject();
        vscode.postMessage({ type: 'ready' });
    });
}());
