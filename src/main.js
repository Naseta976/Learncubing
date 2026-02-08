import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';


// ---- Scene setup ----
const container = document.getElementById('container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(4,4,6);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// lighting
const hemi = new THREE.HemisphereLight(0xffffff, 0x111111, 0.95);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.5);
dir.position.set(5,10,7);
scene.add(dir);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Rubik construction ----
const GAP = 1.05;
const cubies = [];
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

// Colors mapping (standard-ish):
const COLORS = {
  white: 0xffffff, // U (+Y)
  yellow: 0xffff00, // D (-Y)
  red: 0xff0000, // R (+X)
  orange: 0xff8c00, // L (-X)
  blue: 0x0000ff, // F (+Z)
  green: 0x00aa00, // B (-Z)
  black: 0x222222 // interior/dark
};

function stickerMaterial(color) {
  return new THREE.MeshLambertMaterial({ color, side: THREE.FrontSide });
}
const darkMat = new THREE.MeshLambertMaterial({ color: COLORS.black });

// Box geometry slightly smaller so stickers appear
const SIZE = 0.95;
const boxGeo = new THREE.BoxGeometry(SIZE, SIZE, SIZE);

function createCubie(ix,iy,iz) {
  const materials = [];
  // BoxGeometry materials order: +X, -X, +Y, -Y, +Z, -Z
  materials.push(ix === 1 ? stickerMaterial(COLORS.red)    : darkMat);    // +X
  materials.push(ix === -1 ? stickerMaterial(COLORS.orange) : darkMat);   // -X
  materials.push(iy === 1 ? stickerMaterial(COLORS.white)  : darkMat);    // +Y
  materials.push(iy === -1 ? stickerMaterial(COLORS.yellow): darkMat);    // -Y
  materials.push(iz === 1 ? stickerMaterial(COLORS.blue)   : darkMat);    // +Z
  materials.push(iz === -1 ? stickerMaterial(COLORS.green) : darkMat);    // -Z

  const mesh = new THREE.Mesh(boxGeo, materials);
  mesh.position.set(ix * GAP, iy * GAP, iz * GAP);
  mesh.userData.pos = { x: ix, y: iy, z: iz }; // logical coordinates
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  cubeGroup.add(mesh);
  cubies.push(mesh);
}

for (let x=-1;x<=1;x++) for (let y=-1;y<=1;y++) for (let z=-1;z<=1;z++) {
  createCubie(x,y,z);
}

// ---- Rotation management ----
let rotationQueue = [];
let rotating = null; // { group, axis, target, speed, cubies }

function rotateSlice(axis, index, dir=1) {
  rotationQueue.push({ axis, index, dir });
  if (!rotating) startNextRotation();
}

function startNextRotation() {
  if (rotationQueue.length === 0) { rotating = null; return; }
  const move = rotationQueue.shift();
  const { axis, index, dir } = move;
  const group = new THREE.Group();
  scene.add(group);

  const selected = cubies.filter(c => Math.round(c.userData.pos[axis]) === index);
  selected.forEach(c => {
    group.attach(c); // reparent preserving world transform
  });

  rotating = {
    group,
    axis,
    dir,
    angle: 0,
    target: Math.PI/2 * dir,
    speed: Math.PI/2 * 6, // rad/sec (adjust)
    cubies: selected
  };
}

function finalizeRotation() {
  const { group, cubies } = rotating;
  cubies.forEach(c => {
    // Ensure world matrix is up-to-date
    c.updateWorldMatrix(true, false);

    // --- Snap world position to the nearest slot ---
    const worldPos = new THREE.Vector3();
    c.getWorldPosition(worldPos);
    const nx = Math.round(worldPos.x / GAP);
    const ny = Math.round(worldPos.y / GAP);
    const nz = Math.round(worldPos.z / GAP);
    const snappedWorldPos = new THREE.Vector3(nx * GAP, ny * GAP, nz * GAP);

    // --- Snap world rotation to 90 degree increments ---
    const worldQuat = new THREE.Quaternion();
    c.getWorldQuaternion(worldQuat);
    const worldEuler = new THREE.Euler().setFromQuaternion(worldQuat);
    const snap = v => Math.round(v / (Math.PI/2)) * (Math.PI/2);
    worldEuler.set(snap(worldEuler.x), snap(worldEuler.y), snap(worldEuler.z));
    const snappedWorldQuat = new THREE.Quaternion().setFromEuler(worldEuler);

    // Move the cubie to the scene temporarily to set explicit world-based values,
    // then convert them into local coordinates relative to cubeGroup.
    scene.attach(c);

    // Position in local space of cubeGroup
    const localPos = cubeGroup.worldToLocal(snappedWorldPos.clone());
    c.position.copy(localPos);

    // Convert snapped world quaternion into local quaternion for cubeGroup
    const cubeWorldQuat = new THREE.Quaternion();
    cubeGroup.getWorldQuaternion(cubeWorldQuat);
    const invCubeQuat = cubeWorldQuat.clone().invert();
    const localQuat = invCubeQuat.multiply(snappedWorldQuat);
    c.quaternion.copy(localQuat);

    c.userData.pos = { x: nx, y: ny, z: nz };

    cubeGroup.attach(c);
  });
  scene.remove(group);
  rotating = null;
  startNextRotation();
}

// ---- Animation loop ----
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  controls.update();

  if (rotating) {
    const step = rotating.speed * dt;
    const remain = rotating.target - rotating.angle;
    let delta = Math.sign(remain) * Math.min(Math.abs(step), Math.abs(remain));
    rotating.group.rotateOnAxis(axisVector(rotating.axis), delta);
    rotating.angle += delta;
    if (Math.abs(rotating.angle - rotating.target) < 1e-4) {
      finalizeRotation();
    }
  }

  renderer.render(scene, camera);
}
animate();

function axisVector(axis) {
  if (axis === 'x') return new THREE.Vector3(1,0,0);
  if (axis === 'y') return new THREE.Vector3(0,1,0);
  return new THREE.Vector3(0,0,1);
}

// ---- High-level moves mapping (U R F D L B) ----
function doMove(move, dir=1) {
  switch (move) {
    case 'U': rotateSlice('y', 1, -dir); break;
    case 'D': rotateSlice('y', -1, dir); break;
    case 'R': rotateSlice('x', 1, dir); break;
    case 'L': rotateSlice('x', -1, -dir); break;
    case 'F': rotateSlice('z', 1, dir); break;
    case 'B': rotateSlice('z', -1, -dir); break;
  }
}

window.doMove = doMove;

function scramble(times=20) {
  const moves = ['U','R','F','D','L','B'];
  for (let i=0;i<times;i++) {
    const m = moves[Math.floor(Math.random()*moves.length)];
    const d = Math.random() > 0.5 ? 1 : -1;
    rotationQueue.push({ axis: moveAxis(m), index: moveIndex(m), dir: d });
  }
  if (!rotating) startNextRotation();
}
window.scramble = scramble;

function moveAxis(m) { return { U:'y', D:'y', R:'x', L:'x', F:'z', B:'z' }[m]; }
function moveIndex(m) { return { U:1, D:-1, R:1, L:-1, F:1, B:-1 }[m]; }

function resetCube() {
  rotationQueue = [];
  rotating = null;
  cubies.slice().forEach(c => c.removeFromParent());
  cubies.length = 0;
  for (let x=-1;x<=1;x++) for (let y=-1;y<=1;y++) for (let z=-1;z<=1;z++) createCubie(x,y,z);
}
window.resetCube = resetCube;

// double-click to recenter camera
renderer.domElement.addEventListener('dblclick', () => {
  controls.reset();
  camera.position.set(4,4,6);
});

// --- Keyboard handling (U R F D L B) + middle slices (M E S) ---
let _lastKey = { key: null, time: 0 };
const PRIME_WINDOW = 600; // ms to accept a following apostrophe as prime (more tolerant)
const MOVE_KEYS = ['U','R','F','D','L','B'];
const MID_KEYS = ['M','E','S'];
const HOLD_INTERVAL = 300; // ms between repeated moves when holding a key
const activeHolds = new Map(); // letter -> intervalId

function doMiddleMove(m, dir=1) {
  switch (m) {
    // conventions: M = middle layer (between L/R), E = equatorial (between U/D), S = standing (between F/B)
    case 'M': rotateSlice('x', 0, -dir); break; // sign chosen to match common notation (adjustable)
    case 'E': rotateSlice('y', 0, dir); break;
    case 'S': rotateSlice('z', 0, dir); break;
  }
}

function isApostropheKey(e) {
  // Accept common variants: U+0027 (') U+2019 (’) and legacy keyCode 222 (some layouts)
  const k = e.key;
  return k === "'" || k === '’' || e.keyCode === 222;
}

// --- Keyboard debug overlay (temporary, helps diagnose layout issues) ---
let _keyDebugEl = null;
function createKeyDebug() {
  if (_keyDebugEl) return;
  _keyDebugEl = document.createElement('div');
  _keyDebugEl.style.cssText = 'position:fixed;left:8px;bottom:8px;padding:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:12px;border-radius:6px;z-index:9999;pointer-events:none;';
  _keyDebugEl.textContent = '';
  document.body.appendChild(_keyDebugEl);
}
function showKeyInfo(e) {
  createKeyDebug();
  const txt = `key:${String(e.key)} code:${e.code || 'n/a'} keyCode:${e.keyCode}`;
  _keyDebugEl.textContent = txt;
  _keyDebugEl.style.opacity = '1';
  if (_keyDebugEl._timeout) clearTimeout(_keyDebugEl._timeout);
  _keyDebugEl._timeout = setTimeout(() => { _keyDebugEl.style.opacity = '0'; }, 1500);
}

function startHold(letter, dir=1) {
  const k = String(letter).toUpperCase();
  if (activeHolds.has(k)) return;
  const action = MOVE_KEYS.includes(k) ? () => doMove(k, dir) : () => doMiddleMove(k, dir);
  action(); // immediate
  const id = setInterval(action, HOLD_INTERVAL);
  activeHolds.set(k, id);
  _lastKey = { key: k, time: Date.now() };
}

function stopHold(letter) {
  const k = String(letter || '').toUpperCase();
  if (activeHolds.has(k)) {
    clearInterval(activeHolds.get(k));
    activeHolds.delete(k);
  }
}

function clearAllHolds() {
  for (const id of activeHolds.values()) clearInterval(id);
  activeHolds.clear();
}

function onKeyDown(e) {
  if (e.repeat) return;
  showKeyInfo(e); // debug: show what the browser reports for this key

  const k = e.key;
  // apostrophe after a letter -> performs the inverse of the previous move
  if (isApostropheKey(e)) {
    if (_lastKey.key && (Date.now() - _lastKey.time) < PRIME_WINDOW) {
      const letter = _lastKey.key.toUpperCase();
      if (MOVE_KEYS.includes(letter)) { doMove(letter, -1); e.preventDefault(); _lastKey.key = null; return; }
      if (MID_KEYS.includes(letter)) { doMiddleMove(letter, -1); e.preventDefault(); _lastKey.key = null; return; }
    }
    return;
  }

  const upper = k.toUpperCase();
  if (MOVE_KEYS.includes(upper)) {
    const dir = e.shiftKey ? -1 : 1; // Shift = prime
    startHold(upper, dir);
    e.preventDefault();
  } else if (MID_KEYS.includes(upper)) {
    const dir = e.shiftKey ? -1 : 1;
    startHold(upper, dir);
    e.preventDefault();
  }
}
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', (e) => stopHold(e.key));
window.addEventListener('blur', () => clearAllHolds());
window.addEventListener('visibilitychange', () => { if (document.hidden) clearAllHolds(); });

// wire up buttons (keeps HTML clean of inline handlers)
document.getElementById('btnU').addEventListener('click', () => doMove('U',1));
document.getElementById('btnR').addEventListener('click', () => doMove('R',1));
document.getElementById('btnF').addEventListener('click', () => doMove('F',1));
document.getElementById('btnD').addEventListener('click', () => doMove('D',-1));
document.getElementById('btnL').addEventListener('click', () => doMove('L',-1));
document.getElementById('btnB').addEventListener('click', () => doMove('B',-1));
document.getElementById('btnScramble').addEventListener('click', () => scramble());
document.getElementById('btnReset').addEventListener('click', () => resetCube());