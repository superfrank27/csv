import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7bc67b);
scene.fog = new THREE.Fog(0x7bc67b, 25, 160);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 450);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xb7ffb7, 0x2b392b, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(22, 70, 24);
scene.add(sun);

const ground = new THREE.Mesh(new THREE.BoxGeometry(320, 2, 320), new THREE.MeshLambertMaterial({ color: 0x3f8c3f }));
ground.position.y = -1;
scene.add(ground);

const ui = {
  health: document.getElementById('health'),
  armor: document.getElementById('armor'),
  coins: document.getElementById('coins'),
  weaponName: document.getElementById('weaponName'),
  ammo: document.getElementById('ammo'),
  hitInfo: document.getElementById('hitInfo'),
  hintPanel: document.getElementById('hintPanel'),
  menu: document.getElementById('menu'),
  shop: document.getElementById('shopPanel'),
  shopList: document.getElementById('shopList'),
  shopDesc: document.getElementById('shopDesc'),
  gameOver: document.getElementById('gameOver'),
  finalCoins: document.getElementById('finalCoins'),
  lockToggle: document.getElementById('lockToggle')
};

const state = {
  started: false,
  dead: false,
  health: 10,
  maxHealth: 10,
  armor: 0,
  coins: 0,
  currentWeapon: 'sword',
  ammo: { pistol: 0, rifle: 0 },
  lockMouse: false,
  mouseDragLook: false,
  lastAttackAt: 0,
  shopOpen: false,
  shopIndex: 0,
  shopDetailMode: false
};

const WEAPONS = {
  sword: { name: '刀剑', ranged: false, damage: 1, bodyHitsToKill: 3, cooldown: 360, range: 3.2 },
  pistol: { name: '手枪', ranged: true, damage: 1, bodyHitsToKill: 3, cooldown: 260, price: 60 },
  rifle: { name: '步枪', ranged: true, damage: 2, bodyHitsToKill: 2, cooldown: 140, price: 120 }
};

const SHOP_ITEMS = [
  { key: 'pistol', label: '手枪 +100发', price: WEAPONS.pistol.price, desc: '远程武器，爆头秒杀，身体3枪；弹药100发。' },
  { key: 'rifle', label: '步枪 +100发', price: WEAPONS.rifle.price, desc: '更高射速和伤害，爆头秒杀，身体约2枪；弹药100发。' },
  { key: 'medSmall', label: '小药 +5血', price: 20, desc: '恢复5点生命，不超过上限。' },
  { key: 'medLarge', label: '大药 +10血', price: 50, desc: '恢复10点生命，不超过上限。' },
  { key: 'armor', label: '盔甲 +1防御', price: 500, desc: '僵尸每次攻击基础2点，防御可减伤。' }
];

const player = { position: new THREE.Vector3(0, 1.8, 25), yaw: 0, pitch: 0 };

const worldForward = new THREE.Vector3();
const worldRight = new THREE.Vector3();
const keys = { w: false, a: false, s: false, d: false, shift: false };

const raycaster = new THREE.Raycaster();

const market = new THREE.Group();
const marketBase = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 20), new THREE.MeshLambertMaterial({ color: 0x7f5935 }));
marketBase.position.y = 4.5;
const roof = new THREE.Mesh(new THREE.BoxGeometry(23, 1.5, 23), new THREE.MeshLambertMaterial({ color: 0xbf4040 }));
roof.position.y = 9.8;
market.add(marketBase, roof);
scene.add(market);

const npc = new THREE.Group();
const npcBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.9), new THREE.MeshLambertMaterial({ color: 0x4d75b5 }));
npcBody.position.y = 1.1;
const npcHead = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), new THREE.MeshLambertMaterial({ color: 0xdab48a }));
npcHead.position.y = 2.8;
npc.position.set(0, 0, 0);
npc.add(npcBody, npcHead);
scene.add(npc);

for (let i = 0; i < 100; i += 1) {
  const x = (Math.random() - 0.5) * 290;
  const z = (Math.random() - 0.5) * 290;
  if (Math.abs(x) < 18 && Math.abs(z) < 18) continue;
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.7, 7, 1.7), new THREE.MeshLambertMaterial({ color: 0x6f4b2b }));
  trunk.position.set(x, 3.5, z);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 5.2), new THREE.MeshLambertMaterial({ color: 0x2e7c2e }));
  crown.position.set(x, 8.4, z);
  scene.add(trunk, crown);
}

const zombies = [];
const zombieParts = new Map();
function spawnZombie() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 32 + Math.random() * 95;
  const zGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 0.95), new THREE.MeshLambertMaterial({ color: 0x3b9b4b }));
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), new THREE.MeshLambertMaterial({ color: 0x5fbe6a }));
  head.position.y = 2.9;
  zGroup.add(body, head);
  zGroup.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  scene.add(zGroup);

  const zombie = { group: zGroup, body, head, health: 3, speed: 1.5 + Math.random() * 0.9, attackCd: 0 };
  zombieParts.set(body.uuid, { zombie, part: 'body' });
  zombieParts.set(head.uuid, { zombie, part: 'head' });
  zombies.push(zombie);
}
for (let i = 0; i < 24; i += 1) spawnZombie();

// First-person body + held weapon
const bodyRoot = new THREE.Group();
const chest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.35), new THREE.MeshLambertMaterial({ color: 0x2f5077 }));
chest.position.set(0, -0.95, -0.6);
const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), new THREE.MeshLambertMaterial({ color: 0x1f334f }));
legL.position.set(-0.15, -1.7, -0.55);
const legR = legL.clone();
legR.position.x = 0.15;
bodyRoot.add(chest, legL, legR);
camera.add(bodyRoot);
scene.add(camera);

const weaponAnchor = new THREE.Group();
weaponAnchor.position.set(0.34, -0.33, -0.72);
camera.add(weaponAnchor);
let weaponMesh = null;
function renderWeaponModel() {
  if (weaponMesh) weaponAnchor.remove(weaponMesh);
  const w = state.currentWeapon;
  if (w === 'sword') {
    weaponMesh = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), new THREE.MeshLambertMaterial({ color: 0x5d3a1f }));
    handle.position.y = -0.1;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 0.08), new THREE.MeshLambertMaterial({ color: 0xd0d0d0 }));
    blade.position.y = 0.42;
    weaponMesh.add(handle, blade);
    weaponMesh.rotation.z = -0.5;
  } else if (w === 'pistol') {
    weaponMesh = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.1), new THREE.MeshLambertMaterial({ color: 0x242424 }));
    grip.position.set(0, -0.05, 0);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.12), new THREE.MeshLambertMaterial({ color: 0x4a4a4a }));
    slide.position.set(0.11, 0.08, 0);
    weaponMesh.add(grip, slide);
    weaponMesh.rotation.z = -0.12;
  } else {
    weaponMesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.12), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
    stock.position.set(-0.28, -0.02, 0);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0x575757 }));
    barrel.position.set(0.35, 0.01, 0);
    weaponMesh.add(body, stock, barrel);
    weaponMesh.rotation.z = -0.08;
  }
  weaponAnchor.add(weaponMesh);
}

function updateHud() {
  ui.health.textContent = String(state.health);
  ui.armor.textContent = String(state.armor);
  ui.coins.textContent = String(state.coins);
  ui.weaponName.textContent = WEAPONS[state.currentWeapon].name;
  ui.ammo.textContent = WEAPONS[state.currentWeapon].ranged ? String(state.ammo[state.currentWeapon]) : '∞';
}

function showInfo(text) {
  ui.hitInfo.textContent = text;
  setTimeout(() => {
    if (ui.hitInfo.textContent === text) ui.hitInfo.textContent = '-';
  }, 550);
}

function syncCamera() {
  camera.position.copy(player.position);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function isNearVendor() {
  return player.position.distanceTo(npc.position) < 6.5;
}

function killZombie(zombie) {
  scene.remove(zombie.group);
  zombieParts.delete(zombie.body.uuid);
  zombieParts.delete(zombie.head.uuid);
  const idx = zombies.indexOf(zombie);
  if (idx >= 0) zombies.splice(idx, 1);
  state.coins += 1;
  updateHud();
  spawnZombie();
}

function attack() {
  if (!state.started || state.dead || state.shopOpen) return;
  const weapon = WEAPONS[state.currentWeapon];
  const now = performance.now();
  if (now - state.lastAttackAt < weapon.cooldown) return;
  state.lastAttackAt = now;

  const targets = zombies.flatMap((z) => [z.head, z.body]);
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(targets, false);

  if (!weapon.ranged) {
    if (!hits.length || hits[0].distance > weapon.range) {
      showInfo('挥空了');
      return;
    }
  } else {
    if (state.ammo[state.currentWeapon] <= 0) {
      state.currentWeapon = 'sword';
      renderWeaponModel();
      updateHud();
      showInfo('弹药打空，自动切回刀剑');
      return;
    }
    state.ammo[state.currentWeapon] -= 1;
    updateHud();
    if (!hits.length) {
      showInfo('未命中');
      return;
    }
  }

  const hitObj = hits[0].object;
  const data = zombieParts.get(hitObj.uuid);
  if (!data) return;

  const { zombie, part } = data;
  if (part === 'head') {
    showInfo('爆头！');
    killZombie(zombie);
    return;
  }

  zombie.health -= weapon.damage;
  showInfo(`命中身体 -${weapon.damage}`);
  if (zombie.health <= 0) killZombie(zombie);
}

function performPurchase(item) {
  if (state.coins < item.price) {
    showInfo('金币不足');
    return;
  }
  state.coins -= item.price;

  if (item.key === 'pistol' || item.key === 'rifle') {
    state.ammo[item.key] = 100;
    state.currentWeapon = item.key;
    renderWeaponModel();
    showInfo(`购买${item.label}成功，已自动装备`);
  } else if (item.key === 'medSmall') {
    state.health = Math.min(state.maxHealth, state.health + 5);
    showInfo('小药使用成功');
  } else if (item.key === 'medLarge') {
    state.health = Math.min(state.maxHealth, state.health + 10);
    showInfo('大药使用成功');
  } else if (item.key === 'armor') {
    state.armor += 1;
    showInfo('盔甲升级 +1 防御');
  }
  updateHud();
}

function renderShop() {
  ui.shopList.innerHTML = '';
  SHOP_ITEMS.forEach((item, idx) => {
    const li = document.createElement('li');
    li.textContent = `${item.label} - ${item.price} 金币`;
    if (idx === state.shopIndex) li.classList.add('active');
    ui.shopList.appendChild(li);
  });
  ui.shopDesc.textContent = SHOP_ITEMS[state.shopIndex].desc;
}

function openShop() {
  state.shopOpen = true;
  state.shopIndex = 0;
  ui.shop.classList.remove('hidden');
  renderShop();
}

function closeShop() {
  state.shopOpen = false;
  state.shopDetailMode = false;
  ui.shop.classList.add('hidden');
}

function endGame() {
  state.dead = true;
  ui.finalCoins.textContent = String(state.coins);
  ui.gameOver.classList.remove('hidden');
  document.exitPointerLock?.();
}

function startGame() {
  state.started = true;
  state.lockMouse = ui.lockToggle.checked;
  ui.menu.classList.add('hidden');
  if (state.lockMouse) renderer.domElement.requestPointerLock?.();
  showInfo(state.lockMouse ? '已开始（锁鼠标模式）' : '已开始（自由鼠标模式）');
}

function setKey(e, pressed) {
  const key = e.key.toLowerCase();
  if (key === 'w') keys.w = pressed;
  if (key === 'a') keys.a = pressed;
  if (key === 's') keys.s = pressed;
  if (key === 'd') keys.d = pressed;
  if (key === 'shift') keys.shift = pressed;
}

window.addEventListener('keydown', (e) => {
  if (!state.started) return;
  setKey(e, true);

  if (state.shopOpen) {
    if (e.key === 'ArrowUp') {
      state.shopIndex = (state.shopIndex - 1 + SHOP_ITEMS.length) % SHOP_ITEMS.length;
      renderShop();
    }
    if (e.key === 'ArrowDown') {
      state.shopIndex = (state.shopIndex + 1) % SHOP_ITEMS.length;
      renderShop();
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      state.shopDetailMode = !state.shopDetailMode;
      ui.shopDesc.textContent = state.shopDetailMode
        ? `详情：${SHOP_ITEMS[state.shopIndex].desc}`
        : SHOP_ITEMS[state.shopIndex].desc;
    }
    if (e.key === 'Enter') performPurchase(SHOP_ITEMS[state.shopIndex]);
    if (e.key.toLowerCase() === 'b') closeShop();
    return;
  }

  if (e.key.toLowerCase() === 'b') {
    if (isNearVendor()) {
      openShop();
    } else {
      showInfo('先靠近商店 NPC 才能按 B 购买');
    }
  }
});

window.addEventListener('keyup', (e) => setKey(e, false));
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.addEventListener('click', () => {
  if (!state.started) return;
  if (state.lockMouse) renderer.domElement.requestPointerLock?.();
});
renderer.domElement.addEventListener('mousedown', (e) => {
  if (!state.started) return;
  if (e.button === 0) attack();
  if (!state.lockMouse) state.mouseDragLook = true;
});
window.addEventListener('mouseup', () => { state.mouseDragLook = false; });

window.addEventListener('mousemove', (e) => {
  if (!state.started || state.dead || state.shopOpen) return;
  const canLook = state.lockMouse
    ? document.pointerLockElement === renderer.domElement
    : state.mouseDragLook;
  if (!canLook) return;

  player.yaw -= e.movementX * 0.0024;
  player.pitch -= e.movementY * 0.0024;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.48, 1.48);
  syncCamera();
});

document.addEventListener('pointerlockerror', () => showInfo('锁鼠标失败，建议关闭锁鼠标开关后游玩'));

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', () => location.reload());

renderWeaponModel();
updateHud();
syncCamera();

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);

  if (state.started && !state.dead && !state.shopOpen) {
    camera.getWorldDirection(worldForward);
    worldForward.y = 0;
    worldForward.normalize();
    worldRight.crossVectors(worldForward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (keys.w) move.add(worldForward);
    if (keys.s) move.sub(worldForward);
    if (keys.a) move.sub(worldRight);
    if (keys.d) move.add(worldRight);
    if (move.lengthSq() > 0) move.normalize();

    const speed = 8 * (keys.shift ? 1.55 : 1);
    player.position.addScaledVector(move, speed * dt);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -150, 150);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -150, 150);
    player.position.y = 1.8;
    syncCamera();

    const nearVendor = isNearVendor();
    ui.hintPanel.textContent = nearVendor
      ? '你靠近商店 NPC 了：按 B 打开购买界面'
      : '去商店找 NPC，按 B 购买';

    const flatPlayer = player.position.clone();
    flatPlayer.y = 0;
    zombies.forEach((z) => {
      const toward = flatPlayer.clone().sub(z.group.position);
      toward.y = 0;
      const dist = toward.length();
      if (dist > 1.5) {
        z.group.position.addScaledVector(toward.normalize(), z.speed * dt);
      } else {
        z.attackCd -= dt;
        if (z.attackCd <= 0) {
          const incoming = Math.max(0, 2 - state.armor);
          state.health = Math.max(0, state.health - incoming);
          z.attackCd = 0.75;
          updateHud();
          showInfo(`被僵尸攻击 -${incoming}`);
          if (state.health <= 0) endGame();
        }
      }
      z.group.lookAt(flatPlayer.x, z.group.position.y, flatPlayer.z);
    });
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
