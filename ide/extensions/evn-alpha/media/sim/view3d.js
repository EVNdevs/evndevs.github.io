/* The Simulator panel's 3D view (media/sim/sim.js turns it on with its "3D" button): the course and the robot as the
 * world has them, drawn with WebGL - the tiles at their heights with their paint on them (a ramp's slope, a raised
 * tile's sides, a bridge's slab on its pillars, a seesaw at its tilt), the obstacles, speed bumps and debris, and the
 * robot at its height, pitch and roll, its wheels, sensors and distance sensors' beams.
 *
 * The camera orbits a point (drag to turn it, Shift+drag or a right drag to move it, scroll to zoom) or follows the
 * robot from behind. Everything is built from the worker's geom message (the course, its world3d) and redrawn on each
 * snapshot; it draws nothing the 2D view does not know.
 *
 * Units: mm, the world frame x right / y up (seen from above), z up.
 */
(function () {
    'use strict';

    /* ---- 4 x 4 matrices, column-major (WebGL's) ---------------------------------------------------------------- */
    const M4 = {
        id() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
        mul(a, b) {
            const o = new Array(16);
            for (let c = 0; c < 4; c++) {
                for (let r = 0; r < 4; r++) {
                    let s = 0;
                    for (let k = 0; k < 4; k++) { s += a[k * 4 + r] * b[c * 4 + k]; }
                    o[c * 4 + r] = s;
                }
            }
            return o;
        },
        persp(fovy, aspect, near, far) {
            const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
            return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
        },
        look(eye, at, up) {
            const z = norm(sub(eye, at)), x = norm(cross(up, z)), y = cross(z, x);
            return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
        },
        trans(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; },
        scale(x, y, z) { return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]; },
        rz(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
        ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
        rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
        chain(...ms) { return ms.reduce((a, b) => M4.mul(a, b)); },
    };
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
    /** the rotation part of a matrix, for the normals (the scales here are positive; good enough for shading) */
    function rot3(m) { return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]; }

    const VS = `
attribute vec3 p; attribute vec3 n; attribute vec2 uv;
uniform mat4 mvp; uniform mat3 nm;
varying vec3 vn; varying vec2 vuv;
void main() { gl_Position = mvp * vec4(p, 1.0); vn = nm * n; vuv = uv; }`;
    const FS = `
precision mediump float;
uniform vec3 color; uniform float alpha; uniform sampler2D tex; uniform float useTex; uniform vec3 light;
varying vec3 vn; varying vec2 vuv;
void main() {
    float d = max(dot(normalize(vn), light), 0.0);
    vec3 c = useTex > 0.5 ? texture2D(tex, vuv).rgb : color;
    gl_FragColor = vec4(c * (0.58 + 0.42 * d), alpha);
}`;

    function hex(c) { const v = parseInt(c.slice(1), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; }

    /** A mesh: interleaved position (3), normal (3), uv (2) triangles */
    class Mesh {
        constructor(gl, data) { this.gl = gl; this.buf = gl.createBuffer(); this.n = 0; if (data) { this.set(data); } }
        set(data) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW); this.n = data.length / 8; }
    }

    /* geometry builders: arrays of triangles (x y z nx ny nz u v) */
    function quad(out, a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const n = norm(cross(sub(b, a), sub(d, a)));
        const v = [a, b, c, d];
        for (const k of [0, 1, 2, 0, 2, 3]) { out.push(...v[k], ...n, ...uv[k]); }
    }
    function boxData() {
        const o = [], h = 0.5;
        const P = (x, y, z) => [x * h, y * h, z * h];
        quad(o, P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1));
        quad(o, P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1), P(-1, -1, -1));
        quad(o, P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1));
        quad(o, P(1, 1, -1), P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1));
        quad(o, P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1));
        quad(o, P(-1, 1, -1), P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1));
        return o;
    }
    /** a cylinder of radius 1 and length 1 along z, centred */
    function cylData(n = 24) {
        const o = [];
        for (let k = 0; k < n; k++) {
            const a0 = 2 * Math.PI * k / n, a1 = 2 * Math.PI * (k + 1) / n;
            const p0 = [Math.cos(a0), Math.sin(a0)], p1 = [Math.cos(a1), Math.sin(a1)];
            const v = [[p0[0], p0[1], -0.5], [p1[0], p1[1], -0.5], [p1[0], p1[1], 0.5], [p0[0], p0[1], 0.5]];
            const nn = [[p0[0], p0[1], 0], [p1[0], p1[1], 0], [p1[0], p1[1], 0], [p0[0], p0[1], 0]];
            for (const i of [0, 1, 2, 0, 2, 3]) { o.push(...v[i], ...nn[i], 0, 0); }
            o.push(0, 0, 0.5, 0, 0, 1, 0, 0, p0[0], p0[1], 0.5, 0, 0, 1, 0, 0, p1[0], p1[1], 0.5, 0, 0, 1, 0, 0);
            o.push(0, 0, -0.5, 0, 0, -1, 0, 0, p1[0], p1[1], -0.5, 0, 0, -1, 0, 0, p0[0], p0[1], -0.5, 0, 0, -1, 0, 0);
        }
        return o;
    }

    const ALONG = [[0, 1], [-1, 0], [0, -1], [1, 0]];

    class View3D {
        constructor(canvas) {
            this.canvas = canvas;
            // what render() reads of the page, kept until it can change (performance ledger HT-62) so a frame forces no
            // style or layout: the canvas's box (a ResizeObserver drops it, and asks for a frame) and the stage's colour
            // (the theme: the body's class and style, the root's)
            this.rect = null; this.rectDpr = 0; this.bg = null;
            this.keep = typeof ResizeObserver !== 'undefined' && typeof MutationObserver !== 'undefined';
            if (this.keep) {
                new ResizeObserver(() => { this.rect = null; this.bg = null; if (this.onChange) { this.onChange(); } }).observe(canvas);
                const mo = new MutationObserver(() => { this.bg = null; if (this.onChange) { this.onChange(); } });
                mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
                if (document.body) { mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] }); }
            }
            const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
            this.gl = gl;
            if (!gl) { return; }
            const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); } return s; };
            const pr = gl.createProgram();
            gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
            gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
            gl.linkProgram(pr);
            this.pr = pr;
            this.loc = {};
            for (const a of ['p', 'n', 'uv']) { this.loc[a] = gl.getAttribLocation(pr, a); }
            for (const u of ['mvp', 'nm', 'color', 'alpha', 'tex', 'useTex', 'light']) { this.loc[u] = gl.getUniformLocation(pr, u); }
            this.box = new Mesh(gl, boxData());
            this.cyl = new Mesh(gl, cylData());
            this.dyn = new Mesh(gl);
            this.white = this.texture(Object.assign(document.createElement('canvas'), { width: 2, height: 2 }));
            this.cam = { tx: 0, ty: 0, tz: 0, yaw: -2.2, elev: 0.75, dist: 2400 };
            this.follow = false;
            this.statics = [];
            this.hw = undefined;
            this.geom = undefined;
            this.snap = undefined;
            this.drag = undefined;
            canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); this.drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2, cam: { ...this.cam } }; });
            canvas.addEventListener('pointermove', (e) => {
                const d = this.drag;
                if (!d) { return; }
                const dx = e.clientX - d.x, dy = e.clientY - d.y;
                if (d.pan) {
                    // the point moves against the drag: across the view for a sideways drag, along it (on the floor) for
                    // a drag up or down
                    const k = this.cam.dist / 700;
                    const c = Math.cos(this.cam.yaw), s = Math.sin(this.cam.yaw);
                    this.cam.tx = d.cam.tx + k * (s * dx - c * dy);
                    this.cam.ty = d.cam.ty - k * (c * dx + s * dy);
                    this.follow = false;
                } else {
                    this.cam.yaw = d.cam.yaw - dx * 0.008;
                    this.cam.elev = Math.max(0.05, Math.min(1.5, d.cam.elev + dy * 0.006));
                }
                this.onChange && this.onChange();
            });
            canvas.addEventListener('pointerup', () => { this.drag = undefined; });
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.cam.dist = Math.max(150, Math.min(20000, this.cam.dist * Math.exp(e.deltaY * 0.0015)));
                this.onChange && this.onChange();
            }, { passive: false });
        }

        get ok() { return !!this.gl; }

        texture(cv) {
            const gl = this.gl, t = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
            const pot = (v) => (v & (v - 1)) === 0;
            if (pot(cv.width) && pot(cv.height)) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
            else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); }
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return t;
        }

        /** the paint of a rect of the floor (the pieces given, or every piece) drawn into a canvas */
        paintCanvas(rect, pieces, px) {
            const [x0, y0, x1, y1] = rect;
            const w = Math.max(2, Math.min(4096, Math.round((x1 - x0) * px))), h = Math.max(2, Math.min(4096, Math.round((y1 - y0) * px)));
            const cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
            const c = cv.getContext('2d');
            c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
            c.setTransform(w / (x1 - x0), 0, 0, -h / (y1 - y0), -x0 * w / (x1 - x0), y1 * h / (y1 - y0));
            for (const p of pieces) {
                c.save();
                if (p.clip) { c.beginPath(); c.rect(p.clip[0], p.clip[1], p.clip[2] - p.clip[0], p.clip[3] - p.clip[1]); c.clip(); }
                c.strokeStyle = p.css; c.fillStyle = p.css; c.lineWidth = p.w; c.lineCap = 'butt'; c.lineJoin = p.join || 'round';
                c.beginPath();
                if (p.kind === 'arc') { c.arc(p.c[0], p.c[1], p.r, p.a0, p.a1, p.a1 < p.a0); } else { p.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); }
                if (p.kind === 'fill') { c.fill(); } else { c.stroke(); }
                c.restore();
            }
            return cv;
        }

        /** a new course: its static meshes (the floor, the tiles that do not move, the pillars) */
        setGeom(geom) {
            this.geom = geom;
            const gl = this.gl;
            if (!gl) { return; }
            for (const s of this.statics) { gl.deleteBuffer(s.mesh.buf); if (s.tex && s.tex !== this.white) { gl.deleteTexture(s.tex); } }
            this.statics = [];
            const b = geom.bounds;
            const w3 = geom.world3d;
            const tiles = geom.tiles || [];
            // the floor around the course
            const fl = [];
            quad(fl, [b[0] - 3000, b[1] - 3000, -0.5], [b[2] + 3000, b[1] - 3000, -0.5], [b[2] + 3000, b[3] + 3000, -0.5], [b[0] - 3000, b[3] + 3000, -0.5]);
            if (!tiles.length) {
                // a named course: its paint on one sheet
                const k = Math.min(1.2, 4096 / Math.max(b[2] - b[0], b[3] - b[1]));
                this.statics.push({ mesh: new Mesh(gl, fl), color: hex('#d9dadc') });
                const t = [];
                quad(t, [b[0], b[1], 0], [b[2], b[1], 0], [b[2], b[3], 0], [b[0], b[3], 0]);
                this.statics.push({ mesh: new Mesh(gl, t), tex: this.texture(this.paintCanvas(b, geom.paint, k)) });
            } else {
                this.statics.push({ mesh: new Mesh(gl, fl), color: hex('#d9dadc') });
                tiles.forEach((t, i) => {
                    if (t.seesaw) { return; }   // drawn each frame at its tilt
                    const k = w3 ? w3.tileSurface[i] : -1;
                    const sf = k >= 0 ? w3.surfaces[k] : undefined;
                    const top = (x, y) => (sf ? sf.a + sf.bx * x + sf.by * y : 0.4);
                    this.tileMesh(t, i, top, sf ? (sf.thick > 0 ? sf.thick : Infinity) : 0, false);
                });
            }
            // the speed bumps: their crest's arc, with the paint under them on it (the line crosses a bump black)
            for (const sf of w3 ? w3.surfaces : []) {
                if (sf.kind !== 'bump') { continue; }
                const m = this.bumpMesh(sf);
                if (!m) { continue; }
                const xs = sf.poly.map((p) => p[0]), ys = sf.poly.map((p) => p[1]);
                const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
                // the paint of the tile it lies on (not a bridge's over it)
                const cx = (rect[0] + rect[2]) / 2, cy = (rect[1] + rect[3]) / 2, base = sf.a + sf.bx * cx + sf.by * cy;
                const level = (t) => { const k = w3.tileSurface[t] ?? -1; const q = k >= 0 ? w3.surfaces[k] : undefined; return q ? q.a + q.bx * cx + q.by * cy : 0; };
                const under = (geom.paint || []).filter((p) => p.tile === undefined || p.tile === null || Math.abs(level(p.tile) - base) < 40);
                this.statics.push({ mesh: new Mesh(gl, m.data), tex: this.texture(this.paintCanvas(rect, under, Math.min(4, 1024 / Math.max(rect[2] - rect[0], rect[3] - rect[1])))) });
            }
            this.home();
        }

        /** a tile: its top with its paint, and its sides down to what it stands on (`thick` under its top: a slab) */
        tileMesh(t, i, top, thick, dynamic) {
            const gl = this.gl;
            const [x0, y0, x1, y1] = t.rect;
            const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
            const z = c.map(([x, y]) => top(x, y));
            const out = [];
            quad(out, [x0, y0, z[0]], [x1, y0, z[1]], [x1, y1, z[2]], [x0, y1, z[3]]);
            const sides = [];
            if (thick > 0) {
                const bot = (zz) => (isFinite(thick) ? zz - thick : 0);
                for (let e = 0; e < 4; e++) {
                    const a = c[e], b2 = c[(e + 1) % 4], za = z[e], zb = z[(e + 1) % 4];
                    if (za < 0.6 && zb < 0.6) { continue; }
                    quad(sides, [a[0], a[1], bot(za)], [b2[0], b2[1], bot(zb)], [b2[0], b2[1], zb], [a[0], a[1], za]);
                }
                if (isFinite(thick)) { quad(sides, [x0, y1, z[3] - thick], [x1, y1, z[2] - thick], [x1, y0, z[1] - thick], [x0, y0, z[0] - thick]); }
            }
            let tex = this.white;
            if (!dynamic) {
                const own = (this.geom.paint || []).filter((p) => p.tile === i);
                tex = this.texture(this.paintCanvas(t.rect, own, Math.min(1.7, 1024 / Math.max(x1 - x0, y1 - y0))));
                this.statics.push({ mesh: new Mesh(gl, out), tex });
                if (sides.length) { this.statics.push({ mesh: new Mesh(gl, sides), color: hex(t.ramp ? '#c8c2b6' : '#d6d0c4') }); }
            }
            return { out, sides };
        }

        /** the camera over the course */
        home() {
            const b = this.geom.bounds;
            this.cam.tx = (b[0] + b[2]) / 2; this.cam.ty = (b[1] + b[3]) / 2; this.cam.tz = 0;
            this.cam.dist = Math.max(900, 0.9 * Math.max(b[2] - b[0], b[3] - b[1]));
            this.cam.yaw = -Math.PI / 2 - 0.5; this.cam.elev = 0.8;
        }

        setHw(hw, body) { this.hw = hw; this.body = body; }

        setSnap(snap) { this.snap = snap; }

        draw(mvp, model, color, opts = {}) {
            const gl = this.gl, L = this.loc;
            const mesh = opts.mesh || this.box;
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
            gl.vertexAttribPointer(L.p, 3, gl.FLOAT, false, 32, 0);
            gl.vertexAttribPointer(L.n, 3, gl.FLOAT, false, 32, 12);
            gl.vertexAttribPointer(L.uv, 2, gl.FLOAT, false, 32, 24);
            gl.uniformMatrix4fv(L.mvp, false, new Float32Array(M4.mul(mvp, model)));
            gl.uniformMatrix3fv(L.nm, false, new Float32Array(rot3(model)));
            gl.uniform3fv(L.color, color || [1, 1, 1]);
            gl.uniform1f(L.alpha, opts.alpha ?? 1);
            gl.uniform1f(L.useTex, opts.tex ? 1 : 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, opts.tex || this.white);
            gl.uniform1i(L.tex, 0);
            gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
        }

        render() {
            const gl = this.gl;
            if (!gl || !this.geom) { return; }
            const cv = this.canvas, dpr = window.devicePixelRatio || 1;
            if (!this.keep || !this.rect || this.rectDpr !== dpr) { this.rect = cv.getBoundingClientRect(); this.rectDpr = dpr; }
            const r = this.rect;
            const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
            if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
            gl.viewport(0, 0, W, H);
            if (!this.keep || this.bg === null) { this.bg = getComputedStyle(document.body).getPropertyValue('--stage').trim() || '#e9e9eb'; }
            const bg = this.bg;
            const [br, bgc, bb] = hex(bg.length === 7 ? bg : '#e9e9eb');
            gl.clearColor(br, bgc, bb, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.useProgram(this.pr);
            for (const a of ['p', 'n', 'uv']) { gl.enableVertexAttribArray(this.loc[a]); }
            gl.uniform3fv(this.loc.light, norm([0.35, -0.45, 1]));
            const s = this.snap;
            // the camera: following the robot from behind and above, or orbiting its point
            const cam = this.cam;
            if (this.follow && s) {
                cam.tx = s.pose.x; cam.ty = s.pose.y; cam.tz = s.pose.z || 0;
                const want = (s.pose.heading * Math.PI / 180) + Math.PI;
                let d = want - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
                cam.yaw += d * 0.15;
            }
            const eye = [cam.tx + cam.dist * Math.cos(cam.elev) * Math.cos(cam.yaw), cam.ty + cam.dist * Math.cos(cam.elev) * Math.sin(cam.yaw), cam.tz + cam.dist * Math.sin(cam.elev)];
            const proj = M4.persp(50 * Math.PI / 180, W / H, Math.max(5, cam.dist / 200), cam.dist * 20 + 20000);
            const vp = M4.mul(proj, M4.look(eye, [cam.tx, cam.ty, cam.tz], [0, 0, 1]));
            const I = M4.id();
            for (const st of this.statics) { this.draw(vp, I, st.color, { mesh: st.mesh, tex: st.tex }); }
            const w3 = this.geom.world3d;
            const hz = s && s.hazards;
            if (w3) {
                // the seesaws at their tilt
                const tiles = this.geom.tiles || [];
                w3.seesaws.forEach((q, k) => {
                    const t = tiles[q.tile];
                    const deg = hz && hz.seesaws.length === w3.seesaws.length ? hz.seesaws[k] : 15;
                    const tn = Math.tan(deg * Math.PI / 180), tm = Math.tan((this.seesawDeg || 15) * Math.PI / 180);
                    const zh = q.z0 + (this.seesawT || 3) + 150 * tm;
                    const top = (x, y) => zh + tn * ((x - q.cx) * q.ax + (y - q.cy) * q.ay);
                    if (!q.tex) { q.tex = this.texture(this.paintCanvas(t.rect, this.geom.paint.filter((p) => p.tile === q.tile), 1.7)); }
                    const m = this.tileMesh(t, q.tile, top, 3, true);
                    this.dyn.set(m.out); this.draw(vp, I, null, { mesh: this.dyn, tex: q.tex });
                    this.dyn.set(m.sides); this.draw(vp, I, hex('#b9a98a'), { mesh: this.dyn });
                    // its hinge block
                    this.draw(vp, M4.chain(M4.trans(q.cx, q.cy, (zh - 3) / 2), M4.rz(Math.atan2(q.ay, q.ax) + Math.PI / 2), M4.scale(280, 20, Math.max(1, zh - 3))), hex('#8d8676'));
                });
                // the debris (the bumps are static meshes)
                const debS = w3.surfaces.filter((x) => x.kind === 'debris');
                const deb = hz && hz.debris.length === debS.length ? hz.debris : debS.map((x) => x.poly);
                deb.forEach((p, k) => this.lying(vp, p, debS[k], hex('#b8935a')));
                // the obstacles and the pillars
                w3.blocks.forEach((bk, k) => {
                    // where it is now (a snapshot of another course can come in between: then where the map put it)
                    const at = (hz && hz.blocks.length === w3.blocks.length && hz.blocks[k]) || bk.at || [0, 0, 0, 0];
                    const xs = bk.local.map((p) => p[0]), ys = bk.local.map((p) => p[1]);
                    const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...ys) - Math.min(...ys);
                    const cylinder = bk.local.length > 4;
                    const m = M4.chain(M4.trans(at[0], at[1], at[3] + bk.h / 2), M4.rz(at[2] * Math.PI / 180), M4.scale(cylinder ? w / 2 : w, cylinder ? d / 2 : d, bk.h));
                    this.draw(vp, m, hex(bk.kind === 'pillar' ? '#9a9ea3' : bk.fixed ? '#7d3b30' : '#b5523b'), { mesh: cylinder ? this.cyl : this.box });
                });
            }
            if (s && this.hw) { this.robot(vp, s); }
        }

        /** a speed bump's top: its circular segment over its outline, each point's paint the floor's under it (uv: its
     *  place seen from above in the outline's bounding box) */
    bumpMesh(sf) {
        const p = sf.poly, a = p[0], b = p[1], d = p[3];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), wid = Math.hypot(d[0] - a[0], d[1] - a[1]);
        if (len < 1 || wid < 1) { return undefined; }
        const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, vx = (d[0] - a[0]) / wid, vy = (d[1] - a[1]) / wid;
        const h = sf.h || 1, half = wid / 2, R = (half * half + h * h) / (2 * h);
        const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
        const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
        const pt = (s, t) => {
            const across = (t - 0.5) * wid;
            const x = a[0] + ux * s * len + vx * (t * wid), y = a[1] + uy * s * len + vy * (t * wid);
            const z = sf.a + sf.bx * x + sf.by * y + Math.max(0, Math.sqrt(Math.max(0, R * R - across * across)) - (R - h));
            return { x, y, z, n: norm([vx * across, vy * across, Math.sqrt(Math.max(0, R * R - across * across))]), uv: [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)] };
        };
        const data = [];
        const N = 10;
        for (let k = 0; k < N; k++) {
            const q = [pt(0, k / N), pt(1, k / N), pt(1, (k + 1) / N), pt(0, (k + 1) / N)];
            for (const i of [0, 1, 2, 0, 2, 3]) { data.push(q[i].x, q[i].y, q[i].z + 0.3, ...q[i].n, ...q[i].uv); }
        }
        return { data };
    }

    /** a speed bump or a piece of debris: a cylinder lying along its outline's long side, its crest at its height */
        lying(vp, poly, sf, color) {
            if (!poly || poly.length < 4 || !sf) { return; }
            const a = poly[0], b = poly[1], d = poly[3];
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]), wid = Math.hypot(d[0] - a[0], d[1] - a[1]);
            const cx = (a[0] + poly[2][0]) / 2, cy = (a[1] + poly[2][1]) / 2;
            const h = sf.h || wid, half = wid / 2;
            const R = (half * half + h * h) / (2 * h);
            const base = sf.a + sf.bx * cx + sf.by * cy;
            const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
            // the cylinder's axis along the bump (x after the turn): a cylinder mesh lies along z, so turn it onto x
            const m = M4.chain(M4.trans(cx, cy, base + h - R), M4.rz(ang), M4.ry(Math.PI / 2), M4.scale(R, R, len));
            this.draw(vp, m, color, { mesh: this.cyl });
        }

        robot(vp, s) {
            const hw = this.hw, b = this.body, db = hw.driveBase, p = s.pose;
            const r = db.wheelDiameter / 2;
            const base = M4.chain(M4.trans(p.x, p.y, p.z || 0), M4.rz(p.heading * Math.PI / 180), M4.ry(-(p.pitch || 0) * Math.PI / 180), M4.rx((p.roll || 0) * Math.PI / 180));
            const part = (x, y, z, sx, sy, sz, color, mesh, extra) => this.draw(vp, M4.chain(base, M4.trans(x, y, z), ...(extra || []), M4.scale(sx, sy, sz)), hex(color), { mesh: mesh || this.box });
            const len = b.front + b.rear, top = b.height;
            // the body: a deck at the clearance, the board and battery on it
            part((b.front - b.rear) / 2, 0, b.clearance + 6, len, b.width, 12, '#2a2f34');
            part(-b.rear * 0.25, 0, Math.min(top - 10, b.clearance + 30), len * 0.55, b.width * 0.7, Math.max(8, Math.min(40, top - b.clearance - 20)), '#3d454d');
            part(-b.rear * 0.25, 0, top - 4, len * 0.45, b.width * 0.55, 8, '#a8977b');
            // the wheels (a cylinder lies along z: turned onto y)
            for (const side of [1, -1]) {
                part(0, side * db.axleTrack / 2, r, r, r, b.tyre, '#16191c', this.cyl, [M4.rx(Math.PI / 2)]);
                part(0, side * (db.axleTrack / 2 - b.tyre / 2 - 6), r, 8, 8, 12, '#c9b99c', this.cyl, [M4.rx(Math.PI / 2)]);
            }
            // the caster
            part(b.caster, 0, 8, 8, 8, 8, '#9aa0a6', this.cyl, [M4.rx(Math.PI / 2)]);
            // the colour sensors, lit by what they read
            for (const c of hw.colorSensors) {
                const rd = s.sensors.find((x) => x.port === c.port);
                const v = rd ? Math.max(0, Math.min(100, rd.value[0])) / 100 : 1;
                part(c.forward, c.left, c.height + 3, 14, 14, 6, '#eb6834');
                const g = Math.round((0.2 + 0.8 * v) * 255).toString(16).padStart(2, '0');
                part(c.forward, c.left, c.height + 0.3, 8, 8, 0.6, `#${g}${g}${g}`);
            }
            for (const d of hw.distanceSensors || []) {
                part(d.forward, d.left, d.height, 10, 20, 12, '#eb6834', undefined, [M4.rz(d.angle * Math.PI / 180)]);
            }
            if (hw.imu) { part(0, 0, top, 22, 22, 4, '#5f9e88'); }
            // the distance sensors' beams
            for (const d of s.distance || []) {
                if (!d.from || !d.to) { continue; }
                const dx = d.to[0] - d.from[0], dy = d.to[1] - d.from[1], dz = d.to[2] - d.from[2];
                const l = Math.hypot(dx, dy, dz);
                if (l < 1) { continue; }
                const m = M4.chain(M4.trans((d.from[0] + d.to[0]) / 2, (d.from[1] + d.to[1]) / 2, (d.from[2] + d.to[2]) / 2), M4.rz(Math.atan2(dy, dx)), M4.ry(-Math.asin(dz / l)), M4.scale(l, 2, 2));
                this.draw(vp, m, hex('#eb6834'), { alpha: d.range === null ? 0.25 : 0.8 });
            }
        }
    }

    window.EVN3D = { create: (canvas) => new View3D(canvas) };
})();
