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
   studio HDRI (models.json `environment`: the marketing renders' own room, 400 KB) once the board is up; the bloom passes
   (about 30 KB) only on a wide screen whose speed test came in under 25 ms a frame.

   The look: lit by the renders' studio HDRI turned as they turn it (RoomEnvironment until it has loaded), tone-mapped
   ACES at 0.85; bloom (UnrealBloomPass, threshold 0.92) catches only what emits: the OLED and the LED matrix lit in the
   displays scene, the colour sensor's white LEDs. If the frame watch finds the scenes slow, the bloom goes first.

   The models (assets/3d/models.json): `board`, the marketing repository's Blender model of the board (+Y up, the motor
   ports facing +Z, each part group a node "grp_<group>" that `explode` moves: the board assembles itself as it arrives);
   `scenes`, one per chapter, the marketing scenes built around that same board and exported without it (its motors,
   peripherals, cables, the sample robot's chassis), loaded one after another once the board is up, each placed in the
   board's frame; with `board` null a placeholder is built here from boxes and there are no scenes.

   The scroll story: the stage's progress (0 at its top, 1 when its last chapter has scrolled past) picks a pose between
   keyframes, one per chapter; the camera frames that pose's scene (its bounding box with the board's), the scene rises in
   as its chapter arrives and sinks away after, and the board eases towards the pose. Nothing moves on its own (WCAG
   2.2.2): after the entrance the loop renders only while the board is still easing to a scroll position, then idles. The
   entrance's frames are the speed test: a median over 45 ms and the layer removes itself, leaving the photo. Leaving the
   page, a lost WebGL context or reduced motion switched on stop it, and stop() frees the GPU.
   ------------------------------------------------------------------------------------------------ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ACCENT = 0xa8977b;
const ENV_INTENSITY = 0.6;                                          // the environment's reflections (models.json environment.intensity overrides)

/* one pose per stop of the story: the board's rotation (rx, ry), the scene shown (a key of models.json `scenes`, or null:
   the board alone), how tightly the camera frames it (zoom: above 1 smaller), and the exploded view's amount (lift: 0
   assembled, 1 the marketing renders' full exploded view). Wide (over 1100 px): the scene's outline fills the free area
   right of the words and left of the LED indicator at zoom 1 (fitWide). In the stacked layout (1100 px and under, the
   same breakpoint as site.css: phones and tablets) it fills the still's own box on the first screen and the space above
   each chapter's card after (measure) */
const POSES = [
  { rx: 0.42, ry: -0.62, scene: null, zoom: 1.0, lift: 0.0 },              // the first screen: the board
  { rx: 0.5, ry: -0.95, scene: 'motors', zoom: 1.0, lift: 0.0 },           // 01 motors: EV3, NXT and a gearmotor, cabled
  { rx: 0.55, ry: 0.15, scene: 'sensors', zoom: 1.0, lift: 0.0 },          // 02 sensors: four sensors on I2C ports
  { rx: 0.5, ry: 0.25, scene: 'displays', zoom: 1.0, lift: 0.0 },          // 03 code: the displays lit
  { rx: 0.48, ry: -2.25, scene: 'robot', zoom: 1.0, lift: 0.0 }            // 04 the simulator: the sample robot
];
const STACKED = '(max-width: 1100px)';
const PHONE = '(max-width: 760px)';                                  // phones: models.json phone_scenes only
const ENTRANCE = { ry: -0.9, lift: 0.7, zoom: 0.35 };                // added to the first pose and eased away at the start

function lerp(a, b, t) { return a + (b - a) * t; }
function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

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
   every chapter scene takes too (they are in the board's own frame) */
async function loadModel(models) {
  if (!models || !models.board) { return placeholderBoard(); }
  const loader = await gltfLoader();
  const gltf = await loader.loadAsync(new URL(models.board, document.baseURI).href);
  const g = new THREE.Group();
  const scene = gltf.scene;
  softenEnv(scene);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const L = Math.max(size.x, size.z);
  const k = 4.2 / L;
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
  g.userData.frame = { k, offset: new THREE.Vector3(-c.x, -c.y, -c.z) };
  scene.scale.setScalar(k);
  scene.position.copy(g.userData.frame.offset);
  g.add(scene);
  /* the exploded view: each named node moves along the model's up (+Y of its parent, the glTF scene) by its mm */
  const perMm = L / (models.long_mm || 104);
  g.userData.explode = Object.keys(models.explode || {}).map((name) => {
    const n = scene.getObjectByName(name);
    return n ? { n, base: n.position.y, dy: models.explode[name] * perMm } : null;
  }).filter(Boolean);
  return g;
}

/* a transmissive
   material (the clear shield) drawn as plain transparency: three's transmission samples a blurred, lower-resolution copy of
   what is behind it, which washed out the board under the lid and hid its silkscreen, and costs a render pass */
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
  let envTarget = pmrem.fromScene(new RoomEnvironment(renderer), 0.04);
  scene.environment = envTarget.texture;
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
  const boardRoot = new THREE.Group();
  let model;
  try { model = await loadModel(models); } catch (e) {        // no board: free the context now, the photo stays
    pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss();
    throw e;
  }
  boardRoot.add(model);
  boardRoot.updateMatrixWorld(true);
  /* the shadow at the model's foot; the placeholder's cover lifts along the board's own up, in its parent's frame */
  const shadow = shadowPlane();
  shadow.position.y = new THREE.Box3().setFromObject(model).min.y + 0.01;
  boardRoot.add(shadow);
  const cover = model.userData.cover;
  if (cover && cover.parent) {
    const pa = cover.parent;
    cover.userData.base = cover.position.clone();
    cover.userData.up = pa.worldToLocal(new THREE.Vector3(0, 1, 0)).sub(pa.worldToLocal(new THREE.Vector3(0, 0, 0)));
  }
  scene.add(boardRoot);
  const boardBox = localBox(boardRoot, [model]);
  const boardPts = outline(boardRoot, [model]);
  const scenes = {};                               // key -> { group, box, w }

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
  /* a pose's framing: the centre and radius of its scene's box with the board's (the board alone until it has loaded) */
  function framing(pose) {
    const s = pose.scene && scenes[pose.scene];
    const box = s ? s.box : boardBox;
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
        const top = h.height / 2 - c.offsetHeight / 2 + (k.getBoundingClientRect().top - c.getBoundingClientRect().top);
        return { qL: side, qT: g, qR: h.width - side, qB: Math.max(g + 80, top - g) };
      }
      if (!im && c) {
        /* no render (yet), wide: between the card and the LED indicator (or the window's edge), 48 px clear all round */
        const k = c.querySelector('.chapter-card'), led = document.querySelector('.led-nav');
        const lr = led && getComputedStyle(led).display !== 'none' ? led.getBoundingClientRect() : null;
        return { qL: k.getBoundingClientRect().right - h.left + 48, qT: 48, qR: (lr ? lr.left - h.left : h.width) - 48, qB: h.height - 48 };
      }
      if (!im) { return stillBox(); }
      /* where the figure sits when its chapter is centred on the visual: the pose's own place in the story (progress) */
      return imgBox(im, (h.top + h.height / 2) - (c.getBoundingClientRect().top + c.offsetHeight / 2));
    });
  }
  /* the story's position: pose k exactly where chapter k sits centred on the visual (pose 0 at the stage's top), held
     there for HOLD of the way to each neighbour (a chapter being read shows its own scene alone, settled), linear between;
     past the last chapter, the last pose */
  const HOLD = 0.15;
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
    const o = { rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t), zoom: lerp(a.zoom, b.zoom, t),
                lift: lerp(a.lift, b.lift, t), cx: lerp(fa.c.x, fb.c.x, t), cy: lerp(fa.c.y, fb.c.y, t),
                cz: lerp(fa.c.z, fb.c.z, t), rad: lerp(fa.r, fb.r, t), p };
    for (const ax of ['x', 'y', 'z']) {
      o['b0' + ax] = lerp(fa.box.min[ax], fb.box.min[ax], t);
      o['b1' + ax] = lerp(fa.box.max[ax], fb.box.max[ax], t);
    }
    if (!areas) { measure(); }
    const a0 = stillBox();                                      // the first screen's box, as the still is now
    for (const k of ['qL', 'qT', 'qR', 'qB']) { o[k] = lerp(i === 0 ? a0[k] : areas[i][k], areas[i + 1][k], t); }
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
  function posePts(pose) { const s = pose.scene && scenes[pose.scene]; return s ? s.pts : boardPts; }
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
    camera.setViewOffset(W, H, px - (cur.qL + cur.qR) / 2, py - (cur.qT + cur.qB) / 2, W, H);
  }
  function apply() {
    boardRoot.rotation.set(cur.rx, cur.ry, 0);
    boardRoot.updateMatrixWorld(true);
    /* the camera: the scene's outline fitted into the pose's free area (fitWide, wide and stacked alike) */
    fitWide(new THREE.Vector3((cur.b0x + cur.b1x) / 2, (cur.b0y + cur.b1y) / 2, (cur.b0z + cur.b1z) / 2).applyMatrix4(boardRoot.matrixWorld));
    if (cover && cover.userData.up) { cover.position.copy(cover.userData.base).addScaledVector(cover.userData.up, cur.lift * 0.9); }
    for (const e of model.userData.explode || []) { e.n.position.y = e.base + e.dy * cur.lift; }
    /* each scene: present around its own pose (weight 1), rising in from below as it arrives and sinking away after */
    POSES.forEach((pose, idx) => {
      const s = pose.scene && scenes[pose.scene];
      if (!s) { return; }
      const w = Math.max(0, 1 - Math.abs(cur.p - idx));
      s.group.visible = w > 0.02;
      s.group.position.y = s.baseY - (1 - ease(w)) * 1.6;
    });
  }

  host.appendChild(canvas);
  let visible = true, running = false, frames = [], last = 0, gaveUp = false, judged = false, t0 = 0;
  const recent = [];                                     // the latest frame times while the board moves (the scenes' cost)
  const keepSlow = !!(opts && opts.keepSlow);
  /* leaving the page removes the stage: the observer reports it, whether or not the loop is running */
  const io = new IntersectionObserver((es) => {
    if (!stage.isConnected) { stop('left'); return; }
    visible = es[0].isIntersecting;
    if (visible) { loop(); }
  });
  io.observe(stage);
  const onScroll = () => { if (visible) { loop(); } };
  const onVis = () => { if (!document.hidden) { loop(); } };
  const onMotion = () => { if (motionMq.matches) { stop('reduced-motion'); } };
  const onLost = (e) => { e.preventDefault(); stop('lost'); };
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
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
  function stop(reason) {
    if (gaveUp) { return; }
    gaveUp = true;
    window.__evn3dLive -= 1;
    io.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', onScroll);
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
    envTarget.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    if (stage.isConnected) {
      stage.setAttribute('data-3d', 'fallback');
      stage.setAttribute('data-3d-why', reason);
    }
  }
  const KEYS = ['rx', 'ry', 'zoom', 'lift', 'cx', 'cy', 'cz', 'rad', 'p', 'b0x', 'b0y', 'b0z', 'b1x', 'b1y', 'b1z', 'qL', 'qT', 'qR', 'qB'];
  function frame(time) {
    if (gaveUp) { return; }
    if (!visible || document.hidden) { running = false; return; }
    const tg = target();
    let moving = false;
    for (const k of KEYS) {
      const dv = tg[k] - cur[k];
      if (Math.abs(dv) > (k[0] === 'q' ? 0.25 : 1e-4 * (k === 'rad' || k[0] === 'c' || k[0] === 'b' ? Math.max(1, cur.rad) : 1))) { moving = true; }
      cur[k] += dv * 0.08;
    }
    apply();
    draw();
    const at = String(Math.round(cur.p));
    if (stage.getAttribute('data-3d-at') !== at) { stage.setAttribute('data-3d-at', at); }   // the pose in view: site.css fades a phone's canvas past the first screen
    if (!t0) { t0 = time; }
    if (!judged) {                                       // the entrance's frames: the speed test, 30 frames or 3 s
      if (last) { frames.push(time - last); }
      if (frames.length === 30 || (frames.length >= 5 && time - t0 > 3000)) {
        judged = true;
        const s = frames.slice().sort((x, y) => x - y);
        const med = s[Math.floor(s.length / 2)];
        stage.setAttribute('data-3d-frame-ms', String(Math.round(med)));
        if (med > 45 && !keepSlow) { stop('slow'); return; }
        loadEnvironment();
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
    last = time;
    if (moving || !judged) { requestAnimationFrame(frame); } else { running = false; last = 0; markRect(); }
  }
  function loop() { if (!running && !gaveUp) { running = true; last = 0; requestAnimationFrame(frame); } }
  /* where the shown model is on screen once it has settled (CSS px): data/shots.js checks it never covers the words */
  function markRect() {
    /* the shown models' outlines (the board's, and each shown scene's with the board), not their boxes: a box's empty
       corners reach over words the models never touch */
    /* each shown scene where it is now (rising in or sinking away), the board where it is */
    const sets = [[boardPts, boardRoot]].concat(Object.values(scenes).filter((s) => s.group.visible).map((s) => [s.own, s.group]));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const r = host.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const [pts, frame] of sets) for (const q of pts) {
      v.copy(q).applyMatrix4(frame.matrixWorld).project(camera);
      const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height;
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
    stage.setAttribute('data-3d-rect', [x0, y0, x1, y1].map(Math.round).join(','));
  }
  /* the marketing renders' studio HDRI, turned as they turn it (models.json environment.turn_deg), in place of the
     generic room once it has loaded */
  async function loadEnvironment() {
    const env = models && models.environment;
    if (!env || !env.hdr) { return; }
    try {
      const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
      const tex = await new RGBELoader().loadAsync(new URL(env.hdr, document.baseURI).href);
      if (gaveUp) { tex.dispose(); return; }
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = pmrem.fromEquirectangular(tex);
      tex.dispose();
      envTarget.dispose();
      envTarget = pm;
      scene.environment = pm.texture;
      scene.environmentRotation.set(0, THREE.MathUtils.degToRad(env.turn_deg || 0), 0);
      scene.environmentIntensity = env.intensity ?? ENV_INTENSITY;
      stage.setAttribute('data-3d-env', 'hdri');
      loop();
    } catch (e) { /* the room stays */ }
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
     (a visitor who never scrolls downloads none), one at a time */
  let fetching = false, nLoaded = 0;
  function nearScenes() {
    if (fetching || !models || !models.scenes || !model.userData.frame) { return; }
    const phone = window.matchMedia(PHONE).matches;
    const idx = POSES.findIndex((pose, i) => pose.scene && !scenes[pose.scene] && models.scenes[pose.scene] && !pose._failed
                                             && cur.p >= i - 1.25
                                             && (!phone || !models.phone_scenes || models.phone_scenes.includes(pose.scene)));
    if (idx >= 0) { fetching = true; loadScene(POSES[idx]).then(() => { fetching = false; loop(); }); }
  }
  async function loadScene(pose) {
    const loader = await gltfLoader();
    const fr = model.userData.frame;
    {
      const keyName = pose.scene;
      try {
        const gltf = await loader.loadAsync(new URL(models.scenes[keyName], document.baseURI).href);
        if (gaveUp) { return; }
        const group = gltf.scene;
        softenEnv(group);
        group.scale.setScalar(fr.k);
        group.position.copy(fr.offset);
        model.add(group);
        const box = localBox(boardRoot, [model.children[0], group]);   // the board's glTF scene and this one
        scenes[keyName] = { group, box, pts: outline(boardRoot, [model.children[0], group]), own: outline(group, [group]), baseY: group.position.y };
        const chEl = stage.querySelectorAll('article.chapter')[POSES.indexOf(pose) - 1];
        if (chEl) { chEl.classList.add('has-3d'); }                      // site.css: its render gives the live scene its place
        nLoaded++;
        stage.setAttribute('data-3d-scenes', String(nLoaded));
      } catch (e) { pose._failed = true; /* a scene that does not load: its chapter shows the board alone */ }
    }
  }

  /* the first frame drawn before the canvas is shown, so the photo never gives way to an empty canvas */
  resize();
  Object.assign(cur, target());
  cur.ry += ENTRANCE.ry;
  cur.lift += ENTRANCE.lift;
  cur.zoom += ENTRANCE.zoom;
  apply();
  draw();
  stage.setAttribute('data-3d', 'ready');
  stage.setAttribute('data-3d-model', models && models.board ? 'model' : 'placeholder');
  loop();
  return { stop };
}
