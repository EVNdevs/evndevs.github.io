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
    return { key: k, nodes, dir, hover: true };
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
  host.appendChild(loadEl);
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
    loadEl.style.left = Math.round((box.qL + box.qR) / 2) + 'px';
    loadEl.style.top = Math.round(Math.min(h.height - 44, Math.max(8, box.qB + 6))) + 'px';
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
  function target() {
    const p = progress();
    const i = Math.min(POSES.length - 2, Math.floor(p));
    const t = ease(p - i);
    const a = POSES[i], b = POSES[i + 1];
    const fa = framing(a), fb = framing(b);
    const o = { rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t), zoom: lerp(a.zoom || 1, b.zoom || 1, t),
                bf: lerp(a.board === false ? 0 : 1, b.board === false ? 0 : 1, t),
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
          l.m.emissiveIntensity = pr >= 1 ? l.ei : 0;
          l.m.color.copy(l.c0).multiplyScalar(pr >= 1 ? 1 : LIT_OFF);
        }
        if (usbScene && it.key !== 'rest' && pr >= 1) { usb = 1; }
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
  const ITEM_FADE = 0.4, LIT_OFF = 0.3;
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
    if (visible) { loop(); }
  });
  io.observe(stage);
  /* any scroll, key or pointer press finishes the entrance at once */
  const onSkip = () => { if (!asmDone) { skip = true; loop(); } };
  /* a scroll ends a hover: the item would stay lit and lifted while the scroll takes it out (review site76_r6 N1) */
  const onScroll = () => { onSkip(); if (hovered) { hovered.hovT = 0; hovered = null; } if (visible) { loop(); } };
  const onVis = () => { if (!document.hidden) { loop(); } };
  const onMotion = () => { if (motionMq.matches) { stop('reduced-motion'); } };
  const onLost = (e) => { e.preventDefault(); stop('lost'); };
  /* hover (a mouse or a pen, never touch): the chapters' words sit over the canvas, so the pointer is followed on the
     window and the ray cast at the canvas's own rectangle; checked once a frame at most, rendering only on a change */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), wb = new THREE.Box3();
  let pointer = null, hoverQueued = false, hovered = null;
  const canHover = window.matchMedia('(any-hover: hover)').matches;
  const onPointer = (e) => {
    if (e.pointerType === 'touch') { return; }
    pointer = { x: e.clientX, y: e.clientY, words: onWords(e.target) };
    if (!hoverQueued) { hoverQueued = true; requestAnimationFrame(hoverCheck); }
  };
  function hoverCheck() {
    hoverQueued = false;
    if (gaveUp || !pointer || !asmDone || !judged || drag) { return; }
    const r = canvas.getBoundingClientRect();
    stage.style.cursor = !pointer.words && onModel(pointer.x, pointer.y) ? 'grab' : '';
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
    }
    if (best === hovered) { return; }
    if (hovered) { hovered.hovT = 0; }
    hovered = best;
    if (best) { best.hovT = 1; if (best.spin) { best.spin0 = performance.now(); } }
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
    stage.style.cursor = 'grabbing';
    if (hovered) { hovered.hovT = 0; hovered = null; }
  };
  const onDragMove = (e) => {
    if (!drag) { return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { dragMoved = true; }
    userYaw = drag.yaw + dx * DRAG_RAD;
    userPitch = Math.max(-DRAG_PITCH, Math.min(DRAG_PITCH, drag.pitch + dy * DRAG_RAD));
    loop();
  };
  /* a drag that moved: the click its release fires (straight after, however long the button was held) is not a click */
  const onDragEnd = () => { if (drag) { drag = null; if (dragMoved) { dragEnded = performance.now(); } dragMoved = false; stage.style.cursor = ''; loop(); } };
  /* a click on the board (not on a link or a control over it) replays the entrance; a drag's own click does not */
  const onClick = (e) => {
    if (dragEnded && performance.now() - dragEnded < 300) { dragEnded = 0; return; }
    if (gaveUp || !asmDone || replay || boardFade < 0.5 || !judged) { return; }
    if (e.target && e.target.closest && e.target.closest(INTERACTIVE)) { return; }
    const r = canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { return; }
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.intersectObject(boardNode, true).length) { return; }
    replay = true;
    gateT = 0;
    if (hovered) { hovered.hovT = 0; hovered = null; }
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
    apply();
    draw();
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
      const bloom = new UnrealBloomPass(new THREE.Vector2(r.width, r.height), 0.55, 0.45, 0.92);
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
        scenes[keyName] = { group, ownBox, ownPts, box: ownBox.clone().union(boardBox), pts: boardPts.concat(ownPts), items };
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
  return { stop };
}
