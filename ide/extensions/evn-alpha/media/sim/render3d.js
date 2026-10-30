/* The 3D scene of the Simulator panel, without the page: the course and the robot as the world has them, drawn with
 * WebGL into whatever context it is given - the 3D view's (media/sim/view3d.js, the DOM shell: its canvas, its orbit
 * camera, the theme's background) and each virtual camera's (src/sim/camWorker.ts, an OffscreenCanvas in a Web Worker,
 * docs/SIMULATOR_SBC_DESIGN.md §2.4: one scene builder, so a camera sees exactly what the 3D view shows).
 *
 * Nothing here touches document, window or the page's style: 2D canvases (the paint textures) come from the
 * `canvas2d(w, h)` the caller gives (document.createElement('canvas') in the page, OffscreenCanvas in a worker), and
 * frame(vp, W, H, bg) draws with the view-projection, size and background the caller computed.
 *
 * Options: `mip` (a camera: every texture mipmapped - any size on WebGL 2, with EXT_texture_filter_anisotropic where the
 * GPU has it; on WebGL 1 the paint is drawn at power-of-two sizes so mipmaps exist), `showCams` (the 3D view: each
 * camera's frustum; a camera never sees the frusta, nor the distance sensors' beams).
 *
 * The WRO course's floor (docs/SIMULATOR_WRO_DESIGN.md §3.2): a geometry with `floor` (the mat's rect, mm) is drawn as
 * one textured sheet over that rect from setFloor()'s texture - the loaded mat's, or the schematic's (the panel's
 * media/sim/wroMat.js makes both, at most 4096 px a side) - white while it has none.
 *
 * The WRO game objects (§4.2, §4.4; increment W4): a geometry whose world3d has `games` draws each object brick by brick -
 * world3d.gameMeshes[its `mesh`] (src/sim/engine/gameMesh.ts: the objects file's mesh.boxes, the model's frame), one
 * static mesh per model and colour, built once per course (setGeom) - posed each frame from the snapshot's
 * hazards.games (x, y, yaw, base height z0: a lifted, stacked or held object where the snapshot puts it; plan-only
 * physics, so never tipped) with one model matrix per object written into scratch arrays: the objects' pass allocates
 * nothing per frame. A course without game objects draws exactly what it drew before (the pass is skipped).
 *
 * Units: mm, the world frame x right / y up (seen from above), z up.
 */
(function (root) {
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
    /** the mesh primitive of the game objects (W4): an axis-aligned box [x0, x1] x [y0, y1] x [z0, z1] (a brick of
     *  gameMesh.ts's mesh.boxes, no studs), its six faces outward as boxData's, appended to out */
    function boxInto(out, x0, y0, z0, x1, y1, z1) {
        const P = (x, y, z) => [x < 0 ? x0 : x1, y < 0 ? y0 : y1, z < 0 ? z0 : z1];
        quad(out, P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1));
        quad(out, P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1), P(-1, -1, -1));
        quad(out, P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1));
        quad(out, P(1, 1, -1), P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1));
        quad(out, P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1));
        quad(out, P(-1, 1, -1), P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1));
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

    /** a sphere of radius 1, centred (a loose ball, bodies.ts) */
    function sphData(n = 12) {
        const o = [], P = (i, j) => { const t = Math.PI * i / n, f = 2 * Math.PI * j / (2 * n); return [Math.sin(t) * Math.cos(f), Math.sin(t) * Math.sin(f), Math.cos(t)]; };
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < 2 * n; j++) {
                const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
                for (const k of [0, 1, 2, 0, 2, 3]) { o.push(...q[k], ...q[k], 0, 0); }
            }
        }
        return o;
    }

    const ALONG = [[0, 1], [-1, 0], [0, -1], [1, 0]];

    const D2R = Math.PI / 180;
    const pow2 = (v) => { let p = 2; while (p < v && p < 4096) { p *= 2; } return p; };

    /* A stroked piece's ends (a line's first / last point, an arc's at a0 / a1), and whether two pieces are one stroke:
     * the same kind of stroke (line or arc, not a fill), colour, width, join and clip, the second starting where the
     * first ends (0.01 mm). Such a run is drawn as one path: two butt-capped strokes meeting at a point each cover an
     * edge texel partly, and together leave it grey - a seam across the line at every piece joint of a named course
     * (review rcjcam r1, should-fix 1). Nothing is lengthened (the rules' gaps stay as drawn: their ends do not meet). */
    const PIECE_EPS = 0.01;
    function pieceEnds(p) {
        if (p.kind === 'arc') { return [[p.c[0] + p.r * Math.cos(p.a0), p.c[1] + p.r * Math.sin(p.a0)], [p.c[0] + p.r * Math.cos(p.a1), p.c[1] + p.r * Math.sin(p.a1)]]; }
        return [p.pts[0], p.pts[p.pts.length - 1]];
    }
    const sameClip = (a, b) => (!a && !b) || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]));
    function continues(a, b) {
        if (a.kind === 'fill' || b.kind === 'fill' || a.css !== b.css || a.w !== b.w || (a.join || 'round') !== (b.join || 'round') || !sameClip(a.clip, b.clip)) { return false; }
        if (a.kind !== 'arc' && !(a.pts && a.pts.length)) { return false; }
        if (b.kind !== 'arc' && !(b.pts && b.pts.length)) { return false; }
        const e = pieceEnds(a)[1], s = pieceEnds(b)[0];
        return Math.abs(e[0] - s[0]) <= PIECE_EPS && Math.abs(e[1] - s[1]) <= PIECE_EPS;
    }

    class Scene3D {
        /** gl: a WebGL 1 or 2 context; opts.canvas2d(w, h): a canvas with a 2D context (the paint); opts.mip, opts.showCams */
        constructor(gl, opts = {}) {
            this.gl = gl;
            this.canvas2d = opts.canvas2d;
            this.showCams = !!opts.showCams;
            this.gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
            this.mip = !!opts.mip;
            // the paint's pieces that continue one another stroked as one path (pieceEnds above); false: each piece on its
            // own, as before review rcjcam r1 (scripts/test_camera.js compares that with the old view3d.js)
            this.joinPaint = opts.joinPaint !== false;
            // a camera: the floor's painted tops in cells of at most `cell` mm. A camera 120 mm over the floor passes
            // over tile corners; a corner within the near plane of the lens projects thousands of pixels off the
            // target, and one big triangle from it drew its paint 2.4 px off (SwiftShader, scripts/test_camera.js: a
            // corner 0.3 mm in front of the lens plane); a 50 mm cell keeps such a triangle out of the picture
            this.cell = this.mip ? 50 : 0;
            this.aniso = this.mip ? gl.getExtension('EXT_texture_filter_anisotropic') : null;
            this.anisoMax = this.aniso ? Math.min(16, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) : 0;
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
            this.sph = new Mesh(gl, sphData());
            this.dyn = new Mesh(gl);
            // painted white (review W4 r1 S1: an unpainted canvas is transparent black, and the WRO floor drew black with
            // it before its texture came); every other mesh binds it with useTex 0, so nothing else changes
            const wc = this.canvas2d(2, 2), wx = wc.getContext('2d');
            wx.fillStyle = '#ffffff'; wx.fillRect(0, 0, 2, 2);
            this.white = this.texture(wc);
            this.statics = [];
            // each seesaw's paint texture, by its index in geom.world3d.seesaws: this scene's (its context's), never cached on
            // the course's geometry - several scenes (cameras, a view rebuilt after a lost context) share one geom, each in
            // its own context, and a texture is only valid in the context that made it (review rcjcam r2 B1)
            this.seesawTex = new Map();
            this.hw = undefined;
            this.body = undefined;
            this.geom = undefined;
            this.snap = undefined;
            // the WRO floor: { w, h, data: RGBA rows top-down } or null (setFloor)
            this.floor = null;
            // the game objects (setGeom: buildGames): each model's meshes by colour, and per object its groups and start pose
            this.gameMeshes = new Map();
            this.gameDraw = [];
            // the objects' pass's scratch (drawGames): one model-view-projection and normal matrix, rewritten per object
            this.gMvp = new Float32Array(16);
            this.gNm = new Float32Array(9);
        }

        /** a texture of a canvas, or of { w, h, data } (RGBA bytes, rows top-down: the WRO floor) */
        texture(cv) {
            const gl = this.gl, t = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            const W = cv.data ? cv.w : cv.width, H = cv.data ? cv.h : cv.height;
            if (cv.data) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, cv.data); } else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); }
            const pot = (v) => (v & (v - 1)) === 0;
            if (this.mip && (this.gl2 || (pot(W) && pot(H)))) {
                // a camera: mipmaps at any size (WebGL 2), anisotropic where present (the oblique floor, design §2.4)
                gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                if (this.aniso) { gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, this.anisoMax); }
            } else if (pot(W) && pot(H)) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
            else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); }
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return t;
        }

        /** the paint of a rect of the floor (the pieces given, or every piece) drawn into a canvas */
        paintCanvas(rect, pieces, px) {
            const [x0, y0, x1, y1] = rect;
            let w = Math.max(2, Math.min(4096, Math.round((x1 - x0) * px))), h = Math.max(2, Math.min(4096, Math.round((y1 - y0) * px)));
            // WebGL 1 has mipmaps for power-of-two textures only: a camera's paint is drawn at the next power of two
            if (this.mip && !this.gl2) { w = pow2(w); h = pow2(h); }
            const cv = this.canvas2d(w, h);
            const c = cv.getContext('2d');
            c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
            c.setTransform(w / (x1 - x0), 0, 0, -h / (y1 - y0), -x0 * w / (x1 - x0), y1 * h / (y1 - y0));
            for (let i = 0; i < pieces.length; i++) {
                const p = pieces[i];
                c.save();
                if (p.clip) { c.beginPath(); c.rect(p.clip[0], p.clip[1], p.clip[2] - p.clip[0], p.clip[3] - p.clip[1]); c.clip(); }
                c.strokeStyle = p.css; c.fillStyle = p.css; c.lineWidth = p.w; c.lineCap = 'butt'; c.lineJoin = p.join || 'round';
                c.beginPath();
                // this piece, then each next one that continues it (pieceEnds / continues above), as one path
                for (let q = p, first = true; ; first = false) {
                    if (q.kind === 'arc') { c.arc(q.c[0], q.c[1], q.r, q.a0, q.a1, q.a1 < q.a0); } else { q.pts.forEach(([x, y], j) => (j || !first ? c.lineTo(x, y) : c.moveTo(x, y))); }
                    if (p.kind === 'fill' || !this.joinPaint || i + 1 >= pieces.length || !continues(q, pieces[i + 1])) { break; }
                    q = pieces[++i];
                }
                if (p.kind === 'fill') { c.fill(); } else { c.stroke(); }
                c.restore();
            }
            return cv;
        }

        /** the WRO floor's texture ({ w, h, data }, or null: none - the sheet white); the static meshes built again */
        setFloor(floor) {
            this.floor = floor && floor.data ? floor : null;
            if (this.geom) { this.setGeom(this.geom); }
        }

        /** a new course: its static meshes (the floor, the tiles that do not move, the pillars) */
        setGeom(geom) {
            this.geom = geom;
            const gl = this.gl;
            if (!gl) { return; }
            for (const s of this.statics) { gl.deleteBuffer(s.mesh.buf); if (s.tex && s.tex !== this.white) { gl.deleteTexture(s.tex); } }
            this.statics = [];
            for (const t of this.seesawTex.values()) { gl.deleteTexture(t); }
            this.seesawTex.clear();
            const b = geom.bounds;
            const w3 = geom.world3d;
            const tiles = geom.tiles || [];
            // the floor around the course
            const fl = [];
            quad(fl, [b[0] - 3000, b[1] - 3000, -0.5], [b[2] + 3000, b[1] - 3000, -0.5], [b[2] + 3000, b[3] + 3000, -0.5], [b[0] - 3000, b[3] + 3000, -0.5]);
            if (geom.floor) {
                // the WRO table: the mat over its rect (its texture, else white), the floor around it
                const [x0, y0, x1, y1] = geom.floor;
                this.statics.push({ mesh: new Mesh(gl, fl), color: hex('#d9dadc') });
                const t = [];
                this.cells(t, x0, y0, x1, y1, () => 0);
                this.statics.push({ mesh: new Mesh(gl, t), tex: this.floor ? this.texture(this.floor) : this.white });
            } else if (!tiles.length) {
                // a named course: its paint on one sheet
                const k = Math.min(1.2, 4096 / Math.max(b[2] - b[0], b[3] - b[1]));
                this.statics.push({ mesh: new Mesh(gl, fl), color: hex('#d9dadc') });
                const t = [];
                this.cells(t, b[0], b[1], b[2], b[3], () => 0);
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
            this.buildGames(w3);
        }

        /** the game objects' static meshes (W4): each model of w3.gameMeshes once, its boxes grouped by colour (one mesh
         *  per colour: the shader has one colour per draw), and per object of w3.games the groups of its model and where
         *  the geometry laid it. The previous course's meshes deleted. */
        buildGames(w3) {
            const gl = this.gl;
            for (const groups of this.gameMeshes.values()) { for (const g of groups) { gl.deleteBuffer(g.mesh.buf); } }
            this.gameMeshes.clear();
            this.gameDraw = [];
            if (!w3 || !w3.games || !w3.games.length || !w3.gameMeshes) { return; }
            for (const key of Object.keys(w3.gameMeshes)) {
                const byColour = new Map();
                for (const b of w3.gameMeshes[key]) {
                    const c = b[6], ck = `${c[0]},${c[1]},${c[2]}`;
                    let d = byColour.get(ck);
                    if (!d) { d = { rgb: c, data: [] }; byColour.set(ck, d); }
                    boxInto(d.data, b[0], b[1], b[2], b[3], b[4], b[5]);
                }
                const groups = [];
                for (const d of byColour.values()) { groups.push({ mesh: new Mesh(gl, d.data), color: new Float32Array([d.rgb[0] / 255, d.rgb[1] / 255, d.rgb[2] / 255]) }); }
                this.gameMeshes.set(key, groups);
            }
            this.gameDraw = w3.games.map((g) => ({ groups: this.gameMeshes.get(g.mesh) || null, at: g.at }));
        }

        /** a tile: its top with its paint, and its sides down to what it stands on (`thick` under its top: a slab) */
        tileMesh(t, i, top, thick, dynamic) {
            const gl = this.gl;
            const [x0, y0, x1, y1] = t.rect;
            const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
            const z = c.map(([x, y]) => top(x, y));
            const out = [];
            if (this.cell) { this.cells(out, x0, y0, x1, y1, top); } else { quad(out, [x0, y0, z[0]], [x1, y0, z[1]], [x1, y1, z[2]], [x0, y1, z[3]]); }
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

        /** a rect's top as quads of at most this.cell mm (one quad when 0), z from top(x, y), uv over the whole rect */
        cells(out, x0, y0, x1, y1, top) {
            const n = this.cell ? Math.max(1, Math.ceil((x1 - x0) / this.cell)) : 1, m = this.cell ? Math.max(1, Math.ceil((y1 - y0) / this.cell)) : 1;
            for (let j = 0; j < m; j++) {
                for (let i = 0; i < n; i++) {
                    const u0 = i / n, u1 = (i + 1) / n, v0 = j / m, v1 = (j + 1) / m;
                    const xa = x0 + (x1 - x0) * u0, xb = x0 + (x1 - x0) * u1, ya = y0 + (y1 - y0) * v0, yb = y0 + (y1 - y0) * v1;
                    quad(out, [xa, ya, top(xa, ya)], [xb, ya, top(xb, ya)], [xb, yb, top(xb, yb)], [xa, yb, top(xa, yb)], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
                }
            }
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

        /** one frame: the viewport W x H, cleared to `bg` ('#rrggbb'), everything drawn with the view-projection vp */
        frame(vp, W, H, bg) {
            const gl = this.gl;
            if (!gl || !this.geom) { return; }
            gl.viewport(0, 0, W, H);
            const [br, bgc, bb] = hex(bg && bg.length === 7 ? bg : '#e9e9eb');
            gl.clearColor(br, bgc, bb, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.useProgram(this.pr);
            for (const a of ['p', 'n', 'uv']) { gl.enableVertexAttribArray(this.loc[a]); }
            gl.uniform3fv(this.loc.light, norm([0.35, -0.45, 1]));
            const s = this.snap;
            const I = M4.id();
            for (const st of this.statics) { this.draw(vp, I, st.color, { mesh: st.mesh, tex: st.tex }); }
            const w3 = this.geom.world3d;
            const hz = s && s.hazards;
            if (w3) {
                // the seesaws at their tilt
                const tiles = this.geom.tiles || [];
                w3.seesaws.forEach((q, k) => {
                    const t = tiles[q.tile];
                    // its own tilt either way (tiles.ts Seesaw.deg, PlacedTile.incline; absent: cfg.seesaw.deg)
                    const max = q.deg || this.seesawDeg || 15;
                    const deg = hz && hz.seesaws.length === w3.seesaws.length ? hz.seesaws[k] : max;
                    const tn = Math.tan(deg * Math.PI / 180), tm = Math.tan(max * Math.PI / 180);
                    const zh = q.z0 + (this.seesawT || 3) + 150 * tm;
                    const top = (x, y) => zh + tn * ((x - q.cx) * q.ax + (y - q.cy) * q.ay);
                    let tex = this.seesawTex.get(k);
                    if (!tex) { tex = this.texture(this.paintCanvas(t.rect, this.geom.paint.filter((p) => p.tile === q.tile), 1.7)); this.seesawTex.set(k, tex); }
                    const m = this.tileMesh(t, q.tile, top, 3, true);
                    this.dyn.set(m.out); this.draw(vp, I, null, { mesh: this.dyn, tex });
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
                    this.draw(vp, m, hex(bk.color || (bk.kind === 'pillar' ? '#9a9ea3' : bk.fixed ? '#7d3b30' : '#b5523b')), { mesh: cylinder ? this.cyl : this.box });
                });
                // the loose balls, where the snapshot says they are
                (w3.balls || []).forEach((bl, k) => {
                    const at = (hz && hz.balls && hz.balls.length === w3.balls.length && hz.balls[k]) || [bl.x, bl.y, bl.z];
                    this.draw(vp, M4.chain(M4.trans(at[0], at[1], at[2]), M4.scale(bl.r, bl.r, bl.r)), hex(bl.color), { mesh: this.sph });
                });
                // the WRO game objects (W4), where the snapshot says they are; none on today's courses: skipped
                if (this.gameDraw.length) { this.drawGames(vp, hz); }
            }
            if (s && this.hw) { this.robot(vp, s); }
        }

        /** the game objects (W4): each one's model matrix (its place x, y, yaw a and base height z0 - the snapshot's
         *  hazards.games when it has every object, else where the geometry laid them) times vp written into the scratch
         *  gMvp / gNm, then one draw per colour of its model's static meshes. Nothing allocated: plain loops, no closures,
         *  no matrix arrays (M4.mul and draw() allocate; this pass does not). */
        drawGames(vp, hz) {
            const gl = this.gl, L = this.loc, G = this.gameDraw, n = G.length;
            const gz = hz && hz.games && hz.games.length === n ? hz.games : null;
            const mvp = this.gMvp, nm = this.gNm;
            gl.uniform1f(L.alpha, 1);
            gl.uniform1f(L.useTex, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.white);
            gl.uniform1i(L.tex, 0);
            for (let i = 0; i < n; i++) {
                const g = G[i], groups = g.groups;
                if (!groups) { continue; }
                const q = gz ? gz[i] : null;
                const x = q ? q.x : g.at[0], y = q ? q.y : g.at[1], z = q ? q.z0 : (g.at[3] || 0), a = (q ? q.a : g.at[2]) * D2R;
                const c = Math.cos(a), s = Math.sin(a);
                // vp x trans(x, y, z) x rz(a), column-major (M4.trans / M4.rz)
                for (let r = 0; r < 4; r++) {
                    const v0 = vp[r], v1 = vp[4 + r], v2 = vp[8 + r];
                    mvp[r] = v0 * c + v1 * s;
                    mvp[4 + r] = v1 * c - v0 * s;
                    mvp[8 + r] = v2;
                    mvp[12 + r] = v0 * x + v1 * y + v2 * z + vp[12 + r];
                }
                nm[0] = c; nm[1] = s; nm[2] = 0; nm[3] = -s; nm[4] = c; nm[5] = 0; nm[6] = 0; nm[7] = 0; nm[8] = 1;
                gl.uniformMatrix4fv(L.mvp, false, mvp);
                gl.uniformMatrix3fv(L.nm, false, nm);
                for (let k = 0; k < groups.length; k++) {
                    const p = groups[k];
                    gl.bindBuffer(gl.ARRAY_BUFFER, p.mesh.buf);
                    gl.vertexAttribPointer(L.p, 3, gl.FLOAT, false, 32, 0);
                    gl.vertexAttribPointer(L.n, 3, gl.FLOAT, false, 32, 12);
                    gl.vertexAttribPointer(L.uv, 2, gl.FLOAT, false, 32, 24);
                    gl.uniform3fv(L.color, p.color);
                    gl.drawArrays(gl.TRIANGLES, 0, p.mesh.n);
                }
            }
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
            // the mechanisms' parts (src/sim/engine/mechanisms.ts), posed on the chassis as the snapshot says
            for (const [f, l, u, yaw, pitch, sx, sy, sz] of (s.mech && s.mech.boxes) || []) { part(f, l, u, sx, sy, sz, '#4a6fa5', undefined, [M4.rz(yaw * Math.PI / 180), M4.ry(-pitch * Math.PI / 180)]); }
            // the cameras (camera.ts, design §2.1): a board behind the lens (its front 1 mm behind the optical centre, so
            // inside the 5 mm near plane: a camera never sees its own housing)
            const mounts = (hw.cameras || []).map((c) => [c, M4.chain(base, M4.trans(c.forward, c.left, c.height), M4.rz(c.yaw * D2R), M4.ry(c.tilt * D2R), M4.rx(c.roll * D2R))]);
            for (const [, mt] of mounts) { this.draw(vp, M4.chain(mt, M4.trans(-6, 0, 0), M4.scale(10, 25, 24)), hex('#1f6f43')); }
            if (!this.showCams) { return; }   // a camera sees neither the beams nor the frusta
            // the distance sensors' beams
            for (const d of s.distance || []) {
                if (!d.from || !d.to) { continue; }
                const dx = d.to[0] - d.from[0], dy = d.to[1] - d.from[1], dz = d.to[2] - d.from[2];
                const l = Math.hypot(dx, dy, dz);
                if (l < 1) { continue; }
                const m = M4.chain(M4.trans((d.from[0] + d.to[0]) / 2, (d.from[1] + d.to[1]) / 2, (d.from[2] + d.to[2]) / 2), M4.rz(Math.atan2(dy, dx)), M4.ry(-Math.asin(dz / l)), M4.scale(l, 2, 2));
                this.draw(vp, m, hex('#eb6834'), { alpha: d.range === null ? 0.25 : 0.8 });
            }
            // each camera's frustum: its four corner rays, 250 mm long (the pinhole of camera.ts intrinsics(): fx =
            // (W / 2) / tan(hfov / 2), the centre at ((W - 1) / 2, (H - 1) / 2); a ray in the mount frame is x ahead, y left,
            // z up)
            for (const [c, mt] of mounts) {
                const W = c.width, H = c.height_px, f = (W / 2) / Math.tan(c.hfov * D2R / 2), L = 250;
                for (const [u, v] of [[-0.5, -0.5], [W - 0.5, -0.5], [W - 0.5, H - 0.5], [-0.5, H - 0.5]]) {
                    const x = 1, y = -(u - (W - 1) / 2) / f, z = -(v - (H - 1) / 2) / f, l = Math.hypot(x, y, z);
                    const m = M4.chain(mt, M4.rz(Math.atan2(y, x)), M4.ry(-Math.asin(z / l)), M4.trans(L / 2, 0, 0), M4.scale(L, 3, 3));
                    this.draw(vp, m, hex('#2b8cd6'), { alpha: 0.7 });
                }
            }
        }
    }

    root.EVN3DCore = { Scene3D, M4, hex };
})(typeof self !== 'undefined' ? self : globalThis);
