/* Junior mode's blocks in the blocks editor (docs/design/JR_JUNIOR_MODE.md §4.2, increment J2).
 *
 * The Junior blocks are data (src/junior/junior.js CATALOGUE, increment J1): this file only draws them. It registers a
 * Blockly block type for each catalogue entry (`jr_...`) and for the program's start (`jr_start`):
 *   - a picture (an image field; the pictures are the owner's, design §8 O1: until they are drawn each is a placeholder,
 *     marked as such, drawn here from the picture's id),
 *   - its number on a number pad (N25: tap the number; a pad of 0-9 and OK, at most as many digits as its largest
 *     value; a stepper of - / + as the access alternative; the arrow keys step it too),
 *   - its spoken label (the record's words, junior.js `say`) as the picture's alt text, so Blockly's ARIA composer
 *     reads it, and as the block's tooltip.
 * A Junior block has no generator: the editor turns the Junior program into standard blocks (junior.js toStandard) and
 * the one generator writes the Python. The editor's own blocks in G2's cut toolbox (`same` entries: Timing's ms
 * *wait*, Logic's *if*, *or*, ...) are evn_blocks.js's and are not registered here.
 *
 * Also here: the Junior toolbox from a lesson's list of block types (the lesson manifest, design §4.6; without one the
 * grade's blocks), and the Junior workspace's greying: a stack that does not hang from the start block, and every
 * block after a *forever* (N20), is disabled (`EVN_JR_NOT_RUN`), as evn_blocks.js applySections greys the standard
 * editor's loose stacks.
 *
 * Browser: a classic script after blockly_compressed.js, evn_blocks.js and junior.js (the global evnJunior); it sets
 * the global evnJuniorBlocks. Node (test_junior.js, test_blocks_a11y.js): require(...)(Blockly, junior).
 */
(function (root, factory) {
    // without junior.js (a page that does not load it, a failed load) there is no Junior mode, and the editor is the standard one
    if (typeof module === 'object' && module.exports) { module.exports = factory; } else { root.evnJuniorBlocks = root.evnJunior ? factory(root.Blockly, root.evnJunior) : null; }
}(typeof self !== 'undefined' ? self : this, function (Blockly, junior) {
    'use strict';

    const JR_START = junior.JR_START;
    const NOT_RUN = 'EVN_JR_NOT_RUN';
    const PAD_FIELD = 'field_jr_pad';
    const PICTURE_SIZE = 36;

    /** a toolbox group -> its block style and category (evn_blocks.js PALETTE's names) and the category's word */
    const GROUPS = [
        ['move', 'evn_motor', 'Move'], ['turn', 'evn_motor', 'Turn'], ['speed', 'evn_motor', 'Speed'],
        ['light', 'evn_output', 'Light'], ['time', 'evn_time', 'Wait'], ['loop', 'loop', 'Repeat'],
        ['sense', 'evn_sense', 'Sensing'], ['logic', 'logic', 'Logic'],
    ];
    const STYLE = Object.fromEntries(GROUPS.map(([g, s]) => [g, s]));

    /** Each Junior block's face, left to right: 'pic' (its picture), a field name, an input name, or words. G1's
     * picture blocks show a picture and their number; G2's word blocks show words too (G02.md "Language and tools":
     * "G2.1 still has icons with words under them"). */
    const FACE = {
        jr_forward: ['pic', 'N'], jr_back: ['pic', 'N'], jr_nudge: ['pic'], jr_nudge_back: ['pic'],
        jr_turn_right: ['pic'], jr_turn_left: ['pic'], jr_star_turn: ['pic'], jr_light_on: ['pic'], jr_light_off: ['pic'],
        jr_wait: ['pic', 'N'], jr_slow: ['pic'], jr_fast: ['pic'], jr_normal: ['pic', 'normal'], jr_wait_button: ['pic'],
        jr_repeat: ['pic', 'N', 'DO'], jr_drive: ['pic'], jr_stop: ['pic'],
        jr_drive_cm: ['pic', 'drive forward', 'CM', 'cm'], jr_back_cm: ['pic', 'back', 'CM', 'cm'],
        jr_wheel_turns: ['pic', 'wheels turn', 'TURNS', 'times'], jr_turn_part: ['pic', 'turn', 'DIR', 'a', 'PART'],
        jr_dice_turn: ['pic', 'turn a dice amount'], jr_steer_left: ['pic', 'steer left'], jr_steer_right: ['pic', 'steer right'],
        jr_forever: ['pic', 'forever', 'DO'], jr_wait_until: ['pic', 'wait until', 'COND'],
        jr_bumper: ['pic', 'bumper pressed?'], jr_sees: ['pic', 'sees', 'COLOR', '?'], jr_colour: ['pic', 'colour'],
        jr_brightness: ['pic', 'brightness'], jr_robot_distance: ['pic', 'robot distance (cm)'],
    };
    /** the number fields: their largest value and their step (junior.js's ranges: the pad 0-99, centimetres 0-500, wheel
     * turns in quarters 0-20) */
    const PADS = { N: { max: junior.PAD_MAX, step: 1 }, CM: { max: 500, step: 1 }, TURNS: { max: 20, step: 0.25 } };
    const DROPDOWNS = {
        DIR: [['right', 'right'], ['left', 'left']],
        PART: [['quarter', 'quarter'], ['half', 'half'], ['third', 'third']],
        COLOR: Object.keys(junior.COLOUR_WORD).map((k) => [junior.COLOUR_WORD[k], k]),
    };

    /** The placeholder picture for a picture id (design §8 O1: the owner's art replaces it): a dashed tile with the id's
     * initials and a "?" corner, so nobody takes it for the real picture. An SVG data URI (the webview's CSP allows
     * `img-src data:`). */
    function pictureUri(id) {
        const words = String(id || '?').split('-').filter(Boolean);
        const initials = words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><title>placeholder picture: ' + id + '</title>'
            + '<rect x="1.5" y="1.5" width="33" height="33" rx="7" fill="#ffffff" fill-opacity="0.9" stroke="#111518" stroke-width="1.5" stroke-dasharray="3 2"/>'
            + '<text x="18" y="23" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle" fill="#111518">' + initials + '</text>'
            + '<text x="31" y="10" font-family="sans-serif" font-size="8" text-anchor="end" fill="#c25e4f">?</text></svg>';
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    /** the spoken label's words without the block's values (the picture's alt text: the values are read from their own
     * fields): `say` of the block's defaults with each default value's text taken out */
    function altOf(c) {
        let s = c.say(Object.assign({}, c.fields));
        for (const k of Object.keys(c.fields || {})) {
            const v = k === 'COLOR' ? junior.COLOUR_WORD[c.fields[k]] : String(c.fields[k]);
            s = s.replace(new RegExp('(^|\\s)' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)'), '$1');
        }
        return s.replace(/\s+/g, ' ').trim();
    }

    /* ---- the number pad ------------------------------------------------------------------------------------------- */

    const QUARTERS = ['', '¼', '½', '¾'];
    /** 2.75 -> "2¾" */
    function padText(v, step) {
        if (step >= 1) { return String(v); }
        const whole = Math.floor(v), q = Math.round((v - whole) * 4);
        return (whole || !q ? String(whole) : '') + QUARTERS[q];
    }

    let FieldPad = null;
    function definePad() {
        if (FieldPad || !Blockly.FieldNumber) { return; }
        /** A number field edited on a pad (N25). Its value is FieldNumber's (min 0, the field's max, its step), so a file
         * with a value outside the range is put right by Blockly's own validation as any number field's is. */
        FieldPad = class extends Blockly.FieldNumber {
            constructor(value, max, step, validator, config) {
                super(value, 0, max, step, validator, config);
                this.padMax = max;
                this.padStep = step;
            }
            /* the JSON's config is FieldNumber's too (its configure_ sets min, max and precision from it): all three given */
            static fromJson(o) { return new FieldPad(o.value, o.max, o.step || 1, undefined, Object.assign({}, o, { min: 0, max: o.max, precision: o.step || 1 })); }
            getText_() { return padText(Number(this.getValue()), this.padStep); }
            /** the pad: digits (at most the largest value's), quarters for a step of ¼, ⌫, OK, and - / + */
            showEditor_() {
                Blockly.DropDownDiv.clearContent();
                const div = Blockly.DropDownDiv.getContentDiv();      // after clearContent, which may make a new one
                const pad = document.createElement('div');
                pad.className = 'jrPad';
                // big targets for small fingers (the page's own CSS is the standard editor's: the pad styles itself)
                Object.assign(pad.style, { display: 'grid', gridTemplateColumns: 'repeat(3, 48px)', gap: '6px', padding: '6px' });
                pad.setAttribute('role', 'group');
                pad.setAttribute('aria-label', 'number pad');
                const shown = document.createElement('output');
                shown.className = 'jrPadShown';
                shown.setAttribute('aria-live', 'polite');
                Object.assign(shown.style, { gridColumn: '1 / -1', textAlign: 'center', fontSize: '24px', fontWeight: '600', minHeight: '32px' });
                pad.appendChild(shown);
                const maxDigits = String(Math.floor(this.padMax)).length;
                // the pad starts at the field's value; the first digit starts a new number, a quarter key keeps the whole part
                // (r1 S2: 2 then ½ is 2½)
                const v0 = Number(this.getValue()) || 0;
                let typed = String(Math.floor(v0));
                let quarter = Math.round((v0 - Math.floor(v0)) * 4);
                let fresh = true;
                const current = () => Number(typed || '0') + quarter / 4;
                const show = () => { shown.textContent = padText(current(), this.padStep); };
                const ok = (v) => v >= 0 && v <= this.padMax;
                const press = (label, aria, fn) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.textContent = label;
                    b.setAttribute('aria-label', aria);
                    Object.assign(b.style, { minWidth: '48px', minHeight: '48px', fontSize: '20px', borderRadius: '10px', cursor: 'pointer' });
                    b.addEventListener('click', (e) => { e.preventDefault(); fn(); show(); });
                    pad.appendChild(b);
                    return b;
                };
                const digit = (d) => {
                    if (fresh) { typed = ''; quarter = 0; fresh = false; }
                    if (typed.length >= maxDigits) { return; }
                    const next = (typed === '0' ? '' : typed) + d;
                    if (ok(Number(next) + quarter / 4)) { typed = next; }
                };
                /** ⌫ and the Backspace key alike: the quarter first, then the last digit */
                const back = () => { fresh = false; if (quarter) { quarter = 0; } else { typed = typed.slice(0, -1); } };
                const step = (sign) => {
                    fresh = false;
                    const v = Math.round((current() + sign * this.padStep) * 4) / 4;
                    if (ok(v)) { typed = String(Math.floor(v)); quarter = Math.round((v - Math.floor(v)) * 4); }
                };
                const done = () => { this.setValue(current()); Blockly.DropDownDiv.hideIfOwner(this, true); };
                for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) { press(String(d), String(d), () => digit(String(d))).className = 'jrPadDigit'; }
                if (this.padStep < 1) {
                    for (let q = 1; q <= 3; q++) { press(QUARTERS[q], ['a quarter', 'a half', 'three quarters'][q - 1], () => { fresh = false; if (ok(Number(typed || '0') + q / 4)) { quarter = q; } }); }
                }
                press('⌫', 'delete', back);
                press('−', 'one less', () => step(-1));
                press('+', 'one more', () => step(1));
                press('OK', 'OK', done).className = 'jrPadOk';
                // the keyboard: digits, Backspace, the arrows step, Enter is OK, Escape leaves the value as it was
                pad.addEventListener('keydown', (e) => {
                    if (e.ctrlKey || e.metaKey || e.altKey) { return; }
                    if (/^[0-9]$/.test(e.key)) { digit(e.key); } else if (e.key === 'Backspace') { back(); } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { step(1); } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { step(-1); } else if (e.key === 'Enter') { done(); } else if (e.key === 'Escape') { Blockly.DropDownDiv.hideIfOwner(this, true); } else { return; }
                    e.preventDefault();
                    e.stopPropagation();
                    show();
                });
                show();
                div.appendChild(pad);
                Blockly.DropDownDiv.setColour('#ffffff', '#111518');
                Blockly.DropDownDiv.showPositionedByField(this, () => { });
                const first = pad.querySelector('button');
                if (first) { first.focus(); }
            }
        };
        Blockly.fieldRegistry.register(PAD_FIELD, FieldPad);
    }

    /* ---- the block types ------------------------------------------------------------------------------------------ */

    /** the Blockly JSON definition of catalogue entry c (exported for the tests) */
    function definition(c) {
        const def = { type: c.type, style: STYLE[c.group] + '_blocks', tooltip: c.say(Object.assign({}, c.fields)) };
        const args = [];
        const words = [];
        for (const p of FACE[c.type] || ['pic']) {
            if (p === 'pic') {
                args.push({ type: 'field_image', src: pictureUri(c.picture), width: PICTURE_SIZE, height: PICTURE_SIZE, alt: altOf(c) });
            } else if (PADS[p]) {
                args.push({ type: PAD_FIELD, name: p, value: c.fields[p], max: PADS[p].max, step: PADS[p].step });
            } else if (DROPDOWNS[p]) {
                args.push({ type: 'field_dropdown', name: p, options: DROPDOWNS[p] });
            } else if (p === c.body) {
                // a statement input takes two arguments: its row's end, then the input
                args.push({ type: 'input_dummy' });
                words.push('%' + args.length);
                args.push({ type: 'input_statement', name: p });
            } else if ((c.values || []).indexOf(p) >= 0) {
                args.push({ type: 'input_value', name: p, check: 'Boolean' });
            } else {
                words.push(p);
                continue;
            }
            words.push('%' + args.length);
        }
        def.message0 = words.join(' ');
        def.args0 = args;
        if (c.output) { def.output = c.output; } else { def.previousStatement = null; def.nextStatement = null; }
        if (c.values) { def.inputsInline = true; }
        return def;
    }

    let registered = false;
    /** Register the Junior block types (once). They have no generator: toStandard writes the program. */
    function register() {
        if (registered) { return; }
        registered = true;
        definePad();
        const defs = [{
            type: JR_START, message0: '%1 start', args0: [{ type: 'field_image', src: pictureUri('start-flag'), width: PICTURE_SIZE, height: PICTURE_SIZE, alt: 'start' }],
            nextStatement: null, style: 'evn_start_blocks', tooltip: 'The program starts here: blocks under it run, top to bottom.',
        }];
        for (const c of junior.CATALOGUE) {
            if (c.same) { continue; }
            defs.push(definition(c));
        }
        Blockly.common.defineBlocksWithJsonArray(defs);
        // the tooltip follows the block's numbers (the spoken label of what the block says now)
        for (const c of junior.CATALOGUE) {
            if (c.same || !Object.keys(c.fields || {}).length) { continue; }
            const def = Blockly.Blocks[c.type];
            const init = def.init;
            def.init = function () {
                init.call(this);
                this.setTooltip(() => { const f = {}; for (const k of Object.keys(c.fields)) { f[k] = this.getFieldValue(k); } return c.say(f); });
            };
        }
    }

    /* ---- the toolbox ---------------------------------------------------------------------------------------------- */

    /** the toolbox entry of a block type, with the shadows it starts with */
    function item(type) {
        const num = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
        switch (type) {
            case 'jr_wait_until': return { kind: 'block', type, inputs: { COND: { shadow: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } } } };
            case 'evn_wait': return { kind: 'block', type, inputs: { TIME: num(500) } };
            case 'logic_operation': return { kind: 'block', type, fields: { OP: 'OR' } };
            case 'logic_compare': return { kind: 'block', type, inputs: { B: num(0) } };
            case 'evn_color': return { kind: 'block', type, fields: { COLOR: 'RED' } };
            default: return { kind: 'block', type };
        }
    }

    /**
     * The Junior toolbox: the lesson's list of block types (its manifest, design §4.6), else every catalogue block of
     * the lesson's grade and the grades below it. Categories by group, in a fixed order; a type outside the catalogue is
     * left out (only catalogue blocks can be in a Junior program). Returns Blockly's category toolbox JSON.
     */
    function toolboxFor(opts) {
        const list = opts && Array.isArray(opts.list) ? opts.list : null;
        const grade = Number(opts && opts.grade) || 1;
        const types = list ? list.filter((t) => junior.BY_TYPE[t]) : junior.CATALOGUE.filter((c) => c.grade <= grade).map((c) => c.type);
        const contents = [];
        for (const [group, style, name] of GROUPS) {
            const here = types.filter((t) => junior.BY_TYPE[t].group === group);
            if (here.length) { contents.push({ kind: 'category', name, categorystyle: style + '_category', contents: here.map(item) }); }
        }
        return { kind: 'categoryToolbox', contents };
    }

    /* ---- the Junior workspace ------------------------------------------------------------------------------------- */

    /** Grey (disable) what never runs: a stack not under the start block, and the blocks after a *forever* (N20).
     * Idempotent; another disabled reason (the user's own) is left alone. */
    function applySections(workspace) {
        const set = (b, dead) => { if (!b.isShadow() && b.hasDisabledReason(NOT_RUN) !== dead) { b.setDisabledReason(dead, NOT_RUN); } };
        const chain = (first, dead) => {
            for (let b = first; b; b = b.getNextBlock()) {
                set(b, dead);
                for (const input of b.inputList) {
                    const t = input.connection && input.connection.targetBlock();
                    if (t) { chain(t, dead); }
                }
                const c = junior.BY_TYPE[b.type];
                if (c && c.final) { dead = true; }
            }
        };
        for (const top of workspace.getTopBlocks(false)) { chain(top, top.type !== JR_START); }
    }

    /** A Junior document -> Blockly state to load: the document's workspace, with a start block made when it has none
     * (a new Junior file), the start never deletable. */
    function workspaceState(doc) {
        const state = doc && doc.workspace && doc.workspace.blocks ? JSON.parse(JSON.stringify(doc.workspace)) : { blocks: { languageVersion: 0, blocks: [] } };
        const tops = state.blocks.blocks || (state.blocks.blocks = []);
        if (!tops.some((t) => t.type === JR_START)) { tops.unshift({ type: JR_START, id: 'jr:start', x: 20, y: 20 }); }
        for (const t of tops) { if (t.type === JR_START) { t.deletable = false; } }
        return state;
    }

    /** A new, empty Junior document for a lesson (the start block only; the robot is the lesson's or the file's id) */
    function emptyDocument(lesson, robot) {
        return { format: junior.FILE_FORMAT, version: junior.JUNIOR_VERSION, kind: junior.KIND, lesson: lesson || null, robot: robot || null,
            workspace: workspaceState(null) };
    }

    return { JR_START, NOT_RUN, PAD_FIELD, GROUPS, FACE, register, definition, toolboxFor, applySections, workspaceState, emptyDocument, pictureUri, altOf, padText };
}));
