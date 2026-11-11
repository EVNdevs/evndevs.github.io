/* ------------------------------------------------------------------------------------------------
   EVN ALPHA - the home page's 3D board (the scroll story's visual layer).

   Loaded by site.js (startStage) only after the page has loaded, when idle and when the stage is on screen, only where it
   can help: a browser with IntersectionObserver and WebGL, no prefers-reduced-motion, no Save-Data. Everything the page
   says is in the HTML around it; this layer is decorative (its canvas is aria-hidden) and the photo under it
   (site.js STAGE_STILL, assets/images/stage-board.webp, the marketing pipeline's render from the same view) is what every
   other visitor sees.

   three.js r163 from cdn.jsdelivr.net, pinned (index.html's import map: "three" and "three/addons/"). Size: the core
   about 680 KB (about 170 KB compressed), RoundedBoxGeometry and RoomEnvironment about 8 KB; GLTFLoader (108 KB) and the
   meshopt decoder (about 20 KB) only when a model file is named in assets/3d/models.json; RGBELoader (12 KB) and the
   studio HDRI (models.json `environment`: the marketing renders' own room, 400 KB) beside the board; the bloom passes
   (about 30 KB) only on a wide screen whose speed test came in under 25 ms a frame.

   The look: lit by the renders' studio HDRI turned as they turn it (RoomEnvironment only if it does not load), tone-mapped
   ACES at 0.85; bloom (UnrealBloomPass, threshold 0.92) catches only what emits: the board's red power LED, the colour
   sensor's white LEDs. The clear lid is drawn as glass (glassLid): reflections added over what is behind it, nearly clear
   face-on, its edges catching the light. If the frame watch finds the scenes slow, the bloom goes first.

   The models (assets/3d/models.json): `board`, the marketing repository's Blender model of the board (+Y up, each part
   group a node "grp_<group>"); `scenes`, one per chapter, the marketing scenes built around that same board and exported
   without it (its motors, peripherals, cables, the sample robot), loaded one after another once the board is up, each
   placed in the board's frame; with `board` null a placeholder is built here from boxes and there are no scenes.

   The entrance (owner, 2026-11-11: "assemble the evn like a user would"): nothing starts until the board and the HDRI are
   both in; then the photo fades out fast, the canvas fades in as the bottom shell drops in, and the board is put
   together on a clock (ASSEMBLY: the shell, the populated PCB, the lid, the four screws turning in one after another, the
   two cells from below, the battery cover from the side, then the red power LED comes on), 4.6 s in all - under the 5 s
   WCAG 2.2.2 allows moving content that starts on its own - and any scroll, key or pointer press finishes it at once.
   Every animation runs on the clock, never on a frame count, so a slow renderer jumps rather than stalls.

   The scroll story: the stage's progress (0 at its top, 1 when its last chapter has scrolled past) picks a pose between
   keyframes, one per chapter; the camera frames that pose's scene (its outline with the board's) and the board eases
   towards the pose. Each scene is a set of items (sceneItems: a motor with its cable and plugs, a sensor with its cable),
   each plugged in along its own direction as its chapter arrives (a LEGO motor's out of its jack, horizontally; the
   gearmotor and the sensors onto their header pins from above; the robot from above; a laptop from behind) and pulled
   out the same way after: in a transition the first half takes the current chapter's items out, the bare board stands at
   the midpoint, the second half plugs the next chapter's in. Something that lights (the colour sensor) lights only once
   it is plugged in. With a mouse, an item under the pointer is lit and lifted a little and a motor turns its hub.
   Nothing moves on its own (WCAG 2.2.2): after the entrance the loop renders only while something eases to a scroll
   position or a hover, then idles. The entrance's frames are the speed test: a median over 45 ms and the layer removes
   itself, leaving the photo. Leaving the page, a lost WebGL context or reduced motion switched on stop it, and stop()
   frees the GPU.
   ------------------------------------------------------------------------------------------------ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ACCENT = 0xa8977b;
const ENV_INTENSITY = 0.6;                                          // the environment's reflections (models.json environment.intensity overrides)

/* one pose per stop of the story (the first screen, then one per `article.chapter` of the stage, in order): the board's
   rotation (rx, ry), the scene shown (a key of models.json `scenes`, or null: the board alone; a key models.json does not
   name yet shows the board alone too), whether the board is shown (board: false, the laptop alone: the board fades out
   across the transition to it), and how tightly the camera frames it (zoom, default 1: above 1 smaller). Wide (over
   1100 px): the scene's outline fills its photoreal render's box (fitWide); in the stacked layout (1100 px and under, the
   same breakpoint as site.css: phones and tablets) the same, the still's own box on the first screen (measure) */
const POSES = [
  { rx: 0.42, ry: -0.62, scene: null },                      // the first screen: the board
  { rx: 0.5, ry: -0.95, scene: 'motors' },                   // motors: EV3, NXT and a gearmotor, cabled
  { rx: 0.55, ry: 0.15, scene: 'sensors' },                  // sensors: four sensors on I2C ports
  { rx: 0.395, ry: -0.875, scene: 'code' },                  // code: a laptop with a USB-C cable to the board (models.json scenes.code, coming)
  { rx: 0.48, ry: -2.25, scene: 'robot' },                   // the WRO drive base
  { rx: 0.255, ry: -0.525, scene: 'simulator', board: false } // the simulator: the laptop alone
];
const STACKED = '(max-width: 1100px)';
const PHONE = '(max-width: 760px)';                                  // phones: models.json phone_scenes only

/* the entrance, in seconds from its first frame: each step's start (t) and length (d); the screws and the cells one after
   another (gap); each part comes from `from` board lengths away along its own direction (the board's frame, +Y up).
   4.54 s in all (WCAG 2.2.2: under 5 s) */
const ASSEMBLY = {
  base: { t: 0.0, d: 0.6, from: 0.9 },                       // the bottom shell, from above
  pcb: { t: 0.72, d: 0.6, from: 0.9 },                       // the populated PCB with the battery holder, from above
  shield: { t: 1.44, d: 0.56, from: 0.9 },                   // the clear lid, from above
  bolts: { t: 2.12, d: 0.5, gap: 0.16, from: 0.6, turns: 3 }, // the four screws, from above, turning in
  cells: { t: 3.22, d: 0.4, gap: 0.22, from: 0.6 },          // the two cells, from below
  cover: { t: 3.96, d: 0.42, from: 0.8 },                    // the battery cover, from the side along the long axis
  led: { t: 4.42, d: 0.12 }                                  // the red power LED comes on
};
const ASSEMBLY_END = ASSEMBLY.led.t + ASSEMBLY.led.d;
const ENTRANCE_TURN = 0.3;                                   // the board turns this far into its first pose as it assembles

/* how each scene's items plug in: 'plugs' (a LEGO motor out of its jack, horizontally; an item with a header connector
   from above), 'above', 'behind' (from the board's back, as a whole); `from`: the travel, in board lengths */
const SCENE_MOTION = {
  motors: { mode: 'plugs', from: 0.55 },
  sensors: { mode: 'above', from: 0.45 },
  robot: { mode: 'above', whole: true, from: 0.7 },
  code: { mode: 'behind', whole: true, from: 0.8, usb: true, screenOn: true },   // usb: plugged in, it lights the board's green LED
  simulator: { mode: 'behind', whole: true, from: 0.8, screenOn: true },          // screenOn: a laptop's screen is never dark
  displays: { mode: 'above', from: 0.45 }
};
const STAGGER = 0.3;                                         // the items' insertions spread over this much of the half-transition

function lerp(a, b, t) { return a + (b - a) * t; }
function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function clamp01(t) { return Math.min(1, Math.max(0, t)); }

/* ---- the placeholder board -------------------------------------------------------------------------------- */
function placeholderBoard() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf1eee9, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.6 });
  const pcb = new THREE.MeshStandardMaterial({ color: 0x0f4a2a, roughness: 0.7, metalness: 0.05 });
  const chip = new THREE.MeshStandardMaterial({ color: 0x0d0f11, roughness: 0.35 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a352, roughness: 0.3, metalness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9bdc2, roughness: 0.25, metalness: 0.95 });

  const W = 4.2, H = 1.0, D = 2.5;                       // the housing: long side x, the ports' face +z
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 0.12), white);
  g.add(base);
  /* Technic holes: two rows on each long side, one row on the ends */
  const hole = new THREE.CylinderGeometry(0.15, 0.15, 0.06, 20);
  for (let i = 0; i < 9; i++) {
    const x = -W / 2 + 0.45 + i * ((W - 0.9) / 8);
    const back = new THREE.Mesh(hole, dark);
    back.rotation.x = Math.PI / 2;
    back.position.set(x, 0.0, -D / 2 - 0.005);
    g.add(back);
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const h = new THREE.Mesh(hole, dark);
      h.rotation.z = Math.PI / 2;
      h.position.set(s * (W / 2 + 0.005), 0.0, -D / 2 + 0.45 + i * ((D - 0.9) / 3));
      g.add(h);
    }
  }
  /* four RJ12 motor ports in the front face, their contacts gold */
  for (let i = 0; i < 4; i++) {
    const x = -1.35 + i * 0.9;
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.3), dark);
    port.position.set(x, -0.08, D / 2 - 0.12);
    g.add(port);
    for (let k = 0; k < 6; k++) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.2), gold);
      pin.position.set(x - 0.16 + k * 0.064, 0.1, D / 2 - 0.1);
      g.add(pin);
    }
  }
  /* the board under the cover: the green PCB, its chips, header strips and the USB-C socket */
  const board = new THREE.Group();
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.06, D - 0.4), pcb);
  board.add(sheet);
  [[-0.6, 0.2, 0.9, 0.9], [0.65, -0.25, 0.55, 0.55], [1.35, 0.45, 0.4, 0.3], [-1.5, -0.45, 0.45, 0.35], [0.2, 0.55, 0.3, 0.25]]
    .forEach(([x, z, w, d]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), chip);
      c.position.set(x, 0.07, z);
      board.add(c);
    });
  for (const z of [-0.85, 0.85]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.12), dark);
    strip.position.set(0.1, 0.09, z);
    board.add(strip);
    for (let k = 0; k < 16; k++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), gold);
      p.position.set(-1.3 + k * 0.187, 0.17, z);
      board.add(p);
    }
  }
  const usb = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.14, 0.3, 2, 0.05), steel);
  usb.position.set(W / 2 - 0.35, 0.1, -0.2);
  board.add(usb);
  board.position.y = H / 2 - 0.02;
  g.add(board);
  /* the clear cover, lifted in chapter 02 */
  const cover = new THREE.Mesh(new RoundedBoxGeometry(W, 0.38, D, 4, 0.1),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.2,
                                     clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false }));
  cover.position.y = H / 2 + 0.2;
  g.add(cover);
  g.userData.cover = cover;
  return g;
}

/* a soft shadow under the board, drawn once into a canvas */
function shadowPlane() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const r = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, 'rgba(0,0,0,0.55)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = r;
  x.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.62;
  return m;
}


let loaderP = null;
function gltfLoader() {
  if (!loaderP) {
    loaderP = Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')])
      .then(([{ GLTFLoader }, { MeshoptDecoder }]) => { const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder); return l; });
  }
  return loaderP;
}

/* the board: its glTF scene scaled to the placeholder's 4.2 units of length and centred; `frame` is that transform, which
   every chapter scene takes too (they are in the board's own frame); `L`, `center` and `half` the board's size in that
   frame (the glTF's own units) */
async function loadModel(models, onProgress) {
  if (!models || !models.board) { return placeholderBoard(); }
  const loader = await gltfLoader();
  const gltf = await loader.loadAsync(new URL(models.board, document.baseURI).href, onProgress);
  const g = new THREE.Group();
  const scene = gltf.scene;
  const lid = scene.getObjectByName('grp_shield');
  if (lid) { lid.traverse((o) => { for (const m of [].concat(o.material || [])) { if (m.transmission > 0) { glassLid(m); } } }); }
  softenEnv(scene);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const L = Math.max(size.x, size.z);
  const k = 4.2 / L;
  const c = box.getCenter(new THREE.Vector3());
  g.userData.frame = { k, offset: c.clone().multiplyScalar(-k) };
  g.userData.L = L;
  g.userData.center = c;
  g.userData.half = size.clone().multiplyScalar(0.5);
  scene.scale.setScalar(k);
  scene.position.copy(g.userData.frame.offset);
  g.add(scene);
  decalOffsets(scene);
  return g;
}

/* a transmissive material (the scenes' clear LEGO parts) drawn as plain transparency: three's transmission samples a
   blurred, lower-resolution copy of what is behind it, which washes out what is under it, and costs a render pass */
function softenEnv(root) {
  root.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      if (m.transmission > 0) {
        m.transmission = 0;
        m.transparent = true;
        m.opacity = 0.16;
        m.roughness = 0.05;
        m.depthWrite = false;
        m.needsUpdate = true;
      }
    }
  });
}
/* the board's clear lid as glass (owner, 2026-11-11: "evn alpha top shell is too frosted still, compare with blender
   render"): no diffuse colour (plain transparency's white at 0.16 was the haze), its reflections added over what is behind
   it (premultiplied blending without the multiply: ONE, ONE_MINUS_SRC_ALPHA), and an alpha that is all but clear face-on
   and rises towards grazing angles, so the lid's edges and curves catch the light and darken a little as glass does.
   `userData.fade` fades the whole lid with the board (a pose with board: false). Then (owner, 2026-11-11: "Clear top is now
   a tad dark"): its edges darken less (0.4, was 0.7) over a narrower band (the rim's power 3, was 2), face-on 0.025 */
const GLASS_FACE = 0.025, GLASS_EDGE = '0.4', GLASS_RIM = '3.0';
function glassLid(m) {
  m.transmission = 0;
  m.transparent = true;
  m.premultipliedAlpha = true;
  m.depthWrite = false;
  m.color.setRGB(0, 0, 0);
  m.roughness = 0.03;
  m.metalness = 0;
  m.clearcoat = 0.5;
  m.clearcoatRoughness = 0.03;
  m.opacity = GLASS_FACE;
  const fade = { value: 1 };
  m.userData.fade = fade;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFade = fade;
    sh.fragmentShader = 'uniform float uFade;\n' + sh.fragmentShader
      .replace('#include <opaque_fragment>', [
        'float evnRim = pow( 1.0 - saturate( abs( dot( geometryViewDir, normal ) ) ), ' + GLASS_RIM + ' );',
        'diffuseColor.a = mix( diffuseColor.a, ' + GLASS_EDGE + ', evnRim ) * uFade;',
        'outgoingLight *= uFade;',
        '#include <opaque_fragment>'].join('\n'))
      .replace('#include <premultiplied_alpha_fragment>', '');
  };
  m.customProgramCacheKey = () => 'evn-glass-lid';
  m.needsUpdate = true;
}

/* ---- the decals (owner, 2026-11-11: "Texture on some of the components only show at specific angles ..."): the art
   layers, screens and part markings are lifted 0.03 mm off their surfaces in the GLBs themselves
   (docs/session/2026-11-10_site76/data/bake_decals.mjs; review site76_r7 B1: done here, in the browser, it cost 2.3 s
   of the main thread). Here they only draw with a small polygon offset towards the camera, which needs no sign */
function decalMaterial(m) { return !!(m && (m.map || m.emissiveMap || /^mark_/i.test(m.name || ''))); }
function decalOffsets(root) {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) { return; }
    for (const m of [].concat(o.material)) { if (decalMaterial(m) && !m.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; n++; } }
  });
  return n;
}

/* a vector of `from`'s frame in `to`'s frame (a direction and length, not a point) */
function vecIn(from, to, v) {
  from.updateMatrixWorld(true);
  to.updateMatrixWorld(true);
  const a = to.worldToLocal(from.localToWorld(new THREE.Vector3(0, 0, 0)));
  return to.worldToLocal(from.localToWorld(v.clone())).sub(a);
}
/* the centre of an object's meshes in `frame`'s own frame */
function centreIn(frame, obj) { return localBox(frame, [obj]).getCenter(new THREE.Vector3()); }
/* the board's face a point lies off: the horizontal axis (x or z) on which it is furthest out for the board's size */
function faceAxis(model, p) {
  const c = model.userData.center, h = model.userData.half;
  const dx = (p.x - c.x) / Math.max(1e-6, h.x), dz = (p.z - c.z) / Math.max(1e-6, h.z);
  return Math.abs(dx) >= Math.abs(dz) ? new THREE.Vector3(Math.sign(dx) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(dz) || 1);
}
/* moves `kids` (children of `parent`) under a new group at their centre: the pivot a screw turns about, or a cell's own
   group */
function pivotOf(parent, kids) {
  const p = new THREE.Group();
  const c = new THREE.Box3();
  for (const o of kids) { c.union(localBox(parent, [o])); }
  p.position.copy(c.getCenter(new THREE.Vector3()));
  parent.add(p);
  p.updateMatrixWorld(true);
  for (const o of kids) { p.attach(o); }
  return p;
}

/* ---- the entrance: the board put together (owner, 2026-11-11) -------------------------------------------------
   Each part: the node moved, its place (base), where it comes from (off, in its parent's frame: the board's frame, +Y up)
   and its step. The screws each get a pivot at their centre, to turn about their own vertical axis as they go down; the
   eight cell meshes are grouped into the two cells by where they lie. The red LED: LED3_C2286 (LCSC C2286, a red 0603) */
function buildAssembly(model) {
  const A = { parts: [], led: null };
  const scene = model.children[0];
  if (!scene || !model.userData.L) { return A; }
  const L = model.userData.L;
  const up = new THREE.Vector3(0, 1, 0);
  const add = (obj, step, dir, extra) => {
    if (!obj) { return; }
    A.parts.push(Object.assign({ obj, base: obj.position.clone(), off: vecIn(scene, obj.parent, dir.clone().multiplyScalar(step.from * L)),
                                 t: step.t, d: step.d }, extra || {}));
  };
  const by = (n) => scene.getObjectByName(n);
  add(by('grp_base'), ASSEMBLY.base, up);
  for (const n of ['grp_pcb', 'grp_synth', 'grp_holder']) { add(by(n), ASSEMBLY.pcb, up); }
  add(by('grp_shield'), ASSEMBLY.shield, up);
  const bolts = by('grp_bolts');
  if (bolts) {
    const pv = bolts.children.slice().map((b) => pivotOf(bolts, [b]));
    pv.sort((a, b) => (a.position.z - b.position.z) || (a.position.x - b.position.x));
    /* one after another round the board: the two at one end, then the two at the other, crossing over */
    const order = pv.length === 4 ? [pv[0], pv[3], pv[1], pv[2]] : pv;
    order.forEach((p, i) => add(p, Object.assign({}, ASSEMBLY.bolts, { t: ASSEMBLY.bolts.t + i * ASSEMBLY.bolts.gap }), up,
                               { turns: ASSEMBLY.bolts.turns }));
  }
  const cells = by('grp_cells');
  if (cells && cells.children.length) {
    const kids = cells.children.slice(), cs = kids.map((o) => centreIn(cells, o));
    const spread = ['x', 'y', 'z'].map((a) => Math.max(...cs.map((c) => c[a])) - Math.min(...cs.map((c) => c[a])));
    const ax = ['x', 'y', 'z'][spread.indexOf(Math.max(...spread))];
    const mid = (Math.max(...cs.map((c) => c[ax])) + Math.min(...cs.map((c) => c[ax]))) / 2;
    const two = [kids.filter((o, i) => cs[i][ax] < mid), kids.filter((o, i) => cs[i][ax] >= mid)].filter((s) => s.length);
    two.forEach((s, i) => add(pivotOf(cells, s), Object.assign({}, ASSEMBLY.cells, { t: ASSEMBLY.cells.t + i * ASSEMBLY.cells.gap }),
                             new THREE.Vector3(0, -1, 0)));
  }
  const h = model.userData.half;
  /* the battery cover slides in from the face the USB-C port is on (owner, 2026-11-11: "battery cover is sliding in from
     the wrong direction, should be from the side where the USB c port is"): USB1 (LCSC C2765186) sits mid-way along the
     board's long +x face, so the cover comes in sideways from there (it had come along the long axis, from an end) */
  const usb = by('USB1_C2765186');
  add(by('grp_cover'), ASSEMBLY.cover, usb ? faceAxis(model, centreIn(scene, usb)) : new THREE.Vector3(1, 0, 0));
  /* each part its own materials (the model shares them between parts: the shell and the cover are one white), so a part
     fades in alone as it comes (PART_FADE); the glass lid keeps its own, faded through its uniform */
  for (const p of A.parts) {
    const own = new Map();
    p.obj.traverse((o) => {
      if (!o.isMesh) { return; }
      const ms = [].concat(o.material).map((m) => { if (m.userData.fade) { return m; } if (!own.has(m)) { own.set(m, m.clone()); } return own.get(m); });
      o.material = ms.length === 1 ? ms[0] : ms;
    });
  }
  A.leds = { power: boardLed(model, LEDS.power), usb: boardLed(model, LEDS.usb) };
  A.led = A.leds.power;
  for (const p of A.parts) {
    const set = new Set();
    p.obj.traverse((o) => { if (o.isMesh) { for (const m of [].concat(o.material)) { set.add(m); } } });
    p.mats = [...set];
    p.alpha = 1;
  }
  return A;
}
/* the board's LEDs (owner, 2026-11-11: "Red led is too dark"; "When the laptop is plugged into the evn, the green led on the
   evn should also come on"): docs/EVN ALPHA Hardware Reference.md's LED table, LED3 (C2286, red) power on, LED6 (C72043,
   green) USB cable connected. The lens is the LED's body, named per LED from the model (review site76_r7 S1: picked as the
   most saturated material it was LED6's terminals): `2`, the 0603's epoxy body, and in LED3 also `5.001`, the placeholder
   under it (lit alone it hid inside the body: "Red led is too dark"). Each its own material, its own colour when off; on,
   it emits, a small light just above it brightens what is round it, and a soft glow sprite (added light, so it reads as
   lit with or without the bloom pass) sits over it */
const LEDS = {
  power: { node: 'LED3_C2286', lens: ['2', '5.001'], lit: 0xff5a40, emissive: 0xff2008, light: 0xff2a14 },
  usb: { node: 'LED6_C72043', lens: ['2'], lit: 0x7cff90, emissive: 0x20ff48, light: 0x38ff58 }
};
const LED_EMISSIVE = 16, LED_LIGHT = 0.35, LED_GLOW = 0.9, LED_GLOW_SIZE = 0.3;
let glowTex = null;
function glowTexture() {
  if (glowTex) { return glowTex; }
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const r = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = r;
  x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
function boardLed(model, spec) {
  const led = model.children[0] && model.children[0].getObjectByName(spec.node);
  if (!led) { return null; }
  const own = new Map();
  led.traverse((o) => {
    if (!o.isMesh) { return; }
    const ms = [].concat(o.material).map((m) => {
      if (!m.emissive || !spec.lens.includes(m.name)) { return m; }
      if (!own.has(m)) {
        const c = m.clone();
        c.userData.c0 = c.color.clone();
        c.emissive.setHex(spec.emissive);
        c.emissiveIntensity = 0;
        own.set(m, c);
      }
      return own.get(m);
    });
    o.material = ms.length === 1 ? ms[0] : ms;
  });
  const lens = [...own.values()];
  if (!lens.length) { return null; }
  const at = centreIn(model, led).add(new THREE.Vector3(0, 0.05, 0));
  const light = new THREE.PointLight(spec.light, 0, 1.6, 2);
  light.position.copy(at);
  model.add(light);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: spec.light, blending: THREE.AdditiveBlending,
                                                          transparent: true, depthWrite: false, opacity: 0 }));
  glow.scale.setScalar(LED_GLOW_SIZE);
  glow.position.copy(at);
  glow.visible = false;
  model.add(glow);
  return { spec, lens, light, glow, on: 0 };
}
const ledLit = new THREE.Color();
/* an LED on (1) or off (0), times the board's own fade */
function setLed(L, on, fade) {
  if (!L) { return; }
  L.on = on;
  for (const m of L.lens) { m.color.copy(m.userData.c0).lerp(ledLit.setHex(L.spec.lit), on); m.emissiveIntensity = LED_EMISSIVE * on; }
  L.light.intensity = LED_LIGHT * on * fade;
  L.glow.material.opacity = LED_GLOW * on * fade;
  L.glow.visible = on * fade > 0.001;
}
/* a part fades in over the first PART_FADE of its way in (owner, 2026-11-11: "Is there a less abrupt way of having the
   objects come in and out rather than just appearing") */
const PART_FADE = 0.45;
/* the board as it is t seconds into the entrance (Infinity: put together) */
function setAssembly(A, t, shadow) {
  for (const p of A.parts) {
    const s = (t - p.t) / p.d;
    p.obj.visible = s > 0;
    p.alpha = s >= 1 ? 1 : easeOut(clamp01(s / PART_FADE));
    const e = easeOut(clamp01(s));
    p.obj.position.copy(p.base).addScaledVector(p.off, 1 - e);
    if (p.turns) { p.obj.rotation.y = -p.turns * 2 * Math.PI * (1 - e); }
  }
  if (shadow) { shadow.userData.asm = A.parts.length ? easeOut(clamp01(t / ASSEMBLY.base.d)) : 1; }
  A.powerOn = clamp01((t - ASSEMBLY.led.t) / ASSEMBLY.led.d);
}

/* ---- a chapter scene's items (owner, 2026-11-11: "have the wires start out of their ports so that they appear to be
   inserting as the user scrolls") ---------------------------------------------------------------------------------
   The scene GLBs name their nodes per item: lego_<scene>_<K>_<part> the motor or sensor K; lego_<scene>_cable_motor_m<N>,
   _plug_motor_m<N> (board end), _plug_motor_m<N>_motor (motor end) and _hdr_motor_m<N>_* (a header connector) motor
   port N, item N - 1; lego_peri_sensors_pc-i2c<P>_* a sensor's cable, the P's in ascending order matching the K's. A scene
   whose motion is `whole` is one item; whatever matches no item moves with the whole scene (`rest`). Each item moves along
   its own direction (in the scene's frame, the board's, +Y up): a LEGO motor horizontally out of the face its board-end
   plug sits on, an item with a header connector and every sensor from above, a laptop from the board's back */
function itemKey(name) {
  let m = /^lego_[a-z_]+?_(\d+)_/.exec(name);
  if (m) { return 'k' + Number(m[1]); }
  m = /_motor_m(\d+)/.exec(name);
  if (m) { return 'k' + (Number(m[1]) - 1); }
  m = /pc-i2c(\d+)_/.exec(name);
  if (m) { return 'p' + Number(m[1]); }
  return null;
}
const HOVER_GLOW = new THREE.Color(0x4a3c24);
/* what a hovered item is called and where its documentation is (owner, 2026-11-11: "a compact description box that
   follows the cursor ... just name the item ... Clicking it should also bring the user to it's documentation in the API
   page"): matched on the item's node names (the scenes' part names: product_renders/scenes.py), else the scene's own
   (SCENE_NAMES: a scene that is one item). The routes are site.js's, #/<route>/<heading slug> */
const ITEM_NAMES = [
  [/_95658$/, 'EV3 Large Motor', 'api-robot/motor'],
  [/_99455$/, 'EV3 Medium Motor', 'api-robot/motor'],
  [/_53787$/, 'NXT Motor', 'api-robot/motor'],
  [/_pololu_25d$/, 'Pololu 25D Gearmotor', 'api-robot/motor'],
  [/_peri_colour_sensor$/, 'EVN Colour Sensor', 'api-sensors/colorsensor--colour-sensor-tcs34725'],
  [/_peri_distance_sensor$/, 'EVN Distance Sensor', 'api-sensors/distancesensor--time-of-flight-distance-sensor-vl53l0x'],
  [/_peri_gesture_sensor$/, 'EVN Gesture Sensor', 'api-sensors/gesturesensor--gesture-proximity-and-colour-sensor-apds-9960'],
  [/_peri_oled_display$/, 'EVN OLED Display', 'api-displays/display--12864-oled-ssd1306--ssd1315']
];
const SCENE_NAMES = {
  robot: ['Drive base', 'api-robot/drivebase--two-motors-as-a-robot'],
  code: ['Blocks editor', 'blocks/'],
  simulator: ['Robot simulator', 'simulator/']
};
function itemName(nodes, key) {
  for (const [re, name, doc] of ITEM_NAMES) { if (nodes.some((n) => re.test(n.name))) { return { name, doc }; } }
  return SCENE_NAMES[key] ? { name: SCENE_NAMES[key][0], doc: SCENE_NAMES[key][1] } : null;
}
/* the colour sensor's lamp (its "PERI lit led" material) three times as bright as the pipeline's (owner, 2026-11-11:
   "color sensor led is too dim") */
const LAMP_GAIN = 3;
function sceneItems(group, key, model, boardRoot) {
  const cfg = SCENE_MOTION[key] || { mode: 'above', from: 0.5 };
  const L = model.userData.L || 1;
  const up = new THREE.Vector3(0, 1, 0);
  /* the board's back: away from its motor jacks (the RJ12 sockets' side) */
  const board = model.children[0], jacks = [];
  if (board && model.userData.center) { board.traverse((o) => { if (/rj12/i.test(o.name)) { jacks.push(o); } }); }
  /* measured from the jacks' geometry whether or not the board is shown (localBox counts only shown meshes: with the board
     hidden, as in the simulator's pose, a laptop scene loading then slid in from an arbitrary side; review site76_r6 S3) */
  const jb = new THREE.Box3(), inv = new THREE.Matrix4();
  board.updateMatrixWorld(true);
  inv.copy(board.matrixWorld).invert();
  for (const j of jacks) {
    j.traverse((m) => {
      if (!m.isMesh || !m.geometry) { return; }
      if (!m.geometry.boundingBox) { m.geometry.computeBoundingBox(); }
      jb.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
    });
  }
  const front = jacks.length ? faceAxis(model, jb.getCenter(new THREE.Vector3())) : new THREE.Vector3(0, 0, 1);
  const groups = new Map(), rest = [];
  const has = (o) => { let f = false; o.traverse((c) => { if (c !== o && itemKey(c.name)) { f = true; } }); return f; };
  (function walk(o) {
    for (const c of o.children) {
      const k = cfg.whole ? 'k0' : itemKey(c.name);
      if (k) { if (!groups.has(k)) { groups.set(k, []); } groups.get(k).push(c); } else if (has(c)) { walk(c); } else { rest.push(c); }
    }
  })(group);
  /* the cables' ports in ascending order, matched to the sensors in ascending order */
  const ks = [...groups.keys()].filter((k) => k[0] === 'k').map((k) => Number(k.slice(1))).sort((a, b) => a - b);
  const ps = [...groups.keys()].filter((k) => k[0] === 'p').map((k) => Number(k.slice(1))).sort((a, b) => a - b);
  ps.forEach((p, i) => {
    const to = 'k' + (ks[i] !== undefined ? ks[i] : 1000 + p);
    if (!groups.has(to)) { groups.set(to, []); }
    groups.get(to).push(...groups.get('p' + p));
    groups.delete('p' + p);
  });
  const items = [...groups.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))).map(([k, nodes]) => {
    let dir = up;
    if (cfg.mode === 'behind') { dir = front.clone().negate(); }
    if (cfg.mode === 'plugs' && !nodes.some((n) => /_hdr_/.test(n.name))) {
      const plug = nodes.find((n) => /_plug_motor_m\d+$/.test(n.name));
      if (plug) { dir = faceAxis(model, centreIn(group, plug)); }
    }
    return Object.assign({ key: k, nodes, dir, hover: true }, itemName(nodes, key));
  });
  if (rest.length) { items.push({ key: 'rest', nodes: rest, dir: cfg.mode === 'behind' ? front.clone().negate() : up, hover: false }); }
  for (const it of items) {
    it.dist = cfg.from * L;
    it.pts = outline(group, it.nodes);
    it.box = new THREE.Box3().setFromPoints(it.pts.length ? it.pts : [new THREE.Vector3()]);
    it.prog = 1; it.hov = 0; it.hovT = 0; it.spin0 = 0; it.offG = new THREE.Vector3();
    it.mats = []; it.lit = []; it.fm = []; it.alpha = 1;
    /* each item its own materials, so one lights and fades alone; what emits (the colour sensor's LEDs, the OLED) dark until
       it is plugged in: no glow, and its own colour dimmed to LIT_OFF (the colour sensor's lamp is a bright yellow plastic,
       which read as lit even with its glow off: owner, 2026-11-11, "The color sensor should only light up after it is
       plugged in") */
    for (const n of it.nodes) {
      n.traverse((o) => {
        if (!o.isMesh) { return; }
        const ms = [].concat(o.material).map((m) => m.clone());
        o.material = ms.length === 1 ? ms[0] : ms;
        for (const m of ms) {
          it.fm.push({ m, op: m.opacity, tr: m.transparent });
          if (!m.emissive) { continue; }
          /* a laptop's screen runs on the laptop: lit the whole time it is in view (owner, 2026-11-11: "laptop screens
             should be always on, not showing black most of the time") - neither gated nor tinted by the hover */
          if (m.emissive.r + m.emissive.g + m.emissive.b > 0 && m.emissiveIntensity > 0) {
            if (!cfg.screenOn) { it.lit.push({ m, ei: m.emissiveIntensity * (/lit led/i.test(m.name) ? LAMP_GAIN : 1), c0: m.color.clone() }); }
          } else { it.mats.push(m); }
        }
      });
    }
    if (it.hover) { motorSpin(it); }
    /* each node's travel and hover lift in its parent's frame */
    it.recs = it.nodes.map((n) => ({ n, base: n.position.clone(), d: vecIn(group, n.parent, it.dir.clone().multiplyScalar(it.dist)),
                                     lift: vecIn(group, n.parent, up.clone().multiplyScalar(0.025 * L)) }));
  }
  return items;
}
/* a motor under the pointer turns its output: the EV3 motors' red hub and the NXT motor's orange hub are their own
   primitives (their own meshes once loaded), round in two of their box's sides: each turns about the third, through its
   centre. The gearmotor's "shaft" primitive turns about its long side, on the line through its gearbox's centre. A motor
   with neither twitches about the vertical instead */
function motorSpin(it) {
  const motor = it.nodes.find((n) => /^lego_motors_\d+_/.test(n.name));
  if (!motor) { return; }
  const box = (o) => { if (!o.geometry.boundingBox) { o.geometry.computeBoundingBox(); } return o.geometry.boundingBox; };
  const matName = (o) => [].concat(o.material).map((m) => m.name || '').join(' ');
  let hub = null, axis = 0, centre = null, can = null;
  motor.traverse((o) => { if (o.isMesh && o.geometry && /gearbox|motor can/i.test(matName(o))) { can = can || o; } });
  motor.traverse((o) => {
    if (hub || !o.isMesh || !o.geometry) { return; }
    const nm = matName(o), round = /LEGO 4 Red|LEGO 25 Orange/.test(nm), shaft = /\bshaft\b/i.test(nm);
    if (!round && !shaft) { return; }
    const s = box(o).getSize(new THREE.Vector3()), d = [s.x, s.y, s.z];
    if (round) {
      /* the two sides most nearly equal are the hub's diameter; the axis is the other */
      const pairs = [[0, 1, 2], [0, 2, 1], [1, 2, 0]].map(([i, j, k]) => ({ k, r: Math.min(d[i], d[j]) / Math.max(d[i], d[j], 1e-9) }));
      const best = pairs.sort((x, y) => y.r - x.r)[0];
      if (best.r < 0.9) { return; }
      axis = best.k;
      centre = box(o).getCenter(new THREE.Vector3());
    } else {
      axis = d.indexOf(Math.max(...d));
      centre = box(o).getCenter(new THREE.Vector3());
      if (can) { const cc = box(can).getCenter(new THREE.Vector3()); for (const a of [0, 1, 2]) { if (a !== axis) { centre.setComponent(a, cc.getComponent(a)); } } }
    }
    hub = o;
  });
  if (hub) {
    const c = centre.applyMatrix4(hub.matrix);
    const p = new THREE.Group();
    p.position.copy(c);
    hub.parent.add(p);
    hub.position.sub(c);
    p.add(hub);
    it.spin = { pivot: p, axis: new THREE.Vector3().setComponent(axis, 1).applyQuaternion(hub.quaternion), kind: 'hub' };
    return;
  }
  const p = pivotOf(motor.parent, [motor]);
  it.nodes[it.nodes.indexOf(motor)] = p;
  it.spin = { pivot: p, axis: new THREE.Vector3(0, 1, 0), kind: 'twitch' };
}

/* ---- the motors scene's chalkboard (owner, 2026-11-11: "a chalkboard in the background, very dimly lit, with a floating
   chalk writing out the adrc and LESO equations. Writing does not need to meet contrast guidelines, just a little wink to
   those who look closer. Ends when everything is written, resets when the scene is entirely off the screen") ----------
   The firmware's own ADRC (motion/user_ctrl.c, ADRC(b0, wc, order=2)): the plant ÿ = f + b0·u; the third-order LESO's
   estimates z1 (position), z2 (rate), z3 (the total disturbance), its gains from wo (the textbook continuous form: every
   observer pole at -wo; the firmware places the same poles in discrete time); the control law u = (kp(r - z1) - kd·z2 -
   z3) / b0 with kp = wc², kd = 2wc. A dark slate board behind the scene, faced to the motors pose's camera, out of the
   camera's framing and the words' check; the equations revealed line by line on the clock with a chalk stick floating at
   the writing, CHALK.seconds in all (under WCAG 2.2.2's 5 s for motion that starts on its own), while the scene is in;
   written, it stays; with the scene wholly out of view it is wiped for next time. Decorative, like the whole layer. */
const CHALK = {
  scene: 'motors',
  seconds: 4.6,
  lines: [
    ['ADRC', 0.62],
    ['ÿ = f + b_0 u', 1],
    ['LESO', 0.62],
    ['ż_1 = z_2 + β_1 (y − z_1)', 1],
    ['ż_2 = z_3 + b_0 u + β_2 (y − z_1)', 1],
    ['ż_3 = β_3 (y − z_1)', 1],
    ['β_1 = 3ω_o ,  β_2 = 3ω_o^2 ,  β_3 = ω_o^3', 1],
    ['u = ( ω_c^2 (r − z_1) − 2ω_c z_2 − z_3 ) / b_0', 1],
    /* a second column, above the right-hand motor (owner, 2026-11-11: "Any other relevant formula for motors?" - "Ok do
       1"): the motor model calibrate() measures (docs/API_ROBOT.md: b0, tau, v_break, v_f), the b0 of the plant above */
    ['MOTOR', 0.62, 2],
    ['ω~ = b_0 (u − V_f sgn ω) − ω/τ', 0.74, 2],
    ['ω = 0  while  |u| < V_{break}', 0.74, 2],
    ['ω_{max} = b_0 τ (V − V_f)', 0.74, 2]
  ]
};
/* a line of the markup (x_1 or x_{max} a subscript, x^2 a superscript, x~ a dot over x: a time derivative, drawn here, as a
   combining dot lands wherever a fallback font puts it) drawn from (x, y), or only measured (draw false) */
function chalkLine(ctx, text, x, y, size, draw) {
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    let ch = text[i], dy = 0, k = 1;
    if ((ch === '_' || ch === '^') && i + 1 < text.length) {
      dy = ch === '_' ? size * 0.28 : -size * 0.42; k = 0.62;
      if (text[i + 1] === '{') { const e = text.indexOf('}', i + 2); ch = text.slice(i + 2, e); i = e; } else { ch = text[++i]; }
    }
    ctx.font = `italic 400 ${Math.round(size * k)}px Jost, "Segoe UI", "Helvetica Neue", sans-serif`;
    const w = ctx.measureText(ch).width;
    if (draw) { ctx.fillText(ch, cx, y + dy); }
    if (text[i + 1] === '~') {
      i++;
      if (draw) { ctx.beginPath(); ctx.arc(cx + w * 0.58, y - size * 0.72, size * 0.065, 0, 2 * Math.PI); ctx.fill(); }
    }
    cx += w + (k < 1 ? size * 0.04 : 0);
  }
  return cx - x;
}
function buildChalkboard(pose, box) {
  const W = 1024, H = 576, sz = 40;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const bg = mk(), ink = mk(), out = mk();
  /* the board: slate, a little uneven, its edges fading into the stage's dark (a board in a dim room, not a panel) */
  const b = bg.getContext('2d');
  b.fillStyle = '#1a221e';
  b.fillRect(0, 0, W, H);
  for (let i = 0; i < 18; i++) {
    const x = (i * 211) % W, y = (i * 137) % H, r = 120 + (i * 53) % 160;
    const g = b.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(120, 140, 130, 0.035)');
    g.addColorStop(1, 'rgba(120, 140, 130, 0)');
    b.fillStyle = g;
    b.fillRect(0, 0, W, H);
  }
  b.save();
  b.globalCompositeOperation = 'destination-in';
  b.translate(W / 2, H / 2);
  b.scale(1, H / W);
  const fade = b.createRadialGradient(0, 0, W * 0.2, 0, 0, W * 0.5);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = fade;
  b.fillRect(-W, -W, 2 * W, 2 * W);
  b.restore();
  /* the writing, whole, in a chalky hand: soft edges, then grain taken out of it */
  const c = ink.getContext('2d');
  c.fillStyle = 'rgba(226, 232, 226, 0.62)';
  c.shadowColor = 'rgba(226, 232, 226, 0.35)';
  c.shadowBlur = 2;
  c.textBaseline = 'alphabetic';
  const lines = [];
  const ys = { 1: 70, 2: 70 }, xs = { 1: [118, 146], 2: [596, 614] };     // two columns: the ADRC's, the motor's
  for (const [text, k, col0] of CHALK.lines) {
    const col = col0 || 1, head = k < 0.7;
    const s = sz * k, x0 = xs[col][head ? 0 : 1];
    ys[col] += head ? s * 1.15 + (ys[col] > 70 ? sz * 0.75 : 0) : s * 1.42 * (k < 1 ? 1.25 : 1);   // a heading: room above it
    const y = ys[col];
    const w = chalkLine(c, text, x0, y, s, true);
    lines.push({ x0, w, top: y - s * 1.05, h: s * 1.55, mid: y - s * 0.32 });
  }
  c.shadowBlur = 0;
  c.globalCompositeOperation = 'destination-out';
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26000; i++) { c.fillStyle = `rgba(0,0,0,${0.25 + rnd() * 0.6})`; c.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.6, 1 + rnd() * 1.2); }
  c.globalCompositeOperation = 'source-over';
  const total = lines.reduce((a, l) => a + l.w, 0) + 60 * (lines.length - 1);   // a line's width, and a gap to the next
  const o = out.getContext('2d');
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;                              // redrawn every frame while writing: no mipmaps to rebuild
  tex.minFilter = THREE.LinearFilter;
  /* placed behind the scene, faced to the motors pose's camera (the board turns by Euler XYZ (rx, ry); the camera looks
     along -Z from a little above): in the board group's frame */
  const qi = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rx, pose.ry, 0, 'XYZ')).invert();
  const toCam = new THREE.Vector3(0, 0.06, 1).normalize().applyQuaternion(qi);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(qi);
  const sph = box.getBoundingSphere(new THREE.Sphere());
  const pw = sph.radius * 2.1, ph = pw * H / W;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xa9aeab, transparent: true, opacity: 0, depthWrite: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
  const g = new THREE.Group();
  /* behind the scene and raised by half its radius: the open space in the motors pose's view is above the motors, so the
     writing (and the chalk at it) shows there rather than behind them */
  g.position.copy(sph.center).addScaledVector(toCam, -sph.radius * 1.15).addScaledVector(up, sph.radius * 0.38);
  g.userData.fit = { base: g.position.clone(), up: up.clone(), h: ph };          // keepInView: below the header in a short window
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(toCam, new THREE.Vector3(0, 0, 0), up));
  g.add(plane);
  const chalkMat = new THREE.MeshStandardMaterial({ color: 0xd9ddd8, roughness: 0.95, transparent: true, opacity: 0 });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(pw * 0.009, pw * 0.009, pw * 0.075, 12), chalkMat);
  stick.rotation.z = -0.9;
  g.add(stick);
  g.visible = false;
  let t = -1, drawn = -1;
  function paint(p) {                                       // p: how far along the writing, in canvas px
    o.clearRect(0, 0, W, H);
    o.drawImage(bg, 0, 0);
    let left = p, at = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const w = Math.max(0, Math.min(l.w, left));
      if (w > 0) { o.drawImage(ink, l.x0, l.top, w, l.h, l.x0, l.top, w, l.h); }
      if (left <= l.w) { at = { x: l.x0 + Math.max(0, left), y: l.mid }; break; }
      left -= l.w;
      if (left < 60 && i + 1 < lines.length) {            // between two lines: on the way to the next one's start
        const n = lines[i + 1], f = left / 60;
        at = { x: lerp(l.x0 + l.w, n.x0, f), y: lerp(l.mid, n.mid, f) };
        break;
      }
      left -= 60;
    }
    tex.needsUpdate = true;
    return at;
  }
  paint(0);
  const ch = {
    group: g, total, lines,
    state: 'wiped',
    /* the scene's share in view (ins): the board fades with it; the writing runs while it is mostly in */
    step(dt, ins, now) {
      g.visible = ins > 0.001;
      mat.opacity = Math.min(1, ins) * 0.95;
      if (ins <= 0.001) {                                   // wholly out of view: wiped for next time
        if (t !== -1) { t = -1; drawn = -1; paint(0); ch.state = 'wiped'; chalkMat.opacity = 0; }
        return false;
      }
      if (t < 0) { t = 0; }                                 // from the scene's first coming in (most of it lands in the hold)
      const before = t;
      t = Math.min(CHALK.seconds + 0.5, t + dt / 1000);
      const p = Math.min(1, t / CHALK.seconds) * total;
      if (p !== drawn) {
        drawn = p;
        const at = paint(p);
        if (at) { stick.position.set((at.x / W - 0.5) * pw + pw * 0.02, (0.5 - at.y / H) * ph + pw * 0.026 + Math.sin(now / 90) * pw * 0.003, pw * 0.03); }
      }
      chalkMat.opacity = Math.min(1, ins) * (t < CHALK.seconds ? 1 : Math.max(0, 1 - (t - CHALK.seconds) / 0.5));
      ch.state = t < CHALK.seconds ? 'writing' : 'written';
      return t !== before && t < CHALK.seconds + 0.5;
    }
  };
  return ch;
}

/* ---- the robot chapter's line follower (owner, 2026-11-11: "For the wro robot ... making it look like it's following a
   line. The robots body will stay mostly stationary, twitching left and right while the light line moves under it. How
   much it twitches will depend on the sharpness of the bend in the line under it"; then: "It will not auto start. Above
   the robot in the background like the blackboard, we will have an EVNblocks snippet of a pid line follower. The user
   will click the play button to start it and it turns into a pause button to stop it. The robot does not actually have to
   follow the code, just something possible will do. No color sensors so we'll need to draw some sort of lighting around
   the line as if the color sensor LEDs are pointing at it ... Preferably the wheels spin. Procedurally generate the line
   so that it runs forever, turning often and varied enough to keep it interesting. The evn is the back of the robot, the
   color sensors lights should appear as if the color sensors are in front of the medium motors") -------------------------
   The line (followLine): an endless chain of pieces from a seeded generator - straights, arcs of 70-300 mm radius through
   30-150 degrees, zigzags of two to four short arcs, a sharp quarter turn of 42-60 mm radius - each turn mostly the other
   way from the last, the curvature ramped over 14 mm between pieces, no straight run longer than 150 mm (owner: "Bound
   maximum straight line length to keep it interesting"), sampled every 2 mm (mm, the floor's own frame).
   The robot (FOLLOW, followStep): a two-wheel robot driven as data/line_follower/line_follower.evnblocks drives it - 150 mm/s,
   its turn from a PID on the two sensors' reading of the line (the line's offset from between them, saturating at their
   spacing, read every 10 ms in 5 % steps), the motors' lag 50 ms - simulated on the line; scripts/test_site.js
   runs this code for 600 s on three seeds: it never loses the line, twitches more the sharper the bend, and sits centred
   on an even bend. Shown, the robot does not travel: the view follows it (its axle's middle) and its heading smoothed
   over 60 ms plus that smoothing's own slow lag (0.35 s), so the turns are the line swinging round under it, a steady
   bend leaves the body straight (owner: "robot does not look centered in steady state": the 60 ms smoothing alone left
   it turned on an even bend, about 2.6 degrees, and the line 2.8 mm to one side without the integral), and the body
   twitches by what is left - its corrections, the larger the sharper the bend. The wheels roll by the
   distance each one covers. Two pools of warm light on the floor, one each side of the line in front of the medium
   motors where the sensors would be, lit while it runs. The blocks board: the snippet (data/line_follower/render_blocks.js)
   with no panel of its own, behind the robot as the chalkboard is behind the motors; its run button is a real button (site.css
   .stage-run) placed over the panel's corner. Decorative like the layer, but the button is a control: "Run the line
   follower" / "Pause the line follower", aria-pressed. It never starts on its own, and pauses when the scene leaves. */
const FOLLOW = {
  scene: 'robot',
  board: 'assets/images/blocks-line-follower.webp',
  v: 150, spacing: 30, kp: 4.5, ki: 6, kd: 0.08, lag: 0.05, wmax: 6, loop: 0.01, q: 20, smooth: 0.06, settle: 0.35, h: 0.004,
  maxStraight: 150, lineW: 20, matR: 210, seed: 20261111
};
function followLine(seed) {
  let s0 = (seed >>> 0) % 2147483647 || 1;
  const rnd = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
  const segs = [];
  let lastSign = 1, tail = 0;                                  // tail: the straight the line ends in so far (mm)
  /* a straight piece, never making a straight run longer than FOLLOW.maxStraight (owner, 2026-11-11: "Bound maximum
     straight line length to keep it interesting") */
  const straight = (len) => { const l = Math.min(len, FOLLOW.maxStraight - tail); if (l > 1) { segs.push({ len: l, k: 0 }); tail += l; } };
  const bend = (len, k) => { segs.push({ len, k }); tail = 0; };
  function more() {
    const t = rnd();
    if (t < 0.22) { straight(40 + rnd() * 80); return; }
    const sign = rnd() < 0.7 ? -lastSign : lastSign;
    lastSign = sign;
    if (t < 0.62) {                                             // an arc
      const R = 70 + rnd() * 230, ang = (30 + rnd() * 120) * Math.PI / 180;
      bend(R * ang, sign / R);
    } else if (t < 0.85) {                                      // a zigzag
      const n = 2 + Math.floor(rnd() * 3), R = 55 + rnd() * 60, ang = (40 + rnd() * 35) * Math.PI / 180;
      for (let i = 0; i < n; i++) { bend(R * ang, (i % 2 ? -sign : sign) / R); }
      lastSign = n % 2 ? sign : -sign;
    } else {                                                    // a sharp corner
      const R = 42 + rnd() * 18;
      bend(R * Math.PI / 2, sign / R);
    }
    straight(20 + rnd() * 50);
  }
  const DS = 2, RAMP = 14;
  const L = { pts: [], DS };
  let x = 0, y = 0, th = 0, segI = 0, segS = 0, kPrev = 0;
  while (segs.length < 4) { more(); }                          // a capped straight can add nothing: more until there is line
  L.step = function () {
    while (segS >= segs[segI].len) {
      segS -= segs[segI].len; kPrev = segs[segI].k; segI++;
      while (segI >= segs.length - 2) { more(); }
      if (segI > 64) { segs.splice(0, 32); segI -= 32; }          // the pieces long passed
    }
    const sg = segs[segI];
    const k = segS < RAMP ? kPrev + (sg.k - kPrev) * (segS / RAMP) : sg.k;
    th += k * DS; x += Math.cos(th) * DS; y += Math.sin(th) * DS; segS += DS;
    L.pts.push({ x, y, th, k });
  };
  return L;
}
/* the robot on the line: its axle's middle (x, y), heading th; the sensors ds mm in front of the axle. Returns the state;
   `step` advances it by sec seconds and gives each wheel's rolled distance (mm) */
function followSim(seed, ds, track) {
  const F = FOLLOW, L = followLine(seed);
  for (let i = 0; i < 300; i++) { L.step(); }
  const p0 = L.pts[100];
  const st = { L, x: p0.x - Math.cos(p0.th) * ds, y: p0.y - Math.sin(p0.th) * ds, th: p0.th, thS: p0.th, lean: 0, thD: p0.th,
               hint: 100, rPrev: 0, iSum: 0, w: 0, cmd: 0, tc: 0, e: 0, rollL: 0, rollR: 0 };
  st.step = function (sec) {
    let left = sec;
    while (left > 1e-9) {
      const h = Math.min(F.h, left);
      left -= h;
      while (L.pts.length < st.hint + 700) { L.step(); }
      if (st.hint > 1200) { L.pts.splice(0, 600); st.hint -= 600; }   // the line long passed
      const sx = st.x + Math.cos(st.th) * ds, sy = st.y + Math.sin(st.th) * ds;
      let best = st.hint, bd = Infinity;
      for (let i = Math.max(0, st.hint - 40); i < st.hint + 80; i++) {
        const q = L.pts[i], d = (q.x - sx) * (q.x - sx) + (q.y - sy) * (q.y - sy);
        if (d < bd) { bd = d; best = i; }
      }
      st.hint = best;
      const q = L.pts[best];
      st.e = -(sx - q.x) * Math.sin(q.th) + (sy - q.y) * Math.cos(q.th);       // the sensors left of the line: +
      st.tc += h;
      if (st.tc >= F.loop) {                                     // the program's loop: a reading, the turn held till the next
        st.tc -= F.loop;
        const r = Math.round(Math.max(-1, Math.min(1, st.e / (F.spacing / 2))) * F.q) / F.q;
        /* the integral keeps the line between the sensors on an even bend (a P and D alone ride it off to one side) */
        st.iSum = Math.max(-0.6, Math.min(0.6, st.iSum + r * F.loop));
        st.cmd = -(F.kp * r + F.ki * st.iSum + F.kd * (r - st.rPrev) / F.loop);
        st.rPrev = r;
      }
      st.w += (st.cmd - st.w) * Math.min(1, h / F.lag);
      st.w = Math.max(-F.wmax, Math.min(F.wmax, st.w));
      st.th += st.w * h;
      st.x += Math.cos(st.th) * F.v * h; st.y += Math.sin(st.th) * F.v * h;
      st.thS += (st.th - st.thS) * Math.min(1, h / F.smooth);
      /* what the view shows of the heading: the quick part (the corrections), less its own slow mean, so a steady bend
         settles the body straight (owner, 2026-11-11: "robot does not look centered in steady state") */
      st.lean += ((st.th - st.thS) - st.lean) * Math.min(1, h / F.settle);
      st.thD = st.thS + st.lean;
      st.rollL += (F.v - st.w * track / 2) * h; st.rollR += (F.v + st.w * track / 2) * h;
    }
  };
  return st;
}
const FLOOR_VS = `varying vec2 vF; void main() { vF = vec2(position.x, -position.z); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
/* the robot's floor and line (still), its sensors' light (moving with it), its wheels, its blocks board; in the board group's
   frame. model: the board's model (the robot twitches with it); group: the robot scene; mmU: model units per mm */
function buildFollower(model, group, pose, ownBox, mmU) {
  const F = FOLLOW, up = new THREE.Vector3(0, 1, 0);
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const wheels = [0, 1].map((i) => group.getObjectByName('lego_drive_base_0_wheel_' + i)).filter(Boolean);
  if (wheels.length !== 2) { return null; }
  const ws = wheels.map((w) => {
    const c = w.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const box = new THREE.Box3().setFromObject(w).applyMatrix4(inv);
    const z = new THREE.Vector3(0, 0, 1).transformDirection(w.matrixWorld).transformDirection(inv);
    return { w, c, r: (box.max.y - box.min.y) / 2, z, q0: w.quaternion.clone() };
  });
  const M = ws[0].c.clone().add(ws[1].c).multiplyScalar(0.5);
  const axle = ws[1].c.clone().sub(ws[0].c).setY(0);
  const track = axle.length() / mmU;
  axle.normalize();
  const f = new THREE.Vector3().crossVectors(up, axle).normalize();
  if (f.dot(M.clone().setY(0)) < 0) { f.negate(); }               // forward: away from the board (the EVN is the robot's back)
  const left = f.clone().applyAxisAngle(up, Math.PI / 2);
  const floorY = Math.min(ws[0].c.y - ws[0].r, ws[1].c.y - ws[1].r);
  const rw = (ws[0].r + ws[1].r) / 2 / mmU;
  /* the sensors: in front of the medium motors (they lie along the axle between the wheels), a wheel radius ahead of it */
  const ds = rw;
  for (const w of ws) {
    w.side = Math.sign(w.c.clone().sub(M).dot(left));               // +1: the robot's left wheel
    w.roll = Math.sign(new THREE.Vector3().crossVectors(up, f).dot(w.z)) || 1;   // its turn about its own z that rolls it forward
  }
  /* the robot's footprint on the floor (its shadow on the mat), in floor mm */
  const fp = { u0: Infinity, u1: -Infinity, w0: Infinity, w1: -Infinity };
  for (const x of [ownBox.min.x, ownBox.max.x]) for (const z of [ownBox.min.z, ownBox.max.z]) {
    const d = new THREE.Vector3(x, 0, z).sub(M).setY(0);
    const u = d.dot(f) / mmU, w = d.dot(left) / mmU;
    fp.u0 = Math.min(fp.u0, u); fp.u1 = Math.max(fp.u1, u); fp.w0 = Math.min(fp.w0, w); fp.w1 = Math.max(fp.w1, w);
  }
  /* the floor's frame: origin under the axle's middle, x forward, z = -left, in mm */
  const floorM = new THREE.Matrix4().makeBasis(f, up, f.clone().cross(up)).scale(new THREE.Vector3(mmU, mmU, mmU))
    .setPosition(new THREE.Vector3(M.x, floorY, M.z));
  const mkFloor = () => { const o = new THREE.Object3D(); o.matrixAutoUpdate = false; o.matrix.copy(floorM); o.visible = false; return o; };
  const still = mkFloor(), moving = mkFloor();
  const R = F.matR;
  /* the mat: dark, a faint 50 mm grid fixed to the floor (so a straight still shows the floor going by), the robot's soft
     shadow, faded out towards its rim */
  const matU = { uOff: { value: new THREE.Vector2() }, uAng: { value: 0 }, uA: { value: 0 }, uR: { value: R },
                 uFp: { value: new THREE.Vector4((fp.u0 + fp.u1) / 2, (fp.w0 + fp.w1) / 2, (fp.u1 - fp.u0) / 2, (fp.w1 - fp.w0) / 2) } };
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R).rotateX(-Math.PI / 2).translate(0, 0.3, 0), new THREE.ShaderMaterial({
    uniforms: matU, transparent: true, depthWrite: false,
    vertexShader: FLOOR_VS,
    fragmentShader: `uniform vec2 uOff; uniform float uAng, uA, uR; uniform vec4 uFp; varying vec2 vF;
      void main() {
        float c = cos(uAng), s = sin(uAng);
        vec2 wp = uOff + vec2(c * vF.x - s * vF.y, s * vF.x + c * vF.y);
        vec2 g = abs(fract(wp / 50.0 + 0.5) - 0.5) * 50.0;
        float grid = 1.0 - smoothstep(0.4, 1.4, min(g.x, g.y));
        vec2 q = (vF - uFp.xy) / (uFp.zw * 1.15);
        float shade = 1.0 - 0.55 * (1.0 - smoothstep(0.55, 1.25, length(q)));
        vec3 col = (vec3(0.0075, 0.0085, 0.0095) + grid * 0.006) * shade;
        float a = uA * (1.0 - smoothstep(uR * 0.3, uR, length(vF)));
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`
  }));
  mat.renderOrder = 1;
  still.add(mat);
  /* the line: a ribbon along the path near the robot, rebuilt each frame it moves */
  const NMAX = 900;
  const lpos = new Float32Array(NMAX * 2 * 3), lidx = [];
  for (let i = 0; i < NMAX - 1; i++) { const a = 2 * i; lidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3).setUsage(THREE.DynamicDrawUsage));
  lgeo.setIndex(lidx);
  const lineU = { uA: { value: 0 }, uR: { value: R } };
  const line = new THREE.Mesh(lgeo, new THREE.ShaderMaterial({
    uniforms: lineU, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: FLOOR_VS,
    fragmentShader: `uniform float uA, uR; varying vec2 vF;
      void main() { gl_FragColor = vec4(vec3(0.42, 0.40, 0.36), uA * (1.0 - smoothstep(uR * 0.3, uR * 0.95, length(vF))));
        #include <colorspace_fragment>
      }`
  }));
  line.frustumCulled = false;
  line.renderOrder = 2;
  still.add(line);
  /* the sensors' light: two warm pools, one each side of the line, a wheel radius in front of the axle */
  const poolU = { uA: { value: 0 } };
  const poolMat = new THREE.ShaderMaterial({
    uniforms: poolU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA; varying vec2 vUv;
      void main() { float d = length(vUv - 0.5) * 2.0; float k = exp(-d * d * 4.0) * (1.0 - smoothstep(0.8, 1.0, d));
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * k * uA * 0.5, 1.0); }`
  });
  for (const sd of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(76, 76).rotateX(-Math.PI / 2), poolMat);   // the light spills past the front beam
    p.position.set(ds, 0.9, -sd * F.spacing / 2);
    p.renderOrder = 3;
    moving.add(p);
  }
  /* the blocks board: the snippet, on no panel, behind the robot, faced to the robot pose's camera (as the chalkboard) */
  const W = 1024, Hc = 760, cv = document.createElement('canvas');
  cv.width = W; cv.height = Hc;
  const cx = cv.getContext('2d');
  const btex = new THREE.CanvasTexture(cv);
  btex.colorSpace = THREE.SRGBColorSpace;
  const RUN_AT = { x: 52, y: 44 };                                 // the run button's centre on the panel (canvas px)
  function paintBoard(img) {
    /* no panel (owner, 2026-11-11: "Remove the black background on the evnblocks, make it transparent"): the blocks and
       their file's name float on the stage's dark */
    cx.clearRect(0, 0, W, Hc);
    cx.fillStyle = 'rgba(214, 218, 222, 0.75)';
    cx.font = '500 26px Jost, "Segoe UI", sans-serif';
    cx.textBaseline = 'middle';
    cx.fillText('line_follower.evnblocks', 124, RUN_AT.y);
    if (img) {
      const iw = W - 80, ih = iw * img.height / img.width;
      cx.drawImage(img, 40, 104, iw, Math.min(ih, Hc - 130));
    }
    btex.needsUpdate = true;
  }
  paintBoard(null);
  const im = new Image();
  im.onload = () => paintBoard(im);
  im.src = new URL(F.board, document.baseURI).href;
  const qi = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rx, pose.ry, 0, 'XYZ')).invert();
  const toCam = new THREE.Vector3(0, 0.06, 1).normalize().applyQuaternion(qi);
  const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(qi);
  const sph = ownBox.getBoundingSphere(new THREE.Sphere());
  const pw = sph.radius * 1.5, ph = pw * Hc / W;
  const bmat = new THREE.MeshBasicMaterial({ map: btex, color: 0x9a9d9f, transparent: true, opacity: 0, depthWrite: false });
  const board = new THREE.Group();
  board.position.copy(sph.center).addScaledVector(toCam, -sph.radius * 1.2).addScaledVector(camUp, sph.radius * 0.78);
  board.userData.fit = { base: board.position.clone(), up: camUp.clone(), h: ph };   // keepInView
  board.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(toCam, new THREE.Vector3(0, 0, 0), camUp));
  board.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), bmat));
  board.visible = false;
  const runAt = new THREE.Vector3((RUN_AT.x / W - 0.5) * pw, (0.5 - RUN_AT.y / Hc) * ph, 0);
  /* the run */
  const sim = followSim(F.seed, ds, track);
  const fo = {
    still, moving, board, runAt, playing: false, light: 0, psi: 0, pivot: M, up, ds, track, rw,
    /* a frame: the scene's share in view; true while something moves */
    step(dt, ins) {
      const on = ins > 0.001;
      still.visible = moving.visible = board.visible = on;
      if (ins < 0.6 && fo.playing) { fo.playing = false; }          // the scene leaving: paused
      let anim = false;
      if (fo.playing) { sim.step(Math.min(0.1, dt / 1000)); anim = true; }
      const lt = fo.playing ? 1 : 0;
      if (fo.light !== lt) { fo.light = lt > fo.light ? Math.min(1, fo.light + dt / 250) : Math.max(0, fo.light - dt / 400); anim = true; }
      const a = Math.min(1, ins);
      matU.uA.value = a; lineU.uA.value = a; poolU.uA.value = fo.light * a;
      bmat.opacity = a * 0.72;
      fo.psi = sim.th - sim.thD;
      for (const w of ws) {
        const roll = (w.side > 0 ? sim.rollL : sim.rollR) / rw;
        w.w.quaternion.copy(w.q0).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), w.roll * roll));
      }
      if (on) { draw(); }
      return anim;
    }
  };
  let drawnAt = null;
  function draw() {
    const key = sim.x + ',' + sim.y + ',' + sim.thD;
    if (key === drawnAt) { return; }
    drawnAt = key;
    const c = Math.cos(sim.thD), s = Math.sin(sim.thD), P = sim.L.pts, hw = F.lineW / 2;
    const span = Math.ceil(1.6 * R / sim.L.DS);
    const i0 = Math.max(0, sim.hint - span), i1 = Math.min(P.length - 1, i0 + NMAX - 1);
    let n = 0;
    for (let i = i0; i <= i1; i++, n++) {
      const p = P[i];
      const dx = p.x - sim.x, dy = p.y - sim.y;
      const u = dx * c + dy * s, w = -dx * s + dy * c;
      const nu = -Math.sin(p.th - sim.thD), nw = Math.cos(p.th - sim.thD);   // the line's left, in the floor's frame
      lpos.set([u + nu * hw, 0.6, -(w + nw * hw), u - nu * hw, 0.6, -(w - nw * hw)], n * 6);
    }
    lgeo.setDrawRange(0, Math.max(0, n - 1) * 6);
    lgeo.attributes.position.needsUpdate = true;
    matU.uOff.value.set(((sim.x % 500) + 500) % 500, ((sim.y % 500) + 500) % 500);
    matU.uAng.value = sim.thD;
  }
  return fo;
}

/* ---- the simulator chapter's laptop screen (owner, 2026-11-11: "For the robot on the oval track in the simulator, is
   it supposed to be a video on mobile? Also use the 3d view instead of the 2d"): the simulator's 3D view of a robot
   following the line on the full RoboCup Junior Rescue Line course, a 12 s clip the Razer recorded (data/screens/
   sim_rcj_clip.*, 1 s spare each end: SCREEN_CLIP.loop plays the middle 10 s), on the laptop's screen as a video
   texture; its first frame (assets/images/sim-rcj.webp) until the clip can play. It plays while the scene is in view and
   until the visitor pauses it (a real button, WCAG 2.2.2: moving content over 5 s that starts on its own can be paused);
   muted, loaded only when this scene loads. Phones and the photo layout have the same clip over the chapter's render
   (site.js chapterScreen) */
const SCREEN_CLIP = {
  scene: 'simulator',
  poster: 'assets/images/sim-rcj.webp',
  sources: [['assets/video/sim-rcj.webm', 'video/webm'], ['assets/video/sim-rcj.mp4', 'video/mp4']],
  loop: [0, 14.3]
};
function screenClip(group) {
  let screen = null;
  group.traverse((o) => { if (!screen && o.isMesh && [].concat(o.material).some((m) => m && m.name === 'screen')) { screen = o; } });
  if (!screen) { return null; }
  const mat = [].concat(screen.material).find((m) => m.name === 'screen');
  const old = mat.emissiveMap;
  const fit = (t) => {                                   // the GLB's own placing of the picture on the screen
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    if (old) { t.offset.copy(old.offset); t.repeat.copy(old.repeat); t.rotation = old.rotation; t.center.copy(old.center); }
    return t;
  };
  new THREE.TextureLoader().load(new URL(SCREEN_CLIP.poster, document.baseURI).href, (t) => {
    if (sc.live) { t.dispose(); return; }
    mat.emissiveMap = fit(t); mat.needsUpdate = true; sc.changed = true;
  });
  const video = document.createElement('video');
  video.muted = true; video.defaultMuted = true; video.playsInline = true; video.preload = 'auto';
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  for (const [src, type] of SCREEN_CLIP.sources) {
    const so = document.createElement('source');
    so.src = new URL(src, document.baseURI).href; so.type = type;
    video.appendChild(so);
  }
  video.addEventListener('timeupdate', () => { if (video.currentTime >= SCREEN_CLIP.loop[1]) { video.currentTime = SCREEN_CLIP.loop[0]; } });
  video.addEventListener('ended', () => { video.currentTime = SCREEN_CLIP.loop[0]; if (sc.want) { video.play().catch(() => {}); } });
  video.addEventListener('playing', () => {
    if (sc.live) { return; }
    const vt = fit(new THREE.VideoTexture(video));
    if (mat.emissiveMap && mat.emissiveMap !== old) { mat.emissiveMap.dispose(); }
    mat.emissiveMap = vt; mat.needsUpdate = true; sc.live = vt; sc.changed = true;
  });
  if (!screen.geometry.boundingBox) { screen.geometry.computeBoundingBox(); }
  const lb = screen.geometry.boundingBox;
  const sc = {
    screen, video, live: null, want: false, userPaused: false, changed: false,
    corners: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? lb.max.x : lb.min.x, i & 2 ? lb.max.y : lb.min.y, i & 4 ? lb.max.z : lb.min.z)),
    /* the scene's share in view: plays while it is mostly in, unless paused; true while frames must be drawn */
    step(ins) {
      const want = ins >= 0.6 && !sc.userPaused;
      if (want !== sc.want) {
        sc.want = want;
        if (want) { if (video.currentTime < SCREEN_CLIP.loop[0]) { video.currentTime = SCREEN_CLIP.loop[0]; } video.play().catch(() => {}); } else { video.pause(); }
      }
      const ch = sc.changed; sc.changed = false;
      return ch || (want && !video.paused);
    },
    dispose() { video.pause(); video.removeAttribute('src'); while (video.firstChild) { video.firstChild.remove(); } video.load(); if (sc.live) { sc.live.dispose(); } }
  };
  return sc;
}

function shown(o) { for (let p = o; p; p = p.parent) { if (!p.visible) { return false; } } return true; }
/* the outline of the shown meshes for the camera fit, in the board group's own frame: the vertices furthest along 96
   directions spread over the sphere (a box's corners overshoot a flat or spread-out scene by its empty corners); each
   mesh's vertices sampled down to about 300 */
const DIRS = Array.from({ length: 96 }, (_, i) => {
  const y = 1 - (i + 0.5) / 48, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996;
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
});
function outline(group, objects) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  const best = DIRS.map(() => ({ d: -Infinity, p: null }));
  for (const o of objects) {
    o.updateMatrixWorld(true);
    o.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes.position || !shown(mesh)) { return; }
      const pos = mesh.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 300));
      m.multiplyMatrices(inv, mesh.matrixWorld);
      for (let k = 0; k < pos.count; k += step) {
        v.fromBufferAttribute(pos, k).applyMatrix4(m);
        for (let j = 0; j < DIRS.length; j++) {
          const d = v.dot(DIRS[j]);
          if (d > best[j].d) { best[j].d = d; best[j].p = v.clone(); }
        }
      }
    });
  }
  return best.filter((b) => b.p).map((b) => b.p);
}
/* a box of the shown meshes, in the board group's own frame (the frame the board turns in) */
function localBox(group, objects) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const box = new THREE.Box3();
  for (const o of objects) {
    o.updateMatrixWorld(true);
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry || !shown(m)) { return; }
      if (!m.geometry.boundingBox) { m.geometry.computeBoundingBox(); }
      box.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
    });
  }
  return box;
}

/* ---- the stage ---------------------------------------------------------------------------------------------- */
export async function start(stage, opts) {
  const host = stage.querySelector('.stage-visual');
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;                 // the marketing renders' look: not washed out on the dark stage

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget = null;
  /* reflections at 0.6 (the marketing renders' look, the owner: "renders too bright"). Since r163 a material lit by
     scene.environment takes scene.environmentIntensity on every draw, not its own envMapIntensity, so it is set here */
  scene.environmentIntensity = ENV_INTENSITY;
  let composer = null, bloomFailed = false;
  function draw() { if (composer) { composer.render(); } else { renderer.render(scene, camera); } }
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 7, 6);
  scene.add(key);
  const rim = new THREE.PointLight(ACCENT, 25, 30);
  rim.position.set(-5, 2.5, -4);
  scene.add(rim);

  const models = opts && opts.models ? opts.models : null;
  /* the marketing renders' studio HDRI, turned as they turn it (models.json environment.turn_deg), fetched beside the
     board: nothing is drawn until both are in (owner, 2026-11-11: "lighting shows up awkwardly when first loaded ...
     ensure model loads first?"); the generic room only if it does not load */
  async function loadEnvironment() {
    const env = models && models.environment;
    if (!env || !env.hdr) { return false; }
    try {
      const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
      const tex = await new RGBELoader().loadAsync(new URL(env.hdr, document.baseURI).href);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = pmrem.fromEquirectangular(tex);
      tex.dispose();
      envTarget = pm;
      scene.environment = pm.texture;
      scene.environmentRotation.set(0, THREE.MathUtils.degToRad(env.turn_deg || 0), 0);
      scene.environmentIntensity = env.intensity ?? ENV_INTENSITY;
      stage.setAttribute('data-3d-env', 'hdri');
      return true;
    } catch (e) { return false; }
  }
  const envP = loadEnvironment();
  const boardRoot = new THREE.Group();
  let model;
  /* a loading indicator (owner, 2026-11-11: "some indicator that each 3d asset is loading"): a small pill under the
     render while the board, or the scene of the chapter in view, downloads - its share when the server gives the file's
     size, else what has arrived so far; decorative like the layer (aria-hidden), the words around it say everything */
  const LOAD_NAMES = { motors: 'Motors', sensors: 'Sensors and displays', code: 'Code', robot: 'LEGO Technic', simulator: 'Simulator' };
  const loadEl = document.createElement('div');
  loadEl.className = 'stage-load';
  loadEl.setAttribute('aria-hidden', 'true');
  loadEl.innerHTML = '<span class="stage-load-text"></span><span class="stage-load-bar"><i></i></span>';
  /* on the stage, over the chapters (site.css .stage-load, fixed): inside the 3D layer it sat under them, and a render
     scrolling in overprinted its words (the Razer's fast-scroll check: "S?nsors") */
  stage.appendChild(loadEl);
  const loadState = { board: true, key: null, loaded: 0, total: 0 };
  const onLoadProgress = (key) => (e) => {
    if (gaveUpEarly) { return; }
    loadState.key = key; loadState.loaded = e.loaded || 0; loadState.total = e.lengthComputable ? e.total : 0;
    showLoad();
  };
  let gaveUpEarly = false;
  /* where and what: the board under the first screen's still; a scene under its chapter's render, only while that chapter
     is the one in view and its scene is not in yet */
  function showLoad() {
    let text = null, box = null, key = null;
    if (loadState.board) { text = 'Loading the 3D board'; box = stillBox(); key = 'board'; }
    else if (loadReady && !gaveUp) {
      const i = Math.round(cur.p), pose = POSES[i];
      if (pose && pose.scene && models && models.scenes && models.scenes[pose.scene] && !scenes[pose.scene] && !pose._failed
          && sceneAllowed(pose.scene)) { text = 'Loading the 3D scene: ' + LOAD_NAMES[pose.scene]; box = areas && areas[i]; key = pose.scene; }
    }
    if (!text || !box) { loadEl.classList.remove('on'); return; }
    const mine = loadState.key === key;
    const frac = mine && loadState.total ? Math.min(1, loadState.loaded / loadState.total) : -1;
    loadEl.querySelector('.stage-load-text').textContent = text + (frac >= 0 ? ' · ' + Math.round(frac * 100) + ' %'
      : mine && loadState.loaded ? ' · ' + (loadState.loaded / 1048576).toFixed(1) + ' MB' : '');
    loadEl.classList.toggle('indet', frac < 0);
    loadEl.style.setProperty('--load', String(Math.max(0, frac)));
    const h = host.getBoundingClientRect();
    loadEl.style.left = Math.round(h.left + (box.qL + box.qR) / 2) + 'px';
    loadEl.style.top = Math.round(h.top + Math.min(h.height - 44, Math.max(8, box.qB + 6))) + 'px';
    loadEl.classList.add('on');
  }
  let loadReady = false;
  showLoad();                                       // from the request's start, before any byte has come
  try { model = await loadModel(models, onLoadProgress('board')); } catch (e) {        // no board: free the context now, the photo stays
    gaveUpEarly = true;
    loadEl.remove();
    await envP;
    if (envTarget) { envTarget.dispose(); }
    pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss();
    throw e;
  }
  if (!(await envP)) {
    envTarget = pmrem.fromScene(new RoomEnvironment(renderer), 0.04);
    scene.environment = envTarget.texture;
  }
  boardRoot.add(model);
  boardRoot.updateMatrixWorld(true);
  /* the shadow at the model's foot */
  const shadow = shadowPlane();
  shadow.position.y = new THREE.Box3().setFromObject(model).min.y + 0.01;
  shadow.userData.asm = 1;
  boardRoot.add(shadow);
  scene.add(boardRoot);
  const boardBox = localBox(boardRoot, [model]);
  const boardPts = outline(boardRoot, [model]);
  /* the board's own parts (without the scenes added to `model` later): faded out for a pose with board: false */
  const asm = buildAssembly(model);
  const boardNode = models && models.board ? model.children[0] : model;
  const boardMats = [], byMat = new Map();
  boardNode.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      if (!byMat.has(m)) { const r = { m, op: m.opacity, tr: m.transparent, part: null }; byMat.set(m, r); boardMats.push(r); }
    }
  });
  for (const p of asm.parts) { for (const m of p.mats) { if (byMat.has(m)) { byMat.get(m).part = p; } } }
  const scenes = {};                               // key -> { group, box, pts, own, items }
  let chalk = null;
  let follower = null;                             // the robot scene's line follower (buildFollower), once that scene is in
  let clip = null;                                 // the simulator scene's laptop screen (screenClip), once that scene is in
  const twQ = new THREE.Vector3();                                // the motors scene's chalkboard (buildChalkboard), once that scene is in

  const stackedMq = window.matchMedia(STACKED);
  const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stacked = stackedMq.matches;
  function resize() {
    const r = host.getBoundingClientRect();
    stacked = stackedMq.matches;
    renderer.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), false);
    camera.aspect = Math.max(1, r.width) / Math.max(1, r.height);
    camera.updateProjectionMatrix();
    measure();
    if (composer && stacked) { disableBloom(); }      // a window narrowed into the stacked layout drops the bloom
    if (composer) { composer.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height))); }
    loop();
  }
  /* a pose's framing: the centre and radius of its scene's box with the board's (the board alone until it has loaded; the
     scene alone, or the empty board's place, for a pose with board: false) */
  function framing(pose) {
    const s = pose.scene && scenes[pose.scene];
    const box = s ? (pose.board === false ? s.ownBox : s.box) : boardBox;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    return { c: sphere.center, r: sphere.radius, box };
  }
  /* each pose's area in canvas px, the scene's outline fitted into it (fitWide): its photoreal render's box (measure) */
  let areas = null;
  /* a render's box in canvas px, less its feathered margin (stage_still_webp.py: 56 px at the image's own size), moved down
     by dy: the first screen's still (site.css places it; site.js followStill moves it in the stacked layout) and each
     chapter's figure (site.js CHAPTER_STILLS) - the 3D board and each scene fill the box their photoreal render fills, from the
     same view, so the live layer takes the render's place */
  function imgBox(img, dy) {
    const h = host.getBoundingClientRect(), r = img.getBoundingClientRect();
    /* the file's own size: the declared width / height attributes (site.js sets them), which hold before a lazy image loads */
    const nw = Number(img.getAttribute('width')) || img.naturalWidth || 1, nh = Number(img.getAttribute('height')) || img.naturalHeight || 1;
    const ix = r.width * 56 / nw, iy = r.height * 56 / nh;
    return { qL: r.left + ix - h.left, qT: r.top + iy - h.top + dy, qR: r.right - ix - h.left, qB: r.bottom - iy - h.top + dy };
  }
  function stillBox() { return imgBox(stage.querySelector('.stage-still'), 0); }
  function measure() {
    const h = host.getBoundingClientRect();
    const ch = stage.querySelectorAll('article.chapter');
    areas = POSES.map((pose, i) => {
      const c = ch[i - 1], im = c && c.querySelector('.chapter-fig img');
      if (!im && c && stackedMq.matches) {
        /* no render (yet): stacked, the space above the card where it sits with its chapter centred */
        const k = c.querySelector('.chapter-card'), st0 = stage.querySelector('.stage-still').getBoundingClientRect();
        const g = Math.max(12, st0.top - h.top), side = Math.max(12, Math.min(st0.left - h.left, 24));
        const top = h.height / 2 - c.offsetHeight / 2 + (k ? k.getBoundingClientRect().top - c.getBoundingClientRect().top : 0);
        return { qL: side, qT: g, qR: h.width - side, qB: Math.max(g + 80, top - g) };
      }
      if (!im && c) {
        /* no render (yet), wide: between the card and the LED indicator (or the window's edge), 48 px clear all round */
        const k = c.querySelector('.chapter-card'), led = document.querySelector('.led-nav');
        const lr = led && getComputedStyle(led).display !== 'none' ? led.getBoundingClientRect() : null;
        return { qL: (k ? k.getBoundingClientRect().right - h.left : h.width / 2) + 48, qT: 48, qR: (lr ? lr.left - h.left : h.width) - 48, qB: h.height - 48 };
      }
      if (!im) { return stillBox(); }
      /* where the figure sits when its chapter is centred on the visual: the pose's own place in the story (progress) */
      return imgBox(im, (h.top + h.height / 2) - (c.getBoundingClientRect().top + c.offsetHeight / 2));
    });
  }
  /* the story's position: pose k exactly where chapter k sits centred on the visual (pose 0 at the stage's top), held
     there for HOLD of the way to each neighbour (a chapter being read shows its own scene alone, settled), linear between;
     past the last chapter, the last pose */
  /* (owner, 2026-11-11: "dead zone with no animation should be longer. Equivalently, transitions in and out should be
     shorter (I believe this is also why the oled is only displaying the n logo very briefly)"): 0.3, was 0.15 - each
     scene stands still over 60 % of the way between two chapters' centres and changes over the middle 40 % (out over 20 %,
     in over 20 %), where it had stood 30 % and changed over 70 % */
  const HOLD = 0.3;
  let pastLast = 0;
  function progress() {
    const r = stage.getBoundingClientRect(), h = host.getBoundingClientRect();
    const y = -r.top, mid = h.top + h.height / 2;
    const ch = stage.querySelectorAll('article.chapter');
    const at = [0];
    for (let k = 1; k < POSES.length; k++) {
      const c = ch[k - 1];
      at.push(c ? Math.max(at[k - 1] + 1, c.offsetTop + c.offsetHeight / 2 - mid) : at[k - 1] + window.innerHeight);
    }
    /* the first pose also holds while the first screen's own words scroll past (a phone, a landscape tablet: they run
       past the stage, and site.js followStill carries the board up with them) */
    const hero = stage.querySelector('.stage-hero');
    const over = hero ? Math.max(0, Math.min(hero.offsetHeight - h.height, at[1] * 0.6)) : 0;
    /* past the last chapter's centre there is no next pose: its scene moves up with its render, as far as the page has
       scrolled past (a last chapter shorter than the window left its scene behind, over its card's words) */
    pastLast = Math.max(0, y - at[at.length - 1]);
    if (y <= over) { return 0; }
    for (let k = 1; k < at.length; k++) {
      const from = k === 1 ? over : at[k - 1];
      if (y < at[k]) { return k - 1 + Math.min(1, Math.max(0, ((y - from) / (at[k] - from) - HOLD) / (1 - 2 * HOLD))); }
    }
    return POSES.length - 1;
  }
  /* the board shown at a pose: not where a pose has no board (the simulator's laptop alone), nor while a chapter's scene is
     not in (not loaded yet, failed, or not for this window): the chapter's own render shows the board there, and the 3D
     board drawn over it doubled it (the owner, 2026-11-11, scrolling quickly: "the image of the evn showing and
     persisting even as the 3d models drew over it"); it fades in as the scene arrives and the render fades out */
  /* a background board (the chalkboard, the blocks board) kept below the site's header: in a short window (the owner's
     1920 x 1080 at 150 %, about 1280 x 600 of page) the scene fills the height and the board, placed above it, went up
     under the header. Each frame, from where it was built: if its top is above the canvas's top edge (plus a margin) it
     shrinks about its foot, to 0.7 at most, then slides down behind the scene, up to 0.6 of its height */
  const kv = new THREE.Vector3();
  function keepInView(g) {
    const f = g.userData.fit;
    if (!f || !g.visible) { return; }
    g.position.copy(f.base); g.scale.setScalar(1); g.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const r = canvas.getBoundingClientRect();
    const ys = (y) => { kv.set(0, y, 0).applyMatrix4(g.matrixWorld).project(camera); return (1 - kv.y) / 2 * r.height; };
    const top = ys(f.h / 2), foot = ys(-f.h / 2), px = (foot - top) / f.h;   // canvas px a unit
    const limit = 14;
    if (top >= limit || px <= 0) { return; }
    const need = (limit - top) / px;                             // units its top must come down
    const s = Math.max(0.7, 1 - need / f.h);                     // first shrunk about its foot (more of it stays above the scene)
    const drop = Math.min(f.h * 0.6, need - (1 - s) * f.h);      // then, if still too high, slid down
    g.position.copy(f.base).addScaledVector(f.up, -((1 - s) * f.h / 2 + Math.max(0, drop)));
    g.scale.setScalar(s);
    g.updateMatrixWorld(true);
  }
  function boardOn(pose) { return pose.board === false || (pose.scene && !scenes[pose.scene]) ? 0 : 1; }
  function target() {
    const p = progress();
    const i = Math.min(POSES.length - 2, Math.floor(p));
    const t = ease(p - i);
    const a = POSES[i], b = POSES[i + 1];
    const fa = framing(a), fb = framing(b);
    const o = { rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t), zoom: lerp(a.zoom || 1, b.zoom || 1, t),
                bf: lerp(boardOn(a), boardOn(b), t),
                cx: lerp(fa.c.x, fb.c.x, t), cy: lerp(fa.c.y, fb.c.y, t),
                cz: lerp(fa.c.z, fb.c.z, t), rad: lerp(fa.r, fb.r, t), p };
    for (const ax of ['x', 'y', 'z']) {
      o['b0' + ax] = lerp(fa.box.min[ax], fb.box.min[ax], t);
      o['b1' + ax] = lerp(fa.box.max[ax], fb.box.max[ax], t);
    }
    if (!areas) { measure(); }
    const a0 = stillBox();                                      // the first screen's box, as the still is now
    const aEnd = i + 1 === POSES.length - 1 && pastLast ? Object.assign({}, areas[i + 1], { qT: areas[i + 1].qT - pastLast, qB: areas[i + 1].qB - pastLast }) : areas[i + 1];
    for (const k of ['qL', 'qT', 'qR', 'qB']) { o[k] = lerp(i === 0 ? a0[k] : areas[i][k], aEnd[k], t); }
    return o;
  }
  const cur = target();
  /* the wide layout: the camera at the distance where the scene's turned box just fills the free area (times the pose's
     zoom), its picture moved onto the area's centre by a view offset (an off-axis frustum: no parallax from the shift) */
  const pv = new THREE.Vector3();
  function span(pts, D, C) {                   // the points' extent in the image (tangent units) from distance D
    camera.position.set(C.x, C.y + D * 0.06, C.z + D);
    camera.lookAt(C);
    camera.updateMatrixWorld(true);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) {
      pv.copy(q).applyMatrix4(boardRoot.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      const z = Math.max(1e-4, -pv.z);
      x0 = Math.min(x0, pv.x / z); x1 = Math.max(x1, pv.x / z); y0 = Math.min(y0, pv.y / z); y1 = Math.max(y1, pv.y / z);
    }
    return { x0, y0, x1, y1 };
  }
  function fitDistance(pts, C, aw, ah) {
    let lo = cur.rad * 0.3, hi = cur.rad * 40;
    for (let k = 0; k < 22; k++) {                       // the span shrinks as the camera backs off: bisect for the fit
      const mid = (lo + hi) / 2, b = span(pts, mid, C);
      if (b.x1 - b.x0 <= aw && b.y1 - b.y0 <= ah) { hi = mid; } else { lo = mid; }
    }
    return hi;
  }
  function posePts(pose) { const s = pose.scene && scenes[pose.scene]; return s ? (pose.board === false ? s.ownPts : s.pts) : boardPts; }
  function fitWide(C) {
    const r = host.getBoundingClientRect();
    const W = Math.max(1, r.width), H = Math.max(1, r.height);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanW = tanH * camera.aspect;
    const aw = Math.max(40, cur.qR - cur.qL) / W * 2 * tanW, ah = Math.max(40, cur.qB - cur.qT) / H * 2 * tanH;
    /* the two poses either side of the story's position, each fitted, then blended: continuous as a scene comes and goes */
    const i = Math.min(POSES.length - 2, Math.max(0, Math.floor(cur.p))), t = ease(Math.min(1, Math.max(0, cur.p - i)));
    const pa = posePts(POSES[i]), pb = posePts(POSES[i + 1]);
    const D = lerp(fitDistance(pa, C, aw, ah), fitDistance(pb, C, aw, ah), t) * cur.zoom;
    camera.clearViewOffset();
    const ba = span(pa, D, C), bb = span(pb, D, C);
    const cx = lerp((ba.x0 + ba.x1) / 2, (bb.x0 + bb.x1) / 2, t), cy = lerp((ba.y0 + ba.y1) / 2, (bb.y0 + bb.y1) / 2, t);
    const px = (cx / tanW + 1) / 2 * W, py = (1 - cy / tanH) / 2 * H;
    /* the depth range around the scene (its reach and an item's travel, at most 0.9 of the board's 4.2 units), not from
       0.05: the depth buffer's precision goes to the nearest part of its range, and from 0.05 the decals lost to the surfaces
       under them by the angle */
    const R = cur.rad * 1.6 + 4.2;
    camera.near = Math.max(0.05, D - R);
    camera.far = D + R;
    camera.setViewOffset(W, H, px - (cur.qL + cur.qR) / 2, py - (cur.qT + cur.qB) / 2, W, H);
  }
  /* the board faded for a pose with board: false (its materials made transparent only while it fades), its lid through
     the glass's own fade, its LED's light and its shadow with it */
  let boardFade = 1;
  function setBoardFade(b) {
    if (b === boardFade) { return; }
    const was = boardFade;
    boardFade = b;
    boardNode.visible = b > 0.001;
    if (was === 1 || b === 1) { loop(); }
  }
  /* each material's opacity: the board's fade times its part's own as it comes in (a material made transparent only while
     it is faded) */
  function paintBoard(rf) {
    for (const r of boardMats) {
      const a = boardFade * rf * (r.part ? r.part.alpha : 1);
      if (r.m.userData.fade) { r.m.userData.fade.value = a; continue; }
      const tr = a < 1 ? true : r.tr;
      if (r.m.transparent !== tr) { r.m.transparent = tr; r.m.needsUpdate = true; }
      r.m.opacity = a < 1 ? r.op * a : r.op;
    }
  }
  /* an item's materials faded to `a` */
  function paintItem(it, a) {
    if (a === it.alpha) { return; }
    it.alpha = a;
    for (const f of it.fm) {
      const tr = a < 1 ? true : f.tr;
      if (f.m.transparent !== tr) { f.m.transparent = tr; f.m.needsUpdate = true; }
      f.m.opacity = f.op * a;
    }
  }
  let asmT = 0, asmDone = false;
  function apply() {
    /* the entrance turns the board the last ENTRANCE_TURN into its first pose as it is put together */
    boardRoot.rotation.set(cur.rx, cur.ry - (asmDone ? 0 : ENTRANCE_TURN * (1 - easeOut(clamp01(asmT / ASSEMBLY_END)))), 0);
    boardRoot.updateMatrixWorld(true);
    /* the camera: the scene's outline fitted into the pose's free area (fitWide, wide and stacked alike) */
    fitWide(new THREE.Vector3((cur.b0x + cur.b1x) / 2, (cur.b0y + cur.b1y) / 2, (cur.b0z + cur.b1z) / 2).applyMatrix4(boardRoot.matrixWorld));
    /* a drag's turn, after the camera's fit: the board turns in place, the framing holds */
    if (userYaw || userPitch) { boardRoot.rotation.x += userPitch; boardRoot.rotation.y += userYaw; boardRoot.updateMatrixWorld(true); }
    /* the line follower's twitch: the board with every scene turned about the robot's axle (a two-wheel robot turns there),
       the floor and the line staying put; nothing while the robot scene is out */
    if (follower) {
      const fsc = scenes[FOLLOW.scene], a = follower.psi * (fsc ? Math.min(1, fsc.ins) : 0);
      model.quaternion.setFromAxisAngle(follower.up, a);
      model.position.copy(follower.pivot).sub(twQ.copy(follower.pivot).applyQuaternion(model.quaternion));
      model.updateMatrixWorld(true);
    }
    if (chalk) { keepInView(chalk.group); }
    if (follower) { keepInView(follower.board); }
    setAssembly(asm, asmDone ? Infinity : asmT, shadow);
    setBoardFade(cur.bf > 0.999 ? 1 : cur.bf < 0.001 ? 0 : cur.bf);
    /* a replay waiting to start fades the whole board out with the items (review site76_r7 S2: it vanished in a frame and
       the entrance's turn jumped it): the turn then starts unseen */
    const rf = replay ? gate : 1;
    paintBoard(rf);
    shadow.material.opacity = shadow.userData.asm * boardFade * rf;
    if (asm.leds) { setLed(asm.leds.power, asm.powerOn, boardFade * rf); }
    /* each scene's items: plugged in over the second half of the way to their pose, pulled out over the first half of the
       way on, one after another (the last in the first out); the bare board at each midpoint. `gate` takes them all out
       before a replayed entrance and plugs them back after it */
    let usb = 0;
    POSES.forEach((pose, idx) => {
      const s = pose.scene && scenes[pose.scene];
      if (!s) { return; }
      const ins = clamp01(1 - 2 * Math.abs(cur.p - idx)) * gate;
      s.ins = ins;
      s.group.visible = ins > 0;
      const usbScene = !!(SCENE_MOTION[pose.scene] && SCENE_MOTION[pose.scene].usb);
      const n = s.items.filter((it) => it.key !== 'rest').length;
      let j = 0;
      for (const it of s.items) {
        const pr = it.key === 'rest' || n < 2 ? ins : clamp01((ins - (j++) * STAGGER / (n - 1)) / (1 - STAGGER));
        it.prog = pr;
        const off = 1 - ease(pr);
        it.offG.copy(it.dir).multiplyScalar(it.dist * off);
        for (const r of it.recs) {
          r.n.position.copy(r.base).addScaledVector(r.d, off).addScaledVector(r.lift, ease(it.hov));
          r.n.visible = pr > 0;
        }
        /* fading in over the first ITEM_FADE of its way in, out over the last of its way out */
        paintItem(it, pr >= 1 ? 1 : easeOut(clamp01(pr / ITEM_FADE)));
        for (const l of it.lit) {                                 // lit only once it is plugged in
          l.m.emissiveIntensity = pr >= PLUGGED ? l.ei : 0;
          l.m.color.copy(l.c0).multiplyScalar(pr >= PLUGGED ? 1 : LIT_OFF);
        }
        if (usbScene && it.key !== 'rest' && pr >= PLUGGED) { usb = 1; }
        for (const m of it.mats) { m.emissive.copy(HOVER_GLOW).multiplyScalar(it.hov); }
        if (it.spin) {
          const u = it.spin0 ? clamp01((performance.now() - it.spin0) / SPIN_MS[it.spin.kind]) : 1;
          const a = it.spin.kind === 'hub' ? 4 * Math.PI * ease(u) : 0.14 * Math.sin(u * Math.PI * 4) * (1 - u);
          it.spin.pivot.quaternion.setFromAxisAngle(it.spin.axis, a);
        }
      }
    });
    if (asm.leds) { setLed(asm.leds.usb, usb, boardFade * rf); }
  }
  /* PLUGGED: an item counts as plugged in (its lights on: the OLED's mark, the colour sensor's lamp, the green USB LED)
     once 90 % of the way in - the eye sees it home there (its offset under 0.5 %), while 100 % waits for the eased
     story to settle exactly on the pose, about 1.7 s later (the owner, 2026-11-11: "n on the oled only appears after
     some time, same with the green led when evn connects to laptop") */
  const ITEM_FADE = 0.4, LIT_OFF = 0.3, PLUGGED = 0.9;
  /* a replay of the entrance (owner, 2026-11-11: "Clicking the model should re-trigger the animation"): the shown items
     pulled out first (gate to 0 over GATE_MS), the board put together again, then the items plugged back in */
  let gate = 1, gateT = 1, replay = false, replays = 0;
  /* a drag turns the board (owner, 2026-11-11: "some interactivity?"): with a mouse or pen, on the board or a shown item;
     let go, it eases back to its pose (DRAG_BACK_MS); touch keeps the page's own scroll */
  let userYaw = 0, userPitch = 0, drag = null, dragMoved = false, dragEnded = 0;
  const DRAG_RAD = 0.008, DRAG_PITCH = 0.35, DRAG_BACK_MS = 450;
  const GATE_MS = 600;
  const SPIN_MS = { hub: 1400, twitch: 700 };

  host.appendChild(canvas);
  let visible = true, running = false, frames = [], last = 0, gaveUp = false, judged = false, t0 = 0, asm0 = 0, skip = false;
  const recent = [];                                     // the latest frame times while the board moves (the scenes' cost)
  const keepSlow = !!(opts && opts.keepSlow);
  /* leaving the page removes the stage: the observer reports it, whether or not the loop is running */
  const io = new IntersectionObserver((es) => {
    if (!stage.isConnected) { stop('left'); return; }
    visible = es[0].isIntersecting;
    if (visible) { loop(); } else { hideFixed(); }
  });
  io.observe(stage);
  /* what sits on the window over the stage (the loading pill, the run and clip buttons, the name box): the frames that
     place them stop once the stage is out of view, so they are hidden then, not left over the page below */
  function hideFixed() {
    loadEl.classList.remove('on');
    try {                                            // the buttons and the name box are made further on: none yet, nothing to hide
      for (const el of [runEl, clipEl]) { if (!el.hidden) { el.hidden = true; } }
      if (hovered) { hovered.hovT = 0; hovered = null; }
      showTip();
    } catch (e) { /* not made yet */ }
  }
  /* any scroll, key or pointer press finishes the entrance at once */
  const onSkip = () => { if (!asmDone) { skip = true; loop(); } };
  /* a scroll ends a hover: the item would stay lit and lifted while the scroll takes it out (review site76_r6 N1) */
  const onScroll = () => { onSkip(); if (hovered) { hovered.hovT = 0; hovered = null; showTip(); } if (visible) { loop(); } };
  const onVis = () => { if (!document.hidden) { loop(); } };
  const onMotion = () => { if (motionMq.matches) { stop('reduced-motion'); } };
  const onLost = (e) => { e.preventDefault(); stop('lost'); };
  /* hover (a mouse or a pen, never touch): the chapters' words sit over the canvas, so the pointer is followed on the
     window and the ray cast at the canvas's own rectangle; checked once a frame at most, rendering only on a change */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), wb = new THREE.Box3();
  let pointer = null, hoverQueued = false, hovered = null;
  const canHover = window.matchMedia('(any-hover: hover)').matches;
  /* the hovered item's name beside the cursor (ITEM_NAMES); decorative like the layer (aria-hidden): each chapter's own
     words and links name the same parts and documents. On the stage, over the chapters' words (site.css .stage-tip) */
  const tipEl = document.createElement('div');
  tipEl.className = 'stage-tip';
  tipEl.setAttribute('aria-hidden', 'true');
  stage.appendChild(tipEl);
  /* the line follower's run button (FOLLOW): over its blocks board's corner while the robot scene is in */
  const runEl = document.createElement('button');
  runEl.type = 'button';
  runEl.className = 'stage-run';
  runEl.hidden = true;
  runEl.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="i-play" d="M8 5.5v13l10.5-6.5z"/>'
    + '<path class="i-pause" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>';
  /* in the tab order right after the robot chapter's own words (the Razer's review of fd0838a3d: appended to the stage,
     Tab reached it only after chapter 05's link, which scrolled 04 away and hid it); fixed, so where it sits in the
     page does not move it (the chapter is no containing block: no transform or filter on it) */
  const runHome = stage.querySelectorAll('article.chapter')[POSES.findIndex((q) => q.scene === FOLLOW.scene) - 1];
  (runHome || stage).appendChild(runEl);
  function runState() {
    const on = !!(follower && follower.playing);
    runEl.setAttribute('aria-pressed', on ? 'true' : 'false');
    runEl.setAttribute('aria-label', on ? 'Pause the line follower' : 'Run the line follower');
    stage.setAttribute('data-3d-follow', on ? 'running' : 'paused');
  }
  runState();
  runEl.addEventListener('click', () => {
    if (!follower) { return; }
    follower.playing = !follower.playing;
    runState();
    loop();
  });
  const runV = new THREE.Vector3(), header = document.querySelector('.site-header');
  function placeRun() {
    const fsc = follower && scenes[FOLLOW.scene];
    const show = !!(fsc && fsc.group.visible && fsc.ins >= 0.6 && asmDone && !replay && gate === 1);
    if (follower && follower.playing !== (runEl.getAttribute('aria-pressed') === 'true')) { runState(); }   // paused by the scene leaving
    if (!show) { if (!runEl.hidden) { runEl.hidden = true; } return; }
    follower.board.updateMatrixWorld(true);
    runV.copy(follower.runAt).applyMatrix4(follower.board.matrixWorld).project(camera);
    const r = canvas.getBoundingClientRect();
    /* never under the site's header (a short window puts the board's corner there): held just below it */
    const hb = header ? header.getBoundingClientRect().bottom + 28 : 0;
    runEl.style.transform = `translate(${Math.round(r.left + (runV.x + 1) / 2 * r.width)}px, ${Math.round(Math.max(hb, r.top + (1 - runV.y) / 2 * r.height))}px) translate(-50%, -50%)`;
    if (runEl.hidden) { runEl.hidden = false; }
  }
  /* the simulator clip's pause button (SCREEN_CLIP): at the laptop screen's lower right while that scene is in, in the tab
     order at the end of chapter 05's own words, as the run button is in 04's */
  const clipEl = runEl.cloneNode(true);
  clipEl.hidden = true;
  const clipHome = stage.querySelectorAll('article.chapter')[POSES.findIndex((q) => q.scene === SCREEN_CLIP.scene) - 1];
  (clipHome || stage).appendChild(clipEl);
  function clipState() {
    const on = !!(clip && !clip.userPaused);
    clipEl.setAttribute('aria-pressed', on ? 'true' : 'false');      // pressed: playing (the pause icon shows)
    clipEl.setAttribute('aria-label', on ? 'Pause the simulator clip' : 'Play the simulator clip');
    stage.setAttribute('data-3d-clip', !clip ? 'none' : on ? (clip.video.paused ? 'waiting' : 'playing') : 'paused');
  }
  clipEl.addEventListener('click', () => {
    if (!clip) { return; }
    clip.userPaused = !clip.userPaused;
    clipState();
    loop();
  });
  const clipV = new THREE.Vector3();
  function placeClip() {
    const csc = clip && scenes[SCREEN_CLIP.scene];
    const show = !!(csc && csc.group.visible && csc.ins >= 0.6 && asmDone && !replay && gate === 1);
    clipState();
    if (!show) { if (!clipEl.hidden) { clipEl.hidden = true; } return; }
    clip.screen.updateMatrixWorld(true);
    /* the screen's box as it is drawn now; the button inside its lower right (the mesh's box reaches past the picture) */
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of clip.corners) {
      clipV.copy(c).applyMatrix4(clip.screen.matrixWorld).project(camera);
      x0 = Math.min(x0, clipV.x); x1 = Math.max(x1, clipV.x); y0 = Math.min(y0, -clipV.y); y1 = Math.max(y1, -clipV.y);
    }
    const r = canvas.getBoundingClientRect();
    const px = r.left + ((x0 + (x1 - x0) * 0.9) + 1) / 2 * r.width, py = r.top + ((y0 + (y1 - y0) * 0.74) + 1) / 2 * r.height;
    clipEl.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px) translate(-50%, -50%)`;
    if (clipEl.hidden) { clipEl.hidden = false; }
  }
  function showTip() {
    const it = hovered && hovered.name && pointer && !pointer.words && !dragMoved ? hovered : null;
    if (!it) { tipEl.classList.remove('on'); stage.removeAttribute('data-3d-tip'); return; }
    if (tipEl.textContent !== it.name) { tipEl.textContent = it.name; }
    /* below right of the cursor, turned to its other side at the window's right or bottom edge */
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = pointer.x + 14, y = pointer.y + 18;
    if (x + w > window.innerWidth - 8) { x = pointer.x - 10 - w; }
    if (y + h > window.innerHeight - 8) { y = pointer.y - 10 - h; }
    tipEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    tipEl.classList.add('on');
    stage.setAttribute('data-3d-tip', it.name);
  }
  const onPointer = (e) => {
    if (e.pointerType === 'touch') { return; }
    pointer = { x: e.clientX, y: e.clientY, words: onWords(e.target) };
    if (!hoverQueued) { hoverQueued = true; requestAnimationFrame(hoverCheck); }
  };
  function hoverCheck() {
    hoverQueued = false;
    if (gaveUp || !pointer || !asmDone || !judged || drag) { return; }
    const r = canvas.getBoundingClientRect();
    let best = null, bestD = Infinity;
    if (pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom) {
      ndc.set((pointer.x - r.left) / r.width * 2 - 1, -((pointer.y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      for (const s of Object.values(scenes)) {
        if (!s.group.visible) { continue; }
        for (const it of s.items) {
          if (!it.hover || it.prog < 1) { continue; }
          if (!ray.ray.intersectsBox(wb.copy(it.box).applyMatrix4(s.group.matrixWorld))) { continue; }
          const hit = ray.intersectObjects(it.nodes, true)[0];
          if (hit && hit.distance < bestD) { bestD = hit.distance; best = it; }
        }
      }
      /* the board in front of a part hides it: no name, and a click replays the entrance (the Razer's review: in 04 a click
         on the EVN board opened the drive base's page, the robot behind it) */
      if (best && boardFade > 0.5) {
        const bh = ray.intersectObject(boardNode, true)[0];
        if (bh && bh.distance < bestD) { best = null; }
      }
    }
    /* a named item opens its documentation on a click (onClick): the link's cursor; the rest of the model turns on a drag */
    stage.style.cursor = pointer.words ? '' : best && best.doc ? 'pointer' : onModel(pointer.x, pointer.y) ? 'grab' : '';
    if (best === hovered) { showTip(); return; }
    if (hovered) { hovered.hovT = 0; }
    hovered = best;
    if (best) { best.hovT = 1; if (best.spin) { best.spin0 = performance.now(); } }
    showTip();
    loop();
  }
  /* the board's or a shown scene's box under a point (cheap: boxes, not triangles) */
  function onModel(x, y) {
    const r = canvas.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) { return false; }
    ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (boardFade > 0.5 && ray.ray.intersectsBox(wb.copy(boardBox).applyMatrix4(boardRoot.matrixWorld))) { return true; }
    for (const sc of Object.values(scenes)) { if (sc.group.visible && ray.ray.intersectsBox(wb.copy(sc.ownBox).applyMatrix4(boardRoot.matrixWorld))) { return true; } }
    return false;
  }
  const INTERACTIVE = 'a, button, input, select, textarea, summary, label, [role="button"]';
  /* words: a drag never starts on them, nor does the grab cursor show over them (review site76_r7_verify S2: the boxes the
     test uses reach past the board's outline, over the cards' words) */
  const WORDS = '.chapter-card, .stage-copy, p, h1, h2, h3, li';
  const onWords = (t) => !!(t && t.closest && t.closest(WORDS));
  const onDragStart = (e) => {
    if (gaveUp || !asmDone || !judged || replay || e.pointerType === 'touch' || e.button !== 0) { return; }
    if (e.target && e.target.closest && e.target.closest(INTERACTIVE)) { return; }
    if (onWords(e.target) || !onModel(e.clientX, e.clientY)) { return; }
    e.preventDefault();                                   // no text selection while the board turns
    drag = { x: e.clientX, y: e.clientY, yaw: userYaw, pitch: userPitch };
    dragMoved = false;
    /* the hovered item stays until the drag moves: a press and release on it is a click, which opens its documentation */
    stage.style.cursor = 'grabbing';
  };
  const onDragMove = (e) => {
    if (!drag) { return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragMoved && Math.abs(dx) + Math.abs(dy) > 4) { dragMoved = true; if (hovered) { hovered.hovT = 0; hovered = null; } showTip(); }
    userYaw = drag.yaw + dx * DRAG_RAD;
    userPitch = Math.max(-DRAG_PITCH, Math.min(DRAG_PITCH, drag.pitch + dy * DRAG_RAD));
    loop();
  };
  /* a drag that moved: the click its release fires (straight after, however long the button was held) is not a click */
  const onDragEnd = () => { if (drag) { drag = null; if (dragMoved) { dragEnded = performance.now(); } dragMoved = false; stage.style.cursor = ''; loop(); } };
  /* a click on a named item opens its documentation (ctrl, cmd or shift: in a new tab, as a link would); a click on the
     board (not on a link or a control over it) replays the entrance; a drag's own click does neither */
  const onClick = (e) => {
    if (dragEnded && performance.now() - dragEnded < 300) { dragEnded = 0; return; }
    if (gaveUp || !asmDone || replay || !judged) { return; }
    if (e.target && e.target.closest && e.target.closest(INTERACTIVE)) { return; }
    const r = canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { return; }
    if (hovered && hovered.doc && !onWords(e.target)) {
      const url = new URL('.', document.baseURI).href + '#/' + hovered.doc;
      if (e.ctrlKey || e.metaKey || e.shiftKey) { window.open(url, '_blank', 'noopener'); return; }
      hovered.hovT = 0; hovered = null; showTip();
      location.href = url;
      return;
    }
    if (boardFade < 0.5) { return; }                                 // the simulator's laptop alone: no board to replay
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.intersectObject(boardNode, true).length) { return; }
    replay = true;
    gateT = 0;
    if (hovered) { hovered.hovT = 0; hovered = null; }
    showTip();
    loop();
  };
  function listenSkip() {
    window.addEventListener('keydown', onSkip);
    window.addEventListener('pointerdown', onSkip, { passive: true });
  }
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('click', onClick);
  if (canHover) {
    window.addEventListener('pointerdown', onDragStart);
    window.addEventListener('pointermove', onDragMove, { passive: true });
    window.addEventListener('pointerup', onDragEnd, { passive: true });
    window.addEventListener('pointercancel', onDragEnd, { passive: true });
  }
  listenSkip();
  if (canHover) { window.addEventListener('pointermove', onPointer, { passive: true }); }
  document.addEventListener('visibilitychange', onVis);
  if (motionMq.addEventListener) { motionMq.addEventListener('change', onMotion); }
  if (stackedMq.addEventListener) { stackedMq.addEventListener('change', resize); }
  canvas.addEventListener('webglcontextlost', onLost);
  if (motionMq.matches) {                                     // switched on while the layer was loading
    window.__evn3dLive = (window.__evn3dLive || 0) + 1;
    stop('reduced-motion');
    return { stop() {} };
  }

  window.__evn3dLive = (window.__evn3dLive || 0) + 1;          // live layers (one at most; data/shots.js checks)
  function unlistenSkip() {
    window.removeEventListener('keydown', onSkip);
    window.removeEventListener('pointerdown', onSkip);
  }
  function stop(reason) {
    if (gaveUp) { return; }
    gaveUp = true;
    window.__evn3dLive -= 1;
    io.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('click', onClick);
    window.removeEventListener('pointerdown', onDragStart);
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    stage.style.cursor = '';
    unlistenSkip();
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVis);
    if (motionMq.removeEventListener) { motionMq.removeEventListener('change', onMotion); }
    if (stackedMq.removeEventListener) { stackedMq.removeEventListener('change', resize); }
    canvas.removeEventListener('webglcontextlost', onLost);
    scene.traverse((o) => {
      if (o.geometry) { o.geometry.dispose(); }
      for (const m of [].concat(o.material || [])) {
        for (const k of Object.keys(m)) { if (m[k] && m[k].isTexture) { m[k].dispose(); } }
        m.dispose();
      }
    });
    if (composer) { disableBloom(); }
    if (envTarget) { envTarget.dispose(); }
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    loadEl.remove();
    tipEl.remove();
    runEl.remove();
    clipEl.remove();
    if (clip) { clip.dispose(); }
    if (stage.isConnected) {
      stage.setAttribute('data-3d', 'fallback');
      stage.setAttribute('data-3d-why', reason);
    }
  }
  const KEYS = ['rx', 'ry', 'zoom', 'bf', 'cx', 'cy', 'cz', 'rad', 'p', 'b0x', 'b0y', 'b0z', 'b1x', 'b1y', 'b1z', 'qL', 'qT', 'qR', 'qB'];
  const FOLLOW_MS = 200;                                 // the board eases to the scroll position with this time constant
  const HOVER_MS = 180;
  function frame(time) {
    if (gaveUp) { return; }
    if (!visible || document.hidden) { running = false; return; }
    if (!asm0) { asm0 = time; }
    /* every motion on the clock: a slow renderer jumps further each frame rather than taking longer */
    const dt = last ? Math.min(1000, time - last) : 16;
    let anim = false;
    if (gate !== gateT) { gate = gateT > gate ? Math.min(gateT, gate + dt / GATE_MS) : Math.max(gateT, gate - dt / GATE_MS); anim = true; }
    if (replay && gate === 0) {                             // the items and the board are out: the entrance again
      replay = false;
      gate = gateT = 0;
      asmDone = false; asm0 = time; asmT = 0; skip = false;
      listenSkip();
      replays++;
      stage.setAttribute('data-3d-replays', String(replays));
      stage.setAttribute('data-3d-assembled', 'replaying');
    }
    if (!asmDone) {
      asmT = skip ? ASSEMBLY_END : (time - asm0) / 1000;
      if (asmT >= ASSEMBLY_END) { asmDone = true; unlistenSkip(); gateT = 1; stage.setAttribute('data-3d-assembled', skip ? 'skipped' : 'played'); }
    }
    const kf = 1 - Math.exp(-dt / FOLLOW_MS);
    const tg = target();
    let moving = false;
    for (const k of KEYS) {
      const dv = tg[k] - cur[k];
      if (Math.abs(dv) > (k[0] === 'q' ? 0.25 : 1e-4 * (k === 'rad' || k[0] === 'c' || k[0] === 'b' ? Math.max(1, cur.rad) : 1))) { moving = true; cur[k] += dv * kf; } else { cur[k] = tg[k]; }
    }
    /* the board goes as the scroll says, at once: eased, it lagged a fast scroll by 200 ms and was drawn, half faded, over
       a chapter whose scene had not loaded (the Razer's fast-scroll check, data/screens/fast-scroll-1.png); it eases in */
    if (tg.bf < cur.bf) { cur.bf = tg.bf; }
    if (!drag && (userYaw || userPitch)) {
      const kb = 1 - Math.exp(-dt / DRAG_BACK_MS);
      userYaw -= userYaw * kb; userPitch -= userPitch * kb;
      if (Math.abs(userYaw) < 1e-3 && Math.abs(userPitch) < 1e-3) { userYaw = userPitch = 0; }
      anim = true;
    }
    /* hover: each item eases to lit and lifted or back; a motor's turn runs its course */
    for (const s of Object.values(scenes)) {
      for (const it of s.items) {
        if (it.hov !== it.hovT) { it.hov = it.hovT > it.hov ? Math.min(it.hovT, it.hov + dt / HOVER_MS) : Math.max(it.hovT, it.hov - dt / HOVER_MS); anim = true; }
        if (it.spin && it.spin0) { if (time - it.spin0 < SPIN_MS[it.spin.kind] + 40) { anim = true; } else { it.spin0 = 0; } }
      }
    }
    /* the chalkboard writes on the clock while its scene is in, and is wiped once the scene is wholly out of view */
    if (chalk) {
      const cs = scenes[CHALK.scene];
      if (chalk.step(dt, cs && cs.group.visible ? cs.ins : 0, time)) { anim = true; }
      if (stage.getAttribute('data-3d-chalk') !== chalk.state) { stage.setAttribute('data-3d-chalk', chalk.state); }
    }
    /* the simulator's clip plays while its scene is in, unless paused */
    if (clip) {
      const csc = scenes[SCREEN_CLIP.scene];
      if (clip.step(csc && csc.group.visible ? csc.ins : 0)) { anim = true; }
    }
    /* the line follower runs while its button says so and its scene is in */
    if (follower) {
      const fsc = scenes[FOLLOW.scene];
      if (follower.step(dt, fsc && fsc.group.visible ? fsc.ins : 0)) { anim = true; }
    }
    apply();
    draw();
    placeRun();
    placeClip();
    const at = String(Math.round(cur.p));
    if (stage.getAttribute('data-3d-at') !== at) { stage.setAttribute('data-3d-at', at); }   // the pose in view: site.css fades a phone's canvas past the first screen
    /* the story's eased position, for the LED indicator (site.js ledNav): its gold crossfades over the scenes' own change
       (review site76_r8 S1: measured on its own it ran about 77 px of scroll ahead of them) */
    const pp = cur.p.toFixed(3);
    if (stage.getAttribute('data-3d-p') !== pp) { stage.setAttribute('data-3d-p', pp); document.dispatchEvent(new Event('evn3dprogress')); }
    if (!t0) { t0 = time; }
    if (!judged) {                                       // the entrance's frames: the speed test, 30 frames or 3 s
      if (last && (asmDone || asmT >= ASSEMBLY.pcb.t)) { frames.push(time - last); }    // once the PCB, the bulk of the board, is drawn
      if (frames.length === 30 || (frames.length >= 5 && time - t0 > 3000)) {
        judged = true;
        const s = frames.slice().sort((x, y) => x - y);
        const med = s[Math.floor(s.length / 2)];         // the median frame
        stage.setAttribute('data-3d-frame-ms', String(Math.round(med)));
        if (med > 45 && !keepSlow) { stop('slow'); return; }
        if (med < 25 && !stackedMq.matches) { enableBloom(); }
      }
    } else if (last && moving) {                         // and again while the scenes move: 20 frames, a median over 60 ms
      recent.push(time - last);
      if (recent.length > 20) { recent.shift(); }
      if (recent.length === 20 && !keepSlow) {
        const s = recent.slice().sort((x, y) => x - y);
        if (s[10] > 40 && composer) { disableBloom(); recent.length = 0; }        // the bloom goes first
        else if (s[10] > 60) { stop('slow-scenes'); return; }
      }
    }
    if (judged) { nearScenes(); }
    showLoad();
    last = time;
    /* gate !== gateT: the frame the replayed entrance ends sets the gate on its way back up (without it the loop idled there
       and the items never came back) */
    if (moving || anim || replay || gate !== gateT || !judged || !asmDone) { requestAnimationFrame(frame); } else { running = false; last = 0; markRect(); }
  }
  function loop() { if (!running && !gaveUp) { running = true; last = 0; requestAnimationFrame(frame); } }
  /* where the shown model is on screen once it has settled (CSS px): data/shots.js checks it never covers the words */
  function markRect() {
    /* the shown models' outlines (the board's, and each shown item's where its scroll puts it - never its hover lift),
       not their boxes: a box's empty corners reach over words the models never touch */
    const sets = boardFade > 0 ? [[boardPts, boardRoot, null]] : [];
    for (const s of Object.values(scenes)) {
      if (!s.group.visible) { continue; }
      for (const it of s.items) { if (it.prog > 0) { sets.push([it.pts, s.group, it.offG]); } }
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const r = host.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const [pts, frame, off] of sets) for (const q of pts) {
      v.copy(q);
      if (off) { v.add(off); }
      v.applyMatrix4(frame.matrixWorld).project(camera);
      const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height;
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
    if (sets.length) { stage.setAttribute('data-3d-rect', [x0, y0, x1, y1].map(Math.round).join(',')); } else { stage.setAttribute('data-3d-rect', ''); }
  }
  async function enableBloom() {
    if (composer || bloomFailed) { return; }
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/OutputPass.js')]);
      if (gaveUp || stackedMq.matches || composer) { return; }
      const r = host.getBoundingClientRect();
      const c = new EffectComposer(renderer);
      const base = new RenderPass(scene, camera);
      base.clearAlpha = 0;                   // as it ships, RenderPass's clear left the canvas opaque (data/bloom_probe)
      c.addPass(base);
      /* strength 0.3 (was 0.55): it is on only where the first frames are fast, so the page looked different from one
         load to the next (the owner, 2026-11-11: "bloom is very intense initially on razer, refreshing seems to set it
         back to normal"); gentler, with or without it the page reads the same */
      const bloom = new UnrealBloomPass(new THREE.Vector2(r.width, r.height), 0.3, 0.4, 0.94);
      /* the glow is added to the colour only: its blur writes alpha 1 everywhere, and blended as it ships it made the
         whole canvas opaque over the stage's own background. The scene's alpha is kept, so the glow adds onto the page */
      Object.assign(bloom.blendMaterial, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
      c.addPass(bloom);
      c.addPass(new OutputPass());
      c.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
      composer = c;
      stage.setAttribute('data-3d-bloom', 'on');
      loop();
    } catch (e) { bloomFailed = true; }
  }
  function disableBloom() {
    if (!composer) { return; }
    for (const pass of composer.passes) { if (pass.dispose) { pass.dispose(); } }
    composer.dispose();
    composer = null;
    stage.setAttribute('data-3d-bloom', 'off');
  }
  /* a chapter's scene is fetched once the board has passed its speed test and the story is within one chapter of it
     (a visitor who never scrolls downloads none), one at a time; a pose whose scene models.json does not name shows the
     board alone */
  let fetching = false, nLoaded = 0;
  function nearScenes() {
    if (fetching || !models || !models.scenes || !model.userData.frame) { return; }
    const idx = POSES.findIndex((pose, i) => pose.scene && !scenes[pose.scene] && models.scenes[pose.scene] && !pose._failed
                                             && cur.p >= i - 1.25 && sceneAllowed(pose.scene));
    if (idx >= 0) { fetching = true; loadScene(POSES[idx]).then(() => { fetching = false; loop(); }); }
  }
  /* phones (760 px and under) load only models.json phone_scenes */
  function sceneAllowed(key) {
    return !window.matchMedia(PHONE).matches || !models.phone_scenes || models.phone_scenes.includes(key);
  }
  async function loadScene(pose) {
    const loader = await gltfLoader();
    const fr = model.userData.frame;
    {
      const keyName = pose.scene;
      try {
        const gltf = await loader.loadAsync(new URL(models.scenes[keyName], document.baseURI).href, onLoadProgress(keyName));
        if (gaveUp) { return; }
        const group = gltf.scene;
        softenEnv(group);
        group.scale.setScalar(fr.k);
        group.position.copy(fr.offset);
        model.add(group);
        group.updateMatrixWorld(true);
        decalOffsets(group);
        /* its outline and box in the board group's frame (alone, and with the board's), and its items, all as it stands
           put together, before any item is moved */
        const ownBox = localBox(boardRoot, [group]), ownPts = outline(boardRoot, [group]);
        const items = sceneItems(group, keyName, model, boardRoot);
        scenes[keyName] = { group, ownBox, ownPts, box: ownBox.clone().union(boardBox), pts: boardPts.concat(ownPts), items, ins: 0 };
        /* the motors scene's chalkboard: after the scene's outline and items, so it is in neither (the camera's framing,
           the words' check, the hover) */
        if (keyName === CHALK.scene) {
          try { await document.fonts.ready; } catch (e) { /* the fallback font, then */ }
          if (gaveUp) { return; }
          chalk = buildChalkboard(pose, ownBox);
          model.add(chalk.group);
        }
        /* the robot scene's line follower: its floor and board still, its sensors' light turning with the robot */
        if (keyName === FOLLOW.scene) {
          follower = buildFollower(model, group, pose, ownBox, 4.2 / ((models && models.long_mm) || 104));
          if (follower) { boardRoot.add(follower.still, follower.board); model.add(follower.moving); }
        }
        /* the simulator scene's laptop: the Rescue Line clip on its screen */
        if (keyName === SCREEN_CLIP.scene) { clip = screenClip(group); }
        /* what each item is (its key, node count, direction, and a motor's hub turn or twitch): for the captures */
        stage.setAttribute('data-3d-items-' + keyName, items.map((it) => `${it.key}:${it.nodes.length}:${['x', 'y', 'z'].map((a) => Math.round(it.dir[a])).join('')}${it.spin ? ':' + it.spin.kind : ''}`).join(' '));
        group.visible = false;
        const chEl = stage.querySelectorAll('article.chapter')[POSES.indexOf(pose) - 1];
        if (chEl) { chEl.classList.add('has-3d'); }                      // site.css: its render gives the live scene its place
        nLoaded++;
        stage.setAttribute('data-3d-scenes', String(nLoaded));
      } catch (e) { pose._failed = true; /* a scene that does not load: its chapter shows the board alone */ }
      if (loadState.key === keyName) { loadState.key = null; }
      showLoad();
    }
  }

  /* the first frames drawn before the canvas is shown, so the photo never gives way to an empty canvas: the board put
     together (every shader compiled, every buffer uploaded), then as the entrance starts (nothing yet: the bottom shell
     drops in as the canvas fades in) */
  resize();
  Object.assign(cur, target());
  asmDone = true;
  apply();
  draw();
  asmDone = false;
  asmT = 0;
  apply();
  draw();
  loadState.board = false;
  loadReady = true;
  showLoad();
  stage.setAttribute('data-3d', 'ready');
  stage.setAttribute('data-3d-model', models && models.board ? 'model' : 'placeholder');
  loop();
  /* progress: where the scroll puts the story now (a pose index, between two while a scene changes), from the page's
     layout alone - site.js's LED indicator reads it every scroll frame (the eased position lags a jump and freezes while
     the layer is out of view: owner, 2026-11-11, "When scrolling quickly, the rgbled shows 2 LEDs lit, with an earlier
     led stuck") */
  return { stop, progress };
}
