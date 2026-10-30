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
            this.follow = false;
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

        newScene() { return new Scene3D(this.gl, { canvas2d: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }), showCams: true }); }

        /** the seesaws' tilt and thickness the panel's config gives (sim.js), handed to the scene */
        get seesawDeg() { return this.scene && this.scene.seesawDeg; }
        set seesawDeg(v) { if (this.scene) { this.scene.seesawDeg = v; } }
        get seesawT() { return this.scene && this.scene.seesawT; }
        set seesawT(v) { if (this.scene) { this.scene.seesawT = v; } }

        /** a new course: the scene's static meshes, and the camera over it */
        setGeom(geom) {
            this.geom = geom;
            if (!this.gl) { return; }
            this.scene.setGeom(geom);
            this.home();
        }

        /** the WRO floor's texture (render3d.js Scene3D.setFloor), or null */
        setFloor(floor) {
            this.floor = floor || null;
            if (this.scene) { this.scene.setFloor(this.floor); }
        }

        /** the camera over the course */
        home() {
            const b = this.geom.bounds;
            this.cam.tx = (b[0] + b[2]) / 2; this.cam.ty = (b[1] + b[3]) / 2; this.cam.tz = 0;
            this.cam.dist = Math.max(900, 0.9 * Math.max(b[2] - b[0], b[3] - b[1]));
            this.cam.yaw = -Math.PI / 2 - 0.5; this.cam.elev = 0.8;
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
            if (this.follow && s) {
                cam.tx = s.pose.x; cam.ty = s.pose.y; cam.tz = s.pose.z || 0;
                const want = (s.pose.heading * Math.PI / 180) + Math.PI;
                let d = want - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
                cam.yaw += d * 0.15;
            }
            const eye = [cam.tx + cam.dist * Math.cos(cam.elev) * Math.cos(cam.yaw), cam.ty + cam.dist * Math.cos(cam.elev) * Math.sin(cam.yaw), cam.tz + cam.dist * Math.sin(cam.elev)];
            const proj = M4.persp(50 * Math.PI / 180, W / H, Math.max(5, cam.dist / 200), cam.dist * 20 + 20000);
            const vp = M4.mul(proj, M4.look(eye, [cam.tx, cam.ty, cam.tz], [0, 0, 1]));
            this.scene.frame(vp, W, H, bg);
        }
    }

    window.EVN3D = { create: (canvas) => new View3D(canvas) };
})();
