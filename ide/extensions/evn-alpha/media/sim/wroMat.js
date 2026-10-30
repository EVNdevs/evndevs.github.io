/* The user's WRO mat in the Simulator panel (docs/SIMULATOR_WRO_DESIGN.md §3.2, increment W1b): the loader, on its own
 * so scripts/test_wro_mat.js loads this very file under the panel's own CSP.
 *
 * - pdf.js (dist/sim/pdf.js, a classic script: its `pdfjsLib` global) is loaded when a mat is, with the page's nonce;
 *   its worker (dist/sim/pdf.worker.js) runs as a module worker from a blob of its text (the CSP admits workers from
 *   blobs only), one per load, handed to pdf.js as a PDFWorker's port and ended when the load ends (an idle pdf.js
 *   worker holds ~140 MB). Every document is opened with PDF_OPTIONS: no eval, no wasm, no worker fetch, no CMaps,
 *   standard fonts or ICC profile (no cMapUrl / standardFontDataUrl / wasmUrl / iccUrl) - so pdf.js converts DeviceCMYK
 *   by its own formula (CmykICCBasedCS is usable only with wasm and an iccUrl), the formula the schematic's colours and
 *   the traced margins assume (§3.1 6); no image over MAX_IMAGE_PX pixels; the whole render within RENDER_TIMEOUT_MS.
 * - Size: one page whose TrimBox (else pdf.js's page view: the MediaBox within any CropBox) is 2362 x 1143 mm,
 *   +/-1 mm, checked before the render. pdf.js's API has no TrimBox, so it is read from the file's bytes: the last
 *   uncompressed `/TrimBox [...]` (an incremental save appends the current one), used when it lies inside the page;
 *   otherwise the page view is the box.
 * - Render: from the box's top-left at 2 px/mm into a canvas of exactly 4724 x 2286 (a box up to 1 mm larger is
 *   cropped, smaller is padded), white under it.
 * - Identity (§3.2): a generated one-page PDF of the palette's CMYK fills rendered by the same pdf.js with the same
 *   options gives each palette colour's expected sRGB (pdf.js's API has no colour conversion call); each probe side's
 *   colour (the mean of the 3 x 3 pixels around it, as tools/wro/trace_mat.py samples it) passes when it is nearer its
 *   palette colour than that colour's margin - half the distance to the nearest palette colour of another class (the
 *   JSON's `klass`) - and its nearest palette colour is of its own class. Accepted when every side passes; else the
 *   first failing area is named. A file whose sha256 is not the traced one but passes is accepted with a note.
 * - Rasters: the master 1 px/mm RGB raster (each pixel the mean of a 2 x 2 block of the 2 px/mm image, (a + b + c + d
 *   + 2) >> 2 - arithmetic, no canvas scaling) for the engine, a floor texture of at most 4096 px a side ({ w, h, data:
 *   RGBA rows top-down }) for the 3D view and the cameras, and for the 2D view the image at 1 px/mm with its halves (its
 *   mipmaps). The 2 px/mm canvas and its pixels are freed once these are made.
 * - Refusals carry a kind (REFUSAL_KINDS): only a file's own faults (identity, size, pages) forget a stored mat; the
 *   rest (pdf.js or its worker not loaded, a file pdf.js cannot open, an exception, a timeout, an image over the limit,
 *   busy, a program running, the engine's read) keep it. Nothing reaches a copy of the floor while a program runs: a
 *   pick that finishes during a run is refused, the stored mat's render (at the panel's opening) is held and put on
 *   the floor at the next idle(), and one that could not start for a run is rendered then.
 *
 * Nothing is stored here: the host keeps the PDF's bytes (src/sim/wroMatStore.ts) once a mat is accepted.
 */
(function (root) {
    'use strict';

    const PT_MM = 25.4 / 72;
    /** the 2D view's image: px per mm */
    const PX_MM = 2;
    /** the 3D view's and the cameras' floor texture: at most this many px a side */
    const TEX_MAX = 4096;
    /** the 2D view's mipmaps stop below this width */
    const MIP_MIN = 600;
    /** mm: the mat's size may differ by this much (§3.2) */
    const SIZE_TOL = 1;

    /** px: an image larger than this is refused (pdf.js's maxImageSize; WRO's largest: 2953 x 2953 = 8.7 Mpx) */
    const MAX_IMAGE_PX = 1e8;
    /** ms: a load's render (open, page, palette, identity, rasters) longer than this is refused and its worker ended */
    const RENDER_TIMEOUT_MS = 60000;

    /** pdf.js's options for every document (§3.2): pdf.js kept off its ICC and wasm paths, no eval, nothing fetched, no
     *  image over MAX_IMAGE_PX decoded (pdf.js leaves such an image out silently - with stopAtErrors too, which then
     *  empties the page's whole operator list without an error - so largestImage() refuses the file first, by its kind) */
    const PDF_OPTIONS = Object.freeze({
        isEvalSupported: false, useWasm: false, useWorkerFetch: false, useSystemFonts: false, disableFontFace: true,
        enableXfa: false, stopAtErrors: false, maxImageSize: MAX_IMAGE_PX, verbosity: 0,
    });

    /** A refusal's kind: `forgets` - the file itself is not the mat (a stored one is forgotten); otherwise it is kept */
    const REFUSAL_KINDS = Object.freeze({
        identity: { forgets: true }, size: { forgets: true }, pages: { forgets: true },
        pdf: { forgets: false }, load: { forgets: false }, error: { forgets: false }, timeout: { forgets: false },
        limit: { forgets: false }, busy: { forgets: false }, running: { forgets: false }, engine: { forgets: false },
    });

    /* ---- a minimal PDF writer: the palette page here, the test mats in scripts/test_wro_mat.js ------------------ */

    const num = (v) => { const s = (Math.round(v * 10000) / 10000).toFixed(4).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };
    /** a DeviceCMYK fill colour operator */
    const cmykFill = (c) => `${num(c[0])} ${num(c[1])} ${num(c[2])} ${num(c[3])} k`;

    /** A PDF of `pages` ({ w, h (pt), trim?: [x0, y0, x1, y1] (pt), content: the content stream's text, images?: [{ name,
     *  w, h, jpeg: bytes }] - DCT images drawn by the content's `/name Do` }) as bytes. */
    function pdfBytes(pages) {
        const enc = new TextEncoder();
        const objs = [];          // each object's bytes, numbered from 1
        const add = (parts) => { objs.push(parts); return objs.length; };
        const catalog = add(null), tree = add(null);
        const kids = [];
        for (const p of pages) {
            const xo = [];
            for (const im of p.images || []) {
                const id = add([enc.encode(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`), im.jpeg, enc.encode('\nendstream')]);
                xo.push(`/${im.name} ${id} 0 R`);
            }
            const body = enc.encode(p.content);
            const content = add([enc.encode(`<< /Length ${body.length} >>\nstream\n`), body, enc.encode('\nendstream')]);
            const trim = p.trim ? ` /TrimBox [${p.trim.map(num).join(' ')}]` : '';
            const res = xo.length ? ` /Resources << /XObject << ${xo.join(' ')} >> >>` : ' /Resources << >>';
            kids.push(add([enc.encode(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${num(p.w)} ${num(p.h)}]${trim}${res} /Contents ${content} 0 R >>`)]));
        }
        objs[catalog - 1] = [enc.encode(`<< /Type /Catalog /Pages ${tree} 0 R >>`)];
        objs[tree - 1] = [enc.encode(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`)];
        const chunks = [enc.encode('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')];
        let at = chunks[0].length;
        const offs = [];
        objs.forEach((parts, i) => {
            offs.push(at);
            for (const c of [enc.encode(`${i + 1} 0 obj\n`), ...parts, enc.encode('\nendobj\n')]) { chunks.push(c); at += c.length; }
        });
        const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
            + `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${at}\n%%EOF\n`;
        chunks.push(enc.encode(xref));
        const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
        let o = 0;
        for (const c of chunks) { out.set(c, o); o += c.length; }
        return out;
    }

    /** the palette page (§3.2): each palette CMYK a 20 pt square, one column, top first */
    const SWATCH = 20;
    function palettePdf(palette) {
        const h = SWATCH * palette.length;
        const content = palette.map((p, j) => `${cmykFill(p.cmyk)} 0 ${num(h - SWATCH * (j + 1))} ${SWATCH} ${SWATCH} re f`).join('\n');
        return pdfBytes([{ w: SWATCH, h, content }]);
    }

    /* ---- pdf.js ---------------------------------------------------------------------------------------------- */

    let libPromise;
    /** pdf.js, its script loaded once: { pdf: its script's URL, worker: its worker's URL, nonce: the page's script nonce } */
    function loadPdfjs(urls) {
        libPromise ??= (async () => {
            if (!root.pdfjsLib) {
                await new Promise((res, rej) => {
                    const s = document.createElement('script');
                    if (urls.nonce) { s.nonce = urls.nonce; }
                    s.src = urls.pdf;
                    s.onload = () => res();
                    s.onerror = () => rej(new Error('pdf.js did not load'));
                    document.head.append(s);
                });
            }
            const lib = root.pdfjsLib;
            if (!lib || typeof lib.getDocument !== 'function' || typeof lib.PDFWorker !== 'function') { throw new Error('pdf.js did not load'); }
            return lib;
        })();
        libPromise.catch(() => { libPromise = undefined; });
        return libPromise;
    }

    /** the worker's text as a blob URL, fetched once per URL (a failed fetch is tried again next time) */
    const workerBlobs = new Map();
    function workerBlob(url) {
        let p = workerBlobs.get(url);
        if (!p) {
            p = (async () => {
                const r = await fetch(url);
                if (!r.ok) { throw new Error(`pdf.worker.js: ${r.status}`); }
                return URL.createObjectURL(new Blob([await r.text()], { type: 'text/javascript' }));
            })();
            workerBlobs.set(url, p);
            p.catch(() => { if (workerBlobs.get(url) === p) { workerBlobs.delete(url); } });
        }
        return p;
    }

    /** A pdf.js worker of its own (one per load): { worker (pdf.js's PDFWorker, for getDocument), destroy() - the
     *  PDFWorker destroyed and its module worker terminated, so nothing of pdf.js stays resident after the load } */
    async function pdfWorker(lib, urls) {
        const port = new Worker(await workerBlob(urls.worker), { type: 'module', name: 'EVN pdf.js' });
        let worker;
        try { worker = new lib.PDFWorker({ port, verbosity: 0 }); } catch (e) { port.terminate(); throw e; }
        let done = false;
        return { worker, destroy() { if (done) { return; } done = true; try { worker.destroy(); } finally { port.terminate(); } } };
    }

    /** a document opened with the panel's options in `worker` (a PDFWorker; pdf.js takes the bytes it is given: a copy) */
    function openPdf(lib, bytes, worker) { return lib.getDocument({ data: bytes.slice(), worker, ...PDF_OPTIONS }).promise; }

    /** a PDF's bytes as text, one char a byte (the scans below) */
    const pdfText = (bytes) => (typeof bytes === 'string' ? bytes : new TextDecoder('latin1').decode(bytes));

    /** The page's TrimBox as the file's bytes (or pdfText) state it (pt): the last uncompressed `/TrimBox [...]` (an
     *  incremental save appends the current one), when it lies inside `view` (the page's view, pt); else null */
    function trimBoxOf(bytes, view) {
        const text = pdfText(bytes);
        const re = /\/TrimBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/g;
        let last = null;
        for (const m of text.matchAll(re)) { last = m; }
        if (!last) { return null; }
        const v = last.slice(1, 5).map(Number);
        const b = [Math.min(v[0], v[2]), Math.min(v[1], v[3]), Math.max(v[0], v[2]), Math.max(v[1], v[3])];
        const e = 0.01;
        if (view && !(b[0] >= view[0] - e && b[1] >= view[1] - e && b[2] <= view[2] + e && b[3] <= view[3] + e && b[2] > b[0] && b[3] > b[1])) { return null; }
        return b;
    }

    /** The largest image XObject the file's bytes (or pdfText) state, as a generator: one pass over the text's `obj`,
     *  `endobj`, `stream` and `/Subtype /Image` tokens (linear: each object's dictionary - from its `obj` to the next
     *  token, at most 8 KB - is read once, and a `/Subtype /Image` in stream data, after `stream`, is skipped), yielding
     *  every 4096 tokens so a caller can let the page breathe. Returns { w, h, px } (px 0: none). An image is a stream,
     *  and a stream's dictionary is never in an object stream, so each image dictionary is in the bytes as written; its
     *  direct /Width and /Height are read. An indirect one, a name written with #xx escapes, or an inline image is left
     *  to pdf.js's maxImageSize, which drops the image from the render (the identity check then decides). */
    function* imageScan(bytes) {
        const text = pdfText(bytes);
        let best = { w: 0, h: 0, px: 0 }, obj = -1, inDict = false, pending = false, n = 0;
        const num = (dict, k) => { const q = dict.match(new RegExp(`/${k}\\s+(\\d+)(?!\\d)(?!\\s+\\d+\\s+R)`)); return q ? Number(q[1]) : 0; };
        const finish = (end) => {
            if (!pending) { return; }
            pending = false;
            const dict = text.slice(obj, Math.min(end, obj + 8192));
            const w = num(dict, 'Width'), h = num(dict, 'Height');
            if (w * h > best.px) { best = { w, h, px: w * h }; }
        };
        for (const m of text.matchAll(/\bobj\b|\bendobj\b|\bstream\b|\/Subtype\s*\/Image\b/g)) {
            if ((++n & 4095) === 0) { yield n; }
            const t = m[0];
            if (t === 'obj') { finish(m.index); obj = m.index; inDict = true; } else if (t === 'endobj' || t === 'stream') { finish(m.index); inDict = false; } else if (inDict && m.index - obj <= 4096) { pending = true; }
        }
        finish(text.length);
        return best;
    }

    /** imageScan run to its end at once (Node, a test) */
    function largestImage(bytes) {
        const g = imageScan(bytes);
        for (;;) { const r = g.next(); if (r.done) { return r.value; } }
    }

    /** imageScan on the page: a macrotask break whenever 30 ms have gone (the render's timer can fire, the panel stays
     *  live); stop.stopped (the load timed out) ends it */
    async function largestImageAsync(bytes, stop) {
        const g = imageScan(bytes);
        let t = performance.now();
        for (;;) {
            const r = g.next();
            if (r.done) { return r.value; }
            if (performance.now() - t > 30) {
                await new Promise((res) => setTimeout(res, 0));
                if (stop && stop.stopped) { throw new Error('the load was stopped'); }
                t = performance.now();
            }
        }
    }

    /** the share of an image's pixels (sampled: every 97th) equal to its commonest sampled pixel - near 1: a blank or a
     *  uniform render (a canvas that failed without throwing, pdf.js leaving out what it could not decode) */
    function uniformShare(im) {
        const d = im.data, n = im.w * im.h, counts = new Map();
        let total = 0, top = 0;
        for (let i = 0; i < n; i += 97) {
            const o = 4 * i, k = ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;
            const c = (counts.get(k) || 0) + 1;
            counts.set(k, c);
            if (c > top) { top = c; }
            total++;
        }
        return total ? top / total : 1;
    }
    /** a render this uniform is a fault of the render, not a mat (WRO's mats: their commonest colour, the green ground,
     *  well under half) */
    const BLANK_SHARE = 0.98;

    /** A page rendered: its box (pt) from its top-left at `scale` px / pt into a canvas of canvas2d(w, h), white under
     *  it; size [w, h] px fixes the canvas (else the box's own size, rounded) */
    async function renderBox(lib, page, box, scale, canvas2d, size) {
        const view = page.view;
        const vp = page.getViewport({ scale, offsetX: -(box[0] - view[0]) * scale, offsetY: -(view[3] - box[3]) * scale });
        const [w, h] = size || [Math.round((box[2] - box[0]) * scale), Math.round((box[3] - box[1]) * scale)];
        const cv = canvas2d(w, h);
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        await page.render({ canvas: cv, canvasContext: ctx, viewport: vp, background: '#ffffff', annotationMode: lib.AnnotationMode.DISABLE }).promise;
        return cv;
    }

    /** a canvas's pixels released (its backing store) */
    const free = (cv) => { if (cv) { cv.width = 0; cv.height = 0; } };

    /** the palette's sRGB as this pdf.js renders it (§3.2), in `worker` */
    async function paletteColours(lib, palette, canvas2d, worker) {
        const doc = await openPdf(lib, palettePdf(palette), worker);
        try {
            const page = await doc.getPage(1);
            const cv = await renderBox(lib, page, page.view, 1, canvas2d);
            const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data;
            free(cv);
            return palette.map((_, j) => { const o = ((SWATCH * j + SWATCH / 2) * SWATCH + SWATCH / 2) * 4; return [d[o], d[o + 1], d[o + 2]]; });
        } finally { await doc.loadingTask.destroy(); }
    }

    /* ---- identity ------------------------------------------------------------------------------------------- */

    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

    /** each palette colour's margin: half its distance to the nearest palette colour of another class */
    function margins(pal, klass) {
        return pal.map((p, j) => { let m = Infinity; pal.forEach((q, k) => { if (klass[k] !== klass[j]) { m = Math.min(m, dist(p, q)); } }); return m / 2; });
    }

    /** the mean colour of the 3 x 3 pixels around (x, y) mm (y up) of an image at PX_MM ({ w, h, data: RGBA }) */
    function sampleAt(img, x, y) {
        const col = Math.floor(x * PX_MM), row = Math.floor(img.h - y * PX_MM);
        if (!(col >= 1 && col < img.w - 1 && row >= 1 && row < img.h - 1)) { return null; }
        const s = [0, 0, 0];
        for (let dr = -1; dr <= 1; dr++) { for (let dc = -1; dc <= 1; dc++) { const o = ((row + dr) * img.w + col + dc) * 4; s[0] += img.data[o]; s[1] += img.data[o + 1]; s[2] += img.data[o + 2]; } }
        return [s[0] / 9, s[1] / 9, s[2] / 9];
    }

    /** The probes checked on an image of the mat (§3.2): { ok, sides, failed: [{ region, edge, side, d, margin, own,
     *  near }], first (the first failing area), worst (the largest distance / margin), checks: [{ region, edge, side,
     *  d, margin }] }. `pal`: the palette's rendered sRGB, in the JSON's palette order. */
    function identify(img, pal, identity) {
        const key = (c) => c.map((v) => String(v)).join(',');
        const at = new Map(identity.palette.map((p, j) => [key(p.cmyk), j]));
        const klass = identity.palette.map((p) => p.klass);
        const marg = margins(pal, klass);
        const failed = [], checks = [];
        let worst = 0;
        for (const p of identity.probes) {
            for (const [side, pt, cmyk] of [['inside', p.inside, p.inside_cmyk], ['outside', p.outside, p.outside_cmyk]]) {
                const j = at.get(key(cmyk));
                if (j === undefined) { throw new Error(`WRO identity: a probe colour not in the palette (${p.region} ${p.edge})`); }
                const c = sampleAt(img, pt[0], pt[1]);
                let near = -1, dn = Infinity;
                if (c) { pal.forEach((q, k) => { const d = dist(c, q); if (d < dn) { dn = d; near = k; } }); }
                const d = c ? dist(c, pal[j]) : Infinity;
                const ok = !!c && d < marg[j] && klass[near] === klass[j];
                worst = Math.max(worst, d / marg[j]);
                checks.push({ region: p.region, edge: p.edge, side, d, margin: marg[j] });
                if (!ok) { failed.push({ region: p.region, edge: p.edge, side, d, margin: marg[j], own: j, near }); }
            }
        }
        return { ok: failed.length === 0, sides: checks.length, edges: identity.probes.length, failed, first: failed.length ? failed[0].region : '', worst, checks };
    }

    /* ---- rasters -------------------------------------------------------------------------------------------- */

    /** the master 1 px/mm RGB raster of a 2 px/mm RGBA image: each pixel the mean of its 2 x 2 block, rounded half up */
    function masterRaster(img) {
        const W = img.w >> 1, H = img.h >> 1, d = img.data, out = new Uint8Array(W * H * 3);
        for (let r = 0; r < H; r++) {
            const a = (2 * r) * img.w * 4, b = (2 * r + 1) * img.w * 4;
            for (let i = 0; i < W; i++) {
                const p = a + 8 * i, q = b + 8 * i, o = (r * W + i) * 3;
                out[o] = (d[p] + d[p + 4] + d[q] + d[q + 4] + 2) >> 2;
                out[o + 1] = (d[p + 1] + d[p + 5] + d[q + 1] + d[q + 5] + 2) >> 2;
                out[o + 2] = (d[p + 2] + d[p + 6] + d[q + 2] + d[q + 6] + 2) >> 2;
            }
        }
        return out;
    }

    /** a canvas drawn into another at w x h (the browser's smoothing: for display only, never the engine's raster) */
    function scaled(src, w, h, canvas2d) {
        const cv = canvas2d(w, h), c = cv.getContext('2d', { willReadFrequently: true });
        c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
        c.drawImage(src, 0, 0, w, h);
        return cv;
    }

    /** the floor texture of an image (a canvas): at most TEX_MAX px a side, { w, h, data: RGBA rows top-down } */
    function floorTexture(src, canvas2d) {
        const k = Math.min(1, TEX_MAX / Math.max(src.width, src.height));
        const w = Math.round(src.width * k), h = Math.round(src.height * k);
        const cv = k === 1 ? src : scaled(src, w, h, canvas2d);
        const data = new Uint8Array(cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data.buffer);
        if (cv !== src) { free(cv); }
        return { w, h, data };
    }

    /** the 2D view's levels: the image (a canvas), then each half of the last down to MIP_MIN px wide */
    function mipmaps(src, canvas2d) {
        const out = [src];
        for (let l = src; l.width / 2 >= MIP_MIN;) { l = scaled(l, Math.round(l.width / 2), Math.round(l.height / 2), canvas2d); out.push(l); }
        return out;
    }

    /** the schematic's floor (the engine's 1 px/mm RGB raster, rows top-down): a canvas and its texture */
    function schematicFloor(rgb, w, h, canvas2d) {
        const rgba = new Uint8ClampedArray(w * h * 4);
        for (let i = 0, o = 0; i < w * h; i++, o += 4) { rgba[o] = rgb[3 * i]; rgba[o + 1] = rgb[3 * i + 1]; rgba[o + 2] = rgb[3 * i + 2]; rgba[o + 3] = 255; }
        const cv = canvas2d(w, h);
        cv.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
        return { mips: mipmaps(cv, canvas2d), texture: floorTexture(cv, canvas2d) };
    }

    async function sha256Hex(bytes) {
        const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        return Array.from(d, (v) => v.toString(16).padStart(2, '0')).join('');
    }

    /* ---- the panel's mat -------------------------------------------------------------------------------------- */

    const errText = (e) => String((e && e.message) || e);

    /** p raced against ms: rejected then with an Error whose `timeout` is true, and stop.stopped set (the render it
     *  abandons ends at its next check, R2-N3) */
    function within(p, ms, stop) {
        let t;
        const late = new Promise((_, rej) => { t = setTimeout(() => { if (stop) { stop.stopped = true; } const e = new Error(`the render took over ${Math.round(ms / 1000)} s`); e.timeout = true; rej(e); }, ms); });
        return Promise.race([p, late]).finally(() => clearTimeout(t));
    }

    /** The mat of the WRO course (one at a time). opts: wro (cfg.wro: { size, sha256, identity }), urls ({ pdf, worker,
     *  nonce }), canvas2d(w, h), running() (a program runs: nothing reaches the floor then), host ({ keep(sha256),
     *  refused(picked), forget() }: the extension's storage; `picked` is the sha256 the host gave a picked file),
     *  onChange(state | null) (every copy of the floor follows it), checkRaster(rgb) (the engine's own scale check,
     *  dist/sim/wroscale.js: throws for a raster the engine cannot read - checked before any copy changes); tests only:
     *  renderTimeoutMs, inspect(im) (the 2 px/mm image's { w, h, data } before it is checked and freed). */
    class WroMat {
        constructor(opts) {
            this.o = opts;
            /** the accepted mat: { sha256, traced, note, mips, raster, texture, result, ms } or null */
            this.state = null;
            this.busy = false;
            /** the last load's or forget's outcome: { ok, kind?, message, ... } */
            this.last = null;
            /** the stored mat rendered while a program ran (S1): put on the floor at the next idle() */
            this.held = null;
            /** the stored mat's bytes, its render not started for a running program: rendered at the next idle() */
            this.retry = null;
        }

        /** a stored mat waits for the run to end (idle() puts it on the floor) */
        get waiting() { return !!(this.held || this.retry); }

        /** a copy of the master raster for the engine (slice: the worker's own), or null */
        rasterCopy() { return this.state ? this.state.raster.slice(0) : null; }

        /** A refusal of `kind` (REFUSAL_KINDS) as load() resolves it: a picked file is dropped by the host; a stored one is
         *  forgotten only when the file itself is not the mat, else kept (and said so); held: it waits for idle() */
        refusal(kind, message, extra, { stored, picked }) {
            const k = REFUSAL_KINDS[kind] || REFUSAL_KINDS.error;
            let msg = message, forgot = false;
            if (!stored) { this.o.host.refused(picked); }
            else if (extra.held) { /* the message says when it goes on the floor */ }
            else if (k.forgets) { this.o.host.forget(); forgot = true; msg += ' The mat you loaded before is forgotten.'; }
            else { msg += ' The mat you loaded before is kept: it is rendered again when the panel next opens.'; }
            return (this.last = { ok: false, kind, message: msg, forgot, ...extra });
        }

        /** Load a PDF's bytes (stored: the host's kept file, re-rendered at the panel's opening; picked: the sha256 the
         *  host gave a picked file). Resolves to { ok, kind? (a refusal's), message, first?, result?, ms?, held? }; a
         *  refusal keeps whatever floor there was. busy is set before the first await. */
        async load(bytes, { stored = false, picked } = {}) {
            const o = this.o, ctx = { stored, picked };
            const refuse = (kind, message, extra = {}) => this.refusal(kind, message, extra, ctx);
            if (o.running()) {
                if (stored) { this.retry = bytes; return refuse('running', 'The mat you loaded before goes on the floor when the program ends.', { held: true }); }
                return refuse('running', 'A mat cannot be loaded while a program runs: stop it first.');
            }
            if (this.busy) { return refuse('busy', 'A mat is being rendered already: load this one when that one is done.'); }
            // the user's own pick replaces a stored mat still waiting for a run's end
            if (!stored) { this.held = null; this.retry = null; }
            this.busy = true;
            let pw = null;
            try {
                const t0 = performance.now();
                try { const lib = await loadPdfjs(o.urls); pw = await pdfWorker(lib, o.urls); pw.lib = lib; } catch (e) {
                    return refuse('load', `pdf.js could not be started (${errText(e)}).`);
                }
                let out, renders = 0;
                const once = async () => {
                    renders++;
                    const stop = { stopped: false };
                    return within(this.render(pw.lib, pw.worker, bytes, t0, stop), o.renderTimeoutMs ?? RENDER_TIMEOUT_MS, stop);
                };
                try {
                    out = await once();
                    // a stored file failing its identity (R2-S3): the traced file passes these probes by construction, so
                    // its failure is the render's (kept); any other stored file is rendered once more before it is forgotten
                    if (stored && out.refuse === 'identity' && out.sha256 !== o.wro.sha256) { out = await once(); }
                } catch (e) {
                    if (e && e.timeout) { return refuse('timeout', `The mat could not be rendered: ${errText(e)}.`); }
                    return refuse('error', `The mat could not be rendered: ${errText(e)}`);
                }
                if (out.refuse === 'identity' && stored && out.sha256 === o.wro.sha256) {
                    return refuse('error', `${out.message.replace(/ The schematic stays\.$/, '')}: but this is the traced file, so the render is at fault, not the file. The schematic stays.`, { ...out.extra, renders });
                }
                if (out.refuse) { return refuse(out.refuse, out.message, { ...out.extra, renders }); }
                // a program started during the render: nothing reaches the floor under its run (S1)
                if (o.running()) {
                    if (stored) { this.held = out.state; return refuse('running', 'The mat you loaded before is ready: it goes on the floor when the program ends.', { held: true }); }
                    return refuse('running', 'A program started while the mat rendered: load it again when it ends (the floor under the run stays).');
                }
                return Object.assign(this.commit(out.state, ctx), { renders });
            } finally {
                if (pw) { pw.destroy(); }
                this.busy = false;
            }
        }

        /** the render and the checks: { state } or { refuse: kind, message, extra, sha256 }; stop.stopped (the load timed
         *  out) ends it at its next step */
        async render(lib, worker, bytes, t0, stop) {
            const o = this.o;
            const chk = () => { if (stop && stop.stopped) { throw new Error('the load was stopped'); } };
            const sha256 = await sha256Hex(bytes);
            let doc;
            try { doc = await openPdf(lib, bytes, worker); } catch (e) { return { refuse: 'pdf', message: `That file is not a PDF pdf.js can read (${errText(e)}).` }; }
            try {
                if (doc.numPages !== 1) { return { refuse: 'pages', message: `That PDF has ${doc.numPages} pages: a WRO mat's printing file has one.` }; }
                const page = await doc.getPage(1);
                const text = pdfText(bytes);
                const trim = page.rotate === 0 ? trimBoxOf(text, page.view) : null;
                const box = trim || page.view;
                let wmm = (box[2] - box[0]) * PT_MM, hmm = (box[3] - box[1]) * PT_MM;
                if (page.rotate % 180) { [wmm, hmm] = [hmm, wmm]; }
                const [W, H] = o.wro.size;
                if (Math.abs(wmm - W) > SIZE_TOL || Math.abs(hmm - H) > SIZE_TOL) {
                    return { refuse: 'size', message: `That page is ${wmm.toFixed(1)} x ${hmm.toFixed(1)} mm (its ${trim ? 'TrimBox' : 'MediaBox; no TrimBox inside the page found'}): the WRO RoboMission Junior 2026 mat is ${W} x ${H} mm.`, extra: { size: [wmm, hmm] } };
                }
                const big = await largestImageAsync(text, stop);
                if (big.px > MAX_IMAGE_PX) { return { refuse: 'limit', message: `That PDF has an image of ${big.w} x ${big.h} px, over ${MAX_IMAGE_PX / 1e6} million pixels: a WRO mat's printing file has none.` }; }
                // the mat's own size in px whatever the box's (+/-1 mm): cropped or padded white at the right and the bottom
                chk();
                const img = await renderBox(lib, page, page.rotate === 0 ? box : page.view, PX_MM * PT_MM, o.canvas2d, [PX_MM * W, PX_MM * H]);
                chk();
                const tRender = performance.now();
                const pal = await paletteColours(lib, o.wro.identity.palette, o.canvas2d, worker);
                chk();
                const im = { w: img.width, h: img.height, data: img.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, img.width, img.height).data };
                if (o.inspect) { o.inspect(im); }
                // a blank or uniform render is the render's fault (transient), never a reason to forget a file (R2-S3)
                const uni = uniformShare(im);
                if (uni >= BLANK_SHARE) {
                    free(img);
                    return { refuse: 'error', sha256, message: `The mat rendered blank (${(100 * uni).toFixed(1)} % of it one colour): a render fault, not the file.`, extra: { uniform: uni } };
                }
                const result = identify(im, pal, o.wro.identity);
                if (!result.ok) {
                    free(img);
                    const f = result.failed[0];
                    return { refuse: 'identity', sha256, message: `Not the WRO RoboMission Junior 2026 mat: the area "${f.region}" is not where or as the traced mat has it (its ${f.edge} edge, ${f.side}; ${result.failed.length} of ${result.sides} probe sides differ). The schematic stays.`, extra: { first: f.region, result, pal } };
                }
                const traced = sha256 === o.wro.sha256;
                // the rasters, then the 2 px/mm canvas freed (its pixels: 43 MB, and its ImageData as much)
                const raster = masterRaster(im);
                // the engine's own scale check on the raster, here, before any copy changes (R2-S2): the engine reads it
                // in its worker, where a refusal would come after the 3D view, the cameras and the store had the mat
                try {
                    if (typeof o.checkRaster !== 'function') { throw new Error('the floor check (wroscale.js) did not load'); }
                    o.checkRaster(raster);
                } catch (e) {
                    free(img);
                    return { refuse: 'engine', sha256, message: `That mat's floor could not be read: ${errText(e)}` };
                }
                const texture = floorTexture(img, o.canvas2d), half = scaled(img, W, H, o.canvas2d);
                free(img);
                return { state: {
                    sha256, traced, raster, mips: mipmaps(half, o.canvas2d), texture, result, pal,
                    note: traced ? '' : `Not the traced file: a re-export or a revision; scoring areas checked at ${result.edges} edges.`,
                    ms: { render: tRender - t0, total: performance.now() - t0 },
                } };
            } finally { await doc.loadingTask.destroy(); }
        }

        /** a rendered mat onto every copy of the floor (no program runs); the engine refusing its raster keeps the floor */
        commit(state, ctx) {
            const o = this.o, prev = this.state;
            this.state = state;
            // every copy follows (the engine measures its scale's ends on the raster: one it cannot read is refused)
            try { o.onChange(state); } catch (e) {
                this.state = prev;
                try { o.onChange(prev); } catch { this.state = null; o.onChange(null); }
                return this.refusal('engine', `That mat's floor could not be read: ${errText(e)}`, {}, ctx);
            }
            if (!ctx.stored) { o.host.keep(state.sha256); }
            return (this.last = { ok: true, message: state.note || 'The WRO mat is on the floor.', result: state.result, pal: state.pal, ms: state.ms, traced: state.traced });
        }

        /** No program runs now (sim.js, at each idle): the stored mat held for a run put on the floor, or rendered now
         *  when its render could not start then (N6). Resolves to what load() would, or null (nothing waited). */
        async idle() {
            if (this.busy || this.o.running()) { return null; }
            if (this.held) { const s = this.held; this.held = null; this.retry = null; return this.commit(s, { stored: true }); }
            if (this.retry) { const b = this.retry; this.retry = null; return this.load(b, { stored: true }); }
            return null;
        }

        /** Forget WRO mat: the stored file deleted and every copy dropped (the panel's here; onChange(null) the rest);
         *  refused while a program runs or a mat renders (its pick would be lost) */
        forget() {
            if (this.o.running()) { return (this.last = { ok: false, kind: 'running', message: 'The mat cannot be forgotten while a program runs: stop it first.' }); }
            if (this.busy) { return (this.last = { ok: false, kind: 'busy', message: 'The mat cannot be forgotten while one renders: forget it when it is done.' }); }
            this.held = null; this.retry = null;
            this.state = null;
            this.o.host.forget();
            this.o.onChange(null);
            return (this.last = { ok: true, message: 'The WRO mat is forgotten: the schematic is on the floor.' });
        }
    }

    /** Every copy of the WRO floor outside the loader, kept in step with it (sim.js; scripts/test_wro_mat.js drives the
     *  same object): the simulation worker's raster (`wro-floor`; init and course messages carry `fields()`), the 3D
     *  view's and the cameras' floor texture, the 2D view's image. The floor is the mat when one is loaded, else the
     *  schematic (once the simulation worker has sent it), else none. opts: post(message, transfer) to the simulation
     *  worker, view3d() (the 3D view or null), camWorker() (the camera worker or null), redraw(). */
    class FloorLink {
        constructor(mat, opts) {
            this.mat = mat;
            this.o = opts;
            this.schem = null;
            this.ver = 0;
        }

        /** the schematic's raster from the simulation worker (wro-schematic) */
        schematic(rgb, w, h, canvas2d) {
            if (!this.schem) { this.schem = schematicFloor(rgb, w, h, canvas2d); this.apply(); }
        }

        /** what the floor is now: { mat, mips (the 2D view's levels, the image first), texture } or null */
        current() {
            const s = this.mat.state;
            if (s) { return { mat: true, mips: s.mips, texture: s.texture }; }
            return this.schem ? { mat: false, mips: this.schem.mips, texture: this.schem.texture } : null;
        }

        /** the fields an init or a course message carries (a copy of the mat's raster, transferred), and its transfer list */
        fields() {
            const r = this.mat.rasterCopy();
            return r ? { fields: { wroRaster: r }, transfer: [r.buffer] } : { fields: {}, transfer: [] };
        }

        /** the textures and the image again (a mat loaded or forgotten, the schematic come, the camera worker started) */
        apply() {
            const c = this.current();
            const tex = c ? c.texture : null;
            this.ver++;
            const v3 = this.o.view3d();
            if (v3) { v3.setFloor(tex); }
            const cw = this.o.camWorker();
            if (cw) { cw.postMessage({ op: 'floor', floor: tex }); }
            this.o.redraw();
        }

        /** the loader's onChange: the engine's raster (or the schematic) and every other copy */
        changed() {
            const r = this.mat.rasterCopy();
            this.o.post({ type: 'wro-floor', raster: r }, r ? [r.buffer] : []);
            this.apply();
        }
    }

    root.EVNWroMat = { WroMat, FloorLink, PDF_OPTIONS, REFUSAL_KINDS, MAX_IMAGE_PX, RENDER_TIMEOUT_MS, PX_MM, TEX_MAX, pdfWorker, pdfBytes, palettePdf, cmykFill, loadPdfjs, openPdf, trimBoxOf, largestImage, largestImageAsync, uniformShare, renderBox, paletteColours, identify, margins, sampleAt, masterRaster, floorTexture, mipmaps, schematicFloor, sha256Hex };
})(typeof self !== 'undefined' ? self : this);
