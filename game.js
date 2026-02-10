import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7bc67b);
scene.fog = new THREE.Fog(0x7bc67b, 20, 150);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xb7ffb7, 0x2b392b, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(20, 60, 20);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(280, 2, 280),
  new THREE.MeshLambertMaterial({ color: 0x3f8c3f })
);
ground.position.y = -1;
scene.add(ground);

const ui = {
  health: document.getElementById('health'),
  armor: document.getElementById('armor'),
  coins: document.getElementById('coins'),
  weaponName: document.getElementById('weaponName'),
  weaponDamage: document.getElementById('weaponDamage'),
  hitInfo: document.getElementById('hitInfo'),
  shop: document.getElementById('shopPanel'),
  menu: document.getElementById('menu'),
  gameOver: document.getElementById('gameOver'),
  finalCoins: document.getElementById('finalCoins')
};

const state = {
  health: 10,
  maxHealth: 10,
  armor: 0,
  coins: 0,
  weapon: '步枪',
  damageBonus: 1,
  speed: 8,
  sprint: 1.55,
  lastShotAt: 0,
  fireCooldownMs: 180,
  dead: false,
  started: false
};

const player = {
  position: new THREE.Vector3(0, 1.8, 22),
  yaw: 0,
  pitch: 0,
  pointerLocked: false
};
camera.position.copy(player.position);

const shopArea = new THREE.Box3(new THREE.Vector3(-8, -1, -8), new THREE.Vector3(8, 8, 8));

const market = new THREE.Group();
const marketBase = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 16), new THREE.MeshLambertMaterial({ color: 0x8f6f3f }));
marketBase.position.y = 4;
const roof = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 18), new THREE.MeshLambertMaterial({ color: 0xc04040 }));
roof.position.y = 8.8;
market.add(marketBase, roof);
scene.add(market);

function makeTree(x, z) {
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 7, 1.8), new THREE.MeshLambertMaterial({ color: 0x6f4b2b }));
  trunk.position.set(x, 3.5, z);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.2, 5.5), new THREE.MeshLambertMaterial({ color: 0x2e7c2e }));
  crown.position.set(x, 8.5, z);
  scene.add(trunk, crown);
}

for (let i = 0; i < 95; i += 1) {
  const x = (Math.random() - 0.5) * 250;
  const z = (Math.random() - 0.5) * 250;
  if (Math.abs(x) < 14 && Math.abs(z) < 14) continue;
  makeTree(x, z);
}

const zombies = [];
const zombieParts = new Map();
function spawnZombie() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 24 + Math.random() * 90;
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.9), new THREE.MeshLambertMaterial({ color: 0x3a9845 }));
  body.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), new THREE.MeshLambertMaterial({ color: 0x5dbb65 }));
  head.position.y = 2.95;

  group.add(body, head);
  group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  scene.add(group);

  const zombie = { group, body, head, health: 3, speed: 1.6 + Math.random() * 0.8, attackCd: 0 };
  zombieParts.set(body.uuid, { zombie, part: 'body' });
  zombieParts.set(head.uuid, { zombie, part: 'head' });
  zombies.push(zombie);
}
for (let i = 0; i < 22; i += 1) spawnZombie();

const keys = { w: false, a: false, s: false, d: false, shift: false };
const raycaster = new THREE.Raycaster();
let mouseLookActive = false;

function updateHud() {
  ui.health.textContent = String(state.health);
  ui.armor.textContent = String(state.armor);
  ui.coins.textContent = String(state.coins);
  ui.weaponName.textContent = state.weapon;
  ui.weaponDamage.textContent = String(state.damageBonus);
}

function showHit(text) {
  ui.hitInfo.textContent = text;
  setTimeout(() => {
    if (ui.hitInfo.textContent === text) ui.hitInfo.textContent = '-';
  }, 400);
}

function syncCamera() {
  camera.position.copy(player.position);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function killZombie(zombie) {
  scene.remove(zombie.group);
  zombieParts.delete(zombie.body.uuid);
  zombieParts.delete(zombie.head.uuid);
  zombies.splice(zombies.indexOf(zombie), 1);
  state.coins += 1;
  updateHud();
  spawnZombie();
}

function shoot() {
  if (!state.started || state.dead) return;
  const now = performance.now();
  if (now - state.lastShotAt < state.fireCooldownMs) return;
  state.lastShotAt = now;

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(zombies.flatMap((z) => [z.head, z.body]), false);
  if (!hits.length) {
    showHit('未命中');
    return;
  }

  const hit = hits[0].object;
  const data = zombieParts.get(hit.uuid);
  if (!data) return;
  const { zombie, part } = data;
  if (part === 'head') {
    showHit('爆头！一枪击杀');
    killZombie(zombie);
    return;
  }

  zombie.health -= state.damageBonus;
  showHit(`躯干命中 -${state.damageBonus} 血`);
  if (zombie.health <= 0) killZombie(zombie);
}

function buy(index) {
  if (!shopArea.containsPoint(player.position)) return showHit('你不在超市范围内');

  const doBuy = (cost, action, label) => {
    if (state.coins < cost) return showHit(`${label} 金币不足`);
    state.coins -= cost;
    action();
    updateHud();
    showHit(`购买成功：${label}`);
  };

  switch (index) {
    case '1': doBuy(50, () => { state.weapon = '升级步枪'; state.damageBonus += 1; }, '升级步枪'); break;
    case '2': doBuy(100, () => { state.weapon = '散弹枪'; state.damageBonus += 2; state.fireCooldownMs = 280; }, '散弹枪'); break;
    case '3': doBuy(150, () => { state.weapon = '加特林'; state.damageBonus += 3; state.fireCooldownMs = 90; }, '加特林'); break;
    case '4': doBuy(20, () => { state.health = Math.min(state.maxHealth, state.health + 5); }, '小药'); break;
    case '5': doBuy(50, () => { state.health = Math.min(state.maxHealth, state.health + 10); }, '大药'); break;
    case '6': doBuy(500, () => { state.armor += 1; }, '盔甲'); break;
    default: break;
  }
}

function endGame() {
  state.dead = true;
  document.exitPointerLock?.();
  ui.finalCoins.textContent = String(state.coins);
  ui.gameOver.classList.remove('hidden');
}

function startGame() {
  state.started = true;
  ui.menu.classList.add('hidden');
  renderer.domElement.focus();
  renderer.domElement.requestPointerLock?.();
  showHit('已开始：WASD移动，鼠标看向，左键射击');
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w') keys.w = true;
  if (key === 'a') keys.a = true;
  if (key === 's') keys.s = true;
  if (key === 'd') keys.d = true;
  if (key === 'shift') keys.shift = true;
  if (key === 'e' && shopArea.containsPoint(player.position)) ui.shop.classList.toggle('hidden');
  if (['1', '2', '3', '4', '5', '6'].includes(key)) buy(key);
});
window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w') keys.w = false;
  if (key === 'a') keys.a = false;
  if (key === 's') keys.s = false;
  if (key === 'd') keys.d = false;
  if (key === 'shift') keys.shift = false;
});

renderer.domElement.addEventListener('click', () => {
  if (state.started) renderer.domElement.requestPointerLock?.();
});
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) shoot();
  mouseLookActive = true;
});
window.addEventListener('mouseup', () => { mouseLookActive = false; });
window.addEventListener('mousemove', (e) => {
  if (!state.started || state.dead) return;
  const useMovement = document.pointerLockElement === renderer.domElement || mouseLookActive;
  if (!useMovement) return;
  player.yaw -= e.movementX * 0.0023;
  player.pitch -= e.movementY * 0.0023;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.45, 1.45);
  syncCamera();
});

document.addEventListener('pointerlockchange', () => {
  player.pointerLocked = document.pointerLockElement === renderer.domElement;
});
document.addEventListener('pointerlockerror', () => {
  showHit('鼠标锁定失败，按住左键拖动也可转向');
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', () => location.reload());

updateHud();
syncCamera();

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!state.dead && state.started) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (keys.w) move.add(forward);
    if (keys.s) move.sub(forward);
    if (keys.a) move.sub(right);
    if (keys.d) move.add(right);
    if (move.lengthSq() > 0) move.normalize();

    const speed = state.speed * (keys.shift ? state.sprint : 1);
    player.position.addScaledVector(move, speed * dt);
    player.position.y = 1.8;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -130, 130);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -130, 130);
    syncCamera();

    if (shopArea.containsPoint(player.position)) ui.shop.classList.remove('hidden');
    else ui.shop.classList.add('hidden');

    const playerFlat = player.position.clone();
    playerFlat.y = 0;
    for (const z of zombies) {
      const chase = playerFlat.clone().sub(z.group.position);
      chase.y = 0;
      const dist = chase.length();
      if (dist > 1.5) {
        z.group.position.addScaledVector(chase.normalize(), z.speed * dt);
      } else {
        z.attackCd -= dt;
        if (z.attackCd <= 0) {
          const incoming = Math.max(0, 2 - state.armor);
          state.health = Math.max(0, state.health - incoming);
          z.attackCd = 0.75;
          updateHud();
          showHit(`被攻击 -${incoming} 血`);
          if (state.health <= 0) endGame();
        }
      }
      z.group.lookAt(playerFlat.x, z.group.position.y, playerFlat.z);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
