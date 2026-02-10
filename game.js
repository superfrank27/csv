import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x86c8ff);
scene.fog = new THREE.Fog(0x9dd6ff, 80, 500);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x4f824f, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(140, 240, 80);
scene.add(sun);

function px(c1, c2) {
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = c1; ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = c2;
  for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) if (((x + y) / 4) % 2 === 0) ctx.fillRect(x, y, 2, 2);
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

const M = {
  grass: new THREE.MeshLambertMaterial({ map: px('#4da14d', '#5cb85c') }),
  wood: new THREE.MeshLambertMaterial({ map: px('#7a532d', '#8b6636') }),
  leaf: new THREE.MeshLambertMaterial({ map: px('#2f7c2f', '#3b8f3b') }),
  stone: new THREE.MeshLambertMaterial({ map: px('#7a7a7a', '#909090') }),
  roof: new THREE.MeshLambertMaterial({ map: px('#aa4c4c', '#8f3f3f') }),
  wall: new THREE.MeshLambertMaterial({ map: px('#b49a74', '#c7b086') }),
  soil: new THREE.MeshLambertMaterial({ map: px('#7a5b30', '#87653a') }),
  seed: new THREE.MeshLambertMaterial({ map: px('#8c6f2c', '#9d7f33') }),
  leafCorn: new THREE.MeshLambertMaterial({ map: px('#7fbf3f', '#95cf52') }),
  corn: new THREE.MeshLambertMaterial({ map: px('#d8c247', '#e8d45f') })
};

scene.add(new THREE.Mesh(new THREE.BoxGeometry(900, 500, 900), new THREE.MeshBasicMaterial({ color: 0x9ed8ff, side: THREE.BackSide })));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), M.grass);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const ui = {
  menu: document.getElementById('menu'), gameOver: document.getElementById('gameOver'),
  finalCoins: document.getElementById('finalCoins'), health: document.getElementById('health'),
  coins: document.getElementById('coins'), armor: document.getElementById('armor'), weapon: document.getElementById('weapon'),
  ammo: document.getElementById('ammo'), corn: document.getElementById('corn'), villagers: document.getElementById('villagers'),
  animals: document.getElementById('animals'), hint: document.getElementById('hint'),
  shopPanel: document.getElementById('shopPanel'), shopList: document.getElementById('shopList')
};

const state = {
  started: false, dead: false, health: 10, coins: 0, armor: 0, corn: 30,
  weapon: 'sword', ammo: { pistol: 0, rifle: 0 }, shopOpen: false, shopIndex: 0,
  lastAttackAt: 0, minuteTick: 0, waveTimer: 0, waveCooldown: 8, waveSize: 4, waveNumber: 1
};

const keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
const player = { pos: new THREE.Vector3(0, 3, 30), velY: 0, yaw: 0, grounded: true, radius: 0.85 };

const staticColliders = [];
const UP = new THREE.Vector3(0, 1, 0);

function addCollider(x, z, w, d, isWall = false) {
  staticColliders.push({ x, z, w, d, active: true, isWall });
  return staticColliders[staticColliders.length - 1];
}
function pushOut(pos, r, ignoreWallJump = false) {
  for (const c of staticColliders) {
    if (!c.active) continue;
    if (ignoreWallJump && c.isWall && player.pos.y > 4.6) continue;
    const nx = THREE.MathUtils.clamp(pos.x, c.x - c.w / 2, c.x + c.w / 2);
    const nz = THREE.MathUtils.clamp(pos.z, c.z - c.d / 2, c.z + c.d / 2);
    const dx = pos.x - nx; const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.0001;
      const p = (r - d) + 0.01;
      pos.x += (dx / d) * p;
      pos.z += (dz / d) * p;
    }
  }
}
function separate(list, getR) {
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]; const b = list[j];
      const dx = a.mesh.position.x - b.mesh.position.x;
      const dz = a.mesh.position.z - b.mesh.position.z;
      const rr = getR(a) + getR(b);
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.0001;
        const p = (rr - d) * 0.5;
        a.mesh.position.x += (dx / d) * p;
        a.mesh.position.z += (dz / d) * p;
        b.mesh.position.x -= (dx / d) * p;
        b.mesh.position.z -= (dz / d) * p;
      }
    }
  }
}

function buildHumanoid(opts) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ map: px(opts.cloth1, opts.cloth2) });
  const skinMat = new THREE.MeshLambertMaterial({ map: px(opts.skin1, opts.skin2) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 3.2, 1.4), bodyMat);
  body.position.y = 1.7;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), skinMat);
  head.position.y = 4.2;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 0.6), bodyMat);
  const armR = armL.clone();
  armL.position.set(-1.35, 2.0, 0); armR.position.set(1.35, 2.0, 0);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.1, 0.7), bodyMat);
  const legR = legL.clone();
  legL.position.set(-0.45, 0.8, 0); legR.position.set(0.45, 0.8, 0);
  g.add(body, head, armL, armR, legL, legR);
  g.userData.parts = { armL, armR, legL, legR, head };
  return g;
}

function animateWalk(entity, speed) {
  const p = entity.mesh.userData.parts;
  if (!p) return;
  entity.walkPhase = (entity.walkPhase || 0) + speed;
  const s = Math.sin(entity.walkPhase) * 0.6;
  p.armL.rotation.x = s; p.armR.rotation.x = -s;
  p.legL.rotation.x = -s; p.legR.rotation.x = s;
}

function buildZombie() {
  const g = buildHumanoid({ cloth1: '#2f9b45', cloth2: '#38ac52', skin1: '#5bc86b', skin2: '#69d97a' });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.55), new THREE.MeshLambertMaterial({ map: px('#2e2e2e', '#111111') }));
  mouth.position.set(0, 3.7, 0.88);
  g.add(mouth);
  g.userData.mouth = mouth;
  return g;
}

function buildAnimal(type) {
  const c = type === 'pig' ? ['#f3a9b7', '#e28e9e'] : ['#f2f2f2', '#d9d9d9'];
  const m = new THREE.MeshLambertMaterial({ map: px(c[0], c[1]) });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.2), m);
  body.position.y = 0.8;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 0.95), m);
  head.position.set(1.45, 0.95, 0);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.6), m);
  snout.position.set(1.95, 0.85, 0);
  const legM = new THREE.MeshLambertMaterial({ map: px(type === 'pig' ? '#d98ea0' : '#cfcfcf', type === 'pig' ? '#c97a8d' : '#bdbdbd') });
  const legs = [];
  [[-0.7, -0.35], [-0.7, 0.35], [0.7, -0.35], [0.7, 0.35]].forEach(([x, z]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.28), legM);
    l.position.set(x, 0.3, z);
    legs.push(l);
    g.add(l);
  });
  g.add(body, head, snout);
  g.userData.legs = legs;
  return g;
}

const village = new THREE.Group();
scene.add(village);

function addTree(x, z) {
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(2, 12, 2), M.wood);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), M.leaf);
  trunk.position.set(x, 6, z);
  crown.position.set(x, 13, z);
  scene.add(trunk, crown);
  addCollider(x, z, 4.5, 4.5);
}
for (let i = 0; i < 120; i += 1) {
  const x = (Math.random() - 0.5) * 600;
  const z = (Math.random() - 0.5) * 600;
  if (Math.abs(x) < 110 && Math.abs(z) < 110) continue;
  addTree(x, z);
}

function addHouse(x, z) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(10, 6.5, 8), M.wood);
  const r = new THREE.Mesh(new THREE.BoxGeometry(11.2, 2.2, 9.2), M.roof);
  b.position.set(x, 3.25, z); r.position.set(x, 7.5, z);
  village.add(b, r);
  addCollider(x, z, 10, 8);
}
addHouse(-24, -14); addHouse(24, -14); addHouse(0, 20);

const shop = new THREE.Mesh(new THREE.BoxGeometry(11, 6.8, 8), new THREE.MeshLambertMaterial({ map: px('#4d7cae', '#6293c9') }));
shop.position.set(0, 3.4, -26);
village.add(shop);
addCollider(0, -26, 11, 8);
const shopSign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 0.8), new THREE.MeshLambertMaterial({ map: px('#f2c451', '#deb349') }));
shopSign.position.set(0, 7.8, -21.1);
village.add(shopSign);

const vendor = buildHumanoid({ cloth1: '#355b9a', cloth2: '#476fb2', skin1: '#e0be95', skin2: '#cda178' });
vendor.position.set(0, 0, -14);
village.add(vendor);

const farmSlots = [];
for (let i = 0; i < 9; i += 1) {
  const row = Math.floor(i / 3); const col = i % 3;
  const x = -18 + col * 6; const z = -2 + row * 6;
  const soil = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 5), M.soil);
  soil.position.set(x, 0.25, z); village.add(soil);
  const plant = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), M.seed);
  plant.position.set(x, 0.6, z); plant.visible = false;
  village.add(plant);
  farmSlots.push({ stage: 0, timer: 0, plant }); // 0 none,1 seed,2 leaf,3 corn
}

const walls = [];
function addWall(x, z, w, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.8, d), M.wall);
  m.position.set(x, 1.9, z);
  village.add(m);
  const wall = { mesh: m, hp: 3, broken: false, repairProgress: 0 };
  wall.collider = addCollider(x, z, w, d, true);
  walls.push(wall);
}
addWall(0, -40, 88, 2.2);
addWall(0, 40, 88, 2.2);
addWall(-44, 0, 2.2, 82);
addWall(44, 0, 2.2, 82);

const playerMesh = buildHumanoid({ cloth1: '#4062aa', cloth2: '#5175be', skin1: '#dcb991', skin2: '#cb9f73' });
const armor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 1.8), new THREE.MeshLambertMaterial({ map: px('#9fb2c4', '#7d92a7') }));
armor.position.y = 2.1; armor.visible = false;
playerMesh.add(armor);
const weapon = new THREE.Group(); weapon.position.set(1.3, 2.0, 0); playerMesh.add(weapon);
scene.add(playerMesh);

function drawWeapon() {
  weapon.clear();
  if (state.weapon === 'sword') {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), M.wood);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.5, 0.2), M.stone);
    h.position.y = -0.2; b.position.y = 1.45; weapon.add(h, b);
  } else if (state.weapon === 'pistol') weapon.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.22), M.stone));
  else weapon.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.24, 0.24), M.stone));
}
drawWeapon();

const villagers = [];
const animals = [];
const zombies = [];
const zombieParts = new Map();
const bullets = [];
const raycaster = new THREE.Raycaster();

function spawnVillager(pos, isChild = false) {
  const mesh = buildHumanoid({ cloth1: '#8e6f58', cloth2: '#9f8165', skin1: '#d6b58f', skin2: '#c49b77' });
  mesh.scale.setScalar(isChild ? 0.72 : 1);
  mesh.position.copy(pos);
  village.add(mesh);
  villagers.push({ mesh, hp: 4, isChild, sex: Math.random() > 0.5 ? 'M' : 'F', adultAgeProgress: 0, ageEatenCorn: 0, target: pos.clone(), radius: isChild ? 0.55 : 0.75, walkPhase: 0 });
}
for (let i = 0; i < 6; i += 1) spawnVillager(new THREE.Vector3(-10 + i * 4, 0, 12));

function spawnAnimal(type, pos) {
  const mesh = buildAnimal(type);
  mesh.position.copy(pos);
  village.add(mesh);
  animals.push({ type, mesh, hp: 2, age: 0, breedTimer: 0, radius: 0.95, walkPhase: 0 });
}
spawnAnimal('pig', new THREE.Vector3(15, 0, 10));
spawnAnimal('pig', new THREE.Vector3(18, 0, 12));
spawnAnimal('sheep', new THREE.Vector3(12, 0, 16));

const tombs = [new THREE.Vector3(0, 0, -210), new THREE.Vector3(210, 0, 0), new THREE.Vector3(-210, 0, 0), new THREE.Vector3(0, 0, 210)];
for (const t of tombs) {
  const tm = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 12), M.stone);
  tm.position.set(t.x, 4.5, t.z);
  scene.add(tm);
  addCollider(t.x, t.z, 18, 12);
}

function spawnZombie(pos) {
  const mesh = buildZombie();
  mesh.position.copy(pos);
  scene.add(mesh);
  const body = mesh.children[0]; const head = mesh.children[1];
  const z = { mesh, body, head, hp: 3, speed: 5.2 + Math.random() * 1.4, attackCd: 0, wallCd: 0, radius: 0.85, walkPhase: 0, biteAnim: 0 };
  zombies.push(z);
  zombieParts.set(body.uuid, { z, part: 'body' });
  zombieParts.set(head.uuid, { z, part: 'head' });
}

function tone(freq, dur = 0.08, type = 'square', vol = 0.05) {
  const ctx = tone.ctx || (tone.ctx = new (window.AudioContext || window.webkitAudioContext)());
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = type; osc.frequency.value = freq; g.gain.value = vol;
  osc.connect(g); g.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + dur);
}

function hint(t) {
  ui.hint.textContent = t;
  setTimeout(() => { if (ui.hint.textContent === t) ui.hint.textContent = '-'; }, 700);
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
  armor.visible = state.armor > 0;
}

function killZombie(z) {
  zombieParts.delete(z.body.uuid); zombieParts.delete(z.head.uuid);
  scene.remove(z.mesh);
  zombies.splice(zombies.indexOf(z), 1);
  state.coins += 1;
}

function shootBullet() {
  const dir = new THREE.Vector3(Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffdf66 }));
  b.position.copy(playerMesh.position).add(new THREE.Vector3(0, 2.7, 0)).addScaledVector(dir, 1.5);
  scene.add(b);
  bullets.push({ mesh: b, vel: dir.multiplyScalar(state.weapon === 'rifle' ? 140 : 105), life: 2 });
  tone(290, 0.05, 'sawtooth', 0.07);
}

function swordHitForwardOnly() {
  weapon.rotation.x = -1.1;
  setTimeout(() => { weapon.rotation.x = 0; }, 140);
  tone(170, 0.08, 'triangle', 0.06);

  const fwd = new THREE.Vector3(Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  for (const z of [...zombies]) {
    const to = z.mesh.position.clone().sub(playerMesh.position).setY(0);
    const dist = to.length();
    if (dist > 6.5) continue;
    const dot = to.normalize().dot(fwd);
    if (dot > 0.45) {
      z.hp -= 1;
      if (z.hp <= 0) killZombie(z);
    }
  }
}

function attack() {
  if (!state.started || state.dead || state.shopOpen) return;
  const now = performance.now();
  const cd = state.weapon === 'sword' ? 250 : state.weapon === 'pistol' ? 140 : 95;
  if (now - state.lastAttackAt < cd) return;
  state.lastAttackAt = now;

  if (state.weapon === 'sword') return swordHitForwardOnly();
  if (state.ammo[state.weapon] <= 0) {
    state.weapon = 'sword'; drawWeapon(); hint('弹药耗尽，切回刀剑');
    return;
  }
  state.ammo[state.weapon] -= 1;
  shootBullet();
}

const SHOP_ITEMS = [
  { key: 'pistol', label: '手枪 +100发', cost: 60 },
  { key: 'rifle', label: '步枪 +100发', cost: 120 },
  { key: 'smallMed', label: '小药 +5血', cost: 20 },
  { key: 'bigMed', label: '大药 +10血', cost: 50 },
  { key: 'armor', label: '盔甲 +1防御', cost: 500 }
];

function openShop() {
  if (playerMesh.position.distanceTo(vendor.position) > 8.5) return hint('靠近商店老板按 B');
  state.shopOpen = true;
  ui.shopPanel.classList.remove('hidden');
  renderShop();
}
function closeShop() { state.shopOpen = false; ui.shopPanel.classList.add('hidden'); }
function renderShop() {
  ui.shopList.innerHTML = '';
  SHOP_ITEMS.forEach((it, i) => {
    const li = document.createElement('li');
    li.textContent = `${it.label} - ${it.cost}金币`;
    if (i === state.shopIndex) li.classList.add('active');
    ui.shopList.appendChild(li);
  });
}
function buyCurrent() {
  const it = SHOP_ITEMS[state.shopIndex];
  if (state.coins < it.cost) return hint('金币不足');
  state.coins -= it.cost;
  if (it.key === 'pistol' || it.key === 'rifle') { state.weapon = it.key; state.ammo[it.key] += 100; drawWeapon(); }
  if (it.key === 'smallMed') state.health = Math.min(10, state.health + 5);
  if (it.key === 'bigMed') state.health = Math.min(10, state.health + 10);
  if (it.key === 'armor') state.armor += 1;
  tone(520, 0.07, 'square', 0.05);
}

function convertVillager(v) {
  const p = v.mesh.position.clone();
  village.remove(v.mesh);
  villagers.splice(villagers.indexOf(v), 1);
  spawnZombie(p);
}

function updateCorn(dt) {
  farmSlots.forEach((s) => {
    s.timer += dt;
    if (s.stage === 0 && s.timer > 16) { s.stage = 1; s.timer = 0; s.plant.geometry = new THREE.BoxGeometry(0.45, 0.4, 0.45); s.plant.material = M.seed; s.plant.position.y = 0.45; s.plant.visible = true; }
    else if (s.stage === 1 && s.timer > 16) { s.stage = 2; s.timer = 0; s.plant.geometry = new THREE.BoxGeometry(0.6, 1.5, 0.6); s.plant.material = M.leafCorn; s.plant.position.y = 1.0; }
    else if (s.stage === 2 && s.timer > 16) { s.stage = 3; s.timer = 0; s.plant.geometry = new THREE.BoxGeometry(0.8, 2.2, 0.8); s.plant.material = M.corn; s.plant.position.y = 1.4; }
  });
}

function anyBrokenWall() { return walls.some((w) => w.broken); }

function updateVillage(dt) {
  updateCorn(dt);

  state.minuteTick += dt;
  if (state.minuteTick >= 60) {
    state.minuteTick = 0;
    for (const v of [...villagers]) {
      if (v.isChild) {
        if (state.corn > 0) { state.corn -= 1; v.adultAgeProgress += 1; if (v.adultAgeProgress >= 100) v.isChild = false; }
      } else {
        if (state.corn > 0) { state.corn -= 1; v.ageEatenCorn += 1; }
        if (v.ageEatenCorn >= 100) { village.remove(v.mesh); villagers.splice(villagers.indexOf(v), 1); }
      }
    }
    for (const a of animals) { if (state.corn > 0) state.corn -= 1; a.age += 1; a.breedTimer += 1; }
  }

  for (let i = 0; i < animals.length - 1; i += 1) {
    const a = animals[i]; const b = animals[i + 1];
    if (a.type === b.type && a.breedTimer >= 100 && b.breedTimer >= 100) {
      a.breedTimer = 0; b.breedTimer = 0;
      spawnAnimal(a.type, a.mesh.position.clone().add(new THREE.Vector3(1, 0, 1)));
    }
  }

  const male = villagers.find((v) => !v.isChild && v.sex === 'M');
  const female = villagers.find((v) => !v.isChild && v.sex === 'F');
  if (male && female && state.corn >= 100 && Math.random() < dt / 600) {
    state.corn -= 100;
    spawnVillager(new THREE.Vector3(0, 0, 14), true);
    hint('村里新增一个小孩');
  }

  villagers.forEach((v) => {
    const nearest = zombies.reduce((b, z) => {
      const d = z.mesh.position.distanceTo(v.mesh.position);
      return !b || d < b.d ? { z, d } : b;
    }, null);

    if (nearest && nearest.d < 18) {
      const flee = v.mesh.position.clone().sub(nearest.z.mesh.position).setY(0).normalize();
      v.mesh.position.addScaledVector(flee, dt * 4.0);
      animateWalk(v, dt * 18);
    } else {
      const broken = walls.find((w) => w.broken);
      if (broken && !anyBrokenWall() === false && zombies.length < 2) {
        const d = broken.mesh.position.clone().sub(v.mesh.position).setY(0);
        if (d.length() > 1.6) {
          v.mesh.position.addScaledVector(d.normalize(), dt * 3);
          animateWalk(v, dt * 14);
        } else broken.repairProgress += dt;
      } else {
        if (Math.random() < 0.02) v.target = new THREE.Vector3((Math.random() - 0.5) * 36, 0, (Math.random() - 0.5) * 30);
        const d = v.target.clone().sub(v.mesh.position).setY(0);
        if (d.length() > 1) {
          v.mesh.position.addScaledVector(d.normalize(), dt * 2.6);
          animateWalk(v, dt * 10);
        }
      }
      const corn = farmSlots.find((s) => s.stage === 3);
      if (corn && Math.random() < 0.02) {
        corn.stage = 0; corn.timer = 0; corn.plant.visible = false; state.corn += 1;
      }
    }
    pushOut(v.mesh.position, v.radius);
  });

  walls.forEach((w) => {
    if (w.broken && w.repairProgress > 4.5) {
      w.broken = false; w.hp = 3; w.repairProgress = 0;
      w.mesh.visible = true; w.collider.active = true;
      hint('围墙修好了');
    }
  });

  separate(villagers, (v) => v.radius);
}

function updateAnimals(dt) {
  for (const a of [...animals]) {
    const nz = zombies.reduce((b, z) => {
      const d = z.mesh.position.distanceTo(a.mesh.position);
      return !b || d < b.d ? { z, d } : b;
    }, null);

    if (nz && nz.d < 16) {
      const flee = a.mesh.position.clone().sub(nz.z.mesh.position).setY(0).normalize();
      a.mesh.position.addScaledVector(flee, dt * 5);
      animateWalk(a, dt * 16);
    } else {
      a.mesh.position.x += (Math.random() - 0.5) * dt * 2.8;
      a.mesh.position.z += (Math.random() - 0.5) * dt * 2.8;
      animateWalk(a, dt * 10);
    }

    for (const z of zombies) {
      if (z.mesh.position.distanceTo(a.mesh.position) < 1.6) {
        a.hp -= dt * 2;
        if (a.hp <= 0) {
          z.hp = Math.min(5, z.hp + 1);
          village.remove(a.mesh);
          animals.splice(animals.indexOf(a), 1);
          break;
        }
      }
    }

    pushOut(a.mesh.position, a.radius);
  }
  separate(animals, (a) => a.radius);
}

function updateZombieWaves(dt) {
  state.waveTimer += dt;
  if (state.waveTimer >= state.waveCooldown) {
    state.waveTimer = 0;
    const count = state.waveSize;
    for (let i = 0; i < count; i += 1) {
      const tomb = tombs[Math.floor(Math.random() * tombs.length)];
      const offset = new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8);
      spawnZombie(tomb.clone().add(offset));
    }
    state.waveNumber += 1;
    state.waveSize = Math.min(18, 4 + Math.floor(state.waveNumber / 2));
    state.waveCooldown = Math.max(3.2, 8 - state.waveNumber * 0.15);
  }
}

function updateZombies(dt) {
  updateZombieWaves(dt);

  for (const z of [...zombies]) {
    let target = playerMesh.position;
    let best = z.mesh.position.distanceTo(playerMesh.position);
    for (const v of villagers) {
      const d = z.mesh.position.distanceTo(v.mesh.position);
      if (d < best) { best = d; target = v.mesh.position; }
    }

    const nearWall = walls.find((w) => !w.broken && z.mesh.position.distanceTo(w.mesh.position) < 2.2);
    if (nearWall) {
      z.wallCd -= dt;
      if (z.wallCd <= 0) {
        nearWall.hp -= 1;
        z.wallCd = 0.75;
        if (nearWall.hp <= 0) {
          nearWall.broken = true;
          nearWall.mesh.visible = false;
          nearWall.collider.active = false;
          hint('围墙被咬破了！');
        }
      }
      continue;
    }

    const dir = target.clone().sub(z.mesh.position).setY(0);
    if (dir.length() > 1.15) {
      z.mesh.position.addScaledVector(dir.normalize(), z.speed * dt);
      z.mesh.lookAt(target.x, z.mesh.position.y, target.z);
      animateWalk(z, dt * 15);
      pushOut(z.mesh.position, z.radius);
    } else {
      z.attackCd -= dt;
      z.biteAnim += dt * 16;
      const mouth = z.mesh.userData.mouth;
      mouth.scale.y = 1 + Math.abs(Math.sin(z.biteAnim)) * 0.9;

      const mouthWorld = mouth.getWorldPosition(new THREE.Vector3());
      if (z.attackCd <= 0) {
        if (target === playerMesh.position) {
          const pMouthDist = mouthWorld.distanceTo(playerMesh.position.clone().add(new THREE.Vector3(0, 2.7, 0)));
          if (pMouthDist < 1.45) {
            state.health -= Math.max(0, 2 - state.armor);
            tone(120, 0.08, 'square', 0.04);
            if (state.health <= 0) {
              state.dead = true;
              ui.finalCoins.textContent = String(state.coins);
              ui.gameOver.classList.remove('hidden');
            }
          }
        } else {
          const victim = villagers.find((v) => v.mesh.position === target);
          if (victim) {
            const vDist = mouthWorld.distanceTo(victim.mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
            if (vDist < 1.4) {
              victim.hp -= 2;
              if (victim.hp <= 0) convertVillager(victim);
            }
          }
        }
        z.attackCd = 0.8;
      }
    }
  }

  separate(zombies, (z) => z.radius);
}

function updateBullets(dt) {
  for (const b of [...bullets]) {
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;
    raycaster.set(b.mesh.position, b.vel.clone().normalize());
    const hits = raycaster.intersectObjects(zombies.flatMap((z) => [z.body, z.head]), false);
    if (hits.length && hits[0].distance < 1.2) {
      const info = zombieParts.get(hits[0].object.uuid);
      if (info) {
        if (info.part === 'head') killZombie(info.z);
        else {
          info.z.hp -= state.weapon === 'rifle' ? 2 : 1;
          if (info.z.hp <= 0) killZombie(info.z);
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
  const right = new THREE.Vector3().crossVectors(UP, forward).normalize();
  const move = new THREE.Vector3();
  if (keys.w) move.add(forward);
  if (keys.s) move.sub(forward);
  if (keys.a) move.sub(right);
  if (keys.d) move.add(right);
  if (move.lengthSq() > 0) move.normalize();
  player.pos.addScaledVector(move, (keys.shift ? 16 : 12) * dt);

  if (keys.space && player.grounded) { player.velY = 10.2; player.grounded = false; }
  player.velY -= 20 * dt;
  player.pos.y += player.velY * dt;
  if (player.pos.y <= 3) { player.pos.y = 3; player.velY = 0; player.grounded = true; }

  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -320, 320);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -320, 320);
  pushOut(player.pos, player.radius, true);

  playerMesh.position.copy(player.pos).setY(player.pos.y - 3);
  playerMesh.rotation.y = player.yaw;
  animateWalk({ mesh: playerMesh, walkPhase: player.walkPhase || 0 }, dt * 10);
  player.walkPhase = (player.walkPhase || 0) + dt * 10;

  const camOff = new THREE.Vector3(0, 10, 16).applyAxisAngle(UP, player.yaw);
  camera.position.copy(player.pos.clone().add(camOff));
  camera.lookAt(player.pos.x, player.pos.y + 2.8, player.pos.z);
}

function hitAnimalBySword() {
  const fwd = new THREE.Vector3(Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  for (const a of [...animals]) {
    const to = a.mesh.position.clone().sub(playerMesh.position).setY(0);
    if (to.length() < 5.5 && to.normalize().dot(fwd) > 0.4) {
      a.hp -= 1;
      if (a.hp <= 0) {
        village.remove(a.mesh);
        animals.splice(animals.indexOf(a), 1);
        state.health = Math.min(10, state.health + 1);
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
  if (k === 'shift') keys.shift = true;
  if (k === ' ') keys.space = true;

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
  if (k === 'shift') keys.shift = false;
  if (k === ' ') keys.space = false;
});

let mouseDown = false;
let pointerLocked = false;
window.addEventListener('mousedown', (e) => {
  if (state.started) renderer.domElement.requestPointerLock?.();
  if (!state.started || state.dead) return;
  if (e.button === 0) {
    attack();
    if (state.weapon === 'sword') hitAnimalBySword();
  }
  mouseDown = true;
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (!state.started || state.dead) return;
  if (!mouseDown && !pointerLocked) return;
  player.yaw -= e.movementX * 0.0044;
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
  hint('高节奏波次防守开始！');
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
