// Module Rubyx 3D
// Version: Exportable, intégrable facilement dans un site
// Usage: import { createRubik } from './src/rubyx.js';
// Exemple d'appel:
// createRubik(containerEl, { colors: { U:'#ffffff', D:'#ffff00', R:'#ff0000', L:'#ff8c00', F:'#0000ff', B:'#00aa00' } })

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.154.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.154.0/examples/jsm/controls/OrbitControls.js';

// ---------------------------
// Fonctions publiques exportées
// ---------------------------
export function createRubik(container, opts = {}) {
  if (!container) throw new Error('createRubik: container element required');

  // --- Options et couleurs (hex avec #) ---
  const colors = Object.assign({
    U: '#ffffff', // Up (face +Y) - blanc
    D: '#ffff00', // Down (face -Y) - jaune
    R: '#ff0000', // Right (face +X) - rouge
    L: '#ff8c00', // Left (face -X) - orange
    F: '#0000ff', // Front (face +Z) - bleu
    B: '#00aa00'  // Back (face -Z) - vert
  }, opts.colors || {});

  // --- Setup THREE.js scene ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0b);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth/container.clientHeight, 0.1, 100);
  camera.position.set(4,4,6);

  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.innerHTML = ''; // clear
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // lighting
  const hemi = new THREE.HemisphereLight(0xffffff, 0x111111, 0.95);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.5);
  dir.position.set(5,10,7);
  scene.add(dir);

  // --- Rubik construction ---
  const GAP = 1.05;
  const cubies = [];
  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  // Convert hex color string '#rrggbb' to Number for three.js
  const toHex = s => parseInt(s.replace('#',''), 16);
  const COLORS = {
    white: toHex(colors.U), // '#ffffff'
    yellow: toHex(colors.D), // '#ffff00'
    red: toHex(colors.R), // '#ff0000'
    orange: toHex(colors.L), // '#ff8c00'
    blue: toHex(colors.F), // '#0000ff'
    green: toHex(colors.B), // '#00aa00'
    black: 0x222222
  };

  function stickerMaterial(color) {
    return new THREE.MeshLambertMaterial({ color, side: THREE.FrontSide });
  }
  const darkMat = new THREE.MeshLambertMaterial({ color: COLORS.black });

  const SIZE = 0.95; // cubie size
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
    mesh.userData.pos = { x: ix, y: iy, z: iz };
    cubeGroup.add(mesh);
    cubies.push(mesh);
  }

  for (let x=-1;x<=1;x++) for (let y=-1;y<=1;y++) for (let z=-1;z<=1;z++) createCubie(x,y,z);

  // --- Rotation management ---
  let rotationQueue = [];
  let rotating = null;

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
    selected.forEach(c => group.attach(c));

    rotating = {
      group,
      axis,
      dir,
      angle: 0,
      target: Math.PI/2 * dir,
      speed: Math.PI/2 * 6,
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

  // --- Animation loop ---
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
      if (Math.abs(rotating.angle - rotating.target) < 1e-4) finalizeRotation();
    }

    renderer.render(scene, camera);
  }
  animate();

  function axisVector(axis) {
    if (axis === 'x') return new THREE.Vector3(1,0,0);
    if (axis === 'y') return new THREE.Vector3(0,1,0);
    return new THREE.Vector3(0,0,1);
  }

  // --- High-level moves ---
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

  // --- Clavier : touches U R F D L B (majuscule/minuscule) ---
  function onKeyDown(e) {
    if (e.repeat) return;
    const key = e.key.toUpperCase();
    if (['U','R','F','D','L','B'].includes(key)) {
      const dir = e.shiftKey ? -1 : 1; // shift inverse la direction
      doMove(key, dir);
    }
  }

  // --- Interaction tactile / souris (pointer events) ---
  // Utilise raycast pour détecter la face touchée et un geste (tap / swipe) pour déterminer la rotation.
  const raycaster = new THREE.Raycaster();
  let pointerState = null; // { id, startX, startY, lastX, lastY, intersect }

  function getIntersection(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x, y }, camera);
    const intersects = raycaster.intersectObjects(cubies, false);
    return intersects[0] || null;
  }

  function handleTap(intersect) {
    if (!intersect) return;
    // calcule la normale en espace monde
    const normal = intersect.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld)).normalize();
    const abs = { x: Math.abs(normal.x), y: Math.abs(normal.y), z: Math.abs(normal.z) };
    // déduire la face la plus proche
    if (abs.x > abs.y && abs.x > abs.z) {
      const idx = Math.round(intersect.object.userData.pos.x);
      const dir = normal.x > 0 ? 1 : -1;
      rotateSlice('x', idx, dir);
    } else if (abs.y > abs.x && abs.y > abs.z) {
      const idx = Math.round(intersect.object.userData.pos.y);
      const dir = normal.y > 0 ? -1 : 1; // sens heuristique
      rotateSlice('y', idx, dir);
    } else {
      const idx = Math.round(intersect.object.userData.pos.z);
      const dir = normal.z > 0 ? 1 : -1;
      rotateSlice('z', idx, dir);
    }
  }

  function handleSwipe(intersect, dx, dy) {
    if (!intersect) return;
    const normal = intersect.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld)).normalize();
    const abs = { x: Math.abs(normal.x), y: Math.abs(normal.y), z: Math.abs(normal.z) };
    // heuristiques pour mapper swipe -> axe + direction
    if (abs.x > abs.y && abs.x > abs.z) {
      // touché sur face X (L/R)
      const idx = Math.round(intersect.object.userData.pos.x);
      const dir = dx > 0 ? -Math.sign(normal.x) : Math.sign(normal.x);
      rotateSlice('x', idx, dir);
    } else if (abs.y > abs.x && abs.y > abs.z) {
      // face Y (U/D)
      const idx = Math.round(intersect.object.userData.pos.y);
      const dir = dy > 0 ? Math.sign(normal.y) : -Math.sign(normal.y);
      rotateSlice('y', idx, dir);
    } else {
      // face Z (F/B)
      const idx = Math.round(intersect.object.userData.pos.z);
      const dir = dx > 0 ? Math.sign(normal.z) : -Math.sign(normal.z);
      rotateSlice('z', idx, dir);
    }
  }

  // pointer handlers (noms pour pouvoir attacher/détacher facilement)
  function pointerDownHandler(e) {
    if (e.isPrimary === false) return;
    renderer.domElement.setPointerCapture(e.pointerId);
    const inter = getIntersection(e.clientX, e.clientY);
    pointerState = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, intersect: inter };
    controls.enabled = false; // temporairement désactiver l'orbite pendant l'interaction
  }

  function pointerMoveHandler(e) {
    if (!pointerState || e.pointerId !== pointerState.id) return;
    pointerState.lastX = e.clientX; pointerState.lastY = e.clientY;
  }

  function pointerUpHandler(e) {
    if (!pointerState || e.pointerId !== pointerState.id) return;
    const dx = (pointerState.lastX || e.clientX) - pointerState.startX;
    const dy = (pointerState.lastY || e.clientY) - pointerState.startY;
    const dist = Math.hypot(dx, dy);
    const inter = pointerState.intersect;

    if (dist < 10) {
      // tap
      handleTap(inter);
    } else {
      handleSwipe(inter, dx, dy);
    }

    try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) {}
    pointerState = null;
    controls.enabled = true;
  }

  // --- Activation / UI toggles ---
  let keyboardEnabled = opts.keyboard !== false; // true by default
  let touchEnabled = opts.touch !== false; // true by default

  function addKeyboardListeners() { window.addEventListener('keydown', onKeyDown); }
  function removeKeyboardListeners() { window.removeEventListener('keydown', onKeyDown); }

  function addPointerListeners() {
    renderer.domElement.addEventListener('pointerdown', pointerDownHandler);
    renderer.domElement.addEventListener('pointermove', pointerMoveHandler);
    renderer.domElement.addEventListener('pointerup', pointerUpHandler);
  }
  function removePointerListeners() {
    renderer.domElement.removeEventListener('pointerdown', pointerDownHandler);
    renderer.domElement.removeEventListener('pointermove', pointerMoveHandler);
    renderer.domElement.removeEventListener('pointerup', pointerUpHandler);
  }

  function setKeyboardEnabled(v) {
    keyboardEnabled = !!v;
    if (keyboardEnabled) addKeyboardListeners(); else removeKeyboardListeners();
    updateToggleButtons();
  }
  function setTouchEnabled(v) {
    touchEnabled = !!v;
    if (touchEnabled) addPointerListeners(); else removePointerListeners();
    updateToggleButtons();
  }

  // apply initial state
  if (keyboardEnabled) addKeyboardListeners();
  if (touchEnabled) addPointerListeners();

  // small UI in top-right corner
  const uiWrap = document.createElement('div');
  uiWrap.style.cssText = 'position:absolute;top:8px;right:8px;display:flex;flex-direction:column;gap:6px;padding:6px;background:rgba(0,0,0,0.35);border-radius:6px;color:#fff;font-size:12px;';
  uiWrap.className = 'rubix-controls-overlay';

  const kbBtn = document.createElement('button');
  const touchBtn = document.createElement('button');
  [kbBtn, touchBtn].forEach(b => { b.style.cssText = 'background:#222;color:#fff;border:1px solid #444;padding:6px;border-radius:4px;cursor:pointer;'; });

  kbBtn.textContent = keyboardEnabled ? 'Clavier: ON' : 'Clavier: OFF';
  touchBtn.textContent = touchEnabled ? 'Tactile: ON' : 'Tactile: OFF';

  kbBtn.addEventListener('click', () => setKeyboardEnabled(!keyboardEnabled));
  touchBtn.addEventListener('click', () => setTouchEnabled(!touchEnabled));

  uiWrap.appendChild(kbBtn);
  uiWrap.appendChild(touchBtn);
  // position relative to container
  container.style.position = container.style.position || 'relative';
  container.appendChild(uiWrap);

  function updateToggleButtons() {
    kbBtn.textContent = keyboardEnabled ? 'Clavier: ON' : 'Clavier: OFF';
    touchBtn.textContent = touchEnabled ? 'Tactile: ON' : 'Tactile: OFF';
  }

  // expose a destroy helper to clean up listeners and UI
  function destroy() {
    removeKeyboardListeners();
    removePointerListeners();
    try { uiWrap.remove(); } catch (e) {}
  }

  // note: si besoin on peut exposer une API pour activer/désactiver ces contrôles

  // Public API returned to the caller
  return {
    doMove,
    setKeyboardEnabled,
    setTouchEnabled,
    scramble(times=20) {
      const moves = ['U','R','F','D','L','B'];
      for (let i=0;i<times;i++) {
        const m = moves[Math.floor(Math.random()*moves.length)];
        const d = Math.random() > 0.5 ? 1 : -1;
        rotationQueue.push({ axis: moveAxis(m), index: moveIndex(m), dir: d });
      }
      if (!rotating) startNextRotation();
    },
    reset() {
      rotationQueue = [];
      rotating = null;
      cubies.slice().forEach(c => c.removeFromParent());
      cubies.length = 0;
      for (let x=-1;x<=1;x++) for (let y=-1;y<=1;y++) for (let z=-1;z<=1;z++) createCubie(x,y,z);
    },
    destroy
  };

  function moveAxis(m) { return { U:'y', D:'y', R:'x', L:'x', F:'z', B:'z' }[m]; }
  function moveIndex(m) { return { U:1, D:-1, R:1, L:-1, F:1, B:-1 }[m]; }
}
