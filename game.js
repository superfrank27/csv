import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x86c8ff);
scene.fog = new THREE.Fog(0x9dd6ff, 150, 850);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1400);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe7f7ff, 0x4f824f, 1.12));
const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(220, 340, 120);
scene.add(sun);

function makePixelTexture(c1, c2) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = c2;
  for (let y = 0; y < 16; y += 4) {
    for (let x = 0; x < 16; x += 4) {
      if (((x + y) / 4) % 2 === 0) ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

const mats = {
  grass: new THREE.MeshLambertMaterial({ map: makePixelTexture('#4da14d', '#5cb85c') }),
  wood: new THREE.MeshLambertMaterial({ map: makePixelTexture('#7a532d', '#8b6636') }),
  leaf: new THREE.MeshLambertMaterial({ map: makePixelTexture('#2f7c2f', '#3b8f3b') }),
  stone: new THREE.MeshLambertMaterial({ map: makePixelTexture('#7a7a7a', '#909090') }),
  roof: new THREE.MeshLambertMaterial({ map: makePixelTexture('#aa4c4c', '#8f3f3f') }),
  wall: new THREE.MeshLambertMaterial({ map: makePixelTexture('#b49a74', '#c7b086') }),
  soil: new THREE.MeshLambertMaterial({ map: makePixelTexture('#7a5b30', '#87653a') }),
  corn: new THREE.MeshLambertMaterial({ map: makePixelTexture('#d8c247', '#e8d45f') }),
  sky: new THREE.MeshBasicMaterial({ color: 0x9ed8ff, side: THREE.BackSide })
};

scene.add(new THREE.Mesh(new THREE.BoxGeometry(1600, 900, 1600), mats.sky));

const ui = {
  menu: document.getElementById('menu'), gameOver: document.getElementById('gameOver'),
  finalCoins: document.getElementById('finalCoins'), health: document.getElementById('health'),
  coins: document.getElementById('coins'), armor: document.getElementById('armor'),
  weapon: document.getElementById('weapon'), ammo: document.getElementById('ammo'),
  corn: document.getElementById('corn'), villagers: document.getElementById('villagers'),
  animals: document.getElementById('animals'), hint: document.getElementById('hint'),
  shopPanel: document.getElementById('shopPanel'), shopList: document.getElementById('shopList')
};

const state = {
  started: false, dead: false, health: 10, coins: 0, armor: 0, corn: 30,
  weapon: 'sword', ammo: { pistol: 0, rifle: 0 }, shopOpen: false, shopIndex: 0,
  lastAttackAt: 0, cropTimer: 0, minuteTick: 0, reproductionTimer: 0
};

const player = { pos: new THREE.Vector3(0, 3, 50), velY: 0, yaw: 0, grounded: true, radius: 0.85 };
const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };

const staticColliders = [];
const DUMMY_UP = new THREE.Vector3(0, 1, 0);

function addStaticCollider(x, z, w, d) {
  const collider = { x, z, w, d, active: true };
  staticColliders.push(collider);
  return collider;
}

function resolveAgainstStatic(entityPos, radius) {
  for (const c of staticColliders) {
    if (!c.active) continue;
    const nx = THREE.MathUtils.clamp(entityPos.x, c.x - c.w / 2, c.x + c.w / 2);
    const nz = THREE.MathUtils.clamp(entityPos.z, c.z - c.d / 2, c.z + c.d / 2);
    const dx = entityPos.x - nx;
    const dz = entityPos.z - nz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const push = (radius - dist) + 0.01;
      entityPos.x += (dx / dist) * push;
      entityPos.z += (dz / dist) * push;
    }
  }
}

function separateEntities(list, radiusGetter) {
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const pa = a.mesh.position;
      const pb = b.mesh.position;
      const dx = pa.x - pb.x;
      const dz = pa.z - pb.z;
      const ra = radiusGetter(a);
      const rb = radiusGetter(b);
      const minDist = ra + rb;
      const d2 = dx * dx + dz * dz;
      if (d2 < minDist * minDist) {
        const d = Math.sqrt(d2) || 0.0001;
        const push = (minDist - d) * 0.5;
        pa.x += (dx / d) * push;
        pa.z += (dz / d) * push;
        pb.x -= (dx / d) * push;
        pb.z -= (dz / d) * push;
      }
    }
  }
}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), mats.grass);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const mountains = new THREE.Group();
for (let i = 0; i < 34; i += 1) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(35 + Math.random() * 40, 60 + Math.random() * 90, 4), mats.stone);
  const a = (i / 34) * Math.PI * 2;
  const r = 460 + Math.random() * 180;
  mesh.position.set(Math.cos(a) * r, 30, Math.sin(a) * r);
  mesh.rotation.y = Math.random() * Math.PI;
  mountains.add(mesh);
}
scene.add(mountains);

function createTree(x, z) {
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(2, 16, 2), mats.wood);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 9), mats.leaf);
  trunk.position.set(x, 8, z);
  leaf.position.set(x, 17, z);
  scene.add(trunk, leaf);
  addStaticCollider(x, z, 5, 5);
}
for (let i = 0; i < 220; i += 1) {
  const x = (Math.random() - 0.5) * 1080;
  const z = (Math.random() - 0.5) * 1080;
  if (Math.abs(x) < 150 && Math.abs(z) < 150) continue;
  createTree(x, z);
}

const village = new THREE.Group();
scene.add(village);

function createHouse(x, z, width = 10, depth = 8) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, 6.5, depth), mats.wood);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, 2.2, depth + 1.2), mats.roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3, 0.7), mats.stone);
  base.position.set(x, 3.25, z);
  roof.position.set(x, 7.5, z);
  door.position.set(x, 1.5, z + depth / 2 + 0.35);
  village.add(base, roof, door);
  addStaticCollider(x, z, width, depth);
}
createHouse(-48, -20);
createHouse(48, -20);
createHouse(0, 45);

const shopBuilding = new THREE.Mesh(new THREE.BoxGeometry(11, 6.8, 8), new THREE.MeshLambertMaterial({ map: makePixelTexture('#4d7cae', '#6293c9') }));
shopBuilding.position.set(0, 3.4, -52);
village.add(shopBuilding);
addStaticCollider(0, -52, 11, 8);
const shopSign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 0.8), new THREE.MeshLambertMaterial({ map: makePixelTexture('#f2c451', '#deb349') }));
shopSign.position.set(0, 7.8, -47.1);
village.add(shopSign);

const vendor = new THREE.Group();
vendor.position.set(0, 0, -36);
const vendorBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3, 1.2), new THREE.MeshLambertMaterial({ map: makePixelTexture('#355b9a', '#476fb2') }));
const vendorHead = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshLambertMaterial({ map: makePixelTexture('#e0be95', '#cda178') }));
vendorBody.position.y = 1.5; vendorHead.position.y = 3.6;
vendor.add(vendorBody, vendorHead);
village.add(vendor);

const farmSlots = [];
for (let i = 0; i < 9; i += 1) {
  const row = Math.floor(i / 3), col = i % 3;
  const soil = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 5), mats.soil);
  const x = -18 + col * 6;
  const z = -2 + row * 6;
  soil.position.set(x, 0.25, z);
  const corn = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.8), mats.corn);
  corn.position.set(x, 1.5, z);
  corn.visible = false;
  village.add(soil, corn);
  farmSlots.push({ grown: false, corn });
}

const walls = [];
function addWall(x, z, w, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 3.6, d), mats.wall);
  mesh.position.set(x, 1.8, z);
  village.add(mesh);
  const wall = { mesh, hp: 3, broken: false, repairProgress: 0, x, z, w, d };
  wall.collider = addStaticCollider(x, z, w, d);
  wall.collider.isWall = true;
  walls.push(wall);
}
for (let x = -82; x <= 82; x += 16) { addWall(x, -82, 15, 2.2); addWall(x, 82, 15, 2.2); }
for (let z = -66; z <= 66; z += 16) { addWall(-82, z, 2.2, 15); addWall(82, z, 2.2, 15); }

const villagers = [];
const animals = [];
const zombies = [];
const zombieParts = new Map();
const bullets = [];
const raycaster = new THREE.Raycaster();

function createHumanMaterial(cloth, skin) {
  return {
    body: new THREE.MeshLambertMaterial({ map: makePixelTexture(cloth[0], cloth[1]) }),
    skin: new THREE.MeshLambertMaterial({ map: makePixelTexture(skin[0], skin[1]) })
  };
}

function spawnVillager(pos, isChild = false, sex = Math.random() > 0.5 ? 'M' : 'F') {
  const mat = createHumanMaterial(['#8e6f58', '#9f8165'], ['#d6b58f', '#c49b77']);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, isChild ? 2.2 : 3.0, 1.2), mat.body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat.skin);
  body.position.y = isChild ? 1.15 : 1.6;
  head.position.y = isChild ? 2.95 : 4.0;
  g.add(body, head);
  g.position.copy(pos);
  village.add(g);
  villagers.push({ mesh: g, hp: 4, isChild, sex, adultAgeProgress: 0, ageEatenCorn: 0, target: pos.clone(), radius: 0.65 });
}
for (let i = 0; i < 6; i += 1) spawnVillager(new THREE.Vector3(-12 + i * 4.5, 0, 22));

function spawnAnimal(type, pos) {
  const col = type === 'pig' ? ['#f3a9b7', '#e28e9e'] : ['#f2f2f2', '#d9d9d9'];
  const m = new THREE.MeshLambertMaterial({ map: makePixelTexture(col[0], col[1]) });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.2), m);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 0.95), m);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.55), m);
  body.position.y = 0.8; head.position.set(1.4, 0.95, 0); snout.position.set(1.92, 0.85, 0);
  const legM = new THREE.MeshLambertMaterial({ map: makePixelTexture(type === 'pig' ? '#d98ea0' : '#cfcfcf', type === 'pig' ? '#c97a8d' : '#bdbdbd') });
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.28), legM); leg1.position.set(-0.7, 0.27, -0.35);
  const leg2 = leg1.clone(); leg2.position.set(-0.7, 0.27, 0.35);
  const leg3 = leg1.clone(); leg3.position.set(0.7, 0.27, -0.35);
  const leg4 = leg1.clone(); leg4.position.set(0.7, 0.27, 0.35);
  g.add(body, head, snout, leg1, leg2, leg3, leg4);
  g.position.copy(pos);
  village.add(g);
  animals.push({ type, mesh: g, hp: 2, age: 0, breedTimer: 0, radius: 0.95 });
}
spawnAnimal('pig', new THREE.Vector3(22, 0, 12));
spawnAnimal('pig', new THREE.Vector3(25, 0, 14));
spawnAnimal('sheep', new THREE.Vector3(18, 0, 18));

// player visible third-person
const playerMesh = new THREE.Group();
const pBodyMat = new THREE.MeshLambertMaterial({ map: makePixelTexture('#4062aa', '#5175be') });
const pSkinMat = new THREE.MeshLambertMaterial({ map: makePixelTexture('#dcb991', '#cb9f73') });
const pBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.2, 1.5), pBodyMat);
const pHead = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), pSkinMat);
pBody.position.y = 1.8; pHead.position.y = 4.3;
playerMesh.add(pBody, pHead);
const armorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 1.8), new THREE.MeshLambertMaterial({ map: makePixelTexture('#9fb2c4', '#7d92a7') }));
armorMesh.position.y = 2.05;
armorMesh.visible = false;
playerMesh.add(armorMesh);
const weaponMesh = new THREE.Group();
weaponMesh.position.set(1.35, 2.0, 0);
playerMesh.add(weaponMesh);
scene.add(playerMesh);

function drawWeapon() {
  weaponMesh.clear();
  if (state.weapon === 'sword') {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), mats.wood);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.5, 0.2), mats.stone);
    handle.position.y = -0.2; blade.position.y = 1.45;
    weaponMesh.add(handle, blade);
  } else if (state.weapon === 'pistol') {
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.22), mats.stone);
    weaponMesh.add(gun);
  } else {
    const gun = new THREE.Mesh(new THREE.BoxGeometry(1, 0.24, 0.24), mats.stone);
    weaponMesh.add(gun);
  }
}
drawWeapon();


function resolvePlayerCollision() {
  for (const c of staticColliders) {
    if (!c.active) continue;
    if (c.isWall && player.pos.y > 4.85) continue;
    const nx = THREE.MathUtils.clamp(player.pos.x, c.x - c.w / 2, c.x + c.w / 2);
    const nz = THREE.MathUtils.clamp(player.pos.z, c.z - c.d / 2, c.z + c.d / 2);
    const dx = player.pos.x - nx;
    const dz = player.pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < player.radius * player.radius) {
      const d = Math.sqrt(d2) || 0.0001;
      const push = (player.radius - d) + 0.01;
      player.pos.x += (dx / d) * push;
      player.pos.z += (dz / d) * push;
    }
  }
}

const tombs = [new THREE.Vector3(0, 0, -350), new THREE.Vector3(350, 0, 0), new THREE.Vector3(-350, 0, 0), new THREE.Vector3(0, 0, 350)];
for (const t of tombs) {
  const tomb = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 14), mats.stone);
  tomb.position.set(t.x, 5, t.z);
  scene.add(tomb);
  addStaticCollider(t.x, t.z, 20, 14);
}

function spawnZombie(pos) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.0, 1.3), new THREE.MeshLambertMaterial({ map: makePixelTexture('#2f9b45', '#38ac52') }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshLambertMaterial({ map: makePixelTexture('#5bc86b', '#69d97a') }));
  body.position.y = 1.55; head.position.y = 3.8;
  g.add(body, head);
  g.position.copy(pos);
  scene.add(g);
  const z = { mesh: g, body, head, hp: 3, speed: 3.8 + Math.random() * 1.2, attackCd: 0, wallCd: 0, radius: 0.85 };
  zombies.push(z);
  zombieParts.set(body.uuid, { z, part: 'body' });
  zombieParts.set(head.uuid, { z, part: 'head' });
}

let zombieSpawnTicker = 0;

function playTone(freq, dur = 0.08, type = 'square', vol = 0.05) {
  const ctx = playTone.ctx || (playTone.ctx = new (window.AudioContext || window.webkitAudioContext)());
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type; osc.frequency.value = freq; gain.gain.value = vol;
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + dur);
}

function setHint(t) {
  ui.hint.textContent = t;
  setTimeout(() => { if (ui.hint.textContent === t) ui.hint.textContent = '-'; }, 850);
}

function updateHud() {
  ui.health.textContent = String(Math.max(0, Math.floor(state.health)));
  ui.coins.textContent = String(state.coins);
  ui.armor.textContent = String(state.armor);
  ui.weapon.textContent = state.weapon === 'sword' ? '刀剑' : state.weapon === 'pistol' ? '手枪' : '步枪';
  ui.ammo.textContent = state.weapon === 'sword' ? '∞' : String(state.ammo[state.weapon]);
  ui.corn.textContent = String(Math.floor(state.corn));
  ui.villagers.textContent = String(villagers.length);
  ui.animals.textContent = String(animals.length);
  armorMesh.visible = state.armor > 0;
}

function killZombie(z) {
  zombieParts.delete(z.body.uuid);
  zombieParts.delete(z.head.uuid);
  scene.remove(z.mesh);
  zombies.splice(zombies.indexOf(z), 1);
  state.coins += 1;
}

function shootBullet() {
  const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(DUMMY_UP, player.yaw);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffdf66 }));
  mesh.position.copy(playerMesh.position).add(new THREE.Vector3(0, 1.8, 0)).addScaledVector(dir, 1.6);
  scene.add(mesh);
  bullets.push({ mesh, vel: dir.multiplyScalar(state.weapon === 'rifle' ? 130 : 95), life: 2.1 });
  playTone(280, 0.05, 'sawtooth', 0.07);
}

function meleeSwing() {
  weaponMesh.rotation.z = -0.9;
  setTimeout(() => { weaponMesh.rotation.z = 0; }, 140);
  playTone(170, 0.08, 'triangle', 0.06);
  for (const z of [...zombies]) {
    if (z.mesh.position.distanceTo(playerMesh.position) < 6.3) {
      z.hp -= 1;
      if (z.hp <= 0) killZombie(z);
    }
  }
}

function attack() {
  if (!state.started || state.dead || state.shopOpen) return;
  const now = performance.now();
  const cd = state.weapon === 'sword' ? 330 : state.weapon === 'pistol' ? 220 : 130;
  if (now - state.lastAttackAt < cd) return;
  state.lastAttackAt = now;

  if (state.weapon === 'sword') {
    meleeSwing();
    return;
  }
  if (state.ammo[state.weapon] <= 0) {
    state.weapon = 'sword';
    drawWeapon();
    setHint('弹药耗尽，自动切回刀剑');
    return;
  }
  state.ammo[state.weapon] -= 1;
  shootBullet();
}

function anyWallBroken() {
  return walls.some((w) => w.broken);
}

const SHOP_ITEMS = [
  { key: 'pistol', label: '手枪 +100发', cost: 60 },
  { key: 'rifle', label: '步枪 +100发', cost: 120 },
  { key: 'smallMed', label: '小药 +5血', cost: 20 },
  { key: 'bigMed', label: '大药 +10血', cost: 50 },
  { key: 'armor', label: '盔甲 +1防御', cost: 500 },
  { key: 'pig', label: '500玉米换1猪', costCorn: 500 },
  { key: 'sheep', label: '1000玉米换1羊', costCorn: 1000 }
];

function openShop() {
  if (playerMesh.position.distanceTo(vendor.getWorldPosition(new THREE.Vector3())) > 10) {
    setHint('请靠近商店老板再按 B');
    return;
  }
  state.shopOpen = true;
  ui.shopPanel.classList.remove('hidden');
  renderShop();
}
function closeShop() {
  state.shopOpen = false;
  ui.shopPanel.classList.add('hidden');
}
function renderShop() {
  ui.shopList.innerHTML = '';
  SHOP_ITEMS.forEach((it, i) => {
    const li = document.createElement('li');
    li.textContent = `${it.label} - ${it.cost ? `${it.cost}金币` : `${it.costCorn}玉米`}`;
    if (i === state.shopIndex) li.classList.add('active');
    ui.shopList.appendChild(li);
  });
}
function buyCurrent() {
  const it = SHOP_ITEMS[state.shopIndex];
  if (it.cost && state.coins < it.cost) return setHint('金币不足');
  if (it.costCorn && state.corn < it.costCorn) return setHint('玉米不足');
  if ((it.key === 'pig' || it.key === 'sheep') && anyWallBroken()) return setHint('围墙破损时不能买家畜');

  if (it.cost) state.coins -= it.cost;
  if (it.costCorn) state.corn -= it.costCorn;

  if (it.key === 'pistol' || it.key === 'rifle') {
    state.weapon = it.key;
    state.ammo[it.key] += 100;
    drawWeapon();
  }
  if (it.key === 'smallMed') state.health = Math.min(10, state.health + 5);
  if (it.key === 'bigMed') state.health = Math.min(10, state.health + 10);
  if (it.key === 'armor') state.armor += 1;
  if (it.key === 'pig') spawnAnimal('pig', new THREE.Vector3(20 + Math.random() * 8, 0, 10));
  if (it.key === 'sheep') spawnAnimal('sheep', new THREE.Vector3(20 + Math.random() * 8, 0, 16));
  playTone(520, 0.07, 'square', 0.05);
}

function convertVillagerToZombie(v) {
  const p = v.mesh.position.clone();
  village.remove(v.mesh);
  villagers.splice(villagers.indexOf(v), 1);
  spawnZombie(p);
}

function updateVillage(dt) {
  state.cropTimer += dt;
  if (state.cropTimer >= 60) {
    state.cropTimer = 0;
    farmSlots.forEach((s) => { s.grown = true; s.corn.visible = true; });
    setHint('玉米成熟了');
  }

  state.minuteTick += dt;
  if (state.minuteTick >= 60) {
    state.minuteTick = 0;

    for (const v of [...villagers]) {
      if (v.isChild) {
        if (state.corn > 0) {
          state.corn -= 1;
          v.adultAgeProgress += 1;
          if (v.adultAgeProgress >= 100) v.isChild = false;
        }
      } else {
        if (state.corn > 0) {
          state.corn -= 1;
          v.ageEatenCorn += 1;
        }
        if (v.ageEatenCorn >= 100) {
          village.remove(v.mesh);
          villagers.splice(villagers.indexOf(v), 1);
        }
      }
    }

    for (const a of animals) {
      if (state.corn > 0) state.corn -= 1;
      a.age += 1;
      a.breedTimer += 1;
    }

    for (let i = 0; i < animals.length - 1; i += 1) {
      const a = animals[i];
      const b = animals[i + 1];
      if (a.type === b.type && a.breedTimer >= 100 && b.breedTimer >= 100) {
        a.breedTimer = 0;
        b.breedTimer = 0;
        spawnAnimal(a.type, a.mesh.position.clone().add(new THREE.Vector3(1.2, 0, 1.2)));
      }
    }
  }

  state.reproductionTimer += dt;
  if (state.reproductionTimer >= 600) {
    state.reproductionTimer = 0;
    const male = villagers.find((v) => !v.isChild && v.sex === 'M');
    const female = villagers.find((v) => !v.isChild && v.sex === 'F');
    if (male && female && state.corn >= 100) {
      state.corn -= 100;
      spawnVillager(new THREE.Vector3(0, 0, 34), true, Math.random() > 0.5 ? 'M' : 'F');
      setHint('一个小孩出生了');
    }
  }

  if (!anyWallBroken()) {
    const grown = farmSlots.find((s) => s.grown);
    if (grown && villagers.length && Math.random() < 0.025) {
      grown.grown = false;
      grown.corn.visible = false;
      state.corn += 1;
    }
  }

  const dangerNearVillage = zombies.some((z) => z.mesh.position.length() < 130);
  villagers.forEach((v) => {
    const nearest = zombies.reduce((best, z) => {
      const d = z.mesh.position.distanceTo(v.mesh.position);
      return !best || d < best.d ? { z, d } : best;
    }, null);

    if (nearest && nearest.d < 20) {
      const flee = v.mesh.position.clone().sub(nearest.z.mesh.position).setY(0).normalize();
      v.mesh.position.addScaledVector(flee, dt * 2.8);
    } else if (!dangerNearVillage) {
      const broken = walls.find((w) => w.broken);
      if (broken) {
        const dir = broken.mesh.position.clone().sub(v.mesh.position).setY(0);
        if (dir.length() > 1.8) v.mesh.position.addScaledVector(dir.normalize(), dt * 2.2);
        else broken.repairProgress += dt;
      } else {
        if (Math.random() < 0.01) v.target = new THREE.Vector3((Math.random() - 0.5) * 80, 0, (Math.random() - 0.5) * 80);
        const dir = v.target.clone().sub(v.mesh.position).setY(0);
        if (dir.length() > 1) v.mesh.position.addScaledVector(dir.normalize(), dt * 1.7);
      }
    }
    resolveAgainstStatic(v.mesh.position, v.radius);
  });

  walls.forEach((w) => {
    if (w.broken && w.repairProgress >= 6) {
      w.broken = false;
      w.hp = 3;
      w.repairProgress = 0;
      w.mesh.visible = true;
      w.collider.active = true;
      setHint('村民修好了一段围墙');
    }
  });

  separateEntities(villagers, (v) => v.radius);
}

function updateAnimals(dt) {
  const wallBroken = anyWallBroken();
  for (const a of [...animals]) {
    const nearestZ = zombies.reduce((best, z) => {
      const d = z.mesh.position.distanceTo(a.mesh.position);
      return !best || d < best.d ? { z, d } : best;
    }, null);

    if (nearestZ && nearestZ.d < 18) {
      const flee = a.mesh.position.clone().sub(nearestZ.z.mesh.position).setY(0).normalize();
      a.mesh.position.addScaledVector(flee, dt * 3.4);
      if (!wallBroken && a.mesh.position.length() > 84) {
        a.mesh.position.multiplyScalar(84 / a.mesh.position.length());
      }
    } else {
      a.mesh.position.x += (Math.random() - 0.5) * dt * 1.6;
      a.mesh.position.z += (Math.random() - 0.5) * dt * 1.6;
    }

    for (const z of zombies) {
      if (z.mesh.position.distanceTo(a.mesh.position) < 1.6) {
        a.hp -= dt * 1.7;
        if (a.hp <= 0) {
          z.hp = Math.min(5, z.hp + 1);
          village.remove(a.mesh);
          animals.splice(animals.indexOf(a), 1);
          break;
        }
      }
    }

    resolveAgainstStatic(a.mesh.position, a.radius);
  }
  separateEntities(animals, (a) => a.radius);
}

function updateZombies(dt) {
  zombieSpawnTicker += dt;
  if (zombieSpawnTicker > 3.2) {
    zombieSpawnTicker = 0;
    const t = tombs[Math.floor(Math.random() * tombs.length)];
    spawnZombie(t.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)));
  }

  for (const z of [...zombies]) {
    let targetPos = playerMesh.position;
    let best = z.mesh.position.distanceTo(playerMesh.position);
    for (const v of villagers) {
      const d = z.mesh.position.distanceTo(v.mesh.position);
      if (d < best) { best = d; targetPos = v.mesh.position; }
    }

    const wall = walls.find((w) => !w.broken && z.mesh.position.distanceTo(w.mesh.position) < 2.3);
    if (wall) {
      z.wallCd -= dt;
      if (z.wallCd <= 0) {
        wall.hp -= 1;
        z.wallCd = 1;
        playTone(95, 0.06, 'square', 0.03);
        if (wall.hp <= 0) {
          wall.broken = true;
          wall.mesh.visible = false;
          wall.collider.active = false;
          setHint('围墙被破坏了！');
        }
      }
      continue;
    }

    const dir = targetPos.clone().sub(z.mesh.position).setY(0);
    if (dir.length() > 1.2) {
      z.mesh.position.addScaledVector(dir.normalize(), z.speed * dt);
      z.mesh.lookAt(targetPos.x, z.mesh.position.y, targetPos.z);
      resolveAgainstStatic(z.mesh.position, z.radius);
    } else {
      z.attackCd -= dt;
      if (z.attackCd <= 0) {
        if (targetPos === playerMesh.position) {
          state.health -= Math.max(0, 2 - state.armor);
          if (state.health <= 0) {
            state.dead = true;
            ui.finalCoins.textContent = String(state.coins);
            ui.gameOver.classList.remove('hidden');
          }
        } else {
          const victim = villagers.find((v) => v.mesh.position === targetPos);
          if (victim) {
            victim.hp -= 2;
            if (victim.hp <= 0) convertVillagerToZombie(victim);
          }
        }
        z.attackCd = 0.9;
      }
    }
  }
  separateEntities(zombies, (z) => z.radius);
}

function updateBullets(dt) {
  for (const b of [...bullets]) {
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;
    raycaster.set(b.mesh.position, b.vel.clone().normalize());
    const hits = raycaster.intersectObjects(zombies.flatMap((z) => [z.body, z.head]), false);
    if (hits.length && hits[0].distance < 1.2) {
      const data = zombieParts.get(hits[0].object.uuid);
      if (data) {
        if (data.part === 'head') killZombie(data.z);
        else {
          data.z.hp -= state.weapon === 'rifle' ? 2 : 1;
          if (data.z.hp <= 0) killZombie(data.z);
        }
      }
      b.life = 0;
    }
    if (b.life <= 0) {
      scene.remove(b.mesh);
      bullets.splice(bullets.indexOf(b), 1);
    }
  }
}

function updatePlayer(dt) {
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3().crossVectors(forward, DUMMY_UP).multiplyScalar(-1);
  const move = new THREE.Vector3();
  if (keys.w) move.add(forward);
  if (keys.s) move.sub(forward);
  if (keys.a) move.sub(right);
  if (keys.d) move.add(right);
  if (move.lengthSq() > 0) move.normalize();
  player.pos.addScaledVector(move, (keys.shift ? 14 : 10.5) * dt);

  if (keys.space && player.grounded) { player.velY = 8.5; player.grounded = false; }
  player.velY -= 18 * dt;
  player.pos.y += player.velY * dt;
  if (player.pos.y <= 3) { player.pos.y = 3; player.velY = 0; player.grounded = true; }

  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -560, 560);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -560, 560);

  resolvePlayerCollision();

  playerMesh.position.copy(player.pos).setY(player.pos.y - 3);
  playerMesh.rotation.y = player.yaw;

  const camOffset = new THREE.Vector3(0, 10.5, 17).applyAxisAngle(DUMMY_UP, player.yaw);
  camera.position.copy(player.pos.clone().add(camOffset));
  camera.lookAt(player.pos.x, player.pos.y + 2.8, player.pos.z);
}

function tryHitAnimal() {
  for (const a of [...animals]) {
    if (a.mesh.position.distanceTo(playerMesh.position) < 4.2) {
      a.hp -= 1;
      if (a.hp <= 0) {
        village.remove(a.mesh);
        animals.splice(animals.indexOf(a), 1);
        state.health = Math.min(10, state.health + 1);
        setHint('击败动物，回复1点生命');
      }
      break;
    }
  }
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w') keys.w = true;
  if (k === 'a') keys.a = true;
  if (k === 's') keys.s = true;
  if (k === 'd') keys.d = true;
  if (k === ' ') keys.space = true;
  if (k === 'shift') keys.shift = true;

  if (!state.started) return;
  if (k === 'b') {
    if (state.shopOpen) closeShop(); else openShop();
  }
  if (state.shopOpen) {
    if (e.key === 'ArrowUp') { state.shopIndex = (state.shopIndex - 1 + SHOP_ITEMS.length) % SHOP_ITEMS.length; renderShop(); }
    if (e.key === 'ArrowDown') { state.shopIndex = (state.shopIndex + 1) % SHOP_ITEMS.length; renderShop(); }
    if (e.key === 'Enter') buyCurrent();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w') keys.w = false;
  if (k === 'a') keys.a = false;
  if (k === 's') keys.s = false;
  if (k === 'd') keys.d = false;
  if (k === ' ') keys.space = false;
  if (k === 'shift') keys.shift = false;
});

let mouseDown = false;
let pointerLocked = false;
window.addEventListener('mousedown', (e) => {
  if (state.started) renderer.domElement.requestPointerLock?.();
  if (!state.started || state.dead) return;
  if (e.button === 0) {
    attack();
    tryHitAnimal();
  }
  mouseDown = true;
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (!state.started || state.dead) return;
  if (!mouseDown && !pointerLocked) return;
  player.yaw -= e.movementX * 0.0038;
});
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === renderer.domElement; });
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

document.getElementById('startBtn').addEventListener('click', () => {
  state.started = true;
  ui.menu.classList.add('hidden');
  setHint('第三人称像素村庄防守战开始（可拖动或锁定鼠标转向）');
});
document.getElementById('restartBtn').addEventListener('click', () => location.reload());

const clock = new THREE.Clock();
updateHud();
(function tick() {
  const dt = Math.min(0.1, clock.getDelta());
  if (state.started && !state.dead) {
    updatePlayer(dt);
    updateVillage(dt);
    updateAnimals(dt);
    updateZombies(dt);
    updateBullets(dt);
    updateHud();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}());
