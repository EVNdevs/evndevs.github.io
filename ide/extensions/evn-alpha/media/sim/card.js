/* The Simulator panel's challenge card and its one live region (docs/CHK_DESIGN.md §6 "CHK owns the card code and the one live
 * region", §11 CHK5a): the code of #chCard, moved out of media/sim/sim.js so that jsdom loads this very file
 * (scripts/test_challenge.js "card"), and `say(line)`, the one way a card's line reaches a screen reader.
 *
 * - The region is one <div class="sr" role="status" aria-live="polite"> outside every card, visually hidden (sim.css .sr)
 *   but never `hidden`, so a closed card does not silence it. Its id stays TRAIL's `trSay`: TRAIL's own `say()` in
 *   sim.js (the tools' keyboard words, written at once) writes the same element, so the panel has one region.
 * - say(line) clears the region now and writes the line on the next frame: a line said twice is announced twice (the
 *   same text written over itself is no change a screen reader hears). A later say() before that frame wins; a write
 *   made between the clear and the frame (TRAIL's, at once) is newer, so the frame leaves it.
 * - The card: its title, progress, the level's line (CHK7), a row per run (with, under a run that ended in an error, the error's last line as text
 *   across the table: TRAIL S5, A11Y_DESIGN W6), the summary line, Save submission (student runs only, enabled by the
 *   summary), Practice (after a student's or a practice's runs: challengeHost.ts rehearse(), P8e1) and Close. Card text is set with textContent only (a program's error is the learner's text).
 *
 * No vscode API and no state of sim.js's: the page hands in `el`, `post` (vscode.postMessage) and `tryAt` (a run's Try).
 * CC-4 and CC-8 write through this file.
 *
 * The check card (#ckCard, CheckCard; CHK_DESIGN.md §6, CHK5b): a lesson check's states, every line from the extension host
 * (src/sim/checkHost.ts), which alone judges:
 *   open        the check's title; with `predict` its label, a box and Run check (the box's words never leave the page:
 *               Run check posts { present, number } alone, §7). The box keeps its text across presses (Run check again) and
 *               only Close empties it (CHK6, §7.1); a box not edited since the last press posts present false, so it records
 *               nothing and gets no PREDICTED line (a prediction comes before the run it predicts). parseBox reads it;
 *   running     "Part 1 of 2…" (one part: "Running…");
 *   verdict     the overall line, a line per clause when there are several, the hints, PREDICTED; Run check again, Close;
 *   could not run   the reason in words (or "not in your version"), never a FAIL.
 * The overall line, a could-not-run line and "not in your version" go through say(); the challenge card's say() is the same
 * region, so the panel has one. Focus moves into the card as it opens, so Tab from there reaches its buttons.
 */
(function (root) {
    'use strict';

    /** the run's end, in the card's words */
    const ENDS = { goal: 'goal', time: 'out of time', ended: 'stopped short', error: 'error', still: 'stood still', touch: 'touched', visits: 'every target visited', reach: 'within reach', window: 'the window closed' };

    /** the page's one live region: made once per document, found again after */
    function region(doc, el) {
        return doc.getElementById('trSay') || el('div', { class: 'sr', id: 'trSay', role: 'status', 'aria-live': 'polite' });
    }

    /** say(line) on `doc`'s region: cleared now, written on the next frame (`raf`, the page's requestAnimationFrame) */
    function sayer(doc, raf) {
        let pending = null;
        return function say(line) {
            const r = doc.getElementById('trSay');
            if (!r) { return; }
            r.textContent = '';
            const text = String(line);
            const mine = pending = { text };
            raf(() => {
                if (pending !== mine) { return; }
                pending = null;
                // something written since the clear (TRAIL's say, at once) is newer than this line
                if (r.textContent === '') { r.textContent = text; }
            });
        };
    }

    class ChallengeCard {
        /** `doc` the page's document, `el` its element maker (sim.js el), `post` vscode.postMessage, `tryAt(start)` a run's Try
         *  button (the robot put at that run's start), `raf` the page's requestAnimationFrame */
        constructor({ doc, el, post, tryAt, raf }) {
            this.doc = doc; this.el = el; this.post = post; this.tryAt = tryAt;
            this.purpose = '';
            /** COURSE_FORMAT_DESIGN.md §16.4.7: the job whose summary the card shows (0: none), and what that summary would
             *  have turned on had no comparison been pending */
            this.jobId = 0;
            this.held = null;
            this.say = sayer(doc, raf || ((cb) => root.requestAnimationFrame(cb)));
        }

        $(id) { return this.doc.getElementById(id); }

        /** the card's element, hidden until a job opens it */
        element() {
            const el = this.el;
            return el('div', { class: 'card ref chal', id: 'chCard', hidden: '' },
                el('div', { class: 'row' }, el('b', { id: 'chTitle' }), el('span', { class: 'v', id: 'chProg' })),
                el('div', { class: 'row', id: 'chLine', hidden: '' }),
                el('table', { class: 'chtab' }, el('thead', {}, el('tr', {}, ...['Run', 'Start', 'Result', 'Time', 'Touches', 'Points', ''].map((h) => el('th', {}, h)))), el('tbody', { id: 'chRows' })),
                el('div', { class: 'row', id: 'chSum' }),
                el('div', { class: 'row', id: 'chCmp', hidden: '' }),
                el('div', { class: 'row' },
                    el('button', { class: 'btn primary', id: 'chSave', type: 'button', disabled: '', title: 'Seal these runs, your program and your robot for your teacher (and EVN), as a .evnsub file to hand in', onclick: () => this.post({ type: 'challenge-save' }) }, 'Save submission…'),
                    el('button', { class: 'btn', id: 'chPractice', type: 'button', disabled: '', title: 'Run your program again from the same starts, for practice: a practice run is never sealed or recorded', onclick: () => this.post({ type: 'challenge-practice' }) }, 'Practice'),
                    readButton(this.doc, el, 'chCard', (line) => this.say(line)),
                    el('button', { class: 'btn', type: 'button', onclick: () => { stopReading(this.doc, 'chCard'); this.$('chCard').hidden = true; } }, 'Close')));
        }

        /** the header's Runs box for the level the panel shows (`level`: simPanel.ts challengeCfg's entry, or none): a level
         *  that fixes its runs sets the box to N and disables it; another gives the box back the learner's own number */
        header(level) {
            const box = this.$('chRuns');
            if (!box) { return; }
            // the reason in words a screen reader reaches: the box's aria-describedby (sim.js), as the title is out of reach
            const why = this.$('chRunsWhy');
            const fixed = level && Number.isInteger(level.fixed) ? level.fixed : null;
            if (fixed !== null) {
                if (!box.disabled) { box.dataset.chosen = box.value; }
                box.value = String(fixed);
                box.disabled = true;
                box.title = `This level always runs ${fixed} times`;
                if (why) { why.textContent = box.title; }
            } else if (box.disabled) {
                box.disabled = false;
                if (box.dataset.chosen !== undefined) { box.value = box.dataset.chosen; delete box.dataset.chosen; }
                box.removeAttribute('title');
                if (why) { why.textContent = ''; }
            }
        }

        /** the live region's element, for the page to place outside every card */
        region() { return region(this.doc, this.el); }

        /** a job begins: the card shown, emptied, titled; `purpose` the host's (student, verify, retest) */
        open({ title, runs, purpose }) {
            stopReading(this.doc, 'chCard');
            this.purpose = purpose;
            // a new job's card shows no other job's comparison (r2 F-S3)
            this.jobId = 0;
            this.held = null;
            this.$('chCmp').textContent = '';
            this.$('chCmp').hidden = true;
            this.$('chCard').hidden = false;
            this.$('chTitle').textContent = title;
            this.$('chProg').textContent = `starting (${runs} run${runs === 1 ? '' : 's'})…`;
            this.$('chRows').textContent = '';
            this.$('chSum').textContent = purpose === 'student' || purpose === 'rehearse' ? '' : 'The report is in the editor.';
            this.$('chLine').textContent = '';
            this.$('chLine').hidden = true;
            this.$('chSave').disabled = true;
            this.$('chSave').hidden = purpose !== 'student';
            // Practice: after a student's (or a practice's) runs, the same job again on its own seed (CHK_DESIGN.md §8)
            this.$('chPractice').disabled = true;
            this.$('chPractice').hidden = purpose !== 'student' && purpose !== 'rehearse';
        }

        /** a run's row, as the challenge worker gave its result */
        row(r) {
            const el = this.el;
            const tr = el('tr', { class: r.reached ? 'ok' : 'miss' },
                el('td', {}, String(r.run)),
                el('td', { title: `x ${r.start.x} mm, y ${r.start.y} mm, heading ${r.start.heading}°` }, r.run === 1 ? 'nominal' : `${r.start.x}, ${r.start.y}, ${r.start.heading}°`),
                el('td', { title: r.error || '' }, ENDS[r.end] || r.end),
                el('td', {}, `${r.time} s`),
                el('td', {}, String(r.touches)),
                el('td', {}, String(r.points)),
                el('td', {}, this.purpose === 'student' ? el('button', { class: 'btn', type: 'button', title: 'Put the robot at this run\'s start, to run your program from there and watch', onclick: () => this.tryAt(r.start) }, 'Try') : ''));
            this.$('chRows').append(tr);
            // why a run ended in an error, as text under its own row: the tooltip alone reaches neither a keyboard nor a
            // screen reader (A11Y_DESIGN W6); the row spans the table, as the words do not fit the Result column
            const why = r.error && r.error.trim().split('\n').pop();
            if (why) { this.$('chRows').append(el('tr', { class: 'why' }, el('td', { colspan: '7' }, why))); }
        }

        /** the extension host's summary (challenge-summary): shown, and Save submission ready for a student's runs; false when
         *  the host could not score them (`m.error`: the page's note says why) */
        summary(m) {
            if (m.error) { this.$('chProg').textContent = 'not scored'; return false; }
            const s = m.summary;
            this.$('chProg').textContent = 'done';
            // a level's named values (COURSE_FORMAT_DESIGN.md §12.3) after the summary, an undefined one as -
            const u = m.units || {};
            const vals = s.values ? Object.entries(s.values).map(([k, v]) => ` · ${k} ${v ?? '-'}${v !== null && u[k] ? ' ' + u[k] : ''}`).join('') : '';
            this.$('chSum').textContent = `score ${s.score} · at the goal ${s.reached} of ${s.runs} · clean ${s.clean} · best ${s.best ?? '-'} s · median ${s.median ?? '-'} s${vals}`;
            this.jobId = m.id;
            // §16.4.7: with a comparison pending, Save and Practice stay off until its challenge-compare
            const practiceLine = typeof m.line === 'string' && m.line.startsWith('PRACTICE');
            const save = this.purpose === 'student' && !practiceLine, practice = this.purpose === 'student' || this.purpose === 'rehearse';
            this.held = m.compare === 'pending' ? { save, practice, runs: s.runs } : { save: false, practice: false, runs: s.runs };
            if (m.compare !== 'pending') {
                if (this.purpose === 'student') { this.$('chSave').disabled = false; }
                if (practice) { this.$('chPractice').disabled = false; }
            }
            // the level's line (CHK7: PASS, FAIL, NOT YET, PRACTICE; challengeRecord.ts levelLine), shown and said; under a
            // PRACTICE line Save submission stays off, so a practice score never seals an older run (CHK_DESIGN.md §8)
            if (typeof m.line === 'string' && m.line) {
                this.$('chLine').textContent = m.line;
                this.$('chLine').hidden = false;
                if (m.line.startsWith('PRACTICE')) { this.$('chSave').disabled = true; }
                this.say(m.line);
            }
            return true;
        }

        /** §16.4.7: the host's challenge-compare - shown only on the card whose summary has its id (never another Run's, nor a
         *  verification's): one row under the summary, the ratio over its pairs of N runs or why there is none, the
         *  comparison's own score, "the same text" when it is; Save and Practice on where the summary held them off. True
         *  when shown */
        compare(m) {
            if (!this.jobId || m.id !== this.jobId || !m.comparison) { return false; }
            const c = m.comparison, n = this.held ? this.held.runs : '?';
            const r0 = String(c.roles && c.roles[0]), r1 = String(c.roles && c.roles[1]);
            const text = c.ratio === null || c.ratio === undefined ? `${r0} / ${r1}: no ratio (${c.why || 'none'})` : `${r0} / ${r1}: ${c.ratio} over ${c.pairs} of ${n} runs (${r1} score ${c.vsScore ?? '-'})`;
            this.$('chCmp').textContent = text + (c.same ? ' · the two programs are the same text' : '');
            this.$('chCmp').hidden = false;
            this.$('chProg').textContent = '';
            if (this.held) {
                if (this.held.save) { this.$('chSave').disabled = false; }
                if (this.held.practice) { this.$('chPractice').disabled = false; }
                this.held = null;
            }
            return true;
        }

        /** CC-8's practice line (the panel's own Run on a challenge level, workerCore.ts): said through the one region whether
         *  the card is open or not (COURSE_CONTENT_DESIGN.md §8 item 10); on an open card it is the card's line, and Save
         *  submission is off under it (a practice score never seals). True when the card showed it */
        practice(line) {
            const text = String(line);
            const open = !this.$('chCard').hidden;
            if (open) {
                this.$('chLine').textContent = text;
                this.$('chLine').hidden = false;
                this.$('chSave').disabled = true;
            }
            this.say(text);
            return open;
        }
    }

    /** §7.1's box as a number, or undefined (words): the trimmed text less a unit suffix in any case (`°`, `deg` or `degrees` for
     *  a `deg` unit, the unit's own word otherwise), trimmed again (round 3 N1), is one number. A comma before exactly three
     *  digits, in groups after a first group of 1-9 and up to two digits more, is a thousands separator ("1,440" is 1440; "0,500"
     *  is 0.5, round 3 N1); any other single comma is the decimal point ("12,5" is 12.5). Never Number() of the raw text ("   " is
     *  0) or parseFloat ("2 turns" is 2). A value past Number's range (a 401-digit integer, "1e999" never matches) is words. */
    const NUMBER_RE = /^[+-]?([1-9]\d{0,2}(,\d{3})+(\.\d+)?|\d+([.,]\d*)?|[.,]\d+)$/;
    const THOUSANDS_RE = /^[+-]?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/;
    function parseBox(text, unit) {
        let t = String(text).trim();
        if (t === '') { return undefined; }
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const suffix = unit === 'deg' ? /\s*(°|degrees|deg)$/i : unit ? new RegExp(`\\s*${esc(String(unit))}$`, 'i') : null;
        if (suffix) { t = t.replace(suffix, '').trim(); }
        if (!NUMBER_RE.test(t)) { return undefined; }
        const n = Number(THOUSANDS_RE.test(t) ? t.replace(/,/g, '') : t.replace(',', '.'));
        return Number.isFinite(n) ? n : undefined;
    }

    class CheckCard {
        /** `doc`, `el` and `post` as ChallengeCard's; `say` the page's one say() (ChallengeCard's), so both cards speak in one
         *  region */
        constructor({ doc, el, post, say }) {
            this.doc = doc; this.el = el; this.post = post; this.say = say;
            this.id = 0;
            this.closed = false;
            /** the box was edited since the last press (CHK6) */
            this.edited = false;
            this.unit = undefined;
        }

        $(id) { return this.doc.getElementById(id); }

        /** the card's element, hidden until a check opens it */
        element() {
            const el = this.el;
            return el('div', { class: 'card ref chk', id: 'ckCard', role: 'region', 'aria-labelledby': 'ckTitle', hidden: '' },
                el('div', { class: 'row' }, el('b', { id: 'ckTitle', tabindex: '-1' }), el('span', { class: 'v', id: 'ckProg' })),
                el('div', { class: 'row', id: 'ckAsk', hidden: '' },
                    el('label', { for: 'ckNum', id: 'ckLabel' }),
                    el('input', { type: 'text', id: 'ckNum', inputmode: 'decimal', autocomplete: 'off', style: 'width:6em', oninput: () => { this.edited = true; } }),
                    el('span', { id: 'ckUnit' }),
                    el('button', { class: 'btn primary', type: 'button', id: 'ckGo', title: 'Run the program in the editor against this check', onclick: () => this.go() }, 'Run check')),
                el('div', { id: 'ckLines' }),
                el('div', { class: 'row' },
                    el('button', { class: 'btn', type: 'button', id: 'ckAgain', hidden: '', title: 'Check the program in the editor again', onclick: () => this.post({ type: 'check-start' }) }, 'Run check again'),
                    readButton(this.doc, el, 'ckCard', (line) => this.say(line)),
                    el('button', { class: 'btn', type: 'button', id: 'ckClose', onclick: () => this.close() }, 'Close')));
        }

        /** the lines under the title: `lines` as rows, the first in bold when `lead` */
        lines(lines, lead) {
            const box = this.$('ckLines');
            box.textContent = '';
            lines.forEach((t, i) => box.append(this.el(i === 0 && lead ? 'b' : 'div', { class: 'ckline' }, t)));
        }

        /** focus into the card unless it is there already, so Tab reaches its buttons next */
        focusIn() {
            const card = this.$('ckCard');
            if (!card.contains(this.doc.activeElement)) { this.$('ckTitle').focus(); }
        }

        /** a check begins (check-open): shown, emptied, titled; with `predict` the box and Run check, else it is running */
        open({ id, check, title, parts, predict }) {
            stopReading(this.doc, 'ckCard');
            this.id = id;
            // another check's card: the box holds nothing of the last one's (review chk6_r1 N1)
            if (check !== this.check) { this.$('ckNum').value = ''; this.edited = false; }
            this.check = check;
            this.closed = false;
            this.$('ckCard').hidden = false;
            this.$('ckTitle').textContent = title;
            this.lines([], false);
            this.$('ckAgain').hidden = true;
            const ask = !!predict;
            this.$('ckAsk').hidden = !ask;
            if (ask) {
                this.$('ckLabel').textContent = predict.label;
                this.$('ckUnit').textContent = predict.unit === 'deg' ? '°' : predict.unit || '';
                this.unit = predict.unit;
                // the box keeps its text after a verdict (Run check again); only Close empties it (§7.1)
                this.$('ckGo').disabled = false;
                this.$('ckProg').textContent = 'predict, then Run check';
                this.$('ckNum').focus();
            } else {
                this.running(0, parts);
                this.focusIn();
            }
        }

        /** Run check: the box's number goes, its words stay here (§7). A box not edited since the last press is no prediction:
         *  present false. Every press clears the flag, a press that could not run included (round 3 S4) */
        go() {
            const text = this.$('ckNum').value;
            const present = this.edited && text.trim() !== '';
            const n = present ? parseBox(text, this.unit) : undefined;
            this.edited = false;
            this.$('ckGo').disabled = true;
            this.$('ckAsk').hidden = true;
            this.running(0, 0);
            this.focusIn();
            this.post({ type: 'check-go', id: this.id, present, number: n === undefined ? null : n });
        }

        /** part `i` (0-based) of `parts` is running */
        running(i, parts) {
            this.$('ckProg').textContent = parts > 1 ? `Part ${i + 1} of ${parts}…` : 'Running…';
        }

        /** the host's verdict (check-verdict): the overall line first, said; a line per clause when there are several */
        verdict(m) {
            if (m.id !== this.id) { return; }
            // a card the learner closed while it ran stays closed: the line is still said (review chk5b_r1 N2)
            if (!this.closed) { this.$('ckCard').hidden = false; }
            this.$('ckAsk').hidden = true;
            this.$('ckProg').textContent = m.ok ? 'passed' : 'not yet';
            const clauses = (m.lines || []).filter((l) => l !== m.overall);
            this.lines([m.overall, ...clauses, ...(m.hints || []), ...(m.predicted ? [m.predicted] : [])], true);
            this.$('ckAgain').hidden = false;
            if (!this.closed) { this.focusIn(); }
            this.say(m.predicted ? `${m.overall} ${m.predicted}` : m.overall);
        }

        /** the check could not run (check-cannot): the reason in words, said; never a FAIL. `id` the press's when it had one
         *  (its title stays), else the card is titled Check */
        cannot(line, id) {
            if (id === undefined || id !== this.id) { this.id = 0; this.closed = false; this.$('ckTitle').textContent = 'Check'; }
            if (!this.closed) { this.$('ckCard').hidden = false; }
            this.$('ckAsk').hidden = true;
            this.$('ckProg').textContent = 'could not run';
            this.lines([line], false);
            this.$('ckAgain').hidden = false;
            if (!this.closed) { this.focusIn(); }
            this.say(line);
        }

        /** Close: hidden, the focus back on the header's Check button; a check waiting for Run check is dropped */
        close() {
            const had = this.$('ckCard').contains(this.doc.activeElement);
            stopReading(this.doc, 'ckCard');
            this.closed = true;
            this.$('ckCard').hidden = true;
            // Close empties the box (§7.1; the built Close only hid it)
            this.$('ckNum').value = '';
            this.edited = false;
            if (had && this.$('ckRun')) { this.$('ckRun').focus(); }
            this.post({ type: 'check-close', id: this.id });
        }
    }

    /* ---- the pose readout (A11Y_DESIGN.md §5 W3) ---------------------------------------------------------------------
     * Pure: the page (sim.js) says what these return through the one region. The panel draws the robot where it truly is,
     * so saying that pose is what a sighted learner already sees; it reaches no program (README §9 GT's wall is the
     * program's reads: workerCore.ts trailRefused, challengeRun.ts's VM without tools), and nothing here is posted. */

    /** a heading as the panel states it: above -180, up to 180 */
    function wrap180(d) { const a = ((d % 360) + 360) % 360; return a > 180 ? a - 360 : a; }
    /** a whole number as the panel says it: never "-0" */
    const whole = (v) => (Number.isFinite(v) ? (Math.round(v) + 0).toFixed(0) : '-');
    /** a pose in the panel's words (TRAIL's pane, its said lines, W3) */
    const poseText = (p) => `x ${whole(p.x)} mm, y ${whole(p.y)} mm, heading ${whole(wrap180(p.heading))}°`;
    /** where (x, y) lies from a robot at `p`: ahead within 45° of its heading, behind within 45° of its back, else to its
     *  left or right (y up, heading anticlockwise from +x: the world's convention, world.ts `Math.cos(h), Math.sin(h)`) */
    function side(p, x, y) {
        const rel = wrap180(Math.atan2(y - p.y, x - p.x) * 180 / Math.PI - p.heading);
        if (Math.abs(rel) <= 45) { return 'ahead'; }
        if (Math.abs(rel) >= 135) { return 'behind'; }
        return rel > 0 ? 'to the left' : 'to the right';
    }
    /** W3's sentence: the pose, then the course's nearest named item (`geometry.names`: workerCore.ts courseNames, each
     *  item's middle and each area's centre; a challenge course only), its distance from the robot's middle in whole mm and
     *  its side. The first of equally near names wins (the level's order). No names: the pose alone */
    function poseSentence(pose, geometry) {
        const text = poseText(pose);
        const names = geometry && Array.isArray(geometry.names) ? geometry.names.filter((n) => n && typeof n.name === 'string' && Number.isFinite(n.x) && Number.isFinite(n.y)) : [];
        if (!names.length) { return text; }
        let best = names[0], bd = Math.hypot(best.x - pose.x, best.y - pose.y);
        for (const n of names) { const d = Math.hypot(n.x - pose.x, n.y - pose.y); if (d < bd) { best = n; bd = d; } }
        const mm = Math.round(bd);
        return `${text}; nearest: ${best.name}, ${mm === 0 ? 'under the robot' : `${mm} mm ${side(pose, best.x, best.y)}`}`;
    }

    /* ---- the cards' Read aloud (A11Y_DESIGN.md §5 W4) -------------------------------------------------------------------
     * A3's Reader with the cards' blocks (src/sim/cardReader.ts, bundled as dist/sim/reader.js: the global EVNReader, loaded
     * before this file) reads a card block by block under §4.2's invariant: speak() only with a local voice for the page's
     * language, looked up again for every utterance; none, and speak() is never called. The device's default local voice and
     * the normal rate (the panel has no Reading settings). One reading for the page: `it.card` names the card being read, or
     * waited for (the reader's voice wait, up to 2 s), and every way of stopping goes through cancel(): pressed again (while it
     * waits too), Escape (wherever the focus is, and then only that: the key goes no further), Close, a new job on that card,
     * the other card's press, the panel hidden. With no voice (or no reader: an older page) nothing is spoken, the button says
     * so and stays pressable (each press looks again), and a line under it names the device's own routes, also said. */
    const READ = 'Read aloud', STOP_READ = 'Stop reading', NO_VOICE = 'No voice on this device';
    const NO_VOICE_LINE = 'No voice on this device for read-aloud. The device\'s own routes: Edge\'s Read aloud, a Chromebook\'s Select-to-speak, an iPad\'s Speak Screen, or a screen reader (some may send the text to the company that made the voice).';

    /** one reading at a time for the page: `it.card` the card read or waited for, `it.reset` its button's label back */
    function cancel(it) {
        const reset = it.reset;
        it.card = null; it.waiting = false; it.reset = null;
        it.reader.stop();
        if (reset) { reset(); }
    }

    /** one reader for the page's cards (`win` the page's window); null without dist/sim/reader.js */
    function cardReader(win) {
        if (win.__evnCardReader !== undefined) { return win.__evnCardReader; }
        const R = win.EVNReader;
        let hooks = null;
        const reader = R && typeof R.Reader === 'function' && typeof R.cardBlocks === 'function' ? new R.Reader(win, (win.document.documentElement.lang || 'en'), {
            voice: () => '', rate: () => 1,
            reduced: () => { try { return win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } },
            changed: (state) => { if (hooks) { hooks.changed(state); } },
            noVoice: () => { if (hooks) { hooks.noVoice(); } },
        }) : null;
        const it = reader ? { reader, cardBlocks: R.cardBlocks, card: null, waiting: false, reset: null, set(h) { hooks = h; } } : null;
        win.__evnCardReader = it;
        if (it) {
            const doc = win.document;
            // Escape stops speech wherever the focus is (§4.2); while it reads, that is all the key does: the document hears it
            // before sim.js's window listeners (a selected robot let go, a pick, the map builder), which it does not reach
            doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && it.card) { cancel(it); e.stopPropagation(); } });
            // leaving the page stops speech (§4.2): the panel hidden (another editor's tab in front)
            doc.addEventListener('visibilitychange', () => { if (doc.hidden && it.card) { cancel(it); } });
        }
        return it;
    }

    /** the Read aloud button of card `cardId`; `say` the page's say() (the no-voice line) */
    function readButton(doc, el, cardId, say) {
        const win = doc.defaultView;
        const btn = el('button', { class: 'btn', type: 'button', id: `${cardId}Read`, title: 'Read this card aloud with a voice built into this device (pressed again, or Escape, stops)' }, READ);
        const label = (t) => { btn.textContent = t; };
        /** the line under the button's row that names the device's routes: shown only after a press found no voice */
        const note = () => {
            let n = doc.getElementById(`${cardId}NoVoice`);
            if (!n && btn.parentElement) { n = el('div', { class: 'row', id: `${cardId}NoVoice`, hidden: '' }, NO_VOICE_LINE); btn.parentElement.after(n); }
            return n;
        };
        const noVoice = () => { label(NO_VOICE); const n = note(); if (n) { n.hidden = false; } say(NO_VOICE_LINE); };
        btn.onclick = () => {
            const it = cardReader(win);
            if (!it) { noVoice(); return; }
            if (it.card === cardId) { cancel(it); return; }
            cancel(it);
            const n = note(); if (n) { n.hidden = true; }
            it.card = cardId; it.waiting = true; it.reset = () => label(READ);
            label(STOP_READ);
            it.set({
                changed: (state) => { if (state === 'idle' && it.card === cardId && !it.waiting) { it.card = null; it.reset = null; label(READ); } },
                noVoice: () => { cancel(it); noVoice(); },
            });
            void it.reader.ready().then((ok) => {
                if (it.card !== cardId || !it.waiting) { return; }      // cancelled during the wait, or another card's press
                it.waiting = false;
                if (!ok) { cancel(it); noVoice(); return; }
                const card = doc.getElementById(cardId);
                const blocks = card && !card.hidden ? it.cardBlocks(win, card) : [];
                if (!blocks.length) { cancel(it); return; }
                it.reader.read(blocks);
            });
        };
        return btn;
    }
    /** stops a card's reading (Close, a new job): only when it is that card's */
    function stopReading(doc, cardId) {
        const it = doc.defaultView.__evnCardReader;
        if (it && it.card === cardId) { cancel(it); }
    }

    root.EVNCard = { ChallengeCard, CheckCard, ENDS, region, sayer, parseBox, poseText, poseSentence, wrap180, readButton, stopReading, NO_VOICE, NO_VOICE_LINE };
})(typeof self !== 'undefined' ? self : this);
