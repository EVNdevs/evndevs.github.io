/* The 3D scene of the Simulator panel, without the page: the course and the robot as the world has them, drawn with
 * WebGL into whatever context it is given - the 3D view's (media/sim/view3d.js, the DOM shell: its canvas, its orbit
 * camera, the theme's background) and each virtual camera's (src/sim/camWorker.ts, an OffscreenCanvas in a Web Worker,
 * docs/SIMULATOR_SBC_DESIGN.md §2.4: one scene builder, so a camera sees exactly what the 3D view shows - but for the
 * robot's models, below: a camera draws the robot drawing's boxes where the 3D view draws the models, SIMULATOR_MODELS_DESIGN.md M5).
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
 * world3d.gameMeshes[its `mesh`] (src/sim/engine/gameMesh.ts: the objects file's mesh.boxes, the model's frame) and its
 * studs, world3d.gameStuds[its `mesh`] when its file has them (a props file, SIMULATOR_PROPS_DESIGN.md §4), each along
 * its own direction (a stood-up Elementary model's sideways studs: SIMULATOR_PROPS_ELEMENTARY.md §5 E-C10, EP-c, D150),
 * and its pieces, world3d.gamePieces[its `mesh`] (EP-c, D151: a pin's collar and shaft and a hose piece as capped 12-gon
 * cylinders, a knuckle as its prism), one static mesh per model and colour, built once per course (setGeom) - posed each frame from the snapshot's
 * hazards.games (x, y, yaw, base height z0: a lifted, stacked or held object where the snapshot puts it; a frame that
 * carries q - an engine body, SIMULATOR_ENGINE_DESIGN.md §2.7 - at trans(x, y, z) rot(q)) with one model matrix per object written into scratch arrays: the objects' pass allocates
 * nothing per frame. A course without game objects draws exactly what it drew before (the pass is skipped).
 *
 * The objects' culls (s1031 part 10, OQ 73 (ae); SIMULATOR_PROPS_DESIGN.md §4 "The culls"; SIMULATOR_ENGINE_DESIGN.md
 * §2.8.2 readings 60 / 61): option `cull` - true (the 3D view and the camera worker: frustum, lod and pattern), or
 * { lod, frustum, back, pattern } naming some (the measuring hook; `back` only so) - and the objects' pass, per object from
 * the camera's view-projection alone (so each is deterministic from the pose and the scene): `frustum` skips an object
 * whose model box lies beyond one plane of the view frustum (no visible pixel moves); `lod` draws its studs with 12, 8 or
 * 6 sides by their largest pixel radius r = f 2.4 mm sec(theta) / w over the box - w its nearest depth, theta its widest
 * angle off the optical axis (both at a corner: an off-axis disc projects up to 1 / cos theta larger than on the axis) -
 * n >= pi sqrt(r / (2 eps)), eps 0.5 px, snapped up to a prebuilt mesh, so no stud's outline strays more than eps px; none
 * under 2 px across; `pattern` shades a stud grid on a brick top whose studs the cut-off dropped (a fragment term in a
 * second program, no geometry), faded out before its period falls under 2 px anywhere on the object's tops (the period's
 * lower bound 8 mm f h / d^2: h the eye's height over the highest patterned top under it, d the box's farthest corner -
 * foreshortening included, so it never aliases); `back` culls back faces (every object mesh wound counter-clockwise seen
 * from outside; opt-in only: it moves antialiased edge pixels and buys ~nothing after the frustum cull). A stud's side is
 * its outline, so no stud is dropped for where the eye is (1739231b's eye cull dropped visible studs; review studlod r1
 * B1). Without `cull` (a test's stand-in) the pass is exactly the one before them. Nothing per frame allocates: the stud
 * meshes are built in setGeom.
 *
 * The EVN board and the standard peripherals' models (docs/SIMULATOR_MODELS_DESIGN.md M5): option `models` (the 3D view's;
 * the camera worker never sets it, so no camera draws or loads one) and setModels(self.EVNModels) - the committed meshes
 * of media/sim/models/*.js (tools/sim/models/convert_models.py), one static mesh per part and colour with each triangle's
 * face normal, built once. With `models` on, `showModels` (the 3D view's Models button, default on) and a part loaded,
 * robot() draws the board's model in place of the deck's board and battery boxes, each colour and distance sensor's module
 * in place of its orange box, the IMU's module in place of its green one (M4's places), the LDraw wheel in place of each tyre's cylinder, turning with its motor, and each drive motor's LDraw model in place of its hub stub (M10); otherwise it draws exactly what it drew before. Looks only: the world is unchanged.
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
    /** a frame's q drawable by gameTilt (§2.7; J3c-1 r1b N4): a list of four finite numbers, not all zero; anything else
     *  (none, the wrong length, a NaN / an infinity, the zero quaternion) draws as a frame without q. Nothing allocated. */
    function tiltQ(t) {
        if (!t || t.length !== 4) { return false; }
        const n = t[0] * t[0] + t[1] * t[1] + t[2] * t[2] + t[3] * t[3];
        return n > 0 && Number.isFinite(n);
    }
    /** the rotation part of a matrix, for the normals (the scales here are positive; good enough for shading) */
    // the drive motors' models by the hardware's motor name (design M10): [the part, a half turn on the right (a part that is not
    // symmetric across its axle's mid-plane, mounted as the owner's WRO robot does: the Medium's outboard face its origin)]
    const MOTOR_PARTS = { 'EV3 Medium': ['motor_99455', true], 'EV3 Large': ['motor_95658', false], 'NXT': ['motor_53787', false] };
    const MOTOR_GAP = 2.4;   // mm between a motor and the tyre's inboard face (the WRO robot's 2.36: wrobot_evn.ldr)
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
    /* the objects' program when `cull` has `pattern` (built only for a course whose objects have studs): FS and, on a
     * brick top whose studs the cut-off dropped (pat > 0, its strength: patOf fades it to 0 before the grid's period falls
     * under 2 px), a stud grid - that top's uv is (u, -1 - v) on its studs' 8 mm grid (buildGames, cullGroup), every other
     * face's uv in [0, 1] - each stud a soft disc up to 14 % darker, 4.8 mm across */
    const FS_PAT = `
precision mediump float;
uniform vec3 color; uniform float alpha; uniform sampler2D tex; uniform float useTex; uniform vec3 light; uniform float pat;
varying vec3 vn; varying vec2 vuv;
void main() {
    float d = max(dot(normalize(vn), light), 0.0);
    vec3 c = useTex > 0.5 ? texture2D(tex, vuv).rgb : color;
    if (pat > 0.0 && vuv.y < -0.5) { vec2 g = fract(vec2(vuv.x, -vuv.y)) - 0.5; c *= 1.0 - 0.14 * pat * (1.0 - smoothstep(0.22, 0.38, length(g))); }
    gl_FragColor = vec4(c * (0.58 + 0.42 * d), alpha);
}`;
    /* the stud level of detail (props design §4 "The culls"): a stud's radius 2.4 mm; an n-gon inscribed in a circle of r px
     * strays r (1 - cos(pi / n)) ~ r pi^2 / (2 n^2) px from it, at most eps when n >= pi sqrt(r / (2 eps)) - so n sides
     * serve up to r = 2 eps (n / pi)^2 px (6: 3.65, 8: 6.48, 12: 14.59; past that the 12-gon, the finest built); under
     * STUD_MIN_R px (2 px across) no stud; the pattern's grid (8 mm) at full strength from PAT_P1 px a period down,
     * fading to none at PAT_P0 (Nyquist: under 2 px a period it would alias) */
    const STUD_R = 2.4, STUD_EPS = 0.5, STUD_MIN_R = 1, PAT_P0 = 2, PAT_P1 = 3;
    const lodR = (n) => 2 * STUD_EPS * (n / Math.PI) * (n / Math.PI);
    const LOD_R6 = lodR(6), LOD_R8 = lodR(8);
    /** a program of vs + fs, its attributes bound to `bind`'s locations ({ p, n, uv }) when given */
    function program(gl, vs, fs, bind) {
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); } return s; };
        const pr = gl.createProgram();
        gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
        gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
        if (bind) { for (const a of ['p', 'n', 'uv']) { if (bind[a] >= 0) { gl.bindAttribLocation(pr, bind[a], a); } } }
        gl.linkProgram(pr);
        return pr;
    }

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
    /** a stud (SIMULATOR_PROPS_DESIGN.md §4 (a); J3c-1 DR2): a 12-gon cylinder 4.8 mm across, 1.7 mm high, standing on
     *  (x, y, z) - its brick's top - its 12 sides (24 triangles) and its top cap as a fan from one rim vertex (10), no
     *  bottom: 34 triangles, each wound outward (counter-clockwise seen from outside), appended to out */
    function studInto(out, x, y, z, dir) {
        if (dir !== undefined && dir !== '+z') { studDirInto(out, x, y, z, dir, 12); return; }
        const n = 12, r = 2.4, zt = z + 1.7, P = [];
        for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; P.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
        for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; quad(out, [a[0], a[1], z], [b[0], b[1], z], [b[0], b[1], zt], [a[0], a[1], zt]); }
        for (let i = 1; i < n - 1; i++) { for (const v of [P[0], P[i], P[i + 1]]) { out.push(v[0], v[1], zt, 0, 0, 1, 0, 0); } }
    }
    /** a stud of `sides` sides (the culls' level of detail: 8 and 6; 12 is studInto's, the same vertices): its sides (2 n
     *  triangles) and its top cap as a fan from one rim vertex (n - 2), no bottom: 3 n - 2 triangles, each wound outward */
    function studSidesInto(out, x, y, z, sides, dir) {
        if (dir !== undefined && dir !== '+z') { studDirInto(out, x, y, z, dir, sides); return; }
        const r = STUD_R, zt = z + 1.7, Q = [];
        for (let i = 0; i < sides; i++) { const a = 2 * Math.PI * i / sides; Q.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
        for (let i = 0; i < sides; i++) { const a = Q[i], b = Q[(i + 1) % sides]; quad(out, [a[0], a[1], z], [b[0], b[1], z], [b[0], b[1], zt], [a[0], a[1], zt]); }
        for (let i = 1; i < sides - 1; i++) { for (const v of [Q[0], Q[i], Q[i + 1]]) { out.push(v[0], v[1], zt, 0, 0, 1, 0, 0); } }
    }
    /** EP-c (D150): the proper rotations (row-major, det +1) that turn an upward stud's +z to a stud's direction, so its
     *  outward winding is kept; a direction not listed is refused */
    const STUD_DIR = {
        '+x': [0, 0, 1, 0, 1, 0, -1, 0, 0], '-x': [0, 0, -1, 0, 1, 0, 1, 0, 0],
        '+y': [1, 0, 0, 0, 0, 1, 0, -1, 0], '-y': [1, 0, 0, 0, 0, -1, 0, 1, 0], '-z': [1, 0, 0, 0, -1, 0, 0, 0, -1],
    };
    /** a ring of `n` sides (radius rr round (cu, cv) in a local frame u, v, w) from w0 to w1, mapped by R (row-major,
     *  det +1) and offset o into the model's frame: its sides (2 n triangles), its top cap at w1 as a fan from one rim
     *  vertex (n - 2), and with `bottom` its cap at w0 (n - 2), each wound outward; `ring` the local outline (counter-
     *  clockwise seen from +w), when given, instead of the n-gon */
    function ringInto(out, n, rr, cu, cv, w0, w1, R, o, bottom, ring) {
        const map = (u, v, w) => [o[0] + R[0] * u + R[1] * v + R[2] * w, o[1] + R[3] * u + R[4] * v + R[5] * w, o[2] + R[6] * u + R[7] * v + R[8] * w];
        const Q = ring || [];
        if (!ring) { for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; Q.push([cu + rr * Math.cos(a), cv + rr * Math.sin(a)]); } }
        const m = Q.length, lo = Q.map((q) => map(q[0], q[1], w0)), hi = Q.map((q) => map(q[0], q[1], w1));
        for (let i = 0; i < m; i++) { const j = (i + 1) % m; quad(out, lo[i], lo[j], hi[j], hi[i]); }
        const up = [R[2], R[5], R[8]];
        for (let i = 1; i < m - 1; i++) { for (const v of [hi[0], hi[i], hi[i + 1]]) { out.push(v[0], v[1], v[2], up[0], up[1], up[2], 0, 0); } }
        if (bottom) { for (let i = 1; i < m - 1; i++) { for (const v of [lo[0], lo[i + 1], lo[i]]) { out.push(v[0], v[1], v[2], -up[0], -up[1], -up[2], 0, 0); } } }
    }
    /** a stud of `sides` sides standing on (x, y, z) along `dir` (EP-c, D150): studInto's stud turned by STUD_DIR[dir] -
     *  the same 3 n - 2 triangles, its foot on its brick's face, 1.7 mm out along dir */
    function studDirInto(out, x, y, z, dir, sides) {
        const R = STUD_DIR[dir];
        if (!R) { throw new Error(`a stud's direction ${dir} is not one of +z, ${Object.keys(STUD_DIR).join(', ')}`); }
        ringInto(out, sides, STUD_R, 0, 0, 0, 1.7, R, [x, y, z], false, null);
    }
    /** SP-b (ES D205): a sphere piece (gameMesh.ts, the Senior ball) - 16 segments round z by 8 bands pole to pole, every
     *  vertex on the sphere about c, its normal radial (smooth: a ball, not a faceted part), wound outward; the poles'
     *  bands one triangle a segment: 16 x (2 x 8 - 2) = 224 triangles, appended to out */
    function sphereInto(out, c, r) {
        const NU = 16, NV = 8, P = (i, j) => { const t = Math.PI * i / NV, f = 2 * Math.PI * j / NU; return [Math.sin(t) * Math.cos(f), Math.sin(t) * Math.sin(f), Math.cos(t)]; };
        const put = (n) => { out.push(c[0] + r * n[0], c[1] + r * n[1], c[2] + r * n[2], n[0], n[1], n[2], 0, 0); };
        for (let i = 0; i < NV; i++) {
            for (let j = 0; j < NU; j++) {
                const a = P(i, j), b = P(i + 1, j), d = P(i + 1, j + 1), e = P(i, j + 1);
                if (i < NV - 1) { put(a); put(b); put(d); }
                if (i > 0) { put(a); put(d); put(e); }
            }
        }
    }
    /** EP-c (D151): the cyclic axis maps (det +1) of a cylinder along x / y / z: local (u, v, w), w along the axis */
    const CYL_AXIS = [[0, 0, 1, 1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, 1, 1, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1]];
    /** SP-c (ES D207): the refusal of a drawn piece whose kind is none of the three (gameMesh.ts MeshPiece), naming it */
    const PIECE_REFUSED = (q) => `a drawn piece's kind ${JSON.stringify(q && q.kind)} (piece ${q && q.name}) is not one render3d.js draws (sphere, cylinder, prism)`;
    /** a drawn piece (gameMesh.ts MeshPiece; EP-c, D151): a `cylinder` - a capped 12-gon inscribed in its box along its
     *  axis (2 x 12 sides + 2 x 10 caps: 44 triangles, the bake's CYL_TRIANGLES) - or a `prism`, its plan outline over its
     *  band (2 n + 2 (n - 2)), each wound outward, appended to out; the vertices it added */
    function pieceInto(out, q) {
        const at = out.length;
        if (q.kind === 'sphere') { sphereInto(out, q.c, q.r); return (out.length - at) / 8; }
        if (q.kind === 'cylinder') {
            const b = q.box, a = q.axis, lo = [b[0], b[1], b[2]], hi = [b[3], b[4], b[5]], u = (a + 1) % 3, v = (a + 2) % 3;
            ringInto(out, 12, (hi[u] - lo[u]) / 2, (lo[u] + hi[u]) / 2, (lo[v] + hi[v]) / 2, lo[a], hi[a], CYL_AXIS[a], [0, 0, 0], true, null);
        } else {
            // SP-c (ES D207): a kind the drawing does not know is refused by name, never drawn as a prism
            if (q.kind !== 'prism') { throw new Error(PIECE_REFUSED(q)); }
            let P = q.outline, A = 0;
            for (let i = 0; i < P.length; i++) { const p = P[i], r = P[(i + 1) % P.length]; A += p[0] * r[1] - r[0] * p[1]; }
            if (A < 0) { P = P.slice().reverse(); }
            ringInto(out, P.length, 0, 0, 0, q.z[0], q.z[1], CYL_AXIS[2], [0, 0, 0], true, P);
        }
        return (out.length - at) / 8;
    }
    /** a piece's box [x0, y0, z0, x1, y1, z1] (its cylinder's box; a prism's outline's bounds over its band) */
    function pieceBox(q) {
        if (q.kind === 'cylinder') { return q.box; }
        if (q.kind === 'sphere') { return [q.c[0] - q.r, q.c[1] - q.r, q.c[2] - q.r, q.c[0] + q.r, q.c[1] + q.r, q.c[2] + q.r]; }
        if (q.kind !== 'prism') { throw new Error(PIECE_REFUSED(q)); }
        const xs = q.outline.map((p) => p[0]), ys = q.outline.map((p) => p[1]);
        return [Math.min(...xs), Math.min(...ys), q.z[0], Math.max(...xs), Math.max(...ys), q.z[1]];
    }
    /** a model's box for the frustum cull: [x0, y0, z0, x1, y1, z1] over its bricks, its studs (each 2.4 mm round its
     *  foot, 1.7 mm out along its direction) and its pieces (EP-c), as a Float32Array */
    function modelBox(boxes, studs, pieces) {
        const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
        const grow = (x0, y0, z0, x1, y1, z1) => { bb[0] = Math.min(bb[0], x0); bb[1] = Math.min(bb[1], y0); bb[2] = Math.min(bb[2], z0); bb[3] = Math.max(bb[3], x1); bb[4] = Math.max(bb[4], y1); bb[5] = Math.max(bb[5], z1); };
        for (const b of boxes) { grow(b[0], b[1], b[2], b[3], b[4], b[5]); }
        for (const u of studs || []) {
            const R = u[4] !== undefined && u[4] !== '+z' ? STUD_DIR[u[4]] : null;
            if (!R) { grow(u[0] - STUD_R, u[1] - STUD_R, u[2], u[0] + STUD_R, u[1] + STUD_R, u[2] + 1.7); continue; }
            // the stud's local box [-r, r] x [-r, r] x [0, 1.7] turned: per model axis its half-width across and its reach along
            const e = [0, 1, 2].map((k) => [STUD_R * (Math.abs(R[3 * k]) + Math.abs(R[3 * k + 1])), 1.7 * R[3 * k + 2]]);
            grow(u[0] - e[0][0] + Math.min(0, e[0][1]), u[1] - e[1][0] + Math.min(0, e[1][1]), u[2] - e[2][0] + Math.min(0, e[2][1]),
                u[0] + e[0][0] + Math.max(0, e[0][1]), u[1] + e[1][0] + Math.max(0, e[1][1]), u[2] + e[2][0] + Math.max(0, e[2][1]));
        }
        for (const q of pieces || []) { const b = pieceBox(q); grow(b[0], b[1], b[2], b[3], b[4], b[5]); }
        return new Float32Array(bb);
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

    /** the crease angle of a model's shading: a corner's normal is the area-weighted sum of the faces at its vertex that lie
     *  within this of its own face (a curved surface - the cells, the jacks' rounded edges - shades smooth; an edge sharper
     *  than this - a box's corner - stays crisp). 40 deg: a cylinder decimated to 9 or more sides shades round. */
    const CREASE_DEG = 40;
    /** a model of media/sim/models/*.js ({ groups: [{ color, n, pos, idx, alpha? }], quant, bbox }) as [[triangles (x y z nx
     *  ny nz u v), [r, g, b], alpha], ...] - positions int16 x quant (mm), indices uint16, both little-endian base64; each
     *  corner's normal smoothed over its vertex's faces within CREASE_DEG of its own (the faces of one colour group share
     *  their vertices). Throws on a malformed model (setModels skips it). */
    function modelGroups(m) {
        const bytes = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) { u[i] = s.charCodeAt(i); } return new DataView(u.buffer); };
        const q = m.quant;
        if (!(q > 0) || !Array.isArray(m.groups) || !Array.isArray(m.bbox) || m.bbox.length !== 6) { throw new Error('not a model'); }
        return m.groups.map((g) => {
            const P = bytes(g.pos), I = bytes(g.idx), nv = P.byteLength / 6, ni = I.byteLength / 2;
            const alpha = g.alpha === undefined ? 1 : g.alpha;
            if (nv !== g.n || ni % 3 || !/^#[0-9a-f]{6}$/i.test(g.color) || !(alpha > 0 && alpha <= 1)) { throw new Error('a malformed group'); }
            const out = new Array(ni * 8);
            const v = (k) => { if (k >= nv) { throw new Error('an index out of range'); } return [P.getInt16(6 * k, true) * q, P.getInt16(6 * k + 2, true) * q, P.getInt16(6 * k + 4, true) * q]; };
            const nt = ni / 3, idx = new Array(ni), fa = new Array(nt), fu = new Array(nt), at = Array.from({ length: nv }, () => []);
            for (let i = 0; i < ni; i++) { idx[i] = I.getUint16(2 * i, true); }
            const V = Array.from({ length: nv }, (_, k) => v(k));
            for (let t = 0; t < nt; t++) {
                const a = v(idx[3 * t]), b = V[idx[3 * t + 1]], c = V[idx[3 * t + 2]];
                fa[t] = cross(sub(b, a), sub(c, a));          // twice the area along the normal: an area-weighted sum
                fu[t] = norm(fa[t]);
                for (let j = 0; j < 3; j++) { at[idx[3 * t + j]].push(t); }
            }
            const cosC = Math.cos(CREASE_DEG * Math.PI / 180);
            for (let t = 0; t < nt; t++) {
                for (let j = 0; j < 3; j++) {
                    const k = idx[3 * t + j], p = V[k], n = [0, 0, 0];
                    for (const f of at[k]) { if (dot(fu[f], fu[t]) >= cosC) { n[0] += fa[f][0]; n[1] += fa[f][1]; n[2] += fa[f][2]; } }
                    const u = Math.hypot(n[0], n[1], n[2]) > 0 ? norm(n) : fu[t];
                    const o = (3 * t + j) * 8;
                    out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2]; out[o + 3] = u[0]; out[o + 4] = u[1]; out[o + 5] = u[2]; out[o + 6] = 0; out[o + 7] = 0;
                }
            }
            return [out, hex(g.color), alpha];
        });
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
            this.gameBoxes = new Map();   // with the culls: each model's box [x0, y0, z0, x1, y1, z1] (its bricks and studs)
            this.gamePt = new Map();      // with the pattern: each model's patterned tops' heights (model frame), ascending
            this.gameDraw = [];
            // the objects' pass's scratch (drawGames): one model-view-projection and normal matrix, rewritten per object
            this.gMvp = new Float32Array(16);
            this.gNm = new Float32Array(9);
            // the objects' culls (the header): which are on; the pass's per-frame values (cullBegin), no allocation per frame
            const cu = opts.cull === true ? { lod: true, frustum: true, pattern: true } : (opts.cull || {});
            this.cLod = !!cu.lod; this.cFrustum = !!cu.frustum; this.cBack = !!cu.back; this.cPattern = !!cu.pattern;
            this.cull = this.cLod || this.cFrustum || this.cBack || this.cPattern;
            this.cW = 640;          // the viewport (frame() sets it): the pixel focal length is vp's x scale x W / 2
            this.cH = 480;
            this.cFpx = 0;          // that focal length, px (|vp's x row| W / 2: not under the true one)
            this.cFmin = 0;         // the true focal length, px, the smaller of x and y (the pattern's period: not over)
            // tan of a clip point's angle off the optical axis: kx ndc x + bx (y alike), from vp's rows (cullBegin)
            this.cKx = 0; this.cBx = 0; this.cKy = 0; this.cBy = 0;
            this.pr2 = null;        // the pattern program (FS_PAT), its locations, and the main locations while it draws
            this.loc2 = null;
            this.locMain = null;
            this.light = new Float32Array(norm([0.35, -0.45, 1]));
            // the models (the header): on only where opts.models is (the 3D view); each part's [Mesh, colour] list and bbox
            this.useModels = !!opts.models;
            this.showModels = true;
            this.models = new Map();
            // a frame's translucent model groups (the board's clear shield), drawn after everything opaque (frame())
            this.later = [];
        }

        /** the committed models (self.EVNModels: { part: model }), built into static meshes once; a part that does not decode is
         *  left out (its boxes are drawn) with one warning. Nothing when the scene was made without `models`. */
        setModels(src) {
            const gl = this.gl;
            for (const m of this.models.values()) { for (const [mesh] of m.meshes) { gl.deleteBuffer(mesh.buf); } }
            this.models.clear();
            if (!this.useModels || !src || !gl) { return; }
            for (const name of Object.keys(src).sort()) {
                try {
                    const groups = modelGroups(src[name]);
                    this.models.set(name, { meshes: groups.map(([d, c, a]) => [new Mesh(gl, d), c, a]), bbox: src[name].bbox, size: src[name].source_bbox });
                } catch (e) { if (typeof console !== 'undefined') { console.warn(`3D view: the ${name} model is not drawn (${e.message})`); } }
            }
        }

        /** the model `name` when the models are drawn and it is loaded, else null (the boxes) */
        model(name) { return this.useModels && this.showModels ? this.models.get(name) || null : null; }

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
            // EN2 (ES §4.4, D176): a WRO package's decals (the Senior pattern paper) - flat polygons 0.1 mm over the floor,
            // under every body, in their colours; the geometry carries them with its seed, so a new seed's paper comes with
            // its field (this rebuild); static, one mesh a decal (`decal`: its cell index)
            for (const d of geom.decals || []) {
                const out = [], P = d.poly;
                for (let i = 1; i + 1 < P.length; i++) {
                    for (const q of [P[0], P[i], P[i + 1]]) { out.push(q[0], q[1], 0.1, 0, 0, 1, 0, 0); }
                }
                if (out.length) { this.statics.push({ mesh: new Mesh(gl, out), color: d.rgb.map((v) => v / 255), decal: d.k }); }
            }
            // EN1 (G§2.7): each fixture's pieces from their drawing faces (base then top vertices, model axes) at its pose,
            // flat-shaded in its colour (lifted to 24 of 255 so a black frame's faces still shade); static, one mesh a fixture
            for (const fx of (w3 && w3.fixtures) || []) {
                const out = [], a = fx.at[2] * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
                const W = (q, z) => [fx.at[0] + q[0] * c - q[1] * s, fx.at[1] + q[0] * s + q[1] * c, (fx.at[3] || 0) + z];
                for (const p of fx.pieces) {
                    const V = p.base.map((q) => W(q, p.z[0])).concat(p.top.map((q) => W(q, p.z[1])));
                    for (const t of p.tris) {
                        const A = V[t[0]], B = V[t[1]], C = V[t[2]];
                        if (!A || !B || !C) { continue; }
                        const n = norm(cross(sub(B, A), sub(C, A)));
                        for (const P of [A, B, C]) { out.push(P[0], P[1], P[2], n[0], n[1], n[2], 0, 0); }
                    }
                }
                const col = fx.colour.map((v) => Math.max(24, v) / 255);
                if (out.length) { this.statics.push({ mesh: new Mesh(gl, out), color: col }); }
            }
            this.buildGames(w3);
        }

        /** the game objects' static meshes (W4): each model of w3.gameMeshes once, its boxes grouped by colour (one mesh
         *  per colour: the shader has one colour per draw), and per object of w3.games the groups of its model and where
         *  the geometry laid it. The previous course's meshes deleted. */
        buildGames(w3) {
            const gl = this.gl;
            for (const groups of this.gameMeshes.values()) { for (const g of groups) { gl.deleteBuffer(g.mesh.buf); } }
            for (const groups of this.gameMeshes.values()) { for (const g of groups) { for (const m of [g.m8, g.m6]) { if (m) { gl.deleteBuffer(m.buf); } } } }
            this.gameMeshes.clear();
            this.gameBoxes.clear();
            this.gamePt.clear();
            this.gameDraw = [];
            if (!w3 || !w3.games || !w3.games.length || !w3.gameMeshes) { return; }
            for (const key of Object.keys(w3.gameMeshes)) {
                const byColour = new Map();
                for (const b of w3.gameMeshes[key]) {
                    const c = b[6], ck = `${c[0]},${c[1]},${c[2]}`;
                    let d = byColour.get(ck);
                    if (!d) { d = { rgb: c, data: [] }; byColour.set(ck, d); }
                    boxInto(d.data, b[0], b[1], b[2], b[3], b[4], b[5]);
                    if (this.cull) { (d.bx ??= []).push(b); }
                }
                // its pieces (EP-c, D151: gameMesh.ts gamePieces - the pins, the hose, the knuckles), after the boxes in
                // their colour's mesh, before its studs (with the culls counted with the boxes: drawn at every level)
                const pc = w3.gamePieces ? w3.gamePieces[key] : null;
                if (pc) {
                    for (const q of pc) {
                        const qk = `${q.rgb[0]},${q.rgb[1]},${q.rgb[2]}`;
                        let d = byColour.get(qk);
                        if (!d) { d = { rgb: q.rgb, data: [] }; byColour.set(qk, d); }
                        d.pv = (d.pv || 0) + pieceInto(d.data, q);
                    }
                }
                // its studs (a props file's mesh.studs, gameMesh.ts gameStuds; J3c-1 DR2), after the boxes in their colour's
                // mesh (the W4 rows read bricks from vertex k * 36); none on today's files; each along its direction (EP-c)
                const st = w3.gameStuds ? w3.gameStuds[key] : null;
                if (st) {
                    for (const u of st) {
                        const sc = u[3], sk = `${sc[0]},${sc[1]},${sc[2]}`;
                        let d = byColour.get(sk);
                        if (!d) { d = { rgb: sc, data: [] }; byColour.set(sk, d); }
                        studInto(d.data, u[0], u[1], u[2], u[4]);
                        if (this.cull) { (d.su ??= []).push(u); }
                    }
                }
                const groups = [];
                for (const d of byColour.values()) {
                    const ex = this.cull ? this.cullGroup(d) : null;
                    groups.push({ mesh: new Mesh(gl, d.data), color: new Float32Array([d.rgb[0] / 255, d.rgb[1] / 255, d.rgb[2] / 255]), ...ex });
                }
                this.gameMeshes.set(key, groups);
                if (this.cull) { this.gameBoxes.set(key, modelBox(w3.gameMeshes[key], st, pc)); }
                const pt = [...new Set(groups.flatMap((q) => q.ptz || []))].sort((p, q) => p - q);
                if (pt.length) { this.gamePt.set(key, new Float32Array(pt)); }
            }
            this.gameDraw = w3.games.map((g) => ({ groups: this.gameMeshes.get(g.mesh) || null, at: g.at, bb: this.cull ? this.gameBoxes.get(g.mesh) || null : null, pt: this.gamePt.get(g.mesh) || null }));
            if (this.cPattern && !this.pr2 && [...this.gameMeshes.values()].some((gs) => gs.some((q) => q.pat))) {
                this.pr2 = program(gl, VS, FS_PAT, this.loc);
                this.loc2 = {};
                for (const a of ['p', 'n', 'uv']) { this.loc2[a] = gl.getAttribLocation(this.pr2, a); }
                for (const u of ['mvp', 'nm', 'color', 'alpha', 'tex', 'useTex', 'light', 'pat']) { this.loc2[u] = gl.getUniformLocation(this.pr2, u); }
            }
        }

        /** a colour's culling data (buildGames, `cull`; d: its boxes bx and studs su, the file's order, and its mesh data):
         *  nBox its box and piece vertices (the first in its mesh; EP-c: the pieces after the boxes), nStud its studs (after them, 102 vertices each), m8 / m6 its
         *  studs as 8- and 6-gons (lod; same order), pat whether a top carries the stud grid's uv (pattern: each box top
         *  with a listed stud of its colour standing on it, its six vertices' uv set to (u, -1 - v) on the grid of its
         *  studs, the corner stud's centre at (0.5, -1.5)), ptz those tops' heights */
        cullGroup(d) {
            const gl = this.gl, bx = d.bx || [], su = d.su || [];
            const ex = { nBox: bx.length * 36 + (d.pv || 0), nStud: su.length, m8: null, m6: null, pat: false, ptz: [] };
            if (su.length && this.cLod) {
                const a8 = [], a6 = [];
                for (const u of su) { studSidesInto(a8, u[0], u[1], u[2], 8, u[4]); studSidesInto(a6, u[0], u[1], u[2], 6, u[4]); }
                ex.m8 = new Mesh(gl, a8); ex.m6 = new Mesh(gl, a6);
            }
            if (this.cPattern) {
                bx.forEach((b, k) => {
                    // an upward stud only (EP-c: a sideways stud stands on no top)
                    const on = su.filter((u) => (u[4] === undefined || u[4] === '+z') && Math.abs(u[2] - b[5]) < 1e-6 && u[0] > b[0] && u[0] < b[3] && u[1] > b[1] && u[1] < b[4]);
                    if (!on.length) { return; }
                    const sx = Math.min(...on.map((u) => u[0])), sy = Math.min(...on.map((u) => u[1]));
                    // boxInto's first quad is the top (six vertices)
                    for (let v = 0; v < 6; v++) {
                        const o = (k * 36 + v) * 8;
                        d.data[o + 6] = (d.data[o] - sx) / 8 + 0.5;
                        d.data[o + 7] = -1 - ((d.data[o + 1] - sy) / 8 + 0.5);
                    }
                    ex.pat = true;
                    ex.ptz.push(b[5]);
                });
            }
            return ex;
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
            this.later.length = 0;   // review r3 N1: a robot() that threw part-way leaves nothing for this frame
            gl.viewport(0, 0, W, H);
            this.cW = W; this.cH = H;
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
            for (const st of this.statics) {
                // EN2 (D176, review en2 r1 S2): a decal 0.1 mm over the floor is pulled toward the eye by a polygon offset, so it
                // stays in front of the floor at any zoom (the 0.1 mm alone runs out of depth precision from about 8 m out)
                if (st.decal !== undefined) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1); }
                this.draw(vp, I, st.color, { mesh: st.mesh, tex: st.tex });
                if (st.decal !== undefined) { gl.disable(gl.POLYGON_OFFSET_FILL); }
            }
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
            if (this.later.length) {
                const gl2 = this.gl;
                gl2.depthMask(false);
                for (const [v, m, c, a, mesh] of this.later) { this.draw(v, m, c, { mesh, alpha: a }); }
                gl2.depthMask(true);
                this.later.length = 0;
            }
        }

        /** the game objects (W4): each one's model matrix (its place x, y, yaw a and base height z0 - the snapshot's
         *  hazards.games when it has every object, else where the geometry laid them) times vp written into the scratch
         *  gMvp / gNm, then one draw per colour of its model's static meshes. Nothing allocated: plain loops, no closures,
         *  no matrix arrays (M4.mul and draw() allocate; this pass does not). */
        drawGames(vp, hz) {
            if (this.cull) { this.cullBegin(vp); }
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
                // a frame carrying its orientation q (an engine body, SIMULATOR_ENGINE_DESIGN.md §2.7; J3c-1): gameTilt; a frame
                // without q (today's frames, the geometry's place) as before
                if (q && tiltQ(q.q)) { this.gameTilt(vp, q); } else {
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
                }
                if (this.cull) { this.drawCulled(g, q, groups); continue; }
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
            if (this.cull) { this.cullEnd(); }
        }

        /** the culls' per-frame values from vp (drawGames, `cull`): the pixel focal lengths, the off-axis angle's terms,
         *  back-face culling on, the pattern program in use (this.loc its locations until cullEnd). Nothing allocated. */
        cullBegin(vp) {
            const gl = this.gl;
            // vp's x row r0 = A v0 + B v2 (the projection's x scale A, the principal point's term B, the view's unit rows
            // v0 / v2), its w row r3 = -S v2 (S 1 for M4.persp and camera.ts): |r0| >= A, so cFpx is not under the true f
            this.cFpx = Math.hypot(vp[0], vp[4], vp[8]) * this.cW / 2;
            const S = Math.hypot(vp[3], vp[7], vp[11]);
            if (S > 0) {
                // B = -(r0 . r3) / S, A = |r0 + (B / S) r3|; tan theta_x = X / -Z = (S ndc_x + B) / A (y alike, rows 1 / 3)
                const Bx = -(vp[0] * vp[3] + vp[4] * vp[7] + vp[8] * vp[11]) / S, By = -(vp[1] * vp[3] + vp[5] * vp[7] + vp[9] * vp[11]) / S;
                const Ax = Math.hypot(vp[0] + Bx / S * vp[3], vp[4] + Bx / S * vp[7], vp[8] + Bx / S * vp[11]);
                const Ay = Math.hypot(vp[1] + By / S * vp[3], vp[5] + By / S * vp[7], vp[9] + By / S * vp[11]);
                this.cKx = S / Ax; this.cBx = Bx / Ax; this.cKy = S / Ay; this.cBy = By / Ay;
                this.cFmin = Math.min(Ax * this.cW, Ay * this.cH) / (2 * S);
            } else { this.cKx = 0; this.cBx = 0; this.cKy = 0; this.cBy = 0; this.cFmin = 0; }
            if (this.cBack) { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); }
            if (this.pr2) { this.locMain = this.loc; this.loc = this.loc2; gl.useProgram(this.pr2); gl.uniform3fv(this.loc2.light, this.light); }
        }

        /** the end of the culled pass: back faces drawn again, the main program and its locations back */
        cullEnd() {
            const gl = this.gl;
            if (this.cBack) { gl.disable(gl.CULL_FACE); }
            if (this.locMain) { gl.useProgram(this.pr); this.loc = this.locMain; this.locMain = null; }
        }

        /** one object with the culls (its matrix in gMvp and set): its model box's corners in clip space - beyond one plane
         *  all, skipped (frustum); the nearest depth w and the widest off-axis angle theta (each at a corner: 1 / w and
         *  sec theta are quasi-convex, so their peaks over the box are at vertices) give its studs' largest pixel radius
         *  r = f 2.4 sec / w and their sides (lod; none under STUD_MIN_R with lod or pattern); past the cut-off the
         *  pattern's strength (patOf); then per colour its boxes and its studs (one draw at 12 sides, two at 8 / 6).
         *  Nothing allocated. */
        drawCulled(g, q, groups) {
            const gl = this.gl, L = this.loc, m = this.gMvp, bb = g.bb;
            let out = 63, wmin = Infinity, sec2 = 1;
            if (bb) {
                for (let c = 0; c < 8; c++) {
                    const x = c & 1 ? bb[3] : bb[0], y = c & 2 ? bb[4] : bb[1], z = c & 4 ? bb[5] : bb[2];
                    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13];
                    const cz = m[2] * x + m[6] * y + m[10] * z + m[14], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
                    out &= (cx < -cw ? 1 : 0) | (cx > cw ? 2 : 0) | (cy < -cw ? 4 : 0) | (cy > cw ? 8 : 0) | (cz < -cw ? 16 : 0) | (cz > cw ? 32 : 0);
                    if (cw < wmin) { wmin = cw; }
                    if (cw > 0) {
                        const tx = this.cKx * cx / cw + this.cBx, ty = this.cKy * cy / cw + this.cBy, t2 = 1 + tx * tx + ty * ty;
                        if (t2 > sec2) { sec2 = t2; }
                    }
                }
            } else { out = 0; }
            if (this.cFrustum && out) { return; }
            let sides = 12;
            if (this.cLod || this.cPattern) {
                const r = wmin > 0 ? this.cFpx * STUD_R * Math.sqrt(sec2) / wmin : Infinity;
                sides = r < STUD_MIN_R ? 0 : !this.cLod ? 12 : r <= LOD_R6 ? 6 : r <= LOD_R8 ? 8 : 12;
            }
            if (L.pat) { gl.uniform1f(L.pat, sides === 0 ? this.patOf(g, m, bb) : 0); }
            for (let k = 0; k < groups.length; k++) {
                const p = groups[k];
                const ns = sides === 0 ? 0 : p.nStud;
                const first = sides === 12 ? p.nBox + ns * 102 : p.nBox;
                gl.uniform3fv(L.color, p.color);
                if (first > 0) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, p.mesh.buf);
                    gl.vertexAttribPointer(L.p, 3, gl.FLOAT, false, 32, 0);
                    gl.vertexAttribPointer(L.n, 3, gl.FLOAT, false, 32, 12);
                    gl.vertexAttribPointer(L.uv, 2, gl.FLOAT, false, 32, 24);
                    gl.drawArrays(gl.TRIANGLES, 0, first);
                }
                if (sides === 12 || ns === 0) { continue; }
                const sm = sides === 8 ? p.m8 : p.m6;
                gl.bindBuffer(gl.ARRAY_BUFFER, sm.buf);
                gl.vertexAttribPointer(L.p, 3, gl.FLOAT, false, 32, 0);
                gl.vertexAttribPointer(L.n, 3, gl.FLOAT, false, 32, 12);
                gl.vertexAttribPointer(L.uv, 2, gl.FLOAT, false, 32, 24);
                gl.drawArrays(gl.TRIANGLES, 0, ns * (3 * sides - 2) * 3);
            }
        }

        /** the stud pattern's strength on an object past the cut-off (drawCulled; m its model-view-projection, bb its box):
         *  1 down to 0 as the lower bound P of its grid's period, px, goes from PAT_P1 to PAT_P0 (so it never shows under
         *  2 px a period, where it would alias). The eye in the model's frame E (clip x, y, w all 0 there: rows 0, 1, 3 of
         *  m, Cramer); h = E.z - the highest patterned top under E (a top over the eye faces away; none under it: 0); d the
         *  box's farthest corner from E. At a point of a top at distance d' from the eye, depth w <= d', the projection
         *  scales every direction in the top by at least f cos(gamma) / w (gamma the ray's angle to the top's normal,
         *  cos = h' / d' >= h / d), so the period >= 8 mm f h / d^2 (f the smaller true focal length). An orthographic
         *  vp: none. Nothing allocated. */
        patOf(g, m, bb) {
            const pt = g.pt;
            if (!pt || !bb || !(this.cFmin > 0)) { return 0; }
            const a = m[0], b = m[4], c = m[8], d = m[12], e = m[1], f = m[5], k0 = m[9], h0 = m[13], i = m[3], j = m[7], k = m[11], l = m[15];
            const det = a * (f * k - k0 * j) - b * (e * k - k0 * i) + c * (e * j - f * i);
            if (!(Math.abs(det) > 0)) { return 0; }
            const ex = (-d * (f * k - k0 * j) - b * (k0 * l - h0 * k) + c * (f * l - h0 * j)) / det;
            const ey = (a * (k0 * l - h0 * k) + d * (e * k - k0 * i) + c * (h0 * i - e * l)) / det;
            const ez = (a * (h0 * j - f * l) - b * (h0 * i - e * l) - d * (e * j - f * i)) / det;
            if (!Number.isFinite(ex + ey + ez)) { return 0; }
            let top = -Infinity;
            for (let t = 0; t < pt.length; t++) { if (pt[t] < ez) { top = pt[t]; } }
            if (top === -Infinity) { return 0; }
            const dx = Math.max(Math.abs(bb[0] - ex), Math.abs(bb[3] - ex)), dy = Math.max(Math.abs(bb[1] - ey), Math.abs(bb[4] - ey)), dz = Math.max(Math.abs(bb[2] - ez), Math.abs(bb[5] - ez));
            const P = 8 * this.cFmin * (ez - top) / (dx * dx + dy * dy + dz * dz);
            return P <= PAT_P0 ? 0 : P >= PAT_P1 ? 1 : (P - PAT_P0) / (PAT_P1 - PAT_P0);
        }

        /** a frame carrying q (§2.7; J3c-1): vp x trans(x, y, z) x rot(q) into the scratch gMvp, rot(q) into gNm, both set as the uniforms (a
         *  rotation is its own inverse transpose). q = [w, x, y, z], scaled by 2 / |q|^2 (a quaternion off unit length by
         *  float rounding still draws a rotation); (x, y, z) mm is the model frame's origin. Column-major (M4); nothing
         *  allocated. */
        gameTilt(vp, f) {
            const m = this.gMvp, N = this.gNm, t = f.q;
            const w = t[0], qx = t[1], qy = t[2], qz = t[3];
            const k = 2 / (w * w + qx * qx + qy * qy + qz * qz);
            const xx = qx * qx * k, yy = qy * qy * k, zz = qz * qz * k, xy = qx * qy * k, xz = qx * qz * k, yz = qy * qz * k;
            const wx = w * qx * k, wy = w * qy * k, wz = w * qz * k;
            // R (model -> world), row by row
            const r00 = 1 - yy - zz, r01 = xy - wz, r02 = xz + wy;
            const r10 = xy + wz, r11 = 1 - xx - zz, r12 = yz - wx;
            const r20 = xz - wy, r21 = yz + wx, r22 = 1 - xx - yy;
            const px = f.x, py = f.y, pz = f.z;
            for (let r = 0; r < 4; r++) {
                const v0 = vp[r], v1 = vp[4 + r], v2 = vp[8 + r];
                m[r] = v0 * r00 + v1 * r10 + v2 * r20;
                m[4 + r] = v0 * r01 + v1 * r11 + v2 * r21;
                m[8 + r] = v0 * r02 + v1 * r12 + v2 * r22;
                m[12 + r] = v0 * px + v1 * py + v2 * pz + vp[12 + r];
            }
            N[0] = r00; N[1] = r10; N[2] = r20; N[3] = r01; N[4] = r11; N[5] = r21; N[6] = r02; N[7] = r12; N[8] = r22;
            const gl = this.gl, L = this.loc;
            gl.uniformMatrix4fv(L.mvp, false, m);
            gl.uniformMatrix3fv(L.nm, false, N);
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

        /** a model's meshes at model matrix m (one draw per colour); a translucent group (alpha < 1: the board's shield) kept
         *  for the end of the frame, drawn after everything opaque with depth writes off so what is behind it shows */
        drawModel(vp, m, model) {
            for (const [mesh, c, a] of model.meshes) { if (a < 1) { this.later.push([vp, m, c, a, mesh]); } else { this.draw(vp, m, c, { mesh }); } }
        }

        robot(vp, s) {
            const hw = this.hw, b = this.body, db = hw.driveBase, p = s.pose;
            const r = db.wheelDiameter / 2;
            const base = M4.chain(M4.trans(p.x, p.y, p.z || 0), M4.rz(p.heading * Math.PI / 180), M4.ry(-(p.pitch || 0) * Math.PI / 180), M4.rx((p.roll || 0) * Math.PI / 180));
            const part = (x, y, z, sx, sy, sz, color, mesh, extra) => this.draw(vp, M4.chain(base, M4.trans(x, y, z), ...(extra || []), M4.scale(sx, sy, sz)), hex(color), { mesh: mesh || this.box });
            const len = b.front + b.rear, top = b.height;
            // the body: a deck at the clearance, the board and battery on it
            part((b.front - b.rear) / 2, 0, b.clearance + 6, len, b.width, 12, '#2a2f34');
            const evn = this.model('evn_alpha');
            if (evn) {
                // the board's model (design M4): long side across, motor jacks forward (its frame's -x turned a half turn),
                // its footprint's rear edge at the body's rear, its bottom on the deck
                this.drawModel(vp, M4.chain(base, M4.trans(evn.bbox[3] - b.rear, 0, b.clearance + 12), M4.rz(Math.PI)), evn);
            } else {
                part(-b.rear * 0.25, 0, Math.min(top - 10, b.clearance + 30), len * 0.55, b.width * 0.7, Math.max(8, Math.min(40, top - b.clearance - 20)), '#3d454d');
                part(-b.rear * 0.25, 0, top - 4, len * 0.45, b.width * 0.55, 8, '#a8977b');
            }
            // the wheels (a cylinder lies along z: turned onto y); with its model (design M10) the LDraw wheel: the tyre's centre
            // at the wheel's place, scaled to the configured diameter and the tyre's drawn width, its outboard face out (a half
            // turn on the right), rolled by its motor's angle - positive about +y rolls forward, a mirrored motor's angle counts
            // the other way, and the half turn reverses it on the right. The snapshot's angle is the shaft's own, so a slipping
            // wheel spins as its motor does
            const wheel = this.model('wheel_32020'), mp = MOTOR_PARTS[db.motor], motor = mp ? this.model(mp[0]) : null;
            for (const side of [1, -1]) {
                if (wheel) {
                    const sb = wheel.size, k = db.wheelDiameter / (sb[5] - sb[2]);
                    const port = side === 1 ? db.leftPort : db.rightPort, flip = (side === 1 ? db.leftMirrored : db.rightMirrored) ? -1 : 1;
                    const mo = (s.motors || []).find((x) => x.port === port);
                    const rolled = (mo ? mo.angle * flip : 0) * Math.PI / 180;
                    this.drawModel(vp, M4.chain(base, M4.trans(0, side * db.axleTrack / 2, r), ...(side === 1 ? [] : [M4.rz(Math.PI)]), M4.ry(side * rolled), M4.scale(k, b.tyre / (sb[4] - sb[1]), k)), wheel);
                } else {
                    part(0, side * db.axleTrack / 2, r, r, r, b.tyre, '#16191c', this.cyl, [M4.rx(Math.PI / 2)]);
                }
                if (motor) {
                    // its motor (design M10): output on the axle, inboard of the tyre by MOTOR_GAP - the Medium's origin is its
                    // outboard face, the Large's and NXT's their width's middle
                    const w = motor.size[4] - motor.size[1], half = mp[1], y = db.axleTrack / 2 - b.tyre / 2 - MOTOR_GAP - (half ? 0 : w / 2);
                    this.drawModel(vp, M4.chain(base, M4.trans(0, side * y, r), ...(half && side === -1 ? [M4.rz(Math.PI)] : [])), motor);
                } else {
                    part(0, side * (db.axleTrack / 2 - b.tyre / 2 - 6), r, 8, 8, 12, '#c9b99c', this.cyl, [M4.rx(Math.PI / 2)]);
                }
            }
            // the caster
            part(b.caster, 0, 8, 8, 8, 8, '#9aa0a6', this.cyl, [M4.rx(Math.PI / 2)]);
            // the colour sensors, lit by what they read
            const tcs = this.model('colour_sensor');
            for (const c of hw.colorSensors) {
                const rd = s.sensors.find((x) => x.port === c.port);
                const v = rd ? Math.max(0, Math.min(100, rd.value[0])) / 100 : 1;
                const g = Math.round((0.2 + 0.8 * v) * 255).toString(16).padStart(2, '0');
                if (tcs) {
                    // its module (design M4): the face at the sensor's height under its die, the mount's x forward; a forward-
                    // facing one turned to look along the heading (-z onto +x); the read patch 0.3 mm out from the face
                    const turn = c.facing === 'forward' ? [M4.ry(-Math.PI / 2)] : [];
                    this.drawModel(vp, M4.chain(base, M4.trans(c.forward, c.left, c.height), ...turn), tcs);
                    part(c.forward, c.left, c.height, 8, 8, 0.6, `#${g}${g}${g}`, undefined, [...turn, M4.trans(0, 0, -0.3)]);
                } else {
                    part(c.forward, c.left, c.height + 3, 14, 14, 6, '#eb6834');
                    part(c.forward, c.left, c.height + 0.3, 8, 8, 0.6, `#${g}${g}${g}`);
                }
            }
            const vl = this.model('distance_sensor');
            for (const d of hw.distanceSensors || []) {
                // its module (design M4, increment 2): turned to its angle, looking along it (the module's -z onto the
                // heading), the face's centre at the sensor's place - where its beam starts
                if (vl) { this.drawModel(vp, M4.chain(base, M4.trans(d.forward, d.left, d.height), M4.rz(d.angle * Math.PI / 180), M4.ry(-Math.PI / 2)), vl); } else { part(d.forward, d.left, d.height, 10, 20, 12, '#eb6834', undefined, [M4.rz(d.angle * Math.PI / 180)]); }
            }
            // the IMU: on the body's top; with the board's model, on the board's top at its middle (design M4: the battery box
            // it stood on is not drawn, and the body's top would leave it floating over the board)
            // the IMU's module (increment 2) flat, its x along the robot's forward, on the board's top (else the body's)
            const mpu = this.model('imu_sensor');
            if (hw.imu && mpu) { this.drawModel(vp, M4.chain(base, evn ? M4.trans(evn.bbox[3] - b.rear, 0, b.clearance + 12 + evn.bbox[5]) : M4.trans(0, 0, top)), mpu); }
            else if (hw.imu) { if (evn) { part(evn.bbox[3] - b.rear, 0, b.clearance + 12 + evn.bbox[5] + 2, 22, 22, 4, '#5f9e88'); } else { part(0, 0, top, 22, 22, 4, '#5f9e88'); } }
            // the mechanisms' parts (src/sim/engine/mechanisms.ts), posed on the chassis as the snapshot says
            for (const [f, l, u, yaw, pitch, sx, sy, sz] of (s.mech && s.mech.boxes) || []) { part(f, l, u, sx, sy, sz, '#4a6fa5', undefined, [M4.rz(yaw * Math.PI / 180), M4.ry(-pitch * Math.PI / 180)]); }
            // a LAB rig's parts (src/sim/engine/mechanisms.ts ShaftRig.snapshot()): bars, tips, a cord and its load as boxes; a
            // disc or pulley a cylinder about the joint's (left) axis, with a spoke turned to the joint's angle
            const rig = s.rig || { boxes: [], kinds: [] };
            rig.boxes.forEach(([f, l, u, yaw, pitch, sx, sy, sz], i) => {
                const k = rig.kinds[i], turn = [M4.rz(yaw * Math.PI / 180), M4.ry(-pitch * Math.PI / 180)];
                if (k === 'disc' || k === 'pulley') {
                    part(f, l, u, sx, sy, sz, k === 'disc' ? '#8a6d3b' : '#9aa0a6', this.cyl, [M4.rx(Math.PI / 2)]);
                    part(f, l, u, sx * 1.6, sz + 2, 4, '#2a2f34', undefined, turn);
                } else { part(f, l, u, sx, sy, sz, k === 'load' ? '#c0392b' : k === 'cord' ? '#16191c' : '#a5744a', undefined, turn); }
            });
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

    root.EVN3DCore = { Scene3D, M4, hex, modelGroups, CREASE_DEG };
})(typeof self !== 'undefined' ? self : globalThis);
