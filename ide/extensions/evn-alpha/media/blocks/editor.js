/* Block editor webview: a Blockly workspace bound to one .evnblocks document.
 *
 * Messages from the extension:  {type:'load', text}            document text (JSON) to show
 *                               {type:'getCode', id}           reply with the current Python
 *                               {type:'status', message, error, ok}
 *                               {type:'theme', value}          'auto' | 'light' | 'dark' (setting changed)
 * Messages to the extension:    {type:'ready'}                 scripts loaded, send the document
 *                               {type:'edit', text, python}    the workspace changed (text = new document contents)
 *                               {type:'code', id, python}      reply to getCode
 *                               {type:'run'|'stop'|'upload'|'export'}   toolbar buttons
 *                               {type:'showCode', value}       Python pane shown or minimised
 *                               {type:'codeWidth', value}      Python pane resized (px, null = default)
 *                               {type:'theme', value}          theme button pressed
 */
(function () {
    'use strict';
    const vscode = acquireVsCodeApi();
    const cfg = window.evnBlocksConfig || {};

    const FILE_FORMAT = 'evn-blocks';
    const FILE_VERSION = 1;

    /* ---- colour schemes -------------------------------------------------------------------
     * The page colours live in editor.css (html[data-theme]); Blockly's own chrome takes the
     * same tokens through a theme per scheme. Block colours come from evnBlocks.PALETTE. */

    const SCHEMES = {
        light: {
            workspaceBackgroundColour: '#ffffff',
            toolboxBackgroundColour: '#f7f6f3',
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
            workspaceBackgroundColour: '#16181a',
            toolboxBackgroundColour: '#1d2023',
            toolboxForegroundColour: '#f2f0ec',
            flyoutBackgroundColour: '#1d2023',
            flyoutForegroundColour: '#cfd0cc',
            flyoutOpacity: 1,
            scrollbarColour: '#f2f0ec',
            scrollbarOpacity: 0.2,
            insertionMarkerColour: '#f2f0ec',
            insertionMarkerOpacity: 0.3,
            markerColour: '#c2b195',
            cursorColour: '#c2b195',
            selectedGlowColour: '#c2b195',
            selectedGlowOpacity: 0.6,
            replacementGlowColour: '#c2b195',
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
        btn.querySelector('.ico-auto').style.display = mode === 'auto' ? '' : 'none';
        btn.querySelector('.ico-light').style.display = mode === 'light' ? '' : 'none';
        btn.querySelector('.ico-dark').style.display = mode === 'dark' ? '' : 'none';
    }
    applyScheme();
    new MutationObserver(function () { if (mode === 'auto') { applyScheme(); } })
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });

    /* ---- workspace ----------------------------------------------------------------------- */

    let loading = false;          // true while applying a document sent by the extension
    let lastText = '';            // document text last received or sent (feedback filter)
    let python = '';
    let pendingText = null;       // a document that arrived before the workspace existed

    function inject() {
        Blockly.Scrollbar.scrollbarThickness = 9;
        workspace = Blockly.inject('blocklyDiv', {
            toolbox: evnBlocks.TOOLBOX,
            media: cfg.mediaUri,
            renderer: cfg.renderer || 'zelos',
            theme: themes[currentScheme()],
            grid: { spacing: 24, length: 3, colour: '#e8e6e1', snap: true },     // colour is restyled in editor.css
            zoom: { controls: true, wheel: true, startScale: cfg.renderer === 'zelos' || !cfg.renderer ? 0.75 : 0.9, minScale: 0.3, maxScale: 2, pinch: true },
            move: { scrollbars: true, drag: true, wheel: false },
            trashcan: true,
            sounds: false,
        });
        workspace.addChangeListener(function (e) {
            if (loading || e.isUiEvent || e.type === Blockly.Events.FINISHED_LOADING) { return; }
            const text = serialize();
            const code = generate();
            if (text !== lastText) {
                lastText = text;
                vscode.postMessage({ type: 'edit', text: text, python: code });
            }
        });
        applyCodePane();
        if (pendingText !== null) { const t = pendingText; pendingText = null; load(t); }
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
        try {
            python = evnBlocks.workspaceToPython(workspace);
        } catch (e) {
            python = '# could not generate code: ' + (e && e.message ? e.message : e);
        }
        const pre = document.getElementById('code');
        if (python) {
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
        const state = Blockly.serialization.workspaces.save(workspace);
        const doc = Object.assign({}, lastDoc, { format: FILE_FORMAT, version: FILE_VERSION, workspace: state });
        return JSON.stringify(doc, null, 2) + '\n';
    }

    function load(text) {
        if (!workspace) { pendingText = text; return; }
        loading = true;
        try {
            Blockly.Events.disable();
            workspace.clear();
            lastDoc = {};
            let warning = '';
            const trimmed = (text || '').trim();
            if (trimmed) {
                const doc = JSON.parse(trimmed);
                const ours = doc && doc.format === FILE_FORMAT;
                if (ours && Number(doc.version) > FILE_VERSION) {
                    // a newer format: Blockly would load what it recognises and the next save
                    // would write the rest away, silently. Say so instead.
                    warning = 'This file was made by a newer version of the extension (format '
                        + doc.version + '; this one knows ' + FILE_VERSION + '). Update the EVN ALPHA '
                        + 'extension before editing it, or blocks it does not know may be lost.';
                }
                const state = ours ? doc.workspace : doc;   // tolerate a bare Blockly state
                if (ours) {
                    lastDoc = Object.assign({}, doc);
                    delete lastDoc.workspace;              // the workspace is regenerated on save
                }
                if (state && typeof state === 'object') {
                    Blockly.serialization.workspaces.load(state, workspace);
                }
            }
            lastText = text || '';
            setStatus(warning, !!warning);
        } catch (e) {
            setStatus('This file is not a valid blocks file: ' + (e && e.message ? e.message : e), true);
        } finally {
            Blockly.Events.enable();
            loading = false;
        }
        generate();
    }

    /* ---- toolbar ------------------------------------------------------------------------- */

    function setStatus(msg, isError, isOk) {
        const el = document.getElementById('status');
        el.textContent = msg || '';
        el.className = isError ? 'error' : isOk ? 'ok' : '';
    }

    function button(id, type) {
        document.getElementById(id).addEventListener('click', function () {
            vscode.postMessage({ type: type, python: generate() });
        });
    }
    button('btnRun', 'run');
    button('btnStop', 'stop');
    button('btnUpload', 'upload');
    button('btnExport', 'export');

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
    window.addEventListener('keydown', function (ev) {
        if (ev.key === 'F5' && ev.ctrlKey && !ev.shiftKey) { ev.preventDefault(); vscode.postMessage({ type: 'run', python: generate() }); }
        if (ev.key === 'F5' && ev.ctrlKey && ev.shiftKey) { ev.preventDefault(); vscode.postMessage({ type: 'stop' }); }
    });

    /* ---- extension messages -------------------------------------------------------------- */

    window.addEventListener('message', function (ev) {
        const msg = ev.data || {};
        switch (msg.type) {
            case 'load':
                if (msg.text !== lastText) { load(msg.text); }
                break;
            case 'getCode':
                vscode.postMessage({ type: 'code', id: msg.id, python: generate() });
                break;
            case 'status':
                setStatus(msg.message || '', !!msg.error, !!msg.ok);
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
