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
    c.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3();
    c.getWorldPosition(pos);

    const nx = Math.round(pos.x / GAP);
    const ny = Math.round(pos.y / GAP);
    const nz = Math.round(pos.z / GAP);
    c.position.set(nx*GAP, ny*GAP, nz*GAP);
    c.userData.pos = { x: nx, y: ny, z: nz };

    const m = new THREE.Matrix4();
    m.copy(c.matrixWorld);
    const e = new THREE.Euler().setFromRotationMatrix(m);
    const snap = v => Math.round(v / (Math.PI/2)) * (Math.PI/2);
    c.rotation.set(snap(e.x), snap(e.y), snap(e.z));

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

// wire up buttons (keeps HTML clean of inline handlers)
document.getElementById('btnU').addEventListener('click', () => doMove('U',1));
document.getElementById('btnR').addEventListener('click', () => doMove('R',1));
document.getElementById('btnF').addEventListener('click', () => doMove('F',1));
document.getElementById('btnD').addEventListener('click', () => doMove('D',-1));
document.getElementById('btnL').addEventListener('click', () => doMove('L',-1));
document.getElementById('btnB').addEventListener('click', () => doMove('B',-1));
document.getElementById('btnScramble').addEventListener('click', () => scramble());
document.getElementById('btnReset').addEventListener('click', () => resetCube());