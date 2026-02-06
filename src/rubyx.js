// Module Rubyx 3D
// Version: Exportable, intégrable facilement dans un site
// Usage: import { createRubik } from './src/rubyx.js';
// Exemple d'appel:
// createRubik(containerEl, { colors: { U:'#ffffff', D:'#ffff00', R:'#ff0000', L:'#ff8c00', F:'#0000ff', B:'#00aa00' } })

import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
    L: '#FFA500', // Left (face -X) - orange
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
  // Add a subtle ambient light so undersides don't go fully black
  const ambient = new THREE.AmbientLight(0xffffff, 0.22);
  scene.add(ambient);

  // --- Rubik construction ---
  const GAP = 1.05;
  const cubies = [];
  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  // Convert hex color string '#rrggbb' to Number for three.js
  const toHex = s => {
    const hex = s.replace('#', '');
    return parseInt(hex, 16);
  };
  
  const COLORS = {
    white: toHex(colors.U),   // '#ffffff'
    yellow: toHex(colors.D),  // '#ffff00'
    red: toHex(colors.L),     // '#ff0000'
    orange: toHex(colors.R),  // '#ff8c00'
    blue: toHex(colors.F),    // '#0000ff'
    green: toHex(colors.B),   // '#00aa00'
    black: 0x444444
  };

  function stickerMaterial(color) {
    return new THREE.MeshLambertMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1
    });
  }
  
  const darkMat = new THREE.MeshLambertMaterial({ 
    color: COLORS.black,
    transparent: false,
    opacity: 1
  });

  const SIZE = 0.95; // cubie size
  const boxGeo = new THREE.BoxGeometry(SIZE, SIZE, SIZE);

  function createCubie(ix,iy,iz) {
    const materials = [];
    // BoxGeometry materials order: +X, -X, +Y, -Y, +Z, -Z
    
    // Face droite (+X) - ROUGE (index 0)
    materials.push(ix === 1 ? stickerMaterial(COLORS.red) : darkMat);
    
    // Face gauche (-X) - ORANGE (index 1)
    materials.push(ix === -1 ? stickerMaterial(COLORS.orange) : darkMat);
    
    // Face haut (+Y) - BLANC (index 2)
    materials.push(iy === 1 ? stickerMaterial(COLORS.white) : darkMat);
    
    // Face bas (-Y) - JAUNE (index 3)
    materials.push(iy === -1 ? stickerMaterial(COLORS.yellow) : darkMat);
    
    // Face avant (+Z) - BLEU (index 4)
    materials.push(iz === 1 ? stickerMaterial(COLORS.blue) : darkMat);
    
    // Face arrière (-Z) - VERT (index 5)
    materials.push(iz === -1 ? stickerMaterial(COLORS.green) : darkMat);

    const mesh = new THREE.Mesh(boxGeo, materials);
    mesh.position.set(ix * GAP, iy * GAP, iz * GAP);
    mesh.userData.pos = { x: ix, y: iy, z: iz };
    mesh.userData.originalIndex = cubies.length;
    cubeGroup.add(mesh);
    cubies.push(mesh);
    return mesh;
  }

  for (let x=-1;x<=1;x++) for (let y=-1;y<=1;y++) for (let z=-1;z<=1;z++) {
    createCubie(x,y,z);
  }

  // --- Rotation management ---
  let rotationQueue = [];
  let rotating = null;
  const ROTATION_SPEED = Math.PI * 2; // radians per second

  function rotateSlice(axis, index, dir=1) {
    // Vérifier que la tranche n'est pas déjà en rotation
    if (rotating && rotating.axis === axis && rotating.index === index) {
      return;
    }
    rotationQueue.push({ axis, index, dir });
    if (!rotating) startNextRotation();
  }

  function startNextRotation() {
    if (rotationQueue.length === 0) { 
      rotating = null; 
      return; 
    }
    
    const move = rotationQueue.shift();
    const { axis, index, dir } = move;
    const group = new THREE.Group();
    scene.add(group);

    // Positionner le groupe au centre de la tranche
    const center = new THREE.Vector3();
    if (axis === 'x') center.set(index * GAP, 0, 0);
    else if (axis === 'y') center.set(0, index * GAP, 0);
    else center.set(0, 0, index * GAP);
    
    group.position.copy(center);

    // Sélectionner les cubes à tourner
    const selected = cubies.filter(c => Math.round(c.userData.pos[axis]) === index);
    
    // Déplacer les cubes dans le groupe de rotation
    selected.forEach(c => {
      // Sauvegarder la position mondiale actuelle
      const worldPos = new THREE.Vector3();
      c.getWorldPosition(worldPos);
      
      // Détacher du groupe principal
      cubeGroup.remove(c);
      
      // Attacher au groupe de rotation
      group.add(c);
      
      // Ajuster la position relative au centre du groupe
      c.position.copy(worldPos).sub(center);
    });

    rotating = {
      group,
      axis,
      index,
      dir,
      angle: 0,
      target: Math.PI/2 * dir, // Quart de tour
      speed: ROTATION_SPEED,
      cubies: selected
    };
  }

  function finalizeRotation() {
    const { group, cubies } = rotating;
    
    // Mettre à jour chaque cube
    cubies.forEach(c => {
      // Obtenir la position mondiale finale
      const worldPos = new THREE.Vector3();
      c.getWorldPosition(worldPos);
      
      // Convertir en coordonnées discrètes (-1, 0, 1)
      const nx = Math.round(worldPos.x / GAP);
      const ny = Math.round(worldPos.y / GAP);
      const nz = Math.round(worldPos.z / GAP);
      
      // Obtenir l'orientation finale
      const worldQuat = new THREE.Quaternion();
      c.getWorldQuaternion(worldQuat);
      
      // Détacher du groupe de rotation
      group.remove(c);
      
      // Réattacher au groupe principal
      cubeGroup.add(c);
      
      // Mettre à jour la position et orientation
      c.position.set(nx * GAP, ny * GAP, nz * GAP);
      c.userData.pos = { x: nx, y: ny, z: nz };
      
      // Convertir la quaternion en Euler et aligner sur 90°
      const euler = new THREE.Euler().setFromQuaternion(worldQuat, 'XYZ');
      const snap = angle => Math.round(angle / (Math.PI/2)) * (Math.PI/2);
      c.rotation.set(snap(euler.x), snap(euler.y), snap(euler.z));
    });
    
    // Nettoyer
    scene.remove(group);
    rotating = null;
    
    // Démarrer la rotation suivante
    startNextRotation();
  }

  // --- Animation loop ---
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    controls.update();

    if (rotating) {
      const step = rotating.speed * dt;
      const remain = rotating.target - rotating.angle;
      let delta = Math.sign(remain) * Math.min(Math.abs(step), Math.abs(remain));
      
      // Tourner autour de l'axe approprié
      const axisVec = axisVector(rotating.axis);
      rotating.group.rotateOnWorldAxis(axisVec, delta);
      
      rotating.angle += delta;
      
      // Vérifier si la rotation est terminée
      if (Math.abs(rotating.angle) >= Math.abs(rotating.target)) {
        // Ajustement final pour précision
        const correction = rotating.target - rotating.angle;
        rotating.group.rotateOnWorldAxis(axisVec, correction);
        rotating.angle = rotating.target;
        finalizeRotation();
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  // --- Handle window resize ---
  function onWindowResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  }
  window.addEventListener('resize', onWindowResize);

  function axisVector(axis) {
    if (axis === 'x') return new THREE.Vector3(1,0,0);
    if (axis === 'y') return new THREE.Vector3(0,1,0);
    return new THREE.Vector3(0,0,1);
  }

  // --- High-level moves ---
  function doMove(move, dir=1) {
    // Support pour les mouvements inversés (avec apostrophe)
    const moveName = move.replace("'", "");
    const actualDir = move.includes("'") ? -1 : dir;
    
    switch (moveName) {
      case 'U': rotateSlice('y', 1, actualDir); break;
      case 'D': rotateSlice('y', -1, actualDir); break;
      case 'R': rotateSlice('x', 1, actualDir); break;
      case 'L': rotateSlice('x', -1, actualDir); break;
      case 'F': rotateSlice('z', 1, actualDir); break;
      case 'B': rotateSlice('z', -1, actualDir); break;
      case 'M': rotateSlice('x', 0, actualDir); break;  // Tranche du milieu
      case 'E': rotateSlice('y', 0, actualDir); break;  // Tranche équatoriale
      case 'S': rotateSlice('z', 0, actualDir); break;  // Tranche du milieu front/back
    }
  }

  // --- Clavier : touches U R F D L B (majuscule/minuscule) ---
  function onKeyDown(e) {
    if (e.repeat) return;
    const key = e.key.toUpperCase();
    const moves = ['U','R','F','D','L','B','M','E','S'];
    
    if (moves.includes(key)) {
      const dir = e.shiftKey ? 1 : -1;
      doMove(key, dir);
    }
  }

  // --- Interaction tactile / souris ---
  const raycaster = new THREE.Raycaster();
  let pointerState = null;

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
    
    const normal = intersect.face.normal.clone()
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld))
      .normalize();
    
    const abs = { x: Math.abs(normal.x), y: Math.abs(normal.y), z: Math.abs(normal.z) };
    
    if (abs.x > abs.y && abs.x > abs.z) {
      const idx = Math.round(intersect.object.userData.pos.x);
      rotateSlice('x', idx, 1);
    } else if (abs.y > abs.x && abs.y > abs.z) {
      const idx = Math.round(intersect.object.userData.pos.y);
      rotateSlice('y', idx, 1);
    } else {
      const idx = Math.round(intersect.object.userData.pos.z);
      rotateSlice('z', idx, 1);
    }
  }

  // pointer handlers
  function pointerDownHandler(e) {
    if (e.isPrimary === false) return;
    renderer.domElement.setPointerCapture(e.pointerId);
    const inter = getIntersection(e.clientX, e.clientY);
    pointerState = { 
      id: e.pointerId, 
      startX: e.clientX, 
      startY: e.clientY, 
      lastX: e.clientX, 
      lastY: e.clientY, 
      intersect: inter 
    };
    controls.enabled = false;
  }

  function pointerMoveHandler(e) {
    if (!pointerState || e.pointerId !== pointerState.id) return;
    pointerState.lastX = e.clientX; 
    pointerState.lastY = e.clientY;
  }

  function pointerUpHandler(e) {
    if (!pointerState || e.pointerId !== pointerState.id) return;
    const dx = (pointerState.lastX || e.clientX) - pointerState.startX;
    const dy = (pointerState.lastY || e.clientY) - pointerState.startY;
    const dist = Math.hypot(dx, dy);
    const inter = pointerState.intersect;

    if (dist < 15) {
      handleTap(inter);
    }

    try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) {}
    pointerState = null;
    controls.enabled = true;
  }

  // --- Activation / UI toggles ---
  let keyboardEnabled = opts.keyboard !== false;
  let touchEnabled = opts.touch !== false;

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

  // UI
  const uiWrap = document.createElement('div');
  uiWrap.style.cssText = 'position:absolute;top:8px;right:8px;display:flex;flex-direction:column;gap:6px;padding:6px;background:rgba(0,0,0,0.35);border-radius:6px;color:#fff;font-size:12px;';
  uiWrap.className = 'rubix-controls-overlay';

  const kbBtn = document.createElement('button');
  const touchBtn = document.createElement('button');
  [kbBtn, touchBtn].forEach(b => { 
    b.style.cssText = 'background:#222;color:#fff;border:1px solid #444;padding:6px;border-radius:4px;cursor:pointer;'; 
  });

  kbBtn.textContent = keyboardEnabled ? 'Clavier: ON' : 'Clavier: OFF';
  touchBtn.textContent = touchEnabled ? 'Tactile: ON' : 'Tactile: OFF';

  kbBtn.addEventListener('click', () => setKeyboardEnabled(!keyboardEnabled));
  touchBtn.addEventListener('click', () => setTouchEnabled(!touchEnabled));

  uiWrap.appendChild(kbBtn);
  uiWrap.appendChild(touchBtn);
  container.style.position = container.style.position || 'relative';
  container.appendChild(uiWrap);

  function updateToggleButtons() {
    kbBtn.textContent = keyboardEnabled ? 'Clavier: ON' : 'Clavier: OFF';
    touchBtn.textContent = touchEnabled ? 'Tactile: ON' : 'Tactile: OFF';
  }

  function destroy() {
    removeKeyboardListeners();
    removePointerListeners();
    try { uiWrap.remove(); } catch (e) {}
  }

  // Public API
  return {
    doMove,
    setKeyboardEnabled,
    setTouchEnabled,
    scramble(times=20) {
      const moves = ['U','U\'','R','R\'','F','F\'','D','D\'','L','L\'','B','B\'','M','M\''];
      for (let i=0;i<times;i++) {
        const m = moves[Math.floor(Math.random()*moves.length)];
        doMove(m, 1);
      }
    },
    reset() {
      rotationQueue = [];
      rotating = null;
      cubies.forEach(c => c.removeFromParent());
      cubies.length = 0;
      for (let x=-1;x<=1;x++) for (let y=-1;y<=1;y++) for (let z=-1;z<=1;z++) createCubie(x,y,z);
    },
    destroy
  };
}