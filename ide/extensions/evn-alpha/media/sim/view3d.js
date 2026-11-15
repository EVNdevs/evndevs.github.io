/* The Simulator panel's 3D view (media/sim/sim.js turns it on with its "3D" button): the course and the robot as the
 * world has them, drawn with WebGL - the tiles at their heights with their paint on them (a ramp's slope, a raised
 * tile's sides, a bridge's slab on its pillars, a seesaw at its tilt), the obstacles, speed bumps and debris, and the
 * robot at its height, pitch and roll, its wheels, sensors and distance sensors' beams, and its cameras' frusta.
 *
 * This file is the DOM shell: the canvas, its size and the theme's background read from the page (kept until they
 * change), the orbit / follow camera and the pointer. The scene itself is media/sim/render3d.js (EVN3DCore.Scene3D,
 * no DOM), which the virtual cameras' worker draws too (docs/SIMULATOR_SBC_DESIGN.md §2.4).
 *
 * The camera orbits a point (drag to turn it, Shift+drag or a right drag to move it, scroll to zoom) or follows the
 * robot from behind. Everything is built from the worker's geom message (the course, its world3d) and redrawn on each
 * snapshot; it draws nothing the 2D view does not know.
 *
 * Units: mm, the world frame x right / y up (seen from above), z up.
 */
(function () {
    'use strict';

    const { Scene3D, M4 } = window.EVN3DCore;

    /* The framing (M2P-97, owner 2026-11-12: the robot was very small in the frame, in the default view and the follow
     * cam alike, and the bottom half of the screen unused: "so the robot sits larger and lower in the view"). The default
     * camera (frameHome) is the robot's view: HOME_ELEV up, behind the robot (turned up to 0.5 rad off its back), just far
     * enough for the robot to stand HOME_ROBOT of the view's height, its centre in the bottom half (START_AT), turned and
     * placed so the course's floor fills as much of the view as it can (frameStart). The robot is the one at the start
     * when a course comes, or where it stands when the 3D view opens; the wheel zooms out to the whole course. Where no
     * such view keeps the whole robot in (no robot drawn yet, a degenerate body), the course's whole view instead: the
     * course's corners and the robot fitted to the view's aspect, its nearest point on the bottom edge. Follow stands
     * FOLLOW_SIZE robot lengths back, FOLLOW_ELEV up, and aims ahead of the robot so it sits FOLLOW_LOW of the half-height
     * below the view's centre: the bottom half shows the robot, the top half the course in front of it. frameHome /
     * followAhead are pure (window.EVN3D exports them for scripts/test_simulator.js' framing rows). */
    const FOVY = 50 * Math.PI / 180;
    const HOME_ELEV = 0.8, HOME_SWING = -0.5, HOME_MARGIN = 0.04, HOME_ROBOT = 0.25;
    const FOLLOW_ELEV = 0.5, FOLLOW_SIZE = 6.5, FOLLOW_LOW = 0.45, FOLLOW_MIN = 450, FOLLOW_MAX = 4000;

    /** the unit vector from the orbit point to the eye */
    const outOf = (yaw, elev) => [Math.cos(elev) * Math.cos(yaw), Math.cos(elev) * Math.sin(yaw), Math.sin(elev)];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    /**
     * The default camera: { tx, ty, tz, yaw, elev, dist, fit } (fit 'start' - the robot's view, frameStart - or 'course').
     * `bounds` [x0, y0, x1, y1] (mm), `start` the robot's pose ({ x, y, heading, z? }; undefined: the camera stands south
     * of the course), `aspect` the view's width / height, `body` the robot's (sim.js body3; undefined: the course's view).
     * The course's view: the eye nearest the course from which every point (the bounds' corners on the floor, and the
     * robot's box, robotBox - a 300 mm square round the pose, 150 mm up, with no body) is inside the frustum shrunk by
     * HOME_MARGIN, centred between its planes:
     * per axis of the view (right r, up u, forward f), a point p is inside while |p.r - e.r| <= t (p.f - e.f), t the half
     * angle's tangent, so e.f is at most ((min (p.f - p.r / t)) + (min (p.f + p.r / t))) / 2 and e.r is half their
     * difference times t; the tighter axis sets e.f. Across, the course is centred; up the view, its lowest point is put on
     * the bottom edge (e.u = (min (p.f + p.u / t) - e.f) t), so a view with room to spare up it has the room above the
     * course, never under it. The orbit point is where the view's centre meets the floor.
     */
    function frameHome(bounds, start, aspect, body) {
        const posed = !!(start && Number.isFinite(start.x) && Number.isFinite(start.y));
        return (body && posed && frameStart(bounds, start, aspect, body)) || frameCourse(bounds, start, aspect, body);
    }

    /** the course's whole view (frameHome's fallback): every corner of `bounds` and the robot's box at `start` fitted */
    function frameCourse(bounds, start, aspect, body) {
        const [x0, y0, x1, y1] = bounds;
        const yaw = start && Number.isFinite(start.heading) ? start.heading * Math.PI / 180 + Math.PI + HOME_SWING : -Math.PI / 2 + HOME_SWING;
        const elev = HOME_ELEV;
        const o = outOf(yaw, elev), f = [-o[0], -o[1], -o[2]];
        const r = [-Math.sin(yaw), Math.cos(yaw), 0];                         // f x z, normalised: the view's right
        const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];   // r x f: its up
        const pts = [[x0, y0, 0], [x1, y0, 0], [x0, y1, 0], [x1, y1, 0]];
        const posed = !!(start && Number.isFinite(start.x) && Number.isFinite(start.y));
        if (posed) { pts.push(...robotBox(start, body && Number.isFinite(body.front) && Number.isFinite(body.rear) && Number.isFinite(body.width) ? body : { front: 150, rear: 150, width: 300, height: 150 })); }
        const tv = Math.tan(FOVY / 2) * (1 - HOME_MARGIN), th = Math.tan(FOVY / 2) * Math.max(0.1, aspect || 1.6) * (1 - HOME_MARGIN);
        const axis = (dir, t) => {
            let a = Infinity, b = Infinity;
            for (const p of pts) { const pf = dot(p, f), pd = dot(p, dir); a = Math.min(a, pf - pd / t); b = Math.min(b, pf + pd / t); }
            return { ef: (a + b) / 2, e: (b - a) * t / 2, low: b };
        };
        const H = axis(r, th), V = axis(u, tv);
        const ef = Math.min(H.ef, V.ef);
        const eu = (V.low - ef) * tv;                                         // the course's lowest point on the bottom edge
        const eye = [0, 1, 2].map((i) => H.e * r[i] + eu * u[i] + ef * f[i]);
        const dist = Math.max(150, eye[2] / -f[2]);                           // along f to the floor (f points down)
        return { tx: eye[0] + dist * f[0], ty: eye[1] + dist * f[1], tz: 0, yaw, elev, dist, fit: 'course' };
    }

    /** the start's views tried: the camera's turn off the start's back (rad), and where the robot's centre is put in the
     *  view (NDC x across, y up) */
    const START_SWINGS = [-0.5, -0.25, 0, 0.25, 0.5], START_AT = [[0, -0.45], [-0.35, -0.45], [0.35, -0.45], [0, -0.6], [-0.3, -0.6], [0.3, -0.6], [0, -0.72]];

    /**
     * The robot's view (the default camera): of the cameras HOME_ELEV
     * up, turned START_SWINGS off the start's back, with the robot's centre at a START_AT point of the view and the
     * camera just far enough for the robot to be HOME_ROBOT high (the distance along that point's ray found by halving),
     * the one whose view is most the course's floor (a 32 x 20 grid of rays meeting the floor inside the bounds, a ray in
     * the view's bottom half counting twice - the bottom half used first; a tie keeps the earlier). The orbit point is where the view's centre meets the floor. null when no start view is whole.
     */
    function frameStart(bounds, start, aspect, body) {
        const tv = Math.tan(FOVY / 2), th = tv * Math.max(0.1, aspect || 1.6), box = robotBox(start, body);
        const rc = [start.x, start.y, (start.z || 0) + (body.height || 100) / 2];
        let best = null;
        for (const sw of START_SWINGS) {
            const yaw = (Number.isFinite(start.heading) ? start.heading * Math.PI / 180 : 0) + Math.PI + sw, elev = HOME_ELEV;
            const o = outOf(yaw, elev), f = [-o[0], -o[1], -o[2]];
            const r = [-Math.sin(yaw), Math.cos(yaw), 0];
            const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
            const ndc = (e, p) => { const d = [p[0] - e[0], p[1] - e[1], p[2] - e[2]], z = dot(d, f); return z > 0 ? [dot(d, r) / (z * th), dot(d, u) / (z * tv)] : null; };
            for (const [x, y] of START_AT) {
                const d = [0, 1, 2].map((k) => f[k] + x * th * r[k] + y * tv * u[k]);
                const eyeAt = (sv) => [rc[0] - sv * d[0], rc[1] - sv * d[1], rc[2] - sv * d[2]];
                const tall = (e) => { let lo = Infinity, hi = -Infinity; for (const p of box) { const q = ndc(e, p); if (!q) { return Infinity; } lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); } return (hi - lo) / 2; };
                let near = 10, far = 1e5;
                for (let i = 0; i < 50; i++) { const mid = (near + far) / 2; if (tall(eyeAt(mid)) > HOME_ROBOT) { near = mid; } else { far = mid; } }
                const eye = eyeAt(far);
                if (!(eye[2] > 0) || !box.every((p) => { const q = ndc(eye, p); return q && Math.abs(q[0]) <= 1 - HOME_MARGIN && Math.abs(q[1]) <= 1 - HOME_MARGIN; })) { continue; }
                let hit = 0;
                for (let j = 0; j < 20; j++) {
                    for (let i = 0; i < 32; i++) {
                        const a = -1 + (i + 0.5) / 16, b = -1 + (j + 0.5) / 10;
                        const ray = [0, 1, 2].map((k) => f[k] + a * th * r[k] + b * tv * u[k]);
                        if (ray[2] >= 0) { continue; }
                        const t = -eye[2] / ray[2], px = eye[0] + t * ray[0], py = eye[1] + t * ray[1];
                        if (px >= bounds[0] && px <= bounds[2] && py >= bounds[1] && py <= bounds[3]) { hit += j < 10 ? 2 : 1; }
                    }
                }
                if (!best || hit > best.hit) {
                    const dist = eye[2] / -f[2];
                    best = { hit, cam: { tx: eye[0] + dist * f[0], ty: eye[1] + dist * f[1], tz: 0, yaw, elev, dist, fit: 'start' } };
                }
            }
        }
        return best && best.cam;
    }

    /** the robot's box at `pose` for a `body` (front and rear from the axle, width, height): its eight corners */
    function robotBox(pose, body) {
        const h = (pose.heading || 0) * Math.PI / 180, c = Math.cos(h), s = Math.sin(h), out = [];
        for (const fw of [Math.abs(body.front), -Math.abs(body.rear)]) {
            for (const l of [-body.width / 2, body.width / 2]) { for (const z of [0, body.height || 100]) { out.push([pose.x + fw * c - l * s, pose.y + fw * s + l * c, (pose.z || 0) + z]); } }
        }
        return out;
    }

    /** Follow's distance for a robot `body` (sim.js body3: front and rear, each mm from the axle, and width):
     *  FOLLOW_SIZE of its longest side, FOLLOW_MIN to FOLLOW_MAX */
    function followDist(body) {
        const size = body ? Math.max(Math.abs(body.front) + Math.abs(body.rear), Math.abs(body.width)) : 200;
        return Math.max(FOLLOW_MIN, Math.min(FOLLOW_MAX, FOLLOW_SIZE * (Number.isFinite(size) && size > 0 ? size : 200)));
    }

    /** How far ahead of the robot (mm, along the floor, away from the eye) Follow aims, for a camera `dist` back and
     *  `elev` up, so the robot is `low` (FOLLOW_LOW) of the half-height below the centre: the robot is seen at elev + d
     *  below the horizon (tan d = low tan(FOVY / 2)), so it lies dist sin(elev) / tan(elev + d) out from the eye's foot */
    function followAhead(dist, elev, low = FOLLOW_LOW) {
        const d = Math.atan(low * Math.tan(FOVY / 2));
        return dist * (Math.cos(elev) - Math.sin(elev) / Math.tan(elev + d));
    }

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
            this.scene = this.newScene();
            // a lost context (a GPU reset, or Chromium dropping the oldest of too many): nothing drawn while lost, and the
            // scene rebuilt on the same canvas when the browser restores it (preventDefault asks for that; review rcjcam r1 B1)
            this.lost = false;
            canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
            canvas.addEventListener('webglcontextrestored', () => {
                const seesawDeg = this.scene.seesawDeg, seesawT = this.scene.seesawT;
                this.scene = this.newScene();
                this.scene.seesawDeg = seesawDeg; this.scene.seesawT = seesawT;
                if (this.hw) { this.scene.setHw(this.hw, this.body); }
                this.scene.setFloor(this.floor);
                if (this.geom) { this.scene.setGeom(this.geom); }
                if (this.snap) { this.scene.setSnap(this.snap); }
                this.lost = false;
                if (this.onChange) { this.onChange(); }
            });
            this.cam = { tx: 0, ty: 0, tz: 0, yaw: -2.2, elev: 0.75, dist: 2400 };
            this.following = false;
            this.homed = false;             // the camera is home()'s, for the view's aspect homeAspect: a resize frames it again
            this.homeAspect = 0;
            this.hw = undefined;
            this.geom = undefined;
            this.floor = null;
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
                    // a pan stops Follow where it is (the setter's home view is for the button), and says so to the panel
                    if (this.following) { this.following = false; if (this.onFollowOff) { this.onFollowOff(); } }
                } else {
                    this.cam.yaw = d.cam.yaw - dx * 0.008;
                    this.cam.elev = Math.max(0.05, Math.min(1.5, d.cam.elev + dy * 0.006));
                }
                this.homed = false;
                this.onChange && this.onChange();
            });
            canvas.addEventListener('pointerup', () => { this.drag = undefined; });
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.cam.dist = Math.max(150, Math.min(20000, this.cam.dist * Math.exp(e.deltaY * 0.0015)));
                this.homed = false;
                this.onChange && this.onChange();
            }, { passive: false });
        }

        get ok() { return !!this.gl; }

        /** Follow (sim.js's button): turned on, the camera goes to Follow's distance and height for this robot (the wheel
         *  still zooms it); turned off, back to the course's view */
        get follow() { return this.following; }
        set follow(on) {
            on = !!on;
            // no WebGL (the constructor stopped before its camera): only the state is kept, as setGeom keeps only the geom
            if (!this.gl) { this.following = on; return; }
            if (on && !this.following) { this.cam.dist = followDist(this.body); this.cam.elev = FOLLOW_ELEV; this.homed = false; }
            const was = this.following;
            this.following = on;
            if (!on && was && this.geom) { this.home(this.snap && this.snap.pose); }
        }

        /** the view's width / height (the canvas's box; 1.6 before it has one) */
        aspect() {
            const r = this.canvas.getBoundingClientRect();
            return r && r.width > 0 && r.height > 0 ? r.width / r.height : 1.6;
        }

        /** the scene: with the EVN board and peripherals' models (docs/SIMULATOR_MODELS_DESIGN.md M5; the page's
         *  media/sim/models/*.js scripts, window.EVNModels) and the Models button's setting */
        newScene() {
            const sc = new Scene3D(this.gl, { canvas2d: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }), showCams: true, cull: true, names: true, models: true });
            // a model's texture decoded (OQ 496: the board's art) after the scene was drawn: drawn again
            sc.onModelsReady = () => { if (this.onChange) { this.onChange(); } };
            sc.setModels(window.EVNModels);
            sc.showModels = this.showModels !== false;
            // CC-8's Show names (lane cc8): the names and the toggle the page last gave (a scene rebuilt after a lost context)
            sc.setNames(this.names || null);
            sc.showNames = !!this.namesShown;
            return sc;
        }

        /** CC-8's Show names (sim.js: the worker's `names` and the button; COURSE_CONTENT_DESIGN.md §6 "The names"): the named
         *  items, or null, and whether they are drawn */
        setNames(names, shown) {
            if (this.names !== names) { this.names = names || null; if (this.scene) { this.scene.setNames(this.names); } }
            this.namesShown = !!shown;
            if (this.scene) { this.scene.showNames = this.namesShown; }
        }

        /** the Models button (sim.js): the models drawn (true) or the robot drawing's boxes (false) */
        get models() { return this.showModels !== false; }
        set models(on) { this.showModels = !!on; if (this.scene) { this.scene.showModels = this.showModels; } }

        /** the seesaws' tilt and thickness the panel's config gives (sim.js), handed to the scene */
        get seesawDeg() { return this.scene && this.scene.seesawDeg; }
        set seesawDeg(v) { if (this.scene) { this.scene.seesawDeg = v; } }
        get seesawT() { return this.scene && this.scene.seesawT; }
        set seesawT(v) { if (this.scene) { this.scene.seesawT = v; } }

        /** a new course: the scene's static meshes, and the camera on the robot at `pose` (sim.js set3d: where it stands
         *  as the 3D view opens), else at the course's start */
        setGeom(geom, pose) {
            this.geom = geom;
            if (!this.gl) { return; }
            this.scene.setGeom(geom);
            this.home(pose);
        }

        /** the WRO floor's texture (render3d.js Scene3D.setFloor), or null */
        setFloor(floor) {
            this.floor = floor || null;
            if (this.scene) { this.scene.setFloor(this.floor); }
        }

        /** the default camera on the robot at `pose` (else the course's start; frameHome), kept for a re-frame on a resize;
         *  or Follow's behind the robot while Follow is on */
        home(pose) {
            if (this.following) { this.cam.dist = followDist(this.body); this.cam.elev = FOLLOW_ELEV; this.homed = false; return; }
            this.homePose = pose && Number.isFinite(pose.x) && Number.isFinite(pose.y) ? { ...pose } : this.geom.start;
            this.homeAspect = this.aspect();
            Object.assign(this.cam, frameHome(this.geom.bounds, this.homePose, this.homeAspect, this.body));
            this.homed = true;
        }

        setHw(hw, body) { this.hw = hw; this.body = body; if (this.scene) { this.scene.setHw(hw, body); } }

        setSnap(snap) { this.snap = snap; if (this.scene) { this.scene.setSnap(snap); } }

        render() {
            const gl = this.gl;
            if (!gl || !this.geom || this.lost) { return; }
            const cv = this.canvas, dpr = window.devicePixelRatio || 1;
            if (!this.keep || !this.rect || this.rectDpr !== dpr) { this.rect = cv.getBoundingClientRect(); this.rectDpr = dpr; }
            const r = this.rect;
            const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
            if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
            if (!this.keep || this.bg === null) { this.bg = getComputedStyle(document.body).getPropertyValue('--stage').trim() || '#e9e9eb'; }
            const bg = this.bg;
            const s = this.snap;
            // the camera: following the robot from behind and above, or orbiting its point
            const cam = this.cam;
            // the course's view framed again for a view of another shape (a resize, the readouts docked), until it is moved
            // ...on the robot where it stands now (review r2 SF2: the pose the view was homed at may be far behind it)
            if (this.homed && Math.abs(W / H - this.homeAspect) > 1e-3) {
                if (s && s.pose && Number.isFinite(s.pose.x) && Number.isFinite(s.pose.y)) { this.homePose = { ...s.pose }; }
                Object.assign(cam, frameHome(this.geom.bounds, this.homePose, W / H, this.body)); this.homeAspect = W / H;
            }
            if (this.following && s) {
                const want = (s.pose.heading * Math.PI / 180) + Math.PI;
                let d = want - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
                // eased by time, 0.15 of the way per 33.3 ms (the rate it had at a render a snapshot), so the swing is the
                // same at any display rate now that a live world renders every frame (simstall, review r1 S2)
                const now = performance.now(), dt = this.followAt === undefined ? 1000 / 30 : Math.min(200, Math.max(0, now - this.followAt));
                this.followAt = now;
                cam.yaw += d * (1 - Math.pow(0.85, dt / (1000 / 30)));
                // aimed ahead of the robot (away from the eye), so the robot sits low in the view (followAhead)
                const a = followAhead(cam.dist, cam.elev);
                cam.tx = s.pose.x - a * Math.cos(cam.yaw); cam.ty = s.pose.y - a * Math.sin(cam.yaw); cam.tz = s.pose.z || 0;
            } else { this.followAt = undefined; }
            const eye = [cam.tx + cam.dist * Math.cos(cam.elev) * Math.cos(cam.yaw), cam.ty + cam.dist * Math.cos(cam.elev) * Math.sin(cam.yaw), cam.tz + cam.dist * Math.sin(cam.elev)];
            const proj = M4.persp(FOVY, W / H, Math.max(5, cam.dist / 200), cam.dist * 20 + 20000);
            const vp = M4.mul(proj, M4.look(eye, [cam.tx, cam.ty, cam.tz], [0, 0, 1]));
            this.scene.frame(vp, W, H, bg);
        }
    }

    window.EVN3D = { create: (canvas) => new View3D(canvas), frameHome, frameCourse, followDist, followAhead, robotBox, FOVY, HOME_ROBOT };
})();
